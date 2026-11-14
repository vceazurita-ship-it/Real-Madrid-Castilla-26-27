"use client";

/**
 * EL CASTILLA COLECTIVO: cada fase con su valor por partido, su puesto y su
 * percentil frente al grupo (o la categoría), y la evolución partido a partido
 * de la métrica que se elija contra la media del grupo.
 */

import { useMemo, useState } from "react";

import { BarraPercentil, Evolucion, LeyendaPercentil, MEJOR, PEOR, type FilaPercentil } from "@/components/data/graficas";
import { CASTILLA_OPTA, num } from "@/lib/opta";
import {
  clasificacion,
  enAmbito,
  fechaCorta,
  partidosDe,
  posicionEn,
  valorEquipo,
  valorPartido,
  type Ambito,
} from "@/lib/opta-analisis";
import { defMetrica, FASES_EQUIPO, METRICAS_OPTA, nombreMetrica } from "@/lib/opta-nombres";

import { Cifra, Elegir, ElegirAmbito, fmt, Panel } from "./comun";
import { Dependencia } from "./Dependencia";
import { FichaPartido } from "./FichaPartido";
import { RematesEquipo } from "./Remates";
import type { DatosOpta } from "./useOpta";

const NO_METRICA = new Set(["partido", "fecha", "teamId", "equipo"]);

