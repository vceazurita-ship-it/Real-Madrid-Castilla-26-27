/* eslint-disable @typescript-eslint/no-require-imports -- arnés de Node: lo
   cargan los scripts del ordenador del club, no lo empaqueta nadie. */
/**
 * Las llaves de Supabase y la salida limpia, para los scripts del ordenador
 * del club.
 */

const fs = require("node:fs");
const path = require("path");

const RAIZ = path.join(__dirname, "..");

/** `.env.local` y, encima, lo que venga en el entorno. `null` si faltan. */
function entorno() {
  const env = {};

  const fichero = path.join(RAIZ, ".env.local");

  if (fs.existsSync(fichero)) {
    for (const linea of fs.readFileSync(fichero, "utf8").split("\r").join("").split("\n")) {
      const trozo = linea.match(/^([A-Z0-9_]+)=(.*)$/);

      if (trozo) env[trozo[1]] = trozo[2].trim();
    }
  }

  for (const clave of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
    if (process.env[clave]) env[clave] = process.env[clave];
  }

  return env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY ? env : null;
}

/**
 * Salir con un código, sin reventar.
 *
 * `process.exit()` a secas, con el cliente de Supabase todavía abierto, tumba
 * a Node en Windows con una aserción de libuv —«!(handle->flags &
 * UV_HANDLE_CLOSING)»— y el proceso acaba con **127**. En un `.cmd` eso es
 * justo lo contrario de lo que se pregunta: 127 no es 0 ni es 1. Así que se
 * marca el código y se deja terminar solo; el cierre a la fuerza queda como
 * red, sin sujetar el proceso (`unref`).
 */
function salir(codigo) {
  process.exitCode = codigo;

  setTimeout(() => process.exit(codigo), 150).unref();
}

module.exports = { RAIZ, entorno, salir };
