/**
 * FRENTE AL RIVAL (22/11/2026, petición del analista: «en nuestras secciones
 * de ABP ofensivo, defensivo, saque de banda, faltas y pérdidas, una
 * comparativa respecto a nuestro rival o rivales según filtro… que sea muy
 * muy visual»).
 *
 * Las hojas sólo tienen lo nuestro (y lo que nos hace el rival en NUESTROS
 * partidos). Para poner al Castilla al lado de otro equipo hace falta lo que
 * ese equipo hace en los SUYOS, y eso sólo lo tiene Opta: `opta:partidos`
 * trae una fila por equipo y partido de toda Primera RFEF. Lo «en contra» de
 * un equipo es la fila del otro equipo en el mismo partido.
 *
 * - Las cifras son por partido; los porcentajes, cociente de las sumas
 *   (nunca media de porcentajes).
 * - Varios rivales a la vez: se juntan sus partidos (cada uno con su
 *   periodo) y se calcula como si fueran un solo equipo.
 * - Puesto y percentil, entre los equipos de nuestro grupo.
 *
 * Sin datos de Opta aquí (el repo es público): sólo nombres y fórmulas.
 */

import { num, percentil, type Celda } from "@/lib/opta";

export type FilaPartidoOpta = Record<string, Celda>;

export type AreaFrente = "abp-of" | "abp-def" | "banda-of" | "banda-def" | "faltas" | "perdidas" | "robos";

export type Periodo = "temporada" | 5 | 3;

export type MetricaFrente = {
  clave: string;
  nombre: string;
  /** De qué fila sale: la del equipo o la de su rival en ese partido. */
  lado: "propio" | "rival";
  /** pp: por partido; pct: cociente de sumas (num ÷ den); ratio: igual, por cada `factor`. */
  modo: "pp" | "pct" | "ratio";
  num: string[];
  den?: string[];
  factor?: number;
  /** true: más es mejor; false: menos es mejor; null: estilo. */
  mejorAlto: boolean | null;
  comoLeer: string;
};

const R = (m: Omit<MetricaFrente, "lado">): MetricaFrente => ({ ...m, lado: "rival" });
const P = (m: Omit<MetricaFrente, "lado">): MetricaFrente => ({ ...m, lado: "propio" });

