/**
 * RMCF Castilla · Tareas con alerta por correo
 * ============================================
 *
 * Este archivo va DENTRO del proyecto de Apps Script de la hoja, no en la app.
 * Instrucciones de instalación en `scripts/apps-script/README.md`.
 *
 * Qué hace:
 *   - guarda las tareas con alerta en la pestaña `ALERTAS`;
 *   - envía el correo con MailApp, con los adjuntos como enlace;
 *   - aprende los correos usados en la pestaña `AGENDA`;
 *   - un disparador horario (`revisarAlertas`) manda lo que toque cada 15 min,
 *     esté la app abierta o cerrada.
 *
 * Por qué el calendario vive aquí y no en Supabase: es lo único de todo el
 * montaje que se despierta solo. Ver `lib/alertas/modelo.ts` en la app.
 */

const HOJA_ALERTAS = 'ALERTAS';
const HOJA_AGENDA = 'AGENDA';

const COLUMNAS_ALERTAS = [
  'ID',
  'TITULO',
  'MENSAJE',
  'DESTINATARIOS',
  'ADJUNTOS',
  'PROXIMO_ENVIO',
  'REPETICION',
  'INTERVALO_DIAS',
  'ACTIVA',
  'CREADA',
  'ULTIMO_ENVIO',
  'ENVIOS',
];

const COLUMNAS_AGENDA = ['EMAIL', 'NOMBRE', 'USOS', 'ULTIMO_USO'];

/* Remite el aviso desde la propia cuenta que abrió el script. */
const NOMBRE_REMITENTE = 'RMCF Castilla';

/**
 * Libro donde viven `ALERTAS` y `AGENDA`.
 *
 * El proyecto de Apps Script de la casa es **independiente**: no cuelga de
 * ninguna hoja, por eso todo `Code.gs` abre los libros con `openById`. En un
 * proyecto así `getActiveSpreadsheet()` devuelve `null`, y la primera versión
 * de este archivo moría con «Cannot read properties of null (reading
 * 'getSheetByName')» en cuanto la app pedía listar alertas.
 *
 * Es el mismo identificador que `SPREADSHEET_ID` de `Code.gs`; se repite aquí
 * a propósito para que este archivo siga valiendo suelto.
 */
const LIBRO_ALERTAS_ID = '1FoRyvIy6brqsPVGHh66XaHcjVaOaPKcqRuQXcIHO9B4';

/* ================================================================== */
/*  ENTRADA DESDE LA APP                                               */
/* ================================================================== */

/**
 * Engancha las acciones de alertas al `doPost` que ya tiene el proyecto.
 *
 * **Se le pasa el evento entero, no lo que el `doPost` haya parseado.** La
 * primera versión pedía escribir `manejaAlertas(datos.action, datos)`, y eso
 * obligaba a que la variable del `doPost` de la hoja se llamase justo `datos`:
 * cuando no se llamaba así —que es lo corriente— el script moría con
 * «ReferenceError: datos is not defined» y la app decía que el motor de envío
 * no responde. Ahora la línea que hay que pegar es una sola y no depende de
 * cómo esté escrito el resto del proyecto:
 *
 *     const deAlertas = manejaAlertas(e);
 *     if (deAlertas) return deAlertas;
 *
 * Devuelve `null` cuando la acción no es de este archivo, para que el `doPost`
 * siga con su cadena de siempre, y un `TextOutput` ya listo para devolver
 * cuando sí lo es.
 */
