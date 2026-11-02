/**
 * RELLENAR UNA SESIÓN RÁPIDO Y BIEN (02/11/2026).
 *
 * Lo que necesita el editor de `/laboratorio/microciclo` para que un día se
 * rellene en segundos con lo que el cuerpo técnico ya ha hecho:
 *
 * - **Los días de la hoja, agrupados por microciclo** (`diasDeLaHoja`), para
 *   copiar UN día de cualquier semana —no la semana entera— o una sola tarea.
 * - **El catálogo de ejercicios ya usados** (`catalogoDeEjercicios`): cada
 *   tarea distinta de la hoja con lo que la describe y sus minutos habituales,
 *   para autocompletar una tarea entera escribiendo dos letras.
 * - **La sesión tipo de cada MD** (`sesionTipo`): lo que más se repite en cada
 *   puesto de la sesión en ese MD, sacado de la hoja, no de un manual.
 * - **Avisos del día que no bloquean** (`avisosDelDia`).
 *
 * Todo es puro: recibe datos y devuelve datos. Lo que entra en el micro pasa
 * por `cambiaMicro` del editor, así que se deshace como cualquier otro cambio,
 * y se escribe en la hoja con el mismo `filasDelMicro` de siempre (las tres
 * columnas calculadas no se tocan nunca).
 */

import type { RegistroTarea } from "@/lib/abp/registro";

import {
  fechaIsoDeHoja,
  renumera,
  tareaEnBlanco,
  tareaVacia,
  tareasQueSeEscriben,
  type ColumnaRegistro,
  type MicroNuevo,
  type SesionNueva,
  type TareaNueva,
} from "./hoja";
import { esCompeticion, plural, type ReferenciaMd } from "./semana";

/* ------------------------------------------------------------------ */
/*  UTILIDADES                                                         */
/* ------------------------------------------------------------------ */

