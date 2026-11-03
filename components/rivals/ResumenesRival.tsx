"use client";

/**
 * «Resúmenes de sus partidos» en la ficha del rival (03/11/2026).
 *
 * Cada partido de liga del rival con su resumen oficial en el canal de la RFEF:
 * jornada, contra quién, dónde, el resultado y la fecha, y un toque abre el
 * vídeo en YouTube en otra pestaña. Del más reciente al más antiguo.
 *
 * Los vídeos los da `/api/rivals/resumenes` (cacheado en el servidor; aquí se
 * piden una vez por pestaña) y el cruce lo hace `lib/rivals/resumenes-rfef.ts`
 * con los nombres del informe de BeSoccer, que la pantalla ya ha bajado. Un
 * partido sin resumen no se nombra; si no hay ninguno, o YouTube ha fallado,
 * el bloque no sale.
 */

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, House, Plane, Play } from "lucide-react";

import { useRivalInforme } from "@/hooks/useRivalInforme";
import { findInforme } from "@/lib/rivals/informe";
import { equiposDelGrupo, resumenesDe, type ResumenDelEquipo, type ResumenRfef } from "@/lib/rivals/resumenes-rfef";
import { chipInk } from "@/lib/theme";

const COLOR = { G: "#34D399", E: "#C8A96B", P: "#F87171" } as const;
const LETRA = { G: "V", E: "E", P: "D" } as const;
const PALABRA = { G: "Ganó", E: "Empató", P: "Perdió" } as const;

/** Los que se ven sin desplegar: dos filas en el portátil. */
const A_LA_VISTA = 6;

/* La descarga en curso —o ya terminada—, viva mientras dure la pestaña. */
let enVuelo: Promise<ResumenRfef[] | null> | null = null;

function cargaResumenes() {
  enVuelo ??= (async () => {
    try {
      const respuesta = await fetch("/api/rivals/resumenes");

      const cuerpo = (await respuesta.json()) as { ok?: boolean; videos?: ResumenRfef[] };

      if (!respuesta.ok || !cuerpo?.ok || !Array.isArray(cuerpo.videos)) throw new Error("sin resúmenes");

      return cuerpo.videos;
    } catch (error) {
      console.error("[rivals] resúmenes", error);

      /* Un fallo no se guarda: la siguiente visita a la ficha lo vuelve a intentar. */
      enVuelo = null;

      return null;
    }
  })();

  return enVuelo;
}

/** «01/11». */
function fechaCorta(iso: string) {
  const dia = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);

  return dia ? `${dia[3]}/${dia[2]}` : "";
}

/** «3:32». */
function duracion(segundos: number) {
  if (!segundos) return "";

  const m = Math.floor(segundos / 60);
  const s = String(segundos % 60).padStart(2, "0");

  return `${m}:${s}`;
}

