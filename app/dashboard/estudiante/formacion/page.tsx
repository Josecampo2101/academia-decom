"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";

type Enrollment = { id: string; course_id: string; status: string };
type Course = { id: string; title: string; description: string | null };
type Module = {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  sort_order: number;
};
type Lesson = {
  id: string;
  module_id: string;
  title: string;
  summary: string | null;
  objectives: string[];
  content: unknown;
  estimated_minutes: number | null;
  sort_order: number;
};
type Progress = {
  id: string;
  enrollment_id: string;
  lesson_id: string;
  status: "in_progress" | "completed";
};
type Material = {
  id: string;
  title: string;
  description: string | null;
  material_type: string;
  storage_path: string | null;
  external_url: string | null;
  content: string | null;
};

const labels: Record<string, string> = {
  lesson_text: "Lectura / guía",
  pdf: "PDF",
  document: "Documento",
  presentation: "Presentación",
  image: "Imagen / infografía",
  infographic: "Infografía",
  audio: "Audio",
  video: "Video",
  worksheet: "Taller",
  external_link: "Enlace externo",
  other: "Otro recurso",
};
function bodyText(value: unknown) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const item = value as Record<string, unknown>;
    for (const key of ["markdown", "content", "text", "body"])
      if (typeof item[key] === "string") return item[key] as string;
  }
  return "";
}

