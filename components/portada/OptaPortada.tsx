"use client";

/**
 * OPTA EN LA PORTADA (10/11/2026): una tarjeta para el día a día.
 *
 * - **Frente a frente**: el próximo rival (calendario de BeSoccer, cruzado
 *   con Opta por `casaEquipo`, como en 11 metros) y el Castilla en cuatro
 *   cifras por partido con su puesto en el grupo: xG a favor, xG en contra,
 *   PPDA y xG a balón parado. Si el rival no casa con Opta o no es del
 *   grupo, sale sólo el Castilla.
 * - **El último partido**: resultado, xG de los dos y el momentum en
 *   miniatura (la curva de `curvaMomento`, la misma de «Análisis de datos»).
 *
 * 10/11/2026 (expertos): la base en el título («11 partidos»), «puesto en el
 * grupo» como cabecera de la columna, «xG» y «PPDA» explicados la primera vez
 * y el balón parado marcado como tendencia (pocos remates por partido). El
 * último partido enseña de entrada remates y PPDA de los dos (vienen en
 * `opta:partidos`, ya cargado); el momentum se suma debajo cuando llega y,
 * mientras tanto o si no hay serie, no se dibuja caja ninguna.
 *
 * Sólo documentos ligeros al abrir la portada (`opta:meta`, `opta:equipos`,
 * `opta:partidos`, ≈0,5 MB, compartidos con «Análisis de datos»). El momento (≈1 MB) se
 * pide cuando la tarjeta entra en pantalla, no antes; sin remates, ni ABP
 * evento a evento, ni acciones del Castilla. Mientras carga, la tarjeta ya
 * tiene su alto: no empuja la portada.
 */

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, Database } from "lucide-react";

import { COMPARADO, ORO, colorPercentil, tinta } from "@/components/data/graficas";
import { useProximoRival } from "@/hooks/useAbpLigas";
import { useDocsOpta } from "@/hooks/useDocsOpta";
import { useOptaLigero } from "@/hooks/useOptaLigero";
import { trackModuleVisit } from "@/lib/module-usage";
import { CASTILLA_OPTA, DOCS_OPTA, type TablaOpta } from "@/lib/opta";
import { NOMBRE_CASTILLA, fechaCorta, nombreEquipo, partidosDe, valorPartido, type PartidoEquipo } from "@/lib/opta-analisis";
import { UMBRAL_DOMINIO } from "@/lib/opta-estilos";
import { curvaMomento, momentoDe } from "@/lib/opta-eventos";
import { contextoGrupo, equipoOptaDe, hastaElPartido, type FilaLab, type MetricaLab } from "@/lib/opta-laboratorio";
import { SelloFuente } from "@/components/ui/SelloFuente";

/** Lo que se lee bajo el nombre de cada fila: la sigla explicada y el sentido. */
const AYUDA: Record<string, string> = {
  ExpG: "goles esperados · más es mejor",
  ExpGAg: "goles esperados que concede · menos es mejor",
  PPDA: "pases que deja dar antes de presionar · menos es más presión",
  xGSetPly: "tendencia: pocos remates por partido",
};

/** Las cuatro de la tarjeta, todas por partido. */
const CLAVE: MetricaLab[] = [
  { a: "ExpG", nombre: "xG a favor", comoLeer: "Goles esperados de sus remates, por partido." },
  { a: "ExpGAg", nombre: "xG en contra", comoLeer: "Goles esperados de los remates que le hacen, por partido." },
  { a: "PPDA", nombre: "PPDA", comoLeer: "Pases que deja dar al rival por cada acción defensiva: cuanto más bajo, más presiona." },
  { a: "xGSetPly", nombre: "xG a balón parado", comoLeer: "Goles esperados de sus remates a balón parado (sin penaltis), por partido." },
];

const coma = (v: number, d: number) => v.toFixed(d).replace(".", ",");
const valorTexto = (x: FilaLab) => (x.pos.valor == null ? "" : coma(x.pos.valor, x.a === "PPDA" ? 1 : 2));

