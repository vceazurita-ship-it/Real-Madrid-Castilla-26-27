/**
 * EL PUESTO DE UNA CIFRA ENTRE LOS EQUIPOS DE LA LIGA (16/11/2026).
 *
 * Una sola cuenta para todas las pantallas del rival (Plantillas, Scout
 * colectivo, Área, ABP, el informe) y para DATA. Antes cada una sacaba el
 * puesto a su manera —del percentil redondeado, del orden con empates, de
 * «más a menos» aunque la métrica tuviera sentido— y el juez de fútbol vio al
 * Murcia «2.º de 20», «19.º» y «de grupo medio» en presión, y sus centros
 * precisos «18.º» en una pantalla y «19.º» en otra para el mismo 28,8 %.
 *
 * Las reglas, en un sitio:
 * - **Sentido de lectura por métrica** (`mejorAlto`): con `true`, 1.º el que
 *   más; con `false` (PPDA, pérdidas, remates en contra), 1.º el que menos
 *   —en PPDA, el que más aprieta—; con `null` (estilo), de más a menos.
 * - **Empates**: comparten puesto (1 + los que están estrictamente mejor).
 * - **Mediana de verdad**: con un número par de equipos, la media de los dos
 *   del medio (con 20 equipos la «de arriba» daba 15,2 % donde la de verdad es
 *   15,0 %).
 * - **Fuerte / flojo sólo en los extremos**: entre los 6 primeros de 20 (el
 *   30 % de arriba) es fortaleza; entre los 6 últimos, carencia. Lo de en medio
 *   —y lo que vale lo mismo que la mediana— no es ni una cosa ni otra.
 *
 * Es puro (sin imports) para poder usarlo en el servidor, en el navegador y en
 * los arneses de Node.
 */

export type LecturaPuesto = "fuerte" | "flojo" | null;

export type PuestoEnLiga = {
  valor: number;
  /** 1 = el primero en el sentido de lectura de la métrica. */
  puesto: number;
  /** Cuántos equipos entran en la cuenta (el propio incluido). */
  de: number;
  mediana: number;
  minimo: number;
  maximo: number;
  /** 0-100, ya orientado: 100 es el mejor (o el que más, en las de estilo). */
  percentil: number;
  /** Fortaleza o carencia sólo en los extremos; `null` en medio o sin sentido. */
  lectura: LecturaPuesto;
};

/** Cuántos puestos de cada punta cuentan como extremo: 6 de 20. */
export const PARTE_EXTREMA = 0.3;

export function extremosDe(de: number) {
  return Math.max(1, Math.floor(de * PARTE_EXTREMA));
}

/** La mediana de verdad: con un número par, la media de los dos del medio. */
export function medianaLiga(valores: number[]): number {
  const orden = valores.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);

  if (orden.length === 0) return 0;

  const medio = Math.floor(orden.length / 2);

  return orden.length % 2 ? orden[medio] : (orden[medio - 1] + orden[medio]) / 2;
}

/**
 * ¿Vale lo mismo que la mediana? Con el redondeo con el que se enseña: un
 * decimal, o dos en las cifras por debajo de 1 (xG por remate…).
 */
export function enLaMediana(valor: number, mediana: number) {
  const decimales = Math.abs(mediana) >= 1 ? 1 : 2;

  return valor.toFixed(decimales) === mediana.toFixed(decimales);
}

/**
 * ¿Fortaleza, carencia o ninguna? Sólo con sentido de lectura, en los
 * extremos y fuera de la mediana.
 */
export function lecturaDePuesto(
  puesto: number,
  de: number,
  mejorAlto: boolean | null,
  vaEnLaMediana = false,
): LecturaPuesto {
  if (mejorAlto === null || de < 4 || vaEnLaMediana) return null;

  const extremo = extremosDe(de);

  if (puesto <= extremo) return "fuerte";
  if (puesto > de - extremo) return "flojo";

  return null;
}

/**
 * El puesto de `valor` entre `valores` (los de todos los equipos de la misma
 * población, el propio incluido), con el sentido de la métrica.
 *
 * Devuelve `null` con menos de 4 equipos: no hay liga con la que comparar.
 */
export function puestoEnLiga(
  valor: number,
  valores: number[],
  mejorAlto: boolean | null,
): PuestoEnLiga | null {
  const todos = valores.filter((v) => Number.isFinite(v));

  if (!Number.isFinite(valor) || todos.length < 4) return null;

  /* 1.º el que más, salvo las de «menos es mejor». */
  const mejorQue = (a: number, b: number) => (mejorAlto === false ? a < b : a > b);

  /* Comparación con un margen mínimo: dos medias de la misma cifra pueden
     diferir en la decimoquinta cifra y no son dos puestos. */
  const igual = (a: number, b: number) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));

  const mejores = todos.filter((v) => !igual(v, valor) && mejorQue(v, valor)).length;
  const peores = todos.filter((v) => !igual(v, valor) && mejorQue(valor, v)).length;
  const iguales = todos.length - mejores - peores;

  const de = todos.length;
  const puesto = mejores + 1;
  const mediana = medianaLiga(todos);


  return {
    valor,
    puesto,
    de,
    mediana,
    minimo: Math.min(...todos),
    maximo: Math.max(...todos),
    percentil: Math.round(((peores + iguales / 2) / de) * 100),
    lectura: lecturaDePuesto(puesto, de, mejorAlto, enLaMediana(valor, mediana)),
  };
}

/** «2.º de 20». */
export function textoPuesto(p: Pick<PuestoEnLiga, "puesto" | "de">) {
  return `${p.puesto}.º de ${p.de}`;
}
