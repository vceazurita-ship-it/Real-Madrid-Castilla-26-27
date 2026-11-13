"use client";

/**
 * EL DIRECTO CONTRA EL PLAN (12/11/2026): tarjetas de una cifra para leer en
 * dos segundos. Rojo = alerta (el plan no se está dando; trae la consigna para
 * el banquillo), verde = certeza, ámbar = dentro de lo habitual, gris = aún
 * pronto o sin dato. Cuatro grandes (lo que más importa) y el resto plegado.
 * El motor es `lib/opta-directo-plan.ts`.
 *
 * Si juega el Castilla, el plan es la fila de RIVALES de ese rival (la de
 * /match-preparation) más cercana a hoy; si no, objetivos generales del
 * primer equipo contra lo habitual en él.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, CircleDashed, Clock, Maximize2, Megaphone, Minimize2, MinusCircle } from "lucide-react";

import { confirma, juzga, mediasDe, momento, type Estado, type Juicio, type Marcador, type Tramo, type Valores } from "@/lib/opta-directo-plan";
import { mismoClub } from "@/lib/rivals/mismoClub";

const COLOR: Record<Estado, { borde: string; fondo: string; tinta: string; rotulo: string }> = {
  alerta: { borde: "rgba(239,68,68,0.75)", fondo: "rgba(239,68,68,0.14)", tinta: "#ef4444", rotulo: "ALERTA" },
  certeza: { borde: "rgba(34,197,94,0.6)", fondo: "rgba(34,197,94,0.12)", tinta: "#22c55e", rotulo: "CERTEZA" },
  duda: { borde: "rgba(245,158,11,0.6)", fondo: "rgba(245,158,11,0.12)", tinta: "#f59e0b", rotulo: "EN EL FILO" },
  habitual: { borde: "rgba(148,163,184,0.45)", fondo: "rgba(148,163,184,0.08)", tinta: "#cbd5e1", rotulo: "LO HABITUAL" },
  pronto: { borde: "rgba(148,163,184,0.4)", fondo: "rgba(148,163,184,0.08)", tinta: "#94a3b8", rotulo: "PRONTO" },
  sindato: { borde: "rgba(148,163,184,0.3)", fondo: "rgba(148,163,184,0.05)", tinta: "#94a3b8", rotulo: "SIN DATO" },
};

const ICONO: Record<Estado, typeof AlertTriangle> = { alerta: AlertTriangle, certeza: CheckCircle2, duda: CircleDashed, habitual: CircleDashed, pronto: Clock, sindato: MinusCircle };

const GRANDES = 4;

type Fila = Record<string, unknown>;

/** La fila del plan de ese rival: la de fecha más cercana a hoy. */
function usePlanDelRival(rival: string | null): { plan: Fila | null; cargando: boolean } {
  const [leidas, setLeidas] = useState<{ filas: Fila[]; ahora: number } | null>(null);
  useEffect(() => {
    if (!rival) return;
    let vivo = true;
    fetch("/api/rivals?action=rivales", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then((j) => vivo && setLeidas({ filas: Array.isArray(j) ? j : [], ahora: Date.now() }))
      .catch(() => vivo && setLeidas({ filas: [], ahora: Date.now() }));
    return () => {
      vivo = false;
    };
  }, [rival]);
  return useMemo(() => {
    if (!rival) return { plan: null, cargando: false };
    if (!leidas) return { plan: null, cargando: true };
    const { filas, ahora } = leidas;
    const suyas = filas
      .filter((f) => mismoClub(String(f.EQUIPO ?? ""), rival))
      .sort((a, b) => Math.abs(Date.parse(String(a.FECHA)) - ahora) - Math.abs(Date.parse(String(b.FECHA)) - ahora));
    return { plan: suyas[0] ?? null, cargando: false };
  }, [leidas, rival]);
}

/** El valor sobre su rango habitual: la franja es lo normal, el punto es hoy. */
function LineaRango({ j, grande }: { j: Juicio; grande: boolean }) {
  if (j.cifra == null || !j.rango) return null;
  const [lo, hi] = j.rango;
  const ancho = Math.max(hi - lo, 0.0001);
  const min = Math.min(lo - ancho, j.cifra);
  const max = Math.max(hi + ancho, j.cifra);
  const x = (v: number) => `${((v - min) / (max - min)) * 100}%`;
  return (
    <div className={`relative mt-2 ${grande ? "h-3" : "h-2"} rounded-full bg-white/[0.08]`} aria-hidden>
      <span className="absolute inset-y-0 rounded-full bg-white/25" style={{ left: x(lo), width: `calc(${x(hi)} - ${x(lo)})` }} />
      <span
        className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-black/40 ${grande ? "h-4 w-4" : "h-3 w-3"}`}
        style={{ left: x(j.cifra), background: COLOR[j.estado].tinta }}
      />
    </div>
  );
}

function Tarjeta({ j, grande, completa }: { j: Juicio; grande: boolean; completa: boolean }) {
  const c = COLOR[j.estado];
  const Icono = ICONO[j.estado];
  const enorme = grande && completa;
  return (
    <div className="min-w-0 rounded-2xl border-2 p-3" style={{ borderColor: c.borde, background: c.fondo }}>
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-black tracking-[0.15em]" style={{ color: c.tinta }}>
          <Icono size={14} />
          {c.rotulo}
        </span>
        <span className="truncate text-[11px] font-semibold uppercase tracking-wide text-white/65">{j.titulo}</span>
      </div>
      <p className={`mt-1 font-black tabular-nums leading-none text-white ${enorme ? "text-7xl" : grande ? "text-5xl" : "text-3xl"}`}>{j.valor}</p>
      <LineaRango j={j} grande={grande} />
      <p className="mt-1 text-[11px] text-white/55">{j.liston}</p>
      <p className={`mt-2 font-bold leading-snug text-white ${enorme ? "text-xl" : grande ? "text-base" : "text-sm"}`}>{j.frase}</p>
      {j.consigna && (
        <p className={`mt-2 flex items-start gap-1.5 rounded-lg px-2 py-1.5 font-bold ${enorme ? "text-lg" : "text-sm"}`} style={{ background: "rgba(239,68,68,0.18)", color: "#fecaca" }}>
          <Megaphone size={enorme ? 18 : 14} className="mt-0.5 shrink-0" />
          {j.consigna}
        </p>
      )}
      {j.nota && <p className="mt-1 text-[11px] font-semibold text-white/70">{j.nota}</p>}
      <p className="mt-1 truncate text-[11px] italic text-white/45" title={j.plan}>
        Plan: {j.plan}
      </p>
    </div>
  );
}

export function DirectoPlan({
  nos,
  ellos,
  antesNos,
  antesEllos,
  marcador,
  nombreNos,
  nombreEllos,
  esCastilla,
  minuto,
  tramos,
  partidos,
  actualizado,
  ahora,
}: {
  nos: Valores;
  ellos: Valores;
  /** Las cifras de la lectura anterior (para no dar una alerta que parpadea). */
  antesNos: Valores | null;
  antesEllos: Valores | null;
  marcador: Marcador | null;
  nombreNos: string;
  nombreEllos: string;
  esCastilla: boolean;
  minuto: number | null;
  tramos: Tramo[];
  partidos: Valores[];
  /** Hora de las cifras y de la última mirada: si se quedan viejas, se avisa (también en pantalla completa). */
  actualizado?: string;
  ahora?: number;
}) {
  const { plan, cargando } = usePlanDelRival(esCastilla ? nombreEllos : null);
  const caja = useRef<HTMLDivElement>(null);
  const [completa, setCompleta] = useState(false);
  const [todas, setTodas] = useState(false);

  useEffect(() => {
    const al = () => setCompleta(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", al);
    return () => document.removeEventListener("fullscreenchange", al);
  }, []);

  /* Mientras se ve un directo la pantalla no se apaga (13/11/2026, banquillo):
     siempre, no sólo en pantalla completa (el iPhone no la tiene), y se vuelve
     a pedir al volver a la pestaña, porque el navegador lo suelta al cambiar de
     app o bloquear la tableta. */
  useEffect(() => {
    let cerrojo: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
    const pide = () => {
      if (document.visibilityState !== "visible" || !nav.wakeLock) return;
      void nav.wakeLock
        .request("screen")
        .then((c) => {
          cerrojo = c;
        })
        .catch(() => undefined);
    };
    pide();
    document.addEventListener("visibilitychange", pide);
    return () => {
      document.removeEventListener("visibilitychange", pide);
      void cerrojo?.release().catch(() => undefined);
    };
  }, []);

  const bandaNos = useMemo(() => mediasDe(partidos, String(nos.teamId ?? "")), [partidos, nos.teamId]);
  const bandaEllos = useMemo(() => mediasDe(partidos, String(ellos.teamId ?? "")), [partidos, ellos.teamId]);

  const juicios = useMemo<Juicio[]>(() => {
    const elPlan = esCastilla ? plan : null;
    const ahora = juzga({ plan: elPlan, minuto, nos, ellos, bandaNos, bandaEllos, marcador });
    const antes =
      antesNos && antesEllos
        ? juzga({ plan: elPlan, minuto: minuto != null ? minuto - 1 : null, nos: antesNos, ellos: antesEllos, bandaNos, bandaEllos, marcador })
        : null;
    const confirmados = confirma(ahora, antes);
    /* Partido de otros (13/11/2026, tras los expertos): sin consignas de
       banquillo, que no son para nadie; cada equipo, contra su propia media. */
    return esCastilla ? confirmados : confirmados.map((j) => ({ ...j, consigna: undefined }));
  }, [esCastilla, plan, minuto, nos, ellos, antesNos, antesEllos, bandaNos, bandaEllos, marcador]);

  /* Alerta nueva ya confirmada (dos lecturas): pitido corto y vibración, que en
     el banquillo un aviso sólo visual se pierde (13/11/2026). La primera
     lectura sólo apunta las que ya había, sin sonar. */
  const sonadas = useRef<Set<string> | null>(null);
  useEffect(() => {
    const ahoraAlertas = juicios.filter((j) => j.estado === "alerta").map((j) => j.id);
    if (sonadas.current == null) {
      sonadas.current = new Set(ahoraAlertas);
      return;
    }
    const nuevas = ahoraAlertas.filter((id) => !sonadas.current!.has(id));
    sonadas.current = new Set(ahoraAlertas);
    if (!nuevas.length) return;
    try {
      navigator.vibrate?.([200, 100, 200]);
    } catch {
      /* sin vibración */
    }
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
      o.connect(g).connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + 0.55);
      o.onended = () => void ctx.close().catch(() => undefined);
    } catch {
      /* el navegador no deja sonar sin un toque antes: queda el aviso visual */
    }
  }, [juicios]);

  const mom = useMemo(() => momento(tramos), [tramos]);
  const cuenta = (e: Estado) => juicios.filter((j) => j.estado === e).length;
  const maxBarra = Math.max(1, ...mom.barras.map((b) => Math.abs(b.balanza)));
  const grandes = juicios.slice(0, GRANDES);
  const resto = juicios.slice(GRANDES);

  const conmuta = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void caja.current?.requestFullscreen?.().catch(() => undefined);
  };

  /* Cifras de hace más de 3 minutos: el proceso se ha parado o Opta no publica. */
  const actualMs = actualizado ? Date.parse(actualizado) : NaN;
  const viejas = ahora && Number.isFinite(actualMs) ? Math.floor((ahora - actualMs) / 60_000) : 0;

  const origen = esCastilla
    ? cargando
      ? "Buscando el plan de partido…"
      : plan
        ? `Contra el plan de la J${String(plan.JORNADA ?? "")} (${String(plan.EQUIPO ?? "")}) y lo habitual de cada equipo esta temporada`
        : `Sin plan de partido de ${nombreEllos}: objetivos generales contra lo habitual`
    : `No juega el Castilla: ${nombreNos} contra lo habitual en sus partidos`;

  return (
    <div ref={caja} className={`rounded-2xl border border-white/10 bg-[var(--background,#0b0b0f)] p-4 ${completa ? "overflow-auto p-6" : ""}`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/50">Cómo se está dando el partido</p>
          <p className="truncate text-xs text-white/55">{origen}</p>
        </div>
        {completa && marcador && (
          <p className="text-4xl font-black tabular-nums text-white" aria-label="Marcador y minuto">
            {marcador.nos} - {marcador.ellos}
            {minuto != null && <span className="ml-3 text-2xl font-bold text-white/60">{minuto}′</span>}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {(["alerta", "certeza", "duda"] as Estado[]).map((e) => (
            <span key={e} className="rounded-full px-2.5 py-1 text-xs font-bold tabular-nums" style={{ background: COLOR[e].fondo, color: COLOR[e].tinta }}>
              {cuenta(e)} {COLOR[e].rotulo.toLowerCase()}
            </span>
          ))}
          <button
            type="button"
            onClick={conmuta}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/75 hover:text-white"
          >
            {completa ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
            {completa ? "Salir" : "Pantalla completa"}
          </button>
        </div>
      </div>

      {viejas >= 3 && (
        <p className={`mb-3 rounded-xl px-3 py-2 font-bold ${completa ? "text-xl" : "text-base"}`} style={{ background: COLOR.duda.fondo, color: COLOR.duda.tinta }} role="status">
          Cifras de hace {viejas} min: no te fíes de las alertas hasta la siguiente lectura.
        </p>
      )}

      {/* El descanso (13/11/2026, tras los expertos): la charla en tres cosas,
          las alertas que más pesan con su consigna. Del 44' al 52'. */}
      {esCastilla && minuto != null && minuto >= 44 && minuto <= 52 && (() => {
        const tres = juicios.filter((j) => j.estado === "alerta" && j.consigna).sort((a, b) => b.peso - a.peso).slice(0, 3);
        if (!tres.length) return null;
        return (
          <div className="mb-3 rounded-xl border px-3 py-2" style={{ borderColor: COLOR.alerta.tinta, background: COLOR.alerta.fondo, color: COLOR.alerta.tinta }} role="status">
            <p className={`font-black uppercase tracking-[0.12em] ${completa ? "text-xl" : "text-sm"}`}>Descanso · {tres.length === 1 ? "1 cosa" : `${tres.length} cosas`}</p>
            <ol className={`mt-1 list-decimal space-y-0.5 pl-5 font-semibold ${completa ? "text-lg" : "text-sm"}`}>
              {tres.map((j) => (
                <li key={j.id}>
                  {j.titulo} ({j.valor}): {j.consigna}
                </li>
              ))}
            </ol>
          </div>
        );
      })()}

      {mom.ultimos && (
        <p
          className={`mb-3 rounded-xl px-3 py-2 font-bold ${completa ? "text-xl" : "text-base"}`}
          style={{
            background: mom.ultimos.manda === "ellos" ? COLOR.alerta.fondo : mom.ultimos.manda === "nos" ? COLOR.certeza.fondo : COLOR.pronto.fondo,
            color: mom.ultimos.manda === "ellos" ? COLOR.alerta.tinta : mom.ultimos.manda === "nos" ? COLOR.certeza.tinta : undefined,
          }}
        >
          {mom.ultimos.frase}
        </p>
      )}

      {juicios.length === 0 ? (
        <p className="text-sm text-white/60">Aún no hay cifras con las que juzgar.</p>
      ) : (
        <>
          <div className={`grid gap-3 ${completa ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-2"}`}>
            {grandes.map((j) => (
              <Tarjeta key={j.id} j={j} grande completa={completa} />
            ))}
          </div>
          {resto.length > 0 && (
            <div className="mt-3">
              <button
                type="button"
                onClick={() => setTodas((t) => !t)}
                className="text-xs font-semibold text-white/60 underline decoration-dotted underline-offset-2 hover:text-white"
              >
                {todas ? "Plegar" : `Ver las otras ${resto.length}`} ({resto.filter((j) => j.estado === "alerta").length} alertas, {resto.filter((j) => j.estado === "certeza").length} certezas)
              </button>
              {todas && (
                <div className={`mt-2 grid gap-2 ${completa ? "grid-cols-3" : "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3"}`}>
                  {resto.map((j) => (
                    <Tarjeta key={j.id} j={j} grande={false} completa={completa} />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {mom.barras.length > 1 && (
        <div className="mt-4">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-white/50">
            xG cada 5{"'"} · arriba {nombreNos}, abajo {nombreEllos}
          </p>
          <div className="flex h-24 items-stretch gap-[3px]">
            {mom.barras.map((b, i) => {
              const alto = (Math.abs(b.balanza) / maxBarra) * 100;
              return (
                <div key={i} className="relative flex min-w-0 flex-1 flex-col" title={`${b.etiqueta}: ${b.balanza > 0 ? nombreNos : b.balanza < 0 ? nombreEllos : "igual"}`}>
                  <div className="flex flex-1 items-end">{b.balanza > 0 && <span className="w-full rounded-t" style={{ height: `${alto}%`, background: "#C8A96B" }} />}</div>
                  <div className="h-px bg-white/20" />
                  <div className="flex flex-1 items-start">{b.balanza < 0 && <span className="w-full rounded-b" style={{ height: `${alto}%`, background: "#ef4444" }} />}</div>
                </div>
              );
            })}
          </div>
          <div className="mt-0.5 flex justify-between text-[10px] text-white/40">
            <span>{mom.barras[0]?.etiqueta}</span>
            <span>{mom.barras.at(-1)?.etiqueta}</span>
          </div>
        </div>
      )}
    </div>
  );
}
