"use client";

/**
 * IDENTIDAD EN EL CAMPO · la pantalla (02/11/2026).
 *
 * Lo que decimos que somos frente a lo que sale en el partido y lo que se
 * entrena en la semana. El cálculo vive en `lib/identidad/campo.ts`; aquí
 * sólo se dibuja. Colores: verde #1B9E77 (más nuestro) y naranja #D95F02
 * (menos), los validados de DATA; el Castilla en `--rmcf-gold-ink`.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Papa from "papaparse";
import { AlertTriangle, ArrowUpRight, CheckCircle2, Star, TrendingDown } from "lucide-react";

import { Conclusiones, Explicativo } from "@/components/ui/textos-analisis";
import { ErrorState, LoadingState } from "@/components/ui/knowledge-kit";
import { loadRegistro } from "@/lib/abp/registro";
import { traeCsv, traeJson } from "@/lib/hojaCsv";
import type { FilaJugador, FilaPartido } from "@/lib/data-analisis/leer";
import { formatea } from "@/lib/data-analisis/metricas";
import {
  NOMBRE_PUESTO,
  identidadEnElCampo,
  nivel,
  type BloqueMedido,
  type IdentidadEnElCampo,
  type JugadorEncaje,
  type PartidoEje,
} from "@/lib/identidad/campo";

const MODELO_CSV =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vS3_1ScOV6sTyEpZSgLgCf2dKbwkLzb3zUEYM-7ZOoMbcFUTp7nvu1pBfGOP7EzppXXQYQhLeVa_SPr/pub?gid=1322156567&single=true&output=csv";

const BIEN = "#1B9E77";
const MAL = "#D95F02";
const ORO = "var(--rmcf-gold-ink, #C8A96B)";
const TINTA = (a: number) => `rgb(var(--rmcf-ink-rgb, 245 247 250) / ${a})`;

/** El color de un percentil: verde por encima de 60, naranja por debajo de 40, gris en medio. */
const colorDe = (p: number) => (p >= 60 ? BIEN : p < 40 ? MAL : TINTA(0.45));

/** Fondo de celda: más intenso cuanto más lejos del 50. */
const fondoDe = (p: number) => {
  const d = Math.min(1, Math.abs(p - 50) / 50);
  const hex = p >= 50 ? "27,158,119" : "217,95,2";

  return `rgba(${hex},${(0.1 + d * 0.55).toFixed(2)})`;
};

const PLURAL: Record<string, string> = { CEN: "Centrales", LAT: "Laterales", MED: "Centrocampistas", BAN: "Extremos", DEL: "Delanteros" };

type Respuesta = { ok: boolean; partidos?: FilaPartido[]; jugadores?: FilaJugador[]; error?: string };

/* ------------------------------------------------------------------ */
/*  PIEZAS                                                             */
/* ------------------------------------------------------------------ */

function Barra({ valor, alto = 6 }: { valor: number; alto?: number }) {
  return (
    <div className="relative w-full overflow-hidden rounded-full bg-white/10" style={{ height: alto }}>
      <div className="absolute inset-y-0 left-1/2 w-px" style={{ background: TINTA(0.25) }} aria-hidden />
      <div className="h-full rounded-full" style={{ width: `${Math.max(3, Math.min(100, valor))}%`, background: colorDe(valor) }} />
    </div>
  );
}

function Indice({ valor, grande = false }: { valor: number; grande?: boolean }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className={`${grande ? "text-5xl sm:text-6xl" : "text-3xl"} font-semibold tabular-nums leading-none`} style={{ color: grande ? ORO : colorDe(valor) }}>
        {valor}
      </span>
      <span className="text-[11px] uppercase tracking-wider text-white/45">{nivel(valor)}</span>
    </div>
  );
}

