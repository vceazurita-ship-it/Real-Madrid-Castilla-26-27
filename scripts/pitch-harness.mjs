/*
 * Saca `layoutPitch` de app/rivals/page.tsx sin navegador: transpila el
 * fichero a CommonJS, le da un `require` de mentira (nada de React ni de
 * Next) y ejecuta el cuerpo del módulo, que es donde viven las constantes y
 * el motor. Los componentes quedan definidos pero no se pintan.
 *
 * El único `require` de verdad es el del motor de colocación
 * (`lib/rivals/campograma-motor.ts`), que es donde vive la geometría desde que
 * la comparten la pantalla y el .pptx de día de partido: si se le diera el
 * doble, `layoutPitch` no colocaría a nadie.
 */
import fs from "node:fs";
import ts from "typescript";
import vm from "node:vm";

const compila = (ruta) =>
  ts.transpileModule(fs.readFileSync(ruta, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.React,
    },
  }).outputText;

const src = compila(new URL("../app/rivals/page.tsx", import.meta.url));

const stub = new Proxy(function () {}, {
  get: (_t, prop) => (prop === "__esModule" ? true : stub),
  apply: () => stub,
  construct: () => stub,
});

/* El motor, de verdad: se ejecuta en su propio contexto y se devuelve tal cual
   cuando la página lo pida. */
const motorExports = {};

const motorSandbox = {
  exports: motorExports,
  module: { exports: motorExports },
  require: () => stub,
  console,
};

vm.createContext(motorSandbox);

vm.runInContext(
  compila(new URL("../lib/rivals/campograma-motor.ts", import.meta.url)),
  motorSandbox,
);

const exportsObj = {};

const sandbox = {
  require: (nombre) =>
    nombre === "@/lib/rivals/campograma-motor"
      ? motorSandbox.module.exports
      : stub,
  exports: exportsObj,
  module: { exports: exportsObj },
  console,
  React: stub,
  window: undefined,
  __EXPORT__: null,
};

vm.createContext(sandbox);

vm.runInContext(
  src + "\n;__EXPORT__ = { layoutPitch, cardMetrics, parseTags, getSlot };",
  sandbox,
);

export const { layoutPitch, cardMetrics, parseTags, getSlot } = sandbox.__EXPORT__;
