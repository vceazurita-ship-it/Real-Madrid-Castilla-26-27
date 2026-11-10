/**
 * JORNADA A JORNADA Y CARA A CARA (10/11/2026): las cuentas de la pestaña
 * «Evolución» de /opta y de la ficha de cualquier partido, sobre
 * `opta:partidos` (equipo × partido). Funciones puras, para probarlas en Node
 * con las copias de `.cache/opta`.
 *
 * LA JORNADA. Opta no trae el número de jornada. «Jornada k» de un equipo es
 * su k-ésimo partido por fecha; la media de la liga en la jornada k es la de
 * los k-ésimos partidos de todos los equipos del ámbito. Con un aplazado, cada
 * equipo sigue contando sus partidos en orden, que es lo que se quiere
 * comparar («cómo iba cada uno a estas alturas»).
 *
 * LAS DERIVADAS. Unas pocas cifras no vienen en la tabla y se sacan de dos
 * columnas del mismo partido (xG por remate, acierto en balones largos, pases
 * por secuencia). Llevan clave propia con «·» para no chocar con Opta.
 */

import type { Unidad } from "@/lib/data-analisis/metricas";
import { num, type MetricaOpta } from "@/lib/opta";
import { partidosDe, valorPartido, type Fila, type PartidoEquipo } from "@/lib/opta-analisis";
import { defMetrica, METRICAS_OPTA, type DefMetrica } from "@/lib/opta-nombres";

/* ------------------------------------------------------------------ */
/*  MÉTRICAS (las de la tabla y las derivadas)                         */
/* ------------------------------------------------------------------ */

type Derivada = DefMetrica & { calc: (f: Fila) => number | null };

const cociente = (arriba: string, abajo: string, factor = 1) => (f: Fila) => {
  const a = num(f[arriba]);
  const b = num(f[abajo]);
  return a == null || b == null || b <= 0 ? null : (a / b) * factor;
};

export const DERIVADAS: Record<string, Derivada> = {
  "·xGRemate": {
    nombre: "xG por remate",
    corto: "xG/rem.",
    unidad: "decimal",
    tasa: true,
    mejor: true,
    que: "xG entre remates del partido: la calidad media de cada uno",
    calc: cociente("ExpG", "ShtIncBl"),
  },
  "·LargosOk": {
    nombre: "Acierto en balones largos",
    corto: "% largos ok",
    unidad: "porcentaje",
    tasa: true,
    mejor: true,
    que: "Balones largos completados entre intentados",
    calc: cociente("LgBallCp", "LgBall", 100),
  },
  "·PasesSecuencia": {
    nombre: "Pases por secuencia",
    corto: "Pases/sec.",
    unidad: "decimal",
    tasa: true,
    mejor: null,
    que: "Pases intentados entre secuencias de posesión: cuánto se elabora cada una",
    calc: cociente("PsAtt", "Sequences"),
  },
  "·AlHuecoOk": {
    nombre: "Acierto en pases al hueco",
    corto: "% al hueco ok",
    unidad: "porcentaje",
    tasa: true,
    mejor: true,
    calc: cociente("ThrghBlCmp", "ThrghBalls", 100),
  },
};

/** Cómo se lee una métrica, derivada o de Opta. */
export function defDe(a: string, catalogo?: Map<string, MetricaOpta>): DefMetrica {
  return DERIVADAS[a] ?? defMetrica(a, catalogo);
}

/** El valor en pantalla de una fila de partido (porcentajes en tanto por cien). */
export function valorDe(f: Fila, a: string, catalogo?: Map<string, MetricaOpta>): number | null {
  const d = DERIVADAS[a];
  if (d) {
    const v = d.calc(f);
    return v != null && Number.isFinite(v) ? v : null;
  }
  return valorPartido(f, a, catalogo);
}

const NO_METRICA = new Set(["partido", "fecha", "teamId", "equipo"]);

/**
 * Las métricas que se pueden pintar: las columnas de `opta:partidos` que están
 * traducidas (o que el catálogo de Opta describe) y las derivadas cuyas dos
 * columnas vienen en la tabla.
 */
export function metricasPartido(partidos: Fila[], catalogo?: Map<string, MetricaOpta>): string[] {
  const cols = new Set<string>();
  for (const f of partidos.slice(0, 2)) for (const k of Object.keys(f)) if (!NO_METRICA.has(k)) cols.add(k);
  const deOpta = [...cols].filter((k) => METRICAS_OPTA[k] || catalogo?.has(k));
  const derivadas = Object.keys(DERIVADAS).filter((k) => partidos.some((f) => valorDe(f, k) != null));
  return [...deOpta, ...derivadas];
}

