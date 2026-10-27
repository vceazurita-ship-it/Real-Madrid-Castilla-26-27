"use client";

/**
 * La mesa de trabajo de los PDF por jugador (27/10/2026): monta fuera de
 * pantalla las diapositivas que salen en algún PDF, las fotografía UNA vez y
 * arma el PDF de cada uno encima de esas fotos.
 *
 * Antes se montaba y fotografiaba el tablero de cada jugador con su cara
 * resaltada: once jugadores eran once tandas de fotos de las mismas
 * diapositivas. Ahora el resalte (foco y aro «TÚ») se pinta en el lienzo del
 * PDF, y la foto se comparte: el tiempo es el de una sola tanda.
 *
 * Vive en el layout (vía `TrabajoPdfs`): sigue aunque se cambie de pantalla.
 */

import { useEffect, useMemo, useRef } from "react";

import { TableroSlide } from "@/components/abp/pizarra/TableroSlide";
import { COLORES, TABLERO_H, TABLERO_W, tituloVisible } from "@/lib/abp/pizarra";
import { cargaEscudos, cometidosDe, pdfJugador } from "@/lib/abp/pizarra-jugador";
import { trabajoPdfs, type EncargoPdfs } from "@/lib/abp/trabajo-pdfs";
import { subeAdjunto } from "@/lib/correo/subeAdjunto";
import { capturaLienzos, esperaFotos, pintado } from "@/lib/export/lienzos";
import { esperaFuentePortada } from "@/lib/rivals/portada-font";

/* La diapositiva va a lo ancho de una hoja de 1080: 1440 px deja hacer zoom en el móvil. */
const NITIDEZ = 0.75;

export function MesaPdfs({
  encargo,
  alTerminar,
}: {
  encargo: EncargoPdfs;
  alTerminar: (resumen: { listos: number; fallos: number }) => void;
}) {
  const raizRef = useRef<HTMLDivElement>(null);

  const porJugador = useMemo(
    () => new Map(encargo.ids.map((id) => [id, cometidosDe(encargo.tablero, id, encargo.players)])),
    [encargo],
  );

  /* Las diapositivas que salen en algún PDF, cada una una sola vez. */
  const indices = useMemo(
    () => [...new Set([...porJugador.values()].flat().map((accion) => accion.indice))].sort((a, b) => a - b),
    [porJugador],
  );

  useEffect(() => {
    let vivo = true;

    void (async () => {
      let listos = 0;
      let fallos = 0;

      try {
        const raiz = raizRef.current;

        if (!raiz) throw new Error("Sin mesa de trabajo");

        await pintado();
        await esperaFuentePortada();
        await esperaFotos(raiz);

        if (!vivo) return;

        /* Dónde cae la cara de cada uno en cada diapositiva (1920×1080). */
        const puntos = new Map<string, { x: number; y: number }>();

        Array.from(raiz.querySelectorAll<HTMLElement>("[data-abp-tablero]")).forEach((nodo, k) => {
          const caja = nodo.getBoundingClientRect();
          const escala = TABLERO_W / Math.max(1, caja.width);

          nodo.querySelectorAll<HTMLElement>("[data-player]").forEach((ficha) => {
            const clave = `${indices[k]}:${ficha.dataset.player}`;
            const cara = ficha.querySelector("img")?.getBoundingClientRect();

            if (cara && !puntos.has(clave)) {
              puntos.set(clave, {
                x: (cara.left + cara.width / 2 - caja.left) * escala,
                y: (cara.top + cara.height / 2 - caja.top) * escala,
              });
            }
          });
        });

        const capturas = await capturaLienzos(raiz, "[data-abp-tablero]", {
          ancho: TABLERO_W,
          alto: TABLERO_H,
          fondo: COLORES.tinta,
          nitidez: NITIDEZ,
        });

        const porIndice = new Map(indices.map((indice, k) => [indice, capturas[k] ?? ""]));
        const escudos = await cargaEscudos(encargo.escudoRival);

        for (const id of encargo.ids) {
          if (!vivo) return;

          const acciones = porJugador.get(id) ?? [];

          if (acciones.length === 0) {
            trabajoPdfs.salta();
            continue;
          }

          trabajoPdfs.empieza(id);

          try {
            const pdf = await pdfJugador({
              player: encargo.players.get(id),
              acciones,
              capturas: acciones.map((accion) => porIndice.get(accion.indice) ?? ""),
              puntos: acciones.map((accion) => puntos.get(`${accion.indice}:${id}`) ?? null),
              rival: encargo.rival,
              jornada: encargo.jornada,
              escudos,
            });

            trabajoPdfs.apunta(encargo.huella, id, pdf);
            listos += 1;

            /* Subido ya, para que el toque de WhatsApp abra el chat al instante. */
            subeAdjunto(new File([pdf.blob], pdf.nombre, { type: "application/pdf" }))
              .then((subido) => trabajoPdfs.enlaza(id, pdf.blob, subido.url))
              .catch((error) => console.warn("[abp-pizarra] subida del PDF", error));
          } catch (error) {
            console.error("[abp-pizarra] PDF del jugador", error);
            fallos += 1;
            trabajoPdfs.salta();
          }

          /* Respiro entre uno y otro: la app sigue respondiendo mientras se navega. */
          await new Promise((listo) => setTimeout(listo, 0));
        }
      } catch (error) {
        console.error("[abp-pizarra] PDF por jugador", error);
        fallos += Math.max(1, encargo.ids.length - listos);
      }

      if (!vivo) return;

      trabajoPdfs.termina();
      alTerminar({ listos, fallos });
    })();

    return () => {
      vivo = false;
    };
    /* Una pasada por encargo: `alTerminar` cambia en cada render del anfitrión. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [encargo, indices, porJugador]);

  return (
    <div
      ref={raizRef}
      aria-hidden
      data-export-hide
      className="pointer-events-none"
      style={{ position: "fixed", top: 0, left: -(TABLERO_W + 200), width: TABLERO_W, zIndex: -1 }}
    >
      {indices.map((indice) => (
        <div key={indice} style={{ width: TABLERO_W }}>
          <TableroSlide
            slide={encargo.tablero.slides[indice]}
            titulo={tituloVisible(encargo.tablero.slides, indice)}
            soloVer
            players={encargo.players}
            temporada={encargo.temporada}
            rival={encargo.rival}
            seleccion={null}
            onMover={() => undefined}
            onQuitar={() => undefined}
            onPulsarPuesto={() => undefined}
            onSeleccionar={() => undefined}
          />
        </div>
      ))}
    </div>
  );
}
