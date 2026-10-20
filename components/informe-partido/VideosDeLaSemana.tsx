"use client";

/**
 * VÍDEOS DE LA SEMANA (22/10/2026, crítica del productor: «un solo vídeo largo
 * para todos los públicos»). Las piezas que salen de este informe, cada una
 * con su público, su formato y su duración, y un botón que las monta todas en
 * cola, una detrás de otra, con un reintento si falla el motor (WebCodecs o la
 * grabación se caen a veces sin avisar). Montar no sube nada: cada pieza se
 * descarga en el aparato. El vídeo de balón parado es el del analista (lo
 * sube el vigía desde «ABP\VIDEO - JUGADORES»): aquí sólo se enlaza, y si esa
 * jornada no lo tiene, la pieza no sale.
 */

import { useEffect, useRef, useState } from "react";
import { Check, Clapperboard, Download, ExternalLink, Loader2, RefreshCw } from "lucide-react";

import { Button } from "@/components/abp/ui";
import { descarga } from "@/lib/export/lienzos";
import { VIDEO_JUGADORES_KEY, eligeVideoJugadores, normalizaVideosJugadores, type VideoJugadores } from "@/lib/abp/video-jugadores";
import type { VideoMontado } from "@/lib/video-informe/monta";
import { CALENDARIO_SEMANAL, diaDePieza } from "@/lib/video-informe/piezas";

export type PiezaDeVideo = {
  id: string;
  nombre: string;
  publico: string;
  formato: string;
  duracion: string;
  archivo: string;
  /** `conAbp`: ese día los jugadores reciben también el vídeo de balón parado (sus consignas van sólo en ése). */
  monta: (alPaso: (texto: string) => void, contexto?: { conAbp: boolean }) => Promise<VideoMontado>;
};

type Estado = { tipo: "pendiente" } | { tipo: "montando"; paso: string; intento: number } | { tipo: "listo"; video: VideoMontado } | { tipo: "error"; motivo: string };

const INTENTOS = 2;

