/**
 * ESCRIBIR EN LAS HOJAS DE ABP DESDE LA APP.
 *
 * Hasta ahora las cuatro pestañas de balón parado sólo se leían: la app se
 * baja el CSV publicado y no hay por dónde escribir. Esto abre esa puerta, con
 * el mismo patrón que ya usa la hoja RIVALES.
 *
 * ---------------------------------------------------------------------------
 * CÓMO SE INSTALA (una vez, cinco minutos)
 * ---------------------------------------------------------------------------
 * 1. Abre el libro de ABP en Google Sheets.
 * 2. Extensiones -> Apps Script. Borra lo que haya y pega este fichero entero.
 * 3. Guarda. Implementar -> Nueva implementación -> tipo «Aplicación web».
 *      - «Ejecutar como»: Yo
 *      - «Quién tiene acceso»: Cualquier usuario
 * 4. Copia la URL que acaba en /exec y pégala en `lib/abp/sheets.ts`, en
 *    `ABP_ESCRITURA_URL`.
 *
 * ---------------------------------------------------------------------------
 * POR QUÉ ESTÁ ESCRITO ASÍ
 * ---------------------------------------------------------------------------
 * - **El cuerpo llega como JSON, no como formulario.** Es el mismo error que
 *   tumbó el guardado de RIVALES en septiembre: un `URLSearchParams` revienta
 *   en el `JSON.parse` y la hoja contesta con un SyntaxError que no dice nada.
 *   Aquí se lee `e.postData.contents` y se avisa claro si no es JSON.
 *
 * - **Se escribe por NOMBRE DE COLUMNA, nunca por posición.** Las hojas de ABP
 *   no tienen las mismas columnas ni en el mismo orden, y alguien añade una
 *   columna en medio cada dos por tres. Lo que no encuentre cabecera se
 *   devuelve en `ignoradas` en vez de tragárselo en silencio: quien llama
 *   puede comprobarlo.
 *
 * - **Una sola escritura con `setValues`, no un `appendRow` por fila.** Con
 *   treinta y siete filas, `appendRow` tarda lo suyo y puede pasarse del
 *   tiempo de ejecución. Y se escribe sólo el rango nuevo: si la hoja tiene
 *   columnas con fórmula, un `setValues` del rango entero se las cargaría.
 *
 * - **`LockService`**: dos pasadas a la vez —el vigía y una persona— podrían
 *   calcular la misma última fila y pisarse.
 */

/** Las pestañas que se dejan tocar, por su gid. Nada más. */
var HOJAS = {
  '675048698': 'piezas ofensivo',
  '1071911136': 'piezas defensivo',
  '1484189905': 'banda ofensivo',
  '1250621633': 'banda defensivo'
};

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return responde({ success: false, error: 'Sin cuerpo. Manda JSON.' });
    }

    var datos;

    try {
      datos = JSON.parse(e.postData.contents);
    } catch (err) {
      return responde({
        success: false,
        error: 'El cuerpo no es JSON. Manda JSON, no un formulario.'
      });
    }

    if (datos.action === 'anadirFilas') return anadirFilas(datos);
    if (datos.action === 'ping') return responde({ success: true, hojas: HOJAS });

    return responde({ success: false, error: 'Acción desconocida: ' + datos.action });
  } catch (err) {
    return responde({ success: false, error: String(err) });
  }
}

/**
 * Añade filas al final de una pestaña.
 *
 * Espera: { action:'anadirFilas', gid:'1484189905', filas:[ {columna: valor} ] }
 */
function anadirFilas(datos) {
  var gid = String(datos.gid || '');

  if (!HOJAS[gid]) {
    return responde({ success: false, error: 'gid no permitido: ' + gid });
  }

  var filas = datos.filas;

  if (!filas || !filas.length) {
    return responde({ success: false, error: 'No vienen filas.' });
  }

  var bloqueo = LockService.getDocumentLock();

  if (!bloqueo.tryLock(30000)) {
    return responde({ success: false, error: 'La hoja está ocupada. Reintenta.' });
  }

  try {
    var hoja = porGid(gid);

    if (!hoja) return responde({ success: false, error: 'No encuentro la pestaña.' });

    var cabecera = hoja
      .getRange(1, 1, 1, hoja.getLastColumn())
      .getValues()[0]
      .map(function (c) { return String(c).trim(); });

    /* Lo que no tenga cabecera se devuelve, no se pierde en silencio. */
    var ignoradas = {};

    var matriz = filas.map(function (fila) {
      Object.keys(fila).forEach(function (k) {
        if (cabecera.indexOf(k) < 0) ignoradas[k] = true;
      });

      return cabecera.map(function (col) {
        var v = fila[col];

        return v === undefined || v === null ? '' : v;
      });
    });

    var desde = hoja.getLastRow() + 1;

    hoja
      .getRange(desde, 1, matriz.length, cabecera.length)
      .setValues(matriz);

    SpreadsheetApp.flush();

    return responde({
      success: true,
      hoja: HOJAS[gid],
      escritas: matriz.length,
      desdeLaFila: desde,
      ignoradas: Object.keys(ignoradas)
    });
  } finally {
    bloqueo.releaseLock();
  }
}

/** La pestaña que tiene ese gid. */
function porGid(gid) {
  var todas = SpreadsheetApp.getActiveSpreadsheet().getSheets();

  for (var i = 0; i < todas.length; i++) {
    if (String(todas[i].getSheetId()) === String(gid)) return todas[i];
  }

  return null;
}

function responde(objeto) {
  return ContentService
    .createTextOutput(JSON.stringify(objeto))
    .setMimeType(ContentService.MimeType.JSON);
}
