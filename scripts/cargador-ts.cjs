/* eslint-disable @typescript-eslint/no-require-imports -- arnés de Node: se
   carga con `node`, no lo empaqueta nadie, y el cargador de TypeScript necesita
   los ganchos de CommonJS. */
/*
  Carga módulos .ts del repo en Node, con los alias `@/` resueltos.

  Es el arnés de siempre de este proyecto: transpila con el TypeScript que ya
  está en node_modules y mapea `@/x` a la raíz. `esModuleInterop` NO es
  opcional: sin él, cualquier import por defecto sale `undefined`.
*/

const path = require("path");
const fs = require("fs");
const Module = require("module");

/* La raíz del repo, se llame como se llame la carpeta y esté donde esté. */
const RAIZ = path.join(__dirname, "..");

const ts = require(path.join(RAIZ, "node_modules/typescript"));

for (const extension of [".ts", ".tsx"]) {
  Module._extensions[extension] = (modulo, fichero) => {
    const fuente = fs.readFileSync(fichero, "utf8");

    const salida = ts.transpileModule(fuente, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
        esModuleInterop: true,
        jsx: ts.JsxEmit.ReactJSX,
      },
      fileName: fichero,
    }).outputText;

    modulo._compile(salida, fichero);
  };
}

const resolver = Module._resolveFilename;

Module._resolveFilename = function (peticion, ...resto) {
  if (peticion.startsWith("@/")) {
    const base = path.join(RAIZ, peticion.slice(2));

    for (const extension of ["", ".ts", ".tsx", ".js", "/index.ts"]) {
      if (fs.existsSync(base + extension)) {
        return resolver.call(this, base + extension, ...resto);
      }
    }
  }

  return resolver.call(this, peticion, ...resto);
};

module.exports = { RAIZ };
