"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Course = { id: string; title: string; status: string };
type Module = { id: string; course_id: string; title: string; status: string; sort_order: number };
type Lesson = { id: string; module_id: string; title: string; status: string; sort_order: number };
type Activity = { id: string; course_id: string; module_id: string; lesson_id: string; title: string; description: string | null; activity_type: string; response_type: string; total_points: number; max_attempts: number; due_at: string | null; status: string; created_at: string };

const activityTypes = ["individual", "reflection", "project", "workshop", "practice"];
const responseTypes = [{ value: "text", label: "Respuesta escrita" }, { value: "file", label: "Archivo adjunto" }, { value: "link", label: "Enlace externo" }, { value: "mixed", label: "Respuesta mixta" }];

function slugError(error: unknown) {
  return error instanceof Error ? error.message : "No fue posible completar la operación.";
}

export default function AcademicActivitiesAdminPage() {
  const supabase = useMemo(() => createClient(), []);
  const [userId, setUserId] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [canPublish, setCanPublish] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [courseId, setCourseId] = useState("");
  const [moduleId, setModuleId] = useState("");
  const [lessonId, setLessonId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [activityType, setActivityType] = useState("individual");
  const [responseType, setResponseType] = useState("text");
  const [totalPoints, setTotalPoints] = useState("100");
  const [maxAttempts, setMaxAttempts] = useState("2");
  const [dueAt, setDueAt] = useState("");
  const [rubricText, setRubricText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) throw new Error("Inicia sesión para administrar actividades.");
      setUserId(auth.user.id);

      const { data: assignments, error: assignmentError } = await supabase.from("user_role_assignments").select("role_id, district_id").eq("user_id", auth.user.id);
      if (assignmentError) throw assignmentError;
      const roleIds = [...new Set((assignments ?? []).map((row) => row.role_id))];
      const { data: roles, error: rolesError } = roleIds.length ? await supabase.from("roles").select("role_key").in("id", roleIds) : { data: [], error: null };
      if (rolesError) throw rolesError;
      const roleKeys = new Set((roles ?? []).map((row) => row.role_key));
      const manager = ["national_admin", "academic_editor", "tutor", "district_coordinator", "area_coordinator"].some((key) => roleKeys.has(key));
      if (!manager) throw new Error("Tu perfil no tiene permisos para administrar actividades.");
      setCanPublish(roleKeys.has("national_admin") || roleKeys.has("academic_editor"));

      let selectedDistrict = (assignments ?? []).find((row) => row.district_id)?.district_id ?? "";
      if (!selectedDistrict && roleKeys.has("national_admin")) {
        const { data: district, error: districtError } = await supabase.from("districts").select("id").eq("code", "34").maybeSingle();
        if (districtError) throw districtError;
        selectedDistrict = district?.id ?? "";
      }
      if (!selectedDistrict) throw new Error("No se encontró un distrito asignado para tu usuario.");
      setDistrictId(selectedDistrict);

      const [courseResult, moduleResult, lessonResult, activityResult] = await Promise.all([
        supabase.from("courses").select("id, title, status").eq("district_id", selectedDistrict).order("sort_order"),
        supabase.from("course_modules").select("id, course_id, title, status, sort_order").eq("district_id", selectedDistrict).order("sort_order"),
        supabase.from("lessons").select("id, module_id, title, status, sort_order").eq("district_id", selectedDistrict).order("sort_order"),
        supabase.from("academic_activities").select("id, course_id, module_id, lesson_id, title, description, activity_type, response_type, total_points, max_attempts, due_at, status, created_at").eq("district_id", selectedDistrict).order("created_at", { ascending: false }),
      ]);
      if (courseResult.error) throw courseResult.error;
      if (moduleResult.error) throw moduleResult.error;
      if (lessonResult.error) throw lessonResult.error;
      if (activityResult.error) throw activityResult.error;
      setCourses((courseResult.data ?? []) as Course[]);
      setModules((moduleResult.data ?? []) as Module[]);
      setLessons((lessonResult.data ?? []) as Lesson[]);
      setActivities((activityResult.data ?? []) as Activity[]);
      setCourseId((current) => current || courseResult.data?.[0]?.id || "");
    } catch (cause) {
      setError(slugError(cause));
    } finally { setLoading(false); }
  }, [supabase]);

  useEffect(() => { void loadData(); }, [loadData]);

  const courseModules = modules.filter((item) => item.course_id === courseId);
  const moduleLessons = lessons.filter((item) => item.module_id === moduleId);
  const availableCourses = courses.filter((item) => item.status === "published");
  const availableModules = courseModules.filter((item) => item.status === "published");
  const availableLessons = moduleLessons.filter((item) => item.status === "published");

  async function createActivity() {
    if (!userId || !districtId || saving) return;
    setSaving(true); setError(""); setNotice("");
    try {
      if (title.trim().length < 3) throw new Error("El título debe tener al menos 3 caracteres.");
      if (instructions.trim().length < 10) throw new Error("Las instrucciones deben tener al menos 10 caracteres.");
      if (!courseId || !moduleId || !lessonId) throw new Error("Selecciona un curso, módulo y lección publicados.");
      const points = Number(totalPoints);
      const attempts = Number(maxAttempts);
      if (!Number.isFinite(points) || points <= 0 || points > 10000) throw new Error("Configura un puntaje total válido.");
      if (!Number.isInteger(attempts) || attempts < 1 || attempts > 10) throw new Error("Los intentos permitidos deben estar entre 1 y 10.");

      const criteria = rubricText.split("\n").map((line) => line.split("|")).filter((parts) => parts.length >= 2 && parts[0].trim() && Number(parts[1]) > 0).map((parts, index) => ({ title: parts[0].trim(), max_points: Number(parts[1]), description: parts.slice(2).join("|").trim() || null, sort_order: index }));
      if (criteria.reduce((sum, item) => sum + item.max_points, 0) > points) throw new Error("La suma de los criterios supera el puntaje total.");

      const { data: created, error: createError } = await supabase.from("academic_activities").insert({
        district_id: districtId, course_id: courseId, module_id: moduleId, lesson_id: lessonId,
        title: title.trim(), description: description.trim() || null, instructions: instructions.trim(),
        activity_type: activityType, response_type: responseType, total_points: points, max_attempts: attempts,
        due_at: dueAt ? new Date(dueAt).toISOString() : null, created_by: userId, status: "draft",
      }).select("id").single();
      if (createError) throw createError;

      if (criteria.length) {
        const { error: rubricError } = await supabase.from("academic_activity_rubric_criteria").insert(criteria.map((item) => ({ ...item, activity_id: created.id, district_id: districtId })));
        if (rubricError) throw rubricError;
      }
      setTitle(""); setDescription(""); setInstructions(""); setRubricText(""); setDueAt("");
      setNotice("Actividad guardada como borrador. Publica cuando el contenido esté revisado.");
      await loadData();
    } catch (cause) {
      setError(slugError(cause));
    } finally { setSaving(false); }
  }

  async function publishActivity(activity: Activity) {
    if (!canPublish) { setError("Solo el editor académico o el administrador nacional pueden publicar actividades."); return; }
    setSaving(true); setError(""); setNotice("");
    try {
      const { error: updateError } = await supabase.from("academic_activities").update({ status: "published" }).eq("id", activity.id).eq("status", "draft");
      if (updateError) throw updateError;
      setNotice("Actividad publicada. Ya puedes asignarla a los estudiantes matriculados.");
      await loadData();
    } catch (cause) { setError(slugError(cause)); }
    finally { setSaving(false); }
  }

  async function assignActivity(activity: Activity) {
    if (activity.status !== "published") return;
    setSaving(true); setError(""); setNotice("");
    try {
      const { data: enrollments, error: enrollmentError } = await supabase.from("course_enrollments").select("id").eq("district_id", activity.course_id ? districtId : districtId).eq("course_id", activity.course_id).eq("status", "active");
      if (enrollmentError) throw enrollmentError;
      if (!enrollments?.length) throw new Error("No hay estudiantes con matrícula activa en este curso.");
      const { data: existing, error: existingError } = await supabase.from("academic_activity_assignments").select("enrollment_id").eq("activity_id", activity.id);
      if (existingError) throw existingError;
      const existingIds = new Set((existing ?? []).map((row) => row.enrollment_id));
      const rows = enrollments.filter((row) => !existingIds.has(row.id)).map((row) => ({
        activity_id: activity.id, enrollment_id: row.id, district_id: districtId, assigned_by: userId,
        due_at: activity.due_at, status: "active",
      }));
      if (!rows.length) { setNotice("La actividad ya está asignada a todas las matrículas activas."); return; }
      const { error: insertError } = await supabase.from("academic_activity_assignments").insert(rows);
      if (insertError) throw insertError;
      setNotice("Actividad asignada a " + rows.length + " matrículas activas.");
    } catch (cause) { setError(slugError(cause)); }
    finally { setSaving(false); }
  }

  return (
    <main className="min-h-screen bg-[#F4F7FA] px-4 py-8 text-[#102D4D] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8"><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#19A7A0]">Administración académica</p><h1 className="mt-2 text-3xl font-bold">Actividades y trabajos</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">Crea actividades vinculadas al catálogo curricular, configura la forma de entrega y asígnalas a las matrículas activas del curso.</p></header>
        {error && <div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
        {notice && <div role="status" className="mb-5 rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">{notice}</div>}
        {loading ? <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">Cargando catálogo y actividades...</div> : (
          <>
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5"><h2 className="text-lg font-bold">Crear actividad</h2><p className="mt-1 text-xs text-slate-500">La actividad se crea como borrador. La publicación requiere permisos de editor académico o administración nacional.</p></div>
              <div className="grid gap-4 md:grid-cols-3">
                <label className="text-xs font-semibold">Curso<select value={courseId} onChange={(event) => { setCourseId(event.target.value); setModuleId(""); setLessonId(""); }} className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm font-normal"><option value="">Seleccionar</option>{availableCourses.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
                <label className="text-xs font-semibold">Módulo<select value={moduleId} onChange={(event) => { setModuleId(event.target.value); setLessonId(""); }} className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm font-normal"><option value="">Seleccionar</option>{availableModules.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
                <label className="text-xs font-semibold">Lección<select value={lessonId} onChange={(event) => setLessonId(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm font-normal"><option value="">Seleccionar</option>{availableLessons.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="text-xs font-semibold">Título<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={180} className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm font-normal" placeholder="Ej. Análisis de una pieza comunicativa" /></label>
                <label className="text-xs font-semibold">Tipo de actividad<select value={activityType} onChange={(event) => setActivityType(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm font-normal">{activityTypes.map((item) => <option key={item} value={item}>{item === "individual" ? "Individual" : item === "reflection" ? "Reflexión" : item === "project" ? "Proyecto" : item === "workshop" ? "Taller" : "Práctica"}</option>)}</select></label>
              </div>
              <label className="mt-4 block text-xs font-semibold">Descripción<textarea rows={2} value={description} onChange={(event) => setDescription(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm font-normal" /></label>
              <label className="mt-4 block text-xs font-semibold">Instrucciones<textarea rows={5} value={instructions} onChange={(event) => setInstructions(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm font-normal" placeholder="Explica el propósito, los pasos y los criterios de entrega..." /></label>
              <div className="mt-4 grid gap-4 md:grid-cols-4">
                <label className="text-xs font-semibold">Tipo de entrega<select value={responseType} onChange={(event) => setResponseType(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm font-normal">{responseTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
                <label className="text-xs font-semibold">Puntaje total<input type="number" min="1" max="10000" value={totalPoints} onChange={(event) => setTotalPoints(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm font-normal" /></label>
                <label className="text-xs font-semibold">Intentos<input type="number" min="1" max="10" value={maxAttempts} onChange={(event) => setMaxAttempts(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm font-normal" /></label>
                <label className="text-xs font-semibold">Fecha límite<input type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm font-normal" /></label>
              </div>
              <label className="mt-4 block text-xs font-semibold">Rúbrica (opcional)<textarea rows={3} value={rubricText} onChange={(event) => setRubricText(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm font-normal" placeholder={"Un criterio por línea: Título | puntos | descripción\nEj. Claridad del mensaje | 30 | Coherencia y precisión"} /></label>
              <button type="button" disabled={saving || !availableCourses.length} onClick={() => void createActivity()} className="mt-5 rounded-xl bg-[#087DB5] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Guardando..." : "Guardar borrador"}</button>
            </section>

            <section className="mt-8"><div className="mb-4 flex items-end justify-between gap-3"><div><h2 className="text-xl font-bold">Actividades del distrito</h2><p className="mt-1 text-xs text-slate-500">{activities.length} registros</p></div><button type="button" onClick={() => void loadData()} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold">Actualizar</button></div>
              {activities.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">Todavía no hay actividades creadas.</div> : <div className="space-y-3">{activities.map((item) => <article key={item.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold">{item.title}</h3><span className={"rounded-full px-2.5 py-1 text-[10px] font-bold " + (item.status === "published" ? "bg-emerald-50 text-emerald-800" : item.status === "archived" ? "bg-slate-100 text-slate-600" : "bg-amber-50 text-amber-800")}>{item.status === "published" ? "Publicada" : item.status === "archived" ? "Archivada" : "Borrador"}</span></div><p className="mt-1 text-xs text-slate-500">{item.total_points} puntos · {item.max_attempts} intentos · {item.response_type} · {item.due_at ? new Date(item.due_at).toLocaleDateString("es-CO") : "Sin fecha límite"}</p></div><div className="flex flex-wrap gap-2">{item.status === "draft" && canPublish && <button type="button" disabled={saving} onClick={() => void publishActivity(item)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold">Publicar</button>}{item.status === "published" && <button type="button" disabled={saving} onClick={() => void assignActivity(item)} className="rounded-xl bg-[#087DB5] px-3 py-2 text-xs font-semibold text-white">Asignar a matrículas activas</button>}</div></article>)}</div>}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
