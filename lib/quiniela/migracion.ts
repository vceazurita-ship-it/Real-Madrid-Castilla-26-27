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

/** El documento con todas sus jornadas ya en el calendario de nueve. */
export function sinCastilla(doc: DocumentoQuiniela): DocumentoQuiniela {
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
