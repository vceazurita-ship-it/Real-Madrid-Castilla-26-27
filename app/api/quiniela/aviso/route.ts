/**
 * EL AVISO DEL VIERNES: «a las 12 se cierra».
 *
 * Lo dispara el cron de Vercel y **no hay nadie delante**, así que el correo se
 * arma aquí entero —a diferencia del informe de ABP, que llega ya escrito
 * desde el navegador porque allí sí hay una pantalla con los datos cargados—.
 *
 * Tres decisiones que no son obvias:
 *
 * - **El cron dispara dos veces, a las 07:00 y a las 08:00 UTC**, y esta ruta
 *   manda sólo si en Madrid son las 9. Los crons de Vercel van en UTC y España
 *   cambia de hora dos veces al año: con un solo disparo, medio año el correo
 *   saldría a las 8 o a las 10. Es el mismo truco del huso que ya usa el cron
 *   nocturno.
 * - **Se manda una sola vez por jornada.** Se apunta en el documento de la
 *   quiniela qué jornada ya se avisó, porque si el cron se repite —Vercel
 *   reintenta— el staff recibiría el mismo correo dos veces.
 * - **Si no hay nadie registrado, no se manda nada** y se contesta que sí. No
 *   es un fallo: es la primera semana, y llenar los registros de errores rojos
 *   por algo normal hace que nadie mire los registros.
 *
 * Se puede llamar a mano con `?probar=1` para ver qué diría sin mandarlo.
 */

import { NextRequest, NextResponse } from "next/server";

import { envia } from "@/lib/correo/gmail";
import { readDoc, writeDoc } from "@/lib/docStore";
import {
  CLAVE_CUENTAS,
  CUENTAS_VACIAS,
  correosDe,
  type DocumentoCuentas,
} from "@/lib/quiniela/cuentas";
import {
  HORA_AVISO,
  HORA_CIERRE,
  cuandoCierra,
  enMadrid,
  jornadaQueCierraEl,
  viernesDe,
} from "@/lib/quiniela/cierre";
import { fraseDe } from "@/lib/quiniela/frases";
import { sinCastilla } from "@/lib/quiniela/migracion";
import {
  JORNADAS,
  QUINIELA_VACIA,
  partidosDe,
  type DocumentoQuiniela,
} from "@/lib/quiniela/modelo";

export const dynamic = "force-dynamic";

const CLAVE_QUINIELA = "quiniela";

/** El oro de la casa, para que el correo se parezca al resto. */
const ORO = "#C8A96B";

/* ------------------------------------------------------------------ */
/*  QUIÉN PUEDE LLAMAR                                                 */
/* ------------------------------------------------------------------ */

/**
 * Sólo el cron.
 *
 * Vercel manda `Authorization: Bearer <CRON_SECRET>` en sus crons. Sin esto,
 * cualquiera que supiera la dirección podría mandarle un correo a todo el
 * cuerpo técnico las veces que quisiera.
 */
function autorizado(request: NextRequest) {
  const secreto = process.env.CRON_SECRET;

  /* Sin secreto configurado no se atiende a nadie: es preferible que el aviso
     no salga y se vea en los registros, a dejar la puerta abierta. */
  if (!secreto) return false;

  const cabecera = request.headers.get("authorization") ?? "";

  return cabecera === `Bearer ${secreto}`;
}

/* ------------------------------------------------------------------ */
/*  EL CORREO                                                          */
/* ------------------------------------------------------------------ */

/**
 * El correo lleva el enlace a la pantalla. Se saca de la dirección por la que
 * ha entrado el cron, no de un dominio escrito a mano: el primero que se puso
 * no era el de la aplicación y el botón del correo daba 404.
 */
