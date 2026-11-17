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
  esLiga,
  reparteOnceInicial,
  type InformeEquipo,
  type OncePartido,
  type Partido,
} from "@/lib/rivals/informe";

import { asignaTitulares, DIBUJOS, DIBUJO_POR_DEFECTO, dibujoDeCampo } from "@/lib/rivals/campograma-motor";

/* Sólo funciones, así que el ciclo con posiciones-temporada (que usa `indiceDeLaHoja`) no molesta. */
import { dibujoParecido, leePosicionesDeLaTemporada } from "@/lib/rivals/posiciones-temporada";

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
  /** De qué lado juega según la hoja: -1 izquierda, 1 derecha, 0 centro. */
  lado?: -1 | 0 | 1;
};

export type OnceSugerido = {
  /** Claves de la hoja, de portería a ataque. */
  titulares: string[];
  /** Dónde cae cada uno, en tanto por uno del campo vertical. */
  campo: Record<string, OncePos>;
  /** Clave de jugador → bloque del campograma: un titular por hueco del dibujo. */
  puestos: Record<string, string>;
  /** El dibujo del campograma con el que se ha llenado ("4-3-3"). */
  dibujo: string;
  /** "1-4-3-3": el dibujo con el portero delante, como lo escribe BeSoccer. */
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
export function indiceDeLaHoja(plantilla: JugadorDeLaHoja[]) {
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
/*  LOS ONCE HUECOS DEL DIBUJO                                         */
/* ------------------------------------------------------------------ */

/*
| 17/11/2026 (jueces de fútbol): antes se repartía por LÍNEAS —cuatro atrás,
| tres en el medio…— y cada uno se pintaba luego en el bloque de su puesto. Con
| dos laterales derechos en la línea de atrás salían J. Mier y Olmedo de
| titulares en el LD y nadie en el extremo izquierdo. Ahora se llenan los once
| HUECOS del dibujo (LI, DFC, DFC, LD, MCD…) de uno en uno, con
| `asignaTitulares` del motor: el que más ha jugado de cada puesto, el que
| sobra al banquillo y, si un puesto no tiene a nadie que haya jugado ahí, el
| de la plantilla que lo tiene escrito en la hoja.
*/

/**
 * Propone un once probable a partir de los que ha sacado el rival.
 *
 * - `dibujo`: el del campograma ("4-3-3"). Sin él, el más parecido al que más
 *   repite en sus alineaciones.
 * - `sitios`: dónde juega cada uno esta temporada (`leePosicionesDeLaTemporada`);
 *   sin él se calcula aquí, para que el informe y la pantalla digan lo mismo.
 *
 * Devuelve `null` cuando no hay de dónde sacarlo —ni una alineación bajada, o
 * ninguno de los que jugaron está en la hoja—: es preferible que la pantalla lo
 * diga a proponer once nombres al azar.
 */
export function sugiereOnce(
  informe: InformeEquipo,
  plantilla: JugadorDeLaHoja[],
  opciones: {
    dibujo?: string | null;
    sitios?: Map<string, { slot: string; lado: -1 | 0 | 1 }>;
  } = {},
): OnceSugerido | null {
  if (plantilla.length === 0) return null;

  const { elegidas, conAmistosos } = alineacionesQueCuentan(informe);

  const alineaciones = elegidas.map((uno) => uno.once);

  if (alineaciones.length === 0) return null;

  const { candidatos, sinFicha } = cuentaHabituales(alineaciones, plantilla);

  if (candidatos.length === 0) return null;

  const dibujo =
    (opciones.dibujo && DIBUJOS.some((uno) => uno.id === opciones.dibujo) ? opciones.dibujo : null) ??
    dibujoParecido(estructuraMasRepetida(alineaciones, informe)) ??
    DIBUJO_POR_DEFECTO;

  const bloques = dibujoDeCampo(dibujo);

  const sitios = opciones.sitios ?? leePosicionesDeLaTemporada(informe, plantilla).porJugador;

  const puntos = new Map(candidatos.map((uno) => [uno.jugador.clave, uno.puntos]));
  const maximo = Math.max(1, ...candidatos.map((uno) => uno.puntos));

  /* Toda la plantilla es candidata: quien ha jugado pesa lo que ha jugado y
     el resto sólo entra si su puesto se queda sin nadie. */
  const asignados = asignaTitulares(
    plantilla,
    (jugador) => sitios.get(jugador.clave) ?? { slot: jugador.slot, lado: jugador.lado ?? 0 },
    bloques,
    { peso: (jugador) => (puntos.get(jugador.clave) ?? 0) / maximo },
  );

  const titulares: string[] = [];
  const campo: Record<string, OncePos> = {};
  const puestos: Record<string, string> = {};

  /* De portería a ataque, en el orden del dibujo de abajo arriba. */
  [...bloques]
    .sort((a, b) => b.anchorY - a.anchorY || a.anchorX - b.anchorX)
    .forEach((bloque) => {
      const jugador = [...asignados.entries()].find(([, clave]) => clave === bloque.key)?.[0];

      if (!jugador) return;

      titulares.push(jugador.clave);
      campo[jugador.clave] = { x: bloque.anchorX, y: bloque.anchorY };
      puestos[jugador.clave] = bloque.key;
    });

  if (titulares.length === 0) return null;

  return {
    titulares,
    campo,
    puestos,
    dibujo,
    estructura: `1-${dibujo}`,
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
