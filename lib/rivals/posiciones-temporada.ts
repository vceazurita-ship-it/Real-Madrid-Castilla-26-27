/*
|--------------------------------------------------------------------------
| DÓNDE JUEGA CADA UNO, SEGÚN LO QUE LLEVA JUGADO
|--------------------------------------------------------------------------
|
| El campograma de una plantilla rival se pintaba con dos cosas escritas a
| mano: el dibujo que alguien eligiera en el desplegable y la columna POSICIÓN
| de la hoja. Las dos envejecen. La hoja dice «medio centro» de un chico al que
| llevan ocho jornadas poniendo de central, y el dibujo se queda en el 4-2-3-1
| de partida aunque el equipo salga con cinco atrás desde septiembre.
|
| Aquí se lee lo que de verdad han hecho: de cada alineación oficial que bajó
| `rivals-informe.mjs` sale **en qué línea** salió cada uno, y se queda la que
| más repite. El dibujo, igual: el que más han sacado. Se actualiza solo, sobre
| el documento `rivals:informe`, así que en cuanto la pasada de la noche trae
| una jornada nueva el campograma la tiene en cuenta sin tocar nada.
|
|--------------------------------------------------------------------------
| QUÉ SE PUEDE DEDUCIR Y QUÉ NO
|--------------------------------------------------------------------------
|
| **La línea, sí.** BeSoccer lista a los once en orden —portero, defensas,
| medios, arriba— y cruzándolo con la estructura del partido sale la línea de
| cada uno. Comprobado sobre las 836 titularidades bajadas: coincide con la
| demarcación que publica BeSoccer en el 83 % de los casos, y de los 140 que
| no, 109 son mediapuntas de un 4-2-3-1 a los que ellos llaman «delantero».
| No es un fallo de la lectura: es cómo lo etiquetan.
|
| **El lado, no.** Dentro de una línea el orden no significa nada: medido
| contra los 151 jugadores a los que la hoja les pone lado, coincide 116 veces
| y falla 128. Es una moneda al aire, así que aquí no se inventa: la banda y el
| lado los sigue poniendo la hoja, que para eso los tiene escritos.
|
| De ahí la regla: **la línea la manda el partido y el lado la hoja**. Si un
| lateral izquierdo lleva la temporada de central, se pinta de central; si de
| lo que juega es de lateral, se queda donde la hoja lo puso, que sabe de qué
| banda es.
|
| Y no vale promediar el sitio en el campo: se probó y a quien juega un día de
| lateral y otro de interior le salía la media —un pivote que no ha jugado
| nunca—. Lo que se cuenta es en cuántos partidos ha jugado en cada línea.
*/

import {
  alineaEstructura,
  esLiga,
  type InformeEquipo,
  type JugadorOnce,
  type OncePartido,
  type Partido,
} from "@/lib/rivals/informe";

import {
  DIBUJOS,
  DIBUJO_POR_DEFECTO,
  familiaDeSlot,
} from "@/lib/rivals/campograma-motor";

import { indiceDeLaHoja, type JugadorDeLaHoja } from "@/lib/rivals/once-sugerido";

/* ------------------------------------------------------------------ */
/*  LO QUE SALE                                                        */
/* ------------------------------------------------------------------ */

export type SitioDeLaTemporada = {
  /** Clave del puesto del campograma: "por", "li", "dfc", "mcd"… */
  slot: string;
  /** -1 izquierda, 1 derecha, 0 por el centro. */
  lado: -1 | 0 | 1;
  /** En cuántas alineaciones ha salido de titular en esa línea. */
  partidos: number;
  /** `true` si esa línea no es la que le pone la hoja. */
  cambiado: boolean;
};

export type LecturaDeLaTemporada = {
  /**
   * El dibujo más repetido, ya traducido al vocabulario del campograma
   * ("4-2-3-1"), o `null` si no hay de dónde deducirlo.
   */
  dibujo: string | null;
  /** Tal y como lo escribe BeSoccer: "1-4-2-3-1". Para poder decirlo. */
  estructura: string | null;
  /** Cuántas alineaciones se han contado. */
  alineaciones: number;
  /** Han entrado amistosos porque no había partidos oficiales suficientes. */
  conAmistosos: boolean;
  /** Clave de la hoja → dónde juega. */
  porJugador: Map<string, SitioDeLaTemporada>;
};

export const LECTURA_VACIA: LecturaDeLaTemporada = {
  dibujo: null,
  estructura: null,
  alineaciones: 0,
  conAmistosos: false,
  porJugador: new Map(),
};

/* ------------------------------------------------------------------ */
/*  LAS LÍNEAS                                                         */
/* ------------------------------------------------------------------ */

/** Las líneas de un equipo, de atrás adelante. */
export type Papel =
  | "por"
  | "defensa"
  | "pivote"
  | "interior"
  | "mediapunta"
  | "ataque";

