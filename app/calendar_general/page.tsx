"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  FileText,
  Image as ImageIcon,
  Pencil,
  Plus,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import {
  CalendarShell,
  type CalendarLegendItem,
} from "@/components/ui/calendar-shell";
import {
  CalendarDayModal,
  CalendarEmptyState,
} from "@/components/ui/calendar-day-modal";
import { useRemoteDoc } from "@/hooks/useRemoteDoc";
import {
  MONTHS,
  SEASON_FIRST_DAY,
  SEASON_LAST_DAY,
  buildSeasonMonths,
  currentMonthIndex,
  dateKey,
  formatMinutes,
  parseDateKey,
  recordDateKey,
} from "@/lib/calendar";
import { traeJson } from "@/lib/hojaCsv";
import { esFilaDePartido, fechaIsoDeHoja } from "@/lib/microciclo/cuenta";
import { EnlacesDelRival, enlacesDelRival, useJornadasRivales } from "@/components/rivals/EnlacesDelRival";
import { BotonGolesEnVideo } from "@/components/rivals/BotonGolesEnVideo";
import { enlaceAnalisis, enlaceSesion } from "@/lib/sesion-dia/conexion";
import { diasPlanificados, mdALaVista, mdDelCalendario, mdDelDia } from "@/lib/microciclo/semana-de-hoy";
import { contenidoUnificado } from "@/lib/microciclo/contenidos";
import { useSemanaDeHoy } from "@/hooks/useSemanaDeHoy";
import { nombreCorto } from "@/lib/abp/informe-graficos";
import { buscadorDeEscudos, traeEscudos, type Escudos } from "@/lib/data-analisis/escudos";
import { cn } from "@/lib/utils";
import { mismoEquipo } from "@/lib/data-analisis/nombres";
import { CALENDARIO_CASTILLA_KEY, type PartidoBesoccer } from "@/lib/viaje/calendario";
import { viajeVacio, type ViajeStore } from "@/lib/viaje/modelo";

type EventType =
  | "REUNION"
  | "VIAJE"
  | "LOGISTICA"
  | "MEDICO"
  | "INSTITUCIONAL";

interface GeneralEvent {
  id: string;
  fecha: string;
  tipo: EventType;
  titulo: string;
  descripcion: string;
  responsable: string;
  hora: string;
  lugar: string;
  participantes: string;
}

interface EventsDoc {
  events: GeneralEvent[];
}

/** Lo que ya existe en otras pantallas y aquí sólo se lee: partidos (BeSoccer) y viajes (/desplazamiento). */
type EventoAuto = {
  id: string;
  fecha: string;
  clase: "PARTIDO" | "VIAJE";
  titulo: string;
  detalle: string;
  hora: string;
  enlace: string;
  /** Sólo los partidos: el rival y si es en casa (para el orden de los escudos). */
  rival?: string;
  enCasa?: boolean;
  /** «2-1», nuestro primero; vacío si no se ha jugado. */
  marcador?: string;
  jornada?: number;
};

/** Una fila de la hoja de microciclos: lo poco que hace falta aquí (la misma fuente que /micro_calendar). */
type FilaMicro = {
  Fecha?: string;
  MD?: string;
  Tiempo?: number | string;
  "Intensidad (1-10)"?: number | string;
  "Tipo Tarea"?: string;
  "Contenido Principal"?: string;
  Fase?: string;
};

/** La sesión de un día: su MD, sus minutos y el contenido con más minutos (07/11/2026). */
type SesionDia = {
  md: string;
  minutos: number;
  principal: string;
  porContenido: Record<string, number>;
  /** Minutos por fase (sin Global), para el color del punto (16/11/2026). */
  porFase?: Record<string, number>;
  /** Sólo planificada: de la hoja publicada, aún sin minutos ni copia de lo hecho (16/11/2026). */
  planificado?: boolean;
  /** 17/11/2026 (r20): la carga (UA = minutos × intensidad) de las tareas con las dos cosas, y cuántas son de cuántas. */
  ua?: number;
  conCarga?: number;
  tareas?: number;
};

/*
| EL COLOR DE LA SESIÓN (16/11/2026): la fase con más minutos del día sin
| contar Global, con los mismos colores que /micro_calendar, para que las dos
| lecturas del mes coincidan.
*/
const FASES_COLOR: { re: RegExp; clave: string; label: string; dot: string }[] = [
  { re: /(\bTR\b|TRANSICI).*OFENS|OFENS.*(\bTR\b|TRANSICI)/, clave: "TRO", label: "Transición ofensiva", dot: "bg-sky-400" },
  { re: /(\bTR\b|TRANSICI).*DEFENS|DEFENS.*(\bTR\b|TRANSICI)/, clave: "TRD", label: "Transición defensiva", dot: "bg-orange-400" },
  { re: /ABP/, clave: "ABP", label: "ABP", dot: "bg-violet-400" },
  { re: /GLOBAL/, clave: "GLOBAL", label: "Global", dot: "" },
  { re: /OFENS/, clave: "OF", label: "Ofensiva", dot: "bg-emerald-400" },
  { re: /DEFENS/, clave: "DF", label: "Defensiva", dot: "bg-red-400" },
];

const faseDe = (fase: string) => {
  const v = fase.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();

  return FASES_COLOR.find((f) => f.re.test(v)) ?? null;
};

/** La fase que manda en la sesión (sin Global), o null. */
const faseDominante = (s: SesionDia | undefined) => {
  const top = Object.entries(s?.porFase ?? {}).sort((a, b) => b[1] - a[1])[0];

  return top ? (FASES_COLOR.find((f) => f.clave === top[0]) ?? null) : null;
};

/** «2-0» (el Castilla primero) → «ganado 2-0», «empate 2-2», «perdido 0-1». */
const resultadoConSentido = (marcador: string) => {
  const [a, b] = marcador.split("-").map(Number);

  if (!Number.isFinite(a) || !Number.isFinite(b)) return marcador;

  return `${a > b ? "ganado" : a < b ? "perdido" : "empate"} ${marcador}`;
};

/** «16:15» de los minutos de una cita (pueden pasar de 1440: la vuelta de madrugada). */
const horaDeMinutos = (m: number) => {
  const d = ((Math.round(m) % 1440) + 1440) % 1440;

  return `${String(Math.floor(d / 60)).padStart(2, "0")}:${String(d % 60).padStart(2, "0")}`;
};

/**
 * Una cita del viaje con su nombre y su hora (16/11/2026, jueces): «salida»
 * sólo cuando lo es. Salía «Viaje a Majadahonda · salida 14:30» y en
 * /desplazamiento las 14:30 eran la «Llegada estadio».
 */
const horaDeCita = (c: { minuto: number; texto?: string }) => {
  const texto = (c.texto ?? "").trim();
  const hora = horaDeMinutos(c.minuto);

  if (!texto || /^salida\b/i.test(texto)) return `salida ${hora}`;

  return `${texto.charAt(0).toLowerCase()}${texto.slice(1)} ${hora}`;
};

/** Nombre con el que sale el Castilla en la lista de escudos de BeSoccer. */
const NOSOTROS = "RM Castilla";

/** Escudo pequeño; sin imagen, las iniciales. */
function EscudoMini({ url, nombre }: { url: string | null; nombre: string }) {
  const [roto, setRoto] = useState(false);

  if (url && !roto) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- escudo pequeño por el proxy propio
      <img src={url} alt={nombre} title={nombre} onError={() => setRoto(true)} className="h-4 w-4 shrink-0 object-contain md:h-5 md:w-5" />
    );
  }

  const iniciales = nombre
    .replace(/[^\p{L}\s]/gu, " ")
    .split(/\s+/)
    .filter((p) => p.length > 2)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

  return (
    <span title={nombre} className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 text-[10px] font-bold text-white/70 md:h-5 md:w-5">
      {iniciales || "C"}
    </span>
  );
}

const AUTO_THEMES: Record<EventoAuto["clase"], { label: string; stripe: string; dot: string }> = {
  PARTIDO: { label: "Partido", stripe: "border-l-[#C8A96B]", dot: "bg-[#C8A96B]" },
  VIAJE: { label: "Viaje", stripe: "border-l-purple-400", dot: "bg-purple-400" },
};

/** Documento del Área General, fechado en su día de subida por la API. */
type DayFile = {
  url: string;
  name: string;
  created_at: string;
  type: "image" | "pdf";
  /** Día del calendario: el de la subida ("YYYY-MM-DD"). */
  date?: string;
  /** Semana del Área General a la que pertenece ("" si es un archivo suelto). */
  week?: string;
  weekRange?: string;
  month?: string;
};

type FilesByDay = Record<string, { images: DayFile[]; pdfs: DayFile[] }>;

const TYPE_THEMES: Record<
  EventType,
  { label: string; dot: string; stripe: string }
> = {
  REUNION: { label: "Reunión", dot: "bg-sky-400", stripe: "border-l-sky-400" },
  VIAJE: { label: "Viaje", dot: "bg-purple-400", stripe: "border-l-purple-400" },
  LOGISTICA: {
    label: "Logística",
    dot: "bg-yellow-400",
    stripe: "border-l-yellow-400",
  },
  MEDICO: {
    label: "Médico",
    dot: "bg-emerald-400",
    stripe: "border-l-emerald-400",
  },
  INSTITUCIONAL: {
    label: "Institucional",
    dot: "bg-red-400",
    stripe: "border-l-red-400",
  },
};

const EVENT_TYPES = Object.keys(TYPE_THEMES) as EventType[];

const EMPTY_FILES = { images: [] as DayFile[], pdfs: [] as DayFile[] };
const EMPTY_DOC: EventsDoc = { events: [] };

const MAX_VISIBLE_PER_DAY = 3;

/** Lo que se espera a una lectura antes de decir que no llega y ofrecer reintentar. */
const TIEMPO_LIMITE_MS = 15_000;

let idCounter = 0;
function newEventId() {
  idCounter += 1;
  return `ev-${Date.now().toString(36)}-${idCounter.toString(36)}`;
}

