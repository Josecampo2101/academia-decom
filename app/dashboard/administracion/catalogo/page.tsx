"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type DbStatus = "draft" | "published" | "archived";
type Level = "program" | "course" | "module" | "lesson";
type District = { id: string; name: string };
type Lesson = {
  id: string;
  title: string;
  summary: string;
  objectives: string[];
  duration: number | null;
  status: DbStatus;
  sortOrder: number;
  content: Record<string, unknown>;
};
type Module = {
  id: string;
  title: string;
  description: string;
  status: DbStatus;
  sortOrder: number;
  lessons: Lesson[];
};
type Course = {
  id: string;
  code: string;
  title: string;
  description: string;
  status: DbStatus;
  sortOrder: number;
  modules: Module[];
};
type Program = {
  id: string;
  code: string;
  title: string;
  description: string;
  status: DbStatus;
  sortOrder: number;
  courses: Course[];
};

function statusLabel(status: DbStatus) {
  return status === "published" ? "Publicado" : status === "archived" ? "Archivado" : "Borrador";
}

function statusClasses(status: DbStatus) {
  return status === "published"
    ? "bg-teal-50 text-teal-700"
    : status === "archived"
      ? "bg-surface-muted text-muted-fg"
      : "bg-amber-50 text-amber-700";
}

