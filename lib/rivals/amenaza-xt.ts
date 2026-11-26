/**
 * QUIÉN CREA LA AMENAZA DEL RIVAL (Plantillas rivales, 26/11/2026, idea de X).
 *
 * Con el evento a evento de Opta (`opta:directo:<partido>`) de los partidos
 * del rival que tiene el archivo:
 *
 * - xT de cada acción = xT(destino) − xT(origen) en la rejilla de amenaza
 *   esperada (12 × 8 celdas sobre la x/y de Opta, 0-100 hacia la portería
 *   rival). La rejilla es la pública de Karun Singh (2018, «Introducing
 *   Expected Threat»), simétrica a lo ancho; no es dato de Opta.
 * - Pase: los acertados en juego (`esPaseEnJuego`, sin saques de banda ni de
 *   puerta), del punto del pase a su `finX/finY`.
 * - Conducción: Opta no la da como evento. Se saca de dónde le llega el balón
 *   a un jugador (el final del pase acertado de un compañero que le llega, o
 *   su propia acción anterior: recuperación, intercepción, regate…) a dónde
 *   hace su siguiente acción, en la misma parte, del mismo equipo, a 10 s como
 *   mucho y con 5 m o más de recorrido.
 * - La suma es neta (un pase hacia atrás resta) y va por 90 minutos jugados
 *   en ESOS partidos.
 *
 * Al lado, con los mismos partidos y minutos: xG sin penaltis/90 (sus remates
 * en `opta:remates` sin los de penalti) y xA/90 (`xA` de
 * `opta:jugadores-partidos`).
 *
 * Funciones puras: ni una cifra de Opta aquí (el repositorio es público).
 */

import { esPaseEnJuego, esToque, type EventoDirecto, type JugadorDirecto } from "@/lib/opta-directo-mapas";

/** Partidos más recientes del archivo que se leen como mucho. */
export const MAX_PARTIDOS_XT = 12;
/** Minutos mínimos para entrar en el ranking (con menos, el /90 engaña). */
export const MIN_MINUTOS_XT = 270;
/** Jornadas recientes del equipo que se miran para el aviso de «no está». */
export const JORNADAS_AVISO = 3;
/** Conducción: hueco máximo entre recibir y la siguiente acción, y recorrido mínimo. */
export const CONDUCCION_MAX_S = 10;
export const CONDUCCION_MIN_M = 5;

/*
 * Rejilla xT de Karun Singh (12 columnas a lo largo, de su portería a la
 * contraria; 8 filas a lo ancho). Valores públicos, redondeados a 4 decimales;
 * simétrica, así que da igual por qué banda se cuente la y.
 */
const MITAD: number[][] = [
  [0.0064, 0.0078, 0.0084, 0.0098, 0.0113, 0.0125, 0.0147, 0.0175, 0.0212, 0.0276, 0.0349, 0.0379],
  [0.0075, 0.0088, 0.0094, 0.0106, 0.0121, 0.0138, 0.0161, 0.0187, 0.024, 0.0295, 0.0407, 0.0465],
  [0.0089, 0.0098, 0.01, 0.0111, 0.0127, 0.0143, 0.0169, 0.0194, 0.0241, 0.0286, 0.0549, 0.0644],
  [0.0094, 0.0108, 0.0102, 0.0113, 0.0126, 0.0148, 0.0169, 0.02, 0.0239, 0.0351, 0.1081, 0.2575],
];
export const REJILLA_XT: number[][] = [...MITAD, ...[...MITAD].reverse()];

/** xT de un punto de Opta (x, y en 0-100). */
export function xtEn(x: number, y: number): number {
  const c = Math.min(11, Math.max(0, Math.floor((x / 100) * 12)));
  const f = Math.min(7, Math.max(0, Math.floor((y / 100) * 8)));
  return REJILLA_XT[f][c];
}

const metros = (x1: number, y1: number, x2: number, y2: number) => Math.hypot(((x2 - x1) / 100) * 105, ((y2 - y1) / 100) * 68);

const NO_TOCA = new Set(["Foul", "Challenge", "AttemptedTackle", "Card", "SubstitutionOn", "SubstitutionOff", "Clearance"]);

export type PartidoXT = { partido: string; eventos: EventoDirecto[]; jugadores: JugadorDirecto[] };

export type AmenazaPorJugador = { pases: number; conducciones: number; nPases: number; nConducciones: number };

