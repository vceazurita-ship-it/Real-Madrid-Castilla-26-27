/**
 * EL INFORME COMPLETO, EN PDF (03/10/2026; rehecho el 04/10/2026).
 *
 * El extenso es un correo (HTML con estilos en línea). Para bajarlo —y para
 * mandarlo también como adjunto— se pinta fuera de pantalla y se convierte en
 * hojas A4.
 *
 * **Una sola foto, cortada en hojas (04/10/2026).** Antes cada hoja era una
 * captura entera de `html-to-image`: copiar el documento, incrustar fuentes e
 * imágenes… diecinueve veces. Medido: 7-18 s por hoja, cuatro minutos para un
 * post de 19 hojas, y era casi todo lo que tardaba el envío. Ahora se saca el
 * SVG del documento UNA vez y cada hoja es un trozo de esa imagen pintado en su
 * lienzo: segundos.
 *
 * Trampas que ya mordieron:
 *
 *   - La copia de `html-to-image` se lleva la posición fuera de pantalla
 *     (`left:-30000px`) y pintaba el contenido fuera del lienzo: hojas en
 *     blanco. Se anula en `style`.
 *   - El lienzo del navegador no pasa de ~32.000 px de alto: por eso no se
 *     pinta el documento entero en un lienzo, sino cada hoja en el suyo
 *     desde la misma imagen SVG (que es vectorial: sale nítida a 1,6).
 *
 * Los cortes caen **entre filas** (la parte de arriba de un `<tr>`) siempre
 * que haya una en la segunda mitad de la hoja: así una tabla o un párrafo no
 * quedan partidos por la mitad de una línea.
 *
 * Las fotos de BeSoccer (escudos, caras) pasan por el proxy de la app: sin
 * él, el navegador no deja leer sus píxeles y saldrían en blanco.
 *
 * Se usa en el navegador.
 */

import { cargaSvg, fuentesListas } from "@/lib/export/captura";
import { PIXEL_VACIO, pdfDeLienzos } from "@/lib/export/lienzos";

const FONDO = "#EEEAE0";

const ANCHO = 820;

/* La hoja: A4 en vertical. */
const ALTO_HOJA = Math.round(ANCHO * Math.SQRT2);

const NITIDEZ = 1.6;

/* El pie de cada hoja, dibujado dentro de la imagen: alto y margen. */
const PIE = 34;

export type OpcionesCompleto = {
  /** «Post J6 · RM Castilla 3-2 Atlético Madrileño»: va en el pie y en las propiedades del PDF. */
  titulo?: string;
};

/** Las hojas del completo ya pintadas (JPEG en data URL) y su tamaño en píxeles. */
export type HojasCompleto = { hojas: string[]; ancho: number; alto: number };

/** El completo en PDF, para bajarlo suelto. */
export async function completoEnPdf(html: string, alPaso?: (hoja: number, total: number) => void, opciones: OpcionesCompleto = {}): Promise<Blob> {
  const { hojas, ancho, alto } = await completoEnHojas(html, alPaso, opciones);

  const pdf = await pdfDeLienzos(hojas, { ancho, alto, orientacion: "portrait", margen: 0 });

  if (opciones.titulo) {
    (pdf as { setProperties?: (p: Record<string, string>) => void }).setProperties?.({
      title: `Real Madrid Castilla · ${opciones.titulo}`,
      author: "Real Madrid Castilla · Cuerpo técnico",
      creator: "Plataforma del Castilla",
    });
  }

  return pdf.output("blob") as Blob;
}

/**
 * Las hojas A4 del completo, sin hacer el PDF (16/10/2026): así se pueden
 * juntar con las diapositivas del resumen en el PDF único del informe
 * (`lib/informe-partido/pdf-unico.ts`).
 */
