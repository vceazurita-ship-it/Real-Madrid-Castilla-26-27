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

import Link from "next/link";
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
              title="Prueba una rutina de córner contra el próximo rival"
              lead="El laboratorio de ABP, para el administrador: monta la jugada, mira cómo encaja con el rival y llévala al proyector."
            />

            <div className="mt-6 grid max-w-5xl items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
              <ul className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                {[
                  ["Pizarra viva", "La rutina en metros, con jugadores que se mueven."],
                  ["Encaje con el rival", "Qué zona de su defensa ataca cada rutina."],
                  ["Retos de proyector", "Preguntas para la plantilla sobre la jugada."],
                ].map(([t, d]) => (
                  <li key={t} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-sm font-semibold text-white">{t}</p>
                    <p className="mt-1 text-xs text-white/60">{d}</p>
                  </li>
                ))}
              </ul>

              <div className="flex flex-col items-start gap-3">
                <PuertaAdmin
                  titulo="Entrar en el laboratorio"
                  texto="Sólo entra el administrador. Al entrar volverás a esta misma pantalla del laboratorio."
                  onEntra={entra}
                  onDentro={() => window.location.reload()}
                />
                <Link href="/setpieces" className="text-xs text-white/60 underline underline-offset-4 hover:text-white">
                  Volver a ABP Ofensivo
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
