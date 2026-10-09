"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BarraFiltros, ESTILO_ELEGIDO, PastillaPretemporada } from "@/components/filtros/BarraFiltros";
import type { CSSProperties, ReactNode } from "react";
import Papa from "papaparse";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { FileDown } from "lucide-react";
import { capturaNodo } from "@/lib/export/captura";
import { descargaDataUrl } from "@/lib/export/lienzos";
import { traeCsv } from "@/lib/hojaCsv";
import {
  Conclusiones,
  Explicativo,
  useTextosExplicativos,
} from "@/components/ui/textos-analisis";
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
  parseZona,
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

  /*
  | La zona de saque, leída del número.
  |
  | La hoja ya escribe «Zona 1»…«Zona 3», pero el campo y el mapa de zonas la
  | leen con `parseZona`: al pulsar una celda se filtra por «Zona N» y, si un
  | día la hoja escribe «zona 2» o «Z2», el filtro tiene que seguir cuadrando
  | con lo que se pintó.
  */
  Zona_Saque: (row) => {
    const zona = parseZona(row);

    return zona ? `Zona ${zona}` : read(row, "Zona_Saque") || "Sin dato";
  },
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
 * Columnas que ya tienen su lectura en un panel propio más arriba.
 *
 * Su gráfico se sigue pintando —la barra se mira de un vistazo— pero sin pie:
 * repartir otra vez por lo mismo daba la misma frase dos veces en la página.
 */
const REPARTIDAS_ARRIBA = new Set([
  "Zona_Saque",
  "Zona_Caida",
  "Tipo_Envio",
  "Resultado_Final",
]);

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

/*
| LAS CONCLUSIONES DE ARRIBA.
|
| Tres a cinco frases cortas con lo que dicen las filas filtradas —las mismas
| que pintan los gráficos—. Qué se ve, no cómo se ha medido: el método vive en
| los textos explicativos, que van apagados salvo que se enciendan en Ajustes.
|
| Un valor sólo compite si trae al menos MIN_MUESTRA saques: con dos, un 100 %
| es ruido.
*/
const MIN_MUESTRA = 3;

type Grupo = { key: string; valor: string; n: number; favorables: number; produccion: number };

const pctTexto = (parte: number, total: number) =>
  `${Math.round(total ? (parte / total) * 100 : 0)} %`;

const mayuscula = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1);

/* Cómo se nombra un valor dentro de una frase. */
function nombreDe(key: string, valor: string) {
  switch (key) {
    case "Tipo_Envio":
      return `envío ${valor.toLowerCase()}`;
    case "Zona_Saque":
      return /^zona/i.test(valor) ? valor.replace(/^zona/i, "zona") : `zona ${valor}`;
    case "Perfil":
    case "Zona_Caida":
      return valor.toLowerCase();
    case "Receptor":
      return `receptor «${valor}»`;
    case "Intencion":
      return `intención «${valor}»`;
    default:
      return valor;
  }
}

function gruposDe(rows: RecordRow[], key: string, mode: Mode): Grupo[] {
  const mapa = new Map<string, Grupo>();

  rows.forEach((row) => {
    const valor = valorDe(row, key);

    if (!valor || valor === "Sin dato") return;

    const resultado = parseResultado(read(row, "Resultado_Final"));
    const grupo = mapa.get(valor) ?? { key, valor, n: 0, favorables: 0, produccion: 0 };

    grupo.n += 1;
    if (esFavorable(resultado)) grupo.favorables += 1;
    if (esProduccion(resultado, mode)) grupo.produccion += 1;

    mapa.set(valor, grupo);
  });

  return [...mapa.values()].filter((grupo) => grupo.n >= MIN_MUESTRA);
}

/* El mejor (o peor) grupo por una tasa; con empate, el de más muestra. */
function extremo(grupos: Grupo[], tasa: (g: Grupo) => number, mayor: boolean) {
  return [...grupos].sort(
    (a, b) => (mayor ? tasa(b) - tasa(a) : tasa(a) - tasa(b)) || b.n - a.n,
  )[0];
}

const retencionDe = (g: Grupo) => g.favorables / g.n;
const produccionTasa = (g: Grupo) => g.produccion / g.n;

