/*
|--------------------------------------------------------------------------
| LA LOCUCIÓN DEL VÍDEO RESUMEN, PULIDA POR GEMINI
|--------------------------------------------------------------------------
|
| Recibe la locución de cada escena tal y como la escribe `lib/video-informe/
| guion.ts` —que ya se puede leer tal cual— y la devuelve reescrita con voz de
| analista, sin inventar un dato ni cambiar una cifra, y con tope de palabras
| por escena para que el vídeo entero quepa en un minuto.
|
| Mismo motor y misma clave que /api/voice (`gemini-2.5-flash`): sin coste en
| el plan gratuito. Si falla, el navegador se queda con el texto original: la
| ruta nunca es imprescindible.
*/

import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

import { puedeMandar } from "@/lib/correo/peticionInforme";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = "gemini-2.5-flash";

const ESQUEMA = {
  type: "object",
  properties: {
    locuciones: {
      type: "array",
      items: {
        type: "object",
        properties: { id: { type: "string" }, texto: { type: "string" } },
        required: ["id", "texto"],
      },
    },
  },
  required: ["locuciones"],
};

type Entrada = { id: string; texto: string; palabras: number };

export async function POST(request: NextRequest) {
  if (!puedeMandar(request)) return NextResponse.json({ ok: false, error: "Hace falta sesión del cuerpo técnico." }, { status: 401 });

  if (!process.env.GEMINI_API_KEY) return NextResponse.json({ ok: false, error: "Falta la clave GEMINI_API_KEY." }, { status: 503 });

  let cuerpo: { contexto?: unknown; escenas?: unknown };

  try {
    cuerpo = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Cuerpo ilegible." }, { status: 400 });
  }

  const escenas: Entrada[] = Array.isArray(cuerpo.escenas)
    ? cuerpo.escenas
        .map((e) => e as Partial<Entrada>)
        .filter((e) => typeof e.id === "string" && typeof e.texto === "string")
        .map((e) => ({ id: e.id!, texto: e.texto!.slice(0, 600), palabras: Math.max(6, Math.min(40, Number(e.palabras) || 22)) }))
        .slice(0, 10)
    : [];

  if (!escenas.length) return NextResponse.json({ ok: false, error: "Sin escenas." }, { status: 400 });

  const contexto = typeof cuerpo.contexto === "string" ? cuerpo.contexto.slice(0, 300) : "";

  const prompt = [
    "Eres el analista del Real Madrid Castilla y locutas un vídeo resumen de menos de un minuto para el cuerpo técnico.",
    "Reescribe la locución de cada escena en castellano de España, directa y sin adornos, como se habla en un vestuario profesional.",
    "REGLAS: no inventes ni cambies ningún dato, cifra, nombre ni porcentaje; no añadas nada que no esté; cada escena no puede pasar de las palabras que se indican;",
    "las cifras se escriben en palabras cuando ayuden a leerlas en voz alta (\"cuarenta y dos por ciento\"); sin emojis, sin comillas, sin encabezados.",
    contexto ? `Contexto: ${contexto}` : "",
    "Escenas (id · tope de palabras · texto):",
    ...escenas.map((e) => `- ${e.id} · ${e.palabras} palabras · ${e.texto}`),
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const respuesta = await ai.models.generateContent({
      model: MODEL,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { temperature: 0.3, responseMimeType: "application/json", responseJsonSchema: ESQUEMA },
    });

    const datos = JSON.parse(respuesta.text ?? "{}") as { locuciones?: { id: string; texto: string }[] };

    const porId = new Map((datos.locuciones ?? []).map((l) => [l.id, l.texto.trim()]));

    /* Lo que venga vacío o desbocado se queda con el original: el tope de palabras es la duración del vídeo. */
    const locuciones = escenas.map((e) => {
      const t = porId.get(e.id);
      const vale = t && t.split(/\s+/).length <= e.palabras * 1.3;

      return { id: e.id, texto: vale ? t : e.texto };
    });

    return NextResponse.json({ ok: true, locuciones });
  } catch (error) {
    console.warn("[video-guion] Gemini no ha contestado", error);

    return NextResponse.json({ ok: false, error: "La IA no ha contestado; se usa el texto original." }, { status: 502 });
  }
}
