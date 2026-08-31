/*
|--------------------------------------------------------------------------
| ONCE PROBABLE SUGERIDO
|--------------------------------------------------------------------------
|
| El once que se espera del rival, deducido de los que ha sacado.
|
| El once probable lo decide el cuerpo técnico y se marca a mano en `/rivals`
| (`lib/rivals/once.ts`). El problema es que hay diecinueve rivales y la semana
| tiene los días que tiene: al llegar al informe de un equipo al que todavía no
| se había mirado no había once marcado, así que **la hoja de «once probable»
| no salía** y el documento llegaba a la charla sin ella.
|
| Aquí se propone uno. No sustituye al criterio de nadie: es el punto de
| partida —quién viene repitiendo y con qué dibujo— que después se cambia con
| un clic, se arrastra en el pop-up o se sustituye entero. Lo que decida el
| entrenador manda siempre; esto sólo evita la hoja en blanco.
|
| Lo que se mira son las últimas alineaciones que bajó `rivals-informe.mjs`,
| **las de competición oficial**: un once de agosto contra un equipo de tercera
| lleva a cuatro del filial y no dice nada de cómo sale el sábado. Si no hay
| suficientes partidos oficiales —las dos primeras jornadas— entran también los
| amistosos, que es la única referencia que hay entonces.
|
| El resultado va en el mismo idioma que el once de a mano: claves de jugador
| de la hoja RIVALES y sitios en tanto por uno del campo vertical. Así se puede
| escribir tal cual en el documento del once y seguir editándolo como si lo
| hubiera puesto una persona.
*/

import {
  alineaEstructura,
  alturaDeLinea,
  ALTURA_PORTERO,
  esLiga,
  reparteOnceInicial,
  type InformeEquipo,
  type OncePartido,
  type Partido,
} from "@/lib/rivals/informe";

import { ANCLAS_SLOT, ANCLA_SUELTA } from "@/lib/rivals/campograma-motor";

import type { OncePos } from "@/lib/rivals/once";

import { normalizeKey, resfuId } from "@/lib/rivals/stats";

/*
| Cuántas alineaciones se miran.
|
| Cinco es una jornada de sobra por delante de lo que cambia un entrenador en
| un mes y se queda corto para arrastrar al que dejó de jugar en octubre. El
| documento trae ocho bajadas por equipo, así que casi siempre las hay.
*/
export const ALINEACIONES_QUE_CUENTAN = 5;

/** Por debajo de esto no se mira sólo la liga: no hay liga que mirar. */
const MINIMO_DE_LIGA = 2;

/* ------------------------------------------------------------------ */
/*  LO QUE ENTRA Y LO QUE SALE                                         */
/* ------------------------------------------------------------------ */

/**
 * Lo que hace falta saber de un jugador de la hoja RIVALES para proponerlo.
 *
 * Es un subconjunto de `AlineacionJugador`, así que la pantalla le pasa
 * directamente la plantilla que ya tiene montada para el campograma.
 */
export type JugadorDeLaHoja = {
  clave: string;
  dorsal: string;
  nombre: string;
  /** Clave del slot del campograma ("por", "dfc", "mcd"…). */
  slot: string;
};

export type OnceSugerido = {
  /** Claves de la hoja, de portería a ataque. */
  titulares: string[];
  /** Dónde cae cada uno, en tanto por uno del campo vertical. */
  campo: Record<string, OncePos>;
  /** "1-4-2-3-1": la que más ha repetido en lo que se ha mirado. */
  estructura: string;
  /** Cuántas alineaciones se han contado. */
  alineaciones: number;
  /** `true` si han entrado amistosos por no haber liga suficiente. */
  conAmistosos: boolean;
  /**
   * Habituales de BeSoccer que no se han encontrado en la hoja RIVALES.
   *
   * Casi siempre es un fichaje que todavía no está dado de alta o un nombre
   * escrito de otra manera. Se devuelve para poder decirlo en pantalla en vez
   * de dejar un once de nueve sin explicación.
   */
  sinFicha: string[];
};

/* ------------------------------------------------------------------ */
/*  QUÉ ALINEACIONES CUENTAN                                           */
/* ------------------------------------------------------------------ */

/**
 * Las alineaciones que se miran, de la más reciente a la más antigua.
 *
 * `informe.onces` ya viene ordenado así, pero no dice de qué competición es
 * cada una: eso está en `partidos`, que se cruza por `partidoId`.
 */
