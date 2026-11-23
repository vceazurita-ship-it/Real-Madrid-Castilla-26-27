/**
 * SUS SOCIEDADES EN EL ÚLTIMO TERCIO: EL TRÍO QUE MÁS SE ASOCIA
 * (Scout colectivo, 23/11/2026, idea de X).
 *
 * Con el evento a evento de Opta (`opta:directo:<partido>`) de los últimos
 * partidos del rival:
 *
 * - Red de pases sólo en el último tercio: pase en juego completado del rival
 *   (sin saques de banda ni de puerta) que acaba con x ≥ 66 (Opta x 0-100 =
 *   105 m, atacando hacia x = 100).
 * - Receptor: quien hace el siguiente evento del mismo equipo en la misma
 *   parte y en los 8 s siguientes (si es el mismo que pasa o no hay, el que
 *   Opta apunta como receptor; si tampoco, el pase no cuenta).
 * - Posición media de cada jugador: la media de dónde da sus pases y dónde
 *   recibe los suyos, de esos pases.
 * - La sociedad: el trío con más pases entre sus tres parejas (entre los 12
 *   jugadores con más pases en la red); se suma un cuarto si da o recibe con
 *   ellos al menos un tercio de lo que se pasan los tres entre sí.
 * - Carril donde más se juntan: el del destino de los pases entre ellos,
 *   visto desde el rival que ataca: izquierda y > 66,7, derecha y < 33,3.
 * - Remates que nacen de una cadena con al menos dos de ellos: para cada
 *   remate del rival, sus eventos de los 15 s de antes en la misma parte,
 *   hasta que el contrario gana el balón; cuenta si entre esos jugadores (y
 *   quien remata) hay dos o más de la sociedad.
 *
 * Funciones puras: ni una cifra de Opta aquí (el repositorio es público).
 */

import { esPaseEnJuego, type EventoDirecto } from "@/lib/opta-directo-mapas";

export const X_TERCIO = 66;
export const VENTANA_RECEPTOR_S = 8;
export const VENTANA_CADENA_S = 15;
export const MAX_PARTIDOS = 8;
/** Con menos pases entre ellos no se enseña el bloque. */
export const MIN_PASES_SOCIEDAD = 8;

export type Carril = "izquierda" | "centro" | "derecha";
export const CARRILES: Carril[] = ["izquierda", "centro", "derecha"];
export const carrilDe = (y: number): Carril => (y > 66.7 ? "izquierda" : y < 33.3 ? "derecha" : "centro");

const TIROS = new Set(["Goal", "Miss", "AttemptSaved", "Post"]);
/** El contrario se queda el balón: corta la cadena. */
const CORTA = new Set(["Pass", "BallRecovery", "Interception", "Clearance", "Claim", "KeeperPickup", "Punch", "BlockedPass"]);
/** Lo que no es tocar el balón (no sirve como «siguiente evento» del receptor). */
const NO_TOCA = new Set(["Foul", "Challenge", "AttemptedTackle", "Card", "SubstitutionOn", "SubstitutionOff"]);

export type PartidoSociedad = { partido: string; eventos: EventoDirecto[] };

export type NodoSociedad = { id: string; x: number; y: number; pases: number; recibe: number };
export type EnlaceSociedad = { a: string; b: string; n: number };

export type Sociedades = {
  partidos: number;
  /** Pases del rival en la red del último tercio. */
  pases: number;
  nodos: NodoSociedad[];
  enlaces: EnlaceSociedad[];
  /** La sociedad: 3 o 4 jugadores, de más a menos conectado. */
  grupo: string[];
  /** Pases entre los del grupo. */
  pasesGrupo: number;
  /** Pases entre ellos por carril del destino. */
  porCarril: Record<Carril, number>;
  carril: Carril;
  remates: number;
  rematesCadena: number;
  xg: number;
  xgCadena: number;
};

const clave = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

/** Quién recibe el pase `ev[i]`. */
function receptorDe(ev: EventoDirecto[], i: number): string {
  const p = ev[i];
  for (let k = i + 1; k < ev.length; k++) {
    const o = ev[k];
    if (o.parte !== p.parte || o.segundo - p.segundo > VENTANA_RECEPTOR_S) break;
    if (o.teamId !== p.teamId || NO_TOCA.has(o.tipo) || !o.jugadorId) continue;
    if (o.jugadorId !== p.jugadorId) return o.jugadorId;
    break;
  }
  return p.receptorId && p.receptorId !== p.jugadorId ? p.receptorId : "";
}

/** Los jugadores del rival en la cadena que acaba en el remate `ev[i]` (con quien remata). */
function cadenaDe(ev: EventoDirecto[], i: number): Set<string> {
  const t = ev[i];
  const suyos = new Set<string>(t.jugadorId ? [t.jugadorId] : []);
  for (let k = i - 1; k >= 0; k--) {
    const o = ev[k];
    if (o.parte !== t.parte || t.segundo - o.segundo > VENTANA_CADENA_S) break;
    if (o.teamId !== t.teamId) {
      if (CORTA.has(o.tipo) || (o.tipo === "Tackle" && o.ok)) break;
      continue;
    }
    if (o.jugadorId && !NO_TOCA.has(o.tipo)) suyos.add(o.jugadorId);
  }
  return suyos;
}

