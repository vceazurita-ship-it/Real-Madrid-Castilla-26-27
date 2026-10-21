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
  /** El pie: «RMCF CASTILLA · ALGECIRAS CF · 25/10/2026». Sin él, no hay pie. */
  pie?: string;
}

/** Una caja de texto de la lámina, para el PowerPoint (en tanto por uno). */
export type TextoLamina = { capa: { x: number; y: number; w: number; h: number }; texto: TextoPptx; nombre: string };

const PAD = 48;
const BANDA = 124;
const PIE = 52;
/** La columna de la derecha: quién es quién y lo que se cuenta. */
const COLUMNA = 500;

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

type Escribe = (
  contenido: string,
  x: number,
  base: number,
  tamano: number,
  peso: 500 | 600 | 700,
  tinta: string,
  alinea?: "izq" | "dcha" | "centro",
  letra?: number,
  nombre?: string,
) => void;

/** Lo que escribe un texto en el lienzo y lo apunta para el PowerPoint. */
function escritor(ctx: CanvasRenderingContext2D, familia: string, ancho: number, alto: number, sinTextos: boolean, textos: TextoLamina[]): Escribe {
  return (contenido, x, base, tamano, peso, tinta, alinea = "izq", letra = 0, nombre = "Texto") => {
    if (!contenido) return;

    ctx.font = `${peso} ${tamano}px ${familia}, Arial, sans-serif`;
    espaciado(ctx, letra);
    ctx.fillStyle = tinta;
    ctx.textAlign = alinea === "dcha" ? "right" : alinea === "centro" ? "center" : "left";
    ctx.textBaseline = "alphabetic";

    const medido = ctx.measureText(contenido).width;

    if (!sinTextos) ctx.fillText(contenido, x, base);

    const izquierda = alinea === "dcha" ? x - medido : alinea === "centro" ? x - medido / 2 : x;

    textos.push({
      nombre,
      capa: {
        x: izquierda / ancho,
        y: (base - tamano * 0.92) / alto,
        w: (medido + 8) / ancho,
        h: (tamano * 1.2) / alto,
      },
      texto: { contenido, tamano, tinta, peso, espaciado: letra, alinea: alinea === "dcha" ? "dcha" : "izq" },
    });

    espaciado(ctx, 0);
  };
}

/** El campo con su sombra y sus esquinas redondas. */
function pintaCampo(ctx: CanvasRenderingContext2D, campo: CanvasImageSource, x: number, y: number, w: number, h: number) {
  ctx.save();
  ctx.shadowColor = "rgba(15,30,61,.28)";
  ctx.shadowBlur = 36;
  ctx.shadowOffsetY = 12;
  ctx.fillStyle = PALETA_LAMINA.azul;
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
}

/** Un punto de la leyenda: el color de la ficha con su borde. */
function puntoLeyenda(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string, borde: string) {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = borde;
  ctx.stroke();
}

