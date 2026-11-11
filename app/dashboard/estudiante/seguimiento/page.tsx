"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type AccessState = "checking" | "allowed" | "denied" | "error";

const courses = [
  { name: "Identidad corporativa DECOM", progress: 68, done: 7, total: 10, state: "En curso", next: "Aplicación de identidad visual" },
  { name: "Medios escritos", progress: 0, done: 0, total: 8, state: "Bloqueado", next: "Se habilitará al completar el curso anterior" },
  { name: "Medios digitales", progress: 0, done: 0, total: 9, state: "Bloqueado", next: "Se habilitará según la ruta académica" },
];

const milestones = [
  { date: "11 nov 2026", title: "Actividad de aplicación de identidad visual", description: "Pendiente de entrega en este prototipo.", status: "Pendiente" },
  { date: "10 nov 2026", title: "Lección: elementos de identidad", description: "Contenido marcado como completado.", status: "Completado" },
  { date: "8 nov 2026", title: "Cuestionario de fundamentos", description: "Práctica disponible; resultado no registrado.", status: "Disponible" },
  { date: "5 nov 2026", title: "Inicio de la ruta formativa", description: "Comenzaste el curso de identidad corporativa.", status: "Completado" },
];

export default function StudentProgressPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [access, setAccess] = useState<AccessState>("checking");

  useEffect(() => {
    let active = true;
    async function verifyAccess() {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (!active) return;
        if (authError || !user) { router.replace("/conexion"); return; }
        const { data: assignments, error: assignmentError } = await supabase.from("user_role_assignments").select("role_id").eq("user_id", user.id);
        if (assignmentError) throw assignmentError;
        if (!active) return;
        const ids = [...new Set((assignments ?? []).map((item) => item.role_id))];
        if (!ids.length) { setAccess("denied"); return; }
        const { data: roles, error: rolesError } = await supabase.from("roles").select("role_key").in("id", ids);
        if (rolesError) throw rolesError;
        if (!active) return;
        const keys = (roles ?? []).map((role) => role.role_key);
        setAccess(keys.includes("member") || keys.includes("national_admin") ? "allowed" : "denied");
      } catch (error) {
        console.error("No fue posible validar el acceso al seguimiento:", error);
        if (active) setAccess("error");
      }
    }
    void Promise.resolve().then(verifyAccess);
    return () => { active = false; };
  }, [router, supabase]);

  if (access === "checking") return <main className="flex min-h-screen items-center justify-center bg-[#F4F7FA]"><p className="text-sm text-slate-500">Verificando tu acceso...</p></main>;
  if (access !== "allowed") return <main className="flex min-h-screen items-center justify-center bg-[#F4F7FA] px-6"><section className="max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center"><h1 className="text-xl font-bold text-[#102D4D]">{access === "error" ? "No pudimos validar tu acceso" : "Acceso restringido"}</h1><p className="mt-2 text-sm text-slate-500">Esta sección está habilitada para estudiantes autorizados.</p><button type="button" onClick={() => router.push("/dashboard/estudiante")} className="mt-5 rounded-xl bg-[#087DB5] px-5 py-3 text-sm font-semibold text-white">Volver al panel</button></section></main>;

  return <main className="min-h-screen bg-[#F4F7FA] text-[#102D4D]">
    <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 md:px-8"><div><p className="text-xs font-extrabold tracking-[0.14em] text-[#087DB5]">ACADEMIA DECOM</p><p className="mt-1 text-xs text-slate-400">Seguimiento académico</p></div><button type="button" onClick={() => router.push("/dashboard/estudiante")} className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-600">← Panel del estudiante</button></div></header>
    <div className="mx-auto max-w-6xl space-y-7 px-5 py-7 md:px-8 md:py-9">
      <section className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#19A7A0]">Tu evolución</p><h1 className="mt-2 text-2xl font-extrabold md:text-3xl">Mi seguimiento</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Consulta el estado de tu ruta, los hitos de aprendizaje y las próximas acciones.</p></div><span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800">Datos de demostración</span></section>
      <section className="grid gap-4 sm:grid-cols-3"><article className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs font-semibold text-slate-400">Avance del curso actual</p><p className="mt-2 text-3xl font-extrabold">68%</p><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full w-[68%] rounded-full bg-[#19A7A0]" /></div></article><article className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs font-semibold text-slate-400">Lecciones completadas</p><p className="mt-2 text-3xl font-extrabold">7 <span className="text-base font-semibold text-slate-400">/ 10</span></p></article><article className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs font-semibold text-slate-400">Actividades por entregar</p><p className="mt-2 text-3xl font-extrabold">1</p></article></section>
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6"><h2 className="text-lg font-bold">Ruta de formación</h2><p className="mt-1 text-xs text-slate-400">La secuencia definitiva se administrará desde el catálogo académico.</p><div className="mt-5 space-y-5">{courses.map((course,index)=><article key={course.name} className="flex gap-4"><div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${index===0?"bg-[#E5F2F8] text-[#087DB5]":"bg-slate-100 text-slate-400"}`}>{index+1}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-bold">{course.name}</h3><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${index===0?"bg-teal-50 text-teal-700":"bg-slate-100 text-slate-500"}`}>{course.state}</span></div><p className="mt-1 text-xs text-slate-400">{course.done} de {course.total} lecciones · {course.next}</p><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#19A7A0]" style={{width:course.progress+"%"}} /></div></div></article>)}</div></section>
      <section className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]"><article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6"><h2 className="text-lg font-bold">Actividad reciente</h2><div className="mt-4 divide-y divide-slate-100">{milestones.map((item)=><div key={item.title} className="flex gap-3 py-4"><span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${item.status==="Completado"?"bg-teal-500":"bg-amber-400"}`} /><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="text-xs font-bold">{item.title}</h3><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-semibold text-slate-500">{item.status}</span></div><p className="mt-1 text-xs leading-5 text-slate-500">{item.description}</p><p className="mt-1 text-[10px] text-slate-400">{item.date}</p></div></div>)}</div></article><article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6"><h2 className="text-lg font-bold">Próximos pasos</h2><p className="mt-1 text-xs text-slate-400">Acciones sugeridas para continuar tu aprendizaje.</p><div className="mt-5 space-y-3"><button type="button" onClick={()=>router.push("/dashboard/estudiante/actividades")} className="w-full rounded-xl border border-slate-200 p-4 text-left transition hover:border-[#087DB5]"><span className="text-xs font-bold">Entregar actividad pendiente</span><span className="mt-1 block text-[11px] text-slate-500">Aplicación de identidad visual</span></button><button type="button" onClick={()=>router.push("/dashboard/estudiante/formacion")} className="w-full rounded-xl border border-slate-200 p-4 text-left transition hover:border-[#087DB5]"><span className="text-xs font-bold">Continuar formación</span><span className="mt-1 block text-[11px] text-slate-500">Retoma el curso de identidad corporativa</span></button><button type="button" onClick={()=>router.push("/dashboard/estudiante/evaluaciones")} className="w-full rounded-xl border border-slate-200 p-4 text-left transition hover:border-[#087DB5]"><span className="text-xs font-bold">Practicar conocimientos</span><span className="mt-1 block text-[11px] text-slate-500">Cuestionario de fundamentos</span></button></div></article></section>
      <p className="text-[11px] leading-5 text-slate-400">Las cifras, fechas y estados de esta vista son ficticios. No representan registros académicos reales ni generan decisiones oficiales.</p>
    </div>
  </main>;
}
