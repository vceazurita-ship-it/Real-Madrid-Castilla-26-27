/**
 * Arnés del Apps Script de alertas.
 *
 * `alertas.gs` es JavaScript corriente, así que se puede cargar en Node con la
 * hoja de mentira y comprobar el enganche del `doPost` sin tocar la cuenta de
 * Google: las cuatro formas de llamar y qué devuelve cada una.
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

function hojaFalsa(nombre) {
  const filas = [];

  return {
    nombre,
    getLastRow: () => filas.length + 1,
    getMaxRows: () => filas.length + 100,
    setFrozenRows: () => {},
    getRange: () => ({
      setValues: () => {},
      getValues: () => filas,
      setNumberFormat: () => {},
    }),
  };
}

const hojas = new Map();

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
    getProjectTriggers: () => [
      { getHandlerFunction: () => "revisarAlertas" },
    ],
  },
  MailApp: { sendEmail: () => {} },
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

console.log(fallos === 0 ? "\nTODO BIEN" : `\n${fallos} FALLOS`);

process.exit(fallos === 0 ? 0 : 1);
