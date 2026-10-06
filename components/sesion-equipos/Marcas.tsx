/**
 * Las dos marcas de la equipación en pequeño (06/10/2026): el escudo del club
 * (public/logo.png) y las tres barras de Adidas, dibujadas en SVG para que
 * salgan nítidas a cualquier tamaño y no dependan de una imagen de fuera.
 * Estilos en línea: van dentro de láminas que captura `html-to-image`.
 */

export function EscudoRM({ alto }: { alto: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- recurso propio, se captura con html-to-image
    <img src="/logo.png" alt="Real Madrid" style={{ height: alto, width: alto, objectFit: "contain", display: "block", flexShrink: 0 }} />
  );
}

/** Las tres barras inclinadas de Adidas (la marca «performance»). */
export function Adidas({ alto, color = "#111111" }: { alto: number; color?: string }) {
  return (
    <svg viewBox="0 0 106 66" style={{ height: alto, width: (alto * 106) / 66, display: "block", flexShrink: 0 }} aria-label="adidas" role="img">
      <g fill={color}>
        <polygon points="0,66 20,66 30,49 10,49" />
        <polygon points="26,66 46,66 67,30 47,30" />
        <polygon points="52,66 72,66 104,11 84,11" />
      </g>
    </svg>
  );
}

/** Las dos juntas, como en el pecho de la camiseta. */
export function MarcasCamiseta({ alto, color }: { alto: number; color?: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: alto * 0.35, flexShrink: 0 }}>
      <EscudoRM alto={alto} />
      <Adidas alto={alto * 0.72} color={color} />
    </span>
  );
}
