"use client";

/*
| LABORATORIO DE ABP · OPTA, EL BALÓN PARADO DE LA CATEGORÍA (09/11/2026)
|
| El Castilla frente a su grupo y a toda Primera RFEF en córners, faltas,
| saques de banda y penaltis, con lo que Opta trae de cada equipo
| (`opta:equipos`). En cada métrica: su valor, su puesto y su percentil en el
| grupo y en la categoría, y los cinco mejores de la categoría como
| referencia. El grupo se deduce de `opta:partidos` (ver lib/opta-abp.ts).
|
| Los porcentajes de pocos intentos (menos de 10) se enseñan como tendencia:
| sin color ni percentil.
*/

import { useEffect, useMemo, useState } from "react";
import { Database, Trophy } from "lucide-react";

import { Panel, Segmented } from "@/components/abp/ui";
import { CASTILLA_OPTA, DOCS_OPTA, aObjetos, percentil, traeOpta, type TablaOpta } from "@/lib/opta";
import { METRICAS_ABP_OPTA, SECCIONES_ABP, gruposDePartidos, textoAbp, valorAbp, type FilaEquipoOpta, type MetricaAbpOpta, type SeccionAbp } from "@/lib/opta-abp";

const CASOS_MIN = 10;

const VERDE = "#1B9E77";
const ORO = "#D8B45A";
const ROJO = "#E5484D";
const colorDe = (p: number) => (p >= 60 ? VERDE : p > 40 ? ORO : ROJO);

type Posicion = { puesto: number; de: number; p: number | null; mediana: number | null };

function medianaDe(xs: number[]) {
  if (!xs.length) return null;
  const o = [...xs].sort((a, b) => a - b);
  const k = Math.floor(o.length / 2);
  return o.length % 2 ? o[k] : (o[k - 1] + o[k]) / 2;
}

function posicion(m: MetricaAbpOpta, valor: number, muestra: number[]): Posicion {
  /* En las de estilo se ordena del que más tiene al que menos. */
  const masEsMejor = m.mejorAlto !== false;
  const mejores = muestra.filter((v) => (masEsMejor ? v > valor : v < valor)).length;
  return {
    puesto: mejores + 1,
    de: muestra.length,
    p: percentil(valor, muestra, m.mejorAlto === false),
    mediana: medianaDe(muestra),
  };
}

type Fila = {
  m: MetricaAbpOpta;
  valor: number;
  casos: number | null;
  pocos: boolean;
  grupo: Posicion;
  categoria: Posicion;
  top: { equipo: string; valor: number; nuestro: boolean }[];
};

function Pista({ pos, pocos, estilo, rotulo }: { pos: Posicion; pocos: boolean; estilo: boolean; rotulo: string }) {
  const p = pos.p;
  const color = estilo || pocos || p == null ? "rgb(var(--rmcf-ink-rgb) / 0.4)" : colorDe(p);
  return (
    <div className="flex min-w-0 items-center gap-2 text-[11px]">
      <span className="w-[4.5rem] shrink-0 text-white/45">{rotulo}</span>
      <span className="relative block h-2 min-w-0 flex-1 rounded-full bg-white/10">
        <span className="absolute inset-y-[-3px] left-1/2 w-px bg-white/30" aria-hidden />
        {p != null && !pocos && (
          <span className="absolute inset-y-0 rounded-full" style={{ left: `${Math.min(50, p)}%`, width: `${Math.abs(p - 50)}%`, background: color }} />
        )}
      </span>
      <span className="w-12 shrink-0 text-right font-semibold tabular-nums" style={{ color }} title={estilo ? "Del que más tiene al que menos" : "Del mejor al peor"}>
        {pocos ? "" : `${pos.puesto}º/${pos.de}`}
      </span>
      <span className="w-9 shrink-0 text-right tabular-nums text-white/45">{pocos || p == null ? "" : `P${p}`}</span>
    </div>
  );
}

