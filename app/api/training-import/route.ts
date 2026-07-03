import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

export async function POST(req: Request) {
  try {
    console.log("========== TRAINING IMPORT ==========");

    console.log("API KEY:", !!process.env.GEMINI_API_KEY);

    const formData = await req.formData();

    console.log("FORMDATA OK");

    const image = formData.get("image") as File | null;

    console.log("IMAGE:", image?.name);

    if (!image) {
      return Response.json(
        { error: "Sin imagen" },
        { status: 400 }
      );
    }

    const bytes = await image.arrayBuffer();

    console.log("ARRAY BUFFER OK");

    const base64 = Buffer.from(bytes).toString("base64");

    console.log("BASE64 OK");

    return Response.json({
      ok: true,
      size: image.size,
      mime: image.type,
      base64Length: base64.length,
    });

  } catch (error) {
    console.error(error);

    return Response.json(
      {
        error: String(error),
      },
      {
        status: 500,
      }
    );
  }
}