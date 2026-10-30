"use client";

/**
 * Laboratorio · Robos y transiciones, y su espejo: Pérdidas y transiciones
 * defensivas (11/10/2026).
 *
 * Una sola pantalla con dos modos:
 *
 * - **robos**: cada vez que el Castilla le quita el balón al rival de forma
 *   ACTIVA (entrada, interceptación o balón ganado por presión), qué es lo
 *   primero que hace con él —sale hacia delante o lo mueve en horizontal y
 *   hacia atrás— y en qué acaba la jugada que nace de ahí.
 * - **pérdidas**: cada vez que el Castilla pierde el balón en juego (pase que
 *   no llega, conducción cortada, duelo o control perdido), qué es lo primero
 *   que hace EL RIVAL con él y en qué acaba SU posesión: si nos llega al área
 *   o al remate, si se la queda, o si la recuperamos.
 *
 * Las dos salen del mismo sitio: el timeline de Hudl del partido, leído por
 * `scripts/partido/robos.cjs` y `scripts/partido/perdidas.cjs`, y recogido en
 * `lib/transiciones/datos.ts` por `scripts/transiciones-datos.mjs`. Los dos
 * primeros partidos (J2 y J3) se miraron imagen a imagen y sólo tienen robos.
 *
 * Todo lo que se pincha filtra (`components/faltas/FiltrosCruzados.tsx`, que
 * se comparte con faltas): un sector de la tarta, una barra, una leyenda, una
 * cifra, cualquier celda de la tabla. El partido y «quitar los dudosos» siguen
 * siendo los mandos de siempre; la barra de «Filtrando» los enseña junto con
 * lo pinchado y se quitan desde ahí igual.
 */

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowUp,
  ArrowLeftRight,
  BarChart3,
  Clock,
  LayoutDashboard,
  List,
  Crosshair,
  Eye,
  Map as MapIcon,
  Target,
  Timer,
  Users,
} from "lucide-react";

import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { AbpHeader, Panel } from "@/components/abp/ui";
import { SelloDeFechas } from "@/components/data/SelloJornada";
import { Pestanas, usePestanaUrl } from "@/components/analisis/Pestanas";
import { PARTIDOS, type Accion, type Robo } from "@/lib/transiciones/datos";
import { nombreEquipo } from "@/lib/equipos";
import { ComoActualizar } from "@/components/transiciones/ComoActualizar";
import {
  ComparativaPartido,
  formatoPorcentaje,
  formatoPuntos,
  numeroCorto,
  mediaPorPartido,
  porcentajeAgregado,
  porcentajeDe,
  type MetricaComparada,
} from "@/components/abp/ComparativaPartido";
import { CampoZonas, type PuntoCampo } from "@/components/campo/CampoZonas";
import { PorJugador, SinJugador, type ColumnaJugador } from "@/components/analisis/PorJugador";
import { CARRILES_CAMPO, ZONAS_CAMPO } from "@/components/faltas/CampoFaltas";
import { anterioresPorFecha, ultimoPorFecha } from "@/lib/abp/ultimo-partido";
import {
  BarraFiltros,
  Filtrable,
  TITULO_FILTRO,
  esPretemporada,
  estaActivo,
  hayFiltro,
  marcaPieza,
  marcaSvg,
  pasaFiltros,
  useFiltrosCruzados,
  type ChipFiltro,
  type Filtros,
} from "@/components/faltas/FiltrosCruzados";
import {
  Conclusiones,
  Explicativo,
  useTextosExplicativos,
} from "@/components/ui/textos-analisis";

export type ModoTransiciones = "robos" | "perdidas";

/* ------------------------------------------------------------------ */
/*  Colores y textos de cada modo                                      */
/* ------------------------------------------------------------------ */

const ORO = "#C8A96B";
const ACERO = "#66758A";
const VERDE = "#1B9E77";
const NARANJA = "#D95F02";

type Textos = {
  titulo: string;
  /** «robos» / «pérdidas», y en singular. */
  unidad: string;
  unidadUna: string;
  /** La serie de las barras que cuenta el total: «Robos» / «Pérdidas». */
  serieTotal: string;
  /** La serie de las que salen hacia delante (nuestras o suyas). */
  serieAdelante: string;
  /** Colores y nombres de la salida: en los robos, la nuestra; en las pérdidas, la del rival. */
  acciones: { clave: Accion; nombre: string; color: string }[];
  /** Las acciones que se marcan juntas como «Otro» en las barras. */
  otras: Accion[];
  /** Los desenlaces, de lo mejor a lo peor para nosotros. */
  desenlaces: { clave: string; nombre: string; color: string }[];
  /** Los que cuentan como «llegar»: remate o área. */
  cifras: {
    adelante: string;
    horizontal: string;
    duracion: string;
    llegan: (n: number, de: number) => string;
  };
  paneles: {
    accion: string;
    accionSub: string;
    zona: string;
    zonaAnalisis: string;
    desenlace: string;
    cuando: string;
    lista: string;
    listaSub: string;
    columnaTipo: string;
    rotuloSalida: string;
  };
  conclusiones: {
    adelante: (pct: number, n: number, de: number) => string;
    /** `juegan`: los de esa zona que se juegan con pase o conducción; `adelante`, los que salen hacia delante. */
    zona: (zona: string, n: number, total: number, adelante: number, juegan: number) => string;
    acaba: (llegan: number, pierden: number, de: number) => string;
    dura: (s: string) => string;
  };
  dudosos: string;
  vacio: string;
  vacioFiltro: string;
  criterio: string;
};

const TEXTOS: Record<ModoTransiciones, Textos> = {
  robos: {
    titulo: "Robos y transiciones",
    unidad: "robos",
    unidadUna: "robo",
    serieTotal: "Robos",
    serieAdelante: "Adelante",
    acciones: [
      { clave: "ADELANTE", nombre: "Adelante", color: VERDE },
      { clave: "HORIZONTAL_ATRAS", nombre: "Horizontal o atrás", color: NARANJA },
      { clave: "DESPEJE", nombre: "Despeje", color: ACERO },
      { clave: "PERDIDA", nombre: "Pérdida inmediata", color: "#8A6262" },
    ],
    otras: ["DESPEJE", "PERDIDA"],
    desenlaces: [
      { clave: "REMATE", nombre: "Remate", color: VERDE },
      { clave: "AREA", nombre: "Balón al área", color: "#4C9A7A" },
      { clave: "ULTIMO_TERCIO", nombre: "Último tercio", color: ORO },
      { clave: "FALTA_FAVOR", nombre: "Falta a favor", color: "#8FA0B8" },
      { clave: "POSESION", nombre: "Posesión larga", color: ACERO },
      { clave: "ATRAS_PORTERO", nombre: "Atrás al portero", color: "#5F6B7A" },
      { clave: "FUERA", nombre: "Sale por línea", color: "#7C6F9F" },
      { clave: "FALTA_CONTRA", nombre: "Falta nuestra", color: "#8A6262" },
      { clave: "PERDIDA", nombre: "La perdemos", color: NARANJA },
    ],
    cifras: {
      adelante: "Salen hacia delante",
      horizontal: "Horizontal o atrás",
      duracion: "Dura la transición",
      llegan: (n, de) => `${n} de ${de} llegan al área o al remate`,
    },
    paneles: {
      accion: "Qué hacemos con el balón robado",
      accionSub: "Lo primero que pasa después del robo",
      zona: "Dónde robamos y cómo salimos",
      zonaAnalisis:
        "Lo que hay que mirar aquí es el contraste entre la barra de campo rival y la de campo propio: cuanto más arriba se roba, más se sale hacia delante.",
      desenlace: "En qué acaba la transición",
      cuando: "Cuándo robamos",
      lista: "Robo a robo",
      listaSub:
        "«Min.» es el del partido (y el de la táctica); «Vídeo», el del archivo, para ir directo a la jugada. Pincha un valor y filtra la pantalla",
      columnaTipo: "Robo",
      rotuloSalida: "Salida",
    },
    conclusiones: {
      adelante: (pct, n, de) => `El ${pct} % sale hacia delante tras robar (${n} de ${de}).`,
      zona: (zona, n, total, adelante, juegan) =>
        `Donde más robamos es en ${zona}: ${n} de ${total}. De esos ${n}, jugamos ${juegan} con pase o conducción y ${adelante} salen hacia delante.`,
      acaba: (llegan, pierden, de) => `De ${de} con desenlace, ${llegan} % acaba en remate o área y ${pierden} % en pérdida.`,
      dura: (s) => `La transición dura ${s} s de media.`,
    },
    dudosos:
      "Los robos marcados con confianza baja son los que el etiquetado no puede defender fotograma a fotograma",
    vacio: "Todavía no hay robos de este partido.",
    vacioFiltro: "Ningún robo con este filtro.",
    criterio:
      "Cuenta como robo la recuperación activa: entrada, interceptación o balón ganado por presión directa, con el balón en juego. No cuentan los rechaces sin disputa, los despejes del rival, las paradas del portero, lo que nace de balón parado ni los cambios de posesión por falta pitada. El criterio completo está en ANALISIS TRANSICIONES/MANUAL_ETIQUETADO.md.",
  },
  perdidas: {
    titulo: "Pérdidas y transiciones defensivas",
    unidad: "pérdidas",
    unidadUna: "pérdida",
    serieTotal: "Pérdidas",
    /* Igual que el nombre de la acción: la leyenda filtra por este texto y,
       con «Salen adelante», no casaba y no se podía pulsar (19/10/2026). */
    serieAdelante: "Salen hacia delante",
    /* Aquí la salida es la del rival: que salga hacia delante es lo malo. */
    acciones: [
      { clave: "ADELANTE", nombre: "Salen hacia delante", color: NARANJA },
      { clave: "HORIZONTAL_ATRAS", nombre: "Horizontal o atrás", color: VERDE },
      { clave: "DESPEJE", nombre: "Despejan", color: ACERO },
      { clave: "RECUPERAMOS", nombre: "La recuperamos al momento", color: "#4C9A7A" },
    ],
    otras: ["DESPEJE", "RECUPERAMOS"],
    desenlaces: [
      { clave: "RECUPERAMOS", nombre: "La recuperamos", color: VERDE },
      { clave: "FALTA_CONTRA", nombre: "Nos hacen falta", color: "#4C9A7A" },
      { clave: "FUERA", nombre: "Sale por línea", color: "#7C6F9F" },
      { clave: "ATRAS_PORTERO", nombre: "Atrás a su portero", color: "#5F6B7A" },
      { clave: "POSESION", nombre: "Se quedan el balón", color: ACERO },
      { clave: "FALTA_FAVOR", nombre: "Falta nuestra", color: "#8A6262" },
      { clave: "ULTIMO_TERCIO", nombre: "Llegan al último tercio", color: ORO },
      { clave: "AREA", nombre: "Llegan a nuestra área", color: "#C8743B" },
      { clave: "REMATE", nombre: "Remate del rival", color: NARANJA },
    ],
    cifras: {
      adelante: "El rival sale hacia delante",
      horizontal: "Horizontal o atrás",
      duracion: "Dura su transición",
      llegan: (n, de) => `${n} de ${de} nos llegan al área o al remate`,
    },
    paneles: {
      accion: "Qué hace el rival con el balón perdido",
      accionSub: "Lo primero que pasa después de nuestra pérdida",
      zona: "Dónde perdemos y cómo salen",
      zonaAnalisis:
        "Lo que hay que mirar aquí es la barra de campo propio: una pérdida ahí es la que más fácil acaba en remate, y cuántas salen hacia delante dice cómo reaccionamos a la pérdida.",
      desenlace: "En qué acaba su transición",
      cuando: "Cuándo perdemos",
      lista: "Pérdida a pérdida",
      listaSub:
        "«Min.» es el del partido (y el de la táctica); «Vídeo», el del archivo, para ir directo a la jugada. «Su salida» es lo primero que hace el rival. Pincha un valor y filtra la pantalla",
      columnaTipo: "Pérdida",
      rotuloSalida: "Su salida",
    },
    conclusiones: {
      adelante: (pct, n, de) => `El rival sale hacia delante en el ${pct} % de las pérdidas que llega a jugar (${n} de ${de}).`,
      zona: (zona, n, total, adelante, juegan) =>
        /* 30/10/2026: dos frases, una cifra cada una (marketing: mezclaba tres). */
        `Donde más perdemos es en ${zona}: ${n} de ${total}. De esas ${n}, el rival juega ${juegan} y sale hacia delante en ${adelante}.`,
      acaba: (llegan, pierden, de) => `De ${de} con desenlace, ${llegan} % nos llegan al área o al remate y ${pierden} % las recuperamos.`,
      dura: (s) => `Su transición dura ${s} s de media.`,
    },
    dudosos:
      "Las pérdidas marcadas con confianza media son las que Wyscout no clasifica como pase, conducción o duelo",
    vacio: "Todavía no hay pérdidas de este partido.",
    vacioFiltro: "Ninguna pérdida con este filtro.",
    criterio:
      "Cuenta como pérdida la acción nuestra con el balón en juego que Wyscout marca como perdida: pase que no llega, conducción cortada, duelo o control perdido. No cuentan los remates y sus rechaces, los despejes a propósito, los balones parados que se pierden en el propio saque ni las jugadas con falta pitada. La salida y el desenlace son del rival: lo primero que hace con el balón y en qué acaba su posesión. Es el espejo del criterio de robo de ANALISIS TRANSICIONES/MANUAL_ETIQUETADO.md.",
  },
};

