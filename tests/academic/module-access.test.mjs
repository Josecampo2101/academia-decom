import test from "node:test";
import assert from "node:assert/strict";
import { canAccessAcademicModule } from "../../lib/academic/module-access.ts";

const modules = [
  "Mi formación",
  "Biblioteca",
  "Evaluaciones",
  "Seguimiento",
  "Reconocimientos",
];

test("un estudiante puede abrir todos los módulos de su espacio académico", () => {
  for (const moduleName of modules) {
    assert.equal(canAccessAcademicModule(moduleName, ["member"]), true, moduleName);
  }
});

test("un tutor solo recibe acceso al seguimiento de sus cursos", () => {
  assert.equal(canAccessAcademicModule("Seguimiento", ["tutor"]), true);
  for (const moduleName of modules.filter((name) => name !== "Seguimiento")) {
    assert.equal(canAccessAcademicModule(moduleName, ["tutor"]), false, moduleName);
  }
});

test("la administración nacional y el editor académico acceden a formación y biblioteca", () => {
  for (const role of ["national_admin", "academic_editor"]) {
    assert.equal(canAccessAcademicModule("Mi formación", [role]), true);
    assert.equal(canAccessAcademicModule("Biblioteca", [role]), true);
    assert.equal(canAccessAcademicModule("Evaluaciones", [role]), false);
    assert.equal(canAccessAcademicModule("Reconocimientos", [role]), false);
  }
});

test("coordinación distrital, comité y responsable local acceden a formación y seguimiento", () => {
  for (const role of ["district_coordinator", "area_coordinator", "local_responsible"]) {
    assert.equal(canAccessAcademicModule("Mi formación", [role]), true, role);
    assert.equal(canAccessAcademicModule("Seguimiento", [role]), true, role);
    assert.equal(canAccessAcademicModule("Biblioteca", [role]), false, role);
    assert.equal(canAccessAcademicModule("Evaluaciones", [role]), false, role);
  }
});

test("los perfiles combinados conservan la prioridad de navegación existente", () => {
  assert.equal(canAccessAcademicModule("Mi formación", ["member", "local_responsible"]), true);
  assert.equal(canAccessAcademicModule("Seguimiento", ["member", "tutor"]), true);
  assert.equal(canAccessAcademicModule("Biblioteca", ["member", "tutor"]), true);
});

test("una cuenta sin rol no recibe acceso y los módulos desconocidos se rechazan", () => {
  assert.equal(modules.some((name) => canAccessAcademicModule(name, [])), false);
  assert.equal(canAccessAcademicModule("Administración secreta", ["member"]), false);
});
