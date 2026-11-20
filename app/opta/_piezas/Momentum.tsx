"use client";

/**
 * MOMENTUM (09/11/2026): quién manda en cada tramo de 5′ de un partido,
 * con `opta:momento` (xG y toques en el área de cada equipo por tramo) y los
 * goles de `opta:remates` en el eje. La cuenta, en `curvaMomento`
 * (`lib/opta-eventos.ts`).
 *
 * - `Momentum`: la curva de un partido, vista desde `teamId` (arriba él,
 *   abajo el rival). Va en la ficha del partido del Castilla.
 * - `PartidosCategoria`: cualquier partido de la categoría, con el cara a
 *   cara de las cifras (`CaraACara`, de FichaPartido.tsx), su curva y los
 *   mapas de remate de los dos equipos (pestaña «Partidos»).
 */

import { useMemo, useState } from "react";
import Link from "next/link";

import { COMPARADO, ORO, tinta } from "@/components/data/graficas";
import { useEnlaceClipOpta } from "@/hooks/useCortesOpta";
import { CASTILLA_OPTA } from "@/lib/opta";
import { fechaCorta, partidosDe } from "@/lib/opta-analisis";
import { curvaMomento, segundoEnEje, type MedidaMomento, type Remate } from "@/lib/opta-eventos";

import { Botonera, Elegir, Panel } from "./comun";
import { equiposDe, nombreDe, useMomento, useRemates } from "./eventos";
import { CaraACara } from "./FichaPartido";
import { MapaRemates } from "./Remates";
import type { DatosOpta } from "./useOpta";

const MEDIDAS: { clave: MedidaMomento; nombre: string }[] = [
  { clave: "mezcla", nombre: "xG y toques en el área" },
  { clave: "xG", nombre: "Sólo xG" },
  { clave: "toques", nombre: "Sólo toques en el área" },
];

const W = 900;
const H = 300;
/* Arriba y abajo, dos alturas de rótulo de gol: dos goles seguidos del mismo equipo no se pisan. */
const M = { izq: 12, der: 12, arriba: 40, abajo: 58 };
const SEPARA_ROTULOS = 90;
/** La ficha de un jugador del Castilla (`/individual` casa el nombre de Opta por apellido). */
const fichaDe = (nombre: string) => `/individual?nombre=${encodeURIComponent(nombre)}`;

