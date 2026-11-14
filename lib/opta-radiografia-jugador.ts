/**
 * RADIOGRAFÍA DE PERCENTILES DE UN JUGADOR (14/11/2026, petición del analista;
 * idea de F. Sosa · The Eye Intelligence Unit, «ADN Player»).
 *
 * 18 métricas por puesto (por 90′, o tasa tal cual) y, de cada una, el
 * percentil del jugador frente a los de su misma familia de puesto en toda la
 * categoría con un mínimo de minutos. La nota de perfil es la media de esos
 * percentiles. Un percentil sólo se da con al menos 5 valores válidos en el
 * universo, y una tasa sólo si el jugador tiene intentos suficientes
 * (`muestraCorta`). Datos: `opta:jugadores` (useOpta).
 */

import { num } from "@/lib/opta";
import { familiaFina, muestraCorta, valor90, type Fila } from "@/lib/opta-talento";

export type MetricaRadiografia = { a: string; inverso?: boolean };

/** Las 18 de cada familia: ataque, creación, balón y defensa, en ese orden (la pizza las agrupa). */
export const METRICAS_RADIOGRAFIA: Record<string, MetricaRadiografia[]> = {
  Delanteros: [
    { a: "Goal" }, { a: "GoalExPn" }, { a: "ExpG" }, { a: "ShtIncBl" }, { a: "SOG" }, { a: "TouchOpBox" },
    { a: "xA" }, { a: "KeyPass" }, { a: "Chance" }, { a: "Ps%InA3rd" }, { a: "1v1InBox" }, { a: "FoulSuf" },
    { a: "AerialWon" }, { a: "Aerial%" }, { a: "Duel%" }, { a: "Recovery" }, { a: "PosWonA3rd" }, { a: "Disposs", inverso: true },
  ],
  Bandas: [
    { a: "Goal" }, { a: "ExpG" }, { a: "ShtIncBl" }, { a: "TouchOpBox" }, { a: "xA" }, { a: "KeyPass" },
    { a: "Chance" }, { a: "Crosses" }, { a: "CrossCmp" }, { a: "1v1InBox" }, { a: "Sc1v1InBox" }, { a: "KPAf1v1" },
    { a: "FoulSuf" }, { a: "Ps%InA3rd" }, { a: "Duel%" }, { a: "Recovery" }, { a: "PosWonA3rd" }, { a: "Disposs", inverso: true },
  ],
  Mediapuntas: [
    { a: "Goal" }, { a: "ExpG" }, { a: "ShtIncBl" }, { a: "TouchOpBox" }, { a: "xA" }, { a: "KeyPass" },
    { a: "Chance" }, { a: "ThrghBalls" }, { a: "Ps%InA3rd" }, { a: "TchsA3" }, { a: "PsAtt" }, { a: "Pass%" },
    { a: "1v1InBox" }, { a: "FoulSuf" }, { a: "Duel%" }, { a: "Recovery" }, { a: "PosWonA3rd" }, { a: "PossLost", inverso: true },
  ],
  Mediocentros: [
    { a: "ExpG" }, { a: "ShtIncBl" }, { a: "xA" }, { a: "KeyPass" }, { a: "Chance" }, { a: "ThrghBalls" },
    { a: "Touches" }, { a: "PsAtt" }, { a: "Pass%" }, { a: "Ps%InA3rd" }, { a: "LgBallCp" }, { a: "PossLost", inverso: true },
    { a: "Recovery" }, { a: "PosWonM3rd" }, { a: "Int" }, { a: "Tackle%" }, { a: "Duel%" }, { a: "Aerial%" },
  ],
  Laterales: [
    { a: "xA" }, { a: "KeyPass" }, { a: "Chance" }, { a: "Crosses" }, { a: "CrossCmp" }, { a: "TchsA3" },
    { a: "Touches" }, { a: "PsAtt" }, { a: "Pass%" }, { a: "LgBallCp" }, { a: "PossLost", inverso: true }, { a: "Disposs", inverso: true },
    { a: "Recovery" }, { a: "PosWonM3rd" }, { a: "Int" }, { a: "Tackle%" }, { a: "Duel%" }, { a: "Aerial%" },
  ],
  Centrales: [
    { a: "ExpG" }, { a: "AerialWon" }, { a: "Aerial%" }, { a: "Arl%DH" }, { a: "Duel%" }, { a: "Tackle%" },
    { a: "Touches" }, { a: "PsAtt" }, { a: "Pass%" }, { a: "LgBallCp" }, { a: "LongBall%" }, { a: "PossLost", inverso: true },
    { a: "Recovery" }, { a: "PosWonD3rd" }, { a: "Int" }, { a: "Clrnce" }, { a: "CrossBlkd" }, { a: "FoulCom", inverso: true },
  ],
  Porteros: [
    { a: "Saves" }, { a: "SvInBox" }, { a: "GABA" }, { a: "GAg", inverso: true }, { a: "ExpGAg", inverso: true }, { a: "CrossClaim" },
    { a: "Touches" }, { a: "PsAtt" }, { a: "Pass%" }, { a: "LgBall" }, { a: "LgBallCp" }, { a: "LongBall%" },
  ],
};