export function OptaPortada() {
  const { opta, cargando } = useOptaLigero();
  const proximo = useProximoRival();

  const nuestro = useMemo(() => (opta ? contextoGrupo(opta.equipos, opta.grupos, CASTILLA_OPTA, CLAVE, opta.catalogo) : []), [opta]);
  const idRival = useMemo(() => (opta && proximo ? equipoOptaDe(proximo, opta.equipos) : null), [opta, proximo]);
  const suyo = useMemo(
    () =>
      opta && idRival && idRival !== CASTILLA_OPTA && opta.grupos.get(idRival) === opta.grupos.get(CASTILLA_OPTA)
        ? contextoGrupo(opta.equipos, opta.grupos, idRival, CLAVE, opta.catalogo)
        : [],
    [opta, idRival],
  );
  const rival = useMemo(() => {
    const f = opta?.equipos.find((e) => e.teamId === idRival);
    return f && suyo.length ? nombreEquipo(f) : "";
  }, [opta, idRival, suyo]);
  const ultimo = useMemo(() => (opta ? partidosDe(opta.partidos, CASTILLA_OPTA).at(-1) ?? null : null), [opta]);

  if (cargando) {
    /* El alto de la tarjeta de verdad (cabecera y cuerpo): que la portada no salte al llegar. */
    return (
      <div role="status" aria-label="Cargando las cifras de Opta">
        <div className="h-8 w-56 animate-pulse rounded-xl bg-white/[0.05]" />
        <div className="mt-5 h-[300px] animate-pulse rounded-3xl border border-white/[0.08] bg-[#07121F]" />
      </div>
    );
  }
  if (!opta || !nuestro.length) return null;

  const hasta = hastaElPartido(opta.meta, opta.partidos);
  const deCuantos = nuestro[0]?.pos.deCuantos ?? 0;
  const jugados = partidosDe(opta.partidos, CASTILLA_OPTA).length;

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#D8B45A]/25 bg-[#D8B45A]/[0.08]">
            <Database className="h-4 w-4 text-[#D8B45A]" />
          </span>
          <h2 className="fuente-club text-[20px] font-bold uppercase tracking-[0.08em] text-white/85">
            Opta de un vistazo
            {jugados > 0 ? <span className="text-white/55"> · {jugados} {jugados === 1 ? "partido" : "partidos"}</span> : null}
          </h2>
        </div>
        {/* 10/11/2026: el sello de la fuente (`lib/fuentes.ts`); «puesto en el grupo» va de cabecera de la tabla. */}
        <p className="flex flex-wrap items-center gap-2 text-[12px] text-white/50">
          <SelloFuente fuente="opta" poblacion={`grupo (${deCuantos} equipos)`} hasta={hasta ? `hasta el ${hasta}` : undefined} />
        </p>
      </div>

      <div className={`mt-5 grid min-w-0 gap-px overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.06] ${ultimo ? "lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]" : ""}`}>
        {/* ---------- frente a frente ---------- */}
        <Link
          href="/data-analisis?area=estilos"
          onClick={() => trackModuleVisit("/data-analisis")}
          className="group min-w-0 bg-[#07121F] p-5 transition-colors duration-300 hover:bg-[#0B1728]"
          title="Los estilos de la categoría: dominio, peligro y solidez de cada equipo"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#D8B45A]">{rival ? "Frente a frente · por partido" : "El Castilla · por partido"}</p>
          <table className="mt-3 w-full table-fixed text-left tabular-nums">
            <thead>
              <tr className="text-[11px] text-white/55">
                <th className="w-[38%] pb-1.5 pr-2 align-bottom text-[11px] font-medium leading-tight text-white/55">por partido · puesto en el grupo</th>
                <th className="pb-1.5 pr-2 text-right font-semibold">
                  <span className="block truncate" style={{ color: ORO }}>Castilla</span>
                </th>
                {rival ? (
                  <th className="pb-1.5 text-right font-semibold">
                    <span className="block truncate" style={{ color: COMPARADO }} title={rival}>
                      {rival}
                    </span>
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {nuestro.map((x) => {
                const r = suyo.find((s) => s.a === x.a);
                return (
                  <tr key={x.a} className="border-t border-white/[0.06]" title={x.comoLeer}>
                    <td className="py-2 pr-2 align-top text-[12.5px] leading-tight text-white/75">
                      {x.nombre}
                      {AYUDA[x.a] ? (
                        <span className="mt-0.5 block text-[11px] leading-snug text-white/55">{AYUDA[x.a]}</span>
                      ) : x.mejor === false ? (
                        <span className="block text-[11px] text-white/55">menos es mejor</span>
                      ) : null}
                    </td>
                    <Celda x={x} />
                    {rival ? r ? <Celda x={r} /> : <td /> : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-3 flex items-center gap-1 text-[12px] font-medium text-white/55 transition-colors duration-300 group-hover:text-[#D8B45A]">
            Opta · estilos de la categoría
            <ChevronRight className="h-3 w-3 transition-transform duration-300 group-hover:translate-x-0.5" />
          </p>
        </Link>

        {/* ---------- el último partido ---------- */}
        {ultimo ? <UltimoPartido ultimo={ultimo} /> : null}
      </div>
    </div>
  );
}

function Celda({ x }: { x: FilaLab }) {
  const color = x.mejor === null ? tinta(0.55) : colorPercentil(x.pos.percentil);
  return (
    <td className="py-2 pr-2 text-right align-top last:pr-0">
      <span className="block text-[17px] font-semibold leading-none text-white">{valorTexto(x)}</span>
      {x.pos.puesto ? (
        <span className="mt-1 block text-[11px] font-semibold" style={{ color }} title={`Puesto ${x.pos.puesto} de ${x.pos.deCuantos} del grupo, del mejor al peor`}>
          {x.pos.puesto}º/{x.pos.deCuantos}
        </span>
      ) : null}
    </td>
  );
}

/* ------------------------------------------------------------------ */
/*  El último partido, con su momentum en miniatura                    */
/* ------------------------------------------------------------------ */

function UltimoPartido({ ultimo }: { ultimo: PartidoEquipo }) {
  const caja = useRef<HTMLAnchorElement>(null);
  const [aLaVista, setALaVista] = useState(false);

  /* El momento pesa ≈1 MB: se pide al asomar la tarjeta, no al abrir la portada. */
  useEffect(() => {
    const el = caja.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      const id = setTimeout(() => setALaVista(true), 0);
      return () => clearTimeout(id);
    }
    const io = new IntersectionObserver(
      (vistos) => {
        if (vistos.some((v) => v.isIntersecting)) {
          setALaVista(true);
          io.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const xgA = typeof ultimo.fila.ExpG === "number" ? ultimo.fila.ExpG : null;
  const xgB = typeof ultimo.otra?.ExpG === "number" ? ultimo.otra.ExpG : null;
  const marcador = ultimo.gf != null && ultimo.gc != null ? `${ultimo.gf}-${ultimo.gc}` : "";

  /* Remates y PPDA de los dos, del mismo `opta:partidos` que ya está cargado. */
  const filas = (
    [
      ["Remates", "ShtIncBl", 0, "bloqueados incluidos"],
      ["PPDA", "PPDA", 1, "menos es más presión"],
    ] as const
  )
    .map(([nombre, a, d, ayuda]) => {
      const nos = valorPartido(ultimo.fila, a);
      const ellos = ultimo.otra ? valorPartido(ultimo.otra, a) : null;
      return nos != null && ellos != null ? { nombre, ayuda, nos: coma(nos, d), ellos: coma(ellos, d) } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  return (
    <Link
      ref={caja}
      href="/data-analisis?area=post"
      onClick={() => trackModuleVisit("/data-analisis")}
      className="group flex min-w-0 flex-col bg-[#07121F] p-5 transition-colors duration-300 hover:bg-[#0B1728]"
      title="El post del partido"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#D8B45A]">El último partido · {fechaCorta(ultimo.fecha)}</p>
      <p className="mt-2 truncate text-[15px] font-semibold text-white">
        {NOMBRE_CASTILLA} {marcador ? <span className="tabular-nums">{marcador}</span> : "·"} {ultimo.rival}
      </p>
      {xgA != null && xgB != null ? (
        <p className="mt-0.5 text-[12px] text-white/65 tabular-nums">
          xG {coma(xgA, 2)} – {coma(xgB, 2)}
        </p>
      ) : null}

      {filas.length ? (
        <dl className="mt-3 grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-3 gap-y-1.5 text-[12.5px] tabular-nums">
          <span />
          <span className="text-right text-[11px] font-semibold" style={{ color: ORO }}>Castilla</span>
          <span className="max-w-[7rem] truncate text-right text-[11px] font-semibold" style={{ color: COMPARADO }} title={ultimo.rival}>
            {ultimo.rival}
          </span>
          {filas.map((x) => (
            <div key={x.nombre} className="contents">
              <dt className="min-w-0 text-white/75">
                {x.nombre} <span className="text-[11px] text-white/50">· {x.ayuda}</span>
              </dt>
              <dd className="text-right font-semibold text-white">{x.nos}</dd>
              <dd className="text-right font-semibold text-white">{x.ellos}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {aLaVista ? <Curva partido={String(ultimo.fila.partido ?? "")} rival={ultimo.rival} /> : null}

      <p className="mt-auto flex items-center gap-1 pt-3 text-[12px] font-medium text-white/55 transition-colors duration-300 group-hover:text-[#D8B45A]">
        Opta · el Castilla, partido a partido
        <ChevronRight className="h-3 w-3 transition-transform duration-300 group-hover:translate-x-0.5" />
      </p>
    </Link>
  );
}

const W = 320;
const H = 88;

function Curva({ partido, rival }: { partido: string; rival: string }) {
  const { docs, cargando } = useDocsOpta<[TablaOpta]>(DOCS_OPTA.momento);
  const p = useMemo(() => momentoDe(docs[0]).get(partido), [docs, partido]);
  const curva = useMemo(() => (p ? curvaMomento(p, CASTILLA_OPTA, "mezcla") : []), [p]);

  /* Sin caja mientras llega ni si no hay serie: nada de hueco a la vista. */
  if (cargando || curva.length < 4) return null;

  const n = curva.length;
  const cero = H / 2;
  const tope = Math.max(0.35, ...curva.map((t) => Math.abs(t.valor)));
  const xDe = (t: number) => (t / n) * W;
  const yDe = (v: number) => cero - (v / tope) * (H / 2 - 4);
  const puntos = curva.map((t) => [xDe(t.tramo + 0.5), yDe(t.valor)] as const);
  const area = `M ${xDe(0.5)} ${cero} ${puntos.map(([x, y]) => `L ${x.toFixed(1)} ${y.toFixed(1)}`).join(" ")} L ${xDe(n - 0.5)} ${cero} Z`;
  const nuestros = curva.filter((t) => t.valor > UMBRAL_DOMINIO).length;
  const suyos = curva.filter((t) => t.valor < -UMBRAL_DOMINIO).length;
  const id = `opta-portada-${partido}`;

  return (
    <div className="mt-3 min-w-0">
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-[88px] w-full" preserveAspectRatio="none" role="img" aria-label={`Momentum del partido contra ${rival}: arriba el Castilla, abajo el rival`}>
        <defs>
          <clipPath id={`${id}-a`}>
            <rect x={0} y={0} width={W} height={cero} />
          </clipPath>
          <clipPath id={`${id}-b`}>
            <rect x={0} y={cero} width={W} height={H - cero} />
          </clipPath>
        </defs>
        {/* El descanso. */}
        {9 <= n ? <line x1={xDe(9)} y1={2} x2={xDe(9)} y2={H - 2} style={{ stroke: tinta(0.3), strokeWidth: 1, strokeDasharray: "3 3" }} /> : null}
        <path d={area} clipPath={`url(#${id}-a)`} style={{ fill: ORO, fillOpacity: 0.6 }} />
        <path d={area} clipPath={`url(#${id}-b)`} style={{ fill: COMPARADO, fillOpacity: 0.55 }} />
        <line x1={0} y1={cero} x2={W} y2={cero} style={{ stroke: tinta(0.4), strokeWidth: 1 }} />
      </svg>
      <p className="mt-1.5 text-[11.5px] leading-snug text-white/60">
        Tramos de 5′ en que aprieta cada uno: <span style={{ color: ORO }}>Castilla {nuestros}</span> · <span style={{ color: COMPARADO }}>{rival} {suyos}</span>, de {n}. Arriba el
        Castilla, abajo el rival; la raya, el descanso.
      </p>
    </div>
  );
}
