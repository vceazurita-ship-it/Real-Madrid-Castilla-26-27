/**
 * Correcciones al puesto que trae la hoja.
 *
 * La columna `POSICION` de la pestaña JUGADORES escribe el puesto con el
 * número de rol —1 portero, 6 pivote, 8 interior, 10 mediapunta, 7 extremo
 * derecho, 11 extremo izquierdo, 9 delantero— y de ahí sale el sitio de cada
 * uno en el campograma de valoraciones, en la pizarra y en el once
 * (`lib/ratings/pitch.ts`). Un número mal escrito no es un detalle: pone a un
 * jugador en una banda que no es la suya en todas las pantallas a la vez.
 *
 * Esto es el puente para ese rato, como `lib/fichajes.ts` y `lib/dorsales.ts`:
 * la pestaña **la lleva a mano el cuerpo técnico** y desde la app no hay forma
 * de escribir esa columna.
 *
 * **Se retira solo, y no pisa una decisión.** La corrección sólo se aplica
 * mientras la hoja siga diciendo exactamente lo que se dio por equivocado
 * (`enLaHoja`): en cuanto alguien escriba ahí otra cosa —la correcta, o un
 * cambio de puesto— esta lista deja de aportar nada para esa fila y se puede
 * borrar la entrada. Y se cruza por nombre, no por `ID_JUGADOR`, porque la
 * hoja ha renumerado los IDs alguna vez y lo que se mueve con la persona es el
 * nombre.
 */

import { normalizePlayerName } from "@/lib/playerImages";
import type { Player } from "@/types/player";

interface Correccion {
  /** El nombre **como lo escribe la hoja**, que es por donde se cruza. */
  nombre: string;
  /** El `ID_JUGADOR` del día en que se escribió esto. Sólo para leerlo. */
  id: string;
  /** Lo que la hoja dice hoy. Si dice otra cosa, esta entrada no hace nada. */
  enLaHoja: string;
  /** Lo que debería decir. */
  debeDecir: string;
}

const CORRECCIONES: Correccion[] = [
  {
    /*
    | Dani Yáñez sale de extremo izquierdo en el campograma de valoraciones
    | porque la hoja le pone el 11, y es **extremo derecho**. Cuadra con su
    | dorsal, el 7 (`lib/dorsales.ts`). Corregido el 05/09/2026.
    */
    id: "JUG-18",
    nombre: "Yáñez",
    enLaHoja: "11",
    debeDecir: "7",
  },
];

const POR_NOMBRE = new Map(
  CORRECCIONES.map((una) => [normalizePlayerName(una.nombre), una]),
);

/** El puesto bueno de un jugador, que casi siempre es el que trae la hoja. */
export function posicionDe(nombre: string, enLaHoja: string): string {
  const correccion = POR_NOMBRE.get(normalizePlayerName(nombre));

  if (!correccion) return enLaHoja;

  /* La hoja ya dice otra cosa: manda ella y esta entrada sobra. */
  if ((enLaHoja || "").trim() !== correccion.enLaHoja) return enLaHoja;

  return correccion.debeDecir;
}

const NOMBRE_DE_ROL: Record<number, string> = {
  1: "Portero",
  2: "Lateral derecho",
  3: "Lateral izquierdo",
  4: "Central",
  5: "Central",
  6: "Pivote",
  7: "Extremo derecho",
  8: "Interior",
  9: "Delantero",
  10: "Mediapunta",
  11: "Extremo izquierdo",
  13: "Portero",
};

/** «CENTRAL» y «LATERAL D.» salen como «Central» y «Lateral derecho», igual que el resto de puestos. */
function enCaja(puesto: string): string {
  if (!puesto) return puesto;

  const bajo = puesto
    .toLowerCase()
    .replace(/\b(lateral|carrilero|extremo)\s+d\.?$/, "$1 derecho")
    .replace(/\b(lateral|carrilero|extremo)\s+i\.?$/, "$1 izquierdo");

  return bajo.charAt(0).toUpperCase() + bajo.slice(1);
}

/**
 * El puesto dicho con palabras para enseñarlo en pantalla: «10» pasa a
 * «Mediapunta». Lo que ya viene escrito sale en caja de frase; un número sin rol conocido se
 * deja como está.
 */
export function nombrePuesto(posicion: string): string {
  const limpio = (posicion || "").trim();

  if (!/^\d+$/.test(limpio)) return enCaja(limpio);

  return NOMBRE_DE_ROL[Number(limpio)] ?? limpio;
}

/** Aplica las correcciones a una plantilla ya leída. */
export function conPosiciones(jugadores: Player[]): Player[] {
  return jugadores.map((jugador) => {
    const buena = posicionDe(jugador.nombre, jugador.posicion);

    return buena === jugador.posicion ? jugador : { ...jugador, posicion: buena };
  });
}

/** La sigla de Wyscout en palabras de caseta (25/10/2026): «LCB» → «central izquierdo». Sin equivalencia, vacío. */
const SIGLA_PUESTO: Record<string, string> = {
  GK: "portero",
  CB: "central",
  LCB: "central izquierdo",
  RCB: "central derecho",
  LB: "lateral izquierdo",
  RB: "lateral derecho",
  LWB: "carrilero izquierdo",
  RWB: "carrilero derecho",
  DMF: "mediocentro defensivo",
  LDMF: "mediocentro defensivo",
  RDMF: "mediocentro defensivo",
  CMF: "mediocentro",
  LCMF: "interior izquierdo",
  RCMF: "interior derecho",
  AMF: "mediapunta",
  LAMF: "mediapunta izquierdo",
  RAMF: "mediapunta derecho",
  LW: "extremo izquierdo",
  RW: "extremo derecho",
  LWF: "extremo izquierdo",
  RWF: "extremo derecho",
  CF: "delantero centro",
  SS: "segundo delantero",
};

export const puestoEnPalabras = (sigla: string) => SIGLA_PUESTO[sigla.trim().toUpperCase()] ?? "";
