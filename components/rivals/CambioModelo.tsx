"use client";

/**
 * ¿HA CAMBIADO SU MODELO? (Scout colectivo, 17/11/2026): PPDA y pases por
 * partido del rival, jornada a jornada, con la media móvil de 5, y los últimos
 * 5 partidos contra el resto de la temporada con los puntos de cada bloque.
 * Para preparar al rival de ahora y no a su media de temporada.
 *
 * Datos: `opta:partidos` por `useOptaLigero`, cruzado con `casaEquipo` como en
 * «Evolución comparada». Las cuentas, en `lib/rivals/cambio-modelo.ts`. Si no
 * cruza o no hay dato, no se pinta. Nada se pide hasta que asoma.
 */

import { useMemo } from "react";

import { COMPARADO, tinta } from "@/components/data/graficas";
import { useOptaLigero } from "@/hooks/useOptaLigero";
import { useAsoma } from "@/hooks/useAsoma";
import { CASTILLA_OPTA } from "@/lib/opta";
import { casaEquipo } from "@/lib/opta-eventos";
import { fechaCorta } from "@/lib/opta-analisis";
import { partidosPorEquipo } from "@/lib/opta-evolucion";
import { chipInk } from "@/lib/theme";
import { UMBRAL_PASES, UMBRAL_PPDA, VENTANA, cambioDeModelo, type Bloque, type PartidoModelo } from "@/lib/rivals/cambio-modelo";

