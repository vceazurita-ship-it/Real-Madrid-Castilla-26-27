/**
 * Que las fichas no se pisen en lo que se exporta (lámina, PDF, PowerPoint y
 * vídeo).
 *
 * Al exportar las fichas salen un 30 % más grandes para leerse desde el fondo
 * de la sala, y con los dos onces puestos un marcador y su marca quedaban uno
 * encima del otro: el 10 y el 9 nuestros tapaban al 8 y al 6 de ellos. Aquí se
 * abren lo justo para tocarse sin montarse, como mucho `EMPUJE_MAX` metros
 * cada una, para que la jugada siga siendo la que se dibujó. Sólo mueve lo
 * pintado: el documento no cambia. Balón y conos no se tocan.
 */

import type { TacticToken } from "./types";

/** Lo que se aparta como mucho cada ficha, en unidades del campo (≈ metros). */
const EMPUJE_MAX = 2.2;

export function separaParaExportar<T extends Pick<TacticToken, "id" | "x" | "y" | "kind">>(
  fichas: T[],
  diametro: number,
): T[] {
  const mueve = fichas.filter((f) => f.kind === "home" || f.kind === "away");

  if (mueve.length < 2) return fichas;

  const pos = new Map(mueve.map((f) => [f.id, { x: f.x, y: f.y, x0: f.x, y0: f.y }]));
  const lista = [...pos.values()];
  const minimo = diametro + 0.2;

  for (let vuelta = 0; vuelta < 40; vuelta += 1) {
    let movido = false;

    for (let i = 0; i < lista.length; i += 1) {
      for (let j = i + 1; j < lista.length; j += 1) {
        const a = lista[i];
        const b = lista[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let d = Math.hypot(dx, dy);

        if (d >= minimo) continue;

        /* Encima del todo: se abren en horizontal. */
        if (d < 1e-6) {
          dx = 1;
          dy = 0;
          d = 1;
        }

        const empuje = (minimo - d) / 2;
        const ux = dx / d;
        const uy = dy / d;

        const limita = (p: { x: number; y: number; x0: number; y0: number }, nx: number, ny: number) => {
          const ox = nx - p.x0;
          const oy = ny - p.y0;
          const o = Math.hypot(ox, oy);
          const k = o > EMPUJE_MAX ? EMPUJE_MAX / o : 1;

          return { x: p.x0 + ox * k, y: p.y0 + oy * k };
        };

        const na = limita(a, a.x - ux * empuje, a.y - uy * empuje);
        const nb = limita(b, b.x + ux * empuje, b.y + uy * empuje);

        if (Math.abs(na.x - a.x) + Math.abs(na.y - a.y) + Math.abs(nb.x - b.x) + Math.abs(nb.y - b.y) > 1e-4) movido = true;

        a.x = na.x;
        a.y = na.y;
        b.x = nb.x;
        b.y = nb.y;
      }
    }

    if (!movido) break;
  }

  return fichas.map((f) => {
    const p = pos.get(f.id);

    return p && (p.x !== f.x || p.y !== f.y) ? { ...f, x: p.x, y: p.y } : f;
  });
}
