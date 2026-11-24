"use client";

/**
 * MAPA DE LA LIGA CON ESCUDOS: ALTURA DEFENSIVA CONTRA OCASIONES (23/11/2026,
 * idea de X). En «Rival y categoría → Un equipo de un vistazo», debajo de
 * «Ocasiones que concede».
 *
 * Cada equipo del grupo, con su escudo: a la derecha, defiende más arriba (x
 * media de sus acciones defensivas, Opta 0-100); arriba, más xG por partido
 * (a favor o, con el selector, en contra). Las rayas son la mediana de cada
 * eje, con su cifra en el extremo. El próximo rival lleva el nombre en
 * amarillo y una flecha; el Castilla, un contorno blanco. Los demás sólo
 * llevan nombre si se salen de la nube (más de 1,5 desviaciones). Debajo, los
 * equipos ya jugados que más se le parecen al próximo.
 *
 * Datos: `opta:directo:archivo` y `opta:directo:<partido>` (la misma caché que
 * «El rival por tercios»); nada se pide hasta que asoma. Cuentas en
 * `lib/data-analisis/altura-ocasiones.ts`.
 */

import { useMemo, useState } from "react";

import { useProximoRival } from "@/components/data/ClasificacionJusta";
import { tinta, useEscudos } from "@/components/data/graficas";
import { useOpta, type DatosOpta } from "@/app/opta/_piezas/useOpta";
import { nombreDe } from "@/app/opta/_piezas/eventos";
import { useAsoma } from "@/hooks/useAsoma";
import { useDocsOpta } from "@/hooks/useDocsOpta";
import { CASTILLA_OPTA, DOCS_OPTA, type TablaOpta } from "@/lib/opta";
import { casaEquipo } from "@/lib/opta-eventos";
import { leeEventos } from "@/lib/opta-directo-mapas";
import {
  CUADRANTE,
  cuadranteDe,
  lejania,
  mapaLiga,
  MAX_PARTIDOS,
  parecidos,
  puntoLiga,
  UMBRAL_NUBE,
  valorY,
  type EjeY,
  type PuntoLiga,
} from "@/lib/data-analisis/altura-ocasiones";

type PartidoArchivo = { partido?: string; fecha?: string; equipos?: string[] };
type Archivo = { partidos?: PartidoArchivo[] };
type DocDirecto = { eventos?: TablaOpta };

const coma = (v: number, d = 1) => v.toFixed(d).replace(".", ",");
const AMARILLO = "#F5D547";

export function AlturaOcasiones() {
  const { caja, abierto } = useAsoma<HTMLDivElement>(4000);
  return (
    <div ref={caja} className="min-w-0">
      {abierto && <ConOpta />}
    </div>
  );
}

function ConOpta() {
  const { datos } = useOpta();
  if (!datos?.equipos.length) return null;
  return <Indice datos={datos} />;
}

/** Los equipos del grupo y los últimos partidos de cada uno en el archivo del directo. */
function Indice({ datos }: { datos: DatosOpta }) {
  const { docs } = useDocsOpta<[Archivo]>("opta:directo:archivo");
  const [archivo] = docs;
  const proximo = useProximoRival();

  const plan = useMemo(() => {
    if (!Array.isArray(archivo?.partidos)) return null;
    const g = datos.grupos.get(CASTILLA_OPTA);
    if (g == null) return null;
    const equipos = datos.equipos.map((f) => ({ teamId: String(f.teamId ?? ""), equipo: String(f.equipo ?? "") })).filter((e) => e.teamId);
    const delGrupo = equipos.filter((e) => datos.grupos.get(e.teamId) === g);
    const partidos = archivo.partidos.filter((p) => p?.partido && (p.equipos ?? []).length >= 2);
    const nuestro = equipos.find((e) => e.teamId === CASTILLA_OPTA)?.equipo ?? "";

    const ids = new Set<string>();
    const suyos = new Map<string, string[]>();
    for (const e of delGrupo) {
      const ultimos = partidos
        .filter((p) => (p.equipos ?? []).includes(e.equipo))
        .sort((a, b) => String(b.fecha ?? "").localeCompare(String(a.fecha ?? "")))
        .slice(0, MAX_PARTIDOS)
        .map((p) => String(p.partido));
      if (!ultimos.length) continue;
      suyos.set(e.teamId, ultimos);
      ultimos.forEach((id) => ids.add(id));
    }
    /* Los que ya han jugado contra nosotros (para «se parece a…»). */
    const jugados = new Set<string>();
    for (const p of partidos) {
      const eq = p.equipos ?? [];
      if (!nuestro || !eq.includes(nuestro)) continue;
      for (const n of eq) {
        const id = delGrupo.find((e) => e.equipo === n)?.teamId;
        if (id && id !== CASTILLA_OPTA) jugados.add(id);
      }
    }
    let rivalId: string | null = null;
    if (proximo) {
      const id = casaEquipo(proximo, equipos);
      rivalId = id && id !== CASTILLA_OPTA ? id : null;
    }
    if (suyos.size < 4) return null;
    return { delGrupo, suyos, ids: [...ids], jugados, rivalId };
  }, [archivo, datos, proximo]);

  if (!plan) return null;
  return <Bloque {...plan} />;
}

