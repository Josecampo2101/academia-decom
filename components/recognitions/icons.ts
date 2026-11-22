import {
  Award,
  BadgeCheck,
  BookOpen,
  ClipboardCheck,
  Crown,
  Flame,
  GraduationCap,
  Library,
  Medal,
  PenLine,
  Rocket,
  Sparkles,
  Target,
  Trophy,
  Zap,
  type LucideIcon,
} from "lucide-react";

/** Iconos de insignias: el catálogo guarda el nombre y aquí se resuelve el componente de Lucide. */
const BADGE_ICONS: Record<string, LucideIcon> = {
  Award,
  BadgeCheck,
  BookOpen,
  ClipboardCheck,
  Crown,
  Flame,
  GraduationCap,
  Library,
  PenLine,
  Rocket,
  Sparkles,
  Target,
  Trophy,
  Zap,
};

export function badgeIcon(name: string): LucideIcon {
  return BADGE_ICONS[name] ?? Medal;
}
