/**
 * OPTA EVENTO A EVENTO (09/11/2026): remates, penaltis, balón parado de la
 * categoría, momentum por tramos y las acciones del Castilla.
 *
 * Sólo nombres y fórmulas: los datos viven en Supabase (`lib/opta.ts`).
 *
 * **Cada evento viene dos veces.** La consulta es `FROM team BY event`, y
 * TruMedia devuelve el evento una vez por cada equipo del partido: la misma
 * jugada con `teamId`/`equipo`/`rival` cambiados y el `MatchState` visto
 * desde cada lado. El evento NO dice de qué equipo es su protagonista, así
 * que se deduce:
 *
 * 1. Por el protagonista (tirador, lanzador): su equipo es el que aparece en
 *    TODOS sus eventos de la temporada; el rival sólo en los de ese partido.
 * 2. Si empata (sólo ha salido en un partido), por la plantilla de
 *    `opta:jugadores` (id o nombre → equipo).
 * 3. Si aún empata, lo que diga quien llama (el remate de la misma
 *    secuencia, en el balón parado).
 *
 * Con eso se queda la fila del equipo del protagonista: su `MatchState` es
 * el de ese equipo («ganando» es que gana el que tira).
 *
 * `opta:castilla-eventos` no está duplicado (se pidió por el Castilla) pero
 * trae los eventos de LOS DOS equipos en sus partidos. Del Castilla es el que
 * tiene un jugador de su plantilla; las recuperaciones, duelos aéreos y
 * entradas fallidas vienen sin jugador, y se atribuyen por la posesión
 * (`posesion`: la del equipo que la tiene) o, si no, por la acción siguiente
 * con jugador. Contrastado con `opta:momento`: sale la misma cuenta de
 * recuperaciones del Castilla con ±3 por partido.
 *
 * Coordenadas: x 0-100 hacia la portería rival, y 0-100 (0 = banda derecha
 * del que ataca), siempre del lado de quien hace la acción.
 */

import { CASTILLA_OPTA, num, type Celda, type TablaOpta } from "@/lib/opta";

type Fila = Record<string, Celda>;

/* ------------------------------------------------------------------ */
/*  Atribución del equipo                                              */
/* ------------------------------------------------------------------ */

/** Jugador → equipo, sacado de `opta:jugadores` / `opta:castilla`. */
export type Pista = { porId: Map<string, string>; porNombre: Map<string, string> };

export function pistaDe(...listas: Fila[][]): Pista {
  const porId = new Map<string, string>();
  const porNombre = new Map<string, string>();
  for (const lista of listas)
    for (const f of lista) {
      const t = String(f.teamId ?? "");
      if (!t) continue;
      if (f.playerId) porId.set(String(f.playerId), t);
      if (f.jugador) porNombre.set(String(f.jugador), t);
    }
  return { porId, porNombre };
}

const PISTA_VACIA: Pista = { porId: new Map(), porNombre: new Map() };

const idx = (t: TablaOpta) => {
  const m = new Map<string, number>();
  t.cols.forEach((c, i) => m.set(c, i));
  return (c: string) => m.get(c) ?? -1;
};

const str = (v: Celda | undefined) => (v == null ? "" : String(v));

/**
 * Erratas del nombre tal como lo escribe Opta (10/11/2026): sólo lo que es
 * una falta de ortografía, no una equivalencia (ésas van en
 * lib/data-analisis/nombres.ts).
 */
const ERRATAS_OPTA: Record<string, string> = {
  "Ávaro Leiva": "Álvaro Leiva",
};
const corrigeNombre = (nombre: string) => ERRATAS_OPTA[nombre] ?? nombre;

type Grupo = { filas: Celda[][]; equipos: string[] };

/**
 * Junta las filas repetidas de cada evento y elige la del equipo del
 * protagonista. `actor` = columna del nombre (y `actorId`, si la hay).
 */
