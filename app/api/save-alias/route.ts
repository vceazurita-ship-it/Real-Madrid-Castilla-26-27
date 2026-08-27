import { cuerpoJson, llamaScript } from "@/lib/appsScript";

export async function POST(req: Request) {
  const body = await cuerpoJson(req);

  return llamaScript("saveAlias", {
    alias: body.alias,
    id: body.id,
    confidence: body.confidence ?? 100,
  });
}
