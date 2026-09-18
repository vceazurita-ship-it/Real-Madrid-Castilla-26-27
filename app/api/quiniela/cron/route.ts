/**
 * LOS RESULTADOS, CADA NOCHE, SIN QUE NADIE HAGA NADA.
 *
 * El cron de Vercel entra aquí y pone el 1-X-2 de lo que se haya jugado. Esto
 * **no sustituye** al trabajo nocturno del ordenador del club —que hace muchas
 * más cosas: informes de rivales, plantillas, fichas— pero sí lo cubre en lo
 * que importa aquí: si ese ordenador está apagado un domingo por la noche, los
 * resultados de la quiniela se ponen igual.
 *
 * El 18/09/2026 se midió que **BeSoccer sí contesta a Vercel** (200). Lo que
 * está cerrado es el runner de GitHub, donde se midió el 406 en septiembre; no
 * es lo mismo, y confundirlo habría dejado esto sin hacer.
 *
 * Los crons de Vercel piden por **GET**, por eso esto es un GET y no un POST.
 * Y no hace falta más protección que la del cron: lo único que puede conseguir
 * quien lo llame es que se lean los resultados de BeSoccer antes de tiempo.
 */

import { NextRequest, NextResponse } from "next/server";

import { actualizaResultados } from "@/lib/quiniela/actualiza";

export const dynamic = "force-dynamic";

export const maxDuration = 60;

function delCron(request: NextRequest) {
  const secreto = process.env.CRON_SECRET;

  if (secreto) {
    return request.headers.get("authorization") === `Bearer ${secreto}`;
  }

  /* Sin secreto, la cabecera que Vercel pone en todas sus invocaciones de
     cron. El mismo razonamiento —y los mismos límites— que en el aviso. */
  return Boolean(request.headers.get("x-vercel-cron-schedule"));
}

export async function GET(request: NextRequest) {
  if (!delCron(request)) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }

  try {
    const parte = await actualizaResultados();

    if (parte.cambios > 0) {
      console.log(
        `[quiniela] el cron ha puesto ${parte.cambios} resultado(s): ${parte.jornadas
          .flatMap((una) => una.detalle)
          .join(" · ")}`,
      );
    }

    return NextResponse.json({ ok: true, ...parte });
  } catch (error) {
    console.error("[quiniela] cron de resultados", error);

    return NextResponse.json(
      { ok: false, error: "No se ha podido actualizar." },
      { status: 503 },
    );
  }
}
