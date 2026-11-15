"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Theme = "light" | "dark" | "system";

export default function Home() {
  const router = useRouter();
  const supabase = createClient();

  const [theme, setTheme] = useState<Theme>("system");
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberEmail, setRememberEmail] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"error" | "success" | "info">("info");
  const [isLoading, setIsLoading] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem("academia-theme") as Theme | null;
    // El tema se restaura desde localStorage para conservar la preferencia del usuario.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (savedTheme === "light" || savedTheme === "dark" || savedTheme === "system") setTheme(savedTheme);
    const savedEmail = localStorage.getItem("escuela-d34-remembered-email");
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberEmail(true);
    }
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const updateTheme = () => {
      const dark = theme === "dark" || (theme === "system" && mediaQuery.matches);
      setResolvedTheme(dark ? "dark" : "light");
      document.documentElement.classList.toggle("dark", dark);
    };
    updateTheme();
    mediaQuery.addEventListener("change", updateTheme);
    return () => mediaQuery.removeEventListener("change", updateTheme);
  }, [theme]);

  const changeTheme = (newTheme: Theme) => {
    setTheme(newTheme);
    localStorage.setItem("academia-theme", newTheme);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");
    setIsLoading(true);
    if (rememberEmail) localStorage.setItem("escuela-d34-remembered-email", email.trim());
    else localStorage.removeItem("escuela-d34-remembered-email");

    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) {
        setMessage("No fue posible iniciar sesión. Verifica tu correo y contraseña.");
        setMessageType("error");
        return;
      }
      setMessage("Inicio de sesión exitoso. Redirigiendo...");
      setMessageType("success");
      router.replace("/dashboard");
      router.refresh();
    } catch {
      setMessage("Ocurrió un error de conexión. Inténtalo nuevamente.");
      setMessageType("error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRecovery = async () => {
    if (!email.trim()) {
      setMessage("Escribe tu correo electrónico para recuperar tu contraseña.");
      setMessageType("info");
      return;
    }
    setIsRecovering(true);
    setMessage("");
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/actualizar-contrasena`,
      });
      if (error) {
        setMessage("No fue posible enviar el correo de recuperación. Verifica la dirección.");
        setMessageType("error");
      } else {
        setMessage("Si el correo está registrado, recibirás instrucciones para recuperar tu contraseña.");
        setMessageType("success");
      }
    } catch {
      setMessage("Ocurrió un error al solicitar la recuperación.");
      setMessageType("error");
    } finally {
      setIsRecovering(false);
    }
  };

  const isDark = resolvedTheme === "dark";

  return (
    <main className={`relative min-h-screen overflow-x-hidden transition-colors duration-300 ${isDark ? "bg-[#0b1422]" : "bg-[#f4f7fb]"}`}>
      <div className="absolute inset-x-0 top-0 h-[320px] px-[11px] pt-[11px] sm:h-[335px]" aria-hidden="true">
        <div className="relative h-full overflow-hidden rounded-[7px] bg-[#142b4b]">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_18%_15%,rgba(57,169,220,0.24),transparent_42%),linear-gradient(115deg,rgba(5,18,39,0.22),transparent_55%,rgba(5,18,39,0.28))]" />
          <div className="absolute -right-16 -top-24 h-72 w-72 rounded-full border border-white/10" />
          <div className="absolute -bottom-40 left-[12%] h-72 w-72 rounded-full border border-white/10" />
        </div>
      </div>

      <div className="relative z-10 flex min-h-screen flex-col items-center px-4 pb-10 pt-[68px] sm:pt-[76px]">
        <header className="w-full text-center text-white">
          <div className="mx-auto flex max-w-2xl flex-col items-center">
            <p className="text-3xl font-semibold leading-tight tracking-[-0.035em] sm:text-4xl">Bienvenido</p>
            <p className="mt-2 max-w-[420px] text-sm leading-relaxed text-white/85">
              Formación para comunicar con propósito.
            </p>
          </div>
        </header>

        <div className="absolute right-5 top-[18px] z-20 flex items-center gap-1 rounded-full border border-white/20 bg-white/10 p-1 backdrop-blur-sm" aria-label="Preferencia de apariencia">
          <button type="button" onClick={() => changeTheme("light")} title="Tema claro" aria-label="Tema claro" className={`flex h-7 w-7 items-center justify-center rounded-full ${theme === "light" ? "bg-white text-[#142b4b]" : "text-white/75 hover:bg-white/10"}`}>
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="3.5"/><path strokeLinecap="round" d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2"/></svg>
          </button>
          <button type="button" onClick={() => changeTheme("dark")} title="Tema oscuro" aria-label="Tema oscuro" className={`flex h-7 w-7 items-center justify-center rounded-full ${theme === "dark" ? "bg-white text-[#142b4b]" : "text-white/75 hover:bg-white/10"}`}>
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5 8.5 8.5 0 1 0 20.5 14.2Z"/></svg>
          </button>
          <button type="button" onClick={() => changeTheme("system")} title="Tema automático" aria-label="Tema automático" className={`flex h-7 w-7 items-center justify-center rounded-full ${theme === "system" ? "bg-white text-[#142b4b]" : "text-white/75 hover:bg-white/10"}`}>
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8m-4-4v4"/></svg>
          </button>
        </div>

        <section className={`relative z-10 -mt-0 w-full max-w-[440px] rounded-3xl border border-slate-200/70 px-6 pb-7 pt-8 shadow-[0_24px_70px_rgba(15,23,42,0.16)] sm:px-9 sm:pb-9 ${isDark ? "border border-white/10 bg-[#1f2937] text-white" : "bg-white text-[#252525]"}`}>
          <div className="mb-8 flex flex-col items-center text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0B3970] text-base font-black tracking-wide text-white shadow-lg shadow-[#0B3970]/20" aria-hidden="true">D34</div>
            <div className="flex w-full flex-col items-center justify-center text-center" aria-label="Escuela de Comunicaciones, Distrito 34, IPUC">
              <p className={`text-lg font-bold leading-tight tracking-[-0.025em] ${isDark ? "text-white" : "text-[#142b4b]"}`}>Escuela de</p>
              <p className={`text-2xl font-extrabold leading-tight tracking-[-0.035em] ${isDark ? "text-white" : "text-[#142b4b]"}`}>Comunicaciones</p>
              <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#087db5]">Distrito 34 · IPUC</p>
            </div>
            <h1 className="mt-4 text-base font-semibold">Acceso institucional</h1>
            <p className={`mt-1 text-sm ${isDark ? "text-slate-300" : "text-slate-500"}`}>Ingresa con las credenciales de tu cuenta.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-[10px]">
            <div>
              <label htmlFor="email" className="sr-only">Correo electrónico</label>
              <input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Correo electrónico" className={`h-12 w-full rounded-xl border px-4 text-sm outline-none transition placeholder:text-slate-500 focus:border-[#0aa9d2] focus:ring-2 focus:ring-[#0aa9d2]/15 ${isDark ? "border-slate-600 bg-[#111827] text-white" : "border-[#cbd1d8] bg-white text-[#263548]"}`} />
            </div>
            <div className="relative">
              <label htmlFor="password" className="sr-only">Contraseña</label>
              <input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Contraseña" className={`h-12 w-full rounded-xl border px-4 pr-12 text-sm outline-none transition placeholder:text-slate-500 focus:border-[#0aa9d2] focus:ring-2 focus:ring-[#0aa9d2]/15 ${isDark ? "border-slate-600 bg-[#111827] text-white" : "border-[#cbd1d8] bg-white text-[#263548]"}`} />
              <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#8492a3] hover:text-[#087db5]">
                {showPassword ? <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8"/><path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c5.5 0 9 7 9 7a15 15 0 0 1-3.1 3.8M6.2 6.2C4.1 7.7 3 12 3 12s3.5 7 9 7c1.2 0 2.3-.3 3.3-.8"/></svg> : <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M2.5 12s3.4-7 9.5-7 9.5 7 9.5 7-3.4 7-9.5 7-9.5-7-9.5-7Z"/><circle cx="12" cy="12" r="2.5"/></svg>}
              </button>
            </div>

            <div className="flex items-center justify-between pt-[1px]">
              <label className="flex cursor-pointer items-center gap-2 text-xs">
                <input type="checkbox" checked={rememberEmail} onChange={(e) => setRememberEmail(e.target.checked)} className="peer sr-only" />
                <span className={`relative h-[15px] w-[27px] rounded-full transition after:absolute after:left-[2px] after:top-[2px] after:h-[11px] after:w-[11px] after:rounded-full after:bg-white after:shadow after:transition ${rememberEmail ? "bg-[#08a9d0] after:translate-x-3" : "bg-[#d9dde2]"}`} />
                <span className={isDark ? "text-slate-300" : "text-[#394454]"}>Recordar cuenta</span>
              </label>
              <button type="button" onClick={handleRecovery} disabled={isRecovering} className="text-xs font-semibold text-[#087db5] hover:underline disabled:opacity-50">
                {isRecovering ? "Enviando..." : "¿Olvidaste tu contraseña?"}
              </button>
            </div>

            {message && <div role="status" className={`rounded-xl border p-3 text-sm leading-5 ${messageType === "error" ? "border-red-200 bg-red-50 text-red-700" : messageType === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-blue-200 bg-blue-50 text-blue-700"}`}>{message}</div>}

            <button type="submit" disabled={isLoading} className="mt-4 flex h-12 w-full items-center justify-center rounded-xl bg-[#087db5] px-4 text-sm font-bold text-white shadow-[0_3px_7px_rgba(0,0,0,0.14)] transition hover:bg-[#0797bd] disabled:cursor-not-allowed disabled:opacity-60">
              {isLoading ? <><svg viewBox="0 0 24 24" className="mr-2 h-4 w-4 animate-spin" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".3" strokeWidth="3" /><path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>Ingresando...</> : "Ingresar"}
            </button>
          </form>

          <div className="my-5 text-center text-xs font-medium text-slate-400">o</div>
          <button type="button" onClick={() => { setMessage("El registro en la Escuela se habilita mediante invitación de un administrador."); setMessageType("info"); }} className={`flex h-12 w-full items-center justify-center rounded-xl text-sm font-bold text-white shadow-[0_3px_7px_rgba(0,0,0,0.14)] transition ${isDark ? "bg-[#34363a] hover:bg-[#41444a]" : "bg-[#252528] hover:bg-[#38383d]"}`}>
            Registrarse
          </button>

          <p className={`mt-6 text-center text-xs leading-5 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
            Escuela de Comunicaciones D34 · Formación para comunicar con propósito.
          </p>
        </section>
      </div>
    </main>
  );
}
