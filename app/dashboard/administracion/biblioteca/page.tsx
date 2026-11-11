"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type AccessState = "checking" | "allowed" | "denied" | "error";
type ResourceStatus = "Borrador" | "Publicado" | "Archivado";
type ResourceType = "Documento" | "Guía" | "Plantilla" | "Video" | "Audio" | "Enlace";
type Resource = {
  id: string;
  title: string;
  description: string;
  category: string;
  type: ResourceType;
  course: string;
  version: string;
  status: ResourceStatus;
  updatedAt: string;
  fileName: string;
};

const initialResources: Resource[] = [
  { id: "lib-001", title: "Manual de identidad corporativa DECOM", description: "Lineamientos institucionales, uso de marca, colores y criterios de aplicación.", category: "Identidad institucional", type: "Documento", course: "Identidad corporativa DECOM", version: "1.2", status: "Publicado", updatedAt: "11 nov 2026", fileName: "manual-identidad-decom.pdf" },
  { id: "lib-002", title: "Lista de verificación para piezas gráficas", description: "Puntos de control para revisar coherencia visual antes de publicar.", category: "Diseño y comunicación", type: "Plantilla", course: "Medios digitales", version: "1.0", status: "Publicado", updatedAt: "10 nov 2026", fileName: "checklist-piezas-graficas.docx" },
  { id: "lib-003", title: "Fundamentos de comunicación institucional", description: "Material de apoyo para comprender propósito, audiencia y mensaje.", category: "Comunicación", type: "Guía", course: "Identidad corporativa DECOM", version: "0.3", status: "Borrador", updatedAt: "9 nov 2026", fileName: "fundamentos-comunicacion.pdf" },
  { id: "lib-004", title: "Introducción a la producción audiovisual", description: "Recurso audiovisual introductorio para equipos de medios.", category: "Producción audiovisual", type: "Video", course: "Medios audiovisuales", version: "1.0", status: "Archivado", updatedAt: "2 nov 2026", fileName: "introduccion-produccion.mp4" },
];

const categories = ["Identidad institucional", "Comunicación", "Diseño y comunicación", "Medios escritos", "Medios digitales", "Producción audiovisual", "Fotografía", "Audio e IA", "Otros"];
const courseOptions = ["General", "Identidad corporativa DECOM", "Medios escritos", "Medios digitales", "Medios audiovisuales", "Fotografía", "Audio e IA"];
const types: ResourceType[] = ["Documento", "Guía", "Plantilla", "Video", "Audio", "Enlace"];

const emptyForm = { title: "", description: "", category: categories[0], type: "Documento" as ResourceType, course: "General", version: "1.0", fileName: "" };

