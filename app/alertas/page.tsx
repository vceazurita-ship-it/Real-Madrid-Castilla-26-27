"use client";

import GestorAlertas from "@/components/alertas/GestorAlertas";
import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";

/**
 * Tareas y alertas, a pantalla completa.
 *
 * Es la misma herramienta que el botón flotante —comparten `GestorAlertas`—,
 * pero con sitio para repasar todo lo programado de una vez. El botón sirve
 * para apuntar algo sin salir de donde estabas; esta pantalla, para revisar.
 */

export default function AlertasPage() {
  return (
    <div className="flex min-h-screen bg-[#0B0F14] text-white">
      <Sidebar />

      <main className="min-w-0 flex-1">
        <Topbar />

        <div className="p-6 md:p-10">
          <div className="mb-8">
            <p className="text-xs uppercase tracking-[0.3em] text-[#C8A96B]">
              Operativa
            </p>

            <h1 className="mt-2 text-3xl font-semibold">Tareas y alertas</h1>

            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/50">
              Recordatorios que se envían solos por correo, con la foto, el
              vídeo o el audio que haga falta. Se repiten hasta que los
              silencies, y avisan aunque no tengas la app abierta.
            </p>
          </div>

          <div className="max-w-2xl">
            <GestorAlertas />
          </div>
        </div>
      </main>
    </div>
  );
}
