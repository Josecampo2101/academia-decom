"use client";

import "./globals.css";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

/**
 * Último recurso: se muestra si falla el layout raíz. Sustituye al layout, por eso
 * define <html> y <body> y no depende de componentes de la aplicación.
 */
export default function GlobalError({ error, reset }: GlobalErrorProps) {
  return (
    <html lang="es">
      <body className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground antialiased">
        <main id="contenido" role="alert" className="w-full max-w-md text-center">
          <h1 className="text-2xl font-semibold">La plataforma no pudo cargarse</h1>
          <p className="mt-3 text-sm text-muted-fg">
            Intenta de nuevo. Si el problema continúa, avisa a la coordinación de DECOM.
          </p>
          {error.digest ? (
            <p className="mt-3 text-xs text-muted-fg">
              Código de referencia: <span className="font-mono">{error.digest}</span>
            </p>
          ) : null}
          <button
            type="button"
            onClick={reset}
            className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-decom-blue px-5 py-2.5 text-sm font-semibold text-white hover:bg-decom-blue-hover"
          >
            Reintentar
          </button>
        </main>
      </body>
    </html>
  );
}
