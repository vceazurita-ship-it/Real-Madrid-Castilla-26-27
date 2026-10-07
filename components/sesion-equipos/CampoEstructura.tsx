/**
 * El mini campograma de un equipo con estructura (06/10/2026).
 *
 * Medio campo vertical, su portería abajo, cada jugador en su hueco con el
 * color del equipo. Sirve para la pantalla (se toca o se arrastra para cambiar
 * de sitio) y para la lámina exportada (grande, sin tocar). Todo en estilos en
 * línea con hex/rgba y las líneas en SVG: la lámina se captura con
 * `html-to-image`.
 *
 * REDISEÑO (07/10/2026): las líneas son las de un campo de verdad (área,
 * área pequeña, punto y semicírculo de penalti, portería y el medio círculo
 * central arriba), las fichas son más grandes y el nombre va en una etiqueta
 * que se lee sobre el césped. Y el césped entero es un sitio donde soltar
 * (`campoDestino`): quien se suelta en un punto vacío se queda en ese punto.
 */
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";

import type { Hueco } from "@/lib/sesion-equipos/estructura";
import { tintaSobre } from "@/lib/sesion-equipos/modelo";

/** Lo que mide la palabra más larga de un nombre, en letras: el nombre se parte sólo entre palabras. */
const palabraMasLarga = (nombre: string) => Math.max(3, ...nombre.split(/ +/).map((t) => t.length));

/** Proporción del medio campo que se dibuja: alto = ancho × esto. */
export const PROPORCION_CAMPO = 1.08;

/** Las líneas del medio campo, en un lienzo de 100 × 108. */
function Lineas({ trazo, grosor }: { trazo: string; grosor: number }) {
  const g = { fill: "none", stroke: trazo, strokeWidth: grosor, vectorEffect: "non-scaling-stroke" as const };
  return (
    <svg
      viewBox="0 0 100 108"
      preserveAspectRatio="none"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
      aria-hidden
    >
      {/* banda, fondo y la línea de medio campo arriba */}
      <rect x="4" y="3" width="92" height="101" {...g} strokeWidth={grosor} />
      {/* medio círculo central */}
      <path d="M 36 3 A 14 14 0 0 0 64 3" {...g} strokeWidth={grosor} />
      <circle cx="50" cy="3" r="0.9" fill={trazo} />
      {/* área grande y pequeña */}
      <rect x="22.5" y="72" width="55" height="32" {...g} strokeWidth={grosor} />
      <rect x="37.5" y="93.3" width="25" height="10.7" {...g} strokeWidth={grosor} />
      {/* punto y semicírculo de penalti */}
      <circle cx="50" cy="82.5" r="0.9" fill={trazo} />
      <path d="M 39.5 72 A 14.5 14.5 0 0 1 60.5 72" {...g} strokeWidth={grosor} />
      {/* portería */}
      <rect x="44.5" y="104" width="11" height="2.6" {...g} strokeWidth={grosor} />
      {/* córners */}
      <path d="M 4 101 A 3 3 0 0 1 7 104" {...g} strokeWidth={grosor} />
      <path d="M 93 104 A 3 3 0 0 1 96 101" {...g} strokeWidth={grosor} />
    </svg>
  );
}

