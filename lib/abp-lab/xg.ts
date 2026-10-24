/**
 * xG ESTIMADO DEL REMATE A BALÓN PARADO (laboratorio de ABP, 24/10/2026).
 *
 * Dos capas:
 * 1. **Geometría**: la probabilidad de gol de un remate según la distancia al
 *    centro de la portería y el ángulo con que se ven los dos palos. Dentro
 *    del área se supone de cabeza; fuera, con el pie. Son curvas logísticas
 *    del orden de las públicas (un cabezazo en el área pequeña ronda 0,25;
 *    desde el punto de penalti, 0,09; desde la frontal, 0,04).
 * 2. **Nuestros datos**: las hojas de ABP (`Zona_Remate`, `Resultado_Final` y
 *    `xG` cuando se rellena) de los partidos del Castilla. Por zona —primer
 *    palo, centro, segundo palo, frontal— se mezcla lo observado con la
 *    geometría (encogimiento con 10 remates de peso), así que con poca base
 *    manda la geometría y con mucha mandan nuestros partidos.
 *
 * Es una estimación para comparar rutinas entre sí, no una medición.
 */

import { abpResult, norm, num } from "@/lib/abp/model";
import type { SheetRow } from "@/lib/abp/sheets";
import type { Punto } from "@/lib/abp-lab/modelo";

export type ZonaRemate = "primer-palo" | "centro" | "segundo-palo" | "frontal";

export const ZONAS_REMATE: { key: ZonaRemate; label: string }[] = [
  { key: "primer-palo", label: "Primer palo" },
  { key: "centro", label: "Centro" },
  { key: "segundo-palo", label: "Segundo palo" },
  { key: "frontal", label: "Frontal" },
];

/** Dónde se remata, mirado desde el lado del saque (el primer palo es el del lado del balón). */
export function zonaDe(p: Punto, golpeo: Punto): ZonaRemate {
  if (p.y > 12) return "frontal";

  const cerca = golpeo.x <= 34 ? -1 : 1;

  const s = (p.x - 34) * cerca;

  if (s > 2.2) return "primer-palo";

  if (s < -2.2) return "segundo-palo";

  return "centro";
}

/** Un punto representativo de cada zona (córner desde la izquierda). */
const ANCLA: Record<ZonaRemate, Punto> = {
  "primer-palo": { x: 30.5, y: 4 },
  centro: { x: 34, y: 6 },
  "segundo-palo": { x: 38.5, y: 5 },
  frontal: { x: 34, y: 15 },
};

/** El ángulo (radianes) con el que se ven los dos palos desde un punto. */
function angulo(p: Punto) {
  const a = Math.atan2(30.34 - p.x, p.y);
  const b = Math.atan2(37.66 - p.x, p.y);

  return Math.abs(b - a);
}

const logistica = (z: number) => 1 / (1 + Math.exp(-z));

/** La probabilidad geométrica de gol de un remate desde `p`. */
export function xgGeometrico(p: Punto): number {
  const y = Math.max(0.3, p.y);

  const q = { x: p.x, y };

  const d = Math.hypot(q.x - 34, q.y);

  const a = angulo(q);

  const cabeza = q.y <= 16.5 && q.x >= 13.84 && q.x <= 54.16;

  const z = cabeza ? -2.0 + 1.5 * a - 0.11 * d : -1.2 + 1.1 * a - 0.13 * d;

  return Math.min(0.6, Math.max(0.005, logistica(z)));
}

/* ------------------------------------------------------------------ */
/*  CALIBRAR CON NUESTRAS HOJAS                                        */
/* ------------------------------------------------------------------ */

export type CalibreZona = {
  zona: ZonaRemate;
  /** Remates registrados en esa zona. */
  remates: number;
  goles: number;
  /** La media de la columna xG, si la hoja la trae rellena en la mayoría. */
  xgMedio: number | null;
  /** Por cuánto se multiplica la geometría en esa zona (1 = igual). */
  factor: number;
};

export type CalibreXg = { zonas: Record<ZonaRemate, CalibreZona>; remates: number };

/** Peso de la geometría, en remates: con menos de esto manda ella. */
const PESO_PREVIO = 10;

