"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type AccessState = "checking" | "allowed" | "denied" | "error";
type Answers = { single: string; multiple: string[]; boolean: string; short: string };

const questions = [
  { id: "single", type: "Selección única", prompt: "¿Qué debe orientar la elección del medio de comunicación?", options: ["La preferencia personal del diseñador", "El propósito y el público del mensaje", "La cantidad de colores disponibles", "La tendencia del momento"], correct: "El propósito y el público del mensaje" },
  { id: "multiple", type: "Selección múltiple", prompt: "¿Qué acciones ayudan a mantener una comunicación institucional responsable? Selecciona todas las que correspondan.", options: ["Verificar los datos antes de publicar", "Adaptar el lenguaje al público", "Alterar el logotipo para cada publicación", "Revisar el contexto del mensaje"], correct: ["Verificar los datos antes de publicar", "Adaptar el lenguaje al público", "Revisar el contexto del mensaje"] },
  { id: "boolean", type: "Verdadero o falso", prompt: "La identidad institucional se limita únicamente al uso del logotipo.", options: ["Verdadero", "Falso"], correct: "Falso" },
  { id: "short", type: "Respuesta corta", prompt: "Menciona dos aspectos que verificarías antes de publicar una comunicación institucional.", correct: null },
] as const;

export default function PracticeAssessmentPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [access, setAccess] = useState<AccessState>("checking");
  const [answers, setAnswers] = useState<Answers>({ single: "", multiple: [], boolean: "", short: "" });
  const [submitted, setSubmitted] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

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
        console.error("No fue posible validar el acceso a la práctica:", error);
        if (active) setAccess("error");
      }
    }
    void Promise.resolve().then(verifyAccess);
    return () => { active = false; };
  }, [router, supabase]);

  const answeredCount = Number(Boolean(answers.single)) + Number(answers.multiple.length > 0) + Number(Boolean(answers.boolean)) + Number(Boolean(answers.short.trim()));
  const objectiveScore = (answers.single === questions[0].correct ? 1 : 0) + (answers.boolean === questions[2].correct ? 1 : 0) + (questions[1].correct.every((item) => answers.multiple.includes(item)) && answers.multiple.length === questions[1].correct.length ? 1 : 0);

  function toggleMultiple(option: string) {
    setAnswers((current) => ({ ...current, multiple: current.multiple.includes(option) ? current.multiple.filter((item) => item !== option) : [...current.multiple, option] }));
  }

  if (access === "checking") return <main className="flex min-h-screen items-center justify-center bg-[#F4F7FA]"><div className="h-10 w-10 animate-spin rounded-full border-4 border-[#087DB5]/20 border-t-[#087DB5]" /></main>;
  if (access !== "allowed") return <main className="flex min-h-screen items-center justify-center bg-[#F4F7FA] px-6"><section className="max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center"><h1 className="text-xl font-bold text-[#102D4D]">{access === "error" ? "No pudimos validar tu acceso" : "Acceso restringido"}</h1><p className="mt-2 text-sm text-slate-500">{access === "error" ? "Intenta nuevamente." : "Esta práctica está habilitada para estudiantes con una asignación vigente."}</p><button type="button" onClick={() => router.push("/dashboard/estudiante")} className="mt-5 rounded-xl bg-[#087DB5] px-5 py-3 text-sm font-semibold text-white">Volver al panel</button></section></main>;

  return (
    <main className="min-h-screen bg-[#F4F7FA] text-[#102D4D]">
      <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-4 md:px-8"><div><p className="text-xs font-extrabold tracking-[0.14em] text-[#087DB5]">ACADEMIA DECOM</p><p className="mt-1 text-xs text-slate-400">Práctica de evaluación</p></div><button type="button" onClick={() => router.push("/dashboard/estudiante/evaluaciones")} className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-600">← Evaluaciones</button></div></header>
      <div className="mx-auto max-w-4xl space-y-6 px-5 py-7 pb-12 md:px-8 md:py-9">
        <section className="rounded-3xl bg-[#102D4D] p-6 text-white md:p-8"><span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider">Práctica · No calificada</span><h1 className="mt-4 text-2xl font-extrabold">Comprobación de fundamentos</h1><p className="mt-2 text-sm leading-6 text-white/75">Responde los cuatro tipos de preguntas. Al finalizar podrás revisar una puntuación ilustrativa de las preguntas objetivas.</p><div className="mt-5 flex flex-wrap gap-4 text-xs text-white/70"><span>4 preguntas</span><span>10 minutos estimados</span><span>{answeredCount}/4 respondidas</span></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-[#19A7A0] transition-all" style={{width:`${answeredCount/4*100}%`}} /></div></section>

        {!submitted ? (
          <section className="space-y-4">
            {questions.map((question,index)=>(
              <article key={question.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-7">
                <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-[10px] font-bold uppercase tracking-wider text-[#087DB5]">Pregunta {index+1} de {questions.length}</span><span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-semibold text-slate-500">{question.type}</span></div>
                <h2 className="mt-4 text-base font-bold leading-6">{question.prompt}</h2>
                {question.id==="single"&&<div className="mt-4 space-y-2">{question.options.map((option)=><label key={option} className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-100 p-3 text-sm text-slate-600 hover:bg-slate-50"><input type="radio" name="single" checked={answers.single===option} onChange={()=>setAnswers((current)=>({...current,single:option}))} className="mt-0.5 h-4 w-4 accent-[#087DB5]"/>{option}</label>)}</div>}
                {question.id==="multiple"&&<div className="mt-4 space-y-2">{question.options.map((option)=><label key={option} className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-100 p-3 text-sm text-slate-600 hover:bg-slate-50"><input type="checkbox" checked={answers.multiple.includes(option)} onChange={()=>toggleMultiple(option)} className="mt-0.5 h-4 w-4 accent-[#087DB5]"/>{option}</label>)}</div>}
                {question.id==="boolean"&&<div className="mt-4 grid gap-2 sm:grid-cols-2">{question.options.map((option)=><button key={option} type="button" aria-pressed={answers.boolean===option} onClick={()=>setAnswers((current)=>({...current,boolean:option}))} className={`rounded-xl border px-4 py-3 text-sm font-semibold ${answers.boolean===option?"border-[#087DB5] bg-sky-50 text-[#087DB5]":"border-slate-200 text-slate-500"}`}>{option}</button>)}</div>}
                {question.id==="short"&&<textarea value={answers.short} onChange={(event)=>setAnswers((current)=>({...current,short:event.target.value}))} rows={4} maxLength={500} placeholder="Escribe tu respuesta..." className="mt-4 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm leading-6 outline-none focus:border-[#087DB5]"/>}
              </article>
            ))}
            <div className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center"><p className="text-xs leading-5 text-slate-500">Esta práctica funciona solo en el navegador. No crea intentos, no transmite respuestas y no afecta tu progreso.</p><button type="button" disabled={answeredCount!==4} onClick={()=>setShowConfirm(true)} className="shrink-0 rounded-xl bg-[#087DB5] px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">Revisar y finalizar</button></div>
          </section>
        ):(
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8"><p className="text-xs font-bold uppercase tracking-wider text-[#19A7A0]">Resultado ilustrativo</p><h2 className="mt-2 text-2xl font-extrabold">Práctica completada</h2><p className="mt-2 text-sm text-slate-500">Puntuación objetiva de ejemplo: {objectiveScore}/3. La respuesta corta requiere revisión humana y no se incluye en este resultado.</p><div className="mt-6 grid gap-3 sm:grid-cols-3">{[{label:"Selección única",correct:answers.single===questions[0].correct},{label:"Selección múltiple",correct:questions[1].correct.every((item)=>answers.multiple.includes(item))&&answers.multiple.length===questions[1].correct.length},{label:"Verdadero o falso",correct:answers.boolean===questions[2].correct}].map((item)=><div key={item.label} className="rounded-2xl bg-[#F4F7FA] p-4"><p className="text-xs font-semibold text-slate-500">{item.label}</p><p className={`mt-2 text-sm font-bold ${item.correct?"text-teal-700":"text-rose-700"}`}>{item.correct?"Correcta":"Por repasar"}</p></div>)}</div><div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-900">Este resultado es local y no representa una calificación oficial ni se almacena en Academia DECOM.</div><button type="button" onClick={()=>router.push("/dashboard/estudiante/evaluaciones")} className="mt-6 rounded-xl bg-[#087DB5] px-5 py-3 text-sm font-semibold text-white">Volver a evaluaciones</button></section>
        )}
      </div>
      {showConfirm&&!submitted&&<div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/40 p-4 sm:items-center"><section role="dialog" aria-modal="true" aria-labelledby="confirm-assessment-title" className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"><h2 id="confirm-assessment-title" className="text-lg font-bold">¿Finalizar esta práctica?</h2><p className="mt-2 text-sm leading-6 text-slate-500">Has respondido las cuatro preguntas. Al continuar verás una revisión local de las respuestas objetivas.</p><div className="mt-6 flex justify-end gap-2"><button type="button" onClick={()=>setShowConfirm(false)} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600">Seguir revisando</button><button type="button" onClick={()=>{setShowConfirm(false);setSubmitted(true);}} className="rounded-xl bg-[#087DB5] px-4 py-3 text-sm font-semibold text-white">Finalizar práctica</button></div></section></div>}
    </main>
  );
}
