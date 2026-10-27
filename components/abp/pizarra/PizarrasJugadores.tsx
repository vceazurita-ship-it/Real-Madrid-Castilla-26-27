"use client";

/**
 * Un PDF de balón parado por jugador, para mandarlo por WhatsApp antes del
 * partido (26/10/2026). El dibujo vive en `lib/abp/pizarra-jugador.ts`.
 *
 * Al abrir la ventana se preparan TODOS de golpe, en segundo plano (27/10/2026):
 * el trabajo lo hace `TrabajoPdfs` desde el layout, así que se puede cerrar la
 * ventana y seguir por la app; al terminar avisa (y con notificación del
 * sistema si la pestaña no está a la vista). Cada PDF se sube al almacén
 * (como los informes: enlace que dura 30 días).
 *
 * El envío rápido es `wa.me/<su móvil>?text=<mensaje con el enlace>`: un toque
 * abre su chat con todo escrito y otro en «Enviar». Los móviles se guardan una
 * vez (`/api/abp/telefonos`, sólo con sesión del cuerpo técnico). «Enviar al
 * siguiente» recorre la lista sin buscar a nadie. El enlace se abre en el
 * mismo clic —si se subiera en ese momento, el navegador bloquearía la
 * ventana—, por eso la subida va antes.
 */

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Check, Download, Film, MessageCircle, Send, Smartphone } from "lucide-react";
import { toast } from "sonner";

import type { Player } from "@/types/player";
import { Button, Dialog } from "@/components/abp/ui";
import { jugadoresDelTablero, type TableroPizarra } from "@/lib/abp/pizarra";
import { nombreCorto } from "@/lib/abp/pizarra-jugador";
import { enlaceWhatsapp, esTelefono, telefonoLegible } from "@/lib/correo/whatsapp";
import { descarga } from "@/lib/export/lienzos";
import { trabajoPdfs, type HechoPdf, type HechoVideo } from "@/lib/abp/trabajo-pdfs";
import { descargaVideos, guardaVideo } from "@/lib/abp/descarga-videos";
import { creaZip } from "@/lib/export/zip";
import { puedeHacerVideo } from "@/lib/tactics/lamina";

