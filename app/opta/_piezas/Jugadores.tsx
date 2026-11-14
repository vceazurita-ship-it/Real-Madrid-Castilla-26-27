"use client";

/**
 * LOS JUGADORES DEL CASTILLA: minutos y métricas por 90 en una tabla que se
 * ordena; al pinchar uno, su ficha con percentiles contra su puesto.
 */

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";

import { CASTILLA_OPTA, num, PUESTO_OPTA } from "@/lib/opta";
import { CLAVES_JUGADOR, valorJugador, type Fila } from "@/lib/opta-analisis";
import { cortoMetrica, defMetrica, METRICAS_OPTA, nombreMetrica } from "@/lib/opta-nombres";

import { Elegir, fmt, Panel } from "./comun";
import { FichaJugador } from "./FichaJugador";
import type { DatosOpta } from "./useOpta";

const COLUMNAS_INICIALES = ["Goal", "ExpG", "xA", "Chance", "ShtIncBl", "Pass%", "Recovery", "Duel%", "PossLost"];

export function CampoMinimo({ valor, alCambiar }: { valor: number; alCambiar: (n: number) => void }) {
  return (
    <label className="inline-flex items-center gap-2 text-xs text-white/55" title="Para el percentil sólo cuentan los jugadores con al menos estos minutos">
      Mínimo de minutos
      <input
        type="number"
        min={0}
        step={90}
        value={valor}
        onChange={(e) => alCambiar(Math.max(0, Number(e.target.value) || 0))}
        className="w-20 rounded-xl border border-white/10 bg-white/[0.04] px-2 py-1.5 text-sm text-white"
      />
    </label>
  );
}

export function Jugadores({ datos, minimo, setMinimo }: { datos: DatosOpta; minimo: number; setMinimo: (n: number) => void }) {
  const { jugadores, catalogo } = datos;
  const [columnas, setColumnas] = useState<string[]>(COLUMNAS_INICIALES);
  const [orden, setOrden] = useState<{ col: string; desc: boolean }>({ col: "Min", desc: true });
  const [elegido, setElegido] = useState<string | null>(null);

  const nuestros = useMemo(() => jugadores.filter((f) => f.teamId === CASTILLA_OPTA && (num(f.Min) ?? 0) > 0), [jugadores]);
  const disponibles = useMemo(
    () => Object.keys(jugadores[0] ?? {}).filter((k) => !CLAVES_JUGADOR.has(k) && !["GM", "Min", "Age"].includes(k)),
    [jugadores],
  );

  const valor = (f: Fila, k: string) => (k === "Min" || k === "GM" || k === "Age" ? num(f[k]) : valorJugador(f, k, 1, catalogo));
  const ordenados = [...nuestros].sort((a, b) => {
    const x = valor(a, orden.col);
    const y = valor(b, orden.col);
    if (x == null && y == null) return 0;
    if (x == null) return 1;
    if (y == null) return -1;
    return orden.desc ? y - x : x - y;
  });
  const pulsa = (col: string) =>
    setOrden((o) => (o.col === col ? { col, desc: !o.desc } : { col, desc: defMetrica(col, catalogo).mejor !== false }));

  const jugador = nuestros.find((f) => f.playerId === elegido) ?? null;

  const cabecera = (k: string, texto: string, titulo?: string) => (
    <th key={k} className="py-2 pr-3 text-right font-semibold">
      <button type="button" onClick={() => pulsa(k)} title={titulo} className={`inline-flex items-center gap-0.5 hover:text-white ${orden.col === k ? "text-white" : ""}`}>
        {texto}
        {orden.col === k && (orden.desc ? <ArrowDown size={11} /> : <ArrowUp size={11} />)}
      </button>
    </th>
  );

  return (
    <div className="mt-6 space-y-6">
      <Panel
        titulo="La plantilla por 90′"
        subtitulo="Cifras por 90 minutos (los porcentajes, tal cual). Pulsa un jugador para ver su ficha; pulsa una cabecera para ordenar."
        derecha={
          <>
            <CampoMinimo valor={minimo} alCambiar={setMinimo} />
            <Elegir
              etiqueta="Añadir"
              valor={"" as string}
              alCambiar={(k) => k && !columnas.includes(k) && setColumnas([...columnas, k])}
              opciones={[
                { clave: "", nombre: "Métrica…" },
                ...disponibles
                  .filter((k) => !columnas.includes(k))
                  .sort((a, b) => Number(!METRICAS_OPTA[a]) - Number(!METRICAS_OPTA[b]))
                  .map((k) => ({ clave: k, nombre: nombreMetrica(k, catalogo) })),
              ]}
            />
            {columnas.length > 3 && (
              <button type="button" onClick={() => setColumnas(columnas.slice(0, -1))} className="text-xs text-white/55 hover:text-white">
                Quitar la última
              </button>
            )}
          </>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-[12px] tabular-nums">
            <thead>
              <tr className="border-b border-white/10 text-xs text-white/55">
                <th className="py-2 pr-3 font-semibold">Jugador</th>
                <th className="py-2 pr-3 font-semibold">Puesto</th>
                {cabecera("Age", "Edad")}
                {cabecera("GM", "PJ")}
                {cabecera("Min", "Min")}
                {columnas.map((k) => (
                  cabecera(k, cortoMetrica(k, catalogo), `${nombreMetrica(k, catalogo)}${defMetrica(k, catalogo).tasa ? "" : " por 90"}`)
                ))}
              </tr>
            </thead>
            <tbody>
              {ordenados.map((f) => {
                const min = num(f.Min) ?? 0;
                const activo = f.playerId === elegido;
                return (
                  <tr
                    key={String(f.playerId)}
                    onClick={() => setElegido(activo ? null : String(f.playerId))}
                    className={`cursor-pointer border-b border-white/[0.06] hover:bg-white/[0.04] ${min < minimo ? "opacity-60" : ""}`}
                    style={activo ? { background: "rgba(200, 169, 107, 0.14)" } : undefined}
                  >
                    <td className="py-1.5 pr-3 font-semibold text-white/85">{String(f.jugador ?? "")}</td>
                    <td className="py-1.5 pr-3 text-white/60">{PUESTO_OPTA[String(f.puesto ?? "")] ?? ""}</td>
                    <td className="py-1.5 pr-3 text-right text-white/60">{num(f.Age) ?? ""}</td>
                    <td className="py-1.5 pr-3 text-right text-white/60">{num(f.GM) ?? ""}</td>
                    <td className="py-1.5 pr-3 text-right text-white/80">{min}</td>
                    {columnas.map((k) => (
                      <td key={k} className={`py-1.5 pr-3 text-right ${orden.col === k ? "font-semibold text-white" : "text-white/75"}`}>
                        {fmt(valorJugador(f, k, 1, catalogo), defMetrica(k, catalogo).unidad)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-white/45">Los que están por debajo del mínimo de minutos salen más apagados: su cifra por 90 sale de poco tiempo.</p>
      </Panel>

      {jugador && <FichaJugador key={String(jugador.playerId)} datos={datos} jugador={jugador} minimo={minimo} alCerrar={() => setElegido(null)} />}
    </div>
  );
}
