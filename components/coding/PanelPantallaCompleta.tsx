"use client";

/*
|--------------------------------------------------------------------------
| LOS CORTES A PANTALLA COMPLETA (30/10/2026)
|--------------------------------------------------------------------------
|
| Lo pidió el analista, como ya hacía el coding de ABP del rival: a pantalla
| completa, con la pizarra a la vez, poder pasar de un corte a otro y
| ordenarlos sin salir. Hasta ahora lo que se ponía en grande era sólo el
| marco del vídeo y la lista quedaba fuera: para cambiar de corte había que
| salir, pulsar y volver a entrar.
|
| Va DENTRO del marco que se pone en grande (si no, el navegador no lo
| enseña). La columna de la derecha es la lista —arrastrar para ordenar, o
| las flechas en una tablet— y abajo los mandos: anterior, reproducir,
| siguiente y saltos de cinco segundos. Se pliega para dejar el vídeo entero.
|
| Y se marca sin salir: «Inicio» y «Final» (o las teclas I y O, que siguen
| valiendo), con el jugador y la categoría a la vista y pulsables. A pantalla
| completa los avisos de abajo no se ven, así que la marca en curso se cuenta
| aquí mismo.
*/

import { useState } from "react";
import {
  ChevronDown,
  CircleDot,
  Flag,
  X,
  ChevronUp,
  GripVertical,
  ListVideo,
  Pause,
  PanelRightClose,
  Play,
  RotateCcw,
  RotateCw,
  SkipBack,
  SkipForward,
} from "lucide-react";

import type { CategoriaCoding, ClipCoding } from "@/lib/coding/modelo";

/** El ancho de la columna, el mismo que se le quita al vídeo. */
export const ANCHO_PANEL_COMPLETA = 300;

