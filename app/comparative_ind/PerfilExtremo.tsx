"use client";

/*
| EXTREMO CONECTOR O REGATEADOR (18/11/2026, idea de X)
|
| Un plano con dos ejes para los extremos: a la derecha, cuánto encara
| (regates intentados por 90); arriba, cuánto conecta (pases al último tercio
| + pases progresivos, por 90). Cada eje es el percentil contra los extremos
| de la categoría del grupo elegido (sub-21, sub-23 o todos), con los mismos
| 90′ mínimos que el resto de la pantalla. Las líneas del 50 parten el plano
| en cuatro: «conecta por dentro», «encara», «hace las dos cosas» y «poco de
| ambas». Los nuestros se ven siempre, entren o no por edad en el grupo.
|
| Extremo = la primera sigla de Wyscout es de banda (LW, RW, LWF, RWF, LAMF,
| RAMF). El mediapunta centrado (AMF) también es «BAN» en la pantalla, pero no
| es un extremo y aquí no entra.
*/

import { useEffect, useMemo, useRef, useState } from "react";

import { ORO, tinta } from "@/components/data/graficas";
import { chipInk } from "@/lib/theme";
import { esNuestro, MINUTOS_MINIMOS, percentilEnPlantilla, valorDe } from "@/lib/data-analisis/individual";
import type { FilaJugador } from "@/lib/data-analisis/leer";
import { REFERENCIAS, type Referencia } from "@/lib/comparativa-u21";

const REGATES = "Regates/90";
const ULTIMO_TERCIO = "Pases en el último tercio/90";
const PROGRESIVOS = "Pases progresivos/90";

export const esExtremo = (posicion: string) => /^(L|R)(W|WF|AMF)$/.test(posicion.split(",")[0].trim().toUpperCase());

type Cuadrante = "ambas" | "encara" | "conecta" | "poco";

export const CUADRANTES: Record<Cuadrante, string> = {
  ambas: "hace las dos cosas",
  encara: "encara",
  conecta: "conecta por dentro",
  poco: "poco de ambas",
};

const cuadranteDe = (x: number, y: number): Cuadrante =>
  x >= 50 && y >= 50 ? "ambas" : x >= 50 ? "encara" : y >= 50 ? "conecta" : "poco";

type Punto = {
  jugador: FilaJugador;
  regates: number;
  conecta: number;
  px: number;
  py: number;
  nuestro: boolean;
};

const num = (v: number) => v.toFixed(2).replace(/\.?0+$/, "").replace(".", ",");

