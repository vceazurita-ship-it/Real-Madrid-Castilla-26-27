/**
 * LA LÁMINA DE «MI QUINIELA»: un PNG vertical de 1080×1350 (a 2×) que sale
 * del navegador y es lo que se manda por WhatsApp o por correo.
 *
 * Se dibuja en un canvas, sin librerías. Los escudos vienen de
 * `/api/data-analisis?escudos=1` por el proxy de la casa (si uno falla se
 * dibujan las iniciales del equipo) y la foto de quien juega, de `/staff`.
 * Lo que no tiene dato no se nombra: sin pronóstico, el hueco va vacío.
 */

import { partidosDe, type Signo } from "./modelo";
import { fotoDe, inicialDe } from "./staff";

export const LAMINA_ANCHO = 1080;
export const LAMINA_ALTO = 1350;
const ESCALA = 2;

const ORO = "#C8A96B";
const FONDO = "#0A0A0B";
const TARJETA = "#16161A";
const TEXTO = "#F4F1EA";
const APAGADO = "#8F8A7E";

const TITULO = '"Barlow Condensed", "Arial Narrow", Arial, sans-serif';
const CUERPO = 'Arial, Helvetica, sans-serif';

const norm = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/["“”]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Nombre para pintar: sin las comillas de «Villarreal CF "B"». */
const limpio = (t: string) => t.replace(/["“”]/g, "").trim();

const ARTICULOS = new Set(["cf", "fc", "cd", "ad", "ud", "sd", "ce", "real", "de", "la", "el", "club", "sad", "ue", "rc"]);

function iniciales(nombre: string) {
  const palabras = limpio(nombre)
    .split(/\s+/)
    .filter((p) => p && !ARTICULOS.has(p.toLowerCase()));
  const base = palabras.length ? palabras : limpio(nombre).split(/\s+/);

  return base
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join("");
}

function carga(src: string): Promise<HTMLImageElement | null> {
  return new Promise((listo) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    const tope = setTimeout(() => listo(null), 6000);
    img.onload = () => {
      clearTimeout(tope);
      listo(img);
    };
    img.onerror = () => {
      clearTimeout(tope);
      listo(null);
    };
    img.src = src;
  });
}

async function escudosDe(equipos: string[]) {
  const salida = new Map<string, HTMLImageElement>();

  try {
    const r = await fetch("/api/data-analisis?escudos=1");
    if (!r.ok) return salida;

    const d = (await r.json()) as { escudos?: { equipo?: string; escudo?: string }[] };
    const lista = (d.escudos ?? []).filter((e) => e.equipo && e.escudo).map((e) => ({ n: norm(e.equipo!), url: e.escudo! }));

    await Promise.all(
      equipos.map(async (equipo) => {
        const n = norm(equipo);
        const hit =
          lista.find((e) => e.n === n) ??
          lista.find((e) => e.n.length > 4 && (n.includes(e.n) || e.n.includes(n)));

        if (!hit) return;

        const src = hit.url.startsWith("/") ? hit.url : `/api/rivals/foto?url=${encodeURIComponent(hit.url)}`;
        const img = await carga(src);

        if (img) salida.set(equipo, img);
      }),
    );
  } catch {
    /* sin escudos: iniciales */
  }

  return salida;
}

async function fuentes() {
  try {
    const f = new FontFace("Barlow Condensed", "url(/fuentes/BarlowCondensed-Bold.ttf)", { weight: "700" });
    await f.load();
    document.fonts.add(f);
  } catch {
    /* cae a Arial Narrow */
  }
}

function redondo(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

/** Escribe encogiendo la letra hasta que quepa en `ancho`. */
function ajustado(c: CanvasRenderingContext2D, texto: string, x: number, y: number, ancho: number, tam: number, peso: string, familia: string) {
  let t = tam;

  do {
    c.font = `${peso} ${t}px ${familia}`;
    t -= 1;
  } while (c.measureText(texto).width > ancho && t > 14);

  c.fillText(texto, x, y);
}

function insignia(c: CanvasRenderingContext2D, img: HTMLImageElement | undefined, nombre: string, cx: number, cy: number, lado: number) {
  if (img) {
    const k = Math.min(lado / img.naturalWidth, lado / img.naturalHeight);
    const w = img.naturalWidth * k;
    const h = img.naturalHeight * k;
    c.drawImage(img, cx - w / 2, cy - h / 2, w, h);
    return;
  }

  c.beginPath();
  c.arc(cx, cy, lado / 2, 0, Math.PI * 2);
  c.fillStyle = "#24242A";
  c.fill();
  c.strokeStyle = "rgba(200,169,107,.45)";
  c.lineWidth = 2;
  c.stroke();
  c.fillStyle = ORO;
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.font = `700 ${Math.round(lado * 0.42)}px ${TITULO}`;
  c.fillText(iniciales(nombre), cx, cy + 2);
}

export type DatosLamina = {
  jornada: number;
  nombre: string;
  slug?: string | null;
  signos: (Signo | null | undefined)[];
  /** "viernes 18 de septiembre a las 12:00", o vacío si no se sabe. */
  cierre?: string;
  cerrada?: boolean;
};

/** Dibuja la lámina y devuelve el PNG. */
export async function creaLamina(datos: DatosLamina): Promise<Blob> {
  const partidos = partidosDe(datos.jornada);

  const [escudos, foto] = await Promise.all([
    escudosDe(partidos.flatMap((p) => [p.local, p.visitante])),
    datos.slug && fotoDe(datos.slug) ? carga(fotoDe(datos.slug)!) : Promise.resolve(null),
    fuentes(),
  ]);

  const lienzo = document.createElement("canvas");
  lienzo.width = LAMINA_ANCHO * ESCALA;
  lienzo.height = LAMINA_ALTO * ESCALA;

  const c = lienzo.getContext("2d");
  if (!c) throw new Error("Este navegador no puede dibujar la lámina");

  c.scale(ESCALA, ESCALA);
  c.textBaseline = "alphabetic";

  /* Fondo */
  const g = c.createLinearGradient(0, 0, 0, LAMINA_ALTO);
  g.addColorStop(0, "#15130F");
  g.addColorStop(0.35, FONDO);
  g.addColorStop(1, "#050506");
  c.fillStyle = g;
  c.fillRect(0, 0, LAMINA_ANCHO, LAMINA_ALTO);

  const halo = c.createRadialGradient(LAMINA_ANCHO / 2, 0, 0, LAMINA_ANCHO / 2, 0, 700);
  halo.addColorStop(0, "rgba(200,169,107,.20)");
  halo.addColorStop(1, "rgba(200,169,107,0)");
  c.fillStyle = halo;
  c.fillRect(0, 0, LAMINA_ANCHO, 700);

  c.fillStyle = ORO;
  c.fillRect(0, 0, LAMINA_ANCHO, 10);

  /* Cabecera */
  c.textAlign = "left";
  c.fillStyle = ORO;
  c.font = `700 26px ${TITULO}`;
  (c as unknown as { letterSpacing: string }).letterSpacing = "6px";
  c.fillText("REAL MADRID CASTILLA · 26/27", 60, 74);
  (c as unknown as { letterSpacing: string }).letterSpacing = "0px";

  c.fillStyle = TEXTO;
  c.font = `700 112px ${TITULO}`;
  c.fillText("MI QUINIELA", 60, 184);

  /* Jornada, a la derecha */
  c.textAlign = "right";
  c.fillStyle = ORO;
  c.font = `700 112px ${TITULO}`;
  c.fillText(`J${datos.jornada}`, 1020, 184);
  c.fillStyle = APAGADO;
  c.font = `700 22px ${TITULO}`;
  c.fillText("JORNADA", 1020, 98);

  /* Persona */
  const py = 250;
  c.strokeStyle = "rgba(200,169,107,.35)";
  c.lineWidth = 1.5;
  c.beginPath();
  c.moveTo(60, 214);
  c.lineTo(1020, 214);
  c.stroke();

  c.save();
  c.beginPath();
  c.arc(96, py + 22, 36, 0, Math.PI * 2);
  c.closePath();
  c.fillStyle = "rgba(200,169,107,.15)";
  c.fill();
  c.clip();

  if (foto) {
    const k = Math.max(72 / foto.naturalWidth, 72 / foto.naturalHeight);
    const w = foto.naturalWidth * k;
    const h = foto.naturalHeight * k;
    c.drawImage(foto, 96 - w / 2, py + 22 - h / 2, w, h);
  }
  c.restore();

  if (!foto) {
    c.fillStyle = ORO;
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.font = `700 38px ${TITULO}`;
    c.fillText(datos.slug ? inicialDe(datos.slug) : datos.nombre.charAt(0).toUpperCase(), 96, py + 24);
    c.textBaseline = "alphabetic";
  }

  c.beginPath();
  c.arc(96, py + 22, 36, 0, Math.PI * 2);
  c.strokeStyle = ORO;
  c.lineWidth = 2.5;
  c.stroke();

  c.textAlign = "left";
  c.fillStyle = TEXTO;
  ajustado(c, datos.nombre, 154, py + 20, 860, 44, "700", TITULO);
  c.fillStyle = APAGADO;
  c.font = `400 20px ${CUERPO}`;
  c.fillText("Mis pronósticos guardados", 154, py + 50);

  /* Partidos */
  const y0 = 330;
  const alto = 90;
  const paso = 100;

  partidos.forEach((p, i) => {
    const y = y0 + i * paso;
    const signo = datos.signos[i];

    redondo(c, 60, y, 960, alto, 18);
    c.fillStyle = TARJETA;
    c.fill();
    c.strokeStyle = "rgba(255,255,255,.06)";
    c.lineWidth = 1;
    c.stroke();

    const cy = y + alto / 2;

    insignia(c, escudos.get(p.local), p.local, 112, cy, 54);
    insignia(c, escudos.get(p.visitante), p.visitante, 968, cy, 54);

    c.textBaseline = "alphabetic";
    c.textAlign = "left";
    c.fillStyle = signo === "1" ? TEXTO : "rgba(244,241,234,.72)";
    ajustado(c, limpio(p.local), 158, cy + 9, 300, 30, "700", TITULO);

    c.textAlign = "right";
    c.fillStyle = signo === "2" ? TEXTO : "rgba(244,241,234,.72)";
    ajustado(c, limpio(p.visitante), 922, cy + 9, 300, 30, "700", TITULO);

    /* El signo */
    redondo(c, 498, y + 9, 84, 72, 14);

    if (signo) {
      c.fillStyle = ORO;
      c.fill();
      c.fillStyle = "#0A0A0B";
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.font = `700 56px ${TITULO}`;
      c.fillText(signo, 540, cy + 3);
      c.textBaseline = "alphabetic";
    } else {
      c.strokeStyle = "rgba(200,169,107,.25)";
      c.lineWidth = 1.5;
      c.stroke();
    }
  });

  /* Pie */
  const yp = y0 + partidos.length * paso + 6;

  c.textAlign = "center";
  c.fillStyle = APAGADO;
  c.font = `400 21px ${CUERPO}`;

  if (datos.cierre) {
    c.fillText(datos.cerrada ? `Cerrada desde el ${datos.cierre}` : `Se puede cambiar hasta el ${datos.cierre}`, 540, yp + 22);
  }

  c.fillStyle = ORO;
  c.font = `700 24px ${TITULO}`;
  (c as unknown as { letterSpacing: string }).letterSpacing = "6px";
  c.fillText("¡HALA MADRID!  ·  QUINIELA DEL STAFF", 540, LAMINA_ALTO - 28);
  (c as unknown as { letterSpacing: string }).letterSpacing = "0px";

  c.fillStyle = ORO;
  c.fillRect(0, LAMINA_ALTO - 10, LAMINA_ANCHO, 10);

  return new Promise<Blob>((listo, falla) => {
    lienzo.toBlob((b) => (b ? listo(b) : falla(new Error("No se ha podido crear la imagen"))), "image/png");
  });
}

export function blobABase64(blob: Blob): Promise<string> {
  return new Promise((listo, falla) => {
    const lector = new FileReader();
    lector.onload = () => listo(String(lector.result).split(",")[1] ?? "");
    lector.onerror = () => falla(new Error("No se ha podido leer la imagen"));
    lector.readAsDataURL(blob);
  });
}
