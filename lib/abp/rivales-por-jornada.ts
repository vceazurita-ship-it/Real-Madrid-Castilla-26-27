import type { JornadaDeEquipo } from "@/lib/rivals/orden-calendario";
import { comparaJornadas, type JornadaAbp } from "./partido";

/*
|--------------------------------------------------------------------------
| LOS RIVALES DE LAS HOJAS DE ABP, POR LA JORNADA EN QUE SE LES JUGÓ
|--------------------------------------------------------------------------
|
| El filtro de rival de `/setpieces` y `/setpieces_def` era un desplegable
| con los nombres por orden alfabético. El cuerpo técnico pidió (11/10/2026)
| que los equipos salgan como en el resto de pantallas: pulsables, con su
| escudo, por orden de jornada y con la jornada puesta.
|
| Aquí la jornada no sale del calendario de la hoja RIVALES sino de las
| propias acciones: cada fila lleva su contexto (`contextoDeFila`) y con él se
| sabe en qué jornada se jugó contra cada rival. Un rival puede aparecer dos
| veces —ida y vuelta, o liga y pretemporada— y entonces lleva las dos.
*/

export type RivalPorJornada = {
  rival: string;
  /** Las jornadas en que se le jugó, en el orden en que se leen. */
  jornadas: JornadaAbp[];
  /** Acciones registradas contra él. */
  acciones: number;
  /** Lo que pinta `ChapaJornada`: «J07», o «J03 · J22» si hay dos. */
  chapa: JornadaDeEquipo | null;
};

type FilaConRival = { rival: string; contexto: { jornada: JornadaAbp } };

export function rivalesPorJornadaDe<T extends FilaConRival>(filas: T[]): RivalPorJornada[] {
  const porRival = new Map<string, { jornadas: JornadaAbp[]; acciones: number }>();

  for (const fila of filas) {
    if (!fila.rival) continue;

    const entrada = porRival.get(fila.rival) ?? { jornadas: [], acciones: 0 };

    entrada.acciones += 1;

    const jornada = fila.contexto.jornada;

    if (jornada.clave && !entrada.jornadas.some((una) => una.clave === jornada.clave)) {
      entrada.jornadas.push(jornada);
    }

    porRival.set(fila.rival, entrada);
  }

  const lista: RivalPorJornada[] = [...porRival.entries()].map(([rival, entrada]) => {
    const jornadas = [...entrada.jornadas].sort(comparaJornadas);

    return {
      rival,
      jornadas,
      acciones: entrada.acciones,
      chapa: jornadas.length
        ? {
            etiqueta: jornadas.map((una) => una.corto).join(" · "),
            titulo: jornadas.map((una) => una.etiqueta).join(" · "),
            /* Todas están jugadas, pero apagarlas todas no distingue nada. */
            jugado: false,
          }
        : null,
    };
  });

  /* Por la primera jornada en que se le jugó; los que no traen jornada, al
     final y por nombre, que es como estaban. */
  return lista.sort((a, b) => {
    const ja = a.jornadas[0];
    const jb = b.jornadas[0];

    if (ja && jb) {
      const orden = comparaJornadas(ja, jb);

      if (orden !== 0) return orden;
    } else if (ja || jb) {
      return ja ? -1 : 1;
    }

    return a.rival.localeCompare(b.rival, "es");
  });
}
