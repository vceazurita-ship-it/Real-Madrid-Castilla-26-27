import {
  comparablesDe,
  volumenDelPorcentaje,
  type Ambito,
  type Puesto,
} from "./individual";
import { percentil } from "./metricas";
import type { JugadorOnce, Lado } from "./once";
import type { FilaJugador } from "./leer";
import type { RatingsSeason } from "@/lib/ratings/types";

/**
 * SINERGIAS: QUÉ PAREJAS SE POTENCIAN Y CUÁLES SE PISAN.
 *
 * **Lo primero, qué es esto y qué no es.** Medir de verdad una sinergia sería
 * comparar cómo rinde el equipo con los dos juntos y sin ellos, y para eso hace
 * falta un histórico de alineaciones que hoy no existe: el log de Opta no trae
 * pases —sólo acciones defensivas—, Wyscout da una fila por jugador y
 * temporada, y de nuestras valoraciones hay **dos partidos**. Con eso, decir
 * «esta pareja rinde un 12 % más» sería inventarlo.
 *
 * Así que esto compara **perfiles**: qué hace cada uno con el balón y sin él,
 * medido contra los de su puesto, y si lo que hace el uno **le hace falta al
 * otro** (se potencian) o **es lo mismo que hace el otro** (se pisan, y el
 * equipo se queda sin esa función). Es el razonamiento que hace un entrenador
 * al juntar a dos en una banda, escrito con los números delante y con cada
 * veredicto trazable a dos cifras.
 *
 * Y va acompañado de lo **medido** —partidos jugados juntos y nota media— en
 * cuanto haya partidos suficientes: hasta entonces la pantalla dice cuántos
 * faltan en vez de enseñar una cifra de dos partidos.
 *
 * Dos reglas que no se pueden saltar:
 *
 * - **Un porcentaje de dos acciones no decide nada**: se aplica el mismo
 *   filtro de volumen que en la ficha individual (`volumenDelPorcentaje`).
 * - **Se compara contra los de su puesto**, no en bruto: que un central centre
 *   menos que un extremo no es un defecto suyo.
 */

/* ------------------------------------------------------------------ */
/*  A QUIÉN SE LE PIDE QUÉ                                             */
/* ------------------------------------------------------------------ */

/** A qué jugador del once se refiere un papel de la relación. */
export type Papel = {
  puesto: Puesto;
  /** Si la relación es de una banda concreta. `undefined` = cualquiera. */
  lado?: Lado;
};

/** Lo que se le mira a un jugador en una relación. */
export type Peticion = {
  columna: string;
  /** Cómo se dice en una frase: «centra», «ataca el área». */
  rotulo: string;
  /** Si en esta relación lo bueno es tener mucho. Casi siempre sí. */
  mejorAlto?: boolean;
};

export type TipoRelacion = "complemento" | "duplicidad" | "basta-uno";

export type Relacion = {
  clave: string;
  nombre: string;
  /** Qué se está mirando y por qué importa. */
  explica: string;
  entre: [Papel, Papel];
  tipo: TipoRelacion;
  pide: [Peticion, Peticion];
};

/**
 * EL CATÁLOGO.
 *
 * Cada relación es una pregunta de las que se hacen en una pizarra —«¿quién da
 * la anchura por la izquierda?», «¿quién cubre cuando sube el lateral?»— con
 * las dos columnas de Wyscout que la contestan.
 *
 * - **`complemento`**: hacen falta las dos cosas y cada uno pone una. Si los
 *   dos están arriba, se potencian; si falta una, va a medias; si faltan las
 *   dos, el equipo no tiene esa función con esa pareja.
 * - **`duplicidad`**: es la **misma** función. Que los dos la hagan mucho no
 *   suma, resta: se pisan la zona y dejan otra sin cubrir.
 * - **`basta-uno`**: la misma función, pero **con que la tenga uno vale** —una
 *   pareja de centrales necesita a alguien que gane por alto, no a dos—. Lo
 *   malo aquí es que no la tenga ninguno.
 */
