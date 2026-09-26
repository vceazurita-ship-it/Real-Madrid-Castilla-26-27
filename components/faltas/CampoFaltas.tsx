"use client";

/**
 * EL CAMPO DE LAS FALTAS.
 *
 * Antes esto era una rejilla de nueve casillas con un número dentro. Contaba
 * bien y no se entendía: nadie mira un partido en cuadrícula, y para saber si
 * una falta estaba en la frontal o en el círculo central había que leer el
 * rótulo de la casilla. Aquí se dibuja el campo —áreas, círculo, semicírculos,
 * porterías— y cada falta es un punto puesto en su tercio y su carril.
 *
 * **Qué es exacto y qué no.** El etiquetado guarda tercio y carril, no metros:
 * son nueve zonas, no coordenadas. Así que el punto no dice el sitio de la
 * falta, dice su zona; dentro de la zona se reparten en rejilla para que dos
 * faltas en el mismo cajón no se tapen. El reparto es siempre el mismo para el
 * mismo orden de faltas: no hay azar, y el campo de hoy es el de mañana.
 *
 * **Hacia dónde se mira.** El campo va en el sentido en que ataca QUIEN SACA la
 * falta: su portería a la izquierda, la que ataca a la derecha. De ahí que
 * «campo propio» sea el del que saca y no el nuestro, que es la confusión que
 * se lleva todo el mundo la primera vez. Y el carril izquierdo es el de arriba,
 * porque es el que queda a la izquierda de quien ataca hacia la derecha.
 */

import type { Falta, LadoFalta } from "@/lib/faltas/datos";

/* El campo en decímetros: 105 × 68 m. Todo lo demás sale de ahí. */
const ANCHO = 1050;
const ALTO = 680;

const TERCIO = ANCHO / 3;
const BANDA = ALTO / 3;

const MEDIO = ALTO / 2;

/* Las medidas de reglamento, en las mismas unidades. */
const AREA_FONDO = 165;
const AREA_ANCHO = 403;
const CHICA_FONDO = 55;
const CHICA_ANCHO = 183;
const PUNTO_PENAL = 110;
const RADIO_CENTRAL = 91.5;
/** Donde el semicírculo del área corta la línea del área grande. */
const CORTE = Math.sqrt(RADIO_CENTRAL ** 2 - (AREA_FONDO - PUNTO_PENAL) ** 2);

const LINEA = "rgba(255,255,255,0.26)";

export type CampoFaltasProps = {
  faltas: Falta[];
  zonas: string[];
  carriles: string[];
  tinta: Record<LadoFalta, string>;
  /** La falta que está resaltada, para atarla con la tabla de abajo. */
  resaltada: string | null;
  onResaltar: (clip: string | null) => void;
};

type Punto = { falta: Falta; x: number; y: number };

/**
 * Reparte las faltas de cada cajón por dentro del cajón.
 *
 * En rejilla y por orden: con once faltas en el mismo tercio, un punto por
 * falta en el centro del cajón sería un punto. Y como el orden de entrada no
 * cambia, tampoco cambia el dibujo.
 */
function coloca(faltas: Falta[], zonas: string[], carriles: string[]): Punto[] {
  const cajones = new Map<string, Falta[]>();

  for (const falta of faltas) {
    const zi = zonas.indexOf(falta.zona);
    const ci = carriles.indexOf(falta.carril);

    if (zi < 0 || ci < 0) continue;

    const clave = `${zi}|${ci}`;

    cajones.set(clave, [...(cajones.get(clave) ?? []), falta]);
  }

  const puntos: Punto[] = [];

  for (const [clave, suyas] of cajones) {
    const [zi, ci] = clave.split("|").map(Number);

    const cx = TERCIO * (zi + 0.5);
    const cy = BANDA * (ci + 0.5);

    const columnas = Math.ceil(Math.sqrt(suyas.length));
    const filas = Math.ceil(suyas.length / columnas);

    /* El paso se estrecha cuando hay muchas: nunca se sale del cajón. */
    const pasoX = (TERCIO * 0.62) / Math.max(1, columnas);
    const pasoY = (BANDA * 0.5) / Math.max(1, filas);

    suyas.forEach((falta, indice) => {
      const columna = indice % columnas;
      const fila = Math.floor(indice / columnas);

      puntos.push({
        falta,
        x: cx + (columna - (columnas - 1) / 2) * pasoX,
        y: cy + (fila - (filas - 1) / 2) * pasoY,
      });
    });
  }

  return puntos;
}

