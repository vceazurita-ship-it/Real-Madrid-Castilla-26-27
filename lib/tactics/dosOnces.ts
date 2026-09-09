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

/*
| LAS FICHAS LLEVAN EL NÚMERO, NO EL PUESTO
|
| Dentro de la ficha cabe poco: «MCD» y «DFC» se leen a un palmo y desde el
| fondo de la sala no se distinguen, y encima repiten —hay dos MCD y dos DFC,
| así que la pizarra tenía cuatro fichas con dos rótulos—. Un número se lee de
| lejos y nombra a uno solo, que es de lo que se habla: «el 6 sube, el 10 cae».
|
| No son 1…11 corridos: es la numeración de siempre —2 el lateral derecho, 3 el
| izquierdo, 6 el pivote, 10 la media punta—, la que el jugador ya tiene en la
| cabeza. El puesto no se pierde: sigue en el nombre de la ficha, que es lo que
| sale al pasar por encima.
*/
const NUMEROS_POR_PUESTO: Record<string, number[]> = {
  POR: [1],
  LD: [2],
  CAD: [2, 7],
  LI: [3],
  CAI: [3, 11],
  DFC: [4, 5, 6],
  MCD: [6, 8],
  MC: [8, 6, 5, 10],
  MD: [7],
  ED: [7],
  MI: [11],
  EI: [11],
  MCO: [10],
  DC: [9, 10, 7],
};

/**
 * El número de cada uno de los once, en el orden en que vienen.
 *
 * Cada puesto pide los suyos por orden de preferencia y se queda con el
 * primero libre; lo que no encaje —un dibujo con tres puntas, un puesto que
 * no esté en la tabla— coge el número más bajo que quede. Así nunca se
 * repiten dos dentro del mismo equipo, que es lo único que no puede pasar.
 */
function numeraOnce(puestos: { nombre: string }[]): string[] {
  const dados = new Set<number>();
  const salida: (number | null)[] = puestos.map(() => null);

  /*
  | Primero el número propio de cada puesto, y sólo ése.
  |
  | Repartiendo de una pasada, el primero que llegaba se llevaba lo que le
  | apeteciera y dejaba al de después sin lo suyo: en un 4-3-3, el segundo
  | interior se quedaba con el 7 y el extremo derecho —que es EL 7— acababa
  | con el 10. Con la primera vuelta reservada a las primeras opciones, cada
  | puesto se queda con el número por el que se le conoce y los empates se
  | resuelven después.
  */
  puestos.forEach((puesto, indice) => {
    const suyo = (NUMEROS_POR_PUESTO[puesto.nombre] ?? [])[0];

    if (suyo === undefined || dados.has(suyo)) return;

    dados.add(suyo);
    salida[indice] = suyo;
  });

  const libre = () => {
    for (let numero = 1; numero <= 99; numero += 1) {
      if (!dados.has(numero)) return numero;
    }

    return 0;
  };

  /* Y los que se quedaron sin él: su siguiente opción, o el más bajo libre. */
  puestos.forEach((puesto, indice) => {
    if (salida[indice] !== null) return;

    const preferidos = NUMEROS_POR_PUESTO[puesto.nombre] ?? [];

    const suyo = preferidos.find((numero) => !dados.has(numero)) ?? libre();

    dados.add(suyo);
    salida[indice] = suyo;
  });

  return salida.map((numero) => String(numero ?? 0));
}

/**
 * Qué número lleva cada ficha del once, por su identificador.
 *
 * Sirve para ponerle los números a un tablero que ya estaba pintado: los
 * primeros onces se colocaron con el puesto dentro de la ficha, y quien tenga
 * ese tablero guardado no va a borrarlo para que se le pinte otra vez.
 */
export function numerosDelOnce(dibujo = DIBUJO_DE_PARTIDA): Record<string, string> {
  const puestos = formations[dibujo] ?? formations[DIBUJO_DE_PARTIDA] ?? [];

  const numeros = numeraOnce(puestos);

  const mapa: Record<string, string> = {};

  puestos.forEach((puesto, indice) => {
    mapa[`once-home-${puesto.id}`] = numeros[indice];
    mapa[`once-away-${puesto.id}`] = numeros[indice];
  });

  return mapa;
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

  const numeros = numeraOnce(puestos);

  const nuestros: TacticToken[] = puestos.map((puesto, indice) => ({
    id: `once-home-${puesto.id}`,
    kind: "home" as const,
    /*
    | El número dentro de la ficha, y nada debajo.
    |
    | El puesto se pintaba bajo cada ficha, y con veintidós puestas eso son
    | veintidós rótulos peleándose por el mismo césped: se leía «DFC DFC» en
    | un borrón y el campo parecía una tabla. El número ya dice el puesto.
    */
    label: numeros[indice],
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
