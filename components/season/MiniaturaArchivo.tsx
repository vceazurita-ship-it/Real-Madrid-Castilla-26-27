"use client";

/*
| MINIATURA DE UN ARCHIVO (20/11/2026, ronda 7, análisis): la primera página
| del PDF o la propia imagen, en pequeño, para reconocer el material sin
| abrirlo. Si el PDF no se puede leer, queda el icono de documento.
| Sólo la usa el repositorio general (components/season/SeasonWorkspace).
*/

import { useState } from "react";
import { FileText } from "lucide-react";
import { Document, Page, pdfjs } from "react-pdf";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const ANCHO = 48;

export default function MiniaturaArchivo({ url, kind }: { url: string; kind: "images" | "pdfs" }) {
  const [fallo, setFallo] = useState(false);

  const icono = (
    <span className="flex h-full w-full items-center justify-center text-[#C8A96B]">
      <FileText size={18} aria-hidden />
    </span>
  );

  return (
    <span
      aria-hidden
      className="block h-16 w-12 shrink-0 overflow-hidden rounded-md border border-white/15 bg-white/[0.04]"
    >
      {kind === "images" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" />
      ) : fallo ? (
        icono
      ) : (
        <Document file={url} loading={icono} error={icono} onLoadError={() => setFallo(true)}>
          <Page pageNumber={1} width={ANCHO} renderTextLayer={false} renderAnnotationLayer={false} loading={icono} />
        </Document>
      )}
    </span>
  );
}
