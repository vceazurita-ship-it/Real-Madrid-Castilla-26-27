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
 *
 * **Y en los dos se puede codificar al equipo, no sólo a alguien.** El sujeto
 * del clip puede ser un jugador (su tecla) o un comportamiento colectivo —la
 * salida de balón, el repliegue— con `⇧` delante de la suya. Es un sujeto o el
 * otro, nunca los dos: elegir uno suelta al anterior, porque un clip contesta
 * a una pregunta sola.
 */

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  BookOpen,
  Eye,
  EyeOff,
  Film,
  Keyboard,
  ListVideo,
  Pause,
  PenTool,
  Play,
  Plus,
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
  Dialog,
  Field,
  Notice,
  Panel,
  SaveState,
} from "@/components/abp/ui";
import { ConfiguraCoding } from "@/components/coding/ConfiguraCoding";
import {
  BarraExportacion,
  useExportador,
  type ModoCorteUI,
  type ParadaDeClip,
} from "@/components/coding/ExportaClips";
import { FichaClip, ListaClips } from "@/components/coding/ListaClips";
import { LineaDeTiempo } from "@/components/coding/LineaDeTiempo";
import {
  AyudaTeclado,
  PanelCategorias,
  PanelColectivos,
  PanelJugadores,
  TablaResumen,
  Tecla,
} from "@/components/coding/piezas";
import { FilaPizarra, PizarraVideo } from "@/components/coding/PizarraVideo";
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
  porColectivo,
  porJugador,
  reparteTeclas,
  totalCodificadoMs,
  type AmbitoCoding,
  type ClipCoding,
  type ConfigCoding,
  type FuenteVideo,
  type JugadorCoding,
  type SujetoCoding,
} from "@/lib/coding/modelo";
import {
  componeEscena,
  escenaEn,
  escenaVacia,
  nombreEscena,
  type EscenaTel,
} from "@/lib/coding/telestracion";
import { esperaFuentePortada, FAMILIA_PORTADA } from "@/lib/rivals/portada-font";
import { fetchMatches, matchLabel } from "@/lib/ratings/matches";
import type { MatchMeta } from "@/lib/ratings/types";

const TEMPORADA = "26 / 27";

/* Lo que hay que decir cuando se marca sin haber elegido a nadie ni nada. */
const SIN_SUJETO =
  "Elige antes un jugador con su tecla, o un comportamiento colectivo con ⇧.";

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
/*  A QUIÉN SE PUEDE ANALIZAR                                          */
/* ================================================================== */

/** El documento donde viven los rivales añadidos a mano (los amistosos). */
const CLAVE_RIVALES_CODING = "coding:rivales";

/**
 * Si un nombre es el nuestro.
 *
 * La hoja de scouting trae al propio Castilla entre los equipos —está para
 * otras cosas—, y salía **el primero** en el desplegable de rivales: quien
 * entraba a analizar a un rival se encontraba codificando contra sí mismo. No
 * es un caso raro que merezca un aviso: es que no es un rival.
 */
function esNuestroEquipo(nombre: string) {
  const clave = apodoCoding(nombre);

  return (
    clave === "rmc" ||
    clave.startsWith("rmc-") ||
    clave.includes("castilla") ||
    clave === "real-madrid-c"
  );
}

/**
 * Los dorsales sueltos, para un rival del que no hay plantilla.
 *
 * En un amistoso —o en un rival que el scouting todavía no ha cargado— no hay
 * nombres, pero sí hay camisetas. Codificar «el 9» es exactamente lo que hace
 * un analista con el partido en marcha, y luego se le pone el nombre al vídeo.
 */
const DORSALES_SUELTOS: JugadorCoding[] = Array.from(
  { length: 20 },
  (_, indice) => ({
    id: `dorsal-${indice + 1}`,
    nombre: `Dorsal ${indice + 1}`,
    dorsal: indice + 1,
  }),
);

type RivalCoding = {
  /** El apodo, que es lo que va en la URL y en la clave de la sesión. */
  clave: string;
  nombre: string;
  /** De dónde ha salido: del calendario, del scouting o escrito a mano. */
  origen: "liga" | "scouting" | "propio";
};

/* ================================================================== */
/*  LA PÁGINA                                                          */
/* ================================================================== */

/**
 * Lleva el vídeo a un instante y espera al fotograma.
 *
 * Con plazo, y esto no es cautela de más: un `seeked` que no llega —un fichero
 * que se movió, un decodificador atascado— dejaría la exportación esperando
 * para siempre, con su aviso girando y sin decir nada. Devuelve `false` y esa
 * pizarra no se quema; el vídeo sale igual.
 */