/**
 * Pinta la lámina entera en el lienzo (1920 × 1080).
 *
 * El campo mide SIEMPRE lo mismo, haya nota o no (21/10/2026: en el PDF la
 * hoja sin nota sacaba el campo más grande que la de al lado y parecía otra
 * jugada). Lo que se cuenta y quién es quién van en una columna a la derecha:
 * debajo, con el campo apaisado de un 16:9, la nota se comía el alto y el
 * campo se quedaba en la mitad del ancho.
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
  const escribe = escritor(ctx, familia, LAMINA_W, LAMINA_H, sinTextos, textos);

  /* Papel. */
  ctx.fillStyle = C.papel;
  ctx.fillRect(0, 0, LAMINA_W, LAMINA_H);

  /* La banda de arriba, a sangre, con el filo rosa de la plantilla. */
  ctx.fillStyle = C.azul;
  ctx.fillRect(0, 0, LAMINA_W, BANDA);
  ctx.fillStyle = C.rosa;
  ctx.fillRect(0, BANDA, LAMINA_W, 6);

  escribe("RMCF CASTILLA · PIZARRA TÁCTICA", PAD, 46, 24, 600, C.rosa, "izq", 5, "Cabecera");

  ctx.font = `700 56px ${familia}, Arial, sans-serif`;
  escribe(cabe(ctx, datos.titulo.toUpperCase(), LAMINA_W * 0.55), PAD, 104, 56, 700, C.crema, "izq", 1, "Título");

  const escenaRotulo = datos.total > 1 ? `ESCENA ${datos.indice + 1} DE ${datos.total}` : "ESCENA";

  escribe(escenaRotulo, LAMINA_W - PAD, 46, 24, 600, C.rosa, "dcha", 5, "Número de escena");

  ctx.font = `600 42px ${familia}, Arial, sans-serif`;
  escribe(cabe(ctx, datos.escena, LAMINA_W * 0.36), LAMINA_W - PAD, 102, 42, 600, C.crema, "dcha", 0, "Escena");

  /* El pie, a sangre: de quién, contra quién y cuándo. */
  if (datos.pie) {
    ctx.fillStyle = C.crema;
    ctx.fillRect(0, LAMINA_H - PIE, LAMINA_W, PIE);
    escribe(datos.pie.toUpperCase(), PAD, LAMINA_H - 17, 22, 600, C.gris, "izq", 4, "Pie");
  }

  /* El campo: lo más grande que quepa a la izquierda de la columna. */
  const arriba = BANDA + 6 + 30;
  const abajo = LAMINA_H - (datos.pie ? PIE : 0) - 30;
  const huecoAncho = LAMINA_W - PAD * 2 - COLUMNA - 40;
  const huecoAlto = abajo - arriba;

  const escala = Math.min(huecoAncho / campo.width, huecoAlto / campo.height);
  const w = campo.width * escala;
  const h = campo.height * escala;
  const x = PAD + (huecoAncho - w) / 2;
  const y = arriba + (huecoAlto - h) / 2;

  pintaCampo(ctx, campo, x, y, w, h);

  /* La columna: quién es quién arriba, lo que se cuenta debajo. */
  const cx = LAMINA_W - PAD - COLUMNA;
  let cursor = y;

  if (datos.leyenda?.length) {
    for (const item of datos.leyenda) {
      puntoLeyenda(ctx, cx + 16, cursor + 20, 15, item.color, item.borde);

      ctx.font = `600 30px ${familia}, Arial, sans-serif`;
      escribe(cabe(ctx, item.texto, COLUMNA - 52), cx + 46, cursor + 31, 30, 600, C.azul, "izq", 0, "Leyenda");
      cursor += 52;
    }

    cursor += 22;
  }

  const nota = (datos.nota ?? "").trim();

  if (nota) {
    const TAM = 34;
    const INTER = 44;

    ctx.font = `500 ${TAM}px ${familia}, Arial, sans-serif`;
    const maximo = Math.max(2, Math.floor((y + h - cursor - 96) / INTER));
    const lineas = renglones(ctx, nota, COLUMNA - 66, maximo);
    const alto = 76 + lineas.length * INTER;

    ctx.fillStyle = C.crema;
    ctx.beginPath();
    ctx.roundRect(cx, cursor, COLUMNA, alto, 16);
    ctx.fill();
    ctx.fillStyle = C.rosa;
    ctx.fillRect(cx, cursor, 10, alto);

    escribe("LO QUE SE CUENTA", cx + 36, cursor + 42, 22, 600, C.gris, "izq", 4, "Rótulo de la nota");

    lineas.forEach((linea, indice) =>
      escribe(linea, cx + 36, cursor + 52 + TAM * 0.92 + indice * INTER, TAM, 500, C.azul, "izq", 0, `Nota ${indice + 1}`),
    );
  }

  return textos;
}

/**
 * La lámina del teléfono (1080 × 1920): el campo de pie, que es como se mira
 * un vídeo en el móvil, con la cabecera arriba y lo que se cuenta debajo.
 */
export const VERTICAL_W = 1080;
export const VERTICAL_H = 1920;

