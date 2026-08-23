"use client";

import { Moon, Sun } from "lucide-react";

import { useTheme } from "@/components/theme-provider";

/**
 * Conmutador flotante de modo día / modo noche, disponible en todas las
 * páginas. Va justo encima del botón de exportar y queda fuera de las
 * capturas.
 *
 * Los dos iconos se pintan siempre y es el CSS (`.theme-when-dark` /
 * `.theme-when-light`, en globals.css) quien enseña el que toca. Así el icono
 * es correcto desde el primer pintado, sin esperar a que React hidrate.
 */
export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  const label =
    theme === "light" ? "Activar modo noche" : "Activar modo día";

  return (
    <button
      type="button"
      data-export-hide
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      className="
        fixed bottom-[136px] right-5 z-[60]
        flex h-11 w-11 items-center justify-center
        rounded-full
        border border-white/10
        bg-white/[0.06]
        text-[#C8A96B]
        shadow-xl
        backdrop-blur
        transition
        hover:bg-white/10
        print:hidden
      "
    >
      <Sun className="theme-when-dark h-5 w-5" aria-hidden />
      <Moon className="theme-when-light h-5 w-5" aria-hidden />
    </button>
  );
}

export default ThemeToggle;
