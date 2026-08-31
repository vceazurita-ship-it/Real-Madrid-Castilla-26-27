/*
|--------------------------------------------------------------------------
| EN QUÉ ORDEN SE MIRAN LAS PLANTILLAS RIVALES
|--------------------------------------------------------------------------
|
| Los diecinueve equipos del grupo salían por orden alfabético, que no es el
| orden en que hacen falta: la plantilla que se abre el lunes es la del rival
| del domingo, y estaba la novena de la fila detrás de un montón de equipos
| contra los que no se juega hasta noviembre.
|
| Aquí se ordenan **por cuándo toca jugar contra ellos**. La hoja RIVALES trae
| la liga entera desde el primer día —las treinta y ocho jornadas—, así que a
| cada equipo se le mira su próximo partido y con eso se ordena la fila.
|
| Es lo que se pidió y no hay nada que tocar después de cada jornada: el rival
| de esta semana sale el primero y al día siguiente del partido se va al final
| solo, porque su siguiente partido pasa a ser el de la vuelta. En la ida eso
| es exactamente el calendario corrido —Teruel, Torremolinos, Águilas…— y en
| la segunda mitad de temporada sigue funcionando, que es cuando un orden fijo
| de la ida se habría quedado obsoleto.
|
| Lo usa el selector de equipo de `/rivals`. Está aparte de la página porque
| decidir el orden es una regla del calendario, no de una pantalla.
*/

import {
  cargaJornadas,
  normaliza,
  type JornadaRival,
} from "@/lib/abp/jornada";

export type OrdenRivales = {
  /** Los rivales, tal y como los escribe la hoja, en el orden en que tocan. */
  equipos: string[];
  /** Contra quién se juega el próximo partido: el primero de la lista. */
  actual: string;
  /** Su jornada ("1", "2"…) y su fecha, para poder etiquetarlo en pantalla. */
  jornada: string;
  fecha: string;
};

/** Lo que se enseña mientras la hoja no ha contestado: el orden de siempre. */
export const SIN_ORDEN: OrdenRivales = {
  equipos: [],
  actual: "",
  jornada: "",
  fecha: "",
};

/**
 * Hoy en formato "YYYY-MM-DD", con el día del reloj de aquí.
 *
 * `toISOString()` a secas da el día en UTC: a la una de la madrugada de un
 * domingo de partido diría que todavía es sábado y el rival de la semana no
 * saldría el primero. Se corrige el desfase antes de recortar.
 *
 * Mira el reloj, así que **no vale llamarla en el cuerpo de un componente**:
 * va dentro del efecto que carga las jornadas.
 */
export function claveDeHoy(momento: Date = new Date()) {
  const local = new Date(momento.getTime() - momento.getTimezoneOffset() * 60000);

  return local.toISOString().slice(0, 10);
}

/** Cuándo toca el siguiente partido contra un equipo. */
export type Enfrentamiento = {
  equipo: string;
  jornada: string;
  fecha: string;
  /** Está por jugarse. Si no, es el último que se le jugó. */
  porVenir: boolean;
};

/**
 * A cada rival, su próximo partido, y todos ordenados por él.
 *
 * El de **hoy** cuenta como próximo —se juega esta tarde y es la plantilla que
 * se está mirando—, así que el corte es `fecha >= hoy`. Mañana ese partido ya
 * no cuenta, el siguiente contra ese equipo es el de la vuelta, y por eso se
 * va al final de la fila.
 *
 * Los que ya no tienen partido por delante —final de temporada, o una hoja sin
 * fechas— van detrás de todos y ordenados por la fecha en que se les jugó, de
 * modo que el último rival de la temporada queda el último de la lista.
 */
export function proximosEnfrentamientos(
  jornadas: JornadaRival[],
  hoy: string,
): Enfrentamiento[] {
  /* Un mismo rival aparece dos veces en la hoja: ida y vuelta. */
  const porEquipo = new Map<string, JornadaRival[]>();

  for (const jornada of jornadas) {
    if (!jornada.equipo) continue;

    const clave = normaliza(jornada.equipo);

    porEquipo.set(clave, [...(porEquipo.get(clave) ?? []), jornada]);
  }

  const enfrentamientos = [...porEquipo.values()].map((partidos) => {
    const ordenados = [...partidos].sort(
      (a, b) => Number(a.jornada || 0) - Number(b.jornada || 0),
    );

    const porVenir = ordenados.find(
      (partido) => partido.fecha && partido.fecha >= hoy,
    );

    const elegido = porVenir ?? ordenados[ordenados.length - 1];

    return {
      equipo: elegido.equipo,
      jornada: elegido.jornada,
      fecha: elegido.fecha,
      porVenir: Boolean(porVenir),
    };
  });

  return enfrentamientos.sort((a, b) => {
    if (a.porVenir !== b.porVenir) return a.porVenir ? -1 : 1;

    /* Sin fecha que comparar —una fila a medio rellenar— manda la jornada. */
    const fecha = (a.fecha || "").localeCompare(b.fecha || "");

    return fecha !== 0 ? fecha : Number(a.jornada || 0) - Number(b.jornada || 0);
  });
}

/** El orden de los rivales tal y como lo necesita la pantalla. */
export function ordenaPorCalendario(
  jornadas: JornadaRival[],
  hoy: string,
): OrdenRivales {
  const enfrentamientos = proximosEnfrentamientos(jornadas, hoy);

  const primero = enfrentamientos[0];

  if (!primero) return SIN_ORDEN;

  return {
    equipos: enfrentamientos.map((enfrentamiento) => enfrentamiento.equipo),
    actual: primero.porVenir ? primero.equipo : "",
    jornada: primero.porVenir ? primero.jornada : "",
    fecha: primero.porVenir ? primero.fecha : "",
  };
}

/**
 * Qué puesto le toca a un equipo.
 *
 * La hoja RIVALES y la de plantillas escriben los nombres igual —«Águilas FC»
 * en las dos—, pero se comparan normalizados por si alguna vez se separan por
 * un acento o por las siglas del club. Lo que no aparezca en el calendario se
 * va al final en vez de colarse delante del rival de la semana.
 */
export function puestoEnOrden(orden: OrdenRivales, equipo: string) {
  const buscado = normaliza(equipo);

  if (!buscado) return Number.MAX_SAFE_INTEGER;

  const puesto = orden.equipos.findIndex(
    (nombre) => normaliza(nombre) === buscado,
  );

  return puesto < 0 ? Number.MAX_SAFE_INTEGER : puesto;
}

/**
 * El comparador que ordena cualquier lista de equipos por el calendario.
 *
 * A igualdad de puesto —los que no están en el calendario— manda el nombre,
 * que es como estaban antes: así la cola de la lista no baila entre cargas.
 */
export function comparaPorCalendario(orden: OrdenRivales) {
  return (a: string, b: string) => {
    const puesto = puestoEnOrden(orden, a) - puestoEnOrden(orden, b);

    return puesto !== 0 ? puesto : a.localeCompare(b);
  };
}

/**
 * Las jornadas de la hoja, ya ordenadas, sin que quien llame sepa de fetch.
 *
 * Nunca lanza: si la hoja no contesta, las plantillas tienen que salir igual
 * —en orden alfabético, como antes— en vez de dejar la página en blanco.
 */
export async function cargaOrdenRivales(
  signal?: AbortSignal,
): Promise<OrdenRivales> {
  try {
    return ordenaPorCalendario(await cargaJornadas(signal), claveDeHoy());
  } catch (error) {
    console.error("[orden-calendario] no se ha podido leer el calendario", error);

    return SIN_ORDEN;
  }
}
