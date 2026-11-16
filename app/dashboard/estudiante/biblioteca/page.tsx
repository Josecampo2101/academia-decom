"use client";

import { StatusScreen } from "@/components/ui/StatusScreen";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type AccessState = "checking" | "allowed" | "denied" | "error";
type Resource = {
  id: string;
  title: string;
  description: string;
  category: string;
  type: "Guía" | "Plantilla" | "Video" | "Lectura";
  duration: string;
  level: string;
  featured?: boolean;
};

const resources: Resource[] = [
  {
    id: "r1",
    title: "Manual de identidad corporativa DECOM",
    description:
      "Principios institucionales, uso de marca, colores y criterios básicos de aplicación.",
    category: "Identidad institucional",
    type: "Guía",
    duration: "12 min de lectura",
    level: "Fundamental",
    featured: true,
  },
  {
    id: "r2",
    title: "Lista de verificación para piezas gráficas",
    description: "Puntos de control para revisar coherencia visual antes de publicar una pieza.",
    category: "Diseño y comunicación",
    type: "Plantilla",
    duration: "5 min",
    level: "Práctico",
  },
  {
    id: "r3",
    title: "Comunicación con propósito",
    description:
      "Lectura introductoria sobre mensaje, audiencia, intención y responsabilidad comunicativa.",
    category: "Fundamentos",
    type: "Lectura",
    duration: "8 min de lectura",
    level: "Fundamental",
  },
  {
    id: "r4",
    title: "Preparación para una cobertura audiovisual",
    description: "Secuencia de preparación, registro y organización del material de una actividad.",
    category: "Medios audiovisuales",
    type: "Guía",
    duration: "10 min de lectura",
    level: "Intermedio",
  },
  {
    id: "r5",
    title: "Fundamentos de fotografía",
    description:
      "Conceptos introductorios de encuadre, luz y composición para registros institucionales.",
    category: "Fotografía",
    type: "Video",
    duration: "14 min",
    level: "Fundamental",
  },
  {
    id: "r6",
    title: "Estructura de una nota informativa",
    description: "Modelo para organizar datos, contexto y redacción de una noticia institucional.",
    category: "Medios escritos",
    type: "Plantilla",
    duration: "6 min",
    level: "Práctico",
  },
];

const categories = [
  "Todos",
  "Identidad institucional",
  "Fundamentos",
  "Diseño y comunicación",
  "Medios audiovisuales",
  "Fotografía",
  "Medios escritos",
];
const typeStyles: Record<Resource["type"], string> = {
  Guía: "bg-sky-50 text-sky-700",
  Plantilla: "bg-teal-50 text-teal-700",
  Video: "bg-violet-50 text-violet-700",
  Lectura: "bg-amber-50 text-amber-700",
};

