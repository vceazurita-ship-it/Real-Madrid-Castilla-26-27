"use client";

/**
 * LO MEJOR DE CADA JORNADA (laboratorio de ABP, 25/10/2026).
 *
 * Las cinco mejores acciones a balón parado de cada jornada de Primera RFEF
 * (los dos grupos), LaLiga EA Sports, Segunda, la Premier y la Champions,
 * sacadas de Wyscout cada mañana (`scripts/wyscout-abp-acciones.mjs` →
 * `abp-acciones.cjs`). Goles primero, luego xG. Cada tarjeta dibuja la acción
 * si Wyscout da los puntos y la lleva al taller como borrador de rutina:
 * lanzador, rematador y el vuelo del balón hasta donde cayó.
 *
 * Los clips de Wyscout no tienen enlace (ver la memoria de la descarga): el
 * botón de vídeo lleva al resumen oficial del partido en YouTube
 * (`scripts/abp-videos-youtube.mjs`), en el segundo de la acción cuando se
 * sabe sin duda. Sin resumen encontrado, el botón no sale.
 */

import { useEffect, useMemo, useState } from "react";
import { FlaskConical, Target } from "lucide-react";

import { Notice } from "@/components/abp/ui";
import { ClipAccion } from "@/components/abp-lab/ClipAccion";
import { Patrones } from "@/components/abp-lab/Patrones";
import type { JugadorLab } from "@/components/abp-lab/comun";
import { MiniPizarra } from "@/components/abp-lab/PizarraRutina";
import { borradorVacio, type Borrador } from "@/components/abp-lab/Taller";
import { useAbpAcciones } from "@/hooks/useAbpAcciones";
import {
  RESULTADO_ACCION,
  TIPO_ACCION,
  ZONA_TEXTO,
  dibujable,
  enMetros,
  relatoDe,
  jugadaTexto,
  rutinaDeAccion,
  ultimaJornada,
  xgTexto,
  zonaDe,
  type Accion,
  type CompeticionAcciones,
  type JornadaAcciones,
  type TipoAccion,
} from "@/lib/abp-lab/acciones";

const SIN_JUGADORES = new Map<string, JugadorLab>();

const TONO_RESULTADO: Record<Accion["r"], string> = {
  gol: "bg-emerald-400/15 text-emerald-300",
  puerta: "bg-sky-400/15 text-sky-300",
  palo: "bg-amber-400/15 text-amber-300",
  bloqueado: "bg-white/10 text-white/60",
  fuera: "bg-white/10 text-white/60",
};

const fecha = (f: string) => `${f.slice(8, 10)}/${f.slice(5, 7)}`;

/** «4 córneres · 2 faltas»: sólo lo que hay. */
function reparto(j: JornadaAcciones) {
  const plural: Record<TipoAccion, [string, string]> = {
    corner: ["córner", "córneres"],
    falta: ["falta", "faltas"],
    directa: ["falta directa", "faltas directas"],
    banda: ["saque de banda", "saques de banda"],
    penalti: ["penalti", "penaltis"],
  };

  return (Object.entries(j.porTipo) as [TipoAccion, number][])
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([t, n]) => `${n} ${plural[t][n === 1 ? 0 : 1]}`)
    .join(" · ");
}

