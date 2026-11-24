import type { Metadata } from "next";

import { SalaPartido } from "@/components/sala/SalaPartido";

export const metadata: Metadata = { title: "Sala de partido · RMCF Castilla" };

/* 24/11/2026: el directo de Opta como sala de control (components/sala). */
export default function DirectoPage() {
  return <SalaPartido />;
}
