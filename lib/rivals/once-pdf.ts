/*
|--------------------------------------------------------------------------
| PDF DEL ONCE PROBABLE DEL RIVAL
|--------------------------------------------------------------------------
|
| El botón flotante de exportar captura la pantalla y la mete en el PDF como
| una imagen: sirve para llevarse una ficha tal y como se ve, pero ahí no
| queda nada en lo que se pueda pulsar. Y de este documento se pide justo eso
| —abrir la ficha del jugador o su vídeo desde el propio PDF, en el móvil, de
| camino al campo—, así que se dibuja a mano con jsPDF: texto vectorial,
| enlaces de verdad y un diseño pensado para la hoja, no un recorte de la
| pantalla.
|
| De cada jugador sale **la misma ficha que se abre al pulsarlo en la app**:
| foto y dorsal, posición y rol, la banda de datos, el mapa de zona, la tabla
| de temporadas, las etiquetas y los cuatro textos de análisis. Para que las
| dos no se separen con el tiempo, el mapa y las columnas de la tabla salen de
| los módulos que también usa la pantalla (`lib/rivals/heatmap.ts` y
| `lib/rivals/stats-table.ts`), no de una copia hecha aquí.
|
| La portada no manda fuera del documento: pulsar a un jugador —en el campo o
| en la lista— salta a la página donde está su ficha, dentro del propio PDF.
| Es lo que se pide de camino al campo, donde no siempre hay cobertura para
| abrir la app. Los enlaces que sí salen fuera son dos y viven en la ficha:
| «Más información», que abre al jugador en la app, y «Ver vídeo», que abre su
| vídeo de YouTube. El de vídeo se repite como chapa en el campograma, porque
| es lo que más se busca con el dedo.
|
| El módulo **no sabe nada de la hoja ni del estado de la página**: recibe a
| los jugadores ya resueltos (posición, etiquetas, estadísticas y enlaces) y
| sólo se ocupa de pintarlos. Quien los prepara es `app/rivals/page.tsx`, que
| es donde viven el catálogo de etiquetas y la clasificación por líneas.
*/

import { heatBlobs, HEAT_GRASS, HEAT_STOPS } from "@/lib/rivals/heatmap";

import type { Theme } from "@/lib/theme";

import { highlightSeason, type RivalSeasonStats } from "@/lib/rivals/stats";

import {
  columnasTemporada,
  TEMPORADAS_VISIBLES,
} from "@/lib/rivals/stats-table";

export type OncePdfEstado = "titular" | "duda";

export type OncePdfLinea = "portero" | "defensa" | "medio" | "ataque";

export type OncePdfTag = {
  label: string;
  tone: "fortaleza" | "debilidad";
};

export type OncePdfEnlace = {
  label: string;
  url: string;
};

/** Cada cuadradito de la banda de datos de la ficha ("Edad · 24"). */
export type OncePdfDato = {
  label: string;
  valor: string;
};

export type OncePdfPlayer = {
  /** Sólo para ordenar y depurar; no se pinta. */
  clave: string;
  dorsal: string;
  /** Nombre deportivo: el que se lee en el campograma. */
  nombre: string;
  /** Nombre completo de la hoja. Se pinta si aporta algo sobre el anterior. */
  nombreCompleto: string;
  /** Código corto de la posición (POR, DFC, MP…). */
  posCode: string;
  /** La posición tal y como está escrita en la hoja. */
  posicion: string;
  /** Segunda posición ya formateada ("2ª LI"), si aporta algo. */
  segunda: string;
  /** Rol en el equipo, tal cual lo escribe la hoja. */
  rol: string;
  linea: OncePdfLinea | null;
  /** Color de la línea, en hexadecimal. */
  color: string;
  estado: OncePdfEstado;
  /** URL de la foto de la ficha. Se descarga al montar el documento. */
  foto: string;
  /** Edad, altura, pie… ya limpios y en el orden en que se leen. */
  datos: OncePdfDato[];
  /** Slot del mapa de zona (`por`, `ld`, `mc`…) y banda a la que tira. */
  slot: string | null;
  side: -1 | 0 | 1;
  /** BeSoccer da columnas distintas a los porteros. */
  portero: boolean;
  /** De la más reciente a la más antigua, como en la ficha de pantalla. */
  temporadas: RivalSeasonStats[];
  tags: OncePdfTag[];
  caracteristicas: string;
  fortalezas: string;
  debilidades: string;
  observaciones: string;
  /** Adónde lleva «Más información»: su ficha dentro de la app. */
  ficha: string;
  /** Vídeo del jugador. Sin él, el botón no se pinta. */
  video: string;
  /** Lo demás que se pueda abrir: informe, BeSoccer… */
  enlaces: OncePdfEnlace[];
};

/**
 * Apunta un rectángulo de la portada que tiene que saltar a la ficha de un
 * jugador.
 *
 * El salto no se puede escribir mientras se pinta el campo: las fichas van
 * después y todavía no se sabe en qué página cae cada una. Se guarda el hueco
 * y se resuelve al final, volviendo a la página 1 con `doc.setPage`.
 */
type Ancla = (clave: string, x: number, y: number, w: number, h: number) => void;

export type OncePdfData = {
  equipo: string;
  /** "25 de agosto de 2026". */
  fecha: string;
  jugadores: OncePdfPlayer[];
  /**
   * El tema con el que se está viendo la app. El documento sale igual: en
   * modo noche, oscuro; en modo día, sobre papel blanco. Sin él manda el
   * oscuro, que es el diseño original.
   */
  tema?: Theme;
};

/*
|--------------------------------------------------------------------------
| PALETA
|--------------------------------------------------------------------------
| La misma de la app, resuelta a color sólido: las capas translúcidas se
| mezclan aquí contra su fondo y se pintan ya planas. Un PDF lleno de
| transparencias pesa más, tarda en abrirse en el móvil y algunos visores lo
| imprimen mal.
|
| Hay dos, una por tema. El documento tiene que salir como se está viendo la
| plataforma: quien trabaja en modo día no quiere que le llegue una hoja negra
| —ni gastarse el tóner en imprimirla—, y quien trabaja de noche no quiere un
| fogonazo blanco al abrirla en el móvil de camino al campo.
|
| `realce` dice hacia dónde separar un color de su fondo: hacia el blanco
| sobre oscuro, hacia el negro sobre claro. Es lo que hace `realza()`.
*/

type Paleta = {
  fondo: string;
  panel: string;
  panelHondo: string;
  borde: string;
  bordeSuave: string;
  tinta: string;
  tintaMedia: string;
  tintaTenue: string;
  oro: string;
  verde: string;
  ambar: string;
  rojo: string;
  cesped: string;
  /** Franjas de siega: el césped un punto por encima o por debajo. */
  siega: string;
  lineaCampo: string;
  realce: 1 | -1;
};

const PALETA_NOCHE: Paleta = {
  fondo: "#0B0F14",
  panel: "#131A22",
  panelHondo: "#0E141B",
  borde: "#222C37",
  bordeSuave: "#1A222B",
  tinta: "#F2F5F8",
  tintaMedia: "#9AA5B1",
  tintaTenue: "#66727F",
  oro: "#C8A96B",
  verde: "#34D399",
  ambar: "#FBBF24",
  rojo: "#F87171",
  cesped: "#0E1A14",
  siega: "#14201A",
  lineaCampo: "#33463C",
  realce: 1,
};

/*
| El modo día no es el nocturno invertido: los pastel de la familia 300-400 no
| llegan a 2:1 sobre blanco, así que verde, ámbar, rojo y oro bajan a la
| familia 600-700 —los mismos valores que usa `globals.css` para el tema
| claro—. El papel es blanco puro y no el gris de la página: una hoja se lee y
| se imprime mejor así, y las tarjetas necesitan un gris propio para
| distinguirse del fondo.
*/
const PALETA_DIA: Paleta = {
  fondo: "#FFFFFF",
  panel: "#F4F6FA",
  panelHondo: "#EBEEF3",
  borde: "#C4CDD8",
  bordeSuave: "#DDE3EA",
  tinta: "#0B0F14",
  tintaMedia: "#4B5663",
  tintaTenue: "#78838F",
  oro: "#8A6A2C",
  verde: "#15803D",
  ambar: "#B45309",
  rojo: "#DC2626",
  cesped: "#E3EFE6",
  siega: "#D6E5DA",
  lineaCampo: "#93B49E",
  realce: -1,
};

/*
| Paleta viva del documento que se está montando. Es estado de módulo y no un
| parámetro porque la firman las cuarenta funciones de dibujo: pasarla a mano
| por todas no aportaría nada. `buildOncePdf` la fija antes de pintar el
| primer trazo —y antes de recortar las fotos, que también miran el fondo—.
*/
let C: Paleta = PALETA_NOCHE;

function estadoColor(estado: OncePdfEstado) {
  return estado === "titular" ? C.verde : C.ambar;
}

const ESTADO_LABEL: Record<OncePdfEstado, string> = {
  titular: "TITULAR",
  duda: "DUDA",
};

const LINEA_LABEL: Record<OncePdfLinea, string> = {
  portero: "PORTERÍA",
  defensa: "DEFENSA",
  medio: "MEDIO CAMPO",
  ataque: "ATAQUE",
};

/* De atrás hacia adelante: es como se lee un once. */
const LINEA_ORDEN: OncePdfLinea[] = ["portero", "defensa", "medio", "ataque"];

