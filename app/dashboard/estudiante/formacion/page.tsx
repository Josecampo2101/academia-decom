"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type AccessState = "checking" | "allowed" | "denied" | "error";

const modules = [
  {
    title: "Módulo 1 · Conociendo DECOM",
    description: "Propósito, identidad y responsabilidad de la comunicación institucional.",
    status: "Completado",
    lessons: [
      { id: "bienvenida", title: "Bienvenida a Academia DECOM", duration: "5 min", status: "Completada" },
      { id: "que-es-decom", title: "¿Qué es DECOM?", duration: "12 min", status: "Completada" },
      { id: "comunicar-con-proposito", title: "Comunicar con propósito", duration: "10 min", status: "Completada" },
    ],
  },
  {
    title: "Módulo 2 · Identidad institucional",
    description: "Principios, lineamientos y coherencia del mensaje.",
    status: "En progreso",
    lessons: [
      { id: "principios-identidad", title: "Principios de identidad corporativa", duration: "15 min", status: "Completada" },
      { id: "tono-lenguaje", title: "Tono y lenguaje institucional", duration: "12 min", status: "Completada" },
      { id: "coherencia-mensajes", title: "Coherencia en los mensajes", duration: "14 min", status: "En curso" },
    ],
  },
  {
    title: "Módulo 3 · Aplicación práctica",
    description: "Uso responsable de los lineamientos en piezas y publicaciones.",
    status: "Bloqueado",
    lessons: [
      { id: "aplicacion-escritos", title: "Aplicación en medios escritos", duration: "18 min", status: "Bloqueada" },
      { id: "revision-piezas", title: "Revisión de piezas institucionales", duration: "20 min", status: "Bloqueada" },
      { id: "actividad-integradora", title: "Actividad integradora", duration: "30 min", status: "Bloqueada" },
    ],
  },
];

