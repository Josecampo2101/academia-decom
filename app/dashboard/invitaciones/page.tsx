"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value)
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

function invitationStatus(invitation: Invitation) {
  if (invitation.revoked_at) return "Revocada";
  if (invitation.accepted_at) return "Utilizada";
  if (new Date(invitation.expires_at).getTime() <= Date.now()) return "Vencida";
  return "Pendiente de uso";
}

export default function InvitationsPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState("");
  const [memberRoleId, setMemberRoleId] = useState("");
  const [districts, setDistricts] = useState<District[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [districtNames, setDistrictNames] = useState<Record<string, string>>({});
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [invitationType, setInvitationType] = useState<"guest" | "decom_member">("guest");
  const [validityDays, setValidityDays] = useState("14");
  const [createdLink, setCreatedLink] = useState("");
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
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
              (role) => role.id === assignment.role_id
            )?.role_key;
            return (
              assignment.district_id &&
              ["district_coordinator", "area_coordinator"].includes(assignedRole ?? "")
            );
          })
          .map((assignment) => assignment.district_id as string)
      );

      const visibleDistricts = isNationalAdmin
        ? districtRows ?? []
        : (districtRows ?? []).filter((district) => manageableIds.has(district.id));

      setDistricts(visibleDistricts);
      setDistrictNames(
        Object.fromEntries((districtRows ?? []).map((district) => [district.id, district.name]))
      );
      setSelectedDistrict((current) =>
        visibleDistricts.some((district) => district.id === current)
          ? current
          : visibleDistricts[0]?.id ?? ""
      );

      const { data: invitationRows, error: invitationError } = await supabase
        .from("invitations")
        .select("id, district_id, invitation_type, expires_at, accepted_at, revoked_at, created_at")
        .order("created_at", { ascending: false })
        .limit(100);

      if (invitationError) throw invitationError;
      setInvitations((invitationRows ?? []) as Invitation[]);
    } catch (error) {
      console.error("Error cargando invitaciones:", error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No fue posible cargar la administración de invitaciones."
      );
    } finally {
      setLoading(false);
    }
  }, [router, supabase]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

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
        Date.now() + Number(validityDays) * 24 * 60 * 60 * 1000
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

      const link = new URL("/solicitud-invitacion", window.location.origin);
      link.searchParams.set("token", token);
      setCreatedLink(link.toString());
      setMessage("Invitación creada. Copia el enlace y compártelo; el token no volverá a mostrarse.");
      await loadData();
    } catch (error) {
      console.error("Error creando invitación:", error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No fue posible crear la invitación."
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

  async function copyLink() {
    if (!createdLink) return;
    try {
      await navigator.clipboard.writeText(createdLink);
      setMessage("Enlace copiado al portapapeles.");
    } catch {
      setErrorMessage("No se pudo copiar automáticamente. Selecciona y copia el enlace manualmente.");
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F4F7FA] p-6 text-sm text-slate-500">
        Cargando administración de invitaciones...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F4F7FA] px-4 py-8 text-[#102D4D] sm:px-6">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold tracking-[0.18em] text-[#087DB5]">ACADEMIA DECOM</p>
            <h1 className="mt-2 text-2xl font-bold sm:text-3xl">Administración de invitaciones</h1>
            <p className="mt-2 text-sm text-slate-500">
              Genera enlaces de ingreso y controla su vigencia y utilización.
            </p>
          </div>
          <a href="/dashboard" className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-[#087DB5]">
            Volver al panel
          </a>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h2 className="text-lg font-bold">Crear enlace de invitación</h2>
          <p className="mt-1 text-sm text-slate-500">
            El enlace permite solicitar el ingreso. No concede acceso automáticamente: la administración debe aprobar la solicitud.
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
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-normal"
                >
                  {districts.map((district) => (
                    <option key={district.id} value={district.id}>{district.name}</option>
                  ))}
                </select>
              </label>

              <label className="text-sm font-semibold">
                Tipo de invitación
                <select
                  value={invitationType}
                  onChange={(event) => setInvitationType(event.target.value as "guest" | "decom_member")}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-normal"
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
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-normal"
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
                  className="w-full rounded-xl bg-[#087DB5] px-5 py-3 text-sm font-bold text-white hover:bg-[#066a9b] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? "Generando enlace..." : "Generar invitación"}
                </button>
              </div>
            </div>
          )}

          {createdLink ? (
            <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-5">
              <p className="text-sm font-bold text-emerald-900">Enlace generado</p>
              <p className="mt-2 break-all rounded-lg bg-white p-3 text-sm text-slate-700">{createdLink}</p>
              <button
                type="button"
                onClick={copyLink}
                className="mt-3 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800"
              >
                Copiar enlace
              </button>
              <p className="mt-3 text-xs leading-5 text-emerald-800">
                Guarda y comparte este enlace ahora. Por seguridad, la plataforma almacena únicamente su huella criptográfica y no puede volver a mostrar el token.
              </p>
            </div>
          ) : null}

          {message ? <p role="status" className="mt-5 rounded-xl bg-slate-100 p-4 text-sm text-slate-700">{message}</p> : null}
          {errorMessage ? <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">{errorMessage}</p> : null}
        </section>

        <section className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-6 py-5 sm:px-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">Invitaciones registradas</h2>
                <p className="mt-1 text-sm text-slate-500">Se muestran hasta las 100 invitaciones más recientes dentro de tu ámbito.</p>
              </div>
              <button type="button" onClick={() => void loadData()} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-[#087DB5]">
                Actualizar
              </button>
            </div>
          </div>

          {invitations.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-slate-500">Todavía no hay invitaciones registradas.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
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
                      <tr key={invitation.id} className="border-t border-slate-100">
                        <td className="px-6 py-4 font-medium">{districtNames[invitation.district_id] ?? "Distrito"}</td>
                        <td className="px-6 py-4">{invitation.invitation_type === "decom_member" ? "Miembro DECOM" : invitation.invitation_type === "guest" ? "Invitado" : "Legada"}</td>
                        <td className="px-6 py-4 text-slate-600">{new Date(invitation.created_at).toLocaleDateString("es-CO")}</td>
                        <td className="px-6 py-4 text-slate-600">{new Date(invitation.expires_at).toLocaleDateString("es-CO")}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${status === "Pendiente de uso" ? "bg-blue-50 text-blue-700" : status === "Utilizada" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                            {status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {canRevoke ? (
                            <button type="button" onClick={() => void revokeInvitation(invitation)} className="text-xs font-semibold text-red-600 hover:underline">
                              Revocar
                            </button>
                          ) : <span className="text-xs text-slate-400">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <p className="mt-6 text-xs leading-5 text-slate-500">
          Los enlaces nuevos se generan para el distrito seleccionado. La congregación la elige la persona durante su solicitud y cualquier rol institucional queda sujeto a aprobación.
        </p>
      </div>
    </main>
  );
}
