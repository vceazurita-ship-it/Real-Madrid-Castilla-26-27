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
import { TOTAL_VOTOS_VALORES } from "@/components/cultura/ResumenValores";
import { ValoresIndice } from "@/components/cultura/ValoresIndice";
import Link from "next/link";
import { ClipboardList, Presentation, Route } from "lucide-react";

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
              lead="Cinco valores que eligió el vestuario, cada uno con lo que lo destruye y las conductas por las que se reconoce, dentro y fuera del campo."
            />

            {/* 17/11/2026 (marketing): una sola barra de acciones (descargas, la
                charla, la hoja de ruta y el seguimiento) sin la tarjeta del
                documento aparte; luego el índice de los cinco valores y la
                vista previa. Es el único recuento completo de la app. */}
            <div className="mt-5 pr-10 sm:pr-0">
              <RepositorioCultura
                enlazaUrl
                barra={
                  <>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#C8A96B]/40 bg-[#C8A96B]/10 px-3 py-1 text-sm font-semibold text-[color:var(--rmcf-gold-ink,#C8A96B)]">
                      <Presentation className="h-4 w-4" aria-hidden />
                      Proyéctalo en la charla
                    </span>
                    <Link
                      href="/team-values"
                      className="inline-flex items-center gap-1 rounded-full border border-white/15 px-3 py-1 text-sm text-gray-200 transition-colors hover:border-[#C8A96B]/60 hover:text-white"
                    >
                      <Route className="h-4 w-4" aria-hidden />
                      Hoja de ruta →
                    </Link>
                    <Link
                      href="/individual_proc"
                      className="inline-flex items-center gap-1 rounded-full border border-white/15 px-3 py-1 text-sm text-gray-200 transition-colors hover:border-[#C8A96B]/60 hover:text-white"
                    >
                      <ClipboardList className="h-4 w-4" aria-hidden />
                      Seguimiento →
                    </Link>
                  </>
                }
                antesDeLaVista={<ValoresIndice />}
              />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