function deduplica(
  t: TablaOpta,
  clave: (f: Celda[]) => string,
  actor: (f: Celda[]) => string,
  actorId: ((f: Celda[]) => string) | null,
  pista: Pista,
  desempate?: (g: Grupo) => string | null,
): { fila: Celda[]; teamId: string; equipo: string; rivalId: string; rival: string }[] {
  const c = idx(t);
  const iPartido = c("partido");
  const iTeam = c("teamId");
  const iEquipo = c("equipo");

  /* Los dos equipos de cada partido y sus nombres. */
  const delPartido = new Map<string, Set<string>>();
  const nombre = new Map<string, string>();
  for (const f of t.filas) {
    const p = str(f[iPartido]);
    const e = str(f[iTeam]);
    if (!delPartido.has(p)) delPartido.set(p, new Set());
    delPartido.get(p)!.add(e);
    nombre.set(e, str(f[iEquipo]));
  }

  const grupos = new Map<string, Grupo>();
  for (const f of t.filas) {
    const k = `${str(f[iPartido])}|${clave(f)}`;
    let g = grupos.get(k);
    if (!g) {
      g = { filas: [], equipos: [...(delPartido.get(str(f[iPartido])) ?? [])] };
      grupos.set(k, g);
    }
    g.filas.push(f);
  }

  /* Cuántas veces sale cada protagonista con cada equipo. */
  const cuenta = new Map<string, Map<string, number>>();
  for (const g of grupos.values()) {
    const a = actor(g.filas[0]);
    if (!a) continue;
    let m = cuenta.get(a);
    if (!m) cuenta.set(a, (m = new Map()));
    for (const e of g.equipos) m.set(e, (m.get(e) ?? 0) + 1);
  }

  const salida: { fila: Celda[]; teamId: string; equipo: string; rivalId: string; rival: string }[] = [];
  for (const g of grupos.values()) {
    const f0 = g.filas[0];
    const a = actor(f0);
    const [e1, e2] = g.equipos;
    let suyo: string | null = null;
    if (e2 && a) {
      const m = cuenta.get(a);
      const n1 = m?.get(e1) ?? 0;
      const n2 = m?.get(e2) ?? 0;
      if (n1 !== n2) suyo = n1 > n2 ? e1 : e2;
    }
    if (!suyo && e2) {
      const p = (actorId && pista.porId.get(actorId(f0))) || pista.porNombre.get(a);
      if (p === e1 || p === e2) suyo = p;
    }
    if (!suyo && e2 && desempate) {
      const d = desempate(g);
      if (d === e1 || d === e2) suyo = d;
    }
    if (!suyo) suyo = str(f0[iTeam]);
    const fila = g.filas.find((f) => str(f[iTeam]) === suyo) ?? f0;
    const rivalId = g.equipos.find((e) => e !== suyo) ?? "";
    salida.push({ fila, teamId: suyo, equipo: nombre.get(suyo) ?? "", rivalId, rival: nombre.get(rivalId) ?? "" });
  }
  return salida;
}

/* ------------------------------------------------------------------ */
/*  Remates                                                            */
/* ------------------------------------------------------------------ */

export type Marcador = "Tied" | "Ahead" | "Behind" | "";
export const MARCADOR: Record<string, string> = { Tied: "Empatando", Ahead: "Ganando", Behind: "Perdiendo" };

export type Remate = {
  partido: string;
  fecha: string;
  teamId: string;
  equipo: string;
  rivalId: string;
  rival: string;
  parte: number;
  segundo: number;
  minuto: number;
  tipo: string;
  gol: boolean;
  aPuerta: boolean;
  secuencia: number | null;
  tirador: string;
  tiradorId: string;
  asistente: string;
  x: number;
  y: number;
  xG: number;
  xGOT: number;
  cuerpo: string;
  situacion: string;
  presion: string;
  entre: string;
  gmY: number | null;
  gmZ: number | null;
  marcador: Marcador;
};

export const TIPO_REMATE: Record<string, string> = {
  Goal: "Gol",
  PenaltyGoal: "Gol de penalti",
  AttemptSaved: "Parado o bloqueado",
  Post: "Al palo",
  Miss: "Fuera",
};

export const CUERPO: Record<string, string> = { "Right Foot": "Pie derecho", "Left Foot": "Pie izquierdo", Head: "Cabeza" };

export const SITUACION: Record<string, string> = {
  "Open play": "Juego",
  "Fastbreak/Counter": "Contragolpe",
  Corner: "Córner",
  "Free Kick Set Piece": "Falta (jugada)",
  "Direct Free Kick": "Falta directa",
  "Throw-in": "Saque de banda",
  Penalty: "Penalti",
};

export const PRESION: Record<string, string> = { High: "Alta", Moderate: "Media", Low: "Baja" };

/** Minuto de partido (1-90+), del reloj de Opta en segundos. */
export const minutoDe = (segundo: number) => Math.floor(segundo / 60) + 1;

const cacheRemates = new WeakMap<TablaOpta, Remate[]>();

export function rematesDe(t: TablaOpta | null, pista: Pista = PISTA_VACIA): Remate[] {
  if (!t) return [];
  const hecho = cacheRemates.get(t);
  if (hecho) return hecho;
  const c = idx(t);
  const [iParte, iSeg, iTipo, iTir, iTirId, iSec, iX, iY] = ["parte", "segundo", "tipo", "tirador", "tiradorId", "secuencia", "EventX|EVENT", "EventY|EVENT"].map(c);
  const unicos = deduplica(
    t,
    (f) => `${str(f[iParte])}|${str(f[iSeg])}|${str(f[iTirId]) || str(f[iTir])}|${str(f[iX])}|${str(f[iY])}`,
    (f) => str(f[iTir]),
    (f) => str(f[iTirId]),
    pista,
  );
  const v = (f: Celda[], col: string) => f[c(col)];
  const salida = unicos.map(({ fila: f, teamId, equipo, rivalId, rival }): Remate => {
    const tipo = str(f[iTipo]);
    const gol = tipo === "Goal" || tipo === "PenaltyGoal";
    const xGOT = num(v(f, "xGOT|EVENT")) ?? 0;
    const segundo = num(f[iSeg]) ?? 0;
    return {
      partido: str(v(f, "partido")),
      fecha: str(v(f, "fecha")),
      teamId,
      equipo,
      rivalId,
      rival,
      parte: num(f[iParte]) ?? 1,
      segundo,
      minuto: minutoDe(segundo),
      tipo,
      gol,
      aPuerta: gol || (tipo === "AttemptSaved" && xGOT > 0),
      secuencia: num(f[iSec]),
      tirador: str(f[iTir]),
      tiradorId: str(f[iTirId]),
      asistente: str(v(f, "asistente")),
      x: num(f[iX]) ?? 0,
      y: num(f[iY]) ?? 50,
      xG: num(v(f, "xG|EVENT")) ?? 0,
      xGOT,
      cuerpo: str(v(f, "ShotBodyPart|EVENT")),
      situacion: str(v(f, "ShotPlayStyle|EVENT")),
      presion: str(v(f, "Pressure|EVENT")),
      entre: str(v(f, "PlyrsBtwn|EVENT")),
      gmY: num(v(f, "GoalmouthY|EVENT")),
      gmZ: num(v(f, "GoalmouthZ|EVENT")),
      marcador: str(v(f, "MatchState|EVENT")) as Marcador,
    };
  });
  salida.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.partido.localeCompare(b.partido) || a.segundo - b.segundo);
  cacheRemates.set(t, salida);
  return salida;
}

