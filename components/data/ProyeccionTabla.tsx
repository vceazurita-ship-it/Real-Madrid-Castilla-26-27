"use client";

/**
 * PROYECCIÓN DE LA TABLA (Histórico de la Competición, 23/11/2026, idea de X):
 * cómo puede acabar la liga si se juega lo que queda 50.000 veces.
 *
 * - Lo jugado: todos los partidos de liga de BeSoccer (`goles:analisis`), con
 *   sus puntos, diferencia y goles a favor.
 * - Lo que queda: la liga es a doble vuelta, así que cada cruce local-visitante
 *   se juega una vez; los que no están entre los jugados son los que faltan.
 * - La fuerza de cada equipo: su xG a favor y en contra por partido en Opta
 *   (`opta:partidos`, sólo partidos dentro del grupo), frente a la media del
 *   grupo y encogido hacia ella con 3 partidos de la media (con pocos partidos,
 *   un equipo no puede salir el doble de bueno que nadie). El factor campo sale
 *   de los goles de los partidos jugados.
 * - Cada partido: goles de cada lado por Poisson con media
 *   media × ataque propio × defensa rival (× √campo en casa, ÷ √campo fuera).
 * - El puesto final: puntos, diferencia, goles a favor y, si siguen iguales,
 *   a suertes.
 *
 * Nada se pide ni se simula hasta que el bloque asoma en pantalla; la
 * simulación va a trozos para no congelar la página.
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { COMPARADO, ORO } from "@/components/data/graficas";
import { useOptaLigero } from "@/hooks/useOptaLigero";
import { clasificacionJusta } from "@/lib/data-analisis/clasificacion-justa";
import type { PartidoGoles } from "@/lib/goles/analisis";
import { CASTILLA_OPTA } from "@/lib/opta";
import { casaEquipo } from "@/lib/opta-eventos";
import { nombreEquipo } from "@/lib/equipos";
import { mismoClub } from "@/lib/rivals/mismoClub";

const SIMULACIONES = 50_000;
const POR_TROZO = 2_500;
const MAX_GOLES = 10;
/** La escala de puntos de todas las filas. */
const TOPE = 110;
/** Partidos «de la media» que se suman a cada equipo antes de medir su xG. */
const ENCOGE = 3;
const NOSOTROS = /castilla/i;

const pct = (p: number) => (p <= 0 ? "0" : p < 0.005 ? "<1" : p > 0.995 && p < 1 ? ">99" : String(Math.round(p * 100)));
const coma = (v: number) => v.toFixed(1).replace(".", ",");

type Base = {
  nombres: string[];
  pts: number[];
  dif: number[];
  gf: number[];
  pj: number[];
  /** Cruces que faltan: índice local, visitante y sus medias de goles. */
  quedan: { l: number; v: number; ml: number; mv: number }[];
  /** Equipos sin xG en Opta (se juegan con la media). */
  sinOpta: string[];
  campo: number;
};

type Resultado = {
  /** Por equipo: cuántas simulaciones acaban con cada total de puntos (0..TOPE). */
  hist: Int32Array[];
  /** Por equipo: cuántas acaba en cada puesto (0 = 1º). */
  puestos: Int32Array[];
};

/**
 * 27/11/2026 (jueces, ronda 10): `encabezado` (el rótulo y el título de la
 * sección) se pinta aquí y sólo cuando hay proyección que enseñar: sin Opta,
 * con un número impar de equipos o sin partidos por jugar, no sale nada y la
 * página no acaba en un título vacío.
 */
export function ProyeccionTabla(props: { partidos: PartidoGoles[]; proximoRival: string; encabezado?: ReactNode }) {
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

  return (
    <div ref={caja} className="min-w-0">
      {abierto ? <Bloque {...props} /> : <div className="h-24" aria-hidden />}
    </div>
  );
}

function cdfPoisson(lambda: number): Float64Array {
  const l = Math.max(0.05, lambda);
  const c = new Float64Array(MAX_GOLES + 1);
  let p = Math.exp(-l);
  let s = p;
  c[0] = s;
  for (let k = 1; k <= MAX_GOLES; k++) {
    p = (p * l) / k;
    s += p;
    c[k] = s;
  }
  c[MAX_GOLES] = 1;
  return c;
}

