"use client";

import { useId } from "react";

/*
|--------------------------------------------------------------------------
| MAPA DE CALOR POR POSICIÓN
|--------------------------------------------------------------------------
|
| No hay datos de seguimiento de los rivales, así que el mapa **no** se mide:
| se deduce de la posición de la ficha. Es un dibujo de la zona en la que se
| espera al jugador, no un registro de dónde estuvo, y por eso la leyenda lo
| dice en voz alta. Sirve para lo que se usa en la pizarra —ubicar de un
| vistazo por dónde va a aparecer— sin prometer una precisión que no tiene.
|
| El campo va en vertical y el jugador ataca hacia arriba, como el campograma
| de la página: y=0 es la portería rival y y=1 la propia.
*/

/** Mancha de calor en coordenadas relativas al campo. */
type Blob = {
  x: number;
  y: number;
  /** Radios, también relativos: el campo es más alto que ancho. */
  rx: number;
  ry: number;
  /** Cuánto pesa esta mancha (0-1). */
  w: number;
};

const FLANK = 0.155;

/*
| Zonas por slot de posición. Las claves son las de `LINE_DEFINITIONS` en
| `app/rivals/page.tsx`; el orden de las manchas no importa porque se suman.
|
| Las manchas se **solapan a propósito**: con radios cortos el resultado eran
| tres burbujas sueltas en vez de un pasillo. La regla es que el radio pase de
| la mitad de la distancia a la mancha vecina.
*/
const ZONES: Record<string, Blob[]> = {
  por: [
    { x: 0.5, y: 0.94, rx: 0.3, ry: 0.1, w: 1 },
    { x: 0.5, y: 0.85, rx: 0.4, ry: 0.11, w: 0.5 },
  ],

  ld: [
    { x: 1 - FLANK, y: 0.79, rx: 0.28, ry: 0.15, w: 1 },
    { x: 1 - FLANK, y: 0.62, rx: 0.27, ry: 0.15, w: 0.78 },
    { x: 1 - FLANK, y: 0.45, rx: 0.26, ry: 0.15, w: 0.5 },
    { x: 0.62, y: 0.85, rx: 0.24, ry: 0.12, w: 0.35 },
  ],

  li: [
    { x: FLANK, y: 0.79, rx: 0.28, ry: 0.15, w: 1 },
    { x: FLANK, y: 0.62, rx: 0.27, ry: 0.15, w: 0.78 },
    { x: FLANK, y: 0.45, rx: 0.26, ry: 0.15, w: 0.5 },
    { x: 0.38, y: 0.85, rx: 0.24, ry: 0.12, w: 0.35 },
  ],

  dfc: [
    { x: 0.36, y: 0.83, rx: 0.3, ry: 0.14, w: 1 },
    { x: 0.64, y: 0.83, rx: 0.3, ry: 0.14, w: 1 },
    { x: 0.5, y: 0.71, rx: 0.34, ry: 0.13, w: 0.6 },
    { x: 0.5, y: 0.93, rx: 0.3, ry: 0.1, w: 0.45 },
  ],

  def: [
    { x: 0.5, y: 0.83, rx: 0.44, ry: 0.16, w: 1 },
    { x: 0.5, y: 0.68, rx: 0.4, ry: 0.14, w: 0.55 },
  ],

  car: [
    { x: 1 - FLANK, y: 0.7, rx: 0.28, ry: 0.18, w: 1 },
    { x: 1 - FLANK, y: 0.48, rx: 0.27, ry: 0.16, w: 0.65 },
    { x: 1 - FLANK, y: 0.87, rx: 0.27, ry: 0.13, w: 0.6 },
  ],

  mcd: [
    { x: 0.5, y: 0.66, rx: 0.34, ry: 0.15, w: 1 },
    { x: 0.32, y: 0.73, rx: 0.27, ry: 0.14, w: 0.6 },
    { x: 0.68, y: 0.73, rx: 0.27, ry: 0.14, w: 0.6 },
    { x: 0.5, y: 0.53, rx: 0.3, ry: 0.14, w: 0.5 },
  ],

  mc: [
    { x: 0.5, y: 0.52, rx: 0.35, ry: 0.17, w: 1 },
    { x: 0.3, y: 0.59, rx: 0.28, ry: 0.15, w: 0.6 },
    { x: 0.7, y: 0.59, rx: 0.28, ry: 0.15, w: 0.6 },
    { x: 0.5, y: 0.38, rx: 0.3, ry: 0.14, w: 0.55 },
  ],

  /* "MEDIO" a secas: lo mismo que un mediocentro, pero más repartido — la
     hoja lo usa cuando no consta si es de contención o de creación. */
  med: [
    { x: 0.5, y: 0.54, rx: 0.4, ry: 0.2, w: 1 },
    { x: 0.28, y: 0.6, rx: 0.28, ry: 0.16, w: 0.55 },
    { x: 0.72, y: 0.6, rx: 0.28, ry: 0.16, w: 0.55 },
  ],

  int: [
    { x: 0.31, y: 0.47, rx: 0.3, ry: 0.18, w: 1 },
    { x: 0.69, y: 0.47, rx: 0.3, ry: 0.18, w: 1 },
    { x: 0.5, y: 0.58, rx: 0.3, ry: 0.14, w: 0.45 },
    { x: 0.5, y: 0.34, rx: 0.28, ry: 0.13, w: 0.4 },
  ],

  mp: [
    { x: 0.5, y: 0.34, rx: 0.33, ry: 0.16, w: 1 },
    { x: 0.32, y: 0.41, rx: 0.27, ry: 0.14, w: 0.55 },
    { x: 0.68, y: 0.41, rx: 0.27, ry: 0.14, w: 0.55 },
    { x: 0.5, y: 0.21, rx: 0.28, ry: 0.13, w: 0.5 },
  ],

  ed: [
    { x: 1 - FLANK, y: 0.3, rx: 0.27, ry: 0.17, w: 1 },
    { x: 1 - FLANK, y: 0.48, rx: 0.26, ry: 0.16, w: 0.65 },
    { x: 0.64, y: 0.16, rx: 0.26, ry: 0.13, w: 0.55 },
  ],

  ei: [
    { x: FLANK, y: 0.3, rx: 0.27, ry: 0.17, w: 1 },
    { x: FLANK, y: 0.48, rx: 0.26, ry: 0.16, w: 0.65 },
    { x: 0.36, y: 0.16, rx: 0.26, ry: 0.13, w: 0.55 },
  ],

  ext: [
    { x: FLANK, y: 0.31, rx: 0.27, ry: 0.18, w: 1 },
    { x: 1 - FLANK, y: 0.31, rx: 0.27, ry: 0.18, w: 1 },
    { x: 0.5, y: 0.18, rx: 0.3, ry: 0.13, w: 0.4 },
  ],

  sd: [
    { x: 0.5, y: 0.2, rx: 0.32, ry: 0.15, w: 1 },
    { x: 0.34, y: 0.29, rx: 0.27, ry: 0.14, w: 0.6 },
    { x: 0.66, y: 0.29, rx: 0.27, ry: 0.14, w: 0.6 },
  ],

  dc: [
    { x: 0.5, y: 0.11, rx: 0.32, ry: 0.13, w: 1 },
    { x: 0.5, y: 0.23, rx: 0.34, ry: 0.14, w: 0.75 },
    { x: 0.3, y: 0.18, rx: 0.25, ry: 0.13, w: 0.45 },
    { x: 0.7, y: 0.18, rx: 0.25, ry: 0.13, w: 0.45 },
  ],
};

