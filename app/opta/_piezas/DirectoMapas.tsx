"use client";

/**
 * LOS MAPAS DEL DIRECTO (14/11/2026, petición del analista: «más visual»).
 *
 * Debajo del marcador y del plan, con el evento a evento de
 * `opta:directo:<partido>` (`eventos`, `jugadores`; los cálculos en
 * `lib/opta-directo-mapas.ts`):
 *
 * 1. Territorio y mapa de calor de cada equipo (los dos atacando a la derecha).
 * 2. Red de pases de cada equipo (dorsal, tamaño = pases, línea = pases
 *    completados entre los dos).
 * 3. Remates de los dos en un campo (tamaño = xG) y la curva de xG por minuto.
 * 4. Robos y pérdidas de cada equipo, con su altura.
 * 5. Rendimiento individual: los destacados y la tabla; al pinchar un jugador,
 *    su ficha (su calor, sus pases y sus acciones).
 *
 * Todo con un tramo: el partido, cada parte o los últimos 15 minutos. El
 * equipo de la izquierda (`a`) es el de las tarjetas del directo.
 */

import { useMemo, useState } from "react";

import { CampoOpta, SOBRE_CESPED, type Proyecta } from "@/components/campo/CampoOpta";
import { ORO, tinta } from "@/components/data/graficas";
import { CASTILLA_OPTA, type TablaOpta } from "@/lib/opta";
import {
  MX,
  MY,
  alUltimoTercio,
  curvaXg,
  densidad,
  esToque,
  filtraTramo,
  leeEventos,
  leeJugadores,
  pierde,
  porTercios,
  progresa,
  recupera,
  redPases,
  rendimientos,
  robosYPerdidas,
  territorio,
  tiros as tirosDe,
  type EventoDirecto,
  type JugadorDirecto,
  type Rendimiento,
  type Tramo,
} from "@/lib/opta-directo-mapas";

import { Botonera } from "./comun";

type Equipo = { teamId: string; nombre: string };

const TRAMOS: { clave: Tramo; nombre: string }[] = [
  { clave: "todo", nombre: "Partido" },
  { clave: "1", nombre: "1.ª parte" },
  { clave: "2", nombre: "2.ª parte" },
  { clave: "ultimos15", nombre: "Últimos 15′" },
];

/* Sobre el césped: el de la izquierda en oro (o el Castilla), el otro en rojo claro. */
const COLOR_A = SOBRE_CESPED.nuestro;
const COLOR_B = SOBRE_CESPED.rival;

const pct = (v: number | null | undefined) => (v == null ? "–" : `${Math.round(v * 100)} %`);
const dec = (v: number, n = 2) => v.toFixed(n).replace(".", ",");

const PUESTO: Record<string, string> = { Goalkeeper: "portero", Defender: "defensa", Midfielder: "centrocampista", Attacker: "delantero", Forward: "delantero", Substitute: "suplente" };
const puesto = (p: string) => PUESTO[p] ?? p.toLowerCase();

const apellido = (n: string) => {
  const p = n.trim().split(/\s+/);
  return p.length > 1 ? p.slice(1).join(" ") : n;
};

/* ------------------------------ calor ------------------------------ */

/** La densidad como imagen (una celda = un píxel; el navegador la suaviza al estirarla). */
function imagenCalor(malla: number[], max: number, rgb: string): string {
  if (typeof document === "undefined" || max <= 0) return "";
  const lienzo = document.createElement("canvas");
  lienzo.width = MX;
  lienzo.height = MY;
  const c = lienzo.getContext("2d");
  if (!c) return "";
  const img = c.createImageData(MX, MY);
  const [r, g, b] = rgb.split(",").map(Number);
  for (let j = 0; j < MY; j++)
    for (let i = 0; i < MX; i++) {
      /* La fila de arriba de la imagen es y = 100 (la banda izquierda del que ataca, arriba). */
      const v = malla[(MY - 1 - j) * MX + i] / max;
      const o = (j * MX + i) * 4;
      img.data[o] = r;
      img.data[o + 1] = g;
      img.data[o + 2] = b;
      img.data[o + 3] = Math.round(Math.min(1, Math.pow(v, 1.15)) * 235);
    }
  c.putImageData(img, 0, 0);
  return lienzo.toDataURL();
}

