import Link from "next/link";
import { Compass } from "lucide-react";

/** Página 404 con la identidad de la plataforma (reemplaza la pantalla por defecto de Next.js). */
export default function NotFound() {
  return (
    <main
      id="contenido"
      className="flex min-h-screen items-center justify-center bg-background px-6 py-12 text-foreground"
    >
      <section className="w-full max-w-md rounded-3xl border border-line bg-surface p-8 text-center shadow-sm">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-decom-blue-soft text-decom-blue-text">
          <Compass className="h-7 w-7" aria-hidden="true" />
        </span>
        <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-decom-teal-text">
          Error 404
        </p>
        <h1 className="mt-2 text-2xl font-semibold">No encontramos esta página</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-fg">
          El enlace puede estar incompleto o la página ya no existe. Vuelve al panel o al inicio
          para continuar.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/dashboard"
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-decom-blue px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-decom-blue-hover"
          >
            Ir al panel
          </Link>
          <Link
            href="/"
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-line bg-surface px-5 py-2.5 text-sm font-semibold text-foreground transition hover:bg-surface-muted"
          >
            Ir al inicio
          </Link>
        </div>
      </section>
    </main>
  );
}
