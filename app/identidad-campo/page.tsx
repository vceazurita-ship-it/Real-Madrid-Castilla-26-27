"use client";

/**
 * IDENTIDAD · Identidad en el campo (02/11/2026).
 *
 * Cruza la Identidad (modelo de juego, perfiles por puesto y valores del
 * vestuario) con DATA (nuestros partidos contra la categoría) y con la
 * metodología (en qué se va la semana de entrenamiento). Cálculo en
 * `lib/identidad/campo.ts`; arnés en `scripts/identidad-campo-arnes.cjs`.
 */

import { AbpHeader } from "@/components/abp/ui";
import { IdentidadCampo } from "@/components/identidad/IdentidadCampo";
import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";

export default function IdentidadCampoPage() {
  return (
    <main className="min-h-screen bg-[#0B0F14] text-white">
      <div className="flex">
        <Sidebar />

        <section className="flex min-w-0 flex-1 flex-col">
          <Topbar />

          <div className="min-w-0 px-4 py-6 sm:px-6 lg:px-10">
            <AbpHeader
              area="RMCF Castilla · Identidad"
              title="¿Se nos reconoce en el campo?"
              lead="Nuestra forma de jugar, el perfil de cada puesto y los valores del vestuario, frente a lo que sale en el partido y a lo que entrenamos en la semana."
            />

            <div className="mt-6">
              <IdentidadCampo />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
