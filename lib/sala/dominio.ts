/*
|--------------------------------------------------------------------------
| DOMINAMOS EN xG Y EL MARCADOR NO LO REFLEJA (27/11/2026, idea de X)
|--------------------------------------------------------------------------
|
| En /directo, desde el minuto 30: si nuestro xG supera al del rival en más de
| 0,8 y la diferencia de goles a favor es de un gol o menos (empate, perdiendo
| o ganando por uno), aviso en la cabecera del marcador. Al lado, lo que nos
| pasó esta temporada en la misma situación al descanso: cuántos partidos se
| escaparon (empatados o perdidos al final).
|
| xG al descanso: la suma oficial de Opta por tramos de 5′ de la 1.ª parte
| (ExpG); sin tramos, el de los remates del evento a evento de la 1.ª parte.
*/

import { cifrasEntre, cifrasHasta, nombreEquipoCorto, type Cifras, type Lado, type Partido } from "./modelo";

export const DOMINIO_XG = 0.8;
export const DOMINIO_MAX_GOLES = 1;
export const DOMINIO_DESDE = 30;

const otro = (l: Lado): Lado => (l === "L" ? "V" : "L");

/** El aviso en directo: null si no jugamos, antes del 30′ o si no se da. */
export function dominioSinPremio(p: Partido, t: number, c: { L: Cifras; V: Cifras }) {
  if (!p.nuestro || t < DOMINIO_DESDE) return null;
  const yo = c[p.nuestro], el = c[otro(p.nuestro)];
  const dxg = yo.xg - el.xg;
  const dg = yo.goles - el.goles;
  return dxg > DOMINIO_XG && dg <= DOMINIO_MAX_GOLES ? { dxg, dg } : null;
}

/** Un partido ya jugado, mirado al descanso. `situacion` = dominábamos en xG (+0,8) con un gol de ventaja o menos. */
export type CasoDescanso = {
  id: string;
  fecha: string;
  rival: string;
  xgDescanso: [number, number];
  golesDescanso: [number, number];
  final: [number, number];
  situacion: boolean;
  /** Empatado o perdido al final. */
  escapado: boolean;
};

export function casoDescanso(p: Partido): CasoDescanso | null {
  if (!p.nuestro || !p.acabado) return null;
  const yo = p.nuestro, el = otro(yo);
  const p1 = cifrasEntre(p, 0, Number.POSITIVE_INFINITY, 1);
  const deTramos = (l: Lado) => {
    const suyos = p.tramos.filter((x) => x.lado === l && x.parte === 1 && typeof x.m.ExpG === "number");
    return suyos.length ? suyos.reduce((s, x) => s + (x.m.ExpG as number), 0) : null;
  };
  const tYo = deTramos(yo), tEl = deTramos(el);
  const xgYo = tYo != null && tEl != null ? tYo : p1[yo].xg;
  const xgEl = tYo != null && tEl != null ? tEl : p1[el].xg;
  const fin = cifrasHasta(p, p.ultimo);
  const situacion = xgYo - xgEl > DOMINIO_XG && p1[yo].goles - p1[el].goles <= DOMINIO_MAX_GOLES;
  return {
    id: p.id,
    fecha: p.fecha,
    rival: nombreEquipoCorto((el === "L" ? p.local : p.visitante).nombre),
    xgDescanso: [xgYo, xgEl],
    golesDescanso: [p1[yo].goles, p1[el].goles],
    final: [fin[yo].goles, fin[el].goles],
    situacion,
    escapado: fin[yo].goles <= fin[el].goles,
  };
}
