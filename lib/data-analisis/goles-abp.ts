import type { FilaPartido } from "./leer";

/**
 * LOS GOLES A BALÓN PARADO, DE TODA LA LIGA.
 *
 * Nadie publica de qué jugada nace cada gol de la categoría entera: Wyscout
 * **no clasifica los goles** y BeSoccer sólo distingue el penalti y la propia
 * puerta. Así que aquí conviven dos cosas que no pesan lo mismo y que la
 * pantalla dice por separado:
 *
 * - **Dato**: los goles (el marcador) y los penaltis marcados (Wyscout).
 * - **Estimación**: cuántos de los goles sin penalti vienen de córner y cuántos
 *   de falta. Se reparten según de dónde nacen los remates del equipo —ataque
 *   posicional, contraataque o balón parado, que es la taxonomía de Wyscout y
 *   es excluyente— **corregido por lo que convierte cada vía**.
 *
 * Esa corrección es lo que separa esto de un reparto a ojo. Repartir en
 * proporción a los remates supone que un remate de córner entra igual que uno
 * de jugada, y **no es verdad**: medido el 15/09/2026, sobre la 1ª RFEF
 * 2025/26 (698 filas de Wyscout), el reparto a pelo daba al córner el 22 % de
 * los goles sin penalti y el agregado de Opta de la categoría cuenta un 11 %
 * (12 de 106). Los dos factores de `CONVERSION_ABP` son los que hacen cuadrar
 * esa liga con Opta; con la 2026/27 salen 0,36 y 1,59 y con todo el dataset
 * junto 0,46 y 1,31, así que no son un capricho de una temporada.
 *
 * «Falta» es **falta y el resto de jugadas paradas** que no son córner ni
 * penalti —saques de banda largos, sobre todo—: Wyscout los mete en «jugadas a
 * balón parado» y Opta en «otras jugadas a balón parado», y ninguno de los dos
 * da el reparto fino.
 */

export const COLUMNAS_ABP = {
  penaltisMarcados: "Penaltis · marcados",
  posicional: "Ataques posicionales · con remate",
  contras: "Contraataques · con remate",
  abp: "Jugadas a balón parado · con remate",
  corners: "Córneres · con remate",
  faltas: "Tiros libres · con remate",
} as const;

/**
 * Cuánto convierte un remate de cada vía **comparado con uno de jugada**.
 *
 * Un remate de córner entra la mitad que uno de jugada (suele ser de cabeza,
 * con gente delante); el de falta y el resto de jugadas paradas, algo más (el
 * lanzamiento directo y el balón al segundo palo son ocasiones claras). Lo usan
 * esta pantalla y la tipología propuesta del informe del rival, para que las
 * dos digan lo mismo.
 */
export const CONVERSION_ABP = { corner: 0.49, falta: 1.35 } as const;

/**
 * Reparte N goles entre unos pesos sin que se pierda ni se invente ninguno.
 *
 * Es el reparto de restos mayores de toda la vida: cada fila se lleva su parte
 * entera y los goles que sobran van a las que más decimales dejaron. Redondear
 * cada una por su cuenta daría una tabla que no suma los goles del equipo, y
 * una tabla de goles que no cuadra con el marcador no se puede enseñar.
 */
export function reparte(
  total: number,
  pesos: [string, number][],
): Record<string, number> {
  const utiles = pesos.filter(([, peso]) => peso > 0);

  const acumulado = utiles.reduce((t, [, peso]) => t + peso, 0);

  if (total <= 0 || acumulado <= 0) return {};

  const crudos = utiles.map(([fila, peso]) => {
    const exacto = (peso / acumulado) * total;

    return { fila, entero: Math.floor(exacto), resto: exacto - Math.floor(exacto) };
  });

  let faltan = total - crudos.reduce((t, c) => t + c.entero, 0);

  for (const uno of [...crudos].sort((a, b) => b.resto - a.resto)) {
    if (faltan <= 0) break;

    uno.entero += 1;
    faltan -= 1;
  }

  const salida: Record<string, number> = {};

  for (const uno of crudos) {
    if (uno.entero > 0) salida[uno.fila] = uno.entero;
  }

  return salida;
}