export function CampoEstructura({
  huecos,
  color,
  ancho,
  claro = false,
  elegido = null,
  onToca,
  destinoDe,
  sobre = null,
  onArrastra,
  campoDestino,
  style,
}: {
  huecos: Hueco[];
  color: string;
  /** Ancho en píxeles; el alto sale de la proporción del medio campo. */
  ancho: number;
  /** Césped claro, para la lámina en fondo blanco. */
  claro?: boolean;
  /** El hueco tocado, a la espera del segundo para cambiarlos. */
  elegido?: number | null;
  onToca?: (indice: number) => void;
  /** El destino de cada hueco para soltar ahí a alguien que se arrastra («hueco:<equipo>:<n>»). */
  destinoDe?: (indice: number) => string;
  /** El destino que hay debajo del arrastre ahora mismo. */
  sobre?: string | null;
  /** Empieza a arrastrar al jugador de un hueco. */
  onArrastra?: (indice: number, e: ReactPointerEvent) => void;
  /** El destino del césped entero: soltar en un punto vacío deja al jugador ahí («campo:<equipo>»). */
  campoDestino?: string;
  style?: CSSProperties;
}) {
  const alto = ancho * PROPORCION_CAMPO;
  const ficha = Math.max(16, Math.min(50, ancho / 10));
  const letra = Math.max(9, Math.min(28, ancho / 21));
  const tinta = tintaSobre(color);
  const trazo = claro ? "rgba(20,83,45,0.42)" : "rgba(255,255,255,0.5)";
  const encimaCampo = Boolean(campoDestino && sobre === campoDestino);

  return (
    <div
      data-destino={campoDestino}
      data-campo-estructura={campoDestino ? "" : undefined}
      style={{
        position: "relative",
        width: ancho,
        height: alto,
        borderRadius: Math.max(10, ancho / 26),
        overflow: "hidden",
        background: claro
          ? "repeating-linear-gradient(180deg, #E9F5EC 0px, #E9F5EC 10%, #DDEFE2 10%, #DDEFE2 20%)"
          : "radial-gradient(120% 80% at 50% 100%, rgba(255,255,255,0.07), rgba(0,0,0,0) 60%), repeating-linear-gradient(180deg, #17663A 0px, #17663A 10%, #1B7543 10%, #1B7543 20%)",
        border: `2px solid ${encimaCampo ? "#C8A96B" : claro ? "rgba(20,83,45,0.25)" : "rgba(255,255,255,0.14)"}`,
        boxShadow: encimaCampo
          ? "0 0 0 4px rgba(200,169,107,0.35), inset 0 0 40px rgba(0,0,0,0.25)"
          : claro
            ? "none"
            : "inset 0 0 40px rgba(0,0,0,0.3), 0 10px 30px rgba(0,0,0,0.25)",
        flexShrink: 0,
        /* La letra estrecha de la lámina, también en la pantalla: caben nombres más grandes. */
        fontFamily: "var(--fuente-sesion, inherit)",
        transition: "box-shadow 120ms, border-color 120ms",
        ...style,
      }}
    >
      <Lineas trazo={trazo} grosor={Math.max(1.5, ancho / 220)} />

      {huecos.map((h, i) => {
        const es = elegido === i;
        const destino = destinoDe?.(i);
        const debajo = Boolean(destino && sobre === destino);
        /* Cada nombre cabe en su trozo de línea: con cuatro en fila, la cuarta parte del campo. */
        const enSuLinea = h.linea < 0 ? 3 : huecos.filter((x) => x.linea === h.linea && !x.aMano).length || 3;
        const anchoNombre = Math.min(ancho / 2.6, (ancho / (enSuLinea + 1)) * 1.1);
        const nombre = h.jugador?.nombre ?? "";
        const tamanoNombre = Math.max(8, Math.min(letra, anchoNombre / (palabraMasLarga(nombre || "—") * 0.5 + 0.9)));
        const esPortero = h.linea === 0 && huecos.filter((x) => x.linea === 0).length === 1;
        return (
          <div
            key={i}
            onClick={onToca ? () => onToca(i) : undefined}
            data-destino={destino}
            onPointerDown={onArrastra && h.jugador ? (e) => onArrastra(i, e) : undefined}
            style={{
              position: "absolute",
              left: `${h.x * 100}%`,
              top: `${h.y * 100}%`,
              transform: "translate(-50%, -50%)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              width: anchoNombre,
              /* Un blanco generoso para el dedo, aunque la ficha sea pequeña. */
              padding: onToca ? 4 : 0,
              cursor: onArrastra && h.jugador ? "grab" : onToca ? "pointer" : "default",
              touchAction: onArrastra && h.jugador ? "pan-y" : undefined,
              userSelect: "none",
              zIndex: es || debajo ? 3 : h.aMano ? 2 : 1,
            }}
            title={
              h.jugador
                ? `${h.jugador.nombre}${onToca ? " · arrástralo a cualquier punto, o toca otro para cambiarlos" : ""}`
                : onToca
                  ? "Hueco libre: suelta aquí a un jugador"
                  : "Hueco libre"
            }
          >
            <span
              style={{
                width: ficha,
                height: ficha,
                borderRadius: 999,
                background: h.jugador
                  ? `radial-gradient(circle at 35% 30%, rgba(255,255,255,0.35), rgba(255,255,255,0) 55%), ${color}`
                  : claro
                    ? "rgba(20,83,45,0.06)"
                    : "rgba(255,255,255,0.08)",
                border: h.jugador
                  ? `${Math.max(2, ficha / 16)}px solid ${es ? "#C8A96B" : claro ? "rgba(11,15,20,0.35)" : "#FFFFFF"}`
                  : `2px dashed ${claro ? "rgba(20,83,45,0.5)" : "rgba(255,255,255,0.6)"}`,
                boxShadow: es || debajo ? "0 0 0 4px #C8A96B" : h.jugador ? "0 3px 8px rgba(0,0,0,0.35)" : "none",
                transform: debajo ? "scale(1.22)" : undefined,
                transition: "transform 120ms, box-shadow 120ms",
                color: tinta,
                fontSize: ficha * 0.36,
                fontWeight: 700,
                letterSpacing: "0.04em",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {esPortero && h.jugador ? "POR" : ""}
            </span>
            <span
              style={{
                marginTop: Math.max(2, ficha / 12),
                maxWidth: "100%",
                /* Que la palabra más larga del nombre quepa entera en su línea. */
                fontSize: tamanoNombre,
                fontWeight: 700,
                lineHeight: 1.02,
                textTransform: "uppercase",
                textAlign: "center",
                /* El nombre entero, en dos líneas si hace falta: «JORGE / CESTERO». */
                whiteSpace: "normal",
                overflowWrap: "normal",
                color: h.jugador ? (claro ? "#0B0F14" : "#FFFFFF") : claro ? "rgba(11,15,20,0.4)" : "rgba(255,255,255,0.55)",
                background: h.jugador ? (claro ? "rgba(255,255,255,0.92)" : "rgba(6,12,9,0.62)") : "transparent",
                boxShadow: h.jugador && claro ? "0 1px 3px rgba(11,26,51,0.12)" : "none",
                borderRadius: Math.max(4, tamanoNombre / 3),
                padding: h.jugador ? `${Math.max(1, tamanoNombre / 8)}px ${Math.max(3, tamanoNombre / 3)}px` : 0,
              }}
            >
              {h.jugador ? nombre : onToca ? "libre" : "—"}
            </span>
          </div>
        );
      })}
    </div>
  );
}
