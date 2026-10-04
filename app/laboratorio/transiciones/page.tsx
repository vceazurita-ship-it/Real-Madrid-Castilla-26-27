"use client";

/**
 * Laboratorio · Robos y transiciones.
 *
 * Qué mide: cada vez que el Castilla le quita el balón al rival de forma
 * ACTIVA (entrada, interceptación o balón ganado por presión), qué es lo
 * primero que hace con él —sale hacia delante o lo mueve en horizontal y hacia
 * atrás— y en qué acaba la jugada que nace de ahí.
 *
 * De dónde salen los datos: NO hay proveedor. Estos partidos no tienen datos de
 * eventos (Opta sólo trae PDF del rival, la caché de Wyscout son medias de liga
 * y no hay coding). La única fuente es el vídeo, mirado imagen a imagen: se
 * saca un fotograma por segundo, se apilan de dos en dos y alguien —aquí, un
 * agente— va diciendo de quién es el balón en cada momento. Por eso está en
 * obras y por eso la pantalla enseña SIEMPRE cuánto partido lleva revisado: si
 * un partido va por la mitad, los totales son de esa mitad, no del partido.
 *
 * Los datos los genera `scripts/transiciones-datos.mjs` a partir de los CSV de
 * `Downloads/RMCF CASTILLA/ANALISIS TRANSICIONES`. Cuando cierra un bloque
 * nuevo se vuelve a lanzar el script y esta pantalla se actualiza sola.
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
  Clock,
  Crosshair,
  Eye,
  Map as MapIcon,
  Target,
  Timer,
} from "lucide-react";

import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { AbpHeader, Panel } from "@/components/abp/ui";
import { PARTIDOS, type Accion, type Robo } from "@/lib/transiciones/datos";
import { ComoActualizar } from "@/components/transiciones/ComoActualizar";
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

/* ------------------------------------------------------------------ */
/*  Colores                                                            */
/* ------------------------------------------------------------------ */

/**
 * El par verde/naranja es el mismo que usa Data Análisis para «lo que sale
 * bien / lo que no», y se distingue con daltonismo. El acero y el burdeos son
 * para lo que no es ni una cosa ni la otra.
 */
const COLOR_ACCION: Record<Accion, string> = {
  ADELANTE: "#1B9E77",
  HORIZONTAL_ATRAS: "#D95F02",
  DESPEJE: "#66758A",
  PERDIDA: "#8A6262",
};

const NOMBRE_ACCION: Record<Accion, string> = {
  ADELANTE: "Adelante",
  HORIZONTAL_ATRAS: "Horizontal o atrás",
  DESPEJE: "Despeje",
  PERDIDA: "Pérdida inmediata",
};

const ORO = "#C8A96B";
const ACERO = "#66758A";

/** Los desenlaces, de lo mejor a lo peor, que es como se leen de un vistazo. */
const DESENLACES: { clave: string; nombre: string; color: string }[] = [
  { clave: "REMATE", nombre: "Remate", color: "#1B9E77" },
  { clave: "AREA", nombre: "Balón al área", color: "#4C9A7A" },
  { clave: "ULTIMO_TERCIO", nombre: "Último tercio", color: ORO },
  { clave: "FALTA_FAVOR", nombre: "Falta a favor", color: "#8FA0B8" },
  { clave: "POSESION", nombre: "Posesión larga", color: ACERO },
  { clave: "ATRAS_PORTERO", nombre: "Atrás al portero", color: "#5F6B7A" },
  { clave: "FUERA", nombre: "Sale por línea", color: "#7C6F9F" },
  { clave: "FALTA_CONTRA", nombre: "Falta nuestra", color: "#8A6262" },
  { clave: "PERDIDA", nombre: "La perdemos", color: "#D95F02" },
];

const ZONAS = ["campo propio", "medio campo", "campo rival"] as const;
const CARRILES = ["izquierda", "centro", "derecha"] as const;

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

/** Un robo con su partido pegado, que es lo que se cuenta en pantalla. */
type RoboVisto = Robo & { partido: string; jornada: string; rival: string };

