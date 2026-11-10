"use client";

/**
 * FASES DEL CASTILLA, ACCIÓN A ACCIÓN (09/11/2026), con
 * `opta:castilla-eventos` (sólo existe del Castilla):
 *
 * - la red de pases (cada jugador en su posición media, el grosor por los
 *   pases entre dos), de un partido o de la temporada;
 * - los pases progresivos y los que entran en el último tercio;
 * - las recuperaciones y las pérdidas por altura (presión alta, zona media,
 *   bloque bajo);
 *
 * todo filtrable por partido y por jugador. Las definiciones (qué es
 * progresivo, qué cuenta como pérdida) están en `lib/opta-eventos.ts`.
 */

import { useMemo, useState } from "react";

import { CampoOpta, SOBRE_CESPED } from "@/components/campo/CampoOpta";
import { fechaCorta } from "@/lib/opta-analisis";
import {
  alturaAccion,
  esAlUltimoTercio,
  esPerdida,
  esProgresivo,
  esRecuperacion,
  redDePases,
  type AccionCastilla,
  type Altura3,
} from "@/lib/opta-eventos";

import { Botonera, Cifra, Elegir, Panel } from "./comun";
import { pct, useAcciones } from "./eventos";
import type { DatosOpta } from "./useOpta";

const corto = (n: string) => {
  const partes = n.split(" ");
  return partes.length > 1 ? partes.slice(1).join(" ") : n;
};

/**
 * `partidoFijo` (10/11/2026): el partido ya elegido fuera —el selector único
 * de «Post del partido»—; entonces no se pinta el selector propio y sólo se
 * enseña ese partido.
 */
export function Fases({ datos, partidoFijo }: { datos: DatosOpta; partidoFijo?: string }) {
  const { acciones, cargando } = useAcciones(datos);
  const [partidoSuelto, setPartido] = useState("");
  const partido = partidoFijo ?? partidoSuelto;
  const [jugador, setJugador] = useState("");

  const nuestras = useMemo(() => acciones.filter((a) => a.nuestra), [acciones]);
  const partidos = useMemo(() => {
    const m = new Map<string, { partido: string; fecha: string; rival: string }>();
    for (const a of nuestras) if (!m.has(a.partido)) m.set(a.partido, { partido: a.partido, fecha: a.fecha, rival: a.rival });
    return [...m.values()].sort((a, b) => b.fecha.localeCompare(a.fecha));
  }, [nuestras]);
  const delPartido = useMemo(() => (partido ? nuestras.filter((a) => a.partido === partido) : nuestras), [nuestras, partido]);
  const jugadores = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of delPartido) if (a.jugador) m.set(a.jugador, (m.get(a.jugador) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n);
  }, [delPartido]);
  const jugadorVisto = jugadores.includes(jugador) ? jugador : "";
  const vistas = useMemo(() => (jugadorVisto ? delPartido.filter((a) => a.jugador === jugadorVisto) : delPartido), [delPartido, jugadorVisto]);
  const nPartidos = partido ? 1 : partidos.length;

  if (cargando) return <div className="mt-6 h-72 animate-pulse rounded-2xl bg-white/[0.05]" role="status" aria-label="Cargando las acciones del Castilla" />;
  if (!nuestras.length || (partidoFijo && !delPartido.length)) return null;

  return (
    <div className="mt-6 space-y-4">
      <Panel
        titulo="El Castilla, acción a acción"
        subtitulo={
          partidoFijo
            ? "Cada pase, recuperación y pérdida del Castilla en este partido según Opta. Siempre atacando hacia la derecha."
            : "Cada pase, recuperación y pérdida del Castilla esta temporada según Opta. Siempre atacando hacia la derecha."
        }
        derecha={
          <>
            {!partidoFijo && (
            <Elegir
              etiqueta="Partido"
              valor={partido}
              alCambiar={setPartido}
              opciones={[{ clave: "", nombre: `Toda la temporada (${partidos.length})` }, ...partidos.map((p) => ({ clave: p.partido, nombre: `${fechaCorta(p.fecha)} · ${p.rival}` }))]}
            />
            )}
            <Elegir etiqueta="Jugador" valor={jugadorVisto} alCambiar={setJugador} opciones={[{ clave: "", nombre: "Todo el equipo" }, ...jugadores.map((n) => ({ clave: n, nombre: n }))]} />
          </>
        }
      >
        <RedDePases acciones={delPartido} jugador={jugadorVisto} partidos={nPartidos} alElegir={setJugador} />
      </Panel>
      <Progresion acciones={vistas} todas={delPartido} partidos={nPartidos} jugador={jugadorVisto} alElegir={setJugador} />
      <RecuperacionesPerdidas acciones={vistas} todas={delPartido} partidos={nPartidos} jugador={jugadorVisto} alElegir={setJugador} />
    </div>
  );
}

