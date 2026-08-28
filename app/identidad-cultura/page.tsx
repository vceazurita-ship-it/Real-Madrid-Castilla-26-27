"use client";

/**
 * IDENTIDAD Y CULTURA · el repositorio de documentos.
 *
 * Los documentos de cultura del Castilla vivían como HTML sueltos en `public/`
 * —uno por tema, montado a mano y exportado con el botón de imprimir del
 * navegador—, así que ninguno salía igual que el anterior y el contenido no se
 * podía tocar sin editar marcado. Esta pantalla es la estantería: la lista de
 * documentos publicados, la subida del bruto, la vista previa de cada
 * diapositiva tal y como va a salir, y las dos descargas —PDF y PowerPoint—
 * montadas desde ese mismo dibujo.
 *
 * La estantería es un componente (`RepositorioCultura`) y no vive aquí dentro
 * porque también se abre desde Dinámicas y Valores, que es donde el cuerpo
 * técnico trabaja el roadmap cultural. Las dos pantallas leen y escriben el
 * mismo repositorio.
 */

import { AbpHeader } from "@/components/abp/ui";
import { RepositorioCultura } from "@/components/cultura/RepositorioCultura";
import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";

export default function IdentidadCulturaPage() {
  return (
    <main className="min-h-screen bg-[#0B0F14] text-white">
      <div className="flex">
        <Sidebar />

        <section className="flex min-w-0 flex-1 flex-col">
          <Topbar />

          <div className="min-w-0 px-4 py-6 sm:px-6 lg:px-10">
            <AbpHeader
              area="RMCF Castilla · Identidad"
              title="Identidad y Cultura"
              lead="La estantería de documentos de cultura del vestuario. Se sube el bruto —el HTML de la presentación tal y como se redactó—, se redibuja con la plantilla del club a tamaño de proyección y se descarga en PDF para imprimir o en PowerPoint para la sala, sin pasar por el botón de imprimir del navegador."
            />

            <div className="mt-6">
              <RepositorioCultura />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
