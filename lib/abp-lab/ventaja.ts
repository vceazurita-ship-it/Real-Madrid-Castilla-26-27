/**
 * DÓNDE GANA LA RUTINA (laboratorio de ABP, 24/10/2026).
 *
 * Tres lecturas calculadas sobre la simulación (`simulacion.ts`):
 * - **Espacio**: para cada metro cuadrado del área, quién llega antes, si
 *   uno de los nuestros (que sabe adónde va) o un defensor (que reacciona).
 *   Es un control del espacio simplificado: tiempo de llegada a 7 m/s con
 *   un cuarto de segundo de reacción nuestro y casi medio suyo.
 * - **Duelos aéreos**: en el instante del remate, cada uno de los nuestros
 *   con su defensor más cercano y, si se conocen las dos alturas (Wyscout
 *   para los nuestros, la hoja de plantillas para los suyos), la diferencia.
 * - **Remate**: el xG estimado (`xg.ts`) en el punto de caída, corregido por
 *   la presión que tiene el rematador y por el duelo aéreo.
 *
 * Y el **encaje**: la misma rutina contra zona, mixta y al hombre, para ver
 * contra qué funciona mejor.
 */

import { VUELO, posicionesEn, recorridoBalon, salidas } from "@/lib/abp-lab/campo";
import type { Defensa, Envio, Punto, Rol, Rutina } from "@/lib/abp-lab/modelo";
import { defensaEn, estadoBalon, planDefensa, rematadorDe, type Defensor } from "@/lib/abp-lab/simulacion";
import { xgEn, xgGeometrico, type CalibreXg, type ZonaRemate } from "@/lib/abp-lab/xg";

type RutinaSim = Pick<Rutina, "roles" | "balon" | "tipo"> & { envio?: Envio };

/* ------------------------------------------------------------------ */
/*  ESPACIO                                                            */
/* ------------------------------------------------------------------ */

export type Celda = { x: number; y: number; p: number };

/** El trozo de campo que se mide: el área grande y un poco más. */
export const ZONA_CONTROL = { x0: 13.84, x1: 54.16, y0: 0, y1: 16.5 };

const V = 7;

/**
 * Probabilidad de que el balón que cae en cada celda sea nuestro (0-1). Sólo
 * se devuelven las celdas con dueño claro (por debajo de 0,38 o por encima de
 * 0,62): el resto está en disputa y no se pinta.
 */
export function controlEspacio(nuestros: Punto[], rivales: Punto[], paso = 1): Celda[] {
  const celdas: Celda[] = [];

  if (!nuestros.length) return celdas;

  for (let y = ZONA_CONTROL.y0 + paso / 2; y < ZONA_CONTROL.y1; y += paso) {
    for (let x = ZONA_CONTROL.x0 + paso / 2; x < ZONA_CONTROL.x1; x += paso) {
      let a = Infinity;

      for (const p of nuestros) a = Math.min(a, Math.hypot(p.x - x, p.y - y));

      let d = Infinity;

      for (const p of rivales) d = Math.min(d, Math.hypot(p.x - x, p.y - y));

      const tA = 0.25 + a / V;

      const tD = rivales.length ? 0.45 + d / V : 9;

      const p = 1 / (1 + Math.exp(-(tD - tA) / 0.28));

      if (p > 0.62 || p < 0.38) celdas.push({ x, y, p });
    }
  }

  return celdas;
}

/** Los huecos: donde se remata (del área pequeña al punto de penalti), a más de 3,5 m de cualquiera. */
export function espaciosLibres(todos: Punto[], paso = 1.5): Punto[] {
  const libres: Punto[] = [];

  for (let y = 1.25; y < 12.5; y += paso) {
    for (let x = 22.75; x < 45.5; x += paso) {
      if (todos.every((p) => Math.hypot(p.x - x, p.y - y) > 3.5)) libres.push({ x, y });
    }
  }

  return libres;
}

/* ------------------------------------------------------------------ */
/*  DUELOS AÉREOS                                                      */
/* ------------------------------------------------------------------ */

