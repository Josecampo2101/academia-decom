"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";

type District = { id: string; name: string };
type Plan = {
  id: string;
  district_id: string;
  lesson_id: string;
  session_title: string;
  topic: string;
  description: string | null;
  target_audience: string | null;
  learning_outcomes: string[];
  teaching_method: string | null;
  opening_activity: string | null;
  lesson_development: string | null;
  closing_activity: string | null;
  assessment_strategy: string | null;
  homework: string | null;
  planned_for: string | null;
  estimated_minutes: number | null;
  created_by: string | null;
  created_at: string;
  review_feedback: string | null;
};
type Material = {
  id: string;
  lesson_id: string;
  title: string;
  description: string | null;
  material_type: string;
  storage_path: string | null;
  external_url: string | null;
  content: string | null;
  status: string;
};
type Lesson = { id: string; title: string; module_id: string; status: string };
type Module = { id: string; title: string; course_id: string; status: string };
type Course = { id: string; title: string; program_id: string; status: string };
type Program = { id: string; status: string };
type Profile = { id: string; full_name: string | null };

export default function AcademicReviewPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient() as unknown as SupabaseClient, []);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [userId, setUserId] = useState("");
  const [districts, setDistricts] = useState<District[]>([]);
  const [districtId, setDistrictId] = useState("all");
  const [plans, setPlans] = useState<Plan[]>([]);
  const [approvedPlans, setApprovedPlans] = useState<Plan[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [authors, setAuthors] = useState<Profile[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [feedback, setFeedback] = useState<Record<string, string>>({});

  const loadQueue = useCallback(
    async (ids: string[]) => {
      if (!ids.length) {
        setPlans([]);
        return;
      }
      const selectFields =
        "id,district_id,lesson_id,session_title,topic,description,target_audience,learning_outcomes,teaching_method,opening_activity,lesson_development,closing_activity,assessment_strategy,homework,planned_for,estimated_minutes,created_by,created_at,review_feedback";
      const [reviewResult, approvedResult] = await Promise.all([
        supabase
          .from("academic_lesson_plans")
          .select(selectFields)
          .eq("status", "review")
          .in("district_id", ids)
          .order("created_at", { ascending: true }),
        supabase
          .from("academic_lesson_plans")
          .select(selectFields)
          .eq("status", "approved")
          .in("district_id", ids)
          .order("created_at", { ascending: false })
          .limit(100),
      ]);
      if (reviewResult.error) throw reviewResult.error;
      if (approvedResult.error) throw approvedResult.error;
      const rows = (reviewResult.data ?? []) as Plan[];
      const approvedRows = (approvedResult.data ?? []) as Plan[];
      setPlans(rows);
      setApprovedPlans(approvedRows);
      const allPlans = [...rows, ...approvedRows];
      const lessonIds = [...new Set(allPlans.map((p) => p.lesson_id))];
      const authorIds = [...new Set(allPlans.map((p) => p.created_by).filter(Boolean))] as string[];
      if (!lessonIds.length) {
        setLessons([]);
        setModules([]);
        setCourses([]);
        setPrograms([]);
        setAuthors([]);
        setMaterials([]);
        return;
      }
      const { data: lessonRows, error: lessonError } = await supabase
        .from("lessons")
        .select("id,title,module_id,status")
        .in("id", lessonIds);
      if (lessonError) throw lessonError;
      const lessonData = (lessonRows ?? []) as Lesson[];
      setLessons(lessonData);
      const { data: materialRows, error: materialError } = await supabase
        .from("lesson_materials")
        .select(
          "id,lesson_id,title,description,material_type,storage_path,external_url,content,status",
        )
        .in("lesson_id", lessonIds)
        .order("sort_order");
      if (materialError) throw materialError;
      setMaterials((materialRows ?? []) as Material[]);
      const moduleIds = [...new Set(lessonData.map((l) => l.module_id))];
      const { data: moduleRows, error: moduleError } = moduleIds.length
        ? await supabase
            .from("course_modules")
            .select("id,title,course_id,status")
            .in("id", moduleIds)
        : { data: [], error: null };
      if (moduleError) throw moduleError;
      const moduleData = (moduleRows ?? []) as Module[];
      setModules(moduleData);
      const courseIds = [...new Set(moduleData.map((m) => m.course_id))];
      const { data: courseRows, error: courseError } = courseIds.length
        ? await supabase.from("courses").select("id,title,program_id,status").in("id", courseIds)
        : { data: [], error: null };
      if (courseError) throw courseError;
      const courseData = (courseRows ?? []) as Course[];
      setCourses(courseData);
      const programIds = [...new Set(courseData.map((item) => item.program_id))];
      const { data: programRows, error: programError } = programIds.length
        ? await supabase.from("academic_programs").select("id,status").in("id", programIds)
        : { data: [], error: null };
      if (programError) throw programError;
      setPrograms((programRows ?? []) as Program[]);
      const { data: authorRows, error: authorError } = authorIds.length
        ? await supabase.from("profiles").select("id,full_name").in("id", authorIds)
        : { data: [], error: null };
      if (authorError) throw authorError;
      setAuthors((authorRows ?? []) as Profile[]);
    },
    [supabase],
  );

  useEffect(() => {
    let active = true;
    async function init() {
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();
        if (authError || !user) {
          router.replace("/conexion");
          return;
        }
        setUserId(user.id);
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
        const hasGlobal = (assignments ?? []).some(
          (a) =>
            roleMap.get(a.role_id) === "national_admin" && !a.district_id && !a.congregation_id,
        );
        const editorAssignments = (assignments ?? []).filter((a) =>
          ["academic_editor"].includes(roleMap.get(a.role_id)),
        );
        const ids = [
          ...new Set(editorAssignments.map((a) => a.district_id).filter(Boolean)),
        ] as string[];
        if (!hasGlobal && !ids.length) {
          router.replace("/acceso-denegado");
          return;
        }
        let districtQuery = supabase
          .from("districts")
          .select("id,name")
          .eq("status", "active")
          .order("name");
        if (!hasGlobal) districtQuery = districtQuery.in("id", ids);
        const { data: districtRows, error: districtError } = await districtQuery;
        if (districtError) throw districtError;
        const districtData = (districtRows ?? []) as District[];
        if (!active) return;
        setDistricts(districtData);
        const scopedIds = districtData.map((d) => d.id);
        await loadQueue(scopedIds);
      } catch (e) {
        if (active)
          setError(e instanceof Error ? e.message : "No se pudo abrir la bandeja de revisión.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void init();
    return () => {
      active = false;
    };
  }, [router, supabase, loadQueue]);

  async function openMaterial(item: Material) {
    if (item.external_url) {
      window.open(item.external_url, "_blank", "noopener,noreferrer");
      return;
    }
    if (item.storage_path) {
      const { data, error: urlError } = await supabase.storage
        .from("academic-lesson-materials")
        .createSignedUrl(item.storage_path, 300);
      if (urlError) throw urlError;
      const anchor = document.createElement("a");
      anchor.href = data.signedUrl;
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      anchor.click();
    }
  }

  function canPublishMaterial(item: Material) {
    const lesson = lessons.find((l) => l.id === item.lesson_id);
    const courseModule = modules.find((m) => m.id === lesson?.module_id);
    const course = courses.find((c) => c.id === courseModule?.course_id);
    const program = programs.find((p) => p.id === course?.program_id);
    return (
      lesson?.status === "published" &&
      courseModule?.status === "published" &&
      course?.status === "published" &&
      program?.status === "published"
    );
  }

  async function publishMaterial(item: Material) {
    setBusyId(item.id);
    setError("");
    setNotice("");
    try {
      const { error: updateError } = await supabase
        .from("lesson_materials")
        .update({ status: "published" })
        .eq("id", item.id)
        .eq("status", "draft");
      if (updateError) throw updateError;
      setMaterials((current) =>
        current.map((material) =>
          material.id === item.id ? { ...material, status: "published" } : material,
        ),
      );
      setNotice("Material publicado para el estudiante.");
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "No fue posible publicar el material. Verifica que la lección y todos sus niveles estén publicados.",
      );
    } finally {
      setBusyId("");
    }
  }

  async function decide(plan: Plan, status: "approved" | "changes_requested") {
    const note = (feedback[plan.id] ?? "").trim();
    if (status === "changes_requested" && !note) {
      setError("Escribe las observaciones que debe corregir el tutor.");
      return;
    }
    setBusyId(plan.id);
    setError("");
    setNotice("");
    try {
      const { error: updateError } = await supabase
        .from("academic_lesson_plans")
        .update({
          status,
          review_feedback: note || null,
          reviewed_by: userId,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", plan.id)
        .eq("status", "review");
      if (updateError) throw updateError;
      setNotice(
        status === "approved"
          ? "Planificación aprobada."
          : "Planificación devuelta con observaciones.",
      );
      await loadQueue(districts.map((d) => d.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No fue posible registrar la decisión.");
    } finally {
      setBusyId("");
    }
  }

  const filtered = plans.filter((p) => districtId === "all" || p.district_id === districtId);
  function lessonTitle(id: string) {
    return lessons.find((l) => l.id === id)?.title ?? "Lección";
  }
  function hierarchy(id: string) {
    const lesson = lessons.find((l) => l.id === id);
    const courseModule = modules.find((m) => m.id === lesson?.module_id);
    return courses.find((c) => c.id === courseModule?.course_id)?.title ?? "Curso";
  }
  function districtName(id: string) {
    return districts.find((d) => d.id === id)?.name ?? "Distrito";
  }
  function authorName(id: string | null) {
    return authors.find((a) => a.id === id)?.full_name ?? "Tutor";
  }
  if (loading)
    return (
      <main className="grid min-h-screen place-items-center bg-[#F4F7FA] text-sm text-slate-500">
        Cargando revisión académica...
      </main>
    );

  return (
    <main className="min-h-screen bg-[#F4F7FA] text-[#102D4D]">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.2em] text-[#087DB5]">
              Academia DECOM · Calidad académica
            </p>
            <h1 className="mt-2 text-3xl font-bold">Revisión de planificaciones</h1>
            <p className="mt-2 text-sm text-slate-500">
              Valida las sesiones preparadas por tutores antes de aprobarlas.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => router.push("/dashboard/planificador")}
              className="rounded-xl bg-[#087DB5] px-4 py-3 text-sm font-semibold text-white"
            >
              Abrir planner
            </button>
            <button
              onClick={() => router.push("/dashboard/espacio")}
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold"
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
        {notice && (
          <div
            role="status"
            className="mt-5 rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-800"
          >
            {notice}
          </div>
        )}
        <section className="mt-7 flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Pendientes de revisión
            </p>
            <p className="mt-1 text-3xl font-bold">{filtered.length}</p>
          </div>
          <label className="block min-w-64 text-sm font-semibold">
            Filtrar por distrito
            <select
              value={districtId}
              onChange={(e) => setDistrictId(e.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm"
            >
              <option value="all">Todos mis distritos</option>
              {districts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
        </section>
        {!filtered.length ? (
          <section className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <h2 className="text-xl font-bold">No hay planificaciones pendientes</h2>
            <p className="mt-2 text-sm text-slate-500">
              Cuando un tutor envíe una clase a revisión, aparecerá aquí con su estructura didáctica
              y sus observaciones.
            </p>
          </section>
        ) : (
          <div className="mt-6 space-y-5">
            {filtered.map((plan) => {
              const lesson = lessons.find((l) => l.id === plan.lesson_id);
              const courseModule = modules.find((m) => m.id === lesson?.module_id);
              return (
                <article
                  key={plan.id}
                  className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-[#087DB5]">
                        {districtName(plan.district_id)} · {hierarchy(plan.lesson_id)}
                      </p>
                      <h2 className="mt-2 text-xl font-bold">{plan.session_title}</h2>
                      <p className="mt-1 text-sm text-slate-500">
                        {lessonTitle(plan.lesson_id)}
                        {courseModule ? " · " + courseModule.title : ""}
                      </p>
                    </div>
                    <span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800">
                      En revisión
                    </span>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase text-slate-500">Tema</p>
                      <p className="mt-1 text-sm font-semibold">{plan.topic}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase text-slate-500">
                        Preparado por
                      </p>
                      <p className="mt-1 text-sm font-semibold">{authorName(plan.created_by)}</p>
                    </div>
                  </div>
                  {plan.description && (
                    <p className="mt-4 text-sm leading-6 text-slate-600">{plan.description}</p>
                  )}
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {plan.target_audience && (
                      <div className="rounded-xl bg-slate-50 p-4">
                        <p className="text-xs font-semibold uppercase text-slate-500">Público</p>
                        <p className="mt-1 text-sm">{plan.target_audience}</p>
                      </div>
                    )}
                    {plan.teaching_method && (
                      <div className="rounded-xl bg-slate-50 p-4">
                        <p className="text-xs font-semibold uppercase text-slate-500">
                          Metodología
                        </p>
                        <p className="mt-1 text-sm">{plan.teaching_method}</p>
                      </div>
                    )}
                    {plan.learning_outcomes?.length > 0 && (
                      <div className="rounded-xl bg-slate-50 p-4 sm:col-span-2">
                        <p className="text-xs font-semibold uppercase text-slate-500">
                          Resultados de aprendizaje
                        </p>
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                          {plan.learning_outcomes.map((item, index) => (
                            <li key={index}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {plan.opening_activity && (
                      <div className="rounded-xl border border-slate-100 p-4">
                        <p className="text-xs font-semibold uppercase text-slate-500">Apertura</p>
                        <p className="mt-1 whitespace-pre-wrap text-sm">{plan.opening_activity}</p>
                      </div>
                    )}
                    {plan.lesson_development && (
                      <div className="rounded-xl border border-slate-100 p-4">
                        <p className="text-xs font-semibold uppercase text-slate-500">Desarrollo</p>
                        <p className="mt-1 whitespace-pre-wrap text-sm">
                          {plan.lesson_development}
                        </p>
                      </div>
                    )}
                    {plan.closing_activity && (
                      <div className="rounded-xl border border-slate-100 p-4">
                        <p className="text-xs font-semibold uppercase text-slate-500">Cierre</p>
                        <p className="mt-1 whitespace-pre-wrap text-sm">{plan.closing_activity}</p>
                      </div>
                    )}
                    {plan.assessment_strategy && (
                      <div className="rounded-xl border border-slate-100 p-4">
                        <p className="text-xs font-semibold uppercase text-slate-500">Evaluación</p>
                        <p className="mt-1 whitespace-pre-wrap text-sm">
                          {plan.assessment_strategy}
                        </p>
                      </div>
                    )}
                    {plan.homework && (
                      <div className="rounded-xl border border-slate-100 p-4 sm:col-span-2">
                        <p className="text-xs font-semibold uppercase text-slate-500">
                          Tarea / actividad posterior
                        </p>
                        <p className="mt-1 whitespace-pre-wrap text-sm">{plan.homework}</p>
                      </div>
                    )}
                  </div>
                  <div className="mt-5 rounded-xl border border-slate-200 p-4">
                    <h3 className="font-bold">Materiales adjuntos</h3>
                    {materials.filter((item) => item.lesson_id === plan.lesson_id).length ? (
                      <div className="mt-3 space-y-2">
                        {materials
                          .filter((item) => item.lesson_id === plan.lesson_id)
                          .map((item) => (
                            <div
                              key={item.id}
                              className="flex flex-wrap items-start justify-between gap-3 rounded-lg bg-slate-50 p-3"
                            >
                              <div>
                                <p className="text-sm font-semibold">{item.title}</p>
                                <p className="mt-1 text-xs text-slate-500">
                                  {item.material_type} ·{" "}
                                  {item.status === "published" ? "Publicado" : "Borrador"}
                                </p>
                                {item.description && (
                                  <p className="mt-1 text-sm text-slate-600">{item.description}</p>
                                )}
                                {item.content && (
                                  <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                                    {item.content}
                                  </p>
                                )}
                              </div>
                              {(item.storage_path || item.external_url) && (
                                <button
                                  onClick={() =>
                                    void openMaterial(item).catch((e) => setError(e.message))
                                  }
                                  className="rounded-lg bg-[#087DB5] px-3 py-2 text-xs font-semibold text-white"
                                >
                                  Abrir recurso
                                </button>
                              )}
                            </div>
                          ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-slate-500">
                        No hay materiales adjuntos a esta lección.
                      </p>
                    )}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-500">
                    <span>
                      {plan.planned_for
                        ? new Date(plan.planned_for + "T12:00:00").toLocaleDateString("es-CO")
                        : "Sin fecha programada"}
                    </span>
                    <span>{plan.estimated_minutes ?? "—"} minutos</span>
                  </div>
                  <label className="mt-5 block text-sm font-semibold">
                    Observaciones de revisión
                    <textarea
                      value={feedback[plan.id] ?? ""}
                      onChange={(e) =>
                        setFeedback((current) => ({ ...current, [plan.id]: e.target.value }))
                      }
                      rows={3}
                      placeholder="Indica qué debe corregir el tutor o deja una recomendación..."
                      className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm font-normal"
                    />
                  </label>
                  <div className="mt-4 flex flex-wrap justify-end gap-3">
                    <button
                      disabled={busyId === plan.id}
                      onClick={() => void decide(plan, "changes_requested")}
                      className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 disabled:opacity-50"
                    >
                      Solicitar ajustes
                    </button>
                    <button
                      disabled={busyId === plan.id}
                      onClick={() => void decide(plan, "approved")}
                      className="rounded-xl bg-[#19A7A0] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      {busyId === plan.id ? "Guardando..." : "Aprobar planificación"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
          <div>
            <h2 className="text-xl font-bold">Materiales de clases aprobadas</h2>
            <p className="mt-1 text-sm text-slate-500">
              Cuando la lección, el módulo, el curso y el programa estén publicados, puedes
              habilitar sus recursos para los estudiantes.
            </p>
          </div>
          {!approvedPlans.some((plan) =>
            materials.some((item) => item.lesson_id === plan.lesson_id && item.status === "draft"),
          ) ? (
            <p className="mt-4 rounded-xl border border-dashed border-slate-200 p-5 text-sm text-slate-500">
              No hay materiales en borrador asociados a planificaciones aprobadas.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {approvedPlans.map((plan) => {
                const pending = materials.filter(
                  (item) => item.lesson_id === plan.lesson_id && item.status === "draft",
                );
                if (!pending.length) return null;
                return (
                  <article key={plan.id} className="rounded-xl border border-slate-100 p-4">
                    <p className="font-semibold">{plan.session_title}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {lessonTitle(plan.lesson_id)} · {hierarchy(plan.lesson_id)}
                    </p>
                    <div className="mt-3 space-y-2">
                      {pending.map((item) => (
                        <div
                          key={item.id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50 p-3"
                        >
                          <div>
                            <p className="text-sm font-semibold">{item.title}</p>
                            <p className="text-xs text-slate-500">
                              {item.material_type} · {item.description ?? "Sin descripción"}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            {(item.storage_path || item.external_url) && (
                              <button
                                onClick={() =>
                                  void openMaterial(item).catch((e) => setError(e.message))
                                }
                                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold"
                              >
                                Vista previa
                              </button>
                            )}
                            <button
                              disabled={busyId === item.id || !canPublishMaterial(item)}
                              title={
                                !canPublishMaterial(item)
                                  ? "Publica primero la lección y sus niveles curriculares."
                                  : ""
                              }
                              onClick={() => void publishMaterial(item)}
                              className="rounded-lg bg-[#19A7A0] px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
                            >
                              {busyId === item.id ? "Publicando..." : "Publicar recurso"}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
