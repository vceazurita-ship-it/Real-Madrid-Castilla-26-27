/**
 * OPTA EN LA FICHA INDIVIDUAL (09/11/2026).
 *
 * Lo que la ficha necesita de Opta y no está en `lib/opta.ts`:
 *
 * - **Quién es quién.** Opta escribe el nombre a su manera («Ávaro Leiva»,
 *   «Cestero», «Dani Meso») y la hoja a la suya. Se casa como Wyscout y
 *   BeSoccer: primero una tabla de excepciones a mano, luego `casaNombre`
 *   (sin tildes, nombre completo y, si no, por apellido único), que ya
 *   aplica las equivalencias de `lib/data-analisis/nombres.ts`.
 * - **El puesto.** Opta da el puesto fino («Left Centre Back»); para
 *   compararse se agrupa en seis, los mismos que usa la ficha con Wyscout.
 * - **Las métricas**, con su nombre en castellano, su grupo, si se leen por
 *   90′ o como porcentaje y si más es mejor.
 *
 * Aquí no hay ningún dato de Opta: el repo es público. Los datos se leen en
 * vivo con `traeOpta` (/api/docs).
 */

import { casaNombre } from "@/lib/data-analisis/once";
import { normalizePlayerName } from "@/lib/playerImages";
import { num, type Celda } from "@/lib/opta";

export type FilaOpta = Record<string, Celda>;

/* ------------------------------------------------------------------ */
/*  CRUCE DE NOMBRES                                                   */
/* ------------------------------------------------------------------ */

/**
 * Nombre de la plantilla (normalizado: sin tildes, en minúsculas) → nombre
 * de Opta. Sólo los que el cruce automático no resuelve: «Dani Mesonero» no
 * comparte apellido con «Dani Meso», y el nombre de pila no se prueba nunca
 * (casaría a un Diego con otro).
 */
export const EXCEPCIONES_OPTA: Record<string, string> = {
  "dani mesonero": "Dani Meso",
  "daniel mesonero": "Dani Meso",
  "d mesonero": "Dani Meso",
  mesonero: "Dani Meso",
};

/** La fila de Opta de un jugador de la plantilla (o null si no está). */
export function casaOpta<T extends FilaOpta>(nombre: string, apodo: string | undefined, filas: T[]): T | null {
  const nombreDe = (f: T) => String(f.jugador ?? "");

  for (const n of [nombre, apodo]) {
    if (!n) continue;
    const excepcion = EXCEPCIONES_OPTA[normalizePlayerName(n)];
    if (excepcion) {
      const f = filas.find((x) => normalizePlayerName(nombreDe(x)) === normalizePlayerName(excepcion));
      if (f) return f;
    }
  }

  return casaNombre(nombre, filas, nombreDe) ?? (apodo ? casaNombre(apodo, filas, nombreDe) : null);
}

/* ------------------------------------------------------------------ */
/*  PUESTOS                                                            */
/* ------------------------------------------------------------------ */

export type PuestoOpta = "POR" | "CEN" | "LAT" | "MED" | "BAN" | "DEL";

export const NOMBRE_PUESTO: Record<PuestoOpta, { uno: string; varios: string }> = {
  POR: { uno: "Portero", varios: "porteros" },
  CEN: { uno: "Central", varios: "centrales" },
  LAT: { uno: "Lateral", varios: "laterales" },
  MED: { uno: "Mediocentro", varios: "mediocentros" },
  BAN: { uno: "Banda / mediapunta", varios: "jugadores de banda y mediapuntas" },
  DEL: { uno: "Delantero", varios: "delanteros" },
};

/** «Left Centre Back» → CEN. */
export function puestoOpta(detallado: Celda | undefined): PuestoOpta | null {
  const p = String(detallado ?? "");
  if (!p) return null;
  if (/goalkeeper/i.test(p)) return "POR";
  if (/centre back|central defender/i.test(p)) return "CEN";
  if (/back/i.test(p)) return "LAT";
  if (/defensive midfielder|central midfielder/i.test(p)) return "MED";
  if (/attacking midfielder|winger|left midfielder|right midfielder/i.test(p)) return "BAN";
  if (/forward|striker/i.test(p)) return "DEL";
  return null;
}

/* ------------------------------------------------------------------ */
/*  MÉTRICAS                                                           */
/* ------------------------------------------------------------------ */

