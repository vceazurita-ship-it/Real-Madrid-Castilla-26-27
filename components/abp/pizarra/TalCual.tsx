"use client";

/**
 * «Tal cual» (13/11/2026, petición urgente del analista): exactamente las
 * pizarras que se pintan, fotografiadas de la pantalla, en PDF o PowerPoint.
 * No se rehace nada: ver lib/abp/exporta-tal-cual.ts.
 */

import { useState } from "react";
import { toast } from "sonner";

import { fotografiaPizarras, pdfTalCual, pptTalCual } from "@/lib/abp/exporta-tal-cual";

export function TalCual({
  total,
  titulos,
  nombre,
  actual,
  ponPizarra,
  nodo,
  antes,
}: {
  total: number;
  titulos: string[];
  nombre: string;
  /** La pizarra en pantalla: se vuelve a ella al acabar. */
  actual: number;
  ponPizarra: (indice: number) => void;
  nodo: () => HTMLElement | null;
  /** Lo que hay que quitar antes de fotografiar (la selección). */
  antes?: () => void;
}) {
  const [rotulo, setRotulo] = useState<string | null>(null);

  const exporta = async (formato: "pdf" | "pptx") => {
    antes?.();
    setRotulo("Preparando…");
    try {
      const fotos = await fotografiaPizarras(total, ponPizarra, nodo, (hecho, de) => setRotulo(`${hecho}/${de}`));
      if (formato === "pdf") await pdfTalCual(fotos, nombre);
      else await pptTalCual(fotos, titulos, nombre, nombre);
      toast.success(formato === "pdf" ? "PDF listo" : "PowerPoint listo", { description: `${fotos.length} pizarras, tal cual se ven.` });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se ha podido exportar.");
    } finally {
      ponPizarra(actual);
      setRotulo(null);
    }
  };

  return (
    <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1" role="group" aria-label="Exportar las pizarras tal cual se ven">
      <span className="px-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">{rotulo ?? "Tal cual"}</span>
      {(["pdf", "pptx"] as const).map((formato) => (
        <button
          key={formato}
          type="button"
          disabled={rotulo != null}
          onClick={() => void exporta(formato)}
          className="min-h-[36px] rounded-lg px-3 text-xs font-bold text-white/85 hover:bg-white/10 disabled:opacity-50"
        >
          {formato === "pdf" ? "PDF" : "PPT"}
        </button>
      ))}
    </div>
  );
}
