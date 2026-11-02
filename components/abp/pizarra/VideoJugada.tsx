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
import { flushSync } from "react-dom";

import { COLORES, TABLERO_W, lineasConsignas, normalizaConsigna, type SlidePizarra } from "@/lib/abp/pizarra";
import { fasesDe } from "@/lib/abp/trazos";
import { descarga, pintado } from "@/lib/export/lienzos";
import { FAMILIA_PORTADA } from "@/lib/rivals/portada-font";
import { FPS_LAMINA, puedeHacerVideo } from "@/lib/tactics/lamina";
import { abreEmisor, montaJugada, ruedaMaterial, type MaterialJugada, type PideFoto, type Tiempos } from "@/lib/abp/rodaje-jugada";
import { enMarcha, trabajoExportar } from "@/lib/abp/trabajo-exportar";
import {
  claveVideo,
  guardaMaterial,
  guardaVideo,
  hayVideo,
  huellaSlide,
  materialGuardado,
  videoGuardado,
  type VideoHecho,
} from "@/lib/abp/cache-exportar";

/** Sube cuando cambia el montaje (ritmo, rótulos, calidad): lo grabado antes no vale. */
const MONTAJE_VIDEO = "tv-1080-1";

/** La clave del vídeo de una diapositiva para un destino: si no ha cambiado nada, no se vuelve a grabar. */
export const claveDelVideo = (
  slide: SlidePizarra,
  titulo: string,
  destino: Destino,
  contexto: { players: Map<string, Player>; temporada: string; rival: string },
) => `${claveVideo(huellaSlide(slide, titulo, contexto), destino)}|${MONTAJE_VIDEO}`;

/** La del material fotografiado: vale para todos los destinos y para los vídeos de cada jugador. */
export const claveMaterial = (slide: SlidePizarra, titulo: string, contexto: { players: Map<string, Player>; temporada: string; rival: string }) =>
  `${huellaSlide(slide, titulo, contexto)}|${MONTAJE_VIDEO}`;

/** Graba, o devuelve el que ya estaba hecho con la misma huella. */
export async function videoDeLaJugada(clave: string, graba: () => Promise<VideoHecho>): Promise<VideoHecho & { deMemoria: boolean }> {
  const hecho = videoGuardado(clave);

  if (hecho) return { ...hecho, deMemoria: true };

  const nuevo = await graba();

  guardaVideo(clave, nuevo);

  return { ...nuevo, deMemoria: false };
}

export type Destino = "sala" | "whatsapp" | "vertical";

const DESTINOS: Record<Destino, { ancho: number; alto: number; caudal: number; titulo: string; detalle: string; sufijo: string }> = {
  /*
  | La sala y el .zip de «Exportar» (01/11/2026: «se verán en una TV HD de 40
  | pulgadas»): 1920 × 1080 a 30 fps, la foto del tablero píxel a píxel y 12
  | Mb/s (H.264 High si el navegador lo da, ver `codecLamina`).
  */
  sala: { ancho: 1920, alto: 1080, caudal: 12_000_000, titulo: "Para la sala o la tele", detalle: "1920 × 1080, 30 fps, calidad TV", sufijo: "" },
  /*
  | WhatsApp vuelve a comprimir todo lo que se manda como vídeo: con más caudal
  | de partida (3,5 Mb/s, antes 2,2) las caras y los dorsales llegan nítidos
  | después de su pasada, y un vídeo de 10 s sigue en unos 4 MB.
  */
  whatsapp: { ancho: 1280, alto: 720, caudal: 3_500_000, titulo: "Para WhatsApp", detalle: "1280 × 720, nítido tras la compresión de WhatsApp", sufijo: " whatsapp" },
  vertical: { ancho: 1080, alto: 1920, caudal: 4_500_000, titulo: "Para el móvil", detalle: "vertical 1080 × 1920", sufijo: " movil" },
};

