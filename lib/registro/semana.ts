/**
 * LA SEMANA COMO TABLERO: mover, copiar y medir sin tocar la hoja.
 *
 * Todo lo de aquí es puro —recibe un microciclo y devuelve otro— para que el
 * deshacer de la pantalla funcione con fotos del estado y para poder probarlo
 * sin navegador. Lo usa el editor de `/laboratorio/microciclo` (21/10/2026).
 */

import type { RegistroTarea } from "@/lib/abp/registro";

import {
  copiaDeTarea,
  renumera,
  tareasQueSeEscriben,
  type MicroNuevo,
  type TareaNueva,
} from "./hoja";

/** La fila del partido («X-COMP»): no se arrastra ni se copia a otro día. */
export const esCompeticion = (tarea: TareaNueva) => /-COMP$/i.test(tarea.tarea);

/**
 * Cómo escribe la hoja el partido en «Contenido Secundario»: el de casa
 * delante, «RMCF - ANTEQUERA CF» en casa y «ALGECIRAS CF - RMCF» fuera.
 *
 * Copiar la semana del micro 18 traía «ALGECIRAS CF - RMCF» al partido contra
 * el Cartagena: el rival de otra semana escrito en la fila del partido.
 */
export function textoDelPartido(rival: string, lado: "casa" | "fuera" | string | undefined) {
  const suyo = rival.trim().toUpperCase();

  if (!suyo) return "";

  return lado === "fuera" ? `${suyo} - RMCF` : `RMCF - ${suyo}`;
}

/** Pone el partido de ESTA semana en su fila de competición. */
export function conPartido(micro: MicroNuevo, texto: string): MicroNuevo {
  if (!texto) return micro;

  return {
    ...micro,
    sesiones: micro.sesiones.map((sesion) =>
      sesion.tareas.some(esCompeticion)
        ? {
            ...sesion,
            tareas: sesion.tareas.map((tarea) =>
              esCompeticion(tarea)
                ? {
                    ...tarea,
                    contenidoPrincipal: tarea.contenidoPrincipal || "Competición",
                    contenidoSecundario: texto,
                    /* Un partido son 90′: es lo que la hoja lleva en todas las filas de competición. */
                    tiempo: tarea.tiempo || 90,
                  }
                : tarea,
            ),
          }
        : sesion,
    ),
  };
}

/* ------------------------------------------------------------------ */
/*  MOVER Y COPIAR                                                     */
/* ------------------------------------------------------------------ */

/**
 * Lleva una tarea a otro sitio: dentro del mismo día (reordenar) o a otro.
 *
 * `hacia` es la posición en el día de destino ANTES de quitarla del de origen,
 * que es lo que el tablero sabe cuando se suelta encima de una tarjeta. Las dos
 * sesiones se renumeran: la tarea que pasa del martes al jueves deja de ser
 * «M-T3» y pasa a «J-T2». Un día libre que recibe una tarea deja de serlo.
 */
export function mueveTarea(
  micro: MicroNuevo,
  desde: { sesion: number; tarea: number },
  hasta: { sesion: number; indice: number },
): MicroNuevo {
  const origen = micro.sesiones[desde.sesion];
  const destino = micro.sesiones[hasta.sesion];
  const tarea = origen?.tareas[desde.tarea];

  if (!origen || !destino || !tarea || esCompeticion(tarea)) return micro;

  if (desde.sesion === hasta.sesion) {
    const tareas = [...origen.tareas];

    tareas.splice(desde.tarea, 1);

    /* Al quitarla, lo que había detrás sube un puesto. */
    const indice = Math.max(0, Math.min(tareas.length, hasta.indice > desde.tarea ? hasta.indice - 1 : hasta.indice));

    tareas.splice(indice, 0, tarea);

    if (tareas.every((una, i) => una === origen.tareas[i])) return micro;

    return {
      ...micro,
      sesiones: micro.sesiones.map((sesion, i) => (i === desde.sesion ? renumera({ ...sesion, tareas }) : sesion)),
    };
  }

  const quedan = origen.tareas.filter((_, i) => i !== desde.tarea);

  /* El partido se queda el último del día: lo que llega va antes que él. */
  const sinComp = destino.tareas.filter((una) => !esCompeticion(una));
  const comp = destino.tareas.filter(esCompeticion);
  const indice = Math.max(0, Math.min(sinComp.length, hasta.indice));

  const llegan = [...sinComp.slice(0, indice), tarea, ...sinComp.slice(indice), ...comp];

  return {
    ...micro,
    sesiones: micro.sesiones.map((sesion, i) => {
      if (i === desde.sesion) return renumera({ ...sesion, tareas: quedan });

      if (i === hasta.sesion) return renumera({ ...sesion, libre: false, tareas: llegan });

      return sesion;
    }),
  };
}

