"use client";

/**
 * EL BOCETO DE LA SEMANA, PARA MIRARLO ANTES DE APLICARLO.
 *
 * El motor está en `lib/abp/boceto.ts`; esto es la cara: trae lo que hace
 * falta —nuestro calendario de BeSoccer y el balón parado de la liga—, enseña
 * la semana propuesta día a día con el porqué de cada tarea, y sólo escribe en
 * el plan cuando alguien pulsa «Aplicar al plan».
 *
 * **Propone, no cierra.** Lo aplicado queda como cualquier otra tarea: se
 * mueve, se recorta y se borra. Las tareas del boceto se reconocen por su nota
 * (`Boceto ·`), así que volver a proponer no duplica nada y lo escrito a mano
 * no se toca.
 */

import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Check, Info, Wand2 } from "lucide-react";

import { Button, Dialog, EmptyState, Notice } from "@/components/abp/ui";
import {
  construyeBoceto,
  semanaDe,
  type Boceto,
} from "@/lib/abp/boceto";
import { construyeRivalAbp, type RivalAbp } from "@/lib/abp/rivalAbp";
import {
  alrededorDe,
  CLAVE_CALENDARIO,
  soloDia,
  type PartidoCastilla,
  type PartidoNuestro,
} from "@/lib/castilla/calendario";
import type { CompeticionEvent } from "@/lib/abp/competicion";
import type { ComparativaAbp } from "@/lib/abp/informe-graficos";
import {
  DIAS,
  MOMENTO_SHORT,
  etiquetaLados,
  etiquetaTrabajo,
  fmtMin,
  type DiaKey,
  type MicroPlan,
  type PlanDia,
} from "@/lib/abp/microciclo";
import type { FilaCruce } from "@/lib/abp/transferencia";

type Estado =
  | { fase: "cargando" }
  | { fase: "roto"; motivo: string }
  | {
      fase: "listo";
      boceto: Boceto;
      proximo: PartidoNuestro;
      rivales: Record<string, RivalAbp | null>;
      fechas: string[];
    };

/** El día de la semana con su fecha, "lunes 21". */
function diaConFecha(fecha: string, nombre: string) {
  const numero = Number(fecha.slice(8, 10));

  return `${nombre} ${numero}`;
}

