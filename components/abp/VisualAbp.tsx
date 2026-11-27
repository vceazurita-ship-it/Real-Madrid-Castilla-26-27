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

import { useState, type ReactNode } from "react";

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
export function tituloDondeAbp(filas: FilaVisualAbp[], unidad: Unidad, exito: ExitoVisual, ambito?: AmbitoMapa, porPeligro = false): string {
  const conZona = filas.filter((f) => f.zona);
  if (conZona.length < 2) return "";
  const porZona = new Map<string, FilaVisualAbp[]>();
  for (const f of conZona) porZona.set(f.zona!, [...(porZona.get(f.zona!) ?? []), f]);
  const orden = [...porZona.entries()].sort((a, b) => b[1].length - a[1].length);
  const [zona, suyas] = orden[0];
  const empateVolumen = Boolean(orden[1] && orden[1][1].length === suyas.length);
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
  /* 17/11/2026 (ronda 20): con la regla del mapa, «de las 53 que caen en el área (43 fuera de las cuatro zonas)». */
  const deCuantas =
    sinSitio > 0
      ? ambito
        ? `${f ? "las" : "los"} ${conZona.length} que ${ambito.dentro} (${sinSitio} ${ambito.fuera})`
        : `${conZona.length} con sitio (${sinSitio} sin zona de caída)`
      : `${conZona.length} ${unidad.varios}`;
  /*
  | 27/11/2026 (jueces, ronda 9): manda el PELIGRO, no el volumen. Si hay al
  | menos 3 que acaban en gol u ocasión con sitio en el campo y una zona se
  | lleva más de las que le tocan por volumen, el titular es esa zona y acaba
  | en la orden («cargar» en ataque, «reforzar» en defensa). Si no, la frase
  | de siempre (volumen y dónde nace lo que importa).
  */
  const exitosZona = conZona.filter((fila) => fila.exito).length;
  if (porPeligro && exitosZona >= 3) {
    const zonasPorPeligro = [...porZona.entries()]
      .map(([nombre, lista]) => ({ nombre, n: lista.length, k: lista.filter((fila) => fila.exito).length }))
      .sort((a, b) => b.k - a.k || a.n - b.n);
    const lider = zonasPorPeligro[0];
    const empate = zonasPorPeligro[1] && zonasPorPeligro[1].k === lider.k;
    const cuotaPeligro = pc(lider.k, exitosZona);
    const cuotaVolumen = pc(lider.n, conZona.length);
    if (!empate && lider.k >= 2 && cuotaPeligro > cuotaVolumen) {
      /*
      | 27/11/2026 (jueces, ronda 11): una base por frase. Primero el peligro
      | («7 de las 15 … salen de ahí»), luego el volumen («y sólo recibe 18 de
      | las 57 que caen en el área»), y por qué la base del peligro es menor que
      | la de la conclusión (las que caen fuera de las zonas). Con menos de 15,
      | «tendencia» delante y sin orden.
      */
      const fuera = total - exitosZona;
      const tendencia = exitosZona < MUESTRA_HALLAZGO;
      const orden = tendencia ? (exito.mejorAlto ? "vigilar si se confirma" : "vigilarla") : exito.mejorAlto ? "cargarla más" : "reforzar esa zona";
      const dentro = ambito ? `${f ? "las" : "los"} ${conZona.length} que ${ambito.dentro}` : `${conZona.length} ${unidad.varios} con sitio`;
      return `${tendencia ? "Tendencia · " : ""}${mayuscula(lider.nombre)}: ${lider.k} de ${f ? "las" : "los"} ${exitosZona} que ${exito.varios} salen de ahí${
        fuera > 0 ? ` (${f ? "las otras" : "los otros"} ${fuera} caen fuera de las zonas)` : ""
      }, y recibe ${lider.n} de ${dentro} (${cuotaVolumen} %) → ${orden}`;
    }
  }
  if (empateVolumen) return "";
  return `${mayuscula(zona)} concentra ${suyas.length} de ${deCuantas}, el ${pc(suyas.length, conZona.length)} %${nace}`;
}

export type Unidad = { uno: string; varios: string; genero: "f" | "m" };

