import { cookies } from "next/headers";
import type { ReactNode } from "react";

import { PuertaLaboratorio } from "@/components/abp-lab/PuertaLaboratorio";
import { COOKIE_ADMIN, esAdmin } from "@/lib/admin/sesion";

/**
 * EL LABORATORIO DE ABP ES DEL ADMINISTRADOR (20/10/2026).
 *
 * «Solo que lo vea yo»: el menú no lo enseña a nadie más, y por si alguien
 * teclea la dirección, aquí se mira la sesión de administrador en el
 * servidor. Vale también para todo lo que cuelga (/laboratorio/abp/datos).
 *
 * 07/11/2026: sin sesión ya no se manda a Ajustes («Poner al día», que no
 * decía dónde se estaba, y la vuelta perdía ?seccion= y ?accion=). Se pinta
 * la puerta del laboratorio en la misma dirección y, al entrar, se recarga.
 * El contenido (children) no se manda al navegador sin sesión.
 */
export default async function LaboratorioAbpLayout({ children }: { children: ReactNode }) {
  const almacen = await cookies();

  if (!esAdmin(almacen.get(COOKIE_ADMIN)?.value)) return <PuertaLaboratorio />;

  return children;
}
