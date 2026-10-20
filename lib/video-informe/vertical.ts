/*
|--------------------------------------------------------------------------
| EL VÍDEO PARA JUGADORES EN VERTICAL (9:16) — 21/10/2026
|--------------------------------------------------------------------------
|
| Los jugadores ven la pieza «Consignas» en el móvil, por WhatsApp: el 16:9
| se veía en una franja y la letra no se leía (crítica del productor y del
| editor de vídeo). Aquí cada escena de la lista blanca de la pieza tiene su
| composición propia sobre un lienzo LÓGICO de 720×1280 que sale a 1080×1920
| (×1,5, igual que el horizontal sale de 1280×720 a Full HD).
|
| Reglas de la composición:
|   - Letra de lectura ≥ 32 px aquí (48 de verdad) y títulos ≥ 48 (72).
|   - El 10 % de arriba y el de abajo (128 px) quedan libres: ahí WhatsApp
|     pinta su interfaz (nombre, botones, la barra del vídeo).
|   - Los cortes, encajados a lo ancho, con el título arriba y el rótulo
|     grande debajo, fuera de la jugada.
|   - La portada abre el vídeo y está entera desde el primer fotograma: es
|     lo que WhatsApp enseña como miniatura (el póster vertical).
| Sólo entran los tipos de `ESCENAS_VERTICALES`; lo demás no se compone en
| vertical y sale de la pieza (`paraVertical`).
*/

import { anillo, caja, cortinilla, espaciado, sale, salta, tramo } from "./movimiento";
import { corteEn, espaciadoAncho, halo, iconoEstado, medallon, parteLineas, tarjeta, zonaEnPalabras, type Dibujable, type Fotograma, type Lienzo, type Recursos } from "./dibujo";
import type { Corte, CortePartido, Escena, GuionVideo } from "./guion";

export const ANCHO_V = 720;
export const ALTO_V = 1280;
export const ANCHO_V_HD = 1080;
export const ALTO_V_HD = 1920;

/** La franja libre arriba y abajo (10 %): la interfaz de WhatsApp. */
const SEGURO = 128;
const MARGEN = 48;
const UTIL = ANCHO_V - 2 * MARGEN;

const LECTURA = 32;
const TITULO = 48;
const ETIQUETA = 26;

const FONDO = "#08111F";
const ORO = "#C8A96B";
const ORO_CLARO = "#E3C98F";
const BLANCO = "#FFFFFF";
const VERDE = "#2EE6A6";
const ROJO = "#FF5A5F";
const TINTA = "#0B0F14";

/** Los tipos de escena que tienen composición vertical. */
export const ESCENAS_VERTICALES = new Set<Escena["tipo"]>(["portada", "gancho", "claves", "vigilar", "clips", "balance", "cierre"]);

/**
 * El guion de la pieza en vertical: sólo lo que se compone limpio en 9:16 y
 * con la portada delante (la miniatura de WhatsApp es el primer fotograma).
 */
export function paraVertical(guion: GuionVideo): GuionVideo {
  const escenas = guion.escenas.filter((e) => ESCENAS_VERTICALES.has(e.tipo));
  const portada = escenas.findIndex((e) => e.tipo === "portada");

  if (portada > 0) escenas.unshift(...escenas.splice(portada, 1));

  return { ...guion, escenas };
}

const entra = (t: number, desde: number, cuanto = 0.45) => sale((t - desde) / cuanto);

/**
 * Un texto a la medida: baja la letra desde `tam` hasta `minimo` hasta que
 * quepa en `maxLineas`; a la letra mínima se queda con las que quepan (las
 * consignas ya vienen cortas del guion, sin «…»). `entero` dice si ha cabido
 * todo: un texto secundario que no cabe entero no se pinta (no se corta a
 * media frase).
 */
function ajusta(ctx: Lienzo, fuente: string, texto: string, peso: number, tam: number, minimo: number, ancho: number, maxLineas: number) {
  let t = tam;

  for (;;) {
    ctx.font = `${peso} ${t}px ${fuente}`;

    const lineas = parteLineas(ctx, texto, ancho);

    if (lineas.length <= maxLineas || t <= minimo) return { tam: t, lineas: lineas.slice(0, maxLineas), entero: lineas.length <= maxLineas };

    t -= 2;
  }
}

/** Líneas centradas en `x`, a partir de la base `y`; devuelve dónde acaba la última. */
function centradas(ctx: Lienzo, lineas: string[], x: number, y: number, interlinea: number) {
  ctx.textAlign = "center";
  lineas.forEach((l, i) => ctx.fillText(l, x, y + i * interlinea));
  ctx.textAlign = "left";

  return y + (lineas.length - 1) * interlinea;
}

