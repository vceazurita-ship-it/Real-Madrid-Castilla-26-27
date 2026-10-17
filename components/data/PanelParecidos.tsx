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
 *
 * Revisión del 17/10/2026: la leyenda resalta una familia (atenúa las demás),
 * cambiar los grupos de «Familias por» ya no pierde el elegido, los puntos se
 * manejan con el teclado y en el móvil la red se desliza en vez de encogerse.
 */

import { useEffect, useMemo, useState } from "react";

import { Conclusiones, Explicativo } from "@/components/ui/textos-analisis";
import { loadRegistro, type RegistroTarea } from "@/lib/abp/registro";
import type { FilaPartido } from "@/lib/data-analisis/leer";
import {
  GRUPOS_PARTIDO,
  GRUPOS_PARTIDO_INICIALES,
  GRUPOS_SESION,
  GRUPOS_SESION_INICIALES,
  clavesDe,
  colocaRed,
  equiposComoElementos,
  partidosComoElementos,
  redDeParecidos,
  sesionesComoElementos,
  soloRasgos,
  type RedParecidos,
} from "@/lib/data-analisis/parecidos";

const OSCURO = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#9085e9"];
const CLARO = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#6250d6"];
const GRIS = { oscuro: "#6b7280", claro: "#9ca3af" };

/* Cada familia, su clase: el color lo pone la hoja de estilo según el tema (los SVG no leen las clases de Tailwind del tema). */
const ESTILO = [
  ...OSCURO.map((c, i) => `.parecidos-red .f${i}{fill:${c};stroke:${c}}`),
  `.parecidos-red .fx{fill:${GRIS.oscuro};stroke:${GRIS.oscuro}}`,
  ...CLARO.map((c, i) => `:root[data-theme="light"] .parecidos-red .f${i}{fill:${c};stroke:${c}}`),
  `:root[data-theme="light"] .parecidos-red .fx{fill:${GRIS.claro};stroke:${GRIS.claro}}`,
  `.parecidos-red g.nodo:focus{outline:none}`,
  `.parecidos-red g.nodo:focus-visible .anillo{stroke:#C8A96B;stroke-width:2.5}`,
].join("\n");

const claseFamilia = (id: number) => (id < OSCURO.length ? `f${id}` : "fx");

const rasgosATexto = (rasgos: { rasgo: { label: string }; z: number }[]) =>
  rasgos
    .filter((x) => Math.abs(x.z) >= 0.3)
    .map((x) => `${x.z > 0 ? "más" : "menos"} ${x.rasgo.label.toLowerCase()}`)
    .join(", ") || "cerca de la media en todo";

const describe = (red: RedParecidos, id: number) => rasgosATexto(red.familias[id].rasgos);

const Punto = ({ familia }: { familia: number }) => (
  <svg width="10" height="10" className="parecidos-red shrink-0" aria-hidden>
    <circle cx="5" cy="5" r="5" className={claseFamilia(familia)} />
  </svg>
);

const mismos = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));

