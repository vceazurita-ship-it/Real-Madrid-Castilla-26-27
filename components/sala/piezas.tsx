"use client";

/*
| LAS PIEZAS DE LA SALA DE PARTIDO (24/11/2026). Todo en SVG y HTML, con
| colores fijos: la sala es oscura en los dos temas (va dentro de
| `siempre-oscuro`), como una sala de control. Cuentas en lib/sala/modelo.ts.
*/

import { useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, Flame, Zap } from "lucide-react";

import {
  DURACION,
  curvaProbabilidad,
  curvaXg,
  enArea,
  posesion,
  ppda,
  pulso,
  red,
  reloj,
  territorio,
  type Alerta,
  type Cifras,
  type Destacado,
  type Hito,
  type Lado,
  type Partido,
  type Tiro,
} from "@/lib/sala/modelo";

/* ------------------------------------------------------------------ */
/*  PALETA FIJA                                                        */
/* ------------------------------------------------------------------ */

export const S = {
  fondo: "#030812",
  panel: "rgba(14, 26, 48, 0.55)",
  borde: "rgba(120, 170, 255, 0.16)",
  texto: "#E8F0FF",
  suave: "rgba(214, 228, 255, 0.62)",
  tenue: "rgba(214, 228, 255, 0.38)",
  linea: "rgba(150, 190, 255, 0.14)",
  favor: "#2BE3A0",
  aviso: "#FF8A3D",
  info: "#6FB2FF",
  oro: "#E9C46A",
  empate: "rgba(200, 214, 240, 0.45)",
};

const fmt = (v: number | null | undefined, d = 1) => (v == null || !Number.isFinite(v) ? "—" : v.toLocaleString("es-ES", { minimumFractionDigits: d, maximumFractionDigits: d }));
const pct = (v: number) => `${Math.round(v * 100)}%`;
const colorDe = (p: Partido, l: Lado) => (l === "L" ? p.local.color : p.visitante.color);

