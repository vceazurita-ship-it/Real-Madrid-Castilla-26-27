"use client";

// Mapa de flechas: de dónde sale cada saque y hacia dónde va el envío.
//
// El destino sale de Zona_Caida, que guarda la dirección del envío
// ("Progresión Carril Exterior", "Retroceso Carril Interior", "Area").
// Antes se buscaba "izq"/"der" en esa columna, que nunca aparece ahí, así que
// todas las flechas apuntaban al mismo punto.

import { useMemo, useState } from "react";
import {
  type Banda,
  BANDA_LABEL,
  esProduccion,
  heatColor,
  type Mode,
  parseBanda,
  parseDireccion,
  parseResultado,
  parseZona,
  read,
  type RecordRow,
  resultColor,
  tonoDeModo,
  type Zona,
  zonaLabel,
} from "./throwInModel";

type ThrowInFieldProps = {
  rows: RecordRow[];
  mode: Mode;
};

type FieldNode = {
  key: string;
  banda: Banda;
  zona: Zona;
  count: number;
  produccion: number;
  rows: RecordRow[];
};

/** Igual que en el mapa de zonas: la vista defensiva gira el campo 180 grados. */
function origen(banda: Banda, zona: Zona, mode: Mode) {
  const flip = mode === "defensive";
  const x = flip ? [85, 50, 15][zona - 1] : [15, 50, 85][zona - 1];
  const arriba = flip ? banda === "der" : banda === "izq";

  return { x, y: arriba ? 7 : 93, dir: flip ? -1 : 1 };
}

/** Destino del envío según su dirección registrada. */
function destino(node: FieldNode, mode: Mode) {
  const { x, y, dir } = origen(node.banda, node.zona, mode);

  const direcciones = node.rows.map((row) => parseDireccion(read(row, "Zona_Caida")));
  const dominante =
    direcciones
      .reduce<[string, number][]>((acc, direccion) => {
        const clave = `${direccion.sentido ?? "otro"}|${direccion.carril ?? "otro"}`;
        const found = acc.find(([key]) => key === clave);
        if (found) found[1] += 1;
        else acc.push([clave, 1]);
        return acc;
      }, [])
      .sort((a, b) => b[1] - a[1])[0]?.[0] ?? "otro|otro";

  const [sentido, carril] = dominante.split("|");
  const haciaCentro = y < 50 ? 1 : -1;

  if (sentido === "area") {
    return { x: mode === "defensive" ? 12 : 88, y: 50 };
  }

  const avance = sentido === "progresion" ? 20 : sentido === "retroceso" ? -16 : 8;
  const desplazamientoY = carril === "interior" ? 34 : carril === "exterior" ? 13 : 20;

  return {
    x: Math.max(8, Math.min(92, x + dir * avance)),
    y: Math.max(10, Math.min(90, y + haciaCentro * desplazamientoY)),
  };
}

