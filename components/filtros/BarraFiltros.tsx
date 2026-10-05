"use client";

/**
 * LA BARRA DE FILTROS, IGUAL EN TODAS LAS PANTALLAS DE ANÁLISIS (05/10/2026).
 *
 * Balón parado (ofensivo y defensivo), saques de banda, faltas y robos tenían
 * cada una su barra: una se pegaba arriba y otra no, una contaba «28 de 108» y
 * otra no, la pretemporada se decía de tres maneras y lo elegido se apagaba al
 * 25, al 30 o al 40 %. Se usaba distinto en cada sitio. Ésta es la única:
 *
 *   - Va pegada bajo la cabecera y siempre a la vista: sin filtros recuerda que
 *     todo se pincha; con filtros, cada uno es una pastilla «Rótulo: valor ✕».
 *   - La pretemporada es siempre la misma pastilla: «Sólo liga · incluir
 *     pretemporada» (fuera, que es lo de partida) o «Con pretemporada ✕».
 *   - A la derecha, cuántas acciones quedan de cuántas y «Quitar filtros».
 *
 * Y `ESTILO_ELEGIDO` es cómo se marca lo elegido en cualquier gráfico: el oro
 * en lo elegido y lo demás a un 30 %, en todas.
 */

import type { ReactNode } from "react";
import { X } from "lucide-react";

export const ORO_FILTRO = "#C8A96B";

/** Cómo se marca lo elegido en un gráfico, igual en todas las pantallas. */
export const ESTILO_ELEGIDO = {
  /** Lo que no está elegido, cuando hay algo elegido en ese gráfico. */
  apagado: 0.3,
  /** El contorno de oro de lo elegido. */
  grosor: 2,
} as const;

export type PastillaFiltro = {
  clave: string;
  /** «Zona», «Sacador»… */
  rotulo: string;
  /** Lo que se lee: «campo rival». */
  valor: string;
  onQuitar: () => void;
};

/** La pastilla de la pretemporada: la misma en todas las pantallas. */
export function PastillaPretemporada({
  incluida,
  onCambiar,
  rotuloSolo = "Sólo liga",
}: {
  incluida: boolean;
  onCambiar: (incluir: boolean) => void;
  /** «Sólo liga» o «Liga y copa», según lo que haya. */
  rotuloSolo?: string;
}) {
  return incluida ? (
    <button
      type="button"
      onClick={() => onCambiar(false)}
      title="Volver a dejar fuera la pretemporada"
      className="inline-flex max-w-full items-center gap-1 rounded-full border border-[#C8A96B]/40 bg-[#C8A96B]/10 px-2.5 py-1 text-[#E7D2A0] transition hover:bg-[#C8A96B]/20"
    >
      Con pretemporada <X size={11} aria-hidden className="shrink-0 opacity-70" />
    </button>
  ) : (
    <button
      type="button"
      onClick={() => onCambiar(true)}
      title="La pretemporada está fuera de todos los datos. Pulsa para incluirla."
      className="inline-flex max-w-full items-center gap-1 rounded-full border border-dashed border-white/15 bg-white/[0.03] px-2.5 py-1 text-white/65 transition hover:border-[#C8A96B]/40 hover:text-white"
    >
      {rotuloSolo} · <span className="text-[#E7D2A0]">incluir pretemporada</span>
    </button>
  );
}

export function BarraFiltros({
  pastillas,
  onQuitarTodo,
  previo,
  cuenta,
  pie,
  className = "",
}: {
  pastillas: PastillaFiltro[];
  onQuitarTodo: () => void;
  /** Lo que va delante de los filtros: la pastilla de la pretemporada. */
  previo?: ReactNode;
  /** «28 de 108 saques». */
  cuenta?: { vistas: number; total: number; unidad?: string };
  /** Lo que va debajo de la barra (p. ej. «No hay acciones de liga…»). */
  pie?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`sticky top-[80px] z-20 md:top-[96px] ${className}`}>
      <div
        role="status"
        aria-label="Filtros activos"
        className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-[#C8A96B]/25 bg-[#0B0F14]/90 px-3 py-2 pr-16 text-xs backdrop-blur-xl"
      >
        <span className="mr-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#C8A96B]">Filtrando</span>

        {previo}

        {pastillas.map((p) => (
          <button
            key={p.clave}
            type="button"
            onClick={p.onQuitar}
            title="Quitar este filtro"
            className="inline-flex max-w-full items-center gap-1 rounded-full border border-[#C8A96B]/40 bg-[#C8A96B]/10 px-2.5 py-1 text-[#E7D2A0] transition hover:bg-[#C8A96B]/20"
          >
            <span className="truncate">
              <span className="text-white/50">{p.rotulo}:</span> {p.valor}
            </span>
            <X size={11} aria-hidden className="shrink-0 opacity-70" />
          </button>
        ))}

        {pastillas.length === 0 && <span className="text-white/40">nada más · pulsa cualquier barra, zona, sector o fila para filtrar</span>}

        <span className="ml-auto flex items-center gap-2">
          {cuenta && (
            <span className="tabular-nums text-white/45">
              {cuenta.vistas} de {cuenta.total}
              {cuenta.unidad ? ` ${cuenta.unidad}` : ""}
            </span>
          )}
          {pastillas.length > 0 && (
            <button
              type="button"
              onClick={onQuitarTodo}
              className="rounded-full border border-white/10 px-2.5 py-1 text-white/70 transition hover:border-white/25 hover:text-white"
            >
              Quitar filtros
            </button>
          )}
        </span>
      </div>

      {pie}
    </div>
  );
}
