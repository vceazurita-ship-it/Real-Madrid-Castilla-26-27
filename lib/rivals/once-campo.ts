/*
|--------------------------------------------------------------------------
| COLOCACIÓN DEL ONCE EN EL CAMPO
|--------------------------------------------------------------------------
|
| Dónde cae cada jugador dentro del campo del PDF. Lo comparten el pop-up que
| se abre antes de exportar —donde se arrastra a la gente— y el propio PDF: si
| cada uno colocara por su cuenta, lo que se ve al mover no sería lo que sale
| en la hoja, que es justo lo que se pide del pop-up.
|
| Todo va en tanto por uno del ancho y del alto del campo. Así el mismo
| reparto vale para el campo de 344 × 632 pt del PDF y para el del pop-up, que
| mide lo que dé la pantalla.
|
| El campograma de la pantalla de `/rivals` reparte a toda la plantilla con su
| propio motor (`layoutPitch`); aquí sólo entran los del once, así que basta
| con repartir cada línea a lo ancho. Lo único que hay que respetar es el
| lado: un lateral izquierdo dibujado a la derecha se lee mal aunque el nombre
| esté bien.
*/

import type { OncePos } from "@/lib/rivals/once";

export type OnceLinea = "portero" | "defensa" | "medio" | "ataque";

/* De atrás hacia adelante: es como se lee un once. */
export const LINEA_ORDEN: OnceLinea[] = [
  "portero",
  "defensa",
  "medio",
  "ataque",
];

export const LINEA_LABEL: Record<OnceLinea, string> = {
  portero: "PORTERÍA",
  defensa: "DEFENSA",
  medio: "MEDIO CAMPO",
  ataque: "ATAQUE",
};

/** Altura de cada línea dentro del campo, con el ataque hacia arriba. */
export const LINEA_Y: Record<OnceLinea, number> = {
  portero: 0.88,
  defensa: 0.66,
  medio: 0.43,
  ataque: 0.2,
};

/*
| Códigos que llevan banda dentro. Se miraba la última letra —"acaba en D, a
| la derecha"—, pero eso manda a la banda a MCD (mediocentro *defensivo*) y a
| SD (*segundo* delantero), que juegan por dentro: el once salía con el pivote
| escorado a la derecha y un interior de menos en el centro.
*/
const POS_IZQUIERDA = new Set(["LI", "EI"]);
const POS_DERECHA = new Set(["LD", "ED"]);

/** Izquierda 0, centro 1, derecha 2. Sale del código corto de la posición. */
export function ladoDe(posCode: string): number {
  if (POS_IZQUIERDA.has(posCode)) return 0;
  if (POS_DERECHA.has(posCode)) return 2;

  return 1;
}

/** Ordena una línea por bandas, dejando el orden de entrada como desempate. */
export function reparteLinea<T extends { posCode: string }>(jugadores: T[]): T[] {
  return jugadores
    .map((jugador, indice) => ({ jugador, indice }))
    .sort((a, b) => {
      const lado = ladoDe(a.jugador.posCode) - ladoDe(b.jugador.posCode);

      return lado !== 0 ? lado : a.indice - b.indice;
    })
    .map((item) => item.jugador);
}

/** Lo mínimo que hace falta saber de un jugador para colocarlo. */
export type CampoJugador = {
  clave: string;
  posCode: string;
  linea: OnceLinea | null;
};

export type CampoSitio = OncePos & {
  /**
   * Sitio a lo ancho que le toca en su línea, también en tanto por uno. Es lo
   * que puede ocupar el nombre antes de pisar al vecino.
   */
  ancho: number;
};

/*
| Aire a los dos lados del campo: 13 de los 344 pt que mide el campo del PDF.
| Sin él, el lateral de la banda sale con media cara fuera del césped.
*/
const BORDE = 13 / 344;

/**
 * Reparte a los que se pintan en el campo.
 *
 * Primero coloca cada línea sola, a partes iguales y respetando la banda; a
 * quien tenga sitio puesto a mano se le respeta el suyo. Lo que **no** hace
 * es recolocar al resto cuando se mueve a uno: arrastrar a un central no
 * puede empujar a los otros tres, o el once dejaría de parecerse a lo que se
 * acaba de soltar.
 */
export function reparteCampo(
  jugadores: CampoJugador[],
  manual: Record<string, OncePos> = {}
): Map<string, CampoSitio> {
  const sitios = new Map<string, CampoSitio>();

  LINEA_ORDEN.forEach((linea) => {
    const enLinea = reparteLinea(
      jugadores.filter((jugador) => jugador.linea === linea)
    );

    if (!enLinea.length) return;

    const paso = (1 - BORDE * 2) / enLinea.length;

    enLinea.forEach((jugador, i) => {
      const puesto = manual[jugador.clave];

      sitios.set(jugador.clave, {
        x: puesto ? puesto.x : BORDE + paso * (i + 0.5),
        y: puesto ? puesto.y : LINEA_Y[linea],
        ancho: paso,
      });
    });
  });

  return sitios;
}

/*
| Quien entra al campo desde la lista de dudas lo hace SIN sitio propio: así
| `reparteCampo` vuelve a repartir su línea entera a partes iguales y la fila
| no queda apretujada contra el vecino. Para un sitio concreto está el
| arrastre, que sí escribe una posición a mano.
*/
