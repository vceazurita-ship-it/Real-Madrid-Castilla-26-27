"use client";

/**
 * MAPAS DE REMATE (09/11/2026): cada remate de `opta:remates` en su sitio,
 * con el tamaño por su xG y el color por cómo acabó.
 *
 * - `MapaRemates`: el dibujo y su resumen (xG por remate, a puerta, xGOT−xG).
 * - `RematesEquipo`: un equipo de la categoría, a favor o en contra, con
 *   filtros por situación, parte del cuerpo y jugador, y la tabla de quién
 *   remata. Va en la pestaña «Remates» (cualquier equipo) y en «Castilla».
 * - `RematesJugador`: los de un jugador, para su ficha.
 */

import { useMemo, useState } from "react";

import { CampoOpta, SOBRE_CESPED } from "@/components/campo/CampoOpta";
import { CASTILLA_OPTA } from "@/lib/opta";
import { fechaCorta, type Fila } from "@/lib/opta-analisis";
import { CUERPO, MARCADOR, PRESION, resumenRemates, SITUACION, TIPO_REMATE, type Remate } from "@/lib/opta-eventos";

import { Botonera, Cifra, Elegir, Panel } from "./comun";
import { conSigno, dec, equiposDe, nombreDe, pct, useRemates } from "./eventos";
import type { DatosOpta } from "./useOpta";

const colorRemate = (r: Remate) => (r.gol ? SOBRE_CESPED.gol : r.tipo === "Post" ? SOBRE_CESPED.palo : r.aPuerta ? SOBRE_CESPED.puerta : "transparent");
const radio = (xG: number) => 7 + Math.sqrt(Math.max(0, xG)) * 40;

export function Leyenda() {
  const punto = (fondo: string, borde?: string) => (
    <span aria-hidden className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: fondo, boxShadow: borde ? `inset 0 0 0 1.5px ${borde}` : undefined }} />
  );
  return (
    <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-white/55">
      <span className="inline-flex items-center gap-1.5">{punto(SOBRE_CESPED.gol)}Gol</span>
      <span className="inline-flex items-center gap-1.5">{punto(SOBRE_CESPED.puerta)}A puerta (parado)</span>
      <span className="inline-flex items-center gap-1.5">{punto(SOBRE_CESPED.palo)}Al palo</span>
      <span className="inline-flex items-center gap-1.5">{punto("transparent", "rgb(var(--rmcf-ink-rgb) / 0.5)")}Fuera o bloqueado</span>
      <span>El tamaño, el xG del remate.</span>
    </p>
  );
}

