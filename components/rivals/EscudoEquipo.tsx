"use client";

import { useState } from "react";

/*
|--------------------------------------------------------------------------
| ESCUDO DE UN CLUB RIVAL
|--------------------------------------------------------------------------
|
| El mismo hueco tanto si hay escudo como si no: con él, el escudo encajado
| entero; sin él, la inicial del club. Que la caja mida siempre igual es lo que
| impide que el selector de equipos baile cada vez que a BeSoccer se le
| escapa un escudo o que el documento de estadísticas sea anterior a que el
| script los bajara.
|
| El escudo viene de `cdn.resfu.com` y se pide directamente desde el navegador:
| aquí sólo se pinta en pantalla, no se lee en un `<canvas>`, así que no hace
| falta pasar por `/api/rivals/foto`. Quien sí lo necesita es la exportación
| —el PDF del once y la portada del jugador—, porque ahí los píxeles se leen.
*/

export function EscudoEquipo({
  nombre,
  escudo,
  lado = 22,
  className = "",
}: {
  nombre: string;
  escudo?: string;
  /** Lado de la caja en píxeles. */
  lado?: number;
  className?: string;
}) {
  const [roto, setRoto] = useState(false);

  return (
    <span
      aria-hidden
      style={{ width: lado, height: lado, fontSize: Math.round(lado * 0.46) }}
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/[0.06] font-bold text-white/45 ${className}`}
    >
      {escudo && !roto ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={escudo}
          alt=""
          loading="lazy"
          onError={() => setRoto(true)}
          className="h-full w-full object-contain"
        />
      ) : (
        (nombre || "?").charAt(0).toUpperCase()
      )}
    </span>
  );
}

export default EscudoEquipo;
