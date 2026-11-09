/**
 * LAS CUENTAS DEL ÁREA OPTA (09/11/2026).
 *
 * Todo lo que la pantalla `/opta` calcula sobre las tablas de `lib/opta.ts`:
 * los dos grupos de Primera RFEF, el valor por partido o por 90, el puesto y
 * el percentil. Funciones puras: ni fetch ni estado, para poder probarlas en
 * Node con las copias de `.cache/opta`.
 *
 * LOS GRUPOS. Opta no dice en qué grupo está cada equipo. Se saca de quién
 * juega contra quién en `opta:partidos`: los equipos que se han enfrentado
 * están en el mismo grupo, así que los grupos son las componentes conexas de
 * ese grafo. Con once jornadas salen dos de veinte.
 */

import { CASTILLA_OPTA, aObjetos, num, percentil, type Celda, type MetaOpta, type MetricaOpta, type TablaOpta } from "@/lib/opta";
import { defMetrica, FAMILIA_PUESTO } from "@/lib/opta-nombres";

export type Fila = Record<string, Celda>;

export const NOMBRE_CASTILLA = "Real Madrid Castilla";

/** El nombre que se enseña: el Castilla con el suyo, no «Real Madrid II». */
export const nombreEquipo = (f: Fila): string =>
  f.teamId === CASTILLA_OPTA ? NOMBRE_CASTILLA : String(f.equipo ?? "");

export function catalogoDe(meta: MetaOpta | null): Map<string, MetricaOpta> {
  const m = new Map<string, MetricaOpta>();
  for (const x of meta?.catalogo ?? []) if (!m.has(x.a)) m.set(x.a, x);
  return m;
}

/* ------------------------------------------------------------------ */
/*  GRUPOS                                                             */
/* ------------------------------------------------------------------ */

/** teamId → número de grupo (1, 2…). El grupo del Castilla es siempre el 1. */
export function gruposDe(partidos: TablaOpta | null): Map<string, number> {
  const filas = aObjetos(partidos);
  const porPartido = new Map<string, string[]>();
  for (const f of filas) {
    const p = String(f.partido ?? "");
    const t = String(f.teamId ?? "");
    if (!p || !t) continue;
    porPartido.set(p, [...(porPartido.get(p) ?? []), t]);
  }

  const vecinos = new Map<string, Set<string>>();
  const une = (a: string, b: string) => {
    if (!vecinos.has(a)) vecinos.set(a, new Set());
    vecinos.get(a)!.add(b);
  };
  for (const equipos of porPartido.values()) {
    for (const a of equipos) {
      une(a, a);
      for (const b of equipos) if (a !== b) une(a, b);
    }
  }

  const grupo = new Map<string, number>();
  /* El del Castilla primero: así es el 1 pase lo que pase con el orden de las filas. */
  const orden = [CASTILLA_OPTA, ...vecinos.keys()];
  let n = 0;
  for (const inicio of orden) {
    if (!vecinos.has(inicio) || grupo.has(inicio)) continue;
    n++;
    const pila = [inicio];
    while (pila.length) {
      const x = pila.pop()!;
      if (grupo.has(x)) continue;
      grupo.set(x, n);
      for (const y of vecinos.get(x) ?? []) if (!grupo.has(y)) pila.push(y);
    }
  }
  return grupo;
}

export type Ambito = "grupo" | "otro" | "todos";

export const AMBITOS: { clave: Ambito; nombre: string }[] = [
  { clave: "grupo", nombre: "Grupo del Castilla" },
  { clave: "otro", nombre: "El otro grupo" },
  { clave: "todos", nombre: "Toda la categoría" },
];

export function enAmbito(teamId: Celda, grupos: Map<string, number>, ambito: Ambito): boolean {
  if (ambito === "todos" || grupos.size === 0) return true;
  const g = grupos.get(String(teamId ?? ""));
  return ambito === "grupo" ? g === 1 : g !== undefined && g !== 1;
}

/* ------------------------------------------------------------------ */
/*  VALORES                                                            */
/* ------------------------------------------------------------------ */

/** Los porcentajes de Opta vienen en tanto por uno; la pantalla los quiere en tanto por cien. */
function aPantalla(v: number | null, a: string, catalogo?: Map<string, MetricaOpta>): number | null {
  if (v == null) return null;
  return defMetrica(a, catalogo).unidad === "porcentaje" ? v * 100 : v;
}

export type Modo = "partido" | "total";