export type GolesAbp = {
  /** Partidos que describen estas filas. */
  partidos: number;
  /** Todos los goles, del marcador. */
  goles: number;
  /** Dato: los penaltis marcados que cuenta Wyscout. */
  penalti: number;
  /** Estimación. */
  corner: number;
  /** Estimación: falta y el resto de jugadas paradas. */
  falta: number;
  /** Los tres juntos. */
  abp: number;
  /** Lo que no es balón parado: jugada, contra y propias puertas. */
  resto: number;
  /** Sin un solo remate clasificado no hay reparto, y no se inventa. */
  hayOrigen: boolean;
};

const suma = (filas: FilaPartido[], columna: string) =>
  filas.reduce((total, fila) => total + (Number(fila.datos[columna]) || 0), 0);

/**
 * Los goles a balón parado de unas filas.
 *
 * Las filas son las **del que marca**: las del propio equipo para lo que hace,
 * y las de sus rivales —el informe trae las dos de cada partido— para lo que
 * le hacen. El reparto se hace sobre la temporada entera del equipo y no
 * partido a partido: con un gol y seis remates, un partido suelto no tiene
 * proporción que valga.
 */
export function golesAbpDe(filas: FilaPartido[]): GolesAbp {
  const goles = filas.reduce((total, fila) => total + (fila.golesFavor || 0), 0);

  const penalti = Math.min(Math.round(suma(filas, COLUMNAS_ABP.penaltisMarcados)), goles);

  const jugada = suma(filas, COLUMNAS_ABP.posicional) + suma(filas, COLUMNAS_ABP.contras);
  const abp = suma(filas, COLUMNAS_ABP.abp);

  const corners = suma(filas, COLUMNAS_ABP.corners);
  const faltas = suma(filas, COLUMNAS_ABP.faltas);

  /* Wyscout no parte los remates de ABP por tipo: la parte de córner sale de
     cuántos córners y cuántas faltas acaban en remate. */
  const cuotaCorner = corners + faltas > 0 ? corners / (corners + faltas) : 1;

  const hayOrigen = jugada + abp > 0;

  const reparto = hayOrigen
    ? reparte(goles - penalti, [
        ["jugada", jugada],
        ["corner", abp * cuotaCorner * CONVERSION_ABP.corner],
        ["falta", abp * (1 - cuotaCorner) * CONVERSION_ABP.falta],
      ])
    : {};

  const corner = reparto.corner ?? 0;
  const falta = reparto.falta ?? 0;

  return {
    partidos: filas.length,
    goles,
    penalti,
    corner,
    falta,
    abp: penalti + corner + falta,
    resto: goles - penalti - corner - falta,
    hayOrigen,
  };
}

export type FilaGolesAbp = {
  equipo: string;
  aFavor: GolesAbp;
  enContra: GolesAbp;
};

/** Lo que marca un equipo y lo que le marcan, en las filas que se le den. */
export function golesAbpDeEquipo(equipo: string, filas: FilaPartido[]): FilaGolesAbp {
  return {
    equipo,
    aFavor: golesAbpDe(filas.filter((p) => p.equipo === equipo)),
    enContra: golesAbpDe(filas.filter((p) => p.rival === equipo)),
  };
}

/**
 * Los equipos de una temporada que tienen muestra para entrar en la tabla.
 *
 * El informe de cada equipo trae también la fila de su rival, así que en una
 * temporada aparecen equipos con un solo partido —el que jugaron contra uno de
 * los nuestros—. Ponerlos al lado de uno con treinta y ocho sería comparar un
 * partido con una temporada. El listón es **la mitad de los partidos del que
 * más tiene**: en las temporadas viejas, de las que sólo hay informes del
 * Castilla, deja al Castilla solo, que es la verdad.
 */
export function equiposConMuestra(filas: FilaPartido[]) {
  const cuenta = new Map<string, number>();

  for (const fila of filas) cuenta.set(fila.equipo, (cuenta.get(fila.equipo) ?? 0) + 1);

  const tope = Math.max(0, ...cuenta.values());

  const suelo = Math.max(1, Math.ceil(tope / 2));

  const equipos = [...cuenta]
    .filter(([, n]) => n >= suelo)
    .map(([equipo]) => equipo)
    .sort((a, b) => a.localeCompare(b, "es"));

  return { equipos, suelo, fuera: cuenta.size - equipos.length };
}
