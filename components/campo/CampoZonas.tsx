"use client";

/**
 * EL CAMPO POR ZONAS: un campo dibujado y un punto por acción en su tercio y
 * su carril.
 *
 * Nació en las faltas (`components/faltas/CampoFaltas.tsx`) y el 11/10/2026
 * se sacó aquí para que robos y pérdidas se vean igual: nadie mira un
 * partido en cuadrícula, y «dónde se nos escapa el balón» se entiende en un
 * campo y no en una barra por zona. Las faltas siguen pasando por aquí.
 *
 * **Qué es exacto y qué no.** El etiquetado guarda tercio y carril, no
 * metros: son nueve zonas, no coordenadas. El punto dice su zona; dentro de
 * la zona se reparten en rejilla para que dos acciones en el mismo cajón no
 * se tapen, y el reparto es siempre el mismo para el mismo orden: el campo
 * de hoy es el de mañana.
 *
 * **Hacia dónde se mira.** Siempre igual: el Castilla ataca hacia la
 * derecha, nuestra portería a la izquierda. Quien monta el campo le da los
 * puntos ya colocados en esa orientación (`zonas` y `carriles` son las del
 * campo de verdad; el carril izquierdo es el de arriba).
 *
 * **Todo se pincha.** Una casilla (o un punto, que es su casilla) filtra por
 * su tercio y su carril a la vez; el rótulo de arriba, sólo por el tercio;
 * el de la izquierda, sólo por el carril. El campo recibe los puntos SIN su
 * propio filtro de sitio, así que lo elegido se marca en oro y lo demás se
 * apaga, pero no desaparece.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Maximize2, Minimize2 } from "lucide-react";

import { TITULO_FILTRO } from "@/components/faltas/FiltrosCruzados";

export type PuntoCampo = {
  id: string;
  /** Tercio y carril en el campo de verdad, en el vocabulario de `zonas`/`carriles`. */
  zona: string;
  carril: string;
  color: string;
  /** Un anillo blanco alrededor: lo que más peligro trae (frontal, remate…). */
  anillo?: boolean;
  /** Lo que se lee al pasar por encima. */
  titulo: string;
};

export type CampoZonasProps = {
  puntos: PuntoCampo[];
  zonas: string[];
  carriles: string[];
  /** El punto que está resaltado, para atarlo con una tabla. */
  resaltado: string | null;
  onResaltar: (id: string | null) => void;
  /** Los tercios y carriles marcados como filtro (vacío = ninguno). */
  zonasMarcadas?: string[];
  carrilesMarcados?: string[];
  onCajon?: (zona: string, carril: string) => void;
  onZona?: (zona: string) => void;
  onCarril?: (carril: string) => void;
  /**
   * La cifra de la esquina de cada cajón, con los puntos que caen en él. Sin
   * nada, el total en blanco.
   */
  cuenta?: (puntos: PuntoCampo[]) => ReactNode;
  /** «falta» / «faltas», para los globos. */
  unidad: { una: string; varias: string };
  ariaLabel: string;
  /** El pie: la leyenda de colores y lo que haga falta explicar. */
  leyenda?: ReactNode;
};

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

type Colocado = { punto: PuntoCampo; x: number; y: number };

/**
 * Reparte los puntos de cada cajón por dentro del cajón.
 *
 * En rejilla y por orden: con once en el mismo tercio, un punto por acción
 * en el centro del cajón sería un punto. Y como el orden de entrada no
 * cambia, tampoco cambia el dibujo.
 */
