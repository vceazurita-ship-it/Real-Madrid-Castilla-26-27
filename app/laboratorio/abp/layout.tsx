import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { COOKIE_ADMIN, esAdmin } from "@/lib/admin/sesion";

/**
 * EL LABORATORIO DE ABP ES DEL ADMINISTRADOR (20/10/2026).
 *
 * «Solo que lo vea yo»: el menú no lo enseña a nadie más, y por si alguien
 * teclea la dirección, aquí se mira la sesión de administrador en el
 * servidor. Vale también para todo lo que cuelga (/laboratorio/abp/datos).
 */
export default async function LaboratorioAbpLayout({ children }: { children: ReactNode }) {
  const almacen = await cookies();

  if (!esAdmin(almacen.get(COOKIE_ADMIN)?.value)) redirect(`/ajustes?vuelta=${encodeURIComponent("/laboratorio/abp")}`); /* 30/10/2026: vuelve aquí tras entrar. */

  return children;
}
