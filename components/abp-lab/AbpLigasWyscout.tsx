"use client";

/**
 * ABP en datos · Ligas (Wyscout) — antes Laboratorio de ABP · El balón parado de cada liga (20/10/2026).
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
 *
 * 25/11/2026 («mucho más visual, con todos los escudos»): cabecera con el
 * escudo del equipo y sus cifras de peligro (a favor, en contra, balance y
 * puesto), «La liga, escudo a escudo» (una tarjeta por equipo con sus dos
 * barras, ordenada por el balance) y la comparación con la Premier escudo
 * contra escudo. Los números son los mismos de antes.
 */

import { useMemo, useState } from "react";
import { Crosshair, GitCompareArrows, LayoutGrid, LineChart, ListOrdered, ScatterChart } from "lucide-react";

import { Panel, Segmented, Select } from "@/components/abp/ui";
import { BarrasEquipos, COMPARADO, Evolucion, MEJOR, PEOR, tinta, useEscudos, type FilaPercentil } from "@/components/data/graficas";
import { CORAL, Cuadrante, Escudo, HeroVersus, LeyendaPista, ORO_MARCA, PistaPercentil, type KpiVersus } from "@/components/abp-lab/visual";
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
 * Una métrica del vistazo (25/11/2026): la misma información que la
 * `BarraPercentil` de DATA —nombre, valor, mediana de la liga, puesto,
 * percentil y el otro equipo en azul— pero con la pista fina de esta
 * pantalla (punto en el percentil, raya azul del otro), en vez de la barra
 * gruesa que salía del centro.
 */
function FilaVistazo({ fila: f, otra, nombreOtra, punto }: { fila: FilaPercentil; otra?: FilaPercentil | null; nombreOtra?: string; punto: string }) {
  const [abierta, setAbierta] = useState(false);
  const estilo = f.mejorAlto === null;
  const sentido =
    f.mejorAlto === false
      ? "Menos es mejor: la pista ya está dada la vuelta, a la derecha sigue siendo mejor."
      : estilo
        ? "Es estilo, no rendimiento: no hay mejor ni peor."
        : "Más es mejor.";
  return (
    <div className="min-w-0 border-b border-white/[0.06] py-2 last:border-0">
      <div className="flex min-w-0 items-baseline gap-2">
        <button
          type="button"
          onClick={() => setAbierta(!abierta)}
          aria-expanded={abierta}
          title="Pulsa para ver qué mide y cómo se lee"
          className="line-clamp-2 min-w-0 flex-1 text-left text-[12.5px] leading-snug text-white/80 underline decoration-dotted underline-offset-4 transition hover:text-white"
        >
          {f.nombre}
          {f.mejorAlto === false && <span className="ml-1.5 inline-block text-[10px] font-normal text-white/45">(menos es mejor)</span>}
          {estilo && <span className="ml-1.5 inline-block text-[10px] font-normal text-white/45">(estilo)</span>}
        </button>
        <span className="shrink-0 text-[13px] font-semibold tabular-nums text-white">{formatea(f.valor, f.unidad)}</span>
        <span className="w-[4.5rem] shrink-0 text-right text-[11px] tabular-nums text-white/40" title={`Mediana de los ${f.deCuantos} equipos de la liga`}>
          liga {formatea(f.mediana, f.unidad)}
        </span>
      </div>
      <div className="mt-1">
        <PistaPercentil
          p={f.percentil}
          puesto={f.puesto}
          de={f.deCuantos}
          estilo={estilo}
          punto={punto}
          rival={otra?.percentil ?? null}
          tituloRival={otra && nombreOtra ? `${nombreOtra}: ${otra.puesto ?? ""}º de ${otra.deCuantos}${otra.percentil != null ? ` (P${Math.round(otra.percentil)})` : ""}` : undefined}
        />
      </div>
      {otra && (
        <p className="mt-0.5 flex min-w-0 items-baseline gap-2 text-[11px] tabular-nums" style={{ color: COMPARADO }}>
          <span className="min-w-0 flex-1 truncate">{nombreOtra}</span>
          <span className="shrink-0 font-semibold">{formatea(otra.valor, otra.unidad)}</span>
          <span className="w-12 shrink-0 text-right">{otra.puesto ? `${otra.puesto}º/${otra.deCuantos}` : ""}</span>
          <span className="w-8 shrink-0 text-right text-white/45">{otra.percentil === null ? "" : `P${Math.round(otra.percentil)}`}</span>
        </p>
      )}
      {abierta && (
        <p className="mt-1.5 text-[11px] leading-relaxed text-white/50">
          {f.comoLeer} <span className="text-white/65">{sentido}</span>
        </p>
      )}
    </div>
  );
}

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

