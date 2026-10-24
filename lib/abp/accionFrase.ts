/**
 * Las etiquetas de la hoja de ABP dichas como las diría un entrenador.
 *
 * La lista de acciones de «Situación Global» enseñaba el dato crudo
 * («Bloqueada Barrera», «No Remate», «3v2», «Nada», «ABP»). Aquí se traduce,
 * y siempre con las mismas cuatro piezas (cae, remate, resultado, xG) para que
 * ninguna fila quede sin una de ellas.
 */

const limpia = (v: string | undefined | null) =>
  (v ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

/** Dónde cae el envío, o cómo se juega si es en corto. */
export function fraseCaida(v?: string | null): string {
  const t = limpia(v);

  if (!t || t === "no aplica") return "sin envío al área";

  const superioridad = t.match(/^(\d+)\s*v\s*(\d+)$/);

  if (superioridad) return `juego en corto (${superioridad[1]} contra ${superioridad[2]})`;

  if (t.includes("bloque") && t.includes("barrera")) return "se queda en la barrera";
  if (t.includes("barrera")) return "directa a la barrera";
  if (t.includes("arriba")) return "cae arriba de la portería";
  if (t.includes("abajo")) return "cae abajo de la portería";
  if (t.includes("primer")) return "cae en el primer palo";
  if (t.includes("segundo")) return "cae en el segundo palo";
  if (t.includes("6m")) return "cae en el área pequeña";
  if (t.includes("penalti")) return "cae en el punto de penalti";
  if (t.includes("frontal") || t.includes("fuera")) return "cae en la frontal";

  return `cae en ${(v ?? "").trim()}`;
}

/** Desde dónde se remata, o que no hubo remate. */
export function fraseRemate(v?: string | null): string {
  const t = limpia(v);

  if (!t || t.includes("no remate") || t.includes("no aplica")) return "sin remate";
  if (t === "1p" || t.includes("primer")) return "remate desde el primer palo";
  if (t === "2p" || t.includes("segundo")) return "remate desde el segundo palo";
  if (t.includes("6m")) return "remate desde el área pequeña";
  if (t.includes("central")) return "remate desde el centro del área";
  if (t.includes("penal")) return "remate desde el punto de penalti";
  if (t.includes("fuera")) return "remate desde fuera del área";

  return `remate desde ${(v ?? "").trim().toLowerCase()}`;
}

/** Cómo acabó la jugada. */
export function fraseResultado(v?: string | null): string {
  const t = limpia(v);

  if (!t || t === "nada") return "sin peligro";
  if (t.includes("gol")) return "gol";
  if (t.includes("ocasion")) return "ocasión";
  if (t.includes("transici")) return "acaba en transición del rival";
  if (t === "abp") return "acaba en otro balón parado";

  return (v ?? "").trim().toLowerCase();
}
