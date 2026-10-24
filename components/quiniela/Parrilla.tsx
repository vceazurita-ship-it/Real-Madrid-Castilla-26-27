"use client";

/**
 * LA PARRILLA: LO QUE PUSO CADA UNO, CUANDO YA SE PUEDE MIRAR.
 *
 * Se abre **al cerrarse la jornada**, el viernes a las 12:00. Antes de esa
 * hora ni siquiera llega a esta pantalla: el servidor manda los pronósticos de
 * los demás sólo cuando ya no se pueden copiar (`/api/quiniela/leer`).
 *
 * Es la parte que se mira en grupo, así que se pinta como un tablón y no como
 * una tabla de números:
 *
 * - **Una columna por persona**, con su cara, y una fila por partido.
 * - **El color lo pone el resultado** cuando lo hay: verde acertado, rojo
 *   fallado. Sin resultado, el signo se lee en dorado: todavía no hay nada que
 *   juzgar.
 * - **La tira de reparto** de cada partido —cuántos 1, cuántas X, cuántos 2—
 *   dice de un vistazo dónde hubo consenso y dónde se partió el vestuario.
 * - **Las dos etiquetas que se comentan el lunes**: «todos igual» cuando nadie
 *   se salió del guion y «el único» cuando alguien se la jugó solo.
 */

import { Lock, Trophy, Users } from "lucide-react";

import { Panel } from "@/components/abp/ui";
import { Avatar } from "@/components/quiniela/Avatar";
import {
  NOMBRE_DEL_SIGNO,
  SIGNOS,
  marcadorDe,
  parrillaDe,
  type JornadaQuiniela,
  type Signo,
} from "@/lib/quiniela/modelo";
import { PERSONA_POR_SLUG, nombreCorto } from "@/lib/quiniela/staff";

/** El color de un signo: lo manda el resultado, no quién lo puso. */
function tono(signo: Signo | null, resultado: Signo | null) {
  if (!signo) return "border-white/[0.06] text-white/15";

  if (!resultado) return "border-[#C8A96B]/30 bg-[#C8A96B]/[0.10] text-[#C8A96B]";

  return signo === resultado
    ? "border-emerald-400/40 bg-emerald-400/[0.14] text-emerald-200"
    : "border-rose-400/30 bg-rose-400/[0.10] text-rose-200/80";
}

const COLOR_SIGNO: Record<Signo, string> = {
  "1": "rgb(200 169 107 / 0.85)",
  X: "rgb(148 163 184 / 0.6)",
  "2": "rgb(120 170 255 / 0.55)",
};

