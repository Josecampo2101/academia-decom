"use client";

import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Activity = {
  id: string; district_id: string; title: string; description: string | null; instructions: string;
  response_type: string; total_points: number; max_attempts: number; due_at: string | null;
};
type Assignment = { id: string; activity_id: string; district_id: string; due_at: string | null; status: string };
type Submission = {
  id: string; assignment_id: string; attempt_number: number; response_text: string | null;
  external_url: string | null; status: string; awarded_points: number | null; feedback: string | null;
  rubric_scores: unknown; submitted_at: string | null; created_at: string;
};
type Rubric = { id: string; title: string; description: string | null; max_points: number; sort_order: number };
type SubmissionFile = { id: string; file_name: string; mime_type: string; size_bytes: number; storage_path: string; created_at: string; url?: string };

function dateLabel(value: string | null) {
  if (!value) return "Sin fecha límite";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Fecha no disponible" : date.toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });
}
function statusLabel(value: string) {
  return value === "draft" ? "Borrador" : value === "submitted" ? "En revisión" : value === "changes_requested" ? "Requiere ajustes" : value === "graded" ? "Calificada" : value;
}
function safeFileName(name: string) {
  return name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "_").slice(-100) || "archivo";
}

export default function StudentActivityClient({ activityId }: { activityId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [userId, setUserId] = useState("");
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [activity, setActivity] = useState<Activity | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [history, setHistory] = useState<Submission[]>([]);
  const [rubric, setRubric] = useState<Rubric[]>([]);
  const [files, setFiles] = useState<SubmissionFile[]>([]);
  const [responseText, setResponseText] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true); setError(""); setNotice("");
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) throw new Error("Inicia sesión para abrir esta actividad.");
      setUserId(auth.user.id);

      const { data: assignmentRow, error: assignmentError } = await supabase
        .from("academic_activity_assignments")
        .select("id, activity_id, district_id, due_at, status")
        .eq("id", activityId).eq("status", "active").maybeSingle();
      if (assignmentError) throw assignmentError;
      if (!assignmentRow) throw new Error("Esta actividad no está asignada o ya no está disponible.");
      const assigned = assignmentRow as Assignment;
      setAssignment(assigned);

      const { data: activityRow, error: activityError } = await supabase
        .from("academic_activities")
        .select("id, district_id, title, description, instructions, response_type, total_points, max_attempts, due_at")
        .eq("id", assigned.activity_id).eq("status", "published").maybeSingle();
      if (activityError) throw activityError;
      if (!activityRow) throw new Error("La actividad ya no está publicada.");
      setActivity(activityRow as Activity);

      const [{ data: rubricRows, error: rubricError }, { data: historyRows, error: historyError }] = await Promise.all([
        supabase.from("academic_activity_rubric_criteria").select("id, title, description, max_points, sort_order").eq("activity_id", assigned.activity_id).order("sort_order"),
        supabase.from("academic_activity_submissions").select("id, assignment_id, attempt_number, response_text, external_url, status, awarded_points, feedback, rubric_scores, submitted_at, created_at").eq("assignment_id", assigned.id).eq("user_id", auth.user.id).order("attempt_number", { ascending: false }),
      ]);
      if (rubricError) throw rubricError;
      if (historyError) throw historyError;
      const rubricItems = (rubricRows ?? []) as Rubric[];
      const attempts = (historyRows ?? []) as Submission[];
      setRubric(rubricItems);
      setHistory(attempts);

      let current = attempts.find((row) => row.status === "draft") ?? null;
      if (!current && attempts.length < (activityRow as Activity).max_attempts) {
        const { data: started, error: startError } = await supabase.rpc("start_academic_activity_submission", { p_assignment_id: assigned.id });
        if (!startError && started) {
          const { data: startedRow, error: startedError } = await supabase
            .from("academic_activity_submissions")
            .select("id, assignment_id, attempt_number, response_text, external_url, status, awarded_points, feedback, rubric_scores, submitted_at, created_at")
            .eq("id", started).eq("user_id", auth.user.id).single();
          if (startedError) throw startedError;
          current = startedRow as Submission;
          setHistory((existing) => [current as Submission, ...existing.filter((row) => row.id !== (current as Submission).id)]);
        } else if (startError) {
          setNotice(startError.message);
        }
      }

      if (!current) current = attempts[0] ?? null;
      setSubmission(current);
      setResponseText(current?.response_text ?? "");
      setExternalUrl(current?.external_url ?? "");

      if (current) {
        const { data: fileRows, error: fileError } = await supabase
          .from("academic_activity_submission_files")
          .select("id, file_name, mime_type, size_bytes, storage_path, created_at")
          .eq("submission_id", current.id).order("created_at");
        if (fileError) throw fileError;
        const enriched = await Promise.all(((fileRows ?? []) as SubmissionFile[]).map(async (file) => {
          const { data } = await supabase.storage.from("academic-activity-submissions").createSignedUrl(file.storage_path, 300);
          return { ...file, url: data?.signedUrl };
        }));
        setFiles(enriched);
      } else setFiles([]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No fue posible abrir la actividad.");
    } finally { setLoading(false); }
  }, [activityId, supabase]);

  useEffect(() => { void loadData(); }, [loadData]);

  const isDraft = submission?.status === "draft";
  const isReadOnly = !isDraft;
  const dueAt = assignment?.due_at || activity?.due_at || null;
  const expired = dueAt ? new Date(dueAt).getTime() < Date.now() : false;

  function onFilesChange(event: ChangeEvent<HTMLInputElement>) {
    const next = Array.from(event.target.files ?? []);
    const valid = next.filter((file) => file.size > 0 && file.size <= 50 * 1024 * 1024);
    if (valid.length !== next.length) setError("Cada archivo debe pesar máximo 50 MB.");
    setSelectedFiles(valid);
  }

  async function uploadSelectedFiles() {
    if (!submission || !activity || !userId || !selectedFiles.length) return;
    for (const file of selectedFiles) {
      const path = activity.district_id + "/" + userId + "/" + submission.id + "/" + Date.now() + "-" + safeFileName(file.name);
      const { error: uploadError } = await supabase.storage.from("academic-activity-submissions").upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
      if (uploadError) throw uploadError;
      const { error: metadataError } = await supabase.from("academic_activity_submission_files").insert({
        submission_id: submission.id,
        activity_id: activity.id,
        district_id: activity.district_id,
        user_id: userId,
        storage_path: path,
        file_name: file.name,
        mime_type: file.type || "application/octet-stream",
        size_bytes: file.size,
      });
      if (metadataError) throw metadataError;
    }
    setSelectedFiles([]);
  }

  async function saveDraft(submit: boolean) {
    if (!submission || !isDraft || saving) return;
    setSaving(true); setError(""); setNotice("");
    try {
      if (expired) throw new Error("El plazo de entrega ya venció.");
      const trimmedUrl = externalUrl.trim();
      if (trimmedUrl && !/^https?:\/\/[^\s]+$/i.test(trimmedUrl)) throw new Error("El enlace debe comenzar por http:// o https://.");
      const { error: updateError } = await supabase.from("academic_activity_submissions")
        .update({ response_text: responseText, external_url: trimmedUrl || null })
        .eq("id", submission.id).eq("user_id", userId).eq("status", "draft");
      if (updateError) throw updateError;
      await uploadSelectedFiles();
      if (submit) {
        const { error: submitError } = await supabase.rpc("submit_academic_activity_submission", { p_submission_id: submission.id });
        if (submitError) throw submitError;
        setNotice("Tu entrega fue enviada al tutor.");
      } else setNotice("Borrador guardado.");
      await loadData();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No fue posible guardar la entrega.");
    } finally { setSaving(false); }
  }

  if (loading) return <main className="flex min-h-screen items-center justify-center bg-[#F4F7FA] p-6 text-sm text-slate-500">Cargando actividad...</main>;
  if (error && !activity) return <main className="min-h-screen bg-[#F4F7FA] p-6"><div className="mx-auto max-w-3xl rounded-2xl border border-red-200 bg-white p-6 text-sm text-red-800">{error}<div className="mt-4"><Link href="/dashboard/estudiante/actividades" className="font-semibold text-[#087DB5]">Volver a mis actividades</Link></div></div></main>;
  if (!activity || !assignment) return null;

  return (
    <main className="min-h-screen bg-[#F4F7FA] px-4 py-8 text-[#102D4D] sm:px-6">
      <div className="mx-auto max-w-4xl">
        <Link href="/dashboard/estudiante/actividades" className="text-sm font-semibold text-[#087DB5]">← Mis actividades</Link>
        <header className="mt-5 rounded-3xl bg-[#102D4D] p-6 text-white sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#55D1C4]">Actividad asignada</p>
          <h1 className="mt-3 text-2xl font-bold sm:text-3xl">{activity.title}</h1>
          {activity.description && <p className="mt-3 max-w-3xl text-sm leading-6 text-blue-100">{activity.description}</p>}
          <div className="mt-5 flex flex-wrap gap-4 text-xs text-blue-100"><span>{activity.total_points} puntos</span><span>Intentos: {submission?.attempt_number ?? 0}/{activity.max_attempts}</span><span>Fecha límite: {dateLabel(dueAt)}</span><span>Estado: {submission ? statusLabel(submission.status) : "Sin intento"}</span></div>
        </header>

        {error && <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
        {notice && <div role="status" className="mt-5 rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">{notice}</div>}

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-bold">Instrucciones</h2>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-600">{activity.instructions}</p>
        </section>

        <section className="mt-6 space-y-5 rounded-2xl border border-slate-200 bg-white p-6">
          <div><h2 className="text-lg font-bold">Tu entrega</h2><p className="mt-1 text-xs text-slate-500">{isReadOnly ? "Esta entrega ya fue enviada y no puede modificarse." : "Guarda un borrador o envía tu trabajo cuando esté listo."}</p></div>
          {(activity.response_type === "text" || activity.response_type === "mixed") && <label className="block text-sm font-semibold">Respuesta escrita<textarea rows={7} disabled={isReadOnly} value={responseText} onChange={(event) => setResponseText(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm font-normal outline-none focus:border-[#087DB5] disabled:bg-slate-50" placeholder="Escribe aquí tu respuesta..." /></label>}
          {(activity.response_type === "link" || activity.response_type === "mixed") && <label className="block text-sm font-semibold">Enlace de referencia<input type="url" disabled={isReadOnly} value={externalUrl} onChange={(event) => setExternalUrl(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm font-normal outline-none focus:border-[#087DB5] disabled:bg-slate-50" placeholder="https://..." /></label>}
          {(activity.response_type === "file" || activity.response_type === "mixed") && <div><label className="block text-sm font-semibold">Archivos adjuntos<input type="file" multiple disabled={isReadOnly} onChange={onFilesChange} className="mt-2 block w-full rounded-xl border border-slate-200 p-3 text-sm font-normal disabled:bg-slate-50" /></label><p className="mt-1 text-xs text-slate-500">Máximo 50 MB por archivo. Los archivos se guardan de forma privada.</p>{selectedFiles.length > 0 && <ul className="mt-2 space-y-1 text-xs text-slate-600">{selectedFiles.map((file) => <li key={file.name}>{file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB</li>)}</ul>}</div>}
          {files.length > 0 && <div><h3 className="text-sm font-bold">Archivos enviados</h3><ul className="mt-2 space-y-2">{files.map((file) => <li key={file.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3 text-sm"><span className="truncate">{file.file_name}</span>{file.url && <a href={file.url} target="_blank" rel="noreferrer" className="shrink-0 font-semibold text-[#087DB5]">Abrir</a>}</li>)}</ul></div>}
          {isDraft && !expired && <div className="flex flex-wrap gap-3"><button type="button" disabled={saving} onClick={() => void saveDraft(false)} className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold disabled:opacity-50">{saving ? "Guardando..." : "Guardar borrador"}</button><button type="button" disabled={saving} onClick={() => void saveDraft(true)} className="rounded-xl bg-[#087DB5] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Enviando..." : "Enviar al tutor"}</button></div>}
          {expired && isDraft && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">El plazo de entrega ya venció. No es posible enviar este intento.</p>}
          {submission?.status === "graded" && <div className="rounded-xl bg-emerald-50 p-4"><p className="text-sm font-bold text-emerald-900">Calificación: {submission.awarded_points ?? 0} / {activity.total_points}</p>{submission.feedback && <p className="mt-2 whitespace-pre-wrap text-sm text-emerald-800">{submission.feedback}</p>}</div>}
          {submission?.status === "changes_requested" && submission.feedback && <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900"><strong>El tutor solicitó ajustes:</strong><p className="mt-2 whitespace-pre-wrap">{submission.feedback}</p><p className="mt-2 text-xs">Puedes iniciar un nuevo intento con las correcciones indicadas.</p></div>}
          {submission?.status === "submitted" && <p className="rounded-xl bg-sky-50 p-4 text-sm text-sky-900">Tu trabajo fue recibido y está pendiente de revisión.</p>}
        </section>

        {rubric.length > 0 && <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6"><h2 className="text-lg font-bold">Criterios de evaluación</h2><div className="mt-4 space-y-3">{rubric.map((item) => <div key={item.id} className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3 last:border-0"><div><p className="text-sm font-semibold">{item.title}</p>{item.description && <p className="mt-1 text-xs text-slate-500">{item.description}</p>}</div><span className="shrink-0 text-sm font-bold">{item.max_points} pts</span></div>)}</div></section>}

        {history.length > 0 && <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6"><h2 className="text-lg font-bold">Historial de intentos</h2><div className="mt-4 space-y-3">{history.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-3"><div><p className="text-sm font-semibold">Intento {item.attempt_number}</p><p className="mt-1 text-xs text-slate-500">{item.submitted_at ? dateLabel(item.submitted_at) : "Borrador"}</p></div><div className="text-right"><p className="text-sm font-semibold">{statusLabel(item.status)}</p>{item.awarded_points !== null && <p className="text-xs text-slate-500">{item.awarded_points} / {activity.total_points} pts</p>}</div></div>)}</div></section>}
      </div>
    </main>
  );
}
