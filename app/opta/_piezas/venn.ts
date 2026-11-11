/**
 * La geometría del Venn de tres círculos (dominio, peligro, solidez) que
 * comparten el de equipos (`Estilos.tsx`) y el de jugadores
 * (`EstilosJugadores.tsx`). Fija: se calcula una vez por tamaño de ficha.
 */

import type { Indice } from "@/lib/opta-estilos";

export const ANCHO = 600;
export const ALTO = 540;
export const RADIO = 168;
export const CIRCULOS: { clave: Indice; cx: number; cy: number; color: string }[] = [
  { clave: "dominio", cx: 222, cy: 200, color: "#4F8FE8" },
  { clave: "peligro", cx: 378, cy: 200, color: "#E0614B" },
  { clave: "solidez", cx: 300, cy: 335, color: "#2BA88E" },
];

export const REGIONES: { m: number; nombre: string }[] = [
  { m: 7, nombre: "Los tres" },
  { m: 3, nombre: "Dominio y peligro" },
  { m: 5, nombre: "Dominio y solidez" },
  { m: 6, nombre: "Peligro y solidez" },
  { m: 1, nombre: "Sólo dominio" },
  { m: 2, nombre: "Sólo peligro" },
  { m: 4, nombre: "Sólo solidez" },
];

/** Máscara de pertenencia: bit 0 dominio, 1 peligro, 2 solidez (null si cae en el borde). */
const mascaraDe = (x: number, y: number, margen: number): number | null => {
  let m = 0;
  for (let i = 0; i < CIRCULOS.length; i++) {
    const c = CIRCULOS[i];
    const d = Math.hypot(x - c.cx, y - c.cy);
    if (Math.abs(d - RADIO) < margen) return null;
    if (d < RADIO) m |= 1 << i;
  }
  return m;
};

const cache = new Map<number, Map<number, [number, number][]>>();

/** Los puntos de cada región (con margen al borde), ordenados del centro hacia fuera. */
function puntos(ficha: number): Map<number, [number, number][]> {
  const hecho = cache.get(ficha);
  if (hecho) return hecho;
  const porRegion = new Map<number, [number, number][]>();
  for (let x = 6; x < ANCHO; x += 3)
    for (let y = 6; y < ALTO; y += 3) {
      const m = mascaraDe(x, y, ficha / 2 + 1);
      if (m == null || m === 0) continue;
      const lista = porRegion.get(m);
      if (lista) lista.push([x, y]);
      else porRegion.set(m, [[x, y]]);
    }
  for (const [m, ps] of porRegion) {
    const cx = ps.reduce((s, p) => s + p[0], 0) / ps.length;
    const cy = ps.reduce((s, p) => s + p[1], 0) / ps.length;
    ps.sort((a, b) => Math.hypot(a[0] - cx, a[1] - cy) - Math.hypot(b[0] - cx, b[1] - cy));
    porRegion.set(m, ps);
  }
  cache.set(ficha, porRegion);
  return porRegion;
}

/** Coloca `n` fichas de diámetro `ficha` en la región `m` sin que se pisen (cada vez más juntas si no caben). */
export function coloca(m: number, n: number, ficha: number): [number, number][] {
  const ps = puntos(ficha).get(m) ?? [];
  for (const sep of [ficha + 4, ficha + 1, ficha - 4, ficha - 8].filter((s) => s > 4)) {
    const elegidos: [number, number][] = [];
    for (const p of ps) {
      if (elegidos.every((q) => Math.hypot(p[0] - q[0], p[1] - q[1]) >= sep)) elegidos.push(p);
      if (elegidos.length === n) return elegidos;
    }
  }
  /* No caben: en fila desde el centro. */
  const [x0, y0] = ps[0] ?? [ANCHO / 2, ALTO / 2];
  const paso = Math.max(6, ficha - 6);
  return Array.from({ length: n }, (_, i) => [x0 + ((i % 5) - 2) * paso, y0 + Math.floor(i / 5) * paso] as [number, number]);
}
