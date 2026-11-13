"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Category = { id: string; name: string };
type Resource = {
  id: string; category_id: string; course_id: string | null; title: string; description: string;
  resource_type: string; version_label: string; storage_path: string | null; external_url: string | null;
  content: string | null; mime_type: string | null; size_bytes: number | null; created_at: string;
  categoryName?: string; signedUrl?: string | null;
};

function typeLabel(value: string) {
  const labels: Record<string, string> = { document: "Documento", guide: "Guía", template: "Plantilla", video: "Video", audio: "Audio", link: "Enlace", reading: "Lectura", infographic: "Infografía" };
  return labels[value] || value;
}

export default function StudentLibraryPage() {
  const supabase = useMemo(() => createClient(), []);
  const [resources, setResources] = useState<Resource[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selected, setSelected] = useState<Resource | null>(null);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [categoryResult, resourceResult] = await Promise.all([
        supabase.from("academic_library_categories").select("id, name").order("name"),
        supabase.from("academic_library_resources").select("id, category_id, course_id, title, description, resource_type, version_label, storage_path, external_url, content, mime_type, size_bytes, created_at").eq("status", "published").order("created_at", { ascending: false }),
      ]);
      if (categoryResult.error) throw categoryResult.error;
      if (resourceResult.error) throw resourceResult.error;
      const categoryRows = (categoryResult.data ?? []) as Category[];
      const categoryMap = new Map(categoryRows.map((item) => [item.id, item.name]));
      const rows = (resourceResult.data ?? []) as Resource[];
      const enriched = await Promise.all(rows.map(async (resource) => {
        let signedUrl: string | null = null;
        if (resource.storage_path) {
          const { data, error: urlError } = await supabase.storage.from("academic-library-resources").createSignedUrl(resource.storage_path, 300);
          if (!urlError) signedUrl = data?.signedUrl ?? null;
        }
        return { ...resource, categoryName: categoryMap.get(resource.category_id) || "Material académico", signedUrl };
      }));
      setCategories(categoryRows);
      setResources(enriched);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No fue posible cargar la biblioteca.");
      setResources([]);
    } finally { setLoading(false); }
  }, [supabase]);

  useEffect(() => { void Promise.resolve().then(loadData); }, [loadData]);

  const visible = resources.filter((resource) => {
    const normalized = query.trim().toLocaleLowerCase("es");
    const matchesQuery = !normalized || (resource.title + " " + resource.description + " " + (resource.categoryName || "")).toLocaleLowerCase("es").includes(normalized);
    return matchesQuery && (categoryFilter === "all" || resource.category_id === categoryFilter) && (typeFilter === "all" || resource.resource_type === typeFilter);
  });
  const types = [...new Set(resources.map((item) => item.resource_type))];

  return (
    <main className="min-h-screen bg-[#F4F7FA] px-4 py-8 text-[#102D4D] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#19A7A0]">Recursos para crecer</p><h1 className="mt-2 text-3xl font-bold">Biblioteca académica</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Consulta los documentos, guías, videos y lecturas publicados para tu formación. El acceso a recursos de cursos se controla con tu matrícula.</p></div><button type="button" onClick={() => void loadData()} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold">Actualizar</button></header>
        {error && <div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
        <section className="mb-6 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-[1fr_220px_190px]">
          <label className="text-xs font-semibold">Buscar recursos<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Título, descripción o categoría..." className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm font-normal" /></label>
          <label className="text-xs font-semibold">Categoría<select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm font-normal"><option value="all">Todas</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label className="text-xs font-semibold">Tipo de recurso<select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm font-normal"><option value="all">Todos</option>{types.map((item) => <option key={item} value={item}>{typeLabel(item)}</option>)}</select></label>
        </section>
        {loading ? <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">Cargando recursos publicados...</div> : visible.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center"><h2 className="font-semibold">Todavía no hay recursos disponibles</h2><p className="mt-2 text-sm text-slate-500">Los materiales publicados para tu distrito y tus cursos aparecerán aquí.</p></div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{visible.map((resource) => (
            <article key={resource.id} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-2"><span className="rounded-full bg-sky-50 px-3 py-1 text-[10px] font-bold text-[#087DB5]">{typeLabel(resource.resource_type)}</span><span className="text-[10px] text-slate-400">v{resource.version_label}</span></div>
              <h2 className="mt-4 text-lg font-bold">{resource.title}</h2><p className="mt-2 line-clamp-3 flex-1 text-sm leading-6 text-slate-500">{resource.description}</p>
              <div className="mt-4 flex items-center justify-between gap-2 text-[11px] text-slate-400"><span>{resource.categoryName}</span><span>{resource.course_id ? "Recurso de curso" : "Recurso general"}</span></div>
              <div className="mt-5 flex flex-wrap gap-2">
                {resource.external_url && <a href={resource.external_url} target="_blank" rel="noreferrer" className="rounded-xl bg-[#087DB5] px-4 py-2.5 text-xs font-semibold text-white">Abrir enlace</a>}
                {resource.signedUrl && <a href={resource.signedUrl} target="_blank" rel="noreferrer" className="rounded-xl bg-[#087DB5] px-4 py-2.5 text-xs font-semibold text-white">Ver archivo</a>}
                {resource.content && <button type="button" onClick={() => setSelected(resource)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold">Leer contenido</button>}
                {resource.storage_path && !resource.signedUrl && <span className="rounded-xl bg-amber-50 px-3 py-2.5 text-[11px] text-amber-800">Archivo no disponible temporalmente</span>}
              </div>
            </article>
          ))}</div>
        )}
      </div>
      {selected && <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-5" role="presentation"><section role="dialog" aria-modal="true" aria-labelledby="library-reading-title" onClick={(event) => event.stopPropagation()} className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-t-3xl bg-white p-6 sm:rounded-3xl"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-wider text-[#19A7A0]">{selected.categoryName}</p><h2 id="library-reading-title" className="mt-2 text-xl font-bold">{selected.title}</h2></div><button type="button" onClick={() => setSelected(null)} className="rounded-full border border-slate-200 px-3 py-1 text-sm">Cerrar</button></div><div className="mt-5 whitespace-pre-wrap text-sm leading-7 text-slate-700">{selected.content}</div></section></div>}
    </main>
  );
}