function RedDePases({ acciones, jugador, partidos, alElegir }: { acciones: AccionCastilla[]; jugador: string; partidos: number; alElegir: (j: string) => void }) {
  const red = useMemo(() => redDePases(acciones), [acciones]);
  /* Los 14 que más pasan (en un partido, los que han jugado de verdad) y los enlaces con peso. */
  const nodos = useMemo(() => [...red.nodos].sort((a, b) => b.pases - a.pases).slice(0, 14), [red]);
  const dentro = new Set(nodos.map((n) => n.jugador));
  const minimo = Math.max(3, Math.round(partidos * 2.5));
  const enlaces = red.enlaces.filter((e) => e.n >= minimo && dentro.has(e.a) && dentro.has(e.b));
  const tope = Math.max(1, ...enlaces.map((e) => e.n));
  const topePases = Math.max(1, ...nodos.map((n) => n.pases));
  const sitio = new Map(nodos.map((n) => [n.jugador, n]));
  const suyos = jugador ? red.enlaces.filter((e) => e.a === jugador || e.b === jugador).sort((a, b) => b.n - a.n) : [];

  if (nodos.length < 3) return null;
  return (
    <div className="min-w-0">
      <h3 className="text-sm font-semibold text-white">Red de pases</h3>
      <p className="mb-2 text-[11px] text-white/55">
        Cada jugador en la posición media de sus pases y de lo que recibe; el tamaño, los pases que da; las líneas, las parejas con {minimo} o más pases completados entre
        los dos{partidos > 1 ? " en la temporada" : ""}. Pincha un jugador para ver con quién se asocia.
      </p>
      <CampoOpta ariaLabel="Red de pases del Castilla" maxAlto={460}>
        {(p) => (
          <>
            {enlaces.map((e) => {
              const a = sitio.get(e.a)!;
              const b = sitio.get(e.b)!;
              const [x1, y1] = p(a.x, a.y);
              const [x2, y2] = p(b.x, b.y);
              const suya = !jugador || e.a === jugador || e.b === jugador;
              return (
                <line
                  key={`${e.a}|${e.b}`}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  style={{ stroke: suya ? SOBRE_CESPED.nuestro : SOBRE_CESPED.tenue, strokeOpacity: suya ? 0.35 + (e.n / tope) * 0.5 : 0.15, strokeWidth: 2 + (e.n / tope) * 16, strokeLinecap: "round" }}
                >
                  <title>{`${e.a} – ${e.b}: ${e.n} pases`}</title>
                </line>
              );
            })}
            {nodos.map((n) => {
              const [cx, cy] = p(n.x, n.y);
              const marcado = jugador === n.jugador;
              const apagado = jugador && !marcado && !suyos.some((e) => e.a === n.jugador || e.b === n.jugador);
              return (
                <g key={n.jugador} onClick={() => alElegir(marcado ? "" : n.jugador)} style={{ cursor: "pointer", opacity: apagado ? 0.35 : 1 }}>
                  <circle cx={cx} cy={cy} r={14 + (n.pases / topePases) * 18} style={{ fill: "#0E2A1B", stroke: marcado ? "#FFFFFF" : SOBRE_CESPED.nuestro, strokeWidth: marcado ? 5 : 3 }}>
                    <title>{`${n.jugador}: ${n.pases} pases`}</title>
                  </circle>
                  <text x={cx} y={cy + 50} textAnchor="middle" style={{ fill: "rgba(255,255,255,0.9)", fontSize: 21, fontWeight: 600, pointerEvents: "none" }}>
                    {corto(n.jugador)}
                  </text>
                </g>
              );
            })}
          </>
        )}
      </CampoOpta>
      {suyos.length > 0 && (
        <p className="mt-2 text-[12px] text-white/75">
          {jugador} se asocia sobre todo con{" "}
          {suyos
            .slice(0, 4)
            .map((e) => `${e.a === jugador ? e.b : e.a} (${e.n})`)
            .join(", ")}
          .
        </p>
      )}
    </div>
  );
}

