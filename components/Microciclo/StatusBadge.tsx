import { EstadoJugador } from "@/types/player";
import { getStatusBadge } from "@/lib/PlayerStatus";

interface StatusBadgeProps {
  estado: EstadoJugador;
}

export default function StatusBadge({
  estado,
}: StatusBadgeProps) {
  const badge = getStatusBadge(estado);

  if (!badge) return null;

  return (
    <span
      className={`
        inline-flex
        items-center
        rounded-full
        border
        px-2
        py-1
        text-[10px]
        font-semibold
        uppercase
        tracking-wide
        ${badge.color}
      `}
    >
      {badge.text}
    </span>
  );
}