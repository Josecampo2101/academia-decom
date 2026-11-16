"use client";

import { Spinner } from "@/components/ui/Spinner";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Json } from "@/lib/supabase/database.types";

type Question = {
  id: string;
  prompt: string;
  question_type: string;
  options: Json;
  points: number;
  sort_order: number;
};
type Assessment = {
  id: string;
  title: string;
  instructions: string | null;
  assessment_type: string;
  passing_score: number;
  max_attempts: number | null;
  time_limit_minutes: number | null;
};
type Attempt = {
  id: string;
  attempt_number: number;
  status: string;
  score_percent: number | null;
  passed: boolean | null;
  manual_pending: number;
  submitted_at: string;
};

export default function StudentAssessmentAttemptClient({ assessmentId }: { assessmentId: string }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [result, setResult] = useState<Attempt | null>(null);
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();
        if (authError || !user) {
          router.replace("/conexion");
          return;
        }
        const { data: exam, error: examError } = await supabase
          .from("academic_assessments")
          .select(
            "id,title,instructions,assessment_type,passing_score,max_attempts,time_limit_minutes",
          )
          .eq("id", assessmentId)
          .eq("status", "published")
          .maybeSingle();
        if (examError) throw examError;
        if (!exam)
          throw new Error(
            "Esta evaluación no existe, no está publicada o no tienes matrícula activa.",
          );
        const [questionResult, attemptResult] = await Promise.all([
          supabase
            .from("academic_assessment_questions")
            .select("id,prompt,question_type,options,points,sort_order")
            .eq("assessment_id", assessmentId)
            .order("sort_order"),
          supabase
            .from("academic_assessment_attempts")
            .select("id,attempt_number,status,score_percent,passed,manual_pending,submitted_at")
            .eq("assessment_id", assessmentId)
            .eq("user_id", user.id)
            .order("submitted_at", { ascending: false }),
        ]);
        if (questionResult.error) throw questionResult.error;
        if (attemptResult.error) throw attemptResult.error;
        if (!active) return;
        setAssessment(exam as Assessment);
        setQuestions((questionResult.data ?? []) as Question[]);
        setAttempts((attemptResult.data ?? []) as Attempt[]);
      } catch (error) {
        if (active)
          setNotice(error instanceof Error ? error.message : "No fue posible abrir la evaluación.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void Promise.resolve().then(load);
    return () => {
      active = false;
    };
  }, [assessmentId, router, supabase]);

  function setSingle(questionId: string, value: string) {
    setAnswers((current) => ({ ...current, [questionId]: value }));
  }

  function toggleMultiple(questionId: string, value: string) {
    setAnswers((current) => {
      const currentValues = Array.isArray(current[questionId])
        ? (current[questionId] as string[])
        : [];
      return {
        ...current,
        [questionId]: currentValues.includes(value)
          ? currentValues.filter((item) => item !== value)
          : [...currentValues, value],
      };
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!assessment || !questions.length) return;
    const missing = questions.filter((question) => {
      const answer = answers[question.id];
      return Array.isArray(answer)
        ? answer.length === 0
        : typeof answer !== "string" || !answer.trim();
    });
    if (missing.length) {
      setNotice(`Responde todas las preguntas. Faltan ${missing.length}.`);
      return;
    }
    setSaving(true);
    setNotice("");
    const { data, error } = await supabase.rpc("submit_academic_assessment", {
      p_assessment_id: assessment.id,
      p_answers: Object.fromEntries(
        Object.entries(answers).map(([questionId, answer]) => [
          questionId,
          Array.isArray(answer)
            ? [...answer].sort((left, right) => left.localeCompare(right, "es"))
            : answer,
        ]),
      ) as Json,
    });
    setSaving(false);
    if (error) {
      setNotice(error.message);
      return;
    }
    const payload = data as {
      attempt_id: string;
      attempt_number: number;
      status: string;
      score_percent: number | null;
      passed: boolean | null;
      manual_pending: number;
    };
    const next: Attempt = {
      id: payload.attempt_id,
      attempt_number: payload.attempt_number,
      status: payload.status,
      score_percent: payload.score_percent,
      passed: payload.passed,
      manual_pending: payload.manual_pending,
      submitted_at: new Date().toISOString(),
    };
    setResult(next);
    setAttempts((current) => [next, ...current]);
    setAnswers({});
    setNotice(
      payload.status === "review_pending"
        ? "Tu evaluación fue enviada. Las respuestas cortas están pendientes de revisión del tutor."
        : payload.passed
          ? "¡Evaluación aprobada! El sistema ha actualizado tu progreso y, si era el examen final, ha habilitado el siguiente curso publicado."
          : "Intento calificado. Revisa tu resultado y consulta las indicaciones del tutor antes de volver a intentarlo.",
    );
  }

  const answered = questions.filter((question) => {
    const answer = answers[question.id];
    return Array.isArray(answer)
      ? answer.length > 0
      : typeof answer === "string" && !!answer.trim();
  }).length;

  if (loading)
    return (
      <main id="contenido" className="flex min-h-screen items-center justify-center bg-background">
        <Spinner />
      </main>
    );

  return (
    <main id="contenido" className="min-h-screen bg-background text-foreground">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-4">
          <div>
            <p className="text-xs font-extrabold tracking-[0.14em] text-decom-blue-text">
              ACADEMIA DECOM
            </p>
            <p className="mt-1 text-xs text-muted-fg">Evaluación académica</p>
          </div>
          <button
            onClick={() => router.push("/dashboard/estudiante/evaluaciones")}
            className="rounded-xl border border-line px-4 py-2.5 text-xs font-semibold"
          >
            Volver a mis evaluaciones
          </button>
        </div>
      </header>
      <div className="mx-auto max-w-4xl space-y-5 px-5 py-7 md:px-8">
        {assessment ? (
          <>
            <section className="rounded-3xl bg-decom-navy p-6 text-white md:p-8">
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider">
                {assessment.assessment_type === "final"
                  ? "Examen final"
                  : assessment.assessment_type === "practice"
                    ? "Práctica"
                    : "Evaluación de lección"}
              </span>
              <h1 className="mt-4 text-2xl font-extrabold">{assessment.title}</h1>
              <p className="mt-2 text-sm leading-6 text-white/75">
                {assessment.instructions ||
                  "Responde cada pregunta y envía tus respuestas para recibir la calificación."}
              </p>
              <div className="mt-4 flex flex-wrap gap-4 text-xs text-white/70">
                <span>{questions.length} preguntas</span>
                <span>Aprobación: {assessment.passing_score}%</span>
                {assessment.time_limit_minutes && <span>{assessment.time_limit_minutes} min</span>}
                {assessment.max_attempts && <span>Máx. {assessment.max_attempts} intentos</span>}
              </div>
            </section>
            {result ? (
              <section className="rounded-3xl border border-line bg-surface p-6">
                <h2 className="text-lg font-bold">
                  {result.status === "review_pending"
                    ? "En revisión manual"
                    : result.passed
                      ? "Evaluación aprobada"
                      : "Intento calificado"}
                </h2>
                <p className="mt-2 text-sm text-muted-fg">
                  {result.score_percent === null
                    ? `${result.manual_pending} respuesta(s) esperan revisión del tutor.`
                    : `Resultado: ${result.score_percent}% · intento ${result.attempt_number}`}
                </p>
                {assessment.assessment_type === "final" && result.passed && (
                  <p className="mt-4 rounded-xl bg-teal-50 p-4 text-sm text-teal-800">
                    El curso quedó completado. Si hay un siguiente curso publicado en la ruta, el
                    sistema lo habilita automáticamente.
                  </p>
                )}
                <button
                  onClick={() => setResult(null)}
                  className="mt-5 rounded-xl bg-decom-blue px-4 py-3 text-xs font-bold text-white"
                >
                  Volver a mis evaluaciones
                </button>
              </section>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                <div className="flex items-center justify-between rounded-xl border border-line bg-surface px-4 py-3 text-xs">
                  <span className="font-semibold">Progreso de respuestas</span>
                  <span className="tabular-nums text-muted-fg">
                    {answered}/{questions.length}
                  </span>
                </div>
                {questions.map((question, index) => {
                  const options = Array.isArray(question.options)
                    ? question.options.filter((item): item is string => typeof item === "string")
                    : [];
                  const isMulti = question.question_type === "multiple_choice";
                  const isShort = question.question_type === "short_answer";
                  return (
                    <article
                      key={question.id}
                      className="rounded-3xl border border-line bg-surface p-5 md:p-7"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-decom-blue-text">
                          Pregunta {index + 1}
                        </span>
                        <span className="text-[10px] text-muted-fg">
                          {question.points} punto(s)
                        </span>
                      </div>
                      <h2 className="mt-3 text-sm font-bold leading-6">{question.prompt}</h2>
                      {isShort ? (
                        <textarea
                          value={
                            typeof answers[question.id] === "string"
                              ? (answers[question.id] as string)
                              : ""
                          }
                          onChange={(event) => setSingle(question.id, event.target.value)}
                          rows={4}
                          maxLength={4000}
                          placeholder="Escribe tu respuesta..."
                          className="mt-4 w-full rounded-xl border border-line px-3 py-3 text-sm"
                        />
                      ) : (
                        <div className="mt-4 space-y-2">
                          {options.map((option) => (
                            <label
                              key={option}
                              className="flex cursor-pointer items-start gap-3 rounded-xl border border-line-soft p-3 text-sm text-muted-fg hover:bg-surface-muted"
                            >
                              <input
                                type={isMulti ? "checkbox" : "radio"}
                                name={question.id}
                                checked={
                                  isMulti
                                    ? Array.isArray(answers[question.id]) &&
                                      (answers[question.id] as string[]).includes(option)
                                    : answers[question.id] === option
                                }
                                onChange={() =>
                                  isMulti
                                    ? toggleMultiple(question.id, option)
                                    : setSingle(question.id, option)
                                }
                                className="mt-0.5 h-4 w-4 accent-decom-blue"
                              />
                              {option}
                            </label>
                          ))}
                        </div>
                      )}
                    </article>
                  );
                })}
                <button
                  disabled={saving || questions.length === 0}
                  className="w-full rounded-xl bg-decom-blue px-5 py-4 text-sm font-bold text-white disabled:opacity-50"
                >
                  {saving ? "Enviando..." : "Enviar evaluación"}
                </button>
              </form>
            )}
            {attempts.length > 0 && (
              <section className="rounded-3xl border border-line bg-surface p-5">
                <h2 className="text-sm font-bold">Historial de intentos</h2>
                <div className="mt-3 space-y-2">
                  {attempts.map((attempt) => (
                    <div
                      key={attempt.id}
                      className="flex flex-wrap justify-between gap-2 rounded-xl bg-surface-muted p-3 text-xs"
                    >
                      <span>
                        Intento {attempt.attempt_number} ·{" "}
                        {attempt.status === "review_pending"
                          ? "En revisión"
                          : attempt.passed
                            ? "Aprobado"
                            : "Calificado"}
                      </span>
                      <span className="font-semibold">
                        {attempt.score_percent === null ? "Pendiente" : `${attempt.score_percent}%`}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        ) : (
          <section className="rounded-3xl border border-line bg-surface p-8 text-center">
            <h1 className="text-lg font-bold">Evaluación no disponible</h1>
            <p className="mt-2 text-sm text-muted-fg">
              {notice || "No se pudo cargar el instrumento solicitado."}
            </p>
            <button
              onClick={() => router.push("/dashboard/estudiante/evaluaciones")}
              className="mt-5 rounded-xl bg-decom-blue px-4 py-3 text-xs font-bold text-white"
            >
              Volver
            </button>
          </section>
        )}
        {notice && assessment && (
          <p
            role="status"
            className="rounded-xl border border-sky-100 bg-sky-50 p-4 text-xs leading-5 text-sky-800"
          >
            {notice}
          </p>
        )}
      </div>
    </main>
  );
}
