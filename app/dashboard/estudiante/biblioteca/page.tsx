"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  CirclePlay,
  ExternalLink,
  FileText,
  Headphones,
  Image as ImageIcon,
  Inbox,
  LayoutTemplate,
  Link2,
  LoaderCircle,
  Search,
  type LucideIcon,
} from "lucide-react";
import { StatusScreen } from "@/components/ui/StatusScreen";
import { createLibraryFileUrl, loadPublishedLibrary } from "@/lib/library/data";
import type { LibraryResource, PublishedLibrary } from "@/lib/library/data";
import {
  RESOURCE_TYPES,
  filterResources,
  formatFileSize,
  resourceOpenMode,
  safeExternalUrl,
  typeLabel,
} from "@/lib/library/resources.mjs";
import { createClient } from "@/lib/supabase/client";

type AccessState = "checking" | "allowed" | "denied" | "error";
type LibraryState =
  { status: "loading" } | { status: "ready"; library: PublishedLibrary } | { status: "error" };

const TYPE_ICONS: Record<string, LucideIcon> = {
  document: FileText,
  guide: BookOpen,
  template: LayoutTemplate,
  video: CirclePlay,
  audio: Headphones,
  link: Link2,
  reading: BookOpen,
  infographic: ImageIcon,
};

const ACTION_LABELS = { link: "Abrir enlace", file: "Abrir archivo", text: "Leer" } as const;

