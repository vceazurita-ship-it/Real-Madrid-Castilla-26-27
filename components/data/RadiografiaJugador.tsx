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

import { useFotosOpta } from "@/hooks/useFotosOpta";
import { corrigeNombre } from "@/lib/opta-directo-mapas";
import { FotoRedonda } from "@/components/ui/FotoRedonda";

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

/** La lectura en una línea: sus dos mejores percentiles y el peor (los de muestra suficiente). */
function lectura(r: Radiografia): string {
  const con = r.porciones.filter((x) => x.p != null).sort((x, y) => (y.p ?? 0) - (x.p ?? 0));
  if (con.length < 3) return "";
  const alto = con.slice(0, 2).filter((x) => (x.p ?? 0) >= 70);
  const bajo = con[con.length - 1];
  const partes = [
    alto.length ? `Destaca en ${alto.map((x) => `${nombreMetrica(x.a).toLowerCase()} (P${x.p})`).join(" y ")}` : "",
    (bajo.p ?? 100) <= 30 ? `flojo en ${nombreMetrica(bajo.a).toLowerCase()} (P${bajo.p})` : "",
  ].filter(Boolean);
  return partes.length ? `${partes.join("; ")}.` : "";
}

/**
 * Lo que se entrena (expertos, 14/11/2026): su percentil más bajo traducido a
 * un comportamiento que se ve en el campo y un criterio de éxito medible; el
 * segundo más bajo, nombrado al lado. Sin traducción, la métrica tal cual.
 */
const CONDUCTA: Record<string, string> = {
  LgBall: "cambio de orientación largo al lado débil en la salida; éxito: 3 de 5 que llegan",
  LgBallCp: "cambio de orientación largo al lado débil en la salida; éxito: 3 de 5 que llegan",
  "LongBall%": "pase largo tenso al espacio del extremo; éxito: 3 de 5 que llegan",
  Int: "perfilarse por dentro con el rival a la espalda y leer la línea de pase; éxito: 2 cortes por bloque",
  Recovery: "reacción tras pérdida en 5 s; éxito: recuperar en 2 de 4 repeticiones",
  "Tackle%": "entrada a la pierna de apoyo sin ir al suelo; éxito: 3 de 5 duelos 1c1 ganados",
  "Duel%": "perfilarse antes del contacto y no ir al cuerpo; éxito: 3 de 5 duelos ganados",
  "Aerial%": "atacar el balón aéreo en carrera y con el brazo de protección; éxito: 3 de 5 ganados",
  AerialWon: "atacar el balón aéreo en carrera; éxito: 3 de 5 ganados",
  "Pass%": "pase a un toque en rondo de posición con presión; éxito: 8 de 10 completados",
  "Ps%InA3rd": "último pase en 3c2 en el último tercio; éxito: 3 de 5 que acaban en remate",
  PossLost: "proteger y soltar a dos toques bajo presión; éxito: ninguna pérdida en 5 repeticiones",
  Disposs: "conducción protegiendo con el cuerpo ante entrada; éxito: 4 de 5 sin perderla",
  Crosses: "centro tras desborde al punto de penalti; éxito: 3 de 5 que llegan a un compañero",
  CrossCmp: "centro tras desborde al punto de penalti; éxito: 3 de 5 que llegan a un compañero",
  KeyPass: "pase filtrado entre líneas al desmarque; éxito: 2 de 5 que acaban en remate",
  Chance: "pase filtrado entre líneas al desmarque; éxito: 2 de 5 que acaban en remate",
  ShtIncBl: "remate tras control orientado en la frontal; éxito: 3 de 5 a portería",
  SOG: "remate tras control orientado en la frontal; éxito: 3 de 5 a portería",
  TouchOpBox: "ataque al área en llegada al segundo palo; éxito: tocar el balón en 2 de 5 centros",
  TchsA3: "recibir entre líneas perfilado hacia portería; éxito: 3 de 5 giros",
  "PosWonA3rd": "presión tras pérdida en campo rival; éxito: robar en 2 de 5 repeticiones",
};

function tarea(r: Radiografia): string {
  const bajos = r.porciones.filter((x) => x.p != null && x.p <= 35).sort((x, y) => (x.p ?? 0) - (y.p ?? 0)).slice(0, 2);
  if (!bajos.length) return "";
  const [peor, otro] = bajos;
  const conducta = CONDUCTA[peor.a];
  const base = conducta
    ? `${conducta.charAt(0).toUpperCase() + conducta.slice(1)} (sale de ${nombreMetrica(peor.a).toLowerCase()}, P${peor.p})`
    : `${nombreMetrica(peor.a)} (P${peor.p}); medirlo en la tarea`;
  return `${base}${otro ? `. También: ${nombreMetrica(otro.a).toLowerCase()} (P${otro.p})` : ""}.`;
}

