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
 * PARA ACTUALIZARLO sin que cambie la URL: pega el fichero nuevo, guarda, y
 * Implementar -> Gestionar implementaciones -> lápiz -> Versión: «Nueva
 * versión» -> Implementar. Con «Nueva implementación» sale OTRA URL.
 * El `ping` devuelve `acciones`: si no aparece la que buscas, falta este paso.
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
    if (datos.action === 'actualizarFilas') return actualizarFilas(datos);
    if (datos.action === 'registroGuardar' || datos.action === 'registroFilas') return registro(datos);
    if (datos.action === 'ping') {
      return responde({
        success: true,
        hojas: HOJAS,
        acciones: ['anadirFilas', 'actualizarFilas', 'registroFilas', 'registroGuardar'],
        /* Sube cuando cambia cómo se escribe: así se ve desde fuera si está pegado. */
        version: 'registro-calculadas-1'
      });
    }

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

/**
 * Corrige filas que ya están escritas: las de un partido, en su orden.
 *
 * Espera: { action:'actualizarFilas', gid, clave:{JORNADA:'LIGA 05', Rival:'AD ALCORCÓN'},
 *           filas:[ {columna: valor} ] }
 *
 * Busca las filas cuya JORNADA y Rival coinciden con la clave y **sólo si hay
 * exactamente tantas como filas vienen** escribe, en orden, las columnas que
 * trae cada fila. Las demás celdas no se tocan —ni las fórmulas ni lo que haya
 * escrito a mano el cuerpo técnico en otras columnas—. Si el número no cuadra
 * no escribe nada: es la señal de que alguien ha añadido o borrado filas y hay
 * que mirarlo antes.
 */
