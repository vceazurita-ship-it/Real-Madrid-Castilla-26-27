/**
 * LA SALA DE PARTIDO (24/11/2026): el partido reconstruido minuto a minuto.
 *
 * Petición del analista: mejorar el directo «aprovechando toda la info que
 * tenemos prepartido y la que nos da Opta… muy muy visual, moderno,
 * tecnológico, top e impactante», y probarlo con el primer equipo.
 *
 * Todo sale del documento de un partido que escribe scripts/opta-directo.mjs
 * (`opta:directo:<id>` del Castilla y su categoría, `opta:rm:<id>` del primer
 * equipo): el evento a evento (x, y de 0 a 100 hacia la portería contraria de
 * quien la hace, xG, xPV), las fichas de jugador, las cifras de Opta y, desde
 * hoy, la `previa` (la media por partido de cada equipo en su competición, sin
 * ese partido). Como todo se cuenta desde los eventos, el mismo cálculo vale
 * para el directo (hasta el último evento) y para la repetición (hasta el
 * minuto que se elija).
 *
 * Cuentas puras, sin React.
 */

export type Celda = string | number | boolean | null;
export type Tabla = { cols: string[]; filas: Celda[][] };

export type DocPartido = {
  partido: string;
  fecha?: string;
  estado?: string;
  actualizado?: string;
  liga?: string;
  equipos?: Tabla;
  eventos?: Tabla;
  jugadores?: Tabla;
  /** Cambios y tarjetas: partido, teamId, parte, segundo, tipo, jugadorId, entraId. */
  marcas?: Tabla;
  previa?: Record<string, { pj: number; medias: Record<string, number> }> | null;
};

export type Lado = "L" | "V";

export type Equipo = {
  teamId: string;
  nombre: string;
  color: string;
  /** Las cifras oficiales de Opta del partido (las del final o las de la última lectura). */
  opta: Record<string, number | null>;
  previa: { pj: number; medias: Record<string, number> } | null;
};

export type Ev = {
  lado: Lado;
  parte: number;
  /** Minuto con decimales (el reloj de Opta va en segundos desde el inicio). */
  min: number;
  tipo: string;
  jugador: string;
  receptor: string;
  x: number;
  y: number;
  fx: number | null;
  fy: number | null;
  ok: boolean;
  xG: number | null;
  xPV: number;
  saque: string;
  /** Remate bloqueado (q82). null si el documento es anterior a esa columna. */
  bloqueado: boolean | null;
  /** De qué jugada viene el remate: «corner», «falta», «penalti», «abp» o «» (jugada). Vacío también en documentos viejos. */
  jugada: string;
};

/** Cambios y tarjetas (desde el 26/11/2026; los documentos viejos no los traen). */
export type Marca = { lado: Lado; parte: number; min: number; tipo: "cambio" | "amarilla" | "roja"; jugador: string; entra?: string };

export type Jugador = { id: string; nombre: string; corto: string; lado: Lado; dorsal: string; puesto: string; minutos: number; titular: boolean };

export type Partido = {
  id: string;
  fecha: string;
  liga: string;
  estado: string;
  actualizado: string;
  /** true si Opta lo da por acabado. */
  acabado: boolean;
  local: Equipo;
  visitante: Equipo;
  eventos: Ev[];
  marcas: Marca[];
  jugadores: Map<string, Jugador>;
  /** El último minuto con eventos (hasta donde llega lo leído). */
  ultimo: number;
  /** El equipo «nuestro» (Castilla o Real Madrid) si juega. */
  nuestro: Lado | null;
};

/*
| Revisión del 26/11/2026 (expertos de análisis y fútbol), cotejado con las
| cifras oficiales de Opta del Castilla-Murcia del 20/11:
| - Remates: Goal + AttemptSaved + Miss + Post = ShtIncBl exacto (12 y 6). No
|   hay «SavedShot» en el evento a evento (la parada es «Save», del portero).
| - A puerta: AttemptSaved incluye los bloqueados (5 frente a 3 oficiales). Con
|   la columna `bloqueado` (q82, desde hoy en scripts/opta-directo.mjs) se
|   descuentan; sin ella, se ajusta a la cifra oficial (`calibracion`).
| - PPDA: ninguna suma de acciones defensivas del evento a evento da la de Opta
|   (32,4 / 17,6 frente a 18,6 / 12,2). Se ajusta a la oficial del partido (la
|   de la última lectura) y, sin ella, no se enseña ni hay aviso.
| - Recuperaciones altas y centros salen ×2: no se enseñan.
*/
const TIROS = new Set(["Goal", "AttemptSaved", "Miss", "Post"]);
/**
 * Goles en propia puerta (26/11/2026, «el resultado de los partidos que sea
 * correcto»): Opta los da como «OwnGoal» del que la mete (equipo contrario) y
 * los penaltis marcados como «PenaltyGoal», no como «Goal». Antes la sala no
 * contaba ninguno de los dos: Castilla-Antequera salía 3-1 (fue 3-2), con el
 * Atlético Madrileño 2-2 (3-2) y con el Alcorcón 0-2 (1-2). Al leer, el penalti
 * pasa a «Goal» (de penalti) y la propia puerta a «GolPropia», del equipo que
 * se beneficia: cuenta en el marcador, pero no como remate ni xG de nadie.
 */
const esGol = (e: { tipo: string }) => e.tipo === "Goal" || e.tipo === "GolPropia";
const PENALTI_FALLADO: Record<string, string> = { PenaltySaved: "AttemptSaved", PenaltyMiss: "Miss", PenaltyMissed: "Miss", PenaltyPost: "Post" };
const A_PUERTA = new Set(["Goal", "AttemptSaved"]);
const DEFENSIVAS = new Set(["Tackle", "Interception", "Challenge", "AttemptedTackle"]);
const RECUPERA = new Set(["BallRecovery", "Interception", "Tackle"]);
/** Pérdidas de balón: pase fallado (no de saque) o desposeído. */
const esPerdida = (e: Ev) => (e.tipo === "Pass" && !e.saque && !e.ok) || e.tipo === "Dispossessed";
/** El partido está acabado (la misma regla en la lista y en la sala). */
export const esAcabado = (estado: string) => /played|full|finished/i.test(estado);

export const NUESTROS = ["Real Madrid II", "Real Madrid"];

const num = (v: Celda | undefined): number | null => (typeof v === "number" && Number.isFinite(v) ? v : v == null || v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null);

/** «Trent Alexander-Arnold» → «Alexander-Arnold»; «Vinícius José …» → «Vinícius». */
export function nombreCorto(n: string) {
  const partes = n.trim().split(/\s+/);
  if (partes.length <= 1) return n;
  if (partes.length >= 4) return partes[0];
  return partes.slice(1).join(" ");
}