/** xT neto de pases y conducciones de cada jugador de `teamId` en un partido. */
export function amenazaDelPartido(p: PartidoXT, teamId: string): Map<string, AmenazaPorJugador> {
  const salida = new Map<string, AmenazaPorJugador>();
  const de = (id: string) => {
    let a = salida.get(id);
    if (!a) salida.set(id, (a = { pases: 0, conducciones: 0, nPases: 0, nConducciones: 0 }));
    return a;
  };
  const ev = [...p.eventos].sort((a, b) => a.parte - b.parte || a.segundo - b.segundo);
  for (let i = 0; i < ev.length; i++) {
    const e = ev[i];
    if (e.teamId !== teamId || !e.jugadorId) continue;

    /* Pase acertado en juego. */
    if (esPaseEnJuego(e) && e.ok && e.finX != null && e.finY != null) {
      const a = de(e.jugadorId);
      a.pases += xtEn(e.finX, e.finY) - xtEn(e.x, e.y);
      a.nPases++;
    }

    /* Conducción hasta esta acción: de dónde le llegó el balón. */
    const prev = ev[i - 1];
    if (!prev || prev.teamId !== teamId || prev.parte !== e.parte || e.segundo - prev.segundo > CONDUCCION_MAX_S) continue;
    if (!esToque(e) || NO_TOCA.has(e.tipo) || e.saque) continue;
    let origen: { x: number; y: number } | null = null;
    if (prev.tipo === "Pass" && prev.ok && prev.receptorId === e.jugadorId && prev.finX != null && prev.finY != null) origen = { x: prev.finX, y: prev.finY };
    else if (prev.jugadorId === e.jugadorId && prev.tipo !== "Pass" && esToque(prev) && !NO_TOCA.has(prev.tipo)) origen = { x: prev.x, y: prev.y };
    if (!origen || metros(origen.x, origen.y, e.x, e.y) < CONDUCCION_MIN_M) continue;
    const a = de(e.jugadorId);
    a.conducciones += xtEn(e.x, e.y) - xtEn(origen.x, origen.y);
    a.nConducciones++;
  }
  return salida;
}

export type FilaPartidoJugador = { partido: string; playerId: string; jugador: string; minutos: number; xA: number };
export type RemateXT = { partido: string; tiradorId: string; xG: number; penalti: boolean };

export type AmenazaJugador = {
  playerId: string;
  jugador: string;
  minutos: number;
  /** Partidos que jugó de los leídos. */
  partidos: number;
  xt90: number;
  xtPases90: number;
  xtConducciones90: number;
  npxg90: number;
  xa90: number;
  /** Penaltis que tiró en esos partidos (los que se le quitan al xG). */
  penaltis: number;
  /** No ha jugado ninguna de las últimas `JORNADAS_AVISO` jornadas del equipo. */
  ausente: boolean;
};

/**
 * El ranking: por xT/90, con xG sin penaltis/90 y xA/90 de los mismos
 * partidos. `ultimos` son los ids de las últimas jornadas del equipo (en
 * cualquier fuente de Opta) para el aviso; `jugaron` dice quién tuvo minutos
 * en cada una.
 */
export function rankingAmenaza(
  partidos: PartidoXT[],
  teamId: string,
  filas: FilaPartidoJugador[],
  remates: RemateXT[],
  ultimos: string[],
  jugaron: Map<string, Set<string>>,
): AmenazaJugador[] {
  const leidos = new Set(partidos.map((p) => p.partido));
  type Acum = { jugador: string; minutos: number; partidos: number; pases: number; cond: number; npxg: number; xa: number; penaltis: number };
  const acum = new Map<string, Acum>();
  const de = (id: string, nombre = "") => {
    let a = acum.get(id);
    if (!a) acum.set(id, (a = { jugador: nombre, minutos: 0, partidos: 0, pases: 0, cond: 0, npxg: 0, xa: 0, penaltis: 0 }));
    if (!a.jugador && nombre) a.jugador = nombre;
    return a;
  };

  for (const p of partidos) {
    /* Minutos: los del directo de ese partido (los de opta:jugadores-partidos si faltan). */
    for (const j of p.jugadores) {
      if (j.teamId !== teamId || !j.id || j.minutos <= 0) continue;
      const a = de(j.id, j.nombre);
      a.minutos += j.minutos;
      a.partidos++;
    }
    for (const [id, x] of amenazaDelPartido(p, teamId)) {
      const a = de(id);
      a.pases += x.pases;
      a.cond += x.conducciones;
    }
  }
  const conMinutosDirecto = new Set(partidos.filter((p) => p.jugadores.some((j) => j.teamId === teamId && j.minutos > 0)).map((p) => p.partido));
  for (const f of filas) {
    if (!leidos.has(f.partido)) continue;
    const a = de(f.playerId, f.jugador);
    a.xa += f.xA;
    if (!conMinutosDirecto.has(f.partido) && f.minutos > 0) {
      a.minutos += f.minutos;
      a.partidos++;
    }
  }
  for (const r of remates) {
    if (!leidos.has(r.partido) || !r.tiradorId) continue;
    const a = de(r.tiradorId);
    if (r.penalti) a.penaltis++;
    else a.npxg += r.xG;
  }

  const salida: AmenazaJugador[] = [];
  for (const [id, a] of acum) {
    if (a.minutos < MIN_MINUTOS_XT) continue;
    const k = 90 / a.minutos;
    const recientes = ultimos.filter((u) => jugaron.has(u));
    salida.push({
      playerId: id,
      jugador: a.jugador || `Jugador ${id}`,
      minutos: a.minutos,
      partidos: a.partidos,
      xt90: (a.pases + a.cond) * k,
      xtPases90: a.pases * k,
      xtConducciones90: a.cond * k,
      npxg90: a.npxg * k,
      xa90: a.xa * k,
      penaltis: a.penaltis,
      ausente: recientes.length > 0 && recientes.every((u) => !jugaron.get(u)!.has(id)),
    });
  }
  return salida.sort((x, y) => y.xt90 - x.xt90);
}
