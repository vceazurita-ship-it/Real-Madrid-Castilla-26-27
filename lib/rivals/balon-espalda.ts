/**
 * ¿SE LE GANA LA ESPALDA? BALONES LARGOS A SU ESPALDA Y EN QUÉ ACABAN
 * (Scout colectivo, 21/11/2026, idea de X).
 *
 * Con el evento a evento de Opta (`opta:directo:<partido>`), en los partidos
 * de un equipo, los pases que LE HACEN sus oponentes:
 *
 * - pase en juego (sin saques de banda ni de puerta) que sale de fuera de los
 *   últimos 25 m (x < 76,2; Opta x 0-100 = 105 m, y 0-100 = 68 m), avanza al
 *   menos 20 m hacia la portería y acaba en los últimos 25 m por dentro de los
 *   carriles centrales (y de destino entre 20,4 y 79,6, el ancho del área).
 *   Completado o no: también cuenta el que no llega.
 * - En qué acaba, lo primero que pasa en los 10 s siguientes (misma parte):
 *   remate de quien lo envía; falta a su favor; despeje del defensor
 *   (Clearance, Punch, BlockedPass); pérdida (el defensor la gana: pase,
 *   recuperación, intercepción, entrada ganada, blocaje; o falta en contra).
 *   Si no pasa nada de eso: pase completado = «sigue sin rematar», fallado =
 *   pérdida.
 * - Carril de salida, visto desde quien ataca: izquierda (y > 66,7), centro,
 *   derecha (y < 33,3).
 *
 * Funciones puras: ni una cifra de Opta aquí (el repositorio es público).
 */

import { esPaseEnJuego, type EventoDirecto } from "@/lib/opta-directo-mapas";

export const ULTIMOS_M = 25;
export const X_ZONA = 100 - (ULTIMOS_M / 105) * 100;
export const Y_CENTRAL = { y0: 20.4, y1: 79.6 };
export const AVANCE_M = 20;
export const VENTANA_S = 10;
/** Partidos más recientes de cada equipo. */
export const MAX_PARTIDOS = 8;
/** Con menos balones no se compara al equipo. */
export const MIN_BALONES = 12;

export type Desenlace = "remate" | "falta" | "despeje" | "perdida" | "sigue";
export type Carril = "izquierda" | "centro" | "derecha";

export const DESENLACES: Desenlace[] = ["remate", "falta", "despeje", "perdida", "sigue"];
export const CARRILES: Carril[] = ["izquierda", "centro", "derecha"];

export type BalonEspalda = {
  partido: string;
  minuto: number;
  x: number;
  y: number;
  finX: number;
  finY: number;
  ok: boolean;
  desenlace: Desenlace;
  /** xG del remate que lo cierra (0 si no acaba en remate). */
  xg: number;
  carril: Carril;
};

export type PartidoEspalda = { partido: string; fecha: string; eventos: EventoDirecto[] };

const TIROS = new Set(["Goal", "Miss", "AttemptSaved", "Post"]);
const DESPEJES = new Set(["Clearance", "Punch", "BlockedPass"]);
const GANA_DEFENSOR = new Set(["Pass", "BallRecovery", "Interception", "Claim", "KeeperPickup", "Save"]);

export const carrilDe = (y: number): Carril => (y > 66.7 ? "izquierda" : y < 33.3 ? "derecha" : "centro");

export function esBalonALaEspalda(e: EventoDirecto): boolean {
  if (!esPaseEnJuego(e) || e.finX == null || e.finY == null) return false;
  if (e.x >= X_ZONA || e.finX < X_ZONA) return false;
  if (e.finY < Y_CENTRAL.y0 || e.finY > Y_CENTRAL.y1) return false;
  return ((e.finX - e.x) * 105) / 100 >= AVANCE_M;
}

