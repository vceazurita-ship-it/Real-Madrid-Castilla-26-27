import {
  cuerpoJson,
  leeDeLaHoja,
  llamaScript,
  olvidaLectura,
} from "@/lib/appsScript";

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

/*
| La lista se sirve de la copia y la hoja se pregunta por detrás.
|
| Es una pantalla de lectura y el arranque en frío de Apps Script son treinta a
| setenta segundos: entrar por la mañana costaba un minuto de pantalla vacía.
| `?fresco=1` se salta la copia; lo usa la propia pantalla después de guardar.
*/
export async function GET(request: Request) {
  const fresco =
    new URL(request.url).searchParams.get("fresco") === "1";

  return leeDeLaHoja("listarAlertas", { fresco });
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

  olvidaLectura("listarAlertas");

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

  olvidaLectura("listarAlertas");

  return llamaScript("borrarAlerta", { id });
}
