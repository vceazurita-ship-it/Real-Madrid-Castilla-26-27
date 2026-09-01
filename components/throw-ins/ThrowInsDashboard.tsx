"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import Papa from "papaparse";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { FileDown } from "lucide-react";
import * as htmlToImage from "html-to-image";
import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { AbpHeader, FilterDrawer } from "@/components/abp/ui";
import {
  AnalisisSeccion,
  type LectorAnalisis,
} from "@/components/abp/AnalisisSeccion";
import type { ClaveMetrica, Etiquetas } from "@/lib/abp/analisis";
import { ThrowInField } from "@/components/throw-ins/ThrowInField";
import ThrowInZoneMap from "@/components/throw-ins/ThrowInZoneMap";
import ThrowInFlow from "@/components/throw-ins/ThrowInFlow";
import {
  BANDA_LABEL,
  direccionDe,
  esFavorable,
  esProduccion,
  esProgresion,
  type Mode,
  parseBanda,
  parseResultado,
  read,
  type RecordRow,
  resultColor,
  resultInk,
  resumenDe,
} from "@/components/throw-ins/throwInModel";
import {
  COMPETICION_LABEL,
  ESTADOS,
  ESTADO_COLOR,
  ESTADO_LABEL,
  TRAMOS,
  TRAMO_LABEL,
  comparaJornadas,
  parseJornada,
  parseMarcador,
  parseMinuto,
} from "@/lib/abp/partido";

type ThrowInsDashboardProps = {
  csvUrl: string;
  title: string;
  mode: Mode;
};

const COLORS = ["#C8A96B", "#3B82F6", "#8B5CF6", "#10B981", "#F97316", "#EC4899"];

/**
 * Columnas que no se leen tal cual de la hoja. Filtro y gráfico comparten el
 * mismo accesor: si el gráfico agrupa "Área" y el filtro busca "Area", elegir
 * esa opción devolvía cero filas.
 */
/*
| Las tres claves que empiezan por «__» no son columnas de la hoja: se deducen
| de las que sí lo son.
|
|   __competicion  del prefijo de JORNADA ("PRETEMPORADA 03" · "LIGA 01")
|   __marcador     de "Resultado RMC" y "Resultado RIVAL", los goles de cada
|                  uno en ese momento del partido
|   __tramo        del minuto, en cuartos de hora
|
| Se enchufan como accesores porque el filtro, el gráfico y el recuento ya
| pasan todos por `valorDe`: así las tres lecturas nuevas se filtran y se
| grafican igual que cualquier columna, sin tocar nada más.
*/
const ACCESSORS: Record<string, (row: RecordRow) => string> = {
  Perfil: (row) => {
    const banda = parseBanda(row);
    return banda ? BANDA_LABEL[banda] : "Sin dato";
  },
  Zona_Caida: (row) => direccionDe(row).label,
  Resultado_Final: (row) => parseResultado(read(row, "Resultado_Final")).label,

  /* La jornada, escrita como se lee: "Jornada 1" y "Pretemporada 3". */
  JORNADA: (row) => parseJornada(read(row, "JORNADA")).etiqueta,

  __competicion: (row) =>
    COMPETICION_LABEL[parseJornada(read(row, "JORNADA")).competicion],

  __marcador: (row) => {
    const estado = parseMarcador(row).estado;

    return estado ? ESTADO_LABEL[estado] : "Sin dato";
  },

  __tramo: (row) => {
    const tramo = parseMinuto(row).tramo;

    return tramo ? TRAMO_LABEL[tramo] : "Sin dato";
  },

  /*
  | La parte, leída del número y no del texto.
  |
  | La columna «Tiempo» mezcla «1T», «2T», «T1» y «T2» en la misma hoja, así
  | que el desplegable ofrecía cuatro opciones para dos partes y elegir una
  | dejaba fuera la mitad de los saques.
  */
  __parte: (row) => {
    const parte = parseMinuto(row).parte;

    return parte ? `${parte}ª parte` : "Sin dato";
  },
};

/* El orden en el que se leen los valores de los ejes que no van por volumen. */
const ORDEN_FIJO: Record<string, string[]> = {
  __tramo: TRAMOS.map((tramo) => tramo.label),
  __marcador: ESTADOS.map((estado) => estado.label),
  __parte: ["1ª parte", "2ª parte"],
};