function alineacionesQueCuentan(informe: InformeEquipo) {
  const porId = new Map<string, Partido>(
    informe.partidos.map((partido) => [partido.id, partido]),
  );

  const conPartido = informe.onces
    .filter((once) => once.jugadores.length > 0)
    .map((once) => ({ once, partido: porId.get(once.partidoId) ?? null }));

  const deLiga = conPartido.filter(
    (uno) => uno.partido && esLiga(uno.partido),
  );

  const conAmistosos = deLiga.length < MINIMO_DE_LIGA;

  const elegidas = (conAmistosos ? conPartido : deLiga).slice(
    0,
    ALINEACIONES_QUE_CUENTAN,
  );

  return { elegidas, conAmistosos };
}

/* ------------------------------------------------------------------ */
/*  QUIÉN ES QUIÉN                                                     */
/* ------------------------------------------------------------------ */

/**
 * Índice para encontrar en la hoja al jugador que dice BeSoccer.
 *
 * Se prueba por el id de resfu, que es exacto y sale de la foto —la misma
 * identidad que usan las estadísticas y el once—, y si no por el nombre
 * normalizado. La hoja escribe «Óscar Sielva» y BeSoccer a veces «Ó. Sielva»,
 * así que como último recurso se acepta que uno contenga al otro, que resuelve
 * las abreviaturas sin llegar a confundir a dos compañeros.
 */
function indiceDeLaHoja(plantilla: JugadorDeLaHoja[]) {
  const porId = new Map<string, JugadorDeLaHoja>();
  const porNombre = new Map<string, JugadorDeLaHoja>();

  for (const jugador of plantilla) {
    const id = jugador.clave.startsWith("bs:") ? jugador.clave.slice(3) : "";

    if (id) porId.set(id, jugador);

    const nombre = normalizeKey(jugador.nombre);

    if (nombre && !porNombre.has(nombre)) porNombre.set(nombre, jugador);
  }

  return (deBesoccer: { foto: string; nombre: string }) => {
    const id = resfuId(deBesoccer.foto);

    if (id && porId.has(id)) return porId.get(id) ?? null;

    const nombre = normalizeKey(deBesoccer.nombre);

    if (!nombre) return null;

    if (porNombre.has(nombre)) return porNombre.get(nombre) ?? null;

    /* «D. Gómez» contra «Diego Gómez»: se acepta la abreviatura sólo si no
       hay dos candidatos, que es cuando dejaría de ser una lectura y pasaría
       a ser una apuesta. */
    const parecidos = plantilla.filter((uno) => {
      const suyo = normalizeKey(uno.nombre);

      return Boolean(suyo) && (suyo.includes(nombre) || nombre.includes(suyo));
    });

    return parecidos.length === 1 ? parecidos[0] : null;
  };
}

/* ------------------------------------------------------------------ */
/*  EL RECUENTO                                                        */
/* ------------------------------------------------------------------ */

/** Lo que se sabe de un habitual después de contar las alineaciones. */
type Candidato = {
  jugador: JugadorDeLaHoja;
  /** Cuánto pesa: las alineaciones recientes valen más que las viejas. */
  puntos: number;
  /** Su sitio medio, ponderado igual. Con el ataque arriba. */
  x: number;
  y: number;
  /** En cuál de las alineaciones miradas salió por última vez (0 la última). */
  ultima: number;
};

/**
 * Cuánto pesa una alineación según lo reciente que sea.
 *
 * La última cuenta el doble que la quinta hacia atrás: un entrenador cambia
 * dos o tres piezas por jornada, pero el bloque de la semana pasada es lo que
 * más se parece al de la que viene.
 */
function pesoDe(indice: number, cuantas: number) {
  return cuantas - indice;
}

function cuentaHabituales(
  alineaciones: OncePartido[],
  plantilla: JugadorDeLaHoja[],
) {
  const busca = indiceDeLaHoja(plantilla);

  const candidatos = new Map<string, Candidato>();

  const sinFicha = new Set<string>();

  alineaciones.forEach((once, indice) => {
    const peso = pesoDe(indice, alineaciones.length);

    for (const sitio of reparteOnceInicial(once)) {
      const enLaHoja = busca(sitio.jugador);

      if (!enLaHoja) {
        sinFicha.add(sitio.jugador.nombre);

        continue;
      }

      const previo = candidatos.get(enLaHoja.clave);

      if (previo) {
        /* La media de los sitios va ponderada igual que los puntos: donde
           jugó la última jornada pesa más que donde jugó hace un mes. */
        previo.x =
          (previo.x * previo.puntos + sitio.x * peso) / (previo.puntos + peso);

        previo.y =
          (previo.y * previo.puntos + sitio.y * peso) / (previo.puntos + peso);

        previo.puntos += peso;
      } else {
        candidatos.set(enLaHoja.clave, {
          jugador: enLaHoja,
          puntos: peso,
          x: sitio.x,
          y: sitio.y,
          ultima: indice,
        });
      }
    }
  });

  return { candidatos: [...candidatos.values()], sinFicha: [...sinFicha] };
}

