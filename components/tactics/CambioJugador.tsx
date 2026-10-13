"use client";

/*
|--------------------------------------------------------------------------
| CAMBIAR UNA FICHA POR OTRO JUGADOR DE SU EQUIPO (13/10/2026)
|--------------------------------------------------------------------------
|
| Al pinchar (sin arrastrar) una ficha de la pizarra se abre esto: la lista
| de su equipo —nuestra plantilla o la del rival— para cambiarla, o «Dejar
| como está». Si el elegido ya está en el campo, se intercambian los sitios.
| Va dentro del tablero (no en un portal) para que se vea también a pantalla
| completa.
*/

import Image from "next/image";
import { Repeat2, Search, X } from "lucide-react";
import { useMemo, useState } from "react";

export type OpcionCambio = { id: string; nombre: string; dorsal?: string; posicion?: string; foto?: string; enCampo: boolean };

const sinTildes = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function CambioJugador({
  titulo,
  equipo,
  opciones,
  onElige,
  onCierra,
}: {
  titulo: string;
  equipo: string;
  opciones: OpcionCambio[];
  onElige: (id: string) => void;
  onCierra: () => void;
}) {
  const [busca, setBusca] = useState("");

  const visibles = useMemo(() => {
    const b = sinTildes(busca.trim());

    return b ? opciones.filter((o) => sinTildes(`${o.nombre} ${o.posicion ?? ""} ${o.dorsal ?? ""}`).includes(b)) : opciones;
  }, [busca, opciones]);

  return (
    <div className="modal-veil fixed inset-0 z-[70] flex items-end justify-center backdrop-blur-sm sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={titulo} onPointerDown={(e) => e.target === e.currentTarget && onCierra()}>
      <div className="flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border border-white/10 bg-[#11161C] shadow-2xl sm:rounded-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-white">{titulo}</h2>
            <p className="mt-0.5 text-[11px] text-white/45">{equipo} · elige quién entra o déjalo como está</p>
          </div>
          <button type="button" onClick={onCierra} aria-label="Cerrar" className="rounded-lg p-1.5 text-white/45 hover:bg-white/[0.06] hover:text-white">
            <X size={16} />
          </button>
        </header>

        <div className="border-b border-white/10 px-4 py-2.5">
          <label className="relative block">
            <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-white/35" aria-hidden />
            <input autoFocus value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar nombre, puesto o dorsal" className="w-full rounded-lg border border-white/10 bg-white/[0.04] py-1.5 pl-8 pr-2 text-sm text-white outline-none focus:border-[#C8A96B]/50" />
          </label>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {visibles.map((o) => (
            <button key={o.id} type="button" onClick={() => onElige(o.id)} className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm transition hover:bg-white/[0.06]">
              <span className="w-6 text-right text-xs font-semibold tabular-nums text-[#C8A96B]">{o.dorsal || ""}</span>
              <span className="relative h-7 w-7 shrink-0 overflow-hidden rounded-full bg-white/10">
                {o.foto ? <Image src={o.foto} alt="" fill sizes="28px" className="object-cover" unoptimized /> : null}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-white/90">{o.nombre}</span>
                {o.posicion ? <span className="block truncate text-[10px] text-white/40">{o.posicion}</span> : null}
              </span>
              {o.enCampo ? (
                <span className="inline-flex items-center gap-1 rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-white/60" title="Ya está en el campo: se intercambian los sitios">
                  <Repeat2 size={11} aria-hidden /> en el campo
                </span>
              ) : null}
            </button>
          ))}
          {!visibles.length ? <p className="py-6 text-center text-xs text-white/40">Nadie con ese nombre.</p> : null}
        </div>

        <footer className="flex justify-end border-t border-white/10 px-4 py-2.5">
          <button type="button" onClick={onCierra} className="rounded-xl border border-white/15 px-4 py-1.5 text-sm text-white/75 hover:border-white/35 hover:text-white">
            Dejar como está
          </button>
        </footer>
      </div>
    </div>
  );
}