/** El título de la escena arriba (dentro de la zona segura): en mayúsculas, hasta dos renglones, con subrayado de oro. Devuelve dónde acaba. */
function tituloV(ctx: Lienzo, fuente: string, texto: string, t: number, y = SEGURO + 116) {
  const { tam, lineas } = ajusta(ctx, fuente, texto.toUpperCase(), 700, 56, TITULO, UTIL, 2);
  const a = tramo(t, 0.05, 0.55);

  ctx.globalAlpha = a;
  ctx.fillStyle = BLANCO;
  ctx.font = `700 ${tam}px ${fuente}`;
  ctx.textAlign = "left";
  lineas.forEach((l, i) => ctx.fillText(l, MARGEN, y + i * (tam + 4) + (1 - a) * 18));

  const fin = y + (lineas.length - 1) * (tam + 4);

  ctx.globalAlpha = 1;
  ctx.fillStyle = ORO;
  ctx.fillRect(MARGEN, fin + 18, 120 * tramo(t, 0.3, 0.6), 5);

  return fin + 18;
}

/* ------------------------------------------------------------------ */
/*  EL FONDO Y EL ACABADO                                              */
/* ------------------------------------------------------------------ */

function fondo(ctx: Lienzo, global: number) {
  ctx.fillStyle = FONDO;
  ctx.fillRect(0, 0, ANCHO_V, ALTO_V);

  /* El césped insinuado: franjas en diagonal muy suaves que se desplazan despacio. */
  ctx.save();
  ctx.globalAlpha = 0.05;
  ctx.fillStyle = "#2A6B47";
  ctx.translate(ANCHO_V / 2, ALTO_V / 2);
  ctx.rotate(-0.35);

  const paso = 120;
  const desplaza = (global * 6) % (paso * 2);

  for (let x = -ALTO_V - paso * 2; x < ALTO_V; x += paso * 2) ctx.fillRect(x + desplaza, -ALTO_V, paso, ALTO_V * 2);

  ctx.restore();

  const g = ctx.createRadialGradient(ANCHO_V * 0.8, ALTO_V * 0.15, 0, ANCHO_V * 0.8, ALTO_V * 0.15, 760 + Math.sin(global * 0.8) * 40);
  g.addColorStop(0, "rgba(200,169,107,0.2)");
  g.addColorStop(1, "rgba(200,169,107,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, ANCHO_V, ALTO_V);
}

function acabado(ctx: Lienzo, grano: Dibujable, progreso: number, fuente: string) {
  const v = ctx.createRadialGradient(ANCHO_V / 2, ALTO_V / 2, ALTO_V * 0.3, ANCHO_V / 2, ALTO_V / 2, ALTO_V * 0.75);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(0,0,0,0.5)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, ANCHO_V, ALTO_V);

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;

  const anchoReal = ctx.canvas?.width || ANCHO_V;
  const altoReal = ctx.canvas?.height || ALTO_V;
  const ox = Math.floor(Math.random() * 256);
  const oy = Math.floor(Math.random() * 256);

  for (let x = -ox; x < anchoReal; x += 256) for (let y = -oy; y < altoReal; y += 256) ctx.drawImage(grano, x, y);

  ctx.restore();

  /* La firma, en la zona segura de arriba; la barra de progreso, al pie de la de abajo. */
  ctx.fillStyle = ORO;
  ctx.fillRect(MARGEN, SEGURO + 6, 36, 4);
  ctx.font = `600 22px ${fuente}`;
  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(255,255,255,0.65)";
  espaciado(ctx, "REAL MADRID CASTILLA", MARGEN + 48, SEGURO + 14, 2);

  const yBarra = ALTO_V - SEGURO - 8;

  ctx.fillStyle = "rgba(255,255,255,0.14)";
  caja(ctx, MARGEN, yBarra, UTIL, 6, 3);
  ctx.fill();
  ctx.fillStyle = ORO;
  caja(ctx, MARGEN, yBarra, Math.max(6, UTIL * progreso), 6, 3);
  ctx.fill();
}

/* ------------------------------------------------------------------ */
/*  LAS ESCENAS                                                        */
/* ------------------------------------------------------------------ */

/**
 * La portada (y la miniatura): escudos, el rival, la jornada y la consigna.
 * Está entera desde el primer fotograma; sólo respira (zoom lento y rayos).
 */
