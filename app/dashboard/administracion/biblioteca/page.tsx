"use client";

import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from "react";
import { createClient } from "@/lib/supabase/client";

type Category = { id: string; name: string; slug: string };
type Course = { id: string; title: string };
type Resource = {
  id: string; district_id: string; category_id: string; course_id: string | null; version_parent_id: string | null;
  title: string; description: string; resource_type: string; version_label: string; storage_path: string | null;
  external_url: string | null; content: string | null; mime_type: string | null; size_bytes: number | null;
  status: string; created_at: string;
};
const resourceTypes = [
  ["document", "Documento"], ["guide", "Guía"], ["template", "Plantilla"], ["video", "Video"],
  ["audio", "Audio"], ["link", "Enlace"], ["reading", "Lectura"], ["infographic", "Infografía"],
];
function safeName(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "_").slice(-100) || "recurso";
}
function slugify(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
function messageOf(error: unknown) {
  return error instanceof Error ? error.message : "No fue posible completar la operación.";
}

export default function AcademicLibraryAdminPage() {
  const supabase = useMemo(() => createClient(), []);
  const [userId, setUserId] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [categoryName, setCategoryName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [resourceType, setResourceType] = useState("document");
  const [externalUrl, setExternalUrl] = useState("");
  const [content, setContent] = useState("");
  const [versionLabel, setVersionLabel] = useState("1.0");
  const [file, setFile] = useState<File | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) throw new Error("Inicia sesión para administrar la biblioteca.");
      setUserId(auth.user.id);
      const { data: assignments, error: assignmentsError } = await supabase.from("user_role_assignments").select("role_id, district_id").eq("user_id", auth.user.id);
      if (assignmentsError) throw assignmentsError;
      const roleIds = [...new Set((assignments ?? []).map((row) => row.role_id))];
      const { data: roles, error: rolesError } = roleIds.length ? await supabase.from("roles").select("role_key").in("id", roleIds) : { data: [], error: null };
      if (rolesError) throw rolesError;
      const roleKeys = new Set((roles ?? []).map((row) => row.role_key));
      if (!roleKeys.has("national_admin") && !roleKeys.has("academic_editor")) throw new Error("Solo el editor académico o el administrador nacional pueden administrar la biblioteca.");
      let selectedDistrict = (assignments ?? []).find((row) => row.district_id)?.district_id ?? "";
      if (!selectedDistrict && roleKeys.has("national_admin")) {
        const { data: district, error: districtError } = await supabase.from("districts").select("id").eq("code", "34").maybeSingle();
        if (districtError) throw districtError;
        selectedDistrict = district?.id ?? "";
      }
      if (!selectedDistrict) throw new Error("No se encontró un distrito para administrar.");
      setDistrictId(selectedDistrict);
      const [categoryResult, courseResult, resourceResult] = await Promise.all([
        supabase.from("academic_library_categories").select("id, name, slug").eq("district_id", selectedDistrict).order("name"),
        supabase.from("courses").select("id, title").eq("district_id", selectedDistrict).order("sort_order"),
        supabase.from("academic_library_resources").select("id, district_id, category_id, course_id, version_parent_id, title, description, resource_type, version_label, storage_path, external_url, content, mime_type, size_bytes, status, created_at").eq("district_id", selectedDistrict).order("created_at", { ascending: false }),
      ]);
      if (categoryResult.error) throw categoryResult.error;
      if (courseResult.error) throw courseResult.error;
      if (resourceResult.error) throw resourceResult.error;
      setCategories((categoryResult.data ?? []) as Category[]);
      setCourses((courseResult.data ?? []) as Course[]);
      setResources((resourceResult.data ?? []) as Resource[]);
      setCategoryId((current) => current || categoryResult.data?.[0]?.id || "");
    } catch (cause) { setError(messageOf(cause)); }
    finally { setLoading(false); }
  }, [supabase]);

  useEffect(() => { void loadData(); }, [loadData]);

  async function addCategory() {
    if (!userId || !districtId || saving) return;
    setSaving(true); setError(""); setNotice("");
    try {
      const name = categoryName.trim();
      const slug = slugify(name);
      if (name.length < 2 || !slug) throw new Error("Escribe un nombre de categoría válido.");
      const { error: insertError } = await supabase.from("academic_library_categories").insert({ district_id: districtId, name, slug, created_by: userId });
      if (insertError) throw insertError;
      setCategoryName(""); setNotice("Categoría creada."); await loadData();
    } catch (cause) { setError(messageOf(cause)); }
    finally { setSaving(false); }
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
    if (selected && selected.size > 50 * 1024 * 1024) { setError("El archivo supera el límite de 50 MB."); setFile(null); return; }
    setFile(selected);
  }

  async function createResource() {
    if (!userId || !districtId || saving) return;
    setSaving(true); setError(""); setNotice("");
    try {
      if (title.trim().length < 3) throw new Error("El título debe tener al menos 3 caracteres.");
      if (description.trim().length < 12) throw new Error("La descripción debe tener al menos 12 caracteres.");
      if (!categoryId) throw new Error("Selecciona una categoría.");
      if (resourceType === "link" && !/^https?:\/\/[^\s]+$/i.test(externalUrl.trim())) throw new Error("Ingresa un enlace HTTP o HTTPS válido.");
      if (resourceType === "reading" && !content.trim()) throw new Error("Escribe el contenido de la lectura.");
      if (resourceType !== "link" && resourceType !== "reading" && !file) throw new Error("Selecciona el archivo que deseas cargar.");
      const placeholder = resourceType !== "link" && resourceType !== "reading" ? "Archivo pendiente de carga" : null;
      const { data: created, error: createError } = await supabase.from("academic_library_resources").insert({
        district_id: districtId, category_id: categoryId, course_id: courseId || null,
        title: title.trim(), description: description.trim(), resource_type: resourceType,
        version_label: versionLabel.trim() || "1.0", external_url: resourceType === "link" ? externalUrl.trim() : null,
        content: resourceType === "reading" ? content.trim() : placeholder,
        created_by: userId, status: "draft",
      }).select("id").single();
      if (createError) throw createError;

      if (file) {
        const path = districtId + "/" + created.id + "/" + Date.now() + "-" + safeName(file.name);
        const { error: uploadError } = await supabase.storage.from("academic-library-resources").upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
        if (uploadError) throw uploadError;
        const { error: updateError } = await supabase.from("academic_library_resources").update({
          storage_path: path, uploaded_by: userId, mime_type: file.type || "application/octet-stream", size_bytes: file.size, content: null,
        }).eq("id", created.id).eq("status", "draft");
        if (updateError) throw updateError;
      }
      setTitle(""); setDescription(""); setExternalUrl(""); setContent(""); setVersionLabel("1.0"); setFile(null);
      setNotice("Recurso creado como borrador. Revísalo antes de publicarlo.");
      await loadData();
    } catch (cause) { setError(messageOf(cause)); }
    finally { setSaving(false); }
  }

  async function changeStatus(resource: Resource, status: "published" | "archived") {
    if (saving) return;
    setSaving(true); setError(""); setNotice("");
    try {
      const { error: updateError } = await supabase.from("academic_library_resources").update({ status }).eq("id", resource.id).eq("status", "draft");
      if (updateError) throw updateError;
      setNotice(status === "published" ? "Recurso publicado y disponible según las matrículas y permisos." : "Recurso archivado.");
      await loadData();
    } catch (cause) { setError(messageOf(cause)); }
    finally { setSaving(false); }
  }

  async function deleteDraft(resource: Resource) {
    if (resource.status !== "draft" || saving) return;
    if (!window.confirm("¿Eliminar este borrador? Esta acción no afecta recursos publicados.")) return;
    setSaving(true); setError(""); setNotice("");
    try {
      const { error: deleteError } = await supabase.from("academic_library_resources").delete().eq("id", resource.id).eq("status", "draft");
      if (deleteError) throw deleteError;
      setNotice("Borrador eliminado."); await loadData();
    } catch (cause) { setError(messageOf(cause)); }
    finally { setSaving(false); }
  }

  const visible = resources.filter((resource) => {
    const text = (resource.title + " " + resource.description).toLocaleLowerCase("es");
    return (!query.trim() || text.includes(query.trim().toLocaleLowerCase("es"))) && (statusFilter === "all" || resource.status === statusFilter);
  });
  const categoryMap = new Map(categories.map((item) => [item.id, item.name]));

  return (
    <main className="min-h-screen bg-[#F4F7FA] px-4 py-8 text-[#102D4D] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8"><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#19A7A0]">Gestión editorial</p><h1 className="mt-2 text-3xl font-bold">Biblioteca académica</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">Organiza documentos, guías, plantillas, videos, audios, enlaces y lecturas. Los recursos publicados quedan protegidos; las actualizaciones se gestionan como nuevas versiones.</p></header>
        {error && <div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
        {notice && <div role="status" className="mb-5 rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">{notice}</div>}
        {loading ? <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">Cargando biblioteca...</div> : <>
          <section className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
            <div className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="text-lg font-bold">Categorías</h2><p className="mt-1 text-xs text-slate-500">Organiza los recursos por área temática.</p><div className="mt-4 flex gap-2"><input value={categoryName} onChange={(event) => setCategoryName(event.target.value)} maxLength={100} placeholder="Nueva categoría" className="min-w-0 flex-1 rounded-xl border border-slate-200 p-3 text-sm" /><button type="button" disabled={saving} onClick={() => void addCategory()} className="rounded-xl bg-[#087DB5] px-4 text-xs font-semibold text-white disabled:opacity-50">Añadir</button></div><ul className="mt-4 space-y-2">{categories.map((item) => <li key={item.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm"><span>{item.name}</span><span className="text-[10px] text-slate-400">{item.slug}</span></li>)}</ul></div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="text-lg font-bold">Añadir recurso</h2><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold">Título<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={180} className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm font-normal" /></label><label className="text-xs font-semibold">Categoría<select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm font-normal"><option value="">Seleccionar</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></div>
              <label className="mt-3 block text-xs font-semibold">Descripción<textarea rows={2} value={description} onChange={(event) => setDescription(event.target.value)} maxLength={2000} className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm font-normal" /></label>
              <div className="mt-3 grid gap-3 sm:grid-cols-3"><label className="text-xs font-semibold">Tipo<select value={resourceType} onChange={(event) => setResourceType(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm font-normal">{resourceTypes.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="text-xs font-semibold">Curso (opcional)<select value={courseId} onChange={(event) => setCourseId(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm font-normal"><option value="">Recurso general</option>{courses.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label><label className="text-xs font-semibold">Versión<input value={versionLabel} onChange={(event) => setVersionLabel(event.target.value)} maxLength={24} className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm font-normal" /></label></div>
              {resourceType === "link" ? <label className="mt-3 block text-xs font-semibold">URL<input type="url" value={externalUrl} onChange={(event) => setExternalUrl(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm font-normal" placeholder="https://..." /></label> : resourceType === "reading" ? <label className="mt-3 block text-xs font-semibold">Contenido de lectura<textarea rows={5} value={content} onChange={(event) => setContent(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm font-normal" /></label> : <label className="mt-3 block text-xs font-semibold">Archivo<input type="file" onChange={onFileChange} className="mt-2 block w-full rounded-xl border border-slate-200 p-3 text-sm font-normal" /><span className="mt-1 block text-[11px] font-normal text-slate-500">Máximo 50 MB. El bucket es privado.</span></label>}
              <button type="button" disabled={saving || !categories.length} onClick={() => void createResource()} className="mt-4 rounded-xl bg-[#087DB5] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Guardando..." : "Guardar borrador"}</button>
            </div>
          </section>

          <section className="mt-8"><div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-bold">Recursos registrados</h2><p className="mt-1 text-xs text-slate-500">{resources.length} recursos · {resources.filter((item) => item.status === "published").length} publicados</p></div><div className="flex flex-wrap gap-2"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar recurso..." className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs" /><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"><option value="all">Todos los estados</option><option value="draft">Borradores</option><option value="published">Publicados</option><option value="archived">Archivados</option></select></div></div>
            {visible.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">No hay recursos que coincidan con la búsqueda.</div> : <div className="space-y-3">{visible.map((resource) => <article key={resource.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold">{resource.title}</h3><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold">{resource.status === "published" ? "Publicado" : resource.status === "archived" ? "Archivado" : "Borrador"}</span></div><p className="mt-1 text-xs text-slate-500">{categoryMap.get(resource.category_id) || "Sin categoría"} · {resourceTypes.find(([value]) => value === resource.resource_type)?.[1] || resource.resource_type} · v{resource.version_label}{resource.course_id ? " · Vinculado a curso" : " · General"}</p><p className="mt-1 line-clamp-1 text-xs text-slate-400">{resource.description}</p></div><div className="flex flex-wrap gap-2">{resource.status === "draft" && <><button type="button" disabled={saving} onClick={() => void changeStatus(resource, "published")} className="rounded-xl bg-[#087DB5] px-3 py-2 text-xs font-semibold text-white">Publicar</button><button type="button" disabled={saving} onClick={() => void deleteDraft(resource)} className="rounded-xl border border-red-200 px-3 py-2 text-xs font-semibold text-red-700">Eliminar borrador</button></>}</div></article>)}</div>}
          </section>
        </>}
      </div>
    </main>
  );
}