/**
 * Copia las tareas de un día en otro, como hace «Duplicar» con una sola: sin
 * tiempo, intensidad ni valoración, que son de la sesión que se haga.
 *
 * Las del día de destino que estén en blanco se sustituyen; las que tengan
 * algo escrito se quedan y las copiadas van detrás. Así copiar no borra nunca
 * trabajo, y si sobra algo se quita con la papelera (o se deshace).
 */
export function copiaDia(micro: MicroNuevo, desde: number, hasta: number): { micro: MicroNuevo; copiadas: number } {
  const origen = micro.sesiones[desde];
  const destino = micro.sesiones[hasta];

  if (!origen || !destino || desde === hasta) return { micro, copiadas: 0 };

  const copias = tareasQueSeEscriben(origen).filter((tarea) => !esCompeticion(tarea)).map(copiaDeTarea);

  if (copias.length === 0) return { micro, copiadas: 0 };

  const conAlgo = destino.libre ? [] : tareasQueSeEscriben(destino).filter((tarea) => !esCompeticion(tarea));
  const comp = destino.tareas.filter(esCompeticion);

  return {
    micro: {
      ...micro,
      sesiones: micro.sesiones.map((sesion, i) =>
        i === hasta ? renumera({ ...sesion, libre: false, tareas: [...conAlgo, ...copias, ...comp] }) : sesion,
      ),
    },
    copiadas: copias.length,
  };
}

/* ------------------------------------------------------------------ */
/*  LA REFERENCIA: CÓMO SUELE SER CADA MD                              */
/* ------------------------------------------------------------------ */

export type ReferenciaMd = {
  /** Sesiones con carga de esta temporada que llevan ese MD. */
  sesiones: number;
  /** Media de la carga (tiempo × intensidad) de la sesión. */
  carga: number;
  /** Media de los minutos de la sesión. */
  minutos: number;
};

/**
 * Lo que suele llevar cada MD en la hoja: carga y minutos medios por sesión.
 *
 * Una sesión es un MD en una fecha. Sólo cuentan las que tienen tiempo e
 * intensidad escritos —una sesión esbozada sin cargas bajaría la media— y se
 * deja fuera el propio microciclo que se está editando, para no compararlo
 * consigo mismo. Con menos de tres sesiones no hay referencia: una media de
 * dos días no dice cómo «suele» ser nada.
 */
export function referenciaPorMd(
  tareas: RegistroTarea[],
  { sinMicro, temporada }: { sinMicro?: number; temporada?: string } = {},
): Record<string, ReferenciaMd> {
  const porSesion = new Map<string, { md: string; carga: number; minutos: number }>();

  for (const tarea of tareas) {
    if (sinMicro && tarea.micro === sinMicro) continue;

    if (temporada && tarea.temporada.replace(/\s+/g, "") !== temporada.replace(/\s+/g, "")) continue;

    const md = tarea.md.trim().toUpperCase();

    if (!md || !(tarea.tiempo > 0) || !(tarea.intensidad > 0)) continue;

    const clave = `${tarea.fecha}|${md}`;
    const suya = porSesion.get(clave) ?? { md, carga: 0, minutos: 0 };

    suya.carga += tarea.tiempo * tarea.intensidad;
    suya.minutos += tarea.tiempo;

    porSesion.set(clave, suya);
  }

  const porMd = new Map<string, { n: number; carga: number; minutos: number }>();

  for (const sesion of porSesion.values()) {
    const suya = porMd.get(sesion.md) ?? { n: 0, carga: 0, minutos: 0 };

    suya.n += 1;
    suya.carga += sesion.carga;
    suya.minutos += sesion.minutos;

    porMd.set(sesion.md, suya);
  }

  const salida: Record<string, ReferenciaMd> = {};

  for (const [md, suya] of porMd) {
    if (suya.n < 3) continue;

    salida[md] = {
      sesiones: suya.n,
      carga: Math.round(suya.carga / suya.n),
      minutos: Math.round(suya.minutos / suya.n),
    };
  }

  return salida;
}