export function PerfilExtremo({
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

  useEffect(() => {
    const el = caja.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setAncho(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const edad = REFERENCIAS.find((r) => r.key === refe)?.edad ?? 21;
  const { puntos, grupoN } = useMemo<{ puntos: Punto[]; grupoN: number }>(() => {
    const conCifras = jugadores
      .filter((j) => j.temporada === "actual" && j.minutos >= MINUTOS_MINIMOS && esExtremo(j.posicion))
      .map((j) => {
        const r = valorDe(j, REGATES);
        const t = valorDe(j, ULTIMO_TERCIO);
        const p = valorDe(j, PROGRESIVOS);
        return r === null || t === null || p === null ? null : { jugador: j, regates: r, conecta: t + p, nuestro: esNuestro(j) };
      })
      .filter((p): p is Omit<Punto, "px" | "py"> => p !== null);
    /* El grupo contra el que se saca el percentil: los extremos de la edad elegida. */
    const grupo = conCifras.filter((p) => p.jugador.edad > 0 && p.jugador.edad <= edad);
    if (grupo.length < 5) return { puntos: [], grupoN: grupo.length };
    const regatesGrupo = grupo.map((p) => p.regates);
    const conectaGrupo = grupo.map((p) => p.conecta);
    const lista = conCifras
      .filter((p) => p.nuestro || (p.jugador.edad > 0 && p.jugador.edad <= edad))
      .map((p) => ({
        ...p,
        px: percentilEnPlantilla(p.regates, regatesGrupo, true) ?? 50,
        py: percentilEnPlantilla(p.conecta, conectaGrupo, true) ?? 50,
      }));
    return { puntos: lista, grupoN: grupo.length };
  }, [jugadores, edad]);

  const nuestros = useMemo(() => puntos.filter((p) => p.nuestro).sort((a, b) => b.jugador.minutos - a.jugador.minutos), [puntos]);

  if (!puntos.length || !nuestros.length) return null;

  const foco =
    nuestros.find((p) => p.jugador.jugador === visto) ?? nuestros.find((p) => p.jugador.jugador === elegido) ?? nuestros[0];
  const cuadFoco = CUADRANTES[cuadranteDe(foco.px, foco.py)];

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
    { texto: CUADRANTES.conecta, x: sx(2), y: sy(97), fin: false },
    { texto: CUADRANTES.ambas, x: sx(98), y: sy(97), fin: true },
    { texto: CUADRANTES.poco, x: sx(2), y: sy(3), fin: false },
    { texto: CUADRANTES.encara, x: sx(98), y: sy(3), fin: true },
  ];
  const ordenados = [...puntos].sort((a, b) => Number(a.nuestro) - Number(b.nuestro));

  return (
    <div ref={caja} id="x-idea-2122961967682064398-2" className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-[11px] uppercase tracking-wider text-white/40">Extremos · ¿conector o regateador?</p>
      <p className="mt-1 text-base font-semibold">
        <span style={{ color: chipInk(ORO) }}>{nombreDe(foco.jugador)}</span> {cuadFoco}
      </p>
      <p className="mt-0.5 text-xs text-white/45">
        Percentil contra los {grupoN} extremos de {refLabel.toLowerCase()} con {MINUTOS_MINIMOS}′ o más. Derecha: regates intentados por 90 (1c1).
        Arriba: pases al último tercio + pases progresivos por 90 (conecta). Las líneas, el percentil 50.
      </p>

      {nuestros.length > 1 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {nuestros.map((p) => (
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
        </div>
      )}

      <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto mt-2 h-auto w-full max-w-[860px]" role="img" aria-label="Regates intentados frente a pases que conectan, en percentil">
        <rect x={sx(50)} y={sy(100)} width={sx(100) - sx(50)} height={sy(50) - sy(100)} fill={ORO} fillOpacity={0.08} />
        {[0, 25, 50, 75, 100].map((v) => (
          <g key={v}>
            <line x1={sx(v)} x2={sx(v)} y1={sy(0)} y2={sy(100)} stroke="currentColor" strokeOpacity={v === 50 ? 0.35 : 0.08} />
            <line x1={sx(0)} x2={sx(100)} y1={sy(v)} y2={sy(v)} stroke="currentColor" strokeOpacity={v === 50 ? 0.35 : 0.08} />
            <text x={sx(v)} y={sy(0) + 16} textAnchor="middle" fontSize={letra - 1} fill="currentColor" fillOpacity={0.5}>{v}</text>
            <text x={sx(0) - 6} y={sy(v) + 4} textAnchor="end" fontSize={letra - 1} fill="currentColor" fillOpacity={0.5}>{v}</text>
          </g>
        ))}
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
                <title>{`${nombre} · ${p.jugador.equipo} · ${p.jugador.edad} años · ${num(p.regates)} regates/90 (P${p.px}) · ${num(p.conecta)} pases que conectan/90 (P${p.py})`}</title>
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
        <text x={sx(50)} y={H - 8} textAnchor="middle" fontSize={letra} fontWeight={700} letterSpacing="0.08em" fill="currentColor" fillOpacity={0.75}>REGATES INTENTADOS /90 · PERCENTIL</text>
        <text x={13} y={sy(50)} textAnchor="middle" fontSize={letra} fontWeight={700} letterSpacing="0.08em" fill="currentColor" fillOpacity={0.75} transform={`rotate(-90 13 ${sy(50)})`}>
          ÚLT. TERCIO + PROGRESIVOS /90 · PERCENTIL
        </text>
      </svg>

      {/* Lo nuestro en texto: en el móvil no se puede pasar el ratón. */}
      <div className="mt-2 space-y-1">
        {nuestros.map((p) => (
          <p key={p.jugador.jugador} className="text-[13px] text-white/80">
            <span className="mr-1" style={{ color: chipInk(ORO) }}>●</span>
            <b>{nombreDe(p.jugador)}</b>: {CUADRANTES[cuadranteDe(p.px, p.py)]} · P{p.px} en regates intentados ({num(p.regates)}/90) · P{p.py} en pases que conectan ({num(p.conecta)}/90)
            <span className="text-white/50"> · {p.jugador.minutos}′{p.jugador.edad > edad ? ` · ${p.jugador.edad} años, por encima de la edad del grupo` : ""}</span>
          </p>
        ))}
      </div>
    </div>
  );
}