/** La estructura que más ha repetido en lo que se ha mirado. */
function estructuraMasRepetida(
  alineaciones: OncePartido[],
  informe: InformeEquipo,
) {
  const cuenta = new Map<string, number>();

  alineaciones.forEach((once, indice) => {
    if (!once.estructura) return;

    const peso = pesoDe(indice, alineaciones.length);

    cuenta.set(once.estructura, (cuenta.get(once.estructura) ?? 0) + peso);
  });

  const mejor = [...cuenta.entries()].sort((a, b) => b[1] - a[1])[0];

  /* Sin alineaciones con dibujo se cae a lo que ya contó el script sobre las
     ocho bajadas, y en último término a un 1-4-4-2. */
  return mejor?.[0] || informe.estructuras[0]?.estructura || "1-4-4-2";
}

/* ------------------------------------------------------------------ */
/*  REPARTIR LOS ONCE SITIOS                                           */
/* ------------------------------------------------------------------ */

/** La altura de cada hueco de la estructura, portero incluido. */
function huecosDe(estructura: string) {
  const lineas = alineaEstructura(estructura);

  const campo = lineas.slice(1);

  const huecos: { y: number; sitios: number }[] = [
    { y: ALTURA_PORTERO, sitios: 1 },
  ];

  campo.forEach((cuantos, indice) => {
    huecos.push({ y: alturaDeLinea(indice, campo.length), sitios: cuantos });
  });

  return huecos;
}

/** Dónde tira un jugador de la hoja cuando no hay de dónde deducirlo. */
function alturaDeSuPuesto(jugador: JugadorDeLaHoja) {
  return (ANCLAS_SLOT[jugador.slot] ?? ANCLA_SUELTA).y;
}

function esPortero(jugador: JugadorDeLaHoja) {
  return jugador.slot === "por";
}

/**
 * Coloca a los candidatos en los huecos de la estructura.
 *
 * Se va de mayor a menor peso y cada uno entra en la línea que le pilla más
 * cerca de donde suele jugar; si está llena, en la siguiente más cercana. Así
 * un interior que ha jugado de mediapunta no deja sin sitio al pivote, y un
 * dibujo de tres líneas no manda al extremo al banquillo por no caber.
 *
 * La portería va aparte: se reserva para el portero y no compite con nadie,
 * porque un central con muchos minutos le ganaría el hueco.
 */
function colocaEnLineas(
  candidatos: Candidato[],
  estructura: string,
): Map<number, Candidato[]> {
  const huecos = huecosDe(estructura);

  const puestos = new Map<number, Candidato[]>();

  huecos.forEach((_, indice) => puestos.set(indice, []));

  const libre = (indice: number) =>
    (puestos.get(indice)?.length ?? 0) < huecos[indice].sitios;

  const porOrden = [...candidatos].sort(
    (a, b) => b.puntos - a.puntos || a.ultima - b.ultima,
  );

  /* Primero la portería, con el portero que más haya salido. */
  const portero = porOrden.find((uno) => esPortero(uno.jugador));

  if (portero) puestos.get(0)?.push(portero);

  for (const candidato of porOrden) {
    if (candidato === portero) continue;

    /* Un segundo portero no entra de jugador de campo. */
    if (esPortero(candidato.jugador)) continue;

    const suya = candidato.y;

    /* Las líneas de campo, de la más cercana a su altura a la más lejana. */
    const cercania = huecos
      .map((hueco, indice) => ({ indice, lejos: Math.abs(hueco.y - suya) }))
      .filter((uno) => uno.indice > 0)
      .sort((a, b) => a.lejos - b.lejos);

    const destino = cercania.find((uno) => libre(uno.indice));

    if (!destino) break;

    puestos.get(destino.indice)?.push(candidato);
  }

  return puestos;
}

