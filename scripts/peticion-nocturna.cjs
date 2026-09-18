/* eslint-disable @typescript-eslint/no-require-imports -- arnés de Node: se
   ejecuta con `node` desde el .cmd de la tarea nocturna, no lo empaqueta nadie. */
/**
 * ¿HAY UN ENCARGO DESDE LA APP?
 *
 * El botón de Ajustes no ejecuta nada —el servidor no puede bajar de BeSoccer—:
 * deja un encargo en el documento `mantenimiento`. Esto es lo que lo mira desde
 * el ordenador del club, para que el trabajo nocturno lo atienda aunque ya
 * hubiera hecho su pasada de hoy.
 *
 *   node scripts/peticion-nocturna.cjs --hay     → código 0 si hay encargo
 *   node scripts/peticion-nocturna.cjs --hecho "sin incidencias"
 *
 * El `--hay` se usa desde un `.cmd`, así que lo que importa es el código de
 * salida y no lo que escriba: 0 es «sí, hazlo».
 */

const fs = require("node:fs");
const path = require("path");

const RAIZ = path.join(__dirname, "..");

const { createClient } = require(path.join(RAIZ, "node_modules/@supabase/supabase-js"));

const CLAVE = "mantenimiento";

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

  return env;
}

async function main() {
  const env = entorno();

  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    /* Sin llaves no se puede mirar; que no pare nada. */
    console.log("[peticion] sin credenciales de Supabase: no se mira.");

    return salir(1);
  }

  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

  const { data, error } = await supabase
    .from("app_documents")
    .select("data")
    .eq("key", CLAVE)
    .maybeSingle();

  if (error) {
    console.log(`[peticion] no se ha podido leer: ${error.message}`);

    return salir(1);
  }

  const estado = data?.data ?? {};

  if (process.argv.includes("--hecho")) {
    const donde = process.argv.indexOf("--hecho");

    const nota = process.argv[donde + 1] ?? "";

    const { error: alEscribir } = await supabase.from("app_documents").upsert(
      {
        key: CLAVE,
        kind: "mantenimiento",
        data: { ...estado, hechoEn: new Date().toISOString(), resultado: nota },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" },
    );

    if (alEscribir) {
      console.log(`[peticion] no se ha podido marcar: ${alEscribir.message}`);

      return salir(1);
    }

    console.log("[peticion] marcada como hecha.");

    return salir(0);
  }

  /* --hay: pendiente es «se pidió después de la última vez que se hizo». */
  const pedido = estado.pedidoEn ? Date.parse(estado.pedidoEn) : 0;

  const hecho = estado.hechoEn ? Date.parse(estado.hechoEn) : 0;

  if (pedido && pedido > hecho) {
    console.log(`[peticion] hay un encargo de ${estado.pedidoEn}.`);

    return salir(0);
  }

  console.log("[peticion] no hay encargos pendientes.");

  return salir(1);
}

main().catch((error) => {
  console.log(`[peticion] ${error.message}`);

  salir(1);
});