/** La línea de un índice jornada a jornada, con el 50 de referencia y un punto por partido. */
function Tendencia({ valores, partidos, alto = 80 }: { valores: (number | null)[]; partidos: PartidoEje[]; alto?: number }) {
  const [foco, setFoco] = useState<number | null>(null);
  /* 02/11/2026: más ancha y alta (antes 220×44 en una caja de 44 px: una rayita perdida); crece con su columna. */
  const ancho = 600;
  const paso = valores.length > 1 ? (ancho - 12) / (valores.length - 1) : 0;
  const x = (i: number) => 6 + i * paso;
  const y = (v: number) => 4 + (1 - v / 100) * (alto - 8);
  const puntos = valores.map((v, i) => (v === null ? null : { x: x(i), y: y(v), v, i })).filter((p): p is { x: number; y: number; v: number; i: number } => Boolean(p));
  const camino = puntos.map((p, k) => `${k ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const elegido = foco === null ? null : puntos.find((p) => p.i === foco);

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${ancho} ${alto}`} className="block h-auto max-h-[110px] w-full overflow-visible" role="img" aria-label="Evolución por jornada" onMouseLeave={() => setFoco(null)}>
        <line x1={0} x2={ancho} y1={y(50)} y2={y(50)} stroke={TINTA(0.18)} strokeDasharray="2 3" />
        <path d={camino} fill="none" stroke={ORO} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
        {puntos.map((p) => (
          <g key={p.i} onMouseEnter={() => setFoco(p.i)} onFocus={() => setFoco(p.i)} tabIndex={0}>
            <rect x={p.x - paso / 2} y={0} width={Math.max(paso, 10)} height={alto} fill="transparent" />
            <circle cx={p.x} cy={p.y} r={foco === p.i ? 8 : 5.5} fill={colorDe(p.v)} stroke="var(--rmcf-surface, #11161C)" strokeWidth={1.5} />
          </g>
        ))}
      </svg>
      {elegido && (
        <div
          className="pointer-events-none absolute -top-8 z-10 whitespace-nowrap rounded-md border border-white/10 bg-[#11161C] px-2 py-1 text-[11px] text-white/85 shadow-lg"
          style={{ left: `${(elegido.x / ancho) * 100}%`, transform: "translateX(-50%)" }}
        >
          J{partidos[elegido.i].jornada} · {partidos[elegido.i].rival} {partidos[elegido.i].marcador} · <b>{elegido.v}</b>
        </div>
      )}
    </div>
  );
}

const BRECHA: Record<NonNullable<BloqueMedido["brecha"]>, { texto: string; color: string; icono: typeof AlertTriangle }> = {
  entrenaYNoSale: { texto: "Se entrena y no sale", color: MAL, icono: AlertTriangle },
  saleSinEntrenar: { texto: "Sale sin apenas entrenarlo", color: ORO, icono: Star },
  coherente: { texto: "Se entrena y se ve", color: BIEN, icono: CheckCircle2 },
  niSeEntrenaNiSale: { texto: "Ni se entrena ni sale", color: MAL, icono: TrendingDown },
};

function Brecha({ tipo }: { tipo: BloqueMedido["brecha"] }) {
  if (!tipo) return null;

  const b = BRECHA[tipo];
  const Icono = b.icono;

  return (
    <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium" style={{ borderColor: b.color, color: b.color }}>
      <Icono size={12} aria-hidden />
      {b.texto}
    </span>
  );
}