function makeCode(value: string) {
  const base =
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 28) || "CONTENIDO";
  return `${base}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
}

export default function AcademicCatalogPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [access, setAccess] = useState<"checking" | "allowed" | "denied" | "error">("checking");
  const [isNationalAdmin, setIsNationalAdmin] = useState(false);
  const [districts, setDistricts] = useState<District[]>([]);
  const [selectedDistrictId, setSelectedDistrictId] = useState("");
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "Todos" | "Borrador" | "Publicado" | "Archivado"
  >("Todos");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [level, setLevel] = useState<Level>("course");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState("15");
  const [lessonContent, setLessonContent] = useState("");
  const [lessonObjectives, setLessonObjectives] = useState("");
  const [showLessonPreview, setShowLessonPreview] = useState(false);
  const [importingLessonFile, setImportingLessonFile] = useState(false);
  const [selectedProgramId, setSelectedProgramId] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [selectedModuleId, setSelectedModuleId] = useState("");
  const [notice, setNotice] = useState(
    "El catálogo está conectado a Supabase. Los cambios se guardan en el distrito seleccionado.",
  );
  const [noticeError, setNoticeError] = useState(false);

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

        const { data: assignments, error: assignmentError } = await supabase
          .from("user_role_assignments")
          .select("role_id, district_id, congregation_id")
          .eq("user_id", user.id);
        if (assignmentError) throw assignmentError;

        const roleIds = [...new Set((assignments ?? []).map((item) => item.role_id))];
        if (!roleIds.length) {
          if (active) setAccess("denied");
          return;
        }

        const { data: roles, error: rolesError } = await supabase
          .from("roles")
          .select("id, role_key")
          .in("id", roleIds);
        if (rolesError) throw rolesError;

        const roleById = new Map((roles ?? []).map((role) => [role.id, role.role_key]));
        const nationalAdmin = (assignments ?? []).some(
          (item) =>
            roleById.get(item.role_id) === "national_admin" &&
            item.district_id === null &&
            item.congregation_id === null,
        );
        const editorDistrictIds = new Set(
          (assignments ?? [])
            .filter(
              (item) =>
                roleById.get(item.role_id) === "academic_editor" &&
                item.district_id &&
                item.congregation_id === null,
            )
            .map((item) => item.district_id as string),
        );

        if (!nationalAdmin && editorDistrictIds.size === 0) {
          if (active) setAccess("denied");
          return;
        }

        const { data: districtRows, error: districtError } = await supabase
          .from("districts")
          .select("id, name")
          .eq("status", "active")
          .order("name");
        if (districtError) throw districtError;

        const allowedDistricts = nationalAdmin
          ? (districtRows ?? [])
          : (districtRows ?? []).filter((district) => editorDistrictIds.has(district.id));

        if (!active) return;
        setIsNationalAdmin(nationalAdmin);
        setDistricts(allowedDistricts);
        const preferredDistrict =
          allowedDistricts.find((district) =>
            district.name.toLocaleLowerCase("es").includes("34"),
          ) ?? allowedDistricts[0];
        setSelectedDistrictId(preferredDistrict?.id ?? "");
        setAccess(allowedDistricts.length ? "allowed" : "denied");
      } catch (error) {
        console.error("Error verificando acceso al catálogo académico:", error);
        if (active) setAccess("error");
      }
    }

    void verifyAccess();
    return () => {
      active = false;
    };
  }, [router, supabase]);

  const loadCatalog = useCallback(
    async (districtId: string) => {
      setLoadingCatalog(true);
      try {
        const [programResult, courseResult, moduleResult, lessonResult] = await Promise.all([
          supabase
            .from("academic_programs")
            .select("id, district_id, code, title, description, status, sort_order")
            .eq("district_id", districtId)
            .order("sort_order")
            .order("title"),
          supabase
            .from("courses")
            .select("id, district_id, program_id, code, title, description, status, sort_order")
            .eq("district_id", districtId)
            .order("sort_order")
            .order("title"),
          supabase
            .from("course_modules")
            .select("id, district_id, course_id, title, description, status, sort_order")
            .eq("district_id", districtId)
            .order("sort_order")
            .order("title"),
          supabase
            .from("lessons")
            .select(
              "id, district_id, module_id, title, summary, objectives, content, estimated_minutes, status, sort_order",
            )
            .eq("district_id", districtId)
            .order("sort_order")
            .order("title"),
        ]);

        const failure =
          programResult.error ?? courseResult.error ?? moduleResult.error ?? lessonResult.error;
        if (failure) throw failure;

        const courseRows = courseResult.data ?? [];
        const moduleRows = moduleResult.data ?? [];
        const lessonRows = lessonResult.data ?? [];
        const mappedPrograms: Program[] = (programResult.data ?? []).map((program) => ({
          id: program.id,
          code: program.code,
          title: program.title,
          description: program.description ?? "",
          status: program.status as DbStatus,
          sortOrder: program.sort_order,
          courses: courseRows
            .filter((course) => course.program_id === program.id)
            .map((course) => ({
              id: course.id,
              code: course.code,
              title: course.title,
              description: course.description ?? "",
              status: course.status as DbStatus,
              sortOrder: course.sort_order,
              modules: moduleRows
                .filter((module) => module.course_id === course.id)
                .map((module) => ({
                  id: module.id,
                  title: module.title,
                  description: module.description ?? "",
                  status: module.status as DbStatus,
                  sortOrder: module.sort_order,
                  lessons: lessonRows
                    .filter((lesson) => lesson.module_id === module.id)
                    .map((lesson) => ({
                      id: lesson.id,
                      title: lesson.title,
                      summary: lesson.summary ?? "",
                      objectives: lesson.objectives ?? [],
                      duration: lesson.estimated_minutes,
                      status: lesson.status as DbStatus,
                      sortOrder: lesson.sort_order,
                      content:
                        lesson.content &&
                        typeof lesson.content === "object" &&
                        !Array.isArray(lesson.content)
                          ? lesson.content
                          : {},
                    })),
                })),
            })),
        }));

        setPrograms(mappedPrograms);
        setSelectedProgramId((current) =>
          mappedPrograms.some((program) => program.id === current)
            ? current
            : (mappedPrograms[0]?.id ?? ""),
        );
        setSelectedCourseId((current) =>
          mappedPrograms.some((program) => program.courses.some((course) => course.id === current))
            ? current
            : (mappedPrograms[0]?.courses[0]?.id ?? ""),
        );
        setSelectedModuleId((current) =>
          mappedPrograms.some((program) =>
            program.courses.some((course) =>
              course.modules.some((module) => module.id === current),
            ),
          )
            ? current
            : (mappedPrograms[0]?.courses[0]?.modules[0]?.id ?? ""),
        );
      } catch (error) {
        console.error("Error cargando el catálogo académico:", error);
        setNotice(error instanceof Error ? error.message : "No fue posible consultar el catálogo.");
        setNoticeError(true);
      } finally {
        setLoadingCatalog(false);
      }
    },
    [supabase],
  );

  useEffect(() => {
    if (access === "allowed" && selectedDistrictId) {
      void Promise.resolve().then(() => loadCatalog(selectedDistrictId));
    }
  }, [access, selectedDistrictId, loadCatalog]);

  const selectedProgram = programs.find((item) => item.id === selectedProgramId);
  const selectedCourse = selectedProgram?.courses.find((item) => item.id === selectedCourseId);
  const selectedModule = selectedCourse?.modules.find((item) => item.id === selectedModuleId);

  const counts = useMemo(() => {
    const courses = programs.flatMap((program) => program.courses);
    const modules = courses.flatMap((course) => course.modules);
    const lessons = modules.flatMap((module) => module.lessons);
    return {
      programs: programs.length,
      courses: courses.length,
      modules: modules.length,
      lessons: lessons.length,
      published: courses.filter((course) => course.status === "published").length,
    };
  }, [programs]);

  const filteredCourses = (selectedProgram?.courses ?? []).filter((course) => {
    const normalized = search.toLocaleLowerCase("es");
    const matchesSearch = `${course.title} ${course.description}`
      .toLocaleLowerCase("es")
      .includes(normalized);
    return (
      matchesSearch && (statusFilter === "Todos" || statusLabel(course.status) === statusFilter)
    );
  });

  function openCreate(nextLevel: Level) {
    setEditingId(null);
    setLevel(nextLevel);
    setTitle("");
    setDescription("");
    setDuration("15");
    setLessonContent("");
    setLessonObjectives("");
    setShowLessonPreview(false);
    setShowForm(true);
  }

  function openEdit(nextLevel: Level, item: Program | Course | Module | Lesson) {
    if (item.status !== "draft") {
      setNotice(
        "Los elementos publicados o archivados están protegidos. Para actualizarlos se debe crear una nueva versión curricular.",
      );
      setNoticeError(true);
      return;
    }
    setNoticeError(false);
    setLevel(nextLevel);
    setEditingId(item.id);
    setTitle(item.title);
    setDescription(
      nextLevel === "lesson"
        ? (item as Lesson).summary
        : "description" in item
          ? item.description
          : "",
    );
    setDuration(nextLevel === "lesson" ? String((item as Lesson).duration ?? 15) : "15");
    setLessonContent(nextLevel === "lesson" ? String((item as Lesson).content.markdown ?? "") : "");
    setLessonObjectives(
      nextLevel === "lesson" ? ((item as Lesson).objectives ?? []).join("\n") : "",
    );
    setShowLessonPreview(false);
    setShowForm(true);
  }

  async function handleLessonFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setNotice("El archivo supera el límite de 2 MB. Divide el material en partes más pequeñas.");
      setNoticeError(true);
      return;
    }
    if (!/\.(md|markdown|txt)$/i.test(file.name)) {
      setNotice("Por ahora puedes importar archivos Markdown (.md) o texto plano (.txt).");
      setNoticeError(true);
      return;
    }
    setImportingLessonFile(true);
    try {
      const text = await file.text();
      if (!text.trim()) throw new Error("El archivo está vacío.");
      setLessonContent(text);
      setShowLessonPreview(false);
      setNotice(`Contenido importado desde ${file.name}. Revisa el texto antes de guardar.`);
      setNoticeError(false);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No fue posible leer el archivo.");
      setNoticeError(true);
    } finally {
      setImportingLessonFile(false);
    }
  }

  async function saveItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle || !selectedDistrictId || saving) return;

    setSaving(true);
    setNoticeError(false);
    try {
      let createdId = editingId ?? "";
      if (editingId) {
        if (level === "program") {
          const { error } = await supabase
            .from("academic_programs")
            .update({ title: cleanTitle, description: description.trim() || null })
            .eq("id", editingId)
            .eq("district_id", selectedDistrictId);
          if (error) throw error;
        } else if (level === "course") {
          const { error } = await supabase
            .from("courses")
            .update({ title: cleanTitle, description: description.trim() || null })
            .eq("id", editingId)
            .eq("district_id", selectedDistrictId);
          if (error) throw error;
        } else if (level === "module") {
          const { error } = await supabase
            .from("course_modules")
            .update({ title: cleanTitle, description: description.trim() || null })
            .eq("id", editingId)
            .eq("district_id", selectedDistrictId);
          if (error) throw error;
        } else {
          const minutes = Number(duration);
          if (!Number.isInteger(minutes) || minutes < 1 || minutes > 600)
            throw new Error("La duración debe ser un número entero entre 1 y 600 minutos.");
          const { error } = await supabase
            .from("lessons")
            .update({
              title: cleanTitle,
              summary: description.trim() || null,
              content: { markdown: lessonContent.trim() },
              objectives: lessonObjectives
                .split("\n")
                .map((item) => item.trim())
                .filter(Boolean),
              estimated_minutes: minutes,
            })
            .eq("id", editingId)
            .eq("district_id", selectedDistrictId);
          if (error) throw error;
        }
      } else if (level === "program") {
        const { data, error } = await supabase
          .from("academic_programs")
          .insert({
            district_id: selectedDistrictId,
            code: makeCode(cleanTitle),
            title: cleanTitle,
            description: description.trim() || null,
            status: "draft",
            sort_order: programs.length,
          })
          .select("id")
          .single();
        if (error) throw error;
        createdId = data.id;
      } else if (level === "course" && selectedProgram) {
        const { data, error } = await supabase
          .from("courses")
          .insert({
            district_id: selectedDistrictId,
            program_id: selectedProgram.id,
            code: makeCode(cleanTitle),
            title: cleanTitle,
            description: description.trim() || null,
            status: "draft",
            sort_order: selectedProgram.courses.length,
          })
          .select("id")
          .single();
        if (error) throw error;
        createdId = data.id;
      } else if (level === "module" && selectedCourse) {
        const { data, error } = await supabase
          .from("course_modules")
          .insert({
            district_id: selectedDistrictId,
            course_id: selectedCourse.id,
            title: cleanTitle,
            description: description.trim() || null,
            status: "draft",
            sort_order: selectedCourse.modules.length,
          })
          .select("id")
          .single();
        if (error) throw error;
        createdId = data.id;
      } else if (level === "lesson" && selectedModule) {
        const minutes = Number(duration);
        if (!Number.isInteger(minutes) || minutes < 1 || minutes > 600) {
          throw new Error("La duración debe ser un número entero entre 1 y 600 minutos.");
        }
        const { data, error } = await supabase
          .from("lessons")
          .insert({
            district_id: selectedDistrictId,
            module_id: selectedModule.id,
            title: cleanTitle,
            summary: description.trim() || null,
            content: lessonContent.trim() ? { markdown: lessonContent.trim() } : {},
            objectives: lessonObjectives
              .split("\n")
              .map((item) => item.trim())
              .filter(Boolean),
            estimated_minutes: minutes,
            status: "draft",
            sort_order: selectedModule.lessons.length,
          })
          .select("id")
          .single();
        if (error) throw error;
        createdId = data.id;
      } else {
        throw new Error("Selecciona el elemento curricular al que pertenecerá el nuevo registro.");
      }

      await loadCatalog(selectedDistrictId);
      if (!editingId && level === "program") setSelectedProgramId(createdId);
      if (!editingId && level === "course") setSelectedCourseId(createdId);
      if (!editingId && level === "module") setSelectedModuleId(createdId);
      setShowForm(false);
      setEditingId(null);
      setNotice(
        editingId
          ? `“${cleanTitle}” se actualizó correctamente.`
          : `“${cleanTitle}” se guardó en Supabase como borrador.`,
      );
      setNoticeError(false);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No fue posible guardar el elemento.");
      setNoticeError(true);
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(target: Level, id: string, status: DbStatus) {
    if (!isNationalAdmin || !selectedDistrictId || saving) return;
    setSaving(true);
    setNoticeError(false);
    try {
      let error: { message: string } | null = null;
      if (target === "program") {
        ({ error } = await supabase
          .from("academic_programs")
          .update({ status })
          .eq("id", id)
          .eq("district_id", selectedDistrictId));
      } else if (target === "course" && status === "published") {
        ({ error } = await supabase.rpc("publish_academic_course", { p_course_id: id }));
      } else if (target === "course") {
        ({ error } = await supabase
          .from("courses")
          .update({ status })
          .eq("id", id)
          .eq("district_id", selectedDistrictId));
      } else if (target === "module") {
        ({ error } = await supabase
          .from("course_modules")
          .update({ status })
          .eq("id", id)
          .eq("district_id", selectedDistrictId));
      } else {
        ({ error } = await supabase
          .from("lessons")
          .update({ status })
          .eq("id", id)
          .eq("district_id", selectedDistrictId));
      }
      if (error) throw new Error(error.message);
      await loadCatalog(selectedDistrictId);
      setNotice(
        `El estado cambió a ${statusLabel(status).toLocaleLowerCase("es")} y quedó registrado en la auditoría.`,
      );
      setNoticeError(false);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No fue posible actualizar el estado.");
      setNoticeError(true);
    } finally {
      setSaving(false);
    }
  }

  if (access === "checking")
    return (
      <main
        id="contenido"
        className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-fg"
      >
        Verificando permisos del catálogo académico...
      </main>
    );
  if (access !== "allowed")
    return (
      <main
        id="contenido"
        className="flex min-h-screen items-center justify-center bg-background px-5"
      >
        <section className="max-w-md rounded-2xl border border-line bg-surface p-7 text-center">
          <h1 className="text-xl font-extrabold text-foreground">
            {access === "error" ? "No fue posible verificar el acceso" : "Acceso restringido"}
          </h1>
          <p className="mt-2 text-sm text-muted-fg">
            {access === "error"
              ? "Ocurrió un error al consultar tus permisos. Inténtalo nuevamente."
              : "Este módulo está disponible para Administración nacional y Editor académico con ámbito distrital asignado."}
          </p>
          <button
            type="button"
            onClick={() => router.replace("/dashboard")}
            className="mt-5 rounded-xl bg-decom-blue px-5 py-3 text-xs font-bold text-white"
          >
            Volver al panel
          </button>
        </section>
      </main>
    );

  return (
    <main
      id="contenido"
      className="min-h-screen bg-background px-4 py-7 text-foreground sm:px-7 lg:px-10"
    >
      <div className="mx-auto max-w-7xl">
        <Link
          href="/dashboard"
          className="text-xs font-semibold text-decom-blue-text hover:underline"
        >
          ← Volver al panel
        </Link>
        <header className="mt-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-decom-teal-text">
              Diseño curricular
            </p>
            <h1 className="mt-2 text-2xl font-extrabold md:text-3xl">Catálogo académico</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-fg">
              Administra programas, cursos, módulos y lecciones con persistencia, ámbito distrital y
              auditoría.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedDistrictId}
              onChange={(event) => setSelectedDistrictId(event.target.value)}
              className="rounded-xl border border-line bg-surface px-3 py-3 text-sm"
            >
              {districts.map((district) => (
                <option key={district.id} value={district.id}>
                  Distrito {district.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => openCreate("program")}
              className="rounded-xl bg-decom-blue px-5 py-3 text-sm font-bold text-white hover:bg-decom-blue-hover"
            >
              ＋ Nuevo programa
            </button>
          </div>
        </header>
        <div className="mt-5 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-xs leading-5 text-teal-900">
          <strong>Conectado a Supabase.</strong> Las altas y cambios de estado se guardan en la base
          de datos. Las publicaciones están reservadas a Administración nacional.
        </div>
        {notice && (
          <div
            role="status"
            className={`mt-4 rounded-xl border px-4 py-3 text-xs ${noticeError ? "border-red-200 bg-red-50 text-red-700" : "border-teal-200 bg-teal-50 text-teal-800"}`}
          >
            {notice}
          </div>
        )}
        <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {[
            ["Programas", counts.programs],
            ["Cursos", counts.courses],
            ["Módulos", counts.modules],
            ["Lecciones", counts.lessons],
            ["Cursos publicados", counts.published],
          ].map(([label, value]) => (
            <article key={label} className="rounded-2xl border border-line bg-surface p-4">
              <p className="text-xs font-semibold text-muted-fg">{label}</p>
              <p className="mt-2 text-2xl font-extrabold">{value}</p>
            </article>
          ))}
        </section>
        <section className="mt-6 grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="rounded-2xl border border-line bg-surface p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold">Programas</h2>
              <span className="text-xs text-muted-fg">{programs.length}</span>
            </div>
            <div className="mt-3 space-y-2">
              {programs.map((program) => (
                <button
                  type="button"
                  key={program.id}
                  onClick={() => {
                    setSelectedProgramId(program.id);
                    setSelectedCourseId(program.courses[0]?.id ?? "");
                    setSelectedModuleId(program.courses[0]?.modules[0]?.id ?? "");
                  }}
                  className={`w-full rounded-xl border p-3 text-left transition ${selectedProgramId === program.id ? "border-decom-blue bg-decom-blue/5" : "border-line-soft hover:border-line"}`}
                >
                  <span className="block text-sm font-bold">{program.title}</span>
                  <span className="mt-1 block text-[11px] text-muted-fg">
                    {program.courses.length} cursos · {statusLabel(program.status)}
                  </span>
                </button>
              ))}
              {programs.length === 0 && (
                <p className="rounded-xl border border-dashed border-line p-4 text-xs text-muted-fg">
                  Todavía no hay programas en este distrito.
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => openCreate("program")}
              className="mt-3 w-full rounded-xl border border-dashed border-decom-blue/40 px-3 py-2.5 text-xs font-bold text-decom-blue-text"
            >
              ＋ Agregar programa
            </button>
          </aside>
          <div className="min-w-0 space-y-5">
            <section className="rounded-2xl border border-line bg-surface p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-decom-teal-text">
                    Programa seleccionado
                  </p>
                  <h2 className="mt-1 text-xl font-extrabold">
                    {selectedProgram?.title ?? "Selecciona un programa"}
                  </h2>
                  <p className="mt-1 text-sm text-muted-fg">{selectedProgram?.description}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {selectedProgram && (
                    <>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${statusClasses(selectedProgram.status)}`}
                      >
                        {statusLabel(selectedProgram.status)}
                      </span>
                      <button
                        type="button"
                        onClick={() => openEdit("program", selectedProgram)}
                        className="text-[11px] font-bold text-decom-blue-text"
                      >
                        Editar
                      </button>
                    </>
                  )}
                  {isNationalAdmin && selectedProgram?.status === "draft" && (
                    <button
                      type="button"
                      disabled={
                        saving ||
                        !selectedProgram.courses.some((course) => course.status === "published")
                      }
                      onClick={() => void changeStatus("program", selectedProgram.id, "published")}
                      className="text-[11px] font-bold text-decom-blue-text disabled:opacity-40"
                    >
                      Publicar programa
                    </button>
                  )}
                  {isNationalAdmin && selectedProgram?.status === "published" && (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void changeStatus("program", selectedProgram.id, "archived")}
                      className="text-[11px] font-bold text-muted-fg disabled:opacity-40"
                    >
                      Archivar
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => openCreate("course")}
                    disabled={!selectedProgram || saving}
                    className="rounded-lg bg-decom-blue px-4 py-2.5 text-xs font-bold text-white disabled:opacity-40"
                  >
                    ＋ Nuevo curso
                  </button>
                </div>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_170px]">
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar curso..."
                  className="rounded-xl border border-line px-3 py-2.5 text-sm outline-none focus:border-decom-blue"
                />
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
                  className="rounded-xl border border-line bg-surface px-3 py-2.5 text-xs"
                >
                  <option>Todos</option>
                  <option>Borrador</option>
                  <option>Publicado</option>
                  <option>Archivado</option>
                </select>
              </div>
              <div className="mt-4 space-y-2">
                {filteredCourses.map((course) => (
                  <div
                    key={course.id}
                    className={`rounded-xl border p-3 ${selectedCourse?.id === course.id ? "border-decom-blue/50 bg-decom-blue/5" : "border-line-soft"}`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCourseId(course.id);
                          setSelectedModuleId(course.modules[0]?.id ?? "");
                        }}
                        className="min-w-0 flex-1 text-left"
                      >
                        <span className="block text-sm font-bold">{course.title}</span>
                        <span className="mt-1 block text-xs text-muted-fg">
                          {course.description || "Sin descripción"} · {course.modules.length}{" "}
                          módulos
                        </span>
                      </button>
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${statusClasses(course.status)}`}
                        >
                          {statusLabel(course.status)}
                        </span>
                        <button
                          type="button"
                          onClick={() => openEdit("course", course)}
                          className="text-[11px] font-bold text-decom-blue-text"
                        >
                          Editar
                        </button>
                        {isNationalAdmin && course.status === "draft" && (
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => void changeStatus("course", course.id, "published")}
                            className="text-[11px] font-bold text-decom-blue-text disabled:opacity-40"
                          >
                            Publicar
                          </button>
                        )}
                        {isNationalAdmin && course.status === "published" && (
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => void changeStatus("course", course.id, "archived")}
                            className="text-[11px] font-bold text-muted-fg disabled:opacity-40"
                          >
                            Archivar
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {filteredCourses.length === 0 && (
                  <p className="rounded-xl border border-dashed border-line py-8 text-center text-sm text-muted-fg">
                    No hay cursos para los filtros seleccionados.
                  </p>
                )}
              </div>
            </section>
            <section className="rounded-2xl border border-line bg-surface p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-decom-teal-text">
                    Estructura del curso
                  </p>
                  <h2 className="mt-1 text-lg font-extrabold">
                    {selectedCourse?.title ?? "Selecciona un curso"}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => openCreate("module")}
                  disabled={!selectedCourse || saving}
                  className="rounded-lg border border-decom-blue/30 px-4 py-2.5 text-xs font-bold text-decom-blue-text disabled:opacity-40"
                >
                  ＋ Nuevo módulo
                </button>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {(selectedCourse?.modules ?? []).map((module, index) => (
                  <article
                    key={module.id}
                    className={`rounded-xl border p-4 ${selectedModule?.id === module.id ? "border-decom-teal bg-teal-50/40" : "border-line-soft"}`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedModuleId(module.id)}
                      className="flex w-full items-center justify-between text-left"
                    >
                      <span className="text-sm font-bold">
                        {index + 1}. {module.title}
                      </span>
                      <span className="text-[10px] text-muted-fg">
                        {module.lessons.length} lecciones
                      </span>
                    </button>
                    <div className="mt-2 flex items-center justify-between">
                      <span
                        className={`rounded-full px-2 py-1 text-[10px] font-bold ${statusClasses(module.status)}`}
                      >
                        {statusLabel(module.status)}
                      </span>
                      <button
                        type="button"
                        onClick={() => openEdit("module", module)}
                        className="text-[10px] font-bold text-decom-blue-text"
                      >
                        Editar
                      </button>
                      {isNationalAdmin && module.status === "draft" && (
                        <button
                          type="button"
                          disabled={
                            saving ||
                            !module.lessons.some((lesson) => lesson.status === "published")
                          }
                          onClick={() => void changeStatus("module", module.id, "published")}
                          className="text-[10px] font-bold text-decom-blue-text disabled:opacity-40"
                        >
                          Publicar módulo
                        </button>
                      )}
                    </div>
                    <div className="mt-3 space-y-2">
                      {module.lessons.map((lesson, lessonIndex) => (
                        <div
                          key={lesson.id}
                          className="flex items-center justify-between gap-2 rounded-lg bg-surface-muted px-3 py-2"
                        >
                          <div className="min-w-0">
                            <span className="block text-xs text-muted-fg">
                              {lessonIndex + 1}. {lesson.title}
                            </span>
                            <span className="text-[10px] text-muted-fg">
                              {lesson.duration ?? "—"} min · {statusLabel(lesson.status)}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => openEdit("lesson", lesson)}
                            className="shrink-0 text-[10px] font-bold text-decom-blue-text"
                          >
                            Editar
                          </button>
                          {isNationalAdmin && lesson.status === "draft" && (
                            <button
                              type="button"
                              disabled={saving || !String(lesson.content.markdown ?? "").trim()}
                              onClick={() => void changeStatus("lesson", lesson.id, "published")}
                              className="shrink-0 text-[10px] font-bold text-decom-blue-text disabled:opacity-40"
                            >
                              Publicar
                            </button>
                          )}
                        </div>
                      ))}
                      {module.lessons.length === 0 && (
                        <p className="text-xs text-muted-fg">Aún no hay lecciones.</p>
                      )}
                    </div>
                  </article>
                ))}
                {!selectedCourse && (
                  <p className="text-sm text-muted-fg">
                    Selecciona un curso para administrar su estructura.
                  </p>
                )}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => openCreate("lesson")}
                  disabled={!selectedModule || saving}
                  className="rounded-lg bg-decom-blue px-4 py-2.5 text-xs font-bold text-white disabled:opacity-40 hover:bg-decom-blue-hover"
                >
                  ＋ Añadir lección al módulo seleccionado
                </button>
                <span className="self-center text-[11px] text-muted-fg">
                  {selectedModule ? `Módulo: ${selectedModule.title}` : "Selecciona un módulo"}
                </span>
              </div>
            </section>
          </div>
        </section>
        {loadingCatalog && (
          <p className="mt-4 text-center text-xs text-muted-fg">
            Sincronizando catálogo con Supabase...
          </p>
        )}
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-0 backdrop-blur-sm sm:items-center sm:p-5">
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="catalog-form-title"
              className="w-full max-w-xl rounded-t-3xl bg-surface p-5 shadow-2xl sm:rounded-3xl sm:p-7"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-decom-teal-text">
                    Estructura académica
                  </p>
                  <h2 id="catalog-form-title" className="mt-1 text-xl font-extrabold">
                    {editingId ? "Editar" : "Nuevo"}{" "}
                    {level === "program"
                      ? "programa"
                      : level === "course"
                        ? "curso"
                        : level === "module"
                          ? "módulo"
                          : "lección"}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  aria-label="Cerrar"
                  className="rounded-lg border border-line px-3 py-2 text-muted-fg"
                >
                  ✕
                </button>
              </div>
              <form onSubmit={saveItem} className="mt-5 space-y-4">
                <label className="block text-xs font-semibold text-muted-fg">
                  Nombre
                  <input
                    autoFocus
                    required
                    maxLength={160}
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-line px-3 py-3 text-sm outline-none focus:border-decom-blue"
                    placeholder={
                      level === "lesson"
                        ? "Ej. Introducción y objetivos"
                        : "Escribe un nombre descriptivo"
                    }
                  />
                </label>
                {(level === "program" || level === "course" || level === "module") && (
                  <label className="block text-xs font-semibold text-muted-fg">
                    Descripción
                    <textarea
                      rows={3}
                      maxLength={500}
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-line px-3 py-3 text-sm outline-none focus:border-decom-blue"
                      placeholder="Propósito y alcance formativo."
                    />
                  </label>
                )}
                {level === "lesson" && (
                  <>
                    <label className="block text-xs font-semibold text-muted-fg">
                      Resumen
                      <textarea
                        rows={2}
                        maxLength={500}
                        value={description}
                        onChange={(event) => setDescription(event.target.value)}
                        className="mt-1.5 w-full rounded-xl border border-line px-3 py-3 text-sm"
                        placeholder="Breve descripción de la lección."
                      />
                    </label>
                    <label className="block text-xs font-semibold text-muted-fg">
                      Objetivos de aprendizaje{" "}
                      <span className="font-normal text-muted-fg">(uno por línea)</span>
                      <textarea
                        rows={3}
                        maxLength={3000}
                        value={lessonObjectives}
                        onChange={(event) => setLessonObjectives(event.target.value)}
                        className="mt-1.5 w-full rounded-xl border border-line px-3 py-3 text-sm"
                        placeholder="Identificar el propósito del DECOM.\nReconocer su relación con la misión."
                      />
                    </label>
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <label className="text-xs font-semibold text-muted-fg">
                          Contenido de la lección{" "}
                          <span className="font-normal text-muted-fg">(Markdown)</span>
                        </label>
                        <div className="flex items-center gap-2">
                          <label className="cursor-pointer rounded-lg border border-line px-3 py-2 text-[11px] font-bold text-decom-blue-text">
                            {importingLessonFile ? "Importando..." : "Importar .md / .txt"}
                            <input
                              type="file"
                              accept=".md,.markdown,.txt,text/markdown,text/plain"
                              onChange={(event) => void handleLessonFileChange(event)}
                              disabled={importingLessonFile}
                              className="hidden"
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() => setShowLessonPreview((value) => !value)}
                            className="rounded-lg border border-line px-3 py-2 text-[11px] font-bold text-muted-fg"
                          >
                            {showLessonPreview ? "Editar texto" : "Vista previa"}
                          </button>
                        </div>
                      </div>
                      {showLessonPreview ? (
                        <div className="min-h-40 max-h-72 overflow-auto rounded-xl border border-line bg-surface-muted p-4">
                          <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-6 text-foreground">
                            {lessonContent || "Todavía no hay contenido para previsualizar."}
                          </pre>
                        </div>
                      ) : (
                        <textarea
                          rows={10}
                          value={lessonContent}
                          onChange={(event) => setLessonContent(event.target.value)}
                          className="w-full rounded-xl border border-line px-3 py-3 font-mono text-sm leading-6"
                          placeholder="# Título de la lección\n\nDesarrolla aquí el contenido formativo..."
                        />
                      )}
                      <p className="text-[10px] leading-5 text-muted-fg">
                        Importación inicial limitada a Markdown y texto plano de hasta 2 MB. Los
                        PDF, documentos, presentaciones, imágenes y videos requerirán una carga
                        segura a Supabase Storage.
                      </p>
                    </div>
                    <label className="block text-xs font-semibold text-muted-fg">
                      Duración estimada (minutos)
                      <input
                        required
                        type="number"
                        min="1"
                        max="600"
                        value={duration}
                        onChange={(event) => setDuration(event.target.value)}
                        className="mt-1.5 w-full rounded-xl border border-line px-3 py-3 text-sm"
                      />
                    </label>
                  </>
                )}
                <div className="flex flex-col-reverse justify-end gap-2 border-t border-line-soft pt-4 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="rounded-xl border border-line px-5 py-3 text-xs font-bold text-muted-fg"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-xl bg-decom-blue px-5 py-3 text-xs font-bold text-white disabled:opacity-50"
                  >
                    {saving ? "Guardando..." : editingId ? "Guardar cambios" : "Crear borrador"}
                  </button>
                </div>
              </form>
            </section>
          </div>
        )}
        <footer className="mt-8 border-t border-line py-5 text-center text-[11px] text-muted-fg">
          Academia DECOM · Catálogo curricular · Datos persistentes en Supabase
        </footer>
      </div>
    </main>
  );
}
