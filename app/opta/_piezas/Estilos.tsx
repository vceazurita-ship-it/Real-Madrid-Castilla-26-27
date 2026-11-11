"use client";

/**
 * ESTILOS (pestaña de /opta, 10/11/2026). Tres piezas:
 *
 * 1. `MomentumLiga` (EstilosMomentum.tsx): quién aprieta y cuándo, toda la
 *    liga en un mapa de calor por franjas de 15′.
 * 2. `VennEstilos` (aquí): los equipos en el top N de dominio, peligro y
 *    solidez, colocados en su intersección de tres círculos.
 * 2b. `EstilosJugadores` (EstilosJugadores.tsx, 11/11/2026): el mismo Venn
 *    jugador a jugador, por puesto y con métricas propias de cada puesto.
 * 3. `Radiografia` (EstilosRadiografia.tsx): la «pizza» de 22 métricas de un
 *    equipo con su nota de juego. Pinchar un equipo del Venn la abre.
 *
 * Las cuentas, en `lib/opta-estilos.ts`.
 */

import { useMemo, useRef, useState } from "react";

import { ORO, tinta, useEscudos } from "@/components/data/graficas";
import { CASTILLA_OPTA } from "@/lib/opta";
import { enAmbito, type Ambito } from "@/lib/opta-analisis";
import { INDICES, indicesEstilo, nombreCorto, topDe, type IndicesEquipo } from "@/lib/opta-estilos";
import { nombreMetrica } from "@/lib/opta-nombres";

import { Cifra, Elegir, ElegirAmbito, Panel } from "./comun";
import { EstilosJugadores } from "./EstilosJugadores";
import { MomentumLiga } from "./EstilosMomentum";
import { Radiografia } from "./EstilosRadiografia";
import type { DatosOpta } from "./useOpta";
import { ALTO, ANCHO, CIRCULOS, coloca, RADIO, REGIONES } from "./venn";

const FICHA = 24;

const resumen = (x: IndicesEquipo) =>
  INDICES.map((i) => `${i.nombre} ${x[i.clave] != null ? Math.round(x[i.clave]!) : ""}`).join(" · ");

