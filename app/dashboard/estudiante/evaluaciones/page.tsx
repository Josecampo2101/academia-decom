"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Item = {
  id: string;
  courseTitle: string;
  title: string;
  kind: string;
  instructions: string | null;
  passingScore: number;
  maxAttempts: number | null;
  timeLimit: number | null;
  latestAttempt: { status: string; score_percent: number | null; passed: boolean | null; attempt_number: number } | null;
};

export default function StudentAssessmentsPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [access, setAccess] = useState<"checking" | "allowed" | "denied" | "error">("checking");
  const [items, setItems] = useState<Item[]>([]);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) { router.replace("/conexion"); return; }
        const { data: assignments, error: assignmentError } = await supabase.from("user_role_assignments")
          .select("role_id").eq("user_id", user.id);
        if (assignmentError) throw assignmentError;
        const roleIds = [...new Set((assignments ?? []).map((item) => item.role_id))];
        const { data: roles, error: roleError } = await supabase.from("roles").select("role_key").in("id", roleIds);
        if (roleError) throw roleError;
        const roleKeys = (roles ?? []).map((role) => role.role_key);
        if (!roleKeys.includes("student") && !roleKeys.includes("member") && !roleKeys.includes("national_admin")) {
          if (active) setAccess("denied");
          return;
        }
        const { data: enrollments, error: enrollmentError } = await supabase.from("course_enrollments")
          .select("id,course_id,district_id,status").eq("user_id", user.id).neq("status", "withdrawn");
        if (enrollmentError) throw enrollmentError;
        const courseIds = [...new Set((enrollments ?? []).map((item) => item.course_id))];
        if (!courseIds.length) { if (active) { setItems([]); setAccess("allowed"); } return; }
        const [courseResult, assessmentResult] = await Promise.all([
          supabase.from("courses").select("id,title").in("id", courseIds),
          supabase.from("academic_assessments")
            .select("id,course_id,title,assessment_type,instructions,passing_score,max_attempts,time_limit_minutes")
            .in("course_id", courseIds).eq("status", "published").order("created_at", { ascending: false }),
        ]);
        if (courseResult.error) throw courseResult.error;
        if (assessmentResult.error) throw assessmentResult.error;
        const assessmentIds = (assessmentResult.data ?? []).map((item) => item.id);
        const attemptResult = assessmentIds.length
          ? await supabase.from("academic_assessment_attempts")
              .select("assessment_id,status,score_percent,passed,attempt_number,submitted_at")
              .eq("user_id", user.id).in("assessment_id", assessmentIds).order("submitted_at", { ascending: false })
          : { data: [], error: null };
        if (attemptResult.error) throw attemptResult.error;
        const courseNames = new Map((courseResult.data ?? []).map((course) => [course.id, course.title]));
        const latest = new Map<string, NonNullable<Item["latestAttempt"]>>();
        for (const attempt of attemptResult.data ?? []) {
          if (!latest.has(attempt.assessment_id)) latest.set(attempt.assessment_id, {
            status: attempt.status, score_percent: attempt.score_percent,
            passed: attempt.passed, attempt_number: attempt.attempt_number,
          });
        }
        const enrollmentCourseIds = new Set((enrollments ?? []).map((item) => item.course_id));
        const nextItems = (assessmentResult.data ?? [])
          .filter((assessment) => enrollmentCourseIds.has(assessment.course_id))
          .map((assessment) => ({
            id: assessment.id,
            courseTitle: courseNames.get(assessment.course_id) ?? "Curso",
            title: assessment.title,
            kind: assessment.assessment_type,
            instructions: assessment.instructions,
            passingScore: assessment.passing_score,
            maxAttempts: assessment.max_attempts,
            timeLimit: assessment.time_limit_minutes,
            latestAttempt: latest.get(assessment.id) ?? null,
          }));
        if (active) { setItems(nextItems); setAccess("allowed"); }
      } catch (error) {
        console.error("No fue posible cargar las evaluaciones:", error);
        if (active) { setNotice(error instanceof Error ? error.message : "No fue posible cargar las evaluaciones."); setAccess("error"); }
      }
    }
    void Promise.resolve().then(load);
    return () => { active = false; };
  }, [router, supabase]);

  if (access === "checking") return <main className="flex min-h-screen items-center justify-center bg-[#F4F7FA]"><div className="h-10 w-10 animate-spin rounded-full border-4 border-[#087DB5]/20 border-t-[#087DB5]" /></main>;
  if (access !== "allowed") return <main className="flex min-h-screen items-center justify-center bg-[#F4F7FA] px-6"><section className="max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center"><h1 className="text-xl font-bold">{access === "error" ? "No pudimos cargar tus evaluaciones" : "Acceso restringido"}</h1><p className="mt-2 text-sm text-slate-500">{notice || "Esta sección está habilitada para estudiantes con una asignación vigente."}</p><button onClick={() => router.push("/dashboard/estudiante")} className="mt-5 rounded-xl bg-[#087DB5] px-5 py-3 text-sm font-semibold text-white">Volver al panel</button></section></main>;

  return (
    <main className="min-h-screen bg-[#F4F7FA] text-[#102D4D]">
      <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 md:px-8"><div><p className="text-xs font-extrabold tracking-[0.14em] text-[#087DB5]">ACADEMIA DECOM</p><p className="mt-1 text-xs text-slate-400">Evaluaciones y comprobación de aprendizaje</p></div><button onClick={() => router.push("/dashboard/estudiante")} className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-600">← Panel del estudiante</button></div></header>
      <div className="mx-auto max-w-6xl space-y-6 px-5 py-7 md:px-8">
        <section><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#19A7A0]">Evaluación del aprendizaje</p><h1 className="mt-2 text-2xl font-extrabold md:text-3xl">Mis evaluaciones</h1><p className="mt-2 text-sm leading-6 text-slate-500">Aquí aparecen los instrumentos publicados para tus cursos matriculados. Tus intentos y resultados se sincronizan con la plataforma.</p></section>
        {items.length ? <div className="grid gap-4 md:grid-cols-2">{items.map((item) => <article key={item.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#19A7A0]">{item.courseTitle}</p>
          <h2 className="mt-2 text-base font-bold">{item.title}</h2>
          <p className="mt-2 text-xs leading-5 text-slate-500">{item.instructions || "Lee cuidadosamente cada pregunta y revisa tus respuestas antes de enviarlas."}</p>
          <div className="mt-4 flex flex-wrap gap-3 text-[11px] text-slate-400"><span>{item.kind === "final" ? "Examen final" : item.kind === "practice" ? "Práctica" : "Evaluación de lección"}</span><span>Aprobación: {item.passingScore}%</span>{item.timeLimit && <span>{item.timeLimit} min</span>}{item.maxAttempts && <span>Máx. {item.maxAttempts} intentos</span>}</div>
          {item.latestAttempt && <p className="mt-4 rounded-xl bg-[#F4F7FA] p-3 text-xs text-slate-600">{item.latestAttempt.status === "review_pending" ? "En revisión manual" : item.latestAttempt.passed ? "Aprobada" : "Intento calificado"} · {item.latestAttempt.score_percent === null ? "Calificación pendiente" : `${item.latestAttempt.score_percent}%`} · intento {item.latestAttempt.attempt_number}</p>}
          <button onClick={() => router.push(`/dashboard/estudiante/evaluaciones/${item.id}`)} className="mt-4 w-full rounded-xl bg-[#087DB5] px-4 py-3 text-xs font-bold text-white">Abrir evaluación →</button>
        </article>)}</div> : <section className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center"><h2 className="text-base font-bold">No tienes evaluaciones publicadas</h2><p className="mt-2 text-sm text-slate-500">Cuando el tutor o el editor publique una evaluación para tus cursos, aparecerá aquí.</p></section>}
      </div>
    </main>
  );
}