type Hecho = HechoPdf;

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
  const [enviados, setEnviados] = useState<Set<string>>(new Set());

  /* Los móviles: `null` mientras no se han leído; sin sesión, `sinPermiso`. */
  const [telefonos, setTelefonos] = useState<Record<string, string> | null>(null);
  const [sinPermiso, setSinPermiso] = useState(false);
  const [borradores, setBorradores] = useState<Record<string, string>>({});


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

  /* Lo que cambia al mover la pizarra deja viejos los PDF ya hechos. */
  const huella = `${tablero.partidoId}|${tablero.actualizado ?? ""}|${rival}`;

  /* Los PDF viven en el trabajo de segundo plano: sólo valen los de ESTA pizarra. */
  const trabajo = useSyncExternalStore(trabajoPdfs.suscribe, trabajoPdfs.foto, trabajoPdfs.foto);
  const hechos: Record<string, Hecho> = trabajo.huella === huella ? trabajo.hechos : {};
  const videos: Record<string, HechoVideo> = trabajo.huella === huella ? trabajo.videos : {};
  const enMarchaVideos = trabajo.encargoVideos !== null && trabajo.huella === huella;
  const videoActual = enMarchaVideos ? trabajo.enCursoVideo : null;
  const enMarcha = trabajo.encargo !== null && trabajo.huella === huella;
  const actual = enMarcha ? trabajo.enCurso : null;
  const [huellaHechos, setHuellaHechos] = useState(huella);

  if (huellaHechos !== huella) {
    setHuellaHechos(huella);
    setEnviados(new Set());
  }

  const prepara = (ids: string[], que: "pdf" | "video" = "pdf") => {
    if (ids.length === 0) return;

    /* El aviso del sistema, si se deja: se pide aquí, con el clic. */
    if (typeof Notification !== "undefined" && Notification.permission === "default") void Notification.requestPermission().catch(() => undefined);

    const pedido = {
      huella,
      tablero,
      players,
      temporada,
      rival,
      jornada,
      escudoRival,
      ids,
      vuelta: `${window.location.pathname}${window.location.search.replace(/[?&]pdfs=1/, "")}`,
    };

    const aceptado = que === "pdf" ? trabajoPdfs.encarga(pedido) : trabajoPdfs.encargaVideos(pedido);

    if (!aceptado && (que === "pdf" ? trabajo.encargo && !enMarcha : trabajo.encargoVideos)) {
      toast.info(que === "pdf" ? "Ya se están preparando los PDF de otra pizarra: en cuanto acaben, vuelve a pedirlos." : "Ya se están montando otros vídeos: en cuanto acaben, vuelve a pedirlos.");
    }
  };

  /* Sólo la ventana, con los móviles: sin pedir nada. */
  const abreVentana = () => {
    setAbierto(true);

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

  const abre = () => {
    abreVentana();

    /* De golpe: lo que falte se prepara solo al abrir. */
    prepara(jugadores.map((fila) => fila.playerId).filter((id) => !hechos[id]));
  };

  /* El aviso de «listos» abre esta ventana: en esta pantalla, o al llegar con `?pdfs=1`. */
  const abrirVisto = useRef(trabajo.abrir);

  useEffect(() => {
    if (trabajo.abrir === abrirVisto.current) return;

    abrirVisto.current = trabajo.abrir;
    abreVentana();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trabajo.abrir]);

  useEffect(() => {
    const url = new URL(window.location.href);

    if (url.searchParams.get("pdfs") !== "1") return;

    const id = window.setTimeout(() => {
      url.searchParams.delete("pdfs");
      window.history.replaceState(window.history.state, "", url.pathname + url.search);
      abreVentana();
    }, 0);

    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ocupado = enMarcha;
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
  const mensaje = (player: Player | undefined, pdf: Hecho, video?: HechoVideo) =>
    [
      `${nombreCorto(player)}, tus ${pdf.acciones} ${pdf.acciones === 1 ? "acción" : "acciones"} a balón parado vs ${rival}. Míralo antes de salir.`,
      video?.url ? `▶ Vídeo: ${video.url}` : "",
      pdf.url ? `📄 Pizarra: ${pdf.url}` : "",
    ]
      .filter(Boolean)
      .join("\n");

  const videosListos = jugadores.flatMap((fila) => (videos[fila.playerId] ? [videos[fila.playerId]] : []));
  const faltanVideos = listos.map((fila) => fila.playerId).filter((id) => !videos[id]);

  const reintentaSubida = async (playerId: string) => {
    const { subeVideo } = await import("@/components/abp/pizarra/MesaVideos");

    subeVideo(playerId, videos[playerId].blob, videos[playerId].nombre);
  };

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
              ? `Preparando ${Math.min(trabajo.hecho + 1, trabajo.total)} de ${trabajo.total}… Puedes cerrar y seguir por la app: te aviso al terminar.`
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

              {sabeVideo && faltanVideos.length > 0 && (
                <Button
                  icon={Film}
                  onClick={() => prepara(faltanVideos, "video")}
                  disabled={enMarchaVideos}
                  title="Un vídeo vertical por jugador: cada acción pintada como en el laboratorio, con él resaltado. Se monta en segundo plano"
                >
                  {enMarchaVideos ? `Vídeo ${Math.min(trabajo.hechoVideos + 1, trabajo.totalVideos)}/${trabajo.totalVideos} · ${Math.round(trabajo.avanceVideo * 100)} %` : "Vídeos de todos"}
                </Button>
              )}

              {videosListos.length > 1 && (
                <Button
                  icon={Download}
                  onClick={() => void descargaVideos(videosListos, `ABP-videos-${jornada ?? ""}-${rival}.zip`)}
                  title="Todos los vídeos hechos, en un .zip de una vez"
                >
                  Vídeos (.zip)
                </Button>
              )}

              {siguiente && !ocupado && (
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
                            <Button icon={Film} onClick={() => void reintentaSubida(fila.playerId)} title="No se subió: el mensaje saldría sin el vídeo">
                              Reintentar
                            </Button>
                          ) : videos[fila.playerId] ? (
                            <Button icon={Film} onClick={() => void guardaVideo(videos[fila.playerId])} title="Guardar su vídeo (en el móvil, «Guardar vídeo» lo deja en la galería)">
                              {videos[fila.playerId].url ? "Vídeo ✓" : "Vídeo…"}
                            </Button>
                          ) : (
                            <Button icon={Film} onClick={() => prepara([fila.playerId], "video")} disabled={enMarchaVideos} title="Sus acciones como en el laboratorio, con él resaltado, en vídeo vertical">
                              {videoActual === fila.playerId ? `${Math.round(trabajo.avanceVideo * 100)} %` : enMarchaVideos && trabajo.encargoVideos?.ids.includes(fila.playerId) ? "En cola" : "Vídeo"}
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


    </>
  );
}
