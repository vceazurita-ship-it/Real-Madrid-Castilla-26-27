import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { COOKIE_ADMIN, esAdmin } from "@/lib/admin/sesion";

/**
 * LA ZONA DE OBRAS (16/10/2026): lo que se está construyendo, sólo para el
 * administrador. El menú ya no lo enseña a nadie más, pero alguien podría
 * teclear la dirección: aquí se mira la sesión de administrador en el
 * servidor y, sin ella, se va a Ajustes (donde se entra).
 *
 * El análisis de entrenamiento salió de aquí el 19/10/2026 (ahora en
 * /analisis-entrenamiento, con su propio candado); /obras/entrenamiento es un
 * manejador que redirige, y los manejadores no pasan por este candado.
 */
export default async function ObrasLayout({ children }: { children: ReactNode }) {
  const almacen = await cookies();

  if (!esAdmin(almacen.get(COOKIE_ADMIN)?.value)) redirect("/ajustes");

  return children;
}
