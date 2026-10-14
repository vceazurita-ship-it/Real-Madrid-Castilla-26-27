"use client";

/*
|--------------------------------------------------------------------------
| LAS CUATRO PANTALLAS DEL ANÁLISIS DEL PARTIDO, UNIDAS (14/10/2026)
|--------------------------------------------------------------------------
|
| Robos, pérdidas, faltas y goles se miran juntos después de cada partido,
| pero vivían como cuatro pantallas sueltas del menú, cada una con su
| cabecera. Esta barra va debajo del título de las cuatro y deja saltar de
| una a otra sin volver al menú; la que se está viendo, marcada.
*/

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleSlash, Crosshair, Goal, Magnet } from "lucide-react";

export const PANTALLAS_PARTIDO = [
  { href: "/laboratorio/transiciones", label: "Robos", icono: Magnet },
  { href: "/laboratorio/perdidas", label: "Pérdidas", icono: CircleSlash },
  { href: "/laboratorio/faltas", label: "Faltas", icono: Crosshair },
  { href: "/analisis-goles", label: "Goles", icono: Goal },
] as const;

export function NavAnalisisPartido({ className = "" }: { className?: string }) {
  const ruta = usePathname();

  return (
    <nav aria-label="Análisis del partido" className={`min-w-0 overflow-x-auto scrollbar-none ${className}`}>
      <div className="inline-flex min-w-0 gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
        {PANTALLAS_PARTIDO.map(({ href, label, icono: Icono }) => {
          const activa = ruta === href;

          return (
            <Link
              key={href}
              href={href}
              aria-current={activa ? "page" : undefined}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                activa ? "bg-[#C8A96B] text-black" : "text-white/60 hover:bg-white/[0.06] hover:text-white"
              }`}
            >
              <Icono size={13} aria-hidden />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
