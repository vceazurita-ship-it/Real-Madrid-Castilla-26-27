/**
 * EL INFORME COMPLETO, EN PDF (03/10/2026).
 *
 * El extenso es un correo (HTML con estilos en línea). Para bajarlo —y para
 * mandarlo también como adjunto— se pinta fuera de pantalla, se fotografía
 * entero con `html-to-image` y se corta en hojas A4.
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

/* El lienzo del navegador no pasa de ~32.000 px de alto. */
const ALTO_MAXIMO = 30_000;

export async function completoEnPdf(html: string): Promise<Blob> {
  const documento = new DOMParser().parseFromString(html, "text/html");

  const caja = document.createElement("div");

  caja.style.cssText = `position:fixed;left:-30000px;top:0;width:820px;background:${FONDO};pointer-events:none`;
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

    const nitidez = Math.min(1.5, ALTO_MAXIMO / Math.max(1, caja.scrollHeight));

    const { toCanvas } = await import("html-to-image");

    const lienzo = await toCanvas(caja, {
      pixelRatio: nitidez,
      backgroundColor: FONDO,
      includeQueryParams: true,
      imagePlaceholder: PIXEL_VACIO,
    });

    /* Dónde se puede cortar: el borde de arriba de cada fila. */
    const arriba = caja.getBoundingClientRect().top;

    const cortes = Array.from(caja.querySelectorAll("tr"))
      .map((tr) => Math.round((tr.getBoundingClientRect().top - arriba) * nitidez))
      .filter((y) => y > 0)
      .sort((a, b) => a - b);

    const ancho = lienzo.width;

    const altoHoja = Math.round(ancho * Math.SQRT2);

    const hojas: string[] = [];

    let y = 0;

    while (y < lienzo.height - 2) {
      let fin = Math.min(y + altoHoja, lienzo.height);

      if (fin < lienzo.height) {
        const corte = cortes.filter((c) => c > y + altoHoja * 0.55 && c <= y + altoHoja).pop();

        if (corte) fin = corte;
      }

      const hoja = document.createElement("canvas");

      hoja.width = ancho;
      hoja.height = altoHoja;

      const ctx = hoja.getContext("2d");

      if (!ctx) throw new Error("El navegador no deja dibujar el PDF.");

      ctx.fillStyle = FONDO;
      ctx.fillRect(0, 0, ancho, altoHoja);
      ctx.drawImage(lienzo, 0, y, ancho, fin - y, 0, 0, ancho, fin - y);

      hojas.push(hoja.toDataURL("image/jpeg", 0.85));

      y = fin;
    }

    const pdf = await pdfDeLienzos(hojas, { ancho, alto: altoHoja, orientacion: "portrait", margen: 0 });

    return pdf.output("blob") as Blob;
  } finally {
    caja.remove();
  }
}
