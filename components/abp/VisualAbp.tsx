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
| Láminas, cada una con su conclusión en el título:
| 1. Cómo acaban: una barra apilada con el reparto de desenlaces.
| 2. Jornada a jornada: una columna apilada por partido, en orden de
|    calendario (pretemporada antes que liga), y si va a mejor o a peor.
| 3. Dónde: el campograma que ya tiene la pantalla, con su conclusión.
| 4. La categoría: el bloque de Opta de la pantalla.
| Lo que no tiene dato no sale.
*/

import type { ReactNode } from "react";

import { Lamina, TituloConclusion } from "@/components/ui/VistaVisual";
import { tinta } from "@/components/data/graficas";
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
  return `${mayuscula(zona)} concentra ${suyas.length} de ${conZona.length} ${unidad.varios} (${pc(suyas.length, conZona.length)} %)${nace}`;
}

export type Unidad = { uno: string; varios: string; genero: "f" | "m" };

/** Barra apilada al 100 %, con la leyenda y las cifras debajo. */
function BarraReparto({ filas, categorias }: { filas: FilaVisualAbp[]; categorias: CategoriaVisual[] }) {
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
function ColumnasJornada({ partidos, categorias, exito }: { partidos: Partido[]; categorias: CategoriaVisual[]; exito: ExitoVisual }) {
  const tope = Math.max(...partidos.map((p) => p.filas.length), 1);
  return (
    <div className="min-w-0 overflow-x-auto">
      <div className="flex h-44 items-end gap-1.5" style={{ minWidth: partidos.length * 26 }}>
        {partidos.map((p) => {
          const n = p.filas.length;
          const exitos = p.filas.filter((f) => f.exito).length;
          return (
            <div key={p.jornada.clave} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end" title={`${p.jornada.etiqueta}: ${n} · ${exitos} de ${n}`}>
              <span className="mb-1 text-[10px] tabular-nums text-white/60">{exitos ? `${exitos}/${n}` : n}</span>
              <div className="flex w-full max-w-[34px] flex-col-reverse overflow-hidden rounded-t-[4px]" style={{ height: `${(n / tope) * 100}%` }}>
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
          <span key={p.jornada.clave} className="min-w-0 flex-1 truncate text-center text-[10px] text-white/55">
            {p.jornada.corto}
          </span>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-white/50">Encima de cada columna, las que {exito.varios} sobre el total del partido. Orden de calendario.</p>
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

export function VisualAbp({
  filas,
  categorias,
  unidad,
  exito,
  fuente,
  mapa,
  liga,
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

  return (
    <div className="mt-5 min-w-0 space-y-4">
      <div className="grid min-w-0 gap-4 xl:grid-cols-2">
        <Lamina>
          <TituloConclusion pregunta="¿Cómo acaban?" fuente={fuente}>
            {tituloReparto}
          </TituloConclusion>
          <BarraReparto filas={filas} categorias={categorias} />
        </Lamina>
        {tituloJornadas ? (
          <Lamina>
            <TituloConclusion pregunta="¿Va a mejor?" fuente={`${partidos.length} partidos con estos filtros`}>
              {tituloJornadas}
            </TituloConclusion>
            <ColumnasJornada partidos={partidos} categorias={categorias} exito={exito} />
          </Lamina>
        ) : null}
      </div>
      {mapa ? (
        <Lamina>
          <TituloConclusion pregunta={mapa.pregunta} fuente={fuente}>
            {tituloMapa || `${total} ${total === 1 ? unidad.uno : unidad.varios} en el campo`}
          </TituloConclusion>
          {mapa.nodo}
        </Lamina>
      ) : null}
      {liga ? (
        <Lamina>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/50">¿Y frente a la categoría?</p>
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
