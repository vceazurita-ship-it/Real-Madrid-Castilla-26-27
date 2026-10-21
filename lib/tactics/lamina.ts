/*
|--------------------------------------------------------------------------
| LA LÁMINA DE LA PIZARRA (21/10/2026)
|--------------------------------------------------------------------------
|
| El PNG de la pizarra era una foto del marco tal cual: el campo sin título,
| sin decir qué escena era ni qué había que mirar, y con lo que estuviera
| encima en ese momento. Para mandarlo por el grupo o proyectarlo había que
| explicarlo aparte.
|
| Ahora todo lo que sale de la pizarra —PNG, PDF, PowerPoint y vídeo— es la
| misma lámina de 1920 × 1080, con el lenguaje de la plantilla del club
| (`public/INDIVIDUAL.pptx`, ver `lib/rivals/once-pdf.ts`): banda azul con el
| título y la escena, el campo, quién es quién y lo que se cuenta en la
| escena. Si una escena no tiene nota, no sale el recuadro: no se rellena con
| nada.
|
| **El campo no se fotografía con `html-to-image`.** Se copia el SVG tal y
| como está pintado, con sus fotos incrustadas, y se dibuja en el lienzo: es
| lo que permite sacar los treinta fotogramas por segundo del vídeo sin que
| cada uno tarde medio segundo.
*/

import type { TextoPptx } from "@/lib/export/pptx";

export const LAMINA_W = 1920;
export const LAMINA_H = 1080;

/** La paleta de la plantilla del club (ver `pdf-diseno-plantilla-club`). */
export const PALETA_LAMINA = {
  papel: "#FFFFFF",
  azul: "#0F1E3D",
  crema: "#F7F4EC",
  rosa: "#F6AFB6",
  verde: "#1B3A2E",
  gris: "#5B6476",
} as const;

const FAMILIA = "LaminaBarlow";

let fuentes: Promise<string> | null = null;

/**
 * Barlow Condensed para el lienzo, la letra de la plantilla.
 *
 * Se pide una vez y se queda. Si no llega (sin red y sin caché), se dibuja
 * con la del sistema: la lámina sale igual, con otra letra.
 */
export function cargaFuentesLamina(): Promise<string> {
  if (fuentes) return fuentes;

  fuentes = (async () => {
    if (typeof FontFace === "undefined" || typeof document === "undefined") return "Arial";

    try {
      const pesos = [
        ["500", "/fuentes/BarlowCondensed-Medium.ttf"],
        ["600", "/fuentes/BarlowCondensed-SemiBold.ttf"],
        ["700", "/fuentes/BarlowCondensed-Bold.ttf"],
      ] as const;

      await Promise.all(
        pesos.map(async ([peso, url]) => {
          const cara = new FontFace(FAMILIA, `url(${url})`, { weight: peso });

          await cara.load();
          document.fonts.add(cara);
        }),
      );

      return FAMILIA;
    } catch (error) {
      console.warn("[pizarra] sin Barlow para la lámina", error);

      return "Arial";
    }
  })();

  return fuentes;
}

/* ------------------------------------------------------------------ */
/*  EL CAMPO, COMO IMAGEN                                              */
/* ------------------------------------------------------------------ */

/** Imágenes ya incrustadas, por dirección: el balón y las caras no se piden dos veces. */
const incrustadas = new Map<string, Promise<string>>();

function incrusta(href: string): Promise<string> {
  const conocida = incrustadas.get(href);

  if (conocida) return conocida;

  const promesa = (async () => {
    try {
      const respuesta = await fetch(href);

      if (!respuesta.ok) return "";

      const blob = await respuesta.blob();

      return await new Promise<string>((resolve) => {
        const lector = new FileReader();

        lector.onload = () => resolve(String(lector.result ?? ""));
        lector.onerror = () => resolve("");
        lector.readAsDataURL(blob);
      });
    } catch {
      return "";
    }
  })();

  incrustadas.set(href, promesa);

  return promesa;
}