function Calor({ ev, rgb, etiqueta, maxAlto = 300 }: { ev: EventoDirecto[]; rgb: string; etiqueta: string; maxAlto?: number }) {
  const { malla, max, toques } = useMemo(() => densidad(ev), [ev]);
  const href = useMemo(() => imagenCalor(malla, max, rgb), [malla, max, rgb]);
  return (
    <CampoOpta ariaLabel={etiqueta} maxAlto={maxAlto}>
      {(p) => {
        const [ax, ay] = p(0, 100);
        const [bx, by] = p(100, 0);
        return (
          <>
            {href && toques > 0 && (
              <image href={href} x={Math.min(ax, bx)} y={Math.min(ay, by)} width={Math.abs(bx - ax)} height={Math.abs(by - ay)} preserveAspectRatio="none" style={{ pointerEvents: "none" }} />
            )}
            <Sentido p={p} />
          </>
        );
      }}
    </CampoOpta>
  );
}

function Sentido({ p }: { p: Proyecta }) {
  const [x1, y1] = p(42, 3);
  const [x2] = p(58, 3);
  return (
    <g style={{ pointerEvents: "none" }}>
      <line x1={x1} y1={y1 + 8} x2={x2} y2={y1 + 8} style={{ stroke: "rgba(255,255,255,0.45)", strokeWidth: 4 }} />
      <polygon points={`${x2},${y1 + 8} ${x2 - 16},${y1} ${x2 - 16},${y1 + 16}`} style={{ fill: "rgba(255,255,255,0.45)" }} />
    </g>
  );
}

const RGB_A = "242,201,76";
const RGB_B = "255,122,122";

/* ------------------------------ red ------------------------------ */

function Red({
  ev,
  equipo,
  jugadores,
  color,
  elegido,
  alElegir,
}: {
  ev: EventoDirecto[];
  equipo: Equipo;
  jugadores: Map<string, JugadorDirecto>;
  color: string;
  elegido: string;
  alElegir: (id: string) => void;
}) {
  const red = useMemo(() => redPases(ev, equipo.teamId), [ev, equipo.teamId]);
  /* El once inicial (con los cambios se amontonan los puntos); si Opta aún no dice quién salió de inicio, los 11 que más la mueven. */
  const nodos = useMemo(() => {
    const titulares = red.nodos.filter((n) => jugadores.get(n.id)?.titular);
    const base = titulares.length >= 7 ? titulares : red.nodos;
    return [...base].sort((a, b) => b.pases + b.recibe - (a.pases + a.recibe)).slice(0, 11);
  }, [red, jugadores]);
  const dentro = new Set(nodos.map((n) => n.id));
  const minimo = red.pases > 250 ? 4 : red.pases > 120 ? 3 : 2;
  const enlaces = red.enlaces.filter((e) => e.n >= minimo && dentro.has(e.a) && dentro.has(e.b));
  const tope = Math.max(1, ...enlaces.map((e) => e.n));
  const topeN = Math.max(1, ...nodos.map((n) => n.pases));
  const sitio = new Map(nodos.map((n) => [n.id, n]));
  const pareja = [...enlaces].sort((a, b) => b.n - a.n)[0];
  const nombre = (id: string) => jugadores.get(id)?.nombre ?? "";

  if (nodos.length < 3) return <p className="text-xs text-white/50">Aún pocos pases para dibujar la red de {equipo.nombre}.</p>;
  return (
    <div className="min-w-0">
      <p className="mb-1 text-sm font-semibold" style={{ color }}>
        {equipo.nombre} · {red.pases} pases
      </p>
      <CampoOpta ariaLabel={`Red de pases de ${equipo.nombre}`} maxAlto={300}>
        {(p) => (
          <>
            {enlaces.map((e) => {
              const a = sitio.get(e.a)!;
              const b = sitio.get(e.b)!;
              const [x1, y1] = p(a.x, a.y);
              const [x2, y2] = p(b.x, b.y);
              const suya = !elegido || e.a === elegido || e.b === elegido;
              return (
                <line
                  key={`${e.a}|${e.b}`}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  style={{ stroke: suya ? color : SOBRE_CESPED.tenue, strokeOpacity: suya ? 0.3 + (e.n / tope) * 0.55 : 0.12, strokeWidth: 2 + (e.n / tope) * 14, strokeLinecap: "round" }}
                >
                  <title>{`${nombre(e.a)} – ${nombre(e.b)}: ${e.n} pases completados`}</title>
                </line>
              );
            })}
            {nodos.map((n) => {
              const [cx, cy] = p(n.x, n.y);
              const j = jugadores.get(n.id);
              const marcado = elegido === n.id;
              const r = 15 + (n.pases / topeN) * 17;
              return (
                <g key={n.id} onClick={() => alElegir(marcado ? "" : n.id)} style={{ cursor: "pointer", opacity: elegido && !marcado ? 0.75 : 1 }}>
                  <circle cx={cx} cy={cy} r={r} style={{ fill: "#0E2A1B", stroke: marcado ? "#FFFFFF" : color, strokeWidth: marcado ? 6 : 3.5 }}>
                    <title>{`${j?.nombre ?? n.id}: ${n.pases} pases dados, ${n.recibe} recibidos`}</title>
                  </circle>
                  <text x={cx} y={cy + 8} textAnchor="middle" style={{ fill: "#FFFFFF", fontSize: 22, fontWeight: 800, pointerEvents: "none" }}>
                    {j?.dorsal || "·"}
                  </text>
                  <text x={cx} y={cy + r + 22} textAnchor="middle" style={{ fill: "rgba(255,255,255,0.85)", fontSize: 18, fontWeight: 600, pointerEvents: "none" }}>
                    {apellido(j?.nombre ?? "")}
                  </text>
                </g>
              );
            })}
          </>
        )}
      </CampoOpta>
      {pareja && (
        <p className="mt-1 text-[11px] text-white/60">
          Pareja que más se asocia: <b className="text-white/85">{apellido(nombre(pareja.a))}</b> – <b className="text-white/85">{apellido(nombre(pareja.b))}</b> ({pareja.n} pases).
        </p>
      )}
    </div>
  );
}

