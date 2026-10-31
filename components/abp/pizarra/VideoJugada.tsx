"use client";

/**
 * «Vídeo de la jugada»: la diapositiva de ABP en MP4, fase a fase.
 *
 * El vídeo de ABP para los jugadores (`ABP\VIDEO - JUGADORES`) se grababa
 * aparte de la pizarra y nada garantizaba que contaran lo mismo (productor,
 * ronda del sobresaliente). Aquí sale de la misma diapositiva: la salida
 * quieta, cada fase en movimiento con sus carreras y el balón, y una pausa
 * para leerla. Con el nombre ya puesto («J9 corner ofensivo.mp4») para dejarlo
 * en esa carpeta, y su póster en JPG para el correo. No se sube nada.
 *
 * El motor es el de la pizarra táctica (WebCodecs + el `MuxorMp4` del
 * coding). Cada fotograma es una foto de la diapositiva de verdad —la misma
 * que va al PowerPoint—, montada fuera de pantalla con su reloj.
 */

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Film } from "lucide-react";
import { toast } from "sonner";

import type { Player } from "@/types/player";
import { Button } from "@/components/abp/ui";
import { TableroSlide } from "@/components/abp/pizarra/TableroSlide";
import { COLORES, TABLERO_H, TABLERO_W, type SlidePizarra } from "@/lib/abp/pizarra";
import { fasesDe } from "@/lib/abp/trazos";
import { PIXEL_VACIO, descarga, esperaFotos, pintado } from "@/lib/export/lienzos";
import { aligeraImagenes, capturaNodo, fotoRapida, fuentesIncrustadas } from "@/lib/export/captura";
import { FAMILIA_PORTADA, esperaFuentePortada } from "@/lib/rivals/portada-font";
import { MuxorMp4 } from "@/lib/coding/mp4";
import type { Bytes } from "@/lib/export/zip";
import { codecLamina, FPS_LAMINA, puedeHacerVideo } from "@/lib/tactics/lamina";
import { enMarcha, trabajoExportar } from "@/lib/abp/trabajo-exportar";

export type Destino = "sala" | "whatsapp" | "vertical";

const DESTINOS: Record<Destino, { ancho: number; alto: number; caudal: number; titulo: string; detalle: string; sufijo: string }> = {
  sala: { ancho: 1920, alto: 1080, caudal: 6_000_000, titulo: "Para la sala", detalle: "1920 × 1080", sufijo: "" },
  whatsapp: { ancho: 1280, alto: 720, caudal: 2_200_000, titulo: "Para WhatsApp", detalle: "1280 × 720, no pasa de 16 MB", sufijo: " whatsapp" },
  vertical: { ancho: 1080, alto: 1920, caudal: 4_000_000, titulo: "Para el móvil", detalle: "vertical 1080 × 1920", sufijo: " movil" },
};

/** La salida quieta, cada fase moviéndose y la pausa para leerla (segundos). */
const SALIDA_S = 2.5;
const MOVIMIENTO_S = 1.5;
const PAUSA_S = 2.5;
/**
 * Fotos por fase en movimiento. Entre una y otra ya no se repite la foto
 * (31/10/2026: «que los vídeos sean más fluidos»): las fichas y el balón van
 * aparte, recortados, y se colocan en cada fotograma interpolando entre las
 * dos fotos; el fondo (flechas que crecen, rivales, rótulos) se funde de una
 * a otra. Así se mueven a 30 imágenes por segundo de verdad y no a saltos.
 */
const FOTOS_POR_FASE = 12;
/** Lo que se mueve suelto por encima del fondo. */
const MOVILES = "[data-ficha],[data-balon]";
/** Margen del recorte, para llevarse la sombra. */
const MARGEN_RECORTE = 16;

type Caja = { x: number; y: number; w: number; h: number };
type Toma = { imagen: HTMLImageElement; cajas: Map<string, Caja> };

const claveMovil = (el: Element, i: number) =>
  el.hasAttribute("data-balon") ? "balon" : `${el.getAttribute("data-player") ?? "ficha"}#${i}`;

