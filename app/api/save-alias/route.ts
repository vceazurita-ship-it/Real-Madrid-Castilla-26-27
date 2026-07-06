export async function POST(req: Request) {
  const body = await req.json();

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

  if (!response.ok) {
    return Response.json(
      {
        ok: false,
        error: "No se pudo guardar el alias",
      },
      { status: response.status }
    );
  }

  return Response.json(await response.json());
}