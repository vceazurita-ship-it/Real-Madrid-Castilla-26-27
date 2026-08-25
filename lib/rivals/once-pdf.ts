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
| El módulo **no sabe nada de la hoja ni del estado de la página**: recibe a
| los jugadores ya resueltos (posición, etiquetas, estadísticas y enlaces) y
| sólo se ocupa de pintarlos. Quien los prepara es `app/rivals/page.tsx`, que
| es donde viven el catálogo de etiquetas y la clasificación por líneas.
*/

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

export type OncePdfPlayer = {
  /** Sólo para ordenar y depurar; no se pinta. */
  clave: string;
  dorsal: string;
  /** Nombre deportivo: el que se lee en el campograma. */
  nombre: string;
  /** Código corto de la posición (POR, DFC, MP…). */
  posCode: string;
  /** La posición tal y como está escrita en la hoja. */
  posicion: string;
  /** Segunda posición ya formateada ("2ª LI"), si aporta algo. */
  segunda: string;
  linea: OncePdfLinea | null;
  /** Color de la línea, en hexadecimal. */
  color: string;
  estado: OncePdfEstado;
  /** Edad, altura, pie… ya limpios y en el orden en que se leen. */
  datos: string[];
  /** Partidos, minutos, goles… ya formateados ("18 PJ", "1.240 min"). */
  stats: string[];
  tags: OncePdfTag[];
  caracteristicas: string;
  fortalezas: string;
  debilidades: string;
  observaciones: string;
  /** Ficha, vídeo, informe… El primero es el que lleva el nombre. */
  enlaces: OncePdfEnlace[];
};

export type OncePdfData = {
  equipo: string;
  /** "25 de agosto de 2026". */
  fecha: string;
  jugadores: OncePdfPlayer[];
};

/*
|--------------------------------------------------------------------------
| PALETA
|--------------------------------------------------------------------------
| La misma de la app, resuelta a color sólido: las capas translúcidas se
| mezclan aquí contra su fondo y se pintan ya planas. Un PDF lleno de
| transparencias pesa más, tarda en abrirse en el móvil y algunos visores lo
| imprimen mal.
*/

const C = {
  fondo: "#0B0F14",
  panel: "#131A22",
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
  lineaCampo: "#33463C",
};

const ESTADO_COLOR: Record<OncePdfEstado, string> = {
  titular: C.verde,
  duda: C.ambar,
};

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
function mezcla(color: string, fondo: string, alfa: number): RGB {
  const frente = hexToRgb(color);
  const detras = hexToRgb(fondo);

  return [
    Math.round(frente[0] * alfa + detras[0] * (1 - alfa)),
    Math.round(frente[1] * alfa + detras[1] * (1 - alfa)),
    Math.round(frente[2] * alfa + detras[2] * (1 - alfa)),
  ];
}

/**
 * Aclara un color hasta que se lea sobre fondo oscuro.
 *
 * Los colores de línea están pensados para chapas con fondo translúcido; en
 * texto plano sobre el panel algunos —el azul de la defensa— se quedan justos.
 */
function aclara(color: string, cantidad: number): RGB {
  const [r, g, b] = hexToRgb(color);

  return [
    Math.round(r + (255 - r) * cantidad),
    Math.round(g + (255 - g) * cantidad),
    Math.round(b + (255 - b) * cantidad),
  ];
}

