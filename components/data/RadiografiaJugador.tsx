"use client";

/**
 * RADIOGRAFÍA DE PERCENTILES Y COMPARATIVA DE JUGADORES (14/11/2026, petición
 * del analista; idea de F. Sosa · The Eye Intelligence Unit).
 *
 * Una «pizza» de 18 métricas por 90′ del puesto del jugador: el largo de
 * cada porción es su percentil frente a los de su misma familia de puesto en
 * toda la categoría (con un mínimo de minutos), y alrededor, cada métrica con
 * su valor grande y su «P##». Arriba, la nota de perfil (media de
 * percentiles). Con «Comparar», un segundo jugador: su pizza en contorno azul
 * encima y, en cada métrica, quién gana. Las cuentas, en
 * `lib/opta-radiografia-jugador.ts`; los datos, `opta:jugadores`.
 */

import { useMemo, useState } from "react";

import { Botonera, Elegir, Panel } from "@/app/opta/_piezas/comun";
import type { DatosOpta } from "@/app/opta/_piezas/useOpta";
import { COMPARADO, ORO, tinta, useEscudos } from "@/components/data/graficas";
import { CASTILLA_OPTA, num, PUESTO_OPTA } from "@/lib/opta";

/** Opta llama al filial «Real Madrid II»: en la app es el Castilla. */
const nombreDe = (f: Record<string, unknown>) => (String(f.teamId) === CASTILLA_OPTA ? "Real Madrid Castilla" : String(f.equipo ?? ""));
import { nombreMetrica } from "@/lib/opta-nombres";
import { minutosDe, PARTES_RADIOGRAFIA, parteDe, radiografiaJugador, type Radiografia } from "@/lib/opta-radiografia-jugador";
import { familiaFina, TASAS, type Fila } from "@/lib/opta-talento";

const T = 760;
const C = T / 2;
const R0 = 62;
const R = 300;
const HUECO = 0.014;

const polar = (r: number, a: number) => [C + r * Math.sin(a), C - r * Math.cos(a)] as const;
function sector(r1: number, r2: number, a1: number, a2: number) {
  const [x1, y1] = polar(r2, a1);
  const [x2, y2] = polar(r2, a2);
  const [x3, y3] = polar(r1, a2);
  const [x4, y4] = polar(r1, a1);
  const grande = a2 - a1 > Math.PI ? 1 : 0;
  return `M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${r2} ${r2} 0 ${grande} 1 ${x2.toFixed(1)} ${y2.toFixed(1)} L ${x3.toFixed(1)} ${y3.toFixed(1)} A ${r1} ${r1} 0 ${grande} 0 ${x4.toFixed(1)} ${y4.toFixed(1)} Z`;
}

/** Oro más intenso cuanto más alto el percentil (vale en día y en noche: es relleno sobre el gráfico). */
const oro = (p: number) => `rgba(227,194,126,${(0.28 + 0.72 * (p / 100)).toFixed(2)})`;
const COLOR_PARTE: Record<(typeof PARTES_RADIOGRAFIA)[number], string> = { Ataque: "#E0614B", Creación: "#E3A33B", "Con balón": "#4F8FE8", Defensa: "#2BA88E" };

const nota = (v: number | null) => (v == null ? "—" : v.toFixed(1).replace(".", ","));
/** Por 90′ con dos decimales; los porcentajes de opta:jugadores vienen en tanto por uno. */
const valorDe = (a: string, v: number | null) => {
  if (v == null || !Number.isFinite(v)) return "—";
  if (TASAS.has(a)) return `${(v * 100).toFixed(1).replace(".", ",")} %`;
  return v.toFixed(2).replace(".", ",");
};

const MINIMOS = [
  { clave: "270", nombre: "≥ 270′" },
  { clave: "450", nombre: "≥ 450′" },
  { clave: "900", nombre: "≥ 900′" },
];

const iniciales = (n: string) =>
  n
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((x) => x[0])
    .join("")
    .toUpperCase();