function textoRemate(r: Remate, conTirador = true) {
  return [
    `${r.minuto}′`,
    conTirador ? r.tirador : "",
    TIPO_REMATE[r.tipo] ?? r.tipo,
    `xG ${dec(r.xG)}`,
    r.aPuerta && r.xGOT > 0 ? `xGOT ${dec(r.xGOT)}` : "",
    CUERPO[r.cuerpo] ?? "",
    SITUACION[r.situacion] ?? "",
    r.presion ? `presión ${(PRESION[r.presion] ?? r.presion).toLowerCase()}` : "",
    r.asistente ? `pase de ${r.asistente}` : "",
    MARCADOR[r.marcador] ? MARCADOR[r.marcador].toLowerCase() : "",
    `${fechaCorta(r.fecha)} contra ${nombreDe(r.rivalId, r.rival)}`,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function MapaRemates({
  remates,
  ariaLabel,
  conTirador = true,
  enContra = false,
  maxAlto = 440,
}: {
  remates: Remate[];
  ariaLabel: string;
  conTirador?: boolean;
  /** En contra, el tirador es del rival: el texto lo dice así. */
  enContra?: boolean;
  maxAlto?: number;
}) {
  const [elegido, setElegido] = useState<Remate | null>(null);
  const r = resumenRemates(remates);
  /* Los grandes debajo y los goles encima: que ninguno tape a otro entero. */
  const orden = useMemo(() => [...remates].sort((a, b) => Number(a.gol) - Number(b.gol) || b.xG - a.xG), [remates]);
  const visto = elegido && remates.includes(elegido) ? elegido : null;

  return (
    <div className="min-w-0">
      <div className="grid gap-2 sm:grid-cols-4">
        <Cifra rotulo="Remates" valor={String(r.remates)} detalle={r.partidos ? `${dec(r.remates / r.partidos, 1)} por partido` : undefined} />
        <Cifra rotulo={enContra ? "Goles encajados" : "Goles"} valor={String(r.goles)} detalle={`xG ${dec(r.xG, 1)} · ${conSigno(r.golesMenosXG, 1)}`} />
        <Cifra rotulo="xG por remate" valor={dec(r.xGPorRemate)} detalle={r.pctPuerta != null ? `${pct(r.pctPuerta)} a puerta` : undefined} />
        {r.xGOTmenosXG != null && (
          <Cifra
            rotulo="xGOT − xG"
            valor={conSigno(r.xGOTmenosXG)}
            detalle={enContra ? "de los suyos a puerta: + es que nos golpean bien" : "de los remates a puerta: + es buen golpeo"}
          />
        )}
      </div>

      <div className="mt-3">
        <CampoOpta vertical mitad ariaLabel={ariaLabel} maxAlto={maxAlto}>
          {(p) =>
            orden.map((s, i) => {
              const [cx, cy] = p(s.x, s.y);
              const color = colorRemate(s);
              const marcado = visto === s;
              return (
                <circle
                  key={i}
                  cx={cx}
                  cy={cy}
                  r={radio(s.xG)}
                  onClick={() => setElegido(marcado ? null : s)}
                  style={{
                    fill: color,
                    fillOpacity: s.gol ? 0.95 : 0.7,
                    stroke: marcado ? "#FFFFFF" : color === "transparent" ? SOBRE_CESPED.fuera : "rgba(0,0,0,0.45)",
                    strokeWidth: marcado ? 5 : 2.5,
                    cursor: "pointer",
                  }}
                >
                  <title>{textoRemate(s, conTirador)}</title>
                </circle>
              );
            })
          }
        </CampoOpta>
      </div>
      <Leyenda />
      {visto && <p className="mt-1.5 text-[12px] text-white/75">{textoRemate(visto, conTirador)}</p>}
    </div>
  );
}

type Situacion = "todas" | "juego" | "abp" | "penalti";
const SITUACIONES: { clave: Situacion; nombre: string }[] = [
  { clave: "todas", nombre: "Todas" },
  { clave: "juego", nombre: "Juego" },
  { clave: "abp", nombre: "Balón parado" },
  { clave: "penalti", nombre: "Penaltis" },
];
const enSituacion = (r: Remate, s: Situacion) =>
  s === "todas" ||
  (s === "penalti" ? r.situacion === "Penalty" : s === "juego" ? r.situacion === "Open play" || r.situacion === "Fastbreak/Counter" : r.situacion !== "Penalty" && r.situacion !== "Open play" && r.situacion !== "Fastbreak/Counter");

type Cuerpo = "todos" | "pie" | "cabeza";
const CUERPOS: { clave: Cuerpo; nombre: string }[] = [
  { clave: "todos", nombre: "Todos" },
  { clave: "pie", nombre: "Con el pie" },
  { clave: "cabeza", nombre: "De cabeza" },
];

type Lado = "favor" | "contra";

export function RematesEquipo({ datos, teamId: fijo, titulo }: { datos: DatosOpta; teamId?: string; titulo?: string }) {
  const { remates, cargando, hay } = useRemates(datos);
  const equipos = useMemo(() => equiposDe(datos), [datos]);
  const [elegidoEquipo, setEquipo] = useState(CASTILLA_OPTA);
  const teamId = fijo ?? elegidoEquipo;
  const [lado, setLado] = useState<Lado>("favor");
  const [situacion, setSituacion] = useState<Situacion>("todas");
  const [cuerpo, setCuerpo] = useState<Cuerpo>("todos");
  const [jugador, setJugador] = useState("");

  const delLado = useMemo(() => remates.filter((r) => (lado === "favor" ? r.teamId === teamId : r.rivalId === teamId)), [remates, teamId, lado]);
  const filtrados = useMemo(
    () =>
      delLado.filter(
        (r) =>
          enSituacion(r, situacion) &&
          (cuerpo === "todos" || (cuerpo === "cabeza" ? r.cuerpo === "Head" : r.cuerpo !== "Head")) &&
          (!jugador || r.tirador === jugador),
      ),
    [delLado, situacion, cuerpo, jugador],
  );

  const tiradores = useMemo(() => {
    const m = new Map<string, Remate[]>();
    for (const r of delLado.filter((x) => enSituacion(x, situacion) && (cuerpo === "todos" || (cuerpo === "cabeza" ? x.cuerpo === "Head" : x.cuerpo !== "Head"))))
      m.set(r.tirador, [...(m.get(r.tirador) ?? []), r]);
    return [...m.entries()]
      .map(([nombre, rs]) => ({ nombre, ...resumenRemates(rs), equipo: lado === "contra" ? [...new Set(rs.map((x) => x.equipo))].join(", ") : "" }))
      .sort((a, b) => b.xG - a.xG);
  }, [delLado, situacion, cuerpo, lado]);

  const nombre = nombreDe(teamId, equipos.find((e) => e.teamId === teamId)?.equipo ?? "");

  if (cargando)
    return (
      <Panel titulo={titulo ?? "Mapa de remates"}>
        <div className="h-64 animate-pulse rounded-2xl bg-white/[0.05]" role="status" aria-label="Cargando los remates" />
      </Panel>
    );
  if (!hay) return null;

  return (
    <Panel
      titulo={titulo ?? "Mapa de remates"}
      subtitulo={`${lado === "favor" ? `Los remates de ${nombre}` : `Los remates que le hacen a ${nombre}`} en la temporada, uno a uno (Opta). Pincha un punto para ver el remate.`}
      derecha={
        !fijo && (
          <Elegir
            etiqueta="Equipo"
            valor={teamId}
            alCambiar={(v) => {
              setEquipo(v);
              setJugador("");
            }}
            opciones={equipos.map((e) => ({ clave: e.teamId, nombre: e.equipo }))}
          />
        )
      }
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Botonera
          etiqueta="A favor o en contra"
          valor={lado}
          alCambiar={(v) => {
            setLado(v);
            setJugador("");
          }}
          opciones={[
            { clave: "favor", nombre: "A favor" },
            { clave: "contra", nombre: "En contra" },
          ]}
        />
        <Botonera etiqueta="Situación" valor={situacion} alCambiar={setSituacion} opciones={SITUACIONES} />
        <Botonera etiqueta="Parte del cuerpo" valor={cuerpo} alCambiar={setCuerpo} opciones={CUERPOS} />
        {jugador && (
          <button type="button" onClick={() => setJugador("")} className="rounded-lg border border-white/15 px-2.5 py-1.5 text-xs text-white/75 hover:text-white">
            {jugador} ✕
          </button>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <MapaRemates remates={filtrados} enContra={lado === "contra"} ariaLabel={`Mapa de remates ${lado === "favor" ? "de" : "contra"} ${nombre}`} />

        {tiradores.length > 0 && (
          <div className="min-w-0 overflow-x-auto">
            <h3 className="mb-1.5 text-sm font-semibold text-white">{lado === "favor" ? "Quién remata" : "Quién le remata"}</h3>
            <table className="w-full min-w-[420px] text-left text-[12px] tabular-nums">
              <thead>
                <tr className="border-b border-white/10 text-[11px] text-white/55">
                  <th className="py-1.5 pr-2 font-semibold">Jugador</th>
                  <th className="py-1.5 pr-2 text-right font-semibold">Rem.</th>
                  <th className="py-1.5 pr-2 text-right font-semibold">Goles</th>
                  <th className="py-1.5 pr-2 text-right font-semibold">xG</th>
                  <th className="py-1.5 pr-2 text-right font-semibold" title="xG por remate">xG/rem.</th>
                  <th className="py-1.5 pr-2 text-right font-semibold">A puerta</th>
                  <th className="py-1.5 text-right font-semibold" title="xGOT − xG de sus remates a puerta">xGOT−xG</th>
                </tr>
              </thead>
              <tbody>
                {tiradores.slice(0, 15).map((t) => (
                  <tr
                    key={t.nombre}
                    onClick={() => setJugador(jugador === t.nombre ? "" : t.nombre)}
                    className={`cursor-pointer border-b border-white/[0.06] hover:bg-white/[0.04] ${jugador === t.nombre ? "bg-white/[0.06]" : ""}`}
                  >
                    <td className="max-w-[160px] truncate py-1.5 pr-2 text-white/85" title={t.equipo || undefined}>
                      {t.nombre}
                      {t.equipo && <span className="ml-1 text-[10px] text-white/45">{t.equipo}</span>}
                    </td>
                    <td className="py-1.5 pr-2 text-right text-white/75">{t.remates}</td>
                    <td className="py-1.5 pr-2 text-right text-white/75">{t.goles}</td>
                    <td className="py-1.5 pr-2 text-right text-white/75">{dec(t.xG)}</td>
                    <td className="py-1.5 pr-2 text-right text-white/75">{dec(t.xGPorRemate)}</td>
                    <td className="py-1.5 pr-2 text-right text-white/75">{pct(t.pctPuerta)}</td>
                    <td className="py-1.5 text-right text-white/75">{conSigno(t.xGOTmenosXG)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-[11px] leading-relaxed text-white/50">
              xG: la probabilidad de gol de cada ocasión antes del golpeo. xGOT: la misma tras el golpeo, sólo de los que van entre los palos; si xGOT − xG es positivo, el
              jugador coloca mejor de lo que la ocasión pedía.
            </p>
          </div>
        )}
      </div>
    </Panel>
  );
}

/** Los remates de un jugador, para su ficha (cualquier jugador de la categoría). */
export function RematesJugador({ datos, jugador }: { datos: DatosOpta; jugador: Fila }) {
  const { remates } = useRemates(datos);
  const id = String(jugador.playerId ?? "");
  const suyos = useMemo(() => remates.filter((r) => r.tiradorId === id), [remates, id]);
  if (!suyos.length) return null;
  return (
    <div className="mt-5 border-t border-white/10 pt-4">
      <h3 className="mb-2 text-sm font-semibold text-white">Sus remates, uno a uno</h3>
      <MapaRemates remates={suyos} conTirador={false} ariaLabel={`Mapa de remates de ${String(jugador.jugador ?? "")}`} maxAlto={380} />
    </div>
  );
}
