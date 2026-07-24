"use client";

import { Document, Page, pdfjs } from "react-pdf";

pdfjs.GlobalWorkerOptions.workerSrc =
  `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfPreviewProps {
  file: string;
}

export default function PdfPreview({
  file,
}: PdfPreviewProps) {
  return (
    <div className="flex justify-center overflow-hidden bg-black">
      <Document
        file={file}
        loading={
          <div className="flex h-[500px] items-center justify-center text-white/40">
            Cargando PDF...
          </div>
        }
        error={
          <div className="flex h-[500px] items-center justify-center text-white/40">
            No se pudo cargar la previsualización
          </div>
        }
      >  
        <Page
          pageNumber={1}
          width={900}
          renderTextLayer={false}
          renderAnnotationLayer={false}
        />
      </Document>
    </div>
  );
}