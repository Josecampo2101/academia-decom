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
  status: "correcta" | "incorrecta" | "revision_manual";
  earnedPoints: number | null;
  possiblePoints: number;
};
export type AssessmentResult = {
  objectiveEarned: number;
  objectivePossible: number;
  pendingManual: number;
  questions: QuestionResult[];
};
export type AssessmentAttempt = {
  id: string;
  assessmentId: string;
  submittedAt: string;
  answers: AssessmentAnswers;
  result: AssessmentResult;
};

export const PRACTICE_ASSESSMENT_ID = "comprobacion-fundamentos-v1";
export const PRACTICE_ATTEMPTS_STORAGE_PREFIX = "academia-decom:assessment-attempts:v1";

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
    const possiblePoints = pointsByQuestion[question.id] ?? 1;
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
    id: `${assessmentId}:${now.getTime()}`,
    assessmentId,
    submittedAt: now.toISOString(),
    answers: JSON.parse(JSON.stringify(answers)) as AssessmentAnswers,
    result,
  };
}

export function parseAssessmentAttempts(value: string | null, assessmentId: string): AssessmentAttempt[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is AssessmentAttempt =>
      Boolean(item) && typeof item === "object" &&
      (item as AssessmentAttempt).assessmentId === assessmentId &&
      typeof (item as AssessmentAttempt).id === "string" &&
      typeof (item as AssessmentAttempt).submittedAt === "string" &&
      Boolean((item as AssessmentAttempt).answers) &&
      Boolean((item as AssessmentAttempt).result) &&
      Array.isArray((item as AssessmentAttempt).result.questions),
    );
  } catch {
    return [];
  }
}