type Tipo = "progresivos" | "tercio";

function Progresion({ acciones, todas, partidos, jugador, alElegir }: { acciones: AccionCastilla[]; todas: AccionCastilla[]; partidos: number; jugador: string; alElegir: (j: string) => void }) {
  const [tipo, setTipo] = useState<Tipo>("progresivos");
  const filtro = tipo === "progresivos" ? esProgresivo : esAlUltimoTercio;
  const pases = acciones.filter(filtro);
  const totalPases = acciones.filter((a) => a.tipo === "Pass").length;
  const conOcasion = pases.filter((a) => a.ocasion).length;
  const porJugador = useMemo(() => {
    const m = new Map<string, { n: number; prog: number; tercio: number }>();
    for (const a of todas) {
      if (a.tipo !== "Pass" || !a.jugador) continue;
      const x = m.get(a.jugador) ?? { n: 0, prog: 0, tercio: 0 };
      x.n++;
      if (esProgresivo(a)) x.prog++;
      if (esAlUltimoTercio(a)) x.tercio++;
      m.set(a.jugador, x);
    }
    return [...m.entries()].map(([nombre, x]) => ({ nombre, ...x })).sort((a, b) => (tipo === "progresivos" ? b.prog - a.prog : b.tercio - a.tercio));
  }, [todas, tipo]);

  if (!totalPases) return null;
  return (
    <Panel
      titulo="Cómo se avanza"
      subtitulo={
        tipo === "progresivos"
          ? "Pases progresivos: completados y que acercan el balón a la portería rival al menos un 25 % de lo que faltaba (sin los que se quedan en campo propio)."
          : "Pases al último tercio: completados y que entran en el último tercio desde fuera de él."
      }
      derecha={
        <Botonera
          etiqueta="Qué pases"
          valor={tipo}
          alCambiar={setTipo}
          opciones={[
            { clave: "progresivos", nombre: "Progresivos" },
            { clave: "tercio", nombre: "Al último tercio" },
          ]}
        />
      }
    >
      <div className="mb-3 grid gap-2 sm:grid-cols-3">
        <Cifra rotulo={tipo === "progresivos" ? "Progresivos" : "Al último tercio"} valor={String(pases.length)} detalle={partidos > 1 ? `${(pases.length / partidos).toFixed(1).replace(".", ",")} por partido` : undefined} />
        <Cifra rotulo="De cada 100 pases" valor={(totalPases ? (pases.length / totalPases) * 100 : 0).toFixed(1).replace(".", ",")} detalle={`${totalPases} pases ${jugador ? "suyos" : "del equipo"}`} />
        {conOcasion > 0 && <Cifra rotulo="Acaban en ocasión" valor={String(conOcasion)} detalle="el pase deja un remate" />}
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <CampoOpta ariaLabel="Pases que hacen avanzar al Castilla" maxAlto={420}>
          {(p) => (
            <>
              <defs>
                <marker id={`punta-${tipo}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" style={{ fill: SOBRE_CESPED.nuestro }} />
                </marker>
              </defs>
              {pases.map((a, i) => {
                const [x1, y1] = p(a.x, a.y);
                const [x2, y2] = p(a.finX!, a.finY!);
                return (
                  <line
                    key={i}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    markerEnd={`url(#punta-${tipo})`}
                    style={{ stroke: a.ocasion ? "#FFFFFF" : SOBRE_CESPED.nuestro, strokeOpacity: pases.length > 150 ? 0.35 : 0.6, strokeWidth: a.ocasion ? 4 : 2.5 }}
                  >
                    <title>{`${a.minuto}′ · ${a.jugador}${a.receptor ? ` → ${a.receptor}` : ""}${a.ocasion ? " · acaba en ocasión" : ""} · ${fechaCorta(a.fecha)} contra ${a.rival}`}</title>
                  </line>
                );
              })}
            </>
          )}
        </CampoOpta>
        <TablaJugadores
          filas={porJugador.slice(0, 14).map((f) => ({
            nombre: f.nombre,
            celdas: [String(f.n), String(f.prog), String(f.tercio), pct(f.n ? (tipo === "progresivos" ? f.prog : f.tercio) / f.n : null)],
          }))}
          cabeceras={["Pases", "Progr.", "Últ. tercio", tipo === "progresivos" ? "% progr." : "% últ. tercio"]}
          jugador={jugador}
          alElegir={alElegir}
        />
      </div>
    </Panel>
  );
}

