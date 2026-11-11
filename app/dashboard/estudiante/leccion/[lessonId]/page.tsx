import LessonViewerClient from "./lesson-client";

export default async function LessonViewerPage({
  params,
}: {
  params: Promise<{ lessonId: string }>;
}) {
  const { lessonId } = await params;
  return <LessonViewerClient lessonId={lessonId} />;
}
