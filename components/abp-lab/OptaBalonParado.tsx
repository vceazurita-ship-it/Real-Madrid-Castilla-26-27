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
|
| 25/11/2026 («mucho más visual, con todos los escudos»): cabecera con el
| escudo, el perfil entero en un mosaico de percentiles, un cuadrante por
| sección (a favor frente a en contra, un escudo por equipo), el próximo rival
| marcado en azul en cada pista, escudos en los cinco mejores y, al abrir una
| métrica, la clasificación entera con escudos (del grupo o de la categoría).
| Los números son los mismos de antes.
*/

import { useEffect, useMemo, useState } from "react";
import { Database, Trophy } from "lucide-react";

import { Panel, Segmented } from "@/components/abp/ui";
import { COMPARADO, MEJOR, PEOR, colorPercentil, tinta, useEscudos } from "@/components/data/graficas";
import { Cuadrante, Escudo, LeyendaProtagonistas, ORO_MARCA, Ranking } from "@/components/abp-lab/visual";
import { useProximoRival } from "@/hooks/useAbpLigas";
import { CASTILLA_OPTA, DOCS_OPTA, aObjetos, percentil, traeOpta, type TablaOpta } from "@/lib/opta";
import { METRICAS_ABP_OPTA, SECCIONES_ABP, gruposDePartidos, textoAbp, valorAbp, type FilaEquipoOpta, type MetricaAbpOpta, type SeccionAbp } from "@/lib/opta-abp";
import { casaEquipo } from "@/lib/opta-eventos";

const CASOS_MIN = 10;
const NOMBRE_CASTILLA = "Real Madrid Castilla";

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

type ValorEquipo = { id: string; equipo: string; v: number; casos: number | null; grupo: boolean };

type Fila = {
  m: MetricaAbpOpta;
  valor: number;
  casos: number | null;
  pocos: boolean;
  grupo: Posicion;
  categoria: Posicion;
  top: { id: string; equipo: string; valor: number; nuestro: boolean }[];
  /** Todos los equipos con dato, para la clasificación y el cuadrante. */
  todos: ValorEquipo[];
};

/** El cuadrante de cada sección: a favor (X) frente a en contra o a su producto (Y). */
const PAREJAS: Record<SeccionAbp, [string, string]> = {
  Resumen: ["ChncSetPl", "ChncSetPl|OPP"],
  "Córners": ["ShotCrnrs", "RematesCrnrOPP"],
  Faltas: ["ShotDirFK", "ShotDirFK|OPP"],
  "Saques de banda": ["ThrowIn", "RematesThr"],
  Penaltis: ["PensWon", "PensConc"],
};

