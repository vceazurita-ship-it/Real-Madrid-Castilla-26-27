"use client";

/**
 * EL BOCETO DEL MICROCICLO, PARA MIRARLO ANTES DE APLICARLO.
 *
 * El motor está en `lib/abp/boceto.ts`; esto es la cara: trae lo que hace
 * falta —nuestro calendario de BeSoccer y el balón parado de la liga—, enseña
 * el microciclo propuesto día a día con el porqué de cada tarea, y sólo escribe
 * en el plan cuando alguien pulsa «Aplicar al plan».
 *
 * **Los días salen de la hoja de registro de tareas**, no de la semana natural:
 * el microciclo del Sant Andreu va de domingo a miércoles. Si esa semana
 * todavía no está creada en la hoja, aquí no se propone nada: se dice que hay
 * que crearla primero, con sus días, y volver.
 *
 * **Propone, no cierra.** Lo aplicado queda como cualquier otra tarea: se
 * mueve, se recorta y se borra. Las tareas del boceto se reconocen por su nota
 * (`Boceto ·`), así que volver a proponer no duplica nada y lo escrito a mano
 * no se toca.
 */

import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Check, Info, Wand2 } from "lucide-react";

import { Button, Dialog, EmptyState, Notice } from "@/components/abp/ui";
import { construyeBoceto, type Boceto } from "@/lib/abp/boceto";
import { construyeRivalAbp, type RivalAbp } from "@/lib/abp/rivalAbp";
import { ventanaDelMicro, type VentanaMicro } from "@/lib/abp/ventana";
import { CLAVE_CALENDARIO, type PartidoCastilla } from "@/lib/castilla/calendario";
import type { CompeticionEvent } from "@/lib/abp/competicion";
import type { ComparativaAbp } from "@/lib/abp/informe-graficos";
import {
  MOMENTO_SHORT,
  etiquetaLados,
  etiquetaTrabajo,
  fmtMin,
  type DiaKey,
  type MicroPlan,
  type PlanDia,
} from "@/lib/abp/microciclo";
import type { RegistroTarea } from "@/lib/abp/registro";
import type { FilaCruce } from "@/lib/abp/transferencia";

type Estado =
  | { fase: "cargando" }
  | { fase: "sin-semana"; ventana: VentanaMicro }
  | { fase: "roto"; motivo: string }
  | {
      fase: "listo";
      boceto: Boceto;
      ventana: VentanaMicro;
      rival: RivalAbp | null;
    };

