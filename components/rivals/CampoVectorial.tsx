import type React from "react";

/*
| EL CAMPO DEL CAMPOGRAMA, DIBUJADO (15/11/2026).
|
| Antes era la foto `/emotional-field-bg.webp` con un velo oscuro en noche y
| un lavado `screen` en día: en día quedaba verde salvia grisáceo, en noche
| casi negro, y en el móvil la foto iba girada y estirada (el círculo central
| salía ovalado). El experto de diseño le puso un 4/10 en PC y un 3/10 en
| móvil. Ahora el campo es un SVG de 105 × 68 m: nítido a cualquier tamaño,
| de pie se dibuja de pie (no se gira una imagen) y los colores salen de
| variables de `app/globals.css` (`--campo-*`), una tanda para cada tema.
|
| La caja manda (el reparto de fichas usa el tamaño del contenedor): el
| ancho del campo es fijo (68) y el largo sale de la proporción de la caja,
| así que el círculo y las áreas mantienen su medida real y lo que se estira
| es la distancia entre ellas, que no se nota.
*/

const A = 68;
const FRANJAS = 10;

export function CampoVectorial({ horizontal, ancho: anchoCaja, alto: altoCaja }: { horizontal: boolean; ancho: number; alto: number }) {
  const largoCaja = horizontal ? anchoCaja : altoCaja;
  const cortoCaja = horizontal ? altoCaja : anchoCaja;
  const L = cortoCaja > 0 ? Math.min(2.4, Math.max(1.2, largoCaja / cortoCaja)) * A : 105;
  /* Todo se dibuja tumbado; de pie se cambian x por y. */
  const ancho = horizontal ? L : A;
  const alto = horizontal ? A : L;
  const p = (x: number, y: number) => (horizontal ? `${x},${y}` : `${y},${L - x}`);
  const rect = (x: number, y: number, w: number, h: number) =>
    horizontal ? { x, y, width: w, height: h } : { x: y, y: L - x - w, width: h, height: w };
  const punto = (x: number, y: number) => (horizontal ? { cx: x, cy: y } : { cx: y, cy: L - x });

  /* Un arco del área (la «D»): centro en el penalti, radio 9,15, sólo lo que
     queda fuera del área. */
  const arco = (penaltiX: number, haciaDerecha: boolean) => {
    const dx = 16.5 - 11; // del penalti a la línea del área
    const dy = Math.sqrt(9.15 ** 2 - dx ** 2);
    const bordeX = haciaDerecha ? penaltiX + dx : penaltiX - dx;
    return `M ${p(bordeX, A / 2 - dy)} A 9.15 9.15 0 0 ${haciaDerecha ? 1 : 0} ${p(bordeX, A / 2 + dy)}`;
  };

  /* Con `style` y no con atributos: en un atributo SVG `var()` no se resuelve. */
  const linea = {
    /* 0,3 m: unos 2 px en el PC y algo más de 1 en el móvil. */
    strokeWidth: 0.3,
    style: {
      fill: "none",
      stroke: "var(--campo-linea)",
      strokeOpacity: "var(--campo-linea-opacidad)",
    } as React.CSSProperties,
  };

  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox={`0 0 ${ancho} ${alto}`}
      preserveAspectRatio="none"
    >
      <defs>
        <radialGradient id="campo-vineta" cx="50%" cy="50%" r="75%">
          <stop offset="55%" style={{ stopColor: "var(--campo-vineta)", stopOpacity: 0 }} />
          <stop offset="100%" style={{ stopColor: "var(--campo-vineta)", stopOpacity: "var(--campo-vineta-opacidad)" } as React.CSSProperties} />
        </radialGradient>
      </defs>

      <rect x={0} y={0} width={ancho} height={alto} style={{ fill: "var(--campo-cesped)" }} />
      {Array.from({ length: FRANJAS }, (_, i) =>
        i % 2 ? <rect key={i} {...rect((L / FRANJAS) * i, 0, L / FRANJAS, A)} style={{ fill: "var(--campo-franja)" }} /> : null,
      )}

      <g {...linea}>
        {/* Banda y medio campo, con un margen para que no toque el borde. */}
        <rect {...rect(2, 2, L - 4, A - 4)} />
        <line
          x1={horizontal ? L / 2 : 2}
          y1={horizontal ? 2 : L / 2}
          x2={horizontal ? L / 2 : A - 2}
          y2={horizontal ? A - 2 : L / 2}
        />
        <circle {...punto(L / 2, A / 2)} r={9.15} />
        {/* Áreas grande y pequeña de los dos lados. */}
        <rect {...rect(2, A / 2 - 20.16, 16.5, 40.32)} />
        <rect {...rect(L - 2 - 16.5, A / 2 - 20.16, 16.5, 40.32)} />
        <rect {...rect(2, A / 2 - 9.16, 5.5, 18.32)} />
        <rect {...rect(L - 2 - 5.5, A / 2 - 9.16, 5.5, 18.32)} />
        <path d={arco(2 + 11, true)} />
        <path d={arco(L - 2 - 11, false)} />
      </g>

      <g style={{ fill: "var(--campo-linea)", fillOpacity: "var(--campo-linea-opacidad)" } as React.CSSProperties}>
        <circle {...punto(L / 2, A / 2)} r={0.6} />
        <circle {...punto(2 + 11, A / 2)} r={0.45} />
        <circle {...punto(L - 2 - 11, A / 2)} r={0.45} />
      </g>

      <rect x={0} y={0} width={ancho} height={alto} fill="url(#campo-vineta)" />
    </svg>
  );
}
