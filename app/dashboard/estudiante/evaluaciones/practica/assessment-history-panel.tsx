"use client";

import { useMemo, useState } from "react";
import type { AssessmentAttempt } from "@/lib/academic/assessment-attempts";

type HistoryFilter = "all" | "review" | "errors" | "clean";

type Props = {
  attempts: AssessmentAttempt[];
  selectedAttemptId: string | null;
  onSelect: (attempt: AssessmentAttempt) => void;
};

const filterLabels: { value: HistoryFilter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "review", label: "Con revisión pendiente" },
  { value: "errors", label: "Con respuestas incorrectas" },
  { value: "clean", label: "Sin respuestas incorrectas" },
];

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Fecha no disponible" : date.toLocaleString("es-CO");
}

export default function AssessmentHistoryPanel({ attempts, selectedAttemptId, onSelect }: Props) {
  const [filter, setFilter] = useState<HistoryFilter>("all");

  const summary = useMemo(() => {
    const objectiveEarned = attempts.reduce((total, attempt) => total + attempt.result.objectiveEarned, 0);
    const objectivePossible = attempts.reduce((total, attempt) => total + attempt.result.objectivePossible, 0);
    const pendingManual = attempts.reduce((total, attempt) => total + attempt.result.pendingManual, 0);
    return {
      total: attempts.length,
      objectivePercentage: objectivePossible > 0 ? Math.round((objectiveEarned / objectivePossible) * 100) : null,
      pendingManual,
    };
  }, [attempts]);

  const filteredAttempts = useMemo(() => attempts.filter((attempt) => {
    if (filter === "review") return attempt.result.pendingManual > 0;
    const hasErrors = attempt.result.questions.some((question) => question.status === "incorrecta");
    if (filter === "errors") return hasErrors;
    if (filter === "clean") return !hasErrors;
    return true;
  }), [attempts, filter]);

  if (attempts.length === 0) return null;

  return (
    <section className="rounded-3xl border border-line bg-surface p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold">Historial de intentos</h2>
          <p className="mt-1 text-xs text-muted-fg">Consulta tus resultados guardados en este navegador.</p>
        </div>
        <span className="rounded-full bg-sky-50 px-3 py-1 text-[10px] font-bold text-sky-800">{summary.total} {summary.total === 1 ? "intento" : "intentos"}</span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <article className="rounded-2xl bg-surface-muted p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-fg">Intentos registrados</p>
          <p className="mt-2 text-2xl font-extrabold text-foreground">{summary.total}</p>
        </article>
        <article className="rounded-2xl bg-surface-muted p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-fg">Rendimiento objetivo acumulado</p>
          <p className="mt-2 text-2xl font-extrabold text-foreground">{summary.objectivePercentage === null ? "—" : `${summary.objectivePercentage}%`}</p>
        </article>
        <article className="rounded-2xl bg-surface-muted p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-fg">Revisiones manuales pendientes</p>
          <p className="mt-2 text-2xl font-extrabold text-foreground">{summary.pendingManual}</p>
        </article>
      </div>

      <div className="mt-5">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-fg">Filtrar historial</p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar intentos">
          {filterLabels.map((item) => (
            <button
              key={item.value}
              type="button"
              aria-pressed={filter === item.value}
              onClick={() => setFilter(item.value)}
              className={`rounded-full border px-3 py-2 text-[11px] font-semibold transition ${filter === item.value ? "border-decom-blue bg-sky-50 text-decom-blue-text" : "border-line text-muted-fg hover:bg-surface-muted"}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <ol className="mt-4 space-y-2">
        {filteredAttempts.map((attempt) => {
          const hasErrors = attempt.result.questions.some((question) => question.status === "incorrecta");
          const selected = selectedAttemptId === attempt.id;
          return (
            <li key={attempt.id}>
              <button
                type="button"
                onClick={() => onSelect(attempt)}
                aria-pressed={selected}
                className={`flex w-full flex-wrap items-center justify-between gap-3 rounded-xl border p-3 text-left transition ${selected ? "border-decom-blue bg-sky-50" : "border-line-soft bg-surface-muted hover:border-line"}`}
              >
                <span>
                  <span className="block text-xs font-semibold text-foreground">Intento {attempts.length - attempts.findIndex((item) => item.id === attempt.id)}</span>
                  <span className="mt-1 block text-[10px] text-muted-fg">{formatDate(attempt.submittedAt)}</span>
                  <span className="mt-1 block text-[10px] text-muted-fg">{attempt.result.objectiveEarned}/{attempt.result.objectivePossible} puntos objetivos · {attempt.result.pendingManual} pendientes de revisión</span>
                </span>
                <span className="flex items-center gap-2">
                  {hasErrors && <span className="rounded-full bg-rose-50 px-2 py-1 text-[10px] font-bold text-rose-700">Con errores</span>}
                  {!hasErrors && <span className="rounded-full bg-teal-50 px-2 py-1 text-[10px] font-bold text-teal-700">Sin errores</span>}
                  <span className="text-xs font-semibold text-decom-blue-text">{selected ? "Consultando" : "Ver resultado"}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      {filteredAttempts.length === 0 && <p className="mt-4 rounded-xl bg-surface-muted p-4 text-xs text-muted-fg">No hay intentos que coincidan con este filtro.</p>}
      <p className="mt-4 text-[10px] leading-5 text-muted-fg">El rendimiento acumulado considera únicamente los puntos de preguntas objetivas. No incluye respuestas cortas pendientes de revisión.</p>
    </section>
  );
}
