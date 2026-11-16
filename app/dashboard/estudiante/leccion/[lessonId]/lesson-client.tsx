"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type AccessState = "checking" | "allowed" | "denied" | "error";

const lessonContent: Record<
  string,
  {
    title: string;
    module: string;
    duration: string;
    objective: string;
    paragraphs: string[];
    keyPoints: string[];
    previous?: string;
    next?: string;
    nextTitle?: string;
    activity?: string;
  }
> = {
  bienvenida: {
    title: "Bienvenida a Academia DECOM",
    module: "Módulo 1 · Conociendo DECOM",
    duration: "5 minutos",
    objective:
      "Reconocer el propósito de la Academia DECOM y la manera en que acompañará tu formación.",
    paragraphs: [
      "Academia DECOM es un espacio de formación para fortalecer las capacidades de quienes sirven en la comunicación institucional. Su propósito es acompañar el aprendizaje con contenidos organizados, actividades y orientación.",
      "El proceso formativo se desarrolla de manera progresiva. Cada curso reúne módulos y lecciones que permiten comprender los fundamentos y llevarlos a la práctica.",
      "La formación no se limita a aprender herramientas: busca desarrollar criterio, responsabilidad y claridad para comunicar con propósito.",
    ],
    keyPoints: [
      "Avanza en el orden propuesto por la ruta formativa.",
      "Lee los objetivos antes de desarrollar cada actividad.",
      "Aplica lo aprendido con responsabilidad y coherencia institucional.",
    ],
    next: "que-es-decom",
    nextTitle: "¿Qué es DECOM?",
  },
  "que-es-decom": {
    title: "¿Qué es DECOM?",
    module: "Módulo 1 · Conociendo DECOM",
    duration: "12 minutos",
    objective: "Comprender el papel de DECOM en la organización y el servicio de comunicación.",
    paragraphs: [
      "DECOM articula el trabajo de comunicación y medios para apoyar la difusión clara, oportuna y responsable de las actividades y mensajes institucionales.",
      "Su labor requiere coordinación, planificación y conocimiento de los públicos. Cada medio tiene características propias, pero todos deben conservar coherencia con el propósito institucional.",
      "El servicio de comunicación se construye en equipo. La coordinación entre las diferentes áreas permite que el mensaje llegue de manera comprensible y ordenada.",
    ],
    keyPoints: [
      "La comunicación es un servicio que requiere responsabilidad.",
      "Los medios trabajan de forma coordinada.",
      "La claridad del mensaje debe orientar las decisiones.",
    ],
    previous: "bienvenida",
    next: "comunicar-con-proposito",
    nextTitle: "Comunicar con propósito",
  },
  "comunicar-con-proposito": {
    title: "Comunicar con propósito",
    module: "Módulo 1 · Conociendo DECOM",
    duration: "10 minutos",
    objective:
      "Identificar los elementos que hacen que una comunicación sea intencional, clara y pertinente.",
    paragraphs: [
      "Antes de producir una pieza o publicar un mensaje, es necesario reconocer qué se quiere comunicar, a quién va dirigido y qué acción o comprensión se espera facilitar.",
      "El propósito orienta el formato, el lenguaje, el canal y el momento de publicación. No todo contenido necesita el mismo tratamiento ni todos los públicos requieren el mismo nivel de detalle.",
      "Una comunicación responsable verifica la información, respeta el contexto y evita presentar como confirmado aquello que todavía no lo está.",
    ],
    keyPoints: [
      "Define el objetivo antes de elegir el medio.",
      "Adapta el lenguaje al público sin alterar el sentido.",
      "Verifica fechas, nombres, lugares y datos antes de publicar.",
    ],
    previous: "que-es-decom",
    next: "principios-identidad",
    nextTitle: "Principios de identidad corporativa",
  },
  "principios-identidad": {
    title: "Principios de identidad corporativa",
    module: "Módulo 2 · Identidad institucional",
    duration: "15 minutos",
    objective:
      "Reconocer por qué la identidad institucional debe mantenerse coherente en los diferentes medios.",
    paragraphs: [
      "La identidad corporativa reúne elementos visuales, verbales y de comportamiento que permiten reconocer a una institución y distinguir su comunicación.",
      "La coherencia no significa que todas las piezas deban verse iguales. Significa que, aunque se adapten al formato y al público, deben conservar los elementos y criterios institucionales definidos.",
      "El uso de logotipos, colores, tipografías, nombres y mensajes debe responder a los lineamientos vigentes y a las autorizaciones correspondientes.",
    ],
    keyPoints: [
      "Consulta siempre los lineamientos institucionales vigentes.",
      "No alteres marcas ni elementos gráficos sin autorización.",
      "Mantén consistencia entre el mensaje y su presentación.",
    ],
    previous: "comunicar-con-proposito",
    next: "tono-lenguaje",
    nextTitle: "Tono y lenguaje institucional",
  },
  "tono-lenguaje": {
    title: "Tono y lenguaje institucional",
    module: "Módulo 2 · Identidad institucional",
    duration: "12 minutos",
    objective: "Aplicar un lenguaje respetuoso, claro y adecuado al contexto institucional.",
    paragraphs: [
      "El tono institucional define cómo se expresa la organización. Debe ser respetuoso, comprensible y consistente con el contexto del mensaje.",
      "La claridad se fortalece con frases directas, información verificable y una estructura que permita identificar rápidamente el asunto principal.",
      "El lenguaje debe adaptarse al medio sin recurrir a exageraciones, ambigüedades o afirmaciones que no hayan sido confirmadas.",
    ],
    keyPoints: [
      "Prefiere frases claras y concretas.",
      "Evita exageraciones y datos no confirmados.",
      "Revisa ortografía, nombres propios y contexto.",
    ],
    previous: "principios-identidad",
    next: "coherencia-mensajes",
    nextTitle: "Coherencia en los mensajes",
  },
  "coherencia-mensajes": {
    title: "Coherencia en los mensajes",
    module: "Módulo 2 · Identidad institucional",
    duration: "14 minutos",
    objective:
      "Relacionar propósito, contenido, formato y canal para producir mensajes consistentes.",
    paragraphs: [
      "Un mensaje coherente mantiene relación entre lo que se quiere comunicar, la información que se presenta y la forma en que se entrega al público.",
      "La revisión editorial debe comprobar que el contenido sea correcto, que la pieza corresponda al canal y que los elementos visuales respeten los lineamientos.",
      "La coherencia se construye con procesos de revisión y coordinación, no únicamente con una plantilla gráfica.",
    ],
    keyPoints: [
      "Comprueba que la pieza responda al objetivo definido.",
      "Verifica la información antes de difundirla.",
      "Solicita revisión cuando el contenido lo requiera.",
    ],
    previous: "tono-lenguaje",
    activity: "aplicacion-identidad",
  },
};

