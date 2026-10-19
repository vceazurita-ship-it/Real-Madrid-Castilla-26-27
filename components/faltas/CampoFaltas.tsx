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
 * El dibujo vive desde el 11/10/2026 en `components/campo/CampoZonas.tsx`,
 * que comparten las faltas y los robos y pérdidas. Aquí queda lo que es de
 * las faltas: hacia dónde se mira y qué lleva cada punto.
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
 */

import type { Falta, LadoFalta } from "@/lib/faltas/datos";
import { TITULO_FILTRO, marcaPieza } from "@/components/faltas/FiltrosCruzados";
import { CampoZonas, type PuntoCampo } from "@/components/campo/CampoZonas";

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

/** Una falta convertida en punto del campo, con su lado pegado para la cuenta. */
type PuntoFalta = PuntoCampo & { lado: LadoFalta };

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
  const puntos: PuntoFalta[] = faltas.map((falta) => {
    const sitio = sitioEnCampo(falta);

    return {
      id: falta.clip,
      zona: sitio.zona,
      carril: sitio.carril,
      color: tinta[falta.lado],
      anillo: falta.distancia === "frontal",
      lado: falta.lado,
      titulo: `${falta.minuto || "—"} · ${falta.lado === "ofensivo" ? "A favor (la sacamos nosotros)" : "En contra (la saca el rival)"}\n${sitio.zona} · ${sitio.carril === "centro" ? "por el centro" : `por la ${sitio.carril}`} · ${falta.distancia === "frontal" ? "frontal, cerca del área" : `distancia ${falta.distancia}`}\n${falta.entre === null ? "Defensores sin contar" : `${falta.entre} defendiendo entre la falta y la portería`}\n${falta.nota}`,
    };
  });

  /* La cifra de cada zona, por lado: a favor · en contra. */
  const cuenta = (lista: PuntoCampo[]) => {
    const ofensivo = lista.filter((p) => (p as PuntoFalta).lado === "ofensivo").length;
    const defensivo = lista.length - ofensivo;

    return (
      <>
        {ofensivo ? <tspan fill={tinta.ofensivo}>{ofensivo}</tspan> : null}
        {ofensivo && defensivo ? <tspan fill="rgba(255,255,255,0.35)"> · </tspan> : null}
        {defensivo ? <tspan fill={tinta.defensivo}>{defensivo}</tspan> : null}
      </>
    );
  };

  return (
    <CampoZonas
      puntos={puntos}
      zonas={zonas}
      carriles={carriles}
      resaltado={resaltada}
      onResaltar={onResaltar}
      zonasMarcadas={zonasMarcadas}
      carrilesMarcados={carrilesMarcados}
      onCajon={onCajon}
      onZona={onZona}
      onCarril={onCarril}
      cuenta={cuenta}
      unidad={{ una: "falta", varias: "faltas" }}
      ariaLabel="Campo con las faltas repartidas por tercio y carril"
      leyenda={
        <>
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
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: tinta[lado] }} />
              {nombre === "A favor" ? "A favor (la sacamos)" : "En contra (la saca el rival)"}
            </button>
          ))}

          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full border-2 border-white/80" /> frontal, cerca del área
          </span>
          <span>Cifras de cada zona: a favor · en contra</span>
          {/* En línea, como el resto del pie: la clase se volvía tinta oscura
              sobre el verde del campo en modo día (19/10/2026). */}
          <span style={{ color: "rgba(255,255,255,0.45)" }}>Pasa por un punto para ver minuto, defensores y qué pasó</span>
        </>
      }
    />
  );
}
