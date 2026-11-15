
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Theme = "light" | "dark" | "system";

type UserRole = {
  role_key: string;
  name: string;
};

const modules = [
  {
    name: "Mi formación",
    description: "Continúa tus procesos de aprendizaje.",
    icon: "▤",
    color: "#087DB5",
  },
  {
    name: "Biblioteca",
    description: "Consulta documentos y recursos académicos.",
    icon: "▣",
    color: "#19A7A0",
  },
  {
    name: "Evaluaciones",
    description: "Desarrolla actividades y pruebas.",
    icon: "✓",
    color: "#D99A24",
  },
  {
    name: "Seguimiento",
    description: "Consulta tu progreso académico.",
    icon: "◷",
    color: "#8064B5",
  },
  {
    name: "Reconocimientos",
    description: "Consulta tus logros institucionales.",
    icon: "✧",
    color: "#D18A43",
  },
];

export default function DashboardPage() {
  const router = useRouter();

  const [theme, setTheme] = useState<Theme>("system");
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");

  const [email, setEmail] = useState("");
  const [roleName, setRoleName] = useState("Consultando permisos...");
  const [roleKeys, setRoleKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  const [permissionResult, setPermissionResult] = useState<
    "checking" | "authorized" | "denied" | "error"
  >("checking");

  const isNationalAdmin = roleKeys.includes("national_admin");
  const canManageInvitations = roleKeys.some((role) =>
    ["national_admin", "district_coordinator", "area_coordinator"].includes(role)
  );
  const canManageLibrary = isNationalAdmin || roleKeys.includes("academic_editor");
  const canManageAcademicCatalog = canManageLibrary;
  const canManageTutorAssignments = roleKeys.some((role) => ["national_admin", "academic_editor", "district_coordinator", "area_coordinator"].includes(role));
  const canOpenAdminModule = isNationalAdmin || roleKeys.includes("academic_editor");

  function openAcademicModule(moduleName: string) {
    const isStudent = roleKeys.includes("member");
    const isTutor = roleKeys.includes("tutor");
    const adminDestination =
      moduleName === "Mi formación"
        ? "/dashboard/formacion"
        : moduleName === "Biblioteca"
          ? "/dashboard/biblioteca"
          : null;
    if (adminDestination && canOpenAdminModule) {
      router.push(adminDestination);
      return;
    }

    if (moduleName === "Seguimiento" && isTutor) {
      router.push("/dashboard/tutor");
      return;
    }

    const hasManagementRole = roleKeys.some((role) =>
      ["national_admin", "district_coordinator", "area_coordinator", "academic_editor", "local_responsible"].includes(role)
    );
    if (moduleName === "Seguimiento" && hasManagementRole && !isTutor) {
      router.push("/dashboard/espacio");
      return;
    }
    if (moduleName === "Mi formación" && hasManagementRole && !isStudent) {
      router.push("/dashboard/espacio");
      return;
    }

    if (!isStudent) return;

    const destinations: Record<string, string> = {
      "Mi formación": "/dashboard/estudiante/formacion",
      Biblioteca: "/dashboard/estudiante/biblioteca",
      Evaluaciones: "/dashboard/estudiante/evaluaciones",
      Seguimiento: "/dashboard/estudiante",
      Reconocimientos: "/dashboard/estudiante/reconocimientos",
    };
    const destination = destinations[moduleName];
    if (destination) router.push(destination);
  }

  // Permisos del módulo de reubicaciones.
  const canManageTransfers =
    roleKeys.includes("national_admin") ||
    roleKeys.includes("district_coordinator") ||
    roleKeys.includes("area_coordinator");

  // Cargar preferencia de tema.
  useEffect(() => {
    const savedTheme = localStorage.getItem("academia-theme") as Theme | null;

    if (
      savedTheme === "light" ||
      savedTheme === "dark" ||
      savedTheme === "system"
    ) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTheme(savedTheme);
    }
  }, []);

  // Gestionar tema claro, oscuro y automático.
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");

    function updateTheme() {
      setResolvedTheme(
        theme === "system" ? (media.matches ? "dark" : "light") : theme
      );
    }

    updateTheme();

    if (theme === "system") {
      media.addEventListener("change", updateTheme);
      return () => media.removeEventListener("change", updateTheme);
    }
  }, [theme]);

  // Verificar sesión, autorización y roles.
  useEffect(() => {
    let active = true;

    async function checkSession() {
      const supabase = createClient();

      const { data, error } = await supabase.auth.getUser();

      if (!active) return;

      if (error || !data.user) {
        router.replace("/");
        return;
      }

      setEmail(data.user.email ?? "");

      const { data: permissionTest, error: permissionError } =
        await supabase.rpc("has_role", {
          requested_role: "national_admin",
        });

      if (!active) return;

      console.log("Prueba de autorización:", {
        permissionTest,
        permissionError,
      });

      if (permissionError) {
        setPermissionResult("error");
      } else if (permissionTest === true) {
        setPermissionResult("authorized");
      } else {
        setPermissionResult("denied");
      }

      const { data: assignments, error: assignmentError } = await supabase
        .from("user_role_assignments")
        .select("role_id")
        .eq("user_id", data.user.id);

      if (!active) return;

      if (assignmentError) {
        console.error("Error consultando asignaciones:", assignmentError);
        setRoleName("No se pudo consultar el rol");
        setLoading(false);
        return;
      }

      if (!assignments || assignments.length === 0) {
        setRoleName("Sin rol asignado");
        setRoleKeys([]);
        setLoading(false);
        return;
      }

      const roleIds = assignments.map(
        (assignment) => assignment.role_id
      );

      const { data: roles, error: rolesError } = await supabase
        .from("roles")
        .select("role_key, name")
        .in("id", roleIds);

      if (!active) return;

      if (rolesError) {
        console.error("Error consultando roles:", rolesError);
        setRoleName("No se pudo consultar el rol");
        setLoading(false);
        return;
      }

      const userRoles = (roles ?? []) as UserRole[];
      const keys = userRoles.map((role) => role.role_key);

      setRoleKeys(keys);

      setRoleName(
        userRoles.length > 0
          ? userRoles.map((role) => role.name).join(", ")
          : "Sin rol asignado"
      );

      setLoading(false);


    }

    checkSession();

    return () => {
      active = false;
    };
  }, [router]);

  // Cambiar tema.
  function changeTheme(newTheme: Theme) {
    setTheme(newTheme);
    localStorage.setItem("academia-theme", newTheme);
  }

  // Cerrar sesión.
  async function handleLogout() {
    setLoggingOut(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signOut();

    if (error) {
      setLoggingOut(false);
      alert("No fue posible cerrar la sesión. Inténtalo nuevamente.");
      return;
    }

    router.replace("/");
    router.refresh();
  }

  const dark = resolvedTheme === "dark";

  const surface = dark ? "bg-[#1C2B3D]" : "bg-white";
  const background = dark ? "bg-[#101B2A]" : "bg-[#F4F7FA]";
  const primaryText = dark ? "text-white" : "text-[#102D4D]";
  const secondaryText = dark ? "text-slate-400" : "text-slate-500";
  const borderColor = dark ? "border-slate-700" : "border-slate-100";

  // Pantalla de carga.
  if (loading) {
    return (
      <main
        className={`flex min-h-screen items-center justify-center ${background}`}
      >
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-[#087DB5]/20 border-t-[#087DB5]" />
          <p className={secondaryText}>Verificando tu sesión...</p>
        </div>
      </main>
    );
  }

  return (
    <main className={`min-h-screen ${background} ${primaryText}`}>
      <div className="flex min-h-screen">
        {/* MENÚ LATERAL */}
        <aside
          className={`hidden w-64 shrink-0 flex-col border-r ${borderColor} ${surface} lg:flex`}
        >
          <div className="border-b border-inherit p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#087DB5] text-2xl text-white">
                ✦
              </div>

              <div>
                <h1 className="text-sm font-bold tracking-wide">
                  ACADEMIA DECOM
                </h1>
                <p className={`text-xs ${secondaryText}`}>
                  Plataforma de formación
                </p>
              </div>
            </div>
          </div>

          <nav className="flex-1 space-y-2 p-4">
            <p
              className={`mb-4 px-3 text-xs font-bold uppercase tracking-wider ${secondaryText}`}
            >
              Menú principal
            </p>

            <a
              href="/dashboard"
              className="flex items-center gap-3 rounded-xl bg-[#087DB5]/10 px-4 py-3 text-sm font-semibold text-[#087DB5]"
            >
              <span>⌂</span> Inicio
            </a>

            {modules.map((module) => (
              <button
                key={module.name}
                type="button"
                onClick={() => openAcademicModule(module.name)}
                disabled={
                  !roleKeys.includes("member") &&
                  !(module.name === "Seguimiento" && roleKeys.includes("tutor")) &&
                  !(canOpenAdminModule && (module.name === "Mi formación" || module.name === "Biblioteca"))
                }
                title={
                  roleKeys.includes("member") ||
                  (module.name === "Seguimiento" && roleKeys.includes("tutor")) ||
                  (canOpenAdminModule && (module.name === "Mi formación" || module.name === "Biblioteca"))
                    ? module.description
                    : "No tienes un perfil académico habilitado para este módulo"
                }
                className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm transition hover:bg-[#087DB5]/10 hover:text-[#087DB5] disabled:cursor-not-allowed disabled:opacity-50 ${secondaryText}`}
              >
                <span>{module.icon}</span>
                {module.name}
              </button>
            ))}

            <div className={`my-5 border-t ${borderColor}`} />

            <p
              className={`px-3 text-xs font-bold uppercase tracking-wider ${secondaryText}`}
            >
              Institucional
            </p>

            <div
              className={`mt-2 flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm ${
                isNationalAdmin
                  ? "bg-[#087DB5]/10 font-semibold text-[#087DB5]"
                  : `${secondaryText} opacity-50`
              }`}
            >
              <span>⚙</span> Administración
            </div>

            {canManageTutorAssignments && (
              <a
                href="/dashboard/administracion/tutores"
                className="mt-2 flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium text-slate-600 transition hover:bg-[#087DB5]/10 hover:text-[#087DB5] dark:text-slate-300 dark:hover:bg-[#087DB5]/20 dark:hover:text-[#19A7A0]"
              >
                <span className="text-lg">♙</span>
                <span>Asignación de tutores</span>
              </a>
            )}

            {canManageAcademicCatalog && (
              <a
                href="/dashboard/administracion/actividades"
                className="mt-2 flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium text-slate-600 transition hover:bg-[#087DB5]/10 hover:text-[#087DB5] dark:text-slate-300 dark:hover:bg-[#087DB5]/20 dark:hover:text-[#19A7A0]"
              >
                <span className="text-lg">✓</span>
                <span>Actividades y evaluaciones</span>
              </a>
            )}

            {canManageAcademicCatalog && (
              <a
                href="/dashboard/administracion/catalogo"
                className="mt-2 flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium text-slate-600 transition hover:bg-[#087DB5]/10 hover:text-[#087DB5] dark:text-slate-300 dark:hover:bg-[#087DB5]/20 dark:hover:text-[#19A7A0]"
              >
                <span className="text-lg">▤</span>
                <span>Catálogo académico</span>
              </a>
            )}

            {canManageLibrary && (
              <a
                href="/dashboard/administracion/biblioteca"
                className="mt-2 flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium text-slate-600 transition hover:bg-[#087DB5]/10 hover:text-[#087DB5] dark:text-slate-300 dark:hover:bg-[#087DB5]/20 dark:hover:text-[#19A7A0]"
              >
                <span className="text-lg">▣</span>
                <span>Administrar biblioteca</span>
              </a>
            )}

            {canManageInvitations && (
              <a
                href="/dashboard/invitaciones"
                className="mt-2 flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium text-slate-600 transition hover:bg-[#087DB5]/10 hover:text-[#087DB5] dark:text-slate-300 dark:hover:bg-[#087DB5]/20 dark:hover:text-[#19A7A0]"
              >
                <span className="text-lg">✉</span>
                <span>Invitaciones</span>
              </a>
            )}

            {/* REUBICACIÓN DE CREYENTES */}
            {canManageTransfers && (
              <a
                href="/dashboard/reubicaciones"
                className="mt-2 flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium text-slate-600 transition hover:bg-[#087DB5]/10 hover:text-[#087DB5] dark:text-slate-300 dark:hover:bg-[#087DB5]/20 dark:hover:text-[#19A7A0]"
              >
                <span className="text-lg">⇄</span>
                <span>Reubicación de creyentes</span>
              </a>
            )}
          </nav>

          {/* INFORMACIÓN DEL USUARIO */}
          <div className={`border-t ${borderColor} p-4`}>
            <p className={`truncate text-xs ${secondaryText}`}>
              Sesión iniciada como
            </p>

            <p className="mt-1 truncate text-sm font-semibold">{email}</p>

            <p className="mt-1 text-xs font-semibold text-[#087DB5]">
              {roleName}
            </p>

            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="mt-4 w-full rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-500 hover:bg-red-50 disabled:opacity-50"
            >
              {loggingOut ? "Cerrando..." : "Cerrar sesión"}
            </button>
          </div>
        </aside>

        {/* CONTENIDO PRINCIPAL */}
        <section className="min-w-0 flex-1">
          {/* ENCABEZADO */}
          <header
            className={`flex items-center justify-between border-b ${borderColor} ${surface} px-5 py-4 md:px-8`}
          >
            <div>
              <p className={`text-xs font-medium ${secondaryText}`}>
                ACADEMIA DECOM
              </p>

              <h2 className="mt-1 text-lg font-bold">Panel principal</h2>
            </div>

            <div className="flex items-center gap-2">
              <div
                className={`flex items-center gap-1 rounded-xl p-1 ${background}`}
              >
                {(["light", "dark", "system"] as Theme[]).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => changeTheme(item)}
                    title={
                      item === "light"
                        ? "Tema claro"
                        : item === "dark"
                        ? "Tema oscuro"
                        : "Automático"
                    }
                    className={`rounded-lg px-2.5 py-2 text-sm ${
                      theme === item
                        ? "bg-[#087DB5] text-white"
                        : secondaryText
                    }`}
                  >
                    {item === "light"
                      ? "☀"
                      : item === "dark"
                      ? "☾"
                      : "◐"}
                  </button>
                ))}
              </div>

              <div className="hidden rounded-xl bg-[#087DB5]/10 px-3 py-2 text-sm font-semibold text-[#087DB5] sm:block">
                {email}
              </div>

              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-500 hover:bg-red-100"
              >
                Salir
              </button>
            </div>
          </header>

          {/* PANEL */}
          <div className="mx-auto max-w-7xl p-5 md:p-8">
            {/* BIENVENIDA */}
            <section className="relative overflow-hidden rounded-2xl bg-[#102D4D] p-7 text-white md:p-10">
              <div className="absolute -right-16 -top-24 h-72 w-72 rounded-full border border-white/10" />
              <div className="absolute -bottom-40 right-32 h-72 w-72 rounded-full border border-white/10" />

              <div className="relative z-10">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#19A7A0]">
                  Formación institucional
                </p>

                <h2 className="mt-4 text-3xl font-bold md:text-4xl">
                  Bienvenido a Academia DECOM
                </h2>

                <p className="mt-4 max-w-2xl text-sm leading-7 text-blue-100">
                  Un espacio para aprender, desarrollar habilidades y
                  fortalecer el servicio de comunicación institucional.
                </p>

                <div className="mt-7 h-1 w-16 rounded-full bg-[#F2B544]" />

                <p className="mt-4 text-sm text-blue-200">
                  Formación para comunicar con propósito.
                </p>
              </div>
            </section>

            {/* PERFIL */}
            <section
              className={`${surface} mt-7 rounded-2xl border ${borderColor} p-5`}
            >
              <p
                className={`text-xs font-semibold uppercase tracking-wider ${secondaryText}`}
              >
                Tu perfil institucional
              </p>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold">{roleName}</h3>
                  <p className={`mt-1 text-sm ${secondaryText}`}>
                    Permisos asociados a tu cuenta.
                  </p>
                </div>

                {isNationalAdmin && (
                  <span className="rounded-full bg-[#087DB5]/10 px-3 py-2 text-xs font-bold text-[#087DB5]">
                    Administración nacional
                  </span>
                )}
              </div>
            </section>

            {/* SEGURIDAD */}
            <section
              className={`${surface} mt-5 rounded-2xl border ${borderColor} p-5`}
            >
              <p
                className={`text-xs font-semibold uppercase tracking-wider ${secondaryText}`}
              >
                Seguridad y permisos
              </p>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold">
                    Verificación de Administración nacional
                  </h3>

                  <p className={`mt-1 text-sm ${secondaryText}`}>
                    Comprobación de permisos mediante Supabase.
                  </p>
                </div>

                <span
                  className={`rounded-full px-3 py-2 text-xs font-bold ${
                    permissionResult === "authorized"
                      ? "bg-emerald-100 text-emerald-700"
                      : permissionResult === "denied"
                      ? "bg-red-100 text-red-700"
                      : permissionResult === "error"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {permissionResult === "authorized"
                    ? "Autorizado"
                    : permissionResult === "denied"
                    ? "Sin autorización"
                    : permissionResult === "error"
                    ? "Error de verificación"
                    : "Verificando..."}
                </span>
              </div>
            </section>

            {/* MÓDULOS */}
            <section className="mt-9">
              <div className="mb-5">
                <h3 className="text-xl font-bold">Tu espacio académico</h3>

                <p className={`mt-1 text-sm ${secondaryText}`}>
                  Accede a las herramientas de formación institucional.
                </p>
              </div>

              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {modules.map((module) => (
                  <article
                    key={module.name}
                    className={`${surface} rounded-2xl border ${borderColor} p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md`}
                  >
                    <div
                      className="flex h-12 w-12 items-center justify-center rounded-xl text-xl font-bold"
                      style={{
                        backgroundColor: `${module.color}18`,
                        color: module.color,
                      }}
                    >
                      {module.icon}
                    </div>

                    <h4 className="mt-5 font-bold">{module.name}</h4>

                    <p
                      className={`mt-2 min-h-10 text-sm leading-6 ${secondaryText}`}
                    >
                      {module.description}
                    </p>

                    <p className="mt-5 text-xs font-semibold text-[#087DB5]">
                      Próximamente
                    </p>
                  </article>
                ))}
              </div>
            </section>

            {/* PIE DE PÁGINA */}
            <footer className={`mt-12 border-t ${borderColor} py-6 text-center`}>
              <p className={`text-xs ${secondaryText}`}>
                Academia DECOM · Formación institucional
              </p>

              <p className={`mt-1 text-xs ${secondaryText}`}>
                Formación para comunicar con propósito
              </p>
            </footer>
          </div>
        </section>
      </div>
    </main>
  );
}
