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
};

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
  jugadores: Map<string, Jugador>;
  /** El último minuto con eventos (hasta donde llega lo leído). */
  ultimo: number;
  /** El equipo «nuestro» (Castilla o Real Madrid) si juega. */
  nuestro: Lado | null;
};

const TIROS = new Set(["Goal", "AttemptSaved", "Miss", "Post", "SavedShot"]);
const A_PUERTA = new Set(["Goal", "AttemptSaved", "SavedShot"]);
const DEFENSIVAS = new Set(["Tackle", "Interception", "Challenge", "AttemptedTackle"]);
const RECUPERA = new Set(["BallRecovery", "Interception", "Tackle"]);

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
      const lado = ladoDe(f[e("teamId")]);
      const x = num(f[e("x")]), y = num(f[e("y")]);
      if (!lado || x == null || y == null) continue;
      eventos.push({
        lado,
        parte: num(f[e("parte")]) ?? 1,
        min: (num(f[e("segundo")]) ?? 0) / 60,
        tipo: String(f[e("tipo")] ?? ""),
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
      });
    }
    eventos.sort((a, b) => a.min - b.min);
  }

  const nuestro: Lado | null = NUESTROS.includes(String(filas[0][c("equipo")])) ? "L" : NUESTROS.includes(String(filas[1][c("equipo")])) ? "V" : null;
  const estado = String(doc.estado ?? "");

  return {
    id: doc.partido,
    fecha: String(doc.fecha ?? ""),
    liga: String(doc.liga ?? ""),
    estado,
    actualizado: String(doc.actualizado ?? ""),
    acabado: /played|full|finished/i.test(estado),
    local,
    visitante,
    eventos,
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
  amenaza: number;
};

export type Tiro = { lado: Lado; min: number; x: number; y: number; xG: number; gol: boolean; aPuerta: boolean; jugador: string; tipo: string };

const vacias = (): Cifras => ({ goles: 0, xg: 0, tiros: 0, aPuerta: 0, pases: 0, pasesOk: 0, toquesArea: 0, recAltas: 0, perdidas: 0, centros: 0, corners: 0, defensivas: 0, pasesRivalSuCampo: 0, amenaza: 0 });

export const enArea = (x: number, y: number) => x >= 83 && y >= 21 && y <= 79;

export function cifrasHasta(p: Partido, t: number) {
  const L = vacias(), V = vacias();
  const tiros: Tiro[] = [];
  for (const e of p.eventos) {
    if (e.min > t) break;
    const yo = e.lado === "L" ? L : V;
    const el = e.lado === "L" ? V : L;
    if (TIROS.has(e.tipo)) {
      yo.tiros++;
      if (A_PUERTA.has(e.tipo)) yo.aPuerta++;
      if (e.tipo === "Goal") yo.goles++;
      yo.xg += e.xG ?? 0;
      tiros.push({ lado: e.lado, min: e.min, x: e.x, y: e.y, xG: e.xG ?? 0.03, gol: e.tipo === "Goal", aPuerta: A_PUERTA.has(e.tipo), jugador: e.jugador, tipo: e.tipo });
    }
    if (e.tipo === "Pass" && !e.saque) {
      yo.pases++;
      if (e.ok) yo.pasesOk++;
      else yo.perdidas++;
      if (e.x < 60) el.pasesRivalSuCampo++;
      if (e.x >= 66 && (e.y < 21 || e.y > 79) && e.fx != null && e.fy != null && enArea(e.fx, e.fy)) yo.centros++;
    }
    if (e.tipo === "Dispossessed") yo.perdidas++;
    if (e.tipo === "Corner") yo.corners++;
    if (enArea(e.x, e.y) && e.tipo !== "Corner") yo.toquesArea++;
    if (RECUPERA.has(e.tipo) && e.x >= 66.7) yo.recAltas++;
    if (DEFENSIVAS.has(e.tipo) && e.x >= 40) yo.defensivas++;
    if (e.xPV > 0) yo.amenaza += e.xPV;
  }
  return { L, V, tiros };
}

export const posesion = (c: { L: Cifras; V: Cifras }) => {
  const t = c.L.pases + c.V.pases;
  return t ? { L: c.L.pases / t, V: c.V.pases / t } : { L: 0.5, V: 0.5 };
};