function formatDate(value: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export default function StudentLibraryPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [access, setAccess] = useState<AccessState>("checking");
  const [libraryState, setLibraryState] = useState<LibraryState>({ status: "loading" });
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState("all");
  const [type, setType] = useState("all");
  const [reading, setReading] = useState<LibraryResource | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    let active = true;

    async function verifyAccessAndLoad() {
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
        const roleIds = [...new Set((assignments ?? []).map((item) => item.role_id))];
        if (!roleIds.length) {
          setAccess("denied");
          return;
        }
        const { data: roles, error: rolesError } = await supabase
          .from("roles")
          .select("role_key")
          .in("id", roleIds);
        if (rolesError) throw rolesError;
        if (!active) return;
        const keys = (roles ?? []).map((role) => role.role_key);
        if (!(keys.includes("member") || keys.includes("national_admin"))) {
          setAccess("denied");
          return;
        }
        setAccess("allowed");

        // La biblioteca se lee aparte: si falla, el acceso sigue siendo válido y se avisa en pantalla.
        try {
          const library = await loadPublishedLibrary(supabase);
          if (active) setLibraryState({ status: "ready", library });
        } catch (error) {
          console.error("No fue posible cargar la biblioteca:", error);
          if (active) setLibraryState({ status: "error" });
        }
      } catch (error) {
        console.error("No fue posible validar el acceso a la biblioteca:", error);
        if (active) setAccess("error");
      }
    }

    void Promise.resolve().then(verifyAccessAndLoad);
    return () => {
      active = false;
    };
  }, [router, supabase]);

  const library = libraryState.status === "ready" ? libraryState.library : null;
  const resources = useMemo(() => library?.resources ?? [], [library]);
  const visible = useMemo(
    () => filterResources(resources, { query, categoryId, type }),
    [resources, query, categoryId, type],
  );
  const categoryNames = useMemo(
    () => new Map((library?.categories ?? []).map((category) => [category.id, category.name])),
    [library],
  );
  // Solo se ofrecen categorías y tipos que realmente tienen recursos publicados.
  const usedCategories = (library?.categories ?? []).filter((category) =>
    resources.some((resource) => resource.category_id === category.id),
  );
  const usedTypes = [...new Set(resources.map((resource) => resource.resource_type))];
  const hasFilters = query.trim() !== "" || categoryId !== "all" || type !== "all";

  async function handleOpen(resource: LibraryResource) {
    setActionError("");
    const mode = resourceOpenMode(resource);
    if (mode === "text") {
      setReading(resource);
      return;
    }
    if (mode === "link") {
      window.open(safeExternalUrl(resource.external_url), "_blank", "noopener,noreferrer");
      return;
    }
    if (mode === "file" && resource.storage_path) {
      setOpeningId(resource.id);
      // La pestaña se abre al instante (con el clic) para que el navegador no la bloquee.
      const tab = window.open("", "_blank");
      try {
        const url = await createLibraryFileUrl(supabase, resource.storage_path);
        if (tab) {
          tab.opener = null;
          tab.location.href = url;
        } else {
          window.location.assign(url);
        }
      } catch (error) {
        console.error("No fue posible abrir el archivo de la biblioteca:", error);
        tab?.close();
        setActionError("No pudimos abrir el archivo. Inténtalo de nuevo o avisa a tu tutor.");
      } finally {
        setOpeningId(null);
      }
    }
  }

  if (access === "checking")
    return (
      <main id="contenido" className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-fg">Verificando tu acceso...</p>
      </main>
    );
  if (access !== "allowed")
    return (
      <StatusScreen
        title={access === "error" ? "No pudimos validar tu acceso" : "Acceso restringido"}
        message="La biblioteca está habilitada para estudiantes con una asignación vigente."
        actionLabel="Volver al panel"
        onAction={() => router.push("/dashboard/estudiante")}
      />
    );

  return (
    <main id="contenido" className="min-h-screen bg-background text-foreground">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 md:px-8">
          <div>
            <p className="text-xs font-extrabold tracking-[0.14em] text-decom-blue-text">
              ACADEMIA DECOM
            </p>
            <p className="mt-1 text-xs text-muted-fg">Biblioteca de recursos</p>
          </div>
          <button
            type="button"
            onClick={() => router.push("/dashboard/estudiante")}
            className="rounded-xl border border-line px-4 py-2.5 text-xs font-semibold text-muted-fg"
          >
            ← Panel del estudiante
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-6 px-5 py-7 pb-12 md:px-8 md:py-9">
        <section>
          <p className="text-xs font-bold tracking-[0.16em] text-decom-teal-text uppercase">
            Material de estudio
          </p>
          <h1 className="mt-2 text-2xl font-extrabold md:text-3xl">Biblioteca</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-fg">
            Guías, plantillas, lecturas y recursos publicados por la coordinación académica para
            apoyar tu formación.
          </p>
        </section>

        {libraryState.status === "error" ? (
          <p
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs leading-5 text-red-800"
          >
            No pudimos cargar la biblioteca en este momento. Recarga la página; si el problema
            continúa, avisa a tu tutor.
          </p>
        ) : null}
        {actionError ? (
          <p
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs leading-5 text-red-800"
          >
            {actionError}
          </p>
        ) : null}

        {libraryState.status === "loading" ? (
          <div role="status" className="flex items-center gap-3 py-10 text-sm text-muted-fg">
            <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />
            Cargando recursos...
          </div>
        ) : null}

        {library && resources.length === 0 ? (
          <section className="rounded-3xl border border-dashed border-line bg-surface-muted p-10 text-center">
            <Inbox className="mx-auto h-8 w-8 text-muted-fg" aria-hidden="true" />
            <h2 className="mt-3 text-base font-bold">Aún no hay recursos publicados</h2>
            <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-muted-fg">
              Cuando la coordinación académica publique material para tu distrito, lo encontrarás
              aquí.
            </p>
          </section>
        ) : null}

        {library && resources.length > 0 ? (
          <>
            <section className="space-y-4">
              <div className="flex flex-col gap-3 md:flex-row">
                <label className="relative flex-1">
                  <span className="sr-only">Buscar recursos</span>
                  <Search
                    className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-muted-fg"
                    aria-hidden="true"
                  />
                  <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Buscar por título o descripción"
                    className="w-full rounded-xl border border-line bg-surface py-3 pr-4 pl-10 text-sm"
                  />
                </label>
                <label className="md:w-56">
                  <span className="sr-only">Filtrar por tipo</span>
                  <select
                    value={type}
                    onChange={(event) => setType(event.target.value)}
                    className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm"
                  >
                    <option value="all">Todos los tipos</option>
                    {usedTypes.map((item) => (
                      <option key={item} value={item}>
                        {RESOURCE_TYPES[item] ?? typeLabel(item)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {usedCategories.length > 1 ? (
                <div
                  role="group"
                  aria-label="Filtrar por categoría"
                  className="flex flex-wrap gap-2"
                >
                  {[{ id: "all", name: "Todas" }, ...usedCategories].map((category) => (
                    <button
                      key={category.id}
                      type="button"
                      aria-pressed={categoryId === category.id}
                      onClick={() => setCategoryId(category.id)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                        categoryId === category.id
                          ? "border-decom-blue bg-decom-blue-soft text-decom-blue-text"
                          : "border-line bg-surface text-muted-fg hover:bg-surface-muted"
                      }`}
                    >
                      {category.name}
                    </button>
                  ))}
                </div>
              ) : null}

              <p role="status" className="text-xs text-muted-fg">
                Mostrando {visible.length} de {resources.length}{" "}
                {resources.length === 1 ? "recurso" : "recursos"}
              </p>
            </section>

            {visible.length === 0 ? (
              <section className="rounded-3xl border border-dashed border-line bg-surface-muted p-10 text-center">
                <h2 className="text-base font-bold">No encontramos recursos con ese criterio</h2>
                {hasFilters ? (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery("");
                      setCategoryId("all");
                      setType("all");
                    }}
                    className="mt-4 rounded-xl border border-line bg-surface px-4 py-2.5 text-xs font-semibold text-foreground hover:bg-surface-muted"
                  >
                    Limpiar filtros
                  </button>
                ) : null}
              </section>
            ) : (
              <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {visible.map((resource) => {
                  const Icon = TYPE_ICONS[resource.resource_type] ?? FileText;
                  const mode = resourceOpenMode(resource);
                  const size = formatFileSize(resource.size_bytes);
                  const course = resource.course_id ? library.courseTitles[resource.course_id] : "";
                  const meta = [
                    categoryNames.get(resource.category_id),
                    course,
                    `v${resource.version_label}`,
                    size,
                    formatDate(resource.published_at),
                  ].filter(Boolean);
                  return (
                    <li
                      key={resource.id}
                      className="flex flex-col rounded-2xl border border-line bg-surface p-5 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-decom-blue-soft text-decom-blue-text">
                          <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
                        </span>
                        <span className="rounded-full bg-surface-muted px-2.5 py-1 text-[10px] font-bold text-muted-fg">
                          {typeLabel(resource.resource_type)}
                        </span>
                      </div>
                      <h2 className="mt-4 text-sm font-bold">{resource.title}</h2>
                      <p className="mt-1.5 line-clamp-3 flex-1 text-xs leading-5 text-muted-fg">
                        {resource.description}
                      </p>
                      <p className="mt-3 text-[11px] leading-5 text-muted-fg">{meta.join(" · ")}</p>
                      <div className="mt-4 border-t border-line-soft pt-4">
                        {mode === "none" ? (
                          <p className="text-xs text-muted-fg">Contenido no disponible.</p>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void handleOpen(resource)}
                            disabled={openingId === resource.id}
                            className="inline-flex items-center gap-2 rounded-xl bg-decom-blue px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-decom-blue-hover disabled:opacity-60"
                          >
                            {openingId === resource.id ? (
                              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                            ) : mode === "link" ? (
                              <ExternalLink className="h-4 w-4" aria-hidden="true" />
                            ) : null}
                            {ACTION_LABELS[mode]}
                            <span className="sr-only"> {resource.title}</span>
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        ) : null}
      </div>

      {reading ? (
        <dialog
          ref={(element) => {
            if (element && !element.open) element.showModal();
          }}
          onClose={() => setReading(null)}
          onClick={(event) => {
            if (event.target === event.currentTarget) event.currentTarget.close();
          }}
          aria-labelledby="reading-title"
          className="m-auto w-[calc(100%-2rem)] max-w-2xl rounded-3xl border border-line bg-surface p-6 text-foreground shadow-2xl backdrop:bg-black/50"
        >
          <p className="text-xs font-semibold text-muted-fg">
            {typeLabel(reading.resource_type)} · v{reading.version_label}
          </p>
          <h2 id="reading-title" className="mt-1 text-lg font-bold">
            {reading.title}
          </h2>
          <div className="mt-4 max-h-[60vh] overflow-y-auto text-sm leading-7 whitespace-pre-wrap text-foreground">
            {reading.content}
          </div>
          <button
            type="button"
            onClick={(event) => event.currentTarget.closest("dialog")?.close()}
            className="mt-6 w-full rounded-xl bg-decom-blue px-4 py-3 text-sm font-semibold text-white hover:bg-decom-blue-hover"
          >
            Cerrar
          </button>
        </dialog>
      ) : null}
    </main>
  );
}
