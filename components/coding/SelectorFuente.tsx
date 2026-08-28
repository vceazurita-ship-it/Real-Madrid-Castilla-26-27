"use client";

/**
 * De dónde sale el vídeo del partido.
 *
 * Un partido de noventa minutos son varios gigas, así que la vía obvia —subir
 * el fichero desde el navegador— no existe aquí. Hay tres caminos, y la
 * pantalla dice de cada uno qué permite hacer, porque la diferencia es
 * importante:
 *
 * - **De la carpeta de partidos** de la máquina donde corre la app: se
 *   reproduce por trozos y ffmpeg corta sobre el mismo fichero. Es el camino
 *   completo.
 * - **De un enlace** (el bucket de Supabase, un vídeo con dirección directa):
 *   igual de completo, y el único que funciona con la app desplegada fuera.
 * - **Del ordenador**, abriendo el fichero: sirve para codificar ya mismo, sin
 *   mover nada, pero el servidor no ve ese fichero y por tanto no puede
 *   cortarlo. El coding se guarda igual; los cortes salen cuando el vídeo esté
 *   en la carpeta o en un enlace.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { FolderOpen, Link2, RefreshCw, Upload } from "lucide-react";

import { Button } from "@/components/abp/ui";
import type { FuenteVideo } from "@/lib/coding/modelo";

type VideoDePartido = {
  ruta: string;
  nombre: string;
  tamano: number;
  modificado: string;
};

type Carpeta = {
  carpeta: string;
  existe: boolean;
  ffmpeg: boolean;
  videos: VideoDePartido[];
};

const gigas = (bytes: number) => `${(bytes / 1024 ** 3).toFixed(2)} GB`;

export function SelectorFuente({
  fuente,
  onElegir,
}: {
  fuente: FuenteVideo | null;
  /** El segundo argumento es el `src` con el que reproducir. */
  onElegir: (fuente: FuenteVideo, src: string) => void;
}) {
  const [carpeta, setCarpeta] = useState<Carpeta | null>(null);
  const [cargando, setCargando] = useState(true);
  const [enlace, setEnlace] = useState("");

  /* Se sube uno para releer la carpeta: el botón no llama al efecto, lo pide. */
  const [relectura, setRelectura] = useState(0);

  const entrada = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let vivo = true;

    fetch("/api/coding/videos", { cache: "no-store" })
      .then((respuesta) => respuesta.json())
      .then((datos) => {
        if (!vivo) return;

        setCarpeta(
          datos?.ok
            ? {
                carpeta: datos.carpeta,
                existe: datos.existe,
                ffmpeg: datos.ffmpeg,
                videos: datos.videos ?? [],
              }
            : null,
        );

        setCargando(false);
      })
      .catch(() => {
        if (!vivo) return;

        setCarpeta(null);
        setCargando(false);
      });

    return () => {
      vivo = false;
    };
  }, [relectura]);

  const lee = useCallback(() => {
    setCargando(true);
    setRelectura((vuelta) => vuelta + 1);
  }, []);

  return (
    <div className="min-w-0 space-y-4">
      {/* ------------------------- LA CARPETA ------------------------- */}

      <div className="min-w-0">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-white/35">
            <FolderOpen size={13} className="text-[#C8A96B]" />
            Carpeta de partidos
          </p>

          <Button icon={RefreshCw} onClick={lee} disabled={cargando}>
            {cargando ? "Leyendo…" : "Actualizar"}
          </Button>
        </div>

        {carpeta && (
          <p className="mb-2 break-all text-[10px] text-white/25">
            {carpeta.carpeta}
            {!carpeta.existe && " · todavía no existe: créala y deja ahí los partidos"}
          </p>
        )}

        {carpeta && carpeta.videos.length > 0 ? (
          <ul className="max-h-56 space-y-1 overflow-y-auto pr-1">
            {carpeta.videos.map((video) => {
              const activo =
                fuente?.tipo === "archivo" && fuente.ruta === video.ruta;

              return (
                <li key={video.ruta}>
                  <button
                    type="button"
                    onClick={() =>
                      onElegir(
                        { tipo: "archivo", ruta: video.ruta, nombre: video.nombre },
                        `/api/coding/video?ruta=${encodeURIComponent(video.ruta)}`,
                      )
                    }
                    className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition ${
                      activo
                        ? "border-[#C8A96B]/60 bg-[#C8A96B]/[0.08]"
                        : "border-white/10 bg-white/[0.02] hover:border-white/25"
                    }`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12px] text-white/80">
                        {video.nombre}
                      </span>

                      <span className="block truncate text-[10px] text-white/30">
                        {video.ruta}
                      </span>
                    </span>

                    <span className="shrink-0 text-[10px] tabular-nums text-white/30">
                      {gigas(video.tamano)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          !cargando && (
            <p className="rounded-xl border border-dashed border-white/10 px-3 py-4 text-center text-[11px] leading-relaxed text-white/30">
              No hay vídeos en la carpeta. Deja ahí el partido —o apunta a otra
              con <code className="text-white/50">CODING_VIDEOS_DIR</code>— y
              pulsa Actualizar.
            </p>
          )
        )}

        {carpeta && !carpeta.ffmpeg && (
          <p className="mt-2 rounded-lg border border-amber-400/25 bg-amber-400/[0.07] px-3 py-2 text-[11px] leading-relaxed text-amber-200/80">
            En este servidor no está el motor de vídeo: se puede codificar y
            guardar, pero no cortar los clips.
          </p>
        )}
      </div>

      {/* -------------------------- EL ENLACE ------------------------- */}

      <div className="min-w-0">
        <p className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-white/35">
          <Link2 size={13} className="text-[#C8A96B]" />
          Desde un enlace
        </p>

        <div className="flex flex-wrap gap-2">
          <input
            value={enlace}
            onChange={(evento) => setEnlace(evento.target.value)}
            placeholder="https://…/partido.mp4"
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#C8A96B]/50"
          />

          <Button
            tone="primary"
            disabled={!/^https?:\/\//i.test(enlace.trim())}
            onClick={() => {
              const url = enlace.trim();

              onElegir(
                {
                  tipo: "url",
                  url,
                  nombre: decodeURIComponent(url.split("/").pop() ?? "partido"),
                },
                url,
              );
            }}
          >
            Usar el enlace
          </Button>
        </div>

        <p className="mt-1.5 text-[10px] leading-relaxed text-white/25">
          Tiene que ser el vídeo en sí, no la página que lo enseña: una URL de
          YouTube o de HUDL no se puede reproducir ni cortar desde aquí.
        </p>
      </div>

      {/* ------------------------ DEL ORDENADOR ----------------------- */}

      <div className="min-w-0">
        <p className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-white/35">
          <Upload size={13} className="text-[#C8A96B]" />
          Del ordenador
        </p>

        <Button icon={Upload} onClick={() => entrada.current?.click()}>
          Abrir un fichero
        </Button>

        <input
          ref={entrada}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(evento) => {
            const fichero = evento.target.files?.[0];

            if (!fichero) return;

            onElegir(
              { tipo: "local", nombre: fichero.name },
              URL.createObjectURL(fichero),
            );

            evento.target.value = "";
          }}
        />

        <p className="mt-1.5 text-[10px] leading-relaxed text-white/25">
          No se sube nada: el navegador lo lee del disco. El coding se guarda,
          pero los cortes no se pueden generar hasta que el vídeo esté en la
          carpeta de partidos o en un enlace.
        </p>
      </div>
    </div>
  );
}
