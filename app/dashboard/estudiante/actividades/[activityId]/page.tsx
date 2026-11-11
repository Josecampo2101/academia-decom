import StudentActivityClient from "./activity-client";

export default async function StudentActivityPage({
  params,
}: {
  params: Promise<{ activityId: string }>;
}) {
  const { activityId } = await params;
  return <StudentActivityClient activityId={activityId} />;
}
