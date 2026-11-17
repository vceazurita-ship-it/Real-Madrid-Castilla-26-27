"use client";

/*
| VISUAL DEL BALÓN PARADO (16/11/2026, petición del analista: «las áreas
| visuales mucho mejor, trasládalo a los análisis de ABP»).
|
| Lo que se abre en «Visual» en ABP ofensivo y defensivo y en saque de banda
| ofensivo y defensivo (el patrón de components/ui/VistaVisual.tsx). Una sola
| pieza para las cuatro: cada pantalla le da sus filas ya filtradas (con su
| desenlace decidido por su propio lector, que no comparten convención de
| resultado: ver la memoria de arquitectura de ABP) y sus categorías.
|
| Láminas, cada una con su conclusión en el título (orden del 16/11/2026,
| ronda 18: el campo primero):
| 1. Dónde: el campograma que ya tiene la pantalla, con su conclusión.
| 2. Acción a acción con su vídeo (si la pantalla la da).
| 3. ¿Es lo de siempre?: este partido frente a la media, en barras con la
|    raya de la media y la franja del rango; mismo juicio que la tabla.
| 4. Cómo acaban: una barra apilada con el reparto de desenlaces.
| 5. Jornada a jornada: una columna apilada por partido, en orden de
|    calendario (pretemporada antes que liga), y si va a mejor o a peor.
| 6. La categoría: el bloque de Opta de la pantalla.
| Lo que no tiene dato no sale.
*/

import type { ReactNode } from "react";

import { Lamina, TituloConclusion } from "@/components/ui/VistaVisual";
import { tinta } from "@/components/data/graficas";
import { formatoPorcentaje, numeroCorto, type MetricaComparada } from "@/components/abp/ComparativaPartido";
import { comparaCronologico } from "@/lib/abp/analisis";
import type { JornadaAbp } from "@/lib/abp/partido";

export type CategoriaVisual = { clave: string; rotulo: string; color: string };

export type FilaVisualAbp = {
  jornada: JornadaAbp;
  /** La clave de su categoría de desenlace. */
  cat: string;
  /** Si cuenta como acierto (o, en lo defensivo, como peligro concedido). */
  exito: boolean;
  /** Dónde (zona de caída, zona de saque) en palabras; vacío si no hay. */
  zona?: string;
  /** El tipo (córner, falta lateral…), para «¿Qué hace más daño?»; vacío si no hay. */
  tipo?: string;
};

export type ExitoVisual = {
  /** «acaba en gol u ocasión» */
  uno: string;
  /** «acaban en gol u ocasión» */
  varios: string;
  /** Más es mejor (ofensivo) o menos es mejor (defensivo). */
  mejorAlto: boolean;
};

const pc = (n: number, de: number) => (de ? Math.round((n / de) * 100) : 0);
const mayuscula = (t: string) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);

/** La conclusión del campo: dónde se concentra y si ahí nace lo que importa. */
export function tituloDondeAbp(filas: FilaVisualAbp[], unidad: Unidad, exito: ExitoVisual): string {
  const conZona = filas.filter((f) => f.zona);
  if (conZona.length < 2) return "";
  const porZona = new Map<string, FilaVisualAbp[]>();
  for (const f of conZona) porZona.set(f.zona!, [...(porZona.get(f.zona!) ?? []), f]);
  const orden = [...porZona.entries()].sort((a, b) => b[1].length - a[1].length);
  const [zona, suyas] = orden[0];
  if (orden[1] && orden[1][1].length === suyas.length) return "";
  const total = filas.filter((f) => f.exito).length;
  const aqui = suyas.filter((f) => f.exito).length;
  const f = unidad.genero === "f";
  const nace =
    aqui === 0 || total === 0
      ? ""
      : total === 1
        ? `; ahí nace ${f ? "la única" : "el único"} que ${exito.uno}`
        : `; ahí nacen ${aqui} de ${f ? "las" : "los"} ${total} que ${exito.varios}`;
  /* 16/11/2026 (jueces): «6 de 7» sin decir por qué falta una; se dice cuántas no tienen sitio. */
  const sinSitio = filas.length - conZona.length;
  const deCuantas = sinSitio > 0 ? `${conZona.length} con sitio (${sinSitio} sin zona de caída)` : `${conZona.length} ${unidad.varios}`;
  return `${mayuscula(zona)} concentra ${suyas.length} de ${deCuantas}, el ${pc(suyas.length, conZona.length)} %${nace}`;
}

