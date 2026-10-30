"use client";

/**
 * LA CABECERA DE LA SESIÓN (30/10/2026).
 *
 * El analista pidió que el flujo «elegir sesión → ver el resumen → revisar y
 * validar con su clip → ver la evolución» fuera evidente. Antes la pantalla
 * era un único scroll: el estado del análisis estaba a media página, el botón
 * «Analizar» junto a los objetivos y nada decía qué tocaba ahora. Aquí, de un
 * vistazo: qué día es, qué sesión fue (micro, MD, rival, de dónde sale el
 * vídeo), en qué punto está (cuatro pasos) y UN botón con el siguiente paso.
 *
 * Sólo pinta: el estado lo decide la página (./page.tsx, `pasoSiguiente`).
 */

import type { ComponentType, ReactNode } from "react";
import { Check, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

const FOCO = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#C8A96B]";
const DIAS = ["L", "M", "X", "J", "V", "S", "D"];

export type EstadoPaso = "hecho" | "ahora" | "pendiente" | "error";

export type Paso = { nombre: string; estado: EstadoPaso; detalle?: string; onClick?: () => void };

export type Siguiente = { texto: string; detalle?: string; icono?: ComponentType<{ size?: number; className?: string }>; onClick?: () => void; disabled?: boolean; ocupado?: boolean };

const fechaLarga = (f: string) => new Date(`${f}T12:00:00`).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });

/** La tira de la semana: un toque por día, semana anterior y siguiente, y el calendario para saltar lejos. */
export function SelectorDia({ fecha, hoy, semana, onFecha, mueve, derecha }: { fecha: string; hoy: string; semana: string[]; onFecha: (f: string) => void; mueve: (f: string, dias: number) => string; derecha?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex max-w-full items-center gap-1 overflow-x-auto scrollbar-none">
        <button type="button" onClick={() => onFecha(mueve(fecha, -7))} aria-label="Semana anterior" title="Semana anterior" className={`shrink-0 rounded-lg border border-white/12 p-2 text-white/60 hover:text-white ${FOCO}`}>
          <ChevronLeft size={14} />
        </button>
        {semana.map((d, i) => (
          <button
            key={d}
            type="button"
            onClick={() => onFecha(d)}
            aria-pressed={d === fecha}
            aria-label={fechaLarga(d)}
            title={fechaLarga(d)}
            className={`flex w-10 shrink-0 flex-col items-center rounded-lg py-1 text-xs leading-tight ${FOCO} ${d === fecha ? "bg-[#C8A96B] font-semibold text-black" : d === hoy ? "border border-[#C8A96B]/40 text-white/85" : "border border-white/12 text-white/60 hover:text-white"}`}
          >
            <span className="text-[10px] opacity-80">{DIAS[i]}</span>
            <span className="tabular-nums">{Number(d.slice(8))}</span>
          </button>
        ))}
        <button type="button" onClick={() => onFecha(mueve(fecha, 7))} aria-label="Semana siguiente" title="Semana siguiente" className={`shrink-0 rounded-lg border border-white/12 p-2 text-white/60 hover:text-white ${FOCO}`}>
          <ChevronRight size={14} />
        </button>
      </div>
      <input type="date" value={fecha} onChange={(e) => e.target.value && onFecha(e.target.value)} aria-label="Día del entrenamiento" className={`rounded-lg border border-white/12 bg-white/[0.05] px-3 py-1.5 text-sm text-white ${FOCO}`} />
      {fecha !== hoy ? (
        <button type="button" onClick={() => onFecha(hoy)} className={`rounded-lg px-2 py-1 text-xs text-white/60 hover:text-white hover:underline ${FOCO}`}>
          Hoy
        </button>
      ) : null}
      {derecha ? <div className="ml-auto">{derecha}</div> : null}
    </div>
  );
}

