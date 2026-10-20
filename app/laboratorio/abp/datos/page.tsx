"use client";

/**
 * Laboratorio de ABP · El balón parado de cada liga (20/10/2026).
 *
 * Todos los equipos de los dos grupos de Primera RFEF y de la Premier League,
 * con lo que Wyscout trae de balón parado: cuánto se saca, cuánto acaba en
 * remate (por cada 100) y lo mismo en contra. Lee `public/data/abp-ligas.json`
 * (`scripts/abp-ligas.cjs`); la descarga de las ligas que no son la nuestra la
 * hace `scripts/actualizar-abp-ligas.cmd`.
 *
 * Sólo se enseñan las ligas que están bajadas: una liga que no está no se
 * nombra. Cada liga se lee contra sí misma (percentil y puesto dentro de su
 * liga): comparar el número de la Premier con el de Primera RFEF a pelo sería
 * comparar dos fútboles distintos, así que la «referencia Premier» se compara
 * por percentiles.
 */

import { useMemo, useState } from "react";
import { Crosshair, FlaskConical, GitCompareArrows, LineChart, ListOrdered, ScatterChart } from "lucide-react";

import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { AbpHeader, Panel, Segmented, Select } from "@/components/abp/ui";
import { BarraPercentil, BarrasEquipos, Dispersion, Evolucion, type FilaPercentil } from "@/components/data/graficas";
import { Conclusiones, Explicativo } from "@/components/ui/textos-analisis";
import { useAbpLigas, useProximoRival } from "@/hooks/useAbpLigas";
import { formatea } from "@/lib/data-analisis/metricas";

/* «England. Premier League» es como lo escribe Wyscout; en pantalla, en castellano. */
const nombreDeLiga = (competicion: string) =>
  competicion
    .replace(/^Spain\.\s*Primera Division RFEF/i, "Primera RFEF · España")
    .replace(/^England\.\s*Premier League/i, "Premier League · Inglaterra");
import { mismoClub } from "@/lib/rivals/mismoClub";
import {
  METRICA,
  METRICAS_ABP,
  equipoQueCasa,
  partidosDe,
  posicionEn,
  serieDe,
  tablaDe,
  baseDe,
  type FilaLiga,
  type LigaAbp,
  type MetricaAbp,
} from "@/lib/abp-ligas/modelo";

/** Con quién abre cada liga: nosotros en la nuestra; en la Premier, el Arsenal (la referencia de balón parado). */
const ABRE_CON: Record<string, string> = { "primera-rfef-g2": "Castilla", "premier-league": "Arsenal" };

const fila = (tabla: FilaLiga[], equipo: string, m: MetricaAbp): FilaPercentil => {
  const p = posicionEn(tabla, equipo, m);

  return {
    key: m.key,
    nombre: m.nombre,
    unidad: m.unidad,
    mejorAlto: m.mejorAlto,
    valor: p.valor,
    mediana: p.mediana,
    percentil: m.mejorAlto === null ? null : p.percentil,
    puesto: p.puesto,
    deCuantos: p.de,
    comoLeer: m.comoLeer,
  };
};

/**
 * El equipo de la Premier con el balón parado más parecido: la menor
 * distancia entre los percentiles de cada uno contra su liga, en las
 * métricas que se juzgan (no en las de estilo). Es parecido de perfil, no
 * de nivel: un percentil 80 en Primera RFEF no es un percentil 80 en la
 * Premier.
 */
function gemeloEn(tabla: FilaLiga[], equipo: string, tablaPremier: FilaLiga[]) {
  const juzgables = METRICAS_ABP.filter((x) => x.mejorAlto !== null);

  const perfil = (t: FilaLiga[], e: string) => juzgables.map((x) => posicionEn(t, e, x).percentil);

  const mio = perfil(tabla, equipo);

  if (mio.filter((v) => v !== null).length < 4) return null;

  const distancias = tablaPremier
    .map((f) => {
      const suyo = perfil(tablaPremier, f.equipo);

      const pares = mio.map((v, i) => [v, suyo[i]] as const).filter((p): p is readonly [number, number] => p[0] !== null && p[1] !== null);

      return { equipo: f.equipo, d: pares.length >= 4 ? Math.sqrt(pares.reduce((s, [a, b]) => s + (a - b) ** 2, 0) / pares.length) : Infinity };
    })
    .filter((x) => Number.isFinite(x.d))
    .sort((a, b) => a.d - b.d);

  return distancias[0] ?? null;
}

