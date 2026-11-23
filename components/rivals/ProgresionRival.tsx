"use client";

/**
 * CÓMO PROGRESA EL RIVAL: POR DENTRO EN CORTO O EN LARGO DIRECTO
 * (Scout colectivo, 19/11/2026, idea de X). Dispersión con un punto por
 * equipo de su liga: parte de pases largos (X) contra parte de pases
 * progresivos que entran por el carril central (Y). El rival, en oro, con su
 * punto de los últimos 5 partidos al lado (azul) y una frase que lo coloca en
 * un cuadrante. El Castilla, con su nombre.
 *
 * Datos: `opta:equipos`, `opta:directo:archivo` y `opta:directo:<partido>`
 * de los últimos 8 partidos de cada equipo, por `useDocsOpta`. La liga del
 * rival = los equipos que se cruzan con él en el archivo. Las cuentas, en
 * `lib/rivals/progresion-rival.ts`. Sin cruce o sin dato no se pinta; nada
 * se pide hasta que asoma.
 */

import { useMemo } from "react";

import { COMPARADO, ORO, tinta } from "@/components/data/graficas";
import { useAsoma } from "@/hooks/useAsoma";
import { useDocsOpta } from "@/hooks/useDocsOpta";
import { aObjetos, CASTILLA_OPTA, DOCS_OPTA, type TablaOpta } from "@/lib/opta";
import { NOMBRE_CASTILLA } from "@/lib/opta-analisis";
import { casaEquipo } from "@/lib/opta-eventos";
import { leeEventos } from "@/lib/opta-directo-mapas";
import {
  cuadrante,
  LARGO_M,
  MAX_PARTIDOS,
  mediana,
  MIN_PROGRESIVOS,
  puntoDe,
  QUE_HACER,
  RECIENTES,
  ultimosDe,
  Y_DENTRO,
  type PuntoProgresion,
} from "@/lib/rivals/progresion-rival";

type PartidoArchivo = { partido?: string; fecha?: string; equipos?: string[] };
type Archivo = { partidos?: PartidoArchivo[] };
type DocDirecto = { eventos?: TablaOpta };

const pct = (v: number) => `${Math.round(v * 100)} %`;

export function ProgresionRival({ equipo }: { equipo: string }) {
  const { caja, abierto } = useAsoma<HTMLDivElement>(2000);
  return <div ref={caja} className="min-w-0">{abierto && equipo && <Indice equipo={equipo} />}</div>;
}

/** Qué equipos son su liga y qué partidos hay que leer de cada uno. */
function Indice({ equipo }: { equipo: string }) {
  const { docs } = useDocsOpta<[TablaOpta, Archivo]>(DOCS_OPTA.equipos, "opta:directo:archivo");
  const [tEquipos, archivo] = docs;

  const plan = useMemo(() => {
    if (!tEquipos || !Array.isArray(archivo?.partidos)) return null;
    const equipos = aObjetos(tEquipos).map((f) => ({ teamId: String(f.teamId ?? ""), equipo: String(f.equipo ?? "") }));
    const rivalId = casaEquipo(equipo, equipos);
    if (!rivalId || rivalId === CASTILLA_OPTA) return null;
    const nombreRival = equipos.find((e) => e.teamId === rivalId)?.equipo || "";
    const partidos = archivo.partidos.filter((p) => p?.partido && (p.equipos ?? []).length >= 2);

    /* Su liga: los que se cruzan con él, y los que se cruzan con esos (en liga, todos). */
    const liga = new Set([nombreRival]);
    for (let vuelta = 0; vuelta < 3; vuelta++) {
      for (const p of partidos) {
        const [a, b] = p.equipos ?? [];
        if (liga.has(a) || liga.has(b)) {
          liga.add(a);
          liga.add(b);
        }
      }
    }
    const idDe = new Map(equipos.map((e) => [e.equipo, e.teamId]));
    const ids = new Set<string>();
    const miembros: { teamId: string; nombre: string }[] = [];
    for (const nombre of liga) {
      const teamId = idDe.get(nombre);
      if (!teamId) continue;
      miembros.push({ teamId, nombre: teamId === CASTILLA_OPTA ? NOMBRE_CASTILLA : nombre });
      partidos
        .filter((p) => (p.equipos ?? []).includes(nombre))
        .sort((a, b) => String(b.fecha ?? "").localeCompare(String(a.fecha ?? "")))
        .slice(0, MAX_PARTIDOS)
        .forEach((p) => ids.add(String(p.partido)));
    }
    if (miembros.length < 4 || !ids.size) return null;
    const fechas = new Map(partidos.map((p) => [String(p.partido), String(p.fecha ?? "")]));
    return { rivalId, nombreRival, miembros, ids: [...ids], fechas };
  }, [tEquipos, archivo, equipo]);

  if (!plan) return null;
  return <Bloque {...plan} />;
}

