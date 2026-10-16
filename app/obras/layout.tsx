import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { COOKIE_ADMIN, esAdmin } from "@/lib/admin/sesion";

/**
 * LA ZONA DE OBRAS (16/10/2026): lo que se está construyendo, sólo para el
 * administrador. El menú ya no lo enseña a nadie más, pero alguien podría
 * teclear la dirección: aquí se mira la sesión de administrador en el
 * servidor y, sin ella, se va a Ajustes (donde se entra).
 */
export default async function ObrasLayout({ children }: { children: ReactNode }) {
  const almacen = await cookies();

  if (!esAdmin(almacen.get(COOKIE_ADMIN)?.value)) redirect("/ajustes");

  return children;
}
