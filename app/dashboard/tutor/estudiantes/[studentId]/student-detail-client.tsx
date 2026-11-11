"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type AccessState = "checking" | "allowed" | "denied" | "error";

const demoStudents: Record<string, {
  name: string; email: string; group: string; progress: number; lessonsDone: number;
  lessonsTotal: number; completed: number; pending: number; lastActivity: string;
  courses: { name: string; progress: number; detail: string }[];
  history: { date: string; title: string; detail: string; status: string }[];
  alerts: string[];
}> = {
  "maria-rios": {
    name: "María Fernanda Ríos", email: "maria.rios@ejemplo.test", group: "Grupo de tutoría 01",
    progress: 72, lessonsDone: 18, lessonsTotal: 25, completed: 4, pending: 1, lastActivity: "Hoy · 8:42 a. m.",
    courses: [
      { name: "Identidad corporativa DECOM", progress: 72, detail: "18 de 25 lecciones" },
      { name: "Medios escritos", progress: 0, detail: "Aún no iniciado" },
    ],
    history: [
      { date: "Hoy · 8:42 a. m.", title: "Aplicación de la identidad visual", detail: "Entrega recibida · pendiente de revisión", status: "Pendiente" },
      { date: "8 nov 2026", title: "Principios de identidad DECOM", detail: "Actividad revisada por tutoría", status: "Aprobada" },
      { date: "5 nov 2026", title: "Lección: propósito institucional", detail: "Contenido marcado como completado", status: "Completada" },
    ],
    alerts: ["Tiene una entrega pendiente de revisión.", "Mantiene actividad reciente en el curso principal."],
  },
  "andres-gomez": {
    name: "Andrés Felipe Gómez", email: "andres.gomez@ejemplo.test", group: "Grupo de tutoría 01",
    progress: 48, lessonsDone: 12, lessonsTotal: 25, completed: 2, pending: 2, lastActivity: "Ayer · 4:15 p. m.",
    courses: [
      { name: "Identidad corporativa DECOM", progress: 48, detail: "12 de 25 lecciones" },
      { name: "Medios escritos", progress: 0, detail: "Aún no iniciado" },
    ],
    history: [
      { date: "Ayer · 4:15 p. m.", title: "Análisis de comunicación institucional", detail: "Entrega recibida · pendiente de revisión", status: "Pendiente" },
      { date: "7 nov 2026", title: "Elementos de identidad", detail: "Entrega devuelta para ajustes", status: "Requiere ajustes" },
      { date: "3 nov 2026", title: "Lección: comunicación con propósito", detail: "Contenido marcado como completado", status: "Completada" },
    ],
    alerts: ["Dos actividades requieren seguimiento.", "El avance del curso está por debajo del promedio del grupo de demostración."],
  },
  "daniela-perez": {
    name: "Daniela Pérez", email: "daniela.perez@ejemplo.test", group: "Grupo de tutoría 01",
    progress: 86, lessonsDone: 22, lessonsTotal: 25, completed: 5, pending: 0, lastActivity: "Ayer · 11:20 a. m.",
    courses: [
      { name: "Identidad corporativa DECOM", progress: 86, detail: "22 de 25 lecciones" },
      { name: "Medios escritos", progress: 0, detail: "Aún no iniciado" },
    ],
    history: [
      { date: "Ayer · 11:20 a. m.", title: "Principios de identidad DECOM", detail: "Entrega revisada por tutoría", status: "Aprobada" },
      { date: "9 nov 2026", title: "Reconocimiento de elementos gráficos", detail: "Actividad completada", status: "Completada" },
      { date: "6 nov 2026", title: "Lección: lenguaje visual", detail: "Contenido marcado como completado", status: "Completada" },
    ],
    alerts: ["No tiene entregas pendientes en este momento.", "Avance constante en el curso principal."],
  },
};

