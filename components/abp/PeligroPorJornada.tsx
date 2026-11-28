"use client";

/*
| GOL U OCASIÓN, PARTIDO A PARTIDO (28/11/2026, jueces de estilo).
| Vivía dentro de app/setpieces/page.tsx; se saca aquí para que ABP defensivo
| tenga el mismo gráfico (con «menos es mejor»). Una columna por partido con
| el % que acaba en gol u ocasión, «a» sobre «b» siempre a la vista, raya
| mínima para el 0, gris con menos de 10 acciones y el último partido en oro.
*/

import { comparaCronologico } from "@/lib/abp/analisis";
import { COLOR_DESENLACE, type FilaVisualAbp } from "@/components/abp/VisualAbp";

/** 27/11/2026 (jueces, ronda 10): por debajo, la columna de un partido se pinta en gris, como tendencia. */
const MUESTRA_COLUMNA = 10;

export function PeligroPorJornada({
  filas,
  marca,
  todas = [],
  defensivo = false,
}: {
  filas: FilaVisualAbp[];
  marca: string | null;
  todas?: FilaVisualAbp["jornada"][];
  /** 28/11/2026 (jueces, estilo): la versión de ABP defensivo. «exito» es gol u ocasión DEL RIVAL: columnas en naranja y «menos es mejor». */
  defensivo?: boolean;
}) {
  const colorColumna = defensivo ? COLOR_DESENLACE.peor : COLOR_DESENLACE.mejor;
  const porJornada = new Map<string, { jornada: FilaVisualAbp["jornada"]; n: number; k: number }>();
  const competiciones = new Set(filas.map((f) => f.jornada.competicion));
  for (const j of todas) {
    if (j.clave && competiciones.has(j.competicion)) porJornada.set(j.clave, { jornada: j, n: 0, k: 0 });
  }
  for (const f of filas) {
    if (!f.jornada.clave) continue;
    const g = porJornada.get(f.jornada.clave) ?? { jornada: f.jornada, n: 0, k: 0 };
    g.n += 1;
    if (f.exito) g.k += 1;
    porJornada.set(f.jornada.clave, g);
  }
  const partidos = [...porJornada.values()].sort((x, y) => comparaCronologico(x.jornada, y.jornada));
  const conAcciones = partidos.filter((p) => p.n > 0);
  if (conAcciones.length < 3) return null;
  const totalN = partidos.reduce((t, p) => t + p.n, 0);
  const totalK = partidos.reduce((t, p) => t + p.k, 0);
  const media = totalN ? (totalK / totalN) * 100 : 0;
  const tope = Math.max(media, ...conAcciones.map((p) => (p.k / p.n) * 100), 1);
  const alto = (v: number) => `${(v / tope) * 100}%`;
  /* 27/11/2026 (jueces, ronda 9): un decimal, como la conclusión (26,6 %, no 27 % en la raya). */
  const pcTxt = (v: number) => `${(Math.round(v * 10) / 10).toLocaleString("es-ES", { maximumFractionDigits: 1 })} %`;
  return (
    <figure className="mt-3 min-w-0 rounded-2xl border border-white/10 bg-white/[0.02] px-3 py-3 sm:px-4">
      <figcaption className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/60">{defensivo ? "Gol u ocasión del rival, partido a partido · menos es mejor" : "Gol u ocasión, partido a partido"}</span>
        <span className="text-[12px] text-white/70">
          Raya discontinua: la media, {pcTxt(media)} ({totalK} de {totalN} acciones)
        </span>
      </figcaption>
      <div className="min-w-0 overflow-x-auto">
        <div
          className="relative mt-2 flex h-28 items-end gap-1 px-0.5"
          /* 27/11/2026 (jueces, ronda 10): a 390 px se cortaba en J10 y la J13 en oro no se veía; 20 px por columna caben las 13. */
          style={{ minWidth: partidos.length * 20 }}
          role="img"
          aria-label={`Gol u ocasión por partido: ${partidos.map((p) => (p.n ? `${p.jornada.corto} ${p.k} de ${p.n}` : `${p.jornada.corto} sin acciones`)).join(", ")}; media ${pcTxt(media)} (${totalK} de ${totalN})`}
        >
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 border-t border-dashed"
            style={{ bottom: `calc(${alto(media)} * 0.8)`, borderColor: "rgb(var(--rmcf-ink-rgb) / .5)" }}
          />
          {partidos.map((p) => {
            const v = p.n ? (p.k / p.n) * 100 : 0;
            const marcada = marca === p.jornada.clave;
            /* 27/11/2026 (jueces, ronda 10): con menos de 10 acciones el % es tendencia: en gris, no igual que J01–J05. */
            const corta = p.n > 0 && p.n < MUESTRA_COLUMNA;
            return (
              <div
                key={p.jornada.clave}
                className="flex h-full min-w-0 flex-1 flex-col items-center justify-end"
                title={p.n ? `${p.jornada.etiqueta}: ${p.k} de ${p.n} (${pcTxt(v)})${corta ? " · tendencia, pocas acciones" : ""}` : `${p.jornada.etiqueta}: sin acciones con estos filtros`}
              >
                {/* 28/11/2026 (jueces, estilo): «a/b» SIEMPRE a la vista, en dos pisos (a encima de b) para que quepa en 20 px sin pisarse; antes las columnas cortas salían sin rótulo y J06–J12 se leían como «sin datos». */}
                <span
                  className={`mb-0.5 flex flex-col items-center whitespace-nowrap text-[10px] leading-[1.05] tabular-nums ${marcada ? "font-bold" : corta ? "text-white/50" : "text-white/75"}`}
                  style={marcada ? { color: "var(--rmcf-gold-ink)" } : undefined}
                >
                  {!p.n ? <span className="text-[9px]">sin acc.</span> : <><span>{p.k}</span><span className="border-t px-[1px] text-[9px]" style={{ borderColor: "currentColor" }}>{p.n}</span></>}
                </span>
                <div
                  className="w-full max-w-[28px] rounded-t-[3px]"
                  style={{
                    /* 28/11/2026 (jueces, estilo): el 0 % lleva una raya mínima de 3 px, visible en día y en noche. */
                    height: v > 0 ? `calc(${alto(v)} * 0.8)` : p.n ? "3px" : "2px",
                    background: v > 0 ? (marcada ? COLOR_DESENLACE.oro : corta ? "rgb(var(--rmcf-ink-rgb) / .3)" : colorColumna) : p.n ? (marcada ? COLOR_DESENLACE.oro : "rgb(var(--rmcf-ink-rgb) / .45)") : "transparent",
                    borderTop: p.n ? undefined : "1px dashed rgb(var(--rmcf-ink-rgb) / .3)",
                    outline: marcada ? "2px solid var(--rmcf-gold-ink)" : undefined,
                    outlineOffset: 1,
                  }}
                />
              </div>
            );
          })}
        </div>
        <div className="mt-1 flex gap-1 px-0.5" style={{ minWidth: partidos.length * 20 }} aria-hidden>
          {partidos.map((p) => (
            <span
              key={p.jornada.clave}
              className={`min-w-0 flex-1 text-center text-[10.5px] tabular-nums ${marca === p.jornada.clave ? "font-bold" : "text-white/55"}`}
              style={marca === p.jornada.clave ? { color: "var(--rmcf-gold-ink)" } : undefined}
            >
              {p.jornada.corto}
            </span>
          ))}
        </div>
      </div>
      <p className="mt-1.5 text-[12px] leading-snug text-white/65">
        Cada columna, el % de un partido; encima, «a» sobre «b»: las que acaban en gol u ocasión{defensivo ? " del rival" : ""} (a) de las del partido (b); un 0 es la raya baja.{" "}
        <span className="inline-flex items-center gap-1 align-middle"><span className="inline-block h-2 w-2 rounded-sm" style={{ background: colorColumna }} aria-hidden />{MUESTRA_COLUMNA} acciones o más</span>
        {conAcciones.some((p) => p.n < MUESTRA_COLUMNA) ? (
          <>
            {" · "}
            <span className="inline-flex items-center gap-1 align-middle"><span className="inline-block h-2 w-2 rounded-sm" style={{ background: "rgb(var(--rmcf-ink-rgb) / .3)" }} aria-hidden />gris: menos de {MUESTRA_COLUMNA}, tendencia{defensivo ? ", pocas acciones" : " (un 0/2 no es una carencia)"}</span>
          </>
        ) : null}
        {marca && partidos.some((p) => p.jornada.clave === marca) ? (
          <>
            {" · "}
            <span className="inline-flex items-center gap-1 align-middle"><span className="inline-block h-2 w-2 rounded-sm" style={{ background: COLOR_DESENLACE.oro }} aria-hidden />dorado: el último partido</span>
          </>
        ) : null}
        . La tendencia de los 3 últimos, en «¿Va a mejor?».
      </p>
    </figure>
  );
}
