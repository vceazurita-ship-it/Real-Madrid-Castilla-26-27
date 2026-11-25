import { cookies } from "next/headers";
import type { ReactNode } from "react";

import { PuertaJugadoresRival } from "@/components/laboratorio/PuertaJugadoresRival";
import { COOKIE_ADMIN, esAdmin } from "@/lib/admin/sesion";

/**
 * SÓLO EL ADMINISTRADOR (26/11/2026), como el laboratorio de clips rivales:
 * sin su sesión el contenido ni se manda.
 */
export default async function ClipsPropiosLayout({ children }: { children: ReactNode }) {
  const almacen = await cookies();

  if (!esAdmin(almacen.get(COOKIE_ADMIN)?.value)) return <PuertaJugadoresRival titulo="Clips de los nuestros" />;

  return children;
}