export default function LessonViewerClient({ lessonId }: { lessonId: string }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [access, setAccess] = useState<AccessState>("checking");
  const [displayName, setDisplayName] = useState("Estudiante");
  const [acknowledged, setAcknowledged] = useState(false);

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
        setDisplayName(
          String(
            user.user_metadata?.full_name ??
              user.user_metadata?.name ??
              user.email?.split("@")[0] ??
              "Estudiante",
          ),
        );
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
        console.error("No fue posible validar el acceso a la lección:", error);
        if (active) setAccess("error");
      }
    }
    void Promise.resolve().then(verifyAccess);
    return () => {
      active = false;
    };
  }, [router, supabase]);

  const lesson = lessonContent[lessonId];

  if (access === "checking") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-decom-blue/20 border-t-decom-blue" />
      </main>
    );
  }

  if (access !== "allowed") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6">
        <section className="max-w-md rounded-3xl border border-line bg-surface p-8 text-center">
          <h1 className="text-xl font-bold text-foreground">
            {access === "error" ? "No pudimos validar tu acceso" : "Acceso restringido"}
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-fg">
            {access === "error"
              ? "Intenta nuevamente."
              : "Esta lección está disponible para estudiantes con una asignación vigente."}
          </p>
          <button
            type="button"
            onClick={() => router.push("/dashboard/estudiante")}
            className="mt-5 rounded-xl bg-decom-blue px-5 py-3 text-sm font-semibold text-white"
          >
            Volver al panel
          </button>
        </section>
      </main>
    );
  }

  if (!lesson) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6">
        <section className="max-w-md rounded-3xl border border-line bg-surface p-8 text-center">
          <h1 className="text-xl font-bold text-foreground">Lección no encontrada</h1>
          <p className="mt-2 text-sm text-muted-fg">
            El contenido solicitado no está disponible en esta versión de demostración.
          </p>
          <button
            type="button"
            onClick={() => router.push("/dashboard/estudiante/formacion")}
            className="mt-5 rounded-xl bg-decom-blue px-5 py-3 text-sm font-semibold text-white"
          >
            Volver a Mi formación
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-4 md:px-8">
          <div>
            <p className="text-xs font-extrabold tracking-[0.14em] text-decom-blue-text">
              ACADEMIA DECOM
            </p>
            <p className="mt-1 text-xs text-muted-fg">Aula virtual · {displayName}</p>
          </div>
          <button
            type="button"
            onClick={() => router.push("/dashboard/estudiante/formacion")}
            className="rounded-xl border border-line px-4 py-2.5 text-xs font-semibold text-muted-fg hover:bg-surface-muted"
          >
            ← Mi formación
          </button>
        </div>
      </header>
      <div className="mx-auto grid max-w-6xl gap-6 px-5 py-7 pb-12 md:px-8 md:py-9 lg:grid-cols-[minmax(0,1fr)_280px]">
        <article className="min-w-0 rounded-3xl border border-line bg-surface p-6 shadow-sm md:p-9">
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-muted-fg">
            <span>{lesson.module}</span>
            <span>·</span>
            <span>{lesson.duration}</span>
            <span className="ml-auto rounded-full bg-amber-50 px-3 py-1 text-amber-800">
              Contenido de demostración
            </span>
          </div>
          <h1 className="mt-5 text-2xl font-extrabold leading-tight md:text-3xl">{lesson.title}</h1>
          <div className="mt-6 rounded-2xl bg-[#EAF5FA] p-5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-decom-blue-text">
              Objetivo de aprendizaje
            </p>
            <p className="mt-2 text-sm leading-6 text-[#244A63]">{lesson.objective}</p>
          </div>
          <div className="prose prose-slate mt-7 max-w-none">
            {lesson.paragraphs.map((paragraph, index) => (
              <p key={index} className="mb-5 text-sm leading-8 text-muted-fg">
                {paragraph}
              </p>
            ))}
          </div>
          <section className="mt-8 rounded-2xl border border-line p-5">
            <h2 className="text-sm font-bold">Ideas clave</h2>
            <ul className="mt-4 space-y-3">
              {lesson.keyPoints.map((point) => (
                <li key={point} className="flex gap-3 text-sm leading-6 text-muted-fg">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-50 text-xs font-bold text-teal-700">
                    ✓
                  </span>
                  {point}
                </li>
              ))}
            </ul>
          </section>
          <section className="mt-8 rounded-2xl border border-dashed border-line bg-surface-muted p-5">
            <h2 className="text-sm font-bold">Comprobación de lectura</h2>
            <p className="mt-1 text-xs leading-5 text-muted-fg">
              Esta interacción solo sirve para probar la interfaz. No registra progreso académico en
              el servidor.
            </p>
            <label className="mt-4 flex items-start gap-3 text-sm text-muted-fg">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(event) => setAcknowledged(event.target.checked)}
                className="mt-1 h-4 w-4 accent-decom-blue"
              />
              He revisado el contenido y las ideas clave de esta lección.
            </label>
            {acknowledged && (
              <p className="mt-3 text-xs font-semibold text-teal-700">
                Lectura marcada en esta sesión de demostración; todavía no se ha guardado.
              </p>
            )}
          </section>
          <div className="mt-8 flex flex-col justify-between gap-3 border-t border-line-soft pt-6 sm:flex-row">
            {lesson.previous ? (
              <button
                type="button"
                onClick={() => router.push(`/dashboard/estudiante/leccion/${lesson.previous}`)}
                className="rounded-xl border border-line px-4 py-3 text-sm font-semibold text-muted-fg hover:bg-surface-muted"
              >
                ← Lección anterior
              </button>
            ) : (
              <span />
            )}
            {lesson.activity ? (
              <button
                type="button"
                onClick={() => router.push(`/dashboard/estudiante/actividades/${lesson.activity}`)}
                className="rounded-xl bg-decom-blue px-5 py-3 text-sm font-semibold text-white hover:bg-decom-blue-hover"
              >
                Ir a la actividad →
              </button>
            ) : lesson.next ? (
              <button
                type="button"
                onClick={() => router.push(`/dashboard/estudiante/leccion/${lesson.next}`)}
                className="rounded-xl bg-decom-blue px-5 py-3 text-sm font-semibold text-white hover:bg-decom-blue-hover"
              >
                Siguiente lección →
              </button>
            ) : (
              <button
                type="button"
                onClick={() => router.push("/dashboard/estudiante/formacion")}
                className="rounded-xl bg-decom-blue px-5 py-3 text-sm font-semibold text-white"
              >
                Volver al curso
              </button>
            )}
          </div>
        </article>
        <aside className="space-y-4">
          <section className="rounded-3xl border border-line bg-surface p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-fg">
              Tu sesión
            </p>
            <h2 className="mt-2 text-sm font-bold">Lección de aprendizaje</h2>
            <p className="mt-2 text-xs leading-5 text-muted-fg">
              Dedica el tiempo necesario a comprender el contenido. Puedes volver a esta ruta cuando
              lo necesites.
            </p>
            <div className="mt-4 rounded-xl bg-surface-muted p-3">
              <p className="text-[10px] font-semibold text-muted-fg">DURACIÓN ESTIMADA</p>
              <p className="mt-1 text-sm font-bold">{lesson.duration}</p>
            </div>
          </section>
          <section className="rounded-3xl bg-decom-navy p-5 text-white">
            <span className="text-xl">✦</span>
            <h2 className="mt-3 text-sm font-bold">Aprender para servir</h2>
            <p className="mt-2 text-xs leading-5 text-white/70">
              La formación cobra sentido cuando el conocimiento se convierte en una práctica
              responsable.
            </p>
          </section>
        </aside>
      </div>
    </main>
  );
}
