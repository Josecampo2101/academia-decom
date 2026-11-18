"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Json } from "@/lib/supabase/database.types";

type AttemptRow = {
  id: string;
  assessment_id: string;
  enrollment_id: string;
  district_id: string;
  user_id: string;
  attempt_number: number;
  submitted_at: string;
  objective_earned: number;
  total_possible: number;
  manual_pending: number;
  status: string;
};
type AssessmentRow = { id: string; title: string; course_id: string };
type CourseRow = { id: string; title: string };
type ResponseRow = {
  id: string;
  attempt_id: string;
  question_id: string;
  answer: Json;
  awarded_points: number | null;
  feedback: string | null;
};
type QuestionRow = {
  id: string;
  prompt: string;
  points: number;
  question_type: string;
  sort_order: number;
};
type ReviewItem = {
  attempt: AttemptRow;
  assessmentTitle: string;
  courseTitle: string;
  studentLabel: string;
  responses: Array<ResponseRow & { prompt: string; points: number }>;
};

export default function ManualAssessmentReviewInbox() {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [responseId, setResponseId] = useState("");
  const [score, setScore] = useState("0");
  const [feedback, setFeedback] = useState("");
  const [filter, setFilter] = useState<"Pendientes" | "Revisadas" | "Todas">("Pendientes");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { data: attemptRows, error: attemptError } = await supabase
        .from("academic_assessment_attempts")
        .select(
          "id,assessment_id,enrollment_id,district_id,user_id,attempt_number,submitted_at,objective_earned,total_possible,manual_pending,status",
        )
        .order("submitted_at", { ascending: false });
      if (attemptError) throw attemptError;
      const attempts = (attemptRows ?? []) as AttemptRow[];
      if (!attempts.length) {
        setItems([]);
        setLoading(false);
        return;
      }
      const assessmentIds = [...new Set(attempts.map((item) => item.assessment_id))];
      const userIds = [...new Set(attempts.map((item) => item.user_id))];
      const attemptIds = attempts.map((item) => item.id);
      const [assessmentResult, profileResult, responseResult] = await Promise.all([
        supabase.from("academic_assessments").select("id,title,course_id").in("id", assessmentIds),
        supabase.from("profiles").select("id,full_name").in("id", userIds),
        supabase
          .from("academic_assessment_responses")
          .select("id,attempt_id,question_id,answer,awarded_points,feedback")
          .in("attempt_id", attemptIds),
      ]);
      if (assessmentResult.error) throw assessmentResult.error;
      if (profileResult.error) throw profileResult.error;
      if (responseResult.error) throw responseResult.error;
      const assessments = (assessmentResult.data ?? []) as AssessmentRow[];
      const courseIds = [...new Set(assessments.map((item) => item.course_id))];
      const questionIds = [...new Set((responseResult.data ?? []).map((item) => item.question_id))];
      const [courseResult, questionResult] = await Promise.all([
        courseIds.length
          ? supabase.from("courses").select("id,title").in("id", courseIds)
          : Promise.resolve({ data: [], error: null }),
        questionIds.length
          ? supabase
              .from("academic_assessment_questions")
              .select("id,prompt,points,question_type,sort_order")
              .in("id", questionIds)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (courseResult.error) throw courseResult.error;
      if (questionResult.error) throw questionResult.error;
      const assessmentById = new Map(assessments.map((item) => [item.id, item]));
      const courseById = new Map(
        ((courseResult.data ?? []) as CourseRow[]).map((item) => [item.id, item.title]),
      );
      const profileById = new Map(
        (profileResult.data ?? []).map((item) => [item.id, item.full_name || "Estudiante"]),
      );
      const questionById = new Map(
        ((questionResult.data ?? []) as QuestionRow[])
          .filter((item) => item.question_type === "short_answer")
          .map((item) => [item.id, item]),
      );
      const responsesByAttempt = new Map<string, ReviewItem["responses"]>();
      for (const raw of responseResult.data ?? []) {
        const response = raw as ResponseRow;
        const question = questionById.get(response.question_id);
        if (!question) continue;
        const list = responsesByAttempt.get(response.attempt_id) ?? [];
        list.push({ ...response, prompt: question.prompt, points: question.points });
        responsesByAttempt.set(response.attempt_id, list);
      }
      const next = attempts
        .map((attempt) => {
          const assessment = assessmentById.get(attempt.assessment_id);
          return {
            attempt,
            assessmentTitle: assessment?.title ?? "Evaluación",
            courseTitle: assessment ? (courseById.get(assessment.course_id) ?? "Curso") : "Curso",
            studentLabel: profileById.get(attempt.user_id) ?? "Estudiante",
            responses: (responsesByAttempt.get(attempt.id) ?? []).sort(
              (a, b) =>
                (questionById.get(a.question_id)?.sort_order ?? 0) -
                (questionById.get(b.question_id)?.sort_order ?? 0),
            ),
          };
        })
        .filter((item) => item.responses.length > 0);
      setItems(next);
      setSelectedId((current) =>
        next.some((item) => item.attempt.id === current) ? current : (next[0]?.attempt.id ?? ""),
      );
      setNotice("");
    } catch (error) {
      console.error("No fue posible cargar la bandeja de evaluación:", error);
      setNotice(
        error instanceof Error ? error.message : "No fue posible consultar las respuestas.",
      );
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void Promise.resolve().then(refresh);
  }, [refresh]);

  const visibleItems = items.filter((item) => {
    const hasPending = item.responses.some((response) => response.awarded_points === null);
    return (
      filter === "Todas" ||
      (filter === "Pendientes" ? hasPending : !hasPending && item.responses.length > 0)
    );
  });
  const selected = useMemo(
    () => items.find((item) => item.attempt.id === selectedId) ?? null,
    [items, selectedId],
  );
  const pendingResponses =
    selected?.responses.filter((response) => response.awarded_points === null) ?? [];
  const selectedResponse =
    pendingResponses.find((response) => response.id === responseId) ?? pendingResponses[0] ?? null;
  const pendingCount = items.reduce(
    (sum, item) =>
      sum + item.responses.filter((response) => response.awarded_points === null).length,
    0,
  );
  const reviewedCount = items.reduce(
    (sum, item) =>
      sum + item.responses.filter((response) => response.awarded_points !== null).length,
    0,
  );

  function chooseAttempt(item: ReviewItem) {
    setSelectedId(item.attempt.id);
    setResponseId(item.responses.find((response) => response.awarded_points === null)?.id ?? "");
    setScore("0");
    setFeedback("");
    setNotice("");
  }

  async function saveReview() {
    if (!selectedResponse) return;
    setSaving(true);
    const { error } = await supabase.rpc("review_academic_assessment_response", {
      p_response_id: selectedResponse.id,
      p_awarded_points: Number(score),
      p_feedback: feedback.trim(),
    });
    setSaving(false);
    if (error) {
      setNotice(error.message);
      return;
    }
    setNotice("Calificación y retroalimentación guardadas en Supabase.");
    setScore("0");
    setFeedback("");
    await refresh();
  }

  const answerText = (answer: Json) =>
    typeof answer === "string" ? answer : JSON.stringify(answer, null, 2);

  return (
    <section className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <article className="rounded-2xl border border-line bg-surface p-4">
          <p className="text-xs text-muted-fg">Intentos cargados</p>
          <p className="mt-2 text-2xl font-extrabold">{items.length}</p>
        </article>
        <article className="rounded-2xl border border-line bg-surface p-4">
          <p className="text-xs text-muted-fg">Respuestas pendientes</p>
          <p className="mt-2 text-2xl font-extrabold">{pendingCount}</p>
        </article>
        <article className="rounded-2xl border border-line bg-surface p-4">
          <p className="text-xs text-muted-fg">Respuestas revisadas</p>
          <p className="mt-2 text-2xl font-extrabold">{reviewedCount}</p>
        </article>
      </div>
      <div className="rounded-3xl border border-line bg-surface p-5 md:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold">Respuestas cortas por revisar</h2>
            <p className="mt-1 text-xs text-muted-fg">
              Bandeja sincronizada con intentos reales de estudiantes.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            className="rounded-xl border border-line px-3 py-2 text-xs font-semibold text-muted-fg"
          >
            {loading ? "Actualizando..." : "Actualizar bandeja"}
          </button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {(["Pendientes", "Revisadas", "Todas"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
              className={`rounded-full px-3 py-2 text-xs font-semibold ${filter === value ? "bg-decom-blue text-white" : "bg-surface-muted text-muted-fg"}`}
            >
              {value}
            </button>
          ))}
        </div>
        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(220px,0.8fr)_minmax(0,1.4fr)]">
          <div className="space-y-2">
            {visibleItems.map((item) => (
              <button
                key={item.attempt.id}
                type="button"
                onClick={() => chooseAttempt(item)}
                aria-pressed={selectedId === item.attempt.id}
                className={`w-full rounded-2xl border p-4 text-left ${selectedId === item.attempt.id ? "border-decom-blue bg-sky-50" : "border-line hover:border-line"}`}
              >
                <span className="block text-xs font-bold">{item.studentLabel}</span>
                <span className="mt-1 block text-[11px] text-muted-fg">
                  {item.assessmentTitle}
                </span>
                <span className="mt-1 block text-[10px] text-muted-fg">
                  {item.courseTitle} · Intento {item.attempt.attempt_number}
                </span>
                <span className="mt-2 block text-[10px] text-muted-fg">
                  {item.attempt.manual_pending} pendiente(s) ·{" "}
                  {item.responses.filter((response) => response.awarded_points !== null).length}{" "}
                  revisada(s)
                </span>
              </button>
            ))}
            {loading && (
              <p className="p-5 text-center text-xs text-muted-fg">Cargando intentos...</p>
            )}
            {!loading && visibleItems.length === 0 && (
              <p className="rounded-xl border border-dashed border-line p-5 text-center text-xs text-muted-fg">
                No hay intentos para este filtro.
              </p>
            )}
          </div>
          {selected && (
            <div className="rounded-2xl bg-surface-muted p-4 md:p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold">{selected.studentLabel}</h3>
                  <p className="mt-1 text-[10px] text-muted-fg">
                    {selected.assessmentTitle} · {selected.courseTitle}
                  </p>
                  <p className="mt-1 text-[10px] text-muted-fg">
                    Enviado {new Date(selected.attempt.submitted_at).toLocaleString("es-CO")}
                  </p>
                </div>
                <span className="rounded-full bg-surface px-3 py-1 text-[10px] font-bold text-muted-fg">
                  {selected.attempt.status === "review_pending" ? "Pendiente" : "Calificado"}
                </span>
              </div>
              <div className="mt-4 rounded-xl border border-line bg-surface p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-fg">
                  Puntaje objetivo
                </p>
                <p className="mt-1 text-lg font-extrabold">
                  {selected.attempt.objective_earned}/{selected.attempt.total_possible} puntos
                  posibles
                </p>
                <p className="mt-1 text-[10px] text-muted-fg">
                  Respuestas abiertas pendientes: {selected.attempt.manual_pending}
                </p>
              </div>
              {selectedResponse ? (
                <div className="mt-4 space-y-3">
                  <div className="rounded-xl border border-line bg-surface p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-fg">
                      Pregunta
                    </p>
                    <p className="mt-2 text-sm font-semibold text-foreground">
                      {selectedResponse.prompt}
                    </p>
                    <p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-muted-fg">
                      Respuesta del estudiante
                    </p>
                    <pre className="mt-2 whitespace-pre-wrap break-words font-sans text-sm leading-6 text-foreground">
                      {answerText(selectedResponse.answer)}
                    </pre>
                    <p className="mt-3 text-[10px] text-muted-fg">
                      Puntaje máximo: {selectedResponse.points}
                    </p>
                  </div>
                  <label className="block">
                    <span className="text-xs font-bold">Puntaje obtenido</span>
                    <input
                      type="number"
                      min={0}
                      max={selectedResponse.points}
                      step="0.01"
                      value={score}
                      onChange={(event) => setScore(event.target.value)}
                      className="mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-bold">Retroalimentación obligatoria</span>
                    <textarea
                      value={feedback}
                      onChange={(event) => setFeedback(event.target.value)}
                      maxLength={2000}
                      rows={4}
                      placeholder="Explica los aciertos y aspectos por mejorar..."
                      className="mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-xs leading-5"
                    />
                    <span className="mt-1 block text-right text-[10px] text-muted-fg">
                      {feedback.length}/2000
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={() => void saveReview()}
                    disabled={
                      saving ||
                      !feedback.trim() ||
                      Number(score) < 0 ||
                      Number(score) > selectedResponse.points
                    }
                    className="rounded-xl bg-decom-blue px-4 py-3 text-xs font-bold text-white disabled:opacity-50"
                  >
                    {saving ? "Guardando..." : "Guardar revisión"}
                  </button>
                </div>
              ) : (
                <div className="mt-4 space-y-2">
                  <p className="text-xs font-semibold">
                    No hay respuestas pendientes en este intento.
                  </p>
                  {selected.responses
                    .filter((response) => response.awarded_points !== null)
                    .map((response) => (
                      <article
                        key={response.id}
                        className="rounded-xl border border-line bg-surface p-3"
                      >
                        <p className="text-xs font-bold">{response.prompt}</p>
                        <p className="mt-1 text-xs text-muted-fg">
                          {response.awarded_points}/{response.points} puntos
                        </p>
                        <p className="mt-2 text-xs leading-5 text-muted-fg">{response.feedback}</p>
                      </article>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>
        {notice && (
          <p role="status" className="mt-4 rounded-xl bg-sky-50 p-3 text-xs leading-5 text-sky-800">
            {notice}
          </p>
        )}
      </div>
      <p className="rounded-xl border border-teal-100 bg-teal-50 p-4 text-[11px] leading-5 text-teal-900">
        Las calificaciones se guardan en PostgreSQL. La nota definitiva y la aprobación del examen
        final se actualizan cuando se han revisado todas las respuestas abiertas.
      </p>
    </section>
  );
}