/**
 * El SVG del campo, listo para dibujarlo en un lienzo.
 *
 * Se clona, se le quitan los cuadros de edición (`foreignObject`), se le
 * incrustan las imágenes —un SVG dibujado como imagen no puede ir a buscar
 * nada fuera— y se le pone la letra, que dentro de una imagen no se hereda.
 */
export async function imagenDelCampo(svg: SVGSVGElement, ancho: number): Promise<HTMLImageElement> {
  const clon = svg.cloneNode(true) as SVGSVGElement;

  const [, , vbAncho, vbAlto] = (svg.getAttribute("viewBox") ?? "0 0 100 68").split(/\s+/).map(Number);

  const alto = Math.round((ancho * (vbAlto || 68)) / (vbAncho || 100));

  clon.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clon.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
  clon.setAttribute("width", String(ancho));
  clon.setAttribute("height", String(alto));
  clon.removeAttribute("class");
  clon.setAttribute("font-family", "Arial, Helvetica, sans-serif");

  clon.querySelectorAll("foreignObject").forEach((nodo) => nodo.remove());
  clon.querySelectorAll("title").forEach((nodo) => nodo.remove());

  await Promise.all(
    [...clon.querySelectorAll("image")].map(async (imagen) => {
      const href = imagen.getAttribute("href") ?? imagen.getAttribute("xlink:href") ?? "";

      if (!href || href.startsWith("data:")) return;

      const datos = await incrusta(new URL(href, window.location.href).toString());

      if (datos) imagen.setAttribute("href", datos);
      else imagen.remove();
    }),
  );

  const texto = new XMLSerializer().serializeToString(clon);
  const url = URL.createObjectURL(new Blob([texto], { type: "image/svg+xml;charset=utf-8" }));

  try {
    const imagen = new Image();

    imagen.decoding = "async";
    imagen.src = url;

    await imagen.decode();

    return imagen;
  } finally {
    /* Ya decodificada, la imagen no necesita la dirección. */
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

/* ------------------------------------------------------------------ */
/*  LA LÁMINA                                                          */
/* ------------------------------------------------------------------ */

export interface DatosLamina {
  /** Nombre de la pizarra: «Salida de balón ante 4-4-2». */
  titulo: string;
  /** Nombre de la escena. */
  escena: string;
  /** 0, 1, 2… */
  indice: number;
  total: number;
  /** Lo que se cuenta en la escena. Sin nota, no sale el recuadro. */
  nota?: string;
  /** Quién es quién, sólo de los equipos que están en el campo. */
  leyenda?: { color: string; borde: string; texto: string }[];
}

/** Una caja de texto de la lámina, para el PowerPoint (en tanto por uno). */
export type TextoLamina = { capa: { x: number; y: number; w: number; h: number }; texto: TextoPptx; nombre: string };

const PAD = 64;
const BANDA = 150;

/** Parte un texto en renglones que quepan en `ancho`, con «…» si no cabe en `maximo`. */
function renglones(ctx: CanvasRenderingContext2D, texto: string, ancho: number, maximo: number) {
  const salida: string[] = [];

  for (const parrafo of texto.split(/\r?\n/)) {
    const palabras = parrafo.split(/\s+/).filter(Boolean);
    let linea = "";

    for (const palabra of palabras) {
      const prueba = linea ? `${linea} ${palabra}` : palabra;

      if (ctx.measureText(prueba).width <= ancho || !linea) {
        linea = prueba;
      } else {
        salida.push(linea);
        linea = palabra;
      }
    }

    if (linea) salida.push(linea);
  }

  if (salida.length <= maximo) return salida;

  const corte = salida.slice(0, maximo);
  let ultima = corte[maximo - 1];

  while (ultima.length > 1 && ctx.measureText(`${ultima}…`).width > ancho) ultima = ultima.slice(0, -1);

  corte[maximo - 1] = `${ultima.trimEnd()}…`;

  return corte;
}

/** Recorta un texto de una línea para que quepa en `ancho`. */
function cabe(ctx: CanvasRenderingContext2D, texto: string, ancho: number) {
  if (ctx.measureText(texto).width <= ancho) return texto;

  let corto = texto;

  while (corto.length > 1 && ctx.measureText(`${corto}…`).width > ancho) corto = corto.slice(0, -1);

  return `${corto.trimEnd()}…`;
}

function espaciado(ctx: CanvasRenderingContext2D, px: number) {
  /* `letterSpacing` del lienzo: Chrome y Safari 17 lo tienen; si no, nada. */
  (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = `${px}px`;
}

/**
 * Pinta la lámina entera en el lienzo (1920 × 1080).
 *
 * Con `sinTextos` deja los huecos de los textos vacíos y los devuelve para
 * escribirlos como cajas de texto del PowerPoint, que así se corrigen allí.
 */
export function pintaLamina(
  ctx: CanvasRenderingContext2D,
  campo: CanvasImageSource & { width: number; height: number },
  datos: DatosLamina,
  familia: string,
  { sinTextos = false }: { sinTextos?: boolean } = {},
): TextoLamina[] {
  const C = PALETA_LAMINA;
  const textos: TextoLamina[] = [];

  const escribe = (
    contenido: string,
    x: number,
    base: number,
    tamano: number,
    peso: 500 | 600 | 700,
    tinta: string,
    alinea: "izq" | "dcha" = "izq",
    letra = 0,
    nombre = "Texto",
  ) => {
    if (!contenido) return;

    ctx.font = `${peso} ${tamano}px ${familia}, Arial, sans-serif`;
    espaciado(ctx, letra);
    ctx.fillStyle = tinta;
    ctx.textAlign = alinea === "dcha" ? "right" : "left";
    ctx.textBaseline = "alphabetic";

    const ancho = ctx.measureText(contenido).width;

    if (!sinTextos) ctx.fillText(contenido, x, base);

    const izquierda = alinea === "dcha" ? x - ancho : x;

    textos.push({
      nombre,
      capa: {
        x: izquierda / LAMINA_W,
        y: (base - tamano * 0.92) / LAMINA_H,
        w: (ancho + 8) / LAMINA_W,
        h: (tamano * 1.2) / LAMINA_H,
      },
      texto: { contenido, tamano, tinta, peso, espaciado: letra, alinea: alinea === "dcha" ? "dcha" : "izq" },
    });

    espaciado(ctx, 0);
  };

  /* Papel. */
  ctx.fillStyle = C.papel;
  ctx.fillRect(0, 0, LAMINA_W, LAMINA_H);

  /* La banda de arriba, con el filo rosa de la plantilla. */
  ctx.fillStyle = C.azul;
  ctx.fillRect(0, 0, LAMINA_W, BANDA);
  ctx.fillStyle = C.rosa;
  ctx.fillRect(0, BANDA, LAMINA_W, 6);

  ctx.font = `600 24px ${familia}, Arial, sans-serif`;
  const kicker = "RMCF CASTILLA · PIZARRA TÁCTICA";

  escribe(kicker, PAD, 56, 24, 600, C.rosa, "izq", 5, "Cabecera");

  ctx.font = `700 60px ${familia}, Arial, sans-serif`;
  const tituloCabe = cabe(ctx, datos.titulo.toUpperCase(), LAMINA_W * 0.5);

  escribe(tituloCabe, PAD, 118, 60, 700, C.crema, "izq", 1, "Título");

  const escenaRotulo = datos.total > 1 ? `ESCENA ${datos.indice + 1} DE ${datos.total}` : "ESCENA";

  escribe(escenaRotulo, LAMINA_W - PAD, 56, 24, 600, C.rosa, "dcha", 5, "Número de escena");

  ctx.font = `600 44px ${familia}, Arial, sans-serif`;
  escribe(cabe(ctx, datos.escena, LAMINA_W * 0.4), LAMINA_W - PAD, 116, 44, 600, C.crema, "dcha", 0, "Escena");

  /* La nota: se mide antes, porque decide cuánto sitio queda para el campo. */
  const nota = (datos.nota ?? "").trim();
  const TAM_NOTA = 36;
  const INTERLINEA = 46;

  ctx.font = `500 ${TAM_NOTA}px ${familia}, Arial, sans-serif`;
  const lineas = nota ? renglones(ctx, nota, LAMINA_W - PAD * 2 - 70, 3) : [];

  const altoNota = lineas.length ? 44 + lineas.length * INTERLINEA : 0;
  const altoLeyenda = datos.leyenda?.length ? 44 : 0;

  /* El campo, lo más grande que quepa. */
  const arriba = BANDA + 34;
  const abajo = LAMINA_H - 40 - altoNota - (altoNota ? 24 : 0) - altoLeyenda;
  const huecoAncho = LAMINA_W - PAD * 2;
  const huecoAlto = Math.max(200, abajo - arriba);

  const escala = Math.min(huecoAncho / campo.width, huecoAlto / campo.height);
  const w = campo.width * escala;
  const h = campo.height * escala;
  const x = (LAMINA_W - w) / 2;
  const y = arriba + (huecoAlto - h) / 2;

  ctx.save();
  ctx.shadowColor = "rgba(15,30,61,.28)";
  ctx.shadowBlur = 36;
  ctx.shadowOffsetY = 12;
  ctx.fillStyle = C.azul;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 18);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 18);
  ctx.clip();
  ctx.drawImage(campo, x, y, w, h);
  ctx.restore();

  /* Quién es quién, bajo el campo. */
  let cursor = y + h + 34;

  if (datos.leyenda?.length) {
    let lx = x;

    for (const item of datos.leyenda) {
      ctx.beginPath();
      ctx.arc(lx + 11, cursor - 9, 11, 0, Math.PI * 2);
      ctx.fillStyle = item.color;
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = item.borde;
      ctx.stroke();

      ctx.font = `600 26px ${familia}, Arial, sans-serif`;
      const ancho = ctx.measureText(item.texto).width;

      escribe(item.texto, lx + 32, cursor, 26, 600, C.azul, "izq", 0, "Leyenda");
      lx += 32 + ancho + 40;
    }

    cursor += altoLeyenda - 34 + 24;
  } else {
    cursor = y + h + 24;
  }

  if (lineas.length) {
    const top = Math.max(cursor, LAMINA_H - 40 - altoNota);

    ctx.fillStyle = C.crema;
    ctx.beginPath();
    ctx.roundRect(PAD, top, LAMINA_W - PAD * 2, altoNota, 16);
    ctx.fill();
    ctx.fillStyle = C.rosa;
    ctx.fillRect(PAD, top, 10, altoNota);

    lineas.forEach((linea, indice) =>
      escribe(linea, PAD + 46, top + 22 + TAM_NOTA * 0.92 + indice * INTERLINEA, TAM_NOTA, 500, C.azul, "izq", 0, `Nota ${indice + 1}`),
    );
  }

  return textos;
}

/** Un lienzo de lámina nuevo, con su contexto. */
export function lienzoLamina() {
  const lienzo = document.createElement("canvas");

  lienzo.width = LAMINA_W;
  lienzo.height = LAMINA_H;

  const ctx = lienzo.getContext("2d");

  if (!ctx) throw new Error("El navegador no da un lienzo 2D");

  return { lienzo, ctx };
}

/* ------------------------------------------------------------------ */
/*  EL VÍDEO                                                           */
/* ------------------------------------------------------------------ */

export const FPS_LAMINA = 30;

/** ¿Sabe este navegador montar el MP4 sin grabar la pantalla? */
export function puedeHacerVideo() {
  return typeof VideoEncoder !== "undefined" && typeof VideoFrame !== "undefined";
}

/** El primer H.264 que este navegador sabe codificar a 1920 × 1080. */
export async function codecLamina(): Promise<string | null> {
  if (!puedeHacerVideo()) return null;

  for (const codec of ["avc1.640028", "avc1.4d4028", "avc1.42e028"]) {
    try {
      const r = await VideoEncoder.isConfigSupported({
        codec,
        width: LAMINA_W,
        height: LAMINA_H,
        bitrate: 6_000_000,
        framerate: FPS_LAMINA,
        avc: { format: "avc" },
      });

      if (r.supported) return codec;
    } catch {
      /* El siguiente. */
    }
  }

  return null;
}
