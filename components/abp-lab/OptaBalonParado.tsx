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
import { Database, TrendingDown, TrendingUp, Trophy } from "lucide-react";

import { Panel, Segmented } from "@/components/abp/ui";
import { COMPARADO, MEJOR, PEOR, tinta, useEscudos } from "@/components/data/graficas";
import {
  CabeceraBloque,
  Cuadrante,
  EVENTO_SECCION,
  EVENTO_SECCION_ACTUAL,
  Escudo,
  AnilloPercentil,
  HeroVersus,
  LeyendaPista,
  LeyendaProtagonistas,
  MapaCalor,
  ORO_MARCA,
  PistaPercentil,
  Ranking,
  type KpiVersus,
} from "@/components/abp-lab/visual";
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

/* 25/11/2026: la pista es la `PistaPercentil` común (carril fino, mediana, punto de oro y raya azul del rival). */
function Pista({ pos, pocos, estilo, rotulo, rival, nombreRival }: { pos: Posicion; pocos: boolean; estilo: boolean; rotulo: string; rival?: Posicion | null; nombreRival?: string }) {
  return (
    <PistaPercentil
      rotulo={rotulo}
      p={pos.p}
      puesto={pos.puesto}
      de={pos.de}
      estilo={estilo}
      pocos={pocos}
      rival={rival?.p ?? null}
      tituloRival={rival ? `${nombreRival ?? "Próximo rival"}: ${rival.puesto}º de ${rival.de} (P${rival.p})` : undefined}
    />
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

  /* La navegación de /abp-datos pide sección con un evento; y se le avisa de la que está puesta. */
  useEffect(() => {
    const oye = (e: Event) => {
      const s = String((e as CustomEvent).detail ?? "");
      if ((SECCIONES_ABP as readonly string[]).includes(s)) setSeccion(s as SeccionAbp);
    };
    window.addEventListener(EVENTO_SECCION, oye);
    return () => window.removeEventListener(EVENTO_SECCION, oye);
  }, []);
  useEffect(() => {
    window.dispatchEvent(new CustomEvent(EVENTO_SECCION_ACTUAL, { detail: seccion }));
  }, [seccion]);

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

  /* El héroe: cuatro cifras de cabecera, contra el grupo si el rival es del grupo (si no, contra la categoría). */
  const heroEnGrupo = datos.hayGrupo && (!idRival || rivalEnGrupo);
  const dondeHero = heroEnGrupo ? "grupo" : "categoría";
  const CORTO: Record<string, string> = {
    GoalSetPly: "Goles ABP a favor",
    "GoalSetPly|OPP": "Goles ABP en contra",
    ChncSetPl: "Ocasiones ABP a favor",
    "ChncSetPl|OPP": "Ocasiones ABP en contra",
  };
  const kpis: KpiVersus[] = Object.keys(CORTO)
    .map((clave) => datos.lineas.find((l) => l.m.clave === clave))
    .filter((l): l is Fila => !!l)
    .map((l) => {
      const mio = heroEnGrupo ? l.grupo : l.categoria;
      const suyo = idRival ? l.todos.find((t) => t.id === idRival) : null;
      const rP = posRival(l, heroEnGrupo);
      const notas = [l.m.modo === "pp" ? "por partido" : l.m.modo === "total" ? "temporada" : "", l.m.mejorAlto === false ? "menos es mejor" : ""].filter(Boolean).join(", ");
      return {
        rotulo: CORTO[l.m.clave] ?? l.m.nombre,
        titulo: l.m.nombre,
        nota: notas || undefined,
        valor: textoAbp(l.m, l.valor),
        p: mio.p,
        detalle: `${mio.puesto}º de ${mio.de} en su ${dondeHero}${mio.mediana != null ? ` · mediana ${textoAbp(l.m, mio.mediana)}` : ""}`,
        rival: suyo && rP ? { valor: textoAbp(l.m, suyo.v), p: rP.p, detalle: `${nombreRival}: ${rP.puesto}º de ${rP.de}` } : null,
      };
    });

  return (
    <div className="space-y-5">
      <div id="abp-resumen" className="scroll-mt-40">
        <HeroVersus
          etiqueta={`Balón parado · Opta · ${datos.partidos} partidos`}
          nombre={NOMBRE_CASTILLA}
          escudo={escudoNuestro}
          sub={`${datos.hayGrupo ? `${datos.nGrupo} equipos en su grupo · ` : ""}${datos.nTotal} en Primera RFEF · percentil contra su ${dondeHero}`}
          rival={idRival ? { nombre: nombreRival, escudo: escudoDe(nombreRival), sub: "en azul en toda la pestaña" } : null}
          kpis={kpis}
        />
      </div>
      <div id="abp-opta">
      <Panel
        title="Opta · balón parado de la categoría"
        subtitle={`Fuente: Opta. El Castilla en ${datos.partidos} partidos frente a ${datos.hayGrupo ? `los ${datos.nGrupo} equipos de su grupo y ` : ""}los ${datos.nTotal} de Primera RFEF. Por partido salvo goles, asistencias y penaltis (en la temporada) y los porcentajes.`}
        icon={Database}
        action={
          <Segmented ariaLabel="Qué parte del balón parado" options={SECCIONES_ABP.map((s) => ({ key: s, label: s }))} value={seccion} onChange={setSeccion} />
        }
      >
        {/* ------------------- LO MEJOR Y LO PEOR -------------------- */}
        {seccion === "Resumen" && mejor && peor && mejor !== peor && (
          <div className="mb-6 grid min-w-0 gap-3 sm:grid-cols-2">
            {[
              { l: mejor, rotulo: "Lo mejor", color: MEJOR, Icono: TrendingUp },
              { l: peor, rotulo: "Lo peor", color: PEOR, Icono: TrendingDown },
            ].map(({ l, rotulo, color, Icono }) => (
              <button
                key={rotulo}
                type="button"
                onClick={() => {
                  setSeccion(l.m.seccion);
                  setAbierta(l.m.clave);
                }}
                className="lab-aparece group relative flex min-w-0 items-center gap-4 overflow-hidden rounded-2xl border border-white/10 p-4 text-left transition duration-150 hover:-translate-y-0.5 hover:shadow-lg motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                style={{ background: `radial-gradient(ellipse at 0% 0%, ${color}29, transparent 60%), ${color}0A` }}
                title="Ir a esta métrica"
              >
                <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ background: color }} />
                <AnilloPercentil p={pos(l).p} lado={58} grosor={5} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color }}>
                    <Icono size={13} />
                    {rotulo} · {l.m.seccion}
                  </span>
                  <span className="mt-0.5 block truncate text-[13.5px] font-semibold text-white" title={l.m.nombre}>
                    {l.m.nombre}
                  </span>
                  <span className="mt-1 flex min-w-0 flex-wrap items-baseline gap-x-2">
                    <span className="text-[26px] font-semibold leading-none tabular-nums text-white">{textoAbp(l.m, l.valor)}</span>
                    <span className="text-[11.5px] tabular-nums text-white/55">
                      {pos(l).puesto}º de {pos(l).de} en su {pobl}
                    </span>
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}

        {/* ------------- EL PERFIL, EN MAPA DE CALOR (25/11) ------------- */}
        {seccion === "Resumen" && juzgables.length > 0 && (
          <div className="mb-6">
            <CabeceraBloque
              titulo="El perfil entero, de un vistazo"
              queMirar={`las celdas más intensas: verde, donde el Castilla destaca en su ${pobl}; naranja, donde más le cuesta.`}
            />
            <MapaCalor
              filas={SECCIONES_ABP.filter((sec) => sec !== "Resumen")
                .map((sec) => ({
                  seccion: sec,
                  celdas: juzgables
                    .filter((l) => l.m.seccion === sec)
                    .map((l) => ({
                      clave: l.m.clave,
                      nombre: l.m.nombre,
                      valor: textoAbp(l.m, l.valor),
                      p: pos(l).p,
                      titulo: `${l.m.nombre}: ${textoAbp(l.m, l.valor)} · ${pos(l).puesto}º de ${pos(l).de} · P${pos(l).p}`,
                      alPulsar: () => {
                        setSeccion(l.m.seccion);
                        setAbierta(l.m.clave);
                      },
                    })),
                }))
                .filter((f) => f.celdas.length > 0)}
            />
          </div>
        )}

        {/* ---------------- EL CUADRANTE DE LA SECCIÓN --------------- */}
        {lx && ly && puntos.length >= 3 && (
          <div id="abp-cuadrante" className="mb-6 min-w-0 rounded-2xl border border-white/10 bg-white/[0.02] p-3 sm:p-4">
            <div className="mb-2 flex min-w-0 flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-[13.5px] font-semibold text-white">
                  {lx.m.nombre} frente a {ly.m.nombre.toLowerCase()}
                </h3>
                <p className="mt-0.5 text-[11.5px] text-white/50">
                  <span className="mr-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#C8A96B]">Qué mirar</span>
                  dónde cae el Castilla (oro) frente al próximo rival (azul) y a la esquina verde. {enGrupo ? `Los ${puntos.length} equipos de su grupo` : `Los ${puntos.length} equipos de Primera RFEF`}, un escudo cada uno.
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
        <div id="abp-metricas">
          <CabeceraBloque titulo={`${seccion === "Resumen" ? "Lo esencial" : seccion}, métrica a métrica`} queMirar="el punto de oro frente a la raya central (la mediana) y la raya azul del rival. Pulsa el nombre para la clasificación entera." />
        </div>
        <div className="mb-1 border-b border-white/[0.06] pb-2">
          <LeyendaPista nuestro={NOMBRE_CASTILLA} rival={nombreRival ? `Próximo rival: ${nombreRival}` : undefined} />
        </div>
        <ul className="divide-y divide-white/[0.06]">
          {lineas.map((l) => {
            const estilo = l.m.mejorAlto === null;
            const abiertaEsta = abierta === l.m.clave;
            const rG = datos.hayGrupo ? posRival(l, true) : null;
            const rC = posRival(l, false);
            const suyo = idRival ? l.todos.find((t) => t.id === idRival) : null;
            /* La clasificación entera sólo se arma para la métrica abierta. */
            const ranking = abiertaEsta
              ? poblacion(l)
                  .filter((t) => !l.m.casos || (t.casos ?? 0) >= CASOS_MIN)
                  .map((t) => ({ id: t.id, equipo: t.equipo, valor: t.v, texto: textoAbp(l.m, t.v), escudo: escudoDe(t.equipo), nota: t.casos != null ? `${Math.round(t.casos)} intentos` : undefined }))
              : [];
            const fuera = abiertaEsta ? poblacion(l).length - ranking.length : 0;
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
    </div>
  );
}
