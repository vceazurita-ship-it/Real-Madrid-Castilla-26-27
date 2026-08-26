"use client";

/**
 * El editor del horario del día.
 *
 * La idea de la que cuelga todo: **el horario se calcula desde la hora del
 * partido**. La salida del autobús, la comida, la llegada al estadio y el
 * calentamiento son siempre el mismo desfase respecto al saque inicial, y en
 * el documento de Word que esto sustituye había que recalcular las once horas
 * a mano cada semana —y cuando la federación movía el partido media hora,
 * otra vez—.
 *
 * De ahí las tres herramientas que no tenía el original:
 *
 * - **Plantillas**: viaje largo, viaje corto y partido en casa montan el día
 *   entero de golpe desde la hora del partido.
 * - **El desfase escrito al lado de cada cita** ("−1 h 30"): es como piensa el
 *   cuerpo técnico, y deja ver de un vistazo si la comida se ha quedado corta.
 * - **Mover el día entero**: si el partido cambia de hora, se arrastran todas
 *   las citas de una vez en lugar de reescribirlas.
 *
 * Las citas se guardan **en minutos desde medianoche** y pueden pasar de 1440:
 * volver de un desplazamiento largo es llegar a las 3:15 del día siguiente y
 * ese renglón pertenece a este horario, no al del día de después.
 */

import { useMemo } from "react";
import {
  ArrowDown,
  ArrowUp,
  CalendarClock,
  CopyPlus,
  Plus,
  Trash2,
  Wand2,
} from "lucide-react";

import { Button, Panel } from "@/components/abp/ui";
import {
  PLANTILLAS_HORARIO,
  TIPO_CITA,
  aHora,
  aMinutos,
  comoDesfase,
  diaSiguienteCorto,
  esDiaSiguiente,
  horarioDePlantilla,
  margenesDe,
  nuevoId,
  ordenaCitas,
  type CitaHorario,
  type Desplazamiento,
  type TipoCita,
} from "@/lib/viaje/modelo";

type Horario = Desplazamiento["horario"];

