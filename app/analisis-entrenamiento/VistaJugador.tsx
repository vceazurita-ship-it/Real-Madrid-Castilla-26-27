"use client";

/**
 * LA VISTA POR JUGADOR (19/10/2026): sus objetivos sesión a sesión, con la
 * anterior y el sentido, sus clips y el mensaje «Tu sesión». Los cálculos
 * viven en lib/entreno/jugador.ts; aquí sólo se pintan.
 */

import { useMemo, useState } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight, CalendarDays, Film, MessageCircle, UserRound } from "lucide-react";

import { Panel } from "@/components/abp/ui";
import { evolucionDelJugador, fechaLarga, jugadoresDelHistorial, tuSesion, type DiaEntreno, type SesionDelObjetivo } from "@/lib/entreno/jugador";
import { lecturaCuentas, mmss, porcentajeOTendencia, type AccionEntreno } from "@/lib/entreno/modelo";

import { TuSesion } from "./TuSesion";

const fechaCorta = (f: string) => new Date(`${f}T12:00:00`).toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "numeric" });

const SENTIDO = {
  mejor: { icono: ArrowUpRight, texto: "mejora", clase: "text-emerald-300" },
  peor: { icono: ArrowDownRight, texto: "baja", clase: "text-amber-300" },
  igual: { icono: ArrowRight, texto: "igual", clase: "text-white/60" },
} as const;

function Clip({ accion, tipo }: { accion: AccionEntreno; tipo: "correcta" | "mejorable" }) {
  const [abierto, setAbierto] = useState(false);

  return (
    <div className="min-w-0">
      <button
        type="button"
        onClick={() => setAbierto((x) => !x)}
        aria-expanded={abierto}
        className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs ${tipo === "correcta" ? "border-emerald-400/30 text-emerald-300" : "border-amber-400/30 text-amber-300"} focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C8A96B]`}
      >
        <Film size={12} /> {tipo === "correcta" ? "Clip correcto" : "Clip mejorable"} · {mmss(accion.inicio)}
      </button>
      {abierto && accion.clip ? (
        <div className="mt-2 space-y-1">
          <video src={accion.clip} controls autoPlay preload="metadata" playsInline className="aspect-video w-full max-w-md rounded-lg bg-black" />
          <p className="text-xs text-white/60">{accion.explicacion}</p>
        </div>
      ) : null}
    </div>
  );
}

function FilaSesion({ s, onIrAlDia }: { s: SesionDelObjetivo; onIrAlDia: (fecha: string) => void }) {
  const sentido = s.sentido ? SENTIDO[s.sentido] : null;

  return (
    <li className="space-y-2 py-3 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <button type="button" onClick={() => onIrAlDia(s.fecha)} className="text-sm font-semibold capitalize text-white hover:underline" title="Abrir ese día">
          {fechaCorta(s.fecha)}
        </button>
        {s.objetivo.tarea ? <span className="rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[11px] text-white/60">{s.objetivo.tarea}</span> : null}
        {!s.analizado ? (
          <span className="text-xs text-white/45">Sin analizar: ese día no se pidió el análisis</span>
        ) : s.cuentas && s.cuentas.total ? (
          <>
            <span className="text-xs text-white/75">{lecturaCuentas(s.cuentas)}</span>
            {s.cumple !== null ? (
              <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${s.cumple ? "bg-emerald-400/15 text-emerald-300" : "bg-amber-400/15 text-amber-300"}`}>
                {s.cumple ? "Meta cumplida" : "Por debajo de la meta"}
              </span>
            ) : null}
          </>
        ) : (
          <span className="text-xs text-white/45">El vídeo no dio acciones suyas</span>
        )}
      </div>

      {s.anterior && s.cuentas?.total ? (
        <p className={`flex flex-wrap items-center gap-1 text-[11px] ${sentido?.clase ?? "text-white/50"}`}>
          {sentido ? <sentido.icono size={13} aria-hidden /> : null}
          {sentido ? `${sentido.texto} · ` : ""}
          <span className="text-white/50">
            antes ({fechaCorta(s.anterior.fecha)}): {s.anterior.cuentas.correctas} de {s.anterior.cuentas.total}
            {s.anterior.cuentas.pct !== null ? ` · ${s.anterior.cuentas.pct} %` : ""}
            {s.cuentas.muestraCorta || s.anterior.cuentas.muestraCorta ? " · poca muestra para sacar conclusiones" : ""}
          </span>
        </p>
      ) : null}

      {s.cambiado ? <p className="text-[11px] text-amber-300/80">El objetivo cambió después de analizarlo: estos números son de la versión anterior.</p> : null}

      {s.clipBien || s.clipMejorable ? (
        <div className="flex flex-wrap gap-2">
          {s.clipBien ? <Clip accion={s.clipBien} tipo="correcta" /> : null}
          {s.clipMejorable ? <Clip accion={s.clipMejorable} tipo="mejorable" /> : null}
        </div>
      ) : null}
    </li>
  );
}

