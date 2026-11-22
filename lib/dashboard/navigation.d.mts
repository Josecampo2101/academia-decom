export interface DashboardPermissions {
  isNationalAdmin: boolean;
  isStudent: boolean;
  isTutor: boolean;
  hasManagementRole: boolean;
  canManageInvitations: boolean;
  canManageLibrary: boolean;
  canManageAcademicCatalog: boolean;
  canManageTutorAssignments: boolean;
  canOpenAdminModule: boolean;
  canManageTransfers: boolean;
}

export interface AdminNavItem {
  id: string;
  label: string;
  href: string;
  icon: "Users" | "ClipboardCheck" | "BookOpen" | "Library" | "Mail" | "ArrowLeftRight";
}

export const ACADEMIC_MODULE_NAMES: string[];
export function permissionsFor(roleKeys: string[] | null | undefined): DashboardPermissions;
export function academicDestination(moduleName: string, roleKeys: string[]): string | null;
export function canOpenAcademicModule(moduleName: string, roleKeys: string[]): boolean;
export function adminNavItems(roleKeys: string[]): AdminNavItem[];
export function pageTitleFor(pathname: string | null | undefined): string;
export function isActivePath(pathname: string | null | undefined, href: string): boolean;
