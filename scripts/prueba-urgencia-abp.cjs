/*
  Prueba: las tres barras del cruce de ABP suman la urgencia que se enseña.

  El experto de análisis encontró (21/10/2026) filas cuyas barras daban 51 y
  la cifra marcaba 62: la urgencia contaba una parte que no se pintaba. Desde
  entonces la tabla pinta `partesUrgencia` y esta prueba lo vigila.

  - Con datos inventados (siempre): varias semillas, todas las filas.
  - Con datos reales, si se le pasa la ruta de un JSON con {events, partidos}
    volcado de la página: `node scripts/prueba-urgencia-abp.cjs datos.json`.

  Sale con código 1 si alguna fila no cuadra.
*/

require("./cargador-ts.cjs");

const fs = require("fs");
const { ASPECTOS } = require("../lib/abp/microciclo.ts");
const { construyeCruce, partesUrgencia } = require("../lib/abp/transferencia.ts");

function aleatorio(semilla) {
  let x = semilla;

  return () => {
    x = (x * 1103515245 + 12345) % 2147483648;

    return x / 2147483648;
  };
}

function inventa(semilla) {
  const azar = aleatorio(semilla);
  const partidos = Array.from({ length: 15 }, (_, i) => ({
    jornada: `J${i + 1}`,
    rival: `Rival ${i + 1}`,
    rivalKey: `rival-${i + 1}`,
    competicion: i < 8 ? "liga" : "amistoso",
  }));
  const events = [];

  for (const aspecto of ASPECTOS) {
    const r = aspecto.reconocimiento;

    if (!r) continue;

    for (const lado of ["ofensivo", "defensivo"]) {
      const n = Math.floor(azar() * 40);

      for (let i = 0; i < n; i++) {
        const partido = partidos[Math.floor(azar() * partidos.length)];
        const peligro = azar() < 0.15;

        events.push({
          jornada: partido.jornada,
          contexto: { jornada: { competicion: partido.competicion }, minuto: {}, marcador: {} },
          rival: partido.rival,
          rivalKey: partido.rivalKey,
          lado,
          family: r.family,
          envio: r.envio ?? null,
          zonaSaque: r.zonaSaque ?? null,
          remate: peligro || azar() < 0.2,
          xg: 0,
          peligro,
          gol: peligro && azar() < 0.2,
        });
      }
    }
  }

  return { events, partidos };
}

function comprueba(nombre, { events, partidos }) {
  const minutosTemporada = new Map();

  ASPECTOS.forEach((aspecto, i) => {
    minutosTemporada.set(`${aspecto.key}|ofensivo`, (i * 7) % 60);
    minutosTemporada.set(`${aspecto.key}|defensivo`, (i * 11) % 60);
  });

  const filas = construyeCruce({
    events,
    partidos,
    minutosMicro: new Map(),
    minutosTemporada,
    trabajoPrevio: new Map(),
  });

  let malas = 0;

  for (const fila of filas) {
    if (fila.urgencia === null) continue;

    const partes = partesUrgencia(fila);
    const suma = partes.dano + partes.deficit + partes.desatencion;

    /* Sin subida por goles, lo que se ve (la suma) es la cifra; con subida,
       la cifra es la urgencia real y la tabla dice «suma → cifra». */
    const esperado = fila.subidaPorGoles ? Math.round(fila.urgencia) : suma;

    if (partes.urgencia !== esperado || (!fila.subidaPorGoles && fila.urgencia !== suma)) {
      malas++;
      console.error(
        `  NO CUADRA ${nombre} · ${fila.aspecto.label} ${fila.lado}: ${partes.dano}+${partes.deficit}+${partes.desatencion}=${suma}, cifra ${partes.urgencia}, urgencia ${fila.urgencia.toFixed(2)}`,
      );
    }
  }

  console.log(`${nombre}: ${filas.filter((f) => f.urgencia !== null).length} filas, ${malas} sin cuadrar`);

  return malas;
}

let total = 0;

for (const semilla of [1, 7, 42, 2026, 9999]) total += comprueba(`semilla ${semilla}`, inventa(semilla));

if (process.argv[2]) total += comprueba("datos reales", JSON.parse(fs.readFileSync(process.argv[2], "utf8")));

process.exit(total ? 1 : 0);
