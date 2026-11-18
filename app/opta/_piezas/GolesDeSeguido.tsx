"use client";

/**
 * VER DE SEGUIDO TODOS LOS GOLES (16/11/2026).
 *
 * «¿Y poder ver de seguido todos los goles de los rivales en vídeo?» Los goles
 * de un equipo (a favor o en contra) uno detrás de otro.
 *
 * Primero, el vídeo de Opta (16/11/2026): el ordenador del club baja de
 * ProVision el corte de cada gol (10 s antes y 6 después, la retransmisión
 * entera del partido) y lo sube a B2 (scripts/opta-goles-video.mjs →
 * documento `opta:goles-video`, por partido, parte y segundo). Si un gol aún
 * no lo tiene, se usa el resumen oficial de la RFEF en YouTube, de 10 s antes
 * a 5 s después:
 *
 * El segundo de cada gol en el resumen lo marca Gemini viendo el vídeo
 * (scripts/rfef-goles-resumenes.mjs → documento `rfef:goles-resumenes`) y sólo
 * se usa si salen tantos goles como dice el marcador. El gol de Opta se ata al
 * del resumen por equipo y orden: el k-ésimo gol de ese equipo en el partido.
 * Los que aún no tienen marca no se reproducen y se dice cuántos son.
 *
 * El reproductor es la API de iframe de YouTube (gratis, sin clave): con
 * `start`/`end` corta el trozo y al acabar pasa solo al siguiente.
 */

import { useEffect, useMemo, useRef, useState } from "react";

import { fechaCorta } from "@/lib/opta-analisis";
import { cargaResumenesRfef, mismoEquipo, resumenDelPartido } from "@/lib/rivals/resumen-de-partido";
import type { ResumenRfef } from "@/lib/rivals/resumenes-rfef";
import { minutoTexto, SITUACION, type Remate } from "@/lib/opta-eventos";

import { nombreDe } from "./eventos";

type GolMarcado = { segundo: number; equipo: string; descripcion: string };
type Marcas = Record<string, { goles: GolMarcado[]; cuadra: boolean }>;

const ANTES = 10;
const DESPUES = 5;

/** `cuando` y `situacion`, para la lista de goles que se eligen uno a uno (16/11/2026). */
/* `gol`: el remate del que sale la toma (18/11/2026), para abrirla al pinchar ese gol en el campo. */
type Toma = { clave: string; titulo: string; detalle: string; cuando: string; situacion: string; gol: Remate } & (
  | { fuente: "opta"; src: string }
  | { fuente: "rfef"; video: string; inicio: number; fin: number }
);
type ClipsOpta = Record<string, { url: string }>;

/* ---------- la API de iframe de YouTube, una vez por pestaña ---------- */

type YTPlayer = { loadVideoById: (o: { videoId: string; startSeconds: number; endSeconds: number }) => void; pauseVideo: () => void; destroy: () => void };
type YTApi = { Player: new (el: HTMLElement, o: unknown) => YTPlayer; PlayerState: { ENDED: number } };

let cargandoApi: Promise<YTApi> | null = null;

function apiYoutube(): Promise<YTApi> {
  const w = window as unknown as { YT?: YTApi; onYouTubeIframeAPIReady?: () => void };

  if (w.YT?.Player) return Promise.resolve(w.YT);

  cargandoApi ??= new Promise((listo) => {
    const antes = w.onYouTubeIframeAPIReady;

    w.onYouTubeIframeAPIReady = () => {
      antes?.();
      listo(w.YT as YTApi);
    };

    const s = document.createElement("script");

    s.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(s);
  });

  return cargandoApi;
}

/* ---------- las marcas de Gemini ---------- */

let cargandoMarcas: Promise<Marcas> | null = null;

function cargaMarcas(): Promise<Marcas> {
  cargandoMarcas ??= fetch("/api/docs?key=rfef:goles-resumenes")
    .then((r) => r.json() as Promise<{ data?: { videos?: Marcas } }>)
    .then((j) => j?.data?.videos ?? {})
    .catch(() => {
      cargandoMarcas = null;

      return {};
    });

  return cargandoMarcas;
}

/* ---------- los cortes de Opta ---------- */

