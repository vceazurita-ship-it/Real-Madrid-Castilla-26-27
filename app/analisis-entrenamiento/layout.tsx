import { cookies } from "next/headers";
import type { ReactNode } from "react";

import { puedeVerEntreno } from "@/lib/entreno/acceso";
import { ultimaSesionPublica } from "@/lib/entreno/ultima-publica";

import { AccesoEntreno } from "./AccesoEntreno";

/**
 * EL CANDADO DEL ANÁLISIS DE ENTRENAMIENTO (19/10/2026).
 *
 * Mientras estuvo en obras (/obras/entrenamiento) sólo entraba el
 * administrador. Terminado, entra también el cuerpo técnico con su cuenta.
 * Se mira en el servidor —alguien podría teclear la dirección— y, sin
 * sesión, en vez de mandar a otra pantalla se pide entrar aquí mismo: al
 * entrar se vuelve a pedir la página y ya pasa.
 */
export default async function AnalisisEntrenamientoLayout({ children }: { children: ReactNode }) {
  if (puedeVerEntreno(await cookies())) return children;

  /* 16/11/2026 (jueces): la última sesión analizada, sólo lo agregado, encima del acceso. */
  return <AccesoEntreno ultima={await ultimaSesionPublica()} />;
}
