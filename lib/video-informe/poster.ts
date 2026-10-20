/*
|--------------------------------------------------------------------------
| EL PÓSTER CON EL DATO FUERTE (22/10/2026, crítica del productor de vídeo)
|--------------------------------------------------------------------------
|
| El póster era el fotograma de la portada (escudo contra escudo): en la
| vista previa del móvil no decía nada. Ahora abre con lo mismo que el gancho
| del vídeo, que es lo que hace pulsar: «2.º de la liga en centros al área»
| en la previa, el marcador con la idea en el post. Sale en 1280×720 (correo,
| PDF) y en 1080×1920 (la pieza vertical de los jugadores), con el botón de
| reproducir y la duración. Sólo necesita un contexto 2D.
*/

import type { Escena, GuionVideo } from "./guion";

const ORO = "#C8A96B";
const FONDO = "#08111F";
const TINTA = "#0B0F14";

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

export type DatoPoster = { antetitulo: string; dato: string; rotulo: string };

/** El dato del póster: el gancho del guion; si no hay gancho, la idea de la portada. */
export function datoDelPoster(guion: GuionVideo): DatoPoster | null {
  const gancho = guion.escenas.find((e): e is Extract<Escena, { tipo: "gancho" }> => e.tipo === "gancho");

  if (gancho?.dato) return { antetitulo: gancho.antetitulo ?? "", dato: gancho.dato, rotulo: gancho.rotulo };

  const portada = guion.escenas.find((e): e is Extract<Escena, { tipo: "portada" }> => e.tipo === "portada");

  if (portada?.idea) return { antetitulo: portada.titulo, dato: "", rotulo: portada.idea };

  return null;
}

/** Parte un texto en renglones que quepan en `ancho` (como mucho `maximo`). */
function renglones(ctx: CanvasRenderingContext2D, texto: string, ancho: number, maximo: number) {
  const palabras = texto.split(/\s+/).filter(Boolean);
  const salida: string[] = [];
  let actual = "";

  for (const p of palabras) {
    const prueba = actual ? `${actual} ${p}` : p;

    if (ctx.measureText(prueba).width <= ancho || !actual) actual = prueba;
    else {
      salida.push(actual);
      actual = p;
    }
  }

  if (actual) salida.push(actual);

  return salida.length > maximo ? null : salida;
}

/** Escribe centrado bajando la letra hasta que quepa en los renglones dados. */
function centrado(ctx: CanvasRenderingContext2D, texto: string, o: { cx: number; y: number; ancho: number; px: number; minimo: number; peso: number; fuente: string; color: string; maximo: number; interlinea?: number }) {
  for (let px = o.px; px >= o.minimo; px -= 2) {
    ctx.font = `${o.peso} ${px}px ${o.fuente}`;

    const lineas = renglones(ctx, texto, o.ancho, o.maximo);

    if (!lineas) continue;

    ctx.fillStyle = o.color;
    ctx.textAlign = "center";
    lineas.forEach((l, i) => ctx.fillText(l, o.cx, o.y + i * px * (o.interlinea ?? 1.05)));
    ctx.textAlign = "left";

    return o.y + lineas.length * px * (o.interlinea ?? 1.05);
  }

  return o.y;
}

function botonReproducir(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.fillStyle = ORO;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = TINTA;
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.32, cy - r * 0.45);
  ctx.lineTo(cx + r * 0.5, cy);
  ctx.lineTo(cx - r * 0.32, cy + r * 0.45);
  ctx.closePath();
  ctx.fill();
}

/**
 * Pinta el póster en un contexto de `ancho`×`alto` (1280×720 o 1080×1920).
 * Vale también con @napi-rs/canvas en el ordenador del club.
 */
