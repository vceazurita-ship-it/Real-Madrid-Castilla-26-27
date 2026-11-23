"use client";

/**
 * AMPLITUD POR BANDA (Scout colectivo, 18/11/2026). Por cada banda del rival,
 * qué parte de sus toques en el último tercio por el carril exterior es del
 * extremo y qué parte del lateral de esa banda. Si el lateral se lleva más de
 * la mitad, «el lateral da la amplitud» y se le nombra. Pinchar una barra abre
 * el plano de esos toques.
 *
 * Datos: `opta:directo:archivo` (qué partidos tienen evento a evento) y
 * `opta:directo:<partido>` de sus últimos partidos, por `useDocsOpta`. Las
 * cuentas, en `lib/rivals/amplitud-banda.ts`. Sin cruce o sin dato, no se
 * pinta. Nada se pide hasta que asoma.
 */

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import { COMPARADO, ORO, tinta } from "@/components/data/graficas";
import { CampoOpta, SOBRE_CESPED } from "@/components/campo/CampoOpta";
import { useAsoma } from "@/hooks/useAsoma";
import { useDocsOpta } from "@/hooks/useDocsOpta";
import { aObjetos, CASTILLA_OPTA, DOCS_OPTA, type TablaOpta } from "@/lib/opta";
import { casaEquipo } from "@/lib/opta-eventos";
import { leeEventos, leeJugadores } from "@/lib/opta-directo-mapas";
import { nombreDePlantilla } from "@/lib/rivals/nombre-jugador";
import {
  amplitudBanda,
  MAX_PARTIDOS,
  X_MIN,
  Y_DERECHA,
  Y_IZQUIERDA,
  type Banda,
  type Lado,
  type Rol,
  type ToqueBanda,
} from "@/lib/rivals/amplitud-banda";

type PartidoArchivo = { partido?: string; fecha?: string; equipos?: string[] };
type Archivo = { partidos?: PartidoArchivo[] };
type DocDirecto = { partido?: string; fecha?: string; eventos?: TablaOpta; jugadores?: TablaOpta };

const pct = (v: number) => `${Math.round(v * 100)} %`;
const COLOR: Record<Exclude<Rol, "otro">, string> = { extremo: COMPARADO, lateral: ORO };
const LADO: Record<Lado, { suya: string; nuestra: string }> = {
  derecha: { suya: "Su banda derecha", nuestra: "nuestra izquierda" },
  izquierda: { suya: "Su banda izquierda", nuestra: "nuestra derecha" },
};

export function AmplitudBanda({ equipo, nombres = [] }: { equipo: string; nombres?: string[] }) {
  const { caja, abierto } = useAsoma<HTMLDivElement>(2000);
  return <div ref={caja} className="min-w-0">{abierto && <Indice equipo={equipo} nombres={nombres} />}</div>;
}

/** Primero, qué partidos suyos tienen evento a evento. */
function Indice({ equipo, nombres }: { equipo: string; nombres: string[] }) {
  const { docs } = useDocsOpta<[TablaOpta, Archivo]>(DOCS_OPTA.equipos, "opta:directo:archivo");
  const [tEquipos, archivo] = docs;

  const rival = useMemo(() => {
    if (!tEquipos) return null;
    const equipos = aObjetos(tEquipos).map((f) => ({ teamId: String(f.teamId ?? ""), equipo: String(f.equipo ?? "") }));
    const id = casaEquipo(equipo, equipos);
    if (!id || id === CASTILLA_OPTA) return null;
    return { id, nombre: equipos.find((e) => e.teamId === id)?.equipo || equipo };
  }, [tEquipos, equipo]);

  const ids = useMemo(() => {
    if (!rival || !Array.isArray(archivo?.partidos)) return [];
    return archivo.partidos
      .filter((p) => p?.partido && (p.equipos ?? []).includes(rival.nombre))
      .sort((a, b) => String(b.fecha ?? "").localeCompare(String(a.fecha ?? "")))
      .slice(0, MAX_PARTIDOS)
      .map((p) => String(p.partido));
  }, [rival, archivo]);

  if (!rival || !ids.length) return null;
  return <Bloque teamId={rival.id} nombre={rival.nombre} ids={ids} nombres={nombres} />;
}