function vePorElFotograma(video: HTMLVideoElement, segundos: number) {
  return new Promise<boolean>((listo) => {
    const acaba = (valor: boolean) => {
      clearTimeout(plazo);
      video.removeEventListener("seeked", llegada);
      listo(valor);
    };

    const llegada = () => acaba(true);

    const plazo = setTimeout(() => acaba(false), 5000);

    video.addEventListener("seeked", llegada);
    video.currentTime = segundos;
  });
}

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

  /* ------------------------------------------------------ rivales */

  /** Los rivales de amistoso que ha escrito el analista. */
  const rivalesDoc = useRemoteDoc<{ nombres: string[] }>({
    key: CLAVE_RIVALES_CODING,
    kind: TIPO_CODING,
    fallback: { nombres: [] },
  });

  const rivalesPropios = useMemo(() => {
    const lista = rivalesDoc.value?.nombres;

    return Array.isArray(lista) ? lista.filter((uno) => typeof uno === "string") : [];
  }, [rivalesDoc.value]);

  /*
  | A quién se puede analizar.
  |
  | Manda **el calendario**: los rivales de la temporada, en el orden de las
  | jornadas, que es como los busca el cuerpo técnico. Detrás van los equipos
  | que el scouting tiene cargados y que no juegan liga con nosotros, y al
  | final los que se añaden a mano para un amistoso. Se cruzan por el apodo
  | —«CD Numancia» y «C.D. Numancia» son el mismo equipo— y el propio Castilla
  | se cae de la lista.
  */
  const rivales: RivalCoding[] = useMemo(() => {
    const vistos = new Map<string, RivalCoding>();

    const añade = (nombre: string, origen: RivalCoding["origen"]) => {
      const limpio = (nombre ?? "").trim();

      if (!limpio || esNuestroEquipo(limpio)) return;

      const clave = apodoCoding(limpio);

      if (!vistos.has(clave)) vistos.set(clave, { clave, nombre: limpio, origen });
    };

    partidos.forEach((uno) => añade(uno.opponent, "liga"));
    plantillas.forEach((una) => añade(una.equipo, "scouting"));
    rivalesPropios.forEach((uno) => añade(uno, "propio"));

    return [...vistos.values()];
  }, [partidos, plantillas, rivalesPropios]);

  const rival = useMemo(
    () =>
      rivales.find((uno) => uno.clave === apodoCoding(equipoRival)) ??
      rivales[0] ??
      null,
    [equipoRival, rivales],
  );

  /** La plantilla del scouting de ese rival, si la hay. */
  const plantilla = useMemo(
    () =>
      rival
        ? (plantillas.find((una) => apodoCoding(una.equipo) === rival.clave) ?? null)
        : null,
    [plantillas, rival],
  );

  /* Un rival sin plantilla se puede codificar por dorsales. */
  const [porDorsales, setPorDorsales] = useState(false);

  const [añadiendoRival, setAñadiendoRival] = useState(false);
  const [rivalNuevo, setRivalNuevo] = useState("");

  const refId =
    ambito === "partido"
      ? (partido?.id ?? "sin-partido")
      : (rival?.clave ?? "sin-rival");

  const titulo =
    ambito === "partido"
      ? partido
        ? matchLabel(partido)
        : "Partido sin elegir"
      : (rival?.nombre ?? "Rival sin elegir");

  /** La lista de jugadores del panel de teclas. */
  const jugadores: JugadorCoding[] = useMemo(() => {
    if (ambito === "rival") {
      const lista = plantilla?.jugadores ?? [];

      if (lista.length > 0) return lista;

      return porDorsales ? DORSALES_SUELTOS : [];
    }

    return players.map((jugador) => ({
      id: jugador.id,
      nombre: jugador.apodo || jugador.nombre,
      dorsal: jugador.dorsal,
      foto: jugador.foto,
      posicion: jugador.posicion,
    }));
  }, [ambito, plantilla, players, porDorsales]);

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

  const { elemento, estado, montaVideo, salta, tiempoAhoraMs } = reproductor;

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

  /*
  | El fichero abierto del ordenador, mientras dure la pestaña.
  |
  | No se puede guardar en la sesión —un navegador no conserva el permiso sobre
  | un fichero del disco—, pero sí hace falta tenerlo a mano: es lo que se
  | copia a la carpeta de partidos cuando llega el momento de cortar. Al
  | recargar se pierde y hay que volver a abrirlo, y la exportación lo dice.
  */
  const [ficheroLocal, setFicheroLocal] = useState<File | null>(null);

  const eligeFuente = useCallback(
    (fuente: FuenteVideo, nuevo: string, fichero?: File) => {
      setSrcElegido(nuevo);
      setCambiandoVideo(false);
      setFicheroLocal(fichero ?? null);
      ponFuente(fuente);
    },
    [ponFuente],
  );

  /*
  | Un vídeo abierto del ordenador que ya está en la carpeta, se adopta solo.
  |
  | Es el camino que hace todo el mundo: se codifica con el fichero abierto del
  | disco —lo único que se puede hacer sin mover gigas— y después se deja el
  | partido en la carpeta para poder cortar. Antes había que acordarse de
  | volver a elegirlo a mano, y como la pantalla se ve igual, lo que se
  | encontraba uno era el error al exportar, media hora después.
  |
  | Se empareja por nombre de fichero, que es lo único que el navegador deja
  | saber de un fichero del disco. Y se busca una sola vez por nombre: si no
  | está, el aviso de la pantalla lo dice y no se vuelve a preguntar.
  */
  const fuenteGuardada = sesion.sesion.fuente;

  const buscadaEnCarpeta = useRef<string | null>(null);

  useEffect(() => {
    if (!fuenteGuardada || fuenteGuardada.tipo !== "local") return;

    if (buscadaEnCarpeta.current === fuenteGuardada.nombre) return;

    buscadaEnCarpeta.current = fuenteGuardada.nombre;

    let vivo = true;

    fetch("/api/coding/videos", { cache: "no-store" })
      .then((respuesta) => respuesta.json())
      .then((datos) => {
        if (!vivo || !datos?.ok) return;

        const igual = (datos.videos ?? []).find(
          (video: { nombre: string }) => video.nombre === fuenteGuardada.nombre,
        );

        if (!igual) return;

        eligeFuente(
          { tipo: "archivo", ruta: igual.ruta, nombre: igual.nombre },
          `/api/coding/video?ruta=${encodeURIComponent(igual.ruta)}`,
        );

        toast.success("El vídeo ya está en la carpeta de partidos", {
          description: "Se corta desde ahí: el coding y las pizarras se quedan como están.",
        });
      })
      .catch(() => undefined);

    return () => {
      vivo = false;
    };
  }, [eligeFuente, fuenteGuardada]);

  /* ------------------------------------------------ estado de coding */

  /*
  | Lo que se está codificando ahora: un jugador o un comportamiento colectivo.
  |
  | Es UN estado y no dos a propósito. Con un `jugadorActivo` y un
  | `colectivoActivo` sueltos se puede llegar a tener los dos encendidos, y
  | entonces el clip sale del que mire primero el código —no del que el
  | analista cree tener elegido—. Aquí elegir uno suelta al otro por
  | construcción: un clip tiene un sujeto.
  */
  const [sujetoActivo, setSujetoActivo] = useState<{
    tipo: "jugador" | "colectivo";
    id: string;
  } | null>(null);

  const [categoriaActiva, setCategoriaActiva] = useState("");
  const [inicioMs, setInicioMs] = useState<number | null>(null);
  const [seleccionado, setSeleccionado] = useState<string | null>(null);

  const [ayuda, setAyuda] = useState(true);
  const [ajustes, setAjustes] = useState(false);
  const [editando, setEditando] = useState<ClipCoding | null>(null);
  const [avisoSesion, setAvisoSesion] = useState(true);

  /* Filtros de la lista y de la exportación. */
  const [filtroSujeto, setFiltroSujeto] = useState<string | null>(null);
  const [filtroCategoria, setFiltroCategoria] = useState<string | null>(null);

  const [modoCorte, setModoCorte] = useState<ModoCorteUI>("preciso");

  /* ------------------------------------------------- la pizarra */

  /*
  | La telestración: `null` mientras sólo se mira, y el id de la pizarra que se
  | está pintando cuando se entra a dibujar. Mientras se pinta, el teclado del
  | coding se apaga entero (`hayModal`): la `f` es el foco, no un jugador.
  */
  const [pizarraEditando, setPizarraEditando] = useState<string | null>(null);
  const [pizarraVisible, setPizarraVisible] = useState(true);

  const escenas = sesion.sesion.escenas;

  const clips = sesion.sesion.clips;

  const clipsFiltrados = useMemo(
    () =>
      clips.filter(
        (clip) =>
          (!filtroSujeto || clip.jugadorId === filtroSujeto) &&
          (!filtroCategoria || clip.categoriaId === filtroCategoria),
      ),
    [clips, filtroCategoria, filtroSujeto],
  );

  /*
  | Las cuentas de cada panel, separadas por tipo de sujeto.
  |
  | No basta con contar por `jugadorId`: un jugador y un comportamiento pueden
  | acabar con el mismo identificador —los dos salen de nombres— y entonces las
  | dos tarjetas enseñarían el mismo número.
  */
  const cuentasJugador = useMemo(() => {
    const cuenta: Record<string, number> = {};

    for (const clip of clips) {
      if (clip.sujeto === "colectivo") continue;

      cuenta[clip.jugadorId] = (cuenta[clip.jugadorId] ?? 0) + 1;
    }

    return cuenta;
  }, [clips]);

  const cuentasColectivo = useMemo(() => {
    const cuenta: Record<string, number> = {};

    for (const clip of clips) {
      if (clip.sujeto !== "colectivo") continue;

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

  /**
   * El sujeto elegido, ya resuelto contra su lista.
   *
   * Se recalcula en vez de guardarse: las plantillas llegan del servidor
   * después de pintar y los comportamientos se pueden editar en la
   * configuración, así que un nombre copiado al elegir podría quedarse viejo.
   */
  const sujeto: SujetoCoding | null = useMemo(() => {
    if (!sujetoActivo) return null;

    if (sujetoActivo.tipo === "colectivo") {
      const uno = config.comportamientos.find(
        (otro) => otro.id === sujetoActivo.id,
      );

      return uno
        ? { tipo: "colectivo", id: uno.id, nombre: uno.nombre }
        : null;
    }

    const jugador = jugadores.find((uno) => uno.id === sujetoActivo.id);

    return jugador
      ? {
          tipo: "jugador",
          id: jugador.id,
          nombre: jugador.nombre,
          dorsal: jugador.dorsal,
        }
      : null;
  }, [config.comportamientos, jugadores, sujetoActivo]);

  const marcaInicio = useCallback(() => {
    if (!sujetoActivo) {
      toast.error(SIN_SUJETO);
      return;
    }

    setInicioMs(tiempoAhoraMs());
  }, [sujetoActivo, tiempoAhoraMs]);

  const marcaFinal = useCallback(() => {
    if (inicioMs === null) {
      toast.error("Marca antes el inicio con la tecla I.");
      return;
    }

    if (!sujeto) {
      toast.error(SIN_SUJETO);
      return;
    }

    const problema = sesion.añadeClip({
      sujeto: sujeto.tipo,
      jugadorId: sujeto.id,
      jugadorNombre: sujeto.nombre,
      jugadorDorsal: sujeto.dorsal,
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
    sesion,
    sujeto,
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

  /* -------------------------------------------------- la pizarra */

  const { guardaEscena } = sesion;

  /**
   * Abre la pizarra en el fotograma en el que está el vídeo.
   *
   * Si el instante ya cae dentro de una pizarra existente se edita **ésa**: dos
   * pizarras solapadas se tapan la una a la otra al reproducir, y quien vuelve
   * a pintar en el mismo sitio quiere corregir lo que hay, no empezar de cero.
   */
  const abrePizarra = useCallback(() => {
    reproductor.pausa();

    const ahora = tiempoAhoraMs();

    const existente = escenaEn(escenas, ahora);

    if (existente) {
      setPizarraEditando(existente.id);
      return;
    }

    const nueva = escenaVacia(
      ahora,
      `esc-${Math.round(ahora)}-${Math.random().toString(36).slice(2, 6)}`,
      new Date().toISOString(),
    );

    guardaEscena(nueva);
    setPizarraVisible(true);
    setPizarraEditando(nueva.id);
  }, [escenas, guardaEscena, reproductor, tiempoAhoraMs]);

  const abreEscena = useCallback(
    (id: string, paraPintar: boolean) => {
      const escena = escenas.find((una) => una.id === id);

      if (!escena) return;

      salta(escena.tMs);
      setPizarraVisible(true);

      if (paraPintar) {
        reproductor.pausa();
        setPizarraEditando(id);
      }
    },
    [escenas, reproductor, salta],
  );

  /*
  | Las pizarras congeladas paran el vídeo al llegar.
  |
  | Se vigila con el bucle de animación por lo mismo que la lista de clips: el
  | tiempo de React llega tarde y el vídeo se pasaría de largo. Y se recuerda
  | cuál se acaba de congelar, porque si no, darle al play dentro de la ventana
  | de la pizarra volvería a pararlo en el acto y el vídeo no arrancaría nunca.
  */
  const congelada = useRef<string | null>(null);

  useEffect(() => {
    if (pizarraEditando || !pizarraVisible) return;

    if (!elemento || escenas.length === 0) return;

    const video = elemento;

    let mano = 0;

    /* La cuenta atrás de una pizarra que se descongela sola. */
    let despertador: ReturnType<typeof setTimeout> | null = null;

    const vigila = () => {
      mano = requestAnimationFrame(vigila);

      if (video.paused) return;

      const escena = escenaEn(escenas, video.currentTime * 1000);

      if (!escena) {
        congelada.current = null;
        return;
      }

      if (escena.congelada && congelada.current !== escena.id) {
        congelada.current = escena.id;
        video.pause();

        /*
        | Con `pausaMs` la pizarra es una repetición de televisión: para, se ve
        | el dibujo el rato dicho y el partido sigue sin que nadie toque nada.
        | Si alguien le da al play antes, el despertador ya no tiene nada que
        | hacer —el vídeo está andando— y se deja morir.
        */
        if (escena.pausaMs > 0) {
          if (despertador) clearTimeout(despertador);

          despertador = setTimeout(() => {
            despertador = null;

            if (video.paused) void video.play().catch(() => undefined);
          }, escena.pausaMs);
        }
      }
    };

    mano = requestAnimationFrame(vigila);

    return () => {
      cancelAnimationFrame(mano);

      if (despertador) clearTimeout(despertador);
    };
  }, [elemento, escenas, pizarraEditando, pizarraVisible]);

  /* ------------------------------------------------- exportación */

  const exportador = useExportador({
    fuente: sesion.sesion.fuente,
    categorias: config.categorias,
    carpeta: apodoCoding(titulo),
    modo: modoCorte,
    ficheroLocal,
    fps: sesion.sesion.fps,
    titulo,
    onAdopta: eligeFuente,
  });

  const { exporta } = exportador;

  /*
  | El partido está abierto del ordenador: el montaje se hace en el navegador.
  |
  | Es el camino normal con la app desplegada —el servidor no ve ese fichero, y
  | subir varios gigas no existe—, y cambia lo que se puede elegir en la barra
  | de exportación: ver `lib/coding/navegador.ts`.
  */
  const montaEnNavegador =
    !!ficheroLocal || sesion.sesion.fuente?.tipo === "local";

  /*
  | El nombre del filtro se resuelve mirando primero las dos listas de sujetos
  | y sólo después las categorías. Con `jugadores` a secas, filtrar por un
  | comportamiento colectivo dejaba el vídeo llamándose «jugador».
  */
  const comportamientoDe = useCallback(
    (id: string | null) =>
      config.comportamientos.find((uno) => uno.id === id) ?? null,
    [config.comportamientos],
  );

  const etiquetaFiltro = filtroSujeto
    ? (jugadorDe(filtroSujeto)?.nombre ??
      comportamientoDe(filtroSujeto)?.nombre ??
      "sujeto")
    : filtroCategoria
      ? (config.categorias.find((una) => una.id === filtroCategoria)?.nombre ??
        "categoría")
      : "todo el partido";

  /*
  | -------------------------------------------- LAS PIZARRAS QUEMADAS
  |
  | Meter la telestración dentro del fichero que sale.
  |
  | Lo que se manda al servidor no son los dibujos sino **el fotograma ya
  | compuesto**: el navegador es el único que sabe pintarlos —y el único que
  | tiene los píxeles que necesitan el difuminado, la lupa y el jugador
  | recortado—, así que aquí se compone a la resolución del vídeo y allí sólo
  | hay que enseñarlo. El vídeo se para en ese instante, se ve el dibujo y
  | sigue limpio, que es lo mismo que hace la pantalla y lo que hace la
  | televisión.
  |
  | Cuánto dura la parada: lo que diga «Sigue a los N s» si la pizarra está
  | congelada, y si no, lo que dure la pizarra. Nunca menos de medio segundo.
  */
  const [quemaPizarras, setQuemaPizarras] = useState(true);

  const escenasDeClip = useCallback(
    (clip: ClipCoding) =>
      escenas.filter(
        (escena) => escena.tMs >= clip.inicioMs && escena.tMs <= clip.finMs,
      ),
    [escenas],
  );

  /* Cuántas pizarras se van a quemar con lo que hay elegido ahora. */
  const pizarrasEnLaExportacion = useMemo(
    () =>
      clipsFiltrados.reduce(
        (suma, clip) => suma + escenasDeClip(clip).length,
        0,
      ),
    [clipsFiltrados, escenasDeClip],
  );

  const componePizarras = useCallback(
    async (lista: ClipCoding[]) => {
      const vacio = new Map<string, ParadaDeClip[]>();

      if (!quemaPizarras || escenas.length === 0) return vacio;

      const video = videoRef.current;

      if (!video) return vacio;

      const necesarias = new Map<string, EscenaTel>();

      for (const clip of lista) {
        for (const escena of escenasDeClip(clip)) {
          if (escena.dibujos.length > 0) necesarias.set(escena.id, escena);
        }
      }

      if (necesarias.size === 0) return vacio;

      await esperaFuentePortada();

      const estabaEn = video.currentTime;
      const estabaParado = video.paused;

      video.pause();

      const pngs = new Map<string, string>();

      for (const escena of necesarias.values()) {
        const llegado = await vePorElFotograma(video, escena.tMs / 1000);

        if (!llegado) continue;

        const png = componeEscena(video, escena, FAMILIA_PORTADA, "jpeg");

        if (png) pngs.set(escena.id, png);
      }

      video.currentTime = estabaEn;

      if (!estabaParado) void video.play().catch(() => undefined);

      const porClip = new Map<string, ParadaDeClip[]>();

      for (const clip of lista) {
        const paradas = escenasDeClip(clip)
          .filter((escena) => pngs.has(escena.id))
          .map((escena) => ({
            imagen: pngs.get(escena.id)!,
            enMs: Math.max(0, escena.tMs - clip.inicioMs),
            duracionMs: Math.max(
              500,
              escena.congelada && escena.pausaMs > 0
                ? escena.pausaMs
                : escena.duracionMs,
            ),
          }));

        if (paradas.length > 0) porClip.set(clip.id, paradas);
      }

      return porClip;
    },
    [escenas, escenasDeClip, quemaPizarras],
  );

  /*
  | ------------------------------------------------------ LA CARÁTULA
  |
  | La diapositiva que abre el vídeo unificado: la misma que ya exporta la
  | ficha del jugador rival (`lib/rivals/portada.ts`).
  |
  | Antes se ponía sola y sólo si había un filtro de sujeto, así que era
  | invisible: quien exportaba «todo el partido» no tenía forma de pedirla, y
  | quien filtraba no tenía forma de quitarla. Ahora se elige —de quién es, o
  | ninguna— y se puede ver antes de montar el vídeo, que para eso es lo
  | primero que se ve en la sala.
  |
  | Los candidatos salen de los clips que se van a exportar y no de la
  | plantilla: si se codificó por dorsales, el nombre del clip es lo único que
  | hay, y también sirve para la carátula.
  */
  const sujetosDeClips = useMemo(() => {
    const vistos = new Map<string, { id: string; nombre: string }>();

    for (const clip of clipsFiltrados) {
      if (!vistos.has(clip.jugadorId)) {
        vistos.set(clip.jugadorId, {
          id: clip.jugadorId,
          nombre: clip.jugadorNombre,
        });
      }
    }

    return [...vistos.values()];
  }, [clipsFiltrados]);

  /* Lo que se pone sin tocar nada: el del filtro, o el único que haya. */
  const caratulaPorDefecto =
    filtroSujeto ?? (sujetosDeClips.length === 1 ? sujetosDeClips[0].id : "");

  const [caratulaPedida, setCaratulaPedida] = useState<string | null>(null);

  /* Lo pedido manda, pero sólo mientras siga estando entre lo exportable: así
     cambiar de filtro no deja la carátula de un jugador que ya no sale. */
  const caratulaSujeto =
    caratulaPedida !== null &&
    (caratulaPedida === "" ||
      sujetosDeClips.some((uno) => uno.id === caratulaPedida))
      ? caratulaPedida
      : caratulaPorDefecto;

  const construyeCaratula = useCallback(async () => {
    if (!caratulaSujeto) return null;

    const jugador = jugadorDe(caratulaSujeto);
    const comportamiento = jugador ? null : comportamientoDe(caratulaSujeto);

    /*
    | El vídeo de un comportamiento colectivo también se abre con la carátula
    | del club: es la misma diapositiva, con el nombre de la fase donde iría el
    | del jugador y sin cara ni dorsal, que es lo que hay que enseñar antes de
    | una sucesión de repliegues.
    */
    const nombre =
      jugador?.nombre ??
      comportamiento?.nombre ??
      sujetosDeClips.find((uno) => uno.id === caratulaSujeto)?.nombre ??
      "";

    if (!nombre) return null;

    return caratulaDeJugador({
      equipo: ambito === "rival" ? titulo : "RMCF Castilla",
      escudo: ambito === "rival" ? escudoDe(rival?.nombre ?? "") : "/logo.png",
      temporada: TEMPORADA,
      nombre,
      posicion: jugador?.posicion ?? (comportamiento ? "COLECTIVO" : ""),
      dorsal: jugador?.dorsal !== undefined ? String(jugador.dorsal) : "",
      foto: jugador?.foto,
      contexto: titulo,
    });
  }, [
    ambito,
    caratulaSujeto,
    comportamientoDe,
    escudoDe,
    jugadorDe,
    rival,
    sujetosDeClips,
    titulo,
  ]);

  /* La vista previa: se pinta al pedirla y se queda hasta que se cierra. */
  const [caratulaVista, setCaratulaVista] = useState<string | null>(null);

  const verCaratula = useCallback(async () => {
    const png = await construyeCaratula();

    if (!png) {
      toast.error("No se ha podido pintar la carátula.");
      return;
    }

    setCaratulaVista(png);
  }, [construyeCaratula]);

  const exportaUnificado = useCallback(async () => {
    /*
    | El aviso es para la carátula, que es lo único que se dibuja aquí y tarda
    | —hay que traerse la foto y el escudo—. Estaba al revés: salía cuando NO
    | había carátula, y entonces nacía y se cerraba en el mismo tick, que es la
    | única forma de que se quede colgado en pantalla. Y colgado tapaba el
    | error de verdad, el que llega justo después desde `exporta`.
    */
    const aviso = caratulaSujeto
      ? toast.loading("Montando la carátula del vídeo…")
      : null;

    const portada = await construyeCaratula();

    if (aviso) toast.dismiss(aviso);

    if (caratulaSujeto && !portada) {
      toast.warning("El vídeo sale sin carátula: no se ha podido pintar.");
    }

    await exporta({
      clips: clipsFiltrados,
      formato: "unificado",
      nombre: `${apodoCoding(titulo)}-${apodoCoding(etiquetaFiltro)}`,
      portada,
      paradas: await componePizarras(clipsFiltrados),
    });
  }, [
    caratulaSujeto,
    clipsFiltrados,
    componePizarras,
    construyeCaratula,
    etiquetaFiltro,
    exporta,
    titulo,
  ]);

  /* -------------------------------------------------- el teclado */

  /*
  | Mientras se pinta, el teclado es de la pizarra.
  |
  | Sin esto, elegir el foco con la `f` seleccionaría además al jugador que
  | tenga esa tecla, y la `o` de «fuera de juego» cerraría un clip a medias.
  */
  const hayModal = ajustes || editando !== null || pizarraEditando !== null;

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

        setSujetoActivo(null);
        setCategoriaActiva("");
        return;
      }

      if (evento.key === "?") {
        evento.preventDefault();
        setAyuda((abierta) => !abierta);
        return;
      }

      /* ------------------------------- sujetos y categorías */

      /*
      | Con ⇧ delante, la letra es de un comportamiento colectivo.
      |
      | Se mira antes que jugadores y categorías, y esas dos exigen que NO haya
      | mayúscula: el manejador compara con `key.toLowerCase()`, así que sin el
      | filtro un ⇧Q elegiría además la categoría de la `q` y el clip saldría
      | con la etiqueta equivocada sin que nadie lo hubiera pedido.
      */
      if (evento.shiftKey) {
        const colectivo = config.comportamientos.find(
          (uno) => uno.tecla && uno.tecla === tecla,
        );

        if (colectivo) {
          evento.preventDefault();

          setSujetoActivo((actual) =>
            actual?.tipo === "colectivo" && actual.id === colectivo.id
              ? null
              : { tipo: "colectivo", id: colectivo.id },
          );

          return;
        }
      }

      const jugador = evento.shiftKey
        ? undefined
        : jugadores.find((uno) => teclas[uno.id] === tecla);

      if (jugador) {
        evento.preventDefault();
        setSujetoActivo({ tipo: "jugador", id: jugador.id });
        return;
      }

      const categoria = evento.shiftKey
        ? undefined
        : config.categorias.find((una) => una.tecla === tecla);

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
    config.comportamientos,
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

  const categoriaElegida = config.categorias.find(
    (una) => una.id === categoriaActiva,
  );

  const cambiaUrl = (clave: string, valor: string) => {
    const siguientes = new URLSearchParams(params.toString());

    siguientes.set("ambito", ambito);
    siguientes.set(clave, valor);

    router.replace(`/coding?${siguientes.toString()}`);
  };

  /*
  | Cambiar de nuestro partido a un rival sin salir de la pantalla.
  |
  | Hasta ahora el ámbito sólo se elegía desde fuera —el enlace de la ficha del
  | rival o de la portada—, así que quien entraba por el menú lateral se
  | quedaba encerrado en «partido» y tenía que editar la dirección a mano. La
  | sesión no se toca: cada ámbito guarda la suya y volver la encuentra igual.
  */
  const cambiaAmbito = (nuevo: AmbitoCoding) => {
    if (nuevo === ambito) return;

    const siguientes = new URLSearchParams(params.toString());

    siguientes.set("ambito", nuevo);

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

            <div className="mt-5 grid min-w-0 gap-3 sm:grid-cols-[auto_minmax(0,1fr)_auto]">
              <div>
                <span className="mb-1.5 block text-[10px] uppercase tracking-[0.16em] text-white/40">
                  Qué se codifica
                </span>

                <div className="inline-flex rounded-xl border border-white/10 bg-white/[0.04] p-0.5">
                  {(
                    [
                      { valor: "partido", texto: "Nuestro partido" },
                      { valor: "rival", texto: "Un rival" },
                    ] as const
                  ).map((opcion) => (
                    <button
                      key={opcion.valor}
                      type="button"
                      onClick={() => cambiaAmbito(opcion.valor)}
                      aria-pressed={ambito === opcion.valor}
                      className={`rounded-[10px] px-3 py-1.5 text-[12px] transition ${
                        ambito === opcion.valor
                          ? "bg-[#C8A96B] font-semibold text-[#0B0F14]"
                          : "text-white/50 hover:text-white"
                      }`}
                    >
                      {opcion.texto}
                    </button>
                  ))}
                </div>
              </div>

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
                <div className="block min-w-0">
                  <span className="mb-1.5 block text-[10px] uppercase tracking-[0.16em] text-white/40">
                    Rival
                  </span>

                  <div className="flex min-w-0 gap-2">
                    <select
                      value={rival?.clave ?? ""}
                      aria-label="Rival"
                      onChange={(evento) => cambiaUrl("equipo", evento.target.value)}
                      className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none transition focus:border-[#C8A96B]/50"
                    >
                      {rivales.length === 0 && (
                        <option value="">Cargando el calendario…</option>
                      )}

                      {rivales.map((uno) => (
                        <option
                          key={uno.clave}
                          value={uno.clave}
                          className="bg-[#11161C]"
                        >
                          {uno.nombre}
                          {uno.origen === "propio" ? " · amistoso" : ""}
                        </option>
                      ))}
                    </select>

                    <Button
                      icon={Plus}
                      onClick={() => {
                        setRivalNuevo("");
                        setAñadiendoRival(true);
                      }}
                      title="Añadir un rival que no está en el calendario"
                    >
                      Otro
                    </Button>
                  </div>
                </div>
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
                <div className="relative min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-black">
                  {/*
                  | El <video> se monta SIEMPRE, también antes de elegir el
                  | partido: si sólo apareciera al haber fuente, el reloj y la
                  | línea de tiempo se armarían con la etiqueta todavía sin
                  | crear y se quedarían a cero para siempre. El aviso de
                  | «elige el vídeo» va encima, no en su lugar.
                  */}
                  <video
                    ref={montaVideo}
                    src={src || undefined}
                    className="aspect-video w-full bg-black"
                    preload="metadata"
                    playsInline
                  />

                  {/*
                  | La pizarra va **dentro** de este contenedor y no debajo del
                  | vídeo: se coloca sola sobre el rectángulo de imagen, y es
                  | este mismo `div` el que se pone a pantalla completa cuando
                  | se enseña el análisis en la sala.
                  */}
                  {src && (
                    <PizarraVideo
                      video={elemento}
                      escenas={escenas}
                      editando={pizarraEditando}
                      alEditar={setPizarraEditando}
                      alCambiar={guardaEscena}
                      alBorrar={sesion.borraEscena}
                      alPintar={abrePizarra}
                      visible={pizarraVisible}
                    />
                  )}

                  {!src && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/25">
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

                    <span
                      title={
                        estado.extra > 0
                          ? "El navegador no pasa de ×16: lo que falta se adelanta a saltos"
                          : undefined
                      }
                      className="rounded-full border border-[#C8A96B]/40 bg-[#C8A96B]/10 px-2 py-0.5 text-[11px] tabular-nums text-[#C8A96B]"
                    >
                      {estado.velocidad}x{estado.extra > 0 ? " ·turbo" : ""}
                    </span>

                    <Button
                      icon={PenTool}
                      onClick={abrePizarra}
                      disabled={!src}
                      title="Pintar sobre el fotograma: focos, flechas, mover jugadores…"
                    >
                      Pizarra
                    </Button>

                    <Button
                      icon={pizarraVisible ? Eye : EyeOff}
                      onClick={() => setPizarraVisible((valor) => !valor)}
                      title={
                        pizarraVisible
                          ? "Ocultar lo pintado mientras se reproduce"
                          : "Volver a enseñar lo pintado"
                      }
                    >
                      {escenas.length}
                    </Button>

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
                      {sujeto ? (
                        <b className="text-white">
                          {sujeto.tipo === "colectivo" && (
                            <span className="mr-1.5 text-[10px] uppercase tracking-[0.14em] text-white/35">
                              Colectivo
                            </span>
                          )}
                          {sujeto.nombre}
                        </b>
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
                      escenas={escenas}
                      seleccionado={seleccionado}
                      onSalta={salta}
                      onElegirClip={(id) => {
                        const clip = clips.find((uno) => uno.id === id);

                        if (clip) reproduceClip(clip);
                      }}
                      onElegirEscena={(id) => abreEscena(id, false)}
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
                      {(filtroSujeto || filtroCategoria) && (
                        <Button
                          onClick={() => {
                            setFiltroSujeto(null);
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
                      void (async () =>
                        exporta({
                          clips: [clip],
                          formato: "clip",
                          nombre: `${apodoCoding(clip.jugadorNombre)}-${String(clip.numero).padStart(3, "0")}`,
                          paradas: await componePizarras([clip]),
                        }))()
                    }
                    exportando={exportador.exportando}
                  />
                </Panel>

                {/* ------------------------ EXPORTACIÓN ------------------ */}

                <Panel
                  title="Sacar los vídeos"
                  subtitle={
                    montaEnNavegador
                      ? "Se montan aquí, en el navegador, con el fichero que tienes abierto: no se sube nada"
                      : "Los cortes se generan en el servidor con el vídeo original: no se sube nada"
                  }
                  icon={Film}
                >
                  <BarraExportacion
                    clips={clipsFiltrados}
                    etiqueta={etiquetaFiltro}
                    exportando={exportador.exportando}
                    modo={modoCorte}
                    onModo={setModoCorte}
                    caratula={caratulaSujeto}
                    opcionesCaratula={sujetosDeClips}
                    onCaratula={setCaratulaPedida}
                    onVerCaratula={() => void verCaratula()}
                    vistaCaratula={caratulaVista}
                    onCerrarVista={() => setCaratulaVista(null)}
                    pizarras={pizarrasEnLaExportacion}
                    quema={quemaPizarras}
                    onQuema={setQuemaPizarras}
                    enNavegador={montaEnNavegador}
                    onZip={() =>
                      void (async () =>
                        exporta({
                          clips: clipsFiltrados,
                          formato: "zip",
                          nombre: `${apodoCoding(titulo)}-${apodoCoding(etiquetaFiltro)}`,
                          paradas: await componePizarras(clipsFiltrados),
                        }))()
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

                {/* --------------------------- PIZARRAS ------------------ */}

                <Panel
                  title="Pizarras"
                  subtitle={
                    escenas.length > 0
                      ? `${escenas.length} sobre el vídeo`
                      : "Pinta sobre el fotograma y se guarda aquí"
                  }
                  icon={PenTool}
                  action={
                    <Button icon={PenTool} onClick={abrePizarra} disabled={!src}>
                      Pintar aquí
                    </Button>
                  }
                  bodyClassName="p-3 sm:p-3"
                >
                  {escenas.length === 0 ? (
                    <p className="text-[11px] text-white/35">
                      Para el vídeo donde quieras explicar algo y pulsa{" "}
                      <b className="text-white/60">Pizarra</b>: focos sobre un
                      jugador, flechas, zonas, mover a alguien a donde tenía que
                      estar. Lo pintado vuelve a salir solo al pasar por ahí.
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {escenas.map((escena, indice) => (
                        <FilaPizarra
                          key={escena.id}
                          escena={{
                            ...escena,
                            nombre: nombreEscena(escena, indice),
                          }}
                          indice={indice}
                          activa={escena.id === pizarraEditando}
                          alAbrir={() => abreEscena(escena.id, false)}
                          alEditar={() => abreEscena(escena.id, true)}
                          alBorrar={() => {
                            sesion.borraEscena(escena.id);

                            if (pizarraEditando === escena.id) {
                              setPizarraEditando(null);
                            }

                            toast.success("Pizarra borrada");
                          }}
                        />
                      ))}
                    </div>
                  )}
                </Panel>

                {/* Un rival sin plantilla cargada todavía se puede codificar. */}
                {ambito === "rival" &&
                  jugadores.length === 0 &&
                  rival !== null && (
                    <Notice tone="warn" title="Este rival no tiene plantilla">
                      <p>
                        El scouting todavía no ha cargado a los jugadores de{" "}
                        <b>{rival.nombre}</b>. Puedes codificar igualmente los
                        comportamientos colectivos, o trabajar por dorsales y
                        ponerle el nombre después.
                      </p>

                      <div className="mt-2">
                        <Button
                          tone="primary"
                          onClick={() => setPorDorsales(true)}
                        >
                          Codificar por dorsales
                        </Button>
                      </div>
                    </Notice>
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
                    activo={
                      sujetoActivo?.tipo === "jugador" ? sujetoActivo.id : null
                    }
                    cuentas={cuentasJugador}
                    onElegir={(id) =>
                      setSujetoActivo((actual) =>
                        actual?.tipo === "jugador" && actual.id === id
                          ? null
                          : { tipo: "jugador", id },
                      )
                    }
                  />
                </Panel>

                {/*
                | Lo que hace el equipo. Va debajo de los jugadores y no en otra
                | pestaña: en un partido se alterna entre las dos cosas —una
                | acción de un jugador, la salida de balón siguiente— y esconder
                | una de las dos obligaría a navegar en mitad del coding.
                */}
                <Panel
                  title="Comportamientos colectivos"
                  subtitle="Del equipo, no de un jugador · se eligen con ⇧"
                  bodyClassName="p-3 sm:p-3"
                >
                  <PanelColectivos
                    comportamientos={config.comportamientos}
                    activo={
                      sujetoActivo?.tipo === "colectivo"
                        ? sujetoActivo.id
                        : null
                    }
                    cuentas={cuentasColectivo}
                    onElegir={(id) =>
                      setSujetoActivo((actual) =>
                        actual?.tipo === "colectivo" && actual.id === id
                          ? null
                          : { tipo: "colectivo", id },
                      )
                    }
                  />
                </Panel>

                <Panel
                  title="Categorías"
                  subtitle="Opcional: se puede codificar sólo con el sujeto"
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
                    activa={filtroSujeto}
                    onElegir={(clave) =>
                      setFiltroSujeto((actual) =>
                        actual === clave ? null : clave,
                      )
                    }
                  />
                </Panel>

                {/* Sólo cuando hay algo: una tabla vacía más es ruido. */}
                {porColectivo(clips).length > 0 && (
                  <Panel title="Por comportamiento" bodyClassName="p-3 sm:p-3">
                    <TablaResumen
                      filas={porColectivo(clips)}
                      vacio="Sin clips todavía."
                      activa={filtroSujeto}
                      onElegir={(clave) =>
                        setFiltroSujeto((actual) =>
                          actual === clave ? null : clave,
                        )
                      }
                    />
                  </Panel>
                )}

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

      {/*
      | Añadir un rival que no está en el calendario.
      |
      | Los amistosos de pretemporada y los partidos de preparación no salen de
      | la hoja de la liga, y hasta ahora la única forma de codificarlos era
      | esperar a que el scouting cargara al equipo. Se guardan en su propio
      | documento —no se toca la hoja de nadie— y salen marcados como tales.
      */}
      {añadiendoRival && (
        <Dialog
          title="Añadir un rival"
          subtitle="Para un amistoso o un equipo que no esté en el calendario"
          onClose={() => setAñadiendoRival(false)}
          footer={
            <>
              <Button onClick={() => setAñadiendoRival(false)}>Cancelar</Button>

              <Button
                tone="primary"
                disabled={!rivalNuevo.trim()}
                onClick={() => {
                  const nombre = rivalNuevo.trim();

                  if (!nombre) return;

                  if (esNuestroEquipo(nombre)) {
                    toast.error("Ése somos nosotros: elige el equipo contrario.");
                    return;
                  }

                  const clave = apodoCoding(nombre);

                  if (rivales.some((uno) => uno.clave === clave)) {
                    toast.info("Ese rival ya está en la lista");
                  } else {
                    rivalesDoc.setValue((actual) => ({
                      nombres: [
                        ...(Array.isArray(actual?.nombres) ? actual.nombres : []),
                        nombre,
                      ],
                    }));

                    toast.success(`${nombre} añadido`);
                  }

                  setAñadiendoRival(false);
                  cambiaUrl("equipo", clave);
                }}
              >
                Añadir y analizarlo
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            <Field
              label="Nombre del equipo"
              value={rivalNuevo}
              onChange={setRivalNuevo}
              placeholder="Ej.: Vitória SC"
              hint="Se queda guardado para todas las sesiones de coding."
            />

            {rivalesPropios.length > 0 && (
              <div>
                <span className="mb-1.5 block text-[10px] uppercase tracking-[0.16em] text-white/40">
                  Añadidos a mano
                </span>

                <div className="flex flex-wrap gap-1.5">
                  {rivalesPropios.map((uno) => (
                    <span
                      key={uno}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2 py-1 text-[11px] text-white/60"
                    >
                      {uno}

                      <button
                        type="button"
                        aria-label={`Quitar ${uno}`}
                        onClick={() =>
                          rivalesDoc.setValue((actual) => ({
                            nombres: (Array.isArray(actual?.nombres)
                              ? actual.nombres
                              : []
                            ).filter((otro) => otro !== uno),
                          }))
                        }
                        className="text-white/30 transition hover:text-red-300"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Dialog>
      )}

      {editando && (
        <FichaClip
          clip={editando}
          jugadores={jugadores}
          comportamientos={config.comportamientos}
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
