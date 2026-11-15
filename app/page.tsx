"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LoaderCircle, Monitor, Moon, RadioTower, Sun } from "lucide-react";
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

  const inputClass = `h-12 w-full rounded-xl border px-4 text-sm outline-none transition-colors placeholder:text-slate-400 focus:border-[#087DB5] focus:ring-4 focus:ring-[#087DB5]/10 ${isDark ? "border-slate-700 bg-[#101F30] text-slate-100" : "border-slate-300 bg-white text-[#102D4D]"}`;
  const mutedText = isDark ? "text-slate-400" : "text-slate-500";
  const panelClass = isDark ? "border-white/10 bg-[#142437] text-slate-100" : "border-slate-200 bg-white text-[#102D4D]";

  return (
    <main className={`relative min-h-screen overflow-hidden transition-colors duration-300 ${isDark ? "bg-[#0C1724]" : "bg-[#F4F7FA]"}`}>
      <div className="absolute inset-x-0 top-0 h-[340px] px-3 pt-3 sm:h-[370px] sm:px-5 sm:pt-5" aria-hidden="true">
        <div className="relative h-full overflow-hidden rounded-[26px] bg-[#102D4D]">
          <div className="absolute inset-y-0 right-0 hidden w-[46%] items-center justify-center opacity-70 sm:flex">
            <div className="relative flex h-56 w-56 items-center justify-center rounded-full border border-white/10">
              <div className="absolute h-40 w-40 rounded-full border border-[#19A7A0]/35" />
              <div className="absolute h-24 w-24 rounded-full border border-white/15" />
              <RadioTower className="h-16 w-16 text-[#75D6CF]" strokeWidth={1.1} />
              <span className="absolute -right-5 top-8 h-2 w-2 rounded-full bg-[#75D6CF]" />
              <span className="absolute bottom-5 -left-2 h-1.5 w-1.5 rounded-full bg-white/70" />
            </div>
          </div>
          <div className="absolute bottom-8 left-8 hidden h-12 items-end gap-1.5 sm:flex" aria-hidden="true">
            {Array.from({ length: 19 }, (_, index) => (
              <span key={index} className="w-1.5 rounded-full bg-[#19A7A0]/70" style={{ height: `${12 + ((index * 17) % 34)}px` }} />
            ))}
          </div>
          <div className="relative z-10 mx-auto flex h-full max-w-6xl flex-col justify-center px-7 pb-14 pt-12 text-white sm:px-12">
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#75D6CF]">IPUC · Distrito 34</p>
            <h1 className="mt-4 max-w-xl text-3xl font-bold leading-tight tracking-tight sm:text-4xl">Escuela de Comunicaciones</h1>
            <p className="mt-3 max-w-lg text-sm leading-6 text-blue-100 sm:text-base">
              Formación para comunicar con propósito.
            </p>
          </div>
        </div>
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col items-center px-4 pb-8 pt-[250px] sm:px-6 sm:pt-[275px]">
        <div className="absolute right-6 top-6 z-20 flex items-center gap-1 rounded-full border border-white/20 bg-white/10 p-1.5 shadow-sm backdrop-blur-md sm:right-10 sm:top-10" role="group" aria-label="Preferencia de apariencia">
          <button type="button" onClick={() => changeTheme("light")} title="Tema claro" aria-label="Tema claro" aria-pressed={theme === "light"} className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors focus-visible:outline-white ${theme === "light" ? "bg-white text-[#102D4D] shadow-sm" : "text-white/80 hover:bg-white/10"}`}>
            <Sun className="h-4 w-4" aria-hidden="true" />
          </button>
          <button type="button" onClick={() => changeTheme("dark")} title="Tema oscuro" aria-label="Tema oscuro" aria-pressed={theme === "dark"} className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors focus-visible:outline-white ${theme === "dark" ? "bg-white text-[#102D4D] shadow-sm" : "text-white/80 hover:bg-white/10"}`}>
            <Moon className="h-4 w-4" aria-hidden="true" />
          </button>
          <button type="button" onClick={() => changeTheme("system")} title="Tema automático" aria-label="Tema automático" aria-pressed={theme === "system"} className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors focus-visible:outline-white ${theme === "system" ? "bg-white text-[#102D4D] shadow-sm" : "text-white/80 hover:bg-white/10"}`}>
            <Monitor className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <section aria-labelledby="login-title" className={`relative z-10 w-full max-w-[460px] rounded-3xl border px-6 py-7 shadow-[0_24px_70px_rgba(15,23,42,0.16)] sm:px-9 sm:py-9 ${panelClass}`}>
          <div className="mb-7 flex flex-col items-center text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#102D4D] text-sm font-black tracking-wide text-white shadow-lg ring-1 ring-[#19A7A0]/30">
              D34
            </div>
            <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.18em] text-[#19A7A0]">Acceso institucional</p>
            <h2 id="login-title" className="mt-2 text-xl font-bold tracking-tight">Bienvenido</h2>
            <p className={`mt-1 text-sm ${mutedText}`}>Ingresa con las credenciales de tu cuenta.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="email" className="block text-sm font-semibold">Correo electrónico</label>
              <input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nombre@correo.com" className={inputClass} />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="block text-sm font-semibold">Contraseña</label>
              <div className="relative">
                <input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Escribe tu contraseña" className={`${inputClass} pr-12`} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"} title={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"} aria-pressed={showPassword} className={`absolute right-2 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg transition-colors hover:bg-[#087DB5]/10 focus-visible:outline-offset-1 ${mutedText}`}>
                  {showPassword ? <EyeOff className="h-5 w-5" aria-hidden="true" /> : <Eye className="h-5 w-5" aria-hidden="true" />}
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <label className={`inline-flex cursor-pointer items-center gap-2 text-sm ${mutedText}`}>
                <input type="checkbox" checked={rememberEmail} onChange={(e) => setRememberEmail(e.target.checked)} className="h-4 w-4 rounded border-slate-300 accent-[#087DB5] focus-visible:outline-offset-2" />
                Recordar cuenta
              </label>
              <button type="button" onClick={handleRecovery} disabled={isRecovering} className="text-sm font-semibold text-[#19A7A0] transition-colors hover:text-[#087DB5] hover:underline disabled:cursor-wait disabled:opacity-50">
                {isRecovering ? "Enviando..." : "¿Olvidaste tu contraseña?"}
              </button>
            </div>

            {message && (
              <div role={messageType === "error" ? "alert" : "status"} aria-live="polite" className={`rounded-xl border p-3 text-sm leading-5 ${messageType === "error" ? (isDark ? "border-red-900 bg-red-950/40 text-red-200" : "border-red-200 bg-red-50 text-red-700") : messageType === "success" ? (isDark ? "border-emerald-900 bg-emerald-950/40 text-emerald-200" : "border-emerald-200 bg-emerald-50 text-emerald-700") : (isDark ? "border-sky-900 bg-sky-950/40 text-sky-200" : "border-sky-200 bg-sky-50 text-sky-700")}`}>
                {message}
              </div>
            )}

            <button type="submit" disabled={isLoading} aria-busy={isLoading} className="flex h-12 w-full items-center justify-center rounded-xl bg-[#087DB5] px-4 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#066b9b] focus-visible:outline-offset-2 disabled:cursor-wait disabled:opacity-60">
              {isLoading ? <><LoaderCircle className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />Ingresando...</> : "Ingresar"}
            </button>
          </form>

          <div className={`my-6 flex items-center gap-3 text-xs ${mutedText}`}>
            <span className={`h-px flex-1 ${isDark ? "bg-slate-700" : "bg-slate-200"}`} />
            <span>¿Aún no tienes acceso?</span>
            <span className={`h-px flex-1 ${isDark ? "bg-slate-700" : "bg-slate-200"}`} />
          </div>

          <button type="button" onClick={() => { setMessage("El registro en la Escuela se habilita mediante invitación de un administrador."); setMessageType("info"); }} className={`flex h-12 w-full items-center justify-center rounded-xl border px-4 text-sm font-semibold transition-colors hover:border-[#19A7A0] hover:bg-[#19A7A0]/5 focus-visible:outline-offset-2 ${isDark ? "border-slate-700 text-slate-200" : "border-slate-300 text-[#102D4D]"}`}>
            Solicitar acceso
          </button>

          <footer className={`mt-7 border-t pt-5 text-center text-xs leading-5 ${isDark ? "border-slate-700 text-slate-400" : "border-slate-200 text-slate-500"}`}>
            Escuela de Comunicaciones D34 · IPUC
            <span className="mt-1 block">Formación para comunicar con propósito.</span>
          </footer>
        </section>
      </div>
    </main>
  );
}
