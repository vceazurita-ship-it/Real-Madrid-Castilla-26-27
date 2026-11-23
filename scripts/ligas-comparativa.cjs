/**
 * COMPARATIVA DE LIGAS, EN UN JSON PEQUEÑO (23/11/2026)
 *
 * Lee los «Team Stats» de Wyscout de cada liga de `CATALOGO_LIGAS`
 * (lib/ligas/comparativa.ts) con el MISMO parser de DATA (`partidosDeXlsx`) y
 * deja en `public/data/ligas-comparativa.json`, por liga y equipo, la media
 * por partido de cada métrica de la temporada en curso: a favor (la fila del
 * equipo) y en contra (la del rival en ese mismo partido). Sólo la
 * competición de liga (la que más partidos tiene en la temporada) y sin
 * amistosos. Lo pinta /comparativa-ligas.
 *
 *   node scripts/ligas-comparativa.cjs
 *
 * Una liga cuya carpeta no está (Render: wys-ligas no se versiona) se deja
 * como estaba en el JSON. No tumba la compilación si algo falla.
 */
const fs = require("node:fs");
const path = require("node:path");

require("./cargador-ts.cjs");

const RAIZ = path.join(__dirname, "..");
const SALIDA = path.join(RAIZ, "public", "data", "ligas-comparativa.json");

const { CATALOGO_LIGAS, METRICAS } = require(path.join(RAIZ, "lib", "ligas", "comparativa.ts"));
const { partidosDeXlsx } = require(path.join(RAIZ, "lib", "data-analisis", "leer.ts"));

/** La temporada empieza el 1 de julio, como en `temporadaDe` de DATA. */
const temporadaDe = (fecha) => {
  const año = Number(fecha.slice(0, 4));
  return fecha.slice(5, 10) >= "07-01" ? `${año}/${String(año + 1).slice(2)}` : `${año - 1}/${String(año).slice(2)}`;
};

const esAmistoso = (competicion) => /friendl|amistos/i.test(competicion);
const num = (x) => (typeof x === "number" && Number.isFinite(x) ? x : null);
const redondea = (x) => (x === null ? null : Math.round(x * 1000) / 1000);

function ligaDe({ slug, nombre, corto, nivel, pais, carpeta }) {
  const dir = path.join(RAIZ, carpeta);
  if (!fs.existsSync(dir)) return null;

  /* Una fila por equipo y partido; el mismo partido viene en el fichero de los dos equipos. */
  const porLlave = new Map();

  for (const fichero of fs.readdirSync(dir)) {
    if (!/^Team Stats .+\.xlsx$/i.test(fichero)) continue;

    let filas = [];
    try {
      filas = partidosDeXlsx(fs.readFileSync(path.join(dir, fichero)));
    } catch {
      continue;
    }

    for (const fila of filas) {
      if (esAmistoso(fila.competicion)) continue;
      const llave = `${fila.fecha}|${fila.equipo}|${fila.rival}`;
      const previa = porLlave.get(llave);
      if (!previa || Object.keys(fila.datos).length > Object.keys(previa.datos).length) porLlave.set(llave, fila);
    }
  }

  const filas = [...porLlave.values()];
  if (!filas.length) return null;

  const temporada = filas.map((f) => temporadaDe(f.fecha)).sort().at(-1);
  const deLaTemporada = filas.filter((f) => temporadaDe(f.fecha) === temporada);
  const cuenta = new Map();
  for (const f of deLaTemporada) cuenta.set(f.competicion, (cuenta.get(f.competicion) ?? 0) + 1);
  const competicion = [...cuenta.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const deLaLiga = deLaTemporada.filter((f) => f.competicion === competicion);

  /* Los equipos de la liga: los que tienen fichero propio (los rivales de copa no). */
  const conFichero = new Set(
    fs
      .readdirSync(dir)
      .filter((f) => /^Team Stats .+\.xlsx$/i.test(f))
      .map((f) => f.replace(/^Team Stats /i, "").replace(/\.xlsx$/i, "")),
  );
  const nombres = [...new Set(deLaLiga.map((f) => f.equipo))].filter((e) => conFichero.has(e) || deLaLiga.filter((f) => f.equipo === e).length >= 3);

  const equipos = nombres
    .map((nombreEquipo) => {
      const suyos = deLaLiga.filter((f) => f.equipo === nombreEquipo);
      const pares = suyos.map((f) => ({ f, c: porLlave.get(`${f.fecha}|${f.rival}|${f.equipo}`) ?? null }));

      const v = METRICAS.map((met) => {
        const fila = (p) => (met.lado === "c" ? p.c : p.f);
        if (met.divisor) {
          let arriba = 0;
          let abajo = 0;
          for (const p of pares) {
            const r = fila(p);
            const a = num(r?.datos[met.col]);
            const b = num(r?.datos[met.divisor]);
            if (a === null || b === null) continue;
            arriba += a;
            abajo += b;
          }
          return abajo > 0 ? redondea(arriba / abajo) : null;
        }
        const xs = pares.map((p) => num(fila(p)?.datos[met.col])).filter((x) => x !== null);
        return xs.length ? redondea(xs.reduce((a, b) => a + b, 0) / xs.length) : null;
      });

      return { nombre: nombreEquipo, pj: suyos.length, v };
    })
    .filter((e) => e.pj > 0)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

  const ultimo = deLaLiga.map((f) => f.fecha.slice(0, 10)).sort().at(-1);

  return { slug, nombre, corto, nivel, pais, competicion, temporada, ultimo, equipos };
}

try {
  let antes = [];
  try {
    antes = JSON.parse(fs.readFileSync(SALIDA, "utf8")).ligas ?? [];
  } catch {
    /* primera vez */
  }

  const ligas = CATALOGO_LIGAS.map((l) => ligaDe(l) ?? antes.find((a) => a.slug === l.slug) ?? null).filter(Boolean);

  fs.mkdirSync(path.dirname(SALIDA), { recursive: true });
  fs.writeFileSync(SALIDA, JSON.stringify({ version: 1, generado: new Date().toISOString(), metricas: METRICAS.map((x) => x.id), ligas }), "utf8");

  const kb = (fs.statSync(SALIDA).size / 1024).toFixed(0);
  console.log(`[ligas-comparativa] ${ligas.map((l) => `${l.corto}: ${l.equipos.length} equipos (${l.temporada}, hasta ${l.ultimo})`).join(" · ") || "ninguna liga"} · ${kb} KB`);
} catch (error) {
  console.warn(`[ligas-comparativa] no se ha podido escribir: ${error.message}`);
}