export type MetricaFicha = {
  /** Columna de Opta (o clave derivada). */
  a: string;
  nombre: string;
  grupo: string;
  /** p90: total → por 90′; pct: tanto por uno de Opta; dif: valor tal cual (diferencia de goles). */
  modo: "p90" | "pct" | "dif";
  mejorAlto: boolean;
  /** Para los porcentajes: la columna con los intentos (cuántos hay detrás). */
  base?: string;
  /** Derivada de otras columnas. */
  calcula?: (f: FilaOpta) => number | null;
  /** Sólo para estos puestos; sin esto, todos menos el portero. */
  puestos?: PuestoOpta[];
  /** Si también vale para el portero. */
  tambienPortero?: boolean;
};

const cociente = (a: string, b: string) => (f: FilaOpta) => {
  const x = num(f[a]);
  const y = num(f[b]);
  return x != null && y != null && y > 0 ? x / y : null;
};

export const GRUPOS_FICHA = ["Gol", "Creación", "Circulación", "Centros y regate", "Duelos", "Defensa", "Pérdidas y faltas", "Portería"] as const;

export const METRICAS_FICHA: MetricaFicha[] = [
  { a: "Goal", nombre: "Goles", grupo: "Gol", modo: "p90", mejorAlto: true },
  { a: "GoalExPn", nombre: "Goles sin penaltis", grupo: "Gol", modo: "p90", mejorAlto: true },
  { a: "ExpG", nombre: "Goles esperados (xG)", grupo: "Gol", modo: "p90", mejorAlto: true },
  { a: "ShtIncBl", nombre: "Remates", grupo: "Gol", modo: "p90", mejorAlto: true },
  { a: "SOG", nombre: "Remates a puerta", grupo: "Gol", modo: "p90", mejorAlto: true },
  { a: "OnTarget%", nombre: "Remates a puerta %", grupo: "Gol", modo: "pct", mejorAlto: true, base: "ShtIncBl" },
  { a: "TouchOpBox", nombre: "Toques en el área rival", grupo: "Gol", modo: "p90", mejorAlto: true },

  { a: "Chance", nombre: "Ocasiones creadas", grupo: "Creación", modo: "p90", mejorAlto: true },
  { a: "KeyPass", nombre: "Pases clave", grupo: "Creación", modo: "p90", mejorAlto: true },
  { a: "Ast", nombre: "Asistencias", grupo: "Creación", modo: "p90", mejorAlto: true },
  { a: "xA", nombre: "Asistencias esperadas (xA)", grupo: "Creación", modo: "p90", mejorAlto: true },
  { a: "ThrghBlCmp", nombre: "Pases al hueco completados", grupo: "Creación", modo: "p90", mejorAlto: true },
  { a: "KPAf1v1", nombre: "Pases clave tras regate", grupo: "Creación", modo: "p90", mejorAlto: true },

  { a: "Touches", nombre: "Toques", grupo: "Circulación", modo: "p90", mejorAlto: true, tambienPortero: true },
  { a: "PsAtt", nombre: "Pases intentados", grupo: "Circulación", modo: "p90", mejorAlto: true, tambienPortero: true },
  { a: "Pass%", nombre: "Acierto en el pase", grupo: "Circulación", modo: "pct", mejorAlto: true, base: "PsAtt", tambienPortero: true },
  { a: "Ps%InA3rd", nombre: "Acierto en el pase en el último tercio", grupo: "Circulación", modo: "pct", mejorAlto: true, base: "TchsA3" },
  { a: "LgBallCp", nombre: "Balones largos completados", grupo: "Circulación", modo: "p90", mejorAlto: true, tambienPortero: true },
  { a: "LongBall%", nombre: "Acierto en balón largo", grupo: "Circulación", modo: "pct", mejorAlto: true, base: "LgBall", tambienPortero: true },
  { a: "TchsA3", nombre: "Toques en el último tercio", grupo: "Circulación", modo: "p90", mejorAlto: true },

  { a: "Crosses", nombre: "Centros", grupo: "Centros y regate", modo: "p90", mejorAlto: true },
  { a: "CrossCmp", nombre: "Centros completados", grupo: "Centros y regate", modo: "p90", mejorAlto: true },
  { a: "Cross%", nombre: "Acierto en el centro", grupo: "Centros y regate", modo: "pct", mejorAlto: true, base: "Crosses", calcula: cociente("CrossCmp", "Crosses") },
  { a: "1v1InBox", nombre: "Regates intentados en el área", grupo: "Centros y regate", modo: "p90", mejorAlto: true },
  { a: "Sc1v1InBox", nombre: "Regates logrados en el área", grupo: "Centros y regate", modo: "p90", mejorAlto: true },

  { a: "Duel%", nombre: "Duelos ganados %", grupo: "Duelos", modo: "pct", mejorAlto: true },
  { a: "Tackle%", nombre: "Acierto en la entrada", grupo: "Duelos", modo: "pct", mejorAlto: true },
  { a: "AerialWon", nombre: "Duelos aéreos ganados", grupo: "Duelos", modo: "p90", mejorAlto: true },
  { a: "Aerial%", nombre: "Duelos aéreos ganados %", grupo: "Duelos", modo: "pct", mejorAlto: true },
  { a: "Arl%DH", nombre: "Aéreos ganados en campo propio %", grupo: "Duelos", modo: "pct", mejorAlto: true },
  { a: "Arl%AH", nombre: "Aéreos ganados en campo rival %", grupo: "Duelos", modo: "pct", mejorAlto: true },

  { a: "Recovery", nombre: "Recuperaciones", grupo: "Defensa", modo: "p90", mejorAlto: true },
  { a: "PosWonA3rd", nombre: "Recuperaciones en el último tercio", grupo: "Defensa", modo: "p90", mejorAlto: true },
  { a: "PosWonM3rd", nombre: "Recuperaciones en el tercio medio", grupo: "Defensa", modo: "p90", mejorAlto: true },
  { a: "PosWonD3rd", nombre: "Recuperaciones en el tercio propio", grupo: "Defensa", modo: "p90", mejorAlto: true },
  { a: "Int", nombre: "Interceptaciones", grupo: "Defensa", modo: "p90", mejorAlto: true },
  { a: "Clrnce", nombre: "Despejes", grupo: "Defensa", modo: "p90", mejorAlto: true },
  { a: "CrossBlkd", nombre: "Centros bloqueados", grupo: "Defensa", modo: "p90", mejorAlto: true },

  { a: "PossLost", nombre: "Pérdidas", grupo: "Pérdidas y faltas", modo: "p90", mejorAlto: false },
  { a: "PsLostD3", nombre: "Pérdidas en el tercio propio", grupo: "Pérdidas y faltas", modo: "p90", mejorAlto: false },
  { a: "Disposs", nombre: "Veces desposeído", grupo: "Pérdidas y faltas", modo: "p90", mejorAlto: false },
  { a: "FoulCom", nombre: "Faltas cometidas", grupo: "Pérdidas y faltas", modo: "p90", mejorAlto: false },
  { a: "FoulSuf", nombre: "Faltas recibidas", grupo: "Pérdidas y faltas", modo: "p90", mejorAlto: true },
  { a: "Yellow", nombre: "Amarillas", grupo: "Pérdidas y faltas", modo: "p90", mejorAlto: false },

  { a: "Saves", nombre: "Paradas", grupo: "Portería", modo: "p90", mejorAlto: true, puestos: ["POR"] },
  { a: "SvInBox", nombre: "Paradas dentro del área", grupo: "Portería", modo: "p90", mejorAlto: true, puestos: ["POR"] },
  { a: "CrossClaim", nombre: "Centros atrapados", grupo: "Portería", modo: "p90", mejorAlto: true, puestos: ["POR"] },
  { a: "CrossPunch", nombre: "Centros despejados de puños", grupo: "Portería", modo: "p90", mejorAlto: true, puestos: ["POR"] },
  { a: "GAg", nombre: "Goles encajados", grupo: "Portería", modo: "p90", mejorAlto: false, puestos: ["POR"] },
  { a: "GABA", nombre: "Goles evitados (xG en contra − encajados)", grupo: "Portería", modo: "dif", mejorAlto: true, puestos: ["POR"] },
];

