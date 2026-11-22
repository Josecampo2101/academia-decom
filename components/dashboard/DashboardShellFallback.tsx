import { Skeleton } from "@/components/ui/Skeleton";

/** Contorno del menú y la barra superior mientras el panel resuelve la ruta actual. */
export function DashboardShellFallback() {
  return (
    <div aria-busy="true" className="flex min-h-dvh bg-background">
      <div role="status">
        <span className="sr-only">Cargando el panel</span>
      </div>
      <aside className="hidden w-72 shrink-0 space-y-3 border-r border-line bg-surface p-4 lg:block">
        <Skeleton className="h-11 w-full rounded-xl" />
        <div className="space-y-2 pt-4">
          {[0, 1, 2, 3, 4, 5].map((item) => (
            <Skeleton key={item} className="h-10 w-full rounded-xl" />
          ))}
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="h-16 border-b border-line bg-surface" />
        <div className="space-y-4 p-5 md:p-8">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
