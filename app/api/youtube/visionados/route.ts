import { createClient } from "@/lib/datos/cliente";
import { after, NextResponse } from "next/server";

import { dameAcceso, dameEstadisticas, dameListas, dameVideosDeLista, leeAjustes, vaciaPendientesLista } from "@/lib/coding/youtube";
import { procesaAplazadas } from "@/lib/coding/youtube-aplazadas";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/*
| LAS VISTAS DE LOS CLIPS EN EL CANAL DE YOUTUBE (06/11/2026)
|
| Los jugadores ven los clips en YouTube, no en la app. YouTube dice cuántas
| veces se ve cada vídeo, nunca quién (ni al dueño del canal).
|
| La API tiene una cuota diaria que se comen las subidas de vídeo; el día que
| se acaba, la pantalla se quedaba en blanco con el error en inglés. Ahora:
| 1. Una foto al día. Si la de hoy ya está, se sirve sin tocar YouTube.
| 2. Si no, la API (cuesta ~1 unidad por lista y por cada 50 vídeos). Guarda
|    también los identificadores de las listas.
| 3. Sin cuota, se leen las páginas de esas listas (se abren por enlace aunque
|    sean ocultas y no gastan cuota) con el número que enseñan.
| 4. Si nada contesta, la última foto guardada, con un aviso en castellano.
| La web despierta (GitHub, cada 10 min) llama aquí, así que la foto del día
| se hace sola en cuanto hay cuota: tras cada partido queda al día.
*/

const CLAVE = "visionados:youtube";
const DIAS_HISTORIA = 120;
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

type Clip = { id: string; titulo: string; lista: string; publicado: string; vistas: number; meGusta: number };
type Lista = { id: string; nombre: string };
type Doc = { actualizado: string; fuente?: "api" | "paginas"; clips: Clip[]; listas?: Lista[]; historia: Record<string, Record<string, number>> };

const hoy = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });

const AVISO_CUOTA =
  "Las cifras de YouTube llegan a partir de las 09:00.";

function enCastellano(mensaje: string) {
  if (/quota/i.test(mensaje)) return AVISO_CUOTA;
  return "YouTube no ha contestado ahora mismo; se vuelve a intentar solo cada pocos minutos.";
}

async function leeDoc(): Promise<Doc | null> {
  const { data } = await sb.from("app_documents").select("data").eq("key", CLAVE).maybeSingle();
  return (data?.data as Doc | null) ?? null;
}

async function guarda(previo: Doc | null, clips: Clip[], listas: Lista[], fuente: Doc["fuente"]): Promise<Doc> {
  const historia = { ...(previo?.historia ?? {}) };
  historia[hoy()] = Object.fromEntries(clips.map((c) => [c.id, c.vistas]));
  for (const dia of Object.keys(historia).sort().slice(0, -DIAS_HISTORIA)) delete historia[dia];
  const doc: Doc = { actualizado: new Date().toISOString(), fuente, clips, listas, historia };
  await sb.from("app_documents").upsert({ key: CLAVE, kind: "visionados", data: doc, updated_at: doc.actualizado }, { onConflict: "key" });
  return doc;
}

/** Por la API: listas, vídeos y vistas exactas. */
async function porApi(): Promise<{ clips: Clip[]; listas: Lista[] }> {
  const ajustes = await leeAjustes();
  if (!ajustes.refreshToken) throw new Error("No hay ninguna cuenta de YouTube conectada (se conecta desde el coding, panel de YouTube).");
  const acceso = await dameAcceso(ajustes);
  const listas = (await dameListas(acceso)).map((l) => ({ id: l.id, nombre: l.nombre }));
  const clips: Clip[] = [];
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
  return { clips, listas };
}

