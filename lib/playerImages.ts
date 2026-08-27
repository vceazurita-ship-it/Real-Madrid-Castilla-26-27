/**
 * Fotos de la plantilla, servidas desde Supabase (`performance/players`).
 *
 * Dos recortes por persona, ambos 4:5 y con fondo transparente:
 *   - `cerca`: primer plano de cara. Para avatares y fichas pequeñas (<= 80px).
 *   - `lejos`: plano medio con equipación. Para tarjetas y cabeceras grandes.
 *
 * Las hojas de cálculo siguen mandando FOTO_URL, pero resolvemos la foto por
 * ID (o por nombre) para garantizar que la cara corresponde al jugador. Los
 * mismos archivos siguen en `/public/players` y hacen de respaldo si no hay
 * Supabase configurado.
 */

export type PlayerImageVariant = "cerca" | "lejos";

/** Carpeta pública de las fotos: Supabase si está configurado, si no local. */
const PHOTO_BASE = (() => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

  return url
    ? `${url.replace(/\/$/, "")}/storage/v1/object/public/performance/players`
    : "/players";
})();

/** Slugs con archivo en `/public/players/{cerca,lejos}`. */
export const PLAYER_IMAGE_SLUGS = [
  "aimar-garcia",
  "alberto-galisteo",
  "alexis-ciria",
  "alfredo-sotres",
  "alvaro-gines",
  "alvaro-gonzalez",
  "alvaro-leiva",
  "alvaro-lezcano",
  "angel-carvajal",
  "ariel-nkoghe",
  "camila-kleiman",
  "carlos-diez",
  "carolina-perea",
  "cesar-palacios",
  "cherif-fofana",
  "cristian-david",
  "daniel-mesonero",
  "daniel-yanez",
  "david-jimenez",
  "diego-aguado",
  "diego-lacosta",
  "diego-lopez",
  "diego-martinez",
  "eduardo-del-amo",
  "elena-isla",
  "ferran-quetglas",
  "fran-gonzalez",
  "gabriel-castrelo",
  "gabriel-valero",
  "guille-gonzalez",
  "hugo-de-llanos",
  "hugo-jimenez",
  "ignacio-marco",
  "illia-voloshyn",
  "izan-regueira",
  "jaime-barroso",
  "jaime-fraile",
  "javi-navarro",
  "javier-bailon",
  "javier-padilla",
  "jesus-fortea",
  "joan-martinez",
  "jorge-cestero",
  "julian-lopez-de-lerma",
  "lamini-fati",
  "leo-lemaitre",
  "liberto-navascues",
  "manex-rezola",
  "manuel-angel",
  "marcos-chena",
  "mario-rivas",
  "melvin-ukpeigbe",
  "miguel-barrio",
  "mikelats-zarraga",
  "pol-fortuny",
  "rachad-fettal",
  "ramon-salas",
  "roberto-martin",
  "sergio-martos",
  "sergio-mestre",
  "tirso-lorente",
  "victor-cea",
] as const;

export type PlayerImageSlug = (typeof PLAYER_IMAGE_SLUGS)[number];

const SLUG_SET = new Set<string>(PLAYER_IMAGE_SLUGS);

/** Foto por defecto cuando el jugador no tiene recorte propio. */
export const PLAYER_PHOTO_FALLBACK = `${PHOTO_BASE}/placeholder.webp`;

/**
 * ID de la hoja -> slug. Es la red de seguridad para los nombres que el
 * resolver no sabe leer solo, como "Ncoghe" (la hoja y el archivo no coinciden).
 *
 * OJO: la hoja ha renumerado los IDs al menos una vez. En agosto de 2026 los
 * porteros pasaron de JUG-24/25/26 a JUG-23/24/25 y todo el bloque JUG-14..27
 * bajó un número, así que este mapa apuntaba a la persona equivocada. Por eso
 * el nombre manda sobre el ID: si vuelves a tocarlo, cópialo de la hoja.
 */
const ID_TO_SLUG: Record<string, PlayerImageSlug> = {
  "JUG-01": "jesus-fortea",
  "JUG-02": "melvin-ukpeigbe",
  "JUG-04": "diego-aguado",
  "JUG-06": "alvaro-lezcano",
  "JUG-07": "joan-martinez",
  "JUG-08": "mario-rivas",
  "JUG-09": "lamini-fati",
  "JUG-10": "ariel-nkoghe",
  "JUG-11": "jorge-cestero",
  "JUG-12": "cristian-david",
  "JUG-13": "diego-lacosta",
  "JUG-14": "manex-rezola",
  "JUG-15": "roberto-martin",
  "JUG-16": "pol-fortuny",
  "JUG-17": "daniel-mesonero",
  "JUG-18": "daniel-yanez",
  "JUG-19": "alexis-ciria",
  "JUG-20": "alvaro-leiva",
  "JUG-22": "rachad-fettal",
  "JUG-23": "sergio-mestre",
  "JUG-24": "javi-navarro",
  "JUG-25": "ferran-quetglas",
  "JUG-26": "angel-carvajal",
  "JUG-28": "jaime-barroso",
  "JUG-31": "alvaro-gines",
  "JUG-32": "carlos-diez",
  "JUG-33": "gabriel-castrelo",
  "JUG-34": "manuel-angel",
  "JUG-35": "diego-martinez",
  "JUG-37": "javier-bailon",
  "JUG-38": "david-jimenez",
  "JUG-39": "liberto-navascues",
  "JUG-40": "aimar-garcia",
  "JUG-43": "illia-voloshyn",
  "JUG-44": "alvaro-gonzalez",
  "JUG-45": "alfredo-sotres",
  "JUG-46": "izan-regueira",
  "JUG-47": "cherif-fofana",
  "JUG-48": "gabriel-valero",
};