/*
|--------------------------------------------------------------------------
| DIBUJO
|--------------------------------------------------------------------------
| De jsPDF se usa una porción pequeña y siempre igual, así que estos cuatro
| ayudantes evitan repetir la conversión de color en cada trazo.
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

  ink(doc, aclara(color, 0.25));
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

  fill(doc, mezcla("#FFFFFF", C.cesped, 0.025));

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

/** Izquierda 0, centro 1, derecha 2. Sale del código corto de la posición. */
function ladoDe(posCode: string) {
  if (/I$/.test(posCode)) return 0;
  if (/D$/.test(posCode)) return 2;

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

function pintaJugadorEnCampo(
  doc: Doc,
  jugador: OncePdfPlayer,
  cx: number,
  cy: number,
  hueco: number,
) {
  const radio = 13;
  const color = ESTADO_COLOR[jugador.estado];

  /* Aro exterior del estado: verde continuo el titular, ámbar discontinuo la
     duda. Se distinguen incluso impresos en blanco y negro. */
  fill(doc, mezcla(jugador.color, C.cesped, 0.32));
  stroke(doc, color, 1.3);

  if (jugador.estado === "duda") doc.setLineDashPattern([2, 1.8], 0);

  doc.circle(cx, cy, radio, "FD");
  doc.setLineDashPattern([], 0);

  fuente(doc, 10, "bold");
  ink(doc, C.tinta);

  const dorsal = jugador.dorsal || "—";

  doc.text(dorsal, cx - ancho(doc, dorsal) / 2, cy + 3.4);

  fuente(doc, 7, "bold");
  ink(doc, C.tinta);

  const nombre = recorta(doc, jugador.nombre, hueco);

  doc.text(nombre, cx - ancho(doc, nombre) / 2, cy + radio + 11);

  fuente(doc, 5.5, "normal");
  ink(doc, aclara(jugador.color, 0.2));

  const pos = recorta(doc, jugador.posCode || jugador.posicion, hueco);

  doc.text(pos, cx - ancho(doc, pos) / 2, cy + radio + 19);

  /* El enlace cubre la chapa entera, no sólo el nombre: en el móvil hay que
     poder acertar con el dedo. */
  const enlace = jugador.enlaces[0];

  if (enlace) {
    doc.link(cx - radio, cy - radio, radio * 2, radio * 2 + 21, {
      url: enlace.url,
    });
  }
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

  const contadores = [{ texto: `${titulares} TITULARES`, color: C.verde }];

  if (dudas > 0) contadores.push({ texto: `${dudas} DUDAS`, color: C.ambar });

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

/** Lista compacta del once, por líneas, a la derecha del campo. */
function columnaResumen(
  doc: Doc,
  y: number,
  porLinea: Map<OncePdfLinea, OncePdfPlayer[]>,
  sinLinea: OncePdfPlayer[],
  dudas: OncePdfPlayer[],
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
      fill(doc, aclara(jugador.color, 0.1));
      doc.circle(x + 14, fy - 2.6, 2.1, "F");

      fuente(doc, 7.5, "bold");
      ink(doc, C.tintaMedia);
      doc.text(jugador.dorsal || "—", x + 21, fy);

      fuente(doc, 7.5, "normal");
      ink(doc, C.tinta);
      doc.text(recorta(doc, jugador.nombre, w - 66), x + 38, fy);

      fuente(doc, 5.5, "normal");
      ink(doc, C.tintaTenue);
      doc.text(jugador.posCode, x + w - 12 - ancho(doc, jugador.posCode), fy);

      const enlace = jugador.enlaces[0];

      if (enlace) doc.link(x + 8, fy - 9, w - 16, 12, { url: enlace.url });

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
      fuente(doc, 7.5, "bold");
      ink(doc, aclara(C.ambar, 0.15));
      doc.text(jugador.dorsal || "—", x + 12, dy);

      fuente(doc, 7.5, "normal");
      ink(doc, C.tinta);
      doc.text(recorta(doc, jugador.nombre, w - 58), x + 30, dy);

      fuente(doc, 5.5, "normal");
      ink(doc, C.tintaTenue);
      doc.text(jugador.posCode, x + w - 12 - ancho(doc, jugador.posCode), dy);

      const enlace = jugador.enlaces[0];

      if (enlace) doc.link(x + 8, dy - 9, w - 16, 12, { url: enlace.url });

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
    "Los nombres y los botones de cada ficha son enlaces: ábrelos para ir al jugador o a su vídeo.",
    w - 24,
  );

  const altoLeyenda = 30 + leyenda.length * 12 + 6 + nota.length * 7.5 + 8;

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

  fuente(doc, 6, "italic");
  ink(doc, C.tintaTenue);

  nota.forEach((linea, i) => doc.text(linea, x + 12, ly + 4 + i * 7.5));
}

/*
|--------------------------------------------------------------------------
| FICHA DE JUGADOR
|--------------------------------------------------------------------------
| Una tarjeta por jugador, con el análisis en dos columnas y los enlaces
| abajo. El alto no es fijo: se calcula antes de pintar para saber si la
| tarjeta cabe entera en lo que queda de hoja y no partirla por la mitad.
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

type MedidasFicha = {
  alto: number;
  bloques: ReturnType<typeof bloquesDe>;
  /** Desplazamientos desde el borde superior de la tarjeta. `null` si no hay. */
  yStats: number | null;
  yTags: number | null;
  yBloques: number | null;
  yEnlaces: number | null;
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
  const bloques = bloquesDe(jugador);

  /* Cabecera (dorsal, nombre, chapas) y línea de datos. */
  let cursor = 52;

  const yStats = jugador.stats.length ? cursor : null;

  if (yStats !== null) cursor += 12;

  const yTags = jugador.tags.length ? cursor : null;

  if (yTags !== null) cursor += 16;

  let yBloques: number | null = null;

  if (bloques.length) {
    yBloques = cursor + 4;

    fuente(doc, 7.5, "normal");

    const altos = bloques.map(
      (bloque) =>
        11 + doc.splitTextToSize(bloque.texto, COLUMNA_ANALISIS).length * 9.5 + 8,
    );

    /* Van en dos columnas alternas: manda la que acabe más abajo. */
    const izquierda = altos
      .filter((_, i) => i % 2 === 0)
      .reduce((total, valor) => total + valor, 0);

    const derecha = altos
      .filter((_, i) => i % 2 === 1)
      .reduce((total, valor) => total + valor, 0);

    cursor = yBloques + Math.max(izquierda, derecha);
  }

  const yEnlaces = jugador.enlaces.length ? cursor + 2 : null;

  if (yEnlaces !== null) cursor += 20;

  /* El mínimo deja respirar a la cabecera cuando el jugador no trae nada más
     que el nombre: sin él la chapa del dorsal tocaría el borde. */
  return {
    alto: Math.max(cursor + 8, 62),
    bloques,
    yStats,
    yTags,
    yBloques,
    yEnlaces,
  };
}

