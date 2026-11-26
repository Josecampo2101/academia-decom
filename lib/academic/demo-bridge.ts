export type DemoReviewDecision = "Aprobar" | "Solicitar ajustes" | "Rechazar";
export type DemoBridgeAttempt = {
  number: number;
  submittedAt: string;
  answer: string;
  referenceUrl: string;
};
export type DemoBridgeReview = {
  decision: DemoReviewDecision;
  feedback: string;
  reviewedAt: string;
};
export type DemoBridgeSubmission = {
  id: string;
  studentId: string;
  studentName: string;
  activityId: string;
  activityTitle: string;
  course: string;
  status: "En revisión" | "Requiere ajustes" | "Calificada" | "Rechazada";
  attempts: DemoBridgeAttempt[];
  review: DemoBridgeReview | null;
  updatedAt: string;
};

export const DEMO_BRIDGE_STORAGE_KEY = "academia-decom:student-tutor-demo-bridge:v1";

export function readDemoBridge(): DemoBridgeSubmission[] {
  if (typeof window === "undefined") return [];
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(DEMO_BRIDGE_STORAGE_KEY) ?? "[]");
    return Array.isArray(value) ? (value as DemoBridgeSubmission[]) : [];
  } catch {
    return [];
  }
}

export function writeDemoBridge(submissions: DemoBridgeSubmission[]): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(DEMO_BRIDGE_STORAGE_KEY, JSON.stringify(submissions));
    window.dispatchEvent(new CustomEvent("academia-decom:demo-bridge-updated"));
    return true;
  } catch {
    return false;
  }
}

export function upsertDemoBridgeSubmission(submission: DemoBridgeSubmission): boolean {
  const current = readDemoBridge();
  const index = current.findIndex((item) => item.id === submission.id);
  if (index >= 0) current[index] = submission;
  else current.unshift(submission);
  return writeDemoBridge(current);
}