/** El valor de un equipo: por partido (los recuentos entre partidos jugados) o el total. */
export function valorEquipo(f: Fila, a: string, modo: Modo, catalogo?: Map<string, MetricaOpta>): number | null {
  const v = num(f[a]);
  if (v == null) return null;
  const def = defMetrica(a, catalogo);
  if (modo === "partido" && !def.tasa && a !== "GM") {
    const gm = num(f.GM);
    if (!gm) return null;
    return aPantalla(v / gm, a, catalogo);
  }
  return aPantalla(v, a, catalogo);
}

/** Por 90 minutos para un jugador; las tasas se quedan como están. */
export function valorJugador(f: Fila, a: string, minimo = 1, catalogo?: Map<string, MetricaOpta>): number | null {
  const v = num(f[a]);
  if (v == null) return null;
  const def = defMetrica(a, catalogo);
  if (def.tasa || a === "Min" || a === "GM" || a === "Age") return aPantalla(v, a, catalogo);
  const m = num(f.Min);
  if (m == null || m < minimo || m <= 0) return null;
  return aPantalla((v / m) * 90, a, catalogo);
}

/** El valor de una fila de partido (una sola cifra: no se divide nada). */
export function valorPartido(f: Fila, a: string, catalogo?: Map<string, MetricaOpta>): number | null {
  return aPantalla(num(f[a]), a, catalogo);
}

export type Posicion = {
  valor: number | null;
  /** 1 = el mejor (o el que más tiene, si es estilo). */
  puesto: number | null;
  deCuantos: number;
  /** 0-100, siempre «a la derecha, mejor» (en estilo, «más que»). */
  percentil: number | null;
  mediana: number | null;
  media: number | null;
};

export function posicionEn(valor: number | null, muestra: (number | null)[], mejor: boolean | null): Posicion {
  const xs = muestra.filter((x): x is number => x != null && Number.isFinite(x));
  const orden = [...xs].sort((a, b) => a - b);
  const n = orden.length;
  const mediana = n ? (n % 2 ? orden[(n - 1) / 2] : (orden[n / 2 - 1] + orden[n / 2]) / 2) : null;
  const media = n ? xs.reduce((s, x) => s + x, 0) / n : null;
  if (valor == null) return { valor, puesto: null, deCuantos: n, percentil: null, mediana, media };
  const inverso = mejor === false;
  const mejores = xs.filter((x) => (inverso ? x < valor : x > valor)).length;
  return {
    valor,
    puesto: mejores + 1,
    deCuantos: n,
    percentil: percentil(valor, xs, inverso),
    mediana,
    media,
  };
}

/* ------------------------------------------------------------------ */
/*  CLASIFICACIÓN                                                      */
/* ------------------------------------------------------------------ */

/** Orden de la tabla: puntos, diferencia de goles, goles a favor. */
export function clasificacion(equipos: Fila[]): Fila[] {
  const n = (f: Fila, a: string) => num(f[a]) ?? 0;
  return [...equipos].sort(
    (a, b) =>
      n(b, "P") - n(a, "P") ||
      n(b, "GF") - n(b, "GA") - (n(a, "GF") - n(a, "GA")) ||
      n(b, "GF") - n(a, "GF"),
  );
}

/* ------------------------------------------------------------------ */
/*  PARTIDOS                                                           */
/* ------------------------------------------------------------------ */

export type PartidoEquipo = { fila: Fila; rival: string; rivalId: string; otra: Fila | null; fecha: string; gf: number | null; gc: number | null };

/** Los partidos de un equipo, en orden de fecha, con el rival sacado de la otra fila. */
export function partidosDe(partidos: Fila[], teamId: string): PartidoEquipo[] {
  const porPartido = new Map<string, Fila[]>();
  for (const f of partidos) {
    const p = String(f.partido ?? "");
    porPartido.set(p, [...(porPartido.get(p) ?? []), f]);
  }
  return partidos
    .filter((f) => f.teamId === teamId)
    .map((fila) => {
      const otro = (porPartido.get(String(fila.partido)) ?? []).find((x) => x.teamId !== teamId);
      return {
        fila,
        rival: otro ? nombreEquipo(otro) : "",
        rivalId: String(otro?.teamId ?? ""),
        otra: otro ?? null,
        fecha: String(fila.fecha ?? ""),
        gf: num(fila.Goal),
        gc: num(fila.GA),
      };
    })
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
}

