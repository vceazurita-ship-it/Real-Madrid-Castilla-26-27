/**
 * VELOCIDAD DE PROGRESIÓN DEL RIVAL: METROS HACIA PORTERÍA POR SEGUNDO
 * (Scout colectivo, 27/11/2026, idea de X).
 *
 * Con el evento a evento de Opta (`opta:directo:<partido>`) de los últimos
 * partidos de cada equipo de su liga (x de Opta 0-100, siempre hacia la
 * portería contraria; campo de 105 m):
 *
 * - Posesión: eventos seguidos del equipo en la misma parte, hasta que el
 *   contrario se queda el balón (pase, recuperación, intercepción, despeje,
 *   blocaje o entrada ganada) o pasan 30 s sin que toque (como en «Salida de
 *   balón»).
 * - Origen, por su primer toque: «salida de portero» si es de su portero o un
 *   saque de puerta; «saque» si es un saque de banda, de centro (pase desde
 *   el punto central) o una falta a su favor (un «FreeKick» suyo en los 3 s de
 *   antes); «robo», el resto (balón ganado en juego).
 * - Llega al último tercio si un toque suyo está en x ≥ 66,7 o un pase
 *   acertado acaba ahí. Las que ya empiezan en el último tercio no cuentan.
 * - Metros: (x de la entrada − x del primer toque) × 1,05. Segundos: desde el
 *   primer toque hasta la entrada, al menos 1 s.
 * - Velocidad del grupo: metros sumados / segundos sumados (media ponderada,
 *   así una entrada de un pase largo de 0 s no se dispara).
 * - Acaba en remate: hay un remate suyo en la posesión.
 *
 * La liga: la media de los demás equipos de su liga (sin él), por origen.
 *
 * Funciones puras: ni una cifra de Opta aquí (el repositorio es público).
 */

import { esToque, type EventoDirecto, type JugadorDirecto } from "@/lib/opta-directo-mapas";

export const MAX_PARTIDOS = 8;
export const MIN_PARTIDOS = 2;
export const CORTE_POSESION_S = 30;
export const X_ULTIMO = 66.7;
/** Con menos posesiones en un origen, la cifra es sólo tendencia. */
export const MIN_POSESIONES = 8;
/** Diferencia con la liga a partir de la cual se dice «más rápido / más lento». */
export const UMBRAL_VELOCIDAD = 0.25;

const CORTA = new Set(["Pass", "BallRecovery", "Interception", "Clearance", "Claim", "KeeperPickup", "Punch", "BlockedPass"]);
const NO_TOCA = new Set(["Foul", "Challenge", "AttemptedTackle", "Card", "SubstitutionOn", "SubstitutionOff", "Out"]);
const TIROS = new Set(["Goal", "Miss", "AttemptSaved", "Post"]);
const toca = (e: EventoDirecto) => !!e.jugadorId && esToque(e) && !NO_TOCA.has(e.tipo);

export type Origen = "robo" | "portero" | "saque";
export const ORIGENES: Origen[] = ["robo", "portero", "saque"];

export type PartidoVelocidad = { eventos: EventoDirecto[]; jugadores: JugadorDirecto[] };

export type Grupo = {
  /** Posesiones que llegan al último tercio. */
  n: number;
  metros: number;
  segundos: number;
  remates: number;
};

export type PerfilVelocidad = { partidos: number; grupos: Record<Origen, Grupo>; total: Grupo };

const vacio = (): Grupo => ({ n: 0, metros: 0, segundos: 0, remates: 0 });

export const velocidad = (g: Grupo) => (g.segundos > 0 ? g.metros / g.segundos : null);
export const pctRemate = (g: Grupo) => (g.n ? g.remates / g.n : null);

