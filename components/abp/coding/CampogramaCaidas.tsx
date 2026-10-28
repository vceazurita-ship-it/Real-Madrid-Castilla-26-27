"use client";

/**
 * Campograma de caídas del coding del ABP del rival (28/10/2026): dónde cae
 * cada saque de la carpeta (también los descartados), por el lado desde el
 * que se saca, y en lo defensivo la zona que dejan sin nadie. Colores fijos
 * (tablero oscuro en los dos temas) para que el PNG salga igual.
 */

import { useRef } from "react";
import { ImageDown } from "lucide-react";

import { capturaNodo } from "@/lib/export/captura";
import { descargaDataUrl } from "@/lib/export/lienzos";
import { caidasDe, type ClipEstado } from "@/lib/abp/coding-rival";

/* El área y su frontal (x de 10 a 58 m, 24 m de fondo) con la portería arriba; 1 m = 9 px. */
const E = 9;
const X0 = 10;
const W = 48 * E;
const H = 24 * E;

/** El punto de cada zona si se saca desde la izquierda (desde la derecha, en espejo). */
const PUNTO: Record<string, [number, number]> = {
  "1.er palo": [29.5, 4.5],
  Centro: [34, 7.5],
  "2.º palo": [39, 5],
  "Frontal / rechace": [34, 19],
};

const LIBRE: Record<string, [number, number]> = { "1.er palo": [29.5, 4.5], Centro: [34, 7.5], "2.º palo": [39, 5], Frontal: [34, 19] };

const COLOR: Record<string, string> = { Izquierda: "#5AA9FF", Derecha: "#D8B45A", Central: "#9AE6B4", "Sin lado": "#C7CDD6" };

export function CampogramaCaidas({ titulo, clips, defensivo }: { titulo: string; clips: [number, ClipEstado][]; defensivo: boolean }) {
  const nodo = useRef<HTMLDivElement>(null);

  const { cuenta, total } = caidasDe(clips);

  const libres = new Map<string, number>();

  if (defensivo) for (const [, c] of clips) if (c.etiquetas?.libre) libres.set(c.etiquetas.libre, (libres.get(c.etiquetas.libre) ?? 0) + 1);

  if (!total && !libres.size) return <p className="text-sm text-white/50">Marca la caída (y el lado) de los clips y aquí se dibujan.</p>;

  const lados = Object.keys(cuenta);

  const png = async () => {
    if (!nodo.current) return;

    const { dataUrl } = await capturaNodo(nodo.current, { pixelRatio: 2, backgroundColor: "#0E2A1E" });

    await descargaDataUrl(dataUrl, `caidas-${titulo.toLowerCase().replace(/[^a-z0-9]+/gi, "-")}.png`);
  };

  return (
    <div className="space-y-2">
      <div ref={nodo} style={{ background: "#0E2A1E", padding: 12, borderRadius: 12, width: W + 24 }}>
        <div style={{ color: "#FFFFFF", fontWeight: 700, fontSize: 14, marginBottom: 6 }}>
          {titulo} · {total} caídas
        </div>
        <svg width={W} height={H + 8} viewBox={`${X0 * E} -8 ${W} ${H + 8}`} role="img" aria-label={`Caídas de ${titulo}`}>
          <rect x={X0 * E} y={-8} width={W} height={H + 8} fill="#13402B" />
          {/* Área, área pequeña, portería y punto de penalti */}
          <rect x={13.84 * E} y={0} width={40.32 * E} height={16.5 * E} fill="none" stroke="#FFFFFF" strokeOpacity={0.7} strokeWidth={1.5} />
          <rect x={24.84 * E} y={0} width={18.32 * E} height={5.5 * E} fill="none" stroke="#FFFFFF" strokeOpacity={0.7} strokeWidth={1.5} />
          <rect x={30.34 * E} y={-6} width={7.32 * E} height={6} fill="#FFFFFF" />
          <circle cx={34 * E} cy={11 * E} r={2} fill="#FFFFFF" />
          <path d={`M ${26.7 * E} ${16.5 * E} A ${9.15 * E} ${9.15 * E} 0 0 0 ${41.3 * E} ${16.5 * E}`} fill="none" stroke="#FFFFFF" strokeOpacity={0.7} strokeWidth={1.5} />

          {/* Zonas que dejan sin nadie (defensivo) */}
          {[...libres].map(([z, n]) => {
            const p = LIBRE[z];
            if (!p) return null;
            return (
              <g key={`l${z}`}>
                <circle cx={p[0] * E} cy={p[1] * E} r={Math.min(4, 2.2 + n * 0.4) * E} fill="#FF4D4D" fillOpacity={0.2} stroke="#FF4D4D" strokeDasharray="4 3" />
                <text x={p[0] * E} y={p[1] * E + Math.min(4, 2.2 + n * 0.4) * E + 12} textAnchor="middle" fontSize={11} fill="#FF8A8A" fontWeight={700}>
                  sin nadie · {n}
                </text>
              </g>
            );
          })}

          {/* Caídas por lado: el número dentro, el tamaño por la cuenta */}
          {lados.flatMap((lado, k) =>
            Object.entries(cuenta[lado]).map(([z, n]) => {
              const base = PUNTO[z];
              if (!base) return null;
              const x = (lado === "Derecha" ? 68 - base[0] : base[0]) + (lados.length > 1 ? (k - (lados.length - 1) / 2) * 3 : 0);
              const r = Math.min(2.6, 1.1 + Math.sqrt(n) * 0.5) * E;
              return (
                <g key={`${lado}${z}`}>
                  <circle cx={x * E} cy={(base[1] + k * 1.2) * E} r={r} fill={COLOR[lado] ?? "#FFFFFF"} fillOpacity={0.85} stroke="#0B0F14" strokeWidth={1} />
                  <text x={x * E} y={(base[1] + k * 1.2) * E + 4} textAnchor="middle" fontSize={12} fontWeight={800} fill="#0B0F14">
                    {n}
                  </text>
                </g>
              );
            }),
          )}
        </svg>
        <div style={{ display: "flex", gap: 12, marginTop: 6, fontSize: 11, color: "#DDE3EA" }}>
          {lados.map((l) => (
            <span key={l} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 10, height: 10, borderRadius: 999, background: COLOR[l] ?? "#FFFFFF", display: "inline-block" }} />
              {l === "Sin lado" ? "Sin lado marcado" : `Desde la ${l.toLowerCase()}`}
            </span>
          ))}
        </div>
      </div>
      <button type="button" onClick={() => void png()} className="flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-xs text-white/80 hover:bg-white/5">
        <ImageDown size={14} /> Descargar PNG (para la pizarra o el informe)
      </button>
    </div>
  );
}