export default function FormationPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient() as unknown as SupabaseClient, []);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [progress, setProgress] = useState<Progress[]>([]);
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState("");
  const [selectedLessonId, setSelectedLessonId] = useState("");
  const [materials, setMaterials] = useState<Material[]>([]);
  const enrollment = enrollments.find((item) => item.id === selectedEnrollmentId);
  const course = courses.find((item) => item.id === enrollment?.course_id);
  const courseModules = modules.filter((item) => item.course_id === enrollment?.course_id);
  const courseLessons = lessons.filter((item) =>
    courseModules.some((courseModule) => courseModule.id === item.module_id),
  );
  const selectedLesson = lessons.find((item) => item.id === selectedLessonId);
  const selectedProgress = progress.find(
    (item) => item.enrollment_id === selectedEnrollmentId && item.lesson_id === selectedLessonId,
  );
  const completed = courseLessons.filter((lesson) =>
    progress.some(
      (item) =>
        item.enrollment_id === selectedEnrollmentId &&
        item.lesson_id === lesson.id &&
        item.status === "completed",
    ),
  ).length;
  const percent = courseLessons.length ? Math.round((completed / courseLessons.length) * 100) : 0;

  const loadMaterials = useCallback(
    async (id: string) => {
      if (!id) {
        setMaterials([]);
        return;
      }
      const { data, error: loadError } = await supabase
        .from("lesson_materials")
        .select("id,title,description,material_type,storage_path,external_url,content")
        .eq("lesson_id", id)
        .eq("status", "published")
        .order("sort_order");
      if (loadError) throw loadError;
      setMaterials((data ?? []) as Material[]);
    },
    [supabase],
  );

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
        const { data: enrollmentRows, error: enrollmentError } = await supabase
          .from("course_enrollments")
          .select("id,course_id,status")
          .eq("user_id", user.id)
          .eq("status", "active")
          .order("enrolled_at", { ascending: false });
        if (enrollmentError) throw enrollmentError;
        const rows = (enrollmentRows ?? []) as Enrollment[];
        if (!active) return;
        setEnrollments(rows);
        setSelectedEnrollmentId(rows[0]?.id ?? "");
        const courseIds = [...new Set(rows.map((item) => item.course_id))];
        if (!courseIds.length) return;
        const { data: courseRows, error: courseError } = await supabase
          .from("courses")
          .select("id,title,description")
          .in("id", courseIds)
          .eq("status", "published");
        if (courseError) throw courseError;
        const { data: moduleRows, error: moduleError } = await supabase
          .from("course_modules")
          .select("id,course_id,title,description,sort_order")
          .in("course_id", courseIds)
          .eq("status", "published")
          .order("sort_order");
        if (moduleError) throw moduleError;
        const moduleData = (moduleRows ?? []) as Module[];
        const moduleIds = moduleData.map((item) => item.id);
        const { data: lessonRows, error: lessonError } = moduleIds.length
          ? await supabase
              .from("lessons")
              .select("id,module_id,title,summary,objectives,content,estimated_minutes,sort_order")
              .in("module_id", moduleIds)
              .eq("status", "published")
              .order("sort_order")
          : { data: [], error: null };
        if (lessonError) throw lessonError;
        const { data: progressRows, error: progressError } = await supabase
          .from("lesson_progress")
          .select("id,enrollment_id,lesson_id,status")
          .in(
            "enrollment_id",
            rows.map((item) => item.id),
          );
        if (progressError) throw progressError;
        if (!active) return;
        setCourses((courseRows ?? []) as Course[]);
        setModules(moduleData);
        setLessons((lessonRows ?? []) as Lesson[]);
        setProgress((progressRows ?? []) as Progress[]);
      } catch (e) {
        if (active)
          setError(e instanceof Error ? e.message : "No fue posible cargar tu formación.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [router, supabase]);

  useEffect(() => {
    void Promise.resolve().then(() => {
      if (!selectedEnrollmentId) return;
      const selected = enrollments.find((item) => item.id === selectedEnrollmentId);
      const availableModules = modules.filter((item) => item.course_id === selected?.course_id);
      const availableLessons = lessons.filter((item) =>
        availableModules.some((itemModule) => itemModule.id === item.module_id),
      );
      if (!availableLessons.some((item) => item.id === selectedLessonId))
        setSelectedLessonId(availableLessons[0]?.id ?? "");
    });
  }, [selectedEnrollmentId, enrollments, modules, lessons, selectedLessonId]);

  useEffect(() => {
    if (selectedLessonId)
      void Promise.resolve()
        .then(() => loadMaterials(selectedLessonId))
        .catch((e) => setError(e.message));
  }, [selectedLessonId, loadMaterials]);

  async function completeLesson() {
    if (!enrollment || !selectedLesson) return;
    setBusy(true);
    setError("");
    try {
      const { data, error: saveError } = await supabase
        .from("lesson_progress")
        .upsert(
          {
            enrollment_id: enrollment.id,
            lesson_id: selectedLesson.id,
            status: "completed",
            completed_at: new Date().toISOString(),
            last_position_seconds: 0,
          },
          { onConflict: "enrollment_id,lesson_id" },
        )
        .select("id,enrollment_id,lesson_id,status")
        .single();
      if (saveError) throw saveError;
      setProgress((current) => [
        ...current.filter(
          (item) => !(item.enrollment_id === enrollment.id && item.lesson_id === selectedLesson.id),
        ),
        data as Progress,
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar el avance.");
    } finally {
      setBusy(false);
    }
  }

  async function openMaterial(item: Material) {
    setError("");
    if (item.external_url) {
      window.open(item.external_url, "_blank", "noopener,noreferrer");
      return;
    }
    if (item.storage_path) {
      const { data, error: urlError } = await supabase.storage
        .from("academic-lesson-materials")
        .createSignedUrl(item.storage_path, 300);
      if (urlError) {
        setError(urlError.message);
        return;
      }
      const anchor = document.createElement("a");
      anchor.href = data.signedUrl;
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      anchor.click();
    }
  }

  if (loading)
    return (
      <main
        id="contenido"
        className="grid min-h-screen place-items-center bg-background text-sm text-muted-fg"
      >
        Cargando tu ruta de aprendizaje...
      </main>
    );
  return (
    <main id="contenido" className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.2em] text-decom-blue-text">
              Academia DECOM · Formación
            </p>
            <h1 className="mt-2 text-3xl font-bold">Mi aprendizaje</h1>
            <p className="mt-2 text-sm text-muted-fg">
              Estudia las lecciones publicadas y registra tu avance.
            </p>
          </div>
          <button
            onClick={() => router.push("/dashboard/espacio")}
            className="rounded-xl border border-line bg-surface px-4 py-3 text-sm font-semibold"
          >
            Volver a mi espacio
          </button>
        </header>
        {error && (
          <div
            role="alert"
            className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          >
            {error}
          </div>
        )}
        {!enrollments.length ? (
          <section className="mt-8 rounded-2xl border border-dashed border-line bg-surface p-10 text-center">
            <h2 className="text-xl font-bold">Aún no tienes cursos asignados</h2>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-fg">
              Cuando la dirección distrital o administración nacional registre tu matrícula, aquí
              aparecerán tus cursos y los materiales publicados.
            </p>
          </section>
        ) : (
          <>
            <section className="mt-7 rounded-2xl border border-line bg-surface p-5">
              <label className="block text-sm font-semibold">
                Mi curso
                <select
                  value={selectedEnrollmentId}
                  onChange={(e) => setSelectedEnrollmentId(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-line bg-surface px-3 py-3 text-sm sm:max-w-xl"
                >
                  {enrollments.map((item) => (
                    <option key={item.id} value={item.id}>
                      {courses.find((c) => c.id === item.course_id)?.title ?? "Curso asignado"}
                    </option>
                  ))}
                </select>
              </label>
              <div className="mt-5 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-decom-blue-text">
                    Progreso del curso
                  </p>
                  <p className="mt-1 text-2xl font-bold">{percent}%</p>
                </div>
                <p className="text-sm text-muted-fg">
                  {completed} de {courseLessons.length} lecciones completadas
                </p>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-muted">
                <div
                  className="h-full rounded-full bg-decom-teal transition-all"
                  style={{ width: percent + "%" }}
                />
              </div>
              {course?.description && (
                <p className="mt-4 text-sm leading-6 text-muted-fg">{course.description}</p>
              )}
            </section>
            <div className="mt-6 grid gap-6 lg:grid-cols-[.8fr_1.2fr]">
              <aside className="space-y-4">
                {courseModules.map((courseModule) => (
                  <section
                    key={courseModule.id}
                    className="rounded-2xl border border-line bg-surface p-4"
                  >
                    <h2 className="font-bold">{courseModule.title}</h2>
                    {courseModule.description && (
                      <p className="mt-1 text-xs text-muted-fg">{courseModule.description}</p>
                    )}
                    <div className="mt-3 space-y-2">
                      {lessons
                        .filter((lesson) => lesson.module_id === courseModule.id)
                        .map((lesson) => {
                          const done = progress.some(
                            (item) =>
                              item.enrollment_id === selectedEnrollmentId &&
                              item.lesson_id === lesson.id &&
                              item.status === "completed",
                          );
                          return (
                            <button
                              key={lesson.id}
                              onClick={() => setSelectedLessonId(lesson.id)}
                              className={
                                "w-full rounded-xl border p-3 text-left text-sm " +
                                (selectedLessonId === lesson.id
                                  ? "border-decom-blue bg-sky-50"
                                  : "border-line-soft hover:border-line")
                              }
                            >
                              <span className="flex items-center justify-between gap-2">
                                <span className="font-semibold">{lesson.title}</span>
                                <span className="text-xs text-teal-700">
                                  {done ? "Completada" : "Pendiente"}
                                </span>
                              </span>
                              {lesson.estimated_minutes && (
                                <span className="mt-1 block text-xs text-muted-fg">
                                  {lesson.estimated_minutes} minutos
                                </span>
                              )}
                            </button>
                          );
                        })}
                    </div>
                  </section>
                ))}
              </aside>
              <section className="rounded-2xl border border-line bg-surface p-5 sm:p-7">
                {selectedLesson ? (
                  <>
                    <p className="text-xs font-bold uppercase tracking-wide text-decom-blue-text">
                      Lección
                    </p>
                    <h2 className="mt-2 text-2xl font-bold">{selectedLesson.title}</h2>
                    {selectedLesson.summary && (
                      <p className="mt-3 text-sm leading-6 text-muted-fg">
                        {selectedLesson.summary}
                      </p>
                    )}
                    {selectedLesson.objectives.length > 0 && (
                      <div className="mt-5 rounded-xl bg-surface-muted p-4">
                        <h3 className="font-bold">Objetivos de aprendizaje</h3>
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-fg">
                          {selectedLesson.objectives.map((objective, index) => (
                            <li key={index}>{objective}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {bodyText(selectedLesson.content) && (
                      <pre className="mt-6 whitespace-pre-wrap break-words rounded-xl bg-surface-muted p-4 text-sm leading-7 text-foreground">
                        {bodyText(selectedLesson.content)}
                      </pre>
                    )}
                    <div className="mt-7 border-t border-line-soft pt-5">
                      <h3 className="font-bold">Materiales de la lección</h3>
                      {materials.length ? (
                        <div className="mt-3 space-y-3">
                          {materials.map((item) => (
                            <article
                              key={item.id}
                              className="rounded-xl border border-line-soft p-4"
                            >
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <p className="font-semibold">{item.title}</p>
                                  <p className="mt-1 text-xs text-muted-fg">
                                    {labels[item.material_type] ?? item.material_type}
                                  </p>
                                  {item.description && (
                                    <p className="mt-2 text-sm text-muted-fg">{item.description}</p>
                                  )}
                                </div>
                                {(item.storage_path || item.external_url) && (
                                  <button
                                    onClick={() => void openMaterial(item)}
                                    className="rounded-lg bg-decom-blue px-3 py-2 text-xs font-semibold text-white"
                                  >
                                    Abrir recurso
                                  </button>
                                )}
                              </div>
                              {item.content && (
                                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-foreground">
                                  {item.content}
                                </p>
                              )}
                            </article>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-3 rounded-xl border border-dashed border-line p-5 text-sm text-muted-fg">
                          No hay materiales publicados para esta lección.
                        </p>
                      )}
                    </div>
                    <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-line-soft pt-5">
                      <span className="text-sm text-muted-fg">
                        {selectedProgress?.status === "completed"
                          ? "Lección completada"
                          : "Al terminar, registra tu avance."}
                      </span>
                      <button
                        disabled={busy || selectedProgress?.status === "completed"}
                        onClick={() => void completeLesson()}
                        className="rounded-xl bg-decom-teal px-5 py-3 text-sm font-semibold text-decom-navy disabled:opacity-50"
                      >
                        {busy
                          ? "Guardando..."
                          : selectedProgress?.status === "completed"
                            ? "Completada"
                            : "Marcar como completada"}
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="py-12 text-center text-sm text-muted-fg">
                    Este curso todavía no tiene lecciones publicadas.
                  </p>
                )}
              </section>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
