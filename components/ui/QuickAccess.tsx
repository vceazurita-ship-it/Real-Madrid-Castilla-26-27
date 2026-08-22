"use client";

import { useMemo } from "react";
import Link from "next/link";

import { trackModuleVisit, useModuleUsage } from "@/lib/module-usage";
import { AREA_BY_KEY, MODULES } from "@/lib/modules";

/**
 * Fila de accesos directos.
 *
 * Arranca con los atajos que el staff ya tenía a mano en la portada y, según
 * se va usando la plataforma en ese dispositivo, se reordena sola: lo que más
 * se abre acaba delante sin que nadie tenga que configurar nada.
 */

const SLOTS = 8;

/* Punto de partida en un dispositivo nuevo, sin historial todavía. */
const SEED = [
  "/micro_calendar",
  "/calendar_performance",
  "/match-preparation",
  "/individual",
  "/setpieces",
  "/setpieces_def",
  "/throw-ins",
  "/throw-ins-def",
];

const MODULE_BY_HREF = new Map(MODULES.map((module) => [module.href, module]));

export default function QuickAccess() {
  const usage = useModuleUsage();

  const shortcuts = useMemo(() => {
    const visited = MODULES.filter((module) => (usage[module.href] ?? 0) > 0).sort(
      (a, b) => (usage[b.href] ?? 0) - (usage[a.href] ?? 0)
    );

    const chosen = [...visited];

    /* Los huecos que deje el historial los completan los atajos de siempre. */
    SEED.forEach((href) => {
      if (chosen.length >= SLOTS) return;

      const seeded = MODULE_BY_HREF.get(href);

      if (seeded && !chosen.some((item) => item.href === href)) {
        chosen.push(seeded);
      }
    });

    return chosen.slice(0, SLOTS);
  }, [usage]);

  return (
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-none">
      {shortcuts.map((module) => {
        const area = AREA_BY_KEY.get(module.area)!;
        const Icon = module.icon;

        return (
          <Link
            key={module.href}
            href={module.href}
            onClick={() => trackModuleVisit(module.href)}
            style={{ ["--accent" as string]: area.color }}
            className="group inline-flex shrink-0 items-center gap-2.5 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-[13px] text-white/80 transition-all duration-300 hover:-translate-y-0.5 hover:border-[color:var(--accent)]/45 hover:bg-white/[0.06] hover:text-white"
          >
            <Icon className="h-[17px] w-[17px] shrink-0 text-[color:var(--accent)]" />
            {module.title}
          </Link>
        );
      })}
    </div>
  );
}
