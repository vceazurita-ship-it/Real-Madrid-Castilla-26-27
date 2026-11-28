/*
|--------------------------------------------------------------------------
| LA LIGA EN LA SALA DE PARTIDO (28/11/2026)
|--------------------------------------------------------------------------
|
| El analista: «que la sala se pueda usar para CUALQUIER partido de Primera
| RFEF, no sólo los del Castilla». La lista sale del archivo que ya se lee
| (`opta:directo:archivo` + el índice del día): una entrada pequeña por
| partido (id, fecha, equipos, goles). Nada se baja de más.
|
| - Grupos: el archivo trae los dos grupos de la categoría juntos. Los equipos
|   que se han enfrentado quedan en el mismo grupo (componentes conexas); el
|   del Castilla es el que contiene a «Real Madrid II».
| - Jornada: el orden de fecha de cada equipo dentro de su grupo (la misma
|   regla que el resto de la app con Opta). Un partido es la jornada mayor de
|   sus dos equipos: si uno tiene un aplazado pendiente, manda el otro. Un
|   aplazado que se juega tarde cae en la jornada de su fecha.
*/

export const CASTILLA_EN_OPTA = "Real Madrid II";

export type EntradaLiga = { partido: string; fecha?: string; equipos?: string[]; goles?: (number | null)[]; estado?: string };

export type Liga = {
  /** Equipo (nombre de Opta) → su grupo (0 = el del Castilla). */
  grupoDe: Map<string, number>;
  /** Partido → jornada (orden de fecha dentro de su grupo). */
  jornadaDe: Map<string, number>;
  /** Jornadas con algún partido, de la última a la primera. */
  jornadas: number[];
  /** Los equipos, primero los del grupo del Castilla y por orden alfabético. */
  equipos: string[];
  /** ¿Hay más de un grupo en el archivo? */
  dosGrupos: boolean;
};

export function estructuraLiga(entradas: EntradaLiga[]): Liga {
  /* Grupos: unión de los equipos que se han enfrentado. */
  const padre = new Map<string, string>();
  const raiz = (x: string): string => {
    let r = x;
    while (padre.get(r) !== r) r = padre.get(r) ?? r;
    padre.set(x, r);
    return r;
  };
  for (const e of entradas) {
    const [a, b] = e.equipos ?? [];
    for (const x of [a, b]) if (x && !padre.has(x)) padre.set(x, x);
    if (a && b) {
      const ra = raiz(a), rb = raiz(b);
      if (ra !== rb) padre.set(ra, rb);
    }
  }
  const raices = [...new Set([...padre.keys()].map(raiz))];
  const delCastilla = padre.has(CASTILLA_EN_OPTA) ? raiz(CASTILLA_EN_OPTA) : raices[0];
  const numero = new Map<string, number>();
  numero.set(delCastilla ?? "", 0);
  for (const r of raices) if (!numero.has(r)) numero.set(r, numero.size);
  const grupoDe = new Map<string, number>();
  for (const x of padre.keys()) grupoDe.set(x, numero.get(raiz(x)) ?? 0);

  /* Jornada: orden de fecha de cada equipo. */
  const orden = [...entradas].filter((e) => (e.equipos ?? []).length === 2).sort((x, y) => String(x.fecha).localeCompare(String(y.fecha)));
  const cuenta = new Map<string, number>();
  const jornadaDe = new Map<string, number>();
  for (const e of orden) {
    const [a, b] = e.equipos!;
    const ja = (cuenta.get(a) ?? 0) + 1, jb = (cuenta.get(b) ?? 0) + 1;
    cuenta.set(a, ja);
    cuenta.set(b, jb);
    jornadaDe.set(e.partido, Math.max(ja, jb));
  }
  const jornadas = [...new Set(jornadaDe.values())].sort((x, y) => y - x);
  const equipos = [...grupoDe.keys()].sort((x, y) => (grupoDe.get(x)! - grupoDe.get(y)!) || x.localeCompare(y, "es"));
  return { grupoDe, jornadaDe, jornadas, equipos, dosGrupos: raices.length > 1 };
}

/** «Real Madrid II» → «Castilla» (en las listas). */
export const nombreLista = (n: string) => (n === CASTILLA_EN_OPTA ? "Castilla" : n);
