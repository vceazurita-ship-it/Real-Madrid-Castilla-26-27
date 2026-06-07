import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const { question, context } = body;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `
Eres un analista profesional de fútbol.

Contexto:
${JSON.stringify(context)}

Pregunta:
${question}
      `,
    });

    return Response.json({
      answer: response.text,
    });
  } catch (error) {
    console.error("GEMINI ERROR:", error);

    return Response.json(
      {
        error: "Error generando respuesta",
      },
      {
        status: 500,
      }
    );
  }
}