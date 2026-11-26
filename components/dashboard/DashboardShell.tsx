"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
  type LucideIcon,
} from "lucide-react";
import {
  ACADEMIC_MODULE_NAMES,
  academicDestination,
  adminNavItems,
  canOpenAcademicModule,
  isActivePath,
  pageTitleFor,
  permissionsFor,
} from "@/lib/dashboard/navigation.mjs";
import { createClient } from "@/lib/supabase/client";

type Theme = "light" | "dark" | "system";

const THEMES: Array<{ id: Theme; label: string; icon: LucideIcon }> = [
  { id: "light", label: "Tema claro", icon: Sun },
  { id: "dark", label: "Tema oscuro", icon: Moon },
  { id: "system", label: "Tema automático", icon: Monitor },
];

const MODULE_ICONS: Record<string, LucideIcon> = {
  "Mi formación": BookOpen,
  Biblioteca: Library,
  Evaluaciones: ClipboardCheck,
  Seguimiento: Clock3,
  Reconocimientos: Award,
};

const MODULE_HINTS: Record<string, string> = {
  "Mi formación": "Continúa tus procesos de aprendizaje.",
  Biblioteca: "Consulta documentos y recursos académicos.",
  Evaluaciones: "Desarrolla actividades y pruebas.",
  Seguimiento: "Consulta tu progreso académico.",
  Reconocimientos: "Consulta tus logros institucionales.",
};

const ADMIN_ICONS: Record<string, LucideIcon> = {
  Users,
  ClipboardCheck,
  BookOpen,
  Library,
  Mail,
  ArrowLeftRight,
};

type RoleRow = { role_key: string; name: string };

/**
 * Estructura común de todo /dashboard: menú lateral (colapsable en escritorio, cajón en móvil) y barra
 * superior con título, tema, perfil y salida. SOLO muestra información: no redirige ni valida accesos.
 * Cada página conserva su propia verificación de sesión, de rol y de perfil.
 */
