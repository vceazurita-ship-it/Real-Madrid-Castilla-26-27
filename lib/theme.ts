/**
 * Constantes del tema (modo día / modo noche).
 *
 * Viven en un módulo sin `"use client"` a propósito: `app/layout.tsx` es un
 * componente de servidor y necesita estos valores para escribir el script que
 * fija el tema. Si estuvieran en `components/theme-provider.tsx`, al cruzar la
 * frontera de cliente el servidor los leería como `undefined`.
 */

export type Theme = "dark" | "light";

/** Cambiar esta clave invalida la preferencia guardada de todo el mundo. */
export const THEME_STORAGE_KEY = "rmcf-theme";

/** Sin preferencia guardada mandan el oscuro y el diseño original. */
export const DEFAULT_THEME: Theme = "dark";

/**
 * Color de la barra del navegador / PWA en cada tema.
 * Debe coincidir con `--rmcf-page` de `app/globals.css`.
 */
export const THEME_COLOR: Record<Theme, string> = {
  dark: "#0B0F14",
  light: "#EBEEF3",
};

/**
 * Adapta un color pastel arbitrario para usarlo como TEXTO en los dos temas.
 *
 * Media la app está escrita con pastel de la familia 300-400, elegido sobre
 * fondo casi negro; sobre el blanco del modo día esos tonos no llegan ni a
 * 2:1. Las variables `--rmcf-chip-*` (en `app/globals.css`) valen 100% en modo
 * noche —el color no cambia— y mezclan con negro en modo día.
 *
 * Solo para propiedades CSS. En un atributo SVG (`fill`, `stroke`) hay que
 * seguir pasando el hexadecimal: ahí `var()` no se resuelve, y el modo día se
 * corrige con los selectores `[fill="…"]` de `globals.css`.
 */
export function chipInk(color: string) {
  return `color-mix(in srgb, ${color} var(--rmcf-chip-keep), var(--rmcf-chip-mix))`;
}
