"use client";

/*
| PLANO DEL PIVOTE: SALIDA LIMPIA CONTRA DEFENSA DEL ÁREA (27/11/2026, idea de X)
|
| Las dos exigencias del modelo para el pivote, a la vez:
|
| - Derecha, la salida limpia: media de dos percentiles, los pases
|   progresivos PRECISOS por 90 (progresivos/90 × su precisión) y el % de
|   pases acertados. Wyscout no separa en su descarga los pases del campo
|   propio, así que se usa la precisión de todos sus pases (el pivote da casi
|   todos los suyos en campo propio y en la medular) y se dice en el pie.
| - Arriba, la defensa del área: media de tres percentiles, interceptaciones
|   por 90, duelos defensivos ganados por 90 (duelos/90 × % ganados) y tiros
|   interceptados por 90. Los despejes no vienen en la descarga de jugadores
|   de Wyscout: el tiro tapado es lo más parecido que hay y se dice también.
|
| Cada percentil, contra los pivotes del grupo elegido (sub-21, sub-23 o toda
| la categoría). Por defecto entran sólo los de 540′ o más (seis partidos);
| un botón abre a todos los que tienen el mínimo de la pantalla. Las líneas
| son las medianas de los pivotes del grupo en cada eje, y parten el plano en
| cuatro. Los nuestros van en oro y se ven siempre, aunque no lleguen a los
| minutos (entonces se avisa: tendencia).
|
| Pivote = la primera sigla de Wyscout acaba en DMF (DMF, LDMF, RDMF).
*/

import { useEffect, useMemo, useRef, useState } from "react";

import { ORO, tinta } from "@/components/data/graficas";
import { chipInk } from "@/lib/theme";
import { esNuestro, MINUTOS_MINIMOS, percentilEnPlantilla, valorDe } from "@/lib/data-analisis/individual";
import type { FilaJugador } from "@/lib/data-analisis/leer";
import { REFERENCIAS, type Referencia } from "@/lib/comparativa-u21";

export const MINUTOS_PIVOTE = 540;

const PROGRESIVOS = "Pases progresivos/90";
const PRECISION_PROGRESIVOS = "Precisión pases progresivos, %";
const PRECISION_PASES = "Precisión pases, %";
const INTERCEPTACIONES = "Interceptaciones/90";
const DUELOS_DEF = "Duelos defensivos/90";
const DUELOS_DEF_GANADOS = "Duelos defensivos ganados, %";
const TIROS_INTERCEPTADOS = "Tiros interceptados/90";

export const esPivote = (posicion: string) => /DMF$/.test(posicion.split(",")[0].trim().toUpperCase());

type Cifras = {
  progPrecisos: number;
  precision: number;
  intercep: number;
  duelosGanados: number;
  tapados: number;
};

type Punto = Cifras & {
  jugador: FilaJugador;
  nuestro: boolean;
  /** Percentiles de cada pieza. */
  pProg: number;
  pPrec: number;
  pInt: number;
  pDuel: number;
  pTap: number;
  /** Los dos ejes: media de sus piezas. */
  px: number;
  py: number;
};

const cifrasDe = (j: FilaJugador): Cifras | null => {
  const prog = valorDe(j, PROGRESIVOS);
  const precProg = valorDe(j, PRECISION_PROGRESIVOS);
  const prec = valorDe(j, PRECISION_PASES);
  const int = valorDe(j, INTERCEPTACIONES);
  const duel = valorDe(j, DUELOS_DEF);
  const duelPct = valorDe(j, DUELOS_DEF_GANADOS);
  const tap = valorDe(j, TIROS_INTERCEPTADOS);
  if ([prog, precProg, prec, int, duel, duelPct, tap].some((v) => v === null || !Number.isFinite(v))) return null;
  return {
    progPrecisos: (prog as number) * ((precProg as number) / 100),
    precision: prec as number,
    intercep: int as number,
    duelosGanados: (duel as number) * ((duelPct as number) / 100),
    tapados: tap as number,
  };
};

const mediana = (v: number[]) => {
  if (!v.length) return 50;
  const o = [...v].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
};

const num = (v: number) => v.toFixed(2).replace(/\.?0+$/, "").replace(".", ",");

type Cuadrante = "ambas" | "sale" | "defiende" | "ninguna";

