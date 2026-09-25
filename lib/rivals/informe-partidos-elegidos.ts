/**
 * QUÉ PARTIDOS VAN AL INFORME, RECORDADO POR EQUIPO.
 *
 * El pop-up que abre «INFORME» propone los cuatro últimos de liga y deja
 * cambiarlos: se pueden quitar, se puede subir a seis, y de ahí salen las hojas
 * de campogramas. Esa elección **no se guardaba**: al volver a abrir el informe
 * del mismo rival la semana siguiente, había que rehacerla de memoria.
 *
 * Es una decisión de análisis, no un dato: «a este equipo míralo sin el
 * amistoso» o «mete los seis, que ha cambiado de entrenador». Se recuerda por
 * equipo, como el once probable.
 *
 * **Se guarda en su propio documento y no con los retoques del editor** aunque
 * los dos vayan por equipo: el editor tiene el suyo abierto mientras se trabaja
 * dentro, y dos `useRemoteDoc` sobre la misma clave en dos componentes vivos a
 * la vez se pisan al guardar.
 *
 * Lo guardado son ids de partido, y **envejecen**: al abrir se cruzan con los
 * partidos que hoy tienen alineación bajada y lo que ya no esté se cae. Si no
 * queda ninguno, se vuelve a la propuesta de siempre en vez de abrir el pop-up
 * sin nada marcado.
 */

export type PartidosElegidosDoc = {
  porEquipo: Record<string, { ids: string[]; actualizado: string }>;
};

export const PARTIDOS_ELEGIDOS_KEY = "rivals:informe-partidos";

export const PARTIDOS_ELEGIDOS_VACIO: PartidosElegidosDoc = { porEquipo: {} };

/**
 * Qué marcar al abrir el pop-up.
 *
 * `orden` es la lista de partidos elegibles tal y como se va a pintar —del más
 * reciente al más antiguo—, y lo que sale respeta ese orden y no el de los
 * clics: es el orden en el que salen las hojas.
 */
export function eleccionGuardada(
  doc: PartidosElegidosDoc | null | undefined,
  equipo: string,
  orden: string[],
  porDefecto: string[],
  maximo: number,
): string[] {
  const guardados = doc?.porEquipo?.[equipo]?.ids;

  if (!guardados?.length) return porDefecto;

  const vivos = new Set(orden);

  const quedan = guardados.filter((id) => vivos.has(id));

  if (quedan.length === 0) return porDefecto;

  return orden.filter((id) => quedan.includes(id)).slice(0, maximo);
}
