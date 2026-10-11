"use client";

/**
 * Laboratorio · Robos y transiciones.
 *
 * La pantalla vive en `components/transiciones/PantallaTransiciones.tsx` y se
 * comparte con «Pérdidas y transiciones defensivas» (`/laboratorio/perdidas`),
 * que es su espejo: aquí, lo que hacemos con el balón robado; allí, lo que
 * hace el rival con el que perdemos.
 */

import { PantallaTransiciones } from "@/components/transiciones/PantallaTransiciones";

export default function TransicionesPage() {
  return <PantallaTransiciones modo="robos" />;
}
