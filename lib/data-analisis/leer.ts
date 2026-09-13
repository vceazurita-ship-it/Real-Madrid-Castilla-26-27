import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import { unzipSync, strFromU8 } from "fflate";

import { leeEventosOpta, type PartidoEventos } from "./eventos";
import { METRICAS_JUGADOR } from "./individual";

/**
 * Leer la carpeta `public/data`: lo que sueltan Wyscout y Opta cada semana.
 *
 * La carpeta la alimenta el cuerpo técnico a mano —descarga un informe, lo deja
 * ahí— así que esto tiene que aguantar lo que salga de un navegador de verdad:
 *
 * - **Nombres repetidos.** `Team Stats Teruel.xlsx` y `Team Stats Teruel (1).xlsx`
 *   son la misma descarga dos veces, y `(1)` no siempre es la buena. Se leen
 *   todas y se quedan **los partidos**, no los ficheros: dos filas del mismo
 *   equipo en el mismo partido son la misma fila, venga de donde venga.
 * - **Ficheros que no sirven.** Un `export (3).json` de dos bytes, un PDF de
 *   tres megas: se saltan sin ruido en vez de tirar la pantalla.
 * - **Cada equipo se ve dos veces.** El fichero del Teruel trae las filas del
 *   Teruel *y* las de su rival en cada partido, así que con los diecinueve
 *   ficheros la liga sale cubierta por partida doble. Eso es una ventaja: se
 *   usa para rellenar a un equipo del que todavía no se ha bajado su fichero.
 *
 * Aquí no se interpreta nada: se devuelve la tabla en crudo, con sus nombres
 * de columna originales. Lo que significa cada cifra vive en `metricas.ts`.
 */

/* ------------------------------------------------------------------ */
/*  XLSX                                                               */
/* ------------------------------------------------------------------ */

const DESESCAPES: [RegExp, string][] = [
  [/&amp;/g, "&"],
  [/&lt;/g, "<"],
  [/&gt;/g, ">"],
  [/&quot;/g, '"'],
  [/&#39;/g, "'"],
];

function desescapa(texto: string) {
  return DESESCAPES.reduce((acc, [de, a]) => acc.replace(de, a), texto);
}

/** "AB12" → "AB". La columna es la parte de letras de la referencia. */
const columnaDe = (ref: string) => ref.replace(/\d+/g, "");

/**
 * Las celdas de una hoja, por referencia de columna.
 *
 * Se lee el XML a mano en vez de traer una librería de hojas de cálculo: lo que
 * baja Wyscout es siempre la misma forma —una hoja, sin fórmulas, sin fechas
 * serializadas— y `fflate` ya está en el proyecto. Una dependencia menos que
 * mantener para leer cuatro etiquetas.
 */
function hojaDeXlsx(bytes: Buffer): Record<string, string>[] {
  const zip = unzipSync(new Uint8Array(bytes));

  const compartidas: string[] = [];

  const sst = zip["xl/sharedStrings.xml"];

  if (sst) {
    for (const trozo of strFromU8(sst).split("<si>").slice(1)) {
      compartidas.push(
        desescapa(
          [...trozo.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)]
            .map((m) => m[1])
            .join(""),
        ),
      );
    }
  }

  const hoja = Object.keys(zip).find((nombre) =>
    /^xl\/worksheets\/sheet\d+\.xml$/.test(nombre),
  );

  if (!hoja) return [];

  const xml = strFromU8(zip[hoja]);

  return xml
    .split("<row ")
    .slice(1)
    .map((fila) => {
      const celdas: Record<string, string> = {};

      for (const m of fila.matchAll(/<c r="([A-Z]+\d+)"([^>]*)>([\s\S]*?)<\/c>/g)) {
        const atributos = m[2];
        const cuerpo = m[3];

        const valor = /<v>([\s\S]*?)<\/v>/.exec(cuerpo)?.[1];
        const enLinea = /<is>[\s\S]*?<t[^>]*>([\s\S]*?)<\/t>/.exec(cuerpo)?.[1];

        let texto = enLinea ?? valor ?? "";

        /* `t="s"` es un índice a la tabla de cadenas compartidas. */
        if (/t="s"/.test(atributos) && valor !== undefined) {
          texto = compartidas[Number(valor)] ?? "";
        }

        celdas[columnaDe(m[1])] = desescapa(texto);
      }

      return celdas;
    });
}

