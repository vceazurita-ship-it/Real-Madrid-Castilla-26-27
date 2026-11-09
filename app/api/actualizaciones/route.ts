/**
 * /api/actualizaciones (09/11/2026): la fecha del último dato de cada cosa que
 * se pone al día sola (ver `lib/actualizaciones.ts`). Sólo el administrador,
 * como el resto de Ajustes.
 *
 * - Documentos de Supabase: su `updated_at`, sin bajar el contenido.
 * - Ficheros de `public/data`: el último commit en GitHub que los toca (el
 *   repo es público; sin token hay 60 consultas por hora, así que se guardan
 *   15 minutos).
 */
import { NextRequest, NextResponse } from "next/server";

import { ACTUALIZACIONES, type FechaActualizacion } from "@/lib/actualizaciones";
import { COOKIE_ADMIN, esAdmin } from "@/lib/admin/sesion";
import { fechasDeDocs } from "@/lib/docStore";

export const dynamic = "force-dynamic";

const REPO = "vceazurita-ship-it/Real-Madrid-Castilla-26-27";
const GUARDA_MS = 15 * 60_000;

const commits = new Map<string, { fecha: string | null; en: number }>();

async function fechaDeFichero(ruta: string): Promise<string | null> {
  const guardado = commits.get(ruta);

  if (guardado && Date.now() - guardado.en < GUARDA_MS) return guardado.fecha;

  try {
    const respuesta = await fetch(`https://api.github.com/repos/${REPO}/commits?path=${encodeURIComponent(ruta)}&per_page=1`, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "rmcf-castilla-plataforma" },
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });

    if (!respuesta.ok) return guardado?.fecha ?? null;

    const lista = (await respuesta.json()) as { commit?: { committer?: { date?: string } } }[];
    const fecha = lista[0]?.commit?.committer?.date ?? null;

    commits.set(ruta, { fecha, en: Date.now() });

    return fecha;
  } catch {
    return guardado?.fecha ?? null;
  }
}

const masReciente = (fechas: (string | null | undefined)[]) =>
  fechas.filter((f): f is string => Boolean(f)).sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? null;

export async function GET(request: NextRequest) {
  if (!esAdmin(request.cookies.get(COOKIE_ADMIN)?.value)) {
    return NextResponse.json({ error: "Sólo el administrador." }, { status: 401 });
  }

  const claves = [...new Set(ACTUALIZACIONES.flatMap((a) => a.docs ?? []))];
  const prefijos = [...new Set(ACTUALIZACIONES.flatMap((a) => a.prefijos ?? []))];
  const ficheros = [...new Set(ACTUALIZACIONES.flatMap((a) => a.ficheros ?? []))];

  const [docs, deFicheros] = await Promise.all([
    fechasDeDocs(claves, prefijos).catch(() => ({}) as Record<string, string | null>),
    Promise.all(ficheros.map(async (f) => [f, await fechaDeFichero(f)] as const)).then((pares) => Object.fromEntries(pares)),
  ]);

  const fechas: FechaActualizacion[] = ACTUALIZACIONES.map((a) => ({
    clave: a.clave,
    fecha: masReciente([
      ...(a.docs ?? []).map((d) => docs[d]),
      ...(a.prefijos ?? []).map((p) => docs[`${p}*`]),
      ...(a.ficheros ?? []).map((f) => deFicheros[f]),
    ]),
  }));

  return NextResponse.json({ fechas, mirado: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
}
