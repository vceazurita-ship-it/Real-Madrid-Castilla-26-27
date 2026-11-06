"use client";

/*
| TODOS LOS GRÁFICOS, PINCHABLES (06/11/2026)
|
| Sustituto directo de `ResponsiveContainer` de recharts: el mismo gráfico con
| un iconito en la esquina para verlo de otra forma, recordado por gráfico en
| este aparato. Dos familias, como pidió el analista:
| - Clásicos: el original, barras, líneas y tabla.
| - Actuales: piruleta ordenada (lollipop), mapa de calor y, con dos series o
|   más, la comparativa de dos series (dumbbell).
| Los datos se sacan del propio gráfico (la prop `data` del gráfico o de su
| serie), así que no hay que tocar cada pantalla: basta con cambiar la etiqueta.
|
| El icono va encima del gráfico, sin mover nada: los contenedores tienen alto
| fijo y una barra de herramientas encima los desbordaría. Colores por clases
| que traduce el modo día (globals.css), nunca fijos en `style`.
*/

import { Children, isValidElement, useId, useMemo, useState, type ReactElement, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { LayoutGrid } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { useTipoGrafico } from "./MarcoGrafico";

type Fila = Record<string, unknown>;

/** La primera lista de filas que encuentre en el árbol del gráfico. */
function datosDe(nodo: ReactNode): Fila[] | null {
  let hallado: Fila[] | null = null;
  Children.forEach(nodo, (hijo) => {
    if (hallado || !isValidElement(hijo)) return;
    const props = hijo.props as { data?: unknown; children?: ReactNode };
    if (Array.isArray(props.data) && props.data.length && typeof props.data[0] === "object") hallado = props.data as Fila[];
    else hallado = datosDe(props.children);
  });
  return hallado;
}

const COLORES = ["#D8B45A", "#4F8FE8", "#1B9E77", "#D95F02", "#A78BFA", "#22D3EE"];

const TIPOS = [
  { clave: "original", nombre: "El de esta pantalla", familia: "Clásicos" },
  { clave: "barras", nombre: "Barras", familia: "Clásicos" },
  { clave: "lineas", nombre: "Líneas", familia: "Clásicos" },
  { clave: "tabla", nombre: "Tabla", familia: "Clásicos" },
  { clave: "piruleta", nombre: "Piruleta ordenada", familia: "Actuales" },
  { clave: "calor", nombre: "Mapa de calor", familia: "Actuales" },
  { clave: "pesas", nombre: "Dos series (pesas)", familia: "Actuales" },
] as const;
type Tipo = (typeof TIPOS)[number]["clave"];

const fmt = (v: unknown) => (typeof v === "number" ? (Number.isInteger(v) ? String(v) : v.toFixed(2).replace(".", ",")) : String(v ?? ""));
/* Los nombres internos de las series, en castellano (06/11/2026): salían «name» y «total». */
const ROTULOS: Record<string, string> = { name: "", label: "", nombre: "", value: "Valor", valor: "Valor", total: "Total", count: "Cantidad", cantidad: "Cantidad", pct: "%", porcentaje: "%", media: "Media", rating: "Nota", nota: "Nota", minutes: "Minutos", goals: "Goles", assists: "Asistencias" };
const rotulo = (k: string) => (k in ROTULOS ? ROTULOS[k] : k.charAt(0).toUpperCase() + k.slice(1));
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

export function ResponsiveConVistas({ children, width = "100%", height = "100%", ...resto }: { children?: ReactNode; width?: number | `${number}%`; height?: number | `${number}%`; [k: string]: unknown }) {
  const ruta = usePathname();
  /* Cada gráfico, su vista (06/11/2026): con sólo la ruta y las columnas, dos gráficos iguales cambiaban a la vez. */
  const sitio = useId();
  const datos = useMemo(() => datosDe(children), [children]);

  /* Las columnas: la etiqueta (primer texto) y las numéricas. */
  const { etiqueta, numericas } = useMemo(() => {
    const filas = datos ?? [];
    const claves = [...new Set(filas.flatMap((f) => Object.keys(f)))];
    const n = claves.filter((k) => filas.some((f) => typeof f[k] === "number") && !/^(id|key|x|y|z|orden|index)$/i.test(k));
    const eti = claves.find((k) => filas.some((f) => typeof f[k] === "string")) ?? null;
    return { etiqueta: eti, numericas: n.slice(0, 6) };
  }, [datos]);

  const firma = `${ruta}|${sitio}|${etiqueta}|${numericas.join(",")}`;
  const [tipo, setTipo] = useTipoGrafico<Tipo>(`rc:${firma}`, "original", TIPOS.map((t) => t.clave));
  const [menu, setMenu] = useState(false);

  const puedeCambiar = Boolean(datos && datos.length && numericas.length);
  const disponibles = TIPOS.filter((t) => t.clave !== "pesas" || numericas.length >= 2);
  const vista = puedeCambiar && disponibles.some((t) => t.clave === tipo) ? tipo : "original";
  const nombreDe = (f: Fila, i: number) => (etiqueta ? fmt(f[etiqueta]) : String(i + 1));

  return (
    <div className="relative h-full w-full">
      {puedeCambiar && (
        <div className="absolute right-1 top-1 z-10">
          <button
            type="button"
            onClick={() => setMenu((m) => !m)}
            aria-label="Ver este gráfico de otra forma"
            aria-expanded={menu}
            title="Ver como: clásicos (barras, líneas, tabla) o actuales (piruleta, mapa de calor, pesas)"
            className="rounded-md border border-[rgb(var(--rmcf-ink-rgb)/0.15)] bg-[var(--rmcf-surface,#0B0F14)] p-1 text-[rgb(var(--rmcf-ink-rgb)/0.70)] transition hover:text-[#C8A96B]"
          >
            <LayoutGrid size={13} />
          </button>
          {menu && (
            <div role="menu" className="absolute right-0 mt-1 w-44 overflow-hidden rounded-lg border border-[rgb(var(--rmcf-ink-rgb)/0.15)] bg-[var(--rmcf-surface,#0B0F14)] py-1 text-[12px] shadow-xl">
              {(["Clásicos", "Actuales"] as const).map((familia) => (
                <div key={familia}>
                  <p className="px-3 pb-0.5 pt-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[rgb(var(--rmcf-ink-rgb)/0.45)]">{familia}</p>
                  {disponibles.filter((t) => t.familia === familia).map((t) => (
                    <button
                      key={t.clave}
                      type="button"
                      role="menuitemradio"
                      aria-checked={vista === t.clave}
                      onClick={() => {
                        setTipo(t.clave);
                        setMenu(false);
                      }}
                      className={`block w-full px-3 py-1.5 text-left hover:bg-[rgb(var(--rmcf-ink-rgb)/0.08)] ${vista === t.clave ? "font-semibold text-[#C8A96B]" : "text-[rgb(var(--rmcf-ink-rgb)/0.85)]"}`}
                    >
                      {t.nombre}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {vista === "original" && (
        <ResponsiveContainer width={width} height={height} {...resto}>
          {children as ReactElement}
        </ResponsiveContainer>
      )}

      {(vista === "barras" || vista === "lineas") && datos && (
        <ResponsiveContainer width="100%" height="100%">
          {vista === "barras" ? (
            <BarChart data={datos} margin={{ top: 24, right: 12, left: 0, bottom: 4 }}>
              <CartesianGrid strokeOpacity={0.15} vertical={false} />
              {etiqueta && <XAxis dataKey={etiqueta} tick={{ fontSize: 11 }} interval="preserveStartEnd" />}
              <YAxis tick={{ fontSize: 11 }} width={36} />
              <Tooltip />
              {numericas.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
              {numericas.map((k, i) => (
                <Bar key={k} dataKey={k} name={rotulo(k)} fill={COLORES[i % COLORES.length]} radius={[3, 3, 0, 0]} />
              ))}
            </BarChart>
          ) : (
            <LineChart data={datos} margin={{ top: 24, right: 12, left: 0, bottom: 4 }}>
              <CartesianGrid strokeOpacity={0.15} vertical={false} />
              {etiqueta && <XAxis dataKey={etiqueta} tick={{ fontSize: 11 }} interval="preserveStartEnd" />}
              <YAxis tick={{ fontSize: 11 }} width={36} />
              <Tooltip />
              {numericas.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
              {numericas.map((k, i) => (
                <Line key={k} dataKey={k} name={rotulo(k)} stroke={COLORES[i % COLORES.length]} strokeWidth={2} dot={{ r: 3 }} />
              ))}
            </LineChart>
          )}
        </ResponsiveContainer>
      )}

      {vista === "tabla" && datos && (
        <div className="h-full overflow-auto pt-7">
          <table className="w-full text-[12px]">
            <thead className="text-left text-[rgb(var(--rmcf-ink-rgb)/0.55)]">
              <tr>
                {etiqueta && <th className="px-2 py-1 font-medium">{rotulo(etiqueta)}</th>}
                {numericas.map((k) => (
                  <th key={k} className="px-2 py-1 text-right font-medium">{rotulo(k)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {datos.map((f, i) => (
                <tr key={i} className="border-t border-[rgb(var(--rmcf-ink-rgb)/0.10)]">
                  {etiqueta && <td className="px-2 py-1 text-[rgb(var(--rmcf-ink-rgb)/0.85)]">{fmt(f[etiqueta])}</td>}
                  {numericas.map((k) => (
                    <td key={k} className="px-2 py-1 text-right tabular-nums text-[rgb(var(--rmcf-ink-rgb)/0.75)]">{fmt(f[k])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Actual: piruleta ordenada de la primera serie, de más a menos. */}
      {vista === "piruleta" && datos && (() => {
        const k = numericas[0];
        const filas = [...datos].map((f, i) => ({ n: nombreDe(f, i), v: num(f[k]) })).sort((a, b) => b.v - a.v);
        const max = Math.max(...filas.map((f) => Math.abs(f.v)), 1);
        return (
          <div className="h-full overflow-auto pt-7 pr-1">
            <p className="mb-1 text-[11px] text-[rgb(var(--rmcf-ink-rgb)/0.55)]">{rotulo(k)}, de más a menos</p>
            <ul className="space-y-1">
              {filas.map((f, i) => (
                <li key={i} className="flex items-center gap-2 text-[12px]">
                  <span className="w-28 shrink-0 truncate text-[rgb(var(--rmcf-ink-rgb)/0.80)]" title={f.n}>{f.n}</span>
                  <span className="relative h-3 flex-1">
                    <span className="absolute left-0 top-1/2 h-px -translate-y-1/2 bg-white/30" style={{ width: `${(Math.abs(f.v) / max) * 100}%` }} />
                    <span className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: `${(Math.abs(f.v) / max) * 100}%`, background: COLORES[0] }} />
                  </span>
                  <span className="w-12 shrink-0 text-right tabular-nums text-[rgb(var(--rmcf-ink-rgb)/0.80)]">{fmt(f.v)}</span>
                </li>
              ))}
            </ul>
          </div>
        );
      })()}

      {/* Actual: mapa de calor, cada columna con su propia escala. */}
      {vista === "calor" && datos && (() => {
        const rango = Object.fromEntries(numericas.map((k) => { const v = datos.map((f) => num(f[k])); return [k, [Math.min(...v), Math.max(...v)]]; }));
        return (
          <div className="h-full overflow-auto pt-7">
            <table className="w-full border-separate border-spacing-0.5 text-[12px]">
              <thead className="text-[rgb(var(--rmcf-ink-rgb)/0.55)]">
                <tr>
                  {etiqueta && <th className="px-2 py-1 text-left font-medium">{rotulo(etiqueta)}</th>}
                  {numericas.map((k) => <th key={k} className="px-2 py-1 font-medium">{rotulo(k)}</th>)}
                </tr>
              </thead>
              <tbody>
                {datos.map((f, i) => (
                  <tr key={i}>
                    {etiqueta && <td className="px-2 py-1 text-[rgb(var(--rmcf-ink-rgb)/0.85)]">{fmt(f[etiqueta])}</td>}
                    {numericas.map((k) => {
                      const [a, b] = rango[k];
                      const t = b > a ? (num(f[k]) - a) / (b - a) : 0.5;
                      return (
                        <td key={k} className="rounded px-2 py-1 text-center tabular-nums text-[rgb(var(--rmcf-ink-rgb)/0.90)]" style={{ background: `rgba(216,180,90,${0.08 + t * 0.62})` }}>
                          {fmt(f[k])}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-1 text-[11px] text-[rgb(var(--rmcf-ink-rgb)/0.50)]">Más intenso = más alto dentro de su columna.</p>
          </div>
        );
      })()}

      {/* Actual: pesas (dumbbell) entre las dos primeras series, fila a fila. */}
      {vista === "pesas" && datos && numericas.length >= 2 && (() => {
        const [k1, k2] = numericas;
        const todos = datos.flatMap((f) => [num(f[k1]), num(f[k2])]);
        const min = Math.min(...todos, 0);
        const max = Math.max(...todos, 1);
        const pos = (v: number) => ((v - min) / (max - min || 1)) * 100;
        return (
          <div className="h-full overflow-auto pt-7 pr-1">
            <p className="mb-1 flex gap-3 text-[11px] text-[rgb(var(--rmcf-ink-rgb)/0.60)]">
              <span><span style={{ color: COLORES[0] }}>●</span> {rotulo(k1)}</span>
              <span><span style={{ color: COLORES[1] }}>●</span> {rotulo(k2)}</span>
            </p>
            <ul className="space-y-1.5">
              {datos.map((f, i) => {
                const a = pos(num(f[k1]));
                const b = pos(num(f[k2]));
                return (
                  <li key={i} className="flex items-center gap-2 text-[12px]" title={`${rotulo(k1)} ${fmt(f[k1])} · ${rotulo(k2)} ${fmt(f[k2])}`}>
                    <span className="w-28 shrink-0 truncate text-[rgb(var(--rmcf-ink-rgb)/0.80)]">{nombreDe(f, i)}</span>
                    <span className="relative h-3 flex-1">
                      <span className="absolute top-1/2 h-0.5 -translate-y-1/2 bg-white/30" style={{ left: `${Math.min(a, b)}%`, width: `${Math.abs(a - b)}%` }} />
                      <span className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: `${a}%`, background: COLORES[0] }} />
                      <span className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: `${b}%`, background: COLORES[1] }} />
                    </span>
                    <span className="w-20 shrink-0 text-right tabular-nums text-[rgb(var(--rmcf-ink-rgb)/0.75)]">{fmt(f[k1])} · {fmt(f[k2])}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })()}
    </div>
  );
}
