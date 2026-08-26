/**
 * Fotografiar lo que la app dibuja y sacarlo en PDF.
 *
 * Varias pantallas de la plataforma se pintan en un **lienzo de medida fija**
 * —la diapositiva 16:9 de la pizarra de balón parado, la hoja A4 del horario
 * de partido— porque lo que se ve tiene que salir idéntico en el proyector y
 * en la impresora. Este módulo es la parte común de todas ellas: capturar esos
 * lienzos y montarlos en un PDF. El `.pptx` lo arma `lib/export/pptx.ts`.
 *
 * Lo que aquí se resuelve una vez y no se repite en cada pantalla:
 *
 * - **Las páginas montan sólo lo que se está viendo**, así que quien exporta
 *   levanta todos los lienzos fuera de pantalla y le pasa el contenedor. Ojo:
 *   apartarlos con posición, nunca con `display:none` ni `visibility` —un nodo
 *   sin caja se captura en blanco—.
 * - **Las fotos remotas.** Las caras de la plantilla y los planos de los
 *   desplazamientos viven en Supabase; sin esperarlas y sin una pasada de
 *   calentamiento salen huecos.
 * - **La resolución.** Se captura a 1,5× del lienzo: es lo que hace falta para
 *   que el papel salga a unos 260 ppp y a un proyector le sobra.
 */

import type { jsPDF } from "jspdf";

/** Un píxel transparente: lo que se pone donde una foto no se ha podido leer. */
export const PIXEL_VACIO =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

/** Cuántos píxeles reales por píxel de lienzo. Ver la cabecera del fichero. */
export const NITIDEZ = 1.5;

/* ------------------------------------------------------------------ */
/*  FICHEROS                                                           */
/* ------------------------------------------------------------------ */

/** "CD Teruel" → "cd-teruel": lo que aguanta cualquier carpeta compartida. */
export function apodo(valor: string, respaldo = "documento") {
  return (
    valor
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || respaldo
  );
}

export function descarga(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob);

  const enlace = document.createElement("a");

  enlace.href = url;
  enlace.download = nombre;

  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();

  /* El navegador todavía está leyendo el blob cuando vuelve el click. */
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/* ------------------------------------------------------------------ */
/*  ESPERAS                                                            */
/* ------------------------------------------------------------------ */

/** Espera a que el navegador haya pintado lo que se acaba de montar. */
export function pintado() {
  return new Promise<void>((listo) => {
    requestAnimationFrame(() => requestAnimationFrame(() => listo()));
  });
}

/**
 * Espera a que las fotos de un trozo de página estén cargadas.
 *
 * Se espera a cada `<img>` con un tope, porque una foto rota —un plano que
 * alguien borró de Supabase— no puede dejar colgada la exportación entera.
 */
export async function esperaFotos(raiz: HTMLElement, tope = 6_000) {
  const fotos = Array.from(raiz.querySelectorAll("img"));

  await Promise.all(
    fotos.map(
      (foto) =>
        new Promise<void>((listo) => {
          if (foto.complete) return listo();

          const acaba = () => listo();

          foto.addEventListener("load", acaba, { once: true });
          foto.addEventListener("error", acaba, { once: true });

          setTimeout(acaba, tope);
        }),
    ),
  );
}

/* ------------------------------------------------------------------ */
/*  CAPTURA                                                            */
/* ------------------------------------------------------------------ */

export type OpcionesCaptura = {
  /** Medida del lienzo, la misma con la que está dibujado. */
  ancho: number;
  alto: number;
  /** Lo que se ve donde el lienzo es transparente. El JPEG no tiene alfa. */
  fondo: string;
  nitidez?: number;
  alPaso?: (hechas: number, total: number) => void;
};

/**
 * Fotografía en JPEG todos los lienzos que cuelgan de `raiz`.
 *
 * Se capturan **en serie**: varios lienzos de 2880×1620 a la vez tumban la
 * pestaña en un portátil corriente. Lo que lleve `data-export-hide` se cae —es
 * cromo de edición, no documento.
 */
export async function capturaLienzos(
  raiz: HTMLElement,
  selector: string,
  opciones: OpcionesCaptura,
) {
  const nodos = Array.from(raiz.querySelectorAll<HTMLElement>(selector));

  const htmlToImage = await import("html-to-image");

  const comunes = {
    backgroundColor: opciones.fondo,
    imagePlaceholder: PIXEL_VACIO,
    quality: 0.92,
    style: {
      margin: "0",
      transform: "none",
      transformOrigin: "top left",
    },
    filter: (nodo: HTMLElement) => {
      if (!(nodo instanceof HTMLElement)) return true;

      return !nodo.hasAttribute("data-export-hide");
    },
  };

  /*
  | Pasada de calentamiento sobre el contenedor entero. `html-to-image` se
  | descarga él mismo las imágenes de otro dominio y las guarda en su caché
  | interna; sin esta primera pasada —a resolución ridícula, que es rápida— la
  | captura buena de cada lienzo sale a veces sin las fotos.
  */
  await htmlToImage
    .toJpeg(raiz, { ...comunes, pixelRatio: 0.04 })
    .catch(() => undefined);

  const imagenes: string[] = [];

  for (const nodo of nodos) {
    const imagen = await htmlToImage.toJpeg(nodo, {
      ...comunes,
      width: opciones.ancho,
      height: opciones.alto,
      pixelRatio: opciones.nitidez ?? NITIDEZ,
    });

    imagenes.push(imagen);

    opciones.alPaso?.(imagenes.length, nodos.length);
  }

  return imagenes;
}

