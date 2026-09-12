"use client";

/**
 * DATA ANÁLISIS · lo que dicen los informes de Opta y Wyscout.
 *
 * La carpeta `public/data` la llena el cuerpo técnico cada semana: los informes
 * por equipo de Wyscout y las descargas de Opta. Hasta ahora eso eran treinta
 * hojas de cálculo en una carpeta, y una hoja de cálculo con ciento tres
 * columnas no contesta a ninguna pregunta: hay que hacerle la pregunta.
 *
 * La pantalla son tres preguntas, en el orden en que se hacen:
 *
 *   1. **¿Cómo vamos respecto a lo que somos?** El Castilla contra su propia
 *      historia, temporada a temporada y partido a partido.
 *   2. **¿Cómo vamos respecto a la liga?** El Castilla contra los otros veinte,
 *      esta temporada, en percentiles: el número solo no dice si 12,01 de PPDA
 *      es presionar mucho o poco.
 *   3. **¿Cómo es cada uno?** Todos contra todos, para ordenar la liga por
 *      cualquier métrica y cruzar dos a la vez.
 *
 * Y una cuarta, que es la que sólo puede contestar el dato de evento: **quién,
 * cuándo y tras cuánto tiempo** —el log de Opta va acción por acción, con su
 * jugador y su reloj—.
 *
 * Dentro de «Contra la liga» todo se reparte además por **fase de juego** —con
 * balón, sin balón y balón parado—, que es como se habla en la caseta y como se
 * reparte el entrenamiento. Cincuenta y siete barras seguidas no se leen.
 *
 * **Cada gráfico escribe lo que muestra** (`lib/data-analisis/lectura.ts'). Un
 * dibujo enseña una forma pero no dice qué hacer con ella, y un gráfico sin
 * frase debajo se lee de ocho maneras distintas en un cuerpo técnico de ocho.
 */

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Clock,
  Compass,
  Database,
  Flag,
  History,
  Loader2,
  Percent,
  RefreshCw,
  Scale,
  ShieldCheck,
  Swords,
  Target,
  Timer,
  Users,
} from "lucide-react";

import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { AbpHeader, Button, Notice, Panel } from "@/components/abp/ui";
import {
  BarraPercentil,
  BarrasEquipos,
  Dispersion,
  Evolucion,
  ORO,
  tinta,
  type FilaPercentil,
} from "@/components/data/graficas";
import {
  Composicion,
  Distribucion,
  Enfrentado,
  Lectura,
  type ParEnfrentado,
  type Trozo,
} from "@/components/data/formas";
import {
  avisoDeMuestra,
  lecturaDeComposicion,
  lecturaDeDispersion,
  lecturaDeDistribucion,
  lecturaDeEnfrentado,
  lecturaDeEvolucion,
  lecturaDeGrupo,
  lecturaDeLiga,
} from "@/lib/data-analisis/lectura";
import {
  FASES,
  GRUPOS,
  METRICAS,
  METRICA_POR_KEY,
  aFavorYEnContra,
  formatea,
  mediana,
  percentil,
  temporadaDe,
  valorEnGrupo,
  valorEnPartido,
  type Fase,
} from "@/lib/data-analisis/metricas";
import type { FilaPartido } from "@/lib/data-analisis/leer";
import {
  familiaDe,
  porFamilia,
  porJugador,
  porTramo,
  tiempoHastaElRobo,
  type PartidoEventos,
} from "@/lib/data-analisis/eventos";

/** Cómo se llama el Castilla en los informes de Wyscout. */
const NOSOTROS = "Real Madrid Castilla";

type Respuesta = {
  ok: boolean;
  partidos?: FilaPartido[];
  equipos?: string[];
  eventos?: PartidoEventos[];
  origen?: "carpeta" | "indice";
  fuentes?: {
    wyscout: string[];
    opta: string[];
    ignorados: string[];
    leidoEn: string;
  };
  error?: string;
};

type Area = "historia" | "liga" | "todos" | "eventos";

const AREAS: { key: Area; label: string; icono: typeof History; pregunta: string }[] = [
  {
    key: "historia",
    label: "Nuestra historia",
    icono: History,
    pregunta: "¿Cómo vamos respecto a lo que somos?",
  },
  {
    key: "liga",
    label: "Contra la liga",
    icono: Scale,
    pregunta: "¿Cómo vamos respecto a los demás, esta temporada?",
  },
  {
    key: "todos",
    label: "Todos contra todos",
    icono: BarChart3,
    pregunta: "¿Cómo es cada equipo de la categoría?",
  },
  {
    key: "eventos",
    label: "Acción por acción",
    icono: Timer,
    pregunta: "¿Quién, cuándo y tras cuánto tiempo?",
  },
];