/* ------------------------------------------------------------------ */
/*  LA CABECERA DE WYSCOUT                                             */
/* ------------------------------------------------------------------ */

/**
 * Wyscout parte un dato en varias columnas y sólo rotula la primera.
 *
 * «Tiros / a la portería» ocupa tres columnas: total, a portería y porcentaje,
 * pero el rótulo está sólo en la primera y las otras dos vienen en blanco. Y
 * las de porcentaje no llevan ni barra. Así que el nombre de cada columna se
 * arma arrastrando el último rótulo visto y numerando las partes:
 *
 *     I → "Tiros"           (la primera parte del rótulo)
 *     J → "a la portería"   (la segunda)
 *     K → "Tiros %"         (lo que sobra es el porcentaje)
 */
function nombresDeColumna(cabecera: Record<string, string>, columnas: string[]) {
  const nombres: Record<string, string> = {};

  let base = "";
  let partes: string[] = [];
  let parte = 0;

  for (const col of columnas) {
    const texto = (cabecera[col] ?? "").trim();

    if (texto) {
      /*
      | Dos formas de partir el rótulo, y las dos aparecen:
      |   «Tiros / a la portería»                        → base y sus partes
      |   «Entradas al área (carreras / pases cruzados)» → base fuera, partes
      |                                                    dentro del paréntesis
      | Sin el segundo caso salía una columna llamada «Entradas al área
      | (carreras», con el paréntesis abierto y todo.
      */
      const conParentesis = /^(.+?)\s*\((.+)\)\s*$/.exec(texto);

      if (conParentesis) {
        base = conParentesis[1].trim();
        partes = conParentesis[2].split("/").map((t) => t.trim());
      } else {
        partes = texto.split("/").map((t) => t.trim());
        base = partes[0];
      }

      parte = 0;
    } else {
      parte += 1;
    }

    if (!base) continue;

    if (parte < partes.length) {
      /* Si la primera parte **es** la base, la columna se llama como la base. */
      nombres[col] =
        parte === 0 && partes[0] === base ? base : `${base} · ${partes[parte]}`;
    } else {
      /* Lo que viene después de las partes rotuladas es el porcentaje. */
      nombres[col] = `${base} %`;
    }
  }

  return nombres;
}

/* ------------------------------------------------------------------ */
/*  LO QUE SE DEVUELVE                                                 */
/* ------------------------------------------------------------------ */

/** Una fila: lo que hizo un equipo en un partido. */
export type FilaPartido = {
  /** `2026-09-06`. */
  fecha: string;
  /** "Real Murcia - Teruel 4:0", tal y como lo escribe Wyscout. */
  partido: string;
  competicion: string;
  /** Minutos de juego que cuenta el informe. */
  duracion: number;
  equipo: string;
  /** El otro equipo de ese mismo partido. */
  rival: string;
  /** "4-2-3-1 (100.0%)" → el esquema más usado. */
  esquema: string;
  /** Goles a favor y en contra, sacados del marcador del rótulo. */
  golesFavor: number;
  golesContra: number;
  /** Todas las columnas numéricas, por su nombre ya armado. */
  datos: Record<string, number>;
};

/**
 * Una fila del «Search results» de Wyscout: **un jugador**, no un partido.
 *
 * Es otra descarga distinta —la de búsqueda de jugadores— y trae ciento quince
 * columnas por cabeza, con todo ya por noventa minutos. Los rótulos vienen
 * planos, uno por columna, sin el juego de columnas mudas de los «Team Stats»:
 * aquí no hace falta arrastrar nada.
 */