/** Dónde está cada ficha y el balón, en píxeles del tablero. */
function cajasDe(nodo: HTMLElement): Map<string, Caja> {
  const base = nodo.getBoundingClientRect();
  const ex = TABLERO_W / (base.width || TABLERO_W);
  const ey = TABLERO_H / (base.height || TABLERO_H);
  const cajas = new Map<string, Caja>();

  nodo.querySelectorAll(MOVILES).forEach((el, i) => {
    const r = el.getBoundingClientRect();

    if (!r.width || !r.height) return;

    cajas.set(claveMovil(el, i), {
      x: (r.left - base.left) * ex - MARGEN_RECORTE,
      y: (r.top - base.top) * ey - MARGEN_RECORTE,
      w: r.width * ex + MARGEN_RECORTE * 2,
      h: r.height * ey + MARGEN_RECORTE * 2,
    });
  });

  return cajas;
}

/** La ficha suelta: lo que cambia entre la foto con ella y la misma sin ella (con su sombra y sin el césped). */
function recorta(lleno: HTMLImageElement, vacio: HTMLImageElement, caja: Caja): HTMLCanvasElement | null {
  const w = Math.max(1, Math.ceil(caja.w));
  const h = Math.max(1, Math.ceil(caja.h));
  const pinta = (imagen: HTMLImageElement) => {
    const lienzo = document.createElement("canvas");

    lienzo.width = w;
    lienzo.height = h;

    const ctx = lienzo.getContext("2d", { willReadFrequently: true });

    if (!ctx) return null;

    ctx.drawImage(imagen, caja.x, caja.y, w, h, 0, 0, w, h);

    return { lienzo, ctx };
  };
  const a = pinta(lleno);
  const b = pinta(vacio);

  if (!a || !b) return null;

  const pa = a.ctx.getImageData(0, 0, w, h);
  const pb = b.ctx.getImageData(0, 0, w, h).data;
  const d = pa.data;

  for (let i = 0; i < d.length; i += 4) {
    const diferencia = Math.abs(d[i] - pb[i]) + Math.abs(d[i + 1] - pb[i + 1]) + Math.abs(d[i + 2] - pb[i + 2]);

    d[i + 3] = Math.round(Math.min(1, Math.max(0, (diferencia - 10) / 40)) * 255);
  }

  a.ctx.putImageData(pa, 0, 0);

  return a.lienzo;
}

const nada = () => () => undefined;

export function duracionVideo(fases: number) {
  return SALIDA_S + fases * (MOVIMIENTO_S + PAUSA_S);
}

function pesoMb(destino: Destino, segundos: number) {
  return (DESTINOS[destino].caudal * segundos * 1.05) / 8 / 1_000_000;
}

const coma = (numero: number, decimales = 1) => numero.toFixed(decimales).replace(".", ",");

/** «J9 corner ofensivo»: sin tildes, en minúsculas, para la carpeta. */
export function nombreDelVideo(titulo: string, jornada?: string) {
  const limpio = titulo
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w\s.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  return [jornada?.trim(), limpio || "jugada"].filter(Boolean).join(" ");
}

function copiaBytes(origen: AllowSharedBufferSource): Bytes {
  const vista = ArrayBuffer.isView(origen)
    ? new Uint8Array(origen.buffer, origen.byteOffset, origen.byteLength)
    : new Uint8Array(origen as ArrayBuffer);

  const salida = new Uint8Array(new ArrayBuffer(vista.byteLength));

  salida.set(vista);

  return salida as Bytes;
}

function cargaImagen(src: string) {
  return new Promise<HTMLImageElement>((listo, falla) => {
    const imagen = new Image();

    imagen.onload = () => listo(imagen);
    imagen.onerror = () => falla(new Error("No se ha podido leer un fotograma"));
    imagen.src = src;
  });
}

/**
 * El fotograma vertical: la diapositiva entera de ancho, centrada, sobre ella
 * misma ampliada y desenfocada, con el título arriba.
 */
