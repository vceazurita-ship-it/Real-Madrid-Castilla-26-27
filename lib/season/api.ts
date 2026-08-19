import { AREA_CONFIG } from "./config";
import { MonthData, SeasonArea, WeekData } from "./types";

/**
 * Las dos áreas guardan la temporada con formas ligeramente distintas:
 * `general` almacena el array directamente y `performance` lo anida en `{ data }`.
 * Desenvolvemos ambas para no depender del área.
 */
function unwrapSeason(payload: unknown): MonthData[] {
  const season = (payload as { season?: unknown })?.season;

  if (Array.isArray(season)) {
    return season as MonthData[];
  }

  const nested = (season as { data?: unknown })?.data;

  if (Array.isArray(nested)) {
    return nested as MonthData[];
  }

  return [];
}

/**
 * Normaliza cada semana: las temporadas antiguas guardaban un único documento
 * en `pdf`, que la interfaz nunca llegaba a mostrar porque sólo lee `pdfs`.
 */
function normalizeSeason(season: MonthData[]): MonthData[] {
  return season.map((month) => ({
    ...month,
    weeks: month.weeks.map((week) => {
      const pdfs = week.pdfs ?? [];

      const merged =
        week.pdf && !pdfs.includes(week.pdf) ? [week.pdf, ...pdfs] : pdfs;

      const normalized: WeekData = {
        ...week,
        images: week.images ?? [],
        pdfs: merged,
      };

      delete normalized.pdf;

      return normalized;
    }),
  }));
}

export async function loadSeasonData(
  area: SeasonArea
): Promise<MonthData[]> {
  const response = await fetch(AREA_CONFIG[area].api.load, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("No se pudo cargar la temporada");
  }

  return normalizeSeason(unwrapSeason(await response.json()));
}

export async function saveSeasonData(
  area: SeasonArea,
  data: MonthData[]
): Promise<void> {
  const response = await fetch(AREA_CONFIG[area].api.save, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      season: "2026-2027",
      data,
    }),
  });

  if (!response.ok) {
    throw new Error("No se pudo guardar la temporada");
  }
}

/** Nombre único para evitar colisiones en storage (`upsert: false`). */
function uniqueFileName(name: string) {
  const clean = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "");

  const dot = clean.lastIndexOf(".");

  const base = dot > 0 ? clean.slice(0, dot) : clean;
  const extension = dot > 0 ? clean.slice(dot) : "";

  const stamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 6);

  return `${base || "archivo"}-${stamp}${random}${extension}`;
}

export async function uploadSeasonFile(
  area: SeasonArea,
  file: File,
  folder: string
): Promise<string> {
  const formData = new FormData();

  // Renombramos en cliente: el endpoint conserva el nombre recibido y rechaza
  // duplicados, así que dos archivos homónimos fallarían al subirse.
  formData.append(
    "file",
    new File([file], uniqueFileName(file.name), { type: file.type })
  );

  formData.append("folder", folder);

  const response = await fetch(AREA_CONFIG[area].api.upload, {
    method: "POST",
    body: formData,
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      (payload as { error?: string })?.error ?? "Error subiendo el archivo"
    );
  }

  return (payload as { url: string }).url;
}

/**
 * Borra el archivo del bucket. El bucket se deduce de la propia URL en lugar de
 * recibirlo por parámetro: ambas áreas comparten bucket y pasar un nombre que no
 * coincidía hacía que el borrado se ignorase en silencio.
 */
export async function deleteSeasonFile(
  area: SeasonArea,
  url: string
): Promise<void> {
  const match = url.match(/\/storage\/v1\/object\/public\/[^/]+\/(.+)$/);

  // Archivo local (no está en storage): sólo hay que quitar la referencia.
  if (!match) return;

  const path = decodeURIComponent(match[1].split("?")[0]);

  const response = await fetch(AREA_CONFIG[area].api.delete, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ path }),
  });

  if (!response.ok) {
    throw new Error("No se pudo eliminar el archivo del almacenamiento");
  }
}
