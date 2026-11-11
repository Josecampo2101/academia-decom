"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { readDemoBridge, upsertDemoBridgeSubmission, type DemoBridgeReview } from "@/lib/academic/demo-bridge";

type AccessState = "checking" | "allowed" | "denied" | "error";
type DemoSubmissionStatus = "Sin guardar" | "Borrador" | "En revisión" | "Requiere ajustes" | "Calificada" | "Rechazada";
type DemoAttempt = { number: number; submittedAt: string; answer: string; referenceUrl: string; status: "En revisión" | "Requiere ajustes" | "Calificada" | "Rechazada" };
type DemoWork = { answer: string; referenceUrl: string; status: DemoSubmissionStatus; attempts: DemoAttempt[]; savedAt: string | null };

const activities: Record<string, {
  title: string;
  course: string;
  module: string;
  due: string;
  instructions: string[];
  criteria: string[];
  formats: string;
}> = {
  "reflexion-proposito": {
    title: "Reflexión: comunicar con propósito",
    course: "Identidad corporativa DECOM",
    module: "Módulo 1 · Conociendo DECOM",
    due: "Fecha límite por definir en la publicación del curso",
    instructions: [
      "Elige un mensaje institucional de ejemplo o plantea una situación hipotética.",
      "Identifica qué se quiere comunicar y a qué público se dirige.",
      "Explica por qué el medio seleccionado es adecuado para ese público.",
      "Propón una mejora para que el mensaje sea más claro y responsable.",
    ],
    criteria: [
      "Define el propósito del mensaje.",
      "Identifica las características del público.",
      "Justifica la selección del medio.",
      "Propone una mejora concreta y comprensible.",
    ],
    formats: "Respuesta breve escrita. Los archivos adjuntos no están habilitados en esta demostración.",
  },
  "aplicacion-identidad": {
    title: "Aplicación de la identidad visual",
    course: "Identidad corporativa DECOM",
    module: "Módulo 2 · Identidad institucional",
    due: "Fecha límite por definir en la publicación del curso",
    instructions: [
      "Selecciona una pieza de comunicación institucional de ejemplo o plantea una pieza hipotética.",
      "Describe el propósito de la pieza, el público al que se dirige y el medio en el que sería publicada.",
      "Explica cómo aplicarías los elementos de identidad visual y qué verificaciones realizarías antes de publicarla.",
      "Incluye una breve reflexión sobre la importancia de mantener coherencia institucional.",
    ],
    criteria: [
      "Identifica con claridad el propósito y el público.",
      "Relaciona correctamente los elementos visuales con los lineamientos institucionales.",
      "Explica un proceso de verificación antes de publicar.",
      "Presenta una argumentación clara, ordenada y respetuosa.",
    ],
    formats: "Respuesta escrita y, opcionalmente, un enlace de referencia. Los archivos adjuntos no están habilitados en esta demostración.",
  },
};