function conclusionesDe(rows: RecordRow[], mode: Mode): string[] {
  if (!rows.length) return [];

  const ofensivo = mode === "offensive";
  const resumen = resumenDe(rows, mode);
  const total = rows.length;
  const favorables = Math.round((resumen.favorablePct / 100) * total);
  const goles = rows.filter((row) => {
    const resultado = parseResultado(read(row, "Resultado_Final"));

    return resultado.rank === 5 && resultado.owner === (ofensivo ? "rmcf" : "rival");
  }).length;

  const frases: string[] = [];

  /* 1. Volumen y cómo acaban. */
  const llegan = `${resumen.produccion} ${
    ofensivo
      ? resumen.produccion === 1 ? "llega" : "llegan"
      : resumen.produccion === 1 ? "le llega" : "le llegan"
  } a último tercio`;

  frases.push(
    ofensivo
      ? `${total} ${total === 1 ? "saque" : "saques"}: ${pctTexto(favorables, total)} conservados, ${llegan}${
          goles ? ` (${goles} ${goles === 1 ? "gol" : "goles"})` : ""
        }.`
      : `${total} ${total === 1 ? "saque" : "saques"} del rival: recuperamos el ${pctTexto(
          favorables,
          total,
        )}, ${llegan}${goles ? ` (${goles} ${goles === 1 ? "gol" : "goles"} en contra)` : ""}.`,
  );

  /* 2. Dónde y cómo funciona mejor (para nosotros). */
  const zonas = [
    ...gruposDe(rows, "Zona_Saque", mode),
    ...gruposDe(rows, "Perfil", mode),
  ];
  const envios = gruposDe(rows, "Tipo_Envio", mode);

  if (ofensivo) {
    const productivas = zonas.filter((g) => g.produccion > 0);

    if (productivas.length) {
      const mejor = extremo(productivas, produccionTasa, true);

      frases.push(
        `${mayuscula(nombreDe(mejor.key, mejor.valor))}, la más productiva: ${mejor.produccion} de ${mejor.n} a último tercio.`,
      );
    }

    if (envios.length >= 2) {
      const mejor = extremo(envios, retencionDe, true);

      frases.push(
        `${mayuscula(nombreDe(mejor.key, mejor.valor))}, el más fiable: ${pctTexto(mejor.favorables, mejor.n)} conservados.`,
      );
    }
  } else {
    if (zonas.length >= 2) {
      const mejor = extremo(zonas, retencionDe, true);

      if (mejor.favorables > 0) {
        frases.push(
          `Más robos en ${nombreDe(mejor.key, mejor.valor)}: recuperamos el ${pctTexto(mejor.favorables, mejor.n)}.`,
        );
      }
    }

    const peligrosas = [...zonas, ...envios].filter((g) => g.produccion > 0);

    if (peligrosas.length) {
      const peor = extremo(peligrosas, produccionTasa, true);

      frases.push(
        `Su vía más peligrosa: ${nombreDe(peor.key, peor.valor)}, ${peor.produccion} de ${peor.n} a último tercio.`,
      );
    }

    if (resumen.transicion > 0) {
      frases.push(
        `Tras robar: ${resumen.transicion} ${resumen.transicion === 1 ? "transición" : "transiciones"} a último tercio o más.`,
      );
    }
  }

  /* 3. Receptor o intención más eficaz (en defensa, su receptor más cómodo). */
  const receptores = gruposDe(rows, "Receptor", mode);
  const intenciones = ofensivo
    ? gruposDe(rows, "Intencion", mode)
    : [];
  const personas = [...receptores, ...intenciones];

  if (personas.length >= 2) {
    if (ofensivo) {
      const mejor = extremo(personas, (g) => produccionTasa(g) * 2 + retencionDe(g), true);

      frases.push(
        `Más eficaz: ${nombreDe(mejor.key, mejor.valor)} (${pctTexto(mejor.favorables, mejor.n)} conservados, ${mejor.produccion} a último tercio).`,
      );
    } else {
      const comodo = extremo(receptores.length >= 2 ? receptores : personas, retencionDe, false);

      frases.push(
        `Su ${nombreDe(comodo.key, comodo.valor)}, el más cómodo: recuperamos solo el ${pctTexto(comodo.favorables, comodo.n)}.`,
      );
    }
  }

  /* 4. Punto débil (sólo en ataque: en defensa ya lo dice la vía peligrosa). */
  if (ofensivo) {
    const candidatos = [
      ...envios,
      ...gruposDe(rows, "Zona_Caida", mode),
      ...zonas,
    ];
    const global = favorables / total;

    if (candidatos.length >= 2) {
      const peor = extremo(candidatos, retencionDe, false);

      if (retencionDe(peor) < global) {
        frases.push(
          `Punto débil: ${nombreDe(peor.key, peor.valor)}, solo ${pctTexto(peor.favorables, peor.n)} conservados.`,
        );
      }
    }
  }

  return frases.slice(0, 5);
}