/*
| Los tiempos (segundos). Menos paja (01/11/2026, «vídeos más útiles, menos
| paja»): antes eran 2,5 s de salida quieta y 2,5 s de pausa tras CADA fase,
| y un córner de tres fases duraba 14,5 s de los que 9,5 eran imagen parada.
| Ahora la salida se ve lo justo para situarse, entre fases sólo se respira y
| la pausa larga va al final, con todos en su sitio de llegada.
|
| Segunda vuelta de los expertos (01/11/2026): la salida, 2 s (con el nombre
| de la jugada no daba tiempo a leerla) y entre fases 1,3 s.
*/
const SALIDA_S = 2;
/* 01/11/2026: 1,5 → 2 s («poco fluidos»): con 20 fotos por fase las carreras se ven enteras. */
const MOVIMIENTO_S = 2;
const PAUSA_S = 1.3;
const FINAL_S = 3;
/** Cuánto se ve el rótulo de cada tramo («FASE 2 DE 3») antes de irse. */
const ROTULO_S = 1.1;
/** En la salida, el rótulo lleva el nombre de la jugada: se queda casi toda la salida. */
const ROTULO_SALIDA_S = SALIDA_S - 0.2;
/** La consigna principal en grande al final: desde cuándo y cuánto. */
const CONSIGNA_DESDE_S = 0.5;
const CONSIGNA_S = 2;

const nada = () => () => undefined;

export function duracionVideo(fases: number) {
  return SALIDA_S + fases * MOVIMIENTO_S + Math.max(0, fases - 1) * PAUSA_S + FINAL_S;
}

/** Los textos del vídeo que salen de la diapositiva: el de cada fase y la consigna principal. */
export type TextosVideo = { fases: Record<number, string>; consigna: string };

/** «Fase 2: bloqueo al portero», «F2 · bloqueo al portero», «2.ª fase: …». */
const FASE_EN_CONSIGNA = /^(?:fase\s*(\d)|f\s*(\d)|(\d)\.?\s*[ªa]?\s*fase)\s*[:.·–-]\s*(.+)$/i;

/**
 * Lo que la diapositiva dice para el vídeo. La pizarra no tiene un texto por
 * fase propio: si una consigna empieza por «Fase 2:», ese es el de la fase
 * 2. La consigna principal es la rutina del guion, o la intención, o la
 * primera consigna libre (que no sea de una fase).
 */
export function textosDelVideo(slide: Pick<SlidePizarra, "notas" | "guion"> & { titulo?: string }): TextosVideo {
  /* Lo que repite el título (o una de sus partes, «CÓRNER OFENSIVO · Segundo córner») no es la consigna. */
  const llano = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9ñ]+/g, " ").trim();
  const delTitulo = new Set([slide.titulo ?? "", ...(slide.titulo ?? "").split("·")].map(llano).filter(Boolean));
  const util = (t: string) => Boolean(t) && !delTitulo.has(llano(t));
  const fases: Record<number, string> = {};
  const libres: string[] = [];

  for (const linea of lineasConsignas(slide.notas ?? [])) {
    if (linea.tipo !== "consigna") continue;

    const fase = FASE_EN_CONSIGNA.exec(linea.texto);

    if (fase) {
      const n = Number(fase[1] ?? fase[2] ?? fase[3]);
      const texto = fase[4].trim().replace(/[.;]+$/, "");

      if (n >= 1 && n <= 3 && texto && !fases[n]) fases[n] = texto;
    } else {
      libres.push(linea.texto.trim().replace(/[.;]+$/, ""));
    }
  }

  const guion = [slide.guion?.rutina, slide.guion?.intencion].map((t) => t?.trim() ?? "").find(util);

  return { fases, consigna: guion ? normalizaConsigna(guion).replace(/[.;]+$/, "") : (libres.find(util) ?? "") };
}

type Rotulo = { antetitulo?: string; texto: string; dura: number };

/** El rótulo de cada tramo del vídeo. */
function rotuloDeTramo(tramo: number, nFases: number, titulo: string, textos: TextosVideo): Rotulo {
  if (tramo === 0) return titulo.trim() ? { antetitulo: "Salida", texto: titulo, dura: ROTULO_SALIDA_S } : { texto: "Salida", dura: ROTULO_S };
  if (tramo > nFases) return { texto: "Llegada", dura: ROTULO_S };

  const propio = textos.fases[tramo];

  if (propio) return { texto: `Fase ${tramo} · ${propio}`, dura: ROTULO_S };

  return { texto: nFases === 1 ? "Movimiento" : `Fase ${tramo} de ${nFases}`, dura: ROTULO_S };
}

const fundido = (desde: number, dura: number, salida = 0.3) => (desde < dura - salida ? 1 : Math.max(0, (dura - desde) / salida));

