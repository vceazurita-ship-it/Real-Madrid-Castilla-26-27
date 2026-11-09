"use client";

/**
 * EL BUSCADOR DE LA CATEGORÍA, para el scouting: por puesto, edad, minutos y
 * una métrica por 90, con el percentil de cada uno entre los de su puesto.
 */

import { useMemo, useState } from "react";

import { colorPercentil } from "@/components/data/graficas";
import { CASTILLA_OPTA, num, PUESTO_OPTA } from "@/lib/opta";
import { CLAVES_JUGADOR, enAmbito, familiaDe, percentilesPorFamilia, valorJugador, type Ambito } from "@/lib/opta-analisis";
import { defMetrica, FAMILIAS, METRICAS_OPTA, nombreMetrica } from "@/lib/opta-nombres";

import { Elegir, ElegirAmbito, fmt, Panel } from "./comun";
import { Dependencia } from "./Dependencia";
import { FichaJugador } from "./FichaJugador";
import { CampoMinimo } from "./Jugadores";
import type { DatosOpta } from "./useOpta";

const TOPE = 60;

function CampoEdad({ rotulo, valor, alCambiar }: { rotulo: string; valor: number; alCambiar: (n: number) => void }) {
  return (
    <label className="inline-flex items-center gap-2 text-xs text-white/55">
      {rotulo}
      <input
        type="number"
        min={15}
        max={45}
        value={valor}
        onChange={(e) => alCambiar(Number(e.target.value) || 0)}
        className="w-16 rounded-xl border border-white/10 bg-white/[0.04] px-2 py-1.5 text-sm text-white"
      />
    </label>
  );
}

