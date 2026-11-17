/**
 * EL RESPALDO DE OPTA (17/11/2026): de los documentos de Opta a las filas de
 * cada pantalla.
 *
 * Fuentes (todas en `app_documents`, ver lib/opta.ts):
 * - `opta:partidos`: los partidos del Castilla, la fecha y los goles.
 * - `opta:abp-eventos` + `opta:remates`: cada córner, falta y saque de banda
 *   con dónde sale, dónde cae, quién lo saca y los remates de su jugada
 *   (`saquesDe`, lib/opta-eventos.ts).
 * - `opta:directo:<partido>`: el evento a evento entero de los dos equipos
 *   (`leeEventos`), de donde salen robos, pérdidas, faltas (el «FreeKick» de
 *   Opta es la falta: el que la recibe con ok = 1 y el que la hace con ok = 0)
 *   y cómo acaba cada jugada.
 *
 * Reglas, las mismas que el timeline de Hudl en lo que se puede
 * (scripts/partido/robos.cjs, perdidas.cjs): robo = recuperación,
 * intercepción o entrada ganada del Castilla (`esRecuperacion`); pérdida =
 * pase fallado, regate perdido o robado en conducción (`esPerdida`), sin los
 * saques de un balón parado; dos acciones a menos de 4 s son la misma;
 * transición = los 15 s siguientes; tercio y carril, desde quien hace la
 * acción (x 0-100 hacia la portería rival; y < 33,3 = su banda derecha).
 *
 * Lo que Opta no da se deja en blanco y no se nombra: altura del envío (tenso
 * o bombeado), calidad, defensa del rival, rutina, segundo balón, defensores
 * entre la falta y la portería.
 *
 * Puro (sin React ni red): lo usan la ruta /api/opta/respaldo y
 * scripts/opta-acciones-video.mjs (por scripts/cargador-ts.cjs).
 */

import { CASTILLA_OPTA, aObjetos, num, type TablaOpta } from "@/lib/opta";
import { enArea, minutoDe, pistaDe, rematesDe, saquesDe, esPerdida, esRecuperacion, type Remate, type Saque } from "@/lib/opta-eventos";
import { leeEventos, leeJugadores, corrigeNombre, type EventoDirecto, type JugadorDirecto } from "@/lib/opta-directo-mapas";
import type { TipoEventoOpta } from "@/lib/opta-video";
import type { Accion, Confianza } from "@/lib/transiciones/datos";
import type {
  AccionVideoOpta,
  FaltaOpta,
  FilaHojaOpta,
  PartidoFaltasOpta,
  PartidoOpta,
  PartidoTransicionesOpta,
  RespaldoOpta,
  RoboOpta,
} from "./tipos";

/* ------------------------------------------------------------------ */
/*  Entrada                                                            */
/* ------------------------------------------------------------------ */

/** Un clip ya bajado: `{ url }` bajo la clave `partido|parte|segundo`. */
export type ClipsVideo = Record<string, { url?: string } | undefined>;

export type DocDirecto = { eventos?: TablaOpta; jugadores?: TablaOpta; equipos?: TablaOpta } | null | undefined;

export type DocsRespaldo = {
  partidos: TablaOpta | null;
  abpEventos: TablaOpta | null;
  remates: TablaOpta | null;
  /** `opta:jugadores` (y `opta:castilla`): para saber de qué equipo es cada lanzador. */
  jugadores: TablaOpta[];
  directos: Record<string, DocDirecto>;
  clips: ClipsVideo;
};

/** La clave de un corte: la misma de `opta:goles-video` y `opta:acciones-video`. */
export const claveVideo = (partido: string, parte: number, segundo: number) => `${partido}|${parte}|${Math.round(segundo)}`;

/* ------------------------------------------------------------------ */
/*  Ayudas                                                             */
/* ------------------------------------------------------------------ */

const TIROS = new Set(["Goal", "Miss", "AttemptSaved", "Post"]);
/** Tener el balón y jugarlo: hace dueño de la jugada. */
const CON_BALON = new Set(["Pass", "TakeOn", "BallRecovery", "Interception", "Pickup", "Claim", "Dispossessed", "OffsidePass"]);
const TRANSICION = 15;

const dosCifras = (n: number) => String(Math.floor(n)).padStart(2, "0");

/** «3'50"», «45+1'56"», «90+2'10"»: como el minuto del timeline de Hudl. */
export function relojOpta(parte: number, segundo: number): string {
  const tope = parte === 1 ? 2700 : parte === 2 ? 5400 : Infinity;
  if (segundo >= tope) {
    const d = segundo - tope;
    return `${parte === 1 ? 45 : 90}+${Math.floor(d / 60)}'${dosCifras(d % 60)}"`;
  }
  return `${Math.floor(segundo / 60)}'${dosCifras(segundo % 60)}"`;
}

