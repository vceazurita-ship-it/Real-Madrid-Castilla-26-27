/**
 * CODING · el rótulo de cada corte.
 *
 * Un vídeo de veinte cortes pasado en la sala no dice de quién es cada uno ni
 * por qué está ahí: el analista lo cuenta de palabra o se pierde. En la
 * televisión eso lo resuelve el «tercio inferior»: al empezar cada jugada sale
 * un rótulo con el nombre y lo que se va a ver, y se va solo. Esto es eso.
 *
 * - **Qué dice**: el sujeto con su dorsal («9 · PÉREZ») y debajo la
 *   categoría, lo que el jugador tiene que leer de los descriptores y el
 *   minuto («Defensa · A corregir · 3:21»). Lo interno no sale: «Vídeo de
 *   grupo» o «Repasar» son para el analista, no para quien mira, y un «Mal» a
 *   secas delante del grupo no corrige a nadie —se escribe «A corregir»—.
 *   Lo que no está, no se nombra.
 * - **Cómo es**: **una sola pieza**. Antes eran dos cajas, una por línea y de
 *   distinto ancho, y la del detalle asomaba por debajo de la del nombre como
 *   un parche. Ahora es un fondo continuo del ancho de la línea más larga, con
 *   el filete oro a la izquierda a la altura de las dos líneas y el escudo del
 *   club al lado del nombre.
 * - **Cuánto dura**: 3,5 s. Entra deslizándose en 0,25 s y se va en 0,2 s.
 * - **Dónde**: abajo a la izquierda, en el hueco donde las retransmisiones
 *   ponen el suyo.
 *
 * El dibujo es uno solo para los tres motores: los dos del navegador
 * (`rapido.ts` y `navegador.ts`) lo pintan encima de cada fotograma, y para
 * ffmpeg el navegador lo pinta una vez en una imagen (`imagenDeRotulo`) que el
 * servidor pone encima con la misma entrada y la misma salida. Así el rótulo
 * sale idéntico se monte por donde se monte.
 */

/*
| Sólo tipos de `modelo`: este módulo lo cargan los motores del montaje, y
| `modelo` arrastra la telestración entera.
*/
import type {
  CategoriaCoding,
  ClipCoding,
  DescriptorCoding,
} from "@/lib/coding/modelo";

export type RotuloClip = {
  /** «9 · PÉREZ», en mayúsculas al pintarlo. */
  titulo: string;
  /** «Defensa · A corregir · 3:21». */
  detalle: string;
  /** El color de la categoría, para el punto que la acompaña. */
  color: string;
};

/** Lo que se queda en pantalla al empezar cada corte. */
export const ROTULO_MS = 3500;

/** Entra deslizándose en un cuarto de segundo… */
export const ENTRADA_MS = 250;

/** …y se va en dos décimas. */
export const SALIDA_MS = 200;

/** Lo que se desliza al entrar, en centésimas del alto del vídeo. */
export const DESLIZA_U = 3;

/** Las medidas, en centésimas del alto del vídeo: valen en 720p y en 4K. */
const MEDIDAS = {
  margen: 4.2,
  filete: 0.8,
  relleno: 1.6,
  /* El nombre por encima del 5 % del alto y el detalle del 3,3 %: en un
     móvil a 1080p el detalle a 2,9 se quedaba en letra de pie de foto. */
  titulo: 5.4,
  detalle: 3.4,
  separa: 0.5,
} as const;

/** El alto de referencia con el que se pinta la imagen para el servidor. */
export const ALTO_REFERENCIA = 1080;

/**
 * La medida de la que salen todas las del rótulo.
 *
 * En apaisado es el alto. En vertical (1080 × 1920) el alto pondría un nombre
 * de cien píxeles que no cabe a lo ancho: ahí manda el ancho. El servidor usa
 * la misma cuenta para escalar la imagen del rótulo, así que sale igual.
 */
export function baseDeRotulo(ancho: number, alto: number) {
  return Math.min(alto, ancho * 1.25);
}

/** El minuto del vídeo, sin «min» ni cero delante: «3:21» o «1:02:10». */
function minutoDeVideo(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const horas = Math.floor(total / 3600);
  const minutos = Math.floor((total % 3600) / 60);
  const segundos = total % 60;
  const dos = (valor: number) => String(valor).padStart(2, "0");

  return horas > 0
    ? `${horas}:${dos(minutos)}:${dos(segundos)}`
    : `${minutos}:${dos(segundos)}`;
}

/**
 * Lo que se lee en el rótulo de cada descriptor, o nada si es interno.
 *
 * Los guardados antes de que existiera `enRotulo` lo reciben al leer la
 * configuración (`normalizaConfig`), con lo que ponen los de fábrica.
 */
export function textoDeDescriptor(descriptor: DescriptorCoding): string {
  if (descriptor.enRotulo === false) return "";

  const propio = String(descriptor.rotulo ?? "").trim();

  return propio || descriptor.nombre.trim();
}

