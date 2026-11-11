import test from "node:test";
import assert from "node:assert/strict";
import { createAssessmentAttempt, gradeAssessment } from "../../lib/academic/assessment-attempts.ts";
import {
  getStudentAssessmentReviews,
  readAssessmentReviewQueue,
  upsertAssessmentReviewQueueItem,
  writeAssessmentReviewQueue,
} from "../../lib/academic/assessment-review-bridge.ts";

const previousWindow = globalThis.window;
const storage = new Map();
let dispatchCount = 0;
globalThis.window = {
  localStorage: {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
  },
  dispatchEvent: () => { dispatchCount += 1; return true; },
};
const question = { id: "short", type: "Respuesta corta", prompt: "Explica", options: [] };
const attempt = createAssessmentAttempt(
  "assessment-bridge",
  { short: "Respuesta de prueba" },
  gradeAssessment([question], {}, { short: "Respuesta de prueba" }),
  new Date("2026-11-11T18:00:00.000Z"),
);
const item = {
  id: "assessment-bridge:student-1:" + attempt.id,
  studentId: "student-1",
  studentLabel: "Estudiante de prueba",
  attempt,
  createdAt: attempt.submittedAt,
  updatedAt: attempt.submittedAt,
};

test("upsertAssessmentReviewQueueItem guarda y recupera un intento válido", () => {
  assert.equal(upsertAssessmentReviewQueueItem(item), true);
  assert.deepEqual(readAssessmentReviewQueue(), [item]);
  assert.deepEqual(getStudentAssessmentReviews("student-1"), [item]);
  assert.deepEqual(getStudentAssessmentReviews("student-2"), []);
  assert.equal(dispatchCount, 1);
});

test("upsertAssessmentReviewQueueItem actualiza el intento sin duplicarlo", () => {
  const updated = { ...item, studentLabel: "Nombre actualizado", updatedAt: "2026-11-11T19:00:00.000Z" };
  assert.equal(upsertAssessmentReviewQueueItem(updated), true);
  assert.equal(readAssessmentReviewQueue().length, 1);
  assert.equal(readAssessmentReviewQueue()[0].studentLabel, "Nombre actualizado");
});

test("readAssessmentReviewQueue descarta registros corruptos y claves inconsistentes", () => {
  storage.set("academia-decom:assessment-review-queue:v1", JSON.stringify([
    item,
    { ...item, id: "id-incorrecto" },
    { ...item, attempt: { ...attempt, result: { ...attempt.result, pendingManual: 5 } } },
    null,
  ]));
  assert.deepEqual(readAssessmentReviewQueue(), [item]);
});

test("writeAssessmentReviewQueue devuelve false si localStorage falla", () => {
  const originalSetItem = globalThis.window.localStorage.setItem;
  globalThis.window.localStorage.setItem = () => { throw new Error("quota"); };
  assert.equal(writeAssessmentReviewQueue([item]), false);
  globalThis.window.localStorage.setItem = originalSetItem;
});

test.after(() => {
  if (previousWindow === undefined) delete globalThis.window;
  else globalThis.window = previousWindow;
});
