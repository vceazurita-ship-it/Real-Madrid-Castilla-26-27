import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { SEASON_FIRST_DAY, SEASON_LAST_DAY, dateKey } from "@/lib/calendar";
import { MonthData } from "@/lib/season/types";
import { parseWeekDate, weekRangeLabel } from "@/lib/season/utils";

/**
 * Toda la documentación del Área General para el calendario de operativa.
 *
 * La fuente de verdad es el documento de temporada (`general_seasons`): es el
 * único sitio que sabe qué archivos son del área y a qué semana pertenecen.
 * Los ficheros antiguos viven en `2026/semana-XX`, una carpeta compartida con
 * Performance, así que listar storage por sí solo no distingue las áreas.
 *
 * Cada documento se cuelga del día en que se subió al bucket. Además se añaden
 * los archivos sueltos de `2026/general` que aún no estén referenciados en el
 * documento, para que nada suba al bucket y desaparezca.
 */

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BUCKET = "performance";
const GENERAL_FOLDER = "2026/general";
const CURRENT_SEASON = "2026-2027";

type FileItem = {
  url: string;
  name: string;
  created_at: string;
  type: "image" | "pdf";
  /** Día del calendario: el de la subida ("YYYY-MM-DD"). */
  date: string;
  /** Semana del Área General a la que pertenece ("" si es un archivo suelto). */
  week: string;
  weekRange: string;
  month: string;
};

function fileNameFromUrl(url: string) {
  const raw = url.split("?")[0].split("/").pop() ?? "archivo";

  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/** Ruta dentro del bucket, para cruzar las URLs del documento con el listado. */
function storagePathFromUrl(url: string) {
  const match = url.match(/\/storage\/v1\/object\/public\/[^/]+\/(.+)$/);

  if (!match) return null;

  try {
    return decodeURIComponent(match[1].split("?")[0]);
  } catch {
    return match[1].split("?")[0];
  }
}

function isPdf(name: string) {
  return name.toLowerCase().endsWith(".pdf");
}

/**
 * Recorta a la temporada. Las semanas 1 y 2 arrancan antes del inicio oficial
 * y sus días no son clicables en el calendario, así que sin recorte sus
 * documentos quedarían inaccesibles.
 */
function seasonDateKey(date: Date) {
  if (date < SEASON_FIRST_DAY) return dateKey(SEASON_FIRST_DAY);
  if (date > SEASON_LAST_DAY) return dateKey(SEASON_LAST_DAY);

  return dateKey(date);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);

  return next;
}

async function loadSeason(): Promise<MonthData[]> {
  const { data, error } = await supabase
    .from("general_seasons")
    .select("data")
    .eq("season", CURRENT_SEASON)
    .single();

  if (error || !data) return [];

  const raw = data.data as unknown;

  if (Array.isArray(raw)) return raw as MonthData[];

  const nested = (raw as { data?: unknown })?.data;

  return Array.isArray(nested) ? (nested as MonthData[]) : [];
}

/**
 * Documentos registrados en el Área General.
 *
 * Cada uno se cuelga del día en que se subió (`uploads`). Si el archivo ya no
 * está en storage y no tenemos esa fecha, caemos a la semana a la que
 * pertenece para no perderlo: media temporada aún no tiene fechas asignadas,
 * así que avanzamos siete días desde la última semana fechada.
 */
function filesFromSeason(
  season: MonthData[],
  uploads: Map<string, string>
) {
  const files: FileItem[] = [];

  let cursor: Date | null = null;

  for (const month of season) {
    for (const week of month.weeks ?? []) {
      const parsed = parseWeekDate(week.start) ?? parseWeekDate(week.end);

      if (parsed) cursor = parsed;
      else if (cursor) cursor = addDays(cursor, 7);

      const weekDate = seasonDateKey(cursor ?? SEASON_FIRST_DAY);

      const context = {
        week: week.week,
        weekRange: weekRangeLabel(week),
        month: week.month || month.name,
      };

      const images = week.images ?? [];

      // `pdf` es el campo antiguo de un único documento por semana.
      const pdfs = [
        ...(week.pdf ? [week.pdf] : []),
        ...(week.pdfs ?? []),
      ];

      const push = (url: string, type: "image" | "pdf") => {
        if (!url) return;

        const path = storagePathFromUrl(url);
        const uploadedAt = path ? uploads.get(path) : undefined;

        files.push({
          ...context,
          url,
          name: fileNameFromUrl(url),
          created_at: uploadedAt ?? weekDate,
          date: uploadedAt ? seasonDateKey(new Date(uploadedAt)) : weekDate,
          type,
        });
      };

      for (const url of images) push(url, "image");
      for (const url of pdfs) push(url, "pdf");
    }
  }

  return files;
}

/**
 * Fecha de subida de cada archivo del documento. Storage sólo informa por
 * carpeta, así que listamos las que realmente usa el Área General en vez de
 * recorrer todo el bucket (que comparte con Performance).
 */
async function uploadDates(season: MonthData[]) {
  const folders = new Set<string>();

  for (const month of season) {
    for (const week of month.weeks ?? []) {
      const urls = [
        ...(week.images ?? []),
        ...(week.pdfs ?? []),
        ...(week.pdf ? [week.pdf] : []),
      ];

      for (const url of urls) {
        const path = storagePathFromUrl(url);
        const slash = path?.lastIndexOf("/") ?? -1;

        if (path && slash > 0) folders.add(path.slice(0, slash));
      }
    }
  }

  const listings = await Promise.all(
    [...folders].map(async (folder) => {
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .list(folder, { limit: 1000 });

      if (error || !data) return [];

      return data
        .filter((item) => item.id && item.created_at)
        .map(
          (item) => [`${folder}/${item.name}`, item.created_at!] as const
        );
    })
  );

  return new Map(listings.flat());
}

/** Listado recursivo de una carpeta del bucket. */
async function listFolder(
  path: string
): Promise<{ url: string; name: string; created_at: string; path: string }[]> {
  const { data, error } = await supabase.storage.from(BUCKET).list(path, {
    limit: 1000,
    sortBy: { column: "created_at", order: "asc" },
  });

  if (error || !data) return [];

  const files: { url: string; name: string; created_at: string; path: string }[] =
    [];

  for (const item of data) {
    const fullPath = `${path}/${item.name}`;

    if (!item.id) {
      files.push(...(await listFolder(fullPath)));
      continue;
    }

    const { data: publicUrl } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(fullPath);

    files.push({
      url: publicUrl.publicUrl,
      name: item.name,
      created_at: item.created_at ?? new Date().toISOString(),
      path: fullPath,
    });
  }

  return files;
}

export async function GET() {
  try {
    const season = await loadSeason();

    const [uploads, stored] = await Promise.all([
      uploadDates(season),
      listFolder(GENERAL_FOLDER),
    ]);

    const files = filesFromSeason(season, uploads);

    const known = new Set(
      files
        .map((file) => storagePathFromUrl(file.url))
        .filter((path): path is string => path !== null)
    );

    // Archivos que están en el bucket pero no en el documento: se fechan por
    // su fecha de subida para que sigan siendo visibles.
    for (const item of stored) {
      if (known.has(item.path)) continue;

      files.push({
        url: item.url,
        name: item.name,
        created_at: item.created_at,
        type: isPdf(item.name) ? "pdf" : "image",
        date: seasonDateKey(new Date(item.created_at)),
        week: "",
        weekRange: "",
        month: "",
      });
    }

    return NextResponse.json(files);
  } catch (e) {
    console.error(e);
    return NextResponse.json([], { status: 500 });
  }
}
