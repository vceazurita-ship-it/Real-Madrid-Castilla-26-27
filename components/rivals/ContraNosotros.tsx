"use client";

/**
 * CONTRA NOSOTROS (Plantillas rivales, 27/11/2026, idea de X).
 *
 * Si ya jugamos contra el rival y Opta tiene el evento a evento de ese
 * partido: lo que hizo cada jugador suyo contra el Castilla (recibidos entre
 * líneas, pases progresivos y xT) frente a su media por 90′ en el resto de sus
 * partidos leídos, marcado si la pasa en más de un 30 %.
 *
 * - `AvisoContraNosotros`: encima de la plantilla, los dos o tres que más
 *   destacaron.
 * - `FranjaContraNosotros`: en la ficha del jugador, sus tres cifras.
 *
 * Datos: `opta:equipos`, `opta:directo:archivo` y `opta:directo:<partido>`
 * (por `useDocsOpta`, la misma caché y los mismos partidos que «Quién crea la
 * amenaza»). Las cuentas, en `lib/rivals/contra-nosotros.ts`.
 */

import { useMemo, type ReactNode } from "react";

import { useAsoma } from "@/hooks/useAsoma";
import { useDocsOpta } from "@/hooks/useDocsOpta";
import { aObjetos, CASTILLA_OPTA, DOCS_OPTA, type TablaOpta } from "@/lib/opta";
import { casaEquipo } from "@/lib/opta-eventos";
import { leeEventos, leeJugadores } from "@/lib/opta-directo-mapas";
import { MAX_PARTIDOS_XT, type PartidoXT } from "@/lib/rivals/amenaza-xt";
import {
  destacadosContra,
  METRICAS,
  MIN_MINUTOS_MEDIA,
  rendimientoContraNosotros,
  UMBRAL_SOBRE_MEDIA,
  type JugadorContra,
  type MetricaContra,
} from "@/lib/rivals/contra-nosotros";
import { nombreDePlantilla } from "@/lib/rivals/nombre-jugador";

type PartidoArchivo = { partido?: string; fecha?: string; equipos?: string[] };
type Archivo = { partidos?: PartidoArchivo[] };
type DocDirecto = { partido?: string; fecha?: string; eventos?: TablaOpta; jugadores?: TablaOpta };

export type DatosContra = { lista: JugadorContra[]; fecha: string; resto: number; rival: string };

const coma = (v: number, d: number) => v.toFixed(d).replace(".", ",");
const fechaCorta = (f: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(f);
  return m ? `${m[3]}/${m[2]}` : f;
};
const pct = (v: number) => `${v >= 0 ? "+" : ""}${Math.round(v * 100)} %`;

/* ------------------------------ carga ------------------------------ */

function Carga({ equipo, children }: { equipo: string; children: (d: DatosContra) => ReactNode }) {
  const { docs } = useDocsOpta<[TablaOpta, Archivo]>(DOCS_OPTA.equipos, "opta:directo:archivo");
  const [tEquipos, archivo] = docs;

  const plan = useMemo(() => {
    if (!tEquipos || !Array.isArray(archivo?.partidos)) return null;
    const equipos = aObjetos(tEquipos).map((f) => ({ teamId: String(f.teamId ?? ""), equipo: String(f.equipo ?? "") }));
    const id = casaEquipo(equipo, equipos);
    const castilla = equipos.find((e) => e.teamId === CASTILLA_OPTA)?.equipo;
    if (!id || id === CASTILLA_OPTA || !castilla) return null;
    const nombre = equipos.find((e) => e.teamId === id)?.equipo || equipo;
    const suyos = archivo.partidos
      .filter((p) => p?.partido && (p.equipos ?? []).includes(nombre))
      .sort((a, b) => String(b.fecha ?? "").localeCompare(String(a.fecha ?? "")));
    const contra = suyos.find((p) => (p.equipos ?? []).includes(castilla));
    if (!contra) return null;
    const resto = suyos.filter((p) => p !== contra).slice(0, MAX_PARTIDOS_XT).map((p) => String(p.partido));
    return { teamId: id, nombre, contra: String(contra.partido), fecha: String(contra.fecha ?? ""), resto };
  }, [tEquipos, archivo, equipo]);

  if (!plan) return null;
  return <Calcula key={`${plan.teamId}|${plan.contra}`} {...plan}>{children}</Calcula>;
}

