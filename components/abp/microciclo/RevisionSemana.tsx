"use client";

/**
 * LA REVISIÓN DE LA SEMANA Y LO QUE DEJÓ EL PARTIDO (21/10/2026).
 *
 * Dos paneles que van encima de la rejilla de la semana:
 *
 * - **Revisión**: lo que miraría un entrenador de balón parado antes de cerrar
 *   el microciclo (`revisaSemana` en `lib/abp/semana-revision.ts`). Cada punto
 *   que habla de una tarea la abre de un toque, y lo urgente que no está en la
 *   semana se añade desde aquí.
 * - **Lo que dejó el partido**: sólo cuando ya se jugó. Lo trabajado contra lo
 *   que pasó en ese partido, aspecto por aspecto, y lo que no se trabajó y
 *   acabó en gol u ocasión.
 */

import { CheckCircle2, CircleAlert, Plus, TriangleAlert } from "lucide-react";

import { Panel } from "@/components/abp/ui";
import { LADO_COLOR, LADO_LABEL, fmtMin, type DiaKey, type Trabajo } from "@/lib/abp/microciclo";
import { chipInk } from "@/lib/theme";
import type { LecturaAspecto, LecturaPartido, PuntoRevision, TonoRevision } from "@/lib/abp/semana-revision";

const ICONO: Record<TonoRevision, { Icono: typeof CheckCircle2; clase: string; etiqueta: string }> = {
  alerta: { Icono: TriangleAlert, clase: "text-rose-300", etiqueta: "Hay que corregirlo" },
  aviso: { Icono: CircleAlert, clase: "text-amber-300", etiqueta: "Conviene mirarlo" },
  bien: { Icono: CheckCircle2, clase: "text-emerald-300", etiqueta: "Bien" },
};

