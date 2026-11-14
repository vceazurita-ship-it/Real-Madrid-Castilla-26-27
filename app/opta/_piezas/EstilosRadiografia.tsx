"use client";

/**
 * RADIOGRAFÍA DEL EQUIPO (pestaña «Estilos», 10/11/2026): una «pizza» de 22
 * métricas por partido en cinco familias; el largo de cada porción es su
 * percentil (P0-P100, dado la vuelta donde menos es mejor) contra su grupo o
 * toda la categoría, y en el centro la nota de juego (la media). SVG propio.
 * Las cuentas, en `radiografia` (`lib/opta-estilos.ts`).
 */

import { forwardRef, useMemo, useState } from "react";

import { ORO, tinta, useEscudos } from "@/components/data/graficas";
import { CASTILLA_OPTA } from "@/lib/opta";
import { nombreEquipo } from "@/lib/opta-analisis";
import { EN_LA_NOTA, FAMILIAS_RADIOGRAFIA, radiografia, type Familia } from "@/lib/opta-estilos";
import { cortoMetrica, defMetrica, nombreMetrica, type DefMetrica } from "@/lib/opta-nombres";

import { Botonera, Elegir, fmt, Panel } from "./comun";

/** «1,45 por partido · P62», sin la parte que no tenga dato (nada de una «P» suelta). */
const conP = (v: number | null, def: DefMetrica, p: number | null, sufijo = false) =>
  [v != null ? `${fmt(v, def.unidad)}${sufijo && !def.tasa ? " por partido" : ""}` : "", p != null ? `P${p}` : ""].filter(Boolean).join(" · ");
import { equiposDe } from "./eventos";
import type { DatosOpta } from "./useOpta";

/** Un color por familia (gráfico, no fondo: vale en día y en noche). */
export const COLOR_FAMILIA: Record<Familia, string> = {
  ataque: "#E0614B",
  progresion: "#E3A33B",
  posesion: "#4F8FE8",
  defensa: "#2BA88E",
  abp: "#9B6FD6",
};

const T = 760;
const C = T / 2;
const R0 = 58;
const R = 250;
const HUECO = 0.012;
const MARGEN_X = 70;

const polar = (r: number, a: number) => [C + r * Math.sin(a), C - r * Math.cos(a)] as const;
function sector(r1: number, r2: number, a1: number, a2: number) {
  const [x1, y1] = polar(r2, a1);
  const [x2, y2] = polar(r2, a2);
  const [x3, y3] = polar(r1, a2);
  const [x4, y4] = polar(r1, a1);
  const grande = a2 - a1 > Math.PI ? 1 : 0;
  return `M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${r2} ${r2} 0 ${grande} 1 ${x2.toFixed(1)} ${y2.toFixed(1)} L ${x3.toFixed(1)} ${y3.toFixed(1)} A ${r1} ${r1} 0 ${grande} 0 ${x4.toFixed(1)} ${y4.toFixed(1)} Z`;
}

type Escala = "grupo" | "todos";