/** El minuto entero de la hoja: el descuento de la primera parte sigue en 46, 47… */
const minutoHoja = (segundo: number) => String(minutoDe(segundo));

const tercio = (x: number) => (x >= 66.7 ? "campo rival" : x >= 33.3 ? "medio campo" : "campo propio");
/** y 0 = banda derecha de quien ataca. */
const carril = (y: number) => (y < 33.3 ? "derecha" : y > 66.7 ? "izquierda" : "centro");
const porCarril = (c: string) => (c === "centro" ? "por el centro" : `por la ${c}`);
/** Metros (105 × 68). */
const metros = (x1: number, y1: number, x2: number, y2: number) => Math.hypot(((x2 - x1) * 105) / 100, ((y2 - y1) * 68) / 100);
const aGol = (x: number, y: number) => metros(x, y, 100, 50);

const slug = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const jornadaHoja = (n: number) => `LIGA ${String(n).padStart(2, "0")}`;

const esTiro = (e: EventoDirecto) => TIROS.has(e.tipo);
const esCastilla = (teamId: string) => teamId === CASTILLA_OPTA;

/* ------------------------------------------------------------------ */
/*  Partidos                                                           */
/* ------------------------------------------------------------------ */

export function partidosCastilla(t: TablaOpta | null, directos: Record<string, DocDirecto> = {}): PartidoOpta[] {
  const filas = aObjetos(t);
  const nuestras = filas.filter((f) => String(f.teamId) === CASTILLA_OPTA);
  const salida = nuestras
    .map((f) => {
      const partido = String(f.partido ?? "");
      const otro = filas.find((g) => String(g.partido) === partido && String(g.teamId) !== CASTILLA_OPTA);
      const campo = aObjetos(directos[partido]?.equipos ?? null).find((e) => String(e.teamId) === CASTILLA_OPTA)?.campo;
      return {
        partido,
        fecha: String(f.fecha ?? "").slice(0, 10),
        jornada: 0,
        rival: String(otro?.equipo ?? ""),
        local: campo === "HOME" ? true : campo === "AWAY" ? false : null,
        golesCastilla: num(f.Goal),
        golesRival: num(otro?.Goal),
      } satisfies PartidoOpta;
    })
    .filter((p) => p.partido && p.fecha)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
  salida.forEach((p, i) => (p.jornada = i + 1));
  return salida;
}

const resultadoDe = (p: PartidoOpta) => {
  if (p.golesCastilla == null || p.golesRival == null) return "";
  return p.local === false ? `${p.golesRival}-${p.golesCastilla}` : `${p.golesCastilla}-${p.golesRival}`;
};

/* ------------------------------------------------------------------ */
/*  Un partido evento a evento                                         */
/* ------------------------------------------------------------------ */

type Contexto = {
  p: PartidoOpta;
  ev: EventoDirecto[];
  nombre: Map<string, string>;
  puesto: Map<string, string>;
  /** Goles con su instante, para el marcador de cada acción. */
  goles: { parte: number; segundo: number; nuestro: boolean }[];
  /** Los segundos (parte|segundo) en que se saca un córner, una falta o una banda: sus pases no son pérdidas. */
  saques: Set<string>;
  clips: ClipsVideo;
};

const instante = (parte: number, segundo: number) => `${parte}|${Math.round(segundo)}`;

/** El primer evento en o después de ese instante. */
function indiceEn(ev: EventoDirecto[], parte: number, segundo: number): number {
  for (let i = 0; i < ev.length; i++) if (ev[i].parte > parte || (ev[i].parte === parte && ev[i].segundo >= segundo)) return i;
  return ev.length;
}

function marcadorEn(c: Contexto, parte: number, segundo: number) {
  const antes = c.goles.filter((g) => g.parte < parte || (g.parte === parte && g.segundo < segundo));
  return { rmc: antes.filter((g) => g.nuestro).length, rival: antes.filter((g) => !g.nuestro).length };
}

/** Nuestro corte, si ya está bajado, y el instante para el enlace a ProVision (lo monta el navegador: `enlaceOptaDe`). */
function videoDe(c: Contexto, parte: number, segundo: number) {
  const clip = c.clips[claveVideo(c.p.partido, parte, segundo)]?.url;
  return { ...(clip ? { video: clip } : {}), optaEvento: { partido: c.p.partido, fecha: c.p.fecha, parte, segundo: Math.round(segundo) } };
}

