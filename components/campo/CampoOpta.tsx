"use client";

/**
 * EL CAMPO CON COORDENADAS DE OPTA (09/11/2026).
 *
 * El hermano de `CampoZonas`: el mismo césped, las mismas líneas y las mismas
 * medidas de reglamento (105 × 68 m, en decímetros), pero los puntos van donde
 * dice Opta y no repartidos por cajón. Lo usan los mapas de remate, el balón
 * parado evento a evento, la red de pases y las recuperaciones del área Opta y
 * del laboratorio de ABP.
 *
 * Coordenadas de Opta: x 0-100 hacia la portería rival, y 0-100 con 0 en la
 * banda DERECHA del que ataca. Siempre se dibuja desde quien ataca:
 *
 * - **horizontal** (por defecto): ataca hacia la derecha; su banda izquierda,
 *   arriba.
 * - **vertical**: ataca hacia arriba; su izquierda a la izquierda (como se ve
 *   desde detrás de la portería propia). Con `mitad`, sólo el campo rival.
 *
 * Quien lo monta dibuja sus puntos con `proyecta(x, y)`, que devuelve el
 * sitio en el lienzo (1 m = 10 unidades). El césped es oscuro en los dos
 * temas (es un campo, no interfaz): sus colores van en `style`, que la tabla
 * del modo día no traduce.
 */

import { useId, type ReactNode } from "react";

export type Proyecta = (x: number, y: number) => [number, number];

const ANCHO = 1050;
const ALTO = 680;
const MEDIO = ALTO / 2;
const AREA_FONDO = 165;
const AREA_ANCHO = 403;
const CHICA_FONDO = 55;
const CHICA_ANCHO = 183;
const PUNTO_PENAL = 110;
const RADIO_CENTRAL = 91.5;
const CORTE = Math.sqrt(RADIO_CENTRAL ** 2 - (AREA_FONDO - PUNTO_PENAL) ** 2);

const LINEA = "rgba(255,255,255,0.3)";
const MARGEN = 22;

/** Opta → lienzo horizontal (ataca a la derecha). */
const horizontal: Proyecta = (x, y) => [(x / 100) * ANCHO, ((100 - y) / 100) * ALTO];
/** Opta → lienzo vertical (ataca hacia arriba). */
const vertical: Proyecta = (x, y) => [((100 - y) / 100) * ALTO, ((100 - x) / 100) * ANCHO];

