"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Activity = { id: string; title: string; description: string | null; response_type: string; total_points: number; max_attempts: number; due_at: string | null };
type Assignment = { id: string; activity_id: string; due_at: string | null; status: string };
type Submission = { id: string; assignment_id: string; attempt_number: number; status: string; awarded_points: number | null; feedback: string | null; submitted_at: string | null };

function dateLabel(value: string | null) {
  if (!value) return "Sin fecha límite";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Fecha no disponible" : date.toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });
}
function statusLabel(status?: string) {
  switch (status) {
    case "draft": return "Borrador";
    case "submitted": return "En revisión";
    case "changes_requested": return "Requiere ajustes";
    case "graded": return "Calificada";
    default: return "Por desarrollar";
  }
}

export default function StudentActivitiesPage() {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState<Array<{ assignment: Assignment; activity: Activity; submission: Submission | null }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) throw new Error("Inicia sesión para consultar tus actividades.");
      const { data: enrollments, error: enrollmentError } = await supabase.from("course_enrollments").select("id").eq("user_id", auth.user.id).eq("status", "active");
      if (enrollmentError) throw enrollmentError;
      const enrollmentIds = (enrollments ?? []).map((row) => row.id);
      if (!enrollmentIds.length) { setItems([]); return; }

      const { data: assignments, error: assignmentError } = await supabase.from("academic_activity_assignments").select("id, activity_id, due_at, status").in("enrollment_id", enrollmentIds).eq("status", "active");
      if (assignmentError) throw assignmentError;
      const assignmentRows = (assignments ?? []) as Assignment[];
      const activityIds = [...new Set(assignmentRows.map((row) => row.activity_id))];
      if (!activityIds.length) { setItems([]); return; }

      const [{ data: activities, error: activityError }, { data: submissions, error: submissionError }] = await Promise.all([
        supabase.from("academic_activities").select("id, title, description, response_type, total_points, max_attempts, due_at").in("id", activityIds).eq("status", "published"),
        supabase.from("academic_activity_submissions").select("id, assignment_id, attempt_number, status, awarded_points, feedback, submitted_at").eq("user_id", auth.user.id).in("assignment_id", assignmentRows.map((row) => row.id)).order("attempt_number", { ascending: false }),
      ]);
      if (activityError) throw activityError;
      if (submissionError) throw submissionError;

      const activityMap = new Map(((activities ?? []) as Activity[]).map((row) => [row.id, row]));
      const latestByAssignment = new Map<string, Submission>();
      for (const submission of (submissions ?? []) as Submission[]) {
        if (!latestByAssignment.has(submission.assignment_id)) latestByAssignment.set(submission.assignment_id, submission);
      }
      setItems(assignmentRows.flatMap((assignment) => {
        const activity = activityMap.get(assignment.activity_id);
        return activity ? [{ assignment, activity, submission: latestByAssignment.get(assignment.id) ?? null }] : [];
      }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No fue posible cargar tus actividades.");
      setItems([]);
    } finally { setLoading(false); }
  }, [supabase]);

  useEffect(() => { void loadData(); }, [loadData]);

  const visible = items.filter(({ submission }) => {
    if (filter === "pending") return !submission || submission.status === "draft";
    if (filter === "review") return submission?.status === "submitted" || submission?.status === "changes_requested";
    if (filter === "graded") return submission?.status === "graded";
    return true;
  });
  const pendingCount = items.filter(({ submission }) => !submission || submission.status === "draft").length;
  const reviewCount = items.filter(({ submission }) => submission?.status === "submitted" || submission?.status === "changes_requested").length;
  const gradedCount = items.filter(({ submission }) => submission?.status === "graded").length;

  return (
    <main className="min-h-screen bg-[#F4F7FA] px-4 py-8 text-[#102D4D] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#19A7A0]">Mi formación</p><h1 className="mt-2 text-3xl font-bold">Mis actividades</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Consulta los trabajos que tus tutores te han asignado, entrega tus respuestas y revisa la retroalimentación.</p></div>
          <button type="button" onClick={() => void loadData()} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold hover:border-[#087DB5]">Actualizar</button>
        </header>
        <section className="mb-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs font-semibold text-slate-500">Por desarrollar</p><p className="mt-2 text-3xl font-bold">{pendingCount}</p></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs font-semibold text-slate-500">En revisión / ajustes</p><p className="mt-2 text-3xl font-bold">{reviewCount}</p></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs font-semibold text-slate-500">Calificadas</p><p className="mt-2 text-3xl font-bold">{gradedCount}</p></div>
        </section>
        <div className="mb-5 flex flex-wrap gap-2">{[["all", "Todas"], ["pending", "Por desarrollar"], ["review", "En revisión"], ["graded", "Calificadas"]].map(([value, label]) => <button key={value} type="button" onClick={() => setFilter(value)} className={"rounded-full px-4 py-2 text-xs font-semibold " + (filter === value ? "bg-[#087DB5] text-white" : "border border-slate-200 bg-white text-slate-600")}>{label}</button>)}</div>
        {error && <div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
        {loading ? <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">Cargando actividades asignadas...</div> : visible.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center"><h2 className="font-semibold">No hay actividades en esta categoría</h2><p className="mt-2 text-sm text-slate-500">Cuando tu tutor te asigne un trabajo, aparecerá aquí.</p></div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">{visible.map(({ assignment, activity, submission }) => (
            <article key={assignment.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2"><span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-600">{activity.response_type === "mixed" ? "Entrega mixta" : activity.response_type === "file" ? "Archivo" : activity.response_type === "link" ? "Enlace" : "Respuesta escrita"}</span><span className="text-xs font-semibold text-[#087DB5]">{statusLabel(submission?.status)}</span></div>
              <h2 className="mt-4 text-lg font-bold">{activity.title}</h2><p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-500">{activity.description || "Actividad de formación asignada por tu tutor."}</p>
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500"><span>{activity.total_points} puntos</span><span>Intentos: {submission?.attempt_number ?? 0}/{activity.max_attempts}</span><span>Vence: {dateLabel(assignment.due_at || activity.due_at)}</span></div>
              {submission?.status === "graded" && <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">Calificación: {submission.awarded_points ?? 0} / {activity.total_points}</p>}
              {submission?.status === "changes_requested" && submission.feedback && <p className="mt-4 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900">{submission.feedback}</p>}
              <Link href={"/dashboard/estudiante/actividades/" + assignment.id} className="mt-5 inline-flex rounded-xl bg-[#087DB5] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#066a9b]">{submission?.status === "changes_requested" ? "Corregir entrega" : submission?.status === "graded" ? "Ver resultado" : submission?.status === "submitted" ? "Consultar entrega" : "Abrir actividad"}</Link>
            </article>
          ))}</div>
        )}
      </div>
    </main>
  );
}
