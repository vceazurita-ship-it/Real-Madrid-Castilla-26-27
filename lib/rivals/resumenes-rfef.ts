/**
 * LOS RESÚMENES OFICIALES DE CADA PARTIDO DEL RIVAL (03/11/2026).
 *
 * El canal de YouTube de la RFEF («Real Federación Española Fútbol»,
 * `UCQBxzdEPXjy05MtpfbdtMxQ`) sube el resumen de **todos** los partidos de
 * Primera Federación, con un título que siempre tiene la misma forma:
 *
 *     Resumen #PrimeraFederación | Hércules CF 2 – 0 R. Majadahonda | Jornada 10 | Temporada 2026/2027
 *
 * Su lista «Primera Federación | Temporada 2026/27» NO sirve: el 03/11/2026
 * tenía 135 resúmenes de los ~200 partidos jugados en los dos grupos. Los
 * subidos del canal sí los tienen todos (198), así que el servidor lee ésos
 * (`resumenes-rfef-servidor.ts`) y aquí sólo se lee el texto.
 *
 * Todo lo de aquí es texto: no toca red ni almacenamiento, para poder probarlo
 * sin navegador.
 *
 * El cruce de nombres es el delicado: la RFEF escribe «R. Majadahonda», «CF
 * Rayo Majadahonda», «Atl Madrileño», «RM Castilla», «Gimnàstic», «Hércules
 * de Alicante CF»… y en el mismo canal están los del otro grupo. Se reconoce a
 * cada equipo por las palabras que SÓLO tiene él dentro de nuestro grupo, y un
 * vídeo sólo cuenta si los DOS equipos del título son del grupo: así un
 * partido del grupo 1 no se cuela por una palabra suelta.
 */

import { desnuda } from "@/lib/rivals/youtube-listas";
import type { InformeDoc, InformeEquipo } from "@/lib/rivals/informe";

/** Un resumen tal y como lo da el servidor (compacto: viaja entero). */
export type ResumenRfef = {
  /** `videoId` de YouTube. */
  id: string;
  local: string;
  visitante: string;
  golesLocal: number;
  golesVisitante: number;
  jornada: number;
  /** Año en que empieza la temporada: 2026 para la 2026/27. */
  temporada: number;
  /** Duración en segundos; 0 si YouTube no la dio. */
  segundos: number;
};

/* ------------------------------------------------------------------ */
/*  EL TÍTULO                                                          */
/* ------------------------------------------------------------------ */

/*
| «#PrimeraFederación» a secas: «#PrimeraFederaciónIberdrola» es la liga
| femenina y comparte canal (y a veces equipos: «Athletic Club B»).
*/
const ES_PRIMERA_FEDERACION = /#PrimeraFederaci[oó]n(?![\p{L}\p{N}])/iu;

const ES_RESUMEN = /\bresumen\b/i;

/** «Hércules CF 2 – 0 R. Majadahonda», «RM Castilla 2–0 Torremolinos CF». */
const MARCADOR = /^(.+?)\s*(\d{1,2})\s*[-–—]+\s*(\d{1,2})(?!\d)\s*[-–—]?\s*(.+)$/;

const JORNADA = /\bjornada\s*(\d{1,2})\b/i;

/*
| «Temporada 2026/2027», «Temporada 26/27», «Temp 2025/26»… y las erratas que
| ya ha tenido el canal: «Temporada 226/27», «T. 2026/2027». Por eso manda el
| año de DETRÁS de la barra, que no ha salido mal ninguna vez.
*/
const TEMPORADA = /\bt(?:emp(?:orada)?)?\.?\s*(\d{2,4})\s*\/\s*(\d{2,4})\b/i;

/** El año en que empieza la temporada que dice el título; `null` si no lo dice. */
export function temporadaDeTitulo(titulo: string) {
  const m = TEMPORADA.exec(titulo);

  if (!m) return null;

  const fin = m[2].length === 2 ? 2000 + Number(m[2]) : Number(m[2]);

  return fin > 2000 && fin < 2100 ? fin - 1 : null;
}

