/* eslint-disable @typescript-eslint/no-require-imports -- arnés de Node: corre
   en el ordenador del club, no lo empaqueta nadie. */
/**
 * METE EL PARTIDO EN LAS CUATRO HOJAS DE ABP.
 *
 *   node scripts/partido/escribir.cjs --carpeta "<carpeta>"          → valida y enseña
 *   node scripts/partido/escribir.cjs --carpeta "<carpeta>" --hoja   → escribe y relee
 *
 * Lee las filas definitivas de `<carpeta>/hoja/`:
 *   bandaOf.tsv · bandaDef.tsv · piezasOf.tsv · piezasDef.tsv
 * con la cabecera de la hoja (las columnas que no existen en la hoja, como
 * `id`, `hudl_ms` o `nota`, se quedan fuera; un «?» se escribe vacío).
 *
 * Se puede lanzar las veces que haga falta sin duplicar nada:
 *  - si la pestaña no tiene filas de esta JORNADA y este Rival, las añade;
 *  - si tiene las mismas (mismo Tiempo y Minuto, en el mismo orden), las
 *    reescribe en su sitio con `actualizarFilas`;
 *  - si tiene parte, añade sólo las que faltan;
 *  - si tiene otras cosas —filas metidas a mano que no casan—, NO toca nada y
 *    lo dice: eso lo tiene que mirar una persona.
 *
 * Al acabar relee la hoja publicada (tarda unos minutos en refrescar) y
 * cuenta. Termina con «RESUMEN: …» y una línea «SECCIONES: [json]».
 */

const fs = require("node:fs");
const path = require("node:path");

const { HOJAS, publicada, mandaHoja, leePartido, leeTsv, espera } = require("./comun.cjs");