export function rotuloDeClip(
  clip: ClipCoding,
  categorias: CategoriaCoding[],
  descriptores: DescriptorCoding[] = [],
): RotuloClip {
  const categoria = categorias.find((una) => una.id === clip.categoriaId);

  const titulo = [
    typeof clip.jugadorDorsal === "number" ? String(clip.jugadorDorsal) : "",
    clip.jugadorNombre.trim(),
  ]
    .filter(Boolean)
    .join(" · ");

  /*
  | Sólo los descriptores, y en el orden de la configuración: las etiquetas
  | libres son apuntes del analista («revisar con Raúl»), no algo que tenga
  | que leer el jugador en tres segundos.
  */
  const marcados = new Set(clip.tags.map((tag) => tag.trim().toLowerCase()));
  const visibles = descriptores
    .filter((uno) => marcados.has(uno.nombre.trim().toLowerCase()))
    .map(textoDeDescriptor)
    .filter(Boolean);

  const detalle = [
    categoria?.nombre ?? "",
    ...visibles,
    minutoDeVideo(clip.codingInicioMs),
  ]
    .filter(Boolean)
    .join(" · ");

  return {
    titulo,
    detalle,
    color: categoria?.color ?? "#C8A96B",
  };
}

/** Cuánto se ve el rótulo en el milisegundo `t` del corte: de 0 a 1. */
export function opacidadRotulo(tMs: number) {
  if (tMs < 0 || tMs > ROTULO_MS) return 0;

  return Math.max(
    0,
    Math.min(1, tMs / ENTRADA_MS, (ROTULO_MS - tMs) / SALIDA_MS),
  );
}

/** Lo que le falta por entrar, de 1 a 0, con la frenada de una grafía de tele. */
function faltaPorEntrar(tMs: number) {
  const p = Math.min(1, Math.max(0, tMs / ENTRADA_MS));

  return (1 - p) ** 3;
}

type Pincel = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/*
| El escudo del club, cargado una vez y compartido por los tres motores.
|
| Se pide con `cargaEscudoRotulo` antes de empezar a montar; si no ha llegado
| —sin red, o pintando desde un sitio sin `Image`— el rótulo sale igual, sin
| escudo.
*/
let escudo: CanvasImageSource | null = null;
let pidiendo: Promise<CanvasImageSource | null> | null = null;

export function cargaEscudoRotulo(): Promise<CanvasImageSource | null> {
  if (escudo) return Promise.resolve(escudo);
  if (pidiendo) return pidiendo;
  if (typeof Image === "undefined") return Promise.resolve(null);

  pidiendo = new Promise((resolver) => {
    const imagen = new Image();

    imagen.onload = () => {
      escudo = imagen;
      resolver(imagen);
    };
    imagen.onerror = () => {
      pidiendo = null;
      resolver(null);
    };
    imagen.src = "/logo.png";
  });

  return pidiendo;
}

/** Corta el texto con «…» hasta que quepa en `ancho`. */
function cabe(pincel: Pincel, texto: string, ancho: number) {
  if (pincel.measureText(texto).width <= ancho) return texto;

  let corto = texto;

  while (corto.length > 1 && pincel.measureText(`${corto}…`).width > ancho) {
    corto = corto.slice(0, -1);
  }

  return `${corto.trimEnd()}…`;
}

type Caja = {
  ancho: number;
  alto: number;
  titulo: string;
  detalle: string;
  u: number;
};

/** Mide la caja: el ancho sale de la línea más larga, no de cada una. */
function mideCaja(
  pincel: Pincel,
  anchoVideo: number,
  altoVideo: number,
  rotulo: RotuloClip,
  familia: string,
): Caja {
  const u = baseDeRotulo(anchoVideo, altoVideo) / 100;
  const relleno = MEDIDAS.relleno * u;
  const altoTitulo = MEDIDAS.titulo * u;
  const altoDetalle = MEDIDAS.detalle * u;

  const altoCaja = Math.round(
    relleno * 2 +
      altoTitulo +
      (rotulo.detalle ? altoDetalle + MEDIDAS.separa * u : 0),
  );

  const lado = escudo ? altoCaja - relleno * 2 : 0;
  const delante = MEDIDAS.filete * u + relleno + (lado ? lado + relleno : 0);

  /* En vertical el vídeo es estrecho: la caja no pasa del 92 % del ancho. */
  const maximo = Math.min(anchoVideo * 0.62, anchoVideo * 0.92 - delante - relleno);

  pincel.font = `700 ${Math.round(altoTitulo)}px ${familia}`;
  const titulo = cabe(pincel, rotulo.titulo.toUpperCase(), maximo);
  const anchoTitulo = pincel.measureText(titulo).width;

  pincel.font = `500 ${Math.round(altoDetalle)}px ${familia}`;
  const detalle = rotulo.detalle ? cabe(pincel, rotulo.detalle, maximo) : "";
  const anchoDetalle = detalle
    ? pincel.measureText(detalle).width + altoDetalle * 0.55
    : 0;

  return {
    ancho: Math.round(delante + Math.max(anchoTitulo, anchoDetalle) + relleno * 1.4),
    alto: altoCaja,
    titulo,
    detalle,
    u,
  };
}

