"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type AccessState = "checking" | "allowed" | "denied" | "error";

type Course = {
  id: string;
  title: string;
  category: string;
  progress: number;
  lessonsDone: number;
  lessonsTotal: number;
  color: string;
  status: "En curso" | "Próximo";
};

const demoCourses: Course[] = [
  {
    id: "identidad",
    title: "Identidad corporativa DECOM",
    category: "Fundamentos institucionales",
    progress: 68,
    lessonsDone: 7,
    lessonsTotal: 10,
    color: "#087DB5",
    status: "En curso",
  },
  {
    id: "escritos",
    title: "Medios escritos",
    category: "Área de comunicación",
    progress: 0,
    lessonsDone: 0,
    lessonsTotal: 8,
    color: "#19A7A0",
    status: "Próximo",
  },
  {
    id: "digitales",
    title: "Medios digitales",
    category: "Área de comunicación",
    progress: 0,
    lessonsDone: 0,
    lessonsTotal: 9,
    color: "#8064B5",
    status: "Próximo",
  },
];

const demoTasks = [
  {
    id: "task-1",
    title: "Actividad: aplicación de la identidad visual",
    course: "Identidad corporativa DECOM",
    due: "Entrega de demostración",
    status: "Por entregar",
    tone: "amber",
  },
  {
    id: "task-2",
    title: "Cuestionario de fundamentos",
    course: "Identidad corporativa DECOM",
    due: "Disponible para practicar",
    status: "Disponible",
    tone: "blue",
  },
];

