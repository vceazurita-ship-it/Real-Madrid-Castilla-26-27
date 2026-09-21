"use client";

/**
 * EL HISTÓRICO: CÓMO FUE CADA UNO EN CADA JORNADA.
 *
 * La pantalla de la jornada enseña una semana; esto enseña **todas a la vez**,
 * que es la pregunta del lunes: «¿cuántas llevo?», «¿quién ganó la 3?».
 *
 * - **Una fila por persona y una columna por jornada**, con los aciertos sobre
 *   los partidos que ya tenían resultado esa semana.
 * - **El color es el acierto de esa jornada**, no un adorno: verde si acertó
 *   más de la mitad, rojo si menos de un tercio.
 * - **La copa marca a quien ganó la jornada**, empates incluidos: es el mismo
 *   criterio del ranking, sin desempates inventados.
 * - **Sólo salen las jornadas que ya se pueden mirar**: una abierta enseñaría
 *   los pronósticos de los demás antes de tiempo, y el servidor ni siquiera los
 *   manda ([[app/api/quiniela/leer]]).
 *
 * Pulsando el número de la jornada se abre esa semana en la pantalla de
 * siempre, con su parrilla y sus partidos.
 */

import { CalendarRange, Trophy } from "lucide-react";

import { EmptyState, Panel } from "@/components/abp/ui";
import { Avatar } from "@/components/quiniela/Avatar";
import {
  marcadorDe,
  type DocumentoQuiniela,
  type JornadaQuiniela,
} from "@/lib/quiniela/modelo";
import { PERSONA_POR_SLUG, nombreCorto } from "@/lib/quiniela/staff";

/** Verde si acertó más de la mitad; rojo si menos de un tercio. */
function tono(aciertos: number, jugados: number) {
  if (jugados === 0) return "text-white/25";

  const parte = aciertos / jugados;

  if (parte >= 0.5) return "text-emerald-300";

  if (parte < 0.34) return "text-rose-300";

  return "text-white/70";
}

type Fila = {
  slug: string;
  /** Lo de cada jornada, en el mismo orden que la cabecera. */
  celdas: { jornada: number; aciertos: number; jugados: number; gano: boolean }[];
  aciertos: number;
  jugados: number;
  ganadas: number;
};

