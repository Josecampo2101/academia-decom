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
  resourceUrl: string;
};

const initialResources: Resource[] = [
  {
    id: "lib-001",
    title: "Manual de identidad corporativa DECOM",
    description: "Lineamientos institucionales, uso de marca, colores y criterios de aplicación.",
    category: "Identidad institucional",
    type: "Documento",
    course: "Identidad corporativa DECOM",
    version: "1.2",
    status: "Publicado",
    updatedAt: "11 nov 2026",
    fileName: "manual-identidad-decom.pdf",
    resourceUrl: "",
  },
  {
    id: "lib-002",
    title: "Lista de verificación para piezas gráficas",
    description: "Puntos de control para revisar coherencia visual antes de publicar.",
    category: "Diseño y comunicación",
    type: "Plantilla",
    course: "Medios digitales",
    version: "1.0",
    status: "Publicado",
    updatedAt: "10 nov 2026",
    fileName: "checklist-piezas-graficas.docx",
    resourceUrl: "",
  },
  {
    id: "lib-003",
    title: "Fundamentos de comunicación institucional",
    description: "Material de apoyo para comprender propósito, audiencia y mensaje.",
    category: "Comunicación",
    type: "Guía",
    course: "Identidad corporativa DECOM",
    version: "0.3",
    status: "Borrador",
    updatedAt: "9 nov 2026",
    fileName: "fundamentos-comunicacion.pdf",
    resourceUrl: "",
  },
  {
    id: "lib-004",
    title: "Introducción a la producción audiovisual",
    description: "Recurso audiovisual introductorio para equipos de medios.",
    category: "Producción audiovisual",
    type: "Video",
    course: "Medios audiovisuales",
    version: "1.0",
    status: "Archivado",
    updatedAt: "2 nov 2026",
    fileName: "introduccion-produccion.mp4",
    resourceUrl: "",
  },
];

const categories = [
  "Identidad institucional",
  "Comunicación",
  "Diseño y comunicación",
  "Medios escritos",
  "Medios digitales",
  "Producción audiovisual",
  "Fotografía",
  "Audio e IA",
  "Otros",
];
const courseOptions = [
  "General",
  "Identidad corporativa DECOM",
  "Medios escritos",
  "Medios digitales",
  "Medios audiovisuales",
  "Fotografía",
  "Audio e IA",
];
const types: ResourceType[] = ["Documento", "Guía", "Plantilla", "Video", "Audio", "Enlace"];

const emptyForm = {
  title: "",
  description: "",
  category: categories[0],
  type: "Documento" as ResourceType,
  course: "General",
  version: "1.0",
  fileName: "",
  resourceUrl: "",
};