type Equipo = { teamId: string; nombre: string };

function Bloque({ rivalId, nombreRival, miembros, ids, fechas }: { rivalId: string; nombreRival: string; miembros: Equipo[]; ids: string[]; fechas: Map<string, string> }) {
  const { docs, cargando } = useDocsOpta<DocDirecto[]>(...ids.map(DOCS_OPTA.directo));

  const datos = useMemo(() => {
    const partidos = docs
      .map((d, i) => (d ? { partido: ids[i], fecha: fechas.get(ids[i]) ?? "", eventos: leeEventos(d.eventos) } : null))
      .filter((p): p is NonNullable<typeof p> => p != null && p.eventos.length > 0);
    if (!partidos.length) return null;
    const puntos: (PuntoProgresion & { nombre: string })[] = [];
    for (const m of miembros) {
      const p = puntoDe(ultimosDe(partidos, m.teamId, MAX_PARTIDOS), m.teamId);
      if (p) puntos.push({ ...p, nombre: m.nombre });
    }
    const rival = puntos.find((p) => p.teamId === rivalId);
    if (!rival || puntos.length < 4) return null;
    const ahora = puntoDe(ultimosDe(partidos, rivalId, RECIENTES), rivalId, Math.round(MIN_PROGRESIVOS / 2));
    const medX = mediana(puntos.map((p) => p.x));
    const medY = mediana(puntos.map((p) => p.y));
    return { puntos, rival, ahora, medX, medY };
  }, [docs, ids, fechas, miembros, rivalId]);

  if (!datos) {
    if (!cargando) return null;
    return (
      <section id="x-idea-2123322754879373347-1" aria-label="Cómo progresa el rival" className="portada-tarjeta mt-8 min-w-0 px-4 py-4 sm:px-5">
        <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#C8A96B]">Cómo progresa · por dentro en corto o en largo directo</p>
        <p className="mt-1 text-sm text-white/60">Leyendo el evento a evento de {ids.length} partidos de la liga…</p>
      </section>
    );
  }

  const { puntos, rival, ahora, medX, medY } = datos;
  const c = cuadrante(rival, medX, medY);
  const cAhora = ahora ? cuadrante(ahora, medX, medY) : null;
  const orden = (k: "x" | "y") => [...puntos].sort((a, b) => b[k] - a[k]).findIndex((p) => p.teamId === rivalId) + 1;
  const frase =
    `${nombreRival} es un equipo ${c}: ${pct(rival.x)} de pases largos (${orden("x")}.º de ${puntos.length}; mediana ${pct(medX)}) ` +
    `y ${pct(rival.y)} de sus pases progresivos entran por dentro (${orden("y")}.º; mediana ${pct(medY)}).`;
  const fraseAhora = ahora
    ? cAhora === c
      ? ` En sus últimos ${ahora.partidos} partidos sigue igual (${pct(ahora.x)} en largo, ${pct(ahora.y)} por dentro).`
      : ` Ojo: en sus últimos ${ahora.partidos} partidos se ha movido a «${cAhora}» (${pct(ahora.x)} en largo, ${pct(ahora.y)} por dentro).`
    : "";

  return (
    <section id="x-idea-2123322754879373347-1" aria-label="Cómo progresa el rival" className="portada-tarjeta portada-entra mt-8 min-w-0 px-4 py-4 sm:px-5">
      <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#C8A96B]">
        Cómo progresa · por dentro en corto o en largo directo
        <span className="rounded-full border border-white/15 px-2 py-0.5 text-[11px] font-semibold normal-case tracking-normal text-white/60">
          dato · Opta, {puntos.length} equipos, últimos {MAX_PARTIDOS} partidos de cada uno
        </span>
      </p>
      <h3 className="fuente-club mt-1.5 text-[26px] font-bold uppercase leading-[1.05] text-white sm:text-[32px]">
        {c.charAt(0).toUpperCase() + c.slice(1)}
      </h3>
      <p className="mt-1 text-sm leading-6 text-white/70">
        {frase}
        {fraseAhora}
      </p>
      <p className="mt-1 text-sm font-semibold leading-6 text-white/85">{QUE_HACER[cAhora ?? c]}</p>

      <Grafica puntos={puntos} rivalId={rivalId} ahora={ahora} medX={medX} medY={medY} />

      <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-white/60">
        <span className="inline-flex items-center gap-1.5">
          <svg width="10" height="10" aria-hidden className="shrink-0"><circle cx="5" cy="5" r="3.5" style={{ fill: tinta(0.4) }} /></svg>
          Cada equipo de la liga
        </span>
        <span className="inline-flex items-center gap-1.5">
          <svg width="12" height="12" aria-hidden className="shrink-0"><circle cx="6" cy="6" r="5" style={{ fill: ORO }} /></svg>
          {nombreRival} (últimos {rival.partidos})
        </span>
        {ahora && (
          <span className="inline-flex items-center gap-1.5">
            <svg width="12" height="12" aria-hidden className="shrink-0"><circle cx="6" cy="6" r="4.5" style={{ fill: COMPARADO }} /></svg>
            Sus últimos {ahora.partidos}
          </span>
        )}
      </p>
      <p className="mt-1 text-[11px] leading-5 text-white/55">
        Pase largo: pase en juego (sin saques de banda ni de puerta) de {LARGO_M} m o más, sobre todos sus pases en juego. Progresivo: completado, que acerca el balón a la portería al menos
        un 25 % y no se queda en campo propio; «por dentro» si acaba en el carril central (y {Y_DENTRO.y0}-{Y_DENTRO.y1} de Opta). Las líneas discontinuas, la mediana de la liga en cada
        eje, parten los cuatro cuadrantes. Equipos con menos de {MIN_PROGRESIVOS} progresivos, fuera.
      </p>
    </section>
  );
}

