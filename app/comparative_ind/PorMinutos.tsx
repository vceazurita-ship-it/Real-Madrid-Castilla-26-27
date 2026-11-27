"use client";

/*
| RENDIMIENTO POR FRANJA DE MINUTOS (21/11/2026, idea de X)
|
| Cada jugador del Castilla contra los de su puesto de la categoría (la edad
| del grupo elegido) que han jugado lo mismo que él: 60-270′, 270-900′ o más
| de 900′. Así el suplente se mide con suplentes y el titular con titulares.
|
| Al lado del percentil va uno «ajustado», que lo acerca a 50 (la media del
| puesto) cuantos menos minutos tiene: es como sumarle 270′ (tres partidos) de
| un jugador medio. Con 180′ se queda en el 40 % de lo que se separa de 50;
| con 900′, en el 77 %. «Destaca pese a jugar poco» = menos de 900′ y 60 o más
| AJUSTADO: lo que sigue alto después de descontar el ruido.
|
| En centrales sólo cuentan los duelos defensivos y los aéreos ganados (%); en
| el resto, las métricas de su puesto, como el índice de arriba. Si el ajuste
| a la posesión está puesto, llega ya aplicado en `jugadores`.
*/

import { useMemo, useState } from "react";

import { MEJOR, ORO, PEOR, tinta } from "@/components/data/graficas";
import { esNuestro, puestoDe, PUESTOS, type Puesto } from "@/lib/data-analisis/individual";
import type { FilaJugador } from "@/lib/data-analisis/leer";
import { indiceDe, percentilesDe, REFERENCIAS, type Referencia } from "@/lib/comparativa-u21";

type Franja = "corta" | "media" | "larga";

export const FRANJAS: { key: Franja; label: string; min: number; max: number }[] = [
  { key: "corta", label: "60-270′", min: 60, max: 270 },
  { key: "media", label: "270-900′", min: 270, max: 900 },
  { key: "larga", label: "Más de 900′", min: 900, max: Infinity },
];

/** Minutos «de jugador medio» que se le suman para el ajustado: tres partidos. */
export const MINUTOS_PRIOR = 270;
/** Con menos comparables en la franja, se lee como tendencia. */
const FRANJA_CORTA = 10;
/** Ajustado a partir del cual «destaca» de verdad. */
const DESTACA = 60;
/** Percentil bruto alto que el ajuste baja por debajo de DESTACA: muestra corta. */
const BRUTO_ALTO = 65;

const COLUMNAS_CENTRAL = ["Duelos defensivos ganados, %", "Duelos aéreos ganados, %"];

const franjaDe = (minutos: number): Franja | null =>
  FRANJAS.find((f) => minutos >= f.min && minutos < f.max)?.key ?? null;

export const ajustaPorMinutos = (percentil: number, minutos: number) =>
  Math.round(50 + ((percentil - 50) * minutos) / (minutos + MINUTOS_PRIOR));

const color = (v: number) => (v >= DESTACA ? MEJOR : v < 45 ? PEOR : ORO);

type Fila = {
  id: string;
  nombre: string;
  puesto: Puesto;
  minutos: number;
  franja: Franja;
  comparables: number;
  bruto: number;
  ajustado: number;
  metricas: string;
};