/** Minúsculas y sin tildes, para buscar y para comparar. */
export const normaliza = (texto: string) =>
  (texto || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

/** La fila del partido no se copia nunca a un día de entreno. */
const esPartidoDeHoja = (tarea: RegistroTarea) => /-COMP$/i.test(tarea.tarea) || /competici/i.test(tarea.fase);

const mediana = (valores: number[]) => {
  const buenos = valores.filter((valor) => valor > 0).sort((a, b) => a - b);

  if (buenos.length === 0) return 0;

  const medio = Math.floor(buenos.length / 2);

  return buenos.length % 2 ? buenos[medio] : Math.round((buenos[medio - 1] + buenos[medio]) / 2);
};

/** «Lo más repetido»; a igualdad, lo que salió antes en la lista (lo más reciente). */
function masRepetido(valores: string[]) {
  const cuenta = new Map<string, number>();

  for (const valor of valores) if (valor) cuenta.set(valor, (cuenta.get(valor) ?? 0) + 1);

  let mejor = "";
  let veces = 0;

  for (const [valor, n] of cuenta) {
    if (n > veces) {
      mejor = valor;
      veces = n;
    }
  }

  return mejor;
}

/* ------------------------------------------------------------------ */
/*  DE UNA FILA DE LA HOJA A UNA TAREA DEL EDITOR                      */
/* ------------------------------------------------------------------ */

/**
 * Una tarea de la hoja lista para entrar en el editor, como hace copiar una
 * semana: viaja todo lo que describe la tarea (tipo, fase, formato, grupo,
 * contenidos, espacio, jugadores y el bloque de la demanda cognitiva). El
 * tiempo y la intensidad sólo si se pide —normalmente los pone quien dirige
 * la sesión— y la valoración (Evaluación, Análisis Post) nunca: es de la
 * sesión que se hizo.
 */
export function tareaDeLaHoja(origen: RegistroTarea, dia: string, numero: number, conTiempos = false): TareaNueva {
  const base = tareaVacia(dia, numero);

  const ceros: ColumnaRegistro[] = [];

  /* Una tarea sin comodines tiene un 0 de verdad en la hoja: con el bloque
     relleno, el 0 es un dato (la fórmula de la demanda cognitiva lo lee). */
  if (origen.densidad > 0 && !origen.nComodines) ceros.push("NºComodines");

  return {
    ...base,
    tipoTarea: origen.tipoTarea,
    fase: origen.fase,
    formato: origen.formato,
    grupo: origen.grupo || base.grupo,
    jugadores: origen.jugadores || base.jugadores,
    contenidoPrincipal: origen.contenidoPrincipal,
    contenidoSecundario: origen.contenidoSecundario,
    tiempo: conTiempos ? origen.tiempo : 0,
    intensidad: conTiempos ? Math.min(10, origen.intensidad) : 0,
    exigCog: Math.min(10, Math.round(origen.exigCog)),
    densidad: origen.densidad,
    nJug: origen.nJug,
    nComodines: origen.nComodines,
    normativa: origen.normativa,
    incertidumbre: origen.incertidumbre,
    familiaridad: origen.familiaridad,
    motivacion: origen.motivacion,
    observaciones: "",
    ...(origen.espacio ? { extra: { Espacio: origen.espacio } } : {}),
    ...(ceros.length ? { ceros } : {}),
  };
}

/* ------------------------------------------------------------------ */
/*  LOS DÍAS DE LA HOJA, POR MICROCICLO                                */
/* ------------------------------------------------------------------ */

export type DiaDeLaHoja = {
  /** "2026-10-14". */
  fecha: string;
  md: string;
  /** Las tareas de entreno de ese día, en el orden de la hoja (sin el partido). */
  tareas: RegistroTarea[];
  minutos: number;
  /** «Rondo · Juego Posicional · Finalizaciones». */
  resumen: string;
  /** Media de la evaluación de sus tareas, si alguien las valoró. */
  nota: number;
};

export type MicroDeLaHoja = {
  clave: string;
  temporada: string;
  micro: number;
  rival: string;
  desde: string;
  hasta: string;
  dias: DiaDeLaHoja[];
  tareas: number;
};

/**
 * Los microciclos de la hoja con sus días de entreno, del más reciente al más
 * viejo. Un día es una fecha; los días sin tareas de entreno (sólo el
 * partido) no salen, porque no hay nada que copiar.
 */
export function diasDeLaHoja(tareas: RegistroTarea[]): MicroDeLaHoja[] {
  const porMicro = new Map<string, { temporada: string; micro: number; rivales: string[]; porFecha: Map<string, RegistroTarea[]> }>();

  for (const tarea of tareas) {
    const fecha = fechaIsoDeHoja(tarea.fecha);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) continue;

    const clave = `${tarea.temporada.replace(/\s+/g, "")}#${tarea.micro}`;
    const suyo = porMicro.get(clave) ?? { temporada: tarea.temporada, micro: tarea.micro, rivales: [] as string[], porFecha: new Map<string, RegistroTarea[]>() };

    if (tarea.rival) suyo.rivales.push(tarea.rival);

    if (!esPartidoDeHoja(tarea)) suyo.porFecha.set(fecha, [...(suyo.porFecha.get(fecha) ?? []), tarea]);

    porMicro.set(clave, suyo);
  }

  const salida: MicroDeLaHoja[] = [];

  for (const [clave, suyo] of porMicro) {
    const dias: DiaDeLaHoja[] = [...suyo.porFecha.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([fecha, delDia]) => {
        const notas = delDia.map((tarea) => tarea.evaluacion).filter((nota) => nota > 0);

        return {
          fecha,
          md: masRepetido(delDia.map((tarea) => tarea.md.trim().toUpperCase())),
          tareas: delDia,
          minutos: delDia.reduce((suma, tarea) => suma + (tarea.tiempo || 0), 0),
          resumen: [...new Set(delDia.map((tarea) => tarea.tipoTarea || tarea.contenidoPrincipal).filter(Boolean))].join(" · "),
          nota: notas.length ? Math.round((notas.reduce((a, b) => a + b, 0) / notas.length) * 10) / 10 : 0,
        };
      });

    if (dias.length === 0) continue;

    salida.push({
      clave,
      temporada: suyo.temporada,
      micro: suyo.micro,
      rival: masRepetido(suyo.rivales),
      desde: dias[0].fecha,
      hasta: dias[dias.length - 1].fecha,
      dias,
      tareas: dias.reduce((suma, dia) => suma + dia.tareas.length, 0),
    });
  }

  /* Los recientes arriba: por la última fecha, no por el número (dos temporadas repiten números). */
  return salida.sort((a, b) => b.hasta.localeCompare(a.hasta) || b.micro - a.micro);
}