/** Las métricas que se miran en un puesto. */
export function metricasDelPuesto(p: PuestoOpta) {
  return METRICAS_FICHA.filter((m) => (m.puestos ? m.puestos.includes(p) : p !== "POR" || m.tambienPortero));
}

/** El valor de la métrica en una fila: por 90′, en tanto por uno o tal cual. */
export function valorFicha(m: MetricaFicha, f: FilaOpta): number | null {
  const crudo = m.calcula ? m.calcula(f) : num(f[m.a]);
  if (crudo == null) return null;
  if (m.modo !== "p90") return crudo;
  const min = num(f.Min);
  return min && min > 0 ? (crudo / min) * 90 : null;
}

const coma = (n: number, d: number) => n.toFixed(d).replace(".", ",").replace(/^-/, "−");

/** «72,4 %», «1,35» (por 90′) o «+0,8». */
export function textoFicha(m: Pick<MetricaFicha, "modo">, v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "";
  if (m.modo === "pct") return `${coma(v * 100, 1)} %`;
  if (m.modo === "dif") return `${v > 0 ? "+" : ""}${coma(v, 2)}`;
  return coma(v, Math.abs(v) >= 10 ? 1 : 2);
}

/* ------------------------------------------------------------------ */
/*  PARTIDO A PARTIDO (opta:castilla-partidos)                         */
/* ------------------------------------------------------------------ */

