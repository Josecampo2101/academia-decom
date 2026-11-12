import type {
  AssessmentAttempt,
  ManualAssessmentReview,
} from "./assessment-attempts.ts";

export type ManualAssessmentReviewInput = {
  questionId: string;
  reviewerId: string;
  earnedPoints: number;
  feedback: string;
  reviewedAt?: string;
};

export type ManualAssessmentReviewError =
  | "question_not_found"
  | "question_already_reviewed"
  | "question_not_pending"
  | "invalid_reviewer"
  | "invalid_score"
  | "invalid_feedback"
  | "invalid_review_date";

export type ManualAssessmentReviewResult =
  | { ok: true; attempt: AssessmentAttempt; review: ManualAssessmentReview }
  | { ok: false; error: ManualAssessmentReviewError };

export function reviewManualAnswer(
  attempt: AssessmentAttempt,
  input: ManualAssessmentReviewInput,
): ManualAssessmentReviewResult {
  const question = attempt.result.questions.find((item) => item.questionId === input.questionId);
  if (!question) return { ok: false, error: "question_not_found" };
  if (attempt.manualReviews?.some((review) => review.questionId === input.questionId)) {
    return { ok: false, error: "question_already_reviewed" };
  }
  if (question.status !== "revision_manual" || question.earnedPoints !== null) {
    return { ok: false, error: "question_not_pending" };
  }
  if (!input.reviewerId.trim()) return { ok: false, error: "invalid_reviewer" };
  if (!Number.isInteger(input.earnedPoints) || input.earnedPoints < 0 || input.earnedPoints > question.possiblePoints) {
    return { ok: false, error: "invalid_score" };
  }
  if (!input.feedback.trim() || input.feedback.length > 2000) {
    return { ok: false, error: "invalid_feedback" };
  }

  const reviewedAt = input.reviewedAt ?? new Date().toISOString();
  if (!Number.isFinite(Date.parse(reviewedAt))) return { ok: false, error: "invalid_review_date" };

  const review: ManualAssessmentReview = {
    questionId: question.questionId,
    reviewerId: input.reviewerId.trim(),
    feedback: input.feedback.trim(),
    earnedPoints: input.earnedPoints,
    possiblePoints: question.possiblePoints,
    reviewedAt,
  };

  const previousReviews = attempt.manualReviews ?? [];
  const manualEarned = previousReviews.reduce((total, item) => total + item.earnedPoints, 0) + review.earnedPoints;
  const manualPossible = previousReviews.reduce((total, item) => total + item.possiblePoints, 0) + review.possiblePoints;
  const updatedAttempt: AssessmentAttempt = {
    ...attempt,
    result: {
      ...attempt.result,
      manualEarned,
      manualPossible,
      pendingManual: Math.max(0, attempt.result.pendingManual - 1),
      questions: attempt.result.questions.map((item) => item.questionId === question.questionId
        ? { ...item, status: "revisada", earnedPoints: review.earnedPoints }
        : item),
    },
    manualReviews: [...previousReviews, review],
  };

  return { ok: true, attempt: updatedAttempt, review };
}
