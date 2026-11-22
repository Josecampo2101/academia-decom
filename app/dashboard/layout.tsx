import { Suspense, type ReactNode } from "react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { DashboardShellFallback } from "@/components/dashboard/DashboardShellFallback";

/**
 * Menú lateral y barra superior comunes a todas las páginas de /dashboard.
 * El Suspense es obligatorio en Next 16: el shell lee la ruta actual (usePathname) para marcar
 * el elemento activo y mostrar el título, y en rutas dinámicas ese dato llega en tiempo de solicitud.
 */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<DashboardShellFallback />}>
      <DashboardShell>{children}</DashboardShell>
    </Suspense>
  );
}
