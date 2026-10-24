/**
 * LA CÁMARA DEL LABORATORIO (24/10/2026).
 *
 * La pizarra del taller se dibuja con su propia proyección, sin CSS 3D ni
 * WebGL: así el SVG sigue siendo uno solo (se exporta a PNG, PDF, vídeo y GIF
 * igual que se ve) y el puntero se traduce a metros con la inversa exacta,
 * también con la cámara inclinada (`desproy`).
 *
 * - **Cenital**: el plano de siempre, en metros. La altura (el balón por el
 *   aire) se ve como un desplazamiento hacia arriba con su sombra en el suelo.
 * - **Televisión**: cámara alta detrás de la jugada, mirando a la portería.
 * - **A pie de campo**: baja, detrás de los atacantes; la que ve el jugador.
 *
 * Coordenadas del campo en metros (`campo.ts`): x de banda a banda, y desde la
 * línea de fondo, z hacia arriba.
 */

import type { Marco } from "@/lib/abp-lab/campo";
import type { Punto } from "@/lib/abp-lab/modelo";

export type Vista = "cenital" | "tv" | "pie";

export const VISTAS: { key: Vista; label: string; corto: string }[] = [
  { key: "cenital", label: "Cenital", corto: "2D" },
  { key: "tv", label: "Televisión", corto: "TV" },
  { key: "pie", label: "A pie de campo", corto: "Pie" },
];

export type P3 = { x: number; y: number; z?: number };

/** Un punto en pantalla (unidades del viewBox) y cuántas unidades mide un metro allí. */
export type Proyectado = { x: number; y: number; s: number };

export type Camara = {
  vista: Vista;
  tresD: boolean;
  /** El viewBox. */
  caja: Marco;
  proy: (p: P3) => Proyectado;
  /** De la pantalla (unidades del viewBox) al suelo, en metros; null si el rayo no toca el césped. */
  desproy: (sx: number, sy: number) => Punto | null;
  /** Unidades de pantalla por metro, de media en la jugada (para grosores y desenfoques). */
  escala: number;
  /** Hasta dónde se puede dibujar el césped hacia el medio campo sin pasar por detrás de la cámara. */
  yMax: number;
};

/** En cenital la altura se dibuja como un desplazamiento hacia arriba: un tercio de metro por metro. */
const OBLICUO = 0.32;

type V3 = [number, number, number];

const resta = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

const punto3 = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

const cruz = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

const unidad = (a: V3): V3 => {
  const n = Math.hypot(a[0], a[1], a[2]) || 1;

  return [a[0] / n, a[1] / n, a[2] / n];
};

/** Cuánto mide de ancho la pantalla por unidad de profundidad (distancia focal en unidades del viewBox). */
const FOCAL = 100;