export const METRICAS_FRENTE: Record<AreaFrente, MetricaFrente[]> = {
  "abp-of": [
    P({ clave: "corners", nombre: "Córners a favor", modo: "pp", num: ["Corners"], mejorAlto: true, comoLeer: "Córners que saca por partido." }),
    P({ clave: "remCorner", nombre: "Remates tras córner", modo: "pp", num: ["CrnrOnTgt", "CrnrOffTgt"], mejorAlto: true, comoLeer: "Remates a puerta y fuera que salen de un córner, por partido." }),
    P({ clave: "remPor10", nombre: "Remates por cada 10 córners", modo: "ratio", factor: 10, num: ["CrnrOnTgt", "CrnrOffTgt"], den: ["Corners"], mejorAlto: true, comoLeer: "Cuánto peligro saca de cada córner: remates ÷ córners × 10." }),
    P({ clave: "golCorner", nombre: "Goles de córner", modo: "pp", num: ["GoalCrnrs"], mejorAlto: true, comoLeer: "Goles de córner por partido." }),
    P({ clave: "falta", nombre: "Tiros de falta directa", modo: "pp", num: ["ShotDirFK"], mejorAlto: true, comoLeer: "Tiros directos de falta por partido." }),
    P({ clave: "faltaPuerta", nombre: "Faltas directas a puerta", modo: "pct", num: ["FKOnTgt"], den: ["ShotDirFK"], mejorAlto: true, comoLeer: "De sus tiros de falta, cuántos van entre los tres palos." }),
    P({ clave: "golAbp", nombre: "Goles a balón parado", modo: "pp", num: ["GoalCrnrs", "GoalDirFK", "GoalThr"], mejorAlto: true, comoLeer: "Goles de córner, falta directa y saque de banda por partido (sin penaltis)." }),
  ],
  "abp-def": [
    R({ clave: "corners", nombre: "Córners que concede", modo: "pp", num: ["Corners"], mejorAlto: false, comoLeer: "Córners que le saca el rival por partido." }),
    R({ clave: "remCorner", nombre: "Remates que concede tras córner", modo: "pp", num: ["CrnrOnTgt", "CrnrOffTgt"], mejorAlto: false, comoLeer: "Remates del rival que salen de un córner, por partido." }),
    R({ clave: "remPor10", nombre: "Remates rivales por cada 10 córners", modo: "ratio", factor: 10, num: ["CrnrOnTgt", "CrnrOffTgt"], den: ["Corners"], mejorAlto: false, comoLeer: "Cuánto peligro le saca el rival a cada córner en contra: cuanto menos, mejor defiende." }),
    R({ clave: "golCorner", nombre: "Goles de córner encajados", modo: "pp", num: ["GoalCrnrs"], mejorAlto: false, comoLeer: "Goles de córner encajados por partido." }),
    R({ clave: "falta", nombre: "Tiros de falta que concede", modo: "pp", num: ["ShotDirFK"], mejorAlto: false, comoLeer: "Tiros directos de falta del rival por partido." }),
    R({ clave: "golAbp", nombre: "Goles a balón parado encajados", modo: "pp", num: ["GoalCrnrs", "GoalDirFK", "GoalThr"], mejorAlto: false, comoLeer: "Goles encajados de córner, falta directa y saque de banda por partido (sin penaltis)." }),
  ],
  /* Sin goles de saque de banda: Opta sólo cuenta el remate directo y sale 0 en todos (ver lib/opta-abp-dia.ts). */
  "banda-of": [
    P({ clave: "saques", nombre: "Saques de banda", modo: "pp", num: ["ThrowIn"], mejorAlto: null, comoLeer: "Saques de banda por partido. Es volumen, no rendimiento." }),
    P({ clave: "conserva", nombre: "Saques que llegan a un compañero", modo: "pct", num: ["ThrowInSc"], den: ["ThrowIn"], mejorAlto: true, comoLeer: "De cada 100 saques de banda, cuántos recibe un compañero." }),
  ],
  "banda-def": [
    R({ clave: "saques", nombre: "Saques de banda del rival", modo: "pp", num: ["ThrowIn"], mejorAlto: null, comoLeer: "Saques de banda del rival por partido. Es volumen." }),
    R({ clave: "conserva", nombre: "Saques rivales que llegan a uno de los suyos", modo: "pct", num: ["ThrowInSc"], den: ["ThrowIn"], mejorAlto: false, comoLeer: "De cada 100 saques del rival, cuántos recibe uno de los suyos: cuanto menos, más se los quita." }),
  ],
  faltas: [
    P({ clave: "cometidas", nombre: "Faltas cometidas", modo: "pp", num: ["FoulCom"], mejorAlto: false, comoLeer: "Faltas que hace por partido." }),
    P({ clave: "recibidas", nombre: "Faltas recibidas", modo: "pp", num: ["FoulSuf"], mejorAlto: true, comoLeer: "Faltas que le hacen por partido." }),
    P({ clave: "amarillas", nombre: "Amarillas", modo: "pp", num: ["Yellow"], mejorAlto: false, comoLeer: "Tarjetas amarillas por partido." }),
    R({ clave: "faltaContra", nombre: "Tiros de falta que concede", modo: "pp", num: ["ShotDirFK"], mejorAlto: false, comoLeer: "Lo que cuesta hacer falta cerca del área: tiros directos de falta del rival por partido." }),
    P({ clave: "porRobo", nombre: "Faltas por cada 10 recuperaciones", modo: "ratio", factor: 10, num: ["FoulCom"], den: ["Recovery"], mejorAlto: false, comoLeer: "Cuánto recurre a la falta para cortar frente a lo que roba limpio." }),
  ],
  perdidas: [
    P({ clave: "perdidas", nombre: "Pérdidas de balón", modo: "pp", num: ["PossLost"], mejorAlto: false, comoLeer: "Posesiones que pierde por partido (pase fallado, conducción, control)." }),
    P({ clave: "propio", nombre: "Pases perdidos en su tercio", modo: "pp", num: ["PsLostD3"], mejorAlto: false, comoLeer: "Pases perdidos en el tercio defensivo, por partido: las pérdidas que más cuestan." }),
    P({ clave: "medio", nombre: "Pases perdidos en el medio", modo: "pp", num: ["PsLostM3"], mejorAlto: false, comoLeer: "Pases perdidos en el tercio central, por partido." }),
    P({ clave: "disposs", nombre: "Balones perdidos en conducción", modo: "pp", num: ["Disposs"], mejorAlto: false, comoLeer: "Veces que le quitan el balón mientras conduce, por partido." }),
    R({ clave: "roboAlto", nombre: "Robos del rival en su campo", modo: "pp", num: ["PosWonA3rd"], mejorAlto: false, comoLeer: "Balones que el rival le roba en su tercio defensivo, por partido: la pérdida que acaba cerca de su portería." }),
  ],
  robos: [
    P({ clave: "recupera", nombre: "Recuperaciones", modo: "pp", num: ["Recovery"], mejorAlto: true, comoLeer: "Balones recuperados por partido." }),
    P({ clave: "alto", nombre: "Robos en el último tercio", modo: "pp", num: ["PosWonA3rd"], mejorAlto: true, comoLeer: "Posesiones ganadas en el tercio de ataque, por partido: el robo alto." }),
    P({ clave: "medio", nombre: "Robos en el medio", modo: "pp", num: ["PosWonM3rd"], mejorAlto: true, comoLeer: "Posesiones ganadas en el tercio central, por partido." }),
    P({ clave: "intercepta", nombre: "Intercepciones", modo: "pp", num: ["Int"], mejorAlto: true, comoLeer: "Pases rivales cortados por partido." }),
    R({ clave: "pierdeRival", nombre: "Pérdidas que provoca", modo: "pp", num: ["PossLost"], mejorAlto: true, comoLeer: "Posesiones que pierde su rival por partido." }),
  ],
};

