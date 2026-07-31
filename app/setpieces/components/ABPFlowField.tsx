type ABPFlowFieldProps = {
  nodes: Record<string, number>;
  links: Record<string, number>;
};

const zoneCoords: Record<string, { x: number; y: number }> = {
  // Origen del saque (parte inferior)
  'Córner izquierdo': { x: 15, y: 95 },
  'Córner derecho': { x: 85, y: 95 },
  'Falta lateral izquierda': { x: 22, y: 82 },
  'Falta lateral derecha': { x: 78, y: 82 },
  Frontal: { x: 50, y: 82 },

  // Activación
  Directo: { x: 50, y: 60 },
  Corto: { x: 32, y: 60 },
  'Segundo balón': { x: 68, y: 60 },
  Bloqueo: { x: 22, y: 60 },
  Arrastre: { x: 78, y: 60 },

  // Intención
  'Primer palo': { x: 34, y: 38 },
  'Punto de penalti': { x: 50, y: 32 },
  'Segundo palo': { x: 66, y: 38 },
  'Rechace frontal': { x: 50, y: 46 },

  // Remate
  'Área pequeña izquierda': { x: 40, y: 16 },
  'Área pequeña derecha': { x: 60, y: 16 },
  'Primer palo remate': { x: 36, y: 11 },
  'Segundo palo remate': { x: 64, y: 11 },
};

export default function ABPFlowField({
  nodes,
  links,
}: ABPFlowFieldProps) {
  const maxNode = Math.max(...Object.values(nodes), 1);
  const maxLink = Math.max(...Object.values(links), 1);

  return (
    <div className='w-full aspect-[4/5]'>
      <svg viewBox='0 0 100 110' className='w-full h-full'>
        {/* Campo */}
        <rect
          x='5'
          y='5'
          width='90'
          height='100'
          rx='2'
          fill='#0F1720'
          stroke='#FFFFFF'
          strokeWidth='0.4'
        />

        {/* Área grande */}
        <rect
          x='22'
          y='5'
          width='56'
          height='18'
          fill='none'
          stroke='#FFFFFF'
          strokeWidth='0.4'
        />

        {/* Área pequeña */}
        <rect
          x='34'
          y='5'
          width='32'
          height='7'
          fill='none'
          stroke='#FFFFFF'
          strokeWidth='0.4'
        />

        {/* Punto de penalti */}
        <circle cx='50' cy='15' r='0.8' fill='#FFFFFF' />

        {/* Separadores de fases */}
        <line x1='5' y1='48' x2='95' y2='48' stroke='#475569' strokeWidth='0.3' />
        <line x1='5' y1='68' x2='95' y2='68' stroke='#475569' strokeWidth='0.3' />

        {/* Títulos */}
        <text x='50' y='102' textAnchor='middle' fill='#94A3B8' fontSize='3'>
          Origen
        </text>
        <text x='50' y='73' textAnchor='middle' fill='#94A3B8' fontSize='3'>
          Activación
        </text>
        <text x='50' y='47' textAnchor='middle' fill='#94A3B8' fontSize='3'>
          Intención
        </text>
        <text x='50' y='25' textAnchor='middle' fill='#94A3B8' fontSize='3'>
          Remate
        </text>

        {/* Flujos */}
        {Object.entries(links).map(([key, value]) => {
          const [from, to] = key.split('->');
          const a = zoneCoords[from];
          const b = zoneCoords[to];
          if (!a || !b) return null;

          return (
            <line
              key={key}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke='#C8A96B'
              strokeOpacity={0.7}
              strokeWidth={0.4 + (value / maxLink) * 2.4}
              strokeLinecap='round'
            />
          );
        })}

        {/* Nodos */}
        {Object.entries(nodes).map(([name, value]) => {
          const p = zoneCoords[name];
          if (!p) return null;

          return (
            <g key={name}>
              <circle
                cx={p.x}
                cy={p.y}
                r={1.8 + (value / maxNode) * 4}
                fill='#C8A96B'
                fillOpacity={0.3 + (value / maxNode) * 0.45}
                stroke='#F5E7C8'
                strokeWidth='0.35'
              />
              <text
                x={p.x}
                y={p.y + 0.9}
                textAnchor='middle'
                fill='#FFFFFF'
                fontSize='1.8'
                fontWeight='700'
              >
                {value}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}