export function pintaLaminaVertical(
  ctx: CanvasRenderingContext2D,
  campo: CanvasImageSource & { width: number; height: number },
  datos: DatosLamina,
  familia: string,
) {
  const C = PALETA_LAMINA;
  const escribe = escritor(ctx, familia, VERTICAL_W, VERTICAL_H, false, []);
  const P = 44;
  const CAB = 230;

  ctx.fillStyle = C.papel;
  ctx.fillRect(0, 0, VERTICAL_W, VERTICAL_H);
  ctx.fillStyle = C.azul;
  ctx.fillRect(0, 0, VERTICAL_W, CAB);
  ctx.fillStyle = C.rosa;
  ctx.fillRect(0, CAB, VERTICAL_W, 8);

  escribe("RMCF CASTILLA · PIZARRA TÁCTICA", P, 62, 26, 600, C.rosa, "izq", 4);

  ctx.font = `700 64px ${familia}, Arial, sans-serif`;
  escribe(cabe(ctx, datos.titulo.toUpperCase(), VERTICAL_W - P * 2), P, 140, 64, 700, C.crema, "izq", 1);

  const escenaRotulo = datos.total > 1 ? `${datos.indice + 1}/${datos.total} · ` : "";

  ctx.font = `600 40px ${familia}, Arial, sans-serif`;
  escribe(cabe(ctx, `${escenaRotulo}${datos.escena}`, VERTICAL_W - P * 2), P, 198, 40, 600, C.crema, "izq");

  /* El campo de pie: girado un cuarto de vuelta, nuestra portería abajo. */
  const nota = (datos.nota ?? "").trim();
  const leyendaAlto = datos.leyenda?.length ? 64 : 0;
  const pieAlto = datos.pie ? 60 : 0;

  ctx.font = `500 38px ${familia}, Arial, sans-serif`;
  const lineas = nota ? renglones(ctx, nota, VERTICAL_W - P * 2 - 60, 4) : [];
  const notaAlto = lineas.length ? 50 + lineas.length * 50 : 0;

  const arriba = CAB + 8 + 30;
  const huecoAlto = VERTICAL_H - arriba - 30 - leyendaAlto - (notaAlto ? notaAlto + 24 : 0) - pieAlto;
  const huecoAncho = VERTICAL_W - P * 2;

  /* Girado, el ancho del campo es su alto. */
  const escala = Math.min(huecoAncho / campo.height, huecoAlto / campo.width);
  const w = campo.height * escala;
  const h = campo.width * escala;
  const x = (VERTICAL_W - w) / 2;
  const y = arriba;

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 18);
  ctx.clip();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.drawImage(campo, -h / 2, -w / 2, h, w);
  ctx.restore();

  let cursor = y + h + 30;

  if (datos.leyenda?.length) {
    let lx = P;

    for (const item of datos.leyenda) {
      puntoLeyenda(ctx, lx + 15, cursor + 14, 15, item.color, item.borde);
      ctx.font = `600 32px ${familia}, Arial, sans-serif`;

      const texto = cabe(ctx, item.texto, (VERTICAL_W - P * 2) / 2 - 60);
      const ancho = ctx.measureText(texto).width;

      escribe(texto, lx + 42, cursor + 26, 32, 600, C.azul, "izq");
      lx += 42 + ancho + 40;
    }

    cursor += leyendaAlto;
  }

  if (lineas.length) {
    ctx.fillStyle = C.crema;
    ctx.beginPath();
    ctx.roundRect(P, cursor, VERTICAL_W - P * 2, notaAlto, 16);
    ctx.fill();
    ctx.fillStyle = C.rosa;
    ctx.fillRect(P, cursor, 10, notaAlto);

    lineas.forEach((linea, indice) => escribe(linea, P + 40, cursor + 25 + 38 * 0.92 + indice * 50, 38, 500, C.azul, "izq"));
  }

  if (datos.pie) {
    ctx.fillStyle = C.crema;
    ctx.fillRect(0, VERTICAL_H - pieAlto, VERTICAL_W, pieAlto);
    ctx.font = `600 24px ${familia}, Arial, sans-serif`;
    escribe(cabe(ctx, datos.pie.toUpperCase(), VERTICAL_W - P * 2), P, VERTICAL_H - 21, 24, 600, C.gris, "izq", 3);
  }
}

