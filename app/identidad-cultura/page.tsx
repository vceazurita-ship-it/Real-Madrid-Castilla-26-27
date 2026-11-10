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
import { DOCUMENTO_VALORES } from "@/lib/cultura/documentos/valores";
import { conVotos } from "@/components/cultura/HojaCultura";
import { ResumenValores, TOTAL_VOTOS_VALORES } from "@/components/cultura/ResumenValores";

/*
| 08/11/2026: el titular dice la idea con el dato («Humildad, el más votado»)
| y sale del propio documento: si cambia el recuento, cambia el titular.
*/
const TITULAR = (() => {
  const portada = DOCUMENTO_VALORES.diapositivas.find((d) => d.tipo === "portada");
  const indice = portada && portada.tipo === "portada" ? portada.indice : [];
  const votos = (t: string) => Number(conVotos(t).match(/^\d+/)?.[0] ?? 0);
  const primero = [...indice].sort((a, b) => votos(b.votos) - votos(a.votos))[0];

  if (!primero || !votos(primero.votos)) return "Los valores que votó la plantilla";

  /* 10/11/2026: con su base, «9 de 32 votos». */
  return `${indice.length} valores votados por la plantilla: ${primero.titulo}, el más votado (${votos(primero.votos)} de ${TOTAL_VOTOS_VALORES} votos)`;
})();

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
              /* 30/10/2026: titular con mensaje; «Identidad» ya lo dice el área. */
              title={TITULAR}
              lead="Cinco valores, cada uno con lo que suma y lo que no se admite, dentro y fuera del campo. Listos para proyectar en la sala o imprimir."
            />

            {/* 10/11/2026: cada valor con sus votos y su antivalor, en texto y en
                la misma pantalla: en el móvil la miniatura no se lee, y así el
                recuento se comprueba sin abrir las diapositivas. */}
            <section className="mt-5 max-w-3xl rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <h2 className="text-sm font-semibold text-white">Los cinco valores y lo que los destruye</h2>
              <div className="mt-2">
                <ResumenValores />
              </div>
            </section>

            <div className="mt-6">
              <RepositorioCultura />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
