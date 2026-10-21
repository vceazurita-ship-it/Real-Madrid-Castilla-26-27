/*
|--------------------------------------------------------------------------
| COLOCAR A UN EQUIPO EN UN DIBUJO (21/10/2026)
|--------------------------------------------------------------------------
|
| Pasar de 4-2-3-1 a 4-4-2 era mover diez fichas a mano, una a una, y cada
| arrastre un poco torcido. Ahora se elige el dibujo y el equipo se recoloca
| solo.
|
| **Se recoloca a los que ya están, no se crean otros.** Cada ficha conserva
| su nombre, su dorsal y su identificador, así que en una escena duplicada la
| animación enseña el cambio de dibujo moviéndose cada uno a su nuevo sitio.
| A cada ficha le toca el puesto más cercano a donde estaba, con el reparto
| que menos camino suma entre todos (no el primero que llega): así nadie cruza
| el campo para ocupar el sitio que tenía al lado su compañero.
|
| Si el equipo no tiene ninguna ficha, se ponen las once con la numeración de
| siempre (ver `numeraOnce`).
*/

import { formations } from "@/lib/formations";

import { numeraOnce } from "./dosOnces";
import { tacticId } from "./helpers";
import { PITCH_HEIGHT, type Point, type TacticToken } from "./types";

/** Los dibujos que se ofrecen, en el orden de la lista. */
export const DIBUJOS = Object.keys(formations);

/** Dónde se coloca el equipo. */
export type Encaje = "mitad" | "campo";

export const ENCAJE_LABEL: Record<Encaje, string> = {
  mitad: "En su mitad (frente al rival)",
  campo: "A lo largo del campo",
};

/*
| Un once de `formations` va del 12 % al 87 % del largo: es un equipo solo,
| atacando hacia la derecha. «En su mitad» lo comprime del 10 al 45, que es
| como se ponen dos equipos enfrentados sin meterse uno dentro del otro (lo
| mismo que hace `dosOnces`).
*/
function largo(porcentaje: number, encaje: Encaje) {
  if (encaje === "campo") return porcentaje;

  return 10 + ((porcentaje - 12) / (87 - 12)) * (45 - 10);
}

/** Los once sitios del dibujo para ese equipo, ya en metros del campo. */
export function sitiosDelDibujo(dibujo: string, kind: "home" | "away", encaje: Encaje): Point[] {
  const puestos = formations[dibujo] ?? [];

  return puestos.map((puesto) => {
    const x = largo(Number.parseFloat(puesto.left), encaje);
    const y = (Number.parseFloat(puesto.top) / 100) * PITCH_HEIGHT;

    /* El rival, media vuelta entera: su derecha es nuestra izquierda. */
    return kind === "home" ? { x, y } : { x: 100 - x, y: PITCH_HEIGHT - y };
  });
}

/**
 * El reparto que menos camino suma (método húngaro).
 *
 * `coste[i][j]` es lo que cuesta llevar la ficha `i` al sitio `j`. Funciona
 * con más sitios que fichas (las que sobran se quedan sin usar). Devuelve,
 * para cada ficha, el sitio que le toca.
 */