export default function LibraryAdministrationPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [access, setAccess] = useState<AccessState>("checking");
  const [resources, setResources] = useState<Resource[]>(initialResources);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"Todos" | ResourceStatus>("Todos");
  const [typeFilter, setTypeFilter] = useState<"Todos" | ResourceType>("Todos");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [notice, setNotice] = useState("");
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
        if (!active) return;
        const ids = [...new Set((assignments ?? []).map((item) => item.role_id))];
        if (!ids.length) { setAccess("denied"); return; }
        const { data: roles, error: rolesError } = await supabase.from("roles").select("role_key").in("id", ids);
        if (rolesError) throw rolesError;
        if (!active) return;
        const keys = (roles ?? []).map((role) => role.role_key);
        setAccess(keys.includes("national_admin") || keys.includes("academic_editor") ? "allowed" : "denied");
      } catch (error) {
        console.error("Error verificando acceso a la biblioteca:", error);
        if (active) setAccess("error");
      }
    }
    void Promise.resolve().then(verifyAccess);
    return () => { active = false; };
  }, [router, supabase]);

  const filteredResources = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("es");
    return resources.filter((resource) => {
      const matchesQuery = !normalized || [resource.title, resource.description, resource.category, resource.course].some((value) => value.toLocaleLowerCase("es").includes(normalized));
      return matchesQuery && (statusFilter === "Todos" || resource.status === statusFilter) && (typeFilter === "Todos" || resource.type === typeFilter);
    });
  }, [query, resources, statusFilter, typeFilter]);

  const counts = useMemo(() => ({
    total: resources.length,
    published: resources.filter((item) => item.status === "Publicado").length,
    drafts: resources.filter((item) => item.status === "Borrador").length,
    archived: resources.filter((item) => item.status === "Archivado").length,
  }), [resources]);

  function startCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
    setNotice("");
  }

  function startEdit(resource: Resource) {
    setEditingId(resource.id);
    setForm({ title: resource.title, description: resource.description, category: resource.category, type: resource.type, course: resource.course, version: resource.version, fileName: resource.fileName });
    setShowForm(true);
    setNotice("");
  }

  function saveResource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = form.title.trim();
    if (!title) { setNotice("El título es obligatorio."); setNoticeError(true); return; }
    if (form.description.trim().length < 12) { setNotice("Añade una descripción de al menos 12 caracteres."); setNoticeError(true); return; }
    const now = new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short", year: "numeric" }).format(new Date());
    if (editingId) {
      setResources((current) => current.map((item) => item.id === editingId ? { ...item, ...form, title, description: form.description.trim(), updatedAt: now } : item));
      setNotice("Cambios guardados en esta demostración.");
    } else {
      setResources((current) => [{ id: "local-" + Date.now(), ...form, title, description: form.description.trim(), status: "Borrador", updatedAt: now }, ...current]);
      setNotice("Recurso creado como borrador en esta demostración.");
    }
    setNoticeError(false);
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  function changeStatus(resource: Resource, status: ResourceStatus) {
    setResources((current) => current.map((item) => item.id === resource.id ? { ...item, status, updatedAt: "11 nov 2026" } : item));
    setNotice(status === "Publicado" ? "Recurso publicado en la vista de demostración." : status === "Archivado" ? "Recurso archivado en la vista de demostración." : "Recurso devuelto a borradores.");
    setNoticeError(false);
  }

  if (access === "checking") return <main className="flex min-h-screen items-center justify-center bg-[#F4F7FA]"><p className="text-sm text-slate-500">Verificando permisos editoriales...</p></main>;
  if (access !== "allowed") return <main className="flex min-h-screen items-center justify-center bg-[#F4F7FA] px-6"><section className="max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center"><h1 className="text-xl font-bold text-[#102D4D]">{access === "error" ? "No pudimos validar tus permisos" : "Acceso restringido"}</h1><p className="mt-2 text-sm text-slate-500">La administración de la Biblioteca está disponible para Administración nacional y Editores académicos.</p><button type="button" onClick={() => router.push("/dashboard")} className="mt-5 rounded-xl bg-[#087DB5] px-5 py-3 text-sm font-semibold text-white">Volver al panel</button></section></main>;

  return <main className="min-h-screen bg-[#F4F7FA] text-[#102D4D]">
    <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 md:px-8"><div><p className="text-xs font-extrabold tracking-[0.14em] text-[#087DB5]">ACADEMIA DECOM</p><p className="mt-1 text-xs text-slate-400">Administración académica</p></div><button type="button" onClick={() => router.push("/dashboard")} className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-600">← Panel principal</button></div></header>
    <div className="mx-auto max-w-7xl space-y-7 px-5 py-7 md:px-8 md:py-9">
      <section className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#19A7A0]">Gestión de contenidos</p><h1 className="mt-2 text-2xl font-extrabold md:text-3xl">Biblioteca académica</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Administra recursos de consulta, clasifícalos y controla su ciclo editorial.</p></div><button type="button" onClick={startCreate} className="rounded-xl bg-[#087DB5] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#066b9c]">＋ Nuevo recurso</button></section>
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900"><strong>Entorno de demostración.</strong> Los recursos y cambios de estado son locales y ficticios. La carga de archivos, publicación, versionado y persistencia reales todavía no están conectados.</div>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><article className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs font-semibold text-slate-400">Recursos en catálogo</p><p className="mt-2 text-3xl font-extrabold">{counts.total}</p></article><article className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs font-semibold text-slate-400">Publicados</p><p className="mt-2 text-3xl font-extrabold text-teal-700">{counts.published}</p></article><article className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs font-semibold text-slate-400">Borradores</p><p className="mt-2 text-3xl font-extrabold text-amber-700">{counts.drafts}</p></article><article className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs font-semibold text-slate-400">Archivados</p><p className="mt-2 text-3xl font-extrabold text-slate-500">{counts.archived}</p></article></section>
      {notice && <div role="status" className={`rounded-xl border px-4 py-3 text-sm ${noticeError ? "border-red-200 bg-red-50 text-red-700" : "border-teal-200 bg-teal-50 text-teal-800"}`}>{notice}</div>}
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center"><label className="min-w-0 flex-1"><span className="sr-only">Buscar recursos</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por título, descripción, categoría o curso..." className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-[#087DB5] focus:ring-2 focus:ring-[#087DB5]/10" /></label><div className="grid grid-cols-2 gap-2 sm:grid-cols-2"><label className="text-xs font-semibold text-slate-500"><span className="mb-1 block">Estado</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-xs"><option>Todos</option><option>Borrador</option><option>Publicado</option><option>Archivado</option></select></label><label className="text-xs font-semibold text-slate-500"><span className="mb-1 block">Tipo</span><select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as typeof typeFilter)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-xs"><option>Todos</option>{types.map((type) => <option key={type}>{type}</option>)}</select></label></div></div>
        <div className="mt-5 flex items-center justify-between gap-3"><h2 className="text-lg font-bold">Catálogo de recursos</h2><span className="text-xs text-slate-400">{filteredResources.length} resultado(s)</span></div>
        <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead><tr className="border-b border-slate-100 text-[10px] uppercase tracking-wider text-slate-400"><th className="px-3 py-3">Recurso</th><th className="px-3 py-3">Clasificación</th><th className="px-3 py-3">Curso</th><th className="px-3 py-3">Versión</th><th className="px-3 py-3">Estado</th><th className="px-3 py-3">Acciones</th></tr></thead><tbody>{filteredResources.map((resource)=><tr key={resource.id} className="border-b border-slate-50 align-top last:border-0"><td className="px-3 py-4"><p className="font-bold text-slate-800">{resource.title}</p><p className="mt-1 max-w-xs text-[11px] leading-5 text-slate-400">{resource.description}</p><p className="mt-1 text-[10px] text-slate-400">{resource.fileName || "Sin archivo adjunto"} · {resource.updatedAt}</p></td><td className="px-3 py-4"><p className="font-semibold text-slate-700">{resource.type}</p><p className="mt-1 text-slate-400">{resource.category}</p></td><td className="px-3 py-4 text-slate-600">{resource.course}</td><td className="px-3 py-4 font-mono text-slate-600">v{resource.version}</td><td className="px-3 py-4"><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${resource.status==="Publicado"?"bg-teal-50 text-teal-700":resource.status==="Borrador"?"bg-amber-50 text-amber-700":"bg-slate-100 text-slate-500"}`}>{resource.status}</span></td><td className="px-3 py-4"><div className="flex flex-wrap gap-2"><button type="button" onClick={()=>startEdit(resource)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 font-semibold text-slate-600 hover:border-[#087DB5] hover:text-[#087DB5]">Editar</button>{resource.status==="Publicado" ? <button type="button" onClick={()=>changeStatus(resource,"Archivado")} className="rounded-lg border border-slate-200 px-2.5 py-1.5 font-semibold text-slate-600">Archivar</button> : resource.status==="Archivado" ? <button type="button" onClick={()=>changeStatus(resource,"Borrador")} className="rounded-lg border border-slate-200 px-2.5 py-1.5 font-semibold text-slate-600">Restaurar</button> : <button type="button" onClick={()=>changeStatus(resource,"Publicado")} className="rounded-lg bg-[#087DB5] px-2.5 py-1.5 font-semibold text-white">Publicar</button>}</div></td></tr>)}</tbody></table>{filteredResources.length===0 && <p className="py-12 text-center text-sm text-slate-400">No hay recursos que coincidan con los filtros.</p>}</div>
      </section>
      {showForm && <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-0 backdrop-blur-sm sm:items-center sm:p-5"><section role="dialog" aria-modal="true" aria-labelledby="resource-form-title" className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-7"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-wider text-[#19A7A0]">Editor de contenidos</p><h2 id="resource-form-title" className="mt-1 text-xl font-extrabold">{editingId ? "Editar recurso" : "Registrar recurso"}</h2></div><button type="button" onClick={()=>setShowForm(false)} aria-label="Cerrar formulario" className="rounded-lg border border-slate-200 px-3 py-2 text-slate-500">✕</button></div><form onSubmit={saveResource} className="mt-6 space-y-4"><label className="block text-xs font-semibold text-slate-600">Título del recurso<input required maxLength={160} value={form.title} onChange={(event)=>setForm((current)=>({...current,title:event.target.value}))} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-[#087DB5]" placeholder="Ej. Guía de producción audiovisual" /></label><label className="block text-xs font-semibold text-slate-600">Descripción<textarea required minLength={12} maxLength={700} rows={3} value={form.description} onChange={(event)=>setForm((current)=>({...current,description:event.target.value}))} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-[#087DB5]" placeholder="Describe el propósito y el contenido del recurso." /></label><div className="grid gap-4 sm:grid-cols-2"><label className="block text-xs font-semibold text-slate-600">Categoría<select value={form.category} onChange={(event)=>setForm((current)=>({...current,category:event.target.value}))} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm">{categories.map((category)=><option key={category}>{category}</option>)}</select></label><label className="block text-xs font-semibold text-slate-600">Tipo de recurso<select value={form.type} onChange={(event)=>setForm((current)=>({...current,type:event.target.value as ResourceType}))} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm">{types.map((type)=><option key={type}>{type}</option>)}</select></label><label className="block text-xs font-semibold text-slate-600">Asociar a curso<select value={form.course} onChange={(event)=>setForm((current)=>({...current,course:event.target.value}))} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm">{courseOptions.map((course)=><option key={course}>{course}</option>)}</select></label><label className="block text-xs font-semibold text-slate-600">Versión<input required maxLength={12} value={form.version} onChange={(event)=>setForm((current)=>({...current,version:event.target.value}))} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm" placeholder="1.0" /></label></div><label className="block text-xs font-semibold text-slate-600">Archivo del recurso <input type="file" onChange={(event)=>setForm((current)=>({...current,fileName:event.target.files?.[0]?.name ?? ""}))} className="mt-1.5 block w-full rounded-xl border border-slate-200 p-3 text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-[#087DB5]/10 file:px-3 file:py-2 file:text-xs file:font-bold file:text-[#087DB5]" /><span className="mt-1 block text-[10px] font-normal text-slate-400">Solo se muestra el nombre seleccionado. No se carga ni se almacena el archivo.</span>{form.fileName && <span className="mt-1 block text-[11px] text-[#087DB5]">Seleccionado: {form.fileName}</span>}</label><div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end"><button type="button" onClick={()=>setShowForm(false)} className="rounded-xl border border-slate-200 px-5 py-3 text-xs font-bold text-slate-600">Cancelar</button><button type="submit" className="rounded-xl bg-[#087DB5] px-5 py-3 text-xs font-bold text-white">{editingId ? "Guardar cambios" : "Crear borrador"}</button></div></form></section></div>}
      <p className="text-[11px] leading-5 text-slate-400">Esta interfaz no modifica registros reales. El modelo definitivo debe almacenar versiones editoriales, permisos de publicación, metadatos, referencia de Storage y auditoría de cambios en servicios protegidos.</p>
    </div>
  </main>;
}