export const ppda = (yo: Cifras) => (yo.defensivas ? yo.pasesRivalSuCampo / yo.defensivas : null);

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
    const v = (e.xPV > 0 ? e.xPV : 0) + (TIROS.has(e.tipo) ? (e.xG ?? 0) : 0);
    tramos[k][e.lado] += v;
  }
  /* Suavizado ligero (media con los vecinos), para que se lea como una ola. */
  return tramos.map((x, i) => {
    const a = tramos[i - 1], b = tramos[i + 1];
    const m = (k: Lado) => (x[k] * 2 + (a?.[k] ?? x[k]) + (b?.[k] ?? x[k])) / 4;
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
  const queda = Math.max(0, DURACION - m) / 90;
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
      }
    }
    salida.push({ min: m, ...probabilidad(p, m, gL, gV, xL, xV) });
  }
  return salida;
}

/* ------------------------------------------------------------------ */
/*  ALERTAS                                                            */
/* ------------------------------------------------------------------ */

export type Alerta = { clave: string; lado: Lado | null; tono: "favor" | "aviso" | "info"; titulo: string; texto: string; min: number; fuerza: number };

const fmt = (v: number, d = 1) => v.toLocaleString("es-ES", { minimumFractionDigits: d, maximumFractionDigits: d });

/**
 * Lo que se sale de lo normal en el minuto t, de más a menos fuerte. El tono
 * va desde el lado nuestro (si juega): «favor» es bueno para nosotros.
 */
