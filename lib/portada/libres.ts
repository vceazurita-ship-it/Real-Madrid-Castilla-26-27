/**
 * LOS DÍAS LIBRES DE CADA SEMANA, DECIDIDOS (10/10/2026).
 *
 * La portada enseña la semana con sus libres, y los sacaba de la hoja de
 * registro —un día libre es un día sin filas—. Pero el microciclo se escribe
 * en la hoja al final, cuando ya está entero, y el día libre se decide el
 * primer día: hasta entonces la portada enseñaba la propuesta de siempre
 * aunque el cuerpo técnico ya supiera que el jueves no se entrena.
 *
 * Por eso los libres se guardan aparte, **en cuanto se marcan** en el paso 1
 * de `/laboratorio/microciclo`, en un documento pequeño de Supabase. La clave
 * de cada semana es el día del partido al que lleva («2026-10-18»): no hace
 * falta saber el número del microciclo, que todavía no existe.
 *
 * Quién manda, por este orden: lo decidido aquí, lo escrito en la hoja, y la
 * propuesta (ver `libresDeLaSemana` en `proximo-partido.ts`).
 */

export const CLAVE_LIBRES = "microciclo:libres";

export type SemanaLibres = {
  /** "2026-10-15", "2026-10-11"… */
  libres: string[];
  /** ISO de la última vez que se tocó. */
  actualizado: string;
  /** El número de microciclo con el que se marcó, si se sabía. */
  micro?: number;
};

export type DocLibres = { semanas: Record<string, SemanaLibres> };

/** Todas las semanas decididas, por día de partido. Nunca lanza. */
export async function leeLibresSemanas(signal?: AbortSignal): Promise<Record<string, SemanaLibres>> {
  try {
    const respuesta = await fetch(`/api/docs?key=${encodeURIComponent(CLAVE_LIBRES)}`, {
      cache: "no-store",
      signal,
    });

    if (!respuesta.ok) return {};

    const leido = (await respuesta.json()) as { data?: Partial<DocLibres> | null };

    const semanas = leido?.data?.semanas;

    return semanas && typeof semanas === "object" ? semanas : {};
  } catch {
    return {};
  }
}

/**
 * Guarda los libres de la semana que acaba en `partidoDia`.
 *
 * Lee, cambia una entrada y escribe el documento entero: es pequeño (una
 * entrada por semana) y así no se pisan las semanas de otros partidos.
 */
export async function guardaLibresSemana(
  partidoDia: string,
  libres: string[],
  micro?: number,
): Promise<boolean> {
  try {
    const semanas = await leeLibresSemanas();

    semanas[partidoDia] = {
      libres: [...new Set(libres)].sort(),
      actualizado: new Date().toISOString(),
      ...(micro ? { micro } : {}),
    };

    const respuesta = await fetch("/api/docs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key: CLAVE_LIBRES, kind: "generic", data: { semanas } }),
    });

    if (!respuesta.ok) return false;

    const resultado = (await respuesta.json()) as { success?: boolean };

    return resultado?.success !== false;
  } catch {
    return false;
  }
}
