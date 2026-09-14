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

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Award,
  BarChart3,
  Brain,
  Clock,
  Compass,
  Database,
  Flag,
  History,
  LayoutGrid,
  Loader2,
  Percent,
  RefreshCw,
  Scale,
  ShieldCheck,
  Swords,
  Target,
  Timer,
  User,
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
  MEJOR,
  ORO,
  PEOR,
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
import { BateriaDePreguntas } from "@/components/data/preguntas";
import { PanelAbpPropio } from "@/components/data/PanelAbpPropio";
import { PanelCampograma } from "@/components/data/PanelCampograma";
import { PanelDestacados } from "@/components/data/PanelDestacados";
import { PanelIndividual } from "@/components/data/PanelIndividual";
import { PanelTransferencia } from "@/components/data/PanelTransferencia";
import { rotuloDeEje, type Pregunta } from "@/lib/data-analisis/preguntas";
import {
  DURACION_POSESION,
  METRICAS_OPTA,
  OPTA_POR_COLUMNA,
  ORIGEN_ESTRATEGIA,
  POSESION_POR_TRAMO,
  SOLO_LIGA,
  contraLaMedia,
  filasDe,
  porPartidoOpta,
  resumenOpta,
  valorOpta,
  type AmbitoOpta,
  type MetricaOpta,
} from "@/lib/data-analisis/opta";
import type {
  FilaJugador,
  FilaPartido,
  HistoricoOpta,
} from "@/lib/data-analisis/leer";
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
  /** El «Search results» de Wyscout: una fila por jugador. */
  jugadores?: FilaJugador[];
  /** El agregado histórico que baja Opta: cien partidos, casa y fuera. */
  historico?: HistoricoOpta[];
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

type Area =
  | "campo"
  | "historia"
  | "liga"
  | "todos"
  | "destacados"
  | "eventos"
  | "individual"
  | "abp"
  | "transferencia";

const AREAS: { key: Area; label: string; icono: typeof History; pregunta: string }[] = [
  /*
    El campograma abre la pantalla a propósito: es la forma en la que se mira
    un partido el lunes por la mañana —por momentos y sobre el campo— y no
    hace falta saber nada de métricas para leerlo. Las tablas vienen después.
  */
  {
    key: "campo",
    label: "Partido en el campo",
    icono: LayoutGrid,
    pregunta: "¿Qué pasó en cada momento, y es lo que solemos hacer?",
  },
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
  /*
    Ésta no añade dato: ordena el que ya hay. Va detrás de «todos contra
    todos» porque es la misma tabla leída al revés —en vez de elegir una
    métrica y ver quién manda, se pregunta quién se sale y en qué—.
  */
  {
    key: "destacados",
    label: "Los más destacados",
    icono: Award,
    pregunta: "¿Quién se sale de la categoría, y en qué?",
  },
  {
    key: "eventos",
    label: "Acción por acción",
    icono: Timer,
    pregunta: "¿Quién, cuándo y tras cuánto tiempo?",
  },
  {
    key: "individual",
    label: "Jugador a jugador",
    icono: User,
    pregunta: "¿Cómo va cada uno, dentro de la plantilla?",
  },
  /*
    Las dos últimas no vienen de la carpeta de datos: una la registra el
    cuerpo técnico acción por acción en las hojas de balón parado y la otra
    cruza los microciclos con los informes. Van al final porque son de otra
    naturaleza, y las dos lo avisan en cuanto se entra.
  */
  {
    key: "abp",
    label: "Nuestro balón parado",
    icono: Flag,
    pregunta: "¿Qué sacamos de lo que ensayamos? (registro propio)",
  },
  {
    key: "transferencia",
    label: "Entrenamiento y partido",
    icono: Brain,
    pregunta: "¿Lo que se entrena se ve el domingo?",
  },
];

