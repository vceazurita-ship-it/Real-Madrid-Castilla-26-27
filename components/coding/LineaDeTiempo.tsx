"use client";

/**
 * La línea de tiempo del partido.
 *
 * Es el mapa del trabajo hecho: cada clip es una marca de color en el minuto
 * en el que ocurrió, así que de un vistazo se ve dónde se ha codificado mucho
 * y qué tramo del partido está en blanco. Sirve además de barra de progreso —se
 * pulsa y el vídeo salta ahí— y de aviso: mientras hay un INICIO marcado sin
 * cerrar, la zona en curso se pinta a rayas.
 *
 * Se dibuja con `div` posicionados en porcentaje y no con un lienzo: son unos
 * cientos de marcas, el navegador las mueve solo al cambiar el tamaño de la
 * ventana y cada una puede llevar su propio `title` para el ratón.
 */

import { useCallback, useRef, useState } from "react";

import {
  duracionClip,
  formateaDuracion,
  formateaMs,
  type CategoriaCoding,
  type ClipCoding,
} from "@/lib/coding/modelo";

export function LineaDeTiempo({
  duracionMs,
  tiempoMs,
  inicioPendienteMs,
  clips,
  categorias,
  escenas,
  seleccionado,
  onSalta,
  onElegirClip,
  onElegirEscena,
}: {
  duracionMs: number;
  tiempoMs: number;
  inicioPendienteMs: number | null;
  clips: ClipCoding[];
  categorias: CategoriaCoding[];
  /** Las pizarras pintadas, como muescas doradas arriba. */
  escenas?: { id: string; tMs: number; nombre: string; dibujos: unknown[] }[];
  seleccionado: string | null;
  onSalta: (ms: number) => void;
  onElegirClip: (id: string) => void;
  onElegirEscena?: (id: string) => void;
}) {
  const barraRef = useRef<HTMLDivElement>(null);

  const [encima, setEncima] = useState<number | null>(null);

  const porcentaje = useCallback(
    (ms: number) => (duracionMs > 0 ? (ms / duracionMs) * 100 : 0),
    [duracionMs],
  );

  const msDeEvento = useCallback(
    (clientX: number) => {
      const barra = barraRef.current;

      if (!barra || duracionMs <= 0) return 0;

      const caja = barra.getBoundingClientRect();

      const proporcion = Math.min(
        1,
        Math.max(0, (clientX - caja.left) / caja.width),
      );

      return Math.round(proporcion * duracionMs);
    },
    [duracionMs],
  );

  const color = (clip: ClipCoding) =>
    categorias.find((una) => una.id === clip.categoriaId)?.color ?? "#C8A96B";

  return (
    <div className="min-w-0">
      <div
        ref={barraRef}
        role="slider"
        tabIndex={-1}
        aria-label="Línea de tiempo del partido"
        aria-valuemin={0}
        aria-valuemax={Math.round(duracionMs / 1000)}
        aria-valuenow={Math.round(tiempoMs / 1000)}
        onClick={(evento) => onSalta(msDeEvento(evento.clientX))}
        onMouseMove={(evento) => setEncima(msDeEvento(evento.clientX))}
        onMouseLeave={() => setEncima(null)}
        className="relative h-16 w-full cursor-pointer overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]"
      >
        {/* Los cinco minutos, para situarse sin contar. */}
        {duracionMs > 0 &&
          Array.from(
            { length: Math.floor(duracionMs / 300_000) },
            (_, indice) => (indice + 1) * 300_000,
          ).map((marca) => (
            <div
              key={marca}
              aria-hidden
              className="absolute top-0 h-full w-px bg-white/[0.06]"
              style={{ left: `${porcentaje(marca)}%` }}
            />
          ))}

        {/* Lo codificado. */}
        {clips.map((clip) => {
          const izquierda = porcentaje(clip.inicioMs);
          const ancho = Math.max(0.25, porcentaje(duracionClip(clip)));
          const activo = clip.id === seleccionado;

          return (
            <button
              key={clip.id}
              type="button"
              title={`${String(clip.numero).padStart(3, "0")} · ${clip.jugadorNombre}\n${
                categorias.find((una) => una.id === clip.categoriaId)?.nombre ??
                "Sin categoría"
              }\n${formateaMs(clip.codingInicioMs)} → ${formateaMs(clip.codingFinMs)} (${formateaDuracion(duracionClip(clip))})`}
              onClick={(evento) => {
                evento.stopPropagation();
                onElegirClip(clip.id);
              }}
              className="absolute bottom-2 top-2 rounded-sm transition-[filter] hover:brightness-125"
              style={{
                left: `${izquierda}%`,
                width: `${ancho}%`,
                backgroundColor: color(clip),
                opacity: activo ? 1 : 0.55,
                outline: activo ? "1px solid #FFFFFF" : "none",
              }}
            />
          );
        })}

        {/*
        | Las pizarras, en el borde de arriba.
        |
        | Van fuera de la banda de los clips —que ocupa de `top-2` a
        | `bottom-2`— porque no son lo mismo: un clip es un trozo de partido y
        | una pizarra es un instante dibujado encima. Mezcladas, la línea de
        | tiempo dejaba de leerse de un vistazo.
        */}
        {(escenas ?? []).map((escena) => (
          <button
            key={escena.id}
            type="button"
            title={`Pizarra · ${escena.nombre.trim() || formateaMs(escena.tMs)} (${escena.dibujos.length} dibujos)`}
            onClick={(evento) => {
              evento.stopPropagation();

              if (onElegirEscena) onElegirEscena(escena.id);
              else onSalta(escena.tMs);
            }}
            className="absolute top-0 h-2 w-1.5 -translate-x-1/2 rounded-b-sm bg-[#C8A96B] transition hover:h-3"
            style={{ left: `${porcentaje(escena.tMs)}%` }}
          />
        ))}

        {/* El tramo que se está marcando ahora mismo. */}
        {inicioPendienteMs !== null && (
          <div
            aria-hidden
            className="absolute bottom-0 top-0 border-x border-[#C8A96B] bg-[#C8A96B]/20"
            style={{
              left: `${porcentaje(inicioPendienteMs)}%`,
              width: `${Math.max(0.2, porcentaje(Math.max(0, tiempoMs - inicioPendienteMs)))}%`,
            }}
          />
        )}

        {/* Dónde va el vídeo. */}
        <div
          aria-hidden
          className="absolute bottom-0 top-0 w-0.5 bg-white"
          style={{ left: `${porcentaje(tiempoMs)}%` }}
        />

        {/* Dónde está el ratón. */}
        {encima !== null && (
          <div
            aria-hidden
            className="absolute bottom-0 top-0 w-px bg-white/30"
            style={{ left: `${porcentaje(encima)}%` }}
          />
        )}
      </div>

      <div className="mt-1.5 flex items-center justify-between text-[11px] tabular-nums text-white/35">
        <span>{formateaMs(tiempoMs)}</span>

        <span className="text-white/25">
          {encima !== null ? formateaMs(encima) : `${clips.length} clips`}
        </span>

        <span>{formateaMs(duracionMs)}</span>
      </div>
    </div>
  );
}
