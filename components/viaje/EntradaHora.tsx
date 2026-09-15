"use client";

/**
 * Un campo de hora que deja escribir.
 *
 * El de antes reescribía la hora con cada tecla: al teclear «1» se convertía
 * en «01:00» y el «8» siguiente ya no cabía, así que poner «18:30» era casi
 * imposible salvo con las flechitas de cinco en cinco. Aquí se escribe en
 * borrador y la hora se da por buena **al salir del campo o con Intro**:
 *
 * - Vale «18:30», «18.30», «18h30», «1830» y «18» a secas.
 * - Las flechas del teclado suben y bajan cinco minutos.
 * - Escape deja la que había.
 * - Una cita de madrugada (minutos de 1440 en adelante) sigue en la
 *   madrugada: se escribe «03:15» y no salta al amanecer del mismo día.
 */

import { useState } from "react";

import { aHora, aMinutos } from "@/lib/viaje/modelo";

export function EntradaHora({
  minuto,
  onCambia,
  permiteVacio = false,
  placeholder = "hh:mm",
  className = "",
  titulo,
  etiqueta,
}: {
  /** La hora que hay, en minutos desde medianoche; `null` si todavía no hay. */
  minuto: number | null;
  /** Se llama al terminar de escribir, no con cada tecla. */
  onCambia: (minuto: number | null) => void;
  /** Deja borrarla: la hora del partido puede quedarse en blanco. */
  permiteVacio?: boolean;
  placeholder?: string;
  className?: string;
  titulo?: string;
  /** Para lectores de pantalla, cuando no hay `<label>` alrededor. */
  etiqueta?: string;
}) {
  /* Lo que se está tecleando; `null` mientras no se escribe. */
  const [borrador, setBorrador] = useState<string | null>(null);

  const mostrado = borrador ?? (minuto === null ? "" : aHora(minuto));

  const malo = borrador !== null && borrador.trim() !== "" && aMinutos(borrador) === null;

  /* La madrugada se queda en la madrugada. */
  const base = minuto !== null && minuto >= 1440 ? 1440 : 0;

  const confirma = () => {
    if (borrador === null) return;

    const texto = borrador.trim();

    setBorrador(null);

    if (!texto) {
      if (permiteVacio && minuto !== null) onCambia(null);

      return;
    }

    const leido = aMinutos(texto);

    /* Lo que no se entiende no borra lo que había. */
    if (leido === null) return;

    const nuevo = leido >= 1440 ? leido : leido + base;

    if (nuevo !== minuto) onCambia(nuevo);
  };

  return (
    <input
      value={mostrado}
      inputMode="numeric"
      placeholder={placeholder}
      title={titulo ?? "Escribe la hora (18:30, 1830…) y sal del campo o pulsa Intro. Flechas: ±5 min."}
      aria-label={etiqueta}
      aria-invalid={malo || undefined}
      onFocus={(evento) => evento.currentTarget.select()}
      onChange={(evento) => setBorrador(evento.target.value)}
      onBlur={confirma}
      onKeyDown={(evento) => {
        if (evento.key === "Enter") {
          evento.currentTarget.blur();

          return;
        }

        if (evento.key === "Escape") {
          setBorrador(null);
          evento.currentTarget.blur();

          return;
        }

        if ((evento.key === "ArrowUp" || evento.key === "ArrowDown") && minuto !== null) {
          evento.preventDefault();

          setBorrador(null);

          onCambia(Math.max(0, minuto + (evento.key === "ArrowUp" ? 5 : -5)));
        }
      }}
      className={`${className} ${malo ? "!border-rose-400/70" : ""}`}
    />
  );
}