/** Carga y minutos de un día del microciclo en pantalla (lo que se escribiría). */
export function cargaDelDia(sesion: MicroNuevo["sesiones"][number]) {
  const tareas = tareasQueSeEscriben(sesion);

  return {
    minutos: tareas.reduce((n, t) => n + (t.tiempo || 0), 0),
    carga: tareas.reduce((n, t) => n + (t.tiempo || 0) * (t.intensidad || 0), 0),
    /* Sin tiempo o sin intensidad en alguna, la carga del día está a medias. */
    completa: tareas.length > 0 && tareas.every((t) => t.tiempo > 0 && t.intensidad > 0),
    tareas: tareas.length,
  };
}

/**
 * Cómo queda el día frente a lo habitual de su MD, en palabras cortas.
 * `null` si no hay con qué comparar o el día no tiene la carga completa.
 */
export function frenteAReferencia(carga: number, referencia: ReferenciaMd | undefined) {
  if (!referencia || !(referencia.carga > 0) || !(carga > 0)) return null;

  const diferencia = Math.round(((carga - referencia.carga) / referencia.carga) * 100);

  const tono: "alta" | "baja" | "normal" = diferencia >= 20 ? "alta" : diferencia <= -20 ? "baja" : "normal";

  return { diferencia, tono };
}

/* ------------------------------------------------------------------ */
/*  LA SEMANA EN TEXTO, PARA PEGAR EN EL GRUPO DEL STAFF               */
/* ------------------------------------------------------------------ */

/**
 * El microciclo en unas líneas: un día por renglón y sus tareas debajo.
 *
 * Va en el formato de WhatsApp (`*negrita*`) porque es donde se pega. Lo que no
 * está escrito no sale: ni «0′», ni guiones de relleno.
 */
export function resumenDeLaSemana(
  micro: MicroNuevo,
  partido: { rival: string; jornada?: number | string; cuando?: string; lado?: string } | null,
  nombreDia: (fecha: string) => string,
) {
  const cabecera = [`*Microciclo ${micro.micro} · ${(partido?.rival || micro.rival).toUpperCase()}*`];

  if (partido?.jornada) cabecera.push(`J${partido.jornada}${partido.lado ? (partido.lado === "fuera" ? " · fuera" : " · en casa") : ""}`);

  const lineas = [cabecera.join(" · "), ""];

  for (const sesion of micro.sesiones) {
    const dia = cargaDelDia(sesion);
    const nombre = nombreDia(sesion.fecha);
    const nombreBonito = nombre.charAt(0).toUpperCase() + nombre.slice(1);

    if (sesion.libre) {
      lineas.push(`*${nombreBonito}* · ${sesion.md} · libre`);

      continue;
    }

    const tareas = tareasQueSeEscriben(sesion);

    if (tareas.length === 0) continue;

    const partidoDia = tareas.some(esCompeticion) && tareas.length === 1;

    lineas.push(
      `*${nombreBonito}* · ${sesion.md}${partidoDia ? " · partido" : dia.minutos > 0 ? ` · ${dia.minutos}′` : ""}`,
    );

    if (partidoDia) continue;

    for (const tarea of tareas) {
      if (esCompeticion(tarea)) continue;

      const contenido = [tarea.contenidoPrincipal, tarea.contenidoSecundario].filter(Boolean).join(" / ");
      const datos = [tarea.tiempo > 0 ? `${tarea.tiempo}′` : "", tarea.intensidad > 0 ? `int. ${tarea.intensidad}` : ""].filter(Boolean).join(", ");

      lineas.push(`  • ${tarea.tipoTarea || tarea.tarea}${contenido ? ` — ${contenido}` : ""}${datos ? ` (${datos})` : ""}`);
    }
  }

  return lineas.join("\n").trim();
}
