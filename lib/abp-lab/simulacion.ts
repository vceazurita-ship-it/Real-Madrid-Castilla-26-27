/**
 * LA JUGADA EN EL TIEMPO (laboratorio de ABP, 24/10/2026).
 *
 * `campo.ts` dice dónde está cada uno de los nuestros en el instante `t`
 * (0 = antes del saque, 1 = el final). Aquí se completa la jugada:
 *
 * - **El balón con altura**: cada tramo del recorrido es una parábola cuya
 *   cumbre depende del envío (tenso, bombeado, raso) y del largo del tramo.
 *   El último tramo llega a la altura de la cabeza (2,2 m), salvo el raso.
 * - **La defensa que se mueve**: el portero sigue al balón, los zonales
 *   atacan la pelota que cae en su sitio y cada marcador persigue a su
 *   atacante. Un bloqueador nuestro pegado a un defensor lo frena: el
 *   marcador pierde a su hombre y eso se ve (y se mide en `ventaja.ts`).
 *
 * Todo es determinista y sin estado: el instante `t` se recalcula desde 0
 * en pasos de 0,02, así que la barra de tiempo puede ir y volver.
 */

import { AREA, DURACION_MS, VUELO, TRAMOS, golpeoDe, posicionesEn } from "@/lib/abp-lab/campo";
import type { TipoAbp } from "@/lib/abp-lab/referentes";
import type { Defensa, Envio, Papel, Punto, Rol } from "@/lib/abp-lab/modelo";

/* ------------------------------------------------------------------ */
/*  EL RELOJ                                                           */
/* ------------------------------------------------------------------ */

/** Lo que dura la jugada a velocidad real, en segundos. */
export const SEGUNDOS = DURACION_MS / 1000;

/** Los instantes que se marcan en la línea de tiempo. */
export const MARCAS: { t: number; label: string }[] = [
  { t: 0, label: "Salida" },
  { t: VUELO[0], label: "Golpeo" },
  { t: VUELO[1], label: "Remate" },
  { t: 1, label: "Final" },
];

export const VELOCIDADES = [0.25, 0.5, 1, 2] as const;

/** Qué está pasando en `t`, para el rótulo de la retransmisión. */
export function momentoDe(t: number): string {
  if (t < TRAMOS[1][0]) return "Colocación";
  if (t < VUELO[0]) return "Movimientos previos";
  if (t < VUELO[1] - 0.06) return "El balón en el aire";
  if (t < VUELO[1] + 0.06) return "Remate";

  return "Segunda jugada";
}

/* ------------------------------------------------------------------ */
/*  EL BALÓN                                                           */
/* ------------------------------------------------------------------ */

/** La altura del remate de cabeza. */
const CABEZA = 2.2;

const suave = (u: number) => (u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2);

/** La cumbre de un tramo, según el envío y lo largo que es. */
function cumbre(envio: Envio, largo: number) {
  if (envio === "raso" || largo < 8) return 0.15;

  if (envio === "bombeado") return 4.5 + largo * 0.12;

  return 1.6 + largo * 0.045;
}

export type EstadoBalon = {
  /** Dónde está su sombra. */
  suelo: Punto;
  /** A qué altura va, en metros. */
  z: number;
  enVuelo: boolean;
};

/**
 * El balón en `t`: recorre el camino a velocidad constante dentro de su vuelo
 * (`VUELO`) y, en cada tramo, sube y baja por una parábola.
 */