/** Busca en los microciclos por número, rival, fecha o lo que llevan sus días. */
export function filtraMicros(micros: MicroDeLaHoja[], consulta: string) {
  const trozos = normaliza(consulta).split(" ").filter(Boolean);

  if (trozos.length === 0) return micros;

  return micros.filter((uno) => {
    const pajar = normaliza(
      [
        `micro ${uno.micro}`,
        `m${uno.micro}`,
        uno.rival,
        uno.temporada,
        uno.desde,
        uno.hasta,
        ...uno.dias.map((dia) => `${dia.md} ${dia.resumen} ${fechaCorta(dia.fecha)}`),
      ].join(" "),
    );

    return trozos.every((trozo) => pajar.includes(trozo));
  });
}

/** "2026-10-14" → "14/10". */
export const fechaCorta = (iso: string) => {
  const [, mes, dia] = iso.split("-");

  return mes && dia ? `${dia}/${mes}` : iso;
};

/** Los días de la hoja con ese MD, del más reciente al más viejo, con su micro. */
export function ultimosDelMd(micros: MicroDeLaHoja[], md: string, tope = 8) {
  const buscado = md.trim().toUpperCase();

  if (!buscado) return [];

  const salida: { micro: MicroDeLaHoja; dia: DiaDeLaHoja }[] = [];

  for (const micro of micros) {
    for (const dia of micro.dias) if (dia.md === buscado) salida.push({ micro, dia });
  }

  return salida.sort((a, b) => b.dia.fecha.localeCompare(a.dia.fecha)).slice(0, tope);
}

/* ------------------------------------------------------------------ */
/*  PEGAR TAREAS EN UN DÍA                                             */
/* ------------------------------------------------------------------ */

export type ModoPegar = "reemplazar" | "anadir";

/**
 * Pone `nuevas` en el día `indice` del micro.
 *
 * - **añadir**: las que ya tienen algo escrito se quedan y las nuevas van
 *   detrás (los huecos en blanco se van).
 * - **reemplazar**: el día se queda sólo con las nuevas.
 *
 * En los dos casos el partido (X-COMP) se queda donde estaba, el día deja de
 * ser libre y se renumera (M-T1, M-T2…). Se deshace con el historial.
 */
export function pegaEnDia(micro: MicroNuevo, indice: number, nuevas: TareaNueva[], modo: ModoPegar): MicroNuevo {
  const destino = micro.sesiones[indice];

  if (!destino || nuevas.length === 0) return micro;

  const comp = destino.tareas.filter(esCompeticion);
  const quedan = modo === "anadir" && !destino.libre ? destino.tareas.filter((tarea) => !esCompeticion(tarea) && !tareaEnBlanco(tarea)) : [];

  const tareas = [...quedan, ...nuevas.map((tarea) => ({ ...tarea, tarea: `${destino.dia}-T0` })), ...comp];

  return {
    ...micro,
    sesiones: micro.sesiones.map((sesion, i) => (i === indice ? renumera({ ...sesion, libre: false, tareas }) : sesion)),
  };
}

/** Lo que perdería el día al reemplazarlo: tareas escritas (sin el partido). */
export const tareasQueSePierden = (sesion: SesionNueva) =>
  tareasQueSeEscriben(sesion).filter((tarea) => !esCompeticion(tarea)).length;

/* ------------------------------------------------------------------ */
/*  EL CATÁLOGO DE EJERCICIOS YA USADOS                                */
/* ------------------------------------------------------------------ */

