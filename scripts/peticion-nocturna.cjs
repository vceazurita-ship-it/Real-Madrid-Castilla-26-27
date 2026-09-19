/* eslint-disable @typescript-eslint/no-require-imports -- arnés de Node: se
   ejecuta con `node` desde el .cmd de la tarea nocturna, no lo empaqueta nadie. */
/**
 * LOS ENCARGOS DESDE LA APP, VISTOS DESDE EL ORDENADOR DEL CLUB.
 *
 * Los botones de Ajustes no ejecutan nada —el servidor no puede bajar de
 * BeSoccer ni de Wyscout—: dejan un encargo en el documento `mantenimiento`,
 * uno por tarea (`quiniela`, `rivales`, `wyscout`). La forma del documento y
 * las reglas están en `lib/mantenimiento.ts`; esto es la herramienta de línea
 * de órdenes para los `.cmd`:
 *
 *   node scripts/peticion-nocturna.cjs --hay [tarea]      → código 0 si está pedida
 *   node scripts/peticion-nocturna.cjs --empieza [tarea]
 *   node scripts/peticion-nocturna.cjs --hecho [tarea] "nota" [--fallo]
 *
 * Sin tarea es la de los rivales, que es lo que llamaba el .cmd antes de que
 * hubiera más de una. El `--hay` se usa desde un `.cmd`, así que lo que importa
 * es el código de salida: 0 es «sí, hazlo».
 */

const path = require("path");

const RAIZ = path.join(__dirname, "..");

require(path.join(RAIZ, "scripts/cargador-ts.cjs"));

const { createClient } = require(path.join(RAIZ, "node_modules/@supabase/supabase-js"));

const {
  CLAVE_MANTENIMIENTO,
  esTarea,
  estadoEncargo,
  normalizaMantenimiento,
} = require(path.join(RAIZ, "lib/mantenimiento.ts"));

const { entorno, salir } = require(path.join(RAIZ, "scripts/supabase-local.cjs"));

/** La orden, la tarea y la nota, se escriban como se escriban. */
function argumentos() {
  const args = process.argv.slice(2);

  const orden = ["--hay", "--empieza", "--hecho"].find((o) => args.includes(o));

  const resto = args.filter((a) => a !== orden && a !== "--fallo");

  const tarea = esTarea(resto[0]) ? resto.shift() : "rivales";

  return { orden, tarea, nota: resto[0] ?? "", fallo: args.includes("--fallo") };
}

async function main() {
  const { orden, tarea, nota, fallo } = argumentos();

  if (!orden) {
    console.log("[peticion] uso: --hay | --empieza | --hecho [tarea] [nota] [--fallo]");

    return salir(1);
  }

  const env = entorno();

  if (!env) {
    /* Sin llaves no se puede mirar; que no pare nada. */
    console.log("[peticion] sin credenciales de Supabase: no se mira.");

    return salir(1);
  }

  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

  const { data, error } = await supabase
    .from("app_documents")
    .select("data")
    .eq("key", CLAVE_MANTENIMIENTO)
    .maybeSingle();

  if (error) {
    console.log(`[peticion] no se ha podido leer: ${error.message}`);

    return salir(1);
  }

  const estado = normalizaMantenimiento(data?.data);

  const suyo = estado[tarea] ?? {};

  if (orden === "--hay") {
    if (estadoEncargo(tarea, suyo) === "pedido") {
      console.log(`[peticion] hay un encargo de ${tarea} de ${suyo.pedidoEn}.`);

      return salir(0);
    }

    console.log(`[peticion] no hay encargos de ${tarea} pendientes.`);

    return salir(1);
  }

  const ahora = new Date().toISOString();

  const cambio =
    orden === "--empieza"
      ? { empezadoEn: ahora }
      : { hechoEn: ahora, resultado: nota, ok: !fallo };

  const { error: alEscribir } = await supabase.from("app_documents").upsert(
    {
      key: CLAVE_MANTENIMIENTO,
      kind: "mantenimiento",
      data: { ...estado, [tarea]: { ...suyo, ...cambio } },
      updated_at: ahora,
    },
    { onConflict: "key" },
  );

  if (alEscribir) {
    console.log(`[peticion] no se ha podido marcar: ${alEscribir.message}`);

    return salir(1);
  }

  console.log(`[peticion] ${tarea}: ${orden === "--empieza" ? "empezada" : "marcada como hecha"}.`);

  return salir(0);
}

main().catch((error) => {
  console.log(`[peticion] ${error.message}`);

  salir(1);
});
