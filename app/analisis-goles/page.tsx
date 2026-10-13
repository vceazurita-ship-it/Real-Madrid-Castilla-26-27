"use client";

/**
 * Análisis de goles (13/10/2026): nuestros y de toda la liga por franjas de
 * minutos, local y visitante, remates y tipología. La pantalla vive en
 * `components/goles/PantallaGoles.tsx` y los datos en `lib/goles/analisis.ts`.
 */

import { PantallaGoles } from "@/components/goles/PantallaGoles";

export default function AnalisisGolesPage() {
  return <PantallaGoles />;
}
