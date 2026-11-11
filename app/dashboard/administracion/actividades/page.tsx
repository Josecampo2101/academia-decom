"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type ContentKind = "Actividad" | "Evaluación";
type EditorialStatus = "Borrador" | "Publicado" | "Archivado";
type QuestionType = "Selección única" | "Selección múltiple" | "Verdadero o falso" | "Respuesta corta";
type Question = { id: string; prompt: string; type: QuestionType; options: string[]; correctOptions: string[] };
type AcademicItem = { id: string; title: string; kind: ContentKind; course: string; module: string; instructions: string; status: EditorialStatus; responseType: string; dueDate: string; questions: Question[]; updatedAt: string };

const initialItems: AcademicItem[] = [
  { id: "act-01", title: "Aplicación de la identidad visual", kind: "Actividad", course: "Identidad corporativa DECOM", module: "Módulo 2 · Identidad institucional", instructions: "Analiza una pieza institucional e identifica los elementos que deben ajustarse a los lineamientos de identidad.", status: "Publicado", responseType: "Archivo adjunto", dueDate: "", questions: [], updatedAt: "10 nov 2026" },
  { id: "eval-01", title: "Comprobación de fundamentos", kind: "Evaluación", course: "Fundamentos de la comunicación", module: "Módulo 1 · Bases de la comunicación", instructions: "Responde las preguntas para comprobar la comprensión de los conceptos fundamentales.", status: "Borrador", responseType: "Calificación automática", dueDate: "", questions: [{ id: "q-1", prompt: "¿Qué debe orientar la elección del medio?", type: "Selección única", options: ["El propósito y el público", "La preferencia personal", "La tendencia del momento"], correctOptions: ["El propósito y el público"] }, { id: "q-2", prompt: "La identidad institucional se limita al logotipo.", type: "Verdadero o falso", options: ["Verdadero", "Falso"], correctOptions: ["Falso"] }], updatedAt: "11 nov 2026" },
  { id: "act-02", title: "Reflexión: comunicar con propósito", kind: "Actividad", course: "Identidad corporativa DECOM", module: "Módulo 1 · Conociendo DECOM", instructions: "Explica cómo se relacionan el propósito, el público y el medio en una comunicación institucional.", status: "Borrador", responseType: "Respuesta escrita", dueDate: "", questions: [], updatedAt: "11 nov 2026" },
];

const emptyQuestion = (): Question => ({ id: `q-${Date.now()}-${Math.random().toString(16).slice(2)}`, prompt: "", type: "Selección única", options: ["", ""], correctOptions: [] });

export default function AcademicActivitiesAdminPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [access, setAccess] = useState<"checking" | "allowed" | "denied" | "error">("checking");
  const [items, setItems] = useState(initialItems);
  const [kindFilter, setKindFilter] = useState<"Todos" | ContentKind>("Todos");
  const [statusFilter, setStatusFilter] = useState<"Todos" | EditorialStatus>("Todos");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [kind, setKind] = useState<ContentKind>("Actividad");
  const [title, setTitle] = useState("");
  const [course, setCourse] = useState("Identidad corporativa DECOM");
  const [module, setModule] = useState("");
  const [instructions, setInstructions] = useState("");
  const [responseType, setResponseType] = useState("Respuesta escrita");
  const [dueDate, setDueDate] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [notice, setNotice] = useState("Espacio de autoría de demostración: no guarda información institucional.");
  const [noticeError, setNoticeError] = useState(false);

  useEffect(() => {
    let active = true;
    async function verifyAccess() {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (!active) return;
        if (authError || !user) { router.replace("/conexion"); return; }
        const { data: assignments, error: assignmentError } = await supabase.from("user_role_assignments").select("role_id").eq("user_id", user.id);
        if (assignmentError) throw assignmentError;
        const ids = [...new Set((assignments ?? []).map((item) => item.role_id))];
        if (!ids.length) { setAccess("denied"); return; }
        const { data: roles, error: rolesError } = await supabase.from("roles").select("role_key").in("id", ids);
        if (rolesError) throw rolesError;
        if (!active) return;
        const keys = (roles ?? []).map((role) => role.role_key);
        setAccess(keys.includes("national_admin") || keys.includes("academic_editor") ? "allowed" : "denied");
      } catch (error) {
        console.error("Error verificando acceso al espacio de autoría:", error);
        if (active) setAccess("error");
      }
    }
    void verifyAccess();
    return () => { active = false; };
  }, [router, supabase]);

  const filteredItems = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase("es");
    return items.filter((item) => (!normalized || [item.title, item.course, item.module].some((value) => value.toLocaleLowerCase("es").includes(normalized))) && (kindFilter === "Todos" || item.kind === kindFilter) && (statusFilter === "Todos" || item.status === statusFilter));
  }, [items, search, kindFilter, statusFilter]);

  const stats = { total: items.length, activities: items.filter((item) => item.kind === "Actividad").length, assessments: items.filter((item) => item.kind === "Evaluación").length, published: items.filter((item) => item.status === "Publicado").length };

  function resetForm(nextKind: ContentKind) {
    setPreviewOpen(false); setEditingId(null); setKind(nextKind); setTitle(""); setCourse("Identidad corporativa DECOM"); setModule(""); setInstructions(""); setResponseType(nextKind === "Actividad" ? "Respuesta escrita" : "Calificación automática"); setDueDate(""); setQuestions(nextKind === "Evaluación" ? [emptyQuestion()] : []); setShowForm(true);
  }

  function editItem(item: AcademicItem) {
    setPreviewOpen(false); setEditingId(item.id); setKind(item.kind); setTitle(item.title); setCourse(item.course); setModule(item.module); setInstructions(item.instructions); setResponseType(item.responseType); setDueDate(item.dueDate); setQuestions(item.questions.map((question) => ({ ...question, options: [...question.options], correctOptions: [...(question.correctOptions ?? [])] }))); setShowForm(true);
  }

  function updateQuestion(id: string, patch: Partial<Question>) {
    setQuestions((current) => current.map((question) => question.id === id ? { ...question, ...patch } : question));
  }

  function saveItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanTitle = title.trim();
    const cleanInstructions = instructions.trim();
    if (!cleanTitle || cleanInstructions.length < 12) {
      setNotice("Completa el título y escribe instrucciones de al menos 12 caracteres.");
      setNoticeError(true);
      return;
    }
    const hasInvalidQuestion = questions.some((question) => {
      if (!question.prompt.trim()) return true;
      if (question.type === "Respuesta corta") return false;
      const options = question.options.map((option) => option.trim()).filter(Boolean);
      const validCorrectOptions = question.correctOptions.filter((correct) =>
        options.includes(correct.trim()),
      );
      return (
        options.length < 2 ||
        options.length !== question.options.length ||
        validCorrectOptions.length === 0 ||
        validCorrectOptions.length !== question.correctOptions.length ||
        (question.type !== "Selección múltiple" && validCorrectOptions.length !== 1)
      );
    });
    if (kind === "Evaluación" && (!questions.length || hasInvalidQuestion)) {
      setNotice("Cada pregunta debe tener enunciado, al menos dos opciones completas y una clave correcta que coincida con las opciones actuales. Solo la selección múltiple admite varias respuestas correctas.");
      setNoticeError(true);
      return;
    }
    const normalizedQuestions = questions.map((question) => ({ ...question, prompt: question.prompt.trim(), options: question.options.map((option) => option.trim()).filter(Boolean), correctOptions: question.correctOptions.filter((option) => question.options.includes(option)) }));
    if (editingId) {
      setItems((current) => current.map((item) => item.id === editingId ? { ...item, title: cleanTitle, kind, course, module: module.trim(), instructions: cleanInstructions, responseType, dueDate, questions: normalizedQuestions, updatedAt: "11 nov 2026" } : item));
    } else {
      setItems((current) => [{ id: `item-${Date.now()}`, title: cleanTitle, kind, course, module: module.trim(), instructions: cleanInstructions, status: "Borrador", responseType, dueDate, questions: normalizedQuestions, updatedAt: "11 nov 2026" }, ...current]);
    }
    setShowForm(false);
    setNotice(editingId ? "Los cambios se guardaron en la demostración." : "El contenido se creó como borrador local.");
    setNoticeError(false);
  }

  function changeStatus(id: string, status: EditorialStatus) {
    setItems((current) => current.map((item) => item.id === id ? { ...item, status, updatedAt: "11 nov 2026" } : item));
    setNotice(`El contenido ahora está en estado ${status.toLocaleLowerCase("es")} (cambio local).`);
    setNoticeError(false);
  }

  if (access === "checking") return <main className="flex min-h-screen items-center justify-center bg-[#F4F7FA] text-sm text-slate-500">Verificando permisos...</main>;
  if (access !== "allowed") return <main className="flex min-h-screen items-center justify-center bg-[#F4F7FA] px-5"><section className="max-w-md rounded-2xl border border-slate-200 bg-white p-7 text-center"><h1 className="text-xl font-extrabold text-[#102D4D]">{access === "error" ? "No fue posible verificar el acceso" : "Acceso restringido"}</h1><p className="mt-2 text-sm text-slate-500">{access === "error" ? "Ocurrió un error al consultar tus permisos." : "Este módulo está disponible para Administración nacional y Editor académico."}</p><button type="button" onClick={() => router.replace("/dashboard")} className="mt-5 rounded-xl bg-[#087DB5] px-5 py-3 text-xs font-bold text-white">Volver al panel</button></section></main>;

  return (
    <main className="min-h-screen bg-[#F4F7FA] px-4 py-7 text-[#102D4D] sm:px-7 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <a href="/dashboard" className="text-xs font-semibold text-[#087DB5] hover:underline">← Volver al panel</a>
        <header className="mt-5 flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#19A7A0]">Diseño de experiencias de aprendizaje</p><h1 className="mt-2 text-2xl font-extrabold md:text-3xl">Actividades y evaluaciones</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Prepara instrucciones, formatos de entrega y preguntas antes de publicar el contenido a los estudiantes.</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => resetForm("Actividad")} className="rounded-xl border border-[#087DB5]/30 bg-white px-4 py-3 text-xs font-bold text-[#087DB5]">＋ Actividad</button><button type="button" onClick={() => resetForm("Evaluación")} className="rounded-xl bg-[#087DB5] px-4 py-3 text-xs font-bold text-white">＋ Evaluación</button></div></header>
        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900"><strong>Entorno de demostración.</strong> Las actividades, evaluaciones y cambios son locales. No se asignan ni se califican entregas reales.</div>
        {notice && <div role="status" className={`mt-4 rounded-xl border px-4 py-3 text-xs ${noticeError ? "border-red-200 bg-red-50 text-red-700" : "border-teal-200 bg-teal-50 text-teal-800"}`}>{notice}</div>}
        <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[["Contenidos",stats.total],["Actividades",stats.activities],["Evaluaciones",stats.assessments],["Publicados",stats.published]].map(([label,value])=><article key={label} className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold text-slate-400">{label}</p><p className="mt-2 text-2xl font-extrabold">{value}</p></article>)}</section>
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 md:p-6">
          <div className="grid gap-3 md:grid-cols-[1fr_170px_170px]"><input value={search} onChange={(event)=>setSearch(event.target.value)} placeholder="Buscar por título, curso o módulo..." className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#087DB5]"/><select value={kindFilter} onChange={(event)=>setKindFilter(event.target.value as typeof kindFilter)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs"><option>Todos</option><option>Actividad</option><option>Evaluación</option></select><select value={statusFilter} onChange={(event)=>setStatusFilter(event.target.value as typeof statusFilter)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs"><option>Todos</option><option>Borrador</option><option>Publicado</option><option>Archivado</option></select></div>
          <div className="mt-5 space-y-3">{filteredItems.map((item)=><article key={item.id} className="rounded-xl border border-slate-100 p-4"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-sky-50 px-2.5 py-1 text-[10px] font-bold text-sky-800">{item.kind}</span><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${item.status === "Publicado" ? "bg-teal-50 text-teal-700" : item.status === "Borrador" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-500"}`}>{item.status}</span></div><h2 className="mt-2 text-sm font-bold">{item.title}</h2><p className="mt-1 text-xs text-slate-500">{item.course}{item.module ? ` · ${item.module}` : ""}</p><p className="mt-2 max-w-3xl text-xs leading-5 text-slate-400">{item.instructions}</p><p className="mt-2 text-[10px] text-slate-400">{item.kind === "Evaluación" ? `${item.questions.length} preguntas · ${item.responseType}` : item.responseType} · Actualizado {item.updatedAt}</p></div><div className="flex shrink-0 flex-wrap gap-2"><button type="button" onClick={()=>editItem(item)} className="rounded-lg border border-slate-200 px-3 py-2 text-[11px] font-semibold text-slate-600">Editar</button>{item.status === "Borrador" && <button type="button" onClick={()=>changeStatus(item.id,"Publicado")} className="rounded-lg bg-[#087DB5] px-3 py-2 text-[11px] font-bold text-white">Publicar</button>}{item.status === "Publicado" && <button type="button" onClick={()=>changeStatus(item.id,"Archivado")} className="rounded-lg border border-slate-200 px-3 py-2 text-[11px] font-semibold text-slate-600">Archivar</button>}{item.status === "Archivado" && <button type="button" onClick={()=>changeStatus(item.id,"Borrador")} className="rounded-lg border border-slate-200 px-3 py-2 text-[11px] font-semibold text-slate-600">Restaurar</button>}</div></div></article>)}{filteredItems.length === 0 && <p className="py-12 text-center text-sm text-slate-400">No hay contenidos que coincidan con los filtros.</p>}</div>
        </section>
        {showForm && <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-0 backdrop-blur-sm sm:items-center sm:p-5"><section role="dialog" aria-modal="true" aria-labelledby="authoring-title" className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-7"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-wider text-[#19A7A0]">Editor académico</p><h2 id="authoring-title" className="mt-1 text-xl font-extrabold">{editingId ? "Editar" : "Crear"} {kind.toLocaleLowerCase("es")}</h2></div><div className="flex gap-2"><button type="button" onClick={()=>setPreviewOpen(true)} className="rounded-lg border border-[#087DB5]/30 px-3 py-2 text-[11px] font-bold text-[#087DB5]">Vista previa</button><button type="button" onClick={()=>setShowForm(false)} aria-label="Cerrar editor" className="rounded-lg border border-slate-200 px-3 py-2 text-slate-500">✕</button></div></div><form onSubmit={saveItem} className="mt-5 space-y-4"><label className="block text-xs font-semibold text-slate-600">Título<input required maxLength={160} value={title} onChange={(event)=>setTitle(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm" placeholder="Nombre de la actividad o evaluación"/></label><div className="grid gap-4 sm:grid-cols-2"><label className="block text-xs font-semibold text-slate-600">Curso<input required value={course} onChange={(event)=>setCourse(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm"/></label><label className="block text-xs font-semibold text-slate-600">Módulo<input value={module} onChange={(event)=>setModule(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm" placeholder="Módulo o unidad curricular"/></label></div><label className="block text-xs font-semibold text-slate-600">Instrucciones<textarea required minLength={12} maxLength={1800} rows={4} value={instructions} onChange={(event)=>setInstructions(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm" placeholder="Explica el propósito, los pasos y los criterios de realización."/></label><div className="grid gap-4 sm:grid-cols-2"><label className="block text-xs font-semibold text-slate-600">Formato de respuesta<select value={responseType} onChange={(event)=>setResponseType(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm">{(kind === "Actividad" ? ["Respuesta escrita","Archivo adjunto","Enlace externo","Evidencia audiovisual"] : ["Calificación automática","Revisión del tutor","Evaluación mixta"]).map((option)=><option key={option}>{option}</option>)}</select></label><label className="block text-xs font-semibold text-slate-600">Fecha límite (opcional)<input type="date" value={dueDate} onChange={(event)=>setDueDate(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm"/></label></div>
          {kind === "Evaluación" && <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="text-sm font-bold">Banco de preguntas</h3><p className="mt-1 text-[11px] text-slate-500">Define las opciones y marca la clave correcta. Esta clave permanece solo en el editor de demostración.</p></div><button type="button" onClick={()=>setQuestions((current)=>[...current,emptyQuestion()])} className="rounded-lg border border-[#087DB5]/30 bg-white px-3 py-2 text-[11px] font-bold text-[#087DB5]">＋ Pregunta</button></div><div className="mt-4 space-y-3">{questions.map((question,index)=><article key={question.id} className="rounded-xl border border-slate-200 bg-white p-3"><div className="flex items-center justify-between gap-2"><span className="text-xs font-bold">Pregunta {index+1}</span><button type="button" onClick={()=>setQuestions((current)=>current.filter((item)=>item.id!==question.id))} className="text-[11px] font-semibold text-red-600">Eliminar</button></div><input required value={question.prompt} onChange={(event)=>updateQuestion(question.id,{prompt:event.target.value})} placeholder="Escribe el enunciado" className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-xs"/><select value={question.type} onChange={(event)=>updateQuestion(question.id,{type:event.target.value as QuestionType,options:event.target.value === "Verdadero o falso" ? ["Verdadero","Falso"] : event.target.value === "Respuesta corta" ? [] : ["",""],correctOptions:[]})} className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs"><option>Selección única</option><option>Selección múltiple</option><option>Verdadero o falso</option><option>Respuesta corta</option></select>{question.type !== "Respuesta corta" && <div className="mt-2 grid gap-2 sm:grid-cols-2">{question.options.map((option,optionIndex)=><input key={optionIndex} required value={option} onChange={(event)=>updateQuestion(question.id,{options:question.options.map((item,i)=>i===optionIndex?event.target.value:item)})} placeholder={`Opción ${optionIndex+1}`} className="rounded-lg border border-slate-200 px-3 py-2.5 text-xs"/>)}</div>}{question.type !== "Respuesta corta" && <fieldset className="mt-3 rounded-lg bg-slate-50 p-3"><legend className="px-1 text-[10px] font-bold text-slate-600">Clave de respuesta correcta</legend><div className="space-y-2">{question.options.map((option,optionIndex)=>option.trim() ? <label key={optionIndex} className="flex items-center gap-2 text-xs text-slate-600"><input type={question.type === "Selección múltiple" ? "checkbox" : "radio"} name={`correct-${question.id}`} checked={question.correctOptions.includes(option)} onChange={(event)=>updateQuestion(question.id,{correctOptions:question.type === "Selección múltiple" ? (event.target.checked ? [...question.correctOptions,option] : question.correctOptions.filter((item)=>item!==option)) : [option]})}/><span>{option}</span></label> : null)}</div></fieldset>}{question.type !== "Verdadero o falso" && question.type !== "Respuesta corta" && <button type="button" onClick={()=>updateQuestion(question.id,{options:[...question.options,""]})} className="mt-2 text-[10px] font-semibold text-[#087DB5]">＋ Añadir opción</button>}</article>)}</div></section>}
          <div className="flex flex-col-reverse justify-end gap-2 border-t border-slate-100 pt-4 sm:flex-row"><button type="button" onClick={()=>setShowForm(false)} className="rounded-xl border border-slate-200 px-5 py-3 text-xs font-bold text-slate-600">Cancelar</button><button type="submit" className="rounded-xl bg-[#087DB5] px-5 py-3 text-xs font-bold text-white">Guardar borrador</button></div></form></section></div>}
        {previewOpen && <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-950/50 p-0 backdrop-blur-sm sm:items-center sm:p-5"><section role="dialog" aria-modal="true" aria-labelledby="student-preview-title" className="max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-[#F4F7FA] p-5 shadow-2xl sm:rounded-3xl sm:p-7"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-wider text-[#19A7A0]">Experiencia del estudiante · Vista previa</p><h2 id="student-preview-title" className="mt-1 text-xl font-extrabold">{title.trim() || "Contenido sin título"}</h2><p className="mt-1 text-xs text-slate-500">{course}{module ? " · " + module : ""}</p></div><button type="button" onClick={()=>setPreviewOpen(false)} aria-label="Cerrar vista previa" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-500">✕</button></div><div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-2"><span className="rounded-full bg-sky-50 px-3 py-1 text-[10px] font-bold text-sky-800">{kind}</span><span className="text-[10px] text-slate-400">{dueDate ? "Fecha límite: " + dueDate : "Sin fecha límite definida"}</span></div><h3 className="mt-4 text-base font-bold">{title.trim() || "Título de la actividad"}</h3><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">{instructions.trim() || "Aquí aparecerán las instrucciones que recibirá el estudiante."}</p>{kind === "Actividad" ? <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4"><p className="text-xs font-bold text-slate-700">Tu entrega · {responseType}</p>{responseType === "Respuesta escrita" ? <textarea disabled rows={4} placeholder="El estudiante escribirá su respuesta aquí..." className="mt-3 w-full rounded-lg border border-slate-200 bg-white p-3 text-xs" /> : <div className="mt-3 rounded-lg bg-white p-4 text-xs text-slate-400">{responseType === "Archivo adjunto" ? "Zona para adjuntar un archivo" : responseType === "Enlace externo" ? "Campo para compartir un enlace" : "Zona para adjuntar evidencia audiovisual"}</div>}</div> : <div className="mt-5 space-y-4">{questions.map((question,index)=><article key={question.id} className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs font-bold text-slate-400">Pregunta {index+1} · {question.type}</p><h4 className="mt-2 text-sm font-semibold text-slate-800">{question.prompt || "Enunciado de la pregunta"}</h4>{question.type === "Respuesta corta" ? <input disabled placeholder="Escribe tu respuesta..." className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-xs" /> : <div className="mt-3 space-y-2">{question.options.filter((option)=>option.trim()).map((option,optionIndex)=><label key={question.id + "-" + optionIndex} className="flex items-center gap-2 rounded-lg border border-slate-100 p-3 text-xs text-slate-600"><input disabled type={question.type === "Selección múltiple" ? "checkbox" : "radio"} name={"student-preview-" + question.id} /><span>{option}</span></label>)}</div>}</article>)}{questions.length===0 && <p className="rounded-xl border border-dashed border-slate-300 p-5 text-center text-xs text-slate-400">Aún no hay preguntas para mostrar.</p>}</div>}<p className="mt-5 text-[10px] leading-5 text-slate-400">Vista de demostración. No envía respuestas ni muestra claves correctas, puntajes o retroalimentación privada.</p></div><div className="mt-4 flex justify-end"><button type="button" onClick={()=>setPreviewOpen(false)} className="rounded-xl bg-[#087DB5] px-5 py-3 text-xs font-bold text-white">Volver al editor</button></div></section></div>}
        <footer className="mt-8 border-t border-slate-200 py-5 text-center text-[11px] text-slate-400">Academia DECOM · Autoría académica · Interfaz de demostración</footer>
      </div>
    </main>
  );
}
