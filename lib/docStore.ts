import { createClient } from "@supabase/supabase-js";

/**
 * Almacén genérico de documentos JSON (tabla `app_documents`).
 *
 * Lo usan las pizarras y el calendario de operativa general: cada pantalla
 * guarda su estado completo bajo una clave estable, sin necesidad de una
 * tabla por funcionalidad.
 */

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const TABLE = "app_documents";

/**
 * La tabla `app_documents` todavía no existe.
 *
 * Postgres lo reporta como `42P01`; PostgREST, que resuelve contra su caché de
 * esquema, devuelve `PGRST205` y un mensaje de "schema cache".
 */
function isMissingTable(error: { code?: string; message?: string }) {
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    /schema cache|does not exist|Could not find the table/i.test(
      error.message ?? ""
    )
  );
}

export interface DocResult<T = unknown> {
  data: T | null;
  updatedAt: string | null;
  /** La tabla `app_documents` aún no está creada en Supabase. */
  missingTable?: boolean;
}

export async function readDoc<T = unknown>(
  key: string
): Promise<DocResult<T>> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("data, updated_at")
    .eq("key", key)
    .maybeSingle();

  if (error) {
    if (isMissingTable(error)) {
      return { data: null, updatedAt: null, missingTable: true };
    }

    throw new Error(error.message);
  }

  return {
    data: (data?.data as T) ?? null,
    updatedAt: data?.updated_at ?? null,
  };
}

export async function writeDoc(
  key: string,
  kind: string,
  data: unknown
): Promise<DocResult> {
  const updatedAt = new Date().toISOString();

  const { error } = await supabase
    .from(TABLE)
    .upsert(
      { key, kind, data, updated_at: updatedAt },
      { onConflict: "key" }
    );

  if (error) {
    if (isMissingTable(error)) {
      return { data: null, updatedAt: null, missingTable: true };
    }

    throw new Error(error.message);
  }

  return { data, updatedAt };
}