export function estadoBalon(camino: Punto[], t: number, envio: Envio = "tenso", tipo?: TipoAbp): EstadoBalon {
  if (camino.length < 2) return { suelo: camino[0] ?? { x: 0, y: 0 }, z: 0, enVuelo: false };

  const tramos = camino.slice(1).map((p, i) => Math.hypot(p.x - camino[i].x, p.y - camino[i].y));

  const total = tramos.reduce((a, b) => a + b, 0) || 1;

  const u = Math.min(1, Math.max(0, (t - VUELO[0]) / (VUELO[1] - VUELO[0])));

  let falta = suave(u) * total;

  /* El penalti y la falta directa van a portería: llegan a media altura, no a la cabeza. */
  const final = envio === "raso" ? 0 : tipo === "penalti" || tipo === "falta" ? 1.1 : CABEZA;

  for (let i = 0; i < tramos.length; i++) {
    const ultimo = i === tramos.length - 1;

    if (falta <= tramos[i] || ultimo) {
      const v = tramos[i] ? Math.min(1, falta / tramos[i]) : 1;

      const a = camino[i];
      const b = camino[i + 1];

      /* Un tramo corto (el saque en corto) va raso; el último acaba a la altura del remate. */
      const z0 = i === 0 ? 0 : tramos[i - 1] >= 8 && envio !== "raso" ? CABEZA * 0.6 : 0;
      const z1 = ultimo ? (tramos[i] >= 8 ? final : 0) : tramos[i] >= 8 ? CABEZA * 0.6 : 0;

      const z = z0 + (z1 - z0) * v + 4 * cumbre(envio, tramos[i]) * v * (1 - v);

      return { suelo: { x: a.x + (b.x - a.x) * v, y: a.y + (b.y - a.y) * v }, z: Math.max(0, z), enVuelo: u > 0 && u < 1 };
    }

    falta -= tramos[i];
  }

  return { suelo: camino.at(-1)!, z: 0, enVuelo: false };
}

/** La parábola entera de un tramo, para dibujar la estela en el aire (u de 0 a 1). */
export function arcoTramo(camino: Punto[], i: number, envio: Envio = "tenso", tipo?: TipoAbp) {
  const tramos = camino.slice(1).map((p, k) => Math.hypot(p.x - camino[k].x, p.y - camino[k].y));

  const a = camino[i];
  const b = camino[i + 1];

  const ultimo = i === tramos.length - 1;

  const final = envio === "raso" ? 0 : tipo === "penalti" || tipo === "falta" ? 1.1 : CABEZA;

  const z0 = i === 0 ? 0 : tramos[i - 1] >= 8 && envio !== "raso" ? CABEZA * 0.6 : 0;
  const z1 = ultimo ? (tramos[i] >= 8 ? final : 0) : tramos[i] >= 8 ? CABEZA * 0.6 : 0;

  const alto = cumbre(envio, tramos[i]);

  return (v: number) => ({ x: a.x + (b.x - a.x) * v, y: a.y + (b.y - a.y) * v, z: z0 + (z1 - z0) * v + 4 * alto * v * (1 - v) });
}

/* ------------------------------------------------------------------ */
/*  LA DEFENSA                                                         */
/* ------------------------------------------------------------------ */

export type PapelDefensor = "portero" | "zonal" | "marcador" | "barrera";

export type Defensor = {
  papel: PapelDefensor;
  /** Dónde espera. */
  base: Punto;
  /** El índice del papel nuestro al que marca (sólo marcadores). */
  sigue?: number;
  /** Si es un jugador concreto del rival: su dorsal, nombre y altura. */
  dorsal?: string;
  nombre?: string;
  altura?: number | null;
};

/** Los papeles nuestros que un marcador al hombre sigue: los que pisan el remate. */
const PELIGROSOS: Papel[] = ["rematador", "bloqueador", "senuelo", "portero"];

/** Prioridad para asignar marca: primero al rematador, luego a los demás. */
const PRIORIDAD: Partial<Record<Papel, number>> = { rematador: 0, portero: 1, bloqueador: 2, senuelo: 3 };

/** Cuántos van en zona en cada sistema, si el scouting no lo dice. */
export const EN_ZONA_TIPO: Record<Exclude<Defensa, "cualquiera">, number> = { zona: 7, mixta: 4, hombre: 1 };

/**
 * Cómo se coloca la defensa. Para el rival tipo basta con el sistema; para el
 * próximo rival, el número de zonales que da su scouting (`enZona`).
 */
