"use client";

/**
 * UN DÍA DEL MICROCICLO CON LO QUE PASÓ EN LA SESIÓN (24/10/2026).
 *
 * Para /microcycles y el editor: cada tarea planificada con sus equipos de
 * Jugadores sesión y lo que concluyó el análisis de entrenamiento, y lo que se
 * cambió en la sesión como propuesta que se acepta con un clic (sólo en el
 * editor, que es quien escribe en la hoja). Lo que no tiene dato no sale.
 * Ver lib/sesion-dia/conexion.ts.
 */

import { Check, CheckCheck, Target } from "lucide-react";

import { Button } from "@/components/abp/ui";
import type { EntrenoDelDia } from "@/hooks/useDiasConectados";
import {
  enlaza,
  equiposDeTarea,
  resultadosPorTarea,
  textoDePropuesta,
  type Propuesta,
  type ResultadoObjetivo,
  type TareaPlan,
} from "@/lib/sesion-dia/conexion";
import type { SesionEquipos } from "@/lib/sesion-equipos/modelo";

import { EnlacesDia } from "./EnlacesDia";

/** El resultado de un objetivo en una línea: «Perfilarse… · 9 de 14 correctas · cumple». */
export function LineaResultado({ r }: { r: ResultadoObjetivo }) {
  return (
    <p className="flex min-w-0 items-start gap-1.5 text-[11px] leading-snug text-white/60">
      <Target size={11} className="mt-0.5 shrink-0 text-[#C8A96B]" aria-hidden />
      <span className="min-w-0">
        <span className="text-white/80">{r.objetivo}</span>
        {r.jugadores.length ? <span className="text-white/45"> · {r.jugadores.join(", ")}</span> : null}
        {r.lectura ? <span> · {r.lectura}</span> : null}
        {r.cumple === true ? <span className="font-semibold text-emerald-300"> · cumple{r.meta ? ` (meta ${r.meta} %)` : ""}</span> : null}
        {r.cumple === false ? <span className="font-semibold text-amber-300"> · no llega{r.meta ? ` (meta ${r.meta} %)` : ""}</span> : null}
      </span>
    </p>
  );
}

export function DiaConectado({
  fecha,
  plan,
  sesion,
  entreno,
  micro,
  propuestas = [],
  onAcepta,
  onAceptaTodas,
}: {
  fecha: string;
  plan: TareaPlan[];
  /** La sesión de Jugadores sesión de ese día, si la hay. */
  sesion: SesionEquipos | null;
  entreno?: EntrenoDelDia;
  micro?: number | null;
  /** Lo cambiado en la sesión: con `onAcepta`, se puede llevar al plan. */
  propuestas?: Propuesta[];
  onAcepta?: (p: Propuesta) => void;
  onAceptaTodas?: () => void;
}) {
  const enlace = sesion ? enlaza(sesion.tareas, plan) : [];
  const tareaDe = (k: number) => {
    const i = enlace.indexOf(k);

    return i >= 0 && sesion ? sesion.tareas[i] : null;
  };
  const { porTarea, sinTarea } = resultadosPorTarea(entreno?.sesion, entreno?.analisis, plan);
  const disponibles = sesion ? sesion.jugadores.filter((j) => !j.baja).length : 0;
  const bajas = sesion ? sesion.jugadores.length - disponibles : 0;
  const conEquipos = sesion ? sesion.tareas.filter((t) => Object.values(t.sitio).some((s) => s !== "fuera")).length : 0;
  const hayAlgo = Boolean(sesion) || porTarea.size > 0 || sinTarea.length > 0;

  return (
    <div className="min-w-0 space-y-2 rounded-xl border border-white/10 bg-white/[0.02] p-3">
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
        <p className="min-w-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">En la sesión</p>
        {sesion ? (
          <p className="min-w-0 text-[12px] text-white/70">
            {disponibles} jugadores{bajas ? ` · ${bajas} de baja` : ""}
            {conEquipos ? ` · ${conEquipos} ${conEquipos === 1 ? "tarea" : "tareas"} con equipos` : ""}
          </p>
        ) : null}
        <span className="flex-1" />
        <EnlacesDia fecha={fecha} micro={micro} actual="microciclo" textos={{ sesion: sesion ? "Ver los equipos" : "Hacer los equipos", analisis: entreno?.sesion?.objetivos.length ? "Ver el análisis" : "Analizar el entreno" }} />
      </div>

      {hayAlgo && plan.length > 0 ? (
        <ul className="min-w-0 space-y-1.5">
          {plan.map((p, k) => {
            const t = tareaDe(k);
            const eq = t && sesion ? equiposDeTarea(sesion, t) : null;
            const colocados = eq ? eq.equipos.filter((e) => e.jugadores.length) : [];
            const suyos = porTarea.get(k) ?? [];

            if (!colocados.length && !suyos.length && !(eq && eq.comodines.length)) return null;

            return (
              <li key={`${p.codigo}-${k}`} className="min-w-0 rounded-lg border border-white/[0.06] px-2.5 py-1.5">
                <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[12px]">
                  <span className="font-semibold text-[#C8A96B]">{p.codigo}</span>
                  <span className="min-w-0 truncate text-white/80">{t?.nombre || p.tipo || p.contenidoPrincipal}</span>
                  {colocados.map((e) => (
                    <span key={e.nombre + e.color} className="inline-flex items-center gap-1 text-[11px] text-white/60" title={e.jugadores.join(", ")}>
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full border border-white/20" style={{ background: e.color }} aria-hidden />
                      {e.nombre} {e.jugadores.length}
                    </span>
                  ))}
                  {eq && eq.comodines.length ? <span className="text-[11px] text-white/50" title={eq.comodines.join(", ")}>+{eq.comodines.length} comodín{eq.comodines.length === 1 ? "" : "es"}</span> : null}
                </p>
                {suyos.map((r) => (
                  <LineaResultado key={r.id} r={r} />
                ))}
              </li>
            );
          })}
        </ul>
      ) : null}

      {sinTarea.length ? (
        <div className="space-y-1">
          {sinTarea.map((r) => (
            <LineaResultado key={r.id} r={r} />
          ))}
        </div>
      ) : null}

      {propuestas.length ? (
        <div className="min-w-0 space-y-1.5 rounded-lg border border-amber-400/25 bg-amber-400/[0.07] px-3 py-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <p className="min-w-0 flex-1 text-[12px] font-semibold text-white/85">Cambiado en la sesión</p>
            {onAceptaTodas && propuestas.length > 1 ? (
              <Button icon={CheckCheck} onClick={onAceptaTodas} title="Lleva al plan todo lo que cambió en la sesión (se puede deshacer)">
                Aceptar todo
              </Button>
            ) : null}
          </div>
          <ul className="space-y-1">
            {propuestas.map((p) => (
              <li key={p.clave} className="flex min-w-0 flex-wrap items-center gap-2 text-[12px] text-white/70">
                <span className="min-w-0 flex-1">{textoDePropuesta(p)}</span>
                {onAcepta ? (
                  <Button icon={Check} onClick={() => onAcepta(p)} title="Llevarlo al plan del microciclo (se puede deshacer; se escribe en la hoja con «Escribir en la hoja»)">
                    Aceptar
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
          {!onAcepta ? <p className="text-[11px] text-white/50">Se acepta en el editor del microciclo, que es el que escribe en la hoja.</p> : null}
        </div>
      ) : null}
    </div>
  );
}
