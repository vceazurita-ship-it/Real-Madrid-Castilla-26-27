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
  if (players.length === 0) return null;

  //----------------------------------
  // Tamaño automático
  //----------------------------------

  let size = mobile ? 42 : 58;

  switch (players.length) {
    case 1:
      size = mobile ? 50 : 68;
      break;

    case 2:
      size = mobile ? 46 : 60;
      break;

    case 3:
      size = mobile ? 42 : 56;
      break;

    case 4:
      size = mobile ? 40 : 52;
      break;

    default:
      size = mobile ? 36 : 46;
      break;
  }

  //----------------------------------
  // Columnas
  //----------------------------------

  let columns = 1;

  if (players.length === 2)
    columns = 2;

  if (players.length === 3)
    columns = 2;

  if (players.length === 4)
    columns = 2;

  if (players.length >= 5)
    columns = 3;

  //----------------------------------

  return (
    <div
      className="grid gap-1 justify-items-center"
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
            nombre={player.nombre}
            licencia={player.licencia}
            estado={player.estado}
            mobile={mobile}
          />
        </div>
      ))}
    </div>
  );
}