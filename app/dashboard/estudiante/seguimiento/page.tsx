"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Inbox, LoaderCircle } from "lucide-react";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { StatusScreen } from "@/components/ui/StatusScreen";
import { loadStudentTracking } from "@/lib/tracking/data";
import type { EventStatus, RouteState, Tracking } from "@/lib/tracking/engine.mjs";
import { createClient } from "@/lib/supabase/client";

type AccessState = "checking" | "allowed" | "denied" | "error";
type TrackingState =
  { status: "loading" } | { status: "ready"; tracking: Tracking } | { status: "error" };

const ROUTE_LABELS: Record<RouteState, { label: string; className: string }> = {
  completed: { label: "Completado", className: "bg-teal-50 text-teal-700" },
  in_progress: { label: "En curso", className: "bg-decom-blue-soft text-decom-blue-text" },
  not_started: { label: "Sin iniciar", className: "bg-surface-muted text-muted-fg" },
};

const EVENT_LABELS: Record<EventStatus, { label: string; dot: string }> = {
  completed: { label: "Completada", dot: "bg-teal-500" },
  graded: { label: "Calificada", dot: "bg-teal-500" },
  passed: { label: "Aprobada", dot: "bg-teal-500" },
  submitted: { label: "Entregada", dot: "bg-decom-blue" },
  in_review: { label: "En revisión", dot: "bg-decom-blue" },
  changes_requested: { label: "Con ajustes", dot: "bg-amber-400" },
  not_passed: { label: "No aprobada", dot: "bg-amber-400" },
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function lessonsText(count: number) {
  return `${count} ${count === 1 ? "lección" : "lecciones"}`;
}

export default function StudentTrackingPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [access, setAccess] = useState<AccessState>("checking");
  const [state, setState] = useState<TrackingState>({ status: "loading" });

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
        if (!roleIds.length) {
          setAccess("denied");
          return;
        }
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

        // El seguimiento se lee aparte: si falla, el acceso sigue siendo válido y se avisa en pantalla.
        try {
          const tracking = await loadStudentTracking(supabase, user.id);
          if (active) setState({ status: "ready", tracking });
        } catch (error) {
          console.error("No fue posible cargar el seguimiento:", error);
          if (active) setState({ status: "error" });
        }
      } catch (error) {
        console.error("No fue posible validar el acceso al seguimiento:", error);
        if (active) setAccess("error");
      }
    }

    void Promise.resolve().then(verifyAccessAndLoad);
    return () => {
      active = false;
    };
  }, [router, supabase]);

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
        message="El seguimiento está habilitado para estudiantes con una asignación vigente."
        actionLabel="Volver al panel"
        onAction={() => router.push("/dashboard/estudiante")}
      />
    );

  const tracking = state.status === "ready" ? state.tracking : null;

  return (
    <main id="contenido" className="min-h-screen bg-background text-foreground">
      <header>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 pt-6 pb-0 md:px-8">
          <div>
            <p className="mt-1 text-xs text-muted-fg">Seguimiento académico</p>
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
        <section>
          <p className="text-xs font-bold tracking-[0.16em] text-decom-teal-text uppercase">
            Tu evolución
          </p>
          <h1 className="mt-2 text-2xl font-extrabold md:text-3xl">Mi seguimiento</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-fg">
            Consulta el estado de tu ruta, tu actividad reciente y las próximas acciones.
          </p>
        </section>

        {state.status === "error" ? (
          <p
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs leading-5 text-red-800"
          >
            No pudimos cargar tu seguimiento en este momento. Recarga la página; si el problema
            continúa, avisa a tu tutor.
          </p>
        ) : null}

        {state.status === "loading" ? (
          <div role="status" className="flex items-center gap-3 py-10 text-sm text-muted-fg">
            <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />
            Cargando tu seguimiento...
          </div>
        ) : null}

        {tracking && tracking.routes.length === 0 ? (
          <section className="rounded-3xl border border-dashed border-line bg-surface-muted p-10 text-center">
            <Inbox className="mx-auto h-8 w-8 text-muted-fg" aria-hidden="true" />
            <h2 className="mt-3 text-base font-bold">Aún no tienes cursos asignados</h2>
            <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-muted-fg">
              Cuando la coordinación te matricule en un curso, aquí verás tu avance, tus pendientes
              y tu actividad reciente.
            </p>
          </section>
        ) : null}

        {tracking && tracking.routes.length > 0 ? (
          <>
            <section className="grid gap-4 sm:grid-cols-3">
              <article className="rounded-2xl border border-line bg-surface p-5">
                <p className="text-xs font-semibold text-muted-fg">Avance general</p>
                <p className="mt-2 text-3xl font-extrabold">{tracking.overall.percent}%</p>
                <ProgressBar
                  percent={tracking.overall.percent}
                  label="Avance general"
                  tone="teal"
                  className="mt-3 h-2"
                />
              </article>
              <article className="rounded-2xl border border-line bg-surface p-5">
                <p className="text-xs font-semibold text-muted-fg">Lecciones completadas</p>
                <p className="mt-2 text-3xl font-extrabold">
                  {tracking.overall.done}{" "}
                  <span className="text-base font-semibold text-muted-fg">
                    / {tracking.overall.total}
                  </span>
                </p>
              </article>
              <article className="rounded-2xl border border-line bg-surface p-5">
                <p className="text-xs font-semibold text-muted-fg">Actividades por entregar</p>
                <p className="mt-2 text-3xl font-extrabold">{tracking.pending.length}</p>
              </article>
            </section>

            <section className="rounded-3xl border border-line bg-surface p-5 shadow-sm md:p-6">
              <h2 className="text-lg font-bold">Ruta de formación</h2>
              <p className="mt-1 text-xs text-muted-fg">Tus cursos y el avance en cada uno.</p>
              <ol className="mt-5 space-y-5">
                {tracking.routes.map((route, index) => {
                  const chip = ROUTE_LABELS[route.state];
                  const detail =
                    route.state === "completed"
                      ? "Curso finalizado"
                      : route.nextLessonTitle
                        ? `Siguiente: ${route.nextLessonTitle}`
                        : "Aún no hay lecciones publicadas";
                  return (
                    <li key={route.enrollmentId} className="flex gap-4">
                      <div
                        aria-hidden="true"
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${
                          route.state === "not_started"
                            ? "bg-surface-muted text-muted-fg"
                            : "bg-decom-blue-soft text-decom-blue-text"
                        }`}
                      >
                        {index + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="text-sm font-bold">{route.title}</h3>
                          <span
                            className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${chip.className}`}
                          >
                            {chip.label}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-muted-fg">
                          {route.done} de {lessonsText(route.total)} · {detail}
                        </p>
                        <ProgressBar
                          percent={route.percent}
                          label={`Avance en ${route.title}`}
                          tone="teal"
                          className="mt-3 h-2"
                        />
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>

            <section className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
              <article className="rounded-3xl border border-line bg-surface p-5 shadow-sm md:p-6">
                <h2 className="text-lg font-bold">Actividad reciente</h2>
                {tracking.recent.length === 0 ? (
                  <p className="mt-4 text-xs leading-5 text-muted-fg">
                    Todavía no hay actividad registrada. Completa una lección o entrega una
                    actividad y aparecerá aquí.
                  </p>
                ) : (
                  <ul className="mt-4 divide-y divide-line-soft">
                    {tracking.recent.map((item) => (
                      <li key={item.id} className="flex gap-3 py-4">
                        <span
                          aria-hidden="true"
                          className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${EVENT_LABELS[item.status].dot}`}
                        />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-xs font-bold">{item.title}</h3>
                            <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[10px] font-semibold text-muted-fg">
                              {EVENT_LABELS[item.status].label}
                            </span>
                          </div>
                          <p className="mt-1 text-xs leading-5 text-muted-fg">{item.description}</p>
                          <p className="mt-1 text-[11px] text-muted-fg">{formatDate(item.date)}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </article>

              <article className="rounded-3xl border border-line bg-surface p-5 shadow-sm md:p-6">
                <h2 className="text-lg font-bold">Próximos pasos</h2>
                <p className="mt-1 text-xs text-muted-fg">
                  Acciones sugeridas según lo que tienes pendiente.
                </p>
                <div className="mt-5 space-y-3">
                  {tracking.nextSteps.map((step) => (
                    <button
                      key={step.kind}
                      type="button"
                      onClick={() => router.push(step.href)}
                      className="w-full rounded-xl border border-line p-4 text-left transition hover:border-decom-blue"
                    >
                      <span className="text-xs font-bold">{step.title}</span>
                      <span className="mt-1 block text-[11px] text-muted-fg">{step.detail}</span>
                    </button>
                  ))}
                </div>
              </article>
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}
