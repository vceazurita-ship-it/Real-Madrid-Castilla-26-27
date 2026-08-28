/**
 * Arnés del Apps Script de alertas.
 *
 * `alertas.gs` es JavaScript corriente, así que se puede cargar en Node con una
 * hoja de mentira y probarlo entero sin tocar la cuenta de Google: el enganche
 * del `doPost` en sus cuatro formas, el alta y la relectura de una tarea, el
 * repaso del disparador y —lo que más importa— que guardar desde la pantalla
 * no deshaga un envío que ya se hizo.
 *
 * La hoja falsa es una rejilla de verdad (`appendRow`, rangos, `setValue`,
 * `deleteRow`): con la de antes, que se tragaba las escrituras sin guardarlas,
 * cualquier prueba de guardado habría pasado sin comprobar nada.
 *
 *     node scripts/apps-script/prueba-alertas.cjs
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const RAIZ = process.argv[2] || process.cwd();

const fuente = fs.readFileSync(
  path.join(RAIZ, "scripts/apps-script/alertas.gs"),
  "utf8",
);

/* ---------------------------------------------------------------- */
/*  LA HOJA DE MENTIRA                                               */
/* ---------------------------------------------------------------- */

/**
 * Una rejilla en memoria con lo poco que usa `alertas.gs`.
 *
 * Las celdas se guardan por fila **empezando en la 1**, como en la hoja: la
 * cabecera es la fila 1 y los datos empiezan en la 2, que es justo lo que dan
 * por hecho `filasDe_` y `_fila`.
 */
function hojaFalsa(nombre) {
  /* `celdas[fila - 1][columna - 1]`; la fila 1 es la cabecera. */
  const celdas = [];

  const asegura = (fila, columna) => {
    while (celdas.length < fila) celdas.push([]);

    const cuerpo = celdas[fila - 1];

    while (cuerpo.length < columna) cuerpo.push('');

    return cuerpo;
  };

  return {
    nombre,
    volcado: () => celdas,
    getLastRow: () => celdas.length,
    getMaxRows: () => celdas.length + 100,
    setFrozenRows: () => {},
    appendRow: (valores) => {
      asegura(celdas.length + 1, valores.length);
      celdas[celdas.length - 1] = valores.slice();
    },
    deleteRow: (fila) => celdas.splice(fila - 1, 1),
    getRange: (fila, columna, filas, columnas) => {
      const alto = filas === undefined ? 1 : filas;
      const ancho = columnas === undefined ? 1 : columnas;

      return {
        getValues: () => {
          const leido = [];

          for (let salto = 0; salto < alto; salto += 1) {
            const cuerpo = asegura(fila + salto, columna + ancho - 1);

            leido.push(cuerpo.slice(columna - 1, columna - 1 + ancho));
          }

          return leido;
        },
        setValues: (bloque) => {
          bloque.forEach((linea, salto) => {
            const cuerpo = asegura(fila + salto, columna + ancho - 1);

            linea.forEach((valor, paso) => {
              cuerpo[columna - 1 + paso] = valor;
            });
          });
        },
        setValue: (valor) => {
          asegura(fila, columna)[columna - 1] = valor;
        },
        setNumberFormat: () => {},
      };
    },
  };
}

const hojas = new Map();

/* Los correos que habría mandado, y los disparadores que dice tener. */
const enviados = [];

let disparadores = [{ getHandlerFunction: () => "revisarAlertas" }];

const contexto = {
  console,
  Object,
  JSON,
  Date,
  String,
  Number,
  Array,
  Math,
  Logger: { log: (mensaje) => console.log("   [log]", mensaje) },
  SpreadsheetApp: {
    getActiveSpreadsheet: () => ({
      getSheetByName: (nombre) => hojas.get(nombre) ?? null,
      insertSheet: (nombre) => {
        const hoja = hojaFalsa(nombre);
        hojas.set(nombre, hoja);
        return hoja;
      },
    }),
  },
  ContentService: {
    MimeType: { JSON: "application/json" },
    createTextOutput: (texto) => ({
      _texto: texto,
      getContent: () => texto,
      setMimeType() {
        return this;
      },
    }),
  },
  ScriptApp: {
    getProjectTriggers: () => disparadores,
  },
  LockService: {
    getScriptLock: () => ({
      tryLock: () => true,
      releaseLock: () => {},
    }),
  },
  MailApp: {
    getRemainingDailyQuota: () => 1500,
    sendEmail: (mensaje) => enviados.push(mensaje),
  },
  Utilities: { formatDate: () => "" },
  Session: { getScriptTimeZone: () => "Europe/Madrid" },
};

vm.createContext(contexto);
vm.runInContext(fuente, contexto, { filename: "alertas.gs" });

/* ---------------------------------------------------------------- */
/*  LAS PRUEBAS                                                      */
/* ---------------------------------------------------------------- */

let fallos = 0;

