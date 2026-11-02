"use client";

/**
 * LAS JUGADAS DE LA PIZARRA, RODADAS PARA EL VÍDEO POST DE ABP (02/11/2026).
 *
 * El vídeo post del informe de ABP enseña «lo que preparamos»: las
 * diapositivas de /abp-pizarra de ese partido, animadas fase a fase con el
 * MISMO rodaje que «Vídeo de la jugada» (`grabaJugada`, 1920 × 1080 a 30
 * fps). Aquí se montan fuera de la página con `createRoot` —no dentro de un
 * diálogo—, así que el rodaje sigue aunque se cierre el informe: lo lanza el
 * `prepara` de `trabajoVideo.pide`, ya en su turno de la cola.
 *
 * Lo ya rodado no se rehace: el vídeo de cada diapositiva se guarda con la
 * huella de la diapositiva (`claveDelVideo`, la misma de la pizarra), así
 * que si el analista ya sacó los vídeos en «Exportar todo», salen al momento.
 * Cada vídeo se da como URL de memoria UNA vez por huella: el informe de ABP
 * y el del partido montan el mismo guion y se encuentran el mismo vídeo.
 */

import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";

import type { Player } from "@/types/player";
import { TableroSlide } from "@/components/abp/pizarra/TableroSlide";
import { claveDelVideo, claveMaterial, duracionVideo, grabaJugada, textosDelVideo } from "@/components/abp/pizarra/VideoJugada";
import { TABLERO_W, tituloVisible, type SlidePizarra, type TableroPizarra } from "@/lib/abp/pizarra";
import { fasesDe } from "@/lib/abp/trazos";
import { guardaMaterial, guardaVideo, materialGuardado, videoGuardado } from "@/lib/abp/cache-exportar";
import { pintado } from "@/lib/export/lienzos";
import { conJugadasResueltas, jugadasPendientes, type JugadaDelVideo } from "@/lib/video-informe/guion-abp-post";
import type { GuionVideo } from "@/lib/video-informe/guion";

/** Una jugada con lo necesario para rodarla. */
export type JugadaParaRodar = JugadaDelVideo & { slide: SlidePizarra; rival: string; temporada: string };

/**
 * Cuántas jugadas entran (02/11/2026): dos. Cada una dura 10-15 s y
 * fotografiarla cuesta ~1 min la primera vez; con más, el vídeo post se
 * convertía en la pizarra entera y tardaba demasiado en salir.
 */
export const JUGADAS_EN_EL_VIDEO = 2;

/** Las jugadas de un tablero que se ruedan: las primeras con movimiento, en el orden de la pizarra. */
export function jugadasDelTablero(tablero: TableroPizarra | null, players: Player[], { rival, temporada, maximo = JUGADAS_EN_EL_VIDEO }: { rival: string; temporada: string; maximo?: number }): JugadaParaRodar[] {
  if (!tablero?.slides?.length || !players.length) return [];

  const porId = new Map(players.map((p) => [p.id, p]));
  const contexto = { players: porId, temporada, rival };

  return tablero.slides
    .map((slide, indice) => ({ slide, indice, fases: fasesDe(slide.trazos) }))
    .filter((x) => x.fases > 0)
    .slice(0, maximo)
    .map(({ slide, indice, fases }) => {
      const titulo = tituloVisible(tablero.slides, indice);

      return { clave: claveDelVideo(slide, titulo, "sala", contexto), titulo, segundos: duracionVideo(fases), slide, rival, temporada };
    });
}

/** La URL de memoria de cada vídeo ya rodado, por su huella: una sola por vídeo en toda la pestaña. */
const urls = new Map<string, string>();