const sorteaGoles = (c: Float64Array) => {
  const u = Math.random();
  let k = 0;
  while (k < MAX_GOLES && u > c[k]) k++;
  return k;
};

function Bloque({ partidos, proximoRival, encabezado }: { partidos: PartidoGoles[]; proximoRival: string; encabezado?: ReactNode }) {
  const { opta, cargando } = useOptaLigero();
  const [objetivo, setObjetivo] = useState(50);
  const [hecho, setHecho] = useState<{ clave: string; r: Resultado } | null>(null);
  const [progreso, setProgreso] = useState(0);

  const base = useMemo<Base | null>(() => {
    if (!opta || !partidos.length) return null;
    const nombres = [...new Set(partidos.flatMap((p) => [p.local, p.visitante]))].sort((a, b) => a.localeCompare(b, "es"));
    const n = nombres.length;
    if (n < 4 || n % 2) return null;
    const idx = new Map(nombres.map((x, i) => [x, i]));
    const pts = new Array<number>(n).fill(0);
    const dif = new Array<number>(n).fill(0);
    const gf = new Array<number>(n).fill(0);
    const pj = new Array<number>(n).fill(0);
    const jugado = new Set<string>();
    let golesCasa = 0;
    let golesFuera = 0;
    for (const p of partidos) {
      const l = idx.get(p.local)!;
      const v = idx.get(p.visitante)!;
      jugado.add(`${l}-${v}`);
      pts[l] += p.gl > p.gv ? 3 : p.gl === p.gv ? 1 : 0;
      pts[v] += p.gv > p.gl ? 3 : p.gl === p.gv ? 1 : 0;
      dif[l] += p.gl - p.gv;
      dif[v] += p.gv - p.gl;
      gf[l] += p.gl;
      gf[v] += p.gv;
      pj[l]++;
      pj[v]++;
      golesCasa += p.gl;
      golesFuera += p.gv;
    }

    /* La fuerza, del xG de Opta en el grupo del Castilla. */
    const g = opta.grupos.get(CASTILLA_OPTA);
    const grupo = new Set(g == null ? [] : [...opta.grupos.entries()].filter(([, k]) => k === g).map(([id]) => id));
    const filas = grupo.size ? clasificacionJusta(opta.partidos, grupo, 999) : [];
    const porId = new Map(filas.map((f) => [f.teamId, f]));
    const totalPj = filas.reduce((s, f) => s + f.partidos, 0);
    const media = totalPj ? filas.reduce((s, f) => s + f.xgf, 0) / totalPj : partidos.reduce((s, p) => s + p.gl + p.gv, 0) / (partidos.length * 2);
    const equiposOpta = opta.equipos
      .map((f) => ({ teamId: String(f.teamId ?? ""), equipo: String(f.equipo ?? "") }))
      .filter((e) => grupo.has(e.teamId));
    const sinOpta: string[] = [];
    const ataque: number[] = [];
    const defensa: number[] = [];
    for (const nombre of nombres) {
      const id = NOSOTROS.test(nombre) ? CASTILLA_OPTA : casaEquipo(nombre, equiposOpta);
      const f = id ? porId.get(id) : undefined;
      if (!f || !media) {
        sinOpta.push(nombreEquipo(nombre));
        ataque.push(1);
        defensa.push(1);
        continue;
      }
      ataque.push((f.xgf + ENCOGE * media) / (f.partidos + ENCOGE) / media);
      defensa.push((f.xgc + ENCOGE * media) / (f.partidos + ENCOGE) / media);
    }
    const campo = golesFuera > 0 ? Math.min(1.5, Math.max(0.8, golesCasa / golesFuera)) : 1;
    const raiz = Math.sqrt(campo);
    const quedan: Base["quedan"] = [];
    for (let l = 0; l < n; l++)
      for (let v = 0; v < n; v++) {
        if (l === v || jugado.has(`${l}-${v}`)) continue;
        quedan.push({ l, v, ml: media * ataque[l] * defensa[v] * raiz, mv: (media * ataque[v] * defensa[l]) / raiz });
      }
    return { nombres, pts, dif, gf, pj, quedan, sinOpta, campo };
  }, [opta, partidos]);

  const clave = base ? `${base.nombres.length}:${base.quedan.length}:${base.pts.join(",")}` : "";

  useEffect(() => {
    if (!base) return;
    const n = base.nombres.length;
    const cdf = base.quedan.map((q) => [cdfPoisson(q.ml), cdfPoisson(q.mv)] as const);
    const hist = base.nombres.map(() => new Int32Array(TOPE + 1));
    const puestos = base.nombres.map(() => new Int32Array(n));
    const pts = new Int32Array(n);
    const dif = new Int32Array(n);
    const gf = new Int32Array(n);
    const azar = new Float64Array(n);
    const orden = Array.from({ length: n }, (_, i) => i);
    let hechas = 0;
    let vivo = true;
    let espera: ReturnType<typeof setTimeout> | undefined;

    const trozo = () => {
      if (!vivo) return;
      const hasta = Math.min(SIMULACIONES, hechas + POR_TROZO);
      for (; hechas < hasta; hechas++) {
        for (let i = 0; i < n; i++) {
          pts[i] = base.pts[i];
          dif[i] = base.dif[i];
          gf[i] = base.gf[i];
          azar[i] = Math.random();
        }
        for (let k = 0; k < base.quedan.length; k++) {
          const { l, v } = base.quedan[k];
          const a = sorteaGoles(cdf[k][0]);
          const b = sorteaGoles(cdf[k][1]);
          if (a > b) pts[l] += 3;
          else if (a < b) pts[v] += 3;
          else {
            pts[l]++;
            pts[v]++;
          }
          dif[l] += a - b;
          dif[v] += b - a;
          gf[l] += a;
          gf[v] += b;
        }
        orden.sort((x, y) => pts[y] - pts[x] || dif[y] - dif[x] || gf[y] - gf[x] || azar[y] - azar[x]);
        for (let p = 0; p < n; p++) {
          const i = orden[p];
          puestos[i][p]++;
          hist[i][Math.min(TOPE, pts[i])]++;
        }
      }
      if (hechas >= SIMULACIONES) {
        setHecho({ clave, r: { hist, puestos } });
        setProgreso(1);
      } else {
        setProgreso(hechas / SIMULACIONES);
        espera = setTimeout(trozo, 0);
      }
    };
    espera = setTimeout(trozo, 0);
    return () => {
      vivo = false;
      if (espera) clearTimeout(espera);
    };
  }, [base, clave]);

  const filas = useMemo(() => {
    if (!base || !hecho || hecho.clave !== clave) return [];
    const n = base.nombres.length;
    /* Primero, play-off (2º-5º) y descenso (los cinco últimos), como en 1.ª RFEF. */
    const descensoDesde = Math.max(1, n - 5);
    return base.nombres
      .map((nombre, i) => {
        const h = hecho.r.hist[i];
        const pu = hecho.r.puestos[i];
        const cuantil = (q: number) => {
          let acum = 0;
          for (let k = 0; k <= TOPE; k++) {
            acum += h[k];
            if (acum >= q * SIMULACIONES) return k;
          }
          return TOPE;
        };
        let suma = 0;
        for (let k = 0; k <= TOPE; k++) suma += k * h[k];
        let playoff = 0;
        for (let p = 1; p <= Math.min(4, n - 1); p++) playoff += pu[p];
        let descenso = 0;
        for (let p = descensoDesde; p < n; p++) descenso += pu[p];
        return {
          nombre,
          nuestro: NOSOTROS.test(nombre),
          rival: Boolean(proximoRival) && mismoClub(nombre, proximoRival),
          pts: base.pts[i],
          pj: base.pj[i],
          media: suma / SIMULACIONES,
          p5: cuantil(0.05),
          p25: cuantil(0.25),
          mediana: cuantil(0.5),
          p75: cuantil(0.75),
          p95: cuantil(0.95),
          hist: h,
          campeon: pu[0] / SIMULACIONES,
          playoff: playoff / SIMULACIONES,
          descenso: descenso / SIMULACIONES,
        };
      })
      .sort((a, b) => b.media - a.media || b.pts - a.pts);
  }, [base, hecho, clave, proximoRival]);

  /* 27/11/2026 (jueces, ronda 10, fútbol): mientras llega Opta, un esqueleto del
     alto de la tabla con los colores del tema (el «Cargando Opta…» en blanco no
     se leía en modo día). Sin título: si al final no hay proyección, no se nombra. */
  if (!opta)
    return cargando ? (
      <div role="status" aria-label="Cargando la proyección de la tabla" className="hueso mt-6 h-64 rounded-[18px] border border-white/10" />
    ) : null;
  if (!base) return null;
  if (!base.quedan.length) return null;

  const deObjetivo = (h: Int32Array) => {
    let s = 0;
    for (let k = Math.max(0, objetivo); k <= TOPE; k++) s += h[k];
    return s / SIMULACIONES;
  };
  const nuestra = filas.find((f) => f.nuestro);
  const partidosTotales = (base.nombres.length - 1) * 2;
  const nuestrosQuedan = nuestra ? partidosTotales - nuestra.pj : 0;

  const titular = nuestra
    ? `Acabaríamos con ${Math.round(nuestra.media)} puntos (entre ${nuestra.p5} y ${nuestra.p95} en 9 de cada 10 temporadas): ${pct(deObjetivo(nuestra.hist))} % de llegar a ${objetivo}, ${pct(nuestra.playoff)} % de play-off${nuestra.campeon >= 0.005 ? `, ${pct(nuestra.campeon)} % de campeón` : ""} y ${pct(nuestra.descenso)} % de descenso.`
    : "";

  return (
    <div className="min-w-0">
      {encabezado}
      <p className="mb-3 text-base font-medium text-white/85 sm:text-lg">{titular || (progreso < 1 ? "Simulando lo que queda de liga…" : "")}</p>

      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] text-white/70">
        <label className="inline-flex items-center gap-2">
          Objetivo de puntos
          <input
            type="number"
            min={0}
            max={TOPE}
            value={objetivo}
            onChange={(e) => setObjetivo(Math.max(0, Math.min(TOPE, Math.round(Number(e.target.value) || 0))))}
            className="w-16 rounded-md border border-white/15 bg-white/[0.04] px-2 py-1 text-right tabular-nums text-white"
          />
        </label>
        <span>
          {SIMULACIONES.toLocaleString("es-ES")} simulaciones · quedan {base.quedan.length} partidos de liga
          {nuestra ? `, ${nuestrosQuedan} nuestros` : ""}
        </span>
        {progreso < 1 ? <span className="tabular-nums">Simulando… {Math.round(progreso * 100)} %</span> : null}
      </div>

      {filas.length ? (
        <div className="overflow-x-auto rounded-[18px] border border-white/10">
          <table className="w-full min-w-[820px] text-[12px] tabular-nums">
            <thead>
              <tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-wider text-white/60">
                <th className="px-3 py-2 font-medium">#</th>
                <th className="px-2 py-2 font-medium">Equipo</th>
                <th className="px-2 py-2 text-right font-medium" title="Puntos de ahora">Pts</th>
                <th className="px-2 py-2 text-right font-medium" title="Puntos finales de media">Previstos</th>
                <th className="px-2 py-2 font-medium" title="Línea: 90 % de las temporadas; caja: 50 %; punto: la media">Horquilla 0-{TOPE}</th>
                <th className="px-2 py-2 font-medium" title="Cuántas temporadas acaban con cada total; raya: la mediana">Puntos finales</th>
                <th className="px-2 py-2 text-right font-medium">Campeón</th>
                <th className="px-2 py-2 text-right font-medium">Play-off</th>
                <th className="px-2 py-2 text-right font-medium">≥ {objetivo}</th>
                <th className="px-3 py-2 text-right font-medium">Descenso</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f, k) => {
                const color = f.nuestro ? ORO : f.rival ? COMPARADO : "rgb(var(--rmcf-ink-rgb) / .55)";
                return (
                  <tr
                    key={f.nombre}
                    className={`border-b border-white/5 ${f.nuestro ? "font-semibold" : ""}`}
                    style={f.nuestro ? { background: "rgb(200 169 107 / .12)" } : undefined}
                  >
                    <td className="px-3 py-1.5 text-white/60">{k + 1}</td>
                    <td className="max-w-[180px] truncate px-2 py-1.5" style={f.nuestro ? { color: ORO } : f.rival ? { color: COMPARADO } : undefined}>
                      {f.nuestro ? "RM Castilla" : nombreEquipo(f.nombre)}
                    </td>
                    <td className="px-2 py-1.5 text-right text-white/70">{f.pts}</td>
                    <td className="px-2 py-1.5 text-right font-semibold text-white/90">{coma(f.media)}</td>
                    <td className="px-2 py-1.5">
                      <Horquilla f={f} color={color} />
                    </td>
                    <td className="px-2 py-1.5">
                      <Histograma h={f.hist} mediana={f.mediana} color={color} />
                    </td>
                    <Celda p={f.campeon} tono="azul" />
                    <Celda p={f.playoff} tono="azul" />
                    <Celda p={deObjetivo(f.hist)} tono="azul" />
                    <Celda p={f.descenso} tono="rojo" ultima />
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      <p className="mt-2 text-[11px] leading-snug text-white/60">
        Lo jugado, de BeSoccer; lo que queda, los cruces de ida y vuelta que faltan. Cada partido se simula con Poisson a partir del xG a favor y en
        contra por partido de cada equipo en Opta (encogido hacia la media), con el factor campo de la liga ({coma(base.campo)} goles en casa por
        cada uno fuera). Play-off: 2º a 5º; descenso: los cinco últimos. Horquilla: la línea es el 90 % de las temporadas, la caja el 50 % y el
        punto la media.{base.sinOpta.length ? ` Sin xG en Opta, con la media: ${base.sinOpta.join(", ")}.` : ""}
      </p>
    </div>
  );
}

const ANCHO = 150;
const x = (pts: number) => (Math.max(0, Math.min(TOPE, pts)) / TOPE) * ANCHO;

function Horquilla({ f, color }: { f: { p5: number; p25: number; p75: number; p95: number; media: number }; color: string }) {
  return (
    <svg width={ANCHO} height={16} viewBox={`0 0 ${ANCHO} 16`} aria-label={`Del ${f.p5} al ${f.p95}; mitad entre ${f.p25} y ${f.p75}`} className="block">
      <line x1={0} x2={ANCHO} y1={8} y2={8} style={{ stroke: "rgb(var(--rmcf-ink-rgb) / .08)" }} />
      <line x1={x(f.p5)} x2={x(f.p95)} y1={8} y2={8} strokeWidth={1.5} style={{ stroke: color }} />
      <rect x={x(f.p25)} y={4} width={Math.max(1.5, x(f.p75) - x(f.p25))} height={8} rx={2} style={{ fill: color, opacity: 0.35 }} />
      <circle cx={x(f.media)} cy={8} r={3} style={{ fill: color }} />
    </svg>
  );
}

function Histograma({ h, mediana, color }: { h: Int32Array; mediana: number; color: string }) {
  /* Barras de 2 puntos. */
  const cubos: number[] = [];
  for (let k = 0; k <= TOPE; k += 2) cubos.push(h[k] + (k + 1 <= TOPE ? h[k + 1] : 0));
  const max = Math.max(1, ...cubos);
  const w = ANCHO / cubos.length;
  const alto = 22;
  return (
    <svg width={ANCHO} height={alto} viewBox={`0 0 ${ANCHO} ${alto}`} aria-label={`Mediana ${mediana} puntos`} className="block">
      <line x1={0} x2={ANCHO} y1={alto - 0.5} y2={alto - 0.5} style={{ stroke: "rgb(var(--rmcf-ink-rgb) / .12)" }} />
      {cubos.map((c, i) =>
        c > 0 ? <rect key={i} x={i * w} y={alto - (c / max) * (alto - 2)} width={Math.max(0.8, w - 0.4)} height={(c / max) * (alto - 2)} style={{ fill: color, opacity: 0.75 }} /> : null,
      )}
      <line x1={x(mediana)} x2={x(mediana)} y1={0} y2={alto} strokeDasharray="2 2" style={{ stroke: "rgb(var(--rmcf-ink-rgb) / .7)" }} />
    </svg>
  );
}

function Celda({ p, tono, ultima }: { p: number; tono: "azul" | "rojo"; ultima?: boolean }) {
  const rgb = tono === "azul" ? "79 143 232" : "217 72 72";
  const alfa = p <= 0 ? 0 : 0.06 + 0.5 * Math.sqrt(p);
  return (
    <td className={`py-1.5 text-right text-white/90 ${ultima ? "pl-2 pr-3" : "px-2"}`} style={{ background: alfa ? `rgb(${rgb} / ${alfa.toFixed(2)})` : undefined }}>
      {pct(p)} %
    </td>
  );
}
