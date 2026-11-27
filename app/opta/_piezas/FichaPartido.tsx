"use client";

/**
 * UN PARTIDO, CARA A CARA: los dos equipos fila a fila con las cifras de
 * `opta:partidos` (y alguna derivada: xG por remate, acierto en balones
 * largos, pases por secuencia), en barras enfrentadas desde el centro: en
 * cada fila, la barra más larga es la mayor de las dos y el que sale mejor
 * va en color pleno.
 *
 * - `CaraACara`: cualquier partido de la categoría, visto desde `teamId`
 *   (a la izquierda) contra su rival. Lo usa la pestaña «Partidos»; con
 *   `conAbp` añade el % de córners que acaban en remate (de
 *   `opta:abp-eventos`, que se pide sólo entonces).
 * - `FichaPartido`: la del Castilla, con su selector y el momentum.
 *
 * Opta no dice quién jugaba en casa: el equipo elegido va a la izquierda.
 */

import { useMemo, useState } from "react";

import { COMPARADO, ORO, tinta } from "@/components/data/graficas";
import { useDocsOpta } from "@/hooks/useDocsOpta";
import { CASTILLA_OPTA, DOCS_OPTA, type TablaOpta } from "@/lib/opta";
import { fechaCorta, NOMBRE_CASTILLA, nombreEquipo, partidosDe, type Fila } from "@/lib/opta-analisis";
import { resumenSaques, saquesDe } from "@/lib/opta-eventos";
import { defDe, valorDe } from "@/lib/opta-evolucion";
import type { DefMetrica } from "@/lib/opta-nombres";

import { Elegir, fmt, Panel } from "./comun";
import { usePista, useRemates } from "./eventos";
import { Momentum } from "./Momentum";
import type { DatosOpta } from "./useOpta";

/** Las filas del cara a cara, en el orden en que se leen: ataque, juego, presión, defensa, ABP. */
const METRICAS = [
  "Goal",
  "ExpG",
  "ShtIncBl",
  "SOG",
  "·xGRemate",
  "TouchOpBox",
  "SeqEndInA3",
  "ThrghBalls",
  "Crosses",
  "Poss%",
  "Pass%",
  "·LargosOk",
  "·PasesSecuencia",
  "PPDA",
  "PosWonA3rd",
  "PsLostD3",
  "Duel%",
  "Aerial%",
  "GA",
  "ExpGAg",
  "ShotsAg",
  "CrnrWon",
];

/** Los dos lados de un partido: `teamId` y el otro. */
function ladosDe(partidos: Fila[], partido: string, teamId: string): [Fila, Fila] | null {
  const filas = partidos.filter((f) => String(f.partido ?? "") === partido);
  const a = filas.find((f) => f.teamId === teamId);
  const b = filas.find((f) => f.teamId !== teamId);
  return a && b ? [a, b] : null;
}