export function pintaPosterDato(ctx: CanvasRenderingContext2D, o: DatoPoster & { ancho: number; alto: number; segundos: number; marca: string; fuente?: string }) {
  const { ancho: W, alto: H } = o;
  const vertical = H > W;
  const fuente = `${o.fuente ?? '"Barlow Condensed"'}, Arial, sans-serif`;
  const u = W / 1280;
  const margen = (vertical ? 72 : 80) * (vertical ? W / 1080 : u);

  const fondo = ctx.createRadialGradient(W / 2, H * 0.42, 0, W / 2, H * 0.42, Math.max(W, H) * 0.7);
  fondo.addColorStop(0, "#14233B");
  fondo.addColorStop(1, FONDO);
  ctx.fillStyle = fondo;
  ctx.fillRect(0, 0, W, H);

  /* La firma, arriba, fuera del 10 % que tapa WhatsApp en vertical. */
  const yFirma = vertical ? H * 0.11 : 70 * u;

  ctx.fillStyle = ORO;
  ctx.fillRect(margen, yFirma - 8 * u, 56 * (vertical ? W / 1080 : u), 5 * (vertical ? W / 1080 : u));
  ctx.font = `700 ${Math.round((vertical ? 34 : 26) * (vertical ? W / 1080 : u))}px ${fuente}`;
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.fillText(o.marca.toUpperCase(), margen + 72 * (vertical ? W / 1080 : u), yFirma);

  const escala = vertical ? W / 1080 : u;
  const cx = W / 2;
  let y = vertical ? H * 0.28 : 130 * u;

  /* Tres pisos: la etiqueta en oro, el dato enorme y la línea que lo explica. `centrado` devuelve el pie de lo escrito. */
  if (o.antetitulo) {
    const px = Math.round((vertical ? 56 : 40) * escala);

    y = centrado(ctx, o.antetitulo.toUpperCase(), { cx, y: y + px, ancho: W - margen * 2, px, minimo: Math.round(30 * escala), peso: 700, fuente, color: ORO, maximo: 2 }) - px * 0.05;
  }

  if (o.dato) {
    const px = Math.round((vertical ? 300 : 190) * escala);
    const base = y + px * 0.82;

    centrado(ctx, o.dato, { cx, y: base, ancho: W - margen * 2, px, minimo: Math.round(110 * escala), peso: 800, fuente, color: "#FFFFFF", maximo: 1 });
    y = base + px * 0.08;
  }

  const pxRotulo = Math.round((vertical ? 84 : 52) * escala);

  centrado(ctx, o.rotulo.toUpperCase(), { cx, y: y + pxRotulo + (vertical ? 60 : 24) * escala, ancho: W - margen * 2, px: pxRotulo, minimo: Math.round(36 * escala), peso: 700, fuente, color: "#FFFFFF", maximo: vertical ? 4 : 2 });

  /* Abajo: el botón y la duración, encima del 10 % que tapa la interfaz. */
  const yBoton = vertical ? H * 0.8 : H - 96 * u;
  const r = (vertical ? 70 : 40) * escala;

  botonReproducir(ctx, vertical ? cx : margen + r, yBoton, r);
  ctx.font = `700 ${Math.round((vertical ? 48 : 32) * escala)}px ${fuente}`;
  ctx.fillStyle = "#FFFFFF";

  if (vertical) {
    ctx.textAlign = "center";
    ctx.fillText(`VER EL VÍDEO · ${mmss(o.segundos)}`, cx, yBoton + r + 70 * escala);
    ctx.textAlign = "left";
  } else ctx.fillText(`VER EL VÍDEO · ${mmss(o.segundos)}`, margen + r * 2 + 24 * u, yBoton + 11 * u);
}

/** El póster del guion como JPEG (data URL); sin dato que enseñar, null y se usa el de siempre. */
export function posterConDato(guion: GuionVideo, o: { segundos: number; vertical?: boolean; fuente?: string }): string | null {
  const dato = datoDelPoster(guion);

  if (!dato || typeof document === "undefined") return null;

  const lienzo = document.createElement("canvas");

  lienzo.width = o.vertical ? 1080 : 1280;
  lienzo.height = o.vertical ? 1920 : 720;

  pintaPosterDato(lienzo.getContext("2d")!, { ...dato, ancho: lienzo.width, alto: lienzo.height, segundos: o.segundos, marca: "Real Madrid Castilla", fuente: o.fuente });

  return lienzo.toDataURL("image/jpeg", 0.88);
}
