/* eslint-disable @typescript-eslint/no-require-imports -- arnés de Node: se
   carga con `node`, no lo empaqueta nadie, y el cargador de TypeScript necesita
   los ganchos de CommonJS. */
/*
  Repaso a fondo de lo tocado estos días, contra los módulos de verdad.

  No mira el código: lo ejecuta y comprueba lo que tiene que cumplirse siempre.
*/

require("./cargador-ts.cjs");

const motor = require("@/lib/rivals/campograma-motor");
const once = require("@/lib/rivals/once");
const pie = require("@/lib/rivals/pie");
const lanzadera = require("@/hooks/useLanzadera");

let fallos = 0;

const dice = (t) => process.stdout.write(t + "\n");

const comprueba = (que, bien, detalle = "") => {
  if (bien) {
    dice(`   ✓ ${que}`);
  } else {
    fallos += 1;
    dice(`   ✗ ${que}${detalle ? ` — ${detalle}` : ""}`);
  }
};

/* ================================================================== */
dice("\n=== EL REPARTO DEL CAMPOGRAMA ===");
/* ================================================================== */

/* Una plantilla como las de verdad: todos los puestos que escribe la hoja. */
const PLANTILLA = [
  { n: "portero1", slot: "por", lado: 0 },
  { n: "portero2", slot: "por", lado: 0 },
  { n: "lateralIzq", slot: "li", lado: 0 },
  { n: "lateralIzq2", slot: "li", lado: 0 },
  { n: "lateralDcho", slot: "ld", lado: 0 },
  { n: "lateralDcho2", slot: "ld", lado: 0 },
  { n: "carrilero", slot: "car", lado: 0 },
  { n: "carrileroIzq", slot: "car", lado: -1 },
  { n: "central1", slot: "dfc", lado: 0 },
  { n: "central2", slot: "dfc", lado: 0 },
  { n: "central3", slot: "dfc", lado: 0 },
  { n: "centralIzq", slot: "dfc", lado: -1 },
  { n: "defensa", slot: "def", lado: 0 },
  { n: "pivote", slot: "mcd", lado: 0 },
  { n: "medio1", slot: "mc", lado: 0 },
  { n: "medio2", slot: "med", lado: 0 },
  { n: "interior", slot: "int", lado: 0 },
  { n: "interiorDcho", slot: "int", lado: 1 },
  { n: "mediapunta", slot: "mp", lado: 0 },
  { n: "segundaPunta", slot: "sd", lado: 0 },
  { n: "extremoIzq", slot: "ei", lado: 0 },
  { n: "extremoDcho", slot: "ed", lado: 0 },
  { n: "extremo", slot: "ext", lado: 0 },
  { n: "delantero1", slot: "dc", lado: 0 },
  { n: "delantero2", slot: "dc", lado: 0 },
  { n: "raro", slot: "loQueSea", lado: 0 },
  { n: "vacio", slot: "", lado: 0 },
];

const LADO_ESPERADO = {
  li: -1,
  ei: -1,
  ld: 1,
  ed: 1,
};

for (const dibujo of motor.DIBUJOS) {
  dice(`\n · ${dibujo.id}`);

  const reparto = motor.reparteEnOnce(
    PLANTILLA,
    (j) => ({ slot: j.slot, lado: j.lado }),
    dibujo.bloques,
  );

  const colocados = [...reparto.values()].flat();

  comprueba(
    `no se pierde a nadie (${colocados.length} de ${PLANTILLA.length})`,
    colocados.length === PLANTILLA.length,
    `faltan ${PLANTILLA.filter((j) => !colocados.includes(j)).map((j) => j.n).join(", ")}`,
  );

  comprueba(
    "nadie repetido",
    new Set(colocados).size === colocados.length,
  );

  /* La portería, sólo para porteros; y ningún portero fuera de ella. */
  const enPorteria = reparto.get("por") ?? [];

  comprueba(
    "en la portería sólo hay porteros",
    enPorteria.every((j) => j.slot === "por"),
    enPorteria.filter((j) => j.slot !== "por").map((j) => j.n).join(", "),
  );

  comprueba(
    "los porteros están en la portería",
    PLANTILLA.filter((j) => j.slot === "por").every((j) => enPorteria.includes(j)),
  );

  /* Los puestos con lado propio, en su lado. */
  const porBloque = new Map(
    dibujo.bloques.map((b) => [b.key, b]),
  );

  let ladoMal = [];

  for (const [clave, gente] of reparto) {
    const bloque = porBloque.get(clave);

    for (const jugador of gente) {
      const suyo = LADO_ESPERADO[jugador.slot];

      if (!suyo) continue;

      /* Sólo se exige si el dibujo tiene un bloque de ese lado para su
         familia; si no lo tiene, ir al centro es lo correcto. */
      const hayDeSuLado = dibujo.bloques.some(
        (b) => b.lado === suyo && b.admite.some((f) => ["lateral", "extremo"].includes(f)),
      );

      if (hayDeSuLado && bloque.lado !== 0 && bloque.lado !== suyo) {
        ladoMal.push(`${jugador.n} → ${clave}(${bloque.lado})`);
      }
    }
  }

  comprueba(
    "los puestos con lado propio, en su lado",
    ladoMal.length === 0,
    ladoMal.join(", "),
  );

  /* Y el lado que viene de la hoja, respetado. */
  let ladoDeHoja = [];

  for (const [clave, gente] of reparto) {
    const bloque = porBloque.get(clave);

    for (const jugador of gente) {
      if (jugador.lado === 0 || LADO_ESPERADO[jugador.slot]) continue;

      const hayDeSuLado = dibujo.bloques.some((b) => b.lado === jugador.lado);

      if (hayDeSuLado && bloque.lado !== 0 && bloque.lado !== jugador.lado) {
        ladoDeHoja.push(`${jugador.n} → ${clave}(${bloque.lado})`);
      }
    }
  }

  comprueba(
    "el lado que trae la hoja, respetado",
    ladoDeHoja.length === 0,
    ladoDeHoja.join(", "),
  );
}

