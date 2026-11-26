/**
 * Bloque de esqueleto para estados de carga. Se dimensiona con clases (h-*, w-*, rounded-*).
 * Es decorativo (aria-hidden); el contenedor que lo usa debe anunciar la carga con role="status".
 */
type SkeletonProps = {
  className?: string;
};

export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-lg bg-surface-muted motion-reduce:animate-none ${className}`}
    />
  );
}
