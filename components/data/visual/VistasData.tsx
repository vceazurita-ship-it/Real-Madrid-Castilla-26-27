"use client";

/*
| VISTAS ALTERNATIVAS DE LOS GRÁFICOS DE DATA ANÁLISIS (06/11/2026)
|
| Cada pieza común (la liga ordenada, dos métricas, la evolución) se puede ver
| de varias formas, clásicas y actuales, desde el icono «Ver como». Colores por
| clases que traduce el modo día; el oro del Castilla y el azul del comparado
| son los de siempre.
*/

import { formatea, type Unidad } from "@/lib/data-analisis/metricas";

const ORO = "#C8A96B";
const AZUL = "#4F8FE8";
const colorDe = (equipo: string, destacado: string, comparado?: string) => (equipo === destacado ? ORO : equipo === comparado ? AZUL : undefined);

/* ============================ UNA MÉTRICA, TODOS LOS EQUIPOS ============================ */

type Fila = { equipo: string; valor: number };

const mediana = (v: number[]) => {
  const o = [...v].sort((a, b) => a - b);
  return o.length ? (o.length % 2 ? o[(o.length - 1) / 2] : (o[o.length / 2 - 1] + o[o.length / 2]) / 2) : 0;
};

/** Piruleta: un palo fino y una bola, ordenados; menos tinta que la barra. */
export function Piruleta({ filas, unidad, destacado, comparado }: { filas: Fila[]; unidad: Unidad; destacado: string; comparado?: string }) {
  const max = Math.max(...filas.map((f) => Math.abs(f.valor)), 1e-9);
  return (
    <ol className="space-y-1">
      {filas.map((f, i) => {
        const c = colorDe(f.equipo, destacado, comparado);
        const w = (Math.abs(f.valor) / max) * 100;
        return (
          <li key={f.equipo} className="flex items-center gap-2 text-[12px]">
            <span className="w-5 shrink-0 text-right tabular-nums text-white/45">{i + 1}</span>
            <span className={`w-36 shrink-0 truncate ${c ? "font-semibold" : "text-white/75"}`} style={c ? { color: c } : undefined}>{f.equipo}</span>
            <span className="relative h-3 flex-1">
              <span className="absolute left-0 top-1/2 h-px -translate-y-1/2 bg-white/30" style={{ width: `${w}%` }} />
              <span className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: `${w}%`, background: c ?? "rgb(var(--rmcf-ink-rgb) / 0.45)" }} />
            </span>
            <span className="w-14 shrink-0 text-right tabular-nums text-white/80">{formatea(f.valor, unidad)}</span>
          </li>
        );
      })}
    </ol>
  );
}

