"use client";

/**
 * TALENTO (10/11/2026): dónde está el talento de la categoría.
 *
 * - **Dispersión de percentiles**: dos métricas por 90, cada eje el
 *   percentil del jugador dentro de su familia ancha de puesto, con las
 *   diagonales de suma y la zona élite (suma ≥ 160).
 * - **Ranking por perfil**: la nota de perfil (media de percentiles frente a
 *   su puesto) y el «ADN» de cada métrica.
 * - **Momentos del gol** (`MomentosGol.tsx`): goles que valen puntos y goles
 *   desde el banquillo. Carga `opta:remates` y `opta:jugadores-partidos`, y
 *   sólo aquí.
 *
 * Las cuentas, en `lib/opta-talento.ts`.
 */

import { useCallback, useMemo, useState } from "react";

import { colorPercentil, ORO, tinta } from "@/components/data/graficas";
import { CASTILLA_OPTA, PUESTO_OPTA } from "@/lib/opta";
import { CLAVES_JUGADOR, enAmbito, type Ambito } from "@/lib/opta-analisis";
import { defMetrica, METRICAS_OPTA, nombreMetrica } from "@/lib/opta-nombres";
import {
  FAMILIAS_ANCHAS,
  lecturaSpearman,
  PERFILES,
  puntosPercentil,
  rankingPerfil,
  spearman,
  TASAS,
  type FamiliaAncha,
  type PuntoTalento,
} from "@/lib/opta-talento";

import { Botonera, Elegir, ElegirAmbito, fmt, Panel } from "./comun";
import { nombreDe } from "./eventos";
import { FichaJugador } from "./FichaJugador";
import { CampoMinimo } from "./Jugadores";
import { MomentosGol } from "./MomentosGol";
import type { DatosOpta } from "./useOpta";

export const MINIMO_TALENTO = 450;

/** Color de cada familia (marcas del gráfico; se leen igual en día y en noche). */
export const COLOR_FAMILIA: Record<FamiliaAncha, string> = {
  Defensas: "#4F8FE8",
  Centrocampistas: "#9A6FD6",
  Delanteros: "#D6457A",
};

/* Las columnas de `opta:jugadores` que antes sólo traducía esta pestaña (TchsM3, IntA3, Arl%AH…) están ya en el diccionario común (`lib/opta-nombres.ts`): se leen igual en Jugadores, Buscador y Liga. */
export const nombreTalento = (a: string, catalogo?: DatosOpta["catalogo"]) => nombreMetrica(a, catalogo);

/* ------------------------------------------------------------------ */
/*  Ancho del contenedor (para que el gráfico se dibuje a su tamaño)    */
/* ------------------------------------------------------------------ */

function useAncho<T extends HTMLElement>(): [(n: T | null) => (() => void) | void, number] {
  const [ancho, setAncho] = useState(0);
  const ref = useCallback((n: T | null) => {
    if (!n || typeof ResizeObserver === "undefined") return;
    const obs = new ResizeObserver(([e]) => setAncho(Math.round(e.contentRect.width)));
    obs.observe(n);
    return () => obs.disconnect();
  }, []);
  return [ref, ancho];
}

/* ------------------------------------------------------------------ */
/*  LA DISPERSIÓN                                                      */
/* ------------------------------------------------------------------ */

