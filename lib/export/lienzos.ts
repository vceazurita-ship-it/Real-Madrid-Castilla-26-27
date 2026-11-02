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

import { capturaNodo, cargaSvg, pestanaOculta, respira } from "@/lib/export/captura";

export { pausaSegura, pestanaOculta, respira } from "@/lib/export/captura";

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

/**
 * Descarga una imagen que viene como `data:` URL.
 *
 * Pasa por `Blob` a propósito: en iOS un `<a download>` con un `data:` de
 * varios megas abre la imagen en una pestaña o no hace nada, y en Safari de
 * escritorio a veces la guarda como «desconocido». Con un `blob:` descarga en
 * todos, y con su nombre.
 */
export async function descargaDataUrl(dataUrl: string, nombre: string) {
  const blob = await (await fetch(dataUrl)).blob();

  descarga(blob, nombre);
}

/* ------------------------------------------------------------------ */
/*  ESPERAS                                                            */
/* ------------------------------------------------------------------ */

/**
 * Espera a que el navegador haya pintado lo que se acaba de montar.
 *
 * Con la pestaña oculta no hay fotogramas y `requestAnimationFrame` no llega
 * nunca: un PDF pedido en segundo plano se quedaba colgado. El reloj de
 * respaldo lo suelta (27/10/2026).
 */
