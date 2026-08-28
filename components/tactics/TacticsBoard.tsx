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
  useMemo,
  useRef,
  useState,
} from "react";
import { toPng } from "html-to-image";
import { toast } from "sonner";
import {
  Building2,
  Circle,
  Cone,
  Copy,
  Download,
  Mic,
  Plus,
  PersonStanding,
} from "lucide-react";

import type { Player } from "@/types/player";
import TacticsVoicePanel from "@/components/voice/TacticsVoicePanel";
import EntornoEstadio from "./EntornoEstadio";
import PitchMarkings from "./PitchMarkings";
import RivalPicker from "./RivalPicker";
import PitchStage from "./PitchStage";
import PitchCameraBar, { FollowSubject } from "./PitchCameraBar";
import PitchTimelineBar from "./PitchTimelineBar";
import PlayerFigure from "./PlayerFigure";
import BoardToolPalette from "./BoardToolPalette";
import BoardStyleBar from "./BoardStyleBar";
import { planeDepth, usePitchCamera } from "@/hooks/usePitchCamera";
import { usePitchTimeline } from "@/hooks/usePitchTimeline";
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
  duplicateScene,
  emptyScene,
  interpolateTokens,
  pathFrom,
  rectFrom,
  tacticId,
} from "@/lib/tactics/helpers";
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
import { CAMPOS, CAMPO_POR_DEFECTO } from "@/lib/tactics/campos";
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

/**
 * Nombre cabido bajo una figura.
 *
 * La hoja de scouting guarda el nombre completo ("A. Mayorga Miguel Bañuelos")
 * y bajo la figura eso son tres jugadores de ancho. Se queda el apellido, que
 * es como se le llama en la charla.
 */
function nombreCorto(nombre: string) {
  const limpio = nombre.trim();

  if (limpio.length <= 14) return limpio;

  const partes = limpio.split(/\s+/);
  const ultimo = partes[partes.length - 1];

  return ultimo.length <= 14 ? ultimo : `${limpio.slice(0, 13)}…`;
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
}

