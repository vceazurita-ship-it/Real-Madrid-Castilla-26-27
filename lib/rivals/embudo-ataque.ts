/**
 * EMBUDO DEL ATAQUE (Scout colectivo, 16/11/2026): de cada cien secuencias
 * del rival, cuántas llegan al último tercio, cuánto toca el área cada vez
 * que llega y cuántas veces remata. Y lo mismo de lo que le hacen a él (la
 * fila del contrario en sus partidos), para ver si su defensa cae antes del
 * área o dentro. Al lado de cada escalón, la media de nuestro grupo.
 *
 * Sobre `opta:partidos` (equipo × partido):
 * - `Sequences`: secuencias (la cadena de una posesión), la base.
 * - `SeqEndInA3`: secuencias que llegan al último tercio (x > 66,7).
 * - `TouchOpBox`: toques en el área rival. Son TOQUES, no secuencias: no
 *   hay un «% de paso» honrado, así que se da por cada llegada.
 * - `ShtIncBl`: remates (con los bloqueados). Una secuencia puede tener dos
 *   remates: «remates por llegada» es la cota alta de las que acaban en remate.
 *
 * Opta no trae, partido a partido, las secuencias con tres pases o más en el
 * último tercio ni las que tocan el área: esos escalones no se inventan.
 *
 * Un cociente no se promedia: se suma arriba y abajo de todos sus partidos.
 * La media del grupo es la media de los cocientes de cada equipo del grupo.
 */

import { num } from "@/lib/opta";
import { partidosPorEquipo } from "@/lib/opta-evolucion";
import type { Fila, PartidoEquipo } from "@/lib/opta-analisis";

export type LadoEmbudo = "ataque" | "defensa";

type Sumas = { partidos: number; secuencias: number; tercio: number; toques: number; remates: number };

export type Escalon = {
  key: "secuencias" | "tercio" | "toques" | "remates";
  rotulo: string;
  /** Por partido. */
  porPartido: number;
  /** El paso desde el escalón que toca (en %, o por llegada en toques/remates). */
  paso: number | null;
  /** El mismo paso, media del grupo. */
  pasoLiga: number | null;
  unidad: "%" | "por llegada";
  /** Ancho de la barra: parte de las secuencias (0-1). */
  ancho: number;
};

export type Embudo = { lado: LadoEmbudo; partidos: number; escalones: Escalon[] };

function suma(suyos: PartidoEquipo[], lado: LadoEmbudo): Sumas | null {
  const s: Sumas = { partidos: 0, secuencias: 0, tercio: 0, toques: 0, remates: 0 };
  for (const p of suyos) {
    const f = lado === "ataque" ? p.fila : p.otra;
    if (!f) continue;
    const sec = num(f.Sequences);
    const ter = num(f.SeqEndInA3);
    const toq = num(f.TouchOpBox);
    const rem = num(f.ShtIncBl);
    /* Sólo los partidos con las cuatro: si no, el cociente mezcla partidos. */
    if (sec == null || ter == null || toq == null || rem == null || sec <= 0) continue;
    s.partidos++;
    s.secuencias += sec;
    s.tercio += ter;
    s.toques += toq;
    s.remates += rem;
  }
  return s.partidos ? s : null;
}

const pasos = (s: Sumas) => ({
  tercio: (s.tercio / s.secuencias) * 100,
  toques: s.tercio > 0 ? s.toques / s.tercio : null,
  remates: s.tercio > 0 ? s.remates / s.tercio : null,
});

const media = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x != null && Number.isFinite(x));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};

