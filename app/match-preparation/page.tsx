"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { toast } from "sonner";

import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";

import {
  Activity,
  Brain,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  ClipboardList,
  Copy,
  ExternalLink,
  FileText,
  Film,
  Flame,
  LoaderCircle,
  MapPin,
  Pencil,
  Printer,
  RotateCcw,
  Ruler,
  Save,
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
| Todo el estado editable vive en `rivalActivo`; `snapshot` guarda la última
| versión confirmada para poder cancelar sin perder datos del servidor.
*/

const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbxCaJ90F28CYdcLVNnI4RZjyQL5IJlXVunEAobWY-Qr6lUL8No9H1B3RdASk83Z_NUd/exec";

type Rival = Record<string, string>;

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

  if (directo) return `${directo[1]}-${directo[2]}-${directo[3]}`;

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

  return fecha.toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
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
    .map((linea) => linea.replace(/^[\s•\-–·]+/, "").trim())
    .filter(Boolean);
}

function dominio(url: unknown) {
  const texto = String(url ?? "").trim();

  if (!texto) return "";

  try {
    return new URL(
      texto.startsWith("http") ? texto : `https://${texto}`
    ).hostname.replace(/^www\./, "");
  } catch {
    return texto.replace(/^https?:\/\//, "").split("/")[0];
  }
}

function enlaceSeguro(url: unknown) {
  const texto = String(url ?? "").trim();

  if (!texto) return "";

  return texto.startsWith("http") ? texto : `https://${texto}`;
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
  vacio = "Sin información",
}: {
  value: unknown;
  separarPorPuntoYComa?: boolean;
  vacio?: string;
}) {
  const items = useMemo(
    () => aVinetas(value, separarPorPuntoYComa),
    [value, separarPorPuntoYComa]
  );

  if (!items.length) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-dashed border-white/10 px-4 py-5 text-sm text-white/30">
        <CircleAlert size={15} />
        {vacio}
      </div>
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
  className?: string;
}) {
  const t = TONES[tone];

  const completo = relleno(value);

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
| TARJETA DE RECURSO (HUDL / DOC)
|--------------------------------------------------------------------------
*/

function ResourceCard({
  titulo,
  descripcion,
  valor,
  icon: Icon,
  editando,
  onChange,
}: {
  titulo: string;
  descripcion: string;
  valor: unknown;
  icon: LucideIcon;
  editando: boolean;
  onChange: (valor: string) => void;
}) {
  const url = String(valor ?? "").trim();

  const disponible = url.length > 0;

  const copiar = async () => {
    if (!disponible) return;

    try {
      await navigator.clipboard.writeText(enlaceSeguro(url));

      toast.success("Enlace copiado", { description: titulo });
    } catch {
      toast.error("No se ha podido copiar el enlace");
    }
  };

  return (
    <div
      className={`
        mp-card flex flex-col rounded-2xl border p-5 transition-all duration-200
        ${
          disponible
            ? "border-[#C8A96B]/25 bg-[#C8A96B]/[0.05] hover:border-[#C8A96B]/50"
            : "border-white/10 bg-white/[0.02]"
        }
      `}
    >
      <div className="flex items-start gap-3">
        <span
          className={`
            flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border
            ${
              disponible
                ? "border-[#C8A96B]/30 bg-[#C8A96B]/10 text-[#C8A96B]"
                : "border-white/10 bg-white/[0.03] text-white/30"
            }
          `}
        >
          <Icon size={16} />
        </span>

        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-white">{titulo}</h3>

          <p className="mt-0.5 text-[11px] text-white/40">{descripcion}</p>
        </div>

        {disponible ? (
          <CircleCheck size={16} className="mt-0.5 shrink-0 text-emerald-400" />
        ) : (
          <CircleAlert size={16} className="mt-0.5 shrink-0 text-white/25" />
        )}
      </div>

      <div className="mt-4 flex-1">
        {editando ? (
          <input
            aria-label={`Enlace de ${titulo}`}
            value={url}
            placeholder="https://..."
            onChange={(e) => onChange(e.target.value)}
            className="
              w-full rounded-xl border border-white/15 bg-[#0B0F14]/70
              px-3 py-2.5 text-sm text-white outline-none transition
              placeholder:text-white/25
              focus:border-[#C8A96B] focus:ring-2 focus:ring-[#C8A96B]/25
            "
          />
        ) : (
          <p
            className={`truncate text-xs ${
              disponible ? "text-white/55" : "text-white/25"
            }`}
            title={disponible ? url : undefined}
          >
            {disponible ? dominio(url) : "Sin enlace asignado"}
          </p>
        )}
      </div>

      <div className="mp-no-print mt-4 flex gap-2">
        <a
          href={disponible ? enlaceSeguro(url) : undefined}
          target="_blank"
          rel="noopener noreferrer"
          aria-disabled={!disponible}
          onClick={(e) => {
            if (!disponible) e.preventDefault();
          }}
          className={`
            flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5
            text-xs font-semibold transition
            ${
              disponible
                ? "bg-[#C8A96B] text-black hover:bg-[#d9bd82]"
                : "cursor-not-allowed bg-white/[0.04] text-white/25"
            }
          `}
        >
          <ExternalLink size={14} />
          Abrir
        </a>

        <button
          type="button"
          onClick={copiar}
          disabled={!disponible}
          title="Copiar enlace"
          aria-label={`Copiar enlace de ${titulo}`}
          className="
            rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5
            text-white/70 transition hover:border-white/25 hover:text-white
            disabled:cursor-not-allowed disabled:opacity-30
          "
        >
          <Copy size={14} />
        </button>
      </div>
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

        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-white">
            {activo?.EQUIPO || "Selecciona un partido"}
          </span>

          <span className="block truncate text-[11px] capitalize text-white/40">
            {fechaLarga(activo?.FECHA)}
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

                  <span className="min-w-0 flex-1 truncate text-sm text-white">
                    {r.EQUIPO}
                  </span>

                  <span className="shrink-0 text-[11px] text-white/35">
                    {fechaCorta(r.FECHA)}
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
            stroke="rgba(255,255,255,0.08)"
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

export default function MatchPreparation() {
  const [rivales, setRivales] = useState<Rival[]>([]);
  const [rivalActivo, setRivalActivo] = useState<Rival | null>(null);
  const [snapshot, setSnapshot] = useState<Rival | null>(null);

  const [modoEdicion, setModoEdicion] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seccionActiva, setSeccionActiva] = useState("contexto");

  /* ---------------------------------------------------------------- CARGA */

  /* `recargas` fuerza un nuevo fetch; `idPreferido` conserva el partido
     abierto tras un reintento. */
  const [recargas, setRecargas] = useState(0);

  const idPreferido = useRef<string | undefined>(undefined);

  const recargar = useCallback((id?: string) => {
    idPreferido.current = id;

    setRecargas((valor) => valor + 1);
  }, []);

  useEffect(() => {
    let cancelado = false;

    async function cargarRivales() {
      setCargando(true);
      setError(null);

      try {
        const res = await fetch(`${APPS_SCRIPT_URL}?action=rivales`, {
          cache: "no-store",
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();

        if (cancelado) return;

        const lista: Rival[] = Array.isArray(data) ? (data as Rival[]) : [];

        lista.sort((a, b) => Number(a?.JORNADA ?? 0) - Number(b?.JORNADA ?? 0));

        setRivales(lista);

        /* Por defecto abrimos el próximo partido, no el primero de la lista. */
        const proximo =
          lista.find((r) => {
            const dias = diasHasta(r.FECHA);

            return dias !== null && dias >= 0;
          }) ?? lista[lista.length - 1];

        const elegido =
          lista.find((r) => String(r.ID) === String(idPreferido.current)) ??
          proximo ??
          null;

        setRivalActivo(elegido ?? null);
        setSnapshot(elegido ?? null);
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

  /* --------------------------------------------------------------- ESTADO */

  const hayCambios = useMemo(
    () => JSON.stringify(rivalActivo) !== JSON.stringify(snapshot),
    [rivalActivo, snapshot]
  );

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

  const dias = diasHasta(rivalActivo?.FECHA);

  const cuentaAtras = etiquetaCuentaAtras(dias);

  const recursosDisponibles = [
    rivalActivo?.HUDL_PLAYLIST,
    rivalActivo?.HUDL_PARTIDO,
    rivalActivo?.HUDL_ANALISIS,
    rivalActivo?.DOC,
  ].filter(relleno).length;

  /* ------------------------------------------------------------- ACCIONES */

  const seleccionarRival = useCallback((rival: Rival) => {
    setRivalActivo(rival);
    setSnapshot(rival);
  }, []);

  const navegar = useCallback(
    (paso: number) => {
      if (indiceActual < 0) return;

      const destino = rivales[indiceActual + paso];

      if (destino) seleccionarRival(destino);
    },
    [indiceActual, rivales, seleccionarRival]
  );

  const cancelarEdicion = useCallback(() => {
    if (hayCambios) toast.info("Cambios descartados");

    setRivalActivo(snapshot);
    setModoEdicion(false);
  }, [snapshot, hayCambios]);

  const guardar = useCallback(async () => {
    if (!rivalActivo || guardando) return;

    setGuardando(true);

    const idToast = toast.loading("Guardando plan de partido...");

    try {
      const body = new URLSearchParams();

      body.append("action", "guardarRival");

      Object.entries(rivalActivo).forEach(([clave, valor]) => {
        body.append(clave, String(valor ?? ""));
      });

      const res = await fetch(APPS_SCRIPT_URL, { method: "POST", body });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const json = await res.json();

      if (json?.success === false) {
        throw new Error(json?.error || "El servidor rechazó los cambios");
      }

      setSnapshot(rivalActivo);

      setRivales((previo) =>
        previo.map((r) =>
          String(r.ID) === String(rivalActivo.ID) ? rivalActivo : r
        )
      );

      setModoEdicion(false);

      toast.success("Plan de partido guardado", {
        id: idToast,
        description: `${rivalActivo.EQUIPO ?? ""} · Jornada ${
          rivalActivo.JORNADA ?? "-"
        }`,
      });
    } catch (e) {
      console.error("Error guardando rival:", e);

      toast.error("No se ha podido guardar", {
        id: idToast,
        description:
          e instanceof Error
            ? e.message
            : "Revisa la conexión e inténtalo de nuevo",
      });
    } finally {
      setGuardando(false);
    }
  }, [rivalActivo, guardando]);

  /* --------------------------------------------------------------- ATAJOS */

  useEffect(() => {
    const atajos = (evento: KeyboardEvent) => {
      const conModificador = evento.ctrlKey || evento.metaKey;

      if (!conModificador) return;

      const tecla = evento.key.toLowerCase();

      if (tecla === "s" && modoEdicion) {
        evento.preventDefault();

        guardar();
      }

      if (tecla === "e" && !modoEdicion) {
        evento.preventDefault();

        setModoEdicion(true);
      }
    };

    window.addEventListener("keydown", atajos);

    return () => window.removeEventListener("keydown", atajos);
  }, [modoEdicion, guardar]);

  /* Aviso al salir con cambios sin guardar. */
  useEffect(() => {
    if (!hayCambios) return;

    const aviso = (evento: BeforeUnloadEvent) => {
      evento.preventDefault();

      evento.returnValue = "";
    };

    window.addEventListener("beforeunload", aviso);

    return () => window.removeEventListener("beforeunload", aviso);
  }, [hayCambios]);

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

  const irASeccion = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ block: "start" });
  };

  const editando = modoEdicion;

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

              {/* Acciones */}
              <div className="flex items-center gap-2">
                {hayCambios && (
                  <span className="hidden items-center gap-1.5 rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-[11px] font-medium text-amber-300 sm:flex">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
                    Sin guardar
                  </span>
                )}

                {!editando && (
                  <button
                    type="button"
                    onClick={() => window.print()}
                    title="Imprimir o exportar a PDF"
                    className="
                      flex items-center gap-2 rounded-xl border border-white/10
                      bg-white/[0.03] px-3.5 py-2.5 text-sm text-white/70 transition
                      hover:border-white/25 hover:text-white
                    "
                  >
                    <Printer size={15} />

                    <span className="hidden md:inline">Imprimir</span>
                  </button>
                )}

                {editando ? (
                  <>
                    <button
                      type="button"
                      onClick={cancelarEdicion}
                      disabled={guardando}
                      className="
                        hidden items-center gap-2 rounded-xl border border-white/15
                        px-3.5 py-2.5 text-sm text-white/70 transition
                        hover:border-white/30 hover:text-white
                        disabled:opacity-40 lg:flex
                      "
                    >
                      <RotateCcw size={15} />
                      Cancelar
                    </button>

                    <button
                      type="button"
                      onClick={guardar}
                      disabled={guardando || !hayCambios}
                      title="Guardar cambios (Ctrl+S)"
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
                        <Save size={15} />
                      )}

                      {guardando ? "Guardando..." : "Guardar"}
                    </button>

                    <span className="rounded-xl border border-[#C8A96B]/40 bg-[#C8A96B]/10 px-3 py-2.5 text-xs font-semibold text-[#C8A96B] lg:hidden">
                      Modo edición
                    </span>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setModoEdicion(true)}
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
                className="scrollbar-none mt-3 flex gap-1 overflow-x-auto"
              >
                {SECCIONES.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => irASeccion(id)}
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
                Cuando se den de alta rivales en la hoja de cálculo aparecerán
                aquí para preparar el plan.
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
                        <h2 className="mt-1.5 break-words text-3xl font-bold tracking-tight md:text-4xl">
                          {rivalActivo.EQUIPO || "Rival sin definir"}
                        </h2>
                      )}
                    </div>

                    <div className="shrink-0 rounded-2xl border border-white/10 bg-[#0B0F14]/50 px-5 py-4">
                      <AnilloProgreso
                        porcentaje={porcentaje}
                        completados={completados}
                        total={CAMPOS_PLAN.length}
                      />
                    </div>
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
                        <span className="capitalize">
                          {fechaLarga(rivalActivo.FECHA)}
                        </span>
                      )}
                    </DatoCabecera>

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
                        rivalActivo.DIMENSIONES || (
                          <span className="text-white/30">Sin definir</span>
                        )
                      )}
                    </DatoCabecera>

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
                        rivalActivo.LOCAL_VISITANTE || (
                          <span className="text-white/30">Sin definir</span>
                        )
                      )}
                    </DatoCabecera>
                  </div>
                </div>

                <div className="grid gap-5 lg:grid-cols-3">
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
              </section>

              {/* ------------------------------------------------------ PLAN */}
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
              </section>

              {/* ---------------------------------------------------- DUELOS */}
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
                </div>

                <div className="grid gap-5 lg:grid-cols-2">
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
                </div>
              </section>

              {/* ----------------------------------------------------- RIVAL */}
              <section
                id="rival"
                className="mp-card scroll-mt-56 rounded-3xl border border-white/10 bg-white/[0.03] p-5 md:p-7"
              >
                <div className="mb-6 flex items-center gap-3">
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
                    vacio="Sin fortalezas registradas"
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
                    vacio="Sin debilidades registradas"
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
              </section>

              {/* -------------------------------------------------- RECURSOS */}
              <section
                id="recursos"
                className="mp-card scroll-mt-56 rounded-3xl border border-[#C8A96B]/20 bg-gradient-to-br from-[#C8A96B]/[0.08] to-[#111827] p-5 md:p-7"
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
                </div>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <ResourceCard
                    titulo="Playlist"
                    descripcion="Clips seleccionados"
                    valor={rivalActivo.HUDL_PLAYLIST}
                    icon={Film}
                    editando={editando}
                    onChange={(v) => setCampo("HUDL_PLAYLIST", v)}
                  />

                  <ResourceCard
                    titulo="Partido completo"
                    descripcion="Último encuentro del rival"
                    valor={rivalActivo.HUDL_PARTIDO}
                    icon={Film}
                    editando={editando}
                    onChange={(v) => setCampo("HUDL_PARTIDO", v)}
                  />

                  <ResourceCard
                    titulo="Análisis"
                    descripcion="Vídeo analizado"
                    valor={rivalActivo.HUDL_ANALISIS}
                    icon={Film}
                    editando={editando}
                    onChange={(v) => setCampo("HUDL_ANALISIS", v)}
                  />

                  <ResourceCard
                    titulo="Informe rival"
                    descripcion="Documento de scouting"
                    valor={rivalActivo.DOC}
                    icon={FileText}
                    editando={editando}
                    onChange={(v) => setCampo("DOC", v)}
                  />
                </div>
              </section>
            </div>
          )}
        </div>

        {/* BARRA FLOTANTE DE EDICIÓN (MÓVIL / TABLET) */}
        {editando && (
          <div className="mp-no-print fixed inset-x-0 bottom-0 z-40 flex items-center gap-3 border-t border-white/10 bg-[#0B0F14]/95 px-4 py-3 backdrop-blur-xl lg:hidden">
            <span className="flex-1 text-xs text-white/50">
              {hayCambios ? "Cambios sin guardar" : "Modo edición"}
            </span>

            <button
              type="button"
              onClick={cancelarEdicion}
              disabled={guardando}
              className="rounded-xl border border-white/15 px-4 py-2.5 text-sm text-white/70 disabled:opacity-40"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={guardar}
              disabled={guardando || !hayCambios}
              className="flex items-center gap-2 rounded-xl bg-[#C8A96B] px-4 py-2.5 text-sm font-semibold text-black disabled:opacity-40"
            >
              {guardando ? (
                <LoaderCircle size={15} className="animate-spin" />
              ) : (
                <Save size={15} />
              )}
              Guardar
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
