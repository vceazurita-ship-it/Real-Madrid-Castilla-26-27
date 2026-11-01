"use client";

/*
|--------------------------------------------------------------------------
| EXPORTAR (30/10/2026, rehecho el 31/10 y el 01/11/2026)
|--------------------------------------------------------------------------
|
| Lo pidió el analista: «que pueda exportar de una vez el pdf de cada jugador,
| el general de ABP y los vídeos de cada slide», luego «tarda demasiado» y, el
| 01/11/2026, «mayor facilidad y velocidad en la exportación de todos los
| elementos de la sección».
|
| Un solo botón, «Exportar», abre un menú con todas las salidas de la pizarra,
| qué lleva cada una y cuánto tardará y pesará:
|
|   · Todo (.zip): PDF general, PowerPoint, PDF de cada jugador y un MP4 por
|     diapositiva con jugada.
|   · Solo documentos (.zip) y Solo vídeos (.zip).
|   · PowerPoint y PDF para imprimir, sueltos (los hace `ExportaPizarra`).
|
| Lo que ya salió y no ha cambiado no se rehace (`lib/abp/cache-exportar.ts`):
| la foto de cada diapositiva vale para el PDF, el PowerPoint y la siguiente
| exportación, y cada vídeo se guarda por la huella de su diapositiva. Tocar
| una diapositiva sólo rehace esa.
|
| Todo corre en segundo plano en el layout (`trabajo-exportar.ts`). Un panel
| cuenta cada paso y deja cancelar; lo que falle en un paso no tumba el resto.
*/

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { flushSync } from "react-dom";
import { Check, ChevronDown, Clapperboard, FileStack, Loader2, MonitorPlay, PackageOpen, Printer, UserRound, X } from "lucide-react";
import { toast } from "sonner";

import type { Player } from "@/types/player";
import { Button } from "@/components/abp/ui";
import { TableroSlide } from "@/components/abp/pizarra/TableroSlide";
import { hojasDe } from "@/components/abp/pizarra/ExportaPizarra";
import {
  claveDelVideo,
  claveMaterial,
  duracionVideo,
  grabaJugada,
  nombreDelVideo,
  pesoMb,
  textosDelVideo,
  videoDeLaJugada,
} from "@/components/abp/pizarra/VideoJugada";
import { TABLERO_H, TABLERO_W, jugadoresDelTablero, tituloVisible, type TableroPizarra } from "@/lib/abp/pizarra";
import { fasesDe } from "@/lib/abp/trazos";
import { trabajoPdfs, type EstadoPdfs } from "@/lib/abp/trabajo-pdfs";
import { arrancados, enMarcha as encargoEnMarcha, trabajoExportar, type PiezasExportar } from "@/lib/abp/trabajo-exportar";
import {
  SEGUNDOS_POR_FOTO,
  SEGUNDOS_POR_PDF_JUGADOR,
  duracionLegible,
  guardaMaterial,
  guardaVideo,
  hayVideo,
  materialGuardado,
  pesoLegible,
  resumen,
  segundosDeVideo,
  segundosDeVideoJugador,
  videoGuardado,
} from "@/lib/abp/cache-exportar";
import { ruedaMaterial, type MaterialJugada } from "@/lib/abp/rodaje-jugada";
import { duracionResponsabilidad, videoResponsabilidad } from "@/lib/abp/video-responsabilidad";
import { cargaEscudos, cometidosDe, nombreArchivo, nombreCorto, preparaJugador } from "@/lib/abp/pizarra-jugador";
import { faltanFotos, fotosDeHojas } from "@/lib/abp/fotos-tablero";
import { creaPptx } from "@/lib/export/pptx";
import { apodo, descarga, pdfDeLienzos, pintado } from "@/lib/export/lienzos";
import { creaZip, type Bytes, type EntradaZip } from "@/lib/export/zip";
import { puedeHacerVideo } from "@/lib/tactics/lamina";

type Montaje = { que: "general"; indices: number[] } | { que: "video"; indice: number; tiempo: number } | null;

type Estado = "pendiente" | "marcha" | "hecho" | "fallo";

type Tarea = { id: string; nombre: string; estado: Estado; detalle?: string };

const nada = () => () => undefined;

const bytes = async (blob: Blob) => new Uint8Array(await blob.arrayBuffer()) as Bytes;

class Cancelado extends Error {}

/** Sube cuando cambia el vídeo de cada jugador: lo grabado antes no vale. */
const VIDEO_JUGADOR = "responsabilidad-1";

/**
 * Lo intenta y, si falla, una vez más: la segunda con el codificador del
 * navegador y no el de la tarjeta gráfica (en Windows hay tarjetas que dicen
 * que sí y luego no codifican). Cancelar no se reintenta.
 */
async function otraVez<T>(hazlo: (software: boolean) => Promise<T>, limpia: () => Promise<void>): Promise<T> {
  try {
    return await hazlo(false);
  } catch (error) {
    if (error instanceof Cancelado) throw error;

    console.warn("[abp-pizarra] exportar · segundo intento", error);
    await limpia();

    return hazlo(true);
  }
}

