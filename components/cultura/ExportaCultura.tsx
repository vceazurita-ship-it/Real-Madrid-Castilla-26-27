"use client";

/**
 * Sacar un documento de cultura: el PowerPoint y el PDF.
 *
 * El HTML del que venía el primer documento se exportaba con `window.print()`,
 * que deja el resultado a merced del navegador y del tamaño de la ventana: los
 * márgenes de Chrome, la cabecera con la URL y una diapositiva que se corta
 * distinto en cada portátil. Aquí las dos salidas se montan desde el mismo
 * dibujo a 1920×1080:
 *
 * - **PowerPoint**, para abrirlo en el portátil de la sala sin la app y sin
 *   tener instalada la Barlow Condensed.
 * - **PDF**, A4 apaisado, una diapositiva por hoja y con pie numerado, que es
 *   lo que se manda al grupo y lo que se imprime para el vestuario.
 *
 * La maquinaria —esperas, captura en serie, ZIP del `.pptx`— es la común de
 * `lib/export/`, la misma que usan la pizarra de balón parado y el
 * desplazamiento de partido.
 *
 * En segundo plano (08/11/2026), como las de ABP: el clic deja el encargo con
 * el documento de ese momento; el anfitrión del layout pinta los lienzos fuera
 * de la pantalla (`mesa`), los fotografía y monta el fichero aunque se cambie
 * de pantalla, con su progreso y su aviso al terminar.
 */

import { useSyncExternalStore } from "react";
import { FileDown, FileText, MonitorPlay } from "lucide-react";

import { Button, Panel } from "@/components/abp/ui";
import { DocumentoLienzos } from "@/components/cultura/HojaCultura";
import { creaPptx } from "@/lib/export/pptx";
import { apodo, capturaLienzos, pdfDeLienzos } from "@/lib/export/lienzos";
import { esperaFuentePortada } from "@/lib/rivals/portada-font";
import { descargaEnMarcha, descargas, encargaDescarga } from "@/lib/trabajos/descargas";
import {
  COLORES_CULTURA as C,
  SLIDE_H,
  SLIDE_W,
  titulosDocumento,
  type DocumentoCultura,
} from "@/lib/cultura/modelo";

type Formato = "pptx" | "pdf";

const NOMBRE_FORMATO: Record<Formato, string> = {
  pptx: "PowerPoint",
  pdf: "PDF",
};

const tituloDescarga = (formato: Formato, documento: DocumentoCultura) =>
  `${NOMBRE_FORMATO[formato]} · ${documento.titulo}`;

/** ¿Está en marcha esa descarga? Se repinta cuando cambia. */
function useEnMarcha(titulo: string) {
  return useSyncExternalStore(
    descargas.suscribe,
    () => descargaEnMarcha(titulo),
    () => false,
  );
}

function encargaCultura(documento: DocumentoCultura, formato: Formato) {
  const titulo = tituloDescarga(formato, documento);

  if (descargaEnMarcha(titulo)) return;

  encargaDescarga({
    titulo,
    vuelta: window.location.pathname,
    ancho: SLIDE_W,
    /* Los lienzos de repuesto: el documento entero a tamaño real. */
    mesa: <DocumentoLienzos documento={documento} />,
    tarea: async ({ raiz, avanza }) => {
      if (!raiz) throw new Error("Sin diapositivas");

      await esperaFuentePortada();

      const titulos = titulosDocumento(documento);

      /* Un bruto sin temporada dejaba «Temporada » colgando en el pie de cada
         hoja: lo que no hay no se nombra (19/10/2026). */
      const temporada = documento.temporada?.trim() ?? "";
      const tituloLargo = `${documento.titulo} · RMCF Castilla${temporada ? ` ${temporada}` : ""}`;

      const imagenes = await capturaLienzos(raiz, "[data-cultura-slide]", {
        ancho: SLIDE_W,
        alto: SLIDE_H,
        fondo: C.papel,
        alPaso: (hechas, total) => avanza(`${hechas}/${total} diapositivas`, (hechas / total) * 0.9),
      });

      if (imagenes.length === 0) throw new Error("Sin diapositivas");

      /* El nombre con el que el documento circula por el vestuario, tal cual:
         es el mismo con el que se guarda en el repositorio. */
      const nombre = documento.archivo || apodo(documento.titulo, "documento");

      if (formato === "pptx") {
        avanza("Montando el PowerPoint…", 0.95);

        const blob = creaPptx(
          imagenes.map((imagen, indice) => ({
            titulo: titulos[indice] ?? `Diapositiva ${indice + 1}`,
            imagen,
          })),
          {
            titulo: tituloLargo,
            autor: "RMCF Castilla",
          },
        );

        return { blob, nombre: `${nombre}.pptx` };
      }

      avanza("Montando el PDF…", 0.95);

      const doc = await pdfDeLienzos(imagenes, {
        ancho: SLIDE_W,
        alto: SLIDE_H,
        orientacion: "landscape",
        pie: (indice, total) => ({
          izquierda: (titulos[indice] ?? "").toUpperCase(),
          centro: temporada
            ? `${documento.titulo} · Temporada ${temporada}`
            : documento.titulo,
          derecha: `${indice + 1} / ${total}`,
        }),
      });

      doc.setProperties({
        title: tituloLargo,
        subject: documento.subtitulo,
        creator: "RMCF Castilla",
      });

      return { blob: doc.output("blob"), nombre: `${nombre}.pdf` };
    },
  });
}

/*
| 30/10/2026: el título del documento va en este mismo panel («01 · Valores
| y antivalores» y debajo las descargas): antes salía la tarjeta del
| documento y, justo debajo, «Sacar el documento», dos cabeceras seguidas.
*/
export function ExportaCultura({
  documento,
  titulo,
  subtitulo,
  accion,
  children,
}: {
  documento: DocumentoCultura;
  titulo?: string;
  subtitulo?: string;
  accion?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const enPdf = useEnMarcha(tituloDescarga("pdf", documento));
  const enPptx = useEnMarcha(tituloDescarga("pptx", documento));

  return (
    <Panel
      title={titulo ?? "Sacar el documento"}
      subtitle={subtitulo ?? `${documento.diapositivas.length} diapositivas a 1920×1080, tal y como se ven aquí`}
      icon={FileDown}
      action={accion}
    >
      {children}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          tone="primary"
          icon={FileText}
          onClick={() => encargaCultura(documento, "pdf")}
          disabled={enPdf}
          title="Una diapositiva por hoja A4 apaisada, con pie numerado"
        >
          {enPdf ? "Preparando el PDF…" : "Descargar en PDF"}
        </Button>

        <Button
          icon={MonitorPlay}
          onClick={() => encargaCultura(documento, "pptx")}
          disabled={enPptx}
          title="Cada diapositiva como imagen a tamaño de proyección"
        >
          {enPptx ? "Preparando el PowerPoint…" : "Descargar en PowerPoint"}
        </Button>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-white/40">
        El PowerPoint se abre en cualquier portátil, aunque no tenga la
        tipografía del club.
      </p>
    </Panel>
  );
}
