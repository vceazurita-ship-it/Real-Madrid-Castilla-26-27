/**
 * AMPLITUD POR BANDA (Scout colectivo, 18/11/2026; idea de X: «si su extremo
 * se mete dentro, ¿quién le da la amplitud por esa banda?»).
 *
 * Con el evento a evento de Opta de sus partidos (`opta:directo:<partido>`):
 * los toques del rival en el último tercio por el carril exterior (x > 66 e
 * y < 20, su banda derecha, o y > 80, su izquierda; la y de Opta tiene el 0 en
 * la banda DERECHA del que ataca) y de quién son.
 *
 * El extremo y el lateral de cada banda salen del once de CADA partido: entre
 * los titulares con toques bastantes, el lateral es el defensa (puesto de Opta
 * «Defender») que más abierto juega por ese lado y el extremo, el de más
 * arriba (centrocampista o delantero) que más abierto juega por ese lado;
 * «más abierto» = su y media, y tiene que caer en el tercio de esa banda. Si
 * el titular se va antes del final, quien entra con el mismo puesto y por el
 * mismo lado hereda el papel. El resto de toques del carril son «otros».
 *
 * Funciones puras: ni una cifra aquí (el repositorio es público).
 */

import { esToque, type EventoDirecto, type JugadorDirecto } from "@/lib/opta-directo-mapas";

/** Último tercio. */
export const X_MIN = 66;
/** Carril exterior: y < 20 (su derecha) o y > 80 (su izquierda). */
export const Y_DERECHA = 20;
export const Y_IZQUIERDA = 80;
/** Si el lateral se lleva más de esta parte de los toques, él da la amplitud. */
export const UMBRAL_LATERAL = 0.5;
/** Partidos más recientes que se leen (cada uno pesa ~0,3 MB). */
export const MAX_PARTIDOS = 8;
/** Toques mínimos en el partido para fiarse de la y media de un jugador. */
const MIN_TOQUES = 10;
/** La y media tiene que caer en el tercio de su banda. */
const TERCIO = 100 / 3;

export type Lado = "derecha" | "izquierda";
export type Rol = "extremo" | "lateral" | "otro";

export type ToqueBanda = { x: number; y: number; lado: Lado; rol: Rol; jugadorId: string; nombre: string; partido: string; minuto: number };

export type PartidoBanda = { partido: string; fecha: string; eventos: EventoDirecto[]; jugadores: JugadorDirecto[] };

export type Quien = { nombre: string; toques: number };

export type Banda = {
  lado: Lado;
  total: number;
  extremo: number;
  lateral: number;
  otros: number;
  /** Partes del total (0-1). */
  pctExtremo: number;
  pctLateral: number;
  /** Quién ha hecho de extremo / lateral en esa banda, de más a menos toques en el carril. */
  extremos: Quien[];
  laterales: Quien[];
  /** El lateral se lleva más de la mitad de los toques del carril. */
  daLateral: boolean;
};

export type AmplitudBanda = { partidos: number; derecha: Banda; izquierda: Banda; toques: ToqueBanda[] };

const DEFENSA = "Defender";
const PORTERO = "Goalkeeper";
const esDeArriba = (p: string) => p !== DEFENSA && p !== PORTERO && p !== "" && p !== "Substitute";

const lado = (y: number): Lado | null => (y < Y_DERECHA ? "derecha" : y > Y_IZQUIERDA ? "izquierda" : null);

/** Lo abierto que juega por un lado: cuanto más, mejor (derecha = y baja). */
const apertura = (yMedia: number, l: Lado) => (l === "derecha" ? TERCIO - yMedia : yMedia - (100 - TERCIO));

