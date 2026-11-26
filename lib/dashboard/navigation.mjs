// Navegación del dashboard: reglas puras (sin React ni Supabase), probadas con node:test.
// Reproducen EXACTAMENTE las reglas que antes vivían dentro de app/dashboard/page.tsx.

/** Roles con capacidades de gestión (coordinación, edición académica o responsabilidad local). */
const MANAGEMENT_ROLES = [
  "national_admin",
  "district_coordinator",
  "area_coordinator",
  "academic_editor",
  "local_responsible",
];

/** Módulos académicos del menú, en orden. */
export const ACADEMIC_MODULE_NAMES = [
  "Mi formación",
  "Biblioteca",
  "Evaluaciones",
  "Seguimiento",
  "Reconocimientos",
];

const STUDENT_DESTINATIONS = {
  "Mi formación": "/dashboard/estudiante/formacion",
  Biblioteca: "/dashboard/estudiante/biblioteca",
  Evaluaciones: "/dashboard/estudiante/evaluaciones",
  Seguimiento: "/dashboard/estudiante",
  Reconocimientos: "/dashboard/estudiante/reconocimientos",
};

/** Permisos de interfaz derivados de los roles (la protección real sigue en el backend y en RLS). */
export function permissionsFor(roleKeys) {
  const keys = roleKeys ?? [];
  const has = (role) => keys.includes(role);
  const isNationalAdmin = has("national_admin");
  const canManageLibrary = isNationalAdmin || has("academic_editor");
  return {
    isNationalAdmin,
    isStudent: has("member"),
    isTutor: has("tutor"),
    hasManagementRole: keys.some((role) => MANAGEMENT_ROLES.includes(role)),
    canManageInvitations: keys.some((role) =>
      ["national_admin", "district_coordinator", "area_coordinator"].includes(role),
    ),
    canManageLibrary,
    canManageAcademicCatalog: canManageLibrary,
    canManageTutorAssignments: keys.some((role) =>
      ["national_admin", "academic_editor", "district_coordinator", "area_coordinator"].includes(
        role,
      ),
    ),
    canOpenAdminModule: canManageLibrary,
    canManageTransfers:
      has("national_admin") || has("district_coordinator") || has("area_coordinator"),
  };
}

/** Ruta a la que lleva un módulo académico según los roles, o null si no hay destino. */
export function academicDestination(moduleName, roleKeys) {
  const p = permissionsFor(roleKeys);

  if (p.canOpenAdminModule) {
    if (moduleName === "Mi formación") return "/dashboard/formacion";
    if (moduleName === "Biblioteca") return "/dashboard/biblioteca";
  }
  if (moduleName === "Seguimiento" && p.isTutor) return "/dashboard/tutor";
  if (moduleName === "Seguimiento" && p.hasManagementRole && !p.isTutor) {
    return "/dashboard/espacio";
  }
  if (moduleName === "Mi formación" && p.hasManagementRole && !p.isStudent) {
    return "/dashboard/espacio";
  }
  if (!p.isStudent) return null;
  return STUDENT_DESTINATIONS[moduleName] ?? null;
}

/** Disponibilidad visual de un módulo (debe coincidir con las rutas de academicDestination). */
export function canOpenAcademicModule(moduleName, roleKeys) {
  const p = permissionsFor(roleKeys);
  if (p.canOpenAdminModule && (moduleName === "Mi formación" || moduleName === "Biblioteca")) {
    return true;
  }
  if (moduleName === "Seguimiento" && p.isTutor) return true;
  if (
    (moduleName === "Seguimiento" || moduleName === "Mi formación") &&
    p.hasManagementRole &&
    !(moduleName === "Mi formación" && p.isStudent)
  ) {
    return true;
  }
  return p.isStudent;
}