export type ResumenRemates = {
  remates: number;
  goles: number;
  xG: number;
  xGPorRemate: number | null;
  aPuerta: number;
  pctPuerta: number | null;
  /** xGOT − xG de los remates a puerta: lo que el golpeo añade (o quita) a la ocasión. */
  xGOTmenosXG: number | null;
  /** Goles − xG: si se marca más o menos de lo que dan las ocasiones. */
  golesMenosXG: number;
  partidos: number;
};

export function resumenRemates(rs: Remate[]): ResumenRemates {
  const puerta = rs.filter((r) => r.aPuerta);
  const xG = rs.reduce((s, r) => s + r.xG, 0);
  const goles = rs.filter((r) => r.gol).length;
  return {
    remates: rs.length,
    goles,
    xG,
    xGPorRemate: rs.length ? xG / rs.length : null,
    aPuerta: puerta.length,
    pctPuerta: rs.length ? puerta.length / rs.length : null,
    xGOTmenosXG: puerta.length ? puerta.reduce((s, r) => s + r.xGOT - r.xG, 0) : null,
    golesMenosXG: goles - xG,
    partidos: new Set(rs.map((r) => r.partido)).size,
  };
}

/* ------------------------------------------------------------------ */
/*  Penaltis                                                           */
/* ------------------------------------------------------------------ */

export type Penalti = {
  partido: string;
  fecha: string;
  teamId: string;
  equipo: string;
  rivalId: string;
  rival: string;
  minuto: number;
  tipo: string;
  gol: boolean;
  parado: boolean;
  tirador: string;
  tiradorId: string;
  portero: string;
  porteroId: string;
  pie: string;
  gmY: number | null;
  gmZ: number | null;
  marcador: Marcador;
};

/** Entre palos y bajo el larguero (en las unidades de Opta). */
export const PALO_DCHO = 45.2;
export const PALO_IZDO = 54.8;
export const LARGUERO = 38;

/** Lado visto DESDE EL PUNTO DE PENALTI (el del lanzador). Y alta = su izquierda. */
export type Lado = "izquierda" | "centro" | "derecha";
export const ladoDe = (y: number | null): Lado | null =>
  y == null ? null : y > 51.6 ? "izquierda" : y < 48.4 ? "derecha" : "centro";

export type Altura = "raso" | "media altura" | "arriba";
export const alturaDe = (z: number | null): Altura | null =>
  z == null ? null : z < LARGUERO / 3 ? "raso" : z < (LARGUERO * 2) / 3 ? "media altura" : "arriba";

const cachePenaltis = new WeakMap<TablaOpta, Penalti[]>();

export function penaltisDe(t: TablaOpta | null, pista: Pista = PISTA_VACIA): Penalti[] {
  if (!t) return [];
  const hecho = cachePenaltis.get(t);
  if (hecho) return hecho;
  const c = idx(t);
  const g = (f: Celda[], col: string) => f[c(col)];
  const unicos = deduplica(
    t,
    (f) => `${str(g(f, "parte"))}|${str(g(f, "segundo"))}|${str(g(f, "tiradorId"))}`,
    (f) => str(g(f, "tirador")),
    (f) => str(g(f, "tiradorId")),
    pista,
    /* El portero es del otro equipo. */
    (gr) => {
      const p = pista.porId.get(str(g(gr.filas[0], "porteroId"))) ?? pista.porNombre.get(str(g(gr.filas[0], "portero")));
      return p ? (gr.equipos.find((e) => e !== p) ?? null) : null;
    },
  );
  const salida = unicos.map(({ fila: f, teamId, equipo, rivalId, rival }): Penalti => {
    const tipo = str(g(f, "tipo"));
    return {
      partido: str(g(f, "partido")),
      fecha: str(g(f, "fecha")),
      teamId,
      equipo,
      rivalId,
      rival,
      minuto: minutoDe(num(g(f, "segundo")) ?? 0),
      tipo,
      gol: tipo === "PenaltyGoal" || tipo === "Goal",
      parado: tipo === "AttemptSaved",
      tirador: str(g(f, "tirador")),
      tiradorId: str(g(f, "tiradorId")),
      portero: str(g(f, "portero")),
      porteroId: str(g(f, "porteroId")),
      pie: str(g(f, "ShotBodyPart|EVENT")),
      gmY: num(g(f, "GoalmouthY|EVENT")),
      gmZ: num(g(f, "GoalmouthZ|EVENT")),
      marcador: str(g(f, "MatchState|EVENT")) as Marcador,
    };
  });
  salida.sort((a, b) => b.fecha.localeCompare(a.fecha) || a.minuto - b.minuto);
  cachePenaltis.set(t, salida);
  return salida;
}