/** Los papeles de un partido: jugadorId → (lado, rol). */
function papeles(p: PartidoBanda, teamId: string): Map<string, { lado: Lado; rol: Exclude<Rol, "otro"> }> {
  const suma = new Map<string, { s: number; n: number }>();
  for (const e of p.eventos) {
    if (e.teamId !== teamId || !e.jugadorId || !esToque(e)) continue;
    const a = suma.get(e.jugadorId) ?? { s: 0, n: 0 };
    a.s += e.y;
    a.n += 1;
    suma.set(e.jugadorId, a);
  }
  const yMedia = (id: string) => {
    const a = suma.get(id);
    return a && a.n >= MIN_TOQUES ? a.s / a.n : null;
  };
  const suyos = p.jugadores.filter((j) => j.teamId === teamId && j.id);
  const titulares = suyos.filter((j) => j.titular);
  const suplentes = suyos.filter((j) => !j.titular && j.minutos > 0);
  const salida = new Map<string, { lado: Lado; rol: Exclude<Rol, "otro"> }>();

  for (const l of ["derecha", "izquierda"] as Lado[])
    for (const rol of ["lateral", "extremo"] as const) {
      const vale = (j: JugadorDirecto) => (rol === "lateral" ? j.puesto === DEFENSA : esDeArriba(j.puesto));
      let mejor: { j: JugadorDirecto; a: number } | null = null;
      for (const j of titulares) {
        if (!vale(j) || salida.has(j.id)) continue;
        const y = yMedia(j.id);
        if (y == null) continue;
        const a = apertura(y, l);
        if (a > 0 && (!mejor || a > mejor.a)) mejor = { j, a };
      }
      if (!mejor) continue;
      salida.set(mejor.j.id, { lado: l, rol });
      /* Si se fue antes del final, el que entra con su puesto y por su lado hereda el papel. */
      if (mejor.j.minutos < 85)
        for (const s of suplentes) {
          if (salida.has(s.id) || s.puesto !== mejor.j.puesto) continue;
          const y = yMedia(s.id) ?? (suma.get(s.id)?.n ? suma.get(s.id)!.s / suma.get(s.id)!.n : null);
          if (y != null && apertura(y, l) > 0) salida.set(s.id, { lado: l, rol });
        }
    }
  return salida;
}

function banda(l: Lado, toques: ToqueBanda[]): Banda {
  const suyos = toques.filter((t) => t.lado === l);
  const cuenta = (r: Rol) => suyos.filter((t) => t.rol === r).length;
  const quienes = (r: Rol): Quien[] => {
    const m = new Map<string, Quien>();
    for (const t of suyos)
      if (t.rol === r) {
        const q = m.get(t.jugadorId) ?? { nombre: t.nombre, toques: 0 };
        q.toques += 1;
        m.set(t.jugadorId, q);
      }
    return [...m.values()].sort((a, b) => b.toques - a.toques);
  };
  const total = suyos.length;
  const extremo = cuenta("extremo");
  const lateral = cuenta("lateral");
  return {
    lado: l,
    total,
    extremo,
    lateral,
    otros: total - extremo - lateral,
    pctExtremo: total ? extremo / total : 0,
    pctLateral: total ? lateral / total : 0,
    extremos: quienes("extremo"),
    laterales: quienes("lateral"),
    daLateral: total > 0 && lateral / total > UMBRAL_LATERAL,
  };
}

export function amplitudBanda(partidos: PartidoBanda[], teamId: string): AmplitudBanda | null {
  const toques: ToqueBanda[] = [];
  let conDatos = 0;
  for (const p of partidos) {
    const roles = papeles(p, teamId);
    const nombres = new Map(p.jugadores.map((j) => [j.id, j.nombre]));
    let alguno = false;
    for (const e of p.eventos) {
      if (e.teamId !== teamId || !esToque(e) || e.x <= X_MIN) continue;
      const l = lado(e.y);
      if (!l) continue;
      alguno = true;
      const papel = roles.get(e.jugadorId);
      toques.push({
        x: e.x,
        y: e.y,
        lado: l,
        rol: papel && papel.lado === l ? papel.rol : "otro",
        jugadorId: e.jugadorId,
        nombre: nombres.get(e.jugadorId) ?? "",
        partido: p.partido,
        minuto: e.minuto,
      });
    }
    if (alguno) conDatos += 1;
  }
  if (!toques.length) return null;
  return { partidos: conDatos, derecha: banda("derecha", toques), izquierda: banda("izquierda", toques), toques };
}
