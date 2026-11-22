import { Lock, type LucideIcon } from "lucide-react";

type Tier = "bronze" | "silver" | "gold";

type BadgeEmblemProps = {
  icon: LucideIcon;
  tier: Tier;
  earned: boolean;
  /** Tamaño en píxeles (por defecto 64). */
  size?: number;
};

// Los colores salen de los tokens de globals.css y se adaptan al modo claro y oscuro.
const TIER_COLORS: Record<Tier, { color: string; soft: string }> = {
  bronze: { color: "var(--tier-bronze)", soft: "var(--tier-bronze-soft)" },
  silver: { color: "var(--tier-silver)", soft: "var(--tier-silver-soft)" },
  gold: { color: "var(--tier-gold)", soft: "var(--tier-gold-soft)" },
};

/**
 * Emblema hexagonal de una insignia. Obtenida: color del nivel; bloqueada: contorno punteado y candado.
 * Es decorativo (aria-hidden); el nombre y el estado se anuncian en el texto de la tarjeta.
 */
export function BadgeEmblem({ icon: Icon, tier, earned, size = 64 }: BadgeEmblemProps) {
  const { color, soft } = TIER_COLORS[tier];

  return (
    <span
      aria-hidden="true"
      className="relative inline-flex shrink-0"
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 64 64" width={size} height={size}>
        <polygon
          points="32,3 57,17.5 57,46.5 32,61 7,46.5 7,17.5"
          fill={earned ? soft : "var(--surface-muted)"}
          stroke={earned ? color : "var(--border)"}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeDasharray={earned ? undefined : "4 3"}
        />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center"
        style={{ color: earned ? color : "var(--muted)" }}
      >
        <Icon size={Math.round(size * 0.4)} strokeWidth={1.75} />
      </span>
      {earned ? null : (
        <span className="absolute -right-0.5 -bottom-0.5 flex h-5 w-5 items-center justify-center rounded-full border border-line bg-surface text-muted-fg">
          <Lock size={11} strokeWidth={2} />
        </span>
      )}
    </span>
  );
}
