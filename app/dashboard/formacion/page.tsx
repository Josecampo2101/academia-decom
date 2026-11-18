"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const curriculum = [
  {
    number: "01",
    title: "Identidad corporativa DECOM",
    area: "Fundamentos institucionales",
    description:
      "Conoce los principios, la identidad, los criterios de comunicación y la responsabilidad del servicio DECOM.",
    status: "available",
    lessons: "Contenido por configurar",
  },
  {
    number: "02",
    title: "Medios escritos",
    area: "Formación por áreas",
    description:
      "Redacción, ortografía, comunicación institucional y producción de contenidos escritos.",
    status: "locked",
    lessons: "Se habilita al aprobar el curso anterior",
  },
  {
    number: "03",
    title: "Medios radiales",
    area: "Formación por áreas",
    description:
      "Locución, guion, producción radial, manejo de voz y criterios editoriales.",
    status: "locked",
    lessons: "Se habilita al aprobar el curso anterior",
  },
  {
    number: "04",
    title: "Medios audiovisuales",
    area: "Formación por áreas",
    description:
      "Producción audiovisual, narrativa, grabación, iluminación y edición.",
    status: "locked",
    lessons: "Se habilita al aprobar el curso anterior",
  },
  {
    number: "05",
    title: "Medios digitales",
    area: "Formación por áreas",
    description:
      "Estrategia digital, redes sociales, publicación y comunicación multiplataforma.",
    status: "locked",
    lessons: "Se habilita al aprobar el curso anterior",
  },
];

export default function FormationPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");

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

      setEmail(data.user.email ?? "");
      setLoading(false);
    }

    void verifySession();

    return () => {
      active = false;
    };
  }, [router]);

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
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-decom-blue text-xl font-bold text-white">
              D
            </div>
            <div>
              <p className="text-sm font-extrabold tracking-[0.12em]">ACADEMIA DECOM</p>
              <p className="text-xs text-muted-fg">Mi formación</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden max-w-56 truncate text-xs text-muted-fg sm:block">{email}</span>
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-semibold transition hover:border-decom-blue hover:text-decom-blue-text"
            >
              ← Volver al panel
            </button>
          </div>
        </header>

        <section className="relative overflow-hidden rounded-3xl bg-decom-navy px-6 py-9 text-white sm:px-10 sm:py-12">
          <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full border border-white/10" />
          <div className="absolute -bottom-36 right-28 h-72 w-72 rounded-full bg-decom-blue/30 blur-3xl" />
          <div className="relative max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-decom-teal-light">
              Ruta de aprendizaje
            </p>
            <h1 className="mt-4 text-3xl font-bold leading-tight sm:text-4xl">
              Tu formación, paso a paso.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-blue-100 sm:text-base">
              Avanza en el orden establecido, desarrolla las actividades prácticas
              y demuestra lo aprendido en cada evaluación. Cada curso aprobado
              habilitará el siguiente.
            </p>
            <div className="mt-7 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold text-blue-50">
              <span className="h-2 w-2 rounded-full bg-[#55D1C4]" />
              Formación secuencial y autogestionada
            </div>
          </div>
        </section>

        <section className="mt-7 grid gap-4 sm:grid-cols-3">
          <article className="rounded-2xl border border-line bg-surface p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-fg">Tu avance</p>
            <p className="mt-3 text-2xl font-bold text-foreground">—</p>
            <p className="mt-1 text-xs text-muted-fg">Se mostrará al activar el registro académico</p>
          </article>
          <article className="rounded-2xl border border-line bg-surface p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-fg">Cursos aprobados</p>
            <p className="mt-3 text-2xl font-bold text-foreground">—</p>
            <p className="mt-1 text-xs text-muted-fg">Sin datos de evaluación todavía</p>
          </article>
          <article className="rounded-2xl border border-line bg-surface p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-fg">Siguiente paso</p>
            <p className="mt-3 text-lg font-bold text-decom-blue-text">Identidad corporativa</p>
            <p className="mt-1 text-xs text-muted-fg">Primer curso de la ruta formativa</p>
          </article>
        </section>

        <section className="mt-9">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-decom-blue-text">Plan de estudios</p>
              <h2 className="mt-2 text-2xl font-bold">Ruta formativa DECOM</h2>
              <p className="mt-2 text-sm text-muted-fg">
                Los cursos se completan en orden. Las actividades obligatorias deben ser aprobadas antes del examen final.
              </p>
            </div>
            <span className="rounded-full bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
              Vista preliminar · Contenidos por configurar
            </span>
          </div>

          <div className="space-y-4">
            {curriculum.map((course, index) => {
              const isAvailable = course.status === "available";

              return (
                <article
                  key={course.number}
                  className={`overflow-hidden rounded-2xl border bg-surface transition ${isAvailable ? "border-decom-blue/30 shadow-sm" : "border-line"}`}
                >
                  <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:p-6">
                    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-sm font-bold ${isAvailable ? "bg-decom-blue text-white" : "bg-surface-muted text-muted-fg"}`}>
                      {isAvailable ? course.number : "🔒"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-decom-teal-text">{course.area}</p>
                        {isAvailable ? (
                          <span className="rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-bold text-decom-blue-text">Primer curso</span>
                        ) : (
                          <span className="rounded-full bg-surface-muted px-2.5 py-1 text-[11px] font-semibold text-muted-fg">Bloqueado por secuencia</span>
                        )}
                      </div>
                      <h3 className="mt-2 text-lg font-bold text-foreground">{course.title}</h3>
                      <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-fg">{course.description}</p>
                      <p className="mt-3 text-xs text-muted-fg">{course.lessons}</p>
                    </div>
                    <div className="sm:pl-4">
                      {isAvailable ? (
                        <a
                          href="/dashboard/formacion/identidad-corporativa"
                          className="inline-flex w-full items-center justify-center rounded-xl bg-decom-blue px-5 py-3 text-sm font-semibold text-white transition hover:bg-decom-blue-hover sm:w-auto"
                        >
                          Ver estructura del curso
                        </a>
                      ) : (
                        <button
                          type="button"
                          disabled
                          title="Se habilitará al aprobar el curso anterior"
                          className="w-full cursor-not-allowed rounded-xl bg-surface-muted px-5 py-3 text-sm font-semibold text-muted-fg sm:w-auto"
                        >
                          Curso bloqueado
                        </button>
                      )}
                    </div>
                  </div>
                  {index < curriculum.length - 1 && (
                    <div className="h-px bg-surface-muted" />
                  )}
                </article>
              );
            })}
          </div>
        </section>

        <section className="mt-9 rounded-2xl border border-line bg-surface p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-decom-teal/10 text-lg text-decom-teal-text">i</div>
            <div>
              <h2 className="font-bold">¿Cómo funciona tu formación?</h2>
              <p className="mt-2 text-sm leading-6 text-muted-fg">
                Cada curso tendrá lecciones en distintos formatos, actividades prácticas
                obligatorias, acompañamiento de tutor y un examen final. Al aprobarlo,
                se registrará tu resultado y se desbloqueará el siguiente curso.
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
