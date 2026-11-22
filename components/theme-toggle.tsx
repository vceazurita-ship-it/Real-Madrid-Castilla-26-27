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
/*
| Revelado circular (22/11/2026): con View Transitions el tema nuevo se abre
| en círculo desde el botón pulsado. Sin soporte, o con prefers-reduced-motion,
| cambia de golpe como siempre. El estilo está en components/ui/efectos.css.
*/
type ConTransicion = Document & { startViewTransition?: (cambia: () => void) => { ready: Promise<void>; finished: Promise<void> } };

function cambiaConCirculo(cambia: () => void) {
  const doc = document as ConTransicion;
  if (!doc.startViewTransition || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    cambia();
    return;
  }
  const r = document.activeElement instanceof HTMLElement ? document.activeElement.getBoundingClientRect() : null;
  const x = r && r.width ? r.left + r.width / 2 : window.innerWidth - 40;
  const y = r && r.height ? r.top + r.height / 2 : 40;
  const radio = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
  const raiz = document.documentElement;
  raiz.classList.add("tema-cambia");
  const t = doc.startViewTransition(cambia);
  t.ready
    .then(() =>
      raiz.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radio}px at ${x}px ${y}px)`] },
        { duration: 560, easing: "cubic-bezier(0.22, 1, 0.36, 1)", pseudoElement: "::view-transition-new(root)" },
      ),
    )
    .catch(() => {});
  t.finished.finally(() => raiz.classList.remove("tema-cambia")).catch(() => {});
}

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
      onClick={() => cambiaConCirculo(toggleTheme)}
    />
  );
}

export default ThemeToggle;