export const RELACIONES: Relacion[] = [
  /* ------------------------- LAS BANDAS -------------------------- */
  {
    clave: "anchura-izq",
    nombre: "Anchura por la izquierda",
    explica:
      "El lateral y el extremo de la misma banda no pueden ser los dos el que centra: si los dos viven de poner centros, se pisan el carril y nadie ataca el área.",
    entre: [
      { puesto: "LAT", lado: "I" },
      { puesto: "BAN", lado: "I" },
    ],
    tipo: "duplicidad",
    pide: [
      { columna: "Centros desde la banda izquierda/90", rotulo: "centra desde la izquierda" },
      { columna: "Centros desde la banda izquierda/90", rotulo: "centra desde la izquierda" },
    ],
  },
  {
    clave: "anchura-der",
    nombre: "Anchura por la derecha",
    explica:
      "Lo mismo por el otro lado: dos que centran mucho desde la derecha compiten por el mismo metro de campo.",
    entre: [
      { puesto: "LAT", lado: "D" },
      { puesto: "BAN", lado: "D" },
    ],
    tipo: "duplicidad",
    pide: [
      { columna: "Centros desde la banda derecha/90", rotulo: "centra desde la derecha" },
      { columna: "Centros desde la banda derecha/90", rotulo: "centra desde la derecha" },
    ],
  },
  {
    clave: "dentro-fuera-izq",
    nombre: "Uno por fuera, otro por dentro (izquierda)",
    explica:
      "La sociedad que funciona en una banda: uno pone el centro y el otro se mete al área a recibirlo.",
    entre: [
      { puesto: "LAT", lado: "I" },
      { puesto: "BAN", lado: "I" },
    ],
    tipo: "complemento",
    pide: [
      { columna: "Centros/90", rotulo: "centra" },
      { columna: "Toques en el área de penalti/90", rotulo: "pisa el área" },
    ],
  },
  {
    clave: "dentro-fuera-der",
    nombre: "Uno por fuera, otro por dentro (derecha)",
    explica:
      "La sociedad que funciona en una banda: uno pone el centro y el otro se mete al área a recibirlo.",
    entre: [
      { puesto: "LAT", lado: "D" },
      { puesto: "BAN", lado: "D" },
    ],
    tipo: "complemento",
    pide: [
      { columna: "Centros/90", rotulo: "centra" },
      { columna: "Toques en el área de penalti/90", rotulo: "pisa el área" },
    ],
  },
  {
    clave: "quien-vuelve-izq",
    nombre: "Quién vuelve por la izquierda",
    explica:
      "Si el lateral se suma al ataque, alguien tiene que hacer el trabajo defensivo de esa banda. Si ninguno de los dos defiende, la espalda del lateral queda abierta todo el partido.",
    entre: [
      { puesto: "LAT", lado: "I" },
      { puesto: "BAN", lado: "I" },
    ],
    tipo: "complemento",
    pide: [
      { columna: "Carreras en progresión/90", rotulo: "sube conduciendo" },
      { columna: "Acciones defensivas realizadas/90", rotulo: "hace trabajo defensivo" },
    ],
  },
  {
    clave: "quien-vuelve-der",
    nombre: "Quién vuelve por la derecha",
    explica:
      "Si el lateral se suma al ataque, alguien tiene que hacer el trabajo defensivo de esa banda. Si ninguno de los dos defiende, la espalda del lateral queda abierta todo el partido.",
    entre: [
      { puesto: "LAT", lado: "D" },
      { puesto: "BAN", lado: "D" },
    ],
    tipo: "complemento",
    pide: [
      { columna: "Carreras en progresión/90", rotulo: "sube conduciendo" },
      { columna: "Acciones defensivas realizadas/90", rotulo: "hace trabajo defensivo" },
    ],
  },

  /* ------------------------ LOS CENTRALES ------------------------ */
  {
    clave: "centrales-arriba",
    nombre: "Quién gana arriba en la pareja de centrales",
    explica:
      "Una pareja de centrales necesita a alguien que gane el balón por alto. Con que lo haga uno vale; si no lo hace ninguno, cualquier centro rival es una ocasión.",
    entre: [
      { puesto: "CEN", lado: "D" },
      { puesto: "CEN", lado: "I" },
    ],
    tipo: "basta-uno",
    pide: [
      { columna: "Duelos aéreos ganados, %", rotulo: "gana por alto" },
      { columna: "Duelos aéreos ganados, %", rotulo: "gana por alto" },
    ],
  },
  {
    clave: "centrales-salida",
    nombre: "Quién saca el balón desde atrás",
    explica:
      "Con dos centrales que no progresan con el pase, la salida muere en el primer pase al medio. Basta con que uno de los dos lo haga bien.",
    entre: [
      { puesto: "CEN", lado: "D" },
      { puesto: "CEN", lado: "I" },
    ],
    tipo: "basta-uno",
    pide: [
      { columna: "Pases progresivos/90", rotulo: "progresa con el pase" },
      { columna: "Pases progresivos/90", rotulo: "progresa con el pase" },
    ],
  },

  /* -------------------------- EL MEDIO --------------------------- */
  {
    clave: "medio-llega-cubre",
    nombre: "Quién llega y quién queda en el medio",
    explica:
      "Dos medios de llegada dejan el equipo partido; dos de contención no llegan nunca al área. Lo que funciona es uno de cada.",
    entre: [
      { puesto: "MED" },
      { puesto: "MED" },
    ],
    tipo: "complemento",
    pide: [
      { columna: "Pases en el último tercio/90", rotulo: "juega cerca del área" },
      { columna: "Acciones defensivas realizadas/90", rotulo: "recupera" },
    ],
  },
  {
    clave: "medio-mismo-pase",
    nombre: "Dos medios con el mismo pase",
    explica:
      "Si los dos son de circular en corto y ninguno rompe líneas, la posesión es cómoda y no llega a ningún sitio.",
    entre: [
      { puesto: "MED" },
      { puesto: "MED" },
    ],
    tipo: "duplicidad",
    pide: [
      { columna: "Pases cortos / medios /90", rotulo: "juega en corto" },
      { columna: "Pases cortos / medios /90", rotulo: "juega en corto" },
    ],
  },

  /* ------------------ EL MEDIO Y EL DELANTERO -------------------- */
  {
    clave: "pase-desmarque",
    nombre: "El pase y el desmarque",
    explica:
      "La pareja que gana partidos sin necesidad de jugada: uno mira a la espalda de la defensa y el otro ataca ese espacio. Con uno solo de los dos, no pasa nada.",
    entre: [
      { puesto: "MED" },
      { puesto: "DEL" },
    ],
    tipo: "complemento",
    pide: [
      { columna: "Pases en profundidad/90", rotulo: "pone el pase a la espalda" },
      { columna: "Ataque en profundidad/90", rotulo: "ataca ese espacio" },
    ],
  },
  {
    clave: "centro-y-cabeza",
    nombre: "El centro y el cabeceador",
    explica:
      "De qué sirve centrar si nadie gana el balón dentro, y al revés: un delantero de área sin quien le ponga el balón vive de las migas.",
    entre: [
      { puesto: "BAN" },
      { puesto: "DEL" },
    ],
    tipo: "complemento",
    pide: [
      { columna: "Centros/90", rotulo: "centra" },
      { columna: "Duelos aéreos ganados, %", rotulo: "gana el balón dentro" },
    ],
  },
  {
    clave: "area-sin-anchura",
    nombre: "Los dos al área",
    explica:
      "Dos jugadores que viven dentro del área y ninguno que la abra: el equipo ataca por dentro con todo el mundo en el mismo metro cuadrado.",
    entre: [
      { puesto: "BAN" },
      { puesto: "DEL" },
    ],
    tipo: "duplicidad",
    pide: [
      { columna: "Toques en el área de penalti/90", rotulo: "vive dentro del área" },
      { columna: "Toques en el área de penalti/90", rotulo: "vive dentro del área" },
    ],
  },
];