/** Qué línea es la línea `i` de un dibujo de `campo.length` líneas. */
export function papelDeLinea(campo: number[], i: number): Papel {
  const k = campo.length;

  if (i === 0) return "defensa";

  if (i === k - 1) return "ataque";

  /*
  | Con cuatro líneas o más el medio va partido: la primera es la del pivote
  | —el doble pivote de un 4-2-3-1— y la última, la que va pegada al delantero,
  | la de la mediapunta. Con una sola línea de medios, todos son interiores.
  */
  if (k >= 4) {
    if (i === 1) return "pivote";

    if (i === k - 2) return "mediapunta";

    return "interior";
  }

  return "interior";
}

/** En qué línea juega el puesto que escribe la hoja. */
function papelDelSlot(slot: string): Papel | null {
  const familia = familiaDeSlot(slot);

  if (!familia) return null;

  if (familia === "por") return "por";
  if (familia === "lateral" || familia === "central") return "defensa";
  if (familia === "pivote") return "pivote";
  if (familia === "interior") return "interior";
  if (familia === "mediapunta" || familia === "extremo") return "mediapunta";

  return "ataque";
}

/** ¿El puesto que le pone la hoja es de los que juegan pegados a la banda? */
function deBanda(slot: string) {
  const familia = familiaDeSlot(slot);

  return familia === "lateral" || familia === "extremo";
}

/**
 * El puesto que le toca a alguien en una línea, respetando lo que ya se sabe.
 *
 * El lado y el ser de banda vienen de la hoja —lo único que dice de qué lado
 * juega—, y la línea, de lo que lleva jugando.
 */
function puestoEn(papel: Papel, banda: boolean, lado: -1 | 0 | 1): string {
  if (papel === "por") return "por";

  if (papel === "defensa") return banda ? (lado > 0 ? "ld" : "li") : "dfc";

  /* Un hombre de banda en el medio es un carrilero: el motor lo lee como
     lateral, que es lo que es en un 3-5-2. */
  if (papel === "pivote") return banda ? "car" : "mcd";

  if (papel === "interior") return banda ? "car" : "int";

  if (papel === "mediapunta") return banda ? (lado > 0 ? "ed" : "ei") : "mp";

  return banda ? (lado > 0 ? "ed" : "ei") : "dc";
}

/**
 * Reparte una alineación en líneas, siguiendo su propia estructura.
 *
 * Lo que sobre —una estructura que no suma once, que pasa en los amistosos—
 * se queda fuera: inventarle una línea a alguien es peor que no contarlo.
 */
export function lineasDeLaAlineacion(once: {
  estructura: string;
  jugadores: JugadorOnce[];
}): { jugador: JugadorOnce; papel: Papel }[] {
  const campo = alineaEstructura(once.estructura).slice(1);

  const jugadores = [...once.jugadores].sort((a, b) => a.puesto - b.puesto);

  const salida: { jugador: JugadorOnce; papel: Papel }[] = [];

  const portero = jugadores.shift();

  if (portero) salida.push({ jugador: portero, papel: "por" });

  campo.forEach((cuantos, i) => {
    const papel = papelDeLinea(campo, i);

    for (let j = 0; j < cuantos; j += 1) {
      const jugador = jugadores.shift();

      if (!jugador) return;

      salida.push({ jugador, papel });
    }
  });

  return salida;
}

/* ------------------------------------------------------------------ */
/*  EL DIBUJO                                                          */
/* ------------------------------------------------------------------ */

function numerosDe(estructura: string): number[] {
  return estructura
    .split("-")
    .map((trozo) => Number(trozo.trim()))
    .filter((numero) => Number.isFinite(numero) && numero > 0);
}

/**
 * Traduce la estructura de BeSoccer al dibujo que sabe pintar el campograma.
 *
 * BeSoccer escribe el portero delante ("1-4-2-3-1") y usa dibujos que aquí no
 * existen, como el 4-5-1 o el 5-4-1. En vez de rendirse al de partida se busca
 * **el más parecido de los que hay**: primero que coincida la defensa, que es
 * lo que cambia la lectura de un rival, y después el ataque.
 */
export function dibujoParecido(estructura: string): string | null {
  const suyas = numerosDe(estructura);

  /* Sin el portero delante: lo que queda son las líneas de campo. */
  const campo = suyas[0] === 1 ? suyas.slice(1) : suyas;

  if (campo.length < 2) return null;

  const exacto = campo.join("-");

  if (DIBUJOS.some((uno) => uno.id === exacto)) return exacto;

  let mejor: string | null = null;
  let nota = Number.POSITIVE_INFINITY;

  for (const uno of DIBUJOS) {
    const mias = numerosDe(uno.id);

    /* La defensa pesa mucho más: tres centrales o cuatro no es un matiz. */
    const defensa = Math.abs((mias[0] ?? 0) - (campo[0] ?? 0)) * 10;

    const ataque = Math.abs(
      (mias[mias.length - 1] ?? 0) - (campo[campo.length - 1] ?? 0),
    );

    const total = defensa + ataque + Math.abs(mias.length - campo.length);

    if (total < nota) {
      nota = total;
      mejor = uno.id;
    }
  }

  return mejor ?? DIBUJO_POR_DEFECTO;
}

