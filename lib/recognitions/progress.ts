import type { createClient } from "@/lib/supabase/client";
import { buildProgress } from "@/lib/recognitions/engine.mjs";
import type { StudentProgress } from "@/lib/recognitions/engine.mjs";

type Supabase = ReturnType<typeof createClient>;

/**
 * Lee el progreso REAL del estudiante (solo lectura) y lo convierte en las métricas del motor de insignias.
 * Todas las consultas se filtran por el propio usuario y dependen de las políticas RLS existentes;
 * no se crea ni se modifica ninguna tabla.
 */
export async function loadStudentProgress(
  supabase: Supabase,
  userId: string,
): Promise<StudentProgress> {
  const { data: enrollments, error: enrollmentsError } = await supabase
    .from("course_enrollments")
    .select("id,course_id,status,completed_at")
    .eq("user_id", userId);
  if (enrollmentsError) throw enrollmentsError;

  const enrollmentIds = (enrollments ?? []).map((row) => row.id);

  const [lessons, submissions, attempts] = await Promise.all([
    enrollmentIds.length > 0
      ? supabase
          .from("lesson_progress")
          .select("completed_at")
          .in("enrollment_id", enrollmentIds)
          .eq("status", "completed")
      : Promise.resolve({ data: [] as { completed_at: string | null }[], error: null }),
    supabase
      .from("academic_activity_submissions")
      .select("assignment_id,status,submitted_at")
      .eq("user_id", userId),
    supabase
      .from("academic_assessment_attempts")
      .select("assessment_id,passed,submitted_at")
      .eq("user_id", userId),
  ]);

  if (lessons.error) throw lessons.error;
  if (submissions.error) throw submissions.error;
  if (attempts.error) throw attempts.error;

  return buildProgress({
    lessonCompletedAt: (lessons.data ?? []).map((row) => row.completed_at),
    submissions: submissions.data ?? [],
    attempts: attempts.data ?? [],
    enrollments: enrollments ?? [],
  });
}
