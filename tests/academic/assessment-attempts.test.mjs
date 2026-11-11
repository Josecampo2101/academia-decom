import test from "node:test";
import assert from "node:assert/strict";
import {
  createAssessmentAttempt,
  gradeAssessment,
  parseAssessmentAttempts,
} from "../../lib/academic/assessment-attempts.ts";

const questions = [
  { id: "single", type: "Selección única", prompt: "Pregunta única", options: ["A", "B"] },
  { id: "multiple", type: "Selección múltiple", prompt: "Pregunta múltiple", options: ["A", "B", "C"] },
  { id: "boolean", type: "Verdadero o falso", prompt: "Pregunta V/F", options: ["Verdadero", "Falso"] },
  { id: "short", type: "Respuesta corta", prompt: "Explica", options: [] },
];

test("gradeAssessment calcula preguntas objetivas y deja respuesta corta para revisión", () => {
  const result = gradeAssessment(
    questions,
    { single: ["B"], multiple: ["A", "C"], boolean: ["Verdadero"] },
    { single: "B", multiple: ["C", "A"], boolean: "Falso", short: "Una explicación" },
    { single: 2, multiple: 3, boolean: 1, short: 4 },
  );

  assert.equal(result.objectiveEarned, 5);
  assert.equal(result.objectivePossible, 6);
  assert.equal(result.pendingManual, 1);
  assert.deepEqual(result.questions.map(({ status }) => status), [
    "correcta",
    "correcta",
    "incorrecta",
    "revision_manual",
  ]);
  assert.equal(result.questions[3].earnedPoints, null);
  assert.equal(result.questions[3].possiblePoints, 4);
});

test("gradeAssessment exige coincidencia exacta en selección múltiple", () => {
  const result = gradeAssessment(
    [questions[1]],
    { multiple: ["A", "B"] },
    { multiple: ["A", "B", "C"] },
  );

  assert.equal(result.questions[0].status, "incorrecta");
  assert.equal(result.objectiveEarned, 0);
  assert.equal(result.objectivePossible, 1);
});

test("gradeAssessment usa un punto cuando el puntaje configurado no es válido", () => {
  const result = gradeAssessment(
    [questions[0]],
    { single: ["A"] },
    { single: "A" },
    { single: 0 },
  );

  assert.equal(result.questions[0].possiblePoints, 1);
  assert.equal(result.objectiveEarned, 1);
});

test("createAssessmentAttempt conserva respuestas y genera metadatos de envío", () => {
  const submittedAt = new Date("2026-11-11T15:00:00.000Z");
  const answers = { single: "B", short: "Texto" };
  const result = gradeAssessment([questions[0]], { single: ["B"] }, answers);
  const attempt = createAssessmentAttempt("assessment-1", answers, result, submittedAt);

  assert.match(attempt.id, /^assessment-1:1794409200000:/);
  assert.equal(attempt.assessmentId, "assessment-1");
  assert.equal(attempt.submittedAt, submittedAt.toISOString());
  assert.deepEqual(attempt.answers, answers);
  assert.notEqual(attempt.answers, answers);
});

test("parseAssessmentAttempts filtra JSON inválido, intentos de otra evaluación y registros corruptos", () => {
  assert.deepEqual(parseAssessmentAttempts("no-json", "assessment-1"), []);
  assert.deepEqual(parseAssessmentAttempts(JSON.stringify({ id: "not-an-array" }), "assessment-1"), []);

  const valid = createAssessmentAttempt(
    "assessment-1",
    { single: "A" },
    gradeAssessment([questions[0]], { single: ["A"] }, { single: "A" }),
    new Date("2026-11-11T15:00:00.000Z"),
  );
  const otherAssessment = { ...valid, id: "other", assessmentId: "assessment-2" };
  const corrupt = { ...valid, id: "corrupt", submittedAt: "yesterday", result: { ...valid.result, pendingManual: 99 } };

  assert.deepEqual(
    parseAssessmentAttempts(JSON.stringify([valid, otherAssessment, corrupt, null, "invalid"]), "assessment-1"),
    [valid],
  );
});

test("parseAssessmentAttempts devuelve una lista vacía para almacenamiento ausente", () => {
  assert.deepEqual(parseAssessmentAttempts(null, "assessment-1"), []);
});
