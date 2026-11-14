"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type AccessState = "checking" | "allowed" | "not_found" | "denied" | "error";
type CourseRow = { enrollment_id: string; course_id: string; title: string; status: string; enrolled_at: string; total_lessons: number; completed_lessons: number; progress: number };
type ActivityRow = { id: string; title: string; course_title: string; due_at: string | null; status: string; attempt_number: number | null; awarded_points: number | null; total_points: number; feedback: string | null; submitted_at: string | null; reviewed_at: string | null };
type AssessmentRow = { id: string; assessment_id: string; title: string; course_title: string; type: string; attempt_number: number; status: string; score_percent: number | null; passed: boolean | null; manual_pending: number; submitted_at: string; graded_at: string | null };
type StudentDetail = { student: { id: string; name: string; status: string }; courses: CourseRow[]; activities: ActivityRow[]; assessments: AssessmentRow[] };
type TutorNote = { id: string; course_id: string; course_title: string; note: string; author_name: string; created_at: string };

function formatDate(value: string | null | undefined) {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Sin fecha" : new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" }).format(date);
}
function activityStatus(status: string) {
  const labels: Record<string, string> = { not_started: "Sin entregar", draft: "Borrador", submitted: "En revisión", changes_requested: "Requiere ajustes", approved: "Aprobada", rejected: "No aprobada" };
  return labels[status] ?? status;
}
function assessmentStatus(row: AssessmentRow) {
  if (row.status === "in_progress") return "En curso";
  if (row.status === "expired") return "Tiempo agotado";
  if (row.status === "review_pending" || row.manual_pending > 0) return "Pendiente de revisión";
  if (row.status === "graded") return row.passed ? "Aprobada" : "No aprobada";
  return row.status;
}