function Nube({
  puntos,
  nx,
  ny,
  destacados,
  elegido,
  alElegir,
}: {
  puntos: PuntoTalento[];
  nx: string;
  ny: string;
  destacados: Map<string, string>;
  elegido: string | null;
  alElegir: (id: string | null) => void;
}) {
  const [ref, ancho] = useAncho<HTMLDivElement>();
  const W = Math.max(280, ancho);
  const estrecho = W < 480;
  const H = Math.round(Math.min(W * 0.82, 560));
  const M = { arriba: 14, derecha: 14, abajo: 40, izquierda: 44 };
  const dw = W - M.izquierda - M.derecha;
  const dh = H - M.arriba - M.abajo;
  const X = (p: number) => M.izquierda + (p / 100) * dw;
  const Y = (p: number) => M.arriba + dh - (p / 100) * dh;
  const r = estrecho ? 3.2 : 4.2;

  /* Los resaltados se pintan al final, para que queden encima. */
  const orden = [...puntos].sort((a, b) => Number(a.teamId === CASTILLA_OPTA || destacados.has(a.id)) - Number(b.teamId === CASTILLA_OPTA || destacados.has(b.id)));
  const diagonal = (s: number) => {
    /* x + y = s dentro del cuadrado 0-100. */
    const x1 = Math.max(0, s - 100);
    const x2 = Math.min(100, s);
    return { x1: X(x1), y1: Y(s - x1), x2: X(x2), y2: Y(s - x2) };
  };

  if (!ancho) return <div ref={ref} className="h-80 w-full min-w-0" />;

  return (
    <div ref={ref} className="w-full min-w-0">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Percentil en ${nx} contra percentil en ${ny}`} className="block max-w-full touch-manipulation">
        <rect x={M.izquierda} y={M.arriba} width={dw} height={dh} fill={tinta(0.02)} stroke={tinta(0.12)} />
        {/* Zona élite: suma de percentiles ≥ 160. */}
        <polygon points={`${X(60)},${Y(100)} ${X(100)},${Y(100)} ${X(100)},${Y(60)}`} fill={ORO} opacity={0.13} />
        <text x={X(97)} y={Y(97) + 12} textAnchor="end" fontSize={estrecho ? 9 : 10.5} fontWeight={700} fill={ORO} letterSpacing="0.08em">
          ÉLITE
        </text>
        {[25, 50, 75].map((v) => (
          <g key={v}>
            <line x1={X(v)} x2={X(v)} y1={M.arriba} y2={M.arriba + dh} stroke={tinta(0.06)} />
            <line x1={M.izquierda} x2={M.izquierda + dw} y1={Y(v)} y2={Y(v)} stroke={tinta(0.06)} />
          </g>
        ))}
        {[100, 130, 160].map((s) => {
          const d = diagonal(s);
          return (
            <g key={s}>
              <line {...d} stroke={s === 160 ? ORO : tinta(0.28)} strokeDasharray="4 4" />
              <text x={d.x2 - 4} y={d.y2 + 11} textAnchor="end" fontSize={9} fill={s === 160 ? ORO : tinta(0.45)}>
                {s}
              </text>
            </g>
          );
        })}
        {[0, 25, 50, 75, 100].map((v) => (
          <g key={v}>
            <text x={X(v)} y={M.arriba + dh + 13} textAnchor="middle" fontSize={9.5} fill={tinta(0.45)}>
              P{v}
            </text>
            <text x={M.izquierda - 6} y={Y(v) + 3} textAnchor="end" fontSize={9.5} fill={tinta(0.45)}>
              P{v}
            </text>
          </g>
        ))}
        <text x={M.izquierda + dw / 2} y={H - 6} textAnchor="middle" fontSize={11} fontWeight={600} fill={tinta(0.7)}>
          {nx} (percentil)
        </text>
        <text x={12} y={M.arriba + dh / 2} textAnchor="middle" fontSize={11} fontWeight={600} fill={tinta(0.7)} transform={`rotate(-90 12 ${M.arriba + dh / 2})`}>
          {ny} (percentil)
        </text>

        {orden.map((p) => {
          const nuestro = p.teamId === CASTILLA_OPTA;
          const activo = p.id === elegido;
          const rotulo = destacados.get(p.id);
          const cx = X(p.px);
          const cy = Y(p.py);
          const izquierda = p.px > 78;
          return (
            <g key={p.id} onClick={() => alElegir(activo ? null : p.id)} onPointerEnter={(e) => e.pointerType === "mouse" && alElegir(p.id)} className="cursor-pointer">
              <title>{`${p.jugador} · ${nombreDe(p.teamId, p.equipo)} · P${p.px} / P${p.py}`}</title>
              {/* Zona de toque más grande que el punto. */}
              <circle cx={cx} cy={cy} r={r + 6} fill="transparent" />
              <circle
                cx={cx}
                cy={cy}
                r={activo ? r + 2.5 : nuestro ? r + 1.5 : r}
                fill={nuestro ? ORO : COLOR_FAMILIA[p.familia]}
                fillOpacity={nuestro || activo || rotulo ? 0.95 : 0.55}
                stroke={nuestro || activo ? tinta(0.9) : "none"}
                strokeWidth={1.4}
              />
              {(rotulo || nuestro || activo) && (
                <text
                  x={cx + (izquierda ? -(r + 4) : r + 4)}
                  y={cy + 3.5}
                  textAnchor={izquierda ? "end" : "start"}
                  fontSize={estrecho ? 9.5 : 11}
                  fontWeight={nuestro || activo ? 700 : 600}
                  fill={nuestro ? ORO : tinta(0.88)}
                  stroke="var(--background)"
                  strokeWidth={3}
                  paintOrder="stroke"
                  style={{ pointerEvents: "none" }}
                >
                  {p.jugador}
                  {rotulo && !estrecho ? ` · ${rotulo}` : ""}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function Dispersion({ datos, filas, minimo, alAbrir }: { datos: DatosOpta; filas: DatosOpta["jugadores"]; minimo: number; alAbrir: (id: string) => void }) {
  const { catalogo, jugadores } = datos;
  const [mx, setMx] = useState("Chance");
  const [my, setMy] = useState("Goal");
  const [familias, setFamilias] = useState<FamiliaAncha[]>([...FAMILIAS_ANCHAS]);
  const [elegido, setElegido] = useState<string | null>(null);

  const metricas = useMemo(
    () =>
      Object.keys(jugadores[0] ?? {})
        .filter((k) => !CLAVES_JUGADOR.has(k) && !["GM", "Min", "Age"].includes(k) && !TASAS.has(k))
        .sort((a, b) => Number(!METRICAS_OPTA[a]) - Number(!METRICAS_OPTA[b]) || nombreTalento(a, catalogo).localeCompare(nombreTalento(b, catalogo), "es")),
    [jugadores, catalogo],
  );
  const nx = nombreTalento(mx, catalogo);
  const ny = nombreTalento(my, catalogo);
  const invX = defMetrica(mx, catalogo).mejor === false;
  const invY = defMetrica(my, catalogo).mejor === false;

  const todos = useMemo(() => puntosPercentil(filas, mx, my, minimo, invX, invY), [filas, mx, my, minimo, invX, invY]);
  const puntos = useMemo(() => todos.filter((p) => familias.includes(p.familia)), [todos, familias]);
  const rho = useMemo(() => spearman(puntos.map((p) => p.px), puntos.map((p) => p.py)), [puntos]);

  /* Quién lleva nombre: el mejor en los dos (por suma) y el líder de cada eje (por valor). */
  const destacados = useMemo(() => {
    const m = new Map<string, string>();
    if (!puntos.length) return m;
    const porSuma = [...puntos].sort((a, b) => b.px + b.py - (a.px + a.py) || b.vx + b.vy - (a.vx + a.vy));
    porSuma.slice(0, 2).forEach((p, i) => m.set(p.id, i === 0 ? "mejor en los dos" : "segundo en los dos"));
    const liderX = [...puntos].sort((a, b) => (invX ? a.vx - b.vx : b.vx - a.vx))[0];
    const liderY = [...puntos].sort((a, b) => (invY ? a.vy - b.vy : b.vy - a.vy))[0];
    if (liderX && !m.has(liderX.id)) m.set(liderX.id, `líder en ${nx.toLowerCase()}`);
    if (liderY && !m.has(liderY.id)) m.set(liderY.id, `líder en ${ny.toLowerCase()}`);
    return m;
  }, [puntos, invX, invY, nx, ny]);

  const elite = puntos.filter((p) => p.px + p.py >= 160);
  const nuestrosElite = elite.filter((p) => p.teamId === CASTILLA_OPTA);
  const sel = puntos.find((p) => p.id === elegido) ?? null;

  const alterna = (f: FamiliaAncha) => setFamilias((xs) => (xs.includes(f) ? (xs.length > 1 ? xs.filter((x) => x !== f) : xs) : [...xs, f]));

  return (
    <Panel
      titulo="Dos talentos a la vez"
      subtitulo={`Cada punto, un jugador de campo con ${minimo}′ o más. Cada eje es su percentil por 90 frente a los de su familia (defensas, centrocampistas o delanteros): P90 es estar por encima del 90 % de los suyos.`}
      derecha={
        <>
          <Elegir etiqueta="Eje X" valor={mx} alCambiar={setMx} opciones={metricas.map((k) => ({ clave: k, nombre: nombreTalento(k, catalogo) }))} />
          <Elegir etiqueta="Eje Y" valor={my} alCambiar={setMy} opciones={metricas.map((k) => ({ clave: k, nombre: nombreTalento(k, catalogo) }))} />
        </>
      }
    >
      <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px] text-white/55">
        {FAMILIAS_ANCHAS.map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={familias.includes(f)}
            onClick={() => alterna(f)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 font-semibold transition ${familias.includes(f) ? "border-white/15 text-white/85" : "border-white/[0.06] text-white/35 line-through"}`}
          >
            <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: COLOR_FAMILIA[f] }} />
            {f}
          </button>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: ORO, boxShadow: `0 0 0 1.5px ${tinta(0.9)}` }} />
          Real Madrid Castilla
        </span>
      </div>

      {puntos.length ? (
        <Nube puntos={puntos} nx={nx} ny={ny} destacados={destacados} elegido={elegido} alElegir={setElegido} />
      ) : (
        <p className="py-10 text-center text-sm text-white/55">Nadie llega a {minimo}′ con esas dos métricas.</p>
      )}

      {sel && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white">
              {sel.jugador}
              <span className="ml-2 text-xs font-normal text-white/55">
                {[nombreDe(sel.teamId, sel.equipo), PUESTO_OPTA[sel.puesto] ?? "", `${sel.min}′`].filter(Boolean).join(" · ")}
              </span>
            </p>
            <p className="mt-0.5 text-xs tabular-nums text-white/70">
              {nx}: {fmt(sel.vx, "decimal")} por 90 · <b style={{ color: colorPercentil(sel.px) }}>P{sel.px}</b>
              {"  ·  "}
              {ny}: {fmt(sel.vy, "decimal")} por 90 · <b style={{ color: colorPercentil(sel.py) }}>P{sel.py}</b>
              {"  ·  "}suma {sel.px + sel.py}
            </p>
          </div>
          <button type="button" onClick={() => alAbrir(sel.id)} className="rounded-lg border border-white/15 px-2.5 py-1.5 text-xs font-semibold text-white/85 hover:text-white">
            Ver su ficha
          </button>
        </div>
      )}

      <div className="mt-4 border-t border-white/10 pt-3 text-xs leading-relaxed text-white/65">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">Qué estás viendo</p>
        <p>
          Las rayas diagonales unen a los que suman lo mismo entre los dos percentiles (100, 130 y 160). Por encima de 160 —la zona
          sombreada— está la élite: {elite.length} de {puntos.length} jugadores
          {nuestrosElite.length ? `, y del Castilla ${nuestrosElite.map((p) => p.jugador).join(", ")}` : ""}.
        </p>
        {rho != null && (
          <p className="mt-1">
            Correlación de rangos (Spearman): <b className="tabular-nums text-white">{rho.toFixed(2).replace(".", ",").replace("-", "−")}</b>.{" "}
            {lecturaSpearman(rho, nx.toLowerCase(), ny.toLowerCase())}
          </p>
        )}
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/*  EL RANKING POR PERFIL                                              */
/* ------------------------------------------------------------------ */