const comprueba = (titulo, condicion, detalle) => {
  console.log(`${condicion ? "OK  " : "MAL "} ${titulo}`);

  if (!condicion) {
    fallos += 1;
    if (detalle !== undefined) console.log("     ", detalle);
  }
};

/* 1. La forma nueva: el evento entero del doPost. */
const evento = {
  postData: { contents: JSON.stringify({ action: "listarAlertas" }) },
};

const respuesta = contexto.manejaAlertas(evento);

comprueba("evento del doPost → devuelve algo", !!respuesta);

const leido = respuesta ? JSON.parse(respuesta.getContent()) : null;

comprueba(
  "evento del doPost → JSON con ok:true",
  leido && leido.ok === true,
  leido,
);

/* 2. Un doPost que llame la variable como le dé la gana no importa: el
      enganche no lee ninguna variable suya. */
const conOtroNombre = {
  postData: { contents: JSON.stringify({ action: "guardarAlerta" }) },
};

const sinAlerta = JSON.parse(
  contexto.manejaAlertas(conOtroNombre).getContent(),
);

comprueba(
  "guardarAlerta sin alerta → error legible, no excepción",
  sinAlerta.ok === false && typeof sinAlerta.error === "string",
  sinAlerta,
);

/* 3. La forma antigua, la de las instrucciones viejas: objeto pelado. */
const viejo = contexto.manejaAlertas("listarAlertas", { action: "listarAlertas" });

comprueba(
  "forma antigua (accion, datos) → objeto pelado, no TextOutput",
  viejo && viejo.ok === true && typeof viejo.getContent !== "function",
  viejo,
);

/* 4. Un objeto ya parseado, por si el doPost prefiere pasárselo así. */
const parseado = contexto.manejaAlertas({ action: "listarAlertas" });

comprueba(
  "objeto ya parseado → TextOutput con ok:true",
  parseado && JSON.parse(parseado.getContent()).ok === true,
);

/* 5. Formulario url-encoded. */
const formulario = contexto.manejaAlertas({
  parameter: { action: "listarAlertas" },
});

comprueba(
  "url-encoded → TextOutput con ok:true",
  formulario && JSON.parse(formulario.getContent()).ok === true,
);

/* 6. Lo que no es suyo se devuelve como null, para que el doPost siga. */
comprueba(
  "acción de otro (null) → el doPost sigue su camino",
  contexto.manejaAlertas({
    postData: { contents: JSON.stringify({ action: "guardarJugador" }) },
  }) === null,
);

comprueba("sin evento → null", contexto.manejaAlertas(undefined) === null);

comprueba(
  "cuerpo que no es JSON → null",
  contexto.manejaAlertas({ postData: { contents: "<html>error</html>" } }) === null,
);

/* 7. La comprobación que se ejecuta desde el editor. */
comprueba(
  "comprobarAlertas() dice BIEN con el disparador puesto",
  contexto.comprobarAlertas() === "BIEN",
);

/* 8. El doPost de una línea para hojas sin doPost. */
comprueba(
  "doPostDeAlertas responde a una acción desconocida sin reventar",
  JSON.parse(
    contexto
      .doPostDeAlertas({
        postData: { contents: JSON.stringify({ action: "loQueSea" }) },
      })
      .getContent(),
  ).ok === false,
);

/* ---------------------------------------------------------------- */
/*  LA HOJA COMO ORIGEN                                              */
/* ---------------------------------------------------------------- */

const llama = (accion, datos) =>
  JSON.parse(
    contexto
      .manejaAlertas({
        postData: {
          contents: JSON.stringify(Object.assign({ action: accion }, datos)),
        },
      })
      .getContent(),
  );

const enUnRato = (minutos) =>
  new Date(Date.now() + minutos * 60000).toISOString();

const alerta = {
  id: "ALE-PRUEBA",
  titulo: "Mandar el informe del rival",
  mensaje: "Antes del entrenamiento",
  destinatarios: ["uno@ejemplo.com", "dos@ejemplo.com"],
  adjuntos: [],
  proximoEnvio: enUnRato(-1),
  repeticion: "diaria",
  intervaloDias: 7,
  activa: true,
  creada: new Date().toISOString(),
  ultimoEnvio: null,
  envios: 0,
};

/* 9. Alta y relectura: lo guardado tiene que volver igual. */
comprueba(
  "guardarAlerta → la hoja la acepta",
  llama("guardarAlerta", { alerta }).ok === true,
);

const listada = llama("listarAlertas").alertas[0];

comprueba(
  "listarAlertas → devuelve la tarea recién guardada, entera",
  listada &&
    listada.id === alerta.id &&
    listada.titulo === alerta.titulo &&
    listada.destinatarios.length === 2 &&
    listada.repeticion === "diaria",
  listada,
);

comprueba(
  "listarAlertas → dice si el disparador está puesto",
  llama("listarAlertas").disparador === true,
);

disparadores = [];

