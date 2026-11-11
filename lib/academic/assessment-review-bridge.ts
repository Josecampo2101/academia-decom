import {
  parseAssessmentAttempts,
  type AssessmentAttempt,
} from "./assessment-attempts";

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

function parseQueueItem(value: unknown): AssessmentReviewQueueItem | null {
  if (!isRecord(value) ||
    typeof value.id !== "string" || !value.id ||
    typeof value.studentId !== "string" || !value.studentId ||
    typeof value.studentLabel !== "string" ||
    typeof value.createdAt !== "string" || !Number.isFinite(Date.parse(value.createdAt)) ||
    typeof value.updatedAt !== "string" || !Number.isFinite(Date.parse(value.updatedAt)) ||
    !isRecord(value.attempt) || typeof value.attempt.assessmentId !== "string") return null;

  const [attempt] = parseAssessmentAttempts(JSON.stringify([value.attempt]), value.attempt.assessmentId);
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
    return Array.isArray(parsed)
      ? parsed.map(parseQueueItem).filter((item): item is AssessmentReviewQueueItem => item !== null)
      : [];
  } catch {
    return [];
  }
}

export function writeAssessmentReviewQueue(items: AssessmentReviewQueueItem[]): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(ASSESSMENT_REVIEW_QUEUE_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent("academia-decom:assessment-review-queue-updated"));
    return true;
  } catch {
    return false;
  }
}

export function upsertAssessmentReviewQueueItem(item: AssessmentReviewQueueItem): boolean {
  const current = readAssessmentReviewQueue();
  const index = current.findIndex((entry) => entry.id === item.id);
  if (index >= 0) current[index] = item;
  else current.unshift(item);
  return writeAssessmentReviewQueue(current);
}

export function getStudentAssessmentReviews(studentId: string): AssessmentReviewQueueItem[] {
  return readAssessmentReviewQueue().filter((item) => item.studentId === studentId);
}
