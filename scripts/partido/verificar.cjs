/* eslint-disable @typescript-eslint/no-require-imports -- arnés de Node: corre
   en el ordenador del club, no lo empaqueta nadie. */
/**
 * ¿ESTÁ EL PARTIDO EN TODAS LAS SECCIONES? MIRADO, NO SUPUESTO.
 *
 *   node scripts/partido/verificar.cjs --carpeta "<carpeta>"
 *
 * No se fía de lo que diga ningún paso: lee lo que de verdad ve la app.
 *
 *  - Data Análisis: el partido está en `public/data/analisis.json` (lo que se
 *    despliega) y hay foto de Wyscout posterior al partido.
 *  - Las cuatro hojas de ABP, publicadas: tantos saques de banda y córners de
 *    cada equipo como dice el timeline de Hudl (códigos «Throw ins» y
 *    «Corners» de equipo), y el penalti si lo hubo.
 *  - Faltas: el partido está en ANALISIS FALTAS con todas las del timeline, y
 *    en `lib/faltas/datos.ts`.
 *  - Robos y transiciones: bloques en ANALISIS TRANSICIONES, el desfase de la
 *    cámara táctica medido, y el partido en `lib/transiciones/datos.ts`.
 *  - Publicado: nada de eso queda sin subir a GitHub (es lo que despliega).
 *
 * Escribe `verificacion.json` en la carpeta, una línea «SECCIONES: [json]» y
 * «RESUMEN: …». Sale con 0 sólo si está TODO.
 */

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const { REPO, CLUB, publicada, leePartido } = require("./comun.cjs");

require(path.join(REPO, "scripts", "cargador-ts.cjs"));

