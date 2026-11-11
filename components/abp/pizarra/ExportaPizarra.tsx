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
 * Desde el 01/11/2026 sólo es el trabajo de segundo plano: los botones viven
 * en el menú «Exportar» (`ExportaTodo.tsx`), un único sitio con todas las
 * salidas. Y lo ya fotografiado no se repite: sólo se montan fuera de pantalla
 * las diapositivas que han cambiado desde la última exportación (ver
 * `lib/abp/fotos-tablero.ts`).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import type { Player } from "@/types/player";
import { TableroSlide } from "@/components/abp/pizarra/TableroSlide";
import { TABLERO_H, TABLERO_W, tituloVisible, type SlidePizarra } from "@/lib/abp/pizarra";
import { creaPptx } from "@/lib/export/pptx";
import { apodo, descarga, pdfDeLienzos, pintado } from "@/lib/export/lienzos";
import { fasesDe } from "@/lib/abp/trazos";
import { trabajoExportar } from "@/lib/abp/trabajo-exportar";
import { claveFoto, huellaSlide } from "@/lib/abp/cache-exportar";
import { faltanFotos, fotosDeHojas } from "@/lib/abp/fotos-tablero";

type Formato = "pptx" | "pdf";

/** Las hojas que salen: una por diapositiva o, con «una hoja por fase», una por fase. */
export function hojasDe(slides: SlidePizarra[], porFases: boolean, contexto: Parameters<typeof huellaSlide>[2]) {
  return slides.flatMap((slide, orden) => {
    const n = fasesDe(slide.trazos);

    /* Dos córneres ofensivos no pueden llamarse igual en la hoja. */
    const visible = tituloVisible(slides, orden);
    const huella = huellaSlide(slide, visible, contexto);

    if (!porFases || n < 2) {
      return [{ key: slide.id, slide, visible, titulo: visible, hasta: undefined as number | undefined, clave: claveFoto(huella) }];
    }

    return Array.from({ length: n }, (_, indice) => ({
      key: `${slide.id}-${indice + 1}`,
      slide,
      visible,
      hasta: indice + 1,
      titulo: `${visible} · fase ${indice + 1} de ${n}`,
      clave: claveFoto(huella, indice + 1),
    }));
  });
}

export function ExportaPizarra({
  slides,
  players,
  temporada,
  rival,
  jornada,
  trabajo,
}: {
  /** Montado por el trabajo de segundo plano del layout: exporta solo y no enseña nada. */
  trabajo: { id: string; formato: Formato; porFases: boolean };
  slides: SlidePizarra[];
  players: Map<string, Player>;
  temporada: string;
  rival: string;
  jornada?: string;
}) {
  const deckRef = useRef<HTMLDivElement>(null);

  /*
  | Un cerrojo, no un estado: el doble montaje de React en desarrollo y
  | cualquier repintado no pueden lanzar la exportación dos veces.
  */
  const corriendo = useRef(false);

  const [hechas, setHechas] = useState(0);
  const { formato, porFases } = trabajo;

  const hojas = useMemo(
    () => hojasDe(slides, porFases, { players, temporada, rival }),
    [slides, porFases, players, temporada, rival],
  );

  /* Lo que aún no tiene foto, fijado al empezar: es lo único que se monta. */
  const [montadas] = useState(() => faltanFotos(hojas.map((hoja) => hoja.clave)));

  const exporta = useCallback(async () => {
    if (corriendo.current) return;

    corriendo.current = true;

    const aviso = toast.loading(formato === "pptx" ? "Montando el PowerPoint…" : "Montando el PDF para imprimir…");

    try {
      await pintado();

      const imagenes = await fotosDeHojas({
        raiz: deckRef.current,
        claves: hojas.map((hoja) => hoja.clave),
        montadas,
        alPaso: setHechas,
      });

      if (imagenes.length === 0) throw new Error("No hay diapositivas");

      const titulos = hojas.map((hoja) => hoja.titulo);
      const nombre = `pizarra-abp-${apodo(rival, "pizarra")}${jornada ? `-${apodo(jornada)}` : ""}`;

      if (formato === "pptx") {
        const blob = creaPptx(
          imagenes.map((imagen, indice) => ({ titulo: titulos[indice] ?? `Diapositiva ${indice + 1}`, imagen })),
          { titulo: `Balón parado · ${rival || "RMCF Castilla"}`, autor: "RMCF Castilla" },
        );

        descarga(blob, `${nombre}.pptx`);

        toast.success(`PowerPoint listo · ${imagenes.length} ${imagenes.length === 1 ? "diapositiva" : "diapositivas"}`, { id: aviso });
      } else {
        const cabecera = [rival || "RMCF Castilla", jornada, `versión del ${new Date().toLocaleDateString("es-ES")}`].filter(Boolean).join(" · ");

        const doc = await pdfDeLienzos(imagenes, {
          ancho: TABLERO_W,
          alto: TABLERO_H,
          orientacion: "landscape",
          pie: (indice, total) => ({
            izquierda: `${indice + 1}. ${titulos[indice] ?? ""}`.toUpperCase(),
            centro: cabecera,
            derecha: `${indice + 1} / ${total}`,
          }),
          /* La primera página, el índice: cada hoja enlazada a la suya y, en su pie, la vuelta (01/11/2026). */
          indice: { titulo: "Balón parado", subtitulo: cabecera, entradas: titulos },
        });

        doc.save(`${nombre}.pdf`);

        toast.success(`PDF listo · ${imagenes.length} ${imagenes.length === 1 ? "hoja" : "hojas"} A4 apaisadas`, { id: aviso });
      }
    } catch (error) {
      console.error("[abp-pizarra] exportación", error);

      toast.error("No se ha podido exportar la pizarra", { id: aviso });
    } finally {
      corriendo.current = false;

      trabajoExportar.termina(trabajo.id);
    }
  }, [formato, jornada, rival, hojas, montadas, trabajo.id]);

  useEffect(() => {
    /* Un respiro para que el tablero de repuesto entre en el DOM. */
    const id = window.setTimeout(() => void exporta(), 60);

    return () => window.clearTimeout(id);
  }, [exporta]);

  useEffect(() => {
    trabajoExportar.rotula(trabajo.id, montadas.length ? `${hechas}/${montadas.length}` : "");
  }, [trabajo.id, hechas, montadas.length]);

  return (
    <div
      ref={deckRef}
      aria-hidden
      data-export-hide
      className="pointer-events-none"
      style={{ position: "fixed", top: 0, left: -(TABLERO_W + 200), width: TABLERO_W, zIndex: -1 }}
    >
      {montadas.map((clave) => {
        const hoja = hojas.find((h) => h.clave === clave);

        if (!hoja) return null;

        return (
          <div key={hoja.key} style={{ width: TABLERO_W }}>
            <TableroSlide
              slide={hoja.slide}
              titulo={hoja.visible}
              hastaFase={hoja.hasta}
              soloVer
              players={players}
              temporada={temporada}
              rival={rival}
              partido={[jornada?.trim() ?? "", hojas.length > 1 ? `lámina ${hojas.indexOf(hoja) + 1} de ${hojas.length}` : ""].filter(Boolean).join(" · ")}
              seleccion={null}
              onMover={() => undefined}
              onQuitar={() => undefined}
              onPulsarPuesto={() => undefined}
              onSeleccionar={() => undefined}
            />
          </div>
        );
      })}
    </div>
  );
}
