"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type AccessState = "checking" | "allowed" | "denied" | "error";
type Course = { id: string; title: string; status: string; district_id: string; studentCount: number };
type TutorRosterRow = {
  course_id: string;
  course_title: string;
  student_id: string;
  student_name: string;
  enrollment_id: string;
  enrollment_status: string;
  enrolled_at: string;
};
type StudentRosterItem = { id: string; name: string; course: string; status: string; enrolledAt: string };
type ReviewItem = {
  id: string;
  student: string;
  activity: string;
  course: string;
  submittedAt: string | null;
  dueAt: string | null;
  status: "submitted";
};

function formatDate(value: string | null) {
  if (!value) return "Fecha no disponible";
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function TutorDashboardPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [access, setAccess] = useState<AccessState>("checking");
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState("Tutor");
  const [courses, setCourses] = useState<Course[]>([]);
  const [students, setStudents] = useState<StudentRosterItem[]>([]);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [studentCount, setStudentCount] = useState(0);
  const [reviewedThisWeek, setReviewedThisWeek] = useState(0);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      setLoading(true);
      setError("");
      if (authError || !user) {
        router.replace("/conexion");
        return;
      }

      const name = user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email?.split("@")[0] ?? "Tutor";
      setDisplayName(String(name));

      const { data: roleRows, error: roleError } = await supabase
        .from("user_role_assignments").select("role_id").eq("user_id", user.id);
      if (roleError) throw roleError;
      const roleIds = [...new Set((roleRows ?? []).map((row) => row.role_id))];
      if (!roleIds.length) {
        setAccess("denied");
        return;
      }

      const { data: roleRecords, error: rolesError } = await supabase
        .from("roles").select("role_key").in("id", roleIds);
      if (rolesError) throw rolesError;
      const roleKeys = (roleRecords ?? []).map((role) => role.role_key);
      if (!roleKeys.includes("tutor") && !roleKeys.includes("national_admin")) {
        setAccess("denied");
        return;
      }

      const { data: assignmentRows, error: assignmentError } = await supabase
        .from("academic_course_tutor_assignments")
        .select("course_id,district_id,courses!academic_course_tutor_assignments_course_district_fk(id,title,status)")
        .eq("tutor_user_id", user.id)
        .eq("status", "active");
      if (assignmentError) throw assignmentError;

      const assignedCourses = (assignmentRows ?? [])
        .map((row) => {
          const related = (row as unknown as {
            course_id: string;
            district_id: string;
            courses: { id: string; title: string; status: string } | null;
          }).courses;
          return related ? { ...related, district_id: row.district_id, studentCount: 0 } : null;
        })
        .filter((course): course is Course => Boolean(course));
      const courseIds = [...new Set(assignedCourses.map((course) => course.id))];

      if (!courseIds.length) {
        setCourses([]);
        setStudents([]);
        setReviews([]);
        setStudentCount(0);
        setReviewedThisWeek(0);
        setAccess("allowed");
        return;
      }

      const { data: rosterRows, error: rosterError } = await supabase.rpc("get_tutor_course_roster");
      if (rosterError) throw rosterError;
      const roster = (rosterRows ?? []) as TutorRosterRow[];
      const studentNames = new Map<string, string>();
      const activeStudentsByCourse = new Map<string, Set<string>>();
      for (const row of roster) {
        studentNames.set(row.student_id, row.student_name || "Estudiante");
        if (row.enrollment_status === "active") {
          const studentsInCourse = activeStudentsByCourse.get(row.course_id) ?? new Set<string>();
          studentsInCourse.add(row.student_id);
          activeStudentsByCourse.set(row.course_id, studentsInCourse);
        }
      }
      const coursesWithCounts = assignedCourses.map((course) => ({
        ...course,
        studentCount: activeStudentsByCourse.get(course.id)?.size ?? 0,
      }));
      setStudentCount(new Set(roster.filter((row) => row.enrollment_status === "active").map((row) => row.student_id)).size);
      setStudents(roster.map((row) => ({
        id: row.enrollment_id,
        name: row.student_name || "Estudiante",
        course: row.course_title,
        status: row.enrollment_status,
        enrolledAt: row.enrolled_at,
      })));

      const { data: submissionRows, error: submissionError } = await supabase
        .from("academic_activity_submissions")
        .select("id,activity_id,user_id,status,submitted_at,academic_activities!inner(title,course_id,due_at,courses(title))")
        .eq("status", "submitted")
        .in("academic_activities.course_id", courseIds)
        .order("submitted_at", { ascending: true });
      if (submissionError) throw submissionError;

      const rawReviews = (submissionRows ?? []) as unknown as Array<{
        id: string;
        activity_id: string;
        user_id: string;
        status: "submitted";
        submitted_at: string | null;
        academic_activities: { title: string; course_id: string; due_at: string | null; courses: { title: string } | null };
      }>;

      const courseNames = new Map(coursesWithCounts.map((course) => [course.id, course.title]));
      setCourses(coursesWithCounts);
      setReviews(rawReviews.map((row) => ({
        id: row.id,
        student: studentNames.get(row.user_id) ?? "Estudiante",
        activity: row.academic_activities.title,
        course: row.academic_activities.courses?.title ?? courseNames.get(row.academic_activities.course_id) ?? "Curso asignado",
        submittedAt: row.submitted_at,
        dueAt: row.academic_activities.due_at,
        status: row.status,
      })));

      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const { count, error: reviewedError } = await supabase
        .from("academic_activity_submission_reviews")
        .select("id", { count: "exact", head: true })
        .eq("reviewed_by", user.id)
        .gte("reviewed_at", new Date(weekAgo).toISOString());
      if (reviewedError) throw reviewedError;
      setReviewedThisWeek(count ?? 0);
      setAccess("allowed");
    } catch (cause) {
      console.error("No fue posible cargar el panel del tutor:", cause);
      setError(cause instanceof Error ? cause.message : "No fue posible consultar la información académica.");
      setAccess("error");
    } finally {
      setLoading(false);
    }
  }, [router, supabase]);

  useEffect(() => { let active = true; void Promise.resolve().then(() => { if (active) return load(); }); return () => { active = false; }; }, [load]);

  const visibleReviews = reviews.filter((item) => {
    const query = search.trim().toLocaleLowerCase("es");
    return !query || [item.student, item.activity, item.course].some((value) => value.toLocaleLowerCase("es").includes(query));
  });

  if (access === "checking" || loading) {
    return <main className="flex min-h-screen items-center justify-center bg-[#F4F7FA]"><div className="h-10 w-10 animate-spin rounded-full border-4 border-[#087DB5]/20 border-t-[#087DB5]" /></main>;
  }

  if (access !== "allowed") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F4F7FA] px-6">
        <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center">
          <h1 className="text-xl font-bold text-[#102D4D]">{access === "denied" ? "Acceso restringido" : "No fue posible abrir el panel"}</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">{error || "Este espacio está habilitado para tutores con acceso autorizado."}</p>
          <div className="mt-5 flex justify-center gap-2">
            <button type="button" onClick={() => void load()} className="rounded-xl bg-[#087DB5] px-4 py-2.5 text-xs font-semibold text-white">Reintentar</button>
            <button type="button" onClick={() => router.push("/dashboard")} className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-600">Panel general</button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F4F7FA] text-[#102D4D]">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-5 py-4 md:px-8">
          <div><p className="text-sm font-extrabold tracking-wide">ACADEMIA DECOM</p><p className="text-xs text-slate-400">Espacio de acompañamiento académico</p></div>
          <div className="flex items-center gap-3">
            <span className="hidden text-right sm:block"><span className="block text-sm font-semibold">{displayName}</span><span className="block text-xs text-slate-400">Panel del tutor</span></span>
            <button type="button" onClick={() => router.push("/dashboard")} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">Panel general</button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1500px] space-y-7 px-5 py-7 pb-12 md:px-8 md:py-9">
        <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#19A7A0]">Acompañamiento y evaluación</p>
            <h1 className="mt-2 text-2xl font-extrabold tracking-tight md:text-3xl">Panel del tutor</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Consulta tus cursos asignados, acompaña las matrículas y prioriza las entregas pendientes.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => router.push("/dashboard/planificador")} className="rounded-xl border border-[#19A7A0] px-4 py-2.5 text-xs font-bold text-[#138b84] hover:bg-teal-50">Preparar clase</button>
            <button type="button" onClick={() => router.push("/dashboard/tutor/calificaciones")} className="rounded-xl bg-[#087DB5] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#066a9b]">Revisar actividades</button>
            <button type="button" onClick={() => router.push("/dashboard/tutor/evaluaciones")} className="rounded-xl border border-[#087DB5] px-4 py-2.5 text-xs font-bold text-[#087DB5] hover:bg-sky-50">Revisar evaluaciones</button>
            <button type="button" onClick={() => void load()} className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">Actualizar</button>
          </div>
        </section>

        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-xs text-red-700">{error}</p>}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Cursos asignados", value: courses.length, detail: "Asignaciones activas" },
            { label: "Estudiantes activos", value: studentCount, detail: "En tus cursos asignados" },
            { label: "Entregas por revisar", value: reviews.length, detail: "Esperando tu revisión" },
            { label: "Revisadas esta semana", value: reviewedThisWeek, detail: "Por tu cuenta de tutor" },
          ].map((item) => (
            <article key={item.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold text-slate-400">{item.label}</p><p className="mt-3 text-3xl font-extrabold tabular-nums">{item.value}</p><p className="mt-1 text-xs text-slate-400">{item.detail}</p>
            </article>
          ))}
        </section>

        <section className="grid gap-5 xl:grid-cols-[1fr_1.4fr]">
          <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
            <div><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Docencia asignada</p><h2 className="mt-1 text-lg font-bold">Mis cursos</h2></div>
            <div className="mt-5 space-y-3">
              {courses.map((course) => (
                <div key={course.id} className="rounded-2xl border border-slate-100 p-4">
                  <p className="text-sm font-bold">{course.title}</p><p className="mt-1 text-xs text-slate-500">{course.status === "published" ? "Publicado" : course.status} · {course.studentCount} estudiantes activos</p>
                </div>
              ))}
              {courses.length === 0 && <p className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-xs leading-5 text-slate-500">Todavía no tienes cursos con una asignación activa. Cuando coordinación te asigne un curso, aparecerá aquí.</p>}
            </div>
          </article>

          <article className="min-w-0 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Bandeja de trabajo</p><h2 className="mt-1 text-lg font-bold">Entregas para revisar</h2><p className="mt-1 text-xs text-slate-400">Entregas enviadas por tus estudiantes</p></div>
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar estudiante o actividad..." aria-label="Buscar entregas" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm sm:max-w-xs" />
            </div>
            <div className="mt-5 space-y-3">
              {visibleReviews.map((item) => (
                <article key={item.id} className="rounded-2xl border border-slate-100 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0"><p className="text-sm font-bold">{item.activity}</p><p className="mt-1 text-xs font-semibold text-slate-600">{item.student}</p><p className="mt-1 text-xs text-slate-400">{item.course}</p><p className="mt-2 text-[11px] text-slate-400">Recibida: {formatDate(item.submittedAt)}</p>
                    {item.dueAt && <p className="mt-1 text-[11px] text-slate-400">Fecha límite: {formatDate(item.dueAt)}</p>}</div>
                    <span className={"rounded-full px-2.5 py-1 text-[10px] font-semibold " + (item.status === "submitted" ? "bg-amber-50 text-amber-700" : "bg-sky-50 text-sky-700")}>{"Pendiente"}</span>
                  </div>
                </article>
              ))}
              {visibleReviews.length === 0 && <p className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-xs leading-5 text-slate-500">{reviews.length ? "No hay entregas que coincidan con la búsqueda." : "No hay entregas pendientes de revisión en tus cursos asignados."}</p>}
            </div>
            <button type="button" onClick={() => router.push("/dashboard/tutor/calificaciones")} className="mt-5 rounded-xl bg-[#087DB5] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#066a9b]">Abrir bandeja de calificaciones</button>
          </article>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <div className="flex items-center justify-between gap-3">
            <div><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Matrículas</p><h2 className="mt-1 text-lg font-bold">Estudiantes de mis cursos</h2></div>
            <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-[#087DB5]">{students.length} inscripciones</span>
          </div>
          <div className="mt-4 max-h-[420px] space-y-2 overflow-y-auto">
            {students.map((student) => (
              <article key={student.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{student.name}</p>
                  <p className="mt-1 text-xs text-slate-500">{student.course}</p>
                  <p className="mt-1 text-[11px] text-slate-400">Inscrito: {formatDate(student.enrolledAt)}</p>
                </div>
                <span className={"rounded-full px-2.5 py-1 text-[10px] font-semibold " + (student.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600")}>{student.status === "active" ? "Activo" : "Completado"}</span>
              </article>
            ))}
            {students.length === 0 && <p className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-xs leading-5 text-slate-500">No hay estudiantes inscritos en tus cursos asignados.</p>}
          </div>
        </section>

        <footer className="border-t border-slate-200 pt-5 text-xs text-slate-400">Academia DECOM · Información consultada desde Supabase y limitada a tus cursos asignados.</footer>
      </div>
    </main>
  );
}
