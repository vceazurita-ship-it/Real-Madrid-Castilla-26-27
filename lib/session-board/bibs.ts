import type { BibColor } from "./types";

interface BibTheme {
  label: string;
  short: string;
  /** Relleno de la zona del equipo dentro del campograma. */
  zone: string;
  /** Borde de la zona. */
  zoneBorder: string;
  /** Ficha del jugador. */
  chip: string;
  /** Punto de color en leyendas y selectores. */
  dot: string;
  /** Texto de acento del equipo. */
  text: string;
}

export const BIB_ORDER: BibColor[] = [
  "amarillo",
  "naranja",
  "verde",
  "sin-peto",
];

export const BIBS: Record<BibColor, BibTheme> = {
  amarillo: {
    label: "Amarillo",
    short: "AMA",
    zone: "bg-yellow-400/12",
    zoneBorder: "border-yellow-300/45",
    chip: "border-yellow-300 bg-yellow-400/85 text-[#1A1400]",
    dot: "bg-yellow-400",
    text: "text-yellow-300",
  },

  naranja: {
    label: "Naranja",
    short: "NAR",
    zone: "bg-orange-500/12",
    zoneBorder: "border-orange-400/45",
    chip: "border-orange-300 bg-orange-500/85 text-[#1A0C00]",
    dot: "bg-orange-500",
    text: "text-orange-300",
  },

  verde: {
    label: "Verde",
    short: "VER",
    zone: "bg-emerald-500/12",
    zoneBorder: "border-emerald-400/45",
    chip: "border-emerald-300 bg-emerald-500/85 text-[#04140C]",
    dot: "bg-emerald-500",
    text: "text-emerald-300",
  },

  "sin-peto": {
    label: "Sin peto",
    short: "S/P",
    zone: "bg-white/[0.07]",
    zoneBorder: "border-white/35",
    chip: "border-white/70 bg-white/90 text-[#0B0F14]",
    dot: "bg-white",
    text: "text-white",
  },
};

export function bibTheme(color: BibColor): BibTheme {
  return BIBS[color] ?? BIBS["sin-peto"];
}
