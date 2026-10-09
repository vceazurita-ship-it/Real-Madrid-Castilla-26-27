/**
 * Fotografiar un nodo del DOM — la misma foto en Chrome y en Safari.
 *
 * Toda la app exporta con `html-to-image`: clona el nodo, incrusta fotos y
 * fuentes, lo mete en un SVG y lo dibuja en un lienzo. En Chrome eso sale bien
 * a la primera. En Safari —y en TODO iPhone e iPad, donde cualquier navegador
 * es WebKit por debajo— «a veces» salía mal, y las tres causas son del motor,
 * no de ninguna pantalla en concreto:
 *
 * 1. **Las fotos y la fuente llegan tarde.** WebKit da por cargada la imagen
 *    SVG (`onload` + `decode()`) antes de haber decodificado las fotos que van
 *    dentro del `<foreignObject>`, así que la primera pasada al lienzo sale
 *    con caras en blanco o con la fuente de respaldo. Dibujar dos veces el
 *    mismo SVG, con un respiro entre medias, es el remedio conocido: la
 *    segunda ya lo tiene todo.
 * 2. **El lienzo tiene tope, y en iOS es pequeño.** iPhone y iPad no pintan un
 *    lienzo de más de 16,7 millones de píxeles (4096×4096): no fallan, devuelven
 *    `data:,` o una imagen vacía. Un informe largo a 2× lo supera de sobra. La
 *    nitidez se recorta a lo que el aparato aguanta, y si aun así sale vacío se
 *    repite más pequeño.
 * 3. **La descarga.** Un `<a download>` con un `data:` de varios megas en iOS
 *    abre la imagen en una pestaña o no hace nada; con un `Blob` descarga.
 *    Eso vive en `descargaDataUrl` de `lienzos.ts`.
 *
 * Aquí está sólo lo que es común a cualquier captura; lo que es de cada
 * pantalla (qué nodos, a qué medida, con qué fondo) sigue en cada sitio.
 */

import type { Options } from "html-to-image/lib/types";

/* ------------------------------------------------------------------ */
/*  EL APARATO                                                         */
/* ------------------------------------------------------------------ */

/** Safari, o cualquier navegador de iPhone/iPad (todos son WebKit). */
export function esWebKit() {
  if (typeof navigator === "undefined") return false;

  const ua = navigator.userAgent;

  /* Chrome y Edge llevan «Safari» en el UA; el WebKit de verdad no lleva
     «Chrome», «CriOS» ni «Edg». En iOS todos los navegadores son WebKit. */
  return esAppleTactil() || (/Safari/.test(ua) && !/Chrome|CriOS|Chromium|Edg|OPR|FxiOS/.test(ua));
}

/** iPhone o iPad. El iPad se presenta como Mac desde iPadOS 13: delata el táctil. */
export function esAppleTactil() {
  if (typeof navigator === "undefined") return false;

  const ua = navigator.userAgent;

  if (/iPhone|iPad|iPod/.test(ua)) return true;

  return /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
}

/**
 * Tope de píxeles del lienzo. iOS: 4096×4096 = 16.777.216, con margen. En
 * escritorio Chrome y Safari aguantan mucho más, pero no hay motivo para
 * pasar de 55 M: es un PNG de más de 150 MB en memoria.
 */
export function areaMaxima() {
  return esAppleTactil() ? 16_000_000 : 55_000_000;
}

/** Lado máximo de un lienzo: 16384 en todos los motores actuales. */
const LADO_MAXIMO = 16_000;

/** La nitidez pedida, recortada a lo que el aparato puede pintar. */
export function nitidezSegura(ancho: number, alto: number, deseada: number) {
  const area = Math.max(1, ancho * alto);

  return Math.max(
    0.25,
    Math.min(
      deseada,
      LADO_MAXIMO / Math.max(1, ancho),
      LADO_MAXIMO / Math.max(1, alto),
      Math.sqrt(areaMaxima() / area),
    ),
  );
}

/* ------------------------------------------------------------------ */
/*  ESPERAS                                                            */
/* ------------------------------------------------------------------ */

function pausa(ms: number) {
  return new Promise<void>((listo) => setTimeout(listo, ms));
}

function fotograma() {
  return new Promise<void>((listo) => {
    requestAnimationFrame(() => requestAnimationFrame(() => listo()));
  });
}

/**
 * Las fuentes de la página, cargadas. Con tope: `document.fonts.ready` no se
 * resuelve nunca si una fuente de fuera no contesta, y la exportación no puede
 * quedarse colgada por eso.
 */
export async function fuentesListas(tope = 3_000) {
  if (typeof document === "undefined" || !("fonts" in document)) return;

  await Promise.race([document.fonts.ready.then(() => undefined), pausa(tope)]);
}

/**
 * Carga un SVG (data URL) como imagen lista para dibujar.
 *
 * Es el `createImage` de `html-to-image` más el respiro que WebKit necesita:
 * ahí `decode()` vuelve antes de que las fotos de dentro estén decodificadas.
 */