export function PanelParecidos({ partidos }: { partidos: FilaPartido[] }) {
  const [modo, setModo] = useState<"partidos" | "sesiones" | "equipos">("partidos");
  const [tareas, setTareas] = useState<RegistroTarea[] | null>(null);
  const [fallo, setFallo] = useState(false);
  const [intento, setIntento] = useState(0);
  const [elegido, setElegido] = useState<string | null>(null);
  /* La familia resaltada desde la leyenda (las demás se atenúan); null, todas. */
  const [foco, setFoco] = useState<number | null>(null);
  /* Con qué se forman las familias: grupos de partidos (partidos y equipos) y de sesiones. */
  const [gruposPartido, setGruposPartido] = useState<string[]>(GRUPOS_PARTIDO_INICIALES);
  const [gruposSesion, setGruposSesion] = useState<string[]>(GRUPOS_SESION_INICIALES);
  const grupos = modo === "sesiones" ? GRUPOS_SESION : GRUPOS_PARTIDO;
  const activos = modo === "sesiones" ? gruposSesion : gruposPartido;
  const iniciales = modo === "sesiones" ? GRUPOS_SESION_INICIALES : GRUPOS_PARTIDO_INICIALES;
  const pon = modo === "sesiones" ? setGruposSesion : setGruposPartido;

  /* Cambiar los grupos rehace las familias: el elegido se queda (sigue existiendo), el foco no (los números de familia cambian). */
  const conmuta = (k: string) => {
    /* Siempre queda al menos uno. */
    pon((lista) => (lista.includes(k) ? (lista.length > 1 ? lista.filter((x) => x !== k) : lista) : [...lista, k]));
    setFoco(null);
  };

  useEffect(() => {
    if (modo !== "sesiones" || tareas) return;

    let cancelado = false;

    loadRegistro()
      .then((r) => {
        if (cancelado) return;

        setFallo(false);
        setTareas(r.tareas);
      })
      .catch(() => !cancelado && setFallo(true));

    return () => {
      cancelado = true;
    };
  }, [modo, tareas, intento]);

  const red = useMemo(() => {
    if (modo === "partidos") {
      const { elementos, rasgos } = partidosComoElementos(partidos, undefined, clavesDe(GRUPOS_PARTIDO, gruposPartido));

      return redDeParecidos(elementos, rasgos, 2);
    }

    if (modo === "equipos") {
      const { elementos, rasgos } = equiposComoElementos(partidos, undefined, undefined, clavesDe(GRUPOS_PARTIDO, gruposPartido));

      return redDeParecidos(elementos, rasgos, 3);
    }

    if (!tareas) return null;

    const { elementos, rasgos } = soloRasgos(sesionesComoElementos(tareas), clavesDe(GRUPOS_SESION, gruposSesion));

    return redDeParecidos(elementos, rasgos, 3);
  }, [modo, partidos, tareas, gruposPartido, gruposSesion]);

  const pos = useMemo(() => (red ? colocaRed(red) : []), [red]);

  /* Sin elegir: el último partido o sesión; en equipos, el Castilla. */
  const actual = red ? (red.elementos.find((e) => e.id === elegido) ?? (modo === "equipos" ? red.elementos.find((e) => e.id === "Real Madrid Castilla") : null) ?? red.elementos[red.elementos.length - 1]) : null;
  const iActual = red && actual ? red.elementos.indexOf(actual) : -1;
  const parecidos =
    red && iActual >= 0
      ? red.sim[iActual]
          .map((s, j) => ({ s, j }))
          .filter((x) => x.j !== iActual)
          .sort((a, b) => b.s - a.s)
          .slice(0, 5)
      : [];
  /* Lo que más separa al elegido de la media (su propio z, no el de su familia). */
  const suyo = red && actual ? rasgosATexto(red.rasgos.map((rasgo, k) => ({ rasgo, z: actual.z[k] })).sort((a, b) => Math.abs(b.z) - Math.abs(a.z)).slice(0, 3)) : "";
  const focoValido = red && foco !== null && foco < red.familias.length ? foco : null;
  const nMetricas = clavesDe(grupos, activos).length;

  const W = 1000;
  const H = 560;
  const nombre = modo === "partidos" ? "partido" : modo === "equipos" ? "equipo" : "sesión";
  const plural = modo === "equipos" ? "Equipos" : modo === "partidos" ? "Partidos" : "Sesiones";
  const elige = (id: string) => setElegido(id);

  return (
    <div className="space-y-4">
      <style>{ESTILO}</style>

      <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Qué se compara">
        {(
          [
            ["partidos", "Nuestros partidos"],
            ["sesiones", "Nuestras sesiones"],
            ["equipos", "Equipos de la liga"],
          ] as const
        ).map(([k, t]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={modo === k}
            onClick={() => {
              setModo(k);
              setElegido(null);
              setFoco(null);
            }}
            className={`rounded-lg px-3 py-1.5 text-sm ${modo === k ? "bg-[#C8A96B] font-semibold text-black" : "border border-white/12 text-white/65 hover:text-white"}`}
          >
            {t}
          </button>
        ))}
        <span className="text-xs text-white/40">Temporada 2026/27 · cómo jugamos y cómo entrenamos, no lo bien que salió</span>
      </div>

      {/* Con qué se forman las familias: se encienden y se apagan (al menos uno). */}
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Con qué se forman las familias">
        <span className="mr-1 text-[11px] uppercase tracking-[0.14em] text-white/40">Familias por</span>
        {grupos.map((g) => {
          const activo = activos.includes(g.key);
          const ultimo = activo && activos.length === 1;

          return (
            <button
              key={g.key}
              type="button"
              aria-pressed={activo}
              aria-disabled={ultimo}
              onClick={() => conmuta(g.key)}
              className={`rounded-full border px-3 py-1 text-xs ${activo ? "border-[#C8A96B] bg-[#C8A96B]/15 font-semibold text-[#C8A96B]" : "border-white/12 text-white/50 hover:text-white"} ${ultimo ? "cursor-not-allowed" : ""}`}
              title={ultimo ? "Tiene que quedar al menos uno" : `${g.claves.length} métricas`}
            >
              {activo ? "✓ " : ""}
              {g.label}
            </button>
          );
        })}
        {!mismos(activos, iniciales) && (
          <button
            type="button"
            onClick={() => {
              pon(iniciales);
              setFoco(null);
            }}
            className="ml-1 text-xs text-white/45 underline-offset-2 hover:text-white hover:underline"
          >
            Restablecer
          </button>
        )}
        <span className="text-[11px] text-white/35">
          · {nMetricas} {modo === "sesiones" ? "rasgos" : "métricas"}
        </span>
      </div>

      <Explicativo>
        <p className="text-xs leading-relaxed text-white/45">
          {modo === "partidos"
            ? `Cada partido con ${nMetricas} métricas de Wyscout de los grupos elegidos arriba. `
            : modo === "equipos"
              ? `Cada equipo de nuestra competición en la 2026/27, resumido por la mediana de sus partidos (3 o más) en las mismas ${nMetricas} métricas de Wyscout. `
              : `Cada sesión con ${nMetricas} rasgos de sus tareas en la hoja de registro; el día de partido no cuenta. `}
          Se estandariza cada métrica, el parecido es la similitud del coseno, cada punto se une a sus más parecidos y las familias salen del algoritmo de Louvain (como el experimento de Football Hacking del 16/10/2026).
        </p>
        {red && <p className="mt-1 text-[11px] text-white/40">Con: {red.rasgos.map((r) => r.label).join(" · ")}.</p>}
      </Explicativo>

      {!red ? (
        modo === "sesiones" && fallo ? (
          <p className="text-sm text-white/55">
            No se ha podido leer la hoja de registro.{" "}
            <button
              type="button"
              onClick={() => {
                setFallo(false);
                setIntento((x) => x + 1);
              }}
              className="font-semibold text-[#C8A96B] hover:underline"
            >
              Reintentar
            </button>
          </p>
        ) : (
          <p className="text-sm text-white/45">{modo === "sesiones" && !tareas ? "Leyendo la hoja de registro…" : `Todavía no hay ${modo} suficientes de la 2026/27 (hacen falta 4).`}</p>
        )
      ) : (
        <>
          <Conclusiones
            items={red.familias.map(
              (f) =>
                `${plural} de la familia ${f.id + 1} (${f.ids.length}): ${describe(red, f.id)} — ${f.ids
                  .slice(0, 6)
                  .map((id) => red.elementos.find((e) => e.id === id)?.etiqueta)
                  .join(", ")}${f.ids.length > 6 ? "…" : ""}.`,
            )}
          />

          {/* ---------------- leyenda: pulsar una familia la resalta ---------------- */}
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Resaltar una familia">
            {red.familias.map((f) => {
              const on = focoValido === f.id;

              return (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setFoco(on ? null : f.id)}
                  className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${on ? "border-white/40 bg-white/[0.08] font-semibold text-white" : "border-white/10 text-white/65 hover:text-white"}`}
                  title={describe(red, f.id)}
                >
                  <Punto familia={f.id} />
                  Familia {f.id + 1} · {f.ids.length}
                </button>
              );
            })}
            {focoValido !== null && (
              <button type="button" onClick={() => setFoco(null)} className="text-xs text-white/45 hover:text-white hover:underline">
                Ver todas
              </button>
            )}
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
            {/* ---------------- la red (en el móvil se desliza en vez de encogerse hasta no leerse) ---------------- */}
            <div className="parecidos-red overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.02]">
              <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full min-w-[680px]" role="group" aria-label={`Red de ${modo} parecidos`}>
                {red.aristas.map(({ a, b, peso }) => {
                  const marcada = a === iActual || b === iActual;
                  const apagada = focoValido !== null && (red.elementos[a].comunidad !== focoValido || red.elementos[b].comunidad !== focoValido);

                  return (
                    <line
                      key={`${a}-${b}`}
                      x1={pos[a].x * W}
                      y1={pos[a].y * H}
                      x2={pos[b].x * W}
                      y2={pos[b].y * H}
                      strokeWidth={marcada ? 2.5 : 1.2}
                      strokeOpacity={marcada ? 0.9 : apagada ? 0.05 : 0.15 + 0.4 * Math.max(0, peso)}
                      className={marcada ? claseFamilia(red.elementos[iActual].comunidad) : "fx"}
                    />
                  );
                })}

                {red.elementos.map((e, i) => {
                  const p = pos[i];
                  const sel = i === iActual;
                  const apagado = focoValido !== null && e.comunidad !== focoValido && !sel;

                  return (
                    <g
                      key={e.id}
                      className="nodo cursor-pointer"
                      role="button"
                      tabIndex={0}
                      aria-pressed={sel}
                      aria-label={`${e.etiqueta}${e.detalle ? `, ${e.detalle}` : ""}, familia ${e.comunidad + 1}`}
                      opacity={apagado ? 0.22 : 1}
                      onClick={() => elige(e.id)}
                      onKeyDown={(ev) => {
                        if (ev.key === "Enter" || ev.key === " ") {
                          ev.preventDefault();
                          elige(e.id);
                        }
                      }}
                    >
                      <title>{`${e.etiqueta}${e.detalle ? ` · ${e.detalle}` : ""} · familia ${e.comunidad + 1}`}</title>
                      {/* La zona de toque, más grande que el punto. */}
                      <circle cx={p.x * W} cy={p.y * H} r={16} fill="transparent" stroke="none" />
                      <circle className="anillo" cx={p.x * W} cy={p.y * H} r={14} fill="none" stroke="none" />
                      <circle cx={p.x * W} cy={p.y * H} r={sel ? 10 : 7} className={claseFamilia(e.comunidad)} strokeWidth={sel ? 3 : 0} stroke="var(--rmcf-surface, #11161C)" />
                      {e.id === "Real Madrid Castilla" && <circle cx={p.x * W} cy={p.y * H} r={15} fill="none" stroke="#C8A96B" strokeWidth={2.5} />}
                      <text x={p.x * W + 11} y={p.y * H + 4} fontSize={modo === "sesiones" ? 12 : modo === "equipos" ? 13 : 15} fontWeight={sel ? 700 : 500} fill="currentColor" className={sel ? "text-white" : "text-white/80"}>
                        {e.etiqueta}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* ---------------- el elegido ---------------- */}
            {actual && (
              <aside className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4" aria-live="polite">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">
                    {nombre} elegid{modo === "sesiones" ? "a" : "o"}
                  </p>
                  <p className="text-lg font-semibold text-white">{actual.etiqueta}</p>
                  {actual.detalle ? <p className="text-xs text-white/50">{actual.detalle}</p> : null}
                  <p className="mt-2 text-xs text-white/70">
                    <span className="text-white/45">Lo que le distingue: </span>
                    {suyo}
                  </p>
                  <p className="mt-1 flex items-start gap-1.5 text-xs text-white/65">
                    <span className="mt-0.5">
                      <Punto familia={actual.comunidad} />
                    </span>
                    <span>
                      Familia {actual.comunidad + 1}: {describe(red, actual.comunidad)}
                    </span>
                  </p>
                </div>

                <div className="space-y-1.5">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">Los que más se le parecen</p>
                  {parecidos.map(({ s, j }) => (
                    <button key={red.elementos[j].id} type="button" onClick={() => elige(red.elementos[j].id)} className="block w-full rounded-md px-1 py-0.5 text-left hover:bg-white/[0.04]" title={red.elementos[j].detalle}>
                      <div className="flex items-baseline justify-between gap-2 text-sm">
                        <span className="flex min-w-0 items-center gap-1.5">
                          <Punto familia={red.elementos[j].comunidad} />
                          <span className="truncate text-white/85">{red.elementos[j].etiqueta}</span>
                        </span>
                        <span className="shrink-0 tabular-nums text-white/55">{s < 0 ? `opuesto · ${Math.round(-s * 100)} %` : `${Math.round(s * 100)} %`}</span>
                      </div>
                      <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                        <div className="h-full rounded-full bg-[#C8A96B]" style={{ width: `${Math.max(0, s) * 100}%` }} />
                      </div>
                    </button>
                  ))}
                </div>

                {red.familias.length > 1 && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">Su familia frente a las demás</p>
                    {red.familias
                      .filter((f) => f.id !== actual.comunidad)
                      .map((f) => ({ f, s: red.simFamilias[actual.comunidad][f.id] }))
                      .sort((a, b) => b.s - a.s)
                      .map(({ f, s }) => (
                        <div key={f.id} className="flex items-center gap-2 text-xs">
                          <Punto familia={f.id} />
                          <span className="w-20 shrink-0 text-white/70">Familia {f.id + 1}</span>
                          <span className="tabular-nums text-white/55">{s >= 0 ? `se parece (${Math.round(s * 100)} %)` : `opuesta (${Math.round(-s * 100)} %)`}</span>
                        </div>
                      ))}
                  </div>
                )}
              </aside>
            )}
          </div>

          {/* ---------------- las familias, en lista (la tabla de la red) ---------------- */}
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {red.familias.map((f) => (
              <div key={f.id} className={`rounded-xl border p-3 ${focoValido === f.id ? "border-white/35 bg-white/[0.05]" : "border-white/10 bg-white/[0.02]"}`}>
                <button type="button" onClick={() => setFoco(focoValido === f.id ? null : f.id)} className="flex items-center gap-1.5 text-left text-sm font-semibold text-white hover:underline" title="Resaltar en la red">
                  <Punto familia={f.id} />
                  Familia {f.id + 1} · {f.ids.length} {f.ids.length === 1 ? nombre : modo}
                </button>
                <p className="mt-1 text-xs text-white/60">{describe(red, f.id)}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {f.ids.map((id) => {
                    const e = red.elementos.find((x) => x.id === id);

                    if (!e) return null;

                    return (
                      <button key={id} type="button" onClick={() => elige(id)} className={`rounded-md px-1.5 py-0.5 text-[11px] ${id === actual?.id ? "bg-[#C8A96B] text-black" : "bg-white/[0.06] text-white/70 hover:text-white"}`} title={e.detalle}>
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
