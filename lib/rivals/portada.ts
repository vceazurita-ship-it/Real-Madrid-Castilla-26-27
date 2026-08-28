/*
|--------------------------------------------------------------------------
| PORTADA DEL JUGADOR RIVAL
|--------------------------------------------------------------------------
|
| La primera diapositiva de un análisis individual: escudo del rival, cara del
| jugador y "ANÁLISIS INDIVIDUAL" a toda página. Es la portada que se pone
| delante del vídeo o del informe cuando se presenta a un jugador del rival, y
| hasta ahora se montaba a mano en PowerPoint copiando
| `public/INDIVIDUAL.pptx` y cambiando escudo, foto y nombre uno por uno.
|
| Se respeta la plantilla —proporción 16:9, papel blanco, Barlow Condensed,
| verde 1B3A2E y azul 0F1E3D, el filo rosa bajo la cabecera y las dos chapas
| del pie—, y se le añade lo que la plantilla no podía tener porque se hacía a
| mano:
|
| - El escudo del rival sale entero y a 500 px, no recortado por la esquina.
| - La foto se desvanece contra el papel en vez de cortarse a cuchillo.
| - Una franja con los números de la temporada que manda, que es lo que hace
|   que la portada diga algo del jugador y no sólo cómo se llama.
| - El nombre completo y la firma del pie, para que se sepa de dónde sale la
|   diapositiva cuando circule suelta.
|
| Se pinta en un `<canvas>` de 1920×1080 y se multiplica por `ESCALA` para que
| aguante una proyección: el mismo lienzo sirve para el PNG que se pega en una
| diapositiva y para el PDF de una hoja apaisada.
|
| Como `once-pdf`, el módulo **no sabe nada de la hoja ni del estado de la
| página**: recibe al jugador ya resuelto y sólo lo pinta.
*/

import { esperaFuentePortada, FAMILIA_PORTADA } from "@/lib/rivals/portada-font";

import {
  columnasTemporada,
  type ColumnaTemporada,
} from "@/lib/rivals/stats-table";

import type { RivalSeasonStats } from "@/lib/rivals/stats";

/** Un número de la franja de rendimiento ("PARTIDOS · 38"). */
export type PortadaMetrica = {
  label: string;
  valor: string;
};

export type PortadaData = {
  /** Nombre del club rival, tal y como lo escribe la hoja. */
  equipo: string;
  /** Escudo del club. Sin él, la cabecera se queda sin la esquina. */
  escudo?: string;
  /** "26 / 27". */
  temporada: string;
  /** Nombre deportivo: el de la chapa. */
  nombre: string;
  /** Nombre completo. Sólo se pinta si añade algo al anterior. */
  nombreCompleto?: string;
  /** Posición escrita entera ("MEDIAPUNTA"). */
  posicion: string;
  /** "Diestro", "Zurdo" o "Ambidiestro", tal y como lo escribe la hoja. */
  pieDominante?: string;
  /** Estatura, tal y como la escribe la hoja: "1,84" o "184 cm". */
  altura?: string;
  /** Años cumplidos, tal y como los escribe la hoja. */
  edad?: string;
  /** Kilos, tal y como los escribe la hoja: "78" o "78 kg". */
  peso?: string;
  dorsal: string;
  /** Retrato del jugador. Sin él queda la silueta. */
  foto?: string;
  /** "2025/26 · Huesca", el encabezado de la franja de números. */
  contexto?: string;
  /** Hasta seis; con menos, la franja se estrecha sola. */
  metricas?: PortadaMetrica[];
};

/*
|--------------------------------------------------------------------------
| MEDIDAS Y PALETA
|--------------------------------------------------------------------------
| El lienzo es el de la plantilla: 12192000×6858000 EMU son 1920×1080 px a
| 6350 EMU por píxel, y en esa cuenta un punto de PowerPoint son dos píxeles.
| Por eso los tamaños de letra son los de la plantilla multiplicados por dos.
*/

const W = 1920;
const H = 1080;

/** Margen lateral: los 616306 EMU donde empieza el filo rosa. */
const MARGEN = 97;