export function Parrilla({
  jornada,
  jugadores,
  cerrada,
  cuandoSeAbre,
}: {
  jornada: JornadaQuiniela;
  jugadores: string[];
  /** Si la jornada ya está cerrada. Si no, esto no enseña nada. */
  cerrada: boolean;
  /** «viernes 18 de septiembre a las 12:00», para el cartel de espera. */
  cuandoSeAbre: string;
}) {
  if (!cerrada) {
    return (
      <Panel
        title="Lo que ha puesto cada uno"
        subtitle="Se abre al cerrarse la jornada"
        icon={Lock}
      >
        <p className="text-[12px] leading-relaxed text-white/45">
          Hasta el cierre —{cuandoSeAbre}— cada uno ve sólo su apuesta. No es
          por misterio: el servidor no manda la de los demás mientras se pueda
          copiar. En cuanto pase esa hora, aquí sale la parrilla entera y ya se
          puede discutir.
        </p>
      </Panel>
    );
  }

  const filas = parrillaDe(jornada, jugadores);

  const puestos = filas.reduce((total, fila) => total + fila.rellenado, 0);

  if (puestos === 0) {
    return (
      <Panel
        title="Lo que ha puesto cada uno"
        subtitle="Jornada cerrada"
        icon={Users}
      >
        <p className="text-[12px] text-white/45">
          Nadie llegó a rellenar esta jornada.
        </p>
      </Panel>
    );
  }

  /* El pie: los aciertos de cada uno en esta jornada, si ya hay resultados. */
  const marcadores = jugadores.map((slug) => ({
    slug,
    marcador: marcadorDe(jornada, slug),
  }));

  const mejor = Math.max(...marcadores.map((uno) => uno.marcador.aciertos), 0);

  const hayResultados = jornada.resultados.some(Boolean);

  /* La leyenda pone un caso real de esta jornada; si nadie se la jugó solo, no sale. */
  const slugSolo = filas.flatMap((fila) => fila.solitarios)[0];
  const personaSolo = slugSolo ? PERSONA_POR_SLUG.get(slugSolo) : undefined;
  const ejemploSolo = slugSolo ? (personaSolo ? nombreCorto(personaSolo) : slugSolo) : "";

  return (
    <Panel
      title="Lo que ha puesto cada uno"
      subtitle="Así votó cada uno la jornada"
      icon={Users}
    >
      {/* La leyenda, arriba: se lee antes de la tabla, no después. */}
      <ul className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-white/60">
        <li className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm border border-emerald-400/40 bg-emerald-400/[0.14]" />
          Acierto
        </li>

        <li className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm border border-rose-400/30 bg-rose-400/[0.10]" />
          Fallo
        </li>

        <li className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm border border-[#C8A96B]/30 bg-[#C8A96B]/[0.10]" />
          Pendiente de jugarse
        </li>

        {ejemploSolo && (
          <li className="flex items-center gap-1.5">
            <span className="rounded-full bg-[#C8A96B]/10 px-2 py-0.5 text-[10px] text-[#C8A96B]">
              Solo {ejemploSolo}
            </span>
            : el único que puso ese signo en ese partido
          </li>
        )}

        <li className="flex items-center gap-1.5">
          <span className="flex h-3 w-10 overflow-hidden rounded-sm">
            {SIGNOS.map((signo) => (
              <span
                key={signo}
                className="flex-1"
                style={{ background: COLOR_SIGNO[signo] }}
              />
            ))}
          </span>
          Reparto de 1 · X · 2
        </li>
      </ul>

      <div className="min-w-0 overflow-x-auto">
        <table
          className="w-full text-[12px]"
          style={{ minWidth: `${340 + jugadores.length * 58}px` }}
        >
          <thead>
            <tr>
              <th className="pb-3 text-left text-[10px] uppercase tracking-[0.12em] font-medium text-white/40">
                Partido
              </th>

              <th className="w-[112px] pb-3 text-center text-[10px] uppercase tracking-[0.12em] font-medium text-white/40">
                Reparto
              </th>

              {jugadores.map((slug) => {
                const persona = PERSONA_POR_SLUG.get(slug);

                return (
                  <th key={slug} className="w-[58px] pb-3 align-bottom">
                    <span className="flex flex-col items-center gap-1">
                      <Avatar slug={slug} lado={26} />

                      <span className="block max-w-[56px] truncate text-[9px] font-normal text-white/45">
                        {persona ? nombreCorto(persona) : slug}
                      </span>

                      {filas.every((fila) => !fila.signos[slug]) && (
                        <span className="block text-[9px] font-normal text-white/40">
                          sin apostar
                        </span>
                      )}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {filas.map((fila) => (
              <tr key={fila.indice} className="border-t border-white/[0.06]">
                <td className="py-2 pr-3">
                  <span className="flex items-baseline gap-2">
                    <span className="min-w-0">
                      <span className="block truncate text-white/85">
                        {fila.partido.local}
                      </span>

                      <span className="block truncate text-[11px] text-white/40">
                        {fila.partido.visitante}
                      </span>
                    </span>

                    {fila.resultado && (
                      <span className="shrink-0 rounded-md border border-white/15 px-1.5 py-0.5 text-[11px] font-semibold text-white/75">
                        {fila.resultado}
                      </span>
                    )}
                  </span>

                  {/* Lo que se comenta: el pleno y el que se la jugó solo. */}
                  <span className="mt-1 flex flex-wrap gap-1">
                    {fila.unanime && (
                      <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] text-white/50">
                        Todos igual
                      </span>
                    )}

                    {fila.solitarios.map((slug) => (
                      <span
                        key={slug}
                        className="rounded-full bg-[#C8A96B]/10 px-2 py-0.5 text-[10px] text-[#C8A96B]"
                        title={`Es el único que puso ${fila.signos[slug]}: ${
                          NOMBRE_DEL_SIGNO[fila.signos[slug] as Signo]
                        }`}
                      >
                        Solo{" "}
                        {(() => {
                          const persona = PERSONA_POR_SLUG.get(slug);

                          return persona ? nombreCorto(persona) : slug;
                        })()}
                      </span>
                    ))}
                  </span>
                </td>

                {/* La tira de reparto: 1 en dorado, X en gris, 2 en azul. */}
                <td className="min-w-[112px] px-1 py-2 pr-3">
                  <span
                    className="flex h-[22px] w-full min-w-[96px] overflow-hidden rounded"
                    title={SIGNOS.map((signo) => `${signo}: ${fila.votos[signo]}`).join(" · ")}
                  >
                    {SIGNOS.map((signo) =>
                      fila.votos[signo] > 0 ? (
                        <span
                          key={signo}
                          className="flex items-center justify-center text-[11px] font-semibold tabular-nums text-black/70"
                          /* Cada tramo crece con sus votos pero nunca baja de
                             16 px, para que el número se lea aunque sea 1 de 10. */
                          style={{
                            flex: `${fila.votos[signo]} 1 0`,
                            minWidth: 18,
                            background: COLOR_SIGNO[signo],
                          }}
                        >
                          {fila.votos[signo]}
                        </span>
                      ) : null,
                    )}
                  </span>
                </td>

                {jugadores.map((slug) => (
                  <td key={slug} className="px-1 py-2 text-center">
                    <span
                      className={`inline-flex h-7 w-8 items-center justify-center rounded-md border text-[12px] font-semibold ${tono(
                        fila.signos[slug],
                        fila.resultado,
                      )}`}
                      title={
                        fila.signos[slug]
                          ? NOMBRE_DEL_SIGNO[fila.signos[slug] as Signo]
                          : "No lo puso"
                      }
                    >
                      {fila.signos[slug] ?? "·"}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>

          {hayResultados && (
            <tfoot>
              <tr className="border-t border-white/10">
                <td
                  colSpan={2}
                  className="py-2 text-[10px] uppercase tracking-[0.12em] text-white/40"
                >
                  Aciertos
                </td>

                {marcadores.map(({ slug, marcador }) => (
                  <td key={slug} className="px-1 py-2 text-center">
                    <span
                      className={`inline-flex items-center gap-1 text-[12px] tabular-nums ${
                        marcador.aciertos === mejor && mejor > 0
                          ? "font-semibold text-[#C8A96B]"
                          : "text-white/60"
                      }`}
                    >
                      {marcador.aciertos === mejor && mejor > 0 && (
                        <Trophy size={11} aria-label="El que más acertó" />
                      )}
                      {marcador.aciertos}
                    </span>
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-white/50">
        · = no apostó · copa = el que más acertó.
      </p>
    </Panel>
  );
}