function Bloque({ teamId, nombre, ids, nombres }: { teamId: string; nombre: string; ids: string[]; nombres: string[] }) {
  const { docs } = useDocsOpta<DocDirecto[]>(...ids.map(DOCS_OPTA.directo));
  const [plano, setPlano] = useState<{ lado: Lado; rol: Exclude<Rol, "otro"> } | null>(null);

  const datos = useMemo(() => {
    const partidos = docs
      .map((d, i) => (d ? { partido: ids[i], fecha: String(d.fecha ?? ""), eventos: leeEventos(d.eventos), jugadores: leeJugadores(d.jugadores) } : null))
      .filter((p): p is NonNullable<typeof p> => p != null && p.eventos.length > 0);
    return partidos.length ? amplitudBanda(partidos, teamId) : null;
  }, [docs, ids, teamId]);

  if (!datos) return null;
  const visto = (n: string) => nombreDePlantilla(n, nombres) || n;
  const conLateral = [datos.derecha, datos.izquierda].filter((b) => b.daLateral && b.laterales[0]);
  const titular = conLateral.length
    ? conLateral.length === 2
      ? "Los dos laterales le dan la amplitud"
      : `Por su ${conLateral[0].lado}, la amplitud la da el lateral`
    : "La amplitud la dan sus extremos";
  const explica = conLateral.length
    ? `${conLateral.map((b) => `${visto(b.laterales[0].nombre)} (${pct(b.pctLateral)} de los toques por fuera en su ${b.lado})`).join(" y ")}: ahí su extremo se mete dentro y nuestro extremo tiene que seguir al lateral hasta abajo; nuestro lateral cierra por dentro.`
    : `En las dos bandas el lateral se queda en la mitad o menos de los toques por fuera: nuestro extremo puede quedarse arriba para salir a la contra.`;

  return (
    <section id="x-idea-2122967480457158743-1" aria-label="Amplitud por banda" className="portada-tarjeta portada-entra mt-8 min-w-0 px-4 py-4 sm:px-5">
      <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#C8A96B]">
        Amplitud por banda · ¿quién le da el ancho?
        <span className="rounded-full border border-white/15 px-2 py-0.5 text-[11px] font-semibold normal-case tracking-normal text-white/60">
          dato · Opta, {datos.partidos} {datos.partidos === 1 ? "partido" : "partidos"} de {nombre}
        </span>
      </p>
      <h3 className="fuente-club mt-1.5 text-[26px] font-bold uppercase leading-[1.05] text-white sm:text-[32px]">{titular}</h3>
      <p className="mt-1 text-sm leading-6 text-white/70">{explica}</p>

      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
        {/* Su izquierda primero: así se ve como en el campo, atacando hacia arriba. */}
        {[datos.izquierda, datos.derecha].map((b) => (
          <TarjetaBanda key={b.lado} banda={b} visto={visto} alPinchar={(rol) => setPlano({ lado: b.lado, rol })} />
        ))}
      </div>

      <p className="mt-2 text-[11px] leading-5 text-white/55">
        Toques de {nombre} en el último tercio (x &gt; {X_MIN}) por el carril exterior (y &lt; {Y_DERECHA} o y &gt; {Y_IZQUIERDA}). Extremo y lateral, los del once de cada partido: el
        defensa y el de más arriba que más abiertos juegan por ese lado (si se van, quien entra con su puesto). «El lateral da la amplitud» si se lleva más de la mitad. Pincha una barra para ver
        esos toques.
      </p>

      {plano && (
        <Plano
          toques={datos.toques.filter((t) => t.lado === plano.lado && t.rol === plano.rol)}
          titulo={`${LADO[plano.lado].suya} · ${plano.rol === "lateral" ? "el lateral" : "el extremo"}`}
          color={COLOR[plano.rol]}
          visto={visto}
          alCerrar={() => setPlano(null)}
        />
      )}
    </section>
  );
}

function TarjetaBanda({ banda, visto, alPinchar }: { banda: Banda; visto: (n: string) => string; alPinchar: (rol: Exclude<Rol, "otro">) => void }) {
  const lateral = banda.laterales[0];
  return (
    <div className="portada-celda min-w-0 px-3 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
        <p className="text-sm font-bold text-white">
          {LADO[banda.lado].suya} <span className="font-normal text-white/55">· {LADO[banda.lado].nuestra}</span>
        </p>
        <span className="text-[12px] tabular-nums text-white/55">{banda.total} toques por fuera</span>
      </div>
      {banda.daLateral && lateral && (
        <p className="mt-1.5 inline-flex rounded-full px-2 py-0.5 text-[12px] font-semibold" style={{ color: ORO, border: `1px solid ${ORO}` }}>
          El lateral da la amplitud: {visto(lateral.nombre)}
        </p>
      )}
      <div className="mt-2 space-y-2">
        <Barra rol="extremo" parte={banda.pctExtremo} toques={banda.extremo} quien={banda.extremos} visto={visto} alPinchar={() => alPinchar("extremo")} />
        <Barra rol="lateral" parte={banda.pctLateral} toques={banda.lateral} quien={banda.laterales} visto={visto} alPinchar={() => alPinchar("lateral")} />
      </div>
      {banda.otros > 0 && <p className="mt-1.5 text-[11px] text-white/50">Otros (puntas, interiores, cambios): {pct(banda.total ? banda.otros / banda.total : 0)}</p>}
    </div>
  );
}