export type FilaJugador = {
  jugador: string;
  equipo: string;
  /**
   * De qué temporada es la fila.
   *
   * Wyscout no la escribe en ninguna columna, así que se deduce de los
   * partidos jugados: en septiembre nadie lleva más de tres, y de la temporada
   * cerrada los que más juegan andan por los treinta y ocho. Ocho es un corte
   * que no se puede rozar por ninguno de los dos lados.
   */
  temporada: "actual" | "anterior";
  /** "LAMF, RAMF": Wyscout puede dar varias, la primera es la principal. */
  posicion: string;
  edad: number;
  partidos: number;
  minutos: number;
  pie: string;
  altura: number;
  peso: number;
  contrato: string;
  /** Todas las columnas numéricas, por su rótulo. */
  datos: Record<string, number>;
};

export type HistoricoOpta = {
  /** "TOTAL", "Home", "Away", o el nombre de la temporada. */
  ambito: string;
  /**
   * De quién es la fila.
   *
   * Esto costó entender la carpeta entera. Las descargas de Opta traen dos
   * cosas con la misma pinta: el agregado del **Castilla** —tres partidos, con
   * su `teamId`— y el agregado de **toda la categoría** —cien partidos, con
   * reparto de casa y fuera—. Se distinguen porque en el de la liga los
   * duelos dan exactamente 50,0 % y los goles a favor igualan a los goles en
   * contra: es la aritmética de sumar a los dos equipos de cada partido.
   */
  fuente: "liga" | "nuestro";
  datos: Record<string, number | string>;
};

export type Dataset = {
  partidos: FilaPartido[];
  equipos: string[];
  /** Los jugadores del «Search results» de Wyscout, uno por fila. */
  jugadores: FilaJugador[];
  /** El agregado histórico del Castilla que baja Opta. */
  historico: HistoricoOpta[];
  /** Los partidos de los que hay log evento a evento. */
  eventos: PartidoEventos[];
  /** Lo que se ha leído y lo que se ha saltado, para poder explicarlo. */
  fuentes: {
    wyscout: string[];
    opta: string[];
    ignorados: string[];
    leidoEn: string;
  };
};

/* ------------------------------------------------------------------ */
/*  NÚMEROS                                                            */
/* ------------------------------------------------------------------ */

/**
 * Un número de un informe, o `null`.
 *
 * Los porcentajes vienen como "45.7%", los huecos como "-" y algunas cifras
 * con coma decimal. Un `-` **no es cero**: es «no consta», y sumarlo como cero
 * hundiría cualquier media.
 */
export function aNumero(valor: unknown): number | null {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : null;

  const texto = String(valor ?? "").trim();

  if (!texto || texto === "-" || texto === "—") return null;

  const limpio = texto.replace(/%/g, "").replace(/\s/g, "").replace(",", ".");

  const n = Number(limpio);

  return Number.isFinite(n) ? n : null;
}

/** "Real Murcia - Teruel 4:0" → los dos equipos y el marcador. */
export function leeRotuloDePartido(rotulo: string) {
  const marcador = /(\d+)\s*:\s*(\d+)\s*$/.exec(rotulo.trim());

  const sinMarcador = marcador
    ? rotulo.slice(0, marcador.index).trim()
    : rotulo.trim();

  /* El separador es " - " con espacios: hay clubes con guion en el nombre. */
  const corte = sinMarcador.split(" - ");

  return {
    local: (corte[0] ?? "").trim(),
    visitante: (corte.slice(1).join(" - ") ?? "").trim(),
    golesLocal: marcador ? Number(marcador[1]) : null,
    golesVisitante: marcador ? Number(marcador[2]) : null,
  };
}

/* ------------------------------------------------------------------ */
/*  WYSCOUT                                                            */
/* ------------------------------------------------------------------ */

const COLUMNAS_FIJAS = new Set(["A", "B", "C", "D", "E", "F"]);