export default function StudentFormationPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [access, setAccess] = useState<AccessState>("checking");
  const [displayName, setDisplayName] = useState("Estudiante");

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

        setDisplayName(String(
          user.user_metadata?.full_name ??
          user.user_metadata?.name ??
          user.email?.split("@")[0] ??
          "Estudiante"
        ));

        const { data: assignments, error: assignmentsError } = await supabase
          .from("user_role_assignments")
          .select("role_id")
          .eq("user_id", user.id);
        if (assignmentsError) throw assignmentsError;
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
        setAccess(keys.includes("member") || keys.includes("national_admin") ? "allowed" : "denied");
      } catch (error) {
        console.error("No fue posible validar el acceso a Mi formación:", error);
        if (active) setAccess("error");
      }
    }

    void Promise.resolve().then(verifyAccess);
    return () => {
      active = false;
    };
  }, [router, supabase]);

  if (access === "checking") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F4F7FA]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#087DB5]/20 border-t-[#087DB5]" />
      </main>
    );
  }

  if (access !== "allowed") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F4F7FA] px-6">
        <section className="max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center">
          <h1 className="text-xl font-bold text-[#102D4D]">{access === "error" ? "No pudimos validar tu acceso" : "Acceso restringido"}</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">{access === "error" ? "Intenta nuevamente en unos momentos." : "Esta sección está habilitada para estudiantes con una asignación vigente."}</p>
          <button type="button" onClick={() => router.push("/dashboard")} className="mt-5 rounded-xl bg-[#087DB5] px-5 py-3 text-sm font-semibold text-white">Volver al panel</button>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F4F7FA] text-[#102D4D]">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 md:px-8">
          <div>
            <p className="text-xs font-extrabold tracking-[0.14em] text-[#087DB5]">ACADEMIA DECOM</p>
            <p className="mt-1 text-xs text-slate-400">Mi espacio de aprendizaje</p>
          </div>
          <button type="button" onClick={() => router.push("/dashboard/estudiante")} className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">← Panel del estudiante</button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-7 px-5 py-7 pb-12 md:px-8 md:py-9">
        <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#19A7A0]">Ruta de aprendizaje</p>
            <h1 className="mt-2 text-2xl font-extrabold md:text-3xl">Mi formación</h1>
            <p className="mt-2 text-sm text-slate-500">Hola, {displayName}. Aquí puedes consultar el recorrido de tus cursos.</p>
          </div>
          <span className="w-fit rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800">Vista de demostración</span>
        </section>

        <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-[#075B8D] to-[#19A7A0] p-6 text-white md:p-8">
          <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <span className="rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider">Curso inicial</span>
              <h2 className="mt-4 text-2xl font-bold">Identidad corporativa DECOM</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/80">Comprende la identidad institucional y aprende a aplicarla con coherencia en los diferentes medios de comunicación.</p>
            </div>
            <div className="rounded-2xl border border-white/20 bg-white/10 p-5 text-center">
              <p className="text-4xl font-extrabold tabular-nums">68%</p>
              <p className="mt-1 text-xs text-white/75">Avance de ejemplo</p>
              <p className="mt-3 text-xs font-semibold">7 de 10 lecciones</p>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {[
            { title: "Fundamentos", description: "Comprende el propósito y la identidad.", state: "Completado", color: "text-teal-700 bg-teal-50" },
            { title: "Medios de comunicación", description: "Desarrolla habilidades por área.", state: "Siguiente etapa", color: "text-sky-700 bg-sky-50" },
            { title: "Especialización", description: "Profundiza en técnicas y herramientas.", state: "Bloqueado", color: "text-slate-500 bg-slate-100" },
          ].map((item) => (
            <article key={item.title} className="rounded-2xl border border-slate-200 bg-white p-5">
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${item.color}`}>{item.state}</span>
              <h3 className="mt-4 text-sm font-bold">{item.title}</h3>
              <p className="mt-1 text-xs leading-5 text-slate-400">{item.description}</p>
            </article>
          ))}
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-7">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Contenido del curso</p>
              <h2 className="mt-1 text-lg font-bold">Módulos y lecciones</h2>
            </div>
            <p className="text-xs text-slate-400">3 módulos · 9 lecciones visibles</p>
          </div>
          <div className="mt-5 space-y-3">
            {modules.map((module, index) => (
              <details key={module.title} open={index === 1} className="group rounded-2xl border border-slate-200">
                <summary className="flex cursor-pointer list-none flex-col justify-between gap-3 p-4 marker:hidden sm:flex-row sm:items-center">
                  <div className="flex items-start gap-3">
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${
                      module.status === "Completado" ? "bg-teal-50 text-teal-700" : module.status === "En progreso" ? "bg-sky-50 text-sky-700" : "bg-slate-100 text-slate-400"
                    }`}>{index + 1}</span>
                    <div>
                      <h3 className="text-sm font-bold">{module.title}</h3>
                      <p className="mt-1 text-xs leading-5 text-slate-400">{module.description}</p>
                    </div>
                  </div>
                  <span className="flex items-center gap-3 pl-12 sm:pl-0">
                    <span className="text-xs font-semibold text-slate-500">{module.status}</span>
                    <span aria-hidden="true" className="text-slate-400 transition group-open:rotate-180">⌄</span>
                  </span>
                </summary>
                <div className="border-t border-slate-100 px-4 py-2">
                  {module.lessons.map((lesson, lessonIndex) => (
                    <div key={lesson.title} className="flex items-center gap-3 border-b border-slate-50 py-3 last:border-0">
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs ${
                        lesson.status === "Completada" ? "bg-teal-50 text-teal-700" : lesson.status === "En curso" ? "bg-sky-50 text-sky-700" : "bg-slate-100 text-slate-400"
                      }`}>{lesson.status === "Completada" ? "✓" : lesson.status === "Bloqueada" ? "⌑" : "▶"}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-slate-700">{lesson.title}</p>
                        <p className="mt-1 text-[10px] text-slate-400">{lesson.duration}</p>
                      </div>
                      <span className="text-[10px] font-semibold text-slate-400">{lesson.status}</span>
                      {lesson.status !== "Bloqueada" && <button type="button" onClick={() => router.push(`/dashboard/estudiante/leccion/${lesson.id}`)} className="rounded-lg bg-[#087DB5] px-3 py-2 text-[10px] font-bold text-white hover:bg-[#066a9b]">{lesson.status === "En curso" ? "Continuar" : "Repasar"}</button>}
                      {lesson.status === "Bloqueada" && <span className="text-xs text-slate-300" aria-label="Lección bloqueada">🔒</span>}
                      {lessonIndex === 0 && module.status === "Completado" && <span className="sr-only">Primera lección completada</span>}
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </div>
          <p className="mt-5 rounded-xl bg-[#F4F7FA] p-4 text-xs leading-5 text-slate-500">
            Las lecciones bloqueadas se habilitarán al cumplir los requisitos del curso. Los estados y duraciones mostrados son ilustrativos; el sistema todavía no registra avance académico real.
          </p>
        </section>

        <footer className="border-t border-slate-200 pt-5 text-xs text-slate-400">Academia DECOM · Formación para comunicar con propósito.</footer>
      </div>
    </main>
  );
}
