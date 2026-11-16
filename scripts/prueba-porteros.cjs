/*
| PRUEBA · LOS PORTEROS, FUERA DEL SEGUIMIENTO Y DE JUGADORES SESIÓN (16/11/2026)
|
|   node scripts/prueba-porteros.cjs
|
| Sin red ni datos vivos: esPortero / sinPorteros (lib/seguimiento.ts) y
| leeLista / apartaPorteros (lib/sesion-equipos/modelo.ts).
*/

require("./cargador-ts.cjs");
const assert = require("node:assert/strict");
const { esPortero, esDeSeguimiento, sinPorteros, sinSeguimientoReciente } = require("../lib/seguimiento.ts");
const M = require("../lib/sesion-equipos/modelo.ts");

for (const p of ["PORTERO", "Portero", "1", "13", "POR", "por.", "GK", "PT", " portero suplente "]) assert.equal(esPortero(p), true, p);
for (const p of ["", "6", "10", "11", "CENTRAL", "DELANTERO", "Lateral derecho", "PIVOTE", "Extremo", undefined, null, 2]) assert.equal(esPortero(p), false, String(p));
assert.equal(esPortero(1), true);

assert.equal(esDeSeguimiento({ esCastilla: true, posicion: "13" }), false);
assert.equal(esDeSeguimiento({ esCastilla: true, posicion: "8" }), true);
assert.equal(esDeSeguimiento({ esCastilla: false, posicion: "8" }), false);

/* Los registros de un portero siguen en la hoja, pero no se cuentan. */
const plantilla = [
  { id: "A", nombre: "Mestre", posicion: "PORTERO", esCastilla: true },
  { id: "B", nombre: "Fortea", posicion: "2", esCastilla: true },
  { id: "C", nombre: "Navarro", posicion: "1", esCastilla: true },
];
const filas = [
  { ID_JUGADOR: "A", FECHA: "2026-11-10" },
  { ID_JUGADOR: "B", FECHA: "2026-11-10" },
  { ID_JUGADOR: "C", FECHA: "2026-11-01" },
  { ID_JUGADOR: "Z", FECHA: "2026-11-01" },
];
assert.deepEqual(sinPorteros(filas, plantilla).map((f) => f.ID_JUGADOR), ["B", "Z"]);
/* Navarro (portero) lleva 15 días sin registro y no sale en «sin seguimiento en 14 días». */
assert.deepEqual(sinSeguimientoReciente(filas, plantilla, new Date(2026, 10, 16), (f) => f).map((j) => j.id), []);

/* La lista del delegado con porteros marcados: etiqueta «(POR)» o apartado «PORTEROS:». */
const texto = `CASTILLA - LUNES 16/11/26
LISTADO DE JUGADORES (5):
- OSCAR NAASEI
- _MESTRE (POR)_
- FORTEA
PORTEROS:
- JAVI NAVARRO
LESIONADOS:
- IZAN REGUEIRA`;
const lista = M.leeLista(texto);
assert.deepEqual(lista.jugadores.map((j) => j.nombre), ["OSCAR NAASEI", "FORTEA", "IZAN REGUEIRA"]);
assert.deepEqual(lista.porteros, ["MESTRE", "JAVI NAVARRO"]);
assert.equal(lista.jugadores.find((j) => j.nombre === "IZAN REGUEIRA").baja, "Lesionados");

const s = M.nuevaSesion(texto);
assert.deepEqual(s.porteros, ["MESTRE", "JAVI NAVARRO"]);
assert.equal(s.jugadores.length, 3);

/* Lo guardado antes con un portero dentro de un equipo: se le saca sin romper nada. */
const guardada = M.nuevaSesion("S\nLISTADO:\n- ARROYO\n- OSCAR\n- FORTEA");
const [arroyo, oscar] = guardada.jugadores;
const eq = guardada.tareas[0].equipos[0];
guardada.tareas[0].sitio = { [arroyo.id]: eq.id, [oscar.id]: eq.id };
guardada.tareas[0].equipos[0] = { ...eq, orden: [arroyo.id, oscar.id], pares: { [oscar.id]: arroyo.id } };
guardada.tareas[0].cambio = { sitio: { [arroyo.id]: eq.id }, equipos: { [eq.id]: { orden: [arroyo.id] } } };
const vista = M.apartaPorteros(guardada, (j) => j.nombre === "ARROYO");
assert.deepEqual(vista.porteros, ["ARROYO"]);
assert.equal(vista.jugadores.length, 2);
assert.equal(arroyo.id in vista.tareas[0].sitio, false);
assert.equal(vista.tareas[0].equipos[0].orden.includes(arroyo.id), false);
assert.equal(JSON.stringify(vista.tareas[0].equipos[0].pares ?? {}).includes(arroyo.id), false);
assert.equal(arroyo.id in vista.tareas[0].cambio.sitio, false);
assert.equal(M.apartaPorteros(vista, (j) => j.nombre === "ARROYO"), vista, "sin porteros, el mismo objeto");

/* Volver a pegar la lista conserva los ids y vuelve a apartar. */
const otra = M.actualizaLista(vista, "S\nLISTADO:\n- ARROYO\n- OSCAR\n- FORTEA\n- NUEVO (GK)");
assert.deepEqual(otra.porteros, ["NUEVO"]);
const otraVista = M.apartaPorteros(otra, (j) => j.nombre === "ARROYO");
assert.deepEqual(otraVista.porteros, ["NUEVO", "ARROYO"]);
assert.equal(otraVista.jugadores.find((j) => j.nombre === "OSCAR").id, oscar.id);

console.log("ok: porteros fuera del seguimiento y de jugadores sesión");