/*
| La franja de números vive bajo el titular, a la izquierda, y lo que le sobra
| a la derecha es el hueco de las dos chapas del jugador. Las dos medidas se
| declaran juntas porque son las dos caras del mismo reparto.
*/
const FRANJA_X = 90;
const FRANJA_W = 920;

/*
| A cuánto se multiplica el lienzo. Con 2 el PNG sale a 3840×2160, que es lo
| que pide una portada proyectada en 4K; por encima, Chrome empieza a
| devolver lienzos en blanco en portátiles con poca memoria de vídeo.
*/
const ESCALA = 2;

/* La hoja del PDF: 13,33 × 7,5 pulgadas, la diapositiva 16:9 de PowerPoint. */
const PDF_W = 960;
const PDF_H = 540;

const C = {
  papel: "#FFFFFF",
  verde: "#1B3A2E",
  navy: "#0F1E3D",
  crema: "#F7F4EC",
  rosa: "#F6AFB6",
  rosaHondo: "#D89AA6",
};

type Ctx = CanvasRenderingContext2D;

/*
|--------------------------------------------------------------------------
| TEXTO
|--------------------------------------------------------------------------
*/

function fuente(ctx: Ctx, px: number, peso: 500 | 600 | 700 = 700) {
  ctx.font = `${peso} ${px}px ${FAMILIA_PORTADA}`;
}

/*
| Texto con espaciado entre letras.
|
| `ctx.letterSpacing` existe pero es reciente y no lo tiene todo el mundo, y
| aquí el espaciado no es un adorno: las chapas se dimensionan con el ancho
| del texto, así que si el navegador lo ignora la píldora sale corta y la
| letra se sale por los lados. Pintando letra a letra el ancho es el que se ha
| medido, siempre.
*/
function anchoEspaciado(ctx: Ctx, texto: string, espaciado: number) {
  if (!texto) return 0;

  return (
    [...texto].reduce((total, letra) => total + ctx.measureText(letra).width, 0) +
    espaciado * (texto.length - 1)
  );
}

function textoEspaciado(
  ctx: Ctx,
  texto: string,
  x: number,
  y: number,
  espaciado: number,
) {
  let cursor = x;

  for (const letra of texto) {
    ctx.fillText(letra, cursor, y);
    cursor += ctx.measureText(letra).width + espaciado;
  }

  return cursor - x - espaciado;
}

/**
 * Baja el cuerpo de letra hasta que el texto quepa.
 *
 * "ANÁLISIS" cabe a 260 px porque tiene ocho letras; un nombre largo en la
 * chapa, no. Antes que recortar con puntos suspensivos —que en una portada
 * queda a medio hacer— se encoge, que es lo que haría cualquiera a mano.
 */
function ajusta(
  ctx: Ctx,
  texto: string,
  maxW: number,
  desde: number,
  peso: 500 | 600 | 700,
  espaciado = 0,
) {
  let px = desde;

  fuente(ctx, px, peso);

  while (px > 12 && anchoEspaciado(ctx, texto, espaciado) > maxW) {
    px -= 1;
    fuente(ctx, px, peso);
  }

  return px;
}

/*
|--------------------------------------------------------------------------
| FORMAS
|--------------------------------------------------------------------------
*/