export default function TutorStudentDetailClient({ studentId }: { studentId: string }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [access, setAccess] = useState<AccessState>("checking");
  const [detail, setDetail] = useState<StudentDetail | null>(null);
  const [notes, setNotes] = useState<TutorNote[]>([]);
  const [noteDraft, setNoteDraft] = useState("");
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [noteError, setNoteError] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) { router.replace("/conexion"); return; }
        const { data, error: detailError } = await supabase.rpc("get_tutor_student_academic_detail", { p_student_id: studentId });
        if (detailError) {
          if (active) { setError(detailError.message); setAccess(detailError.message.toLowerCase().includes("access") ? "denied" : "error"); }
          return;
        }
        if (!active) return;
        if (!data) { setAccess("not_found"); return; }
        const loadedDetail = data as unknown as StudentDetail;
        setDetail(loadedDetail);
        setSelectedEnrollmentId(loadedDetail.courses.find((course) => course.status === "active")?.enrollment_id ?? loadedDetail.courses[0]?.enrollment_id ?? "");
        const { data: noteRows, error: notesError } = await supabase.rpc("get_tutor_student_notes", { p_student_id: studentId });
        if (!active) return;
        if (notesError) setNoteError("No fue posible consultar las observaciones: " + notesError.message);
        else setNotes((noteRows ?? []) as unknown as TutorNote[]);
        setAccess("allowed");
      } catch (cause) {
        if (active) { setError(cause instanceof Error ? cause.message : "No fue posible consultar la ficha académica."); setAccess("error"); }
      }
    }
    void load();
    return () => { active = false; };
  }, [router, studentId, supabase]);

  if (access === "checking") return <main className="flex min-h-screen items-center justify-center bg-[#F4F7FA]"><p className="text-sm text-slate-500">Consultando ficha académica...</p></main>;
  if (access !== "allowed" || !detail) {
    const title = access === "not_found" ? "Estudiante no encontrado" : access === "denied" ? "Acceso restringido" : "No fue posible cargar la ficha";
    const description = access === "not_found" ? "No hay una matrícula activa o completada de este estudiante en tus cursos asignados." : access === "denied" ? "La ficha solo está disponible para el tutor asignado al curso o para administración nacional." : error || "Intenta nuevamente en unos momentos.";
    return <main className="flex min-h-screen items-center justify-center bg-[#F4F7FA] px-6"><section className="max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center"><h1 className="text-xl font-bold text-[#102D4D]">{title}</h1><p className="mt-2 text-sm leading-6 text-slate-500">{description}</p><button type="button" onClick={() => router.push("/dashboard/tutor")} className="mt-5 rounded-xl bg-[#087DB5] px-5 py-3 text-sm font-semibold text-white">Volver al panel del tutor</button></section></main>;
  }

  const { student, courses, activities, assessments } = detail;
  const lessonsDone = courses.reduce((sum, course) => sum + course.completed_lessons, 0);
  const lessonsTotal = courses.reduce((sum, course) => sum + course.total_lessons, 0);
  const progress = lessonsTotal ? Math.round(lessonsDone / lessonsTotal * 100) : 0;
  const pendingActivities = activities.filter((item) => ["not_started", "draft", "submitted", "changes_requested"].includes(item.status)).length;
  const gradedAssessments = assessments.filter((item) => item.status === "graded");
  const latestActivity = [...activities.map((item) => item.submitted_at ?? item.reviewed_at ?? item.due_at), ...assessments.map((item) => item.graded_at ?? item.submitted_at)].filter((v): v is string => Boolean(v)).sort((a,b) => new Date(b).getTime()-new Date(a).getTime())[0];

  async function saveNote() {
    if (!noteDraft.trim() || !selectedEnrollmentId || savingNote) return;
    setSavingNote(true);
    setNoteError("");
    const { error: saveError } = await supabase.rpc("add_tutor_student_note", { p_enrollment_id: selectedEnrollmentId, p_note: noteDraft.trim() });
    if (saveError) { setNoteError(saveError.message); setSavingNote(false); return; }
    setNoteDraft("");
    const { data: noteRows, error: refreshError } = await supabase.rpc("get_tutor_student_notes", { p_student_id: studentId });
    if (refreshError) setNoteError("La observación se guardó, pero no se pudo actualizar la lista: " + refreshError.message);
    else setNotes((noteRows ?? []) as unknown as TutorNote[]);
    setSavingNote(false);
  }

  return <main className="min-h-screen bg-[#F4F7FA] text-[#102D4D]">
    <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 md:px-8"><div><p className="text-xs font-extrabold tracking-[0.14em] text-[#087DB5]">ACADEMIA DECOM</p><p className="mt-1 text-xs text-slate-400">Seguimiento tutorial individual</p></div><button type="button" onClick={() => router.push("/dashboard/tutor")} className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-600">← Panel del tutor</button></div></header>
    <div className="mx-auto max-w-6xl space-y-6 px-5 py-7 md:px-8 md:py-9">
      <section className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-[#19A7A0]">Ficha académica</p><h1 className="mt-2 text-2xl font-extrabold">{student.name}</h1><p className="mt-1 text-sm text-slate-500">Registro académico · Estado de perfil: {student.status === "active" ? "Activo" : student.status}</p></div><span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600">Información de Supabase</span></section>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[{label:"Avance de lecciones",value:progress+"%"},{label:"Lecciones completadas",value:lessonsDone+" / "+lessonsTotal},{label:"Actividades por atender",value:String(pendingActivities)},{label:"Evaluaciones calificadas",value:String(gradedAssessments.length)}].map(item=><article key={item.label} className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs font-semibold text-slate-400">{item.label}</p><p className="mt-2 text-2xl font-extrabold tabular-nums">{item.value}</p></article>)}</section>
      <section className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6"><h2 className="text-lg font-bold">Progreso por curso</h2>{courses.length?<div className="mt-5 space-y-6">{courses.map(course=><div key={course.enrollment_id}><div className="flex flex-wrap justify-between gap-2"><p className="text-sm font-bold">{course.title}</p><span className="text-xs font-bold text-[#087DB5]">{course.progress}%</span></div><p className="mt-1 text-xs text-slate-400">{course.completed_lessons} de {course.total_lessons} lecciones · {course.status==="completed"?"Curso completado":"Matrícula activa"}</p><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#19A7A0]" style={{width:course.progress+"%"}}/></div></div>)}</div>:<p className="mt-4 text-sm text-slate-500">No hay cursos disponibles para mostrar.</p>}</article>
        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6"><h2 className="text-lg font-bold">Resumen tutorial</h2><p className="mt-3 text-xs leading-5 text-slate-500">Último movimiento académico: {formatDate(latestActivity)}</p><p className="mt-3 text-xs leading-5 text-slate-500">Las cifras se calculan con las lecciones publicadas, entregas y evaluaciones registradas en los cursos asignados.</p><p className="mt-4 rounded-xl bg-[#F4F7FA] p-3 text-xs leading-5 text-slate-600">Las observaciones quedan registradas con autor, fecha y curso, y solo son visibles dentro del ámbito académico autorizado.</p></article>
      </section>
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <div><h2 className="text-lg font-bold">Observaciones tutoriales</h2><p className="mt-1 text-xs text-slate-400">Notas de acompañamiento vinculadas a una matrícula y curso.</p></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_2fr]">
          <select value={selectedEnrollmentId} onChange={(event) => setSelectedEnrollmentId(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-3 text-sm" aria-label="Curso para la observación">
            {courses.map((course) => <option key={course.enrollment_id} value={course.enrollment_id}>{course.title}</option>)}
          </select>
          <textarea value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} maxLength={1000} rows={3} placeholder="Registra una observación objetiva sobre el acompañamiento académico..." className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm leading-6 outline-none focus:border-[#087DB5]" />
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><span className="text-[11px] text-slate-400">{noteDraft.length}/1000 caracteres · Las notas guardadas no se pueden editar ni eliminar.</span><button type="button" disabled={!noteDraft.trim() || !selectedEnrollmentId || savingNote} onClick={() => void saveNote()} className="rounded-xl bg-[#087DB5] px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-40">{savingNote ? "Guardando..." : "Guardar observación"}</button></div>
        {noteError && <p role="alert" className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">{noteError}</p>}
        <div className="mt-5 divide-y divide-slate-100">
          {notes.map((item) => <article key={item.id} className="py-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-bold">{item.course_title}</p><span className="text-[10px] text-slate-400">{formatDate(item.created_at)}</span></div><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{item.note}</p><p className="mt-2 text-[10px] text-slate-400">Registrada por {item.author_name}</p></article>)}
          {notes.length === 0 && !noteError && <p className="py-5 text-center text-xs text-slate-500">Todavía no hay observaciones tutoriales registradas.</p>}
        </div>
      </section>
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6"><div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-lg font-bold">Actividades asignadas</h2><p className="mt-1 text-xs text-slate-400">Estado de la última entrega de cada actividad asignada.</p></div><span className="text-xs font-semibold text-slate-500">{activities.length} actividades</span></div>
        {activities.length?<div className="mt-4 divide-y divide-slate-100">{activities.map(item=><article key={item.id} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-sm font-bold">{item.title}</p><p className="mt-1 text-xs text-slate-500">{item.course_title}</p><p className="mt-1 text-[11px] text-slate-400">Entrega: {formatDate(item.due_at)} · Envío: {formatDate(item.submitted_at)}</p>{item.feedback&&<p className="mt-2 rounded-lg bg-[#F4F7FA] p-3 text-xs leading-5 text-slate-600">Retroalimentación: {item.feedback}</p>}</div><div className="text-left sm:text-right"><span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-semibold text-slate-600">{activityStatus(item.status)}</span><p className="mt-2 text-xs font-semibold text-slate-500">{item.awarded_points===null?"Sin calificar":item.awarded_points+" / "+item.total_points+" puntos"}</p></div></article>)}</div>:<p className="mt-4 rounded-2xl border border-dashed border-slate-200 p-7 text-center text-sm text-slate-500">No hay actividades asignadas en estos cursos.</p>}
      </section>
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6"><div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-lg font-bold">Historial de evaluaciones</h2><p className="mt-1 text-xs text-slate-400">Intentos, resultados y revisiones manuales.</p></div><span className="text-xs font-semibold text-slate-500">{assessments.length} intentos</span></div>
        {assessments.length?<div className="mt-4 divide-y divide-slate-100">{assessments.map(item=><article key={item.id} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-sm font-bold">{item.title}</p><p className="mt-1 text-xs text-slate-500">{item.course_title} · Intento {item.attempt_number} · {item.type==="final"?"Evaluación final":"Evaluación de lección"}</p><p className="mt-1 text-[11px] text-slate-400">Enviada: {formatDate(item.submitted_at)} · Calificada: {formatDate(item.graded_at)}</p></div><div className="text-left sm:text-right"><span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-semibold text-slate-600">{assessmentStatus(item)}</span><p className="mt-2 text-xs font-semibold text-slate-500">{item.score_percent===null?"Calificación pendiente":item.score_percent+"%"}</p></div></article>)}</div>:<p className="mt-4 rounded-2xl border border-dashed border-slate-200 p-7 text-center text-sm text-slate-500">Todavía no hay intentos de evaluación registrados.</p>}
      </section>
      <p className="text-[11px] leading-5 text-slate-400">La consulta está limitada en el servidor a los cursos con asignación activa del tutor. No se muestran datos de otros cursos ni observaciones ficticias.</p>
    </div>
  </main>;
}