const dec = (v: number, d = 1) => v.toFixed(d).replace(".", ",");
const signo = (v: number, d = 1) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${dec(Math.abs(v), d)}`;

const REACTIVO = "#F59E0B";
const PROTAGONISTA = "#34D399";

export function CambioModelo({ equipo }: { equipo: string }) {
  const { caja, abierto } = useAsoma<HTMLDivElement>(2000);

  return <div ref={caja} className="min-w-0">{abierto && <Contenido equipo={equipo} />}</div>;
}

function Contenido({ equipo }: { equipo: string }) {
  const { opta } = useOptaLigero();

  const datos = useMemo(() => {
    if (!opta) return null;
    const equipos = opta.equipos.map((f) => ({ teamId: String(f.teamId ?? ""), equipo: String(f.equipo ?? "") }));
    const rivalId = casaEquipo(equipo, equipos);
    if (!rivalId || rivalId === CASTILLA_OPTA) return null;
    const nombre = equipos.find((e) => e.teamId === rivalId)?.equipo || equipo;
    const cambio = cambioDeModelo(partidosPorEquipo(opta.partidos).get(rivalId) ?? []);
    return cambio ? { cambio, nombre } : null;
  }, [opta, equipo]);

  if (!datos) return null;
  const { cambio, nombre } = datos;
  const { serie, ultimos, resto, difPpda, difPases, etiqueta } = cambio;

  const titular = !resto
    ? `Con ${serie.length} ${serie.length === 1 ? "partido" : "partidos"} todavía no hay un «antes» con el que comparar los últimos ${VENTANA}.`
    : etiqueta === "más reactivo"
      ? `${nombre} se ha vuelto más reactivo: en los últimos ${ultimos.partidos} presiona menos y tiene menos el balón que en el resto de la temporada. Preparar al de ahora, no al de su media.`
      : etiqueta === "más protagonista"
        ? `${nombre} se ha vuelto más protagonista: en los últimos ${ultimos.partidos} aprieta más arriba y tiene más el balón que en el resto de la temporada. Preparar al de ahora, no al de su media.`
        : `${nombre} juega igual que en el resto de la temporada: ni el PPDA ni los pases se mueven a la vez lo bastante como para hablar de otro modelo.`;

  const color = etiqueta === "más reactivo" ? REACTIVO : PROTAGONISTA;

  return (
    <section id="x-idea-2122305355028074817-1" aria-label="¿Ha cambiado su modelo?" className="portada-tarjeta portada-entra mt-8 min-w-0 px-4 py-4 sm:px-5">
      <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#C8A96B]">
        ¿Ha cambiado su modelo?
        <span className="rounded-full border border-white/15 px-2 py-0.5 text-[11px] font-semibold normal-case tracking-normal text-white/60">
          dato · Opta, {serie.length} {serie.length === 1 ? "partido" : "partidos"} suyos
        </span>
      </p>
      {/* Como el original de X («Tendencias del equipo»): el equipo, su etiqueta en una píldora y cada cambio «antes → ahora» en una ficha con su flecha. */}
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <h3 className="fuente-club text-[26px] font-bold uppercase leading-[1.05] text-white sm:text-[32px]">
          {!resto ? nombre : etiqueta ? `${nombre}, ${etiqueta}` : `${nombre} juega igual`}
        </h3>
        {etiqueta && (
          <span
            className="rounded-full border px-2.5 py-0.5 text-[12px] font-bold uppercase tracking-[0.08em]"
            style={{ color: chipInk(color), borderColor: chipInk(color), background: `${color}1A` }}
          >
            {etiqueta}
          </span>
        )}
      </div>
      <p className="mt-1 text-sm leading-6 text-white/70">{titular}</p>
      {resto && (
        <ul className="mt-2.5 flex flex-wrap gap-2" aria-label={`Últimos ${ultimos.partidos} frente al resto de la temporada`}>
          <Ficha
            nombre="PPDA (presión)"
            antes={resto.ppda}
            ahora={ultimos.ppda}
            d={1}
            marcado={difPpda != null && Math.abs(difPpda) > UMBRAL_PPDA}
            color={difPpda != null && difPpda > 0 ? REACTIVO : PROTAGONISTA}
          />
          <Ficha
            nombre="Pases"
            antes={resto.pases}
            ahora={ultimos.pases}
            d={0}
            marcado={difPases != null && Math.abs(difPases) > UMBRAL_PASES}
            color={difPases != null && difPases < 0 ? REACTIVO : PROTAGONISTA}
          />
          {ultimos.conMarcador > 0 && resto.conMarcador > 0 && (
            <Ficha nombre="Puntos por partido" antes={resto.puntos / resto.conMarcador} ahora={ultimos.puntos / ultimos.conMarcador} d={2} marcado={false} color={PROTAGONISTA} />
          )}
        </ul>
      )}

      <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-white/60">
        <span className="inline-flex items-center gap-1.5">
          <svg width="10" height="10" aria-hidden className="shrink-0"><circle cx="5" cy="5" r="3" style={{ fill: tinta(0.45) }} /></svg>
          Cada partido
        </span>
        <span className="inline-flex items-center gap-1.5">
          <svg width="22" height="8" aria-hidden className="shrink-0"><line x1="1" y1="4" x2="21" y2="4" style={{ stroke: COMPARADO, strokeWidth: 2.5 }} /></svg>
          Media de los últimos {VENTANA}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-4 rounded-sm" style={{ background: tinta(0.08) }} aria-hidden />
          Bloque de los últimos {VENTANA}
        </span>
      </p>

      <div className="mt-3 grid min-w-0 gap-3 md:grid-cols-2">
        <Curva titulo="PPDA por partido" nota="menos es más presión" serie={serie} k="ppda" decimales={1} />
        <Curva titulo="Pases por partido" nota="más es más balón" serie={serie} k="pases" decimales={0} />
      </div>

      {/* La tabla repetía las fichas y las curvas (20/11/2026, jueces de fútbol): queda plegada, como la cuenta. */}
      {resto && (
        <details className="mt-3 min-w-0 rounded-xl border border-white/10 bg-white/[0.02]">
          <summary className="cursor-pointer select-none px-3 py-2 text-[13px] font-semibold text-white/65">Cómo se cuenta</summary>
          <div className="min-w-0 overflow-x-auto">
          <table className="w-full min-w-[420px] text-left text-[12px] tabular-nums">
            <thead>
              <tr className="text-[11px] uppercase tracking-[0.12em] text-white/55">
                <th className="px-3 py-2 font-semibold">Bloque</th>
                <th className="px-3 py-2 font-semibold">PPDA</th>
                <th className="px-3 py-2 font-semibold">Pases</th>
                <th className="px-3 py-2 font-semibold">Puntos</th>
              </tr>
            </thead>
            <tbody className="text-white/80">
              <FilaBloque nombre={`Últimos ${ultimos.partidos}`} b={ultimos} fuerte />
              <FilaBloque nombre={`Resto (${resto.partidos})`} b={resto} />
              <tr className="border-t border-white/10">
                <td className="px-3 py-2 font-semibold text-white">Diferencia</td>
                <td className="px-3 py-2 font-bold" style={difPpda != null && Math.abs(difPpda) > UMBRAL_PPDA ? { color: chipInk(difPpda > 0 ? REACTIVO : PROTAGONISTA) } : undefined}>
                  {difPpda != null ? signo(difPpda) : ""}
                </td>
                <td className="px-3 py-2 font-bold" style={difPases != null && Math.abs(difPases) > UMBRAL_PASES ? { color: chipInk(difPases < 0 ? REACTIVO : PROTAGONISTA) } : undefined}>
                  {difPases != null ? `${signo(difPases * 100, 0)} %` : ""}
                </td>
                <td className="px-3 py-2 font-bold">
                  {ultimos.conMarcador && resto.conMarcador ? `${signo(ultimos.puntos / ultimos.conMarcador - resto.puntos / resto.conMarcador, 2)} por partido` : ""}
                </td>
              </tr>
            </tbody>
          </table>
          <p className="border-t border-white/10 px-3 py-2 text-[11px] leading-5 text-white/55">
            «Más reactivo» si el PPDA sube más de {UMBRAL_PPDA} y los pases bajan más de un {UMBRAL_PASES * 100} %; «más protagonista», al revés. Media de los partidos de cada bloque.
          </p>
          </div>
        </details>
      )}
    </section>
  );
}

/** Una ficha «▲ PPDA 8,7 → 13,8»: el resto de la temporada y los últimos partidos. Sin color si el cambio no pasa el umbral. */
function Ficha({ nombre, antes, ahora, d, marcado, color }: { nombre: string; antes: number | null; ahora: number | null; d: number; marcado: boolean; color: string }) {
  if (antes == null || ahora == null) return null;
  const flecha = ahora > antes ? "▲" : ahora < antes ? "▼" : "=";
  return (
    <li
      className="inline-flex items-baseline gap-1.5 rounded-full border px-3 py-1 text-[13px] tabular-nums"
      style={marcado ? { color: chipInk(color), borderColor: chipInk(color), background: `${color}14` } : { color: tinta(0.75), borderColor: tinta(0.2) }}
    >
      <span aria-hidden>{flecha}</span>
      <span className="font-semibold">{nombre}</span>
      <span className="fuente-club text-[15px] font-bold">
        {dec(antes, d)} → {dec(ahora, d)}
      </span>
    </li>
  );
}

function FilaBloque({ nombre, b, fuerte = false }: { nombre: string; b: Bloque; fuerte?: boolean }) {
  return (
    <tr className="border-t border-white/10">
      <td className={`px-3 py-2 ${fuerte ? "font-semibold text-white" : ""}`}>{nombre}</td>
      <td className="px-3 py-2">{b.ppda != null ? dec(b.ppda) : ""}</td>
      <td className="px-3 py-2">{b.pases != null ? dec(b.pases, 0) : ""}</td>
      <td className="px-3 py-2">
        {b.conMarcador ? `${b.puntos} (${dec(b.puntos / b.conMarcador, 2)} por partido)` : ""}
      </td>
    </tr>
  );
}

const W = 340;
const H = 170;
const M = { izq: 32, der: 12, arriba: 18, abajo: 22 };

function Curva({ titulo, nota, serie, k, decimales }: { titulo: string; nota: string; serie: PartidoModelo[]; k: "ppda" | "pases"; decimales: number }) {
  const km = k === "ppda" ? "ppdaMovil" : "pasesMovil";
  const n = serie.length;
  const valores = serie.flatMap((p) => [p[k], p[km]]).filter((v): v is number => v != null);
  if (!n || !valores.length) return null;

  let lo = Math.min(...valores);
  let hi = Math.max(...valores);
  const rango = hi - lo || 1;
  lo = Math.max(0, lo - rango * 0.1);
  hi += rango * 0.1;
  const ancho = W - M.izq - M.der;
  const alto = H - M.arriba - M.abajo;
  const xDe = (i: number) => (n === 1 ? M.izq + ancho / 2 : M.izq + (i / (n - 1)) * ancho);
  const yDe = (v: number) => M.arriba + (1 - (v - lo) / (hi - lo)) * alto;
  const marcas = [lo, (lo + hi) / 2, hi];
  const cada = Math.max(1, Math.ceil(n / 10));

  let d = "";
  let suelto = true;
  serie.forEach((p, i) => {
    const v = p[km];
    if (v == null) {
      suelto = true;
      return;
    }
    d += `${suelto ? "M" : "L"} ${xDe(i).toFixed(1)} ${yDe(v).toFixed(1)} `;
    suelto = false;
  });

  /* El bloque de los últimos 5, sombreado. */
  const desde = Math.max(0, n - VENTANA);
  const xIni = n === 1 ? M.izq : desde === 0 ? M.izq : (xDe(desde - 1) + xDe(desde)) / 2;

  return (
    <figure className="portada-celda m-0 min-w-0 p-3">
      <figcaption className="mb-1 flex flex-wrap items-baseline justify-between gap-x-2">
        <span className="text-[13px] font-semibold text-white">{titulo}</span>
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">{nota}</span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="grafico-cabe block h-auto w-full" role="img" aria-label={`${titulo} jornada a jornada y su media de los últimos ${VENTANA}`}>
        <rect x={xIni} y={M.arriba} width={W - M.der - xIni} height={alto} style={{ fill: tinta(0.06) }} />
        {marcas.map((m, i) => (
          <g key={i}>
            <line x1={M.izq} x2={W - M.der} y1={yDe(m)} y2={yDe(m)} style={{ stroke: tinta(0.08), strokeWidth: 1 }} />
            <text x={M.izq - 4} y={yDe(m) + 3} textAnchor="end" style={{ fill: tinta(0.55), fontSize: 11 }}>
              {dec(m, decimales)}
            </text>
          </g>
        ))}
        {serie.map((p, i) =>
          i % cada === 0 || i === n - 1 ? (
            <text key={`j${p.jornada}`} x={xDe(i)} y={H - 6} textAnchor="middle" style={{ fill: tinta(0.55), fontSize: 11 }}>
              J{p.jornada}
            </text>
          ) : null,
        )}
        {d && <path d={d.trim()} pathLength={1} className="idea-trazo" style={{ fill: "none", stroke: COMPARADO, strokeWidth: 2.75, strokeLinejoin: "round", strokeLinecap: "round" }} />}
        {serie.map((p, i) => {
          const v = p[k];
          const reciente = i >= desde;
          return v == null ? null : (
            <g key={`p${p.jornada}`}>
              <circle cx={xDe(i)} cy={yDe(v)} r={reciente ? 3.25 : 2.75} style={{ fill: reciente ? tinta(0.8) : tinta(0.4), stroke: "var(--portada-sup)", strokeWidth: 1 }}>
                <title>{`J${p.jornada} · ${fechaCorta(p.fecha)}${p.rival ? ` · ${p.rival}` : ""}: ${dec(v, decimales)}${p[km] != null ? ` (media de 5: ${dec(p[km]!, decimales)})` : ""}`}</title>
              </circle>
              {/* Como el original de X, la cifra de cada partido; aquí sólo en el bloque de los últimos, para que se lea. */}
              {reciente && (
                <text x={xDe(i)} y={yDe(v) - 6} textAnchor="middle" className="fuente-club" style={{ fill: tinta(0.85), fontSize: 11.5, fontWeight: 700 }}>
                  {dec(v, decimales)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </figure>
  );
}