/** «1er palo», «Primer palo», «2º palo», «Central», «Frontal»… a su zona; null si no se reconoce. */
export function zonaDeTexto(texto: string): ZonaRemate | null {
  const t = norm(texto);

  if (!t || /^no\b|^-$/.test(t)) return null;

  if (/frontal|fuera|borde/.test(t)) return "frontal";

  if (/(1|primer)[^0-9]*palo|^1p|primer/.test(t)) return "primer-palo";

  if (/(2|segundo)[^0-9]*palo|^2p|segundo/.test(t)) return "segundo-palo";

  if (/centr|penalti|punto/.test(t)) return "centro";

  return null;
}

const celda = (fila: SheetRow, ...claves: string[]) => {
  for (const c of claves) {
    const v = fila[c];

    if (typeof v === "string" && v.trim()) return v.trim();
  }

  return "";
};

/**
 * La calibración por zona a partir de las filas de las hojas de ABP. Cada
 * hoja se pasa con el dueño implícito de su resultado (ver `lib/abp/model.ts`):
 * la ofensiva es nuestra; la defensiva, del rival que ataca.
 */
export function calibraXg(hojas: { filas: SheetRow[]; atacante: "rmcf" | "rival" }[]): CalibreXg | null {
  const acumula: Record<ZonaRemate, { n: number; goles: number; xg: number; conXg: number }> = {
    "primer-palo": { n: 0, goles: 0, xg: 0, conXg: 0 },
    centro: { n: 0, goles: 0, xg: 0, conXg: 0 },
    "segundo-palo": { n: 0, goles: 0, xg: 0, conXg: 0 },
    frontal: { n: 0, goles: 0, xg: 0, conXg: 0 },
  };

  for (const { filas, atacante } of hojas) {
    for (const fila of filas) {
      const zona = zonaDeTexto(celda(fila, "Zona_Remate", "Zona remate"));

      if (!zona) continue;

      const tipo = norm(celda(fila, "Tipo_Accion", "TipoAccion"));

      /* Los penaltis no son remates de jugada: se quedan fuera. */
      if (/penal|penati/.test(tipo)) continue;

      const resultado = abpResult(celda(fila, "Resultado_Final", "Resultado"), atacante);

      const gol = resultado.owner === atacante && resultado.rank === 5;

      const remate = /^s/i.test(celda(fila, "Remate")) || Boolean(celda(fila, "Rematador")) || gol;

      if (!remate) continue;

      const a = acumula[zona];

      a.n += 1;

      if (gol) a.goles += 1;

      const xg = num(celda(fila, "xG", "xg"));

      if (xg > 0 && xg < 1) {
        a.xg += xg;
        a.conXg += 1;
      }
    }
  }

  const total = Object.values(acumula).reduce((s, a) => s + a.n, 0);

  if (!total) return null;

  const zonas = Object.fromEntries(
    (Object.keys(acumula) as ZonaRemate[]).map((zona) => {
      const a = acumula[zona];

      const previo = xgGeometrico(ANCLA[zona]);

      /* Si la columna xG viene rellena en la mayoría, se usa su media; si no, los goles. */
      const conXg = a.conXg >= Math.max(3, a.n * 0.6);

      const observado = conXg ? (a.xg / a.conXg) * a.n : a.goles;

      const estimado = (observado + PESO_PREVIO * previo) / (a.n + PESO_PREVIO);

      return [zona, { zona, remates: a.n, goles: a.goles, xgMedio: conXg ? a.xg / a.conXg : null, factor: estimado / previo }];
    }),
  ) as Record<ZonaRemate, CalibreZona>;

  return { zonas, remates: total };
}

/** El xG de la geometría corregido por lo que dicen nuestros partidos en esa zona. */
export function xgEn(p: Punto, golpeo: Punto, calibre: CalibreXg | null): { xg: number; zona: ZonaRemate } {
  const zona = zonaDe(p, golpeo);

  const factor = calibre?.zonas[zona]?.factor ?? 1;

  return { xg: Math.min(0.75, xgGeometrico(p) * factor), zona };
}

/** «0,14» */
export const comaXg = (v: number) => v.toFixed(2).replace(".", ",");