export type Duelo = {
  nuestro: number;
  suyo: number;
  distancia: number;
  /** Nuestra altura menos la suya, en cm; null si falta alguna. */
  difCm: number | null;
};

const ATACAN: Rol["papel"][] = ["rematador", "bloqueador", "senuelo", "portero"];

/** Cada uno de los nuestros que ataca el balón, con su defensor más cercano (a menos de 2,2 m). */
export function duelosAereos(roles: Rol[], nuestros: Punto[], plan: Defensor[], rivales: Punto[], alturaDe: (r: Rol) => number | null): Duelo[] {
  const duelos: Duelo[] = [];

  roles.forEach((r, i) => {
    if (!ATACAN.includes(r.papel)) return;

    const p = nuestros[i];

    if (!p || p.y > 17) return;

    let mejor = -1;

    let dist = Infinity;

    plan.forEach((d, k) => {
      if (d.papel === "portero" || d.papel === "barrera") return;

      const q = rivales[k];

      const n = Math.hypot(q.x - p.x, q.y - p.y);

      if (n < dist) {
        dist = n;
        mejor = k;
      }
    });

    if (mejor < 0 || dist > 2.2) return;

    const nuestra = alturaDe(r);

    const suya = plan[mejor].altura ?? null;

    duelos.push({ nuestro: i, suyo: mejor, distancia: dist, difCm: nuestra && suya ? nuestra - suya : null });
  });

  return duelos;
}

/* ------------------------------------------------------------------ */
/*  EL REMATE                                                          */
/* ------------------------------------------------------------------ */

export type Presion = "libre" | "normal" | "tapado" | "encima";

export type Remate = {
  xg: number;
  /** La geometría corregida por nuestros datos, antes de presión y altura. */
  base: number;
  zona: ZonaRemate;
  caida: Punto;
  quien: number | null;
  presion: Presion;
  /** Distancia al defensor más cercano en el remate, en metros. */
  marca: number | null;
  difCm: number | null;
  /** Cuántos defensores llegan a disputarlo (a menos de 2 m). */
  disputan: number;
  directo: boolean;
};

export const PRESION_LABEL: Record<Presion, string> = {
  libre: "Remata solo",
  normal: "Con marca a distancia",
  tapado: "Con un defensor cerca",
  encima: "Con el defensor encima",
};

const MULT_PRESION: Record<Presion, number> = { libre: 1.3, normal: 1, tapado: 0.8, encima: 0.55 };

/** La defensa colocada para una rutina: el sistema y, si se conoce, el número de zonales y sus jugadores. */
export type DefensaRival = { defensa: Defensa; enZona?: number; jugadores?: { dorsal?: string; nombre?: string; altura: number | null }[] };

/** El plan de la defensa con los jugadores del rival puestos: los más altos marcan a los nuestros más peligrosos. */
export function planCon(r: RutinaSim, rival: DefensaRival): Defensor[] {
  const desde = salidas(r.roles);

  const camino = recorridoBalon(r);

  const plan = planDefensa(rival.defensa, r.roles, desde, r.tipo, camino[0], rival.enZona);

  const altos = [...(rival.jugadores ?? [])].filter((j) => j.altura).sort((a, b) => (b.altura ?? 0) - (a.altura ?? 0));

  if (!altos.length) return plan;

  /* Primero los marcadores (ya vienen del más peligroso al menos), luego los zonales del centro hacia fuera. */
  const orden = [
    ...plan.map((d, k) => ({ d, k })).filter(({ d }) => d.papel === "marcador"),
    ...plan
      .map((d, k) => ({ d, k }))
      .filter(({ d }) => d.papel === "zonal")
      .sort((a, b) => Math.abs(a.d.base.x - 34) + a.d.base.y * 0.5 - (Math.abs(b.d.base.x - 34) + b.d.base.y * 0.5)),
  ];

  const copia = plan.map((d) => ({ ...d }));

  orden.forEach(({ k }, n) => {
    const j = altos[n];

    if (j) copia[k] = { ...copia[k], dorsal: j.dorsal, nombre: j.nombre, altura: j.altura };
  });

  return copia;
}