export function alertas(p: Partido, t: number): Alerta[] {
  if (t < 8) return [];
  const c = cifrasHasta(p, t);
  const out: Alerta[] = [];
  const nombre = (l: Lado) => (l === "L" ? p.local.nombre : p.visitante.nombre);
  const tono = (l: Lado, buenoParaEl: boolean): Alerta["tono"] => (!p.nuestro ? "info" : (l === p.nuestro) === buenoParaEl ? "favor" : "aviso");

  /* 1. Quién manda en los últimos 10 minutos. */
  const desde = Math.max(0, t - 10);
  let aL = 0, aV = 0;
  for (const e of p.eventos) {
    if (e.min > t) break;
    if (e.min < desde) continue;
    const v = (e.xPV > 0 ? e.xPV : 0) + (TIROS.has(e.tipo) ? (e.xG ?? 0) : 0);
    if (e.lado === "L") aL += v;
    else aV += v;
  }
  const total = aL + aV;
  if (total > 0.25) {
    const l: Lado = aL >= aV ? "L" : "V";
    const parte = (l === "L" ? aL : aV) / total;
    if (parte >= 0.68) out.push({ clave: `manda-${l}`, lado: l, tono: tono(l, true), titulo: `${nombre(l)} manda`, texto: `${Math.round(parte * 100)} % de la amenaza en los últimos 10′`, min: t, fuerza: parte * 3 });
  }

  /* 2. El marcador frente a las ocasiones. */
  const dif = c.L.xg - c.V.xg;
  if (Math.abs(dif) >= 0.7) {
    const l: Lado = dif > 0 ? "L" : "V";
    const goles = l === "L" ? c.L.goles - c.V.goles : c.V.goles - c.L.goles;
    out.push({
      clave: `xg-${l}`,
      lado: l,
      tono: tono(l, true),
      titulo: goles <= 0 ? `${nombre(l)} merece más` : `${nombre(l)} gana y lo merece`,
      texto: `xG ${fmt(l === "L" ? c.L.xg : c.V.xg, 2)} contra ${fmt(l === "L" ? c.V.xg : c.L.xg, 2)}${goles <= 0 ? " y no va ganando" : ""}`,
      min: t,
      fuerza: Math.abs(dif) * (goles <= 0 ? 2.4 : 1.2),
    });
  }

  /* 3. Rachas: remates seguidos de un mismo equipo. */
  const ultimos = c.tiros.slice(-8);
  let racha = 0;
  for (let i = ultimos.length - 1; i >= 0 && ultimos[i].lado === ultimos[ultimos.length - 1]?.lado; i--) racha++;
  if (racha >= 4) {
    const l = ultimos[ultimos.length - 1].lado;
    out.push({ clave: `racha-${l}`, lado: l, tono: tono(l, true), titulo: `${racha} remates seguidos`, texto: `de ${nombre(l)} sin respuesta del rival`, min: t, fuerza: racha * 0.5 });
  }

  /* 4. Contra lo que suele hacer (la previa), por 90 minutos. */
  if (t >= 15) {
    const reglas: { m: string; nombre: string; valor: (x: Cifras) => number; bueno: boolean; minimo: number; por90?: boolean }[] = [
      /* Sólo las que, contadas desde los eventos, salen como las de Opta (probado con el Real Madrid - Celta del
         21/11: toques en el área 69/65, remates 24/24). Centros y recuperaciones altas no cuadran: fuera. */
      { m: "TouchOpBox", nombre: "toques en el área", valor: (x) => x.toquesArea, bueno: true, minimo: 6 },
      { m: "ShtIncBl", nombre: "remates", valor: (x) => x.tiros, bueno: true, minimo: 4 },
      { m: "ExpG", nombre: "goles esperados", valor: (x) => x.xg, bueno: true, minimo: 0.5 },
    ];
    for (const l of ["L", "V"] as Lado[]) {
      const eq = l === "L" ? p.local : p.visitante;
      const yo = l === "L" ? c.L : c.V;
      if (!eq.previa) continue;
      for (const r of reglas) {
        const media = eq.previa.medias[r.m];
        const v = r.valor(yo);
        if (!media || v < r.minimo) continue;
        const ritmo = (v * 90) / t;
        const veces = ritmo / media;
        if (veces >= 1.6) out.push({ clave: `previa-${l}-${r.m}`, lado: l, tono: tono(l, r.bueno), titulo: `${nombre(l)}: ${fmt(veces, 1)}× sus ${r.nombre}`, texto: `a este ritmo ${ritmo < 10 ? fmt(ritmo, 1) : Math.round(ritmo)} por partido; su media es ${fmt(media, 1)}`, min: t, fuerza: veces });
      }
      /* Presión: PPDA bajo = presiona más que de costumbre. */
      const mio = ppda(yo);
      const suPpda = eq.previa.medias.PPDA;
      if (mio != null && suPpda && yo.defensivas >= 8) {
        if (mio <= suPpda * 0.7) out.push({ clave: `ppda-${l}`, lado: l, tono: tono(l, true), titulo: `${nombre(l)} aprieta más que nunca`, texto: `PPDA ${fmt(mio)} (su media ${fmt(suPpda)}): presiona más arriba de lo que suele`, min: t, fuerza: suPpda / mio });
        if (mio >= suPpda * 1.45) out.push({ clave: `ppda-baja-${l}`, lado: l, tono: tono(l, false), titulo: `${nombre(l)} no presiona`, texto: `PPDA ${fmt(mio)} (su media ${fmt(suPpda)}): deja tocar mucho más de lo normal`, min: t, fuerza: mio / suPpda });
      }
    }
  }

  /* 5. El portero sostiene. */
  for (const l of ["L", "V"] as Lado[]) {
    const contra = l === "L" ? c.V : c.L;
    const goles = l === "L" ? c.V.goles : c.L.goles;
    if (contra.xg - goles >= 1) out.push({ clave: `portero-${l}`, lado: l, tono: tono(l, true), titulo: `El portero de ${nombre(l)} sostiene`, texto: `le han hecho ${fmt(contra.xg, 2)} de xG y ha encajado ${goles}`, min: t, fuerza: contra.xg - goles + 1 });
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
export function territorio(p: Partido, lado: Lado, t: number, desde = 0) {
  const W = 12, H = 8;
  const malla = new Array(W * H).fill(0);
  for (const e of p.eventos) {
    if (e.min > t) break;
    if (e.min < desde || e.lado !== lado) continue;
    const i = Math.min(W - 1, Math.floor((e.x / 100) * W));
    const k = Math.min(H - 1, Math.floor((e.y / 100) * H));
    malla[k * W + i]++;
  }
  return { W, H, malla };
}

/* ------------------------------------------------------------------ */
/*  LA CRONOLOGÍA                                                      */
/* ------------------------------------------------------------------ */

export type Hito = { lado: Lado; min: number; tipo: "gol" | "tiro" | "parada" | "corner"; jugador: string; xG: number | null };

export function hitos(p: Partido, t: number): Hito[] {
  const out: Hito[] = [];
  for (const e of p.eventos) {
    if (e.min > t) break;
    const quien = p.jugadores.get(e.jugador)?.corto ?? "";
    if (e.tipo === "Goal") out.push({ lado: e.lado, min: e.min, tipo: "gol", jugador: quien, xG: e.xG });
    else if (TIROS.has(e.tipo)) out.push({ lado: e.lado, min: e.min, tipo: A_PUERTA.has(e.tipo) ? "parada" : "tiro", jugador: quien, xG: e.xG });
    else if (e.tipo === "Corner") out.push({ lado: e.lado, min: e.min, tipo: "corner", jugador: quien, xG: null });
  }
  return out;
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
    parte = e.parte;
  }
  return parte;
}
