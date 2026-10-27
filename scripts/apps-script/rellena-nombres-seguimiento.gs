/**
 * RELLENA EL NOMBRE DE LOS SEGUIMIENTOS QUE NO LO TIENEN (27/10/2026).
 *
 * Desde el 12/10/2026 ningún seguimiento nuevo lleva NOMBRE (y antes había
 * otros 55 sueltos): `crearSeguimiento` y `editarSeguimiento` del Apps Script
 * de la app no escriben esa columna aunque se la manden. Sin nombre, el
 * registro sólo se ata a su jugador por el ID, y la hoja JUGADORES renumera
 * los ID de vez en cuando.
 *
 * Cómo se usa (una vez):
 *   1. Abrir la hoja donde está la pestaña de seguimiento (la que tiene las
 *      columnas ID_REGISTRO, ID_JUGADOR y NOMBRE) → Extensiones → Apps Script.
 *   2. Archivo nuevo, pegar esto y guardar.
 *   3. Ejecutar `rellenaNombresSeguimiento` (pide permiso la primera vez).
 *      Escribe en el registro cuántos ha rellenado y cuáles no ha podido.
 *   4. Ejecutar `instalaRellenoDiario` para que lo haga solo cada noche.
 *
 * Sólo escribe en celdas de NOMBRE que están vacías; no toca nada más. Si la
 * pestaña JUGADORES está en otro libro, poner su ID en LIBRO_JUGADORES_ID.
 */

const LIBRO_JUGADORES_ID = ''; // vacío = el mismo libro

function rellenaNombresSeguimiento() {
  const libro = SpreadsheetApp.getActiveSpreadsheet();
  const libroJugadores = LIBRO_JUGADORES_ID ? SpreadsheetApp.openById(LIBRO_JUGADORES_ID) : libro;

  /* La pestaña de seguimiento: la que tiene esas tres columnas en la cabecera. */
  const hoja = libro.getSheets().find((h) => {
    const cab = cabecera_(h);
    return cab.includes('ID_REGISTRO') && cab.includes('ID_JUGADOR') && cab.includes('NOMBRE');
  });

  if (!hoja) throw new Error('No encuentro la pestaña con ID_REGISTRO, ID_JUGADOR y NOMBRE en este libro');

  const jugadores = libroJugadores.getSheetByName('JUGADORES');

  if (!jugadores) throw new Error('No encuentro la pestaña JUGADORES');

  /* ID → nombre, de la plantilla de hoy. */
  const cabJ = cabecera_(jugadores);
  const datosJ = jugadores.getDataRange().getValues().slice(1);
  const iId = cabJ.indexOf('ID_JUGADOR');
  const iNom = cabJ.indexOf('NOMBRE');
  const nombreDe = {};

  datosJ.forEach((fila) => {
    const id = String(fila[iId] || '').trim();
    const nombre = String(fila[iNom] || '').trim();
    if (id && nombre) nombreDe[id] = nombre;
  });

  /* Los ID que la app ya traduce (lib/fichajes.ts, IDS_ANTERIORES). */
  const ANTERIORES = { 'JUG-52': 'JUG-49', 'JUG-53': 'JUG-50', 'JUG-54': 'JUG-51' };

  const cab = cabecera_(hoja);
  const cId = cab.indexOf('ID_JUGADOR');
  const cNom = cab.indexOf('NOMBRE');
  const filas = hoja.getLastRow() - 1;

  if (filas < 1) return;

  /* Se lee y se escribe SÓLO la columna NOMBRE: el resto (fórmulas incluidas) no se toca. */
  const ids = hoja.getRange(2, cId + 1, filas, 1).getValues();
  const nombres = hoja.getRange(2, cNom + 1, filas, 1).getValues();

  let rellenados = 0;
  const sinJugador = [];

  for (let i = 0; i < filas; i += 1) {
    if (String(nombres[i][0] || '').trim()) continue;

    const id = String(ids[i][0] || '').trim();
    if (!id) continue;

    const nombre = nombreDe[ANTERIORES[id] || id];

    if (nombre) {
      nombres[i][0] = nombre;
      rellenados += 1;
    } else {
      sinJugador.push(`fila ${i + 2} (${id})`);
    }
  }

  if (rellenados) hoja.getRange(2, cNom + 1, filas, 1).setValues(nombres);

  Logger.log(`Rellenados ${rellenados} nombres en «${hoja.getName()}».`);
  if (sinJugador.length) Logger.log(`Sin jugador con ese ID en JUGADORES (se dejan vacíos): ${sinJugador.join(', ')}`);
}

/** Lo deja programado cada noche (entre las 3 y las 4), sin duplicar el disparador. */
function instalaRellenoDiario() {
  ScriptApp.getProjectTriggers()
    .filter((t) => t.getHandlerFunction() === 'rellenaNombresSeguimiento')
    .forEach((t) => ScriptApp.deleteTrigger(t));

  ScriptApp.newTrigger('rellenaNombresSeguimiento').timeBased().everyDays(1).atHour(3).create();

  Logger.log('Programado cada noche a las 3.');
}

function cabecera_(hoja) {
  if (hoja.getLastColumn() < 1) return [];
  return hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0].map((c) => String(c).trim().toUpperCase());
}