export function ThrowInField({ rows, mode }: ThrowInFieldProps) {
  const [selected, setSelected] = useState<FieldNode | null>(null);
  const isOffensive = mode === "offensive";
  const tono = tonoDeModo(mode);

  const nodes = useMemo(() => {
    const grouped = new Map<string, FieldNode>();

    rows.forEach((row) => {
      const banda = parseBanda(row);
      const zona = parseZona(row);
      if (!banda || !zona) return;

      const key = `${banda}-${zona}`;
      const node =
        grouped.get(key) ?? { key, banda, zona, count: 0, produccion: 0, rows: [] as RecordRow[] };

      node.count += 1;
      node.rows.push(row);
      if (esProduccion(parseResultado(read(row, "Resultado_Final")), mode)) node.produccion += 1;

      grouped.set(key, node);
    });

    return [...grouped.values()].sort((a, b) => b.count - a.count);
  }, [rows, mode]);

  const maxCount = Math.max(...nodes.map((node) => node.count), 1);

  return (
    <section className="mb-7 rounded-3xl border border-white/10 bg-white/[0.03] p-4 shadow-xl md:p-7">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[#C8A96B]">Situación global</p>
          <h2 className="mt-1 text-xl font-semibold md:text-2xl">
            Mapa de saques de banda {isOffensive ? "ofensivos" : "defensivos"}
          </h2>
        </div>
        <p className="text-sm text-slate-400">Pulsa una zona para ver las acciones registradas.</p>
      </div>

      <div
        className="relative mx-auto aspect-[16/10] w-full max-w-[1200px] overflow-hidden rounded-2xl border border-emerald-200/20 shadow-inner"
        style={{ backgroundImage: "url(/emotional-field-bg.png)", backgroundSize: "cover", backgroundPosition: "center" }}
      >
        <svg
          viewBox="0 0 100 100"
          className="absolute inset-0 h-full w-full"
          role="img"
          aria-label="Campo de fútbol completo con distribución de saques de banda"
        >
          <defs>
            <filter id="field-glow">
              <feGaussianBlur stdDeviation="0.7" />
            </filter>
          </defs>

          {nodes.map((node) => {
            const { x, y } = origen(node.banda, node.zona, mode);
            const target = destino(node, mode);
            const radius = 2.5 + Math.sqrt(node.count / maxCount) * 3.6;
            const color = heatColor(node.produccion / node.count, tono);

            return (
              <g key={node.key} className="cursor-pointer" onClick={() => setSelected(node)}>
                <path
                  d={`M ${x} ${y} Q ${(x + target.x) / 2} ${(y + target.y) / 2 - 4} ${target.x} ${target.y}`}
                  fill="none"
                  stroke={color}
                  strokeOpacity="0.75"
                  strokeWidth="0.6"
                  strokeLinecap="round"
                />
                <circle cx={target.x} cy={target.y} r="1.25" fill={color} fillOpacity="0.8" filter="url(#field-glow)" />
                <circle cx={x} cy={y} r={radius + 0.9} fill="none" stroke={color} strokeOpacity="0.55" strokeWidth="0.55" />
                <circle cx={x} cy={y} r={radius} fill={color} fillOpacity="0.96" stroke="#FFF7E5" strokeWidth="0.35" />
                <text x={x} y={y + 0.7} textAnchor="middle" fill="#0B1728" fontSize="2.2" fontWeight="700">
                  {node.count}
                </text>
              </g>
            );
          })}
        </svg>

        <div className="pointer-events-none absolute left-4 top-4 rounded-lg bg-[#07111F]/80 px-3 py-2 text-xs text-slate-200 backdrop-blur">
          {isOffensive
            ? "Atacamos hacia la portería rival (derecha)"
            : "El rival ataca hacia nuestra portería (izquierda)"}
        </div>
        <div className="pointer-events-none absolute bottom-4 left-4 rounded-lg bg-[#07111F]/80 px-3 py-2 text-xs text-slate-200 backdrop-blur">
          {nodes.length
            ? `${nodes.length} zonas activas · tamaño = volumen · color = ${
                isOffensive ? "producción generada" : "peligro concedido"
              }`
            : "Sin zonas activas todavía"}
        </div>

        {!nodes.length ? (
          <div className="absolute inset-0 grid place-items-center bg-[#07111F]/45 p-6 text-center">
            <div>
              <p className="text-lg font-medium">El mapa aparecerá al registrar los saques.</p>
              <p className="mt-1 text-sm text-slate-300">
                Completa <strong>Perfil</strong> y <strong>Zona_Saque</strong> en la hoja para situar cada acción.
              </p>
            </div>
          </div>
        ) : null}

        {selected ? (
          <div className="absolute inset-x-3 bottom-3 max-h-[64%] overflow-y-auto rounded-2xl border border-white/10 bg-[#07111F]/95 p-4 shadow-2xl backdrop-blur-md sm:left-auto sm:right-3 sm:w-[360px]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-[#C8A96B]">Zona de saque</p>
                <h3 className="mt-1 text-lg font-semibold">{BANDA_LABEL[selected.banda]}</h3>
                <p className="text-sm text-slate-400">{zonaLabel(selected.zona, mode)}</p>
                <p className="mt-1 text-sm text-slate-400">
                  {selected.count} {selected.count === 1 ? "acción" : "acciones"} registradas
                </p>
              </div>
              <button
                type="button"
                aria-label="Cerrar detalle"
                onClick={() => setSelected(null)}
                className="rounded-full p-1 text-slate-400 transition hover:bg-white/10 hover:text-white"
              >
                ×
              </button>
            </div>
            <div className="mt-4 space-y-2">
              {selected.rows.map((row, index) => {
                const resultado = parseResultado(read(row, "Resultado_Final"));

                return (
                  <div key={`${read(row, "JORNADA")}-${index}`} className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-sm">
                    <div className="flex justify-between gap-3">
                      <p className="font-medium">
                        {read(row, "JORNADA") || "Partido"}{" "}
                        <span className="font-normal text-slate-400">· {read(row, "Rival") || "Sin rival"}</span>
                      </p>
                      <p className="shrink-0 text-slate-400">{read(row, "Tiempo") || "-"}</p>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                      <p className="rounded-lg bg-white/5 px-2 py-1.5">
                        <span className="block text-slate-400">Envío</span>
                        {read(row, "Tipo_Envio") || "-"}
                      </p>
                      <p className="rounded-lg bg-white/5 px-2 py-1.5">
                        <span className="block text-slate-400">Dirección</span>
                        {parseDireccion(read(row, "Zona_Caida")).label}
                      </p>
                      <p className="col-span-2 rounded-lg bg-white/5 px-2 py-1.5">
                        <span className="block text-slate-400">Resultado</span>
                        <span style={{ color: resultColor(resultado.label) }}>{resultado.label}</span>
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