export function BocetoDialog({
  filas,
  plan,
  events,
  onAplicar,
  onCerrar,
}: {
  filas: FilaCruce[];
  plan: MicroPlan;
  events: CompeticionEvent[];
  onAplicar: (dias: Record<DiaKey, PlanDia>, rival: string, diasEntrenados: number) => void;
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

        if (calendario.length === 0) {
          setEstado({
            fase: "roto",
            motivo:
              "No tengo el calendario del Castilla. Lo baja de BeSoccer el ordenador del club (scripts/castilla-calendario.cjs, que corre solo cada pocas horas): en cuanto pase, esto funciona.",
          });

          return;
        }

        const { proximo, todos } = alrededorDe(calendario, Date.now());

        if (!proximo) {
          setEstado({ fase: "roto", motivo: "No queda ningún partido por jugar en el calendario." });

          return;
        }

        const fechas = semanaDe(proximo.cuando);

        /* Un perfil por cada rival de la semana: puede haber dos partidos. */
        const rivales: Record<string, RivalAbp | null> = {};

        for (const partido of todos) {
          if (!fechas.includes(soloDia(partido.cuando))) continue;

          rivales[partido.rival] = construyeRivalAbp({
            equipo: partido.rival,
            comparativa,
            events,
          });
        }

        setEstado({
          fase: "listo",
          proximo,
          fechas,
          rivales,
          boceto: construyeBoceto({ fechas, partidos: todos, filas, rivales, plan }),
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
  }, [filas, plan, events]);

  const resumen = useMemo(() => {
    if (estado.fase !== "listo") return null;

    const { boceto } = estado;

    const dentro =
      boceto.minutos >= boceto.objetivo.minimo && boceto.minutos <= boceto.objetivo.maximo;

    return { dentro, ...boceto };
  }, [estado]);

  return (
    <Dialog
      title="Boceto de la semana"
      subtitle="Lo propone la app con el calendario, nuestro rendimiento y el del rival. Se aplica al plan y se cierra a mano."
      onClose={onCerrar}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[11px] text-white/40">
            {estado.fase === "listo"
              ? `${fmtMin(estado.boceto.minutos)} en ${estado.boceto.diasEntrenados} entreno(s) · objetivo ${estado.boceto.objetivo.minimo}-${estado.boceto.objetivo.maximo}′`
              : "Mirando el calendario y los datos de la liga…"}
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
                  estado.proximo.rival,
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
          description="Se está mirando cuándo es el próximo partido y qué hace de balón parado el rival."
        />
      )}

      {estado.fase === "roto" && (
        <Notice tone="warn" title="No se puede proponer nada todavía">
          {estado.motivo}
        </Notice>
      )}

      {estado.fase === "listo" && resumen && (
        <div className="space-y-4">
          {/* ---------------- EL PARTIDO Y LA SEMANA ---------------- */}

          <div className="flex flex-wrap items-center gap-2.5 rounded-2xl border border-white/[0.07] px-4 py-3 text-[12px] leading-relaxed">
            <CalendarClock size={15} className="shrink-0 text-emerald-300" aria-hidden />

            <p className="text-white/55">
              Próximo partido:{" "}
              <strong className="text-white/85">
                J{estado.proximo.jornada} · {estado.proximo.rival}
              </strong>{" "}
              {estado.proximo.lado === "casa" ? "en casa" : "fuera"}, el{" "}
              {new Date(estado.proximo.cuando).toLocaleString("es-ES", {
                weekday: "long",
                day: "numeric",
                month: "long",
                hour: "2-digit",
                minute: "2-digit",
              })}
              . Semana del {estado.fechas[0].slice(8, 10)} al {estado.fechas[6].slice(8, 10)}.
            </p>
          </div>

          {/* ---------------- LOS DÍAS ---------------- */}

          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {DIAS.map((dia) => {
              const suyo = estado.boceto.dias[dia.key];

              const info = estado.boceto.reparto.find((uno) => uno.clave === dia.key);

              const minutos = suyo.trabajos.reduce((total, uno) => total + (uno.minutos || 0), 0);

              return (
                <div
                  key={dia.key}
                  className={`rounded-2xl border px-3 py-2.5 ${
                    suyo.tipo === "partido"
                      ? "border-emerald-400/25 bg-emerald-400/[0.06]"
                      : suyo.tipo === "descanso"
                        ? "border-white/[0.07] bg-white/[0.02]"
                        : "border-white/[0.07]"
                  }`}
                >
                  <p className="flex items-baseline justify-between gap-2 text-[12px]">
                    <span className="font-semibold text-white/80">
                      {info ? diaConFecha(info.fecha, dia.label.toLowerCase()) : dia.label}
                    </span>

                    <span className="text-[10px] uppercase tracking-wide text-white/40">
                      {suyo.tipo === "partido"
                        ? `MD · ${info?.prepara?.rival ?? ""}`
                        : suyo.tipo === "descanso"
                          ? "Descanso"
                          : `${suyo.md}${minutos ? ` · ${fmtMin(minutos)}` : ""}`}
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

                  {suyo.trabajos.length === 0 && suyo.tipo === "entreno" && (
                    <p className="mt-2 text-[10px] text-white/30">Sin balón parado.</p>
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
                <strong className="text-white/65">La semana</strong>, del calendario del Castilla
                en BeSoccer: cada día se prepara para su partido.
              </li>

              <li>
                <strong className="text-white/65">Los minutos</strong>, del objetivo de 90-100′ en
                una semana de seis entrenamientos, prorrateado a los{" "}
                {estado.boceto.diasEntrenados} de ésta ({estado.boceto.objetivo.minimo}-
                {estado.boceto.objetivo.maximo}′).
              </li>

              <li>
                <strong className="text-white/65">Los aspectos</strong>, de nuestra urgencia (55 %)
                y de lo que el rival ataca y concede (45 %).
              </li>

              {Object.entries(estado.rivales).map(([equipo, perfil]) => (
                <li key={equipo}>
                  <strong className="text-white/65">{equipo}</strong>:{" "}
                  {perfil ? perfil.fuentes.join(" · ") : "sin datos de balón parado"}
                </li>
              ))}
            </ul>
          </div>

          {(estado.boceto.avisos.length > 0 ||
            Object.values(estado.rivales).some((uno) => (uno?.avisos.length ?? 0) > 0)) && (
            <Notice tone="warn" title="Lo que hay que saber antes de cerrarlo">
              <ul className="space-y-1">
                {estado.boceto.avisos.map((aviso) => (
                  <li key={aviso}>{aviso}</li>
                ))}

                {[
                  ...new Set(
                    Object.values(estado.rivales).flatMap((uno) => uno?.avisos ?? []),
                  ),
                ].map((aviso) => (
                  <li key={aviso}>{aviso}</li>
                ))}

                {!resumen.dentro && (
                  <li>
                    El boceto suma {fmtMin(estado.boceto.minutos)} y el objetivo de la semana es{" "}
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
