"use client";

/**
 * EL PARTIDO EN RELIEVE (14/11/2026): el dibujo de `lib/opta-relieve.ts`.
 *
 * Una superficie en perspectiva (SVG, sin librerías): de izquierda a derecha el
 * minuto, hacia el fondo el carril del campo, en altura la presión. Color del
 * equipo que la pone (A en oro, B en rojo), más claro cuanto más alto. Cada
 * pico es un remate (al pasar el ratón: minuto, quién y xG); el gol lleva una
 * bola blanca encima. `compacto` = la versión pequeña para ver varios
 * partidos a la vez.
 */

import { useMemo } from "react";

import { leeEventos, type JugadorDirecto } from "@/lib/opta-directo-mapas";
import type { TablaOpta } from "@/lib/opta";
import { CARRILES, relieve } from "@/lib/opta-relieve";

const COLOR_A = [236, 194, 92];
const COLOR_B = [236, 84, 88];
const GRIS = [70, 78, 74];

const mezcla = (p: number, h: number) => {
  const base = COLOR_A.map((v, i) => v * p + COLOR_B[i] * (1 - p));
  /* Abajo casi gris (sin peligro); arriba el color entero y más claro. */
  const k = Math.min(1, h / 0.35);
  const luz = 0.75 + 0.35 * Math.min(1, h);
  return `rgb(${base.map((v, i) => Math.round(Math.min(255, (GRIS[i] * (1 - k) + v * k) * luz))).join(",")})`;
};

export function RelievePartido({
  eventos,
  a,
  b,
  jugadores,
  compacto = false,
}: {
  eventos: TablaOpta | null | undefined;
  a: { teamId: string; nombre: string };
  b: { teamId: string; nombre: string };
  jugadores?: Map<string, JugadorDirecto>;
  compacto?: boolean;
}) {
  const ev = useMemo(() => leeEventos(eventos), [eventos]);
  const r = useMemo(() => relieve(ev, a.teamId, b.teamId), [ev, a.teamId, b.teamId]);

  const W = compacto ? 420 : 1000;
  const H = compacto ? 150 : 320;
  const sx = compacto ? 9 : 22; // cuánto se va a la derecha cada carril hacia el fondo
  const sy = compacto ? 6 : 14; // y hacia arriba
  const alto = compacto ? 70 : 170;
  const x0 = compacto ? 10 : 46;
  const y0 = H - (compacto ? 16 : 40);
  const dx = (W - x0 - 20 - sx * (CARRILES - 1)) / (r.minutos - 1);
  const P = (t: number, c: number, h: number): [number, number] => [x0 + t * dx + c * sx, y0 - c * sy - h * alto];

  const caras = useMemo(() => {
    const l: { d: string; fill: string }[] = [];
    for (let c = CARRILES - 2; c >= 0; c--)
      for (let t = 0; t < r.minutos - 1; t++) {
        const h = [r.altura[t][c], r.altura[t + 1][c], r.altura[t + 1][c + 1], r.altura[t][c + 1]];
        const pts = [P(t, c, h[0]), P(t + 1, c, h[1]), P(t + 1, c + 1, h[2]), P(t, c + 1, h[3])];
        const hm = (h[0] + h[1] + h[2] + h[3]) / 4;
        const p = (r.parteA[t][c] + r.parteA[t + 1][c] + r.parteA[t][c + 1] + r.parteA[t + 1][c + 1]) / 4;
        l.push({ d: `M${pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join("L")}Z`, fill: mezcla(p, hm) });
      }
    return l;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r, W, H]);

  const nombre = (id: string) => jugadores?.get(id)?.nombre ?? "";
  const golesA = r.picos.filter((p) => p.gol && p.deA).length;
  const golesB = r.picos.filter((p) => p.gol && !p.deA).length;

  if (ev.length < 20) return null;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`El partido en relieve: ${a.nombre} ${golesA}-${golesB} ${b.nombre}`}>
      <rect x={0} y={0} width={W} height={H} rx={compacto ? 10 : 16} style={{ fill: "#0B1410" }} />
      {/* El suelo: la rejilla de los minutos. */}
      {[0, 15, 30, 45, 60, 75, 90].filter((m) => m < r.minutos).map((m) => {
        const [x1, y1] = P(m, 0, 0);
        const [x2, y2] = P(m, CARRILES - 1, 0);
        return (
          <g key={m}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} style={{ stroke: m === 45 ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.12)", strokeDasharray: m === 45 ? "4 4" : undefined }} />
            {!compacto && (
              <text x={x1} y={y1 + 18} textAnchor="middle" style={{ fill: "rgba(255,255,255,0.55)", fontSize: 12 }}>
                {m === 45 ? "Descanso" : `${m}′`}
              </text>
            )}
          </g>
        );
      })}
      {caras.map((q, i) => (
        <path key={i} d={q.d} style={{ fill: q.fill, stroke: "rgba(0,0,0,0.25)", strokeWidth: compacto ? 0.3 : 0.5 }} />
      ))}
      {/* Cada remate: su punta (el ratón dice quién y cuánto); el gol, con bola. */}
      {r.picos.map((p, i) => {
        const h = Math.max(...[-1, 0, 1].map((dc) => r.altura[p.minuto]?.[Math.min(CARRILES - 1, Math.max(0, p.carril + dc))] ?? 0));
        const [x, y] = P(p.minuto, p.carril, h);
        return (
          <g key={i}>
            <circle cx={x} cy={y} r={compacto ? 3 : p.gol ? 7 : 4} style={{ fill: p.gol ? "#FFFFFF" : "rgba(255,255,255,0.0)", stroke: p.gol ? (p.deA ? "rgb(236,194,92)" : "rgb(236,84,88)") : "transparent", strokeWidth: 3 }}>
              <title>{`${p.minuto}′ ${p.gol ? "GOL" : "remate"} de ${p.deA ? a.nombre : b.nombre}${nombre(p.jugadorId) ? ` (${nombre(p.jugadorId)})` : ""}: xG ${p.xg.toFixed(2).replace(".", ",")}`}</title>
            </circle>
            {p.gol && !compacto && (
              <text x={x} y={y - 12} textAnchor="middle" style={{ fill: "#FFFFFF", fontSize: 12, fontWeight: 800 }}>
                GOL {p.minuto}′
              </text>
            )}
          </g>
        );
      })}
      {!compacto && (
        <g>
          <text x={W - 16} y={26} textAnchor="end" style={{ fill: "rgb(236,194,92)", fontSize: 14, fontWeight: 700 }}>
            {a.nombre}
          </text>
          <text x={W - 16} y={46} textAnchor="end" style={{ fill: "rgb(236,84,88)", fontSize: 14, fontWeight: 700 }}>
            {b.nombre}
          </text>
        </g>
      )}
    </svg>
  );
}
