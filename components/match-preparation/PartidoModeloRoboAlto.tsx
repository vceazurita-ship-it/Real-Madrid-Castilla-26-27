"use client";

/**
 * PARTIDO MODELO: QUIÉN YA LE HIZO DAÑO ROBÁNDOLE ALTO (19/11/2026, idea de X).
 *
 * En el análisis del rival del Plan de partido: una fila por cada partido suyo
 * de la temporada con lo que hizo el equipo de enfrente: robos en el último
 * tercio, remates en los 10 s siguientes y el resultado. Ordenada por
 * remates tras robo alto y con el «partido modelo» arriba, con su vídeo si
 * ya está en los vídeos del rival (por el nombre del oponente) o, si hubo
 * goles, el pop-up de los goles de ese partido. Debajo, la lectura frente a
 * la media de la liga y el sello.
 *
 * Datos: `opta:equipos`, `opta:partidos`, `opta:directo:archivo` y
 * `opta:directo:<partido>` por `useDocsOpta`; los vídeos, del documento
 * `rival-media:<id>` (sólo se lee). Cuentas en `lib/match-preparation/robo-alto.ts`.
 * Nada se pide hasta que asoma; sin dato no se pinta.
 */

import { useEffect, useMemo, useState } from "react";
import { PlayCircle } from "lucide-react";

import { BotonGolesEnVideo } from "@/components/rivals/BotonGolesEnVideo";
import { useAsoma } from "@/hooks/useAsoma";
import { useDocsOpta } from "@/hooks/useDocsOpta";
import { aObjetos, num, DOCS_OPTA, type TablaOpta } from "@/lib/opta";
import { casaEquipo } from "@/lib/opta-eventos";
import { leeEventos } from "@/lib/opta-directo-mapas";
import { desnuda } from "@/lib/rivals/youtube-listas";
import { enlaceAbrible, normalizarMedia, rivalMediaKey, type MediaItem } from "@/lib/rivals/media";
import {
  danoRoboAlto,
  lectura,
  modeloDe,
  ordena,
  referencia,
  resultado,
  VENTANA_S,
  type FilaRoboAlto,
} from "@/lib/match-preparation/robo-alto";

type PartidoArchivo = { partido?: string; fecha?: string; equipos?: string[]; goles?: (number | null)[] };
type Archivo = { partidos?: PartidoArchivo[]; actualizado?: string };
type DocDirecto = { eventos?: TablaOpta };

const ORO = "#C8A96B";
const COLOR_SIGNO = { G: "#2E9E5B", E: "#8A8F98", P: "#D0453F" } as const;

export function PartidoModeloRoboAlto({ equipo, rivalId }: { equipo: string; rivalId: string }) {
  const { caja, abierto } = useAsoma<HTMLDivElement>(2500);
  return <div ref={caja} className="min-w-0">{abierto && equipo && <Indice equipo={equipo} rivalId={rivalId} />}</div>;
}

function Indice({ equipo, rivalId }: { equipo: string; rivalId: string }) {
  const { docs } = useDocsOpta<[TablaOpta, TablaOpta, Archivo]>(DOCS_OPTA.equipos, DOCS_OPTA.partidos, "opta:directo:archivo");
  const [tEquipos, tPartidos, archivo] = docs;

  const equipos = useMemo(
    () => (tEquipos ? aObjetos(tEquipos).map((f) => ({ teamId: String(f.teamId ?? ""), equipo: String(f.equipo ?? "") })) : []),
    [tEquipos],
  );
  const rival = useMemo(() => {
    const id = equipos.length ? casaEquipo(equipo, equipos) : null;
    return id ? { id, nombre: equipos.find((e) => e.teamId === id)?.equipo || equipo } : null;
  }, [equipos, equipo]);

  const partidos = useMemo(
    () =>
      rival && Array.isArray(archivo?.partidos)
        ? archivo.partidos.filter((p) => p?.partido && (p.equipos ?? []).includes(rival.nombre))
        : [],
    [archivo, rival],
  );
  if (!rival || !partidos.length) return null;
  return <Bloque equipo={equipo} rival={rival} partidos={partidos} archivo={archivo} tPartidos={tPartidos} rivalId={rivalId} />;
}

/** Palabras que no distinguen a un club en el nombre de un vídeo. */
const VACIAS = new Set(["club", "real", "deportivo", "deportiva", "atletico", "sociedad", "union", "futbol", "cf", "cd", "ud", "sd", "sad", "fc", "rc", "rcd", "ad", "b", "de", "del", "la", "el", "los", "las", "y", "vs", "partido", "jornada", "completo"]);
const distintivas = (n: string) => desnuda(n).split(" ").filter((w) => w.length > 2 && !VACIAS.has(w));

