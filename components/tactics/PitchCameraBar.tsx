"use client";

/**
 * Barra de cámara de la pizarra.
 *
 * Vive pegada a la esquina superior derecha del campo: elige la perspectiva
 * (retransmisión, cenital, portería, seguir), alterna campo 2D y 3D y deja
 * ajustar a mano la inclinación, el giro y el zoom.
 */

import {
  Compass,
  Crosshair,
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
  /** Oculta los mandos finos en tableros pequeños. */
  compact?: boolean;
}

const MODE_ICON: Record<PitchCameraMode, React.ReactNode> = {
  broadcast: <Video size={13} />,
  top: <Maximize2 size={13} />,
  goal: <Compass size={13} />,
  follow: <Crosshair size={13} />,
};

export default function PitchCameraBar({
  camera,
  follow,
  onFollowChange,
  followedLabel,
  compact = false,
}: Props) {
  const { mode, render, pose } = camera;

  return (
    <div className="flex w-[150px] flex-col gap-1.5 rounded-2xl border border-white/12 bg-[#0B0F14]/85 p-1.5 backdrop-blur-md sm:w-[168px]">
      {/* CAMPO 2D / 3D */}

      <div className="grid grid-cols-2 gap-1 rounded-xl bg-white/[0.05] p-0.5">
        {(["2d", "3d"] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => camera.setRender(option)}
            title={option === "2d" ? "Campo plano" : "Campo con perspectiva"}
            className={cn(
              "rounded-lg px-2 py-1 text-[10px] font-bold uppercase tracking-wider transition",
              render === option
                ? "bg-[#C8A96B] text-[#0B0F14]"
                : "text-white/55 hover:text-white"
            )}
          >
            Pitch {option === "2d" ? "2D" : "3D"}
          </button>
        ))}
      </div>

      {/* MODOS DE CÁMARA */}

      <div className="grid grid-cols-2 gap-1">
        {CAMERA_MODES.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => camera.setMode(item.id)}
            title={item.label}
            className={cn(
              "inline-flex items-center justify-center gap-1 rounded-lg px-1.5 py-1.5 text-[10px] font-semibold transition",
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

      {/* ANCLAJE DEL MODO SEGUIR */}

      {mode === "follow" && (
        <div className="space-y-1 rounded-xl bg-white/[0.04] p-1">
          <div className="grid grid-cols-2 gap-1">
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
                className={cn(
                  "rounded-lg px-1.5 py-1 text-[10px] font-semibold transition",
                  follow === id
                    ? "bg-[#C8A96B] text-[#0B0F14]"
                    : "text-white/55 hover:text-white"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <p className="truncate px-1 text-[9px] leading-tight text-white/40">
            {follow === "player"
              ? followedLabel
                ? `Anclado a ${followedLabel}`
                : "Toca una ficha para anclarla"
              : "Anclado al balón"}
          </p>
        </div>
      )}

      {!compact && (
        <>
          {/* INCLINACIÓN */}

          {render === "3d" && (
            <label className="flex items-center gap-1.5 px-0.5">
              <span className="w-6 shrink-0 text-[9px] font-semibold uppercase tracking-wider text-white/40">
                Tilt
              </span>

              <input
                type="range"
                min={TILT_MIN}
                max={TILT_MAX}
                step={1}
                value={Math.round(pose.tilt)}
                onChange={(event) =>
                  camera.setTilt(Number(event.target.value))
                }
                className="h-1 w-full cursor-pointer appearance-none rounded-full bg-white/15 accent-[#C8A96B]"
              />

              <span className="w-6 shrink-0 text-right text-[9px] tabular-nums text-white/45">
                {Math.round(pose.tilt)}°
              </span>
            </label>
          )}

          {/* ZOOM Y REINICIO */}

          <div className="flex items-center gap-1">
            <IconButton
              title="Alejar"
              onClick={() => camera.zoomBy(1 / 1.16)}
              icon={<Minus size={12} />}
            />

            <span className="flex-1 text-center text-[9px] tabular-nums text-white/45">
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
