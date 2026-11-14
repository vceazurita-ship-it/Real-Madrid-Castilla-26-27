"use client";

/**
 * RECORDATORIO DIARIO DE LA BASE DE DATOS (14/11/2026, petición del analista).
 *
 * Supabase está cortado por cuota y la app corre con el plan B: un Postgres
 * gratis de Render que caduca el 14/12/2026. Cada mañana (la primera vez que
 * entra en el día) se le recuerda SÓLO al administrador (la sesión de Ajustes,
 * la de v.ceazurita@gmail.com) para que se ponga solución. Se cierra y no
 * vuelve hasta el día siguiente (recordado en este aparato). Quitar cuando la
 * base de datos esté resuelta de forma definitiva.
 */

import { useState } from "react";
import { Database, X } from "lucide-react";

import { useAdmin } from "@/hooks/useAdmin";

const CLAVE = "rmcf:aviso-base-datos";
const CADUCA = "2026-12-14";

const hoy = () => new Date().toLocaleString("sv-SE", { timeZone: "Europe/Madrid" }).slice(0, 10);

export function AvisoBaseDatos() {
  const { admin } = useAdmin();
  /* Lo de este aparato y la cuenta de días, al montar (no en cada pintado: regla de pureza). */
  const [vistoHoy, setVistoHoy] = useState(() => {
    if (typeof window === "undefined") return true;
    try {
      return localStorage.getItem(CLAVE) === hoy();
    } catch {
      return false;
    }
  });
  const [quedan] = useState(() => Math.ceil((Date.parse(`${CADUCA}T00:00:00+01:00`) - Date.now()) / 86_400_000));
  const abierto = admin === true && !vistoHoy;

  const cierra = () => {
    try {
      localStorage.setItem(CLAVE, hoy());
    } catch {
      /* nada */
    }
    setVistoHoy(true);
  };

  if (!abierto) return null;
  return (
    <div className="modal-veil fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-labelledby="aviso-bd-titulo">
      <div className="w-full max-w-md rounded-2xl border border-amber-500/50 bg-[#141414] p-5 text-white shadow-2xl">
        <div className="mb-3 flex items-start justify-between gap-3">
          <p id="aviso-bd-titulo" className="flex items-center gap-2 text-base font-semibold">
            <Database size={18} className="text-amber-400" aria-hidden />
            Pendiente: la base de datos
          </p>
          <button type="button" onClick={cierra} aria-label="Cerrar" className="rounded-lg p-1 text-white/60 hover:text-white">
            <X size={16} />
          </button>
        </div>
        <div className="space-y-2 text-sm text-white/80">
          <p>
            Supabase sigue cortado por pasar la cuota de almacenamiento del plan gratis. La app funciona con el <b>plan B</b>: una base de datos gratis en Render.
          </p>
          <p className="font-semibold text-amber-300">
            Esa base caduca el 14/12/2026{quedan != null ? ` (quedan ${quedan} días)` : ""}: si no se resuelve antes, se pierden los datos nuevos.
          </p>
          <p className="text-white/70">Opciones: pasar Supabase a Pro, esperar al nuevo ciclo (10/12) y copiar los datos de vuelta, o pasar la base de Render a un plan de pago.</p>
          <p className="text-xs text-white/50">Este aviso sólo lo ves tú (administrador) y sale una vez al día.</p>
        </div>
        <button type="button" onClick={cierra} className="mt-4 min-h-[44px] w-full rounded-xl bg-amber-500 px-4 text-sm font-bold text-black hover:brightness-110">
          Entendido, hoy no más
        </button>
      </div>
    </div>
  );
}