const hechos = new WeakMap<object, Map<string, DatosContra | null>>();

function Calcula({
  teamId,
  nombre,
  contra,
  fecha,
  resto,
  children,
}: {
  teamId: string;
  nombre: string;
  contra: string;
  fecha: string;
  resto: string[];
  children: (d: DatosContra) => ReactNode;
}) {
  const { docs, cargando } = useDocsOpta<DocDirecto[]>(DOCS_OPTA.directo(contra), ...resto.map(DOCS_OPTA.directo));
  if (cargando) return null;
  const [docContra, ...otros] = docs as (DocDirecto | null)[];
  if (!docContra) return null;

  const clave = `${teamId}|${resto.join(",")}|${otros.map((d) => (d ? 1 : 0)).join("")}`;
  const guardados = hechos.get(docContra) ?? new Map<string, DatosContra | null>();
  hechos.set(docContra, guardados);
  if (!guardados.has(clave)) {
    const aPartido = (d: DocDirecto | null, partido: string): PartidoXT | null =>
      d ? { partido, eventos: leeEventos(d.eventos), jugadores: leeJugadores(d.jugadores) } : null;
    const pc = aPartido(docContra, contra);
    const demas = otros.map((d, i) => aPartido(d, resto[i])).filter((p): p is PartidoXT => p != null && p.eventos.length > 0);
    const lista = pc && pc.eventos.length ? rendimientoContraNosotros(pc, demas, teamId) : [];
    guardados.set(clave, lista.length ? { lista, fecha, resto: demas.length, rival: nombre } : null);
  }
  const datos = guardados.get(clave);
  return datos ? <>{children(datos)}</> : null;
}

/* ------------------------------ piezas ------------------------------ */

function Chapa({ m }: { m: MetricaContra }) {
  const meta = METRICAS.find((x) => x.clave === m.clave)!;
  return (
    <span
      className={`inline-flex items-baseline gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold tabular-nums ${
        m.marcada ? "border-amber-400/60 text-amber-300" : "border-white/15 text-white/65"
      }`}
      title={`${meta.nombre}: ${coma(m.contra, meta.decimales)} contra nosotros (${coma(m.contra90, meta.decimales === 0 ? 1 : 2)} por 90′)${
        m.media90 != null ? `; su media, ${coma(m.media90, meta.decimales === 0 ? 1 : 2)} por 90′` : ""
      }`}
    >
      {meta.corto} {coma(m.contra, meta.decimales)}
      {m.sobreMedia != null && <span className="font-bold">{pct(m.sobreMedia)}</span>}
    </span>
  );
}

const nombreDe = (j: JugadorContra, nombres: string[]) => nombreDePlantilla(j.jugador, nombres) || j.jugador;

