/**
 * Jugadores que no deben pintarse en ninguna parte de la app.
 *
 * Las hojas siguen mandándolos —Thiago aparece en la hoja de sesión, en las
 * alineaciones guardadas y en el radar emocional—, así que el filtro vive aquí
 * y se aplica en cada punto de entrada de datos, no en cada tarjeta.
 *
 * La comparación es sobre el nombre completo normalizado, nunca por `contiene`:
 * así "Santiago" no cae por parecerse a "Thiago", y tampoco dependemos del
 * ID_JUGADOR, que en la hoja de sesión choca con el de otro jugador.
 */

const HIDDEN_NAMES = new Set([
  "thiago pitarch",
  "thiago",
  "tiago",
]);

function normalize(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/["'.]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * `true` si alguno de los nombres recibidos (nombre, apodo, lo que haya)
 * corresponde a un jugador oculto.
 */
export function isHiddenPlayer(...names: unknown[]) {
  return names.some((name) => HIDDEN_NAMES.has(normalize(name)));
}