/* ------------------------------------------------------------------ */
/*  LA LECTURA                                                         */
/* ------------------------------------------------------------------ */

/** Por debajo de esto no hay liga que mirar y entran los amistosos. */
const MINIMO_DE_LIGA = 2;

/** Las alineaciones que cuentan: las de competición, y si no las hay, todas. */
function alineacionesDeLaTemporada(informe: InformeEquipo) {
  const porId = new Map<string, Partido>(
    informe.partidos.map((partido) => [partido.id, partido]),
  );

  const conJugadores = informe.onces.filter((once) => once.jugadores.length > 0);

  const oficiales = conJugadores.filter((once) => {
    const partido = porId.get(once.partidoId);

    return partido ? esLiga(partido) : false;
  });

  const conAmistosos = oficiales.length < MINIMO_DE_LIGA;

  return { elegidas: conAmistosos ? conJugadores : oficiales, conAmistosos };
}

function masRepetida(alineaciones: OncePartido[], informe: InformeEquipo) {
  const cuenta = new Map<string, number>();

  for (const once of alineaciones) {
    if (!once.estructura) continue;

    cuenta.set(once.estructura, (cuenta.get(once.estructura) ?? 0) + 1);
  }

  const mejor = [...cuenta.entries()].sort((a, b) => b[1] - a[1])[0];

  return mejor?.[0] || informe.estructuras[0]?.estructura || null;
}

/**
 * Lee la temporada de un rival: con qué dibujo sale y en qué línea juega cada
 * uno.
 *
 * `plantilla` son los jugadores de la hoja RIVALES tal y como los tiene la
 * pantalla, para poder devolver el resultado con **sus** claves y que quien lo
 * use no tenga que volver a cruzar nada.
 */
export function leePosicionesDeLaTemporada(
  informe: InformeEquipo | null | undefined,
  plantilla: JugadorDeLaHoja[],
): LecturaDeLaTemporada {
  if (!informe || plantilla.length === 0) return LECTURA_VACIA;

  const { elegidas, conAmistosos } = alineacionesDeLaTemporada(informe);

  if (elegidas.length === 0) return LECTURA_VACIA;

  const busca = indiceDeLaHoja(plantilla);

  const porClave = new Map(plantilla.map((uno) => [uno.clave, uno]));

  /* En cuántos partidos ha jugado cada uno en cada línea, y desde cuándo. */
  const cuenta = new Map<string, Map<Papel, { veces: number; ultima: number }>>();

  elegidas.forEach((once, cuando) => {
    for (const sitio of lineasDeLaAlineacion(once)) {
      const enLaHoja = busca(sitio.jugador);

      if (!enLaHoja) continue;

      const suyas =
        cuenta.get(enLaHoja.clave) ?? new Map<Papel, { veces: number; ultima: number }>();

      const previo = suyas.get(sitio.papel);

      suyas.set(sitio.papel, {
        veces: (previo?.veces ?? 0) + 1,
        ultima: Math.min(previo?.ultima ?? cuando, cuando),
      });

      cuenta.set(enLaHoja.clave, suyas);
    }
  });

  const porJugador = new Map<string, SitioDeLaTemporada>();

  for (const [clave, suyas] of cuenta) {
    /*
    | La línea que más repite. A igualdad —dos jornadas de central y dos de
    | pivote— manda la más reciente, que es lo que se va a ver el domingo.
    | `elegidas` viene de la más nueva a la más vieja, así que el `ultima` más
    | pequeño es el más cercano en el tiempo.
    */
    const mejor = [...suyas.entries()].sort(
      (a, b) => b[1].veces - a[1].veces || a[1].ultima - b[1].ultima,
    )[0];

    if (!mejor) continue;

    const [papel, dato] = mejor;

    const jugador = porClave.get(clave);

    const slotHoja = jugador?.slot ?? "otros";

    const ladoHoja = (jugador?.lado ?? 0) as -1 | 0 | 1;

    /*
    | Si la hoja ya lo pone en esa línea, se respeta lo que dice: sabe si es
    | lateral o central y de qué banda, y eso aquí no se puede deducir.
    */
    if (papelDelSlot(slotHoja) === papel) {
      porJugador.set(clave, {
        slot: slotHoja,
        lado: ladoHoja,
        partidos: dato.veces,
        cambiado: false,
      });

      continue;
    }

    porJugador.set(clave, {
      slot: puestoEn(papel, deBanda(slotHoja), ladoHoja),
      lado: ladoHoja,
      partidos: dato.veces,
      cambiado: true,
    });
  }

  const estructura = masRepetida(elegidas, informe);

  return {
    dibujo: estructura ? dibujoParecido(estructura) : null,
    estructura,
    alineaciones: elegidas.length,
    conAmistosos,
    porJugador,
  };
}
