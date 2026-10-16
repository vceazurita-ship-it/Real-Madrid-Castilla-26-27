"use client";

/**
 * PARECIDOS: NUESTROS PARTIDOS Y NUESTRAS SESIONES (16/10/2026).
 *
 * La red de lib/data-analisis/parecidos.ts pintada: cada partido (o sesión) un
 * punto, unido a los que más se le parecen y coloreado por familia. Al pulsar
 * uno salen sus más parecidos y lo que define a su familia. Sólo lo nuestro de
 * la 2026/27.
 *
 * Colores: la categórica de referencia de la skill dataviz, validada en día
 * (#EBEEF3: aviso de contraste → cada punto lleva su rótulo y cada familia su
 * lista) y en noche (#11161C: pasa).
 */

import { useEffect, useMemo, useState } from "react";

import { Conclusiones, Explicativo } from "@/components/ui/textos-analisis";
import { loadRegistro, type RegistroTarea } from "@/lib/abp/registro";
import type { FilaPartido } from "@/lib/data-analisis/leer";
import { colocaRed, partidosComoElementos, redDeParecidos, sesionesComoElementos, type RedParecidos } from "@/lib/data-analisis/parecidos";

const OSCURO = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#9085e9"];
const CLARO = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#6250d6"];
const GRIS = { oscuro: "#6b7280", claro: "#9ca3af" };

/* Cada familia, su clase: el color lo pone la hoja de estilo según el tema (los SVG no leen las clases de Tailwind del tema). */
const ESTILO = [
  ...OSCURO.map((c, i) => `.parecidos-red .f${i}{fill:${c};stroke:${c}}`),
  `.parecidos-red .fx{fill:${GRIS.oscuro};stroke:${GRIS.oscuro}}`,
  ...CLARO.map((c, i) => `:root[data-theme="light"] .parecidos-red .f${i}{fill:${c};stroke:${c}}`),
  `:root[data-theme="light"] .parecidos-red .fx{fill:${GRIS.claro};stroke:${GRIS.claro}}`,
].join("\n");

const claseFamilia = (id: number) => (id < OSCURO.length ? `f${id}` : "fx");

const describe = (red: RedParecidos, id: number) =>
  red.familias[id].rasgos
    .filter((x) => Math.abs(x.z) >= 0.3)
    .map((x) => `${x.z > 0 ? "más" : "menos"} ${x.rasgo.label.toLowerCase()}`)
    .join(", ") || "cerca de la media en todo";

