"use client";

import {
  PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toPng } from "html-to-image";
import { toast } from "sonner";
import {
  ArrowUpRight,
  Circle,
  Copy,
  Cone,
  Download,
  Eraser,
  Minus,
  MousePointer2,
  Pause,
  Play,
  Plus,
  Redo2,
  Square,
  Trash2,
  Type as TypeIcon,
  Undo2,
  Waves,
} from "lucide-react";

import type { Player } from "@/types/player";
import PitchMarkings from "./PitchMarkings";
import {
  clampToPitch,
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
  PitchCrop,
  Point,
  TacticScene,
  TacticShape,
  TacticToken,
  TacticsDoc,
  TokenKind,
  ToolId,
} from "@/lib/tactics/types";
import { cn } from "@/lib/utils";

const TOOLS: { id: ToolId; label: string; icon: React.ReactNode }[] = [
  { id: "select", label: "Mover", icon: <MousePointer2 size={15} /> },
  { id: "arrow", label: "Desplazamiento", icon: <ArrowUpRight size={15} /> },
  { id: "dashed", label: "Pase", icon: <Minus size={15} /> },
  { id: "line", label: "Línea", icon: <Minus size={15} /> },
  { id: "free", label: "Trazo libre", icon: <Waves size={15} /> },
  { id: "zone", label: "Zona", icon: <Square size={15} /> },
  { id: "text", label: "Texto", icon: <TypeIcon size={15} /> },
  { id: "erase", label: "Borrar", icon: <Eraser size={15} /> },
];

const TOKEN_STYLE: Record<
  TokenKind,
  { fill: string; stroke: string; text: string; radius: number }
> = {
  home: { fill: "#F8FAFC", stroke: "#0B0F14", text: "#0B0F14", radius: 2.4 },
  away: { fill: "#1E293B", stroke: "#F87171", text: "#FFFFFF", radius: 2.4 },
  ball: { fill: "#FDE68A", stroke: "#0B0F14", text: "#0B0F14", radius: 1.3 },
  cone: { fill: "#FB923C", stroke: "#0B0F14", text: "#0B0F14", radius: 1.5 },
};

const ANIMATION_MS = 1100;

interface Props {
  doc: TacticsDoc;
  onChange: (doc: TacticsDoc) => void;
  /** Plantilla real, para añadir fichas con dorsal y nombre. */
  roster?: Player[];
  /** Tablero de una sola escena: oculta la tira de escenas y la animación. */
  singleScene?: boolean;
  /** Texto de ayuda bajo el tablero. */
  hint?: string;
}