let cargandoClips: Promise<ClipsOpta> | null = null;

function cargaClipsOpta(): Promise<ClipsOpta> {
  cargandoClips ??= fetch("/api/docs?key=opta:goles-video")
    .then((r) => r.json() as Promise<{ data?: { clips?: ClipsOpta } }>)
    .then((j) => j?.data?.clips ?? {})
    .catch(() => {
      cargandoClips = null;

      return {};
    });

  return cargandoClips;
}

/** Las tomas de los goles, en el orden en que se ven en la pantalla (lo más reciente primero). */
export function tomasDeGoles(goles: Remate[], resumenes: ResumenRfef[], marcas: Marcas, clips: ClipsOpta = {}): { tomas: Toma[]; sinMarca: number; deOpta: number } {
  const tomas: Toma[] = [];
  let sinMarca = 0;
  let deOpta = 0;

  /* El k-ésimo gol de cada equipo en cada partido, por orden de reloj. */
  const porPartido = new Map<string, Remate[]>();

  for (const g of goles) {
    const k = `${g.partido}|${g.teamId}`;

    porPartido.set(k, [...(porPartido.get(k) ?? []), g]);
  }

  for (const lista of porPartido.values()) lista.sort((a, b) => a.parte - b.parte || a.minuto - b.minuto);

  const ordenados = [...goles].sort((a, b) => b.fecha.localeCompare(a.fecha) || a.parte - b.parte || a.minuto - b.minuto);

  for (const g of ordenados) {
    const marca = nombreDe(g.teamId, g.equipo);
    const rival = nombreDe(g.rivalId, g.rival);
    const clip = clips[`${g.partido}|${g.parte}|${g.segundo}`];
    const titulo = `${g.tirador} · ${minutoTexto(g.minuto, g.parte)}`;
    const cuando = `${fechaCorta(g.fecha)} · ${marca} contra ${rival}`;
    const situacion = SITUACION[g.situacion] ?? "";

    if (clip?.url) {
      deOpta++;
      tomas.push({
        clave: `${g.partido}-${g.parte}-${g.segundo}-${g.tirador}`,
        fuente: "opta",
        src: clip.url,
        gol: g,
        titulo,
        detalle: cuando,
        cuando,
        situacion,
      });
      continue;
    }

    const resumen = resumenDelPartido(resumenes, marca, rival, g.fecha);
    const m = resumen ? marcas[resumen.id] : undefined;

    /* Vale si de ESTE equipo salen en el resumen tantos goles como en Opta,
       aunque al de enfrente le falte alguno (16/11/2026). */
    const delPartido = porPartido.get(`${g.partido}|${g.teamId}`) ?? [];
    const suyos = m ? m.goles.filter((x) => mismoEquipo(x.equipo, marca)) : [];
    const k = delPartido.indexOf(g);
    /* Sólo con la misma cuenta: un gol en propia puerta no es un remate de Opta y, aunque el marcador «cuadre», correría el orden y cada corte enseñaría el gol de al lado. */
    const enResumen = resumen && m && suyos.length === delPartido.length ? suyos[k] : undefined;

    if (!enResumen || !resumen) {
      sinMarca++;
      continue;
    }

    tomas.push({
      clave: `${g.partido}-${g.parte}-${g.minuto}-${g.tirador}`,
      fuente: "rfef",
      video: resumen.id,
      inicio: Math.max(0, enResumen.segundo - ANTES),
      fin: enResumen.segundo + DESPUES,
      gol: g,
      titulo,
      cuando,
      situacion,
      detalle: `${cuando} · resumen de la RFEF (J${resumen.jornada}, ${resumen.local} ${resumen.golesLocal}-${resumen.golesVisitante} ${resumen.visitante})`,
    });
  }

  return { tomas, sinMarca, deOpta };
}

/**
 * `conLista` (16/11/2026, «Goles del rival en vídeo»): debajo del botón, la
 * lista de los goles con vídeo para abrir uno suelto; desde él sigue de
 * seguido con los demás.
 */
/**
 * `pedido` (18/11/2026, /analisis-goles): un gol pinchado fuera (en el
 * campograma). Cada pedido nuevo —otro objeto, aunque sea el mismo gol— abre
 * el reproductor en ese gol y sigue de seguido desde él. Debe ser uno de los
 * `goles` (el mismo objeto). Si ese gol aún no tiene vídeo, se dice.
 */
