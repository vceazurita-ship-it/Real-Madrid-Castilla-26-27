"use client";

/**
 * OCASIONES QUE CONCEDE EL RIVAL: CUÁNTAS Y DE QUÉ CALIDAD (19/11/2026, idea
 * de X). En «Rival y categoría → Un equipo de un vistazo», debajo de la
 * clasificación justa.
 *
 * 1. Dispersión de los equipos del grupo: remates concedidos por partido (X)
 *    contra xG medio de cada remate concedido (Y), con la media de la liga en
 *    cruz. Cuatro cuadrantes: «concede mucho y peligroso», «mucho pero lejos»,
 *    «poco pero claro» y «sólido». En azul el equipo elegido (por defecto, el
 *    próximo rival) y en oro el Castilla.
 * 2. El mapa de los remates que concede el elegido, separando los de dentro
 *    del área de los de fuera, con el % de cada zona frente a la liga.
 *
 * Datos: `opta:remates` (pesado: sólo se pide cuando el bloque asoma). Las
 * cuentas, en `lib/data-analisis/ocasiones-concedidas.ts`.
 */

import { useEffect, useMemo, useRef, useState } from "react";

import { useProximoRival } from "@/components/data/ClasificacionJusta";
import { COMPARADO, EscudoPunto, ORO, ladoEscudo, tinta, useEscudos } from "@/components/data/graficas";
import { InterruptorNombres, useEscudosVisibles } from "@/components/data/visual/InterruptorNombres";
import { CampoOpta } from "@/components/campo/CampoOpta";
import { equiposDe, nombreDe, useRemates } from "@/app/opta/_piezas/eventos";
import { useOpta, type DatosOpta } from "@/app/opta/_piezas/useOpta";
import { CASTILLA_OPTA } from "@/lib/opta";
import { casaEquipo } from "@/lib/opta-eventos";
import {
  concesiones,
  CONSIGNA,
  CUADRANTE,
  cuadranteDe,
  dentroDelArea,
  type Concesiones,
  type FilaConcede,
} from "@/lib/data-analisis/ocasiones-concedidas";

const coma = (v: number, d = 1) => v.toFixed(d).replace(".", ",");
const pct = (v: number) => `${Math.round(v * 100)} %`;

/** Colores del mapa (sobre el césped, oscuro en los dos temas). */
const DENTRO = "#FF7A7A";
const FUERA = "#5DA9FF";

