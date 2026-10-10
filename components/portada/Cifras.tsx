"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { chipInk } from "@/lib/theme";
import { trackModuleVisit } from "@/lib/module-usage";

/**
 * LAS CIFRAS DEL EQUIPO, EN UNA SOLA FILA.
 *
 * Antes eran dos secciones de tres tarjetas cada una —seguimiento y modelo de
 * juego— que ocupaban media pantalla para enseñar seis números. Aquí van las
 * seis en un mismo panel, de un vistazo, y las áreas de trabajo quedan a la
 * altura de la vista sin tener que bajar.
 *
 * Cada celda sigue diciendo **a dónde lleva**: el rótulo nombra el dato y el
 * pie, la pantalla. Un número que es un enlace sin decirlo es una trampa.
 */

export type Cifra = {
  href: string;
  label: string;
  value: number;
  caption: string;
  destino: string;
  loading: boolean;
  icon: React.ElementType;
  /** Con color, la celda identifica algo (la fase del juego); sin él va en dorado. */
  color?: string;
  suffix?: string;
};

function Numero({ value, loading }: { value: number; loading: boolean }) {
  if (loading) {
    return (
      <span
        aria-hidden
        className="inline-block h-[0.8em] w-[2.2ch] animate-pulse rounded-md bg-white/10 align-baseline"
      />
    );
  }

  return <span className="tabular-nums">{value.toLocaleString("es-ES")}</span>;
}

export function Cifras({ cifras }: { cifras: Cifra[] }) {
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.06] md:grid-cols-3 xl:grid-cols-6">
      {cifras.map((cifra) => {
        const Icon = cifra.icon;

        const accent = cifra.color ? chipInk(cifra.color) : "#D8B45A";

        return (
          <Link
            key={cifra.href + cifra.label}
            href={cifra.href}
            onClick={() => trackModuleVisit(cifra.href)}
            style={{ ["--accent" as string]: accent }}
            className="group relative flex flex-col justify-between gap-5 bg-[#07121F] p-5 transition-colors duration-300 hover:bg-[#0B1728]"
          >
            <span
              aria-hidden
              className="absolute inset-x-0 top-0 h-[2px] bg-[color:var(--accent)] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            />

            <div className="flex items-start justify-between gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[color:var(--accent)]">
                {cifra.label}
              </p>

              <Icon className="h-4 w-4 shrink-0 text-white/30 transition-colors group-hover:text-[color:var(--accent)]" />
            </div>

            <div>
              <p className="text-[32px] font-bold leading-none tracking-tight text-white">
                <Numero value={cifra.value} loading={cifra.loading} />

                {cifra.suffix && (
                  <span className="ml-0.5 text-base font-semibold text-white/40">
                    {cifra.suffix}
                  </span>
                )}
              </p>

              <p className="mt-2 text-[12px] leading-snug text-white/50">{cifra.caption}</p>

              <p className="mt-3 flex items-center gap-1 text-[11px] font-medium text-white/40 transition-colors duration-300 group-hover:text-[color:var(--accent)]">
                {cifra.destino}
                <ChevronRight className="h-3 w-3 transition-transform duration-300 group-hover:translate-x-0.5" />
              </p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

export default Cifras;
