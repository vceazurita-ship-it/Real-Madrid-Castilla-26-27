"use client";

import Link from "next/link";

import { trackModuleVisit, useModulosMasUsados } from "@/lib/module-usage";
import { AREA_BY_KEY } from "@/lib/modules";

/**
 * Fila de accesos directos.
 *
 * Se reordena sola: lo que más se abre en este dispositivo acaba delante sin
 * que nadie configure nada. El orden lo calcula `useModulosMasUsados`, que es
 * el mismo que colocan los tres enlaces grandes de arriba —la tarjeta de la
 * foto y los dos botones—, para que la portada entera hable del mismo uso.
 */

const HUECOS = 8;

export default function QuickAccess() {
  const shortcuts = useModulosMasUsados(HUECOS);

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
