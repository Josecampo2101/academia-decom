"use client";

import { StatusScreen } from "@/components/ui/StatusScreen";
import { Spinner } from "@/components/ui/Spinner";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ManualAssessmentReviewInbox from "./manual-review-inbox";

type AccessState = "checking" | "allowed" | "denied" | "error";

export default function TutorManualAssessmentReviewsPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [access, setAccess] = useState<AccessState>("checking");

  useEffect(() => {
    let active = true;
    async function verifyAccess() {
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();
        if (!active) return;
        if (authError || !user) {
          router.replace("/conexion");
          return;
        }
        const { data: assignments, error: assignmentError } = await supabase
          .from("user_role_assignments")
          .select("role_id")
          .eq("user_id", user.id);
        if (assignmentError) throw assignmentError;
        if (!active) return;
        const roleIds = [...new Set((assignments ?? []).map((item) => item.role_id))];
        if (roleIds.length === 0) {
          setAccess("denied");
          return;
        }
        const { data: roles, error: rolesError } = await supabase
          .from("roles")
          .select("role_key")
          .in("id", roleIds);
        if (rolesError) throw rolesError;
        if (!active) return;
        const keys = (roles ?? []).map((role) => role.role_key);
        if (
          keys.includes("tutor") ||
          keys.includes("academic_editor") ||
          keys.includes("national_admin")
        ) {
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
    return () => {
      active = false;
    };
  }, [router, supabase]);

  if (access === "checking") {
    return (
      <main id="contenido" className="flex min-h-screen items-center justify-center bg-background">
        <Spinner />
      </main>
    );
  }

  if (access !== "allowed") {
    return (
      <StatusScreen
        title={access === "error" ? "No pudimos validar tu acceso" : "Acceso restringido"}
        message={
          access === "error"
            ? "Intenta nuevamente."
            : "Este espacio está habilitado para tutores, editores académicos y administración nacional."
        }
        actionLabel="Volver al panel"
        onAction={() => router.push("/dashboard/tutor")}
      />
    );
  }

  return (
    <main id="contenido" className="min-h-screen bg-background text-foreground">
      <header>
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 pt-6 pb-0 md:px-8">
          <div>
            <p className="mt-1 text-xs text-muted-fg">Revisión de evaluaciones</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => router.push("/dashboard/tutor/evaluaciones/crear")}
              className="rounded-xl bg-decom-teal px-4 py-2.5 text-xs font-semibold text-decom-navy"
            >
              Crear evaluación
            </button>
            <button
              type="button"
              onClick={() => router.push("/dashboard/tutor")}
              className="rounded-xl border border-line px-4 py-2.5 text-xs font-semibold text-muted-fg"
            >
              Volver al panel
            </button>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-6xl space-y-6 px-5 py-7 md:px-8 md:py-9">
        <section>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-decom-teal-text">
            Evaluación del aprendizaje
          </p>
          <h1 className="mt-2 text-2xl font-extrabold md:text-3xl">
            Revisión manual de evaluaciones
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-fg">
            Consulta respuestas cortas, asigna puntajes y deja retroalimentación para el estudiante.
          </p>
        </section>
        <ManualAssessmentReviewInbox />
      </div>
    </main>
  );
}
