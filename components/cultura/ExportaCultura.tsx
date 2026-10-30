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
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { FileDown, FileText, MonitorPlay } from "lucide-react";
import { toast } from "sonner";

import { Button, Panel } from "@/components/abp/ui";
import { DocumentoLienzos } from "@/components/cultura/HojaCultura";
import { creaPptx } from "@/lib/export/pptx";
import {
  apodo,
  capturaLienzos,
  descarga,
  esperaFotos,
  pdfDeLienzos,
  pintado,
} from "@/lib/export/lienzos";
import { esperaFuentePortada } from "@/lib/rivals/portada-font";
import {
  COLORES_CULTURA as C,
  SLIDE_H,
  SLIDE_W,
  titulosDocumento,
  type DocumentoCultura,
} from "@/lib/cultura/modelo";

type Formato = "pptx" | "pdf";

const ETIQUETA: Record<Formato, string> = {
  pptx: "Montando el PowerPoint…",
  pdf: "Montando el PDF…",
};

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
  const lienzosRef = useRef<HTMLDivElement>(null);

  /* Cerrojo: sin él, un segundo render dispararía otra exportación encima. */
  const corriendo = useRef(false);

  const [formato, setFormato] = useState<Formato | null>(null);
  const [paso, setPaso] = useState("");

  const exporta = useCallback(async () => {
    const raiz = lienzosRef.current;

    if (!raiz || !formato || corriendo.current) return;

    corriendo.current = true;

    const aviso = toast.loading(ETIQUETA[formato]);

    try {
      await pintado();
      await esperaFuentePortada();
      await esperaFotos(raiz);

      const titulos = titulosDocumento(documento);

      /* Un bruto sin temporada dejaba «Temporada » colgando en el pie de cada
         hoja: lo que no hay no se nombra (19/10/2026). */
      const temporada = documento.temporada?.trim() ?? "";
      const tituloLargo = `${documento.titulo} · RMCF Castilla${temporada ? ` ${temporada}` : ""}`;

      const imagenes = await capturaLienzos(raiz, "[data-cultura-slide]", {
        ancho: SLIDE_W,
        alto: SLIDE_H,
        fondo: C.papel,
        alPaso: (hechas, total) => setPaso(`${hechas}/${total}`),
      });

      if (imagenes.length === 0) throw new Error("Sin diapositivas");

      /* El nombre con el que el documento circula por el vestuario, tal cual:
         es el mismo con el que se guarda en el repositorio. */
      const nombre = documento.archivo || apodo(documento.titulo, "documento");

      if (formato === "pptx") {
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

        descarga(blob, `${nombre}.pptx`);

        toast.success(`PowerPoint listo · ${imagenes.length} diapositivas`, {
          id: aviso,
        });

        return;
      }

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

      doc.save(`${nombre}.pdf`);

      toast.success(`PDF listo · ${imagenes.length} hojas`, { id: aviso });
    } catch (error) {
      console.error("[cultura] exportación", error);

      toast.error("No se ha podido exportar el documento", { id: aviso });
    } finally {
      corriendo.current = false;

      setFormato(null);
      setPaso("");
    }
  }, [documento, formato]);

  useEffect(() => {
    if (!formato) return;

    let vivo = true;

    /* Un respiro para que los lienzos de repuesto entren en el DOM. */
    const id = window.setTimeout(() => {
      if (vivo) void exporta();
    }, 60);

    return () => {
      vivo = false;
      window.clearTimeout(id);
    };
  }, [exporta, formato]);

  const ocupado = formato !== null;

  const rotulo = (mio: Formato, texto: string) =>
    formato === mio ? `Montando… ${paso}` : texto;

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
          onClick={() => setFormato("pdf")}
          disabled={ocupado}
          title="Una diapositiva por hoja A4 apaisada, con pie numerado"
        >
          {rotulo("pdf", "Descargar en PDF")}
        </Button>

        <Button
          icon={MonitorPlay}
          onClick={() => setFormato("pptx")}
          disabled={ocupado}
          title="Cada diapositiva como imagen a tamaño de proyección"
        >
          {rotulo("pptx", "Descargar en PowerPoint")}
        </Button>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-white/40">
        El PowerPoint se abre en cualquier portátil, aunque no tenga la
        tipografía del club.
      </p>

      {/*
      | Los lienzos de repuesto: el documento entero a tamaño real y apartado de
      | la pantalla. Con posición, nunca con `display:none`, que captura en
      | blanco. Sólo existen mientras dura la exportación.
      */}
      {ocupado && (
        <div
          ref={lienzosRef}
          aria-hidden
          data-export-hide
          className="pointer-events-none"
          style={{
            position: "fixed",
            top: 0,
            left: -(SLIDE_W + 300),
            width: SLIDE_W,
            zIndex: -1,
          }}
        >
          <DocumentoLienzos documento={documento} />
        </div>
      )}
    </Panel>
  );
}