/* Altura de cada línea dentro del campo, con el ataque hacia arriba. */
const LINEA_Y: Record<OncePdfLinea, number> = {
  portero: 0.88,
  defensa: 0.66,
  medio: 0.43,
  ataque: 0.2,
};

/** Lo que se lee en los dos botones vivos de cada jugador. */
const BOTON_FICHA = "Más información";
const BOTON_VIDEO = "Ver vídeo";

/*
|--------------------------------------------------------------------------
| MEDIDAS
|--------------------------------------------------------------------------
*/

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGEN = 36;
const CONTENT_W = PAGE_W - MARGEN * 2;
const PIE_H = 30;

/** Última línea de base que puede ocupar el contenido de una página. */
const FONDO_PAGINA = PAGE_H - MARGEN - PIE_H;

/* Portada: el campo a la izquierda y el resumen del once a la derecha. El
   campo ocupa casi toda la altura útil de la hoja; con menos, la portada se
   quedaba con un palmo de negro debajo. */
const CAMPO_W = 344;
const CAMPO_H = 632;
const COL_X = MARGEN + CAMPO_W + 18;
const COL_W = CONTENT_W - CAMPO_W - 18;

/* Ficha: aire interior, foto cuadrada como la del pop-up y banda de datos. */
const PAD = 14;
const FOTO = 76;
const DATO_H = 21;
const DATO_GAP = 5;

/** Dónde empieza la columna de la derecha de la cabecera, y cuánto mide. */
const CAB_X = PAD + FOTO + PAD;
const CAB_W = CONTENT_W - CAB_X - PAD;

/* Mapa de zona de la ficha: la misma proporción 2:3 que en pantalla. */
const ZONA_W = 66;
const ZONA_H = 99;

const TABLA_CABECERA = 12;
const TABLA_FILA = 15;

/**
 * Tope de líneas de cada texto de análisis.
 *
 * Sin tope, una ficha con cuatro párrafos largos crece más que la hoja y se
 * parte por la mitad. Diez líneas son unas cuarenta palabras: lo que se lee
 * de pie antes de un partido. Lo que sobra se corta con puntos suspensivos y
 * sigue estando entero en la app, a un toque de «Más información».
 */
const MAX_LINEAS_BLOQUE = 10;

/*
|--------------------------------------------------------------------------
| COLOR
|--------------------------------------------------------------------------
*/

type RGB = [number, number, number];

function hexToRgb(hex: string): RGB {
  const limpio = hex.replace("#", "");

  const entero = parseInt(
    limpio.length === 3
      ? limpio
          .split("")
          .map((letra) => letra + letra)
          .join("")
      : limpio,
    16,
  );

  return [(entero >> 16) & 255, (entero >> 8) & 255, entero & 255];
}

/** Un color translúcido ya aplastado contra su fondo. */
function mezcla(color: string | RGB, fondo: string | RGB, alfa: number): RGB {
  const frente = typeof color === "string" ? hexToRgb(color) : color;
  const detras = typeof fondo === "string" ? hexToRgb(fondo) : fondo;

  return [
    Math.round(frente[0] * alfa + detras[0] * (1 - alfa)),
    Math.round(frente[1] * alfa + detras[1] * (1 - alfa)),
    Math.round(frente[2] * alfa + detras[2] * (1 - alfa)),
  ];
}

/**
 * Separa un color de su fondo hasta que se lea.
 *
 * Los colores de línea están pensados para chapas con fondo translúcido; en
 * texto plano sobre el panel algunos —el azul de la defensa— se quedan justos.
 * En modo noche eso se arregla aclarando; en modo día, oscureciendo.
 *
 * Sobre papel se empuja un 60 % más: el mismo salto que basta contra el negro
 * se queda corto contra el blanco, donde el ojo perdona mucho menos.
 */
function realza(color: string, cantidad: number): RGB {
  const [r, g, b] = hexToRgb(color);

  const destino = C.realce > 0 ? 255 : 0;
  const paso = C.realce > 0 ? cantidad : Math.min(0.75, cantidad * 1.6);

  return [
    Math.round(r + (destino - r) * paso),
    Math.round(g + (destino - g) * paso),
    Math.round(b + (destino - b) * paso),
  ];
}

/*
|--------------------------------------------------------------------------
| DIBUJO
|--------------------------------------------------------------------------
| De jsPDF se usa una porción pequeña y siempre igual, así que estos ayudantes
| evitan repetir la conversión de color en cada trazo.
*/

type Doc = import("jspdf").jsPDF;

type Estilo = "normal" | "bold" | "italic";

function fill(doc: Doc, color: string | RGB) {
  const [r, g, b] = typeof color === "string" ? hexToRgb(color) : color;

  doc.setFillColor(r, g, b);
}

function stroke(doc: Doc, color: string | RGB, grosor = 0.6) {
  const [r, g, b] = typeof color === "string" ? hexToRgb(color) : color;

  doc.setDrawColor(r, g, b);
  doc.setLineWidth(grosor);
}

function ink(doc: Doc, color: string | RGB) {
  const [r, g, b] = typeof color === "string" ? hexToRgb(color) : color;

  doc.setTextColor(r, g, b);
}

function fuente(doc: Doc, tamano: number, estilo: Estilo = "normal") {
  doc.setFont("helvetica", estilo);
  doc.setFontSize(tamano);
}

/** Ancho real del texto con la fuente que esté puesta ahora mismo. */
function ancho(doc: Doc, texto: string) {
  return doc.getTextWidth(texto);
}

/** Recorta con puntos suspensivos si no cabe. */
function recorta(doc: Doc, texto: string, maxW: number) {
  if (ancho(doc, texto) <= maxW) return texto;

  let corte = texto;

  while (corte.length > 1 && ancho(doc, `${corte}…`) > maxW) {
    corte = corte.slice(0, -1);
  }

  return `${corte.trimEnd()}…`;
}

/**
 * Rótulo en mayúsculas espaciadas, como los de la app.
 *
 * jsPDF no tiene `letter-spacing`, así que se separa letra a letra. Sólo para
 * rótulos cortos: en un párrafo saldría carísimo en tamaño de archivo.
 */
function rotulo(doc: Doc, texto: string, x: number, y: number, espaciado = 1.1) {
  let cursor = x;

  for (const letra of texto.toUpperCase()) {
    doc.text(letra, cursor, y);
    cursor += ancho(doc, letra) + espaciado;
  }
}

/** Lo que ocupará ese rótulo, para reservarle sitio antes de pintarlo. */
function anchoRotulo(doc: Doc, texto: string, espaciado = 1.1) {
  return [...texto.toUpperCase()].reduce(
    (total, letra) => total + ancho(doc, letra) + espaciado,
    0,
  );
}

/** Chapa redondeada con texto dentro. Devuelve lo que ha ocupado de ancho. */
function chapa(
  doc: Doc,
  texto: string,
  x: number,
  y: number,
  opciones: {
    color: string;
    fondo?: string;
    tamano?: number;
    alto?: number;
    padding?: number;
  },
) {
  const {
    color,
    fondo = C.panel,
    tamano = 6.5,
    alto = 11,
    padding = 5,
  } = opciones;

  fuente(doc, tamano, "bold");

  const w = ancho(doc, texto) + padding * 2;

  fill(doc, mezcla(color, fondo, 0.16));
  stroke(doc, mezcla(color, fondo, 0.45), 0.5);
  doc.roundedRect(x, y, w, alto, alto / 2, alto / 2, "FD");

  ink(doc, realza(color, 0.25));
  doc.text(texto, x + padding, y + alto / 2 + tamano * 0.36);

  return w;
}

/**
 * Flechita de «se abre fuera».
 *
 * El carácter ↗ no existe en la codificación de las fuentes estándar de PDF y
 * saldría como un cuadro, así que se dibuja con tres trazos.
 */
function flechaExterna(doc: Doc, x: number, y: number, lado: number, color: RGB) {
  stroke(doc, color, 0.7);

  doc.line(x, y + lado, x + lado, y);
  doc.line(x + lado * 0.35, y, x + lado, y);
  doc.line(x + lado, y, x + lado, y + lado * 0.65);
}

/** Triangulito de «reproducir»: el del botón y la chapa de vídeo. */
function trianguloPlay(
  doc: Doc,
  x: number,
  y: number,
  lado: number,
  color: string | RGB,
) {
  fill(doc, color);

  doc.triangle(x, y, x, y + lado, x + lado * 0.86, y + lado / 2, "F");
}

/**
 * Botón con enlace de verdad: el que abre la ficha o el vídeo del jugador.
 *
 * Devuelve lo que ha ocupado de ancho, para poder encadenar los siguientes.
 */
function botonEnlace(
  doc: Doc,
  texto: string,
  url: string,
  x: number,
  y: number,
  opciones: {
    color: string;
    /** Relleno sólido: el botón que manda de la fila. */
    solido?: boolean;
    /** Triangulito de play delante del texto, para el de vídeo. */
    play?: boolean;
    fondo?: string;
    alto?: number;
  },
) {
  const {
    color,
    solido = false,
    play = false,
    fondo = C.panel,
    alto = 17,
  } = opciones;

  fuente(doc, 7.5, "bold");

  const icono = play ? 11 : 0;
  const w = ancho(doc, texto) + 26 + icono;

  if (solido) {
    fill(doc, realza(color, 0.04));
    stroke(doc, realza(color, 0.3), 0.6);
  } else {
    fill(doc, mezcla(color, fondo, 0.12));
    stroke(doc, mezcla(color, fondo, 0.45), 0.6);
  }

  doc.roundedRect(x, y, w, alto, alto / 2, alto / 2, "FD");

  const tintaBoton: RGB = solido ? hexToRgb(C.fondo) : realza(color, 0.2);

  if (play) trianguloPlay(doc, x + 10, y + alto / 2 - 3.4, 6.8, tintaBoton);

  ink(doc, tintaBoton);
  doc.text(texto, x + 10 + icono, y + alto / 2 + 2.6);

  flechaExterna(doc, x + w - 14, y + alto / 2 - 2.6, 5, tintaBoton);

  doc.link(x, y, w, alto, { url });

  return w;
}

