"use client";

/*
|--------------------------------------------------------------------------
| EXPORTAR TODO DE UNA VEZ (30/10/2026, rehecho el 31/10/2026)
|--------------------------------------------------------------------------
|
| Lo pidió el analista: «que pueda exportar de una vez el pdf de cada jugador,
| el general de ABP y los vídeos de cada slide». Y al probarlo: «tarda
| demasiado», «que en exportar todo vayan los vídeos» y «otra opción que sea
| exportar todos los documentos». Dos botones, un solo .zip:
|
|   · «Exportar todo»: documentos + un MP4 por diapositiva con jugada.
|   · «Solo documentos»: el PDF general, el PowerPoint y el PDF de cada
|     jugador, en segundos y sin vídeos.
|   · «Solo vídeos» (31/10/2026, «descargar todos los vídeos de las slides a
|     la vez»): un MP4 por diapositiva con jugada, sin documentos.
|
| Un panel cuenta cada paso (hecho, en marcha, pendiente, fallado), cuánto va
| de cada vídeo y deja cancelar. Lo que falle en un paso no tumba el resto: el
| .zip sale con lo que se haya podido hacer y lo dice.
*/

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  Check,
  Clapperboard,
  FileStack,
  Loader2,
  PackageOpen,
  X,
} from "lucide-react";
import { toast } from "sonner";

import type { Player } from "@/types/player";
import { Button } from "@/components/abp/ui";
import { TableroSlide } from "@/components/abp/pizarra/TableroSlide";
import {
  grabaJugada,
  nombreDelVideo,
} from "@/components/abp/pizarra/VideoJugada";
import {
  COLORES,
  TABLERO_H,
  TABLERO_W,
  jugadoresDelTablero,
  tituloVisible,
  type TableroPizarra,
} from "@/lib/abp/pizarra";
import { fasesDe } from "@/lib/abp/trazos";
import { trabajoPdfs, type EstadoPdfs } from "@/lib/abp/trabajo-pdfs";
import {
  arrancados,
  enMarcha as encargoEnMarcha,
  trabajoExportar,
} from "@/lib/abp/trabajo-exportar";
import { creaPptx } from "@/lib/export/pptx";
import {
  apodo,
  capturaLienzos,
  descarga,
  esperaFotos,
  pdfDeLienzos,
  pintado,
} from "@/lib/export/lienzos";
import { creaZip, type Bytes, type EntradaZip } from "@/lib/export/zip";
import { esperaFuentePortada } from "@/lib/rivals/portada-font";
import { puedeHacerVideo } from "@/lib/tactics/lamina";

type Montaje =
  { que: "general" } | { que: "video"; indice: number; tiempo: number } | null;

type Estado = "pendiente" | "marcha" | "hecho" | "fallo";

type Tarea = { id: string; nombre: string; estado: Estado; detalle?: string };

const nada = () => () => undefined;

const bytes = async (blob: Blob) =>
  new Uint8Array(await blob.arrayBuffer()) as Bytes;

class Cancelado extends Error {}