function coloca(puntos: PuntoCampo[], zonas: string[], carriles: string[]): Colocado[] {
  const cajones = new Map<string, PuntoCampo[]>();

  for (const punto of puntos) {
    const zi = zonas.indexOf(punto.zona);
    const ci = carriles.indexOf(punto.carril);

    if (zi < 0 || ci < 0) continue;

    const clave = `${zi}|${ci}`;

    cajones.set(clave, [...(cajones.get(clave) ?? []), punto]);
  }

  const colocados: Colocado[] = [];

  for (const [clave, suyos] of cajones) {
    const [zi, ci] = clave.split("|").map(Number);

    const cx = TERCIO * (zi + 0.5);
    const cy = BANDA * (ci + 0.5);

    const columnas = Math.ceil(Math.sqrt(suyos.length));
    const filas = Math.ceil(suyos.length / columnas);

    /* El paso se estrecha cuando hay muchos: nunca se sale del cajón. */
    const pasoX = (TERCIO * 0.62) / Math.max(1, columnas);
    const pasoY = (BANDA * 0.5) / Math.max(1, filas);

    suyos.forEach((punto, indice) => {
      const columna = indice % columnas;
      const fila = Math.floor(indice / columnas);

      colocados.push({
        punto,
        x: cx + (columna - (columnas - 1) / 2) * pasoX,
        y: cy + (fila - (filas - 1) / 2) * pasoY,
      });
    });
  }

  return colocados;
}

