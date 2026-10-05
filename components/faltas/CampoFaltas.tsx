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
 * **Hacia dónde se mira (05/10/2026).** Siempre igual: el Castilla ataca hacia
 * la derecha, nuestra portería a la izquierda y la rival a la derecha. Antes el
 * campo iba en el sentido de QUIEN SACA, y como en el mismo campo van las
 * nuestras y las del rival, un punto en «campo propio» era nuestro campo o el
 * suyo según el color: dos puntos juntos estaban en los dos extremos del campo
 * de verdad. Ahora cada falta se coloca donde se cometió (`sitioEnCampo`): las
 * del rival se dan la vuelta, tercio y carril. El carril izquierdo es el de
 * arriba, el que queda a la izquierda del Castilla atacando hacia la derecha.
 *
 * **Qué lleva cada punto.** Su color dice de quién es la falta; el anillo, que
 * es frontal (cerca del área que se ataca). El número de defensores y la nota
 * van en el detalle al pasar por encima, no dentro del punto: un número sin
 * rótulo dentro de cada bola era lo que más dudas traía.
 *
 * **Todo se pincha.** Una casilla (o un punto, que es su casilla) filtra por
 * su tercio y su carril a la vez; el rótulo de arriba, sólo por el tercio; el
 * de la izquierda, sólo por el carril; la leyenda, por el lado. El campo
 * recibe las faltas SIN su propio filtro de sitio, así que lo elegido se
 * marca en oro y lo demás se apaga, pero no desaparece.
 */

import type { Falta, LadoFalta } from "@/lib/faltas/datos";
import { TITULO_FILTRO, marcaPieza } from "@/components/faltas/FiltrosCruzados";

/* ------------------------------------------------------------------ */
/*  DÓNDE ESTÁ CADA FALTA EN EL CAMPO DE VERDAD (05/10/2026)           */
/* ------------------------------------------------------------------ */

/** Los tercios, vistos con el Castilla atacando hacia la derecha. */
export const ZONAS_CAMPO = ["nuestro campo", "medio campo", "campo rival"];

/** Los carriles del Castilla atacando hacia la derecha: la izquierda, arriba. */
export const CARRILES_CAMPO = ["izquierda", "centro", "derecha"];

/**
 * El tercio y el carril de una falta en el campo de verdad.
 *
 * El etiquetado los guarda hacia la portería que ataca QUIEN SACA. Si la
 * sacamos nosotros, coinciden con nuestro campo. Si la saca el rival, ataca
 * hacia nuestra portería: su «campo propio» es nuestro campo rival, y su
 * izquierda, nuestra derecha.
 */
export function sitioEnCampo(f: Pick<Falta, "lado" | "zona" | "carril">): { zona: string; carril: string } {
  const nuestra = f.lado === "ofensivo";

  const zona =
    f.zona === "medio campo"
      ? "medio campo"
      : f.zona === "campo propio"
        ? nuestra
          ? "nuestro campo"
          : "campo rival"
        : f.zona === "campo rival"
          ? nuestra
            ? "campo rival"
            : "nuestro campo"
          : "";

  const carril = nuestra || f.carril === "centro" ? f.carril : f.carril === "izquierda" ? "derecha" : f.carril === "derecha" ? "izquierda" : "";

  return { zona, carril };
}

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
const ORO = "#C8A96B";

