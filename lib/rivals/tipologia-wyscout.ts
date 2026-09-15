import type { FilaPartido } from "@/lib/data-analisis/leer";
import { CONVERSION_ABP, reparte } from "@/lib/data-analisis/goles-abp";
import { mismoEquipo } from "@/lib/data-analisis/nombres";
import {
  FILA_PROPIA,
  TODAS_LAS_FILAS,
  TIPOLOGIA_VACIA,
  type ColumnaTipologia,
  type TipologiaManual,
} from "@/lib/rivals/tipologia";

/**
 * LA TIPOLOGÍA DE GOL, PROPUESTA CON WYSCOUT.
 *
 * La tabla la codifica el analista viendo el partido, y eso no cambia: lo que
 * se escriba manda siempre. Lo que cambia es el punto de partida —una rejilla
 * de veinte casillas en blanco— por **un reparto propuesto**, que se corrige en
 * dos minutos en vez de rellenarse en veinte.
 *
 * Y aquí hay que ser exacto con lo que se sabe y lo que se supone, porque la
 * diapositiva no distingue una cosa de otra:
 *
 * - **Ni penaltis ni propias puertas**: los canta el marcador y la hoja ya los
 *   pinta sola con lo que BeSoccer cuenta. Repartirlos aquí los duplicaría.
 * - **Propuesta**: los goles de jugada. Wyscout **no clasifica los goles**, pero sí de
 *   dónde nace cada remate —ataque posicional, contraataque o balón parado, que
 *   es su propia taxonomía y es excluyente— y desde dónde se dispara. Los goles
 *   que quedan se reparten con esas proporciones.
 *
 * Repartir en proporción a los remates supondría que un gol es igual de
 * probable venga de donde venga el remate, y **no es verdad**: un remate de
 * córner entra la mitad que uno de jugada. Por eso los remates de balón parado
 * pesan con `CONVERSION_ABP`, medido contra los goles reales de Opta en la
 * categoría —lo mismo que usa «Goles a balón parado» en Data Análisis, para
 * que las dos pantallas no digan cosas distintas—. Aun así, con dos o tres
 * jornadas y cuatro goles el reparto es un punto de partida, no un análisis;
 * por eso la pantalla dice de dónde sale cada número y el analista lo pisa sin
 * pedir permiso.
 */

const COL = {
  goles: "Goles",
  penaltisMarcados: "Penaltis · marcados",
  posicional: "Ataques posicionales · con remate",
  contras: "Contraataques · con remate",
  abp: "Jugadas a balón parado · con remate",
  corners: "Córneres · con remate",
  faltas: "Tiros libres · con remate",
  tiros: "Tiros",
  fuera: "Tiros de fuera del área",
};

export type BaseTipologia = {
  /** Partidos del equipo en el dataset. */
  partidos: number;
  golesFavor: number;
  golesContra: number;
  /** Si no hay ni un remate clasificado, no hay nada que repartir. */
  hayOrigen: boolean;
};

export type PropuestaTipologia = {
  tipologia: TipologiaManual;
  base: BaseTipologia;
};

export const PROPUESTA_VACIA: PropuestaTipologia = {
  tipologia: TIPOLOGIA_VACIA,
  base: { partidos: 0, golesFavor: 0, golesContra: 0, hayOrigen: false },
};

const suma = (filas: FilaPartido[], columna: string) =>
  filas.reduce((total, fila) => total + (Number(fila.datos[columna]) || 0), 0);

/**
 * Una columna de la tabla —a favor o en contra— desde las filas que la
 * describen y cuántos goles hay que repartir.
 *
 * `cuantos` viene de fuera cuando se sabe: son los **goles de jugada** que
 * cuenta BeSoccer en toda la temporada, que es lo que enseña la diapositiva. Si
 * se repartieran sólo los goles de los informes de Wyscout —dos o tres
 * jornadas— la tabla sumaría dos y la hoja diría siete arriba, y eso se lee
 * como un error aunque no lo sea. Sin ese dato se reparten los de Wyscout.
 *
 * Los penaltis y las propias puertas **no entran**: los canta el marcador y la
 * hoja ya los pinta sola cuando la casilla está vacía.
 */
