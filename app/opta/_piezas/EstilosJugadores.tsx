"use client";

/**
 * ESTILOS DE LOS JUGADORES (área «Estilos de juego», 11/11/2026): el Venn de
 * dominio, peligro y solidez de los equipos, jugador a jugador y por puesto.
 * Cada puesto tiene sus métricas (`PUESTOS_ESTILO`, lib/opta-estilos-jugadores.ts);
 * el percentil es contra los de su mismo puesto en la categoría con el mínimo
 * de minutos. Los resaltados (por defecto los del Castilla) se marcan
 * pinchando el nombre, como en «Quién aprieta y cuándo».
 */

import { useMemo, useState } from "react";

import { ORO, tinta, useEscudos } from "@/components/data/graficas";
import { CASTILLA_OPTA, num } from "@/lib/opta";
import { enAmbito, type Ambito } from "@/lib/opta-analisis";
import type { Indice } from "@/lib/opta-estilos";
import {
  indicesJugadores,
  mascaraJugador,
  nombreCortoJugador,
  puestoEstilo,
  puestoEstiloDe,
  PUESTOS_ESTILO,
  type IndicesJugador,
  type PuestoEstilo,
} from "@/lib/opta-estilos-jugadores";
import { nombreMetrica } from "@/lib/opta-nombres";

import { Elegir, ElegirAmbito, Panel } from "./comun";
import type { DatosOpta } from "./useOpta";
import { ALTO, ANCHO, CIRCULOS, coloca, RADIO, REGIONES } from "./venn";

const FICHA = 16;
const NOMBRES: Record<Indice, string> = { dominio: "Dominio", peligro: "Peligro", solidez: "Solidez" };
const CLAVES: Indice[] = ["dominio", "peligro", "solidez"];

const OPCIONES_MINUTOS = [180, 270, 450, 900].map((m) => ({ clave: String(m), nombre: `${m}′ o más` }));
const OPCIONES_UMBRAL = [60, 70, 75, 80, 90].map((u) => ({ clave: String(u), nombre: `Percentil ${u}` }));

const resumen = (x: IndicesJugador) =>
  CLAVES.filter((k) => x[k] != null)
    .map((k) => `${NOMBRES[k]} ${Math.round(x[k]!)}`)
    .join(" · ");

const nombreRegion = (m: number) => REGIONES.find((r) => r.m === m)?.nombre ?? "En ninguno";