/** Enlaces de administración visibles según los permisos, en el orden del menú. */
export function adminNavItems(roleKeys) {
  const p = permissionsFor(roleKeys);
  const items = [];
  if (p.canManageTutorAssignments) {
    items.push({
      id: "tutors",
      label: "Asignación de tutores",
      href: "/dashboard/administracion/tutores",
      icon: "Users",
    });
  }
  if (p.canManageAcademicCatalog) {
    items.push({
      id: "activities",
      label: "Actividades y evaluaciones",
      href: "/dashboard/administracion/actividades",
      icon: "ClipboardCheck",
    });
    items.push({
      id: "catalog",
      label: "Catálogo académico",
      href: "/dashboard/administracion/catalogo",
      icon: "BookOpen",
    });
  }
  if (p.canManageLibrary) {
    items.push({
      id: "library",
      label: "Administrar biblioteca",
      href: "/dashboard/administracion/biblioteca",
      icon: "Library",
    });
  }
  if (p.canManageInvitations) {
    items.push({
      id: "invitations",
      label: "Invitaciones",
      href: "/dashboard/invitaciones",
      icon: "Mail",
    });
  }
  if (p.canManageTransfers) {
    items.push({
      id: "transfers",
      label: "Reubicación de creyentes",
      href: "/dashboard/reubicaciones",
      icon: "ArrowLeftRight",
    });
  }
  return items;
}

/** Títulos de página para la barra superior. Se elige la coincidencia más específica por segmentos. */
const PAGE_TITLES = [
  ["/dashboard", "Panel principal"],
  ["/dashboard/perfil", "Mi perfil"],
  ["/dashboard/espacio", "Mi espacio"],
  ["/dashboard/congregaciones", "Congregaciones"],
  ["/dashboard/invitaciones", "Invitaciones"],
  ["/dashboard/matriculas", "Matrículas"],
  ["/dashboard/reubicaciones", "Reubicación de creyentes"],
  ["/dashboard/planificador", "Planner académico"],
  ["/dashboard/revision-academica", "Revisión académica"],
  ["/dashboard/biblioteca", "Biblioteca"],
  ["/dashboard/formacion", "Mi formación"],
  ["/dashboard/formacion/identidad-corporativa", "Identidad corporativa"],
  ["/dashboard/administracion/tutores", "Asignación de tutores"],
  ["/dashboard/administracion/actividades", "Actividades y evaluaciones"],
  ["/dashboard/administracion/catalogo", "Catálogo académico"],
  ["/dashboard/administracion/biblioteca", "Administrar biblioteca"],
  ["/dashboard/estudiante", "Panel del estudiante"],
  ["/dashboard/estudiante/formacion", "Mi aprendizaje"],
  ["/dashboard/estudiante/actividades", "Mis actividades"],
  ["/dashboard/estudiante/biblioteca", "Biblioteca"],
  ["/dashboard/estudiante/evaluaciones", "Evaluaciones"],
  ["/dashboard/estudiante/evaluaciones/practica", "Práctica de evaluación"],
  ["/dashboard/estudiante/reconocimientos", "Reconocimientos"],
  ["/dashboard/estudiante/seguimiento", "Mi seguimiento"],
  ["/dashboard/estudiante/leccion", "Aula virtual"],
  ["/dashboard/tutor", "Panel del tutor"],
  ["/dashboard/tutor/calificaciones", "Calificaciones"],
  ["/dashboard/tutor/evaluaciones", "Revisión de evaluaciones"],
  ["/dashboard/tutor/evaluaciones/crear", "Constructor de evaluaciones"],
  ["/dashboard/tutor/planificaciones", "Espacio del tutor"],
  ["/dashboard/tutor/estudiantes", "Seguimiento individual"],
];

export function pageTitleFor(pathname) {
  const path = String(pathname ?? "").replace(/\/+$/, "") || "/";
  let best = "Panel";
  let bestLength = -1;
  for (const [prefix, title] of PAGE_TITLES) {
    const matches = path === prefix || path.startsWith(`${prefix}/`);
    if (matches && prefix.length > bestLength) {
      best = title;
      bestLength = prefix.length;
    }
  }
  return best;
}

/** Rutas "centro" que solo se marcan activas con coincidencia exacta (no con sus subpáginas). */
const HUB_PATHS = ["/dashboard", "/dashboard/estudiante", "/dashboard/espacio", "/dashboard/tutor"];

/** ¿El enlace debe verse activo para la ruta actual? */
export function isActivePath(pathname, href) {
  if (!href) return false;
  const path = String(pathname ?? "").replace(/\/+$/, "") || "/";
  if (HUB_PATHS.includes(href)) return path === href;
  return path === href || path.startsWith(`${href}/`);
}