/** Por qué no ha salido algo, en una frase que se entienda en el panel. */
function motivo(error: unknown) {
  const texto = error instanceof Error ? `${error.name} ${error.message}` : String(error ?? "");

  if (/memory|memoria|allocation|out of/i.test(texto)) return "el navegador se ha quedado sin memoria: cierra otras pestañas y repite";
  if (/encod|codec|VideoEncoder|EncodingError|OperationError/i.test(texto)) return "el codificador de vídeo del navegador ha fallado dos veces";
  if (/vac[ií]a|captura|fotograma/i.test(texto)) return "no se ha podido fotografiar la diapositiva";

  const mensaje = error instanceof Error ? error.message.trim() : "";

  return mensaje ? mensaje.slice(0, 120) : "el navegador ha cortado el trabajo";
}

/**
 * Un cerrojo web mientras se exporta: Chrome no congela una pestaña escondida
 * que tiene uno (01/11/2026). Devuelve cómo soltarlo.
 */
function cerrojoWeb() {
  let suelta: (() => void) | null = null;
  let soltado = false;

  try {
    void navigator.locks
      ?.request("abp-exportar", () =>
        new Promise<void>((listo) => {
          suelta = listo;

          if (soltado) listo();
        }),
      )
      .catch(() => undefined);
  } catch {
    /* Sin cerrojos (navegador antiguo): se exporta igual. */
  }

  return () => {
    soltado = true;
    (suelta as (() => void) | null)?.();
  };
}

/*
| El PDF general y el PowerPoint ya montados, por las fotos que llevan y la
| cabecera: pedir «Todo» después de «Solo documentos» no los vuelve a armar.
*/
const documentos = new Map<string, { pdf: Bytes; pptx: Bytes }>();

/** Lo que pesa cada cosa, para orientar en el menú (MB). */
const MB_POR_DIAPOSITIVA = 0.45;
const MB_POR_PDF_JUGADOR = 0.6;

/** Espera a que el trabajo de segundo plano tenga los PDF de todos (o se pare), con tope. */
function esperaPdfs(huella: string, ids: string[], cancelado: () => boolean, topeMs = 600_000): Promise<EstadoPdfs> {
  return new Promise((listo) => {
    const mira = () => {
      const e = trabajoPdfs.foto();
      const todos = e.huella === huella && ids.every((id) => e.hechos[id]);
      const parado = e.huella === huella && !e.encargo;

      if (todos || parado || cancelado()) {
        quita();
        clearTimeout(plazo);
        clearInterval(vigia);
        listo(e);
      }
    };
    const quita = trabajoPdfs.suscribe(mira);
    const vigia = setInterval(mira, 500);
    const plazo = setTimeout(() => {
      quita();
      clearInterval(vigia);
      listo(trabajoPdfs.foto());
    }, topeMs);

    mira();
  });
}

type Opcion = "todo" | "documentos" | "videos" | "videosJugador" | "pptx" | "pdf";

