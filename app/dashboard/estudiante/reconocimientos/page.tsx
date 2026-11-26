"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Flag, Trophy } from "lucide-react";
import { BadgeEmblem } from "@/components/recognitions/BadgeEmblem";
import { badgeIcon } from "@/components/recognitions/icons";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { StatusScreen } from "@/components/ui/StatusScreen";
import {
  CATEGORIES,
  DEMO_PROGRESS,
  EMPTY_PROGRESS,
  TIERS,
  evaluateBadges,
  metricLabel,
  summarizeRecognitions,
} from "@/lib/recognitions/engine.mjs";
import type { BadgeCategory, EvaluatedBadge, StudentProgress } from "@/lib/recognitions/engine.mjs";
import { loadStudentProgress } from "@/lib/recognitions/progress";
import { createClient } from "@/lib/supabase/client";

type AccessState = "checking" | "allowed" | "denied" | "error";
type ProgressState =
  { status: "loading" } | { status: "ready"; progress: StudentProgress } | { status: "error" };
type CategoryFilter = "all" | BadgeCategory;

function progressText(badge: EvaluatedBadge) {
  return `${badge.current} de ${badge.target} ${metricLabel(badge.metric, badge.target)}`;
}

export default function StudentAchievementsPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [access, setAccess] = useState<AccessState>("checking");
  const [progressState, setProgressState] = useState<ProgressState>({ status: "loading" });
  const [demo, setDemo] = useState(false);
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function verifyAccessAndLoad() {
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();
        if (!active) return;
        if (authError || !user) {
          router.replace("/conexion");
          return;
        }

        const { data: assignments, error: assignmentError } = await supabase
          .from("user_role_assignments")
          .select("role_id")
          .eq("user_id", user.id);
        if (assignmentError) throw assignmentError;
        if (!active) return;

        const roleIds = [...new Set((assignments ?? []).map((item) => item.role_id))];
        const { data: roles, error: rolesError } = await supabase
          .from("roles")
          .select("role_key")
          .in("id", roleIds);
        if (rolesError) throw rolesError;
        if (!active) return;

        const keys = (roles ?? []).map((role) => role.role_key);
        if (!(keys.includes("member") || keys.includes("national_admin"))) {
          setAccess("denied");
          return;
        }
        setAccess("allowed");

        // El progreso se lee aparte: si falla, el acceso sigue siendo válido y se avisa en pantalla.
        try {
          const progress = await loadStudentProgress(supabase, user.id);
          if (active) setProgressState({ status: "ready", progress });
        } catch (error) {
          console.error("No fue posible cargar el progreso para las insignias:", error);
          if (active) setProgressState({ status: "error" });
        }
      } catch (error) {
        console.error("No fue posible validar el acceso a reconocimientos:", error);
        if (active) setAccess("error");
      }
    }

    void Promise.resolve().then(verifyAccessAndLoad);
    return () => {
      active = false;
    };
  }, [router, supabase]);

  const realProgress = progressState.status === "ready" ? progressState.progress : EMPTY_PROGRESS;
  const progress = demo ? DEMO_PROGRESS : realProgress;
  const badges = useMemo(() => evaluateBadges(progress), [progress]);
  const summary = useMemo(() => summarizeRecognitions(badges), [badges]);
  const visibleBadges = badges.filter((badge) => category === "all" || badge.category === category);
  const selected = badges.find((badge) => badge.id === selectedId) ?? null;

  if (access === "checking")
    return (
      <main id="contenido" className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-fg">Verificando tu acceso...</p>
      </main>
    );
  if (access !== "allowed")
    return (
      <StatusScreen
        title={access === "error" ? "No pudimos validar tu acceso" : "Acceso restringido"}
        message="Esta sección está habilitada para estudiantes con una asignación vigente."
        actionLabel="Volver al panel"
        onAction={() => router.push("/dashboard/estudiante")}
      />
    );

  const { level, nextBadge } = summary;
  const filters: Array<{ id: CategoryFilter; label: string }> = [
    { id: "all", label: "Todas" },
    ...(Object.entries(CATEGORIES) as Array<[BadgeCategory, string]>).map(([id, label]) => ({
      id,
      label,
    })),
  ];

  return (
    <main id="contenido" className="min-h-screen bg-background text-foreground">
      <header>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 pt-6 pb-0 md:px-8">
          <div>
            <p className="mt-1 text-xs text-muted-fg">Reconocimientos y logros</p>
          </div>
          <button
            type="button"
            onClick={() => router.push("/dashboard/estudiante")}
            className="rounded-xl border border-line px-4 py-2.5 text-xs font-semibold text-muted-fg"
          >
            ← Panel del estudiante
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-7 px-5 py-7 pb-12 md:px-8 md:py-9">
        <section className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold tracking-[0.16em] text-decom-teal-text uppercase">
              Tu recorrido
            </p>
            <h1 className="mt-2 text-2xl font-extrabold md:text-3xl">Reconocimientos</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-fg">
              Cada avance refleja tu compromiso con una comunicación responsable y con propósito.
            </p>
          </div>
          <button
            type="button"
            aria-pressed={demo}
            onClick={() => setDemo((value) => !value)}
            className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
              demo
                ? "border-decom-blue bg-decom-blue text-white"
                : "border-line bg-surface text-muted-fg hover:bg-surface-muted"
            }`}
          >
            {demo ? "Ver mi progreso real" : "Ver con datos de ejemplo"}
          </button>
        </section>

        {demo ? (
          <p
            role="status"
            className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900"
          >
            Estás viendo datos de ejemplo para conocer cómo funcionan las insignias. No corresponden
            a tu actividad real.
          </p>
        ) : null}
        {!demo && progressState.status === "error" ? (
          <p
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs leading-5 text-red-800"
          >
            No pudimos cargar tu progreso en este momento. Recarga la página; si el problema
            continúa, avisa a tu tutor.
          </p>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <article className="rounded-3xl border border-line bg-surface p-6 shadow-sm md:p-7">
            <div className="flex items-center gap-4">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-decom-blue-soft text-decom-blue-text">
                <Trophy className="h-6 w-6" strokeWidth={1.75} aria-hidden="true" />
              </span>
              <div>
                <p className="text-xs font-semibold text-muted-fg">Nivel {level.index + 1}</p>
                <h2 className="text-xl font-bold">{level.name}</h2>
              </div>
              <p className="ml-auto text-right">
                <span className="block text-3xl font-extrabold">{summary.points}</span>
                <span className="text-xs font-semibold text-muted-fg">puntos</span>
              </p>
            </div>
            <div className="mt-5">
              <ProgressBar percent={level.percent} label="Avance hacia el siguiente nivel" />
              <p className="mt-2 text-xs text-muted-fg">
                {level.nextName
                  ? `Te faltan ${level.pointsToNext} puntos para ser ${level.nextName}.`
                  : "Alcanzaste el nivel más alto."}
              </p>
            </div>
            <dl className="mt-6 grid grid-cols-3 gap-3 border-t border-line-soft pt-5 text-center">
              <div>
                <dt className="text-xs text-muted-fg">Insignias</dt>
                <dd className="mt-1 text-lg font-bold">
                  {summary.earnedCount}
                  <span className="text-sm font-semibold text-muted-fg"> / {summary.total}</span>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-fg">Lecciones</dt>
                <dd className="mt-1 text-lg font-bold">{progress.lessonsCompleted}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-fg">Cursos completados</dt>
                <dd className="mt-1 text-lg font-bold">{progress.coursesCompleted}</dd>
              </div>
            </dl>
          </article>

          <article className="rounded-3xl border border-line bg-surface p-6 shadow-sm md:p-7">
            <p className="flex items-center gap-2 text-xs font-bold tracking-wider text-muted-fg uppercase">
              <Flag className="h-4 w-4" aria-hidden="true" />
              Tu próxima insignia
            </p>
            {nextBadge ? (
              <div className="mt-4 flex items-start gap-4">
                <BadgeEmblem
                  icon={badgeIcon(nextBadge.icon)}
                  tier={nextBadge.tier}
                  earned={false}
                  size={56}
                />
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-bold">{nextBadge.title}</h3>
                  <p className="mt-1 text-xs leading-5 text-muted-fg">{nextBadge.description}</p>
                  <div className="mt-3">
                    <ProgressBar percent={nextBadge.percent} label={nextBadge.title} />
                    <p className="mt-2 text-xs font-semibold text-muted-fg">
                      {progressText(nextBadge)}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm leading-6 text-muted-fg">
                Obtuviste todas las insignias disponibles. ¡Felicitaciones!
              </p>
            )}
          </article>
        </section>

        <section>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">Insignias</h2>
              <p className="mt-1 text-xs text-muted-fg">
                Se obtienen automáticamente con tu actividad real en la Escuela.
              </p>
            </div>
            <div role="group" aria-label="Filtrar por categoría" className="flex flex-wrap gap-2">
              {filters.map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  aria-pressed={category === filter.id}
                  onClick={() => setCategory(filter.id)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    category === filter.id
                      ? "border-decom-blue bg-decom-blue-soft text-decom-blue-text"
                      : "border-line bg-surface text-muted-fg hover:bg-surface-muted"
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          <ul className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visibleBadges.map((badge) => (
              <li key={badge.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(badge.id)}
                  aria-haspopup="dialog"
                  className={`flex h-full w-full flex-col rounded-2xl border p-5 text-left transition hover:-translate-y-0.5 hover:shadow-md ${
                    badge.earned
                      ? "border-line bg-surface shadow-sm"
                      : "border-dashed border-line bg-transparent"
                  }`}
                >
                  <span className="sr-only">
                    {badge.earned ? "Insignia obtenida. " : "Insignia bloqueada. "}
                  </span>
                  <div className="flex items-start justify-between gap-3">
                    <BadgeEmblem
                      icon={badgeIcon(badge.icon)}
                      tier={badge.tier}
                      earned={badge.earned}
                    />
                    <span className="rounded-full bg-surface-muted px-2.5 py-1 text-[10px] font-bold text-muted-fg">
                      {TIERS[badge.tier]}
                    </span>
                  </div>
                  <h3 className="mt-4 text-sm font-bold">{badge.title}</h3>
                  <p className="mt-1.5 flex-1 text-xs leading-5 text-muted-fg">
                    {badge.description}
                  </p>
                  <div className="mt-4 border-t border-line-soft pt-3">
                    {badge.earned ? (
                      <p className="flex items-center justify-between text-xs font-semibold">
                        <span className="text-decom-teal-text">Obtenida</span>
                        <span className="text-decom-blue-text">+{badge.points} puntos</span>
                      </p>
                    ) : (
                      <>
                        <ProgressBar percent={badge.percent} label={badge.title} />
                        <p className="mt-2 text-xs text-muted-fg">{progressText(badge)}</p>
                      </>
                    )}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-3xl border border-line bg-surface p-5 shadow-sm md:p-7">
          <p className="text-xs font-semibold tracking-wider text-muted-fg uppercase">
            Certificación académica
          </p>
          <h2 className="mt-1 text-lg font-bold">Mis certificados</h2>
          <div className="mt-4 rounded-2xl border border-dashed border-line bg-surface-muted p-6 text-center">
            <h3 className="text-sm font-bold">
              {progress.coursesCompleted > 0
                ? `Completaste ${progress.coursesCompleted} ${progress.coursesCompleted === 1 ? "curso" : "cursos"}`
                : "Tu primer certificado está por venir"}
            </h3>
            <p className="mx-auto mt-2 max-w-lg text-xs leading-5 text-muted-fg">
              Al completar un curso y validarse tu aprobación, aquí aparecerá el certificado oficial
              con un identificador único y código QR verificable. La emisión de certificados todavía
              no está activa.
            </p>
          </div>
        </section>

        <p className="text-[11px] leading-5 text-muted-fg">
          Las insignias se calculan con tu actividad registrada (lecciones, actividades,
          evaluaciones y cursos). Los criterios y los puntos son una propuesta y pueden ajustarse
          según lo defina la coordinación de DECOM.
        </p>
      </div>

      {selected ? (
        <dialog
          ref={(element) => {
            if (element && !element.open) element.showModal();
          }}
          onClose={() => setSelectedId(null)}
          onClick={(event) => {
            if (event.target === event.currentTarget) event.currentTarget.close();
          }}
          aria-labelledby="badge-detail-title"
          className="m-auto w-[calc(100%-2rem)] max-w-md rounded-3xl border border-line bg-surface p-6 text-foreground shadow-2xl backdrop:bg-black/50"
        >
          <div className="flex items-center gap-4">
            <BadgeEmblem
              icon={badgeIcon(selected.icon)}
              tier={selected.tier}
              earned={selected.earned}
              size={72}
            />
            <div>
              <h2 id="badge-detail-title" className="text-lg font-bold">
                {selected.title}
              </h2>
              <p className="mt-1 text-xs font-semibold text-muted-fg">
                {TIERS[selected.tier]} · {CATEGORIES[selected.category]}
              </p>
            </div>
          </div>
          <p className="mt-4 text-sm leading-6 text-muted-fg">{selected.description}</p>
          <div className="mt-4 rounded-xl bg-surface-muted p-4">
            <p className="text-xs font-semibold text-muted-fg">
              Requisito: {selected.target} {metricLabel(selected.metric, selected.target)}
            </p>
            <div className="mt-2">
              <ProgressBar percent={selected.percent} label={selected.title} />
            </div>
            <p className="mt-2 text-xs font-semibold">
              {selected.earned
                ? `Obtenida · +${selected.points} puntos`
                : `${progressText(selected)} · valdrá ${selected.points} puntos`}
            </p>
          </div>
          <button
            type="button"
            onClick={(event) => event.currentTarget.closest("dialog")?.close()}
            className="mt-6 w-full rounded-xl bg-decom-blue px-4 py-3 text-sm font-semibold text-white hover:bg-decom-blue-hover"
          >
            Cerrar
          </button>
        </dialog>
      ) : null}
    </main>
  );
}
