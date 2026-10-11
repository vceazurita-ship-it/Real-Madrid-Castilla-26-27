import type { JornadaDeEquipo } from "@/lib/rivals/orden-calendario";

/**
 * La jornada de un equipo, pegada a su nombre en cualquier selector.
 *
 * Los selectores de rival ya salen por calendario (ver
 * `lib/rivals/orden-calendario.ts`), pero una fila ordenada sin decir por qué
 * parece desordenada: «J8» al lado del escudo es lo que hace que el orden se
 * entienda de un vistazo y que se vea cuál es el de esta semana sin contar.
 * Lo pidió el cuerpo técnico el 11/10/2026 para todas las pantallas con
 * equipos pulsables.
 *
 * Un partido ya jugado va apagado: sigue diciendo cuándo fue, pero no compite
 * con los que quedan por venir. Sin jornada conocida no pinta nada.
 */
export function ChapaJornada({
  jornada,
  activo,
}: {
  jornada: JornadaDeEquipo | null | undefined;
  /** El chip está elegido: la chapa va en dorado, como él. */
  activo?: boolean;
}) {
  if (!jornada) return null;

  const tono = activo
    ? "bg-[#C8A96B]/25 text-[#C8A96B]"
    : jornada.jugado
      ? "bg-white/5 text-white/35"
      : "bg-white/10 text-white/70";

  return (
    <span
      title={jornada.titulo}
      className={`shrink-0 whitespace-nowrap rounded-full px-1.5 py-px text-[10px] font-semibold tabular-nums tracking-wide ${tono}`}
    >
      {jornada.etiqueta}
    </span>
  );
}

export default ChapaJornada;
