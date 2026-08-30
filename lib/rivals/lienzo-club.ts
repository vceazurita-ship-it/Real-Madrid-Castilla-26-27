/*
|--------------------------------------------------------------------------
| LOS LADRILLOS DE `INDIVIDUAL.pptx`
|--------------------------------------------------------------------------
|
| La paleta, la tipografía y las cuatro formas con las que está hecha la
| plantilla de la casa. Nacieron dentro de `portada.ts` —el análisis individual
| de un jugador rival— y viven aquí desde que hay un segundo documento dibujado
| en lienzo con el mismo lenguaje: el campograma de día de partido
| (`alineacion-ppt.ts`).
|
| Están fuera por lo mismo que `stats-table.ts` está fuera de la ficha: si la
| chapa de la portada y la del campo se dibujaran por separado, la primera vez
| que se toque el radio o el centrado óptico dejarían de parecerse, y dos
| documentos que se enseñan seguidos en la misma reunión tienen que ser el
| mismo documento.
|
| Nada de esto sabe qué está pintando. Reciben un contexto de lienzo y
| coordenadas; el sentido lo pone quien llama.
*/

import { FAMILIA_PORTADA } from "@/lib/rivals/portada-font";

export type Ctx = CanvasRenderingContext2D;

/** La paleta de la plantilla, tal cual sale del pptx. */
export const C = {
  papel: "#FFFFFF",
  verde: "#1B3A2E",
  navy: "#0F1E3D",
  crema: "#F7F4EC",
  rosa: "#F6AFB6",
  rosaHondo: "#D89AA6",
};

/*
|--------------------------------------------------------------------------
| LO QUE ESCRIBE LA HOJA, EN CRISTIANO
|--------------------------------------------------------------------------
*/

/**
 * Cómo se lee el pie dominante en una chapa.
 *
 * La hoja lo escribe a mano y no siempre igual —«Zurdo», «zurda»,
 * «Izquierdo»—, y esto se proyecta: se normaliza a las tres palabras que el
 * cuerpo técnico usa. Lo que no encaje se pinta tal cual en versales, que es
 * mejor que tragarse un dato que alguien se ha molestado en escribir.
 */
export function pieDominante(valor: string | undefined) {
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
 * La estatura en centímetros enteros, venga como venga.
 *
 * La hoja mezcla «1,84» y «184 cm»: por debajo de 3 se asume que son metros.
 * Devuelve `null` cuando no hay número que sacar, que es lo que distingue «no
 * lo sabemos» de un cero.
 */
export function centimetros(valor: string | number | undefined) {
  const texto = String(valor ?? "").trim();

  if (!texto || texto === "." || texto === "0") return null;

  const numero = Number(texto.replace(",", ".").replace(/[^\d.]/g, ""));

  if (!Number.isFinite(numero) || numero <= 0) return null;

  return Math.round(numero < 3 ? numero * 100 : numero);
}

/** Los kilos, con la misma manga ancha que `centimetros`. */
export function kilos(valor: string | number | undefined) {
  const texto = String(valor ?? "").trim();

  if (!texto || texto === "." || texto === "0") return null;

  const numero = Number(texto.replace(",", ".").replace(/[^\d.]/g, ""));

  return Number.isFinite(numero) && numero > 0 ? Math.round(numero) : null;
}

/*
|--------------------------------------------------------------------------
| TEXTO
|--------------------------------------------------------------------------
*/

export function fuente(ctx: Ctx, px: number, peso: 500 | 600 | 700 = 700) {
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
export function anchoEspaciado(ctx: Ctx, texto: string, espaciado: number) {
  if (!texto) return 0;

  return (
    [...texto].reduce((total, letra) => total + ctx.measureText(letra).width, 0) +
    espaciado * (texto.length - 1)
  );
}

export function textoEspaciado(
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
export function ajusta(
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

export function rectRedondo(
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
export function chapa(
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
    /** `x` es el centro de la chapa. */
    desdeCentro?: boolean;
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
    desdeCentro = false,
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

  const izquierda = desdeDerecha
    ? x - ancho
    : desdeCentro
      ? x - ancho / 2
      : x;

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

export async function cargaImagen(url: string) {
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
    console.warn("[lienzo] imagen que no se ha podido cargar:", url, error);

    return null;
  } finally {
    /* El `<img>` ya tiene los píxeles decodificados; soltar el blob aquí no
       lo deja sin nada que pintar. */
    URL.revokeObjectURL(objectUrl);
  }
}

/** Encaja la imagen entera dentro de la caja, centrada y sin deformarla. */
export function encaja(
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

/**
 * Llena la caja con la imagen, recortando lo que sobre. El `object-fit: cover`
 * de siempre, con el encuadre subido: en un retrato lo que sobra es de cintura
 * para abajo, no la cabeza.
 */
export function cubre(
  ctx: Ctx,
  imagen: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
  anclaY = 0.5,
) {
  const escala = Math.max(w / imagen.naturalWidth, h / imagen.naturalHeight);

  const ancho = imagen.naturalWidth * escala;
  const alto = imagen.naturalHeight * escala;

  ctx.drawImage(
    imagen,
    x + (w - ancho) / 2,
    y + (h - alto) * anclaY,
    ancho,
    alto,
  );
}