function TarjetaBloque({ b, partidos }: { b: BloqueMedido; partidos: PartidoEje[] }) {
  return (
    <article className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">{b.fase === "ATAQUE" ? "Con balón" : "Sin balón"}</p>
          <h3 className="text-base font-semibold text-white">{b.label}</h3>
        </div>
        <Brecha tipo={b.brecha} />
      </header>

      <div className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-4">
        <Indice valor={b.indice} />
        <Tendencia valores={b.tendencia} partidos={partidos} />
      </div>

      {b.entreno !== null && (
        <p className="mt-2 text-[12px] text-white/60">
          Le dedicamos el <b className="text-white/90">{b.entreno} %</b> de la semana
          {b.coherencia && Math.abs(b.coherencia.mas - b.coherencia.menos) >= 5 && (
            <>
              {" "}· las semanas que más lo trabajamos salimos en el <b className="text-white/90">{b.coherencia.mas}</b>; las que menos, en el <b className="text-white/90">{b.coherencia.menos}</b>
            </>
          )}
          .
        </p>
      )}

      <ul className="mt-4 space-y-3 border-t border-white/10 pt-3">
        {b.principios.map((p) => (
          <li key={p.id} id={p.id} className="min-w-0 scroll-mt-24 rounded-lg target:bg-[#C8A96B]/10 target:ring-1 target:ring-[#C8A96B]/50">
            <div className="flex items-baseline justify-between gap-3 text-[13px]">
              <span className="min-w-0 text-white/85">
                {p.clave && <Star size={11} className="mr-1 inline -translate-y-px" style={{ color: ORO }} aria-label="Principio clave" />}
                {p.texto}
              </span>
              <span className="shrink-0 font-semibold tabular-nums" style={{ color: colorDe(p.indice) }}>{p.indice}</span>
            </div>
            <div className="mt-1.5">
              <Barra valor={p.indice} alto={5} />
            </div>
            <p className="mt-1 text-[11px] leading-snug text-white/45">
              {p.indicadores.map((i) => `${i.nombre} ${formatea(i.valor, i.unidad)} (categoría ${formatea(i.mediana, i.unidad)})`).join(" · ")}
            </p>
          </li>
        ))}
      </ul>
    </article>
  );
}

