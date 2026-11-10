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

export function CaraACara({ datos, partido, teamId, conAbp = false }: { datos: DatosOpta; partido: string; teamId: string; conAbp?: boolean }) {
  const { partidos, catalogo } = datos;
  const lados = useMemo(() => ladosDe(partidos, partido, teamId), [partidos, partido, teamId]);
  if (!lados) return null;
  const [a, b] = lados;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-2 flex items-baseline justify-between gap-3 text-sm font-semibold">
        <span className="min-w-0 truncate" style={{ color: ORO }}>
          {nombreEquipo(a)}
        </span>
        <span className="min-w-0 truncate text-right" style={{ color: COMPARADO }}>
          {nombreEquipo(b)}
        </span>
      </div>
      {METRICAS.map((k) =>
        k in a || k.startsWith("·") ? <FilaCara key={k} def={defDe(k, catalogo)} va={valorDe(a, k, catalogo)} vb={valorDe(b, k, catalogo)} /> : null,
      )}
      {conAbp && <FilaCorners datos={datos} partido={partido} a={String(a.teamId)} b={String(b.teamId)} />}
      <p className="mt-2 text-[11px] text-white/45">
        En cada fila, la barra más larga es la mayor de las dos y el que sale mejor va en color pleno (↓ menos es mejor). En las de estilo (posesión, centros, pases por
        secuencia) no hay mejor ni peor.
      </p>
    </div>
  );
}

function FilaCara({ def, va, vb }: { def: DefMetrica; va: number | null; vb: number | null }) {
  if (va == null && vb == null) return null;
  const tope = Math.max(Math.abs(va ?? 0), Math.abs(vb ?? 0));
  const ancho = (v: number | null) => (tope > 0 && v != null ? (Math.abs(v) / tope) * 100 : 0);
  const ganaA = def.mejor === null || va == null || vb == null || va === vb ? null : def.mejor ? va > vb : va < vb;
  const opacidad = (esA: boolean) => (ganaA === null ? 0.6 : ganaA === esA ? 1 : 0.3);
  return (
    <div className="border-b border-white/[0.06] py-1.5 last:border-0">
      <div className="flex items-baseline gap-2 text-[13px] tabular-nums">
        <span className={`w-16 shrink-0 ${ganaA === true ? "font-semibold text-white" : "text-white/70"}`}>{fmt(va, def.unidad)}</span>
        <span className="min-w-0 flex-1 truncate text-center text-[12px] text-white/60">
          {def.nombre}
          {def.mejor === false && <span className="ml-1 text-[10px] text-white/40">↓</span>}
        </span>
        <span className={`w-16 shrink-0 text-right ${ganaA === false ? "font-semibold text-white" : "text-white/70"}`}>{fmt(vb, def.unidad)}</span>
      </div>
      {tope > 0 && (
        <div className="mt-1 flex h-2 gap-0.5" aria-hidden>
          <div className="flex flex-1 justify-end overflow-hidden rounded-l-full" style={{ background: tinta(0.06) }}>
            <span className="rounded-l-full" style={{ width: `${ancho(va)}%`, background: ORO, opacity: opacidad(true) }} />
          </div>
          <div className="flex flex-1 overflow-hidden rounded-r-full" style={{ background: tinta(0.06) }}>
            <span className="rounded-r-full" style={{ width: `${ancho(vb)}%`, background: COMPARADO, opacity: opacidad(false) }} />
          </div>
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