export type Ejercicio = {
  clave: string;
  /** La aparición más reciente: de ella sale lo que se copia. */
  modelo: RegistroTarea;
  usos: number;
  /** Fecha ISO de la última vez. */
  ultima: string;
  /** Minutos e intensidad habituales (mediana de las veces que se escribieron). */
  tiempo: number;
  intensidad: number;
  /** En qué MD se suele hacer, del más al menos usado. */
  mds: string[];
  /** Lo que se busca, ya normalizado. */
  pajar: string;
};

/**
 * Cada ejercicio distinto de la hoja —mismo tipo, contenidos y formato— con
 * cuántas veces se ha hecho, cuándo fue la última y sus minutos habituales.
 */
export function catalogoDeEjercicios(tareas: RegistroTarea[]): Ejercicio[] {
  const grupos = new Map<string, { veces: RegistroTarea[]; fechas: string[] }>();

  for (const tarea of tareas) {
    if (esPartidoDeHoja(tarea)) continue;

    if (!tarea.tipoTarea.trim() && !tarea.contenidoPrincipal.trim()) continue;

    const clave = [tarea.tipoTarea, tarea.contenidoPrincipal, tarea.contenidoSecundario, tarea.formato].map(normaliza).join("|");
    const suyo = grupos.get(clave) ?? { veces: [], fechas: [] };

    suyo.veces.push(tarea);
    suyo.fechas.push(fechaIsoDeHoja(tarea.fecha));

    grupos.set(clave, suyo);
  }

  const salida: Ejercicio[] = [];

  for (const [clave, { veces, fechas }] of grupos) {
    let ultimaPos = 0;

    fechas.forEach((fecha, i) => {
      if (fecha > fechas[ultimaPos]) ultimaPos = i;
    });

    /* Los MD por uso. */
    const cuentaMd = new Map<string, number>();

    for (const vez of veces) {
      const md = vez.md.trim().toUpperCase();

      if (md) cuentaMd.set(md, (cuentaMd.get(md) ?? 0) + 1);
    }

    const modelo = veces[ultimaPos];

    salida.push({
      clave,
      modelo,
      usos: veces.length,
      ultima: fechas[ultimaPos] ?? "",
      tiempo: mediana(veces.map((vez) => vez.tiempo)),
      intensidad: mediana(veces.map((vez) => vez.intensidad)),
      mds: [...cuentaMd].sort((a, b) => b[1] - a[1]).map(([md]) => md),
      pajar: normaliza(
        [modelo.tipoTarea, modelo.contenidoPrincipal, modelo.contenidoSecundario, modelo.formato, modelo.fase, modelo.espacio ?? ""].join(" "),
      ),
    });
  }

  return salida.sort((a, b) => b.usos - a.usos || b.ultima.localeCompare(a.ultima));
}

/**
 * Los ejercicios que encajan con lo escrito. Sin texto, los más usados en ese
 * MD primero (si se sabe el MD) y luego los más usados en general.
 */
export function buscaEjercicios(catalogo: Ejercicio[], consulta: string, md = "", tope = 8) {
  const trozos = normaliza(consulta).split(" ").filter(Boolean);
  const mdBuscado = md.trim().toUpperCase();

  const valen = trozos.length ? catalogo.filter((uno) => trozos.every((trozo) => uno.pajar.includes(trozo))) : catalogo;

  const puntos = (uno: Ejercicio) => {
    let p = Math.min(uno.usos, 20);

    if (mdBuscado && uno.mds[0] === mdBuscado) p += 15;
    else if (mdBuscado && uno.mds.includes(mdBuscado)) p += 6;

    /* Lo que empieza por lo escrito sube. */
    if (trozos.length && normaliza(uno.modelo.tipoTarea).startsWith(trozos[0])) p += 4;
    if (trozos.length && normaliza(uno.modelo.contenidoPrincipal).startsWith(trozos[0])) p += 4;

    return p;
  };

  return [...valen].sort((a, b) => puntos(b) - puntos(a) || b.ultima.localeCompare(a.ultima)).slice(0, tope);
}

