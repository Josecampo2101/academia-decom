"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  createAssessmentAttempt,
  gradeAssessment,
  parseAssessmentAttempts,
  PRACTICE_ASSESSMENT_ID,
  PRACTICE_ATTEMPTS_STORAGE_PREFIX,
  type AssessmentAnswers,
  type AssessmentAttempt,
} from "@/lib/academic/assessment-attempts";
import { practiceAnswerKey, practiceQuestions } from "@/lib/academic/assessment-demo-fixtures";
import AssessmentHistoryPanel from "./assessment-history-panel";
import { getStudentAssessmentReviews, upsertAssessmentReviewQueueItem } from "@/lib/academic/assessment-review-bridge";

type AccessState = "checking" | "allowed" | "denied" | "error";
const emptyAnswers = (): AssessmentAnswers => ({ single: "", multiple: [], boolean: "", short: "" });

export default function PracticeAssessmentPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [access, setAccess] = useState<AccessState>("checking");
  const [userId, setUserId] = useState<string | null>(null);
  const [studentLabel, setStudentLabel] = useState("Estudiante");
  const [answers, setAnswers] = useState<AssessmentAnswers>(emptyAnswers);
  const [attempts, setAttempts] = useState<AssessmentAttempt[]>([]);
  const [submittedAttempt, setSubmittedAttempt] = useState<AssessmentAttempt | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [storageReady, setStorageReady] = useState(false);
  const [storageError, setStorageError] = useState("");

  useEffect(() => {
    let active = true;
    async function verifyAccess() {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (!active) return;
        if (authError || !user) { router.replace("/conexion"); return; }
        const { data: assignments, error: assignmentError } = await supabase.from("user_role_assignments").select("role_id").eq("user_id", user.id);
        if (assignmentError) throw assignmentError;
        if (!active) return;
        const roleIds = [...new Set((assignments ?? []).map((item) => item.role_id))];
        if (!roleIds.length) { setAccess("denied"); return; }
        const { data: roles, error: rolesError } = await supabase.from("roles").select("role_key").in("id", roleIds);
        if (rolesError) throw rolesError;
        if (!active) return;
        const keys = (roles ?? []).map((role) => role.role_key);
        if (keys.includes("member") || keys.includes("national_admin")) {
          setUserId(user.id);
          setStudentLabel(String(user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email?.split("@")[0] ?? "Estudiante"));
          setAccess("allowed");
        } else setAccess("denied");
      } catch (error) {
        console.error("No fue posible validar el acceso a la práctica:", error);
        if (active) setAccess("error");
      }
    }
    void Promise.resolve().then(verifyAccess);
    return () => { active = false; };
  }, [router, supabase]);

  const storageKey = userId ? `${PRACTICE_ATTEMPTS_STORAGE_PREFIX}:${userId}:${PRACTICE_ASSESSMENT_ID}` : null;

  useEffect(() => {
    if (!storageKey) return;
    try {
      const localAttempts = parseAssessmentAttempts(window.localStorage.getItem(storageKey), PRACTICE_ASSESSMENT_ID);
      const tutorReviews = getStudentAssessmentReviews(userId ?? "");
      const merged = new Map(localAttempts.map((attempt) => [attempt.id, attempt]));
      tutorReviews.forEach((item) => merged.set(item.attempt.id, item.attempt));
      const restored = [...merged.values()].sort((a, b) => Date.parse(b.submittedAt) - Date.parse(a.submittedAt));
      // Restauración intencional del historial local y de revisiones demo al identificar la sesión.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAttempts(restored);
      setSubmittedAttempt(restored[0] ?? null);
      window.localStorage.setItem(storageKey, JSON.stringify(restored));
    } catch (error) {
      console.error("No fue posible recuperar los intentos locales:", error);
      setStorageError("No se pudo recuperar el historial de este navegador.");
    } finally {
      setStorageReady(true);
    }
    const refreshTutorReviews = () => {
      if (!userId) return;
      const current = parseAssessmentAttempts(window.localStorage.getItem(storageKey), PRACTICE_ASSESSMENT_ID);
      const reviews = getStudentAssessmentReviews(userId);
      const merged = new Map(current.map((attempt) => [attempt.id, attempt]));
      reviews.forEach((item) => merged.set(item.attempt.id, item.attempt));
      const next = [...merged.values()].sort((a, b) => Date.parse(b.submittedAt) - Date.parse(a.submittedAt));
      window.localStorage.setItem(storageKey, JSON.stringify(next));
      setAttempts(next);
      setSubmittedAttempt((selected) => selected ? next.find((attempt) => attempt.id === selected.id) ?? selected : null);
    };
    window.addEventListener("focus", refreshTutorReviews);
    window.addEventListener("storage", refreshTutorReviews);
    window.addEventListener("academia-decom:assessment-review-queue-updated", refreshTutorReviews);
    return () => {
      window.removeEventListener("focus", refreshTutorReviews);
      window.removeEventListener("storage", refreshTutorReviews);
      window.removeEventListener("academia-decom:assessment-review-queue-updated", refreshTutorReviews);
    };
  }, [storageKey, userId]);

  const answeredCount = practiceQuestions.filter((question) => {
    const answer = answers[question.id];
    return Array.isArray(answer) ? answer.length > 0 : typeof answer === "string" && answer.trim().length > 0;
  }).length;

  function toggleMultiple(option: string) {
    setAnswers((current) => {
      const selected = Array.isArray(current.multiple) ? current.multiple : [];
      return { ...current, multiple: selected.includes(option) ? selected.filter((item) => item !== option) : [...selected, option] };
    });
  }

  function finalizeAttempt() {
    if (!storageKey) return;
    const result = gradeAssessment(practiceQuestions, practiceAnswerKey, answers);
    const attempt = createAssessmentAttempt(PRACTICE_ASSESSMENT_ID, answers, result);
    try {
      const next = [attempt, ...attempts];
      window.localStorage.setItem(storageKey, JSON.stringify(next));
      const queueSaved = upsertAssessmentReviewQueueItem({
        id: PRACTICE_ASSESSMENT_ID + ":" + userId + ":" + attempt.id,
        studentId: userId ?? "",
        studentLabel,
        attempt,
        createdAt: attempt.submittedAt,
        updatedAt: attempt.submittedAt,
      });
      setAttempts(next);
      setSubmittedAttempt(attempt);
      setShowConfirm(false);
      setStorageError(queueSaved ? "" : "El intento quedó guardado en tu historial local, pero no se pudo compartir con la bandeja demo del tutor.");
    } catch (error) {
      console.error("No fue posible guardar el intento:", error);
      setStorageError("No se pudo guardar el intento. Comprueba el espacio disponible en el navegador e inténtalo de nuevo.");
    }
  }

  function startNewAttempt() {
    setAnswers(emptyAnswers());
    setSubmittedAttempt(null);
  }

  if (access === "checking" || (access === "allowed" && !storageReady)) return <main className="flex min-h-screen items-center justify-center bg-[#F4F7FA]"><div className="h-10 w-10 animate-spin rounded-full border-4 border-[#087DB5]/20 border-t-[#087DB5]" /></main>;
  if (access !== "allowed") return <main className="flex min-h-screen items-center justify-center bg-[#F4F7FA] px-6"><section className="max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center"><h1 className="text-xl font-bold text-[#102D4D]">{access === "error" ? "No pudimos validar tu acceso" : "Acceso restringido"}</h1><p className="mt-2 text-sm text-slate-500">{access === "error" ? "Intenta nuevamente." : "Esta práctica está habilitada para estudiantes con una asignación vigente."}</p><button type="button" onClick={() => router.push("/dashboard/estudiante")} className="mt-5 rounded-xl bg-[#087DB5] px-5 py-3 text-sm font-semibold text-white">Volver al panel</button></section></main>;

  return (
    <main className="min-h-screen bg-[#F4F7FA] text-[#102D4D]">
      <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-4 md:px-8"><div><p className="text-xs font-extrabold tracking-[0.14em] text-[#087DB5]">ACADEMIA DECOM</p><p className="mt-1 text-xs text-slate-400">Práctica de evaluación</p></div><button type="button" onClick={() => router.push("/dashboard/estudiante/evaluaciones")} className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-600">← Evaluaciones</button></div></header>
      <div className="mx-auto max-w-4xl space-y-6 px-5 py-7 pb-12 md:px-8 md:py-9">
        <section className="rounded-3xl bg-[#102D4D] p-6 text-white md:p-8"><span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider">Práctica · No oficial</span><h1 className="mt-4 text-2xl font-extrabold">Comprobación de fundamentos</h1><p className="mt-2 text-sm leading-6 text-white/75">Responde las cuatro preguntas. Al finalizar se guardará un intento local y podrás consultar su resultado posteriormente.</p><div className="mt-5 flex flex-wrap gap-4 text-xs text-white/70"><span>4 preguntas</span><span>10 minutos estimados</span><span>{answeredCount}/4 respondidas</span><span>{attempts.length} intentos guardados</span></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-[#19A7A0] transition-all" style={{ width: `${answeredCount / practiceQuestions.length * 100}%` }} /></div></section>

        {storageError && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-900">{storageError}</p>}

        {!submittedAttempt ? (
          <section className="space-y-4">
            {practiceQuestions.map((question, index) => (
              <article key={question.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-7">
                <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-[10px] font-bold uppercase tracking-wider text-[#087DB5]">Pregunta {index + 1} de {practiceQuestions.length}</span><span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-semibold text-slate-500">{question.type}</span></div>
                <h2 className="mt-4 text-base font-bold leading-6">{question.prompt}</h2>
                {question.type === "Selección única" && <div className="mt-4 space-y-2">{question.options.map((option) => <label key={option} className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-100 p-3 text-sm text-slate-600 hover:bg-slate-50"><input type="radio" name={question.id} checked={answers[question.id] === option} onChange={() => setAnswers((current) => ({ ...current, [question.id]: option }))} className="mt-0.5 h-4 w-4 accent-[#087DB5]" />{option}</label>)}</div>}
                {question.type === "Selección múltiple" && <div className="mt-4 space-y-2">{question.options.map((option) => <label key={option} className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-100 p-3 text-sm text-slate-600 hover:bg-slate-50"><input type="checkbox" checked={Array.isArray(answers[question.id]) && (answers[question.id] as string[]).includes(option)} onChange={() => toggleMultiple(option)} className="mt-0.5 h-4 w-4 accent-[#087DB5]" />{option}</label>)}</div>}
                {question.type === "Verdadero o falso" && <div className="mt-4 grid gap-2 sm:grid-cols-2">{question.options.map((option) => <button key={option} type="button" aria-pressed={answers[question.id] === option} onClick={() => setAnswers((current) => ({ ...current, [question.id]: option }))} className={`rounded-xl border px-4 py-3 text-sm font-semibold ${answers[question.id] === option ? "border-[#087DB5] bg-sky-50 text-[#087DB5]" : "border-slate-200 text-slate-500"}`}>{option}</button>)}</div>}
                {question.type === "Respuesta corta" && <textarea value={typeof answers[question.id] === "string" ? answers[question.id] as string : ""} onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: event.target.value }))} rows={4} maxLength={500} placeholder="Escribe tu respuesta..." className="mt-4 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm leading-6 outline-none focus:border-[#087DB5]" />}
              </article>
            ))}
            <div className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center"><p className="text-xs leading-5 text-slate-500">Las preguntas objetivas se corrigen automáticamente en esta demostración. La respuesta corta queda pendiente de revisión humana.</p><button type="button" disabled={answeredCount !== practiceQuestions.length} onClick={() => setShowConfirm(true)} className="shrink-0 rounded-xl bg-[#087DB5] px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">Revisar y finalizar</button></div>
          </section>
        ) : (
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
            <p className="text-xs font-bold uppercase tracking-wider text-[#19A7A0]">Resultado de demostración</p><h2 className="mt-2 text-2xl font-extrabold">Intento completado</h2>
            <p className="mt-2 text-sm text-slate-500">Puntuación objetiva: {submittedAttempt.result.objectiveEarned}/{submittedAttempt.result.objectivePossible}. Puntuación manual: {submittedAttempt.result.manualEarned ?? 0}/{submittedAttempt.result.manualPossible ?? 0}. Preguntas pendientes: {submittedAttempt.result.pendingManual}.</p>
            <p className="mt-1 text-[11px] text-slate-400">Enviado: {new Date(submittedAttempt.submittedAt).toLocaleString("es-CO")}</p>
            <div className="mt-6 space-y-3">{submittedAttempt.result.questions.map((result, index) => {
              const question = practiceQuestions.find((item) => item.id === result.questionId);
              const answer = submittedAttempt.answers[result.questionId];
              const answerText = Array.isArray(answer) ? answer.join(" · ") : answer || "Sin respuesta";
              const manualReview = submittedAttempt.manualReviews?.find((review) => review.questionId === result.questionId);
              const statusLabel = result.status === "correcta" ? "Correcta" : result.status === "incorrecta" ? "Incorrecta" : result.status === "revisada" ? "Revisada por tutor" : "Pendiente de revisión";
              const statusTone = result.status === "correcta" || result.status === "revisada" ? "bg-teal-50 text-teal-800" : result.status === "incorrecta" ? "bg-rose-50 text-rose-800" : "bg-amber-50 text-amber-800";
              return <article key={result.questionId} className="rounded-2xl border border-slate-100 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-bold">{index + 1}. {question?.type}</p><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${statusTone}`}>{statusLabel}</span></div><p className="mt-2 text-sm font-semibold">{question?.prompt}</p><p className="mt-2 text-xs leading-5 text-slate-500">Tu respuesta: {answerText}</p>{result.status === "revisada" && <div className="mt-3 rounded-xl bg-teal-50 p-3 text-xs leading-5 text-teal-900"><p className="font-bold">Puntaje: {result.earnedPoints}/{result.possiblePoints}</p><p className="mt-1">{manualReview?.feedback}</p></div>}</article>;
            })}</div>
            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-900">Este resultado se almacena únicamente en este navegador. La respuesta corta no recibe puntuación automática. Las claves de esta práctica son datos ficticios incluidos en código cliente y no son seguras para evaluaciones reales.</div>
            <div className="mt-6 flex flex-wrap gap-2"><button type="button" onClick={startNewAttempt} className="rounded-xl bg-[#087DB5] px-5 py-3 text-sm font-semibold text-white">Iniciar nuevo intento</button><button type="button" onClick={() => router.push("/dashboard/estudiante/evaluaciones")} className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600">Volver a evaluaciones</button></div>
          </section>
        )}

        <AssessmentHistoryPanel
          attempts={attempts}
          selectedAttemptId={submittedAttempt?.id ?? null}
          onSelect={(attempt) => {
            setAnswers(attempt.answers);
            setSubmittedAttempt(attempt);
          }}
        />
      </div>
      {showConfirm && !submittedAttempt && <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/40 p-4 sm:items-center"><section role="dialog" aria-modal="true" aria-labelledby="confirm-assessment-title" className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"><h2 id="confirm-assessment-title" className="text-lg font-bold">¿Finalizar esta práctica?</h2><p className="mt-2 text-sm leading-6 text-slate-500">Has respondido las cuatro preguntas. Se guardará un nuevo intento local y podrás consultar el resultado después.</p><div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setShowConfirm(false)} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600">Seguir revisando</button><button type="button" onClick={finalizeAttempt} className="rounded-xl bg-[#087DB5] px-4 py-3 text-sm font-semibold text-white">Finalizar práctica</button></div></section></div>}
    </main>
  );
}
