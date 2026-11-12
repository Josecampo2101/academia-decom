"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ManualAssessmentReviewInbox from "./manual-review-inbox";

type AccessState = "checking" | "allowed" | "denied" | "error";

export default function TutorManualAssessmentReviewsPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [access, setAccess] = useState<AccessState>("checking");
  const [tutorId, setTutorId] = useState("");

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
        const { data: assignments, error: assignmentError } = await supabase
          .from("user_role_assignments").select("role_id").eq("user_id", user.id);
        if (assignmentError) throw assignmentError;
        if (!active) return;
        const roleIds = [...new Set((assignments ?? []).map((item) => item.role_id))];
        if (roleIds.length === 0) {
          setAccess("denied");
          return;
        }
        const { data: roles, error: rolesError } = await supabase
          .from("roles").select("role_key").in("id", roleIds);
        if (rolesError) throw rolesError;
        if (!active) return;
        const keys = (roles ?? []).map((role) => role.role_key);
        if (keys.includes("tutor") || keys.includes("national_admin")) {
          setTutorId(user.id);
          setAccess("allowed");
        } else {
          setAccess("denied");
        }
      } catch (error) {
        console.error("No fue posible validar el acceso a la revisión de evaluaciones:", error);
        if (active) setAccess("error");
      }
    }
    void verifyAccess();
    return () => { active = false; };
  }, [router, supabase]);

  if (access === "checking") {
    return <main className="flex min-h-screen items-center justify-center bg-[#F4F7FA]"><div className="h-10 w-10 animate-spin rounded-full border-4 border-[#087DB5]/20 border-t-[#087DB5]" /></main>;
  }

  if (access !== "allowed") {
    return <main className="flex min-h-screen items-center justify-center bg-[#F4F7FA] px-6"><section className="max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center"><h1 className="text-xl font-bold text-[#102D4D]">{access === "error" ? "No pudimos validar tu acceso" : "Acceso restringido"}</h1><p className="mt-2 text-sm text-slate-500">{access === "error" ? "Intenta nuevamente." : "Este espacio está habilitado para tutores y administración nacional."}</p><button type="button" onClick={() => router.push("/dashboard/tutor")} className="mt-5 rounded-xl bg-[#087DB5] px-5 py-3 text-sm font-semibold text-white">Volver al panel</button></section></main>;
  }

  return (
    <main className="min-h-screen bg-[#F4F7FA] text-[#102D4D]">
      <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-4 md:px-8"><div><p className="text-xs font-extrabold tracking-[0.14em] text-[#087DB5]">ACADEMIA DECOM</p><p className="mt-1 text-xs text-slate-400">Revisión de evaluaciones</p></div><div className="flex items-center gap-2"><button type="button" onClick={() => router.push("/dashboard/tutor/evaluaciones/crear")} className="rounded-xl bg-[#19A7A0] px-4 py-2.5 text-xs font-semibold text-white">Crear evaluación</button><button type="button" onClick={() => router.push("/dashboard/tutor")} className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-600">Volver al panel</button></div></div></header>
      <div className="mx-auto max-w-6xl space-y-6 px-5 py-7 md:px-8 md:py-9">
        <section><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#19A7A0]">Evaluación del aprendizaje</p><h1 className="mt-2 text-2xl font-extrabold md:text-3xl">Revisión manual de evaluaciones</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Consulta respuestas cortas, asigna puntajes y deja retroalimentación para el estudiante.</p></section>
        <ManualAssessmentReviewInbox tutorId={tutorId} />
      </div>
    </main>
  );
}
