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
import { FileDown, FileText, ImageDown, MonitorPlay, Printer, Files } from "lucide-react";

import { Button, Panel } from "@/components/abp/ui";
import { confirmar } from "@/lib/avisos";
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
  diaCorto,
  diaLargo,
  type Desplazamiento,
  type ImagenViaje,
} from "@/lib/viaje/modelo";

/*
| `imagen` (12/11/2026, expertos, segunda vuelta): el horario se manda al
| grupo de los jugadores por WhatsApp, y un PDF ahí se abre aparte y con
| zoom. Una imagen por día —la hoja A4 tal cual, en JPEG— se ve en el propio
| chat y se guarda en la galería.
*/
type Formato = "pptx" | "dossier" | "horario" | "todo" | "imagen";

/* El mismo nombre en el botón, en la píldora de la descarga y en el aviso. */
const QUE: Record<Formato, string> = {
  pptx: "Dossier en PowerPoint",
  dossier: "Dossier en PDF",
  horario: "Horario para imprimir",
  todo: "Todo en un PDF",
  imagen: "Horario en imagen",
};

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

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

function encargaViaje(viaje: Desplazamiento, formato: Formato, lugares?: Record<string, ImagenViaje>) {
  const titulo = tituloDescarga(formato, viaje);

  if (descargaEnMarcha(titulo)) return;

  const quiereDossier = formato !== "horario" && formato !== "imagen";
  const quiereHorario = formato === "horario" || formato === "todo" || formato === "imagen";

  encargaDescarga({
    titulo,
    vuelta: window.location.pathname,
    ancho: DOSSIER_W,
    /* Los lienzos de repuesto: el dossier y el horario a tamaño real. */
    mesa: (
      <div>
        {quiereDossier && <DossierViaje viaje={viaje} lugares={lugares} />}
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

      /* Una imagen por día, con el día en el nombre: «…-horario-1-jueves-12.jpg». */
      if (formato === "imagen") {
        if (hojas.length === 0) throw new Error("El viaje no tiene ningún día");

        avanza("Preparando las imágenes…", 0.95);

        return Promise.all(
          hojas.map(async (dataUrl, indice) => {
            const dia = viaje.dias[indice];
            const cuando = dia?.fecha ? `-${apodo(diaCorto(dia.fecha), "dia")}` : "";

            return {
              blob: await (await fetch(dataUrl)).blob(),
              nombre: `${nombre}-horario${hojas.length > 1 ? `-${indice + 1}` : ""}${cuando}.jpg`,
            };
          }),
        );
      }

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

export function ExportaViaje({
  viaje,
  lugares,
  porRevisar = [],
  sinMarco = false,
}: {
  /**
   * Sin su tarjeta (12/11/2026, expertos): dentro del diálogo de «Sacar los
   * documentos», que ya lleva el título y el subtítulo.
   */
  sinMarco?: boolean;
  viaje: Desplazamiento;
  lugares?: Record<string, ImagenViaje>;
  /**
   * Lo que no cuadra todavía (12/11/2026, expertos): con algo aquí se pregunta
   * antes de sacar el documento —con el diálogo de la app, no window.confirm—.
   */
  porRevisar?: string[];
}) {
  const enTodo = useEnMarcha(tituloDescarga("todo", viaje));
  const enPptx = useEnMarcha(tituloDescarga("pptx", viaje));
  const enDossier = useEnMarcha(tituloDescarga("dossier", viaje));
  const enHorario = useEnMarcha(tituloDescarga("horario", viaje));

  const saca = async (formato: Formato) => {
    if (porRevisar.length > 0) {
      const sigue = await confirmar({
        titulo: porRevisar.length === 1 ? "Queda una cosa por revisar" : `Quedan ${porRevisar.length} cosas por revisar`,
        texto: [...porRevisar.map((linea) => `· ${linea}`), "", "El documento saldrá tal y como está."].join("\n"),
        aceptar: "Sacarlo igual",
        cancelar: "Revisar antes",
      });

      if (!sigue) return;
    }

    encargaViaje(viaje, formato, lugares);
  };

  const enImagen = useEnMarcha(tituloDescarga("imagen", viaje));
  const diapositivas = titulosDossier(viaje).length;
  const dias = viaje.dias.length;

  /*
  | Por destinatario (12/11/2026, expertos, segunda vuelta): eran cuatro
  | botones iguales y había que saber cuál se manda a quién. El cuerpo técnico
  | recibe el dossier entero; los jugadores, el horario, que es lo único que
  | miran.
  */
  const botones = (
    <>
      <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-white/50">Para el cuerpo técnico</p>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          tone="primary"
          icon={Files}
          onClick={() => void saca("todo")}
          disabled={enTodo}
          title="Dossier apaisado y horario vertical en un solo PDF"
        >
          {enTodo ? "Preparando…" : "Todo en un PDF"}
        </Button>

        <Button
          icon={MonitorPlay}
          onClick={() => void saca("pptx")}
          disabled={enPptx}
          title="El dossier como .pptx, una diapositiva por hoja a 1920×1080"
        >
          {enPptx ? "Preparando…" : "Dossier en PowerPoint"}
        </Button>

        <Button
          icon={FileText}
          onClick={() => void saca("dossier")}
          disabled={enDossier}
          title="El dossier en PDF, A4 apaisado"
        >
          {enDossier ? "Preparando…" : "Dossier en PDF"}
        </Button>
      </div>

      <p className="mb-2 mt-4 text-[12px] font-semibold uppercase tracking-[0.14em] text-white/50">Para los jugadores</p>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          tone="primary"
          icon={ImageDown}
          onClick={() => void saca("imagen")}
          disabled={enImagen || dias === 0}
          title={dias === 0 ? "El viaje no tiene ningún día: añade uno en el horario" : `${plural(dias, "imagen", "imágenes")} del horario, una por día, para mandar por WhatsApp`}
        >
          {enImagen ? "Preparando…" : dias > 1 ? `Horario en imagen · ${dias} días` : "Horario en imagen"}
        </Button>

        <Button
          icon={Printer}
          onClick={() => void saca("horario")}
          disabled={enHorario || viaje.dias.length === 0}
          title={viaje.dias.length === 0 ? "El viaje no tiene ningún día: añade uno en el horario" : `${viaje.dias.length} ${
            viaje.dias.length === 1 ? "hoja" : "hojas"
          } de horario en A4 vertical, una por día del viaje, listas para imprimir`}
        >
          {enHorario ? "Preparando…" : "Horario para imprimir"}
        </Button>
      </div>
      <p className="mt-2 text-[12px] text-white/45">La imagen se ve en el propio chat de WhatsApp; el PDF, para colgarlo en el vestuario y en el autobús.</p>
    </>
  );

  if (sinMarco) return botones;

  return (
    <Panel
      title="Sacar los documentos"
      subtitle={`${plural(diapositivas, "diapositiva", "diapositivas")} de dossier y ${plural(dias, "hoja", "hojas")} de horario, tal y como se ven aquí`}
      icon={FileDown}
    >
      {botones}
    </Panel>
  );
}
