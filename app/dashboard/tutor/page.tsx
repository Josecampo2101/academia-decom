"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type AccessState = "checking" | "allowed" | "denied" | "error";
type ReviewStatus = "Pendiente" | "En revisión" | "Revisada";

type ReviewItem = {
  id: string;
  student: string;
  initials: string;
  activity: string;
  course: string;
  submitted: string;
  elapsed: string;
  status: ReviewStatus;
  priority: "Alta" | "Normal";
  excerpt: string;
};

const demoReviews: ReviewItem[] = [
  {
    id: "REV-104",
    student: "María Fernanda Ríos",
    initials: "MR",
    activity: "Aplicación de la identidad visual",
    course: "Identidad corporativa DECOM",
    submitted: "Hoy · 8:42 a. m.",
    elapsed: "Hace 2 horas",
    status: "Pendiente",
    priority: "Alta",
    excerpt: "Presenta una propuesta de aplicación de los elementos visuales en una pieza institucional.",
  },
  {
    id: "REV-103",
    student: "Andrés Felipe Gómez",
    initials: "AG",
    activity: "Análisis de comunicación institucional",
    course: "Identidad corporativa DECOM",
    submitted: "Ayer · 4:15 p. m.",
    elapsed: "Hace 18 horas",
    status: "Pendiente",
    priority: "Normal",
    excerpt: "Describe cómo mantener coherencia entre el mensaje, el público y el medio seleccionado.",
  },
  {
    id: "REV-102",
    student: "Daniela Pérez",
    initials: "DP",
    activity: "Principios de identidad DECOM",
    course: "Identidad corporativa DECOM",
    submitted: "Ayer · 11:20 a. m.",
    elapsed: "Hace 23 horas",
    status: "En revisión",
    priority: "Normal",
    excerpt: "Explica los principios institucionales y su aplicación en el trabajo de comunicaciones.",
  },
  {
    id: "REV-099",
    student: "Samuel Torres",
    initials: "ST",
    activity: "Reconocimiento de elementos gráficos",
    course: "Identidad corporativa DECOM",
    submitted: "10 nov · 2:05 p. m.",
    elapsed: "Revisada",
    status: "Revisada",
    priority: "Normal",
    excerpt: "Identifica los componentes principales de una pieza gráfica institucional.",
  },
];

const students = [
  { name: "María Fernanda Ríos", course: "Identidad corporativa DECOM", progress: 72, activity: "Entregó una actividad", tone: "sky" },
  { name: "Andrés Felipe Gómez", course: "Identidad corporativa DECOM", progress: 48, activity: "Tiene una entrega pendiente", tone: "amber" },
  { name: "Daniela Pérez", course: "Identidad corporativa DECOM", progress: 86, activity: "Avance reciente", tone: "teal" },
];