const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`);

  return i > 0 ? process.argv[i + 1] : null;
};

const CARPETA = arg("carpeta");

if (!CARPETA) {
  console.error('Uso: node scripts/partido/verificar.cjs --carpeta "<carpeta>"');
  process.exit(1);
}

const P = leePartido(CARPETA);

const conteo = fs.existsSync(path.join(CARPETA, "conteo.json"))
  ? JSON.parse(fs.readFileSync(path.join(CARPETA, "conteo.json"), "utf8"))
  : null;

const secciones = [];

const apunta = (nombre, ok, detalle) => {
  secciones.push({ nombre, ok: Boolean(ok), detalle });

  console.log(`${ok ? "✓" : "✗"} ${nombre}: ${detalle}`);
};

const cerca = (a, b, dias = 1) => Math.abs(Date.parse(a) - Date.parse(b)) <= dias * 86_400_000;

function git(...args) {
  try {
    return execFileSync("git", args, { cwd: REPO, encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

(async () => {
  /* ---------------- DATA ANÁLISIS (WYSCOUT) ---------------- */

  try {
    const indice = JSON.parse(fs.readFileSync(path.join(REPO, "public", "data", "analisis.json"), "utf8"));

    const filas = (indice.partidos ?? []).filter(
      (p) => cerca(p.fecha, P.fecha) && [p.equipo, p.rival].some((x) => /castilla/i.test(x ?? "")),
    );

    const nuestra = filas.find((p) => /castilla/i.test(p.equipo ?? ""));
    const suya = filas.find((p) => /castilla/i.test(p.rival ?? ""));

    apunta(
      "Data Análisis · el partido (Wyscout)",
      nuestra && suya,
      nuestra
        ? `${nuestra.partido} · ${Object.keys(nuestra.datos ?? {}).length} métricas${suya ? " y la fila del rival" : " — FALTA la fila del rival"}`
        : "Wyscout todavía no trae el partido en public/data/analisis.json",
    );
  } catch (error) {
    apunta("Data Análisis · el partido (Wyscout)", false, `no se puede leer analisis.json (${error.message})`);
  }

  try {
    const { createClient } = require(path.join(REPO, "node_modules", "@supabase", "supabase-js"));

    const { entorno } = require(path.join(REPO, "scripts", "supabase-local.cjs"));

    const env = entorno();

    const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

    const { data } = await supabase.from("app_documents").select("data").eq("key", "wyscout-instantaneas").maybeSingle();

    const fotos = data?.data?.fotos ?? [];

    const fechaDe = (f) => f.tomadaEn ?? f.fecha ?? f.cuando ?? "";

    const posterior = fotos.filter((f) => fechaDe(f) && Date.parse(fechaDe(f)) > Date.parse(P.cuando ?? P.fecha));

    apunta(
      "Data Análisis · foto de la jornada (jugadores)",
      posterior.length > 0,
      posterior.length
        ? `foto del ${String(fechaDe(posterior[posterior.length - 1])).slice(0, 10)}: el tramo de la jornada se puede partir`
        : "no hay foto de Wyscout posterior al partido",
    );
  } catch (error) {
    apunta("Data Análisis · foto de la jornada (jugadores)", false, `no se puede mirar (${error.message})`);
  }

  /* ---------------- LAS HOJAS DE ABP ---------------- */

  if (!conteo) {
    apunta("Balón parado (ABP)", false, "no hay conteo.json: el timeline de Hudl no se llegó a leer");
  } else {
    const del = (filas) => filas.filter((f) => f.JORNADA === P.etiqueta && f.Rival === P.rivalHoja);

    const esCorner = (f) => /c[oó]rner/i.test(f.Tipo_Accion ?? "");
    const esPenalti = (f) => /penalti/i.test(f.Tipo_Accion ?? "");
    const esFalta = (f) => /falta/i.test(f.Tipo_Accion ?? "");

    let hojas;

    try {
      hojas = {
        bandaOf: del(await publicada("bandaOf")),
        bandaDef: del(await publicada("bandaDef")),
        piezasOf: del(await publicada("piezasOf")),
        piezasDef: del(await publicada("piezasDef")),
      };
    } catch (error) {
      hojas = null;

      apunta("Balón parado (ABP)", false, `no se pueden leer las hojas publicadas (${error.message})`);
    }

    if (hojas) {
      const igual = (nombre, hay, quiere, extra = "") =>
        apunta(nombre, hay === quiere, `${hay} de ${quiere} en la hoja${extra}`);

      igual("ABP · saques de banda ofensivos", hojas.bandaOf.length, conteo.banda.nuestro);
      igual("ABP · saques de banda defensivos", hojas.bandaDef.length, conteo.banda.rival);
      igual("ABP · córners a favor", hojas.piezasOf.filter(esCorner).length, conteo.corners.nuestro);
      igual("ABP · córners en contra", hojas.piezasDef.filter(esCorner).length, conteo.corners.rival);

      const penOf = hojas.piezasOf.filter(esPenalti).length;
      const penDef = hojas.piezasDef.filter(esPenalti).length;

      apunta(
        "ABP · penaltis",
        penOf === conteo.penaltis.nuestro && penDef === conteo.penaltis.rival,
        `a favor ${penOf} de ${conteo.penaltis.nuestro} · en contra ${penDef} de ${conteo.penaltis.rival}`,
      );

      /*
      | Las faltas a balón parado no tienen cifra exacta en Hudl (sólo van las
      | de Z1-Z6 en las que se busca área o tiro). Lo que se exige es que se
      | hayan decidido TODAS las candidatas: `hoja/decision-faltas.tsv` dice de
      | cada una si va y por qué.
      */
      const decision = path.join(CARPETA, "hoja", "decision-faltas.tsv");

      const decididas = fs.existsSync(decision)
        ? fs.readFileSync(decision, "utf8").trim().split(/\r?\n/).slice(1).filter(Boolean).length
        : 0;

      const candidatas = conteo.candidatasAbp.nuestro + conteo.candidatasAbp.rival;

      const fOf = hojas.piezasOf.filter(esFalta).length;
      const fDef = hojas.piezasDef.filter(esFalta).length;

      apunta(
        "ABP · faltas a balón parado",
        decididas >= candidatas && fOf >= conteo.freeKicksEquipo.nuestro && fDef >= conteo.freeKicksEquipo.rival,
        `${fOf} a favor y ${fDef} en contra en la hoja · ${decididas} de ${candidatas} candidatas decididas (mínimo por Hudl: ${conteo.freeKicksEquipo.nuestro} + ${conteo.freeKicksEquipo.rival})`,
      );

      /* Que no se haya quedado a medias: las columnas de criterio rellenas. */
      const vacias = (filas, cols) =>
        filas.filter((f) => cols.some((c) => c in f && !String(f[c] ?? "").trim())).length;

      const huecos =
        vacias(hojas.bandaOf, ["Calidad_Envio", "Intencion", "Defensa_Rival", "Resultado_Final"]) +
        vacias(hojas.bandaDef, ["Calidad_Envio", "Defensa", "Resultado_Final"]) +
        vacias(hojas.piezasOf, ["Tipo_Envio", "Zona_Caida", "Resultado_Final"]) +
        vacias(hojas.piezasDef, ["Tipo_Envio", "Zona_Caida", "Resultado_Final"]);

      apunta(
        "ABP · análisis de cada jugada",
        huecos === 0,
        huecos === 0 ? "calidad, intención, defensa y resultado puestos en todas" : `${huecos} filas con columnas de criterio vacías`,
      );
    }
  }

  /* ---------------- FALTAS ---------------- */

  const dirFaltas = path.join(CLUB, "ANALISIS FALTAS", P.slug);

  if (!fs.existsSync(dirFaltas)) {
    apunta("Faltas", false, `no existe ANALISIS FALTAS/${P.slug}`);
  } else {
    const lineas = fs
      .readdirSync(dirFaltas)
      .filter((f) => f.endsWith(".csv"))
      .flatMap((f) =>
        fs
          .readFileSync(path.join(dirFaltas, f), "utf8")
          .split(/\r?\n/)
          .filter((l) => /^(of|def)-c?\d+;/i.test(l.trim()))
          .map((l) => ({ lado: /^def/i.test(f) ? "def" : "of", campos: l.split(";") })),
      );

    const of = lineas.filter((l) => l.lado === "of").length;
    const def = lineas.filter((l) => l.lado === "def").length;

    const sinEntre = lineas.filter((l) => !/^\d+$/.test((l.campos[4] ?? "").trim())).length;

    const datos = fs.readFileSync(path.join(REPO, "lib", "faltas", "datos.ts"), "utf8");

    const enApp = datos.includes(`"id": "${P.slug}"`) || datos.includes(`id: "${P.slug}"`);

    const quiere = conteo ? conteo.faltas : { aFavor: of, enContra: def };

    apunta(
      "Faltas",
      of === quiere.aFavor && def === quiere.enContra && enApp,
      `${of} de ${quiere.aFavor} a favor y ${def} de ${quiere.enContra} en contra` +
        (sinEntre ? ` · ${sinEntre} sin defensores contados (la imagen no los enseña)` : "") +
        (enApp ? "" : " · FALTA en lib/faltas/datos.ts"),
    );
  }

  /* ---------------- ROBOS Y TRANSICIONES ---------------- */

  const dirTrans = path.join(CLUB, "ANALISIS TRANSICIONES", P.slug);

  const bloques = path.join(dirTrans, "bloques");

  if (!fs.existsSync(bloques)) {
    apunta("Robos y transiciones", false, `no hay bloques en ANALISIS TRANSICIONES/${P.slug}`);
  } else {
    const robos = fs
      .readdirSync(bloques)
      .filter((f) => f.endsWith(".csv"))
      .reduce(
        (s, f) =>
          s + fs.readFileSync(path.join(bloques, f), "utf8").split(/\r?\n/).filter((l) => /^\d+;/.test(l)).length,
        0,
      );

    const tramos = fs.existsSync(path.join(dirTrans, "tramos.json"));

    const datos = fs.readFileSync(path.join(REPO, "lib", "transiciones", "datos.ts"), "utf8");

    const enApp = datos.includes(`"id": "${P.slug}"`) || datos.includes(`id: "${P.slug}"`);

    apunta(
      "Robos y transiciones",
      robos > 0 && tramos && enApp,
      `${robos} robos` +
        (tramos ? " · desfase de la cámara táctica medido" : " · SIN medir el desfase con la cámara táctica") +
        (enApp ? "" : " · FALTA en lib/transiciones/datos.ts"),
    );
  }

  /* ---------------- PUBLICADO ---------------- */

  git("fetch", "-q", "origin");

  const sucios = git("status", "--porcelain", "--", "lib/faltas/datos.ts", "lib/transiciones/datos.ts", "public/data/analisis.json");

  const sinSubir = git("rev-list", "--count", "origin/main..HEAD");

  apunta(
    "Publicado en la plataforma",
    sucios === "" && sinSubir === "0",
    sucios
      ? `hay cambios sin guardar en git: ${sucios.replace(/\s+/g, " ")}`
      : sinSubir !== "0"
        ? `${sinSubir} commit(s) sin subir a GitHub`
        : "todo subido: Vercel lo despliega en un par de minutos",
  );

  const bien = secciones.filter((s) => s.ok).length;

  fs.writeFileSync(
    path.join(CARPETA, "verificacion.json"),
    JSON.stringify({ comprobadoEn: new Date().toISOString(), secciones }, null, 2),
    "utf8",
  );

  console.log(`SECCIONES: ${JSON.stringify(secciones)}`);
  console.log(
    bien === secciones.length
      ? `RESUMEN: ${P.etiqueta} ${P.rival} al día en las ${secciones.length} secciones`
      : `RESUMEN: ${P.etiqueta} ${P.rival} — ${bien} de ${secciones.length} secciones al día; faltan: ${secciones
          .filter((s) => !s.ok)
          .map((s) => s.nombre)
          .join(", ")}`,
  );

  process.exitCode = bien === secciones.length ? 0 : 1;
})().catch((error) => {
  console.log(`RESUMEN: no se ha podido verificar (${error.message})`);
  process.exitCode = 1;
});
