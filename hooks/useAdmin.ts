"use client";

/**
 * ¿Hay sesión de administrador? (la puerta de Ajustes, `lib/admin/sesion.ts`).
 *
 * La cookie es `httpOnly`, así que el navegador no la puede leer: se pregunta
 * a `/api/admin`. Mientras pregunta, `admin` es `null` (ni sí ni no), para no
 * enseñar un formulario de entrada a quien ya está dentro.
 *
 * LA RESPUESTA SE GUARDA FUERA DEL COMPONENTE (11/10/2026).
 *
 * Cada página monta su propio menú lateral, y el menú pregunta aquí. Antes
 * cada montaje volvía a llamar a `/api/admin`: una petición por cada cambio
 * de pantalla para saber algo que no cambia en toda la sesión. Ahora el último
 * valor —y la petición en vuelo, si la hay— viven en el módulo: un menú recién
 * montado pinta en el acto con lo que ya se sabía y sólo vuelve a preguntar
 * si lo que tiene es de hace más de un minuto. Entrar o salir fuerza la
 * pregunta siempre, que es cuando de verdad cambia.
 */

import { useCallback, useEffect, useSyncExternalStore } from "react";

/** Avisa a los demás sitios de la página (el menú) de que ha cambiado. */
const EVENTO = "rmcf-admin";

/** Cuánto vale la última respuesta antes de volver a preguntar. */
const FRESCURA_MS = 60_000;

/* ------------------------------------------------------------------ */
/*  EL ALMACÉN COMPARTIDO                                              */
/* ------------------------------------------------------------------ */

let admin: boolean | null = null;

/** `0` = todavía no se ha preguntado nunca. */
let leidoEn = 0;

let enVuelo: Promise<void> | null = null;

const oyentes = new Set<() => void>();

function suscribe(avisa: () => void) {
  oyentes.add(avisa);

  return () => {
    oyentes.delete(avisa);
  };
}

const lee = () => admin;

/* En el servidor no hay cookie que mirar: ni sí ni no. */
const leeEnServidor = () => null;

function pon(valor: boolean | null) {
  if (admin === valor) return;

  admin = valor;
  oyentes.forEach((avisa) => avisa());
}

/**
 * Pregunta al servidor si hace falta. Con `forzar` pregunta siempre, aunque
 * haya una respuesta fresca o una petición en vuelo (que se descarta: tras
 * entrar o salir, lo que diga la petición vieja ya no vale).
 */
function revalida(forzar = false) {
  if (!forzar) {
    if (enVuelo) return enVuelo;
    if (leidoEn && Date.now() - leidoEn < FRESCURA_MS) return Promise.resolve();
  }

  const esta = fetch("/api/admin", { cache: "no-store" })
    .then((r) => r.json() as Promise<{ admin?: boolean }>)
    .then((datos) => {
      if (enVuelo !== esta) return;

      leidoEn = Date.now();
      pon(Boolean(datos.admin));
    })
    .catch(() => {
      if (enVuelo !== esta) return;

      leidoEn = Date.now();
      pon(false);
    })
    .finally(() => {
      if (enVuelo === esta) enVuelo = null;
    });

  enVuelo = esta;

  return esta;
}

/* ------------------------------------------------------------------ */
/*  EL HOOK                                                            */
/* ------------------------------------------------------------------ */

/*
| El aviso de «ha cambiado» se escucha UNA vez para toda la página, no una por
| cada componente que use el hook: con el menú, Ajustes y el boceto del plan
| escuchando a la vez, entrar lanzaba tres peticiones forzadas en vez de una.
*/
let escuchando = false;

function escuchaCambios() {
  if (escuchando || typeof window === "undefined") return;

  escuchando = true;
  window.addEventListener(EVENTO, () => {
    revalida(true);
  });
}

export function useAdmin() {
  const valor = useSyncExternalStore(suscribe, lee, leeEnServidor);

  useEffect(() => {
    escuchaCambios();
    revalida();
  }, []);

  const entra = useCallback(async (email: string, contrasena: string) => {
    const respuesta = await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, contrasena }),
    });

    const datos = (await respuesta.json().catch(() => ({}))) as { ok?: boolean; error?: string };

    if (!respuesta.ok || !datos.ok) throw new Error(datos.error ?? "No se ha podido entrar.");

    /* Se sabe ya: el menú no tiene que esperar a la confirmación. */
    pon(true);
    window.dispatchEvent(new Event(EVENTO));
  }, []);

  const sale = useCallback(async () => {
    await fetch("/api/admin", { method: "DELETE" }).catch(() => undefined);

    pon(false);
    window.dispatchEvent(new Event(EVENTO));
  }, []);

  return { admin: valor, entra, sale };
}
