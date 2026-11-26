/**
 * Indicador de carga único de la aplicación.
 * - role="status" + texto oculto para lectores de pantalla.
 * - Con "reducir movimiento" el giro se ralentiza en lugar de desaparecer.
 */
type SpinnerProps = {
  /** Texto que anuncian los lectores de pantalla. */
  label?: string;
  className?: string;
};

export function Spinner({ label = "Cargando", className = "" }: SpinnerProps) {
  return (
    <div role="status" aria-live="polite" className={`inline-flex items-center ${className}`}>
      <span
        aria-hidden="true"
        className="block h-10 w-10 animate-spin rounded-full border-4 border-decom-blue/20 border-t-decom-blue motion-reduce:[animation-duration:2.5s]"
      />
      <span className="sr-only">{label}</span>
    </div>
  );
}
