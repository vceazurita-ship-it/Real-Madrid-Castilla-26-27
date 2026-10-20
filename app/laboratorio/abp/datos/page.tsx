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

import { useEffect, useMemo, useState } from "react";
import { Crosshair, FlaskConical, GitCompareArrows, LineChart, ListOrdered, ScatterChart } from "lucide-react";

import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { AbpHeader, Panel, Segmented, Select } from "@/components/abp/ui";
import { BarraPercentil, BarrasEquipos, Dispersion, Evolucion, type FilaPercentil } from "@/components/data/graficas";
import { Conclusiones, Explicativo } from "@/components/ui/textos-analisis";
import { cargaCalendario } from "@/hooks/useCalendario";
import { formatea } from "@/lib/data-analisis/metricas";
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
  type AbpLigas,
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

export default function DatosAbpPage() {
  const [datos, setDatos] = useState<AbpLigas | null>(null);
  const [fallo, setFallo] = useState(false);
  const [slug, setSlug] = useState("");
  const [elegido, setElegido] = useState("");
  const [metrica, setMetrica] = useState("abpRemF");
  const [referencia, setReferencia] = useState("");
  const [proximo, setProximo] = useState("");

  useEffect(() => {
    let vivo = true;

    fetch("/data/abp-ligas.json", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: AbpLigas) => vivo && setDatos(j))
      .catch(() => vivo && setFallo(true));

    /* El próximo rival, del calendario de BeSoccer (como en DATA). */
    void cargaCalendario().then((partidos) => {
      const ahora = new Date();
      const hoy = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, "0")}-${String(ahora.getDate()).padStart(2, "0")}`;
      const sig = partidos.filter((p) => p.cuando && p.cuando.slice(0, 10) >= hoy).sort((a, b) => a.cuando.localeCompare(b.cuando))[0];

      if (vivo && sig) setProximo(/castilla/i.test(sig.local) ? sig.visitante : sig.local);
    });

    return () => {
      vivo = false;
    };
  }, []);

  const ligas = useMemo(() => datos?.ligas ?? [], [datos]);

  const liga: LigaAbp | null = ligas.find((l) => l.slug === slug) ?? ligas[0] ?? null;

  const premier = ligas.find((l) => l.slug === "premier-league") ?? null;

  const tabla = useMemo(() => (liga ? tablaDe(liga) : []), [liga]);

  const tablaPremier = useMemo(() => (premier ? tablaDe(premier) : []), [premier]);

  const equipo = liga ? (elegido && liga.equipos.includes(elegido) ? elegido : equipoQueCasa(liga, ABRE_CON[liga.slug] ?? "") || liga.equipos[0]) : "";

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
                  {liga.competicion} · temporada {liga.temporada} · {liga.equipos.length} equipos
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

                  {/* ------------------ CONTRA LA REFERENCIA ----------------- */}
                  {premier && premier !== liga && ref && (
                    <Panel
                      title={`${equipo} frente a ${ref}`}
                      subtitle={`Cada uno contra su liga: ${equipo} en ${liga.nombre}, ${ref} en la Premier League. Se comparan percentiles, no cifras`}
                      icon={GitCompareArrows}
                      action={
                        <div className="w-48">
                          <Select label="Referencia Premier" value={ref} options={premier.equipos} onChange={setReferencia} />
                        </div>
                      }
                    >
                      <div className="space-y-1">
                        {METRICAS_ABP.filter((x) => x.mejorAlto !== null).map((x) => (
                          <BarraPercentil key={x.key} fila={fila(tabla, equipo, x)} otra={fila(tablaPremier, ref, x)} nombreOtra={ref} />
                        ))}
                      </div>
                    </Panel>
                  )}

                  {/* ------------------------ TENDENCIA ---------------------- */}
                  <Panel
                    title={`${m.nombre}, partido a partido`}
                    subtitle={`${equipo}: cada punto es un partido; la raya, su valor en la temporada (base: ${formatea(baseDe(suyos, m), "entero")} ${m.denominador === "partidos" ? "partidos" : "acciones"})`}
                    icon={LineChart}
                    className={premier && premier !== liga ? "" : "xl:col-span-2"}
                  >
                    <Evolucion serie={serie} unidad={m.unidad} media={posicionEn(tabla, equipo, m).valor} />
                  </Panel>
                </div>
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