function Bloque({
  delGrupo,
  suyos,
  ids,
  jugados,
  rivalId,
}: {
  delGrupo: { teamId: string; equipo: string }[];
  suyos: Map<string, string[]>;
  ids: string[];
  jugados: Set<string>;
  rivalId: string | null;
}) {
  const { docs, cargando } = useDocsOpta<DocDirecto[]>(...ids.map(DOCS_OPTA.directo));
  const [eje, setEje] = useState<EjeY>("favor");

  const puntos = useMemo(() => {
    const porId = new Map<string, { eventos: ReturnType<typeof leeEventos> }>();
    docs.forEach((d, i) => {
      const eventos = d ? leeEventos(d.eventos) : [];
      if (eventos.length) porId.set(ids[i], { eventos });
    });
    if (!porId.size) return [];
    const salida: PuntoLiga[] = [];
    for (const e of delGrupo) {
      const ps = (suyos.get(e.teamId) ?? []).map((id) => porId.get(id)).filter((p): p is NonNullable<typeof p> => p != null);
      const p = puntoLiga(ps, e.teamId, nombreDe(e.teamId, e.equipo));
      if (p) salida.push(p);
    }
    return salida;
  }, [docs, ids, delGrupo, suyos]);

  const m = useMemo(() => mapaLiga(puntos, eje), [puntos, eje]);

  if (!m) return cargando ? <p className="mt-6 text-sm text-white/50">Cargando el evento a evento de Opta…</p> : null;

  const rival = m.puntos.find((p) => p.teamId === rivalId) ?? null;
  const nuestra = m.puntos.find((p) => p.teamId === CASTILLA_OPTA) ?? null;
  const pocos = Math.min(...m.puntos.map((p) => p.partidos));
  const parecen = rival ? parecidos(rival, m, eje, jugados) : [];
  const etiquetaY = eje === "favor" ? "xG a favor por partido" : "xG en contra por partido";

  return (
    <section id="x-idea-2124838374754201660-1" aria-label="Mapa de la liga: altura defensiva contra ocasiones" className="portada-tarjeta portada-entra mt-4 min-w-0 scroll-mt-20 px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-baseline gap-x-2 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#C8A96B]">
            Mapa de la liga · altura defensiva y ocasiones
            <span className="rounded-full border border-white/15 px-2 py-0.5 text-[11px] font-semibold normal-case tracking-normal text-white/60">
              dato · Opta, evento a evento{pocos < 5 ? " · tendencia" : ""}
            </span>
          </p>
          {rival && (
            <h3 className="fuente-club mt-1.5 text-[24px] font-bold uppercase leading-[1.05] text-white sm:text-[30px]">
              {rival.equipo}: {CUADRANTE[eje][cuadranteDe(rival, m, eje)].toLowerCase()}
            </h3>
          )}
          <p className="mt-1 text-sm leading-6 text-white/70">
            {rival ? (
              <>
                El próximo rival defiende a una altura media de {coma(rival.altura)} (mediana {coma(m.medX)}) y {eje === "favor" ? "genera" : "concede"} {coma(valorY(rival, eje), 2)} xG por partido (mediana{" "}
                {coma(m.medY, 2)}).
                {nuestra && (
                  <>
                    {" "}
                    Nosotros: {coma(nuestra.altura)} y {coma(valorY(nuestra, eje), 2)}.
                  </>
                )}
                {parecen.length > 0 && <> Ya jugados que más se le parecen: {parecen.map((p) => p.equipo).join(", ")}: el plan contra ellos es el punto de partida.</>}
              </>
            ) : (
              "Cada equipo del grupo según lo arriba que defiende y cuánto xG genera o concede por partido."
            )}
          </p>
        </div>
        <label className="flex shrink-0 items-center gap-2 text-xs text-white/60">
          Eje vertical
          <select value={eje} onChange={(e) => setEje(e.target.value as EjeY)} className="rounded-lg border border-white/15 bg-white/[0.04] px-2 py-1 text-sm text-white">
            <option value="favor">xG a favor</option>
            <option value="contra">xG en contra</option>
          </select>
        </label>
      </div>

      <Dispersion m={m} eje={eje} rivalId={rival?.teamId ?? null} etiquetaY={etiquetaY} />

      <p className="mt-3 text-[11px] leading-5 text-white/45">
        Opta, evento a evento de los últimos {MAX_PARTIDOS} partidos de cada equipo del grupo. Altura defensiva = x media (0 su portería, 100 la contraria) de sus entradas, intercepciones y recuperaciones. xG por partido = suma del xG de
        los remates (a favor o del contrario, con penaltis) / partidos. Las rayas son la mediana de los equipos; sólo lleva nombre el que se sale de la nube (más de {coma(UMBRAL_NUBE)} desviaciones de las medianas). Amarillo con
        flecha, el próximo rival; con doble aro, el Castilla.
      </p>
    </section>
  );
}