type Modo = "recuperaciones" | "perdidas";
const ALTURAS: { clave: Altura3; nombre: string; detalle: string }[] = [
  { clave: "alta", nombre: "Arriba", detalle: "en campo rival (x ≥ 60): presión alta" },
  { clave: "media", nombre: "Zona media", detalle: "entre el primer tercio y el campo rival" },
  { clave: "baja", nombre: "Atrás", detalle: "en el primer tercio: bloque bajo" },
];

function RecuperacionesPerdidas({ acciones, todas, partidos, jugador, alElegir }: { acciones: AccionCastilla[]; todas: AccionCastilla[]; partidos: number; jugador: string; alElegir: (j: string) => void }) {
  const [modo, setModo] = useState<Modo>("recuperaciones");
  const filtro = modo === "recuperaciones" ? esRecuperacion : esPerdida;
  const lista = acciones.filter(filtro);
  const cuenta = (h: Altura3) => lista.filter((a) => alturaAccion(a.x) === h).length;
  const porJugador = useMemo(() => {
    const m = new Map<string, { rec: number; recAlta: number; per: number; perBaja: number }>();
    for (const a of todas) {
      if (!a.jugador) continue;
      const x = m.get(a.jugador) ?? { rec: 0, recAlta: 0, per: 0, perBaja: 0 };
      if (esRecuperacion(a)) {
        x.rec++;
        if (alturaAccion(a.x) === "alta") x.recAlta++;
      }
      if (esPerdida(a)) {
        x.per++;
        if (alturaAccion(a.x) === "baja") x.perBaja++;
      }
      m.set(a.jugador, x);
    }
    return [...m.entries()].map(([nombre, x]) => ({ nombre, ...x })).sort((a, b) => (modo === "recuperaciones" ? b.rec - a.rec : b.per - a.per));
  }, [todas, modo]);
  /* Las recuperaciones vienen sin jugador en Opta: la tabla por jugador sólo cuenta las que lo traen. */
  const conJugador = porJugador.filter((f) => (modo === "recuperaciones" ? f.rec : f.per) > 0);

  if (!lista.length) return null;
  return (
    <Panel
      titulo={modo === "recuperaciones" ? "Dónde se recupera" : "Dónde se pierde"}
      subtitulo={
        modo === "recuperaciones"
          ? "Recuperaciones, intercepciones y entradas ganadas del Castilla, en el sitio donde se hicieron."
          : "Pases fallados, regates perdidos, balones robados en conducción y errores del Castilla."
      }
      derecha={
        <Botonera
          etiqueta="Qué acciones"
          valor={modo}
          alCambiar={setModo}
          opciones={[
            { clave: "recuperaciones", nombre: "Recuperaciones" },
            { clave: "perdidas", nombre: "Pérdidas" },
          ]}
        />
      }
    >
      <div className="mb-3 grid gap-2 sm:grid-cols-3">
        {ALTURAS.map((h) => (
          <Cifra
            key={h.clave}
            rotulo={h.nombre}
            valor={`${cuenta(h.clave)} · ${pct(lista.length ? cuenta(h.clave) / lista.length : null)}`}
            detalle={`${h.detalle}${partidos > 1 ? ` · ${(cuenta(h.clave) / partidos).toFixed(1).replace(".", ",")} por partido` : ""}`}
          />
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <CampoOpta ariaLabel={modo === "recuperaciones" ? "Recuperaciones del Castilla" : "Pérdidas del Castilla"} maxAlto={420}>
          {(p) => (
            <>
              {[33.3, 60].map((x) => {
                const [x1, y1] = p(x, 0);
                const [x2, y2] = p(x, 100);
                return <line key={x} x1={x1} y1={y1} x2={x2} y2={y2} style={{ stroke: "rgba(242,201,76,0.35)", strokeWidth: 2, strokeDasharray: "10 10" }} />;
              })}
              {lista.map((a, i) => {
                const [cx, cy] = p(a.x, a.y);
                const color = modo === "recuperaciones" ? SOBRE_CESPED.verde : SOBRE_CESPED.rival;
                return (
                  <circle key={i} cx={cx} cy={cy} r={lista.length > 200 ? 7 : 10} style={{ fill: color, fillOpacity: lista.length > 200 ? 0.5 : 0.75, stroke: "rgba(0,0,0,0.4)", strokeWidth: 1.5 }}>
                    <title>{`${a.minuto}′ · ${a.jugador || "Castilla"} · ${NOMBRE_ACCION[a.tipo] ?? a.tipo}${a.tipo === "Pass" ? " fallado" : ""} · ${fechaCorta(a.fecha)} contra ${a.rival}`}</title>
                  </circle>
                );
              })}
            </>
          )}
        </CampoOpta>
        {conJugador.length > 0 && (
          <div className="min-w-0">
            <TablaJugadores
              filas={conJugador.slice(0, 14).map((f) =>
                modo === "recuperaciones"
                  ? { nombre: f.nombre, celdas: [String(f.rec), String(f.recAlta)] }
                  : { nombre: f.nombre, celdas: [String(f.per), String(f.perBaja)] },
              )}
              cabeceras={modo === "recuperaciones" ? ["Recup.", "Arriba"] : ["Pérdidas", "Atrás"]}
              jugador={jugador}
              alElegir={alElegir}
            />
            {modo === "recuperaciones" && (
              <p className="mt-2 text-[11px] text-white/50">Opta no pone nombre a las recuperaciones sueltas: la tabla cuenta las intercepciones y las entradas ganadas.</p>
            )}
          </div>
        )}
      </div>
    </Panel>
  );
}

const NOMBRE_ACCION: Record<string, string> = {
  BallRecovery: "Recuperación",
  Interception: "Intercepción",
  Tackle: "Entrada ganada",
  Pass: "Pase",
  Dispossessed: "Robado en conducción",
  TakeOn: "Regate perdido",
  Error: "Error",
};

function TablaJugadores({ filas, cabeceras, jugador, alElegir }: { filas: { nombre: string; celdas: string[] }[]; cabeceras: string[]; jugador: string; alElegir: (j: string) => void }) {
  return (
    <div className="min-w-0 overflow-x-auto">
      <table className="w-full min-w-[320px] text-left text-[12px] tabular-nums">
        <thead>
          <tr className="border-b border-white/10 text-[11px] text-white/55">
            <th className="py-1.5 pr-2 font-semibold">Jugador</th>
            {cabeceras.map((c) => (
              <th key={c} className="py-1.5 pr-2 text-right font-semibold">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr
              key={f.nombre}
              onClick={() => alElegir(jugador === f.nombre ? "" : f.nombre)}
              className={`cursor-pointer border-b border-white/[0.06] hover:bg-white/[0.04] ${jugador === f.nombre ? "bg-white/[0.06]" : ""}`}
            >
              <td className="max-w-[170px] truncate py-1.5 pr-2 text-white/85">{f.nombre}</td>
              {f.celdas.map((c, i) => (
                <td key={i} className="py-1.5 pr-2 text-right text-white/75">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
