import { EstadoJugador } from "@/types/player";

interface StatusBadgeProps {
  estado: EstadoJugador;
}

const colors: Record<EstadoJugador, string> = {
  DISPONIBLE: "bg-green-600 text-white",
  LESIONADO: "bg-red-600 text-white",
  "PRIMER EQUIPO": "bg-yellow-400 text-black",
  SELECCIÓN: "bg-blue-600 text-white",
  SANCIONADO: "bg-zinc-600 text-white",
};

export default function StatusBadge({
  estado,
}: StatusBadgeProps) {
  return (
    <span
      className={`
        inline-flex
        items-center
        rounded-full
        px-2
        py-1
        text-[10px]
        font-semibold
        uppercase
        tracking-wide
        ${colors[estado]}
      `}
    >
      {estado}
    </span>
  );
}