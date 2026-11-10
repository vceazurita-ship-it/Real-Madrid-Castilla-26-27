/**
 * OPTA · BALÓN PARADO DE LA CATEGORÍA (09/11/2026).
 *
 * Lo que el laboratorio de ABP lee de `opta:equipos` (40 equipos, todas las
 * métricas de equipo) para poner al Castilla frente a su grupo y a toda
 * Primera RFEF en córners, faltas, saques de banda y penaltis.
 *
 * - **Grupos.** Opta no dice en qué grupo juega cada equipo: se deduce de
 *   `opta:partidos` (quién ha jugado contra quién). Cada grupo es un
 *   componente conexo del grafo de partidos.
 * - **Por partido** (las cuentas: córners, remates…) dividiendo por `GM`;
 *   **en la temporada** los goles y las asistencias, que son pocos y por
 *   partido serían 0,09; los porcentajes tal cual (Opta los da en tanto por
 *   uno).
 *
 * Sin datos de Opta aquí (el repo es público): sólo nombres y fórmulas.
 */

import { num, type Celda, type TablaOpta } from "@/lib/opta";

export type FilaEquipoOpta = Record<string, Celda>;

export type SeccionAbp = "Resumen" | "Córners" | "Faltas" | "Saques de banda" | "Penaltis";

export const SECCIONES_ABP: SeccionAbp[] = ["Resumen", "Córners", "Faltas", "Saques de banda", "Penaltis"];

export type MetricaAbpOpta = {
  clave: string;
  nombre: string;
  seccion: SeccionAbp;
  /** pp: por partido; total: en la temporada; pct: porcentaje (tanto por uno). */
  modo: "pp" | "total" | "pct";
  /** true: más es mejor; false: menos es mejor; null: estilo (ni mejor ni peor). */
  mejorAlto: boolean | null;
  /** El valor crudo (sin dividir por partidos). */
  valor: (f: FilaEquipoOpta) => number | null;
  /** Para los porcentajes: cuántos intentos hay detrás. */
  casos?: (f: FilaEquipoOpta) => number | null;
  comoLeer: string;
};

const col = (a: string) => (f: FilaEquipoOpta) => num(f[a]);
const suma = (...as: string[]) => (f: FilaEquipoOpta) => {
  const vs = as.map((a) => num(f[a]));
  return vs.some((v) => v == null) ? null : vs.reduce<number>((s, v) => s + (v as number), 0);
};
const cociente = (a: string, b: string) => (f: FilaEquipoOpta) => {
  const x = num(f[a]);
  const y = num(f[b]);
  return x != null && y != null && y > 0 ? x / y : null;
};

