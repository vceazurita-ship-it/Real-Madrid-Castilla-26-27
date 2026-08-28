"use client";

/**
 * IDENTIDAD Y CULTURA · el repositorio de documentos.
 *
 * Los documentos de cultura del Castilla vivían como HTML sueltos en `public/`
 * —uno por tema, montado a mano y exportado con el botón de imprimir del
 * navegador—, así que ninguno salía igual que el anterior y el contenido no se
 * podía tocar sin editar marcado. Esta pantalla es la estantería: la lista de
 * documentos publicados, la vista previa de cada diapositiva tal y como va a
 * salir, y las dos descargas —PDF y PowerPoint— montadas desde ese mismo
 * dibujo.
 *
 * El repositorio vive en `lib/cultura/`: el contenido de cada documento es un
 * fichero de datos y el dibujo lo pone la plantilla de la casa
 * (`public/INDIVIDUAL.pptx`), así que publicar el siguiente no toca ni un
 * componente.
 */

import { useState } from "react";
import { BookOpen, FileText, Layers } from "lucide-react";

import { AbpHeader, Notice, Panel } from "@/components/abp/ui";
import { ExportaCultura } from "@/components/cultura/ExportaCultura";
import { HojaCultura } from "@/components/cultura/HojaCultura";
import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { SLIDE_H, SLIDE_W, titulosDocumento } from "@/lib/cultura/modelo";
import { DOCUMENTOS_CULTURA } from "@/lib/cultura/repositorio";
import { barlowCondensed } from "@/lib/rivals/portada-font";
import { Escalado } from "@/components/cultura/Escalado";

export default function IdentidadCulturaPage() {
  const [abierto, setAbierto] = useState(DOCUMENTOS_CULTURA[0]?.id ?? "");

  const documento =
    DOCUMENTOS_CULTURA.find((item) => item.id === abierto) ??
    DOCUMENTOS_CULTURA[0];

  const titulos = documento ? titulosDocumento(documento) : [];

  return (
    <main
      className="min-h-screen bg-[#0B0F14] text-white"
      style={
        {
          /* Sólo las diapositivas van en Barlow Condensed: el cromo de la app
             mantiene la tipografía de siempre. */
          "--fuente-cultura": barlowCondensed.style.fontFamily,
        } as React.CSSProperties
      }
    >
      <div className="flex">
        <Sidebar />

        <section className="flex min-w-0 flex-1 flex-col">
          <Topbar />

          <div className="min-w-0 px-4 py-6 sm:px-6 lg:px-10">
            <AbpHeader
              area="RMCF Castilla · Identidad"
              title="Identidad y Cultura"
              lead="La estantería de documentos de cultura del vestuario. Cada uno se dibuja con la plantilla del club a tamaño de proyección y se descarga en PDF para imprimir o en PowerPoint para la sala, sin pasar por el botón de imprimir del navegador."
            />

            {/* ==================== LA ESTANTERÍA ==================== */}

            <div className="mt-6 grid min-w-0 gap-4 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
              <div className="min-w-0 space-y-4">
                <Panel
                  title="Documentos"
                  subtitle={`${DOCUMENTOS_CULTURA.length} publicado${
                    DOCUMENTOS_CULTURA.length === 1 ? "" : "s"
                  }`}
                  icon={BookOpen}
                  bodyClassName="p-3 sm:p-3"
                >
                  <ul className="space-y-2">
                    {DOCUMENTOS_CULTURA.map((item) => {
                      const activo = item.id === documento?.id;

                      return (
                        <li key={item.id}>
                          <button
                            type="button"
                            onClick={() => setAbierto(item.id)}
                            className={`w-full rounded-xl border px-3.5 py-3 text-left transition ${
                              activo
                                ? "border-[#C8A96B]/50 bg-[#C8A96B]/[0.08]"
                                : "border-white/10 bg-white/[0.02] hover:border-white/25"
                            }`}
                          >
                            <span className="flex items-baseline gap-2">
                              <span className="text-[11px] font-semibold tracking-[0.2em] text-[#C8A96B]">
                                {item.numero}
                              </span>

                              <span className="min-w-0 truncate text-sm font-semibold text-white">
                                {item.titulo}
                              </span>
                            </span>

                            <span className="mt-1 block text-[11px] leading-snug text-white/45">
                              {item.subtitulo}
                            </span>

                            <span className="mt-2 flex flex-wrap gap-1.5">
                              {item.etiquetas.map((etiqueta) => (
                                <span
                                  key={etiqueta}
                                  className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-white/40"
                                >
                                  {etiqueta}
                                </span>
                              ))}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </Panel>

                <Notice title="Cómo crece la estantería">
                  El contenido de cada documento es un fichero de datos en{" "}
                  <code className="text-white/70">lib/cultura/documentos/</code>
                  ; el dibujo lo pone la plantilla del club. Publicar el
                  siguiente es escribir su contenido y añadirlo al repositorio:
                  el PDF y el PowerPoint salen solos, ya con el mismo acabado.
                </Notice>
              </div>

              {documento && (
                <div className="min-w-0 space-y-4">
                  <Panel
                    title={`${documento.numero} · ${documento.titulo}`}
                    subtitle={documento.resumen}
                    icon={FileText}
                  >
                    <div className="grid gap-3 sm:grid-cols-3">
                      <Dato rotulo="Temporada" valor={documento.temporada} />

                      <Dato
                        rotulo="Diapositivas"
                        valor={String(documento.diapositivas.length)}
                      />

                      <Dato
                        rotulo="Origen"
                        valor={documento.origen ?? "Redactado aquí"}
                      />
                    </div>
                  </Panel>

                  <ExportaCultura documento={documento} />

                  <Panel
                    title="Vista previa"
                    subtitle="El documento a tamaño real, escalado a la columna: es el mismo dibujo que se descarga"
                    icon={Layers}
                  >
                    <div className="space-y-5">
                      {documento.diapositivas.map((hoja, indice) => (
                        <div key={indice} className="min-w-0">
                          <p className="mb-2 text-[10px] uppercase tracking-[0.2em] text-white/35">
                            {indice + 1} / {documento.diapositivas.length} ·{" "}
                            {titulos[indice]}
                          </p>

                          <div className="overflow-hidden rounded-xl border border-white/10">
                            <Escalado ancho={SLIDE_W} alto={SLIDE_H}>
                              <HojaCultura
                                documento={documento}
                                hoja={hoja}
                              />
                            </Escalado>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Panel>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

/** Un dato de la ficha del documento: rótulo pequeño, valor legible. */
function Dato({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-white/10 bg-white/[0.02] px-3.5 py-3">
      <p className="text-[10px] uppercase tracking-[0.18em] text-white/35">
        {rotulo}
      </p>

      <p className="mt-1 truncate text-sm font-medium text-white/80">{valor}</p>
    </div>
  );
}