export function ExportaTodo({
  tablero,
  players,
  temporada,
  rival,
  jornada,
  escudoRival,
  trabajo,
}: {
  /** Montado por el trabajo de segundo plano del layout: arranca solo y no enseña botones. */
  trabajo?: { id: string; piezas: PiezasExportar };
  tablero: TableroPizarra;
  players: Map<string, Player>;
  temporada: string;
  rival: string;
  jornada?: string;
  escudoRival?: string;
}) {
  const [montaje, setMontaje] = useState<Montaje>(null);
  const [tareas, setTareas] = useState<Tarea[] | null>(null);
  const [enMarcha, setEnMarcha] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const [porFases, setPorFases] = useState(false);
  /* Lo que tardará y pesará cada opción, calculado al abrir el menú (lee lo ya hecho). */
  const [cuentas, setCuentas] = useState<Record<Opcion, { segundos: number; mb: number }> | null>(null);
  const raizRef = useRef<HTMLDivElement>(null);
  const corriendo = useRef(false);
  const cancelar = useRef(false);
  const sabeVideo = useSyncExternalStore(nada, puedeHacerVideo, () => false);
  const encargado = useSyncExternalStore(
    trabajoExportar.suscribe,
    () => encargoEnMarcha(trabajoExportar.foto(), "todo") ?? encargoEnMarcha(trabajoExportar.foto(), "pizarra"),
    () => undefined,
  );
  const rotuloEncargo = useSyncExternalStore(
    trabajoExportar.suscribe,
    () => (encargado ? trabajoExportar.foto().rotulos[encargado.id] : undefined),
    () => undefined,
  );
  const empezado = useRef(false);

  const slides = tablero.slides;
  const conJugada = slides.map((slide, i) => ({ slide, i })).filter(({ slide }) => fasesDe(slide.trazos) > 0);
  const conFases = slides.some((slide) => fasesDe(slide.trazos) > 1);
  const contexto = { players, temporada, rival };
  const titulos = slides.map((_, i) => tituloVisible(slides, i));

  /* La misma que usa «PDF por jugador»: así los dos comparten lo ya hecho. */
  const huella = `${tablero.partidoId}|${tablero.actualizado ?? ""}|${rival}`;

  /** El vídeo de un jugador se llama como su PDF: van juntos en la carpeta. */
  const nombreVideoJugador = (playerId: string) => {
    const player = players.get(playerId);

    return `ABP-${[player?.dorsal, nombreArchivo(nombreCorto(player) || "jugador"), jornada, nombreArchivo(rival)]
      .filter((parte) => parte != null && parte !== "")
      .join("-")}.mp4`;
  };

  const marca = (id: string, estado: Estado, detalle?: string) =>
    setTareas((ahora) => ahora?.map((t) => (t.id === id ? { ...t, estado, detalle } : t)) ?? ahora);

  const sigue = () => {
    if (cancelar.current) throw new Cancelado();
  };

  /*
    El tablero de fuera de pantalla, montado EN EL ACTO (`flushSync`): con la
    pestaña escondida React no espera a ningún fotograma y `pintado` ya no
    usa `requestAnimationFrame` (01/11/2026, «Todo» sin vídeos).
  */
  const monta = async (siguiente: Montaje) => {
    flushSync(() => setMontaje(siguiente));
    await pintado();
    await pintado();
  };

  /** El material fotografiado de una diapositiva (de la memoria si no ha cambiado), con un segundo intento. */
  const materialDe = async (i: number, alAvance: (f: number) => void) => {
    const slide = slides[i];
    const clave = claveMaterial(slide, titulos[i], contexto);
    const guardado = materialGuardado(clave);

    if (guardado) return { material: guardado, deMemoria: true };

    const rueda = async () => {
      await monta({ que: "video", indice: i, tiempo: 0 });

      const nodo = raizRef.current?.querySelector<HTMLElement>("[data-abp-tablero]");

      if (!nodo) throw new Error("La diapositiva no se ha montado");

      return ruedaMaterial({
        nodo,
        pon: async (valor) => {
          sigue();
          flushSync(() => setMontaje({ que: "video", indice: i, tiempo: valor }));
          await pintado();
        },
        nFases: fasesDe(slide.trazos),
        alAvance,
      });
    };

    const material = await otraVez(rueda, () => monta(null));

    guardaMaterial(clave, material);

    return { material, deMemoria: false };
  };

  const exporta = async (piezas: PiezasExportar) => {
    if (corriendo.current) return;

    corriendo.current = true;
    cancelar.current = false;
    setEnMarcha(true);

    const inicio = performance.now();
    const ids = piezas.documentos ? jugadoresDelTablero(tablero).map((fila) => fila.playerId) : [];
    const videos = piezas.videos && sabeVideo ? conJugada : [];
    /* Los vídeos de cada jugador: los que salen en alguna diapositiva con jugada. */
    const conVideoJugador =
      piezas.videosJugador && sabeVideo
        ? jugadoresDelTablero(tablero)
            .map((fila) => ({ playerId: fila.playerId, acciones: cometidosDe(tablero, fila.playerId, players).filter((a) => fasesDe(slides[a.indice]?.trazos) > 0) }))
            .filter((j) => j.acciones.length > 0)
        : [];
    /* Las diapositivas que hay que fotografiar: las de los vídeos y las de los jugadores. */
    const aRodar = [...new Set([...videos.map(({ i }) => i), ...conVideoJugador.flatMap((j) => j.acciones.map((a) => a.indice))])].sort((a, b) => a - b);
    const nombreJugador = (playerId: string) => nombreCorto(players.get(playerId)) || "Jugador";

    setTareas([
      ...(piezas.documentos ? [{ id: "general", nombre: "PDF general y PowerPoint", estado: "pendiente" as Estado }] : []),
      ...(ids.length ? [{ id: "jugadores", nombre: `PDF de cada jugador (${ids.length})`, estado: "pendiente" as Estado }] : []),
      ...aRodar.map((i) => ({
        id: `v${i}`,
        nombre: `${videos.some((v) => v.i === i) ? "Vídeo" : "Jugada"} · ${titulos[i]}`,
        estado: "pendiente" as Estado,
      })),
      ...conVideoJugador.map((j) => ({ id: `j${j.playerId}`, nombre: `Vídeo de ${nombreJugador(j.playerId)}`, estado: "pendiente" as Estado })),
    ]);

    const entradas: EntradaZip[] = [];
    const faltan: string[] = [];
    const base = `pizarra-abp-${apodo(rival, "pizarra")}${jornada ? `-${apodo(jornada)}` : ""}`;
    let deMemoria = 0;
    /* Sólo vídeos (de las diapositivas o de los jugadores): sin carpetas. */
    const sinCarpetas = !piezas.documentos && (!piezas.videos || !piezas.videosJugador);

    try {
      /* 1 · PDF general y PowerPoint, de las mismas fotos (y sólo las que falten). */
      if (piezas.documentos) {
        marca("general", "marcha");

        try {
          const hojas = hojasDe(slides, false, contexto);
          const claves = hojas.map((hoja) => hoja.clave);
          const cabecera = [rival || "RMCF Castilla", jornada, new Date().toLocaleDateString("es-ES")].filter(Boolean).join(" · ");
          const claveDocs = resumen(JSON.stringify([claves, titulos, cabecera, "indice-1"]));
          let docs = documentos.get(claveDocs);

          if (docs) deMemoria += 1;
          else {
            const montadas = faltanFotos(claves);
            const indices = montadas.map((clave) => claves.indexOf(clave));

            if (indices.length) await monta({ que: "general", indices });

            const imagenes = await fotosDeHojas({
              raiz: raizRef.current,
              claves,
              montadas,
              alPaso: (n) => marca("general", "marcha", `${n} de ${montadas.length}`),
            });

            await monta(null);

            const doc = await pdfDeLienzos(imagenes, {
              ancho: TABLERO_W,
              alto: TABLERO_H,
              orientacion: "landscape",
              pie: (indice, total) => ({
                izquierda: `${indice + 1}. ${titulos[indice] ?? ""}`.toUpperCase(),
                centro: cabecera,
                derecha: `${indice + 1} / ${total}`,
              }),
              /* La primera página, el índice: cada diapositiva enlazada a la suya (01/11/2026). */
              indice: { titulo: "Balón parado", subtitulo: cabecera, entradas: titulos },
            });
            const pptx = creaPptx(
              imagenes.map((imagen, indice) => ({ titulo: titulos[indice] ?? `Diapositiva ${indice + 1}`, imagen })),
              { titulo: `Balón parado · ${rival || "RMCF Castilla"}`, autor: "RMCF Castilla" },
            );

            docs = { pdf: await bytes(doc.output("blob")), pptx: await bytes(pptx) };
            documentos.set(claveDocs, docs);

            /* Sólo los de la última pizarra: cada juego pesa unos megas. */
            while (documentos.size > 3) documentos.delete(documentos.keys().next().value as string);
          }

          entradas.push({ nombre: `General/${base}.pdf`, datos: docs.pdf }, { nombre: `General/${base}.pptx`, datos: docs.pptx });
          marca("general", "hecho", `${slides.length} diapositivas`);
        } catch (error) {
          if (error instanceof Cancelado) throw error;

          console.error("[abp-pizarra] exportar · general", error);
          faltan.push(`el PDF general (${motivo(error)})`);
          marca("general", "fallo", motivo(error));
          await monta(null);
        }
      }
      sigue();

      /* 2 · Los PDF por jugador (el trabajo de segundo plano de «PDF por jugador», que guarda lo ya hecho). */
      if (ids.length) {
        marca("jugadores", "marcha");
        trabajoPdfs.encarga({
          huella,
          tablero,
          players,
          temporada,
          rival,
          jornada,
          escudoRival,
          ids,
          vuelta: `${window.location.pathname}${window.location.search}`,
        });

        const quita = trabajoPdfs.suscribe(() => {
          const e = trabajoPdfs.foto();

          if (e.huella === huella) marca("jugadores", "marcha", `${ids.filter((id) => e.hechos[id]).length} de ${ids.length}`);
        });
        const e = await esperaPdfs(huella, ids, () => cancelar.current);

        quita();
        sigue();

        const hechos = e.huella === huella ? ids.flatMap((id) => (e.hechos[id] ? [e.hechos[id]] : [])) : [];

        for (const h of hechos) entradas.push({ nombre: `Jugadores/${h.nombre}`, datos: await bytes(h.blob) });

        if (hechos.length < ids.length) {
          faltan.push(`${ids.length - hechos.length} PDF de jugador`);
          marca("jugadores", hechos.length ? "hecho" : "fallo", `${hechos.length} de ${ids.length}`);
        } else marca("jugadores", "hecho", `${ids.length} PDF`);
      }

      /*
        3 · Cada diapositiva con jugada: se fotografía una vez (el material) y
        de ahí salen su vídeo y los de cada jugador. Lo que no ha cambiado sale
        de la memoria. Si algo falla, se intenta otra vez (la segunda con el
        codificador del navegador) y, si vuelve a fallar, se dice por qué.
      */
      const materiales = new Map<number, MaterialJugada>();

      for (const [n, i] of aRodar.entries()) {
        sigue();

        const slide = slides[i];
        const id = `v${i}`;
        const titulo = titulos[i];
        const conVideo = videos.some((v) => v.i === i);

        marca(id, "marcha", "0 %");

        try {
          const clave = claveDelVideo(slide, titulo, "sala", contexto);
          const yaHecho = conVideo ? videoGuardado(clave) : undefined;
          const avance = (f: number) => marca(id, "marcha", `${Math.round(f * 100)} %`);

          /* El vídeo ya hecho no necesita material, salvo que lo pidan los jugadores. */
          const falta = !yaHecho || conVideoJugador.some((j) => j.acciones.some((a) => a.indice === i));
          const { material, deMemoria: materialDeMemoria } = falta
            ? await materialDe(i, (f) => avance(conVideo ? f * 0.75 : f))
            : { material: null, deMemoria: true };

          if (material) materiales.set(i, material);

          if (conVideo) {
            const hecho = yaHecho
              ? { ...yaHecho, deMemoria: true }
              : await videoDeLaJugada(clave, async () => {
                  const listo = await otraVez(
                    (software) =>
                      grabaJugada({
                        nodo: document.body,
                        pon: async () => undefined,
                        nFases: fasesDe(slide.trazos),
                        destino: "sala",
                        titulo,
                        textos: textosDelVideo(slide),
                        material,
                        software,
                        alAvance: (f) => avance(0.75 + f * 0.25),
                      }),
                    async () => undefined,
                  );

                  return { fichero: listo.fichero, poster: listo.poster, segundos: listo.segundos };
                });
            const nombre = `${String(n + 1).padStart(2, "0")} ${nombreDelVideo(titulo, jornada)}`;
            const carpeta = sinCarpetas ? "" : "Videos/";

            if (hecho.deMemoria) deMemoria += 1;

            entradas.push({ nombre: `${carpeta}${nombre}.mp4`, datos: await bytes(hecho.fichero) });
            if (hecho.poster) entradas.push({ nombre: `${carpeta}${nombre} poster.jpg`, datos: await bytes(hecho.poster) });
            marca(id, "hecho", `${(hecho.fichero.size / 1_000_000).toFixed(1).replace(".", ",")} MB${hecho.deMemoria ? " · sin cambios" : ""}`);
          } else {
            if (materialDeMemoria) deMemoria += 1;

            marca(id, "hecho", materialDeMemoria ? "sin cambios" : "lista");
          }
        } catch (error) {
          if (error instanceof Cancelado) throw error;

          console.error("[abp-pizarra] exportar · vídeo", titulo, error);
          faltan.push(`el vídeo de «${titulo}» (${motivo(error)})`);
          marca(id, "fallo", motivo(error));
          await monta(null);
        }
      }

      await monta(null);

      /* 4 · El vídeo de la responsabilidad de cada jugador, del mismo material (no se fotografía nada más). */
      if (conVideoJugador.length) {
        const escudos = await cargaEscudos(escudoRival);

        for (const { playerId, acciones } of conVideoJugador) {
          sigue();

          const id = `j${playerId}`;
          const conMaterial = acciones.flatMap((accion) => {
            const material = materiales.get(accion.indice);

            return material ? [{ accion, material }] : [];
          });

          if (conMaterial.length === 0) {
            faltan.push(`el vídeo de ${nombreJugador(playerId)} (su jugada no ha salido)`);
            marca(id, "fallo", "su jugada no ha salido");
            continue;
          }

          marca(id, "marcha", "0 %");

          try {
            const clave = `jugador|${playerId}|${resumen(JSON.stringify([conMaterial.map((c) => claveMaterial(slides[c.accion.indice], titulos[c.accion.indice], contexto)), conMaterial.map((c) => c.accion), players.get(playerId) ?? null, rival, jornada, VIDEO_JUGADOR]))}`;
            const yaHecho = videoGuardado(clave);
            let fichero: Blob;

            if (yaHecho) {
              fichero = yaHecho.fichero;
              deMemoria += 1;
            } else {
              const { cx, retrato } = await preparaJugador({ player: players.get(playerId), rival, jornada, escudos });

              fichero = await otraVez(
                (software) =>
                  videoResponsabilidad({
                    cx,
                    retrato,
                    playerId,
                    acciones: conMaterial,
                    software,
                    alAvance: (f) => {
                      sigue();
                      marca(id, "marcha", `${Math.round(f * 100)} %`);
                    },
                  }),
                async () => undefined,
              );
              guardaVideo(clave, { fichero, poster: null, segundos: 0 });
            }

            entradas.push({ nombre: `${sinCarpetas ? "" : "Jugadores/"}${nombreVideoJugador(playerId)}`, datos: await bytes(fichero) });
            marca(id, "hecho", `${(fichero.size / 1_000_000).toFixed(1).replace(".", ",")} MB${yaHecho ? " · sin cambios" : ""}`);
          } catch (error) {
            if (error instanceof Cancelado) throw error;

            console.error("[abp-pizarra] exportar · vídeo del jugador", playerId, error);
            faltan.push(`el vídeo de ${nombreJugador(playerId)} (${motivo(error)})`);
            marca(id, "fallo", motivo(error));
          }
        }
      }

      if ((piezas.videos || piezas.videosJugador) && conJugada.length && !sabeVideo) faltan.push("los vídeos (este navegador no sabe montarlos: usa Chrome o Edge)");

      if (entradas.length === 0) throw new Error("No ha salido nada");

      const opcion = !piezas.documentos ? (piezas.videos && piezas.videosJugador ? "videos" : piezas.videos ? "videos" : "videos-jugadores") : piezas.videos || piezas.videosJugador ? "todo" : "documentos";

      descarga(creaZip(entradas), `${base}-${opcion}.zip`);

      const pdfs = entradas.filter((e) => e.nombre.endsWith(".pdf")).length;
      const mp4 = entradas.filter((e) => e.nombre.endsWith(".mp4")).length;
      const segundos = (performance.now() - inicio) / 1000;

      /* Lo que ha costado, para comparar antes y después desde la consola. */
      performance.mark("abp-exportar", { detail: { opcion, segundos, deMemoria, mp4, faltan } });

      toast.success(
        !piezas.documentos
          ? `Listo: ${mp4} ${mp4 === 1 ? "vídeo" : "vídeos"} en un .zip`
          : mp4
            ? `Listo: ${pdfs} PDF, el PowerPoint y ${mp4} ${mp4 === 1 ? "vídeo" : "vídeos"} en un .zip`
            : `Listo: ${pdfs} PDF y el PowerPoint en un .zip`,
        {
          description: [
            `En ${duracionLegible(segundos)}.`,
            deMemoria ? `${deMemoria} ${deMemoria === 1 ? "pieza no había cambiado y ha salido" : "piezas no habían cambiado y han salido"} al momento.` : "",
            faltan.length ? `No han salido: ${faltan.join(", ")}.` : "",
          ]
            .filter(Boolean)
            .join(" "),
          duration: faltan.length ? 30_000 : 9_000,
        },
      );
      if (!faltan.length) setTareas(null);
    } catch (error) {
      if (error instanceof Cancelado) {
        toast("Exportación cancelada");
        setTareas(null);
      } else {
        console.error("[abp-pizarra] exportar", error);
        toast.error("No se ha podido preparar el paquete", { description: motivo(error) });
      }
    } finally {
      corriendo.current = false;
      setEnMarcha(false);
      setMontaje(null);
    }
  };

  /* Si se cierra la pantalla a mitad, que no siga trabajando ni deje el cerrojo puesto. */
  useEffect(
    () => () => {
      if (trabajo) return;

      cancelar.current = true;
      corriendo.current = false;
    },
    [trabajo],
  );

  /* En segundo plano: arranca solo una vez y se retira cuando ya no hay nada que enseñar. */
  useEffect(() => {
    if (!trabajo || arrancados.has(trabajo.id)) return;

    arrancados.add(trabajo.id);
    /*
      Fuera del efecto: el primer paso ya cambia el estado. Sin limpieza: el cerrojo de arriba impide repetirlo.
      «empezado» se marca aquí y no en el efecto: si no, el de abajo veía «parado y sin tareas» en la misma
      pasada y retiraba el encargo antes de empezar (31/10/2026: «Solo vídeos» fallaba entero).
    */
    window.setTimeout(() => {
      empezado.current = true;

      /* Con un cerrojo web: Chrome no congela una pestaña escondida que lo tiene. */
      const suelta = cerrojoWeb();

      void exporta(trabajo.piezas).finally(suelta);
    }, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trabajo]);

  useEffect(() => {
    if (trabajo && empezado.current && !enMarcha && !tareas) trabajoExportar.termina(trabajo.id);
  }, [trabajo, enMarcha, tareas]);

  const comun = {
    soloVer: true as const,
    players,
    temporada,
    rival,
    seleccion: null,
    onMover: () => undefined,
    onQuitar: () => undefined,
    onPulsarPuesto: () => undefined,
    onSeleccionar: () => undefined,
  };

  const hechas = tareas?.filter((t) => t.estado === "hecho" || t.estado === "fallo").length ?? 0;

  useEffect(() => {
    if (trabajo && tareas) trabajoExportar.rotula(trabajo.id, `${hechas} de ${tareas.length}`);
  }, [trabajo, hechas, tareas]);

  /* ---------------------------------------------------------------- */
  /*  EN LA PIZARRA: EL MENÚ                                           */
  /* ---------------------------------------------------------------- */

  if (!trabajo) {
    const datos = { tablero, players, temporada, rival, jornada, escudoRival };

    /* Lo que falta por hacer de cada pieza, mirando lo ya guardado. */
    const calcula = (fases: boolean) => {
      const fotosFaltan = faltanFotos(hojasDe(slides, false, contexto).map((h) => h.clave)).length;
      const hojasFases = hojasDe(slides, fases, contexto);
      const fotosFasesFaltan = faltanFotos(hojasFases.map((h) => h.clave)).length;
      const pdfs = trabajoPdfs.foto();
      const ids = jugadoresDelTablero(tablero).map((fila) => fila.playerId);
      const pdfsFaltan = ids.filter((id) => !(pdfs.huella === huella && pdfs.hechos[id])).length;
      const videos = sabeVideo ? conJugada : [];
      const segundosVideos = videos
        .filter(({ slide, i }) => !hayVideo(claveDelVideo(slide, titulos[i], "sala", contexto)))
        .reduce((suma, { slide }) => suma + segundosDeVideo(fasesDe(slide.trazos)), 0);
      const mbVideos = videos.reduce((suma, { slide }) => suma + pesoMb("sala", duracionVideo(fasesDe(slide.trazos))), 0);
      /* Los de cada jugador: lo que se ve de cada uno (el material sale de las diapositivas). */
      const duraciones = videos.length
        ? ids.map((id) => duracionResponsabilidad(cometidosDe(tablero, id, players).filter((a) => fasesDe(slides[a.indice]?.trazos) > 0).map((a) => ({ nFases: fasesDe(slides[a.indice].trazos) }))))
        : [];
      const conVideo = duraciones.filter((s, k) => cometidosDe(tablero, ids[k], players).some((a) => fasesDe(slides[a.indice]?.trazos) > 0) && s > 0);
      const deJugadores = {
        segundos: conVideo.reduce((suma, s) => suma + segundosDeVideoJugador(s), 0),
        /* A caudal variable salen a unos 8 Mb/s de los 12 pedidos (medido el 01/11/2026). */
        mb: conVideo.reduce((suma, s) => suma + pesoMb("sala", s) * 0.7, 0),
      };
      const docs = { segundos: fotosFaltan * SEGUNDOS_POR_FOTO + 2, mb: slides.length * MB_POR_DIAPOSITIVA * 2 };
      const jugadores = { segundos: pdfsFaltan * SEGUNDOS_POR_PDF_JUGADOR, mb: ids.length * MB_POR_PDF_JUGADOR };
      const fotografiar = videos
        .filter(({ slide, i }) => !materialGuardado(claveMaterial(slide, titulos[i], contexto)))
        .reduce((suma, { slide }) => suma + segundosDeVideo(fasesDe(slide.trazos)), 0);

      return {
        todo: {
          segundos: docs.segundos + jugadores.segundos + segundosVideos + deJugadores.segundos,
          mb: docs.mb + jugadores.mb + mbVideos + deJugadores.mb,
        },
        documentos: { segundos: docs.segundos + jugadores.segundos, mb: docs.mb + jugadores.mb },
        videos: { segundos: segundosVideos, mb: mbVideos },
        videosJugador: { segundos: fotografiar + deJugadores.segundos, mb: deJugadores.mb },
        pptx: { segundos: fotosFaltan * SEGUNDOS_POR_FOTO + 1, mb: slides.length * MB_POR_DIAPOSITIVA },
        pdf: { segundos: fotosFasesFaltan * SEGUNDOS_POR_FOTO + 1, mb: hojasFases.length * MB_POR_DIAPOSITIVA },
      };
    };

    const elige = (opcion: Opcion) => {
      setAbierto(false);

      if (opcion === "pptx" || opcion === "pdf") {
        trabajoExportar.encarga({ tipo: "pizarra", formato: opcion, porFases: opcion === "pdf" && porFases, datos: { slides, players, temporada, rival, jornada } });
      } else {
        trabajoExportar.encarga({
          tipo: "todo",
          piezas: {
            documentos: opcion === "todo" || opcion === "documentos",
            videos: opcion === "todo" || opcion === "videos",
            videosJugador: opcion === "todo" || opcion === "videosJugador",
          },
          datos,
        });
      }
    };

    const nJugadores = jugadoresDelTablero(tablero).length;
    const nVideos = sabeVideo ? conJugada.length : 0;
    const nVideosJugador = sabeVideo
      ? jugadoresDelTablero(tablero).filter((fila) => cometidosDe(tablero, fila.playerId, players).some((a) => fasesDe(slides[a.indice]?.trazos) > 0)).length
      : 0;
    const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

    const opciones: { clave: Opcion; icono: typeof PackageOpen; titulo: string; lleva: string; puede: boolean; aviso?: string }[] = [
      {
        clave: "todo",
        icono: PackageOpen,
        titulo: "Todo en un .zip",
        lleva: [
          "PDF general",
          "PowerPoint",
          nJugadores ? plural(nJugadores, "PDF de jugador", "PDF de jugador") : "",
          nVideos ? plural(nVideos, "vídeo de jugada", "vídeos de jugada") : "",
          nVideosJugador ? plural(nVideosJugador, "vídeo de jugador", "vídeos de jugador") : "",
        ]
          .filter(Boolean)
          .join(" · "),
        puede: true,
        aviso: !sabeVideo && conJugada.length ? "Este navegador no monta vídeo: saldrán los documentos. Para los vídeos, Chrome o Edge." : undefined,
      },
      {
        clave: "documentos",
        icono: FileStack,
        titulo: "Solo documentos (.zip)",
        lleva: ["PDF general", "PowerPoint", nJugadores ? plural(nJugadores, "PDF de jugador", "PDF de jugador") : ""].filter(Boolean).join(" · "),
        puede: true,
      },
      {
        clave: "videos",
        icono: Clapperboard,
        titulo: "Solo vídeos (.zip)",
        lleva: nVideos
          ? `${plural(nVideos, "MP4", "MP4")} 1920 × 1080 para la tele, con su póster, uno por diapositiva con jugada`
          : !sabeVideo
            ? "Este navegador no monta vídeo: Chrome o Edge"
            : "Ninguna diapositiva tiene jugada dibujada",
        puede: nVideos > 0,
      },
      {
        clave: "videosJugador",
        icono: UserRound,
        titulo: "Vídeos por jugador (.zip)",
        lleva: nVideosJugador
          ? `${plural(nVideosJugador, "MP4", "MP4")} 1920 × 1080: su responsabilidad en cada jugada, él resaltado y su tarea`
          : !sabeVideo
            ? "Este navegador no monta vídeo: Chrome o Edge"
            : "Nadie sale en una diapositiva con jugada dibujada",
        puede: nVideosJugador > 0,
      },
      {
        clave: "pptx",
        icono: MonitorPlay,
        titulo: "PowerPoint para proyectar",
        lleva: `${plural(slides.length, "diapositiva", "diapositivas")} a 1920 × 1080, se abre sin la app`,
        puede: true,
      },
      {
        clave: "pdf",
        icono: Printer,
        titulo: "PDF para imprimir",
        lleva: `A4 apaisado, ${porFases ? "una hoja por fase" : "una hoja por diapositiva"}`,
        puede: true,
      },
    ];

    return (
      <div className="relative">
        <Button
          icon={encargado ? Loader2 : PackageOpen}
          tone="primary"
          onClick={() => {
            if (!abierto) setCuentas(calcula(porFases));
            setAbierto((actual) => !actual);
          }}
          disabled={Boolean(encargado) || slides.length === 0}
          title="Todas las salidas de la pizarra: PDF, PowerPoint, PDF de cada jugador y vídeos. Siguen aunque cambies de pantalla"
        >
          <span className="inline-flex items-center gap-1">
            {encargado ? `Exportando${rotuloEncargo ? ` · ${rotuloEncargo}` : "…"}` : "Exportar"}
            {!encargado && <ChevronDown size={14} />}
          </span>
        </Button>

        {abierto && !encargado && (
          <>
            <button type="button" aria-label="Cerrar el menú" className="fixed inset-0 z-30 cursor-default" onClick={() => setAbierto(false)} />
            <div
              role="menu"
              className="absolute right-0 top-full z-40 mt-1.5 w-[min(380px,calc(100vw-32px))] rounded-xl border border-white/10 bg-[#11161C] p-1.5 shadow-2xl max-sm:left-0 max-sm:right-auto"
            >
              {opciones.map(({ clave, icono: Icono, titulo, lleva, puede, aviso }) => {
                const c = cuentas?.[clave];
                const alMomento = c ? c.segundos <= 3 : false;

                return (
                  <div key={clave} className={clave === "pptx" ? "mt-1 border-t border-white/10 pt-1" : undefined}>
                    <button
                      type="button"
                      role="menuitem"
                      disabled={!puede}
                      onClick={() => elige(clave)}
                      className="flex w-full items-start gap-2.5 rounded-lg px-3 py-2 text-left transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      <Icono size={16} className="mt-0.5 shrink-0 text-[#C8A96B]" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-white">{titulo}</span>
                        <span className="block text-xs text-white/55">{lleva}</span>
                        {puede && c && (
                          <span className={`block text-[11px] tabular-nums ${alMomento ? "text-emerald-400" : "text-white/40"}`}>
                            {alMomento ? "Sin cambios: sale al momento" : `≈ ${duracionLegible(c.segundos)}`} · ≈ {pesoLegible(c.mb)}
                          </span>
                        )}
                        {aviso && <span className="block text-[11px] text-amber-300/80">{aviso}</span>}
                      </span>
                    </button>

                    {clave === "pdf" && conFases && (
                      <label className="ml-9 mb-1 inline-flex cursor-pointer items-center gap-2 px-3 text-xs text-white/65">
                        <input
                          type="checkbox"
                          checked={porFases}
                          onChange={(event) => {
                            setPorFases(event.target.checked);
                            setCuentas(calcula(event.target.checked));
                          }}
                          className="h-4 w-4 accent-[#C8A96B]"
                        />
                        Una hoja por fase
                      </label>
                    )}
                  </div>
                );
              })}

              <p className="border-t border-white/10 px-3 pb-1 pt-2 text-[11px] leading-snug text-white/40">
                Lo que no ha cambiado desde la última exportación sale al momento. Todo sigue aunque cambies de pantalla.
              </p>
            </div>
          </>
        )}
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /*  EN SEGUNDO PLANO: EL PANEL Y EL TABLERO DE FUERA DE PANTALLA     */
  /* ---------------------------------------------------------------- */

  return (
    <>
      {tareas && (
        <div
          role="status"
          data-export-hide
          className="siempre-oscuro fixed bottom-4 right-4 z-50 w-[min(360px,calc(100vw-32px))] rounded-xl border border-white/10 p-4 shadow-2xl"
          style={{ background: "#0F141B" }}
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-white">{enMarcha ? `Exportando · ${hechas} de ${tareas.length}` : "Exportación terminada"}</p>
            {enMarcha ? (
              <button
                type="button"
                onClick={() => {
                  cancelar.current = true;
                }}
                className="rounded-md border border-white/15 px-2 py-1 text-xs text-white/80 hover:bg-white/10"
              >
                Cancelar
              </button>
            ) : (
              <button type="button" aria-label="Cerrar" onClick={() => setTareas(null)} className="rounded-md p-1 text-white/70 hover:bg-white/10">
                <X size={16} />
              </button>
            )}
          </div>

          <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-[#C8A96B] transition-all" style={{ width: `${(hechas / Math.max(1, tareas.length)) * 100}%` }} />
          </div>

          <ul className="max-h-80 space-y-1.5 overflow-y-auto text-xs">
            {tareas.map((t) => (
              <li key={t.id} className="flex items-center gap-2">
                <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                  {t.estado === "hecho" && <Check size={14} className="text-emerald-400" />}
                  {t.estado === "marcha" && <Loader2 size={14} className="animate-spin text-[#C8A96B]" />}
                  {t.estado === "fallo" && <X size={14} className="text-red-400" />}
                  {t.estado === "pendiente" && <span className="h-1.5 w-1.5 rounded-full bg-white/30" />}
                </span>
                {t.estado === "fallo" ? (
                  /* Lo que ha fallado, con su motivo entero y en su renglón: no se corta. */
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-white/90">{t.nombre}</span>
                    {t.detalle && <span className="block leading-snug text-red-300">No ha salido: {t.detalle}</span>}
                  </span>
                ) : (
                  <>
                    <span className={`min-w-0 flex-1 truncate ${t.estado === "pendiente" ? "text-white/50" : "text-white/90"}`}>{t.nombre}</span>
                    {t.detalle && <span className="shrink-0 tabular-nums text-white/60">{t.detalle}</span>}
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {montaje && (
        <div
          ref={raizRef}
          aria-hidden
          data-export-hide
          className="pointer-events-none"
          style={{ position: "fixed", top: 0, left: -(TABLERO_W + 200), width: TABLERO_W, zIndex: -1 }}
        >
          {montaje.que === "general" ? (
            montaje.indices.map((i) => (
              <div key={slides[i].id} style={{ width: TABLERO_W }}>
                <TableroSlide slide={slides[i]} titulo={titulos[i]} {...comun} />
              </div>
            ))
          ) : (
            <TableroSlide slide={slides[montaje.indice]} titulo={titulos[montaje.indice]} tiempo={montaje.tiempo} {...comun} />
          )}
        </div>
      )}
    </>
  );
}
