"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { UserRound } from "lucide-react";

import { formatRating, ratingColor } from "@/lib/ratings/compute";
import { layoutPitch } from "@/lib/ratings/pitch";

export type PitchPlayer = {
  id: string;
  position: string;
  name: string;
  photo: string;
  /** Valor que se pinta en el aro y colorea la ficha (0-10). */
  value: number;
  /** Línea pequeña bajo el nombre: partidos, minutos, lo que toque. */
  caption: string;
  /** Se atenúa cuando no cumple el filtro activo, en vez de desaparecer. */
  dimmed?: boolean;
};

/**
 * Campograma de la plantilla con la valoración de cada jugador.
 *
 * Mismo lenguaje visual que el campograma de plantillas rivales: el jugador
 * se coloca por su posición de la hoja y la ficha se colorea por su nota.
 */
export function SquadPitch({
  players,
  selectedId,
  onSelect,
}: {
  players: PitchPlayer[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const node = containerRef.current;

    if (!node) return;

    const update = () =>
      setSize({ width: node.clientWidth, height: node.clientHeight });

    update();

    const observer = new ResizeObserver(update);

    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  const { placed, avatar } = useMemo(
    () => layoutPitch(players, size.width, size.height),
    [players, size.width, size.height]
  );

  const badgeSize = Math.max(18, Math.min(28, Math.round(avatar * 0.44)));
  const nameFont = Math.max(9, Math.min(12, Math.round(avatar * 0.21)));

  return (
    <div
      ref={containerRef}
      className="relative h-[min(880px,calc(100vh-190px))] min-h-[540px] w-full overflow-hidden bg-[#173b2a]"
    >
      {/* FONDO DEL CAMPO */}

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/emotional-field-bg.png"
          alt=""
          className="absolute left-1/2 top-1/2 h-[75%] w-[240%] max-w-none -translate-x-1/2 -translate-y-1/2 rotate-90 object-fill sm:h-[133%] sm:w-[240%] lg:h-[135%] lg:w-[100%]"
        />
      </div>

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/50 via-black/15 to-black/50" />

      {/* JUGADORES */}

      {placed.map(({ item, x, y }) => {
        const color = ratingColor(item.value);
        const active = selectedId === item.id;

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect?.(item.id)}
            title={`${item.name} · ${item.position} · ${formatRating(item.value)}`}
            className={`group absolute z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center transition duration-200 hover:z-30 ${
              item.dimmed
                ? "opacity-25 grayscale hover:opacity-70"
                : "opacity-100 hover:scale-110"
            }`}
            style={{ left: x, top: y }}
          >
            {/* FOTO + ARO DE COLOR */}

            <div
              className="relative shrink-0 overflow-hidden rounded-full bg-[#11161D] shadow-[0_4px_16px_rgba(0,0,0,0.6)]"
              style={{
                height: avatar,
                width: avatar,
                border: `2.5px solid ${item.value > 0 ? color : "rgba(255,255,255,0.75)"}`,
                boxShadow: active
                  ? `0 0 0 3px ${color}66, 0 4px 16px rgba(0,0,0,0.6)`
                  : undefined,
              }}
            >
              {item.photo ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={item.photo}
                  alt={item.name}
                  loading="lazy"
                  className="h-full w-full object-cover object-top"
                />
              ) : (
                <UserRound
                  size={Math.round(avatar * 0.5)}
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white/30"
                />
              )}

              {/* NOTA */}

              <span
                className="absolute -bottom-1 -right-1 flex items-center justify-center rounded-full font-bold tabular-nums shadow-lg"
                style={{
                  height: badgeSize,
                  minWidth: badgeSize,
                  paddingInline: 3,
                  fontSize: Math.max(9, Math.round(badgeSize * 0.46)),
                  backgroundColor: item.value > 0 ? color : "#334155",
                  color: item.value > 0 ? "#06121A" : "rgba(255,255,255,0.55)",
                }}
              >
                {formatRating(item.value)}
              </span>
            </div>

            {/* NOMBRE */}

            <span
              className="mt-1.5 max-w-[110px] truncate rounded bg-black/75 px-1.5 py-0.5 font-semibold leading-tight text-white"
              style={{ fontSize: nameFont }}
            >
              {item.name}
            </span>

            <span
              className="mt-0.5 max-w-[110px] truncate rounded px-1 leading-tight text-white/55"
              style={{ fontSize: Math.max(8, nameFont - 2) }}
            >
              {item.caption}
            </span>
          </button>
        );
      })}

      {placed.length === 0 && (
        <p className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-xl bg-black/60 px-4 py-2 text-xs text-white/60">
          Sin jugadores que cumplan el filtro
        </p>
      )}
    </div>
  );
}
