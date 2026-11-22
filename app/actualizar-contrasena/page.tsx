"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const inputClassName =
  "mt-2 w-full rounded-xl border border-line bg-background px-4 py-3";
const buttonClassName =
  "w-full rounded-xl bg-decom-blue px-5 py-3 font-semibold text-white disabled:opacity-60";
const feedbackClassName = "rounded-xl border border-line bg-surface-muted p-4 text-sm";

export default function ActualizarContrasenaPage() {
  const supabase = useMemo(() => createClient(), []);
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [updated, setUpdated] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setHasSession(Boolean(session?.user));
      setEmail(session?.user?.email ?? "");
      setReady(true);
    });

    void supabase.auth.getUser().then(({ data, error }) => {
      if (!active) return;
      setHasSession(Boolean(data.user) && !error);
      setEmail(data.user?.email ?? "");
      setReady(true);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (!hasSession) {
      setMessage("El enlace no es válido o venció. Solicita otro desde el inicio de sesión.");
      return;
    }

    if (password.length < 8) {
      setMessage("La contraseña debe tener al menos 8 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        setMessage("No se pudo actualizar la contraseña. Solicita un nuevo enlace.");
        return;
      }

      setUpdated(true);
      setPassword("");
      setConfirmPassword("");
      setMessage("Contraseña actualizada. Ya puedes continuar a Academia DECOM.");
    } catch {
      setMessage("Error de conexión. Inténtalo nuevamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      id="contenido"
      className="flex min-h-screen items-center justify-center bg-background px-4 py-8 text-foreground"
    >
      <section
        className="w-full max-w-xl overflow-hidden rounded-3xl border border-line bg-surface shadow-sm"
      >
        <header className="bg-decom-navy px-7 py-8 text-white sm:px-9">
          <p className="text-xs font-bold tracking-[0.2em] text-decom-teal-light">
            ACADEMIA DECOM
          </p>
          <h1 className="mt-3 text-2xl font-bold sm:text-3xl">Restablecer contraseña</h1>
          <p className="mt-3 text-sm leading-6 text-blue-100">
            Define una nueva contraseña para recuperar el acceso seguro a tu cuenta.
          </p>
        </header>

        <div className="space-y-5 p-7 sm:p-9">
          {!ready && (
            <p role="status" className="text-sm text-muted-fg">
              Verificando el enlace de recuperación...
            </p>
          )}

          {ready && !hasSession && (
            <div className="space-y-5">
              <p role="alert" className={feedbackClassName}>
                {message || "No se encontró una sesión válida. Solicita un nuevo enlace."}
              </p>
              <Link href="/" className={buttonClassName}>
                Volver al inicio de sesión
              </Link>
            </div>
          )}

          {ready && hasSession && !updated && (
            <form onSubmit={handleSubmit} className="space-y-5">
              {email && (
                <p className="rounded-xl bg-surface-muted px-4 py-3 text-sm text-muted-fg">
                  Cuenta: <span className="font-semibold text-foreground">{email}</span>
                </p>
              )}

              <label className="block text-sm font-semibold">
                Nueva contraseña
                <input
                  required
                  type="password"
                  minLength={8}
                  maxLength={72}
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className={inputClassName}
                  placeholder="Mínimo 8 caracteres"
                />
              </label>

              <label className="block text-sm font-semibold">
                Confirmar contraseña
                <input
                  required
                  type="password"
                  minLength={8}
                  maxLength={72}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className={inputClassName}
                  placeholder="Escribe nuevamente la contraseña"
                />
              </label>

              {message && (
                <p role="alert" className={feedbackClassName}>
                  {message}
                </p>
              )}

              <button type="submit" disabled={loading} className={buttonClassName}>
                {loading ? "Actualizando..." : "Guardar nueva contraseña"}
              </button>
            </form>
          )}

          {updated && (
            <div className="space-y-5">
              <p role="status" className={feedbackClassName}>
                {message}
              </p>
              <Link href="/dashboard" className={buttonClassName}>
                Continuar a Academia DECOM
              </Link>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
