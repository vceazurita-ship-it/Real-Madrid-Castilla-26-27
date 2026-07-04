export async function POST(req: Request) {

  const body = await req.json();

  const response = await fetch(process.env.NEXT_PUBLIC_API_URL!, {

    method: "POST",

    body: JSON.stringify({

      action: "findPlayer",

      name: body.name,

    }),

  });

  return Response.json(await response.json());

}