/** «31 ago» */
export function fechaCorta(fecha: string): string {
  const d = new Date(fecha.replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return fecha.slice(0, 10);
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" }).replace(".", "");
}

/* ------------------------------------------------------------------ */
/*  JUGADORES                                                          */
/* ------------------------------------------------------------------ */

export const familiaDe = (f: Fila): string => FAMILIA_PUESTO[String(f.puesto ?? "")] ?? "";

/** Columnas que no son métricas en las tablas de jugadores. */
export const CLAVES_JUGADOR = new Set(["playerId", "jugador", "teamId", "equipo", "puesto", "partido", "fecha", "rival"]);

/**
 * El percentil de cada jugador en una métrica por 90 entre los de su familia
 * de puesto con el mínimo de minutos. playerId → percentil.
 */
export function percentilesPorFamilia(
  jugadores: Fila[],
  a: string,
  minimo: number,
  mejor: boolean | null,
  catalogo?: Map<string, MetricaOpta>,
): Map<string, number> {
  const porFamilia = new Map<string, { id: string; v: number }[]>();
  for (const f of jugadores) {
    const fam = familiaDe(f);
    if (!fam) continue;
    const v = valorJugador(f, a, minimo, catalogo);
    if (v == null) continue;
    porFamilia.set(fam, [...(porFamilia.get(fam) ?? []), { id: String(f.playerId ?? ""), v }]);
  }
  const salida = new Map<string, number>();
  for (const lista of porFamilia.values()) {
    const muestra = lista.map((x) => x.v);
    for (const x of lista) {
      const p = percentil(x.v, muestra, mejor === false);
      if (p != null) salida.set(x.id, p);
    }
  }
  return salida;
}

/* ------------------------------------------------------------------ */
/*  DIFERENCIALES                                                      */
/* ------------------------------------------------------------------ */

export type Diferencial = { teamId: string; equipo: string; propio: number; rival: number; dif: number; partidos: number };

/**
 * «Lo mío menos lo del rival», por partido: cada partido de `opta:partidos`
 * trae las dos filas, se emparejan por `partido` y se promedia la resta.
 * Ej.: 149 remates propios y 85 del rival en 11 partidos = +5,8 por partido.
 */
export function diferenciales(partidos: Fila[], a: string, catalogo?: Map<string, MetricaOpta>): Diferencial[] {
  const porPartido = new Map<string, Fila[]>();
  for (const f of partidos) {
    const p = String(f.partido ?? "");
    if (p) porPartido.set(p, [...(porPartido.get(p) ?? []), f]);
  }
  const acumulado = new Map<string, Diferencial>();
  for (const filas of porPartido.values()) {
    if (filas.length !== 2) continue;
    for (const [yo, otro] of [filas, [filas[1], filas[0]]]) {
      const v = valorPartido(yo, a, catalogo);
      const w = valorPartido(otro, a, catalogo);
      if (v == null || w == null) continue;
      const id = String(yo.teamId ?? "");
      const d = acumulado.get(id) ?? { teamId: id, equipo: nombreEquipo(yo), propio: 0, rival: 0, dif: 0, partidos: 0 };
      d.propio += v;
      d.rival += w;
      d.partidos += 1;
      acumulado.set(id, d);
    }
  }
  return [...acumulado.values()].map((d) => ({ ...d, dif: d.partidos ? (d.propio - d.rival) / d.partidos : 0 }));
}

/* ------------------------------------------------------------------ */
/*  DEPENDENCIA                                                        */
/* ------------------------------------------------------------------ */

export const METRICAS_DEPENDENCIA = ["Goal", "ExpG", "xA", "Chance", "TouchOpBox", "PsAtt"];

export type Dependencia = { playerId: string; jugador: string; puesto: string; min: number; partes: Record<string, number | null> };

/**
 * Cuánto pesa cada jugador en su equipo: su parte del total en goles, xG,
 * xA, ocasiones, toques en el área y pases (0-100). El total es el del equipo
 * en `opta:equipos`; si la suma de los jugadores es mayor (o el equipo no
 * trae la columna), la suma: así nadie pasa del 100 %.
 */
export function dependenciaDe(jugadores: Fila[], equipo: Fila | null, teamId: string, metricas = METRICAS_DEPENDENCIA): Dependencia[] {
  const suyos = jugadores.filter((f) => f.teamId === teamId && (num(f.Min) ?? 0) > 0);
  const totales = new Map<string, number>();
  for (const a of metricas) {
    const suma = suyos.reduce((s, f) => s + (num(f[a]) ?? 0), 0);
    totales.set(a, Math.max(suma, num(equipo?.[a]) ?? 0));
  }
  return suyos.map((f) => ({
    playerId: String(f.playerId ?? ""),
    jugador: String(f.jugador ?? ""),
    puesto: String(f.puesto ?? ""),
    min: num(f.Min) ?? 0,
    partes: Object.fromEntries(
      metricas.map((a) => {
        const t = totales.get(a) ?? 0;
        const v = num(f[a]);
        return [a, t > 0 && v != null ? (v / t) * 100 : null];
      }),
    ),
  }));
}