const minutos = (s: number) => (s >= 60 ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")} min` : `${Math.round(s)} s`);

const megas = (b: number) => `${(b / 1048576).toFixed(b >= 10485760 ? 0 : 1).replace(".", ",")} MB`;

export function VideosDeLaSemana({ piezas, jornada, rival, ocupado, momento }: { piezas: PiezaDeVideo[]; jornada: number | null; rival: string; ocupado: boolean; momento: "previa" | "post" }) {
  const [estados, setEstados] = useState<Record<string, Estado>>({});
  const [enCola, setEnCola] = useState(false);
  const [abp, setAbp] = useState<VideoJugadores | null>(null);
  const vivo = useRef(true);

  useEffect(() => {
    vivo.current = true;

    return () => {
      vivo.current = false;
    };
  }, []);

  /* El vídeo de ABP del analista: sólo se lee. */
  useEffect(() => {
    let cancelado = false;

    fetch(`/api/docs?key=${encodeURIComponent(VIDEO_JUGADORES_KEY)}`, { cache: "no-store" })
      .then((r) => r.json() as Promise<{ data?: unknown }>)
      .then((d) => {
        if (!cancelado) setAbp(eligeVideoJugadores(normalizaVideosJugadores(d?.data), jornada, rival));
      })
      .catch(() => {});

    return () => {
      cancelado = true;
    };
  }, [jornada, rival]);

  const pon = (id: string, e: Estado) => vivo.current && setEstados((x) => ({ ...x, [id]: e }));

  /* Una pieza, con su reintento: si el primer intento falla, se prueba otra vez antes de darla por perdida. */
  const montaUna = async (p: PiezaDeVideo) => {
    let motivo = "";

    for (let intento = 1; intento <= INTENTOS; intento += 1) {
      try {
        pon(p.id, { tipo: "montando", paso: "empezando…", intento });

        /* La regla de una consigna por pieza y día: el viernes de la previa, con el vídeo de balón parado, sus consignas no se repiten en la de consignas. */
        const video = await p.monta((paso) => pon(p.id, { tipo: "montando", paso, intento }), { conAbp: momento === "previa" && Boolean(abp) });

        pon(p.id, { tipo: "listo", video });

        return;
      } catch (error) {
        motivo = error instanceof Error ? error.message : String(error);
      }
    }

    pon(p.id, { tipo: "error", motivo });
  };

  const montaTodas = async () => {
    setEnCola(true);

    try {
      for (const p of piezas) {
        if (!vivo.current) return;
        if (estados[p.id]?.tipo === "listo") continue;

        await montaUna(p);
      }
    } finally {
      if (vivo.current) setEnCola(false);
    }
  };

  if (!piezas.length && !abp) return null;

  const montando = enCola || Object.values(estados).some((e) => e.tipo === "montando");
  const faltan = piezas.filter((p) => estados[p.id]?.tipo !== "listo").length;

  return (
    <section className="rounded-xl border border-white/10 p-4 font-sans">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">Vídeos de la semana</p>
          <p className="text-xs text-white/55">Una pieza por público y por día. Se montan aquí y se descargan; no se envía nada.</p>
        </div>
        {piezas.length ? (
          <Button icon={montando ? Loader2 : Clapperboard} disabled={ocupado || montando || !faltan} onClick={() => void montaTodas()}>
            {faltan ? (faltan === piezas.length ? "Montar todas" : `Montar las ${faltan} que faltan`) : "Todas montadas"}
          </Button>
        ) : null}
      </div>

      <ul className="divide-y divide-white/10">
        {piezas.map((p) => {
          const e = estados[p.id] ?? { tipo: "pendiente" };

          return (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white/90">
                  {diaDePieza(p.id as "cuerpo-tecnico" | "jugadores", momento) ? <span className="mr-1.5 text-[color:var(--rmcf-gold-ink)]">{diaDePieza(p.id as "cuerpo-tecnico" | "jugadores", momento)!.dia} ·</span> : null}
                  {p.nombre}
                </p>
                <p className="text-xs text-white/50">
                  {p.publico} · {p.formato} · {e.tipo === "listo" ? `${minutos(e.video.segundos)} · ${megas(e.video.blob.size)}` : p.duracion}
                </p>
                {e.tipo === "montando" ? (
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-white/55">
                    <Loader2 size={12} className="animate-spin" /> {e.intento > 1 ? "Segundo intento · " : ""}
                    {e.paso}
                  </p>
                ) : e.tipo === "error" ? (
                  <p className="mt-0.5 text-xs text-rose-300">No se ha podido montar ni al segundo intento{e.motivo ? `: ${e.motivo}` : ""}</p>
                ) : null}
              </div>
              {e.tipo === "listo" ? (
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1 text-xs text-emerald-300">
                    <Check size={12} /> Listo
                  </span>
                  <Button icon={Download} onClick={() => descarga(e.video.blob, p.archivo)}>
                    Descargar
                  </Button>
                </div>
              ) : e.tipo === "error" ? (
                <Button icon={RefreshCw} disabled={ocupado || montando} onClick={() => void montaUna(p)}>
                  Reintentar
                </Button>
              ) : e.tipo === "pendiente" ? (
                <Button icon={Clapperboard} disabled={ocupado || montando} onClick={() => void montaUna(p)}>
                  Montar
                </Button>
              ) : null}
            </li>
          );
        })}

        {abp ? (
          <li className="flex flex-wrap items-center justify-between gap-2 py-2.5">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white/90">
                <span className="mr-1.5 text-[color:var(--rmcf-gold-ink)]">Viernes ·</span>
                Balón parado · el vídeo del analista
              </p>
              <p className="text-xs text-white/50">
                Jugadores · {minutos(abp.segundos)} · {abp.mb.toFixed(0)} MB
              </p>
            </div>
            <a href={abp.url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs font-semibold text-[color:var(--rmcf-gold-ink)] hover:underline">
              Ver <ExternalLink size={12} />
            </a>
          </li>
        ) : null}
      </ul>

      {/* El calendario de la semana: qué pieza sale cada día, para quién y por dónde. */}
      <details className="mt-3 border-t border-white/10 pt-2.5 text-xs text-white/55">
        <summary className="cursor-pointer select-none text-white/70">La semana de vídeo</summary>
        <ul className="mt-2 grid gap-1">
          {CALENDARIO_SEMANAL.map((d) => (
            <li key={`${d.dia}-${d.pieza}-${d.momento ?? "abp"}`} className={d.momento === momento || (d.momento === null && momento === "previa") ? "text-white/85" : ""}>
              <span className="font-semibold text-[color:var(--rmcf-gold-ink)]">{d.dia}</span> · {d.nombre} · {d.publico} · {d.canal}
            </li>
          ))}
        </ul>
        <p className="mt-2">Cada consigna sale en una sola pieza por día: la de balón parado va en su vídeo, no también en el de consignas.</p>
      </details>
    </section>
  );
}