export function Colectivo({ datos }: { datos: DatosOpta }) {
  const { equipos, partidos, grupos, catalogo } = datos;
  const [ambito, setAmbito] = useState<Ambito>("grupo");

  const castilla = equipos.find((f) => f.teamId === CASTILLA_OPTA) ?? null;
  const muestra = useMemo(
    () => equipos.filter((f) => f.teamId === CASTILLA_OPTA || enAmbito(f.teamId, grupos, ambito)),
    [equipos, grupos, ambito],
  );

  /* La clasificación siempre es la del grupo: es la tabla que se juega. */
  const delGrupo = useMemo(() => clasificacion(equipos.filter((f) => enAmbito(f.teamId, grupos, "grupo"))), [equipos, grupos]);
  const puestoTabla = delGrupo.findIndex((f) => f.teamId === CASTILLA_OPTA) + 1;

  const filaDe = (a: string): FilaPercentil | null => {
    if (!castilla) return null;
    const def = defMetrica(a, catalogo);
    const valor = valorEquipo(castilla, a, "partido", catalogo);
    if (valor == null) return null;
    const pos = posicionEn(
      valor,
      muestra.map((f) => valorEquipo(f, a, "partido", catalogo)),
      def.mejor,
    );
    return {
      key: a,
      nombre: def.nombre + (def.tasa ? "" : " por partido"),
      unidad: def.unidad,
      mejorAlto: def.mejor,
      valor,
      mediana: pos.mediana,
      percentil: pos.percentil,
      puesto: pos.puesto,
      deCuantos: pos.deCuantos,
      comoLeer: def.que ? `${def.que}.` : "",
    };
  };

  /* La evolución: sólo las métricas que trae la tabla de partidos y están traducidas. */
  const columnasPartido = useMemo(() => {
    const cols = new Set<string>();
    for (const f of partidos.slice(0, 2)) for (const k of Object.keys(f)) if (!NO_METRICA.has(k)) cols.add(k);
    return [...cols].filter((k) => METRICAS_OPTA[k]);
  }, [partidos]);
  const [metricaEvo, setMetricaEvo] = useState("ExpG");
  const evo = columnasPartido.includes(metricaEvo) ? metricaEvo : columnasPartido[0] ?? "";

  const nuestros = useMemo(() => partidosDe(partidos, CASTILLA_OPTA), [partidos]);
  const serie = nuestros.map((p) => ({
    etiqueta: p.rival || fechaCorta(p.fecha),
    valor: valorPartido(p.fila, evo, catalogo),
    nota: [fechaCorta(p.fecha), p.rival, p.gf != null && p.gc != null ? `${p.gf}-${p.gc}` : ""].filter(Boolean).join(" · "),
  }));
  const valoresGrupo = partidos
    .filter((f) => f.teamId === CASTILLA_OPTA || enAmbito(f.teamId, grupos, ambito))
    .map((f) => valorPartido(f, evo, catalogo))
    .filter((v): v is number => v != null);
  const mediaGrupo = valoresGrupo.length ? valoresGrupo.reduce((s, x) => s + x, 0) / valoresGrupo.length : null;
  const nuestrosVals = serie.map((s) => s.valor).filter((v): v is number => v != null);
  const mediaNuestra = nuestrosVals.length ? nuestrosVals.reduce((s, x) => s + x, 0) / nuestrosVals.length : null;
  const defEvo = defMetrica(evo, catalogo);

  if (!castilla) {
    return <p className="mt-6 text-sm text-white/55">El Castilla todavía no aparece en la descarga de Opta.</p>;
  }

  const gm = num(castilla.GM) ?? 0;
  const xg = valorEquipo(castilla, "ExpG", "partido");
  const xgc = valorEquipo(castilla, "ExpGAg", "partido");
  const quienAmbito = ambito === "grupo" ? "su grupo" : ambito === "otro" ? "el otro grupo" : "toda la categoría";

  return (
    <div className="mt-6 space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <ElegirAmbito valor={ambito} alCambiar={setAmbito} />
        <LeyendaPercentil poblacion={quienAmbito} />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {num(castilla.P) != null && (
          <Cifra
            rotulo="Puntos"
            valor={String(num(castilla.P))}
            detalle={[puestoTabla > 0 ? `${puestoTabla}º de ${delGrupo.length} en el grupo` : "", `${num(castilla.W) ?? 0}G ${num(castilla.D) ?? 0}E ${num(castilla.L) ?? 0}P`].filter(Boolean).join(" · ")}
          />
        )}
        {num(castilla.GF) != null && (
          <Cifra rotulo="Goles" valor={`${num(castilla.GF)} - ${num(castilla.GA) ?? 0}`} detalle={gm ? `en ${gm} partidos` : undefined} />
        )}
        {xg != null && xgc != null && (
          <Cifra
            rotulo="xG por partido"
            valor={`${fmt(xg, "decimal")} - ${fmt(xgc, "decimal")}`}
            detalle={`Diferencia ${xg - xgc >= 0 ? "+" : ""}${fmt(xg - xgc, "decimal")}`}
            color={xg - xgc >= 0 ? MEJOR : PEOR}
          />
        )}
        {valorEquipo(castilla, "Poss%", "partido") != null && (
          <Cifra
            rotulo="Posesión"
            valor={fmt(valorEquipo(castilla, "Poss%", "partido"), "porcentaje")}
            detalle={valorEquipo(castilla, "PPDA", "partido") != null ? `PPDA ${fmt(valorEquipo(castilla, "PPDA", "partido"), "decimal")}` : undefined}
          />
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {FASES_EQUIPO.map((fase) => {
          const filas = fase.metricas.map(filaDe).filter((f): f is FilaPercentil => f !== null);
          if (!filas.length) return null;
          const conP = filas.filter((f) => f.percentil != null && f.mejorAlto !== null);
          const mediaP = conP.length ? Math.round(conP.reduce((s, f) => s + (f.percentil ?? 0), 0) / conP.length) : null;
          return (
            <Panel
              key={fase.clave}
              titulo={fase.titulo}
              subtitulo={fase.pregunta}
              derecha={
                mediaP != null ? (
                  <span className="text-xs text-white/55" title="Media de los percentiles de las métricas de rendimiento de esta fase">
                    Media P{mediaP}
                  </span>
                ) : undefined
              }
            >
              {filas.map((f) => (
                <BarraPercentil key={f.key} fila={f} />
              ))}
            </Panel>
          );
        })}
      </div>

      {evo && (
        <Panel
          titulo="Partido a partido"
          subtitulo={
            mediaGrupo != null
              ? `La raya es la media por partido de ${quienAmbito} (${fmt(mediaGrupo, defEvo.unidad)})${mediaNuestra != null ? `; la del Castilla, ${fmt(mediaNuestra, defEvo.unidad)}` : ""}.`
              : undefined
          }
          derecha={
            <Elegir
              etiqueta="Métrica"
              valor={evo}
              alCambiar={setMetricaEvo}
              opciones={columnasPartido.map((k) => ({ clave: k, nombre: nombreMetrica(k, catalogo) }))}
            />
          }
        >
          <Evolucion serie={serie} unidad={defEvo.unidad} media={mediaGrupo} />
          {defEvo.mejor === false && <p className="mt-1 text-xs text-white/45">En esta métrica, menos es mejor.</p>}
        </Panel>
      )}

      <FichaPartido datos={datos} />

      <RematesEquipo datos={datos} teamId={CASTILLA_OPTA} titulo="Los remates del Castilla, uno a uno" />

      <Dependencia datos={datos} teamId={CASTILLA_OPTA} />
    </div>
  );
}
