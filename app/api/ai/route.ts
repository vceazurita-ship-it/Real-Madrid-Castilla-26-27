import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
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
  } catch (error) {
    console.error(error);

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