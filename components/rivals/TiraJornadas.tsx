"use client";

/**
 * Tira J1…Jn con el resultado de cada jornada de liga del rival (29/10/2026).
 *
 * Sale del informe de BeSoccer (`rivals:informe`), el mismo que alimenta la
 * franja «cómo llega» de Plantillas. Sólo se pintan las jornadas con
 * resultado: lo que no se ha jugado, o no tiene marcador, no se nombra y la
 * tira no deja huecos. La jornada es el orden del partido de liga (por fecha)
 * del propio equipo; un aplazado jugado más tarde puede correr un número.
 */

import { useMemo } from "react";
import { useRivalInforme } from "@/hooks/useRivalInforme";
import { esLiga, findInforme, jugados } from "@/lib/rivals/informe";
import { chipInk } from "@/lib/theme";

const COLOR = { G: "#34D399", E: "#C8A96B", P: "#F87171" } as const;
const LETRA = { G: "V", E: "E", P: "D" } as const;
const PALABRA = { G: "Ganó", E: "Empató", P: "Perdió" } as const;

export function TiraJornadas({ equipo }: { equipo: string }) {
  const { doc } = useRivalInforme({ alEntrar: true });

  const jornadas = useMemo(() => {
    const informe = findInforme(doc, equipo);

    if (!informe) return [];

    return jugados(informe)
      .filter(esLiga)
      .slice()
      .reverse()
      .map((partido, i) => {
        const suyo = partido.enCasa ? partido.local : partido.visitante;
        const otro = partido.enCasa ? partido.visitante : partido.local;

        if (!partido.resultado || suyo.goles === null || otro.goles === null) return null;

        return {
          n: i + 1,
          resultado: partido.resultado,
          marcador: `${suyo.goles}-${otro.goles}`,
          rival: otro.nombre,
          enCasa: partido.enCasa,
        };
      })
      .filter((j): j is NonNullable<typeof j> => j !== null);
  }, [doc, equipo]);

  if (!jornadas.length) return null;

  return (
    <ol
      aria-label={`Resultados de ${equipo} jornada a jornada`}
      className="mb-6 flex min-w-0 gap-1.5 overflow-x-auto pb-1 scrollbar-none"
    >
      {jornadas.map((j) => (
        <li
          key={j.n}
          title={`J${j.n} · ${PALABRA[j.resultado]} ${j.marcador} ${j.enCasa ? "en casa" : "fuera"} contra ${j.rival}`}
          aria-label={`Jornada ${j.n}: ${PALABRA[j.resultado]} ${j.marcador} contra ${j.rival}`}
          className="flex shrink-0 flex-col items-center rounded-lg px-2 py-1 text-[11px] font-bold leading-tight"
          style={{ background: `${COLOR[j.resultado]}26`, color: chipInk(COLOR[j.resultado]) }}
        >
          <span className="text-[9px] font-medium opacity-70">J{j.n}</span>
          <span>{LETRA[j.resultado]}</span>
          <span className="tabular-nums">{j.marcador}</span>
        </li>
      ))}
    </ol>
  );
}
