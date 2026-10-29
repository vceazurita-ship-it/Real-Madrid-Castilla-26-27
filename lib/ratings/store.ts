import { createClient } from "@supabase/supabase-js";

import { RATINGS_SEASON, RatingsSeason, emptySeason } from "./types";

/**
 * El histórico vive en Supabase. Preferimos la tabla `match_ratings`, pero
 * mientras no exista escribimos el mismo JSON en el bucket privado `ratings`,
 * de modo que el módulo funciona desde el primer día y, en cuanto se cree la
 * tabla, la primera lectura migra el contenido sin perder nada.
 */

const TABLE = "match_ratings";
const BUCKET = "ratings";

/** PostgREST devuelve este código cuando la tabla no existe. */
const MISSING_TABLE = "PGRST205";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function objectPath(season: string) {
  return `${season}.json`;
}

/*
| Notas guardadas con la numeración vieja (29/10/2026). Las de agosto y
| principios de septiembre llevan a Óscar Nassei como JUG-52 y a Sergio
| Martínez como JUG-53; la hoja los renumeró a 49 y 50 y dio el 52 a Hugo de
| Llanos (alta del 24/10), que heredaba las notas de Óscar sin haber jugado.
| Un registro con esos números anterior al alta de Hugo es del jugador viejo.
*/
const ALTA_HUGO = "2026-10-24";
const NUMERACION_VIEJA: Record<string, string> = { "JUG-52": "JUG-49", "JUG-53": "JUG-50" };

function conIdsVigentes(matches: RatingsSeason["matches"]): RatingsSeason["matches"] {
  return Object.fromEntries(
    Object.entries(matches).map(([id, record]) => {
      if (!record?.players || !(String(record.match?.date ?? "") < ALTA_HUGO)) return [id, record];

      const players = { ...record.players };

      for (const [viejo, nuevo] of Object.entries(NUMERACION_VIEJA)) {
        if (!players[viejo] || players[nuevo]) continue;
        players[nuevo] = { ...players[viejo], playerId: nuevo };
        delete players[viejo];
      }

      return [id, { ...record, players }];
    })
  );
}

function normalize(payload: unknown, season: string): RatingsSeason {
  const value = payload as Partial<RatingsSeason> | null;

  if (!value || typeof value !== "object" || !value.matches) {
    return emptySeason(season);
  }

  return {
    season,
    matches: conIdsVigentes(value.matches),
    updatedAt: value.updatedAt ?? "",
    ocultos: Array.isArray(value.ocultos) ? value.ocultos.map(String) : [],
  };
}

async function readBucket(season: string): Promise<RatingsSeason | null> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .download(objectPath(season));

  if (error || !data) return null;

  try {
    return normalize(JSON.parse(await data.text()), season);
  } catch {
    return null;
  }
}

async function writeBucket(value: RatingsSeason) {
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(objectPath(value.season), JSON.stringify(value), {
      contentType: "application/json",
      upsert: true,
    });

  if (error) throw new Error(error.message);
}

export async function readSeason(
  season = RATINGS_SEASON
): Promise<RatingsSeason> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("data")
    .eq("season", season)
    .maybeSingle();

  if (error) {
    if (error.code !== MISSING_TABLE) throw new Error(error.message);

    return (await readBucket(season)) ?? emptySeason(season);
  }

  if (data?.data) return normalize(data.data, season);

  /* La tabla ya existe pero está vacía: migramos lo que hubiera en el bucket. */
  const legacy = await readBucket(season);

  if (legacy && Object.keys(legacy.matches).length > 0) {
    await writeSeason(legacy);
    return legacy;
  }

  return emptySeason(season);
}

export async function writeSeason(value: RatingsSeason) {
  const payload = { ...value, updatedAt: new Date().toISOString() };

  const { error } = await supabase
    .from(TABLE)
    .upsert(
      {
        season: payload.season,
        data: payload,
        updated_at: payload.updatedAt,
      },
      { onConflict: "season" }
    );

  if (error) {
    if (error.code !== MISSING_TABLE) throw new Error(error.message);

    await writeBucket(payload);
  }

  return payload;
}