function VennEstilos({ datos, alElegir }: { datos: DatosOpta; alElegir: (teamId: string) => void }) {
  const { equipos, grupos, catalogo } = datos;
  const escudoDe = useEscudos();
  const [ambito, setAmbito] = useState<Ambito>("todos");
  const [n, setN] = useState("15");

  const muestra = useMemo(() => equipos.filter((f) => enAmbito(f.teamId, grupos, ambito)), [equipos, grupos, ambito]);
  const indices = useMemo(() => indicesEstilo(muestra, catalogo), [muestra, catalogo]);
  const tope = Math.min(Number(n), indices.length);
  const top = useMemo(() => topDe(indices, tope), [indices, tope]);

  const porRegion = useMemo(() => {
    const m = new Map<number, IndicesEquipo[]>();
    for (const x of indices) {
      const k = (top.dominio.has(x.teamId) ? 1 : 0) | (top.peligro.has(x.teamId) ? 2 : 0) | (top.solidez.has(x.teamId) ? 4 : 0);
      m.set(k, [...(m.get(k) ?? []), x]);
    }
    for (const lista of m.values()) lista.sort((a, b) => (b.dominio ?? 0) + (b.peligro ?? 0) + (b.solidez ?? 0) - ((a.dominio ?? 0) + (a.peligro ?? 0) + (a.solidez ?? 0)));
    return m;
  }, [indices, top]);

  const fichas = useMemo(
    () =>
      REGIONES.flatMap(({ m }) => {
        const lista = porRegion.get(m) ?? [];
        const sitios = coloca(m, lista.length, FICHA);
        return lista.map((x, i) => ({ x, pos: sitios[i] }));
      }),
    [porRegion],
  );

  const castilla = indices.find((x) => x.teamId === CASTILLA_OPTA);
  const fuera = porRegion.get(0) ?? [];
  const opcionesN = [5, 8, 10, 12, 15, 20].filter((k) => k <= Math.max(5, indices.length)).map((k) => ({ clave: String(k), nombre: `Top ${k}` }));

  const ficha = (x: IndicesEquipo, nuestro: boolean) => (
    <button
      key={x.teamId}
      type="button"
      onClick={() => alElegir(x.teamId)}
      title={resumen(x)}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs transition hover:text-white ${nuestro ? "font-semibold" : "border-white/10 bg-white/[0.04] text-white/80"}`}
      style={nuestro ? { color: ORO, borderColor: ORO } : undefined}
    >
      {(() => {
        const e = escudoDe(x.equipo);
        return e ? (
          // eslint-disable-next-line @next/next/no-img-element -- escudo pequeño por el proxy propio
          <img src={e} alt="" width={14} height={14} className="h-3.5 w-3.5 object-contain" />
        ) : null;
      })()}
      {nombreCorto(x.equipo)}
    </button>
  );

  return (
    <Panel
      titulo="Estilos: dominio, peligro y solidez"
      subtitulo={`Cada círculo son los ${tope} mejores de un índice; cada equipo cae donde se cruzan los suyos. Pincha un escudo para ver su radiografía.`}
      derecha={
        <>
          <ElegirAmbito valor={ambito} alCambiar={setAmbito} />
          <Elegir etiqueta="Cuántos" valor={n} alCambiar={setN} opciones={opcionesN} />
        </>
      }
    >
      {castilla && (
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          {INDICES.map((i) => (
            <Cifra
              key={i.clave}
              rotulo={`Castilla · ${i.nombre}`}
              valor={castilla[i.clave] != null ? String(Math.round(castilla[i.clave]!)) : ""}
              detalle={`${top[i.clave].has(CASTILLA_OPTA) ? `Dentro del top ${tope}` : `Fuera del top ${tope}`} · ${
                [...indices].filter((y) => (y[i.clave] ?? -1) > (castilla[i.clave] ?? -1)).length + 1
              }.º de ${indices.length}`}
            />
          ))}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} className="mx-auto block h-auto w-full max-w-[620px]" role="img" aria-label="Diagrama de Venn de los estilos de juego">
          {CIRCULOS.map((c) => (
            <circle key={c.clave} cx={c.cx} cy={c.cy} r={RADIO} style={{ fill: c.color, fillOpacity: 0.1, stroke: c.color, strokeOpacity: 0.7, strokeWidth: 1.5 }} />
          ))}
          {CIRCULOS.map((c, i) => {
            const ind = INDICES.find((x) => x.clave === c.clave)!;
            const [x, y, ancla] = i === 0 ? [c.cx - RADIO + 18, 22, "start"] : i === 1 ? [c.cx + RADIO - 18, 22, "end"] : [c.cx, ALTO - 8, "middle"];
            return (
              <text key={c.clave} x={x} y={y} textAnchor={ancla as "start" | "end" | "middle"} style={{ fill: c.color, fontSize: 15, fontWeight: 700, letterSpacing: 1.5 }}>
                {ind.nombre.toUpperCase()}
              </text>
            );
          })}
          {fichas.map(({ x, pos }) => {
            const nuestro = x.teamId === CASTILLA_OPTA;
            const escudo = escudoDe(x.equipo);
            const r = FICHA / 2;
            return (
              <g
                key={x.teamId}
                role="button"
                tabIndex={0}
                aria-label={`${x.equipo}: ${resumen(x)}`}
                onClick={() => alElegir(x.teamId)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    alElegir(x.teamId);
                  }
                }}
                style={{ cursor: "pointer" }}
              >
                <title>{`${x.equipo} · ${resumen(x)}`}</title>
                <circle cx={pos[0]} cy={pos[1]} r={r} style={{ fill: tinta(0.08), stroke: nuestro ? ORO : tinta(0.25), strokeWidth: nuestro ? 2.5 : 1 }} />
                {escudo ? (
                  <image href={escudo} x={pos[0] - r + 3} y={pos[1] - r + 3} width={FICHA - 6} height={FICHA - 6} preserveAspectRatio="xMidYMid meet" />
                ) : (
                  <text x={pos[0]} y={pos[1] + 3.5} textAnchor="middle" style={{ fill: nuestro ? ORO : tinta(0.85), fontSize: 9, fontWeight: 700 }}>
                    {nombreCorto(x.equipo).slice(0, 3).toUpperCase()}
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
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">
                  {nombre} · {lista.length}
                </p>
                <div className="flex flex-wrap gap-1.5">{lista.map((x) => ficha(x, x.teamId === CASTILLA_OPTA))}</div>
              </div>
            );
          })}
          {fuera.length > 0 && (
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">En ninguno · {fuera.length}</p>
              <div className="flex flex-wrap gap-1.5">{fuera.map((x) => ficha(x, x.teamId === CASTILLA_OPTA))}</div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-3 border-t border-white/10 pt-3 sm:grid-cols-3">
        {INDICES.map((i) => (
          <div key={i.clave} className="min-w-0 text-[11px] leading-relaxed text-white/55">
            <p className="font-semibold text-white/80" style={{ color: CIRCULOS.find((c) => c.clave === i.clave)?.color }}>
              {i.nombre}: {i.que.toLowerCase()}
            </p>
            <p>
              {i.metricas.map((m) => `${nombreMetrica(m.a, catalogo)}${m.inverso ? " (menos, mejor)" : ""}`).join(", ")}.
            </p>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-white/45">
        Cada índice es la media de los percentiles de sus métricas por partido (0-100) entre los equipos que se ven; el «top» es el de ese índice.
      </p>
    </Panel>
  );
}

/** `inicial`: el equipo de la radiografía al abrir (el próximo rival, si se sabe). */
export function Estilos({ datos, inicial }: { datos: DatosOpta; inicial?: string }) {
  const [elegido, setEquipo] = useState<string | null>(null);
  const equipo = elegido ?? inicial ?? CASTILLA_OPTA;
  const caja = useRef<HTMLDivElement>(null);
  const abre = (teamId: string) => {
    setEquipo(teamId);
    caja.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="mt-6 space-y-6">
      <MomentumLiga datos={datos} />
      <VennEstilos datos={datos} alElegir={abre} />
      <EstilosJugadores datos={datos} />
      <Radiografia ref={caja} datos={datos} teamId={equipo} alCambiar={setEquipo} />
    </div>
  );
}