export type ResumenPenaltis = {
  n: number;
  goles: number;
  parados: number;
  fuera: number;
  pct: number | null;
  lados: Record<Lado, number>;
  alturas: Record<Altura, number>;
  /** El lado más repetido, si se repite (al menos dos y más que los otros). */
  preferido: Lado | null;
};

export function resumenPenaltis(ps: Penalti[]): ResumenPenaltis {
  const lados: Record<Lado, number> = { izquierda: 0, centro: 0, derecha: 0 };
  const alturas: Record<Altura, number> = { raso: 0, "media altura": 0, arriba: 0 };
  for (const p of ps) {
    const l = ladoDe(p.gmY);
    if (l) lados[l]++;
    const a = alturaDe(p.gmZ);
    if (a) alturas[a]++;
  }
  const orden = (Object.entries(lados) as [Lado, number][]).sort((a, b) => b[1] - a[1]);
  const goles = ps.filter((p) => p.gol).length;
  const parados = ps.filter((p) => p.parado).length;
  return {
    n: ps.length,
    goles,
    parados,
    fuera: ps.length - goles - parados,
    pct: ps.length ? goles / ps.length : null,
    lados,
    alturas,
    preferido: orden[0][1] >= 2 && orden[0][1] > orden[1][1] ? orden[0][0] : null,
  };
}

/* ------------------------------------------------------------------ */
/*  Balón parado evento a evento                                       */
/* ------------------------------------------------------------------ */

export type TipoSaque = "corner" | "falta" | "banda";

export type Saque = {
  partido: string;
  fecha: string;
  teamId: string;
  equipo: string;
  rivalId: string;
  rival: string;
  abp: TipoSaque;
  segundo: number;
  minuto: number;
  secuencia: number | null;
  lanzador: string;
  receptor: string;
  x: number;
  y: number;
  finX: number;
  finY: number;
  completo: boolean;
  /** Inswinger / Outswinger / Short / Straight (sólo córners). */
  rosca: string;
  marcador: Marcador;
  /**
   * Los remates de su misma jugada (mismo partido y secuencia, del mismo
   * equipo): la «primera jugada», la que Opta cuenta en `CrnrsLeadingShot`.
   */
  remates: Remate[];
  /**
   * Los de la segunda jugada: Opta los marca con la misma situación (córner,
   * falta, banda) pero ya en otra secuencia (rechace, segundo centro). Se
   * atan al último saque de ese tipo del mismo equipo, hasta 40 s antes.
   */
  segundas: Remate[];
};

export const ROSCA: Record<string, string> = { Inswinger: "Cerrado", Outswinger: "Abierto", Short: "En corto", Straight: "Recto" };

/** Lado del saque visto por quien ataca (y < 50 = su banda derecha). */
export const ladoSaque = (s: Saque): "derecha" | "izquierda" => (s.y < 50 ? "derecha" : "izquierda");

/** ¿Cae en el área grande? (x ≥ 83, y entre 21,1 y 78,9). */
export const enArea = (x: number, y: number) => x >= 83 && y >= 21.1 && y <= 78.9;

/** Falta colgada al área: sacada en campo rival (x ≥ 60) y que cae en el área. */
export const esFaltaAlArea = (s: Saque) => s.abp === "falta" && s.x >= 60 && enArea(s.finX, s.finY);
/** De las faltas al área, la lateral: desde fuera del ancho del área. */
export const esFaltaLateral = (s: Saque) => esFaltaAlArea(s) && (s.y < 21.1 || s.y > 78.9);
/** Saque de banda largo: desde el último 40 % del campo y al área. */
export const esBandaLarga = (s: Saque) => s.abp === "banda" && s.x >= 60 && enArea(s.finX, s.finY);

/** La situación del remate (ShotPlayStyle) que dice de qué saque viene. */
const TIPO_DE_SITUACION: Record<string, TipoSaque> = { Corner: "corner", "Free Kick Set Piece": "falta", "Throw-in": "banda" };

const cacheSaques = new WeakMap<TablaOpta, Saque[]>();

