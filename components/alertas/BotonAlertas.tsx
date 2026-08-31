"use client";

import { useEffect, useState } from "react";
import { AlarmClock, X } from "lucide-react";

import { useBodyScrollLock } from "@/components/season/useBodyScrollLock";
import GestorAlertas from "./GestorAlertas";

/**
 * Botón flotante de tareas con alerta, disponible en todas las páginas.
 *
 * Va en la misma columna que el conmutador de tema y el de exportar, justo
 * encima de ellos, y lleva `data-export-hide` para no salir en las capturas.
 *
 * El gestor se monta **solo al abrir el panel**: es un botón que está en todas
 * las pantallas de la app, y cargar la lista de alertas en cada visita a
 * cualquier página sería una llamada a la hoja que casi nadie ha pedido.
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
      <button
        type="button"
        data-export-hide
        /* Se aparta cuando hay un modal abierto: ver globals.css. */
        data-flotante
        onClick={() => setAbierto(true)}
        aria-label="Tareas y alertas"
        title="Tareas y alertas"
        className="
          fixed bottom-[192px] right-5 z-[60]
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
        <AlarmClock className="h-5 w-5" aria-hidden />
      </button>

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
