/**
 * GUARDAR EN LA QUINIELA.
 *
 * Todo lo que se escribe en el documento `quiniela` pasa por aquí, y **sólo por
 * aquí**: `/api/docs` se niega a escribir esa clave. Hay dos motivos, y los dos
 * son la razón de que exista esta ruta:
 *
 * - **Quién eres y a qué hora lo dice el servidor.** Si la pantalla guardase el
 *   documento entero, el cierre del viernes y el «cada uno lo suyo» serían un
 *   botón deshabilitado y nada más: con la consola abierta se rellenaba la de
 *   otro, o la propia el domingo con los resultados delante.
 * - **Nadie pisa a nadie.** Guardar el documento entero desde el navegador es
 *   escribir la copia que ese navegador tenía al cargar: si dos personas ponen
 *   su apuesta a la vez, la segunda borra la de la primera sin enterarse. Aquí
 *   cada acción lee el documento de ese momento, cambia **sólo su trozo** y lo
 *   devuelve entero para que la pantalla se ponga al día.
 *
 * Las acciones:
 *
 * - `apuesta` — los pronósticos de quien ha entrado para una jornada. Se
 *   rechaza si la jornada está cerrada (viernes 12:00, hora de Madrid).
 * - `resultado` — el signo de un partido. Cualquiera que haya entrado.
 * - `extras` — la canción, la frase y la foto de broma **propias**.
 * - `jugadores` — quién juega esta temporada.
 */

import { NextRequest, NextResponse } from "next/server";

import { readDoc, writeDoc } from "@/lib/docStore";
import { estadoDe, cuandoCierra } from "@/lib/quiniela/cierre";
import {
  JORNADAS,
  QUINIELA_VACIA,
  esSigno,
  jornadaVacia,
  partidosDe,
  type DocumentoQuiniela,
  type ExtrasJugador,
  type Signo,
} from "@/lib/quiniela/modelo";
import { sinCastilla } from "@/lib/quiniela/migracion";
import { COOKIE, leeSesion } from "@/lib/quiniela/sesion";
import { JUEGAN_POR_DEFECTO, PERSONA_POR_SLUG } from "@/lib/quiniela/staff";

export const dynamic = "force-dynamic";

const CLAVE_QUINIELA = "quiniela";

const mal = (error: string, estado = 400) =>
  NextResponse.json({ ok: false, error }, { status: estado });

/** Un texto de los extras, recortado: es una broma, no un documento. */
function texto(valor: unknown, maximo: number) {
  return String(valor ?? "").trim().slice(0, maximo);
}

/** Sólo direcciones web: un `javascript:` en el enlace de la canción, no. */
function enlace(valor: unknown) {
  const limpio = texto(valor, 500);

  return /^https?:\/\//i.test(limpio) ? limpio : "";
}