const TOPES = [
  { clave: "10", nombre: "Top 10" },
  { clave: "20", nombre: "Top 20" },
  { clave: "40", nombre: "Top 40" },
] as const;

function Ranking({ datos, filas, minimo, alAbrir }: { datos: DatosOpta; filas: DatosOpta["jugadores"]; minimo: number; alAbrir: (id: string) => void }) {
  const { catalogo } = datos;
  const [clave, setClave] = useState(PERFILES[0].clave);
  const [puesto, setPuesto] = useState("todos");
  const [tope, setTope] = useState<(typeof TOPES)[number]["clave"]>("10");
  const perfil = PERFILES.find((p) => p.clave === clave) ?? PERFILES[0];
  const puestoValido = puesto === "todos" || perfil.familias.includes(puesto) ? puesto : "todos";

  const lista = useMemo(() => {
    const r = rankingPerfil(filas, filas, perfil, minimo);
    return puestoValido === "todos" ? r : r.filter((x) => x.familia === puestoValido);
  }, [filas, perfil, minimo, puestoValido]);
  const conNota = lista.filter((x) => x.nota != null);
  const top = conNota.slice(0, Number(tope));
  const nuestros = conNota.map((x, i) => ({ x, i })).filter(({ x, i }) => x.teamId === CASTILLA_OPTA && i >= Number(tope));
  const hayCortas = top.some((x) => x.adn.some((d) => d.corta));

  return (
    <Panel
      titulo="Ranking por perfil"
      subtitulo={`${perfil.que} La nota es la media de sus percentiles (por 90) frente a los de su puesto con ${minimo}′ o más.`}
      derecha={
        <>
          <Elegir etiqueta="Perfil" valor={perfil.clave} alCambiar={(v) => setClave(v)} opciones={PERFILES.map((p) => ({ clave: p.clave, nombre: p.nombre }))} />
          {perfil.familias.length > 1 && (
            <Elegir
              etiqueta="Puesto"
              valor={puestoValido}
              alCambiar={setPuesto}
              opciones={[{ clave: "todos", nombre: "Todos los del perfil" }, ...perfil.familias.map((f) => ({ clave: f, nombre: f }))]}
            />
          )}
          <Botonera etiqueta="Cuántos" valor={tope} opciones={[...TOPES]} alCambiar={setTope} />
        </>
      }
    >
      <ol className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-white/60">
        {perfil.metricas.map((m, i) => (
          <li key={m.a} className="inline-flex items-center gap-1">
            <span className="inline-flex h-4 w-4 items-center justify-center rounded bg-white/[0.08] text-[10px] font-bold text-white/80">{i + 1}</span>
            {nombreTalento(m.a, catalogo)}
            {TASAS.has(m.a) ? "" : " /90"}
            {m.inverso ? " (menos es mejor)" : ""}
          </li>
        ))}
      </ol>

      {top.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-[12px] tabular-nums">
            <thead>
              <tr className="border-b border-white/10 text-[11px] text-white/55">
                <th className="w-8 py-2 pr-2 font-semibold">#</th>
                <th className="py-2 pr-3 font-semibold">Jugador</th>
                <th className="py-2 pr-3 text-right font-semibold">Min</th>
                <th className="w-[170px] py-2 pr-3 font-semibold">Nota de perfil</th>
                <th className="py-2 pr-2 font-semibold">ADN</th>
              </tr>
            </thead>
            <tbody>
              {[...top.map((x, i) => ({ x, i })), ...nuestros].map(({ x, i }, k) => {
                const nuestro = x.teamId === CASTILLA_OPTA;
                return (
                  <tr
                    key={x.id}
                    onClick={() => alAbrir(x.id)}
                    className={`cursor-pointer border-b border-white/[0.06] hover:bg-white/[0.04] ${k === top.length ? "border-t-2 border-t-white/15" : ""}`}
                    style={nuestro ? { background: "rgba(200, 169, 107, 0.14)" } : undefined}
                  >
                    <td className="py-1.5 pr-2 text-white/55">{i + 1}</td>
                    <td className="max-w-[220px] py-1.5 pr-3">
                      <p className="truncate font-semibold text-white/90">{x.jugador}</p>
                      <p className="truncate text-[11px] text-white/50">
                        {[nombreDe(x.teamId, x.equipo), PUESTO_OPTA[x.puesto] ?? "", x.edad ? `${x.edad} años` : ""].filter(Boolean).join(" · ")}
                      </p>
                    </td>
                    <td className="py-1.5 pr-3 text-right text-white/70">{x.min}</td>
                    <td className="py-1.5 pr-3">
                      <div className="flex items-center gap-2">
                        <div className="relative h-2.5 min-w-0 flex-1 rounded-full" style={{ background: tinta(0.08) }}>
                          <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${x.nota}%`, background: colorPercentil(x.nota) }} />
                        </div>
                        <span className="w-7 shrink-0 text-right text-[13px] font-semibold text-white">{Math.round(x.nota!)}</span>
                      </div>
                    </td>
                    <td className="py-1.5 pr-2">
                      <div className="flex items-end gap-1" aria-label="Percentil de cada métrica">
                        {x.adn.map((d, j) => (
                          <span
                            key={d.a}
                            className="flex w-5 flex-col items-center"
                            title={`${j + 1}. ${nombreTalento(d.a, catalogo)}: ${d.corta ? "muestra pequeña, no cuenta" : d.p != null ? `P${d.p}` : ""}`}
                          >
                            <span className="relative block h-7 w-3 overflow-hidden rounded-sm" style={{ background: tinta(0.07) }}>
                              {d.p != null ? (
                                <span className="absolute inset-x-0 bottom-0 block" style={{ height: `${Math.max(4, d.p)}%`, background: colorPercentil(d.p) }} />
                              ) : d.corta ? (
                                <span className="absolute inset-0 block" style={{ backgroundImage: `repeating-linear-gradient(45deg, ${tinta(0.25)} 0 2px, transparent 2px 5px)` }} />
                              ) : null}
                            </span>
                            <span className="mt-0.5 text-[9px] text-white/45">{d.corta ? "·" : j + 1}</span>
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="py-6 text-center text-sm text-white/55">Nadie de ese puesto llega a {minimo}′.</p>
      )}
      <p className="mt-2 text-[11px] text-white/45">
        Pulsa un jugador para ver su ficha.
        {nuestros.length ? " Debajo de la raya, los del Castilla que no entran en el corte, con su puesto en el ranking." : ""}
        {hayCortas ? " Las barras rayadas son porcentajes de muy pocos intentos: se marcan y no cuentan para la nota." : ""}
      </p>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/*  LA PESTAÑA                                                         */
/* ------------------------------------------------------------------ */

export function Talento({ datos }: { datos: DatosOpta }) {
  const { jugadores, grupos } = datos;
  const [minimo, setMinimo] = useState(MINIMO_TALENTO);
  const [ambito, setAmbito] = useState<Ambito>("todos");
  const [abierto, setAbierto] = useState<string | null>(null);

  const filas = useMemo(() => jugadores.filter((f) => enAmbito(f.teamId, grupos, ambito)), [jugadores, grupos, ambito]);
  const ficha = abierto ? jugadores.find((f) => String(f.playerId) === abierto) ?? null : null;

  const abre = (id: string) => {
    setAbierto(id);
    requestAnimationFrame(() => document.getElementById("talento-ficha")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  return (
    <div className="mt-6 space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <ElegirAmbito valor={ambito} alCambiar={setAmbito} />
        <CampoMinimo valor={minimo} alCambiar={setMinimo} />
      </div>

      <Dispersion datos={datos} filas={filas} minimo={minimo} alAbrir={abre} />
      <Ranking datos={datos} filas={filas} minimo={minimo} alAbrir={abre} />

      {ficha && (
        <div id="talento-ficha" className="scroll-mt-40">
          <FichaJugador key={String(ficha.playerId)} datos={datos} jugador={ficha} minimo={minimo} alCerrar={() => setAbierto(null)} />
        </div>
      )}

      <MomentosGol datos={datos} ambito={ambito} />
    </div>
  );
}
