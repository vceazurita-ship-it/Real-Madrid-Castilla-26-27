"use client";

/**
 * ¿ES ÉSTE EL ORDENADOR PRINCIPAL? (31/10/2026)
 *
 * El del club, donde corre el vigía y están las grabaciones tácticas de los
 * partidos. El navegador no puede saberlo solo, así que se marca a mano en
 * Ajustes y se queda en este navegador (`localStorage`). Lo leen las
 * pantallas que ofrecen algo que sólo funciona ahí, como abrir la grabación
 * táctica desde Vídeo Análisis de Partidos.
 *
 * Se lee con `useSyncExternalStore`: en el servidor y al hidratar vale `false`
 * y no desajusta.
 */

import { useSyncExternalStore } from "react";

const CLAVE = "rmcf:ordenador-principal";

const oyentes = new Set<() => void>();

function suscribe(oye: () => void) {
  oyentes.add(oye);

  /* Otra pestaña lo cambia: también aquí. */
  const deOtra = (e: StorageEvent) => {
    if (e.key === CLAVE) oye();
  };

  window.addEventListener("storage", deOtra);

  return () => {
    oyentes.delete(oye);
    window.removeEventListener("storage", deOtra);
  };
}

function lee() {
  try {
    return window.localStorage.getItem(CLAVE) === "1";
  } catch {
    return false;
  }
}

const enServidor = () => false;

export function useOrdenadorPrincipal() {
  return useSyncExternalStore(suscribe, lee, enServidor);
}

export function marcaOrdenadorPrincipal(si: boolean) {
  try {
    if (si) window.localStorage.setItem(CLAVE, "1");
    else window.localStorage.removeItem(CLAVE);
  } catch {
    /* sin almacén no se puede recordar */
  }

  for (const oye of oyentes) oye();
}
