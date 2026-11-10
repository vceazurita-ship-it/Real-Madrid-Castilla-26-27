/**
 * EL SELLO DE LA FUENTE (10/11/2026, fase 3 de Wyscout + Opta).
 *
 * Una chapa pequeña debajo (o al lado) de una cifra: de qué fuente sale, con
 * quién se compara y hasta dónde llega («Opta · grupo (20 equipos) · J11»).
 * La regla, en `lib/fuentes.ts`: la fuente va aquí, nunca en el título.
 *
 * - `oscuro`: para los paneles que son oscuros en los dos temas (la tarjeta
 *   del estadio de la portada): colores en línea, que la tabla del modo día
 *   no los toque. Sin él, las clases de siempre, que `globals.css` traduce.
 * - `NotaMetodo`: la nota corta de `discrepancia()` cuando las dos fuentes
 *   difieren de verdad. Sin nota, no pinta nada.
 */

import { chipInk } from "@/lib/theme";
import { NOMBRE_FUENTE, selloTexto, type Fuente } from "@/lib/fuentes";

/** Un punto de color por fuente, para reconocerla de un vistazo. */
const COLOR_FUENTE: Record<Fuente, string> = { opta: "#60A5FA", wyscout: "#F7D98B" };

type Props = {
  fuente: Fuente;
  /** «grupo (20 equipos)», «40 equipos». */
  poblacion?: string;
  /** «J11», «8 nov». */
  hasta?: string;
  /** N.º de partidos del equipo o del jugador. */
  partidos?: number;
  /** Qué mide, para el `title` (la definición de esa fuente). */
  detalle?: string;
  oscuro?: boolean;
  className?: string;
};

export function SelloFuente({ fuente, poblacion, hasta, partidos, detalle, oscuro, className = "" }: Props) {
  const texto = selloTexto({ fuente, poblacion, hasta, partidos });
  const color = COLOR_FUENTE[fuente];

  return (
    <span
      className={`inline-flex max-w-full items-center gap-1.5 rounded-full px-2 py-0.5 text-[10.5px] font-medium leading-tight tracking-normal normal-case ${
        oscuro ? "" : "bg-white/[0.04] text-white/55"
      } ${className}`}
      style={oscuro ? { color: "rgba(255,255,255,.72)", backgroundColor: "rgba(255,255,255,.07)" } : undefined}
      title={detalle ? `${NOMBRE_FUENTE[fuente]}: ${detalle}` : texto}
    >
      <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: oscuro ? color : chipInk(color) }} />
      <span className="min-w-0 truncate">{texto}</span>
    </span>
  );
}

/** La nota de método cuando dos fuentes no casan (texto de `discrepancia()`). */
export function NotaMetodo({ nota, oscuro, className = "" }: { nota: string | null | undefined; oscuro?: boolean; className?: string }) {
  if (!nota) return null;

  return (
    <p
      className={`text-[11px] italic leading-snug ${oscuro ? "" : "text-white/50"} ${className}`}
      style={oscuro ? { color: "rgba(255,255,255,.62)" } : undefined}
    >
      {nota}
    </p>
  );
}