function rectRedondo(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  radio: number,
) {
  const r = Math.min(radio, w / 2, h / 2);

  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

/**
 * Una chapa de la plantilla: rectángulo de esquinas redondas del todo con el
 * texto centrado. Devuelve lo que ha medido, para poder encadenarlas.
 */
function chapa(
  ctx: Ctx,
  texto: string,
  opciones: {
    x: number;
    y: number;
    alto: number;
    fondo: string;
    tinta: string;
    tamano: number;
    espaciado: number;
    /** Aire a cada lado del texto. */
    padding: number;
    anchoMin?: number;
    /**
     * Tope de ancho. La chapa crece con su texto, y "MEDIO CENTRO DEFENSIVO ·
     * Nº14" la estira hasta meterse encima de la franja de números; con tope,
     * la letra baja de cuerpo hasta que la píldora cabe.
     */
    anchoMax?: number;
    /** `x` es el borde derecho, no el izquierdo. */
    desdeDerecha?: boolean;
    /** Devuelve lo que mediría sin pintar nada. */
    soloMide?: boolean;
  },
) {
  const {
    x,
    y,
    alto,
    fondo,
    tinta,
    tamano,
    espaciado,
    padding,
    anchoMin = 0,
    anchoMax,
    desdeDerecha = false,
    soloMide = false,
  } = opciones;

  let cuerpo = tamano;

  fuente(ctx, cuerpo, 600);

  let anchoTexto = anchoEspaciado(ctx, texto, espaciado);

  while (
    anchoMax !== undefined &&
    cuerpo > 12 &&
    anchoTexto + padding * 2 > anchoMax
  ) {
    cuerpo -= 1;
    fuente(ctx, cuerpo, 600);
    anchoTexto = anchoEspaciado(ctx, texto, espaciado);
  }

  const ancho = Math.max(anchoMin, anchoTexto + padding * 2);

  if (soloMide) return ancho;

  const izquierda = desdeDerecha ? x - ancho : x;

  ctx.fillStyle = fondo;
  rectRedondo(ctx, izquierda, y, ancho, alto, alto / 2);
  ctx.fill();

  ctx.fillStyle = tinta;

  /* Centrado óptico: la Barlow Condensed en versales apoya la mitad del ojo
     algo por encima de la línea media de la caja. */
  textoEspaciado(
    ctx,
    texto,
    izquierda + (ancho - anchoTexto) / 2,
    y + alto / 2 + cuerpo * 0.35,
    espaciado,
  );

  return ancho;
}

/*
|--------------------------------------------------------------------------
| IMÁGENES
|--------------------------------------------------------------------------
| Las de BeSoccer no traen cabeceras CORS: leídas a pelo contaminan el lienzo
| y `toBlob()` revienta. Pasan por `/api/rivals/foto`, igual que en el PDF del
| once.
*/

async function cargaImagen(url: string) {
  /*
  | Lo que ya es de casa no pasa por el proxy: el escudo del club y las fotos
  | de nuestros jugadores se sirven desde esta misma app, y el proxy sólo
  | admite `https` de una lista de dominios, así que una ruta como
  | `/players/mestre.png` se quedaba sin cargar. Esto lo usa la portada del
  | jugador propio que abre los vídeos unificados del coding.
  */
  const deCasa =
    url.startsWith("/") ||
    url.startsWith("data:") ||
    url.startsWith("blob:") ||
    (typeof window !== "undefined" && url.startsWith(window.location.origin));

  const respuesta = await fetch(
    deCasa ? url : `/api/rivals/foto?url=${encodeURIComponent(url)}`,
  );

  if (!respuesta.ok) return null;

  const blob = await respuesta.blob();
  const objectUrl = URL.createObjectURL(blob);

  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const imagen = new Image();

      imagen.onload = () => resolve(imagen);
      imagen.onerror = () => reject(new Error("Imagen ilegible"));
      imagen.src = objectUrl;
    });
  } catch (error) {
    console.warn("[portada] imagen que no se ha podido cargar:", url, error);

    return null;
  } finally {
    /* El `<img>` ya tiene los píxeles decodificados; soltar el blob aquí no
       lo deja sin nada que pintar. */
    URL.revokeObjectURL(objectUrl);
  }
}

/** Encaja la imagen entera dentro de la caja, centrada y sin deformarla. */
function encaja(
  ctx: Ctx,
  imagen: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const escala = Math.min(w / imagen.naturalWidth, h / imagen.naturalHeight);

  const ancho = imagen.naturalWidth * escala;
  const alto = imagen.naturalHeight * escala;

  ctx.drawImage(imagen, x + (w - ancho) / 2, y + (h - alto) / 2, ancho, alto);
}

/*
|--------------------------------------------------------------------------
| BLOQUES DE LA PORTADA
|--------------------------------------------------------------------------
*/