function SelectFilter({
  value,
  onChange,
  options,
  label,
  allLabel = "Todos",
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  label: string;
  /** Cómo se llama «sin filtro» en este desplegable. */
  allLabel?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] uppercase tracking-[0.16em] text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-white/10 bg-[#111827] px-3 py-2.5 text-sm text-white outline-none transition focus:border-[#C8A96B]/60"
      >
        <option value="ALL">{allLabel}</option>
        {/* Un valor elegido pulsando un gráfico puede no estar en la lista
            —«Sin dato» no se ofrece—: si no se añade, el desplegable
            enseñaba «Todos» con el filtro puesto. */}
        {value !== "ALL" && !options.includes(value) ? (
          <option value={value}>{value}</option>
        ) : null}
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
      {/* La ayuda de cada KPI cuenta cómo se mide: va con los textos explicativos. */}
      {hint ? <Explicativo><p className="mt-1 text-[11px] leading-snug text-slate-500">{hint}</p></Explicativo> : null}
    </div>
  );
}

function DistributionChart({
  title,
  data,
  colorFor,
  analisis,
  seleccionado,
  onPulsar,
}: {
  title: string;
  data: { name: string; total: number }[];
  colorFor?: (name: string, index: number) => string;
  /** La lectura del gráfico: qué dice lo filtrado frente al global. */
  analisis?: ReactNode;
  /** El valor por el que se está filtrando esta columna, si lo hay. */
  seleccionado?: string;
  /** Pulsar una barra filtra por su valor; pulsarla otra vez lo quita. */
  onPulsar?: (name: string) => void;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 md:p-6">
      <h2 className="mb-5 text-lg font-semibold text-white">{title}</h2>
      {data.length ? (
        <div className="h-72" title={onPulsar ? "Pulsa para filtrar" : undefined}>
          <ResponsiveContainer width="100%" height="100%">
            {/*
            | El clic va en el gráfico y no en la barra: con una barra de un
            | saque al lado de otra de cuarenta, la pequeña era un píxel. Así
            | vale toda la franja de la categoría.
            */}
            <BarChart
              data={data}
              margin={{ top: 10, right: 8, left: -18, bottom: 48 }}
              style={onPulsar ? { cursor: "pointer" } : undefined}
              onClick={(estado) => {
                /* Fuera de la zona de dibujo (un rótulo del eje, el margen)
                   recharts manda el índice a null, y Number(null) es 0:
                   sin esta guarda se filtraba por la primera barra. */
                if (estado?.activeIndex == null) return;

                const indice = Number(estado.activeIndex);
                const item = Number.isInteger(indice) ? data[indice] : undefined;

                if (item && onPulsar) onPulsar(item.name);
              }}
            >
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
                    /* Filtrando por esta columna se siguen pintando todas: la
                       elegida entera y con borde oro, las demás apagadas. */
                    fillOpacity={seleccionado && seleccionado !== item.name ? ESTILO_ELEGIDO.apagado : 1}
                    stroke={seleccionado === item.name ? "#C8A96B" : undefined}
                    strokeWidth={seleccionado === item.name ? 2 : 0}
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

/*
| Una celda de la tabla que filtra por su valor.
|
| Lo que se ve no cambia —el minuto sigue siendo «37'» aunque filtre por su
| cuarto de hora—; lo que se filtra es lo que lee `valorDe`, que es lo mismo
| que lee el desplegable. «Sin dato» no filtra: no distingue «no ocurrió» de
| «no se anotó».
*/
function CeldaFiltro({
  valor,
  activo,
  onPulsar,
  className = "",
  style,
  children,
}: {
  valor: string;
  activo: boolean;
  onPulsar: () => void;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const filtrable = Boolean(valor) && valor !== "Sin dato";

  return (
    <td className={`px-4 py-3 ${className}`}>
      {filtrable ? (
        <button
          type="button"
          title="Pulsa para filtrar"
          onClick={onPulsar}
          style={style}
          className={`-mx-1.5 rounded-md px-1.5 py-0.5 text-left transition hover:bg-white/[0.06] ${
            activo ? "bg-[#C8A96B]/10 outline outline-1 outline-[#C8A96B]" : ""
          }`}
        >
          {children}
        </button>
      ) : (
        <span style={style}>{children}</span>
      )}
    </td>
  );
}

const MAX_TABLA = 100;

/* La opción del desplegable de competición que deja fuera sólo los amistosos. */
const SIN_PRETEMPORADA = "Sin pretemporada";

export function ThrowInsDashboard({ csvUrl, title, mode }: ThrowInsDashboardProps) {
  /* Todo lo codificado de la hoja, pretemporada incluida. */
  const [todasLasFilas, setRows] = useState<RecordRow[]>([]);

  /*
  | La pretemporada, fuera salvo que se pida.
  |
  | Los amistosos de julio son otra muestra —rivales de otra categoría,
  | rotaciones, rutinas a medio montar— y mezclados con la liga movían todos
  | los porcentajes. Por defecto la página es sólo de competición; se mete con
  | «Incluir pretemporada» o eligiendo «Pretemporada» en el desplegable de
  | competición.
  */
  const [incluirPretemporada, setIncluirPretemporada] = useState(false);

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
  const [filasPendientes, setPendientes] = useState<RecordRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [exporting, setExporting] = useState(false);

  const contentRef = useRef<HTMLDivElement | null>(null);

  const isOffensive = mode === "offensive";
  /* Lo que explica el método sólo sale si el administrador lo enciende. */
  const explicativos = useTextosExplicativos();
  const FILTERS = useMemo(() => filtersFor(mode), [mode]);
  const CHARTS = useMemo(() => chartsFor(mode), [mode]);

  const PRETEMPORADA = COMPETICION_LABEL.amistoso;

  const hayPretemporada = useMemo(
    () => todasLasFilas.some((row) => valorDe(row, "__competicion") === PRETEMPORADA),
    [todasLasFilas, PRETEMPORADA],
  );

  /* Elegir «Pretemporada» en el desplegable ya es pedirla: no hace falta
     además el interruptor. */
  const pretemporadaDentro =
    incluirPretemporada || filters.__competicion === PRETEMPORADA;

  const soloLiga = hayPretemporada && !pretemporadaDentro;

  /*
  | Las filas de las que parte TODO: gráficos, tabla, KPI, frases y el «de
  | N» de los recuentos. Quitar aquí la pretemporada es quitarla de la página
  | entera sin que ningún bloque tenga que acordarse.
  */
  /* Los saques a medias, con la misma regla: sin pretemporada si está fuera. */
  const pendientes = soloLiga
    ? filasPendientes.filter((row) => valorDe(row, "__competicion") !== PRETEMPORADA).length
    : filasPendientes.length;

  const rows = useMemo(
    () =>
      soloLiga
        ? todasLasFilas.filter((row) => valorDe(row, "__competicion") !== PRETEMPORADA)
        : todasLasFilas,
    [todasLasFilas, soloLiga, PRETEMPORADA],
  );

  useEffect(() => {
    let active = true;

    /*
    | Por `traeCsv` y no con un `fetch` a pelo.
    |
    | Es una hoja publicada de Google y se guarda mientras dure la pestaña:
    | pedirla directamente la volvía a descargar entera cada vez que se entraba
    | aquí, y se entra y se sale del menú todo el rato. Las dos páginas de
    | córner ya lo hacían así; ésta se había quedado atrás.
    */
    traeCsv(csvUrl)
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
          setPendientes(aMedias);
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
      /* La competición se ofrece entera aunque la pretemporada esté fuera:
         elegirla en el desplegable es la otra forma de meterla. */
      const origen = key === "__competicion" ? todasLasFilas : rows;
      const values = [...new Set(origen.map((row) => valorDe(row, key)))].filter(
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
  }, [rows, todasLasFilas, FILTERS]);

  /*
  | Cada fila, leída una vez por cada filtro.
  |
  | Ahora se filtra muchas veces por pantalla —cada gráfico con todos los
  | filtros menos el suyo— y `valorDe` busca la columna por nombre en cada
  | llamada: con la tabla hecha, filtrar es comparar cadenas.
  */
  const valores = useMemo(
    () =>
      rows.map((row) => {
        const uno: Record<string, string> = {};

        FILTERS.forEach(({ key }) => {
          uno[key] = valorDe(row, key);
        });

        return uno;
      }),
    [rows, FILTERS],
  );

  /*
  | Las filas filtradas por todo MENOS por las columnas que se le digan.
  |
  | Es lo que recibe cada gráfico: si el de banda se filtrara también por la
  | banda elegida, se quedaría con una sola barra y no habría manera de ver
  | —ni de pulsar— las otras. Así se pintan todas, la elegida resaltada.
  */
  const filtradoSin = useCallback(
    (excluir: string[]) =>
      rows.filter((_, indice) =>
        FILTERS.every(({ key }) => {
          if (excluir.includes(key)) return true;

          const selected = filters[key] ?? "ALL";

          return selected === "ALL" || valores[indice][key] === selected;
        }),
      ),
    [rows, valores, filters, FILTERS],
  );

  const filtered = useMemo(() => filtradoSin([]), [filtradoSin]);

  const activos = FILTERS.filter(({ key }) => (filters[key] ?? "ALL") !== "ALL");

  /*
  | Pulsar un elemento filtra; pulsarlo otra vez quita el filtro.
  |
  | Va por pares porque una celda del campo es dos columnas a la vez —banda y
  | zona—: si ya están las dos puestas con esos valores, se quitan las dos; si
  | no, se ponen. El desplegable de Filtros lee el mismo estado, así que queda
  | al día solo.
  */
  const alternar = useCallback(
    (pares: [string, string][]) => {
      const validos = pares.filter(([key]) => FILTERS.some((uno) => uno.key === key));

      if (!validos.length) return;

      setFilters((prev) => {
        const yaEstan = validos.every(([key, valor]) => (prev[key] ?? "ALL") === valor);
        const next = { ...prev };

        validos.forEach(([key, valor]) => {
          if (yaEstan) delete next[key];
          else next[key] = valor;
        });

        return next;
      });
    },
    [FILTERS],
  );

  const quitar = useCallback((keys: string[]) => {
    setFilters((prev) => {
      const next = { ...prev };

      keys.forEach((key) => delete next[key]);

      return next;
    });
  }, []);

  /* Las columnas que pinta cada bloque: a cada uno le llegan sin esos filtros. */
  /*
  | El campo y el mapa de zonas pintan, además de la banda y la zona, la
  | dirección del envío (flechas y desglose) y el resultado (desglose de la
  | celda): les llegan también sin esos filtros. Si no, al pulsar una flecha
  | desaparecían las demás y la elegida salía al 100 %.
  */
  const filasCampo = useMemo(
    () => filtradoSin(["Perfil", "Zona_Saque", "Zona_Caida", "Resultado_Final"]),
    [filtradoSin],
  );
  const filasFlujo = useMemo(
    () =>
      filtradoSin(["Perfil", "Zona_Saque", "Tipo_Envio", "Zona_Caida", "Intencion", "Resultado_Final"]),
    [filtradoSin],
  );

  const totals = useMemo(() => resumenDe(filtered, mode), [filtered, mode]);

  /* Las frases de arriba, con las mismas filas filtradas que los gráficos. */
  const conclusiones = useMemo(() => conclusionesDe(filtered, mode), [filtered, mode]);

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
      /* Agrupar por resultado y medir producción es circular: ver el pie. */
      dimensionDerivada?: boolean;
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

      /* `capturaNodo`: el panel entero a 2× se pasa del lienzo de un iPad,
         y en Safari la primera pasada sale sin los escudos. */
      const { dataUrl } = await capturaNodo(contentRef.current, {
        backgroundColor: "#0B0F14",
        pixelRatio: 2,
        cacheBust: true,
      });

      await descargaDataUrl(
        dataUrl,
        `saque-banda-${isOffensive ? "ofensivo" : "defensivo"}-${new Date().toISOString().slice(0, 10)}.png`,
      );
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

  const resumenFiltros = [
    ...(soloLiga ? ["Sólo liga (sin pretemporada)"] : []),
    ...activos.map(({ key, label }) => `${label}: ${filters[key]}`),
  ].join(" · ") || "Sin filtros · todos los saques registrados";

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
                explicativos ? (
                  <>
                    Análisis de saques de banda {isOffensive ? "a favor" : "en contra"}. Un
                    resultado sin sufijo es del RMCF y uno acabado en
                    &laquo;Rival&raquo; es del rival: sobre esa regla se calculan
                    retención, progresión y peligro.
                  </>
                ) : undefined
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
                {FILTERS.map(({ key, label }) =>
                  key === "__competicion" ? (
                    /*
                    | La competición lleva además el interruptor de la
                    | pretemporada: «Todas» a secas era ambiguo ahora que por
                    | defecto se deja fuera.
                    */
                    <SelectFilter
                      key={key}
                      label={label}
                      value={filters[key] ?? (pretemporadaDentro || !hayPretemporada ? "ALL" : SIN_PRETEMPORADA)}
                      allLabel={hayPretemporada ? "Liga y pretemporada" : "Todas"}
                      onChange={(value) => {
                        if (value === SIN_PRETEMPORADA) {
                          setIncluirPretemporada(false);
                          quitar([key]);
                        } else if (value === "ALL") {
                          setIncluirPretemporada(true);
                          quitar([key]);
                        } else {
                          setFilters((prev) => ({ ...prev, [key]: value }));
                        }
                      }}
                      options={
                        hayPretemporada
                          ? [SIN_PRETEMPORADA, ...(options[key] ?? [])]
                          : options[key] ?? []
                      }
                    />
                  ) : (
                  <SelectFilter
                    key={key}
                    label={label}
                    value={filters[key] ?? "ALL"}
                    onChange={(value) =>
                      value === "ALL"
                        ? quitar([key])
                        : setFilters((prev) => ({ ...prev, [key]: value }))
                    }
                    options={options[key] ?? []}
                  />
                  ),
                )}
              </FilterDrawer>

              {pendientes > 0 && explicativos ? (
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
                  {soloLiga ? " · sin pretemporada" : ""}
                </span>

                {hayPretemporada && filters.__competicion !== PRETEMPORADA ? (
                  <label className="flex cursor-pointer items-center gap-2 text-white/70">
                    <input
                      type="checkbox"
                      checked={incluirPretemporada}
                      onChange={(event) => setIncluirPretemporada(event.target.checked)}
                      className="h-3.5 w-3.5 accent-[#C8A96B]"
                    />
                    Incluir pretemporada
                  </label>
                ) : null}

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

            {/*
            | LO QUE SE ESTÁ FILTRANDO, SIEMPRE A LA VISTA.
            |
            | Casi todo lo que se pinta en la página filtra al pulsarlo, y se
            | pulsa muy abajo —en un gráfico o en la tabla—: el resumen de
            | arriba ya no se ve desde ahí. La barra se pega bajo la cabecera
            | mientras haya filtros, para que nadie lea una gráfica filtrada
            | creyendo que la ve completa, y cada filtro se quita desde ella.
            */}
            <BarraFiltros
              className="-mt-4 mb-6"
              previo={hayPretemporada ? <PastillaPretemporada incluida={pretemporadaDentro} onCambiar={setIncluirPretemporada} /> : undefined}
              cuenta={{ vistas: filtered.length, total: rows.length, unidad: "saques" }}
              onQuitarTodo={() => setFilters({})}
              pastillas={activos.map(({ key, label }) => ({ clave: key, rotulo: label, valor: String(filters[key]), onQuitar: () => quitar([key]) }))}
              pie={
                /* Sólo liga y nada que enseñar: que no parezca un fallo. */
                soloLiga && !filtered.length ? (
                  <button
                    type="button"
                    onClick={() => setIncluirPretemporada(true)}
                    className="mt-2 w-full rounded-2xl border border-[#C8A96B]/25 bg-[#0B0F14]/90 px-4 py-3 text-left text-sm text-slate-300 backdrop-blur-xl transition hover:border-[#C8A96B]/50"
                  >
                    No hay acciones de liga con estos filtros ·{" "}
                    <span className="text-[#E7D2A0] underline underline-offset-2">incluir pretemporada</span>
                  </button>
                ) : null
              }
            />

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

                <Conclusiones items={conclusiones} className="mb-7" />

                <div className="mb-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                  <MetricCard
                    label={isOffensive ? "Saques registrados" : "Saques del rival"}
                    value={totals.acciones}
                    accent
                  />
                  <MetricCard
                    label={isOffensive ? "% Progresión" : "% Progresión concedida"}
                    value={`${Math.round(totals.progresionPct)}%`}
                    hint={
                      isOffensive
                        ? "Envíos hacia delante o al área"
                        : "Envíos del rival hacia delante o al área"
                    }
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
                    dimensionDerivada: true,
                    categoria: (row) => valorDe(row, "Resultado_Final"),
                  })}
                </div>

                <ThrowInField rows={filasCampo} mode={mode} filtros={filters} onFiltrar={alternar} />

                <div className="mb-7 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
                  {pie({
                    dimension: "zona de saque",
                    categoria: (row) => valorDe(row, "Zona_Saque"),
                  })}
                </div>

                <ThrowInZoneMap rows={filasCampo} mode={mode} filtros={filters} onFiltrar={alternar} />

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

                  <ThrowInFlow
                    rows={filasFlujo}
                    activas={filtered}
                    mode={mode}
                    filtros={filters}
                    onFiltrar={alternar}
                  />

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
                      data={groupBy(filtradoSin([key]), key)}
                      seleccionado={filters[key] && filters[key] !== "ALL" ? filters[key] : undefined}
                      onPulsar={(name) => alternar([[key, name]])}
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
                      analisis={
                        /*
                        | Sin pie cuando ya lo ha dicho un panel de arriba.
                        |
                        | La zona de saque la lee el campo, la dirección del
                        | envío el mapa de zonas, el tipo de envío el flujo y el
                        | resultado la lectura de cabecera. Estos gráficos
                        | reparten **por la misma columna**, así que su pie
                        | salía con la frase palabra por palabra repetida.
                        */
                        REPARTIDAS_ARRIBA.has(key) ? undefined : (
                          pie({
                            /* El tramo del partido se lee por volumen: de un
                               cuarto de hora importa cuántos saques trae, no
                               qué porcentaje acaba en producción. */
                            metrica: key === "__tramo" ? "volumen" : "peligro",
                            dimension: chartTitle.toLowerCase(),
                            categoria: (row) => valorDe(row, key),
                          })
                        )
                      }
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

                          /* Cada celda categórica filtra por lo que lee el
                             desplegable de esa columna, no por lo que pinta. */
                          const celda = (
                            key: string,
                            contenido: ReactNode,
                            extra: { className?: string; style?: CSSProperties } = {},
                          ) => {
                            const valor = valorDe(row, key);

                            return (
                              <CeldaFiltro
                                valor={valor}
                                activo={filters[key] === valor}
                                onPulsar={() => alternar([[key, valor]])}
                                className={extra.className}
                                style={extra.style}
                              >
                                {contenido}
                              </CeldaFiltro>
                            );
                          };

                          return (
                            <tr key={`${read(row, "JORNADA")}-${index}`} className="text-slate-200">
                              {celda("JORNADA", parseJornada(read(row, "JORNADA")).corto)}
                              {celda("Rival", read(row, "Rival") || "-")}
                              {/* El minuto filtra por su cuarto de hora: un
                                  filtro de un solo minuto no sirve de nada. */}
                              {celda(
                                "__tramo",
                                (() => {
                                  const minuto = parseMinuto(row);

                                  if (minuto.minuto != null) return `${minuto.minuto}'`;

                                  /* Sin minuto, al menos la parte. */
                                  return minuto.parte ? `${minuto.parte}ª` : "-";
                                })(),
                                { className: "tabular-nums" },
                              )}
                              {(() => {
                                const marcador = parseMarcador(row);

                                return celda("__marcador", marcador.texto || "-", {
                                  className: "tabular-nums",
                                  style: {
                                    color: marcador.estado
                                      ? ESTADO_COLOR[marcador.estado]
                                      : undefined,
                                  },
                                });
                              })()}
                              {isOffensive ? celda("Sacador", read(row, "Sacador") || "-") : null}
                              {celda("Perfil", valorDe(row, "Perfil"))}
                              {celda("Zona_Saque", read(row, "Zona_Saque") || "-")}
                              {celda("Tipo_Envio", read(row, "Tipo_Envio") || "-")}
                              {celda("Zona_Caida", direccionDe(row).label)}
                              {celda("Receptor", read(row, "Receptor") || "-")}
                              {isOffensive ? (
                                <>
                                  {celda("Intencion", read(row, "Intencion") || "-")}
                                  {celda("Rutina", read(row, "Rutina") || "-")}
                                </>
                              ) : (
                                <>
                                  {celda("Defensa", read(row, "Defensa") || "-")}
                                  {celda("Debilidad_Defensiva", read(row, "Debilidad_Defensiva") || "-")}
                                </>
                              )}
                              {celda("Resultado_Final", resultado.label, {
                                className: "font-medium",
                                style: { color: resultInk(resultado.label) },
                              })}
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
