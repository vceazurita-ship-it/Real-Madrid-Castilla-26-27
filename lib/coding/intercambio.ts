/**
 * CODING · lo que entra y sale de otras herramientas.
 *
 * El trabajo de un analista no vive en una sola aplicación: el timeline llega
 * de Hudl SportsCode o de Nacsport, y lo codificado aquí se quiere abrir allí o
 * cruzar en una hoja de cálculo. Tres formatos, los de siempre:
 *
 * - **XML de SportsCode** (`<file><ALL_INSTANCES><instance>…`), que es también
 *   el que leen y escriben Nacsport, Metrica Play y LongoMatch. Cada instancia
 *   es un clip: `code` es el sujeto y cada `label` una etiqueta con su grupo.
 * - **CSV**, con punto y coma y coma decimal, que es lo que abre bien un Excel
 *   en castellano.
 *
 * Los tiempos del XML son los del CORTE (con su margen), en segundos: es lo
 * que SportsCode llama la instancia, con su «lead» y su «lag» ya dentro. Por
 * eso al importar se dejan los márgenes a cero —ya están puestos— y al
 * exportar se escriben `inicioMs`/`finMs`, no el momento marcado.
 */

import type {
  CategoriaCoding,
  ClipCoding,
  ComportamientoColectivo,
  BorradorClip,
  JugadorCoding,
} from "@/lib/coding/modelo";

/* ------------------------------------------------------------------ */
/*  SALIR                                                              */
/* ------------------------------------------------------------------ */

const escapaXml = (texto: string) =>
  texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** «#F87171» → los tres canales de 0 a 65535 que pide SportsCode. */
function canales(color: string) {
  const hex = /^#([0-9a-f]{6})$/i.exec(color)?.[1] ?? "C8A96B";

  return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) * 257);
}

/** El nombre con el que sale el sujeto: «9 MESTRE» o «Salida de balón». */
function codigoDe(clip: ClipCoding) {
  return typeof clip.jugadorDorsal === "number"
    ? `${clip.jugadorDorsal} ${clip.jugadorNombre}`
    : clip.jugadorNombre;
}

export function xmlDeClips(
  clips: ClipCoding[],
  categorias: CategoriaCoding[],
) {
  const nombreCategoria = (id: string) =>
    categorias.find((una) => una.id === id)?.nombre ?? "";

  const instancias = clips.map((clip, indice) => {
    const etiquetas = [
      nombreCategoria(clip.categoriaId)
        ? `      <label><group>Categoría</group><text>${escapaXml(nombreCategoria(clip.categoriaId))}</text></label>`
        : "",
      ...clip.tags
        .filter((tag) => tag.trim())
        .map(
          (tag) =>
            `      <label><group>Descriptor</group><text>${escapaXml(tag.trim())}</text></label>`,
        ),
      clip.nota.trim()
        ? `      <label><group>Nota</group><text>${escapaXml(clip.nota.trim())}</text></label>`
        : "",
    ].filter(Boolean);

    return [
      "    <instance>",
      `      <ID>${indice + 1}</ID>`,
      `      <start>${(clip.inicioMs / 1000).toFixed(2)}</start>`,
      `      <end>${(clip.finMs / 1000).toFixed(2)}</end>`,
      `      <code>${escapaXml(codigoDe(clip))}</code>`,
      ...etiquetas,
      "    </instance>",
    ].join("\n");
  });

  /* Una fila por sujeto, con el color de su primera categoría. */
  const filas = new Map<string, string>();

  for (const clip of clips) {
    const codigo = codigoDe(clip);

    if (filas.has(codigo)) continue;

    const color =
      categorias.find((una) => una.id === clip.categoriaId)?.color ?? "#C8A96B";

    const [r, g, b] = canales(color);

    filas.set(
      codigo,
      `    <row><code>${escapaXml(codigo)}</code><R>${r}</R><G>${g}</G><B>${b}</B></row>`,
    );
  }

  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    "<file>",
    "  <SORT_INFO><sort_type>sort order</sort_type></SORT_INFO>",
    "  <ALL_INSTANCES>",
    ...instancias,
    "  </ALL_INSTANCES>",
    "  <ROWS>",
    ...filas.values(),
    "  </ROWS>",
    "</file>",
    "",
  ].join("\n");
}