export function OcasionesConcedidas() {
  const caja = useRef<HTMLDivElement>(null);
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    const el = caja.current;
    if (!el || abierto) return;
    const io = new IntersectionObserver((entradas) => {
      if (entradas.some((e) => e.isIntersecting)) setAbierto(true);
    }, { rootMargin: "300px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [abierto]);

  return <div ref={caja} className="min-w-0">{abierto && <ConDatos />}</div>;
}

function ConDatos() {
  const { datos, cargando } = useOpta();
  if (!datos) return cargando ? <p className="mt-6 text-sm text-white/50">Cargando Opta…</p> : null;
  if (!datos.equipos.length) return null;
  return <Bloque datos={datos} />;
}

function Bloque({ datos }: { datos: DatosOpta }) {
  const { remates, cargando } = useRemates(datos);
  const proximo = useProximoRival();
  const [elegido, setElegido] = useState<string | null>(null);

  const grupo = useMemo(() => {
    const g = datos.grupos.get(CASTILLA_OPTA);
    if (g == null) return null;
    return new Set([...datos.grupos.entries()].filter(([, n]) => n === g).map(([id]) => id));
  }, [datos]);

  const c = useMemo(() => (grupo && remates.length ? concesiones(remates, grupo, nombreDe) : null), [remates, grupo]);

  const rivalId = useMemo(() => {
    if (!proximo) return null;
    const id = casaEquipo(proximo, equiposDe(datos));
    return id && id !== CASTILLA_OPTA ? id : null;
  }, [datos, proximo]);

  if (!c) return cargando ? <p className="mt-6 text-sm text-white/50">Cargando los remates de Opta…</p> : null;

  const opciones = [...c.filas].sort((a, b) => a.equipo.localeCompare(b.equipo, "es"));
  const marcadoId = elegido && c.filas.some((f) => f.teamId === elegido) ? elegido : rivalId && c.filas.some((f) => f.teamId === rivalId) ? rivalId : null;
  const marcado = c.filas.find((f) => f.teamId === marcadoId) ?? null;
  const nuestra = c.filas.find((f) => f.teamId === CASTILLA_OPTA) ?? null;
  const delMapa = marcado ?? nuestra;

  return (
    <section id="x-idea-2123324315080720719-1" aria-label="Ocasiones que concede el rival" className="portada-tarjeta portada-entra mt-4 min-w-0 px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-baseline gap-x-2 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#C8A96B]">
            Ocasiones que concede · cuántas y de qué calidad
            <span className="rounded-full border border-white/15 px-2 py-0.5 text-[11px] font-semibold normal-case tracking-normal text-white/60">dato · Opta, remate a remate</span>
          </p>
          {marcado && (
            <h3 className="fuente-club mt-1.5 text-[24px] font-bold uppercase leading-[1.05] text-white sm:text-[30px]">
              {marcado.equipo}: {CUADRANTE[cuadranteDe(marcado, c)].toLowerCase()}
            </h3>
          )}
          <p className="mt-1 text-sm leading-6 text-white/70">
            {marcado ? (
              <>
                {marcado.teamId === rivalId ? "El próximo rival" : marcado.equipo} concede {coma(marcado.rematesPartido)} remates por partido (liga {coma(c.mediaRemates)}) a{" "}
                {coma(marcado.xgRemate, 2)} xG cada uno (liga {coma(c.mediaXg, 2)}): {CONSIGNA[cuadranteDe(marcado, c)]}
                {marcado.partidos < 5 && ` Con ${marcado.partidos} partidos, tendencia.`}
              </>
            ) : (
              "Cada equipo del grupo según cuántos remates deja hacer por partido y cuánto vale de media cada uno. Elige un equipo para marcarlo."
            )}
          </p>
        </div>
        <label className="flex shrink-0 items-center gap-2 text-xs text-white/60">
          Equipo
          <select
            value={marcadoId ?? ""}
            onChange={(e) => setElegido(e.target.value || null)}
            className="max-w-[12rem] rounded-lg border border-white/15 bg-white/[0.04] px-2 py-1 text-sm text-white"
          >
            {!marcadoId && <option value="">Elegir…</option>}
            {opciones
              .filter((f) => f.teamId !== CASTILLA_OPTA)
              .map((f) => (
                <option key={f.teamId} value={f.teamId}>
                  {f.equipo}
                  {f.teamId === rivalId ? " (próximo)" : ""}
                </option>
              ))}
          </select>
        </label>
      </div>

      <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-white/60">
        {marcado && (
          <span className="inline-flex items-center gap-1.5">
            <i className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: COMPARADO }} />
            {marcado.teamId === rivalId ? "Próximo rival" : "Equipo elegido"}
          </span>
        )}
        <span className="inline-flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: ORO }} />Real Madrid Castilla</span>
        <span className="inline-flex items-center gap-1.5"><i className="inline-block h-[2px] w-5" style={{ background: tinta(0.4) }} />Media de la liga</span>
      </p>

      <Dispersion c={c} marcadoId={marcadoId} alElegir={(id) => id !== CASTILLA_OPTA && setElegido(id)} />

      {delMapa && <MapaConcedidos c={c} fila={delMapa} />}

      <p className="mt-3 text-[11px] leading-5 text-white/45">
        Remates de Opta en los partidos entre equipos de nuestro grupo, sin penaltis (un penalti vale ~0,79 xG y no es una ocasión que se deje). Remates por partido = remates concedidos / partidos jugados; xG por remate = xG
        concedido / remates concedidos. Las líneas son la media de los equipos del grupo. Dentro del área = x ≥ 83 entre las líneas del área. Pincha un punto para ver su mapa.
      </p>
    </section>
  );
}

/* ------------------------------------------------------------------ */

const AN = 640;
const AL = 400;
const M = { izq: 46, der: 14, arr: 14, aba: 38 };

