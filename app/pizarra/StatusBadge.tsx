type Props = {
  estado: string
}

const colors: Record<string, string> = {
  "DISPONIBLE": "bg-green-600",
  "LESIONADO": "bg-red-600",
  "PRIMER EQUIPO": "bg-yellow-500 text-black",
  "SELECCIÓN": "bg-blue-600",
  "SANCIONADO": "bg-zinc-700",
}

export default function StatusBadge({ estado }: Props) {
  return (
    <span
      className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
        colors[estado] || "bg-zinc-600"
      }`}
    >
      {estado}
    </span>
  )
}