/* ------------------------------------------------------------------ */
/*  JORNADA A JORNADA                                                  */
/* ------------------------------------------------------------------ */

export type Modo = "partido" | "acumulado";

export type PuntoEvo = {
  jornada: number;
  partido: string;
  fecha: string;
  rival: string;
  gf: number | null;
  gc: number | null;
  equipo: number | null;
  rivales: number | null;
  liga: number | null;
};

/** Los partidos de cada equipo, en orden de fecha (y con rival). */
export function partidosPorEquipo(partidos: Fila[]): Map<string, PartidoEquipo[]> {
  const ids = [...new Set(partidos.map((f) => String(f.teamId ?? "")).filter(Boolean))];
  return new Map(ids.map((id) => [id, partidosDe(partidos, id).filter((p) => p.otra)]));
}

const media = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x != null && Number.isFinite(x));
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
};

/** La media hasta cada punto (sin contar los huecos). */
function acumula(xs: (number | null)[]): (number | null)[] {
  let suma = 0;
  let n = 0;
  return xs.map((x) => {
    if (x != null) {
      suma += x;
      n++;
    }
    return n ? suma / n : null;
  });
}

/**
 * La serie de un equipo en una métrica: él, sus rivales en esos mismos
 * partidos y la media de los equipos de `ambito` en esa jornada.
 */
export function serieEvolucion(
  porEquipo: Map<string, PartidoEquipo[]>,
  teamId: string,
  a: string,
  ambito: Set<string>,
  modo: Modo,
  catalogo?: Map<string, MetricaOpta>,
): PuntoEvo[] {
  const suyos = porEquipo.get(teamId) ?? [];
  const equipo = suyos.map((p) => valorDe(p.fila, a, catalogo));
  const rivales = suyos.map((p) => (p.otra ? valorDe(p.otra, a, catalogo) : null));
  const liga = suyos.map((_, k) => media([...ambito].map((id) => {
    const p = porEquipo.get(id)?.[k];
    return p ? valorDe(p.fila, a, catalogo) : null;
  })));
  const [e, r, l] = modo === "acumulado" ? [acumula(equipo), acumula(rivales), acumula(liga)] : [equipo, rivales, liga];
  return suyos.map((p, k) => ({
    jornada: k + 1,
    partido: String(p.fila.partido ?? ""),
    fecha: p.fecha,
    rival: p.rival,
    gf: p.gf,
    gc: p.gc,
    equipo: e[k],
    rivales: r[k],
    liga: l[k],
  }));
}

/* ------------------------------------------------------------------ */
/*  ARRANQUE VS PROCESO                                                */
/* ------------------------------------------------------------------ */

export type Tramo = { antes: number | null; despues: number | null; dif: number | null };

export type FilaArranque = {
  a: string;
  equipo: Tramo;
  rivales: Tramo;
  /** El cambio del equipo en desviaciones típicas de la liga (para elegir el más grande). */
  zEquipo: number | null;
  zRivales: number | null;
};

const tramo = (antes: number | null, despues: number | null): Tramo => ({
  antes,
  despues,
  dif: antes != null && despues != null ? despues - antes : null,
});

function desviacion(xs: number[]): number | null {
  if (xs.length < 3) return null;
  const m = xs.reduce((s, x) => s + x, 0) / xs.length;
  const v = xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1);
  return v > 0 ? Math.sqrt(v) : null;
}

/** Los primeros N partidos y los últimos N de un equipo. */
export function tramosDe(suyos: PartidoEquipo[], n: number): { primeras: PartidoEquipo[]; ultimas: PartidoEquipo[] } {
  return { primeras: suyos.slice(0, n), ultimas: suyos.slice(Math.max(0, suyos.length - n)) };
}

/**
 * Media por partido de cada métrica en las primeras N jornadas y en las
 * últimas N, del equipo y de sus rivales. `todas` son las filas de la liga
 * (para medir cuánto es mucho en cada métrica).
 */
export function arranqueProceso(
  suyos: PartidoEquipo[],
  n: number,
  metricas: string[],
  todas: Fila[],
  catalogo?: Map<string, MetricaOpta>,
): FilaArranque[] {
  const { primeras, ultimas } = tramosDe(suyos, n);
  return metricas.map((a) => {
    const eq = tramo(media(primeras.map((p) => valorDe(p.fila, a, catalogo))), media(ultimas.map((p) => valorDe(p.fila, a, catalogo))));
    const ri = tramo(
      media(primeras.map((p) => (p.otra ? valorDe(p.otra, a, catalogo) : null))),
      media(ultimas.map((p) => (p.otra ? valorDe(p.otra, a, catalogo) : null))),
    );
    /* La escala: lo que se mueve un promedio de N partidos (la desviación de un partido / √N). */
    const sd = desviacion(todas.map((f) => valorDe(f, a, catalogo)).filter((x): x is number => x != null));
    const escala = sd != null ? sd / Math.sqrt(n) : null;
    return {
      a,
      equipo: eq,
      rivales: ri,
      zEquipo: escala && eq.dif != null ? eq.dif / escala : null,
      zRivales: escala && ri.dif != null ? ri.dif / escala : null,
    };
  });
}

