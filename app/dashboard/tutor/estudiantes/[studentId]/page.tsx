import { Suspense } from "react";
import TutorStudentDetailClient from "./student-detail-client";

async function RouteContent({ params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = await params;
  return <TutorStudentDetailClient studentId={studentId} />;
}

export default function TutorStudentDetailPage({ params }: { params: Promise<{ studentId: string }> }) {
  return <Suspense fallback={<main className="flex min-h-screen items-center justify-center bg-[#F4F7FA]"><p className="text-sm text-slate-500">Cargando ficha del estudiante...</p></main>}>
    <RouteContent params={params} />
  </Suspense>;
}
