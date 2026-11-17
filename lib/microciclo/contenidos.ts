/**
 * LOS CONTENIDOS DE LA HOJA, CON UN SOLO NOMBRE (17/11/2026, jueces).
 *
 * La hoja de microciclos escribe el mismo contenido de varias formas
 * («Construcción», «Construcción juego», «Inicio - construcción de juego») y
 * los calendarios los pintaban como tres contenidos distintos. Esta tabla,
 * como la de posiciones (lib/posiciones.ts), los junta al leer. Sólo cambia
 * cómo se ve y cómo se agrupa: la hoja no se toca.
 *
 * Para añadir una equivalencia: una línea más en `EQUIVALENCIAS`, con la
 * expresión sobre el texto ya normalizado (minúsculas, sin tildes ni signos).
 */

const EQUIVALENCIAS: { re: RegExp; nombre: string }[] = [
  { re: /^(inicio( y| de)? )?construccion( de)?( juego)?$/, nombre: "Inicio y construcción de juego" },
  { re: /^inicio( de juego)?$/, nombre: "Inicio y construcción de juego" },
  { re: /^ultimo tercio$/, nombre: "Último tercio" },
  { re: /^finalizacion(es)?$/, nombre: "Finalización" },
];

/** «Inicio - construcción de juego» → «inicio construccion de juego». */
function normaliza(texto: string) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9ñ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** El nombre común de un contenido de la hoja; si no está en la tabla, el mismo texto. */
export function contenidoUnificado(texto: string): string {
  const limpio = (texto ?? "").trim();

  if (!limpio) return "";

  const clave = normaliza(limpio);

  return EQUIVALENCIAS.find((e) => e.re.test(clave))?.nombre ?? limpio;
}