export const NOMBRE_AREA: Record<AreaFrente, string> = {
  "abp-of": "balón parado ofensivo",
  "abp-def": "balón parado defensivo",
  "banda-of": "saque de banda ofensivo",
  "banda-def": "saque de banda defensivo",
  faltas: "faltas",
  perdidas: "pérdidas",
  robos: "robos",
};

/** Un partido de un equipo: su fila y la del rival. */
export type PartidoEquipo = { partido: string; fecha: string; propio: FilaPartidoOpta; rival: FilaPartidoOpta | null; contra: string };

/** Los partidos de cada equipo, del más antiguo al más nuevo. */
export function partidosPorEquipo(filas: FilaPartidoOpta[]): Map<string, PartidoEquipo[]> {
  const porPartido = new Map<string, FilaPartidoOpta[]>();
  for (const f of filas) {
    const p = String(f.partido ?? "");
    if (!p) continue;
    porPartido.set(p, [...(porPartido.get(p) ?? []), f]);
  }
  const out = new Map<string, PartidoEquipo[]>();
  for (const [p, dos] of porPartido) {
    for (const f of dos) {
      const t = String(f.teamId ?? "");
      if (!t) continue;
      const otro = dos.find((g) => g !== f) ?? null;
      const lista = out.get(t) ?? [];
      lista.push({ partido: p, fecha: String(f.fecha ?? ""), propio: f, rival: otro, contra: String(otro?.equipo ?? "") });
      out.set(t, lista);
    }
  }
  for (const lista of out.values()) lista.sort((a, b) => a.fecha.localeCompare(b.fecha));
  return out;
}

export const recorta = (lista: PartidoEquipo[], periodo: Periodo) => (periodo === "temporada" ? lista : lista.slice(-periodo));

const sumaCols = (f: FilaPartidoOpta | null, cols: string[]): number | null => {
  if (!f) return null;
  let s = 0;
  for (const c of cols) {
    const v = num(f[c]);
    if (v == null) return null;
    s += v;
  }
  return s;
};

/** La cifra de una métrica sobre unos partidos (de uno o varios equipos juntos). */
export function valorFrente(m: MetricaFrente, partidos: PartidoEquipo[]): number | null {
  let n = 0;
  let a = 0;
  let b = 0;
  for (const p of partidos) {
    const f = m.lado === "propio" ? p.propio : p.rival;
    const x = sumaCols(f, m.num);
    if (x == null) continue;
    if (m.den) {
      const y = sumaCols(f, m.den);
      if (y == null) continue;
      b += y;
    }
    a += x;
    n++;
  }
  if (!n) return null;
  if (m.modo === "pp") return a / n;
  if (!b) return null;
  return (a / b) * (m.factor ?? 1);
}

