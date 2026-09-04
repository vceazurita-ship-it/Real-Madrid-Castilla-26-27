/*
|--------------------------------------------------------------------------
| VOLVER A LA PÁGINA ANTERIOR
|--------------------------------------------------------------------------
|
| El menú lateral lleva cuarenta entradas y la mayor parte del trabajo salta
| de una a otra —del informe del rival al plan de partido, del plan a la
| pizarra, y vuelta—. Sin un «volver» hay que abrir el menú, buscar la entrada
| y acertar: tres gestos para deshacer uno.
|
| Dos cosas que esto resuelve y que un `router.back()` pelado no:
|
| 1. **No echa de la app.** Si la pestaña se abrió directamente en una página
|    —un enlace del PDF del once, un marcador, el acceso directo del móvil—
|    el «atrás» del navegador saldría a Google o cerraría la pestaña. Aquí,
|    cuando no hay pasos previos, se va a la portada.
|
| 2. **No aparece donde no toca.** En la portada no hay anterior que valga.
|
| Los pasos se cuentan aparte de React —módulo y `sessionStorage`— y no en
| `history.length`, que cuenta también lo que había en la pestaña antes de
| entrar en la app. Y se cuentan fuera del estado a propósito: el número sólo
| hace falta en el momento de pulsar, así que no hay `setState` dentro de un
| efecto ni la cascada de renderizados que el linter persigue.
*/

"use client";

import { useCallback, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

const CLAVE = "nav:pasos";

/** `null` mientras no se haya leído la pestaña. */
let pasos: number | null = null;

/** Última ruta contada, para no sumar dos veces el mismo destino. */
let ultima: string | null = null;

function leePasos() {
  if (pasos !== null) return pasos;

  try {
    pasos = Number(sessionStorage.getItem(CLAVE) ?? "0") || 0;
  } catch {
    /* Ventana privada o almacenamiento bloqueado: se empieza de cero. */
    pasos = 0;
  }

  return pasos;
}

function apunta(ruta: string) {
  if (ultima === ruta) return;

  ultima = ruta;
  pasos = leePasos() + 1;

  try {
    sessionStorage.setItem(CLAVE, String(pasos));
  } catch {
    /* Sin poder guardarlo el botón sigue llevando a la portada. */
  }
}

export function useVolver() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    apunta(pathname);
  }, [pathname]);

  const volver = useCallback(() => {
    /* Una sola página vista en esta pestaña: detrás no hay app. */
    if (leePasos() > 1) {
      router.back();

      return;
    }

    router.push("/");
  }, [router]);

  return {
    /** La portada es el principio del camino: allí no se pinta. */
    visible: pathname !== "/",
    volver,
  };
}

export default useVolver;