/** ¿El cambio es a mejor para el equipo? (en los rivales, al revés). null en las de estilo. */
export function aMejor(def: DefMetrica, dif: number | null, deRivales = false): boolean | null {
  if (def.mejor === null || dif == null || dif === 0) return null;
  const sube = dif > 0;
  const bueno = def.mejor ? sube : !sube;
  return deRivales ? !bueno : bueno;
}

export type Cambio = { fila: FilaArranque; lado: "equipo" | "rivales"; z: number };

/** Los cambios más grandes (en desviaciones), los de estilo incluidos. */
export function mayoresCambios(filas: FilaArranque[], cuantos = 2): Cambio[] {
  const todos: Cambio[] = [];
  for (const f of filas) {
    if (f.zEquipo != null) todos.push({ fila: f, lado: "equipo", z: f.zEquipo });
    if (f.zRivales != null) todos.push({ fila: f, lado: "rivales", z: f.zRivales });
  }
  todos.sort((x, y) => Math.abs(y.z) - Math.abs(x.z));
  /* Una métrica una vez: si cambian el equipo y sus rivales, la del mayor. */
  const vistas = new Set<string>();
  return todos.filter((c) => (vistas.has(c.fila.a) ? false : (vistas.add(c.fila.a), true))).slice(0, cuantos);
}

/** Para un rótulo pequeño sobre un punto: sin unidad y con coma. */
export function rotuloCorto(v: number | null, unidad: Unidad): string {
  if (v == null || !Number.isFinite(v)) return "";
  if (unidad === "porcentaje") return String(Math.round(v));
  if (unidad === "entero") return String(Math.round(v * 10) / 10).replace(".", ",");
  return (Math.abs(v) >= 10 ? v.toFixed(0) : v.toFixed(Math.abs(v) >= 1 ? 1 : 2)).replace(".", ",");
}

/* ------------------------------------------------------------------ */
/*  11 METROS POR EQUIPO                                               */
/* ------------------------------------------------------------------ */

export type FilaPenaltisEquipo = {
  teamId: string;
  equipo: string;
  n: number;
  goles: number;
  /** Los que no fueron gol: parados, fuera y al palo. */
  fallados: number;
  parados: number;
  fuera: number;
  palo: number;
  conversion: number | null;
  /** A favor, lanzadores distintos; en contra, porteros distintos que los afrontaron. */
  distintos: number;
};

/**
 * Cada equipo con sus penaltis a favor (los que lanza) o en contra (los que le
 * tiran). Sólo los equipos con alguno. `ps` ya viene de uno en uno
 * (`penaltisDe`).
 */
export function rankingPenaltis(
  ps: { teamId: string; equipo: string; rivalId: string; rival: string; gol: boolean; parado: boolean; tipo: string; tirador: string; portero: string }[],
  lado: "favor" | "contra",
): FilaPenaltisEquipo[] {
  const m = new Map<string, FilaPenaltisEquipo & { quienes: Set<string> }>();
  for (const p of ps) {
    const id = lado === "favor" ? p.teamId : p.rivalId;
    if (!id) continue;
    const f = m.get(id) ?? {
      teamId: id,
      equipo: lado === "favor" ? p.equipo : p.rival,
      n: 0,
      goles: 0,
      fallados: 0,
      parados: 0,
      fuera: 0,
      palo: 0,
      conversion: null,
      distintos: 0,
      quienes: new Set<string>(),
    };
    f.n++;
    if (p.gol) f.goles++;
    else {
      f.fallados++;
      if (p.parado) f.parados++;
      else if (p.tipo === "Post") f.palo++;
      else f.fuera++;
    }
    const quien = lado === "favor" ? p.tirador : p.portero;
    if (quien) f.quienes.add(quien);
    m.set(id, f);
  }
  return [...m.values()]
    .map(({ quienes, ...f }) => ({ ...f, conversion: f.n ? f.goles / f.n : null, distintos: quienes.size }))
    .sort((a, b) => b.n - a.n || (b.conversion ?? 0) - (a.conversion ?? 0) || a.equipo.localeCompare(b.equipo, "es"));
}
