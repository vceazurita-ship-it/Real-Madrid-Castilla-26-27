"use client";

/**
 * Los vídeos de ABP por jugador, en segundo plano (27/10/2026). Como
 * `MesaPdfs`: vive en el layout (vía `TrabajoPdfs`) y sigue aunque se cambie
 * de pantalla o se esconda la pestaña. Monta uno detrás de otro —dos
 * codificadores a la vez dejan a Chrome sin ninguno— y sube cada uno al
 * acabar, para que el mensaje de WhatsApp lleve su enlace.
 *
 * La jugada de cada diapositiva se prepara una vez por jugador (con él de
 * protagonista) y se pinta instante a instante en `RodajeEscena`.
 */

import { useEffect } from "react";

import { preparaEscena, RodajeEscena, type EscenaJugador } from "@/components/abp/pizarra/rodaje-escena";
import { tituloVisible } from "@/lib/abp/pizarra";
import { cargaEscudos, cometidosDe, nombreArchivo, nombreCorto, preparaJugador } from "@/lib/abp/pizarra-jugador";
import { trabajoPdfs, type EncargoPdfs } from "@/lib/abp/trabajo-pdfs";
import { videoJugador } from "@/lib/abp/video-jugador";
import { imagenDeSvg } from "@/lib/abp-lab/exporta";
import { subeAdjunto } from "@/lib/correo/subeAdjunto";
import { esperaFuentePortada } from "@/lib/rivals/portada-font";

/** El fichero del vídeo, con el mismo nombre que su PDF. */
export function nombreVideo(encargo: Pick<EncargoPdfs, "players" | "jornada" | "rival">, playerId: string) {
  const player = encargo.players.get(playerId);

  return `ABP-${[player?.dorsal, nombreArchivo(nombreCorto(player) || "jugador"), encargo.jornada, nombreArchivo(encargo.rival)]
    .filter((parte) => parte != null && parte !== "")
    .join("-")}.mp4`;
}

/** Sube el vídeo y apunta su enlace (o el fallo, para «Reintentar»). */
export function subeVideo(playerId: string, blob: Blob, nombre: string) {
  subeAdjunto(new File([blob], nombre, { type: "video/mp4" }))
    .then((subido) => trabajoPdfs.subidaVideo(playerId, blob, { url: subido.url }))
    .catch((error) => {
      console.warn("[abp-pizarra] subida del vídeo", error);
      trabajoPdfs.subidaVideo(playerId, blob, { fallo: true });
    });
}

export function MesaVideos({
  encargo,
  alTerminar,
}: {
  encargo: EncargoPdfs;
  alTerminar: (resumen: { listos: number; fallos: number }) => void;
}) {
  useEffect(() => {
    let vivo = true;

    void (async () => {
      let listos = 0;
      let fallos = 0;

      const rodaje = new RodajeEscena();

      try {
        await esperaFuentePortada().catch(() => undefined);

        const escudos = await cargaEscudos(encargo.escudoRival);

        for (const id of encargo.ids) {
          if (!vivo) return;

          const acciones = cometidosDe(encargo.tablero, id, encargo.players);

          if (acciones.length === 0) {
            trabajoPdfs.saltaVideo();
            continue;
          }

          trabajoPdfs.empiezaVideo(id);

          try {
            const escenas: EscenaJugador[] = await Promise.all(
              acciones.map((accion) =>
                preparaEscena({
                  slide: encargo.tablero.slides[accion.indice],
                  titulo: tituloVisible(encargo.tablero.slides, accion.indice),
                  partidoId: encargo.tablero.partidoId,
                  rival: encargo.rival,
                  jornada: encargo.jornada,
                  playerId: id,
                  players: encargo.players,
                }),
              ),
            );

            const { cx, retrato } = await preparaJugador({ player: encargo.players.get(id), rival: encargo.rival, jornada: encargo.jornada, escudos });

            const blob = await videoJugador({
              cx,
              retrato,
              acciones,
              escena: async (orden, t) => {
                /* Desmontado (otra pizarra, o el doble montaje de desarrollo): se corta aquí. */
                if (!vivo) throw new Error("Vídeo cancelado");

                return imagenDeSvg(rodaje.pinta(escenas[orden], t), 1080);
              },
              alProgreso: (fraccion) => trabajoPdfs.avanzaVideo(fraccion),
            });

            if (!vivo) return;

            const nombre = nombreVideo(encargo, id);

            trabajoPdfs.apuntaVideo(encargo.huella, id, { nombre, blob });
            listos += 1;
            subeVideo(id, blob, nombre);
          } catch (error) {
            console.error("[abp-pizarra] vídeo del jugador", error);
            fallos += 1;
            trabajoPdfs.saltaVideo();
          }
        }
      } catch (error) {
        console.error("[abp-pizarra] vídeos por jugador", error);
        fallos += Math.max(1, encargo.ids.length - listos - fallos);
      } finally {
        rodaje.cierra();
      }

      if (!vivo) return;

      trabajoPdfs.terminaVideos();
      alTerminar({ listos, fallos });
    })();

    return () => {
      vivo = false;
    };
    /* Una pasada por encargo: `alTerminar` cambia en cada render del anfitrión. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [encargo]);

  return null;
}
