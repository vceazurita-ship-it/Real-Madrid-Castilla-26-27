import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

export async function POST(req: Request) {
  try {
    console.log("========== TRAINING IMPORT ==========");

    console.log("API KEY:", !!process.env.GEMINI_API_KEY);

    const formData = await req.formData();

    const image = formData.get("image") as File | null;

    if (!image) {
      return Response.json(
        {
          error: "No se ha recibido ninguna imagen.",
        },
        {
          status: 400,
        }
      );
    }

    console.log("IMAGE:", image.name);

    const bytes = await image.arrayBuffer();

    const base64 = Buffer.from(bytes).toString("base64");

    console.log("IMAGE CONVERTED");

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: "Describe brevemente qué ves en esta imagen.",
            },
            {
              inlineData: {
                mimeType: image.type,
                data: base64,
              },
            },
          ],
        },
      ],
    });

    console.log(response);

    return Response.json({
      answer: response.text,
    });
  } catch (error: any) {
    console.error("GEMINI ERROR");
    console.error(error);

    return Response.json(
      {
        error: error?.message ?? "Error desconocido",
      },
      {
        status: 500,
      }
    );
  }
}