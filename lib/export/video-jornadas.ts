"use client";

/**
 * EL VÍDEO DE LA EVOLUCIÓN POR JORNADAS (18/11/2026, el analista: «en los que
 * tenga sentido por filtro de jornadas que se vea un vídeo de la evolución de
 * los equipos en el recorrido de las jornadas»).
 *
 * «Tiene sentido» = el gráfico lleva un selector de jornada: un `<select>` cuyo
 * rótulo dice «jornada» («Hasta la jornada») y cuyas opciones son jornadas
 * («12», «J12», «Jornada 12»). Los de equipos o partidos («J13 · Real Murcia»)
 * no cuentan: recorrerlos no enseña una evolución. El vídeo pone ese selector en cada jornada, de la primera a la última, espera a
 * que el gráfico se redibuje, lo fotografía y encadena las fotos con un fundido
 * corto. Al acabar deja el selector como estaba.
 *
 * Es el mismo gráfico de la pantalla, no uno dibujado aparte: lo que se ve en
 * el vídeo es lo que se ve al mover el filtro a mano. Por eso retiene la
 * pantalla (`pantalla: true`) mientras rueda.
 *
 * MP4 H.264 con WebCodecs y el muxor propio (`lib/coding/mp4.ts`), como las
 * láminas de la pizarra.
 */

import { MuxorMp4 } from "@/lib/coding/mp4";
import type { Bytes } from "@/lib/export/zip";
import { capturaNodo, fotograma } from "@/lib/export/captura";
import { fondoDe, nombreDe, nombreFichero } from "@/lib/export/elige-zona";
import { codecLamina, puedeHacerVideo } from "@/lib/tactics/lamina";
import { descargaEnMarcha, encargaDescarga } from "@/lib/trabajos/descargas";

const FPS = 30;
const QUIETO = 0.75; // segundos en cada jornada
const FUNDIDO = 0.25; // segundos de fundido entre jornadas
const FINAL = 2.5; // la última se queda más
const ANCHO_MAX = 1920;
const ALTO_MAX = 1080;

const RE_JORNADA = /^\s*(?:j(?:ornada)?\.?\s*)?(\d{1,2})(?!\d)(?:\s*[·\-–:|]|\s*$|\s+\D)/i;

export type SelectorJornadas = { select: HTMLSelectElement; opciones: { valor: string; numero: number; texto: string }[] };

/** El selector de jornada del gráfico, si lo tiene: al menos 3 jornadas distintas. */
export function selectorDeJornadas(zona: Element): SelectorJornadas | null {
  for (const select of Array.from(zona.querySelectorAll("select"))) {
    if (select.disabled || select.multiple) continue;

    const etiqueta = `${select.getAttribute("aria-label") ?? ""} ${select.closest("label")?.textContent ?? ""} ${select.previousElementSibling?.textContent ?? ""}`;
    /* Sólo si el rótulo dice «jornada»: un selector de equipos o de partidos
       también lleva «J13 · Real Murcia» y recorrerlo no es una evolución. */
    const opcionesJornada = Array.from(select.options).some((o) => /^\s*jornada\s+\d/i.test(o.textContent ?? ""));
    if (!/jornada/i.test(etiqueta) && !opcionesJornada) continue;

    const vistas = new Set<number>();
    const opciones: SelectorJornadas["opciones"] = [];

    for (const o of Array.from(select.options)) {
      if (o.disabled || !o.value) continue;
      const m = RE_JORNADA.exec(o.textContent ?? "");
      if (!m) continue;
      const numero = Number(m[1]);
      if (vistas.has(numero)) continue;
      vistas.add(numero);
      opciones.push({ valor: o.value, numero, texto: (o.textContent ?? "").trim() });
    }

    if (opciones.length >= 3) return { select, opciones: opciones.sort((a, b) => a.numero - b.numero) };
  }

  return null;
}

/** Cambiar el valor como lo haría la mano: React sólo se entera por el setter nativo y el evento. */
function ponValor(select: HTMLSelectElement, valor: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
  setter?.call(select, valor);
  select.dispatchEvent(new Event("change", { bubbles: true }));
  select.dispatchEvent(new Event("input", { bubbles: true }));
}

const pausa = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function cargaImagen(src: string) {
  return new Promise<HTMLImageElement>((ok, mal) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => mal(new Error("No se pudo leer la foto del gráfico"));
    img.src = src;
  });
}

function copia(origen: AllowSharedBufferSource): Bytes {
  const vista = ArrayBuffer.isView(origen) ? new Uint8Array(origen.buffer, origen.byteOffset, origen.byteLength) : new Uint8Array(origen as ArrayBuffer);
  const salida = new Uint8Array(new ArrayBuffer(vista.byteLength));
  salida.set(vista);
  return salida as Bytes;
}