/** Espera a que el trabajo de segundo plano tenga los PDF de todos (o se pare), con tope. */
function esperaPdfs(
  huella: string,
  ids: string[],
  cancelado: () => boolean,
  topeMs = 240_000,
): Promise<EstadoPdfs> {
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
  const raizRef = useRef<HTMLDivElement>(null);
  const corriendo = useRef(false);
  const cancelar = useRef(false);
  const sabeVideo = useSyncExternalStore(nada, puedeHacerVideo, () => false);
  const encargado = useSyncExternalStore(
    trabajoExportar.suscribe,
    () => encargoEnMarcha(trabajoExportar.foto(), "todo"),
    () => undefined,
  );
  const rotuloEncargo = useSyncExternalStore(
    trabajoExportar.suscribe,
    () =>
      encargado ? trabajoExportar.foto().rotulos[encargado.id] : undefined,
    () => undefined,
  );
  const empezado = useRef(false);

  const slides = tablero.slides;
  const conJugada = slides
    .map((slide, i) => ({ slide, i }))
    .filter(({ slide }) => fasesDe(slide.trazos) > 0);

  /* Igual que «PDF por jugador»: si la pizarra cambia, lo hecho ya no vale. */
  const huella = `${tablero.partidoId}|${tablero.actualizado ?? ""}|${rival}`;

  const marca = (id: string, estado: Estado, detalle?: string) =>
    setTareas(
      (ahora) =>
        ahora?.map((t) => (t.id === id ? { ...t, estado, detalle } : t)) ??
        ahora,
    );

  const sigue = () => {
    if (cancelar.current) throw new Cancelado();
  };

  /* El tablero de fuera de pantalla ya montado: un respiro y a pintar. */
  const monta = (siguiente: Montaje) =>
    new Promise<void>((listo) => {
      setMontaje(siguiente);
      setTimeout(
        () =>
          void pintado()
            .then(() => pintado())
            .then(() => listo()),
        60,
      );
    });

  const exporta = async (conVideos: boolean, soloVideos = false) => {
    if (corriendo.current) return;

    corriendo.current = true;
    cancelar.current = false;
    setEnMarcha(true);

    const ids = soloVideos
      ? []
      : jugadoresDelTablero(tablero).map((fila) => fila.playerId);
    const videos = conVideos && sabeVideo ? conJugada : [];

    setTareas([
      ...(soloVideos
        ? []
        : [
            {
              id: "general",
              nombre: "PDF general y PowerPoint",
              estado: "pendiente" as Estado,
            },
          ]),
      ...(ids.length
        ? [
            {
              id: "jugadores",
              nombre: `PDF de cada jugador (${ids.length})`,
              estado: "pendiente" as Estado,
            },
          ]
        : []),
      ...videos.map(({ i }) => ({
        id: `v${i}`,
        nombre: `Vídeo · ${tituloVisible(slides, i)}`,
        estado: "pendiente" as Estado,
      })),
    ]);

    const entradas: EntradaZip[] = [];
    const faltan: string[] = [];
    const base = `pizarra-abp-${apodo(rival, "pizarra")}${jornada ? `-${apodo(jornada)}` : ""}`;
    const titulos = slides.map((_, i) => tituloVisible(slides, i));

    try {
      /* 1 · PDF general y PowerPoint, de la misma captura. */
      if (!soloVideos) {
        marca("general", "marcha");
        await monta({ que: "general" });

        try {
          const raiz = raizRef.current;

          if (!raiz) throw new Error("sin tablero");

          await esperaFuentePortada();
          await esperaFotos(raiz);

          const imagenes = await capturaLienzos(raiz, "[data-abp-tablero]", {
            ancho: TABLERO_W,
            alto: TABLERO_H,
            fondo: COLORES.tinta,
            alPaso: (n) =>
              marca("general", "marcha", `${n} de ${slides.length}`),
          });
          const cabecera = [
            rival || "RMCF Castilla",
            jornada,
            new Date().toLocaleDateString("es-ES"),
          ]
            .filter(Boolean)
            .join(" · ");
          const doc = await pdfDeLienzos(imagenes, {
            ancho: TABLERO_W,
            alto: TABLERO_H,
            orientacion: "landscape",
            pie: (indice, total) => ({
              izquierda:
                `${indice + 1}. ${titulos[indice] ?? ""}`.toUpperCase(),
              centro: cabecera,
              derecha: `${indice + 1} / ${total}`,
            }),
          });

          entradas.push({
            nombre: `General/${base}.pdf`,
            datos: await bytes(doc.output("blob")),
          });

          const pptx = creaPptx(
            imagenes.map((imagen, indice) => ({
              titulo: titulos[indice] ?? `Diapositiva ${indice + 1}`,
              imagen,
            })),
            {
              titulo: `Balón parado · ${rival || "RMCF Castilla"}`,
              autor: "RMCF Castilla",
            },
          );

          entradas.push({
            nombre: `General/${base}.pptx`,
            datos: await bytes(pptx),
          });
          marca("general", "hecho", `${imagenes.length} diapositivas`);
        } catch (error) {
          console.error("[abp-pizarra] exportar · general", error);
          faltan.push("el PDF general");
          marca("general", "fallo");
        }

        await monta(null);
      }
      sigue();

      /* 2 · Los PDF por jugador (el trabajo de segundo plano de «PDF por jugador»). */
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

          if (e.huella === huella)
            marca(
              "jugadores",
              "marcha",
              `${ids.filter((id) => e.hechos[id]).length} de ${ids.length}`,
            );
        });
        const e = await esperaPdfs(huella, ids, () => cancelar.current);

        quita();
        sigue();

        const hechos =
          e.huella === huella
            ? ids.flatMap((id) => (e.hechos[id] ? [e.hechos[id]] : []))
            : [];

        for (const h of hechos)
          entradas.push({
            nombre: `Jugadores/${h.nombre}`,
            datos: await bytes(h.blob),
          });

        if (hechos.length < ids.length) {
          faltan.push(`${ids.length - hechos.length} PDF de jugador`);
          marca(
            "jugadores",
            hechos.length ? "hecho" : "fallo",
            `${hechos.length} de ${ids.length}`,
          );
        } else marca("jugadores", "hecho", `${ids.length} PDF`);
      }

      /* 3 · Un vídeo por diapositiva con jugada. */
      for (const [n, { slide, i }] of videos.entries()) {
        sigue();

        const id = `v${i}`;
        const titulo = titulos[i];

        marca(id, "marcha", "0 %");
        await monta({ que: "video", indice: i, tiempo: 0 });

        try {
          const nodo =
            raizRef.current?.querySelector<HTMLElement>("[data-abp-tablero]");

          if (!nodo) throw new Error("sin tablero");

          const { fichero, poster } = await grabaJugada({
            nodo,
            pon: async (valor) => {
              sigue();
              setMontaje({ que: "video", indice: i, tiempo: valor });
              await pintado();
            },
            nFases: fasesDe(slide.trazos),
            destino: "whatsapp",
            titulo,
            alAvance: (f) => marca(id, "marcha", `${Math.round(f * 100)} %`),
          });
          const nombre = `${String(n + 1).padStart(2, "0")} ${nombreDelVideo(titulo, jornada)}`;

          const carpeta = soloVideos ? "" : "Videos/";

          entradas.push({
            nombre: `${carpeta}${nombre}.mp4`,
            datos: await bytes(fichero),
          });
          if (poster)
            entradas.push({
              nombre: `${carpeta}${nombre} poster.jpg`,
              datos: await bytes(poster),
            });
          marca(
            id,
            "hecho",
            `${(fichero.size / 1_000_000).toFixed(1).replace(".", ",")} MB`,
          );
        } catch (error) {
          if (error instanceof Cancelado) throw error;

          console.error("[abp-pizarra] exportar · vídeo", titulo, error);
          faltan.push(`el vídeo de «${titulo}»`);
          marca(id, "fallo");
        }
      }

      if (conVideos && conJugada.length && !sabeVideo)
        faltan.push(
          "los vídeos (este navegador no sabe montarlos: usa Chrome o Edge)",
        );

      if (entradas.length === 0) throw new Error("No ha salido nada");

      descarga(
        creaZip(entradas),
        `${base}-${soloVideos ? "videos" : conVideos ? "todo" : "documentos"}.zip`,
      );

      const pdfs = entradas.filter((e) => e.nombre.endsWith(".pdf")).length;
      const mp4 = entradas.filter((e) => e.nombre.endsWith(".mp4")).length;

      toast.success(
        soloVideos
          ? `Listo: ${mp4} ${mp4 === 1 ? "vídeo" : "vídeos"} en un .zip`
          : conVideos
            ? `Listo: ${pdfs} PDF, el PowerPoint y ${mp4} ${mp4 === 1 ? "vídeo" : "vídeos"} en un .zip`
            : `Listo: ${pdfs} PDF y el PowerPoint en un .zip`,
        {
          description: faltan.length
            ? `No han salido: ${faltan.join(", ")}.`
            : undefined,
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
    empezado.current = true;
    /* Fuera del efecto: el primer paso ya cambia el estado. Sin limpieza: el cerrojo de arriba impide repetirlo. */
    window.setTimeout(
      () => void exporta(trabajo.conVideos, trabajo.soloVideos),
      0,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trabajo]);

  useEffect(() => {
    if (trabajo && empezado.current && !enMarcha && !tareas)
      trabajoExportar.termina(trabajo.id);
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

  const hechas =
    tareas?.filter((t) => t.estado === "hecho" || t.estado === "fallo")
      .length ?? 0;

  useEffect(() => {
    if (trabajo && tareas)
      trabajoExportar.rotula(trabajo.id, `${hechas} de ${tareas.length}`);
  }, [trabajo, hechas, tareas]);

  /* En la pizarra: sólo los botones, que dejan el encargo al trabajo del layout. */
  const pide = (conVideos: boolean, soloVideos = false) =>
    trabajoExportar.encarga({
      tipo: "todo",
      conVideos,
      soloVideos,
      datos: { tablero, players, temporada, rival, jornada, escudoRival },
    });

  if (!trabajo) {
    return (
      <>
        <Button
          icon={PackageOpen}
          tone="primary"
          onClick={() => pide(true)}
          disabled={Boolean(encargado) || slides.length === 0}
          title={
            sabeVideo
              ? `Un .zip con el PDF general, el PowerPoint, el PDF de cada jugador y ${conJugada.length} ${conJugada.length === 1 ? "vídeo" : "vídeos"}. Sigue aunque cambies de pantalla`
              : "Este navegador no monta vídeo: saldrán sólo los documentos. Usa Chrome o Edge para los vídeos"
          }
        >
          {encargado?.conVideos && !encargado.soloVideos
            ? `Exportando${rotuloEncargo ? ` · ${rotuloEncargo}` : "…"}`
            : "Exportar todo"}
        </Button>

        <Button
          icon={FileStack}
          onClick={() => pide(false)}
          disabled={Boolean(encargado) || slides.length === 0}
          title="Un .zip con el PDF general, el PowerPoint y el PDF de cada jugador, sin vídeos. Sigue aunque cambies de pantalla"
        >
          {encargado && !encargado.conVideos
            ? `Exportando${rotuloEncargo ? ` · ${rotuloEncargo}` : "…"}`
            : "Solo documentos"}
        </Button>

        <Button
          icon={Clapperboard}
          onClick={() => pide(true, true)}
          disabled={Boolean(encargado) || !sabeVideo || conJugada.length === 0}
          title={
            !sabeVideo
              ? "Este navegador no monta vídeo: usa Chrome o Edge"
              : conJugada.length
                ? `Un .zip con los ${conJugada.length} ${conJugada.length === 1 ? "vídeo" : "vídeos"} de las diapositivas con jugada. Sigue aunque cambies de pantalla`
                : "Ninguna diapositiva tiene jugada dibujada"
          }
        >
          {encargado?.soloVideos
            ? `Exportando${rotuloEncargo ? ` · ${rotuloEncargo}` : "…"}`
            : `Solo vídeos${conJugada.length ? ` (${conJugada.length})` : ""}`}
        </Button>
      </>
    );
  }

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
            <p className="text-sm font-semibold text-white">
              {enMarcha
                ? `Exportando · ${hechas} de ${tareas.length}`
                : "Exportación terminada"}
            </p>
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
              <button
                type="button"
                aria-label="Cerrar"
                onClick={() => setTareas(null)}
                className="rounded-md p-1 text-white/70 hover:bg-white/10"
              >
                <X size={16} />
              </button>
            )}
          </div>

          <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-[#C8A96B] transition-all"
              style={{
                width: `${(hechas / Math.max(1, tareas.length)) * 100}%`,
              }}
            />
          </div>

          <ul className="max-h-64 space-y-1.5 overflow-y-auto text-xs">
            {tareas.map((t) => (
              <li key={t.id} className="flex items-center gap-2">
                <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                  {t.estado === "hecho" && (
                    <Check size={14} className="text-emerald-400" />
                  )}
                  {t.estado === "marcha" && (
                    <Loader2
                      size={14}
                      className="animate-spin text-[#C8A96B]"
                    />
                  )}
                  {t.estado === "fallo" && (
                    <X size={14} className="text-red-400" />
                  )}
                  {t.estado === "pendiente" && (
                    <span className="h-1.5 w-1.5 rounded-full bg-white/30" />
                  )}
                </span>
                <span
                  className={`min-w-0 flex-1 truncate ${t.estado === "pendiente" ? "text-white/50" : "text-white/90"}`}
                >
                  {t.nombre}
                </span>
                {t.detalle && (
                  <span className="shrink-0 tabular-nums text-white/60">
                    {t.detalle}
                  </span>
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
          style={{
            position: "fixed",
            top: 0,
            left: -(TABLERO_W + 200),
            width: TABLERO_W,
            zIndex: -1,
          }}
        >
          {montaje.que === "general" ? (
            slides.map((slide, i) => (
              <div key={slide.id} style={{ width: TABLERO_W }}>
                <TableroSlide
                  slide={slide}
                  titulo={tituloVisible(slides, i)}
                  {...comun}
                />
              </div>
            ))
          ) : (
            <TableroSlide
              slide={slides[montaje.indice]}
              titulo={tituloVisible(slides, montaje.indice)}
              tiempo={montaje.tiempo}
              {...comun}
            />
          )}
        </div>
      )}
    </>
  );
}
