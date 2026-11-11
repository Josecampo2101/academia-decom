"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type AccessState = "checking" | "allowed" | "denied" | "error";
type ReviewStatus = "Pendiente" | "En revisión" | "Calificada" | "Requiere ajustes";
type Decision = "Aprobar" | "Solicitar ajustes" | "Rechazar";

type Criterion = { id: string; title: string; description: string; points: number };
type Submission = {
  id: string;
  student: string;
  initials: string;
  activity: string;
  course: string;
  submittedAt: string;
  status: ReviewStatus;
  attempt: number;
  excerpt: string;
  rubric: Criterion[];
};

const demoSubmissions: Submission[] = [
  {
    id: "ENT-204", student: "María Fernanda Ríos", initials: "MR",
    activity: "Aplicación de la identidad visual", course: "Identidad corporativa DECOM",
    submittedAt: "11 nov 2026 · 8:42 a. m.", status: "Pendiente", attempt: 1,
    excerpt: "Presenta una propuesta de aplicación de los elementos visuales en una pieza institucional. Explica la elección de jerarquías, contraste y adaptación al público.",
    rubric: [
      { id: "purpose", title: "Propósito comunicativo", description: "La pieza responde al objetivo y al público definido.", points: 25 },
      { id: "identity", title: "Aplicación de identidad", description: "Respeta los lineamientos visuales institucionales.", points: 30 },
      { id: "clarity", title: "Claridad y composición", description: "Organiza la información con jerarquía y legibilidad.", points: 25 },
      { id: "argument", title: "Justificación", description: "Explica las decisiones de diseño con argumentos pertinentes.", points: 20 },
    ],
  },
  {
    id: "ENT-203", student: "Andrés Felipe Gómez", initials: "AG",
    activity: "Análisis de comunicación institucional", course: "Fundamentos de la comunicación",
    submittedAt: "10 nov 2026 · 4:15 p. m.", status: "En revisión", attempt: 2,
    excerpt: "Analiza la coherencia entre mensaje, audiencia y medio. Incluye una recomendación para mejorar la claridad del mensaje.",
    rubric: [
      { id: "analysis", title: "Análisis del contexto", description: "Identifica audiencia, propósito y canal.", points: 35 },
      { id: "coherence", title: "Coherencia del mensaje", description: "Relaciona de forma lógica los elementos analizados.", points: 35 },
      { id: "proposal", title: "Propuesta de mejora", description: "Formula una recomendación viable y bien sustentada.", points: 30 },
    ],
  },
  {
    id: "ENT-202", student: "Daniela Pérez", initials: "DP",
    activity: "Principios de identidad DECOM", course: "Identidad corporativa DECOM",
    submittedAt: "10 nov 2026 · 11:20 a. m.", status: "Requiere ajustes", attempt: 2,
    excerpt: "Explica los principios institucionales y su aplicación en el trabajo de comunicaciones. La segunda entrega amplía los ejemplos.",
    rubric: [
      { id: "principles", title: "Comprensión de principios", description: "Explica los principios con precisión.", points: 40 },
      { id: "application", title: "Aplicación práctica", description: "Relaciona los principios con situaciones reales.", points: 35 },
      { id: "writing", title: "Redacción", description: "Presenta ideas claras, ordenadas y correctas.", points: 25 },
    ],
  },
];

const demoHistory = [
  { date: "10 nov 2026 · 2:10 p. m.", label: "Primera entrega recibida", detail: "Intento 1 · Enviado por la estudiante" },
  { date: "10 nov 2026 · 5:35 p. m.", label: "Ajustes solicitados", detail: "Se pidió ampliar la justificación de las decisiones visuales" },
  { date: "11 nov 2026 · 8:42 a. m.", label: "Nueva entrega recibida", detail: "Intento 2 · Pendiente de revisión" },
];

const filters = ["Todas", "Pendiente", "En revisión", "Calificada", "Requiere ajustes"] as const;

export default function TutorAssessmentWorkflowPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [access, setAccess] = useState<AccessState>("checking");
  const [displayName, setDisplayName] = useState("Tutor");
  const [filter, setFilter] = useState<(typeof filters)[number]>("Todas");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(demoSubmissions[0].id);
  const [scores, setScores] = useState<Record<string, Record<string, number>>>({});
  const [feedback, setFeedback] = useState("");
  const [decision, setDecision] = useState<Decision>("Aprobar");
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    let active = true;
    async function verifyAccess() {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (!active) return;
        if (authError || !user) {
          router.replace("/conexion");
          return;
        }
        const metadataName = user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email?.split("@")[0] ?? "Tutor";
        setDisplayName(String(metadataName));
        const { data: assignments, error: assignmentsError } = await supabase
          .from("user_role_assignments").select("role_id").eq("user_id", user.id);
        if (assignmentsError) throw assignmentsError;
        if (!active) return;
        const roleIds = [...new Set((assignments ?? []).map((item) => item.role_id))];
        if (roleIds.length === 0) {
          setAccess("denied");
          return;
        }
        const { data: roles, error: rolesError } = await supabase.from("roles").select("role_key").in("id", roleIds);
        if (rolesError) throw rolesError;
        if (!active) return;
        const keys = (roles ?? []).map((role) => role.role_key);
        setAccess(keys.includes("tutor") || keys.includes("national_admin") ? "allowed" : "denied");
      } catch (error) {
        console.error("No fue posible validar el acceso al espacio de revisión:", error);
        if (active) setAccess("error");
      }
    }
    void verifyAccess();
    return () => { active = false; };
  }, [router, supabase]);

  const visibleSubmissions = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("es");
    return demoSubmissions.filter((item) => {
      const matchesFilter = filter === "Todas" || item.status === filter;
      const matchesQuery = !query || [item.student, item.activity, item.course, item.id]
        .some((value) => value.toLocaleLowerCase("es").includes(query));
      return matchesFilter && matchesQuery;
    });
  }, [filter, search]);

  const selected = demoSubmissions.find((item) => item.id === selectedId) ?? visibleSubmissions[0] ?? demoSubmissions[0];
  const selectedScores = scores[selected.id] ?? {};
  const total = selected.rubric.reduce((sum, criterion) => sum + (selectedScores[criterion.id] ?? 0), 0);
  const maxPoints = selected.rubric.reduce((sum, criterion) => sum + criterion.points, 0);
  const allScored = selected.rubric.every((criterion) => typeof selectedScores[criterion.id] === "number");
  const feedbackRequired = decision !== "Aprobar";

  function setCriterionScore(criterion: Criterion, rawValue: string) {
    const parsed = rawValue === "" ? 0 : Number(rawValue);
    if (!Number.isFinite(parsed)) return;
    const value = Math.max(0, Math.min(criterion.points, Math.round(parsed)));
    setScores((current) => ({
      ...current,
      [selected.id]: { ...current[selected.id], [criterion.id]: value },
    }));
    setShowPreview(false);
  }

  function selectSubmission(id: string) {
    setSelectedId(id);
    setFeedback("");
    setDecision("Aprobar");
    setShowPreview(false);
  }

  if (access === "checking") {
    return <main className="flex min-h-screen items-center justify-center bg-[#F4F7FA] px-6"><div className="text-center"><div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-[#087DB5]/20 border-t-[#087DB5]" /><p className="mt-4 text-sm text-slate-500">Verificando tu acceso...</p></div></main>;
  }

  if (access !== "allowed") {
    return <main className="flex min-h-screen items-center justify-center bg-[#F4F7FA] px-6"><section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-2xl text-amber-700">!</div><h1 className="mt-5 text-xl font-bold text-[#102D4D]">{access === "error" ? "No pudimos validar tu acceso" : "Acceso restringido"}</h1><p className="mt-2 text-sm leading-6 text-slate-500">{access === "error" ? "Ocurrió un problema al consultar tus permisos. Intenta nuevamente." : "Este espacio está habilitado para tutores con una asignación vigente."}</p><div className="mt-6 flex justify-center gap-2"><button type="button" onClick={() => window.location.reload()} className="rounded-xl bg-[#087DB5] px-5 py-3 text-sm font-semibold text-white">Reintentar</button><button type="button" onClick={() => router.push("/dashboard/tutor")} className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600">Volver</button></div></section></main>;
  }

  return (
    <main className="min-h-screen bg-[#F4F7FA] text-[#102D4D]">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-5 py-4 md:px-8">
          <div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#087DB5] text-xl font-bold text-white">✦</div><div><p className="text-sm font-extrabold tracking-wide">ACADEMIA DECOM</p><p className="text-xs text-slate-400">Revisión y evaluación de actividades</p></div></div>
          <div className="flex items-center gap-3"><span className="hidden text-right sm:block"><span className="block text-sm font-semibold">{displayName}</span><span className="block text-xs text-slate-400">Espacio del tutor</span></span><button type="button" onClick={() => router.push("/dashboard/tutor")} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">Volver a tutoría</button></div>
        </div>
      </header>

      <div className="mx-auto max-w-[1500px] space-y-7 px-5 py-7 pb-12 md:px-8 md:py-9">
        <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#19A7A0]">Acompañamiento y evaluación</p><h1 className="mt-2 text-2xl font-extrabold tracking-tight md:text-3xl">Revisión de entregas</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Evalúa cada criterio, registra observaciones y prepara una decisión para el estudiante.</p></div>
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Datos de demostración</span>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Pendientes", value: demoSubmissions.filter((item) => item.status === "Pendiente").length, detail: "Esperan primera revisión" },
            { label: "En revisión", value: demoSubmissions.filter((item) => item.status === "En revisión").length, detail: "Trabajo iniciado" },
            { label: "Calificadas", value: demoSubmissions.filter((item) => item.status === "Calificada").length, detail: "Evaluación completada" },
            { label: "Requieren ajustes", value: demoSubmissions.filter((item) => item.status === "Requiere ajustes").length, detail: "Con nueva entrega pendiente" },
          ].map((item) => <article key={item.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-semibold text-slate-400">{item.label}</p><p className="mt-2 text-3xl font-extrabold tabular-nums">{item.value}</p><p className="mt-1 text-xs text-slate-400">{item.detail}</p></article>)}
        </section>

        <section className="grid items-start gap-5 xl:grid-cols-[minmax(300px,0.8fr)_minmax(0,1.7fr)]">
          <aside className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-2"><h2 className="text-base font-bold">Bandeja de entregas</h2><span className="text-xs text-slate-400">{visibleSubmissions.length} resultados</span></div>
            <label className="mt-4 block"><span className="sr-only">Buscar entregas</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar estudiante o actividad..." className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#087DB5]" /></label>
            <div className="mt-3 flex flex-wrap gap-2">{filters.map((item) => <button key={item} type="button" onClick={() => setFilter(item)} aria-pressed={filter === item} className={`rounded-full px-3 py-1.5 text-[11px] font-semibold ${filter === item ? "bg-[#087DB5] text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>{item}</button>)}</div>
            <div className="mt-4 space-y-2">
              {visibleSubmissions.map((item) => <button key={item.id} type="button" onClick={() => selectSubmission(item.id)} aria-pressed={selected.id === item.id} className={`w-full rounded-2xl border p-4 text-left transition ${selected.id === item.id ? "border-[#087DB5] bg-sky-50/70" : "border-slate-100 hover:border-slate-300"}`}>
                <div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#E5F2F8] text-xs font-bold text-[#087DB5]">{item.initials}</span><span className="min-w-0 flex-1"><span className="block text-xs font-bold">{item.activity}</span><span className="mt-1 block text-[11px] text-slate-500">{item.student}</span><span className="mt-2 inline-flex rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">{item.status}</span></span></div>
              </button>)}
              {visibleSubmissions.length === 0 && <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400">No hay entregas para este filtro.</p>}
            </div>
          </aside>

          <div className="space-y-5">
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-7">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#19A7A0]">{selected.id} · Intento {selected.attempt}</p><h2 className="mt-2 text-xl font-bold">{selected.activity}</h2><p className="mt-1 text-sm text-slate-500">{selected.student} · {selected.course}</p></div><span className="w-fit rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800">{selected.status}</span></div>
              <div className="mt-5 rounded-2xl bg-[#F4F7FA] p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Entrega del estudiante</p><p className="mt-2 text-sm leading-6 text-slate-600">{selected.excerpt}</p><p className="mt-3 text-[11px] text-slate-400">Recibida: {selected.submittedAt}</p></div>

              <div className="mt-6 flex flex-wrap items-end justify-between gap-3"><div><h3 className="text-sm font-bold">Rúbrica de evaluación</h3><p className="mt-1 text-xs text-slate-400">Asigna un puntaje entero por criterio, sin superar su máximo.</p></div><div className="rounded-2xl bg-[#EAF5F8] px-4 py-2 text-right"><p className="text-[10px] font-semibold uppercase text-slate-500">Puntaje preliminar</p><p className="text-2xl font-extrabold tabular-nums text-[#087DB5]">{total}<span className="text-sm font-semibold text-slate-400"> / {maxPoints}</span></p></div></div>
              <div className="mt-4 space-y-3">
                {selected.rubric.map((criterion) => <div key={criterion.id} className="grid gap-3 rounded-2xl border border-slate-100 p-4 sm:grid-cols-[minmax(0,1fr)_110px] sm:items-center"><div><p className="text-sm font-semibold">{criterion.title}</p><p className="mt-1 text-xs leading-5 text-slate-500">{criterion.description}</p><p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Máximo: {criterion.points} puntos</p></div><label className="block"><span className="text-[10px] font-semibold text-slate-500">Puntaje obtenido</span><input type="number" min={0} max={criterion.points} step={1} value={selectedScores[criterion.id] ?? 0} onChange={(event) => setCriterionScore(criterion, event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-bold tabular-nums outline-none focus:border-[#087DB5]" /><span className="mt-1 block text-right text-[10px] text-slate-400">de {criterion.points}</span></label></div>)}
              </div>
              <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3"><span className="text-xs font-semibold text-slate-500">Resultado porcentual</span><span className="text-sm font-extrabold tabular-nums">{maxPoints ? Math.round((total / maxPoints) * 100) : 0}%</span></div>

              <div className="mt-6"><label htmlFor="review-feedback" className="text-sm font-bold">Retroalimentación</label><textarea id="review-feedback" value={feedback} onChange={(event) => { setFeedback(event.target.value); setShowPreview(false); }} rows={4} maxLength={2000} placeholder="Describe los logros, los aspectos por mejorar y los pasos concretos para avanzar..." className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm leading-6 outline-none focus:border-[#087DB5]" /><p className="mt-1 text-right text-[10px] text-slate-400">{feedback.length}/2000</p></div>

              <div className="mt-6"><p className="text-sm font-bold">Decisión de revisión</p><div className="mt-3 grid gap-2 sm:grid-cols-3">{(["Aprobar", "Solicitar ajustes", "Rechazar"] as const).map((item) => <button key={item} type="button" aria-pressed={decision === item} onClick={() => { setDecision(item); setShowPreview(false); }} className={`rounded-xl border px-3 py-3 text-xs font-semibold transition ${decision === item ? "border-[#087DB5] bg-sky-50 text-[#087DB5]" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}>{item}</button>)}</div>{feedbackRequired && <p className="mt-2 text-[11px] text-amber-700">Esta decisión requiere explicar al estudiante qué debe corregir.</p>}</div>

              {showPreview && <div role="status" className="mt-5 rounded-2xl border border-teal-200 bg-teal-50 p-4"><p className="text-sm font-bold text-teal-900">Vista previa preparada</p><p className="mt-1 text-xs leading-5 text-teal-800">Decisión: {decision}. Puntaje: {total}/{maxPoints} ({maxPoints ? Math.round((total / maxPoints) * 100) : 0}%). {feedback.trim().length} caracteres de retroalimentación. No se ha guardado, notificado ni cambiado el estado real de la entrega.</p></div>}

              <div className="mt-6 flex flex-col-reverse justify-between gap-3 border-t border-slate-100 pt-5 sm:flex-row"><button type="button" onClick={() => router.push("/dashboard/tutor")} className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50">Volver a bandeja general</button><button type="button" disabled={!allScored || (feedbackRequired && !feedback.trim())} onClick={() => setShowPreview(true)} className="rounded-xl bg-[#087DB5] px-5 py-3 text-sm font-semibold text-white hover:bg-[#066a9b] disabled:cursor-not-allowed disabled:opacity-40">Previsualizar revisión</button></div>
              <p className="mt-4 rounded-xl bg-[#F4F7FA] p-3 text-[11px] leading-5 text-slate-500">Prototipo local: los puntajes, la retroalimentación y la decisión solo viven en esta sesión. No se registra una calificación ni se envían notificaciones.</p>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-7"><div className="flex items-center justify-between gap-3"><div><h3 className="text-sm font-bold">Historial de intentos y seguimiento</h3><p className="mt-1 text-xs text-slate-400">Registro de demostración para ilustrar la trazabilidad.</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-semibold text-slate-500">{demoHistory.length} eventos</span></div><ol className="mt-5 space-y-4">{demoHistory.map((event, index) => <li key={event.label} className="relative flex gap-3"><span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#E5F2F8] text-[10px] font-bold text-[#087DB5]">{index + 1}</span><div className="min-w-0 flex-1 border-b border-slate-100 pb-4"><p className="text-xs font-bold">{event.label}</p><p className="mt-1 text-xs text-slate-500">{event.detail}</p><p className="mt-1 text-[10px] text-slate-400">{event.date}</p></div></li>)}</ol></section>
          </div>
        </section>
        <footer className="border-t border-slate-200 pt-5 text-xs text-slate-400">Academia DECOM · Revisión de entregas · Datos ficticios de demostración</footer>
      </div>
    </main>
  );
}
