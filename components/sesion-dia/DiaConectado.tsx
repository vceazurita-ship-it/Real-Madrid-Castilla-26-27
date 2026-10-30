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
  nombreVisible,
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
        {/* 30/10/2026: sin validar, el porcentaje es provisional y se dice con una etiqueta, no dentro de un paréntesis. */}
        {r.lecturaCorta ? <span> · {r.lecturaCorta}</span> : r.lectura ? <span> · {r.lectura}</span> : null}
        {r.lecturaCorta && r.total && (r.validadas ?? 0) < r.total ? (
          <span
            className="ml-1 inline-block rounded-full border border-amber-400/40 px-1.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300"
            title={r.validadas ? `${r.validadas} de ${r.total} acciones validadas: lo demás es la propuesta automática` : "Ninguna acción validada todavía: es la propuesta automática"}
          >
            {r.validadas ? `provisional · ${r.validadas} de ${r.total} validadas` : "sin validar"}
          </span>
        ) : null}
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

  /*
  | 30/10/2026: sólo lectura (/microcycles, sin `onAcepta`). El recuadro ámbar
  | «Cambiado en la sesión» se repetía cada día y pesaba más que la semana: un
  | renombre pasa a una línea dentro de su tarea («V-T2 se llamó «EVOLUCIÓN» en
  | la sesión») y el resto de cambios, a líneas sueltas sin caja.
  */
  const soloLectura = !onAcepta;
  const renombres = new Map<number, string>();

  if (soloLectura) {
    for (const p of propuestas) if (p.tipo === "renombrar") renombres.set(p.indice, p.a);
  }

  const otrosCambios = soloLectura ? propuestas.filter((p) => p.tipo !== "renombrar") : propuestas;

  /* Sin nada que contar no se dibuja la caja: sólo la fila con los accesos. */
  const vacio = !hayAlgo && propuestas.length === 0;

  return (
    <div className={vacio ? "min-w-0" : "min-w-0 space-y-2 rounded-xl border border-white/10 bg-white/[0.02] p-3"}>
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
        {vacio ? null : <p className="min-w-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">En la sesión</p>}
        {sesion ? (
          <p className="min-w-0 text-[12px] text-white/70">
            {disponibles} jugadores{bajas ? ` · ${bajas} de baja` : ""}
            {conEquipos ? ` · ${conEquipos} ${conEquipos === 1 ? "tarea" : "tareas"} con equipos` : ""}
          </p>
        ) : null}
        <span className="flex-1" />
        <EnlacesDia fecha={fecha} micro={micro} actual="microciclo" textos={{ sesion: sesion ? "Ver los equipos" : "Hacer los equipos", analisis: entreno?.sesion?.objetivos.length ? "Ver el análisis" : "Analizar el entreno" }} />
      </div>

      {(hayAlgo || renombres.size > 0) && plan.length > 0 ? (
        <ul className="min-w-0 space-y-1.5">
          {plan.map((p, k) => {
            const t = tareaDe(k);
            const eq = t && sesion ? equiposDeTarea(sesion, t) : null;
            const colocados = eq ? eq.equipos.filter((e) => e.jugadores.length) : [];
            const suyos = porTarea.get(k) ?? [];
            const otroNombre = renombres.get(k);

            if (!colocados.length && !suyos.length && !(eq && eq.comodines.length) && !otroNombre) return null;

            return (
              <li key={`${p.codigo}-${k}`} className="min-w-0 rounded-lg border border-white/[0.06] px-2.5 py-1.5">
                <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[12px]">
                  <span className="font-semibold text-[#C8A96B]">{p.codigo}</span>
                  {/* Renombrada: el título es el del plan y la línea de abajo dice el de la sesión (30/10/2026; antes salía dos veces el mismo). */}
                  <span className="min-w-0 truncate text-white/80">{nombreVisible(otroNombre ? undefined : t?.nombre, p.tipo, p.contenidoPrincipal, p.formato) || "Tarea sin nombre"}</span>
                  {colocados.map((e) => (
                    <span key={e.nombre + e.color} className="inline-flex items-center gap-1 text-[11px] text-white/60" title={e.jugadores.join(", ")}>
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full border border-white/20" style={{ background: e.color }} aria-hidden />
                      {e.nombre} {e.jugadores.length}
                    </span>
                  ))}
                  {eq && eq.comodines.length ? <span className="text-[11px] text-white/50" title={eq.comodines.join(", ")}>+{eq.comodines.length} comodín{eq.comodines.length === 1 ? "" : "es"}</span> : null}
                </p>
                {otroNombre ? (
                  <p className="text-[11px] text-white/50">
                    {p.codigo} se llamó «{otroNombre}» en la sesión
                  </p>
                ) : null}
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

      {soloLectura && otrosCambios.length ? (
        <ul className="space-y-0.5">
          {otrosCambios.map((p) => (
            <li key={p.clave} className="min-w-0 text-[11px] text-white/50">
              {textoDePropuesta(p)}
            </li>
          ))}
        </ul>
      ) : null}

      {!soloLectura && propuestas.length ? (
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
        </div>
      ) : null}
    </div>
  );
}
