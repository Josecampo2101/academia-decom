"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { reviewManualAnswer } from "@/lib/academic/manual-assessment-review";
import {
  readAssessmentReviewQueue,
  upsertAssessmentReviewQueueItem,
  type AssessmentReviewQueueItem,
} from "@/lib/academic/assessment-review-bridge";

type Props = { tutorId: string };

export default function ManualAssessmentReviewInbox({ tutorId }: Props) {
  const [items, setItems] = useState<AssessmentReviewQueueItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [questionId, setQuestionId] = useState("");
  const [score, setScore] = useState("0");
  const [feedback, setFeedback] = useState("");
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState<"Pendientes" | "Revisadas" | "Todas">("Pendientes");

  const refresh = useCallback(() => {
    const next = readAssessmentReviewQueue();
    setItems(next);
    setSelectedId((current) => current && next.some((item) => item.id === current) ? current : next[0]?.id ?? null);
  }, []);

  useEffect(() => {
    // La bandeja se hidrata desde el almacenamiento local de demostración.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
    const onUpdate = () => refresh();
    window.addEventListener("storage", onUpdate);
    window.addEventListener("focus", onUpdate);
    window.addEventListener("academia-decom:assessment-review-queue-updated", onUpdate);
    return () => {
      window.removeEventListener("storage", onUpdate);
      window.removeEventListener("focus", onUpdate);
      window.removeEventListener("academia-decom:assessment-review-queue-updated", onUpdate);
    };
  }, [refresh]);

  const selected = useMemo(() => items.find((item) => item.id === selectedId) ?? null, [items, selectedId]);
  const pendingCount = items.reduce((total, item) => total + item.attempt.result.pendingManual, 0);
  const visibleItems = items.filter((item) => {
    const hasPending = item.attempt.result.pendingManual > 0;
    return filter === "Todas" || (filter === "Pendientes" ? hasPending : !hasPending);
  });
  const pendingQuestions = selected?.attempt.result.questions.filter((question) => question.status === "revision_manual") ?? [];
  const selectedQuestion = pendingQuestions.find((question) => question.questionId === questionId) ?? pendingQuestions[0] ?? null;

  function selectItem(item: AssessmentReviewQueueItem) {
    setSelectedId(item.id);
    const firstPending = item.attempt.result.questions.find((question) => question.status === "revision_manual");
    setQuestionId(firstPending?.questionId ?? "");
    setScore("0");
    setFeedback("");
    setNotice("");
  }

  function saveReview() {
    if (!selected || !selectedQuestion) return;
    const result = reviewManualAnswer(selected.attempt, {
      questionId: selectedQuestion.questionId,
      reviewerId: tutorId,
      earnedPoints: Number(score),
      feedback,
    });
    if (!result.ok) {
      const messages: Record<typeof result.error, string> = {
        question_not_found: "No se encontró la pregunta del intento.",
        question_already_reviewed: "Esta respuesta ya tiene una revisión registrada.",
        question_not_pending: "Esta pregunta no está pendiente de revisión manual.",
        invalid_reviewer: "No se pudo identificar al tutor.",
        invalid_score: "El puntaje debe ser un número entero entre cero y el máximo permitido.",
        invalid_feedback: "Escribe una retroalimentación de hasta 2.000 caracteres.",
        invalid_review_date: "La fecha de revisión no es válida.",
      };
      setNotice(messages[result.error]);
      return;
    }

    const updated = {
      ...selected,
      attempt: result.attempt,
      updatedAt: result.review.reviewedAt,
    };
    if (!upsertAssessmentReviewQueueItem(updated)) {
      setNotice("No fue posible guardar la revisión en este navegador.");
      return;
    }
    const next = items.map((item) => item.id === updated.id ? updated : item);
    setItems(next);
    const nextPending = result.attempt.result.questions.find((question) => question.status === "revision_manual");
    setQuestionId(nextPending?.questionId ?? "");
    setScore("0");
    setFeedback("");
    setNotice("Revisión guardada en la demostración local. El estudiante podrá consultarla al volver a abrir su práctica en este navegador.");
  }

  return (
    <section className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-400">Intentos recibidos</p><p className="mt-2 text-2xl font-extrabold">{items.length}</p></article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-400">Respuestas pendientes</p><p className="mt-2 text-2xl font-extrabold">{pendingCount}</p></article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-400">Respuestas revisadas</p><p className="mt-2 text-2xl font-extrabold">{items.reduce((total, item) => total + (item.attempt.manualReviews?.length ?? 0), 0)}</p></article>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 md:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-base font-bold">Respuestas cortas por revisar</h2><p className="mt-1 text-xs text-slate-500">Intentos compartidos desde la práctica del estudiante en este navegador.</p></div>
          <button type="button" onClick={refresh} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">Actualizar bandeja</button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {(["Pendientes", "Revisadas", "Todas"] as const).map((value) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)} className={`rounded-full px-3 py-2 text-xs font-semibold ${filter === value ? "bg-[#087DB5] text-white" : "bg-slate-100 text-slate-500"}`}>{value}</button>)}
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(220px,0.8fr)_minmax(0,1.4fr)]">
          <div className="space-y-2">
            {visibleItems.map((item) => <button key={item.id} type="button" onClick={() => selectItem(item)} aria-pressed={selected?.id === item.id} className={`w-full rounded-2xl border p-4 text-left ${selected?.id === item.id ? "border-[#087DB5] bg-sky-50" : "border-slate-200 hover:border-slate-300"}`}>
              <span className="block text-xs font-bold">{item.studentLabel || "Estudiante"}</span>
              <span className="mt-1 block break-all text-[10px] text-slate-400">Intento {item.attempt.id}</span>
              <span className="mt-2 block text-[11px] text-slate-500">{item.attempt.result.pendingManual} pendiente(s) · {item.attempt.manualReviews?.length ?? 0} revisada(s)</span>
            </button>)}
            {visibleItems.length === 0 && <p className="rounded-xl border border-dashed border-slate-200 p-5 text-center text-xs text-slate-500">No hay intentos para este filtro.</p>}
          </div>

          {selected && <div className="rounded-2xl bg-[#F4F7FA] p-4 md:p-5">
            <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="text-sm font-bold">{selected.studentLabel || "Estudiante"}</h3><p className="mt-1 text-[10px] text-slate-500">Enviado {new Date(selected.attempt.submittedAt).toLocaleString("es-CO")}</p></div><span className="rounded-full bg-white px-3 py-1 text-[10px] font-bold text-slate-600">{selected.attempt.result.pendingManual ? "Pendiente" : "Revisado"}</span></div>
            <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Resultado objetivo</p><p className="mt-1 text-lg font-extrabold">{selected.attempt.result.objectiveEarned}/{selected.attempt.result.objectivePossible} puntos</p><p className="mt-1 text-[10px] text-slate-500">Preguntas cortas pendientes: {selected.attempt.result.pendingManual}</p></div>

            {pendingQuestions.length > 0 && selectedQuestion && <div className="mt-4 space-y-3">
              <label className="block"><span className="text-xs font-bold">Pregunta pendiente</span><select value={selectedQuestion.questionId} onChange={(event) => { setQuestionId(event.target.value); setScore("0"); setFeedback(""); setNotice(""); }} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs">{pendingQuestions.map((question) => <option key={question.questionId} value={question.questionId}>{question.questionId}</option>)}</select></label>
              <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Respuesta del estudiante</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{String(selected.attempt.answers[selectedQuestion.questionId] ?? "Sin respuesta")}</p><p className="mt-3 text-[10px] text-slate-400">Puntaje máximo: {selectedQuestion.possiblePoints}</p></div>
              <label className="block"><span className="text-xs font-bold">Puntaje obtenido</span><input type="number" min={0} max={selectedQuestion.possiblePoints} step={1} value={score} onChange={(event) => setScore(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm" /><span className="mt-1 block text-[10px] text-slate-400">Entre 0 y {selectedQuestion.possiblePoints} puntos.</span></label>
              <label className="block"><span className="text-xs font-bold">Retroalimentación obligatoria</span><textarea value={feedback} onChange={(event) => setFeedback(event.target.value)} maxLength={2000} rows={4} placeholder="Explica qué está bien y qué puede mejorar..." className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs leading-5" /><span className="mt-1 block text-right text-[10px] text-slate-400">{feedback.length}/2000</span></label>
              <button type="button" onClick={saveReview} className="rounded-xl bg-[#087DB5] px-4 py-3 text-xs font-bold text-white">Guardar revisión manual</button>
            </div>}

            {(selected.attempt.manualReviews?.length ?? 0) > 0 && <div className="mt-4 space-y-2"><h4 className="text-xs font-bold">Revisiones registradas</h4>{selected.attempt.manualReviews?.map((review) => <article key={review.questionId} className="rounded-xl border border-slate-200 bg-white p-3"><div className="flex flex-wrap justify-between gap-2"><p className="text-xs font-bold">{review.questionId}</p><p className="text-xs font-bold text-[#087DB5]">{review.earnedPoints}/{review.possiblePoints}</p></div><p className="mt-2 text-xs leading-5 text-slate-600">{review.feedback}</p><p className="mt-2 text-[10px] text-slate-400">Revisada {new Date(review.reviewedAt).toLocaleString("es-CO")}</p></article>)}</div>}
          </div>}
        </div>
        {notice && <p role="status" className="mt-4 rounded-xl bg-sky-50 p-3 text-xs leading-5 text-sky-800">{notice}</p>}
      </div>
      <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-[11px] leading-5 text-amber-900">Prototipo de demostración local. La bandeja usa localStorage del mismo navegador; no sincroniza dispositivos ni sesiones distintas. La autorización y el puntaje deben validarse en servidor antes de uso académico real.</p>
    </section>
  );
}
