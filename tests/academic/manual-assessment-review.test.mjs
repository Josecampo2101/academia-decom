import test from "node:test";
import assert from "node:assert/strict";
import {
  createAssessmentAttempt,
  gradeAssessment,
  parseAssessmentAttempts,
} from "../../lib/academic/assessment-attempts.ts";
import { reviewManualAnswer } from "../../lib/academic/manual-assessment-review.ts";

const question = { id: "short", type: "Respuesta corta", prompt: "Explica el concepto", options: [] };
const makeAttempt = () => createAssessmentAttempt(
  "assessment-manual",
  { short: "Una respuesta del estudiante" },
  gradeAssessment([question], {}, { short: "Una respuesta del estudiante" }, { short: 5 }),
  new Date("2026-11-11T16:00:00.000Z"),
);
const validInput = {
  questionId: "short",
  reviewerId: "tutor-123",
  earnedPoints: 4,
  feedback: "La explicación es correcta, pero falta desarrollar un ejemplo.",
  reviewedAt: "2026-11-11T17:00:00.000Z",
};

test("reviewManualAnswer asigna puntaje y retroalimentación sin alterar el intento original", () => {
  const original = makeAttempt();
  const result = reviewManualAnswer(original, validInput);

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.attempt.result.questions[0].status, "revisada");
  assert.equal(result.attempt.result.questions[0].earnedPoints, 4);
  assert.equal(result.attempt.result.pendingManual, 0);
  assert.equal(result.attempt.result.manualEarned, 4);
  assert.equal(result.attempt.result.manualPossible, 5);
  assert.equal(result.review.reviewerId, "tutor-123");
  assert.equal(original.result.questions[0].status, "revision_manual");
  assert.equal(original.result.pendingManual, 1);
  assert.equal(original.manualReviews?.length ?? 0, 0);
});

test("reviewManualAnswer rechaza puntuaciones negativas, fraccionarias o superiores al máximo", () => {
  for (const earnedPoints of [-1, 1.5, 6]) {
    const result = reviewManualAnswer(makeAttempt(), { ...validInput, earnedPoints });
    assert.deepEqual(result, { ok: false, error: "invalid_score" });
  }
});

test("reviewManualAnswer exige tutor, retroalimentación y fecha válidos", () => {
  assert.deepEqual(reviewManualAnswer(makeAttempt(), { ...validInput, reviewerId: " " }), { ok: false, error: "invalid_reviewer" });
  assert.deepEqual(reviewManualAnswer(makeAttempt(), { ...validInput, feedback: "  " }), { ok: false, error: "invalid_feedback" });
  assert.deepEqual(reviewManualAnswer(makeAttempt(), { ...validInput, feedback: "x".repeat(2001) }), { ok: false, error: "invalid_feedback" });
  assert.deepEqual(reviewManualAnswer(makeAttempt(), { ...validInput, reviewedAt: "fecha" }), { ok: false, error: "invalid_review_date" });
});

test("reviewManualAnswer no permite revisar dos veces la misma respuesta", () => {
  const first = reviewManualAnswer(makeAttempt(), validInput);
  assert.equal(first.ok, true);
  if (!first.ok) return;
  assert.deepEqual(reviewManualAnswer(first.attempt, validInput), { ok: false, error: "question_already_reviewed" });
});

test("reviewManualAnswer distingue pregunta inexistente y pregunta que no requiere revisión", () => {
  const attempt = makeAttempt();
  assert.deepEqual(reviewManualAnswer(attempt, { ...validInput, questionId: "missing" }), { ok: false, error: "question_not_found" });

  const objectiveAttempt = createAssessmentAttempt(
    "assessment-manual",
    { choice: "A" },
    gradeAssessment([{ id: "choice", type: "Selección única", prompt: "Elige", options: ["A"] }], { choice: ["A"] }, { choice: "A" }),
  );
  assert.deepEqual(reviewManualAnswer(objectiveAttempt, { ...validInput, questionId: "choice" }), { ok: false, error: "question_not_pending" });
});

test("parseAssessmentAttempts conserva revisiones manuales válidas", () => {
  const reviewed = reviewManualAnswer(makeAttempt(), validInput);
  assert.equal(reviewed.ok, true);
  if (!reviewed.ok) return;
  const restored = parseAssessmentAttempts(JSON.stringify([reviewed.attempt]), "assessment-manual");
  assert.deepEqual(restored, [reviewed.attempt]);
});

test("parseAssessmentAttempts descarta revisiones manuales inconsistentes", () => {
  const reviewed = reviewManualAnswer(makeAttempt(), validInput);
  assert.equal(reviewed.ok, true);
  if (!reviewed.ok) return;
  const corrupted = {
    ...reviewed.attempt,
    result: { ...reviewed.attempt.result, pendingManual: 1 },
  };
  assert.deepEqual(parseAssessmentAttempts(JSON.stringify([corrupted]), "assessment-manual"), []);
});
