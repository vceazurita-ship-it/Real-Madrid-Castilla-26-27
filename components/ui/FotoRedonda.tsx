"use client";

/**
 * Foto redonda con respaldo (14/11/2026): si la imagen no llega (proxy caído,
 * almacén sin servicio, foto borrada en BeSoccer), salen las iniciales en vez
 * del icono de imagen rota.
 */

import { useState } from "react";

export function FotoRedonda({ src, iniciales, className = "", style }: { src: string | null | undefined; iniciales: string; className?: string; style?: React.CSSProperties }) {
  const [rota, setRota] = useState<string | null>(null);
  if (!src || rota === src) return <span className={`flex items-center justify-center ${className}`} style={style}>{iniciales}</span>;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- foto de la plantilla o de BeSoccer por el proxy propio
    <img src={src} alt="" onError={() => setRota(src)} className={`object-cover object-top ${className}`} style={style} />
  );
}
