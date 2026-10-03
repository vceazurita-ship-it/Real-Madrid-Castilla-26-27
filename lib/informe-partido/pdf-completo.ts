/**
 * EL INFORME COMPLETO, EN PDF (03/10/2026).
 *
 * El extenso es un correo (HTML con estilos en línea). Para bajarlo —y para
 * mandarlo también como adjunto— se pinta fuera de pantalla y se fotografía
 * **hoja a hoja** con `html-to-image`: cada A4 es una captura del trozo que le
 * toca, desplazando el contenido hacia arriba.
 *
 * Dos trampas que ya mordieron:
 *
 *   - La copia que hace `html-to-image` se lleva también la posición fuera de
 *     pantalla (`left:-30000px`) y pintaba el contenido fuera del lienzo: 18
 *     hojas en blanco. Por eso cada captura anula posición y desplazamiento.
 *   - Fotografiar el documento entero de una vez obliga a bajar la nitidez
 *     (el lienzo del navegador no pasa de ~32.000 px de alto) y salía borroso.
 *     Hoja a hoja, cada una va a 1,6.
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

import { PIXEL_VACIO, pdfDeLienzos } from "@/lib/export/lienzos";

const FONDO = "#EEEAE0";

const ANCHO = 820;

/* La hoja: A4 en vertical. */
const ALTO_HOJA = Math.round(ANCHO * Math.SQRT2);

const NITIDEZ = 1.6;

export async function completoEnPdf(html: string, alPaso?: (hoja: number, total: number) => void): Promise<Blob> {
  const documento = new DOMParser().parseFromString(html, "text/html");

  const caja = document.createElement("div");

  caja.style.cssText = `position:fixed;left:-30000px;top:0;width:${ANCHO}px;background:${FONDO};pointer-events:none`;
  caja.innerHTML = documento.body.innerHTML;

  for (const img of Array.from(caja.querySelectorAll("img"))) {
    const src = img.getAttribute("src") ?? "";

    if (/^https?:\/\//.test(src) && !src.startsWith(window.location.origin)) {
      img.setAttribute("src", `/api/rivals/foto?url=${encodeURIComponent(src)}`);
    }
  }

  document.body.appendChild(caja);

  try {
    await Promise.all(Array.from(caja.querySelectorAll("img")).map((img) => img.decode().catch(() => undefined)));

    const alto = caja.scrollHeight;

    /* Dónde se puede cortar: el borde de arriba de cada fila, en px CSS. */
    const arriba = caja.getBoundingClientRect().top;

    const cortes = Array.from(caja.querySelectorAll("tr"))
      .map((tr) => Math.round(tr.getBoundingClientRect().top - arriba))
      .filter((y) => y > 0)
      .sort((a, b) => a - b);

    const tramos: [number, number][] = [];

    for (let y = 0; y < alto - 2; ) {
      let fin = Math.min(y + ALTO_HOJA, alto);

      if (fin < alto) {
        const corte = cortes.filter((c) => c > y + ALTO_HOJA * 0.55 && c <= y + ALTO_HOJA).pop();

        if (corte) fin = corte;
      }

      tramos.push([y, fin]);

      y = fin;
    }

    const { toCanvas } = await import("html-to-image");

    const hojas: string[] = [];

    for (const [i, [y, fin]] of tramos.entries()) {
      alPaso?.(i + 1, tramos.length);

      const lienzo = await toCanvas(caja, {
        width: ANCHO,
        height: fin - y,
        pixelRatio: NITIDEZ,
        backgroundColor: FONDO,
        includeQueryParams: true,
        imagePlaceholder: PIXEL_VACIO,
        style: { position: "static", left: "0", top: "0", transform: `translateY(-${y}px)` },
      });

      /* Cada hoja, del mismo tamaño: lo que sobra abajo, del color del fondo. */
      const hoja = document.createElement("canvas");

      hoja.width = Math.round(ANCHO * NITIDEZ);
      hoja.height = Math.round(ALTO_HOJA * NITIDEZ);

      const ctx = hoja.getContext("2d");

      if (!ctx) throw new Error("El navegador no deja dibujar el PDF.");

      ctx.fillStyle = FONDO;
      ctx.fillRect(0, 0, hoja.width, hoja.height);
      ctx.drawImage(lienzo, 0, 0);

      hojas.push(hoja.toDataURL("image/jpeg", 0.85));
    }

    const pdf = await pdfDeLienzos(hojas, {
      ancho: Math.round(ANCHO * NITIDEZ),
      alto: Math.round(ALTO_HOJA * NITIDEZ),
      orientacion: "portrait",
      margen: 0,
    });

    return pdf.output("blob") as Blob;
  } finally {
    caja.remove();
  }
}