export async function POST(request: NextRequest) {
  const slug = leeSesion(request.cookies.get(COOKIE)?.value);

  if (!slug || !PERSONA_POR_SLUG.has(slug)) {
    return mal("Entra con tu correo para poder guardar.", 401);
  }

  let cuerpo: Record<string, unknown>;

  try {
    cuerpo = (await request.json()) as Record<string, unknown>;
  } catch {
    return mal("No se ha entendido la petición.");
  }

  const accion = String(cuerpo.accion ?? "");

  let data: DocumentoQuiniela | null;

  try {
    ({ data } = await readDoc<DocumentoQuiniela>(CLAVE_QUINIELA));
  } catch (error) {
    console.error("[quiniela] leer antes de guardar", error);

    return mal("No se ha podido leer la quiniela. Inténtalo en un momento.", 503);
  }

  /* Lo guardado con el calendario de diez se pasa al de nueve antes de tocarlo. */
  const base: DocumentoQuiniela = sinCastilla({
    ...QUINIELA_VACIA,
    ...(data ?? {}),
    jornadas: data?.jornadas ?? {},
    jugadores: data?.jugadores?.length ? data.jugadores : JUEGAN_POR_DEFECTO,
  });

  let nuevo: DocumentoQuiniela;

  /* --------------------------- LA APUESTA -------------------------- */

  if (accion === "apuesta" || accion === "resultado") {
    const jornada = Number(cuerpo.jornada);

    if (!JORNADAS.includes(jornada)) return mal("Esa jornada no existe.");

    const partidos = partidosDe(jornada).length;

    const previa = base.jornadas[String(jornada)] ?? jornadaVacia(jornada);

    if (accion === "apuesta") {
      const estado = estadoDe(jornada, new Date());

      if (estado.cerrada) {
        return mal(
          `La jornada ${jornada} se cerró el ${cuandoCierra(estado.viernes)}. Ya no se puede tocar.`,
          423,
        );
      }

      const signos = Array.isArray(cuerpo.signos) ? cuerpo.signos : null;

      if (!signos || signos.length !== partidos) {
        return mal("La apuesta no cuadra con los partidos de la jornada. Recarga la página.");
      }

      const limpios: (Signo | null)[] = signos.map((uno) => (esSigno(uno) ? uno : null));

      nuevo = {
        ...base,
        /* Quien apuesta, juega: si no estaba en la lista, entra. */
        jugadores: base.jugadores.includes(slug)
          ? base.jugadores
          : [...base.jugadores, slug],
        jornadas: {
          ...base.jornadas,
          [String(jornada)]: {
            ...previa,
            pronosticos: { ...previa.pronosticos, [slug]: limpios },
          },
        },
      };
    } else {
      const indice = Number(cuerpo.indice);

      if (!Number.isInteger(indice) || indice < 0 || indice >= partidos) {
        return mal("Ese partido no está en la jornada.");
      }

      const signo = esSigno(cuerpo.signo) ? cuerpo.signo : null;

      const resultados = [...previa.resultados];

      while (resultados.length < partidos) resultados.push(null);

      resultados[indice] = signo;

      nuevo = {
        ...base,
        jornadas: {
          ...base.jornadas,
          [String(jornada)]: { ...previa, resultados },
        },
      };
    }
  } else if (accion === "extras") {
    /* ---------------------------- LOS EXTRAS ------------------------- */

    const dados = (cuerpo.extras ?? {}) as Record<string, unknown>;

    const suyos: ExtrasJugador = {
      cancion: enlace(dados.cancion),
      cancionNombre: texto(dados.cancionNombre, 120),
      frase: texto(dados.frase, 280),
      foto: enlace(dados.foto),
    };

    /* Un campo vacío se borra en vez de guardarse en blanco. */
    for (const clave of Object.keys(suyos) as (keyof ExtrasJugador)[]) {
      if (!suyos[clave]) delete suyos[clave];
    }

    nuevo = { ...base, extras: { ...base.extras, [slug]: suyos } };
  } else if (accion === "jugadores") {
    /* --------------------------- QUIÉN JUEGA ------------------------- */

    const lista = Array.isArray(cuerpo.jugadores)
      ? [...new Set(cuerpo.jugadores.map(String))].filter((uno) =>
          PERSONA_POR_SLUG.has(uno),
        )
      : null;

    if (!lista || lista.length === 0) {
      return mal("Tiene que jugar al menos una persona.");
    }

    nuevo = { ...base, jugadores: lista };
  } else {
    return mal("No sé qué quieres guardar.");
  }

  try {
    const escrito = await writeDoc(CLAVE_QUINIELA, "quiniela", nuevo);

    if (escrito.missingTable) throw new Error("Falta la tabla app_documents.");
  } catch (error) {
    console.error("[quiniela] guardar", error);

    return mal("No se ha podido guardar. Inténtalo en un momento.", 503);
  }

  return NextResponse.json({ ok: true, doc: nuevo });
}