/** «Rondo · Conservación · 4v4+3»: el nombre de un ejercicio en una línea. */
export const nombreDeEjercicio = (tarea: Pick<RegistroTarea, "tipoTarea" | "contenidoPrincipal" | "contenidoSecundario" | "formato">) =>
  [tarea.tipoTarea, tarea.contenidoPrincipal, tarea.contenidoSecundario, tarea.formato].filter((trozo) => trozo && trozo.trim()).join(" · ");

/** Ejercicio del catálogo → los campos que rellena en una tarea (sin tocar su nombre). */
export function camposDeEjercicio(ejercicio: Ejercicio, actual: TareaNueva): Partial<TareaNueva> {
  const copia = tareaDeLaHoja(ejercicio.modelo, actual.tarea.split("-")[0] || "L", 1, false);

  /* Lo que ya estaba escrito a mano en el nombre, el tiempo, la intensidad y las observaciones se respeta. */
  return {
    ...copia,
    tarea: actual.tarea,
    tiempo: actual.tiempo,
    intensidad: actual.intensidad,
    observaciones: actual.observaciones,
    extra: { ...(actual.extra ?? {}), ...(copia.extra ?? {}) },
  };
}

/** Los minutos habituales de una tarea: los de su ejercicio, o los de su tipo. */
export function minutosHabituales(tarea: TareaNueva, catalogo: Ejercicio[]) {
  const clave = [tarea.tipoTarea, tarea.contenidoPrincipal, tarea.contenidoSecundario, tarea.formato].map(normaliza).join("|");
  const exacto = catalogo.find((uno) => uno.clave === clave);

  if (exacto && exacto.tiempo > 0) return { tiempo: exacto.tiempo, intensidad: exacto.intensidad, de: "ejercicio" as const };

  const tipo = normaliza(tarea.tipoTarea);

  if (!tipo) return null;

  const mismos = catalogo.filter((uno) => normaliza(uno.modelo.tipoTarea) === tipo);
  const tiempo = mediana(mismos.map((uno) => uno.tiempo));

  return tiempo > 0 ? { tiempo, intensidad: mediana(mismos.map((uno) => uno.intensidad)), de: "tipo" as const } : null;
}

/** La fase con la que más se ha escrito un tipo de tarea. `""` si no se sabe. */
export function faseHabitual(tipoTarea: string, catalogo: Ejercicio[]) {
  const tipo = normaliza(tipoTarea);

  if (!tipo) return "";

  const fases: string[] = [];

  for (const uno of catalogo) {
    if (normaliza(uno.modelo.tipoTarea) === tipo && uno.modelo.fase) {
      for (let i = 0; i < uno.usos; i += 1) fases.push(uno.modelo.fase);
    }
  }

  return masRepetido(fases);
}

/* ------------------------------------------------------------------ */
/*  LA SESIÓN TIPO DE CADA MD                                          */
/* ------------------------------------------------------------------ */

export type SesionTipo = {
  md: string;
  /** Cuántas sesiones de ese MD hay detrás. */
  sesiones: number;
  tareas: RegistroTarea[];
};

/**
 * La sesión tipo de un MD, sacada de lo que ya se ha hecho: cuántas tareas
 * suele tener (la mediana) y, en cada puesto, el tipo de tarea más repetido
 * en ese puesto, con su versión más reciente como modelo. Con menos de dos
 * sesiones no hay «tipo»: devuelve `null`.
 */
export function sesionTipo(micros: MicroDeLaHoja[], md: string): SesionTipo | null {
  const buscado = md.trim().toUpperCase();

  if (!buscado || buscado === "MD") return null;

  /* Las sesiones de ese MD, de la más reciente a la más vieja. */
  const sesiones = ultimosDelMd(micros, buscado, 400).map(({ dia }) => dia.tareas);

  if (sesiones.length < 2) return null;

  const cuantas = mediana(sesiones.map((tareas) => tareas.length)) || 1;

  const tareas: RegistroTarea[] = [];
  const usadas = new Set<string>();

  for (let puesto = 0; puesto < cuantas; puesto += 1) {
    const enPuesto = sesiones.map((tareas) => tareas[puesto]).filter((tarea): tarea is RegistroTarea => Boolean(tarea));

    if (enPuesto.length === 0) break;

    const tipo = masRepetido(enPuesto.map((tarea) => tarea.tipoTarea));
    /* La versión más reciente de ese tipo en ese puesto, sin repetir ejercicio. */
    const modelo =
      enPuesto.find((tarea) => tarea.tipoTarea === tipo && !usadas.has(nombreDeEjercicio(tarea))) ??
      enPuesto.find((tarea) => tarea.tipoTarea === tipo) ??
      enPuesto[0];

    usadas.add(nombreDeEjercicio(modelo));
    tareas.push(modelo);
  }

  return tareas.length ? { md: buscado, sesiones: sesiones.length, tareas } : null;
}

