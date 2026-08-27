import { cuerpoJson, llamaScript } from "@/lib/appsScript";

/**
 * "Enviar ahora": manda la alerta en el momento, sin tocar su calendario.
 *
 * Es la vía para probar que el correo sale bien —y para el aviso urgente que
 * no merece programar—. La hoja suma el envío al historial y a la agenda de
 * correos, así que un envío de prueba también enseña direcciones nuevas a la
 * app, pero **no** adelanta ni consume el próximo aviso programado.
 */

export async function POST(request: Request) {
  const cuerpo = await cuerpoJson(request);

  const id = typeof cuerpo.id === "string" ? cuerpo.id : "";

  if (!id) {
    return Response.json(
      { ok: false, error: "Falta el identificador de la alerta" },
      { status: 400 },
    );
  }

  return llamaScript("enviarAlertaAhora", { id });
}
