"use client";

/**
 * ¿A QUÉ ALTURA TOCAN EL BALÓN LOS CENTRALES? (13/11/2026)
 *
 * Una tarjeta por partido con un campo vertical (atacamos hacia arriba) y la
 * posición media de los toques de cada central del Castilla:
 *
 * - toques = acciones del Castilla en `opta:castilla-eventos` con jugador y
 *   coordenadas (sin faltas, tarjetas ni errores, como la huella táctica);
 * - central = el puesto de la plantilla (`usePlayers`, que ya pasa por
 *   `lib/posiciones.ts`) dicho como «Central»; el nombre de Opta se cruza con
 *   la plantilla por `mismaPersona` (apellido) o el nombre entero;
 * - en cada partido cuenta el central con 10 toques o más;
 * - altura de la línea = media de las alturas medias de los centrales, en
 *   metros desde nuestra portería (x × 1,05); anchura = distancia lateral
 *   entre el más abierto a cada lado (y × 0,68).
 *
 * Casa o fuera sale del calendario de BeSoccer por la fecha (Opta no lo
 * dice). Borde verde en casa, naranja fuera; sin partido en el calendario,
 * borde neutro y no entra en las medias. Los filiales llevan su marca.
 */

import { useMemo } from "react";

import { CampoOpta } from "@/components/campo/CampoOpta";
import { Cifra, Panel } from "@/app/opta/_piezas/comun";
import { useAcciones } from "@/app/opta/_piezas/eventos";
import type { DatosOpta } from "@/app/opta/_piezas/useOpta";
import { useCalendarioCastilla } from "@/components/data/SelloJornada";
import { usePlayers } from "@/hooks/usePlayers";
import { partidoDeFecha } from "@/lib/data-analisis/alcance";
import { mismaPersona } from "@/lib/data-analisis/nombres";
import { fechaCorta } from "@/lib/opta-analisis";
import { nombrePuesto } from "@/lib/posiciones";
import { normalizePlayerName } from "@/lib/playerImages";
import type { Player } from "@/types/player";

const CASA = "#1B9E77";
const FUERA = "#E8833A";
const MIN_TOQUES = 10;
/** Lo que no es un toque de balón (marcas del registro, no acciones). */
const NO_ES_TOQUE = new Set(["Error", "Foul", "Card", "OffsideProvoked"]);

/** Filial: termina en B, C o II, o es uno de los nombres propios de filial. */
const FILIAL = /(\s(b|c|ii)$)|madrile[nñ]o|promesas|sanse|bilbao athletic|atl[eè]tic$/;
const esFilial = (rival: string) =>
  FILIAL.test(rival.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[.]/g, " ").replace(/\s+/g, " ").trim());

const esCentral = (p: Player) => /\bcentral\b|\bdfc\b/i.test(nombrePuesto(p.posicion));

