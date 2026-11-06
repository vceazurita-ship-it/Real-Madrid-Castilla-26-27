import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { dameAcceso, dameEstadisticas, dameListas, dameVideosDeLista, leeAjustes } from "@/lib/coding/youtube";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/*
| LAS VISTAS DE LOS CLIPS EN EL CANAL DE YOUTUBE (06/11/2026)
|
| Los jugadores ven los clips en YouTube, no en la app. Esto recorre todas las
| listas del canal (una por rival), pide las vistas de cada vídeo y guarda una
| foto al día en `visionados:youtube`, para saber cuánto ha subido cada clip
| desde la anterior (lo que se vio tras el último partido). YouTube no dice
| QUIÉN ve un vídeo, ni al dueño del canal: sólo cuántas veces.
|
| La foto del día se hace sola la primera vez que se pide cada día; la pasada
| nocturna la pide a las 00:00, así que tras cada partido queda al día.
*/

const CLAVE = "visionados:youtube";
const DIAS_HISTORIA = 120;
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export type ClipYoutube = { id: string; titulo: string; lista: string; publicado: string; vistas: number; meGusta: number };
type Doc = { actualizado: string; clips: ClipYoutube[]; historia: Record<string, Record<string, number>> };

let cache: { cuando: number; doc: Doc } | null = null;

export async function GET() {
  if (cache && Date.now() - cache.cuando < 30 * 60_000) return NextResponse.json({ ok: true, ...cache.doc });

  const ajustes = await leeAjustes();
  if (!ajustes.refreshToken) {
    return NextResponse.json({ ok: false, aviso: "No hay ninguna cuenta de YouTube conectada (se conecta desde el coding, panel de YouTube)." });
  }

  try {
    const acceso = await dameAcceso(ajustes);
    const listas = await dameListas(acceso);
    const clips: ClipYoutube[] = [];
    for (const lista of listas) {
      for (const v of await dameVideosDeLista(acceso, lista.id, 500)) {
        clips.push({ id: v.id, titulo: v.titulo, lista: lista.nombre, publicado: v.publicado, vistas: 0, meGusta: 0 });
      }
    }
    const stats = await dameEstadisticas(acceso, [...new Set(clips.map((c) => c.id))]);
    for (const c of clips) {
      const s = stats.get(c.id);
      if (s) {
        c.vistas = s.vistas;
        c.meGusta = s.meGusta;
      }
    }

    /* La foto del día, si no está. */
    const hoy = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });
    const { data } = await sb.from("app_documents").select("data").eq("key", CLAVE).maybeSingle();
    const historia: Record<string, Record<string, number>> = { ...((data?.data as Doc | null)?.historia ?? {}) };
    historia[hoy] = Object.fromEntries(clips.map((c) => [c.id, c.vistas]));
    for (const dia of Object.keys(historia).sort().slice(0, -DIAS_HISTORIA)) delete historia[dia];

    const doc: Doc = { actualizado: new Date().toISOString(), clips, historia };
    await sb.from("app_documents").upsert({ key: CLAVE, kind: "visionados", data: doc, updated_at: doc.actualizado }, { onConflict: "key" });

    cache = { cuando: Date.now(), doc };
    return NextResponse.json({ ok: true, ...doc });
  } catch (error) {
    console.error("[youtube/visionados]", error);
    /* Sin YouTube, lo último guardado. */
    const { data } = await sb.from("app_documents").select("data").eq("key", CLAVE).maybeSingle();
    if (data?.data) return NextResponse.json({ ok: true, ...(data.data as Doc), aviso: "YouTube no ha contestado: son las cifras de la última foto." });
    return NextResponse.json({ ok: false, aviso: error instanceof Error ? error.message : "YouTube no ha contestado." });
  }
}