function portada(ctx: Lienzo, fuente: string, e: Extract<Escena, { tipo: "portada" }>, rec: Recursos, t: number) {
  const nos = rec.imagenes.get(`${e.id}:nosotros`) ?? null;
  const riv = rec.imagenes.get(`${e.id}:rival`) ?? null;
  const cy = 430;
  const respira = 1 + 0.015 * Math.sin(t * 1.4);

  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.translate(ANCHO_V / 2, cy);
  ctx.rotate(t * 0.08);

  const luz = ctx.createRadialGradient(0, 0, 0, 0, 0, 460);
  luz.addColorStop(0, "rgba(227,201,143,0.9)");
  luz.addColorStop(1, "rgba(227,201,143,0)");
  ctx.fillStyle = luz;
  ctx.beginPath();

  for (let i = 0; i < 12; i += 1) {
    const ang = (i * Math.PI * 2) / 12;

    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(ang - 0.07) * 460, Math.sin(ang - 0.07) * 460);
    ctx.lineTo(Math.cos(ang + 0.07) * 460, Math.sin(ang + 0.07) * 460);
    ctx.closePath();
  }

  ctx.fill();
  ctx.restore();

  const radio = 104 * respira;

  /*
  | Sin escudo del rival, ninguno (25/10/2026, marketing): nuestro escudo solo
  | sobre «ANTEQUERA CF» se leía como el escudo del Antequera. El bloque de
  | texto sube y ocupa el sitio.
  */
  const sube = riv ? 0 : -250;

  if (riv) {
    halo(ctx, ANCHO_V / 2 - 160, cy, radio * 1.55);
    medallon(ctx, fuente, nos, ANCHO_V / 2 - 160, cy, radio, "rgba(255,255,255,0.85)", "RM");
    halo(ctx, ANCHO_V / 2 + 160, cy, radio * 1.55);
    medallon(ctx, fuente, riv, ANCHO_V / 2 + 160, cy, radio, ORO, e.titulo.slice(0, 3).toUpperCase());

    /* El VS, entre los dos escudos (con uno solo no hace falta: el nombre del rival va debajo). */
    ctx.save();
    ctx.translate(ANCHO_V / 2, cy);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = "rgba(8,17,31,0.92)";
    ctx.fillRect(-30, -30, 60, 60);
    ctx.lineWidth = 3;
    ctx.strokeStyle = ORO;
    ctx.strokeRect(-30, -30, 60, 60);
    ctx.restore();
    ctx.fillStyle = ORO;
    ctx.font = `700 30px ${fuente}`;
    ctx.textAlign = "center";
    ctx.fillText("VS", ANCHO_V / 2, cy + 11);
  }

  ctx.textAlign = "center";

  /* El sello (PREVIA / POST) en su píldora. */
  ctx.font = `700 ${ETIQUETA}px ${fuente}`;

  const sello = e.sello.toUpperCase();
  const ws = espaciadoAncho(ctx, sello, 3) + 44;

  ctx.fillStyle = ORO;
  caja(ctx, ANCHO_V / 2 - ws / 2, 600 + sube, ws, 42, 21);
  ctx.fill();
  ctx.fillStyle = FONDO;
  espaciado(ctx, sello, ANCHO_V / 2, 630 + sube, 3, "center");

  /* El rival, grande. */
  const rival = ajusta(ctx, fuente, e.titulo.toUpperCase(), 700, 88, 64, UTIL, 2);

  ctx.fillStyle = BLANCO;
  ctx.font = `700 ${rival.tam}px ${fuente}`;

  let y = centradas(ctx, rival.lineas, ANCHO_V / 2, 734 + sube, rival.tam);

  ctx.fillStyle = ORO;
  ctx.fillRect(ANCHO_V / 2 - 150, y + 24, 300, 3);

  /* La jornada, el día y el campo: más grande y pegado al rival (25/10/2026, marketing: se perdía). */
  const sub = ajusta(ctx, fuente, e.subtitulo.toUpperCase(), 600, 44, LECTURA, UTIL, 2);

  ctx.fillStyle = "rgba(255,255,255,0.94)";
  ctx.font = `600 ${sub.tam}px ${fuente}`;
  y = centradas(ctx, sub.lineas, ANCHO_V / 2, y + 70, sub.tam + 6);

  /* La consigna (la idea del partido), en oro: con ella la portada vale de póster. */
  if (e.idea) {
    const idea = ajusta(ctx, fuente, e.idea.toUpperCase(), 700, 60, TITULO, UTIL, 3);

    ctx.fillStyle = ORO_CLARO;
    ctx.font = `700 ${idea.tam}px ${fuente}`;
    centradas(ctx, idea.lineas, ANCHO_V / 2, Math.min(y + 110, ALTO_V - SEGURO - 60 - (idea.lineas.length - 1) * (idea.tam + 4)), idea.tam + 4);
  }

  ctx.textAlign = "left";
}

