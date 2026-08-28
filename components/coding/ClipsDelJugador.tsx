"use client";

/**
 * Los cortes de un jugador, dentro de su ficha.
 *
 * El coding vive en su pantalla, pero el sitio donde se consulta el trabajo de
 * un jugador es su ficha: aquí aparecen todos sus cortes de todos los partidos
 * codificados, sin que nadie tenga que copiarlos ni volver a subirlos. Es la
 * misma información —el documento de cada sesión—, leída por jugador en vez de
 * por partido.
 *
 * Lo que se puede hacer sin salir de la ficha:
 *
 * - **Verlos**, saltando al coding en el minuto exacto.
 * - **Elegir unos cuantos** y bajarse el vídeo con todos pegados, con la
 *   carátula del club delante. Es el vídeo que se le enseña al jugador.
 * - **Bajarse los cortes sueltos** en un ZIP.
 *
 * Sirve igual para los nuestros y para un rival: lo único que cambia es lo que
 * lleva la carátula, y eso lo decide quien monta el componente.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Film, Package, Scissors, SquareCheck, SquareDashed } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/abp/ui";
import { descarga } from "@/lib/export/lienzos";
import { caratulaDeJugador, type DatosCaratula } from "@/lib/coding/portada";
import {
  apodoCoding,
  duracionClip,
  formateaDuracion,
  formateaMs,
  formateaTotal,
  type ClipCoding,
  type FuenteVideo,
} from "@/lib/coding/modelo";

type ClipConPartido = ClipCoding & {
  /** La clave del documento del que sale: distingue dos clips con el mismo id. */
  sesion: string;
  sesionTitulo: string;
  ambito: string;
  fuente: FuenteVideo | null;
  enlace: string;
};

