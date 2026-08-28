"use client";

/**
 * Convertir el coding en vídeo.
 *
 * Aquí no se guardan marcas de tiempo: se llama a ffmpeg en el servidor y
 * salen ficheros. Tres salidas, que son las tres formas en las que el cuerpo
 * técnico usa un partido codificado:
 *
 * - **Un ZIP** con los cortes ordenados en carpetas por jugador, para dejarlos
 *   en la unidad compartida.
 * - **Un vídeo unificado** con todos los cortes pegados y la carátula del
 *   jugador delante: es el que se manda al jugador o se pone en la charla.
 * - **Un corte suelto**, desde la lista de clips.
 *
 * El vídeo del partido no se sube ni se copia: el servidor lee de la carpeta
 * de partidos, o de la URL, sólo los segundos de cada clip.
 */

import { useCallback, useState } from "react";
import { Film, Package } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/abp/ui";
import { descarga } from "@/lib/export/lienzos";
import {
  duracionClip,
  formateaTotal,
  nombreDeClip,
  rutaDeClip,
  type CategoriaCoding,
  type ClipCoding,
  type FuenteVideo,
} from "@/lib/coding/modelo";

export type ModoCorteUI = "preciso" | "rapido";

/** Lo que la pantalla necesita saber para pedir una exportación. */
export type PeticionExport = {
  clips: ClipCoding[];
  formato: "clip" | "zip" | "unificado";
  nombre: string;
  /** Carátula en `data:` URL para el vídeo unificado. */
  portada?: string | null;
};

export function useExportador(opciones: {
  fuente: FuenteVideo | null;
  categorias: CategoriaCoding[];
  carpeta: string;
  modo: ModoCorteUI;
}) {
  const { fuente, categorias, carpeta, modo } = opciones;

  const [exportando, setExportando] = useState(false);

  const exporta = useCallback(
    async (peticion: PeticionExport) => {
      if (exportando) return;

      if (!fuente) {
        toast.error("Elige antes el vídeo del partido.");
        return;
      }

      if (fuente.tipo === "local") {
        toast.error(
          "El vídeo está abierto desde tu ordenador y el servidor no puede leerlo. " +
            "Déjalo en la carpeta de partidos o usa un enlace para poder cortar.",
        );
        return;
      }

      if (peticion.clips.length === 0) {
        toast.error("No hay clips que exportar.");
        return;
      }

      setExportando(true);

      const aviso = toast.loading(
        peticion.formato === "unificado"
          ? `Montando el vídeo de ${peticion.clips.length} cortes…`
          : `Cortando ${peticion.clips.length} ${peticion.clips.length === 1 ? "clip" : "clips"}…`,
      );

      try {
        const respuesta = await fetch("/api/coding/export", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fuente:
              fuente.tipo === "url"
                ? { tipo: "url", url: fuente.url }
                : { tipo: "archivo", ruta: fuente.ruta },
            modo,
            formato: peticion.formato,
            nombre: peticion.nombre,
            portada: peticion.portada ?? undefined,
            portadaSegundos: 4,
            clips: peticion.clips.map((clip) => ({
              nombre:
                peticion.formato === "zip"
                  ? rutaDeClip(clip, categorias, carpeta)
                      .replace(/\.mp4$/, "")
                      .replace(`${carpeta}/`, "")
                  : nombreDeClip(clip, categorias),
              inicioMs: clip.inicioMs,
              finMs: clip.finMs,
            })),
          }),
        });

        if (!respuesta.ok) {
          const error = await respuesta.json().catch(() => null);

          throw new Error(error?.error ?? `El servidor respondió ${respuesta.status}`);
        }

        const blob = await respuesta.blob();

        const extension = peticion.formato === "zip" ? "zip" : "mp4";

        descarga(blob, `${peticion.nombre}.${extension}`);

        toast.success("Vídeo listo", { id: aviso });
      } catch (error) {
        console.error("[coding] exportación", error);

        toast.error(
          error instanceof Error ? error.message : "No se ha podido exportar.",
          { id: aviso },
        );
      } finally {
        setExportando(false);
      }
    },
    [carpeta, categorias, exportando, fuente, modo],
  );

  return { exporta, exportando };
}

/* ------------------------------------------------------------------ */
/*  LOS BOTONES                                                        */
/* ------------------------------------------------------------------ */

export function BarraExportacion({
  clips,
  etiqueta,
  exportando,
  modo,
  onModo,
  onZip,
  onUnificado,
}: {
  clips: ClipCoding[];
  /** Qué se va a exportar: "todos", "Sergio Mestre", "Pase"… */
  etiqueta: string;
  exportando: boolean;
  modo: ModoCorteUI;
  onModo: (modo: ModoCorteUI) => void;
  onZip: () => void;
  onUnificado: () => void;
}) {
  const total = clips.reduce((suma, clip) => suma + duracionClip(clip), 0);

  return (
    <div className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          tone="primary"
          icon={Film}
          onClick={onUnificado}
          disabled={exportando || clips.length === 0}
          title="Todos los cortes pegados en un vídeo, con la carátula del jugador delante"
        >
          Vídeo unificado
        </Button>

        <Button
          icon={Package}
          onClick={onZip}
          disabled={exportando || clips.length === 0}
          title="Un fichero por corte, en carpetas por jugador"
        >
          Clips sueltos (ZIP)
        </Button>

        <span className="text-[11px] text-white/35">
          {clips.length} {clips.length === 1 ? "clip" : "clips"} ·{" "}
          {formateaTotal(total)} · {etiqueta}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] uppercase tracking-[0.16em] text-white/30">
          Corte
        </span>

        {(
          [
            ["preciso", "Preciso", "Vuelve a codificar: empieza en el fotograma exacto."],
            ["rapido", "Rápido", "Copia sin recodificar: instantáneo, pero corta en el fotograma clave más cercano."],
          ] as const
        ).map(([valor, texto, ayuda]) => (
          <button
            key={valor}
            type="button"
            title={ayuda}
            onClick={() => onModo(valor)}
            className={`rounded-full border px-2.5 py-1 text-[11px] transition ${
              modo === valor
                ? "border-[#C8A96B] bg-[#C8A96B]/10 text-[#C8A96B]"
                : "border-white/10 text-white/40 hover:text-white"
            }`}
          >
            {texto}
          </button>
        ))}
      </div>
    </div>
  );
}
