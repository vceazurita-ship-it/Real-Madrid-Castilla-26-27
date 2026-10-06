import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Una variable o argumento que empieza por «_» se deja sin usar a propósito
  // (p. ej. `const { fuera: _fuera, ...resto } = obj` para quitar una clave).
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
        },
      ],
    },
  },
  // Los scripts de Node (CommonJS) usan require() con todo derecho.
  {
    files: ["scripts/**/*.{js,cjs,mjs}", "*.cjs", "*.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Ficheros de depuración temporales, no son código de la app.
    ".cache/**",
  ]),
]);

export default eslintConfig;
