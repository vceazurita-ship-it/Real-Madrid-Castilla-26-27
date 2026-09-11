"use client";

/**
 * Ver el PDF antes de bajarlo.
 *
 * Hasta ahora los documentos del rival —el once probable, la hoja del portero—
 * salían a ciegas: se pulsaba, se descargaba y había que abrir la carpeta para
 * saber si había salido bien. Con doce fichas por hoja y una plantilla que
 * cambia cada semana, el fallo se descubría con el documento ya repartido.
 *
 * **No se renderiza con una librería, se le da al navegador.** El PDF ya está
 * montado en memoria; un `blob:` dentro de un `<iframe>` abre el visor del
 * propio Chrome, con sus páginas, su zoom y su búsqueda, y sin depender de un
 * `pdf.worker` traído de un CDN —que además no está disponible sin red—.
 *
 * La dirección del blob se revoca al cerrar: si no, el documento entero se
 * queda en memoria hasta recargar la página, y son varios megas por vista.
 */

import { useEffect, useMemo } from "react";
import { Download, Loader2, X } from "lucide-react";

export function VistaPreviaPdf({
  titulo,
  subtitulo,
  blob,
  nombre,
  onDescargar,
  onCerrar,
}: {
  titulo: string;
  subtitulo?: string;
  /** El documento ya montado. `null` mientras se está montando. */
  blob: Blob | null;
  nombre: string;
  onDescargar: () => void;
  onCerrar: () => void;
}) {
  /* La dirección se deriva del documento en lugar de guardarse en un estado:
     con un efecto habría un render de más —y el linter de React lo prohíbe—
     con el visor en blanco antes de tener a dónde apuntar. */
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : ""), [blob]);

  /* Pero soltarla sí es cosa de un efecto: son varios megas por vista, y sin
     revocarla se quedan en memoria hasta recargar la página. */
  useEffect(() => {
    if (!url) return;

    return () => URL.revokeObjectURL(url);
  }, [url]);

  /* Escape cierra: es un visor, no hay nada que perder al salir. */
  useEffect(() => {
    const tecla = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") onCerrar();
    };

    window.addEventListener("keydown", tecla);

    return () => window.removeEventListener("keydown", tecla);
  }, [onCerrar]);

  return (
    <div
      className="modal-veil fixed inset-0 z-[80] flex items-center justify-center bg-black/85 p-3 sm:p-6"
      onClick={onCerrar}
    >
      <div
        className="flex h-full w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/12 bg-[#11161C]"
        onClick={(evento) => evento.stopPropagation()}
      >
        <header className="flex flex-wrap items-center gap-3 border-b border-white/10 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{titulo}</p>

            {subtitulo && (
              <p className="mt-0.5 truncate text-[11px] text-white/40">
                {subtitulo}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onDescargar}
            disabled={!blob}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#C8A96B] px-3.5 py-2 text-sm font-semibold text-black transition hover:bg-[#d9bd82] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Download size={14} />
            Descargar
          </button>

          <button
            type="button"
            onClick={onCerrar}
            title="Cerrar (Esc)"
            className="rounded-xl border border-white/12 p-2 text-white/60 transition hover:border-white/25 hover:text-white"
          >
            <X size={14} />
          </button>
        </header>

        <div className="min-h-0 flex-1 bg-black">
          {url ? (
            <iframe
              src={url}
              title={nombre}
              className="h-full w-full border-0"
            />
          ) : (
            <div className="flex h-full items-center justify-center gap-2 text-sm text-white/40">
              <Loader2 size={15} className="animate-spin" />
              Montando el documento…
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