export function CaraACara({
  datos,
  partido,
  teamId,
  conAbp = false,
  principales,
  conMedia = false,
}: {
  datos: DatosOpta;
  partido: string;
  teamId: string;
  conAbp?: boolean;
  /**
   * 16/11/2026 (Data análisis, ronda 17): las filas que se ven de entrada; el
   * resto, plegado bajo «Ver todas». Sin darlo, salen todas como siempre.
   */
  principales?: string[];
  /**
   * 18/11/2026 (Data análisis, ronda 22): en cada barra, una raya fina con la
   * media de la temporada de ese equipo (sus otros partidos de Opta, con tres
   * o más), y la cifra debajo del nombre. Sin darlo, como siempre.
   */
  conMedia?: boolean;
}) {
  const { partidos, catalogo } = datos;
  const lados = useMemo(() => ladosDe(partidos, partido, teamId), [partidos, partido, teamId]);
  const otros = useMemo(() => {
    if (!conMedia || !lados) return null;
    const de = (id: unknown) => partidos.filter((f) => f.teamId === id && String(f.partido ?? "") !== partido);
    return { a: de(lados[0].teamId), b: de(lados[1].teamId) };
  }, [conMedia, lados, partidos, partido]);
  if (!lados) return null;
  const [a, b] = lados;
  const media = (filas: Fila[] | undefined, k: string) => {
    if (!filas) return null;
    const vs = filas.map((f) => valorDe(f, k, catalogo)).filter((v): v is number => v != null);
    return vs.length >= 3 ? vs.reduce((s, v) => s + v, 0) / vs.length : null;
  };
  const nMedia = otros ? Math.min(otros.a.length, otros.b.length) : 0;
  /*
  | 18/11/2026 (ronda 23, fútbol y guionista): cada media dice de quién es y de
  | cuántos partidos sale («nuestra media 1,6 en los otros 11 · su media 1,1
  | en sus otros 11»), en la primera fila; la leyenda, arriba.
  */
  const esNuestro = a.teamId === CASTILLA_OPTA;
  const quienA = esNuestro ? "nuestra media" : "media";
  const quienB = esNuestro ? "su media" : "media";
  const primera = (principales ?? METRICAS).find((k) => k in a || k.startsWith("·"));
  const fila = (k: string) =>
    k in a || k.startsWith("·") ? (
      <FilaCara
        key={k}
        def={defDe(k, catalogo)}
        va={valorDe(a, k, catalogo)}
        vb={valorDe(b, k, catalogo)}
        ma={media(otros?.a, k)}
        mb={media(otros?.b, k)}
        rotMedia={[
          [quienA, k === primera && otros ? ` en los otros ${otros.a.length}` : ""],
          [quienB, k === primera && otros ? ` en sus otros ${otros.b.length}` : ""],
        ]}
        unDecimal={k === "ExpG" || k === "ExpGAg"}
      />
    ) : null;
  const resto = principales ? METRICAS.filter((k) => !principales.includes(k) && (k in a || k.startsWith("·"))) : [];

  return (
    <div className="mx-auto max-w-3xl">
      {conMedia && nMedia >= 3 && otros && (
        <p className="mb-2 flex flex-wrap items-center gap-x-1.5 text-[12px] leading-snug text-white/65">
          {/* 27/11/2026 (ronda 9, fútbol): la muestra lleva su pista y su barra; la raya sola parecía un trazo suelto. */}
          <span aria-hidden className="relative inline-block h-2 w-8 shrink-0 overflow-visible rounded-full" style={{ background: "rgb(var(--rmcf-ink-rgb) / .08)" }}>
            <span className="absolute inset-y-0 left-0 w-5 rounded-full" style={{ background: ORO, opacity: 0.7 }} />
            <span className="absolute -inset-y-0.5 left-[60%] w-0.5 rounded-full" style={{ background: "rgb(var(--rmcf-ink-rgb) / .85)" }} />
          </span>
          <span>
            La raya fina es la media de la temporada de cada equipo sin este partido (Opta): {esNuestro ? "la nuestra" : nombreEquipo(a)}, en los otros {otros.a.length};{" "}
            {esNuestro ? "la suya" : nombreEquipo(b)}, en sus otros {otros.b.length}
            {nMedia < 15 ? " (tendencia)" : ""}.
          </span>
        </p>
      )}
      <div className="mb-2 flex items-baseline justify-between gap-3 text-sm font-semibold">
        <span className="min-w-0 truncate" style={{ color: ORO }}>
          {nombreEquipo(a)}
        </span>
        <span className="min-w-0 truncate text-right" style={{ color: COMPARADO }}>
          {nombreEquipo(b)}
        </span>
      </div>
      {principales ? (
        <>
          {principales.map(fila)}
          {resto.length > 0 && (
            <details className="group mt-1">
              <summary className="inline-flex min-h-[36px] cursor-pointer list-none items-center rounded-lg px-1 text-[12px] font-medium text-[#C8A96B] [&::-webkit-details-marker]:hidden">
                <span className="group-open:hidden">Ver todas las cifras ({resto.length} más)</span>
                <span className="hidden group-open:inline">Ver sólo las principales</span>
              </summary>
              {resto.map(fila)}
              {conAbp && <FilaCorners datos={datos} partido={partido} a={String(a.teamId)} b={String(b.teamId)} />}
            </details>
          )}
        </>
      ) : (
        <>
          {METRICAS.map(fila)}
          {conAbp && <FilaCorners datos={datos} partido={partido} a={String(a.teamId)} b={String(b.teamId)} />}
        </>
      )}
      <p className="mt-2 text-xs text-white/45">
        En cada fila, la barra más larga es la mayor de las dos y el que sale mejor va en color pleno (↓ menos es mejor). En las de estilo (posesión, centros, pases por
        secuencia) no hay mejor ni peor.{"PPDA" in a ? " PPDA: pases que deja dar el rival antes de que presionemos; menos es más presión." : ""}
        {/* 18/11/2026 (ronda 23): la leyenda de la media, arriba del cara a cara. */}
      </p>
    </div>
  );
}

