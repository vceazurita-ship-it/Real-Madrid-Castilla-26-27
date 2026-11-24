import { cookies } from "next/headers";
import type { ReactNode } from "react";

import { PuertaJugadoresRival } from "@/components/laboratorio/PuertaJugadoresRival";
import { COOKIE_ADMIN, esAdmin } from "@/lib/admin/sesion";

/**
 * SÓLO EL ADMINISTRADOR (24/11/2026): «en una sección que sólo vea yo». El
 * menú no la enseña a nadie más y, por si alguien teclea la dirección, aquí se
 * mira la sesión en el servidor: sin ella, el contenido ni se manda.
 */
export default async function JugadoresRivalLayout({ children }: { children: ReactNode }) {
  const almacen = await cookies();

  if (!esAdmin(almacen.get(COOKIE_ADMIN)?.value)) return <PuertaJugadoresRival />;

  return children;
}
