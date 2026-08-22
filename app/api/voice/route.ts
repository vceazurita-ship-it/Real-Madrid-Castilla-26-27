import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

import { RIVAL_VOICE_FIELDS } from "@/lib/voice/types";

/**
 * Dictado por voz.
 *
 * Recibe el audio en base64 y devuelve una propuesta estructurada: para la
 * plantilla rival, los campos del informe; para la pizarra, las escenas con
 * sus fichas y dibujos. Aquí no se escribe nada: quien decide es la interfaz.
 */

/* El audio va en el cuerpo, así que la respuesta nunca se puede cachear. */
export const dynamic = "force-dynamic";

const MODEL = "gemini-2.5-flash";

/** ~10 MB de base64: por encima de eso el dictado es demasiado largo. */
const MAX_AUDIO_CHARS = 10_000_000;

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

/*
|--------------------------------------------------------------------------
| ESQUEMAS DE RESPUESTA
|--------------------------------------------------------------------------
*/

const RIVAL_SCHEMA = {
  type: "object",
  properties: {
    resumen: { type: "string" },
    transcripcion: { type: "string" },
    cambios: {
      type: "array",
      items: {
        type: "object",
        properties: {
          campo: { type: "string", enum: [...RIVAL_VOICE_FIELDS] },
          valor: { type: "string" },
          modo: { type: "string", enum: ["reemplazar", "añadir"] },
          motivo: { type: "string" },
        },
        required: ["campo", "valor", "modo"],
      },
    },
    etiquetas: { type: "array", items: { type: "string" } },
    avisos: { type: "array", items: { type: "string" } },
  },
  required: ["resumen", "transcripcion", "cambios", "etiquetas", "avisos"],
} as const;

const POINT_SCHEMA = {
  type: "object",
  properties: {
    x: { type: "number" },
    y: { type: "number" },
  },
  required: ["x", "y"],
} as const;

const TACTICS_SCHEMA = {
  type: "object",
  properties: {
    resumen: { type: "string" },
    transcripcion: { type: "string" },
    crop: { type: "string", enum: ["full", "own-half", "final-third"] },
    escenas: {
      type: "array",
      items: {
        type: "object",
        properties: {
          nombre: { type: "string" },
          fichas: {
            type: "array",
            items: {
              type: "object",
              properties: {
                ref: { type: "string" },
                equipo: {
                  type: "string",
                  enum: ["propio", "rival", "balon", "cono"],
                },
                etiqueta: { type: "string" },
                nombre: { type: "string" },
                x: { type: "number" },
                y: { type: "number" },
              },
              required: ["ref", "equipo", "etiqueta", "x", "y"],
            },
          },
          dibujos: {
            type: "array",
            items: {
              type: "object",
              properties: {
                tipo: {
                  type: "string",
                  enum: ["arrow", "dashed", "line", "free", "zone", "text"],
                },
                puntos: { type: "array", items: POINT_SCHEMA },
                texto: { type: "string" },
                color: { type: "string" },
              },
              required: ["tipo", "puntos"],
            },
          },
        },
        required: ["nombre", "fichas", "dibujos"],
      },
    },
    avisos: { type: "array", items: { type: "string" } },
  },
  required: ["resumen", "transcripcion", "escenas", "avisos"],
} as const;

/*
|--------------------------------------------------------------------------
| INSTRUCCIONES
|--------------------------------------------------------------------------
*/

const RIVAL_PROMPT = `
Eres el analista de scouting del Real Madrid Castilla. Escuchas el dictado de
un entrenador sobre un jugador rival y lo conviertes en su ficha.

Reglas:
- Transcribe primero lo que oyes y trabaja sobre esa transcripción.
- Propón un cambio SOLO por lo que se dice de forma explícita. Nunca inventes
  datos ni rellenes campos "porque suelen ir juntos".
- Redacta en español, con el vocabulario del entrenador, en frases cortas y
  sin repetir el nombre del jugador en cada línea.
- CARACTERÍSTICAS, FORTALEZAS, DEBILIDADES y OBSERVACIONES admiten el modo
  "añadir": úsalo cuando el campo ya tenga texto y el dictado aporte algo
  nuevo. En "valor" pon únicamente lo que hay que añadir.
- El resto de campos son cortos: usa siempre "reemplazar".
- POSICIÓN y 2º POSICIÓN se escriben como en el resto de la hoja
  ("Lateral izquierdo", "Mediocentro", "Extremo derecho"...).
- PIE DOMINANTE: "Diestro", "Zurdo" o "Ambidiestro".
- EDAD, DORSAL y PESO son números; ALTURA en formato "1,84".
- "etiquetas" es la lista COMPLETA de claves que deben quedar activas: parte
  de las que ya tiene el jugador y quita las que el dictado contradiga. Usa
  solo claves del catálogo que se te pasa en el contexto.
- En "avisos" mete lo que se ha oído pero no encaja en ningún campo, y las
  dudas de interpretación (nombres poco claros, cifras dudosas).
- Si el audio no se entiende o no habla de un jugador, devuelve "cambios" y
  "etiquetas" vacíos y explícalo en "avisos".
`;

