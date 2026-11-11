"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type AccessState = "checking" | "allowed" | "denied" | "error";

export default function StudentAssessmentsPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [access, setAccess] = useState<AccessState>("checking");

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
        console.error("No fue posible validar el acceso a evaluaciones:", error);
        if (active) setAccess("error");
      }
    }
    void Promise.resolve().then(verifyAccess);
    return () => { active = false; };
  }, [router, supabase]);

  if (access === "checking") return <main className="flex min-h-screen items-center justify-center bg-[#F4F7FA]"><div className="h-10 w-10 animate-spin rounded-full border-4 border-[#087DB5]/20 border-t-[#087DB5]" /></main>;
  if (access !== "allowed") return <main className="flex min-h-screen items-center justify-center bg-[#F4F7FA] px-6"><section className="max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center"><h1 className="text-xl font-bold text-[#102D4D]">{access === "error" ? "No pudimos validar tu acceso" : "Acceso restringido"}</h1><p className="mt-2 text-sm text-slate-500">{access === "error" ? "Intenta nuevamente." : "Esta sección está habilitada para estudiantes con una asignación vigente."}</p><button type="button" onClick={() => router.push("/dashboard/estudiante")} className="mt-5 rounded-xl bg-[#087DB5] px-5 py-3 text-sm font-semibold text-white">Volver al panel</button></section></main>;

  return (
    <main className="min-h-screen bg-[#F4F7FA] text-[#102D4D]">
      <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 md:px-8"><div><p className="text-xs font-extrabold tracking-[0.14em] text-[#087DB5]">ACADEMIA DECOM</p><p className="mt-1 text-xs text-slate-400">Evaluaciones y comprobación de aprendizaje</p></div><button type="button" onClick={() => router.push("/dashboard/estudiante")} className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">← Panel del estudiante</button></div></header>
      <div className="mx-auto max-w-6xl space-y-7 px-5 py-7 pb-12 md:px-8 md:py-9">
        <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#19A7A0]">Evaluación del aprendizaje</p><h1 className="mt-2 text-2xl font-extrabold md:text-3xl">Mis evaluaciones</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Consulta las evaluaciones disponibles y conoce las condiciones antes de comenzar.</p></div><span className="w-fit rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800">Contenido de demostración</span></section>
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-7">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Curso</p><h2 className="mt-1 text-lg font-bold">Identidad corporativa DECOM</h2></div><span className="rounded-full bg-sky-50 px-3 py-1.5 text-[10px] font-bold text-sky-800">Ruta de fundamentos</span></div>
          <article className="mt-5 rounded-2xl border border-slate-100 p-5">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-base font-bold">Comprobación de fundamentos</h3><span className="rounded-full bg-sky-50 px-2.5 py-1 text-[10px] font-bold text-sky-800">Práctica disponible</span></div><p className="mt-2 max-w-2xl text-xs leading-5 text-slate-500">Ejercicio de práctica para conocer los distintos tipos de preguntas y el flujo de respuesta.</p><div className="mt-4 flex flex-wrap gap-4 text-[11px] text-slate-400"><span>4 preguntas</span><span>10 minutos estimados</span><span>Selección y respuesta corta</span></div></div><button type="button" onClick={() => router.push("/dashboard/estudiante/evaluaciones/practica")} className="rounded-xl bg-[#087DB5] px-5 py-3 text-xs font-bold text-white hover:bg-[#066a9b]">Ver instrucciones →</button></div>
          </article>
          <p className="mt-5 rounded-xl bg-[#F4F7FA] p-4 text-[11px] leading-5 text-slate-500">Los resultados, intentos restantes, temporizadores y calificaciones reales solo aparecerán cuando la evaluación esté conectada al servicio académico. Esta práctica no registra intentos.</p>
        </section>
      </div>
    </main>
  );
}