export function CampoOpta({
  vertical: enVertical = false,
  mitad = false,
  ariaLabel,
  children,
  className = "",
  maxAlto,
}: {
  vertical?: boolean;
  /** Sólo el campo rival (x ≥ 50). */
  mitad?: boolean;
  ariaLabel: string;
  children: (proyecta: Proyecta) => ReactNode;
  className?: string;
  /** Alto máximo en píxeles del dibujo (el ancho sale de la proporción). */
  maxAlto?: number;
}) {
  const id = useId().replace(/:/g, "");
  const proyecta = enVertical ? vertical : horizontal;

  /* La caja visible, en unidades del lienzo. */
  const ancho = enVertical ? ALTO : mitad ? ANCHO / 2 : ANCHO;
  const alto = enVertical ? (mitad ? ANCHO / 2 : ANCHO) : ALTO;
  const x0 = !enVertical && mitad ? ANCHO / 2 : 0;
  const caja = `${x0 - MARGEN} ${-MARGEN} ${ancho + MARGEN * 2} ${alto + MARGEN * 2}`;
  /* Las líneas se dibujan siempre en horizontal y se giran si toca. */
  const giro = enVertical ? `matrix(0,-1,1,0,0,${ANCHO})` : undefined;

  return (
    <svg
      viewBox={caja}
      role="img"
      aria-label={ariaLabel}
      className={`mx-auto block h-auto w-full ${className}`}
      style={maxAlto ? { maxWidth: `${(maxAlto * (ancho + MARGEN * 2)) / (alto + MARGEN * 2)}px` } : undefined}
    >
      <defs>
        <linearGradient id={`cesped-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" style={{ stopColor: "#12301F" }} />
          <stop offset="100%" style={{ stopColor: "#0A1D13" }} />
        </linearGradient>
        <clipPath id={`recorte-${id}`}>
          <rect x={x0 - MARGEN} y={-MARGEN} width={ancho + MARGEN * 2} height={alto + MARGEN * 2} />
        </clipPath>
      </defs>
      <rect x={x0 - MARGEN} y={-MARGEN} width={ancho + MARGEN * 2} height={alto + MARGEN * 2} rx={14} style={{ fill: "#0A1A12" }} />
      <g clipPath={`url(#recorte-${id})`}>
        <g transform={giro}>
          <rect x={0} y={0} width={ANCHO} height={ALTO} style={{ fill: `url(#cesped-${id})` }} />
          {Array.from({ length: 6 }).map((_, i) => (
            <rect key={i} x={(ANCHO / 6) * i} y={0} width={ANCHO / 6} height={ALTO} style={{ fill: i % 2 === 0 ? "rgba(255,255,255,0.022)" : "transparent" }} />
          ))}
          <g style={{ fill: "none", stroke: LINEA, strokeWidth: 3, pointerEvents: "none" }}>
            <rect x={0} y={0} width={ANCHO} height={ALTO} />
            <line x1={ANCHO / 2} y1={0} x2={ANCHO / 2} y2={ALTO} />
            <circle cx={ANCHO / 2} cy={MEDIO} r={RADIO_CENTRAL} />
            <rect x={0} y={MEDIO - AREA_ANCHO / 2} width={AREA_FONDO} height={AREA_ANCHO} />
            <rect x={ANCHO - AREA_FONDO} y={MEDIO - AREA_ANCHO / 2} width={AREA_FONDO} height={AREA_ANCHO} />
            <rect x={0} y={MEDIO - CHICA_ANCHO / 2} width={CHICA_FONDO} height={CHICA_ANCHO} />
            <rect x={ANCHO - CHICA_FONDO} y={MEDIO - CHICA_ANCHO / 2} width={CHICA_FONDO} height={CHICA_ANCHO} />
            <path d={`M ${AREA_FONDO} ${MEDIO - CORTE} A ${RADIO_CENTRAL} ${RADIO_CENTRAL} 0 0 1 ${AREA_FONDO} ${MEDIO + CORTE}`} />
            <path d={`M ${ANCHO - AREA_FONDO} ${MEDIO - CORTE} A ${RADIO_CENTRAL} ${RADIO_CENTRAL} 0 0 0 ${ANCHO - AREA_FONDO} ${MEDIO + CORTE}`} />
            <path d={`M 0 10 A 10 10 0 0 0 10 0`} />
            <path d={`M ${ANCHO - 10} 0 A 10 10 0 0 0 ${ANCHO} 10`} />
            <path d={`M 0 ${ALTO - 10} A 10 10 0 0 1 10 ${ALTO}`} />
            <path d={`M ${ANCHO - 10} ${ALTO} A 10 10 0 0 1 ${ANCHO} ${ALTO - 10}`} />
          </g>
          <g style={{ fill: LINEA, pointerEvents: "none" }}>
            <circle cx={ANCHO / 2} cy={MEDIO} r={6} />
            <circle cx={PUNTO_PENAL} cy={MEDIO} r={6} />
            <circle cx={ANCHO - PUNTO_PENAL} cy={MEDIO} r={6} />
          </g>
          <g style={{ fill: "rgba(255,255,255,0.10)", stroke: LINEA, strokeWidth: 3, pointerEvents: "none" }}>
            <rect x={-14} y={MEDIO - 36.6} width={14} height={73.2} />
            <rect x={ANCHO} y={MEDIO - 36.6} width={14} height={73.2} />
          </g>
        </g>
        {children(proyecta)}
      </g>
    </svg>
  );
}

/** Colores de los puntos sobre el césped (oscuro en los dos temas). */
export const SOBRE_CESPED = {
  gol: "#F2C94C",
  puerta: "#5DA9FF",
  palo: "#F2994A",
  fuera: "rgba(255,255,255,0.55)",
  nuestro: "#F2C94C",
  rival: "#FF7A7A",
  verde: "#3DDC97",
  tenue: "rgba(255,255,255,0.35)",
} as const;
