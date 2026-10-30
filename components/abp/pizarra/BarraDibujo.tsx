"use client";

/**
 * La barra de encima del tablero: con qué se dibuja, en qué fase, deshacer,
 * reproducir y proyectar.
 *
 * Va pegada al tablero —no en un panel aparte— porque es lo que se usa con la
 * mano en el ratón: elegir «carrera», dibujar tres, pasar a «balón», dibujar
 * el envío. Cada herramienta tiene su tecla (V, C, B, L) y la fase, la suya
 * (1, 2, 3); las teclas las atiende la página, aquí sólo se enseñan.
 */

import {
  CircleDot,
  Footprints,
  MousePointer2,
  Pause,
  Play,
  Presentation,
  Redo2,
  Shield,
  Spline,
  Trash2,
  Undo2,
  Volleyball,
} from "lucide-react";
import type { ComponentType } from "react";

import {
  FASES,
  TIPOS_TRAZO,
  esCurvo,
  type FaseTrazo,
  type TipoTrazo,
  type RivalPizarra,
  type TrazoPizarra,
} from "@/lib/abp/trazos";
import { ESTILO_TRAZO } from "@/components/abp/pizarra/CapaTrazos";

export type Herramienta = "mover" | "rival" | TipoTrazo;

const ICONO: Record<Herramienta, ComponentType<{ size?: number; className?: string }>> = {
  mover: MousePointer2,
  carrera: Footprints,
  balon: Volleyball,
  bloqueo: Shield,
  rival: CircleDot,
};

export const TECLA_HERRAMIENTA: Record<Herramienta, string> = {
  mover: "V",
  carrera: "C",
  balon: "B",
  bloqueo: "L",
  rival: "R",
};

const HERRAMIENTAS: { key: Herramienta; label: string; ayuda: string }[] = [
  { key: "mover", label: "Mover", ayuda: "Arrastrar caras y elegir flechas" },
  ...TIPOS_TRAZO,
  { key: "rival", label: "Rival", ayuda: "Plantar un defensor o el portero rival" },
];

function Tecla({ children }: { children: string }) {
  return (
    <kbd className="ml-1 hidden rounded border border-white/15 px-1 font-sans text-[9px] leading-[14px] text-white/40 sm:inline-block">
      {children}
    </kbd>
  );
}

/* En el móvil, 44 px de toque (30/10/2026, expertos). */
const BOTON =
  "inline-flex min-h-9 max-sm:min-h-11 shrink-0 items-center gap-1.5 rounded-xl border px-2.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40";

const APAGADO = "border-white/10 text-white/65 hover:border-white/25 hover:text-white";

const ENCENDIDO = "border-[#C8A96B] bg-[#C8A96B]/15 text-white";

