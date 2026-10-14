/*
|--------------------------------------------------------------------------
| EL BALÓN DE LA PIZARRA (14/10/2026)
|--------------------------------------------------------------------------
|
| El Horizonte, balón oficial de partido de la RFEF (Adidas): blanco con tres
| remolinos rojos de filo dorado y unas franjas doradas sueltas. Va en
| vectores y sin los logotipos (Adidas y RFEF son marcas), así que se ve
| nítido a cualquier zoom y sale igual en el PNG y en el vídeo.
|
| Se dibuja en un círculo de radio 1 y se escala con `r`: ocupa lo mismo que
| la ficha amarilla de antes. Cada remolino son cuatro trazos del mismo
| camino, de ancho a estrecho: filo dorado, aire blanco, banda roja y su
| línea interior.
*/

interface Props {
  /** Radio en unidades del campo. */
  r: number;
  /** Único por ficha: los degradados del SVG van por id. */
  uid: string;
}

const GIROS = [0, 120, 240];

const REMOLINO = "M -1.0 -0.35 C -0.55 -0.95 0.3 -0.85 0.5 -0.35 C 0.62 -0.05 0.45 0.22 0.22 0.25";
const FRANJA = "M -0.75 -0.05 C -0.45 -0.45 0.05 -0.5 0.25 -0.25";

const ORO = "#D9B565";
const ROJO = "#D3202A";
const ROJO_OSCURO = "#A3121B";

const CAPAS = [
  { color: ORO, ancho: 0.27 },
  { color: "#FFFFFF", ancho: 0.23 },
  { color: ROJO, ancho: 0.18 },
  { color: ROJO_OSCURO, ancho: 0.025 },
];

export function BalonOficial({ r, uid }: Props) {
  const luz = `balon-luz-${uid}`;
  const sombra = `balon-sombra-${uid}`;
  const recorte = `balon-recorte-${uid}`;

  return (
    <g transform={`scale(${r})`}>
      <defs>
        {/* La luz viene de arriba a la izquierda, como en el resto de la pizarra. */}
        <radialGradient id={luz} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="0.7" stopColor="#F6F3EE" />
          <stop offset="1" stopColor="#D6D1C8" />
        </radialGradient>

        <radialGradient id={sombra} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0.68" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.3" />
        </radialGradient>

        <clipPath id={recorte}>
          <circle r={1} />
        </clipPath>
      </defs>

      <circle r={1} fill={`url(#${luz})`} />

      <g clipPath={`url(#${recorte})`}>
        {GIROS.map((giro) => (
          <path key={`franja-${giro}`} transform={`rotate(${giro})`} d={FRANJA} fill="none" stroke={ORO} strokeWidth={0.07} strokeLinecap="round" />
        ))}

        {CAPAS.map(({ color, ancho }) =>
          GIROS.map((giro) => (
            <path
              key={`${color}-${giro}`}
              transform={`rotate(${giro})`}
              d={REMOLINO}
              fill="none"
              stroke={color}
              strokeWidth={ancho}
              strokeLinecap="round"
            />
          )),
        )}

        <circle r={1} fill={`url(#${sombra})`} />
      </g>

      {/* Brillo. */}
      <ellipse cx={-0.42} cy={-0.46} rx={0.2} ry={0.11} transform="rotate(-35 -0.42 -0.46)" fill="#FFFFFF" opacity={0.85} />

      <circle r={1} fill="none" stroke="#0B0F14" strokeWidth={0.05} />
    </g>
  );
}
