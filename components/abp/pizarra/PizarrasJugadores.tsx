"use client";

/**
 * Un PDF de balón parado por jugador, para mandarlo por WhatsApp antes del
 * partido (26/10/2026). El dibujo vive en `lib/abp/pizarra-jugador.ts`.
 *
 * Se prepara jugador a jugador: se monta fuera de pantalla SÓLO su tablero
 * (con su cara resaltada), se fotografía y se arma su PDF; luego el
 * siguiente. Montar los once a la vez serían ~80 diapositivas con fotos en el
 * DOM y la pestaña del portátil no lo aguanta.
 *
 * En el móvil «Enviar» abre la hoja de compartir del sistema (WhatsApp sale
 * ahí con el PDF adjunto); en el ordenador se descarga, uno a uno o en .zip.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Send, Smartphone } from "lucide-react";
import { toast } from "sonner";

import type { Player } from "@/types/player";
import { Button, Dialog } from "@/components/abp/ui";
import { TableroSlide } from "@/components/abp/pizarra/TableroSlide";
import {
  COLORES,
  TABLERO_H,
  TABLERO_W,
  jugadoresDelTablero,
  tituloVisible,
  type TableroPizarra,
} from "@/lib/abp/pizarra";
import {
  cargaEscudos,
  cometidosDe,
  nombreCorto,
  pdfJugador,
  type PdfJugador,
} from "@/lib/abp/pizarra-jugador";
import { capturaLienzos, descarga, esperaFotos, pintado } from "@/lib/export/lienzos";
import { creaZip } from "@/lib/export/zip";
import { esperaFuentePortada } from "@/lib/rivals/portada-font";

/* La diapositiva va a lo ancho de una hoja de 1080: 1440 px deja hacer zoom en el móvil. */
const NITIDEZ = 0.75;