export function saquesDe(t: TablaOpta | null, remates: Remate[], pista: Pista = PISTA_VACIA): Saque[] {
  if (!t) return [];
  const hecho = cacheSaques.get(t);
  if (hecho) return hecho;
  const c = idx(t);
  const g = (f: Celda[], col: string) => f[c(col)];

  /* Remates por partido y secuencia. */
  const porSecuencia = new Map<string, Remate[]>();
  for (const r of remates) {
    if (r.secuencia == null) continue;
    const k = `${r.partido}|${r.secuencia}`;
    porSecuencia.set(k, [...(porSecuencia.get(k) ?? []), r]);
  }

  const unicos = deduplica(
    t,
    (f) => `${str(g(f, "abp"))}|${str(g(f, "parte"))}|${str(g(f, "segundo"))}|${str(g(f, "lanzador"))}|${str(g(f, "EventX|EVENT"))}|${str(g(f, "EventY|EVENT"))}`,
    (f) => str(g(f, "lanzador")),
    null,
    pista,
    (gr) => porSecuencia.get(`${str(g(gr.filas[0], "partido"))}|${str(g(gr.filas[0], "secuencia"))}`)?.[0]?.teamId ?? null,
  );

  const salida = unicos.map(({ fila: f, teamId, equipo, rivalId, rival }): Saque => {
    const partido = str(g(f, "partido"));
    const secuencia = num(g(f, "secuencia"));
    const suyos = secuencia == null ? [] : (porSecuencia.get(`${partido}|${secuencia}`) ?? []).filter((r) => r.teamId === teamId);
    return {
      partido,
      fecha: str(g(f, "fecha")),
      teamId,
      equipo,
      rivalId,
      rival,
      abp: str(g(f, "abp")) as TipoSaque,
      segundo: num(g(f, "segundo")) ?? 0,
      minuto: minutoDe(num(g(f, "segundo")) ?? 0),
      secuencia,
      lanzador: str(g(f, "lanzador")),
      receptor: str(g(f, "receptor")),
      x: num(g(f, "EventX|EVENT")) ?? 0,
      y: num(g(f, "EventY|EVENT")) ?? 0,
      finX: num(g(f, "PassEndX|EVENT")) ?? 0,
      finY: num(g(f, "PassEndY|EVENT")) ?? 0,
      completo: str(g(f, "PsCompleted|EVENT")) === "Yes",
      rosca: str(g(f, "CornerType|EVENT")),
      marcador: str(g(f, "MatchState|EVENT")) as Marcador,
      remates: suyos,
      segundas: [],
    };
  });
  /* Si dos saques comparten jugada (un córner en corto y el centro de después
     también marcado como saque), el remate se cuenta en el primero. */
  const vistos = new Set<string>();
  salida.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.partido.localeCompare(b.partido) || a.segundo - b.segundo);
  for (const s of salida) {
    if (!s.remates.length) continue;
    const k = `${s.partido}|${s.secuencia}`;
    if (vistos.has(k)) s.remates = [];
    else vistos.add(k);
  }

  /* La segunda jugada. */
  const atados = new Set(salida.flatMap((s) => s.remates));
  const porEquipo = new Map<string, Saque[]>();
  for (const s of salida) {
    const k = `${s.partido}|${s.teamId}|${s.abp}`;
    porEquipo.set(k, [...(porEquipo.get(k) ?? []), s]);
  }
  for (const r of remates) {
    const tipo = TIPO_DE_SITUACION[r.situacion];
    if (!tipo || atados.has(r)) continue;
    const lista = porEquipo.get(`${r.partido}|${r.teamId}|${tipo}`);
    if (!lista) continue;
    let ultimo: Saque | null = null;
    for (const s of lista) if (s.segundo <= r.segundo) ultimo = s;
    if (ultimo && r.segundo - ultimo.segundo <= 40) ultimo.segundas.push(r);
  }
  cacheSaques.set(t, salida);
  return salida;
}

export type ResumenSaques = {
  n: number;
  partidos: number;
  conRemate: number;
  pctRemate: number | null;
  remates: number;
  xG: number;
  goles: number;
  completos: number;
  pctCompleto: number | null;
  /** Con la segunda jugada: todos los remates que salen de la acción. */
  rematesAccion: number;
  xGAccion: number;
  golesAccion: number;
};

export function resumenSaques(ss: Saque[]): ResumenSaques {
  const conRemate = ss.filter((s) => s.remates.length > 0).length;
  const rs = ss.flatMap((s) => s.remates);
  const todas = ss.flatMap((s) => s.segundas);
  const completos = ss.filter((s) => s.completo).length;
  return {
    n: ss.length,
    partidos: new Set(ss.map((s) => s.partido)).size,
    conRemate,
    pctRemate: ss.length ? conRemate / ss.length : null,
    remates: rs.length,
    xG: rs.reduce((s, r) => s + r.xG, 0),
    goles: rs.filter((r) => r.gol).length,
    completos,
    pctCompleto: ss.length ? completos / ss.length : null,
    rematesAccion: rs.length + todas.length,
    xGAccion: rs.reduce((s, r) => s + r.xG, 0) + todas.reduce((s, r) => s + r.xG, 0),
    golesAccion: rs.filter((r) => r.gol).length + todas.filter((r) => r.gol).length,
  };
}

/** Por lanzador: cuántos, cuántos acaban en remate y el xG que generan. */
export function lanzadores(ss: Saque[]) {
  const m = new Map<string, Saque[]>();
  for (const s of ss) if (s.lanzador) m.set(s.lanzador, [...(m.get(s.lanzador) ?? []), s]);
  return [...m.entries()]
    .map(([lanzador, suyos]) => {
      const r = resumenSaques(suyos);
      const der = suyos.filter((s) => ladoSaque(s) === "derecha").length;
      return { lanzador, ...r, derecha: der, izquierda: suyos.length - der };
    })
    .sort((a, b) => b.n - a.n);
}

/* ------------------------------------------------------------------ */
/*  Momentum                                                           */
/* ------------------------------------------------------------------ */

export type Tramo = {
  tramo: number;
  xG: number;
  remates: number;
  toquesArea: number;
  toquesUltimoTercio: number;
  pases: number;
  posesion: number | null;
  recuperaciones: number;
  recuperacionesArriba: number;
  perdidas: number;
};

export type MomentoPartido = { partido: string; equipos: { teamId: string; equipo: string; tramos: Map<number, Tramo> }[] };