export function planDefensa(defensa: Defensa, roles: Rol[], salidas: Punto[], tipo: TipoAbp, golpeo: Punto = golpeoDe(tipo), enZona?: number): Defensor[] {
  const portero: Defensor = { papel: "portero", base: { x: 34, y: 0.8 } };

  if (tipo === "banda" || tipo === "saque" || tipo === "penalti" || defensa === "cualquiera") return [portero];

  /* Nuestros atacantes en el área, del más peligroso al menos. */
  const atacantes = roles
    .map((r, i) => ({ r, i, p: salidas[i] }))
    .filter(({ r, p }) => PELIGROSOS.includes(r.papel) && p.y < AREA.y + 4)
    .sort((a, b) => (PRIORIDAD[a.r.papel] ?? 9) - (PRIORIDAD[b.r.papel] ?? 9) || a.p.y - b.p.y);

  const marca = (i: number): Defensor => {
    const p = salidas[i];

    const dx = 34 - p.x;
    const dy = -p.y;
    const d = Math.hypot(dx, dy) || 1;

    return { papel: "marcador", base: { x: p.x + (dx / d) * 1.1, y: p.y + (dy / d) * 1.1 }, sigue: i };
  };

  if (tipo === "falta") {
    const dx = 34 - golpeo.x;
    const dy = 0 - golpeo.y;
    const d = Math.hypot(dx, dy) || 1;

    const centro = { x: golpeo.x + (dx / d) * 9.15, y: golpeo.y + (dy / d) * 9.15 };

    const barrera: Defensor[] = [-1.5, -0.5, 0.5, 1.5].map((k) => ({ papel: "barrera", base: { x: centro.x + (-dy / d) * k * 0.75, y: centro.y + (dx / d) * k * 0.75 } }));

    const lejana = golpeo.y > 16 && Math.abs(golpeo.x - 34) < 14;

    if (lejana) return [portero, ...barrera];

    const resto =
      defensa === "hombre" || defensa === "mixta"
        ? atacantes.slice(0, 5).map(({ i }) => marca(i))
        : Array.from({ length: 5 }, (_, k) => ({ papel: "zonal" as const, base: { x: 24 + k * 5, y: 9 } }));

    return [portero, ...barrera, ...resto];
  }

  const n = Math.max(0, Math.min(8, enZona ?? (defensa === "zona" ? EN_ZONA_TIPO.zona : defensa === "mixta" ? EN_ZONA_TIPO.mixta : EN_ZONA_TIPO.hombre)));

  /* Los zonales: la línea del área pequeña y, si sobran, una segunda en el punto de penalti y la frontal. */
  const sitios: Punto[] = [];

  const primera = Math.min(n, 4);

  for (let k = 0; k < primera; k++) sitios.push({ x: primera === 1 ? (golpeo.x < 34 ? 31 : 37) : 28.5 + (11 * k) / (primera - 1), y: 3.6 });

  const segunda = Math.min(n - primera, 2);

  for (let k = 0; k < segunda; k++) sitios.push({ x: segunda === 1 ? 34 : 30 + 8 * k, y: 7.6 });

  if (n > 6) sitios.push({ x: 34, y: 12 });

  if (n > 7) sitios.push({ x: 34, y: 17.5 });

  const zonales: Defensor[] = sitios.map((base) => ({ papel: "zonal", base }));

  const marcadores = defensa === "zona" ? [] : atacantes.slice(0, Math.max(0, 10 - n)).map(({ i }) => marca(i));

  return [portero, ...zonales, ...marcadores];
}

/** Lo que se mueve un defensor por unidad de `t` (unos 7 m/s con la jugada a velocidad real). */
const VMAX = 26;

const PASO = 0.02;

export type EstadoDefensa = { pos: Punto[]; bloqueado: boolean[] };

/**
 * Dónde está cada defensor en `t`. Se integra desde el principio: cada paso,
 * cada uno va hacia su objetivo a velocidad limitada, y un bloqueador nuestro
 * pegado a él (a menos de 1,2 m, con su carrera ya en marcha) lo deja casi
 * clavado.
 */
