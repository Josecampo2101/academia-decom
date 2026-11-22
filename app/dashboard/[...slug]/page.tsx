import { notFound } from "next/navigation";

/**
 * Captura cualquier ruta inexistente bajo /dashboard para mostrar el 404 con el menú lateral
 * (el 404 raíz no incluye el layout del panel).
 */
export default function DashboardUnknownRoute() {
  notFound();
}