export default function TacticsBoard({
  doc,
  onChange,
  roster = [],
  rivalSquads = [],
  lockedRivalTeam,
  singleScene = false,
  hint,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);

  /**
   * Distancia entre el centro de la ficha y el punto donde se agarró.
   *
   * Sin ella la ficha saltaba para centrarse bajo el cursor, un tirón que
   * con el campo inclinado se notaba todavía más.
   */
  const grabRef = useRef<Point | null>(null);

  const [tool, setTool] = useState<ToolId>("select");
  const [color, setColor] = useState(DRAW_COLORS[0]);
  const [strokeWidth, setStrokeWidth] = useState<number>(LINE_WIDTHS[1]);
  const [dash, setDash] = useState<LineDash>("solid");

  const [sceneIndex, setSceneIndex] = useState(0);
  const [draft, setDraft] = useState<TacticShape | null>(null);
  const [draggingToken, setDraggingToken] = useState<string | null>(null);
  const [editingShape, setEditingShape] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [dictating, setDictating] = useState(false);

  const [follow, setFollow] = useState<FollowSubject>("ball");
  const [followId, setFollowId] = useState<string | null>(null);

  const [past, setPast] = useState<TacticsDoc[]>([]);
  const [future, setFuture] = useState<TacticsDoc[]>([]);

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

  // Con la jugada en marcha manda el reproductor; parada, la escena editada.
  const displayIndex = live ? Math.min(timeline.index, scenes.length - 1) : safeIndex;
  const displayScene = scenes[displayIndex] ?? scene;
  const nextScene = scenes[displayIndex + 1];

  const visibleTokens = useMemo(() => {
    if (!live || !nextScene) return displayScene.tokens;

    return interpolateTokens(
      displayScene.tokens,
      nextScene.tokens,
      timeline.t
    );
  }, [live, nextScene, displayScene.tokens, timeline.t]);

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
    if (camera.render !== "3d" || exporting) return visibleTokens;

    const pose = camera.pose;

    return [...visibleTokens].sort(
      (a, b) => planeDepth(pose, a.x, a.y) - planeDepth(pose, b.x, b.y)
    );
  }, [camera.render, camera.pose, exporting, visibleTokens]);

  /** El gesto de cámara se ha llevado el puntero: no dejes nada a medias. */
  const cancelEditGesture = useCallback(() => {
    setDraft(null);
    setDraggingToken(null);
    grabRef.current = null;
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

  const undo = () => {
    const previous = past[past.length - 1];
    if (!previous) return;

    setPast((current) => current.slice(0, -1));
    setFuture((current) => [...current, doc]);
    onChange(previous);
  };

  const redo = () => {
    const next = future[future.length - 1];
    if (!next) return;

    setFuture((current) => current.slice(0, -1));
    setPast((current) => [...current, doc]);
    onChange(next);
  };

  // ---------------------------------------------------------------
  // Dibujo
  // ---------------------------------------------------------------

  function handlePointerDown(event: ReactPointerEvent<SVGSVGElement>) {
    if (live) return;
    if (tool === "select" || tool === "erase" || tool === "camera") return;

    const point = toPitch(event);
    if (!point) return;

    svgRef.current?.setPointerCapture(event.pointerId);

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

    if (draggingToken) {
      // La ficha conserva el punto por el que se agarró.
      const grab = grabRef.current ?? { x: 0, y: 0 };
      const spot = clampToView({ x: point.x + grab.x, y: point.y + grab.y });

      onChange({
        ...doc,
        scenes: doc.scenes.map((item, index) =>
          index === safeIndex
            ? {
                ...item,
                tokens: item.tokens.map((token) =>
                  token.id === draggingToken
                    ? { ...token, x: spot.x, y: spot.y }
                    : token
                ),
              }
            : item
        ),
      });

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

    if (draggingToken) {
      setDraggingToken(null);
      grabRef.current = null;
      // El arrastre ya escribió posiciones; guardamos un punto de deshacer.
      setPast((current) => [...current.slice(-40), doc]);
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

  const addScene = () => {
    const next = duplicateScene(scene, `Escena ${scenes.length + 1}`);

    commit({ ...doc, scenes: [...scenes, next] });
    setSceneIndex(scenes.length);
  };

  const removeScene = (index: number) => {
    if (scenes.length <= 1) return;

    commit({ ...doc, scenes: scenes.filter((_, i) => i !== index) });
    setSceneIndex(Math.max(0, index - 1));
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
  // Exportar
  // ---------------------------------------------------------------

  const exportPng = async () => {
    if (!frameRef.current) return;

    timeline.pause();
    setExporting(true);

    try {
      // Un par de fotogramas para que la cámara ya esté en reposo al capturar.
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      );

      const dataUrl = await toPng(frameRef.current, {
        pixelRatio: 2,
        backgroundColor: "#0B0F14",
        filter: (node) =>
          !(node instanceof HTMLElement) ||
          !node.hasAttribute("data-export-hide"),
      });

      const link = document.createElement("a");
      link.download = `${doc.titulo || "pizarra"}-${scene.nombre}.png`;
      link.href = dataUrl;
      link.click();

      toast.success("Imagen descargada");
    } catch (error) {
      console.error(error);
      toast.error("No se pudo exportar la imagen");
    } finally {
      setExporting(false);
    }
  };

  const canUndo = past.length > 0;
  const canRedo = future.length > 0;

  const clearScene = () =>
    updateScene((current) => ({ ...current, tokens: [], shapes: [] }));

  /**
   * Hay una herramienta de dibujo en la mano.
   *
   * En el móvil decide qué se ve bajo la paleta: el estilo del trazo mientras
   * se dibuja y los mandos de cámara el resto del tiempo. Los dos a la vez no
   * caben sin comerse el campo, que es justo lo que se quería evitar.
   */
  const drawing = tool !== "select" && tool !== "erase" && tool !== "camera";

  const followedLabel =
    follow === "player"
      ? followToken?.nombre ?? followToken?.label ?? undefined
      : undefined;

  return (
    <div className="space-y-3">
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
            icon={<Circle size={14} />}
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
            className="w-full min-w-0 rounded-xl border border-white/10 bg-[#0F141B] px-2.5 py-2 text-[11px] text-white/75 outline-none sm:w-auto"
          >
            <option value="">Añadir jugador…</option>

            {roster.map((player) => (
              <option key={player.id} value={player.id}>
                {player.dorsal ? `${player.dorsal} · ` : ""}
                {player.apodo || player.nombre}
              </option>
            ))}
          </select>
        )}

        <button
          type="button"
          onClick={() => setDictating((open) => !open)}
          title="Explicar la jugada por voz"
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

        <div className="ml-auto flex flex-wrap items-center gap-1">
          {!singleScene && (
            <>
              <TokenButton
                label="Duplicar escena"
                icon={<Copy size={13} />}
                onClick={addScene}
              />
              <TokenButton
                label="Escena vacía"
                icon={<Plus size={13} />}
                onClick={() => {
                  commit({
                    ...doc,
                    scenes: [
                      ...scenes,
                      emptyScene(`Escena ${scenes.length + 1}`),
                    ],
                  });
                  setSceneIndex(scenes.length);
                }}
              />
            </>
          )}

          <button
            type="button"
            title="Descargar PNG"
            disabled={exporting}
            onClick={exportPng}
            className="rounded-xl p-2 text-white/55 transition hover:bg-white/[0.07] hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
          >
            <Download size={15} />
          </button>
        </div>
      </div>

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
        />
      )}

      {/* RECORTE, DISEÑO DEL CAMPO Y ENTORNO */}

      <div
        data-export-hide
        className="flex flex-wrap items-center gap-x-1.5 gap-y-2"
      >
        {(Object.keys(CROP_VIEWBOX) as PitchCrop[]).map((crop) => (
          <button
            key={crop}
            type="button"
            onClick={() => commit({ ...doc, crop })}
            className={cn(
              "rounded-full border px-3 py-1 text-[11px] font-medium transition",
              doc.crop === crop
                ? "border-[#C8A96B]/50 bg-[#C8A96B]/12 text-[#C8A96B]"
                : "border-white/10 bg-white/[0.03] text-white/55 hover:text-white"
            )}
          >
            {CROP_LABEL[crop]}
          </button>
        ))}

        <span className="mx-1 h-4 w-px bg-white/10" />

        {/*
          El campo se elige, no viene dado: la charla a oscuras pide un césped
          apagado que deje ver las flechas, y la imagen que se manda por el
          grupo pide el verde de retransmisión.
        */}
        {CAMPOS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => commit({ ...doc, campo: item.id })}
            title={item.nota}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition",
              campoActivo === item.id
                ? "border-[#C8A96B]/50 bg-[#C8A96B]/12 text-[#C8A96B]"
                : "border-white/10 bg-white/[0.03] text-white/55 hover:text-white"
            )}
          >
            <span
              aria-hidden
              className="h-3 w-3 shrink-0 rounded-[3px]"
              style={{
                background: item.cesped,
                boxShadow: `inset 0 0 0 1px ${item.linea}`,
              }}
            />
            {item.label}
          </button>
        ))}

        <span className="mx-1 h-4 w-px bg-white/10" />

        <button
          type="button"
          onClick={() => commit({ ...doc, entorno: !entornoVisible })}
          title={
            entornoVisible
              ? "Quitar las vallas y el graderío: sólo el campo"
              : "Levantar las vallas y el graderío alrededor del campo"
          }
          aria-pressed={entornoVisible}
          className={cn(
            "flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-medium transition",
            entornoVisible
              ? "border-[#C8A96B]/50 bg-[#C8A96B]/12 text-[#C8A96B]"
              : "border-white/10 bg-white/[0.03] text-white/55 hover:text-white"
          )}
        >
          <Building2 size={12} />
          Graderío
        </button>

        {/*
          Modo jugador: la ficha redonda deja paso a la figura del jugador, con
          su cara y con el cuerpo que le corresponde por altura y peso. En un
          córner se ve de un vistazo quién gana por alto sin abrir la hoja.
        */}
        <button
          type="button"
          onClick={() => commit({ ...doc, figuras: !figurasVisibles })}
          title={
            figurasVisibles
              ? "Volver a las fichas redondas con el dorsal"
              : "Modo jugador: cada ficha se dibuja como el jugador que es (foto, altura y peso)"
          }
          aria-pressed={figurasVisibles}
          className={cn(
            "flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-medium transition",
            figurasVisibles
              ? "border-[#C8A96B]/50 bg-[#C8A96B]/12 text-[#C8A96B]"
              : "border-white/10 bg-white/[0.03] text-white/55 hover:text-white"
          )}
        >
          <PersonStanding size={13} />
          Jugadores
        </button>
      </div>

      {/* CAMPO */}

      <PitchStage
        camera={camera}
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
          <BoardStyleBar
            color={color}
            onColorChange={setColor}
            width={strokeWidth}
            onWidthChange={setStrokeWidth}
            dash={dash}
            onDashChange={setDash}
            disabled={live}
          />
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
          onPointerLeave={handlePointerUp}
          className={cn(
            "block h-full w-full touch-none select-none",
            tool === "select" || tool === "camera"
              ? "cursor-default"
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
          </defs>

          <PitchMarkings campo={campoActivo} />

          {/* Formas */}
          <g>
            {[...displayScene.shapes, ...(draft ? [draft] : [])].map((shape) => (
              <ShapeNode
                key={shape.id}
                shape={shape}
                interactive={!live && (tool === "erase" || tool === "select")}
                editing={editingShape === shape.id}
                onErase={() => tool === "erase" && removeShape(shape.id)}
                onEdit={() => setEditingShape(shape.id)}
                onText={(text) =>
                  updateScene((current) => ({
                    ...current,
                    shapes: current.shapes.map((item) =>
                      item.id === shape.id ? { ...item, text } : item
                    ),
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
                follow === "player" && followId === token.id;

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
                ? 0.24 * medidas.alto * medidas.ancho
                : style.radius;

              /*
                La figura está de pie sobre el punto del campo, así que su
                sombra va a sus pies (y = 0) y el estirado de la perspectiva
                sale de ahí. La ficha redonda, en cambio, flota un poco sobre
                su sombra y se estira desde ella.
              */
              const anclaY = figura ? 0 : style.radius * 0.55;

              return (
                <g
                  key={token.id}
                  transform={`translate(${token.x} ${token.y})`}
                  onPointerDown={(event) => {
                    if (live || tool === "camera") return;

                    if (tool === "erase") {
                      event.stopPropagation();
                      removeToken(token.id);
                      return;
                    }

                    if (tool !== "select") return;

                    const point = toPitch(event);
                    if (!point) return;

                    event.stopPropagation();

                    // La última ficha tocada es la que persigue la cámara.
                    if (token.kind !== "ball") setFollowId(token.id);

                    grabRef.current = {
                      x: token.x - point.x,
                      y: token.y - point.y,
                    };

                    svgRef.current?.setPointerCapture(event.pointerId);
                    setDraggingToken(token.id);
                  }}
                  className={cn(
                    tool === "select" && "cursor-grab",
                    tool === "erase" && "cursor-pointer"
                  )}
                >
                  <title>{tituloFicha(token, perfil, medidas)}</title>

                  {/* Sombra: se queda tumbada en el césped, bajo la ficha. */}
                  <ellipse
                    cx={0}
                    cy={anclaY}
                    rx={medio * (figura ? 1.15 : 0.95)}
                    ry={medio * (figura ? 0.5 : 0.42)}
                    fill="rgba(0,0,0,.38)"
                    style={{ pointerEvents: "none" }}
                  />

                  {/* Marca del anclaje: también pintada sobre el césped. */}
                  {anchored && (
                    <ellipse
                      cx={0}
                      cy={anclaY}
                      rx={medio + 1.1}
                      ry={figura ? (medio + 1.1) * 0.45 : medio + 1.1}
                      fill="none"
                      stroke="#C8A96B"
                      strokeWidth={0.35}
                      strokeDasharray="1 0.8"
                      style={{ pointerEvents: "none" }}
                    />
                  )}

                  {/*
                    La ficha se endereza para que la perspectiva no la
                    aplaste: se estira lo justo para volver a verse redonda.
                    El estirado sale de la sombra hacia arriba, así que la
                    ficha parece de pie sobre el césped en vez de tumbada.
                  */}
                  <g
                    transform={`rotate(${tokenSpin.toFixed(2)}) translate(0 ${anclaY}) scale(1 ${tokenLift.toFixed(3)}) translate(0 ${-anclaY})`}
                    style={{ transition: "transform 190ms ease-out" }}
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
                      height={medidas.alto + 1.4}
                      fill="transparent"
                    />
                  ) : (
                    <circle r={style.radius + 1.4} fill="transparent" />
                  )}

                  {medidas && perfil ? (
                    <PlayerFigure
                      uid={token.id}
                      alto={medidas.alto}
                      ancho={medidas.ancho}
                      kit={EQUIPACIONES[token.kind === "away" ? "away" : "home"]}
                      label={token.label}
                      foto={fotoFigura(perfil.foto)}
                    />
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
                      fontSize={2.4}
                      fontWeight={700}
                      fill={style.text}
                      style={{ pointerEvents: "none" }}
                    >
                      {token.label}
                    </text>
                  )}

                  {/*
                    El nombre. Junto a la figura va más pequeño y con un halo
                    oscuro: al lado de un círculo de cinco unidades de ancho un
                    nombre a cuerpo 1,9 se lee bien, pero junto a una figura
                    —que es alta y estrecha— tapaba a los dos vecinos.
                  */}
                  {token.nombre && (
                    <text
                      y={figura ? 1.5 : style.radius + 2.4}
                      textAnchor="middle"
                      fontSize={figura ? 1.3 : 1.9}
                      fill="rgba(255,255,255,.9)"
                      stroke={figura ? "rgba(0,0,0,.6)" : undefined}
                      strokeWidth={figura ? 0.45 : undefined}
                      paintOrder="stroke"
                      style={{ pointerEvents: "none" }}
                    >
                      {figura ? nombreCorto(token.nombre) : token.nombre}
                    </text>
                  )}
                  </g>
                </g>
              );
            })}
          </g>
        </svg>
      </PitchStage>

      {hint && <p className="text-[11px] leading-relaxed text-white/40">{hint}</p>}
    </div>
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
            className="w-full rounded border border-[#C8A96B] bg-[#0B0F14] px-1 text-center text-[3px] text-white outline-none"
            style={{ fontSize: "3px", height: "6px" }}
          />
        </foreignObject>
      );
    }

    return (
      <text
        x={point.x}
        y={point.y}
        textAnchor="middle"
        fontSize={2.2 + width * 1.6}
        fontWeight={700}
        fill={shape.color}
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
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
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
