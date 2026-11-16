"use client";

import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";

type District = { id: string; name: string };
type Program = { id: string; title: string };
type Course = { id: string; program_id: string; title: string };
type Module = { id: string; course_id: string; title: string };
type Lesson = {
  id: string;
  module_id: string;
  title: string;
  summary: string | null;
  objectives: string[];
  estimated_minutes: number | null;
  status: string;
};
type AgendaItem = {
  id: string;
  lesson_id: string;
  session_title: string;
  topic: string;
  planned_for: string | null;
  status: string;
  estimated_minutes: number | null;
};
type Material = {
  id: string;
  title: string;
  description: string | null;
  material_type: string;
  storage_path: string | null;
  external_url: string | null;
  content: string | null;
  status: string;
  size_bytes: number | null;
};
type Plan = {
  id?: string;
  session_title: string;
  topic: string;
  description: string;
  target_audience: string;
  learning_outcomes: string[];
  teaching_method: string;
  opening_activity: string;
  lesson_development: string;
  closing_activity: string;
  assessment_strategy: string;
  homework: string;
  planned_for: string;
  estimated_minutes: string;
  status: string;
  review_feedback?: string | null;
};

const emptyPlan: Plan = {
  session_title: "",
  topic: "",
  description: "",
  target_audience: "Estudiantes DECOM",
  learning_outcomes: [],
  teaching_method: "",
  opening_activity: "",
  lesson_development: "",
  closing_activity: "",
  assessment_strategy: "",
  homework: "",
  planned_for: "",
  estimated_minutes: "60",
  status: "draft",
};
const materialTypes = [
  { value: "lesson_text", label: "Texto o guía de clase", accept: "" },
  { value: "pdf", label: "Documento PDF", accept: ".pdf,application/pdf" },
  {
    value: "document",
    label: "Documento Word",
    accept:
      ".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  },
  {
    value: "presentation",
    label: "Presentación",
    accept:
      ".ppt,.pptx,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation",
  },
  { value: "image", label: "Imagen o infografía", accept: "image/jpeg,image/png,image/webp" },
  { value: "audio", label: "Audio", accept: "audio/mpeg,audio/mp4,audio/wav" },
  { value: "video", label: "Video", accept: "video/mp4,video/webm" },
  { value: "worksheet", label: "Taller o guía de trabajo", accept: ".pdf,.doc,.docx,.txt" },
  { value: "external_link", label: "Enlace externo", accept: "" },
  { value: "other", label: "Otro recurso", accept: "" },
];

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-foreground">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted-fg">{hint}</span>}
    </label>
  );
}
const inputClass =
  "w-full rounded-xl border border-line bg-surface px-3.5 py-3 text-sm text-foreground outline-none transition focus:border-decom-blue focus:ring-2 focus:ring-sky-100";
const buttonClass =
  "rounded-xl bg-decom-blue px-5 py-3 text-sm font-semibold text-white transition hover:bg-decom-blue-hover disabled:cursor-not-allowed disabled:opacity-50";

