"use client";

import { useMemo, useState, type FormEvent } from "react";

type Lesson = { id: string; title: string; duration: number; status: "Borrador" | "Publicado" };
type Module = { id: string; title: string; lessons: Lesson[] };
type Course = { id: string; title: string; description: string; status: "Borrador" | "Publicado" | "Archivado"; modules: Module[] };
type Program = { id: string; title: string; description: string; courses: Course[] };

const initialPrograms: Program[] = [
  { id: "prog-1", title: "Comunicación institucional", description: "Fundamentos y prácticas para comunicar con propósito.", courses: [
    { id: "course-1", title: "Fundamentos de la comunicación", description: "Principios, públicos y propósito del mensaje.", status: "Publicado", modules: [
      { id: "module-1", title: "Bases de la comunicación", lessons: [
        { id: "lesson-1", title: "Comunicación y propósito", duration: 18, status: "Publicado" },
        { id: "lesson-2", title: "Audiencias y contexto", duration: 22, status: "Publicado" },
      ] },
      { id: "module-2", title: "Planeación del mensaje", lessons: [
        { id: "lesson-3", title: "Objetivos comunicativos", duration: 16, status: "Borrador" },
      ] },
    ] },
    { id: "course-2", title: "Redacción para medios", description: "Criterios editoriales y escritura clara.", status: "Borrador", modules: [
      { id: "module-3", title: "Escritura y edición", lessons: [] },
    ] },
  ] },
  { id: "prog-2", title: "Producción de medios", description: "Herramientas para contenidos audiovisuales y digitales.", courses: [
    { id: "course-3", title: "Producción audiovisual", description: "Narrativa, planeación y producción.", status: "Borrador", modules: [] },
  ] },
];

type Level = "program" | "course" | "module" | "lesson";

