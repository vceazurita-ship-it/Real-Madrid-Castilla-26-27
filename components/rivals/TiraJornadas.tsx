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
import { House, Plane } from "lucide-react";
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

  /*
  | 29/10/2026: cada casilla dice también contra quién («J9 Algeciras 1-4»), sin
  | tener que pasar el ratón, y debajo va la leyenda de V/E/D: sólo con la letra
  | y el marcador no se sabía de qué partido era cada uno.
  */
  /*
  | 30/10/2026: la tira lleva su rótulo («Partidos del rival», del más antiguo
  | al último) y la letra sube a 12 px; la casilla se ensancha para que
  | «Gimnàstic de Tarragona» o «Rayo Majadahonda» no se corten tan pronto, y el
  | nombre entero sigue en el `title`.
  */
  return (
    <div className="mb-6 min-w-0">
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">
        Partidos de liga del rival · {jornadas.length}, sus jornadas del primero al último
      </p>
      {/* Degradado a la derecha (30/10/2026): en el móvil la tira sigue y no se veía. */}
      <ol
        aria-label={`Resultados de ${equipo} jornada a jornada`}
        className="flex min-w-0 gap-1.5 overflow-x-auto pb-1 scrollbar-none max-md:pr-6 max-md:[mask-image:linear-gradient(to_right,black_calc(100%-28px),transparent)]"
      >
        {jornadas.map((j) => (
          <li
            key={j.n}
            title={`J${j.n} · ${PALABRA[j.resultado]} ${j.marcador} ${j.enCasa ? "en casa" : "fuera"} contra ${j.rival}`}
            aria-label={`Jornada ${j.n}: ${PALABRA[j.resultado]} ${j.marcador} contra ${j.rival}`}
            /* Casa con borde continuo y una casita; fuera, borde discontinuo y un
               avión (30/10/2026, análisis): no sólo la palabra. */
            className="flex w-[6.5rem] shrink-0 flex-col items-center rounded-lg border px-1.5 py-1 text-[12px] font-bold leading-tight"
            style={{
              background: `${COLOR[j.resultado]}26`,
              color: chipInk(COLOR[j.resultado]),
              borderColor: `${COLOR[j.resultado]}88`,
              borderStyle: j.enCasa ? "solid" : "dashed",
            }}
          >
            <span className="inline-flex items-center gap-1 text-[11px] font-medium opacity-80">
              {j.enCasa ? <House size={11} aria-hidden /> : <Plane size={11} aria-hidden />}
              J{j.n} · {j.enCasa ? "casa" : "fuera"}
            </span>
            <span className="w-full truncate text-center text-[12px] font-semibold" title={j.rival}>{j.rival}</span>
            <span className="tabular-nums">
              {LETRA[j.resultado]} {j.marcador}
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-1 text-[11px] text-white/55">V: ganó · E: empató · D: perdió. El marcador va con sus goles primero. Borde continuo: en su casa; discontinuo: fuera.</p>
    </div>
  );
}
