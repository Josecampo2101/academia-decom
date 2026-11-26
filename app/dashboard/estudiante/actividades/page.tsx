"use client";
import { StatusScreen } from "@/components/ui/StatusScreen";
import { Spinner } from "@/components/ui/Spinner";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
type AccessState = "checking" | "allowed" | "denied" | "error";
type AssignmentRow = {
  id: string;
  due_at: string | null;
  assigned_at: string;
  academic_activities: {
    id: string;
    title: string;
    description: string | null;
    instructions: string;
    response_type: string;
    total_points: number;
    due_at: string | null;
    course_modules: { title: string } | null;
    courses: { title: string } | null;
  };
};
type SubmissionRow = { id: string; assignment_id: string; status: string; attempt_number: number };
const labels: Record<string, string> = {
  available: "Disponible",
  draft: "Borrador",
  submitted: "En revisión",
  changes_requested: "Requiere ajustes",
  graded: "Calificada",
};
const classes: Record<string, string> = {
  available: "bg-sky-50 text-sky-800",
  draft: "bg-violet-50 text-violet-800",
  submitted: "bg-sky-50 text-sky-800",
  changes_requested: "bg-amber-50 text-amber-800",
  graded: "bg-teal-50 text-teal-800",
};
export default function StudentActivitiesPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [access, setAccess] = useState<AccessState>("checking");
  const [userId, setUserId] = useState<string | null>(null);
  const [filter, setFilter] = useState("Todas");
  const [items, setItems] = useState<Array<AssignmentRow & { status: string; attempt: number }>>(
    [],
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const loadActivities = useCallback(
    async (id: string) => {
      setLoading(true);
      setError("");
      try {
        const { data, error: assignmentError } = await supabase
          .from("academic_activity_assignments")
          .select(
            "id,due_at,assigned_at,academic_activities!inner(id,title,description,instructions,response_type,total_points,due_at,course_modules(title),courses(title)),course_enrollments!inner(user_id,status)",
          )
          .eq("status", "active")
          .eq("course_enrollments.user_id", id)
          .eq("course_enrollments.status", "active")
          .eq("academic_activities.status", "published")
          .order("assigned_at", { ascending: false });
        if (assignmentError) throw assignmentError;
        const assignments = (data ?? []) as unknown as AssignmentRow[];
        const ids = assignments.map((x) => x.id);
        let submissions: SubmissionRow[] = [];
        if (ids.length) {
          const { data: rows, error: submissionError } = await supabase
            .from("academic_activity_submissions")
            .select("id,assignment_id,status,attempt_number")
            .in("assignment_id", ids)
            .order("attempt_number", { ascending: false });
          if (submissionError) throw submissionError;
          submissions = (rows ?? []) as SubmissionRow[];
        }
        const latest = new Map<string, SubmissionRow>();
        for (const row of submissions)
          if (!latest.has(row.assignment_id)) latest.set(row.assignment_id, row);
        setItems(
          assignments.map((item) => {
            const submission = latest.get(item.id);
            return {
              ...item,
              status: submission?.status ?? "available",
              attempt: submission?.attempt_number ?? 0,
            };
          }),
        );
      } catch (cause) {
        console.error("No fue posible cargar las actividades asignadas:", cause);
        setError(
          cause instanceof Error ? cause.message : "No fue posible consultar las actividades.",
        );
      } finally {
        setLoading(false);
      }
    },
    [supabase],
  );
  useEffect(() => {
    let active = true;
    async function verifyAccess() {
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();
        if (authError || !user) {
          router.replace("/conexion");
          return;
        }
        const { data: assignments, error: roleError } = await supabase
          .from("user_role_assignments")
          .select("role_id")
          .eq("user_id", user.id);
        if (roleError) throw roleError;
        const roleIds = [...new Set((assignments ?? []).map((x) => x.role_id))];
        if (!roleIds.length) {
          if (active) setAccess("denied");
          return;
        }
        const { data: roles, error: rolesError } = await supabase
          .from("roles")
          .select("role_key")
          .in("id", roleIds);
        if (rolesError) throw rolesError;
        if (!active) return;
        const keys = (roles ?? []).map((x) => x.role_key);
        if (!keys.includes("member") && !keys.includes("national_admin")) {
          setAccess("denied");
          return;
        }
        setUserId(user.id);
        setAccess("allowed");
        await loadActivities(user.id);
      } catch (cause) {
        console.error("No fue posible validar el acceso a actividades:", cause);
        if (active) setAccess("error");
      }
    }
    void verifyAccess();
    return () => {
      active = false;
    };
  }, [router, supabase, loadActivities]);
  const visible = items.filter((item) => filter === "Todas" || labels[item.status] === filter);
  const counts = {
    available: items.filter((x) => x.status === "available").length,
    submitted: items.filter((x) => x.status === "submitted").length,
    changes: items.filter((x) => x.status === "changes_requested").length,
  };
  if (access === "checking")
    return (
      <main id="contenido" className="flex min-h-screen items-center justify-center bg-background">
        <Spinner />
      </main>
    );
  if (access !== "allowed")
    return (
      <StatusScreen
        title={access === "error" ? "No pudimos validar tu acceso" : "Acceso restringido"}
        message={
          access === "error"
            ? "Intenta nuevamente."
            : "Esta sección está habilitada para estudiantes con una asignación vigente."
        }
        actionLabel="Volver al panel"
        onAction={() => router.push("/dashboard/estudiante")}
      />
    );
  return (
    <main id="contenido" className="min-h-screen bg-background text-foreground">
      <header>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 pt-6 pb-0 md:px-8">
          <div>
            <p className="mt-1 text-xs text-muted-fg">Mis actividades</p>
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
        <section className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-decom-teal-text">
              Trabajo académico
            </p>
            <h1 className="mt-2 text-2xl font-extrabold md:text-3xl">Actividades y entregas</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-fg">
              Consulta las actividades asignadas, prepara tus respuestas y sigue la
              retroalimentación del tutor.
            </p>
          </div>
          <button
            type="button"
            disabled={!userId || loading}
            onClick={() => userId && void loadActivities(userId)}
            className="rounded-xl border border-line bg-surface px-4 py-2.5 text-xs font-semibold text-muted-fg disabled:opacity-50"
          >
            Actualizar
          </button>
        </section>
        <section className="grid gap-4 sm:grid-cols-3">
          {[
            {
              label: "Disponibles",
              value: counts.available,
              detail: "Asignaciones listas para iniciar",
            },
            {
              label: "En revisión",
              value: counts.submitted,
              detail: "Entregas recibidas por el tutor",
            },
            {
              label: "Requieren ajustes",
              value: counts.changes,
              detail: "Entregas que puedes corregir",
            },
          ].map((item) => (
            <article key={item.label} className="rounded-2xl border border-line bg-surface p-5">
              <p className="text-xs font-semibold text-muted-fg">{item.label}</p>
              <p className="mt-2 text-3xl font-extrabold tabular-nums">{item.value}</p>
              <p className="mt-1 text-[11px] text-muted-fg">{item.detail}</p>
            </article>
          ))}
        </section>
        <section className="rounded-3xl border border-line bg-surface p-5 shadow-sm md:p-7">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-lg font-bold">Tu bandeja de actividades</h2>
              <p className="mt-1 text-xs text-muted-fg">
                Datos consultados desde tus matrículas y asignaciones vigentes.
              </p>
            </div>
            <label className="text-xs font-semibold text-muted-fg">
              Filtrar estado{" "}
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="ml-2 rounded-lg border border-line bg-surface px-3 py-2 text-xs"
              >
                <option>Todas</option>
                <option>Disponible</option>
                <option>Borrador</option>
                <option>En revisión</option>
                <option>Calificada</option>
                <option>Requiere ajustes</option>
              </select>
            </label>
          </div>
          {error && (
            <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-xs text-red-700">
              {error}
            </p>
          )}
          {loading ? (
            <p className="py-12 text-center text-sm text-muted-fg">
              Consultando tus actividades...
            </p>
          ) : (
            <div className="mt-5 space-y-3">
              {visible.map((item) => (
                <article key={item.id} className="rounded-2xl border border-line-soft p-4 md:p-5">
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-bold">{item.academic_activities.title}</h3>
                        <span
                          className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${classes[item.status] ?? "bg-surface-muted text-muted-fg"}`}
                        >
                          {labels[item.status] ?? item.status}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-muted-fg">
                        {item.academic_activities.courses?.title ?? "Curso"} ·{" "}
                        {item.academic_activities.course_modules?.title ?? "Sin módulo"}
                      </p>
                      <p className="mt-2 max-w-2xl text-xs leading-5 text-muted-fg">
                        {item.academic_activities.description ??
                          item.academic_activities.instructions}
                      </p>
                      <p className="mt-3 text-[10px] font-semibold uppercase tracking-wider text-muted-fg">
                        Intento {item.attempt || "sin iniciar"} ·{" "}
                        {item.academic_activities.total_points} puntos
                      </p>
                      {(item.due_at ?? item.academic_activities.due_at) && (
                        <p className="mt-1 text-[11px] text-muted-fg">
                          Fecha límite:{" "}
                          {new Date(item.due_at ?? item.academic_activities.due_at!).toLocaleString(
                            "es-CO",
                          )}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => router.push(`/dashboard/estudiante/actividades/${item.id}`)}
                      className="shrink-0 rounded-xl bg-decom-blue px-4 py-3 text-xs font-bold text-white"
                    >
                      {item.status === "changes_requested"
                        ? "Corregir entrega →"
                        : item.status === "graded"
                          ? "Ver resultado →"
                          : "Ver actividad →"}
                    </button>
                  </div>
                </article>
              ))}
              {visible.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-fg">
                  {items.length === 0
                    ? "Todavía no tienes actividades asignadas."
                    : "No hay actividades para este filtro."}
                </p>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
