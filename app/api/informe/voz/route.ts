/*
|--------------------------------------------------------------------------
| LA VOZ DEL VÍDEO RESUMEN (GEMINI TTS, SIN COSTE)
|--------------------------------------------------------------------------
|
| Convierte la locución de cada escena en audio con `gemini-2.5-flash-preview-
| tts`, que entra en el plan gratuito de la misma clave que ya usa /api/voice.
| Devuelve PCM de 16 bits a 24 kHz, mono, en base64: es lo que da Gemini y lo
| que el navegador codifica a AAC dentro del MP4 (`lib/video-informe/monta.ts`).
|
| Una petición por escena, en paralelo pero de pocas en pocas: la cuota
| gratuita es por minuto. Lo que falle vuelve como `null` y esa escena va muda
| con su texto en pantalla; el vídeo sale igual.
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

async function locuta(ai: GoogleGenAI, texto: string): Promise<string | null> {
  for (let intento = 0; intento < 2; intento += 1) {
    try {
      const r = await ai.models.generateContent({
        model: MODEL,
        contents: [{ role: "user", parts: [{ text: `Lee con tono de analista de fútbol, ritmo ágil y sin pausas largas, en castellano de España: ${texto}` }] }],
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOZ } } },
        },
      });

      const parte = r.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);

      if (parte?.inlineData?.data) return parte.inlineData.data;
    } catch (error) {
      const estado = (error as { status?: number })?.status;

      /* Saturado o cuota por minuto: un respiro y otra vez. Lo demás no se repite. */
      if (estado !== 429 && estado !== 503) break;

      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  return null;
}

export async function POST(request: NextRequest) {
  if (!puedeMandar(request)) return NextResponse.json({ ok: false, error: "Hace falta sesión del cuerpo técnico." }, { status: 401 });

  if (!process.env.GEMINI_API_KEY) return NextResponse.json({ ok: false, error: "Falta la clave GEMINI_API_KEY." }, { status: 503 });

  let cuerpo: { textos?: unknown };

  try {
    cuerpo = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Cuerpo ilegible." }, { status: 400 });
  }

  const textos = Array.isArray(cuerpo.textos) ? cuerpo.textos.filter((t): t is string => typeof t === "string").map((t) => t.slice(0, 500)).slice(0, 10) : [];

  if (!textos.length) return NextResponse.json({ ok: false, error: "Sin textos." }, { status: 400 });

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const pistas: (string | null)[] = new Array(textos.length).fill(null);

  /* De tres en tres: la cuota gratuita del TTS es por minuto y por peticiones a la vez. */
  for (let i = 0; i < textos.length; i += 3) {
    const trozo = await Promise.all(textos.slice(i, i + 3).map((t) => (t.trim() ? locuta(ai, t) : Promise.resolve(null))));

    trozo.forEach((p, k) => (pistas[i + k] = p));
  }

  return NextResponse.json({ ok: true, frecuencia: FRECUENCIA, canales: 1, pistas });
}