function partidosDeXlsx(bytes: Buffer): FilaPartido[] {
  const filas = hojaDeXlsx(bytes);

  if (filas.length < 4) return [];

  const columnas = [
    ...new Set(filas.flatMap((fila) => Object.keys(fila))),
  ].sort((a, b) => (a.length - b.length) || a.localeCompare(b));

  const nombres = nombresDeColumna(filas[0], columnas);

  /* Las tres primeras filas son cabecera y leyenda; los datos empiezan luego. */
  return filas
    .slice(1)
    .filter((fila) => /^\d{4}-\d{2}-\d{2}/.test((fila.A ?? "").trim()))
    .map((fila) => {
      const rotulo = (fila.B ?? "").trim();

      const { local, visitante, golesLocal, golesVisitante } =
        leeRotuloDePartido(rotulo);

      const equipo = (fila.E ?? "").trim();

      /* El rótulo recorta los nombres largos ("Real Madrid Castill"), así que
         se empareja por principio de cadena en los dos sentidos. */
      const esLocal =
        local.startsWith(equipo.slice(0, 12)) ||
        equipo.startsWith(local.slice(0, 12));

      const datos: Record<string, number> = {};

      for (const col of columnas) {
        if (COLUMNAS_FIJAS.has(col)) continue;

        const nombre = nombres[col];

        if (!nombre) continue;

        const n = aNumero(fila[col]);

        if (n !== null) datos[nombre] = n;
      }

      return {
        fecha: (fila.A ?? "").trim().slice(0, 10),
        partido: rotulo,
        competicion: (fila.C ?? "").trim(),
        duracion: aNumero(fila.D) ?? 0,
        equipo,
        rival: esLocal ? visitante : local,
        esquema: (fila.F ?? "").trim(),
        golesFavor: (esLocal ? golesLocal : golesVisitante) ?? 0,
        golesContra: (esLocal ? golesVisitante : golesLocal) ?? 0,
        datos,
      };
    })
    .filter((fila) => fila.equipo && fila.fecha);
}

/**
 * Los amistosos no son la liga, y se cuelan.
 *
 * Wyscout devuelve todo lo que jugó un equipo, no sólo la competición que se
 * estaba buscando, y en la descarga del Zaragoza venía un `Real Zaragoza -
 * Athletic Club 3:1` de agosto marcado como **World. Club Friendlies**. Esa
 * sola fila metía al **Athletic Club como vigésimo primer equipo del grupo**
 —cuando no está en el grupo— y además contaba un amistoso dentro de la media
 * de liga del Zaragoza.
 *
 * Se corta aquí, al leer, y no en cada pantalla: si se filtrara al pintar,
 * cada gráfico nuevo tendría que acordarse de hacerlo.
 *
 * Ojo con no pasarse: el **Athletic Bilbao** de 2025/26 sí es un rival de
 * verdad —es el filial, y jugó en Primera Federación—. Lo que se quita es la
 * competición, no el nombre.
 */
const esAmistoso = (competicion: string) =>
  /friendl|amistos/i.test(competicion);

/* ------------------------------------------------------------------ */
/*  EL «SEARCH RESULTS»: UN JUGADOR POR FILA                           */
/* ------------------------------------------------------------------ */

/** Las columnas que no son una métrica sino la ficha del jugador. */
const FICHA = new Set(["A", "B", "C", "D", "E", "F", "G", "P", "Q", "R", "S", "T", "U"]);

/**
 * De las ciento quince columnas sólo se guardan las que la pantalla usa.
 *
 * Con la plantilla sola daba igual; con los mil ochocientos jugadores de las
 * dos temporadas, guardarlas todas engordaba el índice que se sube al
 * alojamiento de 1,5 a 6,3 MB, y eso se descarga entero en el móvil de la
 * banda antes de pintar nada.
 *
 * La lista sale del catálogo de métricas —`METRICAS_JUGADOR`— más las cuatro
 * que enseña la ficha de arriba. Si mañana se añade una métrica al catálogo,
 * entra sola.
 */
const COLUMNAS_UTILES = new Set<string>([
  ...METRICAS_JUGADOR.map((m) => m.columna),
  "Partidos jugados",
  "Minutos jugados",
  "Goles",
  "xG",
  "Asistencias",
  "xA",
  "Duelos/90",
  "Duelos ganados, %",
]);