export function CampoZonas({
  puntos,
  zonas,
  carriles,
  resaltado,
  onResaltar,
  zonasMarcadas = [],
  carrilesMarcados = [],
  onCajon,
  onZona,
  onCarril,
  cuenta,
  unidad,
  ariaLabel,
  leyenda,
}: CampoZonasProps) {
  const colocados = coloca(puntos, zonas, carriles);

  /*
  | Tamaño razonable y pantalla completa (29/10/2026, lo pidió el analista):
  | a todo el ancho el campo medía ~880 px de alto en un portátil y había que
  | hacer scroll para verlo entero. Ahora no pasa del alto de la ventana menos
  | la cabecera y los filtros, y un botón lo abre a pantalla completa.
  */
  const marco = useRef<HTMLDivElement>(null);

  const [completa, setCompleta] = useState(false);

  useEffect(() => {
    const cambia = () => setCompleta(document.fullscreenElement === marco.current && marco.current !== null);

    document.addEventListener("fullscreenchange", cambia);

    return () => document.removeEventListener("fullscreenchange", cambia);
  }, []);

  const alternaCompleta = () => {
    if (document.fullscreenElement) void document.exitFullscreen?.();
    else void marco.current?.requestFullscreen?.().catch(() => {});
  };

  /*
  | Qué casilla está elegida. Con sólo un tercio marcado, son sus tres
  | carriles; con sólo un carril, sus tres tercios; con los dos, el cruce.
  */
  const hayFiltroSitio = zonasMarcadas.length > 0 || carrilesMarcados.length > 0;
  const cajonElegido = (zona: string, carril: string) =>
    hayFiltroSitio &&
    (zonasMarcadas.length === 0 || zonasMarcadas.includes(zona)) &&
    (carrilesMarcados.length === 0 || carrilesMarcados.includes(carril));

  /* Qué hay en cada cajón: el velo y la cifra de la esquina. */
  const porCajon = new Map<string, PuntoCampo[]>();

  for (const punto of puntos) {
    const zi = zonas.indexOf(punto.zona);
    const ci = carriles.indexOf(punto.carril);

    if (zi < 0 || ci < 0) continue;

    const clave = `${zi}|${ci}`;

    porCajon.set(clave, [...(porCajon.get(clave) ?? []), punto]);
  }

  const tope = Math.max(1, ...[...porCajon.values()].map((lista) => lista.length));

  /* El degradado lleva un id por campo: con dos campos en la misma página se pisaban. */
  const idCesped = `cesped-${ariaLabel.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`;

  return (
    <div
      ref={marco}
      className={`relative overflow-hidden rounded-2xl border border-white/10 bg-[#0A1A12] ${completa ? "flex h-full flex-col justify-center rounded-none border-0" : ""}`}
    >
      <button
        type="button"
        data-export-hide
        onClick={alternaCompleta}
        title={completa ? "Salir de pantalla completa (Esc)" : "Ver el campo a pantalla completa"}
        aria-label={completa ? "Salir de pantalla completa" : "Ver el campo a pantalla completa"}
        className="absolute right-2 top-2 z-10 flex items-center gap-1.5 rounded-lg border border-white/15 bg-black/40 px-2 py-1 text-[11px] backdrop-blur transition hover:bg-black/60"
        style={{ color: "rgba(255,255,255,0.8)" }}
      >
        {completa ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
        <span className="hidden sm:inline">{completa ? "Salir" : "Pantalla completa"}</span>
      </button>

      {/*
        El margen no es simétrico a propósito: los rótulos de los carriles van
        FUERA del campo, a la izquierda. Dentro caían encima del área grande y
        de las líneas, y un campo con letras cruzadas por rayas blancas es
        exactamente lo que había que quitar de aquí.
      */}
      <svg
        viewBox={`-118 -34 ${ANCHO + 144} ${ALTO + 74}`}
        className="mx-auto block w-full"
        /* El ancho que da un alto que cabe: el campo es 1194 × 754 con sus márgenes. */
        style={{ maxWidth: completa ? "calc((100vh - 64px) * 1.583)" : "max(560px, calc((100vh - 300px) * 1.583))" }}
        role="img"
        aria-label={ariaLabel}
      >
        <defs>
          <linearGradient id={idCesped} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#12301F" />
            <stop offset="100%" stopColor="#0A1D13" />
          </linearGradient>
        </defs>

        <rect x={-118} y={-34} width={ANCHO + 144} height={ALTO + 74} fill="#0A1A12" />

        {/* El césped, sólo dentro de las líneas. */}
        <rect x={0} y={0} width={ANCHO} height={ALTO} fill={`url(#${idCesped})`} />

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
            const cuantos = porCajon.get(`${zi}|${ci}`)?.length ?? 0;

            return (
              <rect
                key={`${zi}|${ci}`}
                x={TERCIO * zi}
                y={BANDA * ci}
                width={TERCIO}
                height={BANDA}
                fill={`rgba(200,169,107,${((cuantos / tope) * 0.2).toFixed(3)})`}
                onClick={onCajon ? () => onCajon(zona, carril) : undefined}
                style={onCajon ? { cursor: "pointer" } : undefined}
              >
                {onCajon && (
                  <title>{`${zona} · ${carril} · ${cuantos} ${cuantos === 1 ? unidad.una : unidad.varias}\n${TITULO_FILTRO}`}</title>
                )}
              </rect>
            );
          }),
        )}

        {/* Cuántos hay en cada zona, en la esquina de abajo: se lee sin contar puntos. */}
        <g fontSize={19} fontWeight={700} fill="rgba(255,255,255,0.8)" style={{ pointerEvents: "none" }}>
          {zonas.map((_, zi) =>
            carriles.map((__, ci) => {
              const lista = porCajon.get(`${zi}|${ci}`);

              if (!lista || lista.length === 0) return null;

              const x = TERCIO * (zi + 1) - 14;
              const y = BANDA * (ci + 1) - 14;

              return (
                <text key={`${zi}|${ci}`} x={x} y={y} textAnchor="end">
                  {cuenta ? cuenta(lista) : lista.length}
                </text>
              );
            }),
          )}
        </g>

        {/* Las divisiones del etiquetado, muy tenues: son ayuda, no campo. */}
        <g stroke="rgba(200,169,107,0.16)" strokeWidth={1.6} strokeDasharray="10 12" style={{ pointerEvents: "none" }}>
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
          <rect x={0} y={MEDIO - AREA_ANCHO / 2} width={AREA_FONDO} height={AREA_ANCHO} />
          <rect x={ANCHO - AREA_FONDO} y={MEDIO - AREA_ANCHO / 2} width={AREA_FONDO} height={AREA_ANCHO} />
          <rect x={0} y={MEDIO - CHICA_ANCHO / 2} width={CHICA_FONDO} height={CHICA_ANCHO} />
          <rect x={ANCHO - CHICA_FONDO} y={MEDIO - CHICA_ANCHO / 2} width={CHICA_FONDO} height={CHICA_ANCHO} />

          {/* Los semicírculos, cortados justo en la línea del área. */}
          <path d={`M ${AREA_FONDO} ${MEDIO - CORTE} A ${RADIO_CENTRAL} ${RADIO_CENTRAL} 0 0 1 ${AREA_FONDO} ${MEDIO + CORTE}`} />
          <path d={`M ${ANCHO - AREA_FONDO} ${MEDIO - CORTE} A ${RADIO_CENTRAL} ${RADIO_CENTRAL} 0 0 0 ${ANCHO - AREA_FONDO} ${MEDIO + CORTE}`} />

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

        <g fill="rgba(255,255,255,0.10)" stroke={LINEA} strokeWidth={3} style={{ pointerEvents: "none" }}>
          <rect x={-14} y={MEDIO - 36.6} width={14} height={73.2} />
          <rect x={ANCHO} y={MEDIO - 36.6} width={14} height={73.2} />
        </g>

        {/* La casilla elegida, con el oro por encima de las líneas. */}
        {hayFiltroSitio && (
          <g fill="none" stroke={ORO} strokeWidth={4} style={{ pointerEvents: "none" }}>
            {zonas.map((zona, zi) =>
              carriles.map((carril, ci) =>
                cajonElegido(zona, carril) ? (
                  <rect key={`${zi}|${ci}`} x={TERCIO * zi + 3} y={BANDA * ci + 3} width={TERCIO - 6} height={BANDA - 6} rx={6} />
                ) : null,
              ),
            )}
          </g>
        )}

        {/* --------------------------- los rótulos -------------------- */}

        <g fill="rgba(255,255,255,0.34)" fontSize={20} letterSpacing={3} textAnchor="middle" style={{ textTransform: "uppercase" }}>
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
                style={{ textTransform: "uppercase", cursor: onCarril ? "pointer" : undefined }}
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

        {/* ----------------------------- los puntos ------------------- */}

        {colocados.map(({ punto, x, y }) => {
          const suyo = resaltado === punto.id;
          /* Fuera de la casilla elegida, el punto se apaga pero se queda. */
          const fuera = hayFiltroSitio && !cajonElegido(punto.zona, punto.carril);

          return (
            <g
              key={punto.id}
              onMouseEnter={() => onResaltar(punto.id)}
              onMouseLeave={() => onResaltar(null)}
              onClick={onCajon ? () => onCajon(punto.zona, punto.carril) : undefined}
              opacity={fuera && !suyo ? 0.3 : 1}
              style={{ cursor: "pointer" }}
            >
              <title>{`${punto.titulo}${onCajon ? `\n${TITULO_FILTRO}` : ""}`}</title>

              {/* El halo sólo en el resaltado: con veintitrés, un halo por
                  punto deja el campo hecho una nube. */}
              {suyo && <circle cx={x} cy={y} r={30} fill={`${punto.color}33`} />}

              {punto.anillo && (
                <circle cx={x} cy={y} r={suyo ? 24 : 20} fill="none" stroke="#FFFFFF" strokeWidth={2.5} strokeOpacity={0.85} />
              )}

              <circle cx={x} cy={y} r={suyo ? 15 : 12} fill={punto.color} stroke="rgba(8,11,15,0.8)" strokeWidth={3} />
            </g>
          );
        })}
      </svg>

      {/* El pie va sobre el fondo oscuro del campo también de día, así que el
          color se fija aquí: con la clase de texto, el tema de día lo volvía
          tinta oscura sobre verde oscuro y la leyenda desaparecía. */}
      {leyenda && (
        <div
          className="flex flex-wrap items-center gap-4 border-t border-white/10 px-3 py-2 text-[11px]"
          style={{ color: "rgba(255,255,255,0.62)" }}
        >
          {leyenda}
        </div>
      )}
    </div>
  );
}