/** Rueda el vídeo y lo devuelve. `avanza` recibe «J5 de 12» y la fracción. */
export async function ruedaVideoJornadas(zona: HTMLElement, sel: SelectorJornadas, avanza: (texto: string, fraccion?: number) => void): Promise<Blob> {
  if (!puedeHacerVideo()) throw new Error("Este navegador no sabe montar vídeo. Prueba con Chrome o Edge.");

  const { select, opciones } = sel;
  const original = select.value;
  const fondo = fondoDe(zona);

  let ancho = 0;
  let alto = 0;
  /* El gráfico va arriba y la jornada en una franja propia debajo: encima tapaba cifras. */
  let area = 0;
  let lienzo: HTMLCanvasElement | null = null;
  let ctx: CanvasRenderingContext2D | null = null;
  let codificador: VideoEncoder | null = null;
  const muxor = new MuxorMp4();
  let fallo: Error | null = null;
  let n = 0;
  let previa: HTMLImageElement | null = null;

  const pinta = (img: HTMLImageElement, opacidad = 1) => {
    if (!ctx || !lienzo) return;
    ctx.globalAlpha = opacidad;
    const k = Math.min(lienzo.width / img.naturalWidth, area / img.naturalHeight);
    const w = img.naturalWidth * k;
    const h = img.naturalHeight * k;
    ctx.drawImage(img, (lienzo.width - w) / 2, (area - h) / 2, w, h);
    ctx.globalAlpha = 1;
  };

  const rotulo = (texto: string) => {
    if (!ctx || !lienzo) return;
    const banda = alto - area;
    const t = Math.round(banda * 0.55);
    ctx.font = `700 ${t}px system-ui, sans-serif`;
    const w = ctx.measureText(texto).width;
    const x = lienzo.width - w - t * 0.8;
    const y = area + banda * 0.5 + t * 0.36;
    ctx.fillStyle = "#C8A96B";
    ctx.fillText(texto, x, y);
  };

  const emite = async (veces: number, dibuja: (i: number) => void) => {
    for (let i = 0; i < veces; i++) {
      if (fallo) throw fallo;
      dibuja(i);
      const cuadro = new VideoFrame(lienzo!, { timestamp: Math.round((n * 1_000_000) / FPS), duration: Math.round(1_000_000 / FPS) });
      codificador!.encode(cuadro, { keyFrame: n % (FPS * 2) === 0 });
      cuadro.close();
      n += 1;
      while (codificador!.encodeQueueSize > 6) await pausa(5);
    }
  };

  try {
    for (const [i, o] of opciones.entries()) {
      avanza(`Jornada ${o.numero} · ${i + 1} de ${opciones.length}`, (i + 0.5) / opciones.length);

      ponValor(select, o.valor);
      await fotograma();
      await pausa(900);
      await fotograma();

      const r = zona.getBoundingClientRect();
      if (!lienzo) {
        const k = Math.min(ANCHO_MAX / r.width, (ALTO_MAX * 0.9) / r.height, 2); /* con la franja no pasa de 1080 (H.264 4.0) */
        ancho = Math.max(2, Math.round((r.width * k) / 2) * 2);
        area = Math.max(2, Math.round((r.height * k) / 2) * 2);
        alto = area + Math.max(48, Math.round((area * 0.09) / 2) * 2);
        lienzo = document.createElement("canvas");
        lienzo.width = ancho;
        lienzo.height = alto;
        ctx = lienzo.getContext("2d");
        if (!ctx) throw new Error("El navegador no deja dibujar el vídeo.");

        const codec = await codecLamina(ancho, alto, 8_000_000);
        if (!codec) throw new Error("Este navegador no sabe codificar vídeo a ese tamaño.");

        codificador = new VideoEncoder({
          output: (trozo, meta) => {
            const descripcion = meta?.decoderConfig?.description;
            if (descripcion) muxor.configuraVideo({ ancho, alto, descripcion: copia(descripcion) });
            const datos = new Uint8Array(new ArrayBuffer(trozo.byteLength));
            trozo.copyTo(datos);
            muxor.añadeVideo(datos as Bytes, Math.max(0, trozo.timestamp), trozo.duration || 1_000_000 / FPS, trozo.type === "key");
          },
          error: (e) => {
            fallo = e instanceof Error ? e : new Error(String(e));
          },
        });
        codificador.configure({ codec, width: ancho, height: alto, bitrate: 8_000_000, framerate: FPS, latencyMode: "quality", avc: { format: "avc" } });
      }

      const foto = await capturaNodo(zona, {
        pixelRatio: ancho / r.width,
        backgroundColor: fondo,
        cacheBust: false,
        includeQueryParams: true,
        filter: (nodo: HTMLElement) => !(nodo instanceof HTMLElement) || !nodo.hasAttribute("data-export-hide"),
      });
      const img = await cargaImagen(foto.dataUrl);

      const fondoLleno = () => {
        ctx!.fillStyle = fondo;
        ctx!.fillRect(0, 0, ancho, alto);
      };
      const etiqueta = `Jornada ${o.numero}`;

      if (previa) {
        const pasos = Math.round(FUNDIDO * FPS);
        const antes = previa;
        await emite(pasos, (k) => {
          fondoLleno();
          pinta(antes);
          pinta(img, (k + 1) / pasos);
          rotulo(etiqueta);
        });
      }

      const ultima = i === opciones.length - 1;
      await emite(Math.round((ultima ? FINAL : QUIETO) * FPS), () => {
        fondoLleno();
        pinta(img);
        rotulo(etiqueta);
      });

      previa = img;
    }

    await codificador!.flush();
    if (fallo) throw fallo;

    return muxor.cierra();
  } finally {
    if (codificador && codificador.state !== "closed") codificador.close();
    ponValor(select, original);
  }
}

/** El encargo en segundo plano, con la píldora de las descargas. */
export function videoJornadas(zona: HTMLElement, sel: SelectorJornadas) {
  const titulo = `Vídeo por jornadas · ${nombreDe(zona) || "gráfico"}`;
  if (descargaEnMarcha(titulo)) return;

  const nombre = nombreFichero(zona, "mp4").replace(/_(\d{4}-\d{2}-\d{2})\.mp4$/, "_evolucion_$1.mp4");

  encargaDescarga({
    titulo,
    vuelta: location.pathname + location.search,
    pantalla: true,
    tarea: async ({ avanza, sueltaPantalla }) => {
      try {
        return { blob: await ruedaVideoJornadas(zona, sel, avanza), nombre };
      } finally {
        sueltaPantalla();
      }
    },
  });
}