/** El escudo del club, una vez: para la portada del vídeo y el póster. */
let escudo: Promise<HTMLImageElement | null> | null = null;

export function cargaEscudo(): Promise<HTMLImageElement | null> {
  if (escudo) return escudo;

  escudo = (async () => {
    try {
      const imagen = new Image();

      imagen.src = "/logo.png";
      await imagen.decode();

      return imagen;
    } catch {
      return null;
    }
  })();

  return escudo;
}

export interface DatosPortada {
  titulo: string;
  /** «Contra Algeciras CF · domingo 25/10». Sin partido, no sale. */
  partido?: string;
  /** «3 escenas · 14 s». */
  detalle?: string;
}

/**
 * La portada del vídeo: lo primero que se ve en el grupo y la imagen que va
 * de póster en el correo. Azul de la plantilla, escudo, el nombre de la
 * jugada y contra quién.
 */
export function pintaPortada(
  ctx: CanvasRenderingContext2D,
  ancho: number,
  alto: number,
  datos: DatosPortada,
  familia: string,
  escudoImg: HTMLImageElement | null,
) {
  const C = PALETA_LAMINA;
  const escribe = escritor(ctx, familia, ancho, alto, false, []);
  const vertical = alto > ancho;
  const P = vertical ? 64 : 120;

  ctx.fillStyle = C.azul;
  ctx.fillRect(0, 0, ancho, alto);
  ctx.fillStyle = C.rosa;
  ctx.fillRect(0, alto - 14, ancho, 14);

  const lado = vertical ? 260 : 220;
  const centroY = vertical ? alto * 0.36 : alto * 0.4;

  if (escudoImg) {
    const proporcion = escudoImg.naturalWidth / Math.max(1, escudoImg.naturalHeight);
    const eh = lado;
    const ew = eh * proporcion;

    ctx.drawImage(escudoImg, vertical ? (ancho - ew) / 2 : P, centroY - eh / 2 - (vertical ? 60 : 0), ew, eh);
  }

  const textoX = vertical ? ancho / 2 : P + (escudoImg ? lado * 1.1 + 60 : 0);
  const alinea = vertical ? "centro" : "izq";
  const maxAncho = vertical ? ancho - P * 2 : ancho - textoX - P;
  const baseTitulo = vertical ? centroY + lado / 2 + 140 : centroY + 30;

  escribe("RMCF CASTILLA · PIZARRA TÁCTICA", textoX, baseTitulo - (vertical ? 120 : 110), vertical ? 30 : 30, 600, C.rosa, alinea, 6);

  const tam = vertical ? 92 : 104;

  ctx.font = `700 ${tam}px ${familia}, Arial, sans-serif`;

  const lineas = renglones(ctx, datos.titulo.toUpperCase(), maxAncho, 2);

  lineas.forEach((linea, indice) => escribe(linea, textoX, baseTitulo + indice * tam * 1.02, tam, 700, C.crema, alinea, 1));

  let base = baseTitulo + (lineas.length - 1) * tam * 1.02 + (vertical ? 90 : 84);

  if (datos.partido) {
    ctx.font = `600 ${vertical ? 46 : 48}px ${familia}, Arial, sans-serif`;
    escribe(cabe(ctx, datos.partido, maxAncho), textoX, base, vertical ? 46 : 48, 600, C.crema, alinea);
    base += vertical ? 64 : 66;
  }

  if (datos.detalle) escribe(datos.detalle.toUpperCase(), textoX, base, 28, 600, C.rosa, alinea, 4);
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

/** El primer H.264 que este navegador sabe codificar a ese tamaño. */
export async function codecLamina(ancho = LAMINA_W, alto = LAMINA_H, bitrate = 6_000_000): Promise<string | null> {
  if (!puedeHacerVideo()) return null;

  for (const codec of ["avc1.640028", "avc1.4d4028", "avc1.42e028"]) {
    try {
      const r = await VideoEncoder.isConfigSupported({
        codec,
        width: ancho,
        height: alto,
        bitrate,
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
