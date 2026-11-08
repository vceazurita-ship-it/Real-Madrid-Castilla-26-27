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
 *
 * En segundo plano (08/11/2026), como las de ABP: el clic deja el encargo con
 * el viaje tal y como está en ese momento (si el autoguardado lo renueva
 * después, da igual) y el anfitrión del layout pinta los lienzos en su mesa
 * fuera de la pantalla, los fotografía y monta el fichero aunque se cambie de
 * pantalla, con su progreso y su aviso al terminar.
 */

import { useSyncExternalStore } from "react";
import { FileDown, FileText, MonitorPlay, Printer, Files } from "lucide-react";

import { Button, Panel } from "@/components/abp/ui";
import { DossierViaje, titulosDossier } from "@/components/viaje/DossierViaje";
import { HojasHorario } from "@/components/viaje/HojaHorario";
import { creaPptx } from "@/lib/export/pptx";
import { apodo, capturaLienzos, pdfDeHojas, type HojaPdf } from "@/lib/export/lienzos";
import { esperaFuentePortada } from "@/lib/rivals/portada-font";
import { descargaEnMarcha, descargas, encargaDescarga } from "@/lib/trabajos/descargas";
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

const QUE: Record<Formato, string> = {
  pptx: "Dossier en PowerPoint",
  dossier: "Dossier en PDF",
  horario: "Horario para imprimir",
  todo: "Desplazamiento en PDF",
};

const tituloDescarga = (formato: Formato, viaje: Desplazamiento) =>
  `${QUE[formato]} · ${viaje.rival || "RMCF Castilla"}${viaje.jornada ? ` · J${viaje.jornada}` : ""}`;

/** ¿Está en marcha esa descarga? Se repinta cuando cambia. */
function useEnMarcha(titulo: string) {
  return useSyncExternalStore(
    descargas.suscribe,
    () => descargaEnMarcha(titulo),
    () => false,
  );
}

function encargaViaje(viaje: Desplazamiento, formato: Formato) {
  const titulo = tituloDescarga(formato, viaje);

  if (descargaEnMarcha(titulo)) return;

  const quiereDossier = formato !== "horario";
  const quiereHorario = formato === "horario" || formato === "todo";

  encargaDescarga({
    titulo,
    vuelta: window.location.pathname,
    ancho: DOSSIER_W,
    /* Los lienzos de repuesto: el dossier y el horario a tamaño real. */
    mesa: (
      <div>
        {quiereDossier && <DossierViaje viaje={viaje} />}
        {quiereHorario && <HojasHorario viaje={viaje} />}
      </div>
    ),
    tarea: async ({ raiz, avanza }) => {
      if (!raiz) throw new Error("No hay nada que exportar");

      await esperaFuentePortada();

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

      const totalNodos = raiz.querySelectorAll("[data-viaje-slide], [data-viaje-hoja]").length || 1;

      const diapositivas = quiereDossier
        ? await capturaLienzos(raiz, "[data-viaje-slide]", {
            ancho: DOSSIER_W,
            alto: DOSSIER_H,
            fondo: C.papel,
            alPaso: (hechas, total) => avanza(`Dossier ${hechas}/${total}`, (hechas / totalNodos) * 0.9),
          })
        : [];

      const hojas = quiereHorario
        ? await capturaLienzos(raiz, "[data-viaje-hoja]", {
            ancho: HOJA_W,
            alto: HOJA_H,
            fondo: C.papel,
            alPaso: (hechas, total) =>
              avanza(`Horario ${hechas}/${total}`, ((diapositivas.length + hechas) / totalNodos) * 0.9),
          })
        : [];

      if (formato === "pptx") {
        if (diapositivas.length === 0) throw new Error("Sin diapositivas");

        avanza("Montando el PowerPoint…", 0.95);

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

        return { blob, nombre: `${nombre}.pptx` };
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

      avanza("Montando el PDF…", 0.95);

      const doc = await pdfDeHojas(paginas);

      const sufijo =
        formato === "horario" ? "horario" : formato === "todo" ? "completo" : "dossier";

      return { blob: doc.output("blob"), nombre: `${nombre}-${sufijo}.pdf` };
    },
  });
}

export function ExportaViaje({ viaje }: { viaje: Desplazamiento }) {
  const enTodo = useEnMarcha(tituloDescarga("todo", viaje));
  const enPptx = useEnMarcha(tituloDescarga("pptx", viaje));
  const enDossier = useEnMarcha(tituloDescarga("dossier", viaje));
  const enHorario = useEnMarcha(tituloDescarga("horario", viaje));

  return (
    <Panel
      title="Sacar los documentos"
      subtitle={`${titulosDossier(viaje).length} diapositivas de dossier y ${
        viaje.dias.length
      } ${viaje.dias.length === 1 ? "hoja" : "hojas"} de horario, tal y como se ven aquí`}
      icon={FileDown}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Button
          tone="primary"
          icon={Files}
          onClick={() => encargaViaje(viaje, "todo")}
          disabled={enTodo}
          title="Dossier apaisado y horario vertical en un solo PDF"
        >
          {enTodo ? "Preparando…" : "Todo en un PDF"}
        </Button>

        <Button
          icon={MonitorPlay}
          onClick={() => encargaViaje(viaje, "pptx")}
          disabled={enPptx}
          title="El dossier como .pptx, una diapositiva por hoja a 1920×1080"
        >
          {enPptx ? "Preparando…" : "Dossier en PowerPoint"}
        </Button>

        <Button
          icon={FileText}
          onClick={() => encargaViaje(viaje, "dossier")}
          disabled={enDossier}
          title="El dossier en PDF, A4 apaisado"
        >
          {enDossier ? "Preparando…" : "Dossier en PDF"}
        </Button>

        <Button
          icon={Printer}
          onClick={() => encargaViaje(viaje, "horario")}
          disabled={enHorario || viaje.dias.length === 0}
          title={viaje.dias.length === 0 ? "El viaje no tiene ningún día: añade uno en el horario" : `${viaje.dias.length} ${
            viaje.dias.length === 1 ? "hoja" : "hojas"
          } de horario en A4 vertical, una por día del viaje, listas para imprimir`}
        >
          {enHorario ? "Preparando…" : "Horario para imprimir"}
        </Button>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-white/40">
        El horario sale a sangre en A4 vertical —la hoja ya trae sus márgenes—
        y con una hoja por cada día del viaje, en su orden; el dossier, a una
        diapositiva por hoja apaisada. El PowerPoint lleva
        cada diapositiva como imagen a tamaño de proyección, así que se abre en
        cualquier portátil aunque no tenga la app ni las tipografías.
      </p>
    </Panel>
  );
}
