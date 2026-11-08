/*
|--------------------------------------------------------------------------
| QUIÉN DEL RIVAL NO ESTÁ (08/11/2026)
|--------------------------------------------------------------------------
|
| Un jugador rival está de baja por dos vías, y las dos las escribe el cuerpo
| técnico en la hoja RIVALES:
|   - la columna ESTADO («LESIONADO», «SANCIONADO»…), cuando no es «ACTIVO»;
|   - las etiquetas de su ficha, que viven en IMPACTO separadas por «;»
|     («Lesionado», «Tocado»…; ver la nota de memoria del campo IMPACTO).
|
| Los jueces (ronda 14) vieron a Yago Cantero con la etiqueta «Lesionado» en su
| ficha, fuera de «Bajas y apercibidos» y dentro del once de la pizarra. Esta
| función es la única que decide quién no está: la leen /rivals, /duelos y la
| pizarra (onces de la semana).
*/

type Fila = Record<string, unknown>;

export type BajaRival = "lesionado" | "sancionado" | "tocado";

const texto = (v: unknown) => String(v ?? "").trim();

const sinTildes = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** «lesionado», «sancionado» o «tocado» (duda); `null` si está disponible. */
export function bajaDe(fila: Fila): BajaRival | null {
  const estado = sinTildes(texto(fila.ESTADO));
  const etiquetas = texto(fila.IMPACTO)
    .split(/[;,|/\n]+/)
    .map((t) => sinTildes(t.trim()))
    .filter(Boolean);

  /* Por palabra y sin negación: «Recuperado de lesión», «Sin lesiones» o
     «Sancionable» no son bajas (08/11/2026). */
  const descarta = /recuperad|sin lesion|sancionable|vuelve|alta medica/;
  const dice = (re: RegExp) => [estado, ...etiquetas].some((t) => re.test(t) && !descarta.test(t));

  if (dice(/\bsancionad|\bsancion\b/)) return "sancionado";
  if (dice(/\blesionad|\blesion\b|\bde baja\b/)) return "lesionado";
  if (dice(/tocad|molestia/)) return "tocado";

  return null;
}

/** Fuera seguro (no la duda): lesionado o sancionado. */
export const estaFuera = (fila: Fila) => {
  const baja = bajaDe(fila);

  return baja === "lesionado" || baja === "sancionado";
};