const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`);

  return i > 0 ? process.argv[i + 1] : null;
};

const CARPETA = arg("carpeta");
const ESCRIBE = process.argv.includes("--hoja");

if (!CARPETA) {
  console.error('Uso: node scripts/partido/escribir.cjs --carpeta "<carpeta>" [--hoja]');
  process.exit(1);
}

const P = leePartido(CARPETA);

const CLAVE = { JORNADA: P.etiqueta, Rival: P.rivalHoja };

const delPartido = (filas) => filas.filter((f) => f.JORNADA === CLAVE.JORNADA && f.Rival === CLAVE.Rival);

/* Las columnas que son números o texto libre: no se comparan con el vocabulario. */
const LIBRES = /^(Minuto|MINUTO|xG|N_|Oc_|Calidad|Resultado R|Rutina|Rematador|Sacador|Debilidad)/;

const minutoDe = (f) => String(f.Minuto ?? f.MINUTO ?? "").trim();
const tiempoDe = (f) => String(f.Tiempo ?? "").replace(/^T/i, "").trim();
const firma = (f) => `${tiempoDe(f)}|${minutoDe(f)}`;

/** La fila tal y como la quiere esa pestaña. */
function adapta(fila, cabecera, existentes) {
  const sale = {};

  /* «T1» o «1»: lo que use ya la pestaña. */
  const conT = existentes.filter((f) => /^T/i.test(f.Tiempo ?? "")).length > existentes.length / 2;

  for (const [k, v] of Object.entries(fila)) {
    if (!cabecera.includes(k)) continue;

    let valor = String(v ?? "").trim();

    if (valor === "?") valor = "";

    if (k === "Tiempo" && valor) valor = conT ? `T${valor.replace(/^T/i, "")}` : valor.replace(/^T/i, "");

    if (valor !== "") sale[k] = valor;
  }

  return sale;
}

(async () => {
  const secciones = [];
  const avisos = [];

  for (const [clave, hoja] of Object.entries(HOJAS)) {
    const fichero = path.join(CARPETA, "hoja", `${clave}.tsv`);

    if (!fs.existsSync(fichero)) {
      secciones.push({ clave, nombre: hoja.nombre, ok: false, detalle: `falta ${clave}.tsv: no se ha analizado` });

      continue;
    }

    const todas = await publicada(clave);

    const cabecera = Object.keys(todas[0] ?? {});

    const filas = leeTsv(fichero)
      .filter((f) => Object.values(f).some(Boolean))
      .map((f) => adapta({ ...f, ...CLAVE }, cabecera, todas));

    const ya = delPartido(todas);

    /* Vocabulario: un valor que la pestaña no ha visto nunca se avisa. */
    const fuera = new Set(Object.keys(leeTsv(fichero)[0] ?? {}).filter((c) => !cabecera.includes(c)));

    for (const f of filas) {
      for (const [k, v] of Object.entries(f)) {
        if (LIBRES.test(k) || k === "JORNADA" || k === "Rival" || k === "Tiempo") continue;

        if (!todas.some((r) => r[k] === v)) avisos.push(`${clave} · ${k} = «${v}» no está en la hoja`);
      }
    }

    console.log(`\n${hoja.nombre}: ${filas.length} filas analizadas · en la hoja ya hay ${ya.length}`);

    if (fuera.size) console.log(`  columnas que la hoja no tiene (se quedan fuera): ${[...fuera].join(", ")}`);

    for (const f of filas) console.log("   " + cabecera.map((c) => f[c] ?? "").join("|"));

    let plan;

    const firmasYa = ya.map(firma);
    const firmasNuevas = filas.map(firma);

    /*
    | ¿Las filas que hay son las que escribió este script la última vez? Se
    | guarda lo escrito en `hoja/escrito-<pestaña>.json`. Si la hoja sigue
    | igual, son nuestras y se pueden corregir aunque cambien los minutos (la
    | segunda pasada pone el del reloj de la TV) o haya más filas. Si alguien
    | las ha tocado a mano, ya no son nuestras y no se pisan.
    */
    const registro = path.join(CARPETA, "hoja", `escrito-${clave}.json`);

    const escritas = fs.existsSync(registro) ? JSON.parse(fs.readFileSync(registro, "utf8")) : null;

    const nuestras = Array.isArray(escritas) && escritas.length === firmasYa.length && escritas.every((x, i) => x === firmasYa[i]);

    /* Lo que falta de `b` en `a`, contando repetidas: dos saques en el mismo minuto son dos. */
    const resta = (a, b) => {
      const quedan = [...b];

      return a.filter((x) => {
        const i = quedan.indexOf(firma(x));

        if (i < 0) return true;

        quedan.splice(i, 1);

        return false;
      });
    };

    if (!filas.length) plan = { tipo: "nada" };
    else if (!ya.length) plan = { tipo: "anadir", filas };
    else if (ya.length === filas.length && (nuestras || firmasYa.join(",") === firmasNuevas.join(","))) plan = { tipo: "reescribir", filas };
    else if (nuestras && ya.length < filas.length) {
      plan = { tipo: "reescribir+anadir", filas: filas.slice(0, ya.length), mas: filas.slice(ya.length) };
    } else if (ya.length < filas.length && resta(filas, firmasYa).length === filas.length - ya.length) {
      /* Las de la hoja (puestas a mano) se respetan tal cual; se añaden las que faltan. */
      plan = { tipo: "completar", filas: resta(filas, firmasYa) };
    } else plan = { tipo: "choque" };

    console.log(`  plan: ${plan.tipo}${plan.filas ? ` (${plan.filas.length}${plan.mas ? ` + ${plan.mas.length}` : ""})` : ""}${nuestras ? " · son las que escribió este script" : ""}`);

    /* Lo que quedará en la hoja, en su orden, para reconocerlo la próxima vez. */
    const quedara =
      plan.tipo === "completar" ? [...firmasYa, ...plan.filas.map(firma)] : firmasNuevas;

    if (plan.tipo === "choque") {
      secciones.push({
        clave,
        nombre: hoja.nombre,
        ok: false,
        detalle: `en la hoja hay ${ya.length} filas de ${CLAVE.JORNADA} que no casan con las ${filas.length} analizadas: no se ha tocado (hay que mirarlo a mano)`,
      });

      continue;
    }

    /*
    | Añadir NO se reintenta: si el Apps Script escribió pero la respuesta se
    | perdió (arranque en frío de 30-70 s), repetirlo duplicaba las filas. Si
    | falla, la sección queda sin hacer y la próxima pasada ve lo que haya.
    */
    try {
      if (ESCRIBE && (plan.tipo === "reescribir" || plan.tipo === "reescribir+anadir")) {
        const r = await mandaHoja({ action: "actualizarFilas", gid: hoja.gid, clave: CLAVE, filas: plan.filas });

        console.log(`  ✓ reescritas ${r.filas.length} filas (${r.celdas} celdas)`);
      }

      const anadir = plan.tipo === "anadir" || plan.tipo === "completar" ? plan.filas : plan.mas;

      if (ESCRIBE && anadir?.length) {
        const r = await mandaHoja({ action: "anadirFilas", gid: hoja.gid, filas: anadir }, { reintenta: false });

        console.log(`  ✓ ${r.escritas} filas añadidas desde la fila ${r.desdeLaFila}`);
      }

      if (ESCRIBE && plan.tipo !== "nada") fs.writeFileSync(registro, JSON.stringify(quedara), "utf8");
    } catch (error) {
      secciones.push({
        clave,
        nombre: hoja.nombre,
        ok: false,
        detalle: `la hoja no ha contestado bien (${error.message}): se vuelve a intentar en la próxima pasada`,
      });

      continue;
    }

    secciones.push({ clave, nombre: hoja.nombre, esperadas: filas.length, ok: null, detalle: "" });
  }

  for (const a of [...new Set(avisos)]) console.log(`  aviso: ${a}`);

  if (!ESCRIBE) {
    console.log("\n(sin --hoja: no se ha escrito nada)");

    return;
  }

  /* Releer lo publicado: el «success» del Apps Script no basta. */
  const pendientes = secciones.filter((s) => s.ok === null);

  for (let i = 0; i < 14 && pendientes.some((s) => s.ok !== true); i++) {
    if (i) await espera(30_000);

    for (const s of pendientes) {
      const hay = delPartido(await publicada(s.clave)).length;

      s.ok = hay === s.esperadas;
      s.detalle = `${hay} de ${s.esperadas} en la hoja publicada`;
    }

    console.log(`comprobación ${i + 1}: ${pendientes.map((s) => `${s.clave} ${s.detalle}`).join(" · ")}`);
  }

  for (const s of pendientes) {
    if (!s.ok) s.detalle += " (el CSV publicado puede tardar más; se vuelve a mirar al verificar)";
  }

  const bien = secciones.filter((s) => s.ok).length;

  console.log(`SECCIONES: ${JSON.stringify(secciones.map(({ nombre, ok, detalle }) => ({ nombre, ok: Boolean(ok), detalle })))}`);
  console.log(`RESUMEN: hojas de ABP — ${bien} de ${secciones.length} al día`);

  process.exitCode = bien === secciones.length ? 0 : 1;
})().catch((error) => {
  console.log(`RESUMEN: no se ha podido escribir en las hojas de ABP (${error.message})`);
  process.exitCode = 1;
});
