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
|
| Desde el 01/11/2026 la lista de los nuestros va por grupos: primero los de
| su puesto, luego los que ya están en el campo (se cambian el sitio), el
| resto y, al final y apagados, los que no pueden jugar con el porqué. Con el
| buscador vacío, Intro elige al primero de la lista.
*/

import Image from "next/image";
import { Repeat2, Search, X } from "lucide-react";
import { useMemo, useState } from "react";

export type OpcionCambio = {
  id: string;
  nombre: string;
  dorsal?: string;
  posicion?: string;
  foto?: string;
  enCampo: boolean;
  /** El rótulo del grupo en el que va («De su puesto»…); sin él, una lista corrida. */
  grupo?: string;
  /** «Lesionado», «Tocado»: se enseña a la derecha. */
  nota?: string;
  /** No puede jugar: se ve apagado (se puede elegir igual). */
  apagado?: boolean;
};

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
    <div className="modal-veil fixed inset-0 z-[70] flex items-end justify-center backdrop-blur-sm sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={titulo} onPointerDown={(e) => e.target === e.currentTarget && onCierra()} onKeyDown={(e) => e.key === "Escape" && onCierra()}>
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
            <input
              autoFocus
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && visibles[0]) onElige(visibles[0].id);
              }}
              placeholder="Buscar nombre, puesto o dorsal"
              className="w-full rounded-lg border border-white/10 bg-white/[0.04] py-2 pl-8 pr-2 text-sm text-white outline-none focus:border-[#C8A96B]/50"
            />
          </label>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {visibles.map((o, i) => (
            <div key={o.id}>
              {o.grupo && o.grupo !== visibles[i - 1]?.grupo ? (
                <p className="px-2 pb-1 pt-2.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#C8A96B]">{o.grupo}</p>
              ) : null}
              <button
                type="button"
                onClick={() => onElige(o.id)}
                className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm transition hover:bg-white/[0.06] ${o.apagado ? "opacity-55" : ""}`}
              >
                <span className="w-6 text-right text-xs font-semibold tabular-nums text-[#C8A96B]">{o.dorsal || ""}</span>
                <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-white/10">
                  {o.foto ? <Image src={o.foto} alt="" fill sizes="32px" className="object-cover" unoptimized /> : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-white/90">{o.nombre}</span>
                  {o.posicion ? <span className="block truncate text-[10px] text-white/40">{o.posicion}</span> : null}
                </span>
                {o.nota ? <span className="shrink-0 rounded bg-amber-400/[0.12] px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">{o.nota}</span> : null}
                {o.enCampo ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-white/60" title="Ya está en el campo: se intercambian los sitios">
                    <Repeat2 size={11} aria-hidden /> en el campo
                  </span>
                ) : null}
              </button>
            </div>
          ))}
          {/* Sin plantilla no es «nadie con ese nombre» (19/10/2026): una ficha rival suelta, sin equipo en el campo, abría la lista vacía con ese texto. */}
          {!visibles.length ? (
            <p className="px-4 py-6 text-center text-xs leading-relaxed text-white/40">
              {opciones.length === 0
                ? "No hay plantilla de este equipo cargada. Elige el rival en «Rivales», encima del campo, y pon sus dorsales desde ahí."
                : "Nadie con ese nombre."}
            </p>
          ) : null}
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