/** Cómo se dice la base del campo: «caen en el área» / «fuera de las cuatro zonas». */
export type AmbitoMapa = { dentro: string; fuera: string };

/** Por debajo, una cifra es tendencia y no hallazgo (la misma regla que las tarjetas). */
export const MUESTRA_HALLAZGO = 15;

/** Barra apilada al 100 %, con la leyenda y las cifras debajo. */
export function BarraReparto({
  filas,
  categorias,
  rotulosFuera = false,
  compacta = false,
}: {
  filas: FilaVisualAbp[];
  categorias: CategoriaVisual[];
  /** 20/11/2026 (ronda 7, ABP ofensivo): los tramos que no caben en la barra (1 de 94) llevan su rótulo encima. */
  rotulosFuera?: boolean;
  /**
   * 27/11/2026 (jueces, ronda 11, ABP ofensivo): las cifras dentro de la barra
   * (con el nombre donde cabe) y, debajo, sólo una línea de colores: la lista
   * de cuatro filas repetía lo de la barra y empujaba la conclusión.
   */
  compacta?: boolean;
}) {
  const total = filas.length;
  const tramos = categorias.map((c) => ({ ...c, n: filas.filter((f) => f.cat === c.clave).length })).filter((c) => c.n > 0);
  const pequenos = rotulosFuera
    ? tramos.flatMap((t, i) => {
        const inicio = tramos.slice(0, i).reduce((a, x) => a + x.n / total, 0);
        return t.n / total < 0.035 ? [{ ...t, centro: (inicio + t.n / total / 2) * 100 }] : [];
      })
    : [];
  return (
    <div className="min-w-0">
      {pequenos.length ? (
        <div className="relative mb-1 h-4" aria-hidden>
          {pequenos.map((t) => (
            <span
              key={t.clave}
              className="absolute bottom-0 flex items-center gap-1 whitespace-nowrap text-[11px] font-semibold tabular-nums text-white/85"
              style={t.centro < 50 ? { left: `max(0px, calc(${t.centro}% - 4px))` } : { right: `max(0px, calc(${100 - t.centro}% - 4px))` }}
            >
              <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: t.color }} />
              {/* 27/11/2026 (jueces, ronda 11): con su % y, si son 3 o menos, «tendencia», como en la tarjeta de goles. */}
              {t.rotulo} · {t.n} · {pc(t.n, total)} %{t.n <= 3 ? " · tendencia" : ""} ↓
            </span>
          ))}
        </div>
      ) : null}
      <div className={`flex ${compacta ? "h-10" : "h-9"} w-full overflow-hidden rounded-lg`} role="img" aria-label={tramos.map((t) => `${t.rotulo}: ${t.n}`).join(", ")}>
        {tramos.map((t) => {
          const cuota = t.n / total;
          return (
            <div
              key={t.clave}
              className={`flex h-full min-w-0 items-center justify-center overflow-hidden px-1 font-bold tabular-nums ${compacta ? "text-[12px]" : "text-[11px]"}`}
              style={{ width: `${cuota * 100}%`, background: t.color, color: t.color.startsWith("#") ? "#0B0F14" : "rgb(var(--rmcf-ink-rgb))" }}
              title={`${t.rotulo}: ${t.n} de ${total}`}
            >
              {compacta && cuota >= 0.2 ? (
                <span className="min-w-0 whitespace-nowrap">
                  {/* El nombre sólo donde cabe (en el ordenador); en el móvil y la tableta lo da la línea de colores. */}
                  <span className="hidden lg:inline">{t.rotulo} · </span>
                  {t.n} ({pc(t.n, total)} %)
                </span>
              ) : compacta && cuota >= 0.1 ? (
                `${t.n} · ${pc(t.n, total)} %`
              ) : cuota >= 0.035 ? (
                t.n
              ) : (
                ""
              )}
            </div>
          );
        })}
      </div>
      {compacta ? (
        <p className="mt-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-white/70">
          {tramos.map((t) => (
            <span key={t.clave} className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: t.color }} aria-hidden />
              {t.rotulo}
            </span>
          ))}
        </p>
      ) : (
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
      )}
    </div>
  );
}

type Partido = { jornada: JornadaAbp; filas: FilaVisualAbp[] };