export function EditorHorario({
  viaje,
  onCambio,
}: {
  viaje: Desplazamiento;
  onCambio: (horario: Horario) => void;
}) {
  const minutoPartido = aMinutos(viaje.hora);

  const citas = useMemo(
    () => ordenaCitas(viaje.horario.citas),
    [viaje.horario.citas],
  );

  /** Guarda las citas y recalcula de dónde a dónde llega la columna. */
  const guarda = (siguientes: CitaHorario[]) => {
    onCambio({ citas: ordenaCitas(siguientes), ...margenesDe(siguientes) });
  };

  const cambia = (id: string, parche: Partial<CitaHorario>) => {
    guarda(citas.map((cita) => (cita.id === id ? { ...cita, ...parche } : cita)));
  };

  const aplicaPlantilla = (key: string) => {
    const plantilla = PLANTILLAS_HORARIO.find((item) => item.key === key);

    if (!plantilla || minutoPartido === null) return;

    guarda(horarioDePlantilla(plantilla, minutoPartido).citas);
  };

  /** Mueve el día entero. Se usa cuando cambia la hora del partido. */
  const desplaza = (minutos: number) => {
    guarda(
      citas.map((cita) => ({
        ...cita,
        minuto: Math.max(0, cita.minuto + minutos),
      })),
    );
  };

  const anade = () => {
    const base = minutoPartido ?? 20 * 60;

    guarda([
      ...citas,
      { id: nuevoId("CI"), minuto: base, texto: "Nueva cita", tipo: "otro" },
    ]);
  };

  return (
    <Panel
      title="El horario del día"
      subtitle={
        minutoPartido === null
          ? "Escribe la hora del partido y el día se monta solo"
          : `${citas.length} ${citas.length === 1 ? "cita" : "citas"} · todo se cuenta desde el partido de las ${aHora(minutoPartido)}`
      }
      icon={CalendarClock}
    >
      {/* --------------------- PLANTILLAS --------------------- */}

      <div className="flex flex-wrap items-center gap-2">
        {PLANTILLAS_HORARIO.map((plantilla) => (
          <Button
            key={plantilla.key}
            icon={Wand2}
            onClick={() => aplicaPlantilla(plantilla.key)}
            disabled={minutoPartido === null}
            title={`${plantilla.pista}. Rehace el día entero desde la hora del partido.`}
          >
            {plantilla.label}
          </Button>
        ))}

        <span className="text-[11px] text-white/30">
          Rehacen el día entero: lo escrito a mano se pierde
        </span>
      </div>

      {/* ------------------ MOVER TODO EL DÍA ----------------- */}

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/8 pt-3">
        <span className="text-[10px] uppercase tracking-[0.18em] text-white/40">
          Mover el día entero
        </span>

        {[-60, -30, -15, 15, 30, 60].map((minutos) => (
          <Button
            key={minutos}
            onClick={() => desplaza(minutos)}
            disabled={citas.length === 0}
            title={`Adelantar o retrasar todas las citas ${Math.abs(minutos)} minutos`}
          >
            {minutos > 0 ? `+${minutos}` : minutos}
          </Button>
        ))}
      </div>

      {/* ---------------------- LAS CITAS --------------------- */}

      <div className="mt-3 space-y-1.5">
        {citas.length === 0 && (
          <p className="py-6 text-center text-xs text-white/35">
            Todavía no hay horario. Elige una plantilla arriba y toca lo que
            haga falta.
          </p>
        )}

        {citas.map((cita) => {
          const tono = TIPO_CITA[cita.tipo] ?? TIPO_CITA.otro;

          const desfase =
            minutoPartido === null ? null : cita.minuto - minutoPartido;

          return (
            <div
              key={cita.id}
              className="grid min-w-0 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-2.5 py-2 lg:grid-cols-[auto_92px_minmax(0,1.6fr)_minmax(0,1fr)_120px_auto]"
            >
              {/* El color del tipo, para reconocer la fila de un vistazo. */}
              <span
                className="hidden h-8 w-1.5 shrink-0 rounded-full lg:block"
                style={{ backgroundColor: tono.color }}
              />

              <div className="min-w-0">
                <input
                  value={aHora(cita.minuto)}
                  onChange={(evento) => {
                    const minutos = aMinutos(evento.target.value);

                    if (minutos === null) return;

                    /* Escribir "03:15" en una cita de madrugada tiene que
                       dejarla en la madrugada, no mandarla al amanecer. */
                    cambia(cita.id, {
                      minuto: esDiaSiguiente(cita.minuto)
                        ? minutos + 1440
                        : minutos,
                    });
                  }}
                  className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-center text-sm font-semibold tabular-nums text-white outline-none transition focus:border-[#C8A96B]/50"
                />

                {desfase !== null && (
                  <p className="mt-1 text-center text-[10px] tabular-nums text-white/35">
                    {desfase === 0 ? "saque inicial" : comoDesfase(desfase)}
                  </p>
                )}
              </div>

              <input
                value={cita.texto}
                onChange={(evento) =>
                  cambia(cita.id, { texto: evento.target.value })
                }
                placeholder="Salida bus"
                className="min-w-0 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#C8A96B]/50"
              />

              <input
                value={cita.nota ?? ""}
                onChange={(evento) =>
                  cambia(cita.id, { nota: evento.target.value })
                }
                placeholder="Detalle: Lavandería, ENTREGA…"
                className="min-w-0 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs text-white/80 outline-none transition placeholder:text-white/25 focus:border-[#C8A96B]/50"
              />

              <select
                value={cita.tipo}
                onChange={(evento) =>
                  cambia(cita.id, { tipo: evento.target.value as TipoCita })
                }
                className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-xs text-white outline-none transition focus:border-[#C8A96B]/50"
              >
                {Object.entries(TIPO_CITA).map(([key, valor]) => (
                  <option key={key} value={key} className="bg-[#11161C]">
                    {valor.label}
                  </option>
                ))}
              </select>

              <div className="flex items-center gap-1">
                <Button
                  icon={ArrowUp}
                  onClick={() => cambia(cita.id, { minuto: cita.minuto - 5 })}
                  title="Cinco minutos antes"
                />

                <Button
                  icon={ArrowDown}
                  onClick={() => cambia(cita.id, { minuto: cita.minuto + 5 })}
                  title="Cinco minutos después"
                />

                <Button
                  icon={CopyPlus}
                  onClick={() =>
                    guarda([
                      ...citas,
                      { ...cita, id: nuevoId("CI"), minuto: cita.minuto + 30 },
                    ])
                  }
                  title="Duplicar media hora después"
                />

                <Button
                  tone="danger"
                  icon={Trash2}
                  onClick={() =>
                    guarda(citas.filter((item) => item.id !== cita.id))
                  }
                  title="Quitar la cita"
                />
              </div>

              {esDiaSiguiente(cita.minuto) && (
                <p className="col-span-full text-[10px] uppercase tracking-wide text-[#C8A96B]/70">
                  Ya es {diaSiguienteCorto(viaje.fecha).toLowerCase()}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-3">
        <Button icon={Plus} onClick={anade}>
          Añadir cita
        </Button>
      </div>
    </Panel>
  );
}
