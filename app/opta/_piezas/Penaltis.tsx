"use client";

/**
 * 11 METROS (09/11/2026): cada penalti de la categoría (`opta:penaltis`)
 * dibujado en la portería por donde cruzó la línea (GoalmouthY/Z), con
 * filtros por equipo, lanzador, portero, pie y marcador, y la ficha del
 * lanzador (acierto, lado preferido) y del portero (hacia dónde le tiran,
 * paradas). Pensado para preparar el penalti del próximo rival: abre con él
 * si el calendario lo dice y Opta lo reconoce.
 *
 * La portería se ve DESDE EL PUNTO DE PENALTI: la izquierda del dibujo es la
 * del lanzador (la derecha del portero).
 */

import { useMemo, useState } from "react";

import { useProximoRival } from "@/hooks/useAbpLigas";
import { tinta } from "@/components/data/graficas";
import { SOBRE_CESPED } from "@/components/campo/CampoOpta";
import { fechaCorta } from "@/lib/opta-analisis";
import {
  alturaDe,
  casaEquipo,
  LARGUERO,
  ladoDe,
  MARCADOR,
  PALO_DCHO,
  PALO_IZDO,
  resumenPenaltis,
  type Lado,
  type Penalti,
} from "@/lib/opta-eventos";

import { Botonera, Cifra, Elegir, Panel } from "./comun";
import { equiposDe, nombreDe, pct, usePenaltis } from "./eventos";
import type { DatosOpta } from "./useOpta";

/* La portería en centímetros: 732 × 244. Opta da 9,6 unidades de Y y 38 de Z entre palos y larguero. */
const CM_Y = 732 / (PALO_IZDO - PALO_DCHO);
const CM_Z = 244 / LARGUERO;
const sx = (y: number) => (PALO_IZDO - y) * CM_Y;
const sy = (z: number) => 244 - z * CM_Z;
const X_MIN = sx(58);
const X_MAX = sx(42);
const Y_MIN = sy(56);
const Y_MAX = 262;

const colorPenalti = (p: Penalti) => (p.gol ? SOBRE_CESPED.gol : p.parado ? SOBRE_CESPED.puerta : SOBRE_CESPED.palo);

function textoPenalti(p: Penalti) {
  return [
    `${fechaCorta(p.fecha)}`,
    `${p.tirador} (${nombreDe(p.teamId, p.equipo)})`,
    p.gol ? "gol" : p.parado ? "parado" : p.tipo === "Post" ? "al palo" : "fuera",
    p.portero ? `portero ${p.portero}` : "",
    p.pie === "Left Foot" ? "zurdo" : p.pie === "Right Foot" ? "diestro" : "",
    `${p.minuto}′`,
    MARCADOR[p.marcador]?.toLowerCase() ?? "",
  ]
    .filter(Boolean)
    .join(" · ");
}