export type CampoFaltasProps = {
  faltas: Falta[];
  zonas: string[];
  carriles: string[];
  tinta: Record<LadoFalta, string>;
  /** La falta que está resaltada, para atarla con la tabla de abajo. */
  resaltada: string | null;
  onResaltar: (clip: string | null) => void;
  /** Los tercios y carriles marcados como filtro (vacío = ninguno). */
  zonasMarcadas?: string[];
  carrilesMarcados?: string[];
  /** El lado marcado, para la leyenda. */
  ladoMarcado?: LadoFalta | null;
  onCajon?: (zona: string, carril: string) => void;
  onZona?: (zona: string) => void;
  onCarril?: (carril: string) => void;
  onLado?: (lado: LadoFalta) => void;
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
    const sitio = sitioEnCampo(falta);
    const zi = zonas.indexOf(sitio.zona);
    const ci = carriles.indexOf(sitio.carril);

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
  zonasMarcadas = [],
  carrilesMarcados = [],
  ladoMarcado = null,
  onCajon,
  onZona,
  onCarril,
  onLado,
}: CampoFaltasProps) {
  const puntos = coloca(faltas, zonas, carriles);

  /*
  | Qué casilla está elegida. Con sólo un tercio marcado, son sus tres
  | carriles; con sólo un carril, sus tres tercios; con los dos, el cruce.
  */
  const hayFiltroSitio = zonasMarcadas.length > 0 || carrilesMarcados.length > 0;
  const cajonElegido = (zona: string, carril: string) =>
    hayFiltroSitio &&
    (zonasMarcadas.length === 0 || zonasMarcadas.includes(zona)) &&
    (carrilesMarcados.length === 0 || carrilesMarcados.includes(carril));

  /* Cuántas hay en cada cajón, en total y por lado: el velo y la cuenta de la esquina. */
  const porCajon = new Map<string, number>();
  const porLado = new Map<string, { ofensivo: number; defensivo: number }>();

  for (const falta of faltas) {
    const sitio = sitioEnCampo(falta);
    const zi = zonas.indexOf(sitio.zona);
    const ci = carriles.indexOf(sitio.carril);

    if (zi < 0 || ci < 0) continue;

    const clave = `${zi}|${ci}`;

    porCajon.set(clave, (porCajon.get(clave) ?? 0) + 1);

    const cuenta = porLado.get(clave) ?? { ofensivo: 0, defensivo: 0 };

    cuenta[falta.lado] += 1;

    porLado.set(clave, cuenta);
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

        {/*
          El velo que dice dónde se acumulan, por debajo de las líneas. Va en
          todas las casillas, también las vacías: es la superficie que se
          pincha para filtrar por ese sitio.
        */}
        {zonas.map((zona, zi) =>
          carriles.map((carril, ci) => {
            const cuantas = porCajon.get(`${zi}|${ci}`) ?? 0;

            return (
              <rect
                key={`${zi}|${ci}`}
                x={TERCIO * zi}
                y={BANDA * ci}
                width={TERCIO}
                height={BANDA}
                fill={`rgba(200,169,107,${((cuantas / tope) * 0.2).toFixed(3)})`}
                onClick={onCajon ? () => onCajon(zona, carril) : undefined}
                style={onCajon ? { cursor: "pointer" } : undefined}
              >
                {onCajon && (
                  <title>{`${zona} · ${carril} · ${cuantas} ${cuantas === 1 ? "falta" : "faltas"}\n${TITULO_FILTRO}`}</title>
                )}
              </rect>
            );
          }),
        )}

        {/* Cuántas hay en cada zona, por lado, en la esquina de abajo: se lee sin contar puntos. */}
        <g fontSize={19} fontWeight={700} style={{ pointerEvents: "none" }}>
          {zonas.map((_, zi) =>
            carriles.map((__, ci) => {
              const cuenta = porLado.get(`${zi}|${ci}`);

              if (!cuenta) return null;

              const x = TERCIO * (zi + 1) - 14;
              const y = BANDA * (ci + 1) - 14;

              return (
                <text key={`${zi}|${ci}`} x={x} y={y} textAnchor="end">
                  {cuenta.ofensivo ? <tspan fill={tinta.ofensivo}>{cuenta.ofensivo}</tspan> : null}
                  {cuenta.ofensivo && cuenta.defensivo ? <tspan fill="rgba(255,255,255,0.35)"> · </tspan> : null}
                  {cuenta.defensivo ? <tspan fill={tinta.defensivo}>{cuenta.defensivo}</tspan> : null}
                </text>
              );
            }),
          )}
        </g>

        {/* Las divisiones del etiquetado, muy tenues: son ayuda, no campo. */}
        <g
          stroke="rgba(200,169,107,0.16)"
          strokeWidth={1.6}
          strokeDasharray="10 12"
          style={{ pointerEvents: "none" }}
        >
          <line x1={TERCIO} y1={0} x2={TERCIO} y2={ALTO} />
          <line x1={TERCIO * 2} y1={0} x2={TERCIO * 2} y2={ALTO} />
          <line x1={0} y1={BANDA} x2={ANCHO} y2={BANDA} />
          <line x1={0} y1={BANDA * 2} x2={ANCHO} y2={BANDA * 2} />
        </g>

        {/* ------------------------------- el campo ------------------ */}

        {/* Las líneas no se pinchan: el clic tiene que llegar a la casilla. */}
        <g fill="none" stroke={LINEA} strokeWidth={3} style={{ pointerEvents: "none" }}>
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

        <g fill={LINEA} style={{ pointerEvents: "none" }}>
          <circle cx={ANCHO / 2} cy={MEDIO} r={7} />
          <circle cx={PUNTO_PENAL} cy={MEDIO} r={7} />
          <circle cx={ANCHO - PUNTO_PENAL} cy={MEDIO} r={7} />
        </g>

        <g
          fill="rgba(255,255,255,0.10)"
          stroke={LINEA}
          strokeWidth={3}
          style={{ pointerEvents: "none" }}
        >
          <rect x={-14} y={MEDIO - 36.6} width={14} height={73.2} />
          <rect x={ANCHO} y={MEDIO - 36.6} width={14} height={73.2} />
        </g>

        {/* La casilla elegida, con el oro por encima de las líneas. */}
        {hayFiltroSitio && (
          <g fill="none" stroke={ORO} strokeWidth={4} style={{ pointerEvents: "none" }}>
            {zonas.map((zona, zi) =>
              carriles.map((carril, ci) =>
                cajonElegido(zona, carril) ? (
                  <rect
                    key={`${zi}|${ci}`}
                    x={TERCIO * zi + 3}
                    y={BANDA * ci + 3}
                    width={TERCIO - 6}
                    height={BANDA - 6}
                    rx={6}
                  />
                ) : null,
              ),
            )}
          </g>
        )}

        {/* --------------------------- los rótulos -------------------- */}

        <g
          fill="rgba(255,255,255,0.34)"
          fontSize={20}
          letterSpacing={3}
          textAnchor="middle"
          style={{ textTransform: "uppercase" }}
        >
          {zonas.map((zona, zi) => {
            const suya = zonasMarcadas.includes(zona);

            return (
              <text
                key={zona}
                x={TERCIO * (zi + 0.5)}
                y={-13}
                onClick={onZona ? () => onZona(zona) : undefined}
                fill={suya ? ORO : undefined}
                fillOpacity={zonasMarcadas.length && !suya ? 0.5 : 1}
                fontWeight={suya ? 700 : undefined}
                style={onZona ? { cursor: "pointer" } : undefined}
              >
                {onZona && <title>{TITULO_FILTRO}</title>}
                {zona}
              </text>
            );
          })}
        </g>

        <g fill="rgba(255,255,255,0.32)" fontSize={18} letterSpacing={1}>
          {carriles.map((carril, ci) => {
            const suyo = carrilesMarcados.includes(carril);

            return (
              <text
                key={carril}
                x={-14}
                y={BANDA * (ci + 0.5) + 6}
                textAnchor="end"
                onClick={onCarril ? () => onCarril(carril) : undefined}
                fill={suyo ? ORO : undefined}
                fillOpacity={carrilesMarcados.length && !suyo ? 0.5 : 1}
                fontWeight={suyo ? 700 : undefined}
                style={{
                  textTransform: "uppercase",
                  cursor: onCarril ? "pointer" : undefined,
                }}
              >
                {onCarril && <title>{TITULO_FILTRO}</title>}
                {carril}
              </text>
            );
          })}
        </g>

        <g fill="rgba(255,255,255,0.45)" fontSize={18} letterSpacing={1.5}>
          <text x={0} y={ALTO + 28} textAnchor="start">
            ← nuestra portería
          </text>
          <text x={ANCHO / 2} y={ALTO + 28} textAnchor="middle" fill="rgba(200,169,107,0.75)">
            el Castilla ataca hacia la derecha →
          </text>
          <text x={ANCHO} y={ALTO + 28} textAnchor="end">
            portería rival →
          </text>
        </g>

        {/* ----------------------------- las faltas ------------------- */}

        {puntos.map(({ falta, x, y }) => {
          const suya = resaltada === falta.clip;
          const color = tinta[falta.lado];
          /* Fuera de la casilla elegida, el punto se apaga pero se queda. */
          const sitio = sitioEnCampo(falta);
          const fuera = hayFiltroSitio && !cajonElegido(sitio.zona, sitio.carril);
          const frontal = falta.distancia === "frontal";

          return (
            <g
              key={falta.clip}
              onMouseEnter={() => onResaltar(falta.clip)}
              onMouseLeave={() => onResaltar(null)}
              onClick={onCajon ? () => onCajon(sitio.zona, sitio.carril) : undefined}
              opacity={fuera && !suya ? 0.3 : 1}
              style={{ cursor: "pointer" }}
            >
              <title>{`${falta.minuto || "—"} · ${falta.lado === "ofensivo" ? "A favor (la sacamos nosotros)" : "En contra (la saca el rival)"}\n${sitio.zona} · ${sitio.carril === "centro" ? "por el centro" : `por la ${sitio.carril}`} · ${falta.distancia === "frontal" ? "frontal, cerca del área" : `distancia ${falta.distancia}`}\n${falta.entre === null ? "Defensores sin contar" : `${falta.entre} defendiendo entre la falta y la portería`}\n${falta.nota}${onCajon ? `\n${TITULO_FILTRO}` : ""}`}</title>

              {/* El halo sólo en la resaltada: con veintitrés, un halo por
                  punto deja el campo hecho una nube. */}
              {suya && <circle cx={x} cy={y} r={30} fill={`${color}33`} />}

              {/* El anillo: frontal, cerca del área que se ataca. Es la que más peligro trae. */}
              {frontal && <circle cx={x} cy={y} r={suya ? 24 : 20} fill="none" stroke="#FFFFFF" strokeWidth={2.5} strokeOpacity={0.85} />}

              <circle
                cx={x}
                cy={y}
                r={suya ? 15 : 12}
                fill={color}
                stroke="rgba(8,11,15,0.8)"
                strokeWidth={3}
              />
            </g>
          );
        })}
      </svg>

      <div className="flex flex-wrap items-center gap-4 border-t border-white/10 px-3 py-2 text-[11px] text-white/40">
        {(
          [
            { lado: "ofensivo", nombre: "A favor" },
            { lado: "defensivo", nombre: "En contra" },
          ] satisfies { lado: LadoFalta; nombre: string }[]
        ).map(({ lado, nombre }) => (
          <button
            key={lado}
            type="button"
            onClick={onLado ? () => onLado(lado) : undefined}
            disabled={!onLado}
            aria-pressed={ladoMarcado === lado}
            title={onLado ? TITULO_FILTRO : undefined}
            style={marcaPieza(ladoMarcado === lado, ladoMarcado !== null)}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-md px-1 transition hover:opacity-100 disabled:cursor-default"
          >
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: tinta[lado] }}
            />
            {nombre === "A favor" ? "A favor (la sacamos)" : "En contra (la saca el rival)"}
          </button>
        ))}

        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full border-2 border-white/80" /> frontal, cerca del área
        </span>
        <span>Cifras de cada zona: a favor · en contra</span>
        <span className="text-white/30">Pasa por un punto para ver minuto, defensores y qué pasó</span>
      </div>
    </div>
  );
}