export type Unidad = { uno: string; varios: string; genero: "f" | "m" };

/** Barra apilada al 100 %, con la leyenda y las cifras debajo. */
export function BarraReparto({ filas, categorias }: { filas: FilaVisualAbp[]; categorias: CategoriaVisual[] }) {
  const total = filas.length;
  const tramos = categorias.map((c) => ({ ...c, n: filas.filter((f) => f.cat === c.clave).length })).filter((c) => c.n > 0);
  return (
    <div className="min-w-0">
      <div className="flex h-9 w-full overflow-hidden rounded-lg" role="img" aria-label={tramos.map((t) => `${t.rotulo}: ${t.n}`).join(", ")}>
        {tramos.map((t) => (
          <div
            key={t.clave}
            className="flex h-full min-w-0 items-center justify-center text-[11px] font-bold tabular-nums"
            style={{ width: `${(t.n / total) * 100}%`, background: t.color, color: t.color.startsWith("#") ? "#0B0F14" : "rgb(var(--rmcf-ink-rgb))" }}
            title={`${t.rotulo}: ${t.n} de ${total}`}
          >
            {t.n / total >= 0.08 ? t.n : ""}
          </div>
        ))}
      </div>
      <ul className="mt-3 grid grid-cols-1 gap-x-4 gap-y-1.5 text-[12px] sm:grid-cols-2">
        {tramos.map((t) => (
          <li key={t.clave} className="flex min-w-0 items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: t.color }} aria-hidden />
            <span className="min-w-0 flex-1 truncate text-white/75">{t.rotulo}</span>
            <span className="shrink-0 tabular-nums text-white/90">
              {t.n} <span className="text-white/50">· {pc(t.n, total)} %</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

type Partido = { jornada: JornadaAbp; filas: FilaVisualAbp[] };

/** Una columna apilada por partido, en orden de calendario. */
function ColumnasJornada({ partidos, categorias, exito, marca }: { partidos: Partido[]; categorias: CategoriaVisual[]; exito: ExitoVisual; marca?: string | null }) {
  const tope = Math.max(...partidos.map((p) => p.filas.length), 1);
  return (
    <div className="min-w-0 overflow-x-auto">
      <div className="flex h-44 items-end gap-1.5" style={{ minWidth: partidos.length * 26 }}>
        {partidos.map((p) => {
          const n = p.filas.length;
          const exitos = p.filas.filter((f) => f.exito).length;
          const marcada = marca === p.jornada.clave;
          return (
            <div key={p.jornada.clave} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end" title={`${p.jornada.etiqueta}: ${n} · ${exitos} de ${n}`}>
              <span className={`mb-1 text-[11px] tabular-nums ${marcada ? "font-bold" : "text-white/60"}`} style={marcada ? { color: "var(--rmcf-gold-ink)" } : undefined}>
                {exitos ? `${exitos}/${n}` : n}
              </span>
              <div
                className="flex w-full max-w-[34px] flex-col-reverse overflow-hidden rounded-t-[4px]"
                style={{ height: `${(n / tope) * 100}%`, outline: marcada ? "2px solid #C8A96B" : undefined, outlineOffset: 1 }}
              >
                {categorias.map((c) => {
                  const k = p.filas.filter((f) => f.cat === c.clave).length;
                  return k ? <div key={c.clave} style={{ height: `${(k / n) * 100}%`, background: c.color }} /> : null;
                })}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex gap-1.5" style={{ minWidth: partidos.length * 26 }}>
        {partidos.map((p) => (
          <span
            key={p.jornada.clave}
            className={`min-w-0 flex-1 truncate text-center text-[11px] ${marca === p.jornada.clave ? "font-bold" : "text-white/55"}`}
            style={marca === p.jornada.clave ? { color: "var(--rmcf-gold-ink)" } : undefined}
          >
            {p.jornada.corto}
          </span>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-white/50">
        Encima de cada columna, las que {exito.varios} sobre el total del partido. Orden de calendario.
        {marca && partidos.some((p) => p.jornada.clave === marca) ? " En oro, el último partido." : ""}
      </p>
    </div>
  );
}

function tituloTendencia(partidos: Partido[], unidad: Unidad, exito: ExitoVisual): string {
  if (partidos.length < 2) return "";
  const tasa = (ps: Partido[]) => {
    const fs = ps.flatMap((p) => p.filas);
    return { n: fs.length, k: fs.filter((f) => f.exito).length };
  };
  if (partidos.length >= 4) {
    const ultimos = partidos.slice(-3);
    const antes = partidos.slice(0, -3);
    const u = tasa(ultimos);
    const a = tasa(antes);
    if (!u.n || !a.n) return "";
    const pu = pc(u.k, u.n);
    const pa = pc(a.k, a.n);
    const dif = pu - pa;
    const juicio = Math.abs(dif) < 5 ? "se mantiene" : (dif > 0) === exito.mejorAlto ? "va a mejor" : "va a peor";
    return `En los 3 últimos partidos, ${pu} % ${exito.varios} (${u.k} de ${u.n}); antes, ${pa} %: ${juicio}`;
  }
  const mejor = [...partidos]
    .filter((p) => p.filas.length)
    .sort((x, y) => (exito.mejorAlto ? 1 : -1) * (pc(y.filas.filter((f) => f.exito).length, y.filas.length) - pc(x.filas.filter((f) => f.exito).length, x.filas.length)))[0];
  if (!mejor) return "";
  const k = mejor.filas.filter((f) => f.exito).length;
  return `${partidos.length} partidos; el mejor, ${mejor.jornada.etiqueta}: ${k} de ${mejor.filas.length} ${unidad.varios} ${k === 1 ? exito.uno : exito.varios}`;
}

/** Una barra apilada por tipo, del que más tiene al que menos, y cuál rinde (o duele) más. */
function PorTipo({ filas, categorias }: { filas: FilaVisualAbp[]; categorias: CategoriaVisual[] }) {
  const grupos = new Map<string, FilaVisualAbp[]>();
  for (const f of filas) if (f.tipo) grupos.set(f.tipo, [...(grupos.get(f.tipo) ?? []), f]);
  const orden = [...grupos.entries()].sort((a, b) => b[1].length - a[1].length);
  const tope = Math.max(...orden.map(([, fs]) => fs.length), 1);
  return (
    <ul className="min-w-0 space-y-2">
      {orden.map(([tipo, fs]) => {
        const k = fs.filter((f) => f.exito).length;
        return (
          <li key={tipo} className="min-w-0">
            <div className="flex min-w-0 items-baseline justify-between gap-2 text-[12px]">
              <span className="min-w-0 truncate text-white/80">{mayuscula(tipo)}</span>
              <span className="shrink-0 tabular-nums text-white/60">
                {k}/{fs.length}
              </span>
            </div>
            <div className="mt-1 flex h-3 overflow-hidden rounded-[3px]" style={{ width: `${Math.max(6, (fs.length / tope) * 100)}%` }}>
              {categorias.map((c) => {
                const n = fs.filter((f) => f.cat === c.clave).length;
                return n ? <div key={c.clave} style={{ width: `${(n / fs.length) * 100}%`, background: c.color }} title={`${c.rotulo}: ${n}`} /> : null;
              })}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function tituloTipo(filas: FilaVisualAbp[], exito: ExitoVisual): string {
  const grupos = new Map<string, FilaVisualAbp[]>();
  for (const f of filas) if (f.tipo) grupos.set(f.tipo, [...(grupos.get(f.tipo) ?? []), f]);
  if (grupos.size < 2) return "";
  const conMuestra = [...grupos.entries()].filter(([, fs]) => fs.length >= 3);
  const tasa = (fs: FilaVisualAbp[]) => fs.filter((f) => f.exito).length / fs.length;
  const elegido = [...conMuestra].sort((a, b) => tasa(b[1]) - tasa(a[1]))[0];
  if (!elegido || tasa(elegido[1]) === 0) {
    const [tipo, fs] = [...grupos.entries()].sort((a, b) => b[1].length - a[1].length)[0];
    return `Lo más repetido: ${tipo.toLowerCase()} (${fs.length} de ${filas.filter((f) => f.tipo).length})`;
  }
  const [tipo, fs] = elegido;
  const k = fs.filter((f) => f.exito).length;
  return `${exito.mejorAlto ? "Lo que más rinde" : "Lo que más peligro da"}: ${tipo.toLowerCase()}, ${k} de ${fs.length} ${k === 1 ? exito.uno : exito.varios} (${pc(k, fs.length)} %)`;
}


/* ------------------------------------------------------------------ */
/*  Este partido frente a la media, en barras (16/11/2026, jueces)     */
/* ------------------------------------------------------------------ */

export type ComparativaVisualDatos = {
  /** «Jornada 11 · Hércules». */
  partido: string;
  /** «la media de las 10 jornadas anteriores». */
  rotuloMedia: string;
  metricas: MetricaComparada[];
  /** Desde cuántas acciones una fila se juzga (la misma regla que la tabla de «Detalle»). */
  muestraMinima: number;
};

type FilaComparada = { m: MetricaComparada; d: number; juicio: "mejor" | "peor" | "igual" | "tendencia" | null };

/** El mismo juicio que la tabla: «igual» a menos de 2 puntos o del 5 %; con base corta, tendencia. */
function juzgaFila(m: MetricaComparada, muestraMinima: number): FilaComparada | null {
  if (m.actual === null || m.media === null) return null;
  const pct = (m.formato ?? numeroCorto) === formatoPorcentaje;
  const d = m.actual - m.media;
  const juzga = m.mejorAlto === true || m.mejorAlto === false;
  if (!juzga) return { m, d, juicio: null };
  const corta = m.tendencia || (m.de !== undefined && m.de < muestraMinima);
  const margen = pct ? 2 : Math.max(0.05, Math.abs(m.media) * 0.05);
  if (Math.abs(d) < margen) return { m, d, juicio: "igual" };
  if (corta) return { m, d, juicio: "tendencia" };
  return { m, d, juicio: (d > 0) === m.mejorAlto ? "mejor" : "peor" };
}

const lista = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}`);

function tituloComparativa(filas: FilaComparada[], datos: ComparativaVisualDatos): string {
  const nombre = (f: FilaComparada) => f.m.nombre.charAt(0).toLowerCase() + f.m.nombre.slice(1);
  const mejores = filas.filter((f) => f.juicio === "mejor").map(nombre);
  const peores = filas.filter((f) => f.juicio === "peor").map(nombre);
  if (mejores.length || peores.length) {
    return [mejores.length ? `Mejor que de costumbre en ${lista(mejores)}` : "", peores.length ? `${mejores.length ? "peor" : "Peor que de costumbre"} en ${lista(peores)}` : ""]
      .filter(Boolean)
      .join("; ");
  }
  const tendencias = filas.filter((f) => f.juicio === "tendencia");
  if (tendencias.length) {
    const peso = (f: FilaComparada) => Math.abs(f.d) / Math.max(0.5, Math.abs(f.m.media ?? 0));
    const mayor = [...tendencias].sort((a, b) => peso(b) - peso(a))[0];
    const fmt = mayor.m.formato ?? numeroCorto;
    return `Con pocas acciones, sólo tendencia: ${nombre(mayor)}, ${fmt(mayor.m.actual ?? 0)} frente a ${fmt(mayor.m.media ?? 0)} de media`;
  }
  return filas.some((f) => f.juicio === "igual") ? `En la línea de ${datos.rotuloMedia}` : "";
}

const COLOR_JUICIO: Record<string, string> = { mejor: "var(--rmcf-dif-mejor)", peor: "var(--rmcf-dif-peor)" };
const ORO_PUNTO = "#C8A96B";

function ComparativaBarras({ filas }: { filas: FilaComparada[] }) {
  return (
    <ul className="min-w-0 space-y-3.5">
      {filas.map(({ m, juicio }) => {
        const fmt = m.formato ?? numeroCorto;
        const pct = fmt === formatoPorcentaje;
        const actual = m.actual ?? 0;
        const media = m.media ?? 0;
        const tope = Math.max(actual, media, m.rango?.[1] ?? 0, pct ? 10 : 1) * 1.08;
        const x = (v: number) => Math.max(0, Math.min(100, (v / tope) * 100));
        const color = juicio && COLOR_JUICIO[juicio] ? COLOR_JUICIO[juicio] : ORO_PUNTO;
        const rango = m.rango && m.rango[0] !== m.rango[1] && !(pct && m.rango[0] <= 0 && m.rango[1] >= 100) ? m.rango : null;
        const base = m.de !== undefined ? (m.n !== undefined ? `${m.n} de ${m.de}` : `de ${m.de} ${m.unidad ?? "acciones"}`) : "";
        return (
          <li key={m.clave} className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-[12px]">
              <span className="min-w-0 text-white/85">
                {m.nombre}
                {m.mejorAlto === true ? <span className="text-white/50"> · ▲ más es mejor</span> : m.mejorAlto === false ? <span className="text-white/50"> · ▼ menos es mejor</span> : null}
              </span>
              <span className="shrink-0 tabular-nums">
                <span className="text-[13px] font-bold" style={{ color: juicio === "mejor" || juicio === "peor" ? color : "var(--rmcf-gold-ink)" }}>
                  {fmt(actual)}
                </span>
                <span className="text-white/60"> · media {fmt(media)}</span>
                {juicio ? (
                  <span
                    className="ml-1.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold"
                    style={{ color: COLOR_JUICIO[juicio] ?? "rgb(var(--rmcf-ink-rgb) / .65)", background: "rgb(var(--rmcf-ink-rgb) / .06)" }}
                  >
                    {juicio}
                  </span>
                ) : null}
              </span>
            </div>
            <div
              className="relative mt-1.5 h-3 rounded-full"
              style={{ background: "rgb(var(--rmcf-ink-rgb) / .07)" }}
              role="img"
              aria-label={`${m.nombre}: ${fmt(actual)}; media ${fmt(media)}${rango ? `; antes, de ${fmt(rango[0])} a ${fmt(rango[1])}` : ""}`}
            >
              {rango ? (
                <span
                  className="absolute inset-y-0 rounded-full"
                  style={{ left: `${x(rango[0])}%`, width: `${Math.max(1, x(rango[1]) - x(rango[0]))}%`, background: "rgb(var(--rmcf-ink-rgb) / .15)" }}
                />
              ) : null}
              <span className="absolute -bottom-1 -top-1 w-[2px] rounded-full" style={{ left: `${x(media)}%`, background: "rgb(var(--rmcf-ink-rgb) / .7)" }} />
              <span
                className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
                style={{ left: `${x(actual)}%`, background: juicio === "tendencia" ? "transparent" : color, borderColor: color }}
              />
            </div>
            {rango || base ? (
              <p className="mt-1 text-[11px] text-white/55">
                {[rango ? `${pct ? "" : "por partido · "}antes, de ${fmt(rango[0])} a ${fmt(rango[1])}` : "", base ? `este partido, ${base}` : ""].filter(Boolean).join(" · ")}
              </p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function LeyendaComparativa() {
  return (
    <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/55">
      <span className="inline-flex items-center gap-1">
        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: ORO_PUNTO }} aria-hidden /> este partido
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="inline-block h-3 w-[2px]" style={{ background: "rgb(var(--rmcf-ink-rgb) / .7)" }} aria-hidden /> la media
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="inline-block h-2.5 w-5 rounded-full" style={{ background: "rgb(var(--rmcf-ink-rgb) / .15)" }} aria-hidden /> del partido más bajo al más alto
      </span>
      <span>· círculo hueco: tendencia, pocas acciones</span>
    </p>
  );
}

export function VisualAbp({
  filas,
  categorias,
  unidad,
  exito,
  fuente,
  mapa,
  liga,
  ligaPregunta = "¿Y frente a la categoría?",
  comparativa,
  acciones,
  marca,
  repartoArriba = false,
}: {
  filas: FilaVisualAbp[];
  categorias: CategoriaVisual[];
  unidad: Unidad;
  exito: ExitoVisual;
  fuente: string;
  /** El campograma de la pantalla (si lo hay) con su pregunta. */
  mapa?: { pregunta: string; nodo: ReactNode } | null;
  /** El bloque de la categoría (Opta). */
  liga?: ReactNode;
  ligaPregunta?: string;
  /** Este partido frente a la media de los anteriores (la tabla de «Detalle», en barras). */
  comparativa?: ComparativaVisualDatos | null;
  /** La lista de acciones con su vídeo, bajo el campo. */
  acciones?: { titulo: string; nodo: ReactNode } | null;
  /** 17/11/2026 (ronda 19): la jornada que se marca en oro sobre la temporada. */
  marca?: string | null;
  /** «¿Cómo acaban?» ya va en la conclusión de arriba: aquí no se repite. */
  repartoArriba?: boolean;
}) {
  if (!filas.length) return null;

  const total = filas.length;
  const k = filas.filter((f) => f.exito).length;
  const tituloReparto = `De ${total} ${total === 1 ? unidad.uno : unidad.varios}, ${k} (${pc(k, total)} %) ${k === 1 ? exito.uno : exito.varios}`;

  const porJornada = new Map<string, Partido>();
  for (const f of filas) {
    const p = porJornada.get(f.jornada.clave) ?? { jornada: f.jornada, filas: [] };
    p.filas.push(f);
    porJornada.set(f.jornada.clave, p);
  }
  const partidos = [...porJornada.values()].filter((p) => p.jornada.clave).sort((a, b) => comparaCronologico(a.jornada, b.jornada));
  const tituloJornadas = tituloTendencia(partidos, unidad, exito);
  const tituloMapa = mapa ? tituloDondeAbp(filas, unidad, exito) : "";
  const tituloTipos = tituloTipo(filas, exito);

  const filasComparadas = comparativa
    ? comparativa.metricas.map((m) => juzgaFila(m, comparativa.muestraMinima)).filter((f): f is FilaComparada => f !== null)
    : [];
  const tituloComparada = comparativa && filasComparadas.length ? tituloComparativa(filasComparadas, comparativa) : "";

  /*
  | 16/11/2026 (jueces, ronda 18): el campo va el primero —«dónde cae no puede
  | quedar escondido»—, con la lista de acciones y su vídeo justo debajo, y
  | luego este partido frente a la media en barras con el rango.
  */
  return (
    <div className="mt-5 min-w-0 space-y-4">
      {mapa ? (
        <Lamina>
          <TituloConclusion pregunta={mapa.pregunta} fuente={fuente}>
            {tituloMapa || `${total} ${total === 1 ? unidad.uno : unidad.varios} en el campo`}
          </TituloConclusion>
          {mapa.nodo}
        </Lamina>
      ) : null}
      {acciones ? (
        <Lamina>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/50">{acciones.titulo}</p>
          {acciones.nodo}
        </Lamina>
      ) : null}
      {comparativa && tituloComparada ? (
        <Lamina>
          <TituloConclusion pregunta="¿Es lo de siempre?" fuente={`${comparativa.partido} · frente a ${comparativa.rotuloMedia}`}>
            {tituloComparada}
          </TituloConclusion>
          <ComparativaBarras filas={filasComparadas} />
          <LeyendaComparativa />
        </Lamina>
      ) : null}
      <div className={`grid min-w-0 gap-4 ${repartoArriba ? "" : "xl:grid-cols-2"}`}>
        {repartoArriba ? null : (
          <Lamina>
            <TituloConclusion pregunta="¿Cómo acaban?" fuente={fuente}>
              {tituloReparto}
            </TituloConclusion>
            <BarraReparto filas={filas} categorias={categorias} />
          </Lamina>
        )}
        {tituloJornadas ? (
          <Lamina>
            <TituloConclusion pregunta="¿Va a mejor?" fuente={`${partidos.length} partidos con estos filtros`}>
              {tituloJornadas}
            </TituloConclusion>
            <ColumnasJornada partidos={partidos} categorias={categorias} exito={exito} marca={marca} />
          </Lamina>
        ) : null}
      </div>
      {tituloTipos ? (
        <Lamina>
          <TituloConclusion pregunta="¿Qué hace más daño?" fuente={`A la derecha, las que ${exito.varios} sobre el total de cada tipo`}>
            {tituloTipos}
          </TituloConclusion>
          <PorTipo filas={filas} categorias={categorias} />
        </Lamina>
      ) : null}
      {liga ? (
        <Lamina>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/50">{ligaPregunta}</p>
          {liga}
        </Lamina>
      ) : null}
    </div>
  );
}

/** Colores comunes de los desenlaces (fondos de barra: valen en los dos temas). */
export const COLOR_DESENLACE = {
  oro: "#C8A96B",
  mejor: "#1B9E77",
  peor: "#D95F02",
  peorSuave: "#D95F0299",
  remate: tinta(0.45),
  nada: tinta(0.18),
};
