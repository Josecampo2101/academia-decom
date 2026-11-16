"use client";

import Script from "next/script";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

type InvitationType = "guest" | "decom_member";
type Option = { id: string; name: string };
type InvitationInfo = {
  valid: true;
  invitationType: InvitationType;
  districtName: string;
  congregations: Option[];
  roles: Option[];
};

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          action: string;
          callback: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
          theme?: "light" | "dark" | "auto";
        }
      ) => string;
      reset: (widgetId?: string) => void;
      remove?: (widgetId: string) => void;
    };
  }
}

const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

export default function InvitationApplicationForm({ token }: { token: string }) {
  const captchaContainer = useRef<HTMLDivElement>(null);
  const captchaWidgetId = useRef<string | null>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const [invitation, setInvitation] = useState<InvitationInfo | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [congregationId, setCongregationId] = useState("");
  const [requestedRoleId, setRequestedRoleId] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [message, setMessage] = useState("");

  const resetCaptcha = useCallback(() => {
    setCaptchaToken("");
    if (captchaWidgetId.current) {
      window.turnstile?.reset(captchaWidgetId.current);
    }
  }, []);

  useEffect(() => {
    if (!scriptReady || !siteKey || !captchaContainer.current || !window.turnstile) {
      return;
    }

    const widgetId = window.turnstile.render(captchaContainer.current, {
      sitekey: siteKey,
      action: "invitation_application",
      theme: "light",
      callback: (value) => setCaptchaToken(value),
      "expired-callback": () => setCaptchaToken(""),
      "error-callback": () => {
        setCaptchaToken("");
        setMessage("No fue posible completar la verificación de seguridad.");
      },
    });

    captchaWidgetId.current = widgetId;

    return () => {
      if (captchaWidgetId.current) {
        window.turnstile?.remove?.(captchaWidgetId.current);
        captchaWidgetId.current = null;
      }
    };
  }, [scriptReady]);

  async function sendRequest(payload: Record<string, unknown>) {
    const response = await fetch("/api/invitations/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify(payload),
    });

    const result = (await response.json()) as {
      error?: string;
      message?: string;
      valid?: boolean;
      success?: boolean;
      invitationType?: InvitationType;
      districtName?: string;
      congregations?: Option[];
      roles?: Option[];
    };

    if (!response.ok) {
      throw new Error(result.error ?? "No fue posible completar la operación.");
    }

    return result;
  }

  async function validateInvitation() {
    if (!token || !captchaToken || loading) return;
    setLoading(true);
    setMessage("");

    try {
      const result = await sendRequest({
        action: "validate",
        token,
        captchaToken,
      });

      if (
        result.valid &&
        result.invitationType &&
        result.districtName &&
        result.congregations
      ) {
        setInvitation({
          valid: true,
          invitationType: result.invitationType,
          districtName: result.districtName,
          congregations: result.congregations,
          roles: result.roles ?? [],
        });
        setMessage(
          result.congregations.length
            ? "Enlace válido. Completa tus datos para enviar la solicitud."
            : "El enlace es válido, pero el distrito todavía no tiene congregaciones activas."
        );
      }
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "No fue posible validar el enlace."
      );
    } finally {
      setLoading(false);
      resetCaptcha();
    }
  }

  async function submitApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !captchaToken || !invitation || loading) return;

    setLoading(true);
    setMessage("");

    try {
      const result = await sendRequest({
        action: "submit",
        token,
        captchaToken,
        fullName,
        email,
        phone,
        dateOfBirth,
        congregationId,
        requestedRoleId:
          invitation.invitationType === "decom_member" ? requestedRoleId : null,
      });

      if (result.success) {
        setSuccess(true);
        setMessage(
          result.message ??
            "Tu solicitud fue recibida y está pendiente de aprobación."
        );
      }
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "No fue posible enviar la solicitud."
      );
    } finally {
      setLoading(false);
      resetCaptcha();
    }
  }

  const canValidate = Boolean(token && captchaToken && !loading);
  const canSubmit =
    Boolean(
      captchaToken &&
        fullName.trim() &&
        email.trim() &&
        phone.trim() &&
        dateOfBirth &&
        congregationId &&
        !loading
    ) &&
    (invitation?.invitationType !== "decom_member" || Boolean(requestedRoleId));

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-6">
      {siteKey ? (
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
          strategy="afterInteractive"
          onLoad={() => setScriptReady(true)}
        />
      ) : null}

      <div className="mx-auto max-w-3xl">
        <header className="mb-8 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-decom-blue text-xl font-bold text-white">
            D
          </div>
          <div>
            <p className="text-sm font-extrabold tracking-[0.14em]">ACADEMIA DECOM</p>
            <p className="text-xs text-muted-fg">Solicitud de vinculación</p>
          </div>
        </header>

        <section className="overflow-hidden rounded-3xl border border-line bg-surface shadow-sm">
          <div className="bg-decom-navy px-6 py-8 text-white sm:px-9">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-decom-teal-light">
              Formación para comunicar con propósito
            </p>
            <h1 className="mt-3 text-2xl font-bold sm:text-3xl">
              Solicitud de ingreso
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-blue-100">
              Completa tus datos para solicitar tu vinculación. Toda solicitud
              debe ser revisada y aprobada por la administración antes de activar
              el acceso a la plataforma.
            </p>
          </div>

          <div className="space-y-6 p-6 sm:p-9">
            {token && siteKey && !success ? (
              <div className="rounded-xl border border-line bg-surface-muted p-4">
                <p className="text-sm font-bold">Verificación de seguridad</p>
                <div ref={captchaContainer} className="mt-3 min-h-[66px]" />
              </div>
            ) : null}

            {!token ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900">
                Falta el enlace de invitación. Abre la dirección completa que
                recibiste para continuar con el registro.
              </div>
            ) : null}

            {!siteKey ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900">
                El formulario está preparado, pero todavía no se ha configurado
                la verificación de seguridad. El envío permanecerá bloqueado
                hasta configurar Turnstile en el entorno de despliegue.
              </div>
            ) : null}

            {token && siteKey && !invitation && !success ? (
              <div className="space-y-4">
                <div>
                  <h2 className="font-bold">Verifica tu invitación</h2>
                  <p className="mt-1 text-sm text-muted-fg">
                    Confirma que eres una persona y valida que el enlace siga vigente.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={!canValidate}
                  onClick={() => void validateInvitation()}
                  className="w-full rounded-xl bg-decom-blue px-5 py-3 text-sm font-bold text-white transition hover:bg-decom-blue-hover disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? "Validando..." : "Validar invitación"}
                </button>
              </div>
            ) : null}

            {invitation && !success ? (
              <form onSubmit={submitApplication} className="space-y-5">
                <div className="rounded-xl bg-decom-blue/5 p-4 text-sm">
                  <p className="font-bold text-decom-blue-text">Invitación validada</p>
                  <p className="mt-1 text-muted-fg">
                    Distrito: <strong>{invitation.districtName}</strong>
                  </p>
                  <p className="mt-1 text-muted-fg">
                    Tipo:{" "}
                    <strong>
                      {invitation.invitationType === "guest"
                        ? "Invitado"
                        : "Integrante de DECOM"}
                    </strong>
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="text-sm font-semibold sm:col-span-2">
                    Nombre completo
                    <input
                      required
                      maxLength={140}
                      autoComplete="name"
                      value={fullName}
                      onChange={(event) => setFullName(event.target.value)}
                      className="mt-2 w-full rounded-xl border border-line px-4 py-3 font-normal outline-none focus:border-decom-blue focus:ring-2 focus:ring-decom-blue/10"
                      placeholder="Escribe tus nombres y apellidos"
                    />
                  </label>
                  <label className="text-sm font-semibold">
                    Correo electrónico
                    <input
                      required
                      type="email"
                      maxLength={254}
                      autoComplete="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      className="mt-2 w-full rounded-xl border border-line px-4 py-3 font-normal outline-none focus:border-decom-blue focus:ring-2 focus:ring-decom-blue/10"
                      placeholder="nombre@correo.com"
                    />
                  </label>
                  <label className="text-sm font-semibold">
                    WhatsApp
                    <input
                      required
                      type="tel"
                      maxLength={40}
                      autoComplete="tel"
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      className="mt-2 w-full rounded-xl border border-line px-4 py-3 font-normal outline-none focus:border-decom-blue focus:ring-2 focus:ring-decom-blue/10"
                      placeholder="+57 300 000 0000"
                    />
                  </label>
                  <label className="text-sm font-semibold">
                    Fecha de nacimiento
                    <input
                      required
                      type="date"
                      max={new Date().toISOString().slice(0, 10)}
                      value={dateOfBirth}
                      onChange={(event) => setDateOfBirth(event.target.value)}
                      className="mt-2 w-full rounded-xl border border-line px-4 py-3 font-normal outline-none focus:border-decom-blue focus:ring-2 focus:ring-decom-blue/10"
                    />
                  </label>
                  <label className="text-sm font-semibold">
                    Congregación
                    <select
                      required
                      value={congregationId}
                      onChange={(event) => setCongregationId(event.target.value)}
                      className="mt-2 w-full rounded-xl border border-line bg-surface px-4 py-3 font-normal outline-none focus:border-decom-blue focus:ring-2 focus:ring-decom-blue/10"
                    >
                      <option value="">Selecciona tu congregación</option>
                      {invitation.congregations.map((congregation) => (
                        <option key={congregation.id} value={congregation.id}>
                          {congregation.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  {invitation.invitationType === "decom_member" ? (
                    <label className="text-sm font-semibold sm:col-span-2">
                      Rol institucional que solicitas
                      <select
                        required
                        value={requestedRoleId}
                        onChange={(event) => setRequestedRoleId(event.target.value)}
                        className="mt-2 w-full rounded-xl border border-line bg-surface px-4 py-3 font-normal outline-none focus:border-decom-blue focus:ring-2 focus:ring-decom-blue/10"
                      >
                        <option value="">Selecciona el rol que deseas solicitar</option>
                        {invitation.roles.map((role) => (
                          <option key={role.id} value={role.id}>
                            {role.name}
                          </option>
                        ))}
                      </select>
                      <span className="mt-2 block text-xs font-normal text-muted-fg">
                        La selección no concede el rol automáticamente. Requiere
                        aprobación administrativa.
                      </span>
                    </label>
                  ) : null}
                </div>

                <button
                  type="submit"
                  disabled={!canSubmit || !invitation.congregations.length}
                  className="w-full rounded-xl bg-decom-blue px-5 py-3.5 text-sm font-bold text-white transition hover:bg-decom-blue-hover disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? "Enviando solicitud..." : "Enviar solicitud"}
                </button>
                <p className="text-center text-xs leading-5 text-muted-fg">
                  Al enviar, confirmas que los datos suministrados son correctos.
                  Tu cuenta no se activa hasta que la solicitud sea aprobada.
                </p>
              </form>
            ) : null}

            {success ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 text-xl font-bold text-emerald-700">
                  ✓
                </div>
                <h2 className="mt-4 text-xl font-bold text-emerald-900">
                  Solicitud recibida
                </h2>
                <p className="mt-2 text-sm leading-6 text-emerald-800">{message}</p>
                <p className="mt-2 text-sm leading-6 text-emerald-800">
                  Recibirás un correo de confirmación. Espera la decisión de la
                  administración antes de intentar activar tu cuenta.
                </p>
              </div>
            ) : null}

            {message && !success ? (
              <p role="status" className="rounded-xl bg-surface-muted p-4 text-sm text-foreground">
                {message}
              </p>
            ) : null}
          </div>
        </section>

        <footer className="py-7 text-center text-xs text-muted-fg">
          Academia DECOM · Acceso mediante invitación
        </footer>
      </div>
    </main>
  );
}
