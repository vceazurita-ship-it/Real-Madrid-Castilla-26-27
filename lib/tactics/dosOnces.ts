/*
|--------------------------------------------------------------------------
| DOS ONCES ENFRENTADOS, YA PUESTOS
|--------------------------------------------------------------------------
|
| La pizarra táctica se abría vacía. Para explicar cualquier cosa —una salida
| de balón, una presión, un balón parado— lo primero era colocar veintidós
| fichas a mano, y eso delante del grupo son dos minutos de reloj mirando a
| alguien arrastrar círculos.
|
| Desde el enlace de la portada se abre ya con los dos equipos puestos en
| 1-4-2-3-1: el nuestro atacando a la derecha y el rival enfrente. Lo que no
| valga se mueve o se borra, que es mucho más rápido que ponerlo.
|
| Las posiciones salen de `lib/formations`, las mismas que usa la pizarra de
| competición, para que un 4-2-3-1 esté en el mismo sitio en las dos pantallas.
*/

import { formations } from "@/lib/formations";

import { PITCH_HEIGHT, type TacticToken } from "./types";

/** El dibujo del que se parte. */
export const DIBUJO_DE_PARTIDA = "4-2-3-1";

/*
| Cada equipo, en su mitad.
|
| Un once de `formations` ocupa el campo entero —del 12 % al 87 %— porque está
| pensado para dibujar a UN equipo. Puestos los dos así, se meten el uno dentro
| del otro: al pintarlo salía el delantero rival encima de nuestro portero,
| tapándolo. Se comprime cada uno en su mitad, como se colocan de verdad en el
| saque de centro. El portero no arranca pegado al fondo: la barra de
| herramientas flota sobre ese borde del campo y lo tapaba.
*/
const NUESTRO_DESDE = 10;
const NUESTRO_HASTA = 45;

function comprime(porcentaje: number, desde: number, hasta: number) {
  /* El once original va del 12 al 87; se lleva al tramo que se pida. */
  const proporcion = (porcentaje - 12) / (87 - 12);

  return desde + proporcion * (hasta - desde);
}

/**
 * Los veintidós, en el dibujo que se pida.
 *
 * El identificador lleva el equipo dentro para que las dos fichas del mismo
 * puesto —nuestro central y el suyo— no compartan clave: la animación entre
 * escenas empareja por identificador, y con la clave repetida una ficha
 * saltaría de un campo al otro.
 */
export function dosOnces(dibujo = DIBUJO_DE_PARTIDA): TacticToken[] {
  const puestos = formations[dibujo] ?? formations[DIBUJO_DE_PARTIDA] ?? [];

  const nuestros: TacticToken[] = puestos.map((puesto) => ({
    id: `once-home-${puesto.id}`,
    kind: "home" as const,
    label: puesto.nombre,
    nombre: puesto.nombre,
    x: comprime(Number.parseFloat(puesto.left), NUESTRO_DESDE, NUESTRO_HASTA),
    y: (Number.parseFloat(puesto.top) / 100) * PITCH_HEIGHT,
  }));

  /*
  | El rival, girado media vuelta. Los dos ejes, no sólo el ancho.
  |
  | Girando sólo el ancho, su lateral izquierdo se quedaba en la misma banda
  | que el nuestro, y eso es su lateral derecho: cuando dos equipos se miran de
  | frente, la izquierda de uno es la derecha del otro. Media vuelta entera
  | —ancho y alto— los pone donde de verdad se colocan.
  */
  const suyos: TacticToken[] = nuestros.map((ficha, indice) => ({
    ...ficha,
    id: `once-away-${puestos[indice].id}`,
    kind: "away" as const,
    x: 100 - ficha.x,
    y: PITCH_HEIGHT - ficha.y,
  }));

  return [...nuestros, ...suyos];
}
