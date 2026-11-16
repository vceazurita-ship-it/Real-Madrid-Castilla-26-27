/**
 * EL NOMBRE DE UN JUGADOR RIVAL, EL DE SU PLANTILLA (16/11/2026, ronda 16).
 *
 * Wyscout y Opta escriben «D. Flakus Bosilj» o «David Flakus Bosilj»; la
 * plantilla (hoja RIVALES) y el resto del área, «Flakus». Antes de pintar el
 * nombre de un rival que venga de Wyscout u Opta, se pasa por aquí con los
 * nombres de su plantilla.
 *
 * Vale si todas las palabras del nombre de la plantilla están en el de la otra
 * fuente y sólo una ficha casa; si no, se queda como venía (mejor el largo que
 * uno equivocado). Sólo para mostrar.
 */

const llano = (t: string) =>
  t
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

export function nombreDePlantilla(otro: string, nombres: string[]): string {
  const suyas = new Set(llano(otro));
  /* «D.» de Wyscout: la inicial también vale como palabra suelta. */
  const casan = [...new Set(nombres)].filter((n) => {
    const palabras = llano(n);

    return palabras.length > 0 && palabras.every((p) => suyas.has(p));
  });

  return casan.length === 1 ? casan[0] : otro;
}
