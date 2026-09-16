/**
 * QUIÉN JUEGA A LA QUINIELA.
 *
 * El cuerpo técnico al completo, con su foto recortada en `public/staff`. Las
 * fotos salen de los recortes que trajo el club, pasadas a webp a 560 px: las
 * dieciocho juntas pesan menos que una sola de las originales.
 *
 * **Las iniciales salen del Excel del cuerpo técnico**, que traía diez columnas
 * de pronóstico —MZ, JL, VC, MB, DL, AI, AG, JP, MC, SM— y ninguna fila
 * rellena. Nueve de esas diez casan con una persona de la lista sin ninguna
 * duda. La décima, **AI, no casa con nadie**: no hay en el staff nadie cuyo
 * nombre y apellido den esas iniciales. Está marcada aparte a propósito, sin
 * inventarle dueño; en cuanto se sepa quién es, se le pone su `slug` y aparece
 * con su foto como los demás.
 *
 * Que alguien juegue no depende de esta lista: la quiniela la puede rellenar
 * cualquiera del staff, y estos diez son sólo los que venían marcados.
 */

export type PersonaStaff = {
  /** Identificador estable: es también el nombre de su foto. */
  slug: string;
  nombre: string;
  rol: string;
  /** Sus iniciales en el Excel, si venía con columna propia. */
  iniciales?: string;
};

export const STAFF: PersonaStaff[] = [
  { slug: "julian-lopez-de-lerma", nombre: "Julián López de Lerma", rol: "Entrenador", iniciales: "JL" },
  { slug: "miguel-barrio", nombre: "Miguel Barrio", rol: "Asistente", iniciales: "MB" },
  { slug: "mikelats-zarraga", nombre: "Mikelats Zárraga", rol: "Analista", iniciales: "MZ" },
  { slug: "diego-lopez", nombre: "Diego López", rol: "Entrenador de porteros", iniciales: "DL" },
  { slug: "marcos-chena", nombre: "Marcos Chena", rol: "Preparador físico", iniciales: "MC" },
  { slug: "alberto-galisteo", nombre: "Alberto Galisteo", rol: "Preparador físico", iniciales: "AG" },
  { slug: "sergio-martos", nombre: "Sergio Martos", rol: "Readaptador", iniciales: "SM" },
  { slug: "javier-padilla", nombre: "Javier Padilla", rol: "Delegado", iniciales: "JP" },
  { slug: "jaime-fraile", nombre: "Jaime Fraile", rol: "Fisioterapeuta" },
  { slug: "ramon-salas", nombre: "Ramón Salas", rol: "Fisioterapeuta" },
  { slug: "tirso-lorente", nombre: "Tirso Lorente", rol: "Fisioterapeuta" },
  { slug: "elena-isla", nombre: "Elena Isla", rol: "Médico" },
  { slug: "ignacio-marco", nombre: "Ignacio Marco", rol: "Médico" },
  { slug: "camila-kleiman", nombre: "Camila Kleiman", rol: "Nutricionista" },
  { slug: "carolina-perea", nombre: "Carolina Perea", rol: "Nutricionista" },
  { slug: "eduardo-del-amo", nombre: "Eduardo del Amo", rol: "Utillero" },
  { slug: "hugo-jimenez", nombre: "Hugo Jiménez", rol: "Utillero" },

  /* Víctor va el último por petición suya. */
  { slug: "victor-cea", nombre: "Víctor Cea", rol: "Segundo entrenador", iniciales: "VC" },
];

/**
 * La columna del Excel que todavía no tiene dueño.
 *
 * Se guarda para que la pantalla lo pueda decir en voz alta en vez de perder
 * una de las diez columnas sin explicar por qué.
 */
export const INICIALES_SIN_DUENO = ["AI"];

/** Los que venían con columna en el Excel, en ese mismo orden. */
export const JUEGAN_POR_DEFECTO = STAFF.filter((una) => una.iniciales).map(
  (una) => una.slug,
);

export const PERSONA_POR_SLUG = new Map(STAFF.map((una) => [una.slug, una]));

/** Su foto en `public/staff`. */
export function fotoDe(slug: string) {
  return `/staff/${slug}.webp`;
}

/** "Víctor Cea" → "V. Cea", para las columnas estrechas de la tabla. */
export function nombreCorto(persona: PersonaStaff) {
  const trozos = persona.nombre.split(" ");

  if (trozos.length < 2) return persona.nombre;

  return `${trozos[0][0]}. ${trozos.slice(1).join(" ")}`;
}
