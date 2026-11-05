"use client";

/*
| RADIOGRAFÍA DE PERCENTILES (05/11/2026)
|
| La «pizza» de percentiles: una cuña por métrica, tan larga como su
| percentil, con el valor por 90 grande y el percentil al lado. A la derecha
| lo que hace con balón y a la izquierda lo que hace sin él, como se leen en
| el campo. Idea de The Eye Intelligence Unit (Radiografía de percentiles).
|
| Es SVG puro y escala con el ancho: en el móvil los rótulos bajan de tamaño
| con el resto, y en lugar de cortar el nombre se parte en dos líneas.
*/

export type CunaPercentil = {
  nombre: string;
  /** El valor ya escrito («0,45», «76,7 %»). */
  valor: string;
  percentil: number;
  lado: "con" | "sin";
  ayuda?: string;
};

const ANCHO = 1000;
const ALTO = 720;
const CX = ANCHO / 2;
const CY = ALTO / 2;
const R0 = 34;
const R = 210;

function trozo(a0: number, a1: number, r0: number, r1: number) {
  const p = (a: number, r: number) => [CX + Math.sin(a) * r, CY - Math.cos(a) * r];
  const [x0, y0] = p(a0, r1);
  const [x1, y1] = p(a1, r1);
  const [x2, y2] = p(a1, r0);
  const [x3, y3] = p(a0, r0);
  const grande = a1 - a0 > Math.PI ? 1 : 0;
  return `M${x0},${y0} A${r1},${r1} 0 ${grande} 1 ${x1},${y1} L${x2},${y2} A${r0},${r0} 0 ${grande} 0 ${x3},${y3} Z`;
}

/** Parte un rótulo largo en dos líneas por el espacio más centrado. */
function dosLineas(texto: string, max = 22): string[] {
  if (texto.length <= max) return [texto];
  const mitad = texto.length / 2;
  let corte = -1;
  for (let i = 0; i < texto.length; i++) if (texto[i] === " " && (corte < 0 || Math.abs(i - mitad) < Math.abs(corte - mitad))) corte = i;
  return corte < 0 ? [texto] : [texto.slice(0, corte), texto.slice(corte + 1)];
}

export function RadiografiaPercentiles({ cunas, acento = "#EC4899", centro = "/90′" }: { cunas: CunaPercentil[]; acento?: string; centro?: string }) {
  const der = cunas.filter((c) => c.lado === "con");
  const izq = cunas.filter((c) => c.lado === "sin");

  /* Cada lado ocupa medio círculo; las cuñas se reparten dentro de su mitad. */
  const colocadas = [
    ...der.map((c, i) => ({ c, fila: i, total: der.length, a0: (Math.PI * i) / der.length, a1: (Math.PI * (i + 1)) / der.length })),
    ...izq.map((c, i) => ({ c, fila: izq.length - 1 - i, total: izq.length, a0: Math.PI + (Math.PI * i) / izq.length, a1: Math.PI + (Math.PI * (i + 1)) / izq.length })),
  ];

  if (colocadas.length < 4) return null;

  return (
    <svg viewBox={`-40 100 ${ANCHO + 80} ${ALTO - 180}`} className="h-auto w-full" role="img" aria-label={`Radiografía de percentiles: ${cunas.map((c) => `${c.nombre} p${Math.round(c.percentil)}`).join(", ")}`}>
      <defs>
        <radialGradient id="rp-halo">
          <stop offset="55%" stopColor={acento} stopOpacity="0.10" />
          <stop offset="100%" stopColor={acento} stopOpacity="0" />
        </radialGradient>
      </defs>

      <circle cx={CX} cy={CY} r={R + 70} fill="url(#rp-halo)" />
      <circle cx={CX} cy={CY} r={R + 4} fill="currentColor" fillOpacity={0.04} />

      {colocadas.map(({ c, a0, a1, fila, total }, i) => {
        const p = Math.max(2, Math.min(100, c.percentil));
        const r1 = R0 + ((R - R0) * p) / 100;
        const intensidad = 0.35 + (0.65 * p) / 100;
        const medio = (a0 + a1) / 2;
        const dch = medio < Math.PI;
        const ax = CX + Math.sin(medio) * (R + 6);
        const ay = CY - Math.cos(medio) * (R + 6);
        const lx = dch ? CX + R + 62 : CX - R - 62;
        /* Alturas fijas por lado (05/11/2026): por el coseno, los de arriba y abajo se pisaban. */
        const ly = total < 2 ? CY : CY - R - 6 + (fila * (2 * R + 30)) / (total - 1);
        const lineas = dosLineas(c.nombre.toUpperCase(), 18);

        return (
          <g key={c.nombre} className="rp-cuna" style={{ animationDelay: `${i * 45}ms` }}>
            <title>{`${c.nombre}: ${c.valor} · percentil ${Math.round(c.percentil)}${c.ayuda ? ` · ${c.ayuda}` : ""}`}</title>
            {/* El fondo de la cuña entera: dónde está el techo. */}
            <path d={trozo(a0 + 0.012, a1 - 0.012, R0, R)} fill="currentColor" fillOpacity={0.07} />
            <path d={trozo(a0 + 0.012, a1 - 0.012, R0, r1)} fill={acento} fillOpacity={intensidad} />
            <circle cx={ax} cy={ay} r={3.5} fill="currentColor" fillOpacity={0.7} />
            <polyline points={`${ax},${ay} ${dch ? lx - 14 : lx + 14},${ly}`} fill="none" stroke="currentColor" strokeOpacity={0.35} />
            <text x={lx} y={ly - 6} textAnchor={dch ? "start" : "end"} fontSize="38" fontWeight="800" fill="currentColor">
              {c.valor}
            </text>
            {lineas.map((l, k) => (
              <text key={k} x={lx} y={ly + 20 + k * 20} textAnchor={dch ? "start" : "end"} fontSize="18" fontWeight="700" letterSpacing="0.02em" fill="currentColor" fillOpacity={0.6}>
                {l}
                {k === lineas.length - 1 && (
                  <tspan fill={acento} fillOpacity={1} fontWeight="800">{` · P${Math.round(c.percentil)}`}</tspan>
                )}
              </text>
            ))}
          </g>
        );
      })}

      {/* La mitad: 50 es lo normal en su puesto. */}
      <circle cx={CX} cy={CY} r={R0 + (R - R0) / 2} fill="none" stroke="currentColor" strokeOpacity={0.3} strokeDasharray="4 5" />
      <line x1={CX} y1={CY - R - 14} x2={CX} y2={CY + R + 14} stroke="currentColor" strokeOpacity={0.25} />
      <text x={CX + 10} y={CY - R - 22} fontSize="13" fontWeight="700" letterSpacing="0.14em" fill="currentColor" fillOpacity={0.55}>CON BALÓN →</text>
      <text x={CX - 10} y={CY - R - 22} textAnchor="end" fontSize="13" fontWeight="700" letterSpacing="0.14em" fill="currentColor" fillOpacity={0.55}>← SIN BALÓN</text>
      <circle cx={CX} cy={CY} r={R0 - 4} fill="#0B0F14" stroke="currentColor" strokeOpacity={0.4} />
      <text x={CX} y={CY + 5} textAnchor="middle" fontSize="15" fontWeight="800" fill="#fff">{centro}</text>
      <style>{`.rp-cuna{animation:rp-entra .6s ease-out both}@keyframes rp-entra{from{opacity:0}to{opacity:1}}`}</style>
    </svg>
  );
}
