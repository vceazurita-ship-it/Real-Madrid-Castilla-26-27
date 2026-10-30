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
|
| Diseño (30/10/2026, tras verlo en pantalla): todo es cristal oscuro con
| `siempre-oscuro` y fondos en línea. Con clases de Tailwind el modo día
| volvía clara la columna y blancos los nombres sobre blanco.
*/

import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  CircleDot,
  Flag,
  GripVertical,
  ListVideo,
  Pause,
  PanelRightClose,
  Play,
  RotateCcw,
  RotateCw,
  SkipBack,
  SkipForward,
  X,
} from "lucide-react";

import type { CategoriaCoding, ClipCoding } from "@/lib/coding/modelo";

/** El ancho de la columna, el mismo que se le quita al vídeo. */
export const ANCHO_PANEL_COMPLETA = 320;

const ORO = "#C8A96B";
const CRISTAL = "rgba(8,12,18,.78)";
const BORDE = "1px solid rgba(255,255,255,.12)";

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

/** Un botón redondo de la barra de mandos. */
function Mando({
  titulo,
  onClick,
  disabled,
  grande = false,
  children,
}: {
  titulo: string;
  onClick: () => void;
  disabled?: boolean;
  grande?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={titulo}
      aria-label={titulo}
      onClick={onClick}
      disabled={disabled}
      className={`grid place-items-center rounded-full text-white transition hover:scale-105 disabled:pointer-events-none disabled:opacity-30 ${grande ? "h-12 w-12" : "h-9 w-9 hover:bg-white/10"}`}
      style={grande ? { background: ORO, color: "#0B0F14", boxShadow: `0 0 24px ${ORO}66` } : undefined}
    >
      {children}
    </button>
  );
}

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
  const titulo = (clip: ClipCoding) => clip.jugadorNombre || categoriaDe(clip)?.nombre || `Corte ${clip.numero}`;

  const enCurso = marcado.inicioMs !== null;
  const desplaza = abierto ? ANCHO_PANEL_COMPLETA / 2 : 0;

  return (
    <div className="siempre-oscuro">
      {/* ------------------------------------------------ LA MARCA */}
      {!pintando && (
        <div
          className="absolute left-4 top-4 z-20 flex max-w-[62%] items-center gap-1 rounded-full p-1 backdrop-blur-md"
          style={{ background: CRISTAL, border: BORDE, boxShadow: "0 10px 30px rgba(0,0,0,.45)" }}
        >
          <button
            type="button"
            onClick={marcado.alElegir}
            title="Elegir jugador y categoría"
            className="inline-flex h-9 min-w-0 items-center gap-2 rounded-full px-3 text-xs font-semibold text-white transition hover:bg-white/10"
          >
            <span
              aria-hidden
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: marcado.categoria?.color ?? "rgba(255,255,255,.35)" }}
            />
            <span className="truncate">
              {marcado.sujeto ? [marcado.sujeto, marcado.categoria?.nombre].filter(Boolean).join(" · ") : "Elegir jugador"}
            </span>
          </button>

          {enCurso ? (
            <>
              <span className="inline-flex h-9 items-center gap-2 px-2 text-xs font-bold tabular-nums text-white">
                <span aria-hidden className="h-2 w-2 animate-pulse rounded-full" style={{ background: "#EF4444", boxShadow: "0 0 10px #EF4444" }} />
                {marcado.formatea(Math.max(0, marcado.tiempoMs - (marcado.inicioMs ?? 0)))}
              </span>
              <button
                type="button"
                onClick={marcado.alFinal}
                title="Marcar el final (O)"
                className="inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-xs font-bold text-white transition hover:brightness-110"
                style={{ background: "#DC2626" }}
              >
                <Flag size={14} />
                Final
                <kbd className="rounded px-1 text-[10px]" style={{ background: "rgba(0,0,0,.25)" }}>O</kbd>
              </button>
              <button
                type="button"
                onClick={marcado.alCancelar}
                title="Cancelar la marca"
                className="grid h-9 w-9 place-items-center rounded-full text-white transition hover:bg-white/10"
              >
                <X size={15} />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={marcado.alInicio}
              title="Marcar el inicio (I)"
              className="inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-xs font-bold text-white transition hover:brightness-110"
              style={{ background: "#059669" }}
            >
              <CircleDot size={14} />
              Inicio
              <kbd className="rounded px-1 text-[10px]" style={{ background: "rgba(0,0,0,.25)" }}>I</kbd>
            </button>
          )}
        </div>
      )}

      {/* ------------------------------------------------ LOS MANDOS */}
      <div
        className="absolute bottom-5 z-20 flex items-center gap-1 rounded-full px-2 py-1.5 backdrop-blur-md"
        style={{
          left: "50%",
          transform: `translateX(calc(-50% - ${desplaza}px))`,
          background: CRISTAL,
          border: BORDE,
          boxShadow: "0 12px 34px rgba(0,0,0,.5)",
        }}
      >
        <Mando titulo="Corte anterior" disabled={!anterior} onClick={() => anterior && alReproducir(anterior)}>
          <SkipBack size={17} />
        </Mando>
        <Mando titulo="Cinco segundos atrás" onClick={() => alSaltar(-5000)}>
          <RotateCcw size={16} />
        </Mando>
        <Mando titulo={reproduciendo ? "Pausa" : "Reproducir"} onClick={alAlternar} grande>
          {reproduciendo ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="translate-x-[1px]" />}
        </Mando>
        <Mando titulo="Cinco segundos adelante" onClick={() => alSaltar(5000)}>
          <RotateCw size={16} />
        </Mando>
        <Mando titulo="Corte siguiente" disabled={!siguiente} onClick={() => siguiente && alReproducir(siguiente)}>
          <SkipForward size={17} />
        </Mando>

        {clips.length > 0 && (
          <span className="ml-1 border-l pl-2 text-[11px] font-semibold tabular-nums text-white/60" style={{ borderColor: "rgba(255,255,255,.12)" }}>
            {indice >= 0 ? `${indice + 1} / ${clips.length}` : clips.length}
          </span>
        )}

        {!abierto && clips.length > 0 && (
          <Mando titulo="Enseñar la lista de cortes" onClick={() => alAbrir(true)}>
            <ListVideo size={16} />
          </Mando>
        )}
      </div>

      {/* ------------------------------------------------ LA LISTA */}
      {abierto && (
        <aside
          className="absolute bottom-0 right-0 top-0 z-20 flex flex-col"
          style={{ width: ANCHO_PANEL_COMPLETA, background: "linear-gradient(180deg, #0E141C, #0A0E14)", borderLeft: BORDE }}
          aria-label="Cortes"
        >
          <div className="flex items-center gap-2 px-4 pb-3 pt-4 pr-28">
            <button
              type="button"
              onClick={() => alAbrir(false)}
              title="Plegar la lista"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-white/60 transition hover:bg-white/10 hover:text-white"
            >
              <PanelRightClose size={16} />
            </button>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[.22em]" style={{ color: ORO }}>
                Cortes
              </p>
              <p className="text-sm font-semibold text-white">
                {clips.length} {clips.length === 1 ? "corte" : "cortes"}
              </p>
            </div>
          </div>

          <ol className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-3 pb-4">
            {clips.map((clip, i) => {
              const categoria = categoriaDe(clip);
              const color = categoria?.color ?? "#64748B";
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
                  className={`group relative flex items-center gap-2 overflow-hidden rounded-xl py-2 pl-3 pr-1.5 transition ${arrastrado === clip.id ? "opacity-40" : ""}`}
                  style={{
                    background: activo ? `linear-gradient(90deg, ${ORO}2E, ${ORO}0D)` : "rgba(255,255,255,.035)",
                    border: `1px solid ${activo ? `${ORO}99` : "rgba(255,255,255,.07)"}`,
                    boxShadow:
                      marca === "antes" ? `inset 0 2px 0 ${ORO}` : marca === "despues" ? `inset 0 -2px 0 ${ORO}` : undefined,
                  }}
                >
                  {/* La franja de la categoría. */}
                  <span aria-hidden className="absolute bottom-0 left-0 top-0 w-1" style={{ background: color }} />

                  <button type="button" onClick={() => alReproducir(clip)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
                    <span
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[11px] font-bold tabular-nums"
                      style={activo ? { background: ORO, color: "#0B0F14" } : { background: "rgba(255,255,255,.08)", color: "#fff" }}
                    >
                      {activo && reproduciendo ? <Play size={12} fill="currentColor" /> : i + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-semibold text-white">{titulo(clip)}</span>
                      <span className="block truncate text-[11px] text-white/50">
                        {[clip.jugadorNombre ? categoria?.nombre : null, duracion(clip), ...clip.tags.slice(0, 2)].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                  </button>

                  {/* Ordenar: arrastrando por el asa, o con las flechas en una tablet. */}
                  <span className="flex shrink-0 items-center opacity-0 transition group-hover:opacity-100 max-md:opacity-100">
                    <span className="flex flex-col">
                      <button
                        type="button"
                        disabled={i === 0}
                        onClick={() => alMover(clip.id, clips[i - 1].id, "antes")}
                        title="Subir"
                        className="rounded p-0.5 text-white/60 hover:text-white disabled:opacity-25"
                      >
                        <ChevronUp size={13} />
                      </button>
                      <button
                        type="button"
                        disabled={i === clips.length - 1}
                        onClick={() => alMover(clip.id, clips[i + 1].id, "despues")}
                        title="Bajar"
                        className="rounded p-0.5 text-white/60 hover:text-white disabled:opacity-25"
                      >
                        <ChevronDown size={13} />
                      </button>
                    </span>
                    <GripVertical size={15} className="cursor-grab text-white/40" aria-hidden />
                  </span>
                </li>
              );
            })}
          </ol>
        </aside>
      )}
    </div>
  );
}
