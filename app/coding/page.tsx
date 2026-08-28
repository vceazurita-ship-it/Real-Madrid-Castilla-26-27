"use client";

/**
 * CODING DE PARTIDO.
 *
 * Ver el partido entero marcando cada acción de cada jugador, sin soltar el
 * teclado. El flujo que manda sobre todo lo demás es éste:
 *
 *     tecla del jugador  →  I  →  (la acción)  →  O  →  clip creado
 *
 * y el vídeo **no se para en ningún momento**. Nada de lo que hay en esta
 * pantalla puede interrumpir ese ciclo: por eso no hay formularios después de
 * crear un clip, el jugador elegido se queda elegido para el siguiente, y todo
 * lo que se guarda se guarda solo.
 *
 * La pantalla sirve para dos trabajos con la misma maquinaria:
 *
 * - **Nuestro partido** (`?ambito=partido`), con la plantilla del Castilla.
 * - **Un rival** (`?ambito=rival&equipo=…`), con la plantilla de scouting, para
 *   preparar el análisis individual de sus jugadores.
 *
 * Lo que cambia entre los dos es de dónde sale la lista de jugadores y qué
 * lleva la carátula de los vídeos; el coding es el mismo.
 */

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  BookOpen,
  Film,
  Keyboard,
  ListVideo,
  Pause,
  Play,
  Settings2,
  SkipBack,
  SkipForward,
  Undo2,
  Video,
} from "lucide-react";
import { toast } from "sonner";

import {
  AbpHeader,
  Button,
  Notice,
  Panel,
  SaveState,
} from "@/components/abp/ui";
import { ConfiguraCoding } from "@/components/coding/ConfiguraCoding";
import {
  BarraExportacion,
  useExportador,
  type ModoCorteUI,
} from "@/components/coding/ExportaClips";
import { FichaClip, ListaClips } from "@/components/coding/ListaClips";
import { LineaDeTiempo } from "@/components/coding/LineaDeTiempo";
import {
  AyudaTeclado,
  PanelCategorias,
  PanelJugadores,
  TablaResumen,
  Tecla,
} from "@/components/coding/piezas";
import { SelectorFuente } from "@/components/coding/SelectorFuente";
import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { usePlayers } from "@/hooks/usePlayers";
import { useEscudos } from "@/hooks/useEscudos";
import { useRemoteDoc } from "@/hooks/useRemoteDoc";
import { useReproductor, VELOCIDADES } from "@/hooks/useReproductor";
import { useSesionCoding } from "@/hooks/useSesionCoding";
import { caratulaDeJugador } from "@/lib/coding/portada";
import {
  CLAVE_CONFIG_CODING,
  CONFIG_POR_DEFECTO,
  TIPO_CODING,
  apodoCoding,
  duracionClip,
  formateaMs,
  formateaTotal,
  normalizaConfig,
  porCategoria,
  porJugador,
  reparteTeclas,
  totalCodificadoMs,
  type AmbitoCoding,
  type ClipCoding,
  type ConfigCoding,
  type FuenteVideo,
  type JugadorCoding,
} from "@/lib/coding/modelo";
import { fetchMatches, matchLabel } from "@/lib/ratings/matches";
import type { MatchMeta } from "@/lib/ratings/types";

const TEMPORADA = "26 / 27";

/* ================================================================== */
/*  PLANTILLAS RIVALES                                                 */
/* ================================================================== */

type PlantillaRival = {
  equipo: string;
  jugadores: JugadorCoding[];
};

/**
 * Las plantillas del scouting, con foto.
 *
 * `buildRivalSquads` ya agrupa por equipo para la pizarra, pero se queda con
 * dorsal, nombre y posición: aquí hace falta además el recorte de la cara, que
 * es lo que lleva la carátula del vídeo del jugador.
 */
function leePlantillasRivales(filas: unknown): PlantillaRival[] {
  if (!Array.isArray(filas)) return [];

  const equipos = new Map<string, JugadorCoding[]>();

  for (const cruda of filas) {
    if (!cruda || typeof cruda !== "object") continue;

    const fila = cruda as Record<string, unknown>;

    const equipo = String(fila.NOMBRE_EQUIPO ?? "").trim();

    if (!equipo) continue;

    const nombre =
      String(fila["NOMBRE DEPORTIVO"] ?? "").trim() ||
      String(fila.JUGADOR ?? "").trim();

    if (!nombre) continue;

    const dorsal = Number.parseInt(String(fila.DORSAL ?? ""), 10);

    const jugador: JugadorCoding = {
      id: String(fila.ID_JUGADOR ?? "").trim() || `${equipo}-${nombre}`,
      nombre,
      dorsal: Number.isFinite(dorsal) ? dorsal : undefined,
      foto: String(fila.FOTO ?? "").trim() || undefined,
      posicion:
        String(fila["POSICIÓN"] ?? "").trim() ||
        String(fila["2º POSICIÓN"] ?? "").trim() ||
        undefined,
    };

    const actual = equipos.get(equipo);

    if (actual) actual.push(jugador);
    else equipos.set(equipo, [jugador]);
  }

  return [...equipos.entries()]
    .map(([equipo, jugadores]) => ({
      equipo,
      jugadores: jugadores.sort(
        (a, b) => (a.dorsal ?? 99) - (b.dorsal ?? 99),
      ),
    }))
    .sort((a, b) => a.equipo.localeCompare(b.equipo, "es"));
}

