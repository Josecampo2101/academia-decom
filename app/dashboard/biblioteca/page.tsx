"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const categories = [
  {
    id: "documents",
    title: "Manuales y documentos",
    description: "Manuales institucionales, guías, lecturas y archivos PDF.",
    formats: "PDF · DOCX · TXT",
    icon: "▤",
  },
  {
    id: "audiovisual",
    title: "Video, audio y radio",
    description: "Clases grabadas, piezas radiales, locuciones y material sonoro.",
    formats: "VIDEO · AUDIO",
    icon: "▶",
  },
  {
    id: "presentations",
    title: "Presentaciones",
    description: "Diapositivas y materiales de apoyo para procesos de formación.",
    formats: "PPTX · PDF",
    icon: "▥",
  },
  {
    id: "visual",
    title: "Imágenes y diseño",
    description: "Piezas gráficas, fotografías, referencias visuales y recursos de diseño.",
    formats: "PNG · JPG · SVG",
    icon: "▧",
  },
  {
    id: "templates",
    title: "Plantillas y descargables",
    description: "Formatos editables, modelos de trabajo y recursos reutilizables.",
    formats: "DOCX · XLSX · ZIP",
    icon: "⇩",
  },
];

export default function LibraryPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  useEffect(() => {
    let active = true;

    async function verifySession() {
      const supabase = createClient();
      const { data, error } = await supabase.auth.getUser();

      if (!active) return;

      if (error || !data.user) {
        router.replace("/");
        return;
      }

      setLoading(false);
    }

    void verifySession();

    return () => {
      active = false;
    };
  }, [router]);

  const filteredCategories = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("es");

    return categories.filter((category) => {
      const matchesCategory =
        selectedCategory === "all" || category.id === selectedCategory;
      const matchesSearch =
        !term ||
        [category.title, category.description, category.formats]
          .join(" ")
          .toLocaleLowerCase("es")
          .includes(term);

      return matchesCategory && matchesSearch;
    });
  }, [search, selectedCategory]);

  if (loading) {
    return (
      <main id="contenido" className="flex min-h-screen items-center justify-center bg-background p-6">
        <p className="text-sm text-muted-fg">Verificando tu sesión...</p>
      </main>
    );
  }

  return (
    <main id="contenido" className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-decom-teal text-xl font-bold text-decom-navy">
              ▣
            </div>
            <div>
              <p className="text-sm font-extrabold tracking-[0.12em]">ACADEMIA DECOM</p>
              <p className="text-xs text-muted-fg">Biblioteca institucional</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-semibold transition hover:border-decom-blue hover:text-decom-blue-text"
          >
            ← Volver al panel
          </button>
        </header>

        <section className="relative overflow-hidden rounded-3xl bg-decom-navy px-6 py-9 text-white sm:px-10 sm:py-12">
          <div className="absolute -right-16 -top-24 h-72 w-72 rounded-full border border-white/10" />
          <div className="absolute -bottom-36 right-28 h-72 w-72 rounded-full bg-decom-teal/25 blur-3xl" />
          <div className="relative max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-decom-teal-light">
              Centro de recursos
            </p>
            <h1 className="mt-4 text-3xl font-bold leading-tight sm:text-4xl">
              Conocimiento y herramientas para comunicar con propósito.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-blue-100 sm:text-base">
              Consulta materiales de formación, documentos institucionales y recursos
              para el trabajo de las diferentes áreas de DECOM.
            </p>
          </div>
        </section>

        <section className="mt-7 rounded-2xl border border-line bg-surface p-5 sm:p-6">
          <label htmlFor="library-search" className="text-sm font-bold">
            Buscar en la biblioteca
          </label>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <input
              id="library-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nombre, tema o formato..."
              className="min-w-0 flex-1 rounded-xl border border-line bg-surface-muted px-4 py-3 text-sm outline-none transition focus:border-decom-blue focus:ring-2 focus:ring-decom-blue/10"
            />
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setSelectedCategory("all");
              }}
              className="rounded-xl border border-line px-4 py-3 text-sm font-semibold text-muted-fg transition hover:border-decom-blue hover:text-decom-blue-text"
            >
              Limpiar filtros
            </button>
          </div>

          <div className="mt-5 flex flex-wrap gap-2" aria-label="Filtrar por categoría">
            <button
              type="button"
              onClick={() => setSelectedCategory("all")}
              aria-pressed={selectedCategory === "all"}
              className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                selectedCategory === "all"
                  ? "bg-decom-blue text-white"
                  : "bg-surface-muted text-muted-fg hover:bg-slate-200"
              }`}
            >
              Todas las categorías
            </button>
            {categories.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => setSelectedCategory(category.id)}
                aria-pressed={selectedCategory === category.id}
                className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                  selectedCategory === category.id
                    ? "bg-decom-blue text-white"
                    : "bg-surface-muted text-muted-fg hover:bg-slate-200"
                }`}
              >
                {category.title}
              </button>
            ))}
          </div>
        </section>

        <section className="mt-9">
          <div className="mb-5">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-decom-blue-text">
              Explorar recursos
            </p>
            <h2 className="mt-2 text-2xl font-bold">Categorías de la biblioteca</h2>
            <p className="mt-2 text-sm text-muted-fg">
              Los materiales se organizarán por tipo para facilitar su consulta y descarga.
            </p>
          </div>

          {filteredCategories.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filteredCategories.map((category) => (
                <article
                  key={category.id}
                  className="rounded-2xl border border-line bg-surface p-5 transition hover:-translate-y-0.5 hover:border-decom-teal/50 hover:shadow-sm"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-decom-teal/10 text-2xl text-decom-teal-text">
                    {category.icon}
                  </div>
                  <h3 className="mt-5 text-lg font-bold">{category.title}</h3>
                  <p className="mt-2 min-h-12 text-sm leading-6 text-muted-fg">
                    {category.description}
                  </p>
                  <div className="mt-5 flex items-center justify-between border-t border-line-soft pt-4">
                    <span className="text-[10px] font-bold tracking-wider text-muted-fg">
                      {category.formats}
                    </span>
                    <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-800">
                      Por habilitar
                    </span>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-line bg-surface p-10 text-center">
              <p className="font-bold">No encontramos categorías</p>
              <p className="mt-2 text-sm text-muted-fg">
                Prueba con otro término o limpia los filtros.
              </p>
            </div>
          )}
        </section>

        <section className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-start gap-3">
            <span className="text-xl text-amber-700">i</span>
            <div>
              <h2 className="font-bold text-amber-900">Biblioteca en preparación</h2>
              <p className="mt-1 text-sm leading-6 text-amber-800">
                Esta vista presenta la organización prevista. Aún no hay archivos publicados
                ni favoritos guardados; las búsquedas y filtros funcionan sobre las categorías,
                pero no consultan recursos reales.
              </p>
            </div>
          </div>
        </section>

        <footer className="py-8 text-center text-xs text-muted-fg">
          Academia DECOM · Formación para comunicar con propósito.
        </footer>
      </div>
    </main>
  );
}