function Pista({ pos, pocos, estilo, rotulo, rival, nombreRival }: { pos: Posicion; pocos: boolean; estilo: boolean; rotulo: string; rival?: Posicion | null; nombreRival?: string }) {
  const p = pos.p;
  const color = estilo || pocos || p == null ? tinta(0.4) : colorPercentil(p);
  return (
    <div className="flex min-w-0 items-center gap-2 text-[11px]">
      <span className="w-[4.5rem] shrink-0 text-white/45">{rotulo}</span>
      <span className="relative block h-2.5 min-w-0 flex-1 rounded-full" style={{ background: tinta(0.08) }}>
        <span className="absolute inset-y-[-3px] left-1/2 w-px" style={{ background: tinta(0.3) }} aria-hidden />
        {p != null && !pocos && <span className="absolute inset-y-0 rounded-full" style={{ left: `${Math.min(50, p)}%`, width: `${Math.abs(p - 50)}%`, background: color }} />}
        {p != null && !pocos && (
          <span aria-hidden className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: `${p}%`, background: ORO_MARCA, boxShadow: `0 0 0 2px var(--rmcf-surface, #11161C)` }} />
        )}
        {rival?.p != null && (
          <span
            className="absolute inset-y-[-4px] w-[3px] -translate-x-1/2 rounded-full"
            style={{ left: `${rival.p}%`, background: COMPARADO }}
            title={`${nombreRival ?? "Próximo rival"}: ${rival.puesto}º de ${rival.de} (P${rival.p})`}
          />
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
  const [ambito, setAmbito] = useState<"grupo" | "categoria">("grupo");
  const escudoDe = useEscudos();
  const proximo = useProximoRival();

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
    const idsGrupo = new Set(delGrupo.map((f) => String(f.teamId)));
    const nombreDe = (f: FilaEquipoOpta) => (f.teamId === CASTILLA_OPTA ? NOMBRE_CASTILLA : String(f.equipo ?? ""));

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
          .map((x) => ({ id: String(x.f.teamId), equipo: nombreDe(x.f), valor: x.v, nuestro: x.f.teamId === CASTILLA_OPTA })),
        todos: deTodos.map((x) => ({ id: String(x.f.teamId), equipo: nombreDe(x.f), v: x.v, casos: m.casos ? m.casos(x.f) : null, grupo: idsGrupo.has(String(x.f.teamId)) })),
      });
    }

    const lista = filas.map((f) => ({ teamId: String(f.teamId ?? ""), equipo: nombreDe(f) })).filter((e) => e.teamId);
    return { lineas, hayGrupo, nGrupo: delGrupo.length, nTotal: filas.length, partidos: Number(nuestro.GM) || 0, lista };
  }, [equipos, partidos]);

  const idRival = useMemo(() => {
    if (!datos || !proximo) return null;
    const id = casaEquipo(proximo, datos.lista);
    return id && id !== CASTILLA_OPTA ? id : null;
  }, [datos, proximo]);

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

  const nombreRival = idRival ? datos.lista.find((e) => e.teamId === idRival)?.equipo ?? "" : "";
  const rivalEnGrupo = !!idRival && datos.lineas[0]?.todos.some((t) => t.id === idRival && t.grupo);
  const enGrupo = datos.hayGrupo && ambito === "grupo";
  const pobl = datos.hayGrupo ? "grupo" : "categoría";
  const pos = (l: Fila) => (datos.hayGrupo ? l.grupo : l.categoria);

  /* La posición del próximo rival en la misma pista (grupo: sólo si es de nuestro grupo). */
  const posRival = (l: Fila, enElGrupo: boolean): Posicion | null => {
    if (!idRival) return null;
    const suyo = l.todos.find((t) => t.id === idRival);
    if (!suyo || (l.m.casos && (suyo.casos ?? 0) < CASOS_MIN)) return null;
    if (enElGrupo && !suyo.grupo) return null;
    return posicion(l.m, suyo.v, l.todos.filter((t) => !enElGrupo || t.grupo).map((t) => t.v));
  };

  const poblacion = (l: Fila) => l.todos.filter((t) => !enGrupo || t.grupo);

  const lineas = datos.lineas.filter((l) => l.m.seccion === seccion);
  /* Lo mejor y lo peor, contra el grupo si se sabe y si no contra la categoría
     (antes se ordenaba siempre por el grupo: sin grupo, el resumen no salía). */
  const juzgables = datos.lineas.filter((l) => l.m.mejorAlto !== null && !l.pocos && pos(l).p != null);
  const orden = [...juzgables].sort((a, b) => (pos(b).p ?? 0) - (pos(a).p ?? 0));
  const mejor = orden[0];
  const peor = orden.at(-1);

  /* El cuadrante de la sección. */
  const [claveX, claveY] = PAREJAS[seccion];
  const lx = datos.lineas.find((l) => l.m.clave === claveX);
  const ly = datos.lineas.find((l) => l.m.clave === claveY);
  const puntos =
    lx && ly
      ? poblacion(lx)
          .map((t) => {
            const y = ly.todos.find((u) => u.id === t.id);
            return y ? { id: t.id, equipo: t.equipo, x: t.v, y: y.v, escudo: escudoDe(t.equipo) } : null;
          })
          .filter((p): p is NonNullable<typeof p> => p != null)
      : [];

  const escudoNuestro = escudoDe(NOMBRE_CASTILLA);

  return (
    <div className="space-y-4">
      <Panel
        title="Opta · balón parado de la categoría"
        subtitle={`Fuente: Opta. El Castilla en ${datos.partidos} partidos frente a ${datos.hayGrupo ? `los ${datos.nGrupo} equipos de su grupo y ` : ""}los ${datos.nTotal} de Primera RFEF. Por partido salvo goles, asistencias y penaltis (en la temporada) y los porcentajes.`}
        icon={Database}
        action={
          <Segmented ariaLabel="Qué parte del balón parado" options={SECCIONES_ABP.map((s) => ({ key: s, label: s }))} value={seccion} onChange={setSeccion} />
        }
      >
        {/* ------------------------- CABECERA ------------------------- */}
        <div className="mb-4 flex min-w-0 flex-wrap items-center gap-3 rounded-2xl border border-white/10 p-3" style={{ background: `linear-gradient(110deg, ${ORO_MARCA}24, transparent 65%)` }}>
          <Escudo src={escudoNuestro} nombre={NOMBRE_CASTILLA} lado={48} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold text-white">{NOMBRE_CASTILLA}</p>
            <p className="text-[12px] text-white/55">
              {datos.partidos} partidos · {datos.hayGrupo ? `${datos.nGrupo} equipos en su grupo · ` : ""}
              {datos.nTotal} en Primera RFEF
            </p>
          </div>
          {idRival && (
            <span className="inline-flex min-w-0 items-center gap-2 rounded-xl px-2.5 py-1.5 text-[12px] text-white/75" style={{ background: `${COMPARADO}1F` }}>
              <Escudo src={escudoDe(nombreRival)} nombre={nombreRival} lado={26} />
              <span className="min-w-0">
                <span className="block text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: COMPARADO }}>
                  Próximo rival · en azul
                </span>
                <span className="block truncate font-semibold text-white">{nombreRival}</span>
              </span>
            </span>
          )}
        </div>

        {/* ------------------- LO MEJOR Y LO PEOR -------------------- */}
        {seccion === "Resumen" && mejor && peor && mejor !== peor && (
          <div className="mb-4 grid min-w-0 gap-2 sm:grid-cols-2">
            {[
              { l: mejor, rotulo: "Lo mejor", color: MEJOR },
              { l: peor, rotulo: "Lo peor", color: PEOR },
            ].map(({ l, rotulo, color }) => (
              <button
                key={rotulo}
                type="button"
                onClick={() => {
                  setSeccion(l.m.seccion);
                  setAbierta(l.m.clave);
                }}
                className="min-w-0 rounded-xl border border-white/10 p-3 text-left transition hover:bg-white/[0.04]"
                style={{ background: `${color}14` }}
              >
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color }}>
                  {rotulo}
                </p>
                <p className="mt-0.5 text-[13px] font-semibold text-white">{l.m.nombre}</p>
                <p className="mt-1 flex items-baseline gap-2">
                  <span className="text-2xl font-semibold tabular-nums text-white">{textoAbp(l.m, l.valor)}</span>
                  <span className="text-[12px] tabular-nums text-white/60">
                    {pos(l).puesto}º de {pos(l).de} en su {pobl} · P{pos(l).p}
                  </span>
                </p>
              </button>
            ))}
          </div>
        )}

        {/* ------------------ EL PERFIL, EN MOSAICO ------------------ */}
        {seccion === "Resumen" && juzgables.length > 0 && (
          <div className="mb-5">
            <h3 className="mb-1 text-[13px] font-semibold text-white">El perfil entero, de un vistazo</h3>
            <p className="mb-2 text-[11px] text-white/50">
              Cada casilla es una métrica que se juzga: su percentil contra su {pobl} (verde, P60 o más; oro, en la media; naranja, P40 o menos). Púlsala para ir a ella.
            </p>
            <div className="space-y-2">
              {SECCIONES_ABP.filter((s) => s !== "Resumen").map((s) => {
                const suyas = juzgables.filter((l) => l.m.seccion === s);
                if (!suyas.length) return null;
                return (
                  <div key={s} className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                    <span className="w-28 shrink-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/45">{s}</span>
                    <div className="grid min-w-0 flex-1 grid-cols-2 gap-1 sm:grid-cols-4 lg:grid-cols-6">
                      {suyas.map((l) => {
                        const p = pos(l).p ?? 0;
                        const c = colorPercentil(p);
                        return (
                          <button
                            key={l.m.clave}
                            type="button"
                            onClick={() => {
                              setSeccion(l.m.seccion);
                              setAbierta(l.m.clave);
                            }}
                            title={`${l.m.nombre}: ${textoAbp(l.m, l.valor)} · ${pos(l).puesto}º de ${pos(l).de} · P${p}`}
                            className="min-w-0 rounded-lg px-2 py-1.5 text-left transition hover:brightness-110"
                            style={{ background: `color-mix(in srgb, ${c} 16%, transparent)`, boxShadow: `inset 3px 0 0 ${c}` }}
                          >
                            <span className="block truncate text-[10.5px] text-white/70">{l.m.nombre}</span>
                            <span className="flex items-baseline justify-between gap-1">
                              <span className="text-[13px] font-semibold tabular-nums text-white">{textoAbp(l.m, l.valor)}</span>
                              <span className="text-[10.5px] font-semibold tabular-nums" style={{ color: c }}>
                                P{p}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ---------------- EL CUADRANTE DE LA SECCIÓN --------------- */}
        {lx && ly && puntos.length >= 3 && (
          <div className="mb-5 min-w-0 rounded-2xl border border-white/10 p-3">
            <div className="mb-2 flex min-w-0 flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-[13px] font-semibold text-white">
                  {lx.m.nombre} frente a {ly.m.nombre.toLowerCase()}
                </h3>
                <p className="text-[11px] text-white/50">
                  {enGrupo ? `Los ${puntos.length} equipos de su grupo` : `Los ${puntos.length} equipos de Primera RFEF`}, un escudo cada uno.
                </p>
              </div>
              {datos.hayGrupo && (
                <Segmented
                  ariaLabel="Contra quién"
                  options={[
                    { key: "grupo", label: "Su grupo" },
                    { key: "categoria", label: "Toda la categoría" },
                  ]}
                  value={ambito}
                  onChange={setAmbito}
                />
              )}
            </div>
            <Cuadrante
              puntos={puntos}
              etiquetaX={lx.m.nombre}
              etiquetaY={ly.m.nombre}
              textoX={(v) => textoAbp(lx.m, v)}
              textoY={(v) => textoAbp(ly.m, v)}
              xMejorAlto={lx.m.mejorAlto}
              yMejorAlto={ly.m.mejorAlto}
              nuestro={CASTILLA_OPTA}
              rival={idRival}
            />
            <LeyendaProtagonistas nuestro={NOMBRE_CASTILLA} rival={nombreRival && (!enGrupo || rivalEnGrupo) ? nombreRival : undefined} />
          </div>
        )}

        {/* ---------------------- LAS MÉTRICAS ----------------------- */}
        <ul className="divide-y divide-white/[0.06]">
          {lineas.map((l) => {
            const estilo = l.m.mejorAlto === null;
            const abiertaEsta = abierta === l.m.clave;
            const rG = datos.hayGrupo ? posRival(l, true) : null;
            const rC = posRival(l, false);
            const suyo = idRival ? l.todos.find((t) => t.id === idRival) : null;
            const ranking = poblacion(l)
              .filter((t) => !l.m.casos || (t.casos ?? 0) >= CASOS_MIN)
              .map((t) => ({ id: t.id, equipo: t.equipo, valor: t.v, texto: textoAbp(l.m, t.v), escudo: escudoDe(t.equipo), nota: t.casos != null ? `${Math.round(t.casos)} intentos` : undefined }));
            const fuera = poblacion(l).length - ranking.length;
            return (
              <li key={l.m.clave} className="min-w-0 py-3">
                <div className="flex min-w-0 items-baseline gap-2">
                  <button
                    type="button"
                    onClick={() => setAbierta(abiertaEsta ? "" : l.m.clave)}
                    aria-expanded={abiertaEsta}
                    title="Pulsa para ver qué mide y la clasificación entera"
                    className="min-w-0 flex-1 truncate text-left text-[13px] font-medium text-white/85 underline decoration-dotted underline-offset-4 hover:text-white"
                  >
                    {l.m.nombre}
                    {l.m.mejorAlto === false && <span className="ml-1.5 text-[10px] font-normal text-white/40">(menos es mejor)</span>}
                    {estilo && <span className="ml-1.5 text-[10px] font-normal text-white/40">(estilo)</span>}
                  </button>
                  <span className="shrink-0 text-base font-semibold tabular-nums text-white">
                    {textoAbp(l.m, l.valor)}
                    {l.m.modo === "pct" && l.casos != null && <span className="ml-1 text-[10px] font-normal text-white/45">({Math.round(l.casos)} intentos{l.pocos ? ", muestra pequeña" : ""})</span>}
                  </span>
                </div>

                <div className="mt-1.5 space-y-1">
                  {datos.hayGrupo && <Pista pos={l.grupo} pocos={l.pocos} estilo={estilo} rotulo="Su grupo" rival={rG} nombreRival={nombreRival} />}
                  <Pista pos={l.categoria} pocos={l.pocos} estilo={estilo} rotulo="Categoría" rival={rC} nombreRival={nombreRival} />
                </div>

                {suyo && (rG || rC) && (
                  <p className="mt-1 flex min-w-0 items-center gap-1.5 text-[11px] tabular-nums" style={{ color: COMPARADO }}>
                    <Escudo src={escudoDe(nombreRival)} nombre={nombreRival} lado={14} />
                    <span className="min-w-0 truncate">
                      {nombreRival}: {textoAbp(l.m, suyo.v)}
                      {rG ? ` · ${rG.puesto}º/${rG.de} en el grupo` : ""}
                      {rC ? ` · ${rC.puesto}º/${rC.de} en la categoría` : ""}
                    </span>
                  </p>
                )}

                {l.top.length > 0 && (
                  <div className="mt-2 flex min-w-0 flex-wrap items-center gap-1.5 text-[11px]">
                    <span className="inline-flex items-center gap-1 font-semibold text-white/55">
                      <Trophy size={11} className="text-[#C8A96B]" /> {estilo ? "Los que más" : "Los 5 mejores"}:
                    </span>
                    {l.top.map((t, i) => (
                      <span
                        key={t.id}
                        className={`inline-flex min-w-0 max-w-full items-center gap-1 rounded-full py-0.5 pl-0.5 pr-2 ${t.nuestro ? "font-semibold" : "text-white/65"}`}
                        style={{ background: t.nuestro ? `${ORO_MARCA}2E` : t.id === idRival ? `${COMPARADO}26` : tinta(0.06) }}
                      >
                        <Escudo src={escudoDe(t.equipo)} nombre={t.equipo} lado={16} />
                        <span className="tabular-nums text-white/40">{i + 1}</span>
                        <span className="min-w-0 truncate">{t.equipo}</span>
                        <span className="tabular-nums text-white/80">{textoAbp(l.m, t.valor)}</span>
                      </span>
                    ))}
                  </div>
                )}

                {abiertaEsta && (
                  <div className="mt-2 rounded-xl border border-white/10 bg-white/[0.02] p-3">
                    <p className="text-[11px] leading-relaxed text-white/55">
                      {l.m.comoLeer}
                      {l.grupo.mediana != null && datos.hayGrupo ? ` Mediana del grupo: ${textoAbp(l.m, l.grupo.mediana)}.` : ""}
                      {l.categoria.mediana != null ? ` Mediana de la categoría: ${textoAbp(l.m, l.categoria.mediana)}.` : ""}
                    </p>
                    {ranking.length > 0 && (
                      <div className="mt-3">
                        <div className="mb-2 flex min-w-0 flex-wrap items-center justify-between gap-2">
                          <p className="text-[12px] font-semibold text-white">{enGrupo ? "Su grupo, equipo a equipo" : "Toda la categoría, equipo a equipo"}</p>
                          {datos.hayGrupo && (
                            <Segmented
                              ariaLabel="Contra quién"
                              options={[
                                { key: "grupo", label: "Su grupo" },
                                { key: "categoria", label: "Categoría" },
                              ]}
                              value={ambito}
                              onChange={setAmbito}
                            />
                          )}
                        </div>
                        <Ranking
                          filas={ranking}
                          mejorAlto={l.m.mejorAlto}
                          nuestro={CASTILLA_OPTA}
                          rival={idRival}
                          tope={enGrupo ? undefined : 12}
                          pie={fuera > 0 ? <span>Sin los {fuera} de menos de {CASOS_MIN} intentos</span> : undefined}
                        />
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </Panel>
    </div>
  );
}
