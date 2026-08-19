"use client";

import { useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";

pdfjs.GlobalWorkerOptions.workerSrc =
  `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfPreviewProps {
  file: string;
}

export default function PdfPreview({ file }: PdfPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // La página se renderiza a un ancho fijo en píxeles, así que hay que medir el
  // contenedor para que no se desborde en pantallas estrechas.
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = containerRef.current;

    if (!element) return;

    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.round(entry.contentRect.width));
    });

    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="flex justify-center overflow-hidden bg-black">
      <Document
        file={file}
        loading={
          <div className="flex h-[420px] items-center justify-center text-sm text-white/40">
            Cargando PDF...
          </div>
        }
        error={
          <div className="flex h-[420px] items-center justify-center text-sm text-white/40">
            No se pudo cargar la previsualización
          </div>
        }
      >
        {width > 0 && (
          <Page
            pageNumber={1}
            width={Math.min(width, 900)}
            renderTextLayer={false}
            renderAnnotationLayer={false}
          />
        )}
      </Document>
    </div>
  );
}
