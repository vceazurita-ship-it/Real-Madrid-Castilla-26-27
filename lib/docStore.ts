import { createClient } from "@supabase/supabase-js";

import { mismoDocumento } from "@/lib/igualdad";

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

export type ConflictoDoc = {
  /** Lo que hay ahora mismo en el servidor, para poder enseñarlo o releerlo. */
  actual: unknown;
  updatedAt: string | null;
};

/**
 * Guarda un documento.
 *
 * **Con `basadaEn` se comprueba que nadie haya escrito en medio.** Es el
 * `updatedAt` que tenía quien edita cuando empezó: si el del servidor es otro,
 * hay alguien más —otra pestaña, otro portátil, el ordenador del club— que ha
 * guardado desde entonces, y escribir encima sería borrar su trabajo sin que
 * nadie se entere. Eso no se resuelve solo: se devuelve el conflicto para que
 * la pantalla lo cuente y decida quien está delante.
 *
 * Sin `basadaEn` se escribe como siempre: lo usan los documentos que no edita
 * nadie a mano (cachés, latidos, lo que escribe un script).
 */
export async function writeDoc(
  key: string,
  kind: string,
  data: unknown,
  basadaEn?: string | null
): Promise<DocResult & { conflicto?: ConflictoDoc }> {
  const updatedAt = new Date().toISOString();

  if (basadaEn !== undefined) {
    const previo = await readDoc(key);

    if (previo.missingTable) {
      return { data: null, updatedAt: null, missingTable: true };
    }

    /* `null` es «no había documento»: sólo cuadra si sigue sin haberlo. */
    const enServidor = previo.updatedAt ?? null;

    const esperado = basadaEn ?? null;

    /*
    | Se comparan como INSTANTES, no como texto.
    |
    | Supabase devuelve «…+00:00» y aquí se escribe «…Z»: el mismo momento en
    | dos formatos. Comparando cadenas, el segundo guardado seguido de la misma
    | pantalla habría dado un conflicto falso —«alguien ha guardado esto»— con
    | nadie más delante.
    */
    const mismoMomento =
      enServidor === esperado ||
      (enServidor != null &&
        esperado != null &&
        Date.parse(enServidor) === Date.parse(esperado));

    /*
    | Si lo que llega es EXACTAMENTE lo que ya hay, no hay nada que proteger:
    | es la misma pantalla que ya lo escribió (el envío de despedida al
    | esconder la pestaña sale sin versión y gana la carrera al guardado
    | normal, 06/10/2026). Antes eso era un conflicto falso —«alguien ha
    | guardado esto»— y el documento se quedaba en error sin que nadie más
    | hubiera tocado nada. Se contesta como guardado, sin escribir.
    */
    if (!mismoMomento && mismoDocumento(previo.data, data)) {
      return { data, updatedAt: enServidor };
    }

    if (!mismoMomento) {
      return {
        data: null,
        updatedAt: enServidor,
        conflicto: { actual: previo.data, updatedAt: enServidor },
      };
    }
  }

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

/**
 * Leer, cambiar y escribir SIN perder lo que otro escriba en medio.
 *
 * La escritura sólo entra si `updated_at` sigue siendo el que se leyó (un
 * UPDATE con esa condición, atómico en Postgres); si no, se relee y se vuelve
 * a aplicar el cambio. Lo usan los encargos de Ajustes: el vigía del club
 * escribe en el mismo documento, y un pedido que entrara entre su lectura y su
 * escritura se perdía (09/10/2026).
 */
export async function cambiaDoc<T>(
  key: string,
  kind: string,
  cambia: (actual: unknown) => T,
  intentos = 6
): Promise<T> {
  for (let i = 0; i < intentos; i++) {
    const previo = await readDoc(key);

    const data = cambia(previo.data);

    const updatedAt = new Date().toISOString();

    if (!previo.updatedAt) {
      /* No había documento: se crea; si otro lo crea a la vez, el insert falla y se repite. */
      const { error } = await supabase.from(TABLE).insert({ key, kind, data, updated_at: updatedAt });

      if (!error) return data;

      if (error.code !== "23505") throw new Error(error.message);

      continue;
    }

    const { data: filas, error } = await supabase
      .from(TABLE)
      .update({ data, updated_at: updatedAt })
      .eq("key", key)
      .eq("updated_at", previo.updatedAt)
      .select("key");

    if (error) throw new Error(error.message);

    if (filas?.length) return data;

    await new Promise((r) => setTimeout(r, 150 + Math.random() * 350));
  }

  throw new Error(`el documento ${key} cambia sin parar: no se ha podido escribir`);
}

/**
 * Los documentos cuya clave empieza por un prefijo.
 *
 * Lo pide el coding: los clips de un jugador están repartidos por todas las
 * sesiones —una por partido y por rival— y la ficha del jugador tiene que
 * poder reunirlos sin saber de antemano qué partidos existen. Es la única
 * lectura del almacén que no va por clave exacta, y por eso lleva tope: una
 * temporada son decenas de documentos, no miles.
 */
export async function listDocs<T = unknown>(
  prefix: string,
  limite = 200,
): Promise<{ key: string; data: T; updatedAt: string | null }[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("key, data, updated_at")
    .like("key", `${prefix}%`)
    .order("updated_at", { ascending: false })
    .limit(limite);

  if (error) {
    if (isMissingTable(error)) return [];

    throw new Error(error.message);
  }

  return (data ?? []).map((fila) => ({
    key: String(fila.key),
    data: fila.data as T,
    updatedAt: fila.updated_at ?? null,
  }));
}