const TACTICS_PROMPT = `
Eres el segundo entrenador del Real Madrid Castilla y dibujas en la pizarra
táctica lo que el entrenador te va contando de viva voz.

El campo mide 100 de largo por 68 de ancho:
- x = 0 es la línea de fondo propia (portería propia) y x = 100 la del rival.
- y = 0 es la banda superior y y = 68 la inferior; el centro del campo es
  (50, 34). El área propia llega hasta x = 16 y el área rival empieza en x = 84.
- El equipo propio ataca hacia x creciente; el rival, hacia x decreciente.
- Costados: para el equipo propio la banda izquierda es la de y pequeño
  (y ≈ 10) y la derecha la de y grande (y ≈ 58). Para el rival, que ataca en
  sentido contrario, es al revés: su banda derecha es la de y pequeño y su
  izquierda la de y grande.

Reglas:
- Transcribe primero lo que oyes y trabaja sobre esa transcripción.
- Coloca cada ficha donde le corresponde por su posición y por lo que se
  cuenta. Un 4-4-2 propio en bloque medio no es una fila de fichas: separa las
  líneas en x y reparte los carriles en y.
- "ref" identifica al jugador durante todo el dictado ("rival-8",
  "propio-lateral-izq", "balon"). Si una ficha aparece en varias escenas
  repite SIEMPRE la misma "ref" con las coordenadas nuevas: así se anima el
  desplazamiento entre escenas.
- Crea una escena nueva cada vez que el entrenador describa un momento
  distinto de la jugada ("y entonces...", "en la segunda fase..."). Cada
  escena debe llevar TODAS las fichas que siguen en el campo, no solo las que
  se mueven. Si solo describe una foto fija, devuelve una única escena.
- "etiqueta" es lo que se pinta dentro de la ficha: el dorsal si se conoce, si
  no una abreviatura de dos o tres letras. El balón lleva la etiqueta vacía.
- Dibujos: "arrow" para desplazamientos de jugador, "dashed" para pases o
  conducciones del balón, "line" para líneas de referencia, "zone" para zonas
  (dos puntos: dos esquinas opuestas), "text" para una anotación (un punto y
  el campo "texto"), "free" para un trazo a mano alzada.
- Los pases van del que da al que recibe; las flechas de desmarque, desde
  donde está el jugador hasta donde llega.
- Si el contexto trae "escenaUnica": true, devuelve UNA sola escena con la
  foto final de la jugada.
- Usa "crop" solo si el entrenador habla claramente de una zona concreta:
  "own-half" para el campo propio, "final-third" para el último tercio.
- No inventes jugadores que no se nombran ni añadas dibujos decorativos.
- En "avisos" pon lo que no has podido representar y las dudas.
- Si el audio no se entiende, devuelve "escenas" vacío y explícalo en "avisos".
`;

/*
|--------------------------------------------------------------------------
| LLAMADA AL MODELO
|--------------------------------------------------------------------------
*/

/** Códigos que merecen reintento: el modelo está saturado, no hay error. */
const RETRY_CODES = [429, 500, 502, 503, 504];

function isBusy(error: unknown) {
  const status = (error as { status?: number })?.status;

  if (typeof status === "number") return RETRY_CODES.includes(status);

  return RETRY_CODES.some((code) => String(error).includes(String(code)));
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Pide la interpretación reintentando si el modelo está saturado.
 *
 * Un 503 de Gemini es habitual y volver a preguntar suele bastar: perder el
 * dictado por eso obligaría a repetirlo entero desde la banda del campo.
 */
async function ask(
  parts: { text?: string; inlineData?: { mimeType: string; data: string } }[],
  schema: unknown
) {
  let lastError: unknown;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await ai.models.generateContent({
        model: MODEL,
        contents: [{ role: "user", parts }],
        config: {
          temperature: 0.2,
          responseMimeType: "application/json",
          responseJsonSchema: schema,
        },
      });
    } catch (error) {
      lastError = error;

      if (!isBusy(error) || attempt === 2) throw error;

      await wait(800 * (attempt + 1));
    }
  }

  throw lastError;
}

/*
|--------------------------------------------------------------------------
| HANDLER
|--------------------------------------------------------------------------
*/

export async function POST(request: NextRequest) {
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      { success: false, error: "Falta la clave GEMINI_API_KEY." },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();

    const mode = String(body?.mode ?? "");
    const audio = String(body?.audio ?? "");
    const mimeType = String(body?.mimeType ?? "audio/wav");
    const context = body?.context ?? {};
    const extra = String(body?.instrucciones ?? "").slice(0, 2000);

    if (mode !== "rival" && mode !== "tactics") {
      return NextResponse.json(
        { success: false, error: "Modo de dictado no válido." },
        { status: 400 }
      );
    }

    if (!audio) {
      return NextResponse.json(
        { success: false, error: "No ha llegado ningún audio." },
        { status: 400 }
      );
    }

    if (audio.length > MAX_AUDIO_CHARS) {
      return NextResponse.json(
        { success: false, error: "El dictado es demasiado largo." },
        { status: 413 }
      );
    }

    const instructions = mode === "rival" ? RIVAL_PROMPT : TACTICS_PROMPT;
    const schema = mode === "rival" ? RIVAL_SCHEMA : TACTICS_SCHEMA;

    const response = await ask(
      [
        {
          text: [
            instructions,
            "Estado actual (lo que ya hay en pantalla):",
            JSON.stringify(context),
            extra ? `Indicaciones del entrenador:\n${extra}` : "",
            "Escucha el audio y responde solo con el JSON del esquema.",
          ]
            .filter(Boolean)
            .join("\n\n"),
        },
        { inlineData: { mimeType, data: audio } },
      ],
      schema
    );

    const text = response.text?.trim();

    if (!text) throw new Error("Respuesta vacía del modelo");

    return NextResponse.json({ success: true, result: JSON.parse(text) });
  } catch (error) {
    console.error("[voz] error interpretando el dictado:", error);

    return NextResponse.json(
      { success: false, error: "No se pudo interpretar el dictado." },
      { status: 500 }
    );
  }
}
