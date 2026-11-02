/*
  Arnés de «Identidad en el campo» (lib/identidad/campo.ts) con datos reales.

    node scripts/identidad-campo-arnes.cjs [--json]

  Sólo LEE: public/data/analisis.json (Wyscout), el registro de tareas y la
  hoja del modelo de juego (CSV publicados, GET). No escribe nada.
*/

require("./cargador-ts.cjs");

const path = require("path");
const Papa = require("papaparse");

const { identidadEnElCampo, NOMBRE_PUESTO } = require("../lib/identidad/campo.ts");
const { loadRegistro } = require("../lib/abp/registro.ts");

const MODELO =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vS3_1ScOV6sTyEpZSgLgCf2dKbwkLzb3zUEYM-7ZOoMbcFUTp7nvu1pBfGOP7EzppXXQYQhLeVa_SPr/pub?gid=1322156567&single=true&output=csv";

(async () => {
  const { expandeIndice } = require("../lib/data-analisis/leer.ts");
  const datos = expandeIndice(require(path.join(__dirname, "../public/data/analisis.json")));
  const [registro, hoja] = await Promise.all([
    loadRegistro(),
    fetch(MODELO).then((r) => r.text()).then((t) => Papa.parse(t, { header: true, skipEmptyLines: true }).data),
  ]);

  const r = identidadEnElCampo(datos.partidos, datos.jugadores, registro.tareas, hoja);

  if (!r) throw new Error("Sin resultado");
  if (process.argv.includes("--json")) return console.log(JSON.stringify(r, null, 1));

  console.log(`${r.competicion} · ${r.equipos} equipos · ${r.partidos.length} partidos · índice ${r.indiceGlobal}`);
  console.log("Entreno por semana:", r.partidos.map((p) => `J${p.jornada} ${p.minutos}'`).join(" · "));

  for (const b of r.bloques) {
    console.log(`\n[${b.indice}] ${b.label}  entreno=${b.entreno ?? "·"}%  brecha=${b.brecha ?? "·"}  coh=${JSON.stringify(b.coherencia)}`);
    console.log("   tendencia", b.tendencia.join(" "));

    for (const p of b.principios) console.log(`   ${p.clave ? "★" : " "} ${p.indice}  ${p.texto}  ← ${p.indicadores.map((i) => `${i.nombre} ${i.valor.toFixed(1)} (p${i.percentil})`).join("; ")}`);
  }

  console.log("\nVALORES");
  for (const v of r.valores) console.log(`  ${v.indice}  ${v.valor} ← ${v.indicadores.map((i) => `${i.nombre} p${i.percentil}`).join("; ")}`);

  console.log("\nJUGADORES");
  for (const j of r.jugadores) console.log(`  ${j.encaje}  ${j.nombre} (${NOMBRE_PUESTO[j.puesto]}, ${j.minutos}')  ${j.rasgos.map((x) => `${x.texto} ${x.percentil}`).join(" | ")}`);

  console.log("\nCONCLUSIONES");
  for (const f of r.conclusiones) console.log("  · " + f);

  /* Comprobaciones mínimas. */
  const malos = [...r.bloques.flatMap((b) => [b.indice, ...b.principios.map((p) => p.indice)]), ...r.valores.map((v) => v.indice), ...r.jugadores.map((j) => j.encaje)].filter((x) => !(x >= 0 && x <= 100));

  if (malos.length) throw new Error("Índices fuera de 0-100: " + malos.join(","));
  if (r.conclusiones.some((f) => /sin dato|undefined|NaN|null|—/.test(f))) throw new Error("Conclusión con hueco");

  console.log("\nOK");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
