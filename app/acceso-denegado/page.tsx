
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AccesoDenegado() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function cerrarSesion() {
    setLoading(true);

    const supabase = createClient();
    await supabase.auth.signOut();

    router.replace("/");
    router.refresh();
  }

  return (
    <main id="contenido" className="min-h-screen flex items-center justify-center bg-background px-6 py-12 dark:bg-[#101B2A]">
      <section className="w-full max-w-lg rounded-2xl border border-line bg-surface p-8 text-center shadow-lg dark:bg-[#1C2B3D]">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-3xl text-red-600 dark:bg-red-950 dark:text-red-400">
          !
        </div>

        <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-decom-blue-text">
          Academia DECOM
        </p>

        <h1 className="mb-4 text-2xl font-bold text-foreground">
          Acceso no autorizado
        </h1>

        <p className="mb-6 leading-relaxed text-muted-fg">
          Tu cuenta no tiene autorización para acceder a esta plataforma
          en este momento, o no fue posible verificar su estado.
        </p>

        <div className="mb-7 rounded-xl bg-surface-muted p-4 text-sm text-muted-fg dark:bg-[#101B2A]">
          Si consideras que se trata de un error, comunícate con la
          administración de Academia DECOM para verificar tu cuenta.
        </div>

        <button
          onClick={cerrarSesion}
          disabled={loading}
          className="w-full rounded-xl bg-decom-navy px-5 py-3 font-semibold text-white transition hover:bg-decom-blue disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Cerrando sesión..." : "Volver al inicio"}
        </button>

        <p className="mt-8 text-xs text-muted-fg">
          Formación para comunicar con propósito
        </p>
      </section>
    </main>
  );
}