function armaCorreo(jornada: number, viernes: string | null, origen: string) {
  const partidos = partidosDe(jornada);

  const frase = fraseDe(jornada);

  const cierre = cuandoCierra(viernes);

  const lista = partidos
    .map(
      (uno) =>
        `<tr><td style="padding:6px 10px;border-bottom:1px solid #1d242c;color:#c9d1d9;">${uno.local}</td>` +
        `<td style="padding:6px 6px;border-bottom:1px solid #1d242c;color:#5b6570;text-align:center;">-</td>` +
        `<td style="padding:6px 10px;border-bottom:1px solid #1d242c;color:#c9d1d9;">${uno.visitante}</td></tr>`,
    )
    .join("");

  const html = `<!doctype html>
<html lang="es"><body style="margin:0;background:#0B0F14;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0B0F14;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#11161C;border:1px solid #1d242c;border-radius:14px;overflow:hidden;">

        <tr><td style="padding:22px 24px 6px;">
          <p style="margin:0;font-size:10px;letter-spacing:2.4px;text-transform:uppercase;color:${ORO};">RMCF Castilla · Entre nosotros</p>
          <h1 style="margin:8px 0 0;font-size:22px;color:#ffffff;">La Quiniela · Jornada ${jornada}</h1>
          <p style="margin:10px 0 0;font-size:14px;line-height:1.55;color:#9aa4ae;">
            Hoy a las <strong style="color:#ffffff;">${HORA_CIERRE}:00</strong> se cierra el plazo.
            Lo que no esté puesto para entonces cuenta como fallo, así que si te falta alguno, ahora es el momento.
          </p>
        </td></tr>

        <tr><td style="padding:18px 24px 0;">
          <p style="margin:0 0 8px;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#5b6570;">Los ${partidos.length} partidos</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;">${lista}</table>
        </td></tr>

        <tr><td style="padding:20px 24px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0e1318;border-left:3px solid ${ORO};border-radius:6px;">
            <tr><td style="padding:14px 16px;">
              <p style="margin:0;font-size:14px;line-height:1.6;color:#e6edf3;font-style:italic;">«${frase.texto}»</p>
              <p style="margin:8px 0 0;font-size:12px;color:${ORO};">${frase.autor}</p>
              <p style="margin:2px 0 0;font-size:11px;color:#5b6570;">${frase.quien}</p>
            </td></tr>
          </table>
        </td></tr>

        <tr><td style="padding:22px 24px 26px;">
          <a href="${origen}/quiniela" style="display:inline-block;background:${ORO};color:#000000;text-decoration:none;font-size:14px;font-weight:bold;padding:11px 20px;border-radius:9px;">Rellenar mi quiniela</a>
          <p style="margin:14px 0 0;font-size:11px;color:#5b6570;">Se cierra el ${cierre}. Después ya no se puede tocar.</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body></html>`;

  const texto = [
    `LA QUINIELA · JORNADA ${jornada}`,
    "",
    `Hoy a las ${HORA_CIERRE}:00 se cierra el plazo. Lo que no esté puesto cuenta como fallo.`,
    "",
    `Los ${partidos.length} partidos:`,
    ...partidos.map((uno) => `  ${uno.local} - ${uno.visitante}`),
    "",
    `«${frase.texto}»`,
    `${frase.autor} — ${frase.quien}`,
    "",
    `Se cierra el ${cierre}.`,
    `Rellenar: ${origen}/quiniela`,
  ].join("\n");

  return {
    asunto: `Quiniela J${jornada}: hoy a las ${HORA_CIERRE}:00 se cierra`,
    html,
    texto,
  };
}

/* ------------------------------------------------------------------ */
/*  LA LLAMADA                                                         */
/* ------------------------------------------------------------------ */

export async function GET(request: NextRequest) {
  const probar = request.nextUrl.searchParams.get("probar") === "1";

  if (!autorizado(request)) {
    return NextResponse.json(
      { ok: false, error: "No autorizado." },
      { status: 401 },
    );
  }

  const ahora = enMadrid(new Date());

  /* Sólo los viernes, y sólo a la hora del aviso. */
  const aHora = ahora.diaSemana === 5 && ahora.hora === HORA_AVISO;

  if (!aHora && !probar) {
    return NextResponse.json({
      ok: true,
      mandado: false,
      motivo: `En Madrid son las ${ahora.hora}:${String(ahora.minuto).padStart(2, "0")} del día ${ahora.diaSemana}. El aviso sale los viernes a las ${HORA_AVISO}:00.`,
    });
  }

  const jornada = probar
    ? (jornadaQueCierraEl(ahora.fecha, JORNADAS) ?? JORNADAS[0])
    : jornadaQueCierraEl(ahora.fecha, JORNADAS);

  if (!jornada) {
    return NextResponse.json({
      ok: true,
      mandado: false,
      motivo: `Ningún viernes de jornada cae en ${ahora.fecha}.`,
    });
  }

  const correo = armaCorreo(jornada, viernesDe(jornada), request.nextUrl.origin);

  /* Quién recibe: los que se han registrado. */
  const { data: cuentas } = await readDoc<DocumentoCuentas>(CLAVE_CUENTAS);

  const para = correosDe(cuentas?.cuentas ? cuentas : CUENTAS_VACIAS);

  if (probar) {
    return NextResponse.json({
      ok: true,
      mandado: false,
      probando: true,
      jornada,
      destinatarios: para.length,
      asunto: correo.asunto,
      texto: correo.texto,
    });
  }

  if (para.length === 0) {
    return NextResponse.json({
      ok: true,
      mandado: false,
      motivo: "Todavía no se ha registrado nadie.",
    });
  }

  /* ¿Ya se avisó de esta jornada? El cron puede repetirse. */
  const { data: quiniela } = await readDoc<DocumentoQuiniela>(CLAVE_QUINIELA);

  const doc = sinCastilla({ ...QUINIELA_VACIA, ...(quiniela ?? {}) });

  const avisadas = doc.avisadas ?? [];

  if (avisadas.includes(jornada)) {
    return NextResponse.json({
      ok: true,
      mandado: false,
      motivo: `La jornada ${jornada} ya se avisó.`,
    });
  }

  const { id } = await envia({ para, ...correo });

  await writeDoc(CLAVE_QUINIELA, "quiniela", {
    ...doc,
    avisadas: [...avisadas, jornada],
  });

  return NextResponse.json({
    ok: true,
    mandado: true,
    jornada,
    destinatarios: para.length,
    id,
  });
}