/** Lo que se quita de los lados del nombre: comillas de «‘B’» y los restos del separador. */
const limpiaNombre = (nombre: string) =>
  nombre
    .replace(/[‘’“”'"«»]/g, "")
    .replace(/^[\s|·:-]+|[\s|·:-]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Lee el título de un resumen de Primera Federación. `null` si no es uno (una
 * previa, los mejores goles, la liga femenina, un playoff sin jornada…).
 */
export function leeTituloResumen(titulo: string): Omit<ResumenRfef, "id" | "segundos"> | null {
  if (!ES_PRIMERA_FEDERACION.test(titulo) || !ES_RESUMEN.test(titulo)) return null;

  const trozos = titulo.split("|").map((t) => t.trim()).filter(Boolean);

  /* Sin número de jornada también vale («Jornada  | Temporada 26/27», pasó en la J5): queda en 0. */
  const jornada = JORNADA.exec(titulo);
  const temporada = temporadaDeTitulo(titulo);

  if (temporada === null) return null;

  for (const trozo of trozos) {
    /* El marcador va en su propio trozo; si falta un «|», se corta en «Jornada». */
    const sinJornada = trozo.split(/\bjornada\b/i)[0];

    const m = MARCADOR.exec(sinJornada.trim());

    if (!m || /#/.test(m[1])) continue;

    const local = limpiaNombre(m[1]);
    const visitante = limpiaNombre(m[4]);

    if (!local || !visitante) continue;

    return {
      local,
      visitante,
      golesLocal: Number(m[2]),
      golesVisitante: Number(m[3]),
      jornada: jornada ? Number(jornada[1]) : 0,
      temporada,
    };
  }

  return null;
}

/** La temporada que se está jugando en esa fecha: de julio a junio. */
export function temporadaEn(fecha: Date) {
  return fecha.getUTCMonth() >= 6 ? fecha.getUTCFullYear() : fecha.getUTCFullYear() - 1;
}

/* ------------------------------------------------------------------ */
/*  LOS EQUIPOS DEL GRUPO                                              */
/* ------------------------------------------------------------------ */

export type EquipoGrupo = {
  /** `ID_EQUIPO` de la hoja, o `castilla` para nosotros. */
  clave: string;
  /** Cómo se enseña: el nombre de la hoja. */
  muestra: string;
  /** Todas las formas conocidas (hoja, BeSoccer). */
  nombres: string[];
};

export const CLAVE_CASTILLA = "castilla";

/*
| Lo que lleva cualquier club y no dice cuál es. «madrid» NO está: en nuestro
| grupo sólo lo lleva el Castilla (el Atlético es «Madrileño»).
*/
const RUIDO = new Set([
  "real", "club", "cf", "fc", "cd", "ud", "sd", "ad", "ce", "ue", "cp", "rc", "rcd", "sad", "cyd", "ca",
  "de", "del", "la", "el", "los", "las", "b", "ii", "atl", "at", "r", "rm", "deportivo", "deportiva",
  "futbol", "union", "sociedad", "sporting", "juventud", "rayo", "atletico",
]);

/*
| Las formas que no comparten ninguna palabra con el nombre de la hoja. Va a
| la palabra propia del equipo: «nastic» → «gimnastic».
*/
const ALIAS: Record<string, string> = {
  nastic: "gimnastic",
};

/*
| Nombres enteros que dirían otro equipo por sus palabras: «Atlético de Madrid
| B» lleva «madrid», que en el grupo es la palabra del Castilla. Es el mismo
| club que «Atlético Madrileño» (`MISMO_CLUB` de `mismoClub.ts`).
*/
const FRASES: [RegExp, string][] = [[/^(atletico|atl|at)( de)? madrid b$/, "atletico madrileno"]];

const palabras = (nombre: string) =>
  FRASES.reduce((n, [re, por]) => n.replace(re, por), desnuda(nombre))
    .split(" ")
    .map((p) => ALIAS[p] ?? p)
    .filter((p) => p.length >= 3 && !RUIDO.has(p) && !/^\d+$/.test(p));

/** Los veinte del grupo: los diecinueve del informe y nosotros. */
export function equiposDelGrupo(doc: InformeDoc | null): EquipoGrupo[] {
  const rivales = Object.values(doc?.porId ?? {}).map((e: InformeEquipo) => ({
    clave: e.id,
    muestra: e.nombre,
    nombres: [e.nombre, e.nombreLargo].filter(Boolean),
  }));

  if (!rivales.length) return [];

  return [...rivales, { clave: CLAVE_CASTILLA, muestra: "RM Castilla", nombres: ["Real Madrid Castilla", "RM Castilla"] }];
}

export type Reconocedor = (nombre: string) => string | null;

/**
 * Quién es «R. Majadahonda» dentro del grupo. Cuenta las palabras del nombre
 * que sólo tiene un equipo; gana el que más tenga y, si empatan dos, no gana
 * ninguno (mejor no enseñar un vídeo que enseñar el de otro).
 */
export function reconocedor(equipos: EquipoGrupo[]): Reconocedor {
  const deQuien = new Map<string, Set<string>>();

  for (const e of equipos) {
    for (const nombre of e.nombres) {
      for (const p of palabras(nombre)) {
        const set = deQuien.get(p) ?? new Set<string>();

        set.add(e.clave);
        deQuien.set(p, set);
      }
    }
  }

  const propias = new Map<string, string>();

  for (const [p, claves] of deQuien) if (claves.size === 1) propias.set(p, [...claves][0]);

  const cache = new Map<string, string | null>();

  return (nombre: string) => {
    const guardado = cache.get(nombre);

    if (guardado !== undefined) return guardado;

    const votos = new Map<string, number>();

    for (const p of new Set(palabras(nombre))) {
      const clave = propias.get(p);

      if (clave) votos.set(clave, (votos.get(clave) ?? 0) + 1);
    }

    const orden = [...votos.entries()].sort((a, b) => b[1] - a[1]);

    const elegido = orden.length && (orden.length === 1 || orden[0][1] > orden[1][1]) ? orden[0][0] : null;

    cache.set(nombre, elegido);

    return elegido;
  };
}

/* ------------------------------------------------------------------ */
/*  LOS DE UN EQUIPO                                                   */
/* ------------------------------------------------------------------ */

export type ResumenDelEquipo = {
  id: string;
  jornada: number;
  /** Del equipo mirado: jugó en casa. */
  enCasa: boolean;
  /** Clave y nombre del otro. */
  rival: { clave: string; nombre: string };
  /** El marcador, local primero: el de BeSoccer si está el partido; si no, el del título. */
  golesLocal: number;
  golesVisitante: number;
  /** Del equipo mirado. */
  resultado: "G" | "E" | "P";
  /** ISO, de BeSoccer; vacío si no se encontró el partido. */
  fecha: string;
  segundos: number;
};

/** Lo que se usa de un partido del informe de BeSoccer (`Partido`). */
type PartidoBeSoccer = {
  fecha: string;
  competicion?: string;
  jugado?: boolean;
  local: { nombre: string; goles?: number | null };
  visitante: { nombre: string; goles?: number | null };
};

/**
 * Los resúmenes de los partidos de un equipo del grupo, del más reciente al
 * más antiguo. Si un partido sale dos veces (vuelto a subir), cuenta el
 * primero que da el canal, que es el más nuevo.
 *
 * @param partidos los del informe de BeSoccer del equipo, para la fecha.
 */
export function resumenesDe(
  videos: ResumenRfef[],
  clave: string,
  equipos: EquipoGrupo[],
  partidos: PartidoBeSoccer[] = [],
): ResumenDelEquipo[] {
  const quien = reconocedor(equipos);

  const nombreDe = new Map(equipos.map((e) => [e.clave, e.muestra]));

  /*
  | El partido de liga de cada cruce (local, visitante): en una liga a doble
  | vuelta no se repite. Sólo liga: una Copa Federación entre dos del grupo
  | se llevaría la fecha.
  */
  const deLiga = new Map<string, PartidoBeSoccer>();

  for (const p of partidos) {
    if (!/^primera federaci/i.test(desnuda(p.competicion ?? ""))) continue;

    const l = quien(p.local.nombre);
    const v = quien(p.visitante.nombre);

    if (l && v && !deLiga.has(`${l}>${v}`)) deLiga.set(`${l}>${v}`, p);
  }

  const vistos = new Set<string>();

  const salida: ResumenDelEquipo[] = [];

  for (const video of videos) {
    const l = quien(video.local);
    const v = quien(video.visitante);

    if (!l || !v || l === v || (l !== clave && v !== clave)) continue;

    const cruce = `${l}>${v}`;

    if (vistos.has(cruce)) continue;

    vistos.add(cruce);

    const partido = deLiga.get(cruce);

    /*
    | El marcador, el de BeSoccer si está: es el que dan la tira de jornadas y
    | «Cómo llega» en la misma pantalla. El título lo escribe una persona y
    | alguna vez no cuadra (el UD Ibiza-Castilla de la J7 dice 0-1; BeSoccer,
    | 1-1 con un gol en propia).
    */
    const golesLocal = partido?.jugado && partido.local.goles !== null && partido.local.goles !== undefined ? partido.local.goles : video.golesLocal;
    const golesVisitante =
      partido?.jugado && partido.visitante.goles !== null && partido.visitante.goles !== undefined ? partido.visitante.goles : video.golesVisitante;

    const enCasa = l === clave;
    const suyos = enCasa ? golesLocal : golesVisitante;
    const otros = enCasa ? golesVisitante : golesLocal;
    const otro = enCasa ? v : l;

    salida.push({
      id: video.id,
      jornada: video.jornada || Number(/jornada\s*(\d+)/i.exec(partido?.competicion ?? "")?.[1] ?? 0),
      enCasa,
      rival: { clave: otro, nombre: nombreDe.get(otro) ?? (enCasa ? video.visitante : video.local) },
      golesLocal,
      golesVisitante,
      resultado: suyos > otros ? "G" : suyos < otros ? "P" : "E",
      fecha: partido?.fecha ?? "",
      segundos: video.segundos,
    });
  }

  /*
  | Con fecha manda la fecha (un aplazado se juega después de su jornada); sin
  | ella, la jornada del título.
  */
  return salida.sort((a, b) =>
    a.fecha && b.fecha ? b.fecha.localeCompare(a.fecha) : b.jornada - a.jornada || b.fecha.localeCompare(a.fecha),
  );
}
