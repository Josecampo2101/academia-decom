"use client";
import { useCallback,useEffect,useMemo,useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
type Access="checking"|"allowed"|"denied"|"error";
type Criterion={id:string;activity_id:string;title:string;description:string|null;max_points:number;sort_order:number};
type Submission={
 id:string;activity_id:string;district_id:string;user_id:string;attempt_number:number;response_text:string|null;external_url:string|null;
 status:string;submitted_at:string|null;awarded_points:number|null;feedback:string|null;rubric_scores:Array<{criterion_id:string;awarded_points:number}>;
 academic_activities:{id:string;title:string;total_points:number;due_at:string|null;course_id:string;courses:{title:string}|null;course_modules:{title:string}|null};
 studentName:string;
};
type Attachment={id:string;submission_id:string;storage_path:string;file_name:string;size_bytes:number};
type Review={id:string;submission_id:string;attempt_number:number;status:string;awarded_points:number|null;feedback:string|null;reviewed_at:string};
type TutorRosterRow={course_id:string;course_title:string;student_id:string;student_name:string;enrollment_id:string;enrollment_status:string;enrolled_at:string};
const statusLabel:Record<string,string>={submitted:"Pendiente de revisión"};
export default function TutorAssessmentWorkflowPage(){
 const router=useRouter();const supabase=useMemo(()=>createClient(),[]);
 const [access,setAccess]=useState<Access>("checking");const [items,setItems]=useState<Submission[]>([]);
 const [criteria,setCriteria]=useState<Criterion[]>([]);const [attachments,setAttachments]=useState<Attachment[]>([]);
 const [history,setHistory]=useState<Review[]>([]);const [selectedId,setSelectedId]=useState<string|null>(null);
 const [scores,setScores]=useState<Record<string,number>>({});const [overall,setOverall]=useState("0");
 const [feedback,setFeedback]=useState("");const [decision,setDecision]=useState<"graded"|"changes_requested">("graded");
 const [search,setSearch]=useState("");const [filter,setFilter]=useState("Todas");
 const [busy,setBusy]=useState(false);const [loading,setLoading]=useState(true);const [error,setError]=useState("");const [notice,setNotice]=useState("");
 const load=useCallback(async()=>{
  setLoading(true);setError("");
  try{
   const {data:{user},error:authError}=await supabase.auth.getUser();if(authError||!user){router.replace("/conexion");return;}
   const {data:roleRows,error:roleError}=await supabase.from("user_role_assignments").select("role_id").eq("user_id",user.id);if(roleError)throw roleError;
   const roleIds=[...new Set((roleRows??[]).map(x=>x.role_id))];const {data:roles,error:rolesError}=await supabase.from("roles").select("role_key").in("id",roleIds);if(rolesError)throw rolesError;
   const roleKeys=(roles??[]).map(x=>x.role_key);if(!roleKeys.includes("tutor")&&!roleKeys.includes("national_admin")){setAccess("denied");return;}
   const {data:assignmentRows,error:assignmentError}=await supabase.from("academic_course_tutor_assignments").select("course_id").eq("tutor_user_id",user.id).eq("status","active");
   if(assignmentError)throw assignmentError;
   const courseIds=[...new Set((assignmentRows??[]).map(x=>x.course_id))];
   if(!courseIds.length){setItems([]);setCriteria([]);setAttachments([]);setHistory([]);setSelectedId(null);setAccess("allowed");return;}
   const {data:rosterRows,error:rosterError}=await supabase.rpc("get_tutor_course_roster");
   if(rosterError)throw rosterError;
   const studentNames=new Map(((rosterRows??[]) as TutorRosterRow[]).map(x=>[x.student_id,x.student_name||"Estudiante"]));
   const {data:rows,error:queryError}=await supabase.from("academic_activity_submissions")
    .select("id,activity_id,district_id,user_id,attempt_number,response_text,external_url,status,submitted_at,awarded_points,feedback,rubric_scores,academic_activities!inner(id,title,total_points,due_at,course_id,courses(title),course_modules(title))")
    .eq("status","submitted")
    .in("academic_activities.course_id",courseIds)
    .order("submitted_at",{ascending:true});
   if(queryError)throw queryError;
   const raw=(rows??[]) as unknown as Omit<Submission,"studentName">[];
   const next=raw.map(x=>({...x,studentName:studentNames.get(x.user_id)??"Estudiante"}));
   setItems(next);setSelectedId(current=>current&&next.some(x=>x.id===current)?current:next[0]?.id??null);
   const submissionIds=next.map(x=>x.id);const activityIds=[...new Set(next.map(x=>x.activity_id))];
   if(activityIds.length){const {data:rubrics,error:rubricError}=await supabase.from("academic_activity_rubric_criteria").select("id,activity_id,title,description,max_points,sort_order").in("activity_id",activityIds).order("sort_order");if(rubricError)throw rubricError;setCriteria((rubrics??[]) as Criterion[]);}
   else setCriteria([]);
   if(submissionIds.length){
    const [fileResult,historyResult]=await Promise.all([
     supabase.from("academic_activity_submission_files").select("id,submission_id,storage_path,file_name,size_bytes").in("submission_id",submissionIds),
     supabase.from("academic_activity_submission_reviews").select("id,submission_id,attempt_number,status,awarded_points,feedback,reviewed_at").in("submission_id",submissionIds).order("reviewed_at",{ascending:false})
    ]);
    if(fileResult.error)throw fileResult.error;if(historyResult.error)throw historyResult.error;
    setAttachments((fileResult.data??[]) as unknown as Attachment[]);
    setHistory((historyResult.data??[]) as unknown as Review[]);
   }else{setAttachments([]);setHistory([]);}
   setAccess("allowed");
  }catch(cause){console.error("No fue posible cargar la bandeja de tutoría:",cause);setError(cause instanceof Error?cause.message:"No fue posible consultar las entregas.");setAccess("error");}
  finally{setLoading(false);}
 },[router,supabase]);
 useEffect(()=>{void load();},[load]);
 const selected=items.find(x=>x.id===selectedId)??null;
 const selectedCriteria=criteria.filter(x=>x.activity_id===selected?.activity_id);
 const visible=items.filter(x=>(filter==="Todas"||(filter==="Pendientes"&&x.status==="submitted")||false)&&(!search.trim()||[x.studentName,x.academic_activities.title,x.academic_activities.courses?.title??""].some(v=>v.toLocaleLowerCase("es").includes(search.trim().toLocaleLowerCase("es")))));
 const total=selectedCriteria.length?selectedCriteria.reduce((sum,c)=>sum+(scores[c.id]??0),0):Number(overall||0);
 const max=selectedCriteria.length?selectedCriteria.reduce((sum,c)=>sum+Number(c.max_points),0):selected?.academic_activities.total_points??0;
 function choose(item:Submission){setSelectedId(item.id);setFeedback("");setDecision("graded");setScores(Object.fromEntries((item.rubric_scores??[]).map(x=>[x.criterion_id,x.awarded_points])));setOverall(String(item.awarded_points??0));setNotice("");setError("");}
 async function openAttachment(file:Attachment){const {data,error:e}=await supabase.storage.from("academic-activity-submissions").createSignedUrl(file.storage_path,60);if(e){setError(e.message);return;}window.open(data.signedUrl,"_blank","noopener,noreferrer");}
 async function saveReview(){
  if(!selected)return;
  if(decision==="changes_requested"&&!feedback.trim()){setError("Escribe las observaciones necesarias para que el estudiante pueda corregir.");return;}
  if(decision==="graded"&&selectedCriteria.length&&selectedCriteria.some(c=>typeof scores[c.id]!=="number")){setError("Asigna un puntaje a todos los criterios de la rúbrica.");return;}
  if(decision==="graded"&&(total<0||total>max)){setError("El puntaje total supera el máximo permitido.");return;}
  setBusy(true);setError("");setNotice("");
  try{
   const rubricScores=decision==="graded"&&selectedCriteria.length?selectedCriteria.map(c=>({criterion_id:c.id,awarded_points:scores[c.id]??0})):[];
   const {error:e}=await supabase.rpc("review_academic_activity_submission",{p_submission_id:selected.id,p_awarded_points:decision==="graded"?total:0,p_feedback:feedback.trim(),p_status:decision,p_rubric_scores:rubricScores});
   if(e)throw e;
   setNotice(decision==="graded"?"Calificación guardada y registrada en el historial.":"Se solicitaron ajustes y la entrega quedó habilitada para corrección.");
   await load();
  }catch(cause){setError(cause instanceof Error?cause.message:"No fue posible guardar la revisión.");}
  finally{setBusy(false);}
 }
 if(access==="checking"||loading)return <main className="flex min-h-screen items-center justify-center bg-[#F4F7FA]"><div className="h-10 w-10 animate-spin rounded-full border-4 border-[#087DB5]/20 border-t-[#087DB5]"/></main>;
 if(access!=="allowed")return <main className="flex min-h-screen items-center justify-center bg-[#F4F7FA] px-6"><section className="max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center"><h1 className="text-xl font-bold text-[#102D4D]">{access==="denied"?"Acceso restringido":"No fue posible abrir la bandeja"}</h1><p className="mt-2 text-sm text-slate-500">{error||"Este espacio está habilitado para tutores con asignación vigente."}</p><button type="button" onClick={()=>router.push("/dashboard/tutor")} className="mt-5 rounded-xl bg-[#087DB5] px-5 py-3 text-sm font-semibold text-white">Volver a tutoría</button></section></main>;
 return <main className="min-h-screen bg-[#F4F7FA] text-[#102D4D]">
  <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-5 py-4 md:px-8"><div><p className="text-sm font-extrabold tracking-wide">ACADEMIA DECOM</p><p className="text-xs text-slate-400">Revisión y evaluación de actividades</p></div><div className="flex gap-2"><button type="button" onClick={()=>void load()} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">Actualizar</button><button type="button" onClick={()=>router.push("/dashboard/tutor")} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">Volver a tutoría</button></div></div></header>
  <div className="mx-auto max-w-[1500px] space-y-6 px-5 py-7 md:px-8">
   <section><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#19A7A0]">Acompañamiento y evaluación</p><h1 className="mt-2 text-2xl font-extrabold md:text-3xl">Revisión de entregas</h1><p className="mt-2 text-sm text-slate-500">Las entregas y calificaciones de esta bandeja provienen de Supabase.</p></section>
   <section className="grid gap-4 sm:grid-cols-3">{[{label:"Entregas por revisar",value:items.length},{label:"Actividades con entregas",value:new Set(items.map(item=>item.activity_id)).size}].map(x=><article key={x.label} className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs text-slate-400">{x.label}</p><p className="mt-2 text-3xl font-extrabold">{x.value}</p></article>)}</section>
   {error&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-xs text-red-700">{error}</p>}{notice&&<p role="status" className="rounded-xl bg-teal-50 p-3 text-xs text-teal-800">{notice}</p>}
   <section className="grid items-start gap-5 xl:grid-cols-[minmax(290px,0.8fr)_minmax(0,1.7fr)]">
    <aside className="rounded-3xl border border-slate-200 bg-white p-5"><div className="flex items-center justify-between"><h2 className="text-base font-bold">Bandeja de entregas</h2><span className="text-xs text-slate-400">{visible.length}</span></div><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar estudiante o actividad..." className="mt-4 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"/><div className="mt-3 flex flex-wrap gap-2">{["Todas","Pendientes"].map(x=><button key={x} type="button" onClick={()=>setFilter(x)} className={`rounded-full px-3 py-1.5 text-[11px] font-semibold ${filter===x?"bg-[#087DB5] text-white":"bg-slate-100 text-slate-500"}`}>{x}</button>)}</div><div className="mt-4 space-y-2">{visible.map(item=><button key={item.id} type="button" onClick={()=>choose(item)} className={`w-full rounded-2xl border p-4 text-left ${selected?.id===item.id?"border-[#087DB5] bg-sky-50/70":"border-slate-100"}`}><span className="block text-xs font-bold">{item.academic_activities.title}</span><span className="mt-1 block text-[11px] text-slate-500">{item.studentName}</span><span className="mt-2 inline-flex rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">{statusLabel[item.status]??item.status} · intento {item.attempt_number}</span></button>)}{visible.length===0&&<p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400">No hay entregas para este filtro.</p>}</div></aside>
    {selected?<div className="space-y-5">
     <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-7"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-wider text-[#19A7A0]">Intento {selected.attempt_number}</p><h2 className="mt-2 text-xl font-bold">{selected.academic_activities.title}</h2><p className="mt-1 text-sm text-slate-500">{selected.studentName} · {selected.academic_activities.courses?.title??"Curso"}</p></div><span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800">{statusLabel[selected.status]??selected.status}</span></div>
      <div className="mt-5 rounded-2xl bg-[#F4F7FA] p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Respuesta del estudiante</p>{selected.response_text&&<p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{selected.response_text}</p>}{selected.external_url&&<a href={selected.external_url} target="_blank" rel="noreferrer" className="mt-3 block break-all text-sm text-[#087DB5] underline">Abrir enlace enviado</a>}{!selected.response_text&&!selected.external_url&&<p className="mt-2 text-xs text-slate-400">La entrega contiene archivos adjuntos.</p>}<p className="mt-3 text-[11px] text-slate-400">Recibida: {selected.submitted_at?new Date(selected.submitted_at).toLocaleString("es-CO"):"Fecha no disponible"}</p><p className="mt-1 text-[11px] text-slate-400">Fecha límite: {selected.academic_activities.due_at?new Date(selected.academic_activities.due_at).toLocaleString("es-CO"):"Sin fecha límite"}</p></div>
      {attachments.filter(x=>x.submission_id===selected.id).map(file=><button key={file.id} type="button" onClick={()=>void openAttachment(file)} className="mr-2 mt-3 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-[#087DB5] underline">Ver archivo: {file.file_name}</button>)}
      <div className="mt-6 flex items-center justify-between gap-3"><div><h3 className="text-sm font-bold">Rúbrica de evaluación</h3><p className="mt-1 text-xs text-slate-400">Califica cada criterio sin exceder su máximo.</p></div><div className="rounded-2xl bg-[#EAF5F8] px-4 py-2 text-right"><p className="text-[10px] font-semibold uppercase text-slate-500">Puntaje</p><p className="text-xl font-extrabold text-[#087DB5]">{total} / {max}</p></div></div>
      {selectedCriteria.length?selectedCriteria.map(c=><div key={c.id} className="mt-3 grid gap-3 rounded-2xl border border-slate-100 p-4 sm:grid-cols-[1fr_110px]"><div><p className="text-sm font-semibold">{c.title}</p>{c.description&&<p className="mt-1 text-xs text-slate-500">{c.description}</p>}<p className="mt-2 text-[10px] text-slate-400">Máximo: {c.max_points}</p></div><label className="text-[10px] font-semibold text-slate-500">Puntos<input type="number" min={0} max={c.max_points} step="0.01" value={scores[c.id]??""} onChange={e=>setScores(current=>({...current,[c.id]:Math.max(0,Math.min(Number(c.max_points),Number(e.target.value)||0))}))} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold"/></label></div>):<label className="mt-4 block text-xs font-semibold">Puntaje obtenido<input type="number" min="0" max={selected.academic_activities.total_points} step="0.01" value={overall} onChange={e=>setOverall(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"/></label>}
      <label className="mt-5 block text-sm font-bold">Retroalimentación<textarea value={feedback} onChange={e=>setFeedback(e.target.value)} rows={4} maxLength={4000} placeholder="Describe los logros y, si corresponde, los ajustes necesarios..." className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm leading-6"/></label>
      <div className="mt-5 grid gap-2 sm:grid-cols-2"><button type="button" onClick={()=>setDecision("graded")} className={`rounded-xl border px-4 py-3 text-xs font-semibold ${decision==="graded"?"border-[#087DB5] bg-sky-50 text-[#087DB5]":"border-slate-200 text-slate-500"}`}>Calificar entrega</button><button type="button" onClick={()=>setDecision("changes_requested")} className={`rounded-xl border px-4 py-3 text-xs font-semibold ${decision==="changes_requested"?"border-amber-300 bg-amber-50 text-amber-800":"border-slate-200 text-slate-500"}`}>Solicitar ajustes</button></div>
      <button type="button" disabled={busy} onClick={()=>void saveReview()} className="mt-4 w-full rounded-xl bg-[#087DB5] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy?"Guardando...":decision==="graded"?"Guardar calificación":"Enviar solicitud de ajustes"}</button>
     </section>
     <section className="rounded-3xl border border-slate-200 bg-white p-5"><h3 className="text-sm font-bold">Historial de revisiones</h3>{history.filter(x=>x.submission_id===selected.id).length?history.filter(x=>(x as Review&{submission_id?:string}).submission_id===selected.id).map(item=><article key={item.id} className="mt-3 border-l-2 border-[#19A7A0] pl-3"><p className="text-xs font-bold">{statusLabel[item.status]??"Calificada"} · intento {item.attempt_number}</p>{item.awarded_points!==null&&<p className="mt-1 text-xs">{item.awarded_points} puntos</p>}{item.feedback&&<p className="mt-1 whitespace-pre-wrap text-xs text-slate-500">{item.feedback}</p>}<p className="mt-1 text-[10px] text-slate-400">{new Date(item.reviewed_at).toLocaleString("es-CO")}</p></article>):<p className="mt-3 text-xs text-slate-400">No hay revisiones anteriores.</p>}</section>
    </div>:<section className="rounded-3xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-400">Selecciona una entrega para revisarla.</section>}
   </section>
  </div>
 </main>;
}
