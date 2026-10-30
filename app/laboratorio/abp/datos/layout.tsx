import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { COOKIE_ADMIN, esAdmin } from "@/lib/admin/sesion";

/**
 * EL BALÓN PARADO DE CADA LIGA (20/10/2026): sólo para el administrador, como
 * todo el laboratorio de ABP. Sin la sesión de administrador, a Ajustes (donde
 * se entra). Mismo candado que `app/obras/layout.tsx`.
 */
export default async function DatosAbpLayout({ children }: { children: ReactNode }) {
  const almacen = await cookies();

  if (!esAdmin(almacen.get(COOKIE_ADMIN)?.value)) redirect(`/ajustes?vuelta=${encodeURIComponent("/laboratorio/abp/datos")}`); /* 30/10/2026: vuelve aquí tras entrar. */

  return children;
}