/** Dos colores que se distingan sobre el fondo oscuro: si los de Opta se parecen, el visitante cambia. */
function colores(a: string, b: string): [string, string] {
  const rgb = (h: string) => {
    const m = /^#?([0-9a-f]{6})$/i.exec(h.trim());
    if (!m) return null;
    const n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const luz = (c: number[]) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  const vivo = (h: string, porDefecto: string) => {
    const c = rgb(h);
    /* Muy oscuro (negros, granates) o muy blanco: no se ve como luz sobre el fondo. */
    if (!c || luz(c) < 60) return porDefecto;
    return h;
  };
  const ca = vivo(a, "#3D8BFF");
  let cb = vivo(b, "#FF5C7A");
  const x = rgb(ca)!, y = rgb(cb)!;
  const d = Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
  if (d < 120) cb = luz(x) > 150 ? "#FF5C7A" : "#F2C94C";
  return [ca, cb];
}

export function partidoDe(doc: DocPartido): Partido | null {
  const eq = doc.equipos;
  if (!eq?.filas?.length) return null;
  const c = (n: string) => eq.cols.indexOf(n);
  const filas = [...eq.filas].sort((a, b) => Number(String(b[c("campo")]).toUpperCase() === "HOME") - Number(String(a[c("campo")]).toUpperCase() === "HOME"));
  if (filas.length < 2) return null;
  const [ca, cb] = colores(String(filas[0][c("color")] ?? ""), String(filas[1][c("color")] ?? ""));
  const equipo = (f: Celda[], color: string): Equipo => {
    const teamId = String(f[c("teamId")]);
    const opta: Record<string, number | null> = {};
    for (const col of eq.cols) if (!["partido", "teamId", "equipo", "color", "campo"].includes(col)) opta[col] = num(f[c(col)]);
    const nombre = String(f[c("equipo")] ?? "");
    return { teamId, nombre: nombre === "Real Madrid II" ? "Real Madrid Castilla" : nombre, color, opta, previa: doc.previa?.[teamId] ?? null };
  };
  const local = equipo(filas[0], ca);
  const visitante = equipo(filas[1], cb);
  const ladoDe = (teamId: Celda) => (String(teamId) === local.teamId ? "L" : String(teamId) === visitante.teamId ? "V" : null);

  const jugadores = new Map<string, Jugador>();
  const jt = doc.jugadores;
  if (jt?.filas) {
    const j = (n: string) => jt.cols.indexOf(n);
    for (const f of jt.filas) {
      const lado = ladoDe(f[j("teamId")]);
      if (!lado) continue;
      const nombre = String(f[j("jugador")] ?? "");
      jugadores.set(String(f[j("playerId")]), {
        id: String(f[j("playerId")]),
        nombre,
        corto: nombreCorto(nombre),
        lado,
        dorsal: f[j("dorsal")] == null ? "" : String(f[j("dorsal")]),
        puesto: String(f[j("puesto")] ?? ""),
        minutos: num(f[j("Min")]) ?? 0,
        titular: num(f[j("GS")]) === 1,
      });
    }
  }

  const eventos: Ev[] = [];
  const et = doc.eventos;
  if (et?.filas) {
    const e = (n: string) => et.cols.indexOf(n);
    for (const f of et.filas) {
      const ladoOpta = ladoDe(f[e("teamId")]);
      const xo = num(f[e("x")]), yo = num(f[e("y")]);
      if (!ladoOpta || xo == null || yo == null) continue;
      const bruto = String(f[e("tipo")] ?? "");
      const propia = bruto === "OwnGoal";
      const penalti = bruto === "PenaltyGoal" || bruto in PENALTI_FALLADO;
      /* La propia puerta, del que se beneficia y vista desde su ataque. */
      const lado: Lado = propia ? (ladoOpta === "L" ? "V" : "L") : ladoOpta;
      const x = propia ? 100 - xo : xo, y = propia ? 100 - yo : yo;
      eventos.push({
        lado,
        parte: num(f[e("parte")]) ?? 1,
        min: (num(f[e("segundo")]) ?? 0) / 60,
        tipo: propia ? "GolPropia" : bruto === "PenaltyGoal" ? "Goal" : (PENALTI_FALLADO[bruto] ?? bruto),
        jugador: String(f[e("jugadorId")] ?? ""),
        receptor: String(f[e("receptorId")] ?? ""),
        x,
        y,
        fx: num(f[e("finX")]),
        fy: num(f[e("finY")]),
        ok: num(f[e("ok")]) === 1,
        xG: num(f[e("xG")]),
        xPV: num(f[e("xPV")]) ?? 0,
        saque: String(f[e("saque")] ?? ""),
        bloqueado: e("bloqueado") < 0 ? null : num(f[e("bloqueado")]) === 1,
        jugada: penalti ? "penalti" : e("jugada") < 0 ? "" : String(f[e("jugada")] ?? ""),
        ...(propia ? { xG: null, xPV: 0 } : {}),
      });
    }
    eventos.sort((a, b) => a.min - b.min);
  }

  const marcas: Marca[] = [];
  const mt = doc.marcas;
  if (mt?.filas) {
    const m = (n: string) => mt.cols.indexOf(n);
    for (const f of mt.filas) {
      const lado = ladoDe(f[m("teamId")]);
      const tipo = String(f[m("tipo")] ?? "");
      if (!lado || !["cambio", "amarilla", "roja"].includes(tipo)) continue;
      marcas.push({ lado, parte: num(f[m("parte")]) ?? 1, min: (num(f[m("segundo")]) ?? 0) / 60, tipo: tipo as Marca["tipo"], jugador: String(f[m("jugadorId")] ?? ""), entra: f[m("entraId")] ? String(f[m("entraId")]) : undefined });
    }
    marcas.sort((a, b) => a.min - b.min);
  }

  const nuestro: Lado | null = NUESTROS.includes(String(filas[0][c("equipo")])) ? "L" : NUESTROS.includes(String(filas[1][c("equipo")])) ? "V" : null;
  const estado = String(doc.estado ?? "");

  return {
    id: doc.partido,
    fecha: String(doc.fecha ?? ""),
    liga: String(doc.liga ?? ""),
    estado,
    actualizado: String(doc.actualizado ?? ""),
    acabado: esAcabado(estado),
    local,
    visitante,
    eventos,
    marcas,
    jugadores,
    ultimo: eventos.length ? Math.ceil(eventos[eventos.length - 1].min) : 0,
    nuestro,
  };
}

/* ------------------------------------------------------------------ */
/*  EL PARTIDO EN EL MINUTO t                                          */
/* ------------------------------------------------------------------ */

export type Cifras = {
  goles: number;
  xg: number;
  tiros: number;
  aPuerta: number;
  pases: number;
  pasesOk: number;
  toquesArea: number;
  recAltas: number;
  perdidas: number;
  centros: number;
  corners: number;
  defensivas: number;
  /** Pases del rival en su 60 % de campo (para el PPDA). */
  pasesRivalSuCampo: number;
  /** Amenaza: xPV positivo de las acciones que no son remate más el xG de los remates (sin contarlo dos veces). */
  amenaza: number;
  /** Pases buenos que entran en el área rival desde fuera. */
  entradasArea: number;
  /** Pases en el último tercio (para el dominio territorial, «field tilt»). */
  pasesTercio: number;
  /** Remates y xG que vienen de balón parado (córner, falta, penalti). */
  tirosAbp: number;
  xgAbp: number;
  bloqueados: number;
};

export type Tiro = { lado: Lado; parte: number; min: number; x: number; y: number; xG: number; gol: boolean; aPuerta: boolean; bloqueado: boolean; jugador: string; tipo: string; jugada: string };

const vacias = (): Cifras => ({ goles: 0, xg: 0, tiros: 0, aPuerta: 0, pases: 0, pasesOk: 0, toquesArea: 0, recAltas: 0, perdidas: 0, centros: 0, corners: 0, defensivas: 0, pasesRivalSuCampo: 0, amenaza: 0, entradasArea: 0, pasesTercio: 0, tirosAbp: 0, xgAbp: 0, bloqueados: 0 });

export const enArea = (x: number, y: number) => x >= 83 && y >= 21 && y <= 79;

/**
 * La jugada de cada remate: la que trae Opta (columna `jugada`) o, en los
 * documentos viejos, por cercanía: un remate del mismo equipo hasta 10 s
 * después de su córner o de una falta suya en campo rival (x ≥ 55).
 */
function jugadasDe(p: Partido) {
  const cache = jugadasCache.get(p);
  if (cache) return cache;
  const salida = new Map<Ev, string>();
  let ultima: { lado: Lado; min: number; tipo: string } | null = null;
  for (const e of p.eventos) {
    /* «Corner» viene para los dos equipos (a favor y en contra): el suyo es el de su lado de ataque (x ≥ 50). */
    if (e.tipo === "Corner" && e.x >= 50) ultima = { lado: e.lado, min: e.min, tipo: "corner" };
    else if (e.tipo === "FreeKick" && e.x >= 55) ultima = { lado: e.lado, min: e.min, tipo: "falta" };
    if (!TIROS.has(e.tipo)) continue;
    if (e.jugada) salida.set(e, e.jugada);
    else if (ultima && ultima.lado === e.lado && e.min - ultima.min <= 10 / 60) salida.set(e, ultima.tipo);
    else salida.set(e, "");
  }
  jugadasCache.set(p, salida);
  return salida;
}
const jugadasCache = new WeakMap<Partido, Map<Ev, string>>();
export const esAbp = (jugada: string) => ["corner", "falta", "penalti", "abp"].includes(jugada);

/** Las cifras de cada equipo entre dos minutos (por defecto, desde el inicio). */
export function cifrasEntre(p: Partido, desde: number, hasta: number, parte?: number) {
  const L = vacias(), V = vacias();
  const tiros: Tiro[] = [];
  const jugadas = jugadasDe(p);
  for (const e of p.eventos) {
    if (e.min > hasta) break;
    if (e.min < desde || (parte && e.parte !== parte)) continue;
    const yo = e.lado === "L" ? L : V;
    const el = e.lado === "L" ? V : L;
    if (TIROS.has(e.tipo)) {
      const bloqueado = e.bloqueado === true;
      const aPuerta = A_PUERTA.has(e.tipo) && !bloqueado;
      const jugada = jugadas.get(e) ?? "";
      yo.tiros++;
      if (aPuerta) yo.aPuerta++;
      if (bloqueado) yo.bloqueados++;
      if (e.tipo === "Goal") yo.goles++;
      yo.xg += e.xG ?? 0;
      yo.amenaza += e.xG ?? 0;
      if (esAbp(jugada)) {
        yo.tirosAbp++;
        yo.xgAbp += e.xG ?? 0;
      }
      tiros.push({ lado: e.lado, parte: e.parte, min: e.min, x: e.x, y: e.y, xG: e.xG ?? 0.03, gol: e.tipo === "Goal", aPuerta, bloqueado, jugador: e.jugador, tipo: e.tipo, jugada });
    } else if (e.tipo === "GolPropia") yo.goles++;
    else if (e.xPV > 0) yo.amenaza += e.xPV;
    if (e.tipo === "Pass" && !e.saque) {
      yo.pases++;
      if (e.ok) yo.pasesOk++;
      if (e.x < 60) el.pasesRivalSuCampo++;
      if (e.x >= 66.7) yo.pasesTercio++;
      if (e.ok && !enArea(e.x, e.y) && e.fx != null && e.fy != null && enArea(e.fx, e.fy)) yo.entradasArea++;
      if (e.x >= 66 && (e.y < 21 || e.y > 79) && e.fx != null && e.fy != null && enArea(e.fx, e.fy)) yo.centros++;
    }
    if (esPerdida(e)) yo.perdidas++;
    /* Córner a favor: el del lado de ataque (Opta lo da a los dos; el Castilla-Murcia, 1 y 2 como la oficial). */
    if (e.tipo === "Corner" && e.x >= 50) yo.corners++;
    if (enArea(e.x, e.y) && e.tipo !== "Corner") yo.toquesArea++;
    if (RECUPERA.has(e.tipo) && e.x >= 66.7) yo.recAltas++;
    if (DEFENSIVAS.has(e.tipo) && e.x >= 40) yo.defensivas++;
  }
  return { L, V, tiros };
}

export const cifrasHasta = (p: Partido, t: number) => cifrasEntre(p, 0, t);

export const posesion = (c: { L: Cifras; V: Cifras }) => {
  const t = c.L.pases + c.V.pases;
  return t ? { L: c.L.pases / t, V: c.V.pases / t } : { L: 0.5, V: 0.5 };
};

/** Dominio territorial: de los pases en el último tercio, qué parte es de cada uno. */
export const dominio = (c: { L: Cifras; V: Cifras }) => {
  const t = c.L.pasesTercio + c.V.pasesTercio;
  return t ? { L: c.L.pasesTercio / t, V: c.V.pasesTercio / t } : null;
};

const ppdaCrudo = (yo: Cifras) => (yo.defensivas ? yo.pasesRivalSuCampo / yo.defensivas : null);

/**
 * El ajuste a las cifras oficiales de Opta de este partido (las de la última
 * lectura): cuánto hay que multiplicar lo contado desde los eventos para que,
 * al último minuto leído, dé lo que dice Opta. Sólo PPDA y, en documentos sin
 * la columna de bloqueados, los remates a puerta.
 */
export function calibracion(p: Partido) {
  const c = cifrasEntre(p, 0, p.ultimo + 1);
  const factor = (oficial: number | null | undefined, crudo: number | null) => (oficial != null && crudo ? oficial / crudo : null);
  const conBloqueo = p.eventos.some((e) => e.bloqueado != null);
  return {
    ppda: { L: factor(p.local.opta.PPDA, ppdaCrudo(c.L)), V: factor(p.visitante.opta.PPDA, ppdaCrudo(c.V)) },
    aPuerta: conBloqueo ? null : { L: factor(p.local.opta.SOG, c.L.aPuerta), V: factor(p.visitante.opta.SOG, c.V.aPuerta) },
  };
}
export type Calibracion = ReturnType<typeof calibracion>;

/** PPDA ajustado a la cifra oficial; sin ella (o con poca muestra), null: no se enseña. */
export const ppda = (yo: Cifras, k: number | null | undefined) => {
  const crudo = ppdaCrudo(yo);
  return crudo != null && k && yo.defensivas >= 4 ? crudo * k : null;
};

/** Remates a puerta: con bloqueados en el documento, tal cual; si no, ajustado a la cifra oficial. */
export const aPuertaDe = (yo: Cifras, k: number | null | undefined) => (k ? Math.round(yo.aPuerta * k) : yo.aPuerta);

/* ------------------------------------------------------------------ */
/*  PULSO: QUIÉN MANDA EN CADA TRAMO                                   */
/* ------------------------------------------------------------------ */

export type TramoPulso = { desde: number; L: number; V: number };

/** La amenaza (xPV positivo + xG de los remates) de cada equipo por tramos de `ancho` minutos. */
export function pulso(p: Partido, t: number, ancho = 3): TramoPulso[] {
  const fin = Math.max(ancho, Math.ceil(Math.max(t, 1) / ancho) * ancho);
  const tramos: TramoPulso[] = [];
  for (let d = 0; d < fin; d += ancho) tramos.push({ desde: d, L: 0, V: 0 });
  for (const e of p.eventos) {
    if (e.min > t) break;
    const k = Math.min(tramos.length - 1, Math.floor(e.min / ancho));
    /* Remate: su xG; el resto, su xPV positivo (el xPV del remate ya va en su xG: no se cuenta dos veces). */
    const v = TIROS.has(e.tipo) ? (e.xG ?? 0) : e.xPV > 0 ? e.xPV : 0;
    tramos[k][e.lado] += v;
  }
  /* Suavizado sólo hacia atrás (26/11/2026): en la repetición, el tramo siguiente es el futuro. El último, a medias, se escala a tramo entero. */
  return tramos.map((x, i) => {
    const a = tramos[i - 1];
    const lleno = i === tramos.length - 1 ? Math.max(0.34, Math.min(1, (t - x.desde) / ancho)) : 1;
    const m = (k: Lado) => ((x[k] / lleno) * 2 + (a?.[k] ?? x[k] / lleno)) / 3;
    return { desde: x.desde, L: m("L"), V: m("V") };
  });
}

/** xG acumulado minuto a minuto (para las dos curvas). */
export function curvaXg(p: Partido, t: number) {
  const puntos: { min: number; L: number; V: number }[] = [{ min: 0, L: 0, V: 0 }];
  let L = 0, V = 0;
  for (const e of p.eventos) {
    if (e.min > t) break;
    if (!TIROS.has(e.tipo) || !e.xG) continue;
    puntos.push({ min: e.min, L, V });
    if (e.lado === "L") L += e.xG;
    else V += e.xG;
    puntos.push({ min: e.min, L, V });
  }
  puntos.push({ min: t, L, V });
  return puntos;
}

/* ------------------------------------------------------------------ */
/*  PROBABILIDAD EN VIVO                                               */
/* ------------------------------------------------------------------ */

const poisson = (l: number, k: number) => {
  let r = Math.exp(-l);
  for (let i = 1; i <= k; i++) r *= l / i;
  return r;
};

/** Minutos de partido con el añadido medio. */
export const DURACION = 94;
/** Cuánto pesa la previa: como si fueran estos minutos de partido ya jugados. */
const PESO_PREVIA = 30;
/** xG por partido de un equipo del que no hay previa. */
const XG_SIN_PREVIA = 1.25;

/**
 * Probabilidad de que gane el local, empate o gane el visitante en el minuto
 * m: goles que faltan ~ Poisson con el ritmo de xG de cada uno, mezcla de su
 * previa (su xG por partido en la competición) y de lo que lleva hoy.
 */
export function probabilidad(p: Partido, m: number, golesL: number, golesV: number, xgL: number, xgV: number) {
  const ritmo = (previa: number | undefined, xg: number) => ((previa ?? XG_SIN_PREVIA) * PESO_PREVIA + xg * 90) / (PESO_PREVIA + m);
  /* Revisión 24/11/2026: acabado y en su último minuto, ya no queda nada (antes el final no cerraba al 100 %). */
  const queda = p.acabado && m >= p.ultimo ? 0 : Math.max(0, DURACION - m) / 90;
  const lL = ritmo(p.local.previa?.medias.ExpG, xgL) * queda;
  const lV = ritmo(p.visitante.previa?.medias.ExpG, xgV) * queda;
  let gana = 0, empata = 0, pierde = 0;
  for (let a = 0; a <= 8; a++) {
    const pa = poisson(lL, a);
    for (let b = 0; b <= 8; b++) {
      const pr = pa * poisson(lV, b);
      const fa = golesL + a, fb = golesV + b;
      if (fa > fb) gana += pr;
      else if (fa === fb) empata += pr;
      else pierde += pr;
    }
  }
  const s = gana + empata + pierde || 1;
  return { L: gana / s, X: empata / s, V: pierde / s };
}

export function curvaProbabilidad(p: Partido, t: number, paso = 1) {
  const salida: { min: number; L: number; X: number; V: number }[] = [];
  let i = 0, gL = 0, gV = 0, xL = 0, xV = 0;
  for (let m = 0; m <= Math.max(0, t) + 1e-9; m += paso) {
    while (i < p.eventos.length && p.eventos[i].min <= m) {
      const e = p.eventos[i++];
      if (TIROS.has(e.tipo)) {
        if (e.lado === "L") xL += e.xG ?? 0;
        else xV += e.xG ?? 0;
        if (e.tipo === "Goal" && e.lado === "L") gL++;
        else if (e.tipo === "Goal") gV++;
      } else if (e.tipo === "GolPropia") {
        if (e.lado === "L") gL++;
        else gV++;
      }
    }
    salida.push({ min: m, ...probabilidad(p, m, gL, gV, xL, xV) });
  }
  /* El último punto en t exacto (26/11/2026): la curva, las tarjetas y la barra del marcador dicen lo mismo. */
  if (!salida.length || salida[salida.length - 1].min < t) {
    const c = cifrasHasta(p, t);
    salida.push({ min: t, ...probabilidad(p, t, c.L.goles, c.V.goles, c.L.xg, c.V.xg) });
  }
  return salida;
}

/**
 * EL RESULTADO JUSTO: con los remates de cada uno y su xG, la probabilidad de
 * cada resultado (cada remate es gol con probabilidad su xG, independientes;
 * la cuenta es exacta, sin simulación). Es la lectura «quién mereció ganar».
 */
export function resultadoJusto(tiros: Tiro[]) {
  const distribucion = (lado: Lado) => {
    let d = [1];
    for (const s of tiros) {
      if (s.lado !== lado) continue;
      const q = Math.min(0.99, Math.max(0, s.xG));
      const n = new Array(d.length + 1).fill(0);
      d.forEach((v, k) => {
        n[k] += v * (1 - q);
        n[k + 1] += v * q;
      });
      d = n;
    }
    return d;
  };
  const a = distribucion("L"), b = distribucion("V");
  let L = 0, X = 0, V = 0;
  a.forEach((pa, i) => b.forEach((pb, j) => {
    if (i > j) L += pa * pb;
    else if (i === j) X += pa * pb;
    else V += pa * pb;
  }));
  return { L, X, V };
}

/** «64 %», y nunca «100 %» ni «0 %» si no es seguro del todo. */
export function porcentaje(v: number) {
  if (v >= 0.995 && v < 1) return ">99 %";
  if (v > 0 && v < 0.005) return "<1 %";
  return `${Math.round(v * 100)} %`;
}

/* ------------------------------------------------------------------ */
/*  ALERTAS                                                            */
/* ------------------------------------------------------------------ */

export type Alerta = { clave: string; lado: Lado | null; tono: "favor" | "aviso" | "info"; titulo: string; texto: string; min: number; fuerza: number; ventana?: string };

const fmt = (v: number, d = 1) => v.toLocaleString("es-ES", { minimumFractionDigits: d, maximumFractionDigits: d });

/**
 * Lo que se sale de lo normal en el minuto t, de más a menos fuerte.
 * Revisión del 26/11/2026 (expertos): cada aviso dice su minuto y su ventana;
 * el tono va desde nuestro lado y contando el marcador (el que pierde y
 * aprieta «aprieta para remontar», no «manda»); la presión, sólo ajustada a la
 * cifra oficial; la eficacia (goles frente a xG) tiene su aviso; las rachas
 * cuentan los remates de los últimos 15′, sin tope; la previa dice su base (n).
 */
export function alertas(p: Partido, t: number, k: Calibracion = calibracion(p)): Alerta[] {
  if (t < 8) return [];
  const c = cifrasHasta(p, t);
  const out: Alerta[] = [];
  const nombre = (l: Lado) => nombreEquipoCorto(l === "L" ? p.local.nombre : p.visitante.nombre);
  const tono = (l: Lado, buenoParaEl: boolean): Alerta["tono"] => (!p.nuestro ? "info" : (l === p.nuestro) === buenoParaEl ? "favor" : "aviso");
  const va = (l: Lado) => (l === "L" ? c.L.goles - c.V.goles : c.V.goles - c.L.goles);

  /* 1. Quién manda en los últimos 10 minutos (con el marcador: si pierde, «aprieta para remontar»). */
  const desde = Math.max(0, t - 10);
  const tramo = cifrasEntre(p, desde, t);
  const total = tramo.L.amenaza + tramo.V.amenaza;
  if (total > 0.25) {
    const l: Lado = tramo.L.amenaza >= tramo.V.amenaza ? "L" : "V";
    const parte = (l === "L" ? tramo.L.amenaza : tramo.V.amenaza) / total;
    const yo = l === "L" ? tramo.L : tramo.V;
    if (parte >= 0.68) {
      const verbo = va(l) < 0 ? "aprieta para remontar" : va(l) > 0 ? "gana y sigue mandando" : "manda";
      out.push({ clave: `manda-${l}`, lado: l, tono: tono(l, true), titulo: `${nombre(l)} ${verbo}`, texto: `${Math.round(parte * 100)} % de la amenaza · ${yo.tiros} ${yo.tiros === 1 ? "remate" : "remates"} y ${fmt(yo.xg, 2)} de xG`, min: t, ventana: `${reloj(desde)}-${reloj(t)}`, fuerza: parte * 3 });
    }
  }

  /* 2. El marcador frente a las ocasiones: quién merece más y quién está siendo eficaz. */
  const dif = c.L.xg - c.V.xg;
  if (Math.abs(dif) >= 0.6) {
    const l: Lado = dif > 0 ? "L" : "V";
    const goles = va(l);
    out.push({
      clave: `xg-${l}`,
      lado: l,
      tono: tono(l, true),
      titulo: goles <= 0 ? `${nombre(l)} merece más` : `${nombre(l)} gana y lo merece`,
      texto: `xG ${fmt(l === "L" ? c.L.xg : c.V.xg, 2)} contra ${fmt(l === "L" ? c.V.xg : c.L.xg, 2)}${goles < 0 ? " y va perdiendo" : goles === 0 ? " y va empatando" : ""}`,
      min: t,
      ventana: "todo el partido",
      fuerza: Math.abs(dif) * (goles <= 0 ? 2.4 : 1.2),
    });
  }
  for (const l of ["L", "V"] as Lado[]) {
    const yo = l === "L" ? c.L : c.V;
    if (yo.goles - yo.xg >= 1) {
      const aPuerta = aPuertaDe(yo, l === "L" ? k.aPuerta?.L : k.aPuerta?.V);
      out.push({ clave: `eficaz-${l}`, lado: l, tono: tono(l, true), titulo: `${nombre(l)} marca más de lo que genera`, texto: `${yo.goles} ${yo.goles === 1 ? "gol" : "goles"} con ${fmt(yo.xg, 2)} de xG en ${yo.tiros} remates (${aPuerta} a puerta)${yo.tiros <= 8 ? ": con tan pocos remates es acierto puntual, no tendencia" : ""}`, min: t, ventana: "todo el partido", fuerza: (yo.goles - yo.xg) * 1.6 });
    }
  }

  /* 3. Rachas: remates seguidos de un mismo equipo en los últimos 15′. */
  const ultimos = c.tiros.filter((s) => s.min >= t - 15);
  let racha = 0;
  for (let i = ultimos.length - 1; i >= 0 && ultimos[i].lado === ultimos[ultimos.length - 1]?.lado; i--) racha++;
  if (racha >= 4) {
    const l = ultimos[ultimos.length - 1].lado;
    const xg = ultimos.slice(-racha).reduce((s, x) => s + x.xG, 0);
    out.push({ clave: `racha-${l}`, lado: l, tono: tono(l, true), titulo: `${racha} remates seguidos de ${nombre(l)}`, texto: `${fmt(xg, 2)} de xG sin respuesta del rival`, min: t, ventana: `desde el ${reloj(ultimos[ultimos.length - racha].min)}`, fuerza: racha * 0.5 });
  }

  /* 4. Contra lo que suele hacer (la previa), por 90 minutos. */
  if (t >= 15) {
    const reglas: { m: string; nombre: string; valor: (x: Cifras) => number; bueno: boolean; minimo: number }[] = [
      /* Sólo las que, contadas desde los eventos, salen como las de Opta (toques en el área, remates, xG). */
      { m: "TouchOpBox", nombre: "toques en el área", valor: (x) => x.toquesArea, bueno: true, minimo: 6 },
      { m: "ShtIncBl", nombre: "remates", valor: (x) => x.tiros, bueno: true, minimo: 4 },
      { m: "ExpG", nombre: "goles esperados", valor: (x) => x.xg, bueno: true, minimo: 0.5 },
    ];
    for (const l of ["L", "V"] as Lado[]) {
      const eq = l === "L" ? p.local : p.visitante;
      const yo = l === "L" ? c.L : c.V;
      if (!eq.previa) continue;
      const base = `media de ${eq.previa.pj} partidos`;
      for (const r of reglas) {
        const media = eq.previa.medias[r.m];
        const v = r.valor(yo);
        if (!media || v < r.minimo) continue;
        const ritmo = (v * 90) / t;
        const veces = ritmo / media;
        if (veces >= 1.6) out.push({ clave: `previa-${l}-${r.m}`, lado: l, tono: tono(l, r.bueno), titulo: `${nombre(l)}: ${fmt(veces, 1)}× sus ${r.nombre}`, texto: `a este ritmo ${ritmo < 10 ? fmt(ritmo, 1) : Math.round(ritmo)} por partido; lo normal en él, ${fmt(media, 1)} (${base})`, min: t, ventana: "todo el partido", fuerza: veces });
      }
      /* Presión: sólo con el PPDA ajustado a la cifra oficial de Opta. */
      const mio = ppda(yo, l === "L" ? k.ppda.L : k.ppda.V);
      const suPpda = eq.previa.medias.PPDA;
      if (mio != null && suPpda && yo.defensivas >= 8) {
        if (mio <= suPpda * 0.7) out.push({ clave: `ppda-${l}`, lado: l, tono: tono(l, true), titulo: `${nombre(l)} presiona más arriba que nunca`, texto: `PPDA ${fmt(mio)} frente a su ${fmt(suPpda)} habitual (${base}): deja tocar menos`, min: t, ventana: "todo el partido", fuerza: suPpda / mio });
        if (mio >= suPpda * 1.45) out.push({ clave: `ppda-baja-${l}`, lado: l, tono: tono(l, false), titulo: `${nombre(l)} presiona menos de lo normal`, texto: `PPDA ${fmt(mio)} frente a su ${fmt(suPpda)} habitual (${base}): deja tocar más`, min: t, ventana: "todo el partido", fuerza: mio / suPpda });
      }
    }
  }

  /* 5. El portero sostiene. */
  for (const l of ["L", "V"] as Lado[]) {
    const contra = l === "L" ? c.V : c.L;
    const goles = l === "L" ? c.V.goles : c.L.goles;
    if (contra.xg - goles >= 1) out.push({ clave: `portero-${l}`, lado: l, tono: tono(l, true), titulo: `El portero de ${nombre(l)} sostiene`, texto: `le han hecho ${fmt(contra.xg, 2)} de xG y ha encajado ${goles}`, min: t, ventana: "todo el partido", fuerza: contra.xg - goles + 1 });
  }

  /* 6. Por dónde llegan: un carril con la mitad o más de las entradas al último tercio (con 8 o más). */
  for (const l of ["L", "V"] as Lado[]) {
    const ca = carriles(p, l, 0, t);
    if (ca.total < 8) continue;
    const m = ca.lista.reduce((a, b) => (b.n > a.n ? b : a));
    if (m.n / ca.total >= 0.5) {
      out.push({ clave: `carril-${l}`, lado: l, tono: tono(l, true), titulo: `${nombre(l)} llega por ${m.suyo}`, texto: `${Math.round((m.n / ca.total) * 100)} % de sus entradas al último tercio (${m.n} de ${ca.total}${ca.total < 30 ? ", tendencia" : ""})${p.nuestro && l !== p.nuestro ? `: por nuestra ${m.nuestro}` : ""}`, min: t, ventana: "todo el partido", fuerza: 1.4 + m.n / ca.total });
    }
  }

  return out.sort((a, b) => b.fuerza - a.fuerza).slice(0, 6);
}

/* ------------------------------------------------------------------ */
/*  JUGADORES                                                          */
/* ------------------------------------------------------------------ */

export type Destacado = { jugador: Jugador; amenaza: number; xg: number; tiros: number; goles: number; recuperaciones: number; pases: number; pasesOk: number; nota: number };

export function destacados(p: Partido, t: number, cuantos = 8): Destacado[] {
  const por = new Map<string, Destacado>();
  for (const e of p.eventos) {
    if (e.min > t) break;
    const j = p.jugadores.get(e.jugador);
    if (!j) continue;
    let d = por.get(j.id);
    if (!d) por.set(j.id, (d = { jugador: j, amenaza: 0, xg: 0, tiros: 0, goles: 0, recuperaciones: 0, pases: 0, pasesOk: 0, nota: 0 }));
    if (e.xPV > 0) d.amenaza += e.xPV;
    if (TIROS.has(e.tipo)) {
      d.tiros++;
      d.xg += e.xG ?? 0;
      if (e.tipo === "Goal") d.goles++;
    }
    if (RECUPERA.has(e.tipo)) d.recuperaciones++;
    if (e.tipo === "Pass" && !e.saque) {
      d.pases++;
      if (e.ok) d.pasesOk++;
    }
  }
  for (const d of por.values()) d.nota = d.amenaza + d.xg * 0.8 + d.goles * 0.6 + d.recuperaciones * 0.02;
  return [...por.values()].sort((a, b) => b.nota - a.nota).slice(0, cuantos);
}

/* ------------------------------------------------------------------ */
/*  RED DE PASES Y TERRITORIO                                          */
/* ------------------------------------------------------------------ */

export type Nodo = { id: string; corto: string; dorsal: string; x: number; y: number; toques: number };
export type Enlace = { a: string; b: string; n: number };

/** La red del equipo hasta el minuto t: posición media de cada titular y pases entre ellos. */
export function red(p: Partido, lado: Lado, t: number, minimo = 3) {
  const pos = new Map<string, { x: number; y: number; n: number }>();
  const pares = new Map<string, number>();
  for (const e of p.eventos) {
    if (e.min > t) break;
    if (e.lado !== lado) continue;
    const j = p.jugadores.get(e.jugador);
    if (!j) continue;
    const q = pos.get(j.id) ?? { x: 0, y: 0, n: 0 };
    q.x += e.x;
    q.y += e.y;
    q.n++;
    pos.set(j.id, q);
    if (e.tipo === "Pass" && e.ok && e.receptor && p.jugadores.has(e.receptor)) {
      const k = [j.id, e.receptor].sort().join("|");
      pares.set(k, (pares.get(k) ?? 0) + 1);
    }
  }
  const nodos: Nodo[] = [...pos.entries()]
    .filter(([id, q]) => q.n >= 6 && (p.jugadores.get(id)?.titular ?? true))
    .map(([id, q]) => ({ id, corto: p.jugadores.get(id)!.corto, dorsal: p.jugadores.get(id)!.dorsal, x: q.x / q.n, y: q.y / q.n, toques: q.n }))
    .sort((a, b) => b.toques - a.toques)
    .slice(0, 11);
  const hay = new Set(nodos.map((n) => n.id));
  const enlaces: Enlace[] = [...pares.entries()]
    .map(([k, n]) => ({ a: k.split("|")[0], b: k.split("|")[1], n }))
    .filter((l) => l.n >= minimo && hay.has(l.a) && hay.has(l.b));
  return { nodos, enlaces };
}

/** Malla de toques (12 × 8) del equipo hasta t, en su sentido de ataque. */
export function territorio(p: Partido, lado: Lado, t: number, desde = 0, parte?: number) {
  const W = 12, H = 8;
  const malla = new Array(W * H).fill(0);
  for (const e of p.eventos) {
    if (e.min > t) break;
    if (e.min < desde || (parte && e.parte !== parte) || e.lado !== lado) continue;
    const i = Math.min(W - 1, Math.floor((e.x / 100) * W));
    const k = Math.min(H - 1, Math.floor((e.y / 100) * H));
    malla[k * W + i]++;
  }
  return { W, H, malla };
}

/* ------------------------------------------------------------------ */
/*  LA CRONOLOGÍA                                                      */
/* ------------------------------------------------------------------ */

export type Hito = { lado: Lado; parte: number; min: number; tipo: "gol" | "tiro" | "parada" | "corner" | "cambio" | "amarilla" | "roja"; jugador: string; xG: number | null; entra?: string };

export function hitos(p: Partido, t: number): Hito[] {
  const out: Hito[] = [];
  for (const e of p.eventos) {
    if (e.min > t) break;
    const quien = p.jugadores.get(e.jugador)?.corto ?? "";
    if (e.tipo === "Goal") out.push({ lado: e.lado, parte: e.parte, min: e.min, tipo: "gol", jugador: quien, xG: e.xG });
    else if (e.tipo === "GolPropia") out.push({ lado: e.lado, parte: e.parte, min: e.min, tipo: "gol", jugador: `${quien} (p. p.)`, xG: null });
    else if (TIROS.has(e.tipo)) out.push({ lado: e.lado, parte: e.parte, min: e.min, tipo: A_PUERTA.has(e.tipo) ? "parada" : "tiro", jugador: quien, xG: e.xG });
    else if (e.tipo === "Corner" && e.x >= 50) out.push({ lado: e.lado, parte: e.parte, min: e.min, tipo: "corner", jugador: quien, xG: null });
  }
  /* Cambios y tarjetas (documentos desde el 26/11/2026). */
  for (const m of p.marcas) {
    if (m.min > t) break;
    out.push({ lado: m.lado, parte: m.parte, min: m.min, tipo: m.tipo, jugador: p.jugadores.get(m.jugador)?.corto ?? "", xG: null, entra: m.entra ? p.jugadores.get(m.entra)?.corto : undefined });
  }
  return out.sort((a, b) => a.min - b.min);
}

/** «67′», «45+2′», «90+3′». */
export function reloj(min: number, parte: number | null = null) {
  const m = Math.floor(min) + 1;
  if (parte === 1 && m > 45) return `45+${m - 45}′`;
  if (m > 90) return `90+${m - 90}′`;
  return `${Math.max(1, m)}′`;
}

/** En qué parte está el minuto t (por el último evento hasta t). */
export function parteEn(p: Partido, t: number) {
  let parte = 1;
  for (const e of p.eventos) {
    if (e.min > t) break;
    /* Un evento del descuento de la 1.ª parte (segundo > 2700) no devuelve a la 1.ª. */
    parte = Math.max(parte, e.parte);
  }
  return parte;
}

/* ------------------------------------------------------------------ */
/*  REVISIÓN DEL 26/11/2026: LO QUE PIDIERON LOS EXPERTOS              */
/* ------------------------------------------------------------------ */

/** «Real Madrid Castilla» → «Castilla»; «Real Murcia» → «Murcia»; «Gimnàstic Tarragona» → «Gimnàstic». */
export function nombreEquipoCorto(n: string) {
  if (/castilla|real madrid ii/i.test(n)) return "Castilla";
  const sin = n.replace(/^(Real|Club|CD|CF|UD|SD|RCD|CE|AD|SCR|Atlético|Atletico|Racing|Deportivo|Sporting|Gimnàstic de)\s+/i, "").trim();
  const primera = sin.split(/\s+/)[0] ?? n;
  return /^(Madrid|Club|de)$/i.test(primera) ? n : primera.length >= 4 ? (sin.split(/\s+/).length > 2 ? primera : sin) : sin;
}

const dosD = (v: number) => v.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * EL PARTIDO EN UNA FRASE (experto de comunicación): resultado + si lo
 * merece, con el xG. Desde nuestro lado si jugamos. `clave` es la palabra que
 * va en oro.
 */
export function titular(p: Partido, t: number, c: { L: Cifras; V: Cifras }, final: boolean) {
  const A: Lado = p.nuestro ?? "L";
  const B: Lado = A === "L" ? "V" : "L";
  const nA = nombreEquipoCorto(A === "L" ? p.local.nombre : p.visitante.nombre);
  const gA = c[A].goles, gB = c[B].goles, xA = c[A].xg, xB = c[B].xg;
  const xg = `xG ${dosD(xA)} – ${dosD(xB)}`;
  const v = (pasado: string, presente: string) => (final ? pasado : presente);
  const mas = xA - xB >= 0.4, menos = xB - xA >= 0.4;
  if (t < 3) return { texto: `Arranca el partido`, clave: "Arranca", detalle: "" };
  if (gA > gB) {
    const clave = v("ganó", "gana");
    return { texto: `${nA} ${clave} ${gA}-${gB}${menos ? " sufriendo: el rival generó más" : mas ? " y lo merece" : " en un partido parejo"}`, clave, detalle: xg };
  }
  if (gA < gB) {
    const clave = v("perdió", "pierde");
    return { texto: `${nA} ${clave} ${gA}-${gB}${mas ? " pese a generar más" : menos ? ": el rival fue mejor" : " con las ocasiones igualadas"}`, clave, detalle: xg };
  }
  const clave = v("empató", "empata");
  return { texto: `${nA} ${clave} ${gA}-${gB}${mas ? " y mereció más" : menos ? " y lo da por bueno" : " en un partido igualado"}`, clave, detalle: xg };
}

/**
 * POR DÓNDE LLEGA (experto de fútbol): las entradas al último tercio (pases
 * buenos que acaban con x ≥ 66,7 desde x < 66,7) por carril, según dónde
 * acaban. En Opta y = 0 es la banda derecha de quien ataca.
 */
export function carriles(p: Partido, lado: Lado, desde: number, hasta: number, parte?: number) {
  const n = [0, 0, 0];
  for (const e of p.eventos) {
    if (e.min > hasta) break;
    if (e.min < desde || (parte && e.parte !== parte) || e.lado !== lado || e.tipo !== "Pass" || !e.ok || e.saque || e.fx == null || e.fy == null) continue;
    if (e.x >= 66.7 || e.fx < 66.7) continue;
    n[e.fy < 33.3 ? 0 : e.fy < 66.7 ? 1 : 2]++;
  }
  const total = n[0] + n[1] + n[2];
  const lista = [
    { clave: "der", n: n[0], suyo: "su derecha", nuestro: "izquierda" },
    { clave: "cen", n: n[1], suyo: "el centro", nuestro: "zona central" },
    { clave: "izq", n: n[2], suyo: "su izquierda", nuestro: "derecha" },
  ];
  return { total, lista };
}

export type Transicion = { lado: Lado; min: number; parte: number; x: number; y: number; xG: number; gol: boolean; jugador: string; tirador: string };

/**
 * TRANSICIONES (experto de fútbol): pérdidas de un equipo que acaban en remate
 * del rival en 15 s o menos, y robos que acaban en remate propio en 15 s. El
 * punto es dónde se perdió o se robó (en el sentido de quien la pierde/roba).
 */
export function transiciones(p: Partido, desde: number, hasta: number, parte?: number) {
  /*
  | Revisión 26/11/2026 (experto de análisis): antes «pérdidas que acaban en
  | remate rival» de un equipo y «robos que acaban en remate» del otro no
  | cuadraban (3 frente a 2). Ahora es UNA jugada vista desde los dos lados:
  | la pérdida de A seguida de un remate de B en 15 s o menos; el robo de B es
  | la misma pérdida de A. Y una por remate: si antes del remate A pierde dos
  | veces, cuenta la última (la que de verdad da la ocasión).
  */
  const perdidas: Transicion[] = [];
  const ev = p.eventos;
  const usados = new Set<number>();
  for (let i = ev.length - 1; i >= 0; i--) {
    const s = ev[i];
    if (!TIROS.has(s.tipo)) continue;
    for (let j = i - 1; j >= 0 && s.min - ev[j].min <= 0.25; j--) {
      const e = ev[j];
      /* Balón parado entre la pérdida y el remate (córner, falta, saque de banda): ya no es transición. */
      if (e.tipo === "Corner" || e.tipo === "FreeKick" || (e.lado === s.lado && e.saque === "banda")) break;
      if (e.lado === s.lado) continue;
      /* El que la perdió la volvió a tener: no es esa pérdida. */
      if ((e.tipo === "Pass" && e.ok && !e.saque) || e.tipo === "BallRecovery" || e.tipo === "TakeOn") break;
      if (!esPerdida(e)) continue;
      if (e.min > hasta || e.min < desde || (parte && e.parte !== parte)) break;
      if (!usados.has(i)) {
        usados.add(i);
        perdidas.push({ lado: e.lado, min: e.min, parte: e.parte, x: e.x, y: e.y, xG: s.xG ?? 0, gol: s.tipo === "Goal", jugador: e.jugador, tirador: s.jugador });
      }
      break;
    }
  }
  perdidas.sort((a, b) => a.min - b.min);
  const robos: Transicion[] = perdidas.map((x) => ({ ...x, lado: x.lado === "L" ? "V" : "L" }));
  return { perdidas, robos };
}

export type Tramo15 = { etiqueta: string; L: { xg: number; tiros: number; goles: number }; V: { xg: number; tiros: number; goles: number }; dominio: { L: number; V: number } | null };

/** El partido por tramos de 15′ hasta t (el descuento va con el último tramo de su parte): xG, remates, goles y dominio territorial. */
export function tramos15(p: Partido, t: number): Tramo15[] {
  const etiquetas = ["0-15′", "15-30′", "30-45′", "45-60′", "60-75′", "75-90′"];
  const cajas = etiquetas.map((etiqueta) => ({ etiqueta, L: { xg: 0, tiros: 0, goles: 0, tercio: 0 }, V: { xg: 0, tiros: 0, goles: 0, tercio: 0 }, hay: false }));
  for (const e of p.eventos) {
    if (e.min > t) break;
    const i = e.parte === 1 ? Math.min(2, Math.floor(e.min / 15)) : 3 + Math.min(2, Math.max(0, Math.floor((e.min - 45) / 15)));
    const k = cajas[i][e.lado];
    cajas[i].hay = true;
    if (TIROS.has(e.tipo)) {
      k.tiros++;
      k.xg += e.xG ?? 0;
      if (esGol(e)) k.goles++;
    }
    if (e.tipo === "Pass" && !e.saque && e.x >= 66.7) k.tercio++;
  }
  return cajas
    .filter((c) => c.hay)
    .map((c) => {
      const tt = c.L.tercio + c.V.tercio;
      return { etiqueta: c.etiqueta, L: { xg: c.L.xg, tiros: c.L.tiros, goles: c.L.goles }, V: { xg: c.V.xg, tiros: c.V.tiros, goles: c.V.goles }, dominio: tt ? { L: c.L.tercio / tt, V: c.V.tercio / tt } : null };
    });
}

/** Los tramos que se pueden elegir para mirar el campo y el cara a cara. */
export type TramoClave = "todo" | "p1" | "p2" | "u15" | "cambio";

/** El inicio de la 2.ª parte, en minutos del reloj de Opta. */
export const inicioSegunda = (p: Partido) => p.eventos.find((e) => e.parte === 2)?.min ?? 45;

export type Ventana = { desde: number; hasta: number; nombre: string; parte?: number };

export function tramoDe(p: Partido, clave: TramoClave, t: number): Ventana | null {
  if (clave === "todo") return { desde: 0, hasta: t, nombre: "todo el partido" };
  /* Por parte, con el evento (el descuento de la 1.ª va en minutos > 45, igual que el arranque de la 2.ª). */
  if (clave === "p1") return { desde: 0, hasta: t, nombre: "1.ª parte", parte: 1 };
  if (clave === "p2") return t >= inicioSegunda(p) ? { desde: 0, hasta: t, nombre: "2.ª parte", parte: 2 } : null;
  if (clave === "u15") return { desde: Math.max(0, t - 15), hasta: t, nombre: "últimos 15′" };
  const ultimo = [...p.marcas].reverse().find((m) => m.tipo === "cambio" && m.min <= t);
  return ultimo ? { desde: ultimo.min, hasta: t, nombre: `desde el cambio del ${reloj(ultimo.min, ultimo.parte)}` } : null;
}

/**
 * LA LECTURA DE UN TRAMO (el descanso, el final o cualquier parte): tres
 * frases automáticas: quién dominó y cuándo, la cifra que más se sale de su
 * media y por dónde llegó el rival.
 */
export function lecturaTramo(p: Partido, desde: number, hasta: number, parte?: number, omitir: Set<string> = new Set()): string[] {
  const frases: string[] = [];
  const nombre = (l: Lado) => nombreEquipoCorto(l === "L" ? p.local.nombre : p.visitante.nombre);
  const c = cifrasEntre(p, desde, hasta, parte);
  /* 1. Quién mandó: amenaza total y el mejor tramo de 5′ de cada uno. */
  const total = c.L.amenaza + c.V.amenaza;
  if (total > 0.2) {
    const l: Lado = c.L.amenaza >= c.V.amenaza ? "L" : "V";
    let mejor = { d: desde, v: 0 };
    for (let d = desde; d < hasta; d += 5) {
      const x = cifrasEntre(p, d, Math.min(hasta, d + 5), parte);
      const v = l === "L" ? x.L.amenaza : x.V.amenaza;
      if (v > mejor.v) mejor = { d, v };
    }
    frases.push(`${nombre(l)} tuvo el ${Math.round(((l === "L" ? c.L.amenaza : c.V.amenaza) / total) * 100)} % de la amenaza; su mejor momento por amenaza, del ${reloj(mejor.d)} al ${reloj(Math.min(hasta, mejor.d + 5))}.`);
  }
  /* 2. La cifra que más se sale de lo normal (por 90′, frente a su media). */
  const minutos = Math.max(1, parte === 1 ? Math.min(hasta, 46) - desde : parte === 2 ? hasta - Math.max(desde, 45) : hasta - desde);
  let fuera: { texto: string; veces: number } | null = null;
  for (const l of ["L", "V"] as Lado[]) {
    const eq = l === "L" ? p.local : p.visitante;
    const yo = l === "L" ? c.L : c.V;
    if (!eq.previa || minutos < 15) continue;
    for (const [m, nom, v] of [["ExpG", "xG", yo.xg], ["ShtIncBl", "remates", yo.tiros], ["TouchOpBox", "toques en el área", yo.toquesArea]] as const) {
      const media = eq.previa.medias[m];
      if (!media) continue;
      const ritmo = (v * 90) / minutos;
      const veces = ritmo >= media ? ritmo / media : media / Math.max(ritmo, 0.01);
      const num = (v: number) => (v < 10 ? v.toFixed(1).replace(".", ",") : String(Math.round(v)));
      const base = `su media es ${num(media)} por partido (${eq.previa.pj} partidos${eq.previa.pj < 8 ? ", muestra corta" : ""})`;
      const goles = l === "L" ? c.L.goles : c.V.goles;
      const texto =
        ritmo >= media
          ? `${nombre(l)} multiplicó sus ${nom}: ${num(v)} en ${Math.round(minutos)}′ (${num(ritmo)} por 90′); ${base}.`
          : `${nombre(l)} generó muy poco: ${nom === "xG" ? `${dosD(v)} de xG` : `${num(v)} ${nom}`} en ${Math.round(minutos)}′ cuando ${base}${nom === "xG" && goles ? `, y aun así marcó ${goles}` : ""}.`;
      if (veces >= 1.5 && (!fuera || veces > fuera.veces)) fuera = { veces, texto };
    }
  }
  if (fuera) frases.push(fuera.texto);
  /* 3. Por dónde llega el rival (o el visitante si no jugamos). */
  const rival: Lado = p.nuestro ? (p.nuestro === "L" ? "V" : "L") : "V";
  const ca = carriles(p, rival, desde, hasta, parte);
  if (ca.total >= 5 && !omitir.has(`carril-${rival}`)) {
    const m = ca.lista.reduce((a, b) => (b.n > a.n ? b : a));
    frases.push(`${nombre(rival)} entró al último tercio sobre todo por ${m.suyo} (${m.n} de ${ca.total})${p.nuestro ? `: nuestra ${m.nuestro}` : ""}.`);
  }
  /* 4. Transiciones que hicieron daño. */
  const tr = transiciones(p, desde, hasta, parte);
  const nuestras = p.nuestro ? tr.perdidas.filter((x) => x.lado === p.nuestro) : [];
  if (nuestras.length >= 2 && !omitir.has("tocar-salida")) frases.push(`${nuestras.length} pérdidas nuestras acabaron en remate suyo en menos de 15 s (${dosD(nuestras.reduce((s, x) => s + x.xG, 0))} de xG).`);
  return frases.slice(0, 4);
}

export type JugadorSala = { jugador: Jugador; amenaza: number; xg: number; tiros: number; goles: number; recibeArea: number; defensivas: number; perdidasPropio: number; pases: number; pasesOk: number; nota: number };

/**
 * LOS JUGADORES DE CADA EQUIPO (expertos de fútbol y análisis): amenaza sin
 * contar el gol tres veces (xPV de lo que no es remate + xG de los remates),
 * cuántas veces recibe en el área, acciones defensivas y pérdidas en campo
 * propio. Ordenados por amenaza.
 */
export function jugadoresDe(p: Partido, lado: Lado, desde: number, hasta: number, cuantos = 5, parte?: number): JugadorSala[] {
  const por = new Map<string, JugadorSala>();
  const de = (id: string) => {
    const j = p.jugadores.get(id);
    if (!j || j.lado !== lado) return null;
    let d = por.get(id);
    if (!d) por.set(id, (d = { jugador: j, amenaza: 0, xg: 0, tiros: 0, goles: 0, recibeArea: 0, defensivas: 0, perdidasPropio: 0, pases: 0, pasesOk: 0, nota: 0 }));
    return d;
  };
  for (const e of p.eventos) {
    if (e.min > hasta) break;
    if (e.min < desde || (parte && e.parte !== parte) || e.lado !== lado) continue;
    const d = de(e.jugador);
    if (!d) continue;
    if (TIROS.has(e.tipo)) {
      d.tiros++;
      d.xg += e.xG ?? 0;
      d.amenaza += e.xG ?? 0;
      if (e.tipo === "Goal") d.goles++;
    } else if (e.xPV > 0) d.amenaza += e.xPV;
    if (RECUPERA.has(e.tipo) || DEFENSIVAS.has(e.tipo)) d.defensivas++;
    if (esPerdida(e) && e.x < 40) d.perdidasPropio++;
    if (e.tipo === "Pass" && !e.saque) {
      d.pases++;
      if (e.ok) d.pasesOk++;
      if (e.ok && e.receptor && e.fx != null && e.fy != null && enArea(e.fx, e.fy)) {
        const r = de(e.receptor);
        if (r) r.recibeArea++;
      }
    }
  }
  for (const d of por.values()) d.nota = d.amenaza;
  return [...por.values()].sort((a, b) => b.nota - a.nota).slice(0, cuantos);
}

/** Los goles con minuto, autor y xG (bajo el marcador). */
export function golesHasta(p: Partido, t: number) {
  return p.eventos
    .filter((e) => esGol(e) && e.min <= t)
    .map((e) => ({ lado: e.lado, min: e.min, parte: e.parte, jugador: `${p.jugadores.get(e.jugador)?.corto ?? ""}${e.tipo === "GolPropia" ? " (p. p.)" : ""}`, xG: e.xG ?? null }));
}

/* ------------------------------------------------------------------ */
/*  SEGUNDA RONDA DE LOS EXPERTOS (26/11/2026)                         */
/* ------------------------------------------------------------------ */

export type FichaGol = { lado: Lado; min: number; parte: number; marcador: string; goleador: string; asistente: string; origen: string; pases: number; segundos: number; zona: string; xG: number | null; jugada: string };

const zonaRemate = (x: number, y: number) => (x >= 94.2 && y >= 36.8 && y <= 63.2 ? "en el área pequeña" : enArea(x, y) ? "en el área" : "desde fuera del área");
const carrilDe = (y: number) => (y < 33.3 ? "derecha" : y < 66.7 ? "centro" : "izquierda");

/**
 * LA FICHA DE CADA GOL (experto de fútbol): de dónde nace (balón parado, una
 * pérdida del rival y dónde, un robo propio o ataque elaborado), cuántos pases
 * y segundos hasta el remate, el asistente y desde dónde se remata. La jugada
 * empieza en la última acción con balón del rival (o en el saque a balón
 * parado) antes del gol, como mucho 40 s atrás.
 */
export function fichasDeGol(p: Partido, t: number): FichaGol[] {
  const ev = p.eventos;
  const out: FichaGol[] = [];
  let gL = 0, gV = 0;
  const nombre = (id: string) => p.jugadores.get(id)?.corto ?? "";
  for (let i = 0; i < ev.length; i++) {
    const g = ev[i];
    if (g.min > t) break;
    if (!esGol(g)) continue;
    if (g.lado === "L") gL++;
    else gV++;
    if (g.tipo === "GolPropia") {
      out.push({ lado: g.lado, min: g.min, parte: g.parte, marcador: `${gL}-${gV}`, goleador: `${nombre(g.jugador)} (p. p.)`, asistente: "", origen: "en propia puerta", pases: 0, segundos: 0, zona: "", xG: null, jugada: "" });
      continue;
    }
    let inicio = i;
    let origen = "ataque elaborado";
    let pases = 0;
    let asistente = "";
    let atras = i;
    for (let j = i - 1; j >= 0 && g.min - ev[j].min <= 40 / 60; j--) {
      atras = j;
      const e = ev[j];
      if (e.tipo === "Corner" && e.lado === g.lado && e.x >= 50) { origen = "de córner"; inicio = j; break; }
      if (e.tipo === "FreeKick" && e.lado === g.lado && e.x >= 50) { origen = "de falta"; inicio = j; break; }
      if (e.lado !== g.lado) {
        if (esPerdida(e)) {
          const enSalida = e.x < 40;
          origen = `pérdida de ${nombre(e.jugador) || "su rival"}${enSalida ? " en salida" : e.x < 66.7 ? " en medio campo" : ""} (por su ${carrilDe(e.y)})`;
          inicio = j;
          break;
        }
        if ((e.tipo === "Pass" && e.ok) || e.tipo === "TakeOn" || e.tipo === "BallRecovery") { inicio = j + 1; break; }
        continue;
      }
      if (RECUPERA.has(e.tipo)) {
        /* El robo y la pérdida que lo provoca, juntos («robo de Pérez a Rivas, en salida»): antes la ficha y las transiciones contaban la misma jugada distinto. */
        const previa = ev.slice(Math.max(0, j - 4), j).reverse().find((x) => x.lado !== g.lado && esPerdida(x) && e.min - x.min <= 5 / 60);
        origen = previa
          ? `robo de ${nombre(e.jugador)} tras pérdida de ${nombre(previa.jugador) || "su rival"}${previa.x < 40 ? " en salida" : previa.x < 66.7 ? " en medio campo" : ""} (por su ${carrilDe(previa.y)})`
          : `${e.tipo === "BallRecovery" ? "balón suelto que recoge" : "robo de"} ${nombre(e.jugador)} ${e.x >= 66.7 ? "arriba" : e.x >= 40 ? "en medio campo" : "en su campo"} (por su ${carrilDe(e.y)})`;
        inicio = j;
        break;
      }
      if (e.tipo === "Pass" && e.ok && !e.saque) {
        pases++;
        if (!asistente && e.receptor === g.jugador) asistente = nombre(e.jugador);
      }
      if (e.saque === "banda" && j < i) { origen = "de saque de banda"; inicio = j; break; }
    }
    /* Sin corte en 40 s (posesión larga): la jugada empieza en lo más antiguo mirado. Antes salía «10 pases · 0 s». */
    if (inicio === i && pases > 0) inicio = atras;
    if (g.jugada === "penalti") origen = "de penalti";
    else if (g.jugada === "corner") origen = "de córner";
    else if (g.jugada === "falta") origen = "de falta";
    out.push({
      lado: g.lado,
      min: g.min,
      parte: g.parte,
      marcador: `${gL}-${gV}`,
      goleador: nombre(g.jugador),
      asistente,
      origen,
      pases,
      segundos: Math.max(0, Math.round((g.min - ev[inicio].min) * 60)),
      zona: zonaRemate(g.x, g.y),
      xG: g.xG,
      jugada: g.jugada,
    });
  }
  return out;
}

export type DetalleAbp = { despejados: number; corners: number; cornerContacto: number; cornerRemate1: number; cornerRemate2: number; faltasLaterales: number; faltasDirectas: number; bandasLargas: number; caidas: { x: number; y: number; gana: boolean }[] };

/**
 * BALÓN PARADO CON CONTENIDO (experto de fútbol): por equipo, córners con su
 * primer contacto (el evento siguiente al envío: suyo = ganado; del rival =
 * perdido), remate en primera (el primer contacto es el remate) o en segunda
 * jugada (hasta 10 s), faltas laterales (envío desde x ≥ 60 y banda), faltas
 * directas (remate como primera acción) y saques de banda largos al área. La
 * caída de cada envío (fin del pase) para el campo.
 */
export function detalleAbp(p: Partido, lado: Lado, desde: number, hasta: number, parte?: number): DetalleAbp {
  const d: DetalleAbp = { despejados: 0, corners: 0, cornerContacto: 0, cornerRemate1: 0, cornerRemate2: 0, faltasLaterales: 0, faltasDirectas: 0, bandasLargas: 0, caidas: [] };
  const ev = p.eventos;
  for (let i = 0; i < ev.length; i++) {
    const e = ev[i];
    if (e.min > hasta) break;
    if (e.min < desde || (parte && e.parte !== parte) || e.lado !== lado) continue;
    const esCorner = e.tipo === "Corner" && e.x >= 50;
    const esFalta = e.tipo === "FreeKick" && e.x >= 55;
    const esBanda = e.tipo === "Pass" && e.saque === "banda" && e.x >= 66.7 && e.fx != null && e.fy != null && enArea(e.fx, e.fy);
    if (!esCorner && !esFalta && !esBanda) continue;
    if (esBanda) { d.bandasLargas++; continue; }
    /* El envío: el siguiente pase del mismo equipo en 30 s; o, en la falta, un remate directo. */
    let k = i + 1;
    while (k < ev.length && ev[k].min - e.min <= 0.5 && !(ev[k].lado === lado && (ev[k].tipo === "Pass" || TIROS.has(ev[k].tipo)))) k++;
    const envio = ev[k];
    if (!envio || envio.min - e.min > 0.5) {
      /* Sin pase propio tras el córner: lo despejó el rival antes (cuenta como córner, primer contacto suyo). */
      if (esCorner) {
        d.corners++;
        d.despejados++;
      }
      continue;
    }
    if (esFalta) {
      if (TIROS.has(envio.tipo)) { d.faltasDirectas++; continue; }
      if (envio.x >= 60 && (envio.y < 25 || envio.y > 75) && envio.fx != null && envio.fy != null && enArea(envio.fx, envio.fy)) d.faltasLaterales++;
      else continue;
    } else d.corners++;
    if (envio.fx != null && envio.fy != null) {
      const sig = ev[k + 1];
      const gana = !!sig && sig.lado === lado;
      if (esCorner && gana) d.cornerContacto++;
      d.caidas.push({ x: envio.fx, y: envio.fy, gana });
      if (esCorner) {
        if (sig && sig.lado === lado && TIROS.has(sig.tipo)) d.cornerRemate1++;
        else {
          for (let m = k + 2; m < ev.length && ev[m].min - envio.min <= 10 / 60; m++) {
            if (ev[m].lado === lado && TIROS.has(ev[m].tipo)) { d.cornerRemate2++; break; }
          }
        }
      }
    }
  }
  return d;
}

/**
 * QUÉ TOCAR (experto de fútbol: «el descanso con frases para actuar»). Reglas
 * sobre lo que ya cuenta la sala, siempre desde nuestro lado: por dónde nos
 * entran, pérdidas en salida que acaban en remate, la presión frente a su
 * media, el primer contacto en los córners en contra y la eficacia.
 */
export function queTocar(p: Partido, desde: number, hasta: number, parte?: number, k: Calibracion = calibracion(p)): { clave: string; texto: string }[] {
  if (!p.nuestro) return [];
  const yo = p.nuestro;
  const el: Lado = yo === "L" ? "V" : "L";
  const out: { clave: string; texto: string }[] = [];
  const c = cifrasEntre(p, desde, hasta, parte);
  const ca = carriles(p, el, desde, hasta, parte);
  const corta = (n: number) => (n < 30 ? ", tendencia" : "");
  if (ca.total >= 6) {
    const m = ca.lista.reduce((a, b) => (b.n > a.n ? b : a));
    if (m.n / ca.total >= 0.45) {
      out.push({
        clave: `carril-${el}`,
        texto:
          m.clave === "cen"
            ? `Nos entran por dentro (${m.n} de ${ca.total} entradas al último tercio${corta(ca.total)}): cerrar el pasillo central, pivotes más juntos.`
            : `Nos entran por nuestra ${m.nuestro} (${m.n} de ${ca.total}${corta(ca.total)}): ayuda del interior a nuestro lateral ${m.nuestro === "izquierda" ? "izquierdo" : "derecho"} y vigilancia por ese lado.`,
      });
    }
  }
  const tr = transiciones(p, desde, hasta, parte);
  const enSalida = tr.perdidas.filter((x) => x.lado === yo && x.x < 40);
  if (enSalida.length >= 2) out.push({ clave: "tocar-salida", texto: `${enSalida.length} pérdidas en salida acabaron en remate suyo (${dosD(enSalida.reduce((s2, x) => s2 + x.xG, 0))} de xG): salir en largo cuando aprieten o el pivote más cerca de los centrales.` });
  const mio = ppda(yo === "L" ? c.L : c.V, yo === "L" ? k.ppda.L : k.ppda.V);
  const media = (yo === "L" ? p.local : p.visitante).previa?.medias.PPDA;
  const uno = (v: number) => v.toFixed(1).replace(".", ",");
  if (mio != null && media && mio >= media * 1.35) out.push({ clave: `ppda-baja-${yo}`, texto: `Presionamos menos que de costumbre (PPDA ${uno(mio)} frente a nuestro ${uno(media)}): adelantar la primera línea y juntar el bloque.` });
  const abpEl = detalleAbp(p, el, desde, hasta, parte);
  if (abpEl.corners >= 2 && abpEl.cornerContacto / abpEl.corners >= 0.5) out.push({ clave: "tocar-corner", texto: `Ganan el primer contacto en ${abpEl.cornerContacto} de sus ${abpEl.corners} córners: revisar quién ataca el primer palo y las marcas.` });
  const nos = yo === "L" ? c.L : c.V;
  const ataque = nos.tiros >= 8 && nos.goles === 0 && nos.xg >= 0.6 ? { clave: "tocar-ataque", texto: `${nos.tiros} remates y ${dosD(nos.xg)} de xG sin gol: el volumen está; buscar remates de más calidad (pase atrás, segundo palo) en vez de tiros lejanos.` } : null;
  /* Hasta 3 de defensa y, si sale, la de ataque siempre (experto de fútbol: con 0-2 también hay que hablar de nuestro ataque). */
  return [...out.slice(0, 3), ...(ataque ? [ataque] : [])];
}
