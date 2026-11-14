"use client";

/**
 * LA LIGA: todos los equipos en una tabla que se ordena por cualquier columna,
 * con las métricas que se quieran (por partido o total), y la dispersión de
 * dos métricas con el Castilla resaltado.
 */

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";

import { Dispersion, ORO, useEscudos } from "@/components/data/graficas";
import { CASTILLA_OPTA, num } from "@/lib/opta";
import { enAmbito, NOMBRE_CASTILLA, nombreEquipo, valorEquipo, type Ambito, type Modo } from "@/lib/opta-analisis";
import { cortoMetrica, defMetrica, METRICAS_OPTA, nombreMetrica } from "@/lib/opta-nombres";

import { Botonera, Elegir, ElegirAmbito, fmt, Panel } from "./comun";
import { Diferenciales } from "./Diferenciales";
import type { DatosOpta } from "./useOpta";

const COLUMNAS_INICIALES = ["P", "GF", "GA", "ExpG", "ExpGAg", "Poss%", "PPDA", "Pass%", "HighTurnovers"];
const NO_METRICA = new Set(["teamId", "equipo", "optaTeamId"]);

export function Liga({ datos }: { datos: DatosOpta }) {
  const { equipos, grupos, catalogo } = datos;
  const escudoDe = useEscudos();
  const [ambito, setAmbito] = useState<Ambito>("grupo");
  const [modo, setModo] = useState<Modo>("partido");
  const [columnas, setColumnas] = useState<string[]>(COLUMNAS_INICIALES);
  const [orden, setOrden] = useState<{ col: string; desc: boolean } | null>(null);
  const [busca, setBusca] = useState("");

  const disponibles = useMemo(() => {
    const cols = Object.keys(equipos[0] ?? {}).filter((k) => !NO_METRICA.has(k));
    return cols;
  }, [equipos]);
  const traducidas = disponibles.filter((k) => METRICAS_OPTA[k]);

  const filas = useMemo(
    () => equipos.filter((f) => enAmbito(f.teamId, grupos, ambito)),
    [equipos, grupos, ambito],
  );

  const colOrden = orden?.col ?? columnas[0] ?? "P";
  /* Sin elegir, el primero es el mejor: en «menos es mejor» eso es el que menos tiene. */
  const desc = orden ? orden.desc : defMetrica(colOrden, catalogo).mejor !== false;
  const ordenadas = useMemo(() => {
    const v = (f: (typeof filas)[number]) => valorEquipo(f, colOrden, modo, catalogo);
    return [...filas].sort((a, b) => {
      const x = v(a);
      const y = v(b);
      if (x == null && y == null) return 0;
      if (x == null) return 1;
      if (y == null) return -1;
      return desc ? y - x : x - y;
    });
  }, [filas, colOrden, desc, modo, catalogo]);

  const pulsaColumna = (col: string) => {
    if (colOrden === col) setOrden({ col, desc: !desc });
    else setOrden({ col, desc: defMetrica(col, catalogo).mejor !== false });
  };

  const anade = (k: string) => {
    if (!k || columnas.includes(k) || !disponibles.includes(k)) return;
    setColumnas([...columnas, k]);
  };

  /* Buscar cualquier métrica de Opta, traducida o no, por su nombre o su abreviatura. */
  const sugerencias = useMemo(() => {
    const t = busca.trim().toLowerCase();
    if (t.length < 2) return [];
    return disponibles
      .filter((k) => !columnas.includes(k))
      .filter((k) => k.toLowerCase().includes(t) || nombreMetrica(k, catalogo).toLowerCase().includes(t))
      .slice(0, 12);
  }, [busca, disponibles, columnas, catalogo]);

  /* Dispersión */
  const [ejeX, setEjeX] = useState("ExpG");
  const [ejeY, setEjeY] = useState("ExpGAg");
  const [comparado, setComparado] = useState("");
  const puntos = filas
    .map((f) => ({ equipo: nombreEquipo(f), x: valorEquipo(f, ejeX, modo, catalogo), y: valorEquipo(f, ejeY, modo, catalogo) }))
    .filter((p): p is { equipo: string; x: number; y: number } => p.x != null && p.y != null);
  const defX = defMetrica(ejeX, catalogo);
  const defY = defMetrica(ejeY, catalogo);
  const sufijo = (k: string) => (modo === "partido" && !defMetrica(k, catalogo).tasa ? " por partido" : "");

  return (
    <div className="mt-6 space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <ElegirAmbito valor={ambito} alCambiar={setAmbito} />
        <Botonera
          etiqueta="Por partido o total"
          valor={modo}
          alCambiar={setModo}
          opciones={[
            { clave: "partido", nombre: "Por partido" },
            { clave: "total", nombre: "Total" },
          ]}
        />
      </div>

      <Panel
        titulo="Todos los equipos"
        subtitulo="Pulsa una cabecera para ordenar por ella; la primera vez, del mejor al peor. Los porcentajes y los cocientes (PPDA, xG por remate) no se dividen por partido."
      >
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {columnas.map((k) => (
            <span key={k} className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] py-0.5 pl-2.5 pr-1 text-xs text-white/80">
              {nombreMetrica(k, catalogo)}
              <button
                type="button"
                onClick={() => setColumnas(columnas.filter((c) => c !== k))}
                className="rounded-full p-0.5 text-white/45 hover:text-white"
                aria-label={`Quitar ${nombreMetrica(k, catalogo)}`}
              >
                <X size={12} />
              </button>
            </span>
          ))}
          <Elegir
            etiqueta="Añadir"
            valor={"" as string}
            alCambiar={anade}
            opciones={[
              { clave: "", nombre: "Métrica traducida…" },
              ...traducidas.filter((k) => !columnas.includes(k)).map((k) => ({ clave: k, nombre: nombreMetrica(k, catalogo) })),
            ]}
          />
          <div className="relative">
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar en las 1.280 de Opta"
              className="w-56 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-white placeholder:text-white/40"
            />
            {sugerencias.length > 0 && (
              <ul className="absolute left-0 top-full z-20 mt-1 max-h-72 w-80 overflow-y-auto rounded-xl border border-white/10 bg-[#11161C] p-1 shadow-xl">
                {sugerencias.map((k) => (
                  <li key={k}>
                    <button
                      type="button"
                      onClick={() => {
                        anade(k);
                        setBusca("");
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-white/80 hover:bg-white/5"
                    >
                      <Plus size={12} className="shrink-0 text-white/45" />
                      <span className="min-w-0 flex-1 truncate">{nombreMetrica(k, catalogo)}</span>
                      <span className="shrink-0 font-mono text-xs text-white/40">{k}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-[12px] tabular-nums">
            <thead>
              <tr className="border-b border-white/10 text-xs text-white/55">
                <th className="w-8 py-2 pr-2 font-semibold">#</th>
                <th className="py-2 pr-3 font-semibold">Equipo</th>
                <th className="py-2 pr-3 text-right font-semibold">PJ</th>
                {columnas.map((k) => {
                  const def = defMetrica(k, catalogo);
                  return (
                    <th key={k} className="py-2 pr-3 text-right font-semibold">
                      <button
                        type="button"
                        onClick={() => pulsaColumna(k)}
                        title={`${nombreMetrica(k, catalogo)}${sufijo(k)}${def.mejor === false ? " · menos es mejor" : def.mejor === null ? " · estilo" : ""}${def.que ? ` · ${def.que}` : ""}`}
                        className={`inline-flex items-center gap-0.5 hover:text-white ${colOrden === k ? "text-white" : ""}`}
                      >
                        {cortoMetrica(k, catalogo)}
                        {colOrden === k && (desc ? <ArrowDown size={11} /> : <ArrowUp size={11} />)}
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {ordenadas.map((f, i) => {
                const nuestro = f.teamId === CASTILLA_OPTA;
                const escudo = escudoDe(nombreEquipo(f)) ?? escudoDe(String(f.equipo ?? ""));
                return (
                  <tr
                    key={String(f.teamId)}
                    className="border-b border-white/[0.06]"
                    style={nuestro ? { background: "rgba(200, 169, 107, 0.14)" } : undefined}
                  >
                    <td className="py-1.5 pr-2 text-white/45">{i + 1}</td>
                    <td className="py-1.5 pr-3">
                      <span className="flex items-center gap-1.5">
                        {escudo ? (
                          // eslint-disable-next-line @next/next/no-img-element -- escudo pequeño por el proxy propio
                          <img src={escudo} alt="" width={16} height={16} className="h-4 w-4 shrink-0 object-contain" />
                        ) : (
                          <span className="h-4 w-4 shrink-0" aria-hidden />
                        )}
                        <span className={nuestro ? "font-semibold" : "text-white/80"} style={nuestro ? { color: ORO } : undefined}>
                          {nombreEquipo(f)}
                        </span>
                        {ambito === "todos" && grupos.size > 0 && (
                          <span className="text-xs text-white/40">{grupos.get(String(f.teamId)) === 1 ? "nuestro grupo" : "otro grupo"}</span>
                        )}
                      </span>
                    </td>
                    <td className="py-1.5 pr-3 text-right text-white/55">{num(f.GM) ?? ""}</td>
                    {columnas.map((k) => (
                      <td key={k} className={`py-1.5 pr-3 text-right ${colOrden === k ? "font-semibold text-white" : "text-white/75"}`}>
                        {fmt(valorEquipo(f, k, modo, catalogo), defMetrica(k, catalogo).unidad)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel
        titulo="Dos métricas a la vez"
        subtitulo="Un punto por equipo; las rayas son las medianas y parten el dibujo en cuatro."
        derecha={
          <>
            <Elegir
              etiqueta="Horizontal"
              valor={ejeX}
              alCambiar={setEjeX}
              opciones={traducidas.map((k) => ({ clave: k, nombre: nombreMetrica(k, catalogo) }))}
            />
            <Elegir
              etiqueta="Vertical"
              valor={ejeY}
              alCambiar={setEjeY}
              opciones={traducidas.map((k) => ({ clave: k, nombre: nombreMetrica(k, catalogo) }))}
            />
            <Elegir
              etiqueta="Comparar con"
              valor={comparado}
              alCambiar={setComparado}
              opciones={[
                { clave: "", nombre: "Ninguno" },
                ...filas
                  .filter((f) => f.teamId !== CASTILLA_OPTA)
                  .map((f) => nombreEquipo(f))
                  .sort((a, b) => a.localeCompare(b, "es"))
                  .map((n) => ({ clave: n, nombre: n })),
              ]}
            />
          </>
        }
      >
        {puntos.length > 2 && (
          <Dispersion
            puntos={puntos}
            etiquetaX={`${defX.nombre}${sufijo(ejeX)}`}
            etiquetaY={`${defY.nombre}${sufijo(ejeY)}`}
            unidadX={defX.unidad}
            unidadY={defY.unidad}
            destacado={NOMBRE_CASTILLA}
            comparado={comparado || undefined}
            medianasDe={ambito === "todos" ? "de la categoría" : "del grupo"}
          />
        )}
        {(defX.mejor === false || defY.mejor === false) && (
          <p className="mt-1 text-xs text-white/45">
            {[defX.mejor === false ? defX.nombre : "", defY.mejor === false ? defY.nombre : ""].filter(Boolean).join(" y ")}: menos es mejor.
          </p>
        )}
      </Panel>

      <Diferenciales datos={datos} />
    </div>
  );
}
