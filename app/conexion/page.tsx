
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

    return () => {
      mediaQuery.removeEventListener("change", updateTheme);
    };
  }, [theme]);

  const changeTheme = (newTheme: Theme) => {
    setTheme(newTheme);
    localStorage.setItem("academia-theme", newTheme);
  };

  // Inicio de sesión
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setMessage("");
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setMessage("No fue posible iniciar sesión. Verifica tu correo y contraseña.");
        setMessageType("error");
        return;
      }

      setMessageType("success");
      setMessage("Inicio de sesión exitoso. Redirigiendo...");

      router.replace("/dashboard");
      router.refresh();
    } catch {
      setMessage("Ocurrió un error de conexión. Inténtalo nuevamente.");
      setMessageType("error");
    } finally {
      setIsLoading(false);
    }
  };

  // Recuperación de contraseña
  const handleRecovery = async () => {
    if (!email.trim()) {
      setMessage("Escribe tu correo electrónico para recuperar tu contraseña.");
      setMessageType("info");
      return;
    }

    setIsRecovering(true);
    setMessage("");

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        {
          redirectTo: `${window.location.origin}/actualizar-contrasena`,
        }
      );

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
    <main
      className={`min-h-screen flex items-center justify-center p-4 transition-colors duration-300 ${
        isDark ? "bg-[#101B2A]" : "bg-[#F4F7FA]"
      }`}
    >
      <div className="w-full max-w-6xl min-h-[650px] grid grid-cols-1 lg:grid-cols-2 overflow-hidden rounded-3xl shadow-2xl">

        {/* PANEL INSTITUCIONAL */}
        <section className="relative flex flex-col justify-between overflow-hidden bg-[#102D4D] p-8 text-white sm:p-12 lg:p-14">

          <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full border border-white/10" />
          <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full border border-white/10" />
          <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-[#087DB5]/20 blur-3xl" />

          <div className="relative z-10">
            <div className="mb-12 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 text-xl font-bold">
                D
              </div>

              <div>
                <p className="text-lg font-bold tracking-[0.18em]">
                  ACADEMIA DECOM
                </p>
                <p className="text-xs tracking-wider text-blue-200">
                  DISTRITO 34
                </p>
              </div>
            </div>

            <div className="mt-10 max-w-lg sm:mt-16">
              <span className="mb-5 inline-block rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold tracking-widest text-blue-100">
                FORMACIÓN INSTITUCIONAL
              </span>

              <h1 className="mb-6 text-4xl font-bold leading-tight sm:text-5xl">
                Comunicar con propósito.
                <span className="block text-[#19A7A0]">
                  Formar para servir.
                </span>
              </h1>

              <p className="max-w-md text-base leading-8 text-blue-100/90">
                Un espacio de aprendizaje y desarrollo de habilidades para
                fortalecer la comunicación y el servicio institucional.
              </p>
            </div>
          </div>

          <div className="relative z-10 mt-16 border-t border-white/15 pt-6">
            <p className="text-sm font-medium text-white/90">
              Formación para comunicar con propósito
            </p>
            <p className="mt-2 text-xs text-blue-200">
              Academia DECOM · Distrito 34
            </p>
          </div>
        </section>

        {/* PANEL DE ACCESO */}
        <section
          className={`relative flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-16 ${
            isDark ? "bg-[#1C2B3D] text-white" : "bg-white text-[#102D4D]"
          }`}
        >

          {/* SELECTOR DE TEMA */}
          <div className="absolute right-6 top-6 flex items-center gap-1 rounded-full border border-gray-500/20 p-1">
            <button
              type="button"
              onClick={() => changeTheme("light")}
              title="Tema claro"
              aria-label="Tema claro"
              className={`rounded-full px-3 py-2 text-sm transition ${
                theme === "light" ? "bg-[#087DB5] text-white" : "opacity-60 hover:opacity-100"
              }`}
            >
              ☀
            </button>

            <button
              type="button"
              onClick={() => changeTheme("dark")}
              title="Tema oscuro"
              aria-label="Tema oscuro"
              className={`rounded-full px-3 py-2 text-sm transition ${
                theme === "dark" ? "bg-[#087DB5] text-white" : "opacity-60 hover:opacity-100"
              }`}
            >
              ☾
            </button>

            <button
              type="button"
              onClick={() => changeTheme("system")}
              title="Tema automático"
              aria-label="Tema automático"
              className={`rounded-full px-3 py-2 text-sm transition ${
                theme === "system" ? "bg-[#087DB5] text-white" : "opacity-60 hover:opacity-100"
              }`}
            >
              ◐
            </button>
          </div>

          <div className="mx-auto w-full max-w-md">

            <div className="mb-10">
              <p className="mb-3 text-xs font-bold tracking-[0.25em] text-[#19A7A0]">
                BIENVENIDO
              </p>

              <h2 className="mb-3 text-3xl font-bold">
                Inicia sesión
              </h2>

              <p className={`text-sm leading-6 ${
                isDark ? "text-gray-300" : "text-gray-500"
              }`}>
                Accede a tu espacio de formación institucional.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">

              {/* CORREO */}
              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-semibold"
                >
                  Correo electrónico
                </label>

                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nombre@correo.com"
                  className={`w-full rounded-xl border px-4 py-3.5 text-sm outline-none transition focus:border-[#087DB5] focus:ring-2 focus:ring-[#087DB5]/20 ${
                    isDark
                      ? "border-gray-600 bg-[#101B2A] text-white placeholder:text-gray-500"
                      : "border-gray-200 bg-[#F8FAFC] text-[#102D4D] placeholder:text-gray-400"
                  }`}
                />
              </div>

              {/* CONTRASEÑA */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label
                    htmlFor="password"
                    className="text-sm font-semibold"
                  >
                    Contraseña
                  </label>
                </div>

                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Ingresa tu contraseña"
                    className={`w-full rounded-xl border px-4 py-3.5 pr-20 text-sm outline-none transition focus:border-[#087DB5] focus:ring-2 focus:ring-[#087DB5]/20 ${
                      isDark
                        ? "border-gray-600 bg-[#101B2A] text-white placeholder:text-gray-500"
                        : "border-gray-200 bg-[#F8FAFC] text-[#102D4D] placeholder:text-gray-400"
                    }`}
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#087DB5] hover:text-[#19A7A0]"
                  >
                    {showPassword ? "Ocultar" : "Mostrar"}
                  </button>
                </div>
              </div>

              {/* RECUPERACIÓN */}
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleRecovery}
                  disabled={isRecovering}
                  className="text-sm font-semibold text-[#087DB5] transition hover:text-[#19A7A0] disabled:opacity-50"
                >
                  {isRecovering ? "Enviando..." : "¿Olvidaste tu contraseña?"}
                </button>
              </div>

              {/* MENSAJES */}
              {message && (
                <div
                  role="status"
                  className={`rounded-xl border p-3 text-sm ${
                    messageType === "error"
                      ? "border-red-300 bg-red-50 text-red-700"
                      : messageType === "success"
                      ? "border-green-300 bg-green-50 text-green-700"
                      : "border-blue-300 bg-blue-50 text-blue-700"
                  }`}
                >
                  {message}
                </div>
              )}

              {/* BOTÓN */}
              <button
                type="submit"
                disabled={isLoading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#087DB5] px-5 py-4 text-sm font-bold text-white shadow-lg shadow-[#087DB5]/20 transition hover:bg-[#066A9B] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoading ? "Verificando acceso..." : "Ingresar"}
                {!isLoading && <span aria-hidden="true">→</span>}
              </button>
            </form>

            <div className={`mt-10 border-t pt-6 text-center ${
              isDark ? "border-gray-600" : "border-gray-100"
            }`}>
              <p className={`text-xs leading-6 ${
                isDark ? "text-gray-400" : "text-gray-500"
              }`}>
                El acceso está habilitado únicamente para integrantes
                autorizados de la Academia DECOM.
              </p>

              <p className="mt-4 text-xs font-semibold tracking-wide text-[#087DB5]">
                ACADEMIA DECOM
              </p>

              <p className={`mt-1 text-xs ${
                isDark ? "text-gray-500" : "text-gray-400"
              }`}>
                Formación institucional
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
