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
  /** Media de tareas por sesión (21/10/2026), con un decimal. */
  tareas: number;
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
  const porSesion = new Map<string, { md: string; carga: number; minutos: number; tareas: number }>();

  for (const tarea of tareas) {
    if (sinMicro && tarea.micro === sinMicro) continue;

    if (temporada && tarea.temporada.replace(/\s+/g, "") !== temporada.replace(/\s+/g, "")) continue;

    const md = tarea.md.trim().toUpperCase();

    if (!md || !(tarea.tiempo > 0) || !(tarea.intensidad > 0)) continue;

    const clave = `${tarea.fecha}|${md}`;
    const suya = porSesion.get(clave) ?? { md, carga: 0, minutos: 0, tareas: 0 };

    suya.carga += tarea.tiempo * tarea.intensidad;
    suya.minutos += tarea.tiempo;
    suya.tareas += 1;

    porSesion.set(clave, suya);
  }

  const porMd = new Map<string, { n: number; carga: number; minutos: number; tareas: number }>();

  for (const sesion of porSesion.values()) {
    const suya = porMd.get(sesion.md) ?? { n: 0, carga: 0, minutos: 0, tareas: 0 };

    suya.n += 1;
    suya.carga += sesion.carga;
    suya.minutos += sesion.minutos;
    suya.tareas += sesion.tareas;

    porMd.set(sesion.md, suya);
  }

  const salida: Record<string, ReferenciaMd> = {};

  for (const [md, suya] of porMd) {
    if (suya.n < 3) continue;

    salida[md] = {
      sesiones: suya.n,
      carga: Math.round(suya.carga / suya.n),
      minutos: Math.round(suya.minutos / suya.n),
      tareas: Math.round((suya.tareas / suya.n) * 10) / 10,
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

/** «media de 3 sesiones: carga 186 · 45′», la base de un «+96 %». */
export function baseDeReferencia(referencia: ReferenciaMd) {
  return `media de ${plural(referencia.sesiones, "sesión", "sesiones")}: carga ${referencia.carga} · ${referencia.minutos}′`;
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

  const lineas = [cabecera.join(" · ")];

  if (micro.objetivo?.trim()) lineas.push(`_Objetivo: ${micro.objetivo.trim()}_`);

  lineas.push("");

  for (const sesion of micro.sesiones) {
    const dia = cargaDelDia(sesion);
    const nombre = nombreDia(sesion.fecha);
    const nombreBonito = nombre.charAt(0).toUpperCase() + nombre.slice(1);

    if (sesion.libre) {
      lineas.push(`*${nombreBonito}* · ${sesion.md} · libre`);

      continue;
    }

    const tareas = tareasDeLaLamina(sesion);

    /* Lo mismo que la lámina (21/10/2026): antes el texto se saltaba el día. */
    if (tareas.length === 0) {
      const vacias = tareasQueSeEscriben(sesion).filter(tareaSinContenido);

      if (vacias.length > 0) {
        lineas.push(`*${nombreBonito}* · ${sesion.md} · por definir (${vacias.map((tarea) => tarea.tipoTarea || tarea.tarea).join(", ")})`);
      }

      continue;
    }

    const partidoDia = tareas.some(esCompeticion) && tareas.length === 1;
    const delDia = [
      dia.minutos > 0 ? `${dia.minutos}′` : "",
      dia.completa && dia.carga > 0 ? `carga ${dia.carga}` : "",
    ].filter(Boolean).join(" · ");

    lineas.push(`*${nombreBonito}* · ${sesion.md}${partidoDia ? " · partido" : delDia ? ` · ${delDia}` : ""}`);

    if (partidoDia) continue;

    for (const tarea of tareas) {
      if (esCompeticion(tarea)) continue;

      const contenido = [tarea.contenidoPrincipal, tarea.contenidoSecundario].filter(Boolean).join(" / ");
      const datos = [tarea.tiempo > 0 ? `${tarea.tiempo}′` : "", tarea.intensidad > 0 ? `int. ${tarea.intensidad}` : ""].filter(Boolean).join(", ");

      lineas.push(sinGazapos(`  • ${tarea.tipoTarea || tarea.tarea}${contenido ? ` — ${contenido}` : ""}${datos ? ` (${datos})` : ""}`));
    }
  }

  lineas.push("", textoDeCuentas(cuentasDeLaSemana(micro)));

  return lineas.join("\n").trim();
}

/* ------------------------------------------------------------------ */
/*  LAS CUENTAS DE LA SEMANA, IGUALES EN TODOS LOS SITIOS              */
/* ------------------------------------------------------------------ */

/** «1 tarea», «3 tareas»: sin el «tarea(s)» de relleno. */
export function plural(n: number, uno: string, varios: string) {
  return `${n} ${n === 1 ? uno : varios}`;
}

export type CuentasSemana = {
  /**
   * Tareas de entrenamiento con contenido: las que salen en la lámina y en el
   * texto (sin el partido). Las que no tienen contenido van en `porDefinir`:
   * la lámina decía «12 tareas» y enseñaba nueve (21/10/2026).
   */
  tareas: number;
  /** Tareas de entreno sin contenido principal: se escriben, pero no salen. */
  porDefinir: number;
  /** Minutos de esas tareas. El partido no suma. */
  entreno: number;
  /** Tareas de entreno sin minutos: no suman a la carga. */
  sinMinutos: number;
  /** Minutos del partido (90′ si hay fila de competición). */
  partido: number;
  /** Filas que van a la hoja: las tareas más la del partido. */
  filas: number;
  /** Días con sesión de entreno. */
  sesiones: number;
  libres: number;
};

/**
 * Lo que mide la semana, contado una sola vez.
 *
 * Antes la cabecera decía «11 tarea(s) · 90′ en total» —los 90′ eran los del
 * partido, sumados a tareas copiadas sin minutos— y la barra de abajo contaba
 * 12 porque metía la fila del partido. El partido es una fila de la hoja, no
 * una tarea, y sus minutos no son de entrenamiento.
 */
export function cuentasDeLaSemana(micro: MicroNuevo): CuentasSemana {
  const cuentas: CuentasSemana = { tareas: 0, porDefinir: 0, entreno: 0, sinMinutos: 0, partido: 0, filas: 0, sesiones: 0, libres: 0 };

  for (const sesion of micro.sesiones) {
    if (sesion.libre) {
      cuentas.libres += 1;

      continue;
    }

    const tareas = tareasQueSeEscriben(sesion);

    cuentas.filas += tareas.length;

    const deEntreno = tareas.filter((tarea) => !esCompeticion(tarea));

    if (deEntreno.length > 0) cuentas.sesiones += 1;

    for (const tarea of tareas) {
      if (esCompeticion(tarea)) {
        cuentas.partido += tarea.tiempo || 0;

        continue;
      }

      if (tareaSinContenido(tarea)) cuentas.porDefinir += 1;
      else cuentas.tareas += 1;

      cuentas.entreno += tarea.tiempo || 0;

      if (!(tarea.tiempo > 0)) cuentas.sinMinutos += 1;
    }
  }

  return cuentas;
}

/** «11 tareas · 340′ de entreno · partido 90′», con el aviso si faltan minutos. */
export function textoDeCuentas(cuentas: CuentasSemana) {
  const trozos = [plural(cuentas.tareas, "tarea", "tareas")];

  if (cuentas.porDefinir > 0) trozos.push(`${cuentas.porDefinir} por definir`);

  if (cuentas.entreno > 0) trozos.push(`${cuentas.entreno}′ de entreno`);

  if (cuentas.partido > 0) trozos.push(`partido ${cuentas.partido}′`);

  return trozos.join(" · ");
}

/* ------------------------------------------------------------------ */
/*  GAZAPOS Y AVISOS ANTES DE SACAR LA LÁMINA                          */
/* ------------------------------------------------------------------ */

/**
 * Erratas y abreviaturas de la hoja que no deben llegar al grupo, en lista
 * cerrada: sólo se cambia lo que está aquí, nunca se «adivina».
 */
const GAZAPOS: [RegExp, string][] = [
  [/\bReiniciios\b/g, "Reinicios"],
  [/\bReinicos\b/g, "Reinicios"],
  [/\bInd\.\s*Finalizaci[oó]n\b/g, "Finalización individual"],
  [/\bFinalizacion\b/g, "Finalización"],
  [/\bTransicion\b/g, "Transición"],
  [/\bPresion\b/g, "Presión"],
  [/\bPosesion\b/g, "Posesión"],
  [/\bProgresion\b/g, "Progresión"],
  [/\bActivacion\b/g, "Activación"],
  [/\bCOMPETCI[OÓ]N\b/g, "COMPETICIÓN"],
];

export function sinGazapos(texto: string) {
  let limpio = texto;

  for (const [patron, bueno] of GAZAPOS) limpio = limpio.replace(patron, bueno);

  return limpio;
}

/** Una tarea de entreno sin contenido principal no sale en la lámina ni en el texto. */
export const tareaSinContenido = (tarea: TareaNueva) => !esCompeticion(tarea) && !tarea.contenidoPrincipal.trim();

/** Lo que sale en la lámina y en el texto: lo escrito y con contenido. */
export const tareasDeLaLamina = (sesion: MicroNuevo["sesiones"][number]) =>
  tareasQueSeEscriben(sesion).filter((tarea) => !tareaSinContenido(tarea));

/** Huella de un día para ver si dos seguidos son el mismo (tipo, contenido y formato). */
function huellaDelDia(sesion: MicroNuevo["sesiones"][number]) {
  return tareasQueSeEscriben(sesion)
    .filter((tarea) => !esCompeticion(tarea))
    .map((tarea) => [tarea.tipoTarea, tarea.contenidoPrincipal, tarea.contenidoSecundario, tarea.formato].join("|").toLowerCase())
    .join("¶");
}

export type AvisoSemana = { tipo: "sin-contenido" | "sin-minutos" | "dia-repetido" | "gazapo" | "carga-alta" | "muchas-tareas"; texto: string; sesion: number };

/**
 * Lo que conviene mirar antes de mandar la semana, sin impedir escribirla:
 * tareas sin contenido (no salen en la lámina), sin minutos (no suman a la
 * carga), dos días seguidos iguales (copiados de otra semana y sin tocar),
 * erratas de la lista y días muy por encima de lo habitual de su MD.
 */
export function avisosDeLaSemana(
  micro: MicroNuevo,
  nombreDia: (fecha: string) => string,
  referencia: Record<string, ReferenciaMd> = {},
): AvisoSemana[] {
  const avisos: AvisoSemana[] = [];

  /* Las tareas sin minutos van en un solo aviso: copiada la semana sin tiempos, eran once líneas iguales. */
  const sinMinutos: { dia: string; n: number; sesion: number }[] = [];

  micro.sesiones.forEach((sesion, s) => {
    if (sesion.libre) return;

    const dia = nombreDia(sesion.fecha);
    const tareas = tareasQueSeEscriben(sesion).filter((tarea) => !esCompeticion(tarea));

    const vacias = tareas.filter(tareaSinContenido);

    if (vacias.length > 0) {
      avisos.push({
        tipo: "sin-contenido",
        sesion: s,
        texto: `${dia}: ${vacias.map((tarea) => tarea.tipoTarea || tarea.tarea).join(", ")} sin contenido · no sale en la lámina ni en el texto`,
      });
    }

    const sinMin = tareas.filter((tarea) => !(tarea.tiempo > 0)).length;

    if (sinMin > 0) sinMinutos.push({ dia, n: sinMin, sesion: s });

    const erratas = new Set<string>();

    for (const tarea of tareas) {
      for (const texto of [tarea.tipoTarea, tarea.contenidoPrincipal, tarea.contenidoSecundario]) {
        if (texto && sinGazapos(texto) !== texto) erratas.add(`«${texto}» → «${sinGazapos(texto)}»`);
      }
    }

    if (erratas.size > 0) {
      avisos.push({ tipo: "gazapo", sesion: s, texto: `${dia}: ${[...erratas].join(", ")} · se corrige en la lámina y en el texto` });
    }

    const anterior = micro.sesiones[s - 1];

    if (anterior && !anterior.libre && tareas.length > 0 && huellaDelDia(anterior) === huellaDelDia(sesion)) {
      avisos.push({ tipo: "dia-repetido", sesion: s, texto: `${dia}: las mismas tareas que el día anterior · ¿copiado sin cambiar?` });
    }

    const carga = cargaDelDia(sesion);
    const frente = carga.completa ? frenteAReferencia(carga.carga, referencia[sesion.md.trim().toUpperCase()]) : null;

    const ref = referencia[sesion.md.trim().toUpperCase()];

    if (frente && ref && frente.diferencia >= 30) {
      avisos.push({
        tipo: "carga-alta",
        sesion: s,
        texto: `${dia} (${sesion.md}): carga ${carga.carga}, un ${frente.diferencia} % por encima de su ${baseDeReferencia(ref)}`,
      });
    }

    /* Más tareas de lo habitual en ese MD (21/10/2026), con la base dicha. */
    const conContenido = tareas.filter((tarea) => !tareaSinContenido(tarea)).length;

    if (ref && ref.tareas > 0 && conContenido >= ref.tareas + 1.5) {
      avisos.push({
        tipo: "muchas-tareas",
        sesion: s,
        texto: `${dia}: ${plural(conContenido, "tarea", "tareas")} · media del ${sesion.md.trim().toUpperCase()}: ${String(ref.tareas).replace(".", ",")} (${plural(ref.sesiones, "sesión", "sesiones")})`,
      });
    }
  });

  if (sinMinutos.length > 0) {
    const total = sinMinutos.reduce((n, uno) => n + uno.n, 0);

    avisos.unshift({
      tipo: "sin-minutos",
      sesion: sinMinutos[0].sesion,
      texto: `${plural(total, "tarea sin minutos", "tareas sin minutos")} (${sinMinutos.map((uno) => uno.dia).join(", ")}) · ${total === 1 ? "no suma" : "no suman"} a la carga de la semana`,
    });
  }

  return avisos;
}