/** El gancho: la cifra a todo el ancho, la etiqueta encima y una línea debajo. */
function gancho(ctx: Lienzo, fuente: string, e: Extract<Escena, { tipo: "gancho" }>, t: number) {
  const golpe = Math.max(0, 1 - t / 0.5);

  halo(ctx, ANCHO_V / 2, 600, 460 + golpe * 100);

  if (golpe > 0) {
    ctx.fillStyle = `rgba(255,240,210,${golpe * 0.3})`;
    ctx.fillRect(0, 0, ANCHO_V, ALTO_V);
  }

  if (e.antetitulo) {
    const ante = ajusta(ctx, fuente, e.antetitulo.toUpperCase(), 700, 40, LECTURA, UTIL, 2);

    ctx.globalAlpha = tramo(t, 0.1, 0.4);
    ctx.fillStyle = ORO;
    ctx.font = `700 ${ante.tam}px ${fuente}`;
    centradas(ctx, ante.lineas, ANCHO_V / 2, 360, ante.tam + 6);
    ctx.globalAlpha = 1;
  }

  const a = salta(t / 0.3);

  ctx.font = `700 300px ${fuente}`;

  const tam = Math.round(300 * Math.min(1, UTIL / Math.max(1, ctx.measureText(e.dato).width)));
  const base = 690;

  ctx.save();
  ctx.translate(ANCHO_V / 2, base);
  ctx.scale(0.6 + 0.4 * Math.min(1, a), 0.6 + 0.4 * Math.min(1, a));
  ctx.globalAlpha = Math.min(1, a);
  ctx.font = `700 ${tam}px ${fuente}`;
  ctx.textAlign = "center";

  const g = ctx.createLinearGradient(0, -tam * 0.75, 0, 0);
  g.addColorStop(0, "#F6E3B4");
  g.addColorStop(1, "#B8935A");
  ctx.fillStyle = g;
  ctx.fillText(e.dato, 0, 0);
  ctx.restore();

  const linea = ajusta(ctx, fuente, e.rotulo.toUpperCase(), 700, 60, TITULO, UTIL, 3);

  ctx.globalAlpha = tramo(t, 0.35, 0.45);
  ctx.fillStyle = BLANCO;
  ctx.font = `700 ${linea.tam}px ${fuente}`;
  centradas(ctx, linea.lineas, ANCHO_V / 2, base + 96, linea.tam + 6);
  ctx.globalAlpha = 1;
}

/** Las claves de una en una: la de ahora, grande en el centro; las ya dichas, abajo y atenuadas. */
function claves(ctx: Lienzo, fuente: string, e: Extract<Escena, { tipo: "claves" }>, t: number, dur: number) {
  const finTitulo = tituloV(ctx, fuente, e.titulo, t);
  const lista = e.lineas.slice(0, 3);
  const pies = e.pies ?? [];
  const n = lista.length;
  const tramoClave = Math.max(1.2, (dur - 1) / Math.max(1, n));
  const activa = Math.min(n - 1, Math.max(0, Math.floor((t - 0.4) / tramoClave)));
  const y0 = finTitulo + 50;
  /* La tarjeta llena el hueco que dejan las ya dichas (una línea de 74 px cada una, como mucho dos). */
  const alto = Math.max(420, ALTO_V - SEGURO - 50 - y0 - Math.max(0, n - 1) * 74);

  const desde = 0.4 + activa * tramoClave;
  const a = salta((t - desde) / 0.3);

  if (a > 0) {
    ctx.globalAlpha = Math.min(1, a);
    ctx.save();
    ctx.translate(ANCHO_V / 2, y0 + alto / 2);
    ctx.scale(0.94 + 0.06 * Math.min(1, a), 0.94 + 0.06 * Math.min(1, a));
    ctx.translate(-ANCHO_V / 2, -(y0 + alto / 2));
    tarjeta(ctx, MARGEN, y0, UTIL, alto);

    const texto = ajusta(ctx, fuente, lista[activa], 700, 64, TITULO, UTIL - 72, 4);
    /* El bloque (número, consigna y su dato) centrado en la tarjeta. */
    const altoNumero = n > 1 ? 150 : 0;
    const altoBloque = altoNumero + texto.lineas.length * (texto.tam + 6) + (pies[activa] ? 100 : 0);
    const arriba = y0 + Math.max(40, (alto - altoBloque) / 2);

    if (n > 1) {
      ctx.fillStyle = ORO;
      ctx.font = `700 120px ${fuente}`;
      ctx.textAlign = "left";
      ctx.fillText(String(activa + 1).padStart(2, "0"), MARGEN + 36, arriba + 100);
    }

    ctx.fillStyle = BLANCO;
    ctx.font = `700 ${texto.tam}px ${fuente}`;
    ctx.textAlign = "left";

    const yTexto = arriba + altoNumero + texto.tam;

    texto.lineas.forEach((l, k) => ctx.fillText(l, MARGEN + 36, yTexto + k * (texto.tam + 6)));

    const pie = pies[activa];

    if (pie) {
      const p = ajusta(ctx, fuente, pie, 600, 40, LECTURA, UTIL - 72, 2);

      ctx.globalAlpha = Math.min(1, a) * tramo(t, desde + 0.5, 0.5);
      ctx.fillStyle = ORO;
      ctx.font = `600 ${p.tam}px ${fuente}`;
      p.lineas.forEach((l, k) => ctx.fillText(l, MARGEN + 36, yTexto + texto.lineas.length * (texto.tam + 6) + 30 + k * (p.tam + 4)));
    }

    ctx.restore();
    ctx.globalAlpha = 1;
  }

  /* Las ya dichas: una línea cada una, bajo la tarjeta, al 45 %. */
  for (let i = 0; i < activa; i += 1) {
    const y = y0 + alto + 30 + i * 74;

    ctx.globalAlpha = 0.45;
    ctx.fillStyle = "rgba(16,30,52,0.9)";
    caja(ctx, MARGEN, y, UTIL, 62, 12);
    ctx.fill();
    ctx.fillStyle = ORO;
    ctx.font = `700 34px ${fuente}`;
    ctx.fillText(String(i + 1).padStart(2, "0"), MARGEN + 20, y + 43);

    const l = ajusta(ctx, fuente, lista[i], 500, LECTURA, LECTURA, UTIL - 100, 1);

    ctx.fillStyle = BLANCO;
    ctx.font = `500 ${l.tam}px ${fuente}`;
    ctx.fillText(l.lineas[0] ?? "", MARGEN + 80, y + 43);
    ctx.globalAlpha = 1;
  }
}