function reparto(coste: number[][]): number[] {
  const n = coste.length;
  const m = coste[0]?.length ?? 0;

  if (n === 0 || m === 0) return [];

  /* Implementación clásica con potenciales, filas = fichas (n ≤ m). */
  const u = new Array(n + 1).fill(0);
  const v = new Array(m + 1).fill(0);
  const p = new Array(m + 1).fill(0);
  const camino = new Array(m + 1).fill(0);

  for (let i = 1; i <= n; i += 1) {
    p[0] = i;

    let j0 = 0;
    const minimo = new Array(m + 1).fill(Infinity);
    const usado = new Array(m + 1).fill(false);

    do {
      usado[j0] = true;

      const i0 = p[j0];
      let delta = Infinity;
      let j1 = 0;

      for (let j = 1; j <= m; j += 1) {
        if (usado[j]) continue;

        const actual = coste[i0 - 1][j - 1] - u[i0] - v[j];

        if (actual < minimo[j]) {
          minimo[j] = actual;
          camino[j] = j0;
        }

        if (minimo[j] < delta) {
          delta = minimo[j];
          j1 = j;
        }
      }

      for (let j = 0; j <= m; j += 1) {
        if (usado[j]) {
          u[p[j]] += delta;
          v[j] -= delta;
        } else {
          minimo[j] -= delta;
        }
      }

      j0 = j1;
    } while (p[j0] !== 0);

    do {
      const j1 = camino[j0];
      p[j0] = p[j1];
      j0 = j1;
    } while (j0);
  }

  const salida = new Array(n).fill(-1);

  for (let j = 1; j <= m; j += 1) {
    if (p[j] > 0) salida[p[j] - 1] = j - 1;
  }

  return salida;
}

/** ¿Es el portero? Por el puesto que trae la ficha o, si no, por el dorsal. */
function esPortero(token: TacticToken) {
  const puesto = (token.posicion ?? "").toUpperCase();

  if (puesto) return /POR|PORTERO|GK|GOALKEEPER/.test(puesto);

  return token.label === "1" || token.label === "13";
}

/**
 * Coloca a un equipo en el dibujo pedido.
 *
 * Devuelve las fichas de la escena entera (las del otro equipo, el balón y los
 * conos, sin tocar) y cuántas se han movido o creado, para el aviso.
 */
export function colocaDibujo(
  tokens: TacticToken[],
  kind: "home" | "away",
  dibujo: string,
  encaje: Encaje,
): { tokens: TacticToken[]; movidas: number; creadas: number } {
  const sitios = sitiosDelDibujo(dibujo, kind, encaje);

  if (sitios.length === 0) return { tokens, movidas: 0, creadas: 0 };

  const equipo = tokens.filter((token) => token.kind === kind);

  if (equipo.length === 0) {
    const numeros = numeraOnce(formations[dibujo] ?? []);

    const nuevas: TacticToken[] = sitios.map((sitio, indice) => ({
      id: tacticId(kind === "home" ? "token-home" : "token-away"),
      kind,
      label: numeros[indice] ?? String(indice + 1),
      x: sitio.x,
      y: sitio.y,
    }));

    return { tokens: [...tokens, ...nuevas], movidas: 0, creadas: nuevas.length };
  }

  /*
  | El portero va a la portería, siempre. Sin esto, con el equipo adelantado
  | el reparto de menor camino podía mandar a un central bajo palos y al
  | portero a la defensa, porque estaba más cerca.
  */
  const indicePorteria = 0; /* En `formations` el primer puesto es el portero. */
  const portero = equipo.find(esPortero);
  const resto = portero ? equipo.filter((token) => token !== portero) : equipo;
  const sitiosResto = portero ? sitios.filter((_, indice) => indice !== indicePorteria) : sitios;

  /* Más fichas que sitios: se colocan las más cercanas y el resto se queda. */
  const ordenadas = [...resto];
  const usadas = ordenadas.slice(0, sitiosResto.length);

  const coste = usadas.map((token) =>
    sitiosResto.map((sitio) => (token.x - sitio.x) ** 2 + (token.y - sitio.y) ** 2),
  );

  const asignado = reparto(coste);
  const destino = new Map<string, Point>();

  usadas.forEach((token, indice) => {
    const sitio = sitiosResto[asignado[indice]];

    if (sitio) destino.set(token.id, sitio);
  });

  if (portero) destino.set(portero.id, sitios[indicePorteria]);

  return {
    tokens: tokens.map((token) => {
      const sitio = destino.get(token.id);

      return sitio ? { ...token, x: sitio.x, y: sitio.y } : token;
    }),
    movidas: destino.size,
    creadas: 0,
  };
}