/** La falta de ese instante: quién la recibe (ok = 1) y quién la hace. */
function faltaEn(ev: EventoDirecto[], i: number) {
  const e = ev[i];
  const par = ev.filter((x) => x.tipo === "FreeKick" && x.parte === e.parte && Math.abs(x.segundo - e.segundo) <= 1);
  const recibe = par.find((x) => x.ok) ?? null;
  const hace = par.find((x) => !x.ok) ?? null;
  return { recibe, hace, recibeEquipo: recibe?.teamId ?? (hace ? `no:${hace.teamId}` : "") };
}

/**
 * Cómo sigue la jugada desde `i0`, con `dueno` con el balón, hasta `tope`
 * segundos: el primer remate, el balón parado que se gana, el último dueño y
 * si llegó al último tercio. Es lo que comparten ABP y banda.
 */
function siguiente(c: Contexto, i0: number, dueno: string, tope: number, desde = 1) {
  const e0 = c.ev[i0];
  let quien = dueno;
  const llega = new Map<string, boolean>();
  let remate: EventoDirecto | null = null;
  let abpDe: string | null = null;
  for (let j = i0 + 1; j < c.ev.length; j++) {
    const x = c.ev[j];
    if (x.parte !== e0.parte || x.segundo - e0.segundo > tope) break;
    if (x.segundo - e0.segundo < desde) continue;
    if (esTiro(x)) {
      remate = x;
      break;
    }
    if (x.tipo === "FreeKick") {
      const f = faltaEn(c.ev, j);
      abpDe = f.recibe?.teamId ?? null;
      break;
    }
    if (x.tipo === "Corner" && x.ok) {
      abpDe = x.teamId;
      break;
    }
    if (x.saque && x.tipo === "Pass") {
      quien = x.teamId;
      break;
    }
    if (CON_BALON.has(x.tipo) && x.teamId !== quien) quien = x.teamId;
    if (x.teamId === quien && (x.x >= 66.7 || (x.ok && (x.finX ?? 0) >= 66.7))) llega.set(quien, true);
  }
  return { remate, abpDe, quien, llego: llega.get(quien) ?? false };
}

/* ------------------------------------------------------------------ */
/*  Balón parado con forma de hoja                                     */
/* ------------------------------------------------------------------ */

/** Primer palo / segundo palo / penalti / 6 m / fuera, según el lado del saque. */
function zonaCaida(s: Saque, defensiva: boolean): string {
  if (!enArea(s.finX, s.finY)) return "Fuera";
  if (s.finX >= 94.2 && s.finY >= 36.8 && s.finY <= 63.2) return "6m";
  const cerca = s.y > 50 ? s.finY > 54.8 : s.finY < 45.2;
  const lejos = s.y > 50 ? s.finY < 45.2 : s.finY > 54.8;
  if (cerca) return defensiva ? "Primer palo" : "Primer Palo";
  if (lejos) return "Segundo Palo";
  return "Penalti";
}

function zonaRemate(r: Remate, lado: number, defensiva: boolean): string {
  if (!enArea(r.x, r.y)) return "Fuera de área";
  const cerca = lado > 50 ? r.y > 54.8 : r.y < 45.2;
  const lejos = lado > 50 ? r.y < 45.2 : r.y > 54.8;
  if (cerca) return defensiva ? "Primer Palo" : "1P";
  if (lejos) return defensiva ? "Segundo Palo" : "2P";
  return "Central";
}

/** «Falta lateral interior Z4», «Falta directa centrada Z3»: el vocabulario de la hoja (lib/abp/model.ts). */
function tipoFalta(x: number, y: number, directa: boolean): string {
  const d = ((100 - x) * 105) / 100;
  const z = Math.min(6, Math.max(1, Math.ceil(d / 9)));
  const centro = Math.abs(y - 50) <= 15;
  if (directa) return `Falta directa ${centro ? "centrada" : "perfilada"} Z${z}`;
  const perfil = centro ? "centrada" : y >= 21.1 && y <= 78.9 ? "interior" : "exterior";
  return `Falta lateral ${perfil} Z${z}`;
}

const PERFIL_GOLPEO: Record<string, string> = { Inswinger: "Cerrado", Outswinger: "Abierto", Straight: "Neutro" };

/** Las columnas «Fuente» y «Opta_*» que lleva cada fila con forma de hoja. */
function metaOpta(c: Contexto, parte: number, segundo: number, tipo: TipoEventoOpta): FilaHojaOpta {
  const v = videoDe(c, parte, segundo);
  return {
    Fuente: "Opta",
    Opta_Partido: c.p.partido,
    Opta_Fecha: c.p.fecha,
    Opta_Parte: String(parte),
    Opta_Segundo: String(Math.round(segundo)),
    Opta_Video: v.video ?? "",
    Opta_Tipo: tipo,
  };
}