/* ------------------------------ remates y xG ------------------------------ */

function Remates({ ev, a, b, jugadores }: { ev: EventoDirecto[]; a: Equipo; b: Equipo; jugadores: Map<string, JugadorDirecto> }) {
  const ts = useMemo(() => tirosDe(ev), [ev]);
  return (
    <CampoOpta ariaLabel="Remates de los dos equipos" maxAlto={320}>
      {(p) => (
        <>
          {ts.map((t, i) => {
            const deA = t.teamId === a.teamId;
            /* El de la izquierda ataca a la derecha; el otro, a la izquierda. */
            const [cx, cy] = deA ? p(t.x, t.y) : p(100 - t.x, 100 - t.y);
            const color = deA ? COLOR_A : COLOR_B;
            const r = 8 + Math.sqrt(t.xG ?? 0.01) * 42;
            return (
              <circle
                key={i}
                cx={cx}
                cy={cy}
                r={r}
                style={{ fill: t.gol ? color : t.aPuerta ? `${color}55` : "transparent", stroke: t.gol ? "#FFFFFF" : color, strokeWidth: t.gol ? 4 : 3, strokeDasharray: t.aPuerta || t.gol ? undefined : "6 5" }}
              >
                <title>{`${t.minuto}′ ${jugadores.get(t.jugadorId)?.nombre ?? ""} (${deA ? a.nombre : b.nombre}): ${t.gol ? "GOL" : t.aPuerta ? "a puerta" : "fuera o tapado"}, xG ${dec(t.xG ?? 0)}`}</title>
              </circle>
            );
          })}
        </>
      )}
    </CampoOpta>
  );
}

