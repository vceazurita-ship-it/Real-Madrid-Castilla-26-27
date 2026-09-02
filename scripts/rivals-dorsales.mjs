/**
 * Pone al día el DORSAL de las plantillas rivales con el que publica BeSoccer.
 *
 *   node scripts/rivals-dorsales.mjs                 informe: qué cambiaría
 *   node scripts/rivals-dorsales.mjs --escribir      lo escribe en la hoja
 *   node scripts/rivals-dorsales.mjs --refrescar     ignora la caché de HTML
 *   node scripts/rivals-dorsales.mjs --equipo RIV-05 sólo ése
 *
 * El dorsal está en la **página de plantilla**, en la celda `number-box` de
 * cada fila; una sola página por equipo, así que esto es barato comparado con
 * `rivals-altas-bajas.mjs`, que baja dos páginas por jugador.
 *
 * Tres reglas, y las tres importan:
 *
 * - **Sólo se toca a quien está emparejado por el id de la foto.** El nombre
 *   no vale para esto: colgarle a un jugador el número de otro es peor que no
 *   tener número.
 * - **Un dorsal vacío en BeSoccer no borra el de la hoja.** Que el club no lo
 *   haya publicado todavía no significa que el jugador no lo tenga; lo que hay
 *   escrito es lo mejor que se sabe.
 * - **A los `NO EN PLANTILLA` no se les toca nada.** Se fueron; su fila es
 *   historia, no plantilla.
 *
 * Se escribe con `guardarRivalJugador` mandando **la fila entera tal y como
 * está en la hoja** y cambiando sólo el número, porque el Apps Script escribe
 * columna a columna lo que le llega: mandar media fila vaciaría la otra media.
 * Al final se relee la hoja y se comprueba fila a fila (ver la nota
 * "guardados-verificados-save-guard": el `success` del servidor no basta).
 */
import { TEAM_SLUGS, cargaHoja, empareja, pagina, plantillaDe } from "./rivals-cotejo.mjs";

const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbxCaJ90F28CYdcLVNnI4RZjyQL5IJlXVunEAobWY-Qr6lUL8No9H1B3RdASk83Z_NUd/exec";

const sleep = (ms) =>
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

const args = process.argv.slice(2);
const escribir = args.includes("--escribir");
const refrescar = args.includes("--refrescar");

const soloEquipo = (() => {
  const i = args.indexOf("--equipo");

  return i >= 0 ? args[i + 1] : null;
})();

/** El número tal y como lo entiende la hoja: un entero, o vacío. */
const numero = (valor) => {
  const n = Number(String(valor ?? "").trim());

  return Number.isFinite(n) && n > 0 ? n : null;
};

/*
| Reintentar aquí no tiene peligro: `guardarRivalJugador` pisa la misma fila
| con el mismo contenido. (En `rivals-altas-bajas.mjs` sí lo tiene, porque un
| alta repetida crea un jugador duplicado.) Google mete de vez en cuando una
| página HTML donde debía ir el JSON, y sin reintento se pierde ese dorsal
| hasta la siguiente pasada.
*/
async function escribeFila(fila, intentos = 3) {
  let ultimo = null;

  for (let intento = 0; intento < intentos; intento += 1) {
    if (intento) sleep(2000 * intento);

    try {
      return await intentaEscribir(fila);
    } catch (error) {
      ultimo = error;
    }
  }

  throw ultimo;
}

async function intentaEscribir(fila) {
  const response = await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "guardarRivalJugador", player: fila }),
  });

  const texto = await response.text();

  let leido;

  try {
    leido = JSON.parse(texto);
  } catch {
    throw new Error(`La hoja no ha devuelto JSON: ${texto.slice(0, 120)}`);
  }

  if (!leido.success) throw new Error(String(leido.error ?? "guardado rechazado"));
}

