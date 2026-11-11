"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type AccessState = "checking" | "allowed" | "denied" | "error";

const demoActivities = [
  {
    id: "aplicacion-identidad",
    title: "Aplicación de la identidad visual",
    course: "Identidad corporativa DECOM",
    module: "Módulo 2 · Identidad institucional",
    status: "Por desarrollar",
    statusClass: "bg-amber-50 text-amber-800",
    description: "Analiza el propósito, público y aplicación de los elementos visuales en una pieza institucional.",
    type: "Respuesta escrita",
  },
  {
    id: "reflexion-proposito",
    title: "Reflexión: comunicar con propósito",
    course: "Identidad corporativa DECOM",
    module: "Módulo 1 · Conociendo DECOM",
    status: "Disponible",
    statusClass: "bg-sky-50 text-sky-800",
    description: "Relaciona el propósito de un mensaje con el público y el medio seleccionado.",
    type: "Respuesta breve",
  },
];

export default function StudentActivitiesPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [access, setAccess] = useState<AccessState>("checking");
  const [filter, setFilter] = useState("Todas");
  const [userId, setUserId] = useState<string | null>(null);
  const [statuses, setStatuses] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;
    async function verifyAccess() {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (!active) return;
        if (authError || !user) {
          router.replace("/conexion");
          return;
        }
        const { data: assignments, error: assignmentError } = await supabase.from("user_role_assignments").select("role_id").eq("user_id", user.id);
        if (assignmentError) throw assignmentError;
        if (!active) return;
        const roleIds = [...new Set((assignments ?? []).map((item) => item.role_id))];
        if (!roleIds.length) {
          setAccess("denied");
          return;
        }
        const { data: roles, error: rolesError } = await supabase.from("roles").select("role_key").in("id", roleIds);
        if (rolesError) throw rolesError;
        if (!active) return;
        const keys = (roles ?? []).map((role) => role.role_key);
        setAccess(keys.includes("member") || keys.includes("national_admin") ? "allowed" : "denied");
      } catch (error) {
        console.error("No fue posible validar el acceso a actividades:", error);
        if (active) setAccess("error");
      }
    }
    void Promise.resolve().then(verifyAccess);
    return () => { active = false; };
  }, [router, supabase]);

  useEffect(() => {
    if (!userId) return;
    const next: Record<string, string> = {};
    for (const item of demoActivities) {
      try {
        const raw = window.localStorage.getItem(`academia-decom:demo-work:${userId}:${item.id}`);
        if (raw) {
          const saved = JSON.parse(raw) as { status?: string };
          if (saved.status) next[item.id] = saved.status;
        }
      } catch (error) {
        console.error("No fue posible leer el estado local de una actividad:", error);
      }
    }
    setStatuses(next);
  }, [userId]);

  const activitiesWithStatus = demoActivities.map((item) => {
    const status = statuses[item.id] ?? item.status;
    const statusClass = status === "En revisión" ? "bg-sky-50 text-sky-800"
      : status === "Borrador" ? "bg-violet-50 text-violet-800"
      : status === "Calificada" ? "bg-teal-50 text-teal-800"
      : status === "Requiere ajustes" ? "bg-amber-50 text-amber-800"
      : item.statusClass;
    return { ...item, status, statusClass };
  });

  const filteredActivities = activitiesWithStatus.filter((item) => filter === "Todas" || item.status === filter);

  if (access === "checking") return <main className="flex min-h-screen items-center justify-center bg-[#F4F7FA]"><div className="h-10 w-10 animate-spin rounded-full border-4 border-[#087DB5]/20 border-t-[#087DB5]" /></main>;

  if (access !== "allowed") {
    return <main className="flex min-h-screen items-center justify-center bg-[#F4F7FA] px-6"><section className="max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center"><h1 className="text-xl font-bold text-[#102D4D]">{access === "error" ? "No pudimos validar tu acceso" : "Acceso restringido"}</h1><p className="mt-2 text-sm text-slate-500">{access === "error" ? "Intenta nuevamente." : "Esta sección está habilitada para estudiantes con una asignación vigente."}</p><button type="button" onClick={() => router.push("/dashboard/estudiante")} className="mt-5 rounded-xl bg-[#087DB5] px-5 py-3 text-sm font-semibold text-white">Volver al panel</button></section></main>;
  }

  return (
    <main className="min-h-screen bg-[#F4F7FA] text-[#102D4D]">
      <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 md:px-8"><div><p className="text-xs font-extrabold tracking-[0.14em] text-[#087DB5]">ACADEMIA DECOM</p><p className="mt-1 text-xs text-slate-400">Mis actividades</p></div><button type="button" onClick={() => router.push("/dashboard/estudiante")} className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">← Panel del estudiante</button></div></header>
      <div className="mx-auto max-w-6xl space-y-7 px-5 py-7 pb-12 md:px-8 md:py-9">
        <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#19A7A0]">Trabajo académico</p><h1 className="mt-2 text-2xl font-extrabold md:text-3xl">Actividades y entregas</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Consulta las instrucciones, prepara tus respuestas y revisa el estado de cada actividad.</p></div><span className="w-fit rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800">Datos de demostración</span></section>
        <section className="grid gap-4 sm:grid-cols-3">
          {[{label:"Por desarrollar",value:String(activitiesWithStatus.filter((item)=>item.status==="Por desarrollar").length),detail:"Pendientes de iniciar"},{label:"Disponibles",value:String(activitiesWithStatus.filter((item)=>item.status==="Disponible").length),detail:"Listas para trabajar"},{label:"En revisión",value:String(activitiesWithStatus.filter((item)=>item.status==="En revisión").length),detail:"Envíos locales de demostración"}].map((item)=><article key={item.label} className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs font-semibold text-slate-400">{item.label}</p><p className="mt-2 text-3xl font-extrabold tabular-nums">{item.value}</p><p className="mt-1 text-[11px] text-slate-400">{item.detail}</p></article>)}
        </section>
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-7">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><h2 className="text-lg font-bold">Tu bandeja de actividades</h2><p className="mt-1 text-xs text-slate-400">Cada actividad muestra sus instrucciones y formato de trabajo.</p></div><label className="text-xs font-semibold text-slate-500">Filtrar estado <select value={filter} onChange={(event)=>setFilter(event.target.value)} className="ml-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"><option>Todas</option><option>Por desarrollar</option><option>Disponible</option><option>Borrador</option><option>En revisión</option><option>Calificada</option><option>Requiere ajustes</option></select></label></div>
          <div className="mt-5 space-y-3">
            {filteredActivities.map((item)=><article key={item.id} className="rounded-2xl border border-slate-100 p-4 md:p-5"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-bold">{item.title}</h3><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${item.statusClass}`}>{item.status}</span></div><p className="mt-2 text-xs text-slate-500">{item.course} · {item.module}</p><p className="mt-2 max-w-2xl text-xs leading-5 text-slate-400">{item.description}</p><p className="mt-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Formato: {item.type}</p></div><button type="button" onClick={()=>router.push(`/dashboard/estudiante/actividades/${item.id}`)} className="shrink-0 rounded-xl bg-[#087DB5] px-4 py-3 text-xs font-bold text-white hover:bg-[#066a9b]">Ver actividad →</button></div></article>)}
            {filteredActivities.length===0&&<p className="py-8 text-center text-sm text-slate-400">No hay actividades para este filtro.</p>}
          </div>
          <p className="mt-5 rounded-xl bg-[#F4F7FA] p-4 text-[11px] leading-5 text-slate-500">Esta bandeja utiliza ejemplos ficticios. Los estados se leen del almacenamiento local de este navegador. No representan entregas, vencimientos ni calificaciones del servidor.</p>
        </section>
      </div>
    </main>
  );
}