/** Una columna apilada por partido, en orden de calendario. */
function ColumnasJornada({ partidos, categorias, exito, marca }: { partidos: Partido[]; categorias: CategoriaVisual[]; exito: ExitoVisual; marca?: string | null }) {
  const tope = Math.max(...partidos.map((p) => p.filas.length), 1);
  /* 17/11/2026 (jueces, ronda 20): la media por partido, como raya de referencia. */
  const mediaN = partidos.length >= 3 ? partidos.reduce((a, p) => a + p.filas.length, 0) / partidos.length : null;
  return (
    <div className="min-w-0 overflow-x-auto">
      <div className="relative flex h-44 items-end gap-1.5" style={{ minWidth: partidos.length * 26 }}>
        {mediaN !== null ? (
          <span
            className="pointer-events-none absolute inset-x-0 border-t border-dashed"
            style={{ bottom: `${(mediaN / tope) * 100 * 0.88}%`, borderColor: "rgb(var(--rmcf-ink-rgb) / .45)" }}
            aria-hidden
          />
        ) : null}
        {partidos.map((p) => {
          const n = p.filas.length;
          const exitos = p.filas.filter((f) => f.exito).length;
          const marcada = marca === p.jornada.clave;
          return (
            <div key={p.jornada.clave} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end" title={`${p.jornada.etiqueta}: ${n} · ${exitos} de ${n}`}>
              <span className={`mb-1 text-[11px] tabular-nums ${marcada ? "font-bold" : "text-white/60"}`} style={marcada ? { color: "var(--rmcf-gold-ink)" } : undefined}>
                {`${exitos}/${n}`}
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
      <p className="mt-2 text-[12px] leading-snug text-white/60">
        Encima de cada columna, «a/b»: las que {exito.varios} (a) de las del partido (b). Orden de calendario.
        {mediaN !== null ? ` Raya discontinua: la media de acciones por partido, ${mediaN.toLocaleString("es-ES", { maximumFractionDigits: 1 })} (la altura de cada columna es su número de acciones).` : ""}
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
    /*
    | 17/11/2026 (jueces, ronda 20): ¿supera la variación habitual? Se compara
    | con la desviación de partido a partido de antes; si no la pasa, se dice
    | «tendencia, dentro de lo habitual».
    */
    const tasas = antes.filter((p) => p.filas.length).map((p) => pc(p.filas.filter((f) => f.exito).length, p.filas.length));
    const media = tasas.reduce((a2, b2) => a2 + b2, 0) / Math.max(1, tasas.length);
    const desviacion = tasas.length >= 2 ? Math.sqrt(tasas.reduce((a2, t) => a2 + (t - media) ** 2, 0) / (tasas.length - 1)) : 0;
    const sentido = (dif > 0) === exito.mejorAlto ? "a mejor" : "a peor";
    const juicio =
      Math.abs(dif) < 5
        ? "se mantiene"
        : desviacion && Math.abs(dif) < desviacion
          ? `tendencia ${sentido}, dentro de lo que varía de un partido a otro (±${Math.round(desviacion)} puntos)`
          : `va ${sentido}`;
    return `En los 3 últimos partidos, ${pu} % ${exito.varios} (${u.k} de ${u.n}); antes, ${pa} %: ${juicio}`;
  }
  const mejor = [...partidos]
    .filter((p) => p.filas.length)
    .sort((x, y) => (exito.mejorAlto ? 1 : -1) * (pc(y.filas.filter((f) => f.exito).length, y.filas.length) - pc(x.filas.filter((f) => f.exito).length, x.filas.length)))[0];
  if (!mejor) return "";
  const k = mejor.filas.filter((f) => f.exito).length;
  return `${partidos.length} partidos; el mejor, ${mejor.jornada.etiqueta}: ${k} de ${mejor.filas.length} ${unidad.varios} ${k === 1 ? exito.uno : exito.varios}`;
}

/**
 * Los tipos con su lista, del que más tiene al que menos. 17/11/2026 (jueces,
 * ronda 20): los que sólo tienen 1 o 2 acciones van juntos en «otras», al final.
 */
function gruposPorTipo(filas: FilaVisualAbp[]): [string, FilaVisualAbp[]][] {
  const grupos = new Map<string, FilaVisualAbp[]>();
  for (const f of filas) if (f.tipo) grupos.set(f.tipo, [...(grupos.get(f.tipo) ?? []), f]);
  const orden = [...grupos.entries()].sort((a, b) => b[1].length - a[1].length);
  const sueltos = orden.filter(([, fs]) => fs.length <= 2);
  if (sueltos.length < 2) return orden;
  return [...orden.filter(([, fs]) => fs.length > 2), [`otras (${sueltos.length} tipos)`, sueltos.flatMap(([, fs]) => fs)]];
}

/** Una barra apilada por tipo, del que más tiene al que menos, y cuál rinde (o duele) más. */
/* 20/11/2026 (jueces, ronda 8): por debajo de 10 acciones, la fila va atenuada: poca muestra para leerla sola. */
const MUESTRA_FILA_TIPO = 10;

function PorTipo({ filas, categorias }: { filas: FilaVisualAbp[]; categorias: CategoriaVisual[] }) {
  const orden = gruposPorTipo(filas);
  const tope = Math.max(...orden.map(([, fs]) => fs.length), 1);
  const hayPocas = orden.some(([, fs]) => fs.length < MUESTRA_FILA_TIPO);
  return (
    <>
    <ul className="min-w-0 space-y-2">
      {orden.map(([tipo, fs]) => {
        const k = fs.filter((f) => f.exito).length;
        const pocas = fs.length < MUESTRA_FILA_TIPO;
        return (
          <li key={tipo} className={`min-w-0 ${pocas ? "opacity-50" : ""}`} title={pocas ? `Sólo ${fs.length} ${fs.length === 1 ? "acción" : "acciones"}: poca muestra` : undefined}>
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
    {hayPocas ? (
      <p className="mt-2 text-[12px] text-white/60">Atenuados, los tipos con menos de {MUESTRA_FILA_TIPO} acciones: poca muestra para sacar conclusiones.</p>
    ) : null}
    </>
  );
}

/*
| 17/11/2026 (jueces, ronda 20): el titular no puede elegir un tipo con menos
| de 15 acciones («falta indirecta en zona 4, 3 de 3»): sólo se elige entre los
| que tienen muestra; si ninguno la tiene, se dice «tendencia».
*/
function tituloTipo(filas: FilaVisualAbp[], exito: ExitoVisual, frenteAlResto = false): string {
  const grupos = gruposPorTipo(filas).filter(([t]) => !t.startsWith("otras ("));
  if (grupos.length < 2) return "";
  const tasa = (fs: FilaVisualAbp[]) => fs.filter((f) => f.exito).length / fs.length;
  const conMuestra = grupos.filter(([, fs]) => fs.length >= MUESTRA_HALLAZGO);
  /*
  | 27/11/2026 (jueces, ronda 10, ABP): si sólo un tipo tiene muestra, «lo que
  | más rinde» no compara nada: ese tipo frente al resto, como la conclusión.
  | Sólo en las pantallas que lo piden (frenteAlResto).
  */
  if (frenteAlResto && conMuestra.length === 1) {
    const [tipo, fs] = conMuestra[0];
    const resto = filas.filter((f) => f.tipo && !fs.includes(f));
    if (resto.length) {
      const k = fs.filter((f) => f.exito).length;
      const kR = resto.filter((f) => f.exito).length;
      const p = pc(k, fs.length);
      const pR = pc(kR, resto.length);
      const lado = p === pR ? "igual que" : p > pR ? "por encima del" : "por debajo del";
      return `${mayuscula(tipo.toLowerCase())}, el único tipo con muestra: ${k} de ${fs.length} (${p} %) ${exito.varios}, ${lado} ${pR} % del resto (${kR} de ${resto.length}${resto.length < MUESTRA_HALLAZGO ? ", tendencia" : ""})`;
    }
  }
  const elegido = [...conMuestra].sort((a, b) => tasa(b[1]) - tasa(a[1]))[0];
  const que = exito.mejorAlto ? "Lo que más rinde" : "Lo que más peligro da";
  if (elegido && tasa(elegido[1]) > 0) {
    const [tipo, fs] = elegido;
    const k = fs.filter((f) => f.exito).length;
    return `${que}: ${tipo.toLowerCase()}, ${k} de ${fs.length} ${k === 1 ? exito.uno : exito.varios} (${pc(k, fs.length)} %)`;
  }
  const mayor = grupos[0];
  const kM = mayor[1].filter((f) => f.exito).length;
  const conTres = grupos.filter(([, fs]) => fs.length >= 3).sort((a, b) => tasa(b[1]) - tasa(a[1]))[0];
  if (!elegido && conTres && tasa(conTres[1]) > 0) {
    const k = conTres[1].filter((f) => f.exito).length;
    return `Tendencia, pocas acciones por tipo: ${conTres[0].toLowerCase()}, ${k} de ${conTres[1].length} ${k === 1 ? exito.uno : exito.varios}`;
  }
  return `Lo más repetido: ${mayor[0].toLowerCase()}, ${mayor[1].length} de ${filas.filter((f) => f.tipo).length} (${kM} ${kM === 1 ? exito.uno : exito.varios})`;
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
  /** 17/11/2026 (ronda 20): la fila clave, que va la primera y destacada; con ella, el resto se pliega. */
  destacada?: string;
  /** 20/11/2026 (jueces, ronda 4): filas que van siempre a la vista, aunque no se juzguen mejor o peor. */
  aLaVista?: string[];
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

/*
| 17/11/2026 (jueces, ronda 20): «seis filas con el mismo peso». Con una fila
| clave, va la primera y en grande; a la vista, además, las que se juzgan
| mejor o peor; el resto, a un toque.
*/
function ComparativaBarras({ filas, destacada, siempre = [] }: { filas: FilaComparada[]; destacada?: string; siempre?: string[] }) {
  const [todas, setTodas] = useState(false);
  const clave = destacada ? filas.find((f) => f.m.clave === destacada) : undefined;
  const ordenadas = clave ? [clave, ...filas.filter((f) => f !== clave)] : filas;
  const aLaVista = clave ? ordenadas.filter((f, i) => i === 0 || f.juicio === "mejor" || f.juicio === "peor" || siempre.includes(f.m.clave)) : ordenadas;
  const vistas = todas || aLaVista.length >= ordenadas.length - 1 ? ordenadas : aLaVista;
  const ocultas = ordenadas.length - vistas.length;
  return (
    <>
    <ul className="min-w-0 space-y-3.5">
      {vistas.map(({ m, juicio }) => {
        const esClave = clave?.m.clave === m.clave;
        const fmt = m.formato ?? numeroCorto;
        const pct = fmt === formatoPorcentaje;
        const actual = m.actual ?? 0;
        const media = m.media ?? 0;
        const tope = Math.max(actual, media, m.rango?.[1] ?? 0, pct ? 10 : 1) * 1.08;
        const x = (v: number) => Math.max(0, Math.min(100, (v / tope) * 100));
        const color = juicio && COLOR_JUICIO[juicio] ? COLOR_JUICIO[juicio] : ORO_PUNTO;
        const rango = m.rango && m.rango[0] !== m.rango[1] && !(pct && m.rango[0] <= 0 && m.rango[1] >= 100) ? m.rango : null;
        /* 17/11/2026 (ronda 20): con su unidad, que cambia de fila a fila («0 de 3 llegadas a último tercio»). */
        /* 27/11/2026 (ronda 11): con «n de de», la base ya va junto al valor; aquí sólo la de «de N acciones». */
        const base = m.de !== undefined && m.n === undefined ? `de ${m.de} ${m.unidad ?? "acciones"}` : "";
        return (
          <li key={m.clave} className={`min-w-0 ${esClave ? "rounded-xl px-3 py-2.5" : ""}`} style={esClave ? { background: "rgb(var(--rmcf-ink-rgb) / .045)" } : undefined}>
            <div className={`flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 ${esClave ? "text-[14px] font-semibold" : "text-[12px]"}`}>
              <span className="min-w-0 text-white/85">
                {m.nombre}
                {m.mejorAlto === true ? <span className="text-white/50"> · ▲ más es mejor</span> : m.mejorAlto === false ? <span className="text-white/50"> · ▼ menos es mejor</span> : null}
              </span>
              <span className="min-w-0 tabular-nums">
                <span className="text-[13px] font-bold" style={{ color: juicio === "mejor" || juicio === "peor" ? color : "var(--rmcf-gold-ink)" }}>
                  {fmt(actual)}
                </span>
                {/* 27/11/2026 (jueces, ronda 11): la base del partido, en la misma línea que el valor («18,2 % (4 de 22)»). */}
                {m.de !== undefined && m.n !== undefined ? (
                  <span className="text-white/60">
                    {" "}
                    ({m.n} de {m.de}
                    {m.unidad ? ` ${m.unidad}` : ""})
                  </span>
                ) : null}
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
              <p className="mt-1 text-[12px] text-white/60">
                {[rango ? `${pct ? "" : "por partido · "}antes, de ${fmt(rango[0])} a ${fmt(rango[1])}` : "", base ? `este partido, ${base}` : ""].filter(Boolean).join(" · ")}
              </p>
            ) : null}
          </li>
        );
      })}
    </ul>
    {ocultas > 0 || todas ? (
      <button
        type="button"
        onClick={() => setTodas((t) => !t)}
        aria-expanded={todas}
        className="mt-3 inline-flex min-h-9 items-center rounded-full border border-white/10 px-3 py-1 text-[12px] font-semibold text-white/75 hover:bg-white/[0.05]"
      >
        {todas ? "Menos" : `${ocultas === 1 ? "Una cifra más" : `${ocultas} cifras más`}`}
      </button>
    ) : null}
    </>
  );
}

function LeyendaComparativa() {
  return (
    <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-white/60">
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
  frente,
  comparativa,
  acciones,
  marca,
  repartoArriba = false,
  tipoFrenteAlResto = false,
  tendenciaEnUnaLinea = false,
}: {
  filas: FilaVisualAbp[];
  categorias: CategoriaVisual[];
  unidad: Unidad;
  exito: ExitoVisual;
  fuente: string;
  /** El campograma de la pantalla (si lo hay) con su pregunta. */
  /** `porPeligro` (27/11/2026): el titular del campo lo manda la zona de más peligro, no la de más volumen. */
  mapa?: { pregunta: string; nodo: ReactNode; ambito?: AmbitoMapa; porPeligro?: boolean } | null;
  /** El bloque de la categoría (Opta). */
  liga?: ReactNode;
  ligaPregunta?: string;
  /** 22/11/2026: el Castilla frente al rival o rivales que se elijan (components/analisis/FrenteAlRival.tsx). */
  frente?: ReactNode;
  /** Este partido frente a la media de los anteriores (la tabla de «Detalle», en barras). */
  comparativa?: ComparativaVisualDatos | null;
  /** La lista de acciones con su vídeo, bajo el campo. */
  acciones?: { titulo: string; nodo: ReactNode } | null;
  /** 17/11/2026 (ronda 19): la jornada que se marca en oro sobre la temporada. */
  marca?: string | null;
  /** «¿Cómo acaban?» ya va en la conclusión de arriba: aquí no se repite. */
  repartoArriba?: boolean;
  /** 27/11/2026 (ronda 10): con un solo tipo con muestra, «¿Qué hace más daño?» lo compara con el resto. */
  tipoFrenteAlResto?: boolean;
  /** 27/11/2026 (ronda 11, ABP ofensivo): «¿Va a mejor?» sin las columnas (la pantalla ya pinta el partido a partido arriba). */
  tendenciaEnUnaLinea?: boolean;
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
  const tituloMapa = mapa ? tituloDondeAbp(filas, unidad, exito, mapa.ambito, mapa.porPeligro) : "";
  const tituloTipos = tituloTipo(filas, exito, tipoFrenteAlResto);

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
          <ComparativaBarras filas={filasComparadas} destacada={comparativa.destacada} siempre={comparativa.aLaVista} />
          <LeyendaComparativa />
        </Lamina>
      ) : null}
      {frente}
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
            {/* 27/11/2026 (jueces, ronda 11): con el gráfico de partido a partido ya arriba, aquí sólo la tendencia en una línea. */}
            {tendenciaEnUnaLinea ? null : <ColumnasJornada partidos={partidos} categorias={categorias} exito={exito} marca={marca} />}
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
