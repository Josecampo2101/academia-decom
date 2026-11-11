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

test("upsertAssessmentReviewQueueItem rechaza escrituras atrasadas", () => {
  const newer = { ...item, updatedAt: "2026-11-11T20:00:00.000Z" };
  assert.equal(upsertAssessmentReviewQueueItem(newer), true);
  const dispatchesAfterNewerWrite = dispatchCount;

  assert.equal(upsertAssessmentReviewQueueItem(item), false);
  assert.equal(readAssessmentReviewQueue()[0].updatedAt, newer.updatedAt);
  assert.equal(dispatchCount, dispatchesAfterNewerWrite);
});

test("upsertAssessmentReviewQueueItem trata repetición idéntica como idempotente", () => {
  const dispatchesBefore = dispatchCount;
  assert.equal(upsertAssessmentReviewQueueItem(item), true);
  assert.equal(upsertAssessmentReviewQueueItem(item), true);
  assert.equal(dispatchCount, dispatchesBefore + 1);
});

test("upsertAssessmentReviewQueueItem rechaza cambios de identidad o envío original", () => {
  assert.equal(upsertAssessmentReviewQueueItem(item), true);
  const changedSubmission = {
    ...item,
    updatedAt: "2026-11-11T21:00:00.000Z",
    attempt: { ...attempt, answers: { short: "Respuesta alterada" } },
  };
  assert.equal(upsertAssessmentReviewQueueItem(changedSubmission), false);
  assert.equal(readAssessmentReviewQueue()[0].attempt.answers.short, "Respuesta de prueba");
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

test("readAssessmentReviewQueue elimina IDs duplicados sin duplicar intentos", () => {
  storage.set("academia-decom:assessment-review-queue:v1", JSON.stringify([item, item]));
  assert.deepEqual(readAssessmentReviewQueue(), [item]);
});

test("writeAssessmentReviewQueue rechaza elementos inválidos y duplicados", () => {
  const dispatchesBefore = dispatchCount;
  const storedBefore = storage.get("academia-decom:assessment-review-queue:v1");
  assert.equal(writeAssessmentReviewQueue([{ ...item, id: "incorrecto" }]), false);
  assert.equal(writeAssessmentReviewQueue([item, item]), false);
  assert.equal(dispatchCount, dispatchesBefore);
  assert.equal(storage.get("academia-decom:assessment-review-queue:v1"), storedBefore);
});


test("writeAssessmentReviewQueue rechaza resultados con IDs de pregunta duplicados", () => {
  const duplicatedAttempt = {
    ...attempt,
    result: {
      ...attempt.result,
      pendingManual: 2,
      questions: [...attempt.result.questions, ...attempt.result.questions],
    },
  };
  assert.equal(writeAssessmentReviewQueue([{ ...item, attempt: duplicatedAttempt }]), false);
});

test("writeAssessmentReviewQueue rechaza revisiones con feedback solo de espacios", () => {
  const reviewedAttempt = {
    ...attempt,
    result: {
      ...attempt.result,
      pendingManual: 0,
      manualEarned: 0,
      manualPossible: 1,
      questions: [{ questionId: "short", status: "revisada", earnedPoints: 0, possiblePoints: 1 }],
    },
    manualReviews: [{
      questionId: "short",
      reviewerId: "tutor-1",
      feedback: "   ",
      earnedPoints: 0,
      possiblePoints: 1,
      reviewedAt: "2026-11-11T19:00:00.000Z",
    }],
  };
  assert.equal(writeAssessmentReviewQueue([{ ...item, attempt: reviewedAttempt }]), false);
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