export function Porteria({ penaltis, ariaLabel }: { penaltis: Penalti[]; ariaLabel: string }) {
  const [elegido, setElegido] = useState<Penalti | null>(null);
  const visto = elegido && penaltis.includes(elegido) ? elegido : null;
  const r = resumenPenaltis(penaltis);
  const conSitio = penaltis.filter((p) => p.gmY != null && p.gmZ != null);
  const anchoTercio = (PALO_IZDO - PALO_DCHO) / 3;

  return (
    <div className="min-w-0">
      <svg viewBox={`${X_MIN} ${Y_MIN} ${X_MAX - X_MIN} ${Y_MAX - Y_MIN}`} role="img" aria-label={ariaLabel} className="mx-auto block h-auto w-full max-w-[640px]">
        {/* La red: rejilla tenue entre los palos. */}
        <rect x={0} y={0} width={732} height={244} style={{ fill: tinta(0.04) }} />
        <g style={{ stroke: tinta(0.08), strokeWidth: 1.5 }}>
          {Array.from({ length: 23 }).map((_, i) => (
            <line key={`v${i}`} x1={(i + 1) * 30.5} y1={0} x2={(i + 1) * 30.5} y2={244} />
          ))}
          {Array.from({ length: 7 }).map((_, i) => (
            <line key={`h${i}`} x1={0} y1={(i + 1) * 30.5} x2={732} y2={(i + 1) * 30.5} />
          ))}
        </g>
        {/* Los tercios del lado y de la altura. */}
        <g style={{ stroke: tinta(0.25), strokeWidth: 2, strokeDasharray: "8 8" }}>
          <line x1={732 / 3} y1={0} x2={732 / 3} y2={244} />
          <line x1={(732 * 2) / 3} y1={0} x2={(732 * 2) / 3} y2={244} />
          <line x1={0} y1={244 / 3} x2={732} y2={244 / 3} />
          <line x1={0} y1={(244 * 2) / 3} x2={732} y2={(244 * 2) / 3} />
        </g>
        {/* El césped y los palos. */}
        <line x1={X_MIN} y1={244} x2={X_MAX} y2={244} style={{ stroke: tinta(0.35), strokeWidth: 3 }} />
        <path d="M 0 244 L 0 0 L 732 0 L 732 244" style={{ fill: "none", stroke: tinta(0.85), strokeWidth: 12, strokeLinejoin: "round" }} />

        {conSitio.map((p, i) => {
          const x = Math.min(X_MAX - 16, Math.max(X_MIN + 16, sx(p.gmY!)));
          const y = Math.min(Y_MAX - 16, Math.max(Y_MIN + 16, sy(p.gmZ!)));
          const marcado = visto === p;
          const color = colorPenalti(p);
          const hueco = !p.gol && !p.parado;
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={marcado ? 20 : 15}
              onClick={() => setElegido(marcado ? null : p)}
              style={{
                fill: hueco ? "transparent" : color,
                fillOpacity: 0.85,
                stroke: marcado ? tinta(0.95) : hueco ? color : "rgba(0,0,0,0.35)",
                strokeWidth: marcado ? 5 : hueco ? 4 : 2,
                cursor: "pointer",
              }}
            >
              <title>{textoPenalti(p)}</title>
            </circle>
          );
        })}

        {/* Cuántos por lado, encima del larguero. */}
        <g style={{ fill: tinta(0.6), fontSize: 26, fontWeight: 700 }} textAnchor="middle">
          {(["izquierda", "centro", "derecha"] as Lado[]).map((l, i) =>
            r.lados[l] ? (
              <text key={l} x={sx(PALO_IZDO - anchoTercio * (i + 0.5))} y={-22}>
                {`${r.lados[l]} · ${pct(r.n ? r.lados[l] / r.n : null)}`}
              </text>
            ) : null,
          )}
        </g>
      </svg>
      <p className="mt-1 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-white/55">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: SOBRE_CESPED.gol }} />
          Gol
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: SOBRE_CESPED.puerta }} />
          Parado
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ boxShadow: `inset 0 0 0 2px ${SOBRE_CESPED.palo}` }} />
          Fuera o al palo
        </span>
        <span>Vista desde el punto de penalti: la izquierda es la del lanzador (la derecha del portero).</span>
      </p>
      {visto && <p className="mt-1 text-center text-[12px] text-white/75">{textoPenalti(visto)}</p>}
    </div>
  );
}

const LADO_TEXTO: Record<Lado, string> = { izquierda: "a su izquierda", centro: "al centro", derecha: "a su derecha" };
const LADO_PORTERO: Record<Lado, string> = { izquierda: "a su derecha", centro: "al centro", derecha: "a su izquierda" };

