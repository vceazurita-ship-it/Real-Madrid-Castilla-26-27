import { createClient } from "@supabase/supabase-js";

import { readSeason, writeSeason } from "@/lib/ratings/store";
import { RATINGS_SEASON, RatingsSeason } from "@/lib/ratings/types";

/*
| Leer → cambiar → escribir, sin pisar a nadie.
|
| Las tres rutas de Valoraciones (save, delete, match) releían el JSON entero
| de la temporada, le cambiaban un partido y lo escribían entero. Si dos
| personas guardaban a la vez —cada una un partido distinto—, la segunda
| escritura se hacía sobre una lectura que ya no tenía el partido de la
| primera, y ese partido se perdía sin que nadie viera un error.
|
| Ahora la escritura es condicional: sólo se hace si la fila sigue con el
| `updated_at` que tenía al leerla. Si otro ha escrito en medio, no se
| escribe nada, se vuelve a leer y se aplica el MISMO cambio sobre lo nuevo
| (cada ruta cambia un solo partido, así que reaplicarlo es seguro). Tres
| intentos; si los tres chocan, error y la pantalla lo dice.
|
| Esto vive aquí y no en lib/ratings/store.ts para no cambiar lo que usan las
| lecturas; la tabla y la copia del bucket son las mismas.
*/

const TABLE = "match_ratings";
const MISSING_TABLE = "PGRST205";
const UNIQUE_VIOLATION = "23505";
const INTENTOS = 3;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/** Un cambio que no se puede aplicar (p. ej. el partido no existe): 4xx. */
export class CambioNoValido extends Error {
  constructor(
    mensaje: string,
    public status = 400
  ) {
    super(mensaje);
  }
}

/** Tres choques seguidos con otro guardado. */
export class ConflictoDeGuardado extends Error {
  constructor() {
    super(
      "Otra persona estaba guardando valoraciones a la vez. Vuelve a intentarlo."
    );
  }
}

type Marca =
  | { tabla: false }
  | { tabla: true; existe: false }
  | { tabla: true; existe: true; updatedAt: string | null };

/*
| El `updated_at` de la fila se lee ANTES que el contenido: si alguien
| escribe entre las dos lecturas, el contenido es más nuevo que la marca, la
| escritura condicional falla y se repite. Nunca al revés.
*/
async function leeMarca(season: string): Promise<Marca> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("updated_at")
    .eq("season", season)
    .maybeSingle();

  if (error) {
    if (error.code === MISSING_TABLE) return { tabla: false };

    throw new Error(error.message);
  }

  if (!data) return { tabla: true, existe: false };

  return {
    tabla: true,
    existe: true,
    updatedAt: (data as { updated_at: string | null }).updated_at,
  };
}

/** Escribe sólo si nadie lo ha hecho desde `marca`. `null` = conflicto. */
async function escribeSiSigueIgual(
  value: RatingsSeason,
  marca: Marca
): Promise<RatingsSeason | null> {
  /* Sin tabla todavía (sólo bucket): el almacenamiento no tiene escritura
     condicional. Se comprueba justo antes de escribir, que deja una ventana
     mínima en vez de la de toda la petición. */
  if (!marca.tabla) {
    const actual = await readSeason(value.season);

    if (actual.updatedAt !== value.updatedAt) return null;

    return writeSeason(value);
  }

  const payload = { ...value, updatedAt: new Date().toISOString() };
  const fila = {
    season: payload.season,
    data: payload,
    updated_at: payload.updatedAt,
  };

  if (!marca.existe) {
    /* Primera escritura de la temporada: si otro la crea a la vez, el
       `insert` choca con la clave y se reintenta como actualización. */
    const { data, error } = await supabase
      .from(TABLE)
      .insert(fila)
      .select("season");

    if (error) {
      if (error.code === UNIQUE_VIOLATION) return null;

      throw new Error(error.message);
    }

    return data && data.length > 0 ? payload : null;
  }

  let consulta = supabase
    .from(TABLE)
    .update(fila)
    .eq("season", payload.season);

  consulta =
    marca.updatedAt === null
      ? consulta.is("updated_at", null)
      : consulta.eq("updated_at", marca.updatedAt);

  const { data, error } = await consulta.select("season");

  if (error) throw new Error(error.message);

  /* Cero filas: la fila ya no tiene ese `updated_at`, alguien escribió. */
  return data && data.length > 0 ? payload : null;
}

/**
 * Aplica `cambia` sobre la temporada recién leída y la guarda sin pisar un
 * guardado simultáneo. `cambia` puede lanzar `CambioNoValido`.
 */
export async function cambiaTemporada(
  cambia: (season: RatingsSeason) => void
): Promise<RatingsSeason> {
  for (let intento = 0; intento < INTENTOS; intento++) {
    const marca = await leeMarca(RATINGS_SEASON);
    const season = await readSeason(RATINGS_SEASON);

    cambia(season);

    const guardada = await escribeSiSigueIgual(season, marca);

    if (guardada) return guardada;
  }

  throw new ConflictoDeGuardado();
}
