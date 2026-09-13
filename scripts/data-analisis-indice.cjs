/**
 * Deja la carpeta de datos ya leída en `public/data/analisis.json`.
 *
 * **Por qué hace falta.** En local, `/api/data-analisis` abre la carpeta con
 * `readdir` y todo funciona: se dejan ficheros nuevos, se pulsa «Releer la
 * carpeta» y aparecen. Desplegado no: Next sube `public/` al CDN pero **la
 * función no tiene esa carpeta en su disco**, así que el `readdir` no encuentra
 * nada y la pantalla sale vacía. Que es exactamente lo que pasó.
 *
 * La salida es un fichero estático más, así que en el despliegue lo sirve el
 * CDN y la función se lo pide por HTTP a su propio origen. En local sigue
 * mandando la carpeta de verdad: es lo que permite soltar un informe el jueves
 * y verlo sin recompilar.
 *
 * Se ejecuta antes de `next build` (ver `package.json`). Si algo falla **no
 * tumba la compilación**: se avisa y se sigue, porque una pantalla de datos
 * vacía es un problema menor que no poder desplegar.
 *
 * El parser es el mismo de la app (`lib/data-analisis/leer.ts`), cargado con un
 * transpilador al vuelo: duplicar aquí la lectura de los `.xlsx` sería la forma
 * más rápida de que el índice y la pantalla dejaran de contar lo mismo.
 */
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");

const RAIZ = path.join(__dirname, "..");

const SALIDA = path.join(RAIZ, "public", "data", "analisis.json");

/* --------------------- CARGADOR DE TYPESCRIPT --------------------- */

const ts = require(path.join(RAIZ, "node_modules", "typescript"));

Module._extensions[".ts"] = (modulo, fichero) =>
  modulo._compile(
    ts.transpileModule(fs.readFileSync(fichero, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
        /* Sin esto, `import { unzipSync } from "fflate"` compila a algo que
           busca `.default` y revienta al primer fichero. */
        esModuleInterop: true,
      },
      fileName: fichero,
    }).outputText,
    fichero,
  );

const resuelve = Module._resolveFilename;

Module._resolveFilename = function (pedido, ...resto) {
  if (pedido.startsWith("@/")) {
    return resuelve.call(this, path.join(RAIZ, pedido.slice(2)), ...resto);
  }

  return resuelve.call(this, pedido, ...resto);
};

/* --------------------------- EL TRABAJO --------------------------- */

(async () => {
  const { leeDatos, compactaIndice } = require(
    path.join(RAIZ, "lib", "data-analisis", "leer.ts"),
  );

  const datos = await leeDatos();

  fs.mkdirSync(path.dirname(SALIDA), { recursive: true });

  /* Los rótulos de las métricas de jugador, una sola vez: ver compactaIndice. */
  fs.writeFileSync(SALIDA, JSON.stringify(compactaIndice(datos)), "utf8");

  const megas = (fs.statSync(SALIDA).size / 1024 / 1024).toFixed(2);

  console.log(
    `[data-analisis] índice escrito: ${datos.partidos.length} filas · ` +
      `${datos.equipos.length} equipos · ${datos.eventos.length} logs · ${megas} MB`,
  );
})().catch((error) => {
  console.warn(
    "[data-analisis] no se ha podido montar el índice, se sigue sin él:",
    error?.message ?? error,
  );
});
