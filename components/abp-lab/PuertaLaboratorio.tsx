"use client";

/**
 * LA PUERTA DEL LABORATORIO DE ABP (07/11/2026).
 *
 * Sin sesión de administrador, `app/laboratorio/abp/layout.tsx` pinta esto en
 * la misma dirección en lugar de mandar a Ajustes. Así quien llega sabe dónde
 * está («Laboratorio de ABP · Balón parado») y, al entrar, la página se
 * recarga con su consulta intacta (?seccion=jornada, ?accion=…): un enlace
 * desde Data análisis abre la misma acción después de entrar.
 */

import { AbpHeader } from "@/components/abp/ui";
import { PuertaAdmin } from "@/components/admin/PuertaAdmin";
import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { useAdmin } from "@/hooks/useAdmin";

export function PuertaLaboratorio() {
  const { entra } = useAdmin();

  return (
    <main className="min-h-screen bg-[#0B0F14] text-white">
      <div className="flex">
        <Sidebar />

        <section className="flex min-h-screen min-w-0 flex-1 flex-col">
          <Topbar />

          <div className="flex min-w-0 flex-1 flex-col px-4 pb-24 pt-6 sm:px-6 sm:pb-10 lg:px-10">
            <AbpHeader
              area="RMCF Castilla · Balón parado"
              title="Laboratorio de ABP"
              lead="Donde se inventa el balón parado del Castilla: la pizarra viva, el encaje de cada rutina con el próximo rival y los retos de la plantilla en el proyector."
            />

            <div className="flex flex-1 items-start justify-center pt-8 sm:items-center sm:pt-0">
              <PuertaAdmin
                titulo="Entrar en el laboratorio"
                texto="Sólo entra el administrador. Al entrar se abre la sección que pediste."
                onEntra={entra}
                onDentro={() => window.location.reload()}
              />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
