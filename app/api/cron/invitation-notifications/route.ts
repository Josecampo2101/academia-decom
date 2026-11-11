import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isNotificationStateCompatible } from "@/lib/invitations/notifications.mjs";

type ClaimedNotification = {
  notification_id: string;
  invitation_request_id: string;
  notification_type: "request_received" | "request_approved" | "request_rejected";
  recipient_email: string;
  attempt_number: number;
};

type RequestRecord = {
  id: string;
  full_name: string;
  email: string;
  status: "pending" | "approved" | "rejected";
  decision_note: string | null;
};

function response(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
}

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization") ?? "";
  const supplied = header.startsWith("Bearer ") ? header.slice(7) : "";

  if (!secret || !supplied) return false;

  const expected = Buffer.from(secret, "utf8");
  const received = Buffer.from(supplied, "utf8");
  if (expected.length === 0 || expected.length !== received.length) return false;

  return timingSafeEqual(received, expected);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });
}

function buildEmail(
  notification: ClaimedNotification,
  request: RequestRecord,
  appUrl: string
) {
  const name = escapeHtml(request.full_name || "integrante");
  const brand = "Academia DECOM";

  if (notification.notification_type === "request_received") {
    return {
      subject: "Recibimos tu solicitud — Academia DECOM",
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#102D4D">
        <div style="background:#102D4D;padding:28px;border-radius:16px 16px 0 0;color:white">
          <p style="margin:0;color:#55D1C4;font-size:12px;letter-spacing:2px;font-weight:bold">ACADEMIA DECOM</p>
          <h1 style="margin:14px 0 0;font-size:24px">Solicitud recibida</h1>
        </div>
        <div style="padding:28px;border:1px solid #e2e8f0;border-top:0;border-radius:0 0 16px 16px">
          <p>Hola, <strong>${name}</strong>.</p>
          <p>Hemos recibido tu solicitud de vinculación a ${brand}. Nuestro equipo administrativo revisará la información.</p>
          <p>Te enviaremos otro correo cuando exista una decisión. Por ahora no necesitas realizar ninguna otra acción.</p>
          <p style="color:#64748b;font-size:12px;margin-top:28px">Este mensaje confirma la recepción de tu solicitud; no significa que tu cuenta ya esté aprobada o activa.</p>
        </div>
      </div>`,
    };
  }

  if (notification.notification_type === "request_approved") {
    const activationUrl = new URL("/activar", appUrl);
    activationUrl.searchParams.set("request_id", request.id);
    const link = escapeHtml(activationUrl.toString());

    return {
      subject: "Tu solicitud fue aprobada — Academia DECOM",
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#102D4D">
        <div style="background:#102D4D;padding:28px;border-radius:16px 16px 0 0;color:white">
          <p style="margin:0;color:#55D1C4;font-size:12px;letter-spacing:2px;font-weight:bold">ACADEMIA DECOM</p>
          <h1 style="margin:14px 0 0;font-size:24px">¡Tu solicitud fue aprobada!</h1>
        </div>
        <div style="padding:28px;border:1px solid #e2e8f0;border-top:0;border-radius:0 0 16px 16px">
          <p>Hola, <strong>${name}</strong>.</p>
          <p>La administración aprobó tu solicitud de vinculación. Para continuar, crea tu cuenta con este mismo correo o inicia sesión si ya tienes una.</p>
          <p style="margin:28px 0">
            <a href="${link}" style="display:inline-block;background:#087DB5;color:white;text-decoration:none;padding:14px 22px;border-radius:10px;font-weight:bold">Activar mi cuenta</a>
          </p>
          <p style="font-size:13px;color:#64748b">El enlace te llevará al proceso de activación. La cuenta se habilitará después de verificar tu correo y completar el proceso.</p>
          <p style="font-size:12px;color:#64748b;word-break:break-all">Si el botón no funciona, copia este enlace: ${link}</p>
        </div>
      </div>`,
    };
  }

  const note = request.decision_note?.trim();
  return {
    subject: "Actualización de tu solicitud — Academia DECOM",
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#102D4D">
      <div style="background:#102D4D;padding:28px;border-radius:16px 16px 0 0;color:white">
        <p style="margin:0;color:#55D1C4;font-size:12px;letter-spacing:2px;font-weight:bold">ACADEMIA DECOM</p>
        <h1 style="margin:14px 0 0;font-size:24px">Actualización de solicitud</h1>
      </div>
      <div style="padding:28px;border:1px solid #e2e8f0;border-top:0;border-radius:0 0 16px 16px">
        <p>Hola, <strong>${name}</strong>.</p>
        <p>Después de revisar tu solicitud, la administración no pudo aprobarla en esta ocasión.</p>
        ${note ? `<div style="background:#f8fafc;border-left:4px solid #087DB5;padding:14px;margin:20px 0"><strong>Observación:</strong><p style="margin:8px 0 0;white-space:pre-wrap">${escapeHtml(note)}</p></div>` : ""}
        <p>Si necesitas aclarar la decisión, comunícate con la administración de tu distrito.</p>
      </div>
    </div>`,
  };
}

async function processNotifications(request: NextRequest) {
  if (!authorized(request)) {
    return response({ error: "No autorizado." }, 401);
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  const appUrl = process.env.APP_URL;

  if (!apiKey || !from || !appUrl) {
    return response(
      { error: "Falta configurar RESEND_API_KEY, RESEND_FROM_EMAIL o APP_URL." },
      503
    );
  }

  let parsedAppUrl: URL;
  try {
    parsedAppUrl = new URL(appUrl);
    if (parsedAppUrl.protocol !== "https:" && parsedAppUrl.hostname !== "localhost") {
      return response({ error: "APP_URL debe utilizar HTTPS." }, 503);
    }
  } catch {
    return response({ error: "APP_URL no es una URL válida." }, 503);
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc(
    "claim_invitation_notifications",
    { p_batch_size: 10 }
  );

  if (error) {
    return response({ error: "No fue posible reclamar las notificaciones pendientes." }, 503);
  }

  const claimed = (data ?? []) as ClaimedNotification[];
  const results: Array<{ id: string; status: "sent" | "failed" }> = [];

  for (const notification of claimed) {
    try {
      const { data: requestRecord, error: requestError } = await supabase
        .from("invitation_requests")
        .select("id, full_name, email, status, decision_note")
        .eq("id", notification.invitation_request_id)
        .maybeSingle();

      if (requestError || !requestRecord) {
        throw new Error("No se encontró la solicitud asociada a la notificación.");
      }

      const record = requestRecord as RequestRecord;
      if (
        !isNotificationStateCompatible(
          notification.notification_type,
          record.status
        )
      ) {
        throw new Error("El estado de la solicitud no coincide con la notificación.");
      }

      if (record.email.toLowerCase() !== notification.recipient_email.toLowerCase()) {
        throw new Error("El destinatario no coincide con el correo de la solicitud.");
      }

      const email = buildEmail(notification, record, parsedAppUrl.toString());
      const resendResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `academia-decom/invitation-notification/${notification.notification_id}`,
        },
        body: JSON.stringify({
          from,
          to: [notification.recipient_email],
          subject: email.subject,
          html: email.html,
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      });

      const resendBody = (await resendResponse.json().catch(() => ({}))) as {
        id?: string;
        message?: string;
        name?: string;
      };

      if (!resendResponse.ok || !resendBody.id) {
        throw new Error(
          `Resend rechazó el envío (${resendResponse.status}): ${resendBody.message ?? resendBody.name ?? "error del proveedor"}`
        );
      }

      const { error: updateError } = await supabase
        .from("invitation_notifications")
        .update({
          status: "sent",
          provider_message_id: resendBody.id,
          sent_at: new Date().toISOString(),
          processing_started_at: null,
          error_message: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", notification.notification_id)
        .eq("status", "processing");

      if (updateError) {
        // El proveedor ya aceptó el correo. Dejar que la recuperación de
        // procesos atascados vuelva a reclamarlo usando la misma clave idempotente.
        throw new Error("El correo fue aceptado, pero no se pudo actualizar la cola.");
      }

      results.push({ id: notification.notification_id, status: "sent" });
    } catch (error) {
      const message =
        error instanceof Error ? error.message.slice(0, 900) : "Error desconocido";
      const delayMinutes = Math.min(
        60 * 24,
        5 * 2 ** Math.max(0, notification.attempt_number - 1)
      );

      await supabase
        .from("invitation_notifications")
        .update({
          status: "failed",
          error_message: message,
          next_attempt_at: new Date(Date.now() + delayMinutes * 60_000).toISOString(),
          processing_started_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", notification.notification_id)
        .eq("status", "processing");

      results.push({ id: notification.notification_id, status: "failed" });
    }
  }

  return response({
    claimed: claimed.length,
    sent: results.filter((item) => item.status === "sent").length,
    failed: results.filter((item) => item.status === "failed").length,
    results,
  });
}

export async function GET(request: NextRequest) {
  return processNotifications(request);
}

export async function POST(request: NextRequest) {
  return processNotifications(request);
}
