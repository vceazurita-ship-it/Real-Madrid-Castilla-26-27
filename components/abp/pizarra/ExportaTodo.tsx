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
import { Check, ChevronDown, Clapperboard, FileStack, Loader2, MonitorPlay, PackageOpen, Printer, X } from "lucide-react";
import { toast } from "sonner";

import type { Player } from "@/types/player";
import { Button } from "@/components/abp/ui";
import { TableroSlide } from "@/components/abp/pizarra/TableroSlide";
import { hojasDe } from "@/components/abp/pizarra/ExportaPizarra";
import { claveDelVideo, duracionVideo, grabaJugada, nombreDelVideo, pesoMb, textosDelVideo, videoDeLaJugada } from "@/components/abp/pizarra/VideoJugada";
import { TABLERO_H, TABLERO_W, jugadoresDelTablero, tituloVisible, type TableroPizarra } from "@/lib/abp/pizarra";
import { fasesDe } from "@/lib/abp/trazos";
import { trabajoPdfs, type EstadoPdfs } from "@/lib/abp/trabajo-pdfs";
import { arrancados, enMarcha as encargoEnMarcha, trabajoExportar } from "@/lib/abp/trabajo-exportar";
import {
  SEGUNDOS_POR_FOTO,
  SEGUNDOS_POR_PDF_JUGADOR,
  duracionLegible,
  hayVideo,
  pesoLegible,
  resumen,
  segundosDeVideo,
} from "@/lib/abp/cache-exportar";
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

/*
| El PDF general y el PowerPoint ya montados, por las fotos que llevan y la
| cabecera: pedir «Todo» después de «Solo documentos» no los vuelve a armar.
*/
const documentos = new Map<string, { pdf: Bytes; pptx: Bytes }>();

/** Lo que pesa cada cosa, para orientar en el menú (MB). */
const MB_POR_DIAPOSITIVA = 0.45;
const MB_POR_PDF_JUGADOR = 0.6;