function actualizarFilas(datos) {
  var gid = String(datos.gid || '');

  if (!HOJAS[gid]) return responde({ success: false, error: 'gid no permitido: ' + gid });

  var clave = datos.clave || {};
  var filas = datos.filas || [];

  if (!Object.keys(clave).length || !filas.length) {
    return responde({ success: false, error: 'Faltan la clave o las filas.' });
  }

  var bloqueo = LockService.getDocumentLock();

  if (!bloqueo.tryLock(30000)) {
    return responde({ success: false, error: 'La hoja está ocupada. Reintenta.' });
  }

  try {
    var hoja = porGid(gid);

    if (!hoja) return responde({ success: false, error: 'No encuentro la pestaña.' });

    var todo = hoja.getDataRange().getDisplayValues();
    var cabecera = todo[0].map(function (c) { return String(c).trim(); });

    var ignoradas = {};
    var claves = Object.keys(clave);

    for (var k = 0; k < claves.length; k++) {
      if (cabecera.indexOf(claves[k]) < 0) {
        return responde({ success: false, error: 'La clave usa una columna que no existe: ' + claves[k] });
      }
    }

    var encontradas = [];

    for (var r = 1; r < todo.length; r++) {
      var casa = claves.every(function (c) {
        return String(todo[r][cabecera.indexOf(c)]).trim() === String(clave[c]).trim();
      });

      if (casa) encontradas.push(r + 1);
    }

    if (encontradas.length !== filas.length) {
      return responde({
        success: false,
        error: 'En la hoja hay ' + encontradas.length + ' filas con esa clave y vienen ' + filas.length + '. No se toca nada.'
      });
    }

    var celdas = 0;

    filas.forEach(function (fila, i) {
      Object.keys(fila).forEach(function (col) {
        var c = cabecera.indexOf(col);

        if (c < 0) {
          ignoradas[col] = true;
          return;
        }

        hoja.getRange(encontradas[i], c + 1).setValue(fila[col] === null ? '' : fila[col]);
        celdas++;
      });
    });

    SpreadsheetApp.flush();

    return responde({
      success: true,
      hoja: HOJAS[gid],
      filas: encontradas,
      celdas: celdas,
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

/* ========================================================================== */
/*  REGISTRO DE TAREAS: CREAR Y EDITAR MICROCICLOS DESDE LA APP                */
/* ========================================================================== */
/*
| Vive aquí desde el 01/10/2026 porque la pestaña de registro de tareas está en
| ESTE libro. Antes era un .gs aparte que había que pegar en el script principal
| de RIVALES —que es de otro libro— y por eso el editor de microciclos nunca
| llegó a escribir: la hoja contestaba ACTION_NO_RECONOCIDA.
|
|   registroFilas   → las filas de un microciclo (para editarlo o comprobarlo)
|   registroGuardar → escribe o reescribe las filas de un microciclo
|
| POR QUÉ NO ES UN appendRow: tres columnas son fórmulas —«Carga Ponderada»,
| «Demanda Cognitiva» y «Carga cognitiva»—. Las filas nuevas se crean CLONANDO
| una fila con datos (arrastra fórmulas, formato y listas) y luego se escriben
| sólo las columnas de mano, por tramos, nunca con un setValues del rango
| entero (devolvería lo calculado y machacaría la fórmula).
|
| La cabecera NO está en la fila 1: encima hay un título del club. Se busca la
| fila cuya primera casilla es «Temporada».
*/

/** El identificador de la pestaña dentro del libro. */
var REGISTRO_GID = 111318766;

/** Las columnas que calcula la hoja: no se escriben nunca. */
var REGISTRO_CALCULADAS = ['Carga Ponderada', 'Carga cognitiva', 'Demanda Cognitiva'];

function registro(datos) {
  var salida;

  try {
    salida =
      datos.action === 'registroFilas'
        ? { ok: true, filas: filasDelMicro_(datos.temporada, Number(datos.micro)) }
        : guardaMicrociclo_(datos);
  } catch (error) {
    salida = { ok: false, error: String((error && error.message) || error) };
  }

  return responde(salida);
}

function hojaRegistro_() {
  var hoja = porGid(REGISTRO_GID);

  if (!hoja) throw new Error('No encuentro la pestaña de registro de tareas (gid ' + REGISTRO_GID + ').');

  return hoja;
}

/** La fila de cabeceras y sus nombres: encima hay un título del club. */
function cabecerasRegistro_(hoja) {
  var alto = Math.min(hoja.getLastRow(), 10);

  var arriba = hoja.getRange(1, 1, alto, hoja.getLastColumn()).getValues();

  for (var i = 0; i < arriba.length; i++) {
    var primera = String(arriba[i][0] || '').trim().toLowerCase();

    if (primera === 'temporada') {
      return { fila: i + 1, nombres: arriba[i].map(function (uno) { return String(uno || '').trim(); }) };
    }
  }

  throw new Error('No encuentro la fila de cabeceras («Temporada») en el registro de tareas.');
}

function indiceDeColumna_(nombres, nombre) {
  var buscado = String(nombre || '').trim().toLowerCase();

  for (var i = 0; i < nombres.length; i++) {
    if (nombres[i].toLowerCase() === buscado) return i;
  }

  return -1;
}

/** La última fila que es de verdad una tarea: tiene número de microciclo. */
function ultimaFilaDeDatos_(hoja, cabecera) {
  var desde = cabecera.fila + 1;

  var alto = hoja.getLastRow() - cabecera.fila;

  if (alto <= 0) return cabecera.fila;

  var colMicro = indiceDeColumna_(cabecera.nombres, 'Micro');

  var valores = hoja.getRange(desde, colMicro + 1, alto, 1).getValues();

  for (var i = valores.length - 1; i >= 0; i--) {
    if (Number(valores[i][0]) > 0) return desde + i;
  }

  return cabecera.fila;
}

/**
 * Las filas de un microciclo, con su número de fila.
 *
 * La fecha sale como «2026-09-20» en la zona horaria del libro: un objeto
 * Date viajaría como «2026-09-19T22:00:00.000Z» y el editor pondría la tarea
 * el día anterior.
 */
function filasDelMicro_(temporada, micro) {
  var hoja = hojaRegistro_();

  var cabecera = cabecerasRegistro_(hoja);

  var desde = cabecera.fila + 1;

  var alto = hoja.getLastRow() - cabecera.fila;

  if (alto <= 0) return [];

  var valores = hoja.getRange(desde, 1, alto, cabecera.nombres.length).getValues();

  var colTemporada = indiceDeColumna_(cabecera.nombres, 'Temporada');
  var colMicro = indiceDeColumna_(cabecera.nombres, 'Micro');

  var zona = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();

  var salida = [];

  for (var i = 0; i < valores.length; i++) {
    var fila = valores[i];

    if (Number(fila[colMicro]) !== Number(micro)) continue;

    if (temporada && String(fila[colTemporada]).trim() !== String(temporada).trim()) continue;

    var objeto = { _fila: desde + i };

    for (var c = 0; c < cabecera.nombres.length; c++) {
      if (!cabecera.nombres[c]) continue;

      var valor = fila[c];

      objeto[cabecera.nombres[c]] =
        valor instanceof Date ? Utilities.formatDate(valor, zona, 'yyyy-MM-dd') : valor;
    }

    salida.push(objeto);
  }

  return salida;
}

/**
 * Escribe (o reescribe) las filas de un microciclo.
 *
 * - Con `reemplazar`, se borran sus filas y las nuevas se escriben **en el
 *   mismo sitio** donde estaban: editar el micro 10 no lo manda al final de la
 *   pestaña detrás del 14.
 * - Las filas nuevas se clonan de una fila con datos, para heredar las
 *   fórmulas de carga y las listas desplegables.
 * - `Fecha` se escribe como **fecha de verdad**, no como texto.
 * - Con cerrojo: dos guardados a la vez calcularían la misma fila.
 */
function guardaMicrociclo_(datos) {
  var filasEntrantes = datos.filas || [];

  if (!filasEntrantes.length) throw new Error('No llega ninguna fila que escribir.');

  var bloqueo = LockService.getScriptLock();

  if (!bloqueo.tryLock(30000)) throw new Error('La hoja está ocupada con otro guardado. Inténtalo en unos segundos.');

  try {
    var hoja = hojaRegistro_();

    var cabecera = cabecerasRegistro_(hoja);

    var nombres = cabecera.nombres;

    var ancho = nombres.length;

    var temporada = datos.temporada || '';
    var micro = Number(datos.micro);

    /* --- Lo que ya hubiera de este microciclo --- */

    var previas = filasDelMicro_(temporada, micro);

    /* Con la temporada escrita distinta («2026-2027» / «2026 - 2027»), rehacer
       duplicaba el microciclo: si por temporada no aparece nada, se mira sólo
       el número. */
    if (datos.reemplazar && previas.length === 0) previas = filasDelMicro_('', micro);

    if (previas.length && !datos.reemplazar) {
      throw new Error(
        'El microciclo ' + micro + ' ya tiene ' + previas.length + ' filas en la hoja. ' +
          'Ábrelo en «Editar» para sustituirlas.',
      );
    }

    /* Rehacer un micro que ya no está (lo borró alguien a mano) es escribirlo
       como nuevo: no hay nada que perder. */
    var hueco = 0;

    var calculadasPrevias = [];

    if (previas.length && datos.reemplazar) {
      /* De abajo arriba: borrar una fila mueve las de debajo. */
      var aBorrar = previas
        .map(function (una) { return una._fila; })
        .sort(function (a, b) { return b - a; });

      /* Donde empezaba: las nuevas vuelven ahí. Lo de encima no se mueve. */
      hueco = aBorrar[aBorrar.length - 1] - 1;

      /* Lo que tenía cada fila en las columnas calculadas, ANTES de borrar:
         fórmula o número escrito a mano (los partidos viejos llevan un 10
         fijo en «Demanda Cognitiva»). Se repone tal cual al escribir. */
      calculadasPrevias = previas
        .slice()
        .sort(function (a, b) { return a._fila - b._fila; })
        .map(function (una) { return calculadasDeFila_(hoja, nombres, una._fila); });

      for (var b = 0; b < aBorrar.length; b++) hoja.deleteRow(aBorrar[b]);
    }

    /* --- Dónde caen las nuevas y de qué fila se clonan --- */

    var ultima = ultimaFilaDeDatos_(hoja, cabecera);

    if (ultima <= cabecera.fila) {
      throw new Error('La hoja no tiene ninguna fila de datos de la que copiar las fórmulas.');
    }

    var cuantas = filasEntrantes.length;

    /* Detrás de la fila anterior al micro, o al final si era nuevo. */
    var despues = hueco > cabecera.fila ? hueco : ultima;

    /* El molde: la fila con FÓRMULAS más cercana por encima del hueco (o la
       última). La de justo encima puede ser un partido con «Demanda Cognitiva»
       escrita a mano, y clonarla copiaba ese 10 fijo a todo el microciclo. */
    var molde = moldeConFormulas_(hoja, cabecera, hueco > cabecera.fila ? hueco : ultima);

    hoja.insertRowsAfter(despues, cuantas);

    /* Insertar por encima del molde lo baja: se corrige. */
    if (molde > despues) molde += cuantas;

    hoja
      .getRange(molde, 1, 1, ancho)
      .copyTo(hoja.getRange(despues + 1, 1, cuantas, ancho));

    /* --- Los valores, sólo en las columnas de mano, por tramos --- */

    var escribible = function (indice) {
      var nombre = nombres[indice];

      return Boolean(nombre) && REGISTRO_CALCULADAS.indexOf(nombre) < 0;
    };

    var valorDe = function (entrante, nombre) {
      /* Lo que no llega se vacía: la fila clonada trae los datos de otra. */
      if (!Object.prototype.hasOwnProperty.call(entrante, nombre)) return '';

      var valor = entrante[nombre];

      if (nombre === 'Fecha') return aFechaDeVerdad_(valor);

      return valor === null || valor === undefined ? '' : valor;
    };

    var tramo = 0;

    while (tramo < ancho) {
      if (!escribible(tramo)) {
        tramo += 1;

        continue;
      }

      var fin = tramo;

      while (fin + 1 < ancho && escribible(fin + 1)) fin += 1;

      var valores = [];

      for (var i = 0; i < cuantas; i++) {
        var fila = [];

        for (var c = tramo; c <= fin; c++) fila.push(valorDe(filasEntrantes[i], nombres[c]));

        valores.push(fila);
      }

      hoja.getRange(despues + 1, tramo + 1, cuantas, fin - tramo + 1).setValues(valores);

      tramo = fin + 1;
    }

    /* --- Las calculadas: como estaban en esa fila, o la fórmula del molde --- */

    for (var r = 0; r < cuantas; r++) {
      /* `_calculadas: 'formula'` fuerza la fórmula (para reparar una fila). */
      if (filasEntrantes[r]._calculadas === 'formula') continue;

      var antes = calculadasPrevias.length === cuantas ? calculadasPrevias[r] : null;

      if (!antes) continue;

      for (var k = 0; k < antes.length; k++) {
        if (antes[k].formula) continue;

        hoja.getRange(despues + 1 + r, antes[k].columna).setValue(antes[k].valor);
      }
    }

    SpreadsheetApp.flush();

    /* Se relee lo escrito: un `ok` no es una comprobación. */
    return {
      ok: true,
      escritas: cuantas,
      borradas: previas.length && datos.reemplazar ? previas.length : 0,
      desde: despues + 1,
      filas: filasDelMicro_(temporada, micro),
    };
  } finally {
    bloqueo.releaseLock();
  }
}

/** Fórmula o valor de cada columna calculada de una fila. */
function calculadasDeFila_(hoja, nombres, fila) {
  var salida = [];

  for (var c = 0; c < nombres.length; c++) {
    if (REGISTRO_CALCULADAS.indexOf(nombres[c]) < 0) continue;

    var celda = hoja.getRange(fila, c + 1);

    salida.push({ columna: c + 1, formula: celda.getFormula(), valor: celda.getValue() });
  }

  return salida;
}

/** La fila más cercana a `desde` (subiendo y, si no, bajando) con fórmula en TODAS las calculadas. */
function moldeConFormulas_(hoja, cabecera, desde) {
  var primera = cabecera.fila + 1;

  var ultima = hoja.getLastRow();

  var columnas = [];

  for (var c = 0; c < cabecera.nombres.length; c++) {
    if (REGISTRO_CALCULADAS.indexOf(cabecera.nombres[c]) >= 0) columnas.push(c);
  }

  if (!columnas.length || ultima < primera) return desde;

  var formulas = hoja.getRange(primera, 1, ultima - primera + 1, cabecera.nombres.length).getFormulas();

  var tieneTodas = function (fila) {
    var una = formulas[fila - primera];

    return Boolean(una) && columnas.every(function (col) { return Boolean(una[col]); });
  };

  for (var arriba = desde; arriba >= primera; arriba--) if (tieneTodas(arriba)) return arriba;

  for (var abajo = desde + 1; abajo <= ultima; abajo++) if (tieneTodas(abajo)) return abajo;

  return desde;
}

/** "20/09/2026" o "2026-09-20" → Date, para que la celda sea una fecha. */
function aFechaDeVerdad_(valor) {
  if (valor instanceof Date) return valor;

  var texto = String(valor || '').trim();

  if (!texto) return '';

  var barras = texto.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);

  if (barras) return new Date(Number(barras[3]), Number(barras[2]) - 1, Number(barras[1]));

  var iso = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));

  return texto;
}