export function VistaJugador({
  dias,
  fecha,
  jugador,
  onJugador,
  onIrAlDia,
}: {
  dias: DiaEntreno[];
  /** El día elegido arriba: «Tu sesión» sale de él si tiene algo del jugador. */
  fecha: string;
  jugador: string | null;
  onJugador: (clave: string) => void;
  onIrAlDia: (fecha: string) => void;
}) {
  const jugadores = useMemo(() => jugadoresDelHistorial(dias), [dias]);
  const elegido = jugadores.find((j) => j.clave === jugador) ?? jugadores[0] ?? null;
  const lineas = useMemo(() => (elegido ? evolucionDelJugador(dias, elegido.clave) : []), [dias, elegido]);

  /* Los días con algo suyo analizado, del más reciente al más antiguo: para «Tu sesión». */
  const diasConMensaje = useMemo(
    () =>
      elegido
        ? [...dias]
            .sort((a, b) => b.fecha.localeCompare(a.fecha))
            .map((d) => ({ fecha: d.fecha, mensaje: tuSesion(d, elegido.clave, elegido.nombre) }))
            .filter((x): x is { fecha: string; mensaje: NonNullable<ReturnType<typeof tuSesion>> } => x.mensaje !== null)
        : [],
    [dias, elegido],
  );
  const [diaMensaje, setDiaMensaje] = useState<string | null>(null);
  /* El día del mensaje: el que se haya elegido; si no, el de arriba si tiene algo suyo; si no, el último que lo tenga. */
  const mensaje = diasConMensaje.find((d) => d.fecha === diaMensaje) ?? diasConMensaje.find((d) => d.fecha === fecha) ?? diasConMensaje[0] ?? null;

  if (!jugadores.length) {
    return (
      <div className="rounded-xl border border-dashed border-white/12 px-5 py-10 text-center">
        <p className="text-sm font-medium text-white/70">Todavía no hay objetivos con jugador</p>
        <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-white/50">Créalos en la pestaña «Objetivos»: cada jugador con objetivos aparecerá aquí con su evolución sesión a sesión.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Elegir jugador">
        {jugadores.map((j) => (
          <button
            key={j.clave}
            type="button"
            aria-pressed={j.clave === elegido?.clave}
            onClick={() => onJugador(j.clave)}
            className={`rounded-lg px-3 py-1.5 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C8A96B] ${j.clave === elegido?.clave ? "bg-[#C8A96B] font-semibold text-black" : "border border-white/12 text-white/70 hover:text-white"}`}
          >
            {j.nombre} <span className="tabular-nums opacity-70">{j.dias}</span>
          </button>
        ))}
      </div>

      {elegido ? (
        <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className="min-w-0 space-y-4">
            {lineas.map((l) => {
              const ultima = [...l.sesiones].reverse().find((s) => s.cuentas && s.cuentas.total);

              /* Tarjeta propia y no `Panel`: el título del panel se corta en una línea y el objetivo hay que leerlo entero. */
              return (
                <section key={l.clave} className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.03]">
                  <header className="flex items-start gap-3 border-b border-white/10 px-4 py-3">
                    <UserRound size={15} className="mt-0.5 shrink-0 text-[#C8A96B]" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold text-white">{l.texto}</h3>
                      <p className="mt-0.5 text-[11px] text-white/50">
                        {[l.meta ? `Meta ${l.meta} % de correctas` : "", `${l.sesiones.length} ${l.sesiones.length === 1 ? "sesión" : "sesiones"}`].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    {ultima?.cuentas ? <span className="shrink-0 text-lg font-semibold tabular-nums text-white">{porcentajeOTendencia(ultima.cuentas)}</span> : null}
                  </header>
                  <ul className="divide-y divide-white/[0.06] px-4 py-3">
                    {[...l.sesiones].reverse().map((s) => (
                      <FilaSesion key={`${s.fecha}-${s.objetivo.id}`} s={s} onIrAlDia={onIrAlDia} />
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>

          <Panel title={`Tu sesión · ${elegido.nombre}`} subtitle="El resumen para mandarle por WhatsApp: dos frases, su cuenta y sus clips" icon={MessageCircle}>
            {mensaje ? (
              <div className="space-y-3">
                {diasConMensaje.length > 1 ? (
                  <label className="flex flex-wrap items-center gap-2 text-xs text-white/60">
                    <CalendarDays size={13} aria-hidden /> Sesión del
                    <select
                      value={mensaje.fecha}
                      onChange={(e) => setDiaMensaje(e.target.value)}
                      className="rounded-lg border border-white/12 bg-white/[0.05] px-2 py-1 text-xs text-white"
                    >
                      {diasConMensaje.map((d) => (
                        <option key={d.fecha} value={d.fecha}>
                          {fechaLarga(d.fecha)}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <p className="text-xs capitalize text-white/60">{fechaLarga(mensaje.fecha)}</p>
                )}
                <TuSesion key={`${elegido.clave}-${mensaje.fecha}`} jugador={elegido.clave} nombre={elegido.nombre} mensaje={mensaje.mensaje} />
              </div>
            ) : (
              <p className="text-sm text-white/60">
                Todavía no hay ninguna sesión analizada con acciones de {elegido.nombre}. Cuando un día con objetivos suyos tenga análisis, aquí sale su mensaje.
              </p>
            )}
          </Panel>
        </div>
      ) : null}
    </div>
  );
}