export default function ResumenesRival({ equipo }: { equipo: string }) {
  const { doc } = useRivalInforme({ alEntrar: true });

  const [videos, setVideos] = useState<ResumenRfef[] | null>(null);

  const [todos, setTodos] = useState(false);

  useEffect(() => {
    let vivo = true;

    void cargaResumenes().then((lista) => {
      if (vivo) setVideos(lista);
    });

    return () => {
      vivo = false;
    };
  }, []);

  const resumenes = useMemo<ResumenDelEquipo[]>(() => {
    const informe = findInforme(doc, equipo);

    if (!videos?.length || !informe) return [];

    return resumenesDe(videos, informe.id, equiposDelGrupo(doc), informe.partidos);
  }, [doc, equipo, videos]);

  if (!resumenes.length) return null;

  const visibles = todos ? resumenes : resumenes.slice(0, A_LA_VISTA);

  return (
    <section
      aria-label={`Resúmenes de los partidos de ${equipo}`}
      className="mt-4 min-w-0 rounded-2xl border border-white/10 bg-white/[0.025] p-3 sm:p-4"
    >
      <header className="mb-3 flex min-w-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="min-w-0 truncate text-xs font-semibold uppercase tracking-[0.25em] text-[#C8A96B]">
          Resúmenes de sus partidos
        </h2>

        <p className="shrink-0 text-[11px] text-white/45">
          {resumenes.length} {resumenes.length === 1 ? "partido" : "partidos"} · canal de la RFEF en YouTube
        </p>
      </header>

      <ul className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {visibles.map((r) => {
          const suyos = r.enCasa ? r.golesLocal : r.golesVisitante;
          const otros = r.enCasa ? r.golesVisitante : r.golesLocal;
          const fecha = fechaCorta(r.fecha);
          const dura = duracion(r.segundos);

          const detalle = [r.jornada ? `Jornada ${r.jornada}` : "", fecha, r.enCasa ? "en casa" : "fuera"].filter(Boolean).join(", ");

          return (
            <li key={r.id} className="min-w-0">
              <a
                href={`https://www.youtube.com/watch?v=${r.id}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Ver en YouTube el resumen: ${PALABRA[r.resultado]} ${suyos}-${otros} contra ${r.rival.nombre} (${detalle})`}
                className="group flex min-w-0 items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-2 transition hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C8A96B]"
              >
                {/* La miniatura del vídeo: un negro de foto en los dos temas. */}
                <span className="relative w-24 shrink-0 overflow-hidden rounded-lg sm:w-28">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`https://i.ytimg.com/vi/${r.id}/mqdefault.jpg`}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="aspect-video w-full object-cover"
                  />

                  <span aria-hidden className="absolute inset-0 flex items-center justify-center">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#C8A96B] text-black shadow transition group-hover:scale-110">
                      <Play size={13} className="translate-x-[1px]" fill="currentColor" />
                    </span>
                  </span>

                  {dura && (
                    <span
                      aria-hidden
                      className="absolute bottom-1 right-1 rounded px-1 text-[10px] font-semibold tabular-nums leading-4"
                      style={{ background: "rgba(0,0,0,0.75)", color: "#fff" }}
                    >
                      {dura}
                    </span>
                  )}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex min-w-0 items-center gap-1.5 text-[11px] text-white/55">
                    {r.enCasa ? <House size={11} aria-hidden className="shrink-0" /> : <Plane size={11} aria-hidden className="shrink-0" />}
                    <span className="truncate">
                      {[r.jornada ? `J${r.jornada}` : "", fecha, r.enCasa ? "en casa" : "fuera"].filter(Boolean).join(" · ")}
                    </span>
                  </span>

                  <span className="mt-0.5 block truncate text-sm font-semibold text-white/90" title={r.rival.nombre}>
                    vs {r.rival.nombre}
                  </span>

                  <span className="mt-1 flex items-center gap-2">
                    <span
                      className="rounded-md border px-1.5 text-[12px] font-bold tabular-nums leading-5"
                      style={{
                        background: `${COLOR[r.resultado]}26`,
                        color: chipInk(COLOR[r.resultado]),
                        borderColor: `${COLOR[r.resultado]}88`,
                      }}
                      title={`${PALABRA[r.resultado]}; sus goles primero`}
                    >
                      {LETRA[r.resultado]} {suyos}-{otros}
                    </span>

                    <span className="text-[11px] text-white/45 transition group-hover:text-[#C8A96B]">Ver resumen</span>
                  </span>
                </span>
              </a>
            </li>
          );
        })}
      </ul>

      {resumenes.length > A_LA_VISTA && (
        <button
          type="button"
          onClick={() => setTodos((abierto) => !abierto)}
          aria-expanded={todos}
          className="mt-3 inline-flex items-center gap-1.5 text-[12px] text-[#C8A96B] transition hover:text-white"
        >
          <ChevronDown size={14} className={`transition-transform ${todos ? "rotate-180" : ""}`} />
          {todos ? "Ver sólo los últimos" : `Ver los ${resumenes.length}`}
        </button>
      )}
    </section>
  );
}