export default function AcademicCatalogPage() {
  const [programs, setPrograms] = useState(initialPrograms);
  const [selectedProgramId, setSelectedProgramId] = useState("prog-1");
  const [selectedCourseId, setSelectedCourseId] = useState("course-1");
  const [selectedModuleId, setSelectedModuleId] = useState("module-1");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [showForm, setShowForm] = useState(false);
  const [level, setLevel] = useState<Level>("course");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState("15");
  const [notice, setNotice] = useState("Catálogo de demostración: los cambios se conservan únicamente en esta sesión.");
  const [noticeError, setNoticeError] = useState(false);

  const selectedProgram = programs.find((item) => item.id === selectedProgramId) ?? programs[0];
  const selectedCourse = selectedProgram?.courses.find((item) => item.id === selectedCourseId) ?? selectedProgram?.courses[0];
  const selectedModule = selectedCourse?.modules.find((item) => item.id === selectedModuleId) ?? selectedCourse?.modules[0];

  const counts = useMemo(() => {
    const courses = programs.flatMap((program) => program.courses);
    const modules = courses.flatMap((course) => course.modules);
    const lessons = modules.flatMap((module) => module.lessons);
    return { programs: programs.length, courses: courses.length, modules: modules.length, lessons: lessons.length, published: courses.filter((course) => course.status === "Publicado").length };
  }, [programs]);

  const filteredCourses = (selectedProgram?.courses ?? []).filter((course) => {
    const matchesSearch = `${course.title} ${course.description}`.toLocaleLowerCase("es").includes(search.toLocaleLowerCase("es"));
    return matchesSearch && (statusFilter === "Todos" || course.status === statusFilter);
  });

  function openCreate(nextLevel: Level) {
    setLevel(nextLevel);
    setTitle("");
    setDescription("");
    setDuration("15");
    setShowForm(true);
  }

  function saveItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) return;
    const id = `${level}-${Date.now()}`;
    setPrograms((current) => current.map((program) => {
      if (level === "program") return { ...program, courses: program.courses };
      if (program.id !== selectedProgramId) return program;
      if (level === "course") return { ...program, courses: [...program.courses, { id, title: cleanTitle, description: description.trim(), status: "Borrador", modules: [] }] };
      return { ...program, courses: program.courses.map((course) => {
        if (course.id !== selectedCourseId) return course;
        if (level === "module") return { ...course, modules: [...course.modules, { id, title: cleanTitle, lessons: [] }] };
        return { ...course, modules: course.modules.map((module) => module.id === selectedModuleId ? { ...module, lessons: [...module.lessons, { id, title: cleanTitle, duration: Math.max(1, Number(duration) || 15), status: "Borrador" }] } : module) };
      }) };
    }));
    if (level === "program") {
      setPrograms((current) => [...current, { id, title: cleanTitle, description: description.trim(), courses: [] }]);
      setSelectedProgramId(id);
    }
    if (level === "course") setSelectedCourseId(id);
    if (level === "module") setSelectedModuleId(id);
    setShowForm(false);
    setNotice(`“${cleanTitle}” se añadió como borrador local.`);
    setNoticeError(false);
  }

  function changeCourseStatus(courseId: string, status: Course["status"]) {
    setPrograms((current) => current.map((program) => program.id !== selectedProgramId ? program : { ...program, courses: program.courses.map((course) => course.id === courseId ? { ...course, status } : course) }));
    setNotice(`El estado del curso cambió a ${status.toLocaleLowerCase("es")} en esta demostración.`);
    setNoticeError(false);
  }

  return (
    <main className="min-h-screen bg-[#F4F7FA] px-4 py-7 text-[#102D4D] sm:px-7 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <a href="/dashboard" className="text-xs font-semibold text-[#087DB5] hover:underline">← Volver al panel</a>
        <header className="mt-5 flex flex-wrap items-end justify-between gap-4">
          <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#19A7A0]">Diseño curricular</p><h1 className="mt-2 text-2xl font-extrabold md:text-3xl">Catálogo académico</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Organiza la oferta formativa desde programas hasta lecciones y prepara su publicación.</p></div>
          <button type="button" onClick={() => openCreate("program")} className="rounded-xl bg-[#087DB5] px-5 py-3 text-sm font-bold text-white hover:bg-[#066b9c]">＋ Nuevo programa</button>
        </header>
        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900"><strong>Entorno de demostración.</strong> No se consulta ni modifica Supabase. Los datos son ficticios y se reinician al recargar.</div>
        {notice && <div role="status" className={`mt-4 rounded-xl border px-4 py-3 text-xs ${noticeError ? "border-red-200 bg-red-50 text-red-700" : "border-teal-200 bg-teal-50 text-teal-800"}`}>{notice}</div>}
        <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {[["Programas", counts.programs], ["Cursos", counts.courses], ["Módulos", counts.modules], ["Lecciones", counts.lessons], ["Cursos publicados", counts.published]].map(([label, value]) => <article key={label} className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold text-slate-400">{label}</p><p className="mt-2 text-2xl font-extrabold">{value}</p></article>)}
        </section>
        <section className="mt-6 grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between"><h2 className="font-bold">Programas</h2><span className="text-xs text-slate-400">{programs.length}</span></div>
            <div className="mt-3 space-y-2">{programs.map((program) => <button type="button" key={program.id} onClick={() => { setSelectedProgramId(program.id); setSelectedCourseId(program.courses[0]?.id ?? ""); setSelectedModuleId(program.courses[0]?.modules[0]?.id ?? ""); }} className={`w-full rounded-xl border p-3 text-left transition ${selectedProgramId === program.id ? "border-[#087DB5] bg-[#087DB5]/5" : "border-slate-100 hover:border-slate-300"}`}><span className="block text-sm font-bold">{program.title}</span><span className="mt-1 block text-[11px] text-slate-400">{program.courses.length} cursos</span></button>)}</div>
            <button type="button" onClick={() => openCreate("program")} className="mt-3 w-full rounded-xl border border-dashed border-[#087DB5]/40 px-3 py-2.5 text-xs font-bold text-[#087DB5]">＋ Agregar programa</button>
          </aside>
          <div className="min-w-0 space-y-5">
            <section className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-wider text-[#19A7A0]">Programa seleccionado</p><h2 className="mt-1 text-xl font-extrabold">{selectedProgram?.title ?? "Selecciona un programa"}</h2><p className="mt-1 text-sm text-slate-500">{selectedProgram?.description}</p></div><button type="button" onClick={() => openCreate("course")} disabled={!selectedProgram} className="rounded-lg bg-[#087DB5] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-40">＋ Nuevo curso</button></div>
              <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_170px]"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar curso..." className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#087DB5]" /><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs"><option>Todos</option><option>Borrador</option><option>Publicado</option><option>Archivado</option></select></div>
              <div className="mt-4 space-y-2">{filteredCourses.map((course) => <div key={course.id} className={`rounded-xl border p-3 ${selectedCourse?.id === course.id ? "border-[#087DB5]/50 bg-[#087DB5]/5" : "border-slate-100"}`}><div className="flex flex-wrap items-center justify-between gap-3"><button type="button" onClick={() => { setSelectedCourseId(course.id); setSelectedModuleId(course.modules[0]?.id ?? ""); }} className="min-w-0 flex-1 text-left"><span className="block text-sm font-bold">{course.title}</span><span className="mt-1 block text-xs text-slate-400">{course.description || "Sin descripción"} · {course.modules.length} módulos</span></button><div className="flex items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${course.status === "Publicado" ? "bg-teal-50 text-teal-700" : course.status === "Borrador" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-500"}`}>{course.status}</span>{course.status === "Borrador" && <button type="button" onClick={() => changeCourseStatus(course.id, "Publicado")} className="text-[11px] font-bold text-[#087DB5]">Publicar</button>}{course.status === "Publicado" && <button type="button" onClick={() => changeCourseStatus(course.id, "Archivado")} className="text-[11px] font-bold text-slate-500">Archivar</button>}</div></div></div>)}
                {filteredCourses.length === 0 && <p className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400">No hay cursos para los filtros seleccionados.</p>}</div>
            </section>
            <section className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-wider text-[#19A7A0]">Estructura del curso</p><h2 className="mt-1 text-lg font-extrabold">{selectedCourse?.title ?? "Selecciona un curso"}</h2></div><button type="button" onClick={() => openCreate("module")} disabled={!selectedCourse} className="rounded-lg border border-[#087DB5]/30 px-4 py-2.5 text-xs font-bold text-[#087DB5] disabled:opacity-40">＋ Nuevo módulo</button></div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">{(selectedCourse?.modules ?? []).map((module, index) => <article key={module.id} className={`rounded-xl border p-4 ${selectedModule?.id === module.id ? "border-[#19A7A0] bg-teal-50/40" : "border-slate-100"}`}><button type="button" onClick={() => setSelectedModuleId(module.id)} className="flex w-full items-center justify-between text-left"><span className="text-sm font-bold">{index + 1}. {module.title}</span><span className="text-[10px] text-slate-400">{module.lessons.length} lecciones</span></button><div className="mt-3 space-y-2">{module.lessons.map((lesson, lessonIndex) => <div key={lesson.id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2"><span className="text-xs text-slate-600">{lessonIndex + 1}. {lesson.title}</span><span className="shrink-0 text-[10px] text-slate-400">{lesson.duration} min · {lesson.status}</span></div>)}{module.lessons.length === 0 && <p className="text-xs text-slate-400">Aún no hay lecciones.</p>}</div></article>)}
                {!selectedCourse && <p className="text-sm text-slate-400">Selecciona un curso para administrar su estructura.</p>}</div>
              <div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => openCreate("lesson")} disabled={!selectedModule} className="rounded-lg bg-[#102D4D] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-40">＋ Añadir lección al módulo seleccionado</button><span className="self-center text-[11px] text-slate-400">{selectedModule ? `Módulo: ${selectedModule.title}` : "Selecciona un módulo"}</span></div>
            </section>
          </div>
        </section>
        {showForm && <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-0 backdrop-blur-sm sm:items-center sm:p-5"><section role="dialog" aria-modal="true" aria-labelledby="catalog-form-title" className="w-full max-w-xl rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-7"><div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-[#19A7A0]">Estructura académica</p><h2 id="catalog-form-title" className="mt-1 text-xl font-extrabold">Nuevo {level === "program" ? "programa" : level === "course" ? "curso" : level === "module" ? "módulo" : "lección"}</h2></div><button type="button" onClick={() => setShowForm(false)} aria-label="Cerrar" className="rounded-lg border border-slate-200 px-3 py-2 text-slate-500">✕</button></div><form onSubmit={saveItem} className="mt-5 space-y-4"><label className="block text-xs font-semibold text-slate-600">Nombre<input autoFocus required maxLength={160} value={title} onChange={(event) => setTitle(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-[#087DB5]" placeholder={level === "lesson" ? "Ej. Introducción y objetivos" : "Escribe un nombre descriptivo"} /></label>{(level === "program" || level === "course") && <label className="block text-xs font-semibold text-slate-600">Descripción<textarea rows={3} maxLength={500} value={description} onChange={(event) => setDescription(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-[#087DB5]" placeholder="Propósito y alcance formativo." /></label>}{level === "lesson" && <label className="block text-xs font-semibold text-slate-600">Duración estimada (minutos)<input type="number" min="1" max="600" value={duration} onChange={(event) => setDuration(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm" /></label>}<div className="flex flex-col-reverse justify-end gap-2 border-t border-slate-100 pt-4 sm:flex-row"><button type="button" onClick={() => setShowForm(false)} className="rounded-xl border border-slate-200 px-5 py-3 text-xs font-bold text-slate-600">Cancelar</button><button type="submit" className="rounded-xl bg-[#087DB5] px-5 py-3 text-xs font-bold text-white">Crear borrador</button></div></form></section></div>}
        <footer className="mt-8 border-t border-slate-200 py-5 text-center text-[11px] text-slate-400">Academia DECOM · Catálogo curricular · Interfaz de demostración</footer>
      </div>
    </main>
  );
}
