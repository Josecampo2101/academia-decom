import type {
  AssessmentAttempt,
  AssessmentAnswers,
  AssessmentResult,
  ManualAssessmentReview,
  QuestionResult,
} from "./assessment-attempts.ts";

export const ASSESSMENT_REVIEW_QUEUE_KEY = "academia-decom:assessment-review-queue:v1";

export type AssessmentReviewQueueItem = {
  id: string;
  studentId: string;
  studentLabel: string;
  attempt: AssessmentAttempt;
  createdAt: string;
  updatedAt: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function isAnswers(value: unknown): value is AssessmentAnswers {
  return isRecord(value) && Object.values(value).every((answer) =>
    typeof answer === "string" || (Array.isArray(answer) && answer.every((item) => typeof item === "string")),
  );
}

function isQuestionResult(value: unknown): value is QuestionResult {
  if (!isRecord(value)) return false;
  const { questionId, status, earnedPoints, possiblePoints } = value;
  if (typeof questionId !== "string" || !questionId) return false;
  if (status !== "correcta" && status !== "incorrecta" && status !== "revision_manual" && status !== "revisada") return false;
  if (typeof possiblePoints !== "number" || !Number.isFinite(possiblePoints) || possiblePoints <= 0) return false;
  if (status === "revision_manual") return earnedPoints === null;
  return typeof earnedPoints === "number" && Number.isFinite(earnedPoints) && earnedPoints >= 0 && earnedPoints <= possiblePoints;
}

function isManualReview(value: unknown): value is ManualAssessmentReview {
  if (!isRecord(value)) return false;
  return typeof value.questionId === "string" && !!value.questionId &&
    typeof value.reviewerId === "string" && !!value.reviewerId.trim() &&
    typeof value.feedback === "string" && !!value.feedback.trim() && value.feedback.length <= 2000 &&
    typeof value.earnedPoints === "number" && Number.isInteger(value.earnedPoints) && value.earnedPoints >= 0 &&
    typeof value.possiblePoints === "number" && Number.isInteger(value.possiblePoints) && value.possiblePoints > 0 &&
    value.earnedPoints <= value.possiblePoints &&
    typeof value.reviewedAt === "string" && Number.isFinite(Date.parse(value.reviewedAt));
}

function isResult(value: unknown): value is AssessmentResult {
  if (!isRecord(value) || !Array.isArray(value.questions) || !value.questions.every(isQuestionResult)) return false;
  const questionIds = value.questions.map((question) => question.questionId);
  if (new Set(questionIds).size !== questionIds.length) return false;
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

function parseAttempt(value: unknown, assessmentId: string): AssessmentAttempt | null {
  if (!isRecord(value) || value.assessmentId !== assessmentId ||
    typeof value.id !== "string" || !value.id ||
    typeof value.submittedAt !== "string" || !Number.isFinite(Date.parse(value.submittedAt)) ||
    !isAnswers(value.answers) || !isResult(value.result)) return null;

  const result = value.result;
  const reviews: ManualAssessmentReview[] = value.manualReviews === undefined ? [] : value.manualReviews as ManualAssessmentReview[];
  if (!Array.isArray(reviews) || !reviews.every(isManualReview)) return null;
  const reviewIds = reviews.map((review) => review.questionId);
  if (new Set(reviewIds).size !== reviewIds.length) return null;
  const reviewedQuestions = result.questions.filter((question) => question.status === "revisada");
  if (reviewedQuestions.length !== reviews.length) return null;
  const manualEarned = reviews.reduce((total, review) => total + review.earnedPoints, 0);
  const manualPossible = reviews.reduce((total, review) => total + review.possiblePoints, 0);
  if (reviews.length === 0) {
    if (result.manualEarned !== undefined || result.manualPossible !== undefined) return null;
  } else if (result.manualEarned !== manualEarned || result.manualPossible !== manualPossible) return null;
  const consistent = reviews.every((review) => {
    const question = result.questions.find((item) => item.questionId === review.questionId);
    return question?.status === "revisada" &&
      question.earnedPoints === review.earnedPoints &&
      question.possiblePoints === review.possiblePoints;
  });
  return consistent ? value as unknown as AssessmentAttempt : null;
}

function parseQueueItem(value: unknown): AssessmentReviewQueueItem | null {
  if (!isRecord(value) ||
    typeof value.id !== "string" || !value.id ||
    typeof value.studentId !== "string" || !value.studentId ||
    typeof value.studentLabel !== "string" ||
    typeof value.createdAt !== "string" || !Number.isFinite(Date.parse(value.createdAt)) ||
    typeof value.updatedAt !== "string" || !Number.isFinite(Date.parse(value.updatedAt)) ||
    !isRecord(value.attempt) || typeof value.attempt.assessmentId !== "string") return null;

  const attempt = parseAttempt(value.attempt, value.attempt.assessmentId);
  if (!attempt || value.id !== `${attempt.assessmentId}:${value.studentId}:${attempt.id}`) return null;
  return {
    id: value.id,
    studentId: value.studentId,
    studentLabel: value.studentLabel,
    attempt,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}

export function readAssessmentReviewQueue(): AssessmentReviewQueueItem[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(ASSESSMENT_REVIEW_QUEUE_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    const valid = parsed.map(parseQueueItem).filter((item): item is AssessmentReviewQueueItem => item !== null);
    const seen = new Set<string>();
    return valid.filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  } catch {
    return [];
  }
}

export function writeAssessmentReviewQueue(items: AssessmentReviewQueueItem[]): boolean {
  if (typeof window === "undefined" || !Array.isArray(items)) return false;
  const validated = items.map(parseQueueItem);
  if (validated.some((item) => item === null)) return false;
  const safeItems = validated as AssessmentReviewQueueItem[];
  if (new Set(safeItems.map((item) => item.id)).size !== safeItems.length) return false;
  try {
    window.localStorage.setItem(ASSESSMENT_REVIEW_QUEUE_KEY, JSON.stringify(safeItems));
    window.dispatchEvent(new CustomEvent("academia-decom:assessment-review-queue-updated"));
    return true;
  } catch {
    return false;
  }
}

export function upsertAssessmentReviewQueueItem(item: AssessmentReviewQueueItem): boolean {
  const validated = parseQueueItem(item);
  if (!validated) return false;
  const current = readAssessmentReviewQueue();
  const index = current.findIndex((entry) => entry.id === validated.id);
  if (index >= 0) {
    const existing = current[index];
    const existingUpdatedAt = Date.parse(existing.updatedAt);
    const incomingUpdatedAt = Date.parse(validated.updatedAt);

    // A delayed tab/event must never replace a newer tutor review with stale data.
    if (incomingUpdatedAt < existingUpdatedAt) return false;
    if (incomingUpdatedAt === existingUpdatedAt) {
      return JSON.stringify(validated) === JSON.stringify(existing);
    }

    // Queue identity and original submission metadata are immutable across updates.
    if (validated.createdAt !== existing.createdAt ||
      validated.attempt.submittedAt !== existing.attempt.submittedAt ||
      validated.attempt.assessmentId !== existing.attempt.assessmentId ||
      JSON.stringify(validated.attempt.answers) !== JSON.stringify(existing.attempt.answers)) {
      return false;
    }
    current[index] = validated;
  } else {
    current.unshift(validated);
  }
  return writeAssessmentReviewQueue(current);
}

export function getStudentAssessmentReviews(studentId: string): AssessmentReviewQueueItem[] {
  return readAssessmentReviewQueue().filter((item) => item.studentId === studentId);
}
