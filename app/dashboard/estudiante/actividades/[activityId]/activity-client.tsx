"use client";
import { FormEvent,useCallback,useEffect,useMemo,useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
type Access="checking"|"allowed"|"error";
type Activity={id:string;title:string;description:string|null;instructions:string;response_type:"text"|"file"|"link"|"mixed";total_points:number;max_attempts:number;due_at:string|null;status:string;courses:{title:string}|null;course_modules:{title:string}|null};
type Assignment={id:string;district_id:string;due_at:string|null;academic_activities:Activity};
type Submission={id:string;attempt_number:number;response_text:string|null;external_url:string|null;status:string;awarded_points:number|null;feedback:string|null;submitted_at:string|null};
type Attachment={id:string;storage_path:string;file_name:string;mime_type:string;size_bytes:number};
type Review={id:string;attempt_number:number;status:string;awarded_points:number|null;feedback:string|null;reviewed_at:string};
const statusText:Record<string,string>={draft:"Borrador",submitted:"En revisión",changes_requested:"Requiere ajustes",graded:"Calificada"};
export default function StudentActivityClient({activityId:assignmentId}:{activityId:string}){
 const router=useRouter();const supabase=useMemo(()=>createClient(),[]);
 const [access,setAccess]=useState<Access>("checking");const [assignment,setAssignment]=useState<Assignment|null>(null);
 const [submission,setSubmission]=useState<Submission|null>(null);const [attachments,setAttachments]=useState<Attachment[]>([]);
 const [reviews,setReviews]=useState<Review[]>([]);const [answer,setAnswer]=useState("");const [link,setLink]=useState("");
 const [file,setFile]=useState<File|null>(null);const [busy,setBusy]=useState(false);const [loading,setLoading]=useState(true);
 const [notice,setNotice]=useState("");const [error,setError]=useState("");
 const load=useCallback(async()=>{
  setLoading(true);setError("");
  try{
   const {data:{user},error:authError}=await supabase.auth.getUser();if(authError||!user){router.replace("/conexion");return;}
   const {data:a,error:ae}=await supabase.from("academic_activity_assignments").select("id,district_id,due_at,academic_activities!inner(id,title,description,instructions,response_type,total_points,max_attempts,due_at,status,courses(title),course_modules(title))").eq("id",assignmentId).eq("status","active").single();
   if(ae)throw ae;const current=a as unknown as Assignment;if(current.academic_activities.status!=="published")throw new Error("La actividad ya no está publicada.");setAssignment(current);
   const {data:s,error:se}=await supabase.from("academic_activity_submissions").select("id,attempt_number,response_text,external_url,status,awarded_points,feedback,submitted_at").eq("assignment_id",assignmentId).order("attempt_number",{ascending:false}).limit(1).maybeSingle();
   if(se)throw se;let currentSubmission=s as Submission|null;
   if(!currentSubmission){const {data:id,error:startError}=await supabase.rpc("start_academic_activity_submission",{p_assignment_id:assignmentId});if(startError)throw startError;
    const {data:created,error:createdError}=await supabase.from("academic_activity_submissions").select("id,attempt_number,response_text,external_url,status,awarded_points,feedback,submitted_at").eq("id",id).single();if(createdError)throw createdError;currentSubmission=created as Submission;}
   setSubmission(currentSubmission);setAnswer(currentSubmission.response_text??"");setLink(currentSubmission.external_url??"");
   const [filesResult,historyResult]=await Promise.all([
    supabase.from("academic_activity_submission_files").select("id,storage_path,file_name,mime_type,size_bytes").eq("submission_id",currentSubmission.id).order("created_at"),
    supabase.from("academic_activity_submission_reviews").select("id,attempt_number,status,awarded_points,feedback,reviewed_at").eq("submission_id",currentSubmission.id).order("reviewed_at",{ascending:false})
   ]);
   if(filesResult.error)throw filesResult.error;if(historyResult.error)throw historyResult.error;
   setAttachments((filesResult.data??[]) as Attachment[]);setReviews((historyResult.data??[]) as Review[]);setAccess("allowed");
  }catch(cause){console.error("No fue posible cargar la actividad:",cause);setError(cause instanceof Error?cause.message:"No fue posible cargar esta actividad.");setAccess("error");}
  finally{setLoading(false);}
 },[assignmentId,router,supabase]);
 useEffect(()=>{void load();},[load]);
 const activity=assignment?.academic_activities;const editable=submission?.status==="draft";
 const responseType=activity?.response_type;const needText=responseType==="text"||responseType==="mixed";
 const needFile=responseType==="file"||responseType==="mixed";const needLink=responseType==="link"||responseType==="mixed";
 async function saveDraft(){
  if(!submission||!editable)return;setBusy(true);setError("");setNotice("");
  try{const {error:e}=await supabase.from("academic_activity_submissions").update({response_text:answer.trim()||null,external_url:link.trim()||null,updated_at:new Date().toISOString()}).eq("id",submission.id).eq("status","draft");if(e)throw e;setNotice("Borrador guardado en tu cuenta.");}
  catch(cause){setError(cause instanceof Error?cause.message:"No fue posible guardar el borrador.");}finally{setBusy(false);}
 }
 async function uploadFile(){
  if(!file||!submission||!assignment||!editable)return;
  if(file.size>50*1024*1024){setError("El archivo supera el límite de 50 MB.");return;}
  setBusy(true);setError("");setNotice("");
  try{
   const {data:{user},error:authError}=await supabase.auth.getUser();if(authError||!user)throw new Error("La sesión expiró.");
   const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,"_").slice(-120)||"archivo";
   const path=`${assignment.district_id}/${user.id}/${submission.id}/${crypto.randomUUID()}-${safe}`;
   const {error:uploadError}=await supabase.storage.from("academic-activity-submissions").upload(path,file,{upsert:false,contentType:file.type||"application/octet-stream"});if(uploadError)throw uploadError;
   const {error:metaError}=await supabase.from("academic_activity_submission_files").insert({submission_id:submission.id,activity_id:activity!.id,district_id:assignment.district_id,user_id:user.id,storage_path:path,file_name:file.name,mime_type:file.type||"application/octet-stream",size_bytes:file.size});
   if(metaError){await supabase.storage.from("academic-activity-submissions").remove([path]);throw metaError;}
   setFile(null);setNotice("Archivo adjuntado correctamente.");await load();
  }catch(cause){setError(cause instanceof Error?cause.message:"No fue posible adjuntar el archivo.");}finally{setBusy(false);}
 }
 async function removeFile(item:Attachment){
  if(!editable)return;setBusy(true);setError("");
  try{const {error:storageError}=await supabase.storage.from("academic-activity-submissions").remove([item.storage_path]);if(storageError)throw storageError;const {error:e}=await supabase.from("academic_activity_submission_files").delete().eq("id",item.id);if(e)throw e;setAttachments(current=>current.filter(x=>x.id!==item.id));}
  catch(cause){setError(cause instanceof Error?cause.message:"No fue posible quitar el archivo.");}finally{setBusy(false);}
 }
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(!submission||!editable)return;
  if(needText&&!answer.trim()){setError("Escribe tu respuesta antes de enviar.");return;}
  if(needLink&&!link.trim()){setError("Agrega el enlace solicitado antes de enviar.");return;}
  if(needFile&&!attachments.length){setError("Adjunta al menos un archivo antes de enviar.");return;}
  if(link.trim()){try{const parsed=new URL(link);if(!["http:","https:"].includes(parsed.protocol))throw new Error();}catch{setError("El enlace debe comenzar con http:// o https://.");return;}}
  setBusy(true);setError("");setNotice("");
  try{
   const {error:updateError}=await supabase.from("academic_activity_submissions").update({response_text:answer.trim()||null,external_url:link.trim()||null,updated_at:new Date().toISOString()}).eq("id",submission.id).eq("status","draft");if(updateError)throw updateError;
   const {error:submitError}=await supabase.rpc("submit_academic_activity_submission",{p_submission_id:submission.id});if(submitError)throw submitError;
   setNotice("Tu actividad fue enviada al tutor.");await load();
  }catch(cause){setError(cause instanceof Error?cause.message:"No fue posible enviar la actividad.");}finally{setBusy(false);}
 }
 async function reopen(){
  if(!submission||submission.status!=="changes_requested")return;setBusy(true);setError("");setNotice("");
  try{const {error:e}=await supabase.rpc("reopen_academic_activity_submission",{p_submission_id:submission.id});if(e)throw e;setNotice("La entrega fue reabierta. Ya puedes realizar los ajustes.");await load();}
  catch(cause){setError(cause instanceof Error?cause.message:"No fue posible reabrir la entrega.");}finally{setBusy(false);}
 }
 async function openFile(item:Attachment){
  const {data,error:e}=await supabase.storage.from("academic-activity-submissions").createSignedUrl(item.storage_path,60);if(e){setError(e.message);return;}window.open(data.signedUrl,"_blank","noopener,noreferrer");
 }
 if(loading||access==="checking")return <main className="flex min-h-screen items-center justify-center bg-[#F4F7FA]"><div className="h-10 w-10 animate-spin rounded-full border-4 border-[#087DB5]/20 border-t-[#087DB5]"/></main>;
 if(access!=="allowed"||!assignment||!submission||!activity)return <main className="flex min-h-screen items-center justify-center bg-[#F4F7FA] px-6"><section className="max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center"><h1 className="text-xl font-bold text-[#102D4D]">No fue posible abrir la actividad</h1><p className="mt-2 text-sm text-slate-500">{error||"Comprueba que la asignación siga vigente."}</p><button type="button" onClick={()=>router.push("/dashboard/estudiante/actividades")} className="mt-5 rounded-xl bg-[#087DB5] px-5 py-3 text-sm font-semibold text-white">Volver a actividades</button></section></main>;
 const due=assignment.due_at??activity.due_at;const locked=submission.status==="submitted"||submission.status==="graded";
 return <main className="min-h-screen bg-[#F4F7FA] text-[#102D4D]">
  <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-4 md:px-8"><div><p className="text-xs font-extrabold tracking-[0.14em] text-[#087DB5]">ACADEMIA DECOM</p><p className="mt-1 text-xs text-slate-400">Actividad asignada · Intento {submission.attempt_number}</p></div><button type="button" onClick={()=>router.push("/dashboard/estudiante/actividades")} className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-600">← Mis actividades</button></div></header>
  <div className="mx-auto grid max-w-6xl gap-6 px-5 py-7 pb-12 md:px-8 md:py-9 lg:grid-cols-[minmax(0,1fr)_300px]">
   <section className="min-w-0 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
    <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-400"><span>{activity.courses?.title??"Curso"}</span><span>·</span><span>{activity.course_modules?.title??"Sin módulo"}</span><span className="ml-auto rounded-full bg-sky-50 px-3 py-1 text-sky-800">{statusText[submission.status]??submission.status}</span></div>
    <h1 className="mt-5 text-2xl font-extrabold md:text-3xl">{activity.title}</h1>{activity.description&&<p className="mt-3 text-sm leading-6 text-slate-500">{activity.description}</p>}
    <div className="mt-7 rounded-2xl bg-[#F4F7FA] p-5"><h2 className="text-sm font-bold">Instrucciones</h2><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{activity.instructions}</p></div>
    {submission.feedback&&<div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5"><h2 className="text-sm font-bold text-amber-900">Retroalimentación del tutor</h2><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-amber-900">{submission.feedback}</p></div>}
    {submission.status==="graded"&&<div className="mt-5 rounded-2xl border border-teal-200 bg-teal-50 p-5"><h2 className="text-sm font-bold text-teal-900">Resultado</h2><p className="mt-2 text-2xl font-extrabold text-teal-900">{submission.awarded_points??0} / {activity.total_points} puntos</p></div>}
    {submission.status==="changes_requested"&&<button type="button" disabled={busy} onClick={()=>void reopen()} className="mt-5 rounded-xl bg-[#087DB5] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">Reabrir y corregir entrega</button>}
    {editable&&<form onSubmit={submit} className="mt-8 space-y-5">
     {needText&&<div><label htmlFor="activity-answer" className="text-sm font-bold">Tu respuesta</label><textarea id="activity-answer" value={answer} onChange={e=>setAnswer(e.target.value)} rows={9} maxLength={10000} placeholder="Desarrolla tu respuesta con tus propias palabras..." className="mt-3 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm leading-6 outline-none focus:border-[#087DB5]"/><p className="mt-1 text-right text-[10px] text-slate-400">{answer.length}/10000</p></div>}
     {needLink&&<div><label htmlFor="activity-link" className="text-sm font-bold">Enlace de referencia o entrega</label><input id="activity-link" type="url" value={link} onChange={e=>setLink(e.target.value)} placeholder="https://..." className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#087DB5]"/></div>}
     {needFile&&<div className="rounded-2xl border border-slate-200 p-4"><label htmlFor="activity-file" className="text-sm font-bold">Archivos adjuntos</label><p className="mt-1 text-xs text-slate-500">Máximo 50 MB por archivo. Los archivos son privados.</p><div className="mt-3 flex flex-col gap-2 sm:flex-row"><input id="activity-file" type="file" disabled={busy} onChange={e=>setFile(e.target.files?.[0]??null)} className="min-w-0 flex-1 text-xs"/><button type="button" disabled={!file||busy} onClick={()=>void uploadFile()} className="rounded-lg border border-[#087DB5]/30 px-3 py-2 text-xs font-semibold text-[#087DB5] disabled:opacity-40">Adjuntar</button></div>
      {attachments.map(item=><div key={item.id} className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-[#F4F7FA] p-3"><button type="button" onClick={()=>void openFile(item)} className="min-w-0 truncate text-left text-xs font-semibold text-[#087DB5] underline">{item.file_name}</button><div className="flex shrink-0 items-center gap-2"><span className="text-[10px] text-slate-400">{(item.size_bytes/1048576).toFixed(1)} MB</span><button type="button" disabled={busy} onClick={()=>void removeFile(item)} className="text-xs text-red-600">Quitar</button></div></div>)}
     </div>}
     <div className="flex flex-col gap-2 sm:flex-row"><button type="button" disabled={busy} onClick={()=>void saveDraft()} className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 disabled:opacity-50">Guardar borrador</button><button type="submit" disabled={busy} className="rounded-xl bg-[#087DB5] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy?"Procesando...":"Enviar al tutor"}</button></div>
    </form>}
    {locked&&<p className="mt-7 rounded-xl bg-[#F4F7FA] p-4 text-xs leading-5 text-slate-500">{submission.status==="graded"?"Esta entrega ya fue calificada. Consulta el puntaje y la retroalimentación.":"Tu entrega fue recibida y está pendiente de revisión."}</p>}
    {error&&<p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-xs text-red-700">{error}</p>}{notice&&<p role="status" className="mt-4 rounded-xl bg-teal-50 p-3 text-xs text-teal-800">{notice}</p>}
   </section>
   <aside className="space-y-4">
    <section className="rounded-3xl border border-slate-200 bg-white p-5"><h2 className="text-sm font-bold">Detalles de la actividad</h2><dl className="mt-4 space-y-3 text-xs"><div><dt className="text-slate-400">Estado</dt><dd className="mt-1 font-semibold">{statusText[submission.status]??submission.status}</dd></div><div><dt className="text-slate-400">Puntaje máximo</dt><dd className="mt-1 font-semibold">{activity.total_points} puntos</dd></div><div><dt className="text-slate-400">Intento</dt><dd className="mt-1 font-semibold">{submission.attempt_number} de {activity.max_attempts}</dd></div><div><dt className="text-slate-400">Fecha límite</dt><dd className="mt-1 font-semibold">{due?new Date(due).toLocaleString("es-CO"):"Sin fecha límite"}</dd></div><div><dt className="text-slate-400">Formato</dt><dd className="mt-1 font-semibold">{activity.response_type}</dd></div></dl></section>
    <section className="rounded-3xl border border-slate-200 bg-white p-5"><h2 className="text-sm font-bold">Historial de revisiones</h2>{reviews.length?<ol className="mt-4 space-y-4">{reviews.map(item=><li key={item.id} className="border-l-2 border-[#19A7A0] pl-3"><p className="text-xs font-bold">{statusText[item.status]??item.status} · intento {item.attempt_number}</p>{item.awarded_points!==null&&<p className="mt-1 text-xs text-slate-600">{item.awarded_points} puntos</p>}{item.feedback&&<p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-slate-500">{item.feedback}</p>}<p className="mt-1 text-[10px] text-slate-400">{new Date(item.reviewed_at).toLocaleString("es-CO")}</p></li>)}</ol>:<p className="mt-3 text-xs leading-5 text-slate-400">Aún no hay decisiones registradas para esta entrega.</p>}</section>
   </aside>
  </div>
 </main>;
}