/* ================================================================== */
dice("\n=== LA FORMA DE LOS BLOQUES ===");
/* ================================================================== */

for (let n = 1; n <= 9; n += 1) {
  const cols = motor.columnasDeBloque(n);
  const filas = Math.ceil(n / cols);

  const cuadrado = Math.abs(cols - filas) <= 1 || cols === 3;

  comprueba(
    `${n} jugadores → ${cols}×${filas}`,
    cols >= 1 && cols <= 3 && cols <= n && cuadrado,
  );
}

comprueba("2 siguen en línea (la pareja de centrales)", motor.columnasDeBloque(2) === 2);
comprueba("3 ya no son una tira", motor.columnasDeBloque(3) === 2);

/* ================================================================== */
dice("\n=== EL DOCUMENTO DEL ONCE ===");
/* ================================================================== */

const CLAVE = "bs:1";
const OTRA = "bs:2";

let doc = once.normalizarOnce({
  titulares: [CLAVE],
  dudas: [OTRA],
  enCampo: [OTRA],
  campo: { [CLAVE]: { x: 0.4, y: 0.6 } },
  dibujo: "3-5-2",
});

comprueba("el dibujo se lee del documento", doc.dibujo === "3-5-2");

const operaciones = [
  ["conEstado (marcar)", (d) => once.conEstado(d, "bs:3", "titular")],
  ["conEstado (quitar)", (d) => once.conEstado(d, CLAVE, null)],
  ["conPosicion", (d) => once.conPosicion(d, CLAVE, { x: 0.2, y: 0.2 })],
  ["conEnCampo", (d) => once.conEnCampo(d, OTRA, false)],
  ["conSustitucion", (d) => once.conSustitucion(d, CLAVE, "bs:9")],
  ["sinPosiciones", (d) => once.sinPosiciones(d)],
  ["conOnce (proponer)", (d) => once.conOnce(d, ["bs:5", "bs:6"], {})],
  ["conDibujo", (d) => once.conDibujo(d, "4-4-2")],
];

for (const [nombre, hazlo] of operaciones) {
  const salida = hazlo(doc);

  const esperado = nombre === "conDibujo" ? "4-4-2" : "3-5-2";

  comprueba(
    `${nombre} conserva el dibujo`,
    salida.dibujo === esperado,
    `ha quedado ${JSON.stringify(salida.dibujo)}`,
  );
}

/* Y que pasar por normalizar no lo pierde tampoco. */
comprueba(
  "normalizar dos veces no lo pierde",
  once.normalizarOnce(once.normalizarOnce(doc)).dibujo === "3-5-2",
);

comprueba(
  "un dibujo que no es texto se ignora",
  once.normalizarOnce({ dibujo: 7 }).dibujo === undefined,
);

/* ================================================================== */
dice("\n=== EL PIE DOMINANTE ===");
/* ================================================================== */

const PIES = [
  ["Diestro", "DIESTRO", "DIESTRO", "D"],
  ["DCHO", "DIESTRO", "DIESTRO", "D"],
  ["zurda", "ZURDO", "ZURDO", "Z"],
  ["IZDO", "ZURDO", "ZURDO", "Z"],
  ["Ambidiestro", "AMBIDIESTRO", "AMBOS", "A"],
  ["ambos", "AMBIDIESTRO", "AMBOS", "A"],
  ["", "", "", ""],
  [".", "", "", ""],
  [undefined, "", "", ""],
];

for (const [entra, largo, chapa, inicial] of PIES) {
  comprueba(
    `«${entra}» → ${largo || "(nada)"} / ${chapa || "(nada)"} / ${inicial || "(nada)"}`,
    pie.pieDominante(entra) === largo &&
      pie.pieChapa(entra) === chapa &&
      pie.pieInicial(entra) === inicial,
    `${pie.pieDominante(entra)} / ${pie.pieChapa(entra)} / ${pie.pieInicial(entra)}`,
  );
}

/* ================================================================== */
dice("\n=== LA LANZADERA ===");
/* ================================================================== */

const v = lanzadera.velocidadDeLanzadera;
const r = lanzadera.velocidadDeRebobinado;

comprueba("quieta es ×1", v(0) === 1 && v(10) === 1 && v(-10) === 1);
comprueba("a la derecha sube", v(30) > 1 && v(200) > v(30));
comprueba("a la izquierda baja", v(-30) < 1 && v(-200) < v(-30));
comprueba("nunca negativa", [-1000, -100, 0, 100, 1000].every((p) => v(p) > 0));
comprueba(
  "topes de la escalera",
  v(100000) === 8 && v(-100000) === 0.1,
  `${v(100000)} / ${v(-100000)}`,
);
comprueba("monótona a la derecha", (() => {
  let anterior = 0;

  for (let p = 0; p < 500; p += 5) {
    if (v(p) < anterior) return false;
    anterior = v(p);
  }

  return true;
})());

comprueba("rebobinar da igual arriba que abajo", r(120) === r(-120));
comprueba("más lejos, más rápido", r(300) > r(60));
comprueba("tope del rebobinado", r(100000) === 8, String(r(100000)));
comprueba("el rebobinado nunca es cero", [0, 5, 50, 500].every((p) => r(p) > 0));

/* ================================================================== */
dice(
  fallos === 0
    ? "\n================  TODO CORRECTO  ================"
    : `\n================  ${fallos} FALLO(S)  ================`,
);

process.exit(fallos === 0 ? 0 : 1);
