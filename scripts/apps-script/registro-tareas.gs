/**
 * ESCRIBIR MICROCICLOS EN LA PESTAÑA DE REGISTRO DE TAREAS
 * =======================================================
 *
 * Lo usa el editor de microciclos de la plataforma. Añade dos acciones:
 *
 *   registroFilas   → devuelve las filas de un microciclo (para comprobar)
 *   registroGuardar → escribe las filas de un microciclo
 *
 * POR QUÉ NO ES UN appendRow
 * --------------------------
 * Tres columnas de esa pestaña son fórmulas: «Carga Ponderada» (Tiempo ×
 * Intensidad), «Demanda Cognitiva» (sale del bloque Densidad…Motivación) y
 * «Carga cognitiva» (Tiempo × Demanda Cognitiva). `appendRow` escribe valores
 * planos y **no hereda ni fórmulas ni validaciones**, así que las filas nuevas
 * saldrían sin carga y sin demanda cognitiva, que es justo lo que miden todas
 * las pantallas.
 *
 * Aquí las filas nuevas se crean **clonando la última fila con datos**
 * (`insertRowsAfter` + `copyTo`), que arrastra fórmulas, formato y listas
 * desplegables, y después se escriben **sólo** las columnas de mano.
 *
 * Y la cabecera NO está en la fila 1: encima hay un título del club. Se busca
 * la fila cuya primera casilla es «Temporada».
 *
 * INSTALACIÓN (una vez): ver el README de esta carpeta. Es pegar este archivo
 * y añadir dos líneas al `doPost`:
 *
 *   const deRegistro = manejaRegistro(e);
 *   if (deRegistro) return deRegistro;
 */

/** El identificador de la pestaña dentro del libro. */
var REGISTRO_GID = 111318766;

/** Las columnas que calcula la hoja: no se escriben nunca. */
var REGISTRO_CALCULADAS = ['Carga Ponderada', 'Carga cognitiva', 'Demanda Cognitiva'];

/* ------------------------------------------------------------------ */
/*  ENTRADA                                                            */
/* ------------------------------------------------------------------ */

/**
 * Devuelve `null` cuando la acción no es suya, para que el `doPost` de siempre
 * siga repartiendo como hasta ahora.
 */
