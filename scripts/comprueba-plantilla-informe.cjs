/*
| La hoja «Plantilla» del informe del rival saca a TODA la plantilla.
|
| 28/10/2026: el repaso guardado del Cartagena la dejaba en 15 de 30 (fichas
| borradas en el editor que se escondían cada vez que se montaba). Esto lo
| comprueba en cada push (CI) sin navegador:
|   1. el reparto coloca a todos, con cualquier tamaño y puesto (también sin puesto);
|   2. un repaso guardado con borrados no esconde ninguna ficha fija.
|
|   node scripts/comprueba-plantilla-informe.cjs
*/
const path = require("path");
const { createJiti } = require("jiti");

const R = path.join(__dirname, "..");
const jiti = createJiti(path.join(R, "x.js"), { alias: { "@": R, "next/font/google": path.join(__dirname, "stubs/next-font-google.cjs") } });

const SLOTS = ["portero", "central", "lateral", "pivote", "interior", "mediapunta", "extremo", "delantero", "otros", "", "no-existe"];
const DIBUJOS = [undefined, "1-4-2-3-1", "1-4-4-2", "1-4-3-3", "1-3-5-2", "1-5-3-2", "1-3-4-3", "1-4-1-4-1"];

(async () => {
  const { reparteAlineacion } = await jiti.import(path.join(R, "lib/rivals/alineacion-ppt.ts"));
  const { aplicaAjustes } = await jiti.import(path.join(R, "lib/rivals/informe-ajustes.ts"));
  const { ANCLAS_SLOT } = await jiti.import(path.join(R, "lib/rivals/campograma-motor.ts")).catch(() => ({}));
  const slots = [...new Set([...SLOTS, ...Object.keys(ANCLAS_SLOT ?? {})])];

  let fallos = 0;

  for (const dibujo of DIBUJOS) {
    for (let n = 1; n <= 45; n++) {
      const jugadores = Array.from({ length: n }, (_, i) => ({
        clave: `J${i}`,
        dorsal: String(i + 1),
        nombre: `JUGADOR ${i}`,
        slot: slots[(i * 7 + n) % slots.length],
        lado: [-1, 0, 1][i % 3],
        foto: "",
      }));

      const { fichas } = reparteAlineacion(jugadores, dibujo);
      const puestos = new Set(fichas.map((f) => f.jugador.clave));
      const fuera = fichas.filter((f) => !(f.x >= -0.001 && f.y >= -0.001 && f.x + f.w <= 1.001 && f.y + f.h <= 1.001));

      if (puestos.size !== n || fichas.length !== n || fuera.length) {
        fallos++;
        console.error(`✗ ${dibujo ?? "por defecto"} con ${n}: ${puestos.size}/${n} colocados, ${fuera.length} fuera de la hoja`);
      }
    }
  }

  /* Un repaso guardado que borra fichas fijas no las esconde. */
  const hoja = {
    id: "h10",
    titulo: "Plantilla",
    fondo: "",
    elementos: [
      { id: "h10-1", nombre: "Título", x: 0, y: 0, w: 10, h: 10, imagen: "" },
      ...Array.from({ length: 30 }, (_, i) => ({ id: `h10-${i + 2}`, nombre: `Nº${i} · J${i}`, x: i, y: i, w: 10, h: 10, imagen: "", fija: true })),
    ],
  };
  const borrados = hoja.elementos.map((e) => e.id);
  const [tras] = await aplicaAjustes([hoja], { Plantilla: { borrados } }, async () => null);
  const quedan = tras.elementos.filter((e) => e.fija).length;

  if (quedan !== 30) {
    fallos++;
    console.error(`✗ Un repaso con borrados deja ${quedan}/30 fichas en «Plantilla»`);
  }

  if (fallos) {
    console.error(`\n${fallos} fallo(s): la hoja «Plantilla» del informe no saca a todos.`);
    process.exit(1);
  }

  console.log("✓ La hoja «Plantilla» saca siempre a la plantilla entera.");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
