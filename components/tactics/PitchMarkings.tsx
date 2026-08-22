/**
 * Marcas del campo, dibujadas en el espacio 100 x 68 del `viewBox`.
 *
 * Se dibuja el campo completo siempre: los recortes (campo propio, último
 * tercio) se consiguen cambiando el `viewBox`, no el contenido.
 */
export default function PitchMarkings() {
  const line = "rgba(255,255,255,.34)";

  return (
    <g fill="none" stroke={line} strokeWidth={0.35}>
      {/* Césped */}
      <rect x={0} y={0} width={100} height={68} fill="#0F2A1D" stroke="none" />

      {/* Franjas de siega */}
      {Array.from({ length: 10 }).map((_, index) => (
        <rect
          key={index}
          x={index * 10}
          y={0}
          width={10}
          height={68}
          fill={index % 2 === 0 ? "rgba(255,255,255,.022)" : "transparent"}
          stroke="none"
        />
      ))}

      {/* Perímetro */}
      <rect x={1.5} y={1.5} width={97} height={65} />

      {/* Medio campo */}
      <line x1={50} y1={1.5} x2={50} y2={66.5} />
      <circle cx={50} cy={34} r={8.7} />
      <circle cx={50} cy={34} r={0.5} fill={line} stroke="none" />

      {/* Áreas grandes */}
      <rect x={1.5} y={14.75} width={15.7} height={38.5} />
      <rect x={82.8} y={14.75} width={15.7} height={38.5} />

      {/* Áreas pequeñas */}
      <rect x={1.5} y={25.25} width={5.3} height={17.5} />
      <rect x={93.2} y={25.25} width={5.3} height={17.5} />

      {/* Puntos de penalti */}
      <circle cx={12} cy={34} r={0.5} fill={line} stroke="none" />
      <circle cx={88} cy={34} r={0.5} fill={line} stroke="none" />

      {/* Semicírculos del área */}
      <path d="M 17.2 27.6 A 8.7 8.7 0 0 1 17.2 40.4" />
      <path d="M 82.8 27.6 A 8.7 8.7 0 0 0 82.8 40.4" />

      {/* Porterías */}
      <rect x={0} y={30.4} width={1.5} height={7.2} />
      <rect x={98.5} y={30.4} width={1.5} height={7.2} />

      {/* Córners */}
      <path d="M 1.5 3.1 A 1.6 1.6 0 0 0 3.1 1.5" />
      <path d="M 96.9 1.5 A 1.6 1.6 0 0 0 98.5 3.1" />
      <path d="M 98.5 64.9 A 1.6 1.6 0 0 0 96.9 66.5" />
      <path d="M 3.1 66.5 A 1.6 1.6 0 0 0 1.5 64.9" />
    </g>
  );
}