export default function DatosAbpPage() {
  const { datos, fallo } = useAbpLigas();
  const proximo = useProximoRival();
  const [slug, setSlug] = useState("");
  const [elegido, setElegido] = useState("");
  const [metrica, setMetrica] = useState("abpRemF");
  const [referencia, setReferencia] = useState("");

  const ligas = useMemo(() => datos?.ligas ?? [], [datos]);

  const liga: LigaAbp | null = ligas.find((l) => l.slug === slug) ?? ligas[0] ?? null;

  const premier = ligas.find((l) => l.slug === "premier-league") ?? null;

  const tabla = useMemo(() => (liga ? tablaDe(liga) : []), [liga]);

  const tablaPremier = useMemo(() => (premier ? tablaDe(premier) : []), [premier]);

  /* Sin equipo de referencia en esa liga, abre con el que más remata a balón parado: lo interesante, no el primero del abecedario. */
  const elMasPeligroso = [...tabla].sort((a, b) => (b.valores.abpRemF ?? -1) - (a.valores.abpRemF ?? -1))[0]?.equipo ?? "";

  const equipo = liga ? (elegido && liga.equipos.includes(elegido) ? elegido : equipoQueCasa(liga, ABRE_CON[liga.slug] ?? "") || elMasPeligroso || liga.equipos[0]) : "";

  /* El próximo rival sólo se resalta en su liga. */
  const delProximo = liga && proximo ? (liga.equipos.find((e) => mismoClub(e, proximo)) ?? "") : "";

  const comparado = delProximo && delProximo !== equipo ? delProximo : "";

  const ref = premier ? (referencia && premier.equipos.includes(referencia) ? referencia : equipoQueCasa(premier, "Arsenal") || premier.equipos[0]) : "";

  const m = METRICA[metrica] ?? METRICAS_ABP[0];

  const suyos = useMemo(() => (liga ? partidosDe(liga).filter((p) => p.equipo === equipo) : []), [liga, equipo]);

  const filas = useMemo(() => METRICAS_ABP.map((x) => fila(tabla, equipo, x)), [tabla, equipo]);

  /* Lo que dice el vistazo, con los mismos números de las barras. */
  const conclusiones = useMemo(() => {
    const juzgables = filas.filter((f) => f.percentil !== null && f.mejorAlto !== null);

    if (!juzgables.length || !liga) return [];

    const orden = [...juzgables].sort((a, b) => (b.percentil ?? 0) - (a.percentil ?? 0));

    const mejor = orden[0];

    const peor = orden.at(-1)!;

    const dice = (f: FilaPercentil) => `${METRICA[f.key].corto}: ${formatea(f.valor, f.unidad)} (${f.puesto}.º de ${f.deCuantos}; la mediana, ${formatea(f.mediana, f.unidad)})`;

    const remF = filas.find((f) => f.key === "abpRemF");
    const remC = filas.find((f) => f.key === "abpRemC");

    return [
      `${equipo}, en ${liga.nombre} (${suyos.length} partidos): lo mejor, ${dice(mejor)}.`,
      peor !== mejor ? `Lo que más le cuesta, ${dice(peor)}.` : null,
      remF?.valor != null && remC?.valor != null
        ? `Balance de remates a balón parado: ${formatea(remF.valor, "decimal")} a favor y ${formatea(remC.valor, "decimal")} en contra por partido (${remF.valor - remC.valor >= 0 ? "+" : ""}${formatea(remF.valor - remC.valor, "decimal")}).`
        : null,
    ];
  }, [filas, liga, equipo, suyos.length]);

  const puntos = useMemo(
    () =>
      tabla
        .map((f) => ({ equipo: f.equipo, x: f.valores.abpRemF, y: f.valores.abpRemC }))
        .filter((p): p is { equipo: string; x: number; y: number } => p.x !== null && p.y !== null),
    [tabla],
  );

  const serie = useMemo(() => (liga ? serieDe(liga, equipo, m) : []), [liga, equipo, m]);

  const gemelo = useMemo(() => (premier && premier !== liga && equipo ? gemeloEn(tabla, equipo, tablaPremier) : null), [premier, liga, equipo, tabla, tablaPremier]);

  return (
    <main className="min-h-screen bg-[#0B0F14] text-white">
      <div className="flex">
        <Sidebar />

        <section className="flex min-w-0 flex-1 flex-col">
          <Topbar />

          <div className="min-w-0 px-4 py-6 sm:px-6 lg:px-10">
            <AbpHeader
              area="Laboratorio de ABP · Sólo administrador"
              title="El balón parado de cada liga"
              lead="Todos los equipos con lo que Wyscout trae de balón parado: cuánto se saca, cuánto acaba en remate y lo mismo en contra. Cada equipo se lee contra su liga."
              aside={
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#C8A96B]/30 bg-[#C8A96B]/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#C8A96B]">
                  <FlaskConical size={12} />
                  Laboratorio
                </span>
              }
            />

            {fallo && <p className="mt-6 text-sm text-white/60">No se ha podido abrir el fichero de las ligas. Recarga la página.</p>}

            {liga && (
              <>
                <div className="mt-5 flex min-w-0 flex-col gap-3 lg:flex-row lg:items-end">
                  {ligas.length > 1 && (
                    <Segmented ariaLabel="Liga" options={ligas.map((l) => ({ key: l.slug, label: l.nombre }))} value={liga.slug} onChange={(k) => setSlug(k)} />
                  )}

                  <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2 lg:max-w-xl">
                    <Select label="Equipo" value={equipo} options={liga.equipos} onChange={setElegido} />
                    <Select label="Métrica de la clasificación y la tendencia" value={m.key} options={METRICAS_ABP.map((x) => ({ value: x.key, label: x.nombre }))} onChange={setMetrica} />
                  </div>
                </div>

                <p className="mt-2 text-xs text-white/45">
                  {nombreDeLiga(liga.competicion)} · temporada {liga.temporada} · {liga.equipos.length} equipos
                  {comparado ? ` · en azul, el próximo rival (${comparado})` : ""}
                </p>

                <div className="mt-5 grid min-w-0 gap-5 xl:grid-cols-2">
                  {/* --------------------- DE UN VISTAZO --------------------- */}
                  <Panel
                    title={`${equipo} de un vistazo`}
                    subtitle="Percentil contra su liga: a la derecha, mejor (en lo que se concede, menos es mejor)"
                    icon={Crosshair}
                    analisis={<Conclusiones items={conclusiones} />}
                  >
                    <div className="space-y-1">
                      {filas.map((f) => (
                        <BarraPercentil key={f.key} fila={f} otra={comparado ? fila(tabla, comparado, METRICA[f.key]) : null} nombreOtra={comparado} />
                      ))}
                    </div>
                  </Panel>

                  {/* --------------------- CLASIFICACIÓN --------------------- */}
                  <Panel title={m.nombre} subtitle={`Los ${liga.equipos.length} equipos, de mejor a peor`} icon={ListOrdered}>
                    <BarrasEquipos
                      filas={tabla.map((f) => ({ equipo: f.equipo, valor: f.valores[m.key] }))}
                      unidad={m.unidad}
                      mejorAlto={m.mejorAlto}
                      destacado={equipo}
                      comparado={comparado || undefined}
                      alPulsar={setElegido}
                    />
                    <Explicativo>
                      <p className="mt-3 text-xs text-white/50">{m.comoLeer}</p>
                    </Explicativo>
                  </Panel>

                  {/* ----------------------- DISPERSIÓN ---------------------- */}
                  <Panel
                    title="Peligro a favor y en contra"
                    subtitle="Jugadas a balón parado con remate por partido: a la derecha, más a favor; abajo, menos en contra"
                    icon={ScatterChart}
                    className="xl:col-span-2"
                  >
                    <Dispersion
                      puntos={puntos}
                      etiquetaX="Con remate a favor por partido"
                      etiquetaY="Con remate en contra por partido"
                      unidadX="decimal"
                      unidadY="decimal"
                      destacado={equipo}
                      comparado={comparado || undefined}
                      alPulsar={setElegido}
                    />
                  </Panel>

                  {/* ------------------------ TENDENCIA ---------------------- */}
                  <Panel
                    title={`${m.nombre}, partido a partido`}
                    subtitle={`${equipo}: cada punto es un partido; la raya, su valor en la temporada (base: ${formatea(baseDe(suyos, m), "entero")} ${m.denominador === "partidos" ? "partidos" : "acciones"})`}
                    icon={LineChart}
                    className="xl:col-span-2"
                  >
                    <Evolucion serie={serie} unidad={m.unidad} media={posicionEn(tabla, equipo, m).valor} />
                  </Panel>
                  {/* ------------------ CONTRA LA REFERENCIA ----------------- */}
                  {premier && premier !== liga && ref && (
                    <Panel
                      title={`${equipo} frente a ${ref}`}
                      subtitle={`Cada uno contra su liga: ${equipo} en ${liga.nombre}, ${ref} en la Premier League. Se comparan percentiles, no cifras`}
                      icon={GitCompareArrows}
                      className="xl:col-span-2"
                      action={
                        <div className="w-full sm:w-48">
                          <Select label="Referencia Premier" value={ref} options={premier.equipos} onChange={setReferencia} />
                        </div>
                      }
                    >
                      {gemelo && (
                        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#C8A96B]/30 bg-[#C8A96B]/[0.07] px-3.5 py-2.5">
                          <p className="min-w-0 text-[13px] leading-snug text-white/80">
                            <span className="font-semibold text-[#C8A96B]">Su gemelo en la Premier: {gemelo.equipo}.</span> Es el perfil de balón parado más parecido, cada uno contra su liga (de media, a {Math.round(gemelo.d)} puntos de percentil).
                          </p>
                          {gemelo.equipo !== ref && (
                            <button
                              type="button"
                              onClick={() => setReferencia(gemelo.equipo)}
                              className="shrink-0 rounded-lg border border-[#C8A96B]/40 px-2.5 py-1 text-[11.5px] font-semibold text-[#C8A96B] transition hover:bg-[#C8A96B]/10"
                            >
                              Compararlo
                            </button>
                          )}
                        </div>
                      )}
                      <div className="grid gap-x-10 gap-y-1 md:grid-cols-2">
                        {METRICAS_ABP.filter((x) => x.mejorAlto !== null).map((x) => (
                          <BarraPercentil key={x.key} fila={fila(tabla, equipo, x)} otra={fila(tablaPremier, ref, x)} nombreOtra={ref} />
                        ))}
                      </div>
                    </Panel>
                  )}

                </div>
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
