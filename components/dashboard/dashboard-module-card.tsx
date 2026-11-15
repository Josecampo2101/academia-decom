import type { LucideIcon } from "lucide-react";

type DashboardModuleCardProps = {
  title: string;
  description: string;
  icon: LucideIcon;
  color: string;
  enabled: boolean;
  mutedTextClass: string;
  surfaceClass: string;
  borderClass: string;
  onOpen: () => void;
};

export function DashboardModuleCard({
  title,
  description,
  icon: Icon,
  color,
  enabled,
  mutedTextClass,
  surfaceClass,
  borderClass,
  onOpen,
}: DashboardModuleCardProps) {
  return (
    <article
      className={`${surfaceClass} rounded-2xl border ${borderClass} p-6 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-md motion-reduce:transform-none`}
    >
      <div
        className="flex h-12 w-12 items-center justify-center rounded-xl"
        style={{ backgroundColor: `${color}18`, color }}
      >
        <Icon className="h-6 w-6" aria-hidden="true" />
      </div>

      <h4 className="mt-5 font-bold">{title}</h4>
      <p className={`mt-2 min-h-10 text-sm leading-6 ${mutedTextClass}`}>
        {description}
      </p>

      <div className="mt-5 flex min-h-11 items-center">
        {enabled ? (
          <button
            type="button"
            onClick={onOpen}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#087DB5] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#066895] focus-visible:outline-offset-4"
          >
            Abrir módulo
            <span aria-hidden="true">→</span>
          </button>
        ) : (
          <p className={`text-xs font-medium ${mutedTextClass}`}>
            No habilitado para tu perfil
          </p>
        )}
      </div>
    </article>
  );
}
