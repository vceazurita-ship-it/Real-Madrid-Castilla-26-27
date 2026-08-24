"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Star, UserRound } from "lucide-react";

import { formatRating, ratingColorHex } from "@/lib/ratings/compute";
import { layoutPitch, recommendedHeight } from "@/lib/ratings/pitch";

/**
 * A partir de aquí la pantalla es más apaisada que alta: el campo se pinta
 * tumbado —atacando a la derecha— y aprovecha todo el ancho del portátil.
 * Por debajo (móvil en vertical) se mantiene el campo de pie.
 */
const HORIZONTAL_FROM = 820;

export type PitchPlayer = {
  id: string;
  position: string;
  name: string;
  photo: string;
  dorsal?: number;
  /** Valor que se pinta en el aro y colorea la ficha (0-10). */
  value: number;
  /** Línea pequeña bajo el nombre: partidos, minutos, lo que toque. */
  caption: string;
  /** Detalle largo del hover: no se pinta en la ficha. */
  detail?: string;
  /** Se atenúa cuando no cumple el filtro activo, en vez de desaparecer. */
  dimmed?: boolean;
  /** Corona dorada para el mejor de la plantilla. */
  mvp?: boolean;
};

/**
 * Campograma de la plantilla con la valoración de cada jugador.
 *
 * El motor de colocación (`layoutPitch`) garantiza que nadie se pisa: aquí sólo
 * se pinta lo que devuelve, ciñendo cada nombre al ancho reservado a su ficha.
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

  const [width, setWidth] = useState(0);
  const [viewport, setViewport] = useState(0);
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    const node = containerRef.current;

    if (!node) return;

    const update = () => setWidth(node.clientWidth);

    update();

    const observer = new ResizeObserver(update);

    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const update = () => setViewport(window.innerHeight);

    update();

    window.addEventListener("resize", update);

    return () => window.removeEventListener("resize", update);
  }, []);

  /* En cuanto hay ancho de sobra, el campo se tumba: es lo que pide un portátil. */
  const horizontal = width >= HORIZONTAL_FROM;

  /*
  | El alto no se mide, se decide: de base lo que cabe en pantalla y, si hay
  | tanta gente que se pisarían, el campo crece y la página se desplaza.
  |
  | Tumbado no crece: se queda con la proporción de un campo real, sin pasarse
  | de lo que entra en la ventana, porque las líneas se separan a lo ancho.
  */
  const height = useMemo(() => {
    const room = viewport || 900;

    const base = horizontal
      ? Math.max(320, Math.min(room - 210, 680, Math.round(width * 0.62)))
      : Math.max(540, Math.min(880, room - 190));

    return recommendedHeight(
      players,
      width,
      base,
      horizontal ? "horizontal" : "vertical"
    );
  }, [players, width, viewport, horizontal]);

  const { placed, avatar, compact } = useMemo(
    () => layoutPitch(players, width, height, horizontal ? "horizontal" : "vertical"),
    [players, width, height, horizontal]
  );

  const badgeSize = Math.max(18, Math.min(30, Math.round(avatar * 0.46)));
  const nameFont = Math.max(9, Math.min(13, Math.round(avatar * 0.22)));

  const hoveredCard = useMemo(
    () => placed.find((entry) => entry.item.id === hovered) ?? null,
    [placed, hovered]
  );

  return (
    <div
      ref={containerRef}
      className="pitch-photo relative w-full overflow-hidden bg-[#173b2a]"
      style={{ height }}
      onMouseLeave={() => setHovered(null)}
    >
      {/* FONDO DEL CAMPO */}

      {/* La imagen es un campo apaisado: de pie hay que girarla, tumbada no. */}

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/emotional-field-bg.png"
          alt=""
          className={
            horizontal
              ? "absolute inset-0 h-full w-full object-cover"
              : "absolute left-1/2 top-1/2 h-[75%] w-[240%] max-w-none -translate-x-1/2 -translate-y-1/2 rotate-90 object-fill sm:h-[133%] sm:w-[240%]"
          }
        />
      </div>

      <div
        className={`pitch-photo-veil pointer-events-none absolute inset-0 ${
          horizontal
            ? "bg-gradient-to-r from-black/55 via-black/20 to-black/55"
            : "bg-gradient-to-b from-black/55 via-black/20 to-black/55"
        }`}
      />

      {/* Modo día: aclara el césped hasta los tonos del tema claro (globals.css) */}

      <div className="pitch-photo-wash" />

      {/* JUGADORES */}

      {placed.map(({ item, x, y, slot }) => {
        const rated = item.value > 0;
        /* La escala luminosa vale en los dos temas: la nota se pinta sobre
           su propia píldora de color, no sobre el césped. */
        const color = ratingColorHex(item.value);
        const active = selectedId === item.id;
        const isHovered = hovered === item.id;

        /* El nombre nunca invade la ficha de al lado. */
        const labelWidth = Math.max(56, Math.min(slot - 6, 132));

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect?.(item.id)}
            onMouseEnter={() => setHovered(item.id)}
            onFocus={() => setHovered(item.id)}
            onBlur={() => setHovered(null)}
            aria-label={`${item.name} · ${item.position} · ${formatRating(item.value)}`}
            className={`group absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center outline-none transition duration-200 focus-visible:z-40 ${
              item.dimmed
                ? "z-10 opacity-30 grayscale hover:z-30 hover:opacity-90 hover:grayscale-0"
                : "z-20 opacity-100 hover:z-40 hover:scale-[1.12]"
            } ${isHovered || active ? "z-40" : ""}`}
            style={{ left: x, top: y }}
          >
            {/* FOTO + ARO DE COLOR */}

            <div
              className="relative shrink-0 overflow-hidden rounded-full bg-[#11161D] transition-shadow"
              style={{
                height: avatar,
                width: avatar,
                border: `${rated ? 3 : 2}px solid ${
                  rated ? color : "rgba(255,255,255,0.45)"
                }`,
                boxShadow: active
                  ? `0 0 0 3px #C8A96B, 0 0 18px ${color}80, 0 4px 16px rgba(0,0,0,0.65)`
                  : rated
                    ? `0 0 14px ${color}45, 0 4px 14px rgba(0,0,0,0.6)`
                    : "0 4px 14px rgba(0,0,0,0.55)",
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
                className="absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full font-bold tabular-nums ring-2 ring-black/55"
                style={{
                  height: badgeSize,
                  minWidth: badgeSize,
                  paddingInline: 3,
                  fontSize: Math.max(9, Math.round(badgeSize * 0.46)),
                  backgroundColor: rated ? color : "#1E293B",
                  color: rated ? "#06121A" : "rgba(255,255,255,0.5)",
                }}
              >
                {formatRating(item.value)}
              </span>

              {/* MVP */}

              {item.mvp && !item.dimmed && (
                <span
                  className="absolute -left-1 -top-1 flex items-center justify-center rounded-full bg-[#C8A96B] text-black ring-2 ring-black/55"
                  style={{
                    height: Math.round(badgeSize * 0.74),
                    width: Math.round(badgeSize * 0.74),
                  }}
                >
                  <Star size={Math.round(badgeSize * 0.4)} fill="currentColor" />
                </span>
              )}
            </div>

            {/* NOMBRE */}

            <span
              className="mt-1.5 truncate rounded-md bg-black/80 px-1.5 py-0.5 font-semibold leading-tight text-white ring-1 ring-white/10"
              style={{ fontSize: nameFont, maxWidth: labelWidth }}
            >
              {item.dorsal ? (
                <span className="text-[#C8A96B]">{item.dorsal} </span>
              ) : null}
              {item.name}
            </span>

            {!compact && (
              <span
                className="mt-0.5 truncate px-1 leading-tight text-white/60"
                style={{
                  fontSize: Math.max(8, nameFont - 2),
                  maxWidth: labelWidth,
                }}
              >
                {item.caption}
              </span>
            )}
          </button>
        );
      })}

      {/* TARJETA DE DETALLE AL PASAR POR ENCIMA */}

      {hoveredCard && (
        <HoverCard
          player={hoveredCard.item}
          x={hoveredCard.x}
          y={hoveredCard.y}
          avatar={avatar}
          width={width}
          height={height}
        />
      )}

      {placed.length === 0 && (
        <p className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-xl bg-black/70 px-4 py-2 text-xs text-white/60">
          Ningún jugador cumple el filtro activo
        </p>
      )}
    </div>
  );
}

