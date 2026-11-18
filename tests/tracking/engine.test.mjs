import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCourseRoutes,
  buildTracking,
  nextSteps,
  overallProgress,
  pendingActivities,
  recentActivity,
} from "../../lib/tracking/engine.mjs";

const courses = [
  { id: "c1", title: "Identidad corporativa", sort_order: 1 },
  { id: "c2", title: "Medios escritos", sort_order: 2 },
];
const modules = [
  { id: "m1", course_id: "c1", sort_order: 1 },
  { id: "m2", course_id: "c1", sort_order: 2 },
  { id: "m3", course_id: "c2", sort_order: 1 },
];
const lessons = [
  { id: "l2", module_id: "m1", title: "Elementos de identidad", sort_order: 2 },
  { id: "l1", module_id: "m1", title: "Introducción", sort_order: 1 },
  { id: "l3", module_id: "m2", title: "Aplicación", sort_order: 1 },
  { id: "l4", module_id: "m3", title: "Redacción básica", sort_order: 1 },
];

test("el avance por curso cuenta solo lecciones publicadas y respeta el orden de lectura", () => {
  const routes = buildCourseRoutes({
    enrollments: [
      { id: "e1", course_id: "c1" },
      { id: "e2", course_id: "c2" },
    ],
    courses,
    modules,
    lessons,
    progress: [
      {
        enrollment_id: "e1",
        lesson_id: "l1",
        status: "completed",
        completed_at: "2026-11-10T15:00:00Z",
      },
      {
        enrollment_id: "e1",
        lesson_id: "l-despublicada",
        status: "completed",
        completed_at: "2026-11-10T16:00:00Z",
      },
    ],
  });
  const first = routes[0];
  assert.equal(first.title, "Identidad corporativa");
  assert.equal(first.total, 3);
  assert.equal(first.done, 1);
  assert.equal(first.percent, 33);
  assert.equal(first.state, "in_progress");
  assert.equal(first.nextLessonTitle, "Elementos de identidad"); // l2 va antes que l3
  assert.equal(routes[1].state, "not_started");
  assert.equal(routes[1].percent, 0);
});

test("un curso se considera completado por estado, por fecha o al terminar todas las lecciones", () => {
  const base = { courses, modules, lessons, progress: [] };
  assert.equal(
    buildCourseRoutes({
      ...base,
      enrollments: [{ id: "e1", course_id: "c1", status: "completed" }],
    })[0].state,
    "completed",
  );
  assert.equal(
    buildCourseRoutes({
      ...base,
      enrollments: [{ id: "e1", course_id: "c1", completed_at: "2026-11-01T00:00:00Z" }],
    })[0].state,
    "completed",
  );
  const all = buildCourseRoutes({
    ...base,
    enrollments: [{ id: "e1", course_id: "c2" }],
    progress: [
      {
        enrollment_id: "e1",
        lesson_id: "l4",
        status: "completed",
        completed_at: "2026-11-10T15:00:00Z",
      },
    ],
  })[0];
  assert.equal(all.state, "completed");
  assert.equal(all.percent, 100);
  assert.equal(all.nextLessonTitle, null);
});

test("un curso sin lecciones publicadas no produce división por cero", () => {
  const routes = buildCourseRoutes({
    enrollments: [{ id: "e9", course_id: "c9" }],
    courses: [{ id: "c9", title: "Vacío" }],
    modules: [],
    lessons: [],
    progress: [],
  });
  assert.equal(routes[0].percent, 0);
  assert.equal(routes[0].state, "not_started");
  assert.deepEqual(overallProgress(routes), { total: 0, done: 0, percent: 0 });
});

test("overallProgress suma todos los cursos", () => {
  assert.deepEqual(
    overallProgress([
      { total: 3, done: 1 },
      { total: 1, done: 1 },
    ]),
    { total: 4, done: 2, percent: 50 },
  );
});

