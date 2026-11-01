"use client";

/*
|--------------------------------------------------------------------------
| BAJAS PARA EL PRÓXIMO PARTIDO (01/11/2026)
|--------------------------------------------------------------------------
|
| Lo pidió el analista: la columna ESTADO de la hoja está obsoleta y «si no
| hubiera alguno, hagamos forma de indicarlo». Aquí se marca en dos toques
| quién no está (lesión, sanción, selección, primer equipo u otro motivo) y,
| si se quiere, hasta qué día. Se guarda en `tactics:bajas-partido` y de ahí
| lo leen las fichas, la lista de cambio y la propuesta. Al pasar la fecha la
| baja se va sola.
*/

import { Plus, UserX, X } from "lucide-react";
import { useMemo, useState } from "react";

import type { BajasPartido as Bajas } from "@/hooks/useBajasPartido";
import { MOTIVOS_BAJA, esDe, textoBaja, type MotivoBaja } from "@/lib/tactics/disponibilidad";
import { nombreDeFicha } from "@/lib/tactics/editaOnce";
import { cn } from "@/lib/utils";
import type { Player } from "@/types/player";

export default function BajasPartido({ roster, bajas, preelegido }: { roster: Player[]; bajas: Bajas; preelegido?: string | null }) {
  const [abierto, setAbierto] = useState(false);
  const [jugador, setJugador] = useState("");
  const [motivo, setMotivo] = useState<MotivoBaja>("lesion");
  const [detalle, setDetalle] = useState("");
  const [hasta, setHasta] = useState("");

  const elegibles = useMemo(
    () =>
      roster
        .filter((p) => p.activo !== false)
        .sort((a, b) => Number(b.esCastilla) - Number(a.esCastilla) || nombreDeFicha(a).localeCompare(nombreDeFicha(b), "es")),
    [roster],
  );

  const abre = () => {
    setJugador(preelegido && elegibles.some((p) => p.id === preelegido) ? preelegido : "");
    setMotivo("lesion");
    setDetalle("");
    setHasta("");
    setAbierto(true);
  };

  const elegido = elegibles.find((p) => p.id === jugador);

  const guarda = () => {
    if (!elegido) return;

    bajas.marca(elegido, { motivo, detalle, hasta: hasta || undefined });
    setAbierto(false);
  };

  /* De quién es cada baja, para enseñar su nombre como en la plantilla. */
  const filas = bajas.bajas.map((b) => ({ b, ficha: roster.find((p) => esDe(b, p)) }));

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <p className="mr-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
          <UserX size={11} aria-hidden />
          No disponibles
        </p>

        {filas.length === 0 && !abierto && <span className="text-[11px] text-white/50">Todos pueden jugar el próximo partido.</span>}

        {filas.map(({ b, ficha }) => (
          <span key={b.nombre} className="inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-400/[0.08] py-1 pl-2.5 pr-1 text-[11px]">
            <b className="font-semibold text-white/85">{ficha ? nombreDeFicha(ficha) : b.nombre}</b>
            <span className="text-amber-300">{textoBaja(b)}</span>
            <button
              type="button"
              onClick={() => bajas.quita(ficha ?? { nombre: b.nombre })}
              aria-label={`Quitar la baja de ${ficha ? nombreDeFicha(ficha) : b.nombre}: vuelve a estar disponible`}
              title="Vuelve a estar disponible"
              className="rounded-full p-0.5 text-white/45 transition hover:bg-white/[0.08] hover:text-white"
            >
              <X size={12} />
            </button>
          </span>
        ))}

        {!abierto && (
          <button
            type="button"
            onClick={abre}
            className="ml-auto inline-flex items-center gap-1 rounded-full border border-white/15 px-2.5 py-1 text-[11px] font-semibold text-white/70 transition hover:bg-white/[0.06] hover:text-white"
          >
            <Plus size={12} aria-hidden />
            Marcar baja
          </button>
        )}
      </div>

      {abierto && (
        <form
          className="mt-2.5 grid gap-2.5 sm:grid-cols-[minmax(0,1fr)_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            guarda();
          }}
        >
          <div className="grid min-w-0 gap-2">
            <label className="grid gap-1 text-[11px] text-white/55">
              Jugador
              <select
                value={jugador}
                onChange={(e) => setJugador(e.target.value)}
                className="w-full min-w-0 rounded-lg border border-white/10 bg-[#0F141B] px-2.5 py-2 text-[12px] text-white/85 outline-none"
              >
                <option value="">Elige un jugador…</option>
                {elegibles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {nombreDeFicha(p)}
                    {p.posicion ? ` · ${p.posicion}` : ""}
                  </option>
                ))}
              </select>
            </label>

            <fieldset className="grid gap-1">
              <legend className="mb-1 text-[11px] text-white/55">Motivo</legend>
              <div className="flex flex-wrap gap-1.5">
                {MOTIVOS_BAJA.map((m) => (
                  <button
                    key={m.clave}
                    type="button"
                    aria-pressed={motivo === m.clave}
                    onClick={() => setMotivo(m.clave)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-[11px] font-semibold transition",
                      motivo === m.clave ? "border-[#C8A96B]/60 bg-[#C8A96B]/15 text-[#C8A96B]" : "border-white/10 text-white/65 hover:bg-white/[0.06]",
                    )}
                  >
                    {m.rotulo}
                  </button>
                ))}
              </div>
            </fieldset>

            {motivo === "otro" && (
              <label className="grid gap-1 text-[11px] text-white/55">
                Cuál
                <input
                  value={detalle}
                  onChange={(e) => setDetalle(e.target.value)}
                  placeholder="Permiso, enfermo…"
                  maxLength={40}
                  className="rounded-lg border border-white/10 bg-[#0F141B] px-2.5 py-2 text-[12px] text-white/85 outline-none"
                />
              </label>
            )}

            <label className="grid gap-1 text-[11px] text-white/55 sm:max-w-[14rem]">
              Hasta (si se sabe; se quita sola al pasar)
              <input
                type="date"
                value={hasta}
                onChange={(e) => setHasta(e.target.value)}
                min={bajas.hoy || undefined}
                className="rounded-lg border border-white/10 bg-[#0F141B] px-2.5 py-2 text-[12px] text-white/85 outline-none"
              />
            </label>
          </div>

          <div className="flex items-end justify-end gap-2">
            <button
              type="button"
              onClick={() => setAbierto(false)}
              className="rounded-full border border-white/15 px-3.5 py-1.5 text-[12px] font-semibold text-white/70 transition hover:bg-white/[0.06] hover:text-white"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!elegido}
              className="rounded-full bg-[#C8A96B] px-4 py-1.5 text-[12px] font-bold text-[#0B0F14] transition hover:brightness-110 disabled:opacity-40"
            >
              Marcar baja
            </button>
          </div>
        </form>
      )}

      {bajas.soloAqui && <p className="mt-1.5 text-[10px] text-amber-300">Sin conexión con el servidor: las bajas se guardan sólo en este aparato.</p>}
    </div>
  );
}
