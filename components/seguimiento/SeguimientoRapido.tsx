"use client";

/*
|--------------------------------------------------------------------------
| UN SEGUIMIENTO RÁPIDO, INDIVIDUAL O GRUPAL
|--------------------------------------------------------------------------
|
| El formulario corto del pop-up del día (portada): se marcan uno o varios
| jugadores, lo básico y se guarda. Con varios es GRUPAL y se escribe la
| misma fila en cada uno (`creaSeguimientos`).
*/

import { Loader2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import {
  ESTRATEGIA_OPTIONS,
  MOMENTO_OPTIONS,
  QUIEN_OPTIONS,
  creaSeguimientos,
  seguimientoVacio,
  type CamposSeguimiento,
} from "@/lib/seguimiento-escribir";

import { SeleccionJugadores, type JugadorElegible } from "./SeleccionJugadores";

const CAMPO =
  "w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none transition focus:border-[#C8A96B]/50";

function Etiqueta({ t, children }: { t: string; children: ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-[10px] uppercase tracking-[0.16em] text-white/40">{t}</span>
      {children}
    </label>
  );
}

function Desplegable({ t, valor, opciones, onCambia }: { t: string; valor: string; opciones: string[]; onCambia: (v: string) => void }) {
  return (
    <Etiqueta t={t}>
      <select value={valor} onChange={(e) => onCambia(e.target.value)} className={CAMPO}>
        <option value="">Seleccionar…</option>
        {opciones.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </Etiqueta>
  );
}

export function SeguimientoRapido({ fecha, jugadores, onHecho }: { fecha: string; jugadores: JugadorElegible[]; onHecho?: () => void }) {
  const [elegidos, setElegidos] = useState<string[]>([]);
  const [campos, setCampos] = useState<CamposSeguimiento>(() => ({ ...seguimientoVacio(fecha), MOMENTO: "ENTRENAMIENTO" }));
  const [guardando, setGuardando] = useState<string | null>(null);

  const pon = (cambio: Partial<CamposSeguimiento>) => setCampos((c) => ({ ...c, ...cambio }));
  const grupal = elegidos.length > 1;
  const algoEscrito = [campos.OBJETIVO_OFENSIVO, campos.OBJETIVO_DEFENSIVO, campos.OBJETIVO_MENTAL, campos.FEEDBACK].some((t) => t.trim());

  const guarda = async () => {
    if (!elegidos.length) return void toast.error("Marca al menos un jugador");
    if (!campos.FECHA) return void toast.error("La fecha es obligatoria");
    if (!algoEscrito) return void toast.error("Escribe algún objetivo o el feedback");

    setGuardando(`0/${elegidos.length}`);

    try {
      const r = await creaSeguimientos(elegidos, { ...campos, MODALIDAD: grupal ? "GRUPAL" : "INDIVIDUAL" }, (n, total) => setGuardando(`${n}/${total}`));
      const nombre = (id: string) => jugadores.find((j) => j.id === id)?.nombre ?? id;

      if (r.fallidos.length) {
        toast.error(`${r.fallidos.length} sin guardar`, { description: r.fallidos.map((f) => `${nombre(f.idJugador)}: ${f.motivo}`).join(" · ") });
        /* Se quedan marcados sólo los que fallaron, para reintentar. */
        setElegidos(r.fallidos.map((f) => f.idJugador));
      } else {
        toast.success(
          r.hechos.length > 1 ? `Seguimiento grupal guardado en ${r.hechos.length} jugadores` : `Seguimiento guardado · ${nombre(r.hechos[0]?.idJugador ?? "")}`,
        );
        setElegidos([]);
        setCampos({ ...seguimientoVacio(fecha), MOMENTO: campos.MOMENTO, QUIEN: campos.QUIEN, ESTRATEGIA: campos.ESTRATEGIA });
        onHecho?.();
      }
    } catch (error) {
      toast.error("No se ha podido guardar", { description: error instanceof Error ? error.message : "Error de conexión" });
    } finally {
      setGuardando(null);
    }
  };

  return (
    <div className="grid min-w-0 gap-4">
      <div>
        <p className="mb-1.5 text-[10px] uppercase tracking-[0.16em] text-white/40">
          Jugadores ·{" "}
          {elegidos.length === 0 ? "marca uno (individual) o varios (grupal)" : grupal ? `grupal: se guarda en los ${elegidos.length}` : "individual"}
        </p>
        <SeleccionJugadores jugadores={jugadores} seleccion={elegidos} onCambia={setElegidos} alto="max-h-[200px]" />
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Etiqueta t="Fecha">
          <input type="date" value={campos.FECHA} onChange={(e) => pon({ FECHA: e.target.value })} className={CAMPO} />
        </Etiqueta>
        <Desplegable t="Quién" valor={campos.QUIEN} opciones={QUIEN_OPTIONS} onCambia={(v) => pon({ QUIEN: v })} />
        <Desplegable t="Momento" valor={campos.MOMENTO} opciones={MOMENTO_OPTIONS} onCambia={(v) => pon({ MOMENTO: v })} />
        <Desplegable t="Estrategia" valor={campos.ESTRATEGIA} opciones={ESTRATEGIA_OPTIONS} onCambia={(v) => pon({ ESTRATEGIA: v })} />
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Etiqueta t="Objetivo ofensivo">
          <textarea value={campos.OBJETIVO_OFENSIVO} onChange={(e) => pon({ OBJETIVO_OFENSIVO: e.target.value })} placeholder="Qué trabajamos con balón…" className={`${CAMPO} min-h-[90px] resize-y`} />
        </Etiqueta>
        <Etiqueta t="Objetivo defensivo">
          <textarea value={campos.OBJETIVO_DEFENSIVO} onChange={(e) => pon({ OBJETIVO_DEFENSIVO: e.target.value })} placeholder="Qué trabajamos sin balón…" className={`${CAMPO} min-h-[90px] resize-y`} />
        </Etiqueta>
        <Etiqueta t="Objetivo mental">
          <textarea value={campos.OBJETIVO_MENTAL} onChange={(e) => pon({ OBJETIVO_MENTAL: e.target.value })} placeholder="Actitud, concentración…" className={`${CAMPO} min-h-[90px] resize-y`} />
        </Etiqueta>
      </div>

      <Etiqueta t="Feedback">
        <textarea value={campos.FEEDBACK} onChange={(e) => pon({ FEEDBACK: e.target.value })} placeholder="Qué se le transmitió…" className={`${CAMPO} min-h-[70px] resize-y`} />
      </Etiqueta>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={guarda}
          disabled={Boolean(guardando)}
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-[#0B0F14] transition disabled:opacity-60"
          style={{ background: "#C8A96B" }}
        >
          {guardando ? <Loader2 size={14} className="animate-spin" aria-hidden /> : null}
          {guardando ? `Guardando ${guardando}…` : grupal ? `Guardar en los ${elegidos.length}` : "Guardar seguimiento"}
        </button>
      </div>
    </div>
  );
}
