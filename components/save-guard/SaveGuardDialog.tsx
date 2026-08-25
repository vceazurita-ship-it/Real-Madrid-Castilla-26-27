"use client";

/*
|--------------------------------------------------------------------------
| AVISO DE GUARDADO INCOMPLETO
|--------------------------------------------------------------------------
|
| Se abre cuando `useSaveGuard` detecta que el servidor no ha conservado todo
| lo que se le envió. A partir de ese momento el único sitio donde vive el
| trabajo del usuario es la pantalla, así que el diálogo:
|
|   · no se cierra con Esc ni pulsando fuera (un despiste no puede tirarlo),
|   · deja el formulario abierto y con el texto intacto detrás,
|   · y ofrece sacar el contenido a TXT o CSV antes de tocar nada.
|
| El botón principal es quedarse. Salir no se ofrece: para eso está el propio
| formulario, que sigue vivo debajo.
*/

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  ClipboardCopy,
  FileDown,
  Table2,
} from "lucide-react";
import { toast } from "sonner";

import {
  CampoPerdido,
  explicarMotivo,
  resumirPerdida,
} from "@/lib/save-guard/verificar";
import {
  ContenidoRescatable,
  copiarAlPortapapeles,
  descargarCsv,
  descargarTxt,
} from "@/lib/save-guard/exportar";

interface SaveGuardDialogProps {
  titulo: string;
  perdidos: CampoPerdido[];
  registro: Record<string, unknown>;
  /** Cierra el aviso dejando el formulario abierto y editable. */
  onSeguirEditando: () => void;
}

export function SaveGuardDialog({
  titulo,
  perdidos,
  registro,
  onSeguirEditando,
}: SaveGuardDialogProps) {
  const [exportado, setExportado] = useState(false);

  const contenido: ContenidoRescatable = useMemo(
    () => ({ titulo, registro, perdidos }),
    [titulo, registro, perdidos]
  );

  /* Bloquea el scroll del fondo, igual que el resto de modales de la app. */
  useEffect(() => {
    const anterior = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = anterior;
    };
  }, []);

  /* Esc no cierra: la salida tiene que ser una decisión, no un reflejo. */
  useEffect(() => {
    const tragarEscape = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") {
        evento.preventDefault();
        evento.stopPropagation();
      }
    };

    window.addEventListener("keydown", tragarEscape, true);

    return () => window.removeEventListener("keydown", tragarEscape, true);
  }, []);

  const columnasQueFaltan = perdidos
    .filter((perdido) => perdido.motivo === "columna-inexistente")
    .map((perdido) => perdido.campo);

  const marcarExportado = () => setExportado(true);

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="save-guard-titulo"
      className="modal-veil fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-sm"
    >
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-amber-400/30 bg-[#11161C] shadow-2xl">
        {/* ----------------------------------------------------- CABECERA */}
        <div className="flex items-start gap-4 border-b border-white/10 bg-amber-400/[0.06] px-6 py-5">
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-400/15">
            <AlertTriangle className="h-5 w-5 text-amber-400" />
          </div>

          <div className="min-w-0">
            <h2 id="save-guard-titulo" className="text-lg font-bold text-white">
              El guardado no ha conservado todo
            </h2>

            <p className="mt-1 text-sm text-white/70">
              El servidor ha aceptado la petición, pero{" "}
              <strong className="text-amber-300">
                {resumirPerdida(perdidos).toLowerCase()}
              </strong>
              . Tu texto sigue aquí, en pantalla:{" "}
              <strong className="text-white/90">
                no recargues ni cierres la página
              </strong>{" "}
              hasta haberlo exportado.
            </p>
          </div>
        </div>

        {/* -------------------------------------------------------- CUERPO */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/50">
            {titulo}
          </p>

          <ul className="mt-3 space-y-3">
            {perdidos.map((perdido) => (
              <li
                key={perdido.campo}
                className="rounded-xl border border-white/10 bg-white/[0.03] p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm font-semibold text-amber-300">
                    {perdido.campo}
                  </span>

                  <span className="rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 text-[11px] text-white/60">
                    {explicarMotivo(perdido.motivo)}
                  </span>
                </div>

                <pre className="mt-2 max-h-32 overflow-y-auto whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-white/80">
                  {perdido.enviado}
                </pre>
              </li>
            ))}
          </ul>

          {columnasQueFaltan.length > 0 && (
            <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <p className="text-sm font-semibold text-white/85">
                Por qué ha pasado
              </p>

              <p className="mt-1 text-sm leading-relaxed text-white/65">
                La hoja de destino no tiene estas columnas, así que el servidor
                las descarta sin avisar. Para arreglarlo hay que añadirlas a la
                fila de cabeceras con este nombre exacto:
              </p>

              <p className="mt-2 font-mono text-xs leading-relaxed text-amber-300/90">
                {columnasQueFaltan.join("   ·   ")}
              </p>
            </div>
          )}
        </div>

        {/* ------------------------------------------------------ ACCIONES */}
        <div className="flex flex-col gap-3 border-t border-white/10 bg-white/[0.02] px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                descargarTxt(contenido);
                marcarExportado();
                toast.success("Copia descargada en TXT");
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm font-medium text-white transition hover:bg-white/[0.09]"
            >
              <FileDown className="h-4 w-4" />
              Descargar TXT
            </button>

            <button
              type="button"
              onClick={() => {
                descargarCsv(contenido);
                marcarExportado();
                toast.success("Copia descargada en CSV");
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm font-medium text-white transition hover:bg-white/[0.09]"
            >
              <Table2 className="h-4 w-4" />
              Descargar CSV
            </button>

            <button
              type="button"
              onClick={async () => {
                const copiado = await copiarAlPortapapeles(contenido);

                if (copiado) {
                  marcarExportado();
                  toast.success("Contenido copiado al portapapeles");
                } else {
                  toast.error(
                    "El navegador no ha dejado copiar. Usa la descarga."
                  );
                }
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm font-medium text-white transition hover:bg-white/[0.09]"
            >
              <ClipboardCopy className="h-4 w-4" />
              Copiar
            </button>
          </div>

          <button
            type="button"
            onClick={onSeguirEditando}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#C8A96B] px-4 py-2 text-sm font-semibold text-[#0B0F14] transition hover:brightness-110"
          >
            {exportado && <Check className="h-4 w-4" />}
            Seguir aquí sin cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