export default function LibraryAdministrationPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [access, setAccess] = useState<AccessState>("checking");
  const [resources, setResources] = useState<Resource[]>(initialResources);
  const [categoryOptions, setCategoryOptions] = useState(categories);
  const [newCategory, setNewCategory] = useState("");
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
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();
        if (!active) return;
        if (authError || !user) {
          router.replace("/conexion");
          return;
        }
        const { data: assignments, error: assignmentError } = await supabase
          .from("user_role_assignments")
          .select("role_id")
          .eq("user_id", user.id);
        if (assignmentError) throw assignmentError;
        if (!active) return;
        const ids = [...new Set((assignments ?? []).map((item) => item.role_id))];
        if (!ids.length) {
          setAccess("denied");
          return;
        }
        const { data: roles, error: rolesError } = await supabase
          .from("roles")
          .select("role_key")
          .in("id", ids);
        if (rolesError) throw rolesError;
        if (!active) return;
        const keys = (roles ?? []).map((role) => role.role_key);
        setAccess(
          keys.includes("national_admin") || keys.includes("academic_editor")
            ? "allowed"
            : "denied",
        );
      } catch (error) {
        console.error("Error verificando acceso a la biblioteca:", error);
        if (active) setAccess("error");
      }
    }
    void Promise.resolve().then(verifyAccess);
    return () => {
      active = false;
    };
  }, [router, supabase]);

  const filteredResources = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("es");
    return resources.filter((resource) => {
      const matchesQuery =
        !normalized ||
        [resource.title, resource.description, resource.category, resource.course].some((value) =>
          value.toLocaleLowerCase("es").includes(normalized),
        );
      return (
        matchesQuery &&
        (statusFilter === "Todos" || resource.status === statusFilter) &&
        (typeFilter === "Todos" || resource.type === typeFilter)
      );
    });
  }, [query, resources, statusFilter, typeFilter]);

  const counts = useMemo(
    () => ({
      total: resources.length,
      published: resources.filter((item) => item.status === "Publicado").length,
      drafts: resources.filter((item) => item.status === "Borrador").length,
      archived: resources.filter((item) => item.status === "Archivado").length,
    }),
    [resources],
  );

  function startCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
    setNotice("");
  }

  function startEdit(resource: Resource) {
    setEditingId(resource.id);
    setForm({
      title: resource.title,
      description: resource.description,
      category: resource.category,
      type: resource.type,
      course: resource.course,
      version: resource.version,
      fileName: resource.fileName,
      resourceUrl: resource.resourceUrl,
    });
    setShowForm(true);
    setNotice("");
  }

  function saveResource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = form.title.trim();
    if (!title) {
      setNotice("El título es obligatorio.");
      setNoticeError(true);
      return;
    }
    if (form.description.trim().length < 12) {
      setNotice("Añade una descripción de al menos 12 caracteres.");
      setNoticeError(true);
      return;
    }
    if (form.type === "Enlace" && !/^https?:\/\//i.test(form.resourceUrl.trim())) {
      setNotice("Para un enlace, indica una URL válida que comience por https:// o http://.");
      setNoticeError(true);
      return;
    }
    if (form.type !== "Enlace" && !form.fileName.trim()) {
      setNotice("Selecciona un archivo para este tipo de recurso.");
      setNoticeError(true);
      return;
    }
    const now = new Intl.DateTimeFormat("es-CO", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date());
    if (editingId) {
      setResources((current) =>
        current.map((item) =>
          item.id === editingId
            ? { ...item, ...form, title, description: form.description.trim(), updatedAt: now }
            : item,
        ),
      );
      setNotice("Cambios guardados en esta demostración.");
    } else {
      setResources((current) => [
        {
          id: "local-" + Date.now(),
          ...form,
          title,
          description: form.description.trim(),
          status: "Borrador",
          updatedAt: now,
        },
        ...current,
      ]);
      setNotice("Recurso creado como borrador en esta demostración.");
    }
    setNoticeError(false);
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  function createNewVersion(resource: Resource) {
    const match = /^(\\d+)\\.(\\d+)$/.exec(resource.version);
    const nextVersion = match ? `${match[1]}.${Number(match[2]) + 1}` : `${resource.version}.1`;
    setResources((current) => [
      {
        ...resource,
        id: "version-" + Date.now(),
        version: nextVersion,
        status: "Borrador",
        updatedAt: "11 nov 2026",
      },
      ...current,
    ]);
    setNotice(
      `Se creó v${nextVersion} como borrador. La versión publicada se conserva sin cambios en esta demostración.`,
    );
    setNoticeError(false);
  }

  function addCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const clean = newCategory.trim();
    if (!clean) return;
    if (
      categoryOptions.some((item) => item.toLocaleLowerCase("es") === clean.toLocaleLowerCase("es"))
    ) {
      setNotice("Esa categoría ya existe.");
      setNoticeError(true);
      return;
    }
    setCategoryOptions((current) => [...current, clean].sort((a, b) => a.localeCompare(b, "es")));
    setForm((current) => ({ ...current, category: clean }));
    setNewCategory("");
    setNotice("Categoría añadida en esta demostración.");
    setNoticeError(false);
  }

  function changeStatus(resource: Resource, status: ResourceStatus) {
    setResources((current) =>
      current.map((item) =>
        item.id === resource.id ? { ...item, status, updatedAt: "11 nov 2026" } : item,
      ),
    );
    setNotice(
      status === "Publicado"
        ? "Recurso publicado en la vista de demostración."
        : status === "Archivado"
          ? "Recurso archivado en la vista de demostración."
          : "Recurso devuelto a borradores.",
    );
    setNoticeError(false);
  }

  if (access === "checking")
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-fg">Verificando permisos editoriales...</p>
      </main>
    );
  if (access !== "allowed")
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6">
        <section className="max-w-md rounded-3xl border border-line bg-surface p-8 text-center">
          <h1 className="text-xl font-bold text-foreground">
            {access === "error" ? "No pudimos validar tus permisos" : "Acceso restringido"}
          </h1>
          <p className="mt-2 text-sm text-muted-fg">
            La administración de la Biblioteca está disponible para Administración nacional y
            Editores académicos.
          </p>
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="mt-5 rounded-xl bg-decom-blue px-5 py-3 text-sm font-semibold text-white"
          >
            Volver al panel
          </button>
        </section>
      </main>
    );

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 md:px-8">
          <div>
            <p className="text-xs font-extrabold tracking-[0.14em] text-decom-blue-text">
              ACADEMIA DECOM
            </p>
            <p className="mt-1 text-xs text-muted-fg">Administración académica</p>
          </div>
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="rounded-xl border border-line px-4 py-2.5 text-xs font-semibold text-muted-fg"
          >
            ← Panel principal
          </button>
        </div>
      </header>
      <div className="mx-auto max-w-7xl space-y-7 px-5 py-7 md:px-8 md:py-9">
        <section className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-decom-teal-text">
              Gestión de contenidos
            </p>
            <h1 className="mt-2 text-2xl font-extrabold md:text-3xl">Biblioteca académica</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-fg">
              Administra recursos de consulta, clasifícalos y controla su ciclo editorial.
            </p>
          </div>
          <button
            type="button"
            onClick={startCreate}
            className="rounded-xl bg-decom-blue px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-decom-blue-hover"
          >
            ＋ Nuevo recurso
          </button>
        </section>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">
          <strong>Entorno de demostración.</strong> Los recursos y cambios de estado son locales y
          ficticios. La carga de archivos, publicación, versionado y persistencia reales todavía no
          están conectados.
        </div>
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <article className="rounded-2xl border border-line bg-surface p-5">
            <p className="text-xs font-semibold text-muted-fg">Recursos en catálogo</p>
            <p className="mt-2 text-3xl font-extrabold">{counts.total}</p>
          </article>
          <article className="rounded-2xl border border-line bg-surface p-5">
            <p className="text-xs font-semibold text-muted-fg">Publicados</p>
            <p className="mt-2 text-3xl font-extrabold text-teal-700">{counts.published}</p>
          </article>
          <article className="rounded-2xl border border-line bg-surface p-5">
            <p className="text-xs font-semibold text-muted-fg">Borradores</p>
            <p className="mt-2 text-3xl font-extrabold text-amber-700">{counts.drafts}</p>
          </article>
          <article className="rounded-2xl border border-line bg-surface p-5">
            <p className="text-xs font-semibold text-muted-fg">Archivados</p>
            <p className="mt-2 text-3xl font-extrabold text-muted-fg">{counts.archived}</p>
          </article>
        </section>
        {notice && (
          <div
            role="status"
            className={`rounded-xl border px-4 py-3 text-sm ${noticeError ? "border-red-200 bg-red-50 text-red-700" : "border-teal-200 bg-teal-50 text-teal-800"}`}
          >
            {notice}
          </div>
        )}
        <section className="rounded-3xl border border-line bg-surface p-5 shadow-sm md:p-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <label className="min-w-0 flex-1">
              <span className="sr-only">Buscar recursos</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por título, descripción, categoría o curso..."
                className="w-full rounded-xl border border-line px-4 py-3 text-sm outline-none transition focus:border-decom-blue focus:ring-2 focus:ring-decom-blue/10"
              />
            </label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-2">
              <label className="text-xs font-semibold text-muted-fg">
                <span className="mb-1 block">Estado</span>
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
                  className="w-full rounded-xl border border-line bg-surface px-3 py-3 text-xs"
                >
                  <option>Todos</option>
                  <option>Borrador</option>
                  <option>Publicado</option>
                  <option>Archivado</option>
                </select>
              </label>
              <label className="text-xs font-semibold text-muted-fg">
                <span className="mb-1 block">Tipo</span>
                <select
                  value={typeFilter}
                  onChange={(event) => setTypeFilter(event.target.value as typeof typeFilter)}
                  className="w-full rounded-xl border border-line bg-surface px-3 py-3 text-xs"
                >
                  <option>Todos</option>
                  {types.map((type) => (
                    <option key={type}>{type}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>
          <details className="mt-5 rounded-xl border border-line-soft bg-surface-muted p-4">
            <summary className="cursor-pointer text-xs font-bold text-foreground">
              Administrar categorías ({categoryOptions.length})
            </summary>
            <form onSubmit={addCategory} className="mt-3 flex flex-col gap-2 sm:flex-row">
              <label className="min-w-0 flex-1">
                <span className="sr-only">Nombre de nueva categoría</span>
                <input
                  value={newCategory}
                  onChange={(event) => setNewCategory(event.target.value)}
                  maxLength={80}
                  placeholder="Nombre de la nueva categoría"
                  className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-xs outline-none focus:border-decom-blue"
                />
              </label>
              <button
                type="submit"
                className="rounded-lg bg-decom-navy px-4 py-2.5 text-xs font-bold text-white"
              >
                Añadir categoría
              </button>
            </form>
            <p className="mt-2 text-[10px] text-muted-fg">
              Las categorías añadidas solo existen durante esta sesión de demostración.
            </p>
          </details>
          <div className="mt-5 flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold">Catálogo de recursos</h2>
            <span className="text-xs text-muted-fg">{filteredResources.length} resultado(s)</span>
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead>
                <tr className="border-b border-line-soft text-[10px] uppercase tracking-wider text-muted-fg">
                  <th className="px-3 py-3">Recurso</th>
                  <th className="px-3 py-3">Clasificación</th>
                  <th className="px-3 py-3">Curso</th>
                  <th className="px-3 py-3">Versión</th>
                  <th className="px-3 py-3">Estado</th>
                  <th className="px-3 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredResources.map((resource) => (
                  <tr
                    key={resource.id}
                    className="border-b border-slate-50 align-top last:border-0"
                  >
                    <td className="px-3 py-4">
                      <p className="font-bold text-foreground">{resource.title}</p>
                      <p className="mt-1 max-w-xs text-[11px] leading-5 text-muted-fg">
                        {resource.description}
                      </p>
                      <p className="mt-1 text-[10px] text-muted-fg">
                        {resource.fileName || "Sin archivo adjunto"} · {resource.updatedAt}
                      </p>
                    </td>
                    <td className="px-3 py-4">
                      <p className="font-semibold text-foreground">{resource.type}</p>
                      <p className="mt-1 text-muted-fg">{resource.category}</p>
                    </td>
                    <td className="px-3 py-4 text-muted-fg">{resource.course}</td>
                    <td className="px-3 py-4 font-mono text-muted-fg">v{resource.version}</td>
                    <td className="px-3 py-4">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${resource.status === "Publicado" ? "bg-teal-50 text-teal-700" : resource.status === "Borrador" ? "bg-amber-50 text-amber-700" : "bg-surface-muted text-muted-fg"}`}
                      >
                        {resource.status}
                      </span>
                    </td>
                    <td className="px-3 py-4">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(resource)}
                          className="rounded-lg border border-line px-2.5 py-1.5 font-semibold text-muted-fg hover:border-decom-blue hover:text-decom-blue-text"
                        >
                          Editar
                        </button>
                        {resource.status === "Publicado" && (
                          <button
                            type="button"
                            onClick={() => createNewVersion(resource)}
                            className="rounded-lg border border-decom-blue/30 px-2.5 py-1.5 font-semibold text-decom-blue-text"
                          >
                            Nueva versión
                          </button>
                        )}
                        {resource.status === "Publicado" ? (
                          <button
                            type="button"
                            onClick={() => changeStatus(resource, "Archivado")}
                            className="rounded-lg border border-line px-2.5 py-1.5 font-semibold text-muted-fg"
                          >
                            Archivar
                          </button>
                        ) : resource.status === "Archivado" ? (
                          <button
                            type="button"
                            onClick={() => changeStatus(resource, "Borrador")}
                            className="rounded-lg border border-line px-2.5 py-1.5 font-semibold text-muted-fg"
                          >
                            Restaurar
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => changeStatus(resource, "Publicado")}
                            className="rounded-lg bg-decom-blue px-2.5 py-1.5 font-semibold text-white"
                          >
                            Publicar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredResources.length === 0 && (
              <p className="py-12 text-center text-sm text-muted-fg">
                No hay recursos que coincidan con los filtros.
              </p>
            )}
          </div>
        </section>
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-0 backdrop-blur-sm sm:items-center sm:p-5">
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="resource-form-title"
              className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-surface p-5 shadow-2xl sm:rounded-3xl sm:p-7"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-decom-teal-text">
                    Editor de contenidos
                  </p>
                  <h2 id="resource-form-title" className="mt-1 text-xl font-extrabold">
                    {editingId ? "Editar recurso" : "Registrar recurso"}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  aria-label="Cerrar formulario"
                  className="rounded-lg border border-line px-3 py-2 text-muted-fg"
                >
                  ✕
                </button>
              </div>
              <form onSubmit={saveResource} className="mt-6 space-y-4">
                <label className="block text-xs font-semibold text-muted-fg">
                  Título del recurso
                  <input
                    required
                    maxLength={160}
                    value={form.title}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, title: event.target.value }))
                    }
                    className="mt-1.5 w-full rounded-xl border border-line px-3 py-3 text-sm outline-none focus:border-decom-blue"
                    placeholder="Ej. Guía de producción audiovisual"
                  />
                </label>
                <label className="block text-xs font-semibold text-muted-fg">
                  Descripción
                  <textarea
                    required
                    minLength={12}
                    maxLength={700}
                    rows={3}
                    value={form.description}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, description: event.target.value }))
                    }
                    className="mt-1.5 w-full rounded-xl border border-line px-3 py-3 text-sm outline-none focus:border-decom-blue"
                    placeholder="Describe el propósito y el contenido del recurso."
                  />
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-xs font-semibold text-muted-fg">
                    Categoría
                    <select
                      value={form.category}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, category: event.target.value }))
                      }
                      className="mt-1.5 w-full rounded-xl border border-line bg-surface px-3 py-3 text-sm"
                    >
                      {categoryOptions.map((category) => (
                        <option key={category}>{category}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-xs font-semibold text-muted-fg">
                    Tipo de recurso
                    <select
                      value={form.type}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          type: event.target.value as ResourceType,
                        }))
                      }
                      className="mt-1.5 w-full rounded-xl border border-line bg-surface px-3 py-3 text-sm"
                    >
                      {types.map((type) => (
                        <option key={type}>{type}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-xs font-semibold text-muted-fg">
                    Asociar a curso
                    <select
                      value={form.course}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, course: event.target.value }))
                      }
                      className="mt-1.5 w-full rounded-xl border border-line bg-surface px-3 py-3 text-sm"
                    >
                      {courseOptions.map((course) => (
                        <option key={course}>{course}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-xs font-semibold text-muted-fg">
                    Versión
                    <input
                      required
                      maxLength={12}
                      value={form.version}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, version: event.target.value }))
                      }
                      className="mt-1.5 w-full rounded-xl border border-line px-3 py-3 text-sm"
                      placeholder="1.0"
                    />
                  </label>
                </div>
                {form.type === "Enlace" ? (
                  <label className="block text-xs font-semibold text-muted-fg">
                    URL del recurso
                    <input
                      required
                      type="url"
                      value={form.resourceUrl}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, resourceUrl: event.target.value }))
                      }
                      placeholder="https://..."
                      className="mt-1.5 w-full rounded-xl border border-line px-3 py-3 text-sm outline-none focus:border-decom-blue"
                    />
                  </label>
                ) : (
                  <label className="block text-xs font-semibold text-muted-fg">
                    Archivo del recurso{" "}
                    <input
                      type="file"
                      required={!form.fileName}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          fileName: event.target.files?.[0]?.name ?? "",
                        }))
                      }
                      className="mt-1.5 block w-full rounded-xl border border-line p-3 text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-decom-blue/10 file:px-3 file:py-2 file:text-xs file:font-bold file:text-decom-blue-text"
                    />
                    <span className="mt-1 block text-[10px] font-normal text-muted-fg">
                      Solo se muestra el nombre seleccionado. No se carga ni se almacena el archivo.
                    </span>
                    {form.fileName && (
                      <span className="mt-1 block text-[11px] text-decom-blue-text">
                        Seleccionado: {form.fileName}
                      </span>
                    )}
                  </label>
                )}
                <div className="flex flex-col-reverse gap-2 border-t border-line-soft pt-4 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="rounded-xl border border-line px-5 py-3 text-xs font-bold text-muted-fg"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="rounded-xl bg-decom-blue px-5 py-3 text-xs font-bold text-white"
                  >
                    {editingId ? "Guardar cambios" : "Crear borrador"}
                  </button>
                </div>
              </form>
            </section>
          </div>
        )}
        <p className="text-[11px] leading-5 text-muted-fg">
          Esta interfaz no modifica registros reales. El modelo definitivo debe almacenar versiones
          editoriales, permisos de publicación, metadatos, referencia de Storage y auditoría de
          cambios en servicios protegidos.
        </p>
      </div>
    </main>
  );
}
