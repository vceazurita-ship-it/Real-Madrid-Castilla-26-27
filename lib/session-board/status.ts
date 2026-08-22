import type { EstadoJugador } from "@/types/player";

interface StatusTheme {
  short: string;
  label: string;
  ring: string;
  dot: string;
  chip: string;
}

const DEFAULT: StatusTheme = {
  short: "—",
  label: "Sin estado",
  ring: "ring-white/25",
  dot: "bg-white/40",
  chip: "border-white/15 bg-white/5 text-white/70",
};

const THEMES: Partial<Record<EstadoJugador, StatusTheme>> = {
  "ÓPTIMO": {
    short: "OPT",
    label: "Óptimo",
    ring: "ring-emerald-400",
    dot: "bg-emerald-400",
    chip: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  },
  DISPONIBLE: {
    short: "OPT",
    label: "Disponible",
    ring: "ring-emerald-400",
    dot: "bg-emerald-400",
    chip: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  },
  "CONTROL DE CARGA": {
    short: "CARGA",
    label: "Control de carga",
    ring: "ring-yellow-400",
    dot: "bg-yellow-400",
    chip: "border-yellow-400/30 bg-yellow-400/10 text-yellow-300",
  },
  TOCADO: {
    short: "TOC",
    label: "Tocado",
    ring: "ring-orange-400",
    dot: "bg-orange-400",
    chip: "border-orange-400/30 bg-orange-400/10 text-orange-300",
  },
  "REINCORPORACIÓN": {
    short: "REINC",
    label: "Reincorporación",
    ring: "ring-sky-400",
    dot: "bg-sky-400",
    chip: "border-sky-400/30 bg-sky-400/10 text-sky-300",
  },
  SANCIONADO: {
    short: "SANC",
    label: "Sancionado",
    ring: "ring-rose-400",
    dot: "bg-rose-400",
    chip: "border-rose-400/30 bg-rose-400/10 text-rose-300",
  },
  LESIONADO: {
    short: "LES",
    label: "Lesionado",
    ring: "ring-red-500",
    dot: "bg-red-500",
    chip: "border-red-500/30 bg-red-500/10 text-red-300",
  },
  "PRIMER EQUIPO": {
    short: "1EQ",
    label: "Primer equipo",
    ring: "ring-violet-400",
    dot: "bg-violet-400",
    chip: "border-violet-400/30 bg-violet-400/10 text-violet-300",
  },
  "SELECCIÓN": {
    short: "SEL",
    label: "Selección",
    ring: "ring-cyan-400",
    dot: "bg-cyan-400",
    chip: "border-cyan-400/30 bg-cyan-400/10 text-cyan-300",
  },
};

export function statusTheme(estado: EstadoJugador | undefined): StatusTheme {
  return (estado && THEMES[estado]) || DEFAULT;
}
