import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

export async function POST(req: Request) {
  try {
console.log("API KEY:", !!process.env.GEMINI_API_KEY);
    const formData = await req.formData();

    const image = formData.get("image") as File | null;

    if (!image) {
      return Response.json(
        { error: "No se ha recibido ninguna imagen." },
        { status: 400 }
      );
    }

    const bytes = await image.arrayBuffer();

    const base64 = Buffer.from(bytes).toString("base64");

    const prompt = `
Eres un analista profesional de fútbol.

Analiza esta imagen de planificación de entrenamiento.

REGLAS:

- Los jugadores situados dentro del terreno de juego están DISPONIBLES.
- Los jugadores situados debajo aparecen clasificados en las categorías:
  - PROMOCIÓN
  - LESIÓN
  - OTROS
  - SELECCIÓN

Devuelve EXCLUSIVAMENTE un JSON válido.

No escribas explicaciones.

No utilices Markdown.

No pongas \`\`\`json.

El formato debe ser EXACTAMENTE:

{
  "available": [],
  "injury": [],
  "promotion": [],
  "nationalTeam": [],
  "others": []
}
`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          text: prompt,
        },
        {
          inlineData: {
            mimeType: image.type,
            data: base64,
          },
        },
      ],
    });

    const text = response.text?.trim() ?? "";

    let parsed;

    try {
      parsed = JSON.parse(text);
    } catch {
      console.error("Respuesta de Gemini:", text);

      return Response.json(
        {
          error: "Gemini no devolvió un JSON válido.",
          raw: text,
        },
        {
          status: 500,
        }
      );
    }

    return Response.json(parsed);
  } catch (error) {
    console.error("TRAINING IMPORT ERROR:", error);

    return Response.json(
      {
        error: "Error analizando la imagen.",
      },
      {
        status: 500,
      }
    );
  }
}