export default function CalendarGeneralPage() {
  const months = useMemo(() => buildSeasonMonths(), []);

  const {
    value,
    setValue,
    status,
    localOnly,
    reload: recargaDoc,
  } = useRemoteDoc<EventsDoc>({
    key: "general-calendar:events",
    kind: "general-calendar",
    fallback: EMPTY_DOC,
    debounce: 400,
  });

  const events = useMemo(() => value?.events ?? [], [value]);

  const [currentMonth, setCurrentMonth] = useState(() =>
    currentMonthIndex(months)
  );
  const [filesByDay, setFilesByDay] = useState<FilesByDay>({});
  const [autoEventos, setAutoEventos] = useState<EventoAuto[]>([]);
  const [proximo, setProximo] = useState<{ jornada: number; rival: string; enCasa: boolean; fecha: string; hora: string; salida: string } | null>(null);

  /*
  | LAS SESIONES DEL DÍA (30/10/2026). El mes eran siete etiquetas en 35
  | casillas vacías: ahora cada día dice su MD y sus minutos, de la misma hoja
  | que /micro_calendar, y los días sin sesión entre la primera y la última son
  | «Libre». Sólo lectura (GET con la caché de hojas). Si no llega, el mes se
  | queda con partidos, viajes y eventos: no se dice nada de lo que no hay.
  */
  const [sesionesHechas, setSesionesDia] = useState<Map<string, SesionDia>>(() => new Map());

  /*
  | LO PLANIFICADO TAMBIÉN (16/11/2026). La copia del Apps Script sólo trae lo
  | hecho: la semana del micro 22 (13 tareas del 16 al 19/11) salía vacía. Los
  | días que no trae se completan con la hoja publicada, la fuente común de las
  | cuatro pantallas de planificación, y se pintan en discontinuo. Las fechas
  | de partido para el MD salen de ahí también (misma regla que el creador).
  */
  const { registro, fechasDePartido: fechasPartido } = useSemanaDeHoy();

  /* 16/11/2026 (jueces): la hoja RIVALES, para el Plan de partido con el rival elegido desde la casilla. */
  const jornadasRivales = useJornadasRivales();

  /* Hoy, apuntado fuera del render (el linter no deja mirar el reloj al pintar): para saber qué micro está en curso. */
  const [hoyKey, setHoyKey] = useState("");

  useEffect(() => {
    const id = setTimeout(() => setHoyKey(dateKey(new Date())), 0);

    return () => clearTimeout(id);
  }, []);

  /* 16/11/2026 (jueces): el micro de cada fecha de la hoja, para abrir el día o el partido en Microciclos. */
  const microDeFecha = useMemo(() => {
    const mapa = new Map<string, number>();

    for (const f of registro) {
      const iso = fechaIsoDeHoja(f.fecha);

      if (iso && Number.isInteger(f.micro) && f.micro > 0) mapa.set(iso, f.micro);
    }

    return mapa;
  }, [registro]);

  const sesionesDia = useMemo(() => {
    const mapa = new Map(sesionesHechas);

    diasPlanificados(registro, new Set(mapa.keys())).forEach((filas, key) => {
      const entreno = filas.filter((f) => !esFilaDePartido({ md: f.md, fase: f.fase, tipo: f.tipoTarea, contenidoPrincipal: f.contenidoPrincipal }));

      if (!entreno.length) return;

      const porContenido: Record<string, number> = {};
      const porFase: Record<string, number> = {};

      for (const f of entreno) {
        const contenido = contenidoUnificado((f.contenidoPrincipal || f.tipoTarea || "").trim());
        if (contenido) porContenido[contenido] = (porContenido[contenido] ?? 0) + (f.tiempo || 1);
        const fase = faseDe(f.fase);
        if (fase && fase.clave !== "GLOBAL") porFase[fase.clave] = (porFase[fase.clave] ?? 0) + (f.tiempo || 1);
      }

      mapa.set(key, {
        md: entreno.find((f) => f.md)?.md ?? "",
        minutos: entreno.reduce((s, f) => s + (f.tiempo || 0), 0),
        principal: Object.entries(porContenido).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "",
        porContenido,
        porFase,
        planificado: true,
      });
    });

    return mapa;
  }, [sesionesHechas, registro]);

  useEffect(() => {
    let vivo = true;

    traeJson<unknown>("/api/rivals?action=microciclo")
      .then((data) => {
        if (!vivo || !Array.isArray(data)) return;

        const mapa = new Map<string, SesionDia>();

        for (const fila of data as FilaMicro[]) {
          const key = recordDateKey(fila?.Fecha ?? "");
          if (!key) continue;

          /* El partido ya sale de BeSoccer: la fila de competición no es sesión.
             La misma regla que /micro_calendar y /microcycles (lib/microciclo/cuenta.ts). */
          const md = String(fila.MD ?? "").trim();
          const competicion = esFilaDePartido({ md, fase: fila.Fase, tipo: fila["Tipo Tarea"], contenidoPrincipal: fila["Contenido Principal"] });
          if (competicion) continue;

          const previa = mapa.get(key);
          const minutos = Number(fila.Tiempo) || 0;
          const contenido = contenidoUnificado(String(fila["Contenido Principal"] || fila["Tipo Tarea"] || "").trim());
          const porContenido = { ...(previa?.porContenido ?? {}) };

          if (contenido) porContenido[contenido] = (porContenido[contenido] ?? 0) + minutos;

          const principal = Object.entries(porContenido).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
          const porFase = { ...(previa?.porFase ?? {}) };
          const fase = faseDe(String(fila.Fase ?? ""));

          if (fase && fase.clave !== "GLOBAL") porFase[fase.clave] = (porFase[fase.clave] ?? 0) + (minutos || 1);

          const intensidad = Number(String(fila["Intensidad (1-10)"] ?? "").replace(",", ".")) || 0;
          const carga = minutos > 0 && intensidad > 0 ? minutos * intensidad : 0;

          mapa.set(key, {
            md: previa?.md || md,
            minutos: (previa?.minutos ?? 0) + minutos,
            principal,
            porContenido,
            porFase,
            ua: (previa?.ua ?? 0) + carga,
            conCarga: (previa?.conCarga ?? 0) + (carga > 0 ? 1 : 0),
            tareas: (previa?.tareas ?? 0) + 1,
          });
        }

        setSesionesDia(mapa);
      })
      .catch(() => {
        /* Sin hoja, el mes sigue con lo demás. */
      });

    return () => {
      vivo = false;
    };
  }, []);

  /* Los escudos, los mismos de /micro_calendar y Data Análisis. */
  const [listaEscudos, setListaEscudos] = useState<Escudos>([]);

  useEffect(() => {
    let vivo = true;

    void traeEscudos().then((lista) => {
      if (vivo) setListaEscudos(lista);
    });

    return () => {
      vivo = false;
    };
  }, []);

  const escudoDe = useMemo(() => buscadorDeEscudos(listaEscudos), [listaEscudos]);

  /* El tramo con sesiones apuntadas: dentro, el día sin sesión ni partido es libre. */
  const tramoSesiones = useMemo(() => {
    const dias = [...sesionesDia.keys()].sort();
    return dias.length ? { desde: dias[0], hasta: dias[dias.length - 1] } : null;
  }, [sesionesDia]);

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  /* 16/11/2026: el resumen del mes se pulsa y deja sólo partidos, viajes o entrenos. */
  const [filtro, setFiltro] = useState<null | "partidos" | "viajes" | "entrenos">(null);
  const [editingEvent, setEditingEvent] = useState<GeneralEvent | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  /* Lo dice la ficha de dentro: cerrar el día la desmontaría con lo escrito. */
  const [fichaSucia, setFichaSucia] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [fullscreenImageIndex, setFullscreenImageIndex] = useState<
    number | null
  >(null);

  useEffect(() => {
    let cancelled = false;

    const loadFiles = async () => {
      try {
        const response = await fetch("/api/general-files", {
          cache: "no-store",
        });

        const files: DayFile[] = await response.json();

        if (cancelled || !Array.isArray(files)) return;

        const grouped: FilesByDay = {};

        for (const file of files) {
          // La API ya fecha cada documento por el día en que se subió.
          const day = file.date || dateKey(new Date(file.created_at));

          if (!grouped[day]) grouped[day] = { images: [], pdfs: [] };

          if (file.type === "image") grouped[day].images.push(file);
          else grouped[day].pdfs.push(file);
        }

        setFilesByDay(grouped);
      } catch (error) {
        console.error(error);
      }
    };

    void loadFiles();

    return () => {
      cancelled = true;
    };
  }, []);

  /*
  | Partidos de BeSoccer y viajes ya montados: se leen, no se editan aquí.
  |
  | Con tiempo límite (30/10/2026): sin él, una /api/docs que no contestaba
  | dejaba el mes sin partidos ni franja y sin decir nada. Cada intento lleva
  | su número; «cargando» es que el último intento todavía no ha contestado
  | (así no hay setState síncrono dentro del efecto).
  */
  const [intentoAuto, setIntentoAuto] = useState(0);
  const [autoRespuesta, setAutoRespuesta] = useState<{ intento: number; ok: boolean } | null>(null);
  const autoCargando = autoRespuesta?.intento !== intentoAuto;
  const autoFallo = !autoCargando && autoRespuesta?.ok === false;

  useEffect(() => {
    let vivo = true;
    const corte = new AbortController();
    const reloj = setTimeout(() => corte.abort(), TIEMPO_LIMITE_MS);

    const lee = async <T,>(key: string): Promise<{ ok: boolean; data: T | null }> => {
      try {
        const r = await fetch(`/api/docs?key=${encodeURIComponent(key)}`, { signal: corte.signal });
        if (!r.ok) return { ok: false, data: null };
        const body = (await r.json()) as { data?: T | null };
        return { ok: true, data: body?.data ?? null };
      } catch {
        return { ok: false, data: null };
      }
    };

    void Promise.all([
      lee<{ partidos?: PartidoBesoccer[] }>(CALENDARIO_CASTILLA_KEY),
      lee<ViajeStore>("desplazamientos"),
    ]).then(([leidoCalendario, leidoViajes]) => {
      clearTimeout(reloj);
      if (!vivo) return;

      const calendario = leidoCalendario.data;
      const viajes = leidoViajes.data;

      /* Lo que llegue se pinta; si falta una de las dos, se ofrece reintentar. */
      setAutoRespuesta({ intento: intentoAuto, ok: leidoCalendario.ok && leidoViajes.ok });

      const lista: EventoAuto[] = [];

      for (const p of calendario?.partidos ?? []) {
        const m = typeof p?.cuando === "string" ? p.cuando.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/) : null;
        if (!m) continue;

        const enCasa = /castilla/i.test(p.local);
        const rival = enCasa ? p.visitante : p.local;
        /* 07/11/2026: el jugado dice su resultado (nuestro primero), como la portada. */
        const conGoles = p as PartidoBesoccer & { golesLocal?: number | null; golesVisitante?: number | null };
        const jugado = typeof conGoles.golesLocal === "number" && typeof conGoles.golesVisitante === "number";
        const marcador = jugado
          ? enCasa
            ? `${conGoles.golesLocal}-${conGoles.golesVisitante}`
            : `${conGoles.golesVisitante}-${conGoles.golesLocal}`
          : "";

        lista.push({
          id: `partido-${p.jornada}-${m[1]}`,
          fecha: m[1],
          clase: "PARTIDO",
          titulo: `J${String(p.jornada).padStart(2, "0")} · ${enCasa ? "Castilla vs" : "en"} ${rival}`,
          detalle: enCasa ? "En casa" : "A domicilio",
          hora: m[2] + ":" + m[3] === "00:00" ? "" : `${m[2]}:${m[3]}`,
          enlace: enCasa ? "" : `/desplazamiento?jornada=${p.jornada}`,
          rival,
          enCasa,
          marcador,
          jornada: p.jornada,
        });
      }

      /* Los viajes guardados cuentan todos menos los de casa: Desplazamiento
         guarda "visitante", pero un documento viejo puede traerlo de otra forma. */
      const guardados = Object.values(viajes?.viajes ?? {}).filter((v) => v && v.condicion !== "local");

      /* Los partidos fuera aún por jugar que no tienen viaje guardado salen con la
         víspera propuesta: el calendario operativo tiene que servir antes de montar el viaje. */
      const hoy = dateKey(new Date());

      for (const p of calendario?.partidos ?? []) {
        const m = typeof p?.cuando === "string" ? p.cuando.match(/^(\d{4}-\d{2}-\d{2})T/) : null;
        if (!m || m[1] < hoy || /castilla/i.test(p.local)) continue;

        const rival = p.local;
        const [y, mo, d] = m[1].split("-").map(Number);
        const vispera = dateKey(new Date(y, mo - 1, d - 1));

        const yaGuardado = guardados.some(
          (v) =>
            mismoEquipo(v.rival ?? "", rival) &&
            ((v.dias ?? []).some((dia) => dia.fecha === vispera || dia.fecha === m[1]) ||
              v.fecha === vispera ||
              v.fecha === m[1])
        );

        if (yaGuardado) continue;

        /* 10/11/2026: la salida es la misma que propone Desplazamiento al
           abrir el partido (viajeVacio: la plantilla de dos días), y se dice
           que es propuesta mientras nadie guarde el horario. */
        /*
        | LA MISMA PROPUESTA QUE DESPLAZAMIENTO (16/11/2026, segunda vuelta de
        | los jueces). El calendario pintaba «Viaje a Majadahonda · salida
        | 16:00» el sábado 28 con la plantilla vieja de dos días, mientras
        | /desplazamiento proponía un viaje de un día, el 29, sin hora: sin
        | distancia no se propone hotel ni víspera. Ahora se llama a viajeVacio
        | igual que esa pantalla (`trayecto: null`) y sólo se pinta una salida
        | que tenga hora; si no la tiene, no se nombra.
        */
        const propuesto = viajeVacio(`calendario-${p.jornada}`, {
          rival,
          fecha: m[1],
          hora: p.cuando.slice(11, 16) === "00:00" ? "" : p.cuando.slice(11, 16),
          condicion: "visitante",
          trayecto: null,
        });

        for (const dia of propuesto.dias) {
          const salida = [...(dia.citas ?? [])]
            .filter((c) => c.tipo === "viaje" && Number.isFinite(c.minuto))
            .sort((a, b) => a.minuto - b.minuto)[0];

          if (!salida || !dia.fecha) continue;

          lista.push({
            id: `viaje-propuesto-${p.jornada}-${dia.fecha}`,
            fecha: dia.fecha,
            clase: "VIAJE",
            titulo: dia.fecha === m[1] ? `Viaje a ${rival} (en el día)` : `Viaje a ${rival}`,
            detalle: "Horario propuesto por Desplazamiento, aún sin guardar",
            hora: horaDeCita(salida),
            enlace: `/desplazamiento?jornada=${p.jornada}`,
          });
        }
      }

      for (const viaje of guardados) {

        const fechas = new Set(
          (viaje.dias ?? []).map((d) => d.fecha).filter(Boolean)
        );

        if (fechas.size === 0 && viaje.fecha) fechas.add(viaje.fecha);

        /* El día del partido de este viaje: los días de después son la vuelta, y se rotulan así
           para que no parezca un segundo viaje. Sin partido en el calendario, todo es «Viaje a». */
        const primero = [...fechas].sort()[0] ?? "";
        const delPartido = (calendario?.partidos ?? [])
          .filter((p) => !/castilla/i.test(p.local) && mismoEquipo(p.local, viaje.rival ?? ""))
          .map((p) => (typeof p.cuando === "string" ? p.cuando.slice(0, 10) : ""))
          .filter((f) => f && f >= primero)
          .sort()[0];

        /* La hora del partido, en minutos del día, para partir las citas del día del partido. */
        const horaPartido = (calendario?.partidos ?? [])
          .map((p) => (typeof p.cuando === "string" && p.cuando.slice(0, 10) === delPartido ? p.cuando.slice(11, 16) : ""))
          .find((h) => /^\d{2}:\d{2}$/.test(h) && h !== "00:00");
        const minutoPartido = horaPartido ? Number(horaPartido.slice(0, 2)) * 60 + Number(horaPartido.slice(3, 5)) : null;
        const deDonde = viaje.estadio?.ciudad || viaje.rival;

        for (const fecha of fechas) {
          /* La salida, del horario guardado (07/11/2026): la primera cita de viaje de ese día. */
          const citas = (viaje.dias ?? []).find((d) => d.fecha === fecha)?.citas ?? [];
          /* Sólo citas con hora de verdad: una sin minutos no se pinta (nada de «NaN:NaN»). */
          const deViaje = [...citas].filter((c) => c.tipo === "viaje" && Number.isFinite(c.minuto)).sort((a, b) => a.minuto - b.minuto);
          const salida = deViaje[0];
          const regreso = Boolean(delPartido && fecha > delPartido);
          const detalle = [viaje.estadio?.ciudad, viaje.hotel?.nombre].filter(Boolean).join(" · ");
          const enlace = `/desplazamiento?partido=${encodeURIComponent(viaje.partidoId)}`;

          /*
          | EL DÍA DEL PARTIDO (16/11/2026): el 13/11 decía «Viaje a Gimnàstic ·
          | salida 19:30» con el partido a las 21:15. Ese día no hay ida: hay
          | traslado al estadio (las citas de viaje antes del partido) y vuelta
          | (las de después). Cada una con su nombre y su hora.
          */
          if (delPartido && fecha === delPartido) {
            /* 17/11/2026 (r20, jueces): BeSoccer deja el partido jugado a las 00:00 y la
               vuelta del 13/11 desaparecía; la hora sale entonces de la cita «partido». */
            const corte = minutoPartido ?? citas.find((c) => c.tipo === "partido" && Number.isFinite(c.minuto))?.minuto ?? null;
            const antes = deViaje.filter((c) => corte === null || c.minuto < corte)[0];
            const tras = corte === null ? [] : deViaje.filter((c) => c.minuto > corte);
            const despues = tras[0];
            const llegada = tras.length > 1 ? tras[tras.length - 1] : undefined;

            if (antes) {
              lista.push({ id: `viaje-${viaje.partidoId}-${fecha}-estadio`, fecha, clase: "VIAJE", titulo: "Traslado al estadio", detalle, hora: horaDeCita(antes), enlace });
            }
            if (despues) {
              lista.push({
                id: `viaje-${viaje.partidoId}-${fecha}-vuelta`,
                fecha,
                clase: "VIAJE",
                titulo: `Vuelta de ${deDonde}`,
                detalle,
                /* Todas las citas de la vuelta en la casilla: la salida y la llegada. */
                hora: [horaDeCita(despues), llegada ? horaDeCita(llegada) : ""].filter(Boolean).join(" · "),
                enlace,
              });
            }
            continue;
          }

          lista.push({
            id: `viaje-${viaje.partidoId}-${fecha}`,
            fecha,
            clase: "VIAJE",
            titulo: regreso ? `Vuelta de ${deDonde}` : `Viaje a ${viaje.rival}`,
            detalle,
            hora: salida ? horaDeCita(salida) : "",
            enlace,
          });
        }
      }

      setAutoEventos(lista);

      /* El próximo partido, para la franja de arriba. */
      const siguiente = (calendario?.partidos ?? [])
        .filter((p) => typeof p?.cuando === "string" && p.cuando.slice(0, 10) >= hoy)
        .sort((a, b) => a.cuando.localeCompare(b.cuando))[0];

      if (siguiente) {
        const enCasa = /castilla/i.test(siguiente.local);
        const fecha = siguiente.cuando.slice(0, 10);
        const hora = siguiente.cuando.slice(11, 16);

        setProximo({
          jornada: siguiente.jornada,
          rival: enCasa ? siguiente.visitante : siguiente.local,
          enCasa,
          fecha,
          hora: hora === "00:00" ? "" : hora,
          salida: enCasa
            ? ""
            : lista
                .filter((e) => e.clase === "VIAJE" && e.fecha <= fecha && mismoEquipo(e.titulo.replace(/^(Viaje a|Regreso de) /, ""), siguiente.local))
                .map((e) => e.fecha)
                .sort()[0] ?? "",
        });
      }
    });

    return () => {
      vivo = false;
      clearTimeout(reloj);
      corte.abort();
    };
  }, [intentoAuto]);

  /*
  | Los eventos propios del staff (useRemoteDoc). Ya no tapan el mes mientras
  | llegan (30/10/2026): la rejilla, los partidos y los viajes se pintan desde
  | el principio y aquí sólo se avisa de lo que falta. A los 15 s, aviso con
  | «Reintentar» en vez de un esqueleto eterno.
  */
  const [intentoDoc, setIntentoDoc] = useState(0);
  const [docTardaEn, setDocTardaEn] = useState<number | null>(null);

  useEffect(() => {
    if (status !== "loading") return;
    const reloj = setTimeout(() => setDocTardaEn(intentoDoc), TIEMPO_LIMITE_MS);
    return () => clearTimeout(reloj);
  }, [status, intentoDoc]);

  const docCargando = status === "loading" && docTardaEn !== intentoDoc;
  const docTarda = status === "loading" && docTardaEn === intentoDoc;

  const autoByDay = useMemo(() => {
    const map = new Map<string, EventoAuto[]>();

    autoEventos.forEach((e) => {
      const list = map.get(e.fecha);
      if (list) list.push(e);
      else map.set(e.fecha, [e]);
    });

    return map;
  }, [autoEventos]);

  /* Los días con partido del calendario, para el MD de los días que aún no tienen sesión. */
  const diasDePartido = useMemo(
    () => [...autoByDay.entries()].filter(([, l]) => l.some((a) => a.clase === "PARTIDO")).map(([k]) => k),
    [autoByDay]
  );

  /* Las fechas para el MD: las del calendario (fuente común) o, mientras llegan, las de los partidos pintados. */
  const fechasDelMd = fechasPartido.length ? fechasPartido : diasDePartido;

  const eventsByDay = useMemo(() => {
    const map = new Map<string, GeneralEvent[]>();

    events.forEach((event) => {
      const key = recordDateKey(event.fecha);
      if (!key) return;

      const list = map.get(key);
      if (list) list.push(event);
      else map.set(key, [event]);
    });

    /* En el orden del día, por la hora (19/10/2026): antes salían en el
       orden en que se apuntaron. Los que no tienen hora, al final. */
    map.forEach((list) =>
      list.sort((a, b) =>
        (a.hora?.trim() || "99").localeCompare(b.hora?.trim() || "99", "es", {
          numeric: true,
        })
      )
    );

    return map;
  }, [events]);

  const active = months[currentMonth];

  const monthStats = useMemo(() => {
    const inMonth = (key: string) => {
      const date = parseDateKey(key);
      return (
        date.getMonth() === active.month && date.getFullYear() === active.year
      );
    };

    /*
    | 30/10/2026: «Eventos 7» y «Días con actividad 7» decían lo mismo. Ahora
    | se cuenta cada cosa por su nombre: partidos, viajes (uno por viaje, no
    | por día: la vuelta no es otro), sesiones y lo que apunta el staff.
    */
    let eventos = 0;
    let partidos = 0;
    let jugados = 0;
    const viajes = new Set<string>();
    let sesiones = 0;

    eventsByDay.forEach((list, key) => {
      if (!inMonth(key)) return;
      list.forEach((e) => {
        if (e.tipo === "VIAJE") viajes.add(`staff-${e.id}`);
        else eventos += 1;
      });
    });

    autoByDay.forEach((list, key) => {
      if (!inMonth(key)) return;
      list.forEach((e) => {
        if (e.clase === "PARTIDO") {
          partidos += 1;
          if (e.marcador) jugados += 1;
        }
        /* Un viaje por desplazamiento (16/11/2026): ida, traslado y vuelta llevan el mismo enlace. */
        else viajes.add(e.enlace || e.titulo);
      });
    });

    sesionesDia.forEach((_, key) => {
      if (inMonth(key)) sesiones += 1;
    });

    let imagenes = 0;
    let pdfs = 0;

    Object.entries(filesByDay).forEach(([key, files]) => {
      if (!inMonth(key)) return;
      imagenes += files.images.length;
      pdfs += files.pdfs.length;
    });

    return { eventos, partidos, jugados, viajes: viajes.size, sesiones, imagenes, pdfs };
  }, [eventsByDay, autoByDay, filesByDay, sesionesDia, active]);

  /* Mes en blanco con todo ya leído: se dice con una frase y se ofrece el mes del próximo partido. */
  const mesVacio =
    !autoCargando &&
    !autoFallo &&
    status !== "loading" &&
    monthStats.eventos === 0 &&
    monthStats.partidos === 0 &&
    monthStats.viajes === 0 &&
    monthStats.sesiones === 0 &&
    monthStats.imagenes === 0 &&
    monthStats.pdfs === 0;

  const mesDelProximo = proximo
    ? months.findIndex((m) => {
        const d = parseDateKey(proximo.fecha);
        return m.month === d.getMonth() && m.year === d.getFullYear();
      })
    : -1;

  /* La leyenda, sólo con los tipos que tienen algo en el mes que se mira. */
  const legend = useMemo(() => {
    const enMes = (key: string) => {
      const date = parseDateKey(key);
      return date.getMonth() === active.month && date.getFullYear() === active.year;
    };

    const tipos = new Set<EventType>();
    eventsByDay.forEach((list, key) => {
      if (enMes(key)) list.forEach((e) => tipos.add(e.tipo));
    });

    const claseAuto = new Set<EventoAuto["clase"]>();
    autoByDay.forEach((list, key) => {
      if (enMes(key)) list.forEach((e) => claseAuto.add(e.clase));
    });

    const items: CalendarLegendItem[] = [];
    (Object.keys(AUTO_THEMES) as EventoAuto["clase"][]).forEach((clase) => {
      /* El viaje ya está entre los tipos de evento con el mismo color y rótulo. */
      if (claseAuto.has(clase) && !(clase === "VIAJE" && tipos.has("VIAJE"))) {
        items.push({ label: AUTO_THEMES[clase].label, color: AUTO_THEMES[clase].dot });
      }
    });
    EVENT_TYPES.forEach((type) => {
      if (tipos.has(type)) items.push({ label: TYPE_THEMES[type].label, color: TYPE_THEMES[type].dot });
    });

    /* 07/11/2026: la sesión también tiene su entrada en la leyenda. */
    /* 16/11/2026: la sesión con el color de la fase que manda, como /micro_calendar. */
    const fasesMes = new Set<string>();
    sesionesDia.forEach((s, key) => {
      const f = enMes(key) ? faseDominante(s) : null;
      if (f) fasesMes.add(f.clave);
    });
    if ([...sesionesDia.keys()].some(enMes)) {
      items.push({ label: "Fase con más minutos (sin Global):", color: "hidden" });
      FASES_COLOR.filter((f) => f.dot && fasesMes.has(f.clave)).forEach((f) => items.push({ label: f.label, color: f.dot }));
      items.push({ label: "MD-n = días hasta el partido · discontinuo = aún sin sesión", color: "hidden" });
    }

    return items;
  }, [eventsByDay, autoByDay, sesionesDia, active]);

  const selectedDate = selectedKey ? parseDateKey(selectedKey) : null;
  const selectedEvents = selectedKey ? eventsByDay.get(selectedKey) ?? [] : [];
  const selectedFiles = selectedKey
    ? filesByDay[selectedKey] ?? EMPTY_FILES
    : EMPTY_FILES;

  const selectedAuto = selectedKey ? autoByDay.get(selectedKey) ?? [] : [];

  const selectedFilesCount =
    selectedFiles.images.length + selectedFiles.pdfs.length;

  const closeModal = useCallback(() => {
    setSelectedKey(null);
    setIsCreating(false);
    setEditingEvent(null);
    setDeletingId(null);
    setFullscreenImageIndex(null);
  }, []);

  const openDay = useCallback((key: string) => {
    setSelectedKey(key);
    setIsCreating(false);
    setEditingEvent(null);
    setDeletingId(null);
  }, []);

  const shiftSelectedDay = useCallback(
    (offset: number) => {
      if (!selectedKey) return;

      const date = parseDateKey(selectedKey);
      date.setDate(date.getDate() + offset);

      if (date < SEASON_FIRST_DAY || date > SEASON_LAST_DAY) return;

      /* Si hay una ficha a medio rellenar, ya pregunta la ventana del día
         antes de llamar aquí (components/ui/calendar-day-modal.tsx). */

      const monthIdx = months.findIndex(
        (m) => m.month === date.getMonth() && m.year === date.getFullYear()
      );

      if (monthIdx !== -1) setCurrentMonth(monthIdx);
      openDay(dateKey(date));
    },
    [selectedKey, months, openDay]
  );

  const canShift = (offset: number) => {
    if (!selectedKey) return false;

    const date = parseDateKey(selectedKey);
    date.setDate(date.getDate() + offset);

    return date >= SEASON_FIRST_DAY && date <= SEASON_LAST_DAY;
  };

  const saveEvent = (event: GeneralEvent) =>
    setValue((current) => {
      const list = current?.events ?? [];

      const exists = list.some((item) => item.id === event.id);

      return {
        events: exists
          ? list.map((item) => (item.id === event.id ? event : item))
          : [...list, event],
      };
    });

  const deleteEvent = (id: string) =>
    setValue((current) => ({
      events: (current?.events ?? []).filter((item) => item.id !== id),
    }));

  /* «4 partidos · 2 viajes · 8 entrenos»: lo que antes eran las tarjetas del mes.
     11/11/2026: cada cifra con su base: cuántos partidos se han jugado ya y que
     los entrenos son los apuntados en la hoja de microciclos. */
  const basePartidos =
    monthStats.partidos > 0 && monthStats.jugados > 0 && monthStats.jugados < monthStats.partidos
      ? ` (${monthStats.jugados} ${monthStats.jugados === 1 ? "jugado" : "jugados"})`
      : "";
  const resumenPiezas = (
    [
      [monthStats.partidos, "partido", "partidos", basePartidos, "partidos"],
      [monthStats.viajes, "viaje", "viajes", "", "viajes"],
      [monthStats.sesiones, "entreno en la hoja", "entrenos en la hoja", "", "entrenos"],
      [monthStats.eventos, "evento del staff", "eventos del staff", "", null],
      [monthStats.imagenes, "imagen", "imágenes", "", null],
      [monthStats.pdfs, "PDF", "PDF", "", null],
    ] as [number, string, string, string, "partidos" | "viajes" | "entrenos" | null][]
  )
    .filter(([n]) => n > 0)
    .map(([n, uno, varios, base, clave]) => ({ texto: `${n} ${n === 1 ? uno : varios}${base}`, clave }));
  const resumenMes = resumenPiezas.map((p) => p.texto).join(" · ");
  /* 17/11/2026 (r20, jueces): «4 partidos (2 jugados)» dice cuáles y lleva a su informe. */
  const jugadosDelMes = [...autoByDay.entries()]
    .filter(([key]) => {
      const d = parseDateKey(key);

      return d.getMonth() === active.month && d.getFullYear() === active.year;
    })
    .flatMap(([, l]) => l.filter((a) => a.clase === "PARTIDO" && a.marcador && a.rival))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));

  return (
    <CalendarShell
      eyebrow="RMCF CASTILLA · OPERATIVA"
      title="Calendario de Operativa General"
      months={months}
      monthIndex={currentMonth}
      onMonthChange={setCurrentMonth}
      keyboardEnabled={!selectedKey}
      legend={legend}
      franja={
        <div className="space-y-2">
        {/* 10/11/2026: el próximo partido y la cuenta del mes en una sola línea (antes, tres tarjetas aparte). */}
        <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
        {proximo ? (
          <Link
            href={proximo.enCasa ? "/calendar" : `/desplazamiento?jornada=${proximo.jornada}`}
            className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-[#C8A96B]/30 bg-[#C8A96B]/[0.06] px-4 py-3 text-sm transition hover:border-[#C8A96B]/60"
          >
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#C8A96B]">Próximo partido</span>
            {/* 10/11/2026: el mismo nombre corto que las casillas («Nàstic»); el completo, al pasar. */}
            <span className="min-w-0 font-semibold text-white" title={proximo.rival}>
              J{String(proximo.jornada).padStart(2, "0")} · {proximo.enCasa ? "vs" : "en"} {nombreCorto(proximo.rival)}
            </span>
            <span className="text-white/70">
              {new Date(`${proximo.fecha}T12:00:00`).toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" })}
              {proximo.hora ? `, ${proximo.hora}` : ""}
            </span>
            {proximo.salida ? (
              <span className="text-white/55">
                · viaje desde el {new Date(`${proximo.salida}T12:00:00`).toLocaleDateString("es-ES", { weekday: "short", day: "numeric" })}
              </span>
            ) : null}
          </Link>
        ) : autoCargando ? (
          /* El hueco de la franja mientras llegan los partidos: la misma forma, sin texto suelto. */
          <div
            aria-label="Leyendo el próximo partido"
            className="flex h-[46px] items-center gap-3 rounded-2xl border border-white/10 px-4"
          >
            <span className="h-2.5 w-24 animate-pulse rounded-full bg-white/10" />
            <span className="h-3 w-52 max-w-[40%] animate-pulse rounded-full bg-white/10" />
            <span className="h-3 w-20 animate-pulse rounded-full bg-white/[0.07]" />
          </div>
        ) : null}
        {resumenMes && (
          /* 16/11/2026: cada cifra del resumen filtra el mes; otra vez, lo quita. */
          <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-sm text-white/70">
            {resumenPiezas.map((p) =>
              p.clave ? (
                <button
                  key={p.texto}
                  type="button"
                  aria-pressed={filtro === p.clave}
                  onClick={() => setFiltro((f) => (f === p.clave ? null : p.clave))}
                  title={filtro === p.clave ? "Quitar el filtro" : `Ver sólo ${p.clave} en el mes`}
                  className={cn(
                    "rounded-full border px-2.5 py-1 font-semibold transition",
                    filtro === p.clave ? "border-[#C8A96B] bg-[#C8A96B]/15 text-[#C8A96B]" : "border-white/15 text-white hover:border-[#C8A96B]/50",
                  )}
                >
                  {p.texto}
                </button>
              ) : (
                <span key={p.texto} className="px-1 font-semibold text-white">{p.texto}</span>
              ),
            )}
            <span>en {MONTHS[active.month].toLowerCase()}</span>
            {jugadosDelMes.length > 0 ? (
              <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                <span className="text-white/55">Jugados:</span>
                {jugadosDelMes.map((p) => (
                  <Link
                    key={p.id}
                    href={microDeFecha.get(p.fecha) ? `/microcycles?micro=${microDeFecha.get(p.fecha)}` : "/microcycles"}
                    title={`El informe de ${p.titulo}`}
                    className="font-semibold text-sky-300 underline-offset-2 hover:underline"
                  >
                    {p.jornada ? `J${String(p.jornada).padStart(2, "0")} ` : ""}
                    {p.enCasa ? "vs" : "en"} {nombreCorto(p.rival ?? "")} {p.marcador ? resultadoConSentido(p.marcador) : ""} →
                  </Link>
                ))}
              </span>
            ) : null}
            {filtro ? (
              <button type="button" onClick={() => setFiltro(null)} className="text-xs font-semibold text-[#C8A96B] underline-offset-2 hover:underline">
                Ver todo
              </button>
            ) : null}
          </div>
        )}
        </div>

        {docCargando && (
          <p className="flex items-center gap-2 text-xs text-white/55">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#C8A96B]" />
            Leyendo los eventos del staff; partidos y viajes ya están en el mes.
          </p>
        )}

        {(autoFallo || docTarda) && (
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-amber-400/30 bg-amber-400/5 px-4 py-3 text-sm text-amber-200/90">
            <TriangleAlert size={16} className="shrink-0" />
            <span className="min-w-0 flex-1">
              {autoFallo && docTarda
                ? "No han llegado ni los partidos y viajes ni los eventos del staff."
                : autoFallo
                  ? "No han llegado los partidos de BeSoccer ni los viajes guardados."
                  : "Los eventos del staff están tardando más de la cuenta."}
            </span>
            <button
              type="button"
              onClick={() => {
                if (autoFallo) setIntentoAuto((n) => n + 1);
                if (docTarda) {
                  setIntentoDoc((n) => n + 1);
                  recargaDoc();
                }
              }}
              className="rounded-lg border border-amber-400/50 px-3 py-1.5 text-xs font-semibold transition hover:bg-amber-400/10"
            >
              Reintentar
            </button>
          </div>
        )}

        {/* En el móvil la lista del mes ya dice que no hay nada: la frase sólo sale allí si trae el salto. */}
        {mesVacio && (
          <div className={cn(
            "min-w-0 flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/70",
            mesDelProximo !== -1 && mesDelProximo !== currentMonth ? "flex" : "hidden sm:flex"
          )}>
            <span className="min-w-0 flex-1">
              Nada programado en {MONTHS[active.month].toLowerCase()}.
            </span>
            {mesDelProximo !== -1 && mesDelProximo !== currentMonth && (
              <button
                type="button"
                onClick={() => setCurrentMonth(mesDelProximo)}
                className="rounded-lg border border-[#C8A96B]/50 px-3 py-1.5 text-xs font-semibold text-[#C8A96B] transition hover:bg-[#C8A96B]/10"
              >
                Ir a {MONTHS[months[mesDelProximo].month].toLowerCase()}, mes del próximo partido
              </button>
            )}
          </div>
        )}
        </div>
      }
      renderDay={({ key }) => {
        const dayEvents = eventsByDay.get(key) ?? [];
        const dayFiles = filesByDay[key] ?? EMPTY_FILES;
        const dayAuto = autoByDay.get(key) ?? [];

        const imageCount = dayFiles.images.length;
        const pdfCount = dayFiles.pdfs.length;

        /* 16/11/2026: el resumen de arriba filtra el mes (partidos, viajes o entrenos). */
        const verSesiones = !filtro || filtro === "entrenos";
        const autoVisible = dayAuto.filter(
          (a) => !filtro || (filtro === "partidos" && a.clase === "PARTIDO") || (filtro === "viajes" && a.clase === "VIAJE"),
        );
        const eventosVisibles = dayEvents.filter((e) => !filtro || (filtro === "viajes" && e.tipo === "VIAJE"));
        const visible = eventosVisibles.slice(0, MAX_VISIBLE_PER_DAY);
        const hidden = eventosVisibles.length - visible.length;

        const sesionDia = sesionesDia.get(key);
        const hayPartido = dayAuto.some((a) => a.clase === "PARTIDO");
        /*
        | 17/11/2026 (r20, jueces): el MD de un día sin sesión sale de la regla
        | común de los dos calendarios (mdDelCalendario): el día después del
        | partido es «MD+1», no «Libre», y el segundo, «MD+2».
        */
        const mdSinSesion = !sesionDia && !hayPartido ? mdALaVista(key, fechasDelMd, hoyKey) : "";
        const libre =
          !mdSinSesion &&
          !sesionDia &&
          !hayPartido &&
          tramoSesiones !== null &&
          key > tramoSesiones.desde &&
          key < tramoSesiones.hasta;

        return {
          hasContent:
            eventosVisibles.length > 0 || autoVisible.length > 0 || (!filtro && (imageCount > 0 || pdfCount > 0)) || (verSesiones && Boolean(sesionDia)),
          onClick: () => openDay(key),
          badges: (
            <div className="flex flex-wrap items-center justify-end gap-1">
              {/* La sesión del día: su MD, como en /micro_calendar y el creador de micros
                  (16/11/2026: la misma regla, lib/microciclo/semana-de-hoy.ts; el de la hoja,
                  si no hay partido a la vista). Sin ninguno, «fuera de micro». */}
              {sesionDia && (() => {
                const deducido = mdDelCalendario(key, fechasDelMd) || sesionDia.md;

                return deducido ? (
                  <span className="siempre-oscuro whitespace-nowrap rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase" style={{ background: "#1F2937", color: "#FFFFFF" }} title="MD calculado por la fecha del próximo partido (la hoja no lo trae)">
                    {deducido}
                  </span>
                ) : (
                  <span className="whitespace-nowrap rounded-full border border-white/15 px-1.5 py-0.5 text-[10px] font-semibold text-white/60" title="Sesión apuntada sin MD en la hoja">
                    fuera de micro
                  </span>
                );
              })()}
              {sesionDia && hayPartido && sesionDia.minutos > 0 && (
                <span className="rounded-full border border-[#C8A96B]/30 bg-[#C8A96B]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[#C8A96B]">
                  {formatMinutes(sesionDia.minutos)}
                </span>
              )}
              {libre && (
                <span className="text-[10px] font-semibold uppercase tracking-wide text-white/45">Libre</span>
              )}
              {/* 10/11/2026: más allá de la última sesión apuntada, el MD que
                  toca por el calendario de partidos, en trazo discontinuo
                  (es previsto: la hoja aún no tiene la sesión). El día de
                  viaje se queda con el viaje (11/11/2026): un MD-1 sin sesión
                  al lado del autobús no decía nada. */}
              {/* 16/11/2026: también con viaje (el 28/11 salía sin su MD-1). */}
              {/* 17/11/2026 (r20): la regla común (mdALaVista): MD+1, MD+2, MD-1 a MD-5 y,
                  en la semana en curso, también MD-6 en adelante. Trazo discontinuo: sin sesión. */}
              {mdSinSesion ? (
                <span
                  className="whitespace-nowrap rounded-full border border-dashed border-white/25 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-white/60"
                  title={mdSinSesion === "MD+1" ? "El día después del partido: recuperación" : "MD por la fecha de los partidos: la hoja no tiene sesión ese día"}
                >
                  {mdSinSesion === "MD+1" ? "MD+1 · recup." : mdSinSesion}
                </span>
              ) : null}
              {imageCount > 0 && (
                <span className="flex items-center gap-1 rounded-full border border-sky-500/30 bg-sky-500/15 px-1.5 py-0.5">
                  <ImageIcon className="h-3 w-3 text-sky-300" />
                  <span className="text-[10px] font-medium text-sky-200">
                    {imageCount}
                  </span>
                </span>
              )}

              {pdfCount > 0 && (
                <span className="flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/15 px-1.5 py-0.5">
                  <FileText className="h-3 w-3 text-amber-300" />
                  <span className="text-[10px] font-medium text-amber-200">
                    {pdfCount}
                  </span>
                </span>
              )}
            </div>
          ),
          children:
            eventosVisibles.length > 0 || autoVisible.length > 0 || (verSesiones && sesionDia && (sesionDia.minutos > 0 || sesionDia.principal)) ? (
              <>
                {/* 07/11/2026: la sesión con su contenido principal y minutos, también en la agenda del móvil. */}
                {/* 16/11/2026: un punto con el color de la fase que manda (como /micro_calendar) y,
                    si sólo está planificada, borde discontinuo y «planificada». */}
                {verSesiones && sesionDia && !hayPartido && (sesionDia.minutos > 0 || sesionDia.principal) && (
                  <div
                    className="rounded-md border border-white/10 bg-white/[0.04] px-1.5 py-1"
                    style={sesionDia.planificado ? { borderStyle: "dashed", borderColor: "rgb(var(--rmcf-ink-rgb) / .35)" } : undefined}
                    title={sesionDia.principal || "Sesión"}
                  >
                    <p className="flex items-start gap-1 text-[10px] font-semibold leading-tight md:text-[11px]">
                      {faseDominante(sesionDia)?.dot ? (
                        <span aria-hidden className={cn("mt-[3px] h-2 w-2 shrink-0 rounded-full", faseDominante(sesionDia)?.dot)} />
                      ) : null}
                      <span className="min-w-0 break-words">{sesionDia.principal || "Sesión"}</span>
                    </p>
                    <p className="text-[10px] text-white/60 md:text-[10px]">
                      {sesionDia.planificado || sesionDia.minutos <= 0 ? "Planificada" : `Sesión · ${formatMinutes(sesionDia.minutos)}`}
                    </p>
                    {/* 17/11/2026 (r20, jueces): la carga del entreno hecho, con su base al pasar por encima. */}
                    {!sesionDia.planificado && sesionDia.ua ? (
                      <p
                        className="text-[10px] font-semibold tabular-nums text-white/75 md:text-[11px]"
                        title={`UA = minutos × intensidad (1-10) · ${sesionDia.conCarga} de ${sesionDia.tareas} tareas con tiempo e intensidad`}
                      >
                        {Math.round(sesionDia.ua)} UA
                        {sesionDia.conCarga && sesionDia.tareas && sesionDia.conCarga < sesionDia.tareas ? (
                          <span className="font-normal text-white/50"> · {sesionDia.conCarga}/{sesionDia.tareas} tareas</span>
                        ) : null}
                      </p>
                    ) : null}
                    {/* 16/11/2026 (jueces): la sesión abre su día en Microciclos desde la casilla. */}
                    {microDeFecha.get(key) ? (
                      <Link
                        href={`/microcycles?micro=${microDeFecha.get(key)}${(() => {
                          const md = (mdDelDia(key, fechasDelMd) || sesionDia.md).toUpperCase().replace(/\s+/g, "");

                          return md ? `&md=${encodeURIComponent(md)}` : "";
                        })()}`}
                        onClick={(e) => e.stopPropagation()}
                        className="block text-[10px] font-semibold text-[#C8A96B] underline-offset-2 hover:underline md:text-[11px]"
                      >
                        Ver la sesión →
                      </Link>
                    ) : null}
                  </div>
                )}
                {autoVisible.map((auto) =>
                  auto.clase === "PARTIDO" && auto.rival ? (
                    /* 30/10/2026: el escudo de casa primero, como se lee un partido:
                       en casa, Castilla vs rival; fuera, rival vs Castilla. */
                    <div
                      key={auto.id}
                      className="rounded-md border border-l-4 border-[#C8A96B]/20 border-l-[#C8A96B] bg-[#C8A96B]/10 px-1.5 py-1"
                      title={auto.titulo}
                    >
                      <div className="flex items-center gap-1">
                        <EscudoMini url={escudoDe(auto.enCasa ? NOSOTROS : auto.rival)} nombre={auto.enCasa ? "RM Castilla" : auto.rival} />
                        <span className="shrink-0 text-[10px] font-semibold text-[#C8A96B]">vs</span>
                        <EscudoMini url={escudoDe(auto.enCasa ? auto.rival : NOSOTROS)} nombre={auto.enCasa ? auto.rival : "RM Castilla"} />
                      </div>
                      {/* 07/11/2026: nombre corto del club en la casilla (el completo, al tocar); resultado si ya se jugó. */}
                      <p className="mt-0.5 truncate text-[10px] font-semibold md:text-[11px]">
                        {auto.jornada ? `J${String(auto.jornada).padStart(2, "0")} · ` : ""}
                        {auto.enCasa ? "vs " : "en "}
                        {nombreCorto(auto.rival)}
                      </p>
                      <p className="text-[10px] text-white/60 md:text-[10px]">
                        {/* 16/11/2026: el resultado con su sentido («ganado 1-0», el Castilla primero); sin jugar, la hora. */}
                        {[auto.enCasa ? "En casa" : "Fuera", auto.marcador ? resultadoConSentido(auto.marcador) : auto.hora].filter(Boolean).join(" · ")}
                      </p>
                      {/* 16/11/2026 (jueces): el partido lleva a lo suyo desde la propia casilla, sin abrir el día. */}
                      <Link
                        href={
                          auto.marcador
                            ? microDeFecha.get(auto.fecha)
                              ? `/microcycles?micro=${microDeFecha.get(auto.fecha)}`
                              : "/microcycles"
                            : (enlacesDelRival(jornadasRivales, auto.rival, auto.fecha)[0]?.href ?? "/match-preparation")
                        }
                        onClick={(e) => e.stopPropagation()}
                        className="mt-0.5 block text-[10px] font-semibold text-sky-300 underline-offset-2 hover:underline md:text-[11px]"
                      >
                        {auto.marcador ? "Informe →" : "Plan de partido →"}
                      </Link>
                      {/* 17/11/2026 (r20, jueces): sus goles en vídeo y su ABP, con el rival ya elegido. */}
                      <span className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5">
                        {enlacesDelRival(jornadasRivales, auto.rival, auto.fecha)
                          .filter((e) => e.texto === "Su ABP" || e.texto === "Sus goles en vídeo")
                          .map((e) =>
                            /* 18/11/2026: «Sus goles» abre el pop-up de la portada, sin salir del calendario. */
                            e.golesEnVideo ? (
                              <BotonGolesEnVideo
                                key={e.texto}
                                {...e.golesEnVideo}
                                title={e.title}
                                className="text-left text-[10px] font-semibold text-sky-300 underline-offset-2 hover:underline md:text-[11px]"
                              >
                                ▶ Sus goles
                              </BotonGolesEnVideo>
                            ) : (
                              <Link
                                key={e.texto}
                                href={e.href}
                                title={e.title}
                                onClick={(ev) => ev.stopPropagation()}
                                className="text-[10px] font-semibold text-sky-300 underline-offset-2 hover:underline md:text-[11px]"
                              >
                                {e.texto}
                              </Link>
                            ),
                          )}
                      </span>
                    </div>
                  ) : (
                  /* 16/11/2026: el viaje es un renglón ligero (punto morado, sin caja) para
                     que el partido mande en la casilla; ida, traslado y vuelta por su nombre. */
                  <p
                    key={auto.id}
                    title={[auto.titulo, auto.detalle, auto.hora].filter(Boolean).join(" · ")}
                    className="flex min-w-0 items-start gap-1 px-0.5 text-[10px] leading-tight text-white/70 md:text-[10px]"
                  >
                    <span aria-hidden className={cn("mt-[3px] h-1.5 w-1.5 shrink-0 rounded-full", AUTO_THEMES[auto.clase].dot)} />
                    {/* 16/11/2026 (jueces): el viaje abre su desplazamiento desde la casilla. */}
                    <Link
                      href={auto.enlace || "/desplazamiento"}
                      onClick={(e) => e.stopPropagation()}
                      className="min-w-0 break-words underline decoration-white/25 decoration-dotted underline-offset-2 hover:text-white"
                    >
                      {/* El rival con el mismo nombre corto que el partido de la casilla. */}
                      {auto.titulo.replace(/^(Viaje a|Regreso de|Vuelta de) (.+)$/, (_, que: string, quien: string) => `${que} ${nombreCorto(quien)}`)}
                      {auto.hora ? <span className="text-white/55"> · {auto.hora}</span> : null}
                      <span aria-hidden className="text-[#C8A96B]"> →</span>
                    </Link>
                  </p>
                  )
                )}

                {visible.map((event) => (
                  <div
                    key={event.id}
                    className={cn(
                      "rounded-md border border-l-4 border-[#C8A96B]/20 bg-[#C8A96B]/10 px-1.5 py-1",
                      TYPE_THEMES[event.tipo]?.stripe ?? "border-l-white/30"
                    )}
                  >
                    <p
                      title={event.titulo}
                      className="line-clamp-2 break-words text-[10px] font-semibold md:text-[11px]"
                    >
                      {event.titulo}
                    </p>

                    <p className="text-[10px] text-white/60 md:text-[10px]">
                      {TYPE_THEMES[event.tipo]?.label ?? event.tipo}
                      {event.hora ? ` · ${event.hora}` : ""}
                    </p>

                    <p className="truncate text-[10px] text-white/40 md:text-[10px]">
                      {event.responsable}
                    </p>
                  </div>
                ))}

                {hidden > 0 && (
                  <p className="pt-0.5 text-center text-[10px] font-medium text-[#C8A96B]/80">
                    +{hidden} más
                  </p>
                )}
              </>
            ) : undefined,
        };
      }}
    >
      {localOnly && (
        <div className="px-4 pb-6 md:px-8">
          <p className="flex items-start gap-2 rounded-xl border border-amber-400/30 bg-amber-400/5 px-4 py-3 text-sm text-amber-200/90">
            <TriangleAlert size={16} className="mt-0.5 shrink-0" />
            {/* Sin la orden de base de datos (19/10/2026): quien lo lee es el
                cuerpo técnico. Lo técnico va en el comentario: falta la tabla
                de supabase/app_documents.sql. */}
            <span>
              Los eventos se están guardando sólo en este aparato y el resto
              del staff no los ve. Avisa al administrador de la app.
            </span>
          </p>
        </div>
      )}

      {selectedDate && selectedKey && (
        <CalendarDayModal
          date={selectedDate}
          size="lg"
          sinGuardar={fichaSucia}
          subtitle={[
            `${selectedEvents.length + selectedAuto.length} ${
              selectedEvents.length + selectedAuto.length === 1 ? "evento" : "eventos"
            }`,
            selectedFilesCount > 0
              ? `${selectedFilesCount} ${
                  selectedFilesCount === 1 ? "documento" : "documentos"
                }`
              : null,
          ]
            .filter(Boolean)
            .join(" · ")}
          onClose={closeModal}
          onPrev={() => shiftSelectedDay(-1)}
          onNext={() => shiftSelectedDay(1)}
          canPrev={canShift(-1)}
          canNext={canShift(1)}
          keyboardEnabled={fullscreenImageIndex === null}
          actions={
            !isCreating &&
            !editingEvent && (
              <button
                type="button"
                onClick={() => {
                  setIsCreating(true);
                  setEditingEvent(null);
                }}
                className="flex items-center gap-2 rounded-xl border border-[#C8A96B] bg-[#C8A96B]/10 px-4 py-2 text-sm font-medium transition hover:bg-[#C8A96B]/20"
              >
                <Plus size={16} />
                Nuevo evento
              </button>
            )
          }
        >
          {(isCreating || editingEvent) && (
            <EventForm
              key={editingEvent?.id ?? "nuevo"}
              initialData={editingEvent}
              onSucio={setFichaSucia}
              onCancel={() => {
                setIsCreating(false);
                setEditingEvent(null);
              }}
              onSave={(form) => {
                saveEvent({
                  ...form,
                  id: editingEvent?.id ?? newEventId(),
                  fecha: selectedKey,
                });

                setIsCreating(false);
                setEditingEvent(null);
              }}
            />
          )}

          <FilesSection
            files={selectedFiles}
            onOpenImage={setFullscreenImageIndex}
          />

          <div className="space-y-3">
            {selectedEvents.length === 0 &&
              selectedAuto.length === 0 &&
              !isCreating &&
              !editingEvent &&
              selectedFiles.images.length === 0 &&
              selectedFiles.pdfs.length === 0 &&
              !sesionesDia.get(selectedKey) && (
                <CalendarEmptyState>
                  Sin operativa programada este día.
                </CalendarEmptyState>
              )}

            {(() => {
              const s = sesionesDia.get(selectedKey);
              if (!s) return null;
              return (
                <div className="rounded-xl border border-l-4 border-white/10 border-l-[#C8A96B] bg-[#10151C] p-4">
                  <p className="text-lg font-semibold">
                    Sesión{s.md ? ` · ${s.md}` : ""}
                  </p>
                  {(s.minutos > 0 || s.principal) && (
                    <p className="mt-1 text-sm text-[#C8A96B]">
                      {[s.minutos > 0 ? `${formatMinutes(s.minutos)} de trabajo` : "", s.principal ? `sobre todo ${s.principal}` : ""].filter(Boolean).join(" · ")}
                    </p>
                  )}
                  {/* 16/11/2026 (jueces): la sesión abre su día, ya elegido, en las pantallas que la completan. */}
                  {(() => {
                    const micro = microDeFecha.get(selectedKey);
                    const md = (mdDelDia(selectedKey, fechasDelMd) || s.md).toUpperCase().replace(/\s+/g, "");
                    const href = micro ? `/microcycles?micro=${micro}${md ? `&md=${encodeURIComponent(md)}` : ""}` : "/micro_calendar";

                    return (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Link href={href} className="inline-flex min-h-9 items-center rounded-lg border border-[#C8A96B]/40 bg-[#C8A96B]/10 px-3 py-1.5 text-xs font-semibold text-[#C8A96B] transition hover:bg-[#C8A96B]/20">
                          {micro ? `Micro ${micro}${md ? ` · ${md}` : ""} en Microciclos` : "Ver las tareas"}
                        </Link>
                        <Link href={enlaceSesion(selectedKey)} className="inline-flex min-h-9 items-center rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-white/75 transition hover:text-white">
                          Equipos de la sesión
                        </Link>
                        <Link href={enlaceAnalisis(selectedKey)} className="inline-flex min-h-9 items-center rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-white/75 transition hover:text-white">
                          Análisis del entreno
                        </Link>
                      </div>
                    );
                  })()}
                </div>
              );
            })()}

            {selectedAuto.map((auto) => (
              <div
                key={auto.id}
                className={cn(
                  "rounded-xl border border-l-4 border-white/10 bg-[#10151C] p-4",
                  AUTO_THEMES[auto.clase].stripe
                )}
              >
                <p className="text-lg font-semibold">{auto.titulo}</p>

                <p className="mt-1 text-sm text-[#C8A96B]">
                  {[AUTO_THEMES[auto.clase].label, auto.marcador ? `resultado ${auto.marcador}` : "", auto.hora, auto.detalle].filter(Boolean).join(" · ")}
                </p>

                {/*
                | 16/11/2026 (jueces): el partido lleva a lo suyo. Jugado: su micro
                | en Microciclos, donde está «Informe del partido». Por jugar: el
                | plan, el ABP y los goles en vídeo del rival, ya elegido.
                */}
                {auto.clase === "PARTIDO" && auto.rival ? (
                  auto.marcador ? (
                    <Link
                      href={microDeFecha.get(auto.fecha) ? `/microcycles?micro=${microDeFecha.get(auto.fecha)}` : "/microcycles"}
                      className="mt-3 inline-flex min-h-9 items-center rounded-lg border border-[#C8A96B]/40 bg-[#C8A96B]/10 px-3 py-1.5 text-xs font-semibold text-[#C8A96B] transition hover:bg-[#C8A96B]/20"
                    >
                      Informe del partido
                    </Link>
                  ) : (
                    <EnlacesDelRival className="mt-3" rival={auto.rival} fecha={auto.fecha} solo={["Plan de partido", "Su ABP", "Sus goles en vídeo"]} />
                  )
                ) : null}

                {auto.enlace && (
                  <Link
                    href={auto.enlace}
                    className="mt-3 inline-block text-xs text-[#C8A96B] transition hover:underline"
                  >
                    Abrir el desplazamiento →
                  </Link>
                )}
              </div>
            ))}

            {selectedEvents.map((event) => {
              const theme = TYPE_THEMES[event.tipo];
              const confirming = deletingId === event.id;

              return (
                <div
                  key={event.id}
                  className={cn(
                    "rounded-xl border border-l-4 border-white/10 bg-[#10151C] p-4",
                    theme?.stripe ?? "border-l-white/30"
                  )}
                >
                  <p className="text-lg font-semibold">{event.titulo}</p>

                  <p className="mt-1 text-sm text-[#C8A96B]">
                    {theme?.label ?? event.tipo}
                    {event.hora ? ` · ${event.hora}` : ""}
                    {event.responsable ? ` · ${event.responsable}` : ""}
                  </p>

                  <div className="mt-3 space-y-2">
                    {event.descripcion && (
                      <p className="text-white/80">{event.descripcion}</p>
                    )}

                    <div className="flex flex-wrap gap-x-4 text-xs text-white/50">
                      {event.lugar && <span>Lugar: {event.lugar}</span>}
                      {event.participantes && (
                        <span>Participantes: {event.participantes}</span>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingEvent(event);
                        setIsCreating(false);
                        setDeletingId(null);
                      }}
                      className="flex items-center gap-2 rounded-lg border border-[#C8A96B] px-3 py-2 text-sm transition hover:bg-[#C8A96B]/10"
                    >
                      <Pencil size={14} />
                      Editar
                    </button>

                    {confirming ? (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setDeletingId(null);
                            deleteEvent(event.id);
                          }}
                          className="rounded-lg border border-red-500 bg-red-500/15 px-3 py-2 text-sm text-red-300"
                        >
                          Confirmar borrado
                        </button>

                        <button
                          type="button"
                          onClick={() => setDeletingId(null)}
                          className="rounded-lg border border-white/10 px-3 py-2 text-sm text-white/60"
                        >
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setDeletingId(event.id)}
                        className="flex items-center gap-2 rounded-lg border border-red-500/60 px-3 py-2 text-sm text-red-400 transition hover:bg-red-500/10"
                      >
                        <Trash2 size={14} />
                        Eliminar
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {fullscreenImageIndex !== null && (
            <ImageViewer
              images={selectedFiles.images}
              index={fullscreenImageIndex}
              onIndexChange={setFullscreenImageIndex}
              onClose={() => setFullscreenImageIndex(null)}
            />
          )}
        </CalendarDayModal>
      )}
    </CalendarShell>
  );
}

function FilesSection({
  files,
  onOpenImage,
}: {
  files: { images: DayFile[]; pdfs: DayFile[] };
  onOpenImage: (index: number) => void;
}) {
  if (files.images.length === 0 && files.pdfs.length === 0) return null;

  return (
    <div className="mb-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs uppercase tracking-[0.2em] text-white/40">
          Documentación del Área General
        </p>

        <Link
          href="/general"
          className="text-xs text-[#C8A96B] transition hover:underline"
        >
          Abrir Área General →
        </Link>
      </div>

      {files.images.length > 0 && (
        <div>
          <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold">
            <ImageIcon size={18} className="text-[#C8A96B]" />
            Imágenes ({files.images.length})
          </h3>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {files.images.map((img, index) => (
              <button
                key={img.url}
                type="button"
                onClick={() => onOpenImage(index)}
                className="cursor-zoom-in overflow-hidden rounded-xl border border-white/10 bg-[#10151C] text-left transition hover:border-[#C8A96B]/40"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.url}
                  alt={img.name}
                  loading="lazy"
                  className="h-32 w-full object-cover transition hover:scale-[1.03]"
                />

                <FileOrigin file={img} className="px-2 py-1.5" />
              </button>
            ))}
          </div>
        </div>
      )}

      {files.pdfs.length > 0 && (
        <div>
          <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold">
            <FileText size={18} className="text-[#C8A96B]" />
            PDFs ({files.pdfs.length})
          </h3>

          <div className="space-y-2">
            {files.pdfs.map((pdf) => (
              <a
                key={pdf.url}
                href={pdf.url}
                target="_blank"
                rel="noreferrer"
                className="block rounded-xl border border-white/10 bg-[#10151C] p-3 transition hover:border-[#C8A96B]/40"
              >
                <div className="flex items-center gap-3">
                  <FileText className="shrink-0 text-[#C8A96B]" />

                  <span className="min-w-0">
                    <span className="block truncate">{pdf.name}</span>
                    <FileOrigin file={pdf} />
                  </span>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** "Semana 3 · 13 Jul — 19 Jul": de qué semana del área viene el documento. */
function FileOrigin({ file, className }: { file: DayFile; className?: string }) {
  if (!file.week) return null;

  return (
    <span
      className={cn(
        "block truncate text-[10px] text-white/45 md:text-[11px]",
        className
      )}
    >
      {file.week}
      {file.weekRange ? ` · ${file.weekRange}` : ""}
    </span>
  );
}

function ImageViewer({
  images,
  index,
  onIndexChange,
  onClose,
}: {
  images: DayFile[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}) {
  const image = images[index];

  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }

      if (event.key === "ArrowRight" && images.length > 0) {
        event.preventDefault();
        onIndexChange((index + 1) % images.length);
      }

      if (event.key === "ArrowLeft" && images.length > 0) {
        event.preventDefault();
        onIndexChange((index - 1 + images.length) % images.length);
      }
    };

    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [index, images.length, onIndexChange, onClose]);

  if (!image) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95 p-6"
      onClick={onClose}
    >
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onClose}
        className="absolute right-3 top-3 text-3xl text-white/80 transition hover:text-white sm:right-6 sm:top-6"
      >
        ✕
      </button>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image.url}
        alt={image.name}
        className="max-h-[86vh] max-w-[78vw] rounded-xl object-contain sm:max-w-[86vw]"
        onClick={(event) => event.stopPropagation()}
      />

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-xl bg-black/60 px-4 py-2 text-sm text-white/70">
        {index + 1} / {images.length}
      </div>
    </div>
  );
}

function EventForm({
  initialData,
  onCancel,
  onSave,
  onSucio,
}: {
  initialData?: GeneralEvent | null;
  onCancel: () => void;
  onSave: (data: Omit<GeneralEvent, "id" | "fecha">) => void;
  /**
   * Avisa al día de si hay algo escrito sin guardar.
   *
   * El formulario vive aquí dentro, pero quien cierra la ventana es el día:
   * sin este aviso, cerrarlo desmontaba la ficha a medio rellenar y no
   * quedaba rastro de lo escrito.
   */
  onSucio?: (sucio: boolean) => void;
}) {
  const [tipo, setTipo] = useState<EventType>(initialData?.tipo ?? "REUNION");
  const [titulo, setTitulo] = useState(initialData?.titulo ?? "");
  const [descripcion, setDescripcion] = useState(
    initialData?.descripcion ?? ""
  );
  const [responsable, setResponsable] = useState(
    initialData?.responsable ?? ""
  );
  const [hora, setHora] = useState(initialData?.hora ?? "");
  const [lugar, setLugar] = useState(initialData?.lugar ?? "");
  const [participantes, setParticipantes] = useState(
    initialData?.participantes ?? ""
  );

  const [formError, setFormError] = useState<string | null>(null);

  const sucio =
    tipo !== (initialData?.tipo ?? "REUNION") ||
    titulo !== (initialData?.titulo ?? "") ||
    descripcion !== (initialData?.descripcion ?? "") ||
    responsable !== (initialData?.responsable ?? "") ||
    hora !== (initialData?.hora ?? "") ||
    lugar !== (initialData?.lugar ?? "") ||
    participantes !== (initialData?.participantes ?? "");

  useEffect(() => {
    onSucio?.(sucio);

    /* Al desmontar, el día vuelve a poder cerrarse sin preguntar. */
    return () => onSucio?.(false);
  }, [sucio, onSucio]);

  const inputClass =
    "w-full rounded-xl border border-white/10 bg-[#0B0F14] px-3 py-2 outline-none transition focus:border-[#C8A96B]";

  return (
    <div className="mb-6 space-y-4 rounded-2xl border border-white/10 bg-[#10151C] p-4">
      <h3 className="text-lg font-semibold">
        {initialData ? "Editar evento" : "Nuevo evento de operativa"}
      </h3>

      <select
        value={tipo}
        onChange={(event) => setTipo(event.target.value as EventType)}
        aria-label="Tipo de evento"
        className={inputClass}
      >
        {EVENT_TYPES.map((type) => (
          <option key={type} value={type}>
            {TYPE_THEMES[type].label}
          </option>
        ))}
      </select>

      <input
        value={titulo}
        onChange={(event) => setTitulo(event.target.value)}
        placeholder="Título"
        className={inputClass}
      />

      <textarea
        value={descripcion}
        onChange={(event) => setDescripcion(event.target.value)}
        placeholder="Descripción"
        rows={3}
        className={inputClass}
      />

      <div className="grid grid-cols-2 gap-3">
        <input
          value={hora}
          onChange={(event) => setHora(event.target.value)}
          placeholder="Hora (10:30)"
          className={inputClass}
        />

        <input
          value={lugar}
          onChange={(event) => setLugar(event.target.value)}
          placeholder="Lugar"
          className={inputClass}
        />
      </div>

      <input
        value={responsable}
        onChange={(event) => setResponsable(event.target.value)}
        placeholder="Responsable"
        className={inputClass}
      />

      <input
        value={participantes}
        onChange={(event) => setParticipantes(event.target.value)}
        placeholder="Participantes"
        className={inputClass}
      />

      {formError && <p className="text-sm text-red-400">{formError}</p>}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-white/10 px-4 py-2"
        >
          Cancelar
        </button>

        <button
          type="button"
          onClick={() => {
            if (!titulo.trim()) {
              setFormError("El título es obligatorio");
              return;
            }

            setFormError(null);

            onSave({
              tipo,
              titulo: titulo.trim(),
              descripcion,
              responsable,
              hora,
              lugar,
              participantes,
            });
          }}
          className="rounded-xl border border-[#C8A96B] bg-[#C8A96B]/10 px-4 py-2 transition hover:bg-[#C8A96B]/20"
        >
          {initialData ? "Guardar cambios" : "Guardar"}
        </button>
      </div>
    </div>
  );
}