/** Un texto en una línea que quepa en `maxW`: baja la letra hasta 3/4 y, si no, corta palabras. */
function enUnaLinea(ctx: CanvasRenderingContext2D, texto: string, cuerpo: number, peso: number, maxW: number) {
  let px = cuerpo;
  const pon = () => {
    ctx.font = `${peso} ${px}px ${FAMILIA_PORTADA}, Arial, sans-serif`;
  };

  pon();

  while (ctx.measureText(texto).width > maxW && px > cuerpo * 0.75) {
    px -= 1;
    pon();
  }

  let linea = texto;

  while (ctx.measureText(linea).width > maxW && linea.includes(" ")) linea = `${linea.slice(0, linea.lastIndexOf(" ")).replace(/[\s·,:;]+$/, "")}…`.replace(/……$/, "…");

  return { linea, px };
}

/**
 * Lo que va encima de cada fotograma: una barra fina al pie con un tramo por
 * fase (se ve cuánto queda) y, al empezar cada tramo, su rótulo grande, que
 * en el móvil el de la cabecera de la diapositiva no se lee. Se va solo en
 * algo más de un segundo para no tapar las consignas. Al final, la consigna
 * principal en grande durante 2 s.
 */
function pintaCapa(
  ctx: CanvasRenderingContext2D,
  ancho: number,
  alto: number,
  {
    progreso,
    cortes,
    rotulo,
    desde,
    consigna,
  }: { progreso: number; cortes: number[]; rotulo: Rotulo; desde: number; consigna?: string },
) {
  const barra = Math.max(4, Math.round(alto * 0.006));
  const apaisado = ancho > alto;

  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.fillRect(0, alto - barra, ancho, barra);
  ctx.fillStyle = COLORES.oro;
  ctx.fillRect(0, alto - barra, ancho * Math.min(1, progreso), barra);
  ctx.fillStyle = COLORES.tinta;

  for (const corte of cortes) ctx.fillRect(Math.round(ancho * corte) - 1, alto - barra, 3, barra);

  const alpha = fundido(desde, rotulo.dura);
  const base = Math.min(ancho, alto * (16 / 9));

  if (alpha > 0) {
    const cuerpo = Math.round(base * 0.024);
    const chico = Math.round(cuerpo * 0.62);
    const x = Math.round(ancho * 0.025);
    /* En horizontal no pasa del césped (el panel de la derecha empieza en el 79 %). */
    const maxTexto = (apaisado ? ancho * 0.74 : ancho * 0.95) - cuerpo * 1.2;
    const { linea, px } = enUnaLinea(ctx, rotulo.texto.toUpperCase(), cuerpo, 700, maxTexto);
    const ante = rotulo.antetitulo?.toUpperCase() ?? "";

    ctx.font = `700 ${px}px ${FAMILIA_PORTADA}, Arial, sans-serif`;
    const anchoTexto = ctx.measureText(linea).width;
    ctx.font = `700 ${chico}px ${FAMILIA_PORTADA}, Arial, sans-serif`;
    const anchoAnte = ante ? ctx.measureText(ante).width : 0;

    const w = Math.max(anchoTexto, anchoAnte) + cuerpo * 1.2;
    const h = px * 1.6 + (ante ? chico * 1.25 : 0);
    /* En horizontal, dentro del césped (abajo a la izquierda): más abajo tapaba las consignas. */
    const y = apaisado ? Math.round(alto * 0.775) - h : alto - barra - h - Math.round(alto * 0.03);

    ctx.globalAlpha = alpha;
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(10,14,20,0.82)";
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, Math.min(h, px * 1.6) / 4);
    ctx.fill();
    ctx.fillStyle = COLORES.oro;
    ctx.fillRect(x, y, Math.max(4, cuerpo * 0.18), h);

    if (ante) {
      ctx.font = `700 ${chico}px ${FAMILIA_PORTADA}, Arial, sans-serif`;
      ctx.fillText(ante, x + cuerpo * 0.6, y + chico * 1.05);
    }

    ctx.font = `700 ${px}px ${FAMILIA_PORTADA}, Arial, sans-serif`;
    ctx.fillText(linea, x + cuerpo * 0.6, y + h - px * 0.8 + 1);
    ctx.globalAlpha = 1;
  }

  /* La consigna principal, en grande, en los segundos de la llegada. */
  const enConsigna = desde - CONSIGNA_DESDE_S;

  if (consigna && enConsigna >= 0 && enConsigna < CONSIGNA_S) {
    const entra = Math.min(1, enConsigna / 0.25);
    const sale = fundido(enConsigna, CONSIGNA_S, 0.3);
    const cuerpo = Math.round(base * 0.042);
    const x = Math.round(ancho * (apaisado ? 0.025 : 0.04));
    const w = Math.round(apaisado ? ancho * 0.74 : ancho * 0.92);
    const maxTexto = w - cuerpo * 1.6;

    /* Hasta dos renglones; si no caben, baja la letra. */
    let px = cuerpo;
    let lineas: string[] = [];

    for (; px >= cuerpo * 0.6; px -= 2) {
      ctx.font = `700 ${px}px ${FAMILIA_PORTADA}, Arial, sans-serif`;
      lineas = [];
      let actual = "";

      for (const palabra of consigna.split(/\s+/).filter(Boolean)) {
        const prueba = actual ? `${actual} ${palabra}` : palabra;

        if (actual && ctx.measureText(prueba).width > maxTexto) {
          lineas.push(actual);
          actual = palabra;
        } else {
          actual = prueba;
        }
      }

      if (actual) lineas.push(actual);
      if (lineas.length <= 2) break;
    }

    if (lineas.length > 2) lineas = [lineas[0], `${lineas[1]}…`];

    const h = lineas.length * px * 1.2 + px * 0.9;
    /* En horizontal, sobre el césped, por encima del rótulo; en vertical, en el hueco bajo la diapositiva. */
    const y = apaisado ? Math.round(alto * 0.36) : Math.round(alto * 0.7);

    ctx.globalAlpha = Math.min(entra, sale);
    ctx.fillStyle = "rgba(10,14,20,0.86)";
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, px * 0.3);
    ctx.fill();
    ctx.fillStyle = COLORES.oro;
    ctx.fillRect(x, y, Math.max(5, px * 0.14), h);
    ctx.fillStyle = "#FFFFFF";
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.font = `700 ${px}px ${FAMILIA_PORTADA}, Arial, sans-serif`;
    lineas.forEach((texto, i) => ctx.fillText(texto, x + px * 0.8, y + px * 0.45 + px * 0.6 + i * px * 1.2));
  }

  ctx.restore();
}

