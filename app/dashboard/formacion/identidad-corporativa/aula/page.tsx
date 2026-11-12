"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Section = "lesson" | "activity" | "resources" | "exam";

const sections: { id: Section; label: string; number: string }[] = [
  { id: "lesson", label: "Lección", number: "01" },
  { id: "activity", label: "Actividad práctica", number: "02" },
  { id: "resources", label: "Recursos", number: "03" },
  { id: "exam", label: "Evaluación final", number: "04" },
];

export default function ClassroomPreviewPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<Section>("lesson");

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
      <main className="flex min-h-screen items-center justify-center bg-[#F4F7FA] p-6">
        <p className="text-sm text-slate-500">Verificando tu sesión...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F4F7FA] text-[#102D4D]">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#087DB5]">Aula virtual · Curso 01</p>
            <h1 className="mt-1 text-xl font-bold">Identidad corporativa DECOM</h1>
          </div>
          <button
            type="button"
            onClick={() => router.push("/dashboard/formacion/identidad-corporativa")}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold hover:border-[#087DB5] hover:text-[#087DB5]"
          >
            ← Volver al curso
          </button>
        </header>

        <div className="mt-7 grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-4">
            <p className="px-2 text-xs font-bold uppercase tracking-wide text-slate-400">Espacio del estudiante</p>
            <div className="mt-4 rounded-xl bg-[#087DB5]/5 p-3">
              <p className="text-xs font-semibold text-[#087DB5]">Ruta secuencial</p>
              <p className="mt-1 text-sm font-bold">Curso 1 de la formación</p>
              <p className="mt-1 text-xs text-slate-500">El avance se activará al publicar las lecciones.</p>
            </div>

            <nav aria-label="Secciones del aula" className="mt-5 space-y-2">
              {sections.map((item) => {
                const selected = section === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSection(item.id)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold transition ${selected ? "bg-[#087DB5] text-white" : "text-slate-600 hover:bg-slate-50"}`}
                  >
                    <span className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs ${selected ? "bg-white/15" : "bg-slate-100 text-slate-500"}`}>{item.number}</span>
                    {item.label}
                  </button>
                );
              })}
            </nav>

            <div className="mt-5 rounded-xl border border-dashed border-slate-200 p-3">
              <p className="text-xs font-semibold text-slate-500">Estado del curso</p>
              <p className="mt-2 inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800">En preparación</p>
              <p className="mt-2 text-xs leading-5 text-slate-400">No se registran porcentajes ni calificaciones hasta conectar el sistema académico.</p>
            </div>
          </aside>

          <section className="min-w-0">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-bold text-amber-900">Prototipo de aula: contenido no publicado</p>
              <p className="mt-1 text-sm leading-6 text-amber-800">
                Esta interfaz muestra cómo se organizará el aprendizaje. Las lecciones, entregas y evaluaciones reales se habilitarán cuando se configure el curso y se conecte el backend.
              </p>
            </div>

            {section === "lesson" && (
              <div className="mt-5 space-y-5">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
                  <p className="text-xs font-bold uppercase tracking-wide text-[#19A7A0]">Lección seleccionada</p>
                  <h2 className="mt-2 text-2xl font-bold">Contenido de aprendizaje</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-500">El docente o editor académico organizará aquí las lecciones y sus materiales.</p>
                  <div className="mt-6 flex aspect-video flex-col items-center justify-center rounded-2xl bg-[#102D4D] px-6 text-center text-white">
                    <span className="flex h-14 w-14 items-center justify-center rounded-full border border-white/25 bg-white/10 text-2xl">▶</span>
                    <p className="mt-4 font-semibold">Reproductor de video</p>
                    <p className="mt-1 text-xs text-blue-200">El recurso se mostrará cuando el contenido sea publicado.</p>
                  </div>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    {[
                      ["Texto", "Lecturas y explicaciones dentro del aula"],
                      ["Imagen", "Material gráfico y recursos visuales"],
                      ["Audio", "Clases, locuciones y archivos sonoros"],
                      ["PDF y documentos", "Manuales, guías y documentos descargables"],
                      ["Presentaciones", "Material de apoyo para cada tema"],
                      ["Video", "Lecciones audiovisuales con seguimiento de reproducción"],
                    ].map(([title, description]) => (
                      <div key={title} className="rounded-xl border border-slate-200 p-4">
                        <p className="text-sm font-bold">{title}</p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {section === "activity" && (
              <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
                <p className="text-xs font-bold uppercase tracking-wide text-[#19A7A0]">Trabajo del estudiante</p>
                <h2 className="mt-2 text-2xl font-bold">Actividades prácticas obligatorias</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">Cada actividad tendrá instrucciones, criterios de entrega, fecha cuando aplique y estado de revisión.</p>
                <div className="mt-6 rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center">
                  <span className="text-3xl">↑</span>
                  <h3 className="mt-3 font-bold">Zona de entrega de evidencias</h3>
                  <p className="mt-2 text-sm text-slate-500">Aquí el estudiante adjuntará sus archivos y enviará la actividad al tutor asignado.</p>
                  <button type="button" disabled className="mt-5 cursor-not-allowed rounded-xl bg-slate-100 px-5 py-3 text-sm font-semibold text-slate-400">Entrega no habilitada</button>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Pendientes</p><p className="mt-1 text-xl font-bold">—</p></div>
                  <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">En revisión</p><p className="mt-1 text-xl font-bold">—</p></div>
                  <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Aprobadas</p><p className="mt-1 text-xl font-bold">—</p></div>
                </div>
                <p className="mt-4 text-xs leading-5 text-slate-400">Todas las actividades requeridas deberán estar aprobadas antes de habilitar el examen final.</p>
              </div>
            )}

            {section === "resources" && (
              <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
                <p className="text-xs font-bold uppercase tracking-wide text-[#19A7A0]">Material complementario</p>
                <h2 className="mt-2 text-2xl font-bold">Recursos del curso</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">Los recursos de consulta estarán organizados por lección y tipo de archivo.</p>
                <div className="mt-6 rounded-xl border border-dashed border-slate-200 p-10 text-center">
                  <span className="text-3xl">▤</span>
                  <p className="mt-3 font-bold">Todavía no hay recursos publicados</p>
                  <p className="mt-1 text-sm text-slate-500">Cuando el editor académico publique los materiales, aparecerán en esta sección.</p>
                </div>
              </div>
            )}

            {section === "exam" && (
              <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
                <p className="text-xs font-bold uppercase tracking-wide text-[#19A7A0]">Comprobación de aprendizaje</p>
                <h2 className="mt-2 text-2xl font-bold">Evaluación final</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">La evaluación se generará individualmente desde el banco de preguntas configurado para el curso.</p>
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  {[
                    ["Preguntas aleatorias", "Cada estudiante recibirá una combinación propia."],
                    ["Respuestas aleatorias", "El orden de opciones cambiará entre intentos."],
                    ["Retroalimentación", "El resultado y las explicaciones se mostrarán al finalizar."],
                    ["Intentos configurables", "Las reglas de recuperación dependerán de la configuración del curso."],
                  ].map(([title, description]) => (
                    <div key={title} className="rounded-xl bg-slate-50 p-4">
                      <p className="text-sm font-bold">{title}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
                    </div>
                  ))}
                </div>
                <button type="button" disabled className="mt-6 cursor-not-allowed rounded-xl bg-slate-100 px-5 py-3 text-sm font-semibold text-slate-400">Evaluación no disponible</button>
              </div>
            )}

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-500">El progreso se guardará cuando se habilite el seguimiento académico.</p>
              <button type="button" onClick={() => router.push("/dashboard/formacion/identidad-corporativa")} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold hover:border-[#087DB5] hover:text-[#087DB5]">Regresar a información del curso</button>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