function Dispersion({ c, marcadoId, alElegir }: { c: Concesiones; marcadoId: string | null; alElegir: (id: string) => void }) {
  const xs = c.filas.map((f) => f.rematesPartido);
  const ys = c.filas.map((f) => f.xgRemate);
  const pad = (a: number, b: number) => (b - a || 1) * 0.12;
  const x0 = Math.max(0, Math.min(...xs) - pad(Math.min(...xs), Math.max(...xs)));
  const x1 = Math.max(...xs) + pad(Math.min(...xs), Math.max(...xs));
  const y0 = Math.max(0, Math.min(...ys) - pad(Math.min(...ys), Math.max(...ys)));
  const y1 = Math.max(...ys) + pad(Math.min(...ys), Math.max(...ys));
  const px = (v: number) => M.izq + ((v - x0) / (x1 - x0)) * (AN - M.izq - M.der);
  const py = (v: number) => AL - M.aba - ((v - y0) / (y1 - y0)) * (AL - M.arr - M.aba);
  const mx = px(c.mediaRemates);
  const my = py(c.mediaXg);

  const marcas = (a: number, b: number, n: number) => Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n);
  const colorDe = (f: FilaConcede) => (f.teamId === marcadoId ? COMPARADO : f.teamId === CASTILLA_OPTA ? ORO : null);
  /* 24/11/2026: todos con su escudo; el próximo rival y el Castilla, grandes y con halo. */
  const escudoDe = useEscudos();
  /* Todos los escudos o sólo los implicados (26/11/2026): se recuerda y vale para todos los gráficos. */
  const [conEscudos, setConEscudos] = useEscudosVisibles();
  const orden = [...c.filas].sort((a, b) => Number(Boolean(colorDe(a))) - Number(Boolean(colorDe(b))));

  const rotulo = (texto: string, x: number, y: number, ancla: "start" | "end") => (
    <text x={x} y={y} textAnchor={ancla} style={{ fill: tinta(0.42), fontSize: 11, fontWeight: 600, letterSpacing: "0.04em" }}>
      {texto.toUpperCase()}
    </text>
  );

  return (
    <div className="mt-3 min-w-0">
      <InterruptorNombres escudos={conEscudos} onEscudos={setConEscudos} />
      <svg viewBox={`0 0 ${AN} ${AL}`} className="block h-auto w-full" style={{ maxHeight: "60vh" }} role="img" aria-label="Remates concedidos por partido contra xG medio de cada remate concedido, equipo a equipo">
        {/* Cuadrantes, apenas tintados: el de arriba a la derecha es el peor. */}
        <rect x={mx} y={M.arr} width={AN - M.der - mx} height={my - M.arr} style={{ fill: "rgb(217 95 2 / 0.07)" }} />
        <rect x={M.izq} y={my} width={mx - M.izq} height={AL - M.aba - my} style={{ fill: "rgb(27 158 119 / 0.07)" }} />

        {marcas(x0, x1, 5).map((v) => (
          <g key={`x${v}`}>
            <line x1={px(v)} x2={px(v)} y1={M.arr} y2={AL - M.aba} style={{ stroke: tinta(0.07) }} />
            <text x={px(v)} y={AL - M.aba + 15} textAnchor="middle" style={{ fill: tinta(0.5), fontSize: 11 }}>{coma(v)}</text>
          </g>
        ))}
        {marcas(y0, y1, 4).map((v) => (
          <g key={`y${v}`}>
            <line x1={M.izq} x2={AN - M.der} y1={py(v)} y2={py(v)} style={{ stroke: tinta(0.07) }} />
            <text x={M.izq - 6} y={py(v) + 4} textAnchor="end" style={{ fill: tinta(0.5), fontSize: 11 }}>{coma(v, 2)}</text>
          </g>
        ))}
        <text x={(M.izq + AN - M.der) / 2} y={AL - 6} textAnchor="middle" style={{ fill: tinta(0.6), fontSize: 12 }}>Remates concedidos por partido →</text>
        <text transform={`translate(12 ${(M.arr + AL - M.aba) / 2}) rotate(-90)`} textAnchor="middle" style={{ fill: tinta(0.6), fontSize: 12 }}>xG por remate concedido →</text>

        <line x1={mx} x2={mx} y1={M.arr} y2={AL - M.aba} style={{ stroke: tinta(0.4), strokeDasharray: "5 4" }} />
        <line x1={M.izq} x2={AN - M.der} y1={my} y2={my} style={{ stroke: tinta(0.4), strokeDasharray: "5 4" }} />

        {rotulo(CUADRANTE.muchoPeligroso, AN - M.der - 6, M.arr + 14, "end")}
        {rotulo(CUADRANTE.muchoLejos, AN - M.der - 6, AL - M.aba - 8, "end")}
        {rotulo(CUADRANTE.pocoClaro, M.izq + 6, M.arr + 14, "start")}
        {rotulo(CUADRANTE.solido, M.izq + 6, AL - M.aba - 8, "start")}

        {orden.map((f) => {
          const color = colorDe(f);
          const cx = px(f.rematesPartido);
          const cy = py(f.xgRemate);
          const derecha = cx > AN - 150;
          const rol = f.teamId === marcadoId ? "comparado" : f.teamId === CASTILLA_OPTA ? "nuestro" : "fondo";
          const aparte = ladoEscudo(rol) / 2 + 8;
          return (
            <g key={f.teamId} onClick={() => alElegir(f.teamId)} style={{ cursor: f.teamId === CASTILLA_OPTA ? "default" : "pointer" }}>
              <circle cx={cx} cy={cy} r={Math.max(14, ladoEscudo(rol) / 2 + 2)} style={{ fill: "transparent" }} />
              <EscudoPunto cx={cx} cy={cy} escudo={conEscudos || rol !== "fondo" ? escudoDe(f.equipo) : null} rol={rol} />
              {color && (
                <text x={cx + (derecha ? -aparte : aparte)} y={cy + 4} textAnchor={derecha ? "end" : "start"} style={{ fill: color, fontSize: 12.5, fontWeight: 700 }}>
                  {f.equipo}
                </text>
              )}
              <title>{`${f.equipo} · ${coma(f.rematesPartido)} remates concedidos por partido · ${coma(f.xgRemate, 2)} xG por remate · ${f.partidos} partidos · ${CUADRANTE[cuadranteDe(f, c)]}`}</title>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function MapaConcedidos({ c, fila }: { c: Concesiones; fila: FilaConcede }) {
  const rs = c.porEquipo.get(fila.teamId) ?? [];
  const pctDentro = fila.remates ? fila.dentro / fila.remates : 0;
  const zonas = [
    { clave: "dentro", rotulo: "Dentro del área", color: DENTRO, n: fila.dentro, pct: pctDentro, liga: c.pctDentroLiga, xg: fila.dentro ? fila.xgDentro / fila.dentro : 0, xgLiga: c.xgDentroLiga },
    { clave: "fuera", rotulo: "Fuera del área", color: FUERA, n: fila.fuera, pct: 1 - pctDentro, liga: 1 - c.pctDentroLiga, xg: fila.fuera ? fila.xgFuera / fila.fuera : 0, xgLiga: c.xgFueraLiga },
  ];
  const dif = Math.round((pctDentro - c.pctDentroLiga) * 100);

  return (
    <div className="mt-5 min-w-0 border-t border-white/10 pt-4">
      <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-white/60">Dónde le rematan · {fila.equipo}</p>
      <p className="mt-1 text-sm leading-6 text-white/70">
        {fila.remates} remates concedidos en {fila.partidos} partidos; {pct(pctDentro)} desde dentro del área
        {Math.abs(dif) < 3 ? ", como la liga" : dif > 0 ? `, ${dif} puntos más que la liga: le llegan cerca` : `, ${-dif} puntos menos que la liga: le rematan de lejos`} ({pct(c.pctDentroLiga)}).
      </p>
      <div className="mt-3 grid min-w-0 gap-4 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] md:items-center">
        <CampoOpta vertical mitad ariaLabel={`Remates que concede ${fila.equipo}, dentro y fuera del área`} maxAlto={420}>
          {(p) =>
            [...rs]
              .sort((a, b) => b.xG - a.xG)
              .map((r, i) => {
                const [cx, cy] = p(r.x, r.y);
                const color = dentroDelArea(r) ? DENTRO : FUERA;
                return (
                  <circle
                    key={i}
                    cx={cx}
                    cy={cy}
                    r={6 + Math.sqrt(Math.max(0, r.xG)) * 34}
                    style={{ fill: color, fillOpacity: 0.45, stroke: r.gol ? "#FFFFFF" : color, strokeWidth: r.gol ? 3.5 : 1.5 }}
                  >
                    <title>{`${r.tirador || r.equipo} (${r.equipo}) · ${coma(r.xG, 2)} xG${r.gol ? " · gol" : ""}`}</title>
                  </circle>
                );
              })
          }
        </CampoOpta>
        <div className="grid min-w-0 gap-3 sm:grid-cols-2 md:grid-cols-1">
          {zonas.map((z) => (
            <div key={z.clave} className="min-w-0 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/60">
                <i className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: z.color }} />
                {z.rotulo}
              </p>
              <p className="fuente-club mt-1 text-[26px] font-bold leading-none text-white">{pct(z.pct)}</p>
              <p className="mt-1 text-xs text-white/60">
                {z.n} remates · liga {pct(z.liga)}
              </p>
              {/* La barra: el elegido contra la marca de la liga. */}
              <div className="relative mt-2 h-2 rounded-full bg-white/10">
                <div className="h-2 rounded-full" style={{ width: `${Math.min(100, z.pct * 100)}%`, background: z.color }} />
                <div className="absolute -top-1 h-4 w-[2px]" style={{ left: `${Math.min(100, z.liga * 100)}%`, background: tinta(0.75) }} title="Media de la liga" />
              </div>
              <p className="mt-1.5 text-xs text-white/55">
                {coma(z.xg, 2)} xG por remate · liga {coma(z.xgLiga, 2)}
              </p>
            </div>
          ))}
          <p className="text-[11px] leading-5 text-white/45">Cada círculo, un remate que le hacen; el tamaño, su xG; con aro blanco, gol.</p>
        </div>
      </div>
    </div>
  );
}