const cacheMomento = new WeakMap<TablaOpta, Map<string, MomentoPartido>>();

/**
 * El tramo de 5′ de un instante (10/11/2026). El reloj de Opta corre seguido:
 * el descuento de la primera parte pasa de 2.700″ y se pisaba con el arranque
 * de la segunda. Con la parte, el descuento de la primera se queda en su
 * último tramo (40-45+, el 8) y la segunda empieza siempre en el 9.
 */
export function tramoDe(parte: number | null | undefined, segundo: number): number {
  const k = Math.floor(segundo / 300);
  if (parte === 1) return Math.min(k, 8);
  if (parte === 2) return Math.max(k, 9);
  return k;
}

/** El segundo para dibujar: el descuento de la primera parte, en el 45′. */
export function segundoEnEje(parte: number | null | undefined, segundo: number): number {
  if (parte === 1) return Math.min(segundo, 2699);
  if (parte === 2) return Math.max(segundo, 2700);
  return segundo;
}

export function momentoDe(t: TablaOpta | null): Map<string, MomentoPartido> {
  const salida = new Map<string, MomentoPartido>();
  if (!t) return salida;
  const hecho = cacheMomento.get(t);
  if (hecho) return hecho;
  const c = idx(t);
  const g = (f: Celda[], col: string) => f[c(col)];
  for (const f of t.filas) {
    const partido = str(g(f, "partido"));
    const teamId = str(g(f, "teamId"));
    let p = salida.get(partido);
    if (!p) salida.set(partido, (p = { partido, equipos: [] }));
    let e = p.equipos.find((x) => x.teamId === teamId);
    if (!e) p.equipos.push((e = { teamId, equipo: str(g(f, "equipo")), tramos: new Map() }));
    /* Con la columna «parte» (descargas desde el 10/11/2026), el descuento
       de la primera se suma a su tramo 8; sin ella, como venía. */
    const bruto = num(g(f, "tramo")) ?? 0;
    const parte = c("parte") >= 0 ? num(g(f, "parte")) : null;
    const tramo = parte == null ? bruto : parte === 1 ? Math.min(bruto, 8) : Math.max(bruto, 9);
    const nuevo = {
      tramo,
      xG: num(g(f, "ExpG")) ?? 0,
      remates: num(g(f, "ShtIncBl")) ?? 0,
      toquesArea: num(g(f, "TouchOpBox")) ?? 0,
      toquesUltimoTercio: num(g(f, "TchsA3")) ?? 0,
      pases: num(g(f, "PsAtt")) ?? 0,
      posesion: num(g(f, "Poss%")),
      recuperaciones: num(g(f, "Recovery")) ?? 0,
      recuperacionesArriba: num(g(f, "PosWonA3rd")) ?? 0,
      perdidas: num(g(f, "PossLost")) ?? 0,
    };
    const ya = e.tramos.get(tramo);
    if (ya) {
      /* La posesión, media pesada por los pases de cada trozo. */
      const pp = ya.pases + nuevo.pases;
      const pos =
        ya.posesion == null ? nuevo.posesion : nuevo.posesion == null ? ya.posesion : pp > 0 ? (ya.posesion * ya.pases + nuevo.posesion * nuevo.pases) / pp : (ya.posesion + nuevo.posesion) / 2;
      e.tramos.set(tramo, {
        tramo,
        xG: ya.xG + nuevo.xG,
        remates: ya.remates + nuevo.remates,
        toquesArea: ya.toquesArea + nuevo.toquesArea,
        toquesUltimoTercio: ya.toquesUltimoTercio + nuevo.toquesUltimoTercio,
        pases: pp,
        posesion: pos,
        recuperaciones: ya.recuperaciones + nuevo.recuperaciones,
        recuperacionesArriba: ya.recuperacionesArriba + nuevo.recuperacionesArriba,
        perdidas: ya.perdidas + nuevo.perdidas,
      });
    } else e.tramos.set(tramo, nuevo);
  }
  cacheMomento.set(t, salida);
  return salida;
}

export type MedidaMomento = "mezcla" | "xG" | "toques";

/**
 * La curva de dominio: un valor por tramo de 5′, positivo cuando domina `a`
 * y negativo cuando domina `b`, entre −1 y 1.
 *
 * Cada tramo es la diferencia de los dos, en una escala que no se sale con
 * un remate de 0,7: xG / (xG + 0,3) y toques / (toques + 3), una
 * saturación suave. «Mezcla» es la media de los dos (el xG manda en las
 * ocasiones; los toques en área dicen quién vive cerca de la portería). Se
 * suaviza con los vecinos (¼ · ½ · ¼) para que se lea la tendencia y no el
 * ruido de cada tramo.
 */
export function curvaMomento(p: MomentoPartido, a: string, medida: MedidaMomento): { tramo: number; valor: number; bruto: number }[] {
  const ea = p.equipos.find((e) => e.teamId === a);
  const eb = p.equipos.find((e) => e.teamId !== a);
  if (!ea || !eb) return [];
  const ultimo = Math.max(...ea.tramos.keys(), ...eb.tramos.keys(), 17);
  const satura = (v: number, k: number) => v / (v + k);
  const crudo: number[] = [];
  for (let i = 0; i <= ultimo; i++) {
    const ta = ea.tramos.get(i);
    const tb = eb.tramos.get(i);
    const dx = satura(ta?.xG ?? 0, 0.3) - satura(tb?.xG ?? 0, 0.3);
    const dt = satura(ta?.toquesArea ?? 0, 3) - satura(tb?.toquesArea ?? 0, 3);
    crudo.push(medida === "xG" ? dx : medida === "toques" ? dt : (dx + dt) / 2);
  }
  return crudo.map((v, i) => {
    const antes = crudo[i - 1] ?? v;
    const despues = crudo[i + 1] ?? v;
    return { tramo: i, valor: antes * 0.25 + v * 0.5 + despues * 0.25, bruto: v };
  });
}