/* ------------------------------------------------------------------ */
/*  EL VEREDICTO DE UNA RELACIÓN                                       */
/* ------------------------------------------------------------------ */

/** Por encima de esto, se considera que un jugador **sí** hace esa función. */
const ALTO = 60;

/** Por debajo de esto, **no** la hace. Entre los dos, ni una cosa ni otra. */
const BAJO = 40;

export type EstadoRelacion = "potencia" | "media" | "hueco" | "pisan";

export type VeredictoRelacion = {
  relacion: Relacion;
  estado: EstadoRelacion;
  /** Lo que se lee en la tarjeta, ya escrito. */
  texto: string;
  /** Las dos cifras que lo sostienen. */
  cifras: { jugador: string; rotulo: string; valor: number; percentil: number }[];
};

/** Suma al saldo de la pareja: lo bueno suma, lo que falla resta. */
export const PESO_DEL_ESTADO: Record<EstadoRelacion, number> = {
  potencia: 1,
  media: 0,
  hueco: -1,
  pisan: -1,
};

type Medicion = { valor: number; percentil: number } | null;

/**
 * El percentil de un jugador en una columna, contra los de su puesto.
 *
 * Devuelve `null` cuando no se puede sostener: sin fila de Wyscout, sin dato,
 * o con un porcentaje sacado de cuatro acciones —el mismo filtro de volumen que
 * usa la ficha individual—.
 */
