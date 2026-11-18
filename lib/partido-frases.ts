/*
| LAS FRASES DEL ÚLTIMO PARTIDO, UNA SOLA VEZ (18/11/2026, ronda 23).
|
| La portada («El último partido») y Análisis de datos (post del partido, las
| tres claves, el 3D y el directo ya jugado) cuentan el mismo partido. Los
| jueces vieron «Castilla 62 %» en una y «Gimnàstic 39 %» en la otra, y
| «Victoria con menos ocasiones» frente a «Ganamos 1-0 creando menos». Aquí
| vive la única versión de cada frase, siempre contada desde el Castilla.
*/

import { GX, GY, territorioRetrato, type Retrato } from "@/lib/opta-retrato";

const d1 = (v: number) => v.toFixed(1).replace(".", ",");

/** Palabras que no dicen quién es un equipo («CD», «Real», «Unión»…). */
const GENERICAS = new Set(["cd", "ud", "cf", "sd", "fc", "ad", "rcd", "sad", "club", "deportivo", "de", "del", "la", "real", "union", "unión", "juventud", "balompie", "balompié"]);

/** El nombre corto de un rival: una sola palabra que diga quién es («Gimnàstic», «Murcia», «Andreu»). */
export function nombreCorto(n: string) {
  const palabras = n.split(/\s+/).filter(Boolean);
  return palabras.find((p) => p.length > 4 && !GENERICAS.has(p.toLowerCase())) ?? palabras.find((p) => !GENERICAS.has(p.toLowerCase())) ?? n;
}

/**
 * El titular del partido: resultado (el nuestro primero) y goles esperados.
 * «Ganamos 1-0 con menos goles esperados (0,5 – 0,7)». Con una diferencia de
 * menos de 0,15, «parejos».
 */
export function titularPartido(gf: number, gc: number, xgNos: number, xgEllos: number) {
  const res = gf > gc ? "Ganamos" : gf < gc ? "Perdimos" : "Empatamos";
  const dif = xgNos - xgEllos;
  const como = Math.abs(dif) < 0.15 ? "con goles esperados parejos" : dif > 0 ? "con más goles esperados" : "con menos goles esperados";
  return `${res} ${gf}-${gc} ${como} (${d1(xgNos)} – ${d1(xgEllos)})`;
}

/** Desde qué minuto es «el tramo final» del campo pisado. */
export const DESDE_TRAMO_FINAL = 75;

/** De lo que pasa en las mitades rivales entre dos minutos (incluidos), cuánto es del equipo A del retrato. */
export function territorioEntre(r: Retrato, desde: number, hasta: number): number | null {
  let a = 0;
  let b = 0;
  for (let m = Math.max(0, desde); m <= Math.min(hasta, r.minutos - 1); m++) {
    const ma = r.a[m];
    const mb = r.b[m];
    /* La malla es GX × GY por filas: la mitad derecha de cada fila es campo rival para A; la izquierda, para B (dado la vuelta). Igual que `territorioRetrato`. */
    for (let i = 0; i < GX * GY; i++) {
      if (i % GX >= GX / 2) a += ma[i];
      else b += mb[i];
    }
  }
  return a + b > 0 ? a / (a + b) : null;
}

/**
 * «Pisamos campo rival el 62 % del partido; en el tramo final (desde el 75′),
 * el Gimnàstic, el 89 %». El retrato, con A = el equipo que se cuenta
 * (`nombreA`); si A es el Castilla, en primera persona.
 */
export function fraseCampoPisado(r: Retrato, nombreA: string, nombreB: string, aEsNuestro: boolean): string | null {
  const total = territorioRetrato(r, null);
  if (total == null) return null;
  const pct = (v: number) => `${Math.round(v * 100)} %`;
  const inicio = aEsNuestro ? `Pisamos campo rival el ${pct(total)} del partido` : `El ${nombreA} pisó campo rival el ${pct(total)} del partido`;
  const fin = r.minutos - 1 > DESDE_TRAMO_FINAL + 5 ? territorioEntre(r, DESDE_TRAMO_FINAL, r.minutos - 1) : null;
  if (fin == null) return `${inicio}.`;
  const tramo = `en el tramo final (desde el ${DESDE_TRAMO_FINAL}′)`;
  if (fin < 0.5) return `${inicio}; ${tramo}, el ${nombreB}, el ${pct(1 - fin)}.`;
  return `${inicio}; ${tramo}, ${aEsNuestro ? "nosotros" : `el ${nombreA}`}, el ${pct(fin)}.`;
}
