import type { createClient } from "@/lib/supabase/client";
import { buildTracking } from "@/lib/tracking/engine.mjs";
import type { Tracking } from "@/lib/tracking/engine.mjs";

type Supabase = ReturnType<typeof createClient>;

/** Devuelve las filas o lanza el error de Supabase; nunca devuelve null. */
function rows<T>(result: { data: T[] | null; error: unknown }): T[] {
  if (result.error) throw result.error;
  return result.data ?? [];
}

const none = Promise.resolve({ data: [], error: null });

/**
 * Lee el seguimiento REAL del estudiante (solo lectura) y calcula el avance con el motor puro.
 * Las consultas se filtran por el propio usuario o por sus matrículas y dependen de las políticas RLS
 * existentes; no se crea ni modifica ninguna tabla. Solo cuentan lecciones y módulos publicados.
 */
export async function loadStudentTracking(supabase: Supabase, userId: string): Promise<Tracking> {
  const enrollments = rows(
    await supabase
      .from("course_enrollments")
      .select("id,course_id,status,completed_at")
      .eq("user_id", userId),
  );
  if (enrollments.length === 0) return buildTracking({});

  const courseIds = [...new Set(enrollments.map((item) => item.course_id))];
  const enrollmentIds = enrollments.map((item) => item.id);

  const [courses, modules, progress, assignments, submissions, attempts] = await Promise.all([
    supabase.from("courses").select("id,title,sort_order").in("id", courseIds),
    supabase
      .from("course_modules")
      .select("id,course_id,sort_order,title")
      .in("course_id", courseIds)
      .eq("status", "published"),
    supabase
      .from("lesson_progress")
      .select("enrollment_id,lesson_id,status,completed_at")
      .in("enrollment_id", enrollmentIds),
    supabase
      .from("academic_activity_assignments")
      .select("id,activity_id,due_at")
      .in("enrollment_id", enrollmentIds),
    supabase
      .from("academic_activity_submissions")
      .select("activity_id,assignment_id,attempt_number,status,submitted_at,reviewed_at")
      .eq("user_id", userId),
    supabase
      .from("academic_assessment_attempts")
      .select("assessment_id,passed,submitted_at")
      .eq("user_id", userId),
  ]);

  const moduleRows = rows(modules);
  const assignmentRows = rows(assignments);
  const submissionRows = rows(submissions);
  const attemptRows = rows(attempts);

  const moduleIds = moduleRows.map((item) => item.id);
  const activityIds = [
    ...new Set([
      ...assignmentRows.map((item) => item.activity_id),
      ...submissionRows.map((item) => item.activity_id),
    ]),
  ];
  const assessmentIds = [...new Set(attemptRows.map((item) => item.assessment_id))];

  const [lessons, activities, assessments] = await Promise.all([
    moduleIds.length > 0
      ? supabase
          .from("lessons")
          .select("id,module_id,title,sort_order")
          .in("module_id", moduleIds)
          .eq("status", "published")
      : none,
    activityIds.length > 0
      ? supabase.from("academic_activities").select("id,title,due_at").in("id", activityIds)
      : none,
    assessmentIds.length > 0
      ? supabase.from("academic_assessments").select("id,title").in("id", assessmentIds)
      : none,
  ]);

  return buildTracking({
    enrollments,
    courses: rows(courses),
    modules: moduleRows,
    lessons: rows(
      lessons as {
        data: { id: string; module_id: string; title: string; sort_order: number }[] | null;
        error: unknown;
      },
    ),
    progress: rows(progress),
    assignments: assignmentRows,
    activities: rows(
      activities as {
        data: { id: string; title: string; due_at: string | null }[] | null;
        error: unknown;
      },
    ),
    submissions: submissionRows,
    attempts: attemptRows,
    assessments: rows(
      assessments as { data: { id: string; title: string }[] | null; error: unknown },
    ),
  });
}
