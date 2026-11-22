import test from "node:test";
import assert from "node:assert/strict";
import {
  ACADEMIC_MODULE_NAMES,
  academicDestination,
  adminNavItems,
  canOpenAcademicModule,
  isActivePath,
  pageTitleFor,
  permissionsFor,
} from "../../lib/dashboard/navigation.mjs";

// ---- Copia LITERAL de la lógica anterior (app/dashboard/page.tsx) usada como referencia ----
function referencePermissions(roleKeys) {
  const isNationalAdmin = roleKeys.includes("national_admin");
  const canManageLibrary = isNationalAdmin || roleKeys.includes("academic_editor");
  return {
    isNationalAdmin,
    canManageInvitations: roleKeys.some((r) =>
      ["national_admin", "district_coordinator", "area_coordinator"].includes(r),
    ),
    canManageLibrary,
    canManageAcademicCatalog: canManageLibrary,
    canManageTutorAssignments: roleKeys.some((r) =>
      ["national_admin", "academic_editor", "district_coordinator", "area_coordinator"].includes(r),
    ),
    canOpenAdminModule: isNationalAdmin || roleKeys.includes("academic_editor"),
    canManageTransfers:
      roleKeys.includes("national_admin") ||
      roleKeys.includes("district_coordinator") ||
      roleKeys.includes("area_coordinator"),
  };
}
function referenceDestination(moduleName, roleKeys) {
  const canOpenAdminModule =
    roleKeys.includes("national_admin") || roleKeys.includes("academic_editor");
  const isStudent = roleKeys.includes("member");
  const isTutor = roleKeys.includes("tutor");
  const adminDestination =
    moduleName === "Mi formación"
      ? "/dashboard/formacion"
      : moduleName === "Biblioteca"
        ? "/dashboard/biblioteca"
        : null;
  if (adminDestination && canOpenAdminModule) return adminDestination;
  if (moduleName === "Seguimiento" && isTutor) return "/dashboard/tutor";
  const hasManagementRole = roleKeys.some((r) =>
    [
      "national_admin",
      "district_coordinator",
      "area_coordinator",
      "academic_editor",
      "local_responsible",
    ].includes(r),
  );
  if (moduleName === "Seguimiento" && hasManagementRole && !isTutor) return "/dashboard/espacio";
  if (moduleName === "Mi formación" && hasManagementRole && !isStudent) return "/dashboard/espacio";
  if (!isStudent) return null;
  const destinations = {
    "Mi formación": "/dashboard/estudiante/formacion",
    Biblioteca: "/dashboard/estudiante/biblioteca",
    Evaluaciones: "/dashboard/estudiante/evaluaciones",
    Seguimiento: "/dashboard/estudiante",
    Reconocimientos: "/dashboard/estudiante/reconocimientos",
  };
  return destinations[moduleName] ?? null;
}
function referenceCanOpen(moduleName, roleKeys) {
  const canOpenAdminModule =
    roleKeys.includes("national_admin") || roleKeys.includes("academic_editor");
  const isStudent = roleKeys.includes("member");
  const isTutor = roleKeys.includes("tutor");
  const hasManagementRole = roleKeys.some((r) =>
    [
      "national_admin",
      "district_coordinator",
      "area_coordinator",
      "academic_editor",
      "local_responsible",
    ].includes(r),
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

const ALL_ROLES = [
  "national_admin",
  "district_coordinator",
  "area_coordinator",
  "local_responsible",
  "member",
  "tutor",
  "academic_editor",
];
const combinations = [];
for (let mask = 0; mask < 1 << ALL_ROLES.length; mask++)
  combinations.push(ALL_ROLES.filter((_, i) => mask & (1 << i)));

test("equivalencia exacta con la lógica anterior en las 128 combinaciones de roles", () => {
  assert.equal(combinations.length, 128);
  for (const roles of combinations) {
    const label = JSON.stringify(roles);
    const ref = referencePermissions(roles);
    const now = permissionsFor(roles);
    for (const key of Object.keys(ref))
      assert.equal(now[key], ref[key], `permiso ${key} con ${label}`);
    for (const name of ACADEMIC_MODULE_NAMES) {
      assert.equal(
        academicDestination(name, roles),
        referenceDestination(name, roles),
        `destino de «${name}» con ${label}`,
      );
      assert.equal(
        canOpenAcademicModule(name, roles),
        referenceCanOpen(name, roles),
        `disponibilidad de «${name}» con ${label}`,
      );
    }
  }
});

test("permissionsFor tolera valores vacíos", () => {
  assert.equal(permissionsFor(undefined).isStudent, false);
  assert.equal(permissionsFor(null).canManageTransfers, false);
  assert.deepEqual(adminNavItems([]), []);
});

test("adminNavItems respeta permisos y orden del menú", () => {
  assert.deepEqual(
    adminNavItems(["national_admin"]).map((i) => i.id),
    ["tutors", "activities", "catalog", "library", "invitations", "transfers"],
  );
  assert.deepEqual(
    adminNavItems(["district_coordinator"]).map((i) => i.id),
    ["tutors", "invitations", "transfers"],
  );
  assert.deepEqual(
    adminNavItems(["academic_editor"]).map((i) => i.id),
    ["tutors", "activities", "catalog", "library"],
  );
  assert.deepEqual(
    adminNavItems(["member"]).map((i) => i.id),
    [],
  );
  assert.deepEqual(
    adminNavItems(["tutor"]).map((i) => i.id),
    [],
  );
});

test("pageTitleFor elige la coincidencia más específica y tolera rutas dinámicas", () => {
  assert.equal(pageTitleFor("/dashboard"), "Panel principal");
  assert.equal(pageTitleFor("/dashboard/"), "Panel principal");
  assert.equal(pageTitleFor("/dashboard/estudiante/seguimiento"), "Mi seguimiento");
  assert.equal(
    pageTitleFor("/dashboard/estudiante/evaluaciones/practica"),
    "Práctica de evaluación",
  );
  assert.equal(pageTitleFor("/dashboard/estudiante/evaluaciones/abc-123"), "Evaluaciones");
  assert.equal(pageTitleFor("/dashboard/estudiante/leccion/xyz"), "Aula virtual");
  assert.equal(pageTitleFor("/dashboard/tutor/estudiantes/uuid"), "Seguimiento individual");
  assert.equal(pageTitleFor("/dashboard/ruta-nueva"), "Panel principal"); // cae al prefijo /dashboard
  assert.equal(pageTitleFor("/otra"), "Panel");
  assert.equal(pageTitleFor(undefined), "Panel");
});

test("isActivePath: los centros solo coinciden exactos y el resto también por subpáginas", () => {
  assert.equal(isActivePath("/dashboard", "/dashboard"), true);
  assert.equal(isActivePath("/dashboard/congregaciones", "/dashboard"), false);
  assert.equal(isActivePath("/dashboard/estudiante", "/dashboard/estudiante"), true);
  assert.equal(isActivePath("/dashboard/estudiante/biblioteca", "/dashboard/estudiante"), false);
  assert.equal(
    isActivePath("/dashboard/estudiante/biblioteca", "/dashboard/estudiante/biblioteca"),
    true,
  );
  assert.equal(
    isActivePath("/dashboard/estudiante/leccion/abc", "/dashboard/estudiante/leccion"),
    true,
  );
  assert.equal(isActivePath("/dashboard/invitaciones/", "/dashboard/invitaciones"), true);
  assert.equal(isActivePath("/dashboard/invitacionesx", "/dashboard/invitaciones"), false);
  assert.equal(isActivePath("/dashboard", ""), false);
});
