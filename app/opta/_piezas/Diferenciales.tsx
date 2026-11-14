"use client";

/**
 * DIFERENCIALES: la clasificación por «lo mío menos lo del rival» por
 * partido. Barras divergentes desde el cero: verde a favor, naranja en contra
 * (el par validado de la plataforma, que también distingue un daltónico), y
 * el Castilla en oro de rótulo.
 */

import { useMemo, useState } from "react";

import { MEJOR, ORO, PEOR, tinta } from "@/components/data/graficas";
import { CASTILLA_OPTA } from "@/lib/opta";
import { diferenciales, enAmbito, type Ambito } from "@/lib/opta-analisis";
import { defMetrica, nombreMetrica } from "@/lib/opta-nombres";

import { Elegir, ElegirAmbito, fmt, Panel } from "./comun";
import type { DatosOpta } from "./useOpta";

const CANDIDATAS = [
  "ShtIncBl",
  "ExpG",
  "SOG",
  "Goal",
  "TouchOpBox",
  "Chance",
  "KeyPass",
  "CrnrWon",
  "PosWonA3rd",
  "Recovery",
  "PossLost",
  "SeqEndInA3",
  "Seq9+Pass",
  "PsAtt",
  "Ps%InA3rd",
  "Crosses",
  "ThrghBalls",
  "Duel%",
  "Aerial%",
];

export function Diferenciales({ datos }: { datos: DatosOpta }) {
  const { partidos, grupos, catalogo } = datos;
  const [ambito, setAmbito] = useState<Ambito>("grupo");
  const columnas = useMemo(() => new Set(Object.keys(partidos[0] ?? {})), [partidos]);
  const opciones = CANDIDATAS.filter((k) => columnas.has(k));
  const [metrica, setMetrica] = useState("ShtIncBl");
  const m = opciones.includes(metrica) ? metrica : opciones[0] ?? "";
  const def = defMetrica(m, catalogo);
  /* En las de «menos es mejor» (pérdidas), tener más que el rival es ir en contra. */
  const signo = def.mejor === false ? -1 : 1;

  /* 440 filas: se rehace en cada pintado sin coste que se note. */
  const filas = diferenciales(partidos, m, catalogo)
    .filter((d) => d.teamId === CASTILLA_OPTA || enAmbito(d.teamId, grupos, ambito))
    .sort((a, b) => signo * (b.dif - a.dif));
  const tope = Math.max(...filas.map((f) => Math.abs(f.dif)), 0.0001);

  if (!m) return null;

  return (
    <Panel
      titulo="Diferenciales"
      subtitulo={`${def.nombre}: lo de cada equipo menos lo de su rival, de media por partido. A la derecha, a favor.`}
      derecha={
        <>
          <Elegir etiqueta="Métrica" valor={m} alCambiar={setMetrica} opciones={opciones.map((k) => ({ clave: k, nombre: nombreMetrica(k, catalogo) }))} />
          <ElegirAmbito valor={ambito} alCambiar={setAmbito} />
        </>
      }
    >
      <div className="space-y-0.5">
        {filas.map((f, i) => {
          const nuestro = f.teamId === CASTILLA_OPTA;
          const bueno = signo * f.dif >= 0;
          const ancho = (Math.abs(f.dif) / tope) * 50;
          const unidad = def.unidad === "entero" ? "decimal" : def.unidad;
          return (
            <div
              key={f.teamId}
              className="flex min-w-0 items-center gap-2 rounded-lg px-1 py-0.5 text-[12px]"
              style={nuestro ? { background: "rgba(200, 169, 107, 0.14)" } : undefined}
              title={`${f.equipo}: ${fmt(f.propio / f.partidos, unidad)} por partido contra ${fmt(f.rival / f.partidos, unidad)} de sus rivales (${f.partidos} partidos)`}
            >
              <span className="w-5 shrink-0 text-right text-xs tabular-nums text-white/40">{i + 1}</span>
              <span className={`w-36 shrink-0 truncate sm:w-44 ${nuestro ? "font-semibold" : "text-white/70"}`} style={nuestro ? { color: ORO } : undefined}>
                {f.equipo}
              </span>
              <span className="relative h-3 min-w-0 flex-1">
                <span className="absolute inset-y-[-2px] w-px" style={{ left: "50%", background: tinta(0.3) }} aria-hidden />
                <span
                  className="absolute inset-y-0 rounded-[3px]"
                  style={{
                    left: signo * f.dif >= 0 ? "50%" : `${50 - ancho}%`,
                    width: `${Math.max(ancho, 0.5)}%`,
                    background: bueno ? MEJOR : PEOR,
                    boxShadow: nuestro ? `inset 0 0 0 1.5px #C8A96B` : undefined,
                  }}
                />
              </span>
              <span className={`w-16 shrink-0 text-right tabular-nums ${nuestro ? "font-semibold text-white" : "text-white/70"}`}>
                {f.dif > 0 ? "+" : ""}
                {fmt(f.dif, unidad)}
              </span>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-white/45">
        {def.mejor === false ? "En esta métrica, menos es mejor: tener más que el rival cuenta en contra y va a la izquierda en naranja. " : ""}
        {def.unidad === "porcentaje" ? "En los porcentajes, la diferencia es en puntos. " : ""}
        Pasa por una barra para ver lo propio y lo de sus rivales por partido.
      </p>
    </Panel>
  );
}