/** A quién vigilar: una tarjeta por jugador, apiladas (tres como mucho). */
function vigilar(ctx: Lienzo, fuente: string, e: Extract<Escena, { tipo: "vigilar" }>, rec: Recursos, t: number) {
  const finTitulo = tituloV(ctx, fuente, e.titulo, t);
  const jugadores = e.jugadores.slice(0, 3);
  const hueco = 24;
  const disponible = ALTO_V - SEGURO - 40 - (finTitulo + 50);
  const alto = Math.min(360, (disponible - (jugadores.length - 1) * hueco) / Math.max(1, jugadores.length));

  jugadores.forEach((j, i) => {
    const a = entra(t, 0.4 + i * 0.3, 0.6);
    const y = finTitulo + 50 + i * (alto + hueco) + (1 - a) * 40;

    ctx.globalAlpha = a;
    tarjeta(ctx, MARGEN, y, UTIL, alto, j.destacado ? ORO : "rgba(255,255,255,0.35)");
    const radioFoto = alto >= 300 ? 82 : 66;

    medallon(ctx, fuente, rec.imagenes.get(`${e.id}:${i}`) ?? null, MARGEN + 30 + radioFoto, y + alto / 2, radioFoto, j.destacado ? ORO : "rgba(255,255,255,0.7)", j.dorsal || "·");

    const x = MARGEN + 60 + radioFoto * 2;
    const ancho = UTIL - (x - MARGEN) - 24;
    const nombre = ajusta(ctx, fuente, j.nombre.toUpperCase(), 700, 58, 40, ancho, 1);
    const dato = [j.dorsal ? `#${j.dorsal}` : "", j.posicion].filter(Boolean).join(" · ");
    const txt = j.texto ? ajusta(ctx, fuente, j.texto, 500, 40, LECTURA, ancho, Math.max(1, Math.floor((alto - 140) / 46))) : null;
    /* El bloque de texto, centrado en la tarjeta. */
    const altoBloque = nombre.tam + (dato ? 40 : 0) + (txt?.entero ? 18 + txt.lineas.length * (txt.tam + 6) : 0);
    let yb = y + (alto - altoBloque) / 2 + nombre.tam * 0.8;

    ctx.fillStyle = BLANCO;
    ctx.font = `700 ${nombre.tam}px ${fuente}`;
    ctx.fillText(nombre.lineas[0] ?? "", x, yb);

    if (dato) {
      yb += 40;
      ctx.fillStyle = ORO;
      ctx.font = `600 ${ETIQUETA + 4}px ${fuente}`;
      ctx.fillText(dato, x, yb);
    }

    if (txt?.entero) {
      yb += 18;
      ctx.fillStyle = "rgba(255,255,255,0.94)";
      ctx.font = `500 ${txt.tam}px ${fuente}`;
      txt.lineas.forEach((l, k) => ctx.fillText(l, x, yb + (k + 1) * (txt.tam + 6)));
    }

    ctx.globalAlpha = 1;
  });
}

/** «GOL» sobre la jugada cuando entra el balón (el golpe de la música cae a ~5,5 s del corte). */
function estallidoGol(ctx: Lienzo, fuente: string, tc: number, cx: number, cy: number) {
  const d = tc - 5.4;

  if (d < 0 || d > 1.6) return;

  const llega = salta(d / 0.35);
  const alfa = Math.max(0, Math.min(1, llega) * (d > 1.1 ? 1 - (d - 1.1) / 0.5 : 1));

  ctx.save();
  ctx.globalAlpha = alfa;
  ctx.translate(cx, cy);
  ctx.scale(0.6 + llega * 0.4, 0.6 + llega * 0.4);
  ctx.font = `700 150px ${fuente}`;
  ctx.textAlign = "center";
  ctx.lineWidth = 8;
  ctx.strokeStyle = "rgba(8,17,31,0.85)";
  ctx.strokeText("GOL", 0, 52);
  ctx.fillStyle = ORO;
  ctx.fillText("GOL", 0, 52);
  ctx.restore();
}

