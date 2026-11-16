"use client";

/**
 * EL PARTIDO EN RELIEVE SOBRE UN SUELO ANCHO (16/11/2026, petición del analista:
 * «al visionado con relieve que te pasé de X se le veía como un suelo ancho que
 * lo hacía más visual»). Vuelve el relieve de la idea de Alexander Bogachev, ya
 * con el suelo del original: una explanada ancha en perspectiva de verdad (la
 * orilla de delante ocupa todo el ancho y la del fondo se estrecha hacia el
 * horizonte), el minuto de izquierda a derecha, el ancho del campo hacia el
 * fondo y la presión de ataque en altura. Cada pico es un remate de verdad
 * (alto por su xG) y el gol lleva su bola y su rótulo.
 *
 * Los datos y la regla de las alturas son los de `lib/opta-relieve.ts` (con más
 * franjas a lo ancho para que el relieve salga suave). Es un escenario oscuro
 * en los dos temas (`siempre-oscuro`), como el retrato 3D.
 */

import { useMemo } from "react";

import type { EventoDirecto, JugadorDirecto } from "@/lib/opta-directo-mapas";
import { relieve } from "@/lib/opta-relieve";

type RGB = [number, number, number];
type Equipo = { teamId: string; nombre: string };

const FRANJAS = 17;
const W = 1000;
const H = 540;
/* Lo de arriba del todo es cielo vacío: el dibujo empieza en ARRIBA. */
const ARRIBA = 140;
/* La cámara: delante de la orilla y algo alta. */
const DIST = 2.2; // distancia a la orilla de delante
const FONDO = 2.1; // profundidad del suelo
const CAM_ALTO = 1.4;
const FX = 480 * DIST; // la orilla de delante ocupa 2 × 480 px
const FY = 560;
const HORIZONTE = 112;
const ALTO_PICO = 0.62;

const coma = (v: number, d = 2) => v.toFixed(d).replace(".", ",");
const rgb = (c: RGB, a = 1) => `rgba(${c.map((v) => Math.round(Math.max(0, Math.min(255, v)))).join(",")},${a})`;
const SUELO: RGB = [24, 44, 34];

function proyecta(xw: number, alto: number, z: number): [number, number] {
  const q = DIST + z;
  return [W / 2 + (xw * FX) / q, HORIZONTE + ((CAM_ALTO - alto * ALTO_PICO) * FY) / q];
}

/** Nombre corto: «Real Madrid Castilla» → «Castilla». */
const corto = (n: string) => (/castilla/i.test(n) ? "Castilla" : n.split(" ").filter((x) => x.length > 3).slice(-1)[0] ?? n);

