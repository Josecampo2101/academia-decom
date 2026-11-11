import test from "node:test";
import assert from "node:assert/strict";
import {
  createAssessmentAttempt,
  gradeAssessment,
  parseAssessmentAttempts,
} from "../../lib/academic/assessment-attempts.ts";
import { reviewManualAnswer } from "../../lib/academic/manual-assessment-review.ts";
import {
  getStudentAssessmentReviews,
  upsertAssessmentReviewQueueItem,
} from "../../lib/academic/assessment-review-bridge.ts";

const previousWindow = globalThis.window;
const storage = new Map();
globalThis.window = {
  localStorage: {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
  },
  dispatchEvent: () => true,
} as unknown as Window & typeof globalThis;

test("el flujo estudiante-tutor-estudiante conserva y devuelve la revisión manual", () => {
  const studentId = "student-flow-1";
  const question = {
    id: "short-answer",
    type: "Respuesta corta",
    prompt: "Explica el propósito del mensaje",
    options: [],
  };
  const originalAttempt = createAssessmentAttempt(
    "assessment-flow",
    { "short-answer": "Comunicar con claridad" },
    gradeAssessment(
      [question],
      {},
      { "short-answer": "Comunicar con claridad" },
    ),
    new Date("2026-11-11T18:00:00.000Z"),
  );
  const queueItem = {
    id: `assessment-flow:${studentId}:${originalAttempt.id}`,
    studentId,
    studentLabel: "Estudiante de prueba",
    attempt: originalAttempt,
    createdAt: originalAttempt.submittedAt,
    updatedAt: originalAttempt.submittedAt,
  };

  // El estudiante envía el intento y este aparece en la bandeja compartida.
  assert.equal(upsertAssessmentReviewQueueItem(queueItem), true);
  const tutorInbox = getStudentAssessmentReviews(studentId);
  assert.equal(tutorInbox.length, 1);
  assert.equal(tutorInbox[0].attempt.result.pendingManual, 1);

  // El tutor califica la respuesta y actualiza el mismo registro, sin duplicarlo.
  const reviewed = reviewManualAnswer(tutorInbox[0].attempt, {
    questionId: "short-answer",
    reviewerId: "tutor-flow-1",
    earnedPoints: 1,
    feedback: "Respuesta clara y pertinente.",
    reviewedAt: "2026-11-11T18:30:00.000Z",
  });
  assert.equal(reviewed.ok, true);
  if (!reviewed.ok) return;

  assert.equal(upsertAssessmentReviewQueueItem({
    ...tutorInbox[0],
    attempt: reviewed.attempt,
    updatedAt: reviewed.review.reviewedAt,
  }), true);

  // El estudiante recupera el resultado actualizado al consultar sus revisiones.
  const studentInbox = getStudentAssessmentReviews(studentId);
  assert.equal(studentInbox.length, 1);
  const returnedAttempt = studentInbox[0].attempt;
  assert.equal(returnedAttempt.result.pendingManual, 0);
  assert.equal(returnedAttempt.result.manualEarned, 1);
  assert.equal(returnedAttempt.result.manualPossible, 1);
  assert.equal(returnedAttempt.result.questions[0].status, "revisada");
  assert.equal(returnedAttempt.manualReviews?.[0].feedback, "Respuesta clara y pertinente.");

  // El parser usado al restaurar el historial acepta el intento ya revisado.
  const [restoredAttempt] = parseAssessmentAttempts(
    JSON.stringify([returnedAttempt]),
    "assessment-flow",
  );
  assert.deepEqual(restoredAttempt, returnedAttempt);

  // La operación de revisión no muta la copia original del intento.
  assert.equal(originalAttempt.result.pendingManual, 1);
  assert.equal(originalAttempt.manualReviews?.length ?? 0, 0);
});

test.after(() => {
  if (previousWindow === undefined) delete globalThis.window;
  else globalThis.window = previousWindow;
});
