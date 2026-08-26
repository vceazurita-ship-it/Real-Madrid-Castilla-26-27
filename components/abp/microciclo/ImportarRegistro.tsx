"use client";

/**
 * Traer al plan las tareas de ABP que ya están registradas.
 *
 * La hoja de registro de tareas guarda lo que se hizo de verdad, con su tiempo
 * y su desgaste **medido**. Importarlo evita teclear dos veces lo mismo y, más
 * importante, hace que el cruce con competición use cargas reales en vez de
 * estimaciones.
 *
 * Lo que la hoja no guarda es el vocabulario de esta pantalla: escribe
 * «Córners y faltas laterales ofensivas» en una casilla de texto libre, donde
 * caben dos aspectos del catálogo. Por eso el lado y el aspecto llegan como
 * **propuesta editable** y no se aplican solos: una importación que se
 * equivoca en silencio ensucia el cruce durante toda la temporada.
 */

import { useMemo, useState } from "react";
import { Download } from "lucide-react";

import { Button, Dialog, EmptyState } from "@/components/abp/ui";
import {
  ASPECTOS_POR_GRUPO,
  DIAS,
  LADOS,
  fmtMin,
  type AbpLado,
  type AspectoKey,
} from "@/lib/abp/microciclo";
import {
  aspectoDeTarea,
  ladoDeTarea,
  type RegistroTarea,
} from "@/lib/abp/registro";

export type Importacion = {
  tarea: RegistroTarea;
  lado: AbpLado;
  aspecto: AspectoKey;
};

type Fila = {
  tarea: RegistroTarea;
  lado: AbpLado;
  aspecto: AspectoKey;
  marcada: boolean;
  /** El lado o el aspecto los ha deducido la app, no la hoja. */
  propuesto: boolean;
  /** Ya está en el plan: no se vuelve a traer. */
  yaEsta: boolean;
};

function claveFila(tarea: RegistroTarea) {
  return `${tarea.micro}-${tarea.dia}-${tarea.tarea}`;
}

