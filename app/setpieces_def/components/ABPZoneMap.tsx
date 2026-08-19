"use client";

import { useMemo, useState } from "react";

export type ZoneRow = {
  zonaCaida?: string;
  zonaRemate?: string;
  xg?: number;
  resultadoFinal?: string;
  tipoRemate?: string;

  oc1P?: number;
  ocCentral?: number;
  oc2P?: number;
  ocFrontal?: number;
};

type ZoneKey = "1P" | "central" | "2P" | "frontal";

type Metric =
  | "ocupacion"
  | "caidas"
  | "remates"
  | "xg"
  | "goles"
  | "xgPorCaida";

const ZONES: {
  key: ZoneKey;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
}[] = [
  { key: "1P", label: "Primer palo", x: 21.5, y: 2, w: 18.5, h: 23 },
  { key: "central", label: "6m / Penalti", x: 40, y: 2, w: 20, h: 23 },
  { key: "2P", label: "Segundo palo", x: 60, y: 2, w: 18.5, h: 23 },
  { key: "frontal", label: "Frontal", x: 21.5, y: 25, w: 57, h: 12 },
];

const METRICS: {
  key: Metric;
  label: string;
  hint: string;
  decimals: number;
}[] = [
  {
    key: "ocupacion",
    label: "Ocupación",
    hint: "Media de jugadores situados en la zona por acción defendida",
    decimals: 1,
  },
  {
    key: "caidas",
    label: "Envíos recibidos",
    hint: "Acciones del rival cuyo balón cae en la zona",
    decimals: 0,
  },
  {
    key: "remates",
    label: "Remates concedidos",
    hint: "Remates que el rival produce desde la zona",
    decimals: 0,
  },
  {
    key: "xg",
    label: "xG concedido",
    hint: "xG acumulado que el rival genera desde la zona",
    decimals: 2,
  },
  {
    key: "goles",
    label: "Goles encajados",
    hint: "Goles del rival marcados desde la zona",
    decimals: 0,
  },
  {
    key: "xgPorCaida",
    label: "xG / envío",
    hint: "Peligro concedido por cada balón que cae en la zona",
    decimals: 3,
  },
];

