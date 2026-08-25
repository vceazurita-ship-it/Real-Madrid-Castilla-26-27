"use client";

import { useId } from "react";

import { heatBlobs, HEAT_GRASS, HEAT_STOPS } from "@/lib/rivals/heatmap";

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
| Las manchas y el degradado viven en `lib/rivals/heatmap.ts`: el PDF del once
| pinta el mismo mapa con jsPDF y tiene que salirle la misma zona.
|
| El campo va en vertical y el jugador ataca hacia arriba, como el campograma
| de la página: y=0 es la portería rival y y=1 la propia.
*/

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

  const blobs = heatBlobs(slot, side);

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
            <stop offset="0%" stopColor={HEAT_GRASS.borde} />
            <stop offset="50%" stopColor={HEAT_GRASS.centro} />
            <stop offset="100%" stopColor={HEAT_GRASS.borde} />
          </linearGradient>

          <radialGradient id={heatId}>
            {HEAT_STOPS.map((stop) => (
              <stop
                key={stop.offset}
                offset={`${stop.offset * 100}%`}
                stopColor={stop.color}
                stopOpacity={stop.opacity}
              />
            ))}
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
