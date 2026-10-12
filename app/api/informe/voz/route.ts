/*
|--------------------------------------------------------------------------
| LA VOZ DEL VÍDEO RESUMEN (GEMINI TTS, SIN COSTE)
|--------------------------------------------------------------------------
|
| Convierte la locución en audio con `gemini-2.5-flash-preview-tts`, que entra
| en el plan gratuito de la misma clave que ya usa /api/voice. Devuelve PCM de
| 16 bits a 24 kHz, mono, EN CRUDO (application/octet-stream): es lo que da
| Gemini y lo que el navegador remuestrea y codifica a AAC dentro del MP4
| (`lib/video-informe/monta.ts`).
|
| UNA sola petición con toda la locución (12/10/2026). La primera versión
| pedía una por escena, de tres en tres, y el vídeo salía mudo: el plan
| gratuito del TTS admite muy pocas peticiones por minuto y contestaba 429 a
| partir de la segunda tanda. Ahora el navegador recibe el audio entero y lo
| parte por escenas buscando los silencios (`pideVoz`).
|
| Y en crudo, no en JSON: un minuto de voz son 2,9 MB de PCM, que en base64
| serían 3,9 MB, pegados al tope de respuesta de una función de Vercel.
*/

import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

import { puedeMandar } from "@/lib/correo/peticionInforme";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = "gemini-2.5-flash-preview-tts";

/** Voz clara y neutra en castellano; «Kore» es la que mejor lee cifras. */
const VOZ = "Kore";

const FRECUENCIA = 24_000;

/** Un minuto largo de locución; más no cabe en el vídeo ni en la respuesta. */
const MAX_CARACTERES = 2200;

export async function POST(request: NextRequest) {
  if (!puedeMandar(request)) return NextResponse.json({ ok: false, error: "Hace falta sesión del cuerpo técnico." }, { status: 401 });

  if (!process.env.GEMINI_API_KEY) return NextResponse.json({ ok: false, error: "Falta la clave GEMINI_API_KEY." }, { status: 503 });

  let cuerpo: { textos?: unknown };

  try {
    cuerpo = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Cuerpo ilegible." }, { status: 400 });
  }

  const textos = Array.isArray(cuerpo.textos) ? cuerpo.textos.filter((t): t is string => typeof t === "string").map((t) => t.replace(/\s+/g, " ").trim()).slice(0, 12) : [];

  if (!textos.some(Boolean)) return NextResponse.json({ ok: false, error: "Sin textos." }, { status: 400 });

  /* Cada escena es un párrafo: la pausa entre párrafos es lo que luego permite partir el audio. */
  const guion = textos
    .filter(Boolean)
    .map((t) => (/[.!?…]$/.test(t) ? t : `${t}.`))
    .join("\n\n")
    .slice(0, MAX_CARACTERES);

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  let ultimo: unknown = null;

  for (let intento = 0; intento < 3; intento += 1) {
    try {
      const r = await ai.models.generateContent({
        model: MODEL,
        contents: [{ role: "user", parts: [{ text: `Lee con tono de analista de fútbol, ritmo ágil, en castellano de España, haciendo una pausa clara entre párrafos:\n\n${guion}` }] }],
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOZ } } },
        },
      });

      const parte = r.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);

      if (!parte?.inlineData?.data) throw new Error("Gemini no ha devuelto audio.");

      const frecuencia = Number(parte.inlineData.mimeType?.match(/rate=(\d+)/)?.[1]) || FRECUENCIA;
      const bytes = Buffer.from(parte.inlineData.data, "base64");

      return new Response(new Uint8Array(bytes), {
        status: 200,
        headers: { "Content-Type": "application/octet-stream", "X-Voz-Frecuencia": String(frecuencia), "X-Voz-Canales": "1", "Cache-Control": "no-store" },
      });
    } catch (error) {
      ultimo = error;
      const estado = (error as { status?: number })?.status;

      /* Saturado o cuota por minuto: un respiro y otra vez. Lo demás no se repite. */
      if (estado !== 429 && estado !== 503) break;

      await new Promise((r) => setTimeout(r, 4000 * (intento + 1)));
    }
  }

  console.warn("[voz] Gemini TTS no ha contestado", ultimo);

  const estado = (ultimo as { status?: number })?.status;

  return NextResponse.json(
    { ok: false, error: estado === 429 ? "La cuota gratuita de voz de Gemini está agotada por ahora; el vídeo sale sin voz." : "La IA de voz no ha contestado; el vídeo sale sin voz." },
    { status: 502 },
  );
}