export async function completoEnHojas(html: string, alPaso?: (hoja: number, total: number) => void, opciones: OpcionesCompleto = {}): Promise<HojasCompleto> {
  const documento = new DOMParser().parseFromString(html, "text/html");

  const caja = document.createElement("div");

  caja.style.cssText = `position:fixed;left:-30000px;top:0;width:${ANCHO}px;background:${FONDO};pointer-events:none`;
  /*
  | La letra de la casa (31/10/2026): los titulares del informe de ABP piden
  | «Barlow Condensed» y en un correo caen a Arial; en el PDF sí se puede, con
  | los TTF de `public/fuentes`. La regla va dentro de la caja para que
  | html-to-image la encuentre y la incruste.
  */
  const fuentes = [
    [500, "BarlowCondensed-Medium"],
    [600, "BarlowCondensed-SemiBold"],
    [700, "BarlowCondensed-Bold"],
  ]
    .map(([peso, fichero]) => `@font-face{font-family:'Barlow Condensed';font-weight:${peso};font-style:normal;src:url('${window.location.origin}/fuentes/${fichero}.ttf') format('truetype')}`)
    .join("");

  caja.innerHTML = `<style>${fuentes}</style>${documento.body.innerHTML}`;

  /* Lo que sólo tiene sentido en la bandeja de entrada no va en el PDF. */
  caja.querySelectorAll("[data-solo-correo]").forEach((n) => n.remove());

  for (const img of Array.from(caja.querySelectorAll("img"))) {
    const src = img.getAttribute("src") ?? "";

    if (/^https?:\/\//.test(src) && !src.startsWith(window.location.origin)) {
      img.setAttribute("src", `/api/rivals/foto?url=${encodeURIComponent(src)}`);
    }
  }

  document.body.appendChild(caja);

  try {
    await Promise.all(Array.from(caja.querySelectorAll("img")).map((img) => img.decode().catch(() => undefined)));

    /* Que la letra esté cargada antes de medir dónde se corta cada hoja. */
    await Promise.all(["500", "600", "700"].map((peso) => document.fonts?.load(`${peso} 16px 'Barlow Condensed'`).catch(() => undefined)));

    const alto = caja.scrollHeight;

    /* Lo que cabe en una hoja, quitando el pie. */
    const util = ALTO_HOJA - PIE;

    /* Dónde se puede cortar: el borde de arriba de cada fila, en px CSS. */
    const arriba = caja.getBoundingClientRect().top;

    /*
    | Dónde NO se corta (31/10/2026, equipo de expertos): entre la cabecera de
    | una tabla y su primera fila, ni justo debajo del título de una sección
    | (el título se quedaba solo al pie de la hoja).
    */
    const bajoTitulos = Array.from(caja.querySelectorAll("h2")).map((h) => h.getBoundingClientRect().bottom - arriba);

    const cortes = Array.from(caja.querySelectorAll("tr"))
      .filter((tr) => !(tr.parentElement?.tagName === "TBODY" && tr === tr.parentElement.firstElementChild && tr.parentElement.previousElementSibling?.tagName === "THEAD"))
      .filter((tr) => {
        const y = tr.getBoundingClientRect().top - arriba;

        return !bajoTitulos.some((b) => y > b && y - b < 90);
      })
      .map((tr) => Math.round(tr.getBoundingClientRect().top - arriba))
      .filter((y) => y > 0)
      .sort((a, b) => a - b);

    const tramos: [number, number][] = [];

    for (let y = 0; y < alto - 2; ) {
      let fin = Math.min(y + util, alto);

      if (fin < alto) {
        const corte = cortes.filter((c) => c > y + util * 0.55 && c <= y + util).pop();

        if (corte) fin = corte;
      }

      tramos.push([y, fin]);

      y = fin;
    }

    alPaso?.(0, tramos.length);

    /* La foto, UNA vez: el documento entero como SVG. */
    const { toSvg } = await import("html-to-image");

    await fuentesListas();

    const svg = await toSvg(caja, {
      width: ANCHO,
      height: alto,
      backgroundColor: FONDO,
      includeQueryParams: true,
      imagePlaceholder: PIXEL_VACIO,
      style: { position: "static", left: "0", top: "0", transform: "none" },
    });

    /* `cargaSvg` (y no la carga de siempre): en WebKit la imagen se da por
       cargada antes de tener dentro las fotos, y sale el respiro que falta. */
    const imagen = await cargaSvg(svg);

    const hojas: string[] = [];

    for (const [i, [y, fin]] of tramos.entries()) {
      alPaso?.(i + 1, tramos.length);

      const hoja = document.createElement("canvas");

      hoja.width = Math.round(ANCHO * NITIDEZ);
      hoja.height = Math.round(ALTO_HOJA * NITIDEZ);

      const ctx = hoja.getContext("2d");

      if (!ctx) throw new Error("El navegador no deja dibujar el PDF.");

      ctx.fillStyle = FONDO;
      ctx.fillRect(0, 0, hoja.width, hoja.height);

      const trozo = fin - y;

      ctx.drawImage(imagen, 0, y, ANCHO, trozo, 0, 0, ANCHO * NITIDEZ, trozo * NITIDEZ);

      /* El pie: título a la izquierda, número de hoja a la derecha. */
      const base = (ALTO_HOJA - PIE / 2 + 4) * NITIDEZ;

      ctx.fillStyle = "#C8A96B";
      ctx.fillRect(28 * NITIDEZ, (ALTO_HOJA - PIE) * NITIDEZ, (ANCHO - 56) * NITIDEZ, 1 * NITIDEZ);

      ctx.font = `600 ${10 * NITIDEZ}px Arial, sans-serif`;
      ctx.fillStyle = "#6B7280";
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";
      ctx.fillText(`REAL MADRID CASTILLA${opciones.titulo ? ` · ${opciones.titulo}` : ""}`.toUpperCase(), 28 * NITIDEZ, base);
      ctx.textAlign = "right";
      ctx.fillText(`${i + 1} / ${tramos.length}`, (ANCHO - 28) * NITIDEZ, base);

      hojas.push(hoja.toDataURL("image/jpeg", 0.82));

      /* Que la pantalla respire entre hoja y hoja. */
      await new Promise((r) => setTimeout(r, 0));
    }

    return { hojas, ancho: Math.round(ANCHO * NITIDEZ), alto: Math.round(ALTO_HOJA * NITIDEZ) };
  } finally {
    caja.remove();
  }
}
