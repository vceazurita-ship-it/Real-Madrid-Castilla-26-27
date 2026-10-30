"use client";

/*
|--------------------------------------------------------------------------
| EXPORTAR TODO DE UNA VEZ (30/10/2026)
|--------------------------------------------------------------------------
|
| Lo pidió el analista: «que pueda exportar de una vez el pdf de cada jugador,
| el general de ABP y los vídeos de cada slide, todo de la pizarra de ABP».
| Un clic y sale un solo .zip con tres carpetas:
|
|   · «General»: el PDF de todas las diapositivas (A4 apaisado, una por hoja).
|   · «Jugadores»: un PDF por jugador, los mismos de «PDF por jugador» (se
|     reutilizan si ya estaban hechos para esta versión de la pizarra).
|   · «Videos»: un MP4 por diapositiva con flechas, fase a fase, en formato
|     WhatsApp (1280 × 720, cabe en un mensaje), con su póster.
|
| Va por pasos y cuenta por dónde va. Lo que falle en un paso no tumba el
| resto: el .zip sale con lo que se haya podido hacer y lo dice.
*/

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { PackageOpen } from "lucide-react";
import { toast } from "sonner";

import type { Player } from "@/types/player";
import { Button } from "@/components/abp/ui";
import { TableroSlide } from "@/components/abp/pizarra/TableroSlide";
import { grabaJugada, nombreDelVideo } from "@/components/abp/pizarra/VideoJugada";
import { COLORES, TABLERO_H, TABLERO_W, jugadoresDelTablero, tituloVisible, type TableroPizarra } from "@/lib/abp/pizarra";
import { fasesDe } from "@/lib/abp/trazos";
import { trabajoPdfs, type EstadoPdfs } from "@/lib/abp/trabajo-pdfs";
import { apodo, capturaLienzos, descarga, esperaFotos, pdfDeLienzos, pintado } from "@/lib/export/lienzos";
import { creaZip, type Bytes, type EntradaZip } from "@/lib/export/zip";
import { esperaFuentePortada } from "@/lib/rivals/portada-font";
import { puedeHacerVideo } from "@/lib/tactics/lamina";

type Paso = { que: "general" } | { que: "jugadores" } | { que: "video"; indice: number; tiempo: number } | null;

const nada = () => () => undefined;

const bytes = async (blob: Blob) => new Uint8Array(await blob.arrayBuffer()) as Bytes;

