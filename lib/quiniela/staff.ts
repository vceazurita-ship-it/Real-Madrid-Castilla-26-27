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
  /**
   * Si no tiene foto en `public/staff`.
   *
   * Las dieciocho fotos vinieron de una tanda de recortes del club, y quien se
   * incorpora después no está en ella. En vez de pedir un fichero que no existe
   * —y quedarse con el hueco roto— se pinta su inicial. En cuanto llegue su
   * foto, se quita esta marca y ya está.
   */
  sinFoto?: boolean;
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

  /* La «AI» del Excel, identificada el 17/09/2026. No entró en la tanda de
     recortes del club, así que todavía no tiene foto. */
  {
    slug: "alberto-isla",
    nombre: "Alberto Isla",
    rol: "Cuerpo técnico",
    iniciales: "AI",
    sinFoto: true,
  },

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

/**
 * Su foto en `public/staff`, o `null` si todavía no tiene.
 *
 * Devolver la ruta igualmente dejaría una imagen rota: las dieciocho fotos
 * vinieron de una tanda de recortes del club y quien se incorpora después no
 * está en ella. Quien pinte decide qué poner en su lugar —la inicial— en vez
 * de pedir un fichero que no existe.
 */
export function fotoDe(slug: string): string | null {
  return PERSONA_POR_SLUG.get(slug)?.sinFoto ? null : `/staff/${slug}.webp`;
}

/** La inicial con la que se dibuja a quien no tiene foto. */
export function inicialDe(slug: string) {
  return (PERSONA_POR_SLUG.get(slug)?.nombre ?? "?").trim().charAt(0).toUpperCase();
}

/** "Víctor Cea" → "V. Cea", para las columnas estrechas de la tabla. */
export function nombreCorto(persona: PersonaStaff) {
  const trozos = persona.nombre.split(" ");

  if (trozos.length < 2) return persona.nombre;

  return `${trozos[0][0]}. ${trozos.slice(1).join(" ")}`;
}
