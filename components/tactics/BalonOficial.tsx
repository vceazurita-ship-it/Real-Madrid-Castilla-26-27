/*
|--------------------------------------------------------------------------
| EL BALÓN DE LA PIZARRA (14/10/2026)
|--------------------------------------------------------------------------
|
| El de partido de Primera Federación, de Adidas: blanco, con las aspas
| curvas de sus balones de liga en negro con filo de oro, las costuras de
| los paneles y un brillo que le da volumen. Va en vectores (sin logotipo de
| la marca), así que se ve nítido a cualquier zoom y sale igual en el PNG y
| en el vídeo.
|
| Se dibuja en un círculo de radio 1 y se escala con `r`: ocupa lo mismo que
| la ficha amarilla de antes.
*/

interface Props {
  /** Radio en unidades del campo. */
  r: number;
  /** Único por ficha: los degradados del SVG van por id. */
  uid: string;
}

const GIROS = [0, 120, 240];

const ASPA = "M 0.1 -0.06 C 0.35 -0.42 0.8 -0.6 1.12 -0.42 C 0.78 -0.44 0.42 -0.3 0.17 0.02 Z";
const FILO = "M 0.22 0.03 C 0.47 -0.24 0.8 -0.36 1.1 -0.3";
const COSTURA = "M -0.25 0.98 C 0.05 0.55 0.55 0.42 0.98 0.52";

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
          <stop offset="0.65" stopColor="#F1F3F6" />
          <stop offset="1" stopColor="#C9CED6" />
        </radialGradient>

        <radialGradient id={sombra} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0.7" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.28" />
        </radialGradient>

        <clipPath id={recorte}>
          <circle r={1} />
        </clipPath>
      </defs>

      <circle r={1} fill={`url(#${luz})`} />

      <g clipPath={`url(#${recorte})`}>
        {GIROS.map((giro) => (
          <path key={`costura-${giro}`} transform={`rotate(${giro + 60})`} d={COSTURA} fill="none" stroke="#9AA3AE" strokeWidth={0.035} />
        ))}

        {GIROS.map((giro) => (
          <path key={`aspa-${giro}`} transform={`rotate(${giro})`} d={ASPA} fill="#12161C" />
        ))}

        {GIROS.map((giro) => (
          <path key={`filo-${giro}`} transform={`rotate(${giro})`} d={FILO} fill="none" stroke="#C8A96B" strokeWidth={0.06} strokeLinecap="round" />
        ))}

        <circle r={0.11} fill="#12161C" />
        <circle r={1} fill={`url(#${sombra})`} />
      </g>

      {/* Brillo. */}
      <ellipse cx={-0.4} cy={-0.45} rx={0.22} ry={0.12} transform="rotate(-35 -0.4 -0.45)" fill="#FFFFFF" opacity={0.8} />

      <circle r={1} fill="none" stroke="#0B0F14" strokeWidth={0.07} />
    </g>
  );
}
