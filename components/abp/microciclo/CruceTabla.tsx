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
import {
  LADO_COLOR,
  LADO_LABEL,
  fmtMin,
  type AbpLado,
} from "@/lib/abp/microciclo";
import {
  colorUrgencia,
  etiquetaUrgencia,
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

/** Las tres barras que explican la urgencia. */
function Ingredientes({
  ingredientes,
  lado,
  referencia,
}: {
  ingredientes: { volumen: number; deficit: number; desatencion: number };
  lado: AbpLado;
  referencia: number;
}) {
  const barras = [
    {
      label: "Volumen",
      valor: ingredientes.volumen,
      color: "#5E7FB8",
      ayuda: "Cuánto ocurre en competición, comparado con el aspecto que más ocurre",
    },
    {
      label: "Peor que los suyos",
      valor: ingredientes.deficit,
      color: "#F87171",
      ayuda:
        lado === "ofensivo"
          ? `Cuánto menos peligro genera que el resto de su familia, que va al ${referencia.toFixed(0)} %. La mitad de la barra es «como los demás».`
          : `Cuánto más peligro concede que el resto de su familia, que va al ${referencia.toFixed(0)} %. La mitad de la barra es «como los demás».`,
    },
    {
      label: "Sin trabajar",
      valor: ingredientes.desatencion,
      color: "#FBBF24",
      ayuda: "Cuán pocos minutos se le han dedicado esta temporada",
    },
  ];

  return (
    <div className="flex w-[112px] flex-col gap-[3px]">
      {barras.map((barra) => (
        <div
          key={barra.label}
          className="flex items-center gap-1.5"
          title={`${barra.label}: ${Math.round(barra.valor * 100)} % — ${barra.ayuda}`}
        >
          <span className="w-[62px] shrink-0 truncate text-[8.5px] uppercase tracking-wide text-white/30">
            {barra.label}
          </span>

          <Meter value={barra.valor} max={1} color={barra.color} label={barra.label} />
        </div>
      ))}
    </div>
  );
}

/** Flecha de transferencia: positiva es «después de trabajarlo, mejor». */
function Transferencia({ fila }: { fila: FilaCruce }) {
  const t = fila.transferencia;

  if (!t) {
    return <span className="text-[11px] text-white/20">—</span>;
  }

  if (t.delta === null) {
    return (
      <span
        className="text-[10px] text-white/25"
        title={`Hacen falta al menos dos partidos comparables con tres acciones cada uno. Ahora mismo: ${t.partidosCon} partido(s) con trabajo previo (${t.accionesCon} acciones) y ${t.partidosSin} sin él (${t.accionesSin}).`}
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
      style={{ color }}
      title={`Con trabajo previo: ${t.pctCon.toFixed(0)} % en ${t.partidosCon} partido(s). Sin él: ${t.pctSin.toFixed(0)} % en ${t.partidosSin}.`}
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
            <Th align="right">Acciones</Th>
            <Th align="right">Remates</Th>
            <Th align="right">Goles</Th>
            <Th
              align="right"
              title="Peligro por acción, suavizado para que una sola jugada no marque un 100 %, y al lado el de su familia"
            >
              Peligro / fam.
            </Th>
            <Th align="center">Por qué</Th>
            <Th align="right">Urgencia</Th>
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
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: color }}
                      title={LADO_LABEL[fila.lado]}
                    />

                    <span className="truncate text-[12.5px] text-white">
                      {fila.aspecto.label}
                    </span>

                    {fila.stats.sinClasificar > 0 && (
                      <span
                        className="shrink-0 rounded bg-amber-400/12 px-1.5 py-0.5 text-[9px] font-semibold text-amber-300/80"
                        title={`${fila.stats.sinClasificar} acción(es) de esta familia sin «Tipo_Envio» en la hoja: no se han repartido entre directo e indirecto.`}
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
                    {fila.minutosMicro ? fmtMin(fila.minutosMicro) : "—"}
                  </span>
                </td>

                <td className="px-2.5 py-2 text-right text-[12px] tabular-nums text-white/60">
                  {fila.minutosTemporada ? fmtMin(fila.minutosTemporada) : "—"}
                </td>

                {sinRegistro ? (
                  <td
                    colSpan={6}
                    className="px-2.5 py-2 text-[11px] italic text-white/25"
                  >
                    {fila.aspecto.sinDato ??
                      "Ninguna hoja de ABP registra esta acción."}
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
                      {fila.stats.remates || "—"}
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
                        {fila.stats.goles || "—"}
                      </span>
                    </td>

                    <td
                      className="px-2.5 py-2 text-right text-[12px] tabular-nums text-white/70"
                      title={`Su familia va al ${fila.referencia.toFixed(0)} % en este lado`}
                    >
                      {fila.stats.acciones ? (
                        <>
                          {fila.peligroAjustado.toFixed(0)} %
                          <span className="ml-1 text-[10px] text-white/25">
                            /{fila.referencia.toFixed(0)}
                          </span>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>

                    <td className="px-2.5 py-2">
                      <div className="flex justify-center">
                        <Ingredientes
                          ingredientes={fila.ingredientes}
                          lado={fila.lado}
                          referencia={fila.referencia}
                        />
                      </div>
                    </td>

                    <td className="px-2.5 py-2 text-right">
                      {fila.urgencia !== null && (
                        <span
                          className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums"
                          style={{
                            backgroundColor: `${colorUrgencia(fila.urgencia)}1F`,
                            color: colorUrgencia(fila.urgencia),
                          }}
                          title={`Urgencia ${etiquetaUrgencia(fila.urgencia)}`}
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
