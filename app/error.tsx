"use client";

/**
 * CUANDO UNA PANTALLA REVIENTA.
 *
 * Las pantallas de esta app son componentes de cliente de miles de líneas,
 * y hasta el 11/10/2026 una excepción en cualquiera de ellas —una hoja con
 * una columna de menos, un dato que no era un número— dejaba la pantalla en
 * blanco sin decir nada. Esto la recoge: dice qué ha fallado, ofrece volver
 * a intentarlo (que vuelve a montar la pantalla) y volver a la portada. El
 * menú no se pinta porque es parte de lo que puede haber fallado.
 */

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, Home, RefreshCw } from "lucide-react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    /* Que quede en la consola: es lo que se mira después para arreglarlo. */
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0B0F14] px-4 text-white">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <AlertTriangle size={22} className="shrink-0 text-amber-300" />
          <h1 className="text-lg font-semibold">Esta pantalla se ha roto</h1>
        </div>

        <p className="mt-3 text-sm text-white/70">
          Lo que tenías guardado no se ha perdido: los guardados van aparte de la pantalla. Suele ser un dato
          raro en una hoja o un corte de red a medio cargar.
        </p>

        {error?.message && (
          <p className="mt-3 break-words rounded-xl border border-white/10 bg-black/30 px-3 py-2 font-mono text-[11px] text-white/55">
            {error.message}
            {error.digest ? ` · ${error.digest}` : ""}
          </p>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-xl border border-[#C8A96B]/40 bg-[#C8A96B]/15 px-4 py-2 text-sm text-[#C8A96B] transition hover:bg-[#C8A96B]/25"
          >
            <RefreshCw size={14} />
            Volver a intentarlo
          </button>

          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-4 py-2 text-sm text-white/85 transition hover:border-white/30"
          >
            <Home size={14} />
            Ir a la portada
          </Link>
        </div>
      </div>
    </main>
  );
}