export function OptaBalonParado() {
  const [equipos, setEquipos] = useState<TablaOpta | null>(null);
  const [partidos, setPartidos] = useState<TablaOpta | null>(null);
  const [estado, setEstado] = useState<"cargando" | "listo" | "vacio">("cargando");
  const [seccion, setSeccion] = useState<SeccionAbp>("Resumen");
  const [abierta, setAbierta] = useState("");

  useEffect(() => {
    let vivo = true;
    void Promise.all([traeOpta(DOCS_OPTA.equipos), traeOpta(DOCS_OPTA.partidos)]).then(([e, p]) => {
      if (!vivo) return;
      setEquipos(e);
      setPartidos(p);
      setEstado(e?.filas?.length ? "listo" : "vacio");
    });
    return () => {
      vivo = false;
    };
  }, []);

  const datos = useMemo(() => {
    const filas = aObjetos(equipos) as FilaEquipoOpta[];
    const nuestro = filas.find((f) => f.teamId === CASTILLA_OPTA);
    if (!nuestro) return null;

    const grupos = gruposDePartidos(partidos);
    const g = grupos.get(CASTILLA_OPTA);
    /* Si los partidos no han llegado o no separan, el grupo no se da. */
    const delGrupo = g != null ? filas.filter((f) => grupos.get(String(f.teamId)) === g) : [];
    const hayGrupo = delGrupo.length >= 6 && delGrupo.length < filas.length;

    const lineas: Fila[] = [];
    for (const m of METRICAS_ABP_OPTA) {
      const valor = valorAbp(m, nuestro);
      if (valor == null) continue;
      const deTodos = filas.map((f) => ({ f, v: valorAbp(m, f) })).filter((x): x is { f: FilaEquipoOpta; v: number } => x.v != null);
      if (deTodos.length < 10) continue;
      const casos = m.casos ? m.casos(nuestro) : null;
      const delG = hayGrupo ? delGrupo.map((f) => valorAbp(m, f)).filter((v): v is number => v != null) : [];
      const masEsMejor = m.mejorAlto !== false;
      lineas.push({
        m,
        valor,
        casos,
        pocos: casos != null && casos < CASOS_MIN,
        grupo: posicion(m, valor, delG),
        categoria: posicion(m, valor, deTodos.map((x) => x.v)),
        top: [...deTodos]
          /* En un porcentaje, los de muy pocos intentos no entran en el podio. */
          .filter((x) => !m.casos || (m.casos(x.f) ?? 0) >= CASOS_MIN)
          .sort((a, b) => (masEsMejor ? b.v - a.v : a.v - b.v))
          .slice(0, 5)
          .map((x) => ({ equipo: String(x.f.equipo ?? ""), valor: x.v, nuestro: x.f.teamId === CASTILLA_OPTA })),
      });
    }

    return { lineas, hayGrupo, nGrupo: delGrupo.length, nTotal: filas.length, partidos: Number(nuestro.GM) || 0 };
  }, [equipos, partidos]);

  if (estado === "cargando") {
    return (
      <div className="space-y-3" role="status" aria-live="polite">
        <p className="text-[13px] text-white/60">Leyendo los datos de Opta de la categoría…</p>
        <div className="h-40 animate-pulse rounded-2xl bg-white/[0.06]" />
      </div>
    );
  }

  if (!datos) {
    return (
      <p className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/65">
        Los datos de Opta llegan con la descarga de los lunes (o el botón «Opta» de Ajustes).
      </p>
    );
  }

  const lineas = datos.lineas.filter((l) => l.m.seccion === seccion);
  const pobl = datos.hayGrupo ? "grupo" : "categoría";
  const pos = (l: Fila) => (datos.hayGrupo ? l.grupo : l.categoria);
  /* Lo mejor y lo peor, contra el grupo si se sabe y si no contra la categoría
     (antes se ordenaba siempre por el grupo: sin grupo, el resumen no salía). */
  const juzgables = datos.lineas.filter((l) => l.m.mejorAlto !== null && !l.pocos && pos(l).p != null);
  const orden = [...juzgables].sort((a, b) => (pos(b).p ?? 0) - (pos(a).p ?? 0));
  const mejor = orden[0];
  const peor = orden.at(-1);

  return (
    <div className="space-y-4">
      <Panel
        title="Opta · balón parado de la categoría"
        subtitle={`Fuente: Opta. El Castilla en ${datos.partidos} partidos frente a ${datos.hayGrupo ? `los ${datos.nGrupo} equipos de su grupo y ` : ""}los ${datos.nTotal} de Primera RFEF. Por partido salvo goles, asistencias y penaltis (en la temporada) y los porcentajes.`}
        icon={Database}
        action={
          <Segmented
            ariaLabel="Qué parte del balón parado"
            options={SECCIONES_ABP.map((s) => ({ key: s, label: s }))}
            value={seccion}
            onChange={setSeccion}
          />
        }
      >
        {seccion === "Resumen" && mejor && peor && mejor !== peor && (
          <div className="mb-4 rounded-xl border border-[#C8A96B]/30 bg-[#C8A96B]/[0.06] p-3 text-[13px] leading-relaxed text-white/85">
            <p>
              <b style={{ color: VERDE }}>Lo mejor:</b> {mejor.m.nombre.toLowerCase()}, {textoAbp(mejor.m, mejor.valor)} ({pos(mejor).puesto}º de {pos(mejor).de} en su {pobl}).
            </p>
            <p>
              <b style={{ color: ROJO }}>Lo peor:</b> {peor.m.nombre.toLowerCase()}, {textoAbp(peor.m, peor.valor)} ({pos(peor).puesto}º de {pos(peor).de} en su {pobl}).
            </p>
          </div>
        )}

        <ul className="divide-y divide-white/[0.06]">
          {lineas.map((l) => {
            const estilo = l.m.mejorAlto === null;
            const abiertaEsta = abierta === l.m.clave;
            return (
              <li key={l.m.clave} className="min-w-0 py-2.5">
                <div className="flex min-w-0 items-baseline gap-2">
                  <button
                    type="button"
                    onClick={() => setAbierta(abiertaEsta ? "" : l.m.clave)}
                    aria-expanded={abiertaEsta}
                    title="Pulsa para ver qué mide"
                    className="min-w-0 flex-1 truncate text-left text-[13px] text-white/85 underline decoration-dotted underline-offset-4 hover:text-white"
                  >
                    {l.m.nombre}
                    {l.m.mejorAlto === false && <span className="ml-1.5 text-[10px] text-white/40">(menos es mejor)</span>}
                    {estilo && <span className="ml-1.5 text-[10px] text-white/40">(estilo)</span>}
                  </button>
                  <span className="shrink-0 text-[13px] font-semibold tabular-nums text-white">
                    {textoAbp(l.m, l.valor)}
                    {l.m.modo === "pct" && l.casos != null && <span className="ml-1 text-[10px] font-normal text-white/45">({Math.round(l.casos)} intentos{l.pocos ? ", muestra pequeña" : ""})</span>}
                  </span>
                </div>

                <div className="mt-1.5 space-y-1">
                  {datos.hayGrupo && <Pista pos={l.grupo} pocos={l.pocos} estilo={estilo} rotulo="Su grupo" />}
                  <Pista pos={l.categoria} pocos={l.pocos} estilo={estilo} rotulo="Categoría" />
                </div>

                {l.top.length > 0 && (
                  <p className="mt-1.5 flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[11px] text-white/50">
                    <span className="inline-flex items-center gap-1 font-semibold text-white/55">
                      <Trophy size={11} className="text-[#C8A96B]" /> {estilo ? "Los que más" : "Los 5 mejores"}:
                    </span>
                    {l.top.map((t, i) => (
                      <span key={t.equipo} className={t.nuestro ? "font-semibold text-[#C8A96B]" : undefined}>
                        {i + 1}. {t.equipo} {textoAbp(l.m, t.valor)}
                      </span>
                    ))}
                  </p>
                )}

                {abiertaEsta && (
                  <p className="mt-1.5 text-[11px] leading-relaxed text-white/50">
                    {l.m.comoLeer}
                    {l.grupo.mediana != null && datos.hayGrupo ? ` Mediana del grupo: ${textoAbp(l.m, l.grupo.mediana)}.` : ""}
                    {l.categoria.mediana != null ? ` Mediana de la categoría: ${textoAbp(l.m, l.categoria.mediana)}.` : ""}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </Panel>
    </div>
  );
}