/** Desviación: cuánto se aleja cada uno de la mediana de la liga, a izquierda o derecha. */
export function Desviacion({ filas, unidad, destacado, comparado, mejorAlto }: { filas: Fila[]; unidad: Unidad; destacado: string; comparado?: string; mejorAlto: boolean | null }) {
  const med = mediana(filas.map((f) => f.valor));
  const max = Math.max(...filas.map((f) => Math.abs(f.valor - med)), 1e-9);
  return (
    <div>
      <p className="mb-2 text-[11px] text-white/55">Mediana de la liga: <b className="text-white/80">{formatea(med, unidad)}</b>. {mejorAlto === false ? "Aquí menos es mejor: a la izquierda, mejor." : mejorAlto ? "A la derecha, mejor." : ""}</p>
      <ol className="space-y-1">
        {filas.map((f) => {
          const d = f.valor - med;
          const c = colorDe(f.equipo, destacado, comparado);
          const bueno = mejorAlto === null ? null : mejorAlto ? d >= 0 : d <= 0;
          return (
            <li key={f.equipo} className="grid grid-cols-[9rem_1fr_3.5rem] items-center gap-2 text-[12px]">
              <span className={`truncate ${c ? "font-semibold" : "text-white/75"}`} style={c ? { color: c } : undefined}>{f.equipo}</span>
              <span className="relative h-3">
                <span className="absolute inset-y-0 left-1/2 w-px bg-white/40" />
                <span
                  className="absolute inset-y-0 rounded-sm"
                  style={{
                    left: d >= 0 ? "50%" : `${50 - (Math.abs(d) / max) * 50}%`,
                    width: `${(Math.abs(d) / max) * 50}%`,
                    background: c ?? (bueno === null ? "rgb(var(--rmcf-ink-rgb) / 0.35)" : bueno ? "#1B9E77" : "#D95F02"),
                  }}
                />
              </span>
              <span className="text-right tabular-nums text-white/75">{d >= 0 ? "+" : "−"}{formatea(Math.abs(d), unidad)}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** Franja de puntos: los veinte en una sola línea, para ver los huecos y los grupos. */
export function Franja({ filas, unidad, destacado, comparado }: { filas: Fila[]; unidad: Unidad; destacado: string; comparado?: string }) {
  const v = filas.map((f) => f.valor);
  const min = Math.min(...v);
  const max = Math.max(...v);
  const pos = (x: number) => (max > min ? ((x - min) / (max - min)) * 100 : 50);
  const med = mediana(v);
  const marcados = filas.filter((f) => colorDe(f.equipo, destacado, comparado));
  return (
    <div className="px-2 pb-2 pt-10">
      <div className="relative h-10">
        <span className="absolute inset-x-0 top-1/2 h-px bg-white/25" />
        <span className="absolute top-0 h-full w-px bg-white/40" style={{ left: `${pos(med)}%` }} title={`Mediana ${formatea(med, unidad)}`} />
        {filas.map((f) => {
          const c = colorDe(f.equipo, destacado, comparado);
          return <span key={f.equipo} title={`${f.equipo}: ${formatea(f.valor, unidad)}`} className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: `${pos(f.valor)}%`, width: c ? 16 : 10, height: c ? 16 : 10, background: c ?? "rgb(var(--rmcf-ink-rgb) / 0.4)", outline: c ? "2px solid var(--background)" : undefined }} />;
        })}
        {marcados.map((f, i) => (
          <span key={f.equipo} className="absolute -translate-x-1/2 whitespace-nowrap text-[11px] font-semibold" style={{ left: `${pos(f.valor)}%`, top: i % 2 ? 40 : -26, color: colorDe(f.equipo, destacado, comparado) }}>
            {f.equipo} · {formatea(f.valor, unidad)}
          </span>
        ))}
      </div>
      <div className="mt-6 flex justify-between text-[11px] text-white/50">
        <span>{formatea(min, unidad)}</span>
        <span>mediana {formatea(med, unidad)}</span>
        <span>{formatea(max, unidad)}</span>
      </div>
    </div>
  );
}

export function TablaEquipos({ filas, unidad, destacado, comparado }: { filas: Fila[]; unidad: Unidad; destacado: string; comparado?: string }) {
  const n = filas.length;
  return (
    <table className="w-full text-[12px]">
      <thead className="text-left text-white/55">
        <tr><th className="px-2 py-1 font-medium">#</th><th className="px-2 py-1 font-medium">Equipo</th><th className="px-2 py-1 text-right font-medium">Valor</th><th className="px-2 py-1 text-right font-medium">Percentil</th></tr>
      </thead>
      <tbody>
        {filas.map((f, i) => {
          const c = colorDe(f.equipo, destacado, comparado);
          return (
            <tr key={f.equipo} className="border-t border-white/10">
              <td className="px-2 py-1 tabular-nums text-white/50">{i + 1}</td>
              <td className={`px-2 py-1 ${c ? "font-semibold" : "text-white/85"}`} style={c ? { color: c } : undefined}>{f.equipo}</td>
              <td className="px-2 py-1 text-right tabular-nums text-white/80">{formatea(f.valor, unidad)}</td>
              <td className="px-2 py-1 text-right tabular-nums text-white/60">P{Math.round(n > 1 ? (100 * (n - 1 - i)) / (n - 1) : 50)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/* ============================ DOS MÉTRICAS ============================ */

type Punto = { equipo: string; x: number; y: number };

/** Percentil de cada valor en su eje (0 el peor, 100 el mejor, según el sentido). */
export function aPercentiles(puntos: Punto[], xMejorAlto = true, yMejorAlto = true) {
  const rango = (vals: number[], alto: boolean) => {
    const o = [...vals].sort((a, b) => a - b);
    return vals.map((v) => {
      const p = vals.length < 2 ? 50 : (100 * o.indexOf(v)) / (vals.length - 1);
      return alto ? p : 100 - p;
    });
  };
  const rx = rango(puntos.map((p) => p.x), xMejorAlto);
  const ry = rango(puntos.map((p) => p.y), yMejorAlto);
  return puntos.map((p, i) => ({ ...p, px: rx[i], py: ry[i] }));
}

/** Pesas: los dos percentiles de cada equipo en la misma fila; la barra, la distancia entre ellos. */
export function Pesas({ puntos, etiquetaX, etiquetaY, destacado, comparado }: { puntos: (Punto & { px: number; py: number })[]; etiquetaX: string; etiquetaY: string; destacado: string; comparado?: string }) {
  const orden = [...puntos].sort((a, b) => b.px + b.py - (a.px + a.py));
  return (
    <div>
      <p className="mb-2 flex flex-wrap gap-3 text-[11px] text-white/60">
        <span><span style={{ color: ORO }}>●</span> {etiquetaX} (percentil)</span>
        <span><span style={{ color: AZUL }}>●</span> {etiquetaY} (percentil)</span>
        <span>Ordenados por la suma de los dos.</span>
      </p>
      <ol className="space-y-1">
        {orden.map((p) => {
          const c = colorDe(p.equipo, destacado, comparado);
          return (
            <li key={p.equipo} className="grid grid-cols-[9rem_1fr_4.5rem] items-center gap-2 text-[12px]" title={`${etiquetaX} P${Math.round(p.px)} · ${etiquetaY} P${Math.round(p.py)}`}>
              <span className={`truncate ${c ? "font-semibold" : "text-white/75"}`} style={c ? { color: c } : undefined}>{p.equipo}</span>
              <span className="relative h-3">
                <span className="absolute top-1/2 h-0.5 -translate-y-1/2 bg-white/30" style={{ left: `${Math.min(p.px, p.py)}%`, width: `${Math.abs(p.px - p.py)}%` }} />
                <span className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: `${p.px}%`, background: ORO }} />
                <span className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: `${p.py}%`, background: AZUL }} />
              </span>
              <span className="text-right tabular-nums text-white/70">{Math.round(p.px)} · {Math.round(p.py)}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* ============================ A LO LARGO DEL TIEMPO ============================ */

type Serie = { etiqueta: string; valor: number | null };

/** Barras frente a la media: cada partido, por encima o por debajo de su propia media. */
export function BarrasMedia({ serie, unidad, media }: { serie: Serie[]; unidad: Unidad; media?: number | null }) {
  const vals = serie.filter((s): s is { etiqueta: string; valor: number } => s.valor !== null);
  const ref = media ?? (vals.length ? vals.reduce((a, s) => a + s.valor, 0) / vals.length : 0);
  const max = Math.max(...vals.map((s) => Math.abs(s.valor - ref)), 1e-9);
  return (
    <div>
      <p className="mb-2 text-[11px] text-white/55">Respecto a la media: <b className="text-white/80">{formatea(ref, unidad)}</b>.</p>
      <div className="flex h-44 items-stretch gap-1">
        {vals.map((s) => {
          const d = s.valor - ref;
          const h = (Math.abs(d) / max) * 50;
          return (
            <div key={s.etiqueta} className="relative flex-1" title={`${s.etiqueta}: ${formatea(s.valor, unidad)}`}>
              <span className="absolute inset-x-0 top-1/2 h-px bg-white/30" />
              <span className="absolute inset-x-[15%] rounded-sm" style={{ top: d >= 0 ? `${50 - h}%` : "50%", height: `${h}%`, background: d >= 0 ? ORO : "rgb(var(--rmcf-ink-rgb) / 0.35)" }} />
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex gap-1 text-[10px] text-white/45">{vals.map((s) => <span key={s.etiqueta} className="flex-1 truncate text-center">{s.etiqueta}</span>)}</div>
    </div>
  );
}

/** Media móvil de tres: quita el ruido de un partido suelto y deja ver la tendencia. */
export function MediaMovil({ serie, unidad }: { serie: Serie[]; unidad: Unidad }) {
  const vals = serie.filter((s): s is { etiqueta: string; valor: number } => s.valor !== null);
  const movil = vals.map((_, i) => {
    const t = vals.slice(Math.max(0, i - 2), i + 1);
    return t.reduce((a, s) => a + s.valor, 0) / t.length;
  });
  const todos = [...vals.map((s) => s.valor), ...movil];
  const min = Math.min(...todos);
  const max = Math.max(...todos);
  const W = 720;
  const H = 200;
  const x = (i: number) => 30 + (i * (W - 60)) / Math.max(1, vals.length - 1);
  const y = (v: number) => H - 24 - ((v - min) / (max - min || 1)) * (H - 48);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Media móvil de tres">
      {vals.map((s, i) => <circle key={s.etiqueta} cx={x(i)} cy={y(s.valor)} r={3.5} fill="currentColor" fillOpacity={0.35}><title>{`${s.etiqueta}: ${formatea(s.valor, unidad)}`}</title></circle>)}
      <polyline points={movil.map((v, i) => `${x(i)},${y(v)}`).join(" ")} fill="none" stroke={ORO} strokeWidth={3} strokeLinecap="round" />
      {vals.map((s, i) => (i === 0 || i === vals.length - 1 || i % Math.ceil(vals.length / 8) === 0) && <text key={s.etiqueta} x={x(i)} y={H - 6} textAnchor="middle" fontSize="11" fill="currentColor" fillOpacity={0.55}>{s.etiqueta}</text>)}
      <text x={W - 30} y={y(movil[movil.length - 1] ?? 0) - 8} textAnchor="end" fontSize="12" fontWeight="700" fill={ORO}>media de 3 · {formatea(movil[movil.length - 1] ?? 0, unidad)}</text>
    </svg>
  );
}

export function TablaSerie({ serie, unidad }: { serie: Serie[]; unidad: Unidad }) {
  return (
    <table className="w-full text-[12px]">
      <tbody>
        {serie.filter((s) => s.valor !== null).map((s) => (
          <tr key={s.etiqueta} className="border-t border-white/10"><td className="px-2 py-1 text-white/80">{s.etiqueta}</td><td className="px-2 py-1 text-right tabular-nums text-white/85">{formatea(s.valor, unidad)}</td></tr>
        ))}
      </tbody>
    </table>
  );
}
