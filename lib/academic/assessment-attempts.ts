export type AssessmentQuestionType = "Selección única" | "Selección múltiple" | "Verdadero o falso" | "Respuesta corta";
export type AssessmentAnswer = string | string[];
export type AssessmentAnswers = Record<string, AssessmentAnswer>;
export type AssessmentQuestion = {
  id: string;
  type: AssessmentQuestionType;
  prompt: string;
  options: string[];
};
export type AssessmentAnswerKey = Record<string, string[]>;
export type QuestionResult = {
  questionId: string;
  status: "correcta" | "incorrecta" | "revision_manual" | "revisada";
  earnedPoints: number | null;
  possiblePoints: number;
};
export type ManualAssessmentReview = {
  questionId: string;
  reviewerId: string;
  feedback: string;
  earnedPoints: number;
  possiblePoints: number;
  reviewedAt: string;
};
export type AssessmentResult = {
  objectiveEarned: number;
  objectivePossible: number;
  manualEarned?: number;
  manualPossible?: number;
  pendingManual: number;
  questions: QuestionResult[];
};
export type AssessmentAttempt = {
  id: string;
  assessmentId: string;
  submittedAt: string;
  answers: AssessmentAnswers;
  result: AssessmentResult;
  manualReviews?: ManualAssessmentReview[];
};

export const PRACTICE_ASSESSMENT_ID = "comprobacion-fundamentos-v1";
export const PRACTICE_ATTEMPTS_STORAGE_PREFIX = "academia-decom:assessment-attempts:v1";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function isAssessmentAnswers(value: unknown): value is AssessmentAnswers {
  return isRecord(value) && Object.values(value).every((answer) =>
    typeof answer === "string" || (Array.isArray(answer) && answer.every((item) => typeof item === "string")),
  );
}

function isQuestionResult(value: unknown): value is QuestionResult {
  if (!isRecord(value)) return false;
  const { questionId, status, earnedPoints, possiblePoints } = value;
  if (typeof questionId !== "string" || questionId.length === 0) return false;
  if (status !== "correcta" && status !== "incorrecta" && status !== "revision_manual" && status !== "revisada") return false;
  if (typeof possiblePoints !== "number" || !Number.isFinite(possiblePoints) || possiblePoints <= 0) return false;
  if (status === "revision_manual") return earnedPoints === null;
  return typeof earnedPoints === "number" && Number.isFinite(earnedPoints) && earnedPoints >= 0 && earnedPoints <= possiblePoints;
}

function isManualAssessmentReview(value: unknown): value is ManualAssessmentReview {
  if (!isRecord(value)) return false;
  return typeof value.questionId === "string" && value.questionId.length > 0 &&
    typeof value.reviewerId === "string" && value.reviewerId.trim().length > 0 &&
    typeof value.feedback === "string" && value.feedback.length <= 2000 &&
    typeof value.earnedPoints === "number" && Number.isInteger(value.earnedPoints) && value.earnedPoints >= 0 &&
    typeof value.possiblePoints === "number" && Number.isInteger(value.possiblePoints) && value.possiblePoints > 0 &&
    value.earnedPoints <= value.possiblePoints &&
    typeof value.reviewedAt === "string" && Number.isFinite(Date.parse(value.reviewedAt));
}

function isAssessmentResult(value: unknown): value is AssessmentResult {
  if (!isRecord(value) || !Array.isArray(value.questions) || !value.questions.every(isQuestionResult)) return false;
  const { objectiveEarned, objectivePossible, pendingManual, manualEarned, manualPossible } = value;
  const validManualTotals =
    (manualEarned === undefined && manualPossible === undefined) ||
    (typeof manualEarned === "number" && Number.isFinite(manualEarned) && manualEarned >= 0 &&
      typeof manualPossible === "number" && Number.isFinite(manualPossible) && manualPossible >= manualEarned);
  return typeof objectiveEarned === "number" && Number.isFinite(objectiveEarned) && objectiveEarned >= 0 &&
    typeof objectivePossible === "number" && Number.isFinite(objectivePossible) && objectivePossible >= objectiveEarned &&
    typeof pendingManual === "number" && Number.isInteger(pendingManual) && pendingManual >= 0 &&
    value.questions.filter((question) => question.status === "revision_manual").length === pendingManual &&
    validManualTotals;
}

function isAssessmentAttempt(value: unknown, assessmentId: string): value is AssessmentAttempt {
  if (!isRecord(value) || value.assessmentId !== assessmentId ||
    typeof value.id !== "string" || value.id.length === 0 ||
    typeof value.submittedAt !== "string" || !Number.isFinite(Date.parse(value.submittedAt)) ||
    !isAssessmentAnswers(value.answers) || !isAssessmentResult(value.result)) return false;

  if (value.manualReviews === undefined) return true;
  if (!Array.isArray(value.manualReviews) || !value.manualReviews.every(isManualAssessmentReview)) return false;
  const reviewIds = value.manualReviews.map((review) => review.questionId);
  if (new Set(reviewIds).size !== reviewIds.length) return false;
  return value.manualReviews.every((review) => {
    const question = value.result.questions.find((item) => item.questionId === review.questionId);
    return question?.status === "revisada" &&
      question.earnedPoints === review.earnedPoints &&
      question.possiblePoints === review.possiblePoints;
  });
}

export function gradeAssessment(
  questions: AssessmentQuestion[],
  answerKey: AssessmentAnswerKey,
  answers: AssessmentAnswers,
  pointsByQuestion: Record<string, number> = {},
): AssessmentResult {
  let objectiveEarned = 0;
  let objectivePossible = 0;
  let pendingManual = 0;
  const results = questions.map((question): QuestionResult => {
    const configuredPoints = pointsByQuestion[question.id] ?? 1;
    const possiblePoints = Number.isFinite(configuredPoints) && configuredPoints > 0 ? configuredPoints : 1;
    if (question.type === "Respuesta corta") {
      pendingManual += 1;
      return { questionId: question.id, status: "revision_manual", earnedPoints: null, possiblePoints };
    }
    objectivePossible += possiblePoints;
    const expected = [...(answerKey[question.id] ?? [])].sort();
    const raw = answers[question.id];
    const actual = (Array.isArray(raw) ? raw : typeof raw === "string" && raw ? [raw] : []).slice().sort();
    const correct = expected.length > 0 && expected.length === actual.length && expected.every((value, index) => value === actual[index]);
    if (correct) objectiveEarned += possiblePoints;
    return { questionId: question.id, status: correct ? "correcta" : "incorrecta", earnedPoints: correct ? possiblePoints : 0, possiblePoints };
  });
  return { objectiveEarned, objectivePossible, pendingManual, questions: results };
}

export function createAssessmentAttempt(
  assessmentId: string,
  answers: AssessmentAnswers,
  result: AssessmentResult,
  now = new Date(),
): AssessmentAttempt {
  return {
    id: `${assessmentId}:${now.getTime()}:${Math.random().toString(36).slice(2, 10)}`,
    assessmentId,
    submittedAt: now.toISOString(),
    answers: JSON.parse(JSON.stringify(answers)) as AssessmentAnswers,
    result: JSON.parse(JSON.stringify(result)) as AssessmentResult,
    manualReviews: [],
  };
}

export function parseAssessmentAttempts(value: string | null, assessmentId: string): AssessmentAttempt[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is AssessmentAttempt => isAssessmentAttempt(item, assessmentId));
  } catch {
    return [];
  }
}