/** Los cortes: el título arriba, la jugada a todo el ancho y el rótulo grande debajo. */
function clips(ctx: Lienzo, fuente: string, e: Extract<Escena, { tipo: "clips" }>, cuadro: Dibujable | null, t: number, dur: number) {
  const { k, tc, porCorte } = corteEn(e, t, dur);
  const finTitulo = tituloV(ctx, fuente, e.titulo, t);
  const yVideo = finTitulo + 44;
  /* Más alta que el 16:9 (720×520): se recortan un poco los lados y la jugada gana tamaño en el móvil. */
  const altoVideo = 520;

  ctx.fillStyle = "#000000";
  ctx.fillRect(0, yVideo, ANCHO_V, altoVideo);

  const vw = cuadro ? cuadro.displayWidth || cuadro.videoWidth || cuadro.width : 0;
  const vh = cuadro ? cuadro.displayHeight || cuadro.videoHeight || cuadro.height : 0;

  if (cuadro && vw && vh) {
    /* Como en el horizontal: un poco más grande y empujado hacia arriba, para dejar fuera el marcador de la retransmisión. */
    const esc = Math.max(ANCHO_V / vw, altoVideo / vh) * 1.08 * (1 + 0.03 * (tc / porCorte));
    const w = vw * esc;
    const h = vh * esc;

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, yVideo, ANCHO_V, altoVideo);
    ctx.clip();
    ctx.drawImage(cuadro, (ANCHO_V - w) / 2, yVideo - (h - altoVideo) * 0.85, w, h);
    ctx.restore();
  }

  /* Filetes de oro arriba y abajo de la jugada. */
  ctx.fillStyle = ORO;
  ctx.fillRect(0, yVideo - 3, ANCHO_V, 3);
  ctx.fillRect(0, yVideo + altoVideo, ANCHO_V, 3);

  const borde = Math.min(tc / 0.15, (porCorte - tc) / 0.15);

  if (borde < 1) {
    ctx.fillStyle = `rgba(8,17,31,${0.85 * (1 - Math.max(0, borde))})`;
    ctx.fillRect(0, yVideo, ANCHO_V, altoVideo);
  }

  const corte = e.cortes[k] as Corte & Partial<CortePartido>;
  const partes = corte.rotulo.split(" · ");
  const jornada = partes.find((p) => /^J\d+$/i.test(p.trim()));
  const principal = corte.tipo ? [partes[0], corte.minuto].filter(Boolean).join(" · ") : [partes[0], jornada].filter(Boolean).join(" · ");
  /* Sin lectura, la zona que etiqueta Hudl en palabras («Último tercio · banda derecha»); nunca una posición inventada. */
  const queMirar = corte.texto ?? (corte.zona ? zonaEnPalabras(corte.zona) : corte.tipo ? "" : partes.slice(1).filter((p) => p !== jornada).join(" · "));

  if (corte.repeticion) {
    const pulso = 0.75 + Math.sin(t * 7) * 0.25;

    ctx.globalAlpha = pulso;
    ctx.fillStyle = ORO;
    caja(ctx, ANCHO_V - MARGEN - 240, yVideo + 18, 240, 44, 8);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = TINTA;
    ctx.font = `700 ${ETIQUETA}px ${fuente}`;
    ctx.textAlign = "center";
    ctx.fillText("REPETICIÓN", ANCHO_V - MARGEN - 120, yVideo + 49);
    ctx.textAlign = "left";

    if (tc < 0.3) {
      const x = (tc / 0.3) * (ANCHO_V + 200) - 100;

      ctx.fillStyle = "rgba(200,169,107,0.85)";
      ctx.beginPath();
      ctx.moveTo(x - 50, yVideo);
      ctx.lineTo(x + 50, yVideo);
      ctx.lineTo(x - 30, yVideo + altoVideo);
      ctx.lineTo(x - 130, yVideo + altoVideo);
      ctx.closePath();
      ctx.fill();
    }
  }

  if (corte.tipo === "gol" && !corte.repeticion) estallidoGol(ctx, fuente, tc, ANCHO_V / 2, yVideo + altoVideo / 2);

  /* El rótulo, debajo de la jugada: nunca la tapa, así que no hace falta retirarlo. */
  const yRotulo = yVideo + altoVideo + 60;
  const b = tramo(tc, 0.15, 0.45);

  ctx.globalAlpha = b;
  ctx.fillStyle = ORO;
  ctx.fillRect(MARGEN, yRotulo - 40, 8, 50);

  const p = ajusta(ctx, fuente, (corte.repeticion ? `${principal} · otra vez` : principal).toUpperCase(), 700, 56, TITULO, UTIL - 30, 2);

  ctx.fillStyle = BLANCO;
  ctx.font = `700 ${p.tam}px ${fuente}`;
  p.lineas.forEach((l, i) => ctx.fillText(l, MARGEN + 26, yRotulo + i * (p.tam + 4)));

  if (queMirar) {
    const m = ajusta(ctx, fuente, queMirar, 500, 40, LECTURA, UTIL - 30, 3);
    const y = yRotulo + (p.lineas.length - 1) * (p.tam + 4) + 60;

    ctx.globalAlpha = m.entero ? b * tramo(tc, 0.35, 0.45) : 0;
    ctx.fillStyle = ORO_CLARO;
    ctx.font = `500 ${m.tam}px ${fuente}`;
    m.lineas.forEach((l, i) => ctx.fillText(l, MARGEN + 26, y + i * (m.tam + 6)));
  }

  ctx.globalAlpha = 1;

  /* Qué corte va de cuántos. */
  e.cortes.forEach((_, i) => {
    ctx.fillStyle = i === k ? ORO : "rgba(255,255,255,0.35)";
    ctx.beginPath();
    ctx.arc(ANCHO_V / 2 - ((e.cortes.length - 1) * 22) / 2 + i * 22, ALTO_V - SEGURO - 40, 6, 0, Math.PI * 2);
    ctx.fill();
  });
}