/** Escudo, temporada, nombre del club y el filo rosa que cierra la cabecera. */
function cabecera(ctx: Ctx, data: PortadaData, escudo: HTMLImageElement | null) {
  const ESCUDO = 156;

  if (escudo) encaja(ctx, escudo, MARGEN - 33, 40, ESCUDO, ESCUDO);

  const x = MARGEN + (escudo ? ESCUDO - 20 : 0);

  chapa(ctx, `TEMPORADA ${data.temporada}`, {
    x,
    y: 62,
    alto: 44,
    fondo: C.verde,
    tinta: C.crema,
    tamano: 21,
    espaciado: 4,
    padding: 22,
  });

  const club = (data.equipo || "Rival").toUpperCase();

  /* El nombre del club no puede meterse debajo de la chapa de la derecha. */
  ajusta(ctx, club, W - MARGEN - 300 - x, 40, 700, 1.6);

  ctx.fillStyle = C.verde;
  textoEspaciado(ctx, club, x, 152, 1.6);

  chapa(ctx, `INDIVIDUAL · ${data.temporada.replace(/\s/g, "")}`, {
    x: W - MARGEN,
    y: 62,
    alto: 44,
    fondo: C.navy,
    tinta: C.crema,
    tamano: 21,
    espaciado: 4,
    padding: 26,
    desdeDerecha: true,
  });

  ctx.fillStyle = C.rosa;
  ctx.fillRect(MARGEN, 188, W - MARGEN * 2, 5);
}

/** "ANÁLISIS" en verde e "INDIVIDUAL" en azul, con el rombo del original. */
function titular(ctx: Ctx) {
  ctx.fillStyle = C.verde;
  fuente(ctx, 260, 700);
  textoEspaciado(ctx, "ANÁLISIS", 90, 504, -8);

  /* El cuadrado girado 45° que la plantilla pone a la izquierda de la
     segunda línea. Se gira sobre su centro para que quede a plomo. */
  ctx.save();
  ctx.translate(121, 626);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = C.rosaHondo;
  ctx.fillRect(-21, -21, 42, 42);
  ctx.restore();

  ctx.fillStyle = C.navy;
  fuente(ctx, 220, 700);
  textoEspaciado(ctx, "INDIVIDUAL", 180, 744, -7);
}

/*
| El retrato.
|
| La foto de BeSoccer viene sobre fondo blanco de estudio, que es justo por lo
| que la plantilla usa papel blanco: así el recorte cuadrado no se ve. Lo que
| sí se veía era el corte a cuchillo de los hombros, que en el original tocan
| los tres bordes de abajo de la foto. Se desvanecen contra el papel —abajo y
| por los dos lados, sólo en el tercio inferior, que es donde llega el torso—
| y la cabeza queda flotando, que es lo que se espera de una portada.
*/
function retrato(ctx: Ctx, foto: HTMLImageElement | null) {
  const CAJA_X = 1190;
  const CAJA_Y = 196;
  const CAJA = 660;

  if (foto) {
    /* Cuadrada y centrada: el retrato de BeSoccer lo es, y estirarlo a la
       caja de la plantilla —que no lo era— le ensanchaba la cara. */
    encaja(ctx, foto, CAJA_X, CAJA_Y, CAJA, CAJA);
  } else {
    silueta(ctx, CAJA_X + CAJA / 2, CAJA_Y + CAJA / 2, CAJA * 0.42);
    return;
  }

  const abajo = CAJA_Y + CAJA;

  const velo = (
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    x: number,
    y: number,
    w: number,
    h: number,
  ) => {
    const degradado = ctx.createLinearGradient(x0, y0, x1, y1);

    degradado.addColorStop(0, "rgba(255, 255, 255, 0)");
    degradado.addColorStop(1, C.papel);

    ctx.fillStyle = degradado;
    ctx.fillRect(x, y, w, h);
  };

  velo(0, abajo - 170, 0, abajo, CAJA_X, abajo - 170, CAJA, 170);

  velo(CAJA_X + 80, 0, CAJA_X, 0, CAJA_X, abajo - 320, 80, 320);

  velo(
    CAJA_X + CAJA - 80,
    0,
    CAJA_X + CAJA,
    0,
    CAJA_X + CAJA - 80,
    abajo - 320,
    80,
    320,
  );
}