/**
 * Nombres que el resolver no puede deducir solo: erratas de transcripción,
 * grafías alternativas y apodos que no comparten ningún token con el nombre.
 */
const NAME_ALIASES: Record<string, PlayerImageSlug> = {
  // Grafías distintas entre hoja y archivo.
  "ariel ncoghe": "ariel-nkoghe",
  "aimar gar": "aimar-garcia",
  "manex rezonla": "manex-rezola",
  "joan mascaro": "joan-martinez",
  "leo maitre": "leo-lemaitre",
  "manuel angel moran": "manuel-angel",
  "gabri valero": "gabriel-valero",

  // Apodos de la columna APODO (algunas pantallas sólo manejan el apodo).
  lezca: "alvaro-lezcano",
  laco: "diego-lacosta",
  meso: "daniel-mesonero",
  dani: "daniel-yanez",
  mami: "manuel-angel",
  beto: "diego-martinez",
  jime: "david-jimenez",
  gabri: "gabriel-valero",
  alvaro: "alvaro-gonzalez",
};

/** Minúsculas, sin acentos ni puntuación: "Diego Martínez \"Beto\"" -> "diego martinez beto". */
export function normalizePlayerName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9ñÑ ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Descarta iniciales sueltas: "F. Quetglas" -> ["quetglas"]. */
function significantTokens(name: string): string[] {
  return normalizePlayerName(name)
    .split(" ")
    .filter((t) => t.length > 1);
}

const SLUG_TOKENS = new Map<string, string[]>(
  PLAYER_IMAGE_SLUGS.map((slug) => [slug, slug.split("-")])
);

function onlyMatch(predicate: (tokens: string[]) => boolean): PlayerImageSlug | null {
  let found: string | null = null;

  for (const [slug, tokens] of SLUG_TOKENS) {
    if (!predicate(tokens)) continue;
    if (found) return null; // ambiguo: mejor sin foto que con la de otro
    found = slug;
  }

  return (found as PlayerImageSlug) ?? null;
}

/** Slug deducido sólo del nombre, o `null` si no hay una única coincidencia. */
function slugFromName(nombre?: string | null): PlayerImageSlug | null {
  if (!nombre || nombre.trim() === "") return null;

  const normalized = normalizePlayerName(nombre);
  if (NAME_ALIASES[normalized]) return NAME_ALIASES[normalized];

  const direct = normalized.replace(/ /g, "-");
  if (SLUG_SET.has(direct)) return direct as PlayerImageSlug;

  const tokens = significantTokens(nombre);
  if (tokens.length === 0) return null;

  // "Cherif Acacio Fofana" -> cherif-fofana; "Diego Martínez \"Beto\"" -> diego-martinez.
  const bySubset = onlyMatch((slugTokens) =>
    slugTokens.every((t) => tokens.includes(t))
  );
  if (bySubset) return bySubset;

  // Apellido suelto: "Cestero" -> jorge-cestero. Solo con nombres de un token,
  // porque "Gabriel Valero" no es "Gabriel Castrelo".
  if (tokens.length === 1) {
    return onlyMatch((slugTokens) => slugTokens.includes(tokens[0]));
  }

  return null;
}

/**
 * Slug de la persona, o `null` si no tiene recorte.
 *
 * El nombre va primero y el ID sólo cubre lo que el nombre no resuelve. Es al
 * revés de como estaba: la hoja renumeró los IDs y el mapa siguió apuntando al
 * jugador anterior, así que la ficha salía con la cara de otro. El nombre, aun
 * con erratas, es lo único que se mueve con la persona.
 */
export function resolvePlayerSlug(
  nombre?: string | null,
  id?: string | null
): PlayerImageSlug | null {
  return slugFromName(nombre) ?? (id ? ID_TO_SLUG[id] ?? null : null);
}

/** Ruta pública del recorte pedido, o `null` si esa persona no tiene foto. */
export function getPlayerImage(
  nombre?: string | null,
  variant: PlayerImageVariant = "cerca",
  id?: string | null
): string | null {
  const slug = resolvePlayerSlug(nombre, id);
  return slug ? `${PHOTO_BASE}/${variant}/${slug}.webp` : null;
}

/**
 * URLs de la hoja que no son una foto: el marcador de posición de un
 * despliegue antiguo, que además ya no responde. Mostrarlas es peor que el
 * placeholder propio, porque parecen la foto real de otra persona.
 */
function isPlaceholderUrl(url: string) {
  const value = url.toLowerCase();

  return value.includes("default.png") || value.includes("placeholder");
}

/**
 * Foto lista para pintar: el recorte de la plantilla si existe, si no la URL
 * que venga de la hoja y, en último caso, el placeholder.
 */
export function getPlayerPhotoSrc(
  nombre?: string | null,
  options: {
    id?: string | null;
    variant?: PlayerImageVariant;
    fallbackUrl?: string | null;
  } = {}
): string {
  const { id, variant = "cerca", fallbackUrl } = options;

  const own = getPlayerImage(nombre, variant, id);
  if (own) return own;

  const external = fallbackUrl?.trim();

  return external && !isPlaceholderUrl(external)
    ? external
    : PLAYER_PHOTO_FALLBACK;
}
