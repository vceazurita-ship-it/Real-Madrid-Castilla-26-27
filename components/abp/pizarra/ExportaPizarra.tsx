"use client";

/**
 * Llevarse la pizarra: el `.pptx` para la sala y el PDF para imprimir.
 *
 * La pizarra sustituyó al PowerPoint que se montaba a mano, pero el partido
 * sigue necesitando las dos salidas de siempre: el fichero que se proyecta —y
 * que a veces hay que abrir en un portátil sin la app— y el papel que se
 * cuelga en el vestuario y se lleva al banquillo. Aquí salen las dos.
 *
 * **Se exportan TODAS las diapositivas del tablero, no la que se está viendo.**
 * Lo que se enseña en la sala es la charla entera; exportar de una en una era
 * justo el trabajo manual del que se venía huyendo.
 *
 * Como la página monta sólo la diapositiva activa, al exportar se levanta el
 * tablero entero fuera de la pantalla, a tamaño de plantilla y sin escalar, y
 * se fotografía diapositiva a diapositiva. La maquinaria —esperas, captura y
 * PDF— es la de `lib/export/lienzos.ts`, compartida con el dossier de
 * desplazamiento.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { FileDown, MonitorPlay, Printer } from "lucide-react";
import { toast } from "sonner";

import type { Player } from "@/types/player";
import { Button, Panel } from "@/components/abp/ui";
import { TableroSlide } from "@/components/abp/pizarra/TableroSlide";
import {
  COLORES,
  TABLERO_H,
  TABLERO_W,
  type SlidePizarra,
} from "@/lib/abp/pizarra";
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

type Formato = "pptx" | "pdf";

export function ExportaPizarra({
  slides,
  players,
  temporada,
  rival,
  jornada,
}: {
  slides: SlidePizarra[];
  players: Map<string, Player>;
  temporada: string;
  rival: string;
  jornada?: string;
}) {
  const deckRef = useRef<HTMLDivElement>(null);

  /*
  | Un cerrojo, no un estado. Mientras se captura, la página puede tocar el
  | tablero por su cuenta —el autoguardado congela una versión sola a los 45 s
  | sin actividad— y eso renueva el array de diapositivas, que es de lo que
  | depende el efecto: sin cerrojo la exportación se lanzaría dos veces y el
  | navegador bajaría dos ficheros.
  */
  const corriendo = useRef(false);

  const [formato, setFormato] = useState<Formato | null>(null);
  const [hechas, setHechas] = useState(0);

  /*
  | El trabajo va en un efecto y no en el `onClick` porque hace falta que React
  | haya montado el tablero de repuesto —el de fuera de pantalla— antes de
  | fotografiarlo. Pulsar sólo enciende la bandera; capturar es lo que pasa
  | después de pintar.
  */
  const exporta = useCallback(async () => {
    const raiz = deckRef.current;

    if (!raiz || !formato || corriendo.current) return;

    corriendo.current = true;

    const aviso = toast.loading(
      formato === "pptx"
        ? "Montando el PowerPoint…"
        : "Montando el PDF para imprimir…",
    );

    try {
      await pintado();
      await esperaFuentePortada();
      await esperaFotos(raiz);

      const imagenes = await capturaLienzos(raiz, "[data-abp-tablero]", {
        ancho: TABLERO_W,
        alto: TABLERO_H,
        fondo: COLORES.tinta,
        alPaso: setHechas,
      });

      if (imagenes.length === 0) throw new Error("No hay diapositivas");

      const titulos = slides.map((slide) => slide.titulo);

      const nombre = `pizarra-abp-${apodo(rival, "pizarra")}${
        jornada ? `-${apodo(jornada)}` : ""
      }`;

      if (formato === "pptx") {
        const blob = creaPptx(
          imagenes.map((imagen, indice) => ({
            titulo: titulos[indice] ?? `Diapositiva ${indice + 1}`,
            imagen,
          })),
          {
            titulo: `Balón parado · ${rival || "RMCF Castilla"}`,
            autor: "RMCF Castilla",
          },
        );

        descarga(blob, `${nombre}.pptx`);

        toast.success(
          `PowerPoint listo · ${imagenes.length} ${imagenes.length === 1 ? "diapositiva" : "diapositivas"}`,
          { id: aviso },
        );
      } else {
        const cabecera = [rival || "RMCF Castilla", jornada, new Date().toLocaleDateString("es-ES")]
          .filter(Boolean)
          .join(" · ");

        const doc = await pdfDeLienzos(imagenes, {
          ancho: TABLERO_W,
          alto: TABLERO_H,
          orientacion: "landscape",
          pie: (indice, total) => ({
            izquierda: `${indice + 1}. ${titulos[indice] ?? ""}`.toUpperCase(),
            centro: cabecera,
            derecha: `${indice + 1} / ${total}`,
          }),
        });

        doc.save(`${nombre}.pdf`);

        toast.success(
          `PDF listo · ${imagenes.length} ${imagenes.length === 1 ? "hoja" : "hojas"} A4 apaisadas`,
          { id: aviso },
        );
      }
    } catch (error) {
      console.error("[abp-pizarra] exportación", error);

      toast.error("No se ha podido exportar la pizarra", { id: aviso });
    } finally {
      corriendo.current = false;

      setFormato(null);
      setHechas(0);
    }
  }, [formato, jornada, rival, slides]);

  useEffect(() => {
    if (!formato) return;

    let vivo = true;

    /* Un respiro para que el tablero de repuesto entre en el DOM. */
    const id = window.setTimeout(() => {
      if (vivo) void exporta();
    }, 60);

    return () => {
      vivo = false;
      window.clearTimeout(id);
    };
  }, [exporta, formato]);

  const ocupado = formato !== null;

  const total = slides.length;

  return (
    <Panel
      title="Llevárselo a la sala"
      subtitle={`Las ${total} ${total === 1 ? "diapositiva" : "diapositivas"} del tablero, tal y como están: el PowerPoint para proyectar y el PDF para imprimir`}
      icon={FileDown}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Button
          tone="primary"
          icon={MonitorPlay}
          onClick={() => setFormato("pptx")}
          disabled={ocupado || total === 0}
          title="Un .pptx con una diapositiva por acción, a 1920×1080"
        >
          {formato === "pptx"
            ? `Montando… ${hechas}/${total}`
            : "Exportar a PowerPoint"}
        </Button>

        <Button
          icon={Printer}
          onClick={() => setFormato("pdf")}
          disabled={ocupado || total === 0}
          title="Un PDF A4 apaisado, una diapositiva por hoja"
        >
          {formato === "pdf" ? `Montando… ${hechas}/${total}` : "PDF para imprimir"}
        </Button>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-white/40">
        Salen las diapositivas enteras —campo, chapas, panel de puestos y
        consignas—, no sólo la que estás viendo. El PowerPoint lleva cada acción
        como una imagen a tamaño de proyección: se abre en cualquier portátil
        sin la app. El PDF va a una hoja por acción, con el rival y el número de
        diapositiva al pie, para colgarlo en el vestuario.
      </p>

      {/*
      | El tablero de repuesto: las siete diapositivas montadas a la vez, a
      | tamaño de plantilla y apartadas de la pantalla. Sólo existe mientras
      | dura la exportación. Va marcado para que el botón de exportar de la
      | plataforma no lo recoja si alguien lo pulsa a la vez.
      */}
      {ocupado && (
        <div
          ref={deckRef}
          aria-hidden
          data-export-hide
          className="pointer-events-none"
          style={{
            position: "fixed",
            top: 0,
            left: -(TABLERO_W + 200),
            width: TABLERO_W,
            zIndex: -1,
          }}
        >
          {slides.map((slide) => (
            <div key={slide.id} style={{ width: TABLERO_W }}>
              <TableroSlide
                slide={slide}
                players={players}
                temporada={temporada}
                rival={rival}
                seleccion={null}
                onMover={() => undefined}
                onQuitar={() => undefined}
                onPulsarPuesto={() => undefined}
                onSeleccionar={() => undefined}
              />
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