const metros = (v: number) => `${v.toFixed(1).replace(".", ",")} m`;
const conSigno = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(1).replace(".", ",")} m`;

type Central = { nombre: string; corto: string; dorsal?: number; x: number; y: number; toques: number };
type Partido = {
  partido: string;
  fecha: string;
  rival: string;
  filial: boolean;
  /** null = no está en el calendario. */
  enCasa: boolean | null;
  centrales: Central[];
  /** Metros desde nuestra portería. */
  altura: number;
  /** Metros entre los dos más abiertos (null con un solo central). */
  anchura: number | null;
};

export function AlturaCentrales({ datos }: { datos: DatosOpta }) {
  const { acciones, cargando } = useAcciones(datos);
  const { players } = usePlayers();
  const calendario = useCalendarioCastilla();

  const centrales = useMemo(() => players.filter(esCentral), [players]);

  const partidos = useMemo<Partido[]>(() => {
    if (!centrales.length) return [];
    /* Nombre de Opta → central de la plantilla (o null), resuelto una vez. */
    const cruce = new Map<string, Player | null>();
    const deQuien = (nombre: string) => {
      if (cruce.has(nombre)) return cruce.get(nombre)!;
      const n = normalizePlayerName(nombre);
      const p = centrales.find((c) => normalizePlayerName(c.nombre) === n || (c.apodo && normalizePlayerName(c.apodo) === n)) ?? centrales.find((c) => mismaPersona(c.nombre, nombre)) ?? null;
      cruce.set(nombre, p);
      return p;
    };

    const m = new Map<string, { fecha: string; rival: string; suma: Map<string, { p: Player; x: number; y: number; n: number }> }>();
    for (const a of acciones) {
      if (!a.nuestra || !a.jugador || NO_ES_TOQUE.has(a.tipo)) continue;
      if (!Number.isFinite(a.x) || !Number.isFinite(a.y) || (a.x === 0 && a.y === 0)) continue;
      const p = deQuien(a.jugador);
      if (!p) continue;
      let pa = m.get(a.partido);
      if (!pa) m.set(a.partido, (pa = { fecha: a.fecha, rival: a.rival, suma: new Map() }));
      let s = pa.suma.get(p.nombre);
      if (!s) pa.suma.set(p.nombre, (s = { p, x: 0, y: 0, n: 0 }));
      s.x += a.x;
      s.y += a.y;
      s.n++;
    }

    const salida: Partido[] = [];
    for (const [partido, pa] of m) {
      const lista: Central[] = [...pa.suma.values()]
        .filter((s) => s.n >= MIN_TOQUES)
        .map((s) => ({
          nombre: s.p.nombre,
          corto: (s.p.apodo || s.p.nombre).split(" ").slice(-1)[0],
          dorsal: s.p.dorsal,
          x: s.x / s.n,
          y: s.y / s.n,
          toques: s.n,
        }))
        .sort((a, b) => b.y - a.y);
      if (!lista.length) continue;
      const cal = calendario ? partidoDeFecha(calendario.partidos, pa.fecha.slice(0, 10)) : null;
      const ys = lista.map((c) => c.y);
      salida.push({
        partido,
        fecha: pa.fecha,
        rival: pa.rival,
        filial: esFilial(pa.rival),
        enCasa: cal ? /castilla/i.test(cal.local) : null,
        centrales: lista,
        altura: (lista.reduce((t, c) => t + c.x, 0) / lista.length) * 1.05,
        anchura: lista.length > 1 ? (Math.max(...ys) - Math.min(...ys)) * 0.68 : null,
      });
    }
    return salida.sort((a, b) => b.fecha.localeCompare(a.fecha));
  }, [acciones, centrales, calendario]);

  const resumen = useMemo(() => {
    const de = (lista: Partido[]) => {
      const anchos = lista.filter((p) => p.anchura != null);
      return {
        n: lista.length,
        altura: lista.length ? lista.reduce((t, p) => t + p.altura, 0) / lista.length : null,
        anchura: anchos.length ? anchos.reduce((t, p) => t + (p.anchura ?? 0), 0) / anchos.length : null,
      };
    };
    return {
      casa: de(partidos.filter((p) => p.enCasa === true)),
      fuera: de(partidos.filter((p) => p.enCasa === false)),
      filial: de(partidos.filter((p) => p.filial)),
      resto: de(partidos.filter((p) => !p.filial)),
    };
  }, [partidos]);

  if (cargando || !partidos.length) return null;

  const difCasaFuera = resumen.casa.altura != null && resumen.fuera.altura != null ? resumen.fuera.altura - resumen.casa.altura : null;
  const difFilial = resumen.filial.n && resumen.resto.n && resumen.filial.altura != null && resumen.resto.altura != null ? resumen.filial.altura - resumen.resto.altura : null;

  const detalle = (r: { n: number; anchura: number | null }) =>
    `${r.n} ${r.n === 1 ? "partido" : "partidos"}${r.anchura != null ? ` · ${metros(r.anchura)} entre ellos` : ""}`;

  return (
    <div className="mt-6">
      <Panel
        titulo="¿A qué altura tocan el balón los centrales?"
        subtitulo={`Posición media de los toques de cada central del Castilla (${MIN_TOQUES} o más en el partido), atacando hacia arriba. Altura en metros desde nuestra portería; anchura, la distancia lateral entre ellos. Borde verde en casa, naranja fuera.`}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {resumen.casa.altura != null && (
            <Cifra rotulo="Media en casa" valor={metros(resumen.casa.altura)} detalle={detalle(resumen.casa)} color={CASA} />
          )}
          {resumen.fuera.altura != null && (
            <Cifra
              rotulo="Media fuera"
              valor={metros(resumen.fuera.altura)}
              detalle={`${detalle(resumen.fuera)}${difCasaFuera != null ? ` · ${conSigno(difCasaFuera)} frente a casa` : ""}`}
              color={FUERA}
            />
          )}
        </div>

        {difFilial != null && Math.abs(difFilial) >= 0.5 && (
          <p className="mt-3 text-[12px] text-white/75">
            Contra filiales ({resumen.filial.n}) tocan {difFilial > 0 ? "más arriba" : "más abajo"} que contra el resto: {metros(resumen.filial.altura!)} frente a{" "}
            {metros(resumen.resto.altura!)} ({conSigno(difFilial)}).
          </p>
        )}

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {partidos.map((p) => (
            <article
              key={p.partido}
              className={`min-w-0 rounded-xl border-2 bg-white/[0.03] p-2 ${p.enCasa == null ? "border-white/10" : ""}`}
              style={p.enCasa == null ? undefined : { borderColor: p.enCasa ? CASA : FUERA }}
            >
              <header className="mb-1 flex items-start justify-between gap-1">
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-semibold text-white" title={p.rival}>
                    {p.rival}
                  </p>
                  <p className="text-[10px] text-white/55">
                    {fechaCorta(p.fecha)} · {p.enCasa == null ? "sin calendario" : p.enCasa ? "casa" : "fuera"}
                  </p>
                </div>
                {p.filial && (
                  <span className="shrink-0 rounded-full border border-white/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white/70">
                    Filial
                  </span>
                )}
              </header>

              <CampoOpta vertical ariaLabel={`Centrales del Castilla contra ${p.rival}`} maxAlto={240} className="mx-auto">
                {(proyecta) => {
                  const [, yLinea] = proyecta(p.altura / 1.05, 50);
                  const puntos = p.centrales.map((c) => ({ c, xy: proyecta(c.x, c.y) }));
                  return (
                    <g>
                      <line x1={0} x2={680} y1={yLinea} y2={yLinea} style={{ stroke: "rgba(255,255,255,0.55)", strokeWidth: 4, strokeDasharray: "18 12", pointerEvents: "none" }} />
                      {puntos.length > 1 && (
                        <line
                          x1={puntos[0].xy[0]}
                          y1={puntos[0].xy[1]}
                          x2={puntos[puntos.length - 1].xy[0]}
                          y2={puntos[puntos.length - 1].xy[1]}
                          style={{ stroke: "rgba(255,255,255,0.8)", strokeWidth: 5 }}
                        />
                      )}
                      {puntos.map(({ c, xy: [cx, cy] }) => (
                        <g key={c.nombre}>
                          <circle cx={cx} cy={cy} r={34} style={{ fill: "#FEBE10", stroke: "#0B1220", strokeWidth: 5 }} />
                          <text x={cx} y={cy + 12} textAnchor="middle" style={{ fill: "#0B1220", fontSize: 34, fontWeight: 700 }}>
                            {c.dorsal ?? c.corto.slice(0, 2)}
                          </text>
                          <title>{`${c.nombre}: ${metros(c.x * 1.05)} de altura, ${c.toques} toques`}</title>
                        </g>
                      ))}
                    </g>
                  );
                }}
              </CampoOpta>

              <p className="mt-1 text-[11px] tabular-nums text-white/75">
                Altura <span className="font-semibold text-white">{metros(p.altura)}</span>
                {p.anchura != null && (
                  <>
                    {" · "}Anchura <span className="font-semibold text-white">{metros(p.anchura)}</span>
                  </>
                )}
              </p>
              <p className="truncate text-[10px] text-white/50" title={p.centrales.map((c) => `${c.nombre} (${c.toques})`).join(", ")}>
                {p.centrales.map((c) => c.corto).join(" · ")}
              </p>
            </article>
          ))}
        </div>
      </Panel>
    </div>
  );
}