export const METRICAS_ABP_OPTA: MetricaAbpOpta[] = [
  /* ---------------- Resumen ---------------- */
  { clave: "GoalSetPly", nombre: "Goles a balón parado", seccion: "Resumen", modo: "total", mejorAlto: true, valor: col("GoalSetPly"), comoLeer: "Goles a balón parado en la temporada según Opta (córner, falta y saque de banda; los penaltis van aparte)." },
  { clave: "GoalSetPly|OPP", nombre: "Goles encajados a balón parado", seccion: "Resumen", modo: "total", mejorAlto: false, valor: col("GoalSetPly|OPP"), comoLeer: "Goles que nos han hecho a balón parado en la temporada, sin penaltis." },
  { clave: "xGSetPly", nombre: "xG a balón parado", seccion: "Resumen", modo: "pp", mejorAlto: true, valor: col("xGSetPly"), comoLeer: "Goles esperados de los remates a balón parado, por partido: cuánto peligro se genera, entren o no." },
  { clave: "ChncSetPl", nombre: "Ocasiones a balón parado", seccion: "Resumen", modo: "pp", mejorAlto: true, valor: col("ChncSetPl"), comoLeer: "Pases que acaban en remate (clave o asistencia) a balón parado, por partido." },
  { clave: "ChncSetPl|OPP", nombre: "Ocasiones concedidas a balón parado", seccion: "Resumen", modo: "pp", mejorAlto: false, valor: col("ChncSetPl|OPP"), comoLeer: "Lo mismo del rival contra nosotros, por partido." },

  /* ---------------- Córners ---------------- */
  { clave: "Corners", nombre: "Córners a favor", seccion: "Córners", modo: "pp", mejorAlto: true, valor: col("Corners"), comoLeer: "Córners lanzados por partido." },
  { clave: "Corners|OPP", nombre: "Córners en contra", seccion: "Córners", modo: "pp", mejorAlto: false, valor: col("Corners|OPP"), comoLeer: "Córners del rival por partido." },
  { clave: "ShrtCrnr%", nombre: "Córners en corto", seccion: "Córners", modo: "pct", mejorAlto: null, valor: col("ShrtCrnr%"), casos: col("Corners"), comoLeer: "Qué parte de los córners se saca en corto. Es estilo: ni mejor ni peor." },
  { clave: "ShotCrnrs", nombre: "Remates de córner", seccion: "Córners", modo: "pp", mejorAlto: true, valor: col("ShotCrnrs"), comoLeer: "Remates (bloqueados incluidos) de toda la jugada del córner, también los del rechace o la segunda jugada, por partido. Por eso son más que los córners que acaban en remate al primer contacto." },
  { clave: "CrnrRemate%", nombre: "Córners que acaban en remate", seccion: "Córners", modo: "pct", mejorAlto: true, valor: cociente("CrnrsLeadingShot", "Corners"), casos: col("Corners"), comoLeer: "De cada 100 córners, cuántos terminan en remate en la primera jugada." },
  { clave: "xGCrnrs", nombre: "xG de córner", seccion: "Córners", modo: "pp", mejorAlto: true, valor: col("xGCrnrs"), comoLeer: "Goles esperados de los remates de córner, por partido." },
  { clave: "GoalCrnrs", nombre: "Goles de córner", seccion: "Córners", modo: "total", mejorAlto: true, valor: col("GoalCrnrs"), comoLeer: "Goles de córner en la temporada." },
  { clave: "RematesCrnrOPP", nombre: "Remates de córner en contra", seccion: "Córners", modo: "pp", mejorAlto: false, valor: suma("CrnrOnTgt|OPP", "CrnrOffTgt|OPP"), comoLeer: "Remates del rival tras córner (a puerta y fuera; sin los bloqueados), por partido." },
  { clave: "GoalCrnrs|OPP", nombre: "Goles de córner encajados", seccion: "Córners", modo: "total", mejorAlto: false, valor: col("GoalCrnrs|OPP"), comoLeer: "Goles de córner encajados en la temporada." },
  { clave: "LftCrnrSc%", nombre: "Éxito del córner desde la izquierda", seccion: "Córners", modo: "pct", mejorAlto: true, valor: col("LftCrnrSc%"), casos: col("CrnrL"), comoLeer: "Córners desde la izquierda que llegan a un compañero." },
  { clave: "RgtCrnrSc%", nombre: "Éxito del córner desde la derecha", seccion: "Córners", modo: "pct", mejorAlto: true, valor: col("RgtCrnrSc%"), casos: col("CrnrR"), comoLeer: "Córners desde la derecha que llegan a un compañero." },
  { clave: "LftCrnrSc%|OPP", nombre: "Éxito del rival desde la izquierda", seccion: "Córners", modo: "pct", mejorAlto: false, valor: col("LftCrnrSc%|OPP"), comoLeer: "Córners del rival desde su izquierda que llegan a uno de los suyos: cuanto menos, mejor defendemos ese lado." },
  { clave: "RgtCrnrSc%|OPP", nombre: "Éxito del rival desde la derecha", seccion: "Córners", modo: "pct", mejorAlto: false, valor: col("RgtCrnrSc%|OPP"), comoLeer: "Córners del rival desde su derecha que llegan a uno de los suyos." },

  /* ---------------- Faltas ---------------- */
  { clave: "ShotDirFK", nombre: "Remates de falta directa", seccion: "Faltas", modo: "pp", mejorAlto: true, valor: col("ShotDirFK"), comoLeer: "Tiros directos de falta por partido (sin los que da la barrera)." },
  { clave: "FKOnTgt%", nombre: "Faltas directas a puerta", seccion: "Faltas", modo: "pct", mejorAlto: true, valor: col("FKOnTgt%"), casos: col("ShotDirFK"), comoLeer: "De los tiros directos de falta, cuántos van entre los tres palos." },
  { clave: "GoalDirFK", nombre: "Goles de falta directa", seccion: "Faltas", modo: "total", mejorAlto: true, valor: col("GoalDirFK"), comoLeer: "Goles de falta directa en la temporada." },
  { clave: "AstFK", nombre: "Asistencias de falta", seccion: "Faltas", modo: "total", mejorAlto: true, valor: col("AstFK"), comoLeer: "Goles que nacen del pase de una falta, en la temporada." },
  { clave: "KeyPsFK", nombre: "Pases clave de falta", seccion: "Faltas", modo: "pp", mejorAlto: true, valor: col("KeyPsFK"), comoLeer: "Faltas cuyo pase acaba en remate, por partido." },
  { clave: "CrossFK", nombre: "Centros de falta", seccion: "Faltas", modo: "pp", mejorAlto: null, valor: col("CrossFK"), comoLeer: "Faltas que se centran al área, por partido. Es estilo." },
  { clave: "ShotDirFK|OPP", nombre: "Remates de falta directa en contra", seccion: "Faltas", modo: "pp", mejorAlto: false, valor: col("ShotDirFK|OPP"), comoLeer: "Tiros directos de falta del rival por partido." },
  { clave: "GoalDirFK|OPP", nombre: "Goles de falta directa encajados", seccion: "Faltas", modo: "total", mejorAlto: false, valor: col("GoalDirFK|OPP"), comoLeer: "Goles de falta directa encajados en la temporada." },

  /* ---------------- Saques de banda ---------------- */
  { clave: "ThrowIn", nombre: "Saques de banda", seccion: "Saques de banda", modo: "pp", mejorAlto: null, valor: col("ThrowIn"), comoLeer: "Saques de banda por partido. Es volumen, no rendimiento." },
  { clave: "RematesThr", nombre: "Remates de saque de banda", seccion: "Saques de banda", modo: "pp", mejorAlto: true, valor: suma("ThrowOnTgt", "ThrowOfTgt"), comoLeer: "Remates que salen de un saque de banda (a puerta y fuera), por partido." },
  { clave: "KeyPsThr", nombre: "Pases clave de saque de banda", seccion: "Saques de banda", modo: "pp", mejorAlto: true, valor: col("KeyPsThr"), comoLeer: "Saques de banda que acaban en remate, por partido." },
  { clave: "AstThr", nombre: "Asistencias de saque de banda", seccion: "Saques de banda", modo: "total", mejorAlto: true, valor: col("AstThr"), comoLeer: "Goles que nacen de un saque de banda, en la temporada." },
  { clave: "GoalThr", nombre: "Goles de saque de banda", seccion: "Saques de banda", modo: "total", mejorAlto: true, valor: col("GoalThr"), comoLeer: "Goles en jugadas de saque de banda, en la temporada." },

  /* ---------------- Penaltis ---------------- */
  { clave: "PensWon", nombre: "Penaltis a favor", seccion: "Penaltis", modo: "total", mejorAlto: true, valor: col("PensWon"), comoLeer: "Penaltis provocados en la temporada." },
  { clave: "PenGoal", nombre: "Goles de penalti", seccion: "Penaltis", modo: "total", mejorAlto: true, valor: col("PenGoal"), comoLeer: "Penaltis marcados en la temporada." },
  { clave: "PenConv%", nombre: "Acierto en el penalti", seccion: "Penaltis", modo: "pct", mejorAlto: true, valor: cociente("PenGoal", "PenTaken"), casos: col("PenTaken"), comoLeer: "Penaltis marcados de los lanzados." },
  { clave: "PensConc", nombre: "Penaltis en contra", seccion: "Penaltis", modo: "total", mejorAlto: false, valor: col("PensConc"), comoLeer: "Penaltis cometidos en la temporada." },
  { clave: "PenGlCnc", nombre: "Goles de penalti encajados", seccion: "Penaltis", modo: "total", mejorAlto: false, valor: col("PenGlCnc"), comoLeer: "Penaltis que nos han marcado en la temporada." },
  { clave: "SvPen", nombre: "Penaltis parados", seccion: "Penaltis", modo: "total", mejorAlto: true, valor: col("SvPen"), comoLeer: "Penaltis que ha parado nuestro portero en la temporada." },
];

