const APPS_SCRIPT = process.env.APPS_SCRIPT_URL!;

export async function POST(req: Request) {

  const body = await req.json();

  const response = await fetch(APPS_SCRIPT,{
    method:"POST",
    headers:{
      "Content-Type":"application/json"
    },
    body:JSON.stringify({
      action:"createPlayer",
      name:body.name,
      licencia:body.licencia,
      estado:body.estado
    })
  });

  return Response.json(await response.json());

}