import { Suspense } from "react";
import StudentActivityClient from "./activity-client";

async function RouteContent({ params }: { params: Promise<{ activityId: string }> }) {
  const { activityId } = await params;
  return <StudentActivityClient activityId={activityId} />;
}

function RouteFallback() {
  return (
    <main id="contenido" className="flex min-h-screen items-center justify-center bg-background px-6">
      <p className="text-sm text-muted-fg">Cargando la actividad...</p>
    </main>
  );
}

export default function RoutePage({ params }: { params: Promise<{ activityId: string }> }) {
  return (
    <Suspense fallback={<RouteFallback />}>
      <RouteContent params={params} />
    </Suspense>
  );
}
