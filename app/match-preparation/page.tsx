"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import Link from "next/link";
import { toast } from "sonner";

import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { useSaveGuard } from "@/hooks/useSaveGuard";
import { useAutoSave } from "@/hooks/useAutoSave";
import { guardaEnLaHoja, leeRivales } from "@/lib/hojaRivales";
import { traeJson } from "@/lib/hojaCsv";
import { AutoSaveStatus } from "@/components/save-guard/AutoSaveStatus";
import { ColumnasPerdidas } from "@/components/save-guard/ColumnasPerdidas";
import RecursosRival, {
  type RecursoFijo,
} from "@/components/rivals/RecursosRival";
import { BocetoPlanDialog } from "@/components/match-preparation/BocetoPlanDialog";
import { PorQueDelBoceto } from "@/components/match-preparation/PorQueDelBoceto";
import { KIND_MOTIVOS_PLAN, claveMotivosPlan, type BocetoPlan } from "@/lib/plan-partido/boceto";
import { EscudoEquipo } from "@/components/rivals/EscudoEquipo";
import { useEscudos } from "@/hooks/useEscudos";
import { useDuelosClave } from "@/hooks/useDuelosClave";
import { useContrasteRival } from "@/hooks/useContrasteRival";
import { fraseRecuentoDuelos } from "@/lib/duelos";
import { cargaOrdenRivales } from "@/lib/rivals/orden-calendario";

import {
  Activity,
  Binoculars,
  Brain,
  CalendarDays,
  Check,
  ChevronDown,
  Copy,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  ClipboardList,
  Film,
  Flame,
  LoaderCircle,
  MapPin,
  Pencil,
  Printer,
  RotateCcw,
  Ruler,
  Search,
  Shield,
  Sparkles,
  Swords,
  Target,
  ThumbsDown,
  ThumbsUp,
  TriangleAlert,
} from "lucide-react";

import type { LucideIcon } from "lucide-react";

/*
|--------------------------------------------------------------------------
| PLAN DE PARTIDO
|--------------------------------------------------------------------------
| Página de consulta rápida en día de partido y de edición del informe.
| Dos modos claramente separados:
|
|   · LECTURA  -> el contenido se muestra como texto/listas legibles.
|   · EDICIÓN  -> los mismos bloques se convierten en campos editables.
|
| Todo el estado editable vive en `rivalActivo` y, en edición, se guarda solo
| unos segundos después de cada cambio (`useAutoSave`). `alEntrar` conserva la
| versión con la que se abrió la edición: es a la que vuelve «Deshacer».
*/

type Rival = Record<string, string>;

/*
| La fecha del partido, la de BeSoccer (29/10/2026, experto de fútbol). La
| hoja guarda «…T23:00:00Z» (la medianoche de Madrid del 1/11) y el partido es
| el sábado 31/10 a las 18:45: así lo dicen /rivals, /duelos y la pizarra. Sólo
| se cambia lo que se ve; el campo FECHA de la hoja no se toca (se autoguarda).
*/
const FECHAS_REALES = new Map<string, string>();

function fechaDe(r: Rival | null | undefined): string {
  if (!r) return "";

  return FECHAS_REALES.get(`${r.EQUIPO}|${r.JORNADA}`) ?? r.FECHA;
}

/* Campos que cuentan para el porcentaje de preparación del informe. */
const CAMPOS_PLAN = [
  "ESTADO_EQUIPO",
  "CLAVES_PARTIDO",
  "CLAVES_EMOCIONALES",
  "ATAQUE",
  "DEFENSA",
  "ABP_OF",
  "ABP_DEF",
  "DUELOS_CB_FAVOR",
  "DUELOS_CB_CONTRA",
  "DUELOS_SB_FAVOR",
  "DUELOS_SB_CONTRA",
  "FORTALEZAS",
  "DEBILIDADES",
  "ESTRUCTURA_OF",
  "ESTRUCTURA_DEF",
  "HUDL_PLAYLIST",
  "HUDL_PARTIDO",
  "HUDL_ANALISIS",
  "DOC",
] as const;

/*
| Lo que se copia al replicar el plan de otra jornada: los textos. Los enlaces
| de vídeo y el informe son de ese rival, y la fecha, el campo y si somos
| locales son del partido, así que ésos no viajan.
*/
/*
| Las columnas de la hoja que se editan en esta pantalla: el plan y los datos
| del partido de la cabecera. Es lo único que se manda encima de la fila recién
| leída; el resto —el informe de scouting colectivo, sobre todo— se deja como
| esté en la hoja.
*/
const CAMPOS_DE_ESTA_PANTALLA: readonly string[] = [
  ...CAMPOS_PLAN,
  "EQUIPO",
  "FECHA",
  "DIMENSIONES",
  "LOCAL_VISITANTE",
];

const CAMPOS_REPLICABLES = CAMPOS_PLAN.filter(
  (campo) => !campo.startsWith("HUDL_") && campo !== "DOC",
);

const SECCIONES: { id: string; label: string; icon: LucideIcon }[] = [
  { id: "contexto", label: "Contexto", icon: ClipboardList },
  { id: "plan", label: "Plan de juego", icon: Target },
  { id: "duelos", label: "Duelos", icon: Swords },
  { id: "rival", label: "Análisis rival", icon: Shield },
  { id: "recursos", label: "Recursos", icon: Film },
];

/*
|--------------------------------------------------------------------------
| PALETAS POR BLOQUE
|--------------------------------------------------------------------------
| Las clases se escriben completas para que Tailwind las detecte al compilar.
*/

type Tone = "gold" | "green" | "red" | "violet" | "blue" | "neutral";

const TONES: Record<
  Tone,
  { text: string; border: string; bg: string; dot: string; ring: string }
> = {
  gold: {
    text: "text-[#C8A96B]",
    border: "border-[#C8A96B]/20",
    bg: "bg-[#C8A96B]/[0.05]",
    dot: "bg-[#C8A96B]",
    ring: "focus:border-[#C8A96B] focus:ring-[#C8A96B]/25",
  },
  green: {
    text: "text-emerald-300",
    border: "border-emerald-500/20",
    bg: "bg-emerald-500/[0.05]",
    dot: "bg-emerald-400",
    ring: "focus:border-emerald-400 focus:ring-emerald-400/25",
  },
  red: {
    text: "text-rose-300",
    border: "border-rose-500/20",
    bg: "bg-rose-500/[0.05]",
    dot: "bg-rose-400",
    ring: "focus:border-rose-400 focus:ring-rose-400/25",
  },
  violet: {
    text: "text-violet-300",
    border: "border-violet-500/20",
    bg: "bg-violet-500/[0.05]",
    dot: "bg-violet-400",
    ring: "focus:border-violet-400 focus:ring-violet-400/25",
  },
  blue: {
    text: "text-sky-300",
    border: "border-sky-500/20",
    bg: "bg-sky-500/[0.05]",
    dot: "bg-sky-400",
    ring: "focus:border-sky-400 focus:ring-sky-400/25",
  },
  neutral: {
    text: "text-white/70",
    border: "border-white/10",
    bg: "bg-white/[0.03]",
    dot: "bg-white/50",
    ring: "focus:border-white/40 focus:ring-white/20",
  },
};

/*
|--------------------------------------------------------------------------
| HELPERS
|--------------------------------------------------------------------------
*/

function relleno(valor: unknown) {
  return String(valor ?? "").trim().length > 0;
}

/** Frases genéricas de plantilla que se leerían como dato del partido («Buena energía…», «Foco de todos…»). */
function esTextoDePlantilla(valor: unknown) {
  const lineas = String(valor ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/\r?\n|;/)
    .map((l) => l.replace(/^[\s\-–•*\d.)]+/, "").trim())
    .filter(Boolean);

  return (
    lineas.length > 0 &&
    lineas.every((l) => /^(buena energia o mentalidad|foco de todos)/.test(l))
  );
}

function normalizar(valor: unknown) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/* Sheets puede devolver ISO completo; <input type="date"> exige yyyy-mm-dd. */
function aValorDeInput(raw: unknown) {
  const texto = String(raw ?? "").trim();

  if (!texto) return "";

  const directo = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);

  /* Un instante con zona («…T22:00:00.000Z», la medianoche de Madrid que
     manda la hoja) no se recorta: daba el día anterior. Ése va por la
     conversión a hora local de abajo (19/10/2026). */
  const conZona = /T\d{2}:\d{2}.*(Z|[+-]\d{2}:?\d{2})$/.test(texto);

  if (directo && !conZona) return `${directo[1]}-${directo[2]}-${directo[3]}`;

  const fecha = new Date(texto);

  if (Number.isNaN(fecha.getTime())) return "";

  const local = new Date(
    fecha.getTime() - fecha.getTimezoneOffset() * 60000
  );

  return local.toISOString().slice(0, 10);
}

function aFecha(raw: unknown) {
  const valor = aValorDeInput(raw);

  if (!valor) return null;

  const [anio, mes, dia] = valor.split("-").map(Number);

  return new Date(anio, mes - 1, dia);
}

function fechaLarga(raw: unknown) {
  const fecha = aFecha(raw);

  if (!fecha) return "Sin fecha";

  /* «Domingo, 25 de octubre de 2026»: sólo la inicial en mayúscula, que en español «de» no la lleva. */
  const larga = fecha.toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return larga.charAt(0).toUpperCase() + larga.slice(1);
}

function fechaCorta(raw: unknown) {
  const fecha = aFecha(raw);

  if (!fecha) return "";

  return fecha.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
  });
}

/* Días completos entre hoy y la fecha del partido. */
function diasHasta(raw: unknown) {
  const fecha = aFecha(raw);

  if (!fecha) return null;

  const hoy = new Date();

  hoy.setHours(0, 0, 0, 0);

  return Math.round((fecha.getTime() - hoy.getTime()) / 86400000);
}

function etiquetaCuentaAtras(dias: number | null) {
  if (dias === null) return { texto: "Fecha por definir", urgente: false };

  if (dias === 0) return { texto: "Hoy es el partido", urgente: true };

  if (dias === 1) return { texto: "Mañana", urgente: true };

  if (dias === -1) return { texto: "Ayer", urgente: false };

  if (dias > 1) return { texto: `Faltan ${dias} días`, urgente: dias <= 3 };

  return { texto: `Hace ${Math.abs(dias)} días`, urgente: false };
}

/* Convierte un texto libre en viñetas: salto de línea y, opcionalmente, ";". */
function aVinetas(valor: unknown, separarPorPuntoYComa = false) {
  const texto = String(valor ?? "");

  if (!texto.trim()) return [];

  const partes = separarPorPuntoYComa
    ? texto.split(/[\n;]+/)
    : texto.split(/\r?\n+/);

  return partes
    .map((linea) => linea.replace(/^[\s•\-–·]+/, "").replace(/^\d{1,2}[.)]\s+/, "").trim())
    .filter(Boolean);
}

/* Cuántas claves del partido salen arriba, en «Lo esencial». */
const CLAVES_ESENCIALES = 3;

/* Las claves del partido, una por línea y sin la viñeta que traiga escrita. */
function lineasDeClaves(valor: unknown) {
  return String(valor ?? "")
    .split(/\r?\n/)
    .map((l) => l.replace(/^[\s\-–•*·]+/, "").trim())
    .filter(Boolean);
}

/*
 * Una línea que es sólo un título (ATAQUE CP, ÁREA, DEFENSA CR…): en
 * mayúsculas, corta y sin punto final. Se pinta como subtítulo y no como
 * viñeta.
 */
function esTituloDeApartado(linea: string) {
  const texto = linea.replace(/:\s*$/, "").trim();

  if (texto.length < 2 || texto.length > 40 || /[.;]$/.test(texto)) return false;

  return /\p{Lu}/u.test(texto) && !/\p{Ll}/u.test(texto);
}

/* Lo que quieren decir las siglas que el cuerpo técnico usa en el plan de juego. */
const SIGLAS_PLAN: Record<string, string> = {
  CP: "Ataque posicional u organizado",
  CR: "Contraataque o transición",
  ABP: "Acciones a balón parado",
  PTO: "Portero",
};

/*
 * El texto tal cual lo escribió el analista, con un `title` en cada sigla
 * conocida (y en Z1, Z2…: zonas del campo). No cambia ni una letra.
 */
function ConSiglas({ texto }: { texto: string }) {
  const partes = texto.split(/(?<![\p{L}\d])(CP|CR|ABP|PTO|Z\d)(?![\p{L}\d])/u);

  return (
    <>
      {partes.map((p, i) => {
        const significado = i % 2 === 1 ? (SIGLAS_PLAN[p] ?? (/^Z\d$/.test(p) ? `Zona ${p.slice(1)} del campo` : "")) : "";

        return significado ? (
          <abbr key={i} title={significado} className="cursor-help no-underline decoration-dotted underline-offset-2 hover:underline">
            {p}
          </abbr>
        ) : (
          p
        );
      })}
    </>
  );
}