export function PanelParecidos({ partidos }: { partidos: FilaPartido[] }) {
  const [modo, setModo] = useState<"partidos" | "sesiones">("partidos");
  const [tareas, setTareas] = useState<RegistroTarea[] | null>(null);
  const [elegido, setElegido] = useState<string | null>(null);

  useEffect(() => {
    if (modo !== "sesiones" || tareas) return;

    let cancelado = false;

    loadRegistro()
      .then((r) => !cancelado && setTareas(r.tareas))
      .catch(() => !cancelado && setTareas([]));

    return () => {
      cancelado = true;
    };
  }, [modo, tareas]);

  const red = useMemo(() => {
    if (modo === "partidos") {
      const { elementos, rasgos } = partidosComoElementos(partidos);

      return redDeParecidos(elementos, rasgos, 2);
    }

    if (!tareas) return null;

    const { elementos, rasgos } = sesionesComoElementos(tareas);

    return redDeParecidos(elementos, rasgos, 3);
  }, [modo, partidos, tareas]);

  const pos = useMemo(() => (red ? colocaRed(red) : []), [red]);

  /* Sin elegir, el último (el partido o la sesión más reciente). */
  const actual = red ? (red.elementos.find((e) => e.id === elegido) ?? red.elementos[red.elementos.length - 1]) : null;
  const iActual = red && actual ? red.elementos.indexOf(actual) : -1;
  const parecidos =
    red && iActual >= 0
      ? red.sim[iActual]
          .map((s, j) => ({ s, j }))
          .filter((x) => x.j !== iActual)
          .sort((a, b) => b.s - a.s)
          .slice(0, 5)
      : [];

  const W = 1000;
  const H = 560;
  const nombre = modo === "partidos" ? "partido" : "sesión";

  return (
    <div className="space-y-4">
      <style>{ESTILO}</style>

      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            ["partidos", "Nuestros partidos"],
            ["sesiones", "Nuestras sesiones"],
          ] as const
        ).map(([k, t]) => (
          <button
            key={k}
            type="button"
            onClick={() => {
              setModo(k);
              setElegido(null);
            }}
            className={`rounded-lg px-3 py-1.5 text-sm ${modo === k ? "bg-[#C8A96B] font-semibold text-black" : "border border-white/12 text-white/65 hover:text-white"}`}
          >
            {t}
          </button>
        ))}
        <span className="text-xs text-white/40">Temporada 2026/27 · cómo jugamos y cómo entrenamos, no lo bien que salió</span>
      </div>

      <Explicativo>
        <p className="text-xs leading-relaxed text-white/45">
          {modo === "partidos"
            ? "Cada partido con 13 métricas de estilo de Wyscout (posesión, ritmo y longitud de pase, verticalidad, centros, contras, presión). "
            : "Cada sesión con 13 rasgos de sus tareas en la hoja de registro (minutos, intensidad, cargas, densidad, jugadores por tarea, normativa, incertidumbre, familiaridad y en qué se fue el tiempo); el día de partido no cuenta. "}
          Se estandariza cada métrica, el parecido es la similitud del coseno, cada punto se une a sus más parecidos y las familias salen del algoritmo de Louvain (como el experimento de Football Hacking del 16/10/2026).
        </p>
      </Explicativo>

      {!red ? (
        <p className="text-sm text-white/45">{modo === "sesiones" && !tareas ? "Leyendo la hoja de registro…" : `Todavía no hay ${modo} suficientes de la 2026/27.`}</p>
      ) : (
        <>
          <Conclusiones
            items={red.familias.map(
              (f) =>
                `${modo === "partidos" ? "Partidos" : "Sesiones"} de la familia ${f.id + 1} (${f.ids.length}): ${describe(red, f.id)} — ${f.ids
                  .slice(0, 6)
                  .map((id) => red.elementos.find((e) => e.id === id)?.etiqueta)
                  .join(", ")}${f.ids.length > 6 ? "…" : ""}.`,
            )}
          />

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
            {/* ---------------- la red ---------------- */}
            <div className="parecidos-red overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
              <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`Red de ${modo} parecidos`}>
                {red.aristas.map(({ a, b, peso }) => {
                  const marcada = a === iActual || b === iActual;

                  return (
                    <line
                      key={`${a}-${b}`}
                      x1={pos[a].x * W}
                      y1={pos[a].y * H}
                      x2={pos[b].x * W}
                      y2={pos[b].y * H}
                      strokeWidth={marcada ? 2.5 : 1.2}
                      strokeOpacity={marcada ? 0.9 : 0.15 + 0.4 * Math.max(0, peso)}
                      className={marcada ? claseFamilia(red.elementos[iActual].comunidad) : "fx"}
                    />
                  );
                })}

                {red.elementos.map((e, i) => {
                  const p = pos[i];
                  const sel = i === iActual;

                  return (
                    <g key={e.id} onClick={() => setElegido(e.id)} className="cursor-pointer">
                      <title>{`${e.etiqueta}${e.detalle ? ` · ${e.detalle}` : ""} · familia ${e.comunidad + 1}`}</title>
                      {/* La zona de toque, más grande que el punto. */}
                      <circle cx={p.x * W} cy={p.y * H} r={16} fill="transparent" stroke="none" />
                      <circle cx={p.x * W} cy={p.y * H} r={sel ? 10 : 7} className={claseFamilia(e.comunidad)} strokeWidth={sel ? 3 : 0} stroke="var(--rmcf-surface, #11161C)" />
                      <text x={p.x * W + 11} y={p.y * H + 4} fontSize={modo === "partidos" ? 15 : 11} fontWeight={sel ? 700 : 500} fill="currentColor" className="text-white/80">
                        {e.etiqueta}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* ---------------- el elegido ---------------- */}
            {actual && (
              <aside className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">{nombre} elegid{modo === "partidos" ? "o" : "a"}</p>
                  <p className="text-lg font-semibold text-white">{actual.etiqueta}</p>
                  {actual.detalle ? <p className="text-xs text-white/50">{actual.detalle}</p> : null}
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-white/65">
                    <svg width="10" height="10" className="parecidos-red" aria-hidden>
                      <circle cx="5" cy="5" r="5" className={claseFamilia(actual.comunidad)} />
                    </svg>
                    Familia {actual.comunidad + 1}: {describe(red, actual.comunidad)}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">Los que más se le parecen</p>
                  {parecidos.map(({ s, j }) => (
                    <button key={red.elementos[j].id} type="button" onClick={() => setElegido(red.elementos[j].id)} className="block w-full text-left">
                      <div className="flex items-baseline justify-between gap-2 text-sm">
                        <span className="truncate text-white/85">{red.elementos[j].etiqueta}</span>
                        <span className="tabular-nums text-white/55">{s < 0 ? "opuesto " : ""}{Math.round(s * 100)} %</span>
                      </div>
                      <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                        <div className="h-full rounded-full bg-[#C8A96B]" style={{ width: `${Math.max(0, s) * 100}%` }} />
                      </div>
                    </button>
                  ))}
                </div>

                <div className="space-y-1.5">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">Su familia frente a las demás</p>
                  {red.familias
                    .filter((f) => f.id !== actual.comunidad)
                    .map((f) => ({ f, s: red.simFamilias[actual.comunidad][f.id] }))
                    .sort((a, b) => b.s - a.s)
                    .map(({ f, s }) => (
                      <div key={f.id} className="flex items-center gap-2 text-xs">
                        <svg width="10" height="10" className="parecidos-red shrink-0" aria-hidden>
                          <circle cx="5" cy="5" r="5" className={claseFamilia(f.id)} />
                        </svg>
                        <span className="w-20 shrink-0 text-white/70">Familia {f.id + 1}</span>
                        <span className="tabular-nums text-white/55">{s >= 0 ? "se parece" : "opuesta"} ({Math.round(s * 100)} %)</span>
                      </div>
                    ))}
                </div>
              </aside>
            )}
          </div>

          {/* ---------------- las familias, en lista (la tabla de la red) ---------------- */}
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {red.familias.map((f) => (
              <div key={f.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-white">
                  <svg width="10" height="10" className="parecidos-red" aria-hidden>
                    <circle cx="5" cy="5" r="5" className={claseFamilia(f.id)} />
                  </svg>
                  Familia {f.id + 1} · {f.ids.length} {f.ids.length === 1 ? nombre : modo}
                </p>
                <p className="mt-1 text-xs text-white/60">{describe(red, f.id)}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {f.ids.map((id) => {
                    const e = red.elementos.find((x) => x.id === id)!;

                    return (
                      <button key={id} type="button" onClick={() => setElegido(id)} className={`rounded-md px-1.5 py-0.5 text-[11px] ${id === actual?.id ? "bg-[#C8A96B] text-black" : "bg-white/[0.06] text-white/70 hover:text-white"}`} title={e.detalle}>
                        {e.etiqueta}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