export function BocetoDialog({
  filas,
  plan,
  events,
  tareasDelMicro,
  rivalDelMicro,
  micro,
  onAplicar,
  onCerrar,
}: {
  filas: FilaCruce[];
  plan: MicroPlan;
  events: CompeticionEvent[];
  /** Todas las tareas de la hoja de este microciclo, no sólo las de ABP. */
  tareasDelMicro: RegistroTarea[];
  /** El rival del microciclo según la hoja. */
  rivalDelMicro: string;
  /** Para poder nombrarlo en pantalla. */
  micro: { temporada: string; numero: number };
  onAplicar: (
    dias: Record<DiaKey, PlanDia>,
    rival: string,
    diasEntrenados: number,
  ) => void;
  onCerrar: () => void;
}) {
  const [estado, setEstado] = useState<Estado>({ fase: "cargando" });

  /* Las dos fuentes de fuera: nuestro calendario y el ABP de la liga. Van en
     el propio efecto, que es la forma que pasa el linter de hooks. */
  useEffect(() => {
    let cancelado = false;

    const traer = async () => {
      try {
        const [calendario, comparativa] = await Promise.all([
          fetch(`/api/docs?key=${encodeURIComponent(CLAVE_CALENDARIO)}`, {
            cache: "no-store",
          })
            .then((r) => r.json() as Promise<{ data?: { partidos?: PartidoCastilla[] } }>)
            .then((datos) => datos?.data?.partidos ?? [])
            .catch(() => [] as PartidoCastilla[]),
          fetch("/api/data-analisis?abpInforme=1", { cache: "no-store" })
            .then((r) => r.json() as Promise<{ abp?: ComparativaAbp }>)
            .then((datos) => datos?.abp ?? null)
            .catch(() => null),
        ]);

        if (cancelado) return;

        const ventana = ventanaDelMicro({
          tareas: tareasDelMicro,
          rival: rivalDelMicro,
          partidos: calendario,
        });

        /* Sin días en la hoja no hay microciclo que planificar. */
        if (ventana.dias.length === 0) {
          setEstado({ fase: "sin-semana", ventana });

          return;
        }

        const rival = ventana.partido
          ? construyeRivalAbp({ equipo: ventana.partido.rival, comparativa, events })
          : null;

        setEstado({
          fase: "listo",
          ventana,
          rival,
          boceto: construyeBoceto({ ventana, filas, rival, plan }),
        });
      } catch (error) {
        if (cancelado) return;

        setEstado({
          fase: "roto",
          motivo: error instanceof Error ? error.message : "No se ha podido montar el boceto.",
        });
      }
    };

    void traer();

    return () => {
      cancelado = true;
    };
  }, [filas, plan, events, tareasDelMicro, rivalDelMicro]);

  const dentro = useMemo(() => {
    if (estado.fase !== "listo") return true;

    const { boceto } = estado;

    return boceto.minutos >= boceto.objetivo.minimo && boceto.minutos <= boceto.objetivo.maximo;
  }, [estado]);

  return (
    <Dialog
      title={`Boceto del microciclo ${micro.numero || ""}`.trim()}
      subtitle="Los días salen de la hoja de registro; los aspectos, de nuestro rendimiento y del rival. Se aplica al plan y se cierra a mano."
      onClose={onCerrar}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[11px] text-white/40">
            {estado.fase === "listo"
              ? `${fmtMin(estado.boceto.minutos)} en ${estado.boceto.diasEntrenados} entreno(s) · objetivo ${estado.boceto.objetivo.minimo}-${estado.boceto.objetivo.maximo}′`
              : "Mirando la hoja, el calendario y los datos de la liga…"}
          </p>

          <div className="flex gap-2">
            <Button onClick={onCerrar}>Cancelar</Button>

            <Button
              tone="primary"
              icon={Check}
              disabled={estado.fase !== "listo"}
              onClick={() => {
                if (estado.fase !== "listo") return;

                onAplicar(
                  estado.boceto.dias,
                  estado.ventana.partido?.rival ?? estado.ventana.rivalHoja,
                  estado.boceto.diasEntrenados,
                );
              }}
            >
              Aplicar al plan
            </Button>
          </div>
        </div>
      }
    >
      {estado.fase === "cargando" && (
        <EmptyState
          title="Montando el boceto…"
          description="Se está leyendo qué días entrenamos en la hoja y qué hace de balón parado el rival."
        />
      )}

      {estado.fase === "roto" && (
        <Notice tone="warn" title="No se puede proponer nada todavía">
          {estado.motivo}
        </Notice>
      )}

      {estado.fase === "sin-semana" && (
        <div className="space-y-3">
          <Notice tone="warn" title="Esa semana todavía no está en la hoja">
            <p>
              El microciclo {micro.numero || "—"} de {micro.temporada || "la temporada"} no tiene
              ninguna fila con fecha en la hoja de registro de tareas, así que no sé qué días se
              entrena.
            </p>

            <p className="mt-2">
              <strong className="text-white/75">Créalo primero en la hoja</strong> —una fila por
              tarea, con su día, su MD y su fecha— y vuelve a pulsar «Proponer boceto». Los días de
              entrenamiento salen de ahí: el microciclo no tiene por qué ser de lunes a domingo.
            </p>
          </Notice>

          {estado.ventana.partido && (
            <p className="text-[11px] leading-relaxed text-white/40">
              El partido sí lo tengo: J{estado.ventana.partido.jornada} contra{" "}
              {estado.ventana.partido.rival}, el{" "}
              {new Date(estado.ventana.partido.cuando).toLocaleString("es-ES", {
                weekday: "long",
                day: "numeric",
                month: "long",
                hour: "2-digit",
                minute: "2-digit",
              })}
              .
            </p>
          )}

          {estado.ventana.avisos.map((aviso) => (
            <p key={aviso} className="text-[11px] leading-relaxed text-white/40">
              {aviso}
            </p>
          ))}
        </div>
      )}

      {estado.fase === "listo" && (
        <div className="space-y-4">
          {/* ---------------- EL PARTIDO Y EL MICROCICLO ---------------- */}

          <div className="flex flex-wrap items-center gap-2.5 rounded-2xl border border-white/[0.07] px-4 py-3 text-[12px] leading-relaxed">
            <CalendarClock size={15} className="shrink-0 text-emerald-300" aria-hidden />

            <p className="text-white/55">
              {estado.ventana.partido ? (
                <>
                  Microciclo {estado.ventana.comoSeLlama} ·{" "}
                  <strong className="text-white/85">
                    J{estado.ventana.partido.jornada} · {estado.ventana.partido.rival}
                  </strong>{" "}
                  {estado.ventana.partido.lado === "casa" ? "en casa" : "fuera"}, el{" "}
                  {new Date(estado.ventana.partido.cuando).toLocaleString("es-ES", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </>
              ) : (
                <>
                  Microciclo {estado.ventana.comoSeLlama} · sin partido atado (
                  {estado.ventana.rivalHoja || "sin rival en la hoja"})
                </>
              )}
              . {estado.boceto.diasEntrenados} día(s) de entrenamiento según la hoja.
            </p>
          </div>

          {/* ---------------- LOS DÍAS, EN ORDEN DE MICROCICLO ---------------- */}

          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {estado.ventana.dias.map((dia) => {
              const suyo = estado.boceto.dias[dia.clave];

              const minutos = suyo.trabajos.reduce(
                (total, uno) => total + (uno.minutos || 0),
                0,
              );

              return (
                <div
                  key={dia.fecha}
                  className={`rounded-2xl border px-3 py-2.5 ${
                    dia.tipo === "partido"
                      ? "border-emerald-400/25 bg-emerald-400/[0.06]"
                      : dia.tipo === "descanso"
                        ? "border-white/[0.07] bg-white/[0.02]"
                        : "border-white/[0.07]"
                  }`}
                >
                  <p className="flex items-baseline justify-between gap-2 text-[12px]">
                    <span className="font-semibold text-white/80">{dia.etiqueta}</span>

                    <span className="text-[10px] uppercase tracking-wide text-white/40">
                      {dia.tipo === "partido"
                        ? `MD · ${estado.ventana.partido?.rival ?? ""}`
                        : dia.tipo === "descanso"
                          ? "Sin sesión en la hoja"
                          : `${dia.rotulo}${minutos ? ` · ${fmtMin(minutos)}` : ""}`}
                    </span>
                  </p>

                  {suyo.trabajos.length > 0 && (
                    <ul className="mt-2 space-y-2">
                      {suyo.trabajos.map((trabajo) => (
                        <li key={trabajo.id} className="rounded-xl bg-white/[0.03] px-2.5 py-2">
                          <p className="text-[11px] text-white/75">
                            {fmtMin(trabajo.minutos)} · {etiquetaTrabajo(trabajo)}
                          </p>

                          <p className="text-[10px] uppercase tracking-wide text-white/35">
                            {etiquetaLados(trabajo)} · {MOMENTO_SHORT[trabajo.momento]} ·{" "}
                            {trabajo.medio === "video" ? "Vídeo" : "Campo"}
                          </p>

                          <p className="mt-1 text-[10px] leading-relaxed text-white/40">
                            {trabajo.notas.replace(/^Boceto ·\s*/, "")}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}

                  {suyo.trabajos.length === 0 && dia.tipo === "entreno" && (
                    <p className="mt-2 text-[10px] text-white/30">
                      Sin balón parado{dia.tareasHoja ? ` · ${dia.tareasHoja} tarea(s) en la hoja` : ""}.
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* ---------------- DE DÓNDE SALE ---------------- */}

          <div className="rounded-2xl border border-white/[0.07] px-4 py-3">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-white/50">
              <Info size={12} aria-hidden /> De dónde sale
            </p>

            <ul className="mt-2 space-y-1 text-[11px] leading-relaxed text-white/45">
              <li>
                <strong className="text-white/65">Los días</strong>, de la hoja de registro de
                tareas: los que tienen sesión escrita, con su fecha y su MD.
              </li>

              <li>
                <strong className="text-white/65">Los minutos</strong>, del objetivo de 90-100′ en
                una semana de seis entrenamientos, prorrateado a los{" "}
                {estado.boceto.diasEntrenados} de este microciclo (
                {estado.boceto.objetivo.minimo}-{estado.boceto.objetivo.maximo}′), con el vídeo y
                el ensayo dentro.
              </li>

              <li>
                <strong className="text-white/65">Los aspectos</strong>, de nuestra urgencia (55 %)
                y de lo que el rival ataca y concede (45 %).
              </li>

              {estado.rival && (
                <li>
                  <strong className="text-white/65">{estado.rival.equipo}</strong>:{" "}
                  {estado.rival.fuentes.join(" · ")}
                </li>
              )}
            </ul>
          </div>

          {(estado.boceto.avisos.length > 0 ||
            (estado.rival?.avisos.length ?? 0) > 0 ||
            !dentro) && (
            <Notice tone="warn" title="Lo que hay que saber antes de cerrarlo">
              <ul className="space-y-1">
                {estado.boceto.avisos.map((aviso) => (
                  <li key={aviso}>{aviso}</li>
                ))}

                {(estado.rival?.avisos ?? []).map((aviso) => (
                  <li key={aviso}>{aviso}</li>
                ))}

                {!dentro && (
                  <li>
                    El boceto suma {fmtMin(estado.boceto.minutos)} y el objetivo es{" "}
                    {estado.boceto.objetivo.minimo}-{estado.boceto.objetivo.maximo}′: los mínimos
                    por tarea no dan para cuadrarlo al minuto.
                  </li>
                )}
              </ul>
            </Notice>
          )}

          <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-white/35">
            <Wand2 size={12} className="mt-0.5 shrink-0" aria-hidden />
            Al aplicarlo se marcan los días y se escriben estas tareas. Lo que ya hubiera escrito a
            mano no se toca; si vuelves a proponer, se rehacen sólo las del boceto.
          </p>
        </div>
      )}
    </Dialog>
  );
}
