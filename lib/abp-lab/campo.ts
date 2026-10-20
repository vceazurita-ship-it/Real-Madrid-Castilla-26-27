/**
 * LA PIZARRA DEL TALLER: GEOMETRÍA Y TIEMPO (21/10/2026).
 *
 * Medio campo en metros, con la portería arriba: `x` va de banda a banda
 * (0 la izquierda, 68 la derecha) e `y` desde la línea de fondo (0) hasta
 * el medio campo (52,5). El córner por defecto se saca desde la izquierda,
 * así que el primer palo es el de la izquierda; «Cambiar de lado» refleja
 * la rutina entera.
 *
 * Aquí no hay React: dónde está cada uno en el instante `t` (0 = antes del
 * saque, 1 = el remate), cómo vuela el balón y cómo se coloca el rival tipo
 * según la defensa contra la que se pensó la rutina. Lo usan la pizarra
 * grande (que se mueve) y las miniaturas de las tarjetas (que no).
 */

import type { TipoAbp } from "@/lib/abp-lab/referentes";
import type { Defensa, Fase, Papel, Punto, Rol, Rutina, Zona } from "@/lib/abp-lab/modelo";

export const ANCHO = 68;

export const LARGO = 52.5;

/* Las líneas que se pintan. */
export const AREA = { x0: 13.84, x1: 54.16, y: 16.5 };

export const AREA_PEQUENA = { x0: 24.84, x1: 43.16, y: 5.5 };

export const PORTERIA = { x0: 30.34, x1: 37.66 };

export const PENALTI: Punto = { x: 34, y: 11 };

/** Hasta dónde se ve el campo: con el saque de centro, el medio campo entero. */
export const fondoVisible = (tipo: TipoAbp) => (tipo === "saque" ? LARGO + 1 : 40);

/* Dónde cae cada zona (córner desde la izquierda). */
const ANCLA: Record<Zona, Punto> = {
  portero: { x: 34, y: 1.4 },
  "primer-palo": { x: 30.6, y: 3.6 },
  centro: { x: 34, y: 6.6 },
  "segundo-palo": { x: 38.6, y: 5 },
  frontal: { x: 34, y: 18.5 },
  corto: { x: 4.5, y: 3.5 },
  atras: { x: 34, y: 32 },
};

/** Dónde se golpea, según el tipo, si la rutina no lo dice. */
export function golpeoDe(tipo: TipoAbp): Punto {
  switch (tipo) {
    case "corner":
      return { x: 0.6, y: 0.6 };
    case "falta":
      return { x: 40, y: 23 };
    case "banda":
      return { x: 0, y: 20 };
    case "penalti":
      return PENALTI;
    case "saque":
      return { x: 34, y: LARGO };
  }
}

/** Adónde va el balón si no se ha dibujado nada: el centro del área pequeña, o la portería en el penalti. */
export function destinoBalonDe(tipo: TipoAbp): Punto {
  if (tipo === "penalti" || tipo === "falta") return { x: 35.5, y: 0.2 };

  if (tipo === "banda") return { x: 31, y: 6 };

  if (tipo === "saque") return { x: 22, y: 30 };

  return ANCLA.centro;
}

const redondea = (v: number) => Math.round(v * 10) / 10;

export const limita = (p: Punto): Punto => ({ x: redondea(Math.min(ANCHO, Math.max(0, p.x))), y: redondea(Math.min(LARGO, Math.max(0, p.y))) });

/**
 * Dónde arranca cada papel. Los que no se han colocado a mano salen de su
 * zona; si varios comparten zona, se abren en abanico para que no se tapen.
 */
export function salidas(roles: Rol[]): Punto[] {
  const total: Partial<Record<Zona, number>> = {};

  roles.forEach((r) => {
    if (r.x === undefined || r.y === undefined) total[r.zona] = (total[r.zona] ?? 0) + 1;
  });

  const cuenta: Partial<Record<Zona, number>> = {};

  return roles.map((r) => {
    if (r.x !== undefined && r.y !== undefined) return { x: r.x, y: r.y };

    const i = cuenta[r.zona] ?? 0;

    cuenta[r.zona] = i + 1;

    const n = total[r.zona] ?? 1;

    const base = ANCLA[r.zona];

    return limita({ x: base.x + (i - (n - 1) / 2) * 2.6, y: base.y + (i % 2 ? 1.2 : 0) });
  });
}

/** El punto de la zona, para colocar a alguien cuando se le cambia la zona en la lista. */
export const anclaDe = (zona: Zona): Punto => ANCLA[zona];

/* ------------------------------------------------------------------ */
/*  EL TIEMPO                                                          */
/* ------------------------------------------------------------------ */

/** Cuánto dura la jugada al reproducirla, en milisegundos. */
export const DURACION_MS = 3600;

/** El tramo de `t` en que se mueve cada fase. */
export const TRAMOS: Record<Fase, [number, number]> = {
  1: [0.04, 0.42],
  2: [0.36, 0.74],
  3: [0.7, 0.98],
};