/** Un córner o una falta al área, en la hoja de córners a favor (`nuestro`) o en contra. */
function filaAbp(c: Contexto, s: Saque, nuestro: boolean, directa: Remate | null): FilaHojaOpta {
  const defensiva = !nuestro;
  const remates = directa ? [directa] : s.remates;
  const todos = directa ? [directa] : [...s.remates, ...s.segundas];
  const gol = todos.some((r) => r.gol);
  const primero = remates[0] ?? null;
  const parte = directa?.parte ?? s.parte;
  const segundo = directa?.segundo ?? s.segundo;
  const m = marcadorEn(c, parte, segundo);
  const ladoY = directa ? directa.y : s.y;

  let resultado: string;
  if (gol) resultado = "Gol";
  else if (todos.length) resultado = "Ocasión";
  else {
    const i = indiceEn(c.ev, parte, segundo);
    const sigue = i < c.ev.length ? siguiente(c, i, s.teamId, 20, 2) : null;
    const otro = (t: string) => (nuestro ? !esCastilla(t) : esCastilla(t));
    if (sigue?.remate && otro(sigue.remate.teamId)) resultado = nuestro ? "Transición Rival" : sigue.remate.tipo === "Goal" ? "Gol RMCF" : "Transición Ofensiva";
    else if (sigue?.abpDe && !otro(sigue.abpDe)) resultado = "ABP";
    else resultado = "Nada";
  }

  const corto = !directa && (s.rosca === "Short" || metros(s.x, s.y, s.finX, s.finY) < 15);
  const tipoAccion = directa ? tipoFalta(directa.x, directa.y, true) : s.abp === "corner" ? "Córner" : tipoFalta(s.x, s.y, false);
  const xg = remates.reduce((a, r) => a + r.xG, 0);

  return {
    JORNADA: jornadaHoja(c.p.jornada),
    Rival: c.p.rival,
    Tiempo: String(parte),
    Minuto: minutoHoja(segundo),
    MINUTO: minutoHoja(segundo),
    "Resultado RMC": String(m.rmc),
    "Resultado RIVAL": String(m.rival),
    Sacador: corrigeNombre(directa ? directa.tirador : s.lanzador),
    Tipo_Accion: tipoAccion,
    Perfil_Golpeo: directa ? "" : (PERFIL_GOLPEO[s.rosca] ?? ""),
    Tipo_Envio: directa ? "" : corto ? "Corto" : "",
    Zona_Caida: directa || corto ? "" : zonaCaida(s, defensiva),
    Remate: remates.length ? "Sí" : "No",
    Rematador: primero ? corrigeNombre(primero.tirador) : "",
    Tipo_Remate: primero ? (primero.cuerpo === "Head" ? "Cabeza" : "Pie") : "No Remate",
    Zona_Remate: primero ? zonaRemate(primero, ladoY, defensiva) : "No Remate",
    xG: xg ? xg.toFixed(2) : "0",
    Resultado_Final: resultado,
    ...metaOpta(c, parte, segundo, directa ? "shots" : "passes"),
  };
}

/** Un saque de banda con forma de hoja (`Resultado_Final` absoluto: lo del rival lleva «Rival»). */
function filaBanda(c: Contexto, s: Saque, nuestro: boolean): FilaHojaOpta {
  const m = marcadorEn(c, s.parte, s.segundo);
  const i = indiceEn(c.ev, s.parte, s.segundo);
  const sigue = i < c.ev.length ? siguiente(c, i, s.teamId, TRANSICION) : null;
  const suf = (t: string) => (esCastilla(t) ? "" : " Rival");
  let resultado = "Nada";
  if (sigue?.remate) resultado = `${sigue.remate.tipo === "Goal" ? "Gol" : "Ocasión"}${suf(sigue.remate.teamId)}`;
  else if (sigue?.abpDe) resultado = `ABP${suf(sigue.abpDe)}`;
  else if (sigue) resultado = sigue.llego ? (esCastilla(sigue.quien) ? "Conquista de último tercio" : "Conquista último tercio Rival") : `Posicional${suf(sigue.quien)}`;

  const largo = metros(s.x, s.y, s.finX, s.finY) >= 15;
  const exterior = s.finY < 25 || s.finY > 75;
  const caida = enArea(s.finX, s.finY) ? "Area" : `${s.finX >= s.x ? "Progresión" : "Retroceso"} Carril ${exterior ? "Exterior" : "Interior"}`;
  const zona = s.x >= 66.7 ? 3 : s.x >= 33.3 ? 2 : 1;
  const receptorPuesto = s.receptor ? c.puesto.get(s.receptor) : undefined;
  const receptor = receptorPuesto === "Defender" ? "Primera linea" : receptorPuesto === "Midfielder" ? "Medios" : "";

  return {
    JORNADA: jornadaHoja(c.p.jornada),
    Rival: c.p.rival,
    Tiempo: `T${s.parte}`,
    Minuto: minutoHoja(s.segundo),
    "Resultado RMC": String(m.rmc),
    "Resultado RIVAL": String(m.rival),
    ...(nuestro ? { Sacador: corrigeNombre(s.lanzador) } : {}),
    Perfil: s.y > 50 ? "Izquierdo" : "Derecho",
    Zona_Saque: `Zona ${zona}`,
    Tipo_Envio: largo ? "Largo" : "Corto",
    Zona_Caida: caida,
    Receptor: receptor,
    Resultado_Final: resultado,
    ...metaOpta(c, s.parte, s.segundo, "passes"),
  };
}