function mide(
  uno: JugadorOnce,
  columna: string,
  jugadores: FilaJugador[],
  ambito: Ambito,
  mejorAlto: boolean,
): Medicion {
  if (!uno.wyscout) return null;

  const valor = uno.wyscout.datos[columna];

  if (valor === undefined) return null;

  if (!volumenDelPorcentaje(uno.wyscout, columna).fiable) return null;

  const { lista } = comparablesDe(jugadores, uno.puesto, ambito);

  const suyos = lista
    .map((j) => j.datos[columna])
    .filter((v): v is number => v !== undefined);

  if (suyos.length < 3) return null;

  const pct = percentil(valor, suyos, mejorAlto);

  return pct === null ? null : { valor, percentil: Math.round(pct) };
}

const numero = (valor: number) =>
  (valor >= 100 ? String(Math.round(valor)) : valor.toFixed(2)).replace(".", ",");

/** El veredicto de una relación para dos jugadores concretos. */
export function juzga(
  relacion: Relacion,
  a: JugadorOnce,
  b: JugadorOnce,
  jugadores: FilaJugador[],
  ambito: Ambito,
): VeredictoRelacion | null {
  const medidaA = mide(a, relacion.pide[0].columna, jugadores, ambito, relacion.pide[0].mejorAlto ?? true);

  const medidaB = mide(b, relacion.pide[1].columna, jugadores, ambito, relacion.pide[1].mejorAlto ?? true);

  /* Sin las dos cifras no hay veredicto. Callar es mejor que suponer. */
  if (!medidaA || !medidaB) return null;

  const cifras = [
    {
      jugador: a.nombre,
      rotulo: relacion.pide[0].rotulo,
      valor: medidaA.valor,
      percentil: medidaA.percentil,
    },
    {
      jugador: b.nombre,
      rotulo: relacion.pide[1].rotulo,
      valor: medidaB.valor,
      percentil: medidaB.percentil,
    },
  ];

  const altoA = medidaA.percentil >= ALTO;
  const altoB = medidaB.percentil >= ALTO;
  const bajoA = medidaA.percentil < BAJO;
  const bajoB = medidaB.percentil < BAJO;

  if (relacion.tipo === "duplicidad") {
    /*
    | Los dos arriba **y en cantidades parecidas**.
    |
    | El percentil solo no basta: Aguado pone 4,3 centros por la izquierda y
    | Leiva 1,2, y los dos salen por encima del percentil 60 porque centrar por
    | esa banda lo hace poca gente. Eso no es pisarse, es que uno centra cuatro
    | veces más que el otro. Se exige que el menor llegue a la mitad del mayor.
    */
    const mayor = Math.max(medidaA.valor, medidaB.valor);

    const menor = Math.min(medidaA.valor, medidaB.valor);

    const parecidos = mayor > 0 && menor / mayor >= 0.5;

    /*
    | Los dos hacen lo mismo, y mucho: se pisan.
    |
    | Ojo: que los dos estén bajos aquí **no** es un problema de la pareja —que
    | ni el lateral ni el extremo centren puede ser justo lo que se busca si el
    | ataque va por dentro—, así que eso se queda en «ni una cosa ni otra».
    */
    if (altoA && altoB && parecidos) {
      return {
        relacion,
        estado: "pisan",
        texto: `Los dos hacen lo mismo: ${a.nombre} ${relacion.pide[0].rotulo} (${numero(
          medidaA.valor,
        )}, p${medidaA.percentil}) y ${b.nombre} también (${numero(medidaB.valor)}, p${
          medidaB.percentil
        }). Se reparten la misma función y ninguno hace la otra.`,
        cifras,
      };
    }

    return {
      relacion,
      estado: "media",
      texto: `No se pisan: lo hace sobre todo ${
        medidaA.percentil >= medidaB.percentil ? a.nombre : b.nombre
      } (p${Math.max(medidaA.percentil, medidaB.percentil)}).`,
      cifras,
    };
  }

  /*
  | «Basta con uno»: la función la tiene la pareja si la tiene cualquiera de
  | los dos. Exigirla a los dos sería pedir dos centrales iguales, que es justo
  | lo contrario de lo que se busca.
  */
  if (relacion.tipo === "basta-uno") {
    const mejor = medidaA.percentil >= medidaB.percentil ? a : b;

    const suPct = Math.max(medidaA.percentil, medidaB.percentil);

    const suValor = medidaA.percentil >= medidaB.percentil ? medidaA.valor : medidaB.valor;

    if (altoA || altoB) {
      return {
        relacion,
        estado: "potencia",
        texto: `Lo tienen: ${mejor.nombre} ${relacion.pide[0].rotulo} (${numero(suValor)}, p${suPct}), y con uno basta.`,
        cifras,
      };
    }

    if (bajoA && bajoB) {
      return {
        relacion,
        estado: "hueco",
        texto: `Ninguno de los dos ${relacion.pide[0].rotulo}: ${a.nombre} p${medidaA.percentil} y ${b.nombre} p${medidaB.percentil}. Con esta pareja el equipo no tiene esa función.`,
        cifras,
      };
    }

    return {
      relacion,
      estado: "media",
      texto: `Justo: el que más ${relacion.pide[0].rotulo} es ${mejor.nombre} (p${suPct}), y se queda a medio camino.`,
      cifras,
    };
  }

  /* Complemento: hacen falta las dos cosas. */
  if (altoA && altoB) {
    return {
      relacion,
      estado: "potencia",
      texto: `Encajan: ${a.nombre} ${relacion.pide[0].rotulo} (${numero(medidaA.valor)}, p${
        medidaA.percentil
      }) y ${b.nombre} ${relacion.pide[1].rotulo} (${numero(medidaB.valor)}, p${
        medidaB.percentil
      }).`,
      cifras,
    };
  }

  if (bajoA && bajoB) {
    return {
      relacion,
      estado: "hueco",
      texto: `Ninguno de los dos: ${a.nombre} ${relacion.pide[0].rotulo} poco (p${
        medidaA.percentil
      }) y ${b.nombre} ${relacion.pide[1].rotulo} poco (p${medidaB.percentil}). Con esta pareja el equipo no tiene esa función.`,
      cifras,
    };
  }

  /* Quién pone su parte y quién no llega, con nombre y apellidos. */
  const ponenA = medidaA.percentil >= medidaB.percentil;

  const fuerte = ponenA ? a : b;
  const flojo = ponenA ? b : a;
  const suyaFuerte = ponenA ? relacion.pide[0] : relacion.pide[1];
  const suyaFloja = ponenA ? relacion.pide[1] : relacion.pide[0];
  const pctFuerte = ponenA ? medidaA.percentil : medidaB.percentil;
  const pctFlojo = ponenA ? medidaB.percentil : medidaA.percentil;

  /* «Poco» sólo si de verdad es poco: un percentil 44 es quedarse a medias. */
  const comoFalla = pctFlojo < BAJO ? "poco" : "sin llegar del todo";

  return {
    relacion,
    estado: "media",
    texto: `A medias: ${fuerte.nombre} ${suyaFuerte.rotulo} (p${pctFuerte}), pero ${flojo.nombre} ${suyaFloja.rotulo} ${comoFalla} (p${pctFlojo}).`,
    cifras,
  };
}

