/*
|--------------------------------------------------------------------------
| LA NOTA DE AGRADECIMIENTO PARA EL VESTUARIO RIVAL
|--------------------------------------------------------------------------
|
| Una hoja que se deja en el vestuario de casa cuando se juega fuera. No es un
| documento de trabajo: no lleva datos, ni escudos de nadie más, ni fecha. Es
| la carta del club, y por eso está escrita una sola vez —`TEXTO`— y sale
| siempre igual.
|
| Se entrega de dos formas porque se usa de dos maneras: el **PPT** para
| proyectarlo o para que alguien lo retoque antes de imprimirlo, y el **PDF**
| en A4 vertical, que es lo que de verdad se imprime y se deja sobre un banco.
|
| El lenguaje visual es el de `INDIVIDUAL.pptx`, el mismo de la portada del
| jugador rival y del campograma de día de partido: papel, azul, crema, rosa y
| Barlow Condensed, todo en `lienzo-club.ts`. Se dibuja **una sola vez** y a la
| medida que le pidan, porque el 16:9 de la diapositiva y el A4 vertical de la
| impresión no se parecen en nada: lo que cambia con el formato es cuánto aire
| hay entre las cosas, no cuáles son.
*/

import { creaPptx } from "@/lib/export/pptx";
import { descarga, pdfDeLienzos } from "@/lib/export/lienzos";
import { esperaFuentePortada } from "@/lib/rivals/portada-font";

import {
  C,
  chapa,
  fuente,
  rectRedondo,
  textoEspaciado,
  type Ctx,
} from "@/lib/rivals/lienzo-club";

/**
 * Lo que dice la hoja. Palabra por palabra.
 *
 * Está aquí y no en la interfaz porque es lo único que este documento tiene
 * que decir, y porque cambiarlo es una decisión del club y no una opción de
 * una pantalla: quien lo descargue tiene que llevarse siempre lo mismo.
 */
export const TEXTO = [
  "El Real Madrid CF - Castilla os agradece vuestra atención, así como las",
  "instalaciones y material que habéis puesto a nuestra disposición, pero",
  "sobre todo el tiempo y trabajo que habéis invertido para que podamos",
  "estar hoy aquí jugando contra vosotros en las mejores condiciones",
  "posibles.",
  "",
  "Os deseamos una gran temporada en lo personal y profesional.",
];

/** El cierre, aparte: va más grande y es lo que se lee de lejos. */
export const CIERRE = "GRACIAS POR TODO";

/** A cuánto se multiplica el lienzo. Con 2 el A4 sale por encima de 300 ppp. */
const ESCALA = 2;

/* ------------------------------------------------------------------ */
/*  EL DIBUJO                                                          */
/* ------------------------------------------------------------------ */

function lienzo(ancho: number, alto: number) {
  const canvas = document.createElement("canvas");

  canvas.width = Math.round(ancho * ESCALA);
  canvas.height = Math.round(alto * ESCALA);

  const ctx = canvas.getContext("2d");

  if (!ctx) throw new Error("El navegador no ha dado lienzo.");

  ctx.scale(ESCALA, ESCALA);
  ctx.imageSmoothingQuality = "high";
  ctx.textBaseline = "alphabetic";

  return { canvas, ctx };
}

/**
 * Pinta la hoja en el tamaño que le pidan.
 *
 * Todas las medidas salen del lado corto (`base`), así que la misma hoja cabe
 * en un 16:9 apaisado y en un A4 vertical sin dos diseños distintos. Lo único
 * que se decide aparte es el ancho de la caja de texto: en apaisado, si el
 * párrafo ocupara todo el ancho, cada renglón tendría veinte palabras y no se
 * podría leer de una pasada.
 */
