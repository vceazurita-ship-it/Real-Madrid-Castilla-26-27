"use client";

/**
 * Un objetivo de la sesión, editable (16/10/2026; tarea, meta y origen desde
 * el 19/10/2026). Se guarda solo: cada cambio sube al documento del día.
 */

import { useId, useState } from "react";
import { Trash2, X } from "lucide-react";

import { Button } from "@/components/abp/ui";
import { SeleccionJugadores, type JugadorElegible } from "@/components/seguimiento/SeleccionJugadores";
import type { ObjetivoEntreno } from "@/lib/entreno/modelo";

export const CAMPO =
  "w-full min-w-0 rounded-lg border border-white/12 bg-white/[0.05] px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:border-[#C8A96B]/50 focus-visible:ring-2 focus-visible:ring-[#C8A96B]/40";

const ETIQUETA = "mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45";

/** Una tarea del registro del día, para elegirla en el objetivo. */
export type TareaDelDia = { codigo: string; texto: string };

/** De dónde suele salir un objetivo: se proponen, pero se puede escribir otra cosa. */
const ORIGENES = ["Seguimiento individual", "Qué toca en el microciclo (post)", "Plan de partido", "Cuerpo técnico"];

const tieneContenido = (o: ObjetivoEntreno) =>
  Boolean(o.objetivo.trim() || o.jugadores.length || o.reconocer?.trim() || o.correcto?.trim() || o.mejorable?.trim() || o.donde?.trim() || o.tarea?.trim() || o.origen?.trim() || o.meta);

