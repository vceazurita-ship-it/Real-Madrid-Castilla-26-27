"use client";

/*
|--------------------------------------------------------------------------
| LAS ACCIONES A PANTALLA COMPLETA (31/10/2026)
|--------------------------------------------------------------------------
|
| Lo pidió el analista, como ya tenía el coding (components/coding/
| PanelPantallaCompleta.tsx): a pantalla completa seguir viendo la lista de
| lo que ofrece el análisis para pasar de un minuto a otro sin salir, y poder
| pintar encima.
|
| Va DENTRO del marco que se pone en grande (./VisorClips.tsx): si no, el
| navegador no lo enseña. Tumbado, la lista es una columna de 320 px a la
| derecha; de pie, una hoja que ocupa el 45 % de abajo. Se pliega para dejar
| el vídeo entero. Abajo los mandos: anterior, cinco segundos atrás,
| reproducir, cinco adelante, siguiente y salir.
|
| Todo con fondos en línea y `siempre-oscuro`: con clases de Tailwind el modo
| día aclaraba la columna (lo mismo que se vio en el coding).
*/

import { useEffect, useRef } from "react";
import {
  ChevronDown,
  Film,
  ListVideo,
  Minimize2,
  PanelRightClose,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  SkipBack,
  SkipForward,
  ThumbsDown,
  ThumbsUp,
  X,
} from "lucide-react";

import { mmss, type Validacion, type Veredicto } from "@/lib/entreno/modelo";

import { claveDe, COLOR_BIEN, COLOR_MEJORABLE, type Pieza } from "./VisorClips";

/** El ancho de la columna, el mismo que se le quita al vídeo en VisorClips. */
export const ANCHO_PANEL_ENTRENO = 320;

const ORO = "#C8A96B";
const CRISTAL = "rgba(8,12,18,.78)";
const BORDE = "1px solid rgba(255,255,255,.12)";
const GRIS = "rgba(255,255,255,.3)";

const colorDe = (v: Veredicto | null) => (v === "correcta" ? COLOR_BIEN : v === "mejorable" ? COLOR_MEJORABLE : GRIS);

/** Un botón redondo de la barra de mandos (40 px como poco: se usa con el dedo). */
function Mando({
  titulo,
  onClick,
  disabled,
  grande = false,
  children,
}: {
  titulo: string;
  onClick: () => void;
  disabled?: boolean;
  grande?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={titulo}
      aria-label={titulo}
      onClick={(e) => {
        /* Sin el foco en el botón: el espacio sigue siendo del vídeo y no repite el clic. */
        e.currentTarget.blur();
        onClick();
      }}
      disabled={disabled}
      className={`grid shrink-0 place-items-center rounded-full text-white transition hover:scale-105 disabled:pointer-events-none disabled:opacity-30 ${grande ? "h-12 w-12" : "h-10 w-10 hover:bg-white/10 pointer-coarse:h-11 pointer-coarse:w-11"}`}
      style={grande ? { background: ORO, color: "#0B0F14", boxShadow: `0 0 24px ${ORO}66` } : undefined}
    >
      {children}
    </button>
  );
}