/** Rueda una diapositiva en un tablero montado fuera de la página. */
async function graba(j: JugadaParaRodar, porId: Map<string, Player>, alAvance: (f: number) => void) {
  const raiz = document.createElement("div");

  raiz.setAttribute("aria-hidden", "true");
  raiz.setAttribute("data-export-hide", "");
  Object.assign(raiz.style, { position: "fixed", top: "0", left: `${-(TABLERO_W + 200)}px`, width: `${TABLERO_W}px`, zIndex: "-1", pointerEvents: "none" });
  document.body.appendChild(raiz);

  const react = createRoot(raiz);
  let tiempo = 0;
  const pinta = () =>
    react.render(
      <TableroSlide
        slide={j.slide}
        titulo={j.titulo}
        tiempo={tiempo}
        soloVer
        players={porId}
        temporada={j.temporada}
        rival={j.rival}
        seleccion={null}
        onMover={() => undefined}
        onQuitar={() => undefined}
        onPulsarPuesto={() => undefined}
        onSeleccionar={() => undefined}
      />,
    );

  try {
    flushSync(pinta);
    await pintado();

    const nodo = raiz.querySelector<HTMLElement>("[data-abp-tablero]");

    if (!nodo) throw new Error("No hay diapositiva que rodar");

    const contexto = { players: porId, temporada: j.temporada, rival: j.rival };
    const hecho = await grabaJugada({
      nodo,
      /* En el acto, como `VideoJugada`: con la pestaña escondida no hay fotograma de pantalla al que esperar. */
      pon: async (valor) => {
        tiempo = valor;
        flushSync(pinta);
        await pintado();
      },
      nFases: fasesDe(j.slide.trazos),
      destino: "sala",
      titulo: j.titulo,
      textos: textosDelVideo(j.slide),
      material: materialGuardado(claveMaterial(j.slide, j.titulo, contexto)),
      alAvance,
    });

    guardaMaterial(claveMaterial(j.slide, j.titulo, contexto), hecho.material);

    return { fichero: hecho.fichero, poster: hecho.poster, segundos: hecho.segundos };
  } finally {
    react.unmount();
    raiz.remove();
  }
}

/**
 * Rueda (o encuentra ya rodadas) las jugadas y devuelve la URL de cada una
 * por su huella. Una que falla se queda fuera: el vídeo sale sin ella.
 */
export async function rodaJugadas(jugadas: JugadaParaRodar[], players: Player[], paso: (texto: string) => void, senal?: AbortSignal): Promise<Map<string, string>> {
  const porId = new Map(players.map((p) => [p.id, p]));
  const salida = new Map<string, string>();

  for (const [i, j] of jugadas.entries()) {
    senal?.throwIfAborted();

    const ya = urls.get(j.clave);

    if (ya) {
      salida.set(j.clave, ya);
      continue;
    }

    try {
      const rotulo = jugadas.length > 1 ? `jugada ${i + 1}/${jugadas.length}` : "jugada de la pizarra";
      const hecho = videoGuardado(j.clave) ?? (await graba(j, porId, (f) => paso(`${rotulo} · ${Math.round(f * 100)} %…`)));

      guardaVideo(j.clave, hecho);

      const url = URL.createObjectURL(hecho.fichero);

      urls.set(j.clave, url);
      salida.set(j.clave, url);
    } catch (error) {
      console.warn("[vídeo ABP] la jugada no se ha podido rodar: sale del vídeo", j.titulo, error);
    }
  }

  return salida;
}

/**
 * El `prepara` de `trabajoVideo.pide` para un guion con jugadas marcadas:
 * las rueda ya en su turno de la cola y cambia cada marca por su vídeo. Las
 * que no salen se quitan del guion.
 */
export function preparaConJugadas(jugadas: JugadaParaRodar[], players: Player[]) {
  return async (guion: GuionVideo, paso: (texto: string) => void, senal: AbortSignal): Promise<GuionVideo> => {
    const pendientes = new Set(jugadasPendientes(guion));

    if (!pendientes.size) return guion;

    const rodadas = await rodaJugadas(
      jugadas.filter((j) => pendientes.has(j.clave)),
      players,
      paso,
      senal,
    );

    return conJugadasResueltas(guion, rodadas);
  };
}