export function Momentum({
  datos,
  partido,
  teamId,
  conGoleadores = true,
}: {
  datos: DatosOpta;
  partido: string;
  teamId: string;
  /** 18/11/2026 (ronda 22): la línea «Goles del Castilla» de debajo; el post del partido ya los lista con sus remates. */
  conGoleadores?: boolean;
}) {
  const { momento, cargando } = useMomento();
  const { remates } = useRemates(datos);
  const clip = useEnlaceClipOpta();
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
  /* Si un rótulo cae muy cerca del anterior de su mismo lado, sube (o baja) un piso. */
  const niveles: number[] = [];
  const ultimo: Record<"a" | "b", { x: number; nivel: number } | null> = { a: null, b: null };
  goles.forEach((g, i) => {
    const x = xDe(Math.min(n, segundoEnEje(g.parte, g.segundo) / 300));
    const lado = golDe(g);
    const previo = ultimo[lado];
    const nivel = previo && Math.abs(x - previo.x) < SEPARA_ROTULOS ? 1 - previo.nivel : 0;
    niveles[i] = nivel;
    ultimo[lado] = { x, nivel };
  });
  /*
  | 18/11/2026 (ronda 22, análisis y marketing): «11′ Fortuny» pisaba
  | «▲ Arriba, Real Madrid Castilla». Cada rótulo de equipo va en el extremo,
  | izquierdo o derecho, más alejado de los goles de su lado (los de arriba
  | sólo pueden chocar con los goles de arriba, y lo mismo abajo).
  */
  const rotuloA = `▲ Arriba, ${nombreA}`;
  const rotuloB = `▼ Abajo, ${nombreB}`;
  const sitioRotulo = (lado: "a" | "b", texto: string) => {
    const largo = texto.length * 7.8 + 16;
    const xs = goles.filter((g) => golDe(g) === lado).map((g) => xDe(Math.min(n, segundoEnEje(g.parte, g.segundo) / 300)));
    const libreIzq = Math.min(Infinity, ...xs.map((x) => Math.max(0, x - (M.izq + largo))));
    const libreDer = Math.min(Infinity, ...xs.map((x) => Math.max(0, W - M.der - largo - x)));
    const izquierda = !xs.length || libreIzq >= libreDer;
    return { x: izquierda ? M.izq + 8 : W - M.der - 8, ancla: izquierda ? ("start" as const) : ("end" as const) };
  };
  const sitioA = sitioRotulo("a", rotuloA);
  const sitioB = sitioRotulo("b", rotuloB);
  const tramoEncima = encima != null ? curva[encima] : null;
  /*
  | 20/11/2026 (ronda 4, marketing de Análisis de datos): la conclusión en el
  | titular del gráfico: quién mandó en más tramos y quién en la 2.ª parte.
  */
  const conclusion = (() => {
    const umbral = tope * 0.1;
    const cuenta = (lista: typeof curva) => ({ a: lista.filter((t) => t.valor > umbral).length, b: lista.filter((t) => t.valor < -umbral).length });
    const todo = cuenta(curva);
    const segunda = cuenta(curva.filter((t) => t.tramo >= 9));
    const quien = (c: { a: number; b: number }) => (c.a === c.b ? null : c.a > c.b ? nombreA : nombreB);
    const manda = quien(todo);
    if (!manda) return "repartido";
    const tras = quien(segunda);
    return `${manda}, en ${Math.max(todo.a, todo.b)} de ${n} tramos${tras && tras !== manda ? `; en la 2.ª parte, ${tras}` : ""}`;
  })();
  const ta = encima != null ? ea.tramos.get(encima) : undefined;
  const tb = encima != null ? eb.tramos.get(encima) : undefined;

  return (
    <div className="mt-5 min-w-0 border-t border-white/10 pt-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-white">Quién manda en cada tramo: {conclusion}</h3>
          <p className="text-xs text-white/55">
            Por tramos de 5′, suavizado con los de al lado. Arriba, <span style={{ color: ORO }}>{nombreA}</span>; abajo, <span style={{ color: COMPARADO }}>{nombreB}</span>. xG{" "}
            {suma(ea, "xG").toFixed(1).replace(".", ",")} – {suma(eb, "xG").toFixed(1).replace(".", ",")} · toques en el área {suma(ea, "toquesArea")} – {suma(eb, "toquesArea")}.
          </p>
        </div>
        <Botonera etiqueta="Qué se mide" valor={medida} alCambiar={setMedida} opciones={MEDIDAS} />
      </div>
      {/* 10/11/2026: a 390 px la letra del dibujo bajaba de 5 px; con un ancho
          mínimo se lee a 11 px y se desliza de lado dentro de su caja. */}
      <div className="-mx-1 overflow-x-auto px-1">
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full min-w-[720px]" role="img" aria-label={`Momentum del partido ${nombreA} contra ${nombreB}`} onMouseLeave={() => setEncima(null)}>
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
              <text x={xDe(m / 5)} y={H - 8} textAnchor="middle" style={{ fill: tinta(0.5), fontSize: 14 }}>
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
          const x = xDe(Math.min(n, segundoEnEje(g.parte, g.segundo) / 300));
          const arriba = golDe(g) === "a";
          const nivel = niveles[i] ?? 0;
          const y = arriba ? M.arriba - 14 - nivel * 15 : H - M.abajo + 16 + nivel * 15;
          return (
            <g key={i}>
              <line x1={x} y1={cero} x2={x} y2={arriba ? M.arriba - 4 : H - M.abajo + 4} style={{ stroke: arriba ? ORO : COMPARADO, strokeWidth: 1.5, strokeDasharray: "2 3" }} />
              {/* 18/11/2026: el gol abre su vídeo (nuestro corte de B2 o ProVision en ese segundo). */}
              <a href={clip(g, "shots")} target="_blank" rel="noopener noreferrer" style={{ cursor: "pointer" }}>
                <circle cx={x} cy={cero} r={7} style={{ fill: arriba ? ORO : COMPARADO, stroke: tinta(0.9), strokeWidth: 1.5 }}>
                  <title>{`Gol · ${g.minuto}′ · ${g.tirador}${g.tipo === "PenaltyGoal" ? " (penalti)" : ""} · pincha: vídeo`}</title>
                </circle>
              </a>
              {/* 17/11/2026 (ronda 21, marketing): el goleador del Castilla lleva a su ficha. */}
              {g.teamId === CASTILLA_OPTA && g.tirador ? (
                <a href={fichaDe(g.tirador)} aria-label={`Ficha de ${g.tirador}`}>
                  <text x={x} y={y} textAnchor="middle" style={{ fill: ORO, fontSize: 14, fontWeight: 700, textDecoration: "underline" }}>
                    {`${g.minuto}′ ${g.tirador.split(" ").slice(-1)[0]}`}
                  </text>
                </a>
              ) : (
                <text x={x} y={y} textAnchor="middle" style={{ fill: tinta(0.75), fontSize: 14, fontWeight: 600 }}>
                  {`${g.minuto}′ ${g.tirador.split(" ").slice(-1)[0]}`}
                </text>
              )}
            </g>
          );
        })}

        {/* 17/11/2026 (ronda 21, marketing): quién va arriba y quién abajo, rotulado sobre el propio gráfico. */}
        <text x={sitioA.x} y={M.arriba + 16} textAnchor={sitioA.ancla} style={{ fill: ORO, fontSize: 13, fontWeight: 700, paintOrder: "stroke", stroke: "var(--rmcf-surface, #11161C)", strokeWidth: 4 }}>
          {rotuloA}
        </text>
        <text x={sitioB.x} y={H - M.abajo - 8} textAnchor={sitioB.ancla} style={{ fill: COMPARADO, fontSize: 13, fontWeight: 700, paintOrder: "stroke", stroke: "var(--rmcf-surface, #11161C)", strokeWidth: 4 }}>
          {rotuloB}
        </text>

        {/* La superficie que se pasa: un tramo cada franja. */}
        {curva.map((t) => (
          <rect key={t.tramo} x={M.izq + t.tramo * paso} y={M.arriba} width={paso} height={alto} style={{ fill: encima === t.tramo ? tinta(0.06) : "transparent" }} onMouseEnter={() => setEncima(t.tramo)} />
        ))}
      </svg>
      </div>
      {/* Los goleadores del Castilla, con su ficha y su seguimiento a un toque. */}
      {conGoleadores && goles.some((g) => g.teamId === CASTILLA_OPTA && g.tirador) && (
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/65">
          <span className="font-semibold text-white/75">Goles del Castilla:</span>
          {goles
            .filter((g) => g.teamId === CASTILLA_OPTA && g.tirador)
            .map((g, i) => (
              <span key={`${g.minuto}-${i}`} className="inline-flex items-center gap-1.5">
                {g.minuto}′
                <Link href={fichaDe(g.tirador)} className="font-semibold text-[#C8A96B] underline-offset-2 hover:underline">
                  {g.tirador}
                </Link>
                <Link href={`${fichaDe(g.tirador)}&pestana=seguimiento`} className="text-white/60 underline underline-offset-2 hover:text-white">
                  su seguimiento
                </Link>
              </span>
            ))}
        </p>
      )}
      {tramoEncima && (
        <p className="mt-1 text-xs text-white/65">
          {`${tramoEncima.tramo * 5}′–${tramoEncima.tramo * 5 + 5}′ · ${nombreA}: xG ${(ta?.xG ?? 0).toFixed(1).replace(".", ",")}, ${ta?.remates ?? 0} remates, ${ta?.toquesArea ?? 0} toques en el área${ta?.posesion != null ? `, ${Math.round(ta.posesion * 100)} % de posesión` : ""} · ${nombreB}: xG ${(tb?.xG ?? 0).toFixed(1).replace(".", ",")}, ${tb?.remates ?? 0} remates, ${tb?.toquesArea ?? 0} toques en el área`}
        </p>
      )}
    </div>
  );
}

/** Cualquier partido de la categoría: la curva y los remates de los dos. */
/** `inicial`: el equipo con el que se abre (el próximo rival, si se sabe). */
export function PartidosCategoria({ datos, inicial }: { datos: DatosOpta; inicial?: string }) {
  const equipos = useMemo(() => equiposDe(datos), [datos]);
  const [elegidoEquipo, setTeamId] = useState<string | null>(null);
  const teamId = elegidoEquipo ?? inicial ?? CASTILLA_OPTA;
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
        {visto && <CaraACara datos={datos} partido={partido} teamId={teamId} conAbp />}
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