/* ------------------------------------------------------------------ */
/*  Robos y pérdidas                                                   */
/* ------------------------------------------------------------------ */

const NOMBRE_ROBO: Record<string, string> = { BallRecovery: "Recuperación", Interception: "Interceptación", Tackle: "Entrada ganada" };
const NOMBRE_PERDIDA: Record<string, string> = { Pass: "Pase perdido", Dispossessed: "Robo en conducción", TakeOn: "Regate perdido" };

/** Lo primero que hace con el balón quien lo tiene (`de`): adelante, horizontal o atrás, despeje… */
function primeraAccion(c: Contexto, i: number, de: string, alPerder: Accion): { accion: Accion; quien: EventoDirecto | null } {
  const e = c.ev[i];
  for (let j = i + 1; j < c.ev.length; j++) {
    const x = c.ev[j];
    if (x.parte !== e.parte || x.segundo - e.segundo > 8) break;
    if (x.teamId !== de) {
      if (CON_BALON.has(x.tipo) || x.tipo === "Clearance") return { accion: alPerder, quien: null };
      continue;
    }
    if (x.tipo === "Clearance") return { accion: "DESPEJE", quien: x };
    if (x.tipo === "Pass") return { accion: (x.finX ?? x.x) - x.x >= 10 ? "ADELANTE" : "HORIZONTAL_ATRAS", quien: x };
    if (x.tipo === "TakeOn") return { accion: "ADELANTE", quien: x };
    if (x.tipo === "FreeKick") return { accion: alPerder, quien: null };
  }
  return { accion: alPerder, quien: null };
}

/**
 * En qué acaba la posesión de `de` que nace en `i` (robos.cjs, desenlaceDe).
 * `faltaSuya` / `faltaOtra`: cómo se llama la falta que recibe `de` y la que
 * hace (en los robos, FALTA_FAVOR / FALTA_CONTRA; en las pérdidas, al revés:
 * allí FALTA_FAVOR es la falta nuestra).
 */
function desenlace(c: Contexto, i: number, de: string, nombres: { recibe: string; hace: string; corta: string }) {
  const e = c.ev[i];
  let remate: EventoDirecto | null = null;
  let area = false;
  let ultimo = false;
  let pases = 0;
  let fin = e.segundo;
  let ultimoSuyo = e.segundo;
  let porQue = nombres.corta;
  let ultimoEv = e;
  for (let j = i + 1; j < c.ev.length; j++) {
    const x = c.ev[j];
    if (x.parte !== e.parte) break;
    if (x.segundo - e.segundo > 45) {
      porQue = "POSESION";
      break;
    }
    const enTransicion = x.segundo - e.segundo <= TRANSICION;
    if (x.tipo === "FreeKick") {
      const f = faltaEn(c.ev, j);
      fin = x.segundo;
      porQue = f.recibe?.teamId === de ? nombres.recibe : nombres.hace;
      break;
    }
    if (x.teamId === de) {
      if (x.saque || (x.tipo === "Corner" && x.ok)) {
        fin = x.segundo;
        porQue = "FUERA_SUYO";
        break;
      }
      if (["Aerial", "Challenge", "AttemptedTackle", "BallTouch", "Corner"].includes(x.tipo) && !esTiro(x)) continue;
      fin = x.segundo;
      ultimoSuyo = x.segundo;
      ultimoEv = x;
      if (x.tipo === "Pass" && enTransicion) pases++;
      if (esTiro(x) && enTransicion) {
        remate = x;
        break;
      }
      if (enTransicion && (enArea(x.x, x.y) || (x.ok && x.finX != null && x.finY != null && enArea(x.finX, x.finY)))) area = true;
      if (enTransicion && (x.x >= 66.7 || (x.ok && (x.finX ?? 0) >= 66.7))) ultimo = true;
      continue;
    }
    /* El otro: un duelo no rompe la posesión; tenerlo, sí. */
    if (x.saque || (x.tipo === "Corner" && x.ok)) {
      fin = x.segundo;
      porQue = "FUERA";
      break;
    }
    if (CON_BALON.has(x.tipo) || x.tipo === "Clearance" || x.tipo === "Save") {
      fin = x.segundo;
      porQue = nombres.corta;
      break;
    }
  }
  let d: string;
  if (remate) d = "REMATE";
  else if (area) d = "AREA";
  else if (ultimo) d = "ULTIMO_TERCIO";
  else if (ultimoSuyo - e.segundo > TRANSICION) d = "POSESION";
  else if (porQue === "FUERA_SUYO") d = "FUERA";
  else if (porQue === "POSESION") d = nombres.corta;
  else if (ultimoEv !== e && ultimoEv.tipo === "Pass" && c.puesto.get(ultimoEv.receptorId) === "Goalkeeper") d = "ATRAS_PORTERO";
  else d = porQue;
  return { desenlace: d, duracion: Math.max(0, Math.round((remate ? remate.segundo : fin) - e.segundo)), pases, remate };
}