export function Historico({
  doc,
  jugadores,
  jornadaAbierta,
  onVerJornada,
}: {
  doc: DocumentoQuiniela;
  jugadores: string[];
  /** La que se está viendo en la pantalla de la jornada, para resaltarla. */
  jornadaAbierta: number;
  onVerJornada: (jornada: number) => void;
}) {
  /*
  | Las jornadas que se pueden mirar: las que tienen algún resultado puesto.
  |
  | Es el mismo listón que usa el ranking. Una jornada sin un solo resultado no
  | dice nada de nadie —todos a cero— y llenaría la tabla de columnas vacías.
  */
  const jornadas: JornadaQuiniela[] = Object.values(doc.jornadas ?? {})
    .filter((una) => (una.resultados ?? []).some(Boolean))
    .sort((a, b) => a.jornada - b.jornada);

  if (jornadas.length === 0) {
    return (
      <Panel
        title="Jornadas anteriores"
        subtitle="Cómo fue cada uno, semana a semana"
        icon={CalendarRange}
      >
        <EmptyState
          title="Todavía no hay ninguna jornada con resultados"
          description="En cuanto se juegue la primera y se pongan sus resultados, aquí aparece la tabla con lo de cada uno."
        />
      </Panel>
    );
  }

  /* Quién ganó cada jornada: el que más acertó, y si empatan, los dos. */
  const mejorDe = new Map<number, number>();

  for (const jornada of jornadas) {
    const mejor = jugadores.reduce(
      (mayor, slug) => Math.max(mayor, marcadorDe(jornada, slug).aciertos),
      0,
    );

    mejorDe.set(jornada.jornada, mejor);
  }

  const filas: Fila[] = jugadores
    .map((slug) => {
      const celdas = jornadas.map((jornada) => {
        const marcador = marcadorDe(jornada, slug);

        return {
          jornada: jornada.jornada,
          aciertos: marcador.aciertos,
          jugados: marcador.jugados,
          gano:
            marcador.aciertos > 0 &&
            marcador.aciertos === mejorDe.get(jornada.jornada),
        };
      });

      return {
        slug,
        celdas,
        aciertos: celdas.reduce((suma, una) => suma + una.aciertos, 0),
        jugados: celdas.reduce((suma, una) => suma + una.jugados, 0),
        ganadas: celdas.filter((una) => una.gano).length,
      };
    })
    .sort(
      (a, b) =>
        (b.jugados ? b.aciertos / b.jugados : 0) -
          (a.jugados ? a.aciertos / a.jugados : 0) ||
        b.aciertos - a.aciertos ||
        a.slug.localeCompare(b.slug),
    );

  return (
    <Panel
      title="Jornadas anteriores"
      subtitle={`Cómo fue cada uno en las ${jornadas.length} jornada(s) con resultados. Pulsa el número para abrir esa semana`}
      icon={CalendarRange}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[12px]">
          <thead>
            <tr className="text-[10px] uppercase tracking-wide text-white/35">
              <th className="sticky left-0 z-10 bg-[#11161D] py-2 pr-3">Quién</th>

              {jornadas.map((jornada) => (
                <th key={jornada.jornada} className="px-1.5 py-2 text-center">
                  <button
                    type="button"
                    onClick={() => onVerJornada(jornada.jornada)}
                    title={`Abrir la jornada ${jornada.jornada}`}
                    className={`rounded-md px-1.5 py-0.5 transition hover:bg-white/[0.08] hover:text-white/80 ${
                      jornada.jornada === jornadaAbierta
                        ? "bg-[#C8A96B]/15 text-[#C8A96B]"
                        : "text-white/45"
                    }`}
                  >
                    J{jornada.jornada}
                  </button>
                </th>
              ))}

              <th className="px-2 py-2 text-right">Total</th>
              <th className="px-2 py-2 text-right">%</th>
              <th className="py-2 pl-2 text-right">Ganadas</th>
            </tr>
          </thead>

          <tbody>
            {filas.map((fila) => {
              const persona = PERSONA_POR_SLUG.get(fila.slug);

              return (
                <tr key={fila.slug} className="border-t border-white/[0.06]">
                  <td className="sticky left-0 z-10 bg-[#11161D] py-2 pr-3">
                    <span className="flex items-center gap-2">
                      <Avatar slug={fila.slug} lado={22} />

                      <span className="truncate text-white/75">
                        {persona ? nombreCorto(persona) : fila.slug}
                      </span>
                    </span>
                  </td>

                  {fila.celdas.map((celda) => (
                    <td
                      key={celda.jornada}
                      className="px-1.5 py-2 text-center tabular-nums"
                    >
                      <span className={tono(celda.aciertos, celda.jugados)}>
                        {celda.jugados > 0 ? `${celda.aciertos}/${celda.jugados}` : "—"}
                      </span>

                      {celda.gano && (
                        <Trophy
                          size={10}
                          className="ml-1 inline text-[#C8A96B]"
                          aria-label="Ganó la jornada"
                        />
                      )}
                    </td>
                  ))}

                  <td className="px-2 py-2 text-right tabular-nums text-white/70">
                    {fila.aciertos}/{fila.jugados}
                  </td>

                  <td className="px-2 py-2 text-right tabular-nums text-white/85">
                    {fila.jugados > 0
                      ? `${Math.round((fila.aciertos / fila.jugados) * 100)} %`
                      : "—"}
                  </td>

                  <td className="py-2 pl-2 text-right tabular-nums text-[#C8A96B]">
                    {fila.ganadas || "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-white/35">
        Los aciertos van sobre los partidos que ya tenían resultado esa jornada, así que una
        semana a medio jugar no cuenta como fallo. Cada uno empieza a contar desde su primera
        apuesta.
      </p>
    </Panel>
  );
}