function FilaCara({
  def,
  va,
  vb,
  ma = null,
  mb = null,
  unDecimal = false,
  rotMedia = [
    ["media", ""],
    ["media", ""],
  ],
}: {
  def: DefMetrica;
  va: number | null;
  vb: number | null;
  /** La media de la temporada de cada lado (18/11/2026): raya fina en su barra. */
  ma?: number | null;
  mb?: number | null;
  unDecimal?: boolean;
  /** 18/11/2026 (ronda 23): de quién es cada media y su base («nuestra media», « en los otros 11»). */
  rotMedia?: [[string, string], [string, string]];
}) {
  if (va == null && vb == null) return null;
  /* 10/11/2026: los goles esperados con un decimal en toda la pantalla. */
  const cifra = (v: number | null) => (unDecimal && v != null ? v.toFixed(1).replace(".", ",") : fmt(v, def.unidad));
  /* La media, siempre con un decimal (una media de remates no es un entero). */
  const cifraMedia = (v: number) => (def.unidad === "porcentaje" ? fmt(v, "porcentaje") : v.toFixed(1).replace(".", ","));
  const tope = Math.max(Math.abs(va ?? 0), Math.abs(vb ?? 0), Math.abs(ma ?? 0), Math.abs(mb ?? 0));
  const ancho = (v: number | null) => (tope > 0 && v != null ? (Math.abs(v) / tope) * 100 : 0);
  const raya = (v: number | null, lado: "izq" | "der") =>
    v == null ? null : (
      <span
        aria-hidden
        className="absolute -inset-y-0.5 w-0.5 rounded-full"
        style={{ [lado === "izq" ? "right" : "left"]: `calc(${ancho(v)}% - 1px)`, background: "rgb(var(--rmcf-ink-rgb) / .85)" }}
      />
    );
  const ganaA = def.mejor === null || va == null || vb == null || va === vb ? null : def.mejor ? va > vb : va < vb;
  const opacidad = (esA: boolean) => (ganaA === null ? 0.6 : ganaA === esA ? 1 : 0.3);
  return (
    <div className="border-b border-white/[0.06] py-1.5 last:border-0">
      <div className="flex items-baseline gap-2 text-[13px] tabular-nums">
        <span className={`w-16 shrink-0 ${ganaA === true ? "font-semibold text-white" : "text-white/70"}`}>{cifra(va)}</span>
        <span className="line-clamp-2 min-w-0 flex-1 text-center text-[12px] leading-tight text-white/60">
          {def.nombre}
          {def.mejor === false && <span className="ml-1 text-xs text-white/40">↓</span>}
        </span>
        <span className={`w-16 shrink-0 text-right ${ganaA === false ? "font-semibold text-white" : "text-white/70"}`}>{cifra(vb)}</span>
      </div>
      {tope > 0 && (
        <div className="mt-1 flex h-2 gap-0.5" aria-hidden>
          <div className="relative flex-1">
            <div className="flex h-full justify-end overflow-hidden rounded-l-full" style={{ background: tinta(0.06) }}>
              <span className="rounded-l-full" style={{ width: `${ancho(va)}%`, background: ORO, opacity: opacidad(true) }} />
            </div>
            {raya(ma, "izq")}
          </div>
          <div className="relative flex-1">
            <div className="flex h-full overflow-hidden rounded-r-full" style={{ background: tinta(0.06) }}>
              <span className="rounded-r-full" style={{ width: `${ancho(vb)}%`, background: COMPARADO, opacity: opacidad(false) }} />
            </div>
            {raya(mb, "der")}
          </div>
        </div>
      )}
      {(ma != null || mb != null) && (
        <div className="mt-0.5 flex justify-between gap-3 text-[11px] tabular-nums text-white/60">
          <span>{ma != null ? `${rotMedia[0][0]} ${cifraMedia(ma)}${rotMedia[0][1]}` : ""}</span>
          <span className="text-right">{mb != null ? `${rotMedia[1][0]} ${cifraMedia(mb)}${rotMedia[1][1]}` : ""}</span>
        </div>
      )}
    </div>
  );
}