function Lista({ penaltis, columna }: { penaltis: Penalti[]; columna: "portero" | "tirador" }) {
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full min-w-[480px] text-left text-[12px] tabular-nums">
        <thead>
          <tr className="border-b border-white/10 text-[11px] text-white/55">
            <th className="py-1.5 pr-2 font-semibold">Fecha</th>
            <th className="py-1.5 pr-2 font-semibold">{columna === "portero" ? "Portero" : "Lanzador"}</th>
            <th className="py-1.5 pr-2 font-semibold">Resultado</th>
            <th className="py-1.5 pr-2 font-semibold">Lado (lanzador)</th>
            <th className="py-1.5 pr-2 font-semibold">Altura</th>
            <th className="py-1.5 pr-2 text-right font-semibold">Min</th>
            <th className="py-1.5 font-semibold">Marcador</th>
          </tr>
        </thead>
        <tbody>
          {penaltis.map((p, i) => (
            <tr key={i} className="border-b border-white/[0.06]">
              <td className="py-1.5 pr-2 text-white/55">{fechaCorta(p.fecha)}</td>
              <td className="py-1.5 pr-2 text-white/85">{columna === "portero" ? p.portero : `${p.tirador} · ${nombreDe(p.teamId, p.equipo)}`}</td>
              <td className="py-1.5 pr-2 text-white/75">{p.gol ? "Gol" : p.parado ? "Parado" : p.tipo === "Post" ? "Palo" : "Fuera"}</td>
              <td className="py-1.5 pr-2 text-white/75">{ladoDe(p.gmY) ?? ""}</td>
              <td className="py-1.5 pr-2 text-white/75">{alturaDe(p.gmZ) ?? ""}</td>
              <td className="py-1.5 pr-2 text-right text-white/75">{p.minuto}′</td>
              <td className="py-1.5 text-white/75">{MARCADOR[p.marcador] ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type Papel = "lanzan" | "reciben";
type Pie = "todos" | "Right Foot" | "Left Foot";
type MarcadorFiltro = "todos" | "Tied" | "Ahead" | "Behind";

export function Penaltis({ datos }: { datos: DatosOpta }) {
  const { penaltis, cargando } = usePenaltis(datos);
  const equipos = useMemo(() => equiposDe(datos), [datos]);
  const proximo = useProximoRival();
  const sugerido = useMemo(() => (proximo ? casaEquipo(proximo, equipos) : null), [proximo, equipos]);

  const [equipoElegido, setEquipo] = useState<string | null>(null);
  const equipo = equipoElegido ?? sugerido ?? "todos";
  const [papel, setPapel] = useState<Papel>("lanzan");
  const [lanzador, setLanzador] = useState("");
  const [portero, setPortero] = useState("");
  const [pie, setPie] = useState<Pie>("todos");
  const [marcador, setMarcador] = useState<MarcadorFiltro>("todos");

  const delEquipo = useMemo(
    () => (equipo === "todos" ? penaltis : penaltis.filter((p) => (papel === "lanzan" ? p.teamId === equipo : p.rivalId === equipo))),
    [penaltis, equipo, papel],
  );
  const filtrados = useMemo(
    () =>
      delEquipo.filter(
        (p) => (!lanzador || p.tirador === lanzador) && (!portero || p.portero === portero) && (pie === "todos" || p.pie === pie) && (marcador === "todos" || p.marcador === marcador),
      ),
    [delEquipo, lanzador, portero, pie, marcador],
  );

  const lanzadores = useMemo(() => [...new Set(delEquipo.map((p) => p.tirador).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es")), [delEquipo]);
  const porteros = useMemo(() => [...new Set(delEquipo.map((p) => p.portero).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es")), [delEquipo]);

  /* La tabla de lanzadores y la de porteros, de lo filtrado por equipo. */
  const tablaLanzadores = useMemo(() => {
    const m = new Map<string, Penalti[]>();
    for (const p of delEquipo) m.set(p.tirador, [...(m.get(p.tirador) ?? []), p]);
    return [...m.entries()].map(([nombre, ps]) => ({ nombre, equipo: nombreDe(ps[0].teamId, ps[0].equipo), ...resumenPenaltis(ps) })).sort((a, b) => b.n - a.n || (b.pct ?? 0) - (a.pct ?? 0));
  }, [delEquipo]);
  const tablaPorteros = useMemo(() => {
    const m = new Map<string, Penalti[]>();
    for (const p of delEquipo) if (p.portero) m.set(p.portero, [...(m.get(p.portero) ?? []), p]);
    return [...m.entries()].map(([nombre, ps]) => ({ nombre, equipo: nombreDe(ps[0].rivalId, ps[0].rival), ...resumenPenaltis(ps) })).sort((a, b) => b.n - a.n || b.parados - a.parados);
  }, [delEquipo]);

  if (cargando) return <div className="mt-6 h-72 animate-pulse rounded-2xl bg-white/[0.05]" role="status" aria-label="Cargando los penaltis" />;
  if (!penaltis.length) return null;

  const r = resumenPenaltis(filtrados);
  const nombreEquipo = equipo === "todos" ? "" : nombreDe(equipo, equipos.find((e) => e.teamId === equipo)?.equipo ?? "");
  const deLanzador = lanzador ? resumenPenaltis(filtrados.filter((p) => p.tirador === lanzador)) : null;
  const dePortero = portero ? resumenPenaltis(filtrados.filter((p) => p.portero === portero)) : null;
  const pieLanzador = lanzador ? [...new Set(filtrados.filter((p) => p.tirador === lanzador).map((p) => p.pie))] : [];

  const limpia = () => {
    setLanzador("");
    setPortero("");
  };

  return (
    <div className="mt-6 space-y-4">
      <Panel
        titulo="11 metros"
        subtitulo={`Cada penalti de Primera RFEF esta temporada (Opta), por dónde entró en la portería.${sugerido && equipo === sugerido ? " Abre con el próximo rival." : ""}`}
        derecha={
          <Elegir
            etiqueta="Equipo"
            valor={equipo}
            alCambiar={(v) => {
              setEquipo(v);
              limpia();
            }}
            opciones={[{ clave: "todos", nombre: "Toda la categoría" }, ...equipos.map((e) => ({ clave: e.teamId, nombre: e.equipo }))]}
          />
        }
      >
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {equipo !== "todos" && (
            <Botonera
              etiqueta="Quién lanza"
              valor={papel}
              alCambiar={(v) => {
                setPapel(v);
                limpia();
              }}
              opciones={[
                { clave: "lanzan", nombre: "Los que lanza" },
                { clave: "reciben", nombre: "Los que le tiran" },
              ]}
            />
          )}
          <Botonera
            etiqueta="Pie"
            valor={pie}
            alCambiar={setPie}
            opciones={[
              { clave: "todos", nombre: "Los dos pies" },
              { clave: "Right Foot", nombre: "Diestros" },
              { clave: "Left Foot", nombre: "Zurdos" },
            ]}
          />
          <Botonera
            etiqueta="Marcador"
            valor={marcador}
            alCambiar={setMarcador}
            opciones={[
              { clave: "todos", nombre: "Cualquier marcador" },
              { clave: "Tied", nombre: "Empatando" },
              { clave: "Ahead", nombre: "Ganando" },
              { clave: "Behind", nombre: "Perdiendo" },
            ]}
          />
        </div>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          {lanzadores.length > 0 && (
            <Elegir
              etiqueta="Lanzador"
              valor={lanzador}
              alCambiar={setLanzador}
              opciones={[{ clave: "", nombre: "Todos" }, ...lanzadores.map((n) => ({ clave: n, nombre: n }))]}
            />
          )}
          {porteros.length > 0 && (
            <Elegir etiqueta="Portero" valor={portero} alCambiar={setPortero} opciones={[{ clave: "", nombre: "Todos" }, ...porteros.map((n) => ({ clave: n, nombre: n }))]} />
          )}
        </div>

        {filtrados.length ? (
          <>
            <div className="mb-3 grid gap-2 sm:grid-cols-4">
              <Cifra rotulo="Penaltis" valor={String(r.n)} detalle={nombreEquipo ? (papel === "lanzan" ? `lanzados por ${nombreEquipo}` : `en contra de ${nombreEquipo}`) : undefined} />
              <Cifra rotulo="Acierto" valor={pct(r.pct)} detalle={`${r.goles} goles`} />
              <Cifra rotulo="Parados" valor={String(r.parados)} detalle={r.fuera ? `${r.fuera} fuera o al palo` : undefined} />
              {r.preferido && <Cifra rotulo="Lado más repetido" valor={r.preferido.charAt(0).toUpperCase() + r.preferido.slice(1)} detalle="desde el punto de penalti" />}
            </div>
            <Porteria penaltis={filtrados} ariaLabel={`Dónde entran los penaltis${nombreEquipo ? ` de ${nombreEquipo}` : ""}`} />
          </>
        ) : (
          <p className="text-sm text-white/60">Con estos filtros no queda ningún penalti.</p>
        )}
      </Panel>

      {deLanzador && deLanzador.n > 0 && (
        <Panel titulo={`El lanzador: ${lanzador}`} subtitulo={pieLanzador.map((p) => (p === "Left Foot" ? "Zurdo" : p === "Right Foot" ? "Diestro" : "")).filter(Boolean).join(" y ")}>
          <p className="text-[13px] leading-relaxed text-white/80">
            {deLanzador.n === 1 ? "Un penalti" : `${deLanzador.n} penaltis`}, {deLanzador.goles} {deLanzador.goles === 1 ? "gol" : "goles"} ({pct(deLanzador.pct)}).{" "}
            {deLanzador.preferido
              ? `Suele tirarlo ${LADO_TEXTO[deLanzador.preferido]} (${deLanzador.lados[deLanzador.preferido]} de ${deLanzador.n}).`
              : deLanzador.n > 1
                ? "No repite lado."
                : ""}{" "}
            {deLanzador.alturas.raso === deLanzador.n && deLanzador.n > 1 ? "Siempre raso." : ""}
          </p>
          <Lista penaltis={filtrados.filter((p) => p.tirador === lanzador)} columna="portero" />
        </Panel>
      )}

      {dePortero && dePortero.n > 0 && (
        <Panel titulo={`El portero: ${portero}`}>
          <p className="text-[13px] leading-relaxed text-white/80">
            {dePortero.n === 1 ? "Le han tirado un penalti" : `Le han tirado ${dePortero.n} penaltis`}: {dePortero.goles} dentro y {dePortero.parados}{" "}
            {dePortero.parados === 1 ? "parado" : "parados"}
            {dePortero.fuera ? ` (${dePortero.fuera} fuera)` : ""}.{" "}
            {dePortero.preferido ? `Se los tiran sobre todo ${LADO_PORTERO[dePortero.preferido]} (${dePortero.lados[dePortero.preferido]} de ${dePortero.n}).` : ""}
          </p>
          <Lista penaltis={filtrados.filter((p) => p.portero === portero)} columna="tirador" />
        </Panel>
      )}

      {!lanzador && !portero && (
        <div className="grid gap-4 lg:grid-cols-2">
          {tablaLanzadores.length > 0 && (
            <Panel titulo="Lanzadores" subtitulo="Pincha uno para ver su ficha.">
              <TablaPersonas filas={tablaLanzadores} alElegir={setLanzador} tipo="lanzador" />
            </Panel>
          )}
          {tablaPorteros.length > 0 && (
            <Panel titulo="Porteros" subtitulo="Los penaltis que les han tirado. Pincha uno para ver su ficha.">
              <TablaPersonas filas={tablaPorteros} alElegir={setPortero} tipo="portero" />
            </Panel>
          )}
        </div>
      )}
    </div>
  );
}

function TablaPersonas({
  filas,
  alElegir,
  tipo,
}: {
  filas: ({ nombre: string; equipo: string } & ReturnType<typeof resumenPenaltis>)[];
  alElegir: (n: string) => void;
  tipo: "lanzador" | "portero";
}) {
  return (
    <div className="max-h-[420px] overflow-auto">
      <table className="w-full min-w-[380px] text-left text-[12px] tabular-nums">
        <thead>
          <tr className="border-b border-white/10 text-[11px] text-white/55">
            <th className="py-1.5 pr-2 font-semibold">{tipo === "lanzador" ? "Lanzador" : "Portero"}</th>
            <th className="py-1.5 pr-2 text-right font-semibold">Pen.</th>
            <th className="py-1.5 pr-2 text-right font-semibold">{tipo === "lanzador" ? "Goles" : "Encajados"}</th>
            <th className="py-1.5 pr-2 text-right font-semibold">Parados</th>
            <th className="py-1.5 text-right font-semibold">{tipo === "lanzador" ? "Acierto" : "% parado"}</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.nombre} onClick={() => alElegir(f.nombre)} className="cursor-pointer border-b border-white/[0.06] hover:bg-white/[0.04]">
              <td className="max-w-[200px] truncate py-1.5 pr-2 text-white/85">
                {f.nombre}
                <span className="ml-1 text-[10px] text-white/45">{f.equipo}</span>
              </td>
              <td className="py-1.5 pr-2 text-right text-white/75">{f.n}</td>
              <td className="py-1.5 pr-2 text-right text-white/75">{f.goles}</td>
              <td className="py-1.5 pr-2 text-right text-white/75">{f.parados}</td>
              <td className="py-1.5 text-right text-white/75">{tipo === "lanzador" ? pct(f.pct) : pct(f.n ? f.parados / f.n : null)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