/*
| El detalle de los bloques nuevos empieza por el minuto y sigue con quién:
| «45+1'56" (táctica 47:48) · Interceptación de Mario Rivas en medio campo…».
| Los bloques viejos son texto libre y no traen ni lo uno ni lo otro: ahí se
| devuelve vacío, y la tabla pone «—».
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

/** «Interceptación», «Duelo ganado»… (sólo en los bloques nuevos). */
function tipoDe(r: Robo) {
  const m = PARTES_DETALLE.exec(r.detalle ?? "");
  return m ? (QUIEN_ROBA.exec(m[2])?.[1] ?? "") : "";
}

/** Quién roba (sólo en los bloques nuevos). */
function jugadorDe(r: Robo) {
  const m = PARTES_DETALLE.exec(r.detalle ?? "");
  return m ? (QUIEN_ROBA.exec(m[2])?.[2] ?? "") : "";
}

const TRAMOS = [0, 15, 30, 45, 60, 75, 90];
const nombreTramo = (ini: number) => `${ini}'-${ini + 15}'`;

/** El tramo de quince minutos de vídeo en que cae el robo. */
const tramoDe = (r: Robo) => nombreTramo(Math.floor(r.seg / 60 / 15) * 15);

/** Cómo se lee cada dimensión pinchable de un robo. */
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

const ROTULO: Record<string, string> = {
  zona: "Zona",
  carril: "Carril",
  accion: "Salida",
  desenlace: "Acaba en",
  confianza: "Fiabilidad",
  tramo: "Tramo",
  jugador: "Jugador",
  tipo: "Robo",
};

/** Lo que se lee en la barra de «Filtrando» para cada valor. */
function nombreValor(dimension: string, valor: string) {
  if (dimension === "accion") return NOMBRE_ACCION[valor as Accion] ?? valor;
  if (dimension === "desenlace")
    return DESENLACES.find((d) => d.clave === valor)?.nombre ?? valor;
  return valor;
}

/**
 * Las series de las gráficas de barras, en acciones. «Otro» son dos: el
 * despeje y la pérdida inmediata, y se marcan y se sueltan juntas.
 */
const ACCIONES_SERIE: Record<string, Accion[]> = {
  Adelante: ["ADELANTE"],
  "Horizontal o atrás": ["HORIZONTAL_ATRAS"],
  Otro: ["DESPEJE", "PERDIDA"],
};

/** ¿Está marcada la serie entera? */
const serieActiva = (filtros: Filtros, serie: string) =>
  (ACCIONES_SERIE[serie] ?? []).length > 0 &&
  (ACCIONES_SERIE[serie] ?? []).every((a) => estaActivo(filtros, "accion", a));

const HAY_PRETEMPORADA = PARTIDOS.some((p) => esPretemporada(p.jornada));

/* ------------------------------------------------------------------ */
/*  Piezas sueltas                                                     */
/* ------------------------------------------------------------------ */

