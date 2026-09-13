"use client";

import { useMemo, useState } from "react";
import { LayoutGrid, Scale } from "lucide-react";

import { Notice, Panel } from "@/components/abp/ui";
import { Lectura } from "@/components/data/formas";
import { Campograma } from "@/components/data/Campograma";
import { MEJOR, PEOR } from "@/components/data/graficas";
import {
  MOMENTOS_CAMPO,
  fichasDe,
  lecturaDeMomento,
  type MomentoJuego,
} from "@/lib/data-analisis/campograma";
import type { FilaPartido } from "@/lib/data-analisis/leer";
import { formatea } from "@/lib/data-analisis/metricas";

/**
 * PARTIDO A PARTIDO, PINTADO EN EL CAMPO.
 *
 * A la izquierda el partido elegido y a la derecha lo que llevamos de
 * temporada, con las mismas cifras en el mismo sitio. Es la forma de contestar
 * a la pregunta que se hace el lunes por la mañana: **¿esto fue cosa de este
 * partido o es lo que somos?**
 */
export function PanelCampograma({
  nuestros,
  contrarios,
  temporada,
}: {
  /** Nuestras filas de la temporada elegida. */
  nuestros: FilaPartido[];
  /** Las filas de quien nos jugó, para las cifras «en contra». */
  contrarios: FilaPartido[];
  temporada: string;
}) {
  const [momento, setMomento] = useState<MomentoJuego>("con");

  const jugados = useMemo(
    () => [...nuestros].sort((a, b) => b.fecha.localeCompare(a.fecha)),
    [nuestros],
  );

  const [cual, setCual] = useState(0);

  const partido = jugados[Math.min(cual, Math.max(0, jugados.length - 1))] ?? null;

  /* La fila del rival de ese mismo partido: el informe trae las dos. */
  const contraDelPartido = useMemo(() => {
    if (!partido) return null;

    return (
      contrarios.find(
        (c) => c.fecha === partido.fecha && c.rival === partido.equipo,
      ) ?? null
    );
  }, [contrarios, partido]);

  const fichas = useMemo(
    () => fichasDe(momento, partido, contraDelPartido, nuestros, contrarios),
    [contraDelPartido, contrarios, momento, nuestros, partido],
  );

  if (jugados.length === 0) {
    return (
      <div className="mt-5">
        <Notice tone="warn" title="Sin partidos del Castilla en esta temporada">
          No hay informes del Castilla en {temporada}. Elige otra temporada
          arriba.
        </Notice>
      </div>
    );
  }

  const meta = MOMENTOS_CAMPO.find((m) => m.key === momento)!;

  return (
    <>
      {/* Qué momento y qué partido. */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap items-center rounded-xl border border-white/10 bg-white/[0.03] p-0.5">
          {MOMENTOS_CAMPO.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setMomento(m.key)}
              aria-pressed={momento === m.key}
              title={m.pregunta}
              className={`rounded-lg px-3 py-2 text-xs transition ${
                momento === m.key
                  ? "bg-[#C8A96B]/15 text-[#C8A96B]"
                  : "text-white/50 hover:text-white"
              }`}
            >
              {m.corto}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-[0.16em] text-white/40">
            Partido
          </span>

          <select
            value={cual}
            onChange={(e) => setCual(Number(e.target.value))}
            className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none transition focus:border-[#C8A96B]/50"
          >
            {jugados.map((p, i) => (
              <option key={p.fecha + p.rival} value={i} className="bg-[#11161C]">
                {p.fecha.slice(5)} · {p.rival} {p.golesFavor}-{p.golesContra}
              </option>
            ))}
          </select>
        </label>

        <span className="text-[11px] text-white/35">{meta.pregunta}</span>
      </div>

      <div className="mt-5">
        <Panel
          title={meta.label}
          subtitle="El partido a la izquierda y lo que llevamos de temporada a la derecha, con las mismas cifras en el mismo sitio"
          icon={LayoutGrid}
        >
          {/* La leyenda del color, una vez y arriba. */}
          <div className="mb-3 flex flex-wrap items-center gap-4 text-[10px] uppercase tracking-[0.16em]">
            <span className="flex items-center gap-1.5" style={{ color: MEJOR }}>
              <span
                className="inline-block h-2.5 w-2.5 rounded-[2px]"
                style={{ background: MEJOR }}
              />
              Por encima de nuestra media
            </span>

            <span className="flex items-center gap-1.5" style={{ color: PEOR }}>
              <span
                className="inline-block h-2.5 w-2.5 rounded-[2px]"
                style={{ background: PEOR }}
              />
              Por debajo
            </span>

            <span className="text-white/35">
              El campo ataca siempre hacia la derecha
            </span>
          </div>

          <div className="grid min-w-0 gap-6 xl:grid-cols-2">
            <Campograma
              fichas={fichas}
              lado="partido"
              titulo={partido ? `${partido.rival} · ${partido.golesFavor}-${partido.golesContra}` : "Partido"}
              subtitulo={partido ? partido.fecha : ""}
            />

            <Campograma
              fichas={fichas}
              lado="media"
              titulo="Nuestra media"
              subtitulo={`${nuestros.length} ${nuestros.length === 1 ? "partido" : "partidos"} de ${temporada}`}
            />
          </div>

          <Lectura>{lecturaDeMomento(fichas, partido?.rival ?? "")}</Lectura>

          <p className="mt-3 text-[11px] leading-relaxed text-white/40">
            El tanto por ciento de encima de cada cifra es lo que se separó de
            nuestra media, <strong className="text-white/60">con el sentido de
            la métrica puesto</strong>: en PPDA, pérdidas o remates en contra,
            bajar sale en verde. Con {nuestros.length}{" "}
            {nuestros.length === 1 ? "partido" : "partidos"} jugados la media es
            corta, y un partido la mueve entera.
          </p>
        </Panel>
      </div>

      {/* La tabla, para quien quiera el número exacto. */}
      <div className="mt-5">
        <Panel
          title="Las cifras del momento"
          subtitle="Lo mismo del campo, en columna, por si hace falta el número exacto"
          icon={Scale}
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-[0.16em] text-white/40">
                  <th className="pb-2 pr-3 font-medium">Métrica</th>
                  <th className="pb-2 pr-3 text-right font-medium">
                    {partido?.rival ?? "Partido"}
                  </th>
                  <th className="pb-2 pr-3 text-right font-medium">Media</th>
                  <th className="pb-2 text-right font-medium">Diferencia</th>
                </tr>
              </thead>

              <tbody>
                {fichas.map((f) => (
                  <tr
                    key={f.ficha.rotulo}
                    className="border-t border-white/[0.06]"
                  >
                    <td className="py-2 pr-3 text-white/75">
                      {f.ficha.rotulo}

                      {f.ficha.contra && (
                        <span className="ml-1.5 text-[10px] uppercase tracking-[0.14em] text-white/30">
                          del rival
                        </span>
                      )}
                    </td>

                    <td className="py-2 pr-3 text-right font-semibold tabular-nums text-white">
                      {formateaCelda(f.partido, f.unidad)}
                    </td>

                    <td className="py-2 pr-3 text-right tabular-nums text-white/55">
                      {formateaCelda(f.media, f.unidad)}
                    </td>

                    <td
                      className="py-2 text-right tabular-nums"
                      style={{
                        color:
                          f.diferencia === null || f.mejorAlto === null
                            ? "rgb(var(--rmcf-ink-rgb) / .35)"
                            : f.diferencia >= 0
                              ? MEJOR
                              : PEOR,
                      }}
                    >
                      {f.diferencia === null
                        ? "—"
                        : `${f.diferencia >= 0 ? "+" : ""}${f.diferencia.toFixed(0)} %`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </>
  );
}

const formateaCelda = (valor: number | null, unidad: Parameters<typeof formatea>[1]) =>
  valor === null ? "—" : formatea(valor, unidad);