/** «1,2 K visualizaciones» → 1200. */
function vistasDe(texto: string) {
  const t = texto.toLowerCase();
  if (!t || /^sin |no views/.test(t)) return 0;
  const m = t.match(/([\d.,]+)\s*(k|mil|m|mill)?/);
  if (!m) return 0;
  let n = Number(m[1].replace(/\./g, "").replace(",", "."));
  if (m[2] === "k" || m[2] === "mil") n *= 1000;
  if (m[2] === "m" || m[2] === "mill") n *= 1_000_000;
  return Math.round(n);
}

/** Sin cuota: la página de cada lista ya conocida. */
async function porPaginas(listas: Lista[], previos: Clip[]): Promise<Clip[]> {
  const fecha = new Map(previos.map((c) => [c.id, c.publicado]));
  const clips: Clip[] = [];
  for (const l of listas) {
    const html = await fetch(`https://www.youtube.com/playlist?list=${l.id}&hl=es`, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36", "Accept-Language": "es-ES", Cookie: "SOCS=CAI; CONSENT=YES+1" },
      cache: "no-store",
    }).then((r) => r.text());
    const crudo = html.match(/var ytInitialData = (\{[\s\S]*?\});<\/script>/)?.[1];
    if (!crudo) continue;
    const recorre = (o: unknown) => {
      if (!o || typeof o !== "object") return;
      const r = (o as { playlistVideoRenderer?: { videoId: string; title?: { simpleText?: string; runs?: { text: string }[] }; videoInfo?: { runs?: { text: string }[] } } }).playlistVideoRenderer;
      if (r) {
        const titulo = r.title?.simpleText ?? (r.title?.runs ?? []).map((x) => x.text).join("");
        clips.push({ id: r.videoId, titulo, lista: l.nombre, publicado: fecha.get(r.videoId) ?? "", vistas: vistasDe(r.videoInfo?.runs?.[0]?.text ?? ""), meGusta: 0 });
        return;
      }
      for (const v of Object.values(o)) recorre(v);
    };
    recorre(JSON.parse(crudo));
  }
  return clips;
}

export async function GET(peticion: Request) {
  const forzar = new URL(peticion.url).searchParams.has("forzar");

  /* Cada 10 min desde la web despierta: las subidas que esperaban cuota, después de responder (11/11/2026). */
  after(() => procesaAplazadas().catch((error) => console.error("[youtube] aplazadas", error)));

  /* Y los vídeos que esperan su lista por un día sin cuota. */
  await leeAjustes()
    .then((ajustes) => vaciaPendientesLista(ajustes))
    .catch(() => 0);

  const previo = await leeDoc();

  /* 1. La foto de hoy ya está: sin tocar YouTube. */
  if (!forzar && previo?.historia?.[hoy()] && previo.clips?.length) return NextResponse.json({ ok: true, ...previo });

  /* 2. La API. */
  try {
    const { clips, listas } = await porApi();
    if (clips.length) return NextResponse.json({ ok: true, ...(await guarda(previo, clips, listas, "api")) });
  } catch (error) {
    const aviso = enCastellano(error instanceof Error ? error.message : "");

    /* 3. Sin cuota: las páginas de las listas conocidas. */
    if (previo?.listas?.length) {
      try {
        const clips = await porPaginas(previo.listas, previo.clips ?? []);
        if (clips.length) {
          const doc = await guarda(previo, clips, previo.listas, "paginas");
          return NextResponse.json({ ok: true, ...doc, aviso: "Cifras leídas de las páginas de las listas (YouTube redondea a partir de mil)." });
        }
      } catch (e) {
        console.error("[youtube/visionados] páginas", e);
      }
    }

    /* 4. Lo último guardado. */
    if (previo?.clips?.length) return NextResponse.json({ ok: true, ...previo, aviso: `${aviso} Mientras, las cifras del ${new Date(previo.actualizado).toLocaleDateString("es-ES")}.` });
    return NextResponse.json({ ok: false, aviso });
  }
  return NextResponse.json({ ok: false, aviso: "El canal no tiene clips en listas." });
}