function robosDe(c: Contexto, modo: "robos" | "perdidas"): RoboOpta[] {
  const salida: RoboOpta[] = [];
  let ultimo = -1e9;
  let ultimaParte = 0;
  c.ev.forEach((e, i) => {
    if (!esCastilla(e.teamId)) return;
    const es = modo === "robos" ? esRecuperacion(e) : esPerdida(e) && !e.saque && !c.saques.has(instante(e.parte, e.segundo));
    if (!es) return;
    if (e.parte === ultimaParte && e.segundo - ultimo < 4) return;
    ultimo = e.segundo;
    ultimaParte = e.parte;

    const rival = c.ev.slice(i + 1).find((x) => !esCastilla(x.teamId))?.teamId ?? "rival";
    const de = modo === "robos" ? CASTILLA_OPTA : rival;
    const { accion, quien } = primeraAccion(c, i, de, modo === "robos" ? "PERDIDA" : "RECUPERAMOS");
    const nombres =
      modo === "robos"
        ? { recibe: "FALTA_FAVOR", hace: "FALTA_CONTRA", corta: "PERDIDA" }
        : { recibe: "FALTA_CONTRA", hace: "FALTA_FAVOR", corta: "RECUPERAMOS" };
    const d = desenlace(c, i, de, nombres);
    const zona = tercio(e.x);
    const car = carril(e.y);
    const quienEs = c.nombre.get(e.jugadorId) ?? "";
    const tipo = (modo === "robos" ? NOMBRE_ROBO : NOMBRE_PERDIDA)[e.tipo] ?? e.tipo;
    const sigue = quien && quien.jugadorId && quien.jugadorId !== e.jugadorId ? c.nombre.get(quien.jugadorId) : "";
    const acaba = d.remate ? `acaba en remate${c.nombre.get(d.remate.jugadorId) ? ` de ${c.nombre.get(d.remate.jugadorId)}` : ""}` : `acaba en ${d.desenlace.toLowerCase().replace(/_/g, " ")}`;
    const detalle = [`${relojOpta(e.parte, e.segundo)} · ${tipo}${quienEs ? ` de ${quienEs}` : ""} en ${zona} ${porCarril(car)}`, sigue ? `sigue ${sigue}` : "", acaba]
      .filter(Boolean)
      .join(", ");
    const confianza: Confianza = modo === "robos" && accion === "PERDIDA" && d.duracion <= 1 && d.pases === 0 ? "baja" : modo === "perdidas" && e.tipo === "Pass" && (e.finX == null || e.finY == null) ? "media" : "alta";
    salida.push({
      seg: Math.round(e.segundo),
      zona,
      carril: car,
      accion,
      desenlace: d.desenlace,
      duracion: d.duracion,
      pases: String(d.pases),
      detalle,
      confianza,
      ...(quienEs ? { jugador: quienEs } : {}),
      bloque: `opta-${e.parte}`,
      fuente: "opta",
      ...videoDe(c, e.parte, e.segundo),
    });
  });
  return salida;
}

/* ------------------------------------------------------------------ */
/*  Faltas                                                             */
/* ------------------------------------------------------------------ */

function distanciaFalta(x: number, y: number) {
  const d = aGol(x, y);
  if (d <= 25 && Math.abs(y - 50) <= 28.9) return "frontal";
  return d <= 40 ? "media" : "lejana";
}

