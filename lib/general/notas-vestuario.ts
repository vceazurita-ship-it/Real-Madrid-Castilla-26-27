/*
|--------------------------------------------------------------------------
| LAS NOTAS DE VESTUARIO
|--------------------------------------------------------------------------
|
| Dos hojas hermanas, la misma en el fondo:
|
| - **Fuera**: la nota de agradecimiento que se deja en el vestuario local
|   cuando jugamos en su campo.
| - **En casa**: la nota de bienvenida que se deja en el vestuario visitante
|   cuando reciben ellos el viaje.
|
| Ninguna lleva rival, ni jornada, ni fecha: es la carta del club y quien la
| baje el viernes tiene que llevarse siempre lo mismo. Lo que sí se puede
| cambiar es lo que dicen —se escribe desde `/desplazamiento` y se guarda—,
| porque el tono de la casa lo pone quien la firma y no un fichero.
|
| Se entregan de dos formas porque se usan de dos maneras: el **PPT** para
| proyectarlo o para que alguien lo retoque antes, y el **PDF** en A4 vertical,
| que es lo que de verdad se imprime y se deja sobre un banco.
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

/** Se juega fuera (dejamos la nota al local) o en casa (al visitante). */
export type ClaveNota = "visitante" | "local";

export type NotaVestuario = {
  /** La chapa bajo el título: a qué vestuario va la hoja. */
  destinatario: string;
  /**
   * Lo que dice. Un texto corrido: los renglones los parte el dibujo según el
   * ancho de la hoja, y una línea en blanco separa dos párrafos.
   */
  texto: string;
  /** El cierre, aparte: va más grande y es lo que se lee de lejos. */
  cierre: string;
};

/**
 * Lo que dicen las dos notas de fábrica. Palabra por palabra.
 *
 * Es el punto de partida y el botón de «volver al original»: quien las edite
 * desde la pantalla guarda su versión encima, pero esto no se pierde.
 */
export const NOTAS_ORIGINALES: Record<ClaveNota, NotaVestuario> = {
  visitante: {
    destinatario: "AL VESTUARIO LOCAL",
    texto: [
      "El Real Madrid CF - Castilla os agradece vuestra atención, así como las instalaciones y material que habéis puesto a nuestra disposición, pero sobre todo el tiempo y trabajo que habéis invertido para que podamos estar hoy aquí jugando contra vosotros en las mejores condiciones posibles.",
      "Os deseamos una gran temporada en lo personal y profesional.",
    ].join("\n\n"),
    cierre: "GRACIAS POR TODO",
  },

  local: {
    destinatario: "AL VESTUARIO VISITANTE",
    texto: [
      "El Real Madrid CF - Castilla os da la bienvenida a nuestra casa y os agradece el viaje y el trabajo que hay detrás de estar hoy aquí.",
      "Tenéis a vuestra disposición las instalaciones, el material y a todo nuestro personal: pedidnos sin reparo cualquier cosa que necesitéis, antes, durante o después del partido.",
      "Os deseamos una gran temporada en lo personal y profesional.",
    ].join("\n\n"),
    cierre: "BIENVENIDOS",
  },
};

/** Cómo se llama el fichero que se descarga. */
export const ARCHIVO: Record<ClaveNota, string> = {
  visitante: "agradecimiento-vestuario-rival",
  local: "bienvenida-vestuario-rival",
};

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
 * Parte el texto en renglones que quepan en la caja.
 *
 * Los renglones de la hoja **no** son los que teclee quien la edita: lo que
 * cabe en una línea del A4 no cabe en una del 16:9, y un texto escrito a la
 * medida de un formato sale en el otro con media línea suelta detrás de cada
 * renglón. Aquí se mide de verdad, con la fuente ya puesta.
 *
 * Por eso un salto de línea suelto es **blando**: se junta con lo que sigue,
 * como en cualquier editor. Lo que sí se respeta es la línea en blanco, que
 * es como se separan dos párrafos.
 */
