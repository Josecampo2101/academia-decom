"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  ArrowLeftRight,
  Award,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Home,
  Library,
  LogOut,
  Mail,
  Menu,
  Monitor,
  Moon,
  Settings,
  Sun,
  UserRound,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { DashboardModuleCard } from "@/components/dashboard/dashboard-module-card";

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
    icon: BookOpen,
    color: "#087DB5",
  },
  {
    name: "Biblioteca",
    description: "Consulta documentos y recursos académicos.",
    icon: Library,
    color: "#19A7A0",
  },
  {
    name: "Evaluaciones",
    description: "Desarrolla actividades y pruebas.",
    icon: ClipboardCheck,
    color: "#D99A24",
  },
  {
    name: "Seguimiento",
    description: "Consulta tu progreso académico.",
    icon: Clock3,
    color: "#8064B5",
  },
  {
    name: "Reconocimientos",
    description: "Consulta tus logros institucionales.",
    icon: Award,
    color: "#D18A43",
  },
];

const dailyVerses = [
  {
    text: "Todo lo que hagáis, hacedlo de corazón, como para el Señor y no para los hombres.",
    reference: "Colosenses 3:23",
  },
  { text: "Hágase todo decentemente y con orden.", reference: "1 Corintios 14:40" },
  { text: "La respuesta suave quita la ira.", reference: "Proverbios 15:1" },
  {
    text: "Encomienda a Jehová tus obras, y tus pensamientos serán afirmados.",
    reference: "Proverbios 16:3",
  },
  { text: "El que es fiel en lo muy poco, también en lo más es fiel.", reference: "Lucas 16:10" },
  {
    text: "La blanda respuesta quita la ira; mas la palabra áspera hace subir el furor.",
    reference: "Proverbios 15:1",
  },
  { text: "Todo lo puedo en Cristo que me fortalece.", reference: "Filipenses 4:13" },
];

