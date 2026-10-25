/*
  Prueba: el puente entre la pizarra de ABP y el laboratorio (25/10/2026).

  `lib/abp-lab/puente-pizarra.ts` pasa una diapositiva de la pizarra a rutina
  del laboratorio y vuelta. Lo que se vigila:

  1. La cámara: píxel → metros → píxel cuadra, y las líneas de la foto caen
     donde dicen las medidas del campo.
  2. Ida y vuelta pizarra → laboratorio → pizarra SIN TOCAR NADA devuelve la
     diapositiva idéntica (fichas al píxel, flechas encadenadas, rivales,
     rótulos, guion, consignas), en todas las plantillas y pasando por la
     limpieza del servidor (`rutinaDe`).
  3. Lo que se cambia en el laboratorio llega a la pizarra (mover, carrera,
     quitar, añadir, consignas, señal, balón) y lo demás no se mueve.
  4. Laboratorio → pizarra → laboratorio conserva papeles, carreras y balón
     (a menos de 0,15 m: el píxel entero redondea).
  5. «Traer otra vez» mantiene lo que sólo tiene el laboratorio, y el estado
     en la pizarra (igual / cambiada / enviada / fuera) se lee bien.

  `node scripts/prueba-puente-pizarra.cjs` — sale con código 1 si algo falla.
*/

require("./cargador-ts.cjs");

const { PLANTILLAS, slideDePlantilla, fichaNueva } = require("../lib/abp/pizarra.ts");
const { nuevoTrazo, nuevoRival } = require("../lib/abp/trazos.ts");
const { rutinaDe } = require("../lib/abp-lab/modelo.ts");
const P = require("../lib/abp-lab/puente-pizarra.ts");

let fallos = 0;
let pruebas = 0;

function ok(cond, que) {
  pruebas += 1;

  if (!cond) {
    fallos += 1;
    console.error("  ✗", que);
  }
}

function aleatorio(semilla) {
  let x = semilla;

  return () => {
    x = (x * 1103515245 + 12345) % 2147483648;

    return x / 2147483648;
  };
}