/* ------------------------------------------------------------------ */
/*  LO MEDIDO: LO QUE PASA CUANDO JUEGAN JUNTOS                        */
/* ------------------------------------------------------------------ */

/**
 * Cuántos partidos han jugado juntos hacen falta para decir algo.
 *
 * Cinco juntos y tres por separado no es rigor estadístico —no lo hay con una
 * temporada— pero por debajo de eso ni siquiera es una impresión: es una
 * anécdota con decimales.
 */
export const MINIMO_JUNTOS = 5;
export const MINIMO_SUELTOS = 3;

export type Medida = {
  /** Partidos valorados en los que jugaron los dos. */
  juntos: number;
  /** Partidos valorados en los que jugó uno y el otro no. */
  sueltos: number;
  /** La nota media de los DOS cuando juegan juntos. */
  notaJuntos: number | null;
  /** La nota media de cada uno cuando el otro no está. */
  notaSueltos: number | null;
  /** Goles a favor y en contra por partido, juntos. */
  golesJuntos: { favor: number; contra: number } | null;
  /** Si hay partidos suficientes para enseñarlo. */
  fiable: boolean;
};

/**
 * Lo que dicen nuestras valoraciones de una pareja.
 *
 * Es la única fuente del proyecto que sabe **quién jugó en cada partido**: el
 * log de Opta no trae alineaciones y Wyscout da la temporada entera en una
 * fila. Hoy hay dos partidos valorados, así que `fiable` es `false` y la
 * pantalla lo dice; según se valoren jornadas, esto empieza a contestar solo.
 */