comprueba(
  "listarAlertas → avisa cuando NO hay disparador (nadie mandaría nada)",
  llama("listarAlertas").disparador === false,
);

disparadores = [{ getHandlerFunction: () => "revisarAlertas" }];

/* 10. El repaso del disparador: manda y adelanta la fecha. */
enviados.length = 0;

const mandadas = contexto.revisarAlertas();

comprueba(
  "revisarAlertas → manda la que ya tocaba",
  mandadas === 1 && enviados.length === 1,
  { mandadas, enviados: enviados.length },
);

const trasEnviar = llama("listarAlertas").alertas[0];

comprueba(
  "revisarAlertas → apunta el envío y adelanta la próxima fecha",
  trasEnviar.envios === 1 &&
    !!trasEnviar.ultimoEnvio &&
    new Date(trasEnviar.proximoEnvio) > new Date(),
  trasEnviar,
);

comprueba(
  "revisarAlertas → no la vuelve a mandar en la pasada siguiente",
  contexto.revisarAlertas() === 0,
);

/*
 * 11. LO QUE MÁS IMPORTA: guardar con una copia vieja no puede repetir el
 *     correo. La pantalla tiene en la mano la alerta de ANTES del envío
 *     —envíos a 0 y la fecha ya cumplida—; al silenciarla escribe esa copia.
 */
const copiaVieja = Object.assign({}, alerta, { activa: false });

llama("guardarAlerta", { alerta: copiaVieja });

const trasGuardar = llama("listarAlertas").alertas[0];

comprueba(
  "guardar con una copia vieja → no borra el envío ya hecho",
  trasGuardar.envios === 1 && trasGuardar.ultimoEnvio === trasEnviar.ultimoEnvio,
  trasGuardar,
);

comprueba(
  "guardar con una copia vieja → no devuelve la alarma al pasado",
  trasGuardar.proximoEnvio === trasEnviar.proximoEnvio,
  trasGuardar,
);

comprueba(
  "guardar con una copia vieja → sí aplica lo que se cambió (silenciada)",
  trasGuardar.activa === false,
  trasGuardar,
);

enviados.length = 0;

comprueba(
  "y por tanto no sale un segundo correo",
  contexto.revisarAlertas() === 0 && enviados.length === 0,
);

/* 12. Mover la alarma a mano hacia adelante sí tiene que funcionar. */
llama("guardarAlerta", {
  alerta: Object.assign({}, trasGuardar, {
    activa: true,
    proximoEnvio: enUnRato(60),
  }),
});

comprueba(
  "cambiar la fecha a mano hacia adelante → se respeta",
  Math.abs(
    new Date(llama("listarAlertas").alertas[0].proximoEnvio) - Date.now(),
  ) >
    50 * 60000,
);

/* 13. Borrar. */
comprueba(
  "borrarAlerta → la quita de la hoja",
  llama("borrarAlerta", { id: alerta.id }).ok === true &&
    llama("listarAlertas").alertas.length === 0,
);

/* ---------------------------------------------------------------- */
/*  SIN PERMISO DE CORREO                                            */
/* ---------------------------------------------------------------- */

/*
| El caso del 28/08/2026: la hoja lista y guarda —para eso le basta el permiso
| del libro—, pero nadie aceptó nunca el de MailApp, así que el primer envío
| revienta. Lo que se comprueba es que el motivo se cuente con palabras y que
| comprobarAlertas deje de decir BIEN.
*/
const cupoDeVerdad = contexto.MailApp.getRemainingDailyQuota;

contexto.MailApp.getRemainingDailyQuota = () => {
  throw new Error(
    "Exception: You do not have permission to call MailApp.sendEmail",
  );
};

llama("guardarAlerta", {
  alerta: Object.assign({}, alerta, {
    activa: true,
    envios: 0,
    ultimoEnvio: "",
    proximoEnvio: enUnRato(60),
  }),
});

const sinPermiso = llama("enviarAlertaAhora", { id: alerta.id });

comprueba(
  "sin permiso de correo → el error dice qué hay que ejecutar",
  sinPermiso.ok === false && /autorizarCorreo/.test(sinPermiso.error || ""),
  sinPermiso,
);

comprueba(
  "sin permiso de correo → comprobarAlertas ya no dice BIEN",
  contexto.comprobarAlertas() === "A MEDIAS",
);

comprueba(
  "sin permiso de correo → autorizarCorreo dice MAL",
  contexto.autorizarCorreo() === "MAL",
);

contexto.MailApp.getRemainingDailyQuota = cupoDeVerdad;

comprueba(
  "con el permiso puesto → autorizarCorreo dice BIEN",
  contexto.autorizarCorreo() === "BIEN",
);

llama("borrarAlerta", { id: alerta.id });

console.log(fallos === 0 ? "\nTODO BIEN" : `\n${fallos} FALLOS`);

process.exit(fallos === 0 ? 0 : 1);