function Pizza({ r, otra, resalta, alResaltar }: { r: Radiografia; otra: Radiografia | null; resalta: number | null; alResaltar: (i: number | null) => void }) {
  const n = r.porciones.length;
  const paso = (2 * Math.PI) / n;
  return (
    <svg viewBox={`0 0 ${T} ${T}`} className="mx-auto block h-auto w-full max-w-[460px]" role="img" aria-label="Radiografía de percentiles">
      {/* Guías: P50 y P90. */}
      {[50, 90].map((p) => (
        <circle key={p} cx={C} cy={C} r={R0 + ((R - R0) * p) / 100} style={{ fill: "none", stroke: tinta(0.18), strokeDasharray: "4 6" }} />
      ))}
      {r.porciones.map((x, i) => {
        const a1 = i * paso + HUECO;
        const a2 = (i + 1) * paso - HUECO;
        const largo = x.p != null ? R0 + ((R - R0) * Math.max(4, x.p)) / 100 : R0;
        const on = resalta === i;
        return (
          <g key={x.a} onMouseEnter={() => alResaltar(i)} onMouseLeave={() => alResaltar(null)}>
            <path d={sector(R0, R, a1, a2)} style={{ fill: tinta(on ? 0.1 : 0.045) }} />
            {x.p != null && <path d={sector(R0, largo, a1, a2)} style={{ fill: oro(x.p), stroke: on ? tinta(0.9) : "none", strokeWidth: 2 }} />}
            {/* Borde exterior con el color de su parte (ataque, creación, balón, defensa). */}
            <path d={sector(R + 6, R + 14, a1, a2)} style={{ fill: COLOR_PARTE[parteDe(x.a)], opacity: 0.85 }} />
          </g>
        );
      })}
      {otra &&
        otra.porciones.map((x, i) => {
          if (x.p == null) return null;
          const a1 = i * paso + HUECO;
          const a2 = (i + 1) * paso - HUECO;
          return <path key={`o-${x.a}`} d={sector(R0, R0 + ((R - R0) * Math.max(4, x.p)) / 100, a1, a2)} style={{ fill: "rgba(79,143,232,0.12)", stroke: COMPARADO, strokeWidth: 3 }} />;
        })}
      <circle cx={C} cy={C} r={R0 - 4} style={{ fill: "var(--background, #0f141b)", stroke: "rgba(200,169,107,0.7)", strokeWidth: 2 }} />
      <text x={C} y={C + 4} textAnchor="middle" dominantBaseline="middle" style={{ fill: ORO, fontSize: 30, fontWeight: 800 }}>
        {nota(r.nota)}
      </text>
    </svg>
  );
}

