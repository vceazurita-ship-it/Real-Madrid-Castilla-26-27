"use client";

/*
|--------------------------------------------------------------------------
| AVISO FIJO DE COLUMNAS QUE LA HOJA NO ACEPTA
|--------------------------------------------------------------------------
|
| Con autoguardado, el aviso a pantalla completa del save-guard solo sale la
| primera vez que aparece una columna perdida: repetirlo cada pocos segundos
| convertiría la página en un campo de minas y enseñaría a cerrarlo sin leer.
|
| Lo que no puede desaparecer es el hecho: mientras la hoja no tenga esas
| cabeceras, lo que se escriba ahí no se guarda en ningún sitio. Esta banda se
| queda fija arriba y lo dice con nombre y apellidos.
*/

import { AlertTriangle } from "lucide-react";

export function ColumnasPerdidas({ columnas }: { columnas: string[] }) {
  if (!columnas.length) return null;

  return (
    <div
      data-export-hide
      role="alert"
      className="mb-5 flex flex-col gap-2 rounded-2xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-200 sm:flex-row sm:items-start sm:gap-3"
    >
      <AlertTriangle size={18} className="mt-0.5 shrink-0 text-red-300" />

      <div className="min-w-0">
        <p className="font-semibold text-red-100">
          {columnas.length === 1
            ? "Un campo no se está guardando"
            : `${columnas.length} campos no se están guardando`}
        </p>

        <p className="mt-1 text-red-200/80">
          La hoja de destino no tiene estas columnas, así que lo que escribas
          en ellas se descarta al guardar:{" "}
          <span className="font-mono text-red-100">{columnas.join(", ")}</span>.
        </p>

        <p className="mt-1 text-[12px] text-red-200/60">
          Añade esas cabeceras a la hoja RIVALES y el autoguardado empezará a
          conservarlas. Mientras tanto, copia ese texto a otro sitio.
        </p>
      </div>
    </div>
  );
}

export default ColumnasPerdidas;