/** Espera a que el trabajo de segundo plano tenga los PDF de todos (o se pare), con tope. */
function esperaPdfs(huella: string, ids: string[], cancelado: () => boolean, topeMs = 240_000): Promise<EstadoPdfs> {
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

type Opcion = "todo" | "documentos" | "videos" | "pptx" | "pdf";

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
  trabajo?: { id: string; conVideos: boolean; soloVideos?: boolean };
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

  const marca = (id: string, estado: Estado, detalle?: string) =>
    setTareas((ahora) => ahora?.map((t) => (t.id === id ? { ...t, estado, detalle } : t)) ?? ahora);

  const sigue = () => {
    if (cancelar.current) throw new Cancelado();
  };

  /* El tablero de fuera de pantalla ya montado: un respiro y a pintar. */
  const monta = (siguiente: Montaje) =>
    new Promise<void>((listo) => {
      setMontaje(siguiente);
      setTimeout(() => void pintado().then(() => pintado()).then(() => listo()), 60);
    });

  const exporta = async (conVideos: boolean, soloVideos = false) => {
    if (corriendo.current) return;

    corriendo.current = true;
    cancelar.current = false;
    setEnMarcha(true);

    const inicio = performance.now();
    const ids = soloVideos ? [] : jugadoresDelTablero(tablero).map((fila) => fila.playerId);
    const videos = conVideos && sabeVideo ? conJugada : [];

    setTareas([
      ...(soloVideos ? [] : [{ id: "general", nombre: "PDF general y PowerPoint", estado: "pendiente" as Estado }]),
      ...(ids.length ? [{ id: "jugadores", nombre: `PDF de cada jugador (${ids.length})`, estado: "pendiente" as Estado }] : []),
      ...videos.map(({ i }) => ({ id: `v${i}`, nombre: `Vídeo · ${titulos[i]}`, estado: "pendiente" as Estado })),
    ]);

    const entradas: EntradaZip[] = [];
    const faltan: string[] = [];
    const base = `pizarra-abp-${apodo(rival, "pizarra")}${jornada ? `-${apodo(jornada)}` : ""}`;
    let deMemoria = 0;

    try {
      /* 1 · PDF general y PowerPoint, de las mismas fotos (y sólo las que falten). */
      if (!soloVideos) {
        marca("general", "marcha");

        try {
          const hojas = hojasDe(slides, false, contexto);
          const claves = hojas.map((hoja) => hoja.clave);
          const cabecera = [rival || "RMCF Castilla", jornada, new Date().toLocaleDateString("es-ES")].filter(Boolean).join(" · ");
          const claveDocs = resumen(JSON.stringify([claves, titulos, cabecera]));
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
          console.error("[abp-pizarra] exportar · general", error);
          faltan.push("el PDF general");
          marca("general", "fallo");
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

      /* 3 · Un vídeo por diapositiva con jugada (el que no ha cambiado sale de la memoria). */
      for (const [n, { slide, i }] of videos.entries()) {
        sigue();

        const id = `v${i}`;
        const titulo = titulos[i];

        marca(id, "marcha", "0 %");

        try {
          const hecho = await videoDeLaJugada(claveDelVideo(slide, titulo, "whatsapp", contexto), async () => {
            await monta({ que: "video", indice: i, tiempo: 0 });

            const nodo = raizRef.current?.querySelector<HTMLElement>("[data-abp-tablero]");

            if (!nodo) throw new Error("sin tablero");

            return grabaJugada({
              nodo,
              pon: async (valor) => {
                sigue();
                setMontaje({ que: "video", indice: i, tiempo: valor });
                await pintado();
              },
              nFases: fasesDe(slide.trazos),
              destino: "whatsapp",
              titulo,
              textos: textosDelVideo(slide),
              alAvance: (f) => marca(id, "marcha", `${Math.round(f * 100)} %`),
            });
          });
          const nombre = `${String(n + 1).padStart(2, "0")} ${nombreDelVideo(titulo, jornada)}`;
          const carpeta = soloVideos ? "" : "Videos/";

          if (hecho.deMemoria) deMemoria += 1;

          entradas.push({ nombre: `${carpeta}${nombre}.mp4`, datos: await bytes(hecho.fichero) });
          if (hecho.poster) entradas.push({ nombre: `${carpeta}${nombre} poster.jpg`, datos: await bytes(hecho.poster) });
          marca(id, "hecho", `${(hecho.fichero.size / 1_000_000).toFixed(1).replace(".", ",")} MB${hecho.deMemoria ? " · sin cambios" : ""}`);
        } catch (error) {
          if (error instanceof Cancelado) throw error;

          console.error("[abp-pizarra] exportar · vídeo", titulo, error);
          faltan.push(`el vídeo de «${titulo}»`);
          marca(id, "fallo");
        }
      }

      await monta(null);

      if (conVideos && conJugada.length && !sabeVideo) faltan.push("los vídeos (este navegador no sabe montarlos: usa Chrome o Edge)");

      if (entradas.length === 0) throw new Error("No ha salido nada");

      descarga(creaZip(entradas), `${base}-${soloVideos ? "videos" : conVideos ? "todo" : "documentos"}.zip`);

      const pdfs = entradas.filter((e) => e.nombre.endsWith(".pdf")).length;
      const mp4 = entradas.filter((e) => e.nombre.endsWith(".mp4")).length;
      const segundos = (performance.now() - inicio) / 1000;

      /* Lo que ha costado, para comparar antes y después desde la consola. */
      performance.mark("abp-exportar", { detail: { opcion: soloVideos ? "videos" : conVideos ? "todo" : "documentos", segundos, deMemoria } });

      toast.success(
        soloVideos
          ? `Listo: ${mp4} ${mp4 === 1 ? "vídeo" : "vídeos"} en un .zip`
          : conVideos
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
          duration: 9_000,
        },
      );
      if (!faltan.length) setTareas(null);
    } catch (error) {
      if (error instanceof Cancelado) {
        toast("Exportación cancelada");
        setTareas(null);
      } else {
        console.error("[abp-pizarra] exportar", error);
        toast.error("No se ha podido preparar el paquete");
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
      void exporta(trabajo.conVideos, trabajo.soloVideos);
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
        .filter(({ slide, i }) => !hayVideo(claveDelVideo(slide, titulos[i], "whatsapp", contexto)))
        .reduce((suma, { slide }) => suma + segundosDeVideo(fasesDe(slide.trazos)), 0);
      const mbVideos = videos.reduce((suma, { slide }) => suma + pesoMb("whatsapp", duracionVideo(fasesDe(slide.trazos))), 0);
      const docs = { segundos: fotosFaltan * SEGUNDOS_POR_FOTO + 2, mb: slides.length * MB_POR_DIAPOSITIVA * 2 };
      const jugadores = { segundos: pdfsFaltan * SEGUNDOS_POR_PDF_JUGADOR, mb: ids.length * MB_POR_PDF_JUGADOR };

      return {
        todo: { segundos: docs.segundos + jugadores.segundos + segundosVideos, mb: docs.mb + jugadores.mb + mbVideos },
        documentos: { segundos: docs.segundos + jugadores.segundos, mb: docs.mb + jugadores.mb },
        videos: { segundos: segundosVideos, mb: mbVideos },
        pptx: { segundos: fotosFaltan * SEGUNDOS_POR_FOTO + 1, mb: slides.length * MB_POR_DIAPOSITIVA },
        pdf: { segundos: fotosFasesFaltan * SEGUNDOS_POR_FOTO + 1, mb: hojasFases.length * MB_POR_DIAPOSITIVA },
      };
    };

    const elige = (opcion: Opcion) => {
      setAbierto(false);

      if (opcion === "pptx" || opcion === "pdf") {
        trabajoExportar.encarga({ tipo: "pizarra", formato: opcion, porFases: opcion === "pdf" && porFases, datos: { slides, players, temporada, rival, jornada } });
      } else {
        trabajoExportar.encarga({ tipo: "todo", conVideos: opcion !== "documentos", soloVideos: opcion === "videos", datos });
      }
    };

    const nJugadores = jugadoresDelTablero(tablero).length;
    const nVideos = sabeVideo ? conJugada.length : 0;
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
          nVideos ? plural(nVideos, "vídeo para WhatsApp", "vídeos para WhatsApp") : "",
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
          ? `${plural(nVideos, "MP4", "MP4")} 1280 × 720 con su póster, uno por diapositiva con jugada`
          : !sabeVideo
            ? "Este navegador no monta vídeo: Chrome o Edge"
            : "Ninguna diapositiva tiene jugada dibujada",
        puede: nVideos > 0,
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

          <ul className="max-h-64 space-y-1.5 overflow-y-auto text-xs">
            {tareas.map((t) => (
              <li key={t.id} className="flex items-center gap-2">
                <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                  {t.estado === "hecho" && <Check size={14} className="text-emerald-400" />}
                  {t.estado === "marcha" && <Loader2 size={14} className="animate-spin text-[#C8A96B]" />}
                  {t.estado === "fallo" && <X size={14} className="text-red-400" />}
                  {t.estado === "pendiente" && <span className="h-1.5 w-1.5 rounded-full bg-white/30" />}
                </span>
                <span className={`min-w-0 flex-1 truncate ${t.estado === "pendiente" ? "text-white/50" : "text-white/90"}`}>{t.nombre}</span>
                {t.detalle && <span className="shrink-0 tabular-nums text-white/60">{t.detalle}</span>}
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
