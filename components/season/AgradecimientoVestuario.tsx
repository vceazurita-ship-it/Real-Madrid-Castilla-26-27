"use client";

/*
|--------------------------------------------------------------------------
| LA NOTA PARA EL VESTUARIO RIVAL
|--------------------------------------------------------------------------
|
| Vive en el área general y no en la de partido a propósito: no depende del
| rival, ni de la jornada, ni de nada que haya que rellenar. Es la carta del
| club, siempre la misma, y lo único que hace falta es poder bajarla el viernes
| e imprimirla.
|
| Dos formatos porque se usa de dos maneras: el PDF en A4 es lo que se imprime
| y se deja sobre un banco, y el PPT es para proyectarlo o para que alguien lo
| retoque antes. El dibujo es el mismo y sale de `lib/general/agradecimiento`.
*/

import { useState } from "react";
import { FileText, Presentation } from "lucide-react";
import { toast } from "sonner";

import {
  CIERRE,
  TEXTO,
  exportAgradecimientoPdf,
  exportAgradecimientoPptx,
} from "@/lib/general/agradecimiento";

export default function AgradecimientoVestuario() {
  const [ocupado, setOcupado] = useState<"pdf" | "pptx" | null>(null);

  const descarga = async (formato: "pdf" | "pptx") => {
    setOcupado(formato);

    try {
      const nombre =
        formato === "pdf"
          ? await exportAgradecimientoPdf()
          : await exportAgradecimientoPptx();

      toast.success("Nota de agradecimiento descargada", {
        description: nombre,
      });
    } catch (error) {
      console.error("Error generando la nota de agradecimiento:", error);

      toast.error(
        error instanceof Error
          ? error.message
          : "No se ha podido generar el documento.",
      );
    } finally {
      setOcupado(null);
    }
  };

  const boton =
    "inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <section className="mb-8 overflow-hidden rounded-2xl border border-white/10 bg-[#11161D]">
      <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.28em] text-[#C8A96B]">
            Vestuario rival
          </p>

          <h2 className="mt-2 text-lg font-semibold text-white">
            Nota de agradecimiento
          </h2>

          <p className="mt-1 text-sm leading-6 text-white/50">
            La hoja que se deja en el vestuario local cuando jugamos fuera. Sale
            siempre igual, con el diseño de la casa y sin fecha: se imprime y se
            deja.
          </p>

          {/*
          | Se enseña lo que dice antes de descargarla: quien la lleva al
          | campo tiene que saber qué está entregando en nombre del club sin
          | tener que abrir el fichero.
          */}
          <blockquote className="mt-4 border-l-2 border-[#C8A96B]/40 pl-4 text-sm leading-6 text-white/60">
            {TEXTO.filter(Boolean).join(" ")}{" "}
            <span className="font-semibold text-white/80">{CIERRE}.</span>
          </blockquote>
        </div>

        <div className="flex flex-wrap gap-2 lg:flex-col">
          <button
            type="button"
            onClick={() => descarga("pdf")}
            disabled={ocupado !== null}
            className={`${boton} border-[#C8A96B]/40 bg-[#C8A96B]/10 text-[#C8A96B] hover:bg-[#C8A96B]/20`}
          >
            <FileText size={15} />
            {ocupado === "pdf" ? "Generando…" : "PDF · A4 para imprimir"}
          </button>

          <button
            type="button"
            onClick={() => descarga("pptx")}
            disabled={ocupado !== null}
            className={`${boton} border-white/15 bg-white/[0.04] text-white/75 hover:bg-white/[0.08]`}
          >
            <Presentation size={15} />
            {ocupado === "pptx" ? "Generando…" : "PPT · diapositiva"}
          </button>
        </div>
      </div>
    </section>
  );
}