/* ------------------------------------------------------------------ */
/*  Castilla evento a evento                                           */
/* ------------------------------------------------------------------ */

export type AccionCastilla = {
  partido: string;
  fecha: string;
  rival: string;
  parte: number;
  minuto: number;
  tipo: string;
  secuencia: number | null;
  posesion: number | null;
  /** true = del Castilla; false = del rival. */
  nuestra: boolean;
  jugador: string;
  jugadorId: string;
  receptor: string;
  x: number;
  y: number;
  finX: number | null;
  finY: number | null;
  /** Pase completado / acción con éxito. */
  ok: boolean;
  ocasion: boolean;
  xA: number;
  xPV: number;
  marcador: Marcador;
};

const cacheCastilla = new WeakMap<TablaOpta, AccionCastilla[]>();

/** `nuestros` = ids de los jugadores del Castilla (de `opta:castilla` y `opta:castilla-partidos`). */
export function accionesCastilla(t: TablaOpta | null, nuestros: Set<string>): AccionCastilla[] {
  if (!t) return [];
  const hecho = cacheCastilla.get(t);
  if (hecho) return hecho;
  const c = idx(t);
  const g = (f: Celda[], col: string) => f[c(col)];

  /* Cada posesión, de quién es: la mayoría de sus acciones con jugador. */
  const dePosesion = new Map<string, number>();
  for (const f of t.filas) {
    const id = str(g(f, "jugadorId"));
    if (!id) continue;
    const k = `${str(g(f, "partido"))}|${str(g(f, "parte"))}|${str(g(f, "posesion"))}`;
    dePosesion.set(k, (dePosesion.get(k) ?? 0) + (nuestros.has(id) ? 1 : -1));
  }

  const filas = t.filas;
  const salida: AccionCastilla[] = filas.map((f, i): AccionCastilla => {
    const id = str(g(f, "jugadorId"));
    let nuestra: boolean;
    if (id) nuestra = nuestros.has(id);
    else {
      const k = `${str(g(f, "partido"))}|${str(g(f, "parte"))}|${str(g(f, "posesion"))}`;
      const v = dePosesion.get(k) ?? 0;
      if (v !== 0) nuestra = v > 0;
      else {
        nuestra = false;
        for (let j = i + 1; j < filas.length && j < i + 10; j++) {
          if (str(g(filas[j], "partido")) !== str(g(f, "partido"))) break;
          const otro = str(g(filas[j], "jugadorId"));
          if (otro) {
            nuestra = nuestros.has(otro);
            break;
          }
        }
      }
    }
    const fx = num(g(f, "PassEndX|EVENT"));
    const fy = num(g(f, "PassEndY|EVENT"));
    return {
      partido: str(g(f, "partido")),
      fecha: str(g(f, "fecha")),
      rival: str(g(f, "rival")),
      parte: num(g(f, "parte")) ?? 1,
      minuto: minutoDe(num(g(f, "segundo")) ?? 0),
      tipo: str(g(f, "tipo")),
      secuencia: num(g(f, "secuencia")),
      posesion: num(g(f, "posesion")),
      nuestra,
      jugador: corrigeNombre(str(g(f, "jugador"))),
      jugadorId: id,
      receptor: corrigeNombre(str(g(f, "receptor"))),
      x: num(g(f, "EventX|EVENT")) ?? 0,
      y: num(g(f, "EventY|EVENT")) ?? 0,
      finX: fx,
      finY: fy,
      ok: str(g(f, "PsCompleted|EVENT")) === "Yes",
      ocasion: str(g(f, "Chance|EVENT")) === "Yes",
      xA: num(g(f, "xA|EVENT")) ?? 0,
      xPV: num(g(f, "xPVAdded|EVENT")) ?? 0,
      marcador: str(g(f, "MatchState|EVENT")) as Marcador,
    };
  });
  cacheCastilla.set(t, salida);
  return salida;
}

/** Lo que miran las reglas de abajo (14/11/2026: también las usa el directo). */
export type AccionMinima = Pick<AccionCastilla, "tipo" | "x" | "y" | "finX" | "finY" | "ok">;

export const esPase = (a: AccionMinima) => a.tipo === "Pass" && a.finX != null && a.finY != null;

/* La portería rival, en metros (105 × 68): el centro de la línea de gol. */
const distGol = (x: number, y: number) => Math.hypot(((100 - x) * 105) / 100, ((50 - y) * 68) / 100);

/**
 * Pase progresivo: completado, que acerca el balón a la portería rival al
 * menos un 25 % de lo que le faltaba y no nace en el primer 40 % del campo
 * para quedarse en campo propio (los despejes en largo hacia nadie no
 * cuentan).
 */
