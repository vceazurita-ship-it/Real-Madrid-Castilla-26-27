/*
 * Saca `layoutPitch` de app/rivals/page.tsx sin navegador: transpila el
 * fichero a CommonJS, le da un `require` de mentira (nada de React ni de
 * Next) y ejecuta el cuerpo del módulo, que es donde viven las constantes y
 * el motor. Los componentes quedan definidos pero no se pintan.
 */
import fs from "node:fs";
import ts from "typescript";
import vm from "node:vm";

const src = fs.readFileSync(
  new URL("../app/rivals/page.tsx", import.meta.url),
  "utf8",
);

const { outputText } = ts.transpileModule(src, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
    jsx: ts.JsxEmit.React,
  },
});

const stub = new Proxy(function () {}, {
  get: (_t, prop) => (prop === "__esModule" ? true : stub),
  apply: () => stub,
  construct: () => stub,
});

const exportsObj = {};

const sandbox = {
  require: () => stub,
  exports: exportsObj,
  module: { exports: exportsObj },
  console,
  React: stub,
  window: undefined,
  __EXPORT__: null,
};

vm.createContext(sandbox);

vm.runInContext(
  outputText + "\n;__EXPORT__ = { layoutPitch, cardMetrics, parseTags, getSlot };",
  sandbox,
);

export const { layoutPitch, cardMetrics, parseTags, getSlot } = sandbox.__EXPORT__;
