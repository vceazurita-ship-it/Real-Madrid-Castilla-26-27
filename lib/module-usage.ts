"use client";

import { useMemo, useSyncExternalStore } from "react";

/**
 * Cuántas veces se ha abierto cada módulo, en este dispositivo.
 *
 * Sirve para que la portada ponga delante lo que de verdad se usa. Vive en
 * `localStorage` y se lee con `useSyncExternalStore` para que el servidor y
 * el cliente coincidan en el primer render y no salte un error de hidratación.
 */

const USAGE_KEY = "rmcf-module-usage";

/* Suscriptores dentro de la propia pestaña: `storage` solo avisa a las otras. */
const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);

  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function getSnapshot() {
  try {
    return localStorage.getItem(USAGE_KEY) ?? "{}";
  } catch {
    return "{}";
  }
}

/* En el servidor no hay historial: todos los módulos parten de cero. */
const getServerSnapshot = () => "{}";

/** Suma una visita al módulo. La llaman el menú y las tarjetas de la portada. */
export function trackModuleVisit(href: string) {
  try {
    const usage = JSON.parse(getSnapshot()) as Record<string, number>;

    usage[href] = (usage[href] ?? 0) + 1;

    localStorage.setItem(USAGE_KEY, JSON.stringify(usage));
  } catch {
    /* Modo privado o almacenamiento lleno: el contador es prescindible. */
    return;
  }

  listeners.forEach((notify) => notify());
}

export function useModuleUsage(): Record<string, number> {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return useMemo(() => {
    try {
      const parsed = JSON.parse(raw);

      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }, [raw]);
}
