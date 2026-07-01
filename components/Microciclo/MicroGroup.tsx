"use client";

import MicroFieldPlayer from "./FieldPlayer";
import { Player } from "@/types/player";

interface Props {
  players: Player[];
  positionId: string;
  mobile?: boolean;
}

export default function MicroGroup({
  players,
  positionId,
  mobile = false,
}: Props) {
  if (!players.length) return null;

  let size = mobile ? 30 : 58;

switch (players.length) {
  case 1:
    size = mobile ? 36 : 68;
    break;

  case 2:
    size = mobile ? 32 : 60;
    break;

  case 3:
    size = mobile ? 28 : 56;
    break;

  case 4:
    size = mobile ? 26 : 52;
    break;

  default:
    size = mobile ? 24 : 46;
    break;
}

  const columns =
    players.length <= 1
      ? 1
      : players.length <= 4
      ? 2
      : 3;

  const visibleNames = players.slice(0, 3);
  const hiddenPlayers = players.length - 3;

  return (
    <div className="flex flex-col items-center">

      <div
        className={`
  grid
  justify-items-center
  ${mobile ? "gap-0.5" : "gap-1"}
`}
        style={{
          gridTemplateColumns: `repeat(${columns}, auto)`,
        }}
      >
        {players.map((player) => (
          <div
            key={player.id}
            style={{
              width: size,
              height: size,
            }}
          >
            <MicroFieldPlayer
              id={player.id}
              positionId={positionId}
              foto={player.foto}
              nombre={player.apodo || player.nombre}
              licencia={player.licencia}
              estado={player.estado}
              mobile={mobile}
              showName={players.length === 1}
            />
          </div>
        ))}
      </div>

      {players.length > 1 && (
        <div
          className={`
  ${mobile ? "mt-1 px-2 py-1" : "mt-2 px-3 py-1.5"}
  rounded-xl
  bg-black/70
  backdrop-blur
  text-center
  shadow-lg
`}
        >
          {visibleNames.map((player) => (
            <div
              key={player.id}
              className={`
                leading-tight
                font-medium
                text-white
                ${mobile ? "text-[9px]" : "text-[10px]"}
              `}
            >
              {player.nombre}
            </div>
          ))}

          {hiddenPlayers > 0 && (
            <div
              className={`
                font-bold
                text-[#C8A96B]
                ${mobile ? "text-[9px]" : "text-[10px]"}
              `}
            >
              +{hiddenPlayers}
            </div>
          )}
        </div>
      )}

    </div>
  );
}