/* JSON con las claves ordenadas: dos objetos iguales salen iguales aunque el orden de claves no. */
function canon(v) {
  if (Array.isArray(v)) return `[${v.map(canon).join(",")}]`;

  if (v && typeof v === "object") {
    return `{${Object.keys(v)
      .filter((k) => v[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canon(v[k])}`)
      .join(",")}}`;
  }

  return JSON.stringify(v);
}

/* Lo que se compara de una diapositiva: todo menos la marca del laboratorio; sin trazos = []. */
function comparable(s) {
  const { laboratorio: _l, ...resto } = s;

  return canon({ ...resto, trazos: s.trazos ?? [], rivales: s.rivales ?? [] });
}

const AHORA = "2026-10-25T10:00:00.000Z";

/* Lo que hace el servidor al guardar: la rutina pasa por `rutinaDe`. */
const porElServidor = (r) => rutinaDe(JSON.parse(JSON.stringify(r)), AHORA);

/* ------------------------------------------------------------------ */
console.log("1. La cámara");

for (const vista of ["ancho", "porteria"]) {
  let peor = 0;

  for (let x = 0; x <= 68; x += 4) {
    for (let y = 0; y <= 40; y += 2.5) {
      const vuelta = P.aMetros(vista, P.aLienzo(vista, { x, y }));

      peor = Math.max(peor, Math.hypot(vuelta.x - x, vuelta.y - y));
    }
  }

  ok(peor < 0.12, `${vista}: metros → píxel → metros, error máximo ${peor.toFixed(3)} m`);
}

/* Referencias medidas en la foto ancha (1283×719 estirada a 1920×1080). */
const enAncho = (u, v) => ({ x: (u * 1920) / 1283, y: (v * 1080) / 719 });

const cerca = (a, b, tol) => Math.hypot(a.x - b.x, a.y - b.y) <= tol;

ok(cerca(P.aMetros("ancho", enAncho(622.5, 251)), { x: 34, y: 11 }, 0.3), "ancho: punto de penalti a 11 m");
ok(cerca(P.aMetros("ancho", enAncho(299, 305)), { x: 13.84, y: 16.06 }, 0.4), "ancho: esquina del área (banda izquierda)");
ok(cerca(P.aMetros("ancho", enAncho(1167, 305)), { x: 68, y: 16.06 }, 0.4), "ancho: banda derecha");
ok(cerca(P.aMetros("porteria", { x: 5 + (510.5 * 1576) / 1052, y: -2 + (251 * 1080) / 719 }), { x: 34, y: 11 }, 0.3), "portería: punto de penalti");

/* ------------------------------------------------------------------ */
console.log("2. Ida y vuelta sin tocar nada, en todas las plantillas");

function diapositivaLlena(plantilla, semilla) {
  const azar = aleatorio(semilla);

  const slide = slideDePlantilla(plantilla.key);

  plantilla.puestos.forEach((puesto, i) => slide.fichas.push(fichaNueva(`JUG-${String(i + 1).padStart(2, "0")}`, puesto)));

  /* Una suelta, puesta a mano y un poco movida. */
  slide.fichas.push({ ...fichaNueva("JUG-30", null, 0), x: 700 + Math.round(azar() * 300), y: 300 + Math.round(azar() * 200) });

  /* Una que se ha arrastrado fuera del campo (el que saca el córner, detrás del banderín). */
  slide.fichas.push({ ...fichaNueva("JUG-31", null, 1), x: 40, y: 150 });

  const enCampo = slide.fichas.filter((f) => f.x >= 0 && f.y >= 0);

  const trazos = [];

  /* Tres con carrera, una de ellas encadenada en dos fases y curva. */
  enCampo.slice(0, 3).forEach((f, i) => {
    const primera = nuevoTrazo(i === 1 ? "bloqueo" : "carrera", 1, f, { x: f.x + 80 + i * 13, y: f.y - 60 });

    if (i === 0) {
      primera.cx = f.x + 30;
      primera.cy = f.y - 70;
    }

    trazos.push(primera);

    if (i === 0) trazos.push(nuevoTrazo("carrera", 2, { x: primera.x2, y: primera.y2 }, { x: primera.x2 + 50, y: primera.y2 - 40 }));
  });

  /* El balón en dos tramos encadenados, y una flecha suelta que no es de nadie. */
  const b1 = nuevoTrazo("balon", 2, { x: 150, y: 230 }, { x: 900, y: 330 });

  trazos.push(b1, nuevoTrazo("balon", 3, { x: 900, y: 330 }, { x: 960, y: 420 }));
  trazos.push(nuevoTrazo("carrera", 3, { x: 1200, y: 800 }, { x: 1100, y: 700 }));

  slide.trazos = trazos;
  slide.rivales = [nuevoRival({ x: 930, y: 260 }), { ...nuevoRival({ x: 880, y: 300 }), dorsal: "9" }];
  slide.textos = { grupos: { [plantilla.grupos[0].key]: "REESCRITO A MANO" } };
  slide.guion = { senal: "Mano a la cabeza", rutina: "Bloqueo y segundo palo", intencion: "" };
  slide.notas = [...slide.notas, "Una consigna más con *énfasis*."];

  return slide;
}

PLANTILLAS.forEach((plantilla, n) => {
  const slide = diapositivaLlena(plantilla, 17 + n * 31);

  const rutina = P.rutinaDeSlide({ slide, partidoId: "riv-7", rival: "Teruel", jornada: "7", fecha: "2026-10-18", ahora: AHORA });

  const guardada = porElServidor(rutina);

  ok(guardada.pizarra && guardada.origen, `${plantilla.key}: el servidor conserva origen y pizarra`);
  ok(guardada.roles.length === slide.fichas.length, `${plantilla.key}: un papel por ficha (${guardada.roles.length}/${slide.fichas.length})`);

  const vuelta = P.slideDeRutina(guardada, { id: slide.id, ahora: AHORA });

  const igual = comparable(vuelta) === comparable(slide);

  ok(igual, `${plantilla.key}: la diapositiva vuelve idéntica`);

  if (!igual) {
    console.error("    antes ", comparable(slide).slice(0, 600));
    console.error("    vuelta", comparable(vuelta).slice(0, 600));
  }

  ok(vuelta.laboratorio && vuelta.laboratorio.rutinaId === guardada.id, `${plantilla.key}: la diapositiva recuerda su rutina`);

  /* Y otra vuelta más: lo que sale es lo mismo. */
  const otra = porElServidor(P.rutinaDeSlide({ slide: vuelta, partidoId: "riv-7", rival: "Teruel", ahora: AHORA }));

  ok(canon(otra.roles) === canon(guardada.roles) && canon(otra.balon ?? null) === canon(guardada.balon ?? null) && otra.idea === guardada.idea, `${plantilla.key}: dos vueltas dan los mismos papeles`);

  ok(P.huellaSlide(vuelta) === guardada.pizarra.huella, `${plantilla.key}: la huella reconoce la diapositiva`);
});

/* ------------------------------------------------------------------ */
console.log("3. Lo que se cambia en el laboratorio llega a la pizarra");

{
  const plantilla = PLANTILLAS.find((p) => p.key === "corner-of");

  const slide = diapositivaLlena(plantilla, 99);

  const rutina = porElServidor(P.rutinaDeSlide({ slide, partidoId: "riv-7", rival: "Teruel", ahora: AHORA }));

  const roles = rutina.roles.map((r) => ({ ...r }));

  /* 0: se mueve 2 m (tiene la carrera encadenada). 1: otra punta de carrera. 2: fuera. 3: sin carrera → con carrera. */
  roles[0] = { ...roles[0], x: Math.min(68, roles[0].x + 2), y: roles[0].y };
  roles[1] = { ...roles[1], hx: 30, hy: 4, fase: 3 };
  const quitado = roles.splice(2, 1)[0];
  const sinCarrera = roles.findIndex((r, i) => i > 1 && r.x !== undefined && r.hx === undefined);
  roles[sinCarrera] = { ...roles[sinCarrera], hx: 36, hy: 6, fase: 2 };
  roles.push({ jugador: "JUG-40", papel: "rematador", zona: "segundo-palo", x: 40, y: 7, hx: 38, hy: 3, fase: 2 });
  roles.push({ jugador: "", papel: "senuelo", zona: "centro", x: 33, y: 9 });

  const cambiada = porElServidor({
    ...rutina,
    roles,
    idea: "Rutina: Todo al primer palo\nNueva consigna 1\nNueva consigna 2",
    senal: "Puño cerrado",
    balon: [{ x: 0.5, y: 0.5 }, { x: 31, y: 4 }],
  });

  const vuelta = P.slideDeRutina(cambiada, { id: slide.id, ahora: AHORA });

  const porId = new Map(vuelta.fichas.map((f) => [f.id, f]));

  const antes = new Map(slide.fichas.map((f) => [f.id, f]));

  const movida = porId.get(roles[0].ref);

  const esperado = P.aLienzo("ancho", { x: roles[0].x, y: roles[0].y });

  ok(movida && movida.x === esperado.x && movida.y === esperado.y, "la ficha movida está donde la dejó el laboratorio");

  const suCadena = vuelta.trazos.filter((t) => t.tipo !== "balon" && Math.hypot(t.x1 - movida.x, t.y1 - movida.y) <= 3);

  ok(suCadena.length === 1, "su carrera sale ahora de sus pies");

  const encadenada = slide.trazos.find((t) => t.fase === 2 && t.tipo === "carrera");

  ok(vuelta.trazos.some((t) => t.id === encadenada.id && t.x1 === encadenada.x1), "la segunda fase de su cadena sigue donde estaba (arranca en la punta, que no se ha movido)");

  const t1 = vuelta.trazos.find((t) => t.id === rutina.pizarra.fichas[1].cadena[0]);

  const fin1 = P.aLienzo("ancho", { x: 30, y: 4 });

  ok(t1 && t1.x2 === fin1.x && t1.y2 === fin1.y && t1.fase === 3, "la carrera cambiada acaba en su nueva punta y en su nueva fase");

  ok(!porId.has(quitado.ref), "el papel quitado ya no está en la pizarra");
  ok(!vuelta.trazos.some((t) => rutina.pizarra.fichas[2].cadena.includes(t.id)), "y su carrera se va con él");

  const conNueva = porId.get(roles[sinCarrera].ref);

  ok(vuelta.trazos.some((t) => Math.hypot(t.x1 - conNueva.x, t.y1 - conNueva.y) <= 3 && t.tipo !== "balon"), "el que no corría ahora tiene su carrera");

  const nueva = vuelta.fichas.find((f) => f.playerId === "JUG-40");

  ok(nueva && nueva.puesto === null, "el papel nuevo entra como ficha suelta con su jugador");
  ok(vuelta.fichas.length === slide.fichas.length, "sin jugador no hay cara (el señuelo sin dueño no crea ficha)");

  /* Lo que no se tocó: al píxel. */
  const intactas = vuelta.fichas.filter((f) => antes.has(f.id) && f.id !== roles[0].ref);

  ok(intactas.every((f) => f.x === antes.get(f.id).x && f.y === antes.get(f.id).y && f.puesto === antes.get(f.id).puesto), "el resto de fichas no se mueve ni pierde su puesto");

  ok(canon(vuelta.rivales) === canon(slide.rivales), "los rivales dibujados siguen");
  ok(canon(vuelta.textos) === canon(slide.textos), "los rótulos reescritos siguen");
  ok(canon(vuelta.notas) === canon(["Nueva consigna 1", "Nueva consigna 2"]), "las consignas son las nuevas");
  ok(vuelta.guion.rutina === "Todo al primer palo" && vuelta.guion.senal === "Puño cerrado", "el guion lleva la rutina y la señal nuevas");

  const balon = vuelta.trazos.filter((t) => t.tipo === "balon");

  const finBalon = P.aLienzo("ancho", { x: 31, y: 4 });

  ok(balon.length === 1 && balon[0].x2 === finBalon.x && balon[0].y2 === finBalon.y && balon[0].fase === 2, "el balón es el nuevo, con la fase del primer tramo de antes");
  ok(vuelta.trazos.some((t) => t.x1 === 1200 && t.y1 === 800), "la flecha suelta que no era de nadie sigue");
  ok(vuelta.titulo === slide.titulo, "el nombre no se tocó: el título es el de la diapositiva");

  const renombrada = P.slideDeRutina({ ...cambiada, nombre: "Córner al primer palo" }, { ahora: AHORA });

  ok(renombrada.titulo === "CÓRNER AL PRIMER PALO" && renombrada.id !== slide.id, "renombrada: el título es el nombre, y sin id es diapositiva nueva");
}

/* ------------------------------------------------------------------ */
console.log("4. Del laboratorio a la pizarra y vuelta");

{
  const rutina = porElServidor({
    nombre: "Bernabéu al segundo palo",
    tipo: "corner",
    lado: "ofensivo",
    contra: "zona",
    senal: "Bernabéu",
    idea: "Intención: atacar el segundo palo\nBloqueo al zonal del centro.\nRemate en carrera.",
    roles: [
      { jugador: "JUG-01", papel: "lanzador", zona: "corto", x: 0.8, y: 0.8 },
      { jugador: "JUG-05", papel: "rematador", zona: "segundo-palo", x: 40, y: 13, hx: 38.5, hy: 4, fase: 2 },
      { jugador: "JUG-06", papel: "bloqueador", zona: "centro", x: 34, y: 9, hx: 33, hy: 5, fase: 1 },
      { jugador: "JUG-07", papel: "vigilancia", zona: "atras", x: 34, y: 30 },
      { jugador: "JUG-08", papel: "rematador", zona: "primer-palo" },
    ],
    variantes: ["Al primer palo si cierran el segundo"],
    estado: "probada",
    balon: [{ x: 0.6, y: 0.6 }, { x: 38, y: 5 }],
  });

  const slide = P.slideDeRutina({ ...rutina, id: "rut-x" }, { ahora: AHORA });

  ok(slide.plantilla === "libre" && slide.vista === "ancho", "un córner del laboratorio va a una pizarra libre con el campo ancho");
  ok(slide.fichas.length === 5, "con las cinco caras");
  ok(slide.trazos.filter((t) => t.tipo === "bloqueo").length === 1 && slide.trazos.filter((t) => t.tipo === "carrera").length === 1, "el bloqueador dibuja bloqueo; el rematador, carrera");
  ok(slide.guion.senal === "Bernabéu" && slide.guion.intencion === "atacar el segundo palo", "la señal y la intención van al guion");
  ok(canon(slide.notas) === canon(["Bloqueo al zonal del centro.", "Remate en carrera."]), "la idea va a las consignas");
  ok(slide.laboratorio.rutinaId === "rut-x", "la diapositiva sabe de qué rutina sale");

  const traida = porElServidor(P.rutinaDeSlide({ slide, partidoId: "riv-8", rival: "Algeciras", ahora: AHORA }));

  const conPosicion = rutina.roles.map((r, i) => ({ r, s: require("../lib/abp-lab/campo.ts").salidas(rutina.roles)[i] }));

  let peor = 0;

  conPosicion.forEach(({ r, s }, i) => {
    const t = traida.roles[i];

    peor = Math.max(peor, Math.hypot(t.x - s.x, t.y - s.y));

    if (r.hx !== undefined) peor = Math.max(peor, Math.hypot(t.hx - r.hx, t.hy - r.hy));

    ok(t.jugador === r.jugador, `vuelve ${r.jugador}`);
  });

  ok(peor < 0.15, `papeles y carreras a menos de 0,15 m (peor ${peor.toFixed(3)} m)`);
  ok(traida.balon.length === 2 && Math.hypot(traida.balon[1].x - 38, traida.balon[1].y - 5) < 0.15, "el balón vuelve");
  ok(traida.idea === rutina.idea && traida.senal === rutina.senal, "la idea y la señal vuelven igual");
  ok(traida.roles[2].papel === "bloqueador", "el bloqueo vuelve como bloqueador");

  /* 5. Traer otra vez: manda la pizarra en lo común; lo del laboratorio se queda. */
  console.log("5. Traer otra vez y estado en la pizarra");

  const conLab = { ...traida, id: "rut-y", nombre: "Mi nombre", estado: "partido", progreso: ["charla"], variantes: ["A"], roles: traida.roles.map((r, i) => (i === 1 ? { ...r, papel: "senuelo", nota: "arrastra" } : r)) };

  const movida = { ...slide, fichas: slide.fichas.map((f, i) => (i === 1 ? { ...f, x: f.x + 40 } : f)) };

  const otraVez = P.rutinaDeSlide({ slide: movida, partidoId: "riv-8", rival: "Algeciras", ahora: "2026-10-26T10:00:00.000Z" });

  const fusion = P.fusionaDesdePizarra(conLab, otraVez);

  ok(fusion.id === "rut-y" && fusion.nombre === "Mi nombre" && fusion.estado === "partido" && fusion.variantes[0] === "A", "conserva id, nombre, estado y variantes");
  ok(fusion.roles[1].papel === "senuelo" && fusion.roles[1].nota === "arrastra", "conserva el papel y la nota de cada uno");
  ok(fusion.roles[1].x !== conLab.roles[1].x, "y toma la posición nueva de la pizarra");
  ok(fusion.pizarra.firma.nombre === "Mi nombre", "la firma lleva su nombre: al volver, el título sigue siendo el de la diapositiva");

  const tableros = { "riv-8": { partidoId: "riv-8", rival: "Algeciras", slides: [slide] } };

  const r = { ...traida, id: "rut-z" };

  ok(P.estadoEnPizarra(r, tableros).estado === "igual", "igual: la diapositiva no se ha tocado");
  ok(P.estadoEnPizarra(r, { "riv-8": { ...tableros["riv-8"], slides: [movida] } }).estado === "cambiada", "cambiada: alguien la movió en la pizarra");
  ok(P.estadoEnPizarra(r, { "riv-8": { ...tableros["riv-8"], slides: [] } }).estado === "fuera", "fuera: ya no está");
  ok(
    P.estadoEnPizarra(r, { "riv-8": { ...tableros["riv-8"], slides: [{ ...slide, laboratorio: { rutinaId: "rut-z", enviada: "2026-10-27T00:00:00.000Z" } }] } }).estado === "enviada",
    "enviada: la sustituyó esta rutina",
  );
  ok(P.estadoEnPizarra(r, null).estado === "desconocido", "sin pizarra leída no se afirma nada");

  const variante = { ...r, id: "rut-v", padre: "rut-z" };

  ok(P.estadoEnPizarra(variante, tableros).estado === "variante", "variante: su madre está, ella todavía no");

  const comoNueva = { ...slide, id: "SL-nueva", laboratorio: { rutinaId: "rut-v", enviada: "2026-10-27T00:00:00.000Z" } };

  ok(P.estadoEnPizarra(variante, { "riv-8": { ...tableros["riv-8"], slides: [slide, comoNueva] } }).estado === "enviada", "variante enviada como diapositiva nueva");
}

/* ------------------------------------------------------------------ */
/* 6. Con la pizarra de verdad, si se le pasa (sólo se LEE):
      curl "<web>/api/docs?key=abp-pizarra" > pizarra.json
      node scripts/prueba-puente-pizarra.cjs pizarra.json                 */

if (process.argv[2]) {
  console.log("6. Ida y vuelta con la pizarra de verdad");

  const { normalizaTablero } = require("../lib/abp/pizarra.ts");

  const crudo = JSON.parse(require("fs").readFileSync(process.argv[2], "utf8"));

  const store = crudo.data ?? crudo;

  let diapositivas = 0;

  let malas = 0;

  for (const [partidoId, t] of Object.entries(store.tableros ?? {})) {
    for (const slide of normalizaTablero(t).slides) {
      diapositivas += 1;

      const guardada = porElServidor(P.rutinaDeSlide({ slide, partidoId, rival: t.rival ?? "", ahora: AHORA }));

      const vuelta = P.slideDeRutina(guardada, { id: slide.id, ahora: AHORA });

      if (comparable(vuelta) !== comparable(slide)) {
        malas += 1;

        if (malas <= 3) {
          console.error(`  ✗ ${partidoId} · ${slide.titulo}`);
          console.error("    antes ", comparable(slide).slice(0, 400));
          console.error("    vuelta", comparable(vuelta).slice(0, 400));
        }
      }
    }
  }

  ok(malas === 0, `${diapositivas - malas} de ${diapositivas} diapositivas reales vuelven idénticas`);
}

console.log(`\n${pruebas - fallos} de ${pruebas} bien`);

process.exit(fallos ? 1 : 0);