/** La caja que contiene unos puntos, ensanchada o alargada hasta la proporción pedida. */
function cajaCon(puntos: { x: number; y: number }[], aspecto: number, margen: number): Marco {
  let x0 = Math.min(...puntos.map((p) => p.x)) - margen;
  let x1 = Math.max(...puntos.map((p) => p.x)) + margen;
  let y0 = Math.min(...puntos.map((p) => p.y)) - margen;
  let y1 = Math.max(...puntos.map((p) => p.y)) + margen;

  if ((x1 - x0) / (y1 - y0) < aspecto) {
    const w = (y1 - y0) * aspecto;
    const c = (x0 + x1) / 2;

    x0 = c - w / 2;
    x1 = c + w / 2;
  } else {
    const h = (x1 - x0) / aspecto;
    const c = (y0 + y1) / 2;

    y0 = c - h / 2;
    y1 = c + h / 2;
  }

  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/**
 * La cámara para un trozo de campo (`marco`, en metros) y una proporción de
 * pantalla. Con «cenital» es la identidad; con las otras dos, una cámara de
 * agujero mirando a la portería, encuadrada para que el trozo quepa entero.
 */
export function creaCamara(vista: Vista, marco: Marco, aspecto: number, foco?: Punto[]): Camara {
  if (vista === "cenital") {
    return {
      vista,
      tresD: false,
      caja: marco,
      escala: 1,
      yMax: Infinity,
      proy: (p) => ({ x: p.x, y: p.y - (p.z ?? 0) * OBLICUO, s: 1 }),
      desproy: (sx, sy) => ({ x: sx, y: sy }),
    };
  }

  /*
   * Lo que interesa: los puntos de la jugada (`foco`) o, si no los hay, el
   * trozo entero; con la portería siempre a la vista. Lo de muy atrás (la
   * vigilancia) no manda en el plano.
   */
  const puntos = (
    foco?.length
      ? foco
      : [
          { x: marco.x, y: Math.max(0, marco.y) },
          { x: marco.x + marco.w, y: Math.max(0, marco.y) },
          { x: marco.x, y: Math.min(26, marco.y + marco.h) },
          { x: marco.x + marco.w, y: Math.min(26, marco.y + marco.h) },
        ]
  ).filter((p) => p.y <= 26);

  const xs = puntos.length ? puntos.map((p) => p.x) : [20, 48];

  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;

  const fondo = Math.max(10, Math.min(vista === "pie" ? 16 : 26, Math.max(...puntos.map((p) => p.y), 10)));

  const ojo: V3 = vista === "tv" ? [cx * 0.7 + 34 * 0.3, fondo + 12, 10 + fondo * 0.2] : [cx * 0.4 + 34 * 0.6, fondo + 4, 2.8];

  const mira: V3 = vista === "tv" ? [cx * 0.85 + 34 * 0.15, Math.max(3, fondo * 0.3), 0] : [cx * 0.3 + 34 * 0.7, 2, 1.2];

  const f = unidad(resta(mira, ojo));

  /* La derecha de la pantalla es la x creciente del campo, como en el plano. */
  let r = unidad(cruz(f, [0, 0, 1]));

  if (r[0] < 0) r = [-r[0], -r[1], -r[2]];

  let u = unidad(cruz(r, f));

  /* Y la de arriba, hacia el cielo. */
  if (u[2] < 0) u = [-u[0], -u[1], -u[2]];

  const crudo = (p: P3): Proyectado => {
    const v = resta([p.x, p.y, p.z ?? 0], ojo);

    const zc = Math.max(0.6, punto3(v, f));

    return { x: (FOCAL * punto3(v, r)) / zc, y: (-FOCAL * punto3(v, u)) / zc, s: FOCAL / zc };
  };

  /*
   * El encuadre: los puntos de la jugada (en el suelo y a la altura de la
   * cabeza, donde va la ficha) y la portería. A pie de campo sólo cuenta lo
   * que queda delante del ojo.
   */
  const delante = puntos.filter((p) => p.y < ojo[1] - 4);

  const esquinas: P3[] = [
    ...delante.flatMap((p) => [
      { x: p.x, y: p.y, z: 0 },
      { x: p.x, y: p.y, z: 2.6 },
    ]),
    { x: 29, y: -1.8, z: 2.8 },
    { x: 39, y: -1.8, z: 2.8 },
    { x: 29, y: 0, z: 0 },
    { x: 39, y: 0, z: 0 },
  ];

  const enPantalla = esquinas.map(crudo);

  const borde = cajaCon(enPantalla, aspecto, 0);

  const caja = cajaCon(enPantalla, aspecto, borde.w * 0.07);

  const centro = crudo({ x: cx, y: fondo * 0.4 });

  return {
    vista,
    tresD: true,
    caja,
    escala: centro.s,
    yMax: ojo[1] - 3,
    proy: crudo,
    desproy: (sx, sy) => {
      /* El rayo desde el ojo por ese punto de la pantalla, cortado con el césped (z = 0). */
      const d: V3 = [r[0] * (sx / FOCAL) - u[0] * (sy / FOCAL) + f[0], r[1] * (sx / FOCAL) - u[1] * (sy / FOCAL) + f[1], r[2] * (sx / FOCAL) - u[2] * (sy / FOCAL) + f[2]];

      if (d[2] >= -1e-6) return null;

      const k = -ojo[2] / d[2];

      return { x: ojo[0] + d[0] * k, y: ojo[1] + d[1] * k };
    },
  };
}

/** Una línea del campo en pantalla: proyecta sus extremos (una recta sigue siendo recta en perspectiva). */
export function linea(cam: Camara, a: P3, b: P3) {
  const p = cam.proy(a);
  const q = cam.proy(b);

  return `M ${p.x.toFixed(3)} ${p.y.toFixed(3)} L ${q.x.toFixed(3)} ${q.y.toFixed(3)}`;
}

/** Un polígono del suelo (o en el aire) en pantalla. */
export function poligono(cam: Camara, puntos: P3[]) {
  return puntos
    .map((p, i) => {
      const q = cam.proy(p);

      return `${i ? "L" : "M"} ${q.x.toFixed(3)} ${q.y.toFixed(3)}`;
    })
    .join(" ")
    .concat(" Z");
}

/** Un arco o una curva cualquiera, muestreado. */
export function curva(cam: Camara, f: (u: number) => P3, pasos = 24) {
  return Array.from({ length: pasos + 1 }, (_, i) => {
    const q = cam.proy(f(i / pasos));

    return `${i ? "L" : "M"} ${q.x.toFixed(3)} ${q.y.toFixed(3)}`;
  }).join(" ");
}

/**
 * El paso de una cámara a otra (la transición suave al cambiar de plano o de
 * encuadre): cada punto se proyecta con las dos, se lleva a la caja de la de
 * llegada y se interpola. Las rectas siguen siendo rectas en las dos puntas;
 * por el camino el campo «vuela» de un plano al otro, como una grúa.
 * Mientras dura no se edita (`desproy` no devuelve nada).
 */
export function mezclaCamaras(a: Camara, b: Camara, k: number): Camara {
  if (k >= 1) return b;

  const enB = (c: Camara, p: P3): Proyectado => {
    const q = c.proy(p);

    const ex = b.caja.w / c.caja.w;

    const ey = b.caja.h / c.caja.h;

    return { x: b.caja.x + (q.x - c.caja.x) * ex, y: b.caja.y + (q.y - c.caja.y) * ey, s: q.s * ex };
  };

  const mezcla = (x: number, y: number) => x + (y - x) * k;

  return {
    vista: b.vista,
    tresD: b.tresD,
    caja: b.caja,
    escala: mezcla(a.escala * (b.caja.w / a.caja.w), b.escala),
    yMax: Math.min(a.yMax, b.yMax),
    proy: (p) => {
      const pa = enB(a, p);

      const pb = enB(b, p);

      return { x: mezcla(pa.x, pb.x), y: mezcla(pa.y, pb.y), s: mezcla(pa.s, pb.s) };
    },
    desproy: () => null,
  };
}
