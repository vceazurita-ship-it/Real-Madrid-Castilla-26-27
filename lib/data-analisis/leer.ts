import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import { unzipSync, strFromU8 } from "fflate";

import { leeEventosOpta, type PartidoEventos } from "./eventos";

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

export type HistoricoOpta = {
  /** "TOTAL", "Home", "Away". */
  ambito: string;
  datos: Record<string, number | string>;
};

export type Dataset = {
  partidos: FilaPartido[];
  equipos: string[];
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

    salida.push({ ambito: ambito === "TRUE" ? "TOTAL" : ambito, datos });
  }

  return salida;
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

  try {
    const ficheros = await readdir(path.join(CARPETA, "wys"));

    for (const nombre of ficheros) {
      if (!nombre.toLowerCase().endsWith(".xlsx")) {
        fuentes.ignorados.push(`wys/${nombre}`);

        continue;
      }

      try {
        const bytes = await readFile(path.join(CARPETA, "wys", nombre));

        const filas = partidosDeXlsx(bytes);

        if (filas.length === 0) {
          fuentes.ignorados.push(`wys/${nombre} (sin partidos)`);

          continue;
        }

        fuentes.wyscout.push(nombre);

        for (const fila of filas) {
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

        const partido = leeEventosOpta(JSON.parse(crudo));

        if (!partido) continue;

        const llave = `${partido.fecha}|${partido.equipo}|${partido.rival}`;

        if (vistos.has(llave)) continue;

        vistos.add(llave);

        eventos.push(partido);

        fuentes.opta.push(nombre);
      } catch {
        fuentes.ignorados.push(`opta/${nombre} (no es un log legible)`);
      }
    }

    /*
    | Del histórico interesa el fichero **más completo**: son descargas
    | repetidas del mismo informe y la que más columnas trae es la buena.
    */
    let mejor: { nombre: string; filas: HistoricoOpta[] } | null = null;

    for (const nombre of ficheros) {
      if (!/^summary.*\.csv$/i.test(nombre)) {
        if (!/\.(csv|json)$/i.test(nombre)) fuentes.ignorados.push(`opta/${nombre}`);

        continue;
      }

      try {
        const filas = historicoDeCsv(
          await readFile(path.join(CARPETA, "opta", nombre), "utf8"),
        );

        const columnas = Object.keys(filas[0]?.datos ?? {}).length;

        if (
          filas.length > 0 &&
          (!mejor || columnas > Object.keys(mejor.filas[0]?.datos ?? {}).length)
        ) {
          mejor = { nombre, filas };
        }
      } catch (error) {
        console.error("[data-analisis] opta", nombre, error);
      }
    }

    if (mejor) {
      fuentes.opta.push(mejor.nombre);

      historico.push(...mejor.filas);
    }
  } catch {
    /* sin carpeta de Opta */
  }

  const equipos = [...new Set(partidos.map((fila) => fila.equipo))].sort((a, b) =>
    a.localeCompare(b, "es"),
  );

  return { partidos, equipos, historico, eventos, fuentes };
}
