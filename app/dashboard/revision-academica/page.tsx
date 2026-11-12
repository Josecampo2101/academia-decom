"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";

type District = { id: string; name: string };
type Plan = { id: string; district_id: string; lesson_id: string; session_title: string; topic: string; description: string | null; planned_for: string | null; estimated_minutes: number | null; created_by: string | null; created_at: string; review_feedback: string | null };
type Lesson = { id: string; title: string; module_id: string };
type Module = { id: string; title: string; course_id: string };
type Course = { id: string; title: string };
type Profile = { id: string; full_name: string | null };

export default function AcademicReviewPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient() as unknown as SupabaseClient, []);
  const [loading,setLoading] = useState(true);
  const [busyId,setBusyId] = useState("");
  const [error,setError] = useState("");
  const [notice,setNotice] = useState("");
  const [userId,setUserId] = useState("");
  const [districts,setDistricts] = useState<District[]>([]);
  const [districtId,setDistrictId] = useState("all");
  const [plans,setPlans] = useState<Plan[]>([]);
  const [lessons,setLessons] = useState<Lesson[]>([]);
  const [modules,setModules] = useState<Module[]>([]);
  const [courses,setCourses] = useState<Course[]>([]);
  const [authors,setAuthors] = useState<Profile[]>([]);
  const [feedback,setFeedback] = useState<Record<string,string>>({});

  const loadQueue = useCallback(async (ids:string[]) => {
    if(!ids.length){setPlans([]);return;}
    const {data,error:queryError}=await supabase.from("academic_lesson_plans")
      .select("id,district_id,lesson_id,session_title,topic,description,planned_for,estimated_minutes,created_by,created_at,review_feedback")
      .eq("status","review").in("district_id",ids).order("created_at",{ascending:true});
    if(queryError)throw queryError;
    const rows=(data??[]) as Plan[];
    setPlans(rows);
    const lessonIds=[...new Set(rows.map(p=>p.lesson_id))];
    const authorIds=[...new Set(rows.map(p=>p.created_by).filter(Boolean))] as string[];
    if(!lessonIds.length){setLessons([]);setModules([]);setCourses([]);setAuthors([]);return;}
    const {data:lessonRows,error:lessonError}=await supabase.from("lessons").select("id,title,module_id").in("id",lessonIds);
    if(lessonError)throw lessonError;
    const lessonData=(lessonRows??[]) as Lesson[];
    setLessons(lessonData);
    const moduleIds=[...new Set(lessonData.map(l=>l.module_id))];
    const {data:moduleRows,error:moduleError}=moduleIds.length?await supabase.from("course_modules").select("id,title,course_id").in("id",moduleIds):{data:[],error:null};
    if(moduleError)throw moduleError;
    const moduleData=(moduleRows??[]) as Module[];
    setModules(moduleData);
    const courseIds=[...new Set(moduleData.map(m=>m.course_id))];
    const {data:courseRows,error:courseError}=courseIds.length?await supabase.from("courses").select("id,title").in("id",courseIds):{data:[],error:null};
    if(courseError)throw courseError;
    setCourses((courseRows??[]) as Course[]);
    const {data:authorRows,error:authorError}=authorIds.length?await supabase.from("profiles").select("id,full_name").in("id",authorIds):{data:[],error:null};
    if(authorError)throw authorError;
    setAuthors((authorRows??[]) as Profile[]);
  },[supabase]);

  useEffect(()=>{
    let active=true;
    async function init(){
      try{
        const {data:{user},error:authError}=await supabase.auth.getUser();
        if(authError||!user){router.replace("/conexion");return;}
        setUserId(user.id);
        const {data:assignments,error:assignmentError}=await supabase.from("user_role_assignments").select("role_id,district_id,congregation_id").eq("user_id",user.id);
        if(assignmentError)throw assignmentError;
        const roleIds=[...new Set((assignments??[]).map(a=>a.role_id))];
        const {data:roleRows,error:roleError}=roleIds.length?await supabase.from("roles").select("id,role_key").in("id",roleIds):{data:[],error:null};
        if(roleError)throw roleError;
        const roleMap=new Map((roleRows??[]).map(r=>[r.id,r.role_key]));
        const hasGlobal=(assignments??[]).some(a=>roleMap.get(a.role_id)==="national_admin"&&!a.district_id&&!a.congregation_id);
        const editorAssignments=(assignments??[]).filter(a=>["academic_editor"].includes(roleMap.get(a.role_id)));
        const ids=[...new Set(editorAssignments.map(a=>a.district_id).filter(Boolean))] as string[];
        if(!hasGlobal&&!ids.length){router.replace("/acceso-denegado");return;}
        let districtQuery=supabase.from("districts").select("id,name").eq("status","active").order("name");
        if(!hasGlobal)districtQuery=districtQuery.in("id",ids);
        const {data:districtRows,error:districtError}=await districtQuery;
        if(districtError)throw districtError;
        const districtData=(districtRows??[]) as District[];
        if(!active)return;
        setDistricts(districtData);
        const scopedIds=districtData.map(d=>d.id);
        await loadQueue(scopedIds);
      }catch(e){if(active)setError(e instanceof Error?e.message:"No se pudo abrir la bandeja de revisión.");}
      finally{if(active)setLoading(false);}
    }
    void init();return()=>{active=false;};
  },[router,supabase,loadQueue]);

  async function decide(plan:Plan,status:"approved"|"changes_requested"){
    const note=(feedback[plan.id]??"").trim();
    if(status==="changes_requested"&&!note){setError("Escribe las observaciones que debe corregir el tutor.");return;}
    setBusyId(plan.id);setError("");setNotice("");
    try{
      const {error:updateError}=await supabase.from("academic_lesson_plans").update({
        status,review_feedback:note||null,reviewed_by:userId,reviewed_at:new Date().toISOString(),
      }).eq("id",plan.id).eq("status","review");
      if(updateError)throw updateError;
      setNotice(status==="approved"?"Planificación aprobada.":"Planificación devuelta con observaciones.");
      await loadQueue(districts.map(d=>d.id));
    }catch(e){setError(e instanceof Error?e.message:"No fue posible registrar la decisión.");}
    finally{setBusyId("");}
  }

  const filtered=plans.filter(p=>districtId==="all"||p.district_id===districtId);
  function lessonTitle(id:string){return lessons.find(l=>l.id===id)?.title??"Lección";}
  function hierarchy(id:string){
    const lesson=lessons.find(l=>l.id===id);const courseModule=modules.find(m=>m.id===lesson?.module_id);
    return courses.find(c=>c.id===courseModule?.course_id)?.title??"Curso";
  }
  function districtName(id:string){return districts.find(d=>d.id===id)?.name??"Distrito";}
  function authorName(id:string|null){return authors.find(a=>a.id===id)?.full_name??"Tutor";}
  if(loading)return <main className="grid min-h-screen place-items-center bg-[#F4F7FA] text-sm text-slate-500">Cargando revisión académica...</main>;

  return <main className="min-h-screen bg-[#F4F7FA] text-[#102D4D]"><div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
    <header className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-[#087DB5]">Academia DECOM · Calidad académica</p><h1 className="mt-2 text-3xl font-bold">Revisión de planificaciones</h1><p className="mt-2 text-sm text-slate-500">Valida las sesiones preparadas por tutores antes de aprobarlas.</p></div><div className="flex gap-2"><button onClick={()=>router.push("/dashboard/planificador")} className="rounded-xl bg-[#087DB5] px-4 py-3 text-sm font-semibold text-white">Abrir planner</button><button onClick={()=>router.push("/dashboard/espacio")} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold">Mi espacio</button></div></header>
    {error&&<div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
    {notice&&<div role="status" className="mt-5 rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-800">{notice}</div>}
    <section className="mt-7 flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5"><div><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Pendientes de revisión</p><p className="mt-1 text-3xl font-bold">{filtered.length}</p></div><label className="block min-w-64 text-sm font-semibold">Filtrar por distrito<select value={districtId} onChange={e=>setDistrictId(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm"><option value="all">Todos mis distritos</option>{districts.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label></section>
    {!filtered.length?<section className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center"><h2 className="text-xl font-bold">No hay planificaciones pendientes</h2><p className="mt-2 text-sm text-slate-500">Cuando un tutor envíe una clase a revisión, aparecerá aquí con su estructura didáctica y sus observaciones.</p></section>:<div className="mt-6 space-y-5">{filtered.map(plan=>{const lesson=lessons.find(l=>l.id===plan.lesson_id);const courseModule=modules.find(m=>m.id===lesson?.module_id);return <article key={plan.id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-[#087DB5]">{districtName(plan.district_id)} · {hierarchy(plan.lesson_id)}</p><h2 className="mt-2 text-xl font-bold">{plan.session_title}</h2><p className="mt-1 text-sm text-slate-500">{lessonTitle(plan.lesson_id)}{courseModule?" · "+courseModule.title:""}</p></div><span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800">En revisión</span></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-semibold uppercase text-slate-500">Tema</p><p className="mt-1 text-sm font-semibold">{plan.topic}</p></div><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-semibold uppercase text-slate-500">Preparado por</p><p className="mt-1 text-sm font-semibold">{authorName(plan.created_by)}</p></div></div>
      {plan.description&&<p className="mt-4 text-sm leading-6 text-slate-600">{plan.description}</p>}
      <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-500"><span>{plan.planned_for?new Date(plan.planned_for+"T12:00:00").toLocaleDateString("es-CO"):"Sin fecha programada"}</span><span>{plan.estimated_minutes??"—"} minutos</span></div>
      <label className="mt-5 block text-sm font-semibold">Observaciones de revisión<textarea value={feedback[plan.id]??""} onChange={e=>setFeedback(current=>({...current,[plan.id]:e.target.value}))} rows={3} placeholder="Indica qué debe corregir el tutor o deja una recomendación..." className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm font-normal"/></label>
      <div className="mt-4 flex flex-wrap justify-end gap-3"><button disabled={busyId===plan.id} onClick={()=>void decide(plan,"changes_requested")} className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 disabled:opacity-50">Solicitar ajustes</button><button disabled={busyId===plan.id} onClick={()=>void decide(plan,"approved")} className="rounded-xl bg-[#19A7A0] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{busyId===plan.id?"Guardando...":"Aprobar planificación"}</button></div>
    </article>})}</div>}
  </div></main>;
}
