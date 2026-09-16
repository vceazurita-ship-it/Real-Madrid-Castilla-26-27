import { NextRequest, NextResponse } from "next/server";

import { envia, leeDestinatarios } from "@/lib/correo/gmail";

/**
 * MANDAR EL INFORME DE ABP DEL MICROCICLO.
 *
 * El informe **se arma en el navegador**, no aquí: la pantalla del microciclo
 * ya tiene cargados el plan, la hoja de registro, las hojas de competición y el
 * seguimiento, y volver a bajarlos en el servidor sería pagar dos veces una
 * espera que en frío pasa de medio minuto. Aquí llega el correo ya escrito
 * —asunto, HTML y texto— y lo único que se hace es mandarlo con la cuenta de
 * Google del club (`lib/correo/gmail.ts`).
 *
 * Por eso esta ruta es corta a propósito: quien decide qué dice el informe es
 * `lib/abp/informe-micro.ts`, y se puede ver en pantalla sin mandar nada.
 */

const mal = (mensaje: string, estado = 400) =>
  NextResponse.json({ ok: false, error: mensaje }, { status: estado });

export async function POST(request: NextRequest) {
  let cuerpo: Record<string, unknown>;

  try {
    cuerpo = (await request.json()) as Record<string, unknown>;
  } catch {
    return mal("La petición no trae datos.");
  }

  const { buenas, malas } = leeDestinatarios(String(cuerpo.para ?? ""));

  if (malas.length > 0) {
    return mal(
      `Esto no parecen direcciones de correo: ${malas.slice(0, 3).join(", ")}`,
    );
  }

  if (buenas.length === 0) {
    return mal("No hay ninguna dirección a la que mandar el informe.");
  }

  const asunto = String(cuerpo.asunto ?? "").trim();
  const html = String(cuerpo.html ?? "");
  const texto = String(cuerpo.texto ?? "");

  if (!asunto) return mal("El correo no tiene asunto.");
  if (!html.trim()) return mal("El informe ha llegado vacío.");

  /*
  | Los gráficos viajan como partes del correo, no dentro del HTML.
  |
  | Gmail quita los `<img src="data:…">`, así que el informe los llama por su
  | `cid` y aquí se adjuntan con ese identificador. Llegan ya en base64 desde el
  | navegador, que es quien los dibuja (`lib/abp/informe-graficos.ts`).
  */
  const imagenes = Array.isArray(cuerpo.imagenes) ? cuerpo.imagenes : [];

  const adjuntos = imagenes.flatMap((una) => {
    const dato = una as { cid?: unknown; base64?: unknown };

    const cid = String(dato.cid ?? "").trim();
    const base64 = String(dato.base64 ?? "").trim();

    if (!cid || !base64) return [];

    return [
      {
        nombre: `${cid}.png`,
        tipo: "image/png",
        base64,
        cid,
      },
    ];
  });

  try {
    const { id, cuenta } = await envia({
      para: buenas,
      asunto,
      html,
      texto,
      adjuntos,
    });

    return NextResponse.json({ ok: true, id, cuenta, para: buenas });
  } catch (error) {
    console.error("[abp] informe por correo", error);

    return mal(
      error instanceof Error
        ? error.message
        : "No se ha podido enviar el informe.",
      500,
    );
  }
}