function Tarjeta({
  accion: a,
  puesto,
  competicion,
  jornada,
  onAlTaller,
}: {
  accion: Accion;
  puesto: number;
  competicion: CompeticionAcciones;
  jornada: JornadaAcciones;
  onAlTaller: (b: Borrador) => void;
}) {
  const dibujo = useMemo(() => rutinaDeAccion(a), [a]);

  const { saque, caida } = enMetros(a);

  const directo = a.t === "directa" || a.t === "penalti";

  const zona = caida && !directo ? ZONA_TEXTO[zonaDe(caida, saque)] : "";

  const alTaller = () =>
    onAlTaller({
      ...borradorVacio(),
      nombre: `${a.eq ?? TIPO_ACCION[a.t]} · ${TIPO_ACCION[a.t].toLowerCase()} ${a.min}'`,
      tipo: dibujo.tipo,
      idea: relatoDe(a, competicion.nombre, jornada.etiqueta),
      roles: dibujo.roles,
      balon: dibujo.balon,
    });

  return (
    <article className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
      {dibujable(a) && (
        <div className="border-b border-white/10">
          <MiniPizarra rutina={{ nombre: dibujo.nombre, senal: "", tipo: dibujo.tipo, lado: "ofensivo", contra: "cualquiera", roles: dibujo.roles, balon: dibujo.balon }} porId={SIN_JUGADORES} toquesRival={dibujo.rivales} rotulosNota />
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col gap-2.5 p-3.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="flex h-6 min-w-6 items-center justify-center rounded-md px-1.5 text-[12px] font-black" style={{ background: "#C8A96B", color: "#0B0F14" }}>
            {puesto}
          </span>
          <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] font-semibold text-white/75">{TIPO_ACCION[a.t]}</span>
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${TONO_RESULTADO[a.r]}`}>{RESULTADO_ACCION[a.r]}</span>
          {a.xg !== undefined && <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] tabular-nums text-white/60">xG {xgTexto(a.xg)}</span>}
        </div>

        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white/90">
            {a.eq ?? a.p}
            {a.rival && <span className="font-normal text-white/50"> ante {a.rival}</span>}
          </p>
        </div>

        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-[12px]">
          {a.lz && (
            <>
              <dt className="text-white/45">Saca</dt>
              <dd className="truncate text-white/80">{a.lz}</dd>
            </>
          )}
          {a.rm && (
            <>
              <dt className="text-white/45">{directo ? "Lanza" : "Remata"}</dt>
              <dd className="truncate text-white/80">
                {a.rm}
                {a.cabeza ? " · de cabeza" : ""}
              </dd>
            </>
          )}
          {a.pasos && a.pasos.length > 0 && (
            <>
              <dt className="text-white/45">Jugada</dt>
              <dd className="text-white/80">{jugadaTexto(a)}</dd>
            </>
          )}
          {zona && (
            <>
              <dt className="text-white/45">Cae</dt>
              <dd className="truncate text-white/80">{zona}</dd>
            </>
          )}
          {a.tras !== undefined && a.tras > 4 && (
            <>
              <dt className="text-white/45">Remate</dt>
              <dd className="truncate text-white/80">a los {a.tras} s del saque</dd>
            </>
          )}
        </dl>

        <div className="mt-auto space-y-2">
          <ClipAccion accion={a} competicion={competicion.nombre} jornada={jornada.etiqueta} videos={competicion.videos} />
          <button
            type="button"
            onClick={alTaller}
            className="inline-flex w-full min-w-0 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[12px] font-semibold text-[#C8A96B] transition hover:bg-white/[0.08]"
          >
            <FlaskConical size={14} className="shrink-0" />
            Al taller
          </button>
        </div>
      </div>
    </article>
  );
}

export function MejorJornada({ onAlTaller }: { onAlTaller: (b: Borrador) => void }) {
  const { datos, fallo } = useAbpAcciones();

  const [slug, setSlug] = useState<string | null>(null);

  const [indice, setIndice] = useState<number | null>(null);

  const [vista, setVistaEstado] = useState<"top" | "patrones">("top");

  /* La vista va en la dirección (`&vista=patrones`): al recargar o enlazar se abre la misma (25/10/2026). */
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("vista") === "patrones") void Promise.resolve().then(() => setVistaEstado("patrones"));
  }, []);

  const setVista = (v: "top" | "patrones") => {
    setVistaEstado(v);

    const url = new URL(window.location.href);

    if (v === "patrones") url.searchParams.set("vista", v);
    else url.searchParams.delete("vista");

    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  };

  const competiciones = (datos?.competiciones ?? []).filter((c) => c.jornadas.length);

  if (fallo) {
    return (
      <Notice tone="warn" title="No se ha podido leer lo mejor de cada jornada">
        Vuelve a cargar la página en un momento.
      </Notice>
    );
  }

  if (!datos) return <div className="h-64 animate-pulse rounded-2xl bg-white/[0.03]" aria-busy="true" aria-label="Cargando" />;

  if (!competiciones.length) return null;

  const comp = competiciones.find((c) => c.slug === slug) ?? competiciones[0];

  const i = indice !== null && indice < comp.jornadas.length ? indice : ultimaJornada(comp);

  const jornada = comp.jornadas[i];

  const resumen = [
    `${jornada.partidos} ${jornada.partidos === 1 ? "partido" : "partidos"}`,
    jornada.acciones ? `${jornada.acciones} ${jornada.acciones === 1 ? "acción a balón parado con remate" : "acciones a balón parado con remate"}` : "",
    jornada.goles ? `${jornada.goles} ${jornada.goles === 1 ? "gol" : "goles"}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  const tipos = reparto(jornada);

  return (
    <section className="min-w-0 space-y-4" aria-label="Lo mejor de cada jornada">
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-white/90">
          <Target size={18} className="text-[#C8A96B]" />
          Lo mejor de cada jornada
        </h2>
        <p className="mt-1 text-[13px] text-white/55">Las cinco mejores acciones a balón parado de cada jornada, según Wyscout: goles primero y luego por xG. Llévate la que te guste al taller.</p>
      </div>

      <div className="flex min-w-0 flex-wrap gap-1.5" role="tablist" aria-label="Vista">
        {(
          [
            ["top", "Lo mejor de cada jornada"],
            ["patrones", "Patrones que más rinden"],
          ] as const
        ).map(([k, etiqueta]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={vista === k}
            onClick={() => setVista(k)}
            className={`rounded-xl border px-3 py-2 text-[13px] font-semibold transition ${
              vista === k ? "border-[#C8A96B]/60 bg-[#C8A96B]/10 text-[#C8A96B]" : "border-white/10 bg-white/[0.03] text-white/65 hover:bg-white/[0.06]"
            }`}
          >
            {etiqueta}
          </button>
        ))}
      </div>

      {vista === "patrones" && <Patrones onAlTaller={onAlTaller} />}

      {vista === "top" && (
        <>
      <div className="-mx-1 flex min-w-0 gap-1.5 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Competición">
        {competiciones.map((c) => {
          const activa = c.slug === comp.slug;

          return (
            <button
              key={c.slug}
              type="button"
              role="tab"
              aria-selected={activa}
              onClick={() => {
                setSlug(c.slug);
                setIndice(null);
              }}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition ${
                activa ? "border-[#C8A96B]/60 bg-[#C8A96B]/10 text-[#C8A96B]" : "border-white/10 bg-white/[0.03] text-white/65 hover:bg-white/[0.06]"
              }`}
            >
              {c.corto}
            </button>
          );
        })}
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
        <label className="flex min-w-0 items-center gap-2 text-[12px] text-white/55">
          <span className="shrink-0">Jornada</span>
          <select
            value={i}
            onChange={(e) => setIndice(Number(e.target.value))}
            className="min-w-0 max-w-[14rem] rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[13px] font-semibold text-white/85"
          >
            {comp.jornadas.map((j, k) => (
              <option key={`${j.etiqueta}-${k}`} value={k}>
                {j.etiqueta} · {j.desde === j.hasta ? fecha(j.desde) : `${fecha(j.desde)}–${fecha(j.hasta)}`}
              </option>
            ))}
          </select>
        </label>
        <p className="min-w-0 text-[12px] text-white/50">
          {comp.nombre} · {resumen}
          {tipos && <span className="block sm:inline"> {tipos && <span className="hidden sm:inline">· </span>}{tipos}</span>}
        </p>
      </div>

      {jornada.top.length > 0 && (
        <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {jornada.top.map((a, k) => (
            <Tarjeta key={`${a.id}-${a.seg}-${k}`} accion={a} puesto={k + 1} competicion={comp} jornada={jornada} onAlTaller={onAlTaller} />
          ))}
        </div>
      )}
        </>
      )}
    </section>
  );
}