/** El valor que se compara: por partido, en la temporada o en tanto por uno. */
export function valorAbp(m: MetricaAbpOpta, f: FilaEquipoOpta): number | null {
  const v = m.valor(f);
  if (v == null || !Number.isFinite(v)) return null;
  if (m.modo !== "pp") return v;
  const gm = num(f.GM);
  return gm && gm > 0 ? v / gm : null;
}

const coma = (n: number, d: number) => n.toFixed(d).replace(".", ",");

export function textoAbp(m: Pick<MetricaAbpOpta, "modo">, v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "";
  if (m.modo === "pct") return `${coma(v * 100, 1)} %`;
  if (m.modo === "total") return String(Math.round(v));
  return coma(v, Math.abs(v) >= 10 ? 1 : 2);
}

/**
 * Los grupos de la categoría, deducidos de quién ha jugado contra quién:
 * teamId → número de grupo (0, 1…), ordenados por tamaño.
 */
export function gruposDePartidos(partidos: TablaOpta | null): Map<string, number> {
  const out = new Map<string, number>();
  if (!partidos) return out;
  const iP = partidos.cols.indexOf("partido");
  const iT = partidos.cols.indexOf("teamId");
  if (iP < 0 || iT < 0) return out;

  const padre = new Map<string, string>();
  const raiz = (x: string): string => {
    let r = x;
    while (padre.get(r) !== r) r = padre.get(r) as string;
    let y = x;
    while (padre.get(y) !== r) {
      const s = padre.get(y) as string;
      padre.set(y, r);
      y = s;
    }
    return r;
  };

  const porPartido = new Map<string, string[]>();
  for (const f of partidos.filas) {
    const p = String(f[iP] ?? "");
    const t = String(f[iT] ?? "");
    if (!p || !t) continue;
    if (!padre.has(t)) padre.set(t, t);
    porPartido.set(p, [...(porPartido.get(p) ?? []), t]);
  }
  for (const ts of porPartido.values()) {
    for (let i = 1; i < ts.length; i++) {
      const a = raiz(ts[0]);
      const b = raiz(ts[i]);
      if (a !== b) padre.set(a, b);
    }
  }

  const comps = new Map<string, string[]>();
  for (const t of padre.keys()) {
    const r = raiz(t);
    comps.set(r, [...(comps.get(r) ?? []), t]);
  }
  [...comps.values()]
    .sort((a, b) => b.length - a.length)
    .forEach((ts, i) => ts.forEach((t) => out.set(t, i)));
  return out;
}