export function BarraDibujo({
  herramienta,
  onHerramienta,
  fase,
  onFase,
  elegido,
  onCambiarElegido,
  onBorrarElegido,
  puedeDeshacer,
  puedeRehacer,
  onDeshacer,
  onRehacer,
  fases,
  reproduciendo,
  onReproducir,
  onParar,
  onProyectar,
  trazos,
  rival,
  onDorsalRival,
  onBorrarRival,
}: {
  herramienta: Herramienta;
  onHerramienta: (herramienta: Herramienta) => void;
  fase: FaseTrazo;
  onFase: (fase: FaseTrazo) => void;
  elegido: TrazoPizarra | null;
  onCambiarElegido: (cambio: Partial<TrazoPizarra>) => void;
  onBorrarElegido: () => void;
  puedeDeshacer: boolean;
  puedeRehacer: boolean;
  onDeshacer: () => void;
  onRehacer: () => void;
  /** Cuántas fases tiene la diapositiva (0 = ningún trazo). */
  fases: number;
  reproduciendo: boolean;
  onReproducir: () => void;
  onParar: () => void;
  onProyectar: () => void;
  trazos: number;
  /** El rival elegido en el campo, si hay uno. */
  rival: RivalPizarra | null;
  onDorsalRival: (dorsal: string) => void;
  onBorrarRival: () => void;
}) {
  /* Con un trazo elegido, la fase y el tipo son los SUYOS: cambiar el botón
     le cambia a él, que es lo que espera quien acaba de pincharlo. */
  const faseVista = elegido?.fase ?? fase;

  return (
    <div className="flex min-w-0 flex-col gap-2 border-b border-white/10 bg-white/[0.03] px-3 py-2.5">
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <div role="radiogroup" aria-label="Herramienta" className="flex flex-wrap gap-1">
          {HERRAMIENTAS.map((item) => {
            const Icono = ICONO[item.key];
            const activa = herramienta === item.key;
            const color =
              item.key === "mover"
                ? undefined
                : item.key === "rival"
                  ? "#A8323E"
                  : ESTILO_TRAZO[item.key].color;
            /* Con una flecha elegida, los tipos de flecha la cambian a ella. */
            const cambiaFlecha = Boolean(elegido) && item.key !== "mover" && item.key !== "rival";

            return (
              <button
                key={item.key}
                type="button"
                role="radio"
                aria-checked={activa}
                onClick={() => {
                  if (cambiaFlecha) {
                    onCambiarElegido({ tipo: item.key as TipoTrazo });
                    return;
                  }

                  onHerramienta(item.key);
                }}
                title={`${item.label} (${TECLA_HERRAMIENTA[item.key]}) — ${item.ayuda}${
                  cambiaFlecha ? " · cambia la flecha elegida" : ""
                }`}
                className={`${BOTON} ${
                  activa || (elegido && elegido.tipo === item.key) ? ENCENDIDO : APAGADO
                }`}
              >
                <Icono size={14} />
                {/* La muestra del color: lo que se verá en el campo. */}
                {color && (
                  <span
                    aria-hidden
                    className="h-[3px] w-3 rounded-full"
                    style={{ backgroundColor: color, boxShadow: "0 0 0 1px rgba(8,21,36,.5)" }}
                  />
                )}
                <span>{item.label}</span>
                <Tecla>{TECLA_HERRAMIENTA[item.key]}</Tecla>
              </button>
            );
          })}
        </div>

        <span aria-hidden className="mx-1 hidden h-6 w-px bg-white/10 sm:block" />

        <div role="radiogroup" aria-label="Fase" className="flex items-center gap-1">
          <span className="mr-0.5 text-[10px] uppercase tracking-[0.16em] text-white/40">
            Fase
          </span>

          {FASES.map((uno) => (
            <button
              key={uno}
              type="button"
              role="radio"
              aria-checked={faseVista === uno}
              onClick={() => (elegido ? onCambiarElegido({ fase: uno }) : onFase(uno))}
              title={
                elegido
                  ? `Pasar la flecha elegida a la fase ${uno}`
                  : `Lo que dibujes ahora va en la fase ${uno} (tecla ${uno})`
              }
              className={`${BOTON} w-9 max-sm:w-11 justify-center px-0 tabular-nums ${
                faseVista === uno ? ENCENDIDO : APAGADO
              }`}
            >
              {uno}
            </button>
          ))}
        </div>

        <span aria-hidden className="mx-1 hidden h-6 w-px bg-white/10 sm:block" />

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onDeshacer}
            disabled={!puedeDeshacer}
            aria-label="Deshacer"
            title="Deshacer (Ctrl+Z)"
            className={`${BOTON} ${APAGADO}`}
          >
            <Undo2 size={14} />
          </button>

          <button
            type="button"
            onClick={onRehacer}
            disabled={!puedeRehacer}
            aria-label="Rehacer"
            title="Rehacer (Ctrl+Mayús+Z)"
            className={`${BOTON} ${APAGADO}`}
          >
            <Redo2 size={14} />
          </button>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={reproduciendo ? onParar : onReproducir}
            disabled={fases === 0}
            title={
              fases === 0
                ? "Dibuja alguna carrera o el balón para poder reproducir la jugada"
                : reproduciendo
                  ? "Parar y volver a la foto fija (Espacio)"
                  : `Reproducir las ${fases} ${fases === 1 ? "fase" : "fases"} (Espacio)`
            }
            className={`${BOTON} ${reproduciendo ? ENCENDIDO : APAGADO}`}
          >
            {reproduciendo ? <Pause size={14} /> : <Play size={14} />}
            {reproduciendo ? "Parar" : "Reproducir"}
          </button>

          <button
            type="button"
            onClick={onProyectar}
            title="Pantalla completa para la sala: flechas para pasar, espacio para la fase siguiente (P)"
            className={`${BOTON} border-[#C8A96B]/60 text-white hover:border-[#C8A96B]`}
          >
            <Presentation size={14} />
            Proyectar
          </button>
        </div>
      </div>

      {/* La segunda línea dice qué hacer ahora, o qué se puede hacer con lo elegido. */}
      <div className="flex min-h-7 min-w-0 flex-wrap items-center gap-2 text-[11px] leading-snug text-white/45">
        {rival ? (
          <>
            <span className="font-semibold text-white/75">Rival</span>

            <label className="inline-flex items-center gap-1.5">
              <span>Dorsal</span>
              <input
                value={rival.dorsal ?? ""}
                onChange={(event) => onDorsalRival(event.target.value.slice(0, 3))}
                placeholder="—"
                aria-label="Dorsal del rival"
                className="h-7 w-14 rounded-lg border border-white/15 bg-white/[0.04] px-2 text-center text-xs text-white outline-none focus:border-[#C8A96B]/60"
              />
            </label>

            <span className="hidden sm:inline">Arrástralo para colocarlo. «P» para el portero.</span>

            <button
              type="button"
              onClick={onBorrarRival}
              title="Quitar al rival (Supr)"
              className={`${BOTON} min-h-7 border-red-400/30 text-red-300/80 hover:border-red-400/60 hover:text-red-300`}
            >
              <Trash2 size={13} />
              Quitar
            </button>
          </>
        ) : herramienta === "rival" ? (
          <span>
            Pulsa en el campo para plantar un rival —el que defiende la zona, al que se bloquea, el portero— y luego arrástralo con «Mover». Su dorsal se escribe al elegirlo.
          </span>
        ) : elegido ? (
          <>
            <span className="font-semibold text-white/75">
              {TIPOS_TRAZO.find((item) => item.key === elegido.tipo)?.label} · fase {elegido.fase}
            </span>
            <span className="hidden sm:inline">
              Arrastra los círculos para mover la punta, el arranque o la curva.
            </span>

            {esCurvo(elegido) && (
              <button
                type="button"
                onClick={() => onCambiarElegido({ cx: undefined, cy: undefined })}
                className={`${BOTON} min-h-7 ${APAGADO}`}
              >
                <Spline size={13} />
                Enderezar
              </button>
            )}

            <button
              type="button"
              onClick={onBorrarElegido}
              title="Borrar la flecha (Supr)"
              className={`${BOTON} min-h-7 border-red-400/30 text-red-300/80 hover:border-red-400/60 hover:text-red-300`}
            >
              <Trash2 size={13} />
              Borrar
            </button>
          </>
        ) : herramienta === "mover" ? (
          <span>
            {trazos > 0
              ? `${trazos} ${trazos === 1 ? "flecha" : "flechas"} en esta diapositiva · pincha una para editarla. Arrastra las caras: se alinean solas con las de su fila (Alt para soltarlas).`
              : "Elige Carrera, Balón o Bloqueo y dibuja sobre el campo: pulsa en el jugador y suelta donde acaba. Flechas del teclado para afinar la cara elegida."}
          </span>
        ) : (
          <span>
            Pulsa sobre un jugador —la flecha sale de sus pies— o en cualquier punto, y suelta donde acaba.
            Una flecha que empieza en la punta de otra se encadena: así se dibuja «bloquea y sale».
          </span>
        )}
      </div>
    </div>
  );
}
