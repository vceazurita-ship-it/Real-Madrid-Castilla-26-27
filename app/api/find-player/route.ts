export async function POST(req: Request) {

  const body = await req.json();

  const response = await fetch(process.env.NEXT_PUBLIC_API_URL!, {

    method: "POST",

    headers: {
      "Content-Type": "application/json",
    },

    body: JSON.stringify({

      action: "findPlayer",

      name: body.name,

    }),

  });

  return Response.json(await response.json());

}