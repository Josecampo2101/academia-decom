import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

type RequestBody = {
  action?: "validate" | "submit";
  token?: string;
  captchaToken?: string;
  fullName?: string;
  email?: string;
  phone?: string;
  dateOfBirth?: string;
  congregationId?: string;
  requestedRoleId?: string | null;
};

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });

function hashInvitationToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

async function verifyCaptcha(token: string, request: NextRequest) {
  const secret = process.env.TURNSTILE_SECRET_KEY;

  if (!secret) {
    return { ok: false, unavailable: true };
  }

  const form = new URLSearchParams({
    secret,
    response: token,
  });
  const forwardedFor = request.headers.get("x-forwarded-for");
  const remoteIp = forwardedFor?.split(",")[0]?.trim();

  if (remoteIp) form.set("remoteip", remoteIp);

  try {
    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form,
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      }
    );

    if (!response.ok) return { ok: false, unavailable: true };

    const result = (await response.json()) as {
      success?: boolean;
      hostname?: string;
      action?: string;
    };

    const expectedHost = process.env.TURNSTILE_EXPECTED_HOSTNAME;
    const hostnameMatches =
      !expectedHost || result.hostname === expectedHost;

    return {
      ok: result.success === true && hostnameMatches,
      unavailable: false,
    };
  } catch {
    return { ok: false, unavailable: true };
  }
}

function isValidUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

export async function POST(request: NextRequest) {
  let body: RequestBody;

  try {
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > 12_000) {
      return json({ error: "La solicitud es demasiado grande." }, 413);
    }
    body = (await request.json()) as RequestBody;
  } catch {
    return json({ error: "No se pudo leer la solicitud." }, 400);
  }

  if (body.action !== "validate" && body.action !== "submit") {
    return json({ error: "Acción no válida." }, 400);
  }

  const token = body.token?.trim() ?? "";
  const captchaToken = body.captchaToken?.trim() ?? "";

  if (token.length < 32 || token.length > 512) {
    return json({ error: "El enlace de invitación no es válido." }, 400);
  }

  if (!captchaToken || captchaToken.length > 4096) {
    return json({ error: "Completa la verificación de seguridad." }, 400);
  }

  const captcha = await verifyCaptcha(captchaToken, request);
  if (captcha.unavailable) {
    return json(
      { error: "La verificación de seguridad no está disponible. Inténtalo más tarde." },
      503
    );
  }
  if (!captcha.ok) {
    return json(
      { error: "No se pudo validar la verificación de seguridad. Inténtalo de nuevo." },
      400
    );
  }

  const tokenHash = hashInvitationToken(token);
  const supabase = createAdminClient();

  const { data: invitation, error: invitationError } = await supabase
    .from("invitations")
    .select("id, district_id, invitation_type, expires_at, accepted_at, revoked_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (invitationError || !invitation) {
    return json({ error: "El enlace no existe o no es válido." }, 404);
  }

  if (invitation.revoked_at) {
    return json({ error: "Esta invitación fue revocada." }, 410);
  }
  if (invitation.accepted_at) {
    return json({ error: "Esta invitación ya fue utilizada." }, 410);
  }
  if (new Date(invitation.expires_at).getTime() <= Date.now()) {
    return json({ error: "Esta invitación ha vencido." }, 410);
  }
  if (
    invitation.invitation_type !== "guest" &&
    invitation.invitation_type !== "decom_member"
  ) {
    return json({ error: "Este enlace no admite solicitudes públicas." }, 403);
  }

  const { data: district, error: districtError } = await supabase
    .from("districts")
    .select("id, name")
    .eq("id", invitation.district_id)
    .eq("status", "active")
    .maybeSingle();

  if (districtError || !district) {
    return json({ error: "El distrito de esta invitación no está disponible." }, 410);
  }

  if (body.action === "validate") {
    const { data: congregations, error: congregationsError } = await supabase
      .from("congregations")
      .select("id, name")
      .eq("district_id", district.id)
      .eq("status", "active")
      .order("name", { ascending: true });

    if (congregationsError) {
      return json({ error: "No fue posible cargar las congregaciones." }, 503);
    }

    let roles: Array<{ id: string; name: string }> = [];
    if (invitation.invitation_type === "decom_member") {
      const { data: roleRows, error: rolesError } = await supabase
        .from("roles")
        .select("id, name")
        .in("role_key", ["district_coordinator", "area_coordinator"])
        .order("name", { ascending: true });

      if (rolesError) {
        return json({ error: "No fue posible cargar los roles disponibles." }, 503);
      }
      roles = roleRows ?? [];
    }

    return json({
      valid: true,
      invitationType: invitation.invitation_type,
      districtName: district.name,
      congregations: congregations ?? [],
      roles,
    });
  }

  const fullName = body.fullName?.trim() ?? "";
  const email = body.email?.trim().toLowerCase() ?? "";
  const phone = body.phone?.trim() ?? "";
  const dateOfBirth = body.dateOfBirth?.trim() ?? "";
  const congregationId = body.congregationId?.trim() ?? "";
  const requestedRoleId = body.requestedRoleId?.trim() || null;

  if (fullName.length < 3 || fullName.length > 140) {
    return json({ error: "Ingresa tu nombre completo." }, 400);
  }
  if (
    email.length > 254 ||
    !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i.test(
      email
    )
  ) {
    return json({ error: "Ingresa un correo electrónico válido." }, 400);
  }
  const phoneDigits = phone.replace(/\D/g, "");
  if (phone.length > 40 || phoneDigits.length < 7 || phoneDigits.length > 20) {
    return json({ error: "Ingresa un número de WhatsApp válido." }, 400);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
    return json({ error: "Ingresa una fecha de nacimiento válida." }, 400);
  }
  const birthDate = new Date(`${dateOfBirth}T00:00:00.000Z`);
  if (
    Number.isNaN(birthDate.getTime()) ||
    birthDate.toISOString().slice(0, 10) !== dateOfBirth ||
    birthDate.getTime() > Date.now()
  ) {
    return json({ error: "La fecha de nacimiento no es válida." }, 400);
  }
  if (!isValidUuid(congregationId)) {
    return json({ error: "Selecciona una congregación válida." }, 400);
  }
  if (
    invitation.invitation_type === "guest" &&
    requestedRoleId
  ) {
    return json({ error: "Los invitados no pueden solicitar un rol institucional." }, 400);
  }
  if (
    invitation.invitation_type === "decom_member" &&
    (!requestedRoleId || !isValidUuid(requestedRoleId))
  ) {
    return json({ error: "Selecciona el rol institucional que deseas solicitar." }, 400);
  }

  const { data, error } = await supabase.rpc("submit_invitation_request_v2", {
    p_token_hash: tokenHash,
    p_full_name: fullName,
    p_email: email,
    p_phone: phone,
    p_date_of_birth: dateOfBirth,
    p_requested_congregation_id: congregationId,
    p_requested_role_id: requestedRoleId,
  });

  if (error || !data || data.success !== true) {
    const message = error?.message ?? "No fue posible registrar la solicitud.";
    if (/ya existe una solicitud/i.test(message)) {
      return json({ error: "Ya existe una solicitud con este correo para esta invitación." }, 409);
    }
    return json({ error: "No fue posible registrar la solicitud. Verifica los datos e inténtalo de nuevo." }, 400);
  }

  return json({
    success: true,
    status: "pending",
    message: "Tu solicitud fue recibida y está pendiente de aprobación.",
  });
}
