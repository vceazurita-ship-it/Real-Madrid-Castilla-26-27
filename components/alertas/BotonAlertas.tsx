"use client";

import { useEffect, useState } from "react";
import { AlarmClock, X } from "lucide-react";

import { ItemMenuFlotante } from "@/components/ui/MenuFlotante";
import { useBodyScrollLock } from "@/components/season/useBodyScrollLock";
import GestorAlertas from "./GestorAlertas";

/**
 * Tareas con alerta, dentro del menú de herramientas (`MenuFlotante`).
 *
 * El gestor se monta **solo al abrir el panel**: está en todas las pantallas
 * de la app, y cargar la lista de alertas en cada visita a cualquier página
 * sería una llamada a la hoja que casi nadie ha pedido. Por eso la fila del
 * menú tampoco puede enseñar cuántas hay: para saberlo habría que pedirlas, y
 * volveríamos a pagar esa llamada en todas partes.
 */

export function BotonAlertas() {
  const [abierto, setAbierto] = useState(false);

  useBodyScrollLock(abierto);

  useEffect(() => {
    if (!abierto) return;

    const alPulsar = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") setAbierto(false);
    };

    window.addEventListener("keydown", alPulsar);

    return () => window.removeEventListener("keydown", alPulsar);
  }, [abierto]);

  return (
    <>
      <ItemMenuFlotante
        icono={<AlarmClock className="h-4 w-4" aria-hidden />}
        titulo="Tareas y alertas"
        pista="Avisos por correo, con adjuntos"
        onClick={() => setAbierto(true)}
        destacado
        /* Igual que la ayuda y que exportar: el cajón es hijo de esta fila y
           cerrar el menú lo desmontaría antes de que se vea. */
        mantenAbierto
      />

      {abierto && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Tareas y alertas"
          data-export-hide
          className="modal-veil fixed inset-0 z-[85] flex justify-end backdrop-blur-sm"
          onClick={() => setAbierto(false)}
        >
          <aside
            className="flex h-full w-full max-w-md flex-col border-l border-white/10 bg-[#11161D] shadow-2xl"
            onClick={(evento) => evento.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4 border-b border-white/10 p-5">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-white/[0.06] p-2.5 text-[#C8A96B]">
                  <AlarmClock size={20} aria-hidden />
                </div>

                <div>
                  <h2 className="text-lg font-semibold">Tareas y alertas</h2>

                  <p className="text-xs text-white/40">
                    Avisos por correo, con adjuntos
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setAbierto(false)}
                aria-label="Cerrar"
                className="rounded-full p-1.5 text-white/40 transition hover:bg-white/10 hover:text-white"
              >
                <X size={18} aria-hidden />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              <GestorAlertas />
            </div>
          </aside>
        </div>
      )}
    </>
  );
}

export default BotonAlertas;