/**
 * Lee la descarga de búsqueda de jugadores de Wyscout.
 *
 * Es **otra descarga distinta** de los «Team Stats»: allí cada fila es un
 * equipo en un partido y aquí cada fila es un jugador con su temporada entera.
 * Y se lee más fácil, porque los rótulos vienen uno por columna y planos —sin
 * el juego de columnas mudas que obliga a arrastrar el rótulo en los otros—.
 *
 * Se distingue del resto por la cabecera: si la primera celda dice «Jugador»,
 * es esto. Cualquier otro `.xlsx` de la carpeta sigue su camino de siempre.
 */
function jugadoresDeXlsx(bytes: Buffer): FilaJugador[] {
  const filas = hojaDeXlsx(bytes);

  if (filas.length < 2) return [];

  const cabecera = filas[0];

  if (!/^jugador$/i.test((cabecera.A ?? "").trim())) return [];

  const columnas = [...new Set(filas.flatMap((fila) => Object.keys(fila)))].sort(
    (a, b) => a.length - b.length || a.localeCompare(b),
  );

  /*
  | De qué temporada es este fichero.
  |
  | Se mira **el fichero entero**, no fila a fila: dentro de una descarga
  | todos los jugadores son del mismo periodo, y el que más ha jugado lo dice
  | sin ambigüedad. Fila a fila fallaría con el suplente que sólo ha jugado
  | dos partidos en una temporada cerrada.
  */
  const partidosMaximos = filas
    .slice(1)
    .reduce((tope, fila) => Math.max(tope, aNumero(fila.H) ?? 0), 0);

  const temporada: "actual" | "anterior" =
    partidosMaximos <= 8 ? "actual" : "anterior";

  return filas
    .slice(1)
    .map((fila) => {
      const datos: Record<string, number> = {};

      for (const col of columnas) {
        if (FICHA.has(col)) continue;

        const nombre = (cabecera[col] ?? "").trim();

        if (!nombre || !COLUMNAS_UTILES.has(nombre)) continue;

        const n = aNumero(fila[col]);

        if (n !== null) datos[nombre] = n;
      }

      return {
        temporada,
        jugador: (fila.A ?? "").trim(),
        equipo: (fila.C ?? fila.B ?? "").trim(),
        posicion: (fila.D ?? "").trim(),
        edad: aNumero(fila.E) ?? 0,
        partidos: aNumero(fila.H) ?? 0,
        minutos: aNumero(fila.I) ?? 0,
        pie: (fila.R ?? "").trim(),
        altura: aNumero(fila.S) ?? 0,
        peso: aNumero(fila.T) ?? 0,
        contrato: (fila.G ?? "").trim(),
        datos,
      };
    })
    .filter((fila) => fila.jugador);
}

/* ------------------------------------------------------------------ */
/*  OPTA                                                               */
/* ------------------------------------------------------------------ */

/**
 * Los CSV de Opta vienen con la cabecera entera **entrecomillada**.
 *
 * La primera línea es un solo campo con todos los nombres dentro, y las de
 * datos van sueltas. Y el fichero repite cabecera antes de cada bloque de
 * splits. Se parte a lo bruto por comas porque ninguno de esos nombres lleva
 * una dentro.
 */
function historicoDeCsv(texto: string): HistoricoOpta[] {
  const lineas = texto
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .filter((linea) => linea.trim());

  if (lineas.length < 2) return [];

  const nombres = lineas[0].replace(/^"|"$/g, "").split(",");

  const salida: HistoricoOpta[] = [];

  for (const linea of lineas.slice(1)) {
    const valores = linea.replace(/^"|"$/g, "").split(",");

    /* Las cabeceras repetidas se saltan. */
    if (valores[0] === nombres[0]) continue;

    const datos: Record<string, number | string> = {};

    nombres.forEach((nombre, i) => {
      const bruto = valores[i];

      if (bruto === undefined || bruto === "") return;

      /* Los nombres repetidos (Opta trae varios «GoalCrnrs») no se pisan: se
         queda el primero, que es el del bloque principal. */
      if (nombre in datos) return;

      const n = aNumero(bruto);

      datos[nombre] = n === null ? bruto : n;
    });

    const ambito = String(valores[2] || valores[0] || "TOTAL").trim();

    salida.push({
      ambito: ambito === "TRUE" ? "TOTAL" : ambito,
      /* Lo pone quien llama, que es quien ha visto el fichero entero. */
      fuente: "liga",
      datos,
    });
  }

  return salida;
}