/** Cada posesión del equipo que llega al último tercio, sumada por origen. `null` si no llega al mínimo. */
export function perfilVelocidad(partidos: PartidoVelocidad[], teamId: string): PerfilVelocidad | null {
  const grupos: Record<Origen, Grupo> = { robo: vacio(), portero: vacio(), saque: vacio() };
  let leidos = 0;

  for (const p of partidos) {
    const ev = p.eventos;
    if (!ev.some((e) => e.teamId === teamId)) continue;
    leidos += 1;
    const porteros = new Set(p.jugadores.filter((j) => j.teamId === teamId && j.puesto === "Goalkeeper").map((j) => j.id));

    let abierta: { e: EventoDirecto; i: number }[] = [];
    const origenDe = (e: EventoDirecto, i: number): Origen => {
      if (e.saque === "puerta" || porteros.has(e.jugadorId)) return "portero";
      if (e.saque === "banda") return "saque";
      if (e.tipo === "Pass" && Math.abs(e.x - 50) < 1.5 && Math.abs(e.y - 50) < 1.5) return "saque";
      for (let k = i - 1; k >= 0 && k >= i - 12; k--) {
        const o = ev[k];
        if (o.parte !== e.parte || e.segundo - o.segundo > 3) break;
        if (o.tipo === "FreeKick" && o.teamId === teamId && o.ok) return "saque";
      }
      return "robo";
    };
    const cierra = () => {
      const pos = abierta;
      abierta = [];
      if (!pos.length) return;
      const { e: e0, i: i0 } = pos[0];
      if (e0.x >= X_ULTIMO) return;
      let entrada: { x: number; segundo: number } | null = null;
      for (const { e } of pos) {
        if (e.x >= X_ULTIMO) {
          entrada = { x: e.x, segundo: e.segundo };
          break;
        }
        if (e.tipo === "Pass" && e.ok && e.finX != null && e.finX >= X_ULTIMO) {
          entrada = { x: e.finX, segundo: e.segundo };
          break;
        }
      }
      if (!entrada) return;
      const g = grupos[origenDe(e0, i0)];
      g.n += 1;
      g.metros += Math.max(0, entrada.x - e0.x) * 1.05;
      g.segundos += Math.max(1, entrada.segundo - e0.segundo);
      if (pos.some(({ e }) => TIROS.has(e.tipo))) g.remates += 1;
    };

    ev.forEach((e, i) => {
      const ultimo = abierta[abierta.length - 1]?.e;
      if (ultimo && (e.parte !== ultimo.parte || e.segundo - ultimo.segundo > CORTE_POSESION_S)) cierra();
      if (e.teamId !== teamId) {
        if (abierta.length && (CORTA.has(e.tipo) || (e.tipo === "Tackle" && e.ok))) cierra();
        return;
      }
      if (toca(e)) abierta.push({ e, i });
    });
    cierra();
  }

  if (leidos < MIN_PARTIDOS) return null;
  const total = ORIGENES.reduce((t, o) => {
    const g = grupos[o];
    return { n: t.n + g.n, metros: t.metros + g.metros, segundos: t.segundos + g.segundos, remates: t.remates + g.remates };
  }, vacio());
  if (!total.n) return null;
  return { partidos: leidos, grupos, total };
}

export type FilaComparada = {
  origen: Origen | "total";
  n: number;
  porPartido: number;
  velocidad: number | null;
  remate: number | null;
  ligaVelocidad: number | null;
  ligaRemate: number | null;
  ligaPorPartido: number | null;
};

export type VelocidadProgresion = {
  partidos: number;
  equipos: number;
  filas: FilaComparada[];
  /** «rapido» / «lento» frente a la liga (todas sus posesiones); null si parecido. */
  ritmo: "rapido" | "lento" | null;
};

const mediaDe = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x != null && Number.isFinite(x));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};

/** El rival frente a la media de los demás. `null` con menos de 3 equipos con que comparar. */
export function comparaVelocidad(rival: PerfilVelocidad, otros: PerfilVelocidad[]): VelocidadProgresion | null {
  if (otros.length < 3) return null;
  const fila = (origen: Origen | "total"): FilaComparada => {
    const de = (p: PerfilVelocidad) => (origen === "total" ? p.total : p.grupos[origen]);
    const g = de(rival);
    return {
      origen,
      n: g.n,
      porPartido: g.n / rival.partidos,
      velocidad: velocidad(g),
      remate: pctRemate(g),
      ligaVelocidad: mediaDe(otros.map((o) => velocidad(de(o)))),
      ligaRemate: mediaDe(otros.map((o) => pctRemate(de(o)))),
      ligaPorPartido: mediaDe(otros.map((o) => de(o).n / o.partidos)),
    };
  };
  const filas = [fila("total"), ...ORIGENES.map(fila)];
  const t = filas[0];
  const dif = t.velocidad != null && t.ligaVelocidad != null ? t.velocidad - t.ligaVelocidad : 0;
  return {
    partidos: rival.partidos,
    equipos: otros.length,
    filas,
    ritmo: dif >= UMBRAL_VELOCIDAD ? "rapido" : dif <= -UMBRAL_VELOCIDAD ? "lento" : null,
  };
}
