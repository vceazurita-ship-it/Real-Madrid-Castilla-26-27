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
 * **Con `CRON_SECRET` dado de alta en Vercel**, que es como debe estar: Vercel
 * lo manda solo en la cabecera `Authorization: Bearer …` de cada invocación y
 * aquí se compara. Sin eso, cualquiera que supiera la dirección podría
 * disparar el correo a todo el cuerpo técnico.
 *
 * **Y si no lo está**, en vez de dejar el aviso muerto se acepta la llamada
 * cuando trae `x-vercel-cron-schedule`, la cabecera que Vercel pone en **todas**
 * las invocaciones de cron y que sirve además para saber cuál de los dos
 * disparos —07:00 o 08:00 UTC— es éste. No es tan bueno como el secreto: esa
 * cabecera la puede escribir cualquiera desde fuera. Lo que puede conseguir
 * quien lo intente está acotado a propósito: el correo sale **sólo los viernes
 * a las 9 de Madrid**, **una vez por jornada** —queda apuntado en `avisadas`—
 * y **sólo a quien se haya registrado**. O sea, adelantar un correo que iba a
 * salir de todas formas dentro de esa misma hora.
 *
 * La respuesta dice por cuál de las dos vías ha entrado, para que se vea en
 * los registros de Vercel mientras el secreto no esté puesto.
 */
type Entrada = { vale: boolean; via: "secreto" | "cabecera" | "ninguna" };

function autorizado(request: NextRequest): Entrada {
  const secreto = process.env.CRON_SECRET;

  if (secreto) {
    const cabecera = request.headers.get("authorization") ?? "";

    return {
      vale: cabecera === `Bearer ${secreto}`,
      via: cabecera === `Bearer ${secreto}` ? "secreto" : "ninguna",
    };
  }

  const deVercel = request.headers.get("x-vercel-cron-schedule");

  return deVercel
    ? { vale: true, via: "cabecera" }
    : { vale: false, via: "ninguna" };
}

/* ------------------------------------------------------------------ */
/*  EL CORREO                                                          */
/* ------------------------------------------------------------------ */

/**
 * El correo lleva el enlace a la pantalla. Se saca de la dirección por la que
 * ha entrado el cron, no de un dominio escrito a mano: el primero que se puso
 * no era el de la aplicación y el botón del correo daba 404.
 */
function armaCorreo(
  jornada: number,
  viernes: string | null,
  origen: string,
  /* El recordatorio del miércoles y del jueves (29/10/2026): días que
     faltan para el cierre y cuántos partidos le faltan a esa persona. */
  recordatorio?: { dias: number; faltan: number },
) {
  const partidos = partidosDe(jornada);

  const cuando = recordatorio
    ? recordatorio.dias === 1
      ? `Mañana viernes a las ${HORA_CIERRE}:00`
      : `El viernes a las ${HORA_CIERRE}:00`
    : `Hoy a las ${HORA_CIERRE}:00`;

  const falta = recordatorio
    ? recordatorio.faltan === partidos.length
      ? "Todavía no has hecho tu apuesta."
      : `Te ${recordatorio.faltan === 1 ? "falta 1 partido" : `faltan ${recordatorio.faltan} partidos`} de ${partidos.length}.`
    : "";

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
            ${falta ? `<strong style="color:#ffffff;">${falta}</strong> ` : ""}${cuando.replace(`${HORA_CIERRE}:00`, `<strong style="color:#ffffff;">${HORA_CIERRE}:00</strong>`)} se cierra el plazo.
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
    ...(falta ? [falta] : []),
    `${cuando} se cierra el plazo. Lo que no esté puesto cuenta como fallo.`,
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
    asunto: recordatorio
      ? `Recordatorio · Quiniela J${jornada}: ${cuando.toLowerCase()} se cierra y te falta tu apuesta`
      : `Quiniela J${jornada}: hoy a las ${HORA_CIERRE}:00 se cierra`,
    html,
    texto,
  };
}

/* ------------------------------------------------------------------ */
/*  EL RECORDATORIO DEL MIÉRCOLES Y DEL JUEVES                         */
/* ------------------------------------------------------------------ */

/**
 * Un correo por persona, sólo a quien le falta algún partido de la jornada
 * (29/10/2026). Va uno a uno porque cada uno dice lo que le falta a él y
 * nadie ve el correo de los demás. Se apunta `${jornada}-${dias}` en
 * `recordadas` para que un reintento del cron no lo repita.
 */
