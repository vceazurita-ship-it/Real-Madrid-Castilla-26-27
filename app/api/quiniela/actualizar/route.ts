/**
 * ACTUALIZAR LOS RESULTADOS DESDE LA APP.
 *
 * Es lo que hace el botón de Ajustes. Lo mismo que el trabajo nocturno, pero
 * pedido a mano: se lee de BeSoccer el 1-X-2 de los partidos de la jornada y se
 * escribe en el documento.
 *
 * **Puede no poder.** BeSoccer contesta 403 o 406 a las IP de centro de datos,
 * y esto corre en Vercel. Cuando eso pasa no se calla ni se inventa nada: la
 * respuesta lo dice, el botón lo explica y queda el camino de siempre —el
 * ordenador del club, que tiene una conexión normal y lo hace cada noche—.
 *
 * **No se toca una jornada que nadie apostó**, por la misma razón que el
 * script: no pronosticar cuenta como fallo en cuanto el partido se juega, así
 * que rellenar los resultados de una jornada anterior a la quiniela dejaría a
 * los diez con nueve fallos.
 */

import { NextRequest, NextResponse } from "next/server";

import { readDoc, writeDoc } from "@/lib/docStore";
import { traePaginaConFetch, traeResultados } from "@/lib/quiniela/besoccer";
import { sinCastilla } from "@/lib/quiniela/migracion";
import {
  JORNADAS,
  QUINIELA_VACIA,
  jornadaDeHoy,
  jornadaVacia,
  partidosDe,
  type DocumentoQuiniela,
} from "@/lib/quiniela/modelo";
import { COOKIE, leeSesion } from "@/lib/quiniela/sesion";
import { PERSONA_POR_SLUG } from "@/lib/quiniela/staff";

export const dynamic = "force-dynamic";

/* Nueve páginas de BeSoccer, de una en una: hay que darle margen. */
export const maxDuration = 60;

const CLAVE = "quiniela";

/** Hoy, en Madrid, en "2026-09-19". */
function hoyEnMadrid() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * ¿Puede este servidor leer BeSoccer?
 *
 * Pide **una** página y devuelve el código que contesta. Sirve para saber, sin
 * escribir nada y sin tener que entrar, si el botón de Ajustes va a poder
 * hacer su trabajo o si BeSoccer está cerrando la puerta a la IP de Vercel.
 *
 * Va sin sesión a propósito: lo único que se aprende llamándola es un número
 * de tres cifras sobre una web pública.
 */
export async function GET() {
  const { estado } = await traePaginaConFetch(
    "https://es.besoccer.com/equipo/partidos/teruel",
  );

  return NextResponse.json({
    ok: true,
    estado,
    puede: estado === 200,
    dice:
      estado === 200
        ? "BeSoccer contesta desde el servidor: el botón puede actualizar al momento."
        : `BeSoccer contesta ${estado} desde el servidor: los resultados los tendrá que poner el ordenador del club.`,
  });
}

export async function POST(request: NextRequest) {
  const slug = leeSesion(request.cookies.get(COOKIE)?.value);

  if (!slug || !PERSONA_POR_SLUG.has(slug)) {
    return NextResponse.json(
      { ok: false, error: "Entra con tu correo para poder actualizar." },
      { status: 401 },
    );
  }

  const pedida = Number(request.nextUrl.searchParams.get("jornada"));

  /*
  | La de ahora y la anterior.
  |
  | Las dos, y no sólo la de hoy: el último partido de una jornada se juega el
  | domingo por la noche y para el lunes el calendario ya apunta a la
  | siguiente, así que la recién jugada se quedaría sin su último resultado.
  */
  const deHoy = jornadaDeHoy(hoyEnMadrid());

  const jornadas = JORNADAS.includes(pedida)
    ? [pedida]
    : [deHoy - 1, deHoy].filter((numero) => JORNADAS.includes(numero));

  let doc: DocumentoQuiniela;

  try {
    const leido = await readDoc<DocumentoQuiniela>(CLAVE);

    doc = sinCastilla({
      ...QUINIELA_VACIA,
      ...(leido.data ?? {}),
      jornadas: leido.data?.jornadas ?? {},
      jugadores: leido.data?.jugadores ?? [],
    });
  } catch (error) {
    console.error("[quiniela] actualizar · leer", error);

    return NextResponse.json(
      { ok: false, error: "No se ha podido leer la quiniela." },
      { status: 503 },
    );
  }

  const parte: {
    jornada: number;
    escritos: number;
    detalle: string[];
    saltada?: string;
  }[] = [];

  let bloqueado = false;

  let cambios = 0;

  for (const numero of jornadas) {
    const guardada = doc.jornadas[String(numero)] ?? jornadaVacia(numero);

    const apostaron = Object.values(guardada.pronosticos ?? {}).filter((suyos) =>
      (suyos ?? []).some(Boolean),
    ).length;

    if (apostaron === 0) {
      parte.push({
        jornada: numero,
        escritos: 0,
        detalle: [],
        saltada: "no la apostó nadie",
      });

      continue;
    }

    const lectura = await traeResultados(numero, traePaginaConFetch);

    if (lectura.bloqueado) {
      bloqueado = true;

      parte.push({
        jornada: numero,
        escritos: 0,
        detalle: [],
        saltada: `BeSoccer no contesta desde el servidor (${[...new Set(lectura.estados)].join(", ")})`,
      });

      continue;
    }

    const resultados = [...(guardada.resultados ?? [])];

    while (resultados.length < partidosDe(numero).length) resultados.push(null);

    const detalle: string[] = [];

    let escritos = 0;

    for (const partido of lectura.partidos) {
      if (!partido.signo) {
        detalle.push(
          `${partido.local} - ${partido.visitante}: ${partido.nota ?? "sin resultado"}`,
        );

        continue;
      }

      const previo = resultados[partido.indice] ?? null;

      if (previo === partido.signo) continue;

      detalle.push(
        `${partido.local} ${partido.marcador} ${partido.visitante} → ${partido.signo}${
          previo ? ` (estaba «${previo}»)` : ""
        }`,
      );

      resultados[partido.indice] = partido.signo;

      escritos += 1;
    }

    if (escritos > 0) {
      doc.jornadas[String(numero)] = {
        ...guardada,
        jornada: numero,
        resultados,
        resultadosEn: new Date().toISOString(),
        origenResultados: "besoccer",
      };

      cambios += escritos;
    }

    parte.push({ jornada: numero, escritos, detalle });
  }

  if (cambios > 0) {
    try {
      await writeDoc(CLAVE, "quiniela", doc);
    } catch (error) {
      console.error("[quiniela] actualizar · guardar", error);

      return NextResponse.json(
        { ok: false, error: "Se ha leído BeSoccer pero no se ha podido guardar." },
        { status: 503 },
      );
    }
  }

  return NextResponse.json({ ok: true, cambios, bloqueado, jornadas: parte });
}
