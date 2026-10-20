/**
 * EL BALÓN PARADO DE CADA LIGA, EN UN JSON PEQUEÑO
 *
 * El laboratorio de ABP (/laboratorio/abp/datos) compara el balón parado de
 * todos los equipos de una liga —los dos grupos de Primera RFEF y la Premier
 * League— con lo que Wyscout trae en los «Team Stats»: jugadas a balón parado,
 * córners, faltas y penaltis, cuántos acaban en remate, y lo mismo en contra
 * (cada informe trae también la fila del rival de cada partido).
 *
 * **Por qué un JSON y no los .xlsx.** La página no puede leer `public/` con
 * `readdir` una vez desplegada (ver `data-analisis-indice.cjs`), y los .xlsx de
 * tres ligas son decenas de megas que nadie necesita: de 109 columnas se usan
 * nueve. Aquí se leen con el MISMO parser de la app (`partidosDeXlsx` de
 * `lib/data-analisis/leer.ts`) y sale `public/data/abp-ligas.json`, unos pocos
 * KB por liga, que el navegador pide como un estático más.
 *
 *   node scripts/abp-ligas.cjs
 *
 * Una liga que nunca se ha bajado **no sale** en el JSON: la página enseña sólo
 * las ligas que hay (nada de «sin datos»). Una que ya estaba y cuya carpeta no
 * está aquí (Vercel) se deja como estaba.
 *
 * Igual que el índice de DATA, **no tumba la compilación** si algo falla.
 */
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");

const RAIZ = path.join(__dirname, "..");

const SALIDA = path.join(RAIZ, "public", "data", "abp-ligas.json");

/**
 * Las ligas y dónde deja cada una `wyscout-liga.mjs`. El Grupo 2 es la carpeta
 * de siempre (la que baja cada martes para DATA); las otras dos, las que baja
 * `actualizar-abp-ligas.cmd` con `--carpeta`.
 */
const LIGAS = [
  { slug: "primera-rfef-g2", nombre: "Primera RFEF · Grupo 2", corto: "1.ª RFEF G2", carpeta: "public/data/wys" },
  { slug: "primera-rfef-g1", nombre: "Primera RFEF · Grupo 1", corto: "1.ª RFEF G1", carpeta: "public/data/wys-ligas/primera-rfef-g1" },
  { slug: "premier-league", nombre: "Premier League", corto: "Premier", carpeta: "public/data/wys-ligas/premier-league" },
];

/** Las columnas de Wyscout que se guardan, en este orden (el de `lib/abp-ligas/modelo.ts`). */
const COLUMNAS = [
  "Jugadas a balón parado",
  "Jugadas a balón parado · con remate",
  "Córneres",
  "Córneres · con remate",
  "Tiros libres",
  "Tiros libres · con remate",
  "Penaltis",
  "Penaltis · marcados",
  "Tiros",
];

/* --------------------- CARGADOR DE TYPESCRIPT --------------------- */

const ts = require(path.join(RAIZ, "node_modules", "typescript"));

Module._extensions[".ts"] = (modulo, fichero) =>
  modulo._compile(
    ts.transpileModule(fs.readFileSync(fichero, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
      fileName: fichero,
    }).outputText,
    fichero,
  );

const resuelve = Module._resolveFilename;

Module._resolveFilename = function (pedido, ...resto) {
  if (pedido.startsWith("@/")) return resuelve.call(this, path.join(RAIZ, pedido.slice(2)), ...resto);

  return resuelve.call(this, pedido, ...resto);
};

/* --------------------------- EL TRABAJO --------------------------- */

/** La temporada empieza el 1 de julio, como en `temporadaDe` de DATA. */
const temporadaDe = (fecha) => {
  const año = Number(fecha.slice(0, 4));

  return fecha.slice(5, 10) >= "07-01" ? `${año}/${String(año + 1).slice(2)}` : `${año - 1}/${String(año).slice(2)}`;
};

const esAmistoso = (competicion) => /friendl|amistos/i.test(competicion);

