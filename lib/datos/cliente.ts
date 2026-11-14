/**
 * `createClient` con reserva (14/11/2026): el de Supabase de siempre, o —si
 * existe DATOS_PG_URL— el de lib/datos/cliente.cjs (Postgres propio + B2).
 * Mismos tipos que supabase-js para que el resto del código no cambie.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const reserva = require("./cliente.cjs") as { createClient: (url: string, clave: string, opciones?: unknown) => unknown; enReserva: () => boolean };

export type { SupabaseClient };

export function createClient(url: string, clave: string, opciones?: unknown): SupabaseClient {
  return reserva.createClient(url, clave, opciones) as SupabaseClient;
}

export const enReserva = () => reserva.enReserva();