export function Buscador({ datos, minimo, setMinimo }: { datos: DatosOpta; minimo: number; setMinimo: (n: number) => void }) {
  const { jugadores, grupos, catalogo } = datos;
  const [familia, setFamilia] = useState<string>("Delanteros");
  const [edadMin, setEdadMin] = useState(16);
  const [edadMax, setEdadMax] = useState(23);
  const [ambito, setAmbito] = useState<Ambito>("todos");
  const [sinCastilla, setSinCastilla] = useState(true);
  const [metrica, setMetrica] = useState("ExpG");
  const [elegido, setElegido] = useState<string | null>(null);

  const metricas = useMemo(
    () =>
      Object.keys(jugadores[0] ?? {})
        .filter((k) => !CLAVES_JUGADOR.has(k) && !["GM", "Min", "Age"].includes(k))
        .sort((a, b) => Number(!METRICAS_OPTA[a]) - Number(!METRICAS_OPTA[b]) || nombreMetrica(a, catalogo).localeCompare(nombreMetrica(b, catalogo), "es")),
    [jugadores, catalogo],
  );
  const def = defMetrica(metrica, catalogo);

  /* El percentil de cada uno sale de TODOS los de su puesto con el mínimo, no sólo de los filtrados. */
  const percentiles = useMemo(
    () => percentilesPorFamilia(jugadores, metrica, minimo, def.mejor, catalogo),
    [jugadores, metrica, minimo, def.mejor, catalogo],
  );

  const resultado = useMemo(() => {
    const filas = jugadores.filter((f) => {
      const edad = num(f.Age);
      if ((num(f.Min) ?? 0) < minimo) return false;
      if (familia && familiaDe(f) !== familia) return false;
      if (edad != null && (edad < edadMin || edad > edadMax)) return false;
      if (sinCastilla && f.teamId === CASTILLA_OPTA) return false;
      return enAmbito(f.teamId, grupos, ambito);
    });
    const v = (f: (typeof filas)[number]) => valorJugador(f, metrica, minimo, catalogo);
    return filas
      .filter((f) => v(f) != null)
      .sort((a, b) => (def.mejor === false ? v(a)! - v(b)! : v(b)! - v(a)!));
  }, [jugadores, minimo, familia, edadMin, edadMax, sinCastilla, grupos, ambito, metrica, def.mejor, catalogo]);

  const jugador = jugadores.find((f) => f.playerId === elegido) ?? null;

  return (
    <div className="mt-6 space-y-6">
      <Panel
        titulo="Buscar en la categoría"
        subtitulo="Ordenados por la métrica elegida, del mejor al peor. El percentil es contra todos los de su puesto con el mínimo de minutos. Pulsa uno para ver su ficha."
      >
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Elegir
            etiqueta="Puesto"
            valor={familia}
            alCambiar={setFamilia}
            opciones={[{ clave: "", nombre: "Todos" }, ...FAMILIAS.map((f) => ({ clave: f, nombre: f }))]}
          />
          <CampoEdad rotulo="Edad de" valor={edadMin} alCambiar={setEdadMin} />
          <CampoEdad rotulo="a" valor={edadMax} alCambiar={setEdadMax} />
          <CampoMinimo valor={minimo} alCambiar={setMinimo} />
          <Elegir
            etiqueta="Métrica"
            valor={metrica}
            alCambiar={setMetrica}
            opciones={metricas.map((k) => ({ clave: k, nombre: nombreMetrica(k, catalogo) + (defMetrica(k, catalogo).tasa ? "" : " por 90") }))}
          />
          <ElegirAmbito valor={ambito} alCambiar={setAmbito} />
          <label className="inline-flex items-center gap-2 text-xs text-white/55">
            <input type="checkbox" checked={sinCastilla} onChange={(e) => setSinCastilla(e.target.checked)} />
            Sin los del Castilla
          </label>
        </div>

        {resultado.length === 0 ? (
          <p className="text-sm text-white/55">Ningún jugador cumple todos los filtros. Prueba a bajar el mínimo de minutos o a abrir la edad.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-[12px] tabular-nums">
              <thead>
                <tr className="border-b border-white/10 text-[11px] text-white/55">
                  <th className="w-8 py-2 pr-2 font-semibold">#</th>
                  <th className="py-2 pr-3 font-semibold">Jugador</th>
                  <th className="py-2 pr-3 font-semibold">Equipo</th>
                  <th className="py-2 pr-3 font-semibold">Puesto</th>
                  <th className="py-2 pr-3 text-right font-semibold">Edad</th>
                  <th className="py-2 pr-3 text-right font-semibold">Min</th>
                  <th className="py-2 pr-3 text-right font-semibold" title={def.que}>
                    {def.nombre}
                    {def.tasa ? "" : " /90"}
                  </th>
                  <th className="py-2 pr-3 text-right font-semibold" title="Percentil entre los de su puesto">
                    Pct.
                  </th>
                </tr>
              </thead>
              <tbody>
                {resultado.slice(0, TOPE).map((f, i) => {
                  const p = percentiles.get(String(f.playerId)) ?? null;
                  const activo = f.playerId === elegido;
                  return (
                    <tr
                      key={String(f.playerId)}
                      onClick={() => setElegido(activo ? null : String(f.playerId))}
                      className="cursor-pointer border-b border-white/[0.06] hover:bg-white/[0.04]"
                      style={activo ? { background: "rgba(200, 169, 107, 0.14)" } : undefined}
                    >
                      <td className="py-1.5 pr-2 text-white/45">{i + 1}</td>
                      <td className="py-1.5 pr-3 font-semibold text-white/85">{String(f.jugador ?? "")}</td>
                      <td className="py-1.5 pr-3 text-white/65">
                        {String(f.equipo ?? "")}
                        {grupos.size > 0 && ambito === "todos" && grupos.get(String(f.teamId)) === 1 && (
                          <span className="ml-1.5 text-[10px] text-white/40">nuestro grupo</span>
                        )}
                      </td>
                      <td className="py-1.5 pr-3 text-white/60">{PUESTO_OPTA[String(f.puesto ?? "")] ?? ""}</td>
                      <td className="py-1.5 pr-3 text-right text-white/65">{num(f.Age) ?? ""}</td>
                      <td className="py-1.5 pr-3 text-right text-white/65">{num(f.Min) ?? ""}</td>
                      <td className="py-1.5 pr-3 text-right font-semibold text-white">{fmt(valorJugador(f, metrica, minimo, catalogo), def.unidad)}</td>
                      <td className="py-1.5 pr-3 text-right font-semibold" style={{ color: def.mejor === null ? undefined : colorPercentil(p) }}>
                        {p != null ? `P${p}` : ""}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {resultado.length > TOPE && (
              <p className="mt-2 text-[11px] text-white/45">
                Se enseñan los {TOPE} primeros de {resultado.length}. Afina el puesto, la edad o los minutos para ver el resto.
              </p>
            )}
          </div>
        )}
      </Panel>

      <Dependencia datos={datos} elegirEquipo />

      {jugador && <FichaJugador key={String(jugador.playerId)} datos={datos} jugador={jugador} minimo={minimo} alCerrar={() => setElegido(null)} />}
    </div>
  );
}