/**
 * ¿De quién es este agregado, del Castilla o de la categoría entera?
 *
 * La señal es doble y no falla: el de la liga trae **reparto de casa y fuera**
 * y, al sumar a los dos equipos de cada partido, deja los duelos en un 50,0 %
 * clavado y los goles a favor iguales a los goles en contra. El del Castilla
 * viene partido por temporada y con su `teamId`.
 */
function deQuienEs(filas: HistoricoOpta[]): "liga" | "nuestro" {
  const hayCasaFuera =
    filas.some((f) => f.ambito === "Home") && filas.some((f) => f.ambito === "Away");

  if (hayCasaFuera) return "liga";

  const total = filas.find((f) => f.ambito === "TOTAL") ?? filas[0];

  const gf = total?.datos["GF"] ?? total?.datos["Goal"];
  const ga = total?.datos["GA"] ?? total?.datos["Goles Contra"];

  if (typeof gf === "number" && typeof ga === "number" && gf === ga && gf > 0) {
    return "liga";
  }

  return "nuestro";
}

/* ------------------------------------------------------------------ */
/*  LA CARPETA ENTERA                                                  */
/* ------------------------------------------------------------------ */

const CARPETA = path.join(process.cwd(), "public", "data");

/** La llave de un partido: mismo equipo, misma fecha, mismo rival. */
const llaveDe = (fila: FilaPartido) =>
  `${fila.fecha}|${fila.equipo.toLowerCase()}|${fila.rival.toLowerCase()}`;