/**
 * Informe colectivo del rival de este partido.
 *
 * El scouting y el plan comparten la misma hoja (`action=rivales`), así que
 * basta con arrastrar el ID para que la otra página abra el mismo partido.
 */
function enlaceAnalisisRival(rival: Rival | null) {
  const id = String(rival?.ID ?? "").trim();

  return id
    ? `/scout-rival-collective?rival=${encodeURIComponent(id)}`
    : "/scout-rival-collective";
}

/**
 * La pizarra de balón parado de este mismo partido.
 *
 * La pizarra se monta sobre el calendario y no sobre esta hoja, así que el
 * `ID` no le sirve de llave directa: lo traduce ella —por tablero ya atado,
 * por fecha o por nombre— al llegar. Lo que aquí importa es que el ABP que se
 * está escribiendo y las diapositivas que se van a proyectar dejen de estar en
 * dos sitios sin puente.
 */
function enlacePizarraAbp(rival: Rival | null) {
  const id = String(rival?.ID ?? "").trim();

  return id ? `/abp-pizarra?rival=${encodeURIComponent(id)}` : "/abp-pizarra";
}

/*
|--------------------------------------------------------------------------
| TEXTAREA QUE CRECE CON EL CONTENIDO
|--------------------------------------------------------------------------
| Definido a nivel de módulo (no dentro de la página) para que React no lo
| desmonte en cada render y el campo no pierda el foco al escribir.
*/

function AutoTextarea({
  value,
  onChange,
  placeholder,
  minHeight = 150,
  tone = "neutral",
  label,
}: {
  value: string;
  onChange: (valor: string) => void;
  placeholder?: string;
  minHeight?: number;
  tone?: Tone;
  label: string;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const el = ref.current;

    if (!el) return;

    el.style.height = "auto";
    el.style.height = `${Math.max(el.scrollHeight, minHeight)}px`;
  }, [value, minHeight]);

  return (
    <textarea
      ref={ref}
      aria-label={label}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      style={{ minHeight }}
      className={`
        w-full resize-none rounded-2xl border border-white/15
        bg-[#0B0F14]/70 p-4 text-sm leading-6 text-white
        outline-none transition placeholder:text-white/25
        focus:ring-2 ${TONES[tone].ring}
      `}
    />
  );
}

/*
|--------------------------------------------------------------------------
| TEXTO EN MODO LECTURA
|--------------------------------------------------------------------------
*/

