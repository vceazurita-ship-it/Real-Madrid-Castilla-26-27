/*
|--------------------------------------------------------------------------
| EL BALÓN DE LA PIZARRA (14/10/2026)
|--------------------------------------------------------------------------
|
| El Horizonte, balón oficial de partido de la RFEF: la foto que pasó Víctor,
| recortada en círculo (`public/balon-horizonte.png`, 256 px). Primero fue un
| círculo amarillo y luego un dibujo vectorial; pidió exactamente esa imagen.
|
| Se dibuja en un círculo de radio 1 y se escala con `r`: ocupa lo mismo que
| la ficha de antes. Encima, un filo oscuro fino para que se despegue del
| césped claro y de las líneas blancas del campo.
*/

interface Props {
  /** Radio en unidades del campo. */
  r: number;
  /** Único por ficha: el recorte del SVG va por id. */
  uid: string;
}

export function BalonOficial({ r, uid }: Props) {
  const recorte = `balon-recorte-${uid}`;

  return (
    <g transform={`scale(${r})`}>
      <defs>
        <clipPath id={recorte}>
          <circle r={1} />
        </clipPath>
      </defs>

      <image href="/balon-horizonte.png" x={-1} y={-1} width={2} height={2} clipPath={`url(#${recorte})`} preserveAspectRatio="xMidYMid slice" />

      <circle r={1} fill="none" stroke="#0B0F14" strokeOpacity={0.55} strokeWidth={0.05} />
    </g>
  );
}