const segundosCsv = (ms: number) =>
  (ms / 1000).toLocaleString("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: false,
  });

const celda = (valor: string) =>
  /[";\n]/.test(valor) ? `"${valor.replace(/"/g, '""')}"` : valor;

export function csvDeClips(
  clips: ClipCoding[],
  categorias: CategoriaCoding[],
  videoDe: (clip: ClipCoding) => string,
) {
  const cabecera = [
    "Corte",
    "Vídeo",
    "Tipo",
    "Dorsal",
    "Sujeto",
    "Categoría",
    "Descriptores",
    "Marcado desde (s)",
    "Marcado hasta (s)",
    "Corte desde (s)",
    "Corte hasta (s)",
    "Duración (s)",
    "Estado",
    "Nota",
  ];

  const filas = clips.map((clip) =>
    [
      String(clip.numero).padStart(3, "0"),
      videoDe(clip),
      clip.sujeto === "colectivo" ? "Equipo" : "Jugador",
      typeof clip.jugadorDorsal === "number" ? String(clip.jugadorDorsal) : "",
      clip.jugadorNombre,
      categorias.find((una) => una.id === clip.categoriaId)?.nombre ?? "",
      clip.tags.join(", "),
      segundosCsv(clip.codingInicioMs),
      segundosCsv(clip.codingFinMs),
      segundosCsv(clip.inicioMs),
      segundosCsv(clip.finMs),
      segundosCsv(clip.finMs - clip.inicioMs),
      clip.estado === "revisar" ? "Por revisar" : "",
      clip.nota,
    ]
      .map(celda)
      .join(";"),
  );

  /* El BOM es lo que hace que Excel lea las tildes como tildes. */
  return `﻿${[cabecera.join(";"), ...filas].join("\r\n")}\r\n`;
}

/* ------------------------------------------------------------------ */
/*  ENTRAR                                                             */
/* ------------------------------------------------------------------ */

export type ClipImportado = {
  borrador: BorradorClip;
  tags: string[];
  nota: string;
};

export type Importacion = {
  clips: ClipImportado[];
  /** Instancias que no se han podido leer (sin tiempos, o al revés). */
  descartadas: number;
  /** Los sujetos que no estaban en la plantilla ni en lo colectivo. */
  sujetosNuevos: string[];
};

const normaliza = (texto: string) =>
  texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

/**
 * Lee un XML de SportsCode (o de Nacsport, que escribe el mismo).
 *
 * Cada instancia pasa a clip así:
 * - **Quién**: el `code`. Si es un jugador de la plantilla —por el nombre, con
 *   o sin el dorsal delante— o un comportamiento colectivo, se usa ése; si no,
 *   entra como sujeto de equipo con su propio nombre, para no perderlo.
 * - **Qué**: la primera etiqueta que se llame como una categoría. Si ninguna,
 *   el propio `code` si es una categoría (hay quien codifica por acciones).
 * - El resto de etiquetas, como descriptores; la del grupo «Nota», como nota.
 *
 * No lanza: lo que no se entiende se cuenta en `descartadas`.
 */
export function leeXmlSportscode(
  texto: string,
  contexto: {
    jugadores: JugadorCoding[];
    comportamientos: ComportamientoColectivo[];
    categorias: CategoriaCoding[];
  },
): Importacion {
  const documento = new DOMParser().parseFromString(texto, "application/xml");

  if (documento.getElementsByTagName("parsererror").length > 0) {
    throw new Error("El fichero no es un XML que se pueda leer.");
  }

  const instancias = [...documento.getElementsByTagName("instance")];

  if (instancias.length === 0) {
    throw new Error(
      "El XML no trae instancias (<instance>): no parece un timeline de SportsCode o Nacsport.",
    );
  }

  const hijo = (nodo: Element, nombre: string) =>
    nodo.getElementsByTagName(nombre)[0]?.textContent?.trim() ?? "";

  const categoriaPorNombre = new Map(
    contexto.categorias.map((una) => [normaliza(una.nombre), una]),
  );

  const jugadorDe = (codigo: string) => {
    const limpio = normaliza(codigo);
    const sinDorsal = limpio.replace(/^\d+\s*[-·.]?\s*/, "");
    const dorsal = /^(\d+)/.exec(limpio)?.[1];

    return (
      contexto.jugadores.find((uno) => normaliza(uno.nombre) === sinDorsal) ??
      contexto.jugadores.find(
        (uno) =>
          dorsal !== undefined &&
          uno.dorsal === Number(dorsal) &&
          sinDorsal.length > 0 &&
          normaliza(uno.nombre).includes(sinDorsal),
      ) ??
      null
    );
  };

  const nuevos = new Set<string>();
  let descartadas = 0;

  const clips: ClipImportado[] = [];

  for (const instancia of instancias) {
    const inicio = Number(hijo(instancia, "start").replace(",", "."));
    const fin = Number(hijo(instancia, "end").replace(",", "."));
    const codigo = hijo(instancia, "code");

    if (!codigo || !Number.isFinite(inicio) || !Number.isFinite(fin) || fin <= inicio) {
      descartadas += 1;
      continue;
    }

    const etiquetas = [...instancia.getElementsByTagName("label")].map(
      (label) => ({
        grupo: hijo(label, "group"),
        texto: hijo(label, "text"),
      }),
    );

    let categoriaId = "";
    const tags: string[] = [];
    const notas: string[] = [];

    for (const etiqueta of etiquetas) {
      if (!etiqueta.texto) continue;

      if (normaliza(etiqueta.grupo) === "nota") {
        notas.push(etiqueta.texto);
        continue;
      }

      const categoria = categoriaPorNombre.get(normaliza(etiqueta.texto));

      if (categoria && !categoriaId) categoriaId = categoria.id;
      else tags.push(etiqueta.texto);
    }

    /* Hay quien codifica por acciones: el `code` es la categoría. */
    const codigoCategoria = categoriaPorNombre.get(normaliza(codigo));

    const jugador = jugadorDe(codigo);
    const colectivo = contexto.comportamientos.find(
      (uno) => normaliza(uno.nombre) === normaliza(codigo),
    );

    let sujeto: Pick<BorradorClip, "sujeto" | "jugadorId" | "jugadorNombre" | "jugadorDorsal">;

    if (jugador) {
      sujeto = {
        sujeto: "jugador",
        jugadorId: jugador.id,
        jugadorNombre: jugador.nombre,
        jugadorDorsal: jugador.dorsal,
      };
    } else if (colectivo) {
      sujeto = {
        sujeto: "colectivo",
        jugadorId: colectivo.id,
        jugadorNombre: colectivo.nombre,
      };
    } else {
      nuevos.add(codigo);

      sujeto = {
        sujeto: "colectivo",
        jugadorId: `xml-${normaliza(codigo).replace(/[^a-z0-9]+/g, "-")}`,
        jugadorNombre: codigo,
      };
    }

    if (!categoriaId && codigoCategoria) categoriaId = codigoCategoria.id;

    clips.push({
      borrador: {
        ...sujeto,
        categoriaId,
        codingInicioMs: Math.round(inicio * 1000),
        codingFinMs: Math.round(fin * 1000),
        /* La instancia ya trae su margen dentro. */
        preRollMs: 0,
        postRollMs: 0,
      },
      tags,
      nota: notas.join(" · "),
    });
  }

  return {
    clips: clips.sort(
      (a, b) => a.borrador.codingInicioMs - b.borrador.codingInicioMs,
    ),
    descartadas,
    sujetosNuevos: [...nuevos],
  };
}