export function Panel({ titulo, detalle, children, className = "", derecha }: { titulo: string; detalle?: string; children: ReactNode; className?: string; derecha?: ReactNode }) {
  return (
    <section
      className={`relative min-w-0 overflow-hidden rounded-2xl p-4 sala-entra ${className}`}
      style={{ background: S.panel, border: `1px solid ${S.borde}`, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04), 0 20px 60px -30px rgba(0,0,0,0.8)", backdropFilter: "blur(10px)" }}
    >
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(120,190,255,0.55), transparent)" }} />
      <header className="mb-3 flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="fuente-club text-[15px] uppercase tracking-[0.18em]" style={{ color: S.texto }}>
            {titulo}
          </h2>
          {detalle && (
            <p className="mt-0.5 text-[11px] leading-snug" style={{ color: S.tenue }}>
              {detalle}
            </p>
          )}
        </div>
        {derecha}
      </header>
      {children}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  MARCADOR                                                           */
/* ------------------------------------------------------------------ */

export function Marcador({ p, t, c, modo, parte, prob }: { p: Partido; t: number; c: { L: Cifras; V: Cifras }; modo: "vivo" | "repeticion" | "final"; parte: number; prob: { L: number; X: number; V: number } }) {
  const avance = Math.min(1, t / DURACION);
  const R = 34;
  const circ = 2 * Math.PI * R;
  const equipo = (l: Lado) => {
    const e = l === "L" ? p.local : p.visitante;
    const yo = l === "L" ? c.L : c.V;
    const color = e.color;
    return (
      <div className={`flex min-w-0 flex-col ${l === "L" ? "items-end text-right" : "items-start text-left"}`}>
        <span className="fuente-club truncate text-[clamp(18px,2.6vw,34px)] uppercase leading-none tracking-[0.04em]" style={{ color: S.texto, textShadow: `0 0 24px ${color}66` }}>
          {e.nombre}
        </span>
        <span className="mt-2 h-1 w-24 rounded-full" style={{ background: `linear-gradient(90deg, ${l === "L" ? "transparent" : color}, ${l === "L" ? color : "transparent"})`, boxShadow: `0 0 18px ${color}` }} />
        <span className="mt-2 font-mono text-[13px] tabular-nums" style={{ color: S.suave }}>
          xG <b style={{ color: S.texto }}>{fmt(yo.xg, 2)}</b> · {yo.tiros} remates · {yo.aPuerta} a puerta
        </span>
      </div>
    );
  };

  return (
    <section className="relative overflow-hidden rounded-3xl px-4 py-5 sm:px-8 sala-entra" style={{ background: "radial-gradient(120% 140% at 50% 0%, rgba(40,80,160,0.35), rgba(5,12,26,0.6) 60%)", border: `1px solid ${S.borde}` }}>
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-40" style={{ background: `linear-gradient(90deg, ${p.local.color}22, transparent 35%, transparent 65%, ${p.visitante.color}22)` }} />
      {modo === "vivo" && <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-1/3 sala-barrido" style={{ background: "linear-gradient(90deg, transparent, rgba(120,190,255,0.06), transparent)" }} />}
      <div className="relative grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 sm:gap-8">
        {equipo("L")}
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-3 sm:gap-5">
            <span className="fuente-club text-[clamp(52px,8vw,104px)] leading-none tabular-nums" style={{ color: S.texto, textShadow: `0 0 30px ${p.local.color}` }}>
              {c.L.goles}
            </span>
            <div className="relative grid place-items-center">
              <svg width="84" height="84" viewBox="0 0 84 84" aria-hidden>
                <circle cx="42" cy="42" r={R} fill="none" stroke={S.linea} strokeWidth="4" />
                <circle cx="42" cy="42" r={R} fill="none" stroke="url(#sala-anillo)" strokeWidth="4" strokeLinecap="round" strokeDasharray={`${circ * avance} ${circ}`} transform="rotate(-90 42 42)" style={{ transition: "stroke-dasharray .6s ease" }} />
                <defs>
                  <linearGradient id="sala-anillo" x1="0" x2="1">
                    <stop offset="0" stopColor={p.local.color} />
                    <stop offset="1" stopColor={p.visitante.color} />
                  </linearGradient>
                </defs>
              </svg>
              <span className="absolute font-mono text-[18px] font-bold tabular-nums" style={{ color: S.texto }}>
                {modo === "final" ? "FIN" : reloj(t, parte)}
              </span>
            </div>
            <span className="fuente-club text-[clamp(52px,8vw,104px)] leading-none tabular-nums" style={{ color: S.texto, textShadow: `0 0 30px ${p.visitante.color}` }}>
              {c.V.goles}
            </span>
          </div>
          <span className="mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em]" style={{ background: modo === "vivo" ? "rgba(255,60,90,0.16)" : "rgba(120,170,255,0.12)", color: modo === "vivo" ? "#FF6B86" : S.info, border: `1px solid ${modo === "vivo" ? "rgba(255,80,110,0.45)" : S.borde}` }}>
            {modo === "vivo" && <span className="h-1.5 w-1.5 rounded-full sala-latido" style={{ background: "#FF4D6D" }} />}
            {modo === "vivo" ? "En directo" : modo === "final" ? "Final" : "Repetición"}
          </span>
        </div>
        {equipo("V")}
      </div>

      {/* Probabilidad en vivo, en una barra. */}
      <div className="relative mt-5">
        <div className="mb-1 flex justify-between text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: S.tenue }}>
          <span>Gana {p.local.nombre}</span>
          <span>Empate</span>
          <span>Gana {p.visitante.nombre}</span>
        </div>
        <div className="flex h-7 overflow-hidden rounded-full" style={{ border: `1px solid ${S.borde}` }}>
          {(["L", "X", "V"] as const).map((k) => (
            <div
              key={k}
              className="grid place-items-center font-mono text-[12px] font-bold tabular-nums"
              style={{
                width: `${Math.max(prob[k] * 100, 0)}%`,
                minWidth: prob[k] > 0.06 ? 44 : 0,
                background: k === "X" ? "rgba(160,180,215,0.18)" : `linear-gradient(90deg, ${colorDe(p, k)}cc, ${colorDe(p, k)}88)`,
                color: S.texto,
                transition: "width .7s cubic-bezier(.2,.8,.2,1)",
                boxShadow: k === "X" ? undefined : `inset 0 0 20px ${colorDe(p, k)}55`,
              }}
            >
              {prob[k] > 0.06 ? pct(prob[k]) : ""}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  PULSO Y CARRERA DE xG                                              */
/* ------------------------------------------------------------------ */

export function Pulso({ p, t, hitos }: { p: Partido; t: number; hitos: Hito[] }) {
  const W = 1000, H = 220, mitad = H / 2;
  const tramos = useMemo(() => pulso(p, t, 3), [p, t]);
  const xg = useMemo(() => curvaXg(p, t), [p, t]);
  const fin = Math.max(DURACION, t);
  const X = (m: number) => 20 + (m / fin) * (W - 40);
  const max = Math.max(0.15, ...tramos.map((x) => Math.max(x.L, x.V)));
  const alto = (v: number) => (v / max) * (mitad - 14);
  const area = (k: Lado) => {
    const sgn = k === "L" ? -1 : 1;
    const pts = tramos.map((x) => `${X(x.desde + 1.5)},${mitad + sgn * alto(x[k])}`);
    return `M${X(0)},${mitad} L${pts.join(" L")} L${X(Math.min(t, tramos.at(-1)!.desde + 3))},${mitad} Z`;
  };
  const XH = 150;
  const maxXg = Math.max(1, ...xg.map((q) => Math.max(q.L, q.V)));
  const YX = (v: number) => XH - 12 - (v / maxXg) * (XH - 26);
  const linea = (k: Lado) => xg.map((q, i) => `${i ? "L" : "M"}${X(q.min)},${YX(q[k])}`).join(" ");
  const goles = hitos.filter((h) => h.tipo === "gol");

  return (
    <Panel titulo="Pulso del partido" detalle="Quién amenaza en cada momento (valor de cada acción de Opta, xPV, y xG de los remates, por tramos de 3′) y la carrera de goles esperados.">
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="Pulso del partido">
        <defs>
          {(["L", "V"] as Lado[]).map((k) => (
            <linearGradient key={k} id={`sala-pulso-${k}`} x1="0" x2="0" y1={k === "L" ? "0" : "1"} y2={k === "L" ? "1" : "0"}>
              <stop offset="0" stopColor={colorDe(p, k)} stopOpacity="0.95" />
              <stop offset="1" stopColor={colorDe(p, k)} stopOpacity="0.05" />
            </linearGradient>
          ))}
          <filter id="sala-brillo" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {[15, 30, 45, 60, 75, 90].map((m) => (
          <g key={m}>
            <line x1={X(m)} x2={X(m)} y1={8} y2={H - 8} stroke={m === 45 ? "rgba(170,200,255,0.35)" : S.linea} strokeDasharray={m === 45 ? "4 4" : undefined} />
            <text x={X(m)} y={H - 1} textAnchor="middle" fontSize="11" fill={S.tenue}>
              {m}′
            </text>
          </g>
        ))}
        <path d={area("L")} fill={`url(#sala-pulso-L)`} filter="url(#sala-brillo)" style={{ transition: "d .5s ease" }} />
        <path d={area("V")} fill={`url(#sala-pulso-V)`} filter="url(#sala-brillo)" style={{ transition: "d .5s ease" }} />
        <line x1={X(0)} x2={X(fin)} y1={mitad} y2={mitad} stroke="rgba(200,220,255,0.35)" />
        {goles.map((g, i) => (
          <g key={i}>
            <circle cx={X(g.min)} cy={mitad} r="7" fill={colorDe(p, g.lado)} stroke="#fff" strokeWidth="2" className="sala-pop" />
            <text x={X(g.min)} y={g.lado === "L" ? 18 : H - 16} textAnchor="middle" fontSize="12" fontWeight="700" fill={S.texto}>
              ⚽ {reloj(g.min)} {g.jugador}
            </text>
          </g>
        ))}
        <line x1={X(t)} x2={X(t)} y1={4} y2={H - 12} stroke="#fff" strokeOpacity="0.8" strokeWidth="1.5" filter="url(#sala-brillo)" />
        <text x={18} y={22} fontSize="12" fontWeight="700" fill={p.local.color}>
          ▲ {p.local.nombre}
        </text>
        <text x={18} y={H - 22} fontSize="12" fontWeight="700" fill={p.visitante.color}>
          ▼ {p.visitante.nombre}
        </text>
      </svg>
      <svg viewBox={`0 0 ${W} ${XH}`} className="mt-2 block h-auto w-full" role="img" aria-label="Carrera de goles esperados">
        {[0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4].filter((v) => v <= maxXg).map((v) => (
          <g key={v}>
            <line x1={20} x2={W - 20} y1={YX(v)} y2={YX(v)} stroke={S.linea} />
            <text x={W - 16} y={YX(v) + 4} fontSize="10" fill={S.tenue}>
              {fmt(v, 1)}
            </text>
          </g>
        ))}
        {(["L", "V"] as Lado[]).map((k) => (
          <path key={k} d={linea(k)} fill="none" stroke={colorDe(p, k)} strokeWidth="3" strokeLinejoin="round" filter="url(#sala-brillo)" />
        ))}
        {(["L", "V"] as Lado[]).map((k) => {
          const u = xg.at(-1)!;
          return (
            <text key={k} x={X(u.min) + 6} y={YX(u[k]) + 4} fontSize="13" fontWeight="800" fill={colorDe(p, k)}>
              {fmt(u[k], 2)}
            </text>
          );
        })}
        <text x={22} y={16} fontSize="11" fill={S.tenue}>
          xG acumulado
        </text>
      </svg>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/*  PROBABILIDAD EN VIVO (CURVA)                                       */
/* ------------------------------------------------------------------ */

export function Probabilidad({ p, t }: { p: Partido; t: number }) {
  const serie = useMemo(() => curvaProbabilidad(p, t, 1), [p, t]);
  const W = 600, H = 220;
  const fin = Math.max(DURACION, t);
  const X = (m: number) => 10 + (m / fin) * (W - 20);
  const Y = (v: number) => 10 + (1 - v) * (H - 30);
  const banda = (de: (q: (typeof serie)[number]) => number, a: (q: (typeof serie)[number]) => number) =>
    `M${serie.map((q) => `${X(q.min)},${Y(a(q))}`).join(" L")} L${[...serie].reverse().map((q) => `${X(q.min)},${Y(de(q))}`).join(" L")} Z`;
  const u = serie.at(-1)!;
  return (
    <Panel titulo="Probabilidad en vivo" detalle="Goles que faltan con el ritmo de xG de cada equipo: su media de la competición (la previa) mezclada con lo que lleva hoy.">
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="Probabilidad de victoria minuto a minuto">
        <path d={banda(() => 0, (q) => q.L)} fill={p.local.color} fillOpacity="0.55" />
        <path d={banda((q) => q.L, (q) => q.L + q.X)} fill="rgba(170,190,225,0.22)" />
        <path d={banda((q) => q.L + q.X, () => 1)} fill={p.visitante.color} fillOpacity="0.55" />
        {[45, 90].map((m) => (
          <line key={m} x1={X(m)} x2={X(m)} y1={8} y2={H - 18} stroke="rgba(255,255,255,0.25)" strokeDasharray="3 4" />
        ))}
        <line x1={X(t)} x2={X(t)} y1={6} y2={H - 18} stroke="#fff" strokeWidth="1.5" />
        <text x={10} y={H - 4} fontSize="11" fill={S.tenue}>
          0′
        </text>
        <text x={X(45)} y={H - 4} fontSize="11" textAnchor="middle" fill={S.tenue}>
          45′
        </text>
        <text x={X(90)} y={H - 4} fontSize="11" textAnchor="middle" fill={S.tenue}>
          90′
        </text>
      </svg>
      <div className="mt-2 grid grid-cols-3 gap-2 text-center">
        {(["L", "X", "V"] as const).map((k) => (
          <div key={k} className="rounded-xl py-2" style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${S.borde}` }}>
            <div className="font-mono text-[22px] font-bold tabular-nums" style={{ color: k === "X" ? S.texto : colorDe(p, k) }}>
              {pct(u[k])}
            </div>
            <div className="truncate px-1 text-[10px] uppercase tracking-[0.14em]" style={{ color: S.tenue }}>
              {k === "X" ? "Empate" : k === "L" ? p.local.nombre : p.visitante.nombre}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/*  EL CAMPO                                                           */
/* ------------------------------------------------------------------ */

export type Capa = "remates" | "territorio" | "redL" | "redV";

/** Coordenadas del campo (105 × 68 → 1050 × 680), el local ataca a la derecha. */
const cx = (l: Lado, x: number) => (l === "L" ? x : 100 - x) * 10.5;
const cy = (l: Lado, y: number) => (l === "L" ? 100 - y : y) * 6.8;

function Lineas() {
  const c = "rgba(140, 210, 255, 0.42)";
  return (
    <g fill="none" stroke={c} strokeWidth="2.2">
      <rect x="2" y="2" width="1046" height="676" rx="2" />
      <line x1="525" y1="2" x2="525" y2="678" />
      <circle cx="525" cy="340" r="91.5" />
      <circle cx="525" cy="340" r="3" fill={c} />
      {[0, 1].map((k) => {
        const s = k ? -1 : 1;
        const x0 = k ? 1048 : 2;
        return (
          <g key={k}>
            <rect x={k ? 1048 - 165 : 2} y={340 - 201.5} width="165" height="403" />
            <rect x={k ? 1048 - 55 : 2} y={340 - 91.5} width="55" height="183" />
            <circle cx={x0 + s * 110} cy="340" r="3" fill={c} />
            <path d={`M ${x0 + s * 165} ${340 - 73} A 91.5 91.5 0 0 ${k ? 0 : 1} ${x0 + s * 165} ${340 + 73}`} />
            <rect x={k ? 1048 : -18} y={340 - 36.6} width="20" height="73.2" stroke="rgba(255,255,255,0.6)" />
          </g>
        );
      })}
    </g>
  );
}

export function Campo({ p, t, tiros, capa, setCapa }: { p: Partido; t: number; tiros: Tiro[]; capa: Capa; setCapa: (c: Capa) => void }) {
  const [solo15, setSolo15] = useState(false);
  const ultimo = tiros.at(-1);
  const territorios = useMemo(() => {
    if (capa !== "territorio") return null;
    const desde = solo15 ? Math.max(0, t - 15) : 0;
    return { L: territorio(p, "L", t, desde), V: territorio(p, "V", t, desde) };
  }, [p, t, capa, solo15]);
  const redes = useMemo(() => (capa === "redL" || capa === "redV" ? red(p, capa === "redL" ? "L" : "V", t) : null), [p, t, capa]);

  const opciones: { k: Capa; t: string }[] = [
    { k: "remates", t: "Remates" },
    { k: "territorio", t: "Territorio" },
    { k: "redL", t: `Red · ${p.local.nombre}` },
    { k: "redV", t: `Red · ${p.visitante.nombre}` },
  ];

  return (
    <Panel
      titulo="El campo"
      detalle={capa === "remates" ? "Cada remate en su sitio: el tamaño es su xG; con aro blanco, gol. El último, con onda." : capa === "territorio" ? "Quién domina cada zona: el color del que más toca ahí, más intenso cuanto más." : "Posición media de los titulares y los pases entre ellos (3 o más)."}
      derecha={
        <div className="flex flex-wrap justify-end gap-1">
          {opciones.map((o) => (
            <button
              key={o.k}
              type="button"
              onClick={() => setCapa(o.k)}
              aria-pressed={capa === o.k}
              className="max-w-[11rem] truncate rounded-full px-2.5 py-1 text-[11px] font-semibold transition"
              style={{ background: capa === o.k ? "rgba(120,190,255,0.2)" : "rgba(255,255,255,0.04)", color: capa === o.k ? S.texto : S.suave, border: `1px solid ${capa === o.k ? "rgba(120,190,255,0.6)" : S.borde}` }}
            >
              {o.t}
            </button>
          ))}
          {capa === "territorio" && (
            <button type="button" onClick={() => setSolo15((v) => !v)} aria-pressed={solo15} className="rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: solo15 ? "rgba(233,196,106,0.18)" : "rgba(255,255,255,0.04)", color: solo15 ? S.oro : S.suave, border: `1px solid ${solo15 ? "rgba(233,196,106,0.6)" : S.borde}` }}>
              Últimos 15′
            </button>
          )}
        </div>
      }
    >
      <div className="relative mx-auto max-w-[1100px]" style={{ perspective: "1600px" }}>
        <div style={{ transform: "rotateX(24deg) scale(0.96)", transformOrigin: "50% 100%", transition: "transform .6s ease" }}>
          <svg viewBox="-24 -8 1098 696" className="block h-auto w-full" role="img" aria-label="Campo con los remates, el territorio o la red de pases">
            <defs>
              <linearGradient id="sala-cesped" x1="0" x2="1">
                <stop offset="0" stopColor="#06231A" />
                <stop offset="0.5" stopColor="#0A2E22" />
                <stop offset="1" stopColor="#06231A" />
              </linearGradient>
              <filter id="sala-luz" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="6" result="b" />
                <feMerge>
                  <feMergeNode in="b" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <rect x="0" y="0" width="1050" height="680" fill="url(#sala-cesped)" />
            {Array.from({ length: 10 }, (_, i) => (
              <rect key={i} x={i * 105} y="0" width="105" height="680" fill={i % 2 ? "rgba(255,255,255,0.018)" : "transparent"} />
            ))}

            {territorios &&
              Array.from({ length: territorios.L.W * territorios.L.H }, (_, i) => {
                const W = territorios.L.W, H = territorios.L.H;
                const col = i % W, fila = Math.floor(i / W);
                /* La celda en coordenadas del campo: el local la ve en (col, fila); el visitante, dada la vuelta. */
                const l = territorios.L.malla[(H - 1 - fila) * W + col];
                const v = territorios.V.malla[fila * W + (W - 1 - col)];
                const total = l + v;
                if (!total) return null;
                const maxT = Math.max(...territorios.L.malla.map((q, k) => q + territorios.V.malla[k] || q), 1);
                const domina = l >= v ? "L" : "V";
                const fuerza = Math.abs(l - v) / total;
                return (
                  <rect key={i} x={(col * 1050) / W + 2} y={(fila * 680) / H + 2} width={1050 / W - 4} height={680 / H - 4} rx="6" fill={colorDe(p, domina)} fillOpacity={0.08 + 0.55 * fuerza * Math.min(1, (total / maxT) * 1.6)} />
                );
              })}

            <Lineas />

            {capa === "remates" &&
              tiros.map((s, i) => {
                const r = 6 + Math.sqrt(Math.max(0.01, s.xG)) * 34;
                const esUltimo = s === ultimo;
                return (
                  <g key={i} filter={s.gol ? "url(#sala-luz)" : undefined}>
                    {esUltimo && <circle cx={cx(s.lado, s.x)} cy={cy(s.lado, s.y)} r={r} fill="none" stroke={colorDe(p, s.lado)} strokeWidth="3" className="sala-onda" />}
                    <circle cx={cx(s.lado, s.x)} cy={cy(s.lado, s.y)} r={r} fill={colorDe(p, s.lado)} fillOpacity={s.gol ? 0.95 : s.aPuerta ? 0.6 : 0.3} stroke={s.gol ? "#fff" : colorDe(p, s.lado)} strokeWidth={s.gol ? 4 : 1.5} className="sala-pop">
                      <title>{`${reloj(s.min)} · ${p.jugadores.get(s.jugador)?.corto ?? ""} · xG ${fmt(s.xG, 2)}${s.gol ? " · GOL" : s.aPuerta ? " · a puerta" : ""}`}</title>
                    </circle>
                  </g>
                );
              })}

            {redes &&
              (() => {
                const l: Lado = capa === "redL" ? "L" : "V";
                const pos = new Map(redes.nodos.map((n) => [n.id, n]));
                const maxN = Math.max(1, ...redes.enlaces.map((e) => e.n));
                const maxT = Math.max(1, ...redes.nodos.map((n) => n.toques));
                return (
                  <g>
                    {redes.enlaces.map((e, i) => {
                      const a = pos.get(e.a)!, b = pos.get(e.b)!;
                      return <line key={i} x1={cx(l, a.x)} y1={cy(l, a.y)} x2={cx(l, b.x)} y2={cy(l, b.y)} stroke={colorDe(p, l)} strokeOpacity={0.25 + 0.6 * (e.n / maxN)} strokeWidth={1 + 9 * (e.n / maxN)} strokeLinecap="round" />;
                    })}
                    {redes.nodos.map((n) => (
                      <g key={n.id} filter="url(#sala-luz)">
                        <circle cx={cx(l, n.x)} cy={cy(l, n.y)} r={14 + 14 * (n.toques / maxT)} fill="#061424" stroke={colorDe(p, l)} strokeWidth="3.5" />
                        <text x={cx(l, n.x)} y={cy(l, n.y) + 6} textAnchor="middle" fontSize="17" fontWeight="800" fill="#fff">
                          {n.dorsal || "·"}
                        </text>
                        <text x={cx(l, n.x)} y={cy(l, n.y) + 46} textAnchor="middle" fontSize="15" fontWeight="600" fill="rgba(235,245,255,0.9)" paintOrder="stroke" stroke="#04131c" strokeWidth="4">
                          {n.corto}
                        </text>
                      </g>
                    ))}
                  </g>
                );
              })()}

            <text x="20" y="-10" fontSize="16" fontWeight="700" fill={p.visitante.color}>
              ← {p.visitante.nombre} ataca
            </text>
            <text x="1030" y="-10" fontSize="16" fontWeight="700" textAnchor="end" fill={p.local.color}>
              {p.local.nombre} ataca →
            </text>
          </svg>
        </div>
      </div>
      {capa === "remates" && ultimo && (
        <p className="mt-2 text-center text-[12px]" style={{ color: S.suave }}>
          Último remate: <b style={{ color: colorDe(p, ultimo.lado) }}>{p.jugadores.get(ultimo.jugador)?.corto ?? "—"}</b> · {reloj(ultimo.min)} · xG {fmt(ultimo.xG, 2)}
          {ultimo.gol ? " · GOL" : ultimo.aPuerta ? " · a puerta" : ""} {enArea(ultimo.x, ultimo.y) ? "· desde el área" : "· desde fuera"}
        </p>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/*  ALERTAS                                                            */
/* ------------------------------------------------------------------ */

export function Alertas({ lista, p }: { lista: Alerta[]; p: Partido }) {
  return (
    <Panel titulo="Lo que está pasando" detalle={p.nuestro ? "Verde, bueno para nosotros; naranja, a vigilar. Se recalcula a cada minuto." : "Lo que se sale de lo normal en el partido."}>
      {!lista.length && (
        <p className="py-6 text-center text-[13px]" style={{ color: S.tenue }}>
          Nada fuera de lo normal todavía.
        </p>
      )}
      <ul className="grid gap-2">
        {lista.map((a) => {
          const color = a.tono === "favor" ? S.favor : a.tono === "aviso" ? S.aviso : S.info;
          const Icono = a.tono === "aviso" ? AlertTriangle : a.fuerza > 2.5 ? Flame : Zap;
          return (
            <li key={a.clave} className="flex min-w-0 gap-3 rounded-xl p-3 sala-entra" style={{ background: `linear-gradient(90deg, ${color}1f, rgba(255,255,255,0.02))`, border: `1px solid ${color}55` }}>
              <Icono size={18} style={{ color }} className="mt-0.5 shrink-0" aria-hidden />
              <div className="min-w-0">
                <p className="text-[13px] font-semibold" style={{ color: S.texto }}>
                  {a.titulo}
                </p>
                <p className="text-[12px]" style={{ color: S.suave }}>
                  {a.texto}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/*  DUELO DE CIFRAS CONTRA LA PREVIA                                   */
/* ------------------------------------------------------------------ */

type FilaDuelo = { nombre: string; L: number | null; V: number | null; d: number; previa?: string; porMinuto?: boolean; menosEsMejor?: boolean; formato?: (v: number) => string };

export function Duelo({ p, t, c }: { p: Partido; t: number; c: { L: Cifras; V: Cifras } }) {
  const pos = posesion(c);
  const filas: FilaDuelo[] = [
    { nombre: "Goles esperados (xG)", L: c.L.xg, V: c.V.xg, d: 2, previa: "ExpG", porMinuto: true },
    { nombre: "Remates", L: c.L.tiros, V: c.V.tiros, d: 0, previa: "ShtIncBl", porMinuto: true },
    { nombre: "A puerta", L: c.L.aPuerta, V: c.V.aPuerta, d: 0, previa: "SOG", porMinuto: true },
    { nombre: "Posesión (por pases)", L: pos.L, V: pos.V, d: 0, previa: "Poss%", formato: (v) => pct(v) },
    { nombre: "Acierto en el pase", L: c.L.pases ? c.L.pasesOk / c.L.pases : null, V: c.V.pases ? c.V.pasesOk / c.V.pases : null, d: 0, previa: "Pass%", formato: (v) => pct(v) },
    { nombre: "Toques en el área", L: c.L.toquesArea, V: c.V.toquesArea, d: 0, previa: "TouchOpBox", porMinuto: true },
    { nombre: "PPDA (presión)", L: ppda(c.L), V: ppda(c.V), d: 1, previa: "PPDA", menosEsMejor: true },
    { nombre: "Recuperaciones en campo rival", L: c.L.recAltas, V: c.V.recAltas, d: 0 },
    { nombre: "Pérdidas", L: c.L.perdidas, V: c.V.perdidas, d: 0, menosEsMejor: true },
  ];
  const hayPrevia = !!(p.local.previa || p.visitante.previa);
  return (
    <Panel titulo="Cara a cara" detalle={hayPrevia ? "La raya blanca es lo que suele llevar cada uno a estas alturas (su media de la competición, sin este partido)." : "Las cifras del partido hasta este minuto."}>
      <ul className="grid gap-2.5">
        {filas.map((f) => {
          const a = f.L ?? 0, b = f.V ?? 0;
          const total = f.menosEsMejor ? (a && b ? 1 / a + 1 / b : 1) : a + b || 1;
          const parteL = f.menosEsMejor ? (a && b ? 1 / a / total : 0.5) : a / total;
          const ref = (l: Lado) => {
            const e = l === "L" ? p.local : p.visitante;
            const m = f.previa ? e.previa?.medias[f.previa] : undefined;
            if (m == null) return null;
            return f.porMinuto ? (m * Math.min(t, 90)) / 90 : m;
          };
          const maxEscala = Math.max(a, b, ref("L") ?? 0, ref("V") ?? 0, 0.0001) * 1.1;
          const ancho = (v: number | null) => (v == null ? 0 : Math.min(100, (v / maxEscala) * 100));
          const muestra = (v: number | null) => (v == null ? "—" : f.formato ? f.formato(v) : fmt(v, f.d));
          const gana = f.L == null || f.V == null ? null : f.menosEsMejor ? (a < b ? "L" : b < a ? "V" : null) : a > b ? "L" : b > a ? "V" : null;
          return (
            <li key={f.nombre} className="grid grid-cols-[3.5rem_minmax(0,1fr)_minmax(0,1fr)_3.5rem] items-center gap-2">
              <span className="text-right font-mono text-[14px] font-bold tabular-nums" style={{ color: gana === "L" ? p.local.color : S.texto }}>
                {muestra(f.L)}
              </span>
              <div className="relative h-2.5 overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.05)" }}>
                <div className="absolute inset-y-0 right-0 rounded-full" style={{ width: `${f.formato ? (f.L ?? 0) * 100 : ancho(f.L)}%`, background: `linear-gradient(270deg, ${p.local.color}, ${p.local.color}55)`, boxShadow: `0 0 12px ${p.local.color}88`, transition: "width .6s ease" }} />
                {ref("L") != null && <div className="absolute inset-y-[-3px] w-[2px] rounded" style={{ right: `${f.formato ? (ref("L") ?? 0) * 100 : ancho(ref("L"))}%`, background: "#fff", boxShadow: "0 0 6px #fff" }} title={`Su media: ${muestra(ref("L"))}`} />}
              </div>
              <div className="relative h-2.5 overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.05)" }}>
                <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${f.formato ? (f.V ?? 0) * 100 : ancho(f.V)}%`, background: `linear-gradient(90deg, ${p.visitante.color}, ${p.visitante.color}55)`, boxShadow: `0 0 12px ${p.visitante.color}88`, transition: "width .6s ease" }} />
                {ref("V") != null && <div className="absolute inset-y-[-3px] w-[2px] rounded" style={{ left: `${f.formato ? (ref("V") ?? 0) * 100 : ancho(ref("V"))}%`, background: "#fff", boxShadow: "0 0 6px #fff" }} title={`Su media: ${muestra(ref("V"))}`} />}
              </div>
              <span className="font-mono text-[14px] font-bold tabular-nums" style={{ color: gana === "V" ? p.visitante.color : S.texto }}>
                {muestra(f.V)}
              </span>
              <span className="col-span-4 -mt-1.5 text-center text-[10.5px] uppercase tracking-[0.14em]" style={{ color: S.tenue }}>
                {f.nombre}
                {parteL > 0.62 && !f.formato ? ` · ${p.local.nombre}` : parteL < 0.38 && !f.formato ? ` · ${p.visitante.nombre}` : ""}
              </span>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/*  JUGADORES EN LLAMAS                                                */
/* ------------------------------------------------------------------ */

export function Destacados({ p, lista }: { p: Partido; lista: Destacado[] }) {
  const max = Math.max(0.01, ...lista.map((d) => d.nota));
  return (
    <Panel titulo="Quién está marcando el partido" detalle="Amenaza generada (xPV de Opta de cada acción), xG y recuperaciones de cada jugador hasta este minuto.">
      <ol className="grid gap-2">
        {lista.map((d, i) => {
          const color = colorDe(p, d.jugador.lado);
          return (
            <li key={d.jugador.id} className="grid grid-cols-[2.2rem_minmax(0,1fr)_auto] items-center gap-3 rounded-xl px-2.5 py-2 sala-entra" style={{ background: i === 0 ? `linear-gradient(90deg, ${color}26, transparent)` : "rgba(255,255,255,0.02)", border: `1px solid ${i === 0 ? `${color}66` : S.borde}` }}>
              <span className="grid h-9 w-9 place-items-center rounded-full font-mono text-[13px] font-bold" style={{ background: "#061424", border: `2px solid ${color}`, color: S.texto, boxShadow: `0 0 14px ${color}66` }}>
                {d.jugador.dorsal || i + 1}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[13.5px] font-semibold" style={{ color: S.texto }}>
                  {d.jugador.corto}
                  {d.goles > 0 && <span className="ml-1.5">{"⚽".repeat(Math.min(3, d.goles))}</span>}
                </span>
                <span className="mt-1 block h-1.5 overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
                  <span className="block h-full rounded-full" style={{ width: `${(d.nota / max) * 100}%`, background: `linear-gradient(90deg, ${color}66, ${color})`, transition: "width .6s ease" }} />
                </span>
              </span>
              <span className="text-right font-mono text-[11px] tabular-nums" style={{ color: S.suave }}>
                <b style={{ color: S.texto }}>{fmt(d.amenaza, 2)}</b> amenaza
                <br />
                xG {fmt(d.xg, 2)} · {d.recuperaciones} rec.
              </span>
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/*  BARRA DE REPETICIÓN                                                */
/* ------------------------------------------------------------------ */

export function Linea({ p, t, max, hitos, onCambia }: { p: Partido; t: number; max: number; hitos: Hito[]; onCambia: (m: number) => void }) {
  const goles = hitos.filter((h) => h.tipo === "gol");
  const tiros = hitos.filter((h) => h.tipo !== "corner" && h.tipo !== "gol");
  return (
    <div className="relative h-10 w-full">
      <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full" style={{ background: "rgba(255,255,255,0.08)" }} />
      <div className="absolute left-0 top-1/2 h-1 -translate-y-1/2 rounded-full" style={{ width: `${(t / max) * 100}%`, background: `linear-gradient(90deg, ${p.local.color}, ${p.visitante.color})` }} />
      {tiros.map((h, i) => (
        <span key={i} aria-hidden className="absolute h-2 w-[2px] rounded" style={{ left: `${(h.min / max) * 100}%`, top: h.lado === "L" ? 6 : 26, background: colorDe(p, h.lado), opacity: h.tipo === "parada" ? 0.9 : 0.45 }} />
      ))}
      {goles.map((h, i) => (
        <span key={i} aria-hidden className="absolute -translate-x-1/2 text-[13px] leading-none" style={{ left: `${(h.min / max) * 100}%`, top: h.lado === "L" ? -4 : 26 }}>
          ⚽
        </span>
      ))}
      <input type="range" min={0} max={max} step={0.25} value={t} onChange={(e) => onCambia(Number(e.target.value))} aria-label="Minuto del partido" className="absolute inset-0 w-full cursor-pointer opacity-0" />
      <span aria-hidden className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: `${(t / max) * 100}%`, background: "#fff", boxShadow: "0 0 14px rgba(160,210,255,0.9)" }} />
    </div>
  );
}