export async function leeDatos(): Promise<Dataset> {
  const fuentes: Dataset["fuentes"] = {
    wyscout: [],
    opta: [],
    ignorados: [],
    leidoEn: new Date().toISOString(),
  };

  /* --------------------------- WYSCOUT --------------------------- */

  const porLlave = new Map<string, FilaPartido>();

  const porJugador = new Map<string, FilaJugador>();

  /* Los partidos que se han dejado fuera por no ser de competición. */
  const amistosos = new Set<string>();

  try {
    const ficheros = await readdir(path.join(CARPETA, "wys"));

    for (const nombre of ficheros) {
      if (!nombre.toLowerCase().endsWith(".xlsx")) {
        fuentes.ignorados.push(`wys/${nombre}`);

        continue;
      }

      try {
        const bytes = await readFile(path.join(CARPETA, "wys", nombre));

        /* El «Search results» va por jugadores, no por partidos. */
        const deJugadores = jugadoresDeXlsx(bytes);

        if (deJugadores.length > 0) {
          for (const jugador of deJugadores) {
            const llave = `${jugador.temporada}|${jugador.jugador.toLowerCase()}|${jugador.equipo.toLowerCase()}`;

            const previo = porJugador.get(llave);

            /*
            | Con el mismo jugador en dos descargas manda **la más reciente**,
            | y lo más reciente se reconoce por los minutos: nadie juega menos
            | según pasa la temporada. `Search results.xlsx` traía a Rivas con
            | 202 minutos y `Search results (2).xlsx` con 287, y quedarse con
            | el primero que apareciera en la carpeta dejaba la ficha atrasada
            | una jornada entera. A igualdad de minutos gana el que traiga más
            | columnas, que es la descarga más completa.
            */
            const mejor =
              !previo ||
              jugador.minutos > previo.minutos ||
              (jugador.minutos === previo.minutos &&
                Object.keys(jugador.datos).length >
                  Object.keys(previo.datos).length);

            if (mejor) porJugador.set(llave, jugador);
          }

          fuentes.wyscout.push(nombre);

          continue;
        }

        const filas = partidosDeXlsx(bytes);

        if (filas.length === 0) {
          fuentes.ignorados.push(`wys/${nombre} (sin partidos)`);

          continue;
        }

        fuentes.wyscout.push(nombre);

        for (const fila of filas) {
          /* Un amistoso no es la liga: ni entra en la tabla ni suma equipos. */
          if (esAmistoso(fila.competicion)) {
            amistosos.add(`${fila.fecha} ${fila.partido} (${fila.competicion})`);

            continue;
          }

          const llave = llaveDe(fila);

          const previa = porLlave.get(llave);

          /* Ante dos versiones del mismo partido manda la que trae más
             columnas: una descarga a medias no puede borrar a la completa. */
          if (
            !previa ||
            Object.keys(fila.datos).length > Object.keys(previa.datos).length
          ) {
            porLlave.set(llave, fila);
          }
        }
      } catch (error) {
        console.error("[data-analisis] wys", nombre, error);

        fuentes.ignorados.push(`wys/${nombre} (no se ha podido leer)`);
      }
    }
  } catch {
    /* Sin carpeta no hay datos, pero la pantalla lo explica. */
  }

  for (const suelto of amistosos) {
    fuentes.ignorados.push(`amistoso fuera de la liga: ${suelto}`);
  }

  const partidos = [...porLlave.values()].sort(
    (a, b) => b.fecha.localeCompare(a.fecha) || a.equipo.localeCompare(b.equipo),
  );

  /* ---------------------------- OPTA ----------------------------- */

  const historico: HistoricoOpta[] = [];
  const eventos: PartidoEventos[] = [];

  try {
    const ficheros = await readdir(path.join(CARPETA, "opta"));

    /*
    | Los logs evento a evento. Se leen todos los `.json` y se quedan los
    | partidos distintos: `export.json` y `export (1).json` suelen ser la misma
    | descarga, y `export (3).json` son dos bytes.
    */
    const vistos = new Set<string>();

    for (const nombre of ficheros) {
      if (!nombre.toLowerCase().endsWith(".json")) continue;

      try {
        const crudo = await readFile(path.join(CARPETA, "opta", nombre), "utf8");

        if (crudo.trim().length < 10) continue;

        const delFichero = leeEventosOpta(JSON.parse(crudo));

        if (delFichero.length === 0) continue;

        let aportados = 0;

        for (const partido of delFichero) {
          const llave = `${partido.fecha}|${partido.equipo}|${partido.rival}`;

          if (vistos.has(llave)) continue;

          vistos.add(llave);

          eventos.push(partido);

          aportados += 1;
        }

        /* Si todos sus partidos ya estaban, el fichero es un duplicado. */
        if (aportados > 0) fuentes.opta.push(nombre);
      } catch {
        fuentes.ignorados.push(`opta/${nombre} (no es un log legible)`);
      }
    }

    /*
    | LOS AGREGADOS
    |
    | Antes aquí sólo se miraban los `Summary*.csv` y se quedaba el que más
    | columnas traía. Eso dejaba fuera la mitad de la carpeta y, peor, tomaba
    | por nuestro lo que era de toda la categoría: los `Summary` de cien
    | partidos son **la liga entera**, no el Castilla —los duelos dan 50,0 %
    | clavado y los goles a favor igualan a los de contra—. El agregado del
    | Castilla está en otro fichero, con sus tres partidos y sus mismas ciento
    | veinticinco columnas.
    |
    | Así que se abren todos los CSV, se clasifica cada uno y de cada lado se
    | guarda el más completo. Con los dos se puede hacer lo que antes no:
    | comparar al Castilla con la media de la categoría en las columnas que
    | Wyscout no tiene.
    */
    const mejor: Partial<
      Record<"liga" | "nuestro", { nombre: string; filas: HistoricoOpta[] }>
    > = {};

    for (const nombre of ficheros) {
      if (!/\.csv$/i.test(nombre)) {
        if (!/\.json$/i.test(nombre)) fuentes.ignorados.push(`opta/${nombre}`);

        continue;
      }

      /* Los logs evento a evento ya se han leído arriba. El que acaba en «_»
         no es un log: es el agregado defensivo del Castilla, con el mismo
         juego de columnas que el de la liga. */
      if (/event log/i.test(nombre) && !/_\.csv$/i.test(nombre)) continue;

      try {
        const filas = historicoDeCsv(
          await readFile(path.join(CARPETA, "opta", nombre), "utf8"),
        );

        if (filas.length === 0) continue;

        const dueno = deQuienEs(filas);

        for (const fila of filas) fila.fuente = dueno;

        const columnas = Object.keys(filas[0]?.datos ?? {}).length;

        const anterior = mejor[dueno];

        if (
          !anterior ||
          columnas > Object.keys(anterior.filas[0]?.datos ?? {}).length
        ) {
          mejor[dueno] = { nombre, filas };
        }
      } catch (error) {
        console.error("[data-analisis] opta", nombre, error);
      }
    }

    for (const lado of ["liga", "nuestro"] as const) {
      const elegido = mejor[lado];

      if (!elegido) continue;

      fuentes.opta.push(elegido.nombre);

      historico.push(...elegido.filas);
    }
  } catch {
    /* sin carpeta de Opta */
  }

  const equipos = [...new Set(partidos.map((fila) => fila.equipo))].sort((a, b) =>
    a.localeCompare(b, "es"),
  );

  /* Del más reciente al más viejo: la pantalla abre por el último partido. */
  eventos.sort((a, b) => b.fecha.localeCompare(a.fecha));

  const jugadores = [...porJugador.values()].sort(
    (a, b) =>
      a.temporada.localeCompare(b.temporada) ||
      b.minutos - a.minutos ||
      a.jugador.localeCompare(b.jugador, "es"),
  );

  return { partidos, equipos, jugadores, historico, eventos, fuentes };
}

