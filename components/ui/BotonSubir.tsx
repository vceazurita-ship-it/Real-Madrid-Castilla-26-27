"use client";

/**
 * VOLVER ARRIBA (14/11/2026, petición del analista: «mejora las navegaciones
 * de todas las páginas, en PC y en móvil»).
 *
 * Un botón redondo abajo a la izquierda que sale cuando se ha bajado más de
 * pantalla y media, en todas las pantallas (va en el layout). A la izquierda
 * porque la derecha es del menú de herramientas flotante. En escritorio se
 * aparta del rail del menú lateral. Se esconde con un modal abierto
 * (`body:has(.modal-veil) .boton-subir` en globals.css) y al imprimir/exportar
 * (`data-export-hide`).
 */

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";

export function BotonSubir() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let pedido = 0;
    const mira = () => {
      cancelAnimationFrame(pedido);
      pedido = requestAnimationFrame(() => setVisible(window.scrollY > window.innerHeight * 1.5));
    };
    window.addEventListener("scroll", mira, { passive: true });
    window.addEventListener("resize", mira);
    mira();
    return () => {
      cancelAnimationFrame(pedido);
      window.removeEventListener("scroll", mira);
      window.removeEventListener("resize", mira);
    };
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      data-export-hide
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Volver arriba"
      title="Volver arriba"
      className="boton-subir fixed bottom-4 left-4 z-30 flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-[#111827]/90 text-white shadow-lg backdrop-blur-md transition hover:border-[#C8A96B]/60 hover:text-[#C8A96B] md:bottom-6 md:left-[92px]"
    >
      <ArrowUp size={18} aria-hidden />
    </button>
  );
}
