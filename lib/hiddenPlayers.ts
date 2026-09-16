/**
 * Jugadores que no deben pintarse en ninguna parte de la app.
 *
 * Las hojas siguen mandándolos —aparecen en la hoja de sesión, en las
 * alineaciones guardadas y en el radar emocional—, así que el filtro vive aquí
 * y se aplica en cada punto de entrada de datos, no en cada tarjeta.
 *
 * La comparación es sobre el nombre completo normalizado, nunca por `contiene`:
 * así "Santiago" no cae por parecerse a "Thiago", y tampoco dependemos del
 * ID_JUGADOR, que en la hoja de sesión choca con el de otro jugador.
 *
 * Por eso hay que listar TODAS las grafías con las que cada hoja escribe a la
 * persona: nombre completo, apellido suelto y apodo de la columna APODO.
 */

const HIDDEN_NAMES = new Set([
  // Thiago Pitarch
  "thiago pitarch",
  "thiago",
  "tiago",

  // Manu Serrano
  "manu serrano",
  "manuel serrano",
  "serrano",

  // Jacobo Ortega
  "jacobo ortega",
  "jacobo",
  "ortega",

  // Víctor Valdepeñas
  "victor valdepenas",
  "valdepenas",
  "valde",

  // Ferran Seco
  "ferran seco",
  "seco",

  /*
  | David Jiménez, JUG-38 en la hoja. No se lista "david" a secas: es el
  | segundo nombre de más gente y se llevaría por delante a quien no toca.
  */
  "david jimenez",
  "jime",
  "jimenez",

  /*
  | Cristian David, JUG-12. Se fue a otro club el 16/09/2026.
  |
  | La hoja lo sigue dando por activo —la pestaña JUGADORES la lleva a mano el
  | cuerpo técnico y desde aquí no se escribe—, así que se oculta por nombre:
  | "Cristian David" es lo que pone la columna NOMBRE y "Cristian" lo que pone
  | APODO, que es como lo escriben el seguimiento y las sesiones.
  */
  "cristian david",
  "cristian",

  // Manuel Ángel, JUG-34.
  "manuel angel",
  "mami",
  "angel",
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