export function DashboardShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = useMemo(() => createClient(), []);

  const [theme, setTheme] = useState<Theme>("system");
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [roleKeys, setRoleKeys] = useState<string[]>([]);
  const [roleName, setRoleName] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  const asideRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef(false);

  // Preferencia del menú lateral (se restaura y se guarda).
  useEffect(() => {
    const saved = localStorage.getItem("academia-sidebar-collapsed");
    if (saved === "true" || saved === "false") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCollapsed(saved === "true");
    }
  }, []);

  function toggleCollapsed() {
    setCollapsed((value) => {
      localStorage.setItem("academia-sidebar-collapsed", String(!value));
      return !value;
    });
  }

  // Tema claro, oscuro o automático: lo gestiona el shell para todas las páginas del panel.
  useEffect(() => {
    const saved = localStorage.getItem("academia-theme");
    if (saved === "light" || saved === "dark" || saved === "system") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTheme(saved);
    }
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    function apply() {
      const dark = theme === "dark" || (theme === "system" && media.matches);
      document.documentElement.classList.toggle("dark", dark);
    }
    apply();
    if (theme === "system") {
      media.addEventListener("change", apply);
      return () => media.removeEventListener("change", apply);
    }
  }, [theme]);

  function changeTheme(next: Theme) {
    setTheme(next);
    localStorage.setItem("academia-theme", next);
  }

  // Escape cierra el menú móvil y devuelve el foco al botón que lo abrió.
  useEffect(() => {
    if (!mobileOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        returnFocusRef.current = true;
        setMobileOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen]);

  // Al abrir el cajón, el foco pasa al menú; al cerrarlo con Escape o el fondo, vuelve al botón.
  useEffect(() => {
    // El enlace «Saltar al contenido» vive fuera del panel: también se bloquea mientras el cajón está abierto.
    const skipLink = document.querySelector<HTMLElement>(".skip-link");
    skipLink?.toggleAttribute("inert", mobileOpen);

    if (mobileOpen) {
      asideRef.current?.querySelector<HTMLElement>("a[href], button:not([disabled])")?.focus();
    } else if (returnFocusRef.current) {
      returnFocusRef.current = false;
      menuButtonRef.current?.focus();
    }
    return () => skipLink?.removeAttribute("inert");
  }, [mobileOpen]);

  // Si la ventana pasa a escritorio con el cajón abierto, se cierra (allí el menú ya es fijo).
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    function onChange(event: MediaQueryListEvent) {
      if (event.matches) setMobileOpen(false);
    }
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  // Identidad para mostrar (solo lectura): nombre, foto y roles. Si algo falla, la interfaz sigue funcionando.
  useEffect(() => {
    let active = true;

    async function loadIdentity() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!active || !user) return;

        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, avatar_path")
          .eq("id", user.id)
          .maybeSingle();
        if (!active) return;
        if (profile?.full_name?.trim()) setDisplayName(profile.full_name.trim());

        if (profile?.avatar_path) {
          const { data: avatar } = await supabase.storage
            .from("decom-profile-avatars")
            .createSignedUrl(profile.avatar_path, 60 * 60);
          if (active && avatar?.signedUrl) setAvatarUrl(avatar.signedUrl);
        }

        const { data: assignments } = await supabase
          .from("user_role_assignments")
          .select("role_id")
          .eq("user_id", user.id);
        if (!active) return;
        const roleIds = (assignments ?? []).map((item) => item.role_id);
        if (roleIds.length === 0) {
          setRoleName("Sin rol asignado");
          return;
        }
        const { data: roles } = await supabase
          .from("roles")
          .select("role_key, name")
          .in("id", roleIds);
        if (!active) return;
        const rows = (roles ?? []) as RoleRow[];
        setRoleKeys(rows.map((role) => role.role_key));
        setRoleName(rows.map((role) => role.name).join(", ") || "Sin rol asignado");
      } catch (error) {
        console.error("No fue posible cargar la identidad del menú:", error);
      }
    }

    void Promise.resolve().then(loadIdentity);
    return () => {
      active = false;
    };
  }, [supabase]);

  async function handleLogout() {
    setLoggingOut(true);
    const { error } = await supabase.auth.signOut();
    if (error) {
      setLoggingOut(false);
      alert("No fue posible cerrar la sesión. Inténtalo nuevamente.");
      return;
    }
    router.replace("/");
    router.refresh();
  }

  function cycleTheme() {
    changeTheme(theme === "light" ? "dark" : theme === "dark" ? "system" : "light");
  }

  const permissions = permissionsFor(roleKeys);
  const admin = adminNavItems(roleKeys);
  const closeMobile = () => setMobileOpen(false);
  const label = (text: string) =>
    collapsed ? <span className="lg:hidden">{text}</span> : <span>{text}</span>;
  const CurrentThemeIcon = THEMES.find((item) => item.id === theme)?.icon ?? Monitor;

  const itemBase =
    "flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-sm transition focus-visible:outline-2";
  const itemIdle = "font-medium text-muted-fg hover:bg-decom-blue/10 hover:text-decom-blue-text";
  const itemActive = "bg-decom-blue/10 font-semibold text-decom-blue-text";

  return (
    <div className="flex min-h-dvh bg-background text-foreground">
      {mobileOpen ? (
        <button
          type="button"
          aria-label="Cerrar menú"
          onClick={() => {
            returnFocusRef.current = true;
            setMobileOpen(false);
          }}
          className="fixed inset-0 z-40 bg-slate-950/55 backdrop-blur-[2px] lg:hidden"
        />
      ) : null}

      {/* MENÚ LATERAL: persistente en escritorio y cajón en móvil */}
      <aside
        ref={asideRef}
        role={mobileOpen ? "dialog" : undefined}
        aria-modal={mobileOpen ? true : undefined}
        aria-label={mobileOpen ? "Menú de navegación" : undefined}
        data-collapsed={collapsed}
        className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col self-start border-r border-line bg-surface transition-[transform,width] duration-200 lg:sticky lg:top-0 lg:z-30 lg:h-dvh lg:max-w-none lg:translate-x-0 ${
          mobileOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
        } ${collapsed ? "lg:w-20" : "lg:w-72"}`}
      >
        <div className="flex items-center justify-between gap-2 border-b border-line-soft p-4">
          <Link href="/dashboard" onClick={closeMobile} className="flex min-w-0 items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-decom-navy text-sm font-black text-white">
              D34
            </span>
            <span className={`min-w-0 ${collapsed ? "lg:hidden" : ""}`}>
              <span className="block text-xs font-bold tracking-wide">
                ESCUELA DE COMUNICACIONES
              </span>
              <span className="block text-xs text-muted-fg">Distrito 34 · IPUC</span>
            </span>
          </Link>
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expandir menú" : "Contraer menú"}
            title={collapsed ? "Expandir menú" : "Contraer menú"}
            className="hidden rounded-lg p-2 text-muted-fg transition hover:bg-decom-blue/10 lg:inline-flex"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        <nav
          aria-label="Navegación principal"
          className="sidebar-scroll min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain p-3"
        >
          <p
            className={`px-3.5 pb-2 text-xs font-bold tracking-wider text-muted-fg uppercase ${collapsed ? "lg:hidden" : ""}`}
          >
            Menú principal
          </p>

          <Link
            href="/dashboard"
            onClick={closeMobile}
            title="Inicio"
            aria-current={isActivePath(pathname, "/dashboard") ? "page" : undefined}
            className={`${itemBase} ${isActivePath(pathname, "/dashboard") ? itemActive : itemIdle}`}
          >
            <Home className="h-5 w-5 shrink-0" aria-hidden="true" />
            {label("Inicio")}
          </Link>

          {ACADEMIC_MODULE_NAMES.map((name) => {
            const Icon = MODULE_ICONS[name] ?? BookOpen;
            const enabled = canOpenAcademicModule(name, roleKeys);
            const destination = academicDestination(name, roleKeys);
            const active = enabled && destination ? isActivePath(pathname, destination) : false;
            return (
              <button
                key={name}
                type="button"
                disabled={!enabled}
                aria-current={active ? "page" : undefined}
                title={enabled ? name : "No tienes un perfil académico habilitado para este módulo"}
                onClick={() => {
                  if (destination) router.push(destination);
                  closeMobile();
                }}
                className={`${itemBase} ${active ? itemActive : itemIdle} disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent disabled:hover:text-muted-fg`}
              >
                <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                {label(name)}
                <span className="sr-only">{MODULE_HINTS[name]}</span>
              </button>
            );
          })}

          {admin.length > 0 || permissions.isNationalAdmin ? (
            <>
              <div className="my-4 border-t border-line-soft" />
              <p
                className={`px-3.5 pb-2 text-xs font-bold tracking-wider text-muted-fg uppercase ${collapsed ? "lg:hidden" : ""}`}
              >
                Institucional
              </p>
              <div
                title="Administración"
                className={`${itemBase} ${permissions.isNationalAdmin ? "font-semibold text-decom-blue-text" : "font-medium text-muted-fg opacity-50"}`}
              >
                <Settings className="h-5 w-5 shrink-0" aria-hidden="true" />
                {label("Administración")}
              </div>
              {admin.map((item) => {
                const Icon = ADMIN_ICONS[item.icon] ?? BookOpen;
                const active = isActivePath(pathname, item.href);
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    onClick={closeMobile}
                    title={item.label}
                    aria-current={active ? "page" : undefined}
                    className={`${itemBase} ${active ? itemActive : itemIdle}`}
                  >
                    <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                    {label(item.label)}
                  </Link>
                );
              })}
            </>
          ) : null}
        </nav>

        <div className="border-t border-line-soft p-4">
          <div className={collapsed ? "lg:hidden" : ""}>
            <p className="truncate text-xs text-muted-fg">Sesión iniciada como</p>
            <p className="mt-1 truncate text-sm font-semibold">{displayName || "…"}</p>
            {roleName ? (
              <p className="mt-1 text-xs font-semibold text-decom-blue-text">{roleName}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            title="Cerrar sesión"
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            <span className={collapsed ? "lg:hidden" : ""}>
              {loggingOut ? "Cerrando..." : "Cerrar sesión"}
            </span>
          </button>
        </div>
      </aside>

      <div inert={mobileOpen} className="flex min-w-0 flex-1 flex-col">
        {/* BARRA SUPERIOR */}
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-line bg-surface px-4 md:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              ref={menuButtonRef}
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Abrir menú de navegación"
              aria-expanded={mobileOpen}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line lg:hidden"
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>
            <div className="min-w-0">
              <p className="hidden text-xs font-medium text-muted-fg sm:block">ACADEMIA DECOM</p>
              <p className="truncate text-base font-bold sm:mt-0.5 sm:text-lg">
                {pageTitleFor(pathname)}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <div
              role="group"
              aria-label="Tema"
              className="hidden items-center gap-1 rounded-xl bg-surface-muted p-1 sm:flex"
            >
              {THEMES.map(({ id, label: themeLabel, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => changeTheme(id)}
                  title={themeLabel}
                  aria-label={themeLabel}
                  aria-pressed={theme === id}
                  className={`rounded-lg px-2.5 py-2 ${theme === id ? "bg-decom-blue text-white" : "text-muted-fg"}`}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={cycleTheme}
              title="Cambiar tema"
              aria-label="Cambiar tema"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-surface-muted text-muted-fg sm:hidden"
            >
              <CurrentThemeIcon className="h-4 w-4" aria-hidden="true" />
            </button>

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
              <span className="hidden max-w-[160px] truncate sm:block">
                {displayName || "Mi perfil"}
              </span>
            </button>

            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              title="Cerrar sesión"
              aria-label="Salir de la plataforma (cerrar sesión)"
              className="inline-flex h-10 items-center justify-center rounded-xl bg-red-50 px-3 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
            >
              <LogOut className="h-4 w-4 sm:hidden" aria-hidden="true" />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </header>

        <div className="dashboard-content min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
