
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Theme = "light" | "dark" | "system";

export default function Home() {
  const router = useRouter();

  const [theme, setTheme] = useState<Theme>("system");
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"error" | "success" | "info">("info");
  const [isLoading, setIsLoading] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);

  const supabase = createClient();

  // Configuración del tema
  useEffect(() => {
    const savedTheme = localStorage.getItem("academia-theme") as Theme | null;

    if (savedTheme === "light" || savedTheme === "dark" || savedTheme === "system") {
      // Leer localStorage tras montar evita discrepancias entre SSR e hidratación.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTheme(savedTheme);
    }
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const updateTheme = () => {
      const isDark = theme === "dark" ||
        (theme === "system" && mediaQuery.matches);

      const newTheme = isDark ? "dark" : "light";

      setResolvedTheme(newTheme);
      document.documentElement.classList.toggle("dark", isDark);
    };

    updateTheme();

    mediaQuery.addEventListener("change", updateTheme);

    return (
    <main className={`relative min-h-screen overflow-hidden transition-colors duration-300 ${isDark ? "bg-[#071629]" : "bg-[#eef3f8]"}`}>
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -left-40 -top-40 h-[34rem] w-[34rem] rounded-full bg-[#0b5b9a]/10 blur-3xl" />
        <div className="absolute -bottom-48 right-[-8rem] h-[38rem] w-[38rem] rounded-full bg-[#18a5c0]/10 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-[1440px] items-center justify-center p-4 sm:p-8 lg:p-12">
        <div className={`grid w-full max-w-[1240px] overflow-hidden rounded-[2rem] border shadow-[0_32px_100px_-35px_rgba(4,28,54,0.38)] lg:min-h-[740px] lg:grid-cols-[1.08fr_0.92fr] ${isDark ? "border-white/10 bg-[#0d2035]" : "border-white/80 bg-white"}`}>

          {/* Identidad institucional */}
          <section className="relative isolate flex min-h-[560px] flex-col justify-between overflow-hidden bg-[linear-gradient(145deg,#082b50_0%,#0b4778_54%,#087db5_100%)] px-7 py-8 text-white sm:px-12 sm:py-11 lg:min-h-full lg:px-14 lg:py-12">
            <div className="pointer-events-none absolute inset-0 -z-10 opacity-30" aria-hidden="true">
              <div className="absolute -right-24 top-16 h-[28rem] w-[28rem] rounded-full border border-white/30" />
              <div className="absolute -right-12 top-28 h-[25rem] w-[25rem] rounded-full border border-white/20" />
              <div className="absolute right-10 top-44 h-[20rem] w-[20rem] rounded-full border border-white/15" />
              <div className="absolute -bottom-32 -left-20 h-[28rem] w-[28rem] rounded-full bg-[#39a9dc]/30 blur-3xl" />
              <div className="absolute inset-0 bg-[linear-gradient(115deg,transparent_0%,rgba(255,255,255,0.04)_48%,transparent_49%)]" />
            </div>

            <div className="relative z-10 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/25 bg-white/10 shadow-lg shadow-black/10 backdrop-blur-sm">
                  <span className="text-[1.65rem] font-black tracking-[-0.09em]">D<span className="text-[#ffbd00]">34</span></span>
                </div>
                <div>
                  <p className="text-[0.68rem] font-bold uppercase tracking-[0.22em] text-white/65">Distrito 34 · IPUC</p>
                  <p className="mt-1 text-sm font-bold tracking-[0.08em]">ESCUELA DE COMUNICACIONES</p>
                </div>
              </div>
              <span className="hidden rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-white/80 sm:inline-flex">Formación institucional</span>
            </div>

            <div className="relative z-10 my-14 max-w-[560px] lg:my-0 lg:pb-10">
              <div className="mb-7 flex items-center gap-3">
                <span className="h-px w-10 bg-[#ffbd00]" />
                <p className="text-xs font-bold uppercase tracking-[0.28em] text-[#ffda72]">Comunicación · Formación · Servicio</p>
              </div>
              <p className="mb-5 text-[clamp(3.5rem,8vw,6.5rem)] font-black leading-[0.88] tracking-[-0.075em] text-white">
                D34<span className="text-[#ffbd00]">.</span>
              </p>
              <h1 className="max-w-[520px] text-3xl font-bold leading-[1.13] tracking-[-0.035em] sm:text-4xl lg:text-[2.8rem]">
                Formación para comunicar con propósito.
              </h1>
              <p className="mt-5 max-w-md text-lg font-medium tracking-wide text-[#bfe7fb]">
                Comunicar. Formar. Servir.
              </p>
              <p className="mt-7 max-w-md text-sm leading-7 text-white/75 sm:text-base">
                Un espacio de aprendizaje y desarrollo de habilidades para fortalecer la comunicación y el servicio institucional.
              </p>
            </div>

            <div className="relative z-10 flex items-end justify-between gap-5 border-t border-white/20 pt-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/55">Escuela de Comunicaciones D34</p>
                <p className="mt-2 text-sm font-medium text-white/90">Distrito 34 · Iglesia Pentecostal Unida de Colombia</p>
              </div>
              <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#ffbd00]/60 text-[#ffcf4d] sm:flex" aria-hidden="true">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              </div>
            </div>
          </section>

          {/* Acceso */}
          <section className={`relative flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-[4.5rem] ${isDark ? "bg-[#0d2035] text-white" : "bg-white text-[#102d4d]"}`}>
            <div className="absolute right-6 top-6 sm:right-9 sm:top-8">
              <div className={`flex items-center gap-1 rounded-full border p-1 ${isDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-slate-50"}`} aria-label="Preferencia de apariencia">
                <button type="button" onClick={() => changeTheme("light")} title="Tema claro" aria-label="Tema claro" className={`flex h-9 w-9 items-center justify-center rounded-full transition ${theme === "light" ? "bg-[#0b5b9a] text-white shadow" : "text-slate-400 hover:text-[#0b5b9a]"}`}>
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="3.5"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></svg>
                </button>
                <button type="button" onClick={() => changeTheme("dark")} title="Tema oscuro" aria-label="Tema oscuro" className={`flex h-9 w-9 items-center justify-center rounded-full transition ${theme === "dark" ? "bg-[#0b5b9a] text-white shadow" : "text-slate-400 hover:text-[#0b5b9a]"}`}>
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5 8.5 8.5 0 1 0 20.5 14.2Z"/></svg>
                </button>
                <button type="button" onClick={() => changeTheme("system")} title="Tema automático" aria-label="Tema automático" className={`flex h-9 w-9 items-center justify-center rounded-full transition ${theme === "system" ? "bg-[#0b5b9a] text-white shadow" : "text-slate-400 hover:text-[#0b5b9a]"}`}>
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8m-4-4v4"/></svg>
                </button>
              </div>
            </div>

            <div className="mx-auto w-full max-w-[390px] pt-10 sm:pt-6">
              <div className="mb-9">
                <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-[#eaf5fc] px-3 py-1.5 text-[0.68rem] font-bold uppercase tracking-[0.18em] text-[#07568f]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#13a6a0]" />
                  Acceso institucional
                </div>
                <p className={`mb-2 text-xs font-bold uppercase tracking-[0.24em] ${isDark ? "text-[#67c5e5]" : "text-[#0b83b7]"}`}>Bienvenido</p>
                <h2 className="text-[2.15rem] font-bold leading-tight tracking-[-0.045em]">Inicia sesión</h2>
                <p className={`mt-3 text-sm leading-6 ${isDark ? "text-slate-300" : "text-slate-500"}`}>Accede a tu espacio de formación institucional.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="email" className="mb-2 block text-sm font-semibold">Correo electrónico</label>
                  <input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nombre@correo.com" className={`w-full rounded-xl border px-4 py-3.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#1689bd] focus:ring-4 focus:ring-[#1689bd]/10 ${isDark ? "border-white/15 bg-[#08182a] text-white" : "border-slate-200 bg-[#f7f9fc] text-[#102d4d]"}`} />
                </div>

                <div>
                  <label htmlFor="password" className="mb-2 block text-sm font-semibold">Contraseña</label>
                  <div className="relative">
                    <input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Ingresa tu contraseña" className={`w-full rounded-xl border px-4 py-3.5 pr-20 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#1689bd] focus:ring-4 focus:ring-[#1689bd]/10 ${isDark ? "border-white/15 bg-[#08182a] text-white" : "border-slate-200 bg-[#f7f9fc] text-[#102d4d]"}`} />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-[#0b83b7] transition hover:text-[#13a6a0]">{showPassword ? "Ocultar" : "Mostrar"}</button>
                  </div>
                </div>

                <div className="flex justify-end pt-0.5">
                  <button type="button" onClick={handleRecovery} disabled={isRecovering} className="text-sm font-semibold text-[#0b83b7] transition hover:text-[#13a6a0] disabled:opacity-50">{isRecovering ? "Enviando..." : "¿Olvidaste tu contraseña?"}</button>
                </div>

                {message && (
                  <div role="status" className={`rounded-xl border p-3 text-sm ${messageType === "error" ? "border-red-300 bg-red-50 text-red-700" : messageType === "success" ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-blue-300 bg-blue-50 text-blue-700"}`}>
                    {message}
                  </div>
                )}

                <button type="submit" disabled={isLoading} className="group flex w-full items-center justify-center gap-3 rounded-xl bg-[linear-gradient(100deg,#07568f,#087db5)] px-5 py-4 text-sm font-bold text-white shadow-lg shadow-[#07568f]/20 transition hover:-translate-y-0.5 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60">
                  {isLoading ? "Verificando acceso..." : "Ingresar"}
                  {!isLoading && <svg viewBox="0 0 24 24" className="h-4 w-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>}
                </button>
              </form>

              <div className={`mt-9 border-t pt-6 ${isDark ? "border-white/10" : "border-slate-100"}`}>
                <div className="flex gap-3">
                  <svg viewBox="0 0 24 24" className={`mt-0.5 h-5 w-5 shrink-0 ${isDark ? "text-[#67c5e5]" : "text-[#0b83b7]"}`} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="m9 12 2 2 4-4"/></svg>
                  <p className={`text-xs leading-5 ${isDark ? "text-slate-400" : "text-slate-500"}`}>El acceso está habilitado únicamente para integrantes autorizados de la Escuela de Comunicaciones D34.</p>
                </div>
                <p className={`mt-6 text-center text-[0.65rem] font-bold uppercase tracking-[0.2em] ${isDark ? "text-slate-500" : "text-slate-400"}`}>Escuela de Comunicaciones D34 · Formación institucional</p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );

}