/* ------------------------------------------------------------------ */
/*  AVISOS DEL DÍA QUE NO BLOQUEAN                                     */
/* ------------------------------------------------------------------ */

export type AvisoDia = { texto: string; tono: "info" | "ojo" };

/**
 * Lo que conviene mirar en un día, sin impedir nada: los minutos frente a lo
 * habitual de su MD y los campos que faltan en las tareas escritas. La
 * intensidad sólo se pide en los días que ya han pasado (la pone quien dirige
 * la sesión).
 */
export function avisosDelDia(sesion: SesionNueva, referencia: ReferenciaMd | undefined, yaPaso: boolean): AvisoDia[] {
  if (sesion.libre) return [];

  const tareas = tareasQueSeEscriben(sesion).filter((tarea) => !esCompeticion(tarea));

  if (tareas.length === 0) return [];

  const avisos: AvisoDia[] = [];

  const minutos = tareas.reduce((suma, tarea) => suma + (tarea.tiempo || 0), 0);

  if (referencia && referencia.minutos > 0 && minutos > 0) {
    const diferencia = Math.round(((minutos - referencia.minutos) / referencia.minutos) * 100);

    if (Math.abs(diferencia) >= 25) {
      avisos.push({
        tono: "ojo",
        texto: `${minutos}′ frente a ${referencia.minutos}′ de media del ${sesion.md.trim().toUpperCase()} (${diferencia > 0 ? "+" : ""}${diferencia} %)`,
      });
    } else {
      avisos.push({ tono: "info", texto: `${minutos}′ de ${referencia.minutos}′ habituales del ${sesion.md.trim().toUpperCase()}` });
    }
  }

  const cuenta = (filtro: (tarea: TareaNueva) => boolean, uno: string, varios: string) => {
    const n = tareas.filter(filtro).length;

    if (n > 0) avisos.push({ tono: "ojo", texto: plural(n, uno, varios) });
  };

  cuenta((tarea) => !tarea.tipoTarea.trim(), "tarea sin tipo", "tareas sin tipo");
  cuenta((tarea) => !tarea.fase.trim(), "tarea sin fase", "tareas sin fase");
  cuenta((tarea) => !tarea.contenidoPrincipal.trim(), "tarea sin contenido", "tareas sin contenido");
  cuenta((tarea) => !(tarea.tiempo > 0), "tarea sin minutos", "tareas sin minutos");

  if (yaPaso) cuenta((tarea) => tarea.tiempo > 0 && !(tarea.intensidad > 0), "tarea sin intensidad", "tareas sin intensidad");

  return avisos;
}

/**
 * Pone los minutos (y la intensidad, si se pide) habituales en las tareas del
 * día que no los tienen. Lo escrito a mano no se toca.
 */
export function conMinutosHabituales(sesion: SesionNueva, catalogo: Ejercicio[], conIntensidad = false) {
  let puestas = 0;

  const tareas = sesion.tareas.map((tarea) => {
    if (esCompeticion(tarea) || tareaEnBlanco(tarea) || tarea.tiempo > 0) return tarea;

    const habitual = minutosHabituales(tarea, catalogo);

    if (!habitual) return tarea;

    puestas += 1;

    return {
      ...tarea,
      tiempo: habitual.tiempo,
      intensidad: conIntensidad && !tarea.intensidad ? Math.min(10, habitual.intensidad) : tarea.intensidad,
    };
  });

  return { tareas, puestas };
}
