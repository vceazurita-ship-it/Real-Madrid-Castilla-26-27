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
/** Fotos por fase en movimiento: el resto de fotogramas las repiten. */
const FOTOS_POR_FASE = 12;

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
function pintaVertical(ctx: CanvasRenderingContext2D, foto: HTMLImageElement, titulo: string) {
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
      filter: (n: HTMLElement) => !(n instanceof HTMLElement) || !n.hasAttribute("data-export-hide"),
    };

    /*
      El primer fotograma, con la captura completa: deja las fotos en la caché.
      Los demás, con la rápida y las fuentes hechas una vez (31/10/2026: el
      vídeo tardaba más de un minuto por diapositiva).
    */
    let caliente = false;
    let fontEmbedCSS: string | undefined;

    const foto = async (valor: number) => {
      await pon(valor);

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
    };

    const lienzo = document.createElement("canvas");

    lienzo.width = d.ancho;
    lienzo.height = d.alto;

    const ctx = lienzo.getContext("2d");

    if (!ctx) throw new Error("El navegador no da un lienzo 2D");

    const dibuja = (imagen: HTMLImageElement) => {
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
    const total = 1 + nFases * (FOTOS_POR_FASE + 1);
    let hechas = 0;
    const avanza = () => alAvance?.(++hechas / total);

    dibuja(await foto(0));
    avanza();
    await emite(Math.round(SALIDA_S * FPS_LAMINA));

    let poster: string | null = null;

    for (let fase = 1; fase <= nFases; fase += 1) {
      const porFoto = (MOVIMIENTO_S * FPS_LAMINA) / FOTOS_POR_FASE;
      let emitidos = 0;

      for (let k = 1; k <= FOTOS_POR_FASE; k += 1) {
        dibuja(await foto(fase - 1 + k / FOTOS_POR_FASE));
        avanza();

        const hasta = Math.round(k * porFoto);

        await emite(hasta - emitidos);
        emitidos = hasta;
      }

      dibuja(await foto(fase));
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
}: {
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
  const [destino, setDestino] = useState<Destino | null>(null);
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
    }
  }, [destino, slide, jornada, pon, titulo]);

  useEffect(() => {
    if (!destino) return;

    const id = window.setTimeout(() => void monta(), 80);

    return () => window.clearTimeout(id);
  }, [destino, monta]);

  if (fases === 0 || !sabe) return null;

  return (
    <div className="relative">
      <Button
        icon={Film}
        onClick={() => setAbierto((actual) => !actual)}
        disabled={destino !== null}
        title={`Un MP4 de ${coma(segundos, 0)} s con la jugada fase a fase, para ABP\\VIDEO - JUGADORES`}
      >
        {destino ? `Montando… ${progreso}` : "Vídeo de la jugada"}
      </Button>

      {abierto && !destino && (
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
                setDestino(clave);
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

      {destino && (
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
      )}
    </div>
  );
}