/** Las columnas de opta:castilla-partidos que se pueden seguir, con su nombre. */
export const METRICAS_PARTIDO: { a: string; nombre: string; pct?: boolean; grupo: string; portero?: boolean }[] = [
  { a: "Min", nombre: "Minutos", grupo: "Participación" },
  { a: "Touches", nombre: "Toques", grupo: "Participación", portero: true },
  { a: "PsAtt", nombre: "Pases intentados", grupo: "Circulación", portero: true },
  { a: "Pass%", nombre: "Acierto en el pase", pct: true, grupo: "Circulación", portero: true },
  { a: "Ps%InA3rd", nombre: "Acierto en el pase en el último tercio", pct: true, grupo: "Circulación" },
  { a: "LgBall", nombre: "Balones largos", grupo: "Circulación", portero: true },
  { a: "LgBallCp", nombre: "Balones largos completados", grupo: "Circulación", portero: true },
  { a: "Chance", nombre: "Ocasiones creadas", grupo: "Creación" },
  { a: "KeyPass", nombre: "Pases clave", grupo: "Creación" },
  { a: "Ast", nombre: "Asistencias", grupo: "Creación" },
  { a: "xA", nombre: "Asistencias esperadas (xA)", grupo: "Creación" },
  { a: "Goal", nombre: "Goles", grupo: "Gol" },
  { a: "ExpG", nombre: "Goles esperados (xG)", grupo: "Gol" },
  { a: "ShtIncBl", nombre: "Remates", grupo: "Gol" },
  { a: "SOG", nombre: "Remates a puerta", grupo: "Gol" },
  { a: "TouchOpBox", nombre: "Toques en el área rival", grupo: "Gol" },
  { a: "Crosses", nombre: "Centros", grupo: "Centros y regate" },
  { a: "CrossCmp", nombre: "Centros completados", grupo: "Centros y regate" },
  { a: "1v1InBox", nombre: "Regates intentados en el área", grupo: "Centros y regate" },
  { a: "Sc1v1InBox", nombre: "Regates logrados en el área", grupo: "Centros y regate" },
  { a: "Duel%", nombre: "Duelos ganados %", pct: true, grupo: "Duelos" },
  { a: "Tackle%", nombre: "Acierto en la entrada", pct: true, grupo: "Duelos" },
  { a: "AerialWon", nombre: "Duelos aéreos ganados", grupo: "Duelos" },
  { a: "Aerial%", nombre: "Duelos aéreos ganados %", pct: true, grupo: "Duelos" },
  { a: "Recovery", nombre: "Recuperaciones", grupo: "Defensa", portero: true },
  { a: "PosWonA3rd", nombre: "Recuperaciones en el último tercio", grupo: "Defensa" },
  { a: "Int", nombre: "Interceptaciones", grupo: "Defensa" },
  { a: "Clrnce", nombre: "Despejes", grupo: "Defensa", portero: true },
  { a: "PossLost", nombre: "Pérdidas", grupo: "Pérdidas y faltas", portero: true },
  { a: "Disposs", nombre: "Veces desposeído", grupo: "Pérdidas y faltas" },
  { a: "FoulCom", nombre: "Faltas cometidas", grupo: "Pérdidas y faltas" },
  { a: "FoulSuf", nombre: "Faltas recibidas", grupo: "Pérdidas y faltas" },
  { a: "Saves", nombre: "Paradas", grupo: "Portería", portero: true },
  { a: "GAg", nombre: "Goles encajados", grupo: "Portería", portero: true },
];
