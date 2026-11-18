"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const stages = [
  {
    number: "01",
    title: "Bienvenida e introducción",
    description: "Presentación del propósito, alcance y organización del curso.",
    status: "Pendiente de contenido",
  },
  {
    number: "02",
    title: "Lecciones de formación",
    description: "Espacio para contenidos audiovisuales, lecturas y recursos de apoyo.",
    status: "Pendiente de contenido",
  },
  {
    number: "03",
    title: "Actividades prácticas",
    description: "Entrega de evidencias por parte del estudiante y revisión del tutor asignado.",
    status: "Pendiente de configuración",
  },
  {
    number: "04",
    title: "Evaluación final",
    description: "Examen individual generado desde el banco de preguntas del curso.",
    status: "Pendiente de configuración",
  },
  {
    number: "05",
    title: "Reconocimiento",
    description: "Certificado digital al cumplir los requisitos académicos de aprobación.",
    status: "Pendiente de configuración",
  },
];

export default function IdentityCoursePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return (
      <main id="contenido" className="flex min-h-screen items-center justify-center bg-background p-6">
        <p className="text-sm text-muted-fg">Verificando tu sesión...</p>
      </main>
    );
  }

  return (
    <main id="contenido" className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={() => router.push("/dashboard/formacion")}
          className="mb-6 text-sm font-semibold text-decom-blue-text hover:text-[#066895]"
        >
          ← Volver a Mi formación
        </button>

        <section className="overflow-hidden rounded-3xl bg-decom-navy p-7 text-white sm:p-10">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-decom-teal-light">
            Curso 01 · Fundamentos institucionales
          </p>
          <h1 className="mt-4 max-w-3xl text-3xl font-bold sm:text-4xl">
            Identidad corporativa DECOM
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-blue-100">
            Primer curso de la ruta obligatoria de Academia DECOM. Su contenido,
            actividades y evaluación se publicarán cuando se complete la
            configuración académica.
          </p>
          <div className="mt-7 flex flex-wrap gap-2">
            <span className="rounded-full border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold">
              Obligatorio
            </span>
            <span className="rounded-full border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold">
              Autogestionado
            </span>
            <span className="rounded-full border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold">
              Incluye examen final
            </span>
          </div>
        </section>

        <section className="mt-7 rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-start gap-3">
            <span className="text-lg text-amber-700">!</span>
            <div>
              <h2 className="font-bold text-amber-900">Curso en preparación</h2>
              <p className="mt-1 text-sm leading-6 text-amber-800">
                Esta es la estructura visual inicial. No hay lecciones publicadas
                ni actividades habilitadas todavía; no se registrará avance hasta
                conectar el contenido académico real.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-7 rounded-2xl border border-decom-blue/20 bg-surface p-5 sm:flex sm:items-center sm:justify-between sm:gap-5">
          <div>
            <h2 className="font-bold">Explorar el aula virtual</h2>
            <p className="mt-1 text-sm leading-6 text-muted-fg">
              Revisa la estructura prevista para lecciones, actividades, recursos y evaluación.
            </p>
          </div>
          <button
            type="button"
            onClick={() => router.push("/dashboard/formacion/identidad-corporativa/aula")}
            className="mt-4 w-full rounded-xl bg-decom-blue px-5 py-3 text-sm font-semibold text-white transition hover:bg-decom-blue-hover sm:mt-0 sm:w-auto"
          >
            Abrir aula de prueba
          </button>
        </section>

        <section className="mt-9">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-decom-blue-text">
              Estructura del curso
            </p>
            <h2 className="mt-2 text-2xl font-bold">Etapas de aprendizaje</h2>
            <p className="mt-2 text-sm text-muted-fg">
              El recorrido académico previsto para cada estudiante.
            </p>
          </div>

          <div className="mt-5 space-y-3">
            {stages.map((stage) => (
              <article
                key={stage.number}
                className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5 sm:flex-row sm:items-center"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-decom-blue/10 text-sm font-bold text-decom-blue-text">
                  {stage.number}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold">{stage.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-muted-fg">{stage.description}</p>
                </div>
                <span className="w-fit rounded-full bg-surface-muted px-3 py-2 text-xs font-semibold text-muted-fg">
                  {stage.status}
                </span>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-2">
          <article className="rounded-2xl border border-line bg-surface p-6">
            <h2 className="font-bold">Requisitos para aprobar</h2>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-muted-fg">
              <li className="flex gap-2"><span className="text-decom-teal-text">✓</span> Completar todas las lecciones obligatorias.</li>
              <li className="flex gap-2"><span className="text-decom-teal-text">✓</span> Entregar las actividades prácticas requeridas.</li>
              <li className="flex gap-2"><span className="text-decom-teal-text">✓</span> Obtener aprobación del tutor en las actividades.</li>
              <li className="flex gap-2"><span className="text-decom-teal-text">✓</span> Aprobar el examen final del curso.</li>
            </ul>
          </article>
          <article className="rounded-2xl border border-line bg-surface p-6">
            <h2 className="font-bold">Al completar el curso</h2>
            <p className="mt-3 text-sm leading-6 text-muted-fg">
              El sistema registrará el resultado, emitirá el certificado
              correspondiente cuando se cumplan los requisitos y habilitará el
              siguiente curso de la ruta.
            </p>
            <div className="mt-5 rounded-xl bg-decom-blue/5 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-decom-blue-text">
                Siguiente curso previsto
              </p>
              <p className="mt-1 font-bold">Medios escritos</p>
            </div>
          </article>
        </section>

        <footer className="py-8 text-center text-xs text-muted-fg">
          Academia DECOM · Formación para comunicar con propósito.
        </footer>
      </div>
    </main>
  );
}
