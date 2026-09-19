/**
 * Dejar un encargo y leer cómo van, desde el servidor.
 *
 * Aparte de `lib/mantenimiento.ts` porque éste tira de `docStore`, que lleva la
 * llave de servicio de Supabase y no puede llegar nunca al navegador.
 */

import { readDoc, writeDoc } from "@/lib/docStore";
import {
  CLAVE_MANTENIMIENTO,
  CLAVE_VIGIA,
  normalizaMantenimiento,
  type Mantenimiento,
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
 * Se relee el documento justo antes de escribir y sólo cambia el trozo de esa
 * tarea: el vigía escribe en el mismo documento cuando empieza y cuando acaba.
 */
export async function pideEncargo(tarea: Tarea, quien: string): Promise<Mantenimiento> {
  const { data } = await readDoc<unknown>(CLAVE_MANTENIMIENTO);

  const estado = normalizaMantenimiento(data);

  const nuevo: Mantenimiento = {
    ...estado,
    [tarea]: {
      ...estado[tarea],
      pedidoEn: new Date().toISOString(),
      pedidoPor: quien,
    },
  };

  await writeDoc(CLAVE_MANTENIMIENTO, "mantenimiento", nuevo);

  return nuevo;
}