export function defensaEn(plan: Defensor[], roles: Rol[], t: number, caida: Punto, balonEnT: (s: number) => Punto): EstadoDefensa {
  const pos = plan.map((d) => ({ ...d.base }));

  const bloqueado = plan.map(() => false);

  const bloqueadores = roles.map((r, i) => (r.papel === "bloqueador" ? i : -1)).filter((i) => i >= 0);

  for (let s = PASO; s <= t + 1e-9; s += PASO) {
    const nuestros = posicionesEn(roles, s);

    const vuela = s >= VUELO[0];

    plan.forEach((d, k) => {
      let objetivo = d.base;

      if (d.papel === "portero") {
        const b = balonEnT(s);

        objetivo = { x: Math.min(37, Math.max(31, 34 + (b.x - 34) * 0.35)), y: 0.8 };
      } else if (d.papel === "marcador" && d.sigue !== undefined && nuestros[d.sigue]) {
        const p = nuestros[d.sigue];

        const dx = 34 - p.x;
        const dy = -p.y;
        const n = Math.hypot(dx, dy) || 1;

        objetivo = { x: p.x + (dx / n) * 0.9, y: p.y + (dy / n) * 0.9 };
      } else if (d.papel === "zonal" && vuela && Math.hypot(caida.x - d.base.x, caida.y - d.base.y) < 3.2) {
        /* El balón cae en su sitio: va a por él. */
        objetivo = { x: d.base.x + (caida.x - d.base.x) * 0.8, y: d.base.y + (caida.y - d.base.y) * 0.8 };
      }

      /* ¿Le está bloqueando alguien? */
      const tapado = bloqueadores.some((i) => {
        const r = roles[i];

        const empieza = r.hx !== undefined ? TRAMOS[r.fase ?? 2][0] : 0;

        return s >= empieza && Math.hypot(nuestros[i].x - pos[k].x, nuestros[i].y - pos[k].y) < 1.2;
      });

      if (tapado && d.papel !== "portero" && d.papel !== "barrera") bloqueado[k] = true;

      const v = VMAX * PASO * (tapado && d.papel !== "portero" ? 0.12 : 1);

      const dx = objetivo.x - pos[k].x;
      const dy = objetivo.y - pos[k].y;
      const n = Math.hypot(dx, dy);

      if (n > 1e-6) {
        const m = Math.min(n, v);

        pos[k] = { x: pos[k].x + (dx / n) * m, y: pos[k].y + (dy / n) * m };
      }
    });
  }

  /* Bloqueado «ahora»: el que en este instante tiene a un bloqueador encima. */
  const nuestros = posicionesEn(roles, t);

  const ahora = plan.map(
    (d, k) =>
      bloqueado[k] &&
      bloqueadores.some((i) => {
        const r = roles[i];

        const empieza = r.hx !== undefined ? TRAMOS[r.fase ?? 2][0] : 0;

        return t >= empieza && Math.hypot(nuestros[i].x - pos[k].x, nuestros[i].y - pos[k].y) < 1.6;
      }),
  );

  return { pos, bloqueado: ahora };
}

/* ------------------------------------------------------------------ */
/*  EL REMATE                                                          */
/* ------------------------------------------------------------------ */

const NO_REMATAN: Papel[] = ["lanzador", "vigilancia", "corto", "zonal", "marcador"];

/** Quién de los nuestros llega al balón: el más cercano a donde cae, en el instante del remate. */
export function rematadorDe(roles: Rol[], caida: Punto): number | null {
  const enRemate = posicionesEn(roles, VUELO[1]);

  let mejor: number | null = null;

  let distancia = Infinity;

  roles.forEach((r, i) => {
    if (NO_REMATAN.includes(r.papel)) return;

    /* El rematador tiene preferencia: medio metro de ventaja en el desempate. */
    const d = Math.hypot(enRemate[i].x - caida.x, enRemate[i].y - caida.y) - (r.papel === "rematador" ? 0.5 : 0);

    if (d < distancia) {
      distancia = d;
      mejor = i;
    }
  });

  return mejor !== null && distancia < 6 ? mejor : null;
}