function columnaDe(
  filas: FilaPartido[],
  cuantos?: number,
): { columna: ColumnaTipologia; repartidos: number } {
  const deWyscout = Math.round(suma(filas, COL.goles));

  const penaltisWyscout = Math.min(
    Math.round(suma(filas, COL.penaltisMarcados)),
    deWyscout,
  );

  const goles = Math.max(0, cuantos ?? deWyscout - penaltisWyscout);

  if (goles <= 0) return { columna: {}, repartidos: 0 };

  const posicional = suma(filas, COL.posicional);
  const contras = suma(filas, COL.contras);
  const abp = suma(filas, COL.abp);

  const tiros = suma(filas, COL.tiros);
  const fuera = suma(filas, COL.fuera);

  /*
  | Dentro del ataque organizado, cuánto se remata desde fuera del área.
  |
  | La proporción es sobre **todos** los remates porque Wyscout no la da por
  | vía; sirve para no meter en «dentro del área» los goles de un equipo que
  | dispara la mitad de las veces desde la frontal.
  */
  const cuotaFuera = tiros > 0 ? Math.min(1, fuera / tiros) : 0;

  const cornersConRemate = suma(filas, COL.corners);
  const faltasConRemate = suma(filas, COL.faltas);

  const abpTotal = cornersConRemate + faltasConRemate;

  const cuotaCorner = abpTotal > 0 ? cornersConRemate / abpTotal : 1;

  const columna = reparte(goles, [
    ["DENTRO", posicional * (1 - cuotaFuera)],
    ["IND. FUERA ÁREA", posicional * cuotaFuera],
    ["C. CONTRARIO", contras],
    /* Cada remate de ABP pesa lo que convierte su vía en la categoría. */
    ["CÓRNER", abp * cuotaCorner * CONVERSION_ABP.corner],
    /* Wyscout no distingue la falta directa de la indirecta; se propone en la
       indirecta, que es la que más veces acaba en remate, y se mueve a mano. */
    ["FALTA INDIRECTA", abp * (1 - cuotaCorner) * CONVERSION_ABP.falta],
  ]);

  /* Sin una sola vía clasificada no hay reparto posible y no se inventa. */
  return { columna, repartidos: Object.values(columna).reduce((t, n) => t + n, 0) };
}

/**
 * El reparto propuesto para un equipo, mirando su temporada en la categoría.
 *
 * `liga` son **todas** las filas de la temporada, de todos los equipos: las del
 * propio equipo describen lo que marca y las de sus rivales, lo que encaja.
 */
export function proponeTipologia(
  equipo: string,
  liga: FilaPartido[],
  /**
   * Cuántos goles **de jugada** hay que repartir en cada columna, si se sabe:
   * los que cuenta BeSoccer de toda la temporada, sin penaltis ni propias.
   * Es lo que hace que la tabla sume lo que dice la cabecera de la hoja.
   */
  objetivo?: { aFavor: number; enContra: number },
): PropuestaTipologia {
  const suyas = liga.filter((p) => mismoEquipo(p.equipo, equipo));

  if (suyas.length === 0) return PROPUESTA_VACIA;

  /* Lo que le hacen: es la fila del contrario de cada uno de sus partidos. */
  const contrarias = liga.filter((p) => mismoEquipo(p.rival, equipo));

  const aFavor = columnaDe(suyas, objetivo?.aFavor);
  const enContra = columnaDe(contrarias, objetivo?.enContra);

  const clasificados =
    suma(suyas, COL.posicional) + suma(suyas, COL.contras) + suma(suyas, COL.abp);

  return {
    tipologia: { aFavor: aFavor.columna, enContra: enContra.columna },
    base: {
      partidos: suyas.length,
      /* Lo repartido de verdad, que es lo que la pantalla tiene que contar. */
      golesFavor: aFavor.repartidos,
      golesContra: enContra.repartidos,
      hayOrigen: clasificados > 0,
    },
  };
}

/**
 * La propuesta, pedida al servidor.
 *
 * La calcula `/api/data-analisis?tipologia=` con el dataset que ya tiene
 * abierto: el pop-up y el informe se montan en el navegador y no van a bajarse
 * dos megas de informes para diez casillas. Si no hay dato —o falla— vuelve la
 * propuesta vacía y todo se comporta como antes de existir esto.
 */
export async function traePropuestaTipologia(
  equipo: string,
  objetivo?: { aFavor: number; enContra: number },
): Promise<PropuestaTipologia> {
  if (!equipo.trim()) return PROPUESTA_VACIA;

  try {
    const goles = objetivo
      ? `&goles=${Math.max(0, Math.round(objetivo.aFavor))},${Math.max(
          0,
          Math.round(objetivo.enContra),
        )}`
      : "";

    const respuesta = await fetch(
      `/api/data-analisis?tipologia=${encodeURIComponent(equipo)}${goles}`,
      { cache: "no-store" },
    );

    if (!respuesta.ok) return PROPUESTA_VACIA;

    const crudo = await respuesta.json();

    if (!crudo?.tipologia) return PROPUESTA_VACIA;

    return {
      tipologia: crudo.tipologia as TipologiaManual,
      base: crudo.base as BaseTipologia,
    };
  } catch (error) {
    console.error("[rivals] tipología propuesta", error);

    return PROPUESTA_VACIA;
  }
}

/**
 * Lo propuesto y lo escrito, en una sola tabla.
 *
 * **Lo escrito gana siempre**, casilla a casilla: la propuesta sólo rellena los
 * huecos. Y un cero escrito es un cero —«aquí no hubo ninguno»—, que es
 * justamente la forma de tapar una propuesta que no cuadra.
 */
export function mezclaTipologia(
  propuesta: TipologiaManual,
  escrita: TipologiaManual,
): TipologiaManual {
  const junta = (
    deLaPropuesta: ColumnaTipologia,
    deLaMano: ColumnaTipologia,
  ): ColumnaTipologia => {
    const salida: ColumnaTipologia = {};

    for (const fila of [...TODAS_LAS_FILAS, FILA_PROPIA]) {
      const valor = deLaMano[fila] ?? deLaPropuesta[fila];

      if (valor !== undefined) salida[fila] = valor;
    }

    return salida;
  };

  return {
    aFavor: junta(propuesta.aFavor, escrita.aFavor),
    enContra: junta(propuesta.enContra, escrita.enContra),
  };
}
