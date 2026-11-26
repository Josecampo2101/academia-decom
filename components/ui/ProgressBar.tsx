type ProgressBarProps = {
  /** Valor de 0 a 100. */
  percent: number;
  /** Texto que anuncian los lectores de pantalla. */
  label: string;
  tone?: "blue" | "teal";
  className?: string;
};

/** Barra de progreso accesible, con los colores de marca. */
export function ProgressBar({ percent, label, tone = "blue", className = "" }: ProgressBarProps) {
  const value = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      className={`h-1.5 w-full overflow-hidden rounded-full bg-surface-muted ${className}`}
    >
      <div
        className={`h-full rounded-full ${tone === "teal" ? "bg-decom-teal" : "bg-decom-blue"}`}
        style={{ width: `${value}%` }}
      />
    </div>
  );
}