/** Entreno contra partido: un punto por fase, cuatro cuadrantes. */
function Cruce({ bloques }: { bloques: BloqueMedido[] }) {
  const [foco, setFoco] = useState<string | null>(null);
  const con = bloques.filter((b) => b.entreno !== null);

  if (con.length < 3) return null;

  const max = Math.max(10, ...con.map((b) => b.entreno as number)) * 1.15;
  const mediaCuota = con.reduce((s, b) => s + (b.entreno as number), 0) / con.length;
  const W = 440;
  const H = 300;
  const M = { l: 36, r: 16, t: 14, b: 34 };
  const x = (v: number) => M.l + (v / max) * (W - M.l - M.r);
  const y = (v: number) => M.t + (1 - v / 100) * (H - M.t - M.b);

  /* Los rótulos que caerían uno encima de otro se separan en vertical (15 px como mínimo). */
  const colocados = con
    .map((b) => ({ b, cx: x(b.entreno as number), cy: y(b.indice), ly: y(b.indice), izq: x(b.entreno as number) > W * 0.6 }))
    .sort((a, c) => a.cy - c.cy);

  /* Caja aproximada de un rótulo: ~6,6 px por letra a 12,5 px. */
  const caja = (c: (typeof colocados)[number]) => {
    const ancho = c.b.label.length * 6.6;
    const x0 = c.izq ? c.cx - 11 - ancho : c.cx + 11;

    return { x0, x1: x0 + ancho, y0: c.ly - 8, y1: c.ly + 8 };
  };
  const pisa = (r: ReturnType<typeof caja>, s: ReturnType<typeof caja>) => r.x0 < s.x1 && s.x0 < r.x1 && r.y0 < s.y1 && s.y0 < r.y1;

  colocados.forEach((c, i) => {
    const puestos = colocados.slice(0, i).map(caja);
    const puntos = colocados.filter((o) => o !== c).map((o) => ({ x0: o.cx - 8, x1: o.cx + 8, y0: o.cy - 8, y1: o.cy + 8 }));
    const lado = c.izq;

    for (const [izq, dy] of [[lado, 0], [!lado, 0], [lado, 15], [!lado, 15], [lado, -15], [!lado, -15], [lado, 30]] as [boolean, number][]) {
      const prueba = { ...c, izq, ly: c.cy + dy };
      const r = caja(prueba);

      if (r.x0 >= M.l && r.x1 <= W - 4 && ![...puestos, ...puntos].some((s) => pisa(r, s))) {
        c.izq = izq;
        c.ly = prueba.ly;

        return;
      }
    }
  });
  const rotulo = (t: string, xx: number, yy: number, ancla: "start" | "end") => (
    <text x={xx} y={yy} textAnchor={ancla} fontSize={11} fill={TINTA(0.38)} fontWeight={600}>
      {t}
    </text>
  );

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Lo que entrenamos frente a lo que sale en el partido">
      <line x1={x(mediaCuota)} x2={x(mediaCuota)} y1={M.t} y2={H - M.b} stroke={TINTA(0.2)} strokeDasharray="3 4" />
      <line x1={M.l} x2={W - M.r} y1={y(50)} y2={y(50)} stroke={TINTA(0.2)} strokeDasharray="3 4" />
      <line x1={M.l} x2={W - M.r} y1={H - M.b} y2={H - M.b} stroke={TINTA(0.25)} />
      <line x1={M.l} x2={M.l} y1={M.t} y2={H - M.b} stroke={TINTA(0.25)} />
      {rotulo("Se entrena y se ve", W - M.r - 4, M.t + 12, "end")}
      {rotulo("Se entrena y no sale", W - M.r - 4, H - M.b - 8, "end")}
      {rotulo("Sale sin entrenarlo", M.l + 6, M.t + 12, "start")}
      {rotulo("Ni se entrena ni sale", M.l + 6, H - M.b - 8, "start")}
      {[0, 50, 100].map((v) => (
        <text key={v} x={M.l - 6} y={y(v) + 4} textAnchor="end" fontSize={10} fill={TINTA(0.45)}>{v}</text>
      ))}
      <text x={(M.l + W - M.r) / 2} y={H - 8} textAnchor="middle" fontSize={11} fill={TINTA(0.55)}>% de la semana de entrenamiento</text>
      {[0, Math.round(max / 2), Math.round(max)].map((v) => (
        <text key={v} x={x(v)} y={H - M.b + 14} textAnchor="middle" fontSize={10} fill={TINTA(0.45)}>{v} %</text>
      ))}
      {colocados.map(({ b, cx, cy, ly, izq }) => {
        return (
          <g key={b.key} onMouseEnter={() => setFoco(b.key)} onMouseLeave={() => setFoco(null)} tabIndex={0} onFocus={() => setFoco(b.key)} onBlur={() => setFoco(null)}>
            <circle cx={cx} cy={cy} r={16} fill="transparent" />
            <circle cx={cx} cy={cy} r={foco === b.key ? 8 : 6} fill={colorDe(b.indice)} stroke="var(--rmcf-surface, #11161C)" strokeWidth={2} />
            <text x={cx + (izq ? -11 : 11)} y={ly + 4} textAnchor={izq ? "end" : "start"} fontSize={12.5} fontWeight={foco === b.key ? 700 : 500} fill={TINTA(0.85)}>
              {b.label}
              {foco === b.key ? ` · ${b.entreno} % · ${b.indice}` : ""}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** Jornada a jornada: una fila por fase, una celda por partido. */
function Mapa({ bloques, partidos }: { bloques: BloqueMedido[]; partidos: PartidoEje[] }) {
  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <table className="w-full min-w-[560px] border-separate text-[12px]" style={{ borderSpacing: 2 }}>
        <thead>
          <tr>
            <th className="w-[34%] text-left font-normal" />
            {partidos.map((p) => (
              <th key={p.fecha} className="px-0.5 pb-1 text-center font-medium text-white/55" title={`${p.rival} ${p.marcador}`}>
                <span className="block">J{p.jornada}</span>
                <span className="block truncate text-[10px] font-normal text-white/35">{p.rival.split(" ")[0]}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bloques.map((b) => (
            <tr key={b.key}>
              <th className="truncate pr-2 text-left font-medium text-white/75">{b.label}</th>
              {b.tendencia.map((v, i) =>
                v === null ? (
                  <td key={i} />
                ) : (
                  <td key={i} className="h-8 rounded-[4px] text-center font-semibold tabular-nums text-white/90" style={{ background: fondoDe(v) }} title={`J${partidos[i].jornada} · ${partidos[i].rival} ${partidos[i].marcador} · ${b.label}: ${v}`}>
                    {v}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FilaJugador({ j }: { j: JugadorEncaje }) {
  const orden = [...j.rasgos].sort((a, b) => b.percentil - a.percentil);
  const fuertes = orden.filter((r) => r.percentil >= 60).slice(0, 2);
  const flojo = [...orden].reverse().find((r) => r.percentil < 40);

  return (
    <li className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 py-2.5 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_auto]">
      <div className="min-w-0">
        <p className="truncate text-[13px] font-medium text-white/90">{j.nombre}</p>
        <p className="text-[11px] text-white/40">{j.minutos.toLocaleString("es-ES")} min</p>
      </div>
      <div className="col-span-2 row-start-2 flex min-w-0 flex-wrap gap-1.5 sm:col-span-1 sm:row-start-auto">
        {fuertes.map((r) => (
          <span key={r.texto} className="rounded-full px-2 py-0.5 text-[11px]" style={{ background: "rgba(27,158,119,.16)", color: TINTA(0.85) }}>
            {r.texto} · {r.percentil}
          </span>
        ))}
        {flojo && (
          <span className="rounded-full px-2 py-0.5 text-[11px]" style={{ background: "rgba(217,95,2,.16)", color: TINTA(0.85) }}>
            {flojo.texto} · {flojo.percentil}
          </span>
        )}
      </div>
      <div className="flex w-24 items-center gap-2 sm:w-32">
        <Barra valor={j.encaje} />
        <span className="w-7 text-right text-sm font-semibold tabular-nums" style={{ color: colorDe(j.encaje) }}>{j.encaje}</span>
      </div>
    </li>
  );
}

function Seccion({ titulo, sub, children }: { titulo: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="min-w-0">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.22em]" style={{ color: ORO }}>{titulo}</h2>
      {sub && <p className="mt-1 text-[13px] text-white/55">{sub}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  PANTALLA                                                           */
/* ------------------------------------------------------------------ */

export function IdentidadCampo() {
  const [estado, setEstado] = useState<{ cargando: boolean; error?: string; datos?: IdentidadEnElCampo | null }>({ cargando: true });
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let vivo = true;

    (async () => {
      try {
        const [data, registro, hoja] = await Promise.all([
          traeJson<Respuesta>("/api/data-analisis", { forzar: intento > 0 }),
          loadRegistro().catch(() => ({ tareas: [], micros: [] })),
          traeCsv(MODELO_CSV, { forzar: intento > 0 })
            .then((t) => Papa.parse<Record<string, string>>(t, { header: true, skipEmptyLines: true }).data)
            .catch(() => null),
        ]);

        if (!vivo) return;

        if (!data.ok || !data.partidos) throw new Error(data.error || "No se han podido leer los partidos.");

        setEstado({ cargando: false, datos: identidadEnElCampo(data.partidos, data.jugadores ?? [], registro.tareas, hoja) });
      } catch (e) {
        if (vivo) setEstado({ cargando: false, error: e instanceof Error ? e.message : "No se ha podido leer." });
      }
    })();

    return () => {
      vivo = false;
    };
  }, [intento]);

  const d = estado.datos;
  const global = useMemo(
    () => (d ? d.partidos.map((_, i) => {
      const v = d.bloques.map((b) => b.tendencia[i]).filter((x): x is number => x !== null);

      return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null;
    }) : []),
    [d],
  );
  const porPuesto = useMemo(() => {
    const m = new Map<string, JugadorEncaje[]>();

    for (const j of d?.jugadores ?? []) m.set(j.puesto, [...(m.get(j.puesto) ?? []), j]);

    return ["CEN", "LAT", "MED", "BAN", "DEL"].filter((k) => m.has(k)).map((k) => ({ puesto: k, lista: m.get(k)! }));
  }, [d]);

  /* 07/11/2026: /game-model enlaza a cada principio con ancla; los datos
     llegan después de que el navegador busque el ancla, así que se salta aquí. */
  useEffect(() => {
    if (!d || typeof window === "undefined") return;

    const id = decodeURIComponent(window.location.hash.slice(1));

    if (id) document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [d]);

  if (estado.cargando) return <LoadingState rows={5} label="Cruzando la identidad con los partidos y la semana…" />;
  if (estado.error) return <ErrorState message={estado.error} onRetry={() => { setEstado({ cargando: true }); setIntento((n) => n + 1); }} />;
  if (!d) return null;

  const ataque = d.bloques.filter((b) => b.fase === "ATAQUE");
  const defensa = d.bloques.filter((b) => b.fase === "DEFENSA");
  const ultimo = d.partidos.at(-1);

  return (
    <div className="space-y-8">
      {/* Cabecera: el índice y su curva */}
      <section className="grid gap-4 rounded-2xl border border-[#C8A96B]/25 bg-white/[0.03] p-4 sm:p-6 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">Índice de identidad</p>
          <div className="mt-2">
            <Indice valor={d.indiceGlobal} grande />
          </div>
          <p className="mt-2 text-[13px] leading-snug text-white/60">
            Cuánto se parece lo que hacemos en el partido a nuestro modelo, de 0 a 100 frente a los {d.equipos} equipos de la categoría.
            {ultimo && <> Hasta la J{ultimo.jornada} ({ultimo.rival}).</>}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/game-model" className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-white/70 hover:text-white">
              Identidad de Juego <ArrowUpRight size={12} aria-hidden />
            </Link>
            <Link href="/data-analisis?area=equipo" className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-white/70 hover:text-white">
              Data análisis <ArrowUpRight size={12} aria-hidden />
            </Link>
            <Link href="/identidad-posicional" className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-white/70 hover:text-white">
              Identidad Posicional <ArrowUpRight size={12} aria-hidden />
            </Link>
          </div>
        </div>
        <div className="min-w-0">
          <p className="mb-2 text-[11px] uppercase tracking-wider text-white/40">Jornada a jornada</p>
          <Tendencia valores={global} partidos={d.partidos} />
          <div className="mt-3 grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-4">
            {d.bloques.map((b) => (
              <div key={b.key} className="min-w-0">
                <div className="flex items-baseline justify-between gap-2 text-[11px]">
                  <span className="truncate text-white/55">{b.label}</span>
                  <span className="font-semibold tabular-nums" style={{ color: colorDe(b.indice) }}>{b.indice}</span>
                </div>
                <div className="mt-1">
                  <Barra valor={b.indice} alto={4} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Conclusiones items={d.conclusiones} titulo="Lo que nos dice" />

      <Explicativo>
        <p className="text-[12px] leading-relaxed text-white/45">
          Cada principio de la Identidad de Juego se mide con sus indicadores de Wyscout y se coloca en percentil contra los equipos de {d.competicion} esta temporada (más alto = más parecido a lo que queremos; en pérdidas, remates en contra, juego largo o PPDA, menos es mejor). La curva compara cada partido con todos los partidos de la categoría. El % de la semana sale del registro de tareas: minutos de cada fase, sin el día de partido, asignados al partido siguiente. El encaje del jugador es la media de sus percentiles contra los de su puesto en la categoría, con más de 270 minutos.
        </p>
      </Explicativo>

      <Seccion titulo="Con balón" sub="Cómo queremos atacar y cuánto se nos ve.">
        <div className="grid gap-4 md:grid-cols-2">
          {ataque.map((b) => <TarjetaBloque key={b.key} b={b} partidos={d.partidos} />)}
        </div>
      </Seccion>

      <Seccion titulo="Sin balón" sub="Cómo queremos defender y cuánto se nos ve.">
        <div className="grid gap-4 md:grid-cols-2">
          {defensa.map((b) => <TarjetaBloque key={b.key} b={b} partidos={d.partidos} />)}
        </div>
      </Seccion>

      {d.bloques.some((b) => b.entreno !== null) && (
        <Seccion titulo="Lo que entrenamos y lo que sale" sub="Cada fase según el tiempo que le damos en la semana y cómo sale en el partido.">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
            <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.03] p-3 sm:p-4">
              <Cruce bloques={d.bloques} />
            </div>
            <ul className="min-w-0 space-y-2">
              {d.bloques.filter((b) => b.entreno !== null).sort((a, b) => (b.entreno ?? 0) - (a.entreno ?? 0)).map((b) => (
                <li key={b.key} className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[13px] font-medium text-white/85">{b.label}</span>
                    <Brecha tipo={b.brecha} />
                  </div>
                  <div className="mt-1.5 grid grid-cols-2 gap-3 text-[11px] text-white/50">
                    <div>
                      <span>Semana · <b className="tabular-nums text-white/80">{b.entreno} %</b></span>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                        <div className="h-full rounded-full" style={{ width: `${Math.min(100, (b.entreno ?? 0) * 3)}%`, background: ORO }} />
                      </div>
                    </div>
                    <div>
                      <span>Partido · <b className="tabular-nums text-white/80">{b.indice}</b></span>
                      <div className="mt-1">
                        <Barra valor={b.indice} />
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </Seccion>
      )}

      <Seccion titulo="Partido a partido" sub="Cada fase en cada jornada: verde, más nuestro; naranja, menos.">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 sm:p-4">
          <Mapa bloques={d.bloques} partidos={d.partidos} />
        </div>
      </Seccion>

      {d.valores.length > 0 && (
        <Seccion titulo="Nuestros valores en el campo" sub="Lo que votó el vestuario, visto en el partido.">
          <div className="grid gap-4 md:grid-cols-3">
            {d.valores.map((v) => (
              <article key={v.key} className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <h3 className="text-base font-semibold text-white">{v.valor}</h3>
                <p className="mt-1 text-[12px] italic leading-snug text-white/55">«{v.conducta.replace(/\.$/, "")}»</p>
                <div className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-4">
                  <Indice valor={v.indice} />
                  <Tendencia valores={v.tendencia} partidos={d.partidos} />
                </div>
                <ul className="mt-3 space-y-2 border-t border-white/10 pt-3">
                  {v.indicadores.map((i) => (
                    <li key={i.nombre}>
                      <div className="flex justify-between gap-2 text-[12px]">
                        <span className="truncate text-white/70">{i.nombre}</span>
                        <span className="tabular-nums text-white/50">{formatea(i.valor, i.unidad)}</span>
                      </div>
                      <div className="mt-1">
                        <Barra valor={i.percentil} alto={4} />
                      </div>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </Seccion>
      )}

      {porPuesto.length > 0 && (
        <Seccion titulo="Cada jugador y su puesto" sub="Cuánto se parece cada uno a lo que pide la Identidad Posicional, frente a los de su puesto en la categoría.">
          <div className="grid gap-4 xl:grid-cols-2">
            {porPuesto.map(({ puesto, lista }) => (
              <div key={puesto} id={`puesto-${puesto}`} className="min-w-0 scroll-mt-24 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 target:ring-1 target:ring-[#C8A96B]/50">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">{PLURAL[puesto] ?? NOMBRE_PUESTO[puesto as keyof typeof NOMBRE_PUESTO]}</p>
                <ul className="divide-y divide-white/10">
                  {lista.map((j) => <FilaJugador key={j.nombre} j={j} />)}
                </ul>
              </div>
            ))}
          </div>
        </Seccion>
      )}
    </div>
  );
}
