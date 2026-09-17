"use client";

import Image from "next/image";

import { fotoDe, inicialDe, PERSONA_POR_SLUG } from "@/lib/quiniela/staff";

/**
 * La cara de alguien del cuerpo técnico, o su inicial si todavía no tiene foto.
 *
 * Las dieciocho fotos vinieron de una tanda de recortes del club y quien se
 * incorpora después no está en ella —Alberto Isla, sin ir más lejos—. Pedir su
 * `.webp` dejaría el hueco roto en las tres pantallas donde sale, así que aquí
 * se decide una vez: si hay foto se pinta, y si no, su inicial sobre el dorado
 * de la casa. En cuanto llegue la foto, se quita la marca `sinFoto` y este
 * componente se entera solo.
 */
export function Avatar({
  slug,
  lado = 28,
}: {
  slug: string;
  /** Alto y ancho en píxeles. */
  lado?: number;
}) {
  const foto = fotoDe(slug);

  const nombre = PERSONA_POR_SLUG.get(slug)?.nombre ?? "";

  if (foto) {
    return (
      <Image
        src={foto}
        alt=""
        width={lado}
        height={lado}
        title={nombre}
        className="shrink-0 rounded-full object-cover"
        style={{ width: lado, height: lado }}
      />
    );
  }

  return (
    <span
      title={`${nombre} · todavía sin foto`}
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-full border border-[#C8A96B]/40 bg-[#C8A96B]/15 font-semibold text-[#C8A96B]"
      style={{ width: lado, height: lado, fontSize: Math.round(lado * 0.42) }}
    >
      {inicialDe(slug)}
    </span>
  );
}

export default Avatar;
