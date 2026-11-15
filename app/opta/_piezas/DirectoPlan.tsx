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
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-black tracking-[0.15em]"
          /* Alerta, filo y certeza en píldora de color con letra oscura: se distinguen de un vistazo y del oro de la marca. */
          style={{ background: c.tinta, color: "#111827" }}
        >
          <Icono size={14} />
          {c.rotulo}
        </span>
        {/* Con el nombre del equipo (partidos sin el Castilla) no se corta: es lo que dice de quién habla. */}
        <span className={`text-xs font-semibold uppercase tracking-wide text-white/65 ${j.equipo ? "min-w-0 break-words text-right" : "truncate"}`}>{j.titulo}</span>
      </div>
      <p className={`mt-1 font-black tabular-nums leading-none text-white ${enorme ? "text-7xl" : grande ? "text-5xl" : "text-3xl"}`}>{j.valor}</p>
      <LineaRango j={j} grande={grande} />
      <p className="mt-1 text-sm text-white/70">{j.liston}</p>
      <p className={`mt-2 font-bold leading-snug text-white ${enorme ? "text-xl" : grande ? "text-base" : "text-sm"}`}>{j.frase}</p>
      {j.consigna && (
        <p className={`mt-2 flex items-start gap-1.5 rounded-lg px-2 py-1.5 font-bold ${enorme ? "text-lg" : "text-sm"}`} /* Rojo lleno y letra blanca: se lee igual en modo día y en noche (antes, rosa sobre rosa de día). */
          style={{ background: "#dc2626", color: "#FFFFFF" }}>
          <Megaphone size={enorme ? 18 : 14} className="mt-0.5 shrink-0" />
          {j.consigna}
        </p>
      )}
      {j.nota && <p className="mt-1 text-xs font-semibold text-white/70">{j.nota}</p>}
      {/* Con consigna, ésa es la acción: el «Plan:» repetido sobraba. */}
      {!j.consigna && (
        <p className="mt-1 truncate text-sm italic text-white/60" title={j.plan}>
          Plan: {j.plan}
        </p>
      )}
    </div>
  );
}