export default function AcademicPlannerPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient() as unknown as SupabaseClient, []);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [districts, setDistricts] = useState<District[]>([]);
  const [districtId, setDistrictId] = useState("");
  const [catalogEditorScope, setCatalogEditorScope] = useState<{
    global: boolean;
    districtIds: string[];
  }>({ global: false, districtIds: [] });
  const [programs, setPrograms] = useState<Program[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [programId, setProgramId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [moduleId, setModuleId] = useState("");
  const [lessonId, setLessonId] = useState("");
  const [plan, setPlan] = useState<Plan>(emptyPlan);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [agenda, setAgenda] = useState<AgendaItem[]>([]);
  const [materialType, setMaterialType] = useState("pdf");
  const [materialTitle, setMaterialTitle] = useState("");
  const [materialDescription, setMaterialDescription] = useState("");
  const [materialContent, setMaterialContent] = useState("");
  const [materialUrl, setMaterialUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

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
        const { data: assignments, error: assignmentError } = await supabase
          .from("user_role_assignments")
          .select("role_id,district_id,congregation_id")
          .eq("user_id", user.id);
        if (assignmentError) throw assignmentError;
        const ids = [...new Set((assignments ?? []).map((a) => a.role_id))];
        const { data: roles, error: rolesError } = ids.length
          ? await supabase.from("roles").select("id,role_key").in("id", ids)
          : { data: [], error: null };
        if (rolesError) throw rolesError;
        const roleMap = new Map((roles ?? []).map((r) => [r.id, r.role_key]));
        const scopedAssignments = assignments ?? [];
        setCatalogEditorScope({
          global: scopedAssignments.some(
            (a) =>
              roleMap.get(a.role_id) === "national_admin" && !a.district_id && !a.congregation_id,
          ),
          districtIds: [
            ...new Set(
              scopedAssignments
                .filter(
                  (a) =>
                    roleMap.get(a.role_id) === "academic_editor" &&
                    a.district_id &&
                    !a.congregation_id,
                )
                .map((a) => a.district_id as string),
            ),
          ],
        });
        const allowed = scopedAssignments.filter((a) =>
          [
            "national_admin",
            "academic_editor",
            "tutor",
            "district_coordinator",
            "area_coordinator",
          ].includes(roleMap.get(a.role_id)),
        );
        if (!allowed.length) {
          router.replace("/acceso-denegado");
          return;
        }
        const national = allowed.some(
          (a) =>
            roleMap.get(a.role_id) === "national_admin" && !a.district_id && !a.congregation_id,
        );
        const districtIds = [
          ...new Set(allowed.map((a) => a.district_id).filter(Boolean)),
        ] as string[];
        let query = supabase
          .from("districts")
          .select("id,name")
          .eq("status", "active")
          .order("name");
        if (!national) query = query.in("id", districtIds);
        const { data, error: districtError } = await query;
        if (districtError) throw districtError;
        if (!active) return;
        setDistricts((data ?? []) as District[]);
        setDistrictId((data ?? [])[0]?.id ?? "");
      } catch (e) {
        if (active)
          setError(e instanceof Error ? e.message : "No fue posible verificar el acceso.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void init();
    return () => {
      active = false;
    };
  }, [router, supabase]);

  const loadHierarchy = useCallback(
    async (id: string) => {
      if (!id) return;
      setError("");
      const [p, c, m, l] = await Promise.all([
        supabase
          .from("academic_programs")
          .select("id,title")
          .eq("district_id", id)
          .order("sort_order"),
        supabase
          .from("courses")
          .select("id,program_id,title")
          .eq("district_id", id)
          .order("sort_order"),
        supabase
          .from("course_modules")
          .select("id,course_id,title")
          .eq("district_id", id)
          .order("sort_order"),
        supabase
          .from("lessons")
          .select("id,module_id,title,summary,objectives,estimated_minutes,status")
          .eq("district_id", id)
          .order("sort_order"),
      ]);
      const failure = p.error ?? c.error ?? m.error ?? l.error;
      if (failure) throw failure;
      setPrograms(p.data ?? []);
      setCourses(c.data ?? []);
      setModules(m.data ?? []);
      setLessons(l.data ?? []);
      setProgramId(p.data?.[0]?.id ?? "");
      setCourseId(c.data?.[0]?.id ?? "");
      setModuleId(m.data?.[0]?.id ?? "");
      setLessonId(l.data?.[0]?.id ?? "");
    },
    [supabase],
  );

  useEffect(() => {
    if (districtId)
      void Promise.resolve()
        .then(() => loadHierarchy(districtId))
        .catch((e) => setError(e.message));
  }, [districtId, loadHierarchy]);

  const loadAgenda = useCallback(
    async (id: string) => {
      if (!id) {
        setAgenda([]);
        return;
      }
      const { data, error: agendaError } = await supabase
        .from("academic_lesson_plans")
        .select("id,lesson_id,session_title,topic,planned_for,status,estimated_minutes")
        .eq("district_id", id)
        .order("planned_for", { ascending: true, nullsFirst: false });
      if (agendaError) throw agendaError;
      setAgenda((data ?? []) as AgendaItem[]);
    },
    [supabase],
  );

  useEffect(() => {
    if (districtId)
      void Promise.resolve()
        .then(() => loadAgenda(districtId))
        .catch((e) => setError(e.message));
  }, [districtId, loadAgenda]);

  const visibleCourses = courses.filter((c) => c.program_id === programId);
  const visibleModules = modules.filter((m) => m.course_id === courseId);
  const visibleLessons = lessons.filter((l) => l.module_id === moduleId);
  const selectedLesson = lessons.find((l) => l.id === lessonId);
  const readOnlyApproved =
    plan.status === "approved" &&
    !catalogEditorScope.global &&
    !catalogEditorScope.districtIds.includes(districtId);

  const loadLesson = useCallback(
    async (id: string) => {
      if (!id) {
        setPlan(emptyPlan);
        setMaterials([]);
        return;
      }
      const [planResult, materialResult] = await Promise.all([
        supabase.from("academic_lesson_plans").select("*").eq("lesson_id", id).maybeSingle(),
        supabase
          .from("lesson_materials")
          .select(
            "id,title,description,material_type,storage_path,external_url,content,status,size_bytes",
          )
          .eq("lesson_id", id)
          .order("sort_order"),
      ]);
      if (planResult.error) throw planResult.error;
      if (materialResult.error) throw materialResult.error;
      if (planResult.data) {
        const p = planResult.data;
        setPlan({
          id: p.id,
          session_title: p.session_title,
          topic: p.topic,
          description: p.description ?? "",
          target_audience: p.target_audience ?? "",
          learning_outcomes: p.learning_outcomes ?? [],
          teaching_method: p.teaching_method ?? "",
          opening_activity: p.opening_activity ?? "",
          lesson_development: p.lesson_development ?? "",
          closing_activity: p.closing_activity ?? "",
          assessment_strategy: p.assessment_strategy ?? "",
          homework: p.homework ?? "",
          planned_for: p.planned_for ?? "",
          estimated_minutes: String(p.estimated_minutes ?? 60),
          status: p.status === "changes_requested" ? "draft" : p.status,
          review_feedback: p.review_feedback ?? null,
        });
      } else setPlan({ ...emptyPlan, session_title: selectedLesson?.title ?? "" });
      setMaterials((materialResult.data ?? []) as Material[]);
    },
    [supabase, selectedLesson?.title],
  );

  useEffect(() => {
    if (lessonId)
      void Promise.resolve()
        .then(() => loadLesson(lessonId))
        .catch((e) => setError(e.message));
  }, [lessonId, loadLesson]);

  function updatePlan<K extends keyof Plan>(key: K, value: Plan[K]) {
    setPlan((current) => ({ ...current, [key]: value }));
  }

  async function savePlan(event: FormEvent) {
    event.preventDefault();
    if (readOnlyApproved) {
      setError(
        "La planificación aprobada está protegida contra cambios desde el planner del tutor.",
      );
      return;
    }
    if (!lessonId || !districtId || !plan.session_title.trim() || !plan.topic.trim()) {
      setError("Selecciona una lección e indica el título de la sesión y el tema.");
      return;
    }
    const minutes = plan.estimated_minutes.trim() ? Number(plan.estimated_minutes) : null;
    if (minutes !== null && (!Number.isInteger(minutes) || minutes < 1 || minutes > 600)) {
      setError("La duración debe ser un número entero entre 1 y 600 minutos.");
      return;
    }
    if (plan.status === "review") {
      const missing = [
        !plan.learning_outcomes.length && "al menos un resultado de aprendizaje",
        !plan.teaching_method && "la metodología",
        !plan.opening_activity.trim() && "la apertura",
        !plan.lesson_development.trim() && "el desarrollo",
        !plan.closing_activity.trim() && "el cierre",
        !plan.assessment_strategy.trim() && "la estrategia de evaluación",
      ].filter(Boolean);
      if (missing.length) {
        setError("Para enviar a revisión completa: " + missing.join(", ") + ".");
        return;
      }
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const payload = {
        district_id: districtId,
        lesson_id: lessonId,
        session_title: plan.session_title.trim(),
        topic: plan.topic.trim(),
        description: plan.description.trim() || null,
        target_audience: plan.target_audience || null,
        learning_outcomes: plan.learning_outcomes,
        teaching_method: plan.teaching_method || null,
        opening_activity: plan.opening_activity || null,
        lesson_development: plan.lesson_development || null,
        closing_activity: plan.closing_activity || null,
        assessment_strategy: plan.assessment_strategy || null,
        homework: plan.homework || null,
        planned_for: plan.planned_for || null,
        estimated_minutes: minutes,
        status: plan.status,
        updated_by: user?.id ?? null,
      };
      const saved = plan.id
        ? await supabase
            .from("academic_lesson_plans")
            .update(payload)
            .eq("id", plan.id)
            .select("id")
            .single()
        : await supabase
            .from("academic_lesson_plans")
            .insert({ ...payload, created_by: user?.id ?? null })
            .select("id")
            .single();
      if (saved.error) throw saved.error;
      setPlan((current) => ({ ...current, id: saved.data.id }));
      await loadAgenda(districtId);
      setNotice(
        "Plan académico guardado como " +
          (plan.status === "review" ? "pendiente de revisión." : "borrador."),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar el plan.");
    } finally {
      setSaving(false);
    }
  }

  async function addMaterial() {
    if (!lessonId || !materialTitle.trim()) {
      setError("Selecciona una lección e indica el título del material.");
      return;
    }
    if (materialType === "lesson_text" && !materialContent.trim()) {
      setError("Escribe el contenido de la clase.");
      return;
    }
    if (materialType === "external_link" && !/^https?:\/\//i.test(materialUrl)) {
      setError("Ingresa un enlace válido que comience por http:// o https://.");
      return;
    }
    if (!["lesson_text", "external_link"].includes(materialType) && !selectedFile) {
      setError("Selecciona el archivo que deseas adjuntar.");
      return;
    }
    if (selectedFile && selectedFile.size > 50 * 1024 * 1024) {
      setError("El archivo supera el límite de 50 MB.");
      return;
    }
    setUploading(true);
    setError("");
    setNotice("");
    let storagePath: string | null = null;
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (selectedFile) {
        storagePath =
          districtId +
          "/" +
          lessonId +
          "/" +
          crypto.randomUUID() +
          "-" +
          selectedFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const { error: uploadError } = await supabase.storage
          .from("academic-lesson-materials")
          .upload(storagePath, selectedFile, {
            upsert: false,
            contentType: selectedFile.type || undefined,
          });
        if (uploadError) throw uploadError;
      }
      const { error: insertError } = await supabase.from("lesson_materials").insert({
        district_id: districtId,
        lesson_id: lessonId,
        title: materialTitle.trim(),
        description: materialDescription.trim() || null,
        material_type: materialType,
        storage_path: storagePath,
        external_url: materialType === "external_link" ? materialUrl.trim() : null,
        content: materialType === "lesson_text" ? materialContent : null,
        mime_type: selectedFile?.type || null,
        size_bytes: selectedFile?.size ?? null,
        uploaded_by: user?.id ?? null,
        status: "draft",
      });
      if (insertError) throw insertError;
      setMaterialTitle("");
      setMaterialDescription("");
      setMaterialContent("");
      setMaterialUrl("");
      setSelectedFile(null);
      await loadLesson(lessonId);
      setNotice("Material agregado al borrador de la lección.");
    } catch (e) {
      if (storagePath)
        await supabase.storage.from("academic-lesson-materials").remove([storagePath]);
      setError(e instanceof Error ? e.message : "No se pudo adjuntar el material.");
    } finally {
      setUploading(false);
    }
  }

  async function removeMaterial(material: Material) {
    if (!window.confirm("¿Eliminar este material del borrador?")) return;
    setError("");
    setNotice("");
    if (material.storage_path) {
      const { error: removeError } = await supabase.storage
        .from("academic-lesson-materials")
        .remove([material.storage_path]);
      if (removeError) {
        setError(removeError.message);
        return;
      }
    }
    const { error: deleteError } = await supabase
      .from("lesson_materials")
      .delete()
      .eq("id", material.id);
    if (deleteError) setError(deleteError.message);
    else {
      await loadLesson(lessonId);
      setNotice("Material eliminado.");
    }
  }

  const selectedType = materialTypes.find((t) => t.value === materialType)!;
  if (loading)
    return (
      <main className="grid min-h-screen place-items-center bg-background text-sm text-muted-fg">
        Preparando planner académico...
      </main>
    );

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.2em] text-decom-blue-text">
              Academia DECOM · Docencia
            </p>
            <h1 className="mt-2 text-3xl font-bold">Planner académico</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-fg">
              Planea la sesión, organiza la enseñanza y reúne los recursos de cada lección en un
              solo lugar.
            </p>
          </div>
          <button
            onClick={() => router.push("/dashboard/espacio")}
            className="rounded-xl border border-line bg-surface px-4 py-3 text-sm font-semibold"
          >
            Volver a mi espacio
          </button>
        </header>

        <section className="mt-7 rounded-3xl bg-decom-navy p-6 text-white sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[.18em] text-decom-teal-light">
            Ruta de preparación
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-5">
            {[
              "Elegir curso",
              "Definir tema",
              "Diseñar la clase",
              "Adjuntar recursos",
              "Revisar y guardar",
            ].map((s, i) => (
              <div key={s} className="rounded-xl border border-white/15 bg-white/5 p-3">
                <span className="text-xs text-decom-teal-light">0{i + 1}</span>
                <p className="mt-1 text-sm font-semibold">{s}</p>
              </div>
            ))}
          </div>
        </section>

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

        <section className="mt-7 rounded-2xl border border-line bg-surface p-5 shadow-sm sm:p-7">
          <h2 className="text-lg font-bold">1. Ubicación curricular</h2>
          <p className="mt-1 text-sm text-muted-fg">
            Selecciona el distrito y la ruta formativa donde quedará organizada la clase.
          </p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Field label="Distrito">
              <select
                className={inputClass}
                value={districtId}
                onChange={(e) => setDistrictId(e.target.value)}
              >
                {districts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Programa">
              <select
                className={inputClass}
                value={programId}
                onChange={(e) => {
                  setProgramId(e.target.value);
                  const c = courses.find((x) => x.program_id === e.target.value);
                  setCourseId(c?.id ?? "");
                  setModuleId("");
                  setLessonId("");
                }}
              >
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Curso">
              <select
                className={inputClass}
                value={courseId}
                onChange={(e) => {
                  setCourseId(e.target.value);
                  const m = modules.find((x) => x.course_id === e.target.value);
                  setModuleId(m?.id ?? "");
                  setLessonId("");
                }}
              >
                {visibleCourses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Módulo">
              <select
                className={inputClass}
                value={moduleId}
                onChange={(e) => {
                  setModuleId(e.target.value);
                  const l = lessons.find((x) => x.module_id === e.target.value);
                  setLessonId(l?.id ?? "");
                }}
              >
                {visibleModules.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Lección">
              <select
                className={inputClass}
                value={lessonId}
                onChange={(e) => setLessonId(e.target.value)}
              >
                {visibleLessons.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.title}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          {!lessons.length && (
            <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
              Este distrito todavía no tiene lecciones. Primero crea el programa, curso, módulo y
              lección desde el catálogo académico.
            </p>
          )}
        </section>

        <section className="mt-6 rounded-2xl border border-line bg-surface p-5 shadow-sm sm:p-7">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">Agenda de planificación</h2>
              <p className="mt-1 text-sm text-muted-fg">
                Sesiones registradas en el distrito, con fecha, tema y estado de revisión.
              </p>
            </div>
            <span className="rounded-full bg-sky-50 px-3 py-1.5 text-xs font-bold text-decom-blue-text">
              {agenda.length} plan(es)
            </span>
          </div>
          {agenda.length ? (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[620px] text-left text-sm">
                <thead>
                  <tr className="border-b border-line-soft text-xs uppercase tracking-wide text-muted-fg">
                    <th className="py-3 pr-4">Fecha</th>
                    <th className="py-3 pr-4">Clase / tema</th>
                    <th className="py-3 pr-4">Duración</th>
                    <th className="py-3">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {agenda.map((item) => (
                    <tr key={item.id} className="border-b border-slate-50">
                      <td className="py-3 pr-4 text-muted-fg">
                        {item.planned_for
                          ? new Date(item.planned_for + "T12:00:00").toLocaleDateString("es-CO")
                          : "Sin fecha"}
                      </td>
                      <td className="py-3 pr-4">
                        <p className="font-semibold text-foreground">{item.session_title}</p>
                        <p className="mt-0.5 text-xs text-muted-fg">{item.topic}</p>
                      </td>
                      <td className="py-3 pr-4 text-muted-fg">
                        {item.estimated_minutes ? item.estimated_minutes + " min" : "—"}
                      </td>
                      <td className="py-3">
                        <span className="rounded-full bg-surface-muted px-2.5 py-1 text-xs font-semibold text-foreground">
                          {item.status === "approved"
                            ? "Aprobado"
                            : item.status === "review"
                              ? "En revisión"
                              : "Borrador"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-4 rounded-xl border border-dashed border-line p-5 text-center text-sm text-muted-fg">
              Aún no hay clases planificadas en este distrito. Crea la primera desde el formulario.
            </p>
          )}
        </section>

        {selectedLesson && (
          <form onSubmit={savePlan} className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_.85fr]">
            <fieldset disabled={readOnlyApproved} className="contents">
              {readOnlyApproved && (
                <div className="xl:col-span-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  <b>Planificación aprobada · Solo lectura.</b> Los cambios requieren intervención
                  de un editor académico autorizado. La aprobación también está protegida en
                  Supabase.
                </div>
              )}
              <div className="space-y-6">
                <section className="rounded-2xl border border-line bg-surface p-5 shadow-sm sm:p-7">
                  <h2 className="text-lg font-bold">2. Diseña la sesión de clase</h2>
                  <p className="mt-1 text-sm text-muted-fg">
                    Define el asunto, propósito y enfoque pedagógico de la lección seleccionada.
                  </p>
                  {(selectedLesson.summary || selectedLesson.objectives.length > 0) && (
                    <div className="mt-4 rounded-xl border border-sky-100 bg-sky-50 p-4">
                      <p className="text-xs font-bold uppercase tracking-wide text-sky-800">
                        Referencia curricular de la lección
                      </p>
                      {selectedLesson.summary && (
                        <p className="mt-2 text-sm leading-6 text-sky-950">
                          {selectedLesson.summary}
                        </p>
                      )}
                      {selectedLesson.objectives.length > 0 && (
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-sky-900">
                          {selectedLesson.objectives.map((objective, index) => (
                            <li key={index}>{objective}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <Field label="Título de la clase">
                      <input
                        required
                        className={inputClass}
                        value={plan.session_title}
                        onChange={(e) => updatePlan("session_title", e.target.value)}
                        placeholder="Ej. Principios de comunicación cristiana"
                      />
                    </Field>
                    <Field label="Tema o asunto central">
                      <input
                        required
                        className={inputClass}
                        value={plan.topic}
                        onChange={(e) => updatePlan("topic", e.target.value)}
                        placeholder="¿Qué se va a estudiar?"
                      />
                    </Field>
                    <Field label="Público objetivo">
                      <input
                        className={inputClass}
                        value={plan.target_audience}
                        onChange={(e) => updatePlan("target_audience", e.target.value)}
                      />
                    </Field>
                    <Field label="Duración estimada (minutos)">
                      <input
                        type="number"
                        min="1"
                        max="600"
                        className={inputClass}
                        value={plan.estimated_minutes}
                        onChange={(e) => updatePlan("estimated_minutes", e.target.value)}
                      />
                    </Field>
                    <Field label="Fecha prevista">
                      <input
                        type="date"
                        className={inputClass}
                        value={plan.planned_for}
                        onChange={(e) => updatePlan("planned_for", e.target.value)}
                      />
                    </Field>
                    <Field label="Metodología">
                      <select
                        className={inputClass}
                        value={plan.teaching_method}
                        onChange={(e) => updatePlan("teaching_method", e.target.value)}
                      >
                        <option value="">Seleccionar metodología</option>
                        <option>Exposición guiada</option>
                        <option>Aprendizaje basado en proyectos</option>
                        <option>Estudio de caso</option>
                        <option>Taller práctico</option>
                        <option>Lectura y análisis</option>
                        <option>Aprendizaje colaborativo</option>
                        <option>Demostración</option>
                      </select>
                    </Field>
                  </div>
                  <div className="mt-4">
                    <Field label="Descripción y propósito">
                      <textarea
                        rows={3}
                        className={inputClass}
                        value={plan.description}
                        onChange={(e) => updatePlan("description", e.target.value)}
                        placeholder="Contexto, importancia y propósito de la clase."
                      />
                    </Field>
                  </div>
                  <div className="mt-4">
                    <Field
                      label="Resultados de aprendizaje (uno por línea)"
                      hint="Describe lo que el estudiante podrá explicar, aplicar o demostrar al finalizar."
                    >
                      <textarea
                        rows={3}
                        className={inputClass}
                        value={plan.learning_outcomes.join("\n")}
                        onChange={(e) =>
                          updatePlan(
                            "learning_outcomes",
                            e.target.value
                              .split("\n")
                              .map((x) => x.trim())
                              .filter(Boolean),
                          )
                        }
                        placeholder={"Identificar...\nExplicar...\nAplicar..."}
                      />
                    </Field>
                  </div>
                </section>

                <section className="rounded-2xl border border-line bg-surface p-5 shadow-sm sm:p-7">
                  <h2 className="text-lg font-bold">3. Secuencia didáctica</h2>
                  <p className="mt-1 text-sm text-muted-fg">
                    Ayuda al tutor a conducir la sesión con una apertura, desarrollo y cierre.
                  </p>
                  <div className="mt-5 space-y-4">
                    <Field label="Apertura · Activación y motivación">
                      <textarea
                        rows={3}
                        className={inputClass}
                        value={plan.opening_activity}
                        onChange={(e) => updatePlan("opening_activity", e.target.value)}
                        placeholder="Pregunta inicial, contextualización, activación de saberes previos..."
                      />
                    </Field>
                    <Field label="Desarrollo · Contenido y actividades">
                      <textarea
                        rows={5}
                        className={inputClass}
                        value={plan.lesson_development}
                        onChange={(e) => updatePlan("lesson_development", e.target.value)}
                        placeholder="Conceptos, explicación, demostraciones, actividades y tiempos..."
                      />
                    </Field>
                    <Field label="Cierre · Síntesis y transferencia">
                      <textarea
                        rows={3}
                        className={inputClass}
                        value={plan.closing_activity}
                        onChange={(e) => updatePlan("closing_activity", e.target.value)}
                        placeholder="Conclusiones, reflexión y aplicación práctica..."
                      />
                    </Field>
                    <Field label="Evaluación del aprendizaje">
                      <textarea
                        rows={3}
                        className={inputClass}
                        value={plan.assessment_strategy}
                        onChange={(e) => updatePlan("assessment_strategy", e.target.value)}
                        placeholder="Preguntas, ejercicio, producto o evidencia para verificar el aprendizaje..."
                      />
                    </Field>
                    <Field label="Actividad posterior o tarea">
                      <textarea
                        rows={2}
                        className={inputClass}
                        value={plan.homework}
                        onChange={(e) => updatePlan("homework", e.target.value)}
                        placeholder="Lectura, práctica o actividad para la siguiente sesión..."
                      />
                    </Field>
                  </div>
                </section>
                <div className="flex flex-wrap items-center gap-3">
                  <button disabled={saving} className={buttonClass}>
                    {saving ? "Guardando..." : "Guardar planificación"}
                  </button>
                  <span className="text-xs text-muted-fg">
                    El plan se conserva como borrador o se envía a revisión.
                  </span>
                </div>
              </div>

              <aside className="space-y-6">
                <section className="rounded-2xl border border-line bg-surface p-5 shadow-sm sm:p-6">
                  <h2 className="text-lg font-bold">4. Materiales de apoyo</h2>
                  <p className="mt-1 text-sm text-muted-fg">
                    Añade guías, archivos y recursos vinculados a esta lección.
                  </p>
                  <div className="mt-4 space-y-4">
                    <Field label="Tipo de material">
                      <select
                        className={inputClass}
                        value={materialType}
                        onChange={(e) => {
                          setMaterialType(e.target.value);
                          setSelectedFile(null);
                        }}
                      >
                        {materialTypes.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Título del recurso">
                      <input
                        className={inputClass}
                        value={materialTitle}
                        onChange={(e) => setMaterialTitle(e.target.value)}
                        placeholder="Ej. Presentación: fundamentos del tema"
                      />
                    </Field>
                    <Field label="Descripción">
                      <textarea
                        rows={2}
                        className={inputClass}
                        value={materialDescription}
                        onChange={(e) => setMaterialDescription(e.target.value)}
                        placeholder="Explica para qué utilizará el tutor o estudiante este recurso."
                      />
                    </Field>
                    {materialType === "lesson_text" && (
                      <Field label="Contenido de la clase">
                        <textarea
                          rows={8}
                          className={inputClass}
                          value={materialContent}
                          onChange={(e) => setMaterialContent(e.target.value)}
                          placeholder="Escribe el contenido en texto o Markdown..."
                        />
                      </Field>
                    )}
                    {materialType === "external_link" && (
                      <Field label="URL del recurso">
                        <input
                          type="url"
                          className={inputClass}
                          value={materialUrl}
                          onChange={(e) => setMaterialUrl(e.target.value)}
                          placeholder="https://..."
                        />
                      </Field>
                    )}
                    {!["lesson_text", "external_link"].includes(materialType) && (
                      <Field
                        label="Seleccionar archivo"
                        hint="Máximo 50 MB. Almacenamiento privado; solo usuarios autorizados podrán consultarlo."
                      >
                        <input
                          type="file"
                          className="block w-full text-sm text-muted-fg file:mr-3 file:rounded-lg file:border-0 file:bg-sky-50 file:px-3 file:py-2 file:font-semibold file:text-decom-blue-text"
                          accept={selectedType.accept}
                          onChange={(e: ChangeEvent<HTMLInputElement>) =>
                            setSelectedFile(e.target.files?.[0] ?? null)
                          }
                        />
                      </Field>
                    )}
                    <button
                      type="button"
                      onClick={() => void addMaterial()}
                      disabled={uploading}
                      className="w-full rounded-xl border border-decom-blue px-4 py-3 text-sm font-semibold text-decom-blue-text disabled:opacity-50"
                    >
                      {uploading ? "Agregando material..." : "Agregar material al borrador"}
                    </button>
                  </div>
                  <div className="mt-6 border-t border-line-soft pt-5">
                    <h3 className="font-bold">Recursos de esta lección ({materials.length})</h3>
                    <div className="mt-3 space-y-2">
                      {materials.length ? (
                        materials.map((m) => (
                          <div
                            key={m.id}
                            className="flex items-start justify-between gap-3 rounded-xl bg-surface-muted p-3"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold">{m.title}</p>
                              <p className="mt-1 text-xs text-muted-fg">
                                {materialTypes.find((t) => t.value === m.material_type)?.label ??
                                  m.material_type}{" "}
                                · {m.status === "published" ? "Publicado" : "Borrador"}
                              </p>
                              {m.description && (
                                <p className="mt-1 text-xs text-muted-fg">{m.description}</p>
                              )}
                            </div>
                            {m.status === "draft" && (
                              <button
                                type="button"
                                onClick={() => void removeMaterial(m)}
                                className="text-xs font-semibold text-red-600"
                              >
                                Eliminar borrador
                              </button>
                            )}
                          </div>
                        ))
                      ) : (
                        <p className="rounded-xl border border-dashed border-line p-4 text-center text-sm text-muted-fg">
                          Todavía no hay materiales adjuntos.
                        </p>
                      )}
                    </div>
                  </div>
                </section>

                <section className="rounded-2xl border border-decom-teal/30 bg-decom-teal/5 p-5">
                  <h2 className="font-bold">5. Estado de la planificación</h2>
                  <p className="mt-1 text-sm text-muted-fg">
                    Guarda el trabajo como borrador o remítelo a revisión académica.
                  </p>
                  <div className="mt-4 space-y-3">
                    {plan.review_feedback && (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                        <p className="text-xs font-bold uppercase text-amber-800">
                          Observaciones de revisión anterior
                        </p>
                        <p className="mt-2 whitespace-pre-wrap text-sm text-amber-900">
                          {plan.review_feedback}
                        </p>
                      </div>
                    )}
                    <label className="flex items-start gap-3 rounded-xl bg-surface p-3">
                      <input
                        type="radio"
                        name="plan-status"
                        checked={plan.status === "draft"}
                        onChange={() => updatePlan("status", "draft")}
                      />
                      <span>
                        <b className="block text-sm">Guardar borrador</b>
                        <small className="text-xs text-muted-fg">
                          Conserva el trabajo para seguir editándolo.
                        </small>
                      </span>
                    </label>
                    <label className="flex items-start gap-3 rounded-xl bg-surface p-3">
                      <input
                        type="radio"
                        name="plan-status"
                        checked={plan.status === "review"}
                        onChange={() => updatePlan("status", "review")}
                      />
                      <span>
                        <b className="block text-sm">Enviar a revisión</b>
                        <small className="text-xs text-muted-fg">
                          Queda pendiente de validación académica.
                        </small>
                      </span>
                    </label>
                    {plan.status === "approved" && (
                      <p className="rounded-xl bg-surface p-3 text-sm text-teal-800">
                        Esta planificación ya está aprobada.
                      </p>
                    )}
                  </div>
                </section>
              </aside>
            </fieldset>
          </form>
        )}
        <footer className="py-9 text-center text-xs text-muted-fg">
          Academia DECOM · Planificación pedagógica y recursos de aprendizaje.
        </footer>
      </div>
    </main>
  );
}
