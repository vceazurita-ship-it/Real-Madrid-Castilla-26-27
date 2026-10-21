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

/*
| ALTURA Y FASE (21/10/2026)
|
| «En su mitad / Todo el campo» no decía cómo está el equipo: el «4-4-2 para
| presionar la salida» se colocaba en bloque bajo, al borde de nuestra área,
| y lo que contaba la nota no era lo que se veía. Ahora se elige la altura
| del bloque —dónde está la línea defensiva, en metros desde nuestra
| portería— y la fase: sin balón el equipo se junta (corto y estrecho), con
| balón se abre a lo largo y a lo ancho.
*/

/** Altura del bloque: la línea defensiva, a tantos metros de su portería. */
export type Altura = "alto" | "medio" | "bajo";
export type Fase = "sin" | "con";

export const ALTURA_LABEL: Record<Altura, string> = { alto: "Bloque alto", medio: "Bloque medio", bajo: "Bloque bajo" };
export const FASE_LABEL: Record<Fase, string> = { sin: "Sin balón", con: "Con balón" };

/** Metros de la línea defensiva a su portería. */
const LINEA: Record<Altura, number> = { alto: 45, medio: 35, bajo: 22 };

/** Metros de la línea defensiva a la delantera: sin balón, junto; con balón, largo. */
const LARGO_BLOQUE: Record<Fase, number> = { sin: 30, con: 42 };

/** Cuánto del ancho del campo ocupa el equipo (1 = todo lo que da el dibujo). */
const ANCHO_BLOQUE: Record<Fase, number> = { sin: 0.78, con: 1 };

const LARGO_CAMPO_M = 105;

/** Lo que mide el campo de la pizarra (100) en metros de verdad (105). */
const aUnidades = (metros: number) => (metros / LARGO_CAMPO_M) * 100;

/** Separación mínima entre dos de un mismo equipo, en metros. */
const SEPARACION_M = 6;

/** Los once sitios del dibujo para ese equipo, ya en unidades del campo. */
export function sitiosDelDibujo(dibujo: string, kind: "home" | "away", altura: Altura, fase: Fase): Point[] {
  const puestos = formations[dibujo] ?? [];

  const linea = LINEA[altura] + (fase === "con" ? 8 : 0);
  /* La delantera nunca más allá de 6 m de la portería contraria. */
  const largo = Math.min(LARGO_BLOQUE[fase], LARGO_CAMPO_M - 6 - linea);
  const portero = Math.min(16, Math.max(5, linea * 0.32));

  /* En `formations` la defensa va al 23 % y la delantera al 82 %. */
  const DEFENSA = 23;
  const DELANTERA = 82;

  const sitios = puestos.map((puesto, indice) => {
    const izquierda = Number.parseFloat(puesto.left);
    const arriba = Number.parseFloat(puesto.top) / 100;

    const metros =
      indice === 0
        ? portero
        : linea + Math.max(0, Math.min(1, (izquierda - DEFENSA) / (DELANTERA - DEFENSA))) * largo;

    const x = aUnidades(metros);
    const y = PITCH_HEIGHT / 2 + (arriba - 0.5) * PITCH_HEIGHT * (indice === 0 ? 1 : ANCHO_BLOQUE[fase]);

    return { x, y };
  });

  const separados = separa(sitios);

  /* El rival, media vuelta entera: su derecha es nuestra izquierda. */
  return kind === "home" ? separados : separados.map(({ x, y }) => ({ x: 100 - x, y: PITCH_HEIGHT - y }));
}

/**
 * Aparta a los que quedan montados (21/10/2026: el 4-4-2 comprimido ponía al
 * 4 encima del 6 y al 5 encima del 8). Empuja a lo largo, que es lo que
 * separa dos líneas, hasta que entre los dos hay `SEPARACION_M`.
 */
function separa(sitios: Point[]): Point[] {
  const salida = sitios.map((sitio) => ({ ...sitio }));
  const minimo = aUnidades(SEPARACION_M);

  for (let vuelta = 0; vuelta < 6; vuelta += 1) {
    let movido = false;

    for (let i = 0; i < salida.length; i += 1) {
      for (let j = i + 1; j < salida.length; j += 1) {
        const dx = (salida[j].x - salida[i].x) * 1.05;
        const dy = salida[j].y - salida[i].y;
        const d = Math.hypot(dx, dy);

        if (d >= SEPARACION_M) continue;

        /* El de más adelante sube y el de atrás baja, lo que falte entre los dos. */
        const falta = (minimo - Math.abs(salida[j].x - salida[i].x)) / 2;
        const [atras, delante] = salida[i].x <= salida[j].x ? [i, j] : [j, i];

        salida[atras].x = Math.max(1, salida[atras].x - falta);
        salida[delante].x = Math.min(99, salida[delante].x + falta);
        movido = true;
      }
    }

    if (!movido) break;
  }

  return salida;
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
  altura: Altura,
  fase: Fase,
): { tokens: TacticToken[]; movidas: number; creadas: number } {
  const sitios = sitiosDelDibujo(dibujo, kind, altura, fase);

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
