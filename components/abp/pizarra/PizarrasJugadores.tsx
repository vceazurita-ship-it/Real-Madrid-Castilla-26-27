"use client";

/**
 * Un PDF de balón parado por jugador, para mandarlo por WhatsApp antes del
 * partido (26/10/2026). El dibujo vive en `lib/abp/pizarra-jugador.ts`.
 *
 * Al abrir la ventana se preparan TODOS de golpe, jugador a jugador: se monta
 * fuera de pantalla sólo su tablero (con su cara resaltada), se fotografía,
 * se arma su PDF y se sube al almacén (como los informes: enlace que dura 30
 * días). Montar los once a la vez serían ~80 diapositivas con fotos en el DOM.
 *
 * El envío rápido es `wa.me/<su móvil>?text=<mensaje con el enlace>`: un toque
 * abre su chat con todo escrito y otro en «Enviar». Los móviles se guardan una
 * vez (`/api/abp/telefonos`, sólo con sesión del cuerpo técnico). «Enviar al
 * siguiente» recorre la lista sin buscar a nadie. El enlace se abre en el
 * mismo clic —si se subiera en ese momento, el navegador bloquearía la
 * ventana—, por eso la subida va antes.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Download, Film, MessageCircle, Send, Smartphone } from "lucide-react";
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
import { enlaceWhatsapp, esTelefono, telefonoLegible } from "@/lib/correo/whatsapp";
import { subeAdjunto } from "@/lib/correo/subeAdjunto";
import { capturaLienzos, descarga, esperaFotos, pintado } from "@/lib/export/lienzos";
import { creaZip } from "@/lib/export/zip";
import { esperaFuentePortada } from "@/lib/rivals/portada-font";
import { capturaNodo } from "@/lib/export/captura";
import { PIXEL_VACIO } from "@/lib/export/lienzos";
import { fasesDe } from "@/lib/abp/trazos";
import { preparaJugador } from "@/lib/abp/pizarra-jugador";
import { videoJugador, type FotoDiapositiva } from "@/lib/abp/video-jugador";
import { puedeHacerVideo } from "@/lib/tactics/lamina";

/* La diapositiva va a lo ancho de una hoja de 1080: 1440 px deja hacer zoom en el móvil. */
const NITIDEZ = 0.75;

type Hecho = PdfJugador & { url?: string };

/** El vídeo de un jugador: su PDF en movimiento (`lib/abp/video-jugador.ts`). */
type VideoHecho = { nombre: string; blob: Blob; url?: string; fallo?: boolean };

/* La diapositiva va a 1080 de ancho en la hoja: 0,75 da 1440 y aguanta el zoom. */
const NITIDEZ_VIDEO = 0.75;

