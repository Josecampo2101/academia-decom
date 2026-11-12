import StudentAssessmentAttemptClient from "./student-assessment-attempt-client";

export const instant = false;

export default async function StudentAssessmentAttemptPage({
  params,
}: {
  params: Promise<{ assessmentId: string }>;
}) {
  const { assessmentId } = await params;
  return <StudentAssessmentAttemptClient assessmentId={assessmentId} />;
}