function ProgressBar({ value, color }: { value: number; color: string }) {
  return (
    <div
      className="h-2 overflow-hidden rounded-full bg-slate-100"
      role="progressbar"
      aria-label={`Progreso del curso: ${value}%`}
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${value}%`, backgroundColor: color }}
      />
    </div>
  );
}

export default function StudentDashboardPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [access, setAccess] = useState<AccessState>("checking");
  const [displayName, setDisplayName] = useState("Estudiante");
  const [email, setEmail] = useState("");
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [activeNav, setActiveNav] = useState("Inicio");

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

        setEmail(user.email ?? "");
        const metadataName =
          user.user_metadata?.full_name ??
          user.user_metadata?.name ??
          user.email?.split("@")[0] ??
          "Estudiante";
        setDisplayName(String(metadataName));

        const { data: assignments, error: assignmentsError } = await supabase
          .from("user_role_assignments")
          .select("role_id")
          .eq("user_id", user.id);

        if (assignmentsError) throw assignmentsError;
        if (!active) return;

        const roleIds = [...new Set((assignments ?? []).map((item) => item.role_id))];
        if (roleIds.length === 0) {
          setAccess("denied");
          return;
        }

        const { data: roles, error: rolesError } = await supabase
          .from("roles")
          .select("role_key")
          .in("id", roleIds);

        if (rolesError) throw rolesError;
        if (!active) return;

        const roleKeys = (roles ?? []).map((role) => role.role_key);
        setAccess(
          roleKeys.includes("member") || roleKeys.includes("national_admin")
            ? "allowed"
            : "denied"
        );
      } catch (error) {
        console.error("No fue posible validar el acceso al panel del estudiante:", error);
        if (active) setAccess("error");
      }
    }

    void Promise.resolve().then(verifyAccess);
    return () => {
      active = false;
    };
  }, [router, supabase]);

  const firstName = displayName.trim().split(/\s+/)[0] || "Estudiante";

  function navigateToSection(label: string) {
    setActiveNav(label);
    const targets: Record<string, string> = {
      Inicio: "student-home",
      "Mi formación": "student-courses",
      Actividades: "student-tasks",
      Evaluaciones: "student-tasks",
      Tutoría: "student-tutoring",
      Reconocimientos: "student-achievements",
    };
    document.getElementById(targets[label] ?? "student-home")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  if (access === "checking") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F4F7FA] px-6">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-[#087DB5]/20 border-t-[#087DB5]" />
          <p className="mt-4 text-sm text-slate-500">Verificando tu acceso...</p>
        </div>
      </main>
    );
  }

  if (access !== "allowed") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F4F7FA] px-6">
        <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-2xl text-amber-700">
            !
          </div>
          <h1 className="mt-5 text-xl font-bold text-[#102D4D]">
            {access === "error" ? "No pudimos validar tu acceso" : "Acceso restringido"}
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            {access === "error"
              ? "Ocurrió un problema al consultar tus permisos. Intenta nuevamente."
              : "Este espacio está habilitado para estudiantes con una asignación vigente."}
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-xl bg-[#087DB5] px-5 py-3 text-sm font-semibold text-white hover:bg-[#066a9b]"
            >
              Reintentar
            </button>
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              Volver al panel
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F4F7FA] text-[#102D4D]">
      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        <aside className="hidden w-[250px] shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
          <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-6">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#087DB5] text-xl font-bold text-white">
              ✦
            </div>
            <div>
              <p className="text-sm font-extrabold tracking-wide">ACADEMIA DECOM</p>
              <p className="mt-0.5 text-xs text-slate-400">Formación con propósito</p>
            </div>
          </div>

          <nav className="flex-1 space-y-1 px-4 py-6" aria-label="Navegación del estudiante">
            <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
              Espacio de aprendizaje
            </p>
            {[
              ["Inicio", "⌂"],
              ["Mi formación", "▤"],
              ["Actividades", "▧"],
              ["Evaluaciones", "✓"],
              ["Tutoría", "◷"],
              ["Reconocimientos", "✧"],
            ].map(([label, icon]) => (
              <button
                key={label}
                type="button"
                onClick={() => navigateToSection(label)}
                aria-current={activeNav === label ? "page" : undefined}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium transition ${
                  activeNav === label
                    ? "bg-[#087DB5]/10 text-[#087DB5]"
                    : "text-slate-500 hover:bg-slate-50 hover:text-[#102D4D]"
                }`}
              >
                <span className="w-5 text-center text-lg" aria-hidden="true">{icon}</span>
                {label}
                {label === "Actividades" && (
                  <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">2</span>
                )}
              </button>
            ))}
          </nav>

          <div className="border-t border-slate-100 p-4">
            <div className="rounded-2xl bg-[#F4F7FA] p-4">
              <p className="text-xs font-semibold text-[#102D4D]">¿Necesitas ayuda?</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Tu proceso de formación cuenta con acompañamiento.
              </p>
              <button
                type="button"
                onClick={() => navigateToSection("Tutoría")}
                className="mt-3 text-xs font-bold text-[#087DB5] hover:underline"
              >
                Ver mi tutoría
              </button>
            </div>
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="mt-4 w-full rounded-xl px-3 py-2 text-left text-xs font-semibold text-slate-500 hover:bg-slate-50"
            >
              ← Volver al panel general
            </button>
          </div>
        </aside>

        <section className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur md:px-8">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#19A7A0]">
                Mi espacio académico
              </p>
              <h1 className="mt-1 text-lg font-bold text-[#102D4D]">Panel del estudiante</h1>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <button
                  type="button"
                  aria-label="Notificaciones"
                  aria-expanded={noticeOpen}
                  onClick={() => setNoticeOpen((value) => !value)}
                  className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-lg text-slate-500 hover:bg-slate-50"
                >
                  ♧
                  <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-white" />
                </button>
                {noticeOpen && (
                  <div className="absolute right-0 top-12 z-30 w-72 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
                    <p className="text-sm font-bold text-[#102D4D]">Notificaciones</p>
                    <p className="mt-2 text-xs leading-5 text-slate-500">
                      Esta vista de demostración no consulta notificaciones reales.
                    </p>
                  </div>
                )}
              </div>
              <div className="hidden text-right sm:block">
                <p className="text-sm font-semibold text-[#102D4D]">{displayName}</p>
                <p className="max-w-48 truncate text-xs text-slate-400">{email}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#DCEFF7] text-sm font-bold text-[#087DB5]">
                {firstName.slice(0, 1).toUpperCase()}
              </div>
            </div>
          </header>

          <div className="mx-auto max-w-7xl space-y-7 px-5 py-7 pb-24 md:px-8 md:py-9 md:pb-9">
            <section id="student-home" className="scroll-mt-24 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <p className="text-sm font-medium text-slate-500">Tu camino de aprendizaje comienza aquí</p>
                <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-[#102D4D] md:text-3xl">
                  ¡Hola, {firstName}!
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                  Avanza a tu ritmo, completa tus actividades y fortalece tus habilidades para comunicar con propósito.
                </p>
              </div>
              <span className="inline-flex w-fit items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                Vista de demostración
              </span>
            </section>

            <section className="grid gap-5 xl:grid-cols-[1.65fr_1fr]">
              <article className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#075B8D] via-[#087DB5] to-[#19A7A0] p-6 text-white shadow-sm md:p-8">
                <div className="pointer-events-none absolute -right-12 -top-16 h-64 w-64 rounded-full border-[35px] border-white/10" />
                <div className="pointer-events-none absolute -bottom-24 right-24 h-56 w-56 rounded-full bg-white/5" />
                <div className="relative max-w-xl">
                  <span className="inline-flex rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em]">
                    Continúa tu formación
                  </span>
                  <h3 className="mt-5 text-2xl font-bold leading-tight md:text-3xl">
                    Identidad corporativa DECOM
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-white/80">
                    Conoce los principios, lineamientos y elementos que dan unidad a nuestra comunicación institucional.
                  </p>
                  <div className="mt-6 flex items-center gap-3">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/20">
                      <div className="h-full w-[68%] rounded-full bg-white" />
                    </div>
                    <span className="text-sm font-bold tabular-nums">68%</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-white/75">
                    <span>7 de 10 lecciones completadas</span>
                    <span>Próximo: Aplicaciones prácticas</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigateToSection("Mi formación")}
                    className="mt-7 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-[#075B8D] shadow-sm transition hover:bg-slate-100"
                  >
                    Continuar aprendiendo <span aria-hidden="true">→</span>
                  </button>
                </div>
              </article>

              <article id="student-tasks" className="scroll-mt-24 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-7">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Mi avance</p>
                    <h3 className="mt-1 text-lg font-bold text-[#102D4D]">Ruta formativa</h3>
                  </div>
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E6F5F4] text-lg text-[#15958F]">◷</span>
                </div>
                <div className="mt-7 flex items-end gap-2">
                  <span className="text-4xl font-extrabold tracking-tight text-[#102D4D]">1</span>
                  <span className="pb-1 text-sm text-slate-400">de 3 cursos iniciados</span>
                </div>
                <div className="mt-5 space-y-4">
                  {demoCourses.map((course) => (
                    <div key={course.id}>
                      <div className="mb-2 flex items-center justify-between gap-3 text-xs">
                        <span className="font-semibold text-slate-600">{course.title}</span>
                        <span className="shrink-0 font-bold text-slate-500">{course.progress}%</span>
                      </div>
                      <ProgressBar value={course.progress} color={course.color} />
                    </div>
                  ))}
                </div>
                <p className="mt-5 border-t border-slate-100 pt-4 text-xs leading-5 text-slate-400">
                  El avance oficial se calculará con las actividades y lecciones confirmadas por la plataforma.
                </p>
              </article>
            </section>

            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: "Cursos en progreso", value: "1", detail: "De tu ruta formativa", icon: "▤", tint: "bg-sky-50 text-sky-700" },
                { label: "Actividades pendientes", value: "1", detail: "Requiere tu atención", icon: "▧", tint: "bg-amber-50 text-amber-700" },
                { label: "Evaluaciones", value: "1", detail: "Disponible para practicar", icon: "✓", tint: "bg-violet-50 text-violet-700" },
                { label: "Reconocimientos", value: "2", detail: "Insignias de demostración", icon: "✧", tint: "bg-teal-50 text-teal-700" },
              ].map((item) => (
                <article key={item.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className={`flex h-10 w-10 items-center justify-center rounded-xl text-lg ${item.tint}`}>{item.icon}</span>
                    <span className="text-2xl font-extrabold tabular-nums text-[#102D4D]">{item.value}</span>
                  </div>
                  <p className="mt-4 text-sm font-bold text-[#102D4D]">{item.label}</p>
                  <p className="mt-1 text-xs text-slate-400">{item.detail}</p>
                </article>
              ))}
            </section>

            <section className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
              <article id="student-courses" className="scroll-mt-24 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Organiza tu aprendizaje</p>
                    <h3 className="mt-1 text-lg font-bold text-[#102D4D]">Mis cursos</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigateToSection("Mi formación")}
                    className="text-xs font-bold text-[#087DB5] hover:underline"
                  >
                    Ver mi ruta →
                  </button>
                </div>
                <div className="mt-5 space-y-3">
                  {demoCourses.map((course) => (
                    <div key={course.id} className="flex flex-col gap-4 rounded-2xl border border-slate-100 p-4 sm:flex-row sm:items-center">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-lg font-bold text-white" style={{ backgroundColor: course.color }}>
                        {course.title.slice(0, 1)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-sm font-bold text-[#102D4D]">{course.title}</h4>
                          <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${
                            course.status === "En curso" ? "bg-sky-50 text-sky-700" : "bg-slate-100 text-slate-500"
                          }`}>{course.status}</span>
                        </div>
                        <p className="mt-1 text-xs text-slate-400">{course.category}</p>
                        <div className="mt-3 flex items-center gap-3">
                          <div className="flex-1"><ProgressBar value={course.progress} color={course.color} /></div>
                          <span className="text-[11px] font-semibold text-slate-500">{course.lessonsDone}/{course.lessonsTotal} lecciones</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveNav("Mi formación")}
                        className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 transition hover:border-[#087DB5] hover:text-[#087DB5]"
                      >
                        {course.progress > 0 ? "Continuar" : "Ver programa"}
                      </button>
                    </div>
                  ))}
                </div>
              </article>

              <article id="student-tasks" className="scroll-mt-24 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Lo que sigue</p>
                  <h3 className="mt-1 text-lg font-bold text-[#102D4D]">Pendientes y actividades</h3>
                </div>
                <div className="mt-5 space-y-3">
                  {demoTasks.map((task) => (
                    <div key={task.id} className="rounded-2xl border border-slate-100 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-bold leading-5 text-[#102D4D]">{task.title}</p>
                          <p className="mt-1 text-xs text-slate-400">{task.course}</p>
                        </div>
                        <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${
                          task.tone === "amber" ? "bg-amber-50 text-amber-700" : "bg-sky-50 text-sky-700"
                        }`}>{task.status}</span>
                      </div>
                      <p className="mt-3 text-[11px] text-slate-400">{task.due}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-[11px] leading-5 text-slate-400">
                  Elementos ilustrativos: no representan entregas ni fechas reales.
                </p>
              </article>
            </section>

            <section className="grid gap-5 lg:grid-cols-2">
              <article id="student-tutoring" className="scroll-mt-24 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#E6F5F4] text-xl text-[#15958F]">♧</span>
                  <div>
                    <h3 className="text-base font-bold text-[#102D4D]">Acompañamiento tutorial</h3>
                    <p className="mt-0.5 text-xs text-slate-400">Orientación durante tu proceso</p>
                  </div>
                </div>
                <div className="mt-5 rounded-2xl bg-[#F4F7FA] p-4">
                  <p className="text-sm font-semibold text-slate-600">Tu espacio de tutoría estará aquí</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Podrás consultar las observaciones de tus tutores y el estado de tus actividades revisadas.
                  </p>
                </div>
              </article>

              <article id="student-achievements" className="scroll-mt-24 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-[#102D4D]">Reconocimientos</h3>
                    <p className="mt-0.5 text-xs text-slate-400">Tus avances también merecen celebrarse</p>
                  </div>
                  <span className="text-2xl text-amber-500">✧</span>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4 text-center">
                    <div className="text-2xl">🏅</div>
                    <p className="mt-2 text-xs font-bold text-[#102D4D]">Primeros pasos</p>
                    <p className="mt-1 text-[10px] text-slate-400">Insignia de ejemplo</p>
                  </div>
                  <div className="rounded-2xl border border-sky-100 bg-sky-50/60 p-4 text-center">
                    <div className="text-2xl">✦</div>
                    <p className="mt-2 text-xs font-bold text-[#102D4D]">Constancia</p>
                    <p className="mt-1 text-[10px] text-slate-400">Insignia de ejemplo</p>
                  </div>
                </div>
              </article>
            </section>

            <footer className="flex flex-col gap-2 border-t border-slate-200 py-5 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
              <span>Academia DECOM · Formación para comunicar con propósito.</span>
              <span>Interfaz preliminar · Datos de demostración</span>
            </footer>
          </div>
        </section>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-slate-200 bg-white px-2 py-2 shadow-[0_-6px_24px_rgba(15,23,42,0.06)] lg:hidden" aria-label="Navegación móvil">
        {[
          ["Inicio", "⌂"],
          ["Mi formación", "▤"],
          ["Actividades", "▧"],
          ["Tutoría", "◷"],
          ["Reconocimientos", "✧"],
        ].map(([label, icon]) => (
          <button
            key={label}
            type="button"
            onClick={() => navigateToSection(label)}
            className={`flex flex-col items-center gap-1 rounded-lg px-1 py-2 text-[10px] font-semibold ${
              activeNav === label ? "text-[#087DB5]" : "text-slate-400"
            }`}
          >
            <span className="text-lg" aria-hidden="true">{icon}</span>
            {label}
          </button>
        ))}
      </nav>
    </main>
  );
}
