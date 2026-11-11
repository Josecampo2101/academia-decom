"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  readDemoBridge,
  writeDemoBridge,
  type DemoBridgeSubmission,
  type DemoReviewDecision,
} from "@/lib/academic/demo-bridge";

export default function TutorDemoInbox() {
  const [items, setItems] = useState<DemoBridgeSubmission[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [decision, setDecision] = useState<DemoReviewDecision>("Aprobar");
  const [feedback, setFeedback] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(() => {
    const next = readDemoBridge();
    setItems(next);
    setSelectedId((current) => current && next.some((item) => item.id === current)
      ? current
      : next[0]?.id ?? null);
  }, []);

  useEffect(() => {
    // Initial read synchronizes the UI with the browser's demo storage.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
    const onStorage = (event: StorageEvent) => {
      if (event.key === "academia-decom:student-tutor-demo-bridge:v1") refresh();
    };
    const onUpdate = () => refresh();
    window.addEventListener("storage", onStorage);
    window.addEventListener("academia-decom:demo-bridge-updated", onUpdate);
    window.addEventListener("focus", onUpdate);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("academia-decom:demo-bridge-updated", onUpdate);
      window.removeEventListener("focus", onUpdate);
    };
  }, [refresh]);

  const selected = useMemo(
    () => items.find((item) => item.id === selectedId) ?? null,
    [items, selectedId],
  );

  function saveReview() {
    if (!selected) return;
    if (decision !== "Aprobar" && !feedback.trim()) {
      setNotice("Escribe observaciones para solicitar ajustes o rechazar la entrega.");
      return;
    }
    const updated: DemoBridgeSubmission = {
      ...selected,
      status: decision === "Aprobar" ? "Calificada" : decision === "Solicitar ajustes" ? "Requiere ajustes" : "Rechazada",
      review: {
        decision,
        feedback: feedback.trim(),
        reviewedAt: new Date().toISOString(),
      },
      updatedAt: new Date().toISOString(),
    };
    const next = items.map((item) => item.id === updated.id ? updated : item);
    if (writeDemoBridge(next)) {
      setItems(next);
      setNotice("Revisión de demostración guardada en este navegador. El estudiante podrá verla en este mismo navegador.");
    } else {
      setNotice("No fue posible guardar la revisión en el almacenamiento local.");
    }
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-base font-bold">Entregas del estudiante · conexión demo</h2><p className="mt-1 text-xs text-slate-500">Registros enviados desde el formulario del estudiante en este navegador.</p></div>
        <button type="button" onClick={refresh} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">Actualizar</button>
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(240px,0.8fr)_minmax(0,1.2fr)]">
        <div className="space-y-2">
          {items.map((item) => <button key={item.id} type="button" onClick={() => { setSelectedId(item.id); setFeedback(item.review?.feedback ?? ""); setDecision(item.review?.decision ?? "Aprobar"); setNotice(""); }} className={`w-full rounded-2xl border p-3 text-left ${selected?.id === item.id ? "border-[#087DB5] bg-sky-50" : "border-slate-200"}`}>
            <span className="block text-xs font-bold">{item.activityTitle}</span>
            <span className="mt-1 block text-[11px] text-slate-500">{item.studentName} · intento {item.attempts.length}</span>
            <span className="mt-2 inline-flex rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">{item.status}</span>
          </button>)}
          {items.length === 0 && <p className="rounded-xl border border-dashed border-slate-200 p-5 text-center text-xs leading-5 text-slate-500">Todavía no hay envíos del estudiante en esta demostración. Envía una actividad desde el panel de estudiante usando este mismo navegador.</p>}
        </div>
        {selected && <div className="rounded-2xl bg-[#F4F7FA] p-4">
          <p className="text-xs font-bold">{selected.studentName} · {selected.activityTitle}</p>
          <p className="mt-1 text-[10px] text-slate-500">{selected.course} · {selected.attempts.length} intento(s)</p>
          {selected.attempts.map((attempt) => <article key={attempt.number} className="mt-3 rounded-xl border border-slate-200 bg-white p-3"><p className="text-[10px] font-bold text-slate-500">Intento {attempt.number} · {new Date(attempt.submittedAt).toLocaleString("es-CO")}</p><p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-700">{attempt.answer}</p>{attempt.referenceUrl && <a className="mt-2 block break-all text-xs text-[#087DB5] underline" href={attempt.referenceUrl} target="_blank" rel="noreferrer">Abrir referencia</a>}</article>)}
          <div className="mt-4"><label className="text-xs font-bold" htmlFor="demo-review-decision">Decisión</label><select id="demo-review-decision" value={decision} onChange={(event) => setDecision(event.target.value as DemoReviewDecision)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"><option>Aprobar</option><option>Solicitar ajustes</option><option>Rechazar</option></select></div>
          <div className="mt-3"><label className="text-xs font-bold" htmlFor="demo-review-feedback">Retroalimentación</label><textarea id="demo-review-feedback" value={feedback} onChange={(event) => setFeedback(event.target.value)} maxLength={2000} rows={4} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs" placeholder="Indica logros, ajustes necesarios o motivo de rechazo..." /></div>
          <button type="button" onClick={saveReview} className="mt-3 rounded-xl bg-[#087DB5] px-4 py-2.5 text-xs font-semibold text-white">Guardar revisión demo</button>
        </div>}
      </div>
      {notice && <p role="status" className="mt-4 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-800">{notice}</p>}
      <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] leading-5 text-amber-800">Solo demostración local: no hay sincronización entre dispositivos, usuarios autenticados distintos ni servidor. No sustituye el registro académico oficial ni la calificación persistente.</p>
    </section>
  );
}
