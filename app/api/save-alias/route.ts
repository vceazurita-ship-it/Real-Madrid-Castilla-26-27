export async function POST(req: Request) {
  console.log("1 - Entrando");

  const body = await req.json();
  console.log("2 - Body", body);

  console.log("3 - URL", process.env.NEXT_PUBLIC_API_URL);

  const response = await fetch(process.env.NEXT_PUBLIC_API_URL!, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "saveAlias",
      alias: body.alias,
      id: body.id,
      confidence: body.confidence ?? 100,
    }),
  });

  console.log("4 - Fetch realizado");

  if (!response.ok) {
    return Response.json(
      {
        ok: false,
        error: "No se pudo guardar el alias",
      },
      { status: response.status }
    );
  }

  console.log("5 - Todo correcto");

  return Response.json(await response.json());
}