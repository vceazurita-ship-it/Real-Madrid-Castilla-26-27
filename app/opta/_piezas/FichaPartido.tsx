"use client";

/**
 * LA FICHA DE UN PARTIDO DEL CASTILLA: los dos equipos cara a cara con las
 * cifras de `opta:partidos` (incluidos los pases al hueco y, si la descarga
 * los trae, las pérdidas en campo propio).
 */

import { useMemo, useState } from "react";

import { MEJOR, ORO, tinta } from "@/components/data/graficas";
import { CASTILLA_OPTA } from "@/lib/opta";
import { fechaCorta, NOMBRE_CASTILLA, partidosDe, valorPartido, type Fila } from "@/lib/opta-analisis";
import { defMetrica, nombreMetrica } from "@/lib/opta-nombres";

import { Elegir, fmt, Panel } from "./comun";
import type { DatosOpta } from "./useOpta";

const METRICAS = [
  "ExpG",
  "ShtIncBl",
  "SOG",
  "Poss%",
  "PsAtt",
  "Pass%",
  "Ps%InA3rd",
  "TouchOpBox",
  "Chance",
  "ThrghBalls",
  "Crosses",
  "PPDA",
  "Recovery",
  "PosWonA3rd",
  "PossLost",
  "PsLostD3",
  "Duel%",
  "Aerial%",
  "CrnrWon",
  "FoulCom",
  "Saves",
];

export function FichaPartido({ datos }: { datos: DatosOpta }) {
  const { partidos, catalogo } = datos;
  const nuestros = useMemo(() => partidosDe(partidos, CASTILLA_OPTA).filter((p) => p.otra), [partidos]);
  const [elegido, setElegido] = useState("");
  const visto = nuestros.find((p) => String(p.fila.partido) === elegido) ?? nuestros[nuestros.length - 1];
  if (!visto?.otra) return null;
  const a: Fila = visto.fila;
  const b: Fila = visto.otra;
  const metricas = METRICAS.filter((k) => k in a);

  return (
    <Panel
      titulo="Un partido, cara a cara"
      subtitulo={`${fechaCorta(visto.fecha)} · ${NOMBRE_CASTILLA} ${visto.gf ?? ""}-${visto.gc ?? ""} ${visto.rival}`}
      derecha={
        <Elegir
          etiqueta="Partido"
          valor={String(visto.fila.partido)}
          alCambiar={setElegido}
          opciones={[...nuestros].reverse().map((p) => ({
            clave: String(p.fila.partido),
            nombre: `${fechaCorta(p.fecha)} · ${p.rival} (${p.gf ?? ""}-${p.gc ?? ""})`,
          }))}
        />
      }
    >
      <div className="mx-auto max-w-3xl">
        <div className="mb-2 flex items-baseline justify-between text-sm font-semibold">
          <span style={{ color: ORO }}>{NOMBRE_CASTILLA}</span>
          <span className="text-white/80">{visto.rival}</span>
        </div>
        {metricas.map((k) => {
          const def = defMetrica(k, catalogo);
          const va = valorPartido(a, k, catalogo);
          const vb = valorPartido(b, k, catalogo);
          if (va == null && vb == null) return null;
          const total = Math.abs(va ?? 0) + Math.abs(vb ?? 0);
          const parteA = total > 0 ? (Math.abs(va ?? 0) / total) * 100 : 50;
          const ganaA = def.mejor === null || va == null || vb == null || va === vb ? null : def.mejor ? va > vb : va < vb;
          return (
            <div key={k} className="border-b border-white/[0.06] py-1.5 last:border-0">
              <div className="flex items-baseline gap-2 text-[13px] tabular-nums">
                <span className={`w-16 shrink-0 ${ganaA === true ? "font-semibold text-white" : "text-white/70"}`}>{fmt(va, def.unidad)}</span>
                <span className="min-w-0 flex-1 truncate text-center text-[12px] text-white/60">
                  {nombreMetrica(k, catalogo)}
                  {def.mejor === false && <span className="ml-1 text-[10px] text-white/40">(menos es mejor)</span>}
                </span>
                <span className={`w-16 shrink-0 text-right ${ganaA === false ? "font-semibold text-white" : "text-white/70"}`}>{fmt(vb, def.unidad)}</span>
              </div>
              {total > 0 && (
                <div className="mt-1 flex h-1.5 overflow-hidden rounded-full" style={{ background: tinta(0.08) }}>
                  <span style={{ width: `${parteA}%`, background: "#C8A96B" }} />
                  <span style={{ width: `${100 - parteA}%`, background: ganaA === false ? MEJOR : tinta(0.3) }} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
