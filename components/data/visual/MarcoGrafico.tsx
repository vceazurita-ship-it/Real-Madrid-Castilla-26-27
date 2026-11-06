"use client";

/*
| MARCO DE UN GRÁFICO (06/11/2026)
|
| Dos iconos en la esquina de cada gráfico, como en las herramientas
| profesionales:
| - «Ver como»: el mismo dato en otra visualización (mapa, ranking, barras…).
|   Se recuerda por gráfico en este aparato.
| - «Ponderar» (sólo si el gráfico combina varios datos): un pop-up con el peso
|   de cada ítem, «Por defecto» y «Guardar». Lo guardado se recuerda en este
|   aparato y el gráfico lo dice («ponderación propia»).
*/

import { useEffect, useState, type ReactNode } from "react";
import { LayoutGrid, RotateCcw, Save, SlidersHorizontal, X } from "lucide-react";

const lee = <T,>(clave: string, defecto: T): T => {
  try {
    const v = localStorage.getItem(clave);
    return v ? (JSON.parse(v) as T) : defecto;
  } catch {
    return defecto;
  }
};
const guarda = (clave: string, v: unknown) => {
  try {
    if (v === null) localStorage.removeItem(clave);
    else localStorage.setItem(clave, JSON.stringify(v));
  } catch {
    /* sin almacenamiento: vale para esta visita */
  }
};

/** El tipo de visualización elegido para un gráfico, recordado en el aparato. */
export function useTipoGrafico<T extends string>(id: string, defecto: T, validos: readonly T[]) {
  const [tipo, setTipo] = useState<T>(defecto);
  useEffect(() => {
    const v = lee<T>(`rmcf:grafico:${id}`, defecto);
    if (validos.includes(v)) setTipo(v);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sólo al montar
  }, [id]);
  return [tipo, (t: T) => { setTipo(t); guarda(`rmcf:grafico:${id}`, t); }] as const;
}

/** Pesos guardados de un gráfico (1 = por defecto). */
export function usePesos(id: string) {
  const [pesos, setPesos] = useState<Record<string, number>>({});
  useEffect(() => {
    setPesos(lee<Record<string, number>>(`rmcf:pesos:${id}`, {}));
  }, [id]);
  return [pesos, (p: Record<string, number> | null) => { setPesos(p ?? {}); guarda(`rmcf:pesos:${id}`, p && Object.keys(p).length ? p : null); }] as const;
}

export type ItemPeso = { clave: string; nombre: string; grupo?: string };

export function MarcoGrafico({
  tipos,
  tipo,
  onTipo,
  items,
  pesos,
  onPesos,
  children,
}: {
  tipos?: { clave: string; nombre: string }[];
  tipo?: string;
  onTipo?: (t: string) => void;
  /** Lo que se puede ponderar; sin esto no sale el icono. */
  items?: ItemPeso[];
  pesos?: Record<string, number>;
  onPesos?: (p: Record<string, number> | null) => void;
  children: ReactNode;
}) {
  const [abierto, setAbierto] = useState(false);
  const [borrador, setBorrador] = useState<Record<string, number>>({});
  const propia = Boolean(pesos && Object.values(pesos).some((v) => v !== 1));

  const abre = () => {
    setBorrador({ ...(pesos ?? {}) });
    setAbierto(true);
  };

  const grupos = [...new Set((items ?? []).map((i) => i.grupo ?? ""))];

  return (
    <div className="relative">
      <div className="mb-2 flex flex-wrap items-center justify-end gap-1.5">
        {propia && <span className="mr-auto rounded-full bg-[#D8B45A]/15 px-2 py-0.5 text-[11px] font-semibold text-[#D8B45A]">Ponderación propia</span>}
        {tipos && tipos.length > 1 && (
          <label className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[12px] text-white/75" title="Ver el mismo dato en otra visualización">
            <LayoutGrid size={13} aria-hidden />
            <span className="sr-only">Ver como</span>
            <select value={tipo} onChange={(e) => onTipo?.(e.target.value)} className="bg-transparent text-[12px] font-semibold text-white/85 outline-none">
              {tipos.map((t) => (
                <option key={t.clave} value={t.clave} className="bg-[#11161C]">{t.nombre}</option>
              ))}
            </select>
          </label>
        )}
        {items && items.length > 1 && onPesos && (
          <button type="button" onClick={abre} className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[12px] font-semibold text-white/80 hover:border-[#D8B45A]/50" title="Elegir cuánto pesa cada dato en el cálculo">
            <SlidersHorizontal size={13} aria-hidden /> Ponderar
          </button>
        )}
      </div>

      {children}

      {abierto && items && (
        <div className="modal-veil fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="Ponderación" onClick={() => setAbierto(false)}>
          <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/10 bg-[#0B0F14] p-4 text-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-1 flex items-center justify-between">
              <h3 className="text-base font-bold">Ponderación</h3>
              <button type="button" onClick={() => setAbierto(false)} aria-label="Cerrar" className="rounded-lg p-1 text-white/60 hover:text-white"><X size={16} /></button>
            </div>
            <p className="mb-3 text-[12px] text-white/60">Cuánto pesa cada dato en el cálculo: 0 lo quita, 1 es lo normal, 3 lo triplica. Se guarda en este aparato.</p>
            {grupos.map((g) => (
              <div key={g} className="mb-3">
                {g && <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#D8B45A]">{g}</p>}
                {items.filter((i) => (i.grupo ?? "") === g).map((i) => {
                  const v = borrador[i.clave] ?? 1;
                  return (
                    <label key={i.clave} className="mb-1.5 flex items-center gap-2 text-[13px]">
                      <span className="w-36 shrink-0 truncate text-white/80">{i.nombre}</span>
                      <input type="range" min={0} max={3} step={0.5} value={v} onChange={(e) => setBorrador((b) => ({ ...b, [i.clave]: Number(e.target.value) }))} className="flex-1 accent-[#D8B45A]" />
                      <span className="w-8 text-right tabular-nums text-white/85">{String(v).replace(".", ",")}</span>
                    </label>
                  );
                })}
              </div>
            ))}
            <div className="mt-2 flex flex-wrap justify-end gap-2">
              <button type="button" onClick={() => { onPesos?.(null); setAbierto(false); }} className="inline-flex items-center gap-1 rounded-lg border border-white/15 px-3 py-1.5 text-[13px] text-white/80"><RotateCcw size={13} /> Por defecto</button>
              <button type="button" onClick={() => { const limpio = Object.fromEntries(Object.entries(borrador).filter(([, v]) => v !== 1)); onPesos?.(limpio); setAbierto(false); }} className="inline-flex items-center gap-1 rounded-lg bg-[#D8B45A] px-3 py-1.5 text-[13px] font-semibold text-[#0B0F14]"><Save size={13} /> Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
