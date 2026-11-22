import test from "node:test";
import assert from "node:assert/strict";
import {
  BADGE_CATALOG,
  DEMO_PROGRESS,
  EMPTY_PROGRESS,
  LEVELS,
  buildProgress,
  evaluateBadges,
  levelFor,
  longestStreak,
  metricLabel,
  summarizeRecognitions,
} from "../../lib/recognitions/engine.mjs";

test("el catálogo es coherente: ids únicos, objetivos positivos y métricas conocidas", () => {
  const ids = BADGE_CATALOG.map((badge) => badge.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const badge of BADGE_CATALOG) {
    assert.ok(badge.target > 0, badge.id);
    assert.ok(badge.points > 0, badge.id);
    assert.ok(badge.metric in EMPTY_PROGRESS, `${badge.id}: métrica desconocida ${badge.metric}`);
    assert.ok(["bronze", "silver", "gold"].includes(badge.tier), badge.id);
  }
});

test("sin actividad no hay insignias, puntos 0 y nivel inicial", () => {
  const summary = summarizeRecognitions(evaluateBadges(EMPTY_PROGRESS));
  assert.equal(summary.earnedCount, 0);
  assert.equal(summary.points, 0);
  assert.equal(summary.level.name, "Aprendiz");
  assert.ok(summary.nextBadge, "debe sugerir una próxima insignia");
});

test("una insignia se obtiene exactamente al alcanzar su objetivo", () => {
  const below = evaluateBadges({ ...EMPTY_PROGRESS, lessonsCompleted: 4 }).find(
    (b) => b.id === "steady-learner",
  );
  const exact = evaluateBadges({ ...EMPTY_PROGRESS, lessonsCompleted: 5 }).find(
    (b) => b.id === "steady-learner",
  );
  assert.equal(below.earned, false);
  assert.equal(below.percent, 80);
  assert.equal(below.remaining, 1);
  assert.equal(exact.earned, true);
  assert.equal(exact.percent, 100);
});

test("el progreso mostrado nunca supera el objetivo", () => {
  const badge = evaluateBadges({ ...EMPTY_PROGRESS, lessonsCompleted: 99 }).find(
    (b) => b.id === "first-lesson",
  );
  assert.equal(badge.current, 1);
  assert.equal(badge.percent, 100);
  assert.equal(badge.remaining, 0);
});

test("los puntos suman solo las insignias obtenidas y definen el nivel", () => {
  const summary = summarizeRecognitions(evaluateBadges(DEMO_PROGRESS));
  const manual = evaluateBadges(DEMO_PROGRESS)
    .filter((b) => b.earned)
    .reduce((t, b) => t + b.points, 0);
  assert.equal(summary.points, manual);
  assert.ok(summary.earnedCount > 0 && summary.earnedCount < summary.total);
});

test("levelFor calcula avance hacia el siguiente nivel y el tope", () => {
  assert.equal(levelFor(0).name, "Aprendiz");
  assert.equal(levelFor(59).name, "Aprendiz");
  assert.equal(levelFor(60).name, "Practicante");
  const mid = levelFor(130);
  assert.equal(mid.name, "Practicante");
  assert.equal(mid.nextName, "Comunicador");
  assert.equal(mid.pointsToNext, 70);
  assert.equal(mid.percent, 50);
  const top = levelFor(10_000);
  assert.equal(top.name, LEVELS.at(-1).name);
  assert.equal(top.nextName, null);
  assert.equal(top.percent, 100);
});

test("longestStreak cuenta días consecutivos en hora de Colombia", () => {
  assert.equal(longestStreak([]), 0);
  assert.equal(
    longestStreak(["2026-11-10T15:00:00Z", "2026-11-11T15:00:00Z", "2026-11-12T15:00:00Z"]),
    3,
  );
  // hueco de un día: la racha más larga es 2
  assert.equal(
    longestStreak(["2026-11-10T15:00:00Z", "2026-11-11T15:00:00Z", "2026-11-13T15:00:00Z"]),
    2,
  );
  // varias actividades el mismo día cuentan una vez
  assert.equal(longestStreak(["2026-11-10T15:00:00Z", "2026-11-10T18:00:00Z"]), 1);
  // 04:30 UTC del 16 es 23:30 del 15 en Colombia: junto al 16 a las 15:00Z forman 2 días
  assert.equal(longestStreak(["2026-11-16T04:30:00Z", "2026-11-16T15:00:00Z"]), 2);
  // valores inválidos o vacíos se ignoran
  assert.equal(longestStreak([null, undefined, "no-es-fecha", "2026-11-10T15:00:00Z"]), 1);
});

test("buildProgress convierte filas reales sin contar duplicados", () => {
  const progress = buildProgress({
    lessonCompletedAt: ["2026-11-10T15:00:00Z", "2026-11-11T15:00:00Z"],
    submissions: [
      { assignment_id: "a1", status: "graded", submitted_at: "2026-11-11T16:00:00Z" },
      { assignment_id: "a1", status: "graded", submitted_at: "2026-11-12T16:00:00Z" }, // reintento: misma actividad
      { assignment_id: "a2", status: "submitted", submitted_at: "2026-11-12T17:00:00Z" },
      { assignment_id: "a3", status: "available", submitted_at: null }, // no entregada
    ],
    attempts: [
      { assessment_id: "e1", passed: true, submitted_at: "2026-11-12T18:00:00Z" },
      { assessment_id: "e1", passed: true, submitted_at: "2026-11-13T18:00:00Z" }, // misma evaluación
      { assessment_id: "e2", passed: false, submitted_at: "2026-11-13T19:00:00Z" },
    ],
    enrollments: [
      { course_id: "c1", status: "completed", completed_at: "2026-11-13T20:00:00Z" },
      { course_id: "c2", status: "active", completed_at: null },
    ],
  });
  assert.deepEqual(progress, {
    lessonsCompleted: 2,
    activitiesSubmitted: 2,
    activitiesGraded: 1,
    assessmentsPassed: 1,
    longestStreakDays: 4,
    coursesCompleted: 1,
  });
});

test("metricLabel concuerda en singular y plural", () => {
  assert.equal(metricLabel("coursesCompleted", 1), "curso completado");
  assert.equal(metricLabel("coursesCompleted", 3), "cursos completados");
  assert.equal(metricLabel("longestStreakDays", 1), "día seguido de actividad");
  assert.equal(metricLabel("lessonsCompleted", 0), "lecciones completadas");
});

test("buildProgress sin datos devuelve ceros", () => {
  assert.deepEqual(buildProgress(), EMPTY_PROGRESS);
});