function manejaAlertas(evento, datosSueltos) {
  const datos = entradaDeAlertas_(evento, datosSueltos);

  if (!datos || !datos.action) return null;

  var resultado;

  try {
    resultado = despachaAlertas_(datos.action, datos);
  } catch (error) {
    /*
    | Sin esto, un fallo aquí dentro sale como la página HTML de error de
    | Google: la app no puede leerla y sólo sabe decir que la hoja no contesta.
    | Así llega el motivo escrito hasta la pantalla.
    */
    resultado = { ok: false, error: String((error && error.message) || error) };
  }

  if (resultado === null) return null;

  /*
  | Quien llame a la manera antigua —`manejaAlertas(datos.action, datos)`—
  | espera el objeto pelado, porque su `doPost` lo envuelve él mismo. Se le
  | devuelve tal cual para no romper las hojas que ya lo tengan pegado así.
  */
  if (typeof evento === 'string') return resultado;

  return ContentService
    .createTextOutput(JSON.stringify(resultado))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Saca `{ action, ... }` de lo que sea que le hayan pasado.
 *
 * Admite tres formas porque las tres se han visto en hojas de la casa: el
 * evento del `doPost` —lo normal—, un objeto ya parseado, y la pareja
 * `(accion, datos)` de la primera versión de estas instrucciones, para que a
 * quien la tenga pegada le siga funcionando.
 */
function entradaDeAlertas_(evento, datosSueltos) {
  if (!evento) return null;

  if (typeof evento === 'string') {
    return Object.assign({}, datosSueltos || {}, { action: evento });
  }

  if (evento.action) return evento;

  if (evento.postData && evento.postData.contents) {
    try {
      return JSON.parse(evento.postData.contents);
    } catch (error) {
      /* Cae al formulario de abajo: puede venir url-encoded. */
    }
  }

  /* `fetch` con `Content-Type: application/x-www-form-urlencoded`. */
  if (evento.parameter && evento.parameter.action) return evento.parameter;

  return null;
}

/** El reparto por acción. Devuelve `null` si la acción no es de aquí. */
function despachaAlertas_(accion, datos) {
  switch (accion) {
    case 'listarAlertas':
      return listarAlertas_();
    case 'guardarAlerta':
      return guardarAlerta_(datos.alerta);
    case 'borrarAlerta':
      return borrarAlerta_(datos.id);
    case 'enviarAlertaAhora':
      return enviarAlertaAhora_(datos.id);
    default:
      return null;
  }
}

/**
 * El `doPost` entero, para las hojas que todavía no tienen ninguno.
 *
 * No se llama `doPost` a propósito: si este archivo declarase un `doPost` y el
 * proyecto ya tuviera el suyo, Apps Script se quedaría con **el último que
 * lee** y el resto de la hoja dejaría de funcionar sin avisar. Quien no tenga
 * `doPost` sólo tiene que crear uno de una línea que llame a esto.
 */
function doPostDeAlertas(e) {
  const respuesta = manejaAlertas(e);

  if (respuesta) return respuesta;

  return ContentService
    .createTextOutput(JSON.stringify({ ok: false, error: 'Acción desconocida' }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Comprobación desde el propio editor: dice si el archivo está bien pegado.
 *
 * Se ejecuta con el botón **Ejecutar** y escribe el resultado en el registro,
 * así se sabe si el problema está en el script o en el enganche del `doPost`
 * sin tener que probar desde la app.
 */
function comprobarAlertas() {
  const respuesta = manejaAlertas({
    postData: { contents: JSON.stringify({ action: 'listarAlertas' }) },
  });

  if (!respuesta) {
    Logger.log('MAL: manejaAlertas no ha reconocido la acción listarAlertas.');
    return 'MAL';
  }

  const texto = respuesta.getContent();

  Logger.log('Respuesta de listarAlertas: ' + texto);

  const leido = JSON.parse(texto);

  if (leido.ok === false) {
    Logger.log('MAL: ' + leido.error);
    return 'MAL';
  }

  const disparador = ScriptApp.getProjectTriggers().some(function (uno) {
    return uno.getHandlerFunction() === 'revisarAlertas';
  });

  Logger.log(
    disparador
      ? 'BIEN: el archivo responde y el disparador está puesto.'
      : 'A MEDIAS: el archivo responde, pero falta ejecutar ' +
          'instalarDisparadorDeAlertas.',
  );

  return disparador ? 'BIEN' : 'A MEDIAS';
}

/* ================================================================== */
/*  PESTAÑAS                                                           */
/* ================================================================== */

/**
 * El libro de las alertas.
 *
 * Se prueba primero el libro activo para que el archivo siga funcionando si
 * algún día se pega en un proyecto atado a una hoja; si no lo hay —el caso de
 * la casa—, se abre por identificador. El disparador horario tampoco tiene
 * libro activo, así que esto hace falta también para que las alarmas suenen
 * con la app cerrada.
 */
function libroDeAlertas_() {
  const activo = SpreadsheetApp.getActiveSpreadsheet();

  if (activo) return activo;

  return SpreadsheetApp.openById(LIBRO_ALERTAS_ID);
}

/**
 * Devuelve la pestaña, creándola con sus cabeceras si aún no existe.
 *
 * Las columnas de fecha se dejan en formato TEXTO a propósito: si no, la hoja
 * convierte los ISO en objetos Date con su propia zona y al releerlos la hora
 * aparece corrida.
 */
function hojaDe_(nombre, columnas) {
  const libro = libroDeAlertas_();

  let hoja = libro.getSheetByName(nombre);

  if (!hoja) {
    hoja = libro.insertSheet(nombre);

    hoja.getRange(1, 1, 1, columnas.length).setValues([columnas]);
    hoja.setFrozenRows(1);
    hoja.getRange(2, 1, hoja.getMaxRows() - 1, columnas.length)
      .setNumberFormat('@');
  }

  return hoja;
}

function filasDe_(hoja, columnas) {
  const ultima = hoja.getLastRow();

  if (ultima < 2) return [];

  const valores = hoja
    .getRange(2, 1, ultima - 1, columnas.length)
    .getValues();

  return valores
    .map(function (fila, indice) {
      const registro = { _fila: indice + 2 };

      columnas.forEach(function (columna, posicion) {
        registro[columna] = fila[posicion];
      });

      return registro;
    })
    .filter(function (registro) {
      return String(registro[columnas[0]] || '').trim() !== '';
    });
}

/* ================================================================== */
/*  CONVERSIONES                                                       */
/* ================================================================== */

/** La celda puede venir como texto ISO o como Date si alguien la reformateó. */
function aIso_(valor) {
  if (!valor) return '';

  if (valor instanceof Date) return valor.toISOString();

  const texto = String(valor).trim();

  if (!texto) return '';

  const fecha = new Date(texto);

  return isNaN(fecha.getTime()) ? '' : fecha.toISOString();
}

function aLista_(valor) {
  return String(valor || '')
    .split(/[,;\s]+/)
    .map(function (parte) {
      return parte.trim().toLowerCase();
    })
    .filter(Boolean);
}

function aAdjuntos_(valor) {
  const texto = String(valor || '').trim();

  if (!texto) return [];

  try {
    const lista = JSON.parse(texto);

    return Array.isArray(lista) ? lista : [];
  } catch (error) {
    /* Una celda a medio editar a mano no debe tumbar el envío. */
    return [];
  }
}

/** Fila de la hoja -> objeto que entiende la app. */
function aAlerta_(fila) {
  return {
    id: String(fila.ID || ''),
    titulo: String(fila.TITULO || ''),
    mensaje: String(fila.MENSAJE || ''),
    destinatarios: aLista_(fila.DESTINATARIOS),
    adjuntos: aAdjuntos_(fila.ADJUNTOS),
    proximoEnvio: aIso_(fila.PROXIMO_ENVIO),
    repeticion: String(fila.REPETICION || 'una-vez'),
    intervaloDias: Number(fila.INTERVALO_DIAS) || 7,
    activa: String(fila.ACTIVA).toUpperCase() !== 'NO',
    creada: aIso_(fila.CREADA),
    ultimoEnvio: aIso_(fila.ULTIMO_ENVIO) || null,
    envios: Number(fila.ENVIOS) || 0,
    _fila: fila._fila,
  };
}

/** Objeto de la app -> fila de la hoja, en el orden de `COLUMNAS_ALERTAS`. */
function aFila_(alerta) {
  return [
    alerta.id,
    alerta.titulo || '',
    alerta.mensaje || '',
    (alerta.destinatarios || []).join(', '),
    JSON.stringify(alerta.adjuntos || []),
    alerta.proximoEnvio || '',
    alerta.repeticion || 'una-vez',
    String(alerta.intervaloDias || 7),
    alerta.activa === false ? 'NO' : 'SI',
    alerta.creada || new Date().toISOString(),
    alerta.ultimoEnvio || '',
    String(alerta.envios || 0),
  ];
}

/* ================================================================== */
/*  ACCIONES                                                           */
/* ================================================================== */

function listarAlertas_() {
  const hoja = hojaDe_(HOJA_ALERTAS, COLUMNAS_ALERTAS);

  const alertas = filasDe_(hoja, COLUMNAS_ALERTAS).map(aAlerta_);

  alertas.forEach(function (alerta) {
    delete alerta._fila;
  });

  return { ok: true, alertas: alertas, agenda: leeAgenda_() };
}

function guardarAlerta_(alerta) {
  if (!alerta || !alerta.id) {
    return { ok: false, error: 'La alerta no trae identificador' };
  }

  const hoja = hojaDe_(HOJA_ALERTAS, COLUMNAS_ALERTAS);

  const existentes = filasDe_(hoja, COLUMNAS_ALERTAS).map(aAlerta_);

  const previa = existentes.filter(function (candidata) {
    return candidata.id === alerta.id;
  })[0];

  const fila = aFila_(alerta);

  if (previa) {
    hoja.getRange(previa._fila, 1, 1, COLUMNAS_ALERTAS.length)
      .setValues([fila]);
  } else {
    hoja.appendRow(fila);

    /* `appendRow` no hereda el formato de texto de las filas de arriba. */
    hoja.getRange(hoja.getLastRow(), 1, 1, COLUMNAS_ALERTAS.length)
      .setNumberFormat('@');
  }

  /*
  | La agenda aprende al guardar, no solo al enviar: así la dirección que
  | acabas de escribir ya se ofrece en la siguiente tarea aunque el aviso sea
  | para dentro de un mes.
  */
  aprendeCorreos_(alerta.destinatarios, 0);

  return { ok: true, alerta: alerta, agenda: leeAgenda_() };
}

function borrarAlerta_(id) {
  const hoja = hojaDe_(HOJA_ALERTAS, COLUMNAS_ALERTAS);

  const alertas = filasDe_(hoja, COLUMNAS_ALERTAS).map(aAlerta_);

  const objetivo = alertas.filter(function (alerta) {
    return alerta.id === id;
  })[0];

  if (!objetivo) return { ok: false, error: 'Esa alerta ya no está' };

  hoja.deleteRow(objetivo._fila);

  return { ok: true, id: id };
}

function enviarAlertaAhora_(id) {
  const hoja = hojaDe_(HOJA_ALERTAS, COLUMNAS_ALERTAS);

  const alertas = filasDe_(hoja, COLUMNAS_ALERTAS).map(aAlerta_);

  const alerta = alertas.filter(function (candidata) {
    return candidata.id === id;
  })[0];

  if (!alerta) return { ok: false, error: 'Esa alerta ya no está' };

  const resultado = enviaCorreo_(alerta);

  if (!resultado.ok) return resultado;

  /*
  | Se apunta el envío, pero NO se toca PROXIMO_ENVIO: "enviar ahora" es una
  | prueba o un aviso suelto, y adelantar el calendario por probarlo sería
  | justo lo contrario de lo que espera quien pulsa el botón.
  */
  anotaEnvio_(hoja, alerta, null);

  return { ok: true, enviados: resultado.enviados };
}

/* ================================================================== */
/*  ENVÍO                                                              */
/* ================================================================== */

function escapaHtml_(texto) {
  return String(texto || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function familiaDe_(adjunto) {
  const tipo = String(adjunto.tipo || '').toLowerCase();

  if (tipo.indexOf('image/') === 0) return 'foto';
  if (tipo.indexOf('video/') === 0) return 'video';
  if (tipo.indexOf('audio/') === 0) return 'audio';

  return 'documento';
}

/**
 * El cuerpo del correo.
 *
 * Los adjuntos van como ENLACE, nunca pegados: Gmail corta en 25 MB y casi
 * cualquier vídeo de entrenamiento lo pasa. Las fotos, además, se muestran
 * incrustadas —la URL del bucket es pública—, así que se ven sin salir de la
 * bandeja aunque el fichero pese.
 */
function cuerpoHtml_(alerta) {
  const partes = [];

  partes.push(
    '<div style="font-family:Helvetica,Arial,sans-serif;max-width:640px;' +
      'margin:0 auto;padding:24px;color:#111">',
  );

  partes.push(
    '<p style="margin:0 0 4px;font-size:11px;letter-spacing:.14em;' +
      'text-transform:uppercase;color:#8a6d3b">RMCF Castilla</p>',
  );

  partes.push(
    '<h1 style="margin:0 0 16px;font-size:22px;line-height:1.25">' +
      escapaHtml_(alerta.titulo) +
      '</h1>',
  );

  if (alerta.mensaje) {
    partes.push(
      '<div style="font-size:15px;line-height:1.6;white-space:pre-wrap">' +
        escapaHtml_(alerta.mensaje) +
        '</div>',
    );
  }

  const adjuntos = alerta.adjuntos || [];

  if (adjuntos.length) {
    partes.push(
      '<hr style="margin:24px 0;border:0;border-top:1px solid #e2e2e2">',
    );

    adjuntos.forEach(function (adjunto) {
      const familia = familiaDe_(adjunto);
      const url = escapaHtml_(adjunto.url);
      const nombre = escapaHtml_(adjunto.nombre);

      if (familia === 'foto') {
        partes.push(
          '<p style="margin:0 0 12px"><img src="' +
            url +
            '" alt="' +
            nombre +
            '" style="max-width:100%;border-radius:10px"></p>',
        );
      }

      const etiqueta =
        familia === 'video'
          ? '▶ Ver el vídeo'
          : familia === 'audio'
            ? '♫ Escuchar'
            : familia === 'foto'
              ? '↓ Descargar la foto'
              : '↓ Abrir el documento';

      partes.push(
        '<p style="margin:0 0 10px;font-size:14px">' +
          '<a href="' +
          url +
          '" style="color:#8a6d3b;font-weight:600;text-decoration:none">' +
          etiqueta +
          '</a> <span style="color:#777">· ' +
          nombre +
          '</span></p>',
      );
    });
  }

  partes.push(
    '<p style="margin:28px 0 0;font-size:12px;color:#999">' +
      'Aviso automático de la plataforma del Real Madrid CF Castilla.</p>',
  );

  partes.push('</div>');

  return partes.join('');
}

function enviaCorreo_(alerta) {
  const destinatarios = (alerta.destinatarios || []).filter(Boolean);

  if (!destinatarios.length) {
    return { ok: false, error: 'La alerta no tiene destinatarios' };
  }

  /*
  | Gmail gratuito da 100 destinatarios al día y Workspace 1.500. Si no queda
  | cupo hay que decirlo, no fallar en silencio: la alarma se reintentará en la
  | siguiente pasada del disparador.
  */
  if (MailApp.getRemainingDailyQuota() < destinatarios.length) {
    return { ok: false, error: 'Se ha agotado el cupo diario de correos' };
  }

  try {
    MailApp.sendEmail({
      to: destinatarios.join(','),
      subject: alerta.titulo || 'Aviso RMCF Castilla',
      htmlBody: cuerpoHtml_(alerta),
      name: NOMBRE_REMITENTE,
    });
  } catch (error) {
    return { ok: false, error: 'No se ha podido enviar: ' + error.message };
  }

  aprendeCorreos_(destinatarios, 1);

  return { ok: true, enviados: destinatarios.length };
}

/** Escribe en la fila el envío recién hecho y, si toca, la próxima fecha. */
function anotaEnvio_(hoja, alerta, proximoEnvio) {
  const ahora = new Date().toISOString();

  const columnaUltimo = COLUMNAS_ALERTAS.indexOf('ULTIMO_ENVIO') + 1;
  const columnaEnvios = COLUMNAS_ALERTAS.indexOf('ENVIOS') + 1;
  const columnaProximo = COLUMNAS_ALERTAS.indexOf('PROXIMO_ENVIO') + 1;
  const columnaActiva = COLUMNAS_ALERTAS.indexOf('ACTIVA') + 1;

  hoja.getRange(alerta._fila, columnaUltimo).setValue(ahora);
  hoja.getRange(alerta._fila, columnaEnvios).setValue(String(alerta.envios + 1));

  if (proximoEnvio) {
    hoja.getRange(alerta._fila, columnaProximo).setValue(proximoEnvio);
  } else if (proximoEnvio === '') {
    /* Una alerta de una sola vez ya ha cumplido: se apaga sola. */
    hoja.getRange(alerta._fila, columnaActiva).setValue('NO');
  }
}

/* ================================================================== */
/*  CALENDARIO                                                         */
/* ================================================================== */

/** Misma cuenta que `siguienteEnvio` en `lib/alertas/modelo.ts`. */
function siguienteEnvio_(alerta, desde) {
  const fecha = new Date(desde.getTime());

  switch (alerta.repeticion) {
    case 'diaria':
      fecha.setDate(fecha.getDate() + 1);
      return fecha;
    case 'semanal':
      fecha.setDate(fecha.getDate() + 7);
      return fecha;
    case 'mensual':
      fecha.setMonth(fecha.getMonth() + 1);
      return fecha;
    case 'personalizada':
      fecha.setDate(fecha.getDate() + Math.max(1, alerta.intervaloDias));
      return fecha;
    default:
      return null;
  }
}

/**
 * El disparador. Manda lo que ya toca y reprograma lo que se repite.
 *
 * Lo llama un disparador horario cada 15 minutos; también se puede ejecutar a
 * mano desde el editor para probar.
 */
function revisarAlertas() {
  const hoja = hojaDe_(HOJA_ALERTAS, COLUMNAS_ALERTAS);

  const alertas = filasDe_(hoja, COLUMNAS_ALERTAS).map(aAlerta_);

  const ahora = new Date();

  let enviadas = 0;

  alertas.forEach(function (alerta) {
    if (!alerta.activa || !alerta.proximoEnvio) return;

    const toca = new Date(alerta.proximoEnvio);

    if (isNaN(toca.getTime()) || toca > ahora) return;

    const resultado = enviaCorreo_(alerta);

    if (!resultado.ok) {
      /* Se deja la fecha como estaba: lo reintenta la siguiente pasada. */
      console.error('[alertas] ' + alerta.id + ': ' + resultado.error);
      return;
    }

    enviadas += 1;

    let proximo = siguienteEnvio_(alerta, toca);

    /*
    | Si el script ha estado parado varios días, `proximo` puede seguir en el
    | pasado. Se adelanta hasta pasar de hoy en lugar de mandar un correo por
    | cada hueco: nadie quiere doce avisos de golpe al volver de vacaciones.
    */
    while (proximo && proximo <= ahora) {
      proximo = siguienteEnvio_(alerta, proximo);
    }

    anotaEnvio_(hoja, alerta, proximo ? proximo.toISOString() : '');
  });

  return enviadas;
}

/**
 * Deja instalado el disparador de 15 minutos. Ejecutar UNA vez desde el editor.
 *
 * Borra antes el que hubiera para no acabar con dos disparadores mandando el
 * mismo aviso por duplicado.
 */
function instalarDisparadorDeAlertas() {
  ScriptApp.getProjectTriggers().forEach(function (disparador) {
    if (disparador.getHandlerFunction() === 'revisarAlertas') {
      ScriptApp.deleteTrigger(disparador);
    }
  });

  ScriptApp.newTrigger('revisarAlertas')
    .timeBased()
    .everyMinutes(15)
    .create();

  return 'Disparador instalado: revisarAlertas cada 15 minutos.';
}

/* ================================================================== */
/*  AGENDA — LO QUE LA APP APRENDE                                     */
/* ================================================================== */

function leeAgenda_() {
  const hoja = hojaDe_(HOJA_AGENDA, COLUMNAS_AGENDA);

  const contactos = filasDe_(hoja, COLUMNAS_AGENDA).map(function (fila) {
    return {
      email: String(fila.EMAIL || '').toLowerCase(),
      nombre: String(fila.NOMBRE || ''),
      usos: Number(fila.USOS) || 0,
      ultimoUso: aIso_(fila.ULTIMO_USO),
    };
  });

  /* Primero los más usados; a igualdad, el más reciente. */
  contactos.sort(function (a, b) {
    if (b.usos !== a.usos) return b.usos - a.usos;

    return String(b.ultimoUso).localeCompare(String(a.ultimoUso));
  });

  return contactos;
}

/**
 * Apunta las direcciones usadas para poder ofrecerlas en la siguiente tarea.
 *
 * `incremento` es 0 al guardar (solo queremos que la dirección exista) y 1 al
 * enviar de verdad, que es lo que la sube en el ranking.
 */
function aprendeCorreos_(destinatarios, incremento) {
  const lista = (destinatarios || [])
    .map(function (email) {
      return String(email || '').trim().toLowerCase();
    })
    .filter(Boolean);

  if (!lista.length) return;

  const hoja = hojaDe_(HOJA_AGENDA, COLUMNAS_AGENDA);

  const existentes = filasDe_(hoja, COLUMNAS_AGENDA);

  const porEmail = {};

  existentes.forEach(function (fila) {
    porEmail[String(fila.EMAIL || '').toLowerCase()] = fila;
  });

  const ahora = new Date().toISOString();

  const columnaUsos = COLUMNAS_AGENDA.indexOf('USOS') + 1;
  const columnaUltimo = COLUMNAS_AGENDA.indexOf('ULTIMO_USO') + 1;

  lista.forEach(function (email) {
    const fila = porEmail[email];

    if (fila) {
      if (incremento > 0) {
        const usos = (Number(fila.USOS) || 0) + incremento;

        hoja.getRange(fila._fila, columnaUsos).setValue(String(usos));
        hoja.getRange(fila._fila, columnaUltimo).setValue(ahora);
      }

      return;
    }

    hoja.appendRow([email, '', String(incremento), ahora]);

    hoja.getRange(hoja.getLastRow(), 1, 1, COLUMNAS_AGENDA.length)
      .setNumberFormat('@');

    /* Que las siguientes direcciones del mismo lote no la den de alta otra vez. */
    porEmail[email] = { _fila: hoja.getLastRow(), EMAIL: email, USOS: incremento };
  });
}