export function PizarrasJugadores({
  tablero,
  players,
  temporada,
  rival,
  jornada,
  escudoRival,
}: {
  tablero: TableroPizarra;
  players: Map<string, Player>;
  temporada: string;
  rival: string;
  jornada?: string;
  escudoRival?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [cola, setCola] = useState<string[] | null>(null);
  const [paso, setPaso] = useState(0);
  const [hechos, setHechos] = useState<Record<string, PdfJugador>>({});

  const deckRef = useRef<HTMLDivElement>(null);

  /* Los del tablero, por dorsal: es como se nombran en el vestuario. */
  const jugadores = useMemo(
    () =>
      jugadoresDelTablero(tablero)
        .map((fila) => ({ ...fila, player: players.get(fila.playerId) }))
        .sort(
          (a, b) =>
            (a.player?.dorsal ?? 99) - (b.player?.dorsal ?? 99) ||
            nombreCorto(a.player).localeCompare(nombreCorto(b.player), "es"),
        ),
    [tablero, players],
  );

  const actual = cola && paso < cola.length ? cola[paso] : null;

  const acciones = useMemo(
    () => (actual ? cometidosDe(tablero, actual, players) : []),
    [actual, tablero, players],
  );

  /* Lo que cambia al mover la pizarra deja viejos los PDF ya hechos. */
  const huella = `${tablero.partidoId}|${tablero.actualizado ?? ""}|${rival}`;
  const [huellaHechos, setHuellaHechos] = useState(huella);

  if (huellaHechos !== huella) {
    setHuellaHechos(huella);
    setHechos({});
  }

  useEffect(() => {
    if (!actual || !cola) return;

    let vivo = true;

    const id = window.setTimeout(async () => {
      try {
        const raiz = deckRef.current;
        let capturas: string[] = [];

        if (raiz && acciones.length) {
          await pintado();
          await esperaFuentePortada();
          await esperaFotos(raiz);

          capturas = await capturaLienzos(raiz, "[data-abp-tablero]", {
            ancho: TABLERO_W,
            alto: TABLERO_H,
            fondo: COLORES.tinta,
            nitidez: NITIDEZ,
          });
        }

        const escudos = await cargaEscudos(escudoRival);

        const pdf = await pdfJugador({
          player: players.get(actual),
          acciones,
          capturas,
          rival,
          jornada,
          escudos,
        });

        if (vivo) setHechos((antes) => ({ ...antes, [actual]: pdf }));
      } catch (error) {
        console.error("[abp-pizarra] PDF del jugador", error);

        if (vivo) toast.error(`No se ha podido preparar el PDF de ${nombreCorto(players.get(actual)) || "un jugador"}`);
      } finally {
        if (vivo) {
          if (paso + 1 >= cola.length) {
            setCola(null);
            setPaso(0);
          } else {
            setPaso(paso + 1);
          }
        }
      }
    }, 80);

    return () => {
      vivo = false;
      window.clearTimeout(id);
    };
  }, [actual, acciones, cola, paso, players, rival, jornada, escudoRival]);

  const prepara = (ids: string[]) => {
    if (cola || ids.length === 0) return;

    setPaso(0);
    setCola(ids);
  };

  const ocupado = cola !== null;
  const listos = jugadores.filter((fila) => hechos[fila.playerId]);

  const comparte = async (pdf: PdfJugador, player: Player | undefined) => {
    const archivo = new File([pdf.blob], pdf.nombre, { type: "application/pdf" });

    if (navigator.canShare?.({ files: [archivo] })) {
      try {
        await navigator.share({
          files: [archivo],
          title: pdf.nombre,
          text: `${nombreCorto(player)}, tu balón parado contra ${rival}. Repásalo antes del partido.`,
        });
      } catch {
        /* Cancelado en la hoja de compartir: nada que avisar. */
      }

      return;
    }

    descarga(pdf.blob, pdf.nombre);
  };

  const todosZip = async () => {
    const entradas = await Promise.all(
      listos.map(async (fila) => ({
        nombre: hechos[fila.playerId].nombre,
        datos: new Uint8Array(await hechos[fila.playerId].blob.arrayBuffer()),
      })),
    );

    descarga(creaZip(entradas), `ABP-jugadores-${(jornada ?? "").toLowerCase()}-${rival}.zip`.replace(/\s+/g, "-").replace(/-+/g, "-"));
  };

  return (
    <>
      <Button
        icon={Smartphone}
        onClick={() => setAbierto(true)}
        disabled={jugadores.length === 0}
        title="Un PDF vertical por jugador, con su portada y sus cometidos, para mandarlo por WhatsApp"
      >
        PDF por jugador
      </Button>

      {abierto && (
        <Dialog
          title="Pizarra de cada jugador"
          subtitle={`Un PDF vertical por jugador contra ${rival}: portada con los dos escudos, sus acciones y, en cada una, su cometido y el propósito colectivo`}
          onClose={() => setAbierto(false)}
          footer={
            <div className="flex flex-wrap items-center justify-end gap-2">
              {listos.length > 1 && !ocupado && (
                <Button icon={Download} onClick={() => void todosZip()}>
                  Descargar los {listos.length} (.zip)
                </Button>
              )}

              <Button
                tone="primary"
                icon={Smartphone}
                onClick={() => prepara(jugadores.map((fila) => fila.playerId))}
                disabled={ocupado}
              >
                {ocupado
                  ? `Preparando ${paso + 1} de ${cola?.length ?? 0}…`
                  : listos.length
                    ? "Volver a preparar todos"
                    : `Preparar los ${jugadores.length} PDF`}
              </Button>
            </div>
          }
        >
          <ul className="divide-y divide-white/10">
            {jugadores.map((fila) => {
              const pdf = hechos[fila.playerId];
              const enCurso = actual === fila.playerId;

              return (
                <li key={fila.playerId} className="flex flex-wrap items-center gap-3 py-2">
                  <span className="w-8 text-right font-semibold tabular-nums text-white/50">
                    {fila.player?.dorsal ?? ""}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-white">
                      {nombreCorto(fila.player) || "Jugador sin ficha"}
                    </span>
                    <span className="block text-xs text-white/50">
                      {fila.slides} {fila.slides === 1 ? "acción" : "acciones"}
                      {enCurso ? " · preparando…" : ""}
                    </span>
                  </span>

                  {pdf ? (
                    <span className="flex flex-wrap gap-2">
                      <Button tone="primary" icon={Send} onClick={() => void comparte(pdf, fila.player)} title="En el móvil abre WhatsApp con el PDF adjunto">
                        Enviar
                      </Button>
                      <Button icon={Download} onClick={() => descarga(pdf.blob, pdf.nombre)} aria-label={`Descargar el PDF de ${nombreCorto(fila.player)}`} />
                    </span>
                  ) : (
                    <Button onClick={() => prepara([fila.playerId])} disabled={ocupado}>
                      Preparar
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </Dialog>
      )}

      {/* Sólo el tablero del jugador que se está preparando, fuera de pantalla. */}
      {actual && acciones.length > 0 && (
        <div
          ref={deckRef}
          aria-hidden
          data-export-hide
          className="pointer-events-none"
          style={{ position: "fixed", top: 0, left: -(TABLERO_W + 200), width: TABLERO_W, zIndex: -1 }}
        >
          {acciones.map((accion) => (
            <div key={`${actual}-${accion.indice}`} style={{ width: TABLERO_W }}>
              <TableroSlide
                slide={tablero.slides[accion.indice]}
                titulo={tituloVisible(tablero.slides, accion.indice)}
                soloVer
                destacado={actual}
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
    </>
  );
}
