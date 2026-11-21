/**
 * DEL CALENDARIO DE DIEZ AL DE NUEVE.
 *
 * El 17/09/2026 se quitaron del calendario los partidos del Castilla, y los
 * pronósticos y resultados se guardan **por posición** dentro de la jornada.
 * Para entonces ya había datos guardados con el calendario viejo —la jornada 4,
 * con la apuesta de Javier Padilla—: sin esto, todo lo que iba detrás del
 * partido del Castilla se correría un sitio y cada signo caería en el partido
 * de al lado.
 *
 * Se aplica **al leer y al guardar**, no una vez a mano, porque la versión
 * anterior de la pantalla sigue abierta en algún navegador hasta que se recarga
 * y puede volver a escribir con diez huecos después de cualquier arreglo
 * puntual.
 *
 * Es idempotente: sólo toca una lista que tenga **exactamente diez** huecos, que
 * sólo pudo escribirla el calendario viejo. Una de nueve se queda como está.
 */

import type { DocumentoQuiniela, JornadaQuiniela, Signo } from "./modelo";

/** Cuántos partidos tenía cada jornada con el Castilla dentro. */
const PARTIDOS_ANTES = 10;

/**
 * La posición (desde 0) que ocupaba el partido del Castilla en cada jornada del
 * calendario viejo. Sacada del `calendario.ts` anterior al cambio, contando.
 */
const POSICION_CASTILLA: Record<number, number> = {
  1: 9, 2: 6, 3: 0, 4: 7, 5: 8, 6: 6, 7: 5, 8: 7, 9: 1, 10: 7,
  11: 6, 12: 9, 13: 5, 14: 7, 15: 5, 16: 8, 17: 4, 18: 7, 19: 8, 20: 6,
  21: 2, 22: 7, 23: 7, 24: 7, 25: 3, 26: 7, 27: 9, 28: 8, 29: 1, 30: 0,
  31: 7, 32: 5, 33: 5, 34: 4, 35: 6, 36: 6, 37: 6, 38: 3,
};

function recorta(lista: (Signo | null)[], posicion: number) {
  if (!Array.isArray(lista) || lista.length !== PARTIDOS_ANTES) return lista;

  return lista.filter((_, indice) => indice !== posicion);
}

function migraJornada(clave: string, jornada: JornadaQuiniela): JornadaQuiniela {
  const posicion = POSICION_CASTILLA[Number(jornada?.jornada ?? clave)];

  if (posicion === undefined || !jornada) return jornada;

  return {
    ...jornada,
    resultados: recorta(jornada.resultados ?? [], posicion),
    pronosticos: Object.fromEntries(
      Object.entries(jornada.pronosticos ?? {}).map(([slug, signos]) => [
        slug,
        recorta(signos, posicion),
      ]),
    ),
  };
}

/*
| EL DOCUMENTO TROCEADO LETRA A LETRA (21/11/2026).
|
| El 20/11 el rescate de Supabase dejó la quiniela guardada como UN TEXTO con
| el JSON dentro. Antes de que `readDoc` aprendiera a leerlo (desdeTexto), una
| apuesta de la J13 pasó por `{ ...QUINIELA_VACIA, ...data }`: esparcir un
| texto da un objeto con una clave por letra («0»: "{", «1»: "\"", …), y se
| guardó así, con `jornadas` sólo con la J13. En pantalla el ranking y la
| comida desaparecieron: de la J4 a la J12 no quedaba nada a la vista.
|
| Pero nada se perdió: esas ~9.800 claves son, en orden, el documento entero.
| Aquí se vuelven a juntar, se lee lo que había y se funde con lo de ahora
| (lo de ahora manda; lo viejo rellena lo que falte). Se aplica al leer y al
| guardar: el primer guardado deja el documento limpio en la base.
*/
function juntaLetras(doc: Record<string, unknown>): Record<string, unknown> | null {
  if (!Object.prototype.hasOwnProperty.call(doc, "0")) return null;

  const letras: string[] = [];

  for (let i = 0; Object.prototype.hasOwnProperty.call(doc, String(i)); i += 1) {
    const letra = doc[String(i)];

    if (typeof letra !== "string" || letra.length !== 1) return null;

    letras.push(letra);
  }

  try {
    const dentro: unknown = JSON.parse(letras.join(""));

    return dentro && typeof dentro === "object" && !Array.isArray(dentro)
      ? (dentro as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function funde(vieja: JornadaQuiniela | undefined, nueva: JornadaQuiniela | undefined): JornadaQuiniela {
  if (!vieja) return nueva as JornadaQuiniela;
  if (!nueva) return vieja;

  const resultadosNuevos = nueva.resultados ?? [];
  const resultadosViejos = vieja.resultados ?? [];
  const largo = Math.max(resultadosNuevos.length, resultadosViejos.length);

  return {
    ...vieja,
    ...nueva,
    pronosticos: { ...(vieja.pronosticos ?? {}), ...(nueva.pronosticos ?? {}) },
    resultados: Array.from({ length: largo }, (_, i) => resultadosNuevos[i] ?? resultadosViejos[i] ?? null),
  };
}

export function recomponeTroceado(doc: DocumentoQuiniela): DocumentoQuiniela {
  const plano = doc as unknown as Record<string, unknown>;

  const dentro = juntaLetras(plano);

  if (!dentro) return doc;

  /* Por si se troceó más de una vez. */
  const viejo = recomponeTroceado(dentro as unknown as DocumentoQuiniela);

  const limpio = Object.fromEntries(Object.entries(plano).filter(([clave]) => !/^\d+$/.test(clave))) as unknown as DocumentoQuiniela;

  const claves = new Set([...Object.keys(viejo.jornadas ?? {}), ...Object.keys(limpio.jornadas ?? {})]);

  const unir = <T,>(a?: T[], b?: T[]) => (a || b ? [...new Set([...(a ?? []), ...(b ?? [])])] : undefined);

  return {
    ...viejo,
    ...limpio,
    jornadas: Object.fromEntries(
      [...claves].map((clave) => [clave, funde(viejo.jornadas?.[clave], limpio.jornadas?.[clave])]),
    ),
    jugadores: limpio.jugadores?.length ? limpio.jugadores : viejo.jugadores ?? [],
    extras: { ...(viejo.extras ?? {}), ...(limpio.extras ?? {}) },
    avisadas: unir(viejo.avisadas, limpio.avisadas),
    recordadas: unir(viejo.recordadas, limpio.recordadas),
  };
}

/** El documento con todas sus jornadas ya en el calendario de nueve. */
export function sinCastilla(entrada: DocumentoQuiniela): DocumentoQuiniela {
  const doc = recomponeTroceado(entrada);

  return {
    ...doc,
    jornadas: Object.fromEntries(
      Object.entries(doc.jornadas ?? {}).map(([clave, jornada]) => [
        clave,
        migraJornada(clave, jornada),
      ]),
    ),
  };
}