async function main() {
  const hoja = await cargaHoja();

  const equipos = Object.entries(TEAM_SLUGS).filter(
    ([riv]) => !soloEquipo || riv === soloEquipo,
  );

  const cambios = [];
  const sinDorsal = [];
  const sinEmparejar = [];

  for (const [riv, slug] of equipos) {
    const filas = hoja.filter(
      (fila) =>
        fila.ID_EQUIPO === riv &&
        fila.JUGADOR &&
        String(fila.ESTADO ?? "").toUpperCase() !== "NO EN PLANTILLA",
    );

    if (filas.length === 0) continue;

    const html = pagina(
      `https://es.besoccer.com/equipo/plantilla/${slug}`,
      slug,
      refrescar,
    );

    const plantilla = plantillaDe(html);

    if (plantilla.length === 0) {
      console.log(`${riv} ${slug}: la página no ha traído plantilla, se salta.`);
      continue;
    }

    const { parejas, huerfanas } = empareja(filas, plantilla);

    for (const { fila, besoccer, via } of parejas) {
      /* Sólo el id de la foto vale para colgar un número. */
      if (via !== "foto") {
        sinEmparejar.push(`${riv} ${fila["NOMBRE DEPORTIVO"] || fila.JUGADOR} (emparejado por nombre)`);
        continue;
      }

      const nuevo = besoccer.dorsal;
      const viejo = numero(fila.DORSAL);

      if (nuevo === null) {
        if (viejo === null) sinDorsal.push(`${riv} ${fila["NOMBRE DEPORTIVO"] || fila.JUGADOR}`);
        continue;
      }

      if (nuevo === viejo) continue;

      cambios.push({
        riv,
        nombre: fila["NOMBRE DEPORTIVO"] || fila.JUGADOR,
        viejo,
        nuevo,
        fila: { ...fila, DORSAL: nuevo },
      });
    }

    for (const fila of huerfanas ?? []) {
      sinEmparejar.push(
        `${riv} ${fila["NOMBRE DEPORTIVO"] || fila.JUGADOR} (no está en BeSoccer)`,
      );
    }
  }

  /* ------------------------------------------------------------ informe */

  for (const cambio of cambios) {
    console.log(
      `${cambio.riv} ${String(cambio.nombre).padEnd(28)} ${
        cambio.viejo === null ? "—" : cambio.viejo
      } -> ${cambio.nuevo}`,
    );
  }

  console.log(
    `\n${cambios.length} dorsales por cambiar · ${sinDorsal.length} sin número en BeSoccer · ${sinEmparejar.length} sin emparejar por foto`,
  );

  if (!escribir) {
    console.log("\n(sólo informe: añade --escribir para tocar la hoja)");
    return;
  }

  /* ----------------------------------------------------------- escribir */

  let hechos = 0;

  for (const cambio of cambios) {
    try {
      await escribeFila(cambio.fila);
      hechos += 1;
      console.log(`  ok ${cambio.riv} ${cambio.nombre} -> ${cambio.nuevo}`);
    } catch (error) {
      console.log(`  FALLA ${cambio.riv} ${cambio.nombre}: ${error.message}`);
    }

    sleep(700);
  }

  console.log(`\nEscritas ${hechos} de ${cambios.length}. Comprobando…`);

  /* La relectura: el `success` de la hoja no prueba que la columna exista. */
  const despues = await cargaHoja();

  const porId = new Map(despues.map((fila) => [fila.ID_JUGADOR, fila]));

  const mal = cambios.filter((cambio) => {
    const fila = porId.get(cambio.fila.ID_JUGADOR);

    return !fila || numero(fila.DORSAL) !== cambio.nuevo;
  });

  if (mal.length === 0) {
    console.log(`Comprobado: los ${cambios.length} dorsales están en la hoja.`);
  } else {
    console.log(`NO han quedado escritos ${mal.length}:`);

    for (const cambio of mal) {
      console.log(`  ${cambio.riv} ${cambio.nombre} (${cambio.fila.ID_JUGADOR})`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