/* Sin `alCambiar`, el equipo viene fijado de fuera (Scout colectivo) y no sale el desplegable. */
export const Radiografia = forwardRef<HTMLDivElement, { datos: DatosOpta; teamId: string; alCambiar?: (t: string) => void }>(function Radiografia(
  { datos, teamId, alCambiar },
  ref,
) {
  const { equipos, grupos, catalogo } = datos;
  const escudoDe = useEscudos();
  const [escala, setEscala] = useState<Escala>("grupo");
  const lista = useMemo(() => equiposDe(datos), [datos]);
  const fila = equipos.find((f) => f.teamId === teamId) ?? equipos.find((f) => f.teamId === CASTILLA_OPTA) ?? equipos[0];
  const id = String(fila?.teamId ?? "");
  const grupo = grupos.get(id);

  const muestra = useMemo(
    () => (escala === "todos" || grupo == null ? equipos : equipos.filter((f) => grupos.get(String(f.teamId ?? "")) === grupo)),
    [equipos, grupos, grupo, escala],
  );
  const rx = useMemo(() => (fila ? radiografia(fila, muestra, catalogo) : null), [fila, muestra, catalogo]);
  const [encima, setEncima] = useState<string | null>(null);

  if (!fila || !rx) return null;
  const nombre = nombreEquipo(fila);
  const escudo = escudoDe(nombre);
  const n = rx.porciones.length;
  const paso = (2 * Math.PI) / n;
  const contra = escala === "todos" || grupo == null ? "toda la categoría" : grupo === 1 ? "el grupo del Castilla" : "su grupo";
  const vista = rx.porciones.find((p) => p.a === encima);

  return (
    <div ref={ref} className="scroll-mt-40">
      <Panel
        titulo={
          <span className="inline-flex items-center gap-2">
            {escudo && (
              // eslint-disable-next-line @next/next/no-img-element -- escudo pequeño por el proxy propio
              <img src={escudo} alt="" width={22} height={22} className="h-[22px] w-[22px] object-contain" />
            )}
            Radiografía · <span style={id === CASTILLA_OPTA ? { color: ORO } : undefined}>{nombre}</span>
          </span>
        }
        subtitulo={`22 métricas por partido. El largo de cada porción es su percentil contra ${contra}: P80 es estar por encima del 80 %. Donde menos es mejor (xG y remates en contra, PPDA, ocasiones de ABP concedidas) se da la vuelta.`}
        derecha={
          <>
            {alCambiar && <Elegir etiqueta="Equipo" valor={id} alCambiar={alCambiar} opciones={lista.map((e) => ({ clave: e.teamId, nombre: e.equipo }))} />}
            <Botonera
              etiqueta="Contra quién"
              valor={escala}
              alCambiar={setEscala}
              opciones={[
                { clave: "grupo", nombre: "Su grupo" },
                { clave: "todos", nombre: "Toda la categoría" },
              ]}
            />
          </>
        }
      >
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px]">
          {/* Con margen a los lados: los rótulos de las porciones de las 3 y las 9 se salían del lienzo y se cortaban. */}
          <svg
            viewBox={`${-MARGEN_X} 0 ${T + 2 * MARGEN_X} ${T}`}
            className="mx-auto block h-auto w-full max-w-[700px]"
            role="img"
            aria-label={`Radiografía de ${nombre}${rx.nota != null ? `: nota de juego ${Math.round(rx.nota)}` : ""}`}
            onMouseLeave={() => setEncima(null)}
          >
            {/* Las guías: P25, P50, P75 y P100. */}
            {[25, 50, 75, 100].map((p) => (
              <circle key={p} cx={C} cy={C} r={R0 + ((R - R0) * p) / 100} style={{ fill: "none", stroke: tinta(p === 50 ? 0.22 : 0.1), strokeDasharray: p === 100 ? undefined : "3 4" }} />
            ))}
            {rx.porciones.map((p, i) => {
              const a1 = i * paso + HUECO;
              const a2 = (i + 1) * paso - HUECO;
              const medio = (a1 + a2) / 2;
              const largo = R0 + ((R - R0) * (p.percentil ?? 0)) / 100;
              const color = COLOR_FAMILIA[p.familia];
              const [lx, ly] = polar(R + 26, medio);
              const s = Math.sin(medio);
              const ancla = s > 0.25 ? "start" : s < -0.25 ? "end" : "middle";
              const [px, py] = polar(Math.max(R0 + 16, largo - 14), medio);
              const def = defMetrica(p.a, catalogo);
              const resalta = encima === p.a;
              return (
                <g key={p.a} onMouseEnter={() => setEncima(p.a)} onFocus={() => setEncima(p.a)} tabIndex={0} style={{ outline: "none" }}>
                  <title>{`${nombreMetrica(p.a, catalogo)}: ${conP(p.valor, def, p.percentil, true)}${p.inverso ? " (menos es mejor)" : ""}`}</title>
                  <path d={sector(R0, R, a1, a2)} style={{ fill: tinta(resalta ? 0.08 : 0.035) }} />
                  {p.percentil != null && <path d={sector(R0, largo, a1, a2)} style={{ fill: color, fillOpacity: resalta ? 0.95 : 0.78 }} />}
                  {p.percentil != null && p.percentil >= 12 && (
                    <text x={px} y={py} textAnchor="middle" dominantBaseline="middle" style={{ fill: "#fff", fontSize: 12, fontWeight: 700 }}>
                      {p.percentil}
                    </text>
                  )}
                  <text x={lx} y={ly - 6} textAnchor={ancla} style={{ fill: tinta(0.8), fontSize: 13, fontWeight: 600 }}>
                    {cortoMetrica(p.a, catalogo)}
                  </text>
                  <text x={lx} y={ly + 10} textAnchor={ancla} style={{ fill: tinta(0.55), fontSize: 12 }}>
                    {conP(p.valor, def, p.percentil)}
                  </text>
                </g>
              );
            })}
            <circle cx={C} cy={C} r={R0 - 4} style={{ fill: tinta(0.06), stroke: tinta(0.2) }} />
            <text x={C} y={C + 4} textAnchor="middle" style={{ fill: tinta(0.95), fontSize: 34, fontWeight: 700 }}>
              {rx.nota != null ? Math.round(rx.nota) : ""}
            </text>
            <text x={C} y={C + 24} textAnchor="middle" style={{ fill: tinta(0.55), fontSize: 11 }}>
              nota de juego
            </text>
          </svg>

          <div className="min-w-0 space-y-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/45">Nota de juego</p>
              <p className="mt-1 text-3xl font-semibold tabular-nums text-white">{rx.nota != null ? Math.round(rx.nota) : ""}</p>
              <p className="mt-0.5 text-xs text-white/55">Media de {EN_LA_NOTA} percentiles contra {contra}: 50 es la media. Posesión, pases y secuencias largas son estilo: se ven, pero no cuentan.</p>
            </div>
            <ul className="space-y-1.5">
              {FAMILIAS_RADIOGRAFIA.map((f) => (
                <li key={f.clave} className="flex items-center gap-2 text-sm">
                  <span aria-hidden className="inline-block h-3 w-3 shrink-0 rounded-sm" style={{ background: COLOR_FAMILIA[f.clave] }} />
                  <span className="min-w-0 flex-1 text-white/80">{f.nombre}</span>
                  <span className="tabular-nums font-semibold text-white">{rx.porFamilia[f.clave] != null ? `P${Math.round(rx.porFamilia[f.clave]!)}` : ""}</span>
                </li>
              ))}
            </ul>
            {vista && (
              <p className="text-xs text-white/65">
                <span className="font-semibold text-white">{nombreMetrica(vista.a, catalogo)}</span>: {conP(vista.valor, defMetrica(vista.a, catalogo), vista.percentil, true)}
                {vista.inverso ? " (menos es mejor)" : ""}
              </p>
            )}
          </div>
        </div>

        {/* En el móvil la pizza se queda pequeña: las 22, también en lista. */}
        <ul className="mt-4 grid grid-cols-1 gap-x-4 gap-y-1 border-t border-white/10 pt-3 text-xs sm:hidden">
          {rx.porciones.map((p) => (
            <li key={p.a} className="flex items-center gap-2">
              <span aria-hidden className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: COLOR_FAMILIA[p.familia] }} />
              <span className="min-w-0 flex-1 truncate text-white/75">{nombreMetrica(p.a, catalogo)}</span>
              <span className="tabular-nums text-white/60">{fmt(p.valor, defMetrica(p.a, catalogo).unidad)}</span>
              <span className="w-9 text-right tabular-nums font-semibold text-white">{p.percentil != null ? `P${p.percentil}` : ""}</span>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
});