/** Los dos embudos del rival (su ataque y lo que le atacan), con la media del grupo. */
export function embudosDe(partidos: Fila[], rivalId: string, grupo: Set<string>): Embudo[] {
  const porEquipo = partidosPorEquipo(partidos);
  const suyos = porEquipo.get(rivalId) ?? [];

  return (["ataque", "defensa"] as const).flatMap((lado) => {
    const s = suma(suyos, lado);
    if (!s) return [];
    const p = pasos(s);
    const liga = [...grupo].map((id) => suma(porEquipo.get(id) ?? [], lado)).filter((x): x is Sumas => x != null).map(pasos);
    const ligaTercio = media(liga.map((l) => l.tercio));
    const ligaToques = media(liga.map((l) => l.toques));
    const ligaRemates = media(liga.map((l) => l.remates));
    const n = s.partidos;
    const ancho = (v: number) => Math.max(0, Math.min(1, v / s.secuencias));

    const escalones: Escalon[] = [
      { key: "secuencias", rotulo: "Secuencias", porPartido: s.secuencias / n, paso: null, pasoLiga: null, unidad: "%", ancho: 1 },
      { key: "tercio", rotulo: "Llegan al último tercio", porPartido: s.tercio / n, paso: p.tercio, pasoLiga: ligaTercio, unidad: "%", ancho: ancho(s.tercio) },
      /* Los toques no son secuencias: la barra no pasa de la de las llegadas. */
      { key: "toques", rotulo: "Toques en el área", porPartido: s.toques / n, paso: p.toques, pasoLiga: ligaToques, unidad: "por llegada", ancho: Math.min(ancho(s.toques), ancho(s.tercio)) },
      { key: "remates", rotulo: "Remates", porPartido: s.remates / n, paso: p.remates, pasoLiga: ligaRemates, unidad: "por llegada", ancho: Math.min(ancho(s.remates), ancho(s.tercio)) },
    ];
    return [{ lado, partidos: n, escalones }];
  });
}

/** Cuánto se aparta un paso de la media (+0,2 = un 20 % más). */
export const desvio = (e: Escalon) => (e.paso != null && e.pasoLiga != null && e.pasoLiga > 0 ? e.paso / e.pasoLiga - 1 : null);

/** Por debajo de ±8 % se da por «como la media». */
export const UMBRAL_DESVIO = 0.08;

/**
 * La frase del embudo: en ataque, dónde se le corta; en defensa, dónde cae.
 * Sólo nombra lo que se aparta de la media.
 */
export function lecturaEmbudo(e: Embudo, nombre: string): string | null {
  const [, tercio, toques, remates] = e.escalones;
  const dT = desvio(tercio);
  const dA = desvio(toques);
  const dR = desvio(remates);
  if (dT == null || dA == null || dR == null) return null;
  const alto = (d: number) => d >= UMBRAL_DESVIO;
  const bajo = (d: number) => d <= -UMBRAL_DESVIO;

  if (e.lado === "ataque") {
    if (alto(dT) && (bajo(dA) || bajo(dR)))
      return `${nombre} pisa el último tercio más que la media, pero ${bajo(dA) ? "pisa poco el área" : "remata poco"} cuando llega: se le corta dejándole llegar y cerrando el área.`;
    if (bajo(dT) && (alto(dA) || alto(dR)))
      return `${nombre} llega poco al último tercio, pero cuando llega ${alto(dR) ? "remata" : "toca el área"} más que la media: hay que cortarle antes, en la llegada.`;
    if (alto(dT) && alto(dR)) return `${nombre} llega y remata por encima de la media: hay que cortarle en la llegada al último tercio.`;
    if (bajo(dT) && bajo(dR)) return `${nombre} llega y remata por debajo de la media: le cuesta en todos los escalones.`;
    return null;
  }

  if (alto(dT) && !alto(dR)) return `A ${nombre} le llegan al último tercio más que a la media, pero desde ahí le rematan ${bajo(dR) ? "menos" : "lo normal"}: su defensa cede campo y aguanta en el área.`;
  if (!alto(dT) && alto(dR)) return `A ${nombre} no le llegan más que a la media, pero cuando le llegan le rematan más: su defensa cae dentro del área.`;
  if (alto(dT) && alto(dR)) return `A ${nombre} le llegan y le rematan por encima de la media: su defensa cae antes y dentro del área.`;
  if (bajo(dT) && bajo(dR)) return `A ${nombre} le llegan y le rematan menos que a la media: defiende bien antes y dentro del área.`;
  return null;
}
