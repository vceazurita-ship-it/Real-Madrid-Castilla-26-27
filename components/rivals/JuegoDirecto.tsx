"use client";

/**
 * ¿LE VA MEJOR AL RIVAL CUANDO JUEGA DIRECTO? (Scout colectivo, 27/11/2026,
 * idea de X). Sus partidos partidos por su propia mediana de % de pases
 * largos: puntos, xG a favor, xG en contra y remates de cada mitad, con la
 * media de la liga al lado, y una tira con cada partido en su % de largos.
 *
 * Datos: `opta:partidos` por `useOptaLigero`, cruzado con `casaEquipo` como en
 * «¿Se le rompe la salida si le presionamos?». Cuentas en
 * `lib/rivals/juego-directo.ts`. Sin cruce o sin dato, no se pinta.
 */

import { useMemo } from "react";

import { COMPARADO, MEJOR, ORO, PEOR, tinta } from "@/components/data/graficas";
import { useOptaLigero } from "@/hooks/useOptaLigero";
import { useAsoma } from "@/hooks/useAsoma";
import { CASTILLA_OPTA } from "@/lib/opta";
import { casaEquipo } from "@/lib/opta-eventos";
import { fechaCorta } from "@/lib/opta-analisis";
import { partidosPorEquipo } from "@/lib/opta-evolucion";
import { juegoDirecto, MIN_POR_GRUPO, UMBRAL_BALANCE, UMBRAL_PUNTOS, type Cuatro, type JuegoDirecto as Datos } from "@/lib/rivals/juego-directo";

const dec = (v: number | null, d = 1) => (v == null ? "—" : v.toFixed(d).replace(".", ","));

export function JuegoDirecto({ equipo }: { equipo: string }) {
  const { caja, abierto } = useAsoma<HTMLDivElement>(2000);
  return <div ref={caja} className="min-w-0">{abierto && <Contenido equipo={equipo} />}</div>;
}

type Metrica = { clave: keyof Omit<Cuatro, "n">; rotulo: string; d: number; masEsMejor: boolean };
const METRICAS: Metrica[] = [
  { clave: "puntos", rotulo: "Puntos por partido", d: 2, masEsMejor: true },
  { clave: "xg", rotulo: "xG a favor", d: 2, masEsMejor: true },
  { clave: "xgc", rotulo: "xG en contra", d: 2, masEsMejor: false },
  { clave: "remates", rotulo: "Remates", d: 1, masEsMejor: true },
];