/** Sin posición reconocible: una mancha ancha en el centro, sin inventar. */
const FALLBACK: Blob[] = [{ x: 0.5, y: 0.55, rx: 0.42, ry: 0.22, w: 0.8 }];

/*
| Slots que existen en las dos bandas. Cuando la posición de la hoja dice
| "central derecho" o "extremo izquierdo" y el slot no lo distingue, la mancha
| se corre hacia esa banda en lugar de quedarse simétrica.
*/
const SIDED = new Set(["dfc", "def", "car", "mc", "med", "int", "mp", "ext", "sd", "dc"]);

function applySide(blobs: Blob[], slot: string, side: -1 | 0 | 1) {
  if (!side || !SIDED.has(slot)) return blobs;

  /* La banda contraria se apaga y el conjunto se desplaza hacia la suya. */
  return blobs
    .map((blob) => {
      const offset = (blob.x - 0.5) * side;

      return {
        ...blob,
        x: Math.min(0.9, Math.max(0.1, blob.x + 0.13 * side)),
        w: offset < -0.05 ? blob.w * 0.3 : blob.w,
      };
    })
    .filter((blob) => blob.w > 0.05);
}

export function PositionHeatmap({
  slot,
  side = 0,
  label,
  className = "",
}: {
  /** Clave de slot (`por`, `ld`, `dfc`, `mc`, `ed`…). */
  slot: string | null;
  /** -1 izquierda, 1 derecha, 0 sin lado. */
  side?: -1 | 0 | 1;
  /** Texto de la esquina: normalmente el código de posición. */
  label?: string;
  className?: string;
}) {
  /* Los ids de `<defs>` son globales al documento: con dos mapas en pantalla
     (ficha y campograma) uno fijo haría que el segundo pintara el degradado
     del primero. */
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");

  const heatId = `heat-${uid}`;
  const grassId = `grass-${uid}`;
  const clipId = `pitch-${uid}`;

  const blobs = applySide(
    (slot && ZONES[slot]) || FALLBACK,
    slot ?? "",
    side,
  );

  /* Campo de 100 × 150: las medidas de abajo son las de un campo real
     llevadas a esa escala (área grande 40 % del ancho, etc.). */
  const W = 100;
  const H = 150;

  const line = "rgba(255,255,255,0.28)";

  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-white/10 ${className}`}
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block h-full w-full"
        role="img"
        aria-label={`Zona de influencia${label ? ` de ${label}` : ""}`}
      >
        <defs>
          <linearGradient id={grassId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#123528" />
            <stop offset="50%" stopColor="#16402f" />
            <stop offset="100%" stopColor="#123528" />
          </linearGradient>

          <radialGradient id={heatId}>
            <stop offset="0%" stopColor="#FF2D00" stopOpacity="0.92" />
            <stop offset="32%" stopColor="#FF7A00" stopOpacity="0.66" />
            <stop offset="58%" stopColor="#F2D218" stopOpacity="0.4" />
            <stop offset="80%" stopColor="#5BE37A" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#2BC4E8" stopOpacity="0" />
          </radialGradient>

          {/* El calor no puede salirse del campo: fuera de la línea de banda
              no se juega, y sin recortar las manchas de banda se derramaban
              por el borde y parecían más anchas de lo que son. */}
          <clipPath id={clipId}>
            <rect x="2" y="2" width={W - 4} height={H - 4} />
          </clipPath>
        </defs>

        <rect width={W} height={H} fill={`url(#${grassId})`} />

        {/* Franjas de césped: dan escala sin competir con el calor. */}
        {[0, 2, 4, 6, 8].map((band) => (
          <rect
            key={band}
            x="0"
            y={(band * H) / 10}
            width={W}
            height={H / 10}
            fill="rgba(255,255,255,0.022)"
          />
        ))}

        {/* CALOR — se suma en pantalla, así que dos manchas juntas queman más */}

        <g clipPath={`url(#${clipId})`} style={{ mixBlendMode: "screen" }}>
          {blobs.map((blob, index) => (
            <ellipse
              key={index}
              cx={blob.x * W}
              cy={blob.y * H}
              rx={blob.rx * W}
              ry={blob.ry * H}
              fill={`url(#${heatId})`}
              opacity={blob.w}
            />
          ))}
        </g>

        {/* LÍNEAS DEL CAMPO — encima del calor para no perder la referencia */}

        <g fill="none" stroke={line} strokeWidth="0.8">
          <rect x="2" y="2" width={W - 4} height={H - 4} />

          <line x1="2" y1={H / 2} x2={W - 2} y2={H / 2} />

          <circle cx={W / 2} cy={H / 2} r="12" />

          {/* Áreas grande y pequeña, arriba y abajo. */}
          <rect x="20" y="2" width="60" height="20" />
          <rect x="34" y="2" width="32" height="8" />
          <rect x="20" y={H - 22} width="60" height="20" />
          <rect x="34" y={H - 10} width="32" height="8" />
        </g>

        <g fill={line}>
          <circle cx={W / 2} cy={H / 2} r="1.1" />
          <circle cx={W / 2} cy="14" r="1.1" />
          <circle cx={W / 2} cy={H - 14} r="1.1" />
        </g>

        {/* Sentido del ataque: sin esto el campo se lee al revés. */}
        <g
          fill="rgba(255,255,255,0.35)"
          transform={`translate(${W - 9}, 12)`}
        >
          <path d="M0 8 L3.2 1 L6.4 8 L3.2 6 Z" />
        </g>
      </svg>

      {label && (
        <span className="absolute left-2 top-2 rounded-md bg-black/55 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white/75 backdrop-blur-sm">
          {label}
        </span>
      )}
    </div>
  );
}

export default PositionHeatmap;