function Barra({
  rol,
  parte,
  toques,
  quien,
  visto,
  alPinchar,
}: {
  rol: Exclude<Rol, "otro">;
  parte: number;
  toques: number;
  quien: { nombre: string; toques: number }[];
  visto: (n: string) => string;
  alPinchar: () => void;
}) {
  const nombres = quien.slice(0, 2).map((q) => visto(q.nombre)).join(", ");
  return (
    <button
      type="button"
      onClick={alPinchar}
      disabled={!toques}
      className="block w-full min-w-0 rounded-lg px-1 py-1 text-left transition hover:bg-white/[0.04] disabled:cursor-default disabled:hover:bg-transparent"
      aria-label={`${rol === "extremo" ? "Extremo" : "Lateral"}: ${pct(parte)}, ${toques} toques. Ver el plano`}
    >
      <span className="flex items-baseline justify-between gap-2 text-[12px]">
        <span className="min-w-0 truncate text-white/75">
          <span className="font-semibold text-white">{rol === "extremo" ? "Extremo" : "Lateral"}</span>
          {nombres && <span className="text-white/55"> · {nombres}</span>}
        </span>
        <span className="fuente-club shrink-0 text-[18px] font-bold tabular-nums" style={{ color: COLOR[rol] }}>
          {pct(parte)}
        </span>
      </span>
      <span className="mt-1 block h-2.5 w-full overflow-hidden rounded-full" style={{ background: tinta(0.08) }}>
        <span className="block h-full rounded-full" style={{ width: `${Math.max(parte * 100, toques ? 2 : 0)}%`, background: COLOR[rol] }} />
      </span>
    </button>
  );
}

function Plano({ toques, titulo, color, visto, alCerrar }: { toques: ToqueBanda[]; titulo: string; color: string; visto: (n: string) => string; alCerrar: () => void }) {
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") alCerrar();
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [alCerrar]);

  if (typeof document === "undefined") return null;
  const partidos = new Set(toques.map((t) => t.partido)).size;
  const quienes = [...toques.reduce((m, t) => m.set(t.nombre, (m.get(t.nombre) ?? 0) + 1), new Map<string, number>())].sort((a, b) => b[1] - a[1]);
  /* El color de los puntos va sobre el césped (oscuro en los dos temas): el oro del lateral, el del césped. */
  const punto = color === ORO ? SOBRE_CESPED.nuestro : SOBRE_CESPED.puerta;

  return createPortal(
    <div
      /* El fondo lo pone `.modal-veil`, no `bg-black/NN` (modo día). */
      className="modal-veil fixed inset-0 z-[85] flex items-start justify-center overflow-y-auto p-3 sm:p-6"
      data-export-hide
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
      onClick={(e) => {
        e.stopPropagation();
        alCerrar();
      }}
    >
      <div className="my-auto w-full max-w-lg min-w-0 overflow-hidden rounded-[22px] border border-white/12 bg-[#11161D] shadow-[0_24px_80px_rgba(0,0,0,.6)]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-white/[0.08] px-4 py-3 sm:px-5 sm:py-4">
          <div className="min-w-0">
            <p className="text-[12px] uppercase tracking-[0.28em] text-[#C8A96B]">Amplitud por banda</p>
            <h2 className="mt-1 break-words text-lg font-semibold text-white">{titulo}</h2>
            <p className="mt-0.5 text-[13px] text-white/60">
              {toques.length} toques en {partidos} {partidos === 1 ? "partido" : "partidos"} · ataca hacia arriba
            </p>
          </div>
          <button type="button" onClick={alCerrar} aria-label="Cerrar" className="shrink-0 rounded-xl border border-white/10 bg-white/[0.04] p-2 text-white/60 transition hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-w-0 px-4 py-4 sm:px-5">
          <CampoOpta vertical mitad ariaLabel={`${titulo}: cada punto, un toque`} maxAlto={420}>
            {(proyecta) => {
              const [ax, ay] = proyecta(100, Y_DERECHA);
              const [bx, by] = proyecta(X_MIN, 0);
              const [cx, cy] = proyecta(100, 100);
              const [dx, dy] = proyecta(X_MIN, Y_IZQUIERDA);
              return (
                <g>
                  {/* Los dos carriles del último tercio que se cuentan. */}
                  <rect x={Math.min(ax, bx)} y={Math.min(ay, by)} width={Math.abs(bx - ax)} height={Math.abs(by - ay)} style={{ fill: "rgba(255,255,255,0.06)" }} />
                  <rect x={Math.min(cx, dx)} y={Math.min(cy, dy)} width={Math.abs(dx - cx)} height={Math.abs(dy - cy)} style={{ fill: "rgba(255,255,255,0.06)" }} />
                  {toques.map((t, i) => {
                    const [x, y] = proyecta(t.x, t.y);
                    return (
                      <circle key={i} cx={x} cy={y} r={9} style={{ fill: punto, fillOpacity: 0.75, stroke: "#0A1A12", strokeWidth: 2 }}>
                        <title>{`${visto(t.nombre)} · ${t.minuto}′`}</title>
                      </circle>
                    );
                  })}
                </g>
              );
            }}
          </CampoOpta>
          {quienes.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-white/70">
              {quienes.map(([n, c]) => (
                <li key={n}>
                  <span className="font-semibold text-white">{visto(n) || "Sin nombre"}</span> · {c}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
