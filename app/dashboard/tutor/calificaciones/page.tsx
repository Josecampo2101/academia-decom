"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Activity = { id: string; title: string; total_points: number };
type Submission = {
  id: string; assignment_id: string; activity_id: string; enrollment_id: string; district_id: string;
  user_id: string; attempt_number: number; response_text: string | null; external_url: string | null;
  status: string; awarded_points: number | null; feedback: string | null; submitted_at: string | null;
};
type Rubric = { id: string; activity_id: string; title: string; description: string | null; max_points: number; sort_order: number };
type Attachment = { id: string; submission_id: string; file_name: string; mime_type: string; size_bytes: number; storage_path: string; url?: string };
type QueueItem = { submission: Submission; activity: Activity; studentName: string };

export default function TutorCalificacionesPage() {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState<QueueItem[]>([]);
  const [rubric, setRubric] = useState<Rubric[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [scores, setScores] = useState<Record<string, string>>({});
  const [manualScore, setManualScore] = useState("");
  const [feedback, setFeedback] = useState("");
  const [decision, setDecision] = useState<"graded" | "changes_requested">("graded");
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) throw new Error("Inicia sesión para revisar entregas.");
      const { data: roleAssignments, error: roleAssignmentError } = await supabase.from("user_role_assignments").select("role_id").eq("user_id", auth.user.id);
      if (roleAssignmentError) throw roleAssignmentError;
      const roleIds = [...new Set((roleAssignments ?? []).map((row) => row.role_id))];
      const { data: roles, error: rolesError } = roleIds.length ? await supabase.from("roles").select("role_key").in("id", roleIds) : { data: [], error: null };
      if (rolesError) throw rolesError;
      const roleKeys = new Set((roles ?? []).map((row) => row.role_key));
      if (!["tutor", "academic_editor", "district_coordinator", "area_coordinator", "national_admin"].some((key) => roleKeys.has(key))) {
        throw new Error("Tu perfil no tiene permisos para revisar entregas.");
      }

      const { data: submissionRows, error: submissionError } = await supabase.from("academic_activity_submissions")
        .select("id, assignment_id, activity_id, enrollment_id, district_id, user_id, attempt_number, response_text, external_url, status, awarded_points, feedback, submitted_at")
        .in("status", ["submitted", "changes_requested"]).order("submitted_at", { ascending: true });
      if (submissionError) throw submissionError;
      const submissions = (submissionRows ?? []) as Submission[];
      if (!submissions.length) { setItems([]); setSelectedId(""); setRubric([]); setAttachments([]); return; }

      const activityIds = [...new Set(submissions.map((row) => row.activity_id))];
      const userIds = [...new Set(submissions.map((row) => row.user_id))];
      const submissionIds = submissions.map((row) => row.id);
      const [activityResult, profileResult, fileResult] = await Promise.all([
        supabase.from("academic_activities").select("id, title, total_points").in("id", activityIds),
        supabase.from("profiles").select("id, full_name").in("id", userIds),
        supabase.from("academic_activity_submission_files").select("id, submission_id, file_name, mime_type, size_bytes, storage_path").in("submission_id", submissionIds),
      ]);
      if (activityResult.error) throw activityResult.error;
      if (profileResult.error) throw profileResult.error;
      if (fileResult.error) throw fileResult.error;
      const activityMap = new Map(((activityResult.data ?? []) as Activity[]).map((row) => [row.id, row]));
      const profileMap = new Map((profileResult.data ?? []).map((row) => [row.id, row.full_name || "Estudiante"]));
      const nextItems = submissions.flatMap((submission) => {
        const activity = activityMap.get(submission.activity_id);
        return activity ? [{ submission, activity, studentName: profileMap.get(submission.user_id) || "Estudiante" }] : [];
      });
      setItems(nextItems);
      setSelectedId((current) => nextItems.some((row) => row.submission.id === current) ? current : nextItems[0]?.submission.id || "");

      const enriched = await Promise.all(((fileResult.data ?? []) as Attachment[]).map(async (file) => {
        const { data } = await supabase.storage.from("academic-activity-submissions").createSignedUrl(file.storage_path, 300);
        return { ...file, url: data?.signedUrl };
      }));
      setAttachments(enriched);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No fue posible cargar la bandeja de revisión.");
      setItems([]);
    } finally { setLoading(false); }
  }, [supabase]);

  useEffect(() => { void loadData(); }, [loadData]);

  const selected = items.find((item) => item.submission.id === selectedId) ?? null;
  const selectedAttachments = attachments.filter((file) => file.submission_id === selectedId);

  useEffect(() => {
    let active = true;
    async function loadRubric() {
      if (!selected) { setRubric([]); return; }
      const { data, error: rubricError } = await supabase.from("academic_activity_rubric_criteria")
        .select("id, activity_id, title, description, max_points, sort_order")
        .eq("activity_id", selected.submission.activity_id).order("sort_order");
      if (!active) return;
      if (rubricError) { setError(rubricError.message); setRubric([]); return; }
      const rows = (data ?? []) as Rubric[];
      setRubric(rows);
      setScores((current) => Object.fromEntries(rows.map((row) => [row.id, current[row.id] ?? "0"])));
      setManualScore(String(selected.submission.awarded_points ?? ""));
      setFeedback(selected.submission.feedback ?? "");
      setDecision("graded");
    }
    void loadRubric();
    return () => { active = false; };
  }, [selectedId, selected?.submission.activity_id, supabase]);

  const visible = items.filter((item) => filter === "all" || (filter === "submitted" ? item.submission.status === "submitted" : item.submission.status === "changes_requested"));
  const totalRubric = rubric.reduce((sum, item) => sum + item.max_points, 0);
  const calculatedScore = rubric.reduce((sum, item) => sum + (Number(scores[item.id]) || 0), 0);

  async function saveReview() {
    if (!selected || saving) return;
    setSaving(true); setError(""); setNotice("");
    try {
      if (decision === "changes_requested" && !feedback.trim()) throw new Error("Escribe la retroalimentación que debe corregir el estudiante.");
      let awarded = Number(manualScore);
      let rubricScores: Array<{ criterion_id: string; awarded_points: number }> = [];
      if (decision === "graded" && rubric.length) {
        rubricScores = rubric.map((item) => ({ criterion_id: item.id, awarded_points: Number(scores[item.id]) }));
        for (const score of rubricScores) {
          const criterion = rubric.find((row) => row.id === score.criterion_id);
          if (!Number.isFinite(score.awarded_points) || score.awarded_points < 0 || score.awarded_points > (criterion?.max_points ?? 0)) {
            throw new Error("Cada puntaje debe estar dentro del máximo de su criterio.");
          }
        }
        awarded = calculatedScore;
        }
      if (decision === "graded" && (!Number.isFinite(awarded) || awarded < 0 || awarded > selected.activity.total_points)) {
        throw new Error("La calificación debe estar entre 0 y " + selected.activity.total_points + ".");
      }
      const { error: reviewError } = await supabase.rpc("review_academic_activity_submission", {
        p_submission_id: selected.submission.id,
        p_awarded_points: decision === "graded" ? awarded : 0,
        p_feedback: feedback.trim() || null,
        p_status: decision,
        p_rubric_scores: decision === "graded" ? rubricScores : [],
      });
      if (reviewError) throw reviewError;
      setNotice(decision === "graded" ? "Calificación guardada." : "Se solicitó una corrección al estudiante.");
      await loadData();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No fue posible guardar la revisión."); }
    finally { setSaving(false); }
  }

  return (
    <main className="min-h-screen bg-[#F4F7FA] px-4 py-8 text-[#102D4D] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#19A7A0]">Espacio del tutor</p><h1 className="mt-2 text-3xl font-bold">Revisión de actividades</h1><p className="mt-2 text-sm text-slate-500">Entregas reales recibidas desde las matrículas de tus cursos y del distrito.</p></div><button type="button" onClick={() => void loadData()} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold">Actualizar bandeja</button></header>
        {error && <div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
        {notice && <div role="status" className="mb-5 rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">{notice}</div>}
        {loading ? <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">Cargando entregas...</div> : (
          <div className="grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
            <aside className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="mb-4 flex gap-2"><button type="button" onClick={() => setFilter("all")} className={"rounded-full px-3 py-2 text-xs font-semibold " + (filter === "all" ? "bg-[#087DB5] text-white" : "bg-slate-100 text-slate-600")}>Todas ({items.length})</button><button type="button" onClick={() => setFilter("submitted")} className={"rounded-full px-3 py-2 text-xs font-semibold " + (filter === "submitted" ? "bg-[#087DB5] text-white" : "bg-slate-100 text-slate-600")}>Nuevas</button><button type="button" onClick={() => setFilter("changes")} className={"rounded-full px-3 py-2 text-xs font-semibold " + (filter === "changes" ? "bg-[#087DB5] text-white" : "bg-slate-100 text-slate-600")}>Ajustes</button></div>
              {visible.length === 0 ? <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500">No hay entregas pendientes de revisión.</p> : <div className="space-y-2">{visible.map((item) => <button key={item.submission.id} type="button" onClick={() => setSelectedId(item.submission.id)} className={"w-full rounded-xl border p-3 text-left " + (selectedId === item.submission.id ? "border-[#087DB5] bg-sky-50" : "border-slate-100 hover:bg-slate-50")}><p className="truncate text-sm font-bold">{item.studentName}</p><p className="mt-1 truncate text-xs text-slate-600">{item.activity.title}</p><div className="mt-2 flex items-center justify-between text-[11px] text-slate-500"><span>Intento {item.submission.attempt_number}</span><span>{item.submission.status === "submitted" ? "Nueva entrega" : "Con ajustes"}</span></div></button>)}</div>}
            </aside>
            <section className="rounded-2xl border border-slate-200 bg-white p-6">
              {!selected ? <div className="py-16 text-center text-sm text-slate-500">Selecciona una entrega para revisarla.</div> : <>
                <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-[#19A7A0]">{selected.studentName}</p><h2 className="mt-1 text-xl font-bold">{selected.activity.title}</h2><p className="mt-1 text-xs text-slate-500">Intento {selected.submission.attempt_number} · {selected.submission.submitted_at ? new Date(selected.submission.submitted_at).toLocaleString("es-CO") : "Sin fecha"}</p></div><span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">{selected.submission.status === "submitted" ? "En revisión" : "Requiere ajustes"}</span></div>
                {selected.submission.response_text && <div className="mt-6 rounded-xl bg-slate-50 p-4"><h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Respuesta del estudiante</h3><p className="mt-3 whitespace-pre-wrap text-sm leading-7">{selected.submission.response_text}</p></div>}
                {selected.submission.external_url && <p className="mt-4 text-sm"><a href={selected.submission.external_url} target="_blank" rel="noreferrer" className="font-semibold text-[#087DB5]">Abrir enlace entregado ↗</a></p>}
                {selectedAttachments.length > 0 && <div className="mt-5"><h3 className="text-sm font-bold">Archivos adjuntos</h3><ul className="mt-2 space-y-2">{selectedAttachments.map((file) => <li key={file.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 p-3 text-sm"><span className="truncate">{file.file_name} · {(file.size_bytes / 1024 / 1024).toFixed(1)} MB</span>{file.url && <a href={file.url} target="_blank" rel="noreferrer" className="shrink-0 font-semibold text-[#087DB5]">Abrir</a>}</li>)}</ul></div>}
                <div className="mt-7 border-t border-slate-100 pt-6"><h3 className="text-lg font-bold">Evaluar entrega</h3>
                  {rubric.length > 0 ? <div className="mt-4 space-y-3">{rubric.map((criterion) => <div key={criterion.id} className="grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-[1fr_120px]"><div><p className="text-sm font-semibold">{criterion.title} <span className="text-xs font-normal text-slate-500">· máximo {criterion.max_points}</span></p>{criterion.description && <p className="mt-1 text-xs text-slate-500">{criterion.description}</p>}</div><label className="text-xs font-semibold">Puntaje<input type="number" min="0" max={criterion.max_points} step="0.01" value={scores[criterion.id] ?? "0"} onChange={(event) => setScores((current) => ({ ...current, [criterion.id]: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-sm" /></label></div>)}<p className="text-right text-sm font-bold">Total: {calculatedScore} / {totalRubric}</p></div> : <label className="mt-4 block text-xs font-semibold">Puntaje obtenido<input type="number" min="0" max={selected.activity.total_points} step="0.01" value={manualScore} onChange={(event) => setManualScore(event.target.value)} className="mt-2 w-full max-w-xs rounded-xl border border-slate-200 p-3 text-sm" /></label>}
                  <label className="mt-4 block text-xs font-semibold">Retroalimentación<textarea rows={4} value={feedback} onChange={(event) => setFeedback(event.target.value)} maxLength={4000} className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm font-normal" placeholder="Describe los aciertos y los aspectos por mejorar..." /></label>
                  <div className="mt-4 flex flex-wrap items-center gap-3"><select value={decision} onChange={(event) => setDecision(event.target.value as "graded" | "changes_requested")} className="rounded-xl border border-slate-200 p-3 text-sm"><option value="graded">Calificar entrega</option><option value="changes_requested">Solicitar correcciones</option></select><button type="button" disabled={saving} onClick={() => void saveReview()} className="rounded-xl bg-[#087DB5] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Guardando..." : "Guardar revisión"}</button></div>
                </div>
              </>}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
