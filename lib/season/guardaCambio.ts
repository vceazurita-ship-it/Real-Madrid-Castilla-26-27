import type { SupabaseClient } from "@supabase/supabase-js";
import { aplicaCambio, CambioSemana, esCambioSemana } from "./fusion";
import { WeekData } from "./types";

/*
| Escritura de un cambio de semana con «comparar y cambiar» (19/10/2026).
|
| Leer, aplicar el cambio y escribir deja un hueco: si otro guardado entra
| entre la lectura y la escritura, se lo lleva por delante. Por eso la
| escritura sólo se acepta si `updated_at` sigue siendo el que se leyó; si no,
| alguien ha escrito entre medias y se vuelve a leer y a aplicar el cambio
| encima de lo suyo. Nunca se escribe sobre algo que no se ha leído.
|
| El almacén va aparte de Supabase para poder simular carreras en un script
| sin tocar los datos de verdad.
*/

export interface FilaTemporada {
  data: unknown;
  updated_at: string | null;
}

export interface AlmacenTemporada {
  lee(): Promise<FilaTemporada | null>;
  /** Escribe sólo si `updated_at` sigue valiendo `previo`. Devuelve si escribió. */
  escribeSi(data: unknown, previo: string | null): Promise<boolean>;
}

export type ResultadoCambio =
  | { ok: true; semana: WeekData }
  | { ok: false; status: number; error: string };

const INTENTOS = 6;

export async function guardaCambioSemana(
  almacen: AlmacenTemporada,
  cambio: CambioSemana
): Promise<ResultadoCambio> {
  for (let intento = 0; intento < INTENTOS; intento++) {
    const fila = await almacen.lee();

    if (!fila) {
      return {
        ok: false,
        status: 404,
        error: "La temporada todavía no está creada.",
      };
    }

    const aplicado = aplicaCambio(fila.data, cambio);

    if (!aplicado) {
      return {
        ok: false,
        status: 404,
        error: "Esa semana no existe en la temporada guardada.",
      };
    }

    if (await almacen.escribeSi(aplicado.raw, fila.updated_at)) {
      return { ok: true, semana: aplicado.semana };
    }
  }

  return {
    ok: false,
    status: 409,
    error: "Hay muchos cambios a la vez en la temporada. Inténtalo de nuevo.",
  };
}

/**
 * Lo que hacen las dos rutas de guardado con un cuerpo `{ cambio }`. Devuelve
 * `null` si el cuerpo no trae `cambio` (formato antiguo de temporada entera).
 */
export async function respondeCambio(
  body: unknown,
  supabase: SupabaseClient,
  tabla: string,
  temporada: string
): Promise<{ status: number; json: Record<string, unknown> } | null> {
  const cambio = (body as { cambio?: unknown } | null)?.cambio;
  if (cambio === undefined) return null;

  if (!esCambioSemana(cambio)) {
    return {
      status: 400,
      json: { success: false, error: "Cambio de semana mal formado." },
    };
  }

  const resultado = await guardaCambioSemana(
    almacenSupabase(supabase, tabla, temporada),
    cambio
  );

  return resultado.ok
    ? { status: 200, json: { success: true, week: resultado.semana } }
    : {
        status: resultado.status,
        json: { success: false, error: resultado.error },
      };
}

/** El almacén de verdad: una fila por temporada en `tabla`. */
export function almacenSupabase(
  supabase: SupabaseClient,
  tabla: string,
  temporada: string
): AlmacenTemporada {
  return {
    async lee() {
      const { data, error } = await supabase
        .from(tabla)
        .select("data, updated_at")
        .eq("season", temporada)
        .maybeSingle();

      if (error) throw new Error(error.message);

      return (data as FilaTemporada | null) ?? null;
    },

    async escribeSi(data, previo) {
      // La marca nueva tiene que ser distinta de la leída: dos escrituras en
      // el mismo milisegundo dejarían pasar la comprobación de un tercero.
      const ahora = Date.now();
      const anterior = previo === null ? NaN : Date.parse(previo);
      const marca = new Date(
        Number.isFinite(anterior) && anterior >= ahora ? anterior + 1 : ahora
      ).toISOString();

      const base = supabase
        .from(tabla)
        .update({ data, updated_at: marca })
        .eq("season", temporada);

      const filtrada =
        previo === null ? base.is("updated_at", null) : base.eq("updated_at", previo);

      const { data: escrito, error } = await filtrada.select("season");

      if (error) throw new Error(error.message);

      return Array.isArray(escrito) && escrito.length > 0;
    },
  };
}
