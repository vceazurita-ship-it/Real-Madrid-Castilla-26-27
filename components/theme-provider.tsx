"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
} from "react";

import {
  DEFAULT_THEME,
  THEME_COLOR,
  THEME_STORAGE_KEY,
  type Theme,
} from "@/lib/theme";

/**
 * Modo día / modo noche para toda la plataforma.
 *
 * La fuente de verdad es el atributo `data-theme` del `<html>`, no el estado de
 * React: lo escribe el script en línea de `app/layout.tsx` antes del primer
 * pintado, para que al recargar en modo día no haya un fogonazo oscuro. Este
 * proveedor solo lee ese atributo, lo cambia y lo persiste.
 *
 * Por eso se usa `useSyncExternalStore` en vez de `useState` + efecto: el tema
 * ya existe en el DOM antes de que React arranque, y así se lee sin renders en
 * cascada y sin desajustes de hidratación.
 *
 * Las equivalencias de color del modo día están en `app/globals.css`.
 */

export type { Theme };

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

/* Suscriptores de `useSyncExternalStore`, avisados cuando cambia el tema. */
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

function readTheme(): Theme {
  return document.documentElement.getAttribute("data-theme") === "light"
    ? "light"
    : "dark";
}

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);

  const meta = document.querySelector<HTMLMetaElement>(
    'meta[name="theme-color"]'
  );

  if (meta) meta.content = THEME_COLOR[theme];
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);

  /* Si el tema cambia en otra pestaña, esta se pone al día. */
  const onStorage = (event: StorageEvent) => {
    if (event.key !== THEME_STORAGE_KEY) return;

    applyTheme(event.newValue === "light" ? "light" : "dark");
    notify();
  };

  window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/* En el servidor no hay DOM que leer: se renderiza con el tema por defecto,
   igual que hace el script en línea. */
function getServerSnapshot(): Theme {
  return DEFAULT_THEME;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(subscribe, readTheme, getServerSnapshot);

  const setTheme = useCallback((next: Theme) => {
    applyTheme(next);

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* Modo incógnito o almacenamiento bloqueado: el tema dura lo que dure
         la pestaña, pero la interfaz sigue respondiendo. */
    }

    notify();
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(readTheme() === "light" ? "dark" : "light");
  }, [setTheme]);

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme }),
    [theme, setTheme, toggleTheme]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme debe usarse dentro de <ThemeProvider>");
  }

  return context;
}

export default ThemeProvider;