/** Las cuatro partes de la pizza (en el orden de arriba), para colorear el borde. */
export const PARTES_RADIOGRAFIA = ["Ataque", "Creación", "Con balón", "Defensa"] as const;
type Parte = (typeof PARTES_RADIOGRAFIA)[number];
const ATAQUE = new Set(["Goal", "GoalExPn", "ExpG", "ShtIncBl", "SOG", "TouchOpBox", "1v1InBox", "Sc1v1InBox", "FoulSuf"]);
const CREACION = new Set(["xA", "KeyPass", "Chance", "Crosses", "CrossCmp", "KPAf1v1", "ThrghBalls", "Ps%InA3rd", "TchsA3"]);
const CON_BALON = new Set(["Touches", "PsAtt", "Pass%", "LgBall", "LgBallCp", "LongBall%", "PossLost", "Disposs"]);
/** De qué parte del juego es cada métrica (el color de su borde y de su punto). Lo demás, defensa (en porteros, «Defensa» = portería). */
export const parteDe = (a: string): Parte => (ATAQUE.has(a) ? "Ataque" : CREACION.has(a) ? "Creación" : CON_BALON.has(a) ? "Con balón" : "Defensa");

export type Porcion = { a: string; valor: number | null; p: number | null; inverso: boolean };

export type Radiografia = {
  familia: string;
  porciones: Porcion[];
  nota: number | null;
  comparables: number;
  elegibles: number;
};

export const minutosDe = (f: Fila) => num(f.Min) ?? 0;

/** Percentil (0-100) de `v` en la muestra: los de abajo más la mitad de los empates. */
function percentil(v: number, muestra: number[], inverso: boolean): number {
  let abajo = 0;
  let iguales = 0;
  for (const x of muestra) {
    if (x === v) iguales++;
    else if (inverso ? x > v : x < v) abajo++;
  }
  return Math.round(((abajo + iguales / 2) / muestra.length) * 100);
}

/**
 * La radiografía de `f` frente a los de la familia `familia` (por defecto, la
 * suya) con `minimo` minutos o más. El propio jugador entra en el universo.
 */
export function radiografiaJugador(f: Fila, todos: Fila[], minimo: number, familia = familiaFina(f)): Radiografia | null {
  const metricas = METRICAS_RADIOGRAFIA[familia];
  if (!metricas) return null;
  const universo = todos.filter((x) => familiaFina(x) === familia && minutosDe(x) >= minimo);
  const porciones = metricas.map(({ a, inverso = false }) => {
    const valor = minutosDe(f) > 0 ? valor90(f, a) : null;
    const muestra = universo.filter((x) => !muestraCorta(x, a)).map((x) => valor90(x, a)).filter((v): v is number => v != null && Number.isFinite(v));
    const p = valor != null && !muestraCorta(f, a) && muestra.length >= 5 ? percentil(valor, muestra, inverso) : null;
    return { a, valor, p, inverso };
  });
  const ps = porciones.map((x) => x.p).filter((p): p is number => p != null);
  return {
    familia,
    porciones,
    nota: ps.length ? ps.reduce((s, p) => s + p, 0) / ps.length : null,
    comparables: universo.length,
    elegibles: todos.filter((x) => familiaFina(x) === familia).length,
  };
}