const duracion = (clip: ClipCoding) => {
  const s = Math.max(0, Math.round((clip.finMs - clip.inicioMs) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export type MarcadoCompleta = {
  inicioMs: number | null;
  tiempoMs: number;
  /** «Ciria · Pase progresivo»: lo que se va a marcar, o nada si falta elegirlo. */
  sujeto: string | null;
  categoria: { nombre: string; color: string } | null;
  formatea: (ms: number) => string;
  alInicio: () => void;
  alFinal: () => void;
  alCancelar: () => void;
  alElegir: () => void;
};

export function PanelPantallaCompleta({
  marcado,
  pintando,
  abierto,
  alAbrir,
  clips,
  categorias,
  seleccionado,
  reproduciendo,
  alReproducir,
  alAlternar,
  alSaltar,
  alMover,
}: {
  marcado: MarcadoCompleta;
  /** Con la pizarra abierta, su barra va a la izquierda: la marca se aparta. */
  pintando: boolean;
  abierto: boolean;
  alAbrir: (abierto: boolean) => void;
  clips: ClipCoding[];
  categorias: CategoriaCoding[];
  seleccionado: string | null;
  reproduciendo: boolean;
  alReproducir: (clip: ClipCoding) => void;
  alAlternar: () => void;
  /** Adelanta o atrasa en milisegundos. */
  alSaltar: (deltaMs: number) => void;
  alMover: (id: string, destinoId: string, donde: "antes" | "despues") => void;
}) {
  const [arrastrado, setArrastrado] = useState<string | null>(null);
  const [destino, setDestino] = useState<{ id: string; donde: "antes" | "despues" } | null>(null);

  const indice = clips.findIndex((c) => c.id === seleccionado);
  const anterior = indice > 0 ? clips[indice - 1] : null;
  const siguiente = indice >= 0 ? (clips[indice + 1] ?? null) : (clips[0] ?? null);
  const categoriaDe = (clip: ClipCoding) => categorias.find((c) => c.id === clip.categoriaId);

  const boton =
    "inline-flex h-9 items-center justify-center gap-1.5 rounded-full border border-white/15 bg-black/70 px-3 text-xs font-semibold text-white/85 backdrop-blur transition hover:bg-black/90 disabled:opacity-35";

  const enCurso = marcado.inicioMs !== null;

  return (
    <>
      {/* La marca: arriba a la izquierda, donde no tapa la jugada. */}
      <div className={`absolute left-3 top-3 z-20 max-w-[60%] flex-wrap items-center gap-1.5 ${pintando ? "hidden" : "flex"}`}>
        <button
          type="button"
          onClick={marcado.alElegir}
          title="Elegir jugador y categoría"
          className="inline-flex h-9 min-w-0 items-center gap-2 rounded-full border border-white/15 bg-black/70 px-3 text-xs font-semibold text-white/90 backdrop-blur transition hover:bg-black/90"
        >
          {marcado.categoria && (
            <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: marcado.categoria.color }} />
          )}
          <span className="truncate">
            {marcado.sujeto ? [marcado.sujeto, marcado.categoria?.nombre].filter(Boolean).join(" · ") : "Elegir jugador"}
          </span>
        </button>

        {enCurso ? (
          <>
            <span className="inline-flex h-9 items-center gap-2 rounded-full border border-red-400/60 bg-red-500/20 px-3 text-xs font-bold tabular-nums text-white backdrop-blur">
              <span aria-hidden className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
              {marcado.formatea(marcado.inicioMs ?? 0)} → {marcado.formatea(Math.max(0, marcado.tiempoMs - (marcado.inicioMs ?? 0)))}
            </span>
            <button type="button" onClick={marcado.alFinal} title="Marcar el final (O)" className={`${boton} border-red-400/70 bg-red-600/80 text-white hover:bg-red-600`}>
              <Flag size={14} />
              Final
              <kbd className="rounded bg-black/30 px-1 text-[10px]">O</kbd>
            </button>
            <button type="button" onClick={marcado.alCancelar} title="Cancelar la marca" className={`${boton} w-9 px-0`}>
              <X size={15} />
            </button>
          </>
        ) : (
          <button type="button" onClick={marcado.alInicio} title="Marcar el inicio (I)" className={`${boton} border-emerald-400/60 bg-emerald-600/70 text-white hover:bg-emerald-600`}>
            <CircleDot size={14} />
            Inicio
            <kbd className="rounded bg-black/30 px-1 text-[10px]">I</kbd>
          </button>
        )}
      </div>

      {/* Mandos: abajo, a la izquierda del botón «Pizarra». */}
      <div
        className="absolute bottom-3 z-20 flex items-center gap-1.5"
        style={{ left: "50%", transform: `translateX(calc(-50% - ${abierto ? ANCHO_PANEL_COMPLETA / 2 : 0}px))` }}
      >
        <button type="button" className={boton} disabled={!anterior} onClick={() => anterior && alReproducir(anterior)} title="Corte anterior">
          <SkipBack size={15} />
          <span className="max-md:hidden">Anterior</span>
        </button>
        <button type="button" className={boton} onClick={() => alSaltar(-5000)} title="Cinco segundos atrás">
          <RotateCcw size={15} />
        </button>
        <button
          type="button"
          className={`${boton} w-12 border-[#C8A96B]/60 text-[#E4C977]`}
          onClick={alAlternar}
          title={reproduciendo ? "Pausa" : "Reproducir"}
        >
          {reproduciendo ? <Pause size={17} /> : <Play size={17} />}
        </button>
        <button type="button" className={boton} onClick={() => alSaltar(5000)} title="Cinco segundos adelante">
          <RotateCw size={15} />
        </button>
        <button type="button" className={boton} disabled={!siguiente} onClick={() => siguiente && alReproducir(siguiente)} title="Corte siguiente">
          <span className="max-md:hidden">Siguiente</span>
          <SkipForward size={15} />
        </button>

        {!abierto && clips.length > 0 && (
          <button type="button" className={boton} onClick={() => alAbrir(true)} title="Enseñar la lista de cortes">
            <ListVideo size={15} />
            {indice >= 0 ? `${indice + 1} / ${clips.length}` : clips.length}
          </button>
        )}
      </div>

      {abierto && (
        <aside
          className="absolute bottom-0 right-0 top-0 z-20 flex flex-col border-l border-white/10 bg-[#0B0F14]/95 backdrop-blur"
          style={{ width: ANCHO_PANEL_COMPLETA }}
          aria-label="Cortes"
        >
          <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2.5 pr-24">
            <p className="text-[11px] font-semibold uppercase tracking-[.2em] text-white/55">
              Cortes{" "}
              <span className="text-white/35">{indice >= 0 ? `${indice + 1} / ${clips.length}` : clips.length}</span>
            </p>
            <button
              type="button"
              onClick={() => alAbrir(false)}
              title="Plegar la lista"
              className="rounded-lg p-1.5 text-white/55 transition hover:bg-white/10 hover:text-white"
            >
              <PanelRightClose size={16} />
            </button>
          </div>

          <ol className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
            {clips.map((clip, i) => {
              const categoria = categoriaDe(clip);
              const activo = clip.id === seleccionado;
              const marca = destino?.id === clip.id && arrastrado !== clip.id ? destino.donde : null;

              return (
                <li
                  key={clip.id}
                  draggable
                  onDragStart={(e) => {
                    setArrastrado(clip.id);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragOver={(e) => {
                    if (!arrastrado) return;
                    e.preventDefault();
                    const caja = e.currentTarget.getBoundingClientRect();
                    setDestino({ id: clip.id, donde: e.clientY < caja.top + caja.height / 2 ? "antes" : "despues" });
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (arrastrado && destino && arrastrado !== destino.id) alMover(arrastrado, destino.id, destino.donde);
                    setArrastrado(null);
                    setDestino(null);
                  }}
                  onDragEnd={() => {
                    setArrastrado(null);
                    setDestino(null);
                  }}
                  className={`group relative flex items-center gap-2 rounded-xl border px-2 py-1.5 transition ${
                    activo ? "border-[#C8A96B]/70 bg-[#C8A96B]/15" : "border-white/[0.06] bg-white/[0.03] hover:border-white/20"
                  } ${arrastrado === clip.id ? "opacity-40" : ""}`}
                  style={{
                    boxShadow:
                      marca === "antes" ? "inset 0 2px 0 #C8A96B" : marca === "despues" ? "inset 0 -2px 0 #C8A96B" : undefined,
                  }}
                >
                  <GripVertical size={14} className="shrink-0 cursor-grab text-white/25" aria-hidden />

                  <button type="button" onClick={() => alReproducir(clip)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                    <span
                      className="grid h-6 min-w-6 shrink-0 place-items-center rounded-md px-1 text-[10px] font-bold tabular-nums"
                      style={{ background: categoria?.color ?? "#334155", color: "#0B0F14" }}
                    >
                      {i + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-semibold text-white/90">{clip.jugadorNombre}</span>
                      <span className="block truncate text-[10px] text-white/45">
                        {[categoria?.nombre, duracion(clip), ...clip.tags.slice(0, 2)].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                  </button>

                  {/* Para la tablet, donde arrastrar dentro de una lista que se desplaza es incómodo. */}
                  <span className="flex shrink-0 flex-col opacity-0 transition group-hover:opacity-100 max-md:opacity-100">
                    <button
                      type="button"
                      disabled={i === 0}
                      onClick={() => alMover(clip.id, clips[i - 1].id, "antes")}
                      title="Subir"
                      className="rounded p-0.5 text-white/55 hover:text-white disabled:opacity-25"
                    >
                      <ChevronUp size={13} />
                    </button>
                    <button
                      type="button"
                      disabled={i === clips.length - 1}
                      onClick={() => alMover(clip.id, clips[i + 1].id, "despues")}
                      title="Bajar"
                      className="rounded p-0.5 text-white/55 hover:text-white disabled:opacity-25"
                    >
                      <ChevronDown size={13} />
                    </button>
                  </span>
                </li>
              );
            })}
          </ol>
        </aside>
      )}
    </>
  );
}