/** Cabeza y hombros en gris, para el jugador sin foto en la hoja. */
function silueta(ctx: Ctx, cx: number, cy: number, r: number) {
  ctx.save();
  ctx.fillStyle = "rgba(15, 30, 61, 0.10)";

  ctx.beginPath();
  ctx.arc(cx, cy - r * 0.35, r * 0.52, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(cx, cy + r * 0.95, r * 0.95, Math.PI, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * Cómo se lee el pie dominante en la chapa.
 *
 * La hoja lo escribe a mano y no siempre igual —«Zurdo», «zurda»,
 * «Izquierdo»—, y la portada se proyecta: se normaliza a las tres palabras que
 * el cuerpo técnico usa. Lo que no encaje se pinta tal cual en versales, que
 * es mejor que tragarse un dato que alguien se ha molestado en escribir.
 */
function pieDominante(valor: string | undefined) {
  const texto = (valor ?? "").trim();

  if (!texto || texto === ".") return "";

  const limpio = texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  /* La hoja de rivales escribe "DCHO", "IZDO" y "AMBOS" —así viene de
     BeSoccer—, pero a mano se ha escrito de todo: se aceptan las dos formas y
     se pinta siempre la palabra entera, que es la que se lee proyectada. */
  if (limpio.includes("ambi") || limpio.includes("ambos")) return "AMBIDIESTRO";

  if (
    limpio.includes("zurd") ||
    limpio.includes("izq") ||
    limpio.includes("izd")
  ) {
    return "ZURDO";
  }

  if (
    limpio.includes("diestr") ||
    limpio.includes("derech") ||
    limpio.includes("dch") ||
    limpio.includes("der")
  ) {
    return "DIESTRO";
  }

  return texto.toUpperCase();
}

/**
 * La ficha física: estatura, edad y peso, en el orden en que se cantan.
 *
 * Se normaliza aquí y no en la página por lo mismo que `pieDominante`: lo que
 * se proyecta es cosa de la portada. La hoja escribe la altura de las dos
 * formas que da BeSoccer —«1,84» y «184»— y el peso con unidad y sin ella; lo
 * que no se entienda se pinta tal cual en versales, que es mejor que tragarse
 * un dato que alguien se ha molestado en escribir.
 */
function fisico(data: PortadaData) {
  const limpio = (valor: string | undefined) => {
    const texto = (valor ?? "").trim();

    return !texto || texto === "." || texto === "0" ? "" : texto;
  };

  const numero = (texto: string) => {
    const parsed = Number(texto.replace(",", ".").replace(/[^\d.]/g, ""));

    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  };

  const partes: string[] = [];

  const altura = limpio(data.altura);

  if (altura) {
    const valor = numero(altura);

    /* La hoja mezcla "1,84" y "184 cm": por debajo de 3 se asume metros. */
    const cm =
      valor === null ? null : Math.round(valor < 3 ? valor * 100 : valor);

    partes.push(
      cm ? `${(cm / 100).toFixed(2).replace(".", ",")} M` : altura.toUpperCase(),
    );
  }

  const edad = limpio(data.edad);

  if (edad) {
    const valor = numero(edad);

    partes.push(valor ? `${Math.round(valor)} AÑOS` : edad.toUpperCase());
  }

  const peso = limpio(data.peso);

  if (peso) {
    const valor = numero(peso);

    partes.push(valor ? `${Math.round(valor)} KG` : peso.toUpperCase());
  }

  return partes;
}

/**
 * Las chapas del pie: qué pierna, quién es y qué juega. Van por la derecha.
 *
 * La del pie es la nueva y va la primera por la izquierda, en rosa sobre azul:
 * no es del mismo orden que el nombre ni que la posición —es lo primero que se
 * mira de un rival al que hay que defender una banda o una falta—, y con el
 * color de las otras dos se leía como una tercera etiqueta de identidad.
 */
function chapasDelJugador(ctx: Ctx, data: PortadaData) {
  const Y = 872;
  const ALTO = 60;

  /*
  | Lo que hay entre el final de la franja de números y el margen derecho. Las
  | chapas se reparten ese hueco: la de la posición puede llevar
  | "MEDIO CENTRO DEFENSIVO · Nº14" y la del nombre, "PANAGIOTIS MORAITIS", y
  | juntas se comían la franja.
  */
  const HUECO = W - MARGEN - (FRANJA_X + FRANJA_W + 40);
  const SEPARACION = 20;

  const pie = pieDominante(data.pieDominante);

  const opcionesPie = {
    y: Y,
    alto: ALTO,
    fondo: C.rosaHondo,
    tinta: C.navy,
    tamano: 22,
    espaciado: 3.5,
    padding: 24,
    anchoMax: 210,
    desdeDerecha: true,
  };

  /* Se mide antes de pintar nada: lo que ocupe es lo que las otras dos dejan
     de tener, y la del nombre necesita saberlo para no salirse del hueco. */
  const anchoPie = pie
    ? chapa(ctx, pie, { ...opcionesPie, x: 0, soloMide: true })
    : 0;

  const reservado = anchoPie ? anchoPie + SEPARACION : 0;

  const posicion = [
    (data.posicion || "").toUpperCase(),
    data.dorsal ? `Nº${data.dorsal}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  const anchoPos = posicion
    ? chapa(ctx, posicion, {
        x: W - MARGEN,
        y: Y,
        alto: ALTO,
        fondo: C.navy,
        tinta: C.crema,
        tamano: 25,
        espaciado: 3.5,
        padding: 30,
        anchoMin: 260,
        anchoMax: (HUECO - reservado) * 0.62,
        desdeDerecha: true,
      })
    : 0;

  const anchoNombre = chapa(ctx, (data.nombre || "").toUpperCase(), {
    x: W - MARGEN - anchoPos - (anchoPos ? SEPARACION : 0),
    y: Y,
    alto: ALTO,
    fondo: C.verde,
    tinta: C.crema,
    tamano: 25,
    espaciado: 3.5,
    padding: 30,
    anchoMin: 240,
    anchoMax: HUECO - reservado - anchoPos - (anchoPos ? SEPARACION : 0),
    desdeDerecha: true,
  });

  if (pie) {
    chapa(ctx, pie, {
      ...opcionesPie,
      x:
        W -
        MARGEN -
        anchoPos -
        (anchoPos ? SEPARACION : 0) -
        anchoNombre -
        SEPARACION,
    });
  }

  /*
  | Lo de debajo de las chapas, por la derecha y en el orden en que se lee:
  | cómo se llama de verdad y cómo es de grande.
  |
  | El nombre completo va porque en el campo se le llama por el deportivo pero
  | en un acta o en BeSoccer aparece el otro. La ficha física va porque una
  | portada que no dice la estatura obliga a abrir la hoja para saber si hay
  | que preocuparse por él en un córner.
  |
  | La banda entre las chapas —acaban en 932— y el filo del pie —1006— da para
  | las dos justas, así que el reparto depende de cuántas haya: con una sola se
  | queda a la altura de siempre en vez de colgada del borde de arriba.
  */
  const completo = (data.nombreCompleto || "").trim();

  const lineas: { texto: string; color: string; tamano: number }[] = [];

  if (completo && completo.toUpperCase() !== (data.nombre || "").toUpperCase()) {
    lineas.push({ texto: completo.toUpperCase(), color: C.verde, tamano: 24 });
  }

  const medidas = fisico(data);

  if (medidas.length) {
    lineas.push({ texto: medidas.join("  ·  "), color: C.navy, tamano: 22 });
  }

  lineas.forEach((linea, indice) => {
    /* Se encogen contra el hueco de las chapas: un nombre completo griego
       entero se metía encima de la franja de números. */
    ajusta(ctx, linea.texto, HUECO, linea.tamano, 500, 2.4);

    ctx.fillStyle = linea.color;

    const ancho = anchoEspaciado(ctx, linea.texto, 2.4);

    textoEspaciado(
      ctx,
      linea.texto,
      W - MARGEN - ancho,
      lineas.length === 1 ? 962 : 956 + indice * 34,
      2.4,
    );
  });
}

/**
 * La franja de números, abajo a la izquierda.
 *
 * Es lo que la plantilla hecha a mano no tenía: una portada que sólo dice el
 * nombre obliga a pasar a la siguiente diapositiva para saber si el jugador
 * juega o mira. Sin estadísticas descargadas no se pinta nada y la portada
 * queda como el original.
 */
function franjaNumeros(ctx: Ctx, data: PortadaData) {
  const metricas = (data.metricas ?? []).slice(0, 6);

  if (!metricas.length) return;

  const X = FRANJA_X;
  const ANCHO = FRANJA_W;

  if (data.contexto) {
    const texto = data.contexto.toUpperCase();

    ctx.fillStyle = C.verde;
    ajusta(ctx, texto, ANCHO, 22, 600, 4);
    textoEspaciado(ctx, texto, X, 852, 4);
  }

  ctx.fillStyle = C.rosa;
  ctx.fillRect(X, 872, ANCHO, 3);

  const paso = ANCHO / metricas.length;

  metricas.forEach((metrica, indice) => {
    const x = X + paso * indice;

    ctx.fillStyle = C.navy;
    ajusta(ctx, metrica.valor, paso - 24, 62, 700);
    ctx.fillText(metrica.valor, x, 938);

    ctx.fillStyle = C.verde;
    ajusta(ctx, metrica.label, paso - 20, 20, 600, 2.6);
    textoEspaciado(ctx, metrica.label, x, 968, 2.6);
  });
}

/** Filo y firma del pie, que es lo que ata la portada con el PDF del once. */
function pie(ctx: Ctx) {
  ctx.fillStyle = C.rosa;
  ctx.fillRect(MARGEN, 1006, W - MARGEN * 2, 3);

  fuente(ctx, 22, 600);
  ctx.fillStyle = C.verde;
  textoEspaciado(ctx, "RMCF CASTILLA · SCOUTING RIVAL", MARGEN, 1046, 5);

  const fecha = new Date()
    .toLocaleDateString("es-ES", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })
    .toUpperCase();

  fuente(ctx, 22, 500);
  ctx.fillStyle = C.navy;

  const ancho = anchoEspaciado(ctx, fecha, 3);

  textoEspaciado(ctx, fecha, W - MARGEN - ancho, 1046, 3);
}

/*
|--------------------------------------------------------------------------
| LIENZO
|--------------------------------------------------------------------------
*/

/**
 * Pinta la portada y devuelve el lienzo.
 *
 * Se exporta para que el coding pueda usar la misma diapositiva como carátula
 * de los vídeos unificados de un jugador, sin duplicar el dibujo ni pasar por
 * la descarga: allí el lienzo se convierte en PNG y viaja al servidor, que lo
 * pega delante de los cortes.
 */
export async function pintaPortada(data: PortadaData) {
  /* Fuente e imágenes a la vez: son las dos únicas esperas del montaje. */
  const [, escudo, foto] = await Promise.all([
    esperaFuentePortada(),
    data.escudo ? cargaImagen(data.escudo) : Promise.resolve(null),
    data.foto ? cargaImagen(data.foto) : Promise.resolve(null),
  ]);

  const lienzo = document.createElement("canvas");

  lienzo.width = W * ESCALA;
  lienzo.height = H * ESCALA;

  const ctx = lienzo.getContext("2d");

  if (!ctx) throw new Error("El navegador no ha dado contexto 2D.");

  ctx.scale(ESCALA, ESCALA);

  ctx.fillStyle = C.papel;
  ctx.fillRect(0, 0, W, H);

  ctx.textBaseline = "alphabetic";

  cabecera(ctx, data, escudo);
  titular(ctx);
  retrato(ctx, foto);
  chapasDelJugador(ctx, data);
  franjaNumeros(ctx, data);
  pie(ctx);

  return lienzo;
}

function nombreArchivo(data: PortadaData, extension: string) {
  const limpia = (valor: string) =>
    valor
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase()
      .slice(0, 32);

  const hoy = new Date();

  const sello = [
    hoy.getFullYear(),
    String(hoy.getMonth() + 1).padStart(2, "0"),
    String(hoy.getDate()).padStart(2, "0"),
  ].join("-");

  return [
    "portada",
    limpia(data.equipo) || "rival",
    limpia(data.nombre) || "jugador",
    sello,
  ].join("_") + `.${extension}`;
}

function descarga(url: string, nombre: string) {
  const enlace = document.createElement("a");

  enlace.href = url;
  enlace.download = nombre;

  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
}

/*
|--------------------------------------------------------------------------
| SALIDAS
|--------------------------------------------------------------------------
*/

/** PNG a 3840×2160: el que se pega como fondo de una diapositiva. */
export async function exportPortadaPng(data: PortadaData) {
  const lienzo = await pintaPortada(data);

  const blob = await new Promise<Blob | null>((resolve) =>
    lienzo.toBlob(resolve, "image/png"),
  );

  if (!blob) throw new Error("El lienzo no ha devuelto la imagen.");

  const url = URL.createObjectURL(blob);
  const nombre = nombreArchivo(data, "png");

  descarga(url, nombre);

  /* El navegador todavía tiene que leer el blob para descargarlo. */
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);

  return nombre;
}

/**
 * PDF de una hoja apaisada 16:9.
 *
 * Va como imagen y no como texto vectorial a propósito: es la misma portada
 * que el PNG, pintada una sola vez, y así las dos salidas no pueden
 * separarse. En JPEG porque un PNG de 3840×2160 deja un PDF de varios megas
 * que ya no pasa por WhatsApp.
 */
export async function exportPortadaPdf(data: PortadaData) {
  const lienzo = await pintaPortada(data);

  const { jsPDF } = await import("jspdf");

  /*
  | 960×540 pt son 13,33×7,5 pulgadas: exactamente la diapositiva 16:9 de
  | PowerPoint, así que la hoja se puede imprimir o insertar sin reescalar.
  | En puntos y no en píxeles porque el "px" de jsPDF sale a 96 ppp y dejaba
  | una hoja de 35 pulgadas de ancho.
  */
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "pt",
    format: [PDF_W, PDF_H],
    compress: true,
  });

  doc.setProperties({
    title: `Análisis individual · ${data.nombre} (${data.equipo})`,
    subject: "Scouting rival · Real Madrid Castilla",
    creator: "RMCF Castilla",
  });

  doc.addImage(
    lienzo.toDataURL("image/jpeg", 0.94),
    "JPEG",
    0,
    0,
    PDF_W,
    PDF_H,
    undefined,
    "FAST",
  );

  const nombre = nombreArchivo(data, "pdf");

  doc.save(nombre);

  return nombre;
}

/*
|--------------------------------------------------------------------------
| NÚMEROS DE LA FRANJA
|--------------------------------------------------------------------------
*/

/**
 * Rótulo largo de cada columna de la tabla de temporadas.
 *
 * En la ficha las cabeceras son de dos letras porque hay cinco temporadas en
 * la misma tabla; aquí hay una sola fila a lo ancho de media portada, así que
 * se escriben enteras. Las claves son las de `columnasTemporada`: si allí se
 * añade una columna y aquí no se le pone rótulo, sencillamente no sale.
 */
const ROTULOS: Record<string, string> = {
  partidos: "PARTIDOS",
  titular: "TITULAR",
  minutos: "MINUTOS",
  goles: "GOLES",
  asistencias: "ASISTENCIAS",
  encajados: "ENCAJADOS",
  penaltis: "PENALTIS",
};

/** Orden en el que se leen, que no es el de la tabla. */
const ORDEN = [
  "partidos",
  "titular",
  "minutos",
  "goles",
  "encajados",
  "asistencias",
  "penaltis",
];

/**
 * Los números de una temporada, listos para la franja.
 *
 * Salen de las mismas columnas que pintan la ficha y el PDF del once
 * (`stats-table`), así que un cambio de criterio —cómo se cuentan los minutos,
 * qué se le enseña a un portero— llega a los tres sitios a la vez. Las
 * tarjetas van juntas en una casilla: en una portada interesa el par, no cada
 * una por su lado.
 */
export function metricasDeTemporada(
  season: RivalSeasonStats,
  portero: boolean,
): PortadaMetrica[] {
  const cols = new Map<string, ColumnaTemporada>(
    columnasTemporada(portero).map((col) => [col.key, col]),
  );

  const metricas: PortadaMetrica[] = [];

  for (const key of ORDEN) {
    const col = cols.get(key);

    if (!col || !ROTULOS[key]) continue;

    metricas.push({ label: ROTULOS[key], valor: col.valor(season) });
  }

  metricas.push({
    label: "TARJETAS",
    valor: `${season.amarillas} / ${season.rojas}`,
  });

  return metricas.slice(0, 6);
}
