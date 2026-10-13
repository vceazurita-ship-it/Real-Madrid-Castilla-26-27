"use client";

/*
|--------------------------------------------------------------------------
| ELEGIR UNO O VARIOS JUGADORES
|--------------------------------------------------------------------------
|
| Para el seguimiento grupal (13/10/2026): se marcan varios y el mismo
| registro se escribe en cada uno. Buscador, «todos / ninguno» y fichas con
| foto. `bloqueados` son los que van siempre (el jugador de la ficha).
*/

import Image from "next/image";
import { Check, Search } from "lucide-react";
import { useMemo, useState } from "react";

export type JugadorElegible = { id: string; nombre: string; foto?: string; posicion?: string };

const sinTildes = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function SeleccionJugadores({
  jugadores,
  seleccion,
  onCambia,
  bloqueados = [],
  alto = "max-h-[260px]",
}: {
  jugadores: JugadorElegible[];
  seleccion: string[];
  onCambia: (ids: string[]) => void;
  /** Los que ya van (p. ej. el jugador de la ficha): salen marcados y no se pueden quitar. */
  bloqueados?: string[];
  alto?: string;
}) {
  const [busca, setBusca] = useState("");

  const visibles = useMemo(() => {
    const b = sinTildes(busca.trim());

    return b ? jugadores.filter((j) => sinTildes(`${j.nombre} ${j.posicion ?? ""}`).includes(b)) : jugadores;
  }, [busca, jugadores]);

  const marcados = new Set([...seleccion, ...bloqueados]);

  const alterna = (id: string) => {
    if (bloqueados.includes(id)) return;

    onCambia(seleccion.includes(id) ? seleccion.filter((x) => x !== id) : [...seleccion, id]);
  };

  const marcaVisibles = () => onCambia([...new Set([...seleccion, ...visibles.map((j) => j.id)])].filter((id) => !bloqueados.includes(id)));

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-[160px] flex-1">
          <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-white/35" aria-hidden />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar jugador o puesto"
            className="w-full rounded-lg border border-white/10 bg-white/[0.04] py-1.5 pl-8 pr-2 text-sm text-white outline-none focus:border-[#C8A96B]/50"
          />
        </label>
        <button type="button" onClick={marcaVisibles} className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-white/65 hover:border-white/30 hover:text-white">
          Marcar {busca ? "los visibles" : "todos"}
        </button>
        <button type="button" onClick={() => onCambia([])} className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-white/65 hover:border-white/30 hover:text-white">
          Ninguno
        </button>
        <span className="text-xs text-[#C8A96B]">
          {marcados.size} marcado{marcados.size === 1 ? "" : "s"}
        </span>
      </div>

      <div className={`mt-2 grid grid-cols-2 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-3 lg:grid-cols-4 ${alto}`}>
        {visibles.map((j) => {
          const on = marcados.has(j.id);
          const fijo = bloqueados.includes(j.id);

          return (
            <button
              key={j.id}
              type="button"
              onClick={() => alterna(j.id)}
              aria-pressed={on}
              title={fijo ? "Va siempre: es el jugador de la ficha" : undefined}
              className={`flex min-w-0 items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-xs transition ${
                on ? "border-[#C8A96B]/60 bg-[#C8A96B]/15 text-white" : "border-white/[0.08] text-white/65 hover:border-white/25"
              }`}
            >
              <span className="relative h-7 w-7 shrink-0 overflow-hidden rounded-full bg-white/10">
                {j.foto ? <Image src={j.foto} alt="" fill sizes="28px" className="object-cover" unoptimized /> : null}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{j.nombre}</span>
                {j.posicion ? <span className="block truncate text-[10px] text-white/40">{j.posicion}</span> : null}
              </span>
              {on ? <Check size={13} className="shrink-0 text-[#C8A96B]" aria-hidden /> : null}
            </button>
          );
        })}
        {!visibles.length ? <p className="col-span-full py-3 text-center text-xs text-white/40">Nadie con ese nombre.</p> : null}
      </div>
    </div>
  );
}