export function CabeceraSesion({
  fecha,
  sesion,
  fuente,
  estado,
  pasos,
  siguiente,
  secundario,
  children,
}: {
  fecha: string;
  /** «Micro 12 · MD-3 · Rival», si el registro tiene el día. */
  sesion?: string;
  /** «Cámara táctica · 82 min · analizado el 28/10 18:40». */
  fuente?: string;
  estado: { texto: string; tono: "neutro" | "oro" | "aviso" | "bien" };
  pasos: Paso[];
  siguiente: Siguiente | null;
  secundario?: ReactNode;
  /** El progreso del análisis o lo que haya que avisar. */
  children?: ReactNode;
}) {
  const tono = {
    neutro: "bg-white/[0.06] text-white/75",
    oro: "bg-[#C8A96B]/15 text-[#C8A96B]",
    aviso: "bg-amber-400/15 text-amber-300",
    bien: "bg-emerald-400/15 text-emerald-300",
  }[estado.tono];
  const Icono = siguiente?.ocupado ? Loader2 : siguiente?.icono;

  return (
    <section aria-labelledby="cabecera-sesion" className="min-w-0 space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
      <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="cabecera-sesion" className="text-xl font-semibold capitalize leading-tight text-white sm:text-2xl">
              {fechaLarga(fecha)}
            </h2>
            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${tono}`}>{estado.texto}</span>
          </div>
          {sesion ? <p className="text-sm text-white/70">{sesion}</p> : null}
          {fuente ? <p className="text-xs text-white/50">{fuente}</p> : null}
        </div>

        {siguiente ? (
          <div className="flex min-w-0 shrink-0 flex-col gap-1.5 lg:items-end">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">Siguiente paso</p>
            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              {secundario}
              {siguiente.onClick ? (
                <button
                  type="button"
                  onClick={siguiente.onClick}
                  disabled={siguiente.disabled || siguiente.ocupado}
                  className={`inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#C8A96B] bg-[#C8A96B] px-4 text-sm font-semibold text-black transition hover:bg-[#d8bc82] disabled:cursor-not-allowed disabled:opacity-50 ${FOCO}`}
                >
                  {Icono ? <Icono size={16} className={siguiente.ocupado ? "animate-spin" : ""} /> : null}
                  {siguiente.texto}
                </button>
              ) : (
                <p className="inline-flex items-center gap-2 text-sm font-semibold text-white/85">
                  {Icono ? <Icono size={16} className={`text-[#C8A96B] ${siguiente.ocupado ? "animate-spin" : ""}`} /> : null}
                  {siguiente.texto}
                </p>
              )}
            </div>
            {siguiente.detalle ? <p className="max-w-sm text-xs text-white/55 lg:text-right">{siguiente.detalle}</p> : null}
          </div>
        ) : null}
      </div>

      {/* Los cuatro pasos: lo hecho, lo de ahora y lo que falta, con su cuenta. */}
      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="En qué punto está la sesión">
        {pasos.map((p, i) => {
          const contenido = (
            <>
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                  p.estado === "hecho" ? "bg-[#C8A96B] text-black" : p.estado === "ahora" ? "bg-[#C8A96B]/15 text-[#C8A96B]" : p.estado === "error" ? "bg-amber-400/20 text-amber-300" : "bg-white/[0.06] text-white/50"
                }`}
                aria-hidden
              >
                {p.estado === "hecho" ? <Check size={13} /> : i + 1}
              </span>
              <span className="min-w-0">
                <span className={`block text-xs font-semibold ${p.estado === "pendiente" ? "text-white/55" : "text-white/90"}`}>{p.nombre}</span>
                {p.detalle ? <span className="block truncate text-[11px] text-white/50">{p.detalle}</span> : null}
              </span>
            </>
          );
          const clase = `flex min-w-0 items-center gap-2 rounded-xl border px-2.5 py-2 text-left ${p.estado === "ahora" ? "border-[#C8A96B]/40 bg-[#C8A96B]/[0.06]" : "border-white/[0.08]"}`;

          return (
            <li key={p.nombre} className="min-w-0" aria-current={p.estado === "ahora" ? "step" : undefined}>
              {p.onClick ? (
                <button type="button" onClick={p.onClick} className={`${clase} w-full transition hover:bg-white/[0.04] ${FOCO}`}>
                  {contenido}
                </button>
              ) : (
                <div className={clase}>{contenido}</div>
              )}
            </li>
          );
        })}
      </ol>

      {children}
    </section>
  );
}
