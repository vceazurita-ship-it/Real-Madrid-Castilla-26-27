"use client";

/**
 * La tabla del cruce: lo entrenado frente a lo que pasa en el partido.
 *
 * Una fila por aspecto. La columna de urgencia enseña al lado sus tres
 * ingredientes —cuánto ocurre, cómo nos sale, cuánto se ha trabajado— porque
 * un número solo no se puede discutir en una reunión, y este está para
 * discutirse.
 */

import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react";

import { Meter } from "@/components/abp/ui";
import { chipInk } from "@/lib/theme";
import {
  LADO_COLOR,
  LADO_LABEL,
  LADO_SHORT,
  fmtMin,
  type AbpLado,
} from "@/lib/abp/microciclo";
import {
  colorUrgencia,
  etiquetaUrgencia,
  formulaUrgencia,
  type FilaCruce,
} from "@/lib/abp/transferencia";

function Th({
  children,
  align = "left",
  title,
}: {
  children: React.ReactNode;
  align?: "left" | "right" | "center";
  title?: string;
}) {
  return (
    <th
      title={title}
      className={`whitespace-nowrap px-2.5 py-2 text-[10px] font-medium uppercase tracking-wider text-white/40 ${
        align === "right"
          ? "text-right"
          : align === "center"
            ? "text-center"
            : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

/** Las tres barras que explican la urgencia, cada una con su número (0-100). */
function Ingredientes({ fila }: { fila: FilaCruce }) {
  const { ingredientes, lado, referencia, peligroAjustado } = fila;

  /*
  | «Rinde peor» sólo cuando de verdad rinde peor que los suyos (21/10/2026).
  | Defendiendo, peor es conceder MÁS peligro que la familia; atacando, generar
  | MENOS. Antes la barra salía siempre, también en DEF Z3 (2 % frente a 3 %),
  | que concede menos que su familia.
  */
  const diferencia =
    lado === "ofensivo" ? referencia - peligroAjustado : peligroAjustado - referencia;
  const rinde = diferencia >= 1 ? "peor" : diferencia <= -1 ? "mejor" : "igual";

  const barras = [
    {
      label: "Daño",
      valor: ingredientes.dano as number | null,
      color: "#5E7FB8",
      ayuda:
        lado === "ofensivo"
          ? "El peligro que nos falta frente a su familia, por las veces que ocurre, comparado con el aspecto en que más nos falta"
          : "Las acciones con peligro que nos han hecho (cada gol cuenta tres veces), comparadas con el aspecto que más daño nos hace",
    },
    {
      label: rinde === "peor" ? "Rinde peor" : rinde === "mejor" ? "Rinde mejor" : "Como los suyos",
      valor: rinde === "peor" ? Math.max(0, ingredientes.deficit * 2 - 1) : null,
      color: "#F87171",
      ayuda:
        lado === "ofensivo"
          ? `Genera peligro en el ${peligroAjustado.toFixed(0)} % de sus acciones; su familia, en el ${referencia.toFixed(0)} %.`
          : `Nos hacen peligro en el ${peligroAjustado.toFixed(0)} % de estas acciones; en su familia, en el ${referencia.toFixed(0)} %.`,
    },
    {
      label: "Sin trabajar",
      valor: ingredientes.desatencion as number | null,
      color: "#FBBF24",
      ayuda: "Cuán pocos minutos se le han dedicado esta temporada, frente al aspecto más trabajado",
    },
  ];

  return (
    <div className="flex w-[150px] flex-col gap-[3px]">
      {barras.map((barra) => (
        <div
          key={barra.label}
          className="flex items-center gap-1.5"
          title={`${barra.label}${barra.valor === null ? "" : `: ${Math.round(barra.valor * 100)} de 100`}. ${barra.ayuda}`}
        >
          <span
            className={`w-[76px] shrink-0 truncate text-[9px] uppercase tracking-wide ${
              rinde === "mejor" && barra.valor === null ? "text-emerald-300/85" : "text-white/45"
            }`}
          >
            {barra.label}
          </span>

          {barra.valor === null ? (
            <span className="flex-1" />
          ) : (
            <Meter value={barra.valor} max={1} color={barra.color} label={barra.label} />
          )}

          <span className="w-5 shrink-0 text-right text-[9px] tabular-nums text-white/45">
            {barra.valor === null ? "" : Math.round(barra.valor * 100)}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Flecha de transferencia: positiva es «después de trabajarlo, mejor». */
function Transferencia({ fila }: { fila: FilaCruce }) {
  const t = fila.transferencia;

  if (!t) {
    return null;
  }

  if (t.delta === null) {
    return (
      <span
        className="text-[10px] text-white/40"
        title={`Hacen falta al menos dos partidos comparables con tres acciones cada uno. Ahora mismo: ${t.partidosCon} ${t.partidosCon === 1 ? "partido" : "partidos"} con trabajo previo (${t.accionesCon} acciones) y ${t.partidosSin} sin él (${t.accionesSin}).`}
      >
        sin muestra
      </span>
    );
  }

  const mejora = t.delta > 2;
  const empeora = t.delta < -2;

  const color = mejora ? "#34D399" : empeora ? "#F87171" : "#9AA5B1";
  const Icono = mejora ? ArrowUp : empeora ? ArrowDown : ArrowRight;

  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] font-semibold tabular-nums"
      style={{ color: chipInk(color) }}
      title={`Con trabajo previo: ${t.pctCon.toFixed(0)} % en ${t.partidosCon} ${t.partidosCon === 1 ? "partido" : "partidos"}. Sin él: ${t.pctSin.toFixed(0)} % en ${t.partidosSin}.`}
    >
      <Icono size={11} />
      {t.delta > 0 ? "+" : ""}
      {t.delta.toFixed(0)} pp
    </span>
  );
}

export function CruceTabla({ filas }: { filas: FilaCruce[] }) {
  const maxAcciones = Math.max(1, ...filas.map((fila) => fila.stats.acciones));

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1080px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-white/10">
            <Th>Aspecto</Th>
            <Th align="right" title="Minutos en el microciclo abierto">
              Micro
            </Th>
            <Th align="right" title="Minutos en todo lo planificado">
              Temporada
            </Th>
            <Th
              align="right"
              title="Acciones del Castilla en nuestras hojas de ABP: atacando (ATA) son las nuestras y defendiendo (DEF) las del rival contra nosotros"
            >
              Acciones
            </Th>
            <Th align="right">Remates</Th>
            <Th align="right">Goles</Th>
            <Th
              align="right"
              title="Qué parte de las acciones acaba en peligro (suavizado para que una sola jugada no marque un 100 %), y al lado la media de su familia: córners con córners, faltas con faltas, bandas con bandas"
            >
              % peligro · familia
            </Th>
            <Th
              align="center"
              title="De 0 a 100 cada barra. Daño pesa el 50 %, rendir peor que los suyos el 30 % y lo poco trabajado el 20 %"
            >
              Por qué
            </Th>
            <Th
              align="right"
              title="Daño × 50 % + rinde peor × 30 % + sin trabajar × 20 %. Un aspecto con goles en contra nunca baja de alta ni del tercer puesto"
            >
              Urgencia
            </Th>
            <Th
              align="right"
              title="Diferencia entre los partidos precedidos de trabajo y los que no lo tuvieron"
            >
              Transfer.
            </Th>
          </tr>
        </thead>

        <tbody>
          {filas.map((fila) => {
            const color = LADO_COLOR[fila.lado];
            const sinRegistro = !fila.aspecto.reconocimiento;

            return (
              <tr
                key={`${fila.aspecto.key}-${fila.lado}`}
                className="border-b border-white/[0.06] transition hover:bg-white/[0.02]"
              >
                <td className="px-2.5 py-2">
                  <div className="flex min-w-0 items-center gap-2">
                    {/* El lado escrito, no sólo un punto de color: dos filas de
                        «Saque de banda Z2» seguidas no se distinguían. */}
                    <span
                      className="w-9 shrink-0 rounded px-1 py-0.5 text-center text-[9px] font-semibold tracking-wide"
                      style={{ backgroundColor: `${color}1F`, color: chipInk(color) }}
                      title={LADO_LABEL[fila.lado]}
                    >
                      {LADO_SHORT[fila.lado]}
                    </span>

                    <span className="truncate text-[12.5px] text-white">
                      {fila.aspecto.label}
                    </span>

                    {fila.stats.sinClasificar > 0 && (
                      <span
                        className="shrink-0 rounded bg-amber-400/12 px-1.5 py-0.5 text-[9px] font-semibold text-amber-300/80"
                        title={`${fila.stats.sinClasificar} ${fila.stats.sinClasificar === 1 ? "acción" : "acciones"} de esta familia sin «Tipo_Envio» en la hoja: no se han repartido entre directo e indirecto.`}
                      >
                        +{fila.stats.sinClasificar} s/c
                      </span>
                    )}
                  </div>
                </td>

                <td className="px-2.5 py-2 text-right text-[12px] tabular-nums">
                  <span
                    className={
                      fila.minutosMicro ? "text-white" : "text-white/20"
                    }
                  >
                    {fila.minutosMicro ? fmtMin(fila.minutosMicro) : ""}
                  </span>
                </td>

                <td className="px-2.5 py-2 text-right text-[12px] tabular-nums text-white/60">
                  {fila.minutosTemporada ? fmtMin(fila.minutosTemporada) : ""}
                </td>

                {sinRegistro ? (
                  <td
                    colSpan={6}
                    className="px-2.5 py-2 text-[11px] italic text-white/40"
                  >
                    {fila.aspecto.sinDato ??
                      "Sin acciones registradas de este tipo."}
                  </td>
                ) : (
                  <>
                    <td className="px-2.5 py-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-[12px] tabular-nums text-white">
                          {fila.stats.acciones}
                        </span>

                        <span className="w-10">
                          <Meter
                            value={fila.stats.acciones}
                            max={maxAcciones}
                            color={color}
                            label="Acciones"
                          />
                        </span>
                      </div>
                    </td>

                    <td className="px-2.5 py-2 text-right text-[12px] tabular-nums text-white/60">
                      {fila.stats.remates || ""}
                    </td>

                    <td className="px-2.5 py-2 text-right text-[12px] font-semibold tabular-nums">
                      <span
                        className={
                          fila.stats.goles
                            ? fila.lado === "ofensivo"
                              ? "text-emerald-300"
                              : "text-red-300"
                            : "text-white/20"
                        }
                      >
                        {fila.stats.goles || ""}
                      </span>
                    </td>

                    <td
                      className="px-2.5 py-2 text-right text-[12px] tabular-nums text-white/70"
                      title={`Su familia va al ${fila.referencia.toFixed(0)} % en este lado`}
                    >
                      {fila.stats.acciones ? (
                        <>
                          {fila.peligroAjustado.toFixed(0)} %
                          <span className="ml-1 text-[10px] text-white/40">
                            · {fila.referencia.toFixed(0)} %
                          </span>
                          {fila.stats.acciones < 5 && (
                            <span
                              className="ml-1.5 text-[9.5px] text-white/40"
                              title="Con menos de cinco acciones es una tendencia, no un veredicto"
                            >
                              pocos casos ({fila.stats.acciones})
                            </span>
                          )}
                        </>
                      ) : (
                        ""
                      )}
                    </td>

                    <td className="px-2.5 py-2">
                      <div className="flex justify-center">
                        <Ingredientes fila={fila} />
                      </div>
                    </td>

                    <td className="px-2.5 py-2 text-right">
                      {fila.urgencia !== null && (
                        <span
                          className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums"
                          style={{
                            backgroundColor: `${colorUrgencia(fila.urgencia)}1F`,
                            color: chipInk(colorUrgencia(fila.urgencia)),
                          }}
                          title={`Urgencia ${etiquetaUrgencia(fila.urgencia).toLowerCase()}. ${formulaUrgencia(fila)}`}
                        >
                          {Math.round(fila.urgencia)}
                        </span>
                      )}
                    </td>

                    <td className="px-2.5 py-2 text-right">
                      <Transferencia fila={fila} />
                    </td>
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
