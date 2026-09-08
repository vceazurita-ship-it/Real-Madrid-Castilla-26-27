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
 *   igual de completo, y ffmpeg puede cortarlo desde donde esté la app.
 * - **Del ordenador**, abriendo el fichero: se codifica y **se monta el vídeo
 *   aquí mismo**, en el navegador (`lib/coding/navegador.ts`). No se sube
 *   nada, no hace falta servidor y funciona igual con la app desplegada. Es
 *   el camino de quien tiene el partido en su portátil, que es lo normal.
 *
 * Por eso el fichero abierto viaja hacia arriba junto con la fuente: la
 * pantalla lo guarda para montar los vídeos después sin volver a pedirlo.
 *
 * ---
 *
 * **Se pueden abrir varios de una vez.** Un partido llega casi siempre partido
 * —cada parte en un fichero, y a veces la cámara táctica aparte—, y hasta
 * ahora había que elegir uno, codificarlo, y elegir el otro encima: la línea
 * de tiempo se quedaba con los cortes del primero mezclados con los minutos
 * del segundo. Ahora la sesión guarda una LISTA de vídeos, cada clip se queda
 * con el suyo y se pasa de uno a otro con un toque. Por eso lo que sale de
 * aquí es siempre una lista, aunque traiga un elemento.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, FolderOpen, Layers, Link2, RefreshCw, Upload } from "lucide-react";

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

/** Un vídeo listo para abrir: qué es, con qué se reproduce y de dónde salió. */
export type VideoElegido = {
  fuente: FuenteVideo;
  /** Con qué `src` se reproduce. */
  src: string;
  /** El fichero del disco, sólo en el camino «del ordenador». */
  fichero?: File;
};

export function SelectorFuente({
  fuente,
  videos,
  onElegir,
}: {
  fuente: FuenteVideo | null;
  /** Los que ya están en la sesión, para no ofrecerlos como novedad. */
  videos?: FuenteVideo[];
  /** Los vídeos elegidos. El primero es el que se pone delante. */
  onElegir: (elegidos: VideoElegido[]) => void;
}) {
  const [carpeta, setCarpeta] = useState<Carpeta | null>(null);
  const [cargando, setCargando] = useState(true);
  const [enlace, setEnlace] = useState("");

  /* Se admiten varias direcciones pegadas de golpe, una por línea. */
  const enlaces = enlace
    .split(/[\s\n]+/)
    .map((trozo) => trozo.trim())
    .filter((trozo) => /^https?:\/\//i.test(trozo));

  /* Se sube uno para releer la carpeta: el botón no llama al efecto, lo pide. */
  const [relectura, setRelectura] = useState(0);

  const entrada = useRef<HTMLInputElement>(null);

  /* Los que ya están abiertos, para marcarlos en la lista de la carpeta. */
  const yaEstan = new Set((videos ?? []).map((video) => video.nombre));

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

          <span className="flex flex-wrap items-center gap-2">
            {(carpeta?.videos.length ?? 0) > 1 && (
              <Button
                icon={Layers}
                onClick={() =>
                  onElegir(
                    (carpeta?.videos ?? []).map((video) => ({
                      fuente: {
                        tipo: "archivo" as const,
                        ruta: video.ruta,
                        nombre: video.nombre,
                      },
                      src: `/api/coding/video?ruta=${encodeURIComponent(video.ruta)}`,
                    })),
                  )
                }
                title="Abrir todos los vídeos de la carpeta en esta sesión"
              >
                Abrir los {carpeta?.videos.length}
              </Button>
            )}

            <Button icon={RefreshCw} onClick={lee} disabled={cargando}>
              {cargando ? "Leyendo…" : "Actualizar"}
            </Button>
          </span>
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
                      onElegir([
                        {
                          fuente: {
                            tipo: "archivo",
                            ruta: video.ruta,
                            nombre: video.nombre,
                          },
                          src: `/api/coding/video?ruta=${encodeURIComponent(video.ruta)}`,
                        },
                      ])
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

                    {yaEstan.has(video.nombre) && !activo && (
                      <span
                        className="shrink-0 text-[#C8A96B]"
                        title="Ya está abierto en esta sesión"
                      >
                        <Check size={12} />
                      </span>
                    )}

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
            disabled={enlaces.length === 0}
            onClick={() => {
              onElegir(
                enlaces.map((url) => ({
                  fuente: {
                    tipo: "url" as const,
                    url,
                    nombre: decodeURIComponent(url.split("/").pop() ?? "partido"),
                  },
                  src: url,
                })),
              );

              setEnlace("");
            }}
          >
            {enlaces.length > 1 ? `Usar los ${enlaces.length}` : "Usar el enlace"}
          </Button>
        </div>

        <p className="mt-1.5 text-[10px] leading-relaxed text-white/25">
          Tiene que ser el vídeo en sí, no la página que lo enseña: una URL de
          YouTube o de HUDL no se puede reproducir ni cortar desde aquí. Se
          pueden pegar varias de una vez, una por línea.
        </p>
      </div>

      {/* ------------------------ DEL ORDENADOR ----------------------- */}

      <div className="min-w-0">
        <p className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-white/35">
          <Upload size={13} className="text-[#C8A96B]" />
          Del ordenador
        </p>

        <Button icon={Upload} onClick={() => entrada.current?.click()}>
          Abrir ficheros
        </Button>

        <input
          ref={entrada}
          type="file"
          accept="video/*"
          /* Varios de una vez: las dos partes de un partido se abren juntas. */
          multiple
          className="hidden"
          onChange={(evento) => {
            const ficheros = [...(evento.target.files ?? [])];

            if (ficheros.length === 0) return;

            onElegir(
              ficheros.map((fichero) => ({
                fuente: { tipo: "local" as const, nombre: fichero.name },
                src: URL.createObjectURL(fichero),
                fichero,
              })),
            );

            evento.target.value = "";
          }}
        />

        <p className="mt-1.5 text-[10px] leading-relaxed text-white/25">
          Se pueden abrir varios a la vez —las dos partes, la cámara táctica—:
          quedan todos en la sesión y se pasa de uno a otro con un toque, cada
          uno con sus cortes. No se sube nada: el navegador los lee del disco.
          Se codifica y se montan los vídeos aquí mismo —a tiempo real, con la
          pantalla delante, y salen en .webm con sonido—, así que funciona
          igual con la app abierta desde internet. Al recargar hay que volver a
          abrirlos: el navegador no guarda el permiso.
        </p>
      </div>
    </div>
  );
}
