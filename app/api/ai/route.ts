import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  console.log(
    "OPENAI KEY:",
    process.env.OPENAI_API_KEY
      ? "EXISTS"
      : "MISSING"
  );

  try {
    const body = await req.json();

    const { question, context } = body;

    const completion =
      await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [
          {
            role: "system",
            content: `
Eres un analista profesional de fútbol.

Responde utilizando únicamente el contexto recibido.

Sé breve, claro y orientado al análisis deportivo.
            `,
          },
          {
            role: "user",
            content: `
Contexto:
${JSON.stringify(context)}

Pregunta:
${question}
            `,
          },
        ],
      });

    return Response.json({
      answer:
        completion.choices[0].message.content,
    });
  } catch (error: any) {
  console.error("OPENAI ERROR:", error);

  return Response.json(
    {
      error: error?.message || "Error generando respuesta",
    },
    {
      status: 500,
    }
  );
}
}