/*
|--------------------------------------------------------------------------
| FOTOS
|--------------------------------------------------------------------------
| Las fotos de los rivales son de BeSoccer, y ese CDN no manda cabeceras CORS:
| leerlas directamente contamina el `<canvas>` y `toDataURL()` revienta. Por
| eso pasan por `/api/rivals/foto`, que las sirve desde el mismo origen.
|
| Una foto que no se puede descargar **no** puede tumbar el PDF: se queda sin
| ella y en su hueco va la silueta, igual que en la ficha de pantalla.
*/

/** Lado en píxeles al que se normaliza la foto antes de meterla en el PDF. */
const FOTO_PX = 220;

type FotoCache = Map<string, string>;

async function cargaFoto(url: string): Promise<string | null> {
  const respuesta = await fetch(
    `/api/rivals/foto?url=${encodeURIComponent(url)}`,
  );

  if (!respuesta.ok) return null;

  const blob = await respuesta.blob();
  const objectUrl = URL.createObjectURL(blob);

  try {
    const imagen = await new Promise<HTMLImageElement>((resolve, reject) => {
      const elemento = new Image();

      elemento.onload = () => resolve(elemento);
      elemento.onerror = () => reject(new Error("Foto ilegible"));
      elemento.src = objectUrl;
    });

    if (!imagen.naturalWidth || !imagen.naturalHeight) return null;

    const lienzo = document.createElement("canvas");

    lienzo.width = FOTO_PX;
    lienzo.height = FOTO_PX;

    const ctx = lienzo.getContext("2d");

    if (!ctx) return null;

    /* Recorte cuadrado centrado: el mismo `object-cover` de la ficha. */
    fillLienzo(ctx);

    const escala = Math.max(
      FOTO_PX / imagen.naturalWidth,
      FOTO_PX / imagen.naturalHeight,
    );

    const w = imagen.naturalWidth * escala;
    const h = imagen.naturalHeight * escala;

    ctx.drawImage(imagen, (FOTO_PX - w) / 2, (FOTO_PX - h) / 2, w, h);

    /* JPEG y no PNG: son fotos, y once retratos en PNG multiplican por cinco
       lo que pesa el documento que luego se manda por WhatsApp. */
    return lienzo.toDataURL("image/jpeg", 0.85);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/** Fondo del recorte, para las fotos con transparencia o proporción rara. */
function fillLienzo(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = C.panelHondo;
  ctx.fillRect(0, 0, FOTO_PX, FOTO_PX);
}

async function cargaFotos(jugadores: OncePdfPlayer[]): Promise<FotoCache> {
  const cache: FotoCache = new Map();

  if (typeof document === "undefined") return cache;

  const urls = [
    ...new Set(jugadores.map((jugador) => jugador.foto).filter(Boolean)),
  ];

  const descargas = await Promise.all(
    urls.map(async (url) => {
      try {
        return [url, await cargaFoto(url)] as const;
      } catch (error) {
        console.warn("No se ha podido descargar la foto del rival:", url, error);

        return [url, null] as const;
      }
    }),
  );

  descargas.forEach(([url, dataUrl]) => {
    if (dataUrl) cache.set(url, dataUrl);
  });

  return cache;
}

/*
|--------------------------------------------------------------------------
| CAMPO
|--------------------------------------------------------------------------
*/

function dibujaCampo(doc: Doc, x: number, y: number, w: number, h: number) {
  fill(doc, C.cesped);
  stroke(doc, C.borde, 0.8);
  doc.roundedRect(x, y, w, h, 8, 8, "FD");

  /*
  | Franjas de siega, muy tenues a propósito: dan textura para que el campo no
  | sea un rectángulo vacío, pero no deben competir con los jugadores.
  */
  const franjas = 8;
  const altoFranja = h / franjas;

  fill(doc, C.siega);

  for (let i = 0; i < franjas; i += 2) {
    doc.rect(x + 1, y + 1 + i * altoFranja, w - 2, altoFranja, "F");
  }

  const margen = 13;
  const cx = x + w / 2;
  const izq = x + margen;
  const der = x + w - margen;
  const arriba = y + margen;
  const abajo = y + h - margen;

  stroke(doc, C.lineaCampo, 0.8);

  /* Perímetro y medio campo. */
  doc.rect(izq, arriba, der - izq, abajo - arriba, "S");
  doc.line(izq, y + h / 2, der, y + h / 2);

  /* Círculo central y punto. */
  doc.circle(cx, y + h / 2, (der - izq) * 0.155, "S");

  fill(doc, C.lineaCampo);
  doc.circle(cx, y + h / 2, 1.4, "F");

  /* Áreas grande y pequeña, arriba y abajo, con su punto de penalti. */
  const areaW = (der - izq) * 0.6;
  const areaH = (abajo - arriba) * 0.15;
  const chicaW = (der - izq) * 0.28;
  const chicaH = (abajo - arriba) * 0.055;

  ([arriba, abajo] as const).forEach((borde) => {
    const haciaDentro = borde === arriba ? 1 : -1;
    const topArea = borde === arriba ? borde : borde - areaH;
    const topChica = borde === arriba ? borde : borde - chicaH;

    stroke(doc, C.lineaCampo, 0.8);
    doc.rect(cx - areaW / 2, topArea, areaW, areaH, "S");
    doc.rect(cx - chicaW / 2, topChica, chicaW, chicaH, "S");

    fill(doc, C.lineaCampo);
    doc.circle(cx, borde + haciaDentro * areaH * 0.68, 1.2, "F");
  });
}

/*
|--------------------------------------------------------------------------
| COLOCACIÓN EN EL CAMPO
|--------------------------------------------------------------------------
| El campograma de la pantalla reparte a toda la plantilla con su propio
| motor; aquí sólo entran los once marcados, así que basta con repartir cada
| línea a lo ancho. Lo único que hay que respetar es el lado: un lateral
| izquierdo dibujado a la derecha se lee mal aunque el nombre esté bien.
*/

/*
| Códigos que llevan banda dentro. Se miraba la última letra —"acaba en D, a
| la derecha"—, pero eso manda a la banda a MCD (mediocentro *defensivo*) y a
| SD (*segundo* delantero), que juegan por dentro: el once salía con el pivote
| escorado a la derecha y un interior de menos en el centro.
*/
const POS_IZQUIERDA = new Set(["LI", "EI"]);
const POS_DERECHA = new Set(["LD", "ED"]);

/** Izquierda 0, centro 1, derecha 2. Sale del código corto de la posición. */
function ladoDe(posCode: string) {
  if (POS_IZQUIERDA.has(posCode)) return 0;
  if (POS_DERECHA.has(posCode)) return 2;

  return 1;
}

function reparteLinea(jugadores: OncePdfPlayer[]) {
  return jugadores
    .map((jugador, indice) => ({ jugador, indice }))
    .sort((a, b) => {
      const lado = ladoDe(a.jugador.posCode) - ladoDe(b.jugador.posCode);

      return lado !== 0 ? lado : a.indice - b.indice;
    })
    .map((item) => item.jugador);
}

/** Radio de la cara de un jugador en el campograma. */
const CARA = 16;

function pintaJugadorEnCampo(
  doc: Doc,
  jugador: OncePdfPlayer,
  fotos: FotoCache,
  cx: number,
  cy: number,
  hueco: number,
  ancla: Ancla,
) {
  const radio = CARA;
  const color = estadoColor(jugador.estado);
  const foto = jugador.foto ? fotos.get(jugador.foto) : undefined;

  /* Fondo del recorte: se ve por las esquinas de un retrato que no llene el
     círculo, y es lo que queda entero cuando no hay foto. */
  fill(doc, mezcla(jugador.color, C.cesped, 0.32));
  doc.circle(cx, cy, radio, "F");

  /*
  | La cara del jugador dentro del círculo. Es lo que se pide del campograma:
  | leer el once por caras y no por dorsales, que es como se reconoce a un
  | rival desde la banda. La foto ya viene recortada en cuadrado desde
  | `cargaFoto`, así que basta con recortar en círculo y encajarla.
  |
  | El `alias` es la URL: sin él jsPDF incrusta la misma foto dos veces —aquí
  | y en la ficha— y el documento pesa el doble.
  */
  if (foto) {
    doc.saveGraphicsState();
    doc.circle(cx, cy, radio, null);
    doc.clip();
    doc.discardPath();

    doc.addImage(
      foto,
      "JPEG",
      cx - radio,
      cy - radio,
      radio * 2,
      radio * 2,
      jugador.foto,
    );

    doc.restoreGraphicsState();
  } else {
    siluetaFoto(doc, cx - radio, cy - radio, radio * 2);
  }

  /* Aro exterior del estado: verde continuo el titular, ámbar discontinuo la
     duda. Se distinguen incluso impresos en blanco y negro. Va después de la
     foto para que quede por encima del recorte. */
  stroke(doc, color, 1.4);

  if (jugador.estado === "duda") doc.setLineDashPattern([2, 1.8], 0);

  doc.circle(cx, cy, radio, "S");
  doc.setLineDashPattern([], 0);

  /* Dorsal en chapa dorada abajo a la derecha, como en la ficha: dentro del
     círculo taparía la cara. */
  const dorsal = jugador.dorsal || "—";

  fuente(doc, 7, "bold");

  const anchoDorsal = Math.max(14, ancho(doc, dorsal) + 8);
  const dorsalX = cx + radio - anchoDorsal + 3;
  const dorsalY = cy + radio - 9;

  fill(doc, C.oro);
  stroke(doc, C.cesped, 0.8);
  doc.roundedRect(dorsalX, dorsalY, anchoDorsal, 11, 5.5, 5.5, "FD");

  ink(doc, C.fondo);
  doc.text(dorsal, dorsalX + (anchoDorsal - ancho(doc, dorsal)) / 2, dorsalY + 7.7);

  fuente(doc, 7, "bold");
  ink(doc, C.tinta);

  const nombre = recorta(doc, jugador.nombre, hueco);

  doc.text(nombre, cx - ancho(doc, nombre) / 2, cy + radio + 12);

  fuente(doc, 5.5, "normal");
  ink(doc, realza(jugador.color, 0.2));

  const pos = recorta(doc, jugador.posCode || jugador.posicion, hueco);

  doc.text(pos, cx - ancho(doc, pos) / 2, cy + radio + 20);

  /* La cara entera salta a su ficha, y con ella el nombre y la posición: en el
     móvil hay que poder acertar con el dedo. Y salta dentro del documento —no
     abre el navegador—, así que el PDF se lee entero sin cobertura. */
  ancla(jugador.clave, cx - radio, cy - radio, radio * 2, radio * 2 + 22);

  /*
  | Chapa de vídeo debajo del nombre. Es lo que se pide del campograma: verlo
  | montado y poder abrir de ahí mismo el vídeo de YouTube del jugador que
  | interesa, sin pasar por su ficha. Éste sí sale fuera del PDF. Sólo aparece
  | cuando la ficha del jugador trae el enlace.
  */
  if (!jugador.video) return;

  fuente(doc, 5.5, "bold");

  const texto = "VÍDEO";
  const anchoChapa = ancho(doc, texto) + 18;
  const chapaX = cx - anchoChapa / 2;
  const chapaY = cy + radio + 24;

  fill(doc, mezcla(C.oro, C.cesped, 0.2));
  stroke(doc, mezcla(C.oro, C.cesped, 0.55), 0.5);
  doc.roundedRect(chapaX, chapaY, anchoChapa, 11, 5.5, 5.5, "FD");

  const tintaChapa = realza(C.oro, 0.25);

  trianguloPlay(doc, chapaX + 6, chapaY + 3.4, 4.4, tintaChapa);

  ink(doc, tintaChapa);
  doc.text(texto, chapaX + 12.5, chapaY + 7.6);

  doc.link(chapaX, chapaY, anchoChapa, 11, { url: jugador.video });
}

/*
|--------------------------------------------------------------------------
| PORTADA
|--------------------------------------------------------------------------
*/

function fondoPagina(doc: Doc) {
  fill(doc, C.fondo);
  doc.rect(0, 0, PAGE_W, PAGE_H, "F");

  /* Filo dorado del borde superior: la firma de la casa. */
  fill(doc, C.oro);
  doc.rect(0, 0, PAGE_W, 3, "F");
}

function cabecera(doc: Doc, data: OncePdfData, titulares: number, dudas: number) {
  const y = MARGEN;

  fuente(doc, 6.5, "bold");
  ink(doc, C.oro);
  rotulo(doc, "RMCF CASTILLA · SCOUTING RIVAL", MARGEN, y + 8, 1.6);

  fuente(doc, 23, "bold");
  ink(doc, C.tinta);
  doc.text(recorta(doc, data.equipo || "Rival", CONTENT_W - 180), MARGEN, y + 34);

  fuente(doc, 8.5, "normal");
  ink(doc, C.tintaMedia);
  doc.text(`Once probable · ${data.fecha}`, MARGEN, y + 49);

  /* Contadores a la derecha, alineados con el título. Se colocan de derecha a
     izquierda para que el bloque quede pegado al margen. */
  let x = PAGE_W - MARGEN;

  const contadores = [
    {
      texto: `${titulares} ${titulares === 1 ? "TITULAR" : "TITULARES"}`,
      color: C.verde,
    },
  ];

  if (dudas > 0) {
    contadores.push({
      texto: `${dudas} ${dudas === 1 ? "DUDA" : "DUDAS"}`,
      color: C.ambar,
    });
  }

  contadores.reverse().forEach(({ texto, color }) => {
    fuente(doc, 7, "bold");

    const w = ancho(doc, texto) + 16;

    chapa(doc, texto, x - w, y + 20, {
      color,
      fondo: C.fondo,
      tamano: 7,
      alto: 15,
      padding: 8,
    });

    x -= w + 6;
  });

  stroke(doc, C.borde, 0.7);
  doc.line(MARGEN, y + 60, PAGE_W - MARGEN, y + 60);

  return y + 60;
}

/**
 * Una fila del resumen de la derecha.
 *
 * La fila entera salta a la ficha del jugador dentro del PDF; el triangulito
 * del final, cuando lo hay, abre su vídeo en YouTube. Son dos destinos
 * distintos sobre la misma línea, así que el de la ficha se recorta para no
 * comerse al del vídeo.
 */
function filaResumen(
  doc: Doc,
  jugador: OncePdfPlayer,
  x: number,
  y: number,
  w: number,
  opciones: {
    dorsalX: number;
    nombreX: number;
    colorDorsal: string | RGB;
    ancla: Ancla;
  },
) {
  const { dorsalX, nombreX, colorDorsal, ancla } = opciones;

  const conVideo = Boolean(jugador.video);
  const derecha = x + w - 12 - (conVideo ? 12 : 0);

  fuente(doc, 7.5, "bold");
  ink(doc, colorDorsal);
  doc.text(jugador.dorsal || "—", x + dorsalX, y);

  fuente(doc, 5.5, "normal");

  const anchoPos = ancho(doc, jugador.posCode);

  fuente(doc, 7.5, "normal");
  ink(doc, C.tinta);

  doc.text(
    recorta(doc, jugador.nombre, derecha - anchoPos - 6 - (x + nombreX)),
    x + nombreX,
    y,
  );

  fuente(doc, 5.5, "normal");
  ink(doc, C.tintaTenue);
  doc.text(jugador.posCode, derecha - anchoPos, y);

  ancla(jugador.clave, x + 8, y - 9, derecha - (x + 8), 12);

  if (!conVideo) return;

  trianguloPlay(doc, x + w - 12, y - 6.4, 7, realza(C.oro, 0.2));

  doc.link(x + w - 16, y - 9, 14, 12, { url: jugador.video });
}

/** Lista compacta del once, por líneas, a la derecha del campo. */
function columnaResumen(
  doc: Doc,
  y: number,
  porLinea: Map<OncePdfLinea, OncePdfPlayer[]>,
  sinLinea: OncePdfPlayer[],
  dudas: OncePdfPlayer[],
  ancla: Ancla,
) {
  const x = COL_X;
  const w = COL_W;

  let cursor = y;

  /* ---------------- EL ONCE ---------------- */

  const grupos: { titulo: string; jugadores: OncePdfPlayer[] }[] = [
    ...LINEA_ORDEN.map((linea) => ({
      titulo: LINEA_LABEL[linea],
      jugadores: porLinea.get(linea) ?? [],
    })),
    { titulo: "SIN POSICIÓN", jugadores: sinLinea },
  ].filter((grupo) => grupo.jugadores.length > 0);

  const altoOnce =
    32 +
    grupos.reduce((total, grupo) => total + 12 + grupo.jugadores.length * 13.5 + 2, 0);

  fill(doc, C.panel);
  stroke(doc, C.bordeSuave, 0.6);
  doc.roundedRect(x, cursor, w, altoOnce, 7, 7, "FD");

  fuente(doc, 6.5, "bold");
  ink(doc, C.oro);
  rotulo(doc, "EL ONCE", x + 12, cursor + 17, 1.4);

  let fy = cursor + 32;

  grupos.forEach((grupo) => {
    fuente(doc, 5.5, "bold");
    ink(doc, C.tintaTenue);
    rotulo(doc, grupo.titulo, x + 12, fy, 0.9);

    fy += 12;

    grupo.jugadores.forEach((jugador) => {
      /* Punto del color de la línea: ata la fila con su sitio en el campo. */
      fill(doc, realza(jugador.color, 0.1));
      doc.circle(x + 14, fy - 2.6, 2.1, "F");

      filaResumen(doc, jugador, x, fy, w, {
        dorsalX: 21,
        nombreX: 38,
        colorDorsal: C.tintaMedia,
        ancla,
      });

      fy += 13.5;
    });

    fy += 2;
  });

  cursor += altoOnce + 12;

  /* ---------------- DUDAS ---------------- */

  if (dudas.length) {
    const altoDudas = 32 + dudas.length * 13.5;

    fill(doc, mezcla(C.ambar, C.fondo, 0.07));
    stroke(doc, mezcla(C.ambar, C.fondo, 0.32), 0.6);
    doc.roundedRect(x, cursor, w, altoDudas, 7, 7, "FD");

    fuente(doc, 6.5, "bold");
    ink(doc, C.ambar);
    rotulo(doc, `DUDAS · ${dudas.length}`, x + 12, cursor + 17, 1.4);

    let dy = cursor + 32;

    dudas.forEach((jugador) => {
      filaResumen(doc, jugador, x, dy, w, {
        dorsalX: 12,
        nombreX: 30,
        colorDorsal: realza(C.ambar, 0.15),
        ancla,
      });

      dy += 13.5;
    });

    cursor += altoDudas + 12;
  }

  /* ---------------- CÓMO SE LEE ---------------- */

  const leyenda = [
    { color: C.verde, texto: "Titular", discontinuo: false },
    { color: C.ambar, texto: "Duda", discontinuo: true },
  ];

  fuente(doc, 6, "italic");

  const nota: string[] = doc.splitTextToSize(
    "Pulsa a un jugador —en el campo o en la lista— y el PDF salta a su ficha. El triangulito abre su vídeo de YouTube.",
    w - 24,
  );

  const altoLeyenda = 30 + leyenda.length * 12 + 12 + 6 + nota.length * 7.5 + 8;

  fill(doc, C.panel);
  stroke(doc, C.bordeSuave, 0.6);
  doc.roundedRect(x, cursor, w, altoLeyenda, 7, 7, "FD");

  fuente(doc, 6.5, "bold");
  ink(doc, C.tintaTenue);
  rotulo(doc, "CÓMO LEERLO", x + 12, cursor + 17, 1.4);

  let ly = cursor + 32;

  leyenda.forEach(({ color, texto, discontinuo }) => {
    fill(doc, mezcla(color, C.panel, 0.2));
    stroke(doc, color, 1);

    if (discontinuo) doc.setLineDashPattern([1.4, 1.2], 0);

    doc.circle(x + 16, ly - 2.4, 4, "FD");
    doc.setLineDashPattern([], 0);

    fuente(doc, 7, "normal");
    ink(doc, C.tintaMedia);
    doc.text(texto, x + 26, ly);

    ly += 12;
  });

  trianguloPlay(doc, x + 13, ly - 6.6, 7, realza(C.oro, 0.2));

  fuente(doc, 7, "normal");
  ink(doc, C.tintaMedia);
  doc.text("Vídeo del jugador (YouTube)", x + 26, ly);

  ly += 12;

  fuente(doc, 6, "italic");
  ink(doc, C.tintaTenue);

  nota.forEach((linea, i) => doc.text(linea, x + 12, ly + 4 + i * 7.5));
}

/*
|--------------------------------------------------------------------------
| MAPA DE ZONA
|--------------------------------------------------------------------------
| El mismo mapa de la ficha de pantalla, con las manchas de
| `lib/rivals/heatmap.ts`. En SVG el calor se suma con `mix-blend-mode:
| screen`; aquí no hay mezcla que valga, así que cada mancha se pinta como una
| pila de anillos ya aplastados contra el césped, y las más flojas van debajo.
| El resultado no es idéntico al pixel, pero es la misma zona.
*/

/** Anillos por mancha: más da un degradado más fino y un PDF más pesado. */
const ANILLOS_CALOR = 10;

/** Color y opacidad del degradado de calor a esa distancia del centro (0-1). */
function colorCalor(t: number) {
  const punto = Math.min(1, Math.max(0, t));

  let i = 1;

  while (i < HEAT_STOPS.length - 1 && punto > HEAT_STOPS[i].offset) i += 1;

  const anterior = HEAT_STOPS[i - 1];
  const siguiente = HEAT_STOPS[i];

  const tramo = siguiente.offset - anterior.offset || 1;
  const k = Math.min(1, Math.max(0, (punto - anterior.offset) / tramo));

  return {
    color: mezcla(siguiente.color, anterior.color, k),
    opacidad: anterior.opacity + (siguiente.opacity - anterior.opacity) * k,
  };
}

function dibujaZona(
  doc: Doc,
  x: number,
  y: number,
  w: number,
  h: number,
  jugador: OncePdfPlayer,
) {
  const base = hexToRgb(HEAT_GRASS.centro);

  doc.saveGraphicsState();

  /* Fuera de la línea de banda no se juega: sin recortar, las manchas de
     banda se derraman por el borde y parecen más anchas de lo que son. */
  doc.roundedRect(x, y, w, h, 5, 5, null);
  doc.clip();
  doc.discardPath();

  /* Césped: el degradado vertical de la ficha, resuelto en franjas. */
  const franjas = 12;

  for (let i = 0; i < franjas; i += 1) {
    const hacia = Math.abs(i / (franjas - 1) - 0.5) * 2;

    fill(doc, mezcla(HEAT_GRASS.borde, HEAT_GRASS.centro, hacia));
    doc.rect(x, y + (h * i) / franjas, w, h / franjas + 0.6, "F");
  }

  [...heatBlobs(jugador.slot, jugador.side)]
    .sort((a, b) => a.w - b.w)
    .forEach((blob) => {
      for (let anillo = ANILLOS_CALOR; anillo >= 1; anillo -= 1) {
        const t = anillo / ANILLOS_CALOR;
        const { color, opacidad } = colorCalor(t);
        const alfa = opacidad * blob.w;

        /* Por debajo de esto el anillo ya no se distingue del césped y sólo
           añade objetos al documento. */
        if (alfa <= 0.02) continue;

        fill(doc, mezcla(color, base, alfa));

        doc.ellipse(
          x + blob.x * w,
          y + blob.y * h,
          blob.rx * w * t,
          blob.ry * h * t,
          "F",
        );
      }
    });

  /* Líneas del campo, encima del calor para no perder la referencia. */
  const linea = mezcla("#FFFFFF", base, 0.28);
  const m = 2;
  const cx = x + w / 2;

  stroke(doc, linea, 0.5);

  doc.rect(x + m, y + m, w - m * 2, h - m * 2, "S");
  doc.line(x + m, y + h / 2, x + w - m, y + h / 2);
  doc.circle(cx, y + h / 2, w * 0.12, "S");

  const areaW = w * 0.6;
  const areaH = h * 0.133;
  const chicaW = w * 0.32;
  const chicaH = h * 0.053;

  doc.rect(cx - areaW / 2, y + m, areaW, areaH, "S");
  doc.rect(cx - chicaW / 2, y + m, chicaW, chicaH, "S");
  doc.rect(cx - areaW / 2, y + h - m - areaH, areaW, areaH, "S");
  doc.rect(cx - chicaW / 2, y + h - m - chicaH, chicaW, chicaH, "S");

  fill(doc, linea);
  doc.circle(cx, y + h / 2, 0.7, "F");
  doc.circle(cx, y + h * 0.093, 0.7, "F");
  doc.circle(cx, y + h * 0.907, 0.7, "F");

  /* Sentido del ataque: sin esto el campo se lee al revés. */
  fill(doc, mezcla("#FFFFFF", base, 0.4));
  doc.triangle(x + w - 11, y + 13, x + w - 7.5, y + 6, x + w - 4, y + 13, "F");

  doc.restoreGraphicsState();

  stroke(doc, C.borde, 0.6);
  doc.roundedRect(x, y, w, h, 5, 5, "S");

  if (!jugador.posCode) return;

  fuente(doc, 5.5, "bold");

  const anchoEtiqueta = ancho(doc, jugador.posCode) + 8;

  fill(doc, mezcla("#000000", base, 0.55));
  doc.roundedRect(x + 3, y + 3, anchoEtiqueta, 9, 2.5, 2.5, "F");

  ink(doc, mezcla("#FFFFFF", C.tintaMedia, 0.75));
  doc.text(jugador.posCode, x + 7, y + 9.4);
}

/*
|--------------------------------------------------------------------------
| TABLA DE TEMPORADAS
|--------------------------------------------------------------------------
| Una fila por temporada y todas a la vista, con las mismas columnas que la
| ficha de pantalla: lo que dice algo de un jugador no es su 2026/27 aislado,
| sino ver que pasó de 2.400 minutos a 600.
*/

function altoTemporadas(jugador: OncePdfPlayer) {
  const filas = Math.min(jugador.temporadas.length, TEMPORADAS_VISIBLES);

  /* Sin números no hay tabla, sino el aviso de que no los hay. */
  return filas ? TABLA_CABECERA + filas * TABLA_FILA : 46;
}

function dibujaTemporadas(
  doc: Doc,
  x: number,
  y: number,
  w: number,
  jugador: OncePdfPlayer,
) {
  const temporadas = jugador.temporadas.slice(0, TEMPORADAS_VISIBLES);

  if (!temporadas.length) {
    stroke(doc, C.borde, 0.5);
    doc.setLineDashPattern([2, 2], 0);
    doc.roundedRect(x, y, w, 46, 6, 6, "S");
    doc.setLineDashPattern([], 0);

    fuente(doc, 7, "normal");
    ink(doc, C.tintaTenue);

    const aviso = "Sin estadísticas de este jugador en BeSoccer.";

    doc.text(aviso, x + w / 2 - ancho(doc, aviso) / 2, y + 26);

    return;
  }

  const cols = columnasTemporada(jugador.portero);
  const destacada = highlightSeason(temporadas)?.temporada ?? null;

  const wTemporada = Math.min(112, w * 0.3);
  const paso = (w - wTemporada) / cols.length;

  /* ---------------- CABECERA ---------------- */

  fuente(doc, 5.5, "bold");
  ink(doc, C.tintaTenue);
  rotulo(doc, "TEMPORADA", x, y + 7, 0.8);

  cols.forEach((col, i) => {
    fuente(doc, 5.5, "bold");
    ink(doc, C.tintaTenue);

    const derecha = x + wTemporada + paso * (i + 1) - 4;

    doc.text(col.label.toUpperCase(), derecha - ancho(doc, col.label.toUpperCase()), y + 7);
  });

  stroke(doc, C.borde, 0.5);
  doc.line(x, y + TABLA_CABECERA - 2, x + w, y + TABLA_CABECERA - 2);

  /* ---------------- FILAS ---------------- */

  temporadas.forEach((season, fila) => {
    const top = y + TABLA_CABECERA - 2 + fila * TABLA_FILA;
    const actual = season.temporada === destacada;

    /* La temporada que manda se resalta, como la fila dorada de la ficha. */
    if (actual) {
      fill(doc, mezcla(C.oro, C.panelHondo, 0.09));
      doc.rect(x - 4, top + 1, w + 8, TABLA_FILA - 1, "F");
    }

    fuente(doc, 7, "bold");
    ink(doc, actual ? realza(C.oro, 0.15) : C.tintaMedia);
    doc.text(recorta(doc, season.temporada, wTemporada - 6), x, top + 8);

    if (season.equipos.length) {
      fuente(doc, 5, "normal");
      ink(doc, C.tintaTenue);

      doc.text(
        recorta(doc, season.equipos.join(" / "), wTemporada - 6),
        x,
        top + 13.5,
      );
    }

    cols.forEach((col, i) => {
      const derecha = x + wTemporada + paso * (i + 1) - 4;
      const valor = col.valor(season);

      /* El color sólo cuando hay algo que destacar: una columna de ceros en
         rojo y amarillo es ruido. */
      const vivo = col.color && valor !== "0" && valor !== "—";

      fuente(doc, 8, "bold");
      ink(doc, vivo && col.color ? realza(col.color, 0.1) : C.tinta);
      doc.text(valor, derecha - ancho(doc, valor), top + 8);

      const detalle = col.detalle?.(season);

      if (!detalle) return;

      fuente(doc, 5, "normal");
      ink(doc, C.tintaTenue);
      doc.text(detalle, derecha - ancho(doc, detalle), top + 13.5);
    });

    stroke(doc, C.bordeSuave, 0.4);
    doc.line(x, top + TABLA_FILA, x + w, top + TABLA_FILA);
  });
}

/*
|--------------------------------------------------------------------------
| FICHA DE JUGADOR
|--------------------------------------------------------------------------
| La ficha del pop-up llevada a la hoja: foto y dorsal, identidad, banda de
| datos, los dos botones vivos, el rendimiento y el análisis. El alto no es
| fijo: se calcula antes de pintar para saber si la tarjeta cabe entera en lo
| que queda de página y no partirla por la mitad.
*/

/** Los cuatro textos de análisis, en el orden en que se leen. */
function bloquesDe(jugador: OncePdfPlayer) {
  return [
    { titulo: "Fortalezas", texto: jugador.fortalezas, color: C.verde },
    { titulo: "Por dónde se le gana", texto: jugador.debilidades, color: C.rojo },
    { titulo: "Características", texto: jugador.caracteristicas, color: C.oro },
    { titulo: "Observaciones", texto: jugador.observaciones, color: C.tintaMedia },
  ].filter((bloque) => bloque.texto);
}

/** Ancho de cada una de las dos columnas de análisis. */
const COLUMNA_ANALISIS = (CONTENT_W - 28) / 2 - 6;

type FilaDatos = { dato: OncePdfDato; w: number }[];

/**
 * Reparte los cuadraditos de datos en filas, como el `flex-wrap` de la ficha.
 *
 * Cada uno mide lo que pida su contenido: "Pie · DCHO" no tiene por qué
 * ocupar lo mismo que "Procedencia · CD GUADALAJARA".
 */
function distribuyeDatos(doc: Doc, datos: OncePdfDato[], maxW: number) {
  const filas: FilaDatos[] = [];

  let fila: FilaDatos = [];
  let usado = 0;

  datos.forEach((dato) => {
    fuente(doc, 5, "bold");

    const anchoLabel = anchoRotulo(doc, dato.label, 0.6);

    fuente(doc, 8, "bold");

    const anchoValor = ancho(doc, dato.valor);
    const w = Math.min(maxW, Math.max(anchoLabel, anchoValor) + 16);

    if (fila.length && usado + w > maxW) {
      filas.push(fila);
      fila = [];
      usado = 0;
    }

    fila.push({ dato, w });
    usado += w + DATO_GAP;
  });

  if (fila.length) filas.push(fila);

  return filas;
}

type BloqueMedido = {
  titulo: string;
  color: string;
  lineas: string[];
};

type MedidasFicha = {
  alto: number;
  /** Filas de la banda de datos, ya repartidas. */
  filasDatos: FilaDatos[];
  bloques: BloqueMedido[];
  /** Desplazamientos desde el borde superior de la tarjeta. `null` si no hay. */
  yNombreCompleto: number | null;
  yDatos: number | null;
  yBotones: number;
  yRendimiento: number;
  altoRendimiento: number;
  yTags: number | null;
  yBloques: number | null;
};

/**
 * Dónde cae cada cosa dentro de la tarjeta, y cuánto mide en total.
 *
 * El alto se necesita antes de pintar —para saber si la tarjeta cabe entera en
 * lo que queda de hoja— y se calculaba aparte, en paralelo con el pintado. Dos
 * cuentas para lo mismo: en cuanto una tarjeta se quedaba corta de texto
 * sobraba un palmo de aire entre las etiquetas y los botones. Ahora la cuenta
 * es esta y `pintaFicha` sólo la sigue.
 */
function medidasFicha(doc: Doc, jugador: OncePdfPlayer): MedidasFicha {
  /* ---------------- CABECERA ---------------- */

  const mostrarCompleto =
    Boolean(jugador.nombreCompleto) &&
    jugador.nombreCompleto.toLowerCase() !== jugador.nombre.toLowerCase();

  const yNombreCompleto = mostrarCompleto ? 58 : null;

  const filasDatos = distribuyeDatos(doc, jugador.datos, CAB_W);

  const yDatos = filasDatos.length ? (mostrarCompleto ? 64 : 55) : null;

  const altoDatos = filasDatos.length
    ? filasDatos.length * (DATO_H + DATO_GAP) - DATO_GAP
    : 0;

  /* La foto marca el suelo de la cabecera: con pocos datos, la columna de la
     derecha termina antes que ella. */
  const finCabecera = Math.max(
    PAD + FOTO + PAD,
    (yDatos ?? (mostrarCompleto ? 62 : 52)) + altoDatos + 12,
  );

  /* ---------------- BOTONES Y RENDIMIENTO ---------------- */

  const yBotones = finCabecera;
  const yRendimiento = yBotones + 17 + 12;

  const altoRendimiento = 22 + Math.max(ZONA_H + 12, altoTemporadas(jugador)) + 12;

  let cursor = yRendimiento + altoRendimiento + 12;

  /* ---------------- ETIQUETAS ---------------- */

  const yTags = jugador.tags.length ? cursor + 8 : null;

  if (yTags !== null) cursor += 20;

  /* ---------------- ANÁLISIS ---------------- */

  const bloques: BloqueMedido[] = [];

  let yBloques: number | null = null;

  const crudos = bloquesDe(jugador);

  if (crudos.length) {
    yBloques = cursor + 4;

    fuente(doc, 7.5, "normal");

    crudos.forEach((bloque) => {
      const lineas: string[] = doc.splitTextToSize(
        bloque.texto,
        COLUMNA_ANALISIS,
      );

      bloques.push({
        titulo: bloque.titulo,
        color: bloque.color,
        lineas:
          lineas.length > MAX_LINEAS_BLOQUE
            ? [
                ...lineas.slice(0, MAX_LINEAS_BLOQUE - 1),
                `${lineas[MAX_LINEAS_BLOQUE - 1].trimEnd()}…`,
              ]
            : lineas,
      });
    });

    const altos = bloques.map((bloque) => 11 + bloque.lineas.length * 9.5 + 8);

    /* Van en dos columnas alternas: manda la que acabe más abajo. */
    const izquierda = altos
      .filter((_, i) => i % 2 === 0)
      .reduce((total, valor) => total + valor, 0);

    const derecha = altos
      .filter((_, i) => i % 2 === 1)
      .reduce((total, valor) => total + valor, 0);

    cursor = yBloques + Math.max(izquierda, derecha);
  }

  return {
    alto: cursor + 8,
    filasDatos,
    bloques,
    yNombreCompleto,
    yDatos,
    yBotones,
    yRendimiento,
    altoRendimiento,
    yTags,
    yBloques,
  };
}

/** Rótulo + párrafo con punto de color. Devuelve lo que ha crecido. */
function bloqueTexto(
  doc: Doc,
  x: number,
  y: number,
  titulo: string,
  lineas: string[],
  color: string,
) {
  fill(doc, color);
  doc.circle(x + 2, y - 2, 1.8, "F");

  fuente(doc, 5.5, "bold");
  ink(doc, realza(color, 0.15));
  rotulo(doc, titulo, x + 8, y, 0.9);

  fuente(doc, 7.5, "normal");
  ink(doc, C.tintaMedia);

  lineas.forEach((linea, i) => doc.text(linea, x, y + 11 + i * 9.5));

  return 11 + lineas.length * 9.5;
}

/** Silueta para el jugador sin foto, la misma que enseña la ficha vacía. */
function siluetaFoto(doc: Doc, x: number, y: number, lado: number) {
  const cx = x + lado / 2;

  fill(doc, mezcla(C.tintaTenue, C.panelHondo, 0.35));

  doc.circle(cx, y + lado * 0.38, lado * 0.13, "F");
  doc.roundedRect(
    cx - lado * 0.22,
    y + lado * 0.56,
    lado * 0.44,
    lado * 0.26,
    lado * 0.12,
    lado * 0.12,
    "F",
  );
}

function pintaFoto(
  doc: Doc,
  jugador: OncePdfPlayer,
  fotos: FotoCache,
  x: number,
  y: number,
) {
  const dataUrl = jugador.foto ? fotos.get(jugador.foto) : undefined;

  fill(doc, C.panelHondo);
  stroke(doc, C.borde, 0.6);
  doc.roundedRect(x, y, FOTO, FOTO, 9, 9, "FD");

  if (dataUrl) {
    doc.saveGraphicsState();
    doc.roundedRect(x, y, FOTO, FOTO, 9, 9, null);
    doc.clip();
    doc.discardPath();

    doc.addImage(dataUrl, "JPEG", x, y, FOTO, FOTO, jugador.foto);

    doc.restoreGraphicsState();

    stroke(doc, C.borde, 0.6);
    doc.roundedRect(x, y, FOTO, FOTO, 9, 9, "S");
  } else {
    siluetaFoto(doc, x, y, FOTO);
  }

  /* Dorsal en la esquina, dorado y sólido: es la chapa de la ficha. */
  if (!jugador.dorsal) return;

  fuente(doc, 9, "bold");

  const w = Math.max(19, ancho(doc, jugador.dorsal) + 12);
  const bx = x + FOTO - w + 7;
  const by = y + FOTO - 8;

  fill(doc, C.oro);
  doc.roundedRect(bx, by, w, 16, 8, 8, "F");

  ink(doc, C.fondo);
  doc.text(jugador.dorsal, bx + w / 2 - ancho(doc, jugador.dorsal) / 2, by + 11);
}

function pintaFicha(
  doc: Doc,
  jugador: OncePdfPlayer,
  fotos: FotoCache,
  y: number,
  medidas: MedidasFicha,
) {
  const { alto } = medidas;
  const x = MARGEN;
  const w = CONTENT_W;
  const color = estadoColor(jugador.estado);

  fill(doc, C.panel);
  stroke(doc, C.bordeSuave, 0.6);
  doc.roundedRect(x, y, w, alto, 8, 8, "FD");

  /* Filo del estado a la izquierda: recorre toda la tarjeta para distinguir
     un titular de una duda pasando las hojas deprisa. */
  fill(doc, color);
  doc.roundedRect(x, y + 8, 2.6, alto - 16, 1.3, 1.3, "F");

  /* ---------------- FOTO ---------------- */

  pintaFoto(doc, jugador, fotos, x + PAD, y + PAD);

  /* ---------------- IDENTIDAD ---------------- */

  const px = x + CAB_X;

  /* La chapa de estado va antes que el resto porque marca hasta dónde puede
     crecer la línea de la posición sin chocar con ella. */
  fuente(doc, 6.5, "bold");

  const anchoEstado = ancho(doc, ESTADO_LABEL[jugador.estado]) + 12;
  const topeCabecera = x + w - PAD - anchoEstado - 8;

  chapa(doc, ESTADO_LABEL[jugador.estado], x + w - PAD - anchoEstado, y + 14, {
    color,
    tamano: 6.5,
    padding: 6,
  });

  let cx = px;

  if (jugador.posCode) {
    cx += chapa(doc, jugador.posCode, cx, y + 16, {
      color: jugador.color,
      tamano: 6.5,
      padding: 6,
    }) + 6;
  }

  fuente(doc, 7.5, "normal");
  ink(doc, C.tintaMedia);

  const posicion = recorta(
    doc,
    jugador.posicion || "Sin posición",
    Math.max(0, topeCabecera - cx - 4),
  );

  doc.text(posicion, cx, y + 24);

  cx += ancho(doc, posicion) + 8;

  if (jugador.segunda) {
    fuente(doc, 6, "bold");

    if (cx + ancho(doc, jugador.segunda) + 12 <= topeCabecera) {
      cx += chapa(doc, jugador.segunda, cx, y + 16, {
        color: C.tintaTenue,
        tamano: 6,
        alto: 10,
        padding: 5,
      }) + 6;
    }
  }

  if (jugador.rol) {
    fuente(doc, 6.5, "bold");

    if (cx + ancho(doc, jugador.rol) + 12 <= topeCabecera) {
      chapa(doc, jugador.rol, cx, y + 15.5, {
        color: C.oro,
        tamano: 6.5,
        padding: 6,
      });
    }
  }

  /* Nombre: el enlace principal a la ficha del jugador. */
  fuente(doc, 14, "bold");
  ink(doc, C.tinta);

  const nombre = recorta(doc, jugador.nombre, x + w - PAD - px);

  doc.text(nombre, px, y + 46);

  if (jugador.ficha) {
    doc.link(px, y + 34, ancho(doc, nombre), 16, { url: jugador.ficha });
  }

  if (medidas.yNombreCompleto !== null) {
    fuente(doc, 7, "normal");
    ink(doc, C.tintaTenue);

    doc.text(
      recorta(doc, jugador.nombreCompleto, x + w - PAD - px),
      px,
      y + medidas.yNombreCompleto,
    );
  }

  /* ---------------- BANDA DE DATOS ---------------- */

  if (medidas.yDatos !== null) {
    let dy = y + medidas.yDatos;

    medidas.filasDatos.forEach((fila) => {
      let dx = px;

      fila.forEach(({ dato, w: anchoDato }) => {
        fill(doc, mezcla("#FFFFFF", C.panel, 0.03));
        stroke(doc, C.bordeSuave, 0.5);
        doc.roundedRect(dx, dy, anchoDato, DATO_H, 5, 5, "FD");

        fuente(doc, 5, "bold");
        ink(doc, C.tintaTenue);
        rotulo(doc, dato.label, dx + 8, dy + 8, 0.6);

        fuente(doc, 8, "bold");
        ink(doc, C.tinta);
        doc.text(recorta(doc, dato.valor, anchoDato - 14), dx + 8, dy + 17);

        dx += anchoDato + DATO_GAP;
      });

      dy += DATO_H + DATO_GAP;
    });
  }

  /* ---------------- BOTONES ---------------- */

  const by = y + medidas.yBotones;

  let bx = x + PAD;

  if (jugador.ficha) {
    bx +=
      botonEnlace(doc, BOTON_FICHA, jugador.ficha, bx, by, {
        color: C.oro,
        solido: true,
      }) + 7;
  }

  if (jugador.video) {
    bx +=
      botonEnlace(doc, BOTON_VIDEO, jugador.video, bx, by, {
        color: C.oro,
        play: true,
      }) + 7;
  }

  jugador.enlaces.forEach((enlace) => {
    fuente(doc, 7.5, "bold");

    if (bx + ancho(doc, enlace.label) + 26 > x + w - PAD) return;

    bx +=
      botonEnlace(doc, enlace.label, enlace.url, bx, by, {
        color: C.tintaMedia,
      }) + 7;
  });

  /* ---------------- RENDIMIENTO ---------------- */

  const ry = y + medidas.yRendimiento;
  const rw = w - PAD * 2;

  fill(doc, C.panelHondo);
  stroke(doc, C.bordeSuave, 0.6);
  doc.roundedRect(x + PAD, ry, rw, medidas.altoRendimiento, 7, 7, "FD");

  fuente(doc, 5.5, "bold");
  ink(doc, C.tintaTenue);
  rotulo(doc, "RENDIMIENTO", x + PAD + 12, ry + 14, 1.2);

  if (jugador.temporadas.length) {
    fuente(doc, 5.5, "normal");
    ink(doc, C.tintaTenue);

    doc.text("BeSoccer", x + w - PAD - 12 - ancho(doc, "BeSoccer"), ry + 14);
  }

  const zonaX = x + PAD + 12;
  const zonaY = ry + 22;

  dibujaZona(doc, zonaX, zonaY, ZONA_W, ZONA_H, jugador);

  /* El mapa no está medido y la ficha lo dice en voz alta; el PDF también. */
  fuente(doc, 4.8, "normal");
  ink(doc, C.tintaTenue);

  ["Zona estimada", "por posición"].forEach((linea, i) => {
    doc.text(
      linea,
      zonaX + ZONA_W / 2 - ancho(doc, linea) / 2,
      zonaY + ZONA_H + 5 + i * 5.4,
    );
  });

  dibujaTemporadas(
    doc,
    zonaX + ZONA_W + 16,
    zonaY,
    x + w - PAD - 12 - (zonaX + ZONA_W + 16),
    jugador,
  );

  /* ---------------- ETIQUETAS ---------------- */

  if (medidas.yTags !== null) {
    let tx = x + PAD - 1;

    jugador.tags.forEach((tag) => {
      fuente(doc, 6, "bold");

      const anchoChapa = ancho(doc, tag.label) + 10;

      /* Lo que no cabe en la fila se cae: son un resumen visual, y una
         segunda fila descuadraría el alto ya calculado. */
      if (tx + anchoChapa > x + w - PAD) return;

      chapa(doc, tag.label, tx, y + medidas.yTags! - 8, {
        color: tag.tone === "fortaleza" ? C.verde : C.rojo,
        tamano: 6,
        alto: 11,
        padding: 5,
      });

      tx += anchoChapa + 4;
    });
  }

  /* ---------------- ANÁLISIS ---------------- */

  if (medidas.yBloques === null) return;

  const cursores = [y + medidas.yBloques, y + medidas.yBloques];

  medidas.bloques.forEach((bloque, i) => {
    const columna = i % 2;
    const bloqueX = x + PAD + columna * (COLUMNA_ANALISIS + 12);

    cursores[columna] +=
      bloqueTexto(
        doc,
        bloqueX,
        cursores[columna],
        bloque.titulo,
        bloque.lineas,
        bloque.color,
      ) + 8;
  });
}

/*
|--------------------------------------------------------------------------
| PIE
|--------------------------------------------------------------------------
*/

function pies(doc: Doc, data: OncePdfData) {
  const total = doc.getNumberOfPages();

  for (let pagina = 1; pagina <= total; pagina += 1) {
    doc.setPage(pagina);

    stroke(doc, C.bordeSuave, 0.6);
    doc.line(MARGEN, PAGE_H - MARGEN - 12, PAGE_W - MARGEN, PAGE_H - MARGEN - 12);

    fuente(doc, 6.5, "normal");
    ink(doc, C.tintaTenue);

    doc.text(
      `Real Madrid Castilla · ${data.equipo} · Once probable · ${data.fecha}`,
      MARGEN,
      PAGE_H - MARGEN,
    );

    const paginacion = `${pagina} / ${total}`;

    doc.text(paginacion, PAGE_W - MARGEN - ancho(doc, paginacion), PAGE_H - MARGEN);

    /* Vuelta al campograma. Si desde el campo se salta a una ficha, tiene que
       haber camino de vuelta: en el móvil no hay botón «atrás» del visor que
       se encuentre a la primera. En la portada no se pinta, que ya se está. */
    if (pagina === 1) continue;

    fuente(doc, 6.5, "bold");
    ink(doc, realza(C.oro, 0.2));

    const volver = "Volver al once";
    const anchoVolver = ancho(doc, volver);
    const volverX = (PAGE_W - anchoVolver + 10) / 2;

    doc.text(volver, volverX, PAGE_H - MARGEN);

    /* Punta hacia arriba: la flecha no existe en WinAnsi, así que se pinta. */
    fill(doc, realza(C.oro, 0.2));

    const px = volverX - 10;
    const py = PAGE_H - MARGEN - 6.4;

    doc.triangle(px + 2.6, py, px, py + 4.6, px + 5.2, py + 4.6, "F");

    doc.link(volverX - 16, PAGE_H - MARGEN - 9, anchoVolver + 24, 13, {
      pageNumber: 1,
      top: 0,
    });
  }
}

/*
|--------------------------------------------------------------------------
| MONTAJE
|--------------------------------------------------------------------------
*/

function nombreArchivo(equipo: string) {
  const limpio = equipo
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 40);

  const hoy = new Date();

  const sello = [
    hoy.getFullYear(),
    String(hoy.getMonth() + 1).padStart(2, "0"),
    String(hoy.getDate()).padStart(2, "0"),
  ].join("-");

  return `once-probable_${limpio || "rival"}_${sello}.pdf`;
}

export async function buildOncePdf(data: OncePdfData) {
  const { jsPDF } = await import("jspdf");

  /* El tema, lo primero de todo: manda sobre cada trazo del documento y
     también sobre el fondo con el que se recortan las fotos. */
  C = data.tema === "light" ? PALETA_DIA : PALETA_NOCHE;

  /* Las fotos después: son lo único del documento que hay que ir a buscar
     fuera, y con jsPDF ya cargado tardan lo mismo. */
  const fotos = await cargaFotos(data.jugadores);

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: "a4",
    compress: true,
  });

  doc.setProperties({
    title: `Once probable · ${data.equipo}`,
    subject: "Scouting rival · Real Madrid Castilla",
    creator: "RMCF Castilla",
  });

  const titulares = data.jugadores.filter((jugador) => jugador.estado === "titular");
  const dudas = data.jugadores.filter((jugador) => jugador.estado === "duda");

  /* ---------------- PORTADA ---------------- */

  fondoPagina(doc);

  const campoY = cabecera(doc, data, titulares.length, dudas.length) + 18;

  dibujaCampo(doc, MARGEN, campoY, CAMPO_W, CAMPO_H);

  /*
  | Los saltos de la portada se apuntan aquí mientras se pinta el campo y la
  | lista, y se escriben al final: hasta que no están montadas las fichas no
  | se sabe en qué página cae cada jugador.
  */
  const saltos: {
    clave: string;
    x: number;
    y: number;
    w: number;
    h: number;
  }[] = [];

  const ancla: Ancla = (clave, x, y, w, h) => saltos.push({ clave, x, y, w, h });

  const porLinea = new Map<OncePdfLinea, OncePdfPlayer[]>();

  LINEA_ORDEN.forEach((linea) => {
    porLinea.set(
      linea,
      reparteLinea(titulares.filter((jugador) => jugador.linea === linea)),
    );
  });

  LINEA_ORDEN.forEach((linea) => {
    const jugadores = porLinea.get(linea) ?? [];

    if (!jugadores.length) return;

    const util = CAMPO_W - 26;
    const paso = util / jugadores.length;
    const cy = campoY + CAMPO_H * LINEA_Y[linea];

    jugadores.forEach((jugador, i) => {
      pintaJugadorEnCampo(
        doc,
        jugador,
        fotos,
        MARGEN + 13 + paso * (i + 0.5),
        cy,
        Math.min(paso - 4, 78),
        ancla,
      );
    });
  });

  /* Un titular con la posición vacía o irreconocible no tiene sitio en el
     campo, pero tampoco puede desaparecer del documento: sale en la columna
     de la derecha y tiene su ficha como los demás. */
  const sinLinea = titulares.filter((jugador) => jugador.linea === null);

  columnaResumen(doc, campoY, porLinea, sinLinea, dudas, ancla);

  /* ---------------- FICHAS ---------------- */

  const enOrden = [
    ...LINEA_ORDEN.flatMap((linea) => porLinea.get(linea) ?? []),
    ...sinLinea,
    ...dudas,
  ];

  /* Dónde ha acabado la ficha de cada jugador: la página y el alto por el que
     tiene que quedarse el visor al llegar. Es el destino de los saltos. */
  const destinos = new Map<string, { pagina: number; top: number }>();

  if (enOrden.length) {
    doc.addPage();
    fondoPagina(doc);

    fuente(doc, 6.5, "bold");
    ink(doc, C.oro);
    rotulo(doc, "FICHAS DEL ONCE PROBABLE", MARGEN, MARGEN + 8, 1.6);

    fuente(doc, 7, "normal");
    ink(doc, C.tintaTenue);

    const ayuda = `«${BOTON_FICHA}» abre al jugador en la app · «${BOTON_VIDEO}», su vídeo de YouTube`;

    doc.text(ayuda, PAGE_W - MARGEN - ancho(doc, ayuda), MARGEN + 8);

    stroke(doc, C.borde, 0.7);
    doc.line(MARGEN, MARGEN + 16, PAGE_W - MARGEN, MARGEN + 16);

    let cursor = MARGEN + 28;

    enOrden.forEach((jugador) => {
      const medidas = medidasFicha(doc, jugador);

      if (cursor + medidas.alto > FONDO_PAGINA) {
        doc.addPage();
        fondoPagina(doc);

        cursor = MARGEN + 10;
      }

      destinos.set(jugador.clave, {
        pagina: doc.getCurrentPageInfo().pageNumber,
        /* Un poco por encima del borde de la tarjeta: si se cuadra al pixel,
           el visor deja la ficha pegada al filo de la pantalla. */
        top: Math.max(0, cursor - 14),
      });

      pintaFicha(doc, jugador, fotos, cursor, medidas);

      cursor += medidas.alto + 10;
    });
  }

  /*
  | Ahora sí: se vuelve a la portada y se escriben los saltos. Un jugador sin
  | ficha montada —no debería pasar, pero el documento no puede quedarse con
  | una zona muerta— se queda con el enlace a la app, que es lo que había.
  */
  if (saltos.length) {
    const ultima = doc.getCurrentPageInfo().pageNumber;

    doc.setPage(1);

    saltos.forEach((salto) => {
      const destino = destinos.get(salto.clave);

      if (destino) {
        doc.link(salto.x, salto.y, salto.w, salto.h, {
          pageNumber: destino.pagina,
          top: destino.top,
        });

        return;
      }

      const jugador = data.jugadores.find((item) => item.clave === salto.clave);

      if (jugador?.ficha) {
        doc.link(salto.x, salto.y, salto.w, salto.h, { url: jugador.ficha });
      }
    });

    doc.setPage(ultima);
  }

  pies(doc, data);

  return { doc, nombre: nombreArchivo(data.equipo) };
}

/** Genera el PDF y lo descarga. Devuelve el nombre del archivo. */
export async function exportOncePdf(data: OncePdfData) {
  const { doc, nombre } = await buildOncePdf(data);

  doc.save(nombre);

  return nombre;
}