/** Encima de la plantilla: los dos o tres que más destacaron contra nosotros. */
export function AvisoContraNosotros({ equipo, nombres = [] }: { equipo: string; nombres?: string[] }) {
  const { caja, abierto } = useAsoma<HTMLDivElement>();
  return (
    <div ref={caja} className="min-w-0">
      {abierto && equipo && (
        <Carga equipo={equipo}>
          {(d) => {
            const top = destacadosContra(d.lista);
            return (
              <section
                id="x-idea-2126336488220578013-1"
                aria-label="Contra nosotros"
                className="portada-tarjeta portada-entra mt-4 min-w-0 border-l-4 border-l-amber-400/70 px-4 py-3 sm:px-5"
              >
                <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#C8A96B]">
                  Contra nosotros · {fechaCorta(d.fecha)}
                  <span
                    className="rounded-full border border-white/15 px-2 py-0.5 text-[11px] font-semibold normal-case tracking-normal text-white/60"
                    title={`Opta, evento a evento del partido contra el Castilla; la media, de sus otros ${d.resto} partidos leídos`}
                  >
                    dato · Opta, media de {d.resto} partidos
                  </span>
                </p>
                {top.length ? (
                  <>
                    <h3 className="fuente-club mt-1 text-[17px] font-bold leading-snug text-white sm:text-[19px]">
                      {top.length === 1 ? "Quien ya sabe hacernos daño: " : `Los ${top.length} que ya saben hacernos daño: `}
                      {top.map((j) => nombreDe(j, nombres)).join(", ")}
                    </h3>
                    <ul className="mt-2 space-y-1.5">
                      {top.map((j) => (
                        <li key={j.playerId} className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
                          <span className="font-semibold text-white">{nombreDe(j, nombres)}</span>
                          <span className="text-[11px] text-white/50">{Math.round(j.minutosContra)}′</span>
                          {j.metricas.map((m) => (
                            <Chapa key={m.clave} m={m} />
                          ))}
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p className="mt-1 text-sm text-white/70">Nadie de {d.rival} pasó su media en más de un {Math.round(UMBRAL_SOBRE_MEDIA * 100)} % contra nosotros.</p>
                )}
                <p className="mt-2 text-[11px] leading-4 text-white/50">
                  Lo de ese partido frente a su media por 90′ en el resto (con {MIN_MINUTOS_MEDIA}′ o más); en ámbar, más de un {Math.round(UMBRAL_SOBRE_MEDIA * 100)} % por encima. El detalle, en la ficha de cada jugador.
                </p>
              </section>
            );
          }}
        </Carga>
      )}
    </div>
  );
}

/** En la ficha del jugador: sus tres cifras contra nosotros frente a su media. */
export function FranjaContraNosotros({ equipo, jugador, nombres = [] }: { equipo: string; jugador: string; nombres?: string[] }) {
  if (!equipo || !jugador.trim()) return null;
  return (
    <Carga equipo={equipo}>
      {(d) => {
        const lista = nombres.length ? nombres : [jugador];
        const casan = d.lista.filter((j) => nombreDePlantilla(j.jugador, lista) === jugador);
        if (casan.length !== 1) return null;
        const j = casan[0];
        return (
          <section aria-label="Contra nosotros" className="mt-5 min-w-0 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3">
            <p className="flex flex-wrap items-baseline gap-x-2 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#C8A96B]">
              Contra nosotros · {fechaCorta(d.fecha)}
              <span className="text-[11px] font-semibold normal-case tracking-normal text-white/55">
                {Math.round(j.minutosContra)}′ · media de {j.partidosMedia} partidos ({Math.round(j.minutosMedia)}′) · Opta
              </span>
              {j.marcadas > 0 && (
                <span className="rounded-full border border-amber-400/60 px-2 py-0.5 text-[11px] font-bold normal-case tracking-normal text-amber-300">
                  ⚠ nos hizo daño
                </span>
              )}
            </p>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
              {j.metricas.map((m) => {
                const meta = METRICAS.find((x) => x.clave === m.clave)!;
                const d90 = meta.decimales === 0 ? 1 : 2;
                return (
                  <div key={m.clave} className={`min-w-0 rounded-xl border px-3 py-2 ${m.marcada ? "border-amber-400/60" : "border-white/10"}`}>
                    <p className="text-[11px] font-semibold text-white/55">{meta.nombre}</p>
                    <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2 tabular-nums">
                      <span className={`text-[20px] font-bold ${m.marcada ? "text-amber-300" : "text-white"}`}>{coma(m.contra, meta.decimales)}</span>
                      <span className="text-[12px] text-white/60">{coma(m.contra90, d90)}/90</span>
                    </p>
                    <p className="text-[12px] text-white/60 tabular-nums">
                      {m.media90 != null ? (
                        <>
                          su media {coma(m.media90, d90)}/90
                          {m.sobreMedia != null && <span className={`ml-1 font-semibold ${m.marcada ? "text-amber-300" : ""}`}>{pct(m.sobreMedia)}</span>}
                        </>
                      ) : (
                        `poca muestra para su media (menos de ${MIN_MINUTOS_MEDIA}′)`
                      )}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        );
      }}
    </Carga>
  );
}
