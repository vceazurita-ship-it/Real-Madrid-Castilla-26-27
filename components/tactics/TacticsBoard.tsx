"use client";

/**
 * Pizarra táctica.
 *
 * Es el único tablero de la aplicación: lo usan la pizarra táctica libre, las
 * fases del partido y la pizarra de cada rival. Todo lo que se añada aquí
 * aparece en las tres.
 *
 * El campo se dibuja en SVG sobre el espacio 100 x 68. La cámara
 * (`usePitchCamera`) lo inclina y lo gira desde fuera, y el reproductor
 * (`usePitchTimeline`) recorre las escenas interpolando las fichas.
 */

import {
  PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { apodo, descarga, descargaDataUrl, pdfDeHojas } from "@/lib/export/lienzos";
import { toast } from "sonner";
import {
  AlignHorizontalSpaceAround,
  AlignVerticalSpaceAround,
  ArrowLeft,
  ArrowRight,
  Building2,
  Circle,
  ClipboardCopy,
  Cone,
  Copy,
  Download,
  Eye,
  FileText,
  Film,
  Image as ImageIcon,
  Keyboard,
  Grid3x3,
  LayoutGrid,
  Mic,
  Plus,
  PersonStanding,
  Presentation,
  Rows3,
  Columns3,
  Repeat2,
  Tag,
  Trash2,
  X,
} from "lucide-react";

import type { Player } from "@/types/player";
import TacticsVoicePanel from "@/components/voice/TacticsVoicePanel";
import EntornoEstadio from "./EntornoEstadio";
import PitchMarkings from "./PitchMarkings";
import RivalPicker from "./RivalPicker";
import PitchStage from "./PitchStage";
import PitchCameraBar, { FollowSubject } from "./PitchCameraBar";
import PitchTimelineBar from "./PitchTimelineBar";
import PlayerFigure, { FigurasDefs, PlacaJugador, SueloFigura, medioFigura } from "./PlayerFigure";
import BoardToolPalette, { BOARD_TOOLS } from "./BoardToolPalette";
import BoardStyleBar from "./BoardStyleBar";
import Desplegable from "./Desplegable";
import { CambioJugador, type OpcionCambio } from "./CambioJugador";
import { planeDepth, usePitchCamera } from "@/hooks/usePitchCamera";
import { SEGMENT_MS, usePitchTimeline } from "@/hooks/usePitchTimeline";
import {
  freeSpot,
  RivalPick,
  RivalSquad,
  rivalSpot,
  rivalTokenId,
} from "@/lib/tactics/rivals";
import {
  EQUIPACIONES,
  FiguraMedidas,
  fotoFigura,
  medidasFigura,
  tieneFigura,
} from "@/lib/tactics/figuras";
import {
  Alineacion,
  alineaFichas,
  duplicateScene,
  emptyScene,
  interpolateTokens,
  pathFrom,
  rectFrom,
  tacticId,
  tramoSuave,
} from "@/lib/tactics/helpers";
import { ALTURA_LABEL, colocaDibujo, DIBUJOS, FASE_LABEL, type Altura, type Fase } from "@/lib/tactics/dibujos";
import {
  cargaFuentesLamina,
  codecLamina,
  FPS_LAMINA,
  imagenDelCampo,
  LAMINA_H,
  LAMINA_W,
  cargaEscudo,
  lienzoLamina,
  PALETA_LAMINA,
  pintaLamina,
  pintaLaminaVertical,
  pintaPortada,
  puedeHacerVideo,
  VERTICAL_H,
  VERTICAL_W,
  type DatosLamina,
} from "@/lib/tactics/lamina";
import {
  CROP_LABEL,
  CROP_VIEWBOX,
  DRAW_COLORS,
  LINE_DASH_ARRAY,
  LINE_WIDTHS,
  LineDash,
  PITCH_HEIGHT,
  PitchCrop,
  Point,
  TacticScene,
  TacticShape,
  TacticToken,
  TacticsDoc,
  TokenKind,
  ToolId,
} from "@/lib/tactics/types";
import { BalonOficial } from "@/components/tactics/BalonOficial";
import { CAMPOS, CAMPO_POR_DEFECTO } from "@/lib/tactics/campos";
import { creaPptx } from "@/lib/export/pptx";
import { MuxorMp4 } from "@/lib/coding/mp4";
import { separaParaExportar } from "@/lib/tactics/separa";
import { conTildes } from "@/lib/rivals/tildes";
import type { Bytes } from "@/lib/export/zip";
import { cn } from "@/lib/utils";

const TOKEN_STYLE: Record<
  TokenKind,
  { fill: string; stroke: string; text: string; radius: number }
> = {
  home: { fill: "#F8FAFC", stroke: "#0B0F14", text: "#0B0F14", radius: 2.4 },
  away: { fill: "#1E293B", stroke: "#F87171", text: "#FFFFFF", radius: 2.4 },
  ball: { fill: "#FDE68A", stroke: "#0B0F14", text: "#0B0F14", radius: 1.3 },
  cone: { fill: "#FB923C", stroke: "#0B0F14", text: "#0B0F14", radius: 1.5 },
};

/** Lo que hace falta saber de una persona para dibujar su figura. */
interface PerfilFisico {
  foto?: string;
  alturaCm?: number;
  pesoKg?: number;
  posicion?: string;
}

/** Rejilla del imán al arrastrar con Mayús, en metros del campo. */
const IMAN = 2.5;

/** Paso de las flechas del teclado con fichas elegidas (con Mayús, el largo). */
const PASO_CORTO = 0.5;
const PASO_LARGO = 2;

/**
 * Nombre cabido bajo una ficha.
 *
 * La hoja de scouting guarda el nombre completo ("A. Mayorga Miguel Bañuelos")
 * y bajo la figura eso son tres jugadores de ancho. Se queda el apellido, que
 * es como se le llama en la charla.
 *
 * Y en minúscula con su mayúscula (21/10/2026): la hoja de los rivales viene
 * en mayúsculas («JOSE CARLOS») y la nuestra no («Leiva»), así que en el
 * mismo campo unos gritaban y otros no, y los de mayúsculas tapaban el doble.
 */
function nombreCorto(nombre: string) {
  /* Con sus tildes (21/10/2026): la hoja de los rivales las pierde («Ivan Moreno»). */
  let limpio = conTildes(nombre).trim().replace(/\s+/g, " ");

  if (limpio && limpio === limpio.toUpperCase() && /[A-ZÁÉÍÓÚÑ]{2}/.test(limpio)) {
    limpio = limpio
      .toLowerCase()
      .replace(/(^|[\s.'-])(\p{L})/gu, (_, antes: string, letra: string) => antes + letra.toUpperCase());
  }

  if (limpio.length <= 12) return limpio;

  const partes = limpio.split(" ");
  const ultimo = partes[partes.length - 1];

  return ultimo.length <= 12 ? ultimo : `${limpio.slice(0, 11)}…`;
}

/** Nombre reducido a lo comparable: sin tildes, sin puntuación, en minúscula. */
function claveNombre(nombre?: string) {
  return String(nombre ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Texto del tooltip de una ficha.
 *
 * En modo jugador la figura habla de altura y peso sin poner un número: el
 * tooltip es donde se comprueba el dato exacto que la dibujó.
 */
function tituloFicha(
  token: TacticToken,
  perfil?: PerfilFisico,
  medidas?: FiguraMedidas
) {
  const base = token.nombre ?? token.label;

  if (!medidas) return base;

  const datos = [
    perfil?.posicion,
    medidas.alturaCm ? `${medidas.alturaCm} cm` : undefined,
    medidas.pesoKg ? `${medidas.pesoKg} kg` : undefined,
  ].filter(Boolean);

  return datos.length ? `${base} · ${datos.join(" · ")}` : base;
}

/** ¿Se está escribiendo en algún sitio? Ahí las teclas son del cuadro de texto. */
function escribiendo(target: EventTarget | null) {
  const nodo = target as HTMLElement | null;

  return Boolean(
    nodo &&
      (nodo.isContentEditable ||
        ["INPUT", "TEXTAREA", "SELECT"].includes(nodo.tagName))
  );
}

/** Copia lo que da el codificador a unos bytes propios. */
function copiaBytes(origen: AllowSharedBufferSource): Bytes {
  const vista = ArrayBuffer.isView(origen)
    ? new Uint8Array(origen.buffer, origen.byteOffset, origen.byteLength)
    : new Uint8Array(origen as ArrayBuffer);

  const salida = new Uint8Array(new ArrayBuffer(vista.byteLength));

  salida.set(vista);

  return salida as Bytes;
}

/** Espera a que React haya pintado lo último que se le ha pedido. */
function dosFotogramas() {
  return new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  );
}

type Formato = "png" | "copia" | "pdf" | "pptx" | "portada" | Destino;

/*
| LOS DESTINOS DEL VÍDEO (21/10/2026)
|
| Un solo MP4 de 1920 × 1080 no valía para todo: por WhatsApp pasa de 16 MB y
| se recomprime, y en el teléfono del jugador el campo apaisado se ve en una
| franja. Cada destino tiene su tamaño y su caudal, y el menú dice lo que va a
| pesar antes de pulsar.
*/
type Destino = "mp4" | "mp4-whatsapp" | "mp4-vertical";

const DESTINOS: Record<Destino, { ancho: number; alto: number; caudal: number; titulo: string; detalle: string }> = {
  mp4: { ancho: LAMINA_W, alto: LAMINA_H, caudal: 6_000_000, titulo: "Vídeo para la sala", detalle: "MP4 1920 × 1080, para proyectar" },
  "mp4-whatsapp": { ancho: 1280, alto: 720, caudal: 2_200_000, titulo: "Vídeo para WhatsApp", detalle: "MP4 1280 × 720: no pasa de 16 MB" },
  "mp4-vertical": { ancho: VERTICAL_W, alto: VERTICAL_H, caudal: 4_000_000, titulo: "Vídeo para el móvil", detalle: "MP4 vertical 1080 × 1920, el campo de pie" },
};

/** Lo que dura la portada del vídeo. */
const PORTADA_S = 2.5;

/** Los segundos que se sostiene una escena: lo que se tarda en leer su nota, entre 3 y 4. */
function lecturaDe(nota: string | undefined, ultima: boolean) {
  const palabras = (nota ?? "").trim().split(/\s+/).filter(Boolean).length;
  const segundos = Math.min(4, Math.max(3, 2.6 + palabras * 0.08));

  return ultima ? Math.max(3.5, segundos) : segundos;
}

/** Cuánto pesará el vídeo, en MB, con un 5 % del contenedor. */
function pesoVideoMb(destino: Destino, segundos: number) {
  return (DESTINOS[destino].caudal * segundos * 1.05) / 8 / 1_000_000;
}

const coma = (numero: number, decimales = 1) => numero.toFixed(decimales).replace(".", ",");

/** Un título que no dice nada: el que se pone solo al crear la pizarra. */
const tituloGenerico = (titulo: string) => /^\s*(pizarra( t[aá]ctica)?( \d+)?)?\s*(\(copia\))?\s*$/i.test(titulo);
const escenaGenerica = (nombre: string) => /^\s*(escena( \d+)?)?\s*$/i.test(nombre);

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

/** «2026-10-25» → «domingo 25/10». */
function diaDelPartido(fecha: string) {
  const [anio, mes, dia] = fecha.split("-").map(Number);

  if (!anio || !mes || !dia) return "";

  return `${DIAS[new Date(anio, mes - 1, dia, 12).getDay()]} ${dia}/${mes}`;
}

interface Props {
  doc: TacticsDoc;
  onChange: (doc: TacticsDoc) => void;
  /** Plantilla real, para añadir fichas con dorsal y nombre. */
  roster?: Player[];
  /** Plantillas rivales: cada dorsal se enciende o se apaga sobre el campo. */
  rivalSquads?: RivalSquad[];
  /** Equipo rival fijo: oculta el selector de equipo del panel de dorsales. */
  lockedRivalTeam?: string;
  /** Tablero de una sola escena: oculta la animación entre escenas. */
  singleScene?: boolean;
  /** Texto de ayuda bajo el tablero. */
  hint?: string;
  /** Abrir el campo ocupando la pantalla entera. Ver `PitchStage`. */
  aPantallaCompleta?: boolean;
  /** El próximo partido, para el pie de la lámina y la portada del vídeo. */
  partido?: { rival: string; fecha: string; lado?: "casa" | "fuera" };
}

export default function TacticsBoard({
  doc,
  onChange,
  roster = [],
  rivalSquads = [],
  lockedRivalTeam,
  singleScene = false,
  hint,
  aPantallaCompleta = false,
  partido,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const raizRef = useRef<HTMLDivElement>(null);

  /*
  | ¿Es éste el tablero con el que se está trabajando? En /pizarra hay dos en
  | la misma página (fase defensiva y ofensiva) y las teclas iban a los dos:
  | Espacio reproducía ambos. Manda el último en el que se ha pinchado.
  */
  const activo = useRef(true);

  useEffect(() => {
    const marca = (event: PointerEvent) => {
      activo.current = Boolean(raizRef.current?.contains(event.target as Node));
    };

    document.addEventListener("pointerdown", marca, true);

    return () => document.removeEventListener("pointerdown", marca, true);
  }, []);

  const [tool, setTool] = useState<ToolId>("select");
  const [color, setColor] = useState(DRAW_COLORS[0]);
  const [strokeWidth, setStrokeWidth] = useState<number>(LINE_WIDTHS[1]);
  const [dash, setDash] = useState<LineDash>("solid");

  const [sceneIndex, setSceneIndex] = useState(0);
  const [draft, setDraft] = useState<TacticShape | null>(null);

  /*
  |--------------------------------------------------------------------------
  | FICHAS ELEGIDAS (21/10/2026)
  |--------------------------------------------------------------------------
  |
  | Mover una línea de cuatro eran cuatro arrastres, y nunca quedaban a la
  | misma altura. Ahora se eligen varias —arrastrando un recuadro sobre el
  | césped vacío, o con Mayús y clic— y se mueven juntas, se alinean, se
  | reparten, se duplican o se borran de una vez.
  */
  const [elegidas, setElegidas] = useState<string[]>([]);
  const [recuadro, setRecuadro] = useState<{ a: Point; b: Point; suma: boolean } | null>(null);

  /** El arrastre en curso: de dónde salió cada ficha y el puntero. */
  const arrastre = useRef<{
    inicio: Point;
    agarrada: string;
    origen: Map<string, Point>;
    antes: TacticsDoc;
    movida: boolean;
    t: number;
    /** La ficha ya era la única elegida al pulsar: un toque abre el cambio. */
    yaElegida: boolean;
  } | null>(null);
  const [arrastrando, setArrastrando] = useState(false);

  /*
  | Pinchar una ficha sin arrastrarla ofrece cambiarla por otro de su equipo
  | (13/10/2026). Desde el 21/10/2026 el primer toque la elige y el segundo
  | abre el cambio: con el cambio al primer toque no había forma de elegir una
  | ficha para moverla con el teclado o borrarla sin que saltara la lista.
  */
  const [cambiando, setCambiando] = useState<string | null>(null);
  const [editingShape, setEditingShape] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  /* El vídeo vertical gira el campo un cuarto de vuelta: las fichas se giran al revés para que sus números se lean derechos. */
  const [fichasGiradas, setFichasGiradas] = useState(false);
  const [formato, setFormato] = useState<Formato | null>(null);
  const [progreso, setProgreso] = useState<string>("");
  const [dictating, setDictating] = useState(false);
  const [atajos, setAtajos] = useState(false);

  /** Escena e instante que se pintan para un fotograma exportado. */
  const [fotograma, setFotograma] = useState<{ index: number; t: number } | null>(null);

  const [follow, setFollow] = useState<FollowSubject>("ball");
  const [followId, setFollowId] = useState<string | null>(null);

  const [past, setPast] = useState<TacticsDoc[]>([]);
  const [future, setFuture] = useState<TacticsDoc[]>([]);

  /* El dibujo que se ofrece en «Colocar»: equipo, dónde y si va en escena nueva. */
  const [dibujoEquipo, setDibujoEquipo] = useState<"home" | "away">("home");
  const [dibujoAltura, setDibujoAltura] = useState<Altura>("medio");
  const [dibujoFase, setDibujoFase] = useState<Fase>("sin");
  const [dibujoNueva, setDibujoNueva] = useState(false);

  const scenes = doc.scenes;
  const safeIndex = Math.min(sceneIndex, scenes.length - 1);
  const scene = scenes[safeIndex] ?? emptyScene();

  // ---------------------------------------------------------------
  // Cómo se ve el campo
  // ---------------------------------------------------------------

  const campoActivo = doc.campo ?? CAMPO_POR_DEFECTO;

  /*
  | El estadio viene encendido en las pizarras nuevas y sólo se dibuja con la
  | perspectiva puesta: con el campo plano no hay nada que levantar —las vallas
  | se verían de canto, como cuatro rayas— y estorbaría al dibujo.
  */
  const entornoVisible = doc.entorno ?? true;

  /*
  | El modo jugador viene apagado: la pizarra sigue abriéndose con círculos,
  | que es lo que se quiere para explicar un repliegue sin que once muñecos
  | tapen las flechas. Se enciende cuando importa quién es quién.
  */
  const figurasVisibles = doc.figuras ?? false;

  const nombresVisibles = !doc.sinNombres;

  /* Prefijo de los degradados de las figuras: en /pizarra hay dos tableros en la misma página. */
  const prefijoFiguras = `pz${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;

  // ---------------------------------------------------------------
  // Fichas de las personas (modo jugador)
  // ---------------------------------------------------------------

  /**
   * Foto, altura y peso de cada jugador conocido, por ficha y por nombre.
   *
   * Las fichas guardan estos datos desde que se crean, pero las pizarras
   * montadas antes del modo jugador no los tienen, y el identificador de la
   * hoja se renumera de vez en cuando: por eso hay una segunda entrada por
   * nombre, que es lo único que no se mueve.
   */
  const { porFicha, porNombre } = useMemo(() => {
    const porFicha = new Map<string, PerfilFisico>();
    const porNombre = new Map<string, PerfilFisico>();

    const anota = (nombre: string | undefined, perfil: PerfilFisico) => {
      const clave = claveNombre(nombre);

      /* Gana el primero: la plantilla propia antes que un homónimo rival. */
      if (clave && !porNombre.has(clave)) porNombre.set(clave, perfil);
    };

    roster.forEach((player) => {
      const perfil: PerfilFisico = {
        foto: player.foto,
        posicion: player.posicion,
      };

      anota(player.apodo, perfil);
      anota(player.nombre, perfil);
    });

    rivalSquads.forEach((squad) =>
      squad.players.forEach((player) => {
        const perfil: PerfilFisico = {
          foto: player.foto,
          alturaCm: player.alturaCm,
          pesoKg: player.pesoKg,
          posicion: player.posicion,
        };

        porFicha.set(rivalTokenId(player.id), perfil);
        anota(player.nombre, perfil);
      })
    );

    return { porFicha, porNombre };
  }, [roster, rivalSquads]);

  /** Lo que la ficha guarda, completado con lo que se sepa del jugador. */
  const perfilDe = useCallback(
    (token: TacticToken): PerfilFisico => {
      const encontrado =
        porFicha.get(token.id) ?? porNombre.get(claveNombre(token.nombre));

      return {
        foto: token.foto ?? encontrado?.foto,
        alturaCm: token.alturaCm ?? encontrado?.alturaCm,
        pesoKg: token.pesoKg ?? encontrado?.pesoKg,
        posicion: token.posicion ?? encontrado?.posicion,
      };
    },
    [porFicha, porNombre]
  );

  // ---------------------------------------------------------------
  // Encuadre
  // ---------------------------------------------------------------

  /** `minX minY ancho alto` del recorte activo, ya en números. */
  const viewBox = useMemo(() => {
    const [minX, minY, width, height] = CROP_VIEWBOX[doc.crop]
      .split(" ")
      .map(Number);

    return { minX, minY, width, height };
  }, [doc.crop]);

  // ---------------------------------------------------------------
  // Reproductor
  // ---------------------------------------------------------------

  const timeline = usePitchTimeline(singleScene ? 1 : scenes.length);

  /** `true` mientras la jugada corre o se arrastra el cursor del tiempo. */
  const live = timeline.playing || timeline.scrubbing;

  /*
  | Con la jugada en marcha manda el reproductor; parada, la escena editada;
  | y al exportar un fotograma, el fotograma.
  */
  const displayIndex = fotograma
    ? Math.min(fotograma.index, scenes.length - 1)
    : live
      ? Math.min(timeline.index, scenes.length - 1)
      : safeIndex;
  const displayScene = scenes[displayIndex] ?? scene;
  const nextScene = scenes[displayIndex + 1];
  const tramo = fotograma ? fotograma.t : live ? timeline.t : 0;

  const visibleTokens = useMemo(() => {
    if ((!live && !fotograma) || !nextScene || tramo === 0) return displayScene.tokens;

    return interpolateTokens(
      displayScene.tokens,
      nextScene.tokens,
      tramoSuave(tramo)
    );
  }, [live, fotograma, nextScene, displayScene.tokens, tramo]);

  /** De dónde salió cada ficha que se está moviendo en este tramo. */
  const estelas = useMemo(() => {
    if ((!live && !fotograma) || !nextScene || tramo === 0) return [];

    const salida = new Map(displayScene.tokens.map((token) => [token.id, token]));

    return visibleTokens.flatMap((token) => {
      const desde = salida.get(token.id);

      if (!desde || Math.hypot(token.x - desde.x, token.y - desde.y) < 1.2) return [];

      return [{
        id: token.id,
        x1: desde.x,
        y1: desde.y,
        x2: token.x,
        y2: token.y,
        color: token.kind === "away" ? "#F87171" : token.kind === "ball" ? "#FDE68A" : "#F8FAFC",
      }];
    });
  }, [live, fotograma, nextScene, tramo, displayScene.tokens, visibleTokens]);

  /*
   * Mientras la jugada corre, la escena en edición sigue al reproductor: al
   * pausar se queda donde se paró, sin volver de golpe a la anterior.
   *
   * Es un ajuste en pleno render —el patrón que React recomienda para
   * sincronizar estado— y no un efecto, que dispararía un render en cascada
   * en cada keyframe.
   */
  if (timeline.playing && sceneIndex !== timeline.index) {
    setSceneIndex(timeline.index);
  }

  /*
  | Y al pararse, la escena es la más cercana al cursor (21/10/2026).
  |
  | El reproductor lleva la escena de PARTIDA del tramo: al terminar la jugada
  | iba por el último tramo, así que la pizarra se quedaba en la penúltima
  | escena y las fichas saltaban de vuelta desde donde acababan.
  */
  const [sonaba, setSonaba] = useState(false);

  if (sonaba !== timeline.playing) {
    setSonaba(timeline.playing);

    if (!timeline.playing && scenes.length > 1) {
      setSceneIndex(
        Math.min(scenes.length - 1, Math.max(0, Math.round(timeline.time / SEGMENT_MS)))
      );
    }
  }

  /** La siguiente escena, moviéndose: el «siguiente» de quien presenta. */
  const avanza = useCallback(() => {
    if (singleScene || scenes.length < 2) return;

    const desde = timeline.playing ? timeline.index : safeIndex;
    const destino = Math.min(scenes.length - 1, desde + 1);

    if (destino === desde) return;

    if (!timeline.playing) timeline.seekKeyframe(desde);

    timeline.playTo(destino);
  }, [safeIndex, scenes.length, singleScene, timeline]);

  const retrocede = useCallback(() => {
    if (singleScene || scenes.length < 2) return;

    const destino = Math.max(0, safeIndex - 1);

    timeline.stopAt(destino);
    setSceneIndex(destino);
  }, [safeIndex, scenes.length, singleScene, timeline]);

  // ---------------------------------------------------------------
  // Cámara
  // ---------------------------------------------------------------

  /** Ficha a la que se ancla el modo «Seguir». */
  const followToken = useMemo(() => {
    if (follow === "ball") {
      return visibleTokens.find((token) => token.kind === "ball") ?? null;
    }

    return visibleTokens.find((token) => token.id === followId) ?? null;
  }, [follow, followId, visibleTokens]);

  const followTarget = useMemo(() => {
    if (!followToken) return null;

    return {
      x: (followToken.x - viewBox.minX) / viewBox.width,
      y: (followToken.y - viewBox.minY) / viewBox.height,
    };
  }, [followToken, viewBox]);

  const camera = usePitchCamera({
    followTarget,
    // Al exportar el campo vuelve a plano, para que el PNG salga limpio.
    neutral: exporting,
  });

  const { unproject } = camera;

  /** Deja el punto dentro del encuadre visible, no solo dentro del campo. */
  const clampToView = useCallback(
    (point: Point): Point => ({
      x: Math.min(viewBox.minX + viewBox.width, Math.max(viewBox.minX, point.x)),
      y: Math.min(
        viewBox.minY + viewBox.height,
        Math.max(viewBox.minY, point.y)
      ),
    }),
    [viewBox]
  );

  /**
   * Coordenadas del puntero en el espacio del campo, ya des-proyectadas.
   *
   * Devuelve `null` si la cámara todavía no tiene medidas: antes se caía al
   * (0,0) y una ficha se iba de golpe a la esquina.
   */
  const toPitch = useCallback(
    (event: ReactPointerEvent): Point | null => {
      const point = unproject(event.clientX, event.clientY);
      if (!point) return null;

      return clampToView({
        x: viewBox.minX + point.x * viewBox.width,
        y: viewBox.minY + point.y * viewBox.height,
      });
    },
    [clampToView, unproject, viewBox]
  );

  /**
   * Cuánto hay que estirar las fichas para que se lean con el campo inclinado.
   *
   * La perspectiva aplasta el plano por el eje vertical; multiplicar por
   * 1/cos(tilt) deshace ese aplastamiento solo en las fichas, así que los
   * dorsales y los nombres siguen siendo redondos y legibles mientras el
   * césped, las flechas y las zonas se quedan tumbados donde les toca. El
   * tope evita que con la cámara casi a ras de suelo se vuelvan gigantes.
   */
  const tokenLift = useMemo(() => {
    if (camera.render !== "3d" || exporting) return 1;

    return Math.min(1 / Math.cos((camera.pose.tilt * Math.PI) / 180), 2.4);
  }, [camera.render, camera.pose.tilt, exporting]);

  /**
   * Cuánto hay que desgirar la ficha para que el dorsal se lea de pie.
   *
   * El giro de la cámara arrastra al dibujo entero, dorsales incluidos: desde
   * la portería —que gira el campo un cuarto de vuelta— los números salían
   * tumbados y había que ladear la cabeza para leer la pizarra. La ficha se
   * gira al revés que la cámara, así que el campo rota y los nombres no.
   */
  const tokenSpin = camera.render === "3d" && !exporting ? -camera.pose.yaw : 0;

  /**
   * Fichas ordenadas de lejos a cerca.
   *
   * El SVG pinta en el orden del documento, así que sin esto una ficha del
   * fondo podía taparse encima de otra que está en primer plano.
   */
  const paintedTokens = useMemo(() => {
    /* Al exportar van un 30 % más grandes: se abren lo justo para no montarse. */
    if (exporting) return separaParaExportar(visibleTokens, TOKEN_STYLE.home.radius * 2 * 1.3);

    if (camera.render !== "3d") return visibleTokens;

    const pose = camera.pose;

    return [...visibleTokens].sort(
      (a, b) => planeDepth(pose, a.x, a.y) - planeDepth(pose, b.x, b.y)
    );
  }, [camera.render, camera.pose, exporting, visibleTokens]);

  /** Las elegidas que siguen en la escena (una escena nueva no hereda nada raro). */
  const elegidasVivas = useMemo(() => {
    const ids = new Set(scene.tokens.map((token) => token.id));

    return elegidas.filter((id) => ids.has(id));
  }, [elegidas, scene.tokens]);

  const elegidasSet = useMemo(() => new Set(elegidasVivas), [elegidasVivas]);

  /** El gesto de cámara se ha llevado el puntero: no dejes nada a medias. */
  const cancelEditGesture = useCallback(() => {
    setDraft(null);
    setRecuadro(null);
    setArrastrando(false);
    arrastre.current = null;
  }, []);

  // ---------------------------------------------------------------
  // Historial
  // ---------------------------------------------------------------

  /** Aplica un cambio guardando el estado anterior para deshacer. */
  const commit = useCallback(
    (next: TacticsDoc) => {
      setPast((current) => [...current.slice(-40), doc]);
      setFuture([]);
      onChange(next);
    },
    [doc, onChange]
  );

  const updateScene = useCallback(
    (updater: (current: TacticScene) => TacticScene) => {
      commit({
        ...doc,
        scenes: doc.scenes.map((item, index) =>
          index === safeIndex ? updater(item) : item
        ),
      });
    },
    [commit, doc, safeIndex]
  );

  /** Un punto de deshacer sin cambiar nada todavía: lo que viene va sin historial. */
  const marcaDeshacer = useCallback(() => {
    setPast((current) => [...current.slice(-40), doc]);
    setFuture([]);
  }, [doc]);

  /** Cambia la escena actual sin pasar por el historial (cada letra, cada paso del arrastre). */
  const cambiaEscenaSinHistorial = useCallback(
    (updater: (current: TacticScene) => TacticScene) => {
      onChange({
        ...doc,
        scenes: doc.scenes.map((item, index) =>
          index === safeIndex ? updater(item) : item
        ),
      });
    },
    [doc, onChange, safeIndex]
  );

  const undo = useCallback(() => {
    const previous = past[past.length - 1];
    if (!previous) return;

    setPast((current) => current.slice(0, -1));
    setFuture((current) => [...current, doc]);
    onChange(previous);
  }, [past, doc, onChange]);

  const redo = useCallback(() => {
    const next = future[future.length - 1];
    if (!next) return;

    setFuture((current) => current.slice(0, -1));
    setPast((current) => [...current, doc]);
    onChange(next);
  }, [future, doc, onChange]);

  // ---------------------------------------------------------------
  // Acciones sobre las fichas elegidas
  // ---------------------------------------------------------------

  const borraElegidas = useCallback(() => {
    if (elegidasVivas.length === 0) return;

    const fuera = new Set(elegidasVivas);

    updateScene((current) => ({
      ...current,
      tokens: current.tokens.filter((token) => !fuera.has(token.id)),
    }));
    setElegidas([]);
  }, [elegidasVivas, updateScene]);

  /*
  | Duplicar crea fichas nuevas, con identificador propio: si copiaran el de
  | la original, la animación no sabría cuál de las dos es la que se mueve.
  */
  const duplicaElegidas = useCallback(() => {
    if (elegidasVivas.length === 0) return;

    const ids = new Set(elegidasVivas);
    const copias = scene.tokens
      .filter((token) => ids.has(token.id))
      .map((token) => {
        const sitio = clampToView({ x: token.x + 3, y: token.y + 3 });

        return { ...token, id: tacticId("token"), x: sitio.x, y: sitio.y };
      });

    updateScene((current) => ({ ...current, tokens: [...current.tokens, ...copias] }));
    setElegidas(copias.map((token) => token.id));
  }, [clampToView, elegidasVivas, scene.tokens, updateScene]);

  const alinea = useCallback(
    (modo: Alineacion) => {
      if (elegidasVivas.length < 2) return;

      updateScene((current) => ({
        ...current,
        tokens: alineaFichas(current.tokens, elegidasSet, modo),
      }));
    },
    [elegidasSet, elegidasVivas.length, updateScene]
  );

  const empuja = useCallback(
    (dx: number, dy: number) => {
      if (elegidasVivas.length === 0) return;

      updateScene((current) => ({
        ...current,
        tokens: current.tokens.map((token) => {
          if (!elegidasSet.has(token.id)) return token;

          const sitio = clampToView({ x: token.x + dx, y: token.y + dy });

          return { ...token, x: sitio.x, y: sitio.y };
        }),
      }));
    },
    [clampToView, elegidasSet, elegidasVivas.length, updateScene]
  );

  // ---------------------------------------------------------------
  // Teclado
  // ---------------------------------------------------------------

  /*
  | Ctrl/⌘+Z deshace y Ctrl/⌘+Y (o Mayús+Ctrl+Z) rehace (19/10/2026). No se
  | atiende mientras se escribe —un nombre de escena, un texto del campo, el
  | dictado—: ahí las teclas son del propio cuadro de texto.
  |
  | Desde el 21/10/2026, además: una letra por herramienta (V, A, P, L, F, Z,
  | T, E, C), Supr para borrar lo elegido, flechas para moverlo, Ctrl+D para
  | duplicarlo, Ctrl+A para elegir todo, y para presentar → / AvPág avanzan
  | la jugada moviéndose y ← / RePág vuelven (los mandos de presentación
  | mandan justo AvPág y RePág). Espacio reproduce o para.
  */
  const atajoHerramienta: Record<string, ToolId> = useMemo(
    () => ({ v: "select", c: "camera", a: "arrow", p: "dashed", l: "line", f: "free", z: "zone", t: "text", e: "erase" }),
    []
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!activo.current || escribiendo(event.target) || cambiando) return;

      /* La capa de la cámara tiene sus propias flechas. */
      const enCamara = (event.target as HTMLElement | null)?.getAttribute?.("role") === "application";

      const tecla = event.key.toLowerCase();
      const control = event.ctrlKey || event.metaKey;

      if (control && !event.altKey) {
        if (live) return;

        if (tecla === "z" && !event.shiftKey) {
          event.preventDefault();
          undo();
        } else if (tecla === "y" || (tecla === "z" && event.shiftKey)) {
          event.preventDefault();
          redo();
        } else if (tecla === "d" && elegidasVivas.length) {
          event.preventDefault();
          duplicaElegidas();
        } else if (tecla === "a") {
          event.preventDefault();
          setElegidas(scene.tokens.map((token) => token.id));
        }

        return;
      }

      if (event.altKey) return;

      if (event.key === "PageDown" || (event.key === "ArrowRight" && !elegidasVivas.length && !enCamara)) {
        event.preventDefault();
        avanza();
        return;
      }

      if (event.key === "PageUp" || (event.key === "ArrowLeft" && !elegidasVivas.length && !enCamara)) {
        event.preventDefault();
        retrocede();
        return;
      }

      if (event.key === " " && !singleScene) {
        if ((event.target as HTMLElement | null)?.tagName === "BUTTON") return;

        event.preventDefault();
        timeline.toggle();
        return;
      }

      if (live) return;

      if (event.key === "?") {
        setAtajos((valor) => !valor);
        return;
      }

      if ((event.key === "Delete" || event.key === "Backspace") && elegidasVivas.length) {
        event.preventDefault();
        borraElegidas();
        return;
      }

      if (event.key === "Escape" && elegidasVivas.length) {
        setElegidas([]);
        return;
      }

      if (elegidasVivas.length && !enCamara && event.key.startsWith("Arrow")) {
        const paso = event.shiftKey ? PASO_LARGO : PASO_CORTO;
        const movimiento: Record<string, [number, number]> = {
          ArrowLeft: [-paso, 0],
          ArrowRight: [paso, 0],
          ArrowUp: [0, -paso],
          ArrowDown: [0, paso],
        };

        const [dx, dy] = movimiento[event.key] ?? [0, 0];

        event.preventDefault();
        empuja(dx, dy);
        return;
      }

      const herramienta = !event.shiftKey ? atajoHerramienta[tecla] : undefined;

      if (herramienta) {
        setTool(herramienta);
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    atajoHerramienta,
    avanza,
    borraElegidas,
    cambiando,
    duplicaElegidas,
    elegidasVivas.length,
    empuja,
    live,
    redo,
    retrocede,
    scene.tokens,
    singleScene,
    timeline,
    undo,
  ]);

  // ---------------------------------------------------------------
  // Dibujo y recuadro de elección
  // ---------------------------------------------------------------

  function handlePointerDown(event: ReactPointerEvent<SVGSVGElement>) {
    if (live || exporting) return;
    if (tool === "erase" || tool === "camera") return;

    const point = toPitch(event);
    if (!point) return;

    svgRef.current?.setPointerCapture(event.pointerId);

    /* Con Mover, el césped vacío es para elegir arrastrando un recuadro. */
    if (tool === "select") {
      const suma = event.shiftKey || event.ctrlKey || event.metaKey;

      if (!suma) setElegidas([]);

      setRecuadro({ a: point, b: point, suma });
      return;
    }

    if (tool === "text") {
      const shape: TacticShape = {
        id: tacticId("shape"),
        tool: "text",
        color,
        points: [point],
        text: "",
        width: strokeWidth,
      };

      updateScene((current) => ({
        ...current,
        shapes: [...current.shapes, shape],
      }));

      setEditingShape(shape.id);
      return;
    }

    setDraft({
      id: tacticId("shape"),
      tool,
      color,
      points: [point, point],
      width: strokeWidth,
      dash: tool === "dashed" ? "dashed" : dash,
    });
  }

  function handlePointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    if (live) return;

    const point = toPitch(event);
    if (!point) return;

    const actual = arrastre.current;

    if (actual) {
      let dx = point.x - actual.inicio.x;
      let dy = point.y - actual.inicio.y;

      /* Con Mayús, la ficha agarrada cae en la rejilla y las demás la siguen. */
      if (event.shiftKey) {
        const base = actual.origen.get(actual.agarrada);

        if (base) {
          dx = Math.round((base.x + dx) / IMAN) * IMAN - base.x;
          dy = Math.round((base.y + dy) / IMAN) * IMAN - base.y;
        }
      }

      if (!actual.movida && Math.hypot(dx, dy) >= 0.8) actual.movida = true;

      cambiaEscenaSinHistorial((current) => ({
        ...current,
        tokens: current.tokens.map((token) => {
          const base = actual.origen.get(token.id);

          if (!base) return token;

          const sitio = clampToView({ x: base.x + dx, y: base.y + dy });

          return { ...token, x: sitio.x, y: sitio.y };
        }),
      }));

      return;
    }

    if (recuadro) {
      setRecuadro({ ...recuadro, b: point });
      return;
    }

    if (!draft) return;

    setDraft((current) => {
      if (!current) return current;

      if (current.tool === "free") {
        const last = current.points[current.points.length - 1];
        const far = Math.hypot(point.x - last.x, point.y - last.y) > 0.6;

        return far
          ? { ...current, points: [...current.points, point] }
          : current;
      }

      return { ...current, points: [current.points[0], point] };
    });
  }

  function handlePointerUp(event: ReactPointerEvent<SVGSVGElement>) {
    svgRef.current?.releasePointerCapture(event.pointerId);

    const actual = arrastre.current;

    if (actual) {
      arrastre.current = null;
      setArrastrando(false);

      const ficha = scene.tokens.find((token) => token.id === actual.agarrada);

      /* Un toque, no un arrastre: el segundo toque ofrece el cambio de jugador. */
      if (!actual.movida) {
        if (
          actual.yaElegida &&
          ficha &&
          (ficha.kind === "home" || ficha.kind === "away") &&
          event.timeStamp - actual.t < 600
        ) {
          setCambiando(ficha.id);
        }

        return;
      }

      /*
      | El arrastre ya escribió posiciones; guardamos un punto de deshacer con
      | el tablero de ANTES de agarrar (19/10/2026): `doc` a estas alturas ya
      | es el de después.
      */
      if (actual.antes !== doc) {
        setPast((current) => [...current.slice(-40), actual.antes]);
        setFuture([]);
      }

      return;
    }

    if (recuadro) {
      const { a, b, suma } = recuadro;

      setRecuadro(null);

      if (Math.hypot(b.x - a.x, b.y - a.y) < 0.8) return;

      const [x0, x1] = [Math.min(a.x, b.x), Math.max(a.x, b.x)];
      const [y0, y1] = [Math.min(a.y, b.y), Math.max(a.y, b.y)];

      const dentro = scene.tokens
        .filter((token) => token.x >= x0 && token.x <= x1 && token.y >= y0 && token.y <= y1)
        .map((token) => token.id);

      setElegidas((antes) => (suma ? [...new Set([...antes, ...dentro])] : dentro));

      return;
    }

    if (!draft) return;

    const [first, last] = [draft.points[0], draft.points[draft.points.length - 1]];
    const tiny = Math.hypot(last.x - first.x, last.y - first.y) < 1.2;

    if (!tiny || draft.tool === "free") {
      updateScene((current) => ({
        ...current,
        shapes: [...current.shapes, draft],
      }));
    }

    setDraft(null);
  }

  /** Pulsar una ficha con Mover: elegirla y, si se arrastra, moverla (con las demás elegidas). */
  function agarraFicha(event: ReactPointerEvent, token: TacticToken) {
    const point = toPitch(event);
    if (!point) return;

    event.stopPropagation();

    // La última ficha tocada es la que persigue la cámara.
    if (token.kind !== "ball") setFollowId(token.id);

    const suma = event.shiftKey || event.ctrlKey || event.metaKey;

    if (suma) {
      setElegidas((antes) =>
        antes.includes(token.id) ? antes.filter((id) => id !== token.id) : [...antes, token.id]
      );

      return;
    }

    const yaElegida = elegidasVivas.length === 1 && elegidasVivas[0] === token.id;
    const grupo = elegidasSet.has(token.id) ? elegidasVivas : [token.id];

    if (!elegidasSet.has(token.id)) setElegidas([token.id]);

    const origen = new Map<string, Point>();

    scene.tokens.forEach((ficha) => {
      if (grupo.includes(ficha.id)) origen.set(ficha.id, { x: ficha.x, y: ficha.y });
    });

    svgRef.current?.setPointerCapture(event.pointerId);

    arrastre.current = {
      inicio: point,
      agarrada: token.id,
      origen,
      antes: doc,
      movida: false,
      t: event.timeStamp,
      yaElegida,
    };
    setArrastrando(true);
  }

  // ---------------------------------------------------------------
  // Fichas
  // ---------------------------------------------------------------

  const addToken = (kind: TokenKind, player?: Player) => {
    const count = scene.tokens.filter((token) => token.kind === kind).length;

    const token: TacticToken = {
      id: tacticId("token"),
      kind,
      label: player
        ? String(player.dorsal ?? (player.apodo ?? player.nombre).slice(0, 2))
        : kind === "ball"
        ? ""
        : String(count + 1),
      nombre: player ? player.apodo || player.nombre : undefined,
      /* Para el modo jugador; la hoja de la plantilla no trae altura ni peso. */
      foto: player?.foto,
      posicion: player?.posicion,
      x: kind === "away" ? 68 : kind === "home" ? 32 : 50,
      y: 10 + (count % 9) * 6,
    };

    commit({
      ...doc,
      scenes: doc.scenes.map((item, index) =>
        index === safeIndex
          ? { ...item, tokens: [...item.tokens, token] }
          : item
      ),
    });

    setElegidas([token.id]);
  };

  /** Coloca a un equipo en un dibujo, en esta escena o en una nueva para animar el cambio. */
  const colocaEquipo = (dibujo: string) => {
    const base = dibujoNueva && !singleScene ? duplicateScene(scene, `${dibujo}`) : scene;
    const { tokens, movidas, creadas } = colocaDibujo(base.tokens, dibujoEquipo, dibujo, dibujoAltura, dibujoFase);

    const equipo = dibujoEquipo === "home" ? "Nosotros" : "El rival";

    if (dibujoNueva && !singleScene) {
      commit({ ...doc, scenes: [...scenes.slice(0, safeIndex + 1), { ...base, tokens }, ...scenes.slice(safeIndex + 1)] });
      setSceneIndex(safeIndex + 1);
    } else {
      updateScene((current) => ({ ...current, tokens }));
    }

    toast.success(`${equipo} en ${dibujo} · ${ALTURA_LABEL[dibujoAltura].toLowerCase()}, ${FASE_LABEL[dibujoFase].toLowerCase()}`, {
      description: creadas
        ? `${creadas} fichas puestas. Se puede deshacer.`
        : `${movidas} ${movidas === 1 ? "ficha recolocada" : "fichas recolocadas"}, cada una al puesto más cercano. Se puede deshacer.`,
    });
  };

  /* ---------------------------------------------------------------
     Cambiar una ficha por otro jugador de su equipo
     --------------------------------------------------------------- */

  const claveNombreDe = (nombre?: string) => claveNombre(nombre);

  /** Su equipo: la plantilla del rival que tenga alguna de las fichas rivales del campo, o la fijada. */
  const squadDelCampo = useMemo(() => {
    const ids = new Set(scene.tokens.filter((t) => t.kind === "away").map((t) => t.id));

    return (
      rivalSquads.find((squad) => squad.players.some((p) => ids.has(rivalTokenId(p.id)))) ??
      rivalSquads.find((squad) => squad.equipo === lockedRivalTeam) ??
      null
    );
  }, [rivalSquads, scene.tokens, lockedRivalTeam]);

  const cambio = useMemo(() => {
    const ficha = cambiando ? scene.tokens.find((t) => t.id === cambiando) : null;

    if (!ficha) return null;

    if (ficha.kind === "home") {
      const enCampo = new Set(scene.tokens.filter((t) => t.kind === "home").map((t) => claveNombre(t.nombre)));
      const opciones: OpcionCambio[] = roster
        /* Toda la plantilla, también RMC y Juvenil A (14/10/2026): sólo con la licencia del Castilla faltaban 21. */
        .filter((p) => p.activo !== false)
        .map((p) => ({ id: p.id, nombre: p.apodo || p.nombre, dorsal: p.dorsal ? String(p.dorsal) : "", posicion: p.posicion, foto: p.foto, enCampo: enCampo.has(claveNombre(p.apodo || p.nombre)) }))
        .filter((o) => claveNombre(o.nombre) !== claveNombre(ficha.nombre));

      return { ficha, equipo: "Real Madrid Castilla", opciones };
    }

    if (!squadDelCampo) return { ficha, equipo: "Rival", opciones: [] as OpcionCambio[] };

    const enCampo = new Set(scene.tokens.map((t) => t.id));
    const opciones: OpcionCambio[] = squadDelCampo.players
      .filter((p) => rivalTokenId(p.id) !== ficha.id)
      .map((p) => ({ id: p.id, nombre: p.nombre, dorsal: p.dorsal, posicion: p.posicion, foto: p.foto, enCampo: enCampo.has(rivalTokenId(p.id)) }));

    return { ficha, equipo: squadDelCampo.equipo, opciones };
  }, [cambiando, scene.tokens, roster, squadDelCampo]);

  /** Mete al elegido en el sitio de la ficha, en todas las escenas; si ya estaba en el campo, se intercambian los sitios. */
  const aplicaCambio = (ficha: TacticToken, id: string) => {
    if (ficha.kind === "home") {
      const p = roster.find((x) => x.id === id);

      if (!p) return;

      const nombre = p.apodo || p.nombre;
      const datos = { label: p.dorsal ? String(p.dorsal) : ficha.label, nombre, foto: p.foto, posicion: p.posicion, alturaCm: undefined, pesoKg: undefined };

      commit({
        ...doc,
        scenes: doc.scenes.map((s) => {
          const otra = s.tokens.find((t) => t.kind === "home" && t.id !== ficha.id && claveNombreDe(t.nombre) === claveNombreDe(nombre));
          const actual = s.tokens.find((t) => t.id === ficha.id);

          return {
            ...s,
            tokens: s.tokens.map((t) => {
              if (t.id === ficha.id) return { ...t, ...datos };
              if (otra && t.id === otra.id && actual) return { ...t, label: actual.label, nombre: actual.nombre, foto: actual.foto, posicion: actual.posicion, alturaCm: actual.alturaCm, pesoKg: actual.pesoKg };

              return t;
            }),
          };
        }),
      });

      return;
    }

    const p = squadDelCampo?.players.find((x) => x.id === id);

    if (!p) return;

    const nuevoId = rivalTokenId(p.id);

    commit({
      ...doc,
      scenes: doc.scenes.map((s) => {
        const actual = s.tokens.find((t) => t.id === ficha.id);
        const otra = s.tokens.find((t) => t.id === nuevoId);

        /* Ya estaba: se cambian de sitio. */
        if (actual && otra) {
          return { ...s, tokens: s.tokens.map((t) => (t.id === ficha.id ? { ...t, x: otra.x, y: otra.y } : t.id === nuevoId ? { ...t, x: actual.x, y: actual.y } : t)) };
        }

        return {
          ...s,
          tokens: s.tokens.map((t) =>
            t.id === ficha.id
              ? { ...t, id: nuevoId, label: p.dorsal || p.nombre.slice(0, 2).toUpperCase(), nombre: p.nombre, foto: p.foto, alturaCm: p.alturaCm, pesoKg: p.pesoKg, posicion: p.posicion }
              : t,
          ),
        };
      }),
    });

    /* La ficha ha cambiado de identificador: se elige la nueva. */
    setElegidas([nuevoId]);
  };

  const removeToken = (tokenId: string) =>
    updateScene((current) => ({
      ...current,
      tokens: current.tokens.filter((token) => token.id !== tokenId),
    }));

  const removeShape = (shapeId: string) =>
    updateScene((current) => ({
      ...current,
      shapes: current.shapes.filter((shape) => shape.id !== shapeId),
    }));

  // ---------------------------------------------------------------
  // Dorsales rivales
  // ---------------------------------------------------------------

  /** Los rivales de la hoja que ya están sobre la escena actual. */
  const rivalIds = useMemo(() => {
    const ids = new Set(scene.tokens.map((token) => token.id));

    return rivalSquads
      .flatMap((squad) => squad.players)
      .filter((player) => ids.has(rivalTokenId(player.id)))
      .map((player) => player.id);
  }, [rivalSquads, scene.tokens]);

  /*
  | El panel de dorsales arranca plegado (21/10/2026): desplegado son dos filas
  | que empujan el campo media pantalla. En la pizarra de un rival, que es
  | para eso, se abre si todavía no hay ninguno de los suyos en el campo.
  */
  const [rivalesAbiertos] = useState(() => !scene.tokens.some((token) => token.kind === "away"));

  /** Enciende o apaga el dorsal: segunda pulsación, ficha fuera. */
  const toggleRival = (player: RivalPick) => {
    const id = rivalTokenId(player.id);

    if (scene.tokens.some((token) => token.id === id)) {
      updateScene((current) => ({
        ...current,
        tokens: current.tokens.filter((token) => token.id !== id),
      }));

      return;
    }

    const spot = freeSpot(rivalSpot(player.posicion), scene.tokens);

    const token: TacticToken = {
      id,
      kind: "away",
      label: player.dorsal || player.nombre.slice(0, 2).toUpperCase(),
      nombre: player.nombre,
      foto: player.foto,
      alturaCm: player.alturaCm,
      pesoKg: player.pesoKg,
      posicion: player.posicion,
      x: spot.x,
      y: spot.y,
    };

    updateScene((current) => ({
      ...current,
      tokens: [...current.tokens, token],
    }));
  };

  /** Dorsal suelto, para un rival que todavía no está en la hoja. */
  const addRivalNumber = (label: string) => {
    const spot = freeSpot({ x: 72, y: PITCH_HEIGHT / 2 }, scene.tokens);

    updateScene((current) => ({
      ...current,
      tokens: [
        ...current.tokens,
        { id: tacticId("token"), kind: "away", label, x: spot.x, y: spot.y },
      ],
    }));
  };

  const clearRivals = () =>
    updateScene((current) => ({
      ...current,
      tokens: current.tokens.filter((token) => token.kind !== "away"),
    }));

  // ---------------------------------------------------------------
  // Escenas
  // ---------------------------------------------------------------

  /** Duplica la escena actual justo detrás de ella (no al final). */
  const addScene = () => {
    const next = duplicateScene(scene, `Escena ${scenes.length + 1}`);

    commit({ ...doc, scenes: [...scenes.slice(0, safeIndex + 1), next, ...scenes.slice(safeIndex + 1)] });
    setSceneIndex(safeIndex + 1);
    timeline.stopAt(safeIndex + 1);
  };

  const addEmptyScene = () => {
    commit({
      ...doc,
      scenes: [...scenes.slice(0, safeIndex + 1), emptyScene(`Escena ${scenes.length + 1}`), ...scenes.slice(safeIndex + 1)],
    });
    setSceneIndex(safeIndex + 1);
    timeline.stopAt(safeIndex + 1);
  };

  const removeScene = (index: number) => {
    if (scenes.length <= 1) return;

    commit({ ...doc, scenes: scenes.filter((_, i) => i !== index) });
    setSceneIndex(Math.max(0, index - 1));
  };

  /** Mueve la escena actual un puesto antes o después en la jugada. */
  const mueveEscena = (paso: -1 | 1) => {
    const destino = safeIndex + paso;

    if (destino < 0 || destino >= scenes.length) return;

    const copia = [...scenes];
    const [quitada] = copia.splice(safeIndex, 1);

    copia.splice(destino, 0, quitada);
    commit({ ...doc, scenes: copia });
    setSceneIndex(destino);
    timeline.stopAt(destino);
  };

  // ---------------------------------------------------------------
  // Dictado
  // ---------------------------------------------------------------

  /**
   * Vuelca en la pizarra las escenas dictadas.
   *
   * Pasa por `commit`, así que un dictado que no convenza se deshace con la
   * misma flecha que cualquier otro cambio.
   */
  const applyVoice = ({
    scenes: dictated,
    crop,
    mode,
  }: {
    scenes: TacticScene[];
    crop?: PitchCrop;
    mode: "append" | "replace";
  }) => {
    if (dictated.length === 0) return;

    const next = { ...doc, crop: crop ?? doc.crop };

    /* Tablero de una sola escena: el dictado ocupa la que hay. */
    if (singleScene) {
      const [first] = dictated;

      commit({
        ...next,
        scenes: doc.scenes.map((item, index) =>
          index === safeIndex
            ? { ...item, tokens: first.tokens, shapes: first.shapes }
            : item
        ),
      });

      setSceneIndex(safeIndex);
      return;
    }

    if (mode === "replace") {
      commit({ ...next, scenes: dictated });
      setSceneIndex(0);
      return;
    }

    commit({ ...next, scenes: [...doc.scenes, ...dictated] });
    setSceneIndex(doc.scenes.length);
  };

  // ---------------------------------------------------------------
  // Exportar: PNG, copia, PDF, PowerPoint y vídeo
  // ---------------------------------------------------------------

  /** Quién es quién en la lámina: sólo los equipos que salen en la jugada. */
  const rivalDelCampo = squadDelCampo?.equipo ?? lockedRivalTeam ?? partido?.rival;

  const leyenda = useMemo(() => {
    const hay = (kind: TokenKind) => scenes.some((s) => s.tokens.some((token) => token.kind === kind));
    const items: DatosLamina["leyenda"] = [];

    if (hay("home")) items.push({ color: TOKEN_STYLE.home.fill, borde: TOKEN_STYLE.home.stroke, texto: "Nosotros · Real Madrid Castilla" });
    if (hay("away")) items.push({ color: TOKEN_STYLE.away.fill, borde: TOKEN_STYLE.away.stroke, texto: rivalDelCampo ? `Rival · ${rivalDelCampo}` : "Rival" });

    return items;
  }, [rivalDelCampo, scenes]);

  /*
  | EL TÍTULO DE LO QUE SALE (21/10/2026)
  |
  | «Pizarra 2» encabezaba la lámina, el PDF, el PowerPoint y el nombre del
  | fichero. Si la pizarra no tiene un nombre propio, lo que se exporta sale
  | con uno que dice de qué va —el rival y la primera escena con nombre— y el
  | menú avisa de que conviene ponerle el suyo.
  */
  const sinTitulo = tituloGenerico(doc.titulo ?? "");

  const tituloPropuesto = useMemo(() => {
    const escena = scenes.find((s) => !escenaGenerica(s.nombre ?? ""))?.nombre?.trim();
    const partes = [rivalDelCampo, escena].filter(Boolean) as string[];

    return partes.length ? partes.join(" · ") : "Pizarra táctica";
  }, [rivalDelCampo, scenes]);

  const tituloDeSalida = sinTitulo ? tituloPropuesto : doc.titulo;

  const pie = partido
    ? `RMCF Castilla · ${partido.rival} · ${partido.fecha.split("-").reverse().join("/")}`
    : undefined;

  const datosDe = useCallback(
    (indice: number): DatosLamina => ({
      titulo: tituloDeSalida,
      escena: scenes[indice]?.nombre ?? "",
      indice,
      total: singleScene ? 1 : scenes.length,
      nota: scenes[indice]?.nota,
      leyenda,
      pie,
    }),
    [tituloDeSalida, leyenda, pie, scenes, singleScene]
  );

  /** Pinta el fotograma pedido y devuelve el campo hecho imagen. */
  const campoDe = useCallback(async (indice: number, t: number) => {
    setFotograma({ index: indice, t });
    await dosFotogramas();

    const svg = svgRef.current;

    if (!svg) throw new Error("No hay campo que exportar");

    return imagenDelCampo(svg, 1800);
  }, []);

  /** Pinta el fotograma pedido y lo devuelve hecho lámina. */
  const laminaDe = useCallback(
    async (indice: number, t: number, ctx: CanvasRenderingContext2D, familia: string, datos: DatosLamina, sinTextos = false) =>
      pintaLamina(ctx, await campoDe(indice, t), datos, familia, { sinTextos }),
    [campoDe]
  );

  const nombreFichero = apodo(tituloDeSalida || "pizarra", "pizarra");

  /** Lo que dura el vídeo: la portada, cada escena leída y cada tramo de movimiento. */
  const duracionVideo = useMemo(() => {
    const lectura = scenes.reduce((suma, escena, indice) => suma + lecturaDe(escena.nota, indice === scenes.length - 1), 0);

    return PORTADA_S + lectura + Math.max(0, scenes.length - 1) * (SEGMENT_MS / 1000);
  }, [scenes]);

  const portadaDe = useCallback(
    (): Parameters<typeof pintaPortada>[3] => ({
      titulo: tituloDeSalida,
      partido: partido ? `Contra ${partido.rival} · ${diaDelPartido(partido.fecha)}${partido.lado === "casa" ? " · en casa" : partido.lado === "fuera" ? " · fuera" : ""}` : rivalDelCampo ? `Contra ${rivalDelCampo}` : undefined,
      detalle: singleScene ? undefined : `${scenes.length} ${scenes.length === 1 ? "escena" : "escenas"}`,
    }),
    [partido, rivalDelCampo, scenes.length, singleScene, tituloDeSalida]
  );

  const exporta = async (que: Formato) => {
    if (formato) return;

    timeline.pause();
    setFormato(que);
    setExporting(true);
    setEditingShape(null);

    const esVideo = que === "mp4" || que === "mp4-whatsapp" || que === "mp4-vertical";

    const aviso = toast.loading(
      esVideo ? "Montando el vídeo…" : que === "pptx" ? "Montando el PowerPoint…" : que === "pdf" ? "Montando el PDF…" : "Preparando la imagen…"
    );

    try {
      const familia = await cargaFuentesLamina();

      /* Un par de fotogramas para que la cámara ya esté en reposo y el campo plano. */
      await dosFotogramas();

      const { lienzo, ctx } = lienzoLamina();

      if (que === "portada") {
        pintaPortada(ctx, LAMINA_W, LAMINA_H, portadaDe(), familia, await cargaEscudo());
        await descargaDataUrl(lienzo.toDataURL("image/jpeg", 0.9), `${nombreFichero}-portada.jpg`);
        toast.success("Portada descargada: la imagen para el correo o el enlace del vídeo", { id: aviso });

        return;
      }

      if (que === "png" || que === "copia") {
        await laminaDe(safeIndex, 0, ctx, familia, datosDe(safeIndex));

        if (que === "copia") {
          const blob = await new Promise<Blob | null>((resolve) => lienzo.toBlob(resolve, "image/png"));

          if (!blob || typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) {
            throw new Error("El navegador no deja copiar imágenes");
          }

          await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
          toast.success("Escena copiada: pégala en WhatsApp o en el correo", { id: aviso });
        } else {
          await descargaDataUrl(lienzo.toDataURL("image/png"), `${nombreFichero}-${apodo(scene.nombre, "escena")}.png`);
          toast.success("Imagen descargada", { id: aviso });
        }

        return;
      }

      const indices = singleScene ? [safeIndex] : scenes.map((_, indice) => indice);

      if (que === "pdf" || que === "pptx") {
        const hojas: { imagen: string; textos: Awaited<ReturnType<typeof laminaDe>> }[] = [];

        for (const indice of indices) {
          setProgreso(`${hojas.length + 1} / ${indices.length}`);

          const textos = await laminaDe(indice, 0, ctx, familia, datosDe(indice), que === "pptx");

          hojas.push({ imagen: lienzo.toDataURL("image/jpeg", 0.92), textos });
        }

        if (que === "pdf") {
          /* A sangre: la banda azul llega al borde de la hoja, como la lámina. */
          const pdf = await pdfDeHojas(
            hojas.map((hoja) => ({
              imagen: hoja.imagen,
              ancho: LAMINA_W,
              alto: LAMINA_H,
              orientacion: "landscape" as const,
              margen: 0,
              bandas: { arriba: PALETA_LAMINA.azul, abajo: PALETA_LAMINA.papel },
            }))
          );

          pdf.save(`${nombreFichero}.pdf`);
          toast.success(`PDF listo · ${hojas.length} ${hojas.length === 1 ? "hoja" : "hojas"}`, { id: aviso });
        } else {
          const blob = creaPptx(
            hojas.map((hoja, indice) => ({
              titulo: scenes[indices[indice]]?.nombre ?? `Escena ${indice + 1}`,
              imagen: hoja.imagen,
              capas: hoja.textos.map((texto) => ({ nombre: texto.nombre, texto: texto.texto, ...texto.capa })),
            })),
            { titulo: tituloDeSalida, autor: "RMCF Castilla", aplicacion: "Pizarra táctica" }
          );

          descarga(blob, `${nombreFichero}.pptx`);
          toast.success(`PowerPoint listo · ${hojas.length} ${hojas.length === 1 ? "diapositiva" : "diapositivas"}, con los textos editables`, { id: aviso });
        }

        return;
      }

      /* ------------------------------------------------ el vídeo */

      const destino = DESTINOS[que];
      const vertical = que === "mp4-vertical";
      const codec = await codecLamina(destino.ancho, destino.alto, destino.caudal);

      if (!codec) throw new Error("Este navegador no sabe montar vídeo. Prueba con Chrome o Edge.");

      /* El lienzo del vídeo: el de la lámina, el vertical o el de 720p (que se pinta reducido). */
      const salida = vertical || que === "mp4-whatsapp" ? document.createElement("canvas") : lienzo;

      salida.width = destino.ancho;
      salida.height = destino.alto;

      const ctxSalida = salida === lienzo ? ctx : salida.getContext("2d");

      if (vertical) {
        setFichasGiradas(true);
        await dosFotogramas();
      }

      if (!ctxSalida) throw new Error("El navegador no da un lienzo 2D");

      let fallo: Error | null = null;
      const muxor = new MuxorMp4();
      const codificador = new VideoEncoder({
        output: (trozo, metadatos) => {
          const descripcion = metadatos?.decoderConfig?.description;

          if (descripcion) muxor.configuraVideo({ ancho: destino.ancho, alto: destino.alto, descripcion: copiaBytes(descripcion) });

          const datos = new Uint8Array(new ArrayBuffer(trozo.byteLength));

          trozo.copyTo(datos);
          muxor.añadeVideo(datos as Bytes, Math.max(0, trozo.timestamp), trozo.duration || 1_000_000 / FPS_LAMINA, trozo.type === "key");
        },
        error: (e) => {
          fallo = e instanceof Error ? e : new Error(String(e));
        },
      });

      codificador.configure({
        codec,
        width: destino.ancho,
        height: destino.alto,
        bitrate: destino.caudal,
        framerate: FPS_LAMINA,
        latencyMode: "quality",
        avc: { format: "avc" },
      });

      /*
      | Guion del vídeo (21/10/2026): la portada (título, escudo y contra
      | quién), y luego cada escena quieta de 3 a 4 s —lo que se tarda en leer
      | su nota— y el movimiento hasta la siguiente en 1,5 s con su estela. La
      | nota y el número de escena cambian al llegar, no al salir: lo que se
      | lee es lo que se ve.
      */
      const porTramo = Math.round((SEGMENT_MS / 1000) * FPS_LAMINA);
      const plan: ({ portada: true } | { portada?: false; index: number; t: number; rotulo: number })[] = [];

      for (let k = 0; k < Math.round(PORTADA_S * FPS_LAMINA); k += 1) plan.push({ portada: true });

      for (let indice = 0; indice < scenes.length; indice += 1) {
        const quieta = Math.round(lecturaDe(scenes[indice]?.nota, indice === scenes.length - 1) * FPS_LAMINA);

        for (let k = 0; k < quieta; k += 1) plan.push({ index: indice, t: 0, rotulo: indice });

        if (indice === scenes.length - 1) break;

        for (let k = 1; k < porTramo; k += 1) {
          const t = k / porTramo;

          plan.push({ index: indice, t, rotulo: t >= 0.86 ? indice + 1 : indice });
        }
      }

      const escudoImg = await cargaEscudo();
      let previo = "";

      for (let k = 0; k < plan.length; k += 1) {
        if (fallo) throw fallo;

        const paso = plan[k];
        const clave = paso.portada ? "portada" : `${paso.index}|${paso.t}|${paso.rotulo}`;

        /* Los fotogramas quietos se repiten sin volver a pintar. */
        if (clave !== previo) {
          if (paso.portada) {
            pintaPortada(ctxSalida, destino.ancho, destino.alto, portadaDe(), familia, escudoImg);
          } else if (vertical) {
            pintaLaminaVertical(ctxSalida, await campoDe(paso.index, paso.t), datosDe(paso.rotulo), familia);
          } else {
            await laminaDe(paso.index, paso.t, ctx, familia, datosDe(paso.rotulo));

            if (salida !== lienzo) ctxSalida.drawImage(lienzo, 0, 0, destino.ancho, destino.alto);
          }

          previo = clave;
        }

        const cuadro = new VideoFrame(salida, { timestamp: Math.round((k * 1_000_000) / FPS_LAMINA), duration: Math.round(1_000_000 / FPS_LAMINA) });

        codificador.encode(cuadro, { keyFrame: k % (FPS_LAMINA * 2) === 0 });
        cuadro.close();

        if (k % 10 === 0) setProgreso(`${Math.round((k / plan.length) * 100)} %`);

        while (codificador.encodeQueueSize > 6) await new Promise((resolve) => setTimeout(resolve, 5));
      }

      await codificador.flush();
      codificador.close();

      if (fallo) throw fallo;

      const fichero = muxor.cierra();
      const sufijo = que === "mp4-whatsapp" ? "-whatsapp" : vertical ? "-movil" : "";

      descarga(fichero, `${nombreFichero}${sufijo}.mp4`);

      toast.success(`Vídeo listo · ${coma(plan.length / FPS_LAMINA)} s · ${coma(fichero.size / 1_000_000)} MB · ${destino.ancho} × ${destino.alto}`, { id: aviso });
    } catch (error) {
      console.error("[pizarra] exportación", error);
      toast.error(error instanceof Error && error.message ? error.message : "No se ha podido exportar", { id: aviso });
    } finally {
      setFotograma(null);
      setFichasGiradas(false);
      setExporting(false);
      setFormato(null);
      setProgreso("");
    }
  };

  const canUndo = past.length > 0;
  const canRedo = future.length > 0;

  const clearScene = () => {
    updateScene((current) => ({ ...current, tokens: [], shapes: [] }));
    setElegidas([]);
  };

  /**
   * Hay una herramienta de dibujo en la mano.
   *
   * Decide qué se ve: el estilo del trazo mientras se dibuja y, el resto del
   * tiempo, nada encima del césped (21/10/2026: la barra del estilo flotaba
   * siempre sobre la esquina de abajo y tapaba al lateral).
   */
  const drawing = tool !== "select" && tool !== "erase" && tool !== "camera";

  const followedLabel =
    follow === "player"
      ? followToken?.nombre ?? followToken?.label ?? undefined
      : undefined;

  const pista = BOARD_TOOLS.find((item) => item.id === tool);

  const unaElegida = elegidasVivas.length === 1 ? scene.tokens.find((token) => token.id === elegidasVivas[0]) : undefined;

  /*
  | Cuánto ocupan las elegidas, en metros (21/10/2026): el campo de la pizarra
  | mide 100 × 68 y el de verdad 105 × 68, así que lo largo se estira un 5 %.
  | Con dos, la distancia entre ellas; con más, el largo y el ancho del bloque
  | —lo que se mira para saber si un equipo está junto—.
  */
  const medida = useMemo(() => {
    const fichas = scene.tokens.filter((token) => elegidasSet.has(token.id));

    if (fichas.length < 2) return "";

    /* De quién es el bloque, dicho: con los dos onces puestos no se sabía a quién se medía. */
    const kinds = new Set(fichas.map((token) => token.kind));
    const quien = kinds.size === 1 && kinds.has("home") ? "Nosotros · " : kinds.size === 1 && kinds.has("away") ? `${rivalDelCampo ?? "Rival"} · ` : "";

    if (fichas.length === 2) {
      const [a, b] = fichas;

      return `${quien}a ${Math.round(Math.hypot((a.x - b.x) * 1.05, a.y - b.y))} m · campo 105 × 68`;
    }

    const xs = fichas.map((token) => token.x);
    const ys = fichas.map((token) => token.y);
    const largo = Math.round((Math.max(...xs) - Math.min(...xs)) * 1.05);
    const ancho = Math.round(Math.max(...ys) - Math.min(...ys));

    const partes = [ancho ? `${ancho} m entre extremos` : "", largo ? `${largo} m de largo` : ""].filter(Boolean).join(" · ");

    return `${quien}bloque de ${fichas.length}${partes ? ` · ${partes}` : ""} · campo 105 × 68`;
  }, [elegidasSet, rivalDelCampo, scene.tokens]);

  const ocupado = formato !== null;

  return (
    /* En el teléfono el campo va primero y las barras debajo: antes había seis bloques de botones antes de verlo. */
    <div ref={raizRef} className="flex flex-col gap-3">
      {/* BARRA DE FICHAS Y ACCIONES */}

      <div
        data-export-hide
        className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-[#11161D] p-2"
      >
        {/* En el móvil las cuatro fichas se reparten el ancho de la fila. */}
        <div className="flex w-full gap-1 sm:w-auto sm:flex-wrap">
          <TokenButton
            label="Propio"
            className="flex-1 justify-center sm:flex-none"
            icon={<Circle size={14} />}
            onClick={() => addToken("home")}
          />
          <TokenButton
            label="Rival"
            className="flex-1 justify-center sm:flex-none"
            icon={<Circle size={14} className="text-[#F87171]" />}
            onClick={() => addToken("away")}
          />
          <TokenButton
            label="Balón"
            className="flex-1 justify-center sm:flex-none"
            icon={<Circle size={12} />}
            onClick={() => addToken("ball")}
          />
          <TokenButton
            label="Cono"
            className="flex-1 justify-center sm:flex-none"
            icon={<Cone size={14} />}
            onClick={() => addToken("cone")}
          />
        </div>

        {roster.length > 0 && (
          <select
            value=""
            onChange={(event) => {
              const player = roster.find((p) => p.id === event.target.value);
              if (player) addToken("home", player);
            }}
            aria-label="Añadir un jugador de la plantilla al campo"
            className="w-full min-w-0 rounded-xl border border-white/10 bg-[#0F141B] px-2.5 py-2 text-[11px] text-white/75 outline-none sm:w-auto"
          >
            <option value="">Añadir jugador…</option>

            {/* Los que ya están en el campo, aparte del resto de la plantilla. */}
            {(() => {
              const puestos = new Set(scene.tokens.filter((t) => t.kind === "home" && t.nombre).map((t) => t.nombre));
              const enCampo = roster.filter((p) => puestos.has(p.apodo || p.nombre));
              const resto = roster.filter((p) => !puestos.has(p.apodo || p.nombre));
              const opcion = (player: (typeof roster)[number]) => (
                <option key={player.id} value={player.id}>
                  {player.dorsal ? `${player.dorsal} · ` : ""}
                  {player.apodo || player.nombre}
                </option>
              );

              return enCampo.length > 0 && resto.length > 0 ? (
                <>
                  <optgroup label="En el campo">{enCampo.map(opcion)}</optgroup>
                  <optgroup label="Resto de la plantilla">{resto.map(opcion)}</optgroup>
                </>
              ) : (
                roster.map(opcion)
              );
            })()}
          </select>
        )}

        {/* COLOCAR EN UN DIBUJO */}
        <Desplegable
          etiqueta="Dibujo"
          icono={<LayoutGrid size={13} />}
          titulo="Colocar a un equipo en un dibujo (4-4-2, 4-3-3…)"
          deshabilitado={live || ocupado}
        >
          {(cierra) => (
            <div className="space-y-3 text-[11px] text-white/70">
              <Segmentado
                etiqueta="Equipo"
                valor={dibujoEquipo}
                onCambia={setDibujoEquipo}
                opciones={[
                  ["home", "Nosotros"],
                  ["away", "Rival"],
                ]}
              />
              <Segmentado
                etiqueta="Altura"
                valor={dibujoAltura}
                onCambia={setDibujoAltura}
                opciones={(Object.keys(ALTURA_LABEL) as Altura[]).map((id) => [id, id === "alto" ? "Alto" : id === "medio" ? "Medio" : "Bajo"])}
              />
              <Segmentado
                etiqueta="Fase"
                valor={dibujoFase}
                onCambia={setDibujoFase}
                opciones={(Object.keys(FASE_LABEL) as Fase[]).map((id) => [id, FASE_LABEL[id]])}
              />

              <div className="grid grid-cols-3 gap-1.5">
                {DIBUJOS.map((dibujo) => (
                  <button
                    key={dibujo}
                    type="button"
                    onClick={() => {
                      colocaEquipo(dibujo);
                      cierra();
                    }}
                    className="rounded-xl border border-white/10 bg-white/[0.03] px-2 py-2 text-xs font-semibold tabular-nums text-white/80 transition hover:border-[#C8A96B]/50 hover:text-[#C8A96B]"
                  >
                    {dibujo}
                  </button>
                ))}
              </div>

              {!singleScene && (
                <label className="flex items-start gap-2 leading-snug">
                  <input
                    type="checkbox"
                    checked={dibujoNueva}
                    onChange={(event) => setDibujoNueva(event.target.checked)}
                    className="mt-0.5 accent-[#C8A96B]"
                  />
                  <span>
                    En una escena nueva, detrás de ésta: al reproducir se ve
                    cómo cambia el dibujo.
                  </span>
                </label>
              )}

              <p className="leading-snug text-white/45">
                La altura es dónde va su línea defensiva: alto a unos 45 m de
                su portería, medio a 35 y bajo a 22. Sin balón el equipo se
                junta; con balón se abre. Recoloca a los que ya están, cada
                uno al puesto más cercano, sin cambiar nombres ni dorsales.
              </p>
            </div>
          )}
        </Desplegable>

        <button
          type="button"
          onClick={() => setDictating((open) => !open)}
          title="Explicar la jugada por voz"
          aria-label="Dictar la jugada por voz"
          aria-pressed={dictating}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-[11px] font-semibold transition",
            dictating
              ? "bg-[#C8A96B] text-[#0B0F14]"
              : "border border-[#C8A96B]/40 bg-[#C8A96B]/10 text-[#C8A96B] hover:bg-[#C8A96B]/20"
          )}
        >
          <Mic size={14} />
          <span className="hidden lg:inline">Dictar</span>
        </button>

        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {!singleScene && (
            <>
              <TokenButton
                label="Duplicar"
                icon={<Copy size={13} />}
                onClick={addScene}
                title="Duplicar la escena justo detrás: mueve las fichas en la copia y al reproducir se verá el movimiento"
              />
              <TokenButton
                label="Escena en blanco"
                icon={<Plus size={13} />}
                onClick={addEmptyScene}
                title="Una escena en blanco justo detrás de ésta"
              />
            </>
          )}

          {/* VISTA: ENCUADRE, CÉSPED, GRADERÍO, FIGURAS, NOMBRES */}
          <Desplegable etiqueta="Vista" icono={<Eye size={13} />} titulo="Encuadre, césped, graderío, figuras y nombres" lado="derecha" ancho="w-80">
            {() => (
              <div className="space-y-3 text-[11px] text-white/70">
                <div>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45">Encuadre</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(Object.keys(CROP_VIEWBOX) as PitchCrop[]).map((crop) => (
                      <Chip key={crop} activo={doc.crop === crop} onClick={() => commit({ ...doc, crop })}>
                        {CROP_LABEL[crop]}
                      </Chip>
                    ))}
                  </div>
                </div>

                {/*
                  El campo se elige, no viene dado: la charla a oscuras pide un
                  césped apagado que deje ver las flechas, y la imagen que se
                  manda por el grupo pide el verde de retransmisión.
                */}
                <div>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45">Césped</p>
                  <div className="flex flex-wrap gap-1.5">
                    {CAMPOS.map((item) => (
                      <Chip key={item.id} activo={campoActivo === item.id} onClick={() => commit({ ...doc, campo: item.id })} title={item.nota}>
                        <span
                          aria-hidden
                          className="h-3 w-3 shrink-0 rounded-[3px]"
                          style={{
                            background: item.cesped,
                            boxShadow: `inset 0 0 0 1px ${item.linea}`,
                          }}
                        />
                        {item.label}
                      </Chip>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <Chip
                    activo={nombresVisibles}
                    onClick={() => commit({ ...doc, sinNombres: nombresVisibles ? true : undefined })}
                    title={nombresVisibles ? "Quitar los nombres de debajo de las fichas: queda el dorsal" : "Poner el nombre bajo cada ficha"}
                  >
                    <Tag size={12} />
                    Nombres
                  </Chip>

                  {/*
                    Modo jugador: la ficha redonda deja paso a la figura del
                    jugador, con su cara y con el cuerpo que le corresponde por
                    altura y peso. En un córner se ve de un vistazo quién gana
                    por alto sin abrir la hoja.
                  */}
                  <Chip
                    activo={figurasVisibles}
                    onClick={() => commit({ ...doc, figuras: !figurasVisibles })}
                    title={
                      figurasVisibles
                        ? "Volver a las fichas redondas con el dorsal"
                        : "Modo jugador: cada ficha se dibuja como el jugador que es (foto, altura y peso)"
                    }
                  >
                    <PersonStanding size={13} />
                    Jugadores
                  </Chip>

                  <Chip
                    activo={Boolean(doc.guias)}
                    onClick={() => commit({ ...doc, guias: doc.guias ? undefined : true })}
                    title="Tercios y carriles sobre el césped: bandas, intervalos y centro, con el ancho de las áreas"
                  >
                    <Grid3x3 size={12} />
                    Carriles
                  </Chip>

                  <Chip
                    activo={entornoVisible}
                    onClick={() => commit({ ...doc, entorno: !entornoVisible })}
                    title={
                      entornoVisible
                        ? "Quitar las vallas y el graderío: sólo el campo (se ven en 3D)"
                        : "Levantar las vallas y el graderío alrededor del campo (se ven en 3D)"
                    }
                  >
                    <Building2 size={12} />
                    Graderío
                  </Chip>
                </div>
              </div>
            )}
          </Desplegable>

          {/* EXPORTAR */}
          <Desplegable
            etiqueta={ocupado ? `Exportando${progreso ? ` · ${progreso}` : "…"}` : "Exportar"}
            icono={<Download size={13} />}
            titulo="PNG, PDF, PowerPoint o vídeo de la jugada"
            lado="derecha"
            ancho="w-72"
            deshabilitado={ocupado}
          >
            {(cierra) => (
              <div className="space-y-1">
                <OpcionExportar
                  icono={<ImageIcon size={15} />}
                  titulo="Imagen de esta escena"
                  detalle="PNG 1920 × 1080 con título, escena y nota"
                  onClick={() => {
                    cierra();
                    void exporta("png");
                  }}
                />
                {typeof window !== "undefined" && "ClipboardItem" in window && (
                  <OpcionExportar
                    icono={<ClipboardCopy size={15} />}
                    titulo="Copiar esta escena"
                    detalle="Para pegarla en WhatsApp Web o en el correo"
                    onClick={() => {
                      cierra();
                      void exporta("copia");
                    }}
                  />
                )}
                <OpcionExportar
                  icono={<FileText size={15} />}
                  titulo={singleScene ? "PDF" : `PDF · ${scenes.length} ${scenes.length === 1 ? "escena" : "escenas"}`}
                  detalle="Una hoja apaisada por escena, para imprimir o mandar"
                  onClick={() => {
                    cierra();
                    void exporta("pdf");
                  }}
                />
                <OpcionExportar
                  icono={<Presentation size={15} />}
                  titulo="PowerPoint"
                  detalle="Una diapositiva por escena; título y nota se corrigen allí"
                  onClick={() => {
                    cierra();
                    void exporta("pptx");
                  }}
                />
                {!singleScene &&
                  (Object.keys(DESTINOS) as Destino[]).map((destino) => (
                    <OpcionExportar
                      key={destino}
                      icono={<Film size={15} />}
                      titulo={DESTINOS[destino].titulo}
                      detalle={
                        puedeHacerVideo()
                          ? scenes.length > 1
                            ? `${DESTINOS[destino].detalle} · ${coma(duracionVideo, 0)} s · ≈ ${coma(pesoVideoMb(destino, duracionVideo))} MB`
                            : "Hacen falta dos escenas para que haya movimiento"
                          : "Este navegador no monta vídeo: usa Chrome o Edge"
                      }
                      deshabilitado={!puedeHacerVideo() || scenes.length < 2}
                      onClick={() => {
                        cierra();
                        void exporta(destino);
                      }}
                    />
                  ))}
                <OpcionExportar
                  icono={<ImageIcon size={15} />}
                  titulo="Portada"
                  detalle="JPG con el título, el escudo y el rival: la imagen del enlace en el correo"
                  onClick={() => {
                    cierra();
                    void exporta("portada");
                  }}
                />
                {sinTitulo && (
                  <p className="mt-1 rounded-xl border border-[#C8A96B]/30 bg-[#C8A96B]/10 px-2.5 py-2 text-[10px] leading-snug text-[#E9C46A]">
                    Ponle título a la pizarra: sin él, todo sale como «{tituloPropuesto}».
                  </p>
                )}
              </div>
            )}
          </Desplegable>
        </div>
      </div>

      {/* CAMBIO DE JUGADOR: al pinchar dos veces una ficha */}

      {cambio && (
        <CambioJugador
          titulo={cambio.ficha.nombre ? `Cambiar a ${nombreCorto(cambio.ficha.nombre)}` : `Cambiar al ${cambio.ficha.label}`}
          equipo={cambio.equipo}
          opciones={cambio.opciones}
          onElige={(id) => {
            aplicaCambio(cambio.ficha, id);
            setCambiando(null);
          }}
          onCierra={() => setCambiando(null)}
        />
      )}

      {/* DICTADO */}

      {dictating && (
        <TacticsVoicePanel
          doc={doc}
          scene={scene}
          roster={roster}
          rivalSquads={rivalSquads}
          singleScene={singleScene}
          onApply={applyVoice}
          onClose={() => setDictating(false)}
        />
      )}

      {/* DORSALES RIVALES */}

      {rivalSquads.length > 0 && (
        <RivalPicker
          squads={rivalSquads}
          activeIds={rivalIds}
          onToggle={toggleRival}
          onAddNumber={addRivalNumber}
          onClear={clearRivals}
          lockedTeam={lockedRivalTeam}
          abiertoAlEmpezar={Boolean(lockedRivalTeam) && rivalesAbiertos}
        />
      )}

      {/* LO QUE HAY EN LA MANO: herramienta o fichas elegidas */}

      <div
        data-export-hide
        aria-live="polite"
        className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-2xl border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[11px] text-white/60"
      >
        {elegidasVivas.length > 0 && tool === "select" ? (
          <>
            <span className="mr-1 font-semibold text-[#C8A96B]">
              {elegidasVivas.length === 1
                ? `${unaElegida?.nombre ? nombreCorto(unaElegida.nombre) : unaElegida?.label ? `Ficha ${unaElegida.label}` : "1 ficha"} elegida`
                : `${elegidasVivas.length} fichas elegidas`}
              {medida && <span className="ml-1.5 font-normal tabular-nums text-white/55">· {medida}</span>}
            </span>

            {elegidasVivas.length >= 2 && (
              <>
                <Accion icono={<Rows3 size={13} />} onClick={() => alinea("linea")} titulo="Todas a la misma altura del campo: una línea defensiva, la de presión">
                  Misma línea
                </Accion>
                <Accion icono={<Columns3 size={13} />} onClick={() => alinea("fila")} titulo="Todas en el mismo carril, de portería a portería">
                  Mismo carril
                </Accion>
              </>
            )}
            {elegidasVivas.length >= 3 && (
              <>
                <Accion icono={<AlignVerticalSpaceAround size={13} />} onClick={() => alinea("reparte-alto")} titulo="La misma distancia entre cada una, de banda a banda">
                  Repartir a lo ancho
                </Accion>
                <Accion icono={<AlignHorizontalSpaceAround size={13} />} onClick={() => alinea("reparte-ancho")} titulo="La misma distancia entre cada una, de portería a portería">
                  Repartir a lo largo
                </Accion>
              </>
            )}

            {unaElegida && (unaElegida.kind === "home" || unaElegida.kind === "away") && (
              <Accion icono={<Repeat2 size={13} />} onClick={() => setCambiando(unaElegida.id)} titulo="Cambiarla por otro jugador de su equipo (o pincha la ficha otra vez)">
                Cambiar jugador
              </Accion>
            )}

            <Accion icono={<Copy size={13} />} onClick={duplicaElegidas} titulo="Duplicar (Ctrl+D)">
              Duplicar
            </Accion>
            <Accion icono={<Trash2 size={13} />} onClick={borraElegidas} titulo="Quitar del campo (Supr)" peligro>
              Quitar
            </Accion>

            <button
              type="button"
              onClick={() => setElegidas([])}
              title="Soltar la elección (Esc)"
              aria-label="Soltar la elección"
              className="ml-auto rounded-lg p-1.5 text-white/40 transition hover:bg-white/[0.08] hover:text-white"
            >
              <X size={13} />
            </button>
          </>
        ) : (
          <>
            <span className="min-w-0 flex-1 leading-snug">
              <span className="font-semibold text-white/80">{pista?.label}</span>
              {pista ? ` · ${pista.hint}` : ""}
              {tool === "select" && ". En vacío, arrastra para elegir varias."}
            </span>

            <button
              type="button"
              onClick={() => setAtajos((valor) => !valor)}
              aria-expanded={atajos}
              title="Atajos de teclado (?)"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1 text-white/50 transition hover:bg-white/[0.08] hover:text-white"
            >
              <Keyboard size={13} />
              <span className="hidden sm:inline">Atajos</span>
            </button>
          </>
        )}
      </div>

      {atajos && <PanelAtajos onCierra={() => setAtajos(false)} singleScene={singleScene} />}

      {/* CAMPO */}

      <PitchStage
        className="max-sm:-order-1 max-sm:-mx-3 max-sm:rounded-2xl"
        camera={camera}
        aPantallaCompleta={aPantallaCompleta}
        aspect={`${viewBox.width} / ${viewBox.height}`}
        navigable={tool === "camera"}
        frameRef={frameRef}
        onGestureStart={cancelEditGesture}
        entorno={
          entornoVisible && camera.render === "3d" ? (
            <EntornoEstadio
              campo={campoActivo}
              titulo={doc.titulo}
              escena={scene.nombre}
              yaw={camera.pose.yaw}
            />
          ) : undefined
        }
        cameraBar={
          <PitchCameraBar
            plegable
            camera={camera}
            follow={follow}
            onFollowChange={setFollow}
            followedLabel={followedLabel}
          />
        }
        toolbar={
          <BoardToolPalette
            tool={tool}
            onToolChange={setTool}
            onUndo={undo}
            onRedo={redo}
            onClear={clearScene}
            canUndo={canUndo}
            canRedo={canRedo}
            disabled={live}
          />
        }
        styleBar={
          drawing ? (
            <BoardStyleBar
              color={color}
              onColorChange={setColor}
              width={strokeWidth}
              onWidthChange={setStrokeWidth}
              dash={dash}
              onDashChange={setDash}
              disabled={live}
            />
          ) : undefined
        }
        dockToolbar={
          <BoardToolPalette
            dock
            tool={tool}
            onToolChange={setTool}
            onUndo={undo}
            onRedo={redo}
            onClear={clearScene}
            canUndo={canUndo}
            canRedo={canRedo}
            disabled={live}
          />
        }
        dockPanel={
          drawing ? (
            <BoardStyleBar
              dock
              color={color}
              onColorChange={setColor}
              width={strokeWidth}
              onWidthChange={setStrokeWidth}
              dash={dash}
              onDashChange={setDash}
              disabled={live}
            />
          ) : (
            <PitchCameraBar
              dock
              compact={tool !== "camera"}
              camera={camera}
              follow={follow}
              onFollowChange={setFollow}
              followedLabel={followedLabel}
            />
          )
        }
        pie={
          displayScene.nota ? (
            <p className="px-4 py-2.5 text-sm leading-relaxed text-white/85 sm:text-base">
              {!singleScene && (
                <span className="mr-2 font-semibold text-[#C8A96B]">
                  {displayIndex + 1}/{scenes.length} · {displayScene.nombre}
                </span>
              )}
              {displayScene.nota}
            </p>
          ) : undefined
        }
        timeline={
          singleScene ? undefined : (
            <PitchTimelineBar
              timeline={timeline}
              keyframes={scenes.map((item) => item.nombre)}
              activeIndex={displayIndex}
              onSelectKeyframe={setSceneIndex}
              onRemoveKeyframe={scenes.length > 1 ? removeScene : undefined}
            />
          )
        }
      >
        <svg
          ref={svgRef}
          viewBox={CROP_VIEWBOX[doc.crop]}
          preserveAspectRatio="xMidYMid meet"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          aria-label={`Campo · ${scene.nombre}`}
          className={cn(
            "block h-full w-full touch-none select-none",
            tool === "camera"
              ? "cursor-default"
              : tool === "select"
              ? arrastrando
                ? "cursor-grabbing"
                : "cursor-default"
              : "cursor-crosshair"
          )}
        >
          <defs>
            <marker
              id="tactics-arrow"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="5"
              markerHeight="5"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke" />
            </marker>

            {figurasVisibles && <FigurasDefs prefijo={prefijoFiguras} />}
          </defs>

          <PitchMarkings campo={campoActivo} />

          {/*
            Carriles y alturas. Los carriles salen de las líneas que ya están
            en el campo —el ancho del área grande (40,32 m) y el del área
            pequeña (18,32 m)—, que es como se cuentan en el juego de posición.
          */}
          {doc.guias && (
            <g style={{ pointerEvents: "none" }} stroke="rgba(255,255,255,.32)" strokeWidth={0.22} strokeDasharray="1.2 1">
              {[100 / 3, 200 / 3].map((x) => (
                <line key={`x${x}`} x1={x} y1={0} x2={x} y2={PITCH_HEIGHT} />
              ))}
              {[13.84, 24.84, 43.16, 54.16].map((y) => (
                <line key={`y${y}`} x1={0} y1={y} x2={100} y2={y} />
              ))}
            </g>
          )}

          {/*
            La estela del movimiento: mientras la jugada corre, cada ficha deja
            una línea fina desde donde salió. En la charla se ve quién se ha
            movido y cuánto, y en el vídeo se sigue sin perder a nadie.
          */}
          {estelas.length > 0 && (
            <g style={{ pointerEvents: "none" }}>
              {estelas.map((estela) => (
                <line
                  key={`estela-${estela.id}`}
                  x1={estela.x1}
                  y1={estela.y1}
                  x2={estela.x2}
                  y2={estela.y2}
                  stroke={estela.color}
                  strokeOpacity={0.55}
                  strokeWidth={0.35}
                  strokeDasharray="0.9 0.7"
                  strokeLinecap="round"
                />
              ))}
            </g>
          )}

          {/* Formas */}
          <g>
            {[...displayScene.shapes, ...(draft && !exporting ? [draft] : [])].map((shape) => (
              <ShapeNode
                key={shape.id}
                shape={shape}
                interactive={!live && !exporting && (tool === "erase" || tool === "select")}
                editing={!exporting && editingShape === shape.id}
                onErase={() => tool === "erase" && removeShape(shape.id)}
                onEdit={() => {
                  /* Un punto de deshacer al empezar a corregir, no uno por letra. */
                  marcaDeshacer();
                  setEditingShape(shape.id);
                }}
                /*
                | Cada letra va sin pasar por el historial (19/10/2026): con
                | `commit` cada tecla era un paso de deshacer y una palabra de
                | diez letras se comía un cuarto de los 40 pasos que se guardan.
                */
                onText={(text) =>
                  cambiaEscenaSinHistorial((item) => ({
                    ...item,
                    shapes: item.shapes.map((s) => (s.id === shape.id ? { ...s, text } : s)),
                  }))
                }
                onCloseEdit={() => setEditingShape(null)}
              />
            ))}
          </g>

          {/* Fichas */}
          <g>
            {paintedTokens.map((token) => {
              const style = TOKEN_STYLE[token.kind];
              const anchored =
                follow === "player" && followId === token.id && !exporting;
              const elegida = !exporting && !live && elegidasSet.has(token.id);

              /*
                Modo jugador. El balón y el cono no tienen figura, así que en
                una pizarra con figuras siguen siendo lo que eran.
              */
              const figura = figurasVisibles && tieneFigura(token.kind);

              const perfil = figura ? perfilDe(token) : undefined;

              const medidas = figura
                ? medidasFigura(perfil?.alturaCm, perfil?.pesoKg)
                : undefined;

              /* Medio ancho de la figura, para la sombra y el área de agarre. */
              const medio = medidas
                ? medioFigura(medidas.alto, medidas.ancho)
                : style.radius;

              /* Se está llevando con el ratón o el dedo: la figura se levanta del césped. */
              const enElAire = figura && arrastrando && elegida;
              const kit = EQUIPACIONES[token.kind === "away" ? "away" : "home"];

              /*
                La figura está de pie sobre el punto del campo, así que su
                sombra va a sus pies (y = 0) y el estirado de la perspectiva
                sale de ahí. La ficha redonda, en cambio, flota un poco sobre
                su sombra y se estira desde ella.
              */
              const anclaY = figura ? 0 : style.radius * 0.55;

              const nombre = token.nombre && nombresVisibles ? nombreCorto(token.nombre) : "";

              return (
                <g
                  key={token.id}
                  /* Al exportar, las fichas un 30 % más grandes: en la lámina y en el vídeo se leen desde el fondo de la sala. */
                  transform={`translate(${token.x} ${token.y})${exporting ? " scale(1.3)" : ""}${fichasGiradas ? " rotate(90)" : ""}`}
                  onPointerDown={(event) => {
                    if (live || exporting || tool === "camera") return;

                    if (tool === "erase") {
                      event.stopPropagation();
                      removeToken(token.id);
                      return;
                    }

                    if (tool !== "select") return;

                    agarraFicha(event, token);
                  }}
                  className={cn(
                    tool === "select" && "cursor-grab",
                    tool === "erase" && "cursor-pointer"
                  )}
                >
                  <title>{tituloFicha(token, perfil, medidas)}</title>

                  {/*
                    Con figuras, lo del césped —sombras, aro del equipo,
                    elegida y cámara que la sigue— lo pinta `SueloFigura`. El
                    aro se redondea con la inclinación (0,45 × tokenLift) para
                    que la perspectiva lo deje siempre igual de achatado.
                  */}
                  {medidas && (
                    <SueloFigura
                      prefijo={prefijoFiguras}
                      alto={medidas.alto}
                      ancho={medidas.ancho}
                      kit={kit}
                      bando={token.kind === "away" ? "away" : "home"}
                      achatado={Math.min(1, 0.45 * tokenLift)}
                      elegida={elegida}
                      anclada={anchored}
                      elevada={enElAire}
                    />
                  )}

                  {/* La ficha redonda: sombra, anclaje y elegida, tumbados en el césped. */}
                  {!medidas && (
                    <>
                      <ellipse
                        cx={0}
                        cy={anclaY}
                        rx={medio * 0.95}
                        ry={medio * 0.42}
                        fill="rgba(0,0,0,.38)"
                        style={{ pointerEvents: "none" }}
                      />

                      {anchored && (
                        <ellipse
                          cx={0}
                          cy={anclaY}
                          rx={medio + 1.1}
                          ry={medio + 1.1}
                          fill="none"
                          stroke="#C8A96B"
                          strokeWidth={0.35}
                          strokeDasharray="1 0.8"
                          style={{ pointerEvents: "none" }}
                        />
                      )}

                      {elegida && (
                        <ellipse
                          cx={0}
                          cy={anclaY}
                          rx={medio + 0.9}
                          ry={medio + 0.9}
                          fill="rgba(200,169,107,.18)"
                          stroke="#E9C46A"
                          strokeWidth={0.45}
                          style={{ pointerEvents: "none" }}
                        />
                      )}
                    </>
                  )}

                  {/*
                    La ficha se endereza para que la perspectiva no la
                    aplaste: se estira lo justo para volver a verse redonda.
                    El estirado sale de la sombra hacia arriba, así que la
                    ficha parece de pie sobre el césped en vez de tumbada.
                  */}
                  <g
                    transform={`rotate(${tokenSpin.toFixed(2)}) translate(0 ${anclaY}) scale(1 ${tokenLift.toFixed(3)}) translate(0 ${-anclaY})`}
                    style={{ transition: exporting ? undefined : "transform 190ms ease-out" }}
                  >
                  {/*
                    Área de agarre, invisible y más ancha que la ficha.

                    En un teléfono la ficha mide unos dieciséis píxeles: con el
                    dedo se fallaba una de cada dos veces. `transparent` sigue
                    recibiendo el puntero, `none` no. Con la figura el agarre
                    es un rectángulo de su alto: se arrastra por el cuerpo, no
                    sólo por los pies.
                  */}
                  {medidas ? (
                    <rect
                      x={-(medio + 0.8)}
                      y={-medidas.alto - 0.6}
                      width={(medio + 0.8) * 2}
                      /* Hasta el pie de la placa del nombre: también se agarra por ahí. */
                      height={medidas.alto + 3.6}
                      fill="transparent"
                    />
                  ) : (
                    <circle r={style.radius + 1.4} fill="transparent" />
                  )}

                  {medidas && perfil ? (
                    <PlayerFigure
                      prefijo={prefijoFiguras}
                      uid={token.id}
                      alto={medidas.alto}
                      ancho={medidas.ancho}
                      kit={kit}
                      label={token.label}
                      foto={fotoFigura(perfil.foto)}
                      elevada={enElAire}
                    />
                  ) : token.kind === "ball" ? (
                    <BalonOficial r={style.radius} uid={token.id} />
                  ) : token.kind === "cone" ? (
                    <polygon
                      points={`0,${-style.radius} ${style.radius},${style.radius} ${-style.radius},${style.radius}`}
                      fill={style.fill}
                      stroke={style.stroke}
                      strokeWidth={0.25}
                    />
                  ) : (
                    <circle
                      r={style.radius}
                      fill={style.fill}
                      stroke={style.stroke}
                      strokeWidth={token.kind === "away" ? 0.5 : 0.3}
                    />
                  )}

                  {/* La figura ya lleva el dorsal pintado en la camiseta. */}
                  {token.label && token.kind !== "ball" && !figura && (
                    <text
                      y={0.85}
                      textAnchor="middle"
                      fontSize={token.label.length > 2 ? 1.8 : 2.4}
                      fontWeight={700}
                      fill={style.text}
                      style={{ pointerEvents: "none" }}
                    >
                      {token.label}
                    </text>
                  )}

                  {/*
                    El nombre, con un halo oscuro para que se lea sobre las
                    rayas del campo y sobre las flechas. Más pequeño que antes
                    (1,9 → 1,55 el 21/10/2026): con los dos onces puestos los
                    nombres se montaban unos encima de otros.
                  */}
                  {/*
                    Con figuras, la placa de retransmisión: el dorsal en el
                    color del equipo y el apellido en Barlow. Sin nombres
                    (`sinNombres`) se queda en el dorsal.
                  */}
                  {figura && (
                    <PlacaJugador
                      kit={kit}
                      dorsal={token.label}
                      nombre={nombre}
                      y={1.15}
                      elegida={elegida}
                    />
                  )}

                  {nombre && !figura && (
                    <text
                      y={style.radius + 2.1}
                      textAnchor="middle"
                      fontSize={1.55}
                      fontWeight={600}
                      fill="rgba(255,255,255,.95)"
                      stroke="rgba(0,0,0,.55)"
                      strokeWidth={0.4}
                      paintOrder="stroke"
                      style={{ pointerEvents: "none" }}
                    >
                      {nombre}
                    </text>
                  )}
                  </g>
                </g>
              );
            })}
          </g>

          {/* Recuadro de elección */}
          {recuadro && (
            <rect
              x={Math.min(recuadro.a.x, recuadro.b.x)}
              y={Math.min(recuadro.a.y, recuadro.b.y)}
              width={Math.abs(recuadro.b.x - recuadro.a.x)}
              height={Math.abs(recuadro.b.y - recuadro.a.y)}
              fill="rgba(200,169,107,.12)"
              stroke="#E9C46A"
              strokeWidth={0.3}
              strokeDasharray="1 0.7"
              style={{ pointerEvents: "none" }}
            />
          )}
        </svg>
      </PitchStage>

      {/* QUIÉN ES QUIÉN: con los dos onces, los mismos números en los dos colores no decían de quién era cada uno. */}
      {(leyenda?.length ?? 0) > 1 && (
        <div data-export-hide className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-[11px] text-white/60">
          {leyenda?.map((item) => (
            <span key={item.texto} className="inline-flex items-center gap-1.5">
              <span aria-hidden className="h-3 w-3 rounded-full border-2" style={{ background: item.color, borderColor: item.borde }} />
              {item.texto}
            </span>
          ))}
        </div>
      )}

      {/* LA ESCENA: NOMBRE, ORDEN Y LO QUE SE CUENTA */}

      <PanelEscena
        escena={scene}
        indice={safeIndex}
        total={scenes.length}
        singleScene={singleScene}
        deshabilitado={live || ocupado}
        onEmpieza={marcaDeshacer}
        onCambia={(cambios) => cambiaEscenaSinHistorial((current) => ({ ...current, ...cambios }))}
        onMueve={mueveEscena}
      />

      {hint && <p className="text-[11px] leading-relaxed text-white/40">{hint}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  PIEZAS                                                             */
/* ------------------------------------------------------------------ */

/**
 * Nombre de la escena, su sitio en la jugada y lo que se cuenta en ella.
 *
 * La nota es lo que el entrenador diría señalando la pizarra; sale bajo el
 * campo a pantalla completa y en todo lo que se exporta.
 */
function PanelEscena({
  escena,
  indice,
  total,
  singleScene,
  deshabilitado,
  onEmpieza,
  onCambia,
  onMueve,
}: {
  escena: TacticScene;
  indice: number;
  total: number;
  singleScene: boolean;
  deshabilitado: boolean;
  /** Al empezar a escribir: un solo punto de deshacer, no uno por letra. */
  onEmpieza: () => void;
  onCambia: (cambios: Partial<Pick<TacticScene, "nombre" | "nota">>) => void;
  onMueve: (paso: -1 | 1) => void;
}) {
  return (
    <div
      data-export-hide
      className="grid gap-2 rounded-2xl border border-white/10 bg-[#11161D] p-3 sm:grid-cols-[minmax(0,240px)_1fr]"
    >
      <div className="flex min-w-0 flex-col gap-1.5">
        <label className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45" htmlFor={`escena-${escena.id}`}>
          {singleScene ? "Escena" : `Escena ${indice + 1} de ${total}`}
        </label>

        <div className="flex items-center gap-1">
          <input
            id={`escena-${escena.id}`}
            value={escena.nombre}
            disabled={deshabilitado}
            onFocus={onEmpieza}
            onChange={(event) => onCambia({ nombre: event.target.value })}
            onBlur={(event) => {
              if (!event.target.value.trim()) onCambia({ nombre: `Escena ${indice + 1}` });
            }}
            maxLength={60}
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#0F141B] px-2.5 py-2 text-xs font-semibold text-white/85 outline-none focus:border-[#C8A96B]/50"
          />

          {!singleScene && total > 1 && (
            <>
              <button
                type="button"
                onClick={() => onMueve(-1)}
                disabled={deshabilitado || indice === 0}
                title="Pasar esta escena antes"
                aria-label="Pasar esta escena antes"
                className="rounded-lg p-2 text-white/50 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-25"
              >
                <ArrowLeft size={13} />
              </button>
              <button
                type="button"
                onClick={() => onMueve(1)}
                disabled={deshabilitado || indice === total - 1}
                title="Pasar esta escena después"
                aria-label="Pasar esta escena después"
                className="rounded-lg p-2 text-white/50 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-25"
              >
                <ArrowRight size={13} />
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-1.5">
        <label className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45" htmlFor={`nota-${escena.id}`}>
          Qué se cuenta
        </label>
        <textarea
          id={`nota-${escena.id}`}
          value={escena.nota ?? ""}
          disabled={deshabilitado}
          onFocus={onEmpieza}
          onChange={(event) => onCambia({ nota: event.target.value || undefined })}
          rows={2}
          maxLength={280}
          placeholder="Lo que tiene que ver el grupo: «el 6 salta al poseedor y el 8 cierra el pase interior». Sale bajo el campo y en lo que se exporta."
          className="min-h-[3.25rem] w-full resize-y rounded-xl border border-white/10 bg-[#0F141B] px-2.5 py-2 text-xs leading-relaxed text-white/85 outline-none placeholder:text-white/30 focus:border-[#C8A96B]/50"
        />
      </div>
    </div>
  );
}

function PanelAtajos({ onCierra, singleScene }: { onCierra: () => void; singleScene: boolean }) {
  const filas: [string, string][] = [
    ["V · C", "Mover · Cámara"],
    ["A · P · L · F", "Flecha · Pase · Línea · Trazo libre"],
    ["Z · T · E", "Zona · Texto · Borrar"],
    ["Clic · Mayús+clic", "Elegir una ficha · añadir o quitar de la elección"],
    ["Arrastrar en vacío", "Elegir varias con un recuadro"],
    ["Segundo clic", "Cambiar la ficha por otro jugador"],
    ["Mayús al arrastrar", "Pegar a la rejilla"],
    ["Flechas · Mayús+flechas", "Mover lo elegido poco · mucho"],
    ["Supr · Ctrl+D · Ctrl+A", "Quitar · duplicar · elegir todo"],
    ["Esc", "Soltar la elección"],
    ["Ctrl+Z · Ctrl+Y", "Deshacer · rehacer"],
    ...(singleScene
      ? []
      : ([
          ["→ · AvPág", "Siguiente escena, moviéndose (para presentar)"],
          ["← · RePág", "Escena anterior"],
          ["Espacio", "Reproducir o parar la jugada"],
        ] as [string, string][])),
  ];

  return (
    <div data-export-hide className="rounded-2xl border border-white/10 bg-[#11161D] p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45">
          <Keyboard size={13} className="text-[#C8A96B]" />
          Atajos de teclado
        </p>
        <button
          type="button"
          onClick={onCierra}
          aria-label="Cerrar los atajos"
          className="rounded-lg p-1.5 text-white/40 transition hover:bg-white/[0.08] hover:text-white"
        >
          <X size={13} />
        </button>
      </div>

      <dl className="grid gap-x-6 gap-y-1.5 text-[11px] sm:grid-cols-2">
        {filas.map(([teclas, que]) => (
          <div key={teclas} className="flex items-baseline gap-2">
            <dt className="w-36 shrink-0 font-semibold text-white/80">{teclas}</dt>
            <dd className="min-w-0 text-white/55">{que}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Segmentado<T extends string>({
  etiqueta,
  valor,
  onCambia,
  opciones,
}: {
  etiqueta: string;
  valor: T;
  onCambia: (valor: T) => void;
  opciones: [T, string][];
}) {
  return (
    <div>
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45">{etiqueta}</p>
      <div className={cn("grid gap-1 rounded-xl bg-white/[0.05] p-0.5", opciones.length === 3 ? "grid-cols-3" : "grid-cols-2")}>
        {opciones.map(([id, texto]) => (
          <button
            key={id}
            type="button"
            onClick={() => onCambia(id)}
            aria-pressed={valor === id}
            className={cn(
              "rounded-lg px-2 py-1.5 text-[11px] font-semibold transition",
              valor === id ? "bg-[#C8A96B] text-[#0B0F14]" : "text-white/60 hover:text-white"
            )}
          >
            {texto}
          </button>
        ))}
      </div>
    </div>
  );
}

function Chip({
  activo,
  onClick,
  title,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={activo}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition",
        activo
          ? "border-[#C8A96B]/50 bg-[#C8A96B]/12 text-[#C8A96B]"
          : "border-white/10 bg-white/[0.03] text-white/55 hover:text-white"
      )}
    >
      {children}
    </button>
  );
}

function Accion({
  icono,
  onClick,
  titulo,
  peligro = false,
  children,
}: {
  icono: React.ReactNode;
  onClick: () => void;
  titulo: string;
  peligro?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={titulo}
      className={cn(
        "inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1 font-semibold transition",
        peligro
          ? "text-white/65 hover:bg-red-500/15 hover:text-red-300"
          : "text-white/70 hover:bg-white/[0.08] hover:text-white"
      )}
    >
      {icono}
      {children}
    </button>
  );
}

function OpcionExportar({
  icono,
  titulo,
  detalle,
  onClick,
  deshabilitado = false,
}: {
  icono: React.ReactNode;
  titulo: string;
  detalle: string;
  onClick: () => void;
  deshabilitado?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={deshabilitado}
      className="flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2 text-left transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
    >
      <span className="mt-0.5 text-[#C8A96B]">{icono}</span>
      <span className="min-w-0">
        <span className="block text-xs font-semibold text-white/85">{titulo}</span>
        <span className="block text-[10px] leading-snug text-white/45">{detalle}</span>
      </span>
    </button>
  );
}

function ShapeNode({
  shape,
  interactive,
  editing,
  onErase,
  onEdit,
  onText,
  onCloseEdit,
}: {
  shape: TacticShape;
  interactive: boolean;
  editing: boolean;
  onErase: () => void;
  onEdit: () => void;
  onText: (text: string) => void;
  onCloseEdit: () => void;
}) {
  const width = shape.width ?? LINE_WIDTHS[1];

  // Las herramientas antiguas no guardaban trazo: el pase sigue discontinuo.
  const dash = shape.dash ?? (shape.tool === "dashed" ? "dashed" : "solid");

  const common = {
    stroke: shape.color,
    strokeWidth: width,
    fill: "none",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    onPointerDown: (event: ReactPointerEvent) => {
      if (!interactive) return;
      event.stopPropagation();
      onErase();
    },
    style: { pointerEvents: interactive ? ("stroke" as const) : ("none" as const) },
  };

  if (shape.tool === "zone") {
    const rect = rectFrom(shape);

    return (
      <rect
        {...rect}
        rx={1}
        stroke={shape.color}
        strokeWidth={width}
        strokeDasharray={LINE_DASH_ARRAY[dash]}
        fill={shape.color}
        fillOpacity={0.14}
        onPointerDown={common.onPointerDown}
        style={{ pointerEvents: interactive ? "all" : "none" }}
      />
    );
  }

  if (shape.tool === "text") {
    const point = shape.points[0];

    if (editing) {
      return (
        <foreignObject x={point.x - 14} y={point.y - 3} width={28} height={7}>
          <input
            autoFocus
            value={shape.text ?? ""}
            onChange={(event) => onText(event.target.value)}
            onBlur={onCloseEdit}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === "Escape") onCloseEdit();
            }}
            aria-label="Texto sobre el campo"
            className="w-full rounded border border-[#C8A96B] bg-[#0B0F14] px-1 text-center text-[3px] text-white outline-none"
            style={{ fontSize: "3px", height: "6px" }}
          />
        </foreignObject>
      );
    }

    /* Un texto vacío no se exporta como «Texto»: en pantalla es el sitio para escribir. */
    if (!shape.text && !interactive) return null;

    return (
      <text
        x={point.x}
        y={point.y}
        textAnchor="middle"
        fontSize={2.2 + width * 1.6}
        fontWeight={700}
        fill={shape.color}
        stroke="rgba(0,0,0,.45)"
        strokeWidth={0.3}
        paintOrder="stroke"
        onPointerDown={(event) => {
          if (!interactive) return;
          event.stopPropagation();
          onErase();
        }}
        onDoubleClick={onEdit}
        style={{ pointerEvents: interactive ? "all" : "none", cursor: "text" }}
      >
        {shape.text || "Texto"}
      </text>
    );
  }

  return (
    <path
      {...common}
      d={pathFrom(shape)}
      strokeDasharray={LINE_DASH_ARRAY[dash]}
      markerEnd={shape.tool === "arrow" ? "url(#tactics-arrow)" : undefined}
    />
  );
}

function TokenButton({
  label,
  icon,
  onClick,
  className,
  title,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  className?: string;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title ?? label}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-2.5 py-2 text-[11px] font-semibold text-white/70 transition hover:bg-white/[0.08] hover:text-white",
        className
      )}
    >
      {icon}
      {label}
    </button>
  );
}