function reparteRenglones(ctx: Ctx, texto: string, ancho: number) {
  /* Un párrafo por cada bloque entre líneas en blanco. */
  const parrafos = texto
    .split(/\r?\n\s*\r?\n/)
    .map((parrafo) => parrafo.split(/\s+/).filter(Boolean).join(" "))
    .filter(Boolean);

  const renglones: string[] = [];

  parrafos.forEach((parrafo, indice) => {
    if (indice > 0) renglones.push("");

    let linea = "";

    for (const palabra of parrafo.split(" ")) {
      const prueba = linea ? `${linea} ${palabra}` : palabra;

      if (linea && ctx.measureText(prueba).width > ancho) {
        renglones.push(linea);
        linea = palabra;
      } else {
        linea = prueba;
      }
    }

    renglones.push(linea);
  });

  return renglones;
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
function pinta(ctx: Ctx, W: number, H: number, nota: NotaVestuario) {
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

  chapa(ctx, nota.destinatario, {
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

  const separacion = Math.round(base * 0.075);

  const cierre = nota.cierre.trim();

  /*
  | El cierre va en mayúsculas y con las letras separadas, así que a tamaño
  | fijo un «MUCHÍSIMAS GRACIAS POR TODO LO DE HOY» se salía del folio por los
  | dos lados. Se le busca el tamaño antes que al cuerpo porque no depende de
  | él, sólo de lo largo que sea.
  */
  const anchoDelCierre = (px: number) => {
    if (!cierre) return 0;

    fuente(ctx, px, 700);

    const espaciado = px * 0.1;

    let suma = 0;

    for (const letra of cierre) suma += ctx.measureText(letra).width + espaciado;

    return suma - espaciado;
  };

  const menorCierre = Math.round(base * 0.02);

  let cuerpoCierre = Math.round(base * 0.052);

  while (cuerpoCierre > menorCierre && anchoDelCierre(cuerpoCierre) > cajaW) {
    cuerpoCierre -= 1;
  }

  /*
  | El cuerpo de letra se busca igual, no se fija: la nota es editable y nadie
  | tiene por qué contar renglones. Se empieza por el tamaño de siempre y se
  | baja hasta que el bloque cabe entre la chapa y el pie **y** ningún renglón
  | se sale de la caja. Lo segundo hace falta porque una palabra sola muy larga
  | no se puede partir por ningún lado: la única manera de meterla es achicarla.
  |
  | Si alguien escribe media página, saldrá pequeña, pero saldrá entera.
  */
  const cuerpoMinimo = Math.round(base * 0.02);

  let cuerpo = Math.round(base * 0.036);
  let renglones: string[] = [];
  let paso = 0;

  for (;;) {
    fuente(ctx, cuerpo, 500);

    renglones = reparteRenglones(ctx, nota.texto, cajaW);
    paso = Math.round(cuerpo * 1.62);

    const alto = paso * renglones.length + separacion + cuerpoCierre;

    const ancho = renglones.reduce(
      (mayor, linea) => Math.max(mayor, ctx.measureText(linea).width),
      0,
    );

    const cabe = alto <= abajo - arriba && ancho <= cajaW;

    if (cabe || cuerpo <= cuerpoMinimo) break;

    cuerpo -= 1;
  }

  /*
  | El párrafo y el cierre se centran **juntos**, como un solo bloque. Por
  | separado, el cierre se quedaba pegado al pie y quedaba un agujero en medio
  | de la hoja: en la diapositiva, medio 16:9 de papel vacío.
  */
  const bloque = paso * renglones.length + separacion + cuerpoCierre;

  const techo = arriba + Math.max(0, (abajo - arriba - bloque) / 2);

  ctx.fillStyle = C.navy;
  ctx.textAlign = "left";

  fuente(ctx, cuerpo, 500);

  renglones.forEach((linea, indice) => {
    if (!linea) return;

    ctx.fillText(
      linea,
      (W - ctx.measureText(linea).width) / 2,
      techo + cuerpo + paso * indice,
    );
  });

  /* -------------------------------------------------- el cierre */

  const yCierre = techo + paso * renglones.length + separacion + cuerpoCierre;

  /* Si alguien borra el cierre no se pinta nada: la raya de abajo va **con**
     él, y sola en mitad del folio parece un error de impresión. */
  if (!cierre) return;

  /* Deja además la fuente puesta al tamaño que se acaba de decidir. */
  const anchoCierre = anchoDelCierre(cuerpoCierre);

  ctx.fillStyle = C.verde;

  textoEspaciado(ctx, cierre, (W - anchoCierre) / 2, yCierre, cuerpoCierre * 0.1);

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

/** El lienzo de la hoja, en la medida pedida. */
async function hoja(ancho: number, alto: number, nota: NotaVestuario) {
  await esperaFuentePortada();

  const { canvas, ctx } = lienzo(ancho, alto);

  pinta(ctx, ancho, alto, nota);

  return canvas;
}

/**
 * El mismo dibujo, para mirarlo en pantalla mientras se escribe.
 *
 * Se pide en pequeño a posta: todas las medidas salen del lado corto, así que
 * una hoja de 420 px de ancho es la de 794 exacta, y regenerarla en cada tecla
 * cuesta lo que cuesta un icono. Lo que se ve es el documento, no una
 * aproximación.
 */
export async function dibujaNota(
  nota: NotaVestuario,
  ancho: number,
  alto: number,
) {
  return hoja(ancho, alto, nota);
}

/* ------------------------------------------------------------------ */
/*  LO QUE SE DESCARGA                                                 */
/* ------------------------------------------------------------------ */

const TITULO: Record<ClaveNota, string> = {
  visitante: "Agradecimiento al vestuario rival",
  local: "Bienvenida al vestuario visitante",
};

/** Una diapositiva 16:9 con la nota. */
export async function exportNotaPptx(clave: ClaveNota, nota: NotaVestuario) {
  const canvas = await hoja(1920, 1080, nota);

  const blob = creaPptx(
    [{ titulo: TITULO[clave], imagen: canvas.toDataURL("image/png") }],
    {
      titulo: TITULO[clave],
      aplicacion: "RMCF Castilla · Desplazamiento",
    },
  );

  descarga(blob, `${ARCHIVO[clave]}.pptx`);

  return `${ARCHIVO[clave]}.pptx`;
}

/**
 * La misma nota en A4 vertical, que es lo que se imprime.
 *
 * A 794×1123 px el lienzo sale a 2× (unos 200 ppp en A4), de sobra para una
 * hoja de texto: subirlo más sólo engorda el PDF que alguien va a mandar por
 * WhatsApp para que lo impriman en el hotel.
 */
export async function exportNotaPdf(clave: ClaveNota, nota: NotaVestuario) {
  const canvas = await hoja(794, 1123, nota);

  const doc = await pdfDeLienzos([canvas.toDataURL("image/png")], {
    ancho: canvas.width,
    alto: canvas.height,
    orientacion: "portrait",
    /* A sangre: el papel del diseño ES el papel del folio. */
    margen: 0,
  });

  doc.save(`${ARCHIVO[clave]}.pdf`);

  return `${ARCHIVO[clave]}.pdf`;
}
