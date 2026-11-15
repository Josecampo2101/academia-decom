export const ACADEMIC_MODULE_NAMES = [
  "Mi formación",
  "Biblioteca",
  "Evaluaciones",
  "Seguimiento",
  "Reconocimientos",
] as const;

export type AcademicModuleName = (typeof ACADEMIC_MODULE_NAMES)[number];

const STUDENT_MODULES = new Set<string>(ACADEMIC_MODULE_NAMES);
const ADMIN_MODULES = new Set<string>(["Mi formación", "Biblioteca"]);
const MANAGEMENT_ROLES = new Set([
  "national_admin",
  "district_coordinator",
  "area_coordinator",
  "academic_editor",
  "local_responsible",
]);

/**
 * Mirrors the destinations available in the dashboard's openAcademicModule.
 * This is a presentation/navigation guard only; Supabase RLS remains the
 * authority for data access.
 */
export function canAccessAcademicModule(
  moduleName: string,
  roleKeys: readonly string[],
): boolean {
  const roles = new Set(roleKeys);
  const isStudent = roles.has("member");
  const isTutor = roles.has("tutor");
  const hasManagementRole = roleKeys.some((role) => MANAGEMENT_ROLES.has(role));

  if (roles.has("national_admin") || roles.has("academic_editor")) {
    if (ADMIN_MODULES.has(moduleName)) return true;
  }

  if (moduleName === "Seguimiento" && isTutor) return true;
  if (moduleName === "Seguimiento" && hasManagementRole && !isTutor) return true;
  if (moduleName === "Mi formación" && hasManagementRole && !isStudent) return true;

  return isStudent && STUDENT_MODULES.has(moduleName);
}