function pinta(ctx: Ctx, W: number, H: number) {
  const base = Math.min(W, H);

  /* -------------------------------------------------- el papel */

  ctx.fillStyle = C.crema;
  ctx.fillRect(0, 0, W, H);

  /* El filo rosa de la casa, arriba a sangre. */
  ctx.fillStyle = C.rosa;
  ctx.fillRect(0, 0, W, Math.round(base * 0.014));

  /*
  | Una banda verde muy tenue al pie. No es adorno: sin ella la hoja impresa
  | en A4 es un folio blanco con letra, y esto se deja encima de un banco al
  | lado de la equipación de otro club.
  */
  const pie = Math.round(base * 0.09);

  ctx.fillStyle = C.verde;
  ctx.globalAlpha = 0.06;
  ctx.fillRect(0, H - pie, W, pie);
  ctx.globalAlpha = 1;

  const margen = Math.round(base * 0.1);

  /* -------------------------------------------------- la cabecera */

  const cuerpoTitulo = Math.round(base * 0.062);

  ctx.fillStyle = C.navy;

  const titulo = "REAL MADRID CF · CASTILLA";

  fuente(ctx, cuerpoTitulo, 700);

  const anchoTitulo = (() => {
    /* `textoEspaciado` pinta letra a letra: el ancho hay que medirlo con el
       mismo espaciado o el centrado se va. */
    const espaciado = cuerpoTitulo * 0.06;

    let suma = 0;

    for (const letra of titulo) suma += ctx.measureText(letra).width + espaciado;

    return { ancho: suma - espaciado, espaciado };
  })();

  const yTitulo = margen + cuerpoTitulo;

  textoEspaciado(
    ctx,
    titulo,
    (W - anchoTitulo.ancho) / 2,
    yTitulo,
    anchoTitulo.espaciado,
  );

  chapa(ctx, "AL VESTUARIO LOCAL", {
    x: W / 2,
    y: yTitulo + cuerpoTitulo * 0.4,
    alto: Math.round(base * 0.048),
    fondo: C.verde,
    tinta: C.crema,
    tamano: Math.round(base * 0.025),
    espaciado: Math.round(base * 0.006),
    padding: Math.round(base * 0.03),
    desdeCentro: true,
  });

  /* -------------------------------------------------- el texto */

  /*
  | La caja de texto no pasa de 62 caracteres de ancho aparente. En A4 eso es
  | casi todo el folio; en 16:9, poco más de la mitad de la diapositiva, y por
  | eso el párrafo queda centrado con aire a los lados en vez de cruzarla
  | entera.
  |
  | **Los renglones van centrados**, no alineados a la izquierda. Es una carta,
  | no un informe: con el bloque en bandera, y las dos últimas líneas cortas,
  | el párrafo se leía descolgado hacia un lado mientras el título y el cierre
  | iban al centro, y la hoja parecía mal montada.
  */
  const cajaW = Math.min(W - margen * 2, base * 1.22);

  const arriba = yTitulo + base * 0.14;
  const abajo = H - pie - base * 0.06;

  const cuerpo = Math.round(base * 0.036);
  const paso = Math.round(cuerpo * 1.62);
  const cuerpoCierre = Math.round(base * 0.052);

  /*
  | El párrafo y el cierre se centran **juntos**, como un solo bloque. Por
  | separado, el cierre se quedaba pegado al pie y quedaba un agujero en medio
  | de la hoja: en la diapositiva, medio 16:9 de papel vacío.
  */
  const separacion = Math.round(base * 0.075);

  const bloque = paso * TEXTO.length + separacion + cuerpoCierre;

  const techo = arriba + Math.max(0, (abajo - arriba - bloque) / 2);

  ctx.fillStyle = C.navy;
  ctx.textAlign = "left";

  TEXTO.forEach((linea, indice) => {
    if (!linea) return;

    /* Cada renglón se encoge sólo si se sale: así el bloque no baila cuando
       una línea es más larga que las demás. */
    let px = cuerpo;

    fuente(ctx, px, 500);

    while (ctx.measureText(linea).width > cajaW && px > cuerpo * 0.7) {
      px -= 1;
      fuente(ctx, px, 500);
    }

    ctx.fillText(
      linea,
      (W - ctx.measureText(linea).width) / 2,
      techo + cuerpo + paso * indice,
    );
  });

  /* -------------------------------------------------- el cierre */

  fuente(ctx, cuerpoCierre, 700);
  ctx.fillStyle = C.verde;

  const espaciadoCierre = cuerpoCierre * 0.1;

  let anchoCierre = 0;

  for (const letra of CIERRE) {
    anchoCierre += ctx.measureText(letra).width + espaciadoCierre;
  }

  anchoCierre -= espaciadoCierre;

  const yCierre = techo + paso * TEXTO.length + separacion + cuerpoCierre;

  textoEspaciado(
    ctx,
    CIERRE,
    (W - anchoCierre) / 2,
    yCierre,
    espaciadoCierre,
  );

  /* Un subrayado corto bajo el cierre, del rosa de la casa. */
  const raya = Math.round(base * 0.13);

  ctx.fillStyle = C.rosaHondo;
  rectRedondo(
    ctx,
    (W - raya) / 2,
    yCierre + cuerpoCierre * 0.32,
    raya,
    Math.max(3, Math.round(base * 0.006)),
    99,
  );
  ctx.fill();
}

/** El lienzo de la hoja, en la medida pedida, ya en PNG. */
async function hoja(ancho: number, alto: number) {
  await esperaFuentePortada();

  const { canvas, ctx } = lienzo(ancho, alto);

  pinta(ctx, ancho, alto);

  return canvas;
}

/* ------------------------------------------------------------------ */
/*  LO QUE SE DESCARGA                                                 */
/* ------------------------------------------------------------------ */

const NOMBRE = "agradecimiento-vestuario-rival";

/** Una diapositiva 16:9 con la nota. */
export async function exportAgradecimientoPptx() {
  const canvas = await hoja(1920, 1080);

  const blob = creaPptx(
    [
      {
        titulo: "Agradecimiento al vestuario rival",
        imagen: canvas.toDataURL("image/png"),
      },
    ],
    {
      titulo: "Agradecimiento al vestuario rival",
      aplicacion: "RMCF Castilla · Área general",
    },
  );

  descarga(blob, `${NOMBRE}.pptx`);

  return `${NOMBRE}.pptx`;
}

/**
 * La misma nota en A4 vertical, que es lo que se imprime.
 *
 * A 794×1123 px el lienzo sale a 2× (unos 200 ppp en A4), de sobra para una
 * hoja de texto: subirlo más sólo engorda el PDF que alguien va a mandar por
 * WhatsApp para que lo impriman en el hotel.
 */
export async function exportAgradecimientoPdf() {
  const canvas = await hoja(794, 1123);

  const doc = await pdfDeLienzos([canvas.toDataURL("image/png")], {
    ancho: canvas.width,
    alto: canvas.height,
    orientacion: "portrait",
    /* A sangre: el papel del diseño ES el papel del folio. */
    margen: 0,
  });

  doc.save(`${NOMBRE}.pdf`);

  return `${NOMBRE}.pdf`;
}
