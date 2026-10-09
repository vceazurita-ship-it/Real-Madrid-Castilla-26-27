/**
 * Dejar un encargo y leer cómo van, desde el servidor.
 *
 * Aparte de `lib/mantenimiento.ts` porque éste tira de `docStore`, que lleva la
 * llave de servicio de Supabase y no puede llegar nunca al navegador.
 */

import { cambiaDoc, readDoc } from "@/lib/docStore";
import {
  CLAVE_MANTENIMIENTO,
  CLAVE_VIGIA,
  normalizaMantenimiento,
  type Mantenimiento,
  type DatosCarpeta,
  type Tarea,
  type Vigia,
} from "@/lib/mantenimiento";

export async function leeMantenimiento(): Promise<{
  estado: Mantenimiento;
  vigia: Vigia | null;
}> {
  const [encargos, latido] = await Promise.all([
    readDoc<unknown>(CLAVE_MANTENIMIENTO),
    readDoc<Vigia>(CLAVE_VIGIA),
  ]);

  return { estado: normalizaMantenimiento(encargos.data), vigia: latido.data ?? null };
}

/**
 * Apunta el pedido de una tarea sin tocar las demás.
 *
 * Sólo cambia el trozo de esa tarea, y la escritura es condicional (`cambiaDoc`):
 * el vigía escribe en el mismo documento cuando empieza y cuando acaba.
 */
export async function pideEncargo(
  tarea: Tarea,
  quien: string,
  datos?: DatosCarpeta,
  plan?: number[],
): Promise<Mantenimiento> {
  const pedidoEn = new Date().toISOString();

  return cambiaDoc<Mantenimiento>(CLAVE_MANTENIMIENTO, "mantenimiento", (data) => {
    const estado = normalizaMantenimiento(data);

    return {
      ...estado,
      [tarea]: {
        ...estado[tarea],
        pedidoEn,
        pedidoPor: quien,
        ...(datos ? { datos } : {}),
        /* Cada pedido dice el suyo: uno sin plan es «todo», y no hereda el
           plan de la vez anterior. */
        plan: plan?.length ? plan : undefined,
      },
    };
  });
}