/* ------------------------------------------------------------------ */
/*  EL ÍNDICE, MÁS LIGERO                                              */
/* ------------------------------------------------------------------ */

/**
 * El índice pesaba cuatro megas, y tres eran nombres de columna repetidos.
 *
 * Cada uno de los mil ochocientos jugadores llevaba dentro su propio
 * `{"Acciones defensivas realizadas/90": 8.1, …}` con los cincuenta rótulos
 * escritos enteros. En JSON eso son tres megas de texto que dicen lo mismo mil
 * ochocientas veces, y que se descargan en el móvil de la banda antes de
 * pintar nada.
 *
 * Así que al escribir el índice los rótulos se guardan **una sola vez** y cada
 * jugador lleva sólo sus números en el mismo orden. Al leerlo se deshace. La
 * pantalla no se entera: recibe el mismo `datos` de siempre.
 */
type JugadorCompacto = Omit<FilaJugador, "datos"> & { v: (number | null)[] };

export type DatasetCompacto = Omit<Dataset, "jugadores"> & {
  columnasJugador: string[];
  jugadores: JugadorCompacto[];
};

export function compactaIndice(datos: Dataset): DatasetCompacto {
  const columnas = [
    ...new Set(datos.jugadores.flatMap((j) => Object.keys(j.datos))),
  ].sort();

  return {
    ...datos,
    columnasJugador: columnas,
    jugadores: datos.jugadores.map(({ datos: suyos, ...resto }) => ({
      ...resto,
      v: columnas.map((c) => (c in suyos ? suyos[c] : null)),
    })),
  };
}

export function expandeIndice(crudo: DatasetCompacto | Dataset): Dataset {
  const columnas = (crudo as DatasetCompacto).columnasJugador;

  /* Un índice viejo, escrito antes de esto, se devuelve tal cual. */
  if (!Array.isArray(columnas)) return crudo as Dataset;

  return {
    ...(crudo as DatasetCompacto),
    jugadores: (crudo as DatasetCompacto).jugadores.map(({ v, ...resto }) => {
      const datos: Record<string, number> = {};

      columnas.forEach((nombre, i) => {
        const valor = v[i];

        if (valor !== null && valor !== undefined) datos[nombre] = valor;
      });

      return { ...resto, datos };
    }),
  };
}
