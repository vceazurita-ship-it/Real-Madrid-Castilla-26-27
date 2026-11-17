import type { Player } from "@/types/player";

/**
 * UN SOLO NOMBRE CORTO (17/11/2026, ronda 19, jueces de fútbol): la lista del
 * once decía «Dani» y el campo, Duelos y el Plan «Yáñez». La regla es la de
 * Duelos (`conNombreCorto`, lib/duelos-onces.ts): el apodo de la plantilla si
 * nadie más de la plantilla lo comparte; si no, el apellido («Daniel Yáñez» →
 * «Yáñez»).
 */
export function nombreCortoUnico(p: Pick<Player, "id" | "nombre" | "apodo">, plantilla: Pick<Player, "id" | "nombre" | "apodo">[]): string {
  const corto = (p.apodo || p.nombre || "").trim();
  const repetido = plantilla.some((o) => o.id !== p.id && (o.apodo || o.nombre || "").trim().toLowerCase() === corto.toLowerCase());

  if (!repetido) return corto;

  const partes = (p.nombre || "").trim().split(/\s+/);

  return partes.length > 1 ? partes.slice(1).join(" ") : corto;
}
