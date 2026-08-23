"use client";

/**
 * Reproductor de la jugada, bajo el campo.
 *
 * Play, pausa, bucle, saltos entre keyframes, velocidad y una línea de tiempo
 * que se puede arrastrar. Cada escena deja su marca sobre la barra, así que
 * el cursor cae siempre sobre un momento reconocible de la jugada.
 */

import { PointerEvent as ReactPointerEvent, useCallback, useRef } from "react";
import {
  Pause,
  Play,
  Repeat,
  SkipBack,
  SkipForward,
  Trash2,
} from "lucide-react";

import type { PitchTimeline } from "@/hooks/usePitchTimeline";
import { cn } from "@/lib/utils";

interface Props {
  timeline: PitchTimeline;
  /** Nombre de cada escena, en orden. */
  keyframes: string[];
  /** Escena que se está editando. */
  activeIndex: number;
  onSelectKeyframe: (index: number) => void;
  onRemoveKeyframe?: (index: number) => void;
}

export default function PitchTimelineBar({
  timeline,
  keyframes,
  activeIndex,
  onSelectKeyframe,
  onRemoveKeyframe,
}: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const single = keyframes.length < 2;

  /** Traduce la posición del puntero a un punto de la línea de tiempo. */
  const seekFromPointer = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track) return;

      const rect = track.getBoundingClientRect();
      if (rect.width === 0) return;

      timeline.seekProgress((clientX - rect.left) / rect.width);
    },
    [timeline]
  );

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (single) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    draggingRef.current = true;

    timeline.beginScrub();
    seekFromPointer(event.clientX);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    seekFromPointer(event.clientX);
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;

    event.currentTarget.releasePointerCapture?.(event.pointerId);
    draggingRef.current = false;

    timeline.endScrub();

    // Al soltar, la escena en edición pasa a ser la del keyframe más cercano.
    onSelectKeyframe(Math.round(timeline.progress * (keyframes.length - 1)));
  };

  const percent = single ? 0 : timeline.progress * 100;

  return (
    <div className="flex flex-wrap items-center gap-2 px-2.5 py-2 sm:gap-3 sm:px-3">
      {/* MANDOS */}

      <div className="flex items-center gap-0.5">
        <Control
          title="Keyframe anterior"
          onClick={timeline.prevKeyframe}
          disabled={single}
          icon={<SkipBack size={13} />}
        />

        <button
          type="button"
          onClick={timeline.toggle}
          disabled={single}
          title={timeline.playing ? "Pausar" : "Reproducir"}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#C8A96B] text-[#0B0F14] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-30"
        >
          {timeline.playing ? <Pause size={14} /> : <Play size={14} />}
        </button>

        <Control
          title="Keyframe siguiente"
          onClick={timeline.nextKeyframe}
          disabled={single}
          icon={<SkipForward size={13} />}
        />

        <Control
          title="Repetir en bucle"
          onClick={() => timeline.setLoop(!timeline.loop)}
          active={timeline.loop}
          disabled={single}
          icon={<Repeat size={13} />}
        />
      </div>

      {/* LÍNEA DE TIEMPO */}

      <div className="flex min-w-[140px] flex-1 items-center gap-2 sm:min-w-[180px]">
        <div
          ref={trackRef}
          role="slider"
          tabIndex={single ? -1 : 0}
          aria-label="Línea de tiempo de la jugada"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(percent)}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onKeyDown={(event) => {
            if (single) return;
            if (event.key === "ArrowRight") timeline.nextKeyframe();
            if (event.key === "ArrowLeft") timeline.prevKeyframe();
          }}
          className={cn(
            "relative h-7 flex-1 touch-none select-none",
            single ? "cursor-not-allowed opacity-40" : "cursor-pointer"
          )}
        >
          {/* Raíl */}
          <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-white/10" />

          {/* Progreso */}
          <div
            className="absolute left-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-[#C8A96B]"
            style={{ width: `${percent}%` }}
          />

          {/* Marcas de keyframe */}
          {keyframes.map((nombre, index) => {
            const at =
              keyframes.length < 2
                ? 0
                : (index / (keyframes.length - 1)) * 100;

            return (
              <button
                key={`${nombre}-${index}`}
                type="button"
                title={`${index + 1}. ${nombre}`}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => {
                  timeline.stopAt(index);
                  onSelectKeyframe(index);
                }}
                style={{ left: `${at}%` }}
                className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#0B0F14] transition hover:scale-125"
              >
                <span
                  className={cn(
                    "block h-full w-full rounded-full",
                    index === activeIndex
                      ? "bg-white"
                      : timeline.progress * (keyframes.length - 1) >= index
                      ? "bg-[#C8A96B]"
                      : "bg-white/35"
                  )}
                />
              </button>
            );
          })}

          {/* Cursor */}
          {!single && (
            <div
              className="pointer-events-none absolute top-1/2 h-5 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,.55)]"
              style={{ left: `${percent}%` }}
            />
          )}
        </div>

        <span className="w-11 shrink-0 text-right text-[10px] tabular-nums text-white/45">
          {(timeline.time / 1000).toFixed(1)}s
        </span>
      </div>

      {/* VELOCIDAD */}

      <div className="flex items-center gap-0.5 rounded-xl bg-white/[0.05] p-0.5">
        {([0.5, 1, 1.5, 2] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => timeline.setSpeed(option)}
            className={cn(
              "rounded-lg px-1.5 py-1 text-[10px] font-bold transition",
              timeline.speed === option
                ? "bg-[#C8A96B] text-[#0B0F14]"
                : "text-white/50 hover:text-white"
            )}
          >
            {option}×
          </button>
        ))}
      </div>

      {/* FASES */}

      {/* En el móvil las escenas se deslizan en una sola fila: apiladas se
          comían la pantalla en cuanto la jugada pasaba de cuatro escenas. */}
      <div className="flex w-full items-center gap-1 overflow-x-auto pb-0.5 sm:w-auto sm:flex-wrap sm:overflow-x-visible sm:pb-0">
        {keyframes.map((nombre, index) => (
          <span
            key={`chip-${index}`}
            className={cn(
              "inline-flex shrink-0 items-center rounded-xl border transition",
              index === activeIndex
                ? "border-[#C8A96B]/50 bg-[#C8A96B]/12"
                : "border-white/10 bg-white/[0.03] hover:bg-white/[0.07]"
            )}
          >
            <button
              type="button"
              onClick={() => {
                timeline.stopAt(index);
                onSelectKeyframe(index);
              }}
              className={cn(
                "px-2 py-1.5 text-[10px] font-semibold",
                index === activeIndex ? "text-[#C8A96B]" : "text-white/55"
              )}
            >
              {index + 1}. {nombre}
            </button>

            {onRemoveKeyframe && keyframes.length > 1 && (
              <button
                type="button"
                onClick={() => onRemoveKeyframe(index)}
                title="Eliminar escena"
                className="rounded-lg p-1 text-white/25 transition hover:bg-red-500/15 hover:text-red-300"
              >
                <Trash2 size={11} />
              </button>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}

function Control({
  title,
  icon,
  onClick,
  disabled = false,
  active = false,
}: {
  title: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "rounded-lg p-1.5 transition disabled:cursor-not-allowed disabled:opacity-30",
        active
          ? "bg-[#C8A96B]/18 text-[#C8A96B]"
          : "text-white/50 hover:bg-white/[0.09] hover:text-white"
      )}
    >
      {icon}
    </button>
  );
}