export function cargaSvg(svg: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      const decodificada = typeof img.decode === "function" ? img.decode().catch(() => undefined) : Promise.resolve();

      decodificada.then(async () => {
        await fotograma();

        if (esWebKit()) await pausa(250);

        resolve(img);
      });
    };

    img.onerror = () => reject(new Error("No se pudo leer la captura"));
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.src = svg;
  });
}

/* ------------------------------------------------------------------ */
/*  CAPTURA                                                            */
/* ------------------------------------------------------------------ */

export type OpcionesCapturaNodo = Options & {
  /** PNG por defecto. JPEG para las diapositivas, que no tienen alfa. */
  formato?: "png" | "jpeg";
};

export type Captura = {
  dataUrl: string;
  /** Medida del nodo en píxeles CSS, la que se ha dibujado. */
  ancho: number;
  alto: number;
  /** Nitidez con la que ha salido de verdad (puede ser menor que la pedida). */
  nitidez: number;
};

/** Lo que mide el nodo si no se dice otra cosa: igual que `html-to-image`. */
function medidaDe(nodo: HTMLElement, opciones: Options) {
  if (opciones.width && opciones.height) {
    return { ancho: opciones.width, alto: opciones.height };
  }

  const estilo = getComputedStyle(nodo);
  const px = (valor: string) => parseFloat(valor) || 0;

  return {
    ancho: opciones.width ?? nodo.clientWidth + px(estilo.borderLeftWidth) + px(estilo.borderRightWidth),
    alto: opciones.height ?? nodo.clientHeight + px(estilo.borderTopWidth) + px(estilo.borderBottomWidth),
  };
}

/** Un `data:,` o un PNG de nada: el lienzo era más grande de lo que el aparato pinta. */
function pareceVacia(dataUrl: string) {
  return !dataUrl.startsWith("data:image/") || dataUrl.length < 600;
}

function dibuja(
  imagen: HTMLImageElement,
  ancho: number,
  alto: number,
  nitidez: number,
  fondo: string | undefined,
) {
  const lienzo = document.createElement("canvas");

  lienzo.width = Math.max(1, Math.round(ancho * nitidez));
  lienzo.height = Math.max(1, Math.round(alto * nitidez));

  const ctx = lienzo.getContext("2d");

  if (!ctx) throw new Error("El navegador no deja dibujar la captura.");

  if (fondo) {
    ctx.fillStyle = fondo;
    ctx.fillRect(0, 0, lienzo.width, lienzo.height);
  }

  ctx.drawImage(imagen, 0, 0, lienzo.width, lienzo.height);

  return lienzo;
}

/**
 * Fotografía un nodo y devuelve la imagen como data URL.
 *
 * Es `toPng`/`toJpeg` de `html-to-image` abierto en dos mitades —el SVG se
 * hace una vez; el lienzo, las veces que hagan falta— para poder meter en
 * medio lo que Safari necesita: el segundo dibujo y el tope de tamaño. En
 * Chrome el resultado es el mismo de antes, píxel a píxel.
 */
export async function capturaNodo(nodo: HTMLElement, opciones: OpcionesCapturaNodo = {}): Promise<Captura> {
  const { formato = "png", quality, pixelRatio, ...resto } = opciones;

  await fuentesListas();

  const { ancho, alto } = medidaDe(nodo, resto);

  const pedida = pixelRatio ?? (typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1);
  const base = nitidezSegura(ancho, alto, pedida);

  const { toSvg } = await import("html-to-image");

  const svg = await toSvg(nodo, { ...resto, width: ancho, height: alto });
  const imagen = await cargaSvg(svg);

  const tipo = formato === "jpeg" ? "image/jpeg" : "image/png";
  const fondo = resto.backgroundColor ?? (formato === "jpeg" ? "#ffffff" : undefined);

  /* Si el lienzo se pasa de lo que el aparato pinta, la imagen sale vacía en
     vez de fallar: se repite más pequeña. */
  for (const nitidez of [base, base * 0.7, base * 0.5]) {
    try {
      /* WebKit: la primera pasada puede salir sin fotos; se tira y se repite. */
      if (esWebKit()) {
        dibuja(imagen, ancho, alto, nitidez, fondo);

        await fotograma();
        await pausa(200);
      }

      const lienzo = dibuja(imagen, ancho, alto, nitidez, fondo);
      const dataUrl = lienzo.toDataURL(tipo, quality ?? (formato === "jpeg" ? 0.92 : undefined));

      /* Soltar la memoria del lienzo cuanto antes: en un iPad cuenta. */
      lienzo.width = 0;
      lienzo.height = 0;

      if (!pareceVacia(dataUrl)) return { dataUrl, ancho, alto, nitidez };
    } catch {
      /* Safari puede lanzar en vez de devolver vacío. Siguiente tamaño. */
    }
  }

  throw new Error("La captura ha salido vacía");
}