function manejaRegistro(e) {
  var datos;

  try {
    datos = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (error) {
    return null;
  }

  var accion = datos.action || datos.accion || '';

  if (accion !== 'registroGuardar' && accion !== 'registroFilas') return null;

  var salida;

  try {
    salida =
      accion === 'registroFilas'
        ? { ok: true, filas: filasDelMicro_(datos.temporada, Number(datos.micro)) }
        : guardaMicrociclo_(datos);
  } catch (error) {
    salida = { ok: false, error: String((error && error.message) || error) };
  }

  return ContentService.createTextOutput(JSON.stringify(salida)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

/* ------------------------------------------------------------------ */
/*  LA PESTAÑA                                                         */
/* ------------------------------------------------------------------ */

function hojaRegistro_() {
  var libro = SpreadsheetApp.getActiveSpreadsheet();

  var hojas = libro.getSheets();

  for (var i = 0; i < hojas.length; i++) {
    if (hojas[i].getSheetId() === REGISTRO_GID) return hojas[i];
  }

  throw new Error('No encuentro la pestaña de registro de tareas (gid ' + REGISTRO_GID + ').');
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

function filasDelMicro_(temporada, micro) {
  var hoja = hojaRegistro_();

  var cabecera = cabecerasRegistro_(hoja);

  var desde = cabecera.fila + 1;

  var alto = hoja.getLastRow() - cabecera.fila;

  if (alto <= 0) return [];

  var valores = hoja.getRange(desde, 1, alto, cabecera.nombres.length).getValues();

  var colTemporada = indiceDeColumna_(cabecera.nombres, 'Temporada');
  var colMicro = indiceDeColumna_(cabecera.nombres, 'Micro');

  var salida = [];

  for (var i = 0; i < valores.length; i++) {
    var fila = valores[i];

    if (Number(fila[colMicro]) !== Number(micro)) continue;

    if (temporada && String(fila[colTemporada]).trim() !== String(temporada).trim()) continue;

    var objeto = { _fila: desde + i };

    for (var c = 0; c < cabecera.nombres.length; c++) {
      if (!cabecera.nombres[c]) continue;

      objeto[cabecera.nombres[c]] = fila[c];
    }

    salida.push(objeto);
  }

  return salida;
}

/* ------------------------------------------------------------------ */
/*  ESCRIBIR                                                           */
/* ------------------------------------------------------------------ */

/**
 * Escribe (o reescribe) las filas de un microciclo.
 *
 * - Si el microciclo ya tiene filas y `reemplazar` es cierto, se borran sus
 *   filas y se vuelven a crear. Es lo que hace falta al cambiar una sesión
 *   entera; sin eso quedarían las viejas y las nuevas a la vez.
 * - Las filas nuevas se clonan de la última fila con datos, para heredar las
 *   fórmulas de carga y las listas desplegables.
 * - `Fecha` se escribe como **fecha de verdad**, no como texto: si se queda en
 *   texto, el calendario de micros deja de verla.
 */
function guardaMicrociclo_(datos) {
  var filasEntrantes = datos.filas || [];

  if (!filasEntrantes.length) throw new Error('No llega ninguna fila que escribir.');

  var hoja = hojaRegistro_();

  var cabecera = cabecerasRegistro_(hoja);

  var nombres = cabecera.nombres;

  var ancho = nombres.length;

  var temporada = datos.temporada || '';
  var micro = Number(datos.micro);

  /* --- Lo que ya hubiera de este microciclo --- */

  var previas = filasDelMicro_(temporada, micro);

  /*
  | Con la temporada escrita distinta, «rehacer» duplicaba el microciclo.
  |
  | La pantalla avisa de que el micro 12 ya existe mirando SÓLO el número; aquí
  | se filtraba también por temporada exacta. Si la hoja tenía «2026-2027» y la
  | app mandaba «2026 - 2027», no se encontraba nada que borrar y las filas se
  | añadían encima de las que ya estaban: el microciclo quedaba dos veces y
  | todo lo que lee la pestaña contaba doble.
  |
  | Así que, al rehacer, si por temporada no aparece nada se mira sólo el
  | número; y si aun así no hay nada que sustituir, se dice, en vez de escribir
  | por segunda vez sin avisar.
  */
  if (datos.reemplazar && previas.length === 0) {
    previas = filasDelMicro_('', micro);
  }

  if (previas.length && !datos.reemplazar) {
    throw new Error(
      'El microciclo ' + micro + ' ya tiene ' + previas.length + ' filas en la hoja. ' +
        'Marca «rehacerlo» si quieres sustituirlas.',
    );
  }

  if (datos.reemplazar && previas.length === 0) {
    throw new Error(
      'Se pidió rehacer el microciclo ' + micro + ' pero en la hoja no hay ninguna fila suya. ' +
        'Quita la marca de «rehacerlo» para escribirlo como nuevo.',
    );
  }

  if (previas.length && datos.reemplazar) {
    /* De abajo arriba: borrar una fila mueve las de debajo. */
    var aBorrar = previas
      .map(function (una) { return una._fila; })
      .sort(function (a, b) { return b - a; });

    for (var b = 0; b < aBorrar.length; b++) hoja.deleteRow(aBorrar[b]);
  }

  /* --- Dónde caen las nuevas --- */

  /*
  | La última fila DE DATOS, no la última de la hoja.
  |
  | `getLastRow()` devuelve la última con cualquier cosa escrita: una nota al
  | pie o una celda suelta bastaba para que las filas nuevas se insertaran
  | detrás de ella y se clonaran DE ella, es decir, sin las fórmulas de carga
  | que todo esto existe para conservar.
  */
  var ultima = ultimaFilaDeDatos_(hoja, cabecera);

  if (ultima <= cabecera.fila) {
    throw new Error('La hoja no tiene ninguna fila de datos de la que copiar las fórmulas.');
  }

  var cuantas = filasEntrantes.length;

  hoja.insertRowsAfter(ultima, cuantas);

  /* El clon arrastra fórmulas, formato y validaciones de datos. */
  hoja
    .getRange(ultima, 1, 1, ancho)
    .copyTo(hoja.getRange(ultima + 1, 1, cuantas, ancho));

  /* --- Los valores, sólo en las columnas de mano --- */

  /*
  | POR TRAMOS, Y NUNCA SOBRE TODO EL RANGO.
  |
  | Un `getValues()` del rango entero devuelve lo que las fórmulas han
  | **calculado**, y devolverlo con `setValues()` las machaca: «Carga
  | Ponderada» dejaría de ser una fórmula y pasaría a ser el número que valía
  | en ese instante. La fila parecería correcta y dejaría de recalcular para
  | siempre.
  |
  | Así que se escriben sólo los tramos seguidos de columnas de mano, saltando
  | las tres calculadas (y la columna sin cabecera del final).
  */
  var escribible = function (indice) {
    var nombre = nombres[indice];

    return Boolean(nombre) && REGISTRO_CALCULADAS.indexOf(nombre) < 0;
  };

  var valorDe = function (entrante, nombre) {
    if (!Object.prototype.hasOwnProperty.call(entrante, nombre)) {
      /* Lo que no llega se vacía: la fila clonada trae los datos de otra. */
      return '';
    }

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

      for (var c = tramo; c <= fin; c++) {
        fila.push(valorDe(filasEntrantes[i], nombres[c]));
      }

      valores.push(fila);
    }

    hoja
      .getRange(ultima + 1, tramo + 1, cuantas, fin - tramo + 1)
      .setValues(valores);

    tramo = fin + 1;
  }

  SpreadsheetApp.flush();

  /* Se relee lo escrito: un `ok` no es una comprobación. */
  return {
    ok: true,
    escritas: cuantas,
    borradas: previas.length && datos.reemplazar ? previas.length : 0,
    desde: ultima + 1,
    filas: filasDelMicro_(temporada, micro),
  };
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
