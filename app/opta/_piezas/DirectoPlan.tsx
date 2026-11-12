"use client";

/**
 * EL DIRECTO CONTRA EL PLAN (12/11/2026): tarjetas de una cifra para leer en
 * dos segundos. Rojo = alerta (el plan no se está dando), verde = certeza,
 * ámbar = en el filo, gris = aún pronto. El motor es `lib/opta-directo-plan.ts`.
 *
 * Si juega el Castilla, el plan es la fila de RIVALES de ese rival (la de
 * /match-preparation) más cercana a hoy; si no, objetivos generales del
 * primer equipo contra su media.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, CircleDashed, Clock, Maximize2, Minimize2 } from "lucide-react";

import { juzga, mediasDe, momento, type Estado, type Juicio, type Tramo, type Valores } from "@/lib/opta-directo-plan";
import { mismoClub } from "@/lib/rivals/mismoClub";

const COLOR: Record<Estado, { borde: string; fondo: string; tinta: string; rotulo: string }> = {
  alerta: { borde: "rgba(239,68,68,0.7)", fondo: "rgba(239,68,68,0.14)", tinta: "#ef4444", rotulo: "ALERTA" },
  certeza: { borde: "rgba(34,197,94,0.6)", fondo: "rgba(34,197,94,0.12)", tinta: "#22c55e", rotulo: "CERTEZA" },
  duda: { borde: "rgba(245,158,11,0.6)", fondo: "rgba(245,158,11,0.12)", tinta: "#f59e0b", rotulo: "EN EL FILO" },
  pronto: { borde: "rgba(148,163,184,0.4)", fondo: "rgba(148,163,184,0.08)", tinta: "#94a3b8", rotulo: "PRONTO" },
};

const ICONO: Record<Estado, typeof AlertTriangle> = { alerta: AlertTriangle, certeza: CheckCircle2, duda: CircleDashed, pronto: Clock };

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

export function DirectoPlan({
  nos,
  ellos,
  nombreNos,
  nombreEllos,
  esCastilla,
  minuto,
  tramos,
  partidos,
}: {
  nos: Valores;
  ellos: Valores;
  nombreNos: string;
  nombreEllos: string;
  esCastilla: boolean;
  minuto: number | null;
  tramos: Tramo[];
  partidos: Valores[];
}) {
  const { plan, cargando } = usePlanDelRival(esCastilla ? nombreEllos : null);
  const caja = useRef<HTMLDivElement>(null);
  const [completa, setCompleta] = useState(false);

  useEffect(() => {
    const al = () => setCompleta(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", al);
    return () => document.removeEventListener("fullscreenchange", al);
  }, []);

  const juicios = useMemo<Juicio[]>(
    () =>
      juzga({
        plan: esCastilla ? plan : null,
        minuto,
        nos,
        ellos,
        mediaNos: mediasDe(partidos, String(nos.teamId ?? "")),
        mediaEllos: mediasDe(partidos, String(ellos.teamId ?? "")),
      }),
    [esCastilla, plan, minuto, nos, ellos, partidos],
  );
  const mom = useMemo(() => momento(tramos), [tramos]);
  const cuenta = (e: Estado) => juicios.filter((j) => j.estado === e).length;
  const maxBarra = Math.max(1, ...mom.barras.map((b) => Math.abs(b.balanza)));

  const conmuta = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void caja.current?.requestFullscreen?.().catch(() => undefined);
  };

  const origen = esCastilla
    ? cargando
      ? "Buscando el plan de partido…"
      : plan
        ? `Contra el plan de la J${String(plan.JORNADA ?? "")} (${String(plan.EQUIPO ?? "")}) y nuestras medias de la temporada`
        : `Sin plan de partido de ${nombreEllos}: objetivos generales contra nuestras medias`
    : `No juega el Castilla: ${nombreNos} contra sus medias de la temporada`;

  return (
    <div ref={caja} className={`rounded-2xl border border-white/10 bg-[var(--background,#0b0b0f)] p-4 ${completa ? "overflow-auto p-6" : ""}`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/50">Cómo se está dando el partido</p>
          <p className="truncate text-xs text-white/55">{origen}</p>
        </div>
        <div className="flex items-center gap-2">
          {(["alerta", "duda", "certeza"] as Estado[]).map((e) => (
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

      {mom.ultimos && (
        <p
          className="mb-3 rounded-xl px-3 py-2 text-base font-bold"
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
        <div className={`grid gap-3 ${completa ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3"}`}>
          {juicios.map((j) => {
            const c = COLOR[j.estado];
            const Icono = ICONO[j.estado];
            return (
              <div key={j.id} className="min-w-0 rounded-2xl border-2 p-3" style={{ borderColor: c.borde, background: c.fondo }}>
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-black tracking-[0.15em]" style={{ color: c.tinta }}>
                    <Icono size={14} />
                    {c.rotulo}
                  </span>
                  <span className="truncate text-[11px] font-semibold uppercase tracking-wide text-white/60">{j.titulo}</span>
                </div>
                <p className={`mt-1 font-black tabular-nums leading-none text-white ${completa ? "text-6xl" : "text-4xl"}`}>{j.valor}</p>
                <p className="mt-1 text-[11px] text-white/55">{j.liston}</p>
                <p className={`mt-2 font-bold leading-snug text-white ${completa ? "text-lg" : "text-sm"}`}>{j.frase}</p>
                <p className="mt-1 truncate text-[11px] italic text-white/45" title={j.plan}>
                  Plan: {j.plan}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {mom.barras.length > 1 && (
        <div className="mt-4">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-white/50">
            Quién manda cada 5{"'"} · arriba {nombreNos}, abajo {nombreEllos}
          </p>
          <div className="flex h-24 items-stretch gap-[3px]">
            {mom.barras.map((b, i) => {
              const alto = (Math.abs(b.balanza) / maxBarra) * 50;
              return (
                <div key={i} className="relative flex min-w-0 flex-1 flex-col" title={`${b.etiqueta}: ${b.balanza > 0 ? nombreNos : nombreEllos}`}>
                  <div className="flex flex-1 items-end">
                    {b.balanza > 0 && <span className="w-full rounded-t" style={{ height: `${alto * 2}%`, background: "#C8A96B" }} />}
                  </div>
                  <div className="h-px bg-white/20" />
                  <div className="flex flex-1 items-start">
                    {b.balanza < 0 && <span className="w-full rounded-b" style={{ height: `${alto * 2}%`, background: "#ef4444" }} />}
                  </div>
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