export type PedidoGol = { gol: Remate };

export function GolesDeSeguido({ goles, titulo, conLista = false, pedido = null }: { goles: Remate[]; titulo: string; conLista?: boolean; pedido?: PedidoGol | null }) {
  const [resumenes, setResumenes] = useState<ResumenRfef[] | null>(null);
  const [marcas, setMarcas] = useState<Marcas | null>(null);
  const [clips, setClips] = useState<ClipsOpta | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [i, setI] = useState(0);
  const caja = useRef<HTMLDivElement>(null);
  const raiz = useRef<HTMLDivElement>(null);
  const jugador = useRef<YTPlayer | null>(null);
  const [atendido, setAtendido] = useState<PedidoGol | null>(null);
  const [sinVideo, setSinVideo] = useState<Remate | null>(null);

  useEffect(() => {
    let cancelado = false;

    Promise.all([cargaResumenesRfef(), cargaMarcas(), cargaClipsOpta()]).then(([r, m, c]) => {
      if (cancelado) return;
      setResumenes(r);
      setMarcas(m);
      setClips(c);
    });

    return () => {
      cancelado = true;
    };
  }, []);

  const { tomas, sinMarca, deOpta } = useMemo(
    () => (resumenes && marcas && clips ? tomasDeGoles(goles, resumenes, marcas, clips) : { tomas: [], sinMarca: 0, deOpta: 0 }),
    [goles, resumenes, marcas, clips],
  );

  /* Un gol pinchado fuera: se atiende en el pintado (sin setState en un efecto) en cuanto están las tomas. */
  if (pedido && pedido !== atendido && resumenes && marcas && clips) {
    const k = tomas.findIndex((t) => t.gol === pedido.gol);

    setAtendido(pedido);
    setSinVideo(k >= 0 ? null : pedido.gol);
    if (k >= 0) {
      setI(k);
      setAbierto(true);
    }
  }

  const actual = tomas[i];

  /* Tras pinchar un gol en el campo, el reproductor a la vista (en el móvil va debajo del campo). */
  useEffect(() => {
    if (atendido) raiz.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [atendido]);

  /* Crea el reproductor al abrir; al cambiar de toma, sólo carga el trozo nuevo. */
  useEffect(() => {
    if (!abierto || !actual || !caja.current) return;

    /* Un corte de Opta va en su <video>: el de YouTube, si lo había, se pausa. */
    if (actual.fuente === "opta") {
      jugador.current?.pauseVideo();

      return;
    }

    let vivo = true;
    const el = caja.current;

    apiYoutube().then((YT) => {
      if (!vivo) return;

      const trozo = { videoId: actual.video, startSeconds: actual.inicio, endSeconds: actual.fin };

      if (jugador.current) {
        jugador.current.loadVideoById(trozo);

        return;
      }

      const hueco = document.createElement("div");

      el.replaceChildren(hueco);
      jugador.current = new YT.Player(hueco, {
        width: "100%",
        height: "100%",
        videoId: actual.video,
        playerVars: { start: actual.inicio, end: actual.fin, autoplay: 1, rel: 0, modestbranding: 1, playsinline: 1 },
        events: {
          onStateChange: (e: { data: number }) => {
            if (e.data === YT.PlayerState.ENDED) setI((n) => n + 1);
          },
        },
      });
    });

    return () => {
      vivo = false;
    };
  }, [abierto, actual]);

  /* Al cerrar, fuera el reproductor. */
  useEffect(() => {
    if (abierto) return;

    jugador.current?.destroy();
    jugador.current = null;
  }, [abierto]);

  if (!resumenes || !marcas || !clips || goles.length === 0) return null;

  const boton =
    "inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-[#C8A96B]/40 bg-[#C8A96B]/10 px-3 text-[12px] font-semibold text-[#C8A96B] transition hover:bg-[#C8A96B]/20 disabled:opacity-40";
  const fueraDeLista = i >= tomas.length;

  return (
    <div ref={raiz} className="mb-3 min-w-0 scroll-mt-24">
      {sinVideo && (
        <p className="mb-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[12px] text-white/70" role="status">
          El gol de {sinVideo.tirador} ({minutoTexto(sinVideo.minuto, sinVideo.parte)}) aún no tiene vídeo: se baja cada noche.
        </p>
      )}
      {!abierto ? (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className={boton} disabled={!tomas.length} onClick={() => (setI(0), setAbierto(true), setSinVideo(null))}>
            {/* 18/11/2026 (ronda 22): con uno solo, «Ver el gol», no «los 1 goles». */}
            {tomas.length === 1 ? "▶ Ver el gol" : `▶ Ver de seguido los ${tomas.length} goles`}
          </button>
          <span className="text-[12px] text-white/55">
            {titulo}:{" "}
            {deOpta === tomas.length
              ? tomas.length === 1
                ? "con el vídeo del partido de Opta"
                : "cada gol con el vídeo del partido de Opta"
              : deOpta > 0
                ? `${deOpta} con el vídeo del partido de Opta y ${tomas.length - deOpta} con el resumen de la RFEF`
                : `${tomas.length === 1 ? "el gol" : "cada gol"} de ${ANTES} s antes a ${DESPUES} s después, sobre el resumen oficial de la RFEF`}
            {sinMarca > 0 ? ` · ${sinMarca} aún sin vídeo (${sinMarca === 1 ? "se baja" : "se bajan"} cada noche)` : ""}
          </span>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <p className="min-w-0 text-[13px] font-semibold text-white">
              {fueraDeLista ? "Fin: ya están todos" : `${i + 1} de ${tomas.length} · ${actual?.titulo ?? ""}`}
            </p>
            <div className="flex items-center gap-2">
              <button type="button" className={boton} disabled={i === 0} onClick={() => setI((n) => Math.max(0, n - 1))}>
                ‹ Anterior
              </button>
              <button type="button" className={boton} disabled={fueraDeLista} onClick={() => setI((n) => n + 1)}>
                Siguiente ›
              </button>
              <button type="button" className={boton} onClick={() => setAbierto(false)}>
                Cerrar
              </button>
            </div>
          </div>
          {!fueraDeLista && <p className="mb-2 text-[12px] text-white/55">{actual?.detalle}</p>}
          {actual?.fuente === "opta" && (
            <video
              key={actual.clave}
              src={actual.src}
              className="aspect-video w-full rounded-xl bg-black"
              autoPlay
              controls
              playsInline
              onEnded={() => setI((n) => n + 1)}
            />
          )}
          <div className={`aspect-video w-full overflow-hidden rounded-xl bg-black ${actual?.fuente === "rfef" ? "" : "hidden"}`} ref={caja} />
          <p className="mt-2 text-[11px] text-white/45">
            {actual?.fuente === "rfef"
              ? "De este gol aún no está el vídeo de Opta: va sobre el resumen de la RFEF, con el segundo marcado por una IA. Si empieza tarde o pronto, «Siguiente» pasa al próximo."
              : "Vídeo de la retransmisión del partido (Opta ProVision), de 10 s antes del gol a 6 s después."}
          </p>
        </div>
      )}
      {conLista && tomas.length > 1 && (
        <ol className="mt-2 grid min-w-0 gap-1 sm:grid-cols-2" aria-label={`${titulo}, uno a uno`}>
          {tomas.map((t, k) => (
            <li key={t.clave} className="min-w-0">
              <button
                type="button"
                onClick={() => (setI(k), setAbierto(true), setSinVideo(null))}
                aria-current={abierto && k === i ? "true" : undefined}
                className={`flex w-full min-w-0 items-baseline gap-2 rounded-xl border px-3 py-2 text-left transition hover:border-[#C8A96B]/50 ${abierto && k === i ? "border-[#C8A96B]/60 bg-[#C8A96B]/10" : "border-white/10 bg-white/[0.02]"}`}
              >
                <span aria-hidden className="shrink-0 text-[11px] text-[#C8A96B]">▶</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold text-white/85">{t.titulo}</span>
                  <span className="block truncate text-[11.5px] text-white/55">
                    {t.cuando}
                    {t.situacion ? ` · ${t.situacion}` : ""}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