function ligaDe({ slug, nombre, corto, carpeta }, partidosDeXlsx) {
  const dir = path.join(RAIZ, carpeta);

  if (!fs.existsSync(dir)) return null;

  /* Una fila por equipo y partido; el mismo partido viene en el fichero de los dos equipos. */
  const porLlave = new Map();

  for (const nombreFichero of fs.readdirSync(dir)) {
    if (!/^Team Stats .+\.xlsx$/i.test(nombreFichero)) continue;

    let filas = [];

    try {
      filas = partidosDeXlsx(fs.readFileSync(path.join(dir, nombreFichero)));
    } catch {
      continue;
    }

    for (const fila of filas) {
      if (esAmistoso(fila.competicion)) continue;

      const llave = `${fila.fecha}|${fila.equipo.toLowerCase()}|${fila.rival.toLowerCase()}`;

      const previa = porLlave.get(llave);

      if (!previa || Object.keys(fila.datos).length > Object.keys(previa.datos).length) porLlave.set(llave, fila);
    }
  }

  const filas = [...porLlave.values()];

  if (filas.length === 0) return null;

  /* La temporada en curso, y dentro de ella la competición que más se juega: la liga. */
  const temporada = filas.map((f) => temporadaDe(f.fecha)).sort().at(-1);

  const deLaTemporada = filas.filter((f) => temporadaDe(f.fecha) === temporada);

  const cuenta = new Map();

  for (const f of deLaTemporada) cuenta.set(f.competicion, (cuenta.get(f.competicion) ?? 0) + 1);

  const competicion = [...cuenta.entries()].sort((a, b) => b[1] - a[1])[0][0];

  const deLaLiga = deLaTemporada.filter((f) => f.competicion === competicion);

  /* Los rivales de la competición también son equipos de la liga (el fichero trae su fila). */
  const equipos = [...new Set(deLaLiga.flatMap((f) => [f.equipo]))].sort((a, b) => a.localeCompare(b, "es"));

  const indice = new Map(equipos.map((e, i) => [e, i]));

  const fila = new Map(deLaLiga.map((f) => [`${f.fecha}|${f.equipo}|${f.rival}`, f]));

  const valores = (f) => COLUMNAS.map((c) => (f && Number.isFinite(f.datos[c]) ? f.datos[c] : null));

  const partidos = deLaLiga
    .filter((f) => indice.has(f.rival))
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.equipo.localeCompare(b.equipo))
    .map((f) => {
      /* En contra: la fila del rival en ese mismo partido. */
      const delRival = fila.get(`${f.fecha}|${f.rival}|${f.equipo}`);

      return [f.fecha, indice.get(f.equipo), indice.get(f.rival), f.golesFavor, f.golesContra, ...valores(f), ...(delRival ? valores(delRival) : COLUMNAS.map(() => null))];
    });

  return { slug, nombre, corto, competicion, temporada, equipos, partidos };
}

(async () => {
  const { partidosDeXlsx } = require(path.join(RAIZ, "lib", "data-analisis", "leer.ts"));

  /*
  | Lo que ya estaba se conserva. Los .xlsx de las otras ligas no se versionan
  | (`public/data/wys-ligas/` va en .gitignore): en Vercel esa carpeta no
  | existe, y sin esto la compilación borraría del JSON la Premier y el Grupo 1.
  */
  let antes = [];

  try {
    antes = JSON.parse(fs.readFileSync(SALIDA, "utf8")).ligas ?? [];
  } catch {
    /* primera vez */
  }

  const ligas = LIGAS.map((l) => ligaDe(l, partidosDeXlsx) ?? antes.find((a) => a.slug === l.slug) ?? null).filter(Boolean);

  fs.mkdirSync(path.dirname(SALIDA), { recursive: true });

  fs.writeFileSync(SALIDA, JSON.stringify({ version: 1, generado: new Date().toISOString(), columnas: COLUMNAS, ligas }), "utf8");

  const kb = (fs.statSync(SALIDA).size / 1024).toFixed(0);

  console.log(
    `[abp-ligas] ${ligas.map((l) => `${l.corto}: ${l.equipos.length} equipos, ${l.partidos.length} filas (${l.temporada})`).join(" · ") || "ninguna liga"} · ${kb} KB`,
  );
})().catch((error) => {
  console.warn(`[abp-ligas] no se ha podido escribir: ${error.message}`);
});
