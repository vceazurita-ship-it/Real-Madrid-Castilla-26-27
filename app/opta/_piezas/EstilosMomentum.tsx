"use client";

/**
 * MOMENTUM DE TODA LA LIGA (pestaña «Estilos», 10/11/2026): una fila por
 * equipo con el tanto por ciento de minutos en que aprieta (en total y por
 * franjas de 15′) y sus goles marcados y encajados según quién apretaba en
 * los 5′ anteriores. Mapa de calor por percentil dentro de los equipos que se
 * ven. Las cuentas, en `momentumLiga` (`lib/opta-estilos.ts`).
 */

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";

import { ORO, useEscudos } from "@/components/data/graficas";
import { CASTILLA_OPTA, percentil } from "@/lib/opta";
import { enAmbito, type Ambito } from "@/lib/opta-analisis";
import { FRANJAS, momentumLiga, UMBRAL_DOMINIO, type FilaMomentum } from "@/lib/opta-estilos";

import { ElegirAmbito, Panel } from "./comun";
import { pct, useMomento, useRemates } from "./eventos";
import type { DatosOpta } from "./useOpta";

/** Rojo → ámbar → verde según el percentil; translúcido para que valga en día y en noche. */
export const colorCalor = (p: number | null) => {
  if (p == null) return undefined;
  const tono = p < 50 ? 4 + (40 - 4) * (p / 50) : 40 + (135 - 40) * ((p - 50) / 50);
  return `hsl(${tono.toFixed(0)} 78% 48% / 0.34)`;
};

export function LeyendaCalor() {
  return (
    <span className="inline-flex flex-wrap items-center gap-2 text-[11px] text-white/55">
      <span className="font-semibold uppercase tracking-[0.14em] text-white/40">Color</span>
      <span>peor</span>
      <span
        aria-hidden
        className="inline-block h-2.5 w-28 rounded-full"
        style={{ background: `linear-gradient(90deg, ${colorCalor(0)}, ${colorCalor(50)}, ${colorCalor(100)})` }}
      />
      <span>mejor, por percentil entre los equipos que se ven</span>
    </span>
  );
}

type Col = {
  clave: string;
  corto: string;
  titulo: string;
  valor: (f: FilaMomentum) => number | null;
  /** Menos es mejor: el color se da la vuelta. */
  inverso?: boolean;
  formato: "pct" | "n";
};

const COLUMNAS: Col[] = [
  { clave: "dominio", corto: "Dominio", titulo: "Dominio total: parte de los minutos en que el equipo es el que aprieta", valor: (f) => f.dominio, formato: "pct" },
  ...FRANJAS.map(
    (fr, i): Col => ({
      clave: fr.clave,
      corto: `${fr.nombre}′`,
      titulo: `Dominio entre el ${fr.nombre}′`,
      valor: (f) => f.franjas[i] ?? null,
      formato: "pct",
    }),
  ),
  { clave: "golesApretando", corto: "GF apret.", titulo: "Goles marcados apretando: dominaba en los 5′ antes del gol", valor: (f) => f.golesApretando, formato: "n" },
  { clave: "golesContrapie", corto: "GF contrapié", titulo: "Goles marcados a contrapié: apretaba el rival en los 5′ antes del gol", valor: (f) => f.golesContrapie, formato: "n" },
  { clave: "encajadosApretandoEl", corto: "GC apret. él", titulo: "Goles encajados cuando apretaba él", valor: (f) => f.encajadosApretandoEl, inverso: true, formato: "n" },
  { clave: "encajadosApretandoRival", corto: "GC apret. rival", titulo: "Goles encajados cuando apretaba el rival", valor: (f) => f.encajadosApretandoRival, inverso: true, formato: "n" },
];

