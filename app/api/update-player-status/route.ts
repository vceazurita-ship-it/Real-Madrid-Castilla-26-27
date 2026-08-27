import { cuerpoJson, llamaScript } from "@/lib/appsScript";

export async function POST(req: Request) {
  const body = await cuerpoJson(req);

  return llamaScript("updatePlayerStatus", { players: body.players });
}