function valorDe(row: RecordRow, key: string) {
  const accessor = ACCESSORS[key];
  return accessor ? accessor(row) : read(row, key) || "Sin dato";
}

/**
 * Filtros por vista. La hoja defensiva no tiene Intencion, Sacador, Rutina,
 * Velocidad_Saque ni Repetir, y llama Defensa / Debilidad_Defensiva a lo que
 * en la ofensiva son Defensa_Rival / Debilidad_Rival.
 */
function filtersFor(mode: Mode): { key: string; label: string }[] {
  const common = [
    /* La competición manda sobre todo lo demás: un saque de banda de un
       amistoso de julio y uno de la jornada 1 no son la misma muestra. */
    { key: "__competicion", label: "Competición" },
    { key: "JORNADA", label: "Jornada" },
    { key: "Rival", label: "Rival" },
    { key: "__parte", label: "Parte" },
    { key: "__tramo", label: "Tramo de 15'" },
    { key: "__marcador", label: "Marcador" },
    { key: "Perfil", label: "Banda" },
    { key: "Zona_Saque", label: "Zona de saque" },
    { key: "Tipo_Envio", label: "Tipo de envío" },
    { key: "Zona_Caida", label: "Dirección del envío" },
    { key: "Calidad_Envio", label: "Calidad de envío" },
    { key: "N_Bloqueadores", label: "Nº bloqueadores" },
    { key: "Receptor", label: "Receptor" },
  ];

  const propios =
    mode === "offensive"
      ? [
          { key: "Intencion", label: "Intención" },
          { key: "Rutina", label: "Rutina" },
          { key: "Sacador", label: "Sacador" },
          { key: "Velocidad_Saque", label: "Velocidad de saque" },
          { key: "Repetir", label: "Repetible" },
          { key: "Defensa_Rival", label: "Defensa del rival" },
          { key: "Debilidad_Rival", label: "Debilidad del rival" },
        ]
      : [
          { key: "Defensa", label: "Nuestra defensa" },
          { key: "Debilidad_Defensiva", label: "Debilidad defensiva" },
        ];

  return [...common, ...propios, { key: "Resultado_Final", label: "Resultado" }];
}

function chartsFor(mode: Mode): { key: string; title: string }[] {
  const common = [
    { key: "__tramo", title: "Momento del partido" },
    { key: "__marcador", title: "Según el marcador" },
    { key: "Zona_Saque", title: mode === "offensive" ? "Zona de saque" : "Zona de saque del rival" },
    { key: "Perfil", title: "Banda" },
    { key: "Tipo_Envio", title: "Tipo de envío" },
    { key: "Zona_Caida", title: "Dirección del envío" },
    { key: "Calidad_Envio", title: "Calidad de envío" },
    { key: "Receptor", title: "Receptores" },
  ];

  const propios =
    mode === "offensive"
      ? [
          { key: "Intencion", title: "Intención" },
          { key: "Sacador", title: "Sacadores" },
          { key: "Rutina", title: "Rutina" },
          { key: "Velocidad_Saque", title: "Velocidad de saque" },
          { key: "Repetir", title: "¿Rutina repetible?" },
          { key: "Defensa_Rival", title: "Defensa del rival" },
          { key: "Debilidad_Rival", title: "Debilidad del rival" },
        ]
      : [
          { key: "Defensa", title: "Nuestra defensa" },
          { key: "Debilidad_Defensiva", title: "Debilidad defensiva" },
        ];

  return [...common, ...propios, { key: "Resultado_Final", title: "Resultado final" }];
}

/**
 * Reparte las filas por el valor de una columna.
 *
 * Casi todo se ordena por volumen, que es como se lee un ranking. El tramo del
 * partido y el marcador **no**: ahí el orden es el suyo —de la primera parte a
 * la última, y de ganando a perdiendo—, porque una gráfica de minutos
 * desordenada no se puede leer.
 */
function groupBy(rows: RecordRow[], key: string) {
  const cuenta = rows.reduce<Record<string, number>>((acc, row) => {
    const value = valorDe(row, key);
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});

  const orden = ORDEN_FIJO[key];

  if (orden) {
    return orden
      .filter((name) => cuenta[name])
      .map((name) => ({ name, total: cuenta[name] }));
  }

  return Object.entries(cuenta)
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total);
}