const CUADRANTES: Record<Cuadrante, string> = {
  ambas: "cumple las dos",
  sale: "sale limpio, flojea en el área",
  defiende: "defiende el área, flojea en la salida",
  ninguna: "por debajo en las dos",
};

export function PerfilPivote({
  jugadores,
  refe,
  refLabel,
  elegido,
  nombreDe,
}: {
  jugadores: FilaJugador[];
  refe: Referencia;
  refLabel: string;
  elegido: string | null;
  nombreDe: (j: FilaJugador) => string;
}) {
  const caja = useRef<HTMLDivElement>(null);
  const [ancho, setAncho] = useState(760);
  const [visto, setVisto] = useState<string | null>(null);
  const [todosMinutos, setTodosMinutos] = useState(false);

  useEffect(() => {
    const el = caja.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setAncho(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const edad = REFERENCIAS.find((r) => r.key === refe)?.edad ?? 21;
  const minimo = todosMinutos ? MINUTOS_MINIMOS : MINUTOS_PIVOTE;

  const { puntos, grupoN, medX, medY } = useMemo(() => {
    const conCifras = jugadores
      .filter((j) => j.temporada === "actual" && j.minutos >= MINUTOS_MINIMOS && esPivote(j.posicion))
      .map((j) => {
        const c = cifrasDe(j);
        return c ? { ...c, jugador: j, nuestro: esNuestro(j) } : null;
      })
      .filter((p): p is Cifras & { jugador: FilaJugador; nuestro: boolean } => p !== null);
    const enGrupo = (p: { jugador: FilaJugador }) => p.jugador.edad > 0 && p.jugador.edad <= edad && p.jugador.minutos >= minimo;
    const grupo = conCifras.filter(enGrupo);
    if (grupo.length < 5) return { puntos: [] as Punto[], grupoN: grupo.length, medX: 50, medY: 50 };
    const col = (k: keyof Cifras) => grupo.map((p) => p[k]);
    const g = { prog: col("progPrecisos"), prec: col("precision"), int: col("intercep"), duel: col("duelosGanados"), tap: col("tapados") };
    const pc = (v: number, arr: number[]) => percentilEnPlantilla(v, arr, true) ?? 50;
    const conPercentil = (p: (typeof conCifras)[number]): Punto => {
      const pProg = pc(p.progPrecisos, g.prog);
      const pPrec = pc(p.precision, g.prec);
      const pInt = pc(p.intercep, g.int);
      const pDuel = pc(p.duelosGanados, g.duel);
      const pTap = pc(p.tapados, g.tap);
      return { ...p, pProg, pPrec, pInt, pDuel, pTap, px: Math.round((pProg + pPrec) / 2), py: Math.round((pInt + pDuel + pTap) / 3) };
    };
    const delGrupo = grupo.map(conPercentil);
    /* Los nuestros, siempre: aunque no lleguen a los minutos o pasen de la edad. */
    const nuestrosFuera = conCifras.filter((p) => p.nuestro && !enGrupo(p)).map(conPercentil);
    return {
      puntos: [...delGrupo, ...nuestrosFuera],
      grupoN: grupo.length,
      medX: mediana(delGrupo.map((p) => p.px)),
      medY: mediana(delGrupo.map((p) => p.py)),
    };
  }, [jugadores, edad, minimo]);

  const nuestros = useMemo(() => puntos.filter((p) => p.nuestro).sort((a, b) => b.jugador.minutos - a.jugador.minutos), [puntos]);

  if (!nuestros.length) return null;

  const cuadranteDe = (p: Punto): Cuadrante =>
    p.px >= medX && p.py >= medY ? "ambas" : p.px >= medX ? "sale" : p.py >= medY ? "defiende" : "ninguna";

  const foco =
    nuestros.find((p) => p.jugador.jugador === visto) ?? nuestros.find((p) => p.jugador.jugador === elegido) ?? nuestros[0];

  const estrecho = ancho < 560;
  const W = estrecho ? 420 : 760;
  const H = estrecho ? 420 : 470;
  const M = { l: 44, r: 14, t: 18, b: 44 };
  const anchoP = W - M.l - M.r;
  const altoP = H - M.t - M.b;
  const sx = (v: number) => M.l + (v / 100) * anchoP;
  const sy = (v: number) => M.t + altoP - (v / 100) * altoP;
  const letra = estrecho ? 13 : 12;
  const esquinas: { texto: string; x: number; y: number; fin: boolean }[] = [
    { texto: "defiende el área", x: sx(2), y: sy(97), fin: false },
    { texto: "cumple las dos", x: sx(98), y: sy(97), fin: true },
    { texto: "por debajo en las dos", x: sx(2), y: sy(3), fin: false },
    { texto: "sale limpio", x: sx(98), y: sy(3), fin: true },
  ];
  const ordenados = [...puntos].sort((a, b) => Number(a.nuestro) - Number(b.nuestro));
  const flojea = (p: Punto) => {
    const salida = p.px - medX;
    const area = p.py - medY;
    if (salida >= 0 && area >= 0) return "por encima de la mediana en las dos";
    return salida < area ? "donde más flojea: la salida" : "donde más flojea: la defensa del área";
  };

  return (
    <div ref={caja} id="x-idea-2126239749392220247-1" className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-[11px] uppercase tracking-wider text-white/40">Pivotes · salida limpia contra defensa del área</p>
      <p className="mt-1 text-base font-semibold">
        <span style={{ color: chipInk(ORO) }}>{nombreDe(foco.jugador)}</span> {CUADRANTES[cuadranteDe(foco)]}
      </p>
      <p className="mt-0.5 text-xs text-white/45">
        {grupoN >= 5
          ? `Percentil contra los ${grupoN} pivotes de ${refLabel.toLowerCase()} con ${minimo}′ o más. `
          : `Menos de 5 pivotes de ${refLabel.toLowerCase()} con ${minimo}′ o más: no hay plano. `}
        Derecha, salida limpia: media de pases progresivos precisos/90 y % de pases acertados. Arriba, defensa del área: media de
        interceptaciones/90, duelos defensivos ganados/90 y tiros interceptados/90. Las líneas, la mediana de los pivotes del grupo.
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {nuestros.length > 1 &&
          nuestros.map((p) => (
            <button
              key={p.jugador.jugador}
              type="button"
              onClick={() => setVisto(p.jugador.jugador)}
              className={`rounded-full border px-2.5 py-1 text-xs transition ${
                p === foco ? "border-[#C8A96B]/50 bg-[#C8A96B]/15 text-[#C8A96B]" : "border-white/10 bg-white/[0.03] text-white/65 hover:bg-white/[0.07]"
              }`}
            >
              {nombreDe(p.jugador)}
            </button>
          ))}
        <button
          type="button"
          onClick={() => setTodosMinutos((v) => !v)}
          aria-pressed={todosMinutos}
          className="ml-auto rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs text-white/65 transition hover:bg-white/[0.07]"
        >
          {todosMinutos ? `Sólo con ${MINUTOS_PIVOTE}′ o más` : `Todos desde ${MINUTOS_MINIMOS}′`}
        </button>
      </div>

      {grupoN >= 5 && (
        <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto mt-2 h-auto w-full max-w-[860px]" role="img" aria-label="Salida limpia frente a defensa del área de los pivotes, en percentil">
          <rect x={sx(medX)} y={sy(100)} width={sx(100) - sx(medX)} height={sy(medY) - sy(100)} fill={ORO} fillOpacity={0.08} />
          {[0, 25, 50, 75, 100].map((v) => (
            <g key={v}>
              <line x1={sx(v)} x2={sx(v)} y1={sy(0)} y2={sy(100)} stroke="currentColor" strokeOpacity={0.08} />
              <line x1={sx(0)} x2={sx(100)} y1={sy(v)} y2={sy(v)} stroke="currentColor" strokeOpacity={0.08} />
              <text x={sx(v)} y={sy(0) + 16} textAnchor="middle" fontSize={letra - 1} fill="currentColor" fillOpacity={0.5}>{v}</text>
              <text x={sx(0) - 6} y={sy(v) + 4} textAnchor="end" fontSize={letra - 1} fill="currentColor" fillOpacity={0.5}>{v}</text>
            </g>
          ))}
          {/* Las medianas de la categoría. */}
          <line x1={sx(medX)} x2={sx(medX)} y1={sy(0)} y2={sy(100)} stroke="currentColor" strokeOpacity={0.45} strokeDasharray="5 4" />
          <line x1={sx(0)} x2={sx(100)} y1={sy(medY)} y2={sy(medY)} stroke="currentColor" strokeOpacity={0.45} strokeDasharray="5 4" />
          {esquinas.map((e) => (
            <text key={e.texto} x={e.x} y={e.y + (e.y < H / 2 ? letra : 0)} textAnchor={e.fin ? "end" : "start"} fontSize={letra - 1} fontWeight={700} letterSpacing="0.08em" fill="currentColor" fillOpacity={0.45}>
              {e.texto.toUpperCase()}
            </text>
          ))}
          {ordenados.map((p) => {
            const esFoco = p === foco;
            const nombre = nombreDe(p.jugador);
            const derecha = p.px > 70;
            return (
              <g key={`${p.jugador.jugador}|${p.jugador.equipo}`} style={p.nuestro ? { cursor: "pointer" } : undefined} onClick={p.nuestro ? () => setVisto(p.jugador.jugador) : undefined}>
                <circle
                  cx={sx(p.px)}
                  cy={sy(p.py)}
                  r={p.nuestro ? (esFoco ? 8 : 6.5) : estrecho ? 4.5 : 3.8}
                  fill={p.nuestro ? ORO : tinta(0.3)}
                  stroke={p.nuestro ? "var(--background)" : "none"}
                  strokeWidth={1.5}
                >
                  <title>{`${nombre} · ${p.jugador.equipo} · ${p.jugador.edad} años · ${p.jugador.minutos}′ · salida P${p.px} · área P${p.py}`}</title>
                </circle>
                {p.nuestro && (
                  <text
                    x={sx(p.px) + (derecha ? -11 : 11)}
                    y={sy(p.py) - 8}
                    textAnchor={derecha ? "end" : "start"}
                    fontSize={esFoco ? letra + 2 : letra}
                    fontWeight={esFoco ? 800 : 600}
                    style={{ fill: chipInk(ORO), paintOrder: "stroke", stroke: "var(--background)", strokeWidth: 2.5, strokeLinejoin: "round" }}
                  >
                    {nombre}
                  </text>
                )}
              </g>
            );
          })}
          <text x={sx(50)} y={H - 8} textAnchor="middle" fontSize={letra} fontWeight={700} letterSpacing="0.08em" fill="currentColor" fillOpacity={0.75}>SALIDA LIMPIA · PERCENTIL</text>
          <text x={13} y={sy(50)} textAnchor="middle" fontSize={letra} fontWeight={700} letterSpacing="0.08em" fill="currentColor" fillOpacity={0.75} transform={`rotate(-90 13 ${sy(50)})`}>
            DEFENSA DEL ÁREA · PERCENTIL
          </text>
        </svg>
      )}

      {/* Lo nuestro en texto: en el móvil no se puede pasar el ratón. */}
      {grupoN >= 5 && (
        <div className="mt-2 space-y-1">
          {nuestros.map((p) => (
            <p key={p.jugador.jugador} className="text-[13px] text-white/80">
              <span className="mr-1" style={{ color: chipInk(ORO) }}>●</span>
              <b>{nombreDe(p.jugador)}</b>: {CUADRANTES[cuadranteDe(p)]} ({flojea(p)}) · salida P{p.px} (progresivos precisos {num(p.progPrecisos)}/90, P{p.pProg}; pases {num(p.precision)} %, P{p.pPrec}) · área P{p.py} (interceptaciones {num(p.intercep)}/90, P{p.pInt}; duelos ganados {num(p.duelosGanados)}/90, P{p.pDuel}; tiros interceptados {num(p.tapados)}/90, P{p.pTap})
              <span className="text-white/50">
                {" "}· {p.jugador.minutos}′{p.jugador.minutos < minimo ? `, menos de ${minimo}′: tendencia` : ""}
                {p.jugador.edad > edad ? ` · ${p.jugador.edad} años, por encima de la edad del grupo` : ""}
              </span>
            </p>
          ))}
        </div>
      )}
      <p className="mt-2 text-[11px] text-white/40">
        Wyscout no da en su descarga de jugadores la precisión en campo propio ni los despejes: van la precisión de todos sus pases y los tiros interceptados, lo más parecido que hay.
      </p>
    </div>
  );
}