/** Cuándo vuela el balón: sale con el golpeo y llega antes que el rechace. */
export const VUELO: [number, number] = [0.4, 0.76];

export const FASES: { key: Fase; label: string; corto: string }[] = [
  { key: 1, label: "Antes del saque", corto: "Antes" },
  { key: 2, label: "Con el golpeo", corto: "Golpeo" },
  { key: 3, label: "A por el rechace", corto: "Rechace" },
];

const suave = (u: number) => (u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2);

const avance = (t: number, [a, b]: [number, number]) => suave(Math.min(1, Math.max(0, (t - a) / (b - a))));

/** Dónde está cada papel en el instante `t`. */
export function posicionesEn(roles: Rol[], t: number): Punto[] {
  const desde = salidas(roles);

  return roles.map((r, i) => {
    if (r.hx === undefined || r.hy === undefined) return desde[i];

    const u = avance(t, TRAMOS[r.fase ?? 2]);

    return { x: desde[i].x + (r.hx - desde[i].x) * u, y: desde[i].y + (r.hy - desde[i].y) * u };
  });
}

/** El recorrido del balón, con el golpeo delante; si no hay nada dibujado, del golpeo a su destino tipo. */
export function recorridoBalon(r: Pick<Rutina, "tipo" | "balon">): Punto[] {
  if (r.balon && r.balon.length >= 2) return r.balon;

  const golpeo = r.balon?.[0] ?? golpeoDe(r.tipo);

  return [golpeo, destinoBalonDe(r.tipo)];
}

/** Dónde está el balón en `t`: recorre la línea quebrada a velocidad constante. */
export function balonEn(camino: Punto[], t: number): Punto {
  if (camino.length < 2) return camino[0] ?? { x: 0, y: 0 };

  const tramos = camino.slice(1).map((p, i) => Math.hypot(p.x - camino[i].x, p.y - camino[i].y));

  const total = tramos.reduce((a, b) => a + b, 0) || 1;

  let falta = avance(t, VUELO) * total;

  for (let i = 0; i < tramos.length; i++) {
    if (falta <= tramos[i] || i === tramos.length - 1) {
      const u = tramos[i] ? Math.min(1, falta / tramos[i]) : 1;

      return { x: camino[i].x + (camino[i + 1].x - camino[i].x) * u, y: camino[i].y + (camino[i + 1].y - camino[i].y) * u };
    }

    falta -= tramos[i];
  }

  return camino.at(-1)!;
}

/**
 * La curva de un centro: un arco suave entre dos puntos, hacia el lado de la
 * portería (cerrado) o hacia fuera (abierto). Sólo para dibujar.
 */
export function curvaBalon(a: Punto, b: Punto) {
  const mx = (a.x + b.x) / 2;

  const my = (a.y + b.y) / 2;

  const largo = Math.hypot(b.x - a.x, b.y - a.y);

  /* La normal, inclinada hacia la portería (y pequeñas). */
  let nx = -(b.y - a.y) / (largo || 1);

  let ny = (b.x - a.x) / (largo || 1);

  if (ny > 0) {
    nx = -nx;
    ny = -ny;
  }

  const comba = Math.min(5, largo * 0.12);

  return `M ${a.x} ${a.y} Q ${mx + nx * comba} ${my + ny * comba} ${b.x} ${b.y}`;
}

/* ------------------------------------------------------------------ */
/*  EL RIVAL TIPO                                                      */
/* ------------------------------------------------------------------ */

/** Los papeles nuestros que un marcador al hombre sigue (los que pisan el área). */
const PELIGROSOS: Papel[] = ["rematador", "bloqueador", "senuelo", "portero"];

/**
 * El rival como esquema, según contra qué defensa se pensó la rutina: no es
 * el rival de verdad (Wyscout no dice cómo defiende cada uno), es la defensa
 * tipo para ver la rutina contra ella. En la marca al hombre, cada marcador
 * va pegado a su atacante, un paso por el lado de la portería.
 */
