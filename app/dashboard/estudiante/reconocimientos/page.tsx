"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type AccessState = "checking" | "allowed" | "denied" | "error";

const achievements = [
  { title: "Primeros pasos", description: "Iniciaste tu recorrido de formación en Academia DECOM.", category: "Inicio", points: 20, earned: true, symbol: "✦" },
  { title: "Aprendiz constante", description: "Completaste cinco lecciones de formación.", category: "Aprendizaje", points: 30, earned: true, symbol: "▤" },
  { title: "Participación activa", description: "Participaste en una actividad de aprendizaje.", category: "Participación", points: 25, earned: true, symbol: "◎" },
  { title: "Identidad en práctica", description: "Completa y aprueba la actividad de aplicación de identidad.", category: "Actividades", points: 40, earned: false, symbol: "◇" },
  { title: "Ruta completada", description: "Finaliza todos los módulos y la evaluación del curso.", category: "Formación", points: 100, earned: false, symbol: "🏅" },
  { title: "Comunicador con propósito", description: "Completa el programa de fundamentos DECOM.", category: "Programa", points: 150, earned: false, symbol: "✧" },
];

export default function StudentAchievementsPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [access, setAccess] = useState<AccessState>("checking");
  const [selected, setSelected] = useState<string | null>(null);

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
        setAccess(keys.includes("student") || keys.includes("member") || keys.includes("national_admin") ? "allowed" : "denied");
      } catch (error) {
        console.error("No fue posible validar el acceso a reconocimientos:", error);
        if (active) setAccess("error");
      }
    }
    void Promise.resolve().then(verifyAccess);
    return () => { active = false; };
  }, [router, supabase]);

  const earned = achievements.filter((item) => item.earned);
  const points = earned.reduce((total, item) => total + item.points, 0);
  const activeAchievement = achievements.find((item) => item.title === selected);

  if (access === "checking") return <main className="flex min-h-screen items-center justify-center bg-[#F4F7FA]"><p className="text-sm text-slate-500">Verificando tu acceso...</p></main>;
  if (access !== "allowed") return <main className="flex min-h-screen items-center justify-center bg-[#F4F7FA] px-6"><section className="max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center"><h1 className="text-xl font-bold text-[#102D4D]">{access === "error" ? "No pudimos validar tu acceso" : "Acceso restringido"}</h1><p className="mt-2 text-sm text-slate-500">Esta sección está habilitada para estudiantes con una asignación vigente.</p><button type="button" onClick={() => router.push("/dashboard/estudiante")} className="mt-5 rounded-xl bg-[#087DB5] px-5 py-3 text-sm font-semibold text-white">Volver al panel</button></section></main>;

  return (
    <main className="min-h-screen bg-[#F4F7FA] text-[#102D4D]">
      <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 md:px-8"><div><p className="text-xs font-extrabold tracking-[0.14em] text-[#087DB5]">ACADEMIA DECOM</p><p className="mt-1 text-xs text-slate-400">Reconocimientos y logros</p></div><button type="button" onClick={() => router.push("/dashboard/estudiante")} className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-600">← Panel del estudiante</button></div></header>
      <div className="mx-auto max-w-6xl space-y-7 px-5 py-7 pb-12 md:px-8 md:py-9">
        <section className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#19A7A0]">Tu recorrido</p><h1 className="mt-2 text-2xl font-extrabold md:text-3xl">Reconocimientos</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Cada avance refleja tu compromiso con una comunicación responsable y con propósito.</p></div><span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800">Contenido de demostración</span></section>
        <section className="grid gap-4 sm:grid-cols-3"><article className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs font-semibold text-slate-400">Logros obtenidos</p><p className="mt-2 text-3xl font-extrabold">{earned.length}<span className="text-base font-semibold text-slate-400"> / {achievements.length}</span></p></article><article className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs font-semibold text-slate-400">Puntos acumulados</p><p className="mt-2 text-3xl font-extrabold">{points}</p></article><article className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs font-semibold text-slate-400">Certificados emitidos</p><p className="mt-2 text-3xl font-extrabold">0</p></article></section>
        <section><div className="flex items-end justify-between gap-3"><div><h2 className="text-lg font-bold">Insignias</h2><p className="mt-1 text-xs text-slate-400">Logros obtenidos y próximos objetivos.</p></div><span className="text-xs font-semibold text-slate-500">{earned.length} obtenidas</span></div><div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{achievements.map((item)=><article key={item.title} className={`rounded-2xl border p-5 ${item.earned?"border-slate-200 bg-white shadow-sm":"border-dashed border-slate-300 bg-slate-50/70"}`}><div className="flex items-start justify-between gap-3"><div className={`flex h-12 w-12 items-center justify-center rounded-2xl text-2xl ${item.earned?"bg-[#E5F2F8] text-[#087DB5]":"bg-slate-200 text-slate-400"}`}>{item.symbol}</div><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${item.earned?"bg-teal-50 text-teal-700":"bg-slate-200 text-slate-500"}`}>{item.earned?"Obtenida":"Por desbloquear"}</span></div><h3 className="mt-4 text-sm font-bold">{item.title}</h3><p className="mt-2 min-h-10 text-xs leading-5 text-slate-500">{item.description}</p><div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3"><span className="text-[10px] font-semibold text-slate-400">{item.category}</span><span className="text-xs font-bold text-[#087DB5]">{item.points} XP</span></div><button type="button" onClick={()=>setSelected(item.title)} className="mt-3 text-xs font-semibold text-[#087DB5] hover:underline">Ver detalle →</button></article>)}</div></section>
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-7"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Certificación académica</p><h2 className="mt-1 text-lg font-bold">Mis certificados</h2></div><span className="rounded-full bg-slate-100 px-3 py-1.5 text-[10px] font-bold text-slate-500">Sin certificados emitidos</span></div><div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-[#F8FAFC] p-6 text-center"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-2xl text-slate-400">♧</div><h3 className="mt-4 text-sm font-bold">Tu primer certificado está por venir</h3><p className="mx-auto mt-2 max-w-lg text-xs leading-5 text-slate-500">Cuando completes los requisitos de un programa y el sistema valide tu aprobación, aquí aparecerá el certificado oficial con identificador único y código QR verificable.</p><p className="mt-4 text-[10px] font-semibold uppercase tracking-wider text-slate-400">La emisión y verificación QR aún no están conectadas</p></div></section>
        <p className="text-[11px] leading-5 text-slate-400">Las insignias y los puntos son ilustrativos. No se han asignado XP reales ni emitido certificados. La información se reemplazará por datos académicos autorizados.</p>
      </div>
      {activeAchievement&&<div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/40 p-4 sm:items-center"><section role="dialog" aria-modal="true" aria-labelledby="achievement-title" className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"><div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#E5F2F8] text-2xl text-[#087DB5]">{activeAchievement.symbol}</div><h2 id="achievement-title" className="mt-4 text-lg font-bold">{activeAchievement.title}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{activeAchievement.description}</p><p className="mt-4 text-xs font-bold text-[#087DB5]">{activeAchievement.points} XP · {activeAchievement.earned?"Obtenida en esta demostración":"Objetivo pendiente"}</p><button type="button" onClick={()=>setSelected(null)} className="mt-6 w-full rounded-xl bg-[#087DB5] px-4 py-3 text-sm font-semibold text-white">Cerrar</button></section></div>}
    </main>
  );
}