/**
 * Ficha flotante: sitúa el detalle sin salirse del campo.
 *
 * El campo recorta lo que se sale, así que la tarjeta se ciñe por los lados y,
 * cuando no cabe por encima del jugador —la primera línea, y muchas más con el
 * campo tumbado—, se descuelga por debajo.
 */
function HoverCard({
  player,
  x,
  y,
  avatar,
  width,
  height,
}: {
  player: PitchPlayer;
  x: number;
  y: number;
  avatar: number;
  width: number;
  height: number;
}) {
  const CARD = 190;

  /* Alto aproximado de la tarjeta: basta para saber si cabe por encima. */
  const CARD_HEIGHT = 104;

  const left = Math.min(Math.max(x, CARD / 2 + 8), Math.max(CARD / 2 + 8, width - CARD / 2 - 8));

  const fitsAbove = y - avatar / 2 - 10 - CARD_HEIGHT >= 4;

  /* La tarjeta se ancla por su base (`-translate-y-full`). */
  const top = fitsAbove
    ? y - avatar / 2 - 10
    : Math.min(y + avatar / 2 + 12 + CARD_HEIGHT, height - 4);

  return (
    <div
      className="pointer-events-none absolute z-50 -translate-x-1/2 -translate-y-full rounded-xl border border-white/15 bg-[#0B0F14]/95 px-3 py-2 shadow-2xl backdrop-blur"
      style={{ left, top, width: CARD }}
    >
      <p className="truncate text-xs font-semibold text-white">{player.name}</p>

      <p className="truncate text-[10px] uppercase tracking-[0.16em] text-[#C8A96B]">
        {player.position}
      </p>

      <p className="mt-1 truncate text-[11px] text-white/55">{player.caption}</p>

      {player.detail && (
        <p className="mt-0.5 truncate text-[11px] text-white/40">{player.detail}</p>
      )}

      <p className="mt-1.5 text-[10px] text-white/30">Pulsa para abrir su ficha</p>
    </div>
  );
}