function Cabecera({ f, r, color, escudo, foto }: { f: Fila; r: Radiografia; color: string; escudo: string | null; foto: string | null }) {
  const puesto = PUESTO_OPTA[String(f.puesto ?? "")] ?? String(f.puesto ?? "");
  const edad = num(f.Age);
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-3">
      <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-xl font-black" style={{ background: tinta(0.06), border: `2px solid ${color}`, color }}>
        <FotoRedonda src={foto} iniciales={iniciales(corrigeNombre(String(f.jugador ?? "")))} className="h-full w-full rounded-full" />
        {escudo && (
          // eslint-disable-next-line @next/next/no-img-element -- escudo pequeño por el proxy propio
          <img src={escudo} alt="" width={22} height={22} className="absolute -bottom-1 -right-1 h-[22px] w-[22px] object-contain" />
        )}
      </div>
      <div className="min-w-0">
        <p className="break-words text-2xl font-black leading-tight sm:text-3xl" style={{ color }}>
          {corrigeNombre(String(f.jugador ?? ""))}
        </p>
        <p className="text-sm text-white/65">
          {[nombreDe(f), puesto, edad ? `${Math.round(edad)} años` : "", `${Math.round(minutosDe(f))} min`, num(f.GM) ? `${num(f.GM)} partidos` : ""].filter(Boolean).join(" · ")}
        </p>
        {lectura(r) && <p className="mt-1 text-sm font-semibold text-white/85">{lectura(r)}</p>}
        {tarea(r) && (() => {
          /* El criterio de éxito, aparte y en oro: que se vea como tarea, no como dato. */
          const [que, exito] = tarea(r).split("; éxito: ");
          return (
            <p className="mt-1 text-sm font-semibold text-white/85">
              <b className="text-white">Para la tarea:</b> {que}
              {exito && <> · <b className="text-[#C8A96B]">éxito: {exito}</b></>}
            </p>
          );
        })()}
      </div>
      <div className="ml-auto shrink-0 text-right max-sm:w-full max-sm:text-left">
        <p className="font-mono text-4xl font-black tabular-nums leading-none sm:text-5xl" style={{ color }}>
          {nota(r.nota)}
        </p>
        <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-white/55">Nota de perfil</p>
        <p className="text-xs font-semibold text-white/65">{r.nota != null ? `${r.nota >= 50 ? "+" : "−"}${Math.abs(r.nota - 50).toFixed(1).replace(".", ",")} sobre la media del puesto (50)` : "sobre 100 (media del puesto = 50)"}</p>
      </div>
    </div>
  );
}

export function RadiografiaJugador({ datos }: { datos: DatosOpta }) {
  const fotoDe = useFotosOpta();
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

  const selector = (e: ReturnType<typeof useEleccion>, rotulo: string, mostrado?: Fila | null) => (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <Elegir etiqueta={rotulo} valor={e.teamId} opciones={e.equipos} alCambiar={e.setTeamId} />
      <Elegir
        /* El que se ve (expertos: «Contra» enseñaba a Fortea mientras se comparaba con Aguado). */
        valor={mostrado ? String(mostrado.playerId) : e.playerId}
        opciones={e.delEquipo.map((f) => ({ clave: String(f.playerId), nombre: `${corrigeNombre(String(f.jugador ?? ""))} · ${PUESTO_OPTA[String(f.puesto ?? "")] ?? ""} · ${Math.round(minutosDe(f))}′` }))}
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
        {compara && selector(dos, "Contra", filaB)}
      </div>

      {!uno.fila || !rA ? (
        <p className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/60">
          {uno.fila ? `Sin radiografía para su puesto (${String(uno.fila.puesto ?? "sin puesto")}).` : "Elige un jugador."}
        </p>
      ) : (
        <>
          <div className="space-y-3">
            <Cabecera f={uno.fila} r={rA} color={ORO} escudo={escudoDe(String(uno.fila.equipo ?? ""))} foto={fotoDe(corrigeNombre(String(uno.fila.jugador ?? "")), String(uno.fila.equipo ?? ""), String(uno.fila.teamId) === CASTILLA_OPTA)} />
            {filaB && rB && <Cabecera f={filaB} r={rB} color={COMPARADO} escudo={escudoDe(String(filaB.equipo ?? ""))} foto={fotoDe(corrigeNombre(String(filaB.jugador ?? "")), String(filaB.equipo ?? ""), String(filaB.teamId) === CASTILLA_OPTA)} />}
          </div>

          {filaB && rB && (() => {
            /* La mayor distancia entre los dos, dicha como quién le enseña a quién (expertos, 14/11/2026). */
            const pares = rA.porciones.map((x, i) => [x, rB.porciones[i]] as const).filter(([x, y]) => x.p != null && y?.p != null);
            const [x, y] = [...pares].sort((p, q) => Math.abs((q[0].p ?? 0) - (q[1].p ?? 0)) - Math.abs((p[0].p ?? 0) - (p[1].p ?? 0)))[0] ?? [];
            if (!x || !y || Math.abs((x.p ?? 0) - (y.p ?? 0)) < 25) return null;
            const nA = corrigeNombre(String(uno.fila.jugador ?? ""));
            const nB = corrigeNombre(String(filaB.jugador ?? ""));
            const [mejor, peor, pm, pp] = (x.p ?? 0) > (y.p ?? 0) ? [nA, nB, x.p, y.p] : [nB, nA, y.p, x.p];
            return (
              <p className="mt-3 rounded-xl border-l-4 border-[#C8A96B] px-3 py-2 text-base font-bold" style={{ background: tinta(0.05) }}>
                Mayor distancia: {nombreMetrica(x.a).toLowerCase()} (P{pm} frente a P{pp}) → clips de {mejor} para la charla individual de {peor}.
              </p>
            );
          })()}
          {filaB && rB && (
            <p className="mt-3 rounded-xl px-3 py-2 text-base font-bold sm:text-lg" style={{ background: tinta(0.05) }}>
              <span style={{ color: ORO }}>{corrigeNombre(String(uno.fila.jugador ?? ""))}</span> gana en {ganadas} de {n} métricas;{" "}
              <span style={{ color: COMPARADO }}>{corrigeNombre(String(filaB.jugador ?? ""))}</span>, en {perdidas}.
              {familiaFina(filaB) !== familia ? ` Ojo: ${corrigeNombre(String(filaB.jugador ?? ""))} es de otro puesto (${familiaFina(filaB) || "sin puesto"}); se le mide con las métricas y el universo de ${familia.toLowerCase()}.` : ""}
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