/** Pestaña «Ligas · Wyscout» de /abp-datos (antes /laboratorio/abp/datos, sólo admin; 25/11/2026 a la vista del staff). */
export function AbpLigasWyscout() {
  const { datos, fallo } = useAbpLigas();
  const proximo = useProximoRival();
  const escudoDe = useEscudos();
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
        .filter((f) => f.valores.abpRemF !== null && f.valores.abpRemC !== null)
        .map((f) => ({ id: f.equipo, equipo: f.equipo, x: f.valores.abpRemF as number, y: f.valores.abpRemC as number, escudo: escudoDe(f.equipo) })),
    [tabla, escudoDe],
  );

  const serie = useMemo(() => (liga ? serieDe(liga, equipo, m) : []), [liga, equipo, m]);

  const gemelo = useMemo(() => (premier && premier !== liga && equipo ? gemeloEn(tabla, equipo, tablaPremier) : null), [premier, liga, equipo, tabla, tablaPremier]);

  /* La liga, escudo a escudo: ABP con remate a favor y en contra por partido, ordenada por el balance. */
  const mosaico = useMemo(
    () =>
      tabla
        .map((f) => ({ equipo: f.equipo, favor: f.valores.abpRemF, contra: f.valores.abpRemC }))
        .filter((x): x is { equipo: string; favor: number; contra: number } => x.favor !== null && x.contra !== null)
        .sort((a, b) => b.favor - b.contra - (a.favor - a.contra)),
    [tabla],
  );

  const topeMosaico = Math.max(...mosaico.flatMap((x) => [x.favor, x.contra]), 0.01);

  /* Nosotros, sólo en nuestra liga. */
  const castilla = liga ? equipoQueCasa(liga, "Castilla") : "";

  const posF = posicionEn(tabla, equipo, METRICA.abpRemF);
  const posC = posicionEn(tabla, equipo, METRICA.abpRemC);
  const balance = posF.valor !== null && posC.valor !== null ? posF.valor - posC.valor : null;
  const iBalance = mosaico.findIndex((x) => x.equipo === equipo);
  /* Las cuatro cifras del héroe, con la misma cuenta que el vistazo (percentil y puesto en su liga). */
  const kpisHero: KpiVersus[] = (["abpRemF", "abpRemC", "abpPctF", "abpPctC"] as const)
    .map((k) => METRICA[k])
    .filter((x): x is MetricaAbp => !!x)
    .map((x) => {
      const mio = posicionEn(tabla, equipo, x);
      const suyo = comparado ? posicionEn(tabla, comparado, x) : null;
      return {
        rotulo: x.nombre.replace(/ por partido$/, "").replace(/ \(por cada 100\)$/, ""),
        nota: [x.denominador === "partidos" ? "por partido" : "de cada 100", x.mejorAlto === false ? "menos es mejor" : ""].filter(Boolean).join(", "),
        valor: formatea(mio.valor, x.unidad),
        p: mio.percentil,
        detalle: `${mio.puesto ? `${mio.puesto}.º de ${mio.de}` : ""}${mio.mediana !== null ? ` · mediana ${formatea(mio.mediana, x.unidad)}` : ""}`,
        rival: suyo && suyo.valor !== null ? { valor: formatea(suyo.valor, x.unidad), p: suyo.percentil, detalle: `${comparado}${suyo.puesto ? `: ${suyo.puesto}.º` : ""}` } : null,
      };
    });

  /* El punto del equipo que se mira: oro si es el Castilla; si no, tinta. */
  const puntoEquipo = castilla && equipo === castilla ? ORO_MARCA : tinta(0.8);

  return (
    <div className="min-w-0">
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

                {/* ------------------ EL HÉROE · VERSUS (25/11) ------------------ */}
                <div id="lig-resumen" className="mt-4">
                  <HeroVersus
                    etiqueta={`${liga.nombre} · Wyscout · ${suyos.length} partidos`}
                    nombre={equipo}
                    escudo={escudoDe(equipo)}
                    acento={castilla && equipo === castilla ? ORO_MARCA : COMPARADO}
                    sub={
                      balance !== null ? (
                        <>
                          Balance de ABP con remate{" "}
                          <span className="font-semibold tabular-nums" style={{ color: balance >= 0 ? MEJOR : PEOR }}>
                            {balance >= 0 ? "+" : ""}
                            {formatea(balance, "decimal")}
                          </span>{" "}
                          por partido{iBalance >= 0 ? ` · ${iBalance + 1}.º de ${mosaico.length}` : ""}
                        </>
                      ) : undefined
                    }
                    rival={comparado ? { nombre: comparado, escudo: escudoDe(comparado), sub: "pulsa para mirarlo" } : null}
                    alPulsarRival={comparado ? () => setElegido(comparado) : undefined}
                    kpis={kpisHero}
                  />
                </div>

                <div className="mt-5 grid min-w-0 items-start gap-5 xl:grid-cols-2">
                  {/* --------------------- DE UN VISTAZO --------------------- */}
                  <Panel
                    id="lig-vistazo"
                    title={`${equipo} de un vistazo`}
                    subtitle="Qué mirar: dónde cae el punto frente a la raya central (la mediana de su liga) y frente a la raya azul del rival"
                    icon={Crosshair}
                    analisis={<Conclusiones items={conclusiones} />}
                  >
                    <div className="mb-1 border-b border-white/[0.06] pb-2">
                      <LeyendaPista nuestro={equipo} puntoNuestro={puntoEquipo} rival={comparado ? `Próximo rival: ${comparado}` : undefined} />
                    </div>
                    <div>
                      {filas.map((f) => (
                        <FilaVistazo key={f.key} fila={f} punto={puntoEquipo} otra={comparado ? fila(tabla, comparado, METRICA[f.key]) : null} nombreOtra={comparado} />
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
                    id="lig-peligro"
                    title="Peligro a favor y en contra"
                    subtitle="Qué mirar: la esquina verde (abajo a la derecha) genera más de lo que concede. Jugadas a balón parado con remate por partido"
                    icon={ScatterChart}
                    className="xl:col-span-2"
                  >
                    <Cuadrante
                      puntos={puntos}
                      etiquetaX="Con remate a favor por partido"
                      etiquetaY="Con remate en contra por partido"
                      textoX={(v) => formatea(v, "decimal")}
                      textoY={(v) => formatea(v, "decimal")}
                      xMejorAlto
                      yMejorAlto={false}
                      nuestro={castilla || null}
                      rival={comparado || null}
                      elegido={equipo}
                      alPulsar={setElegido}
                    />
                  </Panel>

                  {/* ------------------ LA LIGA, ESCUDO A ESCUDO ------------- */}
                  {mosaico.length > 0 && (
                    <Panel
                      id="lig-escudos"
                      title="La liga, escudo a escudo"
                      subtitle="Cada tarjeta, un equipo: ABP con remate a favor y en contra por partido. Ordenadas por el balance (a favor menos en contra); pulsa una para mirarla"
                      icon={LayoutGrid}
                      className="xl:col-span-2"
                    >
                      <div className="grid min-w-0 grid-cols-1 gap-2 min-[420px]:grid-cols-2 md:grid-cols-3 2xl:grid-cols-4">
                        {mosaico.map((x, i) => {
                          const esNuestro = !!castilla && x.equipo === castilla;
                          const esRival = !!comparado && x.equipo === comparado;
                          const esEste = x.equipo === equipo;
                          const b = x.favor - x.contra;
                          const marco = esNuestro ? ORO_MARCA : esRival ? COMPARADO : esEste ? tinta(0.55) : null;
                          return (
                            <button
                              key={x.equipo}
                              type="button"
                              onClick={() => setElegido(x.equipo)}
                              aria-pressed={esEste}
                              className="lab-aparece min-w-0 rounded-xl border border-white/10 bg-white/[0.025] p-3 text-left transition duration-150 hover:-translate-y-0.5 hover:bg-white/[0.05] hover:shadow-lg motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                              style={{
                                animationDelay: `${Math.min(i, 20) * 25}ms`,
                                ...(marco ? { boxShadow: `inset 0 0 0 2px ${marco}, 0 0 18px ${esNuestro ? ORO_MARCA : esRival ? COMPARADO : "transparent"}33`, background: esNuestro ? `${ORO_MARCA}14` : esRival ? `${COMPARADO}12` : undefined } : {}),
                              }}
                            >
                              <span className="flex min-w-0 items-center gap-2">
                                <span className="w-5 shrink-0 text-right text-[10px] tabular-nums text-white/35">{i + 1}</span>
                                <Escudo src={escudoDe(x.equipo)} nombre={x.equipo} lado={30} />
                                <span className={`min-w-0 flex-1 truncate text-[12.5px] ${marco ? "font-semibold text-white" : "text-white/75"}`}>{x.equipo}</span>
                                <span
                                  className="shrink-0 rounded-full px-2 py-0.5 text-[12px] font-bold tabular-nums"
                                  title="Balance: a favor menos en contra, por partido"
                                  style={{ color: b >= 0 ? MEJOR : PEOR, background: `color-mix(in srgb, ${b >= 0 ? MEJOR : PEOR} 14%, transparent)` }}
                                >
                                  {b >= 0 ? "+" : ""}
                                  {formatea(b, "decimal")}
                                </span>
                              </span>
                              {[
                                { v: x.favor, c: ORO_MARCA, t: "A favor" },
                                { v: x.contra, c: CORAL, t: "En contra" },
                              ].map((y) => (
                                <span key={y.t} className="mt-1.5 flex min-w-0 items-center gap-2 text-[10.5px]">
                                  <span className="w-14 shrink-0 text-white/45">{y.t}</span>
                                  <span className="relative h-1.5 min-w-0 flex-1 rounded-full" style={{ background: tinta(0.08) }}>
                                    <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.max(3, (y.v / topeMosaico) * 100)}%`, background: y.c }} />
                                  </span>
                                  <span className="w-9 shrink-0 text-right tabular-nums text-white/65">{formatea(y.v, "decimal")}</span>
                                </span>
                              ))}
                            </button>
                          );
                        })}
                      </div>
                    </Panel>
                  )}

                  {/* ------------------------ TENDENCIA ---------------------- */}
                  <Panel
                    id="lig-tendencia"
                    title={`${m.nombre}, partido a partido`}
                    subtitle={`${equipo}: cada punto es un partido; la raya, su valor en la temporada (base: ${formatea(baseDe(suyos, m), "entero")} ${m.denominador === "partidos" ? "partidos" : "acciones"})`}
                    icon={LineChart}
                    className="xl:col-span-2"
                  >
                    <div className="mx-auto w-full max-w-[860px]">
                      <Evolucion serie={serie} unidad={m.unidad} media={posicionEn(tabla, equipo, m).valor} />
                    </div>
                  </Panel>
                  {/* ------------------ CONTRA LA REFERENCIA ----------------- */}
                  {premier && premier !== liga && ref && (
                    <Panel
                      id="lig-premier"
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
                      <div className="mb-4 grid min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
                        <span className="flex min-w-0 flex-col items-center gap-1 text-center">
                          <Escudo src={escudoDe(equipo)} nombre={equipo} lado={48} />
                          <span className="w-full truncate text-[13px] font-semibold text-white">{equipo}</span>
                          <span className="text-[10.5px] text-white/45">{liga.nombre}</span>
                        </span>
                        <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/35">frente a</span>
                        <span className="flex min-w-0 flex-col items-center gap-1 text-center">
                          <Escudo src={escudoDe(ref)} nombre={ref} lado={48} anillo={COMPARADO} />
                          <span className="w-full truncate text-[13px] font-semibold" style={{ color: COMPARADO }}>
                            {ref}
                          </span>
                          <span className="text-[10.5px] text-white/45">Premier League</span>
                        </span>
                      </div>
                      {gemelo && (
                        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#C8A96B]/30 bg-[#C8A96B]/[0.07] px-3.5 py-2.5">
                          <Escudo src={escudoDe(gemelo.equipo)} nombre={gemelo.equipo} lado={30} />
                          <p className="min-w-0 flex-1 text-[13px] leading-snug text-white/80">
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
                      <div className="mb-1 border-b border-white/[0.06] pb-2">
                        <LeyendaPista nuestro={`${equipo} (en ${liga.nombre})`} puntoNuestro={puntoEquipo} rival={`${ref} (en la Premier)`} />
                      </div>
                      <div className="grid gap-x-10 md:grid-cols-2">
                        {METRICAS_ABP.filter((x) => x.mejorAlto !== null).map((x) => (
                          <FilaVistazo key={x.key} fila={fila(tabla, equipo, x)} punto={puntoEquipo} otra={fila(tablaPremier, ref, x)} nombreOtra={ref} />
                        ))}
                      </div>
                    </Panel>
                  )}

                </div>
              </>
            )}
    </div>
  );
}