export default function TacticsBoard({
  doc,
  onChange,
  roster = [],
  singleScene = false,
  hint,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);

  const [tool, setTool] = useState<ToolId>("select");
  const [color, setColor] = useState(DRAW_COLORS[0]);
  const [sceneIndex, setSceneIndex] = useState(0);
  const [draft, setDraft] = useState<TacticShape | null>(null);
  const [draggingToken, setDraggingToken] = useState<string | null>(null);
  const [editingShape, setEditingShape] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [exporting, setExporting] = useState(false);

  const [past, setPast] = useState<TacticsDoc[]>([]);
  const [future, setFuture] = useState<TacticsDoc[]>([]);

  const scenes = doc.scenes;
  const safeIndex = Math.min(sceneIndex, scenes.length - 1);
  const scene = scenes[safeIndex] ?? emptyScene();

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

  /** Coordenadas del puntero dentro del espacio del campo. */
  const toPitch = useCallback((event: ReactPointerEvent): Point => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };

    const matrix = svg.getScreenCTM();
    if (!matrix) return { x: 0, y: 0 };

    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;

    const local = point.matrixTransform(matrix.inverse());

    return clampToPitch({ x: local.x, y: local.y });
  }, []);

  // ---------------------------------------------------------------
  // Dibujo
  // ---------------------------------------------------------------

  function handlePointerDown(event: ReactPointerEvent<SVGSVGElement>) {
    if (playing) return;
    if (tool === "select" || tool === "erase") return;

    const point = toPitch(event);

    svgRef.current?.setPointerCapture(event.pointerId);

    if (tool === "text") {
      const shape: TacticShape = {
        id: tacticId("shape"),
        tool: "text",
        color,
        points: [point],
        text: "",
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
    });
  }

  function handlePointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    if (playing) return;

    const point = toPitch(event);

    if (draggingToken) {
      onChange({
        ...doc,
        scenes: doc.scenes.map((item, index) =>
          index === safeIndex
            ? {
                ...item,
                tokens: item.tokens.map((token) =>
                  token.id === draggingToken
                    ? { ...token, x: point.x, y: point.y }
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
        const far =
          Math.hypot(point.x - last.x, point.y - last.y) > 0.6;

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
  // Animación entre escenas
  // ---------------------------------------------------------------

  useEffect(() => {
    if (!playing) return;

    let frame = 0;
    let start = 0;
    let index = safeIndex;

    const step = (time: number) => {
      if (!start) start = time;

      const t = Math.min(1, (time - start) / ANIMATION_MS);

      setProgress(t);

      if (t < 1) {
        frame = requestAnimationFrame(step);
        return;
      }

      index += 1;

      if (index >= scenes.length - 1) {
        setSceneIndex(scenes.length - 1);
        setProgress(0);
        setPlaying(false);
        return;
      }

      setSceneIndex(index);
      setProgress(0);
      start = 0;
      frame = requestAnimationFrame(step);
    };

    frame = requestAnimationFrame(step);

    return () => cancelAnimationFrame(frame);
    // Arrancamos la animación desde la escena visible al pulsar reproducir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, scenes.length]);

  const nextScene = scenes[safeIndex + 1];

  const visibleTokens = useMemo(() => {
    if (!playing || !nextScene) return scene.tokens;

    return interpolateTokens(scene.tokens, nextScene.tokens, progress);
  }, [playing, nextScene, scene.tokens, progress]);

  // ---------------------------------------------------------------
  // Exportar
  // ---------------------------------------------------------------

  const exportPng = async () => {
    if (!frameRef.current) return;

    setExporting(true);

    try {
      const dataUrl = await toPng(frameRef.current, {
        pixelRatio: 2,
        backgroundColor: "#0B0F14",
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

  return (
    <div className="space-y-3">
      {/* BARRA DE HERRAMIENTAS */}

      <div
        data-export-hide
        className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-[#11161D] p-2"
      >
        <div className="flex flex-wrap gap-1">
          {TOOLS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTool(item.id)}
              title={item.label}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-[11px] font-semibold transition",
                tool === item.id
                  ? "bg-[#C8A96B] text-[#0B0F14]"
                  : "text-white/60 hover:bg-white/[0.07] hover:text-white",
                item.id === "dashed" && "italic"
              )}
            >
              {item.icon}
              <span className="hidden lg:inline">{item.label}</span>
            </button>
          ))}
        </div>

        <div className="mx-1 h-6 w-px bg-white/10" />

        <div className="flex gap-1">
          {DRAW_COLORS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setColor(option)}
              title="Color de dibujo"
              style={{ backgroundColor: option }}
              className={cn(
                "h-6 w-6 rounded-full border-2 transition",
                color === option
                  ? "scale-110 border-white"
                  : "border-white/20 hover:border-white/50"
              )}
            />
          ))}
        </div>

        <div className="mx-1 h-6 w-px bg-white/10" />

        <div className="flex flex-wrap gap-1">
          <TokenButton
            label="Propio"
            icon={<Circle size={14} />}
            onClick={() => addToken("home")}
          />
          <TokenButton
            label="Rival"
            icon={<Circle size={14} />}
            onClick={() => addToken("away")}
          />
          <TokenButton
            label="Balón"
            icon={<Circle size={12} />}
            onClick={() => addToken("ball")}
          />
          <TokenButton
            label="Cono"
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
            className="rounded-xl border border-white/10 bg-[#0F141B] px-2.5 py-2 text-[11px] text-white/75 outline-none"
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

        <div className="ml-auto flex items-center gap-1">
          <IconButton
            title="Deshacer"
            disabled={!canUndo}
            onClick={undo}
            icon={<Undo2 size={15} />}
          />
          <IconButton
            title="Rehacer"
            disabled={!canRedo}
            onClick={redo}
            icon={<Redo2 size={15} />}
          />
          <IconButton
            title="Vaciar escena"
            onClick={() =>
              updateScene((current) => ({ ...current, tokens: [], shapes: [] }))
            }
            icon={<Trash2 size={15} />}
          />
          <IconButton
            title="Descargar PNG"
            disabled={exporting}
            onClick={exportPng}
            icon={<Download size={15} />}
          />
        </div>
      </div>

      {/* RECORTE DEL CAMPO */}

      <div data-export-hide className="flex flex-wrap items-center gap-1.5">
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
      </div>

      {/* CAMPO */}

      <div
        ref={frameRef}
        className="overflow-hidden rounded-[26px] border border-[#C8A96B]/20 bg-[#0B1A12] shadow-[0_25px_80px_rgba(0,0,0,.5)]"
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
            "block w-full touch-none select-none",
            tool === "select" ? "cursor-default" : "cursor-crosshair"
          )}
          style={{ aspectRatio: aspectOf(doc.crop) }}
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

          <PitchMarkings />

          {/* Formas */}
          <g>
            {[...scene.shapes, ...(draft ? [draft] : [])].map((shape) => (
              <ShapeNode
                key={shape.id}
                shape={shape}
                interactive={tool === "erase" || tool === "select"}
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
            {visibleTokens.map((token) => {
              const style = TOKEN_STYLE[token.kind];

              return (
                <g
                  key={token.id}
                  transform={`translate(${token.x} ${token.y})`}
                  onPointerDown={(event) => {
                    if (playing) return;

                    if (tool === "erase") {
                      event.stopPropagation();
                      removeToken(token.id);
                      return;
                    }

                    if (tool !== "select") return;

                    event.stopPropagation();
                    svgRef.current?.setPointerCapture(event.pointerId);
                    setDraggingToken(token.id);
                  }}
                  className={cn(
                    tool === "select" && "cursor-grab",
                    tool === "erase" && "cursor-pointer"
                  )}
                >
                  <title>{token.nombre ?? token.label}</title>

                  {token.kind === "cone" ? (
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

                  {token.label && token.kind !== "ball" && (
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

                  {token.nombre && (
                    <text
                      y={style.radius + 2.4}
                      textAnchor="middle"
                      fontSize={1.9}
                      fill="rgba(255,255,255,.85)"
                      style={{ pointerEvents: "none" }}
                    >
                      {token.nombre}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      {/* ESCENAS */}

      {!singleScene && (
        <div
          data-export-hide
          className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-[#11161D] p-2"
        >
          <button
            type="button"
            onClick={() => setPlaying((value) => !value)}
            disabled={scenes.length < 2}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#C8A96B]/40 bg-[#C8A96B]/10 px-3 py-2 text-[11px] font-semibold text-[#C8A96B] transition hover:bg-[#C8A96B]/20 disabled:cursor-not-allowed disabled:opacity-35"
          >
            {playing ? <Pause size={14} /> : <Play size={14} />}
            {playing ? "Pausar" : "Animar"}
          </button>

          <div className="mx-1 h-6 w-px bg-white/10" />

          <div className="flex flex-1 flex-wrap gap-1.5">
            {scenes.map((item, index) => (
              <div
                key={item.id}
                className={cn(
                  "flex items-center rounded-xl border transition",
                  index === safeIndex
                    ? "border-[#C8A96B]/50 bg-[#C8A96B]/10"
                    : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
                )}
              >
                <button
                  type="button"
                  onClick={() => {
                    setPlaying(false);
                    setSceneIndex(index);
                  }}
                  className={cn(
                    "px-2.5 py-2 text-[11px] font-semibold",
                    index === safeIndex ? "text-[#C8A96B]" : "text-white/60"
                  )}
                >
                  {index + 1}. {item.nombre}
                </button>

                {scenes.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeScene(index)}
                    title="Eliminar escena"
                    className="rounded-lg p-1.5 text-white/30 transition hover:bg-red-500/15 hover:text-red-300"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addScene}
            className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-white/20 px-3 py-2 text-[11px] font-semibold text-white/60 transition hover:border-[#C8A96B]/50 hover:text-[#C8A96B]"
          >
            <Copy size={13} />
            Duplicar escena
          </button>

          <button
            type="button"
            onClick={() => {
              commit({ ...doc, scenes: [...scenes, emptyScene(`Escena ${scenes.length + 1}`)] });
              setSceneIndex(scenes.length);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-white/20 px-3 py-2 text-[11px] font-semibold text-white/60 transition hover:border-[#C8A96B]/50 hover:text-[#C8A96B]"
          >
            <Plus size={13} />
            Escena vacía
          </button>
        </div>
      )}

      {hint && <p className="text-[11px] leading-relaxed text-white/40">{hint}</p>}
    </div>
  );
}

/** Proporción del recorte, para que el SVG no deforme el campo. */
function aspectOf(crop: PitchCrop) {
  const [, , width, height] = CROP_VIEWBOX[crop].split(" ").map(Number);
  return `${width} / ${height}`;
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
  const common = {
    stroke: shape.color,
    strokeWidth: 0.5,
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
        strokeWidth={0.5}
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
        fontSize={3}
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
      strokeDasharray={shape.tool === "dashed" ? "1.6 1.2" : undefined}
      markerEnd={shape.tool === "arrow" ? "url(#tactics-arrow)" : undefined}
    />
  );
}

function TokenButton({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-2.5 py-2 text-[11px] font-semibold text-white/70 transition hover:bg-white/[0.08] hover:text-white"
    >
      {icon}
      {label}
    </button>
  );
}

function IconButton({
  title,
  icon,
  onClick,
  disabled = false,
}: {
  title: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className="rounded-xl p-2 text-white/55 transition hover:bg-white/[0.07] hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
    >
      {icon}
    </button>
  );
}
