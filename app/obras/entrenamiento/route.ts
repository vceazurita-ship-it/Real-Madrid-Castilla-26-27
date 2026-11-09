import { NextRequest, NextResponse } from "next/server";
import { urlPublica } from "@/lib/origen";

/**
 * EL ANÁLISIS DE ENTRENAMIENTO SE HA MUDADO (19/10/2026).
 *
 * Salió de obras y vive en /analisis-entrenamiento. Esta dirección queda para
 * los enlaces y marcadores que ya apuntaban aquí. Es un manejador y no una
 * página a propósito: los manejadores no pasan por `app/obras/layout.tsx`,
 * cuyo candado (sólo el administrador) mandaría al cuerpo técnico a Ajustes
 * antes de llegar a la redirección. El candado de verdad está en la nueva
 * dirección.
 */
export function GET(request: NextRequest) {
  const destino = urlPublica("/analisis-entrenamiento", request);

  destino.search = request.nextUrl.search;

  return NextResponse.redirect(destino, 308);
}
