"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  buildInvitationLink,
  buildInvitationMessage,
  buildWhatsappShareUrl,
  isTemporaryDeploymentUrl,
  normalizeSiteUrl,
} from "@/lib/invitations/link.mjs";

type District = { id: string; name: string };
type Invitation = {
  id: string;
  district_id: string;
  invitation_type: "guest" | "decom_member" | "legacy" | "national_admin";
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

type InvitationRequest = {
  request_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  date_of_birth: string | null;
  request_status: "pending" | "approved" | "rejected";
  decision_note: string | null;
  requested_at: string;
  reviewed_at: string | null;
  invitation_type: string;
  district_name: string | null;
  congregation_name: string | null;
  requested_role_name: string | null;
};

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function invitationStatus(invitation: Invitation) {
  if (invitation.revoked_at) return "Revocada";
  if (invitation.accepted_at) return "Utilizada";
  if (new Date(invitation.expires_at).getTime() <= Date.now()) return "Vencida";
  return "Pendiente de uso";
}

// El origen del navegador no cambia durante la sesión: no hay nada que escuchar.
const subscribeNoop = () => () => {};

export default function InvitationsPage() {
  const router = useRouter();
  // Origen actual del navegador (vacío en el servidor); solo se usa si no hay NEXT_PUBLIC_SITE_URL.
  const currentOrigin = useSyncExternalStore(
    subscribeNoop,
    () => window.location.origin,
    () => "",
  );
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState("");
  const [memberRoleId, setMemberRoleId] = useState("");
  const [districts, setDistricts] = useState<District[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [requests, setRequests] = useState<InvitationRequest[]>([]);
  const [requestFilter, setRequestFilter] = useState<"pending" | "approved" | "rejected" | "all">(
    "pending",
  );
  const [decisionNotes, setDecisionNotes] = useState<Record<string, string>>({});
  const [reviewingRequestId, setReviewingRequestId] = useState<string | null>(null);
  const [requestMessage, setRequestMessage] = useState("");
  const [requestError, setRequestError] = useState("");
  const [districtNames, setDistrictNames] = useState<Record<string, string>>({});
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [invitationType, setInvitationType] = useState<"guest" | "decom_member">("guest");
  const [validityDays, setValidityDays] = useState("14");
  const [createdLink, setCreatedLink] = useState("");
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const loadData = useCallback(async () => {
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      setErrorMessage("");
      if (authError || !authData.user) {
        router.replace("/");
        return;
      }
      setUserId(authData.user.id);

      const { data: assignments, error: assignmentsError } = await supabase
        .from("user_role_assignments")
        .select("role_id, district_id")
        .eq("user_id", authData.user.id);

      if (assignmentsError) throw assignmentsError;

      const roleIds = [...new Set((assignments ?? []).map((item) => item.role_id))];
      const { data: roles, error: rolesError } = await supabase
        .from("roles")
        .select("id, role_key")
        .in("id", roleIds);

      if (rolesError) throw rolesError;

      const roleKeys = new Set((roles ?? []).map((role) => role.role_key));
      const isNationalAdmin = roleKeys.has("national_admin");
      const canManageDistrictInvitations =
        roleKeys.has("district_coordinator") || roleKeys.has("area_coordinator");

      if (!isNationalAdmin && !canManageDistrictInvitations) {
        router.replace("/acceso-denegado");
        return;
      }

      const memberRole = (roles ?? []).find((role) => role.role_key === "member");
      let baseMemberRoleId = memberRole?.id ?? "";

      if (!baseMemberRoleId) {
        const { data: memberRoleRow, error: memberRoleError } = await supabase
          .from("roles")
          .select("id")
          .eq("role_key", "member")
          .single();
        if (memberRoleError) throw memberRoleError;
        baseMemberRoleId = memberRoleRow.id;
      }
      setMemberRoleId(baseMemberRoleId);

      const { data: districtRows, error: districtError } = await supabase
        .from("districts")
        .select("id, name")
        .eq("status", "active")
        .order("name", { ascending: true });

      if (districtError) throw districtError;

      const manageableIds = new Set(
        (assignments ?? [])
          .filter((assignment) => {
            const assignedRole = (roles ?? []).find(
              (role) => role.id === assignment.role_id,
            )?.role_key;
            return (
              assignment.district_id &&
              ["district_coordinator", "area_coordinator"].includes(assignedRole ?? "")
            );
          })
          .map((assignment) => assignment.district_id as string),
      );

      const visibleDistricts = isNationalAdmin
        ? (districtRows ?? [])
        : (districtRows ?? []).filter((district) => manageableIds.has(district.id));

      setDistricts(visibleDistricts);
      setDistrictNames(
        Object.fromEntries((districtRows ?? []).map((district) => [district.id, district.name])),
      );
      setSelectedDistrict((current) =>
        visibleDistricts.some((district) => district.id === current)
          ? current
          : (visibleDistricts[0]?.id ?? ""),
      );

      const { data: invitationRows, error: invitationError } = await supabase
        .from("invitations")
        .select("id, district_id, invitation_type, expires_at, accepted_at, revoked_at, created_at")
        .order("created_at", { ascending: false })
        .limit(100);

      if (invitationError) throw invitationError;
      setInvitations((invitationRows ?? []) as Invitation[]);

      const { data: requestRows, error: requestsError } = await supabase.rpc(
        "get_invitation_requests",
        { p_status: requestFilter === "all" ? undefined : requestFilter },
      );
      if (requestsError) throw requestsError;
      setRequests((requestRows ?? []) as InvitationRequest[]);
    } catch (error) {
      console.error("Error cargando invitaciones:", error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No fue posible cargar la administración de invitaciones.",
      );
    } finally {
      setLoading(false);
    }
  }, [router, supabase, requestFilter]);

  useEffect(() => {
    // loadData first awaits Supabase authentication before updating React state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [loadData]);

  const publicSiteUrl = normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL) || currentOrigin;
  const usingTemporaryAddress = isTemporaryDeploymentUrl(publicSiteUrl);
  const districtName = districts.find((district) => district.id === selectedDistrict)?.name;
  const shareMessage = createdLink ? buildInvitationMessage(createdLink, districtName) : "";

  async function createInvitation() {
    if (!userId || !memberRoleId || !selectedDistrict || saving) return;

    setSaving(true);
    setMessage("");
    setErrorMessage("");
    setCreatedLink("");

    try {
      const token = randomToken();
      const tokenHash = await sha256(token);
      const expiresAt = new Date(
        Date.now() + Number(validityDays) * 24 * 60 * 60 * 1000,
      ).toISOString();

      const { error } = await supabase.from("invitations").insert({
        district_id: selectedDistrict,
        invitation_type: invitationType,
        role_id: memberRoleId,
        token_hash: tokenHash,
        expires_at: expiresAt,
        invited_by: userId,
      });

      if (error) throw error;

      // Dirección estable (NEXT_PUBLIC_SITE_URL) para que el enlace no dependa del despliegue actual.
      setCreatedLink(buildInvitationLink(token, publicSiteUrl));
      setMessage(
        "Invitación creada. Copia el enlace y compártelo; el token no volverá a mostrarse.",
      );
      await loadData();
    } catch (error) {
      console.error("Error creando invitación:", error);
      setErrorMessage(
        error instanceof Error ? error.message : "No fue posible crear la invitación.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function revokeInvitation(invitation: Invitation) {
    if (
      invitation.revoked_at ||
      invitation.accepted_at ||
      !window.confirm("¿Deseas revocar esta invitación? El enlace dejará de funcionar.")
    ) {
      return;
    }

    setErrorMessage("");
    setMessage("");

    const { error } = await supabase
      .from("invitations")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", invitation.id)
      .is("revoked_at", null);

    if (error) {
      setErrorMessage("No fue posible revocar la invitación. Verifica tus permisos.");
      return;
    }

    setMessage("La invitación fue revocada.");
    await loadData();
  }

  async function reviewRequest(request: InvitationRequest, decision: "approved" | "rejected") {
    if (reviewingRequestId) return;

    const actionLabel = decision === "approved" ? "aprobar" : "rechazar";
    if (!window.confirm(`¿Confirmas ${actionLabel} la solicitud de ${request.full_name}?`)) {
      return;
    }

    setReviewingRequestId(request.request_id);
    setRequestMessage("");
    setRequestError("");

    try {
      const { error } = await supabase.rpc("review_invitation_request", {
        p_request_id: request.request_id,
        p_decision: decision,
        p_decision_note: decisionNotes[request.request_id]?.trim() || undefined,
      });
      if (error) throw error;

      setRequestMessage(
        decision === "approved"
          ? "Solicitud aprobada. Se registró el correo de activación en la cola de notificaciones."
          : "Solicitud rechazada. Se registró el correo de notificación.",
      );
      setDecisionNotes((current) => {
        const next = { ...current };
        delete next[request.request_id];
        return next;
      });
      await loadData();
    } catch (error) {
      console.error("Error revisando solicitud:", error);
      setRequestError(
        error instanceof Error ? error.message : "No fue posible registrar la decisión.",
      );
    } finally {
      setReviewingRequestId(null);
    }
  }

  async function copyMessage() {
    if (!shareMessage) return;
    try {
      await navigator.clipboard.writeText(shareMessage);
      setMessage("Mensaje copiado. Pégalo en WhatsApp, correo o donde prefieras.");
    } catch {
      setErrorMessage(
        "No se pudo copiar automáticamente. Selecciona y copia el mensaje manualmente.",
      );
    }
  }

  async function copyLink() {
    if (!createdLink) return;
    try {
      await navigator.clipboard.writeText(createdLink);
      setMessage("Enlace copiado al portapapeles.");
    } catch {
      setErrorMessage(
        "No se pudo copiar automáticamente. Selecciona y copia el enlace manualmente.",
      );
    }
  }

  if (loading) {
    return (
      <main
        id="contenido"
        className="flex min-h-screen items-center justify-center bg-background p-6 text-sm text-muted-fg"
      >
        Cargando administración de invitaciones...
      </main>
    );
  }

  return (
    <main id="contenido" className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-6">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="mt-2 text-2xl font-bold sm:text-3xl">Administración de invitaciones</h1>
            <p className="mt-2 text-sm text-muted-fg">
              Genera enlaces de ingreso y controla su vigencia y utilización.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-semibold text-decom-blue-text"
          >
            Volver al panel
          </Link>
        </header>

        <section className="rounded-2xl border border-line bg-surface p-6 shadow-sm sm:p-8">
          <h2 className="text-lg font-bold">Crear enlace de invitación</h2>
          <p className="mt-1 text-sm text-muted-fg">
            El enlace permite solicitar el ingreso. No concede acceso automáticamente: la
            administración debe aprobar la solicitud.
          </p>

          {districts.length === 0 ? (
            <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              No tienes un distrito activo asignado para generar invitaciones.
            </div>
          ) : (
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <label className="text-sm font-semibold">
                Distrito
                <select
                  value={selectedDistrict}
                  onChange={(event) => setSelectedDistrict(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-line bg-surface px-4 py-3 font-normal"
                >
                  {districts.map((district) => (
                    <option key={district.id} value={district.id}>
                      {district.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm font-semibold">
                Tipo de invitación
                <select
                  value={invitationType}
                  onChange={(event) =>
                    setInvitationType(event.target.value as "guest" | "decom_member")
                  }
                  className="mt-2 w-full rounded-xl border border-line bg-surface px-4 py-3 font-normal"
                >
                  <option value="guest">Invitado</option>
                  <option value="decom_member">Miembro de DECOM</option>
                </select>
              </label>

              <label className="text-sm font-semibold">
                Vigencia
                <select
                  value={validityDays}
                  onChange={(event) => setValidityDays(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-line bg-surface px-4 py-3 font-normal"
                >
                  <option value="7">7 días</option>
                  <option value="14">14 días</option>
                  <option value="30">30 días</option>
                </select>
              </label>

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={createInvitation}
                  disabled={saving || !selectedDistrict || !memberRoleId}
                  className="w-full rounded-xl bg-decom-blue px-5 py-3 text-sm font-bold text-white hover:bg-decom-blue-hover disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? "Generando enlace..." : "Generar invitación"}
                </button>
              </div>
            </div>
          )}

          {createdLink ? (
            <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-5">
              <p className="text-sm font-bold text-emerald-900">Enlace generado</p>
              <p className="mt-2 break-all rounded-lg bg-surface p-3 text-sm text-foreground">
                {createdLink}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={copyLink}
                  className="rounded-lg bg-decom-blue px-4 py-2.5 text-sm font-semibold text-white hover:bg-decom-blue-hover"
                >
                  Copiar enlace
                </button>
                <button
                  type="button"
                  onClick={copyMessage}
                  className="rounded-lg border border-line bg-surface px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-surface-muted"
                >
                  Copiar mensaje
                </button>
                <a
                  href={buildWhatsappShareUrl(shareMessage)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center rounded-lg border border-line bg-surface px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-surface-muted"
                >
                  Compartir por WhatsApp
                </a>
              </div>
              {usingTemporaryAddress ? (
                <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
                  Este enlace usa una dirección temporal de vista previa y dejará de servir cuando
                  cambie el despliegue. Configura <strong>NEXT_PUBLIC_SITE_URL</strong> con el
                  dominio definitivo antes de enviar invitaciones reales.
                </p>
              ) : null}
              <p className="mt-3 text-xs leading-5 text-emerald-800">
                Guarda y comparte este enlace ahora. Por seguridad, la plataforma almacena
                únicamente su huella criptográfica y no puede volver a mostrar el token.
              </p>
            </div>
          ) : null}

          {message ? (
            <p
              role="status"
              className="mt-5 rounded-xl bg-surface-muted p-4 text-sm text-foreground"
            >
              {message}
            </p>
          ) : null}
          {errorMessage ? (
            <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">
              {errorMessage}
            </p>
          ) : null}
        </section>

        <section className="mt-8 overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
          <div className="border-b border-line-soft px-6 py-5 sm:px-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">Invitaciones registradas</h2>
                <p className="mt-1 text-sm text-muted-fg">
                  Se muestran hasta las 100 invitaciones más recientes dentro de tu ámbito.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void loadData()}
                className="rounded-lg border border-line px-3 py-2 text-sm font-semibold text-decom-blue-text"
              >
                Actualizar
              </button>
            </div>
          </div>

          {invitations.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-muted-fg">
              Todavía no hay invitaciones registradas.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-surface-muted text-xs uppercase tracking-wide text-muted-fg">
                  <tr>
                    <th className="px-6 py-4">Distrito</th>
                    <th className="px-6 py-4">Tipo</th>
                    <th className="px-6 py-4">Creación</th>
                    <th className="px-6 py-4">Vencimiento</th>
                    <th className="px-6 py-4">Estado</th>
                    <th className="px-6 py-4">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {invitations.map((invitation) => {
                    const status = invitationStatus(invitation);
                    const canRevoke = status === "Pendiente de uso";
                    return (
                      <tr key={invitation.id} className="border-t border-line-soft">
                        <td className="px-6 py-4 font-medium">
                          {districtNames[invitation.district_id] ?? "Distrito"}
                        </td>
                        <td className="px-6 py-4">
                          {invitation.invitation_type === "decom_member"
                            ? "Miembro DECOM"
                            : invitation.invitation_type === "guest"
                              ? "Invitado"
                              : "Legada"}
                        </td>
                        <td className="px-6 py-4 text-muted-fg">
                          {new Date(invitation.created_at).toLocaleDateString("es-CO")}
                        </td>
                        <td className="px-6 py-4 text-muted-fg">
                          {new Date(invitation.expires_at).toLocaleDateString("es-CO")}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${status === "Pendiente de uso" ? "bg-blue-50 text-decom-blue-text" : status === "Utilizada" ? "bg-emerald-50 text-emerald-700" : "bg-surface-muted text-muted-fg"}`}
                          >
                            {status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {canRevoke ? (
                            <button
                              type="button"
                              onClick={() => void revokeInvitation(invitation)}
                              className="text-xs font-semibold text-red-600 hover:underline"
                            >
                              Revocar
                            </button>
                          ) : (
                            <span className="text-xs text-muted-fg">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="mt-8 rounded-2xl border border-line bg-surface p-6 shadow-sm sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold">Solicitudes de ingreso</h2>
              <p className="mt-1 text-sm text-muted-fg">
                Revisa los datos enviados y aprueba o rechaza las solicitudes de tu ámbito.
              </p>
            </div>
            <select
              value={requestFilter}
              onChange={(event) =>
                setRequestFilter(event.target.value as "pending" | "approved" | "rejected" | "all")
              }
              className="rounded-xl border border-line bg-surface px-4 py-2.5 text-sm"
              aria-label="Filtrar solicitudes"
            >
              <option value="pending">Pendientes</option>
              <option value="approved">Aprobadas</option>
              <option value="rejected">Rechazadas</option>
              <option value="all">Todas</option>
            </select>
          </div>

          {requestMessage ? (
            <p role="status" className="mt-5 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">
              {requestMessage}
            </p>
          ) : null}
          {requestError ? (
            <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">
              {requestError}
            </p>
          ) : null}

          {requests.length === 0 ? (
            <p className="mt-6 rounded-xl border border-dashed border-line px-5 py-10 text-center text-sm text-muted-fg">
              {requestFilter === "pending"
                ? "No hay solicitudes pendientes de revisión."
                : "No hay solicitudes para este filtro."}
            </p>
          ) : (
            <div className="mt-6 space-y-4">
              {requests.map((request) => (
                <article key={request.request_id} className="rounded-xl border border-line p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-bold">{request.full_name}</h3>
                      <p className="mt-1 text-sm text-muted-fg">{request.email}</p>
                      <p className="text-sm text-muted-fg">
                        WhatsApp: {request.phone || "No registrado"}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        request.request_status === "pending"
                          ? "bg-amber-50 text-amber-800"
                          : request.request_status === "approved"
                            ? "bg-emerald-50 text-emerald-800"
                            : "bg-red-50 text-red-700"
                      }`}
                    >
                      {request.request_status === "pending"
                        ? "Pendiente"
                        : request.request_status === "approved"
                          ? "Aprobada"
                          : "Rechazada"}
                    </span>
                  </div>

                  <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-fg">
                        Distrito
                      </dt>
                      <dd className="mt-1">{request.district_name || "No especificado"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-fg">
                        Congregación
                      </dt>
                      <dd className="mt-1">{request.congregation_name || "No especificada"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-fg">
                        Tipo
                      </dt>
                      <dd className="mt-1">
                        {request.invitation_type === "decom_member" ? "Miembro DECOM" : "Invitado"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-fg">
                        Rol solicitado
                      </dt>
                      <dd className="mt-1">{request.requested_role_name || "Integrante"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-fg">
                        Fecha de nacimiento
                      </dt>
                      <dd className="mt-1">{request.date_of_birth || "No registrada"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-fg">
                        Solicitud recibida
                      </dt>
                      <dd className="mt-1">
                        {new Date(request.requested_at).toLocaleString("es-CO", {
                          timeZone: "America/Bogota",
                        })}
                      </dd>
                    </div>
                  </dl>

                  {request.decision_note ? (
                    <p className="mt-4 rounded-lg bg-surface-muted p-3 text-sm text-muted-fg">
                      Observación registrada: {request.decision_note}
                    </p>
                  ) : null}

                  {request.request_status === "pending" ? (
                    <div className="mt-5 border-t border-line-soft pt-4">
                      <label className="block text-sm font-semibold">
                        Observación (opcional; se incluirá en el correo de decisión)
                        <textarea
                          value={decisionNotes[request.request_id] ?? ""}
                          onChange={(event) =>
                            setDecisionNotes((current) => ({
                              ...current,
                              [request.request_id]: event.target.value,
                            }))
                          }
                          maxLength={1000}
                          rows={2}
                          className="mt-2 w-full rounded-xl border border-line px-4 py-3 text-sm font-normal outline-none focus:border-decom-blue"
                          placeholder="Escribe una observación si es necesaria."
                        />
                      </label>
                      <div className="mt-4 flex flex-wrap justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => void reviewRequest(request, "rejected")}
                          disabled={reviewingRequestId !== null}
                          className="rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                        >
                          {reviewingRequestId === request.request_id ? "Procesando..." : "Rechazar"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void reviewRequest(request, "approved")}
                          disabled={reviewingRequestId !== null}
                          className="rounded-xl bg-decom-blue px-4 py-2.5 text-sm font-semibold text-white hover:bg-decom-blue-hover disabled:opacity-50"
                        >
                          {reviewingRequestId === request.request_id ? "Procesando..." : "Aprobar"}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </section>

        <p className="mt-6 text-xs leading-5 text-muted-fg">
          Los enlaces nuevos se generan para el distrito seleccionado. La congregación la elige la
          persona durante su solicitud y cualquier rol institucional queda sujeto a aprobación.
        </p>
      </div>
    </main>
  );
}
