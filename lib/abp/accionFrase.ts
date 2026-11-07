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

/**
 * La zona de caída de la hoja, escrita igual en todas las listas (07/11/2026,
 * jueces): «segundo Palo» → «segundo palo», «penalti» → «punto de penalti»,
 * «6m» → «área pequeña», «2v1» → «2v1» tal cual. Lo que no reconoce, en
 * minúscula.
 */
export function zonaLegible(v?: string | null): string {
  const crudo = (v ?? "").trim();
  const t = limpia(crudo);

  if (!t) return "";
  if (/^\d+\s*v\s*\d+$/.test(t)) return t.replace(/\s+/g, "");
  if (/^z\s*\d+$/.test(t)) return `zona ${t.replace(/\D/g, "")}`;
  if (t.includes("primer")) return "primer palo";
  if (t.includes("segundo")) return "segundo palo";
  if (/\b6\s*m\b/.test(t)) return "área pequeña";
  if (t.includes("penalti") || t === "penal") return "punto de penalti";
  if (t.includes("frontal")) return "frontal";

  return crudo.toLocaleLowerCase("es-ES");
}

/**
 * El patrón de ejecución de una acción, envío y destino juntos: «corto en
 * 2v1», «tenso al primer palo», «bombeado al punto de penalti». Es lo que se
 * entrena, y con muestra corta dice más que el tipo de acción.
 */
export function patronEnvio(envio?: string | null, zona?: string | null): string {
  const e = (envio ?? "").trim();
  const sinEnvio = !e || /no aplica/i.test(e);
  const z = zonaLegible(/no aplica|^fuera$/i.test((zona ?? "").trim()) ? "" : zona);
  const como = sinEnvio ? "" : e.toLocaleLowerCase("es-ES");

  if (!z) return como;

  const destino = /^\d+v\d+$/.test(z) ? `en ${z}` : z === "frontal" ? "a la frontal" : /^(área pequeña|primer palo|segundo palo|punto de penalti)$/.test(z) ? `al ${z}` : `a ${z}`;

  return como ? `${como} ${destino}` : destino;
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