function faltasDe(c: Contexto): FaltaOpta[] {
  const salida: FaltaOpta[] = [];
  const vistas = new Set<string>();
  c.ev.forEach((e, i) => {
    if (e.tipo !== "FreeKick") return;
    const k = `${e.parte}|${Math.round(e.segundo)}`;
    if (vistas.has(k) || vistas.has(`${e.parte}|${Math.round(e.segundo) - 1}`)) return;
    vistas.add(k);
    const { recibe, hace } = faltaEn(c.ev, i);
    const saca = recibe ?? null;
    if (!saca && !hace) return;
    const aFavor = saca ? esCastilla(saca.teamId) : !esCastilla(hace!.teamId);
    /* El sitio, hacia la portería que ataca quien saca la falta. */
    const x = saca ? saca.x : 100 - hace!.x;
    const y = saca ? saca.y : 100 - hace!.y;
    const nuestro = aFavor ? saca : hace;
    const suyo = aFavor ? hace : saca;
    const nNuestro = nuestro ? c.nombre.get(nuestro.jugadorId) : undefined;
    const nSuyo = suyo ? c.nombre.get(suyo.jugadorId) : undefined;
    const comete = aFavor ? nSuyo : nNuestro;
    const sobre = aFavor ? nNuestro : nSuyo;
    const delQue = aFavor ? c.p.rival : "Castilla";
    const nota = [`T${e.parte} min ${minutoDe(e.segundo)}.`, comete ? `Falta de ${comete} (del ${delQue})${sobre ? ` sobre ${sobre}` : ""}.` : ""].filter(Boolean).join(" ");
    salida.push({
      clip: `opta-${aFavor ? "of" : "def"}-${e.parte}-${Math.round(e.segundo)}`,
      lado: aFavor ? "ofensivo" : "defensivo",
      zona: tercio(x),
      carril: carril(y),
      distancia: distanciaFalta(x, y),
      entre: null,
      minuto: relojOpta(e.parte, e.segundo),
      nota,
      ...(nNuestro ? { jugador: nNuestro } : {}),
      fuente: "opta",
      ...videoDe(c, e.parte, e.segundo),
    });
  });
  return salida;
}

/* ------------------------------------------------------------------ */
/*  Todo                                                               */
/* ------------------------------------------------------------------ */