export function PorMinutos({
  jugadores,
  refe,
  filtroPuesto,
  nombreDe,
  onAbre,
}: {
  jugadores: FilaJugador[];
  refe: Referencia;
  filtroPuesto: Puesto | "todos";
  nombreDe: (j: FilaJugador) => string;
  onAbre: (id: string) => void;
}) {
  const [franjaSel, setFranjaSel] = useState<Franja | "todas">("todas");

  const { filas, sinFranja, sinComparables } = useMemo(() => {
    const edad = REFERENCIAS.find((r) => r.key === refe)?.edad ?? 21;
    const actuales = jugadores.filter((j) => j.temporada === "actual" && j.minutos > 0);
    const grupos = new Map<string, FilaJugador[]>();
    const grupoDe = (puesto: Puesto, franja: Franja) => {
      const clave = `${puesto}|${franja}`;
      const hecho = grupos.get(clave);
      if (hecho) return hecho;
      const g = actuales.filter(
        (j) => puestoDe(j.posicion) === puesto && franjaDe(j.minutos) === franja && j.edad > 0 && j.edad <= edad,
      );
      grupos.set(clave, g);
      return g;
    };

    const nuestros = actuales.filter(
      (j) => esNuestro(j) && (filtroPuesto === "todos" || puestoDe(j.posicion) === filtroPuesto),
    );
    const salen: Fila[] = [];
    const fuera: string[] = [];
    /* 27/11/2026 (fútbol, ronda 10): quien tiene franja pero no sale (sin
       comparables de su puesto en ella, o sin métricas que medir) se nombra
       debajo con su porqué; antes desaparecía y salían 17 aquí y 19 arriba. */
    const sinComp: string[] = [];
    for (const j of nuestros) {
      const puesto = puestoDe(j.posicion);
      const franja = franjaDe(j.minutos);
      if (!franja) {
        fuera.push(nombreDe(j));
        continue;
      }
      const grupo = grupoDe(puesto, franja);
      const todos = percentilesDe(j, grupo, puesto);
      const usados = puesto === "CEN" ? todos.filter((p) => COLUMNAS_CENTRAL.includes(p.metrica.columna)) : todos;
      const bruto = indiceDe(usados);
      if (bruto === null) {
        sinComp.push(`${nombreDe(j)} (${j.minutos.toLocaleString("es-ES")}′)`);
        continue;
      }
      salen.push({
        id: j.jugador,
        nombre: nombreDe(j),
        puesto,
        minutos: j.minutos,
        franja,
        comparables: grupo.filter((g) => g !== j).length + 1,
        bruto,
        ajustado: ajustaPorMinutos(bruto, j.minutos),
        metricas:
          puesto === "CEN"
            ? usados.map((p) => `${p.metrica.nombre} ${p.percentil}`).join(" · ")
            : `${usados.length} métricas de su puesto`,
      });
    }
    salen.sort((a, b) => b.ajustado - a.ajustado || b.bruto - a.bruto);
    return { filas: salen, sinFranja: fuera, sinComparables: sinComp };
  }, [jugadores, refe, filtroPuesto, nombreDe]);

  const vistas = franjaSel === "todas" ? filas : filas.filter((f) => f.franja === franjaSel);
  const destacan = filas.filter((f) => f.minutos < 900 && f.ajustado >= DESTACA);
  const ruido = filas.filter((f) => f.minutos < 900 && f.bruto >= BRUTO_ALTO && f.ajustado < DESTACA);

  if (!filas.length) return null;

  return (
    <section id="x-idea-2123775341483491446-1" className="mt-5 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
      <h3 className="text-sm font-semibold text-white">
        {/* 27/11/2026 (análisis, ronda 10): la población en el título; cambia respecto al bloque de arriba. */}
        Por minutos jugados, contra los de su puesto con minutos parecidos
        {destacan.length > 0
          ? ` · destacan pese a jugar poco: ${destacan.map((d) => d.nombre).join(", ")}`
          : " · nadie con menos de 900′ pasa de 60 ajustado"}
      </h3>
      <p className="mt-1 text-xs text-white/55">
        Cada uno contra los de su puesto que han jugado lo mismo que él. «Ajustado» acerca el percentil a 50 (la media del
        puesto) cuantos menos minutos tiene, como si sumara {MINUTOS_PRIOR}′ de un jugador medio. En centrales, sólo duelos
        defensivos y aéreos ganados.
      </p>

      <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Franja de minutos">
        {[{ key: "todas" as const, label: "Todas" }, ...FRANJAS].map((f) => {
          const activa = franjaSel === f.key;
          const n = f.key === "todas" ? filas.length : filas.filter((x) => x.franja === f.key).length;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setFranjaSel(f.key)}
              aria-pressed={activa}
              className={`rounded-full border px-3 py-1 text-xs ${
                activa ? "border-[#C8A96B] bg-[#C8A96B]/15 text-white" : "border-white/15 text-white/65 hover:text-white"
              }`}
            >
              {f.label} <span className="text-white/45">({n})</span>
            </button>
          );
        })}
      </div>

      {vistas.length > 0 ? (
        <ul className="mt-3 space-y-1.5">
          {vistas.map((f) => {
            const tendencia = f.comparables < FRANJA_CORTA;
            const esRuido = ruido.includes(f);
            const destaca = destacan.includes(f);
            return (
              <li
                key={f.id}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 text-[13px] sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_auto]"
              >
                <button type="button" onClick={() => onAbre(f.id)} className="min-w-0 text-left hover:text-[#C8A96B]">
                  <span className="block truncate text-white/85">{f.nombre}</span>
                  <span className="block truncate text-[11px] text-white/45">
                    {PUESTOS.find((p) => p.key === f.puesto)?.corto} · {f.minutos.toLocaleString("es-ES")}′ · contra {f.comparables}{" "}
                    de {FRANJAS.find((x) => x.key === f.franja)?.label}
                  </span>
                </button>
                {/* Escala 0-100: hueco = percentil, lleno = ajustado; raya del 50. */}
                <span
                  className="relative order-last col-span-2 block h-3 sm:order-none sm:col-span-1"
                  title={f.metricas}
                  role="img"
                  aria-label={`Percentil ${f.bruto}, ajustado ${f.ajustado}`}
                >
                  <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2" style={{ background: tinta(0.15) }} />
                  <span className="absolute -top-0.5 h-4 w-px" style={{ left: "50%", background: tinta(0.45) }} />
                  <span
                    className="absolute top-1/2 h-px -translate-y-1/2"
                    style={{
                      left: `${Math.min(f.bruto, f.ajustado)}%`,
                      width: `${Math.abs(f.bruto - f.ajustado)}%`,
                      background: tinta(0.35),
                    }}
                  />
                  <span
                    className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
                    style={{ left: `${f.bruto}%`, borderColor: tinta(0.5) }}
                  />
                  <span
                    className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full"
                    style={{ left: `${f.ajustado}%`, background: color(f.ajustado) }}
                  />
                </span>
                <span className="text-right tabular-nums">
                  <span className="text-white/55">{f.bruto}</span>
                  <span className="mx-1 text-white/35">→</span>
                  <b style={{ color: color(f.ajustado) }}>{f.ajustado}</b>
                  {(destaca || esRuido || tendencia) && (
                    <span className="mt-0.5 flex flex-wrap justify-end gap-1">
                      {destaca && (
                        <span className="rounded-full px-1.5 text-[10px] font-semibold" style={{ background: `${MEJOR}26`, color: MEJOR }}>
                          destaca pese a jugar poco
                        </span>
                      )}
                      {esRuido && (
                        <span className="rounded-full bg-amber-400/15 px-1.5 text-[10px] font-semibold text-amber-300">
                          muestra corta
                        </span>
                      )}
                      {tendencia && (
                        <span className="rounded-full px-1.5 text-[10px]" style={{ background: tinta(0.08), color: tinta(0.6) }}>
                          tendencia
                        </span>
                      )}
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-3 text-xs text-white/50">Ninguno de los nuestros está en esta franja.</p>
      )}

      <p className="mt-3 text-[11px] text-white/45">
        Hueco: su percentil en la franja · lleno: el ajustado · raya: 50. «Muestra corta»: {BRUTO_ALTO} o más de percentil
        que, con sus minutos, se queda por debajo de {DESTACA} ajustado. «Tendencia»: menos de {FRANJA_CORTA} en su franja.
        {sinFranja.length > 0 && ` Con menos de 60′ no entran: ${sinFranja.join(", ")}.`}
        {sinComparables.length > 0 &&
          ` Sin comparables de su puesto en su franja (o sin métricas de su puesto en ella), no salen: ${sinComparables.join(", ")}.`}
      </p>
    </section>
  );
}
