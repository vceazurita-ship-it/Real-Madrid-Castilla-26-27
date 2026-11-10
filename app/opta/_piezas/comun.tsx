"use client";

/** Las piezas pequeñas que comparten las pestañas del área Opta. */

import type { ReactNode } from "react";

import { formatea, type Unidad } from "@/lib/data-analisis/metricas";
import { AMBITOS, type Ambito } from "@/lib/opta-analisis";

/** Sin dato, nada: ni guion ni «sin dato». */
export const fmt = (v: number | null | undefined, unidad: Unidad): string =>
  v == null || !Number.isFinite(v) ? "" : formatea(v, unidad);

export function Panel({
  titulo,
  subtitulo,
  derecha,
  children,
  className = "",
}: {
  titulo?: ReactNode;
  subtitulo?: ReactNode;
  derecha?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`min-w-0 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5 ${className}`}>
      {/* 10/11/2026: `header` y no `div`, para que el índice fijo de Análisis de datos (IndiceBloques) lo liste. */}
      {(titulo || derecha) && (
        <header className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {titulo && <h2 className="text-base font-semibold text-white">{titulo}</h2>}
            {subtitulo && <p className="mt-0.5 text-xs text-white/55">{subtitulo}</p>}
          </div>
          {derecha && <div className="flex flex-wrap items-center gap-2">{derecha}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export function Elegir<T extends string>({
  valor,
  opciones,
  alCambiar,
  etiqueta,
  className = "",
}: {
  valor: T;
  opciones: { clave: T; nombre: string }[];
  alCambiar: (v: T) => void;
  etiqueta?: string;
  className?: string;
}) {
  return (
    <label className={`inline-flex min-w-0 items-center gap-2 text-xs text-white/55 ${className}`}>
      {etiqueta && <span className="shrink-0">{etiqueta}</span>}
      <select
        value={valor}
        onChange={(e) => alCambiar(e.target.value as T)}
        className="min-w-0 max-w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-white"
      >
        {opciones.map((o) => (
          <option key={o.clave} value={o.clave} className="bg-[#11161C]">
            {o.nombre}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Botones de una sola elección (por partido / total, el ámbito…). */
export function Botonera<T extends string>({
  valor,
  opciones,
  alCambiar,
  etiqueta,
}: {
  valor: T;
  opciones: { clave: T; nombre: string }[];
  alCambiar: (v: T) => void;
  etiqueta: string;
}) {
  return (
    <div className="inline-flex flex-wrap items-center gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-0.5" role="group" aria-label={etiqueta}>
      {opciones.map((o) => (
        <button
          key={o.clave}
          type="button"
          aria-pressed={valor === o.clave}
          onClick={() => alCambiar(o.clave)}
          className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
            valor === o.clave ? "bg-[#C8A96B] text-black" : "text-white/55 hover:text-white"
          }`}
        >
          {o.nombre}
        </button>
      ))}
    </div>
  );
}

export function ElegirAmbito({ valor, alCambiar }: { valor: Ambito; alCambiar: (a: Ambito) => void }) {
  return <Botonera etiqueta="Con quién se compara" valor={valor} opciones={AMBITOS} alCambiar={alCambiar} />;
}

/** Una cifra grande con su rótulo. */
export function Cifra({ rotulo, valor, detalle, color }: { rotulo: string; valor: string; detalle?: string; color?: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">{rotulo}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-white" style={color ? { color } : undefined}>
        {valor}
      </p>
      {detalle && <p className="mt-0.5 text-xs text-white/55">{detalle}</p>}
    </div>
  );
}
