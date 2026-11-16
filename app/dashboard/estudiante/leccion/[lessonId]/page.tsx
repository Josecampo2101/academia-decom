import { Suspense } from "react";
import LessonViewerClient from "./lesson-client";

async function RouteContent({ params }: { params: Promise<{ lessonId: string }> }) {
  const { lessonId } = await params;
  return <LessonViewerClient lessonId={lessonId} />;
}

function RouteFallback() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <p className="text-sm text-muted-fg">Cargando la lección...</p>
    </main>
  );
}

export default function RoutePage({ params }: { params: Promise<{ lessonId: string }> }) {
  return (
    <Suspense fallback={<RouteFallback />}>
      <RouteContent params={params} />
    </Suspense>
  );
}