export function esProgresivo(a: AccionMinima): boolean {
  if (!esPase(a) || !a.ok) return false;
  const antes = distGol(a.x, a.y);
  const despues = distGol(a.finX!, a.finY!);
  if (despues > antes * 0.75) return false;
  return !(a.x < 40 && a.finX! < 50);
}

/** Pase al último tercio: completado, que entra en el último tercio desde fuera de él. */
export const esAlUltimoTercio = (a: AccionMinima) => esPase(a) && a.ok && a.x < 66.7 && a.finX! >= 66.7;

/** Recuperación: robo, intercepción o entrada ganada. */
export const esRecuperacion = (a: AccionMinima) =>
  a.tipo === "BallRecovery" || a.tipo === "Interception" || (a.tipo === "Tackle" && a.ok);

/**
 * Pérdida: pase fallado, regate perdido o robado en conducción.
 * 10/11/2026: sin el «Error» de Opta. Es un evento aparte que marca la acción
 * que acaba en remate o gol del rival: viene sin jugador (el registro lo
 * atribuye por la posesión y a veces cae del lado que no es) y, cuando es
 * nuestro, va pegado a la acción fallada, que ya cuenta: era contar doble.
 */
export const esPerdida = (a: AccionMinima) =>
  (a.tipo === "Pass" && !a.ok) || a.tipo === "Dispossessed" || (a.tipo === "TakeOn" && !a.ok);

export type Altura3 = "alta" | "media" | "baja";
/**
 * Altura de la acción, en tres tercios iguales (los de Opta: PosWonA3rd,
 * PsLostA3…): último tercio (presión alta), tercio medio o primer tercio
 * (bloque bajo). 10/11/2026: antes «alta» era x ≥ 60 y se llamaba «campo
 * rival», que empieza en 50: ni una cosa ni otra.
 */
export const alturaAccion = (x: number): Altura3 => (x >= 66.7 ? "alta" : x >= 33.3 ? "media" : "baja");

export type NodoRed = { jugador: string; x: number; y: number; pases: number };
export type EnlaceRed = { a: string; b: string; n: number };

/**
 * La red de pases: cada jugador en la posición media de sus pases y de los
 * balones que recibe; cada enlace, los pases completados entre dos (en los
 * dos sentidos).
 */
export function redDePases(acciones: AccionCastilla[]): { nodos: NodoRed[]; enlaces: EnlaceRed[] } {
  const sitio = new Map<string, { sx: number; sy: number; n: number; pases: number }>();
  const suma = (j: string, x: number, y: number, pase: boolean) => {
    if (!j) return;
    const s = sitio.get(j) ?? { sx: 0, sy: 0, n: 0, pases: 0 };
    s.sx += x;
    s.sy += y;
    s.n++;
    if (pase) s.pases++;
    sitio.set(j, s);
  };
  const enlaces = new Map<string, EnlaceRed>();
  for (const a of acciones) {
    if (!a.nuestra || !esPase(a)) continue;
    suma(a.jugador, a.x, a.y, true);
    if (!a.ok || !a.receptor || a.receptor === a.jugador) continue;
    suma(a.receptor, a.finX!, a.finY!, false);
    const [p, q] = [a.jugador, a.receptor].sort((m, n) => m.localeCompare(n));
    const k = `${p}|${q}`;
    const e = enlaces.get(k) ?? { a: p, b: q, n: 0 };
    e.n++;
    enlaces.set(k, e);
  }
  const nodos = [...sitio.entries()].map(([jugador, s]) => ({ jugador, x: s.sx / s.n, y: s.sy / s.n, pases: s.pases }));
  return { nodos, enlaces: [...enlaces.values()] };
}

export const esCastilla = (teamId: string) => teamId === CASTILLA_OPTA;

/* ------------------------------------------------------------------ */
/*  Equipos por nombre (BeSoccer → Opta)                               */
/* ------------------------------------------------------------------ */

const limpia = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\b(cf|cd|ud|sd|fc|rc|club|de|real|ad|cp|sad|b|ii)\b/g, " ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/* Los que no se parecen por el nombre (BeSoccer → Opta). */
const ALIAS: [RegExp, string][] = [
  [/atl[eé]tico.*(madrid|madrile)/i, "Atlético Madrileño"],
  [/fabril|deportivo.*(b|ii)$/i, "Deportivo de A Coruña II"],
  [/castilla|real madrid/i, "Real Madrid II"],
];

/** El equipo de Opta que mejor casa con un nombre de otra fuente (o null). */
export function casaEquipo(nombre: string, equipos: { teamId: string; equipo: string }[]): string | null {
  for (const [re, suyo] of ALIAS) if (re.test(nombre)) return equipos.find((e) => e.equipo === suyo)?.teamId ?? null;
  const n = limpia(nombre);
  if (!n) return null;
  const palabras = new Set(n.split(" "));
  let mejor: { id: string; p: number } | null = null;
  for (const e of equipos) {
    const m = limpia(e.equipo);
    if (!m) continue;
    if (m === n) return e.teamId;
    const comunes = m.split(" ").filter((w) => palabras.has(w) && w.length > 2).length;
    const p = comunes / Math.max(palabras.size, m.split(" ").length);
    if (comunes && (!mejor || p > mejor.p)) mejor = { id: e.teamId, p };
  }
  return mejor && mejor.p >= 0.5 ? mejor.id : null;
}