export default function TutorStudentDetailClient({ studentId }: { studentId: string }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [access, setAccess] = useState<AccessState>("checking");
  const [note, setNote] = useState("");
  const [notes, setNotes] = useState<string[]>([]);
  const student = demoStudents[studentId];

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
        const roleIds = [...new Set((assignments ?? []).map((item) => item.role_id))];
        const { data: roles, error: rolesError } = await supabase.from("roles").select("role_key").in("id", roleIds);
        if (rolesError) throw rolesError;
        if (!active) return;
        const keys = (roles ?? []).map((role) => role.role_key);
        setAccess(keys.includes("tutor") || keys.includes("national_admin") ? "allowed" : "denied");
      } catch (error) {
        console.error("No fue posible validar el acceso a la ficha:", error);
        if (active) setAccess("error");
      }
    }
    void Promise.resolve().then(verifyAccess);
    return () => { active = false; };
  }, [router, supabase]);

  if (access === "checking") return <main className="flex min-h-screen items-center justify-center bg-[#F4F7FA]"><p className="text-sm text-slate-500">Verificando tu acceso...</p></main>;
  if (access !== "allowed") return <main className="flex min-h-screen items-center justify-center bg-[#F4F7FA] px-6"><section className="max-w-md rounded-3xl border bg-white p-8 text-center"><h1 className="text-xl font-bold text-[#102D4D]">{access === "error" ? "No pudimos validar tu acceso" : "Acceso restringido"}</h1><p className="mt-2 text-sm text-slate-500">Esta ficha está habilitada para tutores autorizados.</p><button type="button" onClick={() => router.push("/dashboard")} className="mt-5 rounded-xl bg-[#087DB5] px-5 py-3 text-sm font-semibold text-white">Volver al panel</button></section></main>;
  if (!student) return <main className="flex min-h-screen items-center justify-center bg-[#F4F7FA] px-6"><section className="max-w-md rounded-3xl border bg-white p-8 text-center"><h1 className="text-xl font-bold text-[#102D4D]">Estudiante no encontrado</h1><p className="mt-2 text-sm text-slate-500">No existe una ficha de demostración para este registro.</p><button type="button" onClick={() => router.push("/dashboard/tutor")} className="mt-5 rounded-xl bg-[#087DB5] px-5 py-3 text-sm font-semibold text-white">Volver al panel del tutor</button></section></main>;

  return (
    <main className="min-h-screen bg-[#F4F7FA] text-[#102D4D]">
      <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 md:px-8"><div><p className="text-xs font-extrabold tracking-[0.14em] text-[#087DB5]">ACADEMIA DECOM</p><p className="mt-1 text-xs text-slate-400">Seguimiento tutorial individual</p></div><button type="button" onClick={() => router.push("/dashboard/tutor")} className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-600">← Panel del tutor</button></div></header>
      <div className="mx-auto max-w-6xl space-y-6 px-5 py-7 md:px-8 md:py-9">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-[#19A7A0]">Ficha académica</p><h1 className="mt-2 text-2xl font-extrabold">{student.name}</h1><p className="mt-1 text-sm text-slate-500">{student.email} · {student.group}</p></div><span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800">Datos de demostración</span></div>
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[{label:"Avance general",value:student.progress+"%"},{label:"Lecciones completadas",value:student.lessonsDone+"/"+student.lessonsTotal},{label:"Actividades aprobadas",value:String(student.completed)},{label:"Pendientes",value:String(student.pending)}].map((item)=><article key={item.label} className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs font-semibold text-slate-400">{item.label}</p><p className="mt-2 text-2xl font-extrabold tabular-nums">{item.value}</p></article>)}
        </section>
        <section className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6"><h2 className="text-lg font-bold">Progreso por curso</h2><div className="mt-5 space-y-6">{student.courses.map((course)=><div key={course.name}><div className="flex flex-wrap justify-between gap-2"><p className="text-sm font-bold">{course.name}</p><span className="text-xs font-bold text-[#087DB5]">{course.progress}%</span></div><p className="mt-1 text-xs text-slate-400">{course.detail}</p><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#19A7A0]" style={{width:course.progress+"%"}} /></div></div>)}</div></article>
          <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6"><h2 className="text-lg font-bold">Alertas y acompañamiento</h2><p className="mt-1 text-xs text-slate-400">Última actividad: {student.lastActivity}</p><div className="mt-4 space-y-3">{student.alerts.map((alert)=><p key={alert} className="rounded-xl bg-[#F4F7FA] p-3 text-xs leading-5 text-slate-600">{alert}</p>)}</div><p className="mt-4 text-[11px] leading-5 text-slate-400">Las alertas son ilustrativas. Las reglas de riesgo y seguimiento se definirán en el servicio académico.</p></article>
        </section>
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6"><h2 className="text-lg font-bold">Historial de actividad</h2><div className="mt-5 divide-y divide-slate-100">{student.history.map((item)=><article key={item.date+item.title} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-sm font-bold">{item.title}</p><p className="mt-1 text-xs leading-5 text-slate-500">{item.detail}</p><p className="mt-1 text-[11px] text-slate-400">{item.date}</p></div><span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-[10px] font-semibold text-slate-600">{item.status}</span></article>)}</div></section>
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6"><div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-lg font-bold">Observaciones tutoriales</h2><p className="mt-1 text-xs text-slate-400">Notas temporales de esta sesión de demostración.</p></div><span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">No se guardan</span></div><textarea value={note} onChange={(event)=>setNote(event.target.value)} rows={3} maxLength={1000} placeholder="Escribe una observación para probar el flujo de seguimiento..." className="mt-4 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm leading-6 outline-none focus:border-[#087DB5]" /><div className="mt-3 flex justify-end"><button type="button" disabled={!note.trim()} onClick={()=>{setNotes((current)=>[note.trim(),...current]);setNote("");}} className="rounded-xl bg-[#087DB5] px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-40">Añadir nota temporal</button></div>{notes.length>0&&<div className="mt-5 space-y-2">{notes.map((item,index)=><p key={index} className="rounded-xl bg-[#F4F7FA] p-3 text-xs leading-5 text-slate-600">{item}</p>)}</div>}</section>
        <p className="text-[11px] leading-5 text-slate-400">Prototipo de interfaz: estudiantes, cursos, alertas e historial son ficticios. Las notas solo viven en el estado del navegador y desaparecen al salir. No se consulta información académica real.</p>
      </div>
    </main>
  );
}