/* ------------------------------------------------------------------ */

const AN = 680;
const AL = 440;
const M = { izq: 50, der: 18, arr: 22, aba: 40 };
const ESC = 24;

function Dispersion({ m, eje, rivalId, etiquetaY }: { m: NonNullable<ReturnType<typeof mapaLiga>>; eje: EjeY; rivalId: string | null; etiquetaY: string }) {
  const escudoDe = useEscudos();
  const xs = m.puntos.map((p) => p.altura);
  const ys = m.puntos.map((p) => valorY(p, eje));
  const pad = (a: number, b: number) => (b - a || 1) * 0.12;
  const [xa, xb] = [Math.min(...xs), Math.max(...xs)];
  const [ya, yb] = [Math.min(...ys), Math.max(...ys)];
  const x0 = Math.max(0, xa - pad(xa, xb));
  const x1 = Math.min(100, xb + pad(xa, xb));
  const y0 = Math.max(0, ya - pad(ya, yb));
  const y1 = yb + pad(ya, yb);
  const px = (v: number) => M.izq + ((v - x0) / (x1 - x0)) * (AN - M.izq - M.der);
  const py = (v: number) => AL - M.aba - ((v - y0) / (y1 - y0)) * (AL - M.arr - M.aba);
  const mx = px(m.medX);
  const my = py(m.medY);
  const marcas = (a: number, b: number, n: number) => Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n);

  const peso = (p: PuntoLiga) => (p.teamId === rivalId ? 2 : p.teamId === CASTILLA_OPTA ? 1 : 0);
  const orden = [...m.puntos].sort((a, b) => peso(a) - peso(b));
  const rotuloCuad = (texto: string, x: number, y: number, ancla: "start" | "end") => (
    <text x={x} y={y} textAnchor={ancla} style={{ fill: tinta(0.38), fontSize: 10.5, fontWeight: 600, letterSpacing: "0.04em" }}>
      {texto.toUpperCase()}
    </text>
  );

  return (
    <div className="mt-3 min-w-0">
      <svg viewBox={`0 0 ${AN} ${AL}`} className="block h-auto w-full" style={{ maxHeight: "65vh" }} role="img" aria-label={`Altura defensiva contra ${etiquetaY}, equipo a equipo`}>
        <defs>
          <marker id="flecha-rival-x-idea" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" style={{ fill: AMARILLO }} />
          </marker>
        </defs>

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
        <text x={(M.izq + AN - M.der) / 2} y={AL - 6} textAnchor="middle" style={{ fill: tinta(0.6), fontSize: 12 }}>Altura defensiva (x media de sus acciones defensivas) →</text>
        <text transform={`translate(13 ${(M.arr + AL - M.aba) / 2}) rotate(-90)`} textAnchor="middle" style={{ fill: tinta(0.6), fontSize: 12 }}>{etiquetaY} →</text>

        {/* Las medianas, con su cifra en el extremo. */}
        <line x1={mx} x2={mx} y1={M.arr} y2={AL - M.aba} style={{ stroke: tinta(0.45), strokeDasharray: "5 4" }} />
        <line x1={M.izq} x2={AN - M.der} y1={my} y2={my} style={{ stroke: tinta(0.45), strokeDasharray: "5 4" }} />
        <text x={mx} y={M.arr - 7} textAnchor="middle" style={{ fill: tinta(0.7), fontSize: 11, fontWeight: 700 }}>X {coma(m.medX)}</text>
        <text x={AN - M.der} y={my - 5} textAnchor="end" style={{ fill: tinta(0.7), fontSize: 11, fontWeight: 700 }}>Y {coma(m.medY, 2)}</text>

        {rotuloCuad(CUADRANTE[eje].altoMucho, AN - M.der - 6, M.arr + 14, "end")}
        {rotuloCuad(CUADRANTE[eje].altoPoco, AN - M.der - 6, AL - M.aba - 8, "end")}
        {rotuloCuad(CUADRANTE[eje].bajoMucho, M.izq + 6, M.arr + 14, "start")}
        {rotuloCuad(CUADRANTE[eje].bajoPoco, M.izq + 6, AL - M.aba - 8, "start")}

        {orden.map((p) => {
          const cx = px(p.altura);
          const cy = py(valorY(p, eje));
          const esRival = p.teamId === rivalId;
          const esNuestro = p.teamId === CASTILLA_OPTA;
          const fuera = lejania(p, m, eje) > UMBRAL_NUBE;
          const escudo = escudoDe(p.equipo);
          const derecha = cx > AN - 170;
          const tam = esRival || esNuestro ? ESC + 6 : ESC;
          /* La etiqueta del rival, encima; si no cabe arriba, debajo. */
          const arriba = cy - 34 > 22;
          const ly = arriba ? cy - 34 : cy + 44;
          const titulo = `${p.equipo} · altura ${coma(p.altura)} · ${coma(p.xgFavor, 2)} xG a favor y ${coma(p.xgContra, 2)} en contra por partido · ${p.partidos} partidos`;
          return (
            <g key={p.teamId}>
              {esNuestro && <circle cx={cx} cy={cy} r={tam / 2 + 4} style={{ fill: "none", stroke: tinta(0.9), strokeWidth: 3 }} />}
              {esNuestro && <circle cx={cx} cy={cy} r={tam / 2 + 6} style={{ fill: "none", stroke: tinta(0.5), strokeWidth: 1 }} />}
              {escudo ? (
                <image href={escudo} x={cx - tam / 2} y={cy - tam / 2} width={tam} height={tam} preserveAspectRatio="xMidYMid meet" />
              ) : (
                <circle cx={cx} cy={cy} r={esRival || esNuestro ? 7 : 5} style={{ fill: esRival ? AMARILLO : tinta(0.4) }} />
              )}
              {esRival && (
                <>
                  <line
                    x1={cx + (derecha ? -64 : 64)}
                    y1={arriba ? ly : ly - 15}
                    x2={cx + (derecha ? -tam / 2 - 2 : tam / 2 + 2)}
                    y2={arriba ? cy - tam / 2 + 2 : cy + tam / 2 - 2}
                    markerEnd="url(#flecha-rival-x-idea)"
                    style={{ stroke: AMARILLO, strokeWidth: 2 }}
                  />
                  <EtiquetaAmarilla x={cx + (derecha ? -64 : 64)} y={ly} texto={p.equipo} ancla={derecha ? "end" : "start"} />
                </>
              )}
              {!esRival && (esNuestro || fuera) && (
                <text
                  x={cx + (derecha ? -(tam / 2 + 5) : tam / 2 + 5)}
                  y={cy + 4}
                  textAnchor={derecha ? "end" : "start"}
                  style={{ fill: tinta(esNuestro ? 0.9 : 0.6), fontSize: esNuestro ? 12 : 10, fontWeight: esNuestro ? 700 : 500 }}
                >
                  {p.equipo}
                </text>
              )}
              <title>{titulo}</title>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** El nombre del próximo rival sobre fondo amarillo (se lee igual de día y de noche). */
function EtiquetaAmarilla({ x, y, texto, ancla }: { x: number; y: number; texto: string; ancla: "start" | "end" }) {
  const ancho = texto.length * 7.2 + 14;
  const izq = ancla === "start" ? x : x - ancho;
  return (
    <g>
      <rect x={izq} y={y - 15} width={ancho} height={20} rx={4} style={{ fill: AMARILLO }} />
      <text x={izq + 7} y={y} style={{ fill: "#111111", fontSize: 12, fontWeight: 700 }}>
        {texto}
      </text>
    </g>
  );
}