export function EstilosJugadores({ datos }: { datos: DatosOpta }) {
  const { jugadores, grupos, catalogo } = datos;
  const escudoDe = useEscudos();
  const [puesto, setPuesto] = useState<PuestoEstilo>("Mediocentros");
  const [ambito, setAmbito] = useState<Ambito>("todos");
  const [minimo, setMinimo] = useState("270");
  const [umbral, setUmbral] = useState("70");
  /* Los resaltados: por defecto los del Castilla; pinchando un nombre se marca o se quita. */
  const castilla = useMemo(() => new Set(jugadores.filter((f) => f.teamId === CASTILLA_OPTA).map((f) => String(f.playerId ?? ""))), [jugadores]);
  const [propios, setMarcados] = useState<Set<string> | null>(null);
  const marcados = propios ?? castilla;
  const alterna = (id: string) => {
    const n = new Set(marcados);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    setMarcados(n);
  };
  const distintoDeCastilla = propios != null && (propios.size !== castilla.size || [...propios].some((id) => !castilla.has(id)));

  const def = puestoEstilo(puesto);
  const tope = Number(umbral);

  const muestra = useMemo(
    () =>
      jugadores.filter(
        (f) => puestoEstiloDe(f) === puesto && (num(f.Min) ?? 0) >= Number(minimo) && enAmbito(f.teamId, grupos, ambito),
      ),
    [jugadores, puesto, minimo, grupos, ambito],
  );
  const indices = useMemo(() => indicesJugadores(muestra, puesto, catalogo), [muestra, puesto, catalogo]);

  const porRegion = useMemo(() => {
    const m = new Map<number, IndicesJugador[]>();
    for (const x of indices) {
      const k = mascaraJugador(x, tope);
      m.set(k, [...(m.get(k) ?? []), x]);
    }
    const suma = (x: IndicesJugador) => (x.dominio ?? 0) + (x.peligro ?? 0) + (x.solidez ?? 0);
    for (const lista of m.values()) lista.sort((a, b) => suma(b) - suma(a) || a.jugador.localeCompare(b.jugador, "es"));
    return m;
  }, [indices, tope]);

  const fichas = useMemo(
    () =>
      REGIONES.flatMap(({ m }) => {
        const lista = porRegion.get(m) ?? [];
        const sitios = coloca(m, lista.length, FICHA);
        return lista.map((x, i) => ({ x, pos: sitios[i] }));
      }),
    [porRegion],
  );

  const fuera = porRegion.get(0) ?? [];
  const resaltados = indices.filter((x) => marcados.has(x.playerId));
  const resaltadosFuera = [...marcados].filter((id) => !indices.some((x) => x.playerId === id)).length;
  /* Los resaltados se pintan los últimos para que queden encima. */
  const fichasOrden = [...fichas].sort((a, b) => Number(marcados.has(a.x.playerId)) - Number(marcados.has(b.x.playerId)));

  const chip = (x: IndicesJugador) => {
    const marcado = marcados.has(x.playerId);
    return (
      <button
        key={x.playerId}
        type="button"
        onClick={() => alterna(x.playerId)}
        aria-pressed={marcado}
        title={`${x.jugador} (${x.equipo}, ${x.minutos}′) · ${resumen(x)} · ${marcado ? "pincha para quitar el resaltado" : "pincha para resaltarlo"}`}
        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition hover:text-white ${marcado ? "font-semibold" : "border-white/10 bg-white/[0.04] text-white/80"}`}
        style={marcado ? { color: ORO, borderColor: ORO } : undefined}
      >
        {(() => {
          const e = escudoDe(x.equipo);
          return e ? (
            // eslint-disable-next-line @next/next/no-img-element -- escudo pequeño por el proxy propio
            <img src={e} alt="" width={12} height={12} className="h-3 w-3 object-contain" />
          ) : null;
        })()}
        {nombreCortoJugador(x.jugador)}
      </button>
    );
  };

  return (
    <Panel
      titulo="Jugadores: dominio, peligro y solidez"
      subtitulo={`El mismo Venn, jugador a jugador: cada círculo son los ${def.nombre.toLowerCase()} que llegan al percentil ${tope} en ese conjunto contra los de su puesto. Pincha un nombre o un punto para resaltarlo.`}
      derecha={
        <>
          <Elegir etiqueta="Puesto" valor={puesto} alCambiar={setPuesto} opciones={PUESTOS_ESTILO.map((p) => ({ clave: p.clave, nombre: p.nombre }))} />
          <ElegirAmbito valor={ambito} alCambiar={setAmbito} />
          <Elegir etiqueta="Minutos" valor={minimo} alCambiar={setMinimo} opciones={OPCIONES_MINUTOS} />
          <Elegir etiqueta="Umbral" valor={umbral} alCambiar={setUmbral} opciones={OPCIONES_UMBRAL} />
        </>
      }
    >
      {indices.length > 0 && (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-[12px] text-white/60">
            <span>
              {indices.length} {def.nombre.toLowerCase()} con {minimo}′ o más · {indices.length - fuera.length} en algún círculo
            </span>
            <span className="flex flex-wrap items-center gap-2">
              {marcados.size} {marcados.size === 1 ? "resaltado" : "resaltados"}
              {resaltadosFuera > 0 && ` (${resaltadosFuera} en otro puesto o por debajo de los minutos)`}
              {distintoDeCastilla && (
                <button type="button" onClick={() => setMarcados(null)} className="font-semibold text-[#C8A96B] hover:underline">
                  Sólo el Castilla
                </button>
              )}
              {marcados.size > 0 && (
                <button type="button" onClick={() => setMarcados(new Set())} className="font-semibold text-white/60 hover:text-white hover:underline">
                  Quitar todos
                </button>
              )}
            </span>
          </div>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} className="mx-auto block h-auto w-full max-w-[620px]" role="img" aria-label={`Diagrama de Venn de los estilos de los ${def.nombre.toLowerCase()}`}>
              {CIRCULOS.map((c) => (
                <circle key={c.clave} cx={c.cx} cy={c.cy} r={RADIO} style={{ fill: c.color, fillOpacity: 0.1, stroke: c.color, strokeOpacity: 0.7, strokeWidth: 1.5 }} />
              ))}
              {CIRCULOS.map((c, i) => {
                const [x, y, ancla] = i === 0 ? [c.cx - RADIO + 18, 22, "start"] : i === 1 ? [c.cx + RADIO - 18, 22, "end"] : [c.cx, ALTO - 8, "middle"];
                return (
                  <text key={c.clave} x={x} y={y} textAnchor={ancla as "start" | "end" | "middle"} style={{ fill: c.color, fontSize: 15, fontWeight: 700, letterSpacing: 1.5 }}>
                    {NOMBRES[c.clave].toUpperCase()}
                  </text>
                );
              })}
              {fichasOrden.map(({ x, pos }) => {
                const marcado = marcados.has(x.playerId);
                const escudo = escudoDe(x.equipo);
                const r = FICHA / 2;
                return (
                  <g
                    key={x.playerId}
                    role="button"
                    tabIndex={0}
                    aria-pressed={marcado}
                    aria-label={`${x.jugador}, ${x.equipo}: ${resumen(x)}`}
                    onClick={() => alterna(x.playerId)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        alterna(x.playerId);
                      }
                    }}
                    style={{ cursor: "pointer" }}
                  >
                    <title>{`${x.jugador} (${x.equipo}, ${x.minutos}′) · ${resumen(x)}`}</title>
                    <circle cx={pos[0]} cy={pos[1]} r={r} style={{ fill: tinta(marcado ? 0.14 : 0.08), stroke: marcado ? ORO : tinta(0.25), strokeWidth: marcado ? 2.5 : 1 }} />
                    {escudo ? (
                      <image href={escudo} x={pos[0] - r + 2.5} y={pos[1] - r + 2.5} width={FICHA - 5} height={FICHA - 5} preserveAspectRatio="xMidYMid meet" />
                    ) : (
                      <circle cx={pos[0]} cy={pos[1]} r={2.5} style={{ fill: marcado ? ORO : tinta(0.6) }} />
                    )}
                    {marcado && (
                      <text
                        x={pos[0]}
                        y={pos[1] + r + 10}
                        textAnchor="middle"
                        style={{ fill: ORO, fontSize: 10, fontWeight: 700, paintOrder: "stroke", stroke: "var(--rmcf-surface, #11161C)", strokeWidth: 3 }}
                      >
                        {nombreCortoJugador(x.jugador)}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>

            <div className="min-w-0 space-y-3">
              {REGIONES.map(({ m, nombre }) => {
                const lista = porRegion.get(m) ?? [];
                if (!lista.length) return null;
                return (
                  <div key={m}>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-white/45">
                      {nombre} · {lista.length}
                    </p>
                    <div className="flex flex-wrap gap-1.5">{lista.map(chip)}</div>
                  </div>
                );
              })}
              {fuera.length > 0 && (
                <details>
                  <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.14em] text-white/45 hover:text-white/70">
                    En ninguno · {fuera.length}
                  </summary>
                  <div className="mt-1 flex flex-wrap gap-1.5">{fuera.map(chip)}</div>
                </details>
              )}
            </div>
          </div>

          {resaltados.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-[12px] tabular-nums">
                <thead>
                  <tr className="border-b border-white/10 text-xs text-white/55">
                    <th className="py-2 pr-2 font-semibold">Resaltado</th>
                    <th className="py-2 pr-2 font-semibold">Equipo</th>
                    <th className="py-2 pr-2 text-right font-semibold">Min</th>
                    {CIRCULOS.map((c) => (
                      <th key={c.clave} className="py-2 pr-2 text-right font-semibold" style={{ color: c.color }}>
                        {NOMBRES[c.clave]}
                      </th>
                    ))}
                    <th className="py-2 pr-2 font-semibold">Dónde cae</th>
                  </tr>
                </thead>
                <tbody>
                  {[...resaltados]
                    .sort((a, b) => (b.dominio ?? 0) + (b.peligro ?? 0) + (b.solidez ?? 0) - ((a.dominio ?? 0) + (a.peligro ?? 0) + (a.solidez ?? 0)))
                    .map((x) => (
                      <tr key={x.playerId} className="border-b border-white/[0.06]">
                        <td className="whitespace-nowrap py-1.5 pr-2">
                          <button type="button" onClick={() => alterna(x.playerId)} title="Quitar el resaltado" className="font-semibold hover:underline" style={{ color: ORO }}>
                            {x.jugador}
                          </button>
                        </td>
                        <td className="whitespace-nowrap py-1.5 pr-2 text-white/70">{x.equipo}</td>
                        <td className="py-1.5 pr-2 text-right text-white/55">{x.minutos}</td>
                        {CLAVES.map((k) => (
                          <td key={k} className={`py-1.5 pr-2 text-right ${(x[k] ?? -1) >= tope ? "font-semibold text-white" : "text-white/70"}`}>
                            {x[k] != null ? Math.round(x[k]!) : ""}
                          </td>
                        ))}
                        <td className="whitespace-nowrap py-1.5 pr-2 text-white/70">{nombreRegion(mascaraJugador(x, tope))}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-4 grid gap-3 border-t border-white/10 pt-3 sm:grid-cols-3">
            {CIRCULOS.map((c) => {
              const conj = def.conjuntos[c.clave];
              return (
                <div key={c.clave} className="min-w-0 text-xs leading-relaxed text-white/55">
                  <p className="font-semibold" style={{ color: c.color }}>
                    {NOMBRES[c.clave]}: {conj.que.toLowerCase()}
                  </p>
                  <p>{conj.metricas.map((m) => `${nombreMetrica(m.a, catalogo)}${m.inverso ? " (menos, mejor)" : ""}`).join(", ")}.</p>
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-xs leading-relaxed text-white/45">
            Cómo se cuenta: datos de Opta de toda la categoría. Cada conjunto es la media de los percentiles (0-100) de sus métricas por 90′ —los
            porcentajes, tal cual— contra los {def.nombre.toLowerCase()} con {minimo}′ o más del ámbito elegido; el puesto es el que más ha repetido en
            la temporada. Entra en un círculo quien llega al percentil {tope}. Las métricas cambian con el puesto; los porteros no entran.
          </p>
        </>
      )}
    </Panel>
  );
}