/* ================================================================== */
/*  LA PÁGINA                                                          */
/* ================================================================== */

export default function CodingPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#0B0F14] p-10 text-white/40">
          Abriendo el coding…
        </main>
      }
    >
      <Coding />
    </Suspense>
  );
}

function Coding() {
  const router = useRouter();
  const params = useSearchParams();

  const ambito: AmbitoCoding =
    params.get("ambito") === "rival" ? "rival" : "partido";

  /* ------------------------------------------------- configuración */

  const configDoc = useRemoteDoc<ConfigCoding>({
    key: CLAVE_CONFIG_CODING,
    kind: TIPO_CODING,
    fallback: CONFIG_POR_DEFECTO,
  });

  const config = useMemo(
    () => normalizaConfig(configDoc.value),
    [configDoc.value],
  );

  /* ------------------------------------------------------ qué se ve */

  const { players } = usePlayers();
  const escudoDe = useEscudos();

  const [partidos, setPartidos] = useState<MatchMeta[]>([]);
  const [plantillas, setPlantillas] = useState<PlantillaRival[]>([]);

  useEffect(() => {
    let vivo = true;

    void fetchMatches()
      .then((lista) => {
        if (vivo) setPartidos(lista);
      })
      .catch(() => undefined);

    void fetch("/api/rivals?action=rivalesPlantillas", { cache: "no-store" })
      .then((respuesta) => respuesta.json())
      .then((datos) => {
        if (vivo) setPlantillas(leePlantillasRivales(datos));
      })
      .catch(() => undefined);

    return () => {
      vivo = false;
    };
  }, []);

  const partidoId = params.get("partido") ?? "";
  const equipoRival = params.get("equipo") ?? "";

  const partido = useMemo(
    () => partidos.find((uno) => uno.id === partidoId) ?? partidos[0] ?? null,
    [partidoId, partidos],
  );

  const plantilla = useMemo(
    () =>
      plantillas.find((una) => una.equipo === equipoRival) ??
      plantillas[0] ??
      null,
    [equipoRival, plantillas],
  );

  const refId =
    ambito === "partido"
      ? (partido?.id ?? "sin-partido")
      : apodoCoding(plantilla?.equipo ?? "sin-rival");

  const titulo =
    ambito === "partido"
      ? partido
        ? matchLabel(partido)
        : "Partido sin elegir"
      : (plantilla?.equipo ?? "Rival sin elegir");

  /** La lista de jugadores del panel de teclas. */
  const jugadores: JugadorCoding[] = useMemo(() => {
    if (ambito === "rival") return plantilla?.jugadores ?? [];

    return players.map((jugador) => ({
      id: jugador.id,
      nombre: jugador.apodo || jugador.nombre,
      dorsal: jugador.dorsal,
      foto: jugador.foto,
      posicion: jugador.posicion,
    }));
  }, [ambito, plantilla, players]);

  /* --------------------------------------------------- la sesión */

  const sesion = useSesionCoding({ ambito, refId, titulo, config });

  const { ponFuente } = sesion;

  /* Las teclas de quien todavía no tenga: se reparten con la lista delante. */
  const teclas = useMemo(
    () => reparteTeclas(jugadores, config.teclasJugador),
    [config.teclasJugador, jugadores],
  );

  /* ------------------------------------------------- el reproductor */

  const videoRef = useRef<HTMLVideoElement>(null);

  /*
  | El vídeo elegido en esta pestaña.
  |
  | Manda sobre lo que diga la sesión guardada por dos motivos: un fichero
  | abierto del ordenador sólo existe aquí —un navegador no puede guardar el
  | permiso sobre un fichero del disco—, y el documento remoto llega **después**
  | de montar la pantalla, así que sin esto un elegir-vídeo rápido se perdía en
  | cuanto contestaba el servidor.
  */
  const [srcElegido, setSrcElegido] = useState("");

  const [cambiandoVideo, setCambiandoVideo] = useState(false);

  const reproductor = useReproductor(videoRef, sesion.sesion.fps);

  const { estado, salta, tiempoAhoraMs } = reproductor;

  /*
  | De dónde reproduce el vídeo. Se **deriva** de la fuente guardada en la
  | sesión en vez de copiarse a un estado propio: así, al volver a abrir el
  | partido, el vídeo ya está puesto sin que nadie tenga que sincronizar nada.
  */
  const src = useMemo(() => {
    if (srcElegido) return srcElegido;

    const fuente = sesion.sesion.fuente;

    if (!fuente) return "";

    if (fuente.tipo === "archivo") {
      return `/api/coding/video?ruta=${encodeURIComponent(fuente.ruta)}`;
    }

    if (fuente.tipo === "url") return fuente.url;

    /* Era un fichero del ordenador: hay que volver a elegirlo. */
    return "";
  }, [sesion.sesion.fuente, srcElegido]);

  const eligeFuente = useCallback(
    (fuente: FuenteVideo, nuevo: string) => {
      setSrcElegido(nuevo);
      setCambiandoVideo(false);
      ponFuente(fuente);
    },
    [ponFuente],
  );

  /* ------------------------------------------------ estado de coding */

  const [jugadorActivo, setJugadorActivo] = useState<string | null>(null);
  const [categoriaActiva, setCategoriaActiva] = useState("");
  const [inicioMs, setInicioMs] = useState<number | null>(null);
  const [seleccionado, setSeleccionado] = useState<string | null>(null);

  const [ayuda, setAyuda] = useState(true);
  const [ajustes, setAjustes] = useState(false);
  const [editando, setEditando] = useState<ClipCoding | null>(null);
  const [avisoSesion, setAvisoSesion] = useState(true);

  /* Filtros de la lista y de la exportación. */
  const [filtroJugador, setFiltroJugador] = useState<string | null>(null);
  const [filtroCategoria, setFiltroCategoria] = useState<string | null>(null);

  const [modoCorte, setModoCorte] = useState<ModoCorteUI>("preciso");

  const clips = sesion.sesion.clips;

  const clipsFiltrados = useMemo(
    () =>
      clips.filter(
        (clip) =>
          (!filtroJugador || clip.jugadorId === filtroJugador) &&
          (!filtroCategoria || clip.categoriaId === filtroCategoria),
      ),
    [clips, filtroCategoria, filtroJugador],
  );

  const cuentasJugador = useMemo(() => {
    const cuenta: Record<string, number> = {};

    for (const clip of clips) {
      cuenta[clip.jugadorId] = (cuenta[clip.jugadorId] ?? 0) + 1;
    }

    return cuenta;
  }, [clips]);

  const cuentasCategoria = useMemo(() => {
    const cuenta: Record<string, number> = {};

    for (const clip of clips) {
      cuenta[clip.categoriaId] = (cuenta[clip.categoriaId] ?? 0) + 1;
    }

    return cuenta;
  }, [clips]);

  /* ------------------------------------------------------ acciones */

  const jugadorDe = useCallback(
    (id: string | null) => jugadores.find((uno) => uno.id === id) ?? null,
    [jugadores],
  );

  const marcaInicio = useCallback(() => {
    if (!jugadorActivo) {
      toast.error("Elige antes un jugador con su tecla.");
      return;
    }

    setInicioMs(tiempoAhoraMs());
  }, [jugadorActivo, tiempoAhoraMs]);

  const marcaFinal = useCallback(() => {
    if (inicioMs === null) {
      toast.error("Marca antes el inicio con la tecla I.");
      return;
    }

    const jugador = jugadorDe(jugadorActivo);

    if (!jugador) {
      toast.error("Elige antes un jugador con su tecla.");
      return;
    }

    const problema = sesion.añadeClip({
      jugadorId: jugador.id,
      jugadorNombre: jugador.nombre,
      jugadorDorsal: jugador.dorsal,
      categoriaId: categoriaActiva,
      codingInicioMs: inicioMs,
      codingFinMs: tiempoAhoraMs(),
      preRollMs: sesion.sesion.preRollMs,
      postRollMs: sesion.sesion.postRollMs,
      duracionVideoMs: estado.duracionMs || undefined,
    });

    if (problema) {
      toast.error(problema);
      return;
    }

    setInicioMs(null);
  }, [
    categoriaActiva,
    estado.duracionMs,
    inicioMs,
    jugadorActivo,
    jugadorDe,
    sesion,
    tiempoAhoraMs,
  ]);

  const reproduceClip = useCallback(
    (clip: ClipCoding) => {
      setSeleccionado(clip.id);
      salta(clip.inicioMs);
      reproductor.play();
    },
    [reproductor, salta],
  );

  /* ------------------------------------------------------ playlist */

  const [cola, setCola] = useState<ClipCoding[] | null>(null);
  const [enCola, setEnCola] = useState(0);
  const [bucle, setBucle] = useState(false);

  const clipEnCola = cola?.[enCola] ?? null;

  /*
  | Salta al siguiente cuando el actual llega a su final.
  |
  | Se vigila con el bucle de animación y no con el tiempo que ya tiene React:
  | el estado se refresca cuando el navegador quiere, y el salto tiene que
  | ocurrir en el fotograma en el que el clip termina o se cuela un trozo del
  | partido entre dos acciones.
  */
  useEffect(() => {
    const video = videoRef.current;

    if (!cola || !video) return;

    let mano = 0;

    const vigila = () => {
      const clip = cola[enCola];

      if (clip && video.currentTime * 1000 >= clip.finMs) {
        const siguiente = enCola + 1;

        if (siguiente < cola.length) {
          setEnCola(siguiente);
          salta(cola[siguiente].inicioMs);
        } else if (bucle) {
          setEnCola(0);
          salta(cola[0].inicioMs);
        } else {
          setCola(null);
          video.pause();
        }

        return;
      }

      mano = requestAnimationFrame(vigila);
    };

    mano = requestAnimationFrame(vigila);

    return () => cancelAnimationFrame(mano);
  }, [bucle, cola, enCola, salta]);

  const lanzaCola = useCallback(
    (lista: ClipCoding[]) => {
      if (lista.length === 0) return;

      setCola(lista);
      setEnCola(0);
      setSeleccionado(lista[0].id);
      salta(lista[0].inicioMs);
      reproductor.play();
    },
    [reproductor, salta],
  );

  const mueveCola = useCallback(
    (delta: number) => {
      if (!cola) return;

      const destino = Math.min(
        cola.length - 1,
        Math.max(0, enCola + delta),
      );

      setEnCola(destino);
      setSeleccionado(cola[destino].id);
      salta(cola[destino].inicioMs);
      reproductor.play();
    },
    [cola, enCola, reproductor, salta],
  );

  /* ------------------------------------------------- exportación */

  const exportador = useExportador({
    fuente: sesion.sesion.fuente,
    categorias: config.categorias,
    carpeta: apodoCoding(titulo),
    modo: modoCorte,
  });

  const { exporta } = exportador;

  const etiquetaFiltro = filtroJugador
    ? (jugadorDe(filtroJugador)?.nombre ?? "jugador")
    : filtroCategoria
      ? (config.categorias.find((una) => una.id === filtroCategoria)?.nombre ??
        "categoría")
      : "todo el partido";

  const exportaUnificado = useCallback(async () => {
    const jugador = filtroJugador ? jugadorDe(filtroJugador) : null;

    const aviso = jugador
      ? null
      : toast.loading("Montando el vídeo del partido…");

    const portada = jugador
      ? await caratulaDeJugador({
          equipo: ambito === "rival" ? titulo : "RMCF Castilla",
          escudo:
            ambito === "rival"
              ? escudoDe(plantilla?.equipo ?? "")
              : "/logo.png",
          temporada: TEMPORADA,
          nombre: jugador.nombre,
          posicion: jugador.posicion ?? "",
          dorsal: jugador.dorsal !== undefined ? String(jugador.dorsal) : "",
          foto: jugador.foto,
          contexto: titulo,
        })
      : null;

    if (aviso) toast.dismiss(aviso);

    await exporta({
      clips: clipsFiltrados,
      formato: "unificado",
      nombre: `${apodoCoding(titulo)}-${apodoCoding(etiquetaFiltro)}`,
      portada,
    });
  }, [
    ambito,
    clipsFiltrados,
    escudoDe,
    etiquetaFiltro,
    exporta,
    filtroJugador,
    jugadorDe,
    plantilla,
    titulo,
  ]);

  /* -------------------------------------------------- el teclado */

  const hayModal = ajustes || editando !== null;

  useEffect(() => {
    if (hayModal) return;

    const escucha = (evento: KeyboardEvent) => {
      const destino = evento.target as HTMLElement | null;

      /* Escribiendo en un campo, el teclado es del campo. */
      if (
        destino &&
        (destino.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(destino.tagName))
      ) {
        return;
      }

      if (evento.metaKey || evento.ctrlKey || evento.altKey) return;

      const tecla = evento.key.toLowerCase();

      /* --------------------------------------------- reproductor */

      if (evento.key === " ") {
        evento.preventDefault();
        reproductor.alterna();
        return;
      }

      if (tecla === "k") {
        evento.preventDefault();
        reproductor.pausa();
        return;
      }

      if (tecla === "j") {
        evento.preventDefault();
        reproductor.cambiaVelocidad(-1);
        return;
      }

      if (tecla === "l") {
        evento.preventDefault();
        reproductor.cambiaVelocidad(1);
        return;
      }

      if (evento.key === "ArrowLeft" || evento.key === "ArrowRight") {
        evento.preventDefault();

        const signo = evento.key === "ArrowLeft" ? -1 : 1;

        if (evento.shiftKey) reproductor.fotograma(signo * 10);
        else reproductor.fotograma(signo);

        return;
      }

      /* ------------------------------------------------- coding */

      if (tecla === "i") {
        evento.preventDefault();
        marcaInicio();
        return;
      }

      if (tecla === "o") {
        evento.preventDefault();
        marcaFinal();
        return;
      }

      if (evento.key === "Backspace") {
        evento.preventDefault();

        if (sesion.deshacer()) toast.success("Deshecho");
        else toast.info("No hay nada que deshacer");

        return;
      }

      if (evento.key === "Escape") {
        evento.preventDefault();

        if (inicioMs !== null) {
          setInicioMs(null);
          toast.info("Marca cancelada");
          return;
        }

        setJugadorActivo(null);
        setCategoriaActiva("");
        return;
      }

      if (evento.key === "?") {
        evento.preventDefault();
        setAyuda((abierta) => !abierta);
        return;
      }

      /* ----------------------------------- jugadores y categorías */

      const jugador = jugadores.find((uno) => teclas[uno.id] === tecla);

      if (jugador) {
        evento.preventDefault();
        setJugadorActivo(jugador.id);
        return;
      }

      const categoria = config.categorias.find((una) => una.tecla === tecla);

      if (categoria) {
        evento.preventDefault();

        setCategoriaActiva((actual) =>
          actual === categoria.id ? "" : categoria.id,
        );
      }
    };

    window.addEventListener("keydown", escucha);

    return () => window.removeEventListener("keydown", escucha);
  }, [
    config.categorias,
    hayModal,
    inicioMs,
    jugadores,
    marcaFinal,
    marcaInicio,
    reproductor,
    sesion,
    teclas,
  ]);

  /* ---------------------------------------------------------- vista */

  const jugadorElegido = jugadorDe(jugadorActivo);

  const categoriaElegida = config.categorias.find(
    (una) => una.id === categoriaActiva,
  );

  const cambiaUrl = (clave: string, valor: string) => {
    const siguientes = new URLSearchParams(params.toString());

    siguientes.set("ambito", ambito);
    siguientes.set(clave, valor);

    router.replace(`/coding?${siguientes.toString()}`);
  };

  return (
    <main className="min-h-screen bg-[#0B0F14] text-white">
      <div className="flex">
        <Sidebar />

        <section className="flex min-w-0 flex-1 flex-col">
          <Topbar />

          <div className="min-w-0 px-4 py-6 sm:px-6 lg:px-8">
            <AbpHeader
              area={
                ambito === "rival"
                  ? "RMCF Castilla · Rival"
                  : "RMCF Castilla · Competición"
              }
              title={
                ambito === "rival" ? "Coding de rival" : "Coding de partido"
              }
              lead="Marca el inicio y el final de cada acción sin soltar el teclado. Los clips se guardan solos y se convierten en vídeo de verdad desde aquí."
              aside={
                <div className="flex items-center gap-2">
                  <SaveState
                    status={sesion.status}
                    localOnly={sesion.localOnly}
                    savedAt={sesion.lastSavedAt}
                  />

                  <Button icon={Settings2} onClick={() => setAjustes(true)}>
                    Configuración
                  </Button>
                </div>
              }
            />

            {/* ===================== QUÉ SE CODIFICA ==================== */}

            <div className="mt-5 grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
              {ambito === "partido" ? (
                <label className="block min-w-0">
                  <span className="mb-1.5 block text-[10px] uppercase tracking-[0.16em] text-white/40">
                    Partido
                  </span>

                  <select
                    value={partido?.id ?? ""}
                    onChange={(evento) => cambiaUrl("partido", evento.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none transition focus:border-[#C8A96B]/50"
                  >
                    {partidos.length === 0 && (
                      <option value="">Cargando calendario…</option>
                    )}

                    {partidos.map((uno) => (
                      <option key={uno.id} value={uno.id} className="bg-[#11161C]">
                        {matchLabel(uno)}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <label className="block min-w-0">
                  <span className="mb-1.5 block text-[10px] uppercase tracking-[0.16em] text-white/40">
                    Rival
                  </span>

                  <select
                    value={plantilla?.equipo ?? ""}
                    onChange={(evento) => cambiaUrl("equipo", evento.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none transition focus:border-[#C8A96B]/50"
                  >
                    {plantillas.length === 0 && (
                      <option value="">Cargando plantillas…</option>
                    )}

                    {plantillas.map((una) => (
                      <option
                        key={una.equipo}
                        value={una.equipo}
                        className="bg-[#11161C]"
                      >
                        {una.equipo}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <div className="flex items-end gap-2">
                <span className="rounded-xl border border-white/10 px-3 py-2 text-[11px] text-white/40">
                  {clips.length} clips · {formateaTotal(totalCodificadoMs(clips))}
                </span>
              </div>
            </div>

            {/* Sesión que quedó a medias (FASE 19). */}
            {avisoSesion && sesion.sesion.abierta && clips.length > 0 && (
              <div className="mt-4">
                <Notice tone="warn" title="Esta sesión de coding quedó abierta">
                  <p>
                    Hay {clips.length} clips guardados de la última vez. Puedes
                    seguir donde lo dejaste; si ya terminaste, ciérrala para que
                    deje de avisar. <b>Cerrarla no borra ningún clip.</b>
                  </p>

                  <div className="mt-2 flex gap-2">
                    <Button
                      tone="primary"
                      onClick={() => setAvisoSesion(false)}
                    >
                      Continuar
                    </Button>

                    <Button
                      onClick={() => {
                        sesion.cierra();
                        setAvisoSesion(false);
                      }}
                    >
                      Marcarla como terminada
                    </Button>
                  </div>
                </Notice>
              </div>
            )}

            {/* ========================= EL TABLERO ===================== */}

            <div className="mt-5 grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
              {/* ------------------------- IZQUIERDA ------------------- */}

              <div className="min-w-0 space-y-4">
                <div className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-black">
                  {src ? (
                    <video
                      ref={videoRef}
                      src={src}
                      className="aspect-video w-full bg-black"
                      preload="metadata"
                      playsInline
                    />
                  ) : (
                    <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 text-white/25">
                      <Video size={26} />
                      <p className="text-xs">Elige el vídeo del partido</p>
                    </div>
                  )}
                </div>

                {/* Mandos y estado del coding. */}
                <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      icon={estado.reproduciendo ? Pause : Play}
                      onClick={reproductor.alterna}
                    >
                      {estado.reproduciendo ? "Pausa" : "Play"}
                    </Button>

                    <Button
                      icon={SkipBack}
                      onClick={() => reproductor.fotograma(-1)}
                      title="Un fotograma atrás"
                    >
                      Fot.
                    </Button>

                    <Button
                      icon={SkipForward}
                      onClick={() => reproductor.fotograma(1)}
                      title="Un fotograma adelante"
                    >
                      Fot.
                    </Button>

                    <span className="mx-1 font-mono text-sm tabular-nums text-white">
                      {formateaMs(estado.tiempoMs)}
                    </span>

                    <span className="rounded-full border border-[#C8A96B]/40 bg-[#C8A96B]/10 px-2 py-0.5 text-[11px] tabular-nums text-[#C8A96B]">
                      {estado.velocidad}x
                    </span>

                    <span className="ml-auto flex flex-wrap gap-1">
                      {VELOCIDADES.map((velocidad) => (
                        <button
                          key={velocidad}
                          type="button"
                          onClick={() => reproductor.ponVelocidad(velocidad)}
                          className={`rounded-md border px-1.5 py-0.5 text-[10px] tabular-nums transition ${
                            estado.velocidad === velocidad
                              ? "border-[#C8A96B] bg-[#C8A96B]/10 text-[#C8A96B]"
                              : "border-white/10 text-white/40 hover:text-white"
                          }`}
                        >
                          {velocidad}x
                        </button>
                      ))}
                    </span>
                  </div>

                  {/* La marca en curso. */}
                  <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2">
                    <Tecla tono="oro">I</Tecla>

                    <span className="font-mono text-[13px] tabular-nums text-white/70">
                      {inicioMs === null ? "—" : formateaMs(inicioMs)}
                    </span>

                    <span className="text-white/20">→</span>

                    <Tecla tono="oro">O</Tecla>

                    <span className="font-mono text-[13px] tabular-nums text-white/40">
                      {inicioMs === null
                        ? "—"
                        : formateaMs(Math.max(inicioMs, estado.tiempoMs))}
                    </span>

                    <span className="mx-2 h-4 w-px bg-white/10" />

                    <span className="text-[12px] text-white/50">
                      {jugadorElegido ? (
                        <b className="text-white">{jugadorElegido.nombre}</b>
                      ) : (
                        "sin jugador"
                      )}

                      {categoriaElegida && (
                        <>
                          {" · "}
                          <span style={{ color: categoriaElegida.color }}>
                            {categoriaElegida.nombre}
                          </span>
                        </>
                      )}
                    </span>

                    <span className="ml-auto flex gap-2">
                      <Button
                        icon={Undo2}
                        onClick={() => {
                          if (sesion.deshacer()) toast.success("Deshecho");
                          else toast.info("No hay nada que deshacer");
                        }}
                      >
                        Deshacer
                      </Button>
                    </span>
                  </div>

                  <div className="mt-3">
                    <LineaDeTiempo
                      duracionMs={estado.duracionMs}
                      tiempoMs={estado.tiempoMs}
                      inicioPendienteMs={inicioMs}
                      clips={clips}
                      categorias={config.categorias}
                      seleccionado={seleccionado}
                      onSalta={salta}
                      onElegirClip={(id) => {
                        const clip = clips.find((uno) => uno.id === id);

                        if (clip) reproduceClip(clip);
                      }}
                    />
                  </div>
                </div>

                {/* --------------------------- CLIPS --------------------- */}

                <Panel
                  title="Clips"
                  subtitle={`${clipsFiltrados.length} de ${clips.length} · ${etiquetaFiltro}`}
                  icon={ListVideo}
                  action={
                    <div className="flex flex-wrap items-center gap-2">
                      {(filtroJugador || filtroCategoria) && (
                        <Button
                          onClick={() => {
                            setFiltroJugador(null);
                            setFiltroCategoria(null);
                          }}
                        >
                          Quitar filtros
                        </Button>
                      )}

                      <Button
                        icon={Play}
                        onClick={() => lanzaCola(clipsFiltrados)}
                        disabled={clipsFiltrados.length === 0}
                        title="Reproducir todos los clips filtrados, uno detrás de otro"
                      >
                        Reproducir todos
                      </Button>
                    </div>
                  }
                >
                  {cola && clipEnCola && (
                    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-[#C8A96B]/30 bg-[#C8A96B]/[0.06] px-3 py-2">
                      <span className="text-[11px] text-[#C8A96B]">
                        Lista · {enCola + 1} / {cola.length}
                      </span>

                      <span className="text-[12px] text-white/70">
                        {clipEnCola.jugadorNombre}
                      </span>

                      <span className="ml-auto flex gap-1.5">
                        <Button icon={SkipBack} onClick={() => mueveCola(-1)}>
                          Anterior
                        </Button>

                        <Button icon={SkipForward} onClick={() => mueveCola(1)}>
                          Siguiente
                        </Button>

                        <Button
                          onClick={() => setBucle((valor) => !valor)}
                          tone={bucle ? "primary" : "ghost"}
                        >
                          Bucle
                        </Button>

                        <Button
                          onClick={() => {
                            setCola(null);
                            reproductor.pausa();
                          }}
                        >
                          Parar
                        </Button>
                      </span>
                    </div>
                  )}

                  <ListaClips
                    clips={clipsFiltrados}
                    categorias={config.categorias}
                    seleccionado={seleccionado}
                    onSeleccionar={setSeleccionado}
                    onReproducir={reproduceClip}
                    onEditar={setEditando}
                    onDuplicar={sesion.duplicaClip}
                    onBorrar={(id) => {
                      sesion.borraClip(id);
                      toast.success("Clip eliminado · se puede deshacer");
                    }}
                    onExportar={(clip) =>
                      void exporta({
                        clips: [clip],
                        formato: "clip",
                        nombre: `${apodoCoding(clip.jugadorNombre)}-${String(clip.numero).padStart(3, "0")}`,
                      })
                    }
                    exportando={exportador.exportando}
                  />
                </Panel>

                {/* ------------------------ EXPORTACIÓN ------------------ */}

                <Panel
                  title="Sacar los vídeos"
                  subtitle="Los cortes se generan en el servidor con el vídeo original: no se sube nada"
                  icon={Film}
                >
                  <BarraExportacion
                    clips={clipsFiltrados}
                    etiqueta={etiquetaFiltro}
                    exportando={exportador.exportando}
                    modo={modoCorte}
                    onModo={setModoCorte}
                    onZip={() =>
                      void exporta({
                        clips: clipsFiltrados,
                        formato: "zip",
                        nombre: `${apodoCoding(titulo)}-${apodoCoding(etiquetaFiltro)}`,
                      })
                    }
                    onUnificado={() => void exportaUnificado()}
                  />
                </Panel>
              </div>

              {/* -------------------------- DERECHA -------------------- */}

              <div className="min-w-0 space-y-4">
                {(!src || cambiandoVideo) && (
                  <Panel title="El vídeo" icon={Video}>
                    <SelectorFuente
                      fuente={sesion.sesion.fuente}
                      onElegir={eligeFuente}
                    />
                  </Panel>
                )}

                <Panel
                  title="Jugadores"
                  subtitle="La tecla que selecciona a cada uno"
                  icon={BookOpen}
                  action={
                    src ? (
                      <Button onClick={() => setCambiandoVideo((abierto) => !abierto)}>
                        Cambiar vídeo
                      </Button>
                    ) : undefined
                  }
                  bodyClassName="p-3 sm:p-3"
                >
                  <PanelJugadores
                    jugadores={jugadores}
                    teclas={teclas}
                    activo={jugadorActivo}
                    cuentas={cuentasJugador}
                    onElegir={(id) =>
                      setJugadorActivo((actual) => (actual === id ? null : id))
                    }
                  />
                </Panel>

                <Panel
                  title="Categorías"
                  subtitle="Opcional: se puede codificar sólo con jugador"
                  bodyClassName="p-3 sm:p-3"
                >
                  <PanelCategorias
                    categorias={config.categorias}
                    activa={categoriaActiva}
                    cuentas={cuentasCategoria}
                    onElegir={(id) =>
                      setCategoriaActiva((actual) => (actual === id ? "" : id))
                    }
                  />
                </Panel>

                <Panel
                  title="Teclado"
                  icon={Keyboard}
                  action={
                    <Button onClick={() => setAyuda((abierta) => !abierta)}>
                      {ayuda ? "Ocultar" : "Ver"}
                    </Button>
                  }
                >
                  {ayuda ? (
                    <AyudaTeclado />
                  ) : (
                    <p className="text-[11px] text-white/30">
                      Pulsa <b>?</b> para volver a verla.
                    </p>
                  )}
                </Panel>

                <Panel title="Por jugador" bodyClassName="p-3 sm:p-3">
                  <TablaResumen
                    filas={porJugador(clips)}
                    vacio="Sin clips todavía."
                    activa={filtroJugador}
                    onElegir={(clave) =>
                      setFiltroJugador((actual) =>
                        actual === clave ? null : clave,
                      )
                    }
                  />
                </Panel>

                <Panel title="Por categoría" bodyClassName="p-3 sm:p-3">
                  <TablaResumen
                    filas={porCategoria(clips, config.categorias)}
                    vacio="Sin clips todavía."
                    activa={filtroCategoria}
                    onElegir={(clave) =>
                      setFiltroCategoria((actual) =>
                        actual === clave ? null : clave,
                      )
                    }
                  />
                </Panel>

                {seleccionado && (
                  <Panel title="Clip elegido" bodyClassName="p-3 sm:p-3">
                    {(() => {
                      const clip = clips.find((uno) => uno.id === seleccionado);

                      if (!clip) return null;

                      return (
                        <div className="space-y-1 text-[12px] text-white/60">
                          <p className="text-white/85">{clip.jugadorNombre}</p>

                          <p className="font-mono tabular-nums">
                            {formateaMs(clip.codingInicioMs)} →{" "}
                            {formateaMs(clip.codingFinMs)}
                          </p>

                          <p className="text-white/35">
                            Corte: {formateaMs(clip.inicioMs)} →{" "}
                            {formateaMs(clip.finMs)} (
                            {(duracionClip(clip) / 1000).toFixed(2)}s)
                          </p>

                          {clip.nota && (
                            <p className="text-white/50">«{clip.nota}»</p>
                          )}
                        </div>
                      );
                    })()}
                  </Panel>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>

      {ajustes && (
        <ConfiguraCoding
          config={{ ...config, teclasJugador: teclas }}
          jugadores={jugadores}
          onCerrar={() => setAjustes(false)}
          onGuardar={(nueva) => {
            configDoc.setValue(nueva);

            sesion.ponAjustes({
              preRollMs: nueva.preRollMs,
              postRollMs: nueva.postRollMs,
              fps: nueva.fps,
            });

            setAjustes(false);

            toast.success("Configuración guardada");
          }}
        />
      )}

      {editando && (
        <FichaClip
          clip={editando}
          jugadores={jugadores}
          categorias={config.categorias}
          tiempoActualMs={estado.tiempoMs}
          onCerrar={() => setEditando(null)}
          onGuardar={(cambios) => {
            sesion.actualizaClip(
              editando.id,
              cambios,
              estado.duracionMs || undefined,
            );

            setEditando(null);

            toast.success("Clip corregido");
          }}
        />
      )}
    </main>
  );
}