async function recuerda(jornada: number, dias: number, origen: string, probar: boolean) {
  const { data: cuentas } = await readDoc<DocumentoCuentas>(CLAVE_CUENTAS);
  const { data: quiniela } = await readDoc<DocumentoQuiniela>(CLAVE_QUINIELA);

  const doc = sinCastilla({ ...QUINIELA_VACIA, ...(quiniela ?? {}) });
  const marca = `${jornada}-${dias}`;
  const total = partidosDe(jornada).length;
  const suyas = doc.jornadas[String(jornada)];

  if (suyas?.cerradaEn) {
    return NextResponse.json({ ok: true, mandado: false, motivo: `La jornada ${jornada} ya está cerrada.` });
  }

  const pendientes = Object.values(cuentas?.cuentas ?? {})
    .filter((una) => una.correo)
    .map((una) => ({
      correo: una.correo,
      faltan: total - (suyas?.pronosticos[una.slug] ?? []).filter(Boolean).length,
    }))
    .filter((una) => una.faltan > 0);

  if (probar) {
    const ejemplo = armaCorreo(jornada, viernesDe(jornada), origen, { dias, faltan: pendientes[0]?.faltan ?? total });

    return NextResponse.json({
      ok: true,
      mandado: false,
      probando: true,
      jornada,
      dias,
      destinatarios: pendientes.length,
      asunto: ejemplo.asunto,
      texto: ejemplo.texto,
    });
  }

  if ((doc.recordadas ?? []).includes(marca)) {
    return NextResponse.json({ ok: true, mandado: false, motivo: `El recordatorio ${marca} ya salió.` });
  }

  let mandados = 0;

  for (const una of pendientes) {
    try {
      await envia({ para: [una.correo], ...armaCorreo(jornada, viernesDe(jornada), origen, { dias, faltan: una.faltan }) });
      mandados += 1;
    } catch (error) {
      console.error("[quiniela] recordatorio a", una.correo, error);
    }
  }

  /* Releer antes de apuntar, por lo mismo que el aviso del viernes. */
  const { data: reciente } = await readDoc<DocumentoQuiniela>(CLAVE_QUINIELA);

  if (reciente) {
    const fresco = sinCastilla({ ...QUINIELA_VACIA, ...reciente });

    await writeDoc(CLAVE_QUINIELA, "quiniela", {
      ...fresco,
      recordadas: [...new Set([...(fresco.recordadas ?? []), marca])],
    });
  }

  return NextResponse.json({ ok: true, mandado: mandados > 0, jornada, dias, destinatarios: mandados });
}

/* ------------------------------------------------------------------ */
/*  LA LLAMADA                                                         */
/* ------------------------------------------------------------------ */

export async function GET(request: NextRequest) {
  const probar = request.nextUrl.searchParams.get("probar") === "1";

  const entrada = autorizado(request);

  if (!entrada.vale) {
    return NextResponse.json(
      { ok: false, error: "No autorizado." },
      { status: 401 },
    );
  }

  if (entrada.via === "cabecera") {
    console.warn(
      "[quiniela] el aviso ha entrado sin CRON_SECRET, sólo por la cabecera de cron de Vercel. Dar de alta CRON_SECRET en el proyecto y volver a desplegar.",
    );
  }

  const ahora = enMadrid(new Date());

  /*
  | Viernes: el aviso a todos. Miércoles y jueves (29/10/2026, lo pidió el
  | analista): un recordatorio, dos días y un día antes del cierre, sólo a
  | quien no ha completado su apuesta. `?dias=2|1` con `?probar=1` lo enseña.
  */
  const DIAS_ANTES: Record<number, number> = { 3: 2, 4: 1, 5: 0 };
  const pedidos = Number(request.nextUrl.searchParams.get("dias"));
  const dias = probar && [0, 1, 2].includes(pedidos) ? pedidos : DIAS_ANTES[ahora.diaSemana];

  const aHora = dias !== undefined && ahora.hora === HORA_AVISO;

  if (!aHora && !probar) {
    return NextResponse.json({
      ok: true,
      mandado: false,
      motivo: `En Madrid son las ${ahora.hora}:${String(ahora.minuto).padStart(2, "0")} del día ${ahora.diaSemana}. El aviso sale miércoles, jueves y viernes a las ${HORA_AVISO}:00.`,
    });
  }

  /* El viernes del cierre: hoy más los días que faltan. */
  const [a, m, d] = ahora.fecha.split("-").map(Number);
  const fechaCierre = new Date(Date.UTC(a, m - 1, d + (dias ?? 0))).toISOString().slice(0, 10);

  const jornada = probar
    ? (jornadaQueCierraEl(fechaCierre, JORNADAS) ?? JORNADAS[0])
    : jornadaQueCierraEl(fechaCierre, JORNADAS);

  if (jornada && dias) return recuerda(jornada, dias, request.nextUrl.origin, probar);

  if (!jornada) {
    return NextResponse.json({
      ok: true,
      mandado: false,
      motivo: `Ningún viernes de jornada cae en ${fechaCierre}.`,
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

  /*
  | RELEER ANTES DE APUNTAR QUE SE AVISÓ.
  |
  | Entre la lectura de arriba y esta línea se ha mandado un correo por Gmail:
  | segundos. Y son las nueve de la mañana del viernes, que es justo cuando la
  | gente entra a rellenar **porque acaba de recibir ese correo**. Guardando la
  | copia de antes, la apuesta de quien fuera rápido desaparecía sin que nadie
  | se enterara: la pantalla ya había dicho «guardada».
  |
  | Y si la relectura no trae documento, no se escribe nada: mejor un aviso
  | repetido la próxima vez que dejar la temporada en blanco.
  */
  const { data: reciente } = await readDoc<DocumentoQuiniela>(CLAVE_QUINIELA);

  if (reciente) {
    const fresco = sinCastilla({ ...QUINIELA_VACIA, ...reciente });

    await writeDoc(CLAVE_QUINIELA, "quiniela", {
      ...fresco,
      avisadas: [...new Set([...(fresco.avisadas ?? []), jornada])],
    });
  } else {
    console.error("[quiniela] aviso: la relectura no trae documento; no se apunta la jornada.");
  }

  return NextResponse.json({
    ok: true,
    mandado: true,
    jornada,
    destinatarios: para.length,
    id,
  });
}