/** Pinta la caja ya medida con su esquina en (`x`, `y`). */
function pintaCaja(
  pincel: Pincel,
  caja: Caja,
  x: number,
  y: number,
  rotulo: RotuloClip,
  familia: string,
) {
  const { u } = caja;
  const relleno = MEDIDAS.relleno * u;
  const filete = Math.max(3, Math.round(MEDIDAS.filete * u));
  const altoTitulo = Math.round(MEDIDAS.titulo * u);
  const altoDetalle = Math.round(MEDIDAS.detalle * u);

  /* Un solo fondo continuo, y el filete oro a la altura de las dos líneas. */
  pincel.fillStyle = "rgba(11, 15, 20, 0.86)";
  pincel.fillRect(x, y, caja.ancho, caja.alto);

  pincel.fillStyle = "#C8A96B";
  pincel.fillRect(x, y, filete, caja.alto);

  let texto = x + filete + relleno;

  if (escudo) {
    const lado = caja.alto - relleno * 2;

    pincel.drawImage(escudo, texto, y + relleno, lado, lado);
    texto += lado + relleno;
  }

  pincel.textBaseline = "top";

  pincel.fillStyle = "#FFFFFF";
  pincel.font = `700 ${altoTitulo}px ${familia}`;
  pincel.fillText(caja.titulo, texto, y + relleno - 0.2 * u);

  if (caja.detalle) {
    const arriba = y + relleno + altoTitulo + MEDIDAS.separa * u;

    /* El punto del color de la categoría: une el rótulo con su marca de la
       línea de tiempo sin pintar el filete de un color distinto cada vez. */
    const radio = altoDetalle * 0.2;

    pincel.fillStyle = rotulo.color;
    pincel.beginPath();
    pincel.arc(texto + radio, arriba + altoDetalle * 0.52, radio, 0, Math.PI * 2);
    pincel.fill();

    pincel.fillStyle = "#E6D8B8";
    pincel.font = `500 ${altoDetalle}px ${familia}`;
    pincel.fillText(caja.detalle, texto + altoDetalle * 0.55, arriba);
  }
}

/**
 * Pinta el rótulo encima de lo que ya hay en el lienzo.
 *
 * Todas las medidas salen del alto del vídeo, así que en 720p y en 4K ocupa
 * lo mismo de la imagen. `familia` es la de `ctx.font` (`FAMILIA_PORTADA`):
 * el motor no puede importar `next/font`.
 */
export function pintaRotulo(
  pincel: Pincel,
  ancho: number,
  alto: number,
  rotulo: RotuloClip,
  tMs: number,
  familia: string,
) {
  const alfa = opacidadRotulo(tMs);

  if (alfa <= 0) return;

  pincel.save();

  const caja = mideCaja(pincel, ancho, alto, rotulo, familia);
  const margen = Math.round(MEDIDAS.margen * caja.u);

  pincel.globalAlpha = alfa;

  const x = Math.round(margen - faltaPorEntrar(tMs) * DESLIZA_U * caja.u);
  const y = Math.round(alto - margen - caja.alto);

  pintaCaja(pincel, caja, x, y, rotulo, familia);

  pincel.restore();
}

/**
 * El rótulo pintado una vez, recortado a su caja, para que lo ponga ffmpeg.
 *
 * Se pinta a 1080 de alto y con el ancho de un vídeo apaisado: el servidor lo
 * escala a la medida real y le pone la misma entrada y la misma salida que
 * aquí. Es la forma de que el rótulo del servidor sea **éste** y no un
 * parecido hecho con `drawtext`.
 */
export function imagenDeRotulo(
  rotulo: RotuloClip,
  familia: string,
): { imagen: string; ancho: number; alto: number } | null {
  if (typeof document === "undefined") return null;

  const prueba = document.createElement("canvas").getContext("2d");

  if (!prueba) return null;

  const caja = mideCaja(
    prueba,
    (ALTO_REFERENCIA * 16) / 9,
    ALTO_REFERENCIA,
    rotulo,
    familia,
  );

  const lienzo = document.createElement("canvas");

  lienzo.width = caja.ancho;
  lienzo.height = caja.alto;

  const pincel = lienzo.getContext("2d");

  if (!pincel) return null;

  pintaCaja(pincel, caja, 0, 0, rotulo, familia);

  return {
    imagen: lienzo.toDataURL("image/png"),
    ancho: caja.ancho,
    alto: caja.alto,
  };
}
