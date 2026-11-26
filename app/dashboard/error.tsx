"use client";

import Link from "next/link";
import { useEffect } from "react";
import { RefreshCw, TriangleAlert } from "lucide-react";

type DashboardErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

/**
 * Error dentro del panel: se muestra en el área de contenido y el menú lateral y la barra superior
 * siguen disponibles. No expone el mensaje técnico; solo un código de referencia para soporte.
 */
export default function DashboardError({ error, reset }: DashboardErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main id="contenido" className="flex items-center justify-center px-6 py-16">
      <section
        role="alert"
        className="w-full max-w-md rounded-3xl border border-line bg-surface p-8 text-center shadow-sm"
      >
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-700">
          <TriangleAlert className="h-7 w-7" aria-hidden="true" />
        </span>
        <h1 className="mt-5 text-xl font-semibold">Esta sección no pudo cargarse</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-fg">
          Puedes intentarlo de nuevo o continuar con otra opción del menú. Si el problema sigue,
          avisa a la coordinación de DECOM indicando el código de referencia.
        </p>
        {error.digest ? (
          <p className="mt-4 text-xs text-muted-fg">
            Código de referencia: <span className="font-mono">{error.digest}</span>
          </p>
        ) : null}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={reset}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-decom-blue px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-decom-blue-hover"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Reintentar
          </button>
          <Link
            href="/dashboard"
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-line bg-surface px-5 py-2.5 text-sm font-semibold text-foreground transition hover:bg-surface-muted"
          >
            Ir al panel
          </Link>
        </div>
      </section>
    </main>
  );
}