const ZONAS = ["campo propio", "medio campo", "campo rival"] as const;
const CARRILES = ["izquierda", "centro", "derecha"] as const;

/*
| El campo dibujado habla de «nuestro campo»; el etiquetado, de «campo
| propio». Robos y pérdidas son siempre acciones del Castilla, así que el
| tercio y el carril ya están en el sentido del campo de verdad (el Castilla
| ataca hacia la derecha) y sólo cambia el nombre del primer tercio.
*/
const ZONA_EN_CAMPO: Record<string, string> = {
  "campo propio": "nuestro campo",
  "medio campo": "medio campo",
  "campo rival": "campo rival",
};
const ZONA_DEL_CAMPO: Record<string, string> = Object.fromEntries(
  Object.entries(ZONA_EN_CAMPO).map(([interna, campo]) => [campo, interna]),
);

/** El id de una fila en pantalla: el que ya usa la tabla. */
const idDe = (r: { partido: string; seg: number }) => `${r.partido}-${r.seg}`;

/* ------------------------------------------------------------------ */
/*  Utilidades                                                         */
/* ------------------------------------------------------------------ */

function reloj(segundos: number) {
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  return `${m}'${String(s).padStart(2, "0")}"`;
}

function zonaDe(r: Robo) {
  if (r.zona.includes("rival")) return "campo rival";
  if (r.zona.includes("medio")) return "medio campo";
  return "campo propio";
}

function pct(parte: number, total: number) {
  if (!total) return 0;
  return Math.round((parte / total) * 100);
}