/** El balance del post: una tarjeta por meta, apiladas; al final, el recuento. */
function balance(ctx: Lienzo, fuente: string, e: Extract<Escena, { tipo: "balance" }>, t: number, dur: number) {
  const finTitulo = tituloV(ctx, fuente, e.titulo, t);
  const filas = e.filas.slice(0, 3);
  const n = filas.length;
  /* Sin la caja final con el recuento (26/10/2026, ronda 8, guion): repetía el título. Las metas se quedan a la vista hasta el final. */
  const final = 0;
  const tramoFila = Math.max(0.8, (dur - final - 0.5) / Math.max(1, n));
  const activa = Math.min(n - 1, Math.floor((t - 0.5) / tramoFila));
  const hueco = 20;
  const y0 = finTitulo + 46;
  const alto = Math.min(270, (ALTO_V - SEGURO - 30 - y0 - (n - 1) * hueco) / Math.max(1, n));

  filas.forEach((x, i) => {
    const a = salta((t - (0.5 + i * tramoFila)) / 0.4);

    if (a <= 0) return;

    const y = y0 + i * (alto + hueco);
    const color = x.estado === "si" ? VERDE : x.estado === "no" ? ROJO : ORO;
    const veredicto = x.estado === "si" ? "CUMPLIDO" : x.estado === "no" ? "NO" : "A MEDIAS";

    /* Con el recuento, las filas se apagan del todo (22/10/2026, crítica del productor: quedaban a medias detrás). */
    ctx.globalAlpha = Math.min(1, a) * (i === activa ? 1 : 0.5);
    tarjeta(ctx, MARGEN, y, UTIL, alto, null);
    ctx.fillStyle = color;
    ctx.fillRect(MARGEN, y, 8, alto);
    iconoEstado(ctx, x.estado, MARGEN + 46, y + 44, color);

    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.font = `700 ${ETIQUETA + 2}px ${fuente}`;
    espaciado(ctx, x.que.toUpperCase(), MARGEN + 80, y + 54, 1.4);

    /* El veredicto en su píldora, a la derecha de la cabecera. */
    ctx.font = `700 ${ETIQUETA}px ${fuente}`;

    const wv = ctx.measureText(veredicto).width + 32;

    ctx.fillStyle = color;
    caja(ctx, MARGEN + UTIL - 24 - wv, y + 24, wv, 40, 20);
    ctx.fill();
    ctx.fillStyle = TINTA;
    ctx.textAlign = "center";
    ctx.fillText(veredicto, MARGEN + UTIL - 24 - wv / 2, y + 53);
    ctx.textAlign = "left";

    const lineasLibres = Math.max(1, Math.floor((alto - 90) / 40));
    const logramos = ajusta(ctx, fuente, x.logramos, 700, 38, LECTURA, UTIL - 60, Math.min(3, lineasLibres));

    ctx.fillStyle = ORO_CLARO;
    ctx.font = `700 ${logramos.tam}px ${fuente}`;
    logramos.lineas.forEach((l, k) => ctx.fillText(l, MARGEN + 30, y + 112 + k * (logramos.tam + 6)));

    const resto = lineasLibres - logramos.lineas.length;

    const buscabamos = resto > 0 ? ajusta(ctx, fuente, `Buscábamos: ${x.buscabamos}`, 500, LECTURA, LECTURA, UTIL - 60, Math.min(2, resto)) : null;

    if (buscabamos?.entero) {
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.font = `500 ${buscabamos.tam}px ${fuente}`;
      buscabamos.lineas.forEach((l, k) => ctx.fillText(l, MARGEN + 30, y + 112 + logramos.lineas.length * (logramos.tam + 6) + 4 + k * (buscabamos.tam + 6)));
    }

    ctx.globalAlpha = 1;
  });
}