export function ObjetivoEditor({
  objetivo,
  numero,
  jugadores,
  tareas,
  onCambia,
  onQuita,
}: {
  objetivo: ObjetivoEntreno;
  numero: number;
  jugadores: JugadorElegible[];
  /** Las tareas del registro de ese día (vacío si la hoja no tiene ese día). */
  tareas: TareaDelDia[];
  onCambia: (o: ObjetivoEntreno) => void;
  onQuita: () => void;
}) {
  const id = useId();
  const [eligiendo, setEligiendo] = useState(!objetivo.jugadores.length && !objetivo.objetivo);
  const pon = (parte: Partial<ObjetivoEntreno>) => onCambia({ ...objetivo, ...parte });
  const falta = !objetivo.objetivo.trim() ? "Falta qué se busca" : !objetivo.jugadores.length ? "Falta el jugador" : null;

  const ponTarea = (texto: string) => {
    const codigo = texto.split("·")[0].trim();
    const delRegistro = tareas.find((t) => t.codigo.toLowerCase() === codigo.toLowerCase());

    pon({ tarea: delRegistro ? delRegistro.codigo : texto, tareaTexto: delRegistro ? delRegistro.texto : undefined });
  };

  return (
    <div className={`min-w-0 space-y-3 rounded-2xl border bg-white/[0.03] p-4 ${falta ? "border-amber-400/25" : "border-white/10"}`}>
      <div className="flex items-start gap-2">
        <span className="mt-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#C8A96B]/15 text-xs font-semibold text-[#C8A96B]">{numero}</span>
        <textarea
          value={objetivo.objetivo}
          onChange={(e) => pon({ objetivo: e.target.value })}
          rows={2}
          placeholder="Qué se busca: «perfilarse antes de recibir para jugar hacia delante»"
          aria-label={`Objetivo ${numero}: qué se busca`}
          className={`${CAMPO} resize-y font-medium`}
        />
        <button
          type="button"
          onClick={() => {
            if (!tieneContenido(objetivo) || window.confirm("¿Quitar este objetivo? Sus acciones dejarán de contar.")) onQuita();
          }}
          aria-label={`Quitar el objetivo ${numero}`}
          title="Quitar objetivo"
          className="rounded-lg p-2 text-white/40 hover:text-red-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C8A96B]"
        >
          <Trash2 size={15} />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {objetivo.jugadores.map((j) => (
          <span key={j.id} className="inline-flex items-center gap-1 rounded-md bg-[#C8A96B]/15 py-0.5 pl-2 pr-1 text-xs text-[#C8A96B]">
            {j.nombre}
            <button type="button" onClick={() => pon({ jugadores: objetivo.jugadores.filter((x) => x.id !== j.id) })} aria-label={`Quitar a ${j.nombre}`} className="rounded p-1 hover:bg-[#C8A96B]/20">
              <X size={11} />
            </button>
          </span>
        ))}
        <Button onClick={() => setEligiendo((x) => !x)} aria-pressed={eligiendo}>
          {eligiendo ? "Listo" : objetivo.jugadores.length ? "Cambiar jugadores" : "Elegir jugadores"}
        </Button>
        {falta ? <span className="text-[11px] text-amber-300/80">{falta}</span> : null}
      </div>

      {eligiendo && (
        <SeleccionJugadores
          jugadores={jugadores}
          seleccion={objetivo.jugadores.map((j) => j.id)}
          onCambia={(ids) => pon({ jugadores: ids.map((jid) => ({ id: jid, nombre: jugadores.find((x) => x.id === jid)?.nombre ?? objetivo.jugadores.find((x) => x.id === jid)?.nombre ?? jid })) })}
        />
      )}

      <div className="grid gap-2 md:grid-cols-2">
        <input value={objetivo.reconocer ?? ""} onChange={(e) => pon({ reconocer: e.target.value })} placeholder="Cómo reconocerlo en el vídeo: «peto naranja, dorsal 8»" aria-label="Cómo reconocerlo en el vídeo" className={CAMPO} />
        <input value={objetivo.donde ?? ""} onChange={(e) => pon({ donde: e.target.value })} placeholder="Mirar sólo en (opcional): «rondo 6v3», «del minuto 20 al 45»" aria-label="Mirar sólo en" className={CAMPO} />
        <input value={objetivo.correcto ?? ""} onChange={(e) => pon({ correcto: e.target.value })} placeholder="Es CORRECTA si…" aria-label="Es correcta si" className={CAMPO} />
        <input value={objetivo.mejorable ?? ""} onChange={(e) => pon({ mejorable: e.target.value })} placeholder="Es MEJORABLE si…" aria-label="Es mejorable si" className={CAMPO} />
      </div>

      {/* Lo que no cambia lo que mira la IA: en qué tarea, qué se pide y de dónde sale. */}
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1.3fr)_6.5rem_minmax(0,1fr)]">
        <label className="block min-w-0">
          <span className={ETIQUETA}>Tarea del día</span>
          <input
            value={objetivo.tarea ?? ""}
            onChange={(e) => ponTarea(e.target.value)}
            list={`${id}-tareas`}
            placeholder={tareas.length ? "Elige: L-T1, L-T2…" : "L-T1"}
            className={CAMPO}
          />
          <datalist id={`${id}-tareas`}>
            {tareas.map((t) => (
              <option key={t.codigo} value={t.codigo}>
                {t.texto}
              </option>
            ))}
          </datalist>
          {objetivo.tareaTexto ? <span className="mt-1 block truncate text-[11px] text-white/45">{objetivo.tareaTexto}</span> : null}
        </label>
        <label className="block min-w-0">
          <span className={ETIQUETA}>Meta (%)</span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={100}
            step={5}
            value={objetivo.meta ?? ""}
            onChange={(e) => {
              const n = Math.round(Number(e.target.value));

              pon({ meta: e.target.value === "" || !Number.isFinite(n) ? undefined : Math.min(100, Math.max(1, n)) });
            }}
            placeholder="70"
            title="El porcentaje de acciones correctas que se pide"
            className={`${CAMPO} tabular-nums`}
          />
        </label>
        <label className="block min-w-0">
          <span className={ETIQUETA}>De dónde sale</span>
          <input value={objetivo.origen ?? ""} onChange={(e) => pon({ origen: e.target.value })} list={`${id}-origenes`} placeholder="Seguimiento individual…" className={CAMPO} />
          <datalist id={`${id}-origenes`}>
            {ORIGENES.map((o) => (
              <option key={o} value={o} />
            ))}
          </datalist>
        </label>
      </div>

      {!objetivo.reconocer?.trim() && objetivo.objetivo.trim() ? (
        <p className="text-[11px] text-white/45">Consejo: con peto o dorsal la IA reconoce al jugador; sin eso, en cámara lejana, se le escapan muchas acciones.</p>
      ) : null}
    </div>
  );
}