function SelectFilter({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  label: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] uppercase tracking-[0.16em] text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-white/10 bg-[#111827] px-3 py-2.5 text-sm text-white outline-none transition focus:border-[#C8A96B]/60"
      >
        <option value="ALL">Todos</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function MetricCard({
  label,
  value,
  hint,
  accent = false,
}: {
  label: string;
  value: string | number;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 md:p-5">
      <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${accent ? "text-[#E7D2A0]" : "text-white"}`}>{value}</p>
      {hint ? <p className="mt-1 text-[11px] leading-snug text-slate-500">{hint}</p> : null}
    </div>
  );
}

function DistributionChart({
  title,
  data,
  colorFor,
  analisis,
}: {
  title: string;
  data: { name: string; total: number }[];
  colorFor?: (name: string, index: number) => string;
  /** La lectura del gráfico: qué dice lo filtrado frente al global. */
  analisis?: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 md:p-6">
      <h2 className="mb-5 text-lg font-semibold text-white">{title}</h2>
      {data.length ? (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 8, left: -18, bottom: 48 }}>
              <CartesianGrid stroke="#1E293B" vertical={false} />
              <XAxis
                dataKey="name"
                angle={-28}
                textAnchor="end"
                interval={0}
                height={70}
                tick={{ fill: "#94A3B8", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis allowDecimals={false} tick={{ fill: "#94A3B8", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
                contentStyle={{ background: "#0B1728", border: "1px solid rgba(255,255,255,.12)", borderRadius: 12 }}
              />
              <Bar dataKey="total" radius={[7, 7, 0, 0]} maxBarSize={72}>
                {data.map((item, index) => (
                  <Cell
                    key={item.name}
                    fill={colorFor ? colorFor(item.name, index) : COLORS[index % COLORS.length]}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="py-20 text-center text-sm text-slate-500">Aún no hay registros para esta visualización.</p>
      )}

      {analisis ? (
        <div className="-mx-5 -mb-5 mt-5 md:-mx-6 md:-mb-6">{analisis}</div>
      ) : null}
    </section>
  );
}

const MAX_TABLA = 100;

export function ThrowInsDashboard({ csvUrl, title, mode }: ThrowInsDashboardProps) {
  const [rows, setRows] = useState<RecordRow[]>([]);

  /*
  | Saques anotados pero todavía sin codificar.
  |
  | La hoja se rellena en dos pasadas: primero se apuntan el minuto y el
  | marcador de cada saque —que es lo que se saca del vídeo y de BeSoccer en
  | una tarde— y después se codifica la acción. Esas filas a medias no pueden
  | entrar en los gráficos, porque «Sin dato» se comería todos los repartos,
  | pero **tampoco pueden desaparecer sin decirlo**: hasta ahora se filtraban
  | en silencio y la jornada 1 entera no existía para esta pantalla.
  */
  const [pendientes, setPendientes] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [exporting, setExporting] = useState(false);

  const contentRef = useRef<HTMLDivElement | null>(null);

  const isOffensive = mode === "offensive";
  const FILTERS = useMemo(() => filtersFor(mode), [mode]);
  const CHARTS = useMemo(() => chartsFor(mode), [mode]);

  useEffect(() => {
    let active = true;

    fetch(csvUrl)
      .then((response) => {
        if (!response.ok) throw new Error("No se pudo cargar la hoja de datos.");
        return response.text();
      })
      .then((csv) => {
        const parsed = Papa.parse<RecordRow>(csv, { header: true, skipEmptyLines: true });

        /* Codificado es lo que trae zona de saque; lo que sólo tiene minuto o
           marcador está anotado a medias y se cuenta aparte. */
        const conZona = parsed.data.filter((row) => read(row, "Zona_Saque"));

        const aMedias = parsed.data.filter(
          (row) =>
            !read(row, "Zona_Saque") &&
            (read(row, "Minuto") ||
              read(row, "Resultado RMC") ||
              read(row, "Resultado RIVAL")),
        );

        if (active) {
          setRows(conZona);
          setPendientes(aMedias.length);
        }
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Error cargando los datos.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [csvUrl]);

  const options = useMemo(() => {
    const map: Record<string, string[]> = {};

    FILTERS.forEach(({ key }) => {
      // Sólo ofrecemos valores presentes en la hoja; "Sin dato" se descarta
      // porque no distingue "no ocurrió" de "no se anotó".
      const values = [...new Set(rows.map((row) => valorDe(row, key)))].filter(
        (value) => value && value !== "Sin dato"
      );

      if (key === "JORNADA") {
        /* De liga a pretemporada y por número: "Jornada 10" después de la 9. */
        map[key] = [...new Set(rows.map((row) => read(row, "JORNADA")))]
          .filter(Boolean)
          .map(parseJornada)
          .sort(comparaJornadas)
          .map((una) => una.etiqueta);
      } else if (ORDEN_FIJO[key]) {
        map[key] = ORDEN_FIJO[key].filter((valor) => values.includes(valor));
      } else {
        map[key] = values.sort((a, b) => a.localeCompare(b, "es", { numeric: true }));
      }
    });

    return map;
  }, [rows, FILTERS]);

  const filtered = useMemo(
    () =>
      rows.filter((row) =>
        FILTERS.every(({ key }) => {
          const selected = filters[key] ?? "ALL";
          return selected === "ALL" || valorDe(row, key) === selected;
        })
      ),
    [rows, filters, FILTERS]
  );

  const activos = FILTERS.filter(({ key }) => (filters[key] ?? "ALL") !== "ALL");

  const totals = useMemo(() => resumenDe(filtered, mode), [filtered, mode]);

  /*
  | Cómo lee el análisis una fila de esta hoja.
  |
  | El saque de banda no tiene xG ni remate: lo que mide una jugada es si el
  | envío progresa, si el balón se queda en casa y si acaba en producción
  | —conquista de último tercio, ocasión o gol—. Por eso el pie de cada sección
  | enseña esas tres y no las del córner.
  |
  | «Producción» se lee desde el sujeto de la hoja: en la ofensiva es lo que
  | generamos y en la defensiva lo que nos generan. La retención, en cambio, es
  | siempre nuestra —recuperar un saque del rival es buena noticia también en la
  | página defensiva—, y el análisis la juzga aparte.
  */
  const lector = useMemo<LectorAnalisis<RecordRow>>(
    () => ({
      jornada: (row) => parseJornada(read(row, "JORNADA")),
      peligro: (row) => esProduccion(parseResultado(read(row, "Resultado_Final")), mode),
      gol: (row) => {
        const resultado = parseResultado(read(row, "Resultado_Final"));

        return (
          resultado.rank === 5 &&
          resultado.owner === (mode === "offensive" ? "rmcf" : "rival")
        );
      },
      /* Las dos que la hoja no registra: en falso, no en un cero que engañe. */
      remate: () => false,
      xg: () => 0,
      progresion: (row) => esProgresion(row),
      retencion: (row) => esFavorable(parseResultado(read(row, "Resultado_Final"))),
    }),
    [mode],
  );

  const etiquetas = useMemo<Etiquetas>(
    () => ({
      peligro: isOffensive ? "Producción" : "Peligro concedido",
      retencion: isOffensive ? "Retención" : "Recuperación",
      progresion: isOffensive ? "Progresión" : "Progresión rival",
      volumen: "Saques por jornada",
    }),
    [isOffensive],
  );

  const acompanan = useMemo<ClaveMetrica[]>(
    () => ["progresion", "retencion", "volumen"],
    [],
  );

  /*
  | El pie de lectura de cada sección.
  |
  | Va como función y no como componente para que todas las secciones comparen
  | contra lo mismo —`filtered` frente a `rows`— sin que ninguna vuelva a
  | filtrar por su cuenta.
  */
  const pie = (
    opciones: {
      metrica?: ClaveMetrica;
      dimension?: string;
      categoria?: (fila: RecordRow) => string;
      destacado?: boolean;
    } = {},
  ) => (
    <AnalisisSeccion
      filas={filtered}
      todas={rows}
      lector={lector}
      sentido={isOffensive ? "ofensivo" : "defensivo"}
      unidad="saques"
      etiquetas={etiquetas}
      acompanan={acompanan}
      {...opciones}
    />
  );

  const exportPng = useCallback(async () => {
    if (!contentRef.current) return;

    setExporting(true);

    try {
      // El PNG salía sin título ni filtros: dos capturas del mismo panel eran
      // indistinguibles. Esperamos a que React pinte la cabecera de exportación.
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

      const dataUrl = await htmlToImage.toPng(contentRef.current, {
        backgroundColor: "#0B0F14",
        pixelRatio: 2,
        cacheBust: true,
      });

      const link = document.createElement("a");
      link.download = `saque-banda-${isOffensive ? "ofensivo" : "defensivo"}-${new Date()
        .toISOString()
        .slice(0, 10)}.png`;
      link.href = dataUrl;
      link.click();
    } catch {
      setError("No se pudo generar la imagen del panel.");
    } finally {
      setExporting(false);
    }
  }, [isOffensive]);

  const tableRows = filtered.slice(0, MAX_TABLA);

  /* El minuto y el marcador van juntos y delante: sitúan la acción antes de
     leer nada más, que es para lo que se registran. */
  const tableColumns = isOffensive
    ? [
        "Jornada",
        "Rival",
        "Min.",
        "Marcador",
        "Sacador",
        "Banda",
        "Zona saque",
        "Envío",
        "Dirección",
        "Receptor",
        "Intención",
        "Rutina",
        "Resultado",
      ]
    : [
        "Jornada",
        "Rival",
        "Min.",
        "Marcador",
        "Banda",
        "Zona saque",
        "Envío",
        "Dirección",
        "Receptor",
        "Defensa",
        "Debilidad",
        "Resultado",
      ];

  const resumenFiltros = activos.length
    ? activos.map(({ key, label }) => `${label}: ${filters[key]}`).join(" · ")
    : "Sin filtros · todos los saques registrados";

  return (
    <div className="flex min-h-screen bg-[#0B0F14] text-white">
      <Sidebar />

      <main className="min-w-0 flex-1">
        <Topbar />

        <div className="px-4 py-7 md:px-8 md:py-10">
          <div className="mx-auto min-w-0 max-w-[1600px]">
            <AbpHeader
              area="RMCF Castilla · Colectivo"
              title={title}
              lead={
                <>
                  Análisis de saques de banda {isOffensive ? "a favor" : "en contra"}. Un
                  resultado sin sufijo es del RMCF y uno acabado en
                  &laquo;Rival&raquo; es del rival: sobre esa regla se calculan
                  retención, progresión y peligro.
                </>
              }
              aside={
                <button
                  type="button"
                  onClick={exportPng}
                  disabled={exporting || loading}
                  className="flex shrink-0 items-center gap-2 rounded-xl border border-[#C8A96B]/40 bg-[#C8A96B]/10 px-4 py-2.5 text-sm text-[#E7D2A0] transition hover:bg-[#C8A96B]/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <FileDown size={16} />
                  {exporting ? "Generando…" : "Descargar PNG"}
                </button>
              }
            />

            {/* Los filtros van plegados: son dieciocho y ocupaban la primera
                pantalla entera antes de enseñar un solo dato. El recuento de
                abajo queda siempre visible para que nadie lea una gráfica
                filtrada creyendo que la ve completa. */}
            <div className="mb-7 mt-6 space-y-2.5">
              <FilterDrawer
                activeCount={activos.length}
                summary={`${FILTERS.length} filtros disponibles`}
              >
                {FILTERS.map(({ key, label }) => (
                  <SelectFilter
                    key={key}
                    label={label}
                    value={filters[key] ?? "ALL"}
                    onChange={(value) => setFilters((prev) => ({ ...prev, [key]: value }))}
                    options={options[key] ?? []}
                  />
                ))}
              </FilterDrawer>

              {pendientes > 0 ? (
                <p className="rounded-xl border border-[#C8A96B]/25 bg-[#C8A96B]/[0.06] px-4 py-3 text-xs leading-relaxed text-[#E7D2A0]">
                  Hay {pendientes} {pendientes === 1 ? "saque anotado" : "saques anotados"} con
                  minuto y marcador que todavía no {pendientes === 1 ? "está" : "están"} codificad
                  {pendientes === 1 ? "o" : "os"}: sin zona de saque no entran en los gráficos.
                </p>
              ) : null}

              <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-xs text-white/40">
                <span>
                  {filtered.length} de {rows.length} saques registrados
                  {activos.length ? ` · ${activos.length} ${activos.length === 1 ? "filtro" : "filtros"} activos` : ""}
                </span>

                {activos.length ? (
                  <button
                    type="button"
                    onClick={() => setFilters({})}
                    className="rounded-full border border-white/10 px-3 py-1 text-white/70 transition hover:border-white/25 hover:text-white"
                  >
                    Limpiar filtros
                  </button>
                ) : null}
              </div>
            </div>

            {error ? (
              <p className="mb-5 rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200">{error}</p>
            ) : null}

            {loading ? (
              <p className="py-24 text-center text-slate-400">Cargando saques de banda…</p>
            ) : (
              <div ref={contentRef}>
                {/* Cabecera que sólo viaja en el PNG, para que la captura se
                    explique sola fuera de la aplicación. */}
                <div
                  style={{ display: exporting ? "block" : "none" }}
                  className="mb-6 rounded-2xl border border-[#C8A96B]/30 bg-white/[0.03] p-5"
                >
                  <p className="text-xs uppercase tracking-[0.24em] text-[#C8A96B]">RMCF Castilla · Colectivo</p>
                  <h2 className="mt-1 text-2xl font-semibold">{title}</h2>
                  <p className="mt-2 text-sm text-slate-300">{resumenFiltros}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {filtered.length} de {rows.length} saques registrados
                  </p>
                </div>

                <div className="mb-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                  <MetricCard
                    label={isOffensive ? "Saques registrados" : "Saques del rival"}
                    value={totals.acciones}
                    accent
                  />
                  <MetricCard
                    label={isOffensive ? "% Progresión" : "% Progresión concedida"}
                    value={`${Math.round(totals.progresionPct)}%`}
                    hint="Envíos hacia delante o al área"
                  />
                  <MetricCard
                    label={isOffensive ? "% Retención" : "% Recuperación"}
                    value={`${Math.round(totals.favorablePct)}%`}
                    hint="Acaba con el balón para el RMCF"
                  />
                  <MetricCard
                    label={isOffensive ? "Producción" : "Peligro concedido"}
                    value={`${totals.produccion} · ${Math.round(totals.produccionPct)}%`}
                    hint={
                      isOffensive
                        ? "Conquista de último tercio, ocasión o gol nuestro"
                        : "Conquista de último tercio, ocasión o gol del rival"
                    }
                  />
                  {!isOffensive ? (
                    <MetricCard
                      label="Transición"
                      value={`${totals.transicion} · ${Math.round(totals.transicionPct)}%`}
                      hint="Robamos el saque rival y llegamos a último tercio, ocasión o gol"
                    />
                  ) : null}
                  <MetricCard
                    label={isOffensive ? "Calidad media de envío" : "Calidad media del envío rival"}
                    value={totals.calidad === null ? "–" : totals.calidad.toFixed(1)}
                    hint="Escala 1 a 4"
                  />
                </div>

                {/* La lectura de cabecera, justo debajo de los KPI: qué dicen
                    esos números frente al global y frente a las jornadas
                    anteriores. */}
                <div className="mb-7">
                  {pie({
                    destacado: true,
                    dimension: "resultado",
                    categoria: (row) => valorDe(row, "Resultado_Final"),
                  })}
                </div>

                <ThrowInField rows={filtered} mode={mode} />

                <div className="mb-7 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
                  {pie({
                    dimension: "zona de saque",
                    categoria: (row) => valorDe(row, "Zona_Saque"),
                  })}
                </div>

                <ThrowInZoneMap rows={filtered} mode={mode} />

                <div className="mb-7 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
                  {pie({
                    dimension: "dirección del envío",
                    categoria: (row) => valorDe(row, "Zona_Caida"),
                  })}
                </div>

                <section className="mb-7 rounded-3xl border border-white/10 bg-white/[0.03] p-4 shadow-xl md:p-7">
                  <div className="mb-5">
                    <p className="text-xs uppercase tracking-[0.2em] text-[#C8A96B]">Flujo</p>
                    <h2 className="mt-1 text-xl font-semibold md:text-2xl">
                      Del saque al resultado {isOffensive ? "ofensivo" : "defensivo"}
                    </h2>
                  </div>

                  <ThrowInFlow rows={filtered} mode={mode} />

                  <div className="-mx-4 -mb-4 mt-5 overflow-hidden rounded-b-3xl md:-mx-7 md:-mb-7">
                    {pie({
                      dimension: "tipo de envío",
                      categoria: (row) => valorDe(row, "Tipo_Envio"),
                    })}
                  </div>
                </section>

                <div className="grid gap-5 xl:grid-cols-2">
                  {CHARTS.map(({ key, title: chartTitle }) => (
                    <DistributionChart
                      key={key}
                      title={chartTitle}
                      data={groupBy(filtered, key)}
                      colorFor={
                        key === "Resultado_Final"
                          ? (name) => resultColor(name)
                          : key === "__marcador"
                            ? (name) =>
                                ESTADO_COLOR[
                                  (ESTADOS.find((uno) => uno.label === name)
                                    ?.key ?? "empatando")
                                ]
                            : undefined
                      }
                      analisis={pie({
                        /* El tramo del partido se lee por volumen: de un cuarto
                           de hora importa cuántos saques trae, no qué
                           porcentaje de ellos acaba en producción. */
                        metrica: key === "__tramo" ? "volumen" : "peligro",
                        dimension: chartTitle.toLowerCase(),
                        categoria: (row) => valorDe(row, key),
                      })}
                    />
                  ))}
                </div>

                <section className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
                  {pie({
                    dimension: "rival",
                    categoria: (row) => valorDe(row, "Rival"),
                  })}

                  <div className="border-y border-white/10 px-5 py-4 md:px-6">
                    <h2 className="text-lg font-semibold">Registro de acciones</h2>
                    <p className="mt-1 text-sm text-slate-400">
                      {filtered.length > MAX_TABLA
                        ? `Mostrando las ${MAX_TABLA} primeras de ${filtered.length} acciones filtradas.`
                        : `${filtered.length} ${filtered.length === 1 ? "acción" : "acciones"} según los filtros aplicados.`}
                    </p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[1050px] text-left text-sm">
                      <thead className="bg-white/[0.03] text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                          {tableColumns.map((label) => (
                            <th key={label} className="px-4 py-3 font-medium">
                              {label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {tableRows.map((row, index) => {
                          const resultado = parseResultado(read(row, "Resultado_Final"));

                          return (
                            <tr key={`${read(row, "JORNADA")}-${index}`} className="text-slate-200">
                              <td className="px-4 py-3">
                                {parseJornada(read(row, "JORNADA")).corto}
                              </td>
                              <td className="px-4 py-3">{read(row, "Rival") || "-"}</td>
                              <td className="px-4 py-3 tabular-nums">
                                {(() => {
                                  const minuto = parseMinuto(row);

                                  if (minuto.minuto != null) return `${minuto.minuto}'`;

                                  /* Sin minuto, al menos la parte. */
                                  return minuto.parte ? `${minuto.parte}ª` : "-";
                                })()}
                              </td>
                              <td className="px-4 py-3 tabular-nums">
                                {(() => {
                                  const marcador = parseMarcador(row);

                                  if (!marcador.texto) return "-";

                                  return (
                                    <span
                                      style={{
                                        color: marcador.estado
                                          ? ESTADO_COLOR[marcador.estado]
                                          : undefined,
                                      }}
                                    >
                                      {marcador.texto}
                                    </span>
                                  );
                                })()}
                              </td>
                              {isOffensive ? <td className="px-4 py-3">{read(row, "Sacador") || "-"}</td> : null}
                              <td className="px-4 py-3">{valorDe(row, "Perfil")}</td>
                              <td className="px-4 py-3">{read(row, "Zona_Saque") || "-"}</td>
                              <td className="px-4 py-3">{read(row, "Tipo_Envio") || "-"}</td>
                              <td className="px-4 py-3">{direccionDe(row).label}</td>
                              <td className="px-4 py-3">{read(row, "Receptor") || "-"}</td>
                              {isOffensive ? (
                                <>
                                  <td className="px-4 py-3">{read(row, "Intencion") || "-"}</td>
                                  <td className="px-4 py-3">{read(row, "Rutina") || "-"}</td>
                                </>
                              ) : (
                                <>
                                  <td className="px-4 py-3">{read(row, "Defensa") || "-"}</td>
                                  <td className="px-4 py-3">{read(row, "Debilidad_Defensiva") || "-"}</td>
                                </>
                              )}
                              <td className="px-4 py-3 font-medium" style={{ color: resultInk(resultado.label) }}>
                                {resultado.label}
                              </td>
                            </tr>
                          );
                        })}
                        {!tableRows.length ? (
                          <tr>
                            <td colSpan={tableColumns.length} className="px-4 py-10 text-center text-slate-500">
                              Aún no hay acciones que mostrar.
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