function useEleccion(jugadores: Fila[], minimo: number, inicialEquipo: string) {
  const [teamId, setTeamId] = useState(inicialEquipo);
  const [playerId, setPlayerId] = useState("");
  const equipos = useMemo(() => {
    const m = new Map<string, string>();
    for (const f of jugadores) m.set(String(f.teamId), nombreDe(f));
    return [...m.entries()].map(([clave, nombre]) => ({ clave, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }, [jugadores]);
  const delEquipo = useMemo(
    () => jugadores.filter((f) => String(f.teamId) === teamId && minutosDe(f) >= Math.min(minimo, 90)).sort((a, b) => minutosDe(b) - minutosDe(a)),
    [jugadores, teamId, minimo],
  );
  const fila = delEquipo.find((f) => String(f.playerId) === playerId) ?? delEquipo[0] ?? null;
  const cambiaEquipo = (t: string) => {
    setTeamId(t);
    setPlayerId("");
  };
  return { teamId, setTeamId: cambiaEquipo, playerId: fila ? String(fila.playerId) : "", setPlayerId, equipos, delEquipo, fila };
}

function Cabecera({ f, r, color, escudo }: { f: Fila; r: Radiografia; color: string; escudo: string | null }) {
  const puesto = PUESTO_OPTA[String(f.puesto ?? "")] ?? String(f.puesto ?? "");
  const edad = num(f.Age);
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-3">
      <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-xl font-black" style={{ background: tinta(0.06), border: `2px solid ${color}`, color }}>
        {iniciales(String(f.jugador ?? ""))}
        {escudo && (
          // eslint-disable-next-line @next/next/no-img-element -- escudo pequeño por el proxy propio
          <img src={escudo} alt="" width={22} height={22} className="absolute -bottom-1 -right-1 h-[22px] w-[22px] object-contain" />
        )}
      </div>
      <div className="min-w-0">
        <p className="break-words text-2xl font-black leading-tight sm:text-3xl" style={{ color }}>
          {String(f.jugador ?? "")}
        </p>
        <p className="text-sm text-white/65">
          {[nombreDe(f), puesto, edad ? `${Math.round(edad)} años` : "", `${Math.round(minutosDe(f))} min`, num(f.GM) ? `${num(f.GM)} partidos` : ""].filter(Boolean).join(" · ")}
        </p>
      </div>
      <div className="ml-auto shrink-0 text-right max-sm:w-full max-sm:text-left">
        <p className="font-mono text-4xl font-black tabular-nums leading-none sm:text-5xl" style={{ color }}>
          {nota(r.nota)}
        </p>
        <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-white/55">Nota de perfil</p>
      </div>
    </div>
  );
}

export function RadiografiaJugador({ datos }: { datos: DatosOpta }) {
  const jugadores = datos.jugadores;
  const escudoDe = useEscudos();
  const [minimoTxt, setMinimoTxt] = useState("450");
  const minimo = Number(minimoTxt);
  const [compara, setCompara] = useState(false);
  const [resalta, setResalta] = useState<number | null>(null);
  const uno = useEleccion(jugadores, minimo, CASTILLA_OPTA);
  const dos = useEleccion(jugadores, minimo, CASTILLA_OPTA);

  const familia = uno.fila ? familiaFina(uno.fila) : "";
  const rA = useMemo(() => (uno.fila ? radiografiaJugador(uno.fila, jugadores, minimo) : null), [uno.fila, jugadores, minimo]);
  /* El segundo, con las métricas y el universo del primero: así se comparan las mismas cosas. */
  const filaB = compara ? (dos.fila && dos.playerId !== uno.playerId ? dos.fila : (dos.delEquipo.find((f) => String(f.playerId) !== uno.playerId) ?? null)) : null;
  const rB = useMemo(() => (filaB && familia ? radiografiaJugador(filaB, jugadores, minimo, familia) : null), [filaB, jugadores, minimo, familia]);

  const selector = (e: ReturnType<typeof useEleccion>, rotulo: string) => (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <Elegir etiqueta={rotulo} valor={e.teamId} opciones={e.equipos} alCambiar={e.setTeamId} />
      <Elegir
        valor={e.playerId}
        opciones={e.delEquipo.map((f) => ({ clave: String(f.playerId), nombre: `${String(f.jugador ?? "")} · ${PUESTO_OPTA[String(f.puesto ?? "")] ?? ""} · ${Math.round(minutosDe(f))}′` }))}
        alCambiar={e.setPlayerId}
      />
    </div>
  );

  if (!jugadores.length) return null;

  const n = rA?.porciones.length ?? 0;
  const mitad = Math.ceil(n / 2);
  /* Derecha: de arriba abajo, las primeras (de las 12 a las 6 en el reloj); izquierda: las últimas, de arriba abajo. */
  const derecha = rA ? rA.porciones.slice(0, mitad).map((x, k) => ({ x, i: k })) : [];
  const izquierda = rA ? rA.porciones.slice(mitad).map((x, k) => ({ x, i: mitad + k })).reverse() : [];

  const etiqueta = ({ x, i }: { x: Radiografia["porciones"][number]; i: number }, lado: "izq" | "der") => {
    const otro = rB?.porciones[i] ?? null;
    const gana = otro && x.valor != null && otro.valor != null && x.valor !== otro.valor ? (x.inverso ? x.valor < otro.valor : x.valor > otro.valor) ? "A" : "B" : null;
    return (
      <li
        key={x.a}
        onMouseEnter={() => setResalta(i)}
        onMouseLeave={() => setResalta(null)}
        className={`rounded-lg px-2 py-1 ${lado === "izq" ? "lg:text-right" : ""}`}
        style={{ background: resalta === i ? tinta(0.06) : undefined }}
      >
        <p className={`flex items-baseline gap-2 ${lado === "izq" ? "lg:justify-end" : ""}`}>
          <span className="font-mono text-2xl font-black tabular-nums" style={{ color: gana === "B" ? tinta(0.5) : tinta(0.95) }}>
            {valorDe(x.a, x.valor)}
          </span>
          {otro && (
            <span className="font-mono text-lg font-bold tabular-nums" style={{ color: COMPARADO, opacity: gana === "A" ? 0.6 : 1 }}>
              {valorDe(x.a, otro.valor)}
            </span>
          )}
        </p>
        <p className="text-xs font-bold uppercase tracking-[0.08em] text-white/65">
          <span aria-hidden className="mr-1 inline-block h-2 w-2 rounded-full align-middle" style={{ background: COLOR_PARTE[parteDe(x.a)] }} />
          {nombreMetrica(x.a)}
          {x.inverso ? " (menos es mejor)" : ""} · <span style={{ color: ORO }}>{x.p != null ? `P${x.p}` : "sin P"}</span>
          {otro && <span style={{ color: COMPARADO }}> · {otro.p != null ? `P${otro.p}` : "sin P"}</span>}
        </p>
      </li>
    );
  };

  const ganadas = rA && rB ? rA.porciones.reduce((s, x, i) => s + ((x.p ?? -1) > (rB.porciones[i].p ?? -1) ? 1 : 0), 0) : 0;
  const perdidas = rA && rB ? rA.porciones.reduce((s, x, i) => s + ((rB.porciones[i].p ?? -1) > (x.p ?? -1) ? 1 : 0), 0) : 0;

  return (
    <Panel
      className="mt-6"
      titulo="Radiografía de percentiles"
      subtitulo="18 métricas por 90′ del puesto, cada una contra los de su misma familia de puesto en toda la categoría"
      derecha={
        <div className="flex flex-wrap items-center gap-2">
          <Botonera etiqueta="Minutos mínimos del universo" valor={minimoTxt} opciones={MINIMOS} alCambiar={setMinimoTxt} />
          <button
            type="button"
            onClick={() => setCompara((c) => !c)}
            aria-pressed={compara}
            className="rounded-xl border px-3 py-1.5 text-sm font-semibold"
            style={compara ? { borderColor: COMPARADO, color: COMPARADO, background: "rgba(79,143,232,0.12)" } : { borderColor: tinta(0.2) }}
          >
            {compara ? "Quitar comparativa" : "Comparar con otro jugador"}
          </button>
        </div>
      }
    >
      <div className="mb-4 grid gap-2">
        {selector(uno, "Jugador")}
        {compara && selector(dos, "Contra")}
      </div>

      {!uno.fila || !rA ? (
        <p className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/60">
          {uno.fila ? `Sin radiografía para su puesto (${String(uno.fila.puesto ?? "sin puesto")}).` : "Elige un jugador."}
        </p>
      ) : (
        <>
          <div className="space-y-3">
            <Cabecera f={uno.fila} r={rA} color={ORO} escudo={escudoDe(String(uno.fila.equipo ?? ""))} />
            {filaB && rB && <Cabecera f={filaB} r={rB} color={COMPARADO} escudo={escudoDe(String(filaB.equipo ?? ""))} />}
          </div>

          {filaB && rB && (
            <p className="mt-3 rounded-xl px-3 py-2 text-sm font-semibold" style={{ background: tinta(0.05) }}>
              <span style={{ color: ORO }}>{String(uno.fila.jugador)}</span> gana en {ganadas} de {n} métricas;{" "}
              <span style={{ color: COMPARADO }}>{String(filaB.jugador)}</span>, en {perdidas}.
              {familiaFina(filaB) !== familia ? ` Ojo: ${String(filaB.jugador)} es de otro puesto (${familiaFina(filaB) || "sin puesto"}); se le mide con las métricas y el universo de ${familia.toLowerCase()}.` : ""}
            </p>
          )}

          <div className="mt-4 grid items-center gap-4 lg:grid-cols-[1fr_minmax(280px,440px)_1fr]">
            <ul className="order-2 grid grid-cols-2 gap-1 lg:order-1 lg:grid-cols-1">{izquierda.map((x) => etiqueta(x, "izq"))}</ul>
            <div className="order-1 lg:order-2">
              <Pizza r={rA} otra={rB} resalta={resalta} alResaltar={setResalta} />
              <div className="mt-2 flex flex-wrap justify-center gap-3 text-xs text-white/60">
                {PARTES_RADIOGRAFIA.map((p) => (
                  <span key={p} className="inline-flex items-center gap-1">
                    <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: COLOR_PARTE[p] }} />
                    {p}
                  </span>
                ))}
                <span>· líneas: P50 y P90</span>
              </div>
            </div>
            <ul className="order-3 grid grid-cols-2 gap-1 lg:grid-cols-1">{derecha.map((x) => etiqueta(x, "der"))}</ul>
          </div>

          <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/55">Universo de comparación</p>
            <p className="mt-1 text-sm text-white/80">
              {familia} · toda la categoría (los dos grupos) · ≥ {minimo}′ · {rA.comparables} comparables ({rA.elegibles} del puesto en total). Incluye al protagonista.
            </p>
            <p className="mt-1 text-xs text-white/55">
              Percentil = de los comparables, cuántos están por debajo (los empates cuentan la mitad); en las de «menos es mejor», al revés. Sólo se da con 5 valores o más, y un
              porcentaje sólo con intentos suficientes. Nota de perfil = media de los percentiles. Por 90′ salvo los porcentajes. Idea: F. Sosa (The Eye Intelligence Unit).
            </p>
          </div>
        </>
      )}
    </Panel>
  );
}
