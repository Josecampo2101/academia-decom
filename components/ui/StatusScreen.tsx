import type { ReactNode } from "react";

/**
 * Pantalla completa para estados bloqueantes (acceso restringido, error de validación, etc.).
 * Reemplaza el bloque que estaba copiado en las páginas de estudiante y tutor.
 */
type StatusScreenProps = {
  title: ReactNode;
  message: ReactNode;
  /** Texto del botón de salida (por ejemplo, "Volver al panel"). */
  actionLabel: string;
  onAction: () => void;
};

export function StatusScreen({ title, message, actionLabel, onAction }: StatusScreenProps) {
  return (
    <main
      id="contenido"
      className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground"
    >
      <section
        role="alert"
        className="max-w-md rounded-3xl border border-line bg-surface p-8 text-center"
      >
        <h1 className="text-xl font-bold">{title}</h1>
        <p className="mt-2 text-sm text-muted-fg">{message}</p>
        <button
          type="button"
          onClick={onAction}
          className="mt-5 min-h-11 rounded-xl bg-decom-blue px-5 py-3 text-sm font-semibold text-white transition hover:bg-decom-blue-hover"
        >
          {actionLabel}
        </button>
      </section>
    </main>
  );
}