export function RelieveSuelo({
  ev,
  a,
  b,
  colA,
  colB,
  jugadores,
}: {
  ev: EventoDirecto[];
  a: Equipo;
  b: Equipo;
  colA: RGB;
  colB: RGB;
  jugadores?: Map<string, JugadorDirecto>;
}) {
  const r = useMemo(() => relieve(ev, a.teamId, b.teamId, FRANJAS), [ev, a.teamId, b.teamId]);
  const n = r.carriles;
  const fin = r.minutos - 1;
  const X = (t: number) => (t / Math.max(1, fin)) * 2 - 1;
  const Z = (c: number) => (c / (n - 1)) * FONDO;
  const P = (t: number, c: number, h: number) => proyecta(X(t), h, Z(c));

  /* Las caras, del fondo hacia delante (el pintor tapa lo de atrás). */
  const caras = useMemo(() => {
    const l: { d: string; fill: string }[] = [];
    for (let c = n - 2; c >= 0; c--)
      for (let t = 0; t < fin; t++) {
        const h = [r.altura[t][c], r.altura[t + 1][c], r.altura[t + 1][c + 1], r.altura[t][c + 1]];
        const pts = [P(t, c, h[0]), P(t + 1, c, h[1]), P(t + 1, c + 1, h[2]), P(t, c + 1, h[3])];
        const hm = (h[0] + h[1] + h[2] + h[3]) / 4;
        const p = (r.parteA[t][c] + r.parteA[t + 1][c] + r.parteA[t][c + 1] + r.parteA[t + 1][c + 1]) / 4;
        /* Luz de la izquierda y de frente: lo que sube hacia la derecha o hacia el fondo, más oscuro. */
        const pend = h[1] + h[2] - h[0] - h[3];
        const frente = h[0] + h[1] - h[2] - h[3];
        const luz = Math.max(0.45, Math.min(1.35, 0.95 - pend * 1.6 + frente * 1.1 + hm * 0.35));
        const equipo = colA.map((v, i) => v * p + colB[i] * (1 - p)) as RGB;
        const k = Math.min(1, Math.max(0, (hm - 0.03) / 0.3));
        const base = SUELO.map((v, i) => (v * (1 - k) + equipo[i] * k) * luz) as RGB;
        const niebla = (c / (n - 1)) * 0.35;
        const col = base.map((v) => v * (1 - niebla) + 14 * niebla) as RGB;
        l.push({ d: `M${pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join("L")}Z`, fill: rgb(col) });
      }
    return l;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r, colA, colB]);

  /* La conclusión: el tramo de 15′ en que más empujó cada uno (su loma más su pico). */
  const lectura = useMemo(() => {
    const tramos = Math.ceil(fin / 15);
    const empuje = (deA: boolean) => {
      const suma = new Array(tramos).fill(0);
      for (let t = 0; t <= fin; t++)
        for (let c = 0; c < n; c++) {
          const parte = deA ? r.parteA[t][c] : 1 - r.parteA[t][c];
          suma[Math.min(tramos - 1, Math.floor(t / 15))] += r.altura[t][c] * parte;
        }
      const i = suma.indexOf(Math.max(...suma));
      return { desde: i * 15, hasta: Math.min(fin, (i + 1) * 15), total: suma.reduce((x, y) => x + y, 0) };
    };
    return { a: empuje(true), b: empuje(false) };
  }, [r, fin, n]);

  const golesA = r.picos.filter((p) => p.gol && p.deA);
  const golesB = r.picos.filter((p) => p.gol && !p.deA);
  const xgA = r.picos.filter((p) => p.deA).reduce((x, p) => x + p.xg, 0);
  const xgB = r.picos.filter((p) => !p.deA).reduce((x, p) => x + p.xg, 0);
  const nombre = (id: string) => jugadores?.get(id)?.nombre ?? "";
  const ventaja = lectura.a.total + lectura.b.total > 0 ? lectura.a.total / (lectura.a.total + lectura.b.total) : 0.5;
  const titular =
    ventaja >= 0.58
      ? `${a.nombre} empujó más: su relieve es el ${Math.round(ventaja * 100)} % del partido`
      : ventaja <= 0.42
        ? `${b.nombre} empujó más: su relieve es el ${Math.round((1 - ventaja) * 100)} % del partido`
        : Math.abs(xgA - xgB) >= 0.3
          ? `Empuje repartido, pero las ocasiones fueron de ${xgA > xgB ? a.nombre : b.nombre}`
          : "Partido repartido: los dos levantaron un relieve parecido";

  if (ev.length < 20 || r.minutos < 10) return null;

  /* La orilla de delante y la del fondo, para el suelo y las marcas. */
  const esquinas = [P(0, 0, 0), P(fin, 0, 0), P(fin, n - 1, 0), P(0, n - 1, 0)];
  const marcas = [0, 15, 30, 45, 60, 75, 90].filter((m) => m <= fin);
  const altoDe = (p: { minuto: number; carril: number }) => r.altura[Math.min(fin, p.minuto)]?.[p.carril] ?? 0;
  const destacados = r.picos.filter((p) => p.gol || p.xg >= 0.3);

  return (
    <figure className="siempre-oscuro m-0 overflow-hidden rounded-2xl" style={{ background: "#05070c" }}>
      <figcaption className="px-4 pt-4 sm:px-6 sm:pt-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/55">El partido en relieve · Opta, evento a evento</p>
        <p className="mt-1 text-lg font-bold leading-snug text-white sm:text-2xl">{titular}</p>
        <p className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm tabular-nums text-white/75">
          <span>
            <b style={{ color: rgb(colA) }}>{a.nombre}</b> {golesA.length} – {golesB.length} <b style={{ color: rgb(colB) }}>{b.nombre}</b>
          </span>
          <span>
            xG <b style={{ color: rgb(colA) }}>{coma(xgA)}</b> – <b style={{ color: rgb(colB) }}>{coma(xgB)}</b>
          </span>
          <span className="text-white/60">
            Mejor tramo: {corto(a.nombre)} {lectura.a.desde}′–{lectura.a.hasta}′ · {corto(b.nombre)} {lectura.b.desde}′–{lectura.b.hasta}′
          </span>
        </p>
      </figcaption>
      <svg viewBox={`0 ${ARRIBA} ${W} ${H - ARRIBA}`} className="block w-full" style={{ fontFamily: "var(--font-barlow, 'Barlow Condensed'), sans-serif" }} role="img" aria-label={`El partido en relieve: ${a.nombre} ${golesA.length}-${golesB.length} ${b.nombre}. ${titular}.`}>
        <defs>
          <linearGradient id="relieve-cielo" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#0b1222" />
            <stop offset="0.45" stopColor="#070a12" />
            <stop offset="1" stopColor="#05070c" />
          </linearGradient>
          <linearGradient id="relieve-suelo" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#0e1a15" />
            <stop offset="1" stopColor="#1a3226" />
          </linearGradient>
          <radialGradient id="relieve-luz" cx="0.5" cy="0.25" r="0.7">
            <stop offset="0" stopColor="rgba(200,169,107,0.18)" />
            <stop offset="1" stopColor="rgba(200,169,107,0)" />
          </radialGradient>
        </defs>
        <rect x={0} y={0} width={W} height={H} style={{ fill: "url(#relieve-cielo)" }} />
        <rect x={0} y={0} width={W} height={H * 0.6} style={{ fill: "url(#relieve-luz)" }} />
        {/* El suelo ancho, con su línea de horizonte. */}
        <path d={`M${esquinas.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join("L")}Z`} style={{ fill: "url(#relieve-suelo)" }} />
        {/* Las rayas del suelo: cada 15′ hacia el fondo y las tres franjas del campo a lo largo. */}
        {marcas.map((m) => {
          const [x1, y1] = P(m, 0, 0);
          const [x2, y2] = P(m, n - 1, 0);
          return <line key={`m${m}`} x1={x1} y1={y1} x2={x2} y2={y2} style={{ stroke: m === 45 ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.1)", strokeDasharray: m === 45 ? "6 6" : undefined }} />;
        })}
        {[1 / 3, 2 / 3].map((f) => {
          const c = f * (n - 1);
          const [x1, y1] = P(0, c, 0);
          const [x2, y2] = P(fin, c, 0);
          return <line key={`c${f}`} x1={x1} y1={y1} x2={x2} y2={y2} style={{ stroke: "rgba(255,255,255,0.08)" }} />;
        })}
        {caras.map((q, i) => (
          <path key={i} d={q.d} style={{ fill: q.fill, stroke: "rgba(0,0,0,0.22)", strokeWidth: 0.4 }} />
        ))}
        {/* La orilla de delante: los minutos, grandes para que se lean en el móvil. */}
        {marcas.map((m) => {
          const [x, y] = P(m, 0, 0);
          return (
            <text key={`t${m}`} x={x} y={y + 30} textAnchor="middle" style={{ fill: "rgba(255,255,255,0.7)", fontSize: 22, fontWeight: 700 }}>
              {m === 45 ? "Descanso" : `${m}′`}
            </text>
          );
        })}
        {/* A lo ancho: dónde está cada banda (vista desde el que ataca hacia la derecha). */}
        {(() => {
          const [xd] = P(0, 0, 0);
          const [xf, yf] = P(0, n - 1, 0);
          return (
            <g style={{ fill: "rgba(255,255,255,0.5)", fontSize: 16 }}>
              <text x={xf - 10} y={yf + 5} textAnchor="end">
                Fondo: banda izq. {corto(a.nombre)}
              </text>
              <text x={xd} y={H - 8}>
                Delante: banda dcha. {corto(a.nombre)}
              </text>
            </g>
          );
        })()}
        {/* Los remates que cuentan: el gol con su bola y su rótulo; la ocasión clara, con su xG. */}
        {r.picos.map((p, i) => {
          const [x, y] = P(p.minuto, p.carril, altoDe(p));
          return (
            <circle key={`p${i}`} cx={x} cy={y} r={p.gol ? 9 : 6} style={{ fill: p.gol ? "#FFFFFF" : "rgba(255,255,255,0)", stroke: p.gol ? rgb(p.deA ? colA : colB) : "transparent", strokeWidth: 4 }}>
              <title>{`${p.minuto}′ ${p.gol ? "gol" : "remate"} de ${p.deA ? a.nombre : b.nombre}${nombre(p.jugadorId) ? ` (${nombre(p.jugadorId)})` : ""} · xG ${coma(p.xg)}`}</title>
            </circle>
          );
        })}
        {destacados.map((p, i) => {
          const [x, y] = P(p.minuto, p.carril, altoDe(p));
          const arriba = Math.max(ARRIBA + 24, y - (p.gol ? 70 : 44));
          const quien = nombre(p.jugadorId);
          const texto = p.gol ? `GOL ${p.minuto}′${quien ? ` · ${quien.split(" ").slice(-1)[0]}` : ""}` : `${p.minuto}′ · xG ${coma(p.xg)}`;
          const izq = x > W - 180;
          return (
            <g key={`d${i}`}>
              <line x1={x} y1={y - (p.gol ? 10 : 7)} x2={x} y2={arriba + 6} style={{ stroke: rgb(p.deA ? colA : colB, p.gol ? 0.9 : 0.55), strokeWidth: p.gol ? 2 : 1.2 }} />
              <text x={x + (izq ? -6 : 6)} y={arriba} textAnchor={izq ? "end" : "start"} style={{ fill: p.gol ? "#FFFFFF" : rgb(p.deA ? colA : colB), fontSize: p.gol ? 22 : 17, fontWeight: 800 }}>
                {texto}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 px-4 pb-4 text-xs text-white/65 sm:px-6">
        <span className="inline-flex items-center gap-1.5">
          <i className="inline-block h-2.5 w-5 rounded-sm" style={{ background: rgb(colA) }} />
          {a.nombre}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="inline-block h-2.5 w-5 rounded-sm" style={{ background: rgb(colB) }} />
          {b.nombre}
        </span>
        <span>De izquierda a derecha, el minuto; hacia el fondo, el ancho del campo; en altura, su presión en el último 40 % del campo. Cada pico es un remate (más alto, más xG).</span>
      </div>
    </figure>
  );
}
