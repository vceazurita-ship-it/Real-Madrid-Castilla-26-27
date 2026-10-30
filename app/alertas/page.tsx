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

        {/* Margen a la derecha para el botón flotante de herramientas (30/10/2026):
            en el móvil tapaba el borde de la segunda tarjeta. */}
        <div className="py-6 pl-6 pr-12 md:py-10 md:pl-10 md:pr-[76px]">
          <div className="mb-8">
            <p className="text-xs uppercase tracking-[0.3em] text-[#C8A96B]">
              Operativa
            </p>

            <h1 className="mt-2 text-3xl font-semibold">Tareas y alertas</h1>

            <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-white/60">
              Recordatorios que salen solos por correo, aunque no tengas la app
              abierta, hasta que los silencies.
            </p>
          </div>

          {/* 29/10/2026: contenedor de consulta: sólo aquí la lista pasa a dos columnas; el botón flotante sigue en una.
              30/10/2026: hasta 7xl y tres columnas en pantalla ancha; con max-w-5xl quedaba un tercio vacío a 1440 px. */}
          <div className="@container max-w-7xl">
            <GestorAlertas />
          </div>
        </div>
      </main>
    </div>
  );
}
