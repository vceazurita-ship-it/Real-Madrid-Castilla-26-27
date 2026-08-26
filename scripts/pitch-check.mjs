/*
 * Comprobación del campograma de /rivals sin navegador.
 *
 * Se le pide el reparto a `layoutPitch` con plantillas que reproducen los
 * casos que aprietan —muchos centrales, extremos y media punta a la vez,
 * interiores y mediocentros juntos— y se mide si alguna ficha pisa a otra o se
 * sale del campo. Las cajas se calculan con las mismas fórmulas que el JSX:
 * foto + borde, nombre debajo y, si el bloque va etiquetado, la fila de chapas.
 *
 *   node scripts/pitch-check.mjs
 *
 * La plantilla de 38 da solapes de PIE, y los daba ya antes de tocar nada: son
 * 7 centrales y 5 porteros, una plantilla que no existe. Con 23 y 29 —lo que
 * tiene un equipo de verdad— no hay ni uno en ninguna de las seis medidas.
 */
import { layoutPitch, cardMetrics } from "./pitch-harness.mjs";

/* Mezcla de posiciones de una plantilla de Primera RFEF, tal y como las
   escribe la hoja RIVALES. */
const MOLDE = [
  ["PORTERO", 3],
  ["LATERAL DERECHO", 2],
  ["CENTRAL", 5],
  ["LATERAL IZQUIERDO", 2],
  ["MEDIO CENTRO DEF", 2],
  ["MEDIOCENTRO", 3],
  ["INTERIOR DERECHO", 1],
  ["INTERIOR IZQUIERDO", 1],
  ["MEDIA PUNTA", 2],
  ["EXTREMO DERECHO", 2],
  ["EXTREMO IZQUIERDO", 2],
  ["SEGUNDO DELANTERO", 1],
  ["DELANTERO", 3],
];

function plantilla(nombre, escala, conEtiquetas) {
  const squad = [];

  let n = 0;

  for (const [posicion, cuantos] of MOLDE) {
    const total = Math.max(1, Math.round(cuantos * escala));

    for (let i = 0; i < total; i += 1) {
      n += 1;

      squad.push({
        ID_JUGADOR: `${nombre}-${n}`,
        NOMBRE_EQUIPO: nombre,
        JUGADOR: `Jugador Apellido${n}`,
        "NOMBRE DEPORTIVO": `Apellido${n}`,
        DORSAL: String(n),
        POSICIÓN: posicion,
        IMPACTO: conEtiquetas && n % 3 === 0 ? "El cerebro; Lesionado" : "",
      });
    }
  }

  return squad;
}

const escuadras = [
  { label: "23 jugadores", squad: plantilla("A", 0.75, true) },
  { label: "29 jugadores", squad: plantilla("B", 1, true) },
  { label: "29 sin etiquetas", squad: plantilla("C", 1, false) },
  { label: "38 jugadores", squad: plantilla("D", 1.3, true) },
];

/* Caja de una ficha, con las mismas fórmulas que el render. */
function caja(placed, avatar, compact, stepX) {
  const { badge, nameFont } = cardMetrics(avatar, compact);

  const alto =
    avatar +
    4 +
    4 +
    Math.round(nameFont * 1.25) +
    4 +
    (placed.tagRow ? 4 + badge : 0);

  const ancho = Math.max(avatar + 4, stepX - 4);

  return {
    x0: placed.x - ancho / 2,
    x1: placed.x + ancho / 2,
    y0: placed.y - alto / 2,
    y1: placed.y + alto / 2,
    nombre: placed.player["NOMBRE DEPORTIVO"],
  };
}

const solapan = (a, b) =>
  a.x0 < b.x1 - 0.5 && b.x0 < a.x1 - 0.5 && a.y0 < b.y1 - 0.5 && b.y0 < a.y1 - 0.5;

const casos = [
  { label: "móvil    360×680", w: 360, h: 680, compact: true, horizontal: false },
  { label: "lg justo 530×720", w: 530, h: 720, compact: false, horizontal: false },
  { label: "md ancho 700×680", w: 700, h: 680, compact: false, horizontal: false },
  { label: "portátil 640×500", w: 640, h: 500, compact: false, horizontal: true },
  { label: "portátil 900×600", w: 900, h: 600, compact: false, horizontal: true },
  { label: "portátil 1180×787", w: 1180, h: 787, compact: false, horizontal: true },
];

let fallos = 0;

for (const caso of casos) {
  const lineas = [];

  for (const { label, squad } of escuadras) {
    const { placed, clusters, avatar, stepX } = layoutPitch(
      squad,
      caso.w,
      caso.h,
      caso.compact,
      caso.horizontal,
    );

    const cajas = placed.map((p) => caja(p, avatar, caso.compact, stepX));

    let solapes = 0;
    let fuera = 0;

    for (let i = 0; i < cajas.length; i += 1) {
      const a = cajas[i];

      if (a.x0 < -1 || a.x1 > caso.w + 1 || a.y0 < -1 || a.y1 > caso.h + 1) {
        fuera += 1;

        if (fuera <= 2) console.log(`    fuera · ${label} · ${a.nombre}`);
      }

      for (let j = i + 1; j < cajas.length; j += 1) {
        if (solapan(a, cajas[j])) {
          solapes += 1;

          if (solapes <= 3) {
            console.log(`    solape · ${label} · ${a.nombre} / ${cajas[j].nombre}`);
          }
        }
      }
    }

    fallos += solapes + fuera;

    lineas.push(
      `    ${label.padEnd(18)} foto ${avatar.toFixed(1).padStart(5)} px · ` +
        `${clusters.length} bloques · solapes ${solapes} · fuera ${fuera}`,
    );
  }

  console.log(caso.label);
  lineas.forEach((linea) => console.log(linea));
}

console.log(fallos === 0 ? "\nOK: ni un solape, nadie fuera." : `\n${fallos} problemas.`);