function videoDe(videos: MediaItem[], oponente: string): MediaItem | null {
  const p = distintivas(oponente);
  if (!p.length) return null;
  return videos.find((v) => {
    const w = new Set(desnuda(v.nombre).split(" "));
    return p.some((x) => w.has(x));
  }) ?? null;
}

function useVideosDelRival(rivalId: string) {
  const [videos, setVideos] = useState<{ id: string; lista: MediaItem[] } | null>(null);
  useEffect(() => {
    if (!rivalId) return;
    let vivo = true;
    fetch(`/api/docs?key=${encodeURIComponent(rivalMediaKey(rivalId))}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { data?: unknown } | null) => {
        if (vivo) setVideos({ id: rivalId, lista: normalizarMedia(j?.data).videos });
      })
      .catch(() => {
        if (vivo) setVideos({ id: rivalId, lista: [] });
      });
    return () => {
      vivo = false;
    };
  }, [rivalId]);
  return videos?.id === rivalId ? videos.lista : [];
}

function Bloque({
  equipo,
  rival,
  partidos,
  archivo,
  tPartidos,
  rivalId,
}: {
  equipo: string;
  rival: { id: string; nombre: string };
  partidos: PartidoArchivo[];
  archivo: Archivo | null;
  tPartidos: TablaOpta | null;
  rivalId: string;
}) {
  const ids = useMemo(() => partidos.map((p) => String(p.partido)), [partidos]);
  const { docs, cargando } = useDocsOpta<DocDirecto[]>(...ids.map(DOCS_OPTA.directo));
  const videos = useVideosDelRival(rivalId);

  /* PosWonA3rd por partido y equipo, y la media de todos los del archivo. */
  const { posWon, liga } = useMemo(() => {
    const enArchivo = new Set((archivo?.partidos ?? []).map((p) => String(p?.partido ?? "")));
    const mapa = new Map<string, number>();
    const todos: number[] = [];
    for (const f of tPartidos ? aObjetos(tPartidos) : []) {
      const v = num(f.PosWonA3rd);
      const p = String(f.partido ?? "");
      if (v == null || !p) continue;
      mapa.set(`${p}|${String(f.teamId ?? "")}`, v);
      if (enArchivo.has(p)) todos.push(v);
    }
    return { posWon: mapa, liga: todos };
  }, [tPartidos, archivo]);

  const filas = useMemo(() => {
    const salida: FilaRoboAlto[] = [];
    docs.forEach((d, i) => {
      const ev = leeEventos(d?.eventos);
      if (!ev.length) return;
      const p = partidos[i];
      const oponenteId = ev.find((e) => e.teamId && e.teamId !== rival.id)?.teamId ?? "";
      if (!oponenteId) return;
      const eqs = p.equipos ?? [];
      const iRival = eqs.indexOf(rival.nombre);
      const iOp = iRival === 0 ? 1 : 0;
      const g = (k: number) => (typeof p.goles?.[k] === "number" ? (p.goles[k] as number) : null);
      salida.push({
        ...danoRoboAlto(ev, oponenteId),
        partido: ids[i],
        fecha: String(p.fecha ?? "").slice(0, 10),
        oponente: eqs[iOp] ?? "",
        oponenteId,
        golesOponente: g(iOp),
        golesRival: g(iRival),
        posWonA3rd: posWon.get(`${ids[i]}|${oponenteId}`) ?? null,
      });
    });
    return ordena(salida);
  }, [docs, partidos, ids, rival.id, rival.nombre, posWon]);

  if (!filas.length) return cargando ? <p className="mt-6 text-xs text-white/45">Cargando el evento a evento de Opta…</p> : null;

  const modelo = modeloDe(filas);
  const ref = referencia(filas, liga);
  const texto = lectura(equipo, filas, ref);
  const hasta = filas.reduce((m, f) => (f.fecha > m ? f.fecha : m), "");
  const fechaCorta = (iso: string) => (iso ? iso.split("-").reverse().slice(0, 2).join("/") : "");
  const maxRem = Math.max(1, ...filas.map((f) => f.remates));

  return (
    <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-sm font-semibold">Partido modelo · quién ya le hizo daño robándole alto</p>
      <p className="mt-1 text-xs text-white/55">
        Por cada partido de {equipo}, lo que hizo el equipo de enfrente: balones robados en su último tercio y remates en los {VENTANA_S} s siguientes.
      </p>

      {modelo && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3" style={{ borderColor: `${ORO}66`, background: `${ORO}12` }}>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: ORO }}>
              Partido modelo
            </p>
            <p className="text-sm font-semibold text-white/90">
              {modelo.oponente} · {fechaCorta(modelo.fecha)}
              {resultado(modelo) ? ` · ${resultado(modelo)!.texto}` : ""}
            </p>
            <p className="text-xs text-white/60">
              {modelo.robos} robos altos, {modelo.remates} {modelo.remates === 1 ? "remate" : "remates"} tras robo
              {modelo.goles ? `, ${modelo.goles} ${modelo.goles === 1 ? "gol" : "goles"}` : ""}
            </p>
          </div>
          <EnlaceVideo fila={modelo} videos={videos} equipo={equipo} />
        </div>
      )}

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[420px] text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-white/45">
              <th className="py-1.5 pr-2 font-semibold">Su rival</th>
              <th className="px-2 py-1.5 text-right font-semibold" title="Recuperaciones e intercepciones en el último tercio (x ≥ 66,7 de Opta)">
                Robos altos
              </th>
              <th className="px-2 py-1.5 font-semibold" title={`Remates en los ${VENTANA_S} s siguientes a un robo alto`}>
                Remates tras robo
              </th>
              <th className="py-1.5 pl-2 text-right font-semibold" title="Goles de su rival – goles de él">
                Resultado
              </th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => {
              const r = resultado(f);
              const esModelo = modelo?.partido === f.partido;
              return (
                <tr key={f.partido} className="border-t border-white/10" style={esModelo ? { background: `${ORO}10` } : undefined}>
                  <td className="max-w-[12rem] py-1.5 pr-2">
                    <span className="block truncate text-white/85">{f.oponente}</span>
                    <span className="text-[11px] text-white/45">{fechaCorta(f.fecha)}</span>
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-white/80">{f.robos}</td>
                  <td className="px-2 py-1.5">
                    <div className="flex items-center gap-2">
                      <b className="w-5 shrink-0 text-right tabular-nums" style={{ color: f.remates ? ORO : undefined }}>
                        {f.remates}
                      </b>
                      <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-white/10" aria-hidden>
                        <span className="block h-full rounded-full" style={{ width: `${(f.remates / maxRem) * 100}%`, background: ORO }} />
                      </span>
                      {f.goles > 0 && <span className="shrink-0 text-[11px] text-white/60">{f.goles} gol{f.goles === 1 ? "" : "es"}</span>}
                    </div>
                  </td>
                  <td className="py-1.5 pl-2 text-right tabular-nums">
                    {r && (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="rounded px-1 text-[11px] font-bold" style={{ color: COLOR_SIGNO[r.signo], background: `${COLOR_SIGNO[r.signo]}22` }}>
                          {r.signo}
                        </span>
                        {r.texto}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-1 text-[11px] text-white/45">G, E, P: ganó, empató o perdió su rival.</p>

      {texto && <p className="mt-3 text-sm leading-relaxed text-white/75">{texto}</p>}
      <p className="mt-2 text-[11px] text-white/45">
        Opta, evento a evento de {filas.length} {filas.length === 1 ? "partido" : "partidos"}
        {hasta ? `, hasta el ${fechaCorta(hasta)}` : ""}
        {cargando ? " (faltan por llegar)" : ""}. Robo alto: recuperación o intercepción en el último tercio. Media de la liga: balones ganados en el último tercio
        (PosWonA3rd) por equipo y partido, de todos los partidos con evento a evento.
      </p>
    </div>
  );
}

function EnlaceVideo({ fila, videos, equipo }: { fila: FilaRoboAlto; videos: MediaItem[]; equipo: string }) {
  const v = videoDe(videos, fila.oponente);
  const clase =
    "inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-white/85 transition hover:bg-white/[0.06]";
  if (v)
    return (
      <a href={enlaceAbrible(v.url)} target="_blank" rel="noreferrer" className={clase} title={`De los vídeos del rival: ${v.nombre}`}>
        <PlayCircle size={14} /> Ver el partido
      </a>
    );
  const goles = (fila.golesOponente ?? 0) + (fila.golesRival ?? 0);
  if (!goles) return null;
  return (
    <BotonGolesEnVideo equipo={equipo} partido={fila.partido} className={clase} title="Los goles de ese partido, de Análisis de goles">
      <PlayCircle size={14} /> Sus goles en vídeo
    </BotonGolesEnVideo>
  );
}