function Cifra({
  valor,
  rotulo,
  pie,
  color = ORO,
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

export default function TransicionesPage() {
  const explicativos = useTextosExplicativos();
  const [quien, setQuien] = useState<string>("todos");
  const [porcentajes, setPorcentajes] = useState(false);
  const [conDudosos, setConDudosos] = useState(true);
  /*
  | La pretemporada, fuera salvo que se pida: los amistosos no se leen igual
  | que la liga. Hoy no hay ninguno en los datos y el mando ni sale.
  */
  const [conPretemporada, setConPretemporada] = useState(false);

  /** Lo que se ha pinchado en gráficas, cifras y tabla. */
  const { filtros, alterna, alternaVarios, quita, limpia } = useFiltrosCruzados();

  const partidos = useMemo(
    () =>
      PARTIDOS.filter(
        (p) =>
          (p.robos.length > 0 || p.bloquesCerrados > 0) &&
          (conPretemporada || !esPretemporada(p.jornada)),
      ),
    [conPretemporada],
  );

  const elegidos = useMemo(
    () => (quien === "todos" ? partidos : partidos.filter((p) => p.id === quien)),
    [partidos, quien],
  );

  /** Pinchar un partido en la tabla: se queda con él, o vuelve a todos. */
  const alternaPartido = (id: string) => setQuien((antes) => (antes === id ? "todos" : id));

  /*
  | Cuál se va a actualizar: el que se esté mirando, o el último.
  |
  | `partidos` se queda con los que tienen algo etiquetado, así que para el
  | panel se mira la lista ENTERA: el partido que se acaba de dar de alta y
  | todavía no tiene ni un robo es justo el que hay que preparar.
  */
  const paraActualizar = useMemo(
    () =>
      quien === "todos"
        ? PARTIDOS[PARTIDOS.length - 1]
        : PARTIDOS.find((p) => p.id === quien),
    [quien],
  );

  /** Los robos de los partidos elegidos, antes de lo pinchado. */
  const base = useMemo<RoboVisto[]>(() => {
    const todos = elegidos.flatMap((p) =>
      p.robos.map((r) => ({ ...r, partido: p.id, jornada: p.jornada, rival: p.rival })),
    );
    return conDudosos ? todos : todos.filter((r) => r.confianza !== "baja");
  }, [elegidos, conDudosos]);

  /*
  | Con todo lo pinchado menos `excepto`. Cada gráfica se pinta sin su propio
  | filtro: la de zonas sigue enseñando las tres con la elegida marcada.
  */
  const filtrados = (excepto: string[] = []) =>
    base.filter((r) => pasaFiltros(r, filtros, LECTORES, excepto));

  /** Los robos que se están contando ahora mismo, ya filtrados. */
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
            valor: `${partidoElegido.jornada} · ${partidoElegido.rival}`,
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
    /*
    | Los minutos vistos NO son los bloques cerrados por cinco: un bloque puede
    | quedarse a medias, y entonces sus robos cuentan pero sus minutos no del
    | todo. Por eso el generador apunta los segundos revisados de verdad.
    */
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
  const porAccion = (Object.keys(COLOR_ACCION) as Accion[])
    .map((a) => ({
      clave: a,
      nombre: NOMBRE_ACCION[a],
      valor: paraAccion.filter((r) => r.accion === a).length,
      color: COLOR_ACCION[a],
    }))
    .filter((d) => d.valor > 0);

  /** Los que sí llegan a pase o conducción: la comparación que importa. */
  const jugados = useMemo(
    () => robos.filter((r) => r.accion === "ADELANTE" || r.accion === "HORIZONTAL_ATRAS"),
    [robos],
  );
  const adelante = jugados.filter((r) => r.accion === "ADELANTE").length;

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
      Adelante: porcentajes ? Math.round((ade / sobre) * 100) : ade,
      "Horizontal o atrás": porcentajes ? Math.round((hor / sobre) * 100) : hor,
      Otro: porcentajes ? Math.round((otro / sobre) * 100) : otro,
    };
  });

  /* --- por carril (sin su propio filtro) --- */
  const paraCarril = filtrados(["carril"]);
  const porCarril = CARRILES.map((c) => {
    const dentro = paraCarril.filter((r) => r.carril === c);
    return {
      clave: c,
      carril: c[0].toUpperCase() + c.slice(1),
      Robos: dentro.length,
      Adelante: dentro.filter((r) => r.accion === "ADELANTE").length,
    };
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

  /* --- cuándo robamos (sin su propio filtro) --- */
  const paraTramo = filtrados(["tramo"]);
  const porTramo = TRAMOS.map((ini) => {
    const dentro = paraTramo.filter((r) => tramoDe(r) === nombreTramo(ini));
    return {
      clave: nombreTramo(ini),
      tramo: nombreTramo(ini),
      Robos: dentro.length,
      Adelante: dentro.filter((r) => r.accion === "ADELANTE").length,
    };
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

  /** Lo que dicen los robos que se están viendo (partido y filtro), en pocas frases. */
  const conclusiones = useMemo(() => {
    const total = robos.length;

    if (total === 0) return [];

    const frases: string[] = [];

    const partidosVistos = new Set(robos.map((r) => r.partido)).size;

    /* Con algo pinchado, la primera frase lo dice: si no, parece el total. */
    const conFiltro = Object.keys(filtros).length > 0 ? " con este filtro" : "";

    frases.push(
      partidosVistos > 1
        ? `${total} robos en ${partidosVistos} partidos${conFiltro}.`
        : `${total} ${total === 1 ? "robo" : "robos"} en el partido${conFiltro}.`,
    );

    const salen = robos.filter(
      (r) => r.accion === "ADELANTE" || r.accion === "HORIZONTAL_ATRAS",
    );
    const haciaDelante = salen.filter((r) => r.accion === "ADELANTE").length;

    if (salen.length) {
      frases.push(`El ${pct(haciaDelante, salen.length)} % sale hacia delante tras robar.`);
    }

    const zonas = ZONAS.map((z) => {
      const dentro = robos.filter((r) => zonaDe(r) === z);
      return {
        zona: z,
        total: dentro.length,
        adelante: dentro.filter((r) => r.accion === "ADELANTE").length,
      };
    }).sort((a, b) => b.total - a.total);

    const top = zonas[0];

    if (top && top.total > 0) {
      frases.push(
        `Más robos en ${top.zona} (${pct(top.total, total)} %); ${pct(top.adelante, top.total)} % salen adelante.`,
      );
    }

    const seguidas = robos.filter((r) => r.desenlace);

    if (seguidas.length) {
      const llegan = seguidas.filter(
        (r) => r.desenlace === "REMATE" || r.desenlace === "AREA",
      ).length;
      const perdidas = seguidas.filter((r) => r.desenlace === "PERDIDA").length;

      frases.push(
        `${pct(llegan, seguidas.length)} % acaba en remate o área; ${pct(perdidas, seguidas.length)} % en pérdida.`,
      );

      const tiempos = seguidas
        .map((r) => r.duracion)
        .filter((d): d is number => typeof d === "number");

      if (tiempos.length) {
        frases.push(
          `La transición dura ${decimal(tiempos.reduce((a, b) => a + b, 0) / tiempos.length)} s de media.`,
        );
      }
    }

    return frases;
  }, [robos, filtros]);

  return (
    <main className="min-h-screen bg-[#0B0F14] text-white">
      <div className="flex">
        <Sidebar />

        <section className="flex min-w-0 flex-1 flex-col">
          <Topbar />

          <div className="min-w-0 px-4 py-6 sm:px-6 lg:px-10">
            <AbpHeader
              area="RMCF Castilla · Competición"
              title="Robos y transiciones"
            />

            {/* ---------------- mandos ---------------- */}

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setQuien("todos")}
                className={`rounded-xl border px-3 py-2 text-sm transition ${
                  quien === "todos"
                    ? "border-[#C8A96B]/40 bg-[#C8A96B]/15 text-[#C8A96B]"
                    : "border-white/10 bg-white/[0.03] text-white/70 hover:border-white/20"
                }`}
              >
                Todos los partidos
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
                  {p.jornada} · {p.local ? "" : "en "}
                  {p.rival}
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

              <button
                type="button"
                onClick={() => setConDudosos((v) => !v)}
                title={
                  explicativos
                    ? "Los robos marcados con confianza baja son los que el etiquetado no puede defender fotograma a fotograma"
                    : undefined
                }
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/70 transition hover:border-white/20"
              >
                <Eye size={14} />
                {conDudosos ? "Quitar los dudosos" : "Incluir los dudosos"}
              </button>

              {/*
                Cuánto partido lleva revisado. No es adorno: mientras falten
                bloques, los totales son de esos minutos y no del partido, y
                quien mire la pantalla tiene que poder verlo sin preguntar.
              */}
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
            </div>

            <BarraFiltros
              chips={chips}
              onLimpiar={quitaTodo}
              pretemporada={
                HAY_PRETEMPORADA
                  ? { incluida: conPretemporada, onCambiar: setConPretemporada }
                  : undefined
              }
              className="mt-3"
            />

            <Conclusiones items={conclusiones} className="mt-5" />

            {/* ---------------- cifras ---------------- */}

            <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Cifra
                valor={String(robos.length)}
                rotulo="Robos"
                pie={`en ${cobertura.minutosVistos} min revisados`}
                icono={Crosshair}
              />

              <Cifra
                valor={`${pct(adelante, jugados.length)}%`}
                rotulo="Salen hacia delante"
                pie={`${adelante} de ${jugados.length} con pase o conducción`}
                color={COLOR_ACCION.ADELANTE}
                icono={ArrowUp}
                onClick={() => alterna("accion", "ADELANTE")}
                activo={estaActivo(filtros, "accion", "ADELANTE")}
                atenuado={hayFiltro(filtros, "accion")}
              />

              <Cifra
                valor={`${pct(jugados.length - adelante, jugados.length)}%`}
                rotulo="Horizontal o atrás"
                pie={`${jugados.length - adelante} de ${jugados.length}`}
                color={COLOR_ACCION.HORIZONTAL_ATRAS}
                icono={ArrowLeftRight}
                onClick={() => alterna("accion", "HORIZONTAL_ATRAS")}
                activo={estaActivo(filtros, "accion", "HORIZONTAL_ATRAS")}
                atenuado={hayFiltro(filtros, "accion")}
              />

              <Cifra
                valor={`${duracionMedia} s`}
                rotulo="Dura la transición"
                pie={
                  conDesenlace.length
                    ? `${llegadas} de ${conDesenlace.length} llegan al área o al remate`
                    : "sin datos de desenlace todavía"
                }
                icono={Timer}
              />
            </div>

            {/* ---------------- qué hacemos con el balón ---------------- */}

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <Panel
                title="Qué hacemos con el balón robado"
                subtitle={explicativos ? "Lo primero que pasa después del robo" : undefined}
                icon={Target}
              >
                {paraAccion.length === 0 ? (
                  <p className="text-sm text-white/45">
                    {base.length === 0
                      ? "Todavía no hay robos etiquetados."
                      : "Ningún robo con este filtro."}
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

                        {/* La leyenda de la tarta son las acciones: se pincha igual. */}
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
                title="Dónde robamos y cómo salimos"
                subtitle={
                  porcentajes
                    ? "Reparto dentro de cada zona"
                    : "Robos por zona del campo"
                }
                icon={MapIcon}
                analisis={
                  explicativos && robos.length > 3 ? (
                    <p className="mx-4 mb-4 border-l-2 border-[#C8A96B]/40 pl-3 text-[12px] leading-relaxed text-white/60 sm:mx-5">
                      Lo que hay que mirar aquí es el contraste entre la barra de campo
                      rival y la de campo propio: cuanto más arriba se roba, más se sale
                      hacia delante.
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

                      {/*
                        Cada trozo se pincha y filtra por su zona Y su salida;
                        la leyenda, sólo por la salida.
                      */}
                      {(
                        [
                          { serie: "Adelante", color: COLOR_ACCION.ADELANTE, radio: [0, 0, 0, 0] },
                          {
                            serie: "Horizontal o atrás",
                            color: COLOR_ACCION.HORIZONTAL_ATRAS,
                            radio: [0, 0, 0, 0],
                          },
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
                            if (z) alternaSegmento(z.clave, serie);
                          }}
                        >
                          {porZona.map((z) => (
                            <Cell
                              key={z.clave}
                              fill={color}
                              {...marcaSvg(segmentoActivo(z.clave, serie), hayZonaOSalida)}
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
                title="En qué acaba la transición"
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
                          width={120}
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
                title="Cuándo robamos"
                subtitle={explicativos ? "Por tramos de quince minutos de vídeo" : undefined}
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
                          { serie: "Robos", color: ACERO },
                          { serie: "Adelante", color: COLOR_ACCION.ADELANTE },
                        ] as const
                      ).map(({ serie, color }) => (
                        <Bar
                          key={serie}
                          dataKey={serie}
                          fill={color}
                          radius={[8, 8, 0, 0]}
                          onClick={(_, i) => {
                            const t = porTramo[i];
                            if (t) alterna("tramo", t.clave);
                          }}
                        >
                          {porTramo.map((t) => (
                            <Cell
                              key={t.clave}
                              fill={color}
                              {...marcaSvg(
                                estaActivo(filtros, "tramo", t.clave),
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

            {porCarril.some((c) => c.Robos > 0) && (
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
                            { serie: "Robos", color: ACERO },
                            { serie: "Adelante", color: COLOR_ACCION.ADELANTE },
                          ] as const
                        ).map(({ serie, color }) => (
                          <Bar
                            key={serie}
                            dataKey={serie}
                            fill={color}
                            radius={[8, 8, 0, 0]}
                            onClick={(_, i) => {
                              const c = porCarril[i];
                              if (c) alterna("carril", c.clave);
                            }}
                          >
                            {porCarril.map((c) => (
                              <Cell
                                key={c.clave}
                                fill={color}
                                {...marcaSvg(
                                  estaActivo(filtros, "carril", c.clave),
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

            {/* ---------------- listado ---------------- */}

            <div className="mt-4">
              <Panel
                title="Robo a robo"
                subtitle={
                  explicativos
                    ? "«Min.» es el del partido (y el de la táctica); «Vídeo», el del archivo, para ir directo a la jugada. Pincha un valor y filtra la pantalla"
                    : undefined
                }
                icon={Crosshair}
                bodyClassName="p-0"
              >
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[860px] text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-[0.12em] text-white/40">
                        {/* El minuto del partido va siempre, sin depender de los textos. */}
                        <th className="px-4 py-3">Min.</th>
                        <th className="px-4 py-3">Vídeo</th>
                        {quien === "todos" && <th className="px-4 py-3">Partido</th>}
                        <th className="px-4 py-3">Robo</th>
                        <th className="px-4 py-3">Zona</th>
                        <th className="px-4 py-3">Carril</th>
                        <th className="px-4 py-3">Salida</th>
                        <th className="px-4 py-3">Acaba en</th>
                        <th className="px-4 py-3">Fiabilidad</th>
                        {/* Lo que pasó en cada robo: sólo con los textos explicativos encendidos. */}
                        {explicativos && <th className="px-4 py-3">Qué pasó</th>}
                      </tr>
                    </thead>

                    <tbody>
                      {robos.map((r) => (
                        <tr
                          key={`${r.partido}-${r.seg}`}
                          className="border-b border-white/5 align-top hover:bg-white/[0.02]"
                        >
                          <td className="whitespace-nowrap px-4 py-3 font-semibold tabular-nums text-white/80">
                            {minutoDe(r) || "—"}
                          </td>

                          <td className="whitespace-nowrap px-4 py-3 tabular-nums text-white/45">
                            {reloj(r.seg)}
                          </td>

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
                                background: `${COLOR_ACCION[r.accion]}22`,
                                color: COLOR_ACCION[r.accion],
                                ...(estaActivo(filtros, "accion", r.accion)
                                  ? marcaPieza(true, true)
                                  : {}),
                              }}
                            >
                              {NOMBRE_ACCION[r.accion]}
                            </button>
                          </td>

                          <td className="whitespace-nowrap px-4 py-3 text-white/60">
                            {celda(
                              "desenlace",
                              r.desenlace,
                              DESENLACES.find((d) => d.clave === r.desenlace)?.nombre ??
                                r.desenlace,
                            )}
                            {r.duracion ? (
                              <span className="ml-1 text-white/30">· {r.duracion}s</span>
                            ) : null}
                          </td>

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

                          {/* El detalle sin el minuto delante: ya tiene su columna. */}
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
                            colSpan={8 + (quien === "todos" ? 1 : 0) + (explicativos ? 1 : 0)}
                            className="px-4 py-8 text-center text-white/40"
                          >
                            Todavía no hay robos etiquetados con este filtro.
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
                <Panel title="Goles del partido" subtitle="Para situar los robos" icon={Target}>
                  <ul className="space-y-1.5 text-sm text-white/60">
                    {elegidos.flatMap((p) =>
                      p.goles.map((g) => (
                        <li key={`${p.id}-${g.seg}`}>
                          <span className="font-semibold tabular-nums text-white/80">
                            {reloj(g.seg)}
                          </span>{" "}
                          · {g.texto}
                        </li>
                      )),
                    )}
                  </ul>
                </Panel>
              </div>
            )}

            {/* Lo mismo que en faltas: la ruta del vídeo se escribe aquí y
                salen las órdenes hechas, en vez de vivir dentro de un script. */}
            <Explicativo>
              <div className="mt-4">
                <ComoActualizar
                  videoPorDefecto={paraActualizar?.video ?? ""}
                  partidoPorDefecto={paraActualizar?.id ?? ""}
                />
              </div>

              <p className="mt-6 text-xs leading-relaxed text-white/30">
                Cuenta como robo la recuperación activa: entrada, interceptación o balón ganado
                por presión directa, con el balón en juego. No cuentan los rechaces sin disputa,
                los despejes del rival, las paradas del portero, lo que nace de balón parado ni
                los cambios de posesión por falta pitada. El criterio completo está en
                ANALISIS TRANSICIONES/MANUAL_ETIQUETADO.md.
              </p>
            </Explicativo>
          </div>
        </section>
      </div>
    </main>
  );
}
