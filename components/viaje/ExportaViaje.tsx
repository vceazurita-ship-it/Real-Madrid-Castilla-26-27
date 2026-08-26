"use client";

/**
 * Sacar el desplazamiento: el PowerPoint del dossier y los PDF de imprenta.
 *
 * Los dos documentos que esto sustituye viajaban por caminos distintos —el
 * dossier se proyectaba en la reunión de staff y el horario se imprimía y se
 * repartía—, así que aquí salen las cuatro formas en que de verdad se usan:
 *
 * - **PowerPoint del dossier**, para abrirlo en un portátil sin la app.
 * - **PDF del dossier**, A4 apaisado, una diapositiva por hoja.
 * - **PDF del horario**, A4 vertical y a sangre: la hoja ya está diseñada con
 *   sus márgenes, meterla dentro de otro margen la encogería sin motivo.
 * - **Todo en un PDF**, que es lo que se manda al grupo del cuerpo técnico:
 *   dossier apaisado y horario vertical en el mismo fichero.
 *
 * Como en la pizarra de balón parado, los lienzos se montan **fuera de la
 * pantalla** a tamaño real sólo mientras dura la exportación, y la maquinaria
 * —esperas, captura y PDF— es la de `lib/export/lienzos.ts`.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { FileDown, FileText, MonitorPlay, Printer, Files } from "lucide-react";
import { toast } from "sonner";

import { Button, Panel } from "@/components/abp/ui";
import { DossierViaje, titulosDossier } from "@/components/viaje/DossierViaje";
import { HojaHorario } from "@/components/viaje/HojaHorario";
import { creaPptx } from "@/lib/export/pptx";
import {
  apodo,
  capturaLienzos,
  descarga,
  esperaFotos,
  pdfDeHojas,
  pintado,
  type HojaPdf,
} from "@/lib/export/lienzos";
import { esperaFuentePortada } from "@/lib/rivals/portada-font";
import {
  COLORES_VIAJE as C,
  DOSSIER_H,
  DOSSIER_W,
  HOJA_H,
  HOJA_W,
  diaLargo,
  type Desplazamiento,
} from "@/lib/viaje/modelo";

type Formato = "pptx" | "dossier" | "horario" | "todo";

const ETIQUETA: Record<Formato, string> = {
  pptx: "Montando el PowerPoint…",
  dossier: "Montando el PDF del dossier…",
  horario: "Montando el horario…",
  todo: "Montando el documento entero…",
};

export function ExportaViaje({ viaje }: { viaje: Desplazamiento }) {
  const lienzosRef = useRef<HTMLDivElement>(null);

  /* Cerrojo: el autoguardado renueva el objeto y volvería a disparar el efecto. */
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

      const nombre = `desplazamiento-${apodo(viaje.rival, "partido")}${
        viaje.jornada ? `-j${apodo(viaje.jornada)}` : ""
      }`;

      const cabecera = [
        viaje.rival || "RMCF Castilla",
        viaje.jornada ? `Jornada ${viaje.jornada}` : "",
        diaLargo(viaje.fecha) || viaje.fecha,
      ]
        .filter(Boolean)
        .join(" · ");

      const titulos = titulosDossier(viaje);

      const quiereDossier = formato !== "horario";
      const quiereHorario = formato === "horario" || formato === "todo";

      const diapositivas = quiereDossier
        ? await capturaLienzos(raiz, "[data-viaje-slide]", {
            ancho: DOSSIER_W,
            alto: DOSSIER_H,
            fondo: C.papel,
            alPaso: (hechas, total) => setPaso(`dossier ${hechas}/${total}`),
          })
        : [];

      const hojas = quiereHorario
        ? await capturaLienzos(raiz, "[data-viaje-hoja]", {
            ancho: HOJA_W,
            alto: HOJA_H,
            fondo: C.papel,
            alPaso: () => setPaso("horario"),
          })
        : [];

      if (formato === "pptx") {
        if (diapositivas.length === 0) throw new Error("Sin diapositivas");

        const blob = creaPptx(
          diapositivas.map((imagen, indice) => ({
            titulo: titulos[indice] ?? `Diapositiva ${indice + 1}`,
            imagen,
          })),
          {
            titulo: `Desplazamiento · ${viaje.rival || "RMCF Castilla"}`,
            autor: "RMCF Castilla",
          },
        );

        descarga(blob, `${nombre}.pptx`);

        toast.success(`PowerPoint listo · ${diapositivas.length} diapositivas`, {
          id: aviso,
        });

        return;
      }

      /*
      | El horario va a sangre y sin pie: la hoja ya trae su cabecera, su filo
      | rosa y su firma dibujados. Las diapositivas, en cambio, agradecen el
      | margen y el pie con el número de hoja.
      */
      const paginas: HojaPdf[] = [
        ...diapositivas.map((imagen, indice) => ({
          imagen,
          ancho: DOSSIER_W,
          alto: DOSSIER_H,
          orientacion: "landscape" as const,
          pie: {
            izquierda: (titulos[indice] ?? "").toUpperCase(),
            centro: cabecera,
            derecha: `${indice + 1} / ${diapositivas.length + hojas.length}`,
          },
        })),
        ...hojas.map((imagen) => ({
          imagen,
          ancho: HOJA_W,
          alto: HOJA_H,
          orientacion: "portrait" as const,
          margen: 0,
          pie: null,
        })),
      ];

      if (paginas.length === 0) throw new Error("No hay nada que exportar");

      const doc = await pdfDeHojas(paginas);

      const sufijo =
        formato === "horario" ? "horario" : formato === "todo" ? "completo" : "dossier";

      doc.save(`${nombre}-${sufijo}.pdf`);

      toast.success(
        `PDF listo · ${paginas.length} ${paginas.length === 1 ? "hoja" : "hojas"}`,
        { id: aviso },
      );
    } catch (error) {
      console.error("[desplazamiento] exportación", error);

      toast.error("No se ha podido exportar el desplazamiento", { id: aviso });
    } finally {
      corriendo.current = false;

      setFormato(null);
      setPaso("");
    }
  }, [formato, viaje]);

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
      title="Sacar los documentos"
      subtitle={`${titulosDossier(viaje).length} diapositivas de dossier y la hoja del horario, tal y como se ven aquí`}
      icon={FileDown}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Button
          tone="primary"
          icon={Files}
          onClick={() => setFormato("todo")}
          disabled={ocupado}
          title="Dossier apaisado y horario vertical en un solo PDF"
        >
          {rotulo("todo", "Todo en un PDF")}
        </Button>

        <Button
          icon={MonitorPlay}
          onClick={() => setFormato("pptx")}
          disabled={ocupado}
          title="El dossier como .pptx, una diapositiva por hoja a 1920×1080"
        >
          {rotulo("pptx", "Dossier en PowerPoint")}
        </Button>

        <Button
          icon={FileText}
          onClick={() => setFormato("dossier")}
          disabled={ocupado}
          title="El dossier en PDF, A4 apaisado"
        >
          {rotulo("dossier", "Dossier en PDF")}
        </Button>

        <Button
          icon={Printer}
          onClick={() => setFormato("horario")}
          disabled={ocupado}
          title="La hoja del horario en A4 vertical, lista para imprimir"
        >
          {rotulo("horario", "Horario para imprimir")}
        </Button>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-white/40">
        El horario sale a sangre en A4 vertical —la hoja ya trae sus márgenes—,
        y el dossier a una diapositiva por hoja apaisada. El PowerPoint lleva
        cada diapositiva como imagen a tamaño de proyección, así que se abre en
        cualquier portátil aunque no tenga la app ni las tipografías.
      </p>

      {/*
      | Los lienzos de repuesto: el dossier y el horario montados a tamaño real
      | y apartados de la pantalla. Sólo existen mientras dura la exportación.
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
            left: -(DOSSIER_W + 300),
            width: DOSSIER_W,
            zIndex: -1,
          }}
        >
          <DossierViaje viaje={viaje} />
          <HojaHorario viaje={viaje} />
        </div>
      )}
    </Panel>
  );
}
