"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Mode = "signup" | "signin";

const requestIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default function InvitationActivationForm({
  requestId,
}: {
  requestId: string;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const activationStarted = useRef(false);
  const [mode, setMode] = useState<Mode>("signup");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [activated, setActivated] = useState(false);

  const activate = useCallback(async () => {
    if (!requestIdPattern.test(requestId) || activationStarted.current) return;

    activationStarted.current = true;
    setLoading(true);
    setMessage("Verificando tu cuenta y la aprobación...");

    try {
      const { data, error } = await supabase.rpc(
        "activate_approved_invitation",
        { p_request_id: requestId }
      );

      if (
        error ||
        !data ||
        typeof data !== "object" ||
        Array.isArray(data) ||
        !("success" in data) ||
        data.success !== true
      ) {
        activationStarted.current = false;
        setMessage(
          error?.message ??
            "No fue posible activar la cuenta. Verifica que la solicitud esté aprobada y que uses el correo correspondiente."
        );
        return;
      }

      setActivated(true);
      setMessage("Tu cuenta fue activada correctamente. Ya puedes ingresar a Academia DECOM.");
      router.replace("/dashboard");
      router.refresh();
    } catch {
      activationStarted.current = false;
      setMessage("Ocurrió un error al activar la cuenta. Inténtalo nuevamente.");
    } finally {
      setLoading(false);
    }
  }, [requestId, router, supabase]);

  useEffect(() => {
    if (!requestIdPattern.test(requestId)) return;

    let active = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (active && data.user?.email_confirmed_at) {
        void activate();
      }
    });

    return () => {
      active = false;
    };
  }, [activate, requestId, supabase]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!requestIdPattern.test(requestId) || loading) return;

    setLoading(true);
    setMessage("");

    try {
      if (mode === "signup") {
        if (password.length < 8) {
          setMessage("La contraseña debe tener al menos 8 caracteres.");
          return;
        }
        if (password !== confirmPassword) {
          setMessage("Las contraseñas no coinciden.");
          return;
        }

        const { data, error } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: {
            data: { full_name: fullName.trim() },
            emailRedirectTo: `${window.location.origin}/activar?request_id=${encodeURIComponent(requestId)}`,
          },
        });

        if (error) {
          setMessage(
            "No fue posible crear la cuenta. Si ya tienes una cuenta con este correo, cambia a «Iniciar sesión»."
          );
          return;
        }

        if (data.user?.email_confirmed_at) {
          await activate();
          return;
        }

        setMessage(
          "Te enviamos un correo para confirmar tu dirección. Abre ese mensaje y vuelve a esta página desde el enlace de confirmación para terminar la activación."
        );
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });

        if (error) {
          setMessage("No fue posible iniciar sesión. Verifica el correo y la contraseña.");
          return;
        }

        await activate();
      }
    } catch {
      setMessage("Ocurrió un error de conexión. Inténtalo nuevamente.");
    } finally {
      setLoading(false);
    }
  }

  const validRequest = requestIdPattern.test(requestId);

  return (
    <main id="contenido" className="flex min-h-screen items-center justify-center bg-background px-4 py-8 text-foreground">
      <section className="w-full max-w-xl overflow-hidden rounded-3xl border border-line bg-surface shadow-sm">
        <header className="bg-decom-navy px-7 py-8 text-white sm:px-9">
          <p className="text-xs font-bold tracking-[0.2em] text-decom-teal-light">
            ACADEMIA DECOM
          </p>
          <h1 className="mt-3 text-2xl font-bold sm:text-3xl">
            Activación de cuenta
          </h1>
          <p className="mt-3 text-sm leading-6 text-blue-100">
            Tu solicitud fue aprobada. Crea una contraseña o inicia sesión con
            el correo que utilizaste en el registro para activar tu acceso.
          </p>
        </header>

        <div className="p-7 sm:p-9">
          {!validRequest ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              El enlace de activación no es válido. Utiliza el enlace completo
              que recibiste en el correo de aprobación.
            </div>
          ) : activated ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900">
              {message}
            </div>
          ) : (
            <>
              <div className="mb-6 flex rounded-xl bg-surface-muted p-1">
                <button
                  type="button"
                  onClick={() => {
                    setMode("signup");
                    setMessage("");
                  }}
                  className={`flex-1 rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
                    mode === "signup"
                      ? "bg-surface text-decom-blue-text shadow-sm"
                      : "text-muted-fg hover:text-foreground"
                  }`}
                >
                  Crear cuenta
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode("signin");
                    setMessage("");
                  }}
                  className={`flex-1 rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
                    mode === "signin"
                      ? "bg-surface text-decom-blue-text shadow-sm"
                      : "text-muted-fg hover:text-foreground"
                  }`}
                >
                  Iniciar sesión
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {mode === "signup" ? (
                  <label className="block text-sm font-semibold">
                    Nombre completo
                    <input
                      required
                      maxLength={140}
                      autoComplete="name"
                      value={fullName}
                      onChange={(event) => setFullName(event.target.value)}
                      className="mt-2 w-full rounded-xl border border-line px-4 py-3 font-normal outline-none focus:border-decom-blue focus:ring-2 focus:ring-decom-blue/10"
                      placeholder="Tus nombres y apellidos"
                    />
                  </label>
                ) : null}

                <label className="block text-sm font-semibold">
                  Correo electrónico
                  <input
                    required
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-line px-4 py-3 font-normal outline-none focus:border-decom-blue focus:ring-2 focus:ring-decom-blue/10"
                    placeholder="El mismo correo de tu solicitud"
                  />
                </label>

                <label className="block text-sm font-semibold">
                  Contraseña
                  <input
                    required
                    type="password"
                    minLength={8}
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-line px-4 py-3 font-normal outline-none focus:border-decom-blue focus:ring-2 focus:ring-decom-blue/10"
                    placeholder={mode === "signup" ? "Mínimo 8 caracteres" : "Tu contraseña"}
                  />
                </label>

                {mode === "signup" ? (
                  <label className="block text-sm font-semibold">
                    Confirmar contraseña
                    <input
                      required
                      type="password"
                      minLength={8}
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      className="mt-2 w-full rounded-xl border border-line px-4 py-3 font-normal outline-none focus:border-decom-blue focus:ring-2 focus:ring-decom-blue/10"
                      placeholder="Repite tu contraseña"
                    />
                  </label>
                ) : null}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl bg-decom-blue px-5 py-3.5 text-sm font-bold text-white transition hover:bg-decom-blue-hover disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading
                    ? "Procesando..."
                    : mode === "signup"
                      ? "Crear cuenta y activar"
                      : "Ingresar y activar"}
                </button>
              </form>

              {message ? (
                <p role="status" className="mt-5 rounded-xl bg-surface-muted p-4 text-sm leading-6 text-foreground">
                  {message}
                </p>
              ) : null}

              <p className="mt-6 text-xs leading-5 text-muted-fg">
                La activación solo se completa si la solicitud está aprobada,
                el correo está confirmado y coincide con el registrado.
              </p>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