export function RevisionSemana({
  puntos,
  onAbrir,
  onPlanificar,
}: {
  puntos: PuntoRevision[];
  onAbrir: (dia: DiaKey, trabajo: Trabajo) => void;
  onPlanificar: (falta: NonNullable<PuntoRevision["falta"]>) => void;
}) {
  if (!puntos.length) return null;

  const pendientes = puntos.filter((punto) => punto.tono !== "bien").length;

  return (
    <Panel
      title="Revisión de la semana"
      subtitle={
        pendientes
          ? `${pendientes} ${pendientes === 1 ? "cosa que mirar" : "cosas que mirar"} antes de cerrarla`
          : "Lista para cerrarla"
      }
      icon={pendientes ? CircleAlert : CheckCircle2}
    >
      <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {puntos.map((punto) => {
          const { Icono, clase, etiqueta } = ICONO[punto.tono];

          const abre = punto.dia && punto.trabajo ? () => onAbrir(punto.dia as DiaKey, punto.trabajo as Trabajo) : null;

          return (
            <li
              key={punto.id}
              className="flex min-w-0 items-start gap-2.5 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5"
            >
              <Icono size={15} className={`mt-0.5 shrink-0 ${clase}`} aria-label={etiqueta} />

              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] font-semibold leading-snug text-white">{punto.titulo}</p>

                <p className="mt-0.5 text-[11.5px] leading-snug text-white/55">{punto.detalle}</p>

                {(abre || punto.falta) && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {abre && (
                      <button
                        type="button"
                        onClick={abre}
                        className="rounded-lg border border-white/12 px-2 py-0.5 text-[10.5px] font-medium text-white/65 transition hover:border-white/25 hover:text-white"
                      >
                        Abrir la tarea
                      </button>
                    )}

                    {punto.falta && (
                      <button
                        type="button"
                        onClick={() => onPlanificar(punto.falta as NonNullable<PuntoRevision["falta"]>)}
                        className="inline-flex items-center gap-1 rounded-lg border border-white/12 px-2 py-0.5 text-[10.5px] font-medium text-white/65 transition hover:border-white/25 hover:text-white"
                      >
                        <Plus size={10} aria-hidden />
                        Añadir a la semana
                      </button>
                    )}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/*  LO QUE DEJÓ EL PARTIDO                                             */
/* ------------------------------------------------------------------ */

function Fila({ uno }: { uno: LecturaAspecto }) {
  const color = LADO_COLOR[uno.lado];

  const lectura = !uno.acciones
    ? "no salió en el partido"
    : `${uno.acciones} ${uno.acciones === 1 ? "acción" : "acciones"}, ${uno.peligro} con peligro${
        uno.lado === "defensivo" ? " suyo" : ""
      }${uno.goles ? ` · ${uno.goles} ${uno.goles === 1 ? "gol" : "goles"}` : ""}`;

  const marca =
    uno.veredicto === "bien"
      ? { texto: uno.lado === "ofensivo" ? "Dio peligro" : "Sin peligro suyo", clase: "text-emerald-300" }
      : uno.veredicto === "mal"
        ? { texto: uno.goles ? "Nos marcaron" : "Nos crearon peligro", clase: "text-rose-300" }
        : null;

  return (
    <li className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 border-b border-white/[0.06] py-2 last:border-b-0">
      <span
        className="rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide"
        style={{ backgroundColor: `${color}1F`, color: chipInk(color) }}
      >
        {LADO_LABEL[uno.lado]}
      </span>

      <span className="min-w-0 flex-1 text-[12.5px] font-medium text-white">{uno.label}</span>

      {uno.minutos > 0 && (
        <span className="text-[11px] tabular-nums text-white/45">{fmtMin(Math.round(uno.minutos))} en la semana</span>
      )}

      <span className="text-[11.5px] tabular-nums text-white/65">{lectura}</span>

      {marca && <span className={`text-[11px] font-semibold ${marca.clase}`}>{marca.texto}</span>}
    </li>
  );
}

export function LecturaDelPartido({
  lectura,
  rival,
  marcador,
}: {
  lectura: LecturaPartido;
  rival: string;
  marcador: string | null;
}) {
  if (!lectura.trabajado.length && !lectura.sinTrabajar.length && !lectura.noSalio.length) return null;

  /* La conclusión primero: cuánto de lo trabajado salió bien y cuánto no. */
  const bien = lectura.trabajado.filter((uno) => uno.veredicto === "bien").length;
  const mal = lectura.trabajado.filter((uno) => uno.veredicto === "mal").length;

  const frase = [
    lectura.trabajado.length
      ? `De lo trabajado, ${lectura.trabajado.length} ${lectura.trabajado.length === 1 ? "aspecto salió" : "aspectos salieron"} en el partido`
      : "",
    bien ? `${bien} ${bien === 1 ? "salió bien" : "salieron bien"}` : "",
    mal ? `en ${mal} nos crearon peligro` : "",
  ]
    .filter(Boolean)
    .join(": ")
    .replace(/: ([^:]+): /, ": $1 y ");

  const ambas = lectura.trabajado.length > 0 && lectura.sinTrabajar.length > 0;

  return (
    <Panel
      title="Lo que dejó el partido"
      subtitle={`${rival}${marcador ? ` · ${marcador}` : ""} · lo trabajado en la semana, en el partido`}
      icon={CheckCircle2}
    >
      {frase && <p className="mb-3 text-[13px] font-medium leading-snug text-white">{frase}.</p>}

      <div className={`grid gap-5 ${ambas ? "lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]" : ""}`}>
        {lectura.trabajado.length > 0 && (
          <div className="min-w-0">
            <p className="mb-1 text-[10px] uppercase tracking-[0.16em] text-white/40">Lo que trabajamos</p>

            <ul>
              {lectura.trabajado.map((uno) => (
                <Fila key={`${uno.aspecto}-${uno.lado}`} uno={uno} />
              ))}
            </ul>
          </div>
        )}

        {lectura.sinTrabajar.length > 0 && (
          <div className="min-w-0">
            <p className="mb-1 text-[10px] uppercase tracking-[0.16em] text-white/40">
              Lo que no estaba en la semana y dio peligro
            </p>

            <ul>
              {lectura.sinTrabajar.map((uno) => (
                <Fila key={`${uno.aspecto}-${uno.lado}`} uno={uno} />
              ))}
            </ul>
          </div>
        )}
      </div>

      {lectura.noSalio.length > 0 && (
        <p className="mt-3 text-[11.5px] leading-relaxed text-white/50">
          <span className="font-semibold text-white/70">Trabajado y sin acciones en el partido: </span>
          {lectura.noSalio.join(", ")}.
        </p>
      )}
    </Panel>
  );
}