/**
 * Completa un once corto con gente de la hoja.
 *
 * Pasa en agosto —tres alineaciones bajadas y media plantilla sin estrenar— y
 * cuando un club acaba de fichar. Se rellena por el puesto que dice la hoja,
 * que es lo mismo que hace el campograma de la pantalla, y sin repetir a nadie.
 */
function rellena(
  puestos: Map<number, Candidato[]>,
  estructura: string,
  plantilla: JugadorDeLaHoja[],
  yaPuestos: Set<string>,
) {
  const huecos = huecosDe(estructura);

  const disponibles = plantilla.filter(
    (jugador) => !yaPuestos.has(jugador.clave),
  );

  huecos.forEach((hueco, indice) => {
    const dentro = puestos.get(indice) ?? [];

    while (dentro.length < hueco.sitios) {
      const soloPorteros = indice === 0;

      /* El más cercano de puesto a la línea que falta; en la portería, un
         portero o nada: un lateral con el 1 a la espalda no se propone. */
      const candidatos = disponibles.filter((jugador) =>
        soloPorteros ? esPortero(jugador) : !esPortero(jugador),
      );

      if (candidatos.length === 0) return;

      candidatos.sort(
        (a, b) =>
          Math.abs(alturaDeSuPuesto(a) - hueco.y) -
          Math.abs(alturaDeSuPuesto(b) - hueco.y),
      );

      const elegido = candidatos[0];

      disponibles.splice(disponibles.indexOf(elegido), 1);

      yaPuestos.add(elegido.clave);

      dentro.push({
        jugador: elegido,
        puntos: 0,
        x: 0.5,
        y: hueco.y,
        ultima: Number.MAX_SAFE_INTEGER,
      });
    }
  });
}

/* ------------------------------------------------------------------ */
/*  EL ONCE                                                            */
/* ------------------------------------------------------------------ */

/**
 * Propone un once probable a partir de los que ha sacado el rival.
 *
 * Devuelve `null` cuando no hay de dónde sacarlo —ni una alineación bajada, o
 * ninguno de los que jugaron está en la hoja—: es preferible que la pantalla lo
 * diga a proponer once nombres al azar.
 */
export function sugiereOnce(
  informe: InformeEquipo,
  plantilla: JugadorDeLaHoja[],
): OnceSugerido | null {
  if (plantilla.length === 0) return null;

  const { elegidas, conAmistosos } = alineacionesQueCuentan(informe);

  const alineaciones = elegidas.map((uno) => uno.once);

  if (alineaciones.length === 0) return null;

  const { candidatos, sinFicha } = cuentaHabituales(alineaciones, plantilla);

  if (candidatos.length === 0) return null;

  const estructura = estructuraMasRepetida(alineaciones, informe);

  const puestos = colocaEnLineas(candidatos, estructura);

  const yaPuestos = new Set<string>();

  puestos.forEach((linea) =>
    linea.forEach((uno) => yaPuestos.add(uno.jugador.clave)),
  );

  rellena(puestos, estructura, plantilla, yaPuestos);

  /*
  | Y a repartir a lo ancho: dentro de cada línea manda el sitio medio en el
  | que han jugado —el lateral izquierdo a la izquierda—, y quien no tenga
  | ninguno (los del relleno) se queda por el centro, que es de donde menos se
  | le mueve al retocarlo.
  */
  const titulares: string[] = [];

  const campo: Record<string, OncePos> = {};

  const huecos = huecosDe(estructura);

  huecos.forEach((hueco, indice) => {
    const dentro = [...(puestos.get(indice) ?? [])].sort((a, b) => a.x - b.x);

    dentro.forEach((uno, sitio) => {
      titulares.push(uno.jugador.clave);

      campo[uno.jugador.clave] = {
        x: (sitio + 1) / (dentro.length + 1),
        y: hueco.y,
      };
    });
  });

  if (titulares.length === 0) return null;

  return {
    titulares,
    campo,
    estructura,
    alineaciones: alineaciones.length,
    conAmistosos,
    sinFicha,
  };
}

/** Cómo se cuenta en pantalla de dónde ha salido la propuesta. */
export function explicaSugerencia(sugerido: OnceSugerido) {
  const cuantas = `${sugerido.alineaciones} ${
    sugerido.alineaciones === 1 ? "alineación" : "alineaciones"
  }`;

  return `${sugerido.estructura} · ${cuantas}${
    sugerido.conAmistosos ? " (con pretemporada)" : ""
  }`;
}