export default function StudentLibraryPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [access, setAccess] = useState<AccessState>("checking");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Todos");
  const [type, setType] = useState("Todos");
  const [selected, setSelected] = useState<Resource | null>(null);

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
        setAccess(
          keys.includes("member") || keys.includes("national_admin") ? "allowed" : "denied",
        );
      } catch (error) {
        console.error("No fue posible validar el acceso a la biblioteca:", error);
        if (active) setAccess("error");
      }
    }
    void Promise.resolve().then(verifyAccess);
    return () => {
      active = false;
    };
  }, [router, supabase]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("es");
    return resources.filter((item) => {
      const matchesQuery =
        !normalized ||
        [item.title, item.description, item.category].some((value) =>
          value.toLocaleLowerCase("es").includes(normalized),
        );
      return (
        matchesQuery &&
        (category === "Todos" || item.category === category) &&
        (type === "Todos" || item.type === type)
      );
    });
  }, [query, category, type]);

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
            <p className="mt-1 text-xs text-muted-fg">Biblioteca de aprendizaje</p>
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
      <div className="mx-auto max-w-6xl space-y-7 px-5 py-7 md:px-8 md:py-9">
        <section className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-decom-teal-text">
              Recursos para crecer
            </p>
            <h1 className="mt-2 text-2xl font-extrabold md:text-3xl">Biblioteca DECOM</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-fg">
              Consulta materiales de apoyo para fortalecer tus conocimientos y llevarlos a la
              práctica.
            </p>
          </div>
          <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800">
            Catálogo de demostración
          </span>
        </section>
        <section className="rounded-3xl bg-gradient-to-br from-decom-navy to-decom-blue p-6 text-white md:p-8">
          <p className="text-xs font-bold uppercase tracking-wider text-white/70">
            Recurso destacado
          </p>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-2xl">
              <h2 className="text-xl font-extrabold">Manual de identidad corporativa DECOM</h2>
              <p className="mt-2 text-sm leading-6 text-white/75">
                Conoce los fundamentos visuales e institucionales que orientan la comunicación de
                DECOM.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelected(resources[0])}
              className="rounded-xl bg-surface px-4 py-3 text-xs font-bold text-foreground"
            >
              Explorar recurso →
            </button>
          </div>
        </section>
        <section className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[1fr_220px_180px]">
            <label className="relative">
              <span className="sr-only">Buscar recursos</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por título, tema o descripción..."
                className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm outline-none focus:border-decom-blue"
              />
            </label>
            <label>
              <span className="sr-only">Filtrar por categoría</span>
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="w-full rounded-xl border border-line bg-surface px-3 py-3 text-sm text-muted-fg outline-none focus:border-decom-blue"
              >
                {categories.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <label>
              <span className="sr-only">Filtrar por tipo</span>
              <select
                value={type}
                onChange={(event) => setType(event.target.value)}
                className="w-full rounded-xl border border-line bg-surface px-3 py-3 text-sm text-muted-fg outline-none focus:border-decom-blue"
              >
                {["Todos", "Guía", "Plantilla", "Video", "Lectura"].map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Todos los recursos</h2>
            <span className="text-xs text-muted-fg">{filtered.length} resultados</span>
          </div>
          {filtered.length ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((item) => (
                <article
                  key={item.id}
                  className="flex flex-col rounded-2xl border border-line bg-surface p-5 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${typeStyles[item.type]}`}
                    >
                      {item.type}
                    </span>
                    <span className="text-[10px] font-semibold text-muted-fg">{item.level}</span>
                  </div>
                  <h3 className="mt-4 text-sm font-bold">{item.title}</h3>
                  <p className="mt-2 flex-1 text-xs leading-5 text-muted-fg">{item.description}</p>
                  <div className="mt-4 flex items-center justify-between border-t border-line-soft pt-3">
                    <span className="text-[10px] text-muted-fg">
                      {item.category} · {item.duration}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelected(item)}
                      className="shrink-0 text-xs font-bold text-decom-blue-text hover:underline"
                    >
                      Ver detalle →
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-line bg-surface p-10 text-center">
              <h3 className="text-sm font-bold">No encontramos recursos</h3>
              <p className="mt-2 text-xs text-muted-fg">
                Prueba con otra búsqueda o cambia los filtros.
              </p>
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setCategory("Todos");
                  setType("Todos");
                }}
                className="mt-4 text-xs font-bold text-decom-blue-text"
              >
                Limpiar filtros
              </button>
            </div>
          )}
        </section>
        <p className="text-[11px] leading-5 text-muted-fg">
          Los recursos son ejemplos de catálogo. La descarga, reproducción, favoritos y permisos por
          curso se conectarán cuando se apruebe el módulo documental y su almacenamiento.
        </p>
      </div>
      {selected && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/40 p-4 sm:items-center">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="resource-title"
            className="w-full max-w-lg rounded-3xl bg-surface p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <span
                className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${typeStyles[selected.type]}`}
              >
                {selected.type}
              </span>
              <button
                type="button"
                aria-label="Cerrar detalle"
                onClick={() => setSelected(null)}
                className="rounded-lg px-3 py-1 text-lg text-muted-fg hover:bg-surface-muted"
              >
                ×
              </button>
            </div>
            <h2 id="resource-title" className="mt-4 text-lg font-bold">
              {selected.title}
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-fg">{selected.description}</p>
            <dl className="mt-5 grid grid-cols-2 gap-3 rounded-xl bg-surface-muted p-4 text-xs">
              <div>
                <dt className="text-muted-fg">Categoría</dt>
                <dd className="mt-1 font-semibold">{selected.category}</dd>
              </div>
              <div>
                <dt className="text-muted-fg">Nivel</dt>
                <dd className="mt-1 font-semibold">{selected.level}</dd>
              </div>
              <div>
                <dt className="text-muted-fg">Duración</dt>
                <dd className="mt-1 font-semibold">{selected.duration}</dd>
              </div>
              <div>
                <dt className="text-muted-fg">Tipo</dt>
                <dd className="mt-1 font-semibold">{selected.type}</dd>
              </div>
            </dl>
            <p className="mt-4 text-xs leading-5 text-amber-700">
              Este elemento es una ficha de demostración; todavía no existe un archivo o contenido
              multimedia conectado.
            </p>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="mt-5 w-full rounded-xl bg-decom-blue px-4 py-3 text-sm font-semibold text-white"
            >
              Cerrar
            </button>
          </section>
        </div>
      )}
    </main>
  );
}