/** Espera a que el trabajo de segundo plano tenga los PDF de todos (o se pare), con tope. */
function esperaPdfs(huella: string, ids: string[], topeMs = 240_000): Promise<EstadoPdfs> {
  return new Promise((listo) => {
    const mira = () => {
      const e = trabajoPdfs.foto();
      const todos = e.huella === huella && ids.every((id) => e.hechos[id]);
      const parado = e.huella === huella && !e.encargo;

      if (todos || parado) {
        quita();
        clearTimeout(plazo);
        listo(e);
      }
    };
    const quita = trabajoPdfs.suscribe(mira);
    const plazo = setTimeout(() => {
      quita();
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
}: {
  tablero: TableroPizarra;
  players: Map<string, Player>;
  temporada: string;
  rival: string;
  jornada?: string;
  escudoRival?: string;
}) {
  const [paso, setPaso] = useState<Paso>(null);
  const [rotulo, setRotulo] = useState("");
  const raizRef = useRef<HTMLDivElement>(null);
  const corriendo = useRef(false);
  const sabeVideo = useSyncExternalStore(nada, puedeHacerVideo, () => false);

  const slides = tablero.slides;
  const conJugada = slides.map((slide, i) => ({ slide, i })).filter(({ slide }) => fasesDe(slide.trazos) > 0);

  /* Igual que «PDF por jugador»: si la pizarra cambia, lo hecho ya no vale. */
  const huella = `${tablero.partidoId}|${tablero.actualizado ?? ""}|${rival}`;

  /* El paso que toca, con el tablero de fuera de pantalla ya montado: un respiro y a pintar. */
  const tras = (siguiente: Paso) =>
    new Promise<void>((listo) => {
      setPaso(siguiente);
      setTimeout(() => void pintado().then(() => pintado()).then(() => listo()), 90);
    });

  const exporta = async () => {
    if (corriendo.current) return;

    corriendo.current = true;

    const entradas: EntradaZip[] = [];
    const faltan: string[] = [];
    const aviso = toast.loading("Preparando todo el balón parado…");
    const base = `pizarra-abp-${apodo(rival, "pizarra")}${jornada ? `-${apodo(jornada)}` : ""}`;

    try {
      /* 1 · El PDF general. */
      setRotulo("PDF general");
      await tras({ que: "general" });

      try {
        const raiz = raizRef.current;

        if (!raiz) throw new Error("sin tablero");

        await esperaFuentePortada();
        await esperaFotos(raiz);

        const imagenes = await capturaLienzos(raiz, "[data-abp-tablero]", { ancho: TABLERO_W, alto: TABLERO_H, fondo: COLORES.tinta });
        const titulos = slides.map((_, i) => tituloVisible(slides, i));
        const cabecera = [rival || "RMCF Castilla", jornada, new Date().toLocaleDateString("es-ES")].filter(Boolean).join(" · ");
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

        entradas.push({ nombre: `General/${base}.pdf`, datos: await bytes(doc.output("blob")) });
      } catch (error) {
        console.error("[abp-pizarra] exportar todo · general", error);
        faltan.push("el PDF general");
      }

      /* 2 · Los PDF por jugador (el trabajo de segundo plano de «PDF por jugador»). */
      setRotulo("PDF de cada jugador");
      await tras({ que: "jugadores" });

      const ids = jugadoresDelTablero(tablero).map((fila) => fila.playerId);

      if (ids.length) {
        trabajoPdfs.encarga({ huella, tablero, players, temporada, rival, jornada, escudoRival, ids, vuelta: `${window.location.pathname}${window.location.search}` });

        const e = await esperaPdfs(huella, ids);
        const hechos = e.huella === huella ? ids.flatMap((id) => (e.hechos[id] ? [e.hechos[id]] : [])) : [];

        for (const h of hechos) entradas.push({ nombre: `Jugadores/${h.nombre}`, datos: await bytes(h.blob) });

        if (hechos.length < ids.length) faltan.push(`${ids.length - hechos.length} PDF de jugador`);
      }

      /* 3 · Un vídeo por diapositiva con jugada. */
      if (conJugada.length && sabeVideo) {
        for (const [n, { slide, i }] of conJugada.entries()) {
          const titulo = tituloVisible(slides, i);

          setRotulo(`vídeo ${n + 1} de ${conJugada.length}`);
          await tras({ que: "video", indice: i, tiempo: 0 });

          try {
            const nodo = raizRef.current?.querySelector<HTMLElement>("[data-abp-tablero]");

            if (!nodo) throw new Error("sin tablero");

            const { fichero, poster } = await grabaJugada({
              nodo,
              pon: async (valor) => {
                setPaso({ que: "video", indice: i, tiempo: valor });
                await pintado();
                await pintado();
              },
              nFases: fasesDe(slide.trazos),
              destino: "whatsapp",
              titulo,
              alAvance: (f) => setRotulo(`vídeo ${n + 1} de ${conJugada.length} · ${Math.round(f * 100)} %`),
            });
            const nombre = `${String(n + 1).padStart(2, "0")} ${nombreDelVideo(titulo, jornada)}`;

            entradas.push({ nombre: `Videos/${nombre}.mp4`, datos: await bytes(fichero) });
            if (poster) entradas.push({ nombre: `Videos/${nombre} poster.jpg`, datos: await bytes(poster) });
          } catch (error) {
            console.error("[abp-pizarra] exportar todo · vídeo", titulo, error);
            faltan.push(`el vídeo de «${titulo}»`);
          }
        }
      } else if (conJugada.length) {
        faltan.push("los vídeos (este navegador no sabe montarlos: usa Chrome o Edge)");
      }

      if (entradas.length === 0) throw new Error("No ha salido nada");

      descarga(creaZip(entradas), `${base}-todo.zip`);

      const pdfs = entradas.filter((e) => e.nombre.endsWith(".pdf")).length;
      const videos = entradas.filter((e) => e.nombre.endsWith(".mp4")).length;

      toast.success(`Listo: ${pdfs} PDF y ${videos} ${videos === 1 ? "vídeo" : "vídeos"} en un .zip`, {
        id: aviso,
        description: faltan.length ? `No han salido: ${faltan.join(", ")}.` : undefined,
        duration: 9_000,
      });
    } catch (error) {
      console.error("[abp-pizarra] exportar todo", error);
      toast.error("No se ha podido preparar el paquete", { id: aviso });
    } finally {
      corriendo.current = false;
      setPaso(null);
      setRotulo("");
    }
  };

  /* Si se cierra la pantalla a mitad, que no quede el cerrojo puesto en la siguiente visita. */
  useEffect(
    () => () => {
      corriendo.current = false;
    },
    [],
  );

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

  return (
    <>
      <Button
        icon={PackageOpen}
        onClick={() => void exporta()}
        disabled={paso !== null || slides.length === 0}
        title="Un .zip con el PDF general, el PDF de cada jugador y el vídeo de cada diapositiva con jugada"
      >
        {paso ? `Preparando ${rotulo}…` : "Exportar todo"}
      </Button>

      {paso && paso.que !== "jugadores" && (
        <div
          ref={raizRef}
          aria-hidden
          data-export-hide
          className="pointer-events-none"
          style={{ position: "fixed", top: 0, left: -(TABLERO_W + 200), width: TABLERO_W, zIndex: -1 }}
        >
          {paso.que === "general"
            ? slides.map((slide, i) => (
                <div key={slide.id} style={{ width: TABLERO_W }}>
                  <TableroSlide slide={slide} titulo={tituloVisible(slides, i)} {...comun} />
                </div>
              ))
            : (
                <TableroSlide slide={slides[paso.indice]} titulo={tituloVisible(slides, paso.indice)} tiempo={paso.tiempo} {...comun} />
              )}
        </div>
      )}
    </>
  );
}