/** De cuántos partidos sale la media de un equipo (la banda más larga). */
const muestraDe = (bandas: Record<string, { n: number }>) => Math.max(0, ...Object.values(bandas).map((b) => b.n));

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
  acabado = false,
  amonestados = [],
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
  /** Partido acabado: arriba el balance frente al plan («Buscábamos / Logramos») y sin «últimos 15'». */
  acabado?: boolean;
  /** Los nuestros con amarilla (de la tabla de jugadores del partido): para la charla individual. */
  amonestados?: string[];
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
    /* Sin el Castilla, cada tarjeta dice de qué equipo habla (15/11/2026, petición del analista). */
    const nombres = esCastilla ? null : { nos: nombreNos, ellos: nombreEllos };
    const ahora = juzga({ plan: elPlan, minuto, nos, ellos, bandaNos, bandaEllos, marcador, nombres });
    const antes =
      antesNos && antesEllos
        ? juzga({ plan: elPlan, minuto: minuto != null ? minuto - 1 : null, nos: antesNos, ellos: antesEllos, bandaNos, bandaEllos, marcador, nombres })
        : null;
    /* Muestra corta (13/11/2026, tras los expertos): con menos de 5 partidos
       en la media de alguno de los dos, una alerta se queda en duda. */
    const corta = Math.min(muestraDe(bandaNos), muestraDe(bandaEllos)) < 5;
    /* Por los pelos (14/11/2026, expertos): si la cifra se sale de lo habitual menos de un 15 % del ancho
       del rango, no es alerta ni certeza sino «en el filo» (81 % frente a 69-80 % no abre el vídeo del lunes). */
    const porLosPelos = (j: Juicio) => {
      if (j.cifra == null || !j.rango) return false;
      const [lo, hi] = j.rango;
      const fuera = j.cifra > hi ? j.cifra - hi : j.cifra < lo ? lo - j.cifra : 0;
      return fuera > 0 && fuera < (hi - lo) * 0.15;
    };
    const confirmados = confirma(ahora, antes).map((j) =>
      (corta && j.estado === "alerta") || ((j.estado === "alerta" || j.estado === "certeza") && porLosPelos(j)) ? { ...j, estado: "duda" as Estado, consigna: undefined } : j,
    );
    /* Partido de otros (13/11/2026, tras los expertos): sin consignas de
       banquillo, que no son para nadie; cada equipo, contra su propia media. */
    return esCastilla ? confirmados : confirmados.map((j) => ({ ...j, consigna: undefined }));
  }, [esCastilla, plan, minuto, nos, ellos, antesNos, antesEllos, bandaNos, bandaEllos, marcador, nombreNos, nombreEllos]);

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

  const mom = useMemo(() => momento(tramos, esCastilla ? null : { nos: nombreNos, ellos: nombreEllos }), [tramos, esCastilla, nombreNos, nombreEllos]);
  /* El tramo más largo en que mandó el rival (xG cada 5′): de ahí salen los clips del lunes. */
  const tramoRival = useMemo(() => {
    let mejor: [number, number] | null = null;
    let ini = -1;
    mom.barras.forEach((b, i) => {
      const vale = b.balanza < 0;
      if (vale && ini < 0) ini = i;
      if ((!vale || i === mom.barras.length - 1) && ini >= 0) {
        const fin = vale ? i : i - 1;
        if (!mejor || fin - ini > mejor[1] - mejor[0]) mejor = [ini, fin];
        ini = -1;
      }
    });
    if (!mejor) return "";
    const [a, b] = mejor as [number, number];
    return b - a >= 1 ? `del ${parseInt(mom.barras[a].etiqueta, 10) - 5}′ al ${mom.barras[b].etiqueta.replace("'", "′")}` : "";
  }, [mom]);
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
    : `No juega el Castilla: cada tarjeta dice de qué equipo es la cifra; rojo = malo para ${nombreNos}, verde = bueno para ${nombreNos}. Cada equipo contra su media (${nombreNos}, ${muestraDe(bandaNos)} partidos; ${nombreEllos}, ${muestraDe(bandaEllos)})${Math.min(muestraDe(bandaNos), muestraDe(bandaEllos)) < 5 ? " · muestra corta: sin alertas firmes" : ""}`;

  return (
    <div ref={caja} className={`rounded-2xl border border-white/10 bg-[var(--background,#0b0b0f)] p-4 ${completa ? "overflow-auto p-6" : ""}`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">Cómo se está dando el partido</p>
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
        <p className={`mb-3 border-l-4 px-3 py-1 font-semibold ${completa ? "text-base" : "text-xs"}`} style={{ borderColor: COLOR.duda.tinta, color: COLOR.duda.tinta }} role="status">
          Cifras de hace {viejas} min · espera a la siguiente lectura antes de fiarte de las alertas
        </p>
      )}

      {/* El descanso (13/11/2026, tras los expertos): la charla en tres cosas,
          las alertas que más pesan con su consigna. Del 44' al 52'. */}
      {/* Sólo antes de que asome la segunda parte en los tramos: al volver del vestuario ya no estorba. */}
      {esCastilla && minuto != null && minuto >= 44 && minuto <= 52 && !tramos.some((t) => t.parte >= 2) && (() => {
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

      {/* Partido acabado (14/11/2026, expertos): el balance frente al plan, lo que se enseña el lunes. */}
      {acabado && juicios.length > 0 && (() => {
        /* Una fila por tema (sin repetir el mismo trozo de plan). */
        const delPlan = juicios.filter((j, i, l) => j.estado !== "sindato" && j.estado !== "pronto" && l.findIndex((k) => k.titulo === j.titulo) === i);
        /* Primero lo que decide (logrado, a medias, no logrado); «lo normal», plegado. */
        const decide = delPlan.filter((j) => j.estado !== "habitual");
        const normales = delPlan.filter((j) => j.estado === "habitual");
        /* Sin el Castilla no hay plan nuestro: se cuenta desde el equipo de la izquierda, con su nombre. */
        const ETIQUETA: Partial<Record<Estado, string>> = esCastilla
          ? { certeza: "Logrado", habitual: "Como siempre", duda: "En el filo", alerta: "No logrado" }
          : { certeza: "A favor", habitual: "Como siempre", duda: "En el filo", alerta: "En contra" };
        const n = (e: Estado) => delPlan.filter((j) => j.estado === e).length;
        return (
          <div className="mb-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
            <p className={`font-black text-[#C8A96B] ${completa ? "text-2xl" : "text-base sm:text-lg"}`}>
              {/* El titular cuenta lo claro (logrado o no); lo que quedó «a medias» se ve en la lista, no en la cuenta. */}
              {!esCastilla
                ? n("certeza") + n("alerta")
                  ? `${nombreNos}: ${n("certeza")} de ${n("certeza") + n("alerta")} ${n("certeza") + n("alerta") === 1 ? "cifra que decide" : "cifras que deciden"}, a su favor`
                  : "Todo dentro de lo habitual de cada equipo"
                : n("certeza") + n("alerta") ? `Logramos ${n("certeza")} de ${n("certeza") + n("alerta")} ${n("certeza") + n("alerta") === 1 ? "objetivo que decide" : "objetivos que deciden"}` : decide.length ? "Nada claro: todo en el filo o como siempre" : "Todo como siempre frente al plan"}
            </p>
            <p className="text-xs text-white/55">
              {esCastilla ? "Balance frente al plan" : `Balance leído desde ${nombreNos}, cada equipo contra su media`} · {[n("certeza") && `${n("certeza")} ${esCastilla ? (n("certeza") === 1 ? "logrado" : "logrados") : "a favor"}`, n("alerta") && `${n("alerta")} ${esCastilla ? `no ${n("alerta") === 1 ? "logrado" : "logrados"}` : "en contra"}`, n("duda") && `${n("duda")} en el filo`, n("habitual") && `${n("habitual")} como siempre`].filter(Boolean).join(" · ")}
            </p>
            <p className="mt-1 hidden text-xs text-white/55 sm:block">Cada tema del plan con la cifra del partido y su referencia (el texto del plan, al pasar el ratón)</p>
            <ul className="mt-1 space-y-1.5">
              {(todas ? delPlan : decide).map((j) => (
                <li key={j.id} className={`flex flex-col items-start gap-1 sm:grid sm:grid-cols-[6rem_minmax(0,1fr)] sm:gap-2 ${completa ? "text-lg" : "text-sm"}`}>
                  <span className="mt-0.5 w-24 shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-center text-xs font-black" style={{ background: COLOR[j.estado].tinta, color: "#111827" }}>
                    {ETIQUETA[j.estado] ?? COLOR[j.estado].rotulo}
                  </span>
                  <span className="min-w-0 text-white/85" title={j.plan}>
                    {j.equipo ? j.titulo : j.titulo.charAt(0) + j.titulo.slice(1).toLowerCase()}:<b className="tabular-nums text-white">{j.valor}</b>
                    {j.liston && <span className="text-white/55"> · {j.liston.replace(/^habitual[^:]*:\s*/i, "lo habitual: ")}</span>}
                    {j.estado === "alerta" && j.consigna && (
                      <span className="block text-white/75">
                        → Para el vídeo del lunes: {j.consigna.charAt(0).toLowerCase() + j.consigna.slice(1)}
                        {/* El tramo en que mandó el rival sirve para lo del juego, no para las amarillas (expertos). */}
                        {tramoRival && !/amarill/i.test(j.titulo) ? ` · clips ${tramoRival}, cuando mandó ${nombreEllos}` : /amarill/i.test(j.titulo) ? ` · ${amonestados.length ? `amonestados: ${amonestados.join(", ")}; ` : ""}cada falta: dónde fue y si hacía falta` : ""}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
            {normales.length > 0 && (
              <button type="button" onClick={() => setTodas((t) => !t)} className="mt-2 text-xs font-semibold text-[#C8A96B] hover:underline">
                {todas ? "Ver sólo lo que decide" : `Ver ${normales.length === 1 ? "el otro" : `los otros ${normales.length}`} (como siempre)`}
              </button>
            )}
          </div>
        );
      })()}

      {mom.ultimos && !acabado && (
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
          {/* Titular con la lectura (expertos: el gráfico solo no decía nada). */}
          {(() => {
            const racha = (signo: 1 | -1) => {
              let mejor: [number, number] | null = null;
              let ini = -1;
              mom.barras.forEach((b, i) => {
                const vale = b.balanza * signo > 0;
                if (vale && ini < 0) ini = i;
                if ((!vale || i === mom.barras.length - 1) && ini >= 0) {
                  const fin = vale ? i : i - 1;
                  if (!mejor || fin - ini > mejor[1] - mejor[0]) mejor = [ini, fin];
                  ini = -1;
                }
              });
              return mejor as [number, number] | null;
            };
            const tramo = (r: [number, number] | null) => {
              if (!r || r[1] - r[0] < 1) return "";
              const desde = parseInt(mom.barras[r[0]].etiqueta, 10) - 5;
              return `del ${desde}′ al ${mom.barras[r[1]].etiqueta.replace("'", "′")}`;
            };
            const nos = tramo(racha(1));
            const ellos = tramo(racha(-1));
            const frase = [nos && `${nombreNos} mandó ${nos}`, ellos && `${nombreEllos} ${ellos}`].filter(Boolean).join("; ");
            return frase ? <p className="mb-1 text-sm font-bold text-white/85">{frase}</p> : null;
          })()}
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.15em] text-white/50">
            xG cada 5{"'"} · arriba {nombreNos}, abajo {nombreEllos}
          </p>
          <div className="flex h-24 items-stretch gap-[3px]">
            {mom.barras.map((b, i) => {
              /* Altura mínima: una barra de 1 px no se ve (expertos). */
              const alto = b.balanza === 0 ? 0 : Math.max(8, (Math.abs(b.balanza) / maxBarra) * 100);
              return (
                <div key={i} className="relative flex min-w-0 flex-1 flex-col" title={`${b.etiqueta}: ${b.balanza > 0 ? nombreNos : b.balanza < 0 ? nombreEllos : "igual"}`}>
                  <div className="flex flex-1 items-end">{b.balanza > 0 && <span className="w-full rounded-t" style={{ height: `${alto}%`, background: "#C8A96B" }} />}</div>
                  <div className="h-px bg-white/20" />
                  <div className="flex flex-1 items-start">{b.balanza < 0 && <span className="w-full rounded-b" style={{ height: `${alto}%`, background: "#ef4444" }} />}</div>
                </div>
              );
            })}
          </div>
          <div className="mt-0.5 flex justify-between text-xs text-white/40">
            <span>{mom.barras[0]?.etiqueta}</span>
            <span>{mom.barras.at(-1)?.etiqueta}</span>
          </div>
        </div>
      )}
    </div>
  );
}
