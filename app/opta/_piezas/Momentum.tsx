"use client";

/**
 * MOMENTUM (09/11/2026): quién manda en cada tramo de 5′ de un partido,
 * con `opta:momento` (xG y toques en el área de cada equipo por tramo) y los
 * goles de `opta:remates` en el eje. La cuenta, en `curvaMomento`
 * (`lib/opta-eventos.ts`).
 *
 * - `Momentum`: la curva de un partido, vista desde `teamId` (arriba él,
 *   abajo el rival). Va en la ficha del partido del Castilla.
 * - `PartidosCategoria`: cualquier partido de la categoría, con su curva y
 *   los mapas de remate de los dos equipos (pestaña «Partidos»).
 */

import { useMemo, useState } from "react";

import { COMPARADO, ORO, tinta } from "@/components/data/graficas";
import { CASTILLA_OPTA } from "@/lib/opta";
import { fechaCorta, partidosDe } from "@/lib/opta-analisis";
import { curvaMomento, type MedidaMomento, type Remate } from "@/lib/opta-eventos";

import { Botonera, Elegir, Panel } from "./comun";
import { equiposDe, nombreDe, useMomento, useRemates } from "./eventos";
import { MapaRemates } from "./Remates";
import type { DatosOpta } from "./useOpta";

const MEDIDAS: { clave: MedidaMomento; nombre: string }[] = [
  { clave: "mezcla", nombre: "xG y toques en el área" },
  { clave: "xG", nombre: "Sólo xG" },
  { clave: "toques", nombre: "Sólo toques en el área" },
];

const W = 900;
const H = 240;
const M = { izq: 12, der: 12, arriba: 34, abajo: 34 };