export function ImportarRegistro({
  tareas,
  yaImportadas,
  onImportar,
  onCerrar,
}: {
  tareas: RegistroTarea[];
  /** `tareaId` de lo que ya está en el plan. */
  yaImportadas: Set<string>;
  onImportar: (seleccion: Importacion[]) => void;
  onCerrar: () => void;
}) {
  const [filas, setFilas] = useState<Fila[]>(() =>
    tareas.map((tarea) => {
      const lado = ladoDeTarea(tarea);
      const aspecto = aspectoDeTarea(tarea);
      const yaEsta = yaImportadas.has(claveFila(tarea));

      return {
        tarea,
        lado: lado ?? "ofensivo",
        aspecto: aspecto ?? "corner-directo",
        marcada: !yaEsta,
        propuesto: lado === null || aspecto === null,
        yaEsta,
      };
    }),
  );

  const set = (indice: number, cambio: Partial<Fila>) =>
    setFilas((actual) =>
      actual.map((fila, i) => (i === indice ? { ...fila, ...cambio } : fila)),
    );

  const marcadas = useMemo(
    () => filas.filter((fila) => fila.marcada && !fila.yaEsta),
    [filas],
  );

  const minutos = marcadas.reduce(
    (total, fila) => total + (fila.tarea.tiempo || 0),
    0,
  );

  return (
    <Dialog
      title="Importar del registro de tareas"
      subtitle={
        tareas.length
          ? `${tareas.length} tarea${tareas.length === 1 ? "" : "s"} de ABP en este microciclo`
          : undefined
      }
      onClose={onCerrar}
      footer={
        <>
          <Button onClick={onCerrar}>Cancelar</Button>

          <Button
            tone="primary"
            icon={Download}
            disabled={!marcadas.length}
            onClick={() =>
              onImportar(
                marcadas.map((fila) => ({
                  tarea: fila.tarea,
                  lado: fila.lado,
                  aspecto: fila.aspecto,
                })),
              )
            }
          >
            {marcadas.length
              ? `Importar ${marcadas.length} · ${fmtMin(minutos)}`
              : "Importar"}
          </Button>
        </>
      }
    >
      {!tareas.length ? (
        <EmptyState
          title="Este microciclo no tiene tareas de ABP registradas"
          description="La hoja de registro no marca el balón parado con una casilla propia: se reconoce por la fase y por el contenido. Si sabes que las hubo, revisa cómo están escritas allí."
        />
      ) : (
        <div className="space-y-2">
          <p className="text-[11px] leading-relaxed text-white/40">
            El tiempo y las cargas llegan medidos desde la hoja. El lado y el
            aspecto son una lectura del texto del contenido: repásalos antes de
            importar, sobre todo los marcados como propuesta.
          </p>

          {filas.map((fila, indice) => {
            const dia = DIAS.find((item) => item.key === fila.tarea.dia);

            return (
              <div
                key={claveFila(fila.tarea)}
                className={`rounded-xl border p-2.5 transition ${
                  fila.yaEsta
                    ? "border-white/[0.06] bg-white/[0.01] opacity-50"
                    : fila.marcada
                      ? "border-[#C8A96B]/35 bg-[#C8A96B]/[0.05]"
                      : "border-white/10 bg-white/[0.02]"
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    checked={fila.marcada && !fila.yaEsta}
                    disabled={fila.yaEsta}
                    onChange={(event) =>
                      set(indice, { marcada: event.target.checked })
                    }
                    aria-label={`Importar ${fila.tarea.tarea}`}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-[#C8A96B]"
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-[#C8A96B]">
                        {dia?.corto ?? "—"}
                        {fila.tarea.md ? ` · ${fila.tarea.md}` : ""}
                      </span>

                      <span className="truncate text-sm text-white">
                        {fila.tarea.contenidoSecundario ||
                          fila.tarea.contenidoPrincipal ||
                          fila.tarea.tarea}
                      </span>

                      {fila.yaEsta && (
                        <span className="rounded bg-white/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-white/50">
                          ya en el plan
                        </span>
                      )}

                      {fila.propuesto && !fila.yaEsta && (
                        <span className="rounded bg-amber-400/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-amber-300">
                          propuesta
                        </span>
                      )}
                    </div>

                    <p className="mt-0.5 text-[10.5px] tabular-nums text-white/35">
                      {fila.tarea.tarea} · {fila.tarea.tipoTarea || "—"} ·{" "}
                      {fmtMin(fila.tarea.tiempo)} · carga{" "}
                      {Math.round(fila.tarea.carga)} · cognitiva{" "}
                      {Math.round(fila.tarea.cargaCog)}
                    </p>

                    {!fila.yaEsta && (
                      <div className="mt-2 grid gap-1.5 sm:grid-cols-[140px_minmax(0,1fr)]">
                        <select
                          value={fila.lado}
                          onChange={(event) =>
                            set(indice, {
                              lado: event.target.value as AbpLado,
                            })
                          }
                          aria-label="Lado"
                          className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-xs text-white outline-none focus:border-[#C8A96B]/50"
                        >
                          {LADOS.map((lado) => (
                            <option
                              key={lado.key}
                              value={lado.key}
                              className="bg-[#11161C]"
                            >
                              {lado.label}
                            </option>
                          ))}
                        </select>

                        <select
                          value={fila.aspecto}
                          onChange={(event) =>
                            set(indice, {
                              aspecto: event.target.value as AspectoKey,
                            })
                          }
                          aria-label="Aspecto"
                          className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-xs text-white outline-none focus:border-[#C8A96B]/50"
                        >
                          {ASPECTOS_POR_GRUPO.map((grupo) => (
                            <optgroup key={grupo.grupo} label={grupo.label}>
                              {grupo.aspectos.map((aspecto) => (
                                <option
                                  key={aspecto.key}
                                  value={aspecto.key}
                                  className="bg-[#11161C]"
                                >
                                  {aspecto.label}
                                </option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Dialog>
  );
}
