import { readDoc, writeDoc } from "@/lib/docStore";
import { traePaginaConFetch, traeResultados } from "./besoccer";
import { sinCastilla } from "./migracion";
import {
  JORNADAS,
  QUINIELA_VACIA,
  jornadaDeHoy,
  jornadaVacia,
  partidosDe,
  type DocumentoQuiniela,
  type Signo,
} from "./modelo";

/**
 * PONER LOS RESULTADOS DE LA QUINIELA, DESDE EL SERVIDOR.
 *
 * Lo mismo que hace el script del ordenador del club, pero en una función que
 * pueden llamar dos puertas: el **botón de Ajustes** —alguien que ha entrado—
 * y el **cron nocturno** de Vercel. Con el cron, los resultados se ponen solos
 * aunque el ordenador del club esté apagado, que era el punto flojo de hacerlo
 * sólo allí.
 *
 * Se descubrió el 18/09/2026 que **BeSoccer sí contesta a Vercel** (200). Lo
 * que está cerrado es el runner de GitHub, que fue donde se midió el 406 en
 * septiembre. Si algún día deja de contestar, esto lo dice —`bloqueado`— y el
 * camino del ordenador del club sigue ahí.
 */

const CLAVE = "quiniela";

export type ParteJornada = {
  jornada: number;
  escritos: number;
  detalle: string[];
  saltada?: string;
};

export type ParteActualizacion = {
  cambios: number;
  bloqueado: boolean;
  jornadas: ParteJornada[];
};

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
 * Qué jornadas se miran: la de ahora **y la anterior**.
 *
 * Las dos, y no sólo la de hoy: el último partido de una jornada se juega el
 * domingo por la noche y para el lunes el calendario ya apunta a la siguiente,
 * así que la recién jugada se quedaría sin su último resultado.
 */
export function jornadasQueTocan(pedida?: number) {
  if (pedida && JORNADAS.includes(pedida)) return [pedida];

  const deHoy = jornadaDeHoy(hoyEnMadrid());

  return [deHoy - 1, deHoy].filter((numero) => JORNADAS.includes(numero));
}

export async function actualizaResultados(pedida?: number): Promise<ParteActualizacion> {
  const leido = await readDoc<DocumentoQuiniela>(CLAVE);

  const doc = sinCastilla({
    ...QUINIELA_VACIA,
    ...(leido.data ?? {}),
    jornadas: leido.data?.jornadas ?? {},
    jugadores: leido.data?.jugadores ?? [],
  });

  const jornadas: ParteJornada[] = [];

  /* Sólo lo que de verdad cambia este pase: al final se aplica sobre el
     documento recién leído, no sobre la copia de hace un minuto. */
  const puestos: { jornada: number; indice: number; signo: Signo }[] = [];

  let bloqueado = false;

  let cambios = 0;

  for (const numero of jornadasQueTocan(pedida)) {
    const guardada = doc.jornadas[String(numero)] ?? jornadaVacia(numero);

    /*
    | Una jornada que nadie apostó no se toca: no pronosticar cuenta como fallo
    | en cuanto el partido se juega, así que rellenar los resultados de una
    | jornada anterior a la quiniela pondría a todos con nueve fallos.
    */
    const apostaron = Object.values(guardada.pronosticos ?? {}).filter((suyos) =>
      (suyos ?? []).some(Boolean),
    ).length;

    if (apostaron === 0) {
      jornadas.push({
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

      jornadas.push({
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
        detalle.push(`${partido.local} - ${partido.visitante}: ${partido.nota ?? "sin resultado"}`);

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

      puestos.push({ jornada: numero, indice: partido.indice, signo: partido.signo });

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

    jornadas.push({ jornada: numero, escritos, detalle });
  }

  /*
  | RELEER ANTES DE ESCRIBIR, Y TOCAR SÓLO LOS RESULTADOS QUE CAMBIAN.
  |
  | Entre la lectura de arriba y este momento han pasado hasta dieciocho
  | páginas de BeSoccer: medio minuto largo. Guardar la copia de entonces
  | borraba en silencio cualquier apuesta guardada mientras tanto —y el
  | viernes por la mañana, con el aviso recién mandado, es exactamente cuando
  | la gente entra a rellenar—. Así que se relee y se aplican sólo los signos
  | que este pase ha puesto.
  */
  if (puestos.length > 0) {
    const ahora = await readDoc<DocumentoQuiniela>(CLAVE);

    const fresco = sinCastilla({
      ...QUINIELA_VACIA,
      ...(ahora.data ?? doc),
      jornadas: ahora.data?.jornadas ?? doc.jornadas,
      jugadores: ahora.data?.jugadores ?? doc.jugadores,
    });

    for (const { jornada, indice, signo } of puestos) {
      const clave = String(jornada);

      const previa = fresco.jornadas[clave] ?? jornadaVacia(jornada);

      const resultados = [...(previa.resultados ?? [])];

      while (resultados.length < partidosDe(jornada).length) resultados.push(null);

      resultados[indice] = signo;

      fresco.jornadas[clave] = {
        ...previa,
        jornada,
        resultados,
        resultadosEn: new Date().toISOString(),
        origenResultados: "besoccer",
      };
    }

    await writeDoc(CLAVE, "quiniela", fresco);
  }

  return { cambios, bloqueado, jornadas };
}