function Contenido({ equipo }: { equipo: string }) {
  const { opta } = useOptaLigero();

  const datos = useMemo(() => {
    if (!opta) return null;
    const equipos = opta.equipos.map((f) => ({ teamId: String(f.teamId ?? ""), equipo: String(f.equipo ?? "") }));
    const rivalId = casaEquipo(equipo, equipos);
    if (!rivalId || rivalId === CASTILLA_OPTA) return null;
    const nombre = equipos.find((e) => e.teamId === rivalId)?.equipo || equipo;
    const j = juegoDirecto(partidosPorEquipo(opta.partidos), rivalId);
    return j ? { j, nombre } : null;
  }, [opta, equipo]);

  if (!datos) return null;
  const { j, nombre } = datos;
  const { partidos, mediana, directo, corto, liga, medianaLiga, mejor, motivo } = j;

  const titular =
    mejor === "directo"
      ? "Le va mejor cuando juega directo"
      : mejor === "corto"
        ? "Sufre cuando le toca jugar en largo"
        : "Juegue en largo o en corto, rinde parecido";
  const explica =
    mejor === "directo"
      ? `En sus partidos con más balón largo que su mediana (${dec(mediana)} %), ${nombre} saca más puntos y mejor balance de xG. Apretarle arriba para que la pegue en largo le hace un favor: mejor dejarle salir y defender su juego por dentro.`
      : mejor === "corto"
        ? `En sus partidos con más balón largo que su mediana (${dec(mediana)} %), ${nombre} saca menos puntos y peor balance de xG. Apretarle arriba para obligarle a jugar en largo tiene premio.`
        : motivo === "pocos"
          ? `Hacen falta ${MIN_POR_GRUPO} partidos en cada mitad para leerlo; por ahora, ${partidos.length} con dato.`
          : motivo === "cruzada"
            ? `Los puntos y el xG dicen cosas distintas: la manera de jugar no explica sus resultados. Apretarle arriba no es ni premio ni favor por sí solo.`
            : `La diferencia entre sus partidos más y menos directos es pequeña: obligarle a jugar en largo no le cambia el partido.`;

  return (
    <section id="x-idea-2125881654086705213-1" aria-label="¿Le va mejor cuando juega directo?" className="portada-tarjeta portada-entra mt-8 min-w-0 px-4 py-4 sm:px-5">
      <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#C8A96B]">
        Cómo sale · ¿le va mejor cuando juega directo?
        <span className="rounded-full border border-white/15 px-2 py-0.5 text-[11px] font-semibold normal-case tracking-normal text-white/60">
          dato · Opta, {partidos.length} {partidos.length === 1 ? "partido" : "partidos"} suyos
        </span>
        {!mejor && (
          <span className="rounded-full border border-amber-400/40 px-2 py-0.5 text-[11px] font-semibold normal-case tracking-normal text-amber-300">
            sin diferencia clara
          </span>
        )}
      </p>
      <h3 className="fuente-club mt-1.5 text-[26px] font-bold uppercase leading-[1.05] text-white sm:text-[32px]">{titular}</h3>
      <p className="mt-1 text-sm leading-6 text-white/70">{explica}</p>

      <Tira j={j} />

      <div className="portada-celda mt-3 min-w-0 overflow-x-auto p-0">
        <table className="w-full min-w-[420px] border-collapse text-left text-[13px]">
          <thead>
            <tr className="text-[11px] uppercase tracking-[0.08em] text-white/55">
              <th className="px-3 py-2 font-semibold" />
              <th className="px-3 py-2 text-right font-semibold" style={{ color: ORO }}>
                Más directo
                <span className="block text-[10px] normal-case tracking-normal text-white/55">
                  {directo.n} part. · más de {dec(mediana)} % largos
                </span>
              </th>
              <th className="px-3 py-2 text-right font-semibold" style={{ color: COMPARADO }}>
                Menos directo
                <span className="block text-[10px] normal-case tracking-normal text-white/55">
                  {corto.n} part. · menos de {dec(mediana)} %
                </span>
              </th>
              <th className="px-3 py-2 text-right font-semibold">
                Liga
                <span className="block text-[10px] normal-case tracking-normal text-white/55">
                  media{medianaLiga != null ? ` · ${dec(medianaLiga)} % largos` : ""}
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {METRICAS.map((m) => {
              const a = directo[m.clave];
              const b = corto[m.clave];
              const dif = a != null && b != null ? a - b : null;
              const mejorA = dif == null || Math.abs(dif) < 10 ** -m.d ? null : (dif > 0) === m.masEsMejor;
              return (
                <tr key={m.clave} className="border-t border-white/10">
                  <th scope="row" className="px-3 py-2 font-medium text-white/75">{m.rotulo}</th>
                  <Celda valor={dec(a, m.d)} color={mejorA == null ? null : mejorA ? MEJOR : PEOR} />
                  <Celda valor={dec(b, m.d)} color={mejorA == null ? null : mejorA ? PEOR : MEJOR} />
                  <td className="px-3 py-2 text-right tabular-nums text-white/60">{dec(liga[m.clave], m.d)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-[11px] leading-5 text-white/55">
        % de largos: balones largos entre pases intentados de cada partido. Se parten sus partidos por su mediana (con un número impar, el de la mediana no entra). Verde, la mitad que sale mejor en esa fila; naranja, la peor. «Sin diferencia clara» si alguna mitad tiene menos de {MIN_POR_GRUPO} partidos, si puntos y balance de xG (a favor − en contra) apuntan a lados distintos o si ninguno cambia al menos {dec(UMBRAL_PUNTOS)} puntos o {dec(UMBRAL_BALANCE)} de xG. Liga: todos los partidos de los equipos de su grupo.
      </p>
    </section>
  );
}

function Celda({ valor, color }: { valor: string; color: string | null }) {
  return (
    <td className="px-3 py-2 text-right font-semibold tabular-nums" style={{ color: color ?? tinta(0.9) }}>
      {valor}
    </td>
  );
}

const W = 720;
const H = 96;
const M = { izq: 14, der: 14 };

/** Cada partido en su % de largos, con la raya de su mediana; el color, el resultado. */
function Tira({ j }: { j: Datos }) {
  const { partidos, mediana, medianaLiga } = j;
  const xs = partidos.map((p) => p.largos);
  if (medianaLiga != null) xs.push(medianaLiga);
  let lo = Math.min(...xs);
  let hi = Math.max(...xs);
  const r = hi - lo || 1;
  lo = Math.max(0, lo - r * 0.08);
  hi += r * 0.08;
  const xDe = (v: number) => M.izq + ((v - lo) / (hi - lo)) * (W - M.izq - M.der);
  const yEje = 48;
  const colorRes = (pts: number) => (pts === 3 ? MEJOR : pts === 1 ? tinta(0.5) : PEOR);

  return (
    <figure className="portada-celda m-0 mt-3 min-w-0 p-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="grafico-cabe block h-auto w-full" role="img" aria-label="Cada partido del rival según su porcentaje de pases largos">
        <rect x={M.izq} y={yEje - 18} width={Math.max(0, xDe(mediana) - M.izq)} height={36} style={{ fill: COMPARADO, opacity: 0.08 }} />
        <rect x={xDe(mediana)} y={yEje - 18} width={Math.max(0, W - M.der - xDe(mediana))} height={36} style={{ fill: ORO, opacity: 0.1 }} />
        <line x1={M.izq} x2={W - M.der} y1={yEje} y2={yEje} style={{ stroke: tinta(0.15), strokeWidth: 1 }} />
        <line x1={xDe(mediana)} x2={xDe(mediana)} y1={yEje - 24} y2={yEje + 24} style={{ stroke: tinta(0.7), strokeWidth: 1.5 }} />
        <text x={xDe(mediana)} y={yEje - 28} textAnchor="middle" style={{ fill: tinta(0.75), fontSize: 11, fontWeight: 600 }}>
          su mediana {dec(mediana)} %
        </text>
        {medianaLiga != null && (
          <g>
            <line x1={xDe(medianaLiga)} x2={xDe(medianaLiga)} y1={yEje - 16} y2={yEje + 16} style={{ stroke: tinta(0.45), strokeWidth: 1.25, strokeDasharray: "3 3" }} />
            <text x={xDe(medianaLiga)} y={yEje + 30} textAnchor="middle" style={{ fill: tinta(0.55), fontSize: 10 }}>
              liga {dec(medianaLiga)} %
            </text>
          </g>
        )}
        {partidos.map((p, i) => (
          <circle key={`${p.fecha}-${i}`} cx={xDe(p.largos)} cy={yEje + ((i % 3) - 1) * 7} r={5} style={{ fill: colorRes(p.puntos), stroke: "var(--portada-sup)", strokeWidth: 1.25 }}>
            <title>{`${fechaCorta(p.fecha)}${p.oponente ? ` · ante ${p.oponente}` : ""}: ${p.gf}-${p.gc}, ${dec(p.largos)} % largos${p.xg != null ? `, xG ${dec(p.xg, 2)}` : ""}${p.xgc != null ? ` – ${dec(p.xgc, 2)}` : ""}`}</title>
          </circle>
        ))}
        <text x={M.izq} y={H - 4} style={{ fill: tinta(0.6), fontSize: 11, fontWeight: 600 }}>
          ← menos directo
        </text>
        <text x={W - M.der} y={H - 4} textAnchor="end" style={{ fill: tinta(0.6), fontSize: 11, fontWeight: 600 }}>
          más directo →
        </text>
      </svg>
      <figcaption className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-white/60">
        <span className="inline-flex items-center gap-1.5"><Punto color={MEJOR} /> Ganó</span>
        <span className="inline-flex items-center gap-1.5"><Punto color={tinta(0.5)} /> Empató</span>
        <span className="inline-flex items-center gap-1.5"><Punto color={PEOR} /> Perdió</span>
      </figcaption>
    </figure>
  );
}

function Punto({ color }: { color: string }) {
  return (
    <svg width="10" height="10" aria-hidden className="shrink-0">
      <circle cx="5" cy="5" r="4" style={{ fill: color }} />
    </svg>
  );
}