function norm(v?: string) {
  return (v || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

/**
 * Zona del área donde cae el envío rival.
 * `corto` = superioridad previa (3v2, 2v1...), `barrera` = golpeo directo contra la barrera.
 */
function zoneFromCaida(
  v?: string
): ZoneKey | "corto" | "barrera" | null {
  const t = norm(v);
  if (!t) return null;

  if (/^\d+\s*v\s*\d+$/.test(t)) return "corto";
  if (t.includes("barrera")) return "barrera";

  if (t.includes("primer")) return "1P";
  if (t.includes("segundo")) return "2P";
  if (t.includes("6m") || t.includes("penalti")) return "central";
  if (t.includes("fuera") || t.includes("frontal")) return "frontal";

  return null;
}

/** Zona desde la que el rival produce el remate. */
function zoneFromRemate(v?: string): ZoneKey | null {
  const t = norm(v);
  if (!t) return null;
  if (t.includes("no remate") || t.includes("no aplica")) return null;

  if (t === "1p" || t.includes("primer")) return "1P";
  if (t === "2p" || t.includes("segundo")) return "2P";
  if (t.includes("central") || t.includes("6m") || t.includes("penalti"))
    return "central";
  if (t.includes("fuera") || t.includes("frontal")) return "frontal";

  return null;
}

/** Gol encajado: marca el rival. "Gol RMCF" es gol nuestro tras transición. */
function esGolEncajado(v?: string) {
  const t = norm(v);
  return t.includes("gol") && !t.includes("rmcf");
}

/** Rampa secuencial navy -> rojo: en defensa el calor señala riesgo concedido. */
function heatColor(t: number) {
  const stops: { p: number; c: [number, number, number] }[] = [
    { p: 0, c: [14, 24, 38] },
    { p: 0.5, c: [122, 58, 58] },
    { p: 1, c: [233, 150, 140] },
  ];

  const ratio = Math.max(0, Math.min(1, t));

  let a = stops[0];
  let b = stops[stops.length - 1];

  for (let i = 0; i < stops.length - 1; i++) {
    if (ratio >= stops[i].p && ratio <= stops[i + 1].p) {
      a = stops[i];
      b = stops[i + 1];
      break;
    }
  }

  const span = b.p - a.p || 1;
  const local = (ratio - a.p) / span;

  const rgb = a.c.map((channel, i) =>
    Math.round(channel + (b.c[i] - channel) * local)
  );

  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

export default function ABPZoneMap({ rows }: { rows: ZoneRow[] }) {
  const [metric, setMetric] = useState<Metric>("ocupacion");
  const [selectedZone, setSelectedZone] = useState<ZoneKey | null>(null);

  const { stats, corto, barrera, sinZona } = useMemo(() => {
    const base: Record<
      ZoneKey,
      {
        ocupacionTotal: number;
        ocupacionMuestras: number;
        caidas: number;
        remates: number;
        xg: number;
        goles: number;
      }
    > = {
      "1P": {
        ocupacionTotal: 0,
        ocupacionMuestras: 0,
        caidas: 0,
        remates: 0,
        xg: 0,
        goles: 0,
      },
      central: {
        ocupacionTotal: 0,
        ocupacionMuestras: 0,
        caidas: 0,
        remates: 0,
        xg: 0,
        goles: 0,
      },
      "2P": {
        ocupacionTotal: 0,
        ocupacionMuestras: 0,
        caidas: 0,
        remates: 0,
        xg: 0,
        goles: 0,
      },
      frontal: {
        ocupacionTotal: 0,
        ocupacionMuestras: 0,
        caidas: 0,
        remates: 0,
        xg: 0,
        goles: 0,
      },
    };

    let corto = 0;
    let barrera = 0;
    let sinZona = 0;

    rows.forEach((r) => {
      const ocupacion: Record<ZoneKey, number | undefined> = {
        "1P": r.oc1P,
        central: r.ocCentral,
        "2P": r.oc2P,
        frontal: r.ocFrontal,
      };

      // La ocupación sólo cuenta cuando la acción tiene estructura registrada.
      const tieneEstructura = (Object.values(ocupacion) as (
        | number
        | undefined
      )[]).some((v) => typeof v === "number" && v > 0);

      (Object.keys(base) as ZoneKey[]).forEach((z) => {
        if (tieneEstructura) {
          base[z].ocupacionTotal += ocupacion[z] || 0;
          base[z].ocupacionMuestras += 1;
        }
      });

      const caida = zoneFromCaida(r.zonaCaida);

      if (caida === "corto") corto += 1;
      else if (caida === "barrera") barrera += 1;
      else if (caida) base[caida].caidas += 1;
      else sinZona += 1;

      const remate = zoneFromRemate(r.zonaRemate);

      if (remate) {
        base[remate].remates += 1;
        base[remate].xg += Number(r.xg) || 0;
        if (esGolEncajado(r.resultadoFinal)) base[remate].goles += 1;
      }
    });

    const stats = {} as Record<ZoneKey, Record<Metric, number>>;

    (Object.keys(base) as ZoneKey[]).forEach((z) => {
      const b = base[z];

      stats[z] = {
        ocupacion: b.ocupacionMuestras
          ? b.ocupacionTotal / b.ocupacionMuestras
          : 0,
        caidas: b.caidas,
        remates: b.remates,
        xg: b.xg,
        goles: b.goles,
        xgPorCaida: b.caidas ? b.xg / b.caidas : 0,
      };
    });

    return { stats, corto, barrera, sinZona };
  }, [rows]);

  const activeMetric =
    METRICS.find((m) => m.key === metric) || METRICS[0];

  const values = ZONES.map((z) => stats[z.key][metric]);
  const maxValue = Math.max(...values, 0);

  const totalOcupacion = ZONES.reduce(
    (acc, z) => acc + stats[z.key].ocupacion,
    0
  );

  const totalXg = ZONES.reduce((acc, z) => acc + stats[z.key].xg, 0);

  const format = (value: number) =>
    activeMetric.decimals === 0
      ? String(Math.round(value))
      : value.toFixed(activeMetric.decimals);

  return (
    <div className="w-full">
      {/* Selector de métrica */}
      <div className="mb-4 flex flex-wrap gap-2">
        {METRICS.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => setMetric(m.key)}
            title={m.hint}
            className={`
              rounded-full border px-3 py-1.5 text-xs transition-all
              ${
                metric === m.key
                  ? "border-[#C8A96B] bg-[#C8A96B] text-black"
                  : "border-white/10 bg-white/[0.04] text-zinc-300 hover:bg-white/[0.08]"
              }
            `}
          >
            {m.label}
          </button>
        ))}
      </div>

      <p className="mb-4 text-xs text-zinc-500">{activeMetric.hint}</p>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
        {/* Campo */}
        <div className="relative mx-auto w-full max-w-[720px]">
          <svg viewBox="0 0 100 46" className="h-full w-full">
            <defs>
              <filter
                id="zoneShadowDef"
                x="-20%"
                y="-20%"
                width="140%"
                height="140%"
              >
                <feDropShadow
                  dx="0"
                  dy="0.6"
                  stdDeviation="0.9"
                  floodColor="#000000"
                  floodOpacity="0.45"
                />
              </filter>
            </defs>

            {/* Césped */}
            <rect
              x="2"
              y="2"
              width="96"
              height="42"
              rx="1.5"
              fill="#07111F"
              stroke="#E5E7EB"
              strokeWidth="0.4"
            />

            {/* Zonas coloreadas por métrica */}
            {ZONES.map((z) => {
              const value = stats[z.key][metric];
              const ratio = maxValue > 0 ? value / maxValue : 0;
              const isSelected = selectedZone === z.key;

              return (
                <g
                  key={z.key}
                  onClick={() =>
                    setSelectedZone(isSelected ? null : z.key)
                  }
                  style={{ cursor: "pointer" }}
                >
                  <rect
                    x={z.x}
                    y={z.y}
                    width={z.w}
                    height={z.h}
                    fill={heatColor(ratio)}
                    fillOpacity={0.9}
                    stroke={isSelected ? "#FFFFFF" : "#0B1728"}
                    strokeWidth={isSelected ? 0.7 : 0.3}
                  />

                  <text
                    x={z.x + z.w / 2}
                    y={z.y + z.h / 2 + 0.4}
                    textAnchor="middle"
                    fontSize="4.4"
                    fontWeight="700"
                    fill={ratio > 0.55 ? "#0B1728" : "#F8FAFC"}
                    filter="url(#zoneShadowDef)"
                  >
                    {format(value)}
                  </text>

                  <text
                    x={z.x + z.w / 2}
                    y={z.y + z.h / 2 + 4.6}
                    textAnchor="middle"
                    fontSize="2.1"
                    fontWeight="600"
                    fill={ratio > 0.55 ? "#1F2937" : "#94A3B8"}
                  >
                    {z.label.toUpperCase()}
                  </text>
                </g>
              );
            })}

            {/* Líneas de campo por encima del mapa de calor */}
            <rect
              x="21.5"
              y="2"
              width="57"
              height="23"
              fill="none"
              stroke="#F4F4F5"
              strokeWidth="0.4"
            />

            <rect
              x="37"
              y="2"
              width="26"
              height="7.7"
              fill="none"
              stroke="#F4F4F5"
              strokeWidth="0.35"
              strokeOpacity="0.75"
            />

            <circle cx="50" cy="17.4" r="0.7" fill="#F4F4F5" />

            <path
              d="M39 25 A 12 12 0 0 0 61 25"
              fill="none"
              stroke="#F4F4F5"
              strokeWidth="0.35"
              strokeOpacity="0.75"
            />

            {/* Portería */}
            <line
              x1="44"
              y1="2"
              x2="56"
              y2="2"
              stroke="#F4F4F5"
              strokeWidth="1.1"
            />

            {/* Banderines de córner */}
            <path
              d="M2 5 A 3 3 0 0 0 5 2"
              fill="none"
              stroke="#F4F4F5"
              strokeWidth="0.35"
              strokeOpacity="0.6"
            />
            <path
              d="M95 2 A 3 3 0 0 0 98 5"
              fill="none"
              stroke="#F4F4F5"
              strokeWidth="0.35"
              strokeOpacity="0.6"
            />

            {/* Juego en corto del rival: no llega al área */}
            {corto > 0 && (
              <g>
                <rect
                  x="4"
                  y="37"
                  width="29"
                  height="6"
                  rx="1.4"
                  fill="#0B1728"
                  stroke="#3B82F6"
                  strokeWidth="0.35"
                />
                <text
                  x="18.5"
                  y="40"
                  textAnchor="middle"
                  fontSize="2.2"
                  fontWeight="700"
                  fill="#93C5FD"
                >
                  Juego en corto
                </text>
                <text
                  x="18.5"
                  y="42.4"
                  textAnchor="middle"
                  fontSize="2"
                  fill="#BFDBFE"
                >
                  {corto} envíos ·{" "}
                  {rows.length
                    ? ((corto / rows.length) * 100).toFixed(0)
                    : 0}
                  %
                </text>
              </g>
            )}

            {/* Golpeo directo contra la barrera */}
            {barrera > 0 && (
              <g>
                <rect
                  x="35.5"
                  y="37"
                  width="29"
                  height="6"
                  rx="1.4"
                  fill="#0B1728"
                  stroke="#C8A96B"
                  strokeWidth="0.35"
                />
                <text
                  x="50"
                  y="40"
                  textAnchor="middle"
                  fontSize="2.2"
                  fontWeight="700"
                  fill="#E7D2A0"
                >
                  Directa a barrera
                </text>
                <text
                  x="50"
                  y="42.4"
                  textAnchor="middle"
                  fontSize="2"
                  fill="#D8C39A"
                >
                  {barrera} acciones ·{" "}
                  {rows.length
                    ? ((barrera / rows.length) * 100).toFixed(0)
                    : 0}
                  %
                </text>
              </g>
            )}

            {sinZona > 0 && (
              <text
                x="96"
                y="42.4"
                textAnchor="end"
                fontSize="2"
                fill="#64748B"
              >
                {sinZona} sin zona registrada
              </text>
            )}
          </svg>

          {/* Escala */}
          <div className="mt-3 flex items-center gap-3">
            <span className="text-[11px] text-zinc-500">0</span>

            <div
              className="h-2 flex-1 rounded-full"
              style={{
                background: `linear-gradient(90deg, ${heatColor(
                  0
                )}, ${heatColor(0.5)}, ${heatColor(1)})`,
              }}
            />

            <span className="text-[11px] text-zinc-500">
              {format(maxValue)}
            </span>
          </div>
        </div>

        {/* Detalle de la zona seleccionada */}
        {selectedZone ? (
          <div className="rounded-2xl border border-[#C8A96B]/30 bg-white/[0.03] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-zinc-400">
                  Zona
                </p>

                <p className="mt-1 text-base font-semibold text-[#E7D2A0]">
                  {
                    ZONES.find((z) => z.key === selectedZone)
                      ?.label
                  }
                </p>
              </div>

              <button
                type="button"
                aria-label="Cerrar detalle de zona"
                onClick={() => setSelectedZone(null)}
                className="shrink-0 rounded-full p-1 text-slate-400 transition hover:bg-white/5 hover:text-white"
              >
                ×
              </button>
            </div>

            <dl className="mt-4 space-y-2">
              {METRICS.map((m) => (
                <div
                  key={m.key}
                  className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2"
                >
                  <dt className="text-[11px] text-zinc-400">
                    {m.label}
                  </dt>

                  <dd className="text-sm font-semibold text-white">
                    {m.decimals === 0
                      ? Math.round(
                          stats[selectedZone][m.key]
                        )
                      : stats[selectedZone][m.key].toFixed(
                          m.decimals
                        )}
                  </dd>
                </div>
              ))}
            </dl>

            <p className="mt-3 text-[11px] leading-snug text-zinc-500">
              Ocupación y envíos miden cómo defendemos la zona; remates, xG y
              goles miden lo que el rival nos saca de ella.
            </p>
          </div>
        ) : (
        /* Balance ocupación vs. peligro concedido */
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs uppercase tracking-wide text-zinc-400">
            Ocupación vs. peligro concedido
          </p>

          <p className="mt-1 text-[11px] leading-snug text-zinc-500">
            Reparto de jugadores frente al reparto de xG que el rival genera
            en cada zona.
          </p>

          <div className="mt-4 space-y-4">
            {ZONES.map((z) => {
              const occShare = totalOcupacion
                ? (stats[z.key].ocupacion / totalOcupacion) * 100
                : 0;

              const xgShare = totalXg
                ? (stats[z.key].xg / totalXg) * 100
                : 0;

              return (
                <div key={z.key}>
                  <div className="mb-1.5 flex items-center justify-between text-[11px]">
                    <span className="text-zinc-300">{z.label}</span>
                    <span className="text-zinc-500">
                      {occShare.toFixed(0)}% / {xgShare.toFixed(0)}%
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="h-1.5 w-full rounded-full bg-white/5">
                      <div
                        className="h-1.5 rounded-full bg-[#5E7FB8]"
                        style={{ width: `${occShare}%` }}
                      />
                    </div>

                    <div className="h-1.5 w-full rounded-full bg-white/5">
                      <div
                        className="h-1.5 rounded-full bg-[#D08A7E]"
                        style={{ width: `${xgShare}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap gap-3 text-[11px] text-zinc-400">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#5E7FB8]" />
              Ocupación
            </span>

            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#D08A7E]" />
              xG concedido
            </span>
          </div>

          <p className="mt-4 text-[11px] leading-snug text-zinc-500">
            Pulsa una zona del campo para ver su detalle completo.
          </p>
        </div>
        )}
      </div>
    </div>
  );
}
