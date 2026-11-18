import { Suspense } from "react";
import TutorStudentDetailClient from "./student-detail-client";

async function RouteContent({ params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = await params;
  return <TutorStudentDetailClient studentId={studentId} />;
}

export default function TutorStudentDetailPage({ params }: { params: Promise<{ studentId: string }> }) {
  return <Suspense fallback={<main id="contenido" className="flex min-h-screen items-center justify-center bg-background"><p className="text-sm text-muted-fg">Cargando ficha del estudiante...</p></main>}>
    <RouteContent params={params} />
  </Suspense>;
}