export function MomentumLiga({ datos }: { datos: DatosOpta }) {
  const { momento, cargando: cargaMomento } = useMomento();
  const { remates, cargando: cargaRemates } = useRemates(datos);
  const escudoDe = useEscudos();
  const [ambito, setAmbito] = useState<Ambito>("todos");
  const [orden, setOrden] = useState<{ col: string; desc: boolean }>({ col: "dominio", desc: true });

  const todas = useMemo(() => momentumLiga(momento, remates), [momento, remates]);
  const filas = useMemo(() => todas.filter((f) => enAmbito(f.teamId, datos.grupos, ambito)), [todas, datos.grupos, ambito]);

  /* El percentil de cada celda, contra los equipos que se ven. */
  const percentiles = useMemo(() => {
    const m = new Map<string, Map<string, number | null>>();
    for (const c of COLUMNAS) {
      const xs = filas.map(c.valor);
      m.set(c.clave, new Map(filas.map((f) => [f.teamId, percentil(c.valor(f), xs, c.inverso)])));
    }
    return m;
  }, [filas]);

  const ordenadas = useMemo(() => {
    const col = COLUMNAS.find((c) => c.clave === orden.col);
    return [...filas].sort((a, b) => {
      if (orden.col === "equipo") return orden.desc ? b.equipo.localeCompare(a.equipo, "es") : a.equipo.localeCompare(b.equipo, "es");
      const x = col ? col.valor(a) : a.partidos;
      const y = col ? col.valor(b) : b.partidos;
      if (x == null && y == null) return 0;
      if (x == null) return 1;
      if (y == null) return -1;
      return orden.desc ? y - x : x - y;
    });
  }, [filas, orden]);

  const pulsa = (col: string) =>
    setOrden((o) => (o.col === col ? { col, desc: !o.desc } : { col, desc: col !== "equipo" && !COLUMNAS.find((c) => c.clave === col)?.inverso }));

  const flecha = (col: string) => (orden.col === col ? orden.desc ? <ArrowDown size={11} /> : <ArrowUp size={11} /> : null);
  const cabecera = (clave: string, corto: string, titulo: string, derecha = true) => (
    <th key={clave} className={`whitespace-nowrap py-2 pr-2 font-semibold ${derecha ? "text-right" : ""}`}>
      <button type="button" onClick={() => pulsa(clave)} title={titulo} className={`inline-flex items-center gap-0.5 hover:text-white ${orden.col === clave ? "text-white" : ""}`}>
        {corto}
        {flecha(clave)}
      </button>
    </th>
  );

  const cargando = cargaMomento || cargaRemates;

  return (
    <Panel
      titulo="Quién aprieta y cuándo"
      subtitulo="Por equipo, la parte de los minutos de la temporada en que es él quien manda, por franjas de 15′, y sus goles según quién apretaba antes."
      derecha={<ElegirAmbito valor={ambito} alCambiar={setAmbito} />}
    >
      {cargando ? (
        <div className="h-64 animate-pulse rounded-2xl bg-white/[0.05]" role="status" aria-label="Cargando el momentum de la liga" />
      ) : filas.length === 0 ? null : (
        <>
          <div className="mb-3">
            <LeyendaCalor />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-[12px] tabular-nums">
              <thead>
                <tr className="border-b border-white/10 text-[11px] text-white/55">
                  <th className="w-8 py-2 pr-2 font-semibold">#</th>
                  {cabecera("equipo", "Equipo", "Ordenar por nombre", false)}
                  {cabecera("partidos", "PJ", "Partidos con momentum")}
                  {COLUMNAS.slice(0, 1 + FRANJAS.length).map((c) => cabecera(c.clave, c.corto, c.titulo))}
                  <th className="whitespace-nowrap py-2 pr-2 text-left font-semibold" title="La franja en que más aprieta y en la que menos">
                    Fuerte · flojo
                  </th>
                  {COLUMNAS.slice(1 + FRANJAS.length).map((c) => cabecera(c.clave, c.corto, c.titulo))}
                </tr>
              </thead>
              <tbody>
                {ordenadas.map((f, i) => {
                  const nuestro = f.teamId === CASTILLA_OPTA;
                  const escudo = escudoDe(f.equipo);
                  const celda = (c: Col) => {
                    const v = c.valor(f);
                    return (
                      <td
                        key={c.clave}
                        className={`px-1.5 py-1.5 text-right ${orden.col === c.clave ? "font-semibold text-white" : "text-white/85"} ${c.clave === "dominio" ? "font-semibold" : ""}`}
                        style={{ background: colorCalor(percentiles.get(c.clave)?.get(f.teamId) ?? null) }}
                      >
                        {v == null ? "" : c.formato === "pct" ? pct(v) : v}
                      </td>
                    );
                  };
                  return (
                    <tr key={f.teamId} className="border-b border-white/[0.06]" style={nuestro ? { background: "rgba(200, 169, 107, 0.14)", outline: `1.5px solid ${ORO}`, outlineOffset: -1 } : undefined}>
                      <td className="py-1.5 pr-2 text-white/45">{i + 1}</td>
                      <td className="whitespace-nowrap py-1.5 pr-3">
                        <span className="flex items-center gap-1.5">
                          {escudo ? (
                            // eslint-disable-next-line @next/next/no-img-element -- escudo pequeño por el proxy propio
                            <img src={escudo} alt="" width={16} height={16} className="h-4 w-4 shrink-0 object-contain" />
                          ) : (
                            <span className="h-4 w-4 shrink-0" aria-hidden />
                          )}
                          <span className={nuestro ? "font-semibold" : "text-white/80"} style={nuestro ? { color: ORO } : undefined}>
                            {f.equipo}
                          </span>
                        </span>
                      </td>
                      <td className="py-1.5 pr-2 text-right text-white/55">{f.partidos}</td>
                      {COLUMNAS.slice(0, 1 + FRANJAS.length).map(celda)}
                      <td className="whitespace-nowrap px-2 py-1.5 text-white/70">
                        {[f.fuerte, f.flojo].every((x) => x != null) ? `${FRANJAS[f.fuerte!].nombre}′ · ${FRANJAS[f.flojo!].nombre}′` : ""}
                      </td>
                      {COLUMNAS.slice(1 + FRANJAS.length).map(celda)}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-white/50">
            Cómo se cuenta: cada tramo de 5′ es la curva de momentum de la pestaña «Partidos» (xG y toques en el área de los dos, suavizada con los
            tramos de al lado); aprieta el que la tiene a su favor por más de {UMBRAL_DOMINIO.toFixed(2).replace(".", ",")} en una escala de −1 a 1. En
            los tramos igualados no aprieta nadie, así que lo de los dos no suma 100 %. Cada gol se mira con los 5′ anteriores sin contar el propio
            remate; los autogoles no entran. Opta lleva el reloj de corrido: el descuento de la primera parte cae en la franja 46-60 y el de la
            segunda, en la 76-90+. En «GC», menos es mejor y el color se da la vuelta.
          </p>
        </>
      )}
    </Panel>
  );
}