export function ClipsDelJugador({
  jugadorId,
  caratula,
  ambito,
}: {
  jugadorId: string;
  /** Con qué se pinta la portada del vídeo unificado. */
  caratula: DatosCaratula;
  /** Limita la búsqueda: los cortes de nuestros partidos o los de rival. */
  ambito?: "partido" | "rival";
}) {
  const [clips, setClips] = useState<ClipConPartido[]>([]);
  const [cargando, setCargando] = useState(true);
  const [elegidos, setElegidos] = useState<string[]>([]);
  const [trabajando, setTrabajando] = useState(false);

  useEffect(() => {
    if (!jugadorId) return;

    let vivo = true;

    const parametros = new URLSearchParams({ jugador: jugadorId });

    if (ambito) parametros.set("ambito", ambito);

    fetch(`/api/coding/sesiones?${parametros.toString()}`, {
      cache: "no-store",
    })
      .then((respuesta) => respuesta.json())
      .then((datos) => {
        if (!vivo) return;

        setClips(datos?.ok ? (datos.clips ?? []) : []);
        setCargando(false);
      })
      .catch(() => {
        if (!vivo) return;

        setClips([]);
        setCargando(false);
      });

    return () => {
      vivo = false;
    };
  }, [ambito, jugadorId]);

  const seleccionados = useMemo(
    () =>
      elegidos.length > 0
        ? clips.filter((clip) => elegidos.includes(clip.id))
        : clips,
    [clips, elegidos],
  );

  const exporta = useCallback(
    async (formato: "unificado" | "zip") => {
      const lista = seleccionados.filter((clip) => clip.fuente);

      if (lista.length === 0) {
        toast.error(
          "Estos cortes no tienen un vídeo que el servidor pueda leer.",
        );
        return;
      }

      setTrabajando(true);

      const aviso = toast.loading(
        formato === "unificado"
          ? `Montando el vídeo con ${lista.length} cortes…`
          : `Cortando ${lista.length} clips…`,
      );

      try {
        const portada =
          formato === "unificado" ? await caratulaDeJugador(caratula) : null;

        const respuesta = await fetch("/api/coding/export", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            modo: "preciso",
            formato,
            nombre: `${apodoCoding(caratula.nombre)}-cortes`,
            portada: portada ?? undefined,
            portadaSegundos: 4,
            clips: lista.map((clip) => ({
              nombre: `${apodoCoding(clip.sesionTitulo)}/${String(clip.numero).padStart(3, "0")}`,
              inicioMs: clip.inicioMs,
              finMs: clip.finMs,
              fuente:
                clip.fuente?.tipo === "url"
                  ? { tipo: "url", url: clip.fuente.url }
                  : clip.fuente?.tipo === "archivo"
                    ? { tipo: "archivo", ruta: clip.fuente.ruta }
                    : undefined,
            })),
          }),
        });

        if (!respuesta.ok) {
          const error = await respuesta.json().catch(() => null);

          throw new Error(
            error?.error ?? `El servidor respondió ${respuesta.status}`,
          );
        }

        descarga(
          await respuesta.blob(),
          `${apodoCoding(caratula.nombre)}-cortes.${formato === "zip" ? "zip" : "mp4"}`,
        );

        toast.success("Listo", { id: aviso });
      } catch (error) {
        console.error("[clips del jugador]", error);

        toast.error(
          error instanceof Error ? error.message : "No se ha podido exportar.",
          { id: aviso },
        );
      } finally {
        setTrabajando(false);
      }
    },
    [caratula, seleccionados],
  );

  if (cargando) {
    return (
      <p className="py-4 text-center text-xs text-white/30">
        Buscando cortes del coding…
      </p>
    );
  }

  if (clips.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-white/10 px-4 py-6 text-center text-[11px] leading-relaxed text-white/30">
        Todavía no hay cortes de este jugador. Se crean solos al codificar un
        partido en{" "}
        <Link href="/coding" className="text-[#C8A96B] hover:underline">
          Coding de partido
        </Link>
        .
      </p>
    );
  }

  const total = seleccionados.reduce(
    (suma, clip) => suma + duracionClip(clip),
    0,
  );

  return (
    <div className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          tone="primary"
          icon={Film}
          disabled={trabajando}
          onClick={() => void exporta("unificado")}
          title="Todos los cortes elegidos en un solo vídeo, con la carátula delante"
        >
          Vídeo unificado
        </Button>

        <Button
          icon={Package}
          disabled={trabajando}
          onClick={() => void exporta("zip")}
        >
          Cortes sueltos (ZIP)
        </Button>

        <Button
          icon={elegidos.length > 0 ? SquareCheck : SquareDashed}
          onClick={() =>
            setElegidos((actual) =>
              actual.length > 0 ? [] : clips.map((clip) => clip.id),
            )
          }
        >
          {elegidos.length > 0 ? "Todos" : "Elegir"}
        </Button>

        <span className="text-[11px] text-white/35">
          {seleccionados.length} de {clips.length} · {formateaTotal(total)}
        </span>
      </div>

      <ul className="max-h-80 space-y-1 overflow-y-auto pr-1">
        {clips.map((clip) => {
          const marcado = elegidos.includes(clip.id);

          return (
            <li
              key={`${clip.sesion}-${clip.id}`}
              className={`flex min-w-0 items-center gap-2.5 rounded-xl border px-2.5 py-1.5 transition ${
                marcado
                  ? "border-[#C8A96B]/50 bg-[#C8A96B]/[0.07]"
                  : "border-white/10 bg-white/[0.02]"
              }`}
            >
              <button
                type="button"
                onClick={() =>
                  setElegidos((actual) =>
                    actual.includes(clip.id)
                      ? actual.filter((uno) => uno !== clip.id)
                      : [...actual, clip.id],
                  )
                }
                className="shrink-0 text-white/40 transition hover:text-white"
                title={marcado ? "Quitar de la selección" : "Añadir a la selección"}
              >
                {marcado ? <SquareCheck size={15} /> : <SquareDashed size={15} />}
              </button>

              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px] text-white/75">
                  {clip.sesionTitulo}
                </span>

                <span className="block truncate text-[10px] tabular-nums text-white/30">
                  {formateaMs(clip.codingInicioMs)} ·{" "}
                  {formateaDuracion(duracionClip(clip))}
                  {clip.nota ? ` · ${clip.nota}` : ""}
                </span>
              </span>

              <Link
                href={clip.enlace}
                title="Abrir el coding de ese partido"
                className="shrink-0 rounded-lg p-1.5 text-white/35 transition hover:bg-white/[0.08] hover:text-white"
              >
                <Scissors size={13} />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