/** El cierre: nuestro escudo, «Nuestra consigna», la consigna grande y su dato; fundido a negro. */
function cierre(ctx: Lienzo, fuente: string, e: Extract<Escena, { tipo: "cierre" }>, rec: Recursos, t: number, restante: number) {
  const escudo = [...rec.imagenes.entries()].find(([k, v]) => k.endsWith(":nosotros") && v)?.[1] ?? null;
  const cy = 420;
  const a = salta((t - 0.1) / 0.8);

  if (a > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, a);
    halo(ctx, ANCHO_V / 2, cy, 160);
    medallon(ctx, fuente, escudo, ANCHO_V / 2, cy, 86 * Math.max(0.3, a), "rgba(255,255,255,0)", "RM");
    ctx.restore();
    anillo(ctx, ANCHO_V / 2, cy, 106, 5, tramo(t, 0.3, 1.2), ORO, "rgba(255,255,255,0.08)");
  }

  const b = tramo(t, 0.6, 0.6);

  ctx.globalAlpha = b;
  ctx.fillStyle = ORO;
  ctx.font = `700 30px ${fuente}`;
  espaciado(ctx, e.titulo.toUpperCase(), ANCHO_V / 2, 596, 5, "center");

  const texto = e.lineas.slice(0, 2).join(". ");
  const consigna = ajusta(ctx, fuente, texto, 700, 68, TITULO, UTIL, 5);

  ctx.globalAlpha = tramo(t, 0.9, 0.6);
  ctx.fillStyle = BLANCO;
  ctx.font = `700 ${consigna.tam}px ${fuente}`;

  const fin = centradas(ctx, consigna.lineas, ANCHO_V / 2, 700, consigna.tam + 8);

  if (e.pie) {
    const pie = ajusta(ctx, fuente, e.pie, 600, 40, LECTURA, UTIL, 2);

    ctx.globalAlpha = tramo(t, 1.4, 0.6);
    ctx.fillStyle = ORO;
    ctx.font = `600 ${pie.tam}px ${fuente}`;
    centradas(ctx, pie.lineas, ANCHO_V / 2, fin + 74, pie.tam + 6);
  }

  if (restante < 0.4) {
    ctx.globalAlpha = 1 - restante / 0.4;
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, ANCHO_V, ALTO_V);
  }

  ctx.globalAlpha = 1;
}

/* ------------------------------------------------------------------ */
/*  UN FOTOGRAMA ENTERO                                                 */
/* ------------------------------------------------------------------ */

/** Pinta un fotograma vertical completo. El lienzo puede ser de 720×1280 o de 1080×1920: se escala. */
export function pintaFotogramaVertical(ctx: Lienzo, grano: Dibujable, fuente: string, rec: Recursos, f: Fotograma) {
  const e = f.medida.escena;
  const escala = (ctx.canvas?.width || ANCHO_V) / ANCHO_V;

  ctx.setTransform(escala, 0, 0, escala, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";

  fondo(ctx, f.global);

  if (e.tipo === "portada") portada(ctx, fuente, e, rec, f.t);
  else if (e.tipo === "gancho") gancho(ctx, fuente, e, f.t);
  else if (e.tipo === "claves") claves(ctx, fuente, e, f.t, f.medida.segundos);
  else if (e.tipo === "vigilar") vigilar(ctx, fuente, e, rec, f.t);
  else if (e.tipo === "clips") clips(ctx, fuente, e, f.cuadro, f.t, f.medida.segundos);
  else if (e.tipo === "balance") balance(ctx, fuente, e, f.t, f.medida.segundos);
  else if (e.tipo === "cierre") cierre(ctx, fuente, e, rec, f.t, f.restante);

  acabado(ctx, grano, f.progreso, fuente);

  /* Cortinilla entre escenas; la portada abre sin ella (es la miniatura) y el cierre acaba en negro. */
  const entrada = e.tipo === "clips" ? 0.3 : 0.45;
  const salida = e.tipo === "clips" ? 0.25 : 0.4;

  if (f.t < entrada && f.global > 0.05) cortinilla(ctx, ANCHO_V, ALTO_V, "sale", f.t / entrada, ORO, FONDO);
  else if (f.restante < salida && e.tipo !== "cierre") cortinilla(ctx, ANCHO_V, ALTO_V, "entra", 1 - f.restante / salida, ORO, FONDO);
}
