import { Skeleton } from "@/components/ui/Skeleton";

/** Esqueleto del contenido de cualquier ruta dentro de /dashboard (el menú y la barra superior ya están presentes). */
export default function DashboardLoading() {
  return (
    <div aria-busy="true" className="mx-auto max-w-7xl space-y-6 p-5 md:p-8">
      <div role="status">
        <span className="sr-only">Cargando contenido</span>
      </div>
      <Skeleton className="h-8 w-64" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((item) => (
          <Skeleton key={item} className="h-36 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
