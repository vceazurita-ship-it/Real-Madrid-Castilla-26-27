"use client";

import { useMemo, useSyncExternalStore } from "react";

import { MODULES, type AppModule } from "@/lib/modules";

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

/**
 * Las rutas que más se han abierto en este dispositivo, de más a menos, y
 * SÓLO las que se han abierto de verdad: sin relleno.
 *
 * Es lo que necesita un bloque de «Recientes» —el del menú lateral y el de la
 * paleta de Ctrl+K—: enseñar algo que nunca se ha abierto como «reciente»
 * sería mentir. Para una lista que no puede quedarse corta (la portada) está
 * `useModulosMasUsados`, que rellena con lo típico de la semana.
 *
 * Cuenta cualquier ruta, no sólo las del catálogo de la portada: en el menú
 * hay entradas (los laboratorios, los duelos) que no están en `MODULES`.
 */
export function useRutasMasVisitadas(cuantos: number, excluir: string[] = []): string[] {
  const usadas = useModuleUsage();

  /* Como texto, para que la lista no cambie de identidad en cada render. */
  const fuera = excluir.join("\n");

  return useMemo(() => {
    const noValen = new Set(fuera.split("\n"));

    return Object.entries(usadas)
      .filter(([href, veces]) => veces > 0 && !noValen.has(href))
      .sort((a, b) => b[1] - a[1])
      .slice(0, cuantos)
      .map(([href]) => href);
  }, [usadas, cuantos, fuera]);
}

/*
| El orden de salida en un dispositivo nuevo, mientras no hay historial.
|
| Es la semana de trabajo tal y como se hace: se prepara al rival, se escribe
| el plan, se monta el balón parado, se juega y el lunes se valora. En cuanto
| alguien empieza a usar la app, sus visitas mandan sobre esta lista.
*/
export const MODULOS_DE_SALIDA = [
  "/rivals",
  "/match-preparation",
  "/setpieces",
  "/abp-pizarra",
  "/microcycles",
  "/ratings",
  "/individual",
  "/coding",
];

/**
 * Los módulos que más se abren en este dispositivo, de más a menos.
 *
 * Primero lo visitado, ordenado por visitas; detrás, lo de `MODULOS_DE_SALIDA`
 * que aún no haya salido; y al final el resto por su `rank`, para que la lista
 * nunca se quede corta.
 *
 * Lo usan el acceso rápido de la portada y también sus enlaces grandes: la
 * tarjeta de la foto y los dos botones de arriba llevaban destinos fijos que
 * no tenían por qué ser lo que se abre a diario.
 */
export function useModulosMasUsados(cuantos: number): AppModule[] {
  const usadas = useModuleUsage();

  return useMemo(() => {
    const porHref = new Map(MODULES.map((modulo) => [modulo.href, modulo]));

    const visitados = MODULES.filter(
      (modulo) => (usadas[modulo.href] ?? 0) > 0,
    ).sort((a, b) => (usadas[b.href] ?? 0) - (usadas[a.href] ?? 0));

    const elegidos = [...visitados];

    const mete = (modulo?: AppModule) => {
      if (!modulo) return;
      if (elegidos.some((otro) => otro.href === modulo.href)) return;

      elegidos.push(modulo);
    };

    MODULOS_DE_SALIDA.forEach((href) => mete(porHref.get(href)));

    [...MODULES]
      .sort((a, b) => (b.rank ?? 0) - (a.rank ?? 0))
      .forEach((modulo) => mete(modulo));

    return elegidos.slice(0, cuantos);
  }, [usadas, cuantos]);
}