export function evaluaRemate(r: RutinaSim, plan: Defensor[], calibre: CalibreXg | null, alturaDe: (rol: Rol) => number | null): Remate | null {
  if (!r.roles.length) return null;

  const camino = recorridoBalon(r);

  const golpeo = camino[0];

  const caida = camino.at(-1)!;

  const envio = r.envio ?? "tenso";

  if (r.tipo === "penalti") {
    const lanzador = r.roles.findIndex((x) => x.papel === "lanzador");

    return { xg: 0.76, base: 0.76, zona: "centro", caida, quien: lanzador >= 0 ? lanzador : null, presion: "libre", marca: null, difCm: null, disputan: 0, directo: true };
  }

  /* Falta directa: el balón va de donde se golpea a la portería. */
  if (camino.length === 2 && caida.y < 1.2 && golpeo.y > 16) {
    const lanzador = r.roles.findIndex((x) => x.papel === "lanzador");

    const base = xgGeometrico(golpeo);

    return { xg: base * 0.6, base, zona: "frontal", caida, quien: lanzador >= 0 ? lanzador : null, presion: "normal", marca: null, difCm: null, disputan: 0, directo: true };
  }

  const quien = rematadorDe(r.roles, caida);

  const { xg: base, zona } = xgEn(caida, golpeo, calibre);

  if (quien === null) return { xg: 0, base, zona, caida, quien: null, presion: "normal", marca: null, difCm: null, disputan: 0, directo: false };

  const enRemate = posicionesEn(r.roles, VUELO[1]);

  const def = defensaEn(plan, r.roles, VUELO[1], caida, (s) => estadoBalon(camino, s, envio, r.tipo).suelo);

  const p = enRemate[quien];

  let marca: number | null = null;

  let cerca = -1;

  let disputan = 0;

  plan.forEach((d, k) => {
    if (d.papel === "portero" || d.papel === "barrera") return;

    const n = Math.hypot(def.pos[k].x - p.x, def.pos[k].y - p.y);

    if (n < 2) disputan += 1;

    if (marca === null || n < marca) {
      marca = n;
      cerca = k;
    }
  });

  const m: number | null = marca;

  const presion: Presion = m === null || m > 3 ? "libre" : m > 1.8 ? "normal" : m > 0.9 ? "tapado" : "encima";

  const nuestra = alturaDe(r.roles[quien]);

  const suya = cerca >= 0 ? (plan[cerca].altura ?? null) : null;

  const difCm = nuestra && suya && m !== null && m < 2.2 ? nuestra - suya : null;

  let xg = base * MULT_PRESION[presion];

  if (difCm !== null) xg *= 1 + Math.max(-12, Math.min(12, difCm)) * 0.012;

  if (disputan > 1) xg *= 0.85 ** (disputan - 1);

  /* Un envío raso al área no se remata de cabeza: pesa la mitad si cae dentro del área pequeña. */
  if (envio === "raso" && caida.y < 6) xg *= 0.9;

  return { xg: Math.min(0.75, xg), base, zona, caida, quien, presion, marca: m, difCm, disputan, directo: false };
}

/* ------------------------------------------------------------------ */
/*  EL ENCAJE                                                          */
/* ------------------------------------------------------------------ */

export type Encaje = { defensa: Exclude<Defensa, "cualquiera">; xg: number; remate: Remate | null };

/** La rutina contra los tres sistemas, de mejor a peor. */
export function encajeSistemas(r: RutinaSim, calibre: CalibreXg | null, alturaDe: (rol: Rol) => number | null): Encaje[] {
  return (["zona", "mixta", "hombre"] as const)
    .map((defensa) => {
      const remate = evaluaRemate(r, planCon(r, { defensa }), calibre, alturaDe);

      return { defensa, xg: remate?.xg ?? 0, remate };
    })
    .sort((a, b) => b.xg - a.xg);
}
