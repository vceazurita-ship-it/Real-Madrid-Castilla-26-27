"use client";

import { pesoEnLaDireccion, TOPE_TEXTO_HOJA } from "@/lib/guardaTextoHoja";

/**
 * Aviso bajo un cuadro de texto que se acerca a lo que admite la hoja
 * (19/10/2026). Antes no se veía hasta que el guardado fallaba; así se sabe
 * mientras se escribe. Se cuenta en «peso» codificado, no en letras: una
 * tilde pesa como seis letras. No dice nada mientras quede holgura.
 */
export function AvisoLargo({ texto }: { texto: string }) {
  const peso = pesoEnLaDireccion(texto);

  if (peso < TOPE_TEXTO_HOJA * 0.8) return null;

  const pasado = peso > TOPE_TEXTO_HOJA;
  const porcentaje = Math.round((peso / TOPE_TEXTO_HOJA) * 100);

  return (
    <p
      role={pasado ? "alert" : "status"}
      className={
        pasado
          ? "mt-2 text-xs text-red-300"
          : "mt-2 text-xs text-amber-300"
      }
    >
      {pasado
        ? `Este texto es demasiado largo para la hoja (${porcentaje} % de lo que admite): puede no guardarse. Acórtalo o pártelo en dos.`
        : `Texto largo: ya ocupa el ${porcentaje} % de lo que admite la hoja.`}
    </p>
  );
}