/** La cifra de un solo partido (para la línea partido a partido). */
export const valorPartido = (m: MetricaFrente, p: PartidoEquipo) => valorFrente(m, [p]);

export function textoFrente(m: MetricaFrente, v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "–";
  const coma = (x: number, d: number) => x.toFixed(d).replace(".", ",");
  if (m.modo === "pct") return `${coma(v * 100, 0)} %`;
  return coma(v, v >= 10 ? 1 : v >= 1 ? 1 : 2);
}

/** Puntos y diferencia de goles de cada equipo con esos partidos (para «los de arriba»). */
export function clasificacion(porEquipo: Map<string, PartidoEquipo[]>, grupo: Set<string>): { teamId: string; puntos: number; dg: number }[] {
  const out: { teamId: string; puntos: number; dg: number }[] = [];
  for (const t of grupo) {
    let puntos = 0;
    let dg = 0;
    for (const p of porEquipo.get(t) ?? []) {
      const gf = num(p.propio.Goal) ?? 0;
      const gc = num(p.propio.GA) ?? num(p.rival?.Goal) ?? 0;
      puntos += gf > gc ? 3 : gf === gc ? 1 : 0;
      dg += gf - gc;
    }
    out.push({ teamId: t, puntos, dg });
  }
  return out.sort((a, b) => b.puntos - a.puntos || b.dg - a.dg);
}

export type FilaFrente = {
  m: MetricaFrente;
  nuestro: number | null;
  rival: number | null;
  media: number | null;
  /** Cada equipo del grupo con su cifra (para la tira del puesto). */
  grupo: { teamId: string; valor: number }[];
  /** Percentil «bueno» (100 = el mejor; en lo que menos es mejor, ya invertido). Con mejorAlto null, el de volumen. */
  pNuestro: number | null;
  pRival: number | null;
  puestoNuestro: number | null;
  puestoRival: number | null;
  /** Quién sale mejor (null si es estilo o empatan). */
  gana: "nuestro" | "rival" | null;
};

/** El puesto de un valor entre los del grupo (1 = el mejor; en estilo, el que más). */
function puestoDe(v: number | null, valores: number[], mejorAlto: boolean | null): number | null {
  if (v == null) return null;
  return 1 + valores.filter((x) => (mejorAlto === false ? x < v : x > v)).length;
}

export function comparaFrente(
  area: AreaFrente,
  porEquipo: Map<string, PartidoEquipo[]>,
  grupo: Set<string>,
  nuestro: string,
  rivales: string[],
  periodo: Periodo,
): FilaFrente[] {
  const nuestros = recorta(porEquipo.get(nuestro) ?? [], periodo);
  const suyos = rivales.flatMap((r) => recorta(porEquipo.get(r) ?? [], periodo));
  return METRICAS_FRENTE[area].map((m) => {
    const enGrupo = [...grupo]
      .map((t) => ({ teamId: t, valor: valorFrente(m, recorta(porEquipo.get(t) ?? [], periodo)) }))
      .filter((x): x is { teamId: string; valor: number } => x.valor != null);
    const valores = enGrupo.map((x) => x.valor);
    const vN = valorFrente(m, nuestros);
    const vR = suyos.length ? valorFrente(m, suyos) : null;
    const inverso = m.mejorAlto === false;
    const gana =
      m.mejorAlto == null || vN == null || vR == null || Math.abs(vN - vR) < 1e-9 ? null : (vN > vR) === (m.mejorAlto === true) ? "nuestro" : "rival";
    return {
      m,
      nuestro: vN,
      rival: vR,
      media: valores.length ? valores.reduce((s, x) => s + x, 0) / valores.length : null,
      grupo: enGrupo,
      pNuestro: percentil(vN, valores, inverso),
      pRival: percentil(vR, valores, inverso),
      puestoNuestro: puestoDe(vN, valores, m.mejorAlto),
      puestoRival: rivales.length === 1 ? puestoDe(vR, valores, m.mejorAlto) : null,
      gana,
    };
  });
}