const cargaFoto = (src: string) =>
  new Promise<HTMLImageElement>((listo, falla) => {
    const imagen = new Image();

    imagen.onload = () => listo(imagen);
    imagen.onerror = () => falla(new Error("No se ha podido leer un fotograma"));
    imagen.src = src;
  });

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
  const [hechos, setHechos] = useState<Record<string, Hecho>>({});
  const [enviados, setEnviados] = useState<Set<string>>(new Set());

  /* Los móviles: `null` mientras no se han leído; sin sesión, `sinPermiso`. */
  const [telefonos, setTelefonos] = useState<Record<string, string> | null>(null);
  const [sinPermiso, setSinPermiso] = useState(false);
  const [borradores, setBorradores] = useState<Record<string, string>>({});

  const deckRef = useRef<HTMLDivElement>(null);

  /* El vídeo que se está montando: de quién, qué acción y en qué instante. */
  const [rodaje, setRodaje] = useState<{ playerId: string; indice: number; tiempo: number } | null>(null);
  const [videos, setVideos] = useState<Record<string, VideoHecho>>({});
  const [progresoVideo, setProgresoVideo] = useState("");
  const rodajeRef = useRef<HTMLDivElement>(null);
  const rodando = useRef(false);
  /* La versión de la pizarra con la que se empezó a rodar: si cambia, se descarta. */
  const huellaRef = useRef("");
  const sabeVideo = typeof window !== "undefined" && puedeHacerVideo();

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

  useEffect(() => {
    huellaRef.current = huella;
  }, [huella]);

  if (huellaHechos !== huella) {
    setHuellaHechos(huella);
    setHechos({});
    setVideos({});
    setEnviados(new Set());
  }

  const prepara = (ids: string[]) => {
    if (cola || ids.length === 0) return;

    setPaso(0);
    setCola(ids);
  };

  const abre = () => {
    setAbierto(true);

    /* De golpe: lo que falte se prepara solo al abrir. */
    const faltan = jugadores.map((fila) => fila.playerId).filter((id) => !hechos[id]);

    prepara(faltan);

    if (telefonos === null) {
      fetch("/api/abp/telefonos", { cache: "no-store" })
        .then(async (respuesta) => {
          if (respuesta.status === 401) {
            setSinPermiso(true);
            setTelefonos({});

            return;
          }

          const json = (await respuesta.json()) as { telefonos?: Record<string, string> };

          setTelefonos(json.telefonos ?? {});
        })
        .catch(() => setTelefonos({}));
    }
  };

  useEffect(() => {
    if (!actual || !cola) return;

    let vivo = true;

    const id = window.setTimeout(async () => {
      try {
        const raiz = deckRef.current;
        let capturas: string[] = [];
        let puntos: ({ x: number; y: number } | null)[] = [];

        if (raiz && acciones.length) {
          await pintado();
          await esperaFuentePortada();
          await esperaFotos(raiz);

          /* Dónde cae su cara en cada diapositiva, para el aro «TÚ» del PDF. */
          puntos = Array.from(raiz.querySelectorAll<HTMLElement>("[data-abp-tablero]")).map((nodo) => {
            const caja = nodo.getBoundingClientRect();
            const cara = nodo.querySelector<HTMLElement>("[data-destacado] img")?.getBoundingClientRect();
            const escala = TABLERO_W / Math.max(1, caja.width);

            return cara
              ? { x: (cara.left + cara.width / 2 - caja.left) * escala, y: (cara.top + cara.height / 2 - caja.top) * escala }
              : null;
          });

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
          puntos,
          rival,
          jornada,
          escudos,
        });

        if (vivo) setHechos((antes) => ({ ...antes, [actual]: pdf }));

        /* Subido ya, para que el toque de WhatsApp abra el chat al instante. */
        subeAdjunto(new File([pdf.blob], pdf.nombre, { type: "application/pdf" }))
          .then((subido) => setHechos((antes) => (antes[actual]?.blob === pdf.blob ? { ...antes, [actual]: { ...antes[actual], url: subido.url } } : antes)))
          .catch((error) => console.warn("[abp-pizarra] subida del PDF", error));
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

  const ocupado = cola !== null;
  const listos = jugadores.filter((fila) => hechos[fila.playerId]);

  const telefonoDe = (playerId: string) => telefonos?.[playerId] ?? "";

  const guardaTelefono = async (playerId: string) => {
    const texto = (borradores[playerId] ?? "").trim();

    if (texto === telefonoDe(playerId)) return;

    if (texto && !esTelefono(texto)) {
      toast.error("Ese número no parece un móvil");

      return;
    }

    const respuesta = await fetch("/api/abp/telefonos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerId, telefono: texto }),
    }).catch(() => null);

    const json = (await respuesta?.json().catch(() => null)) as { ok?: boolean; telefonos?: Record<string, string>; error?: string } | null;

    if (json?.ok && json.telefonos) {
      setTelefonos(json.telefonos);
      setBorradores((antes) => {
        const resto = { ...antes };

        delete resto[playerId];

        return resto;
      });
    } else {
      toast.error(json?.error ?? "No se ha podido guardar el teléfono");
    }
  };

  /*
  | El mensaje (agente experto-marketing): una línea de para qué y los enlaces
  | con su rótulo, el vídeo primero —es lo que se abre en el autobús—.
  */
  const mensaje = (player: Player | undefined, pdf: Hecho, video?: VideoHecho) =>
    [
      `${nombreCorto(player)}, tus ${pdf.acciones} ${pdf.acciones === 1 ? "acción" : "acciones"} a balón parado vs ${rival}. Míralo antes de salir.`,
      video?.url ? `▶ Vídeo: ${video.url}` : "",
      pdf.url ? `📄 Pizarra: ${pdf.url}` : "",
    ]
      .filter(Boolean)
      .join("\n");

  /*
  | Una foto de la diapositiva que se está rodando, con él medido: el centro de
  | su cara en coordenadas del tablero (1920×1080), que es donde va el aro.
  */
  const fotoRodaje = async (playerId: string, indice: number, tiempo: number): Promise<FotoDiapositiva> => {
    setRodaje({ playerId, indice, tiempo });
    await pintado();
    await pintado();

    const raiz = rodajeRef.current;
    const nodo = raiz?.querySelector<HTMLElement>("[data-abp-tablero]");

    if (!raiz || !nodo) throw new Error("No hay diapositiva que grabar");

    const caja = nodo.getBoundingClientRect();
    const cara = raiz.querySelector<HTMLElement>("[data-destacado] img")?.getBoundingClientRect();
    const escala = TABLERO_W / Math.max(1, caja.width);

    const { dataUrl } = await capturaNodo(nodo, {
      backgroundColor: COLORES.tinta,
      imagePlaceholder: PIXEL_VACIO,
      includeQueryParams: true,
      formato: "jpeg",
      quality: 0.88,
      width: TABLERO_W,
      height: TABLERO_H,
      pixelRatio: NITIDEZ_VIDEO,
      style: { margin: "0", transform: "none", transformOrigin: "top left" },
      filter: (n: HTMLElement) => !(n instanceof HTMLElement) || !n.hasAttribute("data-export-hide"),
    });

    return {
      imagen: await cargaFoto(dataUrl),
      punto: cara
        ? { x: (cara.left + cara.width / 2 - caja.left) * escala, y: (cara.top + cara.height / 2 - caja.top) * escala }
        : null,
    };
  };

  /* Monta, guarda y sube el vídeo de un jugador. Devuelve si salió. */
  const hazVideo = async (playerId: string) => {
    const acciones = cometidosDe(tablero, playerId, players);
    const version = huellaRef.current;

    if (acciones.length === 0) return false;

    try {
      setProgresoVideo(`${nombreCorto(players.get(playerId))} 0 %`);
      setRodaje({ playerId, indice: acciones[0].indice, tiempo: 0 });
      await pintado();
      await esperaFuentePortada();

      if (rodajeRef.current) await esperaFotos(rodajeRef.current);

      const { cx, retrato } = await preparaJugador({
        player: players.get(playerId),
        rival,
        jornada,
        escudos: await cargaEscudos(escudoRival),
      });

      const blob = await videoJugador({
        cx,
        retrato,
        acciones,
        fases: acciones.map((accion) => fasesDe(tablero.slides[accion.indice]?.trazos)),
        foto: (orden, tiempo) => fotoRodaje(playerId, acciones[orden].indice, tiempo),
        alProgreso: (fraccion) => setProgresoVideo(`${nombreCorto(players.get(playerId))} ${Math.round(fraccion * 100)} %`),
      });

      const pdf = hechos[playerId];
      const nombre = (pdf?.nombre ?? `ABP-${playerId}.pdf`).replace(/\.pdf$/, ".mp4");

      /* La pizarra cambió mientras se rodaba: este vídeo ya no cuenta lo que hay. */
      if (version !== huellaRef.current) return false;

      setVideos((antes) => ({ ...antes, [playerId]: { nombre, blob } }));
      subeVideo(playerId, blob, nombre);

      return true;
    } catch (error) {
      console.error("[abp-pizarra] vídeo del jugador", error);
      toast.error(`No se ha podido montar el vídeo de ${nombreCorto(players.get(playerId)) || "un jugador"}`);

      return false;
    }
  };

  /* Sube el vídeo y apunta su enlace, sólo si sigue siendo ESE vídeo. */
  const subeVideo = (playerId: string, blob: Blob, nombre: string) => {
    setVideos((antes) => (antes[playerId]?.blob === blob ? { ...antes, [playerId]: { ...antes[playerId], fallo: false } } : antes));

    subeAdjunto(new File([blob], nombre, { type: "video/mp4" }))
      .then((subido) =>
        setVideos((antes) => (antes[playerId]?.blob === blob ? { ...antes, [playerId]: { ...antes[playerId], url: subido.url } } : antes)),
      )
      .catch((error) => {
        console.warn("[abp-pizarra] subida del vídeo", error);
        toast.error(`No se ha podido subir el vídeo de ${nombreCorto(players.get(playerId))}: pulsa «Reintentar»`);
        setVideos((antes) => (antes[playerId]?.blob === blob ? { ...antes, [playerId]: { ...antes[playerId], fallo: true } } : antes));
      });
  };

  /* En serie: dos codificadores a la vez dejan a Chrome sin ninguno. */
  const ruedaVideos = async (ids: string[]) => {
    if (rodando.current || ids.length === 0) return;

    rodando.current = true;

    let bien = 0;

    try {
      for (const id of ids) if (await hazVideo(id)) bien += 1;
    } finally {
      rodando.current = false;
      setRodaje(null);
      setProgresoVideo("");
    }

    if (bien) toast.success(`${bien} ${bien === 1 ? "vídeo listo" : "vídeos listos"}`);
  };

  const grabando = rodaje !== null;

  /* El chat con todo escrito. Se abre en el mismo clic: si no, el navegador lo bloquea. */
  const porWhatsapp = (playerId: string) => {
    const pdf = hechos[playerId];
    const telefono = telefonoDe(playerId);

    if (!pdf?.url || !telefono) return;

    window.open(enlaceWhatsapp(telefono, mensaje(players.get(playerId), pdf, videos[playerId])), "_blank", "noopener");
    setEnviados((antes) => new Set(antes).add(playerId));
  };

  /* Sin móvil o sin enlace: la hoja de compartir del sistema (en el móvil sale WhatsApp con el PDF). */
  const comparte = async (playerId: string) => {
    const pdf = hechos[playerId];

    if (!pdf) return;

    const archivo = new File([pdf.blob], pdf.nombre, { type: "application/pdf" });
    const video = videos[playerId];
    const conVideo = video ? [archivo, new File([video.blob], video.nombre, { type: "video/mp4" })] : [archivo];
    const archivos = navigator.canShare?.({ files: conVideo }) ? conVideo : [archivo];

    if (navigator.canShare?.({ files: archivos })) {
      try {
        await navigator.share({ files: archivos, title: pdf.nombre, text: mensaje(players.get(playerId), { ...pdf, url: "" }) });
        setEnviados((antes) => new Set(antes).add(playerId));
      } catch {
        /* Cancelado en la hoja de compartir: nada que avisar. */
      }

      return;
    }

    descarga(pdf.blob, pdf.nombre);
  };

  const listoParaWhatsapp = (playerId: string) => Boolean(hechos[playerId]?.url && telefonoDe(playerId));

  const siguiente = jugadores.find((fila) => listoParaWhatsapp(fila.playerId) && !enviados.has(fila.playerId));

  const descargaTodos = () => {
    listos.forEach((fila, orden) => {
      const pdf = hechos[fila.playerId];

      window.setTimeout(() => descarga(pdf.blob, pdf.nombre), orden * 350);
    });
  };

  const todosZip = async () => {
    const entradas = await Promise.all(
      listos.map(async (fila) => ({
        nombre: hechos[fila.playerId].nombre,
        datos: new Uint8Array(await hechos[fila.playerId].blob.arrayBuffer()),
      })),
    );

    descarga(creaZip(entradas), `ABP-jugadores-${jornada ?? ""}-${rival}.zip`.replace(/\s+/g, "-").replace(/-+/g, "-"));
  };

  return (
    <>
      <Button
        icon={Smartphone}
        onClick={abre}
        disabled={jugadores.length === 0}
        title="Un PDF vertical por jugador, con su portada y sus cometidos, para mandarlo por WhatsApp"
      >
        PDF por jugador
      </Button>

      {abierto && (
        <Dialog
          title="Pizarra de cada jugador"
          subtitle={
            ocupado
              ? `Preparando ${paso + 1} de ${cola?.length ?? 0}…`
              : `${listos.length} PDF listos contra ${rival}. Un toque por jugador abre su WhatsApp con el enlace.`
          }
          onClose={() => setAbierto(false)}
          footer={
            <div className="flex flex-wrap items-center justify-end gap-2">
              {listos.length > 1 && !ocupado && (
                <>
                  <Button icon={Download} onClick={descargaTodos}>
                    Descargar los {listos.length}
                  </Button>
                  <Button onClick={() => void todosZip()}>.zip</Button>
                </>
              )}

              {sabeVideo && listos.length > 0 && !ocupado && (
                <Button
                  icon={Film}
                  onClick={() => void ruedaVideos(listos.map((fila) => fila.playerId).filter((id) => !videos[id]))}
                  disabled={grabando || listos.every((fila) => videos[fila.playerId])}
                  title="Un vídeo vertical por jugador: su pizarra en movimiento, con un aro que le sigue"
                >
                  {grabando ? `Vídeo · ${progresoVideo}` : "Vídeos de todos"}
                </Button>
              )}

              {siguiente && !ocupado && !grabando && (
                <Button tone="primary" icon={Send} onClick={() => porWhatsapp(siguiente.playerId)}>
                  Enviar a {nombreCorto(siguiente.player)}
                </Button>
              )}
            </div>
          }
        >
          {sinPermiso && (
            <p className="mb-3 text-xs text-amber-300/90">
              Entra con tu cuenta del cuerpo técnico para guardar los móviles y enviar con un toque. Mientras, «Compartir» manda el PDF desde el móvil.
            </p>
          )}

          <ul className="divide-y divide-white/10">
            {jugadores.map((fila) => {
              const pdf = hechos[fila.playerId];
              const enCurso = actual === fila.playerId;
              const telefono = telefonoDe(fila.playerId);
              const borrador = borradores[fila.playerId];
              const enviado = enviados.has(fila.playerId);

              return (
                <li key={fila.playerId} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5">
                  <span className="w-7 text-right font-semibold tabular-nums text-white/50">
                    {fila.player?.dorsal ?? ""}
                  </span>

                  <span className="min-w-[7rem] flex-1">
                    <span className="block truncate font-semibold text-white">
                      {nombreCorto(fila.player) || "Jugador sin ficha"}
                    </span>
                    <span className="block text-xs text-white/50">
                      {fila.slides} {fila.slides === 1 ? "acción" : "acciones"}
                      {enCurso ? " · preparando…" : pdf && !pdf.url && !sinPermiso ? " · subiendo…" : ""}
                    </span>
                  </span>

                  {!sinPermiso && (
                    <input
                      type="tel"
                      inputMode="tel"
                      placeholder="Móvil"
                      aria-label={`Móvil de ${nombreCorto(fila.player)}`}
                      value={borrador ?? (telefono ? telefonoLegible(telefono) : "")}
                      onChange={(event) => setBorradores((antes) => ({ ...antes, [fila.playerId]: event.target.value }))}
                      onBlur={() => borrador !== undefined && void guardaTelefono(fila.playerId)}
                      onKeyDown={(event) => event.key === "Enter" && (event.target as HTMLInputElement).blur()}
                      className="w-40 rounded-md border border-white/15 bg-white/5 px-2 py-1.5 text-sm text-white placeholder:text-white/30"
                    />
                  )}

                  <span className="flex flex-wrap gap-2">
                    {pdf ? (
                      <>
                        {listoParaWhatsapp(fila.playerId) ? (
                          <Button tone={enviado ? "ghost" : "primary"} icon={enviado ? Check : MessageCircle} onClick={() => porWhatsapp(fila.playerId)} title="Abre su chat de WhatsApp con el mensaje y el enlace al PDF">
                            {enviado ? "Enviado" : "WhatsApp"}
                          </Button>
                        ) : (
                          <Button icon={Send} onClick={() => void comparte(fila.playerId)} title="En el móvil, WhatsApp con el PDF adjunto">
                            Compartir
                          </Button>
                        )}
                        {sabeVideo && (
                          videos[fila.playerId]?.fallo ? (
                            <Button icon={Film} onClick={() => subeVideo(fila.playerId, videos[fila.playerId].blob, videos[fila.playerId].nombre)} title="No se subió: el mensaje saldría sin el vídeo">
                              Reintentar
                            </Button>
                          ) : videos[fila.playerId] ? (
                            <Button icon={Film} onClick={() => descarga(videos[fila.playerId].blob, videos[fila.playerId].nombre)} title="Descargar su vídeo">
                              {videos[fila.playerId].url ? "Vídeo ✓" : "Vídeo…"}
                            </Button>
                          ) : (
                            <Button icon={Film} onClick={() => void ruedaVideos([fila.playerId])} disabled={grabando} title="Su pizarra en movimiento, en vídeo vertical">
                              {rodaje?.playerId === fila.playerId ? progresoVideo.replace(/^.* /, "") : "Vídeo"}
                            </Button>
                          )
                        )}
                        <Button icon={Download} onClick={() => descarga(pdf.blob, pdf.nombre)} aria-label={`Descargar el PDF de ${nombreCorto(fila.player)}`} />
                      </>
                    ) : (
                      !ocupado && (
                        <Button onClick={() => prepara([fila.playerId])}>Preparar</Button>
                      )
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </Dialog>
      )}

      {/* El tablero que se está rodando para un vídeo, con su reloj. */}
      {rodaje && tablero.slides[rodaje.indice] && (
        <div
          ref={rodajeRef}
          aria-hidden
          data-export-hide
          className="pointer-events-none"
          style={{ position: "fixed", top: 0, left: -(TABLERO_W * 2 + 400), width: TABLERO_W, zIndex: -1 }}
        >
          <TableroSlide
            slide={tablero.slides[rodaje.indice]}
            titulo={tituloVisible(tablero.slides, rodaje.indice)}
            tiempo={rodaje.tiempo}
            soloVer
            destacado={rodaje.playerId}
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
