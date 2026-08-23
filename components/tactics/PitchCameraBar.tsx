"use client";

/**
 * Barra de cámara de la pizarra.
 *
 * Elige la perspectiva (retransmisión, cenital, portería, seguir), alterna
 * campo plano y con perspectiva y deja ajustar a mano la inclinación, el giro
 * y el zoom.
 *
 * En pantalla grande vive pegada a la esquina superior derecha del campo. En
 * móvil se reparte en filas dentro del muelle que hay bajo el campo (`dock`):
 * flotando ocupaba casi la mitad del ancho del césped y tapaba justo la zona
 * donde se dibuja.
 *
 * El interruptor 2D/3D y los modos no se pisan: elegir un modo enciende la
 * perspectiva que ese modo necesita, así que un clic basta.
 */

import {
  ChevronLeft,
  ChevronRight,
  Compass,
  Crosshair,
  FlipHorizontal,
  Maximize2,
  Minus,
  Plus,
  RotateCcw,
  Video,
} from "lucide-react";

import {
  CAMERA_MODES,
  PitchCamera,
  PitchCameraMode,
  TILT_MAX,
  TILT_MIN,
} from "@/hooks/usePitchCamera";
import { cn } from "@/lib/utils";

/** A quién persigue el modo «Seguir». */
export type FollowSubject = "ball" | "player";

interface Props {
  camera: PitchCamera;
  follow: FollowSubject;
  onFollowChange: (subject: FollowSubject) => void;
  /** Nombre del jugador anclado, si hay alguno seleccionado. */
  followedLabel?: string;
  /** Oculta los mandos finos: tilt, giro y zoom. */
  compact?: boolean;
  /** Versión en filas para el muelle del móvil. */
  dock?: boolean;
}

const MODE_ICON: Record<PitchCameraMode, React.ReactNode> = {
  broadcast: <Video size={13} />,
  top: <Maximize2 size={13} />,
  goal: <Compass size={13} />,
  follow: <Crosshair size={13} />,
};

/** Paso del giro con los botones, en grados. */
const YAW_STEP = 15;