const DEF_CORNERS: DefMetrica = { nombre: "Córners que acaban en remate", unidad: "porcentaje", tasa: true, mejor: true };

/** % de córners que acaban en remate en la misma jugada, de cada equipo (con `opta:abp-eventos`). */
function FilaCorners({ datos, partido, a, b }: { datos: DatosOpta; partido: string; a: string; b: string }) {
  const pista = usePista(datos);
  const { remates } = useRemates(datos);
  const { docs } = useDocsOpta<[TablaOpta]>(DOCS_OPTA.abpEventos);
  const saques = useMemo(() => (docs[0] && remates.length ? saquesDe(docs[0], remates, pista) : []), [docs, remates, pista]);
  if (!saques.length) return null;
  const deUno = (id: string) => {
    const r = resumenSaques(saques.filter((s) => s.partido === partido && s.teamId === id && s.abp === "corner"));
    return r.n && r.pctRemate != null ? r.pctRemate * 100 : null;
  };
  return <FilaCara def={DEF_CORNERS} va={deUno(a)} vb={deUno(b)} />;
}

/** La ficha del Castilla: sus partidos, el cara a cara y el momentum. */
export function FichaPartido({ datos }: { datos: DatosOpta }) {
  const { partidos } = datos;
  const nuestros = useMemo(() => partidosDe(partidos, CASTILLA_OPTA).filter((p) => p.otra), [partidos]);
  const [elegido, setElegido] = useState("");
  const visto = nuestros.find((p) => String(p.fila.partido) === elegido) ?? nuestros[nuestros.length - 1];
  if (!visto?.otra) return null;
  const partido = String(visto.fila.partido);

  return (
    <Panel
      titulo="Un partido, cara a cara"
      subtitulo={`${fechaCorta(visto.fecha)} · ${NOMBRE_CASTILLA} ${visto.gf ?? ""}-${visto.gc ?? ""} ${visto.rival}`}
      derecha={
        <Elegir
          etiqueta="Partido"
          valor={partido}
          alCambiar={setElegido}
          opciones={[...nuestros].reverse().map((p) => ({
            clave: String(p.fila.partido),
            nombre: `${fechaCorta(p.fecha)} · ${p.rival} (${p.gf ?? ""}-${p.gc ?? ""})`,
          }))}
        />
      }
    >
      <CaraACara datos={datos} partido={partido} teamId={CASTILLA_OPTA} />
      <Momentum datos={datos} partido={partido} teamId={CASTILLA_OPTA} />
    </Panel>
  );
}