function pintaVertical(ctx: CanvasRenderingContext2D, foto: HTMLImageElement | HTMLCanvasElement, titulo: string) {
  const { ancho, alto } = DESTINOS.vertical;

  ctx.save();
  ctx.filter = "blur(28px) brightness(.55)";
  const escalaFondo = alto / foto.height;
  const anchoFondo = foto.width * escalaFondo;
  ctx.drawImage(foto, (ancho - anchoFondo) / 2, 0, anchoFondo, alto);
  ctx.restore();

  const h = (foto.height * ancho) / foto.width;
  const y = (alto - h) / 2;

  ctx.drawImage(foto, 0, y, ancho, h);

  ctx.fillStyle = COLORES.oro;
  ctx.font = `700 64px ${FAMILIA_PORTADA}, Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText(titulo.toUpperCase(), ancho / 2, y - 80, ancho - 80);
}

/** Lo que necesita `grabaJugada` para fotografiar la diapositiva en cada instante. */
export type PideFoto = {
  /** El tablero de fuera de pantalla, ya montado. */
  nodo: HTMLElement;
  /** Pone el reloj del tablero (0 = salida; 1, 2… = fin de cada fase) y espera a que se pinte. */
  pon: (valor: number) => Promise<void>;
};

/*
| Graba una diapositiva en MP4 (30/10/2026: sacado del botón para poder grabar
| todas de una vez desde «Exportar todo»). Devuelve el vídeo y su póster.
*/
export async function grabaJugada({
  nodo,
  pon,
  nFases,
  destino,
  titulo,
  alAvance,
}: PideFoto & { nFases: number; destino: Destino; titulo: string; alAvance?: (fraccion: number) => void }): Promise<{ fichero: Blob; poster: Blob | null; segundos: number }> {
  const d = DESTINOS[destino];
  let abierto: VideoEncoder | null = null;

  try {
    const codec = await codecLamina(d.ancho, d.alto, d.caudal);

    if (!codec) throw new Error("Este navegador no sabe montar vídeo. Prueba con Chrome o Edge.");

    await esperaFuentePortada();
    await pintado();
    await esperaFotos(nodo);
    await aligeraImagenes(nodo);

    const opciones = {
      backgroundColor: COLORES.tinta,
      imagePlaceholder: PIXEL_VACIO,
      includeQueryParams: true,
      formato: "jpeg" as const,
      quality: 0.9,
      width: TABLERO_W,
      height: TABLERO_H,
      pixelRatio: 1,
      style: { margin: "0", transform: "none", transformOrigin: "top left" },
      /* Element y no HTMLElement: el balón es un <svg> y también se aparta. */
      filter: (n: HTMLElement) => !(n instanceof Element) || !n.hasAttribute("data-export-hide"),
    };

    /*
      El primer fotograma, con la captura completa: deja las fotos en la caché.
      Los demás, con la rápida y las fuentes hechas una vez (31/10/2026: el
      vídeo tardaba más de un minuto por diapositiva).
    */
    let caliente = false;
    let fontEmbedCSS: string | undefined;

    const foto = async (valor: number) => (await toma(valor)).imagen;

    /* La foto de un instante; con `aparta`, sin esas fichas (o el balón) y con dónde estaban. */
    async function toma(valor: number, aparta?: Set<string>): Promise<Toma> {
      await pon(valor);

      const apartados: Element[] = [];

      if (aparta?.size) {
        nodo.querySelectorAll(MOVILES).forEach((el, i) => {
          if (aparta.has(claveMovil(el, i)) && !el.hasAttribute("data-export-hide")) {
            el.setAttribute("data-export-hide", "");
            apartados.push(el);
          }
        });
      }

      try {
        return { imagen: await retrata(), cajas: aparta ? cajasDe(nodo) : new Map() };
      } finally {
        apartados.forEach((el) => el.removeAttribute("data-export-hide"));
      }
    }

    async function retrata() {
      const inicio = performance.now();

      if (caliente) {
        try {
          const imagen = await fotoRapida(nodo, { ...opciones, fontEmbedCSS });

          /* Lo que cuesta cada fotograma, para medirlo desde fuera. */
          performance.measure("abp-video-foto", { start: inicio });

          return imagen;
        } catch {
          /* Si la rápida falla, la de siempre. */
        }
      }

      const { dataUrl } = await capturaNodo(nodo, opciones);

      if (!caliente) {
        fontEmbedCSS = await fuentesIncrustadas(nodo, opciones);
        caliente = true;
      }

      return cargaImagen(dataUrl);
    }

    const lienzo = document.createElement("canvas");

    lienzo.width = d.ancho;
    lienzo.height = d.alto;

    const ctx = lienzo.getContext("2d");

    if (!ctx) throw new Error("El navegador no da un lienzo 2D");

    const dibuja = (imagen: HTMLImageElement | HTMLCanvasElement) => {
      ctx.fillStyle = COLORES.tinta;
      ctx.fillRect(0, 0, d.ancho, d.alto);

      if (destino === "vertical") pintaVertical(ctx, imagen, titulo);
      else ctx.drawImage(imagen, 0, 0, d.ancho, d.alto);
    };

    let fallo: Error | null = null;
    const muxor = new MuxorMp4();
    const codificador = new VideoEncoder({
      output: (trozo, metadatos) => {
        const descripcion = metadatos?.decoderConfig?.description;

        if (descripcion) muxor.configuraVideo({ ancho: d.ancho, alto: d.alto, descripcion: copiaBytes(descripcion) });

        const datos = new Uint8Array(new ArrayBuffer(trozo.byteLength));

        trozo.copyTo(datos);
        muxor.añadeVideo(datos as Bytes, Math.max(0, trozo.timestamp), trozo.duration || 1_000_000 / FPS_LAMINA, trozo.type === "key");
      },
      error: (e) => {
        fallo = e instanceof Error ? e : new Error(String(e));
      },
    });

    abierto = codificador;

    codificador.configure({
      codec,
      width: d.ancho,
      height: d.alto,
      bitrate: d.caudal,
      framerate: FPS_LAMINA,
      latencyMode: "quality",
      avc: { format: "avc" },
    });

    let cuadros = 0;

    const emite = async (veces: number) => {
      for (let k = 0; k < veces; k += 1) {
        if (fallo) throw fallo;

        const cuadro = new VideoFrame(lienzo, {
          timestamp: Math.round((cuadros * 1_000_000) / FPS_LAMINA),
          duration: Math.round(1_000_000 / FPS_LAMINA),
        });

        codificador.encode(cuadro, { keyFrame: cuadros % (FPS_LAMINA * 2) === 0 });
        cuadro.close();
        cuadros += 1;

        while (codificador.encodeQueueSize > 6) await new Promise((resuelve) => setTimeout(resuelve, 5));
      }
    };

    /* El plan: salida quieta; cada fase, en movimiento y luego quieta. */
    const total = 1 + nFases * (FOTOS_POR_FASE + 2);
    let hechas = 0;
    const avanza = () => alAvance?.(++hechas / total);

    /* El fotograma en movimiento se compone aquí, a la medida del tablero, y luego pasa al vídeo. */
    const mezcla = document.createElement("canvas");

    mezcla.width = TABLERO_W;
    mezcla.height = TABLERO_H;

    const mx = mezcla.getContext("2d");

    if (!mx) throw new Error("El navegador no da un lienzo 2D");

    let reposo = await foto(0);

    dibuja(reposo);
    avanza();
    await emite(Math.round(SALIDA_S * FPS_LAMINA));

    let poster: string | null = null;

    for (let fase = 1; fase <= nFases; fase += 1) {
      /*
        Las fichas sueltas: la foto sin ninguna contra la foto con sólo unas
        pocas que no se tocan. Con todas a la vez, el recorte de una se
        llevaba trozos de la de al lado cuando estaban juntas.
      */
      const claves = [...cajasDe(nodo).keys()];
      const primera = await toma(fase - 1, new Set(claves));
      const sueltas = new Map<string, HTMLCanvasElement>();
      const tocan = (a: Caja, b: Caja) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
      const tandas: string[][] = [];

      for (const clave of primera.cajas.keys()) {
        const caja = primera.cajas.get(clave) as Caja;
        const tanda = tandas.find((t) => t.every((otra) => !tocan(caja, primera.cajas.get(otra) as Caja)));

        if (tanda) tanda.push(clave);
        else tandas.push([clave]);
      }

      for (const tanda of tandas) {
        const sola = await toma(fase - 1, new Set(claves.filter((c) => !tanda.includes(c))));

        for (const clave of tanda) {
          const recorte = recorta(sola.imagen, primera.imagen, primera.cajas.get(clave) as Caja);

          if (recorte) sueltas.set(clave, recorte);
        }
      }

      avanza();

      /* Lo que no está quieto al empezar (un balón que aparece) se queda en el fondo, como antes. */
      const aparta = new Set(sueltas.keys());
      const tomas: Toma[] = [primera];

      for (let k = 1; k <= FOTOS_POR_FASE; k += 1) {
        tomas.push(await toma(fase - 1 + k / FOTOS_POR_FASE, aparta));
        avanza();
      }

      const porTramo = (MOVIMIENTO_S * FPS_LAMINA) / FOTOS_POR_FASE;

      for (let k = 0; k < FOTOS_POR_FASE; k += 1) {
        const a = tomas[k];
        const b = tomas[k + 1];
        const n = Math.round((k + 1) * porTramo) - Math.round(k * porTramo);

        for (let j = 0; j < n; j += 1) {
          const t = j / n;

          mx.globalAlpha = 1;
          mx.drawImage(a.imagen, 0, 0, TABLERO_W, TABLERO_H);

          if (t > 0) {
            mx.globalAlpha = t;
            mx.drawImage(b.imagen, 0, 0, TABLERO_W, TABLERO_H);
            mx.globalAlpha = 1;
          }

          for (const [clave, recorte] of sueltas) {
            const ca = a.cajas.get(clave) ?? b.cajas.get(clave);
            const cb = b.cajas.get(clave) ?? ca;

            if (!ca || !cb) continue;

            const cx = ca.x + ca.w / 2 + (cb.x + cb.w / 2 - (ca.x + ca.w / 2)) * t;
            const cy = ca.y + ca.h / 2 + (cb.y + cb.h / 2 - (ca.y + ca.h / 2)) * t;

            mx.drawImage(recorte, cx - recorte.width / 2, cy - recorte.height / 2);
          }

          dibuja(mezcla);
          await emite(1);
        }
      }

      reposo = await foto(fase);
      dibuja(reposo);
      avanza();
      await emite(Math.round(PAUSA_S * FPS_LAMINA));

      if (fase === nFases) poster = lienzo.toDataURL("image/jpeg", 0.88);
    }

    await codificador.flush();
    codificador.close();

    if (fallo) throw fallo;

    const fichero = muxor.cierra();

    const posterBlob = poster ? await (await fetch(poster)).blob() : null;

    return { fichero, poster: posterBlob, segundos: cuadros / FPS_LAMINA };
  } finally {
    // Si algo falla a mitad, el codificador queda abierto y Chrome se queda sin codificadores para el siguiente vídeo.
    if (abierto && abierto.state !== "closed") abierto.close();
  }
}

export function VideoJugada({
  slide,
  titulo,
  players,
  temporada,
  rival,
  jornada,
  trabajo,
}: {
  /** Montado por el trabajo de segundo plano del layout (31/10/2026): graba solo y no enseña el botón. */
  trabajo?: { id: string; destino: Destino };
  slide: SlidePizarra;
  titulo: string;
  players: Map<string, Player>;
  temporada: string;
  rival: string;
  jornada?: string;
}) {
  const fases = fasesDe(slide.trazos);

  /* En el servidor no hay WebCodecs: el botón sólo existe en el navegador que sabe. */
  const sabe = useSyncExternalStore(nada, puedeHacerVideo, () => false);

  const segundos = duracionVideo(fases);

  const [abierto, setAbierto] = useState(false);
  const [destino, setDestino] = useState<Destino | null>(trabajo?.destino ?? null);
  const [tiempo, setTiempo] = useState<number>(0);
  const [progreso, setProgreso] = useState("");

  const raizRef = useRef<HTMLDivElement>(null);
  const corriendo = useRef(false);

  /* Cada fotograma espera a que el tablero de fuera de pantalla esté pintado. */
  const pon = useCallback(async (valor: number) => {
    setTiempo(valor);
    await pintado();
    await pintado();
  }, []);

  const monta = useCallback(async () => {
    const raiz = raizRef.current;

    if (!raiz || !destino || corriendo.current) return;

    corriendo.current = true;

    const d = DESTINOS[destino];
    const nFases = fasesDe(slide.trazos);
    const aviso = toast.loading("Montando el vídeo de la jugada…");
    try {
      await pintado();
      const nodo = raiz.querySelector<HTMLElement>("[data-abp-tablero]");

      if (!nodo) throw new Error("No hay diapositiva que grabar");

      const { fichero, poster, segundos } = await grabaJugada({
        nodo,
        pon,
        nFases,
        destino,
        titulo,
        alAvance: (fraccion) => setProgreso(`${Math.round(fraccion * 100)} %`),
      });

      const nombre = nombreDelVideo(titulo, jornada);

      descarga(fichero, `${nombre}${d.sufijo}.mp4`);

      if (poster) descarga(poster, `${nombre}${d.sufijo} poster.jpg`);

      toast.success(
        `Vídeo listo · ${coma(segundos)} s · ${coma(fichero.size / 1_000_000)} MB · ${d.ancho} × ${d.alto}. Déjalo en ABP\\VIDEO - JUGADORES.`,
        { id: aviso, duration: 8_000 },
      );
    } catch (error) {
      console.error("[abp-pizarra] vídeo", error);
      toast.error(error instanceof Error && error.message ? error.message : "No se ha podido montar el vídeo", { id: aviso });
    } finally {
      corriendo.current = false;
      setDestino(null);
      setTiempo(0);
      setProgreso("");

      if (trabajo) trabajoExportar.termina(trabajo.id);
    }
  }, [destino, slide, jornada, pon, titulo, trabajo]);

  useEffect(() => {
    if (trabajo && progreso) trabajoExportar.rotula(trabajo.id, progreso);
  }, [trabajo, progreso]);

  useEffect(() => {
    if (!destino) return;

    const id = window.setTimeout(() => void monta(), 80);

    return () => window.clearTimeout(id);
  }, [destino, monta]);

  /* En la pizarra, el vídeo de esta diapositiva lo graba el trabajo de segundo plano. */
  const encargado = useSyncExternalStore(
    trabajoExportar.suscribe,
    () => enMarcha(trabajoExportar.foto(), "video", (e) => e.datos.slide.id === slide.id),
    () => undefined,
  );
  const rotulo = useSyncExternalStore(trabajoExportar.suscribe, () => (encargado ? trabajoExportar.foto().rotulos[encargado.id] : undefined), () => undefined);

  if (trabajo) {
    return destino ? (
      <div
        ref={raizRef}
        aria-hidden
        data-export-hide
        className="pointer-events-none"
        style={{ position: "fixed", top: 0, left: -(TABLERO_W + 200), width: TABLERO_W, zIndex: -1 }}
      >
        <TableroSlide
          slide={slide}
          titulo={titulo}
          tiempo={tiempo}
          soloVer
          players={players}
          temporada={temporada}
          rival={rival}
          seleccion={null}
          onMover={() => undefined}
          onQuitar={() => undefined}
          onPulsarPuesto={() => undefined}
          onSeleccionar={() => undefined}
        />
      </div>
    ) : null;
  }

  if (fases === 0 || !sabe) return null;

  return (
    <div className="relative">
      <Button
        icon={Film}
        onClick={() => setAbierto((actual) => !actual)}
        disabled={Boolean(encargado)}
        title={`Sigue aunque cambies de pantalla. Un MP4 de ${coma(segundos, 0)} s con la jugada fase a fase, para ABP\\VIDEO - JUGADORES`}
      >
        {encargado ? `Montando… ${rotulo ?? ""}` : "Vídeo de la jugada"}
      </Button>

      {abierto && !encargado && (
        <div
          role="menu"
          className="absolute left-0 top-full z-40 mt-1.5 w-[min(320px,calc(100vw-32px))] rounded-xl border border-white/10 bg-[#11161C] p-1.5 shadow-2xl"
        >
          {(Object.keys(DESTINOS) as Destino[]).map((clave) => (
            <button
              key={clave}
              type="button"
              role="menuitem"
              onClick={() => {
                setAbierto(false);
                trabajoExportar.encarga({ tipo: "video", destino: clave, datos: { slide, titulo, players, temporada, rival, jornada } });
              }}
              className="block w-full rounded-lg px-3 py-2 text-left transition hover:bg-white/10"
            >
              <span className="block text-sm font-semibold text-white">{DESTINOS[clave].titulo}</span>
              <span className="block text-xs text-white/50">
                {DESTINOS[clave].detalle} · {coma(segundos, 0)} s · ≈ {coma(pesoMb(clave, segundos))} MB
              </span>
            </button>
          ))}
        </div>
      )}

    </div>
  );
}
