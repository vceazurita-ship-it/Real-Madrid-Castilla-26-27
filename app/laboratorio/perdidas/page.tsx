"use client";

/**
 * Laboratorio · Pérdidas y transiciones defensivas (11/10/2026).
 *
 * El espejo de «Robos y transiciones»: cada vez que perdemos el balón en
 * juego, qué es lo primero que hace el rival con él y en qué acaba su
 * posesión. Misma pantalla (`components/transiciones/PantallaTransiciones.tsx`),
 * mismos filtros, mismos datos (`lib/transiciones/datos.ts`, campo
 * `perdidas`, que escribe `scripts/partido/perdidas.cjs` desde el timeline de
 * Hudl de cada partido).
 */

import { PantallaTransiciones } from "@/components/transiciones/PantallaTransiciones";

export default function PerdidasPage() {
  return <PantallaTransiciones modo="perdidas" />;
}