export default function StudentActivityClient({ activityId }: { activityId: string }) {
  const router = useRouter();
  const activity = activities[activityId];
  const supabase = useMemo(() => createClient(), []);
  const [access, setAccess] = useState<AccessState>("checking");
  const [displayName, setDisplayName] = useState("Estudiante");
  const [userId, setUserId] = useState<string | null>(null);
  const [workLoaded, setWorkLoaded] = useState(false);
  const [workStatus, setWorkStatus] = useState<DemoSubmissionStatus>("Sin guardar");
  const [attempts, setAttempts] = useState<DemoAttempt[]>([]);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [referenceUrl, setReferenceUrl] = useState("");
  const [confirmation, setConfirmation] = useState(false);
  const [validationMessage, setValidationMessage] = useState("");
  const [sharedReview, setSharedReview] = useState<DemoBridgeReview | null>(null);

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
        setDisplayName(String(user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email?.split("@")[0] ?? "Estudiante"));
        setUserId(user.id);
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
        console.error("No fue posible validar el acceso a la actividad:", error);
        if (active) setAccess("error");
      }
    }
    void Promise.resolve().then(verifyAccess);
    return () => { active = false; };
  }, [router, supabase]);

  const storageKey = userId && activityId ? `academia-decom:demo-work:${userId}:${activityId}` : null;

  useEffect(() => {
    if (!storageKey) return;
    try {
      const shared = readDemoBridge().find((item) => item.studentId === userId && item.activityId === activityId);
      if (shared) {
        setSharedReview(shared.review);
        if (shared.status === "Requiere ajustes") setWorkStatus("Requiere ajustes");
        else if (shared.status === "Calificada") setWorkStatus("Calificada");
        else if (shared.status === "Rechazada") setWorkStatus("Rechazada");
        else if (shared.status === "En revisión") setWorkStatus("En revisión");
        if (shared.attempts.length) setAttempts(shared.attempts.map((attempt) => ({
          number: attempt.number, submittedAt: attempt.submittedAt, answer: attempt.answer,
          referenceUrl: attempt.referenceUrl,
          status: shared.status === "Requiere ajustes" ? "Requiere ajustes" : shared.status === "Rechazada" ? "Rechazada" : shared.status === "Calificada" ? "Calificada" : "En revisión",
        })));
      }
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const saved = JSON.parse(raw) as DemoWork;
        // Hydration from browser storage is an intentional state restoration.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setAnswer(saved.answer ?? "");
        setReferenceUrl(saved.referenceUrl ?? "");
        setWorkStatus(saved.status ?? "Sin guardar");
        setAttempts(Array.isArray(saved.attempts) ? saved.attempts : []);
        setSavedAt(saved.savedAt ?? null);
      }
    } catch (error) {
      console.error("No fue posible recuperar el borrador local:", error);
      setValidationMessage("No pudimos recuperar el borrador guardado en este navegador.");
    } finally {
      setWorkLoaded(true);
    }
  }, [storageKey, userId, activityId]);

  useEffect(() => {
    if (!userId || !activityId) return;
    const refreshReview = () => {
      const shared = readDemoBridge().find((item) => item.studentId === userId && item.activityId === activityId);
      if (!shared) return;
      setSharedReview(shared.review);
      if (shared.status === "Requiere ajustes") setWorkStatus("Requiere ajustes");
      else if (shared.status === "Calificada") setWorkStatus("Calificada");
      else if (shared.status === "Rechazada") setWorkStatus("Rechazada");
      else if (shared.status === "En revisión") setWorkStatus("En revisión");
      if (shared.attempts.length) setAttempts(shared.attempts.map((attempt) => ({
        number: attempt.number, submittedAt: attempt.submittedAt, answer: attempt.answer,
        referenceUrl: attempt.referenceUrl,
        status: shared.status === "Requiere ajustes" ? "Requiere ajustes" : shared.status === "Rechazada" ? "Rechazada" : shared.status === "Calificada" ? "Calificada" : "En revisión",
      })));
    };
    // Initial synchronization reads only this browser's local demonstration record.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshReview();
    window.addEventListener("academia-decom:demo-bridge-updated", refreshReview);
    window.addEventListener("storage", refreshReview);
    window.addEventListener("focus", refreshReview);
    return () => {
      window.removeEventListener("academia-decom:demo-bridge-updated", refreshReview);
      window.removeEventListener("storage", refreshReview);
      window.removeEventListener("focus", refreshReview);
    };
  }, [userId, activityId]);

  function persistWork(next: DemoWork) {
    if (!storageKey) {
      setValidationMessage("No fue posible identificar la sesión para guardar este trabajo local.");
      return false;
    }
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(next));
      setAnswer(next.answer);
      setReferenceUrl(next.referenceUrl);
      setWorkStatus(next.status);
      setAttempts(next.attempts);
      setSavedAt(next.savedAt);
      setValidationMessage("");
      return true;
    } catch (error) {
      console.error("No fue posible guardar el trabajo local:", error);
      setValidationMessage("El navegador no permitió guardar el borrador. Comprueba el espacio disponible y los permisos de almacenamiento.");
      return false;
    }
  }

  function validateResponse() {
    if (answer.trim().length < 40) {
      setValidationMessage("Desarrolla una respuesta de al menos 40 caracteres para continuar.");
      return false;
    }
    if (referenceUrl.trim()) {
      try {
        const parsed = new URL(referenceUrl);
        if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("URL no permitida");
      } catch {
        setValidationMessage("Escribe un enlace válido que comience con https:// o http://.");
        return false;
      }
    }
    if (!confirmation) {
      setValidationMessage("Confirma que revisaste tu respuesta antes de continuar.");
      return false;
    }
    return true;
  }

  function saveDraft() {
    if (workStatus === "En revisión" || workStatus === "Calificada" || workStatus === "Rechazada") {
      setValidationMessage("Esta entrega ya fue enviada. No puedes modificarla en este estado.");
      return;
    }
    const next: DemoWork = {
      answer,
      referenceUrl,
      status: "Borrador",
      attempts,
      savedAt: new Date().toISOString(),
    };
    if (persistWork(next)) setValidationMessage("Borrador guardado en este navegador. Todavía no se ha enviado al tutor.");
  }

  function submitWork(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validateResponse()) return;
    if (workStatus === "En revisión" || workStatus === "Calificada") {
      setValidationMessage("Esta entrega ya fue enviada y no admite cambios en este estado.");
      return;
    }
    const nextAttempt: DemoAttempt = {
      number: attempts.length + 1,
      submittedAt: new Date().toISOString(),
      answer,
      referenceUrl,
      status: "En revisión",
    };
    const next: DemoWork = {
      answer,
      referenceUrl,
      status: "En revisión",
      attempts: [...attempts, nextAttempt],
      savedAt: new Date().toISOString(),
    };
    if (persistWork(next)) {
      const shared = readDemoBridge().find((item) => item.studentId === userId && item.activityId === activityId);
      const bridged = upsertDemoBridgeSubmission({
        id: String(userId ?? "demo-student") + ":" + activityId,
        studentId: userId ?? "demo-student",
        studentName: displayName,
        activityId,
        activityTitle: activity.title,
        course: activity.course,
        status: "En revisión",
        attempts: [...(shared?.attempts ?? []), {
          number: nextAttempt.number, submittedAt: nextAttempt.submittedAt,
          answer: nextAttempt.answer, referenceUrl: nextAttempt.referenceUrl,
        }],
        review: null,
        updatedAt: new Date().toISOString(),
      });
      setSharedReview(null);
      setConfirmation(false);
      setValidationMessage(bridged
        ? "Envío demo disponible en la bandeja de tutoría de este mismo navegador. No se ha transmitido al servidor."
        : "El intento se guardó en tu navegador, pero no pudo actualizar la bandeja demo del tutor.");
    }
  }

  if (access === "checking" || (access === "allowed" && !workLoaded)) {
    return <main className="flex min-h-screen items-center justify-center bg-[#F4F7FA]"><div className="h-10 w-10 animate-spin rounded-full border-4 border-[#087DB5]/20 border-t-[#087DB5]" /></main>;
  }

  if (access !== "allowed") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F4F7FA] px-6">
        <section className="max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center">
          <h1 className="text-xl font-bold text-[#102D4D]">{access === "error" ? "No pudimos validar tu acceso" : "Acceso restringido"}</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">{access === "error" ? "Intenta nuevamente." : "Esta actividad está habilitada para estudiantes con una asignación vigente."}</p>
          <button type="button" onClick={() => router.push("/dashboard/estudiante")} className="mt-5 rounded-xl bg-[#087DB5] px-5 py-3 text-sm font-semibold text-white">Volver al panel</button>
        </section>
      </main>
    );
  }

  if (!activity) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F4F7FA] px-6">
        <section className="max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center">
          <h1 className="text-xl font-bold text-[#102D4D]">Actividad no encontrada</h1>
          <p className="mt-2 text-sm text-slate-500">No existe una actividad con ese identificador en la demostración.</p>
          <button type="button" onClick={() => router.push("/dashboard/estudiante/actividades")} className="mt-5 rounded-xl bg-[#087DB5] px-5 py-3 text-sm font-semibold text-white">Ver actividades</button>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F4F7FA] text-[#102D4D]">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-4 md:px-8">
          <div><p className="text-xs font-extrabold tracking-[0.14em] text-[#087DB5]">ACADEMIA DECOM</p><p className="mt-1 text-xs text-slate-400">Actividad formativa · {displayName}</p></div>
          <button type="button" onClick={() => router.push("/dashboard/estudiante/actividades")} className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">← Actividades</button>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-6 px-5 py-7 pb-12 md:px-8 md:py-9 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className="min-w-0 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-400"><span>{activity.course}</span><span>·</span><span>{activity.module}</span><span className="ml-auto rounded-full bg-amber-50 px-3 py-1 text-amber-800">Demostración</span></div>
          <h1 className="mt-5 text-2xl font-extrabold md:text-3xl">{activity.title}</h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">Lee las instrucciones y los criterios antes de preparar tu respuesta.</p>

          <div className="mt-7">
            <h2 className="text-base font-bold">Instrucciones</h2>
            <ol className="mt-4 space-y-4">
              {activity.instructions.map((item, index) => <li key={item} className="flex gap-3 text-sm leading-6 text-slate-600"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#EAF5FA] text-xs font-bold text-[#087DB5]">{index + 1}</span><span>{item}</span></li>)}
            </ol>
          </div>

          <div className="mt-8 rounded-2xl border border-slate-200 p-5">
            <h2 className="text-sm font-bold">Criterios de revisión</h2>
            <ul className="mt-4 space-y-3">
              {activity.criteria.map((item) => <li key={item} className="flex gap-3 text-sm leading-6 text-slate-600"><span className="mt-0.5 text-teal-600">✓</span>{item}</li>)}
            </ul>
          </div>

          <form onSubmit={submitWork} className="mt-8 space-y-5">
            <div>
              <label htmlFor="activity-answer" className="text-sm font-bold">Tu respuesta</label>
              <p className="mt-1 text-xs text-slate-400">Desarrolla tu análisis con tus propias palabras.</p>
              <textarea id="activity-answer" value={answer} disabled={workStatus === "En revisión" || workStatus === "Calificada"} onChange={(event) => { setAnswer(event.target.value); setValidationMessage(""); }} rows={9} maxLength={5000} placeholder="Escribe aquí tu propuesta y explica cómo aplicarías los principios de identidad institucional..." className="mt-3 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm leading-6 outline-none focus:border-[#087DB5] focus:ring-2 focus:ring-[#087DB5]/10" />
              <div className="mt-1 flex justify-between text-[10px] text-slate-400"><span>Mínimo de prueba: 40 caracteres</span><span>{answer.length}/5000</span></div>
            </div>
            <div>
              <label htmlFor="reference-url" className="text-sm font-bold">Enlace de referencia <span className="font-normal text-slate-400">(opcional)</span></label>
              <input id="reference-url" type="url" value={referenceUrl} disabled={workStatus === "En revisión" || workStatus === "Calificada"} onChange={(event) => { setReferenceUrl(event.target.value); setValidationMessage(""); }} placeholder="https://..." className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#087DB5]" />
            </div>
            <label className="flex items-start gap-3 text-xs leading-5 text-slate-500"><input type="checkbox" checked={confirmation} disabled={workStatus === "En revisión" || workStatus === "Calificada"} onChange={(event) => { setConfirmation(event.target.checked); setValidationMessage(""); }} className="mt-0.5 h-4 w-4 accent-[#087DB5]" /><span>Confirmo que esta respuesta es de mi autoría y que he revisado las instrucciones.</span></label>
            {validationMessage && <p role="status" className={`rounded-xl p-3 text-xs leading-5 ${validationMessage.startsWith("Validación") ? "bg-teal-50 text-teal-800" : "bg-amber-50 text-amber-800"}`}>{validationMessage}</p>}
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap"><button type="button" onClick={saveDraft} disabled={workStatus === "En revisión" || workStatus === "Calificada"} className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Guardar borrador</button><button type="submit" disabled={workStatus === "En revisión" || workStatus === "Calificada"} className="rounded-xl bg-[#087DB5] px-5 py-3 text-sm font-semibold text-white hover:bg-[#066a9b] disabled:cursor-not-allowed disabled:opacity-40">{workStatus === "Requiere ajustes" ? "Enviar nueva versión" : "Enviar actividad (demo)"}</button></div>
          </form>
        </section>

        <aside className="space-y-4">
          <section className="rounded-3xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Información</p>
            <h2 className="mt-2 text-sm font-bold">Entrega de actividad</h2>
            <div className="mt-4 space-y-4">
              <div><p className="text-[10px] font-semibold text-slate-400">FECHA LÍMITE</p><p className="mt-1 text-xs font-semibold text-slate-600">{activity.due}</p></div>
              <div><p className="text-[10px] font-semibold text-slate-400">FORMATO</p><p className="mt-1 text-xs leading-5 text-slate-600">{activity.formats}</p></div>
              <div><p className="text-[10px] font-semibold text-slate-400">ESTADO</p><span className="mt-1 inline-flex rounded-full bg-sky-50 px-2.5 py-1 text-[10px] font-bold text-sky-800">{workStatus} · Demo</span>{savedAt && <p className="mt-1 text-[10px] text-slate-400">Último cambio: {new Date(savedAt).toLocaleString("es-CO")}</p>}</div>
            </div>
          </section>
          {sharedReview && <section className="rounded-3xl border border-teal-200 bg-teal-50 p-5"><h2 className="text-sm font-bold text-teal-900">Retroalimentación del tutor · demo</h2><p className="mt-2 text-xs font-semibold text-teal-800">{sharedReview.decision} · {new Date(sharedReview.reviewedAt).toLocaleString("es-CO")}</p><p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-teal-900">{sharedReview.feedback || "El tutor no agregó observaciones."}</p>{sharedReview.decision === "Solicitar ajustes" && <p className="mt-3 text-xs font-semibold text-teal-900">Puedes preparar una nueva versión y enviarla como siguiente intento.</p>}</section>}
          {attempts.length > 0 && <section className="rounded-3xl border border-slate-200 bg-white p-5"><h2 className="text-sm font-bold">Historial de intentos</h2><ol className="mt-3 space-y-3">{attempts.map((attempt) => <li key={attempt.number} className="border-l-2 border-[#19A7A0] pl-3"><p className="text-xs font-semibold">Intento {attempt.number} · {attempt.status}</p><p className="mt-1 text-[10px] text-slate-400">{new Date(attempt.submittedAt).toLocaleString("es-CO")}</p><p className="mt-1 line-clamp-3 text-xs leading-5 text-slate-500">{attempt.answer}</p></li>)}</ol></section>}
          <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5">
            <h2 className="text-sm font-bold text-amber-900">Importante</h2>
            <p className="mt-2 text-xs leading-5 text-amber-800">El borrador y los intentos de demostración se guardan en el almacenamiento local de este navegador. Los envíos aparecen en la bandeja demo del tutor y su retroalimentación puede volver a esta vista solo dentro del mismo navegador; no existe sincronización entre dispositivos ni persistencia de servidor.</p>
          </section>
          <button type="button" onClick={() => router.push("/dashboard/estudiante/leccion/coherencia-mensajes")} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-semibold text-slate-600 hover:bg-slate-50">← Volver a la lección</button>
        </aside>
      </div>
    </main>
  );
}