test("pendingActivities detecta sin entrega y cambios solicitados, y ordena por fecha límite", () => {
  const pending = pendingActivities({
    activities: [
      { id: "a1", title: "Logo" },
      { id: "a2", title: "Nota" },
      { id: "a3", title: "Guion" },
      { id: "a4", title: "Afiche" },
    ],
    assignments: [
      { id: "s1", activity_id: "a1", due_at: "2026-11-20T00:00:00Z" },
      { id: "s2", activity_id: "a2", due_at: "2026-11-18T00:00:00Z" },
      { id: "s3", activity_id: "a3", due_at: null },
      { id: "s4", activity_id: "a4", due_at: "2026-11-25T00:00:00Z" },
    ],
    submissions: [
      {
        activity_id: "a2",
        assignment_id: "s2",
        attempt_number: 1,
        status: "changes_requested",
        submitted_at: "2026-11-12T10:00:00Z",
      },
      {
        activity_id: "a4",
        assignment_id: "s4",
        attempt_number: 1,
        status: "graded",
        submitted_at: "2026-11-12T10:00:00Z",
      },
    ],
  });
  assert.deepEqual(
    pending.map((p) => p.title),
    ["Nota", "Logo", "Guion"],
  ); // a4 ya está calificada
  assert.equal(pending[0].reason, "changes_requested");
  assert.equal(pending[1].reason, "to_deliver");
});

test("si el reenvío posterior fue entregado, la actividad deja de estar pendiente", () => {
  const pending = pendingActivities({
    activities: [{ id: "a1", title: "Logo" }],
    assignments: [{ id: "s1", activity_id: "a1" }],
    submissions: [
      {
        activity_id: "a1",
        assignment_id: "s1",
        attempt_number: 1,
        status: "changes_requested",
        submitted_at: "2026-11-10T10:00:00Z",
      },
      {
        activity_id: "a1",
        assignment_id: "s1",
        attempt_number: 2,
        status: "submitted",
        submitted_at: "2026-11-11T10:00:00Z",
      },
    ],
  });
  assert.equal(pending.length, 0);
});

test("recentActivity mezcla eventos, los ordena del más reciente y respeta el límite", () => {
  const events = recentActivity({
    lessons,
    activities: [{ id: "a1", title: "Logo" }],
    assessments: [{ id: "ev1", title: "Quiz de fundamentos" }],
    progress: [
      {
        enrollment_id: "e1",
        lesson_id: "l1",
        status: "completed",
        completed_at: "2026-11-10T15:00:00Z",
      },
    ],
    submissions: [
      {
        activity_id: "a1",
        attempt_number: 1,
        status: "graded",
        submitted_at: "2026-11-11T10:00:00Z",
        reviewed_at: "2026-11-12T10:00:00Z",
      },
    ],
    attempts: [{ assessment_id: "ev1", passed: true, submitted_at: "2026-11-13T10:00:00Z" }],
  });
  assert.deepEqual(
    events.map((e) => e.status),
    ["passed", "graded", "submitted", "completed"],
  );
  assert.equal(
    recentActivity(
      {
        lessons,
        progress: [
          {
            enrollment_id: "e1",
            lesson_id: "l1",
            status: "completed",
            completed_at: "2026-11-10T15:00:00Z",
          },
        ],
      },
      0,
    ).length,
    0,
  );
});

test("nextSteps prioriza la actividad pendiente y siempre ofrece una acción", () => {
  const withPending = nextSteps({
    routes: [{ state: "in_progress", title: "Identidad", nextLessonTitle: "Aplicación" }],
    pending: [{ title: "Logo", reason: "to_deliver" }],
  });
  assert.equal(withPending[0].kind, "activity");
  assert.equal(withPending[1].detail, "Identidad · Aplicación");
  assert.ok(withPending.length <= 3);
  assert.ok(nextSteps({ routes: [], pending: [] }).length >= 1);
});

test("buildTracking sin datos devuelve una estructura vacía y válida", () => {
  const tracking = buildTracking({});
  assert.deepEqual(tracking.routes, []);
  assert.deepEqual(tracking.overall, { total: 0, done: 0, percent: 0 });
  assert.deepEqual(tracking.pending, []);
  assert.deepEqual(tracking.recent, []);
});
