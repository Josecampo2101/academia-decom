import Link from "next/link";
import { Compass } from "lucide-react";

/** 404 dentro del panel: el menú lateral y la barra superior permanecen visibles. */
export default function DashboardNotFound() {
  return (
    <main id="contenido" className="flex items-center justify-center px-6 py-16">
      <section className="w-full max-w-md rounded-3xl border border-line bg-surface p-8 text-center shadow-sm">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-decom-blue-soft text-decom-blue-text">
          <Compass className="h-7 w-7" aria-hidden="true" />
        </span>
        <p className="mt-5 text-xs font-bold tracking-[0.18em] text-decom-teal-text uppercase">
          Error 404
        </p>
        <h1 className="mt-2 text-xl font-semibold">No encontramos esta página</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-fg">
          El enlace puede estar incompleto o la página ya no existe. Elige una opción del menú o
          vuelve al panel.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-decom-blue px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-decom-blue-hover"
        >
          Ir al panel
        </Link>
      </section>
    </main>
  );
}
