
"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Theme = "light" | "dark" | "system";

type UserRole = {
  role_key: string;
  name: string;
};

type Area = {
  id: string;
  name: string;
  description: string | null;
  status: "active" | "inactive";
  created_at: string;
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

  // Gestión de áreas.
  const [areas, setAreas] = useState<Area[]>([]);
  const [areasLoading, setAreasLoading] = useState(false);
  const [savingArea, setSavingArea] = useState(false);

  const [areaName, setAreaName] = useState("");
  const [areaDescription, setAreaDescription] = useState("");
  const [editingAreaId, setEditingAreaId] = useState<string | null>(null);

  const [areaSearch, setAreaSearch] = useState("");
  const [areaFilter, setAreaFilter] = useState<
    "all" | "active" | "inactive"
  >("all");

  const [areaMessage, setAreaMessage] = useState("");
  const [areaMessageType, setAreaMessageType] = useState<
    "success" | "error" | ""
  >("");

  const isNationalAdmin = roleKeys.includes("national_admin");
  const canManageInvitations = roleKeys.some((role) =>
    ["national_admin", "district_coordinator", "area_coordinator"].includes(role)
  );
  const canManageLibrary = isNationalAdmin || roleKeys.includes("academic_editor");
  const canManageAcademicCatalog = canManageLibrary;
  const canManageTutorAssignments = roleKeys.some((role) => ["national_admin", "academic_editor", "district_coordinator", "area_coordinator"].includes(role));

  function openAcademicModule(moduleName: string) {
    const isStudent = roleKeys.includes("member");
    const isTutor = roleKeys.includes("tutor");
    const adminDestination =
      moduleName === "Mi formación"
        ? "/dashboard/formacion"
        : moduleName === "Biblioteca"
          ? "/dashboard/biblioteca"
          : null;
    const canOpenAdminModule =
      isNationalAdmin || roleKeys.includes("academic_editor");

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

  // Consultar áreas.
  async function loadAreas() {
    setAreasLoading(true);

    try {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("areas")
        .select("id, name, description, status, created_at")
        .order("name", { ascending: true });

      if (error) {
        console.error("Error consultando áreas:", error);
        setAreaMessage(`No fue posible consultar las áreas: ${error.message}`);
        setAreaMessageType("error");
        return;
      }

      setAreas((data ?? []) as Area[]);
    } catch (error) {
      console.error("Error inesperado consultando áreas:", error);
      setAreaMessage("Ocurrió un error al consultar las áreas.");
      setAreaMessageType("error");
    } finally {
      setAreasLoading(false);
    }
  }

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

      // Cargar áreas para administración nacional.
      if (keys.includes("national_admin")) {
        const { data: areaData, error: areaError } = await supabase
          .from("areas")
          .select("id, name, description, status, created_at")
          .order("name", { ascending: true });

        if (!active) return;

        if (areaError) {
          console.error("Error cargando áreas:", areaError);
          setAreaMessage(`Error al cargar áreas: ${areaError.message}`);
          setAreaMessageType("error");
        } else {
          setAreas((areaData ?? []) as Area[]);
        }
      }
    }

    checkSession();

    return () => {
      active = false;
    };
  }, [router]);

  // Limpiar formulario.
  function resetAreaForm() {
    setAreaName("");
    setAreaDescription("");
    setEditingAreaId(null);
  }

  // Crear o actualizar área.
  async function handleSaveArea(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isNationalAdmin || savingArea) return;

    const cleanName = areaName.trim();
    const cleanDescription = areaDescription.trim();

    if (!cleanName) {
      setAreaMessage("El nombre del área es obligatorio.");
      setAreaMessageType("error");
      return;
    }

    if (cleanName.length > 150) {
      setAreaMessage("El nombre no puede superar 150 caracteres.");
      setAreaMessageType("error");
      return;
    }

    if (cleanDescription.length > 1000) {
      setAreaMessage("La descripción no puede superar 1000 caracteres.");
      setAreaMessageType("error");
      return;
    }

    const duplicate = areas.some(
      (area) =>
        area.id !== editingAreaId &&
        area.name.trim().toLocaleLowerCase("es") ===
          cleanName.toLocaleLowerCase("es")
    );

    if (duplicate) {
      setAreaMessage("Ya existe un área con ese nombre.");
      setAreaMessageType("error");
      return;
    }

    setSavingArea(true);
    setAreaMessage("");
    setAreaMessageType("");

    try {
      const supabase = createClient();

      if (editingAreaId) {
        const { error } = await supabase
          .from("areas")
          .update({
            name: cleanName,
            description: cleanDescription || null,
          })
          .eq("id", editingAreaId);

        if (error) {
          console.error("Error actualizando área:", error);
          setAreaMessage(`No se pudo actualizar el área: ${error.message}`);
          setAreaMessageType("error");
          return;
        }

        setAreaMessage(`El área "${cleanName}" fue actualizada correctamente.`);
      } else {
        const { error } = await supabase.from("areas").insert({
          name: cleanName,
          description: cleanDescription || null,
          status: "active",
        });

        if (error) {
          console.error("Error creando área:", error);
          setAreaMessage(`No se pudo crear el área: ${error.message}`);
          setAreaMessageType("error");
          return;
        }

        setAreaMessage(`El área "${cleanName}" fue registrada correctamente.`);
      }

      setAreaMessageType("success");
      resetAreaForm();
      await loadAreas();
    } catch (error) {
      console.error("Error inesperado guardando área:", error);
      setAreaMessage("Ocurrió un error inesperado al guardar el área.");
      setAreaMessageType("error");
    } finally {
      setSavingArea(false);
    }
  }

  // Cargar un área en el formulario para editarla.
  function handleEditArea(area: Area) {
    setEditingAreaId(area.id);
    setAreaName(area.name);
    setAreaDescription(area.description ?? "");
    setAreaMessage("");
    setAreaMessageType("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  // Activar o desactivar un área.
  async function handleToggleAreaStatus(area: Area) {
    if (!isNationalAdmin) return;

    const newStatus = area.status === "active" ? "inactive" : "active";

    const confirmation =
      newStatus === "inactive"
        ? `¿Deseas desactivar el área "${area.name}"?`
        : `¿Deseas activar nuevamente el área "${area.name}"?`;

    if (!window.confirm(confirmation)) return;

    try {
      const supabase = createClient();

      const { error } = await supabase
        .from("areas")
        .update({ status: newStatus })
        .eq("id", area.id);

      if (error) {
        console.error("Error cambiando estado:", error);
        setAreaMessage(`No se pudo cambiar el estado: ${error.message}`);
        setAreaMessageType("error");
        return;
      }

      setAreaMessage(
        `El área "${area.name}" ahora está ${
          newStatus === "active" ? "activa" : "inactiva"
        }.`
      );
      setAreaMessageType("success");

      await loadAreas();
    } catch (error) {
      console.error("Error inesperado cambiando estado:", error);
      setAreaMessage("Ocurrió un error al cambiar el estado del área.");
      setAreaMessageType("error");
    }
  }

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

  const filteredAreas = areas.filter((area) => {
    const matchesSearch = area.name
      .toLocaleLowerCase("es")
      .includes(areaSearch.trim().toLocaleLowerCase("es"));

    const matchesFilter =
      areaFilter === "all" || area.status === areaFilter;

    return matchesSearch && matchesFilter;
  });

  const activeAreas = areas.filter(
    (area) => area.status === "active"
  ).length;

  const inactiveAreas = areas.filter(
    (area) => area.status === "inactive"
  ).length;

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

            {/* GESTIÓN DE ÁREAS */}
            {isNationalAdmin && (
              <section
                className={`${surface} mt-7 rounded-2xl border ${borderColor} p-5 md:p-7`}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-[#087DB5]">
                      Administración académica
                    </p>

                    <h3 className="mt-2 text-xl font-bold">
                      Áreas de formación
                    </h3>

                    <p className={`mt-2 text-sm ${secondaryText}`}>
                      Organiza y administra las áreas académicas de Academia
                      DECOM.
                    </p>
                  </div>

                  <div className="rounded-xl bg-[#087DB5]/10 px-5 py-3">
                    <p className="text-xs font-semibold text-[#087DB5]">
                      Áreas registradas
                    </p>
                    <p className="mt-1 text-2xl font-bold text-[#087DB5]">
                      {areas.length}
                    </p>
                  </div>
                </div>

                {/* INDICADORES */}
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <div className={`rounded-xl border ${borderColor} p-4`}>
                    <p className={`text-xs font-medium ${secondaryText}`}>
                      Áreas activas
                    </p>
                    <p className="mt-1 text-2xl font-bold text-emerald-600">
                      {activeAreas}
                    </p>
                  </div>

                  <div className={`rounded-xl border ${borderColor} p-4`}>
                    <p className={`text-xs font-medium ${secondaryText}`}>
                      Áreas inactivas
                    </p>
                    <p className="mt-1 text-2xl font-bold text-slate-500">
                      {inactiveAreas}
                    </p>
                  </div>
                </div>

                {/* FORMULARIO */}
                <div className={`mt-7 border-t ${borderColor} pt-6`}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h4 className="font-bold">
                        {editingAreaId ? "Editar área" : "Registrar nueva área"}
                      </h4>

                      <p className={`mt-1 text-sm ${secondaryText}`}>
                        Define el nombre y la descripción del área.
                      </p>
                    </div>

                    {editingAreaId && (
                      <button
                        type="button"
                        onClick={resetAreaForm}
                        className={`rounded-xl border ${borderColor} px-4 py-2 text-sm font-semibold ${secondaryText}`}
                      >
                        Cancelar edición
                      </button>
                    )}
                  </div>

                  <form
                    onSubmit={handleSaveArea}
                    className="mt-5 space-y-4"
                  >
                    <div>
                      <label
                        htmlFor="areaName"
                        className="mb-2 block text-sm font-semibold"
                      >
                        Nombre del área *
                      </label>

                      <input
                        id="areaName"
                        type="text"
                        value={areaName}
                        onChange={(event) => {
                          setAreaName(event.target.value);
                          setAreaMessage("");
                          setAreaMessageType("");
                        }}
                        placeholder="Ejemplo: Medios Audiovisuales"
                        maxLength={150}
                        required
                        disabled={savingArea}
                        className={`w-full rounded-xl border ${borderColor} ${background} px-4 py-3 text-sm outline-none transition focus:border-[#087DB5] focus:ring-2 focus:ring-[#087DB5]/20 disabled:opacity-50`}
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="areaDescription"
                        className="mb-2 block text-sm font-semibold"
                      >
                        Descripción
                      </label>

                      <textarea
                        id="areaDescription"
                        value={areaDescription}
                        onChange={(event) => {
                          setAreaDescription(event.target.value);
                          setAreaMessage("");
                          setAreaMessageType("");
                        }}
                        placeholder="Describe el propósito y el campo de formación de esta área."
                        maxLength={1000}
                        rows={4}
                        disabled={savingArea}
                        className={`w-full resize-y rounded-xl border ${borderColor} ${background} px-4 py-3 text-sm outline-none transition focus:border-[#087DB5] focus:ring-2 focus:ring-[#087DB5]/20 disabled:opacity-50`}
                      />

                      <p className={`mt-1 text-right text-xs ${secondaryText}`}>
                        {areaDescription.length}/1000
                      </p>
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={savingArea || areasLoading || !areaName.trim()}
                        className="rounded-xl bg-[#087DB5] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#066895] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {savingArea
                          ? "Guardando..."
                          : editingAreaId
                          ? "Guardar cambios"
                          : "Registrar área"}
                      </button>
                    </div>
                  </form>

                  {/* MENSAJES */}
                  {areaMessage && (
                    <div
                      role="status"
                      className={`mt-5 rounded-xl p-4 text-sm ${
                        areaMessageType === "success"
                          ? "bg-emerald-50 text-emerald-800"
                          : "bg-red-50 text-red-700"
                      }`}
                    >
                      {areaMessage}
                    </div>
                  )}
                </div>

                {/* LISTADO */}
                <div className={`mt-8 border-t ${borderColor} pt-6`}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h4 className="font-bold">Áreas registradas</h4>
                      <p className={`mt-1 text-sm ${secondaryText}`}>
                        Consulta y administra las áreas de formación.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={loadAreas}
                      disabled={areasLoading}
                      className="rounded-xl border border-[#087DB5] px-4 py-2 text-sm font-semibold text-[#087DB5] hover:bg-[#087DB5]/5 disabled:opacity-50"
                    >
                      {areasLoading ? "Actualizando..." : "Actualizar"}
                    </button>
                  </div>

                  {/* BUSCADOR Y FILTRO */}
                  <div className="mt-5 grid gap-3 md:grid-cols-2">
                    <input
                      type="search"
                      value={areaSearch}
                      onChange={(event) => setAreaSearch(event.target.value)}
                      placeholder="Buscar área por nombre..."
                      className={`w-full rounded-xl border ${borderColor} ${background} px-4 py-3 text-sm outline-none focus:border-[#087DB5] focus:ring-2 focus:ring-[#087DB5]/20`}
                    />

                    <select
                      value={areaFilter}
                      onChange={(event) =>
                        setAreaFilter(
                          event.target.value as "all" | "active" | "inactive"
                        )
                      }
                      className={`w-full rounded-xl border ${borderColor} ${background} px-4 py-3 text-sm outline-none focus:border-[#087DB5]`}
                    >
                      <option value="all">Todos los estados</option>
                      <option value="active">Activas</option>
                      <option value="inactive">Inactivas</option>
                    </select>
                  </div>

                  {/* RESULTADOS */}
                  {areasLoading && areas.length === 0 ? (
                    <p className={`py-8 text-center text-sm ${secondaryText}`}>
                      Consultando áreas...
                    </p>
                  ) : filteredAreas.length === 0 ? (
                    <div
                      className={`mt-5 rounded-xl border ${borderColor} p-6 text-center`}
                    >
                      <p className="font-semibold">
                        {areas.length === 0
                          ? "Todavía no hay áreas registradas."
                          : "No se encontraron áreas."}
                      </p>

                      <p className={`mt-2 text-sm ${secondaryText}`}>
                        {areas.length === 0
                          ? "Utiliza el formulario para registrar la primera área."
                          : "Prueba con otro nombre o cambia el filtro de estado."}
                      </p>
                    </div>
                  ) : (
                    <div className="mt-5">
                      <p className={`mb-3 text-xs ${secondaryText}`}>
                        Desliza horizontalmente la tabla si no puedes
                        visualizar todas las columnas.
                      </p>

                      <div className={`overflow-x-auto rounded-xl border ${borderColor}`}>
                        <table className="w-full min-w-[850px] table-fixed text-left text-sm">
                          <colgroup>
                            <col className="w-[22%]" />
                            <col className="w-[34%]" />
                            <col className="w-[16%]" />
                            <col className="w-[28%]" />
                          </colgroup>

                          <thead>
                            <tr className={`${background} ${secondaryText}`}>
                              <th className="px-4 py-4 font-semibold">
                                Área
                              </th>

                              <th className="px-4 py-4 font-semibold">
                                Descripción
                              </th>

                              <th className="px-4 py-4 font-semibold">
                                Estado
                              </th>

                              <th className="px-4 py-4 font-semibold">
                                Acciones
                              </th>
                            </tr>
                          </thead>

                          <tbody>
                            {filteredAreas.map((area) => (
                              <tr
                                key={area.id}
                                className={`border-t ${borderColor} transition hover:bg-[#087DB5]/5`}
                              >
                                <td className="break-words px-4 py-5 align-middle font-semibold">
                                  {area.name}
                                </td>

                                <td
                                  className={`break-words px-4 py-5 align-middle ${secondaryText}`}
                                >
                                  {area.description || "Sin descripción"}
                                </td>

                                <td className="px-4 py-5 align-middle">
                                  <span
                                    className={`inline-flex whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold ${
                                      area.status === "active"
                                        ? "bg-emerald-100 text-emerald-700"
                                        : "bg-slate-100 text-slate-600"
                                    }`}
                                  >
                                    {area.status === "active"
                                      ? "Activa"
                                      : "Inactiva"}
                                  </span>
                                </td>

                                <td className="px-4 py-5 align-middle">
                                  <div className="flex items-center gap-3 whitespace-nowrap">
                                    <button
                                      type="button"
                                      onClick={() => handleEditArea(area)}
                                      className="inline-flex items-center justify-center rounded-lg bg-[#087DB5]/10 px-3 py-2 text-xs font-semibold text-[#087DB5] transition hover:bg-[#087DB5]/20"
                                    >
                                      Editar
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleToggleAreaStatus(area)
                                      }
                                      className={`inline-flex items-center justify-center rounded-lg px-3 py-2 text-xs font-semibold transition ${
                                        area.status === "active"
                                          ? "bg-amber-50 text-amber-700 hover:bg-amber-100"
                                          : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                      }`}
                                    >
                                      {area.status === "active"
                                        ? "Desactivar"
                                        : "Activar"}
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <p className={`mt-4 text-xs ${secondaryText}`}>
                    Las áreas inactivas se conservan en la base de datos. No se
                    eliminan las asignaciones históricas de sus integrantes.
                  </p>
                </div>
              </section>
            )}

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
