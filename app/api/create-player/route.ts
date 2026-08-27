import { cuerpoJson, llamaScript } from "@/lib/appsScript";

export async function POST(req: Request) {
  const body = await cuerpoJson(req);

  return llamaScript("createPlayer", {
    name: body.name,
    licencia: body.licencia,
    estado: body.estado,
  });
}