export function PantallaCompletaClips({
  piezas,
  actual,
  veredictoDe,
  validadaDe,
  fechaEditable,
  abierto,
  alAbrir,
  alElegir,
  alMover,
  conVideo,
  reproduciendo,
  alAlternar,
  alSaltar,
  alSalir,
  veredicto,
}: {
  /** Las que enseña el visor, en su orden y con su filtro. */
  piezas: Pieza[];
  actual: Pieza | null;
  veredictoDe: (p: Pieza) => Veredicto | null;
  validadaDe: (p: Pieza) => boolean;
  fechaEditable: string;
  abierto: boolean;
  alAbrir: (abierto: boolean) => void;
  alElegir: (clave: string) => void;
  alMover: (paso: number) => void;
  /** La acción actual tiene clip: sin él no hay vídeo que mover. */
  conVideo: boolean;
  reproduciendo: boolean;
  alAlternar: () => void;
  alSaltar: (segundos: number) => void;
  alSalir: () => void;
  /** Validar sin salir; sólo cuando la actual es del día abierto. */
  veredicto: { val: Validacion | undefined; alDecide: (v: Validacion | null) => void } | null;
}) {
  const claveActual = actual ? claveDe(actual) : null;
  const indice = piezas.findIndex((p) => claveDe(p) === claveActual);
  const desplaza = abierto ? ANCHO_PANEL_ENTRENO / 2 : 0;

  /* La actual siempre a la vista en la lista (se mueve también con ← →). */
  const filas = useRef(new Map<string, HTMLElement>());

  useEffect(() => {
    if (!claveActual || !abierto) return;

    filas.current.get(claveActual)?.scrollIntoView({ block: "nearest" });
  }, [claveActual, abierto]);

  return (
    <div className="siempre-oscuro">
      {/* ------------------------------------------------ LOS MANDOS */}
      <div
        className={`absolute bottom-5 z-20 flex max-w-[calc(100%-1rem)] items-center gap-1 rounded-full px-2 py-1.5 backdrop-blur-md [transform:translateX(-50%)] landscape:[transform:translateX(calc(-50%_-_var(--desplaza-panel)))] ${
          abierto ? "portrait:bottom-[calc(45%+0.75rem)]" : "max-sm:bottom-3"
        }`}
        style={
          {
            left: "50%",
            "--desplaza-panel": `${desplaza}px`,
            background: CRISTAL,
            border: BORDE,
            boxShadow: "0 12px 34px rgba(0,0,0,.5)",
          } as React.CSSProperties
        }
      >
        <Mando titulo="Acción anterior (←)" disabled={piezas.length < 2} onClick={() => alMover(-1)}>
          <SkipBack size={17} />
        </Mando>
        {conVideo ? (
          <>
            <Mando titulo="Cinco segundos atrás" onClick={() => alSaltar(-5)}>
              <RotateCcw size={16} />
            </Mando>
            <Mando titulo={reproduciendo ? "Pausa (espacio)" : "Reproducir (espacio)"} onClick={alAlternar} grande>
              {reproduciendo ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="translate-x-[1px]" />}
            </Mando>
            <Mando titulo="Cinco segundos adelante" onClick={() => alSaltar(5)}>
              <RotateCw size={16} />
            </Mando>
          </>
        ) : null}
        <Mando titulo="Acción siguiente (→)" disabled={piezas.length < 2} onClick={() => alMover(1)}>
          <SkipForward size={17} />
        </Mando>

        {piezas.length > 0 && (
          <span className="ml-1 border-l pl-2 text-[11px] font-semibold tabular-nums text-white/60" style={{ borderColor: "rgba(255,255,255,.12)" }}>
            {indice >= 0 ? `${indice + 1} / ${piezas.length}` : piezas.length}
          </span>
        )}

        {!abierto && piezas.length > 0 && (
          <Mando titulo="Enseñar la lista de acciones" onClick={() => alAbrir(true)}>
            <ListVideo size={16} />
          </Mando>
        )}
        <Mando titulo="Salir de la pantalla completa (Esc)" onClick={alSalir}>
          <Minimize2 size={16} />
        </Mando>
      </div>

      {/* ------------------------------------------------ LA LISTA */}
      {abierto && (
        <aside
          className="absolute bottom-0 right-0 top-0 z-20 flex flex-col landscape:w-[320px] portrait:left-0 portrait:top-auto portrait:h-[45%] portrait:rounded-t-2xl"
          style={{ background: "linear-gradient(180deg, #0E141C, #0A0E14)", borderLeft: BORDE, borderTop: BORDE, boxShadow: "0 -12px 30px rgba(0,0,0,.45)" }}
          aria-label="Acciones"
        >
          <div className="flex items-center gap-2 px-3 pb-2 pt-3">
            <button
              type="button"
              onClick={() => alAbrir(false)}
              title="Plegar la lista"
              aria-label="Plegar la lista"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-white/60 transition hover:bg-white/10 hover:text-white"
            >
              <PanelRightClose size={16} className="portrait:hidden" />
              <ChevronDown size={18} className="landscape:hidden" />
            </button>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[.22em]" style={{ color: ORO }}>
                Acciones
              </p>
              <p className="text-sm font-semibold text-white">
                {piezas.length} {piezas.length === 1 ? "acción" : "acciones"}
              </p>
            </div>
          </div>

          {/* Lo que se ve ahora y su veredicto, sin salir. */}
          {actual ? (
            <div className="mx-3 mb-2 space-y-2 rounded-xl p-2.5" style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.07)" }}>
              <p className="truncate text-[10px] font-semibold uppercase tracking-wider" style={{ color: ORO }}>
                {actual.objetivo}
              </p>
              <p className="line-clamp-2 text-xs leading-snug text-white/85">
                {[actual.accion.jugador, actual.accion.explicacion].filter(Boolean).join(" · ") || `${mmss(actual.accion.inicio)}–${mmss(actual.accion.fin)}`}
              </p>
              {veredicto ? (
                <div className="grid grid-cols-3 gap-1.5">
                  <BotonCorto texto="Correcta" tecla="1" icono={<ThumbsUp size={14} aria-hidden />} color={COLOR_BIEN} activo={veredicto.val === "correcta"} onClick={() => veredicto.alDecide(veredicto.val === "correcta" ? null : "correcta")} />
                  <BotonCorto texto="Mejorable" tecla="2" icono={<ThumbsDown size={14} aria-hidden />} color={COLOR_MEJORABLE} activo={veredicto.val === "mejorable"} onClick={() => veredicto.alDecide(veredicto.val === "mejorable" ? null : "mejorable")} />
                  <BotonCorto texto={veredicto.val === "descartada" ? "Recuperar" : "Descartar"} tecla="3" icono={<X size={14} aria-hidden />} color="rgba(255,255,255,.35)" activo={veredicto.val === "descartada"} onClick={() => veredicto.alDecide(veredicto.val === "descartada" ? null : "descartada")} />
                </div>
              ) : null}
            </div>
          ) : null}

          <ol className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-3 pb-4">
            {piezas.map((p, i) => {
              const clave = claveDe(p);
              const activo = clave === claveActual;
              const v = veredictoDe(p);
              const validada = validadaDe(p);

              return (
                <li
                  key={clave}
                  ref={(el) => {
                    if (el) filas.current.set(clave, el);
                    else filas.current.delete(clave);
                  }}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.currentTarget.blur();
                      alElegir(clave);
                    }}
                    aria-current={activo ? "true" : undefined}
                    className="relative flex min-h-11 w-full items-center gap-2.5 overflow-hidden rounded-xl py-2 pl-3 pr-2 text-left transition"
                    style={{
                      background: activo ? `linear-gradient(90deg, ${ORO}2E, ${ORO}0D)` : "rgba(255,255,255,.035)",
                      border: `1px solid ${activo ? `${ORO}99` : "rgba(255,255,255,.07)"}`,
                    }}
                  >
                    {/* La franja del veredicto: rellena si está validada, tenue si es la propuesta. */}
                    <span aria-hidden className="absolute bottom-0 left-0 top-0 w-1" style={{ background: colorDe(v), opacity: validada ? 1 : 0.45 }} />
                    <span
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[11px] font-bold tabular-nums"
                      style={activo ? { background: ORO, color: "#0B0F14" } : { background: "rgba(255,255,255,.08)", color: "#fff" }}
                    >
                      {activo && reproduciendo ? <Play size={12} fill="currentColor" /> : i + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate text-[13px] font-semibold text-white ${v === null ? "line-through opacity-60" : ""}`}>{p.objetivo}</span>
                      <span className="block truncate text-[11px] text-white/55">
                        {[p.fecha !== fechaEditable ? p.fecha.split("-").reverse().slice(0, 2).join("/") : null, mmss(p.accion.inicio), p.accion.jugador, p.accion.explicacion].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    {p.accion.clip ? <Film size={13} className="shrink-0" style={{ color: ORO }} aria-label="Con clip" /> : null}
                  </button>
                </li>
              );
            })}
          </ol>
        </aside>
      )}
    </div>
  );
}

function BotonCorto({ texto, tecla, icono, color, activo, onClick }: { texto: string; tecla: string; icono: React.ReactNode; color: string; activo: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.currentTarget.blur();
        onClick();
      }}
      aria-pressed={activo}
      aria-keyshortcuts={tecla}
      title={activo ? "Quitar la validación" : `${texto} (${tecla})`}
      className="inline-flex min-h-10 items-center justify-center gap-1 rounded-lg px-1 text-[11px] font-semibold text-white transition"
      style={activo ? { background: color, border: `1px solid ${color}` } : { border: "1px solid rgba(255,255,255,.14)", color: "rgba(255,255,255,.8)" }}
    >
      {icono}
      {texto}
    </button>
  );
}
