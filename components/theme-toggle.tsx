"use client";

import { Moon, Sun } from "lucide-react";

import { ItemMenuFlotante } from "@/components/ui/MenuFlotante";
import { useTheme } from "@/components/theme-provider";

/**
 * Modo día / modo noche.
 *
 * Vive dentro del menú de herramientas (`MenuFlotante`), que agrupa lo que
 * antes eran cuatro botones redondos apilados en el borde de la pantalla.
 *
 * A diferencia de los otros, aquí los dos iconos se pintan **siempre** y es el
 * CSS (`.theme-when-dark` / `.theme-when-light`, en globals.css) quien enseña
 * el que toca. Así el icono es correcto desde el primer pintado, sin esperar a
 * que React hidrate.
 */
export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  const label = theme === "light" ? "Modo noche" : "Modo día";

  return (
    <ItemMenuFlotante
      icono={
        <>
          <Sun className="theme-when-dark h-4 w-4" aria-hidden />
          <Moon className="theme-when-light h-4 w-4" aria-hidden />
        </>
      }
      titulo={label}
      pista={
        theme === "light"
          ? "Fondo oscuro, para el vídeo y la sala"
          : "Fondo claro, para imprimir y para el sol"
      }
      onClick={toggleTheme}
    />
  );
}

export default ThemeToggle;