export function Momentum({ datos, partido, teamId }: { datos: DatosOpta; partido: string; teamId: string }) {
  const { momento, cargando } = useMomento();
  const { remates } = useRemates(datos);
  const [medida, setMedida] = useState<MedidaMomento>("mezcla");
  const [encima, setEncima] = useState<number | null>(null);

  const p = momento.get(partido);
  const curva = useMemo(() => (p ? curvaMomento(p, teamId, medida) : []), [p, teamId, medida]);
  const goles = useMemo(() => remates.filter((r) => r.partido === partido && r.gol), [remates, partido]);

  if (cargando) return <div className="mt-4 h-48 animate-pulse rounded-2xl bg-white/[0.05]" role="status" aria-label="Cargando el momentum" />;
  if (!p || curva.length < 4) return null;

  const ea = p.equipos.find((e) => e.teamId === teamId)!;
  const eb = p.equipos.find((e) => e.teamId !== teamId)!;
  const nombreA = nombreDe(ea.teamId, ea.equipo);
  const nombreB = nombreDe(eb.teamId, eb.equipo);
  const n = curva.length;
  const ancho = W - M.izq - M.der;
  const alto = H - M.arriba - M.abajo;
  const cero = M.arriba + alto / 2;
  const tope = Math.max(0.35, ...curva.map((t) => Math.abs(t.valor)));
  const xDe = (tramos: number) => M.izq + (tramos / n) * ancho;
  const yDe = (v: number) => cero - (v / tope) * (alto / 2);
  const paso = ancho / n;

  /* El área, partida en dos: por encima del cero la del equipo, por debajo la del rival. */
  const puntos = curva.map((t) => [xDe(t.tramo + 0.5), yDe(t.valor)] as const);
  const linea = puntos.map(([x, y], i) => `${i ? "L" : "M"} ${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const area = `M ${xDe(0.5)} ${cero} ${puntos.map(([x, y]) => `L ${x.toFixed(1)} ${y.toFixed(1)}`).join(" ")} L ${xDe(n - 0.5)} ${cero} Z`;
  const idA = `mom-a-${partido}`;
  const idB = `mom-b-${partido}`;

  const suma = (e: typeof ea, k: "xG" | "toquesArea") => [...e.tramos.values()].reduce((s, t) => s + t[k], 0);
  const golDe = (r: Remate) => (r.teamId === teamId ? "a" : "b");
  const tramoEncima = encima != null ? curva[encima] : null;
  const ta = encima != null ? ea.tramos.get(encima) : undefined;
  const tb = encima != null ? eb.tramos.get(encima) : undefined;

  return (
    <div className="mt-5 min-w-0 border-t border-white/10 pt-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-white">Quién manda en cada tramo</h3>
          <p className="text-[11px] text-white/55">
            Por tramos de 5′, suavizado con los de al lado. Arriba, <span style={{ color: ORO }}>{nombreA}</span>; abajo, <span style={{ color: COMPARADO }}>{nombreB}</span>. xG{" "}
            {suma(ea, "xG").toFixed(2).replace(".", ",")} – {suma(eb, "xG").toFixed(2).replace(".", ",")} · toques en el área {suma(ea, "toquesArea")} – {suma(eb, "toquesArea")}.
          </p>
        </div>
        <Botonera etiqueta="Qué se mide" valor={medida} alCambiar={setMedida} opciones={MEDIDAS} />
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={`Momentum del partido ${nombreA} contra ${nombreB}`} onMouseLeave={() => setEncima(null)}>
        <defs>
          <clipPath id={idA}>
            <rect x={0} y={0} width={W} height={cero} />
          </clipPath>
          <clipPath id={idB}>
            <rect x={0} y={cero} width={W} height={H - cero} />
          </clipPath>
        </defs>
        {/* El descanso y las marcas de 15′. */}
        {[15, 30, 45, 60, 75, 90].map((m) =>
          m / 5 <= n ? (
            <g key={m}>
              <line x1={xDe(m / 5)} y1={M.arriba} x2={xDe(m / 5)} y2={H - M.abajo} style={{ stroke: tinta(m === 45 ? 0.3 : 0.1), strokeWidth: m === 45 ? 1.5 : 1, strokeDasharray: m === 45 ? "4 4" : undefined }} />
              <text x={xDe(m / 5)} y={H - 8} textAnchor="middle" style={{ fill: tinta(0.5), fontSize: 11 }}>
                {m === 45 ? "Descanso" : `${m}′`}
              </text>
            </g>
          ) : null,
        )}
        <path d={area} clipPath={`url(#${idA})`} style={{ fill: ORO, fillOpacity: 0.55 }} />
        <path d={area} clipPath={`url(#${idB})`} style={{ fill: COMPARADO, fillOpacity: 0.5 }} />
        <path d={linea} style={{ fill: "none", stroke: tinta(0.55), strokeWidth: 1.5 }} />
        <line x1={M.izq} y1={cero} x2={W - M.der} y2={cero} style={{ stroke: tinta(0.45), strokeWidth: 1 }} />

        {/* Los goles, en el eje: los suyos arriba y los del rival abajo. */}
        {goles.map((g, i) => {
          const x = xDe(Math.min(n, g.segundo / 300));
          const arriba = golDe(g) === "a";
          const y = arriba ? M.arriba - 12 : H - M.abajo + 12;
          return (
            <g key={i}>
              <line x1={x} y1={cero} x2={x} y2={arriba ? M.arriba - 4 : H - M.abajo + 4} style={{ stroke: arriba ? ORO : COMPARADO, strokeWidth: 1.5, strokeDasharray: "2 3" }} />
              <circle cx={x} cy={cero} r={6} style={{ fill: arriba ? ORO : COMPARADO, stroke: tinta(0.9), strokeWidth: 1.5 }}>
                <title>{`Gol · ${g.minuto}′ · ${g.tirador}${g.tipo === "PenaltyGoal" ? " (penalti)" : ""}`}</title>
              </circle>
              <text x={x} y={y} textAnchor="middle" style={{ fill: tinta(0.75), fontSize: 11, fontWeight: 600 }}>
                {`${g.minuto}′ ${g.tirador.split(" ").slice(-1)[0]}`}
              </text>
            </g>
          );
        })}

        {/* La superficie que se pasa: un tramo cada franja. */}
        {curva.map((t) => (
          <rect key={t.tramo} x={M.izq + t.tramo * paso} y={M.arriba} width={paso} height={alto} style={{ fill: encima === t.tramo ? tinta(0.06) : "transparent" }} onMouseEnter={() => setEncima(t.tramo)} />
        ))}
      </svg>
      {tramoEncima && (
        <p className="mt-1 text-[11px] text-white/65">
          {`${tramoEncima.tramo * 5}′–${tramoEncima.tramo * 5 + 5}′ · ${nombreA}: xG ${(ta?.xG ?? 0).toFixed(2).replace(".", ",")}, ${ta?.remates ?? 0} remates, ${ta?.toquesArea ?? 0} toques en el área${ta?.posesion != null ? `, ${Math.round(ta.posesion * 100)} % de posesión` : ""} · ${nombreB}: xG ${(tb?.xG ?? 0).toFixed(2).replace(".", ",")}, ${tb?.remates ?? 0} remates, ${tb?.toquesArea ?? 0} toques en el área`}
        </p>
      )}
    </div>
  );
}

/** Cualquier partido de la categoría: la curva y los remates de los dos. */
export function PartidosCategoria({ datos }: { datos: DatosOpta }) {
  const equipos = useMemo(() => equiposDe(datos), [datos]);
  const [teamId, setTeamId] = useState(CASTILLA_OPTA);
  const suyos = useMemo(() => partidosDe(datos.partidos, teamId).filter((p) => p.otra), [datos.partidos, teamId]);
  const [elegido, setElegido] = useState("");
  const visto = suyos.find((p) => String(p.fila.partido) === elegido) ?? suyos[suyos.length - 1];
  const { remates, cargando } = useRemates(datos);
  const partido = visto ? String(visto.fila.partido) : "";
  const delPartido = useMemo(() => remates.filter((r) => r.partido === partido), [remates, partido]);

  const nombre = nombreDe(teamId, equipos.find((e) => e.teamId === teamId)?.equipo ?? "");

  return (
    <div className="mt-6 space-y-4">
      <Panel
        titulo="Un partido de la categoría"
        subtitulo={visto ? `${fechaCorta(visto.fecha)} · ${nombre} ${visto.gf ?? ""}-${visto.gc ?? ""} ${visto.rival}` : undefined}
        derecha={
          <>
            <Elegir
              etiqueta="Equipo"
              valor={teamId}
              alCambiar={(v) => {
                setTeamId(v);
                setElegido("");
              }}
              opciones={equipos.map((e) => ({ clave: e.teamId, nombre: e.equipo }))}
            />
            {suyos.length > 0 && (
              <Elegir
                etiqueta="Partido"
                valor={partido}
                alCambiar={setElegido}
                opciones={[...suyos].reverse().map((p) => ({ clave: String(p.fila.partido), nombre: `${fechaCorta(p.fecha)} · ${p.rival} (${p.gf ?? ""}-${p.gc ?? ""})` }))}
              />
            )}
          </>
        }
      >
        {visto && <Momentum datos={datos} partido={partido} teamId={teamId} />}

        {!cargando && delPartido.length > 0 && visto && (
          <div className="mt-5 grid gap-5 border-t border-white/10 pt-4 lg:grid-cols-2">
            {[
              { id: teamId, n: nombre },
              { id: visto.rivalId, n: nombreDe(visto.rivalId, visto.rival) },
            ].map((lado) => {
              const rs = delPartido.filter((r) => r.teamId === lado.id);
              return (
                <div key={lado.id} className="min-w-0">
                  <h3 className="mb-2 text-sm font-semibold text-white">Remates de {lado.n}</h3>
                  {rs.length ? <MapaRemates remates={rs} ariaLabel={`Remates de ${lado.n} en el partido`} maxAlto={360} /> : <p className="text-sm text-white/55">No remató.</p>}
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
}