/** 8.43 → "8,4". */
const decimal = (n: number) =>
  n.toLocaleString("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Un robo (o una pérdida) con su partido pegado, que es lo que se cuenta en pantalla. */
type RoboVisto = Robo & { partido: string; jornada: string; rival: string };

/*
| El detalle de los bloques nuevos empieza por el minuto y sigue con quién:
| «45+1'56" (táctica 47:48) · Interceptación de Mario Rivas en medio campo…»
| (o «Pase perdido de Diego Aguado en medio campo…»). Los bloques viejos son
| texto libre y no traen ni lo uno ni lo otro: ahí se devuelve vacío, y la
| tabla pone «—».
*/
const PARTES_DETALLE = /^(\d+(?:\+\d+)?'\d{1,2}"(?:\s*\([^)]*\))?)\s+·\s+([\s\S]*)$/;
const QUIEN_ROBA = /^(.+?)\s+de\s+(.+?)\s+en\s+(?:campo|medio)\b/;

/** El minuto del partido, sacado del principio del detalle. */
function minutoDe(r: Robo) {
  return PARTES_DETALLE.exec(r.detalle ?? "")?.[1] ?? "";
}

/** El detalle sin el minuto delante, que ya tiene su columna. */
function textoDe(r: Robo) {
  return PARTES_DETALLE.exec(r.detalle ?? "")?.[2] ?? r.detalle ?? "";
}

/** «Interceptación», «Duelo ganado», «Pase perdido»… (sólo en los bloques nuevos). */
function tipoDe(r: Robo) {
  const m = PARTES_DETALLE.exec(r.detalle ?? "");
  return m ? (QUIEN_ROBA.exec(m[2])?.[1] ?? "") : "";
}

/*
| Quién roba o quién pierde. Desde el 19/10/2026 viene en su propio campo
| (`jugador`, de la sesión por jugador de Hudl); si no, del detalle de los
| bloques de Hudl. Los partidos mirados a ojo (J2, J3) no lo tienen.
*/
function jugadorDe(r: Robo) {
  if (r.jugador) return r.jugador;
  const m = PARTES_DETALLE.exec(r.detalle ?? "");
  return m ? (QUIEN_ROBA.exec(m[2])?.[2] ?? "") : "";
}

const TRAMOS = [0, 15, 30, 45, 60, 75, 90];
const nombreTramo = (ini: number) => (ini >= 90 ? "90'+" : `${ini}'-${ini + 15}'`);

/*
| El minuto del partido, en minutos con decimales, leído del detalle.
|
| El descuento cuenta en el último tramo de su parte: «45+1'56"» es del
| 30'-45' y «90+4'37"» del 75'-90'. Ojo: un «45'31"» sin «+» ya es de la
| segunda parte (el reloj sigue desde 45). Los bloques viejos no traen
| minuto: ahí se devuelve null.
*/
const MINUTO = /^(\d+)(?:\+(\d+))?'(\d{1,2})"/;

function minutoPartido(r: Robo) {
  const m = MINUTO.exec(r.detalle ?? "");

  if (!m) return null;

  const base = Number(m[1]);

  if (m[2] !== undefined) return base - 0.5;

  return base + Number(m[3]) / 60;
}

/*
| El tramo de quince minutos en que cae la acción: por el minuto del partido
| cuando se sabe, y si no (bloques viejos) por el minuto del vídeo.
*/
const tramoDe = (r: Robo) => {
  const minuto = minutoPartido(r) ?? r.seg / 60;

  return nombreTramo(Math.min(90, Math.floor(minuto / 15) * 15));
};

/** Cómo se lee cada dimensión pinchable de una fila. */
const LECTORES: Record<string, (r: RoboVisto) => string> = {
  zona: zonaDe,
  carril: (r) => r.carril,
  accion: (r) => r.accion,
  desenlace: (r) => r.desenlace,
  confianza: (r) => r.confianza,
  tramo: tramoDe,
  jugador: jugadorDe,
  tipo: tipoDe,
};

const HAY_PRETEMPORADA = PARTIDOS.some((p) => esPretemporada(p.jornada));

/* ------------------------------------------------------------------ */
/*  Por jugador (19/10/2026)                                           */
/* ------------------------------------------------------------------ */

const llegaAlArea = (r: Robo) => r.desenlace === "REMATE" || r.desenlace === "AREA";
const seJuega = (r: Robo) => r.accion === "ADELANTE" || r.accion === "HORIZONTAL_ATRAS";
const conDesenlaceAnotado = (r: Robo) => Boolean(r.desenlace);

/*
| Lo que pregunta un entrenador de cada jugador: cuántas, dónde y qué sale
| después. En los robos, lo bueno es salir hacia delante y llegar; en las
| pérdidas, lo caro es que el rival nos llegue al área o al remate.
*/
const COLUMNAS_JUGADOR: Record<ModoTransiciones, ColumnaJugador<RoboVisto>[]> = {
  robos: [
    { tipo: "zonas", clave: "donde", rotulo: "Dónde roba", explica: "Tercio y carril de cada robo, con el Castilla atacando hacia la derecha" },
    { clave: "rival", rotulo: "En campo rival", explica: "Robos en el último tercio: la presión alta que funciona", cumple: (r) => zonaDe(r) === "campo rival", color: VERDE },
    { clave: "adelante", rotulo: "Salen adelante", explica: "Lo primero tras el robo es un pase o una conducción hacia delante; el % es sobre los que se juegan con pase o conducción", cumple: (r) => r.accion === "ADELANTE", sobre: seJuega, color: VERDE },
    { clave: "llegan", rotulo: "Remate o área", explica: "La posesión que nace del robo acaba en remate o con el balón en el área rival", cumple: llegaAlArea, sobre: conDesenlaceAnotado, color: VERDE },
    { clave: "remate", rotulo: "Remate", explica: "Acaban en remate", cumple: (r) => r.desenlace === "REMATE", sobre: null, color: VERDE },
    { clave: "pierde", rotulo: "Perdida al momento", explica: "La perdemos sin llegar a jugarla", cumple: (r) => r.accion === "PERDIDA", color: NARANJA },
  ],
  perdidas: [
    { tipo: "zonas", clave: "donde", rotulo: "Dónde pierde", explica: "Tercio y carril de cada pérdida, con el Castilla atacando hacia la derecha" },
    { clave: "propio", rotulo: "En nuestro campo", explica: "Pérdidas en nuestro primer tercio: las que más peligro traen", cumple: (r) => zonaDe(r) === "campo propio", color: NARANJA },
    { clave: "caras", rotulo: "Caras", explica: "Pérdidas caras: la posesión del rival acaba en remate o en nuestra área; el % es sobre las que tienen desenlace anotado", cumple: llegaAlArea, sobre: conDesenlaceAnotado, color: NARANJA },
    { clave: "remate", rotulo: "Remate rival", explica: "Acaban en remate del rival", cumple: (r) => r.desenlace === "REMATE", sobre: null, color: NARANJA },
    { clave: "adelante", rotulo: "Salen adelante", explica: "El rival sale hacia delante con pase o conducción; el % es sobre las que llega a jugar", cumple: (r) => r.accion === "ADELANTE", sobre: seJuega, color: NARANJA },
    { clave: "recuperamos", rotulo: "Recuperada", explica: "La volvemos a recuperar antes de que nos llegue", cumple: (r) => r.accion === "RECUPERAMOS" || r.desenlace === "RECUPERAMOS", color: VERDE },
  ],
};

/** El sitio de una fila en el campo de verdad, como lo dibuja el campo. */
const sitioDe = (r: RoboVisto) => ({ zona: ZONA_EN_CAMPO[zonaDe(r)] ?? "", carril: r.carril });
const partidoDeFila = (r: RoboVisto) => r.partido;

/* ------------------------------------------------------------------ */
/*  Piezas sueltas                                                     */
/* ------------------------------------------------------------------ */

function Cifra({
  valor,
  rotulo,
  pie,
  /* El oro como texto baja de luz en modo día (2,25 de contraste con el dorado claro). */
  color = "var(--rmcf-gold-ink)",
  icono: Icono,
  onClick,
  activo = false,
  atenuado = false,
}: {
  valor: string;
  rotulo: string;
  pie?: string;
  color?: string;
  icono?: React.ComponentType<{ size?: number; className?: string }>;
  /** Si se da, la cifra se pincha y filtra por lo que cuenta. */
  onClick?: () => void;
  activo?: boolean;
  atenuado?: boolean;
}) {
  const dentro = (
    <>
      <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">
        {Icono && <Icono size={13} />}
        {rotulo}
      </span>

      <span className="mt-2 block text-3xl font-semibold tabular-nums" style={{ color }}>
        {valor}
      </span>

      {pie && <span className="mt-1 block text-xs text-white/40">{pie}</span>}
    </>
  );

  if (!onClick) {
    return <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">{dentro}</div>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      title={TITULO_FILTRO}
      style={marcaPieza(activo, atenuado)}
      className="block w-full cursor-pointer rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left transition hover:opacity-100"
    >
      {dentro}
    </button>
  );
}

type PistaProps = {
  active?: boolean;
  label?: string | number;
  payload?: { name?: string | number; value?: string | number; color?: string }[];
};

function Pista({ active, payload, label }: PistaProps) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-xl border border-white/10 bg-[#141A22] p-3 shadow-2xl">
      {label !== undefined && (
        <p className="mb-1.5 text-sm font-semibold text-white">{label}</p>
      )}

      {payload.map((p, i) => (
        <p key={i} className="text-xs" style={{ color: p.color ?? "#CBD5E1" }}>
          {p.name}: <span className="font-semibold">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Pantalla                                                           */
/* ------------------------------------------------------------------ */

const VISTAS = ["resumen", "campo", "detalle", "jugadores", "lista"] as const;

/** «0-1 Pedro Ortiz (min 13): pase de… Hudl 772-776…» → «0-1 Pedro Ortiz (min 13)». */
function textoGolCorto(texto: string) {
  const corte = texto.indexOf(":");

  return (corte > 0 ? texto.slice(0, corte) : texto.split(".")[0]).trim();
}

export function PantallaTransiciones({ modo }: { modo: ModoTransiciones }) {
  const T = TEXTOS[modo];

  const COLOR_ACCION = useMemo(
    () => Object.fromEntries(T.acciones.map((a) => [a.clave, a.color])) as Record<string, string>,
    [T],
  );
  const NOMBRE_ACCION = useMemo(
    () => Object.fromEntries(T.acciones.map((a) => [a.clave, a.nombre])) as Record<string, string>,
    [T],
  );
  const DESENLACES = T.desenlaces;

  /**
   * Las series de las gráficas de barras, en acciones. «Otro» son dos: el
   * despeje y la pérdida inmediata (o la recuperación inmediata), y se marcan
   * y se sueltan juntas.
   */
  const ACCIONES_SERIE = useMemo<Record<string, Accion[]>>(
    () => ({
      [NOMBRE_ACCION.ADELANTE]: ["ADELANTE"],
      [NOMBRE_ACCION.HORIZONTAL_ATRAS]: ["HORIZONTAL_ATRAS"],
      Otro: T.otras,
    }),
    [NOMBRE_ACCION, T],
  );

  const ROTULO: Record<string, string> = {
    zona: "Zona",
    carril: "Carril",
    accion: T.paneles.rotuloSalida,
    desenlace: "Acaba en",
    confianza: "Fiabilidad",
    tramo: "Tramo",
    jugador: "Jugador",
    tipo: T.paneles.columnaTipo,
  };

  /** Lo que se lee en la barra de «Filtrando» para cada valor. */
  const nombreValor = (dimension: string, valor: string) => {
    if (dimension === "accion") return NOMBRE_ACCION[valor] ?? valor;
    if (dimension === "desenlace") return DESENLACES.find((d) => d.clave === valor)?.nombre ?? valor;
    return valor;
  };

  /** ¿Está marcada la serie entera? */
  const serieActiva = (filtros: Filtros, serie: string) =>
    (ACCIONES_SERIE[serie] ?? []).length > 0 &&
    (ACCIONES_SERIE[serie] ?? []).every((a) => estaActivo(filtros, "accion", a));

  const explicativos = useTextosExplicativos();

  /* Cuatro vistas en vez de un único scroll: el resumen, el campo, el detalle y la lista. */
  const [vista, setVista] = usePestanaUrl("vista", VISTAS, "resumen");
  /*
  | Se abre en el último partido analizado, no en «todos»: lo que se quiere
  | mirar el lunes es lo del domingo. «Todos los partidos» sigue a un toque.
  */
  const [quienElegido, setQuien] = useState<string>(
    () =>
      ultimoPorFecha(
        PARTIDOS.filter(
          (p) => (modo === "robos" ? p.robos : p.perdidas ?? []).length > 0 && !esPretemporada(p.jornada),
        ),
      )?.id ?? "todos",
  );
  /** La fila encendida, compartida entre el campo y la tabla. */
  const [resaltado, setResaltado] = useState<string | null>(null);
  const [porcentajes, setPorcentajes] = useState(false);
  const [conDudosos, setConDudosos] = useState(true);
  /* Lo dudoso no es lo mismo en los dos modos (19/10/2026): en robos es la
     confianza baja, pero en pérdidas —donde no hay ninguna baja— es la media,
     como dice su texto. Con «baja» fijo, «Quitar los dudosos» en pérdidas no
     quitaba nada. */
  const DUDOSA = modo === "robos" ? "baja" : "media";
  /*
  | La pretemporada, fuera salvo que se pida: los amistosos no se leen igual
  | que la liga. Hoy no hay ninguno en los datos y el mando ni sale.
  */
  const [conPretemporada, setConPretemporada] = useState(false);

  /** Lo que se ha pinchado en gráficas, cifras y tabla. */
  const { filtros, alterna, alternaVarios, quita, limpia } = useFiltrosCruzados();

  /*
  | Los partidos, con las filas del modo en «robos»: así todo lo de abajo
  | cuenta robos o pérdidas sin saber cuál de los dos es.
  */
  const todos = useMemo(
    () => PARTIDOS.map((p) => (modo === "robos" ? p : { ...p, robos: p.perdidas ?? [] })),
    [modo],
  );

  const partidos = useMemo(
    () =>
      todos.filter(
        (p) =>
          (p.robos.length > 0 || (modo === "robos" && p.bloquesCerrados > 0)) &&
          (conPretemporada || !esPretemporada(p.jornada)),
      ),
    [todos, modo, conPretemporada],
  );

  const quien = partidos.some((p) => p.id === quienElegido) ? quienElegido : "todos";

  /* 30/10/2026: para el sello «Datos hasta la J·» y para decir dónde empieza. */
  const fechasConDato = useMemo(() => partidos.filter((p) => p.robos.length > 0).map((p) => p.fecha), [partidos]);
  const primeraConDato = useMemo(
    () => [...partidos].filter((p) => !esPretemporada(p.jornada)).sort((a, b) => a.fecha.localeCompare(b.fecha))[0]?.jornada ?? "",
    [partidos],
  );

  const elegidos = useMemo(
    () => (quien === "todos" ? partidos : partidos.filter((p) => p.id === quien)),
    [partidos, quien],
  );

  const unPartido = quien !== "todos";

  /** Pinchar un partido en la tabla: se queda con él, o vuelve a todos. */
  const alternaPartido = (id: string) => setQuien((antes) => (antes === id ? "todos" : id));

  /*
  | Cuál se va a actualizar: el que se esté mirando, o el último. Se mira la
  | lista ENTERA: el partido recién dado de alta es justo el que hay que preparar.
  */
  const paraActualizar = useMemo(
    () => (quien === "todos" ? todos[todos.length - 1] : todos.find((p) => p.id === quien)),
    [todos, quien],
  );

  /** Las filas de los partidos elegidos, antes de lo pinchado. */
  const base = useMemo<RoboVisto[]>(() => {
    const lista = elegidos.flatMap((p) =>
      p.robos.map((r) => ({ ...r, partido: p.id, jornada: p.jornada, rival: p.rival })),
    );
    return conDudosos ? lista : lista.filter((r) => r.confianza !== DUDOSA);
  }, [elegidos, conDudosos, DUDOSA]);

  /*
  | Con todo lo pinchado menos `excepto`. Cada gráfica se pinta sin su propio
  | filtro: la de zonas sigue enseñando las tres con la elegida marcada.
  */
  const filtrados = (excepto: string[] = []) =>
    base.filter((r) => pasaFiltros(r, filtros, LECTORES, excepto));

  /** Las filas que se están contando ahora mismo, ya filtradas. */
  const robos = useMemo(
    () => base.filter((r) => pasaFiltros(r, filtros, LECTORES)),
    [base, filtros],
  );

  /** La barra de «Filtrando»: partido, dudosos y todo lo pinchado. */
  const partidoElegido = partidos.find((p) => p.id === quien);
  const chips: ChipFiltro[] = [
    ...(partidoElegido
      ? [
          {
            clave: "partido",
            rotulo: "Partido",
            valor: `${partidoElegido.jornada} · ${nombreEquipo(partidoElegido.rival)}`,
            onQuitar: () => setQuien("todos"),
          },
        ]
      : []),
    ...(conDudosos
      ? []
      : [
          {
            clave: "dudosos",
            rotulo: "Fiabilidad",
            valor: "sin los dudosos",
            onQuitar: () => setConDudosos(true),
          },
        ]),
    ...Object.entries(filtros).flatMap(([dimension, valores]) =>
      valores.map((valor) => ({
        clave: `${dimension}|${valor}`,
        rotulo: ROTULO[dimension] ?? dimension,
        valor: nombreValor(dimension, valor),
        onQuitar: () => quita(dimension, valor),
      })),
    ),
  ];

  const quitaTodo = () => {
    limpia();
    setQuien("todos");
    setConDudosos(true);
  };

  /** Una celda pinchable de la tabla. */
  const celda = (dimension: string, valor: string, texto: React.ReactNode = valor) =>
    valor ? (
      <Filtrable
        activo={estaActivo(filtros, dimension, valor)}
        onClick={() => alterna(dimension, valor)}
      >
        {texto}
      </Filtrable>
    ) : (
      "—"
    );

  /** Marcar o soltar una serie de barras (una o dos acciones). */
  const alternaSerie = (serie: string) =>
    alternaVarios((ACCIONES_SERIE[serie] ?? []).map((a) => ["accion", a]));

  const cobertura = useMemo(() => {
    const cerrados = elegidos.reduce((a, p) => a + p.bloquesCerrados, 0);
    const totales = elegidos.reduce((a, p) => a + p.bloquesTotales, 0);
    const minutosVideo = Math.round(
      elegidos.reduce((a, p) => a + p.segundosVideo, 0) / 60,
    );
    const minutosVistos = Math.round(
      elegidos.reduce((a, p) => a + p.segundosRevisados, 0) / 60,
    );
    return {
      cerrados,
      totales,
      minutosVideo,
      minutosVistos,
      completo: cerrados === totales && totales > 0,
    };
  }, [elegidos]);

  /* --- reparto de la salida (sin su propio filtro) --- */
  const paraAccion = filtrados(["accion"]);
  const porAccion = T.acciones
    .map((a) => ({
      clave: a.clave,
      nombre: a.nombre,
      valor: paraAccion.filter((r) => r.accion === a.clave).length,
      color: a.color,
    }))
    .filter((d) => d.valor > 0);

  /* Los que sí llegan a pase o conducción: la comparación que importa. */
  const jugados = paraAccion.filter(
    (r) => r.accion === "ADELANTE" || r.accion === "HORIZONTAL_ATRAS",
  );
  const adelante = jugados.filter((r) => r.accion === "ADELANTE").length;

  const nombreAdelante = NOMBRE_ACCION.ADELANTE;
  const nombreHorizontal = NOMBRE_ACCION.HORIZONTAL_ATRAS;

  /* --- por zona: sin el filtro de zona ni el de salida, que son sus ejes --- */
  const paraZona = filtrados(["zona", "accion"]);
  const porZona = ZONAS.map((z) => {
    const dentro = paraZona.filter((r) => zonaDe(r) === z);
    const ade = dentro.filter((r) => r.accion === "ADELANTE").length;
    const hor = dentro.filter((r) => r.accion === "HORIZONTAL_ATRAS").length;
    const otro = dentro.length - ade - hor;
    const sobre = dentro.length || 1;
    return {
      clave: z,
      zona: z[0].toUpperCase() + z.slice(1),
      total: dentro.length,
      [nombreAdelante]: porcentajes ? Math.round((ade / sobre) * 100) : ade,
      [nombreHorizontal]: porcentajes ? Math.round((hor / sobre) * 100) : hor,
      Otro: porcentajes ? Math.round((otro / sobre) * 100) : otro,
    } as Record<string, string | number>;
  });

  /* --- por carril (sin su propio filtro) --- */
  const paraCarril = filtrados(["carril"]);
  const porCarril = CARRILES.map((c) => {
    const dentro = paraCarril.filter((r) => r.carril === c);
    return {
      clave: c,
      carril: c[0].toUpperCase() + c.slice(1),
      [T.serieTotal]: dentro.length,
      [T.serieAdelante]: dentro.filter((r) => r.accion === "ADELANTE").length,
    } as Record<string, string | number>;
  });

  /* --- desenlaces (la gráfica, sin su propio filtro; las cifras, con todo) --- */
  const conDesenlace = robos.filter((r) => r.desenlace);
  const paraDesenlace = filtrados(["desenlace"]).filter((r) => r.desenlace);
  const porDesenlace = DESENLACES.map((d) => ({
    clave: d.clave,
    nombre: d.nombre,
    color: d.color,
    valor: paraDesenlace.filter((r) => r.desenlace === d.clave).length,
  })).filter((d) => d.valor > 0);

  /* --- cuándo (sin su propio filtro) --- */
  const paraTramo = filtrados(["tramo"]);
  const porTramo = TRAMOS.filter(
    (ini) => ini < 90 || paraTramo.some((r) => tramoDe(r) === nombreTramo(ini)),
  ).map((ini) => {
    const dentro = paraTramo.filter((r) => tramoDe(r) === nombreTramo(ini));
    return {
      clave: nombreTramo(ini),
      tramo: nombreTramo(ini),
      [T.serieTotal]: dentro.length,
      [T.serieAdelante]: dentro.filter((r) => r.accion === "ADELANTE").length,
    } as Record<string, string | number>;
  });

  /** ¿Está elegida esta barra apilada de zonas? Zona y salida a la vez. */
  const hayZonaOSalida = hayFiltro(filtros, "zona") || hayFiltro(filtros, "accion");
  const segmentoActivo = (zona: string, serie: string) =>
    hayZonaOSalida &&
    (!hayFiltro(filtros, "zona") || estaActivo(filtros, "zona", zona)) &&
    (!hayFiltro(filtros, "accion") || serieActiva(filtros, serie));

  /** Pinchar un trozo de barra apilada: su zona y su salida juntas. */
  const alternaSegmento = (zona: string, serie: string) =>
    alternaVarios([
      ["zona", zona],
      ...(ACCIONES_SERIE[serie] ?? []).map((a): [string, string] => ["accion", a]),
    ]);

  /** La leyenda de una gráfica de series, pinchable y con la marcada en oro. */
  const leyenda = (v: string) => {
    const pinchable = Boolean(ACCIONES_SERIE[v]);
    const activa = pinchable && serieActiva(filtros, v);
    return (
      <span
        className="text-xs text-white/60"
        title={pinchable ? TITULO_FILTRO : undefined}
        style={
          pinchable
            ? { ...marcaPieza(activa, hayFiltro(filtros, "accion")), cursor: "pointer", borderRadius: 4, padding: "0 2px" }
            : undefined
        }
      >
        {v}
      </span>
    );
  };

  /** Lo que llega del clic de una leyenda de recharts: el nombre de la serie. */
  const pinchaLeyenda = (dato: { value?: unknown; dataKey?: unknown }) => {
    const serie = String(dato.dataKey ?? dato.value ?? "");
    if (ACCIONES_SERIE[serie]) alternaSerie(serie);
  };

  const duraciones = conDesenlace
    .map((r) => r.duracion)
    .filter((d): d is number => typeof d === "number");
  const duracionMedia = duraciones.length
    ? decimal(duraciones.reduce((a, b) => a + b, 0) / duraciones.length)
    : "—";

  const llegadas = conDesenlace.filter(
    (r) => r.desenlace === "REMATE" || r.desenlace === "AREA",
  ).length;

  /* ------------------------------------------------------------------ */
  /*  Este partido frente a la media de los anteriores                   */
  /* ------------------------------------------------------------------ */

  /*
  | Se compara el partido que se está mirando (o el último, si se miran
  | todos) con la media por partido de los que se jugaron antes, con los
  | mismos filtros que lo de abajo: dudosos fuera si están fuera, y lo
  | pinchado en las gráficas también.
  */
  const comparado = useMemo(
    () => partidos.find((p) => p.id === quien) ?? ultimoPorFecha(partidos),
    [partidos, quien],
  );

  const comparativa = useMemo(() => {
    if (!comparado) return null;

    const filasDe = (p: (typeof partidos)[number]): RoboVisto[] =>
      p.robos
        .map((r) => ({ ...r, partido: p.id, jornada: p.jornada, rival: p.rival }))
        .filter((r) => conDudosos || r.confianza !== DUDOSA)
        .filter((r) => pasaFiltros(r, filtros, LECTORES));

    const actuales = filasDe(comparado);
    const anteriores = anterioresPorFecha(partidos, comparado).map(filasDe);

    const jugadas = (f: RoboVisto[]) => f.filter((r) => r.accion === "ADELANTE" || r.accion === "HORIZONTAL_ATRAS");
    const adelante = (f: RoboVisto[]) => f.filter((r) => r.accion === "ADELANTE").length;
    const seguidas = (f: RoboVisto[]) => f.filter((r) => r.desenlace);
    const llegan = (f: RoboVisto[]) => f.filter((r) => r.desenlace === "REMATE" || r.desenlace === "AREA").length;
    const cortas = (f: RoboVisto[]) =>
      f.filter((r) => (modo === "robos" ? r.desenlace === "PERDIDA" : r.desenlace === "RECUPERAMOS")).length;
    const enCampo = (zona: string) => (f: RoboVisto[]) => f.filter((r) => zonaDe(r) === zona).length;
    const duracion = (f: RoboVisto[]) => {
      const t = seguidas(f).map((r) => r.duracion).filter((d): d is number => typeof d === "number");
      return t.length ? t.reduce((a, b) => a + b, 0) / t.length : null;
    };
    const duracionMediaDe = (lista: RoboVisto[][]) => {
      const valores = lista.map(duracion).filter((d): d is number => d !== null);
      return valores.length ? valores.reduce((a, b) => a + b, 0) / valores.length : null;
    };

    const robosMode = modo === "robos";
    const segundos = (n: number) => `${decimal(n)} s`;
    /* Un porcentaje apoyado en pocas acciones es un indicio: se dice en la propia fila. */
    const pequena = (base: number) => (base < 15 ? " · muestra pequeña" : "");

    const metricas: MetricaComparada[] = [
      {
        clave: "total",
        nombre: T.serieTotal,
        actual: actuales.length,
        media: mediaPorPartido(anteriores, (f) => f.length),
        mejorAlto: robosMode ? true : false,
        pie: robosMode ? "cuantos más, mejor" : "cuantas menos, mejor",
      },
      {
        clave: "adelante",
        nombre: robosMode ? "Salen hacia delante" : "El rival sale hacia delante",
        actual: porcentajeDe(actuales, (f) => adelante(jugadas(f)), (f) => jugadas(f).length),
        media: porcentajeAgregado(anteriores, (f) => adelante(jugadas(f)), (f) => jugadas(f).length),
        formato: formatoPorcentaje,
        formatoDiferencia: formatoPuntos,
        mejorAlto: robosMode ? true : false,
        pie: `${adelante(jugadas(actuales))} de ${jugadas(actuales).length} que se juegan con pase o conducción${pequena(jugadas(actuales).length)} · ${robosMode ? "más, mejor" : "menos, mejor"}`,
      },
      {
        clave: "llegan",
        nombre: robosMode ? "Acaban en remate o en el área" : "Acaban en remate o en nuestra área",
        actual: porcentajeDe(actuales, (f) => llegan(seguidas(f)), (f) => seguidas(f).length),
        media: porcentajeAgregado(anteriores, (f) => llegan(seguidas(f)), (f) => seguidas(f).length),
        formato: formatoPorcentaje,
        formatoDiferencia: formatoPuntos,
        mejorAlto: robosMode ? true : false,
        pie: `${llegan(seguidas(actuales))} de ${seguidas(actuales).length} con desenlace anotado${pequena(seguidas(actuales).length)} · ${robosMode ? "más, mejor" : "menos, mejor"}`,
      },
      {
        clave: "cortas",
        nombre: robosMode ? "La perdemos al momento" : "La recuperamos al momento",
        actual: porcentajeDe(actuales, (f) => cortas(seguidas(f)), (f) => seguidas(f).length),
        media: porcentajeAgregado(anteriores, (f) => cortas(seguidas(f)), (f) => seguidas(f).length),
        formato: formatoPorcentaje,
        formatoDiferencia: formatoPuntos,
        mejorAlto: robosMode ? false : true,
        pie: `${cortas(seguidas(actuales))} de ${seguidas(actuales).length} con desenlace anotado${pequena(seguidas(actuales).length)} · ${robosMode ? "menos, mejor" : "más, mejor"}`,
      },
      {
        clave: "campo",
        nombre: robosMode ? "Robos en campo rival" : "Pérdidas en campo propio",
        actual: enCampo(robosMode ? "campo rival" : "campo propio")(actuales),
        media: mediaPorPartido(anteriores, enCampo(robosMode ? "campo rival" : "campo propio")),
        mejorAlto: robosMode ? true : false,
        pie: robosMode ? "la presión alta que funciona" : "las que más peligro traen",
      },
      {
        clave: "duracion",
        nombre: robosMode ? "Duración media de la posesión" : "Duración media de su posesión",
        actual: duracion(actuales),
        media: duracionMediaDe(anteriores),
        formato: segundos,
        mejorAlto: robosMode ? null : false,
        pie: robosMode ? "según el estilo" : "cuanto menos dure su posesión, mejor",
      },
    ];

    /*
    | 30/10/2026: la base de la media en cada fila, igual en robos y en
    | pérdidas: «frente a 5 partidos, tendencia». Antes sólo lo decía una
    | línea sobre la tabla (y con 7 partidos, ni eso).
    */
    const nRef = anteriores.length;
    const baseMedia = nRef
      ? `frente a ${nRef === 1 ? "un partido" : `${nRef} partidos`}${nRef <= 7 ? ", tendencia" : ""}`
      : "";

    return {
      partido: `${comparado.jornada} · ${nombreEquipo(comparado.rival)}`,
      anteriores: { n: anteriores.length },
      metricas: baseMedia
        ? metricas.map((m) => ({ ...m, pie: m.pie ? `${m.pie} · ${baseMedia}` : baseMedia }))
        : metricas,
      nota:
        quien === "todos"
          ? `Se compara el último partido (${comparado.jornada}) aunque abajo se vean todos. La media es por partido, con los mismos filtros. Verde: mejor que la media; naranja: peor.`
          : undefined,
    };
  }, [comparado, partidos, conDudosos, DUDOSA, filtros, modo, T, quien]);

  /* ------------------------------------------------------------------ */
  /*  El campo: cada robo o pérdida en su tercio y su carril              */
  /* ------------------------------------------------------------------ */

  /* El campo ignora su propio filtro de sitio: lo elegido se marca, lo demás se apaga. */
  const paraCampo = filtrados(["zona", "carril"]);
  const sinSitio = paraCampo.filter((r) => !r.carril || !ZONA_EN_CAMPO[zonaDe(r)]).length;

  const puntosCampo: PuntoCampo[] = paraCampo.map((r) => {
    const desenlace = DESENLACES.find((d) => d.clave === r.desenlace)?.nombre;
    const quienLo = jugadorDe(r) ? `${tipoDe(r)} de ${jugadorDe(r)}` : tipoDe(r) || (modo === "robos" ? "Robo" : "Pérdida");

    return {
      id: idDe(r),
      zona: ZONA_EN_CAMPO[zonaDe(r)] ?? "",
      carril: r.carril,
      color: COLOR_ACCION[r.accion] ?? ACERO,
      anillo: r.desenlace === "REMATE" || r.desenlace === "AREA",
      titulo: `${minutoDe(r) || reloj(r.seg)} · ${quienLo}\n${zonaDe(r)} · ${r.carril === "centro" ? "por el centro" : r.carril ? `por la ${r.carril}` : "carril sin anotar"}\n${T.paneles.rotuloSalida}: ${NOMBRE_ACCION[r.accion] ?? r.accion}${desenlace ? ` · acaba en ${desenlace.toLowerCase()}` : ""}${r.duracion !== null ? ` · ${r.duracion} s` : ""}${r.confianza === "baja" ? "\n(dudoso)" : ""}${textoDe(r) ? `\n${textoDe(r)}` : ""}`,
    };
  });

  /* La cifra de cada cajón: las que salen hacia delante y el resto. */
  const cuentaCajon = (lista: PuntoCampo[]) => {
    const ids = new Set(lista.map((p) => p.id));
    const dentro = paraCampo.filter((r) => ids.has(idDe(r)));
    const ade = dentro.filter((r) => r.accion === "ADELANTE").length;
    const resto = dentro.length - ade;

    return (
      <>
        {ade ? <tspan fill={COLOR_ACCION.ADELANTE}>{ade}</tspan> : null}
        {ade && resto ? <tspan fill="rgba(255,255,255,0.35)"> · </tspan> : null}
        {resto ? <tspan fill="rgba(255,255,255,0.8)">{resto}</tspan> : null}
      </>
    );
  };

  /** Lo que dicen las filas que se están viendo (partido y filtro), en pocas frases. */
  const conclusiones = useMemo(() => {
    const total = robos.length;

    if (total === 0) return [];

    const frases: string[] = [];

    const partidosVistos = new Set(robos.map((r) => r.partido)).size;

    const conFiltro = Object.keys(filtros).length > 0 ? " con este filtro" : "";

    frases.push(
      partidosVistos > 1
        ? `${total} ${T.unidad} en ${partidosVistos} partidos${conFiltro}.`
        : `${total} ${total === 1 ? T.unidadUna : T.unidad} en el partido${conFiltro}.`,
    );

    const salen = robos.filter(
      (r) => r.accion === "ADELANTE" || r.accion === "HORIZONTAL_ATRAS",
    );
    const haciaDelante = salen.filter((r) => r.accion === "ADELANTE").length;

    if (salen.length) {
      frases.push(T.conclusiones.adelante(pct(haciaDelante, salen.length), haciaDelante, salen.length));
    }

    const zonas = ZONAS.map((z) => {
      const dentro = robos.filter((r) => zonaDe(r) === z);
      return {
        zona: z,
        total: dentro.length,
        juegan: dentro.filter((r) => r.accion === "ADELANTE" || r.accion === "HORIZONTAL_ATRAS").length,
        adelante: dentro.filter((r) => r.accion === "ADELANTE").length,
      };
    }).sort((a, b) => b.total - a.total);

    const top = zonas[0];

    /* Una sola base por cifra: los que salen adelante se cuentan sobre los que se juegan, como en la tabla. */
    if (top && top.total > 0) {
      frases.push(T.conclusiones.zona(top.zona, top.total, total, top.adelante, top.juegan));
    }

    const seguidas = robos.filter((r) => r.desenlace);

    if (seguidas.length) {
      const llegan = seguidas.filter(
        (r) => r.desenlace === "REMATE" || r.desenlace === "AREA",
      ).length;
      const pierden = seguidas.filter((r) =>
        modo === "robos" ? r.desenlace === "PERDIDA" : r.desenlace === "RECUPERAMOS",
      ).length;

      frases.push(T.conclusiones.acaba(pct(llegan, seguidas.length), pct(pierden, seguidas.length), seguidas.length));

      const tiempos = seguidas
        .map((r) => r.duracion)
        .filter((d): d is number => typeof d === "number");

      if (tiempos.length) {
        frases.push(T.conclusiones.dura(decimal(tiempos.reduce((a, b) => a + b, 0) / tiempos.length)));
      }
    }

    return frases;
  }, [robos, filtros, T, modo]);

  /*
  | Qué toca en la semana: la cifra que más se aleja de la media de los
  | anteriores *hacia lo malo*, con la tarea que le corresponde y el atajo a
  | las acciones concretas en «Robo a robo». Sin media, o si nada empeora,
  | no se dice nada.
  */
  const queToca = useMemo(() => {
    if (!comparativa) return null;

    const TAREA: Record<string, { tarea: string; filtro: [string, string][] }> =
      modo === "robos"
        ? {
            total: { tarea: "recuperación del balón", filtro: [] },
            adelante: { tarea: "primera salida tras el robo", filtro: [["accion", "HORIZONTAL_ATRAS"]] },
            llegan: { tarea: "acabar las transiciones en remate o área", filtro: [["accion", "ADELANTE"]] },
            cortas: { tarea: "cuidar el balón recién robado", filtro: [["desenlace", "PERDIDA"]] },
            campo: { tarea: "presión alta tras pérdida en campo rival", filtro: [["zona", "campo rival"]] },
          }
        : {
            total: { tarea: "seguridad con balón", filtro: [] },
            adelante: { tarea: "contrapresión tras la pérdida", filtro: [["accion", "ADELANTE"]] },
            llegan: { tarea: "protección del área tras pérdida", filtro: [["desenlace", "REMATE"], ["desenlace", "AREA"]] },
            cortas: { tarea: "recuperación inmediata", filtro: [["accion", "RECUPERAMOS"]] },
            campo: { tarea: "salida de balón desde campo propio", filtro: [["zona", "campo propio"]] },
          };

    let peor: { m: MetricaComparada; peso: number } | null = null;

    for (const m of comparativa.metricas) {
      if (m.mejorAlto !== true && m.mejorAlto !== false) continue;
      if (m.actual === null || m.media === null || !TAREA[m.clave]) continue;

      const d = m.actual - m.media;

      if (Math.abs(d) < 0.05 || (d > 0) === m.mejorAlto) continue;

      const peso = Math.abs(d) / Math.max(Math.abs(m.media), 1);

      if (!peor || peso > peor.peso) peor = { m, peso };
    }

    if (!peor) return null;

    const m = peor.m;
    const formato = m.formato ?? numeroCorto;
    const { tarea, filtro } = TAREA[m.clave];

    /* La base de la cifra («11 de 66») y, con pocos partidos detrás, que es tendencia. */
    const base = m.pie?.match(/^\d+ de \d+/)?.[0];
    const nRef = comparativa.anteriores.n;
    const aviso = ` (media de ${nRef === 1 ? "un solo partido" : `${nRef} partidos`}${modo === "robos" ? "" : ", los etiquetados en vídeo"}${nRef <= 6 ? ", tendencia" : ""})`;

    return {
      texto: `${m.nombre}: ${formato(m.actual!)}${base ? ` (${base})` : ""} frente a ${formato(m.media!)}${aviso}. Conviene trabajar en la semana una tarea de ${tarea}; criterio de éxito, ${m.nombre.toLowerCase()} ${m.mejorAlto ? "por encima de" : "por debajo de"} ${formato(m.media!)} en el próximo partido.`,
      filtro,
    };
  }, [comparativa, modo]);

  /* ------------------------------------------------------------------ */
  /*  Por jugador                                                        */
  /* ------------------------------------------------------------------ */

  /*
  | Con todos los filtros menos el del propio jugador: al elegir uno se ven
  | los demás, con él marcado. Sólo entran los partidos con jugador (los del
  | timeline de Hudl); los mirados a ojo se dicen aparte.
  */
  const paraJugador = filtrados(["jugador"]);
  const conJugador = elegidos.filter((p) => p.robos.some((r) => r.jugador));
  const sinJugador = elegidos.filter((p) => p.robos.length > 0 && !p.robos.some((r) => r.jugador));
  const fuera = paraJugador.filter((r) => !jugadorDe(r)).length;
  const columnasJugador = COLUMNAS_JUGADOR[modo];

  const frasesJugador = (() => {
    const cuenta = new Map<string, RoboVisto[]>();

    for (const r of paraJugador) {
      const q = jugadorDe(r);
      if (q) cuenta.set(q, [...(cuenta.get(q) ?? []), r]);
    }

    const lista = [...cuenta.entries()].map(([jugador, filas]) => ({ jugador, filas }));

    if (lista.length === 0) return [];

    const frases: string[] = [];
    const porTotal = [...lista].sort((a, b) => b.filas.length - a.filas.length);
    const [primero, segundo] = porTotal;

    frases.push(
      `${primero.jugador} es el que más ${modo === "robos" ? "roba" : "pierde"}: ${primero.filas.length}${segundo ? `, por delante de ${segundo.jugador} (${segundo.filas.length})` : ""}.`,
    );

    const llegan = [...lista]
      .map((l) => ({ ...l, n: l.filas.filter(llegaAlArea).length }))
      .sort((a, b) => b.n - a.n)[0];

    if (llegan && llegan.n > 0) {
      frases.push(
        modo === "robos"
          ? `Los robos de ${llegan.jugador} son los que más acaban en remate o área (${llegan.n}).`
          : `Las pérdidas más caras son de ${llegan.jugador}: ${llegan.n} acaban en remate o en nuestra área.`,
      );
    }

    const zona = modo === "robos" ? "campo rival" : "campo propio";
    const enZona = [...lista]
      .map((l) => ({ ...l, n: l.filas.filter((r) => zonaDe(r) === zona).length }))
      .sort((a, b) => b.n - a.n)[0];

    if (enZona && enZona.n > 0) {
      frases.push(
        modo === "robos"
          ? `En campo rival roba sobre todo ${enZona.jugador} (${enZona.n}).`
          : `En nuestro campo pierde sobre todo ${enZona.jugador} (${enZona.n}).`,
      );
    }

    return frases;
  })();

  return (
    <main className="min-h-screen bg-[#0B0F14] text-white">
      <div className="flex">
        <Sidebar />

        <section className="flex min-w-0 flex-1 flex-col">
          <Topbar />

          <div className="min-w-0 px-4 py-6 sm:px-6 lg:px-10">
            <AbpHeader
              area="RMCF Castilla · Análisis del partido"
              title={T.titulo}
              lead={
                modo === "perdidas"
                  ? "Pérdidas etiquetadas en vídeo, partido a partido: no son las pérdidas por partido de Wyscout que salen en Data Análisis, que cuentan con otro criterio."
                  : undefined
              }
            />

            <SelloDeFechas fuente="Vídeo etiquetado" fechas={fechasConDato} queEs={T.unidad} />

            {/* 30/10/2026: por qué el selector no empieza en la J1 (análisis y marketing). */}
            {primeraConDato && !/^J0*1$/i.test(primeraConDato.trim()) ? (
              <p className="mt-2 text-[12px] text-white/60">
                Empieza en la {primeraConDato}: es el primer partido con vídeo etiquetado.
              </p>
            ) : null}

            {/* ---------------- mandos ---------------- */}

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setQuien("todos")}
                className={`rounded-xl border px-3 py-2 text-sm transition ${
                  quien === "todos"
                    ? "border-[#C8A96B]/40 bg-[#C8A96B]/15 text-[#C8A96B]"
                    : "border-white/10 bg-white/[0.03] text-white/70 hover:border-white/20"
                }`}
              >
                Temporada
              </button>

              {partidos.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setQuien(p.id)}
                  className={`rounded-xl border px-3 py-2 text-sm transition ${
                    quien === p.id
                      ? "border-[#C8A96B]/40 bg-[#C8A96B]/15 text-[#C8A96B]"
                      : "border-white/10 bg-white/[0.03] text-white/70 hover:border-white/20"
                  }`}
                >
                  {p.jornada} · {nombreEquipo(p.rival)}
                </button>
              ))}

              <span className="mx-1 h-6 w-px bg-white/10" />

              <button
                type="button"
                onClick={() => setPorcentajes((v) => !v)}
                className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/70 transition hover:border-white/20"
              >
                {porcentajes ? "Ver totales" : "Ver porcentajes"}
              </button>

              <Explicativo>
              <button
                type="button"
                onClick={() => setConDudosos((v) => !v)}
                title={explicativos ? T.dudosos : undefined}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/70 transition hover:border-white/20"
              >
                <Eye size={14} />
                {conDudosos ? "Quitar los dudosos" : "Incluir los dudosos"}
              </button>
              </Explicativo>

              {/*
                Cuánto partido lleva revisado. Mientras falten bloques, los
                totales son de esos minutos y no del partido.
              */}
              <Explicativo>
              <span
                className={`ml-auto rounded-xl border px-3 py-2 text-xs ${
                  cobertura.completo
                    ? "border-white/10 bg-white/[0.03] text-white/45"
                    : "border-amber-400/25 bg-amber-400/[0.07] text-amber-200/80"
                }`}
              >
                {cobertura.completo
                  ? `Revisado entero · ${cobertura.minutosVideo} min`
                  : `Revisado ${cobertura.minutosVistos} de ${cobertura.minutosVideo} min`}
              </span>
              </Explicativo>
            </div>

            <BarraFiltros
              chips={chips}
              onLimpiar={quitaTodo}
              cuenta={{ vistas: robos.length, total: base.length, unidad: T.unidad }}
              pretemporada={
                HAY_PRETEMPORADA
                  ? { incluida: conPretemporada, onCambiar: setConPretemporada }
                  : undefined
              }
              className="mt-3"
            />

            <div className="mt-4">
              <Pestanas
                etiqueta="Vistas"
                valor={vista}
                onCambia={setVista}
                opciones={[
                  { clave: "resumen", label: "Resumen", icono: LayoutDashboard },
                  { clave: "campo", label: "En el campo", icono: MapIcon },
                  { clave: "detalle", label: "Detalle", icono: BarChart3 },
                  { clave: "jugadores", label: "Por jugador", icono: Users },
                  { clave: "lista", label: modo === "robos" ? "Robo a robo" : "Pérdida a pérdida", icono: List, cuenta: robos.length },
                ]}
              />
            </div>

            {vista === "resumen" && (
            <>
            {/* ---------------- este partido frente a los anteriores ---------------- */}

            {/* 29/10/2026: en el móvil se deja a la derecha el ancho del botón ⋮
                flotante, que tapaba la columna DIFERENCIA («−5,3» salía «−5,»). */}
            {comparativa && (
              <div className="pr-12 sm:pr-0">
              <ComparativaPartido
                partido={comparativa.partido}
                anteriores={{
                  ...comparativa.anteriores,
                  rotulo:
                    comparativa.anteriores.n > 1
                      ? `media de los ${comparativa.anteriores.n} anteriores con vídeo etiquetado (de ${partidos.length} etiquetados en la temporada)`
                      : undefined,
                }}
                metricas={comparativa.metricas}
                nota={explicativos ? comparativa.nota : undefined}
                className="mt-5"
              />
              </div>
            )}

            <Conclusiones items={[...conclusiones, queToca?.texto]} className="mt-5" />

            {queToca ? (
              <button
                type="button"
                onClick={() => {
                  limpia();
                  if (queToca.filtro.length) alternaVarios(queToca.filtro);
                  setVista("lista");
                }}
                className="mt-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/75 transition hover:border-[#C8A96B]/40"
              >
                {modo === "robos" ? "Ver esos robos, uno a uno" : "Ver esas pérdidas, una a una"}
              </button>
            ) : null}

            {/* ---------------- cifras ---------------- */}

            {/* 30/10/2026: con un solo partido el total ya está en la tabla de arriba
                (y en el filtro): la tarjeta repetía «38 robos · 1 partido» (marketing). */}
            <div className={`mt-5 grid grid-cols-2 gap-3 ${unPartido ? "lg:grid-cols-3" : "lg:grid-cols-4"}`}>
              {unPartido ? null : (
              <Cifra
                valor={String(robos.length)}
                rotulo={T.serieTotal}
                pie={explicativos ? `en ${cobertura.minutosVistos} min revisados` : `${elegidos.length} ${elegidos.length === 1 ? "partido" : "partidos"}`}
                icono={Crosshair}
              />
              )}

              <Cifra
                valor={`${pct(adelante, jugados.length)}%`}
                rotulo={T.cifras.adelante}
                pie={`${adelante} de ${jugados.length} con pase o conducción`}
                color={COLOR_ACCION.ADELANTE}
                icono={ArrowUp}
                onClick={() => alterna("accion", "ADELANTE")}
                activo={estaActivo(filtros, "accion", "ADELANTE")}
                atenuado={hayFiltro(filtros, "accion")}
              />

              <Cifra
                valor={`${pct(jugados.length - adelante, jugados.length)}%`}
                rotulo={T.cifras.horizontal}
                pie={`${jugados.length - adelante} de ${jugados.length}`}
                color={ACERO}
                icono={ArrowLeftRight}
                onClick={() => alterna("accion", "HORIZONTAL_ATRAS")}
                activo={estaActivo(filtros, "accion", "HORIZONTAL_ATRAS")}
                atenuado={hayFiltro(filtros, "accion")}
              />

              <Cifra
                valor={`${duracionMedia} s`}
                rotulo={T.cifras.duracion}
                pie={conDesenlace.length ? T.cifras.llegan(llegadas, conDesenlace.length) : undefined}
                icono={Timer}
              />
            </div>

            </>
            )}

            {vista === "campo" && (
            <>
            {/* ---------------- dónde, en el campo ---------------- */}

            <div className="mt-5">
              <Panel
                title={modo === "robos" ? "Dónde robamos" : "Dónde perdemos el balón"}
                subtitle={
                  explicativos
                    ? `Cada ${T.unidadUna} en su tercio y su carril; el color dice cómo sale, el anillo que acaba en remate o en el área. Pincha una casilla, un tercio o un carril para filtrar.`
                    : undefined
                }
                icon={MapIcon}
                bodyClassName="p-0"
              >
                {paraCampo.length === 0 ? (
                  <p className="p-4 text-sm text-white/45 sm:p-5">{base.length === 0 ? T.vacio : T.vacioFiltro}</p>
                ) : (
                  <CampoZonas
                    puntos={puntosCampo}
                    zonas={ZONAS_CAMPO}
                    carriles={CARRILES_CAMPO}
                    resaltado={resaltado}
                    onResaltar={setResaltado}
                    zonasMarcadas={(filtros.zona ?? []).map((z) => ZONA_EN_CAMPO[z] ?? z)}
                    carrilesMarcados={filtros.carril ?? []}
                    onCajon={(zona, carril) =>
                      alternaVarios([
                        ["zona", ZONA_DEL_CAMPO[zona] ?? zona],
                        ["carril", carril],
                      ])
                    }
                    onZona={(zona) => alterna("zona", ZONA_DEL_CAMPO[zona] ?? zona)}
                    onCarril={(carril) => alterna("carril", carril)}
                    cuenta={cuentaCajon}
                    unidad={{ una: T.unidadUna, varias: T.unidad }}
                    ariaLabel={`Campo con ${T.unidad} por tercio y carril`}
                    leyenda={
                      <>
                        {T.acciones.map((a) => (
                          <button
                            key={a.clave}
                            type="button"
                            onClick={() => alterna("accion", a.clave)}
                            aria-pressed={estaActivo(filtros, "accion", a.clave)}
                            title={TITULO_FILTRO}
                            style={marcaPieza(estaActivo(filtros, "accion", a.clave), hayFiltro(filtros, "accion"))}
                            className="inline-flex cursor-pointer items-center gap-1.5 rounded-md px-1 transition hover:opacity-100"
                          >
                            <span className="h-2.5 w-2.5 rounded-full" style={{ background: a.color }} />
                            {a.nombre}
                          </button>
                        ))}
                        <span className="inline-flex items-center gap-1.5">
                          <span className="h-3 w-3 rounded-full border-2 border-white/80" /> acaba en remate o en el área
                        </span>
                        <span>Cifras de cada zona: hacia delante · el resto</span>
                        {/* En línea: el pie del campo es verde oscuro en los dos temas
                            y la clase se volvía tinta oscura en modo día. */}
                        {sinSitio > 0 && explicativos && (
                          <span style={{ color: "rgba(255,255,255,0.45)" }}>{sinSitio} sin carril anotado, fuera del campo</span>
                        )}
                      </>
                    }
                  />
                )}
              </Panel>
            </div>

            </>
            )}

            {vista === "detalle" && (
            <>
            {/* ---------------- qué pasa con el balón ---------------- */}

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <Panel
                title={T.paneles.accion}
                subtitle={explicativos ? T.paneles.accionSub : undefined}
                icon={Target}
              >
                {paraAccion.length === 0 ? (
                  <p className="text-sm text-white/45">
                    {base.length === 0 ? T.vacio : T.vacioFiltro}
                  </p>
                ) : (
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={porAccion}
                          dataKey="valor"
                          nameKey="nombre"
                          innerRadius={62}
                          outerRadius={100}
                          paddingAngle={2}
                          stroke="none"
                          onClick={(_, i) => {
                            const d = porAccion[i];
                            if (d) alterna("accion", d.clave);
                          }}
                        >
                          {porAccion.map((d) => (
                            <Cell
                              key={d.clave}
                              fill={d.color}
                              {...marcaSvg(
                                estaActivo(filtros, "accion", d.clave),
                                hayFiltro(filtros, "accion"),
                              )}
                            />
                          ))}

                          <LabelList
                            dataKey="valor"
                            position="outside"
                            fill="#CBD5E1"
                            fontSize={12}
                            formatter={(v: unknown) => {
                              const n = Number(v);
                              if (!Number.isFinite(n)) return "";
                              return porcentajes
                                ? `${pct(n, paraAccion.length)}%`
                                : String(n);
                            }}
                          />
                        </Pie>

                        <Tooltip content={<Pista />} />

                        <Legend
                          verticalAlign="bottom"
                          iconType="circle"
                          onClick={(dato) => {
                            const d = porAccion.find((x) => x.nombre === dato.value);
                            if (d) alterna("accion", d.clave);
                          }}
                          formatter={(v) => {
                            const d = porAccion.find((x) => x.nombre === v);
                            return (
                              <span
                                className="text-xs text-white/60"
                                title={TITULO_FILTRO}
                                style={{
                                  ...marcaPieza(
                                    Boolean(d && estaActivo(filtros, "accion", d.clave)),
                                    hayFiltro(filtros, "accion"),
                                  ),
                                  cursor: "pointer",
                                  borderRadius: 4,
                                  padding: "0 2px",
                                }}
                              >
                                {v}
                              </span>
                            );
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </Panel>

              <Panel
                title={T.paneles.zona}
                subtitle={
                  porcentajes
                    ? "Reparto dentro de cada zona"
                    : `${T.serieTotal} por zona del campo`
                }
                icon={MapIcon}
                analisis={
                  explicativos && robos.length > 3 ? (
                    <p className="mx-4 mb-4 border-l-2 border-[#C8A96B]/40 pl-3 text-[12px] leading-relaxed text-white/60 sm:mx-5">
                      {T.paneles.zonaAnalisis}
                    </p>
                  ) : undefined
                }
              >
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={porZona}>
                      <CartesianGrid stroke="#1E232A" vertical={false} />

                      <XAxis
                        dataKey="zona"
                        tick={{ fill: "#94A3B8", fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                      />

                      <YAxis
                        tick={{ fill: "#94A3B8", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        unit={porcentajes ? "%" : ""}
                      />

                      <Tooltip content={<Pista />} cursor={{ fill: "#ffffff08" }} />

                      <Legend
                        iconType="circle"
                        onClick={pinchaLeyenda}
                        formatter={(v) => leyenda(String(v))}
                      />

                      {/* Cada trozo se pincha y filtra por su zona Y su salida; la leyenda, sólo por la salida. */}
                      {(
                        [
                          { serie: nombreAdelante, color: COLOR_ACCION.ADELANTE, radio: [0, 0, 0, 0] },
                          { serie: nombreHorizontal, color: COLOR_ACCION.HORIZONTAL_ATRAS, radio: [0, 0, 0, 0] },
                          { serie: "Otro", color: ACERO, radio: [8, 8, 0, 0] },
                        ] as { serie: string; color: string; radio: [number, number, number, number] }[]
                      ).map(({ serie, color, radio }) => (
                        <Bar
                          key={serie}
                          dataKey={serie}
                          stackId="z"
                          fill={color}
                          radius={radio}
                          onClick={(_, i) => {
                            const z = porZona[i];
                            if (z) alternaSegmento(String(z.clave), serie);
                          }}
                        >
                          {porZona.map((z) => (
                            <Cell
                              key={String(z.clave)}
                              fill={color}
                              {...marcaSvg(segmentoActivo(String(z.clave), serie), hayZonaOSalida)}
                            />
                          ))}
                        </Bar>
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Panel>
            </div>

            {/* ---------------- desenlace y momento ---------------- */}

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <Panel
                title={T.paneles.desenlace}
                subtitle={
                  paraDesenlace.length
                    ? `${paraDesenlace.length} jugadas seguidas hasta el final`
                    : "todavía sin seguimiento completo"
                }
                icon={Crosshair}
              >
                {porDesenlace.length === 0 ? (
                  <p className="text-sm text-white/45">
                    Los bloques con seguimiento del desenlace aún no han llegado.
                  </p>
                ) : (
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={porDesenlace} layout="vertical" margin={{ left: 24 }}>
                        <CartesianGrid stroke="#1E232A" horizontal={false} />

                        <XAxis
                          type="number"
                          tick={{ fill: "#94A3B8", fontSize: 11 }}
                          axisLine={false}
                          tickLine={false}
                          allowDecimals={false}
                        />

                        <YAxis
                          type="category"
                          dataKey="nombre"
                          width={140}
                          tick={{ fill: "#94A3B8", fontSize: 12 }}
                          axisLine={false}
                          tickLine={false}
                        />

                        <Tooltip content={<Pista />} cursor={{ fill: "#ffffff08" }} />

                        <Bar
                          dataKey="valor"
                          name="Jugadas"
                          radius={[0, 8, 8, 0]}
                          onClick={(_, i) => {
                            const d = porDesenlace[i];
                            if (d) alterna("desenlace", d.clave);
                          }}
                        >
                          {porDesenlace.map((d) => (
                            <Cell
                              key={d.clave}
                              fill={d.color}
                              {...marcaSvg(
                                estaActivo(filtros, "desenlace", d.clave),
                                hayFiltro(filtros, "desenlace"),
                              )}
                            />
                          ))}

                          <LabelList
                            dataKey="valor"
                            position="right"
                            fill="#CBD5E1"
                            fontSize={12}
                          />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </Panel>

              <Panel
                title={T.paneles.cuando}
                subtitle={
                  explicativos
                    ? "Por cuartos de hora del partido (el descuento, en el último de su parte); en los partidos sin minuto, del vídeo"
                    : undefined
                }
                icon={Clock}
              >
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={porTramo}>
                      <CartesianGrid stroke="#1E232A" vertical={false} />

                      <XAxis
                        dataKey="tramo"
                        tick={{ fill: "#94A3B8", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />

                      <YAxis
                        tick={{ fill: "#94A3B8", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        allowDecimals={false}
                      />

                      <Tooltip content={<Pista />} cursor={{ fill: "#ffffff08" }} />

                      <Legend
                        iconType="circle"
                        onClick={pinchaLeyenda}
                        formatter={(v) => leyenda(String(v))}
                      />

                      {/* Las dos barras de un tramo filtran por ese tramo. */}
                      {(
                        [
                          { serie: T.serieTotal, color: ACERO },
                          { serie: T.serieAdelante, color: COLOR_ACCION.ADELANTE },
                        ] as const
                      ).map(({ serie, color }) => (
                        <Bar
                          key={serie}
                          dataKey={serie}
                          fill={color}
                          radius={[8, 8, 0, 0]}
                          onClick={(_, i) => {
                            const t = porTramo[i];
                            if (t) alterna("tramo", String(t.clave));
                          }}
                        >
                          {porTramo.map((t) => (
                            <Cell
                              key={String(t.clave)}
                              fill={color}
                              {...marcaSvg(
                                estaActivo(filtros, "tramo", String(t.clave)),
                                hayFiltro(filtros, "tramo"),
                              )}
                            />
                          ))}
                        </Bar>
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Panel>
            </div>

            {/* ---------------- carriles ---------------- */}

            {porCarril.some((c) => Number(c[T.serieTotal]) > 0) && (
              <div className="mt-4">
                <Panel
                  title="Por qué carril"
                  subtitle={
                    explicativos ? "Sólo los bloques con el etiquetado ampliado" : undefined
                  }
                  icon={MapIcon}
                >
                  <div className="h-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={porCarril}>
                        <CartesianGrid stroke="#1E232A" vertical={false} />

                        <XAxis
                          dataKey="carril"
                          tick={{ fill: "#94A3B8", fontSize: 12 }}
                          axisLine={false}
                          tickLine={false}
                        />

                        <YAxis
                          tick={{ fill: "#94A3B8", fontSize: 11 }}
                          axisLine={false}
                          tickLine={false}
                          allowDecimals={false}
                        />

                        <Tooltip content={<Pista />} cursor={{ fill: "#ffffff08" }} />

                        <Legend
                          iconType="circle"
                          onClick={pinchaLeyenda}
                          formatter={(v) => leyenda(String(v))}
                        />

                        {/* Las dos barras de un carril filtran por ese carril. */}
                        {(
                          [
                            { serie: T.serieTotal, color: ACERO },
                            { serie: T.serieAdelante, color: COLOR_ACCION.ADELANTE },
                          ] as const
                        ).map(({ serie, color }) => (
                          <Bar
                            key={serie}
                            dataKey={serie}
                            fill={color}
                            radius={[8, 8, 0, 0]}
                            onClick={(_, i) => {
                              const c = porCarril[i];
                              if (c) alterna("carril", String(c.clave));
                            }}
                          >
                            {porCarril.map((c) => (
                              <Cell
                                key={String(c.clave)}
                                fill={color}
                                {...marcaSvg(
                                  estaActivo(filtros, "carril", String(c.clave)),
                                  hayFiltro(filtros, "carril"),
                                )}
                              />
                            ))}
                          </Bar>
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Panel>
              </div>
            )}

            </>
            )}

            {vista === "jugadores" && (
            <>
            {/* ---------------- por jugador ---------------- */}

            <Conclusiones items={frasesJugador} className="mt-5" />

            <div className="mt-4">
              <Panel
                title={modo === "robos" ? "Quién roba" : "Quién pierde el balón"}
                subtitle={
                  conJugador.length === 0
                    ? undefined
                    : `${
                        quien === "todos"
                          ? `Temporada: suma de ${conJugador.length} ${conJugador.length === 1 ? "partido" : "partidos"} con jugador (${conJugador.map((p) => p.jornada).join(", ")})`
                          : `${conJugador[0].jornada} · ${nombreEquipo(conJugador[0].rival)}`
                      }${sinJugador.length ? `. ${sinJugador.map((p) => p.jornada).join(" y ")} no ${sinJugador.length === 1 ? "entra" : "entran"}: se ${sinJugador.length === 1 ? "miró" : "miraron"} a ojo y no ${sinJugador.length === 1 ? "tiene" : "tienen"} jugador` : ""}. Pulsa un nombre para filtrar la pantalla por él; pulsa una cabecera para ordenar`
                }
                icon={Users}
                bodyClassName="p-0"
              >
                {conJugador.length === 0 ? (
                  <SinJugador>
                    {base.length === 0
                      ? T.vacio
                      : quien === "todos"
                        ? "Ninguno de estos partidos tiene jugador: se miraron a ojo, imagen a imagen. El jugador sale del timeline de Hudl, desde el J4."
                        : `Este partido se miró a ojo, imagen a imagen: no tiene jugador. El jugador sale del timeline de Hudl, desde el J4.`}
                  </SinJugador>
                ) : paraJugador.every((r) => !jugadorDe(r)) ? (
                  <SinJugador>{T.vacioFiltro}</SinJugador>
                ) : (
                  <PorJugador
                    filas={paraJugador}
                    jugadorDe={jugadorDe}
                    sitioDe={sitioDe}
                    partidoDe={partidoDeFila}
                    total={{
                      rotulo: T.serieTotal,
                      explica: modo === "robos" ? "Robos del jugador con los filtros de la pantalla" : "Pérdidas del jugador con los filtros de la pantalla",
                    }}
                    columnas={columnasJugador}
                    marcados={filtros.jugador ?? []}
                    onJugador={(j) => alterna("jugador", j)}
                  />
                )}
              </Panel>

              {explicativos && conJugador.length > 0 && (
                <p className="mt-3 text-[11px] leading-relaxed text-white/40">
                  {modo === "robos"
                    ? "«Salen adelante»: lo primero tras el robo es un pase o una conducción hacia delante (el % es sobre los que se juegan). «Remate o área»: la jugada que nace del robo acaba en remate o con balón en el área rival (el % es sobre los que tienen desenlace). El campo en miniatura es el del partido de verdad: el Castilla ataca hacia la derecha y, cuanto más oro, más robos en esa casilla."
                    : "«Caras»: la posesión del rival que nace de la pérdida acaba en remate o en nuestra área (el % es sobre las que tienen desenlace). «Salen adelante»: lo primero que hace el rival es un pase o una conducción hacia delante. «Recuperada»: la volvemos a recuperar antes de que nos llegue. El campo en miniatura es el del partido de verdad: el Castilla ataca hacia la derecha y, cuanto más oro, más pérdidas en esa casilla."}
                  {fuera > 0 ? ` Con estos filtros quedan fuera ${fuera} ${fuera === 1 ? T.unidadUna : T.unidad} sin jugador.` : ""}
                  {" "}El jugador sale del timeline de Hudl (la sesión por jugador); no se mira cuántos minutos jugó cada uno.
                </p>
              )}
            </div>
            </>
            )}

            {vista === "lista" && (
            <>
            {/* ---------------- listado ---------------- */}

            <div className="mt-4">
              <Panel
                title={T.paneles.lista}
                subtitle={explicativos ? T.paneles.listaSub : undefined}
                icon={Crosshair}
                bodyClassName="p-0"
              >
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[860px] text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-[0.12em] text-white/40">
                        <th className="px-4 py-3">Min.</th>
                        {explicativos && <th className="px-4 py-3">Vídeo</th>}
                        {quien === "todos" && <th className="px-4 py-3">Partido</th>}
                        <th className="px-4 py-3">{T.paneles.columnaTipo}</th>
                        <th className="px-4 py-3">Zona</th>
                        <th className="px-4 py-3">Carril</th>
                        <th className="px-4 py-3">{T.paneles.rotuloSalida}</th>
                        <th className="px-4 py-3">Acaba en</th>
                        {explicativos && <th className="px-4 py-3">Fiabilidad</th>}
                        {explicativos && <th className="px-4 py-3">Qué pasó</th>}
                      </tr>
                    </thead>

                    <tbody>
                      {robos.map((r) => (
                        <tr
                          key={idDe(r)}
                          onMouseEnter={() => setResaltado(idDe(r))}
                          onMouseLeave={() => setResaltado(null)}
                          className={`border-b border-white/5 align-top hover:bg-white/[0.02] ${
                            resaltado === idDe(r) ? "bg-[#C8A96B]/10" : ""
                          }`}
                        >
                          <td className="whitespace-nowrap px-4 py-3 font-semibold tabular-nums text-white/80">
                            {(explicativos ? minutoDe(r) : minutoDe(r).replace(/\s*\([^)]*\)/, "")) || "—"}
                          </td>

                          {explicativos && (
                            <td className="whitespace-nowrap px-4 py-3 tabular-nums text-white/45">
                              {reloj(r.seg)}
                            </td>
                          )}

                          {quien === "todos" && (
                            <td className="whitespace-nowrap px-4 py-3 text-white/50">
                              <Filtrable activo={false} onClick={() => alternaPartido(r.partido)}>
                                {r.jornada}
                              </Filtrable>
                            </td>
                          )}

                          <td className="whitespace-nowrap px-4 py-3 text-white/70">
                            {jugadorDe(r) ? (
                              <>
                                {celda("jugador", jugadorDe(r))}
                                <span className="block text-[11px] text-white/40">
                                  {celda("tipo", tipoDe(r))}
                                </span>
                              </>
                            ) : (
                              "—"
                            )}
                          </td>

                          <td className="whitespace-nowrap px-4 py-3 text-white/60">
                            {celda("zona", zonaDe(r))}
                          </td>

                          <td className="whitespace-nowrap px-4 py-3 text-white/40">
                            {celda("carril", r.carril)}
                          </td>

                          <td className="whitespace-nowrap px-4 py-3">
                            <button
                              type="button"
                              onClick={() => alterna("accion", r.accion)}
                              aria-pressed={estaActivo(filtros, "accion", r.accion)}
                              title={TITULO_FILTRO}
                              className="cursor-pointer rounded-full px-2 py-0.5 text-xs font-semibold"
                              style={{
                                background: `${COLOR_ACCION[r.accion] ?? ACERO}22`,
                                color: COLOR_ACCION[r.accion] ?? ACERO,
                                ...(estaActivo(filtros, "accion", r.accion)
                                  ? marcaPieza(true, true)
                                  : {}),
                              }}
                            >
                              {NOMBRE_ACCION[r.accion] ?? r.accion}
                            </button>
                          </td>

                          <td className="whitespace-nowrap px-4 py-3 text-white/60">
                            {celda(
                              "desenlace",
                              r.desenlace,
                              DESENLACES.find((d) => d.clave === r.desenlace)?.nombre ??
                                r.desenlace,
                            )}
                            {r.duracion != null ? (
                              <span className="ml-1 text-white/30">· {r.duracion}s</span>
                            ) : null}
                          </td>

                          {explicativos && (
                          <td className="whitespace-nowrap px-4 py-3 text-xs">
                            <span
                              className={
                                r.confianza === "alta"
                                  ? "text-emerald-300/80"
                                  : r.confianza === "media"
                                  ? "text-white/45"
                                  : "text-amber-300/70"
                              }
                            >
                              {celda("confianza", r.confianza)}
                            </span>
                          </td>
                          )}

                          {explicativos && (
                            <td className="min-w-[280px] px-4 py-3 text-xs leading-relaxed text-white/45">
                              {textoDe(r) || "—"}
                            </td>
                          )}
                        </tr>
                      ))}

                      {robos.length === 0 && (
                        <tr>
                          <td
                            colSpan={6 + (quien === "todos" ? 1 : 0) + (explicativos ? 3 : 0)}
                            className="px-4 py-8 text-center text-white/40"
                          >
                            {base.length === 0 ? T.vacio : T.vacioFiltro}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Panel>
            </div>

            {/* ---------------- goles ---------------- */}

            {elegidos.some((p) => p.goles.length > 0) && (
              <div className="mt-4">
                <Panel title="Goles del partido" icon={Target}>
                  <ul className="space-y-1.5 text-sm text-white/60">
                    {elegidos.flatMap((p) =>
                      p.goles.map((g) => (
                        <li key={`${p.id}-${g.seg}`}>
                          {explicativos ? (
                            <>
                              <span className="font-semibold tabular-nums text-white/80">{reloj(g.seg)}</span> · {g.texto}
                            </>
                          ) : (
                            <span className="text-white/75">{textoGolCorto(g.texto)}</span>
                          )}
                        </li>
                      )),
                    )}
                  </ul>
                </Panel>
              </div>
            )}

            </>
            )}

            <Explicativo>
              {modo === "robos" ? (
                <div className="mt-4">
                  <ComoActualizar
                    videoPorDefecto={paraActualizar?.video ?? ""}
                    partidoPorDefecto={paraActualizar?.id ?? ""}
                  />
                </div>
              ) : (
                <p className="mt-4 text-xs leading-relaxed text-white/40">
                  Las pérdidas salen solas del timeline de Hudl con el análisis del partido
                  (Ajustes → «Actualizar análisis del partido»), o a mano con{" "}
                  <code className="text-white/60">node scripts/partido/perdidas.cjs &lt;partido&gt;</code>{" "}
                  y después <code className="text-white/60">node scripts/transiciones-datos.mjs</code>.
                  Los dos primeros partidos (J2 y J3) se miraron imagen a imagen y no tienen pérdidas.
                </p>
              )}

              <p className="mt-6 text-xs leading-relaxed text-white/30">{T.criterio}</p>
            </Explicativo>
          </div>
        </section>
      </div>
    </main>
  );
}

export default PantallaTransiciones;