export default function DataAnalisisPage() {
  const [datos, setDatos] = useState<Respuesta | null>(null);
  const [cargando, setCargando] = useState(true);
  const [intento, setIntento] = useState(0);

  const [area, setArea] = useState<Area>("liga");

  /* La fase que se está mirando dentro de «Contra la liga». */
  const [fase, setFase] = useState<Fase>("con");

  useEffect(() => {
    const control = new AbortController();

    void (async () => {
      try {
        const r = await fetch(
          `/api/data-analisis${intento ? "?refrescar=1" : ""}`,
          { signal: control.signal },
        ).then((x) => x.json());

        if (control.signal.aborted) return;

        setDatos(r);
        setCargando(false);
      } catch (error) {
        if (control.signal.aborted) return;

        console.error("[data-analisis]", error);

        setDatos({ ok: false, error: "No se ha podido leer la carpeta." });
        setCargando(false);
      }
    })();

    return () => control.abort();
  }, [intento]);

  const partidos = useMemo(() => datos?.partidos ?? [], [datos]);

  /* --------------------------- TEMPORADAS -------------------------- */

  const temporadas = useMemo(
    () =>
      [...new Set(partidos.map((p) => temporadaDe(p.fecha)))]
        .filter(Boolean)
        .sort()
        .reverse(),
    [partidos],
  );

  const actual = temporadas[0] ?? "";

  const [temporada, setTemporada] = useState("");

  const laQueMando = temporada || actual;

  /* ------------------------ LO QUE SE MIRA ------------------------- */

  const deLaLiga = useMemo(
    () => partidos.filter((p) => temporadaDe(p.fecha) === laQueMando),
    [partidos, laQueMando],
  );

  const equiposLiga = useMemo(
    () =>
      [...new Set(deLaLiga.map((p) => p.equipo))].sort((a, b) =>
        a.localeCompare(b, "es"),
      ),
    [deLaLiga],
  );

  const nuestros = useMemo(
    () => deLaLiga.filter((p) => p.equipo === NOSOTROS),
    [deLaLiga],
  );

  /* --------------------------- PERCENTILES ------------------------- */

  const percentiles = useMemo<FilaPercentil[]>(() => {
    if (equiposLiga.length < 3) return [];

    const porEquipo = new Map(
      equiposLiga.map((e) => [e, deLaLiga.filter((p) => p.equipo === e)]),
    );

    return METRICAS.map((met) => {
      const valores = equiposLiga
        .map((e) => valorEnGrupo(met, porEquipo.get(e) ?? []))
        .filter((v): v is number => v !== null);

      const mio = valorEnGrupo(met, nuestros);

      const orden = [...valores].sort((a, b) =>
        met.mejorAlto === false ? a - b : b - a,
      );

      return {
        key: met.key,
        nombre: met.nombre,
        unidad: met.unidad,
        mejorAlto: met.mejorAlto,
        valor: mio,
        mediana: mediana(valores),
        percentil: mio === null ? null : percentil(mio, valores, met.mejorAlto),
        puesto:
          mio === null ? null : orden.findIndex((v) => v === mio) + 1 || null,
        deCuantos: valores.length,
        comoLeer: met.comoLeer,
      };
    });
  }, [deLaLiga, equiposLiga, nuestros]);

  const avisoMuestra = useMemo(
    () => avisoDeMuestra(nuestros.length),
    [nuestros.length],
  );

  /* -------------------- MÉTRICA ELEGIDA (áreas 3) ------------------ */

  const [metricaX, setMetricaX] = useState("cuotaProgresivos");
  const [metricaY, setMetricaY] = useState("xg");
  const [metricaTabla, setMetricaTabla] = useState("xg");

  const filasEquipos = useMemo(() => {
    const met = METRICA_POR_KEY.get(metricaTabla);

    if (!met) return [];

    return equiposLiga.map((equipo) => ({
      equipo,
      valor: valorEnGrupo(met, deLaLiga.filter((p) => p.equipo === equipo)),
    }));
  }, [deLaLiga, equiposLiga, metricaTabla]);

  const puntos = useMemo(() => {
    const mx = METRICA_POR_KEY.get(metricaX);
    const my = METRICA_POR_KEY.get(metricaY);

    if (!mx || !my) return [];

    return equiposLiga
      .map((equipo) => {
        const suyos = deLaLiga.filter((p) => p.equipo === equipo);

        const x = valorEnGrupo(mx, suyos);
        const y = valorEnGrupo(my, suyos);

        return x === null || y === null ? null : { equipo, x, y };
      })
      .filter((p): p is { equipo: string; x: number; y: number } => p !== null);
  }, [deLaLiga, equiposLiga, metricaX, metricaY]);

  /* --------------------------- HISTORIA ---------------------------- */

  const [metricaHist, setMetricaHist] = useState("xg");
  const [porPartido, setPorPartido] = useState(false);

  const nuestraHistoria = useMemo(
    () => partidos.filter((p) => p.equipo === NOSOTROS),
    [partidos],
  );

  const serieHistorica = useMemo(() => {
    const met = METRICA_POR_KEY.get(metricaHist);

    if (!met) return [];

    if (porPartido) {
      return [...nuestraHistoria]
        .filter((p) => temporadaDe(p.fecha) === laQueMando)
        .sort((a, b) => a.fecha.localeCompare(b.fecha))
        .map((p) => ({
          etiqueta: p.fecha.slice(5),
          valor: valorEnPartido(met, p),
          nota: `${p.rival} · ${p.golesFavor}-${p.golesContra}`,
        }));
    }

    return [...temporadas]
      .sort()
      .map((t) => {
        const filas = nuestraHistoria.filter((p) => temporadaDe(p.fecha) === t);

        return {
          etiqueta: t,
          valor: valorEnGrupo(met, filas),
          nota: `${filas.length} partidos`,
        };
      })
      .filter((p) => p.valor !== null);
  }, [laQueMando, metricaHist, nuestraHistoria, porPartido, temporadas]);

  const resumenTemporadas = useMemo(
    () =>
      [...temporadas].map((t) => {
        const filas = nuestraHistoria.filter((p) => temporadaDe(p.fecha) === t);

        const ganados = filas.filter((p) => p.golesFavor > p.golesContra).length;
        const empates = filas.filter((p) => p.golesFavor === p.golesContra).length;

        return {
          temporada: t,
          partidos: filas.length,
          ganados,
          empates,
          perdidos: filas.length - ganados - empates,
          gf: filas.reduce((s, p) => s + p.golesFavor, 0),
          gc: filas.reduce((s, p) => s + p.golesContra, 0),
          xg: valorEnGrupo(METRICA_POR_KEY.get("xg")!, filas),
          filas,
        };
      }),
    [nuestraHistoria, temporadas],
  );

  /* ----------------------- LOCAL Y VISITANTE ----------------------- */

  const casaFuera = useMemo(() => {
    const met = METRICA_POR_KEY.get(metricaHist);

    if (!met) return null;

    const deLaTemporada = nuestraHistoria.filter(
      (p) => temporadaDe(p.fecha) === laQueMando,
    );

    /* El rótulo del partido dice quién es local: «Local - Visitante 2:0». */
    const enCasa = deLaTemporada.filter((p) =>
      p.partido.startsWith(p.equipo.slice(0, 12)),
    );

    const fuera = deLaTemporada.filter((p) => !enCasa.includes(p));

    return {
      casa: { n: enCasa.length, valor: valorEnGrupo(met, enCasa) },
      fuera: { n: fuera.length, valor: valorEnGrupo(met, fuera) },
    };
  }, [laQueMando, metricaHist, nuestraHistoria]);

  /* ---------------------------- PINTADO ---------------------------- */

  const metHist = METRICA_POR_KEY.get(metricaHist);
  const metTabla = METRICA_POR_KEY.get(metricaTabla);
  const metX = METRICA_POR_KEY.get(metricaX);
  const metY = METRICA_POR_KEY.get(metricaY);

  const evento = datos?.eventos?.[0] ?? null;

  return (
    <main className="min-h-screen bg-[#0B0F14] text-white">
      <div className="flex">
        <Sidebar />

        <section className="flex min-w-0 flex-1 flex-col">
          <Topbar />

          <div className="min-w-0 px-4 py-6 sm:px-6 lg:px-10">
            <AbpHeader
              area="RMCF Castilla · Data análisis"
              title="Data Análisis"
              lead="Lo que dicen los informes de Wyscout y Opta que se dejan en la carpeta de datos: el Castilla contra su historia, contra la liga de este año y la liga entera comparada consigo misma. Cada número lleva escrito cómo se lee."
              aside={
                <Button
                  icon={RefreshCw}
                  onClick={() => {
                    setCargando(true);
                    setIntento((n) => n + 1);
                  }}
                  disabled={cargando}
                >
                  Releer la carpeta
                </Button>
              }
            />

            {cargando && (
              <div className="mt-8 flex items-center justify-center gap-2 py-16 text-sm text-white/40">
                <Loader2 size={16} className="animate-spin" />
                Abriendo los informes de la carpeta…
              </div>
            )}

            {!cargando && !datos?.ok && (
              <div className="mt-6">
                <Notice tone="warn" title="No se ha podido leer la carpeta de datos">
                  {datos?.error ??
                    "Comprueba que existe public/data con sus carpetas opta y wys."}
                </Notice>
              </div>
            )}

            {!cargando && datos?.ok && partidos.length === 0 && (
              <div className="mt-6">
                <Notice tone="warn" title="No ha llegado ningún informe">
                  <p>
                    Ni por la carpeta ni por el índice. Son dos cosas distintas y
                    conviene saber cuál falla:
                  </p>

                  <ul className="mt-2 space-y-1.5">
                    <li>
                      <strong className="text-white/70">
                        En el ordenador donde está la carpeta:
                      </strong>{" "}
                      comprueba que en <code>public/data/wys</code> hay «Team
                      Stats» en <code>.xlsx</code> y pulsa «Releer la carpeta».
                    </li>

                    <li>
                      <strong className="text-white/70">
                        En la plataforma desplegada:
                      </strong>{" "}
                      esta copia no puede abrir la carpeta —sube al alojamiento
                      pero la función no la tiene en su disco—, así que lee el
                      índice que se monta al compilar. Si sale vacío, es que se
                      desplegó sin informes: vuelve a desplegar con los ficheros
                      dentro.
                    </li>
                  </ul>
                </Notice>
              </div>
            )}

            {!cargando && datos?.ok && partidos.length > 0 && (
              <>
                {/* ===================== BARRA ===================== */}

                <div className="mt-6 flex min-w-0 flex-wrap items-center gap-2">
                  <div className="flex flex-wrap items-center rounded-xl border border-white/10 bg-white/[0.03] p-0.5">
                    {AREAS.map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => setArea(item.key)}
                        aria-pressed={area === item.key}
                        title={item.pregunta}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs transition ${
                          area === item.key
                            ? "bg-[#C8A96B]/15 text-[#C8A96B]"
                            : "text-white/50 hover:text-white"
                        }`}
                      >
                        <item.icono size={13} />
                        {item.label}
                      </button>
                    ))}
                  </div>

                  {area !== "eventos" && (
                    <label className="flex items-center gap-2">
                      <span className="text-[10px] uppercase tracking-[0.16em] text-white/40">
                        Temporada
                      </span>

                      <select
                        value={laQueMando}
                        onChange={(e) => setTemporada(e.target.value)}
                        className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none transition focus:border-[#C8A96B]/50"
                      >
                        {temporadas.map((t) => (
                          <option key={t} value={t} className="bg-[#11161C]">
                            {t}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}

                  <span className="text-[11px] text-white/30">
                    {area === "eventos"
                      ? `${datos.eventos?.length ?? 0} partido con log de eventos`
                      : `${equiposLiga.length} equipos · ${deLaLiga.length} informes de partido`}
                  </span>
                </div>

                <p className="mt-2 text-[12px] text-white/40">
                  {AREAS.find((a) => a.key === area)?.pregunta}
                </p>

                {/* ================== 1 · HISTORIA ================= */}

                {area === "historia" && (
                  <>
                    <div className="mt-5">
                      <Panel
                        title="Temporada a temporada"
                        subtitle="Lo que ha hecho el Castilla en cada curso del que hay informes"
                        icon={History}
                      >
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[620px] text-sm">
                            <thead>
                              <tr className="text-left text-[10px] uppercase tracking-[0.16em] text-white/40">
                                <th className="pb-2 pr-3 font-medium">Temporada</th>
                                <th className="pb-2 pr-3 text-right font-medium">PJ</th>
                                <th className="pb-2 pr-3 text-right font-medium">G-E-P</th>
                                <th className="pb-2 pr-3 text-right font-medium">GF-GC</th>
                                <th className="pb-2 pr-3 text-right font-medium">xG/partido</th>
                                <th className="pb-2 text-right font-medium">Goles − xG</th>
                              </tr>
                            </thead>

                            <tbody>
                              {resumenTemporadas.map((t) => {
                                const diff =
                                  t.xg === null
                                    ? null
                                    : t.gf / Math.max(1, t.partidos) - t.xg;

                                return (
                                  <tr
                                    key={t.temporada}
                                    className="border-t border-white/[0.06]"
                                  >
                                    <td className="py-2 pr-3 font-semibold text-white">
                                      {t.temporada}
                                    </td>
                                    <td className="py-2 pr-3 text-right tabular-nums text-white/70">
                                      {t.partidos}
                                    </td>
                                    <td className="py-2 pr-3 text-right tabular-nums text-white/70">
                                      {t.ganados}-{t.empates}-{t.perdidos}
                                    </td>
                                    <td className="py-2 pr-3 text-right tabular-nums text-white/70">
                                      {t.gf}-{t.gc}
                                    </td>
                                    <td className="py-2 pr-3 text-right tabular-nums text-white/70">
                                      {formatea(t.xg, "decimal")}
                                    </td>
                                    <td
                                      className="py-2 text-right tabular-nums"
                                      style={{
                                        color:
                                          diff === null
                                            ? tinta(0.4)
                                            : diff >= 0
                                              ? "#1B9E77"
                                              : "#D95F02",
                                      }}
                                    >
                                      {diff === null
                                        ? "—"
                                        : `${diff >= 0 ? "+" : ""}${diff.toFixed(2)}`}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        <p className="mt-3 text-[11px] leading-relaxed text-white/40">
                          «Goles − xG» es lo que se marcó por encima de lo que
                          valían las ocasiones. Sostenido en positivo es acierto;
                          en negativo, ocasiones que no se terminan.
                        </p>
                      </Panel>
                    </div>

                    <div className="mt-5">
                      <Panel
                        title="La métrica a lo largo del tiempo"
                        subtitle="Elige qué mirar. Una sola serie: dos escalas en un mismo dibujo harían decir a la gráfica lo que uno quiera."
                        icon={BarChart3}
                        action={
                          <div className="flex flex-wrap items-center gap-2">
                            <SelectorMetrica
                              valor={metricaHist}
                              onCambio={setMetricaHist}
                            />

                            <Button onClick={() => setPorPartido(!porPartido)}>
                              {porPartido
                                ? "Ver por temporadas"
                                : `Ver partido a partido (${laQueMando})`}
                            </Button>
                          </div>
                        }
                      >
                        <Evolucion
                          serie={serieHistorica}
                          unidad={metHist?.unidad ?? "decimal"}
                          media={
                            serieHistorica.length
                              ? serieHistorica
                                  .map((p) => p.valor)
                                  .filter((v): v is number => v !== null)
                                  .reduce((a, b, _, arr) => a + b / arr.length, 0)
                              : null
                          }
                        />

                        {metHist && (
                          <>
                            <Lectura>
                              {lecturaDeEvolucion(
                                serieHistorica,
                                metHist.unidad,
                                metHist.nombre,
                                metHist.mejorAlto,
                              ) ?? metHist.comoLeer}
                            </Lectura>

                            <p className="mt-2 text-[12px] leading-relaxed text-white/45">
                              <strong className="text-white/65">
                                {metHist.nombre}:
                              </strong>{" "}
                              {metHist.comoLeer}
                            </p>
                          </>
                        )}

                        {casaFuera && (
                          <div className="mt-4 grid gap-3 sm:grid-cols-2">
                            {[
                              { rotulo: "En casa", dato: casaFuera.casa },
                              { rotulo: "Fuera", dato: casaFuera.fuera },
                            ].map((lado) => (
                              <div
                                key={lado.rotulo}
                                className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5"
                              >
                                <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">
                                  {lado.rotulo} · {lado.dato.n} partidos
                                </p>

                                <p className="mt-1 text-lg font-semibold tabular-nums text-white">
                                  {formatea(
                                    lado.dato.valor,
                                    metHist?.unidad ?? "decimal",
                                  )}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </Panel>
                    </div>
                  </>
                )}

                {/* ================ 2 · CONTRA LA LIGA ============= */}

                {area === "liga" && (
                  <>
                    {nuestros.length === 0 ? (
                      <div className="mt-5">
                        <Notice tone="warn" title="Sin partidos del Castilla en esta temporada">
                          No hay informes del Castilla en {laQueMando}. Elige otra
                          temporada arriba.
                        </Notice>
                      </div>
                    ) : (
                      <>
                        {/*
                          LAS FASES DEL JUEGO

                          Cincuenta y siete barras seguidas no se leen: hay que
                          bajar tres pantallas para ver si se presiona bien. Con
                          balón, sin balón y balón parado es como se habla en la
                          caseta y como se reparte el entrenamiento, así que es
                          como se reparte la pantalla.
                        */}
                        <div className="mt-5 flex flex-wrap items-center gap-2">
                          <div className="flex flex-wrap items-center rounded-xl border border-white/10 bg-white/[0.03] p-0.5">
                            {FASES.map((f) => (
                              <button
                                key={f.key}
                                type="button"
                                onClick={() => setFase(f.key)}
                                aria-pressed={fase === f.key}
                                title={f.pregunta}
                                className={`rounded-lg px-3 py-2 text-xs transition ${
                                  fase === f.key
                                    ? "bg-[#C8A96B]/15 text-[#C8A96B]"
                                    : "text-white/50 hover:text-white"
                                }`}
                              >
                                {f.label}
                              </button>
                            ))}
                          </div>

                          <span className="text-[11px] text-white/35">
                            {FASES.find((f) => f.key === fase)?.pregunta}
                          </span>
                        </div>

                        {avisoMuestra && (
                          <div className="mt-3">
                            <Notice tone="warn" title="Ojo con la muestra">
                              {avisoMuestra}
                            </Notice>
                          </div>
                        )}

                        {/* Los gráficos propios de cada fase. */}
                        <PanelesDeFase
                          fase={fase}
                          nuestros={nuestros}
                          deLaLiga={deLaLiga}
                          equiposLiga={equiposLiga}
                        />

                        {/* Y el detalle métrica a métrica. */}
                        {GRUPOS.map((grupo) => {
                          const filas = percentiles.filter((f) => {
                            const met = METRICA_POR_KEY.get(f.key);

                            return met?.grupo === grupo && met?.fase === fase;
                          });

                          if (filas.length === 0) return null;

                          const lectura = lecturaDeGrupo(filas);

                          return (
                            <div key={grupo} className="mt-5">
                              <Panel
                                title={grupo}
                                subtitle="A la derecha, mejor. La raya del centro es la mediana de la liga; pulsa un nombre para ver cómo se lee."
                                icon={Scale}
                              >
                                {filas.map((fila) => (
                                  <BarraPercentil key={fila.key} fila={fila} />
                                ))}

                                {lectura && (
                                  <Lectura>
                                    {lectura.resumen}{" "}
                                    {lectura.fuerte} {lectura.debil}
                                  </Lectura>
                                )}
                              </Panel>
                            </div>
                          );
                        })}
                      </>
                    )}
                  </>
                )}

                {/* ============== 3 · TODOS CONTRA TODOS =========== */}

                {area === "todos" && (
                  <>
                    <div className="mt-5">
                      <Panel
                        title="La liga, ordenada"
                        subtitle="Cualquier métrica, los equipos de mejor a peor. El Castilla va en oro."
                        icon={BarChart3}
                        action={
                          <SelectorMetrica
                            valor={metricaTabla}
                            onCambio={setMetricaTabla}
                          />
                        }
                      >
                        <BarrasEquipos
                          filas={filasEquipos}
                          unidad={metTabla?.unidad ?? "decimal"}
                          mejorAlto={metTabla?.mejorAlto ?? null}
                          destacado={NOSOTROS}
                        />

                        {metTabla && (
                          <>
                            <Lectura>
                              {lecturaDeLiga(filasEquipos, NOSOTROS, metTabla)}
                            </Lectura>

                            <p className="mt-2 text-[12px] leading-relaxed text-white/45">
                              <strong className="text-white/65">
                                {metTabla.nombre}:
                              </strong>{" "}
                              {metTabla.comoLeer}
                              {metTabla.mejorAlto === false && (
                                <span className="text-white/35">
                                  {" "}
                                  Aquí el primero es el que menos tiene.
                                </span>
                              )}
                            </p>
                          </>
                        )}
                      </Panel>
                    </div>

                    <div className="mt-5">
                      <Panel
                        title="Dos métricas a la vez"
                        subtitle="Un punto por equipo. Las rayas son las medianas: los cuatro cuadrantes son la lectura."
                        icon={Users}
                        action={
                          <div className="flex flex-wrap items-center gap-2">
                            <SelectorMetrica
                              valor={metricaX}
                              onCambio={setMetricaX}
                              rotulo="Eje X"
                            />

                            <SelectorMetrica
                              valor={metricaY}
                              onCambio={setMetricaY}
                              rotulo="Eje Y"
                            />
                          </div>
                        }
                      >
                        <Dispersion
                          puntos={puntos}
                          etiquetaX={metX?.nombre ?? ""}
                          etiquetaY={metY?.nombre ?? ""}
                          unidadX={metX?.unidad ?? "decimal"}
                          unidadY={metY?.unidad ?? "decimal"}
                          destacado={NOSOTROS}
                        />

                        {metX && metY && (
                          <Lectura>
                            {lecturaDeDispersion(puntos, NOSOTROS, metX, metY)}
                          </Lectura>
                        )}
                      </Panel>
                    </div>
                  </>
                )}

                {/* ============= 4 · ACCIÓN POR ACCIÓN ============= */}

                {area === "eventos" && (
                  <>
                    {!evento ? (
                      <div className="mt-5">
                        <Notice tone="warn" title="No hay ningún log de eventos">
                          En <code>public/data/opta</code> no hay ningún{" "}
                          <code>export.json</code> con acciones. Los informes de
                          Wyscout son totales por partido; para saber quién hace
                          cada acción y en qué minuto hace falta el log de Opta.
                        </Notice>
                      </div>
                    ) : (
                      <PanelEventos partido={evento} />
                    )}
                  </>
                )}

                {/*
                  EL PIE

                  Antes esto eran dos paneles enteros —lo que falta en los
                  informes y el inventario de la carpeta— y ocupaban más que
                  algunos gráficos. Lo único que hay que saber al pie es de
                  dónde ha salido el dato que se está mirando: desplegado sólo
                  existe el índice, y eso explica por qué un fichero recién
                  dejado todavía no aparece.
                */}
                <p className="mt-8 border-t border-white/[0.06] pt-4 text-[11px] leading-relaxed text-white/35">
                  {datos.fuentes?.wyscout.length ?? 0} informes de Wyscout y{" "}
                  {datos.fuentes?.opta.length ?? 0} descargas de Opta.{" "}
                  {datos.origen === "indice"
                    ? "Leído del índice que se monta al compilar: esta copia no abre la carpeta por su cuenta, así que lo que dejes ahora se verá al volver a desplegar."
                    : "Leído de la carpeta: lo que dejes en public/data se ve al pulsar «Releer la carpeta»."}
                </p>
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------ */
/*  LOS GRÁFICOS PROPIOS DE CADA FASE                                  */
/* ------------------------------------------------------------------ */

/** Suma una columna en un grupo de partidos. `null` si no hay ninguna. */
function suma(filas: FilaPartido[], columna: string) {
  let total = 0;
  let hay = false;

  for (const fila of filas) {
    const v = fila.datos[columna];

    if (v === undefined) continue;

    total += v;
    hay = true;
  }

  return hay ? total : null;
}

/** Lo mismo, por partido: es lo que se compara entre equipos. */
const porPartido = (filas: FilaPartido[], columna: string) => {
  const total = suma(filas, columna);

  return total === null || filas.length === 0 ? 0 : total / filas.length;
};

/**
 * Lo que cada fase pide y el percentil no da.
 *
 * Con balón interesa **de dónde salen los remates** y **cómo se reparte el
 * pase**: son composiciones, y una barra apilada las cuenta de un vistazo. Sin
 * balón interesa **dónde se roba y dónde se pierde**, que es la misma forma. Y
 * el balón parado es, por naturaleza, **a favor contra en contra**: sacamos
 * nueve córners y concedemos cinco.
 *
 * La distribución partido a partido va en las tres: una media de nueve córners
 * puede ser nueve todas las semanas o veinte un día y cuatro el resto, y son
 * dos equipos distintos.
 */
function PanelesDeFase({
  fase,
  nuestros,
  deLaLiga,
  equiposLiga,
}: {
  fase: Fase;
  nuestros: FilaPartido[];
  deLaLiga: FilaPartido[];
  equiposLiga: string[];
}) {
  /** El mismo reparto, promediado sobre todos los equipos de la liga. */
  const enLaLiga = (columna: string) => {
    const valores = equiposLiga
      .map((e) => porPartido(deLaLiga.filter((p) => p.equipo === e), columna))
      .filter((v) => Number.isFinite(v));

    return mediana(valores) ?? 0;
  };

  const composicion = (
    partes: { etiqueta: string; columna: string }[],
  ): { nuestra: Trozo[]; liga: Trozo[] } => ({
    nuestra: partes.map((p) => ({
      etiqueta: p.etiqueta,
      valor: porPartido(nuestros, p.columna),
    })),
    liga: partes.map((p) => ({
      etiqueta: p.etiqueta,
      valor: enLaLiga(p.columna),
    })),
  });

  /* ------------------------------ CON BALÓN ----------------------- */

  if (fase === "con") {
    const origen = composicion([
      { etiqueta: "Ataque posicional", columna: "Ataques posicionales · con remate" },
      { etiqueta: "Balón parado", columna: "Jugadas a balón parado · con remate" },
      { etiqueta: "Contraataque", columna: "Contraataques · con remate" },
    ]);

    const pase = composicion([
      { etiqueta: "Adelante", columna: "Pases hacia adelante" },
      { etiqueta: "En horizontal", columna: "Pases laterales" },
      { etiqueta: "Atrás", columna: "Pases hacia atrás" },
    ]);

    return (
      <>
        <div className="mt-5 grid min-w-0 gap-5 lg:grid-cols-2">
          <Panel
            title="De dónde salen los remates"
            subtitle="El mismo volumen puede venir de tres sitios muy distintos"
            icon={Target}
          >
            <Composicion
              trozos={origen.nuestra}
              trozosLiga={origen.liga}
              lectura={lecturaDeComposicion(origen.nuestra, origen.liga, {
                sustantivo: "remates",
                verbo: "nacen de",
                trozo: "vía",
              })}
            />
          </Panel>

          <Panel
            title="Hacia dónde va el pase"
            subtitle="Adelante, de lado o atrás: el reparto dibuja la intención"
            icon={Compass}
          >
            <Composicion
              trozos={pase.nuestra}
              trozosLiga={pase.liga}
              lectura={lecturaDeComposicion(pase.nuestra, pase.liga, {
                sustantivo: "pases",
                verbo: "van",
                trozo: "dirección",
              })}
            />
          </Panel>
        </div>

        <div className="mt-5">
          <DistribucionDeMetrica
            key={fase}
            claveInicial="xg"
            fase="con"
            nuestros={nuestros}
            deLaLiga={deLaLiga}
            equiposLiga={equiposLiga}
          />
        </div>
      </>
    );
  }

  /* ------------------------------ SIN BALÓN ----------------------- */

  if (fase === "sin") {
    const robos = composicion([
      { etiqueta: "Campo rival", columna: "Balones recuperados · altos" },
      { etiqueta: "Zona media", columna: "Balones recuperados · medios" },
      { etiqueta: "Campo propio", columna: "Balones recuperados · bajos" },
    ]);

    const perdidas = composicion([
      { etiqueta: "Campo rival", columna: "Balones perdidos · altos" },
      { etiqueta: "Zona media", columna: "Balones perdidos · medios" },
      { etiqueta: "Campo propio", columna: "Balones perdidos · bajos" },
    ]);

    return (
      <>
        <div className="mt-5 grid min-w-0 gap-5 lg:grid-cols-2">
          <Panel
            title="Dónde se roba"
            subtitle="El volumen de robos no dice nada sin la altura"
            icon={ShieldCheck}
          >
            <Composicion
              trozos={robos.nuestra}
              trozosLiga={robos.liga}
              lectura={lecturaDeComposicion(robos.nuestra, robos.liga, {
                sustantivo: "recuperaciones",
                verbo: "se producen en",
                trozo: "zona",
              })}
            />
          </Panel>

          <Panel
            title="Dónde se pierde"
            subtitle="Las pérdidas en campo propio son las caras: cada una es una transición del rival"
            icon={AlertTriangle}
          >
            <Composicion
              trozos={perdidas.nuestra}
              trozosLiga={perdidas.liga}
              lectura={lecturaDeComposicion(perdidas.nuestra, perdidas.liga, {
                sustantivo: "pérdidas",
                verbo: "se producen en",
                trozo: "zona",
              })}
            />
          </Panel>
        </div>

        <div className="mt-5">
          <DistribucionDeMetrica
            key={fase}
            claveInicial="ppda"
            fase="sin"
            nuestros={nuestros}
            deLaLiga={deLaLiga}
            equiposLiga={equiposLiga}
          />
        </div>
      </>
    );
  }

  /* ---------------------------- BALÓN PARADO ---------------------- */

  if (fase === "abp") {
    const claves = [
      { key: "abp", masEsMejor: true },
      { key: "corners", masEsMejor: true },
      { key: "cornersRemate", masEsMejor: true },
      { key: "faltasTiro", masEsMejor: true },
      { key: "abpRemate", masEsMejor: true },
      { key: "duelosAereos", masEsMejor: true },
    ];

    const pares: ParEnfrentado[] = claves
      .map(({ key, masEsMejor }) => {
        const met = METRICA_POR_KEY.get(key);

        if (!met) return null;

        const { aFavor, enContra } = aFavorYEnContra(met, nuestros, deLaLiga);

        return {
          etiqueta: met.nombre,
          aFavor,
          enContra,
          unidad: met.unidad,
          masEsMejor,
        };
      })
      .filter((p): p is ParEnfrentado => p !== null);

    const reparto = composicion([
      { etiqueta: "Córners", columna: "Córneres" },
      { etiqueta: "Faltas", columna: "Tiros libres" },
      { etiqueta: "Penaltis", columna: "Penaltis" },
    ]);

    return (
      <>
        <div className="mt-5">
          <Panel
            title="Lo nuestro contra lo suyo"
            subtitle="El balón parado es la única fase que se puede comparar de tú a tú: el informe trae también las filas del rival de cada partido"
            icon={Swords}
          >
            <Enfrentado pares={pares} lectura={lecturaDeEnfrentado(pares)} />
          </Panel>
        </div>

        <div className="mt-5 grid min-w-0 gap-5 lg:grid-cols-2">
          <Panel
            title="De qué son las jugadas"
            subtitle="Córners, faltas y penaltis no se entrenan igual ni valen lo mismo"
            icon={Flag}
          >
            <Composicion
              trozos={reparto.nuestra}
              trozosLiga={reparto.liga}
              lectura={lecturaDeComposicion(reparto.nuestra, reparto.liga, {
                sustantivo: "jugadas a balón parado",
                verbo: "son",
                trozo: "vía",
              })}
            />
          </Panel>

          <Panel
            title="Cuánto pesa la estrategia"
            subtitle="Qué parte de todo lo que se remata nace de una jugada parada"
            icon={Percent}
          >
            <DistribucionDeMetrica
              key={fase}
              claveInicial="cuotaRematesAbp"
              fase="abp"
              nuestros={nuestros}
              deLaLiga={deLaLiga}
              equiposLiga={equiposLiga}
              sinPanel
            />
          </Panel>
        </div>
      </>
    );
  }

  return null;
}

/**
 * La misma métrica, partido a partido.
 *
 * Va aparte porque es la pregunta que sigue siempre a un percentil: «vale, la
 * media está bien, pero ¿lo hacemos todas las semanas?».
 */
function DistribucionDeMetrica({
  claveInicial,
  fase,
  nuestros,
  deLaLiga,
  equiposLiga,
  sinPanel,
}: {
  claveInicial: string;
  fase: Fase;
  nuestros: FilaPartido[];
  deLaLiga: FilaPartido[];
  equiposLiga: string[];
  sinPanel?: boolean;
}) {
  const [clave, setClave] = useState(claveInicial);

  const met = METRICA_POR_KEY.get(clave) ?? METRICA_POR_KEY.get(claveInicial)!;

  const puntos = [...nuestros]
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .map((fila) => ({
      etiqueta: `${fila.fecha.slice(5)} ${fila.rival}`,
      valor: valorEnPartido(met, fila),
      nota: `${fila.golesFavor}-${fila.golesContra}`,
    }))
    .filter((p): p is { etiqueta: string; valor: number; nota: string } =>
      p.valor !== null,
    );

  const referencia = mediana(
    equiposLiga
      .map((e) => valorEnGrupo(met, deLaLiga.filter((p) => p.equipo === e)))
      .filter((v): v is number => v !== null),
  );

  const cuerpo = (
    <Distribucion
      puntos={puntos}
      unidad={met.unidad}
      referencia={referencia}
      lectura={lecturaDeDistribucion(puntos, met.unidad, met.nombre, met.mejorAlto)}
    />
  );

  if (sinPanel) {
    return (
      <>
        <div className="mb-2">
          <SelectorMetrica valor={clave} onCambio={setClave} soloFase={fase} />
        </div>

        {cuerpo}
      </>
    );
  }

  return (
    <Panel
      title="Partido a partido"
      subtitle="Una media puede ser «siempre lo mismo» o «un día muy bueno y el resto no»"
      icon={Activity}
      action={<SelectorMetrica valor={clave} onCambio={setClave} soloFase={fase} />}
    >
      {cuerpo}
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/*  PIEZAS                                                             */
/* ------------------------------------------------------------------ */

function SelectorMetrica({
  valor,
  onCambio,
  rotulo,
  soloFase,
}: {
  valor: string;
  onCambio: (key: string) => void;
  rotulo?: string;
  /** Deja sólo las métricas de esa fase: dentro de «Sin balón» no pinta nada
      poder elegir los centros laterales. */
  soloFase?: Fase;
}) {
  return (
    <label className="flex items-center gap-1.5">
      {rotulo && (
        <span className="text-[10px] uppercase tracking-[0.16em] text-white/40">
          {rotulo}
        </span>
      )}

      <select
        value={valor}
        onChange={(e) => onCambio(e.target.value)}
        className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs text-white outline-none transition focus:border-[#C8A96B]/50"
      >
        {GRUPOS.map((grupo) => (
          <optgroup key={grupo} label={grupo}>
            {METRICAS.filter(
              (m) => m.grupo === grupo && (!soloFase || m.fase === soloFase),
            ).map((m) => (
              <option key={m.key} value={m.key} className="bg-[#11161C]">
                {m.nombre}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}

/** Lo que sólo puede contestar el dato de evento. */
function PanelEventos({ partido }: { partido: PartidoEventos }) {
  const familias = porFamilia(partido.eventos);
  const tramos = porTramo(partido.eventos);
  const jugadores = porJugador(partido.eventos);
  const robo = tiempoHastaElRobo(partido.eventos);

  const topeTramo = Math.max(...tramos.map((t) => t.total), 1);
  const topeJug = Math.max(...jugadores.map((j) => j.total), 1);

  return (
    <>
      <div className="mt-5">
        <Notice
          title={`${partido.fecha} · ${partido.equipo} contra ${partido.rival} (${partido.resultado}) · ${partido.eventos.length} acciones`}
        >
          Esta descarga de Opta son las{" "}
          <strong className="text-white/75">acciones defensivas</strong> del
          partido, una por una, con su jugador y su minuto. Wyscout da el total
          —«74 recuperaciones»— pero no quién, ni cuándo, ni después de cuánto
          tiempo con el balón el rival. Eso es lo que hay aquí.
        </Notice>
      </div>

      {robo && (
        <div className="mt-5">
          <Panel
            title="Cuánto aguanta el rival el balón antes de que se lo quiten"
            subtitle="La medida de presión que ningún total puede dar"
            icon={Clock}
          >
            <div className="grid gap-3 sm:grid-cols-4">
              {[
                {
                  rotulo: "Mediana",
                  dato: `${robo.mediana.toFixed(0)}″`,
                  pie: "la mitad de los robos llegan antes",
                },
                {
                  rotulo: "Media",
                  dato: `${robo.media.toFixed(1)}″`,
                  pie: "una posesión larga del rival la dispara",
                },
                {
                  rotulo: "Robos en 5″ o menos",
                  dato: String(robo.rapidos),
                  pie: "presión tras pérdida",
                },
                {
                  rotulo: "Robos de más de 30″",
                  dato: String(robo.lentos),
                  pie: "repliegue y espera",
                },
              ].map((c) => (
                <div
                  key={c.rotulo}
                  className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5"
                >
                  <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">
                    {c.rotulo}
                  </p>

                  <p className="mt-1 text-xl font-semibold tabular-nums text-white">
                    {c.dato}
                  </p>

                  <p className="mt-0.5 text-[11px] text-white/35">{c.pie}</p>
                </div>
              ))}
            </div>

            <p className="mt-3 text-[11px] leading-relaxed text-white/40">
              Se cuentan sólo los {robo.cuantos} robos de verdad —recuperación,
              intercepción, entrada—: un despeje no termina la posesión del
              rival, la alarga.
            </p>
          </Panel>
        </div>
      )}

      <div className="mt-5 grid min-w-0 gap-5 lg:grid-cols-2">
        <Panel
          title="Cuándo se defiende"
          subtitle="Acciones por tramos de cuarto de hora"
          icon={Timer}
        >
          <div className="space-y-1.5">
            {tramos.map((tramo) => (
              <div key={tramo.etiqueta} className="flex items-center gap-2">
                <span className="w-16 shrink-0 text-[11px] tabular-nums text-white/45">
                  {tramo.etiqueta}
                </span>

                <span className="h-3 min-w-0 flex-1">
                  <span
                    className="block h-3 rounded-[3px]"
                    style={{
                      width: `${(tramo.total / topeTramo) * 100}%`,
                      background: ORO,
                    }}
                  />
                </span>

                <span className="w-8 shrink-0 text-right text-[11px] tabular-nums text-white/60">
                  {tramo.total}
                </span>
              </div>
            ))}
          </div>

          <p className="mt-3 text-[11px] leading-relaxed text-white/40">
            Un equipo que defiende mucho más en los últimos tramos no está
            presionando mejor: está metido atrás.
          </p>
        </Panel>

        <Panel
          title="De qué tipo"
          subtitle="Robar no es lo mismo que despejar"
          icon={Database}
        >
          <div className="space-y-1.5">
            {familias.map((f) => (
              <div key={f.familia} className="flex items-center gap-2">
                <span className="w-28 shrink-0 truncate text-[11px] text-white/55">
                  {f.familia}
                </span>

                <span className="h-3 min-w-0 flex-1">
                  <span
                    className="block h-3 rounded-[3px]"
                    style={{
                      width: `${(f.total / (familias[0]?.total || 1)) * 100}%`,
                      background: f.familia === "Robo" ? "#1B9E77" : tinta(0.28),
                    }}
                  />
                </span>

                <span className="w-8 shrink-0 text-right text-[11px] tabular-nums text-white/60">
                  {f.total}
                </span>
              </div>
            ))}
          </div>

          <p className="mt-3 text-[11px] leading-relaxed text-white/40">
            En verde los robos, que devuelven el balón. El resto quita el peligro
            pero lo deja en disputa.
          </p>
        </Panel>
      </div>

      <div className="mt-5">
        <Panel
          title="Quién hace el trabajo"
          subtitle="Acciones defensivas por jugador, repartidas por tipo"
          icon={Users}
        >
          <div className="space-y-1">
            {jugadores.map((j) => (
              <div key={j.jugador} className="flex items-center gap-2">
                <span className="w-40 shrink-0 truncate text-[12px] text-white/70">
                  {j.jugador}
                </span>

                <span className="flex h-3 min-w-0 flex-1 gap-[2px]">
                  {Object.entries(j.familias).map(([familia, n]) => (
                    <span
                      key={familia}
                      title={`${familia}: ${n}`}
                      className="block h-3 rounded-[2px]"
                      style={{
                        width: `${(n / topeJug) * 100}%`,
                        background:
                          familia === "Robo" ? "#1B9E77" : tinta(0.28),
                      }}
                    />
                  ))}
                </span>

                <span className="w-8 shrink-0 text-right text-[12px] tabular-nums text-white/60">
                  {j.total}
                </span>
              </div>
            ))}
          </div>

          <p className="mt-3 text-[11px] leading-relaxed text-white/40">
            Los tipos de acción se agrupan en familias ({familiaDe("BallRecovery")},{" "}
            {familiaDe("Clearance")}, {familiaDe("Aerial")}…) para que la barra se
            lea. En verde, lo que es robo.
          </p>
        </Panel>
      </div>
    </>
  );
}
