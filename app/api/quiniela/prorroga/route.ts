/**
 * LA PRÓRROGA DE LA QUINIELA: DEJAR APOSTAR A QUIEN NO LO HIZO.
 *
 * Sólo el administrador, desde Ajustes (02/10/2026). La jornada se cierra el
 * viernes a las 12:00; con esto se reabre para unas personas concretas —las
 * que no tienen la apuesta completa— hasta la hora que se diga. Mientras la
 * tienen, ven la jornada como abierta: sin las apuestas de los demás. Ver
 * `estadoPara` en `lib/quiniela/cierre.ts`.
 *
 *   GET  → las jornadas cerradas recientes y la en curso, con quién ha
 *          apostado cuánto y la prórroga que haya
 *   POST { jornada, para: slug[], horas }  → abre (o cambia) la prórroga
 *   POST { jornada, cerrar: true }          → la cierra ya
 */

import { NextRequest, NextResponse } from "next/server";

import { COOKIE_ADMIN, esAdmin } from "@/lib/admin/sesion";
import { readDoc, writeDoc } from "@/lib/docStore";
import { estadoDe, viernesDe } from "@/lib/quiniela/cierre";
import { sinCastilla } from "@/lib/quiniela/migracion";
import {
  JORNADAS,
  QUINIELA_VACIA,
  jornadaVacia,
  partidosDe,
  prorrogaActiva,
  type DocumentoQuiniela,
  type JornadaQuiniela,
} from "@/lib/quiniela/modelo";
import { JUEGAN_POR_DEFECTO, PERSONA_POR_SLUG } from "@/lib/quiniela/staff";

export const dynamic = "force-dynamic";

const CLAVE = "quiniela";

const mal = (error: string, estado = 400) => NextResponse.json({ ok: false, error }, { status: estado });

const base = (data: DocumentoQuiniela | null): DocumentoQuiniela =>
  sinCastilla({
    ...QUINIELA_VACIA,
    ...(data ?? {}),
    jornadas: data?.jornadas ?? {},
    jugadores: data?.jugadores?.length ? data.jugadores : JUEGAN_POR_DEFECTO,
  });

export async function GET(request: NextRequest) {
  if (!esAdmin(request.cookies.get(COOKIE_ADMIN)?.value)) return mal("Sólo el administrador.", 403);

  const { data } = await readDoc<DocumentoQuiniela>(CLAVE);

  const doc = base(data);

  const ahora = new Date();

  /*
  | Las que interesan: la que está abierta ahora y las cerradas de las dos
  | últimas semanas (más atrás ya se habrán jugado y no tiene sentido).
  */
  const hoy = ahora.toISOString().slice(0, 10);

  const hace14 = new Date(ahora.getTime() - 14 * 86_400_000).toISOString().slice(0, 10);

  const jornadas = JORNADAS.filter((n) => {
    const viernes = viernesDe(n);

    return viernes && viernes >= hace14 && viernes <= new Date(ahora.getTime() + 7 * 86_400_000).toISOString().slice(0, 10);
  }).map((n) => {
    const j = doc.jornadas[String(n)] ?? jornadaVacia(n);

    const total = partidosDe(n).length;

    const estado = estadoDe(n, ahora);

    return {
      jornada: n,
      viernes: viernesDe(n),
      cerrada: estado.cerrada,
      partidos: total,
      jugadores: doc.jugadores.map((slug) => ({
        slug,
        nombre: PERSONA_POR_SLUG.get(slug)?.nombre ?? slug,
        puestos: (j.pronosticos[slug] ?? []).filter(Boolean).length,
        conProrroga: prorrogaActiva(j.prorroga, slug, ahora),
      })),
      prorroga: j.prorroga && Date.parse(j.prorroga.hasta) > ahora.getTime() ? j.prorroga : null,
    };
  });

  return NextResponse.json({ ok: true, hoy, jornadas });
}

export async function POST(request: NextRequest) {
  if (!esAdmin(request.cookies.get(COOKIE_ADMIN)?.value)) return mal("Sólo el administrador.", 403);

  const cuerpo = (await request.json().catch(() => ({}))) as {
    jornada?: unknown;
    para?: unknown;
    horas?: unknown;
    cerrar?: unknown;
  };

  const numero = Number(cuerpo.jornada);

  if (!JORNADAS.includes(numero)) return mal("Esa jornada no existe.");

  const cerrar = cuerpo.cerrar === true;

  const para = Array.isArray(cuerpo.para)
    ? [...new Set(cuerpo.para.map(String).filter((s) => PERSONA_POR_SLUG.has(s)))]
    : [];

  const horas = Number(cuerpo.horas);

  if (!cerrar && (!para.length || !Number.isFinite(horas) || horas <= 0 || horas > 72)) {
    return mal("Elige al menos una persona y cuántas horas (hasta 72).");
  }

  /* Leer → cambiar → escribir «basada en», como `/api/quiniela/guardar`: sin
     esto, una apuesta que entrara a la vez se perdería. */
  for (let intento = 0; intento < 3; intento += 1) {
    const leido = await readDoc<DocumentoQuiniela>(CLAVE);

    const doc = base(leido.data);

    const previa = doc.jornadas[String(numero)] ?? jornadaVacia(numero);

    const { prorroga: _vieja, ...sinProrroga } = previa;

    void _vieja;

    const jornada: JornadaQuiniela = cerrar
      ? sinProrroga
      : {
          ...previa,
          prorroga: {
            para,
            hasta: new Date(Date.now() + horas * 3_600_000).toISOString(),
            abiertaEn: new Date().toISOString(),
          },
        };

    const nuevo: DocumentoQuiniela = { ...doc, jornadas: { ...doc.jornadas, [String(numero)]: jornada } };

    const escrito = await writeDoc(CLAVE, "quiniela", nuevo, leido.updatedAt ?? null);

    if (escrito.missingTable) return mal("Falta la tabla de documentos.", 503);

    if (!escrito.conflicto) return NextResponse.json({ ok: true, prorroga: jornada.prorroga ?? null });
  }

  return mal("Hay otra persona guardando a la vez. Inténtalo otra vez.", 409);
}
