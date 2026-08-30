/*
 * Comprueba el reparto del campograma de día de partido sin navegador.
 *
 * `reparteAlineacion` es geometría pura —no toca ni el lienzo ni la red—, así
 * que se puede transpilar y alimentar con plantillas de mentira para contar
 * solapes, que es el único fallo que de verdad importa en este documento: dos
 * fichas encima no se pueden borrar por separado sin arrastrar a la de abajo.
 *
 *   node scripts/alineacion-harness.cjs [plantilla.json]
 *
 * Sin argumento prueba cinco plantillas: la de once justo, dos reales de 22 y
 * 25, una de 30 y una torcida —todos centrales— que es la que descubre si el
 * motor se rinde cuando un bloque no cabe en su banda.
 *
 * Vive dentro del repo a propósito: fuera no resolvería `typescript`.
 */

const fs = require("fs");
const path = require("path");
const Module = require("module");

const ROOT = path.resolve(__dirname, "..");
const ts = require(path.join(ROOT, "node_modules/typescript"));

/* ---- Cargador de .ts y de los alias @/ ---- */

const resolveOriginal = Module._resolveFilename;

Module._resolveFilename = function (peticion, ...resto) {
  if (peticion.startsWith("@/")) {
    return resolveOriginal.call(this, path.join(ROOT, peticion.slice(2)), ...resto);
  }

  return resolveOriginal.call(this, peticion, ...resto);
};

const compila = (modulo, archivo) =>
  modulo._compile(
    ts.transpileModule(fs.readFileSync(archivo, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
        esModuleInterop: true,
      },
      fileName: archivo,
    }).outputText,
    archivo,
  );

Module._extensions[".ts"] = compila;
Module._extensions[".tsx"] = compila;

/*
 * `next/font` no existe fuera de Next y `alineacion-ppt` lo arrastra por
 * `portada-font`. Como aquí sólo se llama al motor, se le da un doble.
 */
require.cache[require.resolve(path.join(ROOT, "lib/rivals/portada-font.ts"))] = {
  id: "portada-font",
  filename: "portada-font",
  loaded: true,
  exports: {
    FAMILIA_PORTADA: '"Barlow Condensed", sans-serif',
    esperaFuentePortada: async () => undefined,
  },
};

const { reparteAlineacion } = require(
  path.join(ROOT, "lib/rivals/alineacion-ppt.ts"),
);

/* ---- Plantillas de mentira ---- */

let siguiente = 1;

function jugador(slot, lado = 0) {
  const numero = siguiente;

  siguiente += 1;

  return {
    clave: `x${numero}`,
    dorsal: String(numero),
    nombre: `JUGADOR ${numero}`,
    slot,
    lado,
    edad: "24",
    pie: "DCHO",
    altura: "1,82",
    peso: "76",
    foto: "",
    estado: "",
    portero: slot === "por",
    titular: 12,
    goles: 3,
    encajados: null,
  };
}

function plantilla(receta) {
  siguiente = 1;

  return receta.flatMap(([slot, cuantos, lado = 0]) =>
    Array.from({ length: cuantos }, () => jugador(slot, lado)),
  );
}

const CASOS = {
  "once justo": plantilla([
    ["por", 1],
    ["li", 1],
    ["dfc", 2],
    ["ld", 1],
    ["mcd", 1],
    ["mc", 2],
    ["ei", 1],
    ["dc", 1],
    ["ed", 1],
  ]),
  "plantilla de 22": plantilla([
    ["por", 3],
    ["li", 2],
    ["dfc", 4],
    ["ld", 2],
    ["mcd", 2],
    ["mc", 3],
    ["mp", 1],
    ["ei", 2],
    ["dc", 2],
    ["ed", 1],
  ]),
  "plantilla de 25": plantilla([
    ["por", 3],
    ["li", 3],
    ["dfc", 5],
    ["ld", 2],
    ["mcd", 2],
    ["mc", 4],
    ["mp", 1],
    ["ei", 2],
    ["dc", 2],
    ["ed", 1],
  ]),
  "plantilla de 30": plantilla([
    ["por", 4],
    ["li", 3],
    ["dfc", 6],
    ["ld", 3],
    ["mcd", 3],
    ["mc", 4],
    ["mp", 2],
    ["ei", 2],
    ["dc", 2],
    ["ed", 1],
  ]),
  "torcida: doce centrales": plantilla([
    ["por", 2],
    ["dfc", 12],
    ["mc", 2],
  ]),
  "sin posición": plantilla([["otros", 14]]),
};

/* ---- Medición ---- */

function solapes(fichas) {
  const casos = [];

  for (let i = 0; i < fichas.length; i += 1) {
    for (let j = i + 1; j < fichas.length; j += 1) {
      const a = fichas[i];
      const b = fichas[j];

      const dx = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const dy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);

      /* Medio punto porcentual de roce es un redondeo, no un solape. */
      if (dx > 0.002 && dy > 0.002) {
        casos.push({
          a: a.jugador.nombre,
          b: b.jugador.nombre,
          areaPct: +(((dx * dy) / (a.w * a.h)) * 100).toFixed(1),
        });
      }
    }
  }

  return casos;
}

function fuera(fichas) {
  return fichas.filter(
    (ficha) =>
      ficha.x < -0.002 ||
      ficha.y < -0.002 ||
      ficha.x + ficha.w > 1.002 ||
      ficha.y + ficha.h > 1.002,
  );
}

const argumento = process.argv[2];

const casos = argumento
  ? { [argumento]: JSON.parse(fs.readFileSync(argumento, "utf8")) }
  : CASOS;

let mal = 0;

for (const [nombre, jugadores] of Object.entries(casos)) {
  const { fichas, k } = reparteAlineacion(jugadores);

  const choques = solapes(fichas);
  const desbordes = fuera(fichas);

  /* El alto de la ficha en píxeles de diapositiva: por debajo de 160 el
     nombre deja de leerse proyectado. */
  const altoPx = Math.round((fichas[0]?.h ?? 0) * 1080);

  console.log(
    `${nombre.padEnd(26)} n=${String(jugadores.length).padStart(2)}  ` +
      `k=${k.toFixed(2)}  ficha=${altoPx}px  ` +
      `solapes=${choques.length}  fuera=${desbordes.length}`,
  );

  for (const choque of choques.slice(0, 4)) {
    console.log(`    ${choque.a} × ${choque.b} — ${choque.areaPct}%`);
  }

  for (const ficha of desbordes.slice(0, 4)) {
    console.log(
      `    fuera: ${ficha.jugador.nombre} ` +
        `x=${ficha.x.toFixed(3)} y=${ficha.y.toFixed(3)}`,
    );
  }

  if (choques.length || desbordes.length) mal += 1;
}

console.log(mal === 0 ? "\nTodo colocado sin solapes." : `\n${mal} casos con problemas.`);

process.exit(mal === 0 ? 0 : 1);