export function CampoFaltas({
  faltas,
  zonas,
  carriles,
  tinta,
  resaltada,
  onResaltar,
}: CampoFaltasProps) {
  const puntos = coloca(faltas, zonas, carriles);

  /* Cuántas hay en cada cajón, para el velo del fondo. */
  const porCajon = new Map<string, number>();

  for (const falta of faltas) {
    const zi = zonas.indexOf(falta.zona);
    const ci = carriles.indexOf(falta.carril);

    if (zi < 0 || ci < 0) continue;

    const clave = `${zi}|${ci}`;

    porCajon.set(clave, (porCajon.get(clave) ?? 0) + 1);
  }

  const tope = Math.max(1, ...porCajon.values());

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0A1A12]">
      {/*
        El margen no es simétrico a propósito: los rótulos de los carriles van
        FUERA del campo, a la izquierda. Dentro caían encima del área grande y
        de las líneas, y un campo con letras cruzadas por rayas blancas es
        exactamente lo que había que quitar de aquí.
      */}
      <svg
        viewBox={`-118 -34 ${ANCHO + 144} ${ALTO + 74}`}
        className="block w-full"
        role="img"
        aria-label="Campo con las faltas repartidas por tercio y carril"
      >
        <defs>
          <linearGradient id="faltas-cesped" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#12301F" />
            <stop offset="100%" stopColor="#0A1D13" />
          </linearGradient>
        </defs>

        <rect
          x={-118}
          y={-34}
          width={ANCHO + 144}
          height={ALTO + 74}
          fill="#0A1A12"
        />

        {/* El césped, sólo dentro de las líneas. */}
        <rect x={0} y={0} width={ANCHO} height={ALTO} fill="url(#faltas-cesped)" />

        {/* El corte del césped: seis franjas, como el de verdad. */}
        {Array.from({ length: 6 }).map((_, i) => (
          <rect
            key={i}
            x={(ANCHO / 6) * i}
            y={0}
            width={ANCHO / 6}
            height={ALTO}
            fill={i % 2 === 0 ? "rgba(255,255,255,0.022)" : "transparent"}
          />
        ))}

        {/* El velo que dice dónde se acumulan, por debajo de las líneas. */}
        {zonas.map((_, zi) =>
          carriles.map((__, ci) => {
            const cuantas = porCajon.get(`${zi}|${ci}`) ?? 0;

            if (cuantas === 0) return null;

            return (
              <rect
                key={`${zi}|${ci}`}
                x={TERCIO * zi}
                y={BANDA * ci}
                width={TERCIO}
                height={BANDA}
                fill={`rgba(200,169,107,${((cuantas / tope) * 0.2).toFixed(3)})`}
              />
            );
          }),
        )}

        {/* Las divisiones del etiquetado, muy tenues: son ayuda, no campo. */}
        <g stroke="rgba(200,169,107,0.16)" strokeWidth={1.6} strokeDasharray="10 12">
          <line x1={TERCIO} y1={0} x2={TERCIO} y2={ALTO} />
          <line x1={TERCIO * 2} y1={0} x2={TERCIO * 2} y2={ALTO} />
          <line x1={0} y1={BANDA} x2={ANCHO} y2={BANDA} />
          <line x1={0} y1={BANDA * 2} x2={ANCHO} y2={BANDA * 2} />
        </g>

        {/* ------------------------------- el campo ------------------ */}

        <g fill="none" stroke={LINEA} strokeWidth={3}>
          <rect x={0} y={0} width={ANCHO} height={ALTO} />

          <line x1={ANCHO / 2} y1={0} x2={ANCHO / 2} y2={ALTO} />
          <circle cx={ANCHO / 2} cy={MEDIO} r={RADIO_CENTRAL} />

          {/* Áreas grandes y pequeñas, las dos porterías. */}
          <rect
            x={0}
            y={MEDIO - AREA_ANCHO / 2}
            width={AREA_FONDO}
            height={AREA_ANCHO}
          />
          <rect
            x={ANCHO - AREA_FONDO}
            y={MEDIO - AREA_ANCHO / 2}
            width={AREA_FONDO}
            height={AREA_ANCHO}
          />
          <rect
            x={0}
            y={MEDIO - CHICA_ANCHO / 2}
            width={CHICA_FONDO}
            height={CHICA_ANCHO}
          />
          <rect
            x={ANCHO - CHICA_FONDO}
            y={MEDIO - CHICA_ANCHO / 2}
            width={CHICA_FONDO}
            height={CHICA_ANCHO}
          />

          {/* Los semicírculos, cortados justo en la línea del área. */}
          <path
            d={`M ${AREA_FONDO} ${MEDIO - CORTE} A ${RADIO_CENTRAL} ${RADIO_CENTRAL} 0 0 1 ${AREA_FONDO} ${MEDIO + CORTE}`}
          />
          <path
            d={`M ${ANCHO - AREA_FONDO} ${MEDIO - CORTE} A ${RADIO_CENTRAL} ${RADIO_CENTRAL} 0 0 0 ${ANCHO - AREA_FONDO} ${MEDIO + CORTE}`}
          />

          {/* Las esquinas. */}
          <path d={`M 0 10 A 10 10 0 0 0 10 0`} />
          <path d={`M ${ANCHO - 10} 0 A 10 10 0 0 0 ${ANCHO} 10`} />
          <path d={`M 0 ${ALTO - 10} A 10 10 0 0 1 10 ${ALTO}`} />
          <path d={`M ${ANCHO - 10} ${ALTO} A 10 10 0 0 1 ${ANCHO} ${ALTO - 10}`} />
        </g>

        <g fill={LINEA}>
          <circle cx={ANCHO / 2} cy={MEDIO} r={7} />
          <circle cx={PUNTO_PENAL} cy={MEDIO} r={7} />
          <circle cx={ANCHO - PUNTO_PENAL} cy={MEDIO} r={7} />
        </g>

        <g fill="rgba(255,255,255,0.10)" stroke={LINEA} strokeWidth={3}>
          <rect x={-14} y={MEDIO - 36.6} width={14} height={73.2} />
          <rect x={ANCHO} y={MEDIO - 36.6} width={14} height={73.2} />
        </g>

        {/* --------------------------- los rótulos -------------------- */}

        <g
          fill="rgba(255,255,255,0.34)"
          fontSize={20}
          letterSpacing={3}
          textAnchor="middle"
          style={{ textTransform: "uppercase" }}
        >
          {zonas.map((zona, zi) => (
            <text key={zona} x={TERCIO * (zi + 0.5)} y={-13}>
              {zona}
            </text>
          ))}
        </g>

        <g fill="rgba(255,255,255,0.32)" fontSize={18} letterSpacing={1}>
          {carriles.map((carril, ci) => (
            <text
              key={carril}
              x={-14}
              y={BANDA * (ci + 0.5) + 6}
              textAnchor="end"
              style={{ textTransform: "uppercase" }}
            >
              {carril}
            </text>
          ))}
        </g>

        <g fill="rgba(200,169,107,0.55)" fontSize={19} letterSpacing={2}>
          <text x={ANCHO} y={ALTO + 26} textAnchor="end">
            ataca quien saca la falta →
          </text>
        </g>

        {/* ----------------------------- las faltas ------------------- */}

        {puntos.map(({ falta, x, y }) => {
          const suya = resaltada === falta.clip;
          const color = tinta[falta.lado];

          return (
            <g
              key={falta.clip}
              onMouseEnter={() => onResaltar(falta.clip)}
              onMouseLeave={() => onResaltar(null)}
              style={{ cursor: "pointer" }}
            >
              <title>{`${falta.lado === "ofensivo" ? "A favor" : "En contra"} · ${falta.zona} · ${falta.carril} · ${falta.distancia} · ${falta.entre ?? "?"} defendiendo\n${falta.nota}`}</title>

              {/* El halo sólo en la resaltada: con veintitrés, un halo por
                  punto deja el campo hecho una nube. */}
              {suya && <circle cx={x} cy={y} r={30} fill={`${color}33`} />}

              <circle
                cx={x}
                cy={y}
                r={suya ? 17 : 13}
                fill={color}
                stroke="rgba(8,11,15,0.8)"
                strokeWidth={3}
              />

              {/*
                Dentro del punto, cuánta gente defendía entre la falta y la
                portería que se ataca. Es el número que manda en este análisis,
                y ponerlo aquí ahorra cruzar el campo con la tabla falta a falta.
              */}
              <text
                x={x}
                y={y + 5.5}
                textAnchor="middle"
                fontSize={15}
                fontWeight={700}
                fill="#0B0F14"
                style={{ pointerEvents: "none" }}
              >
                {falta.entre ?? "?"}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="flex flex-wrap items-center gap-4 border-t border-white/10 px-3 py-2 text-[11px] text-white/40">
        <span className="inline-flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ background: tinta.ofensivo }}
          />
          A favor
        </span>

        <span className="inline-flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ background: tinta.defensivo }}
          />
          En contra
        </span>

        <span>
          El número de dentro es cuánta gente defendía entre la falta y la
          portería que se ataca, portero incluido.
        </span>
      </div>
    </div>
  );
}