/** Rótulo + párrafo con punto de color. Devuelve lo que ha crecido. */
function bloqueTexto(
  doc: Doc,
  x: number,
  y: number,
  w: number,
  titulo: string,
  texto: string,
  color: string,
) {
  fill(doc, color);
  doc.circle(x + 2, y - 2, 1.8, "F");

  fuente(doc, 5.5, "bold");
  ink(doc, aclara(color, 0.15));
  rotulo(doc, titulo, x + 8, y, 0.9);

  fuente(doc, 7.5, "normal");
  ink(doc, C.tintaMedia);

  const lineas: string[] = doc.splitTextToSize(texto, w);

  lineas.forEach((linea, i) => doc.text(linea, x, y + 11 + i * 9.5));

  return 11 + lineas.length * 9.5;
}

function pintaFicha(
  doc: Doc,
  jugador: OncePdfPlayer,
  y: number,
  medidas: MedidasFicha,
) {
  const { alto } = medidas;
  const x = MARGEN;
  const w = CONTENT_W;
  const color = ESTADO_COLOR[jugador.estado];

  fill(doc, C.panel);
  stroke(doc, C.bordeSuave, 0.6);
  doc.roundedRect(x, y, w, alto, 8, 8, "FD");

  /* Filo del estado a la izquierda: recorre toda la tarjeta para distinguir
     un titular de una duda pasando las hojas deprisa. */
  fill(doc, color);
  doc.roundedRect(x, y + 8, 2.6, alto - 16, 1.3, 1.3, "F");

  /* ---------------- CABECERA ---------------- */

  const dorsalX = x + 14;

  fill(doc, mezcla(jugador.color, C.panel, 0.22));
  stroke(doc, mezcla(jugador.color, C.panel, 0.5), 0.6);
  doc.roundedRect(dorsalX, y + 12, 26, 26, 6, 6, "FD");

  fuente(doc, 12, "bold");
  ink(doc, aclara(jugador.color, 0.35));

  const dorsal = jugador.dorsal || "—";

  doc.text(dorsal, dorsalX + 13 - ancho(doc, dorsal) / 2, y + 29.5);

  /* Las chapas de la derecha se colocan antes que el nombre porque marcan
     hasta dónde puede crecer el nombre sin chocar con ellas. */
  let chapaX = x + w - 12;

  fuente(doc, 6.5, "bold");
  chapaX -= ancho(doc, ESTADO_LABEL[jugador.estado]) + 12;

  chapa(doc, ESTADO_LABEL[jugador.estado], chapaX, y + 15, {
    color,
    tamano: 6.5,
    padding: 6,
  });

  if (jugador.posCode) {
    fuente(doc, 6.5, "bold");
    chapaX -= ancho(doc, jugador.posCode) + 12 + 5;

    chapa(doc, jugador.posCode, chapaX, y + 15, {
      color: jugador.color,
      tamano: 6.5,
      padding: 6,
    });
  }

  /* Nombre: es el enlace principal a la ficha del jugador. */
  const nombreX = dorsalX + 36;

  fuente(doc, 12.5, "bold");
  ink(doc, C.tinta);

  const nombre = recorta(doc, jugador.nombre, chapaX - nombreX - 10);

  doc.text(nombre, nombreX, y + 27);

  const enlaceFicha = jugador.enlaces[0];

  if (enlaceFicha) {
    doc.link(nombreX, y + 16, ancho(doc, nombre), 14, { url: enlaceFicha.url });
  }

  /* Línea de datos: posición larga, segunda posición, edad, altura, pie… */
  const meta = [jugador.posicion, jugador.segunda, ...jugador.datos].filter(Boolean);

  fuente(doc, 7, "normal");
  ink(doc, C.tintaTenue);
  doc.text(recorta(doc, meta.join("  ·  "), w - 70), nombreX, y + 38);

  /* ---------------- ESTADÍSTICAS ---------------- */

  if (medidas.yStats !== null) {
    fuente(doc, 7, "bold");
    ink(doc, aclara(C.oro, 0.1));

    doc.text(
      recorta(doc, jugador.stats.join("   ·   "), w - 28),
      x + 14,
      y + medidas.yStats,
    );
  }

  /* ---------------- ETIQUETAS ---------------- */

  if (medidas.yTags !== null) {
    let tx = x + 13;

    jugador.tags.forEach((tag) => {
      fuente(doc, 6, "bold");

      const anchoChapa = ancho(doc, tag.label) + 10;

      /* Lo que no cabe en la fila se cae: son un resumen visual, y una
         segunda fila descuadraría el alto ya calculado. */
      if (tx + anchoChapa > x + w - 12) return;

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

  if (medidas.yBloques !== null) {
    const cursores = [y + medidas.yBloques, y + medidas.yBloques];

    medidas.bloques.forEach((bloque, i) => {
      const columna = i % 2;
      const bx = x + 14 + columna * (COLUMNA_ANALISIS + 12);

      cursores[columna] +=
        bloqueTexto(
          doc,
          bx,
          cursores[columna],
          COLUMNA_ANALISIS,
          bloque.titulo,
          bloque.texto,
          bloque.color,
        ) + 8;
    });
  }

  /* ---------------- ENLACES ---------------- */

  if (medidas.yEnlaces !== null) {
    const by = y + medidas.yEnlaces;

    let bx = x + 14;

    jugador.enlaces.forEach((enlace) => {
      fuente(doc, 7, "bold");

      const anchoBoton = ancho(doc, enlace.label) + 26;

      if (bx + anchoBoton > x + w - 12) return;

      fill(doc, mezcla(C.oro, C.panel, 0.12));
      stroke(doc, mezcla(C.oro, C.panel, 0.45), 0.6);
      doc.roundedRect(bx, by, anchoBoton, 16, 8, 8, "FD");

      ink(doc, aclara(C.oro, 0.2));
      doc.text(enlace.label, bx + 9, by + 11);

      flechaExterna(doc, bx + anchoBoton - 13, by + 5, 5, aclara(C.oro, 0.2));

      doc.link(bx, by, anchoBoton, 16, { url: enlace.url });

      bx += anchoBoton + 6;
    });
  }
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
        MARGEN + 13 + paso * (i + 0.5),
        cy,
        Math.min(paso - 4, 78),
      );
    });
  });

  /* Un titular con la posición vacía o irreconocible no tiene sitio en el
     campo, pero tampoco puede desaparecer del documento: sale en la columna
     de la derecha y tiene su ficha como los demás. */
  const sinLinea = titulares.filter((jugador) => jugador.linea === null);

  columnaResumen(doc, campoY, porLinea, sinLinea, dudas);

  /* ---------------- FICHAS ---------------- */

  const enOrden = [
    ...LINEA_ORDEN.flatMap((linea) => porLinea.get(linea) ?? []),
    ...sinLinea,
    ...dudas,
  ];

  if (enOrden.length) {
    doc.addPage();
    fondoPagina(doc);

    fuente(doc, 6.5, "bold");
    ink(doc, C.oro);
    rotulo(doc, "FICHAS DEL ONCE PROBABLE", MARGEN, MARGEN + 8, 1.6);

    fuente(doc, 7, "normal");
    ink(doc, C.tintaTenue);

    const ayuda = "Toca el nombre o los botones para abrir la ficha y los vídeos";

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

      pintaFicha(doc, jugador, cursor, medidas);

      cursor += medidas.alto + 10;
    });
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
