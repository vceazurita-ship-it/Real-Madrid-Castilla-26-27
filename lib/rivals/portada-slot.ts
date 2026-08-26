"use client";

import { useSyncExternalStore } from "react";

/*
|--------------------------------------------------------------------------
| LA PORTADA QUE HAY SOBRE LA MESA
|--------------------------------------------------------------------------
|
| El botón flotante de exportar vive en el layout y no sabe qué página hay
| debajo: captura lo que ve. La portada del jugador no se puede capturar —se
| dibuja, no se fotografía— y necesita datos que sólo tiene la página de
| rivales: el escudo del club, el retrato, la temporada que manda.
|
| Así que la página **ofrece** la portada mientras el pop-up de un jugador
| está abierto, y el botón se limita a enseñar la opción y a llamar. Es un
| registro de módulo y no un contexto de React porque el que ofrece y el que
| consume están en ramas distintas del árbol —la página cuelga de `children`
| y el botón es hermano suyo—: meter un proveedor en medio obligaría a
| envolver el layout entero para una opción de menú.
|
| Sólo puede haber una a la vez, que es justo lo que pasa: sólo hay un pop-up
| abierto. La página la retira al cerrarlo.
*/

export type PortadaSlot = {
  /** "ROMERA · Teruel". Rotula la opción del menú. */
  etiqueta: string;
  /** Genera y descarga. Devuelve el nombre del archivo. */
  exportar: (formato: "png" | "pdf") => Promise<string>;
};

let actual: PortadaSlot | null = null;

const oyentes = new Set<() => void>();

/** La página ofrece su portada, o la retira pasando `null`. */
export function ofrecePortada(slot: PortadaSlot | null) {
  actual = slot;

  oyentes.forEach((avisa) => avisa());
}

function suscribe(avisa: () => void) {
  oyentes.add(avisa);

  return () => {
    oyentes.delete(avisa);
  };
}

function lee() {
  return actual;
}

/*
| En el servidor no hay portada que ofrecer: el registro lo llena un efecto
| del navegador. Devolver `null` en el render del servidor evita que el menú
| se pinte con una opción que en el primer render del cliente aún no existe.
*/
function leeEnServidor(): PortadaSlot | null {
  return null;
}

export function usePortadaOfrecida() {
  return useSyncExternalStore(suscribe, lee, leeEnServidor);
}