const W = 720;
const H = 340;
const M = { izq: 40, der: 14, arriba: 16, abajo: 38 };

function Grafica({
  puntos,
  rivalId,
  ahora,
  medX,
  medY,
}: {
  puntos: (PuntoProgresion & { nombre: string })[];
  rivalId: string;
  ahora: PuntoProgresion | null;
  medX: number;
  medY: number;
}) {
  const xs = [...puntos.map((p) => p.x), ...(ahora ? [ahora.x] : [])];
  const ys = [...puntos.map((p) => p.y), ...(ahora ? [ahora.y] : [])];
  const rango = (v: number[]) => {
    const lo = Math.min(...v);
    const hi = Math.max(...v);
    const r = hi - lo || 0.05;
    return [Math.max(0, lo - r * 0.1), Math.min(1, hi + r * 0.1)] as const;
  };
  const [xLo, xHi] = rango(xs);
  const [yLo, yHi] = rango(ys);
  const ancho = W - M.izq - M.der;
  const alto = H - M.arriba - M.abajo;
  const xDe = (v: number) => M.izq + ((v - xLo) / (xHi - xLo)) * ancho;
  const yDe = (v: number) => M.arriba + (1 - (v - yLo) / (yHi - yLo)) * alto;
  const rival = puntos.find((p) => p.teamId === rivalId)!;
  const castilla = puntos.find((p) => p.teamId === CASTILLA_OPTA);
  const rotulo = { fill: tinta(0.45), fontSize: 11, fontWeight: 700, letterSpacing: "0.06em" } as const;

  return (
    <figure className="portada-celda m-0 mt-3 min-w-0 p-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="grafico-cabe block h-auto w-full" role="img" aria-label="Pases largos contra pases progresivos por dentro, un punto por equipo de la liga">
        {/* Cuadrantes */}
        <line x1={xDe(medX)} x2={xDe(medX)} y1={M.arriba} y2={M.arriba + alto} style={{ stroke: tinta(0.25), strokeWidth: 1, strokeDasharray: "4 4" }} />
        <line x1={M.izq} x2={W - M.der} y1={yDe(medY)} y2={yDe(medY)} style={{ stroke: tinta(0.25), strokeWidth: 1, strokeDasharray: "4 4" }} />
        <text x={M.izq + 6} y={M.arriba + 12} style={rotulo}>COMBINATIVO POR DENTRO</text>
        <text x={W - M.der - 6} y={M.arriba + 12} textAnchor="end" style={rotulo}>MIXTO</text>
        <text x={M.izq + 6} y={M.arriba + alto - 6} style={rotulo}>COMBINATIVO POR FUERA</text>
        <text x={W - M.der - 6} y={M.arriba + alto - 6} textAnchor="end" style={rotulo}>DIRECTO</text>

        {[yLo, (yLo + yHi) / 2, yHi].map((m, i) => (
          <text key={`y${i}`} x={M.izq - 4} y={yDe(m) + 3} textAnchor="end" style={{ fill: tinta(0.55), fontSize: 11 }}>
            {pct(m)}
          </text>
        ))}
        {[xLo, (xLo + xHi) / 2, xHi].map((m, i) => (
          <text key={`x${i}`} x={xDe(m)} y={H - 22} textAnchor={i === 0 ? "start" : i === 2 ? "end" : "middle"} style={{ fill: tinta(0.55), fontSize: 11 }}>
            {pct(m)}
          </text>
        ))}
        <text x={M.izq} y={H - 6} style={{ fill: tinta(0.6), fontSize: 11, fontWeight: 600 }}>
          ← más en corto
        </text>
        <text x={W - M.der} y={H - 6} textAnchor="end" style={{ fill: tinta(0.6), fontSize: 11, fontWeight: 600 }}>
          % de pases largos · más directo →
        </text>
        <text x={M.izq - 30} y={M.arriba + alto / 2} transform={`rotate(-90 ${M.izq - 30} ${M.arriba + alto / 2})`} textAnchor="middle" style={{ fill: tinta(0.6), fontSize: 11, fontWeight: 600 }}>
          % progresivos por dentro
        </text>

        {puntos
          .filter((p) => p.teamId !== rivalId)
          .map((p) => (
            <circle key={p.teamId} cx={xDe(p.x)} cy={yDe(p.y)} r={4.5} style={{ fill: tinta(0.4), stroke: "var(--portada-sup)", strokeWidth: 1.25 }}>
              <title>{`${p.nombre}: ${pct(p.x)} de pases largos, ${pct(p.y)} de progresivos por dentro (${p.partidos} partidos)`}</title>
            </circle>
          ))}
        {castilla && (
          <text x={xDe(castilla.x)} y={yDe(castilla.y) - 8} textAnchor="middle" style={{ fill: tinta(0.7), fontSize: 11, fontWeight: 600 }}>
            Castilla
          </text>
        )}

        {ahora && (
          <>
            <line x1={xDe(rival.x)} y1={yDe(rival.y)} x2={xDe(ahora.x)} y2={yDe(ahora.y)} style={{ stroke: COMPARADO, strokeWidth: 1.5, strokeDasharray: "3 3" }} />
            <circle cx={xDe(ahora.x)} cy={yDe(ahora.y)} r={5.5} style={{ fill: COMPARADO, stroke: "var(--portada-sup)", strokeWidth: 1.5 }}>
              <title>{`Últimos ${ahora.partidos} partidos: ${pct(ahora.x)} de pases largos, ${pct(ahora.y)} de progresivos por dentro`}</title>
            </circle>
          </>
        )}
        <circle cx={xDe(rival.x)} cy={yDe(rival.y)} r={7} style={{ fill: ORO, stroke: "var(--portada-sup)", strokeWidth: 1.5 }}>
          <title>{`${rival.nombre}: ${pct(rival.x)} de pases largos, ${pct(rival.y)} de progresivos por dentro (${rival.partidos} partidos)`}</title>
        </circle>
        <text
          x={xDe(rival.x)}
          y={yDe(rival.y) + (ahora && ahora.y < rival.y ? -12 : 20)}
          textAnchor={xDe(rival.x) > W - 120 ? "end" : xDe(rival.x) < M.izq + 80 ? "start" : "middle"}
          style={{ fill: ORO, fontSize: 12, fontWeight: 700 }}
        >
          {rival.nombre}
        </text>
      </svg>
    </figure>
  );
}