export function pesoMb(destino: Destino, segundos: number) {
  return (DESTINOS[destino].caudal * segundos * 1.05) / 8 / 1_000_000;
}

const coma = (numero: number, decimales = 1) => numero.toFixed(decimales).replace(".", ",");

/** «J9 corner ofensivo»: sin tildes, en minúsculas, para la carpeta. */
export function nombreDelVideo(titulo: string, jornada?: string) {
  const limpio = titulo
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  return [jornada?.trim(), limpio || "jugada"].filter(Boolean).join(" ");
}

/**
 * El fotograma vertical: la diapositiva entera de ancho, centrada, sobre ella
 * misma ampliada y desenfocada, con el título arriba.
 */
function pintaVertical(ctx: CanvasRenderingContext2D, foto: CanvasImageSource & { width: number; height: number }, titulo: string) {
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

export type { PideFoto };

/** Los tiempos del vídeo de una diapositiva. */
const TIEMPOS: Tiempos = { salida: SALIDA_S, movimiento: MOVIMIENTO_S, pausa: PAUSA_S, final: FINAL_S };

/*
| Graba una diapositiva en MP4 (30/10/2026: sacado del botón para poder grabar
| todas de una vez desde «Exportar todo»). Devuelve el vídeo, su póster y el
| material fotografiado (01/11/2026): con él salen los vídeos de cada jugador
| sin volver a fotografiar, y un segundo intento sólo vuelve a codificar.
*/
export async function grabaJugada({
  nodo,
  pon,
  nFases,
  destino,
  titulo,
  textos = { fases: {}, consigna: "" },
  alAvance,
  material: hecho,
  software = false,
}: PideFoto & {
  nFases: number;
  destino: Destino;
  titulo: string;
  /** El texto de cada fase y la consigna principal (`textosDelVideo`). */
  textos?: TextosVideo;
  alAvance?: (fraccion: number) => void;
  /** Lo ya fotografiado de esta diapositiva: no se vuelve a fotografiar. */
  material?: MaterialJugada | null;
  /** El codificador del navegador y no el de la tarjeta (segundo intento). */
  software?: boolean;
}): Promise<{ fichero: Blob; poster: Blob | null; segundos: number; material: MaterialJugada }> {
  const d = DESTINOS[destino];
  const inicio = performance.now();
  /* Fotografiar es lo caro: tres cuartos de la barra. */
  const material =
    hecho ?? (await ruedaMaterial({ nodo, pon, nFases, alAvance: (f) => alAvance?.(f * 0.75) }));
  const desde = hecho ? 0 : 0.75;
  /* Caudal variable también en la sala: el «constant» del codificador del navegador salía MÁS bajo (3,5-4,2 Mb/s contra 5,6, medido el 01/11/2026). */
  const e = await abreEmisor(d.ancho, d.alto, d.caudal, software, "variable");

  try {
    const { poster } = await montaJugada(e, material, {
      tiempos: TIEMPOS,
      dibuja: (ctx, foto) => {
        ctx.fillStyle = COLORES.tinta;
        ctx.fillRect(0, 0, d.ancho, d.alto);

        if (destino === "vertical") pintaVertical(ctx, foto as HTMLCanvasElement, titulo);
        /* En 1920 × 1080 la foto va tal cual, píxel a píxel. */
        else ctx.drawImage(foto, 0, 0, d.ancho, d.alto);
      },
      capa: (ctx, estado) =>
        pintaCapa(ctx, d.ancho, d.alto, {
          progreso: estado.progreso,
          cortes: estado.cortes,
          rotulo: rotuloDeTramo(estado.tramo, nFases, titulo, textos),
          desde: estado.desde,
          consigna: estado.tramo > nFases ? textos.consigna : undefined,
        }),
      alAvance: (f) => alAvance?.(desde + f * (1 - desde)),
    });

    const fichero = await e.cierra();

    /* Lo que cuesta cada vídeo, para medirlo desde fuera. */
    performance.mark("abp-video-hecho", {
      detail: { titulo, destino, segundos: Math.round((performance.now() - inicio) / 100) / 10, deMaterial: Boolean(hecho), mb: Math.round(fichero.size / 10_000) / 100 },
    });

    return { fichero, poster, segundos: e.cuadros / FPS_LAMINA, material };
  } finally {
    // Si algo falla a mitad, el codificador queda abierto y Chrome se queda sin codificadores para el siguiente vídeo.
    e.suelta();
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
    /* En el acto: con la pestaña escondida no hay fotograma al que esperar. */
    flushSync(() => setTiempo(valor));
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
      /* Si la diapositiva no ha cambiado desde el último vídeo para este destino, sale al momento. */
      const clave = claveDelVideo(slide, titulo, destino, { players, temporada, rival });
      const { fichero, poster, segundos, deMemoria } = await videoDeLaJugada(clave, async () => {
        await pintado();
        const nodo = raiz.querySelector<HTMLElement>("[data-abp-tablero]");

        if (!nodo) throw new Error("No hay diapositiva que grabar");

        const material = materialGuardado(claveMaterial(slide, titulo, { players, temporada, rival }));
        const hecho = await grabaJugada({
          nodo,
          pon,
          nFases,
          destino,
          titulo,
          textos: textosDelVideo(slide),
          material,
          alAvance: (fraccion) => setProgreso(`${Math.round(fraccion * 100)} %`),
        });

        guardaMaterial(claveMaterial(slide, titulo, { players, temporada, rival }), hecho.material);

        return { fichero: hecho.fichero, poster: hecho.poster, segundos: hecho.segundos };
      });

      const nombre = nombreDelVideo(titulo, jornada);

      descarga(fichero, `${nombre}${d.sufijo}.mp4`);

      if (poster) descarga(poster, `${nombre}${d.sufijo} poster.jpg`);

      toast.success(
        `${deMemoria ? "Vídeo listo al momento (la jugada no ha cambiado)" : "Vídeo listo"} · ${coma(segundos)} s · ${coma(fichero.size / 1_000_000)} MB · ${d.ancho} × ${d.alto}. Déjalo en ABP\\VIDEO - JUGADORES.`,
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
  }, [destino, slide, jornada, pon, titulo, trabajo, players, temporada, rival]);

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
                {hayVideo(claveDelVideo(slide, titulo, clave, { players, temporada, rival })) && (
                  <span className="text-emerald-400"> · ya hecho, sale al momento</span>
                )}
              </span>
            </button>
          ))}
        </div>
      )}

    </div>
  );
}