function ReadText({
  value,
  separarPorPuntoYComa = false,
  vacio = "Sin escribir todavía. Se rellena con «Editar informe».",
  apartados = false,
}: {
  value: unknown;
  separarPorPuntoYComa?: boolean;
  vacio?: string;
  /* Las líneas en mayúsculas son títulos de apartado y las siglas llevan su significado. */
  apartados?: boolean;
}) {
  const items = useMemo(
    () => aVinetas(value, separarPorPuntoYComa),
    [value, separarPorPuntoYComa]
  );

  if (!items.length) {
    return (
      /* El aviso dice cómo rellenarlo: en el papel no pinta nada (lo que no
         tiene dato no se nombra en un informe; 19/10/2026). */
      <div className="flex items-center gap-2 rounded-2xl border border-dashed border-white/10 px-4 py-5 text-sm text-white/30 print:hidden">
        <CircleAlert size={15} />
        {vacio}
      </div>
    );
  }

  if (apartados) {
    /* El título sin viñeta y en negrita; lo que cuelga de él, sangrado. */
    return (
      <ul className="space-y-2.5 text-[13.5px] leading-6 text-white/80">
        {items.map((item, indice) => {
          const titulo = esTituloDeApartado(item);
          const dentro = items.slice(0, indice).some(esTituloDeApartado);

          return titulo ? (
            <li
              key={`${indice}-${item.slice(0, 12)}`}
              className={`font-bold tracking-wide text-white ${indice > 0 ? "pt-2" : ""}`}
            >
              <ConSiglas texto={item} />
            </li>
          ) : (
            <li key={`${indice}-${item.slice(0, 12)}`} className={`flex gap-2.5 ${dentro ? "pl-4" : ""}`}>
              <span
                aria-hidden
                className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#C8A96B]/70"
              />

              <span>
                <ConSiglas texto={item} />
              </span>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <ul className="space-y-2.5 text-[13.5px] leading-6 text-white/80">
      {items.map((item, indice) => (
        <li key={`${indice}-${item.slice(0, 12)}`} className="flex gap-2.5">
          <span
            aria-hidden
            className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#C8A96B]/70"
          />

          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

/*
|--------------------------------------------------------------------------
| BLOQUE DE CONTENIDO
|--------------------------------------------------------------------------
*/

function Bloque({
  titulo,
  icon: Icon,
  tone = "gold",
  value,
  editando,
  onChange,
  placeholder,
  minHeight = 150,
  separarPorPuntoYComa = false,
  vacio,
  apartados = false,
  className = "",
}: {
  titulo: string;
  icon?: LucideIcon;
  tone?: Tone;
  value: unknown;
  editando: boolean;
  onChange: (valor: string) => void;
  placeholder?: string;
  minHeight?: number;
  separarPorPuntoYComa?: boolean;
  vacio?: string;
  apartados?: boolean;
  className?: string;
}) {
  const t = TONES[tone];

  const completo = relleno(value);

  /* En lectura, un bloque sin texto no se pinta (ni «pendiente» ni aviso). Tampoco si sólo trae frases de plantilla que nadie escribió para este partido. */
  if (!editando && (!completo || esTextoDePlantilla(value))) return null;

  return (
    <div
      className={`mp-card flex flex-col rounded-2xl border ${t.border} ${t.bg} p-5 ${className}`}
    >
      <div className="mb-4 flex items-center gap-2.5">
        {Icon && <Icon size={15} className={t.text} />}

        <h3
          className={`text-[12px] font-semibold uppercase tracking-[0.16em] ${t.text}`}
        >
          {titulo}
        </h3>

        <span
          aria-hidden
          title={completo ? "Completado" : "Pendiente"}
          className={`ml-auto h-1.5 w-1.5 rounded-full ${
            completo ? t.dot : "bg-white/15"
          }`}
        />
      </div>

      {editando ? (
        <AutoTextarea
          label={titulo}
          value={String(value ?? "")}
          onChange={onChange}
          placeholder={placeholder}
          minHeight={minHeight}
          tone={tone}
        />
      ) : (
        <ReadText
          value={value}
          separarPorPuntoYComa={separarPorPuntoYComa}
          vacio={vacio}
          apartados={apartados}
        />
      )}
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| DATO DE CABECERA
|--------------------------------------------------------------------------
*/

function DatoCabecera({
  etiqueta,
  icon: Icon,
  children,
}: {
  etiqueta: string;
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3.5">
      <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-white/40">
        <Icon size={12} />
        {etiqueta}
      </p>

      <div className="mt-1.5 text-sm font-semibold text-white">{children}</div>
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| SELECTOR DE PARTIDO
|--------------------------------------------------------------------------
| Buscador + listado con jornada, rival y fecha. Sustituye al <select>
| nativo, ilegible cuando hay 30+ jornadas.
*/

function RivalPicker({
  rivales,
  activo,
  onSelect,
  bloqueado,
}: {
  rivales: Rival[];
  activo: Rival | null;
  onSelect: (rival: Rival) => void;
  bloqueado: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");

  const escudoDe = useEscudos();

  const contenedor = useRef<HTMLDivElement | null>(null);
  const inputBusqueda = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!abierto) return;

    const fuera = (evento: MouseEvent) => {
      if (
        contenedor.current &&
        !contenedor.current.contains(evento.target as Node)
      ) {
        setAbierto(false);
      }
    };

    const escape = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") setAbierto(false);
    };

    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", escape);

    inputBusqueda.current?.focus();

    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("keydown", escape);
    };
  }, [abierto]);

  const filtrados = useMemo(() => {
    const consulta = normalizar(busqueda);

    if (!consulta) return rivales;

    return rivales.filter((r) =>
      normalizar(`J${r.JORNADA} ${r.EQUIPO}`).includes(consulta)
    );
  }, [rivales, busqueda]);

  return (
    <div ref={contenedor} className="relative min-w-0 flex-1">
      <button
        type="button"
        disabled={bloqueado}
        onClick={() => {
          setBusqueda("");
          setAbierto((v) => !v);
        }}
        aria-haspopup="listbox"
        aria-expanded={abierto}
        title={
          bloqueado
            ? "Guarda o cancela los cambios para cambiar de partido"
            : "Cambiar de partido"
        }
        className="
          flex w-full items-center gap-3 rounded-2xl border border-white/10
          bg-[#111827] px-4 py-3 text-left transition
          hover:border-[#C8A96B]/40
          focus:outline-none focus:ring-2 focus:ring-[#C8A96B]/40
          disabled:cursor-not-allowed disabled:opacity-50
        "
      >
        <span className="shrink-0 rounded-lg bg-[#C8A96B]/15 px-2 py-1 text-[11px] font-bold tracking-wider text-[#C8A96B]">
          J{String(activo?.JORNADA ?? "--").padStart(2, "0")}
        </span>

        {activo?.EQUIPO && (
          <EscudoEquipo
            nombre={activo.EQUIPO}
            escudo={escudoDe(activo.EQUIPO)}
            lado={26}
          />
        )}

        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-white">
            {activo?.EQUIPO || "Selecciona un partido"}
          </span>

          <span className="block text-[11px] text-white/40">
            {fechaLarga(fechaDe(activo))}
          </span>
        </span>

        <ChevronDown
          size={16}
          className={`shrink-0 text-white/40 transition-transform ${
            abierto ? "rotate-180" : ""
          }`}
        />
      </button>

      {abierto && (
        <div
          role="listbox"
          className="
            absolute left-0 right-0 top-full z-40 mt-2 overflow-hidden
            rounded-2xl border border-white/10 bg-[#111827] shadow-2xl
          "
        >
          <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
            <Search size={15} className="shrink-0 text-white/35" />

            <input
              ref={inputBusqueda}
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar rival o jornada..."
              aria-label="Buscar partido"
              className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/30"
            />
          </div>

          <div className="max-h-[340px] overflow-y-auto py-1">
            {filtrados.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-white/35">
                Ningún partido coincide
              </p>
            )}

            {filtrados.map((r) => {
              const seleccionado = String(r.ID) === String(activo?.ID);

              return (
                <button
                  key={r.ID}
                  type="button"
                  role="option"
                  aria-selected={seleccionado}
                  onClick={() => {
                    onSelect(r);
                    setAbierto(false);
                  }}
                  className={`
                    flex w-full items-center gap-3 px-4 py-2.5 text-left transition
                    ${seleccionado ? "bg-[#C8A96B]/10" : "hover:bg-white/[0.04]"}
                  `}
                >
                  <span
                    className={`
                      w-9 shrink-0 rounded-lg px-1.5 py-1 text-center text-[11px] font-bold
                      ${
                        seleccionado
                          ? "bg-[#C8A96B] text-black"
                          : "bg-white/[0.06] text-white/50"
                      }
                    `}
                  >
                    {String(r.JORNADA ?? "--").padStart(2, "0")}
                  </span>

                  <EscudoEquipo
                    nombre={r.EQUIPO ?? ""}
                    escudo={escudoDe(r.EQUIPO ?? "")}
                    lado={22}
                  />

                  <span className="min-w-0 flex-1 truncate text-sm text-white">
                    {r.EQUIPO}
                  </span>

                  <span className="shrink-0 text-[11px] text-white/35">
                    {fechaCorta(fechaDe(r))}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| ANILLO DE PROGRESO
|--------------------------------------------------------------------------
*/

function AnilloProgreso({
  porcentaje,
  completados,
  total,
}: {
  porcentaje: number;
  completados: number;
  total: number;
}) {
  const radio = 30;

  const circunferencia = 2 * Math.PI * radio;

  return (
    <div className="flex items-center gap-4">
      <div className="relative h-[76px] w-[76px] shrink-0">
        <svg viewBox="0 0 76 76" className="h-full w-full -rotate-90">
          <circle
            cx="38"
            cy="38"
            r={radio}
            fill="none"
            /* En `style`, que sí resuelve la variable del tema: el blanco
               escrito como atributo desaparecía en modo día (19/10/2026). */
            style={{ stroke: "rgb(var(--rmcf-ink-rgb) / .1)" }}
            strokeWidth="6"
          />

          <circle
            cx="38"
            cy="38"
            r={radio}
            fill="none"
            stroke="#C8A96B"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circunferencia}
            strokeDashoffset={
              circunferencia - (circunferencia * porcentaje) / 100
            }
            className="transition-all duration-700"
          />
        </svg>

        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-base font-bold text-white">{porcentaje}%</span>
        </div>
      </div>

      <div>
        <p className="text-[10px] uppercase tracking-[0.18em] text-white/40">
          Informe preparado
        </p>

        <p className="mt-1 text-sm font-semibold text-white">
          {completados} de {total} bloques
        </p>

        <p className="mt-0.5 text-[11px] text-white/35">
          {total - completados === 0
            ? "Plan completo"
            : `${total - completados} pendientes`}
        </p>
      </div>
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| ESQUELETO DE CARGA
|--------------------------------------------------------------------------
*/

function Esqueleto() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-44 rounded-3xl border border-white/10 bg-white/[0.03]" />

      <div className="grid gap-6 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-56 rounded-2xl border border-white/10 bg-white/[0.03]"
          />
        ))}
      </div>

      <div className="h-80 rounded-3xl border border-white/10 bg-white/[0.03]" />
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| PÁGINA
|--------------------------------------------------------------------------
*/

/*
|--------------------------------------------------------------------------
| REPLICAR DE OTRA JORNADA
|--------------------------------------------------------------------------
| Un desplegable con las jornadas que tienen plan escrito. Elegir una copia
| sus textos en el partido abierto (lo hace la página, con confirmación).
*/
function ReplicarPlan({
  jornadas,
  onElegir,
}: {
  jornadas: { rival: Rival; apartados: number }[];
  onElegir: (rival: Rival) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const caja = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;

    const fuera = (e: MouseEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false);
    };

    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbierto(false);
    };

    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", escape);

    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("keydown", escape);
    };
  }, [abierto]);

  return (
    <div ref={caja} className="relative">
      <button
        type="button"
        onClick={() => setAbierto(!abierto)}
        disabled={jornadas.length === 0}
        aria-expanded={abierto}
        title={
          jornadas.length === 0
            ? "Todavía no hay otra jornada con plan escrito"
            : "Copiar el plan de otra jornada en ésta y editarlo desde ahí"
        }
        className="
          flex items-center gap-2 rounded-xl border border-white/10
          bg-white/[0.03] px-3.5 py-2.5 text-sm text-white/70 transition
          hover:border-white/25 hover:text-white
          disabled:cursor-not-allowed disabled:opacity-40
        "
      >
        <Copy size={15} />

        <span className="md:hidden">Replicar</span>
        <span className="hidden md:inline">Replicar de otra jornada</span>
      </button>

      {abierto && (
        <div className="absolute right-0 top-full z-40 mt-2 max-h-80 w-[min(20rem,calc(100vw-2rem))] overflow-y-auto rounded-xl border border-white/10 bg-[#11161C] p-1 shadow-2xl">
          <p className="px-3 py-2 text-[10px] uppercase tracking-[0.16em] text-white/40">
            Copiar el plan de…
          </p>

          {jornadas.map(({ rival, apartados }) => (
            <button
              key={String(rival.ID)}
              type="button"
              onClick={() => {
                setAbierto(false);
                onElegir(rival);
              }}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-white/[0.05]"
            >
              <span className="w-8 shrink-0 text-xs font-semibold tabular-nums text-[#C8A96B]">
                J{String(rival.JORNADA ?? "--").padStart(2, "0")}
              </span>

              <span className="min-w-0 flex-1 truncate text-sm text-white/85">
                {rival.EQUIPO}
              </span>

              <span className="shrink-0 text-[11px] tabular-nums text-white/40">
                {apartados}/{CAMPOS_REPLICABLES.length}
              </span>
            </button>
          ))}

          <p className="px-3 py-2 text-[11px] leading-relaxed text-white/35">
            Se copian los textos del plan; los vídeos, el informe, la fecha y
            el campo se quedan los de este partido.
          </p>
        </div>
      )}
    </div>
  );
}

export default function MatchPreparation() {
  const [rivales, setRivales] = useState<Rival[]>([]);
  /* Sólo para repintar cuando llega el calendario de BeSoccer. */
  const [, setCalendarioListo] = useState(0);

  useEffect(() => {
    let vivo = true;

    void cargaOrdenRivales().then((orden) => {
      if (!vivo) return;

      for (const partido of orden.partidos) {
        if (partido.fecha && partido.jornada) FECHAS_REALES.set(`${partido.equipo}|${partido.jornada}`, partido.fecha);
      }

      setCalendarioListo((n) => n + 1);
    });

    return () => {
      vivo = false;
    };
  }, []);
  const [rivalActivo, setRivalActivo] = useState<Rival | null>(null);

  const [modoEdicion, setModoEdicion] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seccionActiva, setSeccionActiva] = useState("contexto");

  /* El escudo del club, que la hoja no trae: ver `hooks/useEscudos`. */
  const escudoDeRival = useEscudos();

  /* La hoja de destino descarta en silencio los campos sin columna propia,
     así que el guardado se comprueba releyendo antes de cerrar la edición. */
  const {
    verificar: verificarGuardado,
    dialogo: avisoGuardado,
    columnasPerdidas,
  } = useSaveGuard();

  /* ---------------------------------------------------------------- CARGA */

  /* `recargas` fuerza un nuevo fetch; `idPreferido` conserva el partido
     abierto tras un reintento. */
  const [recargas, setRecargas] = useState(0);

  const idPreferido = useRef<string | undefined>(undefined);

  const recargar = useCallback((id?: string) => {
    idPreferido.current = id;

    setRecargas((valor) => valor + 1);
  }, []);

  /* Si se está editando cuando llega la hoja al día, no se pisa lo escrito. */
  const editandoAhora = useRef(false);

  useEffect(() => {
    editandoAhora.current = modoEdicion;
  }, [modoEdicion]);

  /*
  | Cuándo empezó y cuándo se verificó el último guardado (ms). La relectura
  | al día de la carga tarda lo suyo y puede volver DESPUÉS de cerrar la
  | edición con la fila de antes de guardar: con `editandoAhora` ya en falso,
  | pisaba lo recién escrito. Si ha habido un guardado desde que salió —o hay
  | uno en marcha—, se descarta.
  */
  const ultimoGuardadoVerificado = useRef(0);

  /*
  | LA CARGA, EN DOS TIEMPOS
  |
  | Antes se pedía al Apps Script directamente y sin caché: 30-70 segundos en
  | frío cada vez que se entraba, y a veces ni eso («No se han podido cargar
  | los partidos»). Ahora se abre con la copia de `/api/rivals` —memoria del
  | servidor o Supabase, décimas de segundo; con `rancia=1`, aunque sea de
  | antes del último guardado— y por detrás se pide la hoja al
  | día (`fresco=1`). Cuando llega, se cambia en silencio; si para entonces
  | ya se está editando y la fila abierta había cambiado en la hoja, se avisa
  | en vez de pisar nada.
  */
  useEffect(() => {
    let cancelado = false;

    const ordena = (data: unknown) => {
      const lista: Rival[] = Array.isArray(data) ? (data as Rival[]) : [];

      return lista.sort(
        (a, b) => Number(a?.JORNADA ?? 0) - Number(b?.JORNADA ?? 0)
      );
    };

    async function alDia(copia: Rival[]) {
      const empezo = Date.now();

      try {
        const res = await fetch("/api/rivals?action=rivales&fresco=1", {
          cache: "no-store",
        });

        if (!res.ok) return;

        const nueva = ordena(await res.json());

        if (cancelado || nueva.length === 0) return;

        /* Se guardó algo mientras volaba: esto puede ser la hoja de antes. */
        if (ultimoGuardadoVerificado.current > empezo) return;

        setRivales(nueva);

        setRivalActivo((previo) => {
          if (!previo) return previo;

          const suya = nueva.find((r) => String(r.ID) === String(previo.ID));

          if (!suya) return previo;

          if (!editandoAhora.current) return suya;

          const deAntes = copia.find((r) => String(r.ID) === String(previo.ID));

          if (JSON.stringify(deAntes) !== JSON.stringify(suya)) {
            toast.warning(
              "Este plan había cambiado en la hoja mientras abrías la edición. Revisa que no falte nada de lo último antes de seguir."
            );
          }

          return previo;
        });
      } catch {
        /* Sin la hoja al día se queda la copia, que es lo que ya se ve. */
      }
    }

    async function cargarRivales() {
      setCargando(true);
      setError(null);

      try {
        const data = await traeJson("/api/rivals?action=rivales&rancia=1", {
          forzar: recargas > 0,
        });

        if (cancelado) return;

        const lista = ordena(data);

        void alDia(lista);

        setRivales(lista);

        /* Por defecto abrimos el próximo partido, no el primero de la lista. */
        const proximo =
          lista.find((r) => {
            const dias = diasHasta(fechaDe(r));

            return dias !== null && dias >= 0;
          }) ?? lista[lista.length - 1];

        /* Enlace directo desde el análisis del rival:
           /match-preparation?rival=<ID>. Manda sobre el próximo partido, pero
           no sobre el partido que se estuviera viendo antes de un reintento. */
        const enlazado = new URLSearchParams(window.location.search).get(
          "rival"
        );

        const buscado = idPreferido.current ?? enlazado ?? undefined;

        const elegido =
          lista.find((r) => String(r.ID) === String(buscado)) ?? proximo ?? null;

        /* El `?rival=` se queda en la barra y se mantiene al día (ver el
           efecto de abajo): un plan se puede guardar en marcadores y mandar. */
        setRivalActivo(elegido ?? null);
          } catch (e) {
        if (cancelado) return;

        console.error("Error cargando rivales:", e);

        setRivales([]);

        setError(
          "No se han podido cargar los partidos. Comprueba la conexión e inténtalo de nuevo."
        );
      } finally {
        if (!cancelado) setCargando(false);
      }
    }

    cargarRivales();

    return () => {
      cancelado = true;
    };
  }, [recargas]);

  /*
  | LA URL DICE QUÉ PARTIDO SE ESTÁ VIENDO (11/10/2026).
  |
  | Hasta ahora el `?rival=<ID>` con el que llegaba el enlace del scouting se
  | borraba nada más abrir, así que un plan no tenía dirección: no se podía
  | guardar en marcadores ni pegar en un mensaje. Ahora la barra sigue al
  | partido elegido, con `replaceState` para no apilar un paso del historial
  | por cada cambio de rival. Se conserva `history.state`: Next guarda ahí
  | el árbol de la ruta.
  */
  const idActivo = String(rivalActivo?.ID ?? "").trim();

  useEffect(() => {
    if (!idActivo) return;

    const url = new URL(window.location.href);

    if (url.searchParams.get("rival") === idActivo) return;

    url.searchParams.set("rival", idActivo);

    window.history.replaceState(window.history.state, "", url);
  }, [idActivo]);

  /* --------------------------------------------------------------- ESTADO */

  const setCampo = useCallback((campo: string, valor: string) => {
    setRivalActivo((previo) =>
      previo ? { ...previo, [campo]: valor } : previo
    );
  }, []);

  const completados = useMemo(
    () => CAMPOS_PLAN.filter((campo) => relleno(rivalActivo?.[campo])).length,
    [rivalActivo]
  );

  const porcentaje = Math.round((completados / CAMPOS_PLAN.length) * 100);

  const indiceActual = useMemo(
    () => rivales.findIndex((r) => String(r.ID) === String(rivalActivo?.ID)),
    [rivales, rivalActivo]
  );

  const dias = diasHasta(fechaDe(rivalActivo));

  const cuentaAtras = etiquetaCuentaAtras(dias);

  /* Los duelos de más ventaja y de más riesgo de /duelos, con jugador y cifra. */
  const duelosClave = useDuelosClave(rivalActivo?.EQUIPO ?? "");
  /* `/duelos` se abre con el mismo rival que este plan, no con el próximo. */
  const enlaceDuelos = rivalActivo?.EQUIPO ? `/duelos?equipo=${encodeURIComponent(rivalActivo.EQUIPO)}` : "/duelos";
  const contraste = useContrasteRival(rivalActivo?.EQUIPO ?? "");

  const recursosDisponibles = [
    rivalActivo?.HUDL_PLAYLIST,
    rivalActivo?.HUDL_PARTIDO,
    rivalActivo?.HUDL_ANALISIS,
    rivalActivo?.DOC,
  ].filter(relleno).length;

  /* ------------------------------------------------------------- ACCIONES */

  /* Puente hacia el `flush` del autoguardado, que se declara más abajo. Dice
     si lo pendiente ha llegado a la hoja. */
  const flushPendiente = useRef<() => Promise<boolean>>(async () => true);

  /* Hay un archivo subiéndose a los recursos de este rival (ver `RecursosRival`). */
  const subiendoRecursos = useRef(false);

  const seleccionarRival = useCallback((rival: Rival) => {
    /*
    | A media subida no se cambia (07/10/2026): el archivo llegaría al bucket
    | pero no a la lista del rival, que se desmonta con el cambio.
    */
    if (subiendoRecursos.current) {
      toast.warning("Espera a que termine la subida", {
        description:
          "Se está subiendo un archivo a los recursos de este rival. En cuanto acabe, puedes cambiar.",
      });

      return;
    }

    /* Con el retardo del autoguardado a medias, cambiar de partido se llevaría
       por delante lo último escrito: primero se consolida. */
    void flushPendiente.current().then((guardado) => {
      /*
      | Y si no ha llegado a la hoja, no se cambia (07/10/2026), igual que en
      | el informe de scouting. Cambiar era darlo por perdido: el autoguardado
      | toma el partido nuevo como base y lo que fallaba del anterior ya no lo
      | reintentaba nadie.
      */
      if (!guardado) {
        toast.error("No se ha podido guardar el plan de este partido", {
          description:
            "No se cambia de partido hasta que llegue a la hoja: se sigue reintentando solo. Si no hay conexión, espera a que vuelva.",
        });

        return;
      }

      setRivalActivo(rival);
    });
  }, []);

  const navegar = useCallback(
    (paso: number) => {
      if (indiceActual < 0) return;

      const destino = rivales[indiceActual + paso];

      if (destino) seleccionarRival(destino);
    },
    [indiceActual, rivales, seleccionarRival]
  );

  /*
  | Foto del plan al entrar en edición.
  |
  | No vale comparar con la última versión guardada: el autoguardado la va
  | adelantando a cada escritura, así que al pulsar «Deshacer» ya sería
  | idéntica a lo que hay en pantalla y el botón no haría nada. Ésta se queda
  | quieta desde que se abre la edición.
  */
  const [alEntrar, setAlEntrar] = useState<Rival | null>(null);

  const entrarEnEdicion = useCallback(() => {
    setAlEntrar(rivalActivo);
    setModoEdicion(true);
  }, [rivalActivo]);

  const hayCambiosDeSesion =
    modoEdicion && JSON.stringify(rivalActivo) !== JSON.stringify(alEntrar);

  /*
  | Deshacer con autoguardado no es «no guardar»: lo escrito ya está en la
  | hoja. Lo que se hace es devolver la fila a como estaba al entrar en
  | edición y dejar que el autoguardado escriba de vuelta esa versión.
  */
  const deshacerCambios = useCallback(() => {
    if (!hayCambiosDeSesion) {
      setModoEdicion(false);
      return;
    }

    if (
      !window.confirm(
        "¿Devolver el plan a como estaba al entrar en edición? Lo escrito desde entonces ya se ha guardado, así que esto lo revierte también en la hoja."
      )
    ) {
      return;
    }

    setRivalActivo(alEntrar);

    toast.info("Cambios deshechos");
  }, [alEntrar, hayCambiosDeSesion]);

  /*
  | REPLICAR EL PLAN DE OTRA JORNADA
  |
  | Se parte de un plan ya hecho y se retoca. Copia los textos encima de este
  | partido, abre la edición y deja que el autoguardado lo escriba en la hoja
  | como cualquier otro cambio. «Deshacer» vuelve a como estaba antes de
  | copiar, porque la foto de entrada se toma justo antes.
  */
  const replicarDe = useCallback(
    (origen: Rival) => {
      if (!rivalActivo) return;

      const conTexto = CAMPOS_REPLICABLES.filter((c) => relleno(rivalActivo[c]));

      if (
        conTexto.length > 0 &&
        !window.confirm(
          `Este plan ya tiene ${conTexto.length} ${conTexto.length === 1 ? "apartado escrito" : "apartados escritos"}. ¿Sustituirlos por los de la jornada ${origen.JORNADA ?? "-"} (${origen.EQUIPO ?? ""})? Podrás deshacerlo.`
        )
      ) {
        return;
      }

      const copiado: Rival = { ...rivalActivo };

      for (const campo of CAMPOS_REPLICABLES) copiado[campo] = String(origen[campo] ?? "");

      if (!modoEdicion) setAlEntrar(rivalActivo);

      setRivalActivo(copiado);
      setModoEdicion(true);

      toast.success(
        `Plan de la jornada ${origen.JORNADA ?? "-"} copiado. Edítalo: se guarda solo.`
      );
    },
    [modoEdicion, rivalActivo]
  );

  /*
  |--------------------------------------------------------------------------
  | PROPONER BOCETO (11/10/2026)
  |
  | Como replicar, pero con criterio: el plan de la jornada anterior entra
  | línea a línea con «?» donde los datos del rival que viene (y los nuestros)
  | dicen que puede cambiar, y «*» en lo que proponen incorporar. El motor es
  | `lib/plan-partido/boceto.ts`; aquí sólo se abre el diálogo y se aplica lo
  | que vuelve, igual que una réplica: edición abierta, autoguardado y
  | «Deshacer» a la foto de antes.
  */
  const [bocetoAbierto, setBocetoAbierto] = useState(false);

  /* Sube cada vez que se guardan unos porqués nuevos: es la `key` de su sección. */
  const [versionMotivos, setVersionMotivos] = useState(0);

  const aplicaBoceto = useCallback(
    (campos: Record<string, string>, boceto: BocetoPlan) => {
      if (!rivalActivo) return;

      if (!modoEdicion) setAlEntrar(rivalActivo);

      setRivalActivo({ ...rivalActivo, ...campos });
      setModoEdicion(true);
      setBocetoAbierto(false);

      /* Los porqués, aparte del plan: los lee la sección plegada del pie
         (`PorQueDelBoceto`), sólo con sesión de administrador. */
      void fetch("/api/docs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          key: claveMotivosPlan(String(rivalActivo.ID ?? "")),
          kind: KIND_MOTIVOS_PLAN,
          data: {
            generadoEn: new Date().toISOString(),
            origen: boceto.anterior,
            rival: boceto.rival,
            fuentes: boceto.fuentes,
            campos: boceto.campos,
          },
        }),
      })
        /* Al llegar, se vuelve a montar la sección del pie para que los lea:
           `useRemoteDoc` no relee solo y se quedaban los del boceto anterior
           (o ninguno) hasta recargar la página (19/10/2026). */
        .then(() => setVersionMotivos((n) => n + 1))
        .catch(() => {});

      toast.success("Boceto aplicado: «?» a valorar cambiar, «*» a valorar incorporar. Los porqués, abajo del todo. Edítalo: se guarda solo.");
    },
    [modoEdicion, rivalActivo]
  );

  /* Las otras jornadas que tienen algo que copiar, la más reciente primero. */
  const jornadasReplicables = useMemo(
    () =>
      rivales
        .filter((r) => String(r.ID) !== String(rivalActivo?.ID))
        .map((r) => ({
          rival: r,
          apartados: CAMPOS_REPLICABLES.filter((c) => relleno(r[c])).length,
        }))
        .filter((r) => r.apartados > 0)
        .reverse(),
    [rivales, rivalActivo?.ID]
  );

  /*
  |--------------------------------------------------------------------------
  | AUTOGUARDADO
  |--------------------------------------------------------------------------
  |
  | El plan se escribe la noche antes del partido y en varias sentadas. Ya no
  | depende de que alguien se acuerde de pulsar «Guardar»: en cuanto se deja
  | de escribir, sale hacia la hoja.
  |
  | Lo que no cambia es la desconfianza: la hoja escribe por nombre de columna
  | y descarta en silencio lo que no tiene cabecera, así que cada envío se
  | verifica releyendo la fila. Con `modoAuto`, el aviso a pantalla completa
  | sale una vez por columna nueva y después vive en la banda roja de arriba.
  */

  /*
  | La base contra la que se mira qué campos ha tocado el usuario (07/10/2026):
  | la fila tal y como se cargó —o como se ve fuera de edición— y, después,
  | lo último que llegó a la hoja. En edición sólo la mueve un guardado bueno
  | o el cambio de partido (ver el efecto tras `useAutoSave`).
  */
  const baseGuardado = useRef<Rival | null>(rivalActivo);

  const guardarEnLaHoja = useCallback(
    async (rival: Rival | null) => {
      if (!rival) return true;

      /* Una escritura que empieza también invalida la relectura en vuelo:
         puede volver antes de que ésta termine, con la fila de antes. */
      ultimoGuardadoVerificado.current = Date.now();

      /*
      | SÓLO LO QUE SE EDITA AQUÍ. La fila la comparte el informe de scouting
      | colectivo, que escribe con la misma acción: mandar la fila tal y como
      | se leyó al abrir devolvía a la hoja el informe de ESE momento y borraba
      | lo escrito allí desde entonces. Se relee la fila justo antes y encima
      | van sólo los campos del plan. Sin relectura no se escribe: el
      | autoguardado reintenta.
      */
      const filas = await leeRivales();

      const fresca = filas.find((r) => String(r.ID) === String(rival.ID));

      /*
      | Y de esos, sólo los que han cambiado respecto a la base (07/10/2026):
      | lo cargado o lo último que llegó a la hoja. Mandar los quince campos
      | del plan devolvía a la hoja los que no se habían tocado tal y como se
      | leyeron al abrir, encima de lo que otro hubiera escrito en ellos.
      */
      const base = baseGuardado.current;
      const mismaBase = String(base?.ID ?? "") === String(rival.ID ?? "");

      const editados: Rival = { ID: String(rival.ID ?? "") };

      for (const campo of CAMPOS_DE_ESTA_PANTALLA) {
        if (!(campo in rival)) continue;

        const valor = String(rival[campo] ?? "");

        if (mismaBase && fresca && valor === String(base?.[campo] ?? "")) continue;

        editados[campo] = valor;
      }

      const aMandar: Rival = fresca
        ? { ...fresca, ...editados, ID: String(rival.ID ?? "") }
        : rival;

      /* En JSON, no como formulario: el `doPost` de la hoja pasa el cuerpo por
         `JSON.parse` y un formulario se estrella antes de guardar nada
         (`lib/hojaRivales.ts`). */
      await guardaEnLaHoja("guardarRival", aMandar);

      const verificacion = await verificarGuardado({
        titulo: `Plan de partido · ${rival.EQUIPO ?? ""} · Jornada ${
          rival.JORNADA ?? "-"
        }`,
        /* Se comprueba lo que es de esta pantalla: el resto es de la hoja. */
        enviado: editados,
        registro: rival,
        ignorar: ["FECHA"],
        modoAuto: true,
        releer: async () => {
          try {
            const filas = await leeRivales();

            return filas.find((r) => String(r.ID) === String(rival.ID)) ?? null;
          } catch {
            /* Con autoguardado una relectura fallida no avisa: pasa en
               cualquier corte de red y el siguiente intento lo resuelve. */
            return null;
          }
        },
      });

      /*
      | Una columna que la hoja no tiene no va a aparecer en el intento
      | siguiente (07/10/2026): devolver `false` hacía que el autoguardado
      | reescribiera la fila sin fin. Si el envío llegó y sólo faltan columnas,
      | está guardado todo lo que se puede guardar; la pérdida se sigue
      | enseñando en la banda roja de la cabecera (`columnasPerdidas`). Igual
      | que en el informe de scouting.
      */
      const soloColumnas =
        !verificacion.ok &&
        verificacion.perdidos.every((p) => p.motivo === "columna-inexistente");

      const bueno = verificacion.ok || soloColumnas;

      if (bueno) {
        ultimoGuardadoVerificado.current = Date.now();

        /* Lo enviado pasa a ser la base, salvo que mientras volaba se haya
           cambiado de partido. */
        if (String(baseGuardado.current?.ID ?? "") === String(rival.ID ?? "")) {
          baseGuardado.current = rival;
        }

        setRivales((previo) =>
          previo.map((r) => (String(r.ID) === String(rival.ID) ? aMandar : r))
        );
      }

      return bueno;
    },
    [verificarGuardado]
  );

  /* Si el último guardado llegó a la hoja. Lo lee `seleccionarRival` tras el
     `flush`: el estado del hook todavía no se ha repintado en ese momento. */
  const ultimoGuardadoOk = useRef(true);

  const guardarYAnotar = useCallback(
    async (rival: Rival | null) => {
      try {
        const bueno = await guardarEnLaHoja(rival);

        ultimoGuardadoOk.current = bueno;

        return bueno;
      } catch (error) {
        ultimoGuardadoOk.current = false;

        throw error;
      }
    },
    [guardarEnLaHoja]
  );

  const auto = useAutoSave<Rival | null>({
    value: rivalActivo,
    enabled: modoEdicion,
    debounce: 1800,
    save: guardarYAnotar,
    /* Una copia por partido: lo pendiente del Águilas no puede salir al abrir
       el Teruel. Sin `ID` no hay respaldo, que es lo correcto: no se sabría a
       qué fila devolverlo. */
    respaldo: rivalActivo?.ID ? `match-prep:${rivalActivo.ID}` : undefined,
  });

  const { flush: flushAuto, pending: hayPendiente } = auto;

  /* Fuera de edición lo que se ve es la base, salvo que quede algo sin llegar
     a la hoja: entonces la base sigue siendo la de antes y el reintento manda
     lo que falta. */
  useEffect(() => {
    const otroPartido =
      String(baseGuardado.current?.ID ?? "") !== String(rivalActivo?.ID ?? "");

    if (otroPartido || (!modoEdicion && !hayPendiente)) {
      baseGuardado.current = rivalActivo;
    }
  }, [modoEdicion, rivalActivo, hayPendiente]);

  useEffect(() => {
    flushPendiente.current = async () => {
      /* Si no hay nada pendiente, `flush` no llega a guardar y esto se queda
         en `true`, que es lo que es. */
      ultimoGuardadoOk.current = true;

      await flushAuto();

      return ultimoGuardadoOk.current;
    };
  }, [flushAuto]);

  /*
  |--------------------------------------------------------------------------
  | RECUPERAR LO QUE NO LLEGÓ A LA HOJA
  |--------------------------------------------------------------------------
  |
  | El respaldo de `useAutoSave` se compara con la fila que sirve la hoja: sólo
  | se ofrece si de verdad dice algo distinto. Un respaldo que ya se guardó
  | —se cerró la pestaña justo después de que el servidor contestara— no tiene
  | por qué molestar a nadie.
  */
  const camposRecuperados = useMemo(() => {
    const copia = auto.recuperado?.valor;

    if (!copia || !rivalActivo) return 0;

    if (String(copia.ID ?? "") !== String(rivalActivo.ID ?? "")) return 0;

    return Object.keys({ ...rivalActivo, ...copia }).filter(
      (campo) =>
        campo !== "FECHA" &&
        String(copia[campo] ?? "") !== String(rivalActivo[campo] ?? ""),
    ).length;
  }, [auto.recuperado, rivalActivo]);

  const hayQueRecuperar = camposRecuperados > 0 && !modoEdicion;

  const fechaRecuperado = useMemo(() => {
    const cuando = auto.recuperado?.fecha;

    if (!cuando) return "en otro momento";

    const fecha = new Date(cuando);

    return Number.isNaN(fecha.getTime())
      ? "en otro momento"
      : `el ${fecha.toLocaleDateString("es-ES", {
          day: "numeric",
          month: "long",
        })} a las ${fecha.toLocaleTimeString("es-ES", {
          hour: "2-digit",
          minute: "2-digit",
        })}`;
  }, [auto.recuperado]);

  /*
  | Recuperar es poner el texto en pantalla y **abrir la edición**: así el
  | autoguardado lo manda a la hoja como cualquier otro cambio —con su
  | verificación releyendo— y de paso queda a la vista antes de escribirse. El
  | respaldo se tira ya: a partir de aquí el que manda es el autoguardado.
  */
  const recuperarPendiente = useCallback(() => {
    const copia = auto.recuperado?.valor;

    if (!copia) return;

    setRivalActivo(copia);
    setAlEntrar(rivalActivo);
    setModoEdicion(true);

    auto.descartaRecuperado();

    toast.success("Recuperado lo que no se había guardado. Revísalo: se está escribiendo en la hoja.");
  }, [auto, rivalActivo]);

  /* Cambiar de partido no es una edición del usuario: nueva base y a otra cosa. */
  const idRivalActivo = String(rivalActivo?.ID ?? "");
  const idAnterior = useRef(idRivalActivo);

  useEffect(() => {
    if (idAnterior.current === idRivalActivo) return;

    idAnterior.current = idRivalActivo;

    auto.sync();
  }, [idRivalActivo, auto]);

  const terminarEdicion = useCallback(async () => {
    setGuardando(true);

    try {
      await auto.flush();
    } finally {
      setGuardando(false);
    }

    setModoEdicion(false);
  }, [auto]);

  /* Columnas de la hoja que se pintan dentro de la lista de recursos. */
  const recursosFijos = useMemo<RecursoFijo[]>(
    () => [
      {
        campo: "HUDL_PLAYLIST",
        nombre: "HUDL · Playlist",
        tipo: "video",
        url: String(rivalActivo?.HUDL_PLAYLIST ?? ""),
      },
      {
        campo: "HUDL_PARTIDO",
        nombre: "HUDL · Partido completo",
        tipo: "video",
        url: String(rivalActivo?.HUDL_PARTIDO ?? ""),
      },
      {
        campo: "HUDL_ANALISIS",
        nombre: "HUDL · Análisis",
        tipo: "video",
        url: String(rivalActivo?.HUDL_ANALISIS ?? ""),
      },
      {
        campo: "DOC",
        nombre: "Informe del rival",
        tipo: "doc",
        url: String(rivalActivo?.DOC ?? ""),
      },
    ],
    [rivalActivo]
  );

  /* --------------------------------------------------------------- ATAJOS */

  useEffect(() => {
    const atajos = (evento: KeyboardEvent) => {
      const conModificador = evento.ctrlKey || evento.metaKey;

      if (!conModificador) return;

      const tecla = evento.key.toLowerCase();

      /* Ctrl+S ya no es «guarda esto»: el plan se guarda solo. Es «cierra la
         edición», que es lo que el dedo quiere decir al pulsarlo. */
      if (tecla === "s" && modoEdicion) {
        evento.preventDefault();

        void terminarEdicion();
      }

      if (tecla === "e" && !modoEdicion) {
        evento.preventDefault();

        entrarEnEdicion();
      }
    };

    window.addEventListener("keydown", atajos);

    return () => window.removeEventListener("keydown", atajos);
  }, [modoEdicion, terminarEdicion, entrarEnEdicion]);

  /* El aviso de «tienes cosas sin guardar» al cerrar la pestaña lo pone ya
     `useAutoSave`, que además intenta un último envío. */

  /* Sección visible para resaltar el índice de navegación. */
  useEffect(() => {
    if (cargando || !rivalActivo) return;

    const observador = new IntersectionObserver(
      (entradas) => {
        const visible = entradas
          .filter((e) => e.isIntersecting)
          .sort(
            (a, b) => a.boundingClientRect.top - b.boundingClientRect.top
          )[0];

        if (visible) setSeccionActiva(visible.target.id);
      },
      { rootMargin: "-25% 0px -65% 0px" }
    );

    SECCIONES.forEach(({ id }) => {
      const el = document.getElementById(id);

      if (el) observador.observe(el);
    });

    return () => observador.disconnect();
  }, [cargando, rivalActivo]);

  /* La pestaña activa se centra en la tira (29/10/2026): en el móvil la tira se corta y la activa quedaba fuera. */
  useEffect(() => {
    document
      .querySelector('nav[aria-label="Secciones del plan"] [data-activa="true"]')
      ?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [seccionActiva]);

  const irASeccion = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ block: "start" });
  };

  const editando = modoEdicion;

  /* En lectura, una sección sin nada escrito no sale (ni su título). */
  const hayEnLectura = (...campos: string[]) =>
    editando || campos.some((campo) => relleno(rivalActivo?.[campo]));

  const seccionVisible = (id: string) =>
    id === "plan"
      ? hayEnLectura("ATAQUE", "DEFENSA", "ABP_OF", "ABP_DEF")
      : id === "duelos"
        ? hayEnLectura("DUELOS_CB_FAVOR", "DUELOS_CB_CONTRA", "DUELOS_SB_FAVOR", "DUELOS_SB_CONTRA") || duelosClave !== null
        : id === "rival"
          ? hayEnLectura("FORTALEZAS", "DEBILIDADES", "ESTRUCTURA_OF", "ESTRUCTURA_DEF")
          : true;

  /* ---------------------------------------------------------------- VISTA */

  return (
    <div className="flex min-h-screen bg-[#0B0F14] text-white">
      <Sidebar />

      <main className="min-w-0 flex-1">
        <Topbar />

        <div className="mp-print-area px-4 pb-28 pt-6 md:px-10 md:pb-16">
          {/* CABECERA */}
          <header className="mp-page-title mb-6">
            <p className="text-[10px] uppercase tracking-[0.3em] text-[#C8A96B] md:text-xs">
              RMCF Castilla · Metodología
            </p>

            <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">
              Plan de Partido
            </h1>

            <p className="mt-2 text-sm text-white/50">
              Estrategia operativa de la jornada: contexto, plan de juego,
              duelos y recursos de vídeo.
            </p>
          </header>

          {/* En una línea, lo que dicen los datos del cruce de onces; el detalle está en «Duelos» y en /duelos. */}
          {duelosClave && !editando && (duelosClave.ventaja.length > 0 || duelosClave.riesgo.length > 0) && (
            <div className="mp-no-print -mt-3 mb-5 flex min-w-0 flex-wrap items-center gap-x-5 gap-y-1.5 rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-2.5 text-[13px] text-white/75">
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">Los duelos, en una línea</span>
              <span className="min-w-0 tabular-nums text-white/60">
                {fraseRecuentoDuelos(duelosClave.medidos, duelosClave.conVentajaNuestra, duelosClave.conVentajaSuya, duelosClave.enLosDos)}
              </span>
              {duelosClave.ventaja[0] && duelosClave.riesgo[0] && duelosClave.ventaja[0].clave === duelosClave.riesgo[0].clave ? (
                <span className="min-w-0">
                  <b className="text-white/85">En los dos sentidos</b>: {duelosClave.ventaja[0].titulo} ({duelosClave.ventaja[0].nuestros.join(" y ")} contra {duelosClave.ventaja[0].suyos.join(" y ")}):{" "}
                  <span className="text-emerald-300">+{duelosClave.ventaja[0].valor}</span> <span className="text-white/45">con balón nuestro</span> ·{" "}
                  <span className="text-rose-300">{duelosClave.riesgo[0].valor > 0 ? "+" : ""}{duelosClave.riesgo[0].valor}</span> <span className="text-white/45">con el suyo</span>
                </span>
              ) : (
                <>
              {duelosClave.ventaja[0] && (
                <span className="min-w-0">
                  <b className="text-emerald-300">Buscar</b> <span className="text-white/45">(con balón nuestro)</span>: {duelosClave.ventaja[0].titulo} ({duelosClave.ventaja[0].nuestros.join(" y ")}, +{duelosClave.ventaja[0].valor})
                </span>
              )}
              {duelosClave.riesgo[0] && (
                <span className="min-w-0">
                  <b className="text-rose-300">Vigilar</b> <span className="text-white/45">(con balón suyo)</span>: {duelosClave.riesgo[0].titulo} ({duelosClave.riesgo[0].suyos.join(" y ")}, {duelosClave.riesgo[0].valor > 0 ? "+" : ""}{duelosClave.riesgo[0].valor})
                </span>
              )}
                </>
              )}
              <Link href={enlaceDuelos} className="ml-auto shrink-0 text-xs text-[#C8A96B] hover:underline">
                Ver todos los duelos
              </Link>
            </div>
          )}

          {/* BARRA DE CONTROL */}
          <div className="mp-no-print sticky top-[81px] z-20 -mx-4 mb-6 border-b border-white/10 bg-[#0B0F14]/90 px-4 py-3 backdrop-blur-xl md:top-[97px] md:-mx-10 md:px-10">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              {/* Selector de partido */}
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <button
                  type="button"
                  onClick={() => navegar(-1)}
                  disabled={editando || indiceActual <= 0}
                  aria-label="Partido anterior"
                  title="Partido anterior"
                  className="
                    shrink-0 rounded-xl border border-white/10 bg-white/[0.03] p-2.5
                    text-white/70 transition hover:border-white/25 hover:text-white
                    disabled:cursor-not-allowed disabled:opacity-25
                  "
                >
                  <ChevronLeft size={16} />
                </button>

                <RivalPicker
                  rivales={rivales}
                  activo={rivalActivo}
                  onSelect={seleccionarRival}
                  bloqueado={editando}
                />

                <button
                  type="button"
                  onClick={() => navegar(1)}
                  disabled={
                    editando ||
                    indiceActual < 0 ||
                    indiceActual >= rivales.length - 1
                  }
                  aria-label="Partido siguiente"
                  title="Partido siguiente"
                  className="
                    shrink-0 rounded-xl border border-white/10 bg-white/[0.03] p-2.5
                    text-white/70 transition hover:border-white/25 hover:text-white
                    disabled:cursor-not-allowed disabled:opacity-25
                  "
                >
                  <ChevronRight size={16} />
                </button>
              </div>

              {/* Acciones: en el móvil, con rótulo, no caben en una fila y bajan. */}
              <div className="flex flex-wrap items-center gap-2">
                {/* El estado del autoguardado ya se pinta al lado de «Hecho»;
                    esta chapa sólo tiene sentido fuera de la edición, cuando
                    algo se ha quedado sin escribir en la hoja. */}
                {!editando && auto.pending && (
                  <span className="hidden items-center gap-1.5 rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-[11px] font-medium text-amber-300 sm:flex">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
                    Sin guardar
                  </span>
                )}

                {/* Los enlaces del plan y la impresión, juntos: ocho botones en fila no caben (23/10/2026). */}
                {rivalActivo && (
                  <details className="mp-no-print group relative">
                    <summary
                      className="
                        flex cursor-pointer list-none items-center gap-2 rounded-xl border
                        border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm text-white/70
                        transition hover:border-white/25 hover:text-white
                        [&::-webkit-details-marker]:hidden
                      "
                    >
                      <Binoculars size={15} />

                      <span>Informe</span>

                      <ChevronDown size={13} className="transition group-open:rotate-180" />
                    </summary>

                    <div className="absolute right-0 top-full z-30 mt-2 w-60 space-y-1 rounded-xl border border-white/10 bg-[#0B0F14] p-1.5 shadow-xl">
                      <Link
                        href={enlaceAnalisisRival(rivalActivo)}
                        title="Abrir el informe completo del rival"
                        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-white/75 transition hover:bg-white/[0.06] hover:text-white"
                      >
                        <Binoculars size={14} />
                        Scout Colectivo
                      </Link>

                      <Link
                        href={enlacePizarraAbp(rivalActivo)}
                        title="Abrir la pizarra de balón parado de este partido"
                        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-white/75 transition hover:bg-white/[0.06] hover:text-white"
                      >
                        <Flame size={14} />
                        Pizarra ABP
                      </Link>

                      {!editando && (
                        <button
                          type="button"
                          onClick={() => window.print()}
                          title="Imprimir o exportar a PDF"
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-white/75 transition hover:bg-white/[0.06] hover:text-white"
                        >
                          <Printer size={14} />
                          Imprimir o PDF
                        </button>
                      )}
                    </div>
                  </details>
                )}

                {!cargando && rivalActivo && (
                  <>
                    {/* En el móvil, Boceto y Replicar van en un menú «Más» y sólo «Informe» y «Editar» quedan a la vista (29/10/2026). */}
                    <div className="hidden items-center gap-2 md:flex">
                    <button
                      type="button"
                      onClick={() => setBocetoAbierto(true)}
                      disabled={jornadasReplicables.length === 0}
                      title={
                        jornadasReplicables.length === 0
                          ? "Todavía no hay otra jornada con plan escrito de la que partir"
                          : "Replicar el plan de la semana anterior con «?» en lo que los datos dicen que puede cambiar y «*» en lo que proponen incorporar"
                      }
                      className="
                        flex items-center gap-2 rounded-xl border border-[#C8A96B]/40
                        bg-[#C8A96B]/10 px-3.5 py-2.5 text-sm text-[#C8A96B] transition
                        hover:bg-[#C8A96B]/20
                        disabled:cursor-not-allowed disabled:opacity-40
                      "
                    >
                      <Sparkles size={15} />

                      {/* En el móvil, rótulo corto: el icono solo no se entiende (29/10/2026). */}
                      <span className="md:hidden">Boceto</span>
                      <span className="hidden md:inline">Proponer boceto</span>
                    </button>

                    <ReplicarPlan
                      jornadas={jornadasReplicables}
                      onElegir={replicarDe}
                    />
                    </div>

                    <details className="group relative md:hidden">
                      <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-xl border border-white/15 px-3.5 py-2.5 text-sm text-white/75 [&::-webkit-details-marker]:hidden">
                        Más
                        <ChevronDown size={13} className="transition group-open:rotate-180" />
                      </summary>

                      <div className="absolute right-0 top-full z-30 mt-2 flex w-56 flex-col gap-2 rounded-xl border border-white/10 bg-[#0B0F14] p-2 shadow-xl">
                        <button
                          type="button"
                          onClick={() => setBocetoAbierto(true)}
                          disabled={jornadasReplicables.length === 0}
                          className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-[#C8A96B] hover:bg-white/[0.06] disabled:opacity-40"
                        >
                          <Sparkles size={14} />
                          Proponer boceto
                        </button>

                        <ReplicarPlan jornadas={jornadasReplicables} onElegir={replicarDe} />
                      </div>
                    </details>

                    {bocetoAbierto && (
                      <BocetoPlanDialog
                        actual={rivalActivo}
                        candidatas={jornadasReplicables.map((j) => j.rival)}
                        onAplicar={aplicaBoceto}
                        onCerrar={() => setBocetoAbierto(false)}
                      />
                    )}
                  </>
                )}

                {editando ? (
                  <>
                    <AutoSaveStatus
                      estado={auto.status}
                      guardadoEn={auto.lastSavedAt}
                      onReintentar={() => void auto.flush()}
                      className="hidden lg:inline-flex"
                    />

                    <button
                      type="button"
                      onClick={deshacerCambios}
                      disabled={guardando || !hayCambiosDeSesion}
                      title="Volver a como estaba al entrar en edición"
                      className="
                        hidden items-center gap-2 rounded-xl border border-white/15
                        px-3.5 py-2.5 text-sm text-white/70 transition
                        hover:border-white/30 hover:text-white
                        disabled:opacity-40 lg:flex
                      "
                    >
                      <RotateCcw size={15} />
                      Deshacer
                    </button>

                    <button
                      type="button"
                      onClick={terminarEdicion}
                      disabled={guardando}
                      title="Guardar lo pendiente y salir de edición (Ctrl+S)"
                      className="
                        hidden items-center gap-2 rounded-xl bg-[#C8A96B] px-4 py-2.5
                        text-sm font-semibold text-black transition
                        hover:bg-[#d9bd82]
                        disabled:cursor-not-allowed disabled:opacity-40 lg:flex
                      "
                    >
                      {guardando ? (
                        <LoaderCircle size={15} className="animate-spin" />
                      ) : (
                        <Check size={15} />
                      )}

                      {guardando ? "Guardando..." : "Hecho"}
                    </button>

                    <span className="rounded-xl border border-[#C8A96B]/40 bg-[#C8A96B]/10 px-3 py-2.5 text-xs font-semibold text-[#C8A96B] lg:hidden">
                      Modo edición
                    </span>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={entrarEnEdicion}
                    disabled={!rivalActivo}
                    title="Editar informe (Ctrl+E)"
                    className="
                      flex items-center gap-2 rounded-xl border border-[#C8A96B]/50
                      bg-[#C8A96B]/10 px-4 py-2.5 text-sm font-semibold text-[#C8A96B]
                      transition hover:bg-[#C8A96B]/20
                      disabled:cursor-not-allowed disabled:opacity-40
                    "
                  >
                    <Pencil size={15} />
                    Editar informe
                  </button>
                )}
              </div>
            </div>

            {/* Índice de secciones */}
            {rivalActivo && !cargando && (
              <nav
                aria-label="Secciones del plan"
                className="scrollbar-none mt-3 flex gap-1 overflow-x-auto [mask-image:linear-gradient(to_right,#000_calc(100%-28px),transparent)] pr-6 sm:[mask-image:none] sm:pr-0"
              >
                {SECCIONES.filter(({ id }) => seccionVisible(id)).map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => irASeccion(id)}
                    data-activa={seccionActiva === id}
                    className={`
                      flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5
                      text-[12px] font-medium transition
                      ${
                        seccionActiva === id
                          ? "bg-[#C8A96B]/15 text-[#C8A96B]"
                          : "text-white/45 hover:bg-white/[0.04] hover:text-white/80"
                      }
                    `}
                  >
                    <Icon size={13} />
                    {label}
                  </button>
                ))}
              </nav>
            )}
          </div>

          <ColumnasPerdidas columnas={columnasPerdidas} />

          {/*
          | Trabajo que se quedó a medio camino de la hoja en una visita
          | anterior. **No se aplica solo**: entre medias puede haber escrito
          | otro, y pisar la fila sin preguntar cambiaría una pérdida
          | silenciosa por otra. Se enseña y se decide.
          */}
          {hayQueRecuperar && (
            <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-amber-400/30 bg-amber-400/[0.07] px-4 py-3">
              <TriangleAlert size={16} className="shrink-0 text-amber-300" />

              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white/85">
                  Hay cambios de este plan que no llegaron a guardarse
                </p>

                <p className="mt-0.5 text-[12px] leading-relaxed text-white/55">
                  Se escribieron {fechaRecuperado} y quedaron en este navegador
                  —{camposRecuperados}
                  {camposRecuperados === 1 ? " campo distinto" : " campos distintos"}{" "}
                  de lo que hay en la hoja—. Recupéralos para revisarlos antes de
                  que se escriban.
                </p>
              </div>

              <button
                type="button"
                onClick={recuperarPendiente}
                className="rounded-xl bg-[#C8A96B] px-4 py-2 text-sm font-semibold text-black transition hover:bg-[#d9bd82]"
              >
                Recuperar
              </button>

              <button
                type="button"
                /* Es la única copia de lo que no llegó a la hoja: se pregunta
                   antes de tirarla (19/10/2026). */
                onClick={() => {
                  if (window.confirm("¿Descartar los cambios que no llegaron a guardarse? No se podrán recuperar.")) {
                    auto.descartaRecuperado();
                  }
                }}
                className="rounded-xl border border-white/15 px-4 py-2 text-sm text-white/70 transition hover:border-white/30 hover:text-white"
              >
                Descartar
              </button>
            </div>
          )}

          {/* ESTADOS */}
          {cargando && <Esqueleto />}

          {!cargando && error && (
            <div className="rounded-3xl border border-rose-500/25 bg-rose-500/[0.06] p-10 text-center">
              <TriangleAlert size={30} className="mx-auto text-rose-400" />

              <h2 className="mt-4 text-lg font-semibold">Error de conexión</h2>

              <p className="mx-auto mt-2 max-w-md text-sm text-white/50">
                {error}
              </p>

              <button
                type="button"
                onClick={() => recargar(rivalActivo?.ID)}
                className="mt-6 rounded-xl bg-[#C8A96B] px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-[#d9bd82]"
              >
                Reintentar
              </button>
            </div>
          )}

          {!cargando && !error && !rivalActivo && (
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-12 text-center">
              <ClipboardList size={30} className="mx-auto text-white/25" />

              <h2 className="mt-4 text-lg font-semibold">
                Todavía no hay partidos
              </h2>

              <p className="mx-auto mt-2 max-w-md text-sm text-white/45">
                Cuando se den de alta los rivales aparecerán aquí para preparar
                el plan.
              </p>
            </div>
          )}

          {/* CONTENIDO */}
          {!cargando && !error && rivalActivo && (
            <div className="space-y-6">
              {/* -------------------------------------------------- CONTEXTO */}
              <section id="contexto" className="scroll-mt-56 space-y-5">
                <div className="mp-card overflow-hidden rounded-3xl border border-[#C8A96B]/20 bg-gradient-to-br from-[#C8A96B]/[0.12] via-[#111827] to-[#0B0F14] p-6 md:p-8">
                  <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-lg bg-[#C8A96B] px-2.5 py-1 text-[11px] font-bold tracking-wider text-black">
                          JORNADA{" "}
                          {String(rivalActivo.JORNADA ?? "--").padStart(2, "0")}
                        </span>

                        {relleno(rivalActivo.LOCAL_VISITANTE) && (
                          <span className="rounded-lg border border-white/15 bg-white/[0.04] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-white/70">
                            {rivalActivo.LOCAL_VISITANTE}
                          </span>
                        )}

                        <span
                          className={`
                            rounded-lg px-2.5 py-1 text-[11px] font-semibold
                            ${
                              cuentaAtras.urgente
                                ? "bg-rose-500/15 text-rose-300"
                                : "bg-white/[0.05] text-white/50"
                            }
                          `}
                        >
                          {cuentaAtras.texto}
                        </span>
                      </div>

                      <p className="mt-5 text-[11px] uppercase tracking-[0.25em] text-white/35">
                        Real Madrid Castilla vs
                      </p>

                      {editando ? (
                        <input
                          value={rivalActivo.EQUIPO || ""}
                          onChange={(e) => setCampo("EQUIPO", e.target.value)}
                          aria-label="Nombre del rival"
                          className="
                            mt-2 w-full max-w-xl rounded-xl border border-white/15
                            bg-[#0B0F14]/70 px-4 py-2.5 text-2xl font-bold text-white
                            outline-none focus:border-[#C8A96B] focus:ring-2 focus:ring-[#C8A96B]/25
                          "
                        />
                      ) : (
                        <h2 className="mt-1.5 flex min-w-0 items-center gap-3 break-words text-3xl font-bold tracking-tight md:text-4xl">
                          {rivalActivo.EQUIPO && (
                            <EscudoEquipo
                              nombre={rivalActivo.EQUIPO}
                              escudo={escudoDeRival(rivalActivo.EQUIPO)}
                              lado={44}
                            />
                          )}

                          <span className="min-w-0">
                            {rivalActivo.EQUIPO || "Rival sin definir"}
                          </span>
                        </h2>
                      )}
                    </div>

                    {/* El avance del plan es del analista: sólo en edición. */}
                    {editando && (
                      <div className="mp-no-print shrink-0 rounded-2xl border border-white/10 bg-[#0B0F14]/50 px-5 py-4">
                        <AnilloProgreso
                          porcentaje={porcentaje}
                          completados={completados}
                          total={CAMPOS_PLAN.length}
                        />
                      </div>
                    )}
                  </div>

                  <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <DatoCabecera etiqueta="Fecha" icon={CalendarDays}>
                      {editando ? (
                        <input
                          type="date"
                          value={aValorDeInput(rivalActivo.FECHA)}
                          onChange={(e) => setCampo("FECHA", e.target.value)}
                          aria-label="Fecha del partido"
                          className="
                            w-full rounded-lg border border-white/15 bg-[#0B0F14]/70
                            px-2.5 py-1.5 text-sm outline-none [color-scheme:dark]
                            focus:border-[#C8A96B] focus:ring-2 focus:ring-[#C8A96B]/25
                          "
                        />
                      ) : (
                        <span>{fechaLarga(fechaDe(rivalActivo))}</span>
                      )}
                    </DatoCabecera>

                    {(editando || rivalActivo.DIMENSIONES) && (
                    <DatoCabecera etiqueta="Dimensiones del campo" icon={Ruler}>
                      {editando ? (
                        <input
                          value={rivalActivo.DIMENSIONES || ""}
                          placeholder="105 x 68 m"
                          onChange={(e) =>
                            setCampo("DIMENSIONES", e.target.value)
                          }
                          aria-label="Dimensiones del campo"
                          className="
                            w-full rounded-lg border border-white/15 bg-[#0B0F14]/70
                            px-2.5 py-1.5 text-sm outline-none placeholder:text-white/25
                            focus:border-[#C8A96B] focus:ring-2 focus:ring-[#C8A96B]/25
                          "
                        />
                      ) : (
                        rivalActivo.DIMENSIONES
                      )}
                    </DatoCabecera>
                    )}

                    {(editando || rivalActivo.LOCAL_VISITANTE) && (
                    <DatoCabecera etiqueta="Condición" icon={MapPin}>
                      {editando ? (
                        <input
                          value={rivalActivo.LOCAL_VISITANTE || ""}
                          placeholder="Local / Visitante"
                          onChange={(e) =>
                            setCampo("LOCAL_VISITANTE", e.target.value)
                          }
                          aria-label="Local o visitante"
                          className="
                            w-full rounded-lg border border-white/15 bg-[#0B0F14]/70
                            px-2.5 py-1.5 text-sm outline-none placeholder:text-white/25
                            focus:border-[#C8A96B] focus:ring-2 focus:ring-[#C8A96B]/25
                          "
                        />
                      ) : (
                        rivalActivo.LOCAL_VISITANTE
                      )}
                    </DatoCabecera>
                    )}
                  </div>
                </div>

                {!editando && (() => {
                  const claves = lineasDeClaves(rivalActivo.CLAVES_PARTIDO).slice(0, CLAVES_ESENCIALES);

                  if (!claves.length) return null;

                  return (
                    <div className="mp-no-print mb-5 rounded-2xl border border-[#C8A96B]/25 bg-[#C8A96B]/[0.06] px-5 py-4">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#C8A96B]">
                        {rivalActivo.EQUIPO ? `${rivalActivo.EQUIPO}` : "El rival"}
                        {rivalActivo.LOCAL_VISITANTE ? ` · ${rivalActivo.LOCAL_VISITANTE}` : ""} · lo esencial
                      </p>
                      <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm leading-6 text-white/85">
                        {claves.map((c) => (
                          <li key={c}>{c}</li>
                        ))}
                      </ol>
                    </div>
                  );
                })()}

                {(() => {
                  /* Las claves que ya salen en «Lo esencial» no se repiten debajo: la
                     tarjeta sólo lleva las que no caben arriba (29/10/2026). */
                  const lineas = lineasDeClaves(rivalActivo.CLAVES_PARTIDO);
                  const resto = editando ? [] : lineas.slice(CLAVES_ESENCIALES);
                  const sinTarjeta = !editando && lineas.length > 0 && resto.length === 0;

                  return (
                <div className={`grid items-start gap-5 ${sinTarjeta ? "lg:grid-cols-2 print:grid-cols-3" : "lg:grid-cols-3"}`}>
                  <Bloque
                    titulo="Estado del equipo"
                    icon={Activity}
                    tone="blue"
                    value={rivalActivo.ESTADO_EQUIPO}
                    editando={editando}
                    onChange={(v) => setCampo("ESTADO_EQUIPO", v)}
                    placeholder="Lesionados, sanciones, carga acumulada, dinámica..."
                    minHeight={170}
                  />

                  {sinTarjeta || resto.length > 0 ? (
                    <>
                      {resto.length > 0 && (
                        <div className="print:hidden">
                          <Bloque
                            titulo="Más claves del partido"
                            icon={Target}
                            tone="gold"
                            value={resto.join("\n")}
                            editando={false}
                            onChange={() => {}}
                          />
                        </div>
                      )}

                      {/* «Lo esencial» no sale en el papel: ahí van todas las claves. */}
                      <div className="hidden print:block">
                        <Bloque
                          titulo="Claves del partido"
                          icon={Target}
                          tone="gold"
                          value={rivalActivo.CLAVES_PARTIDO}
                          editando={false}
                          onChange={() => {}}
                        />
                      </div>
                    </>
                  ) : (
                    <Bloque
                      titulo="Claves del partido"
                      icon={Target}
                      tone="gold"
                      value={rivalActivo.CLAVES_PARTIDO}
                      editando={editando}
                      onChange={(v) => setCampo("CLAVES_PARTIDO", v)}
                      placeholder="Una clave por línea..."
                      minHeight={170}
                    />
                  )}

                  <Bloque
                    titulo="Claves emocionales"
                    icon={Brain}
                    tone="violet"
                    value={rivalActivo.CLAVES_EMOCIONALES}
                    editando={editando}
                    onChange={(v) => setCampo("CLAVES_EMOCIONALES", v)}
                    placeholder="Mensaje, foco competitivo, gestión del grupo..."
                    minHeight={170}
                  />
                </div>
                  );
                })()}
              </section>

              {/* ------------------------------------------------------ PLAN */}
              {hayEnLectura("ATAQUE", "DEFENSA", "ABP_OF", "ABP_DEF") && (
              <section
                id="plan"
                className="mp-card scroll-mt-56 rounded-3xl border border-white/10 bg-white/[0.03] p-5 md:p-7"
              >
                <div className="mb-6 flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#C8A96B]/25 bg-[#C8A96B]/10 text-[#C8A96B]">
                    <Target size={17} />
                  </span>

                  <div>
                    <h2 className="text-lg font-bold">Plan de juego</h2>

                    <p className="text-xs text-white/40">
                      Comportamientos con y sin balón, y acciones a balón parado
                    </p>
                  </div>
                </div>

                <div className="grid gap-5 lg:grid-cols-[1fr_1fr_0.8fr]">
                  <Bloque
                    titulo="Con balón"
                    icon={Sparkles}
                    tone="gold"
                    value={rivalActivo.ATAQUE}
                    editando={editando}
                    onChange={(v) => setCampo("ATAQUE", v)}
                    placeholder="Inicio, progresión, finalización..."
                    minHeight={360}
                    apartados
                  />

                  <Bloque
                    titulo="Sin balón"
                    icon={Shield}
                    tone="blue"
                    value={rivalActivo.DEFENSA}
                    editando={editando}
                    onChange={(v) => setCampo("DEFENSA", v)}
                    placeholder="Presión, bloque, repliegue, vigilancias..."
                    minHeight={360}
                    apartados
                  />

                  <div className="grid content-start gap-5">
                    <Bloque
                      titulo="ABP ofensivo"
                      icon={Flame}
                      tone="gold"
                      value={rivalActivo.ABP_OF}
                      editando={editando}
                      onChange={(v) => setCampo("ABP_OF", v)}
                      placeholder="Córners, faltas, saques de banda..."
                      minHeight={150}
                    />

                    <Bloque
                      titulo="ABP defensivo"
                      icon={Shield}
                      tone="blue"
                      value={rivalActivo.ABP_DEF}
                      editando={editando}
                      onChange={(v) => setCampo("ABP_DEF", v)}
                      placeholder="Marcajes, zonas, rechaces..."
                      minHeight={150}
                    />

                  </div>
                </div>

                {/* Fuera de la tarjeta de ABP defensivo y como botón primario (29/10/2026). */}
                {!editando && (
                  <div className="mp-no-print mt-5 flex justify-end">
                    <Link
                      href={enlacePizarraAbp(rivalActivo)}
                      className="
                        inline-flex items-center justify-center gap-2 rounded-xl
                        bg-[#C8A96B] px-4 py-2.5 text-sm font-semibold text-black
                        transition hover:bg-[#D8B97B]
                      "
                    >
                      <Flame size={15} />
                      Montar las diapositivas de balón parado
                    </Link>
                  </div>
                )}

                {/* Las siglas que se usan arriba (29/10/2026). */}
                {!editando && (
                  <details className="mp-no-print mt-4 text-[12px] text-white/55">
                    <summary className="cursor-pointer select-none text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">
                      Siglas
                    </summary>
                    <ul className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2">
                      {Object.entries(SIGLAS_PLAN).map(([sigla, significado]) => (
                        <li key={sigla}>
                          <b className="text-white/75">{sigla}</b> · {significado}
                        </li>
                      ))}
                      <li>
                        <b className="text-white/75">Z1, Z2…</b> · Zonas del campo
                      </li>
                      <li>
                        <b className="text-white/75">Meso</b> · Mesociclo: el bloque de semanas de trabajo
                      </li>
                      <li>
                        <b className="text-white/75">MdJ</b> · Día de partido (MD-1, un día antes; MD+1, un día después)
                      </li>
                    </ul>
                  </details>
                )}
              </section>
              )}

              {/* ---------------------------------------------------- DUELOS */}
              {(hayEnLectura("DUELOS_CB_FAVOR", "DUELOS_CB_CONTRA", "DUELOS_SB_FAVOR", "DUELOS_SB_CONTRA") || duelosClave !== null) && (
              <section
                id="duelos"
                className="mp-card scroll-mt-56 rounded-3xl border border-white/10 bg-white/[0.03] p-5 md:p-7"
              >
                <div className="mb-6 flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#C8A96B]/25 bg-[#C8A96B]/10 text-[#C8A96B]">
                    <Swords size={17} />
                  </span>

                  <div>
                    <h2 className="text-lg font-bold">Duelos</h2>

                    <p className="text-xs text-white/40">
                      Dónde ganamos y dónde nos exponemos en el uno contra uno
                    </p>
                  </div>

                  <Link href={enlaceDuelos} className="ml-auto shrink-0 text-xs text-[#C8A96B] hover:underline">
                    Quién contra quién, con percentil
                  </Link>
                </div>

                {/* Lo que miden los datos: los dos duelos de más ventaja y los dos de más riesgo, con nombre y cifra (de /duelos). */}
                {duelosClave && !editando && (
                  <p className="mb-3 text-[11px] text-white/50">
                    El número de cada duelo es la diferencia de percentil con su par, frente a los jugadores de su puesto con {duelosClave.ventaja[0]?.minutos || duelosClave.riesgo[0]?.minutos || 90} min o más: positivo, ventaja nuestra; negativo, ventaja suya.
                  </p>
                )}
                {duelosClave && !editando && (
                  <div className="mb-5 grid gap-4 md:grid-cols-2">
                    {([
                      ["Para buscar", "Con el balón nuestro, ventaja sobre su par", duelosClave.ventaja, "text-emerald-300", "con nuestro balón"],
                      ["Para vigilar", "Con el balón suyo, ventaja de su par sobre el nuestro", duelosClave.riesgo, "text-rose-300", "con su balón"],
                    ] as const).map(([titulo, ayuda, lista, color, sentido]) =>
                      lista.length ? (
                        <div key={titulo} className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
                          <p className={`text-[11px] font-semibold uppercase tracking-[0.2em] ${color}`}>{titulo}</p>
                          <p className="mt-0.5 text-[11px] text-white/40">{ayuda}</p>

                          <ul className="mt-3 space-y-2.5 text-[13.5px] leading-6 text-white/80">
                            {lista.map((d) => (
                              <li key={d.clave} className="flex gap-2.5">
                                <b className={`w-10 shrink-0 tabular-nums ${color}`}>
                                  {d.valor > 0 ? "+" : ""}
                                  {d.valor}
                                </b>

                                <span>
                                  {d.titulo}{" "}
                                  <span className="text-[11px] text-white/45">· {sentido}</span>
                                  {/* El mismo cruce en las dos columnas: que no parezcan dos duelos distintos. */}
                                  {lista === duelosClave.riesgo &&
                                    (() => {
                                      const otro = duelosClave.ventaja.find((v) => v.clave === d.clave);

                                      return otro ? (
                                        <span className="mt-0.5 block text-[11px] text-white/55">
                                          Mismo duelo que en «Para buscar»: {otro.valor > 0 ? "+" : ""}
                                          {otro.valor} con nuestro balón · {d.valor} con el suyo
                                        </span>
                                      ) : null;
                                    })()}
                                  <span className="block text-[12px] text-white/50">
                                    {d.nuestros.join(" y ")} contra {d.suyos.join(" y ")}
                                  </span>
                                  {/* La base de cada duelo, como en /duelos; qué es el número, una vez arriba. */}
                                  {d.base && <span className="block text-[11px] text-white/40">{d.base}</span>}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null,
                    )}
                  </div>
                )}

                <div className="grid gap-5 lg:grid-cols-2">
                  {hayEnLectura("DUELOS_CB_FAVOR", "DUELOS_CB_CONTRA") && (
                  <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
                    <p className="mb-4 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">
                      <Sparkles size={13} />
                      Con balón
                    </p>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <Bloque
                        titulo="Ventaja"
                        icon={ThumbsUp}
                        tone="green"
                        value={rivalActivo.DUELOS_CB_FAVOR}
                        editando={editando}
                        onChange={(v) => setCampo("DUELOS_CB_FAVOR", v)}
                        placeholder="Duelos a buscar..."
                        minHeight={130}
                      />

                      <Bloque
                        titulo="Desventaja"
                        icon={ThumbsDown}
                        tone="red"
                        value={rivalActivo.DUELOS_CB_CONTRA}
                        editando={editando}
                        onChange={(v) => setCampo("DUELOS_CB_CONTRA", v)}
                        placeholder="Duelos a evitar..."
                        minHeight={130}
                      />
                    </div>
                  </div>
                  )}

                  {hayEnLectura("DUELOS_SB_FAVOR", "DUELOS_SB_CONTRA") && (
                  <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
                    <p className="mb-4 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">
                      <Shield size={13} />
                      Sin balón
                    </p>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <Bloque
                        titulo="Ventaja"
                        icon={ThumbsUp}
                        tone="green"
                        value={rivalActivo.DUELOS_SB_FAVOR}
                        editando={editando}
                        onChange={(v) => setCampo("DUELOS_SB_FAVOR", v)}
                        placeholder="Duelos que dominamos..."
                        minHeight={130}
                      />

                      <Bloque
                        titulo="Desventaja"
                        icon={ThumbsDown}
                        tone="red"
                        value={rivalActivo.DUELOS_SB_CONTRA}
                        editando={editando}
                        onChange={(v) => setCampo("DUELOS_SB_CONTRA", v)}
                        placeholder="Duelos a proteger..."
                        minHeight={130}
                      />
                    </div>
                  </div>
                  )}
                </div>
              </section>
              )}

              {/* ----------------------------------------------------- RIVAL */}
              {hayEnLectura("FORTALEZAS", "DEBILIDADES", "ESTRUCTURA_OF", "ESTRUCTURA_DEF") && (
              <section
                id="rival"
                className="mp-card scroll-mt-56 rounded-3xl border border-white/10 bg-white/[0.03] p-5 md:p-7"
              >
                <div className="mb-6 flex flex-wrap items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#C8A96B]/25 bg-[#C8A96B]/10 text-[#C8A96B]">
                    <Shield size={17} />
                  </span>

                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-bold">
                      Análisis del rival

                      {rivalActivo.EQUIPO ? (
                        <span className="ml-2 font-normal text-white/40">
                          · {rivalActivo.EQUIPO}
                        </span>
                      ) : null}
                    </h2>

                    <p className="text-xs text-white/40">
                      Fortalezas, debilidades y estructuras de referencia
                    </p>
                  </div>

                  <Link
                    href={enlaceAnalisisRival(rivalActivo)}
                    className="
                      mp-no-print ml-auto flex shrink-0 items-center gap-2 rounded-xl
                      border border-[#C8A96B]/30 bg-[#C8A96B]/10 px-3.5 py-2
                      text-xs font-semibold text-[#E4C977] transition
                      hover:border-[#C8A96B] hover:bg-[#C8A96B]/20
                    "
                  >
                    <Binoculars size={14} />
                    Informe completo
                  </Link>
                </div>

                <div className="grid gap-5 lg:grid-cols-2">
                  <Bloque
                    titulo="Fortalezas"
                    icon={ThumbsUp}
                    tone="green"
                    value={rivalActivo.FORTALEZAS}
                    editando={editando}
                    onChange={(v) => setCampo("FORTALEZAS", v)}
                    placeholder="Separa cada fortaleza con ; o un salto de línea"
                    minHeight={150}
                    separarPorPuntoYComa
                    vacio="Sin fortalezas escritas. Se añaden con «Editar informe»."
                  />

                  <Bloque
                    titulo="Debilidades"
                    icon={ThumbsDown}
                    tone="red"
                    value={rivalActivo.DEBILIDADES}
                    editando={editando}
                    onChange={(v) => setCampo("DEBILIDADES", v)}
                    placeholder="Separa cada debilidad con ; o un salto de línea"
                    minHeight={150}
                    separarPorPuntoYComa
                    vacio="Sin debilidades escritas. Se añaden con «Editar informe»."
                  />

                  <Bloque
                    titulo="Estructuras ofensivas"
                    icon={Sparkles}
                    tone="gold"
                    value={rivalActivo.ESTRUCTURA_OF}
                    editando={editando}
                    onChange={(v) => setCampo("ESTRUCTURA_OF", v)}
                    placeholder="1-4-3-3 en salida, 1-3-2-5 en campo contrario..."
                    minHeight={120}
                  />

                  <Bloque
                    titulo="Estructuras defensivas"
                    icon={Shield}
                    tone="blue"
                    value={rivalActivo.ESTRUCTURA_DEF}
                    editando={editando}
                    onChange={(v) => setCampo("ESTRUCTURA_DEF", v)}
                    placeholder="1-4-4-2 en bloque medio, 1-5-3-2 en repliegue..."
                    minHeight={120}
                  />
                </div>

                {/* Sólo para el analista (no sale en el PDF ni en el PPT): lo medido, al lado de lo escrito. */}
                {contraste && !editando && (
                  <p className="mp-no-print mt-4 rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-2.5 text-[12.5px] leading-6 text-white/60">
                    <b className="text-white/75">Contraste con los datos</b>
                    {contraste.dibujo && (
                      <>
                        {" · "}En sus alineaciones: {contraste.dibujo.estructura.replace(/^1-/, "")} ({contraste.dibujo.veces} de las {contraste.dibujo.de} alineaciones con dibujo registrado).
                      </>
                    )}
                    {contraste.abp && (
                      <>
                        {" · "}Su balón parado según Wyscout: {contraste.abp.valor.toFixed(1).replace(".", ",")} % de sus remates
                        {contraste.abp.arriba != null && contraste.abp.abajo != null ? ` (${contraste.abp.arriba} de ${contraste.abp.abajo})` : ""}
                        {contraste.abp.percentil <= 3
                          ? `, el que menos de los ${contraste.abp.equipos}`
                          : contraste.abp.percentil >= 97
                            ? `, el que más de los ${contraste.abp.equipos}`
                            : contraste.abp.percentil >= 60
                              ? `, más que ${Math.round(contraste.abp.percentil / 10)} de cada 10 equipos`
                              : contraste.abp.percentil <= 40
                                ? `, menos que ${Math.max(1, Math.round((100 - contraste.abp.percentil) / 10))} de cada 10 equipos`
                                : ", en la media de la liga"}
                        .
                      </>
                    )}
                  </p>
                )}
              </section>
              )}

              {/* -------------------------------------------------- RECURSOS */}
              <section
                id="recursos"
                className="mp-card hidden scroll-mt-56 rounded-3xl border border-[#C8A96B]/20 bg-gradient-to-br from-[#C8A96B]/[0.08] to-[#111827] p-5 has-[[data-recursos-con-datos]]:block md:p-7"
              >
                <div className="mb-6 flex flex-wrap items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#C8A96B]/25 bg-[#C8A96B]/10 text-[#C8A96B]">
                    <Film size={17} />
                  </span>

                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-bold text-[#C8A96B]">
                      HUDL &amp; Recursos
                    </h2>

                    <p className="text-xs text-white/40">
                      Vídeo y documentación de apoyo para la charla
                    </p>
                  </div>

                  {editando && (
                  <div className="flex items-center gap-2.5">
                    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-[#C8A96B] transition-all duration-500"
                        style={{ width: `${(recursosDisponibles / 4) * 100}%` }}
                      />
                    </div>

                    <span className="text-xs font-semibold text-white/60">
                      {recursosDisponibles}/4
                    </span>
                  </div>
                  )}
                </div>

                {/* Las columnas HUDL_* y DOC de la hoja se pintan dentro de la
                    misma lista; los vídeos y documentos nuevos —tantos como
                    hagan falta, con su nombre— van a Supabase. */}
                <RecursosRival
                  key={String(rivalActivo.ID ?? "")}
                  idRival={String(rivalActivo.ID ?? "")}
                  editando={editando}
                  fijos={recursosFijos}
                  onCampoFijo={setCampo}
                  onSubiendo={(si) => {
                    subiendoRecursos.current = si;
                  }}
                />
              </section>
            </div>
          )}
        </div>

        {/* BARRA FLOTANTE DE EDICIÓN (MÓVIL / TABLET) */}
        {editando && (
          <div className="mp-no-print fixed inset-x-0 bottom-0 z-40 flex items-center gap-3 border-t border-white/10 bg-[#0B0F14]/95 px-4 py-3 backdrop-blur-xl lg:hidden">
            <AutoSaveStatus
              estado={auto.status}
              guardadoEn={auto.lastSavedAt}
              onReintentar={() => void auto.flush()}
              className="flex-1"
            />

            <button
              type="button"
              onClick={deshacerCambios}
              disabled={guardando || !hayCambiosDeSesion}
              className="rounded-xl border border-white/15 px-4 py-2.5 text-sm text-white/70 disabled:opacity-40"
            >
              Deshacer
            </button>

            <button
              type="button"
              onClick={terminarEdicion}
              disabled={guardando}
              className="flex items-center gap-2 rounded-xl bg-[#C8A96B] px-4 py-2.5 text-sm font-semibold text-black disabled:opacity-40"
            >
              {guardando ? (
                <LoaderCircle size={15} className="animate-spin" />
              ) : (
                <Check size={15} />
              )}
              Hecho
            </button>
          </div>
        )}

        {/* Los porqués del boceto, plegados y sólo para el administrador. */}
        {rivalActivo && (
          <div className="px-4 pb-10 sm:px-6 lg:px-10">
            <PorQueDelBoceto key={`${String(rivalActivo.ID ?? "")}|${versionMotivos}`} idRival={String(rivalActivo.ID ?? "")} />
          </div>
        )}

        {avisoGuardado}
      </main>
    </div>
  );
}