export function sociedades(partidos: PartidoSociedad[], teamId: string): Sociedades | null {
  const sitio = new Map<string, { sx: number; sy: number; n: number; pases: number; recibe: number }>();
  const suma = (id: string, x: number, y: number, pase: boolean) => {
    const s = sitio.get(id) ?? { sx: 0, sy: 0, n: 0, pases: 0, recibe: 0 };
    s.sx += x;
    s.sy += y;
    s.n += 1;
    if (pase) s.pases += 1;
    else s.recibe += 1;
    sitio.set(id, s);
  };
  const enlaces = new Map<string, EnlaceSociedad>();
  /** Destino de cada pase entre una pareja, para el carril. */
  const destinos = new Map<string, number[]>();
  let pases = 0;
  let leidos = 0;
  const tiros: { cadena: Set<string>; xg: number }[] = [];

  for (const p of partidos) {
    const ev = p.eventos;
    if (!ev.some((e) => e.teamId === teamId)) continue;
    leidos += 1;
    ev.forEach((e, i) => {
      if (e.teamId !== teamId) return;
      if (TIROS.has(e.tipo)) {
        tiros.push({ cadena: cadenaDe(ev, i), xg: e.xG ?? 0 });
        return;
      }
      if (!esPaseEnJuego(e) || !e.ok || e.finX == null || e.finY == null || e.finX < X_TERCIO || !e.jugadorId) return;
      const r = receptorDe(ev, i);
      if (!r) return;
      pases += 1;
      suma(e.jugadorId, e.x, e.y, true);
      suma(r, e.finX, e.finY, false);
      const k = clave(e.jugadorId, r);
      const en = enlaces.get(k) ?? { a: e.jugadorId < r ? e.jugadorId : r, b: e.jugadorId < r ? r : e.jugadorId, n: 0 };
      en.n += 1;
      enlaces.set(k, en);
      const d = destinos.get(k) ?? [];
      d.push(e.finY);
      destinos.set(k, d);
    });
  }
  if (!leidos || !pases) return null;

  const nodos: NodoSociedad[] = [...sitio.entries()].map(([id, s]) => ({ id, x: s.sx / s.n, y: s.sy / s.n, pases: s.pases, recibe: s.recibe }));
  const n = (a: string, b: string) => enlaces.get(clave(a, b))?.n ?? 0;

  /* El mejor trío, entre los 12 con más pases en la red. */
  const candidatos = [...nodos].sort((a, b) => b.pases + b.recibe - (a.pases + a.recibe)).slice(0, 12).map((x) => x.id);
  let mejor: string[] = [];
  let tope = 0;
  for (let i = 0; i < candidatos.length; i++)
    for (let j = i + 1; j < candidatos.length; j++)
      for (let k = j + 1; k < candidatos.length; k++) {
        const [a, b, c] = [candidatos[i], candidatos[j], candidatos[k]];
        const total = n(a, b) + n(a, c) + n(b, c);
        if (total > tope) {
          tope = total;
          mejor = [a, b, c];
        }
      }
  if (mejor.length < 3 || tope < MIN_PASES_SOCIEDAD) return null;

  /* ¿Un cuarto? */
  let cuarto = "";
  let conCuarto = 0;
  for (const id of candidatos) {
    if (mejor.includes(id)) continue;
    const s = mejor.reduce((t, m) => t + n(id, m), 0);
    if (s > conCuarto) {
      conCuarto = s;
      cuarto = id;
    }
  }
  const grupo = cuarto && conCuarto * 3 >= tope ? [...mejor, cuarto] : mejor;
  const peso = (id: string) => grupo.reduce((t, m) => t + (m === id ? 0 : n(id, m)), 0);
  grupo.sort((a, b) => peso(b) - peso(a));

  const porCarril = Object.fromEntries(CARRILES.map((c) => [c, 0])) as Record<Carril, number>;
  let pasesGrupo = 0;
  for (let i = 0; i < grupo.length; i++)
    for (let j = i + 1; j < grupo.length; j++) {
      const k = clave(grupo[i], grupo[j]);
      for (const y of destinos.get(k) ?? []) {
        porCarril[carrilDe(y)] += 1;
        pasesGrupo += 1;
      }
    }
  const carril = CARRILES.reduce((a, b) => (porCarril[b] > porCarril[a] ? b : a));

  const enGrupo = new Set(grupo);
  let rematesCadena = 0;
  let xg = 0;
  let xgCadena = 0;
  for (const t of tiros) {
    xg += t.xg;
    const dentro = [...t.cadena].filter((id) => enGrupo.has(id)).length;
    if (dentro >= 2) {
      rematesCadena += 1;
      xgCadena += t.xg;
    }
  }

  return {
    partidos: leidos,
    pases,
    nodos,
    enlaces: [...enlaces.values()],
    grupo,
    pasesGrupo,
    porCarril,
    carril,
    remates: tiros.length,
    rematesCadena,
    xg,
    xgCadena,
  };
}
