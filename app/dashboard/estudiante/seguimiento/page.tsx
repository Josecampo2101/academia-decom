"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type AccessState = "checking" | "allowed" | "denied" | "error";
type CourseProgress = { id: string; name: string; completed: number; total: number; progress: number; status: string };
type Milestone = { id: string; date: string; title: string; description: string; status: string; timestamp: number };

function formatDate(value: string | null | undefined) {
  if (!value) return "Sin fecha";
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function StudentProgressPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [access, setAccess] = useState<AccessState>("checking");
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<CourseProgress[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [pendingActivities, setPendingActivities] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function loadProgress() {
      try {
        setLoading(true);
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) { router.replace("/conexion"); return; }

        const { data: assignments, error: assignmentError } = await supabase
          .from("user_role_assignments").select("role_id").eq("user_id", user.id);
        if (assignmentError) throw assignmentError;
        const roleIds = [...new Set((assignments ?? []).map((item) => item.role_id))];
        if (!roleIds.length) { if (active) setAccess("denied"); return; }

        const { data: roles, error: rolesError } = await supabase.from("roles").select("role_key").in("id", roleIds);
        if (rolesError) throw rolesError;
        const roleKeys = (roles ?? []).map((role) => role.role_key);
        if (!roleKeys.includes("member") && !roleKeys.includes("national_admin")) {
          if (active) setAccess("denied");
          return;
        }

        const { data: enrollments, error: enrollmentError } = await supabase
          .from("course_enrollments").select("id,course_id,status").eq("user_id", user.id)
          .in("status", ["active", "completed"]).order("enrolled_at", { ascending: false });
        if (enrollmentError) throw enrollmentError;

        const enrollmentRows = enrollments ?? [];
        const courseIds = [...new Set(enrollmentRows.map((row) => row.course_id))];
        const enrollmentIds = enrollmentRows.map((row) => row.id);
        const [courseResult, progressResult, assignmentResult] = await Promise.all([
          courseIds.length ? supabase.from("courses").select("id,title,status").in("id", courseIds) : Promise.resolve({ data: [], error: null }),
          enrollmentIds.length ? supabase.from("lesson_progress").select("id,enrollment_id,lesson_id,status,completed_at,updated_at").in("enrollment_id", enrollmentIds) : Promise.resolve({ data: [], error: null }),
          enrollmentIds.length ? supabase.from("academic_activity_assignments").select("id,activity_id,enrollment_id,due_at,status").in("enrollment_id", enrollmentIds).eq("status", "active") : Promise.resolve({ data: [], error: null }),
        ]);
        if (courseResult.error) throw courseResult.error;
        if (progressResult.error) throw progressResult.error;
        if (assignmentResult.error) throw assignmentResult.error;

        const [moduleResult, submissionResult] = await Promise.all([
          courseIds.length ? supabase.from("course_modules").select("id,course_id").in("course_id", courseIds).eq("status", "published") : Promise.resolve({ data: [], error: null }),
          enrollmentIds.length ? supabase.from("academic_activity_submissions").select("id,assignment_id,activity_id,status,submitted_at,updated_at").eq("user_id", user.id).in("enrollment_id", enrollmentIds) : Promise.resolve({ data: [], error: null }),
        ]);
        if (moduleResult.error) throw moduleResult.error;
        if (submissionResult.error) throw submissionResult.error;

        const moduleRows = moduleResult.data ?? [];
        const moduleIds = moduleRows.map((row) => row.id);
        const { data: lessons, error: lessonError } = moduleIds.length
          ? await supabase.from("lessons").select("id,module_id,title,status").in("module_id", moduleIds).eq("status", "published")
          : { data: [], error: null };
        if (lessonError) throw lessonError;

        const lessonRows = lessons ?? [];
        const courseByModule = new Map(moduleRows.map((row) => [row.id, row.course_id]));
        const totalByCourse = new Map<string, number>();
        for (const lesson of lessonRows) {
          const courseId = courseByModule.get(lesson.module_id);
          if (courseId) totalByCourse.set(courseId, (totalByCourse.get(courseId) ?? 0) + 1);
        }
        const completedByCourse = new Map<string, number>();
        const lessonCourse = new Map(lessonRows.map((lesson) => [lesson.id, courseByModule.get(lesson.module_id)]));
        const progressRows = progressResult.data ?? [];
        for (const progress of progressRows) {
          if (progress.status !== "completed") continue;
          const courseId = lessonCourse.get(progress.lesson_id);
          if (courseId) completedByCourse.set(courseId, (completedByCourse.get(courseId) ?? 0) + 1);
        }

        const courseRows = courseResult.data ?? [];
        const enrollmentCourseIds = new Set(enrollmentRows.map((row) => row.course_id));
        const courseProgress = courseRows.filter((course) => enrollmentCourseIds.has(course.id)).map((course) => {
          const total = totalByCourse.get(course.id) ?? 0;
          const completed = completedByCourse.get(course.id) ?? 0;
          return { id: course.id, name: course.title, completed, total, progress: total ? Math.round(completed / total * 100) : 0, status: enrollmentRows.find((row) => row.course_id === course.id)?.status ?? "active" };
        });

        const activityAssignments = assignmentResult.data ?? [];
        const submissionRows = submissionResult.data ?? [];
        const submissionsByAssignment = new Map(submissionRows.map((row) => [row.assignment_id, row]));
        const pending = activityAssignments.filter((assignment) => {
          const submission = submissionsByAssignment.get(assignment.id);
          return !submission || ["draft", "changes_requested"].includes(submission.status);
        });
        const activityIds = [...new Set(activityAssignments.map((row) => row.activity_id))];
        const { data: activities, error: activityError } = activityIds.length
          ? await supabase.from("academic_activities").select("id,title").in("id", activityIds)
          : { data: [], error: null };
        if (activityError) throw activityError;
        const activityNames = new Map((activities ?? []).map((item) => [item.id, item.title]));

        const events: Milestone[] = [];
        for (const progress of progressRows) {
          if (progress.status !== "completed") continue;
          const lesson = lessonRows.find((item) => item.id === progress.lesson_id);
          if (!lesson) continue;
          events.push({ id: "lesson-" + progress.id, date: formatDate(progress.completed_at ?? progress.updated_at), title: lesson.title ?? "Lección completada", description: "Lección marcada como completada.", status: "Completado", timestamp: new Date(progress.completed_at ?? progress.updated_at).getTime() || 0 });
        }
        for (const submission of submissionRows) {
          events.push({ id: "submission-" + submission.id, date: formatDate(submission.submitted_at ?? submission.updated_at), title: activityNames.get(submission.activity_id) ?? "Actividad académica", description: submission.status === "approved" ? "Entrega aprobada por tutoría." : submission.status === "changes_requested" ? "La tutoría solicitó ajustes." : submission.status === "submitted" ? "Entrega enviada y pendiente de revisión." : "Borrador de entrega guardado.", status: submission.status === "approved" ? "Aprobada" : submission.status === "changes_requested" ? "Ajustes" : submission.status === "submitted" ? "En revisión" : "Borrador", timestamp: new Date(submission.submitted_at ?? submission.updated_at).getTime() || 0 });
        }
        if (!active) return;
        setCourses(courseProgress);
        setPendingActivities(pending.length);
        setMilestones(events.sort((a, b) => b.timestamp - a.timestamp).slice(0, 8));
        setAccess("allowed");
        setError("");
      } catch (cause) {
        console.error("No fue posible cargar el seguimiento académico:", cause);
        if (active) { setError(cause instanceof Error ? cause.message : "No fue posible consultar el seguimiento."); setAccess("error"); }
      } finally {
        if (active) setLoading(false);
      }
    }
    void Promise.resolve().then(loadProgress);
    return () => { active = false; };
  }, [router, supabase]);

  if (access === "checking") return <main className="flex min-h-screen items-center justify-center bg-[#F4F7FA]"><p className="text-sm text-slate-500">Cargando tu seguimiento académico...</p></main>;
  if (access !== "allowed") return <main className="flex min-h-screen items-center justify-center bg-[#F4F7FA] px-6"><section className="max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center"><h1 className="text-xl font-bold text-[#102D4D]">{access === "error" ? "No pudimos cargar tu seguimiento" : "Acceso restringido"}</h1><p className="mt-2 text-sm text-slate-500">{error || "Esta sección está habilitada para estudiantes autorizados."}</p><button type="button" onClick={() => router.push("/dashboard/estudiante")} className="mt-5 rounded-xl bg-[#087DB5] px-5 py-3 text-sm font-semibold text-white">Volver al panel</button></section></main>;

  const completed = courses.reduce((sum, course) => sum + course.completed, 0);
  const total = courses.reduce((sum, course) => sum + course.total, 0);
  const overallProgress = total ? Math.round(completed / total * 100) : 0;
  const activeCourse = courses.find((course) => course.status === "active") ?? courses[0];

  return <main className="min-h-screen bg-[#F4F7FA] text-[#102D4D]">
    <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 md:px-8"><div><p className="text-xs font-extrabold tracking-[0.14em] text-[#087DB5]">ACADEMIA DECOM</p><p className="mt-1 text-xs text-slate-400">Seguimiento académico</p></div><button type="button" onClick={() => router.push("/dashboard/estudiante")} className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-600">← Panel del estudiante</button></div></header>
    <div className="mx-auto max-w-6xl space-y-7 px-5 py-7 md:px-8 md:py-9">
      <section className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#19A7A0]">Tu evolución</p><h1 className="mt-2 text-2xl font-extrabold md:text-3xl">Mi seguimiento</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Consulta tu avance a partir de las lecciones completadas y las entregas registradas.</p></div>{loading && <span className="text-xs text-slate-400">Actualizando...</span>}</section>
      <section className="grid gap-4 sm:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs font-semibold text-slate-400">Avance global</p><p className="mt-2 text-3xl font-extrabold">{overallProgress}%</p><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#19A7A0]" style={{ width: overallProgress + "%" }} /></div></article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs font-semibold text-slate-400">Lecciones completadas</p><p className="mt-2 text-3xl font-extrabold">{completed} <span className="text-base font-semibold text-slate-400">/ {total}</span></p></article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs font-semibold text-slate-400">Actividades por completar</p><p className="mt-2 text-3xl font-extrabold">{pendingActivities}</p></article>
      </section>
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6"><h2 className="text-lg font-bold">Ruta de formación</h2><p className="mt-1 text-xs text-slate-400">Cursos en los que tienes matrícula activa o completada.</p>
        {courses.length === 0 ? <p className="mt-5 rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">Aún no tienes matrículas académicas. Cuando se te asigne un curso, tu avance aparecerá aquí.</p> : <div className="mt-5 space-y-5">{courses.map((course, index) => <article key={course.id} className="flex gap-4"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#E5F2F8] text-xs font-bold text-[#087DB5]">{index + 1}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-bold">{course.name}</h3><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">{course.status === "completed" ? "Completado" : "En curso"}</span></div><p className="mt-1 text-xs text-slate-400">{course.completed} de {course.total} lecciones completadas</p><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#19A7A0]" style={{ width: course.progress + "%" }} /></div></div></article>)}</div>}
      </section>
      <section className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]"><article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6"><h2 className="text-lg font-bold">Actividad reciente</h2>
        {milestones.length === 0 ? <p className="mt-4 rounded-2xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500">Todavía no hay actividad académica registrada.</p> : <div className="mt-4 divide-y divide-slate-100">{milestones.map((item) => <div key={item.id} className="flex gap-3 py-4"><span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${item.status === "Completado" || item.status === "Aprobada" ? "bg-teal-500" : "bg-amber-400"}`} /><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="text-xs font-bold">{item.title}</h3><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-semibold text-slate-500">{item.status}</span></div><p className="mt-1 text-xs leading-5 text-slate-500">{item.description}</p><p className="mt-1 text-[10px] text-slate-400">{item.date}</p></div></div>)}</div>}</article>
        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6"><h2 className="text-lg font-bold">Próximos pasos</h2><p className="mt-1 text-xs text-slate-400">Accesos a tus actividades de formación.</p><div className="mt-5 space-y-3"><button type="button" onClick={() => router.push("/dashboard/estudiante/actividades")} className="w-full rounded-xl border border-slate-200 p-4 text-left transition hover:border-[#087DB5]"><span className="text-xs font-bold">Ver actividades</span><span className="mt-1 block text-[11px] text-slate-500">{pendingActivities ? pendingActivities + " actividades requieren atención" : "Consulta tus actividades asignadas"}</span></button><button type="button" onClick={() => router.push("/dashboard/estudiante/formacion")} className="w-full rounded-xl border border-slate-200 p-4 text-left transition hover:border-[#087DB5]"><span className="text-xs font-bold">Continuar formación</span><span className="mt-1 block text-[11px] text-slate-500">{activeCourse ? "Retoma " + activeCourse.name : "Consulta tus cursos matriculados"}</span></button><button type="button" onClick={() => router.push("/dashboard/estudiante/evaluaciones")} className="w-full rounded-xl border border-slate-200 p-4 text-left transition hover:border-[#087DB5]"><span className="text-xs font-bold">Consultar evaluaciones</span><span className="mt-1 block text-[11px] text-slate-500">Revisa tus evaluaciones disponibles y resultados</span></button></div></article>
      </section>
    </div>
  </main>;
}