export default function TutorDashboardPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [access, setAccess] = useState<AccessState>("checking");
  const [displayName, setDisplayName] = useState("Tutor");
  const [filter, setFilter] = useState<"Todas" | ReviewStatus>("Todas");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ReviewItem | null>(null);

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

        const metadataName =
          user.user_metadata?.full_name ??
          user.user_metadata?.name ??
          user.email?.split("@")[0] ??
          "Tutor";
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

        const keys = (roles ?? []).map((role) => role.role_key);
        setAccess(keys.includes("tutor") || keys.includes("national_admin") ? "allowed" : "denied");
      } catch (error) {
        console.error("No fue posible validar el acceso al panel del tutor:", error);
        if (active) setAccess("error");
      }
    }

    void Promise.resolve().then(verifyAccess);
    return () => {
      active = false;
    };
  }, [router, supabase]);

  const filteredReviews = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("es");
    return demoReviews.filter((item) => {
      const matchesStatus = filter === "Todas" || item.status === filter;
      const matchesSearch =
        !query ||
        item.student.toLocaleLowerCase("es").includes(query) ||
        item.activity.toLocaleLowerCase("es").includes(query) ||
        item.course.toLocaleLowerCase("es").includes(query);
      return matchesStatus && matchesSearch;
    });
  }, [filter, search]);

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
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-2xl text-amber-700">!</div>
          <h1 className="mt-5 text-xl font-bold text-[#102D4D]">
            {access === "error" ? "No pudimos validar tu acceso" : "Acceso restringido"}
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            {access === "error"
              ? "Ocurrió un problema al consultar tus permisos. Intenta nuevamente."
              : "Este espacio está habilitado para tutores con una asignación vigente."}
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <button type="button" onClick={() => window.location.reload()} className="rounded-xl bg-[#087DB5] px-5 py-3 text-sm font-semibold text-white hover:bg-[#066a9b]">Reintentar</button>
            <button type="button" onClick={() => router.push("/dashboard")} className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50">Volver al panel</button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F4F7FA] text-[#102D4D]">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-5 py-4 md:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#087DB5] text-xl font-bold text-white">✦</div>
            <div>
              <p className="text-sm font-extrabold tracking-wide">ACADEMIA DECOM</p>
              <p className="text-xs text-slate-400">Espacio de acompañamiento académico</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-right sm:block">
              <span className="block text-sm font-semibold">{displayName}</span>
              <span className="block text-xs text-slate-400">Panel del tutor</span>
            </span>
            <button type="button" onClick={() => router.push("/dashboard")} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">Panel general</button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1500px] space-y-7 px-5 py-7 pb-12 md:px-8 md:py-9">
        <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#19A7A0]">Acompañamiento y evaluación</p>
            <h1 className="mt-2 text-2xl font-extrabold tracking-tight md:text-3xl">Panel del tutor</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Prioriza las entregas, acompaña el avance de tus estudiantes y consulta el estado de las revisiones.</p>
          </div>
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Vista de demostración
          </span>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Estudiantes asignados", value: "12", detail: "En tu grupo de tutoría", icon: "♙", tint: "bg-sky-50 text-sky-700" },
            { label: "Entregas por revisar", value: "2", detail: "Requieren una decisión", icon: "▧", tint: "bg-amber-50 text-amber-700" },
            { label: "En revisión", value: "1", detail: "Proceso iniciado", icon: "◷", tint: "bg-violet-50 text-violet-700" },
            { label: "Revisadas esta semana", value: "8", detail: "Actividad de demostración", icon: "✓", tint: "bg-teal-50 text-teal-700" },
          ].map((item) => (
            <article key={item.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className={`flex h-10 w-10 items-center justify-center rounded-xl text-lg ${item.tint}`}>{item.icon}</span>
                <span className="text-2xl font-extrabold tabular-nums">{item.value}</span>
              </div>
              <p className="mt-4 text-sm font-bold">{item.label}</p>
              <p className="mt-1 text-xs text-slate-400">{item.detail}</p>
            </article>
          ))}
        </section>

        <section className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
          <article className="min-w-0 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Bandeja de trabajo</p>
                <h2 className="mt-1 text-lg font-bold">Entregas para revisar</h2>
              </div>
              <label className="block w-full md:max-w-xs">
                <span className="sr-only">Buscar estudiante, actividad o curso</span>
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar estudiante o actividad..." className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#087DB5] focus:ring-2 focus:ring-[#087DB5]/10" />
              </label>
            </div>

            <div className="mt-5 flex flex-wrap gap-2" aria-label="Filtrar entregas">
              {(["Todas", "Pendiente", "En revisión", "Revisada"] as const).map((item) => (
                <button key={item} type="button" onClick={() => setFilter(item)} aria-pressed={filter === item} className={`rounded-full px-3.5 py-2 text-xs font-semibold transition ${
                  filter === item ? "bg-[#087DB5] text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                }`}>{item === "Pendiente" ? "Pendientes" : item === "Revisada" ? "Revisadas" : item}</button>
              ))}
            </div>

            <div className="mt-5 space-y-3">
              {filteredReviews.map((item) => (
                <article key={item.id} className="rounded-2xl border border-slate-100 p-4 transition hover:border-slate-200">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#E5F2F8] text-xs font-bold text-[#087DB5]">{item.initials}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-bold">{item.activity}</h3>
                        {item.priority === "Alta" && <span className="rounded-full bg-rose-50 px-2 py-1 text-[10px] font-bold text-rose-700">Prioridad alta</span>}
                      </div>
                      <p className="mt-1 text-xs font-semibold text-slate-600">{item.student}</p>
                      <p className="mt-1 text-xs text-slate-400">{item.course}</p>
                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400">
                        <span>Enviada: {item.submitted}</span>
                        <span>{item.elapsed}</span>
                        <span className={`rounded-full px-2 py-1 font-semibold ${
                          item.status === "Pendiente" ? "bg-amber-50 text-amber-700" : item.status === "En revisión" ? "bg-violet-50 text-violet-700" : "bg-teal-50 text-teal-700"
                        }`}>{item.status}</span>
                      </div>
                    </div>
                    <button type="button" onClick={() => setSelected(item)} className="shrink-0 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-[#087DB5] transition hover:border-[#087DB5] hover:bg-sky-50">
                      {item.status === "Revisada" ? "Ver detalle" : "Abrir entrega"} →
                    </button>
                  </div>
                </article>
              ))}
              {filteredReviews.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-200 px-5 py-10 text-center">
                  <p className="text-sm font-semibold text-slate-600">No hay entregas para este filtro</p>
                  <p className="mt-1 text-xs text-slate-400">Prueba con otro estado o término de búsqueda.</p>
                </div>
              )}
            </div>
            <p className="mt-4 text-[11px] leading-5 text-slate-400">Los nombres, entregas y estados de esta bandeja son ficticios y no corresponden a estudiantes reales.</p>
          </article>

          <div className="space-y-5">
            <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Acompañamiento</p>
                <h2 className="mt-1 text-lg font-bold">Estudiantes a seguir</h2>
              </div>
              <div className="mt-5 space-y-5">
                {students.map((student) => (
                  <div key={student.name}>
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-bold">{student.name}</p>
                      <span className="text-xs font-bold tabular-nums text-slate-500">{student.progress}%</span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-400">{student.activity}</p>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-[#19A7A0]" style={{ width: `${student.progress}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-5 border-t border-slate-100 pt-4 text-[11px] leading-5 text-slate-400">El seguimiento real dependerá de las asignaciones tutoriales y de reglas de atención configuradas.</p>
            </article>

            <article className="rounded-3xl bg-gradient-to-br from-[#102D4D] to-[#075B8D] p-6 text-white">
              <span className="text-2xl">✦</span>
              <h2 className="mt-3 text-base font-bold">Acompañar también es formar</h2>
              <p className="mt-2 text-xs leading-5 text-white/75">La retroalimentación clara y oportuna ayuda a que cada estudiante convierta el aprendizaje en mejores prácticas de comunicación.</p>
            </article>
          </div>
        </section>

        <footer className="border-t border-slate-200 pt-5 text-xs text-slate-400">
          Academia DECOM · Panel preliminar del tutor · Datos de demostración
        </footer>
      </div>

      {selected && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/40 p-0 sm:items-center sm:p-5" role="presentation">
          <section role="dialog" aria-modal="true" aria-labelledby="review-dialog-title" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl md:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#19A7A0]">Detalle de entrega · {selected.id}</p>
                <h2 id="review-dialog-title" className="mt-2 text-xl font-bold text-[#102D4D]">{selected.activity}</h2>
                <p className="mt-1 text-sm text-slate-500">{selected.student} · {selected.course}</p>
              </div>
              <button type="button" aria-label="Cerrar detalle" onClick={() => setSelected(null)} className="rounded-xl border border-slate-200 px-3 py-2 text-slate-500 hover:bg-slate-50">✕</button>
            </div>
            <div className="mt-6 rounded-2xl bg-[#F4F7FA] p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Descripción de la entrega</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">{selected.excerpt}</p>
              <p className="mt-3 text-xs text-slate-400">Envío de demostración: {selected.submitted}</p>
            </div>
            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-bold text-amber-900">Espacio de revisión en construcción</p>
              <p className="mt-1 text-xs leading-5 text-amber-800">La rúbrica, los archivos adjuntos y las decisiones de aprobación se conectarán cuando estén definidos el esquema académico y los permisos de tutoría. Esta vista no guarda ni modifica calificaciones.</p>
            </div>
            <div className="mt-6 flex justify-end">
              <button type="button" onClick={() => setSelected(null)} className="rounded-xl bg-[#087DB5] px-5 py-3 text-sm font-semibold text-white hover:bg-[#066a9b]">Cerrar</button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