export function calculaRespaldo(d: DocsRespaldo): RespaldoOpta {
  const partidos = partidosCastilla(d.partidos, d.directos);
  const pista = pistaDe(...d.jugadores.map((t) => aObjetos(t)));
  const remates = rematesDe(d.remates, pista);
  const saques = saquesDe(d.abpEventos, remates, pista);

  const salida: RespaldoOpta = {
    generado: new Date().toISOString(),
    partidos,
    abpFavor: [],
    abpContra: [],
    bandaFavor: [],
    bandaContra: [],
    transiciones: [],
    faltas: [],
  };

  for (const p of partidos) {
    const directo = d.directos[p.partido];
    const ev = leeEventos(directo?.eventos).sort((a, b) => a.parte - b.parte || a.segundo - b.segundo);
    const jugadores: JugadorDirecto[] = leeJugadores(directo?.jugadores);
    const suyosSaques = saques.filter((s) => s.partido === p.partido);
    const suyosRemates = remates.filter((r) => r.partido === p.partido);
    const c: Contexto = {
      p,
      ev,
      nombre: new Map(jugadores.map((j) => [j.id, j.nombre])),
      puesto: new Map([...jugadores.map((j) => [j.id, j.puesto] as const), ...jugadores.map((j) => [j.nombre, j.puesto] as const)]),
      goles: suyosRemates.filter((r) => r.gol).map((r) => ({ parte: r.parte, segundo: r.segundo, nuestro: esCastilla(r.teamId) })),
      saques: new Set(suyosSaques.flatMap((s) => [instante(s.parte, s.segundo), instante(s.parte, s.segundo + 1), instante(s.parte, s.segundo - 1)])),
      clips: d.clips,
    };

    for (const s of suyosSaques) {
      const nuestro = esCastilla(s.teamId);
      if (s.abp === "banda") (nuestro ? salida.bandaFavor : salida.bandaContra).push(filaBanda(c, s, nuestro));
      else if (s.abp === "corner") (nuestro ? salida.abpFavor : salida.abpContra).push(filaAbp(c, s, nuestro, null));
      else if (s.abp === "falta") {
        /* En la hoja sólo van las faltas de ataque cerca del área (Z1-Z6, ≤ 54 m de la línea de fondo) que se cuelgan o acaban en remate. */
        const cerca = (100 - s.x) * 1.05 <= 54;
        if (cerca && (enArea(s.finX, s.finY) || s.remates.length > 0)) (nuestro ? salida.abpFavor : salida.abpContra).push(filaAbp(c, s, nuestro, null));
      }
    }
    for (const r of suyosRemates) {
      if (r.situacion !== "Direct Free Kick") continue;
      const nuestro = esCastilla(r.teamId);
      const falso: Saque = {
        partido: r.partido, fecha: r.fecha, teamId: r.teamId, equipo: r.equipo, rivalId: r.rivalId, rival: r.rival, abp: "falta", parte: r.parte, segundo: r.segundo,
        minuto: r.minuto, secuencia: r.secuencia, lanzador: r.tirador, receptor: "", x: r.x, y: r.y, finX: r.x, finY: r.y, completo: false, rosca: "", marcador: r.marcador, remates: [r], segundas: [],
      };
      (nuestro ? salida.abpFavor : salida.abpContra).push(filaAbp(c, falso, nuestro, r));
    }

    if (!ev.length) continue;

    const base = {
      id: `opta-j${String(p.jornada).padStart(2, "0")}-${slug(p.rival)}`,
      jornada: `J${p.jornada}`,
      rival: p.rival,
      local: p.local ?? false,
      fecha: p.fecha,
      resultado: resultadoDe(p),
      fuente: "opta" as const,
      optaPartido: p.partido,
    };
    const duracion = Math.round(Math.max(...ev.map((e) => e.segundo)));

    salida.transiciones.push({
      ...base,
      video: "",
      segundosVideo: duracion,
      bloquesTotales: 0,
      bloquesCerrados: 0,
      segundosRevisados: 0,
      notas: ["Sale del evento a evento de Opta: el partido aún no está etiquetado en Hudl. El minuto es el del reloj de Opta."],
      goles: c.goles.map((g) => ({ seg: Math.round(g.segundo), de: g.nuestro ? ("castilla" as const) : ("rival" as const), texto: g.nuestro ? "Gol del Castilla" : `Gol del ${p.rival}` })),
      robos: robosDe(c, "robos"),
      perdidas: robosDe(c, "perdidas"),
    } satisfies PartidoTransicionesOpta);

    salida.faltas.push({
      ...base,
      clips: "Opta · evento a evento",
      notas: [
        "Sale del evento a evento de Opta: el partido aún no está etiquetado en Hudl. Zona, carril y distancia, del punto de la falta; quién la hace y sobre quién, del registro de Opta.",
        "El campo se cuenta siempre hacia la portería que ataca quien saca la falta.",
      ],
      faltas: faltasDe(c),
    } satisfies PartidoFaltasOpta);
  }

  return salida;
}

/** Cada acción de esas pantallas con su instante: lo que baja el script de vídeo. */
export function accionesParaVideo(r: RespaldoOpta): AccionVideoOpta[] {
  const fecha = new Map(r.partidos.map((p) => [p.partido, p.fecha]));
  const salida = new Map<string, AccionVideoOpta>();
  const pon = (a: AccionVideoOpta) => {
    const k = claveVideo(a.partido, a.parte, a.segundo);
    if (!salida.has(k)) salida.set(k, a);
  };
  const hojas: [FilaHojaOpta[], string][] = [
    [r.abpFavor, "ABP a favor"],
    [r.abpContra, "ABP en contra"],
    [r.bandaFavor, "Banda a favor"],
    [r.bandaContra, "Banda en contra"],
  ];
  for (const [filas, que] of hojas)
    for (const f of filas)
      pon({ partido: f.Opta_Partido, fecha: f.Opta_Fecha, parte: Number(f.Opta_Parte), segundo: Number(f.Opta_Segundo), tipo: /directa/i.test(f.Tipo_Accion ?? "") ? "Shot" : "Pass", que });
  for (const p of r.transiciones) {
    const parte = (x: RoboOpta) => Number(x.bloque.replace("opta-", "")) || 1;
    for (const x of p.robos) pon({ partido: p.optaPartido, fecha: fecha.get(p.optaPartido) ?? p.fecha, parte: parte(x), segundo: x.seg, tipo: "BallRecovery", que: "Robo" });
    for (const x of p.perdidas) pon({ partido: p.optaPartido, fecha: fecha.get(p.optaPartido) ?? p.fecha, parte: parte(x), segundo: x.seg, tipo: "Pass", que: "Pérdida" });
  }
  for (const p of r.faltas)
    for (const f of p.faltas) {
      const [, , parte, seg] = f.clip.split("-");
      pon({ partido: p.optaPartido, fecha: p.fecha, parte: Number(parte), segundo: Number(seg), tipo: "Foul", que: "Falta" });
    }
  return [...salida.values()];
}