export function medidaDe(
  season: RatingsSeason,
  idA: string,
  idB: string,
): Medida {
  const partidos = Object.values(season.matches ?? {});

  let juntos = 0;
  let sueltos = 0;

  const notasJuntos: number[] = [];
  const notasSueltos: number[] = [];

  let favor = 0;
  let contra = 0;
  let conMarcador = 0;

  for (const partido of partidos) {
    const a = partido.players?.[idA];
    const b = partido.players?.[idB];

    const jugoA = (a?.minutes ?? 0) > 0;
    const jugoB = (b?.minutes ?? 0) > 0;

    const notaDe = (uno?: { rating: number; unrated?: boolean }) =>
      uno && uno.rating > 0 && !uno.unrated ? uno.rating : null;

    if (jugoA && jugoB) {
      juntos += 1;

      for (const nota of [notaDe(a), notaDe(b)]) {
        if (nota !== null) notasJuntos.push(nota);
      }

      if (partido.match.gf !== null && partido.match.ga !== null) {
        favor += partido.match.gf;
        contra += partido.match.ga;
        conMarcador += 1;
      }
    } else if (jugoA || jugoB) {
      sueltos += 1;

      const nota = jugoA ? notaDe(a) : notaDe(b);

      if (nota !== null) notasSueltos.push(nota);
    }
  }

  const media = (valores: number[]) =>
    valores.length ? valores.reduce((t, v) => t + v, 0) / valores.length : null;

  return {
    juntos,
    sueltos,
    notaJuntos: media(notasJuntos),
    notaSueltos: media(notasSueltos),
    golesJuntos:
      conMarcador > 0
        ? { favor: favor / conMarcador, contra: contra / conMarcador }
        : null,
    fiable: juntos >= MINIMO_JUNTOS && sueltos >= MINIMO_SUELTOS,
  };
}