export function pintado() {
  /*
    Escondida (otra pestaña delante, la ventana minimizada o tapada) el reloj
    de respaldo tampoco vale: Chrome lo retrasa a un segundo como poco y,
    pasados cinco minutos, a uno por MINUTO. Un vídeo de «Exportar todo» hace
    cientos de esperas y no acababa nunca (01/11/2026). Escondida no hay nada
    que pintar en pantalla: basta con dejar pasar las tareas pendientes.
  */
  if (pestanaOculta()) return respira(2);

  return new Promise<void>((listo) => {
    let hecho = false;
    const suelta = () => {
      if (!hecho) {
        hecho = true;
        listo();
      }
    };

    requestAnimationFrame(() => requestAnimationFrame(suelta));
    setTimeout(suelta, 150);
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
  /**
   * Las fuentes ya incrustadas (`getFontEmbedCSS`), hechas una vez por
   * exportación. Sin ellas, cada lienzo vuelve a leer todas las hojas de
   * estilo, que es lo más lento de cada foto.
   */
  fontEmbedCSS?: string;
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
    /* La caché de imágenes de `html-to-image` va por URL SIN la query: dos
       fotos por el proxy (`/api/rivals/foto?url=…`) eran la misma y salían
       los dos escudos iguales. */
    includeQueryParams: true,
    ...(opciones.fontEmbedCSS ? { fontEmbedCSS: opciones.fontEmbedCSS } : {}),
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
  /* Por `toSvg` + `cargaSvg` y no `toJpeg`: el `toJpeg` espera un
     `requestAnimationFrame`, que con la pestaña escondida no llega nunca, y
     la exportación se quedaba colgada aquí (01/11/2026). Lo que calienta es
     el SVG (ahí se descargan las fotos). */
  await htmlToImage
    .toSvg(raiz, comunes)
    .then((svg) => cargaSvg(svg))
    .catch(() => undefined);

  const imagenes: string[] = [];

  /* La captura de verdad va por `capturaNodo`: es el mismo `toJpeg` abierto
     en dos mitades, con el segundo dibujo y el tope de lienzo que Safari y
     los iPad necesitan. Ver `lib/export/captura.ts`. */
  for (const nodo of nodos) {
    const { dataUrl } = await capturaNodo(nodo, {
      ...comunes,
      formato: "jpeg",
      width: opciones.ancho,
      height: opciones.alto,
      pixelRatio: opciones.nitidez ?? NITIDEZ,
    });

    imagenes.push(dataUrl);

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
  /** Una primera página con la lista de hojas, cada una enlazada a la suya. */
  indice?: IndicePdf;
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
  /** Zonas que se pueden pulsar, en fracciones de la imagen (0-1): el póster del vídeo, una fila de documentos… */
  enlaces?: { x: number; y: number; w: number; h: number; url: string }[];
  /**
   * Colores para lo que sobra arriba y abajo cuando la imagen no tiene la
   * proporción del A4 (una lámina 16:9): con el de su cabecera y el de su pie,
   * la banda llega al borde de la hoja en vez de quedar una franja blanca.
   */
  bandas?: { arriba: string; abajo: string };
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
export async function pdfDeHojas(hojas: HojaPdf[], extra: { indice?: IndicePdf } = {}): Promise<jsPDF> {
  const { jsPDF } = await import("jspdf");

  const indice = extra.indice && hojas.length ? extra.indice : null;

  const doc = new jsPDF({
    orientation: indice ? "landscape" : (hojas[0]?.orientacion ?? "landscape"),
    unit: "pt",
    format: "a4",
    compress: true,
  });

  /* Con índice, las hojas empiezan después de sus páginas. */
  const plan = indice ? planIndice(doc, indice, hojas.length) : null;
  const paginasIndice = plan?.paginas.length ?? 0;

  if (plan && indice) pintaIndice(doc, indice, plan);

  hojas.forEach((hoja, orden) => {
    if (orden > 0 || paginasIndice > 0) doc.addPage("a4", hoja.orientacion);

    const anchoHoja = doc.internal.pageSize.getWidth();
    const altoHoja = doc.internal.pageSize.getHeight();

    const margen = hoja.margen ?? 26;
    const pie = hoja.pie || plan ? 26 : 0;

    const escala = Math.min(
      (anchoHoja - margen * 2) / hoja.ancho,
      (altoHoja - margen * 2 - pie) / hoja.alto,
    );

    const w = hoja.ancho * escala;
    const h = hoja.alto * escala;

    if (hoja.bandas) {
      const y0 = (altoHoja - pie - h) / 2;

      doc.setFillColor(hoja.bandas.arriba);
      doc.rect(0, 0, anchoHoja, y0 + 1, "F");
      doc.setFillColor(hoja.bandas.abajo);
      doc.rect(0, y0 + h - 1, anchoHoja, altoHoja - y0 - h + 1, "F");
    }

    /* El alias evita que jsPDF guarde la misma imagen dos veces. */
    doc.addImage(
      hoja.imagen,
      "JPEG",
      (anchoHoja - w) / 2,
      (altoHoja - pie - h) / 2,
      w,
      h,
      `lienzo${orden}`,
      "FAST",
    );

    for (const e of hoja.enlaces ?? []) doc.link((anchoHoja - w) / 2 + e.x * w, (altoHoja - pie - h) / 2 + e.y * h, e.w * w, e.h * h, { url: e.url });

    const base = altoHoja - 14;
    let tope = anchoHoja - margen;

    /* La vuelta al índice, en el pie de cada hoja (01/11/2026). */
    if (plan) {
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      const derecha = hoja.pie?.derecha ?? "";
      const anchoDerecha = derecha ? doc.getTextWidth(derecha) + 14 : 0;

      doc.setFont("helvetica", "bold");
      const rotulo = "ÍNDICE";
      const anchoRotulo = doc.getTextWidth(rotulo);
      const x = anchoHoja - margen - anchoDerecha - anchoRotulo - 6;
      const chip = { x: x - 15, y: base - 9.5, w: anchoRotulo + 21, h: 13.5 };

      doc.setFillColor(15, 30, 61);
      doc.roundedRect(chip.x, chip.y, chip.w, chip.h, 3, 3, "F");
      /* La punta, dibujada: las fuentes de serie de jsPDF no tienen flechas. */
      doc.setFillColor(246, 175, 182);
      doc.triangle(chip.x + 5, base - 2.8, chip.x + 10, base - 6.3, chip.x + 10, base + 0.7, "F");
      doc.setTextColor(255, 255, 255);
      doc.text(rotulo, x, base);
      doc.setFont("helvetica", "normal");
      doc.link(chip.x - 3, chip.y - 3, chip.w + 6, chip.h + 6, { pageNumber: 1, top: 0 });
      tope = chip.x - 12;
    }

    if (!hoja.pie) return;

    doc.setFontSize(8);
    doc.setTextColor(120);

    if (hoja.pie.izquierda) doc.text(hoja.pie.izquierda, margen, base);

    if (hoja.pie.centro) {
      doc.text(hoja.pie.centro, Math.min(anchoHoja / 2, tope - doc.getTextWidth(hoja.pie.centro) / 2), base, { align: "center" });
    }

    if (hoja.pie.derecha) {
      doc.text(hoja.pie.derecha, anchoHoja - margen, base, { align: "right" });
    }
  });

  /* Los saltos del índice, al final: las hojas ya existen (ver pdf-once-saltos-internos). */
  if (plan) {
    const ultima = doc.getNumberOfPages();

    for (const fila of plan.filas) {
      doc.setPage(fila.pagina);
      doc.link(fila.x, fila.y, fila.w, fila.h, { pageNumber: paginasIndice + fila.hoja + 1, top: 0 });
    }

    doc.setPage(ultima);
  }

  return doc;
}

/* ------------------------------------------------------------------ */
/*  EL ÍNDICE                                                          */
/* ------------------------------------------------------------------ */

/**
 * La primera página de un PDF largo (01/11/2026, pizarra de ABP): la lista de
 * hojas con su título entero, y cada fila salta a su página. Cada hoja lleva
 * en el pie «ÍNDICE» para volver.
 */
export type IndicePdf = {
  /** «BALÓN PARADO», arriba en grande. */
  titulo: string;
  /** «Cartagena · J10 · 01/11/2026». */
  subtitulo?: string;
  /** Una por hoja, en el orden de las hojas. */
  entradas: string[];
  /**
   * Sin la columna «pág. N» (02/11/2026, informes del partido y de ABP): sus
   * hojas llevan ya «3 / 13» en el pie y las dos cuentas no coincidían; el
   * número del disco es el de la hoja.
   */
  sinPagina?: boolean;
};

type FilaIndice = { hoja: number; pagina: number; x: number; y: number; w: number; h: number; lineas: string[] };

const INDICE = { margen: 44, arriba: 132, abajo: 40, renglon: 15, aire: 10 };

/** Dónde cae cada fila (y cuántas páginas de índice hacen falta), antes de pintar nada. */
function planIndice(doc: jsPDF, indice: IndicePdf, hojas: number) {
  const ancho = doc.internal.pageSize.getWidth();
  const alto = doc.internal.pageSize.getHeight();
  const textoW = ancho - INDICE.margen * 2 - 44 - 70;
  const filas: FilaIndice[] = [];
  const paginas: number[] = [1];
  let y = INDICE.arriba;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);

  for (let hoja = 0; hoja < hojas; hoja += 1) {
    const texto = (indice.entradas[hoja] ?? "").trim() || `Diapositiva ${hoja + 1}`;
    /* El título entero, en los renglones que haga falta: nunca con «…». */
    const lineas = doc.splitTextToSize(texto.toUpperCase(), textoW) as string[];
    const h = lineas.length * INDICE.renglon + INDICE.aire;

    if (y + h > alto - INDICE.abajo) {
      paginas.push(paginas.length + 1);
      y = INDICE.arriba;
    }

    filas.push({ hoja, pagina: paginas.length, x: INDICE.margen, y, w: ancho - INDICE.margen * 2, h, lineas });
    y += h + 5;
  }

  return { filas, paginas };
}

function pintaIndice(doc: jsPDF, indice: IndicePdf, plan: ReturnType<typeof planIndice>) {
  const ancho = doc.internal.pageSize.getWidth();
  const alto = doc.internal.pageSize.getHeight();
  const paginasIndice = plan.paginas.length;

  for (const pagina of plan.paginas) {
    if (pagina > 1) doc.addPage("a4", "landscape");

    /* La banda azul de la plantilla del club con su filo rosa. */
    doc.setFillColor(15, 30, 61);
    doc.rect(0, 0, ancho, 78, "F");
    doc.setFillColor(246, 175, 182);
    doc.rect(0, 78, ancho, 4, "F");

    doc.setTextColor(247, 244, 236);
    doc.setFont("helvetica", "bold");
    /* Un título largo («POST J10 · RM CASTILLA 2-1 FC CARTAGENA») se achica hasta caber: nunca se sale de la banda. */
    const libre = ancho - INDICE.margen * 2 - (indice.subtitulo ? 190 : 0);
    let cuerpo = 24;

    doc.setFontSize(cuerpo);
    while (cuerpo > 13 && doc.getTextWidth(indice.titulo.toUpperCase()) > libre) doc.setFontSize((cuerpo -= 1));
    doc.text(indice.titulo.toUpperCase(), INDICE.margen, 48);

    if (indice.subtitulo) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.text(indice.subtitulo, ancho - INDICE.margen, 48, { align: "right" });
    }

    doc.setTextColor(15, 30, 61);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(paginasIndice > 1 ? `ÍNDICE · ${pagina} DE ${paginasIndice}` : "ÍNDICE", INDICE.margen, 112);
    doc.setFillColor(246, 175, 182);
    doc.rect(INDICE.margen, 117, 60, 3, "F");

    for (const fila of plan.filas.filter((f) => f.pagina === pagina)) {
      doc.setFillColor(247, 244, 236);
      doc.roundedRect(fila.x, fila.y, fila.w, fila.h, 4, 4, "F");

      const centro = fila.y + fila.h / 2;

      /* El número, en su disco rosa. */
      doc.setFillColor(246, 175, 182);
      doc.circle(fila.x + 20, centro, 10, "F");
      doc.setTextColor(15, 30, 61);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(String(fila.hoja + 1), fila.x + 20, centro + 3.5, { align: "center" });

      doc.setFontSize(12);
      const primera = centro - ((fila.lineas.length - 1) * INDICE.renglon) / 2 + 4.2;

      fila.lineas.forEach((linea, i) => doc.text(linea, fila.x + 44, primera + i * INDICE.renglon));

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(91, 100, 118);
      if (!indice.sinPagina) doc.text(`pág. ${paginasIndice + fila.hoja + 1}`, fila.x + fila.w - 14, centro + 3.5, { align: "right" });
    }

    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(`Pulsa una fila para ir a su ${indice.sinPagina ? "hoja" : "diapositiva"}. En cada hoja, «ÍNDICE» vuelve aquí.`, INDICE.margen, alto - 16);
  }
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
    { indice: opciones.indice },
  );
}