export function rivalTipo(
  defensa: Defensa,
  nuestros: Punto[],
  roles: Rol[],
  tipo: TipoAbp,
  golpeo: Punto = golpeoDe(tipo),
): { punto: Punto; papel: "portero" | "zonal" | "marcador" }[] {
  if (tipo === "banda" || tipo === "saque" || tipo === "penalti") return [{ punto: { x: 34, y: 0.6 }, papel: "portero" }];

  const portero = { punto: { x: 34, y: 0.8 }, papel: "portero" as const };

  const linea = (n: number, x0: number, x1: number, y: number) =>
    Array.from({ length: n }, (_, i) => ({ punto: { x: n === 1 ? (x0 + x1) / 2 : x0 + ((x1 - x0) * i) / (n - 1), y }, papel: "zonal" as const }));

  const alHombre = () =>
    roles
      .map((r, i) => ({ r, p: nuestros[i] }))
      .filter(({ r, p }) => PELIGROSOS.includes(r.papel) && p.y < AREA.y + 3)
      .map(({ p }) => {
        /* Un paso hacia la portería, entre el atacante y el centro de la línea de gol. */
        const dx = 34 - p.x;

        const dy = 0 - p.y;

        const d = Math.hypot(dx, dy) || 1;

        return { punto: { x: p.x + (dx / d) * 1.1, y: p.y + (dy / d) * 1.1 }, papel: "marcador" as const };
      });

  if (tipo === "falta") {
    /* La barrera: a 9,15 m del balón, en la línea del balón al centro de la portería, de través. */
    const dx = 34 - golpeo.x;

    const dy = 0 - golpeo.y;

    const d = Math.hypot(dx, dy) || 1;

    const centro = { x: golpeo.x + (dx / d) * 9.15, y: golpeo.y + (dy / d) * 9.15 };

    const barrera = [-1.5, -0.5, 0.5, 1.5].map((k) => ({ punto: { x: centro.x + (-dy / d) * k * 0.75, y: centro.y + (dx / d) * k * 0.75 }, papel: "zonal" as const }));

    /* Si la falta es lejana o lateral, el resto defiende el área: en línea o al hombre. */
    const resto = defensa === "hombre" || defensa === "mixta" ? alHombre().slice(0, 5) : golpeo.y > 16 && Math.abs(golpeo.x - 34) < 14 ? [] : linea(5, 24, 44, 9);

    return [portero, ...barrera, ...resto];
  }

  switch (defensa) {
    case "zona":
      return [portero, ...linea(3, 27, 41, 2.6), ...linea(3, 28.5, 39.5, 6.2), { punto: { x: 30, y: 11 }, papel: "zonal" }, { punto: { x: 34, y: 17.5 }, papel: "zonal" }];
    case "mixta":
      return [portero, ...linea(4, 28, 40, 3.8), ...alHombre().slice(0, 4), { punto: { x: 34, y: 17.5 }, papel: "zonal" }];
    case "hombre":
      return [portero, { punto: { x: 30.6, y: 2.4 }, papel: "zonal" }, ...alHombre().slice(0, 7)];
    default:
      return [portero];
  }
}

/* ------------------------------------------------------------------ */
/*  EL ENCUADRE                                                        */
/* ------------------------------------------------------------------ */

export type Marco = { x: number; y: number; w: number; h: number };

/**
 * El trozo de campo que enseña la jugada: lo que se usa (sin la vigilancia,
 * que se queda lejos a propósito), con margen, la portería siempre dentro y
 * la proporción pedida. Así las miniaturas tienen todas el mismo alto y los
 * jugadores se ven grandes.
 */
export function encuadre(r: Pick<Rutina, "roles" | "balon" | "tipo">, aspecto: number, margen = 4.5): Marco {
  const desde = salidas(r.roles);

  const puntos: Punto[] = [
    ...desde.filter((_, i) => r.roles[i].papel !== "vigilancia"),
    ...r.roles.filter((x) => x.papel !== "vigilancia" && x.hx !== undefined && x.hy !== undefined).map((x) => ({ x: x.hx!, y: x.hy! })),
    ...recorridoBalon(r),
    { x: PORTERIA.x0, y: -1.6 },
    { x: PORTERIA.x1, y: 0 },
  ];

  let x0 = Math.min(...puntos.map((p) => p.x)) - margen;
  let x1 = Math.max(...puntos.map((p) => p.x)) + margen;
  const y0 = Math.min(...puntos.map((p) => p.y)) - margen * 0.6;
  let y1 = Math.max(...puntos.map((p) => p.y)) + margen;

  /* Nunca más estrecho que el área grande con su margen. */
  const minimo = AREA.x1 - AREA.x0 + 6;

  if (x1 - x0 < minimo) {
    const c = (x0 + x1) / 2;

    x0 = c - minimo / 2;
    x1 = c + minimo / 2;
  }

  /* La proporción: se ensancha o se alarga hacia el medio campo. */
  if ((x1 - x0) / (y1 - y0) < aspecto) {
    const w = (y1 - y0) * aspecto;

    const c = (x0 + x1) / 2;

    x0 = c - w / 2;
    x1 = c + w / 2;
  } else {
    y1 = y0 + (x1 - x0) / aspecto;
  }

  /* Dentro del campo (con su margen) mientras quepa. */
  const ancho = x1 - x0;

  if (ancho <= ANCHO + 4) {
    if (x0 < -2) {
      x1 += -2 - x0;
      x0 = -2;
    }

    if (x1 > ANCHO + 2) {
      x0 -= x1 - (ANCHO + 2);
      x1 = ANCHO + 2;
    }
  }

  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** La rutina vista desde el otro córner: todo reflejado de banda a banda. */
export function reflejada<T extends Pick<Rutina, "roles" | "balon" | "tipo">>(r: T): T {
  const espejo = (x: number) => redondea(ANCHO - x);

  const desde = salidas(r.roles);

  return {
    ...r,
    roles: r.roles.map((rol, i) => ({
      ...rol,
      x: espejo(desde[i].x),
      y: desde[i].y,
      ...(rol.hx !== undefined ? { hx: espejo(rol.hx) } : {}),
    })),
    balon: recorridoBalon(r).map((p) => ({ x: espejo(p.x), y: p.y })),
  };
}