export default function DashboardPage() {
  const router = useRouter();

  const [theme, setTheme] = useState<Theme>("system");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [displayName, setDisplayName] = useState("Bienvenido");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [greeting, setGreeting] = useState("Bienvenido");
  const [dailyVerseIndex, setDailyVerseIndex] = useState(0);
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");

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
  const [areaFilter, setAreaFilter] = useState<"all" | "active" | "inactive">("all");

  const [areaMessage, setAreaMessage] = useState("");
  const [areaMessageType, setAreaMessageType] = useState<"success" | "error" | "">("");

  const isNationalAdmin = roleKeys.includes("national_admin");
  const canManageInvitations = roleKeys.some((role) =>
    ["national_admin", "district_coordinator", "area_coordinator"].includes(role),
  );
  const canManageLibrary = isNationalAdmin || roleKeys.includes("academic_editor");
  const canManageAcademicCatalog = canManageLibrary;
  const canManageTutorAssignments = roleKeys.some((role) =>
    ["national_admin", "academic_editor", "district_coordinator", "area_coordinator"].includes(
      role,
    ),
  );
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
      [
        "national_admin",
        "district_coordinator",
        "area_coordinator",
        "academic_editor",
        "local_responsible",
      ].includes(role),
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

  // Mantener la disponibilidad visual alineada con las rutas que abre openAcademicModule.
  function canOpenAcademicModule(moduleName: string) {
    const isStudent = roleKeys.includes("member");
    const isTutor = roleKeys.includes("tutor");
    const hasManagementRole = roleKeys.some((role) =>
      [
        "national_admin",
        "district_coordinator",
        "area_coordinator",
        "academic_editor",
        "local_responsible",
      ].includes(role),
    );

    if (canOpenAdminModule && (moduleName === "Mi formación" || moduleName === "Biblioteca"))
      return true;
    if (moduleName === "Seguimiento" && isTutor) return true;
    if (
      (moduleName === "Seguimiento" || moduleName === "Mi formación") &&
      hasManagementRole &&
      !(moduleName === "Mi formación" && isStudent)
    )
      return true;
    return isStudent;
  }

  // Permisos del módulo de reubicaciones.
  const canManageTransfers =
    roleKeys.includes("national_admin") ||
    roleKeys.includes("district_coordinator") ||
    roleKeys.includes("area_coordinator");

  // Restaurar y persistir la preferencia visual del menú lateral.
  useEffect(() => {
    const saved = localStorage.getItem("academia-sidebar-collapsed");
    if (saved === "true" || saved === "false") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSidebarCollapsed(saved === "true");
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("academia-sidebar-collapsed", String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  // Cargar preferencia de tema.
  useEffect(() => {
    const updateDailyContent = () => {
      const now = new Date();
      const hour = Number(
        new Intl.DateTimeFormat("en-US", {
          hour: "2-digit",
          hourCycle: "h23",
          timeZone: "America/Bogota",
        }).format(now),
      );
      setGreeting(
        hour >= 5 && hour < 12
          ? "Buenos días"
          : hour >= 12 && hour < 18
            ? "Buenas tardes"
            : "Buenas noches",
      );

      const localDay = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Bogota",
      }).format(now);
      const dayNumber = Math.floor(Date.parse(`${localDay}T00:00:00Z`) / 86_400_000);
      setDailyVerseIndex(
        ((dayNumber % dailyVerses.length) + dailyVerses.length) % dailyVerses.length,
      );
    };

    updateDailyContent();
    const interval = window.setInterval(updateDailyContent, 60_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const savedTheme = localStorage.getItem("academia-theme") as Theme | null;

    if (savedTheme === "light" || savedTheme === "dark" || savedTheme === "system") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTheme(savedTheme);
    }
  }, []);

  // Gestionar tema claro, oscuro y automático.
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");

    function updateTheme() {
      const nextTheme = theme === "system" ? (media.matches ? "dark" : "light") : theme;
      setResolvedTheme(nextTheme);
      document.documentElement.classList.toggle("dark", nextTheme === "dark");
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

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("full_name, phone, avatar_path")
        .eq("id", data.user.id)
        .maybeSingle();

      if (!active) return;

      if (profileError) {
        console.error("Error consultando el perfil institucional:", profileError);
        router.replace("/dashboard/perfil");
        return;
      }

      if (!profile || !profile.full_name?.trim() || !profile.phone?.trim()) {
        router.replace("/dashboard/perfil");
        return;
      }

      setDisplayName(profile.full_name.trim());

      if (profile.avatar_path) {
        const { data: avatar, error: avatarError } = await supabase.storage
          .from("decom-profile-avatars")
          .createSignedUrl(profile.avatar_path, 60 * 60);

        if (active && !avatarError && avatar?.signedUrl) {
          setAvatarUrl(avatar.signedUrl);
        }
      }

      const { data: permissionTest, error: permissionError } = await supabase.rpc("has_role", {
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

      const roleIds = assignments.map((assignment) => assignment.role_id);

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
        userRoles.length > 0 ? userRoles.map((role) => role.name).join(", ") : "Sin rol asignado",
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
        area.name.trim().toLocaleLowerCase("es") === cleanName.toLocaleLowerCase("es"),
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
        `El área "${area.name}" ahora está ${newStatus === "active" ? "activa" : "inactiva"}.`,
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

  const dailyVerse = dailyVerses[dailyVerseIndex];

  const dark = resolvedTheme === "dark";

  const surface = dark ? "bg-[#1C2B3D]" : "bg-surface";
  const background = dark ? "bg-[#101B2A]" : "bg-surface-muted";
  const primaryText = dark ? "text-white" : "text-foreground";
  const secondaryText = dark ? "text-muted-fg" : "text-muted-fg";
  const borderColor = dark ? "border-slate-700" : "border-line-soft";

  const filteredAreas = areas.filter((area) => {
    const matchesSearch = area.name
      .toLocaleLowerCase("es")
      .includes(areaSearch.trim().toLocaleLowerCase("es"));

    const matchesFilter = areaFilter === "all" || area.status === areaFilter;

    return matchesSearch && matchesFilter;
  });

  const activeAreas = areas.filter((area) => area.status === "active").length;

  const inactiveAreas = areas.filter((area) => area.status === "inactive").length;

  // Pantalla de carga.
  if (loading) {
    return (
      <main id="contenido" className={`flex min-h-screen items-center justify-center ${background}`}>
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-decom-blue/20 border-t-decom-blue" />
          <p className={secondaryText}>Verificando tu sesión...</p>
        </div>
      </main>
    );
  }

  return (
    <main id="contenido" className={`min-h-screen ${background} ${primaryText}`}>
      <div className="flex min-h-screen">
        {mobileMenuOpen && (
          <button
            type="button"
            aria-label="Cerrar menú"
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 z-40 bg-slate-950/55 backdrop-blur-[2px] lg:hidden"
          />
        )}
        {/* MENÚ LATERAL: persistente en escritorio y drawer en móvil. */}
        <aside
          data-collapsed={sidebarCollapsed}
          className={`${mobileMenuOpen ? "fixed inset-y-0 left-0 z-50 flex w-72 shadow-2xl" : "fixed inset-y-0 left-0 z-50 hidden w-72"} shrink-0 flex-col border-r transition-[width,transform] duration-200 lg:sticky lg:top-0 lg:z-20 lg:flex lg:h-screen lg:shadow-none ${sidebarCollapsed ? "lg:w-20" : "lg:w-64"} ${borderColor} ${surface}`}
        >
          <div className="border-b border-inherit p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#0B3970] text-sm font-black text-white">
                  D34
                </div>
                {!sidebarCollapsed && (
                  <div className="min-w-0">
                    <h1 className="text-xs font-bold tracking-wide">ESCUELA DE COMUNICACIONES</h1>
                    <p className={`text-xs ${secondaryText}`}>Distrito 34 · IPUC</p>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSidebarCollapsed((value) => !value)}
                aria-label={sidebarCollapsed ? "Expandir menú" : "Contraer menú"}
                title={sidebarCollapsed ? "Expandir menú" : "Contraer menú"}
                className={`hidden rounded-lg p-2 transition hover:bg-decom-blue/10 lg:inline-flex ${secondaryText}`}
              >
                {sidebarCollapsed ? (
                  <ChevronRight className="h-4 w-4" />
                ) : (
                  <ChevronLeft className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <nav className="flex-1 space-y-2 p-4">
            <p className={`mb-4 px-3 text-xs font-bold uppercase tracking-wider ${secondaryText}`}>
              {!sidebarCollapsed && "Menú principal"}
            </p>

            <a
              href="/dashboard"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 rounded-xl bg-decom-blue/10 px-4 py-3 text-sm font-semibold text-decom-blue-text"
            >
              <Home className="h-5 w-5 shrink-0" aria-hidden="true" />
              {!sidebarCollapsed && <span>Inicio</span>}
            </a>

            {modules.map((module) => (
              <button
                key={module.name}
                type="button"
                onClick={() => {
                  openAcademicModule(module.name);
                  setMobileMenuOpen(false);
                }}
                disabled={!canOpenAcademicModule(module.name)}
                title={
                  canOpenAcademicModule(module.name)
                    ? module.description
                    : "No tienes un perfil académico habilitado para este módulo"
                }
                className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm transition hover:bg-decom-blue/10 hover:text-decom-blue-text disabled:cursor-not-allowed disabled:opacity-50 ${secondaryText}`}
              >
                <module.icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                {!sidebarCollapsed && <span>{module.name}</span>}
              </button>
            ))}

            <div className={`my-5 border-t ${borderColor}`} />

            <p className={`px-3 text-xs font-bold uppercase tracking-wider ${secondaryText}`}>
              {!sidebarCollapsed && "Institucional"}
            </p>

            <div
              className={`mt-2 flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm ${
                isNationalAdmin
                  ? "bg-decom-blue/10 font-semibold text-decom-blue-text"
                  : `${secondaryText} opacity-50`
              }`}
            >
              <Settings className="h-5 w-5 shrink-0" aria-hidden="true" />
              {!sidebarCollapsed && <span>Administración</span>}
            </div>

            {canManageTutorAssignments && (
              <a
                href="/dashboard/administracion/tutores"
                onClick={() => setMobileMenuOpen(false)}
                className="mt-2 flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium text-muted-fg transition hover:bg-decom-blue/10 hover:text-decom-blue-text dark:hover:bg-decom-blue/20 dark:hover:text-decom-teal-text"
              >
                <Users className="h-5 w-5 shrink-0" aria-hidden="true" />
                {!sidebarCollapsed && <span>Asignación de tutores</span>}
              </a>
            )}

            {canManageAcademicCatalog && (
              <a
                href="/dashboard/administracion/actividades"
                onClick={() => setMobileMenuOpen(false)}
                className="mt-2 flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium text-muted-fg transition hover:bg-decom-blue/10 hover:text-decom-blue-text dark:hover:bg-decom-blue/20 dark:hover:text-decom-teal-text"
              >
                <ClipboardCheck className="h-5 w-5 shrink-0" aria-hidden="true" />
                {!sidebarCollapsed && <span>Actividades y evaluaciones</span>}
              </a>
            )}

            {canManageAcademicCatalog && (
              <a
                href="/dashboard/administracion/catalogo"
                onClick={() => setMobileMenuOpen(false)}
                className="mt-2 flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium text-muted-fg transition hover:bg-decom-blue/10 hover:text-decom-blue-text dark:hover:bg-decom-blue/20 dark:hover:text-decom-teal-text"
              >
                <BookOpen className="h-5 w-5 shrink-0" aria-hidden="true" />
                {!sidebarCollapsed && <span>Catálogo académico</span>}
              </a>
            )}

            {canManageLibrary && (
              <a
                href="/dashboard/administracion/biblioteca"
                onClick={() => setMobileMenuOpen(false)}
                className="mt-2 flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium text-muted-fg transition hover:bg-decom-blue/10 hover:text-decom-blue-text dark:hover:bg-decom-blue/20 dark:hover:text-decom-teal-text"
              >
                <Library className="h-5 w-5 shrink-0" aria-hidden="true" />
                {!sidebarCollapsed && <span>Administrar biblioteca</span>}
              </a>
            )}

            {canManageInvitations && (
              <a
                href="/dashboard/invitaciones"
                onClick={() => setMobileMenuOpen(false)}
                className="mt-2 flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium text-muted-fg transition hover:bg-decom-blue/10 hover:text-decom-blue-text dark:hover:bg-decom-blue/20 dark:hover:text-decom-teal-text"
              >
                <Mail className="h-5 w-5 shrink-0" aria-hidden="true" />
                {!sidebarCollapsed && <span>Invitaciones</span>}
              </a>
            )}

            {/* REUBICACIÓN DE CREYENTES */}
            {canManageTransfers && (
              <a
                href="/dashboard/reubicaciones"
                onClick={() => setMobileMenuOpen(false)}
                className="mt-2 flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium text-muted-fg transition hover:bg-decom-blue/10 hover:text-decom-blue-text dark:hover:bg-decom-blue/20 dark:hover:text-decom-teal-text"
              >
                <ArrowLeftRight className="h-5 w-5 shrink-0" aria-hidden="true" />
                {!sidebarCollapsed && <span>Reubicación de creyentes</span>}
              </a>
            )}
          </nav>

          {/* INFORMACIÓN DEL USUARIO */}
          <div className={`border-t ${borderColor} p-4`}>
            {!sidebarCollapsed && (
              <p className={`truncate text-xs ${secondaryText}`}>Sesión iniciada como</p>
            )}

            {!sidebarCollapsed && (
              <p className="mt-1 truncate text-sm font-semibold">{displayName}</p>
            )}

            {!sidebarCollapsed && (
              <p className="mt-1 text-xs font-semibold text-decom-blue-text">{roleName}</p>
            )}

            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="mt-4 w-full rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-500 hover:bg-red-50 disabled:opacity-50"
            >
              {loggingOut ? (
                "Cerrando..."
              ) : sidebarCollapsed ? (
                <LogOut className="mx-auto h-4 w-4" />
              ) : (
                "Cerrar sesión"
              )}
            </button>
          </div>
        </aside>

        {/* CONTENIDO PRINCIPAL */}
        <section className="min-w-0 flex-1">
          {/* ENCABEZADO */}
          <header
            className={`flex items-center justify-between border-b ${borderColor} ${surface} px-4 py-4 md:px-8`}
          >
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Abrir menú de navegación"
                aria-expanded={mobileMenuOpen}
                className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${borderColor} lg:hidden`}
              >
                <Menu className="h-5 w-5" aria-hidden="true" />
              </button>
              <div>
                <p className={`text-xs font-medium ${secondaryText}`}>ACADEMIA DECOM</p>
                <h2 className="mt-1 text-lg font-bold">Panel principal</h2>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className={`flex items-center gap-1 rounded-xl p-1 ${background}`}>
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
                      theme === item ? "bg-decom-blue text-white" : secondaryText
                    }`}
                  >
                    {item === "light" ? (
                      <Sun className="h-4 w-4" />
                    ) : item === "dark" ? (
                      <Moon className="h-4 w-4" />
                    ) : (
                      <Monitor className="h-4 w-4" />
                    )}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => router.push("/dashboard/perfil")}
                title="Editar perfil institucional"
                className="inline-flex min-w-0 items-center gap-2 rounded-xl bg-decom-blue/10 px-2.5 py-2 text-sm font-semibold text-decom-blue-text transition hover:bg-decom-blue/15"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-decom-blue/15">
                  {avatarUrl ? (
                    <Image
                      src={avatarUrl}
                      alt=""
                      width={64}
                      height={64}
                      unoptimized
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <UserRound className="h-4 w-4" aria-hidden="true" />
                  )}
                </span>
                <span className="hidden max-w-[160px] truncate sm:block">{displayName}</span>
              </button>

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
            <section className="relative overflow-hidden rounded-2xl bg-decom-navy p-7 text-white md:p-10">
              <div className="absolute -right-16 -top-24 h-72 w-72 rounded-full border border-white/10" />
              <div className="absolute -bottom-40 right-32 h-72 w-72 rounded-full border border-white/10" />

              <div className="relative z-10">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-decom-teal-text">
                  Formación institucional
                </p>

                <p className="mt-4 text-sm font-semibold text-[#9BDCF5]">{greeting}</p>
                <h2 className="mt-2 max-w-3xl text-3xl font-bold leading-tight md:text-4xl">
                  {displayName === "Bienvenido"
                    ? "Bienvenido a tu escuela"
                    : `${greeting}, ${displayName}`}
                </h2>

                <p className="mt-4 max-w-2xl text-sm leading-7 text-blue-100">
                  Un espacio para aprender, desarrollar habilidades y fortalecer el servicio de
                  comunicación institucional.
                </p>

                <div className="mt-7 h-1 w-16 rounded-full bg-[#F2B544]" />

                <p className="mt-4 text-sm text-blue-200">
                  Formación para comunicar con propósito.
                </p>
              </div>
            </section>

            <section
              className={`mt-6 rounded-2xl border ${borderColor} ${surface} p-5 shadow-sm md:p-6`}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFBD00]/15 text-[#B78100]">
                  ✦
                </div>
                <div>
                  <p className="text-sm font-bold">Versículo del día</p>
                  <p className={`text-xs ${secondaryText}`}>
                    Una palabra para acompañar tu servicio
                  </p>
                </div>
              </div>
              <blockquote className="mt-4 text-base font-semibold leading-7">
                «{dailyVerse.text}»
              </blockquote>
              <p className="mt-2 text-sm font-bold text-decom-blue-text">{dailyVerse.reference}</p>
            </section>

            {/* PERFIL */}
            <section className={`${surface} mt-7 rounded-2xl border ${borderColor} p-5`}>
              <p className={`text-xs font-semibold uppercase tracking-wider ${secondaryText}`}>
                Tu perfil institucional
              </p>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold">{roleName}</h3>
                  <p className={`mt-1 text-sm ${secondaryText}`}>Permisos asociados a tu cuenta.</p>
                </div>

                {isNationalAdmin && (
                  <span className="rounded-full bg-decom-blue/10 px-3 py-2 text-xs font-bold text-decom-blue-text">
                    Administración nacional
                  </span>
                )}
              </div>
            </section>

            {/* SEGURIDAD */}
            <section className={`${surface} mt-5 rounded-2xl border ${borderColor} p-5`}>
              <p className={`text-xs font-semibold uppercase tracking-wider ${secondaryText}`}>
                Seguridad y permisos
              </p>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold">Verificación de Administración nacional</h3>

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
                          : "bg-surface-muted text-muted-fg"
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
              <section className={`${surface} mt-7 rounded-2xl border ${borderColor} p-5 md:p-7`}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-decom-blue-text">
                      Administración académica
                    </p>

                    <h3 className="mt-2 text-xl font-bold">Áreas de formación</h3>

                    <p className={`mt-2 text-sm ${secondaryText}`}>
                      Organiza y administra las áreas académicas de Academia DECOM.
                    </p>
                  </div>

                  <div className="rounded-xl bg-decom-blue/10 px-5 py-3">
                    <p className="text-xs font-semibold text-decom-blue-text">Áreas registradas</p>
                    <p className="mt-1 text-2xl font-bold text-decom-blue-text">{areas.length}</p>
                  </div>
                </div>

                {/* INDICADORES */}
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <div className={`rounded-xl border ${borderColor} p-4`}>
                    <p className={`text-xs font-medium ${secondaryText}`}>Áreas activas</p>
                    <p className="mt-1 text-2xl font-bold text-emerald-600">{activeAreas}</p>
                  </div>

                  <div className={`rounded-xl border ${borderColor} p-4`}>
                    <p className={`text-xs font-medium ${secondaryText}`}>Áreas inactivas</p>
                    <p className="mt-1 text-2xl font-bold text-muted-fg">{inactiveAreas}</p>
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

                  <form onSubmit={handleSaveArea} className="mt-5 space-y-4">
                    <div>
                      <label htmlFor="areaName" className="mb-2 block text-sm font-semibold">
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
                        className={`w-full rounded-xl border ${borderColor} ${background} px-4 py-3 text-sm outline-none transition focus:border-decom-blue focus:ring-2 focus:ring-decom-blue/20 disabled:opacity-50`}
                      />
                    </div>

                    <div>
                      <label htmlFor="areaDescription" className="mb-2 block text-sm font-semibold">
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
                        className={`w-full resize-y rounded-xl border ${borderColor} ${background} px-4 py-3 text-sm outline-none transition focus:border-decom-blue focus:ring-2 focus:ring-decom-blue/20 disabled:opacity-50`}
                      />

                      <p className={`mt-1 text-right text-xs ${secondaryText}`}>
                        {areaDescription.length}/1000
                      </p>
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={savingArea || areasLoading || !areaName.trim()}
                        className="rounded-xl bg-decom-blue px-6 py-3 text-sm font-semibold text-white transition hover:bg-decom-blue-hover disabled:cursor-not-allowed disabled:opacity-50"
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
                      className="rounded-xl border border-decom-blue px-4 py-2 text-sm font-semibold text-decom-blue-text hover:bg-decom-blue/5 disabled:opacity-50"
                    >
                      {areasLoading ? "Actualizando..." : "Actualizar"}
                    </button>
                  </div>

                  {/* BUSCADOR Y FILTRO */}
                  <div className="mt-5 grid gap-3 md:grid-cols-2">
                    <input
                      type="search"
                      aria-label="Buscar área por nombre"
                      value={areaSearch}
                      onChange={(event) => setAreaSearch(event.target.value)}
                      placeholder="Buscar área por nombre..."
                      className={`w-full rounded-xl border ${borderColor} ${background} px-4 py-3 text-sm outline-none focus:border-decom-blue focus:ring-2 focus:ring-decom-blue/20`}
                    />

                    <select
                      aria-label="Filtrar áreas por estado"
                      value={areaFilter}
                      onChange={(event) =>
                        setAreaFilter(event.target.value as "all" | "active" | "inactive")
                      }
                      className={`w-full rounded-xl border ${borderColor} ${background} px-4 py-3 text-sm outline-none focus:border-decom-blue`}
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
                    <div className={`mt-5 rounded-xl border ${borderColor} p-6 text-center`}>
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
                        Desliza horizontalmente la tabla si no puedes visualizar todas las columnas.
                      </p>

                      <div className={`overflow-x-auto rounded-xl border ${borderColor}`}>
                        <table className="w-full min-w-[850px] table-fixed text-left text-sm">
                          <caption className="sr-only">
                            Áreas de formación registradas y acciones disponibles para cada área
                          </caption>
                          <colgroup>
                            <col className="w-[22%]" />
                            <col className="w-[34%]" />
                            <col className="w-[16%]" />
                            <col className="w-[28%]" />
                          </colgroup>

                          <thead>
                            <tr className={`${background} ${secondaryText}`}>
                              <th scope="col" className="px-4 py-4 font-semibold">
                                Área
                              </th>

                              <th scope="col" className="px-4 py-4 font-semibold">
                                Descripción
                              </th>

                              <th scope="col" className="px-4 py-4 font-semibold">
                                Estado
                              </th>

                              <th scope="col" className="px-4 py-4 font-semibold">
                                Acciones
                              </th>
                            </tr>
                          </thead>

                          <tbody>
                            {filteredAreas.map((area) => (
                              <tr
                                key={area.id}
                                className={`border-t ${borderColor} transition hover:bg-decom-blue/5`}
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
                                        : "bg-surface-muted text-muted-fg"
                                    }`}
                                  >
                                    {area.status === "active" ? "Activa" : "Inactiva"}
                                  </span>
                                </td>

                                <td className="px-4 py-5 align-middle">
                                  <div className="flex items-center gap-3 whitespace-nowrap">
                                    <button
                                      type="button"
                                      onClick={() => handleEditArea(area)}
                                      aria-label={`Editar área ${area.name}`}
                                      className="inline-flex items-center justify-center rounded-lg bg-decom-blue/10 px-3 py-2 text-xs font-semibold text-decom-blue-text transition hover:bg-decom-blue/20"
                                    >
                                      Editar
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => handleToggleAreaStatus(area)}
                                      aria-label={`${area.status === "active" ? "Desactivar" : "Activar"} área ${area.name}`}
                                      className={`inline-flex items-center justify-center rounded-lg px-3 py-2 text-xs font-semibold transition ${
                                        area.status === "active"
                                          ? "bg-amber-50 text-amber-700 hover:bg-amber-100"
                                          : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                      }`}
                                    >
                                      {area.status === "active" ? "Desactivar" : "Activar"}
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
                    Las áreas inactivas se conservan en la base de datos. No se eliminan las
                    asignaciones históricas de sus integrantes.
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
                  <DashboardModuleCard
                    key={module.name}
                    title={module.name}
                    description={module.description}
                    icon={module.icon}
                    color={module.color}
                    enabled={canOpenAcademicModule(module.name)}
                    mutedTextClass={secondaryText}
                    surfaceClass={surface}
                    borderClass={borderColor}
                    onOpen={() => openAcademicModule(module.name)}
                  />
                ))}
              </div>
            </section>

            {/* PIE DE PÁGINA */}
            <footer className={`mt-12 border-t ${borderColor} py-6 text-center`}>
              <p className={`text-xs ${secondaryText}`}>Academia DECOM · Formación institucional</p>

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