function CurvaXg({ ev, todos, a, b }: { ev: EventoDirecto[]; todos: EventoDirecto[]; a: Equipo; b: Equipo }) {
  const ts = useMemo(() => tirosDe(ev), [ev]);
  const hasta = useMemo(() => todos.reduce((m, e) => Math.max(m, e.minuto), 0), [todos]);
  const curva = useMemo(() => curvaXg(ts, [a.teamId, b.teamId], hasta), [ts, a.teamId, b.teamId, hasta]);
  const fin = curva[a.teamId].length - 1;
  const tope = Math.max(0.5, curva[a.teamId][fin], curva[b.teamId][fin]);
  const W = 600;
  const H = 180;
  const X = (m: number) => 34 + (m / Math.max(1, fin)) * (W - 44);
  const Y = (v: number) => H - 22 - (v / tope) * (H - 36);
  const escalon = (v: number[]) => {
    let d = `M${X(0)},${Y(0)}`;
    for (let m = 1; m <= fin; m++) d += ` L${X(m).toFixed(1)},${Y(v[m - 1]).toFixed(1)} L${X(m).toFixed(1)},${Y(v[m]).toFixed(1)}`;
    return d;
  };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="xG acumulado por minuto">
      {[0, tope / 2, tope].map((v) => (
        <g key={v}>
          <line x1={34} x2={W - 10} y1={Y(v)} y2={Y(v)} style={{ stroke: tinta(0.1) }} />
          <text x={28} y={Y(v) + 4} textAnchor="end" style={{ fill: tinta(0.5), fontSize: 11 }}>
            {dec(v, 1)}
          </text>
        </g>
      ))}
      {[0, 15, 30, 45, 60, 75, 90].filter((m) => m <= fin).map((m) => (
        <text key={m} x={X(m)} y={H - 6} textAnchor="middle" style={{ fill: tinta(0.5), fontSize: 11 }}>
          {m}′
        </text>
      ))}
      {fin >= 45 && <line x1={X(45)} x2={X(45)} y1={10} y2={H - 22} style={{ stroke: tinta(0.2), strokeDasharray: "4 4" }} />}
      <path d={escalon(curva[b.teamId])} style={{ fill: "none", stroke: "#E8484D", strokeWidth: 2.5 }} />
      <path d={escalon(curva[a.teamId])} style={{ fill: "none", stroke: a.teamId === CASTILLA_OPTA ? "#C8A96B" : "#4F8FE8", strokeWidth: 3 }} />
      {ts.filter((t) => t.gol).map((t, i) => {
        const deA = t.teamId === a.teamId;
        const v = curva[t.teamId][Math.min(fin, t.minuto)];
        return (
          <g key={i}>
            <circle cx={X(Math.min(fin, t.minuto))} cy={Y(v)} r={6} style={{ fill: deA ? (a.teamId === CASTILLA_OPTA ? "#C8A96B" : "#4F8FE8") : "#E8484D", stroke: "#fff", strokeWidth: 2 }} />
            <text x={X(Math.min(fin, t.minuto))} y={Y(v) - 10} textAnchor="middle" style={{ fill: tinta(0.85), fontSize: 11, fontWeight: 700 }}>
              GOL {t.minuto}′
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ------------------------------ robos y pérdidas ------------------------------ */

function RobosPerdidas({ ev, equipo, color }: { ev: EventoDirecto[]; equipo: Equipo; color: string }) {
  const r = useMemo(() => robosYPerdidas(ev, equipo.teamId), [ev, equipo.teamId]);
  return (
    <div className="min-w-0">
      <p className="mb-1 text-sm font-semibold" style={{ color }}>
        {equipo.nombre}: {r.robos.length} robos · {r.perdidas.length} pérdidas
      </p>
      <CampoOpta ariaLabel={`Robos y pérdidas de ${equipo.nombre}`} maxAlto={280}>
        {(p) => (
          <>
            {[66.7, 33.3].map((x) => {
              const [lx, ly1] = p(x, 0);
              const [, ly2] = p(x, 100);
              return <line key={x} x1={lx} x2={lx} y1={ly1} y2={ly2} style={{ stroke: "rgba(255,255,255,0.25)", strokeDasharray: "8 8", strokeWidth: 2 }} />;
            })}
            {r.perdidas.map((e, i) => {
              const [cx, cy] = p(e.x, e.y);
              return (
                <g key={`p${i}`}>
                  <line x1={cx - 9} y1={cy - 9} x2={cx + 9} y2={cy + 9} style={{ stroke: "#FF6B6B", strokeWidth: 4 }} />
                  <line x1={cx - 9} y1={cy + 9} x2={cx + 9} y2={cy - 9} style={{ stroke: "#FF6B6B", strokeWidth: 4 }} />
                </g>
              );
            })}
            {r.robos.map((e, i) => {
              const [cx, cy] = p(e.x, e.y);
              return <circle key={`r${i}`} cx={cx} cy={cy} r={10} style={{ fill: SOBRE_CESPED.verde, stroke: "#0E2A1B", strokeWidth: 2 }} />;
            })}
          </>
        )}
      </CampoOpta>
      <div className="mt-1 grid grid-cols-3 gap-1 text-center text-[11px] tabular-nums text-white/70">
        {(["baja", "media", "alta"] as const).map((k) => (
          <span key={k} className="rounded-lg bg-white/[0.04] px-1 py-1">
            {k === "alta" ? "Último tercio" : k === "media" ? "Medio" : "Propio"}: <b style={{ color: SOBRE_CESPED.verde }}>{r.alturaRobos[k]}</b> / <b style={{ color: "#FF6B6B" }}>{r.alturaPerdidas[k]}</b>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------ jugadores ------------------------------ */

const COLUMNAS: { k: string; t: string; v: (r: Rendimiento) => number; f?: (r: Rendimiento) => string; def?: string }[] = [
  { k: "min", t: "Min", v: (r) => r.jugador.minutos },
  { k: "xpv", t: "Impacto", v: (r) => r.xPV, f: (r) => dec(r.xPV), def: "xPV: cuánto acercan al gol sus acciones con balón (suma)" },
  { k: "toques", t: "Toques", v: (r) => r.toques },
  { k: "pases", t: "Pases", v: (r) => r.pases, f: (r) => `${r.pasesOk}/${r.pases}` },
  { k: "prog", t: "Progr.", v: (r) => r.progresivos, def: "Pases que acercan el balón a la portería al menos un 25 %" },
  { k: "tercio", t: "Al 3.º", v: (r) => r.alTercio, def: "Pases completados que entran en el último tercio" },
  { k: "xg", t: "xG", v: (r) => r.xG, f: (r) => (r.tiros ? `${dec(r.xG)} (${r.tiros})` : "–") },
  { k: "xa", t: "xA", v: (r) => r.jugador.cifras.xA ?? 0, f: (r) => dec(r.jugador.cifras.xA ?? 0) },
  { k: "rec", t: "Robos", v: (r) => r.recuperaciones },
  { k: "duel", t: "Duelos", v: (r) => r.duelosGanados, f: (r) => (r.duelos ? `${r.duelosGanados}/${r.duelos}` : "–") },
  { k: "perd", t: "Pérd.", v: (r) => -r.perdidas, f: (r) => String(r.perdidas) },
];

function Destacados({ filas, color }: { filas: Rendimiento[]; color: string }) {
  const top = [...filas].filter((r) => r.toques >= 5).sort((a, b) => b.xPV - a.xPV).slice(0, 3);
  if (!top.length) return null;
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {top.map((r, i) => (
        <div key={r.jugador.id} className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2">
          <p className="text-[10px] font-black uppercase tracking-[0.14em]" style={{ color }}>
            {i === 0 ? "El que más empuja" : `${i + 1}.º en impacto`}
          </p>
          <p className="truncate text-sm font-semibold text-white">
            <span className="tabular-nums text-white/55">{r.jugador.dorsal}</span> {r.jugador.nombre}
          </p>
          <p className="text-[11px] tabular-nums text-white/60">
            xPV {dec(r.xPV)} · {r.progresivos} progresivos · {r.recuperaciones} robos{r.tiros ? ` · ${r.tiros} remates` : ""}
          </p>
        </div>
      ))}
    </div>
  );
}

function Tabla({ filas, color, elegido, alElegir }: { filas: Rendimiento[]; color: string; elegido: string; alElegir: (id: string) => void }) {
  const [orden, setOrden] = useState("xpv");
  const col = COLUMNAS.find((c) => c.k === orden) ?? COLUMNAS[1];
  const ordenadas = [...filas].sort((a, b) => col.v(b) - col.v(a));
  const topes = Object.fromEntries(COLUMNAS.map((c) => [c.k, Math.max(0.0001, ...filas.map((r) => Math.abs(c.v(r))))]));
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-[12px] tabular-nums">
        <thead>
          <tr className="text-white/50">
            <th className="px-1 py-1 text-left font-semibold">Jugador</th>
            {COLUMNAS.map((c) => (
              <th key={c.k} className="px-1 py-1 text-right font-semibold" title={c.def}>
                <button type="button" onClick={() => setOrden(c.k)} className={orden === c.k ? "text-white underline" : "hover:text-white"}>
                  {c.t}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ordenadas.map((r) => (
            <tr
              key={r.jugador.id}
              onClick={() => alElegir(elegido === r.jugador.id ? "" : r.jugador.id)}
              className={`cursor-pointer border-t border-white/[0.06] ${elegido === r.jugador.id ? "bg-white/[0.08]" : "hover:bg-white/[0.04]"}`}
            >
              <td className="max-w-[170px] truncate px-1 py-1 text-white/85">
                <span className="mr-1 inline-block w-5 text-right text-white/45">{r.jugador.dorsal}</span>
                {r.jugador.nombre}
                {!r.jugador.titular && <span className="ml-1 text-[10px] text-white/40">(supl.)</span>}
              </td>
              {COLUMNAS.map((c) => {
                const v = c.v(r);
                const ancho = c.k === "min" || c.k === "perd" ? 0 : Math.max(0, v / topes[c.k]);
                return (
                  <td key={c.k} className="relative px-1 py-1 text-right text-white/80">
                    {ancho > 0 && <span className="absolute inset-y-1 right-0 rounded-sm" style={{ width: `${ancho * 100}%`, background: color, opacity: 0.18 }} />}
                    <span className="relative">{c.f ? c.f(r) : String(v)}</span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FichaJugador({ ev, r, color, rgb, alCerrar }: { ev: EventoDirecto[]; r: Rendimiento; color: string; rgb: string; alCerrar: () => void }) {
  const suyos = useMemo(() => ev.filter((e) => e.jugadorId === r.jugador.id), [ev, r.jugador.id]);
  const pases = suyos.filter((e) => e.tipo === "Pass" && e.finX != null && e.finY != null);
  const tercios = porTercios(suyos);
  const c = r.jugador.cifras;
  return (
    <div className="rounded-2xl border border-white/15 bg-white/[0.04] p-3">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.14em]" style={{ color }}>
            Ficha del directo · {puesto(r.jugador.puesto) || "jugador"} · {r.jugador.minutos}′
          </p>
          <p className="truncate text-lg font-semibold text-white">
            <span className="tabular-nums text-white/55">{r.jugador.dorsal}</span> {r.jugador.nombre}
          </p>
        </div>
        <button type="button" onClick={alCerrar} className="rounded-lg border border-white/10 px-2 py-1 text-xs text-white/70 hover:text-white">
          Cerrar
        </button>
      </div>
      <div className="mb-3 grid grid-cols-3 gap-1.5 text-center sm:grid-cols-6">
        {[
          ["Impacto xPV", dec(r.xPV)],
          ["Pases", `${r.pasesOk}/${r.pases}`],
          ["Progresivos", String(r.progresivos)],
          ["Robos", String(r.recuperaciones)],
          ["Duelos", r.duelos ? `${r.duelosGanados}/${r.duelos}` : "–"],
          ["Pérdidas", String(r.perdidas)],
          ["xG", r.tiros ? `${dec(r.xG)} (${r.tiros})` : "–"],
          ["xA", dec(c.xA ?? 0)],
          ["Ocasiones", String(c.Chance ?? 0)],
          ["En el área", String(c.TouchOpBox ?? 0)],
          ["Toques 3.º", pct(tercios.alta)],
          ["Toques propio", pct(tercios.baja)],
        ].map(([t, v]) => (
          <div key={t} className="rounded-xl bg-white/[0.04] px-1 py-1.5">
            <p className="text-[10px] text-white/50">{t}</p>
            <p className="text-sm font-semibold tabular-nums text-white">{v}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="min-w-0">
          <p className="mb-1 text-xs font-semibold text-white/70">Dónde la toca</p>
          <Calor ev={suyos} rgb={rgb} etiqueta={`Mapa de calor de ${r.jugador.nombre}`} maxAlto={260} />
        </div>
        <div className="min-w-0">
          <p className="mb-1 text-xs font-semibold text-white/70">
            Sus pases (<span style={{ color: SOBRE_CESPED.verde }}>completados</span>, <span style={{ color: "#FF6B6B" }}>fallados</span>, más gruesos los progresivos) y sus robos (●)
          </p>
          <CampoOpta ariaLabel={`Pases y acciones de ${r.jugador.nombre}`} maxAlto={260}>
            {(p) => (
              <>
                {pases.map((e, i) => {
                  const [x1, y1] = p(e.x, e.y);
                  const [x2, y2] = p(e.finX!, e.finY!);
                  const ang = Math.atan2(y2 - y1, x2 - x1);
                  const col = e.ok ? SOBRE_CESPED.verde : "#FF6B6B";
                  const grueso = progresa(e) || alUltimoTercio(e);
                  return (
                    <g key={i} style={{ opacity: e.ok ? 0.9 : 0.75 }}>
                      <line x1={x1} y1={y1} x2={x2} y2={y2} style={{ stroke: col, strokeWidth: grueso ? 5 : 2.5 }} />
                      <polygon
                        points={`${x2},${y2} ${x2 - 14 * Math.cos(ang - 0.4)},${y2 - 14 * Math.sin(ang - 0.4)} ${x2 - 14 * Math.cos(ang + 0.4)},${y2 - 14 * Math.sin(ang + 0.4)}`}
                        style={{ fill: col }}
                      />
                    </g>
                  );
                })}
                {suyos.filter(recupera).map((e, i) => {
                  const [cx, cy] = p(e.x, e.y);
                  return <circle key={`r${i}`} cx={cx} cy={cy} r={10} style={{ fill: SOBRE_CESPED.verde, stroke: "#0E2A1B", strokeWidth: 2 }} />;
                })}
                {suyos.filter((e) => pierde(e) && e.tipo !== "Pass").map((e, i) => {
                  const [cx, cy] = p(e.x, e.y);
                  return <circle key={`l${i}`} cx={cx} cy={cy} r={9} style={{ fill: "none", stroke: "#FF6B6B", strokeWidth: 4 }} />;
                })}
                <Sentido p={p} />
              </>
            )}
          </CampoOpta>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ la pieza ------------------------------ */

export function DirectoMapas({ eventos, jugadores, a, b }: { eventos: TablaOpta | null | undefined; jugadores: TablaOpta | null | undefined; a: Equipo; b: Equipo }) {
  const [tramo, setTramo] = useState<Tramo>("todo");
  const [elegido, setElegido] = useState("");
  const todos = useMemo(() => leeEventos(eventos), [eventos]);
  const plantilla = useMemo(() => leeJugadores(jugadores), [jugadores]);
  const porId = useMemo(() => new Map(plantilla.map((j) => [j.id, j])), [plantilla]);
  const ev = useMemo(() => filtraTramo(todos, tramo), [todos, tramo]);
  const evA = useMemo(() => ev.filter((e) => e.teamId === a.teamId), [ev, a.teamId]);
  const evB = useMemo(() => ev.filter((e) => e.teamId === b.teamId), [ev, b.teamId]);
  const terr = useMemo(() => territorio(ev, a.teamId, b.teamId), [ev, a.teamId, b.teamId]);
  const rend = useMemo(() => rendimientos(ev, plantilla), [ev, plantilla]);
  const rendA = rend.filter((r) => r.jugador.teamId === a.teamId);
  const rendB = rend.filter((r) => r.jugador.teamId === b.teamId);
  const ficha = rend.find((r) => r.jugador.id === elegido) ?? null;
  const toquesA = evA.filter(esToque).length;
  const toquesB = evB.filter(esToque).length;
  const xgA = evA.reduce((s, e) => s + (["Goal", "Miss", "AttemptSaved", "Post"].includes(e.tipo) ? (e.xG ?? 0) : 0), 0);
  const xgB = evB.reduce((s, e) => s + (["Goal", "Miss", "AttemptSaved", "Post"].includes(e.tipo) ? (e.xG ?? 0) : 0), 0);

  if (todos.length < 20) {
    return (
      <p className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs text-white/55">
        Los mapas (calor, red de pases, remates, robos y la ficha de cada jugador) salen en cuanto Opta publique el evento a evento de este partido.
      </p>
    );
  }

  const titulo = (t: string, sub?: string) => (
    <div className="mb-2">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/55">{t}</h3>
      {sub && <p className="text-[11px] text-white/45">{sub}</p>}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">El partido en el campo</p>
        <Botonera etiqueta="Tramo del partido" valor={tramo} opciones={TRAMOS} alCambiar={setTramo} />
      </div>

      {/* Lo grande de un vistazo. */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ["Toques", toquesA, toquesB, (v: number) => String(v)],
          ["xG", xgA, xgB, (v: number) => dec(v)],
          ["Robos", robosYPerdidas(ev, a.teamId).robos.length, robosYPerdidas(ev, b.teamId).robos.length, (v: number) => String(v)],
          ["Pases progresivos", evA.filter(progresa).length, evB.filter(progresa).length, (v: number) => String(v)],
        ].map(([t, va, vb, f]) => {
          const x = Number(va);
          const y = Number(vb);
          const fx = f as (v: number) => string;
          const parte = x + y > 0 ? (x / (x + y)) * 100 : 50;
          return (
            <div key={String(t)} className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">{String(t)}</p>
              <p className="flex items-baseline justify-between text-lg font-semibold tabular-nums">
                <span style={{ color: COLOR_A }}>{fx(x)}</span>
                <span style={{ color: COLOR_B }}>{fx(y)}</span>
              </p>
              <div className="mt-1 flex h-1.5 overflow-hidden rounded-full" style={{ background: tinta(0.08) }}>
                <span style={{ width: `${parte}%`, background: "#C8A96B" }} />
                <span style={{ width: `${100 - parte}%`, background: "#E8484D", opacity: 0.8 }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* 1. Territorio y calor. */}
      <section>
        {titulo("Dónde se juega", "Mapa de calor de los toques de cada equipo, los dos atacando hacia la derecha. Territorio = de los toques en el último tercio, cuántos son de cada uno.")}
        {terr.pctA != null && (
          <div className="mb-3">
            <div className="flex justify-between text-xs font-semibold tabular-nums">
              <span style={{ color: COLOR_A }}>
                {a.nombre} {pct(terr.pctA)}
              </span>
              <span className="text-white/50">Territorio</span>
              <span style={{ color: COLOR_B }}>
                {pct(1 - terr.pctA)} {b.nombre}
              </span>
            </div>
            <div className="mt-1 flex h-2.5 overflow-hidden rounded-full">
              <span style={{ width: `${terr.pctA * 100}%`, background: "#C8A96B" }} />
              <span style={{ width: `${(1 - terr.pctA) * 100}%`, background: "#E8484D" }} />
            </div>
          </div>
        )}
        <div className="grid gap-3 md:grid-cols-2">
          {[
            [a, evA, RGB_A, COLOR_A],
            [b, evB, RGB_B, COLOR_B],
          ].map(([eq, l, rgb, color]) => {
            const e = eq as Equipo;
            const t = porTercios(l as EventoDirecto[]);
            return (
              <div key={e.teamId} className="min-w-0">
                <p className="mb-1 text-sm font-semibold" style={{ color: color as string }}>
                  {e.nombre}
                </p>
                <Calor ev={l as EventoDirecto[]} rgb={rgb as string} etiqueta={`Mapa de calor de ${e.nombre}`} />
                <p className="mt-1 text-[11px] tabular-nums text-white/60">
                  Toques en campo propio {pct(t.baja)} · medio {pct(t.media)} · último tercio {pct(t.alta)}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* 2. Red de pases. */}
      <section>
        {titulo("Red de pases", "El once inicial: cada jugador (su dorsal) en la posición media de lo que da y recibe; más grande, más pases; más gruesa la línea, más pases completados entre los dos. Pincha un jugador para ver su ficha.")}
        <div className="grid gap-3 md:grid-cols-2">
          <Red ev={ev} equipo={a} jugadores={porId} color={COLOR_A} elegido={elegido} alElegir={setElegido} />
          <Red ev={ev} equipo={b} jugadores={porId} color={COLOR_B} elegido={elegido} alElegir={setElegido} />
        </div>
      </section>

      {ficha && (
        <FichaJugador
          ev={ev}
          r={ficha}
          color={ficha.jugador.teamId === a.teamId ? COLOR_A : COLOR_B}
          rgb={ficha.jugador.teamId === a.teamId ? RGB_A : RGB_B}
          alCerrar={() => setElegido("")}
        />
      )}

      {/* 3. Remates y xG. */}
      <section>
        {titulo(
          "Remates y xG",
          `${a.nombre} ataca hacia la derecha y ${b.nombre} hacia la izquierda. Tamaño = xG; relleno = gol; medio relleno = a puerta; discontinuo = fuera o tapado.`,
        )}
        <div className="grid gap-3 lg:grid-cols-[1.2fr_1fr]">
          <Remates ev={ev} a={a} b={b} jugadores={porId} />
          <div className="min-w-0">
            <p className="mb-1 text-xs text-white/60">
              xG acumulado: <span style={{ color: a.teamId === CASTILLA_OPTA ? ORO : "#4F8FE8" }}>{a.nombre}</span> y <span style={{ color: "#E8484D" }}>{b.nombre}</span>
            </p>
            <CurvaXg ev={ev} todos={todos} a={a} b={b} />
          </div>
        </div>
      </section>

      {/* 4. Robos y pérdidas. */}
      <section>
        {titulo("Robos y pérdidas", "● robo (recuperación, intercepción o entrada ganada) · ✕ pérdida (pase fallado, regate perdido o robado). Las líneas parten el campo en tercios.")}
        <div className="grid gap-3 md:grid-cols-2">
          <RobosPerdidas ev={ev} equipo={a} color={COLOR_A} />
          <RobosPerdidas ev={ev} equipo={b} color={COLOR_B} />
        </div>
      </section>

      {/* 5. Rendimiento individual. */}
      <section className="space-y-4">
        {titulo("Rendimiento individual", "Impacto = xPV de Opta sumado: cuánto acerca al gol cada acción con balón. Pulsa una columna para ordenar y un jugador para abrir su ficha.")}
        {[
          [a, rendA, COLOR_A],
          [b, rendB, COLOR_B],
        ].map(([eq, filas, color]) => (
          <div key={(eq as Equipo).teamId} className="space-y-2">
            <p className="text-sm font-semibold" style={{ color: color as string }}>
              {(eq as Equipo).nombre}
            </p>
            <Destacados filas={filas as Rendimiento[]} color={color as string} />
            <Tabla filas={filas as Rendimiento[]} color={color as string} elegido={elegido} alElegir={setElegido} />
          </div>
        ))}
      </section>
    </div>
  );
}
