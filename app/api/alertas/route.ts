import { cuerpoJson, llamaScript } from "@/lib/appsScript";

/**
 * Tareas con alerta: listar, guardar y borrar.
 *
 * Todo pasa por el Apps Script de la hoja porque es quien acaba enviando los
 * correos y quien tiene el disparador horario. Ver `lib/alertas/modelo.ts`
 * para por qué la hoja es el único origen y no hay copia en Supabase.
 *
 * `llamaScript` ya devuelve una `Response` con `{ ok: false, error }` cuando la
 * hoja falla o no está configurada, así que aquí no hace falta envolver nada.
 */

export async function GET() {
  return llamaScript("listarAlertas");
}

export async function POST(request: Request) {
  const cuerpo = await cuerpoJson(request);

  const alerta = cuerpo.alerta;

  if (!alerta || typeof alerta !== "object") {
    return Response.json(
      { ok: false, error: "Falta la alerta que hay que guardar" },
      { status: 400 },
    );
  }

  return llamaScript("guardarAlerta", { alerta });
}

export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get("id");

  if (!id) {
    return Response.json(
      { ok: false, error: "Falta el identificador de la alerta" },
      { status: 400 },
    );
  }

  return llamaScript("borrarAlerta", { id });
}