export default function PitchCameraBar({
  camera,
  follow,
  onFollowChange,
  followedLabel,
  compact = false,
  dock = false,
}: Props) {
  const { mode, render, pose } = camera;

  /** Giro en 0..359, que es como se lee de un vistazo. */
  const yaw = Math.round(((pose.yaw % 360) + 360) % 360);

  /* CAMPO PLANO O CON PERSPECTIVA */

  const renderToggle = (
    <div
      className={cn(
        "grid grid-cols-2 gap-1 rounded-xl bg-white/[0.05] p-0.5",
        dock && "w-24 shrink-0"
      )}
    >
      {(["2d", "3d"] as const).map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => camera.setRender(option)}
          title={
            option === "2d"
              ? "Campo plano, visto desde arriba"
              : "Campo con perspectiva"
          }
          aria-pressed={render === option}
          className={cn(
            "rounded-lg px-2 text-[10px] font-bold uppercase tracking-wider transition",
            dock ? "py-1.5" : "py-1",
            render === option
              ? "bg-[#C8A96B] text-[#0B0F14]"
              : "text-white/55 hover:text-white"
          )}
        >
          {option === "2d" ? "Plano" : "3D"}
        </button>
      ))}
    </div>
  );

  /* MODOS DE CÁMARA */

  const modes = (
    <div className={cn("grid grid-cols-2 gap-1", dock && "flex-1 grid-cols-4")}>
      {CAMERA_MODES.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => camera.setMode(item.id)}
          title={item.label}
          aria-pressed={mode === item.id}
          className={cn(
            "inline-flex items-center justify-center gap-1 rounded-lg px-1.5 py-1.5 text-[10px] font-semibold transition",
            // En cuatro columnas estrechas el nombre no cabe al lado del icono.
            dock && "min-w-0 flex-col gap-0.5 text-[9px] leading-none",
            mode === item.id
              ? "bg-[#C8A96B]/18 text-[#C8A96B] ring-1 ring-[#C8A96B]/45"
              : "bg-white/[0.04] text-white/55 hover:bg-white/[0.09] hover:text-white"
          )}
        >
          {MODE_ICON[item.id]}
          {item.short}
        </button>
      ))}
    </div>
  );

  /* ANCLAJE DEL MODO SEGUIR */

  const anchor = mode === "follow" && (
    <div
      className={cn(
        "rounded-xl bg-white/[0.04] p-1",
        dock ? "flex items-center gap-2" : "space-y-1"
      )}
    >
      <div className={cn("grid grid-cols-2 gap-1", dock && "w-36 shrink-0")}>
        {(
          [
            ["ball", "Balón"],
            ["player", "Jugador"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => onFollowChange(id)}
            aria-pressed={follow === id}
            className={cn(
              "rounded-lg px-1.5 text-[10px] font-semibold transition",
              dock ? "py-1.5" : "py-1",
              follow === id
                ? "bg-[#C8A96B] text-[#0B0F14]"
                : "text-white/55 hover:text-white"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <p className="min-w-0 truncate px-1 text-[9px] leading-tight text-white/40">
        {follow === "player"
          ? followedLabel
            ? `Anclado a ${followedLabel}`
            : "Ancla una ficha tocándola con Mover"
          : "Anclado al balón"}
      </p>
    </div>
  );

  /* INCLINACIÓN */

  const tilt = render === "3d" && (
    <label className={cn("flex items-center gap-1.5 px-0.5", dock && "flex-1")}>
      <span className="w-6 shrink-0 text-[9px] font-semibold uppercase tracking-wider text-white/40">
        Tilt
      </span>

      <input
        type="range"
        min={TILT_MIN}
        max={TILT_MAX}
        step={1}
        value={Math.round(pose.tilt)}
        onChange={(event) => camera.setTilt(Number(event.target.value))}
        title="Inclinación de la cámara"
        className="h-1 w-full cursor-pointer appearance-none rounded-full bg-white/15 accent-[#C8A96B]"
      />

      <span className="w-6 shrink-0 text-right text-[9px] tabular-nums text-white/45">
        {Math.round(pose.tilt)}°
      </span>
    </label>
  );

  /*
   * Girar el campo es lo que más se pide: ver la jugada desde la banda
   * contraria o darle la vuelta para atacar hacia el otro lado. Con solo el
   * arrastre había que acertar con el ángulo.
   */

  const spin = render === "3d" && (
    <div className={cn("flex items-center gap-0.5 px-0.5", dock && "shrink-0")}>
      <span className="w-6 shrink-0 text-[9px] font-semibold uppercase tracking-wider text-white/40">
        Giro
      </span>

      <IconButton
        title={`Girar ${YAW_STEP}° a la izquierda`}
        onClick={() => camera.setYaw(pose.yaw - YAW_STEP)}
        icon={<ChevronLeft size={12} />}
      />

      <span
        className={cn(
          "text-center text-[9px] tabular-nums text-white/45",
          dock ? "w-8" : "flex-1"
        )}
      >
        {yaw}°
      </span>

      <IconButton
        title={`Girar ${YAW_STEP}° a la derecha`}
        onClick={() => camera.setYaw(pose.yaw + YAW_STEP)}
        icon={<ChevronRight size={12} />}
      />

      <IconButton
        title="Ver desde el otro lado"
        onClick={() => camera.setYaw(pose.yaw + 180)}
        icon={<FlipHorizontal size={12} />}
      />
    </div>
  );

  /* ZOOM Y REINICIO */

  const zoom = (
    <div className={cn("flex items-center gap-1", dock && "shrink-0")}>
      <IconButton
        title="Alejar"
        onClick={() => camera.zoomBy(1 / 1.16)}
        icon={<Minus size={12} />}
      />

      <span
        className={cn(
          "text-center text-[9px] tabular-nums text-white/45",
          dock ? "w-10" : "flex-1"
        )}
      >
        {pose.zoom.toFixed(2)}×
      </span>

      <IconButton
        title="Acercar"
        onClick={() => camera.zoomBy(1.16)}
        icon={<Plus size={12} />}
      />

      <IconButton
        title="Volver a la vista del modo"
        onClick={camera.reset}
        icon={<RotateCcw size={12} />}
        active={camera.adjusted}
      />
    </div>
  );

  /*
   * Muelle del móvil: la vista y los modos en una fila y los mandos finos en
   * otra, que solo aparece con la herramienta de cámara en la mano.
   */
  if (dock) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          {renderToggle}
          {modes}
        </div>

        {anchor}

        {!compact && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            {tilt}
            {spin}
            {zoom}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex w-[150px] flex-col gap-1.5 rounded-2xl border border-white/12 bg-[#0B0F14]/85 p-1.5 backdrop-blur-md sm:w-[168px]">
      {renderToggle}
      {modes}
      {anchor}

      {!compact && (
        <>
          {tilt}
          {spin}
          {zoom}
        </>
      )}
    </div>
  );
}

function IconButton({
  title,
  icon,
  onClick,
  active = false,
}: {
  title: string;
  icon: React.ReactNode;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        "rounded-lg p-1.5 transition",
        active
          ? "bg-[#C8A96B]/18 text-[#C8A96B]"
          : "text-white/50 hover:bg-white/[0.09] hover:text-white"
      )}
    >
      {icon}
    </button>
  );
}