/** Cómo acaba el pase `ev[i]`, que hace `ataca` contra el equipo que defiende. */
function desenlaceDe(ev: EventoDirecto[], i: number): { desenlace: Desenlace; xg: number } {
  const p = ev[i];
  for (let k = i + 1; k < ev.length; k++) {
    const o = ev[k];
    if (o.parte !== p.parte || o.segundo - p.segundo > VENTANA_S) break;
    const mio = o.teamId === p.teamId;
    if (mio && TIROS.has(o.tipo)) return { desenlace: "remate", xg: o.xG ?? 0 };
    if (o.tipo === "Foul") return { desenlace: (mio ? o.ok : !o.ok) ? "falta" : "perdida", xg: 0 };
    if (mio) continue;
    if (DESPEJES.has(o.tipo)) return { desenlace: "despeje", xg: 0 };
    if (GANA_DEFENSOR.has(o.tipo) || (o.tipo === "Tackle" && o.ok)) return { desenlace: "perdida", xg: 0 };
  }
  return { desenlace: p.ok ? "sigue" : "perdida", xg: 0 };
}

/** Los balones a la espalda que le hacen a `teamId` en esos partidos (`eventos` en orden de partido). */
export function balonesContra(partidos: PartidoEspalda[], teamId: string): { balones: BalonEspalda[]; partidos: number } {
  const balones: BalonEspalda[] = [];
  let leidos = 0;
  for (const p of partidos) {
    if (!p.eventos.some((e) => e.teamId === teamId)) continue;
    leidos += 1;
    p.eventos.forEach((e, i) => {
      if (e.teamId === teamId || !e.teamId || !esBalonALaEspalda(e)) return;
      const { desenlace, xg } = desenlaceDe(p.eventos, i);
      balones.push({ partido: p.partido, minuto: e.minuto, x: e.x, y: e.y, finX: e.finX!, finY: e.finY!, ok: e.ok, desenlace, xg, carril: carrilDe(e.y) });
    });
  }
  return { balones, partidos: leidos };
}

export type ResumenEspalda = {
  n: number;
  partidos: number;
  porPartido: number;
  /** Tanto por uno. */
  remate: number;
  xgPorBalon: number;
  /** Parte de los balones que sale de cada carril (tanto por uno). */
  carril: Record<Carril, number>;
  /** Por carril: cuántos y qué parte acaba en remate. */
  porCarril: Record<Carril, { n: number; remate: number }>;
  cuenta: Record<Desenlace, number>;
};

export function resume(balones: BalonEspalda[], partidos: number): ResumenEspalda | null {
  const n = balones.length;
  if (!n || !partidos) return null;
  const cuenta = Object.fromEntries(DESENLACES.map((d) => [d, 0])) as Record<Desenlace, number>;
  const porCarril = Object.fromEntries(CARRILES.map((c) => [c, { n: 0, remate: 0 }])) as Record<Carril, { n: number; remate: number }>;
  let xg = 0;
  for (const b of balones) {
    cuenta[b.desenlace] += 1;
    xg += b.xg;
    porCarril[b.carril].n += 1;
    if (b.desenlace === "remate") porCarril[b.carril].remate += 1;
  }
  for (const c of CARRILES) porCarril[c].remate = porCarril[c].n ? porCarril[c].remate / porCarril[c].n : 0;
  const carril = Object.fromEntries(CARRILES.map((c) => [c, porCarril[c].n / n])) as Record<Carril, number>;
  return { n, partidos, porPartido: n / partidos, remate: cuenta.remate / n, xgPorBalon: xg / n, carril, porCarril, cuenta };
}

/** El carril del que más sale. */
export const carrilMayor = (r: ResumenEspalda): Carril => CARRILES.reduce((a, b) => (r.carril[b] > r.carril[a] ? b : a));

export const media = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0);

/** Compensa, no compensa o en la media: remate y xG por balón contra la media de la liga (±15 %). */
export function veredicto(r: ResumenEspalda, liga: { remate: number; xgPorBalon: number }): "compensa" | "no compensa" | "en la media" {
  const a = liga.remate ? r.remate / liga.remate : 1;
  const b = liga.xgPorBalon ? r.xgPorBalon / liga.xgPorBalon : 1;
  if (a >= 1.15 && b >= 1.0) return "compensa";
  if (b >= 1.15 && a >= 1.0) return "compensa";
  if (a <= 0.85 && b <= 1.0) return "no compensa";
  if (b <= 0.85 && a <= 1.0) return "no compensa";
  return "en la media";
}
