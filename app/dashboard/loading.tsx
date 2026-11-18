import { Skeleton } from "@/components/ui/Skeleton";

/** Esqueleto mostrado mientras carga cualquier ruta dentro de /dashboard. */
export default function DashboardLoading() {
  return (
    <main id="contenido" aria-busy="true" className="min-h-screen bg-background">
      <div role="status">
        <span className="sr-only">Cargando contenido</span>
      </div>
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-5 py-4">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <Skeleton className="h-5 w-48" />
        </div>
      </header>
      <div className="mx-auto max-w-6xl space-y-6 px-5 py-8">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((item) => (
            <Skeleton key={item} className="h-36 rounded-2xl" />
          ))}
        </div>
      </div>
    </main>
  );
}
