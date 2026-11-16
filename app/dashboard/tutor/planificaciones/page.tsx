"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";

type Plan = {
  id: string;
  district_id: string;
  lesson_id: string;
  session_title: string;
  topic: string;
  planned_for: string | null;
  estimated_minutes: number | null;
  status: string;
  review_feedback: string | null;
  updated_at: string;
};
type Lesson = { id: string; title: string };
type District = { id: string; name: string };

const statusLabel: Record<string, string> = {
  draft: "Borrador",
  review: "En revisión",
  approved: "Aprobada",
  changes_requested: "Requiere ajustes",
};
const statusClass: Record<string, string> = {
  draft: "bg-surface-muted text-foreground",
  review: "bg-amber-50 text-amber-800",
  approved: "bg-teal-50 text-teal-800",
  changes_requested: "bg-orange-50 text-orange-800",
};

export default function TutorWorkspacePage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient() as unknown as SupabaseClient, []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [plans, setPlans] = useState<Plan[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
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
        const { data: assignments, error: assignmentError } = await supabase
          .from("user_role_assignments")
          .select("role_id,district_id,congregation_id")
          .eq("user_id", user.id);
        if (assignmentError) throw assignmentError;
        const roleIds = [...new Set((assignments ?? []).map((a) => a.role_id))];
        const { data: roleRows, error: roleError } = roleIds.length
          ? await supabase.from("roles").select("id,role_key").in("id", roleIds)
          : { data: [], error: null };
        if (roleError) throw roleError;
        const roleMap = new Map((roleRows ?? []).map((r) => [r.id, r.role_key]));
        const tutorAssignments = (assignments ?? []).filter(
          (a) => roleMap.get(a.role_id) === "tutor" && a.district_id,
        );
        const districtIds = [
          ...new Set(tutorAssignments.map((a) => a.district_id).filter(Boolean)),
        ] as string[];
        if (!districtIds.length) {
          router.replace("/acceso-denegado");
          return;
        }
        const { data: planRows, error: planError } = await supabase
          .from("academic_lesson_plans")
          .select(
            "id,district_id,lesson_id,session_title,topic,planned_for,estimated_minutes,status,review_feedback,updated_at",
          )
          .eq("created_by", user.id)
          .in("district_id", districtIds)
          .order("updated_at", { ascending: false });
        if (planError) throw planError;
        const planData = (planRows ?? []) as Plan[];
        if (!active) return;
        setPlans(planData);
        const lessonIds = [...new Set(planData.map((p) => p.lesson_id))];
        const { data: lessonRows, error: lessonError } = lessonIds.length
          ? await supabase.from("lessons").select("id,title").in("id", lessonIds)
          : { data: [], error: null };
        if (lessonError) throw lessonError;
        setLessons((lessonRows ?? []) as Lesson[]);
        const { data: districtRows, error: districtError } = await supabase
          .from("districts")
          .select("id,name")
          .in("id", districtIds);
        if (districtError) throw districtError;
        setDistricts((districtRows ?? []) as District[]);
      } catch (e) {
        if (active)
          setError(e instanceof Error ? e.message : "No fue posible cargar el espacio del tutor.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [router, supabase]);
  const count = (status: string) => plans.filter((p) => p.status === status).length;
  const lessonName = (id: string) => lessons.find((l) => l.id === id)?.title ?? "Lección";
  const districtName = (id: string) => districts.find((d) => d.id === id)?.name ?? "Distrito";
  if (loading)
    return (
      <main className="grid min-h-screen place-items-center bg-background text-sm text-muted-fg">
        Cargando espacio del tutor...
      </main>
    );
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.2em] text-decom-blue-text">
              Academia DECOM · Docencia
            </p>
            <h1 className="mt-2 text-3xl font-bold">Espacio del tutor</h1>
            <p className="mt-2 text-sm text-muted-fg">
              Organiza tus clases, materiales y entregas para revisión académica.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => router.push("/dashboard/planificador")}
              className="rounded-xl bg-decom-blue px-4 py-3 text-sm font-semibold text-white"
            >
              Crear una clase
            </button>
            <button
              onClick={() => router.push("/dashboard/espacio")}
              className="rounded-xl border border-line bg-surface px-4 py-3 text-sm font-semibold"
            >
              Mi espacio
            </button>
          </div>
        </header>
        {error && (
          <div
            role="alert"
            className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          >
            {error}
          </div>
        )}
        <div className="mt-7 grid gap-4 sm:grid-cols-4">
          {[
            { label: "Mis planificaciones", value: plans.length },
            { label: "Borradores", value: count("draft") },
            { label: "En revisión", value: count("review") },
            { label: "Requieren ajustes", value: count("changes_requested") },
          ].map((item) => (
            <article key={item.label} className="rounded-2xl border border-line bg-surface p-5">
              <p className="text-xs font-semibold uppercase text-muted-fg">{item.label}</p>
              <p className="mt-2 text-3xl font-bold">{item.value}</p>
            </article>
          ))}
        </div>
        <section className="mt-7 rounded-2xl border border-line bg-surface p-5 sm:p-7">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">Mis clases preparadas</h2>
              <p className="mt-1 text-sm text-muted-fg">
                Consulta el estado y continúa trabajando en tus planificaciones.
              </p>
            </div>
            <button
              onClick={() => router.push("/dashboard/planificador")}
              className="rounded-xl border border-decom-blue px-4 py-2.5 text-sm font-semibold text-decom-blue-text"
            >
              Abrir planner
            </button>
          </div>
          {!plans.length ? (
            <div className="mt-5 rounded-xl border border-dashed border-line p-8 text-center">
              <p className="font-semibold">Todavía no has guardado planificaciones.</p>
              <p className="mt-1 text-sm text-muted-fg">
                Crea tu primera clase desde el planner académico.
              </p>
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {plans.map((plan) => (
                <article key={plan.id} className="rounded-xl border border-line-soft p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-decom-blue-text">
                        {districtName(plan.district_id)} · {lessonName(plan.lesson_id)}
                      </p>
                      <h3 className="mt-1 font-bold">{plan.session_title}</h3>
                      <p className="mt-1 text-sm text-muted-fg">{plan.topic}</p>
                    </div>
                    <span
                      className={
                        "rounded-full px-3 py-1.5 text-xs font-bold " +
                        (statusClass[plan.status] ?? statusClass.draft)
                      }
                    >
                      {statusLabel[plan.status] ?? plan.status}
                    </span>
                  </div>
                  {plan.review_feedback && (
                    <div className="mt-3 rounded-lg bg-amber-50 p-3">
                      <p className="text-xs font-bold text-amber-800">Observaciones del revisor</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-amber-900">
                        {plan.review_feedback}
                      </p>
                    </div>
                  )}
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-fg">
                    <span>
                      {plan.planned_for
                        ? new Date(plan.planned_for + "T12:00:00").toLocaleDateString("es-CO")
                        : "Sin fecha programada"}{" "}
                      · {plan.estimated_minutes ?? "—"} min
                    </span>
                    <button
                      onClick={() => router.push("/dashboard/planificador")}
                      className="font-semibold text-decom-blue-text"
                    >
                      Editar en planner
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
        <section className="mt-6 rounded-2xl border border-decom-teal/30 bg-decom-teal/5 p-5">
          <h2 className="font-bold">Ruta de trabajo sugerida</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-foreground">
            <li>Selecciona la lección que vas a desarrollar.</li>
            <li>Define el tema, propósito y resultados de aprendizaje.</li>
            <li>Organiza apertura, desarrollo, cierre y evaluación.</li>
            <li>Adjunta los recursos de apoyo que utilizarán los estudiantes.</li>
            <li>Guarda el borrador y envíalo a revisión cuando esté completo.</li>
          </ol>
        </section>
      </div>
    </main>
  );
}