/* ------------------------------------------------------------------ */
/*  LAS PAREJAS DEL ONCE                                               */
/* ------------------------------------------------------------------ */

export type Pareja = {
  clave: string;
  a: JugadorOnce;
  b: JugadorOnce;
  veredictos: VeredictoRelacion[];
  /** Suma de lo bueno menos lo que falla. */
  saldo: number;
  /** Lo que se escribe en la chapa: el resumen de la pareja. */
  etiqueta: "Se potencian" | "Sin roce" | "Se estorban";
  medida: Medida | null;
};

/** Si un jugador hace el papel que pide una relación. */
const encaja = (uno: JugadorOnce, papel: Papel) =>
  uno.puesto === papel.puesto && (!papel.lado || uno.lado === papel.lado);

/**
 * Las parejas que tienen algo que decirse.
 *
 * **No son las 55 combinaciones del once.** Un central y un extremo del otro
 * lado no comparten ni zona ni función, y una tarjeta que dijera algo de esa
 * pareja sería ruido con formato. Sólo salen las parejas para las que el
 * catálogo tiene alguna relación, que son las que comparten banda, línea o
 * jugada.
 */
export function sinergiasDe(
  once: JugadorOnce[],
  jugadores: FilaJugador[],
  ambito: Ambito = "liga",
  season?: RatingsSeason,
): Pareja[] {
  const parejas = new Map<string, Pareja>();

  for (const relacion of RELACIONES) {
    for (const a of once) {
      for (const b of once) {
        if (a.id === b.id) continue;

        if (!encaja(a, relacion.entre[0]) || !encaja(b, relacion.entre[1])) continue;

        /* Cada pareja una vez: el orden lo pone la relación, no el bucle. */
        const clave = [a.id, b.id].sort().join("|");

        const veredicto = juzga(relacion, a, b, jugadores, ambito);

        if (!veredicto) continue;

        const previa = parejas.get(clave);

        if (previa) {
          /* Una relación por pareja: dos medios se juzgan una sola vez. */
          if (previa.veredictos.some((v) => v.relacion.clave === relacion.clave)) {
            continue;
          }

          previa.veredictos.push(veredicto);
        } else {
          parejas.set(clave, {
            clave,
            a,
            b,
            veredictos: [veredicto],
            saldo: 0,
            etiqueta: "Sin roce",
            medida: season ? medidaDe(season, a.id, b.id) : null,
          });
        }
      }
    }
  }

  const lista = [...parejas.values()];

  for (const pareja of lista) {
    pareja.saldo = pareja.veredictos.reduce(
      (t, v) => t + PESO_DEL_ESTADO[v.estado],
      0,
    );

    pareja.etiqueta =
      pareja.saldo > 0 ? "Se potencian" : pareja.saldo < 0 ? "Se estorban" : "Sin roce";
  }

  /* Primero lo que más dice: lo que se potencia y lo que estorba, y dentro de
     cada grupo las que tienen más relaciones juzgadas. */
  /*
  | El orden: primero las que potencian, luego las que estorban y al final las
  | que no dicen nada. Así se lee como se decide un once: lo que funciona, lo
  | que hay que vigilar, y el resto.
  */
  const grupo = (una: Pareja) => (una.saldo > 0 ? 0 : una.saldo < 0 ? 1 : 2);

  return lista.sort(
    (x, y) =>
      grupo(x) - grupo(y) ||
      Math.abs(y.saldo) - Math.abs(x.saldo) ||
      y.veredictos.length - x.veredictos.length ||
      x.a.nombre.localeCompare(y.a.nombre, "es"),
  );
}