/* ------------------------------------------------------------------ */
/*  EL PDF                                                             */
/* ------------------------------------------------------------------ */

/** Las tres esquinas del pie de página. Devolver `null` lo quita. */
export type PieDePagina = (
  indice: number,
  total: number,
) => { izquierda?: string; centro?: string; derecha?: string } | null;

export type OpcionesPdf = {
  ancho: number;
  alto: number;
  orientacion: "landscape" | "portrait";
  /**
   * Margen en puntos.
   *
   * A cero el lienzo va a sangre, que es lo que quiere una hoja diseñada ya
   * con sus propios márgenes —el horario— frente a una diapositiva 16:9, que
   * en A4 deja aire de sobra y agradece el respiro.
   */
  margen?: number;
  pie?: PieDePagina;
};

/** Una hoja suelta del PDF, con su lienzo y su orientación. */
export type HojaPdf = {
  imagen: string;
  ancho: number;
  alto: number;
  orientacion: "landscape" | "portrait";
  margen?: number;
  /** Ya resuelto: aquí no hay índice que valga, cada hoja trae el suyo. */
  pie?: { izquierda?: string; centro?: string; derecha?: string } | null;
};

/**
 * Un PDF con una hoja por lienzo, **cada una con su orientación**.
 *
 * Hace falta mezclarlas: el dossier de desplazamiento son diapositivas 16:9 y
 * el horario del día una hoja A4 vertical, y el cuerpo técnico quiere las dos
 * cosas en un solo fichero para mandarlo por el grupo.
 *
 * La hoja manda sobre el lienzo: se encoge hasta caber entero y se centra, así
 * que nunca se recorta nada por muy distinta que sea la proporción. Si hay pie
 * de página se le reserva su franja **fuera** de la imagen, para que se lea
 * igual cuando la hoja sale en blanco y negro.
 */
export async function pdfDeHojas(hojas: HojaPdf[]): Promise<jsPDF> {
  const { jsPDF } = await import("jspdf");

  const doc = new jsPDF({
    orientation: hojas[0]?.orientacion ?? "landscape",
    unit: "pt",
    format: "a4",
    compress: true,
  });

  hojas.forEach((hoja, indice) => {
    if (indice > 0) doc.addPage("a4", hoja.orientacion);

    const anchoHoja = doc.internal.pageSize.getWidth();
    const altoHoja = doc.internal.pageSize.getHeight();

    const margen = hoja.margen ?? 26;
    const pie = hoja.pie ? 26 : 0;

    const escala = Math.min(
      (anchoHoja - margen * 2) / hoja.ancho,
      (altoHoja - margen * 2 - pie) / hoja.alto,
    );

    const w = hoja.ancho * escala;
    const h = hoja.alto * escala;

    /* El alias evita que jsPDF guarde la misma imagen dos veces. */
    doc.addImage(
      hoja.imagen,
      "JPEG",
      (anchoHoja - w) / 2,
      (altoHoja - pie - h) / 2,
      w,
      h,
      `lienzo${indice}`,
      "FAST",
    );

    if (!hoja.pie) return;

    doc.setFontSize(8);
    doc.setTextColor(120);

    const base = altoHoja - 14;

    if (hoja.pie.izquierda) doc.text(hoja.pie.izquierda, margen, base);

    if (hoja.pie.centro) {
      doc.text(hoja.pie.centro, anchoHoja / 2, base, { align: "center" });
    }

    if (hoja.pie.derecha) {
      doc.text(hoja.pie.derecha, anchoHoja - margen, base, { align: "right" });
    }
  });

  return doc;
}

/** Atajo para cuando todas las hojas son iguales, que es lo corriente. */
export function pdfDeLienzos(imagenes: string[], opciones: OpcionesPdf) {
  return pdfDeHojas(
    imagenes.map((imagen, indice) => ({
      imagen,
      ancho: opciones.ancho,
      alto: opciones.alto,
      orientacion: opciones.orientacion,
      margen: opciones.margen,
      pie: opciones.pie?.(indice, imagenes.length) ?? null,
    })),
  );
}
