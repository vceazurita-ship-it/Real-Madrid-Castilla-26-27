"use client";

/**
 * LA SESIÓN DEL DÍA, DESDE EL MICROCICLO Y JUGADORES SESIÓN (24/10/2026).
 *
 * Antes de escribir objetivos: qué tareas había planificadas (código, tipo,
 * formato, minutos y contenido), quién estaba y con qué peto jugó cada uno
 * en cada tarea. Un toque en un equipo crea el objetivo ya atado a su tarea,
 * con sus jugadores y «peto naranja» para que la IA los reconozca. Al lado de
 * cada tarea, lo que concluyó el análisis. Ver lib/sesion-dia/conexion.ts.
 */

import { Plus } from "lucide-react";

import { LineaResultado } from "@/components/sesion-dia/DiaConectado";
import { EnlacesDia } from "@/components/sesion-dia/EnlacesDia";
import type { AnalisisEntreno, ObjetivoEntreno, SesionEntreno } from "@/lib/entreno/modelo";
import { enlaza, equiposDeTarea, idDePlantilla, resultadosPorTarea, textoDeTareaPlan, type TareaPlan } from "@/lib/sesion-dia/conexion";
import { nombreDeColor, type SesionEquipos } from "@/lib/sesion-equipos/modelo";

type Ficha = { id: string; nombre: string; apodo?: string };

export function SesionDelDia({
  fecha,
  plan,
  equipos,
  entreno,
  analisis,
  plantilla,
  nombreDe,
  onObjetivo,
}: {
  fecha: string;
  plan: TareaPlan[];
  /** La sesión de Jugadores sesión de ese día, si la hay. */
  equipos: SesionEquipos | null;
  entreno: SesionEntreno;
  analisis: AnalisisEntreno | null;
  /** La plantilla del Castilla, para pasar de los nombres de la lista a los de los objetivos. */
  plantilla: Ficha[];
  /** El nombre con el que el análisis enseña a cada jugador (el apodo si lo tiene). */
  nombreDe: (id: string) => string;
  onObjetivo: (o: Omit<ObjetivoEntreno, "id">) => void;
}) {
  if (!plan.length && !equipos) {
    return (
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <EnlacesDia fecha={fecha} actual="analisis" textos={{ sesion: "Hacer los equipos" }} />
      </div>
    );
  }

  const enlace = equipos ? enlaza(equipos.tareas, plan) : [];
  const { porTarea } = resultadosPorTarea(entreno, analisis, plan);
  const presentes = equipos ? equipos.jugadores.filter((j) => !j.baja) : [];
  const bajas = equipos ? equipos.jugadores.filter((j) => j.baja) : [];

  const deLaPlantilla = (nombres: string[]) =>
    nombres.flatMap((n) => {
      const f = idDePlantilla(n, plantilla);

      return f ? [{ id: f.id, nombre: nombreDe(f.id) || f.nombre }] : [];
    });

  return (
    <section aria-labelledby="sesion-del-dia" className="min-w-0 space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
        <h2 id="sesion-del-dia" className="text-base font-semibold">
          La sesión del día
        </h2>
        {plan[0] ? (
          <span className="text-[12px] text-white/60">
            Micro {plan[0].micro}
            {plan[0].md ? ` · ${plan[0].md}` : ""}
            {plan[0].rival ? ` · ${plan[0].rival}` : ""}
          </span>
        ) : null}
        <span className="flex-1" />
        <EnlacesDia fecha={fecha} micro={plan[0]?.micro} actual="analisis" textos={{ sesion: equipos ? "Ver los equipos" : "Hacer los equipos" }} />
      </div>

      {equipos ? (
        <p className="text-[12px] text-white/60">
          {presentes.length} jugadores en la sesión{bajas.length ? ` · de baja: ${bajas.map((j) => j.nombre).join(", ")}` : ""}
        </p>
      ) : null}

      {plan.length ? (
        <ul className="min-w-0 space-y-2">
          {plan.map((p, k) => {
            const i = enlace.indexOf(k);
            const t = i >= 0 && equipos ? equipos.tareas[i] : null;
            const eq = t && equipos ? equiposDeTarea(equipos, t) : null;
            const suyos = porTarea.get(k) ?? [];

            return (
              <li key={`${p.codigo}-${k}`} className="min-w-0 rounded-xl border border-white/[0.06] px-3 py-2">
                <p className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[13px]">
                  <span className="font-semibold text-[#C8A96B]">{p.codigo}</span>
                  <span className="min-w-0 font-medium text-white/85">{textoDeTareaPlan(p)}</span>
                  {p.tiempo > 0 ? <span className="text-[12px] text-white/50">{p.tiempo}′</span> : null}
                </p>
                {p.contenidoPrincipal || p.contenidoSecundario ? (
                  <p className="mt-0.5 text-[12px] text-white/55">{[p.contenidoPrincipal, p.contenidoSecundario].filter(Boolean).join(" · ")}</p>
                ) : null}

                {eq && eq.equipos.some((e) => e.jugadores.length) ? (
                  <div className="mt-1.5 flex min-w-0 flex-wrap gap-1.5">
                    {eq.equipos
                      .filter((e) => e.jugadores.length)
                      .map((e) => (
                        <button
                          key={e.nombre + e.color}
                          type="button"
                          onClick={() =>
                            onObjetivo({
                              objetivo: "",
                              jugadores: deLaPlantilla(e.jugadores),
                              reconocer: `peto ${nombreDeColor(e.color).toLowerCase()}`,
                              tarea: p.codigo,
                              tareaTexto: textoDeTareaPlan(p),
                            })
                          }
                          title={`${e.jugadores.join(", ")}\nCrear un objetivo para este equipo en ${p.codigo}`}
                          className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-lg border border-white/12 px-2 py-1 text-left text-[11px] text-white/70 transition hover:border-[#C8A96B]/50 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C8A96B]"
                        >
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full border border-white/20" style={{ background: e.color }} aria-hidden />
                          <span className="min-w-0 truncate">
                            {e.nombre} · {e.jugadores.length}
                          </span>
                          <Plus size={11} className="shrink-0 text-[#C8A96B]" aria-hidden />
                        </button>
                      ))}
                    {eq.comodines.length ? <span className="self-center text-[11px] text-white/50">Comodines: {eq.comodines.join(", ")}</span> : null}
                  </div>
                ) : null}

                {suyos.length ? (
                  <div className="mt-1.5 space-y-0.5">
                    {suyos.map((r) => (
                      <LineaResultado key={r.id} r={r} />
                    ))}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}

      {equipos && plan.length ? <p className="text-[11px] text-white/45">Pulsa un equipo para crear un objetivo con sus jugadores, su peto y su tarea ya puestos.</p> : null}
    </section>
  );
}