export default function DataAnalisisPage() {
  const [datos, setDatos] = useState<Respuesta | null>(null);
  const [cargando, setCargando] = useState(true);
  const [intento, setIntento] = useState(0);

  /*
  | Con qué área se abre.
  |
  | Normalmente «Contra la liga», que es la pregunta más frecuente. Pero las
  | alertas de la portada enlazan aquí con `?area=` —«mira esto en jugador a
  | jugador»— y llegar a otra pantalla distinta de la que te han prometido es
  | la manera más rápida de que nadie vuelva a pulsar una alerta.
  |
  | Se lee **una sola vez, al montar** (`useState` con función), no en un
  | efecto: cambiar de área después con un efecto sería pisarle la elección al
  | que ya está navegando, y es lo que prohíbe `react-hooks/set-state-in-effect`.
  */
  const [area, setArea] = useState<Area>(() => {
    if (typeof window === "undefined") return "liga";

    const pedida = new URLSearchParams(window.location.search).get("area");

    return AREAS.some((a) => a.key === pedida) ? (pedida as Area) : "liga";
  });

  /* La fase que se está mirando dentro de «Contra la liga». */
  const [fase, setFase] = useState<Fase>("con");

  /* El partido del log de eventos: «fecha|rival», o todos juntos. */
  const [elLog, setElLog] = useState<string>("todos");

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

  /* Las filas de quien nos jugó: hacen falta para las cifras «en contra». */
  const contraNosotrosLiga = useMemo(
    () => deLaLiga.filter((p) => p.rival === NOSOTROS),
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

  /*
  | LA PREGUNTA Y LOS DOS EJES
  |
  | El par de métricas es **uno solo**, y se llega a él por dos caminos: la
  | batería de preguntas de la izquierda o los dos selectores de la derecha.
  | Por eso el estado vive aquí arriba y no dentro de ninguno de los dos
  | bloques. `contra` marca el eje cuyo valor es el del rival —«¿cuántos
  | córners concedemos?» no es una columna, es la fila del contrario—, y tocar
  | un selector a mano apaga la pregunta: lo que se está viendo ya no es lo que
  | ella preguntaba.
  */
  const [contraX, setContraX] = useState(false);
  const [contraY, setContraY] = useState(false);
  const [pregunta, setPregunta] = useState<string | null>(null);

  const eligePregunta = useCallback((p: Pregunta) => {
    setMetricaX(p.x);
    setMetricaY(p.y);
    setContraX(Boolean(p.contraX));
    setContraY(Boolean(p.contraY));
    setPregunta(p.key);
  }, []);

  const cambiaX = useCallback((key: string) => {
    setMetricaX(key);
    setContraX(false);
    setPregunta(null);
  }, []);

  const cambiaY = useCallback((key: string) => {
    setMetricaY(key);
    setContraY(false);
    setPregunta(null);
  }, []);

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
        /* Las suyas y, para las preguntas de «en contra», las de quien le
           jugó: el informe trae las dos filas de cada partido. */
        const suyos = deLaLiga.filter((p) => p.equipo === equipo);
        const rivales = deLaLiga.filter((p) => p.rival === equipo);

        const x = valorEnGrupo(mx, contraX ? rivales : suyos);
        const y = valorEnGrupo(my, contraY ? rivales : suyos);

        return x === null || y === null ? null : { equipo, x, y };
      })
      .filter((p): p is { equipo: string; x: number; y: number } => p !== null);
  }, [contraX, contraY, deLaLiga, equiposLiga, metricaX, metricaY]);

  /* --------------------------- HISTORIA ---------------------------- */

  const [metricaHist, setMetricaHist] = useState("xg");
  const [porPartido, setPorPartido] = useState(false);

  const nuestraHistoria = useMemo(
    () => partidos.filter((p) => p.equipo === NOSOTROS),
    [partidos],
  );

  /* Lo que los rivales hicieron contra nosotros, para las preguntas de «en
     contra»: el informe de cada partido trae también la fila del contrario. */
  const contraNosotros = useMemo(
    () => partidos.filter((p) => p.rival === NOSOTROS),
    [partidos],
  );

  /*
  | A ESTAS ALTURAS
  |
  | Comparar la temporada en curso con las cerradas es comparar tres partidos
  | con treinta y ocho, y siempre gana la pequeña o la grande según la métrica.
  | Lo que se quiere saber es otra cosa: **cómo íbamos el año pasado por esta
  | misma jornada**. Así que cada temporada se recorta a los mismos partidos
  | que lleva la actual, en orden de calendario.
  */
  const jugadosAhora = useMemo(
    () => nuestraHistoria.filter((p) => temporadaDe(p.fecha) === actual).length,
    [actual, nuestraHistoria],
  );

  const [aEstasAlturas, setAEstasAlturas] = useState(false);

  const recorta = useCallback(
    (filas: FilaPartido[]) => {
      const ordenadas = [...filas].sort((a, b) => a.fecha.localeCompare(b.fecha));

      return aEstasAlturas && jugadosAhora > 0
        ? ordenadas.slice(0, jugadosAhora)
        : ordenadas;
    },
    [aEstasAlturas, jugadosAhora],
  );

  const deTemporada = useCallback(
    (t: string) =>
      recorta(nuestraHistoria.filter((p) => temporadaDe(p.fecha) === t)),
    [nuestraHistoria, recorta],
  );

  const deTemporadaContra = useCallback(
    (t: string) =>
      recorta(contraNosotros.filter((p) => temporadaDe(p.fecha) === t)),
    [contraNosotros, recorta],
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
        const filas = deTemporada(t);

        return {
          etiqueta: t,
          valor: valorEnGrupo(met, filas),
          nota: `${filas.length} partidos`,
        };
      })
      .filter((p) => p.valor !== null);
  }, [deTemporada, laQueMando, metricaHist, nuestraHistoria, porPartido, temporadas]);

  const resumenTemporadas = useMemo(
    () =>
      [...temporadas].map((t) => {
        const filas = deTemporada(t);

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
    [deTemporada, temporadas],
  );

  /* ----------------------- LOCAL Y VISITANTE ----------------------- */

  const casaFuera = useMemo(() => {
    const met = METRICA_POR_KEY.get(metricaHist);

    if (!met) return null;

    const deLaTemporada = deTemporada(laQueMando);

    /* El rótulo del partido dice quién es local: «Local - Visitante 2:0». */
    const enCasa = deLaTemporada.filter((p) =>
      p.partido.startsWith(p.equipo.slice(0, 12)),
    );

    const fuera = deLaTemporada.filter((p) => !enCasa.includes(p));

    return {
      casa: { n: enCasa.length, valor: valorEnGrupo(met, enCasa) },
      fuera: { n: fuera.length, valor: valorEnGrupo(met, fuera) },
    };
  }, [deTemporada, laQueMando, metricaHist]);

  /* ------------------- DOS MÉTRICAS, PERO NUESTRAS ----------------- */

  /*
  | El mismo cruce de la sección de la liga, con los puntos cambiados: aquí
  | cada punto es **una temporada del Castilla**, no un equipo. Contesta a la
  | otra mitad de la pregunta: no «quién lo hace mejor», sino «¿esto es nuevo o
  | llevamos años así?». Con «a estas alturas» puesto, además, cada curso entra
  | con los mismos partidos que lleva el actual.
  */
  const puntosHistoria = useMemo(() => {
    const mx = METRICA_POR_KEY.get(metricaX);
    const my = METRICA_POR_KEY.get(metricaY);

    if (!mx || !my) return [];

    return temporadas
      .map((t) => {
        const x = valorEnGrupo(mx, contraX ? deTemporadaContra(t) : deTemporada(t));
        const y = valorEnGrupo(my, contraY ? deTemporadaContra(t) : deTemporada(t));

        return x === null || y === null ? null : { equipo: t, x, y };
      })
      .filter((p): p is { equipo: string; x: number; y: number } => p !== null);
  }, [contraX, contraY, deTemporada, deTemporadaContra, metricaX, metricaY, temporadas]);

  /* ---------------------------- PINTADO ---------------------------- */

  const metHist = METRICA_POR_KEY.get(metricaHist);
  const metTabla = METRICA_POR_KEY.get(metricaTabla);

  /*
  | La descarga de Opta trae los partidos seguidos, así que aquí se elige cuál
  | se mira. «Los tres juntos» no es un partido: es la suma, y sirve para el
  | reparto por jugador y por tramo, donde un solo partido es poca cosa.
  */
  const logs = useMemo(() => datos?.eventos ?? [], [datos]);

  const evento = useMemo(() => {
    if (logs.length === 0) return null;

    if (elLog !== "todos") {
      return logs.find((l) => `${l.fecha}|${l.rival}` === elLog) ?? logs[0];
    }

    return {
      fecha: logs[logs.length - 1].fecha,
      equipo: logs[0].equipo,
      rival: logs.map((l) => l.rival).join(", "),
      resultado: logs.map((l) => l.resultado).join(" · "),
      eventos: logs.flatMap((l) => l.eventos),
    };
  }, [elLog, logs]);

  const tituloEvento = useMemo(() => {
    if (!evento) return "";

    const acciones = `${evento.eventos.length} acciones`;

    if (elLog !== "todos")
      return `${evento.fecha} · ${evento.equipo} contra ${evento.rival} (${evento.resultado}) · ${acciones}`;

    return `Los ${logs.length} partidos del curso · ${evento.rival} · ${acciones}`;
  }, [elLog, evento, logs.length]);

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

                  {area !== "eventos" && area !== "abp" && area !== "individual" && area !== "transferencia" && (
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
                    {area === "abp"
                      ? "Registro propio del cuerpo técnico, no de Wyscout ni de Opta"
                      : area === "transferencia"
                        ? "Los microciclos cruzados con los informes de partido"
                        : area === "individual"
                          ? `${datos.jugadores?.length ?? 0} jugadores con minutos esta temporada`
                          : area === "eventos"
                            ? `${logs.length} ${logs.length === 1 ? "partido" : "partidos"} con log de eventos`
                            : `${equiposLiga.length} equipos · ${deLaLiga.length} informes de partido`}
                  </span>
                </div>

                <p className="mt-2 text-[12px] text-white/40">
                  {AREAS.find((a) => a.key === area)?.pregunta}
                </p>

                {/* =============== 0 · EL CAMPOGRAMA =============== */}

                {area === "campo" && (
                  <PanelCampograma
                    nuestros={nuestros}
                    contrarios={contraNosotrosLiga}
                    liga={deLaLiga}
                    equipos={equiposLiga.length}
                    temporada={laQueMando}
                  />
                )}

                {/* ================== 1 · HISTORIA ================= */}

                {area === "historia" && (
                  <>
                    {/*
                      A ESTAS ALTURAS

                      Comparar tres partidos de este curso con treinta y ocho
                      del anterior no compara nada. Este interruptor recorta
                      todas las temporadas a los mismos partidos que lleva la
                      actual, en orden de calendario, y entonces la tabla sí
                      contesta a «¿cómo íbamos el año pasado por esta jornada?».
                    */}
                    <div className="mt-5 flex flex-wrap items-center gap-2">
                      <div className="flex flex-wrap items-center rounded-xl border border-white/10 bg-white/[0.03] p-0.5">
                        {[
                          { valor: false, rotulo: "La temporada entera" },
                          {
                            valor: true,
                            rotulo: `A estas alturas (${jugadosAhora} partidos)`,
                          },
                        ].map((opcion) => (
                          <button
                            key={opcion.rotulo}
                            type="button"
                            onClick={() => setAEstasAlturas(opcion.valor)}
                            aria-pressed={aEstasAlturas === opcion.valor}
                            disabled={jugadosAhora === 0}
                            className={`rounded-lg px-3 py-2 text-xs transition ${
                              aEstasAlturas === opcion.valor
                                ? "bg-[#C8A96B]/15 text-[#C8A96B]"
                                : "text-white/50 hover:text-white"
                            }`}
                          >
                            {opcion.rotulo}
                          </button>
                        ))}
                      </div>

                      <span className="text-[11px] text-white/35">
                        {aEstasAlturas
                          ? `Cada temporada, recortada a sus ${jugadosAhora} primeros partidos: es el mismo punto del curso en el que estamos en ${actual}.`
                          : "Cada temporada, con todos los partidos que se jugaron."}
                      </span>
                    </div>

                    <div className="mt-5">
                      <Panel
                        title="Temporada a temporada"
                        subtitle={
                          aEstasAlturas
                            ? `Cómo iba el Castilla en cada curso tras ${jugadosAhora} partidos`
                            : "Lo que ha hecho el Castilla en cada curso del que hay informes"
                        }
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
                                    className={`border-t border-white/[0.06] ${
                                      t.temporada === actual
                                        ? "bg-[#C8A96B]/[0.07]"
                                        : ""
                                    }`}
                                  >
                                    <td
                                      className="py-2 pr-3 font-semibold"
                                      style={{
                                        color:
                                          t.temporada === actual
                                            ? ORO
                                            : undefined,
                                      }}
                                    >
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

                    {/*
                      EL MISMO CRUCE, CON NUESTRAS TEMPORADAS

                      Los mismos mandos que en «Todos contra todos» —la
                      pregunta a la izquierda, los dos ejes a la derecha— pero
                      cambiando los puntos: aquí cada punto es un curso del
                      Castilla. La pregunta deja de ser «¿quién lo hace mejor?»
                      y pasa a ser «¿esto es de este año o llevamos años así?».
                    */}
                    <ParDeMetricas
                      titulo="Dos métricas a la vez, curso a curso"
                      subtitulo="Un punto por temporada del Castilla, con su año escrito. Las rayas son las medianas de nuestra propia historia."
                      puntos={puntosHistoria}
                      destacado={actual}
                      /* Aquí cada punto es un curso: sin el año no se sabe
                         cuál es cuál, y son seis, así que caben los seis. */
                      rotulaTodos
                      metricaX={metricaX}
                      metricaY={metricaY}
                      contraX={contraX}
                      contraY={contraY}
                      pregunta={pregunta}
                      onPregunta={eligePregunta}
                      onCambiaX={cambiaX}
                      onCambiaY={cambiaY}
                      nota={
                        aEstasAlturas
                          ? `Cada temporada entra con sus ${jugadosAhora} primeros partidos, así que ${actual} se compara con las demás en igualdad. En oro, el curso en marcha.`
                          : `En oro, ${actual}. Ojo: entra con los partidos que lleva, y las demás con todos; pon «a estas alturas» arriba para comparar en igualdad.`
                      }
                    />

                    {/* Y lo que sólo tiene Opta: cien partidos, casa y fuera. */}
                    <PanelOpta historico={datos.historico ?? []} />
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

                    <ParDeMetricas
                      titulo="Dos métricas a la vez"
                      subtitulo="Un punto por equipo. Las rayas son las medianas: los cuatro cuadrantes son la lectura."
                      puntos={puntos}
                      destacado={NOSOTROS}
                      metricaX={metricaX}
                      metricaY={metricaY}
                      contraX={contraX}
                      contraY={contraY}
                      pregunta={pregunta}
                      onPregunta={eligePregunta}
                      onCambiaX={cambiaX}
                      onCambiaY={cambiaY}
                      nota={`${equiposLiga.length} equipos de ${laQueMando}. El Castilla va en oro.`}
                    />
                  </>
                )}

                {/* ========== 3 bis · LOS MÁS DESTACADOS ========== */}

                {area === "destacados" && (
                  <PanelDestacados
                    partidos={datos.partidos ?? []}
                    jugadores={datos.jugadores ?? []}
                  />
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
                      <>
                        {logs.length > 1 && (
                          <div className="mt-5 flex flex-wrap items-center gap-2">
                            <div className="flex flex-wrap items-center rounded-xl border border-white/10 bg-white/[0.03] p-0.5">
                              <button
                                type="button"
                                onClick={() => setElLog("todos")}
                                aria-pressed={elLog === "todos"}
                                className={`rounded-lg px-3 py-2 text-xs transition ${
                                  elLog === "todos"
                                    ? "bg-[#C8A96B]/15 text-[#C8A96B]"
                                    : "text-white/50 hover:text-white"
                                }`}
                              >
                                Los {logs.length} juntos
                              </button>

                              {logs.map((l) => {
                                const clave = `${l.fecha}|${l.rival}`;

                                return (
                                  <button
                                    key={clave}
                                    type="button"
                                    onClick={() => setElLog(clave)}
                                    aria-pressed={elLog === clave}
                                    className={`rounded-lg px-3 py-2 text-xs transition ${
                                      elLog === clave
                                        ? "bg-[#C8A96B]/15 text-[#C8A96B]"
                                        : "text-white/50 hover:text-white"
                                    }`}
                                  >
                                    {l.rival} · {l.resultado}
                                  </button>
                                );
                              })}
                            </div>

                            <span className="text-[11px] text-white/35">
                              {elLog === "todos"
                                ? "Todo el log sumado: es como se ve quién carga con el trabajo defensivo del curso."
                                : "Un solo partido: los tramos y el tiempo hasta el robo se leen partido a partido."}
                            </span>
                          </div>
                        )}

                        <PanelEventos partido={evento} titulo={tituloEvento} />
                      </>
                    )}
                  </>
                )}

                {/* ============= 5 · JUGADOR A JUGADOR ============ */}

                {area === "individual" && (
                  <PanelIndividual jugadores={datos.jugadores ?? []} />
                )}

                {/* ============ 6 · NUESTRO BALÓN PARADO ========== */}

                {area === "abp" && <PanelAbpPropio />}

                {/* ========= 7 · ENTRENAMIENTO Y PARTIDO ========== */}

                {area === "transferencia" && (
                  <PanelTransferencia
                    nuestros={nuestros}
                    liga={deLaLiga}
                    equipos={equiposLiga}
                    temporada={laQueMando}
                    jugadores={datos.jugadores ?? []}
                  />
                )}

                {/*
                  EL PIE

                  Antes esto eran dos paneles enteros —lo que falta en los
                  informes y el inventario de la carpeta— y ocupaban más que
                  algunos gráficos. Ahora es el inventario y nada más: de dónde
                  sale el dato se explica ya donde hace falta, en el aviso de
                  carpeta vacía.
                */}
                <p className="mt-8 border-t border-white/[0.06] pt-4 text-[11px] leading-relaxed text-white/35">
                  {area === "abp"
                    ? "Las cuatro hojas de balón parado del cuerpo técnico"
                    : area === "transferencia"
                      ? "La hoja de microciclos y los informes de Wyscout"
                      : `${datos.fuentes?.wyscout.length ?? 0} informes de Wyscout y ${datos.fuentes?.opta.length ?? 0} descargas de Opta`}
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

/* ------------------------------------------------------------------ */
/*  LOS AGREGADOS DE OPTA                                              */
/* ------------------------------------------------------------------ */

/**
 * El Castilla contra la media de la categoría, con las columnas de Opta.
 *
 * La carpeta trae dos agregados que parecen el mismo y no lo son: uno de cien
 * partidos con reparto de casa y fuera —que es **toda la categoría**: los
 * duelos dan 50,0 % clavado y los goles a favor igualan a los de contra— y
 * otro del **Castilla**, con sus tres partidos y las mismas columnas.
 *
 * Que compartan columnas es lo que hace valioso el panel: pone al Castilla al
 * lado de la media de la liga en cosas que Wyscout no mide —conducciones
 * progresivas, uno contra uno, duración de la posesión, acierto de pase
 * saliendo desde atrás—. Todo por partido, que es la única manera de comparar
 * tres con cien.
 */
function PanelOpta({ historico }: { historico: HistoricoOpta[] }) {
  const [faseOpta, setFaseOpta] = useState<"con" | "sin" | "abp">("con");

  const liga = filasDe(historico, "liga");
  const nuestro = filasDe(historico, "nuestro");

  if (liga.length === 0 && nuestro.length === 0) {
    return (
      <div className="mt-5">
        <Notice tone="warn" title="Sin los agregados de Opta">
          En <code>public/data/opta</code> no hay ningún <code>Summary</code> ni{" "}
          <code>Defense</code> con acumulados. Son las descargas que traen la
          media de la categoría y el acumulado del Castilla.
        </Notice>
      </div>
    );
  }

  const rLiga = resumenOpta(liga, "TOTAL");
  const rNuestro = resumenOpta(nuestro, "TOTAL");

  const hayComparacion = liga.length > 0 && nuestro.length > 0;

  const suyas = METRICAS_OPTA.filter((m) => m.fase === faseOpta);
  const soloLiga = SOLO_LIGA.filter((m) => m.fase === faseOpta);

  const grupos = [...new Set(suyas.map((m) => m.grupo))];

  /* Cuántas posesiones duran cada cosa: el reparto, no el total. */
  const duracionNuestra: Trozo[] = DURACION_POSESION.map((t) => ({
    etiqueta: t.etiqueta,
    valor: valorOpta(nuestro, "TOTAL", t.columna) ?? 0,
  }));

  const duracionLiga: Trozo[] = DURACION_POSESION.map((t) => ({
    etiqueta: t.etiqueta,
    valor: valorOpta(liga, "TOTAL", t.columna) ?? 0,
  }));

  const origen: Trozo[] = ORIGEN_ESTRATEGIA.map((o) => ({
    etiqueta: o.nombre,
    valor: valorOpta(liga, "TOTAL", o.columna) ?? 0,
  }));

  const tramos = POSESION_POR_TRAMO.map((t) => ({
    etiqueta: t.etiqueta,
    valor: valorOpta(nuestro, "TOTAL", t.columna),
  }));

  return (
    <>
      {/* Quiénes son los dos que se comparan. */}
      <div className="mt-5">
        <Panel
          title="Los agregados de Opta"
          subtitle="El Castilla de esta temporada contra la media de la categoría, con columnas que Wyscout no tiene"
          icon={Database}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              {
                rotulo: "El Castilla",
                r: rNuestro,
                oro: true,
                pie: "Lo que llevamos de temporada",
              },
              {
                rotulo: "La categoría",
                r: rLiga,
                oro: false,
                pie: "Todos los equipos, sumados partido a partido",
              },
            ].map((lado) => (
              <div
                key={lado.rotulo}
                className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5"
                style={
                  lado.oro
                    ? { borderColor: "rgb(var(--rmcf-gold-rgb, 200 169 107) / .35)" }
                    : undefined
                }
              >
                <p
                  className="text-[10px] uppercase tracking-[0.16em]"
                  style={{ color: lado.oro ? ORO : tinta(0.4) }}
                >
                  {lado.rotulo} · {lado.r.partidos} partidos
                </p>

                <p className="mt-1 text-xl font-semibold tabular-nums text-white">
                  {lado.r.ganados}-{lado.r.empates}-{lado.r.perdidos}
                </p>

                <p className="mt-0.5 text-[11px] tabular-nums text-white/45">
                  {lado.r.golesFavor}-{lado.r.golesContra} en goles ·{" "}
                  {formatea(lado.r.xg, "decimal")} de xG
                </p>

                <p className="mt-1 text-[11px] text-white/35">{lado.pie}</p>
              </div>
            ))}
          </div>

          <p className="mt-3 text-[11px] leading-relaxed text-white/40">
            El agregado de cien partidos <strong className="text-white/60">no
            es el Castilla</strong>: es la categoría entera. Se reconoce porque
            los duelos dan un 50,0 % clavado y los goles a favor igualan a los
            goles en contra —la aritmética de sumar a los dos equipos de cada
            partido—. Sirve de listón, que es justo lo que faltaba para leer
            estas columnas.
          </p>
        </Panel>
      </div>

      {/* La comparación métrica a métrica. */}
      <div className="mt-5">
        <Panel
          title="Contra la media de la categoría"
          subtitle="Todo por partido: tres partidos contra cien no se comparan en totales"
          icon={Compass}
          action={
            <div className="flex flex-wrap items-center rounded-xl border border-white/10 bg-white/[0.03] p-0.5">
              {[
                { key: "con" as const, label: "Con balón" },
                { key: "sin" as const, label: "Sin balón" },
                { key: "abp" as const, label: "Balón parado" },
              ].map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFaseOpta(f.key)}
                  aria-pressed={faseOpta === f.key}
                  className={`rounded-lg px-2.5 py-1.5 text-[11px] transition ${
                    faseOpta === f.key
                      ? "bg-[#C8A96B]/15 text-[#C8A96B]"
                      : "text-white/50 hover:text-white"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          }
        >
          {!hayComparacion ? (
            <p className="text-[12px] leading-relaxed text-white/45">
              Falta uno de los dos agregados, así que no hay con qué comparar.
            </p>
          ) : (
            <>
              <div className="mb-3 flex items-center gap-4 text-[10px] uppercase tracking-[0.16em]">
                <span className="flex items-center gap-1.5" style={{ color: ORO }}>
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-[2px]"
                    style={{ background: ORO }}
                  />
                  El Castilla
                </span>

                <span className="flex items-center gap-1.5 text-white/40">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-[2px]"
                    style={{ background: tinta(0.28) }}
                  />
                  La categoría
                </span>
              </div>

              <div className="space-y-5">
                {grupos.map((grupo) => (
                  <div key={grupo} className="min-w-0">
                    <p className="mb-2 text-[10px] uppercase tracking-[0.16em] text-white/40">
                      {grupo}
                    </p>

                    <div className="space-y-2.5">
                      {suyas
                        .filter((m) => m.grupo === grupo)
                        .map((m) => (
                          <FilaContraLaLiga
                            key={m.columna}
                            metrica={m}
                            nuestro={porPartidoOpta(nuestro, "TOTAL", m)}
                            liga={porPartidoOpta(liga, "TOTAL", m)}
                            casa={porPartidoOpta(liga, "Home", m)}
                            fuera={porPartidoOpta(liga, "Away", m)}
                          />
                        ))}
                    </div>
                  </div>
                ))}
              </div>

              <Lectura>{lecturaDeOpta(suyas, nuestro, liga)}</Lectura>
            </>
          )}

          <p className="mt-3 text-[11px] leading-relaxed text-white/40">
            Pulsa una métrica para ver cómo se lee y cuánto cambia en la
            categoría entre jugar en casa y jugar fuera. Con{" "}
            {rNuestro.partidos} partidos nuestros, esto son indicios: sirve para
            decidir qué mirar en el vídeo, no para cerrar una conclusión.
          </p>
        </Panel>
      </div>

      {/* Lo que sólo se sabe de la categoría. */}
      {soloLiga.length > 0 && (
        <div className="mt-5">
          <Panel
            title="Cómo es la categoría"
            subtitle="Columnas que sólo trae el agregado de la liga: no hay con qué compararnos, pero dan el listón"
            icon={Scale}
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {soloLiga.map((m) => (
                <div
                  key={m.columna}
                  className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5"
                >
                  <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">
                    {m.nombre}
                  </p>

                  <p className="mt-1 text-lg font-semibold tabular-nums text-white">
                    {formatea(porPartidoOpta(liga, "TOTAL", m), m.unidad)}
                  </p>

                  <p className="mt-1 text-[11px] leading-relaxed text-white/35">
                    {m.comoLeer}
                  </p>
                </div>
              ))}
            </div>

            <p className="mt-3 text-[11px] leading-relaxed text-white/40">
              Los valores que no son porcentaje van por partido. Es lo normal en
              esta categoría: un número nuestro sólo significa algo al lado de
              esto.
            </p>
          </Panel>
        </div>
      )}

      {/* La duración de las posesiones y el balón parado. */}
      <div className="mt-5 grid min-w-0 gap-5 lg:grid-cols-2">
        <Panel
          title="Cuánto dura cada posesión"
          subtitle="Lo más cerca que llega el informe a «cuánto tiempo con balón hace falta para llegar»"
          icon={Clock}
        >
          {duracionNuestra.some((t) => t.valor > 0) ? (
            <Composicion
              trozos={duracionNuestra}
              trozosLiga={
                duracionLiga.some((t) => t.valor > 0) ? duracionLiga : undefined
              }
              rotulo="El Castilla"
              rotuloLiga="La categoría"
              lectura={lecturaDeComposicion(duracionNuestra, duracionLiga, {
                sustantivo: "posesiones",
                verbo: "duran",
                trozo: "duración",
              })}
            />
          ) : (
            <p className="py-8 text-center text-[12px] text-white/35">
              Esta descarga no trae el reparto por duración.
            </p>
          )}

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {tramos.map((t) => (
              <div
                key={t.etiqueta}
                className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5"
              >
                <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">
                  Posesión {t.etiqueta}
                </p>

                <p className="mt-1 text-lg font-semibold tabular-nums text-white">
                  {formatea(t.valor, "porcentaje")}
                </p>
              </div>
            ))}
          </div>

          <p className="mt-3 text-[11px] leading-relaxed text-white/40">
            La posesión por tramos es sólo nuestra: en el agregado de la
            categoría da 50 % en los tres, porque suma a los dos equipos de cada
            partido y la posesión de uno es la del otro al revés.
          </p>
        </Panel>

        <Panel
          title="De dónde salen los goles de estrategia"
          subtitle="El reparto en la categoría: el listón de cuánto renta cada ensayo"
          icon={Flag}
        >
          <Composicion
            trozos={origen}
            rotulo="La categoría"
            lectura={lecturaDeComposicion(origen, undefined, {
              sustantivo: "goles de balón parado",
              verbo: "llegan de",
              trozo: "vía",
            })}
          />

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              { rotulo: "Córners por partido", columna: "Corners" },
              { rotulo: "xG de córner por partido", columna: "xGCrnrs" },
            ]
              .map((c) => {
                const met = OPTA_POR_COLUMNA.get(c.columna);

                return met
                  ? {
                      rotulo: c.rotulo,
                      nuestro: porPartidoOpta(nuestro, "TOTAL", met),
                      liga: porPartidoOpta(liga, "TOTAL", met),
                    }
                  : null;
              })
              .filter((c): c is NonNullable<typeof c> => c !== null)
              .map((c) => (
              <div
                key={c.rotulo}
                className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5"
              >
                <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">
                  {c.rotulo}
                </p>

                <p
                  className="mt-1 text-xl font-semibold tabular-nums"
                  style={{ color: ORO }}
                >
                  {formatea(c.nuestro, "decimal")}
                </p>

                <p className="mt-0.5 text-[11px] tabular-nums text-white/35">
                  la categoría, {formatea(c.liga, "decimal")}
                </p>
              </div>
            ))}
          </div>

          <p className="mt-3 text-[11px] leading-relaxed text-white/40">
            Sacar muchos córners y no sacarles xG es un problema de ensayo, no
            de volumen: la primera cifra la da el ataque y la segunda, el
            entrenamiento.
          </p>
        </Panel>
      </div>
    </>
  );
}

/**
 * Una métrica del Castilla al lado de la media de la categoría.
 *
 * Dos barras en la misma escala —la nuestra en oro, la de la liga apagada— y
 * la diferencia en tanto por ciento **con el sentido de la métrica puesto**:
 * en regates sufridos o en amarillas, tener menos sale en verde.
 */
function FilaContraLaLiga({
  metrica,
  nuestro,
  liga,
  casa,
  fuera,
}: {
  metrica: MetricaOpta;
  nuestro: number | null;
  liga: number | null;
  casa: number | null;
  fuera: number | null;
}) {
  const [abierto, setAbierto] = useState(false);

  const tope = Math.max(nuestro ?? 0, liga ?? 0, 0.0001);

  const dif = contraLaMedia(nuestro, liga, metrica.mejorAlto);

  return (
    <div className="min-w-0">
      <button
        type="button"
        onClick={() => setAbierto(!abierto)}
        aria-expanded={abierto}
        className="flex w-full items-baseline justify-between gap-3 text-left"
      >
        <span className="min-w-0 truncate text-[12.5px] text-white/70">
          {metrica.nombre}
        </span>

        <span className="shrink-0 text-[11px] tabular-nums">
          {dif === null ? (
            <span className="text-white/30">—</span>
          ) : (
            <span
              style={{
                color:
                  metrica.mejorAlto === null
                    ? tinta(0.45)
                    : dif >= 0
                      ? MEJOR
                      : PEOR,
              }}
            >
              {dif >= 0 ? "+" : ""}
              {dif.toFixed(0)} % {metrica.mejorAlto === null ? "" : "sobre la media"}
            </span>
          )}
        </span>
      </button>

      <div className="mt-1.5 space-y-1">
        {[
          { rotulo: "Nosotros", valor: nuestro, oro: true },
          { rotulo: "Liga", valor: liga, oro: false },
        ].map((lado) => (
          <div key={lado.rotulo} className="flex items-center gap-2">
            <span className="w-16 shrink-0 text-[10px] uppercase tracking-[0.12em] text-white/35">
              {lado.rotulo}
            </span>

            <span className="h-2.5 min-w-0 flex-1">
              <span
                className="block h-2.5 rounded-[3px]"
                style={{
                  width: `${((lado.valor ?? 0) / tope) * 100}%`,
                  background: lado.oro ? ORO : tinta(0.28),
                }}
              />
            </span>

            <span className="w-16 shrink-0 text-right text-[11px] tabular-nums text-white/60">
              {formatea(lado.valor, metrica.unidad)}
            </span>
          </div>
        ))}
      </div>

      {abierto && (
        <div className="mt-1.5 rounded-lg border border-white/[0.08] bg-white/[0.02] px-2.5 py-2">
          <p className="text-[11px] leading-relaxed text-white/50">
            {metrica.comoLeer}
          </p>

          {casa !== null && fuera !== null && (
            <p className="mt-1.5 text-[11px] tabular-nums text-white/35">
              En la categoría: {formatea(casa, metrica.unidad)} en casa contra{" "}
              {formatea(fuera, metrica.unidad)} fuera.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Lo que dice el conjunto de una fase.
 *
 * Se calcula con los mismos números del dibujo: dónde estamos más por encima
 * de la categoría y dónde más por debajo, con el sentido de cada métrica ya
 * puesto.
 */
function lecturaDeOpta(
  metricas: MetricaOpta[],
  nuestro: AmbitoOpta[],
  liga: AmbitoOpta[],
) {
  const con = metricas
    .map((m) => ({
      metrica: m,
      dif: contraLaMedia(
        porPartidoOpta(nuestro, "TOTAL", m),
        porPartidoOpta(liga, "TOTAL", m),
        m.mejorAlto,
      ),
    }))
    .filter(
      (x): x is { metrica: MetricaOpta; dif: number } =>
        x.dif !== null && x.metrica.mejorAlto !== null,
    );

  if (con.length === 0) return "No hay bastantes columnas comunes para comparar.";

  const orden = [...con].sort((a, b) => b.dif - a.dif);

  const mejor = orden[0];
  const peor = orden[orden.length - 1];

  const porEncima = con.filter((x) => x.dif > 0).length;

  return `De ${con.length} métricas con un sentido claro, el Castilla está por encima de la categoría en ${porEncima}. Lo más destacado, ${mejor.metrica.nombre.toLowerCase()} (${mejor.dif >= 0 ? "+" : ""}${mejor.dif.toFixed(0)} %); lo más flojo, ${peor.metrica.nombre.toLowerCase()} (${peor.dif >= 0 ? "+" : ""}${peor.dif.toFixed(0)} %).`;
}

/* ------------------------------------------------------------------ */
/*  LA PAREJA: LA PREGUNTA Y EL CRUCE                                  */
/* ------------------------------------------------------------------ */

/**
 * Dos bloques en paralelo que miran el mismo par de métricas.
 *
 * A la izquierda se llega por la pregunta —«¿entramos al área o nos quedamos
 * en la frontal?»— y a la derecha por los dos selectores. **No son dos vistas
 * distintas del dato: son dos puertas a la misma.** El par vive fuera de los
 * dos, así que elegir una pregunta mueve los selectores y tocar un selector
 * apaga la pregunta.
 *
 * Se usa dos veces con los mismos mandos y puntos distintos: en la liga cada
 * punto es un equipo; en nuestra historia, una temporada del Castilla.
 */
function ParDeMetricas({
  titulo,
  subtitulo,
  puntos,
  destacado,
  metricaX,
  metricaY,
  contraX,
  contraY,
  pregunta,
  onPregunta,
  onCambiaX,
  onCambiaY,
  nota,
  rotulaTodos = false,
}: {
  titulo: string;
  subtitulo: string;
  puntos: { equipo: string; x: number; y: number }[];
  destacado: string;
  metricaX: string;
  metricaY: string;
  contraX: boolean;
  contraY: boolean;
  pregunta: string | null;
  onPregunta: (p: Pregunta) => void;
  onCambiaX: (key: string) => void;
  onCambiaY: (key: string) => void;
  /** Lo que hay que saber de estos puntos en concreto. */
  nota?: string;
  /** Escribe el rótulo de todos los puntos: en nuestra historia, el año. */
  rotulaTodos?: boolean;
}) {
  const metX = METRICA_POR_KEY.get(metricaX);
  const metY = METRICA_POR_KEY.get(metricaY);

  return (
    <div className="mt-5 grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
      <Panel
        title="Pregúntaselo"
        subtitle="Por momento del juego. Al elegir una, se rellenan los dos ejes de al lado."
        icon={Compass}
      >
        <BateriaDePreguntas
          activa={pregunta}
          onElegir={onPregunta}
          metricaX={metricaX}
          metricaY={metricaY}
          contraX={contraX}
          contraY={contraY}
        />
      </Panel>

      <Panel
        title={titulo}
        subtitle={subtitulo}
        icon={Users}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <SelectorMetrica valor={metricaX} onCambio={onCambiaX} rotulo="Eje X" />

            <SelectorMetrica valor={metricaY} onCambio={onCambiaY} rotulo="Eje Y" />
          </div>
        }
      >
        {puntos.length < 3 ? (
          <p className="py-10 text-center text-[12px] text-white/35">
            Con menos de tres puntos no hay dibujo que leer.
          </p>
        ) : (
          <>
            <Dispersion
              puntos={puntos}
              etiquetaX={rotuloDeEje(metX?.nombre ?? "", contraX)}
              etiquetaY={rotuloDeEje(metY?.nombre ?? "", contraY)}
              unidadX={metX?.unidad ?? "decimal"}
              unidadY={metY?.unidad ?? "decimal"}
              destacado={destacado}
              rotulaTodos={rotulaTodos}
            />

            {metX && metY && (
              <Lectura>
                {lecturaDeDispersion(puntos, destacado, metX, metY)}
              </Lectura>
            )}
          </>
        )}

        {(contraX || contraY) && (
          <p className="mt-2 text-[11px] leading-relaxed text-white/40">
            Los ejes marcados «del rival» no son columnas del informe: salen de
            la fila del contrario de cada partido, que el informe también trae.
            Es la única manera de contestar a «cuánto concedemos».
          </p>
        )}

        {nota && (
          <p className="mt-2 text-[11px] leading-relaxed text-white/40">{nota}</p>
        )}
      </Panel>
    </div>
  );
}

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
function PanelEventos({
  partido,
  titulo,
}: {
  partido: PartidoEventos;
  titulo: string;
}) {
  const familias = porFamilia(partido.eventos);
  const tramos = porTramo(partido.eventos);
  const jugadores = porJugador(partido.eventos);
  const robo = tiempoHastaElRobo(partido.eventos);

  const topeTramo = Math.max(...tramos.map((t) => t.total), 1);
  const topeJug = Math.max(...jugadores.map((j) => j.total), 1);

  return (
    <>
      <div className="mt-5">
        <Notice title={titulo}>
          Esta descarga de Opta son las{" "}
          <strong className="text-white/75">acciones defensivas</strong>, una
          por una, con su jugador y su minuto. Wyscout da el total —«74
          recuperaciones»— pero no quién, ni cuándo, ni después de cuánto tiempo
          con el balón el rival. Eso es lo que hay aquí.{" "}
          <strong className="text-white/75">Del momento con balón no hay
          nada</strong>: ni un pase, ni un remate, ni una conducción. Es otra
          descarga distinta en Opta y hay que pedirla aparte.
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
