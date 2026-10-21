"use client";

/**
 * JUGADORES SESIÓN: LOS EQUIPOS DE CADA TAREA, A PARTIR DE LA LISTA DEL DÍA.
 *
 * Se pega la lista que manda el delegado («CASTILLA - SÁBADO 26/09/26 …
 * LISTADO DE JUGADORES … LESIONADOS …») y se hacen los equipos tarea a tarea:
 * cuántos equipos, si hay comodines y cuántos, de qué color va cada uno. Una
 * diapositiva por tarea, como la pizarra de ABP, que se presenta a pantalla
 * completa o se exporta en imagen (una o todas de golpe).
 *
 * El validador vigila lo que se escapa con prisa: alguien sin colocar, alguien
 * repetido en la lista, equipos descompensados o vacíos, comodines de más o de
 * menos, dos equipos del mismo color. Los lesionados empiezan fuera pero se
 * pueden meter en una tarea (a veces hacen alguna).
 *
 * Todo se guarda solo en Supabase (documento `jugadores-sesion`).
 * La lógica está en `lib/sesion-equipos/modelo.ts`; el dibujo, en
 * `components/sesion-equipos/LaminaEquipos.tsx`.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardPaste,
  Copy,
  Download,
  Expand,
  GripVertical,
  Info,
  Loader2,
  Minus,
  Plus,
  Shuffle,
  Trash2,
  Undo2,
  Redo2,
  FileDown,
  MessageSquareText,
  Repeat2,
  UsersRound,
  Users,
  Wand2,
  X,
  Eraser,
  Send,
} from "lucide-react";
import { toast } from "sonner";

import { AbpHeader, Button, Dialog, Panel, SaveState, Segmented, sePuedeDescartar } from "@/components/abp/ui";
import { Pestanas, usePestanaUrl } from "@/components/analisis/Pestanas";
import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { LAMINA_H, LAMINA_W, LaminaEquipos, LaminaEscalada } from "@/components/sesion-equipos/LaminaEquipos";
import { CampoEstructura } from "@/components/sesion-equipos/CampoEstructura";
import { loadRegistro, type RegistroTarea } from "@/lib/abp/registro";
import { contextoDeSesion, detallesDeTareas, lineaDeDetalle, tareasDelDia } from "@/lib/sesion-equipos/registro";
import type { PointerEvent as ReactPointerEvent } from "react";
import {
  ESTRUCTURAS,
  colocaEnEstructura,
  colocaEnPunto,
  conPortero,
  estructuraPara,
  guardaHuecos,
  gruposDeEstructuras,
  intercambia,
  jugadoresDe,
  lineasDe,
  normalizaEstructura,
  parejasDe,
  huecosDeCampo,
  paraGuardar,
  type Hueco,
  type Punto,
} from "@/lib/sesion-equipos/estructura";
import { useRemoteDoc } from "@/hooks/useRemoteDoc";
import { cambiosDe, creaCambio, guardaVistaCambio, quitaCambio, vistaCambio, type Fase } from "@/lib/sesion-equipos/cambio";
import { apodo, capturaLienzos, descarga, pdfDeLienzos, pintado } from "@/lib/export/lienzos";
import { barlowCondensed } from "@/lib/rivals/portada-font";
import {
  ALMACEN_VACIO,
  COLORES,
  COMODIN,
  FUERA,
  PUESTOS,
  actualizaLista,
  completaReparto,
  conEquipos,
  limpiaJugador,
  leeLista,
  anadeJugador,
  quitaJugador,
  reemplazaJugador,
  yaEnLaSesion,
  duplicaTarea,
  nombreDeColor,
  nuevaSesion,
  nuevaTarea,
  ordenPorPuesto,
  puestosDesdePlantilla,
  claveNombre,
  repartoDe,
  rotacionDe,
  sorteaReparto,
  tareaLista,
  textoDeSesion,
  textoDeTarea,
  tintaSobre,
  valida,
  type AlmacenEquipos,
  type Aviso,
  type EquipoTarea,
  type JugadorSesion,
  type Puesto,
  type PuestoDe,
  type SesionEquipos,
  type Sitio,
  type TareaEquipos,
} from "@/lib/sesion-equipos/modelo";
import { usePlayers } from "@/hooks/usePlayers";
import { DEMARCACIONES, demarcacion, demarcacionCercana, demarcacionesDesdePlantilla, grupoDeDemarcacion, puntoPreferido, puntosDeLineas, reubicaEnDibujo, type Demarcacion } from "@/lib/sesion-equipos/demarcacion";
import { aprendePosiciones } from "@/lib/sesion-equipos/aprendizaje";

const EJEMPLO = `CASTILLA - SÁBADO 26/09/26
==========================

LISTADO DE JUGADORES (20):
  - OSCAR NAASEI
  - ÁLVARO LEIVA
  - MELVIN UKPEIGBE (RMC)
  …

LESIONADOS:
  - IZAN REGUEIRA`;

/** El ancho de un elemento, al día. */
function useAncho<T extends HTMLElement>() {
  /* Con el nodo en el estado y no en una ref: el hueco aparece cuando llega la
     sesión, después del primer render, y una ref no avisaría. */
  const [nodo, ref] = useState<T | null>(null);

  const [ancho, setAncho] = useState(0);

  useEffect(() => {
    if (!nodo) return;

    const observa = new ResizeObserver(([entrada]) => setAncho(Math.floor(entrada.contentRect.width)));

    observa.observe(nodo);

    return () => observa.disconnect();
  }, [nodo]);

  return [ref, ancho] as const;
}

/* ------------------------------------------------------------------ */
/*  PIEZAS                                                             */
/* ------------------------------------------------------------------ */

/*
| ARRASTRAR CON EL DEDO Y CON EL RATÓN (06/10/2026).
|
| El arrastre nativo del navegador (`draggable`) sólo va con ratón: en la
| tableta y en el móvil no se podía arrastrar a nadie. Ahora la ficha se
| arrastra con eventos de puntero, que valen para los dos, y lo que hay debajo
| al soltar dice dónde va (`data-destino`). Tocar sin mover sigue siendo
| elegir.
*/
function Chip({
  jugador,
  color,
  puesto,
  seleccionado,
  arrastrando,
  onClick,
  onPointerDown,
  onQuitar,
  destino,
  encima = false,
  conQuien,
}: {
  jugador: JugadorSesion;
  color?: string;
  puesto?: Puesto;
  seleccionado: boolean;
  arrastrando?: boolean;
  /** Soltar encima de él (08/10/2026): «jug:<id>». */
  destino?: string;
  encima?: boolean;
  /** Con quién comparte puesto. */
  conQuien?: string;
  onClick: () => void;
  onPointerDown: (e: ReactPointerEvent) => void;
  /** Sacarlo de su equipo en un toque (sólo si está en uno). */
  onQuitar?: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={seleccionado}
      aria-label={`${jugador.nombre}${puesto ? `, ${puesto}` : ""}${conQuien ? `, comparte puesto con ${conQuien}` : ""}${jugador.baja ? `, ${jugador.baja.toLowerCase()}` : ""}`}
      data-destino={destino}
      onPointerDown={onPointerDown}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      title="Arrástralo a otro equipo, o tócalo y luego toca dónde va. Con él elegido: 1-6 equipo, C comodín, F fuera"
      style={{ touchAction: "pan-y" }}
      className={`group flex min-w-0 cursor-grab select-none items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left text-[12px] font-semibold uppercase tracking-wide outline-none transition focus-visible:ring-2 focus-visible:ring-[#C8A96B] active:cursor-grabbing ${
        arrastrando
          ? "opacity-35"
          : encima
            ? "scale-[1.04] border-[#C8A96B] bg-[#C8A96B]/25 text-white ring-2 ring-[#C8A96B]/50"
            : seleccionado
            ? "border-[#C8A96B] bg-[#C8A96B]/20 text-white ring-2 ring-[#C8A96B]/40"
            : "border-white/10 bg-white/[0.04] text-white/85 hover:border-white/25 hover:bg-white/[0.07]"
      }`}
    >
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color ?? "rgba(255,255,255,0.25)" }} />
      <span className="min-w-0 truncate">{jugador.nombre}</span>
      {puesto && (
        <span
          className={`shrink-0 rounded px-1 text-[9px] font-bold ${
            puesto === "POR" ? "bg-[#C8A96B] text-black" : "bg-white/[0.07] text-white/45"
          }`}
        >
          {puesto}
        </span>
      )}
      {conQuien && (
        <span className="shrink-0 rounded bg-[#C8A96B]/15 px-1 text-[9px] font-bold text-[#E9D5A8]" title="Comparten puesto">
          = {conQuien}
        </span>
      )}
      {jugador.etiqueta && (
        <span className="shrink-0 rounded border border-[#C8A96B]/40 px-1 text-[9px] font-bold text-[#C8A96B]">
          {jugador.etiqueta}
        </span>
      )}
      {jugador.baja && (
        <span className="shrink-0 rounded border border-red-300/40 px-1 text-[9px] font-bold text-red-300">
          {jugador.baja.replace(/s$/i, "").toUpperCase()}
        </span>
      )}
      {onQuitar && (
        <span
          role="button"
          tabIndex={-1}
          aria-label={`Quitar a ${jugador.nombre} del equipo`}
          title="Quitar del equipo"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onQuitar();
          }}
          className="-mr-1 ml-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded text-white/35 transition hover:bg-red-400/20 hover:text-red-300"
        >
          <X size={12} />
        </span>
      )}
    </div>
  );
}

/** Una caja donde se sueltan jugadores: equipo, comodines, sin colocar o fuera. */
function Caja({
  titulo,
  color,
  cuenta,
  objetivo,
  activa,
  tenue,
  alerta,
  cabecera,
  onSoltar,
  children,
  vacio,
  atajo,
  destino,
  encima = false,
  compacta = false,
  resumen,
}: {
  titulo: ReactNode;
  color?: string;
  cuenta: number;
  objetivo?: number;
  activa: boolean;
  tenue?: boolean;
  alerta?: boolean;
  cabecera?: ReactNode;
  onSoltar: () => void;
  children: ReactNode;
  vacio: string;
  atajo?: string;
  /** Lo que significa soltar aquí a alguien que se arrastra («eq:<id>», «comodin», «fuera», «sin»). */
  destino: string;
  /** Hay alguien arrastrándose justo encima. */
  encima?: boolean;
  /** Vacía y sin nada que hacer: una franja fina en vez de una caja (08/10/2026). */
  compacta?: boolean;
  /** Una franja bajo la cabecera (el reparto por puestos del equipo). */
  resumen?: ReactNode;
}) {
  const tinta = color ? tintaSobre(color) : "#FFFFFF";

  return (
    <div
      data-destino={destino}
      onClick={(e) => {
        /* Tocar el fondo de la caja suelta ahí al elegido. */
        if (activa && e.target === e.currentTarget) onSoltar();
      }}
      className={`flex min-w-0 flex-col overflow-hidden rounded-2xl border transition ${
        encima
          ? "border-[#C8A96B] bg-[#C8A96B]/10"
          : alerta
            ? "border-amber-400/40 bg-amber-400/[0.05]"
            : tenue
              ? "border-dashed border-white/10 bg-white/[0.015]"
              : "border-white/10 bg-white/[0.03]"
      } ${activa ? "cursor-copy" : ""}`}
    >
      {/* Un div y no un botón: dentro van la muestra de color y el nombre,
          que son controles propios. */}
      <div
        role={activa ? "button" : undefined}
        tabIndex={activa ? 0 : undefined}
        onClick={(e) => {
          if (activa && !(e.target instanceof HTMLInputElement) && !(e.target as HTMLElement).closest("[data-muestra]")) onSoltar();
        }}
        onKeyDown={(e) => {
          if (activa && e.key === "Enter") onSoltar();
        }}
        className="flex min-w-0 items-center justify-between gap-2 px-3 py-2 text-left"
        style={color ? { background: color, color: tinta } : undefined}
      >
        <span className="flex min-w-0 items-center gap-2 text-[12px] font-bold uppercase tracking-[0.12em]">
          {cabecera ?? <span className="truncate">{titulo}</span>}
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          {atajo && activa && (
            <kbd
              className="rounded border px-1 text-[10px] font-semibold opacity-70"
              style={{ borderColor: color ? `${tinta}55` : "rgba(255,255,255,0.2)" }}
            >
              {atajo}
            </kbd>
          )}
          {!(compacta && cuenta === 0) && (
          <span
            className="inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-[12px] font-bold tabular-nums"
            style={{ background: color ? (tinta === "#FFFFFF" ? "rgba(0,0,0,0.22)" : "rgba(255,255,255,0.5)") : "rgba(255,255,255,0.08)" }}
          >
            {cuenta}
            {objetivo !== undefined ? `/${objetivo}` : ""}
          </span>
          )}
        </span>
      </div>

      {resumen}

      <div
        className={`flex flex-1 flex-wrap content-start gap-1.5 ${compacta ? (cuenta === 0 && !activa ? "hidden" : "min-h-[36px] px-2 py-1.5") : "min-h-[64px] p-2"}`}
        onClick={(e) => {
          if (activa && e.target === e.currentTarget) onSoltar();
        }}
      >
        {children}
        {/* Vacía y plegada, sin el texto de ayuda salvo con alguien en la mano (21/10/2026): dos cajas con un cero eran ruido. */}
        {cuenta === 0 && (!compacta || activa) && (
          <span className="pointer-events-none self-center px-1 text-[11px] text-white/40">{vacio}</span>
        )}
      </div>
    </div>
  );
}

/**
 * Saca a un jugador de las parejas de la tarea (08/10/2026). Si era titular,
 * su compañero se queda con su hueco del dibujo.
 */
function sueltaPareja(t: TareaEquipos, id: string): TareaEquipos {
  let tocada = false;

  const equipos = t.equipos.map((e) => {
    if (!e.pares) return e;

    let esta = false;
    const pares = { ...e.pares };
    let orden = e.orden;

    for (const [titular, companero] of Object.entries(e.pares)) {
      if (companero === id) {
        delete pares[titular];
        esta = true;
      } else if (titular === id) {
        delete pares[titular];
        esta = true;
        if (orden) orden = orden.map((x) => (x === id ? companero : x));
      }
    }

    if (!esta) return e;
    tocada = true;
    return { ...e, pares, orden };
  });

  return tocada ? { ...t, equipos } : t;
}

/**
 * Cambia a dos jugadores de sitio (21/10/2026): cada uno se va al del otro,
 * equipo y hueco del dibujo incluidos. Antes, soltar a uno encima de otro en
 * modo «Cambiar» sólo movía al primero y el segundo se quedaba donde estaba,
 * con un equipo de más y otro de menos. Si el que llega no tenía sitio, el
 * otro queda sin colocar.
 */
function intercambiaSitios(t0: TareaEquipos, a: string, b: string): TareaEquipos {
  const t = sueltaPareja(sueltaPareja(t0, a), b);
  const sa = t.sitio[a];
  const sb = t.sitio[b];
  const sitio = { ...t.sitio };

  if (sb === undefined) delete sitio[a];
  else sitio[a] = sb;

  if (sa === undefined) delete sitio[b];
  else sitio[b] = sa;

  const equipos = t.equipos.map((e) =>
    e.orden?.some((x) => x === a || x === b) ? { ...e, orden: e.orden.map((x) => (x === a ? b : x === b ? a : x)), autoOrden: undefined } : e,
  );

  return { ...t, sitio, equipos };
}

/** El titular con el que comparte puesto un jugador, si es compañero de alguien. */
function titularDe(t: TareaEquipos, id: string): string | null {
  for (const e of t.equipos) for (const [titular, companero] of Object.entries(e.pares ?? {})) if (companero === id) return titular;
  return null;
}

/** Su compañero, si es titular de una pareja. */
function companeroDe(t: TareaEquipos, id: string): string | null {
  for (const e of t.equipos) if (e.pares?.[id]) return e.pares[id];
  return null;
}

/** Las siglas cortas de cada puesto, en el orden en que se lee un equipo. */
const ORDEN_PUESTOS: Puesto[] = ["POR", "DEF", "MED", "EXT", "DEL"];

/**
 * Cuántos hay de cada puesto en un equipo (08/10/2026): de un vistazo se ve
 * si un equipo se ha quedado sin defensas o con todos los delanteros.
 */
function ResumenPuestos({ jugadores, puestoDe, color }: { jugadores: JugadorSesion[]; puestoDe: PuestoDe; color: string }) {
  if (!jugadores.length) return null;

  const cuenta = new Map<string, number>();

  for (const j of jugadores) {
    const p = puestoDe(j) ?? "?";
    cuenta.set(p, (cuenta.get(p) ?? 0) + 1);
  }

  const partes = [...ORDEN_PUESTOS.filter((p) => cuenta.has(p)), ...(cuenta.has("?") ? ["?"] : [])];

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-white/[0.06] px-3 py-1.5" style={{ background: `${color}14` }}>
      {partes.map((p) => (
        <span
          key={p}
          className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-wide ${p === "POR" ? "bg-[#C8A96B]/20 text-[#E9D5A8]" : p === "?" ? "bg-white/[0.04] text-white/35" : "bg-white/[0.06] text-white/70"}`}
          title={p === "?" ? "Sin puesto: ponlo en «Plantilla del día»" : PUESTOS.find((x) => x.clave === p)?.nombre}
        >
          {p === "?" ? "SIN PUESTO" : p}
          <span className="tabular-nums text-white">{cuenta.get(p)}</span>
        </span>
      ))}
    </div>
  );
}

/**
 * Cómo se reparte la tarea, en una barra (08/10/2026): un tramo por equipo
 * con su color, los comodines y lo que queda sin colocar.
 */
function BarraReparto({
  tramos,
  total,
}: {
  tramos: { clave: string; nombre: string; color: string; n: number; rayado?: boolean }[];
  total: number;
}) {
  const visibles = tramos.filter((t) => t.n > 0);

  if (total === 0) return null;

  return (
    <div className="space-y-1.5">
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-white/[0.05]">
        {visibles.map((t) => (
          <div
            key={t.clave}
            title={`${t.nombre}: ${t.n}`}
            style={{
              width: `${(t.n / total) * 100}%`,
              background: t.rayado ? `repeating-linear-gradient(45deg, ${t.color} 0 4px, transparent 4px 8px)` : t.color,
            }}
            className="h-full border-r border-[#0B0F14]/60 last:border-r-0"
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-white/55">
        {visibles.map((t) => (
          <span key={t.clave} className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: t.color }} />
            <span className="uppercase tracking-wide">{t.nombre}</span>
            <b className="tabular-nums text-white/85">{t.n}</b>
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * El dibujo de un equipo (06/10/2026): su estructura y el mini campograma.
 * Se toca a un jugador y luego a otro (o a un hueco libre) para cambiarlos.
 *
 * 07/10/2026: el campo ocupa todo el ancho de la tarjeta (con «Campo grande»,
 * hasta 640 px), la lista trae decenas de dibujos agrupados por jugadores
 * —primero los que encajan con los que tiene el equipo— y se puede crear uno
 * línea a línea y guardarlo en «Mis estructuras», que ve todo el cuerpo
 * técnico. Además, soltar a un jugador en el césped lo deja en ese punto.
 */
function EstructuraEquipo({
  equipo,
  descompensado = false,
  jugadores,
  puestoDe,
  elegido,
  sobre,
  grande,
  mias,
  onToca,
  onArrastra,
  onEstructura,
  onRecoloca,
  onGuardaMia,
  onBorraMia,
}: {
  equipo: EquipoTarea;
  /** Hay un aviso de líneas descompensadas: el «10/10» no va en verde. */
  descompensado?: boolean;
  jugadores: JugadorSesion[];
  puestoDe: PuestoDe;
  elegido: number | null;
  /** El destino que hay debajo del arrastre, para iluminar el hueco. */
  sobre: string | null;
  /** «Campo grande»: el campo puede crecer hasta 640 px. */
  grande: boolean;
  /** Las estructuras creadas por el cuerpo técnico. */
  mias: string[];
  onToca: (hueco: number, huecos: Hueco[]) => void;
  onArrastra: (jugador: JugadorSesion, e: ReactPointerEvent) => void;
  onEstructura: (estructura: string) => void;
  /** Vuelve a colocar a todos según el dibujo, sin lo movido a mano. */
  onRecoloca: () => void;
  onGuardaMia: (estructura: string) => void;
  onBorraMia: (estructura: string) => void;
}) {
  const { huecos, sobran, porteros, parejas } = colocaEnEstructura(jugadores, equipo.estructura, puestoDe, equipo.orden, equipo.posiciones, equipo.pares);
  /* Los porteros no se dibujan: la cuenta es de los de campo contra los huecos de campo. */
  const total = huecosDeCampo(equipo.estructura);
  /* Los que comparten puesto ocupan un solo hueco: el compañero no cuenta. */
  const companerosFuera = sobran.filter((j) => [...parejas.values()].some((c) => c.id === j.id)).length;
  const deCampo = jugadores.length - porteros.length - huecos.filter((h) => h.pareja).length - companerosFuera;
  const actual = normalizaEstructura(equipo.estructura ?? "");
  const enLista = ESTRUCTURAS.some((e) => e.valor === actual) || mias.includes(actual);
  const grupos = gruposDeEstructuras(jugadores.length);
  const tocado = Boolean(equipo.orden?.length || equipo.posiciones?.some(Boolean));
  const esMia = mias.includes(actual);

  /* El creador: las líneas de campo (sin el portero) y si lleva portero. */
  const [creando, setCreando] = useState<{ portero: boolean; lineas: number[] } | null>(null);

  const [refCaja, anchoCaja] = useAncho<HTMLDivElement>();
  const anchoCampo = Math.max(200, Math.min(grande ? 640 : 440, anchoCaja || 260));

  const abreCreador = () => {
    const l = lineasDe(equipo.estructura);
    const portero = conPortero(equipo.estructura) || !l.length;
    setCreando({ portero, lineas: (portero ? l.slice(1) : l).length ? (portero ? l.slice(1) : l) : [3, 2, 1] });
  };

  const textoCreado = creando ? [...(creando.portero ? [1] : []), ...creando.lineas].join("-") : "";
  const cuentaCreado = creando ? creando.lineas.reduce((s, n) => s + n, 0) + (creando.portero ? 1 : 0) : 0;

  return (
    <div className="basis-full space-y-2" onClick={(e) => e.stopPropagation()}>
      <div className="flex flex-wrap items-center gap-1.5">
        <select
          value={enLista ? actual : "otra"}
          onChange={(e) => {
            if (e.target.value === "crear") return abreCreador();
            if (e.target.value === "otra") return;
            setCreando(null);
            onEstructura(e.target.value);
          }}
          className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-[13px] font-semibold text-white outline-none focus:border-[#C8A96B]/50"
          aria-label={`Estructura de ${equipo.nombre}`}
        >
          {!enLista && (
            <option value="otra" className="bg-[#11161C]">
              {actual ? `${actual} (a mano)` : "Elige una…"}
            </option>
          )}
          {mias.length > 0 && (
            <optgroup label="Mis estructuras" className="bg-[#11161C]">
              {mias.map((m) => (
                <option key={`mia-${m}`} value={m} className="bg-[#11161C]">
                  ★ {m} ({jugadoresDe(m)})
                </option>
              ))}
            </optgroup>
          )}
          {grupos.map((g) => (
            <optgroup key={g.rotulo} label={g.rotulo} className="bg-[#11161C]">
              {g.opciones
                .filter((e) => !mias.includes(e.valor))
                .map((e) => (
                  <option key={e.valor} value={e.valor} className="bg-[#11161C]">
                    {e.rotulo}
                  </option>
                ))}
            </optgroup>
          ))}
          <option value="crear" className="bg-[#11161C]">
            ✎ Crear la mía…
          </option>
        </select>
        <button
          type="button"
          onClick={() => (creando ? setCreando(null) : abreCreador())}
          className={`rounded-lg border px-2 py-1.5 text-[12px] font-semibold transition ${creando ? "border-[#C8A96B]/60 bg-[#C8A96B]/15 text-[#E9D5A8]" : "border-white/10 text-white/70 hover:bg-white/[0.06]"}`}
          title="Crear o retocar la estructura línea a línea"
        >
          {creando ? "Cerrar" : "Crear"}
        </button>
        <span
          className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${deCampo === total && !descompensado ? "bg-emerald-400/10 text-emerald-300/90" : "bg-amber-400/10 text-amber-300/90"}`}
          title={descompensado ? "Los huecos están llenos, pero las líneas no van parejas entre equipos: mira el validador" : "Jugadores de campo del equipo / huecos del dibujo (el portero no se dibuja)"}
        >
          {deCampo}/{total} huecos
        </span>
      </div>

      {creando && (
        <div className="space-y-2 rounded-xl border border-[#C8A96B]/30 bg-[#C8A96B]/[0.06] p-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <label className="mr-1 flex items-center gap-1.5 text-[12px] text-white/75">
              <input
                type="checkbox"
                checked={creando.portero}
                onChange={(e) => setCreando({ ...creando, portero: e.target.checked })}
                className="h-3.5 w-3.5 accent-[#C8A96B]"
              />
              Con portero (no se dibuja)
            </label>
            {creando.lineas.map((n, i) => (
              <span key={i} className="inline-flex items-center rounded-lg border border-white/10 bg-black/20">
                <button
                  type="button"
                  className="px-1.5 py-1 text-white/60 hover:text-white"
                  aria-label={`Quitar uno a la línea ${i + 1}`}
                  onClick={() =>
                    setCreando({
                      ...creando,
                      lineas: n <= 1 ? creando.lineas.filter((_, k) => k !== i) : creando.lineas.map((x, k) => (k === i ? x - 1 : x)),
                    })
                  }
                >
                  <Minus size={12} />
                </button>
                <span className="min-w-[1.2em] text-center text-[13px] font-bold text-white">{n}</span>
                <button
                  type="button"
                  className="px-1.5 py-1 text-white/60 hover:text-white disabled:opacity-30"
                  aria-label={`Añadir uno a la línea ${i + 1}`}
                  disabled={n >= 7}
                  onClick={() => setCreando({ ...creando, lineas: creando.lineas.map((x, k) => (k === i ? x + 1 : x)) })}
                >
                  <Plus size={12} />
                </button>
              </span>
            ))}
            <button
              type="button"
              disabled={creando.lineas.length >= 6}
              onClick={() => setCreando({ ...creando, lineas: [...creando.lineas, 1] })}
              className="rounded-lg border border-dashed border-white/25 px-2 py-1 text-[12px] text-white/70 hover:bg-white/[0.06] disabled:opacity-30"
            >
              + línea
            </button>
          </div>
          <p className="text-[11px] text-white/50">
            De atrás adelante: <b className="text-white/85">{textoCreado || "—"}</b> · {cuentaCreado} jugador{cuentaCreado === 1 ? "" : "es"}
            {deCampo !== cuentaCreado - (creando.portero ? 1 : 0) ? ` (el equipo tiene ${deCampo} de campo)` : ""}
          </p>
          <div className="flex flex-wrap gap-1.5">
            <Button tone="primary" disabled={!creando.lineas.length} onClick={() => onEstructura(textoCreado)}>
              Usar
            </Button>
            <Button
              disabled={!creando.lineas.length || mias.includes(textoCreado)}
              onClick={() => {
                onGuardaMia(textoCreado);
                onEstructura(textoCreado);
              }}
              title="La guarda arriba del desplegable, para todo el cuerpo técnico"
            >
              {mias.includes(textoCreado) ? "Ya está en mis estructuras" : "Usar y guardar en mis estructuras"}
            </Button>
          </div>
        </div>
      )}

      {total > 0 ? (
        <div ref={refCaja} className="flex w-full justify-center">
          <CampoEstructura
            flecha
            huecos={huecos}
            color={equipo.color}
            ancho={anchoCampo}
            elegido={elegido}
            onToca={(i) => onToca(i, huecos)}
            destinoDe={(i) => `hueco:${equipo.id}:${i}`}
            campoDestino={`campo:${equipo.id}`}
            sobre={sobre}
            onArrastra={(i, e) => {
              const j = huecos[i]?.jugador;
              if (j) onArrastra(j, e);
            }}
          />
        </div>
      ) : (
        <p className="text-[11px] text-white/40">Elige una estructura o créala con «Crear».</p>
      )}
      {porteros.length > 0 && (
        <p className="text-[11px] text-white/55">
          {porteros.length === 1 ? "Portero" : "Porteros"} (fuera del campograma): <b className="text-white/80">{porteros.map((j) => j.nombre).join(", ")}</b>
        </p>
      )}
      {sobran.length > 0 && (
        <p className="text-[11px] text-amber-300/90">
          Fuera del dibujo: {sobran.map((j) => j.nombre).join(", ")}. Arrástralos a un punto del campo para colocarlos.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {elegido !== null ? (
          <p className="flex-1 text-[11px] text-[#C8A96B]">Toca otro jugador o un hueco libre para cambiarlos.</p>
        ) : (
          <p className="flex-1 text-[11px] text-white/40">
            Arrastra a un jugador a cualquier punto del campo, a otro hueco o a otro equipo; o toca dos para cambiarlos.
          </p>
        )}
        {tocado && (
          <button type="button" onClick={onRecoloca} className="text-[11px] font-semibold text-white/60 underline-offset-2 hover:text-white hover:underline">
            Recolocar según el dibujo
          </button>
        )}
        {esMia && (
          <button
            type="button"
            onClick={() => onBorraMia(actual)}
            className="text-[11px] text-white/40 underline-offset-2 hover:text-rose-300 hover:underline"
            title="Quitarla de «Mis estructuras» (los equipos que la usan la conservan)"
          >
            Quitar de mis estructuras
          </button>
        )}
      </div>
    </div>
  );
}

/** Los petos: una fila de muestras. */
function Paleta({ valor, onElige, onCierra }: { valor: string; onElige: (c: string) => void; onCierra: () => void }) {
  return (
    <div
      className="absolute left-0 top-full z-30 mt-1 grid w-[220px] grid-cols-6 gap-1.5 rounded-xl border border-white/15 bg-[#11161C] p-2 shadow-2xl"
      onClick={(e) => e.stopPropagation()}
    >
      {COLORES.map((c) => (
        <button
          key={c.valor}
          type="button"
          title={c.nombre}
          onClick={() => {
            onElige(c.valor);
            onCierra();
          }}
          className={`h-7 w-7 rounded-full border-2 transition hover:scale-110 ${
            c.valor.toLowerCase() === valor.toLowerCase() ? "border-[#C8A96B]" : "border-white/15"
          }`}
          style={{ background: c.valor }}
        />
      ))}
    </div>
  );
}

function Muestra({ color, onCambia, titulo }: { color: string; onCambia: (c: string) => void; titulo: string }) {
  const [abierta, setAbierta] = useState(false);

  useEffect(() => {
    if (!abierta) return;

    const cierra = () => setAbierta(false);

    window.addEventListener("click", cierra);

    return () => window.removeEventListener("click", cierra);
  }, [abierta]);

  return (
    <span className="relative inline-flex" data-muestra>
      <button
        type="button"
        title={titulo}
        onClick={(e) => {
          e.stopPropagation();
          setAbierta((v) => !v);
        }}
        className="h-5 w-5 rounded-full border-2 border-white/60 shadow"
        style={{ background: color }}
      />
      {abierta && <Paleta valor={color} onElige={onCambia} onCierra={() => setAbierta(false)} />}
    </span>
  );
}

function Contador({ valor, min, max, onCambia }: { valor: number; min: number; max: number; onCambia: (n: number) => void }) {
  return (
    <span className="inline-flex items-center rounded-xl border border-white/10 bg-white/[0.03]">
      <button
        type="button"
        aria-label="Menos"
        disabled={valor <= min}
        onClick={() => onCambia(valor - 1)}
        className="px-2 py-1.5 text-white/60 transition hover:text-white disabled:opacity-30"
      >
        <Minus size={13} />
      </button>
      <span className="w-6 text-center text-sm font-semibold tabular-nums text-white">{valor}</span>
      <button
        type="button"
        aria-label="Más"
        disabled={valor >= max}
        onClick={() => onCambia(valor + 1)}
        className="px-2 py-1.5 text-white/60 transition hover:text-white disabled:opacity-30"
      >
        <Plus size={13} />
      </button>
    </span>
  );
}

/**
 * Lo que se ha leído de la lista pegada, antes de crear nada (21/10/2026):
 * título, cuántos hacen la sesión y cuántos son baja y por qué. Con la sesión
 * ya hecha, además quién entra y quién sale. Así un listado mal copiado (sin
 * guiones, o con el apartado de lesionados pegado al de disponibles) se ve
 * antes de hacer equipos con él.
 */
function LecturaLista({ texto, sesion }: { texto: string; sesion?: SesionEquipos | null }) {
  const lista = useMemo(() => leeLista(texto), [texto]);

  if (!texto.trim()) return null;

  const disponibles = lista.jugadores.filter((j) => !j.baja);
  const motivos = new Map<string, number>();

  for (const j of lista.jugadores) if (j.baja) motivos.set(j.baja, (motivos.get(j.baja) ?? 0) + 1);

  const antes = new Set((sesion?.jugadores ?? []).map((j) => claveNombre(j.nombre)));
  const ahora = new Set(lista.jugadores.map((j) => claveNombre(j.nombre)));
  const entran = sesion ? lista.jugadores.filter((j) => !antes.has(claveNombre(j.nombre))) : [];
  const salen = sesion ? sesion.jugadores.filter((j) => !ahora.has(claveNombre(j.nombre))) : [];

  return (
    <div aria-live="polite" className="mt-3 space-y-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-[12px] text-white/70">
      {lista.jugadores.length ? (
        <>
          <p>
            <b className="text-white">{lista.titulo}</b>
            {" · "}
            <b className="tabular-nums text-white">{disponibles.length}</b> disponibles
            {[...motivos].map(([m, n]) => (
              <span key={m}>
                {" · "}
                <b className="tabular-nums text-white">{n}</b> {m.toLowerCase()}
              </span>
            ))}
          </p>
          {lista.repetidos.length > 0 && (
            <p className="flex items-start gap-1.5 text-amber-200">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" /> Sale dos veces: {lista.repetidos.join(", ")}
            </p>
          )}
          {sesion && (entran.length > 0 || salen.length > 0) && (
            <p>
              {entran.length > 0 && (
                <>
                  Entran: <b className="text-emerald-300">{entran.map((j) => j.nombre).join(", ")}</b>.{" "}
                </>
              )}
              {salen.length > 0 && (
                <>
                  Salen de todas las tareas: <b className="text-red-300">{salen.map((j) => j.nombre).join(", ")}</b>.
                </>
              )}
            </p>
          )}
          {sesion && !entran.length && !salen.length && <p>Los mismos jugadores: nadie entra ni sale.</p>}
        </>
      ) : (
        <p className="flex items-start gap-1.5 text-amber-200">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" /> No leo ningún jugador. Cada uno en su línea, empezando por un guion: «- OSCAR NAASEI».
        </p>
      )}
    </div>
  );
}

const ICONO_AVISO = {
  error: <X size={13} className="mt-0.5 shrink-0 text-red-300" />,
  aviso: <AlertTriangle size={13} className="mt-0.5 shrink-0 text-amber-300" />,
  info: <Info size={13} className="mt-0.5 shrink-0 text-sky-300" />,
  ok: <Check size={13} className="mt-0.5 shrink-0 text-emerald-300" />,
};

/* ------------------------------------------------------------------ */
/*  LA PÁGINA                                                          */
/* ------------------------------------------------------------------ */

export default function JugadoresSesionPage() {
  const {
    value: almacen,
    setValue: escribeAlmacen,
    status,
    localOnly,
    lastSavedAt,
    sinGuardar,
    guardaYa,
  } = useRemoteDoc<AlmacenEquipos>({
    key: "jugadores-sesion",
    kind: "jugadores-sesion",
    fallback: ALMACEN_VACIO,
  });

  /*
  | Deshacer y rehacer. Con prisa se suelta a alguien en el equipo que no es,
  | o se sortea sin querer encima de unos equipos hechos a mano: cada cambio
  | guarda cómo estaba todo antes (los 60 últimos).
  |
  | 21/10/2026: escribir un nombre (de la tarea o de un equipo) es UN paso, no
  | uno por letra: los cambios seguidos del mismo `grupo` en menos de 1,5 s se
  | juntan. Y lo deshecho se puede rehacer (Ctrl+Y o Ctrl+Mayús+Z) hasta que
  | se cambie otra cosa.
  */
  const historia = useRef<AlmacenEquipos[]>([]);

  const futuro = useRef<AlmacenEquipos[]>([]);

  const ultimoGrupo = useRef<{ clave: string; t: number } | null>(null);

  const almacenAhora = useRef(almacen);

  useEffect(() => {
    almacenAhora.current = almacen;
  }, [almacen]);

  const [pasos, setPasos] = useState({ atras: 0, adelante: 0 });

  const setAlmacen = useCallback(
    (cambio: (actual: AlmacenEquipos) => AlmacenEquipos, grupo?: string) => {
      const ahora = Date.now();
      const previo = ultimoGrupo.current;
      const seguido = Boolean(grupo) && previo !== null && previo.clave === grupo && ahora - previo.t < 1500;

      if (!seguido) historia.current = [...historia.current.slice(-59), almacenAhora.current];

      ultimoGrupo.current = grupo ? { clave: grupo, t: ahora } : null;
      futuro.current = [];

      setPasos({ atras: historia.current.length, adelante: 0 });

      escribeAlmacen(cambio);
    },
    [escribeAlmacen],
  );

  const deshaz = useCallback(() => {
    const previo = historia.current.pop();

    if (previo) {
      futuro.current = [...futuro.current, almacenAhora.current];
      escribeAlmacen(previo);
    }

    ultimoGrupo.current = null;
    setPasos({ atras: historia.current.length, adelante: futuro.current.length });
  }, [escribeAlmacen]);

  const rehaz = useCallback(() => {
    const siguiente = futuro.current.pop();

    if (siguiente) {
      historia.current = [...historia.current, almacenAhora.current];
      escribeAlmacen(siguiente);
    }

    ultimoGrupo.current = null;
    setPasos({ atras: historia.current.length, adelante: futuro.current.length });
  }, [escribeAlmacen]);

  /* El puesto de cada uno: el puesto a mano manda; si no, el de la plantilla. */
  const { players: plantilla } = usePlayers();

  const sesiones = useMemo(
    () =>
      [...(almacen.sesiones ?? [])]
        /* Los nombres pegados de WhatsApp con «_…_» se ven limpios (el id no cambia). */
        .map((s) => (s.jugadores.some((j) => limpiaJugador(j) !== j) ? { ...s, jugadores: s.jugadores.map(limpiaJugador) } : s))
        .sort((a, b) => (b.fecha ?? b.creadaEn).localeCompare(a.fecha ?? a.creadaEn)),
    [almacen.sesiones],
  );

  const [sesionId, setSesionId] = useState<string | null>(null);

  const sesion = sesiones.find((s) => s.id === sesionId) ?? sesiones[0] ?? null;

  const [pedida, setPedida] = useState(0);

  const activa = sesion ? Math.min(pedida, Math.max(0, sesion.tareas.length - 1)) : 0;

  const tareaBase = sesion?.tareas[activa] ?? null;

  /*
  | EL MOMENTO QUE SE EDITA (08/10/2026): el inicio o «tras el cambio», si la
  | tarea lo tiene. Todo lo de abajo trabaja sobre `tarea`, que es la tarea
  | tal y como está en ese momento; `cambiaTarea` devuelve lo editado a su
  | sitio (ver lib/sesion-equipos/cambio.ts).
  */
  const [faseElegida, setFase] = useState<Fase>("inicio");

  const fase: Fase = tareaBase?.cambio ? faseElegida : "inicio";

  const tarea = useMemo(() => (tareaBase && fase === "cambio" ? vistaCambio(tareaBase) : tareaBase), [tareaBase, fase]);

  /* Al soltar a un jugador encima de otro: se cambian de sitio o comparten puesto. */
  const [modoSoltar, setModoSoltar] = useState<"cambiar" | "compartir">("cambiar");

  /*
  | Tres vistas (14/10/2026): hacer los equipos, las diapositivas (ver,
  | presentar, exportar) y la plantilla del día. Antes todo iba en un scroll
  | y la plantilla quedaba al fondo, debajo de la diapositiva.
  */
  const [vista, setVista] = usePestanaUrl<"equipos" | "diapositivas" | "plantilla">("vista", ["equipos", "diapositivas", "plantilla"], "equipos");

  const puestosAuto = useMemo(
    () =>
      sesion
        ? puestosDesdePlantilla(
            sesion.jugadores,
            plantilla.map((p) => ({ nombre: p.nombre, apodo: p.apodo, posicion: p.posicion })),
          )
        : {},
    [sesion, plantilla],
  );

  /* La demarcación de cada uno según la plantilla (LATERAL D., 6, 11…), y lo aprendido de todas las sesiones. */
  const demarcacionesAuto = useMemo(
    () => (sesion ? demarcacionesDesdePlantilla(sesion.jugadores, plantilla.map((p) => ({ nombre: p.nombre, apodo: p.apodo, posicion: p.posicion }))) : {}),
    [sesion, plantilla],
  );

  const aprendido = useMemo(() => aprendePosiciones(almacen), [almacen]);

  /* A mano, si no la plantilla y, si tampoco, la más cercana a donde lo coloca el cuerpo técnico (dos veces o más). */
  const demarcacionDe = useCallback(
    (j: JugadorSesion): Demarcacion | undefined => {
      const ap = aprendido[claveNombre(j.nombre)];

      return j.demarcacion ?? demarcacionesAuto[j.id] ?? (ap && ap.veces >= 2 ? demarcacionCercana(ap) : undefined);
    },
    [demarcacionesAuto, aprendido],
  );

  /*
  | El puesto (la demarcación a mano manda, luego el puesto a mano, luego la
  | plantilla) con lo que necesita la colocación colgado: dónde juega cada uno
  | y su grupo fino para repartir parejo. Ver lib/sesion-equipos/demarcacion.ts.
  */
  const puestoDe: PuestoDe = useMemo(() => {
    const base = (j: JugadorSesion) =>
      (j.demarcacion ? demarcacion(j.demarcacion)?.puesto : undefined) ?? j.puesto ?? demarcacion(demarcacionesAuto[j.id])?.puesto ?? puestosAuto[j.id] ?? demarcacion(demarcacionDe(j))?.puesto;

    return Object.assign((j: JugadorSesion) => base(j), {
      preferido: (j: JugadorSesion) => puntoPreferido(j, demarcacionDe, base, aprendido[claveNombre(j.nombre)]),
      grupo: (j: JugadorSesion) => grupoDeDemarcacion(demarcacionDe(j)),
    });
  }, [puestosAuto, demarcacionesAuto, demarcacionDe, aprendido]);

  const [elegido, setElegido] = useState<string | null>(null);

  /* El arrastre en curso (con el dedo o el ratón) y la caja que hay debajo. */
  const [arrastre, setArrastre] = useState<{ id: string; nombre: string; color?: string; x: number; y: number } | null>(null);

  const [sobre, setSobre] = useState<string | null>(null);

  /* Al soltar tras arrastrar, el navegador manda además un clic: no es elegir. */
  const acabaDeArrastrar = useRef(false);

  /* En el campograma: el hueco tocado, a la espera del segundo. */
  const [huecoTocado, setHuecoTocado] = useState<{ equipo: string; hueco: number } | null>(null);

  /* «Campo grande»: menos campos por fila y cada uno más grande, para colocar con calma. */
  const [campoGrande, setCampoGrande] = useState(false);

  /* Las estructuras creadas por el cuerpo técnico: viajan en el documento, las ve todo el mundo. */
  const misEstructuras = useMemo(() => almacen.estructuras ?? [], [almacen.estructuras]);

  const arrastrado = useRef<string | null>(null);

  const [dialogo, setDialogo] = useState<null | "nueva" | "lista">(null);

  const [texto, setTexto] = useState("");

  const [presentando, setPresentando] = useState(false);

  const [exportando, setExportando] = useState<null | { laminas: { i: number; fase: Fase }[]; paso: string }>(null);

  /*
  | Con la cabecera de la tarea por defecto (21/10/2026): la imagen que va al
  | grupo tiene que decir qué tarea es y de qué día. Sólo equipos, desmarcándola.
  */
  const [conCabecera, setConCabecera] = useState(true);

  /*
  | LA TAREA DE LA HOJA (21/10/2026). Lo que el cuerpo técnico escribió en el
  | registro de tareas para el día de la sesión (formato, espacio, tiempo,
  | contenido) y el micro, el rival y el MD: salen en la diapositiva. Sólo se
  | lee; si la hoja no tiene el día, la diapositiva queda como estaba.
  */
  const [registro, setRegistro] = useState<RegistroTarea[]>([]);

  useEffect(() => {
    let vivo = true;
    loadRegistro()
      .then((r) => {
        if (vivo) setRegistro(r.tareas);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);

  /* ---------------- escribir ---------------- */

  const cambiaSesion = useCallback(
    (id: string, cambio: (s: SesionEquipos) => SesionEquipos, grupo?: string) =>
      setAlmacen(
        (actual) => ({
          ...actual,
          sesiones: (actual.sesiones ?? []).map((s) => (s.id === id ? cambio(s) : s)),
        }),
        grupo,
      ),
    [setAlmacen],
  );

  const cambiaTarea = useCallback(
    (cambio: (t: TareaEquipos) => TareaEquipos, grupo?: string) => {
      if (!sesion || !tarea) return;

      cambiaSesion(
        sesion.id,
        (s) => ({
          ...s,
          tareas: s.tareas.map((t) => {
            if (t.id !== tarea.id) return t;

            /* Tras el cambio: se edita la vista y se guarda en su sitio, sin tocar el inicio. */
            return fase === "cambio" && t.cambio ? guardaVistaCambio(t, cambio(vistaCambio(t))) : cambio(t);
          }),
        }),
        grupo,
      );
    },
    [cambiaSesion, sesion, tarea, fase],
  );

  /*
  | Ir a otra tarea (21/10/2026): siempre por su inicio y sin nada elegido. Si
  | no, quien estaba editando «tras el cambio» de una tarea seguía en «tras el
  | cambio» en la siguiente sin darse cuenta, y el hueco tocado de un campo se
  | quedaba esperando en otra tarea.
  */
  const irATarea = useCallback((i: number) => {
    setPedida(i);
    setFase("inicio");
    setElegido(null);
    setHuecoTocado(null);
  }, []);

  /** Cambia la tarea guardada tal cual, sin pasar por el momento (marcar o quitar el cambio). */
  const cambiaTareaBase = useCallback(
    (cambio: (t: TareaEquipos) => TareaEquipos) => {
      if (!sesion || !tareaBase) return;

      cambiaSesion(sesion.id, (s) => ({ ...s, tareas: s.tareas.map((t) => (t.id === tareaBase.id ? cambio(t) : t)) }));
    },
    [cambiaSesion, sesion, tareaBase],
  );

  const coloca = useCallback(
    (jugadorId: string, sitio: Sitio | null) => {
      cambiaTarea((t0) => {
        /* Cambiar de sitio deshace su pareja (el compañero se queda con el hueco). */
        const t = t0.sitio[jugadorId] === (sitio ?? undefined) ? t0 : sueltaPareja(t0, jugadorId);
        const nuevo = { ...t.sitio };

        if (sitio === null) delete nuevo[jugadorId];
        else nuevo[jugadorId] = sitio;

        return { ...t, sitio: nuevo };
      });
    },
    [cambiaTarea],
  );

  /**
   * Lleva a un jugador al destino de una caja o de un hueco del campograma.
   *
   * «hueco:<equipo>:<n>» lo mete en ese equipo y en ese hueco: si el hueco
   * estaba ocupado por un compañero, se cambian de sitio; si lo ocupaba alguien
   * y el que llega es de otro equipo, el de antes pasa al primer hueco libre.
   */
  /**
   * Dos en el mismo puesto (08/10/2026): `jugadorId` pasa a compartir el de
   * `otroId` en su equipo. Sale de su pareja anterior y de su hueco.
   */
  const emparejaCon = useCallback(
    (jugadorId: string, otroId: string) => {
      if (!tarea || jugadorId === otroId) return;

      const equipoId = tarea.sitio[otroId];

      if (!equipoId || equipoId === COMODIN || equipoId === FUERA) {
        toast.error("Para compartir puesto, el otro tiene que estar en un equipo");
        return;
      }

      /* Si el otro ya es compañero de alguien, se comparte con su titular… si está libre. */
      const titular = titularDe(tarea, otroId) ?? otroId;

      if (companeroDe(tarea, titular) && companeroDe(tarea, titular) !== jugadorId) {
        const nombre = sesion?.jugadores.find((j) => j.id === companeroDe(tarea, titular))?.nombre;
        toast.error(`Ese puesto ya lo comparten dos${nombre ? ` (con ${nombre})` : ""}`);
        return;
      }

      cambiaTarea((t0) => {
        const t = sueltaPareja(t0, jugadorId);

        return {
          ...t,
          sitio: { ...t.sitio, [jugadorId]: equipoId },
          equipos: t.equipos.map((e) => {
            /* Fuera de cualquier hueco: va en el de su titular. */
            const orden = e.orden?.includes(jugadorId) ? e.orden.map((x) => (x === jugadorId ? "" : x)) : e.orden;

            return e.id === equipoId ? { ...e, orden, pares: { ...(e.pares ?? {}), [titular]: jugadorId } } : orden === e.orden ? e : { ...e, orden };
          }),
        };
      });

      const a = sesion?.jugadores.find((j) => j.id === jugadorId)?.nombre;
      const b = sesion?.jugadores.find((j) => j.id === titular)?.nombre;

      toast.success(`${a} y ${b} comparten puesto`, { description: "Arrastra a cualquiera de los dos a otro sitio para separarlos." });
    },
    [cambiaTarea, sesion, tarea],
  );

  const aplicaDestino = useCallback(
    (jugadorId: string, destino: string, punto?: Punto) => {
      if (destino === "sin") return coloca(jugadorId, null);

      /* Encima de otro jugador (en las fichas): comparte su puesto, o va a su sitio. */
      if (destino.startsWith("jug:")) {
        const otro = destino.slice(4);

        if (otro === jugadorId) return;
        if (modoSoltar === "compartir") return emparejaCon(jugadorId, otro);
        if (!tarea || tarea.sitio[otro] === tarea.sitio[jugadorId]) return;

        cambiaTarea((t) => intercambiaSitios(t, jugadorId, otro));

        const a = sesion?.jugadores.find((j) => j.id === jugadorId)?.nombre;
        const b = sesion?.jugadores.find((j) => j.id === otro)?.nombre;

        toast.success(`${a} ⇄ ${b}`, { description: "Cada uno ocupa el sitio del otro.", action: { label: "Deshacer", onClick: deshaz } });

        return;
      }
      if (destino === COMODIN || destino === FUERA) return coloca(jugadorId, destino);
      if (destino.startsWith("eq:")) return coloca(jugadorId, destino.slice(3));

      /*
      | En el césped (07/10/2026): el jugador se queda en ese punto. Si venía
      | de otro equipo, entra en éste; si el dibujo está lleno, se le abre un
      | hueco ahí en vez de echar a nadie.
      */
      if (destino.startsWith("campo:") && sesion && punto) {
        const equipoId = destino.slice(6);
        const jugador = sesion.jugadores.find((j) => j.id === jugadorId);

        if (!jugador) return;

        cambiaTarea((t1) => {
          const t = titularDe(t1, jugadorId) || t1.sitio[jugadorId] !== equipoId ? sueltaPareja(t1, jugadorId) : t1;
          const equipo = t.equipos.find((e) => e.id === equipoId);

          if (!equipo) return t;

          const suyos = repartoDe(t, sesion.jugadores).porEquipo[equipoId] ?? [];
          const { huecos } = colocaEnEstructura(suyos, equipo.estructura, puestoDe, equipo.orden, equipo.posiciones, equipo.pares);
          const guardado = paraGuardar(equipo.estructura, colocaEnPunto(huecos, jugador, punto));

          return {
            ...t,
            sitio: { ...t.sitio, [jugadorId]: equipoId },
            equipos: t.equipos.map((e) => (e.id === equipoId ? { ...e, orden: guardado.orden, posiciones: guardado.posiciones, autoOrden: undefined } : e)),
          };
        });

        return;
      }

      if (destino.startsWith("hueco:") && sesion) {
        const [, equipoId, n] = destino.split(":");
        const indice = Number(n);
        const jugador = sesion.jugadores.find((j) => j.id === jugadorId);

        if (!jugador) return;

        /* Compartir puesto: encima del que ocupa el hueco. */
        if (modoSoltar === "compartir" && tarea) {
          const equipo = tarea.equipos.find((e) => e.id === equipoId);
          const suyos = repartoDe(tarea, sesion.jugadores).porEquipo[equipoId] ?? [];
          const ocupante = equipo ? colocaEnEstructura(suyos, equipo.estructura, puestoDe, equipo.orden, equipo.posiciones, equipo.pares).huecos[indice]?.jugador : null;

          if (ocupante && ocupante.id !== jugadorId) return emparejaCon(jugadorId, ocupante.id);
        }

        cambiaTarea((t1) => {
          /* Un compañero, o uno que llega de otro equipo, deja su pareja. */
          const t = titularDe(t1, jugadorId) || t1.sitio[jugadorId] !== equipoId ? sueltaPareja(t1, jugadorId) : t1;
          const equipo = t.equipos.find((e) => e.id === equipoId);

          if (!equipo) return t;

          const suyos = repartoDe(t, sesion.jugadores).porEquipo[equipoId] ?? [];
          const { huecos } = colocaEnEstructura(suyos, equipo.estructura, puestoDe, equipo.orden, equipo.posiciones, equipo.pares);

          if (!huecos[indice]) return t;

          /* Los puntos son de los huecos: quien llega ocupa el sitio y el de antes se va al suyo. */
          const nuevos = huecos.map((h) => ({ ...h }));
          const antes = nuevos.findIndex((h) => h.jugador?.id === jugadorId);
          const desplazado = nuevos[indice].jugador;

          if (antes >= 0) nuevos[antes].jugador = desplazado;

          nuevos[indice].jugador = jugador;

          /*
          | Llega de fuera del equipo y el hueco estaba ocupado (21/10/2026): en
          | modo «Cambiar», el de antes se va al sitio que deja el que llega
          | (su equipo y su hueco, o sin colocar), como al soltar en una ficha.
          */
          if (antes < 0 && desplazado && modoSoltar === "cambiar") {
            const desde = t.sitio[jugadorId];
            const guardado = paraGuardar(equipo.estructura, guardaHuecos(nuevos));
            const sitio = { ...t.sitio, [jugadorId]: equipoId };

            if (desde === undefined) delete sitio[desplazado.id];
            else sitio[desplazado.id] = desde;

            return {
              ...t,
              sitio,
              equipos: t.equipos.map((e) =>
                e.id === equipoId
                  ? { ...e, orden: guardado.orden, posiciones: guardado.posiciones, autoOrden: undefined }
                  : e.orden?.includes(jugadorId)
                    ? { ...e, orden: e.orden.map((x) => (x === jugadorId ? desplazado.id : x)), autoOrden: undefined }
                    : e,
              ),
            };
          }

          if (antes < 0 && desplazado) {
            const libre = nuevos.findIndex((h, k) => !h.jugador && k !== indice);
            if (libre >= 0) nuevos[libre].jugador = desplazado;
          }

          const guardado = paraGuardar(equipo.estructura, guardaHuecos(nuevos));

          /* Sin hueco libre, el desplazado sigue en el equipo, fuera del dibujo. */
          if (antes < 0 && desplazado && !nuevos.some((h) => h.jugador?.id === desplazado.id)) guardado.orden.push(desplazado.id);

          return {
            ...t,
            sitio: { ...t.sitio, [jugadorId]: equipoId },
            equipos: t.equipos.map((e) => (e.id === equipoId ? { ...e, orden: guardado.orden, posiciones: guardado.posiciones, autoOrden: undefined } : e)),
          };
        });
      }
    },
    [cambiaTarea, coloca, puestoDe, sesion, modoSoltar, emparejaCon, tarea, deshaz],
  );

  /** Quita los escuchadores del arrastre en curso (también si la pantalla se va a mitad). */
  const limpiaArrastre = useRef<(() => void) | null>(null);

  useEffect(() => () => limpiaArrastre.current?.(), []);

  /** La ficha que sigue al dedo: se mueve con `transform`, sin volver a pintar la página. */
  const fantasma = useRef<HTMLDivElement | null>(null);

  const posFantasma = useRef({ x: 0, y: 0 });

  /**
   * Empieza a arrastrar a un jugador (ficha o campograma). Sin moverse, es un toque normal.
   *
   * Con el dedo (06/10/2026) el arrastre no puede arrancar con cualquier
   * movimiento: deslizar hacia abajo para bajar la página empezaba a arrastrar
   * al jugador que hubiera debajo. Ahora con el dedo arranca con una pulsación
   * de un cuarto de segundo o con un deslizamiento de lado; hacia arriba o
   * abajo, la página se desplaza. Con el ratón, como siempre.
   */
  const empiezaArrastre = useCallback(
    (jugador: JugadorSesion, color: string | undefined, e: ReactPointerEvent) => {
      if (e.button !== 0) return;

      /* Un arrastre cada vez: un segundo dedo no abre otro. */
      if (limpiaArrastre.current) return;

      const puntero = e.pointerId;
      const tactil = e.pointerType !== "mouse";
      const x0 = e.clientX;
      const y0 = e.clientY;
      let activo = false;
      let ultimo = { x: x0, y: y0 };
      let destinoActual: string | null = null;

      const destinoEn = (x: number, y: number) =>
        (document.elementFromPoint(x, y) as HTMLElement | null)?.closest<HTMLElement>("[data-destino]")?.dataset.destino ?? null;

      const coloca = (x: number, y: number) => {
        ultimo = { x, y };
        posFantasma.current = { x, y };
        if (fantasma.current) fantasma.current.style.transform = `translate(${x + 12}px, ${y - 18}px)`;
        const d = destinoEn(x, y);
        if (d !== destinoActual) {
          destinoActual = d;
          setSobre(d);
        }
      };

      const activa = () => {
        if (activo) return;
        activo = true;
        setElegido(null);
        setArrastre({ id: jugador.id, nombre: jugador.nombre, color, x: ultimo.x, y: ultimo.y });
        coloca(ultimo.x, ultimo.y);
      };

      /* Con el dedo, mantenerlo quieto un momento también lo coge. */
      const pulsacion = tactil ? window.setTimeout(activa, 250) : null;

      /*
      | La página se desplaza sola cerca del borde (21/10/2026): en el móvil la
      | tarea es más alta que la pantalla y no había forma de llevar a alguien
      | de un equipo de arriba a «No hacen esta tarea» de abajo. Encima de los
      | dos botones del pie no se desplaza, para poder soltar ahí.
      */
      let velocidad = 0;
      let bucle: number | null = null;

      const desplaza = () => {
        if (!velocidad) {
          bucle = null;
          return;
        }

        window.scrollBy(0, velocidad);
        coloca(ultimo.x, ultimo.y);
        bucle = window.requestAnimationFrame(desplaza);
      };

      const miraBorde = (y: number) => {
        const alto = window.innerHeight;

        velocidad = y > alto - 140 && y < alto - 76 ? 14 : y < 90 ? -14 : 0;

        if (velocidad && bucle === null) bucle = window.requestAnimationFrame(desplaza);
      };

      const paraDesplazar = () => {
        velocidad = 0;
        if (bucle !== null) window.cancelAnimationFrame(bucle);
        bucle = null;
      };

      const mueve = (ev: PointerEvent) => {
        if (ev.pointerId !== puntero) return;

        if (!activo) {
          const dx = ev.clientX - x0;
          const dy = ev.clientY - y0;

          if (Math.hypot(dx, dy) < 6) return;

          /* Con el dedo, un movimiento vertical antes de cogerlo es desplazar la página. */
          if (tactil && Math.abs(dy) > Math.abs(dx)) {
            termina(null, true);
            return;
          }

          ultimo = { x: ev.clientX, y: ev.clientY };
          activa();
        }

        ev.preventDefault();
        coloca(ev.clientX, ev.clientY);
        miraBorde(ev.clientY);
      };

      /* Ya cogido, el dedo no desplaza la página. */
      const sinDesplazar = (ev: TouchEvent) => {
        if (activo) ev.preventDefault();
      };

      const termina = (ev: PointerEvent | null, cancelado: boolean) => {
        if (ev && ev.pointerId !== puntero) return;

        if (pulsacion) window.clearTimeout(pulsacion);
        paraDesplazar();
        window.removeEventListener("pointermove", mueve);
        window.removeEventListener("pointerup", alSoltar);
        window.removeEventListener("pointercancel", alCancelar);
        window.removeEventListener("touchmove", sinDesplazar);
        limpiaArrastre.current = null;

        if (activo) {
          acabaDeArrastrar.current = true;
          window.setTimeout(() => (acabaDeArrastrar.current = false), 50);

          const destino = cancelado || !ev ? null : destinoEn(ev.clientX, ev.clientY);

          /* En el césped, también dónde: en tanto por uno del campo. */
          let punto: Punto | undefined;

          if (ev && destino?.startsWith("campo:")) {
            const campo = (document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null)?.closest<HTMLElement>("[data-campo-estructura]");
            const r = campo?.getBoundingClientRect();

            if (r && r.width > 0 && r.height > 0) punto = { x: (ev.clientX - r.left) / r.width, y: (ev.clientY - r.top) / r.height };
          }

          if (destino) aplicaDestino(jugador.id, destino, punto);
        }

        setArrastre(null);
        setSobre(null);
      };

      const alSoltar = (ev: PointerEvent) => termina(ev, false);
      const alCancelar = (ev: PointerEvent) => termina(ev, true);

      window.addEventListener("pointermove", mueve, { passive: false });
      window.addEventListener("pointerup", alSoltar);
      window.addEventListener("pointercancel", alCancelar);
      window.addEventListener("touchmove", sinDesplazar, { passive: false });

      /* Si la pantalla se desmonta a mitad, se suelta sin aplicar nada. */
      limpiaArrastre.current = () => {
        if (pulsacion) window.clearTimeout(pulsacion);
        paraDesplazar();
        window.removeEventListener("pointermove", mueve);
        window.removeEventListener("pointerup", alSoltar);
        window.removeEventListener("pointercancel", alCancelar);
        window.removeEventListener("touchmove", sinDesplazar);
        limpiaArrastre.current = null;
      };
    },
    [aplicaDestino],
  );


  const guardaMia = useCallback(
    (estructura: string) => {
      const limpia = normalizaEstructura(estructura);

      if (!limpia) return;

      setAlmacen((actual) => ({ ...actual, estructuras: [limpia, ...(actual.estructuras ?? []).filter((e) => e !== limpia)].slice(0, 30) }));
      toast.success(`${limpia} guardada en «Mis estructuras»`);
    },
    [setAlmacen],
  );

  const borraMia = useCallback(
    (estructura: string) => setAlmacen((actual) => ({ ...actual, estructuras: (actual.estructuras ?? []).filter((e) => e !== estructura) })),
    [setAlmacen],
  );

  /** Suelta al elegido (o al arrastrado) en un sitio. */
  const suelta = useCallback(
    (sitio: Sitio | null) => {
      const quien = arrastrado.current ?? elegido;

      arrastrado.current = null;

      if (!quien) return;

      coloca(quien, sitio);

      setElegido(null);
    },
    [coloca, elegido],
  );

  /* Con un jugador elegido: 1-6 equipo, C comodín, F fuera, Retroceso sin colocar. */
  useEffect(() => {
    if (!elegido || !tarea || presentando) return;

    const tecla = (e: KeyboardEvent) => {
      const objetivo = e.target as HTMLElement | null;

      if (
        objetivo instanceof HTMLInputElement ||
        objetivo instanceof HTMLTextAreaElement ||
        objetivo instanceof HTMLSelectElement ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey
      ) {
        return;
      }

      const n = Number(e.key);

      if (n >= 1 && n <= tarea.equipos.length) suelta(tarea.equipos[n - 1].id);
      else if (e.key.toLowerCase() === "c") suelta(COMODIN);
      else if (e.key.toLowerCase() === "f") suelta(FUERA);
      else if (e.key === "Backspace" || e.key === "0") suelta(null);
      else if (e.key === "Escape") setElegido(null);
      else return;

      e.preventDefault();
    };

    window.addEventListener("keydown", tecla);

    return () => window.removeEventListener("keydown", tecla);
  }, [elegido, tarea, suelta, presentando]);

  /* Ctrl/Cmd+Z deshace, salvo escribiendo (ahí deshace el propio campo). */
  useEffect(() => {
    if (presentando) return;

    const tecla = (e: KeyboardEvent) => {
      const objetivo = e.target as HTMLElement | null;

      if (objetivo instanceof HTMLInputElement || objetivo instanceof HTMLTextAreaElement) return;

      if (!(e.ctrlKey || e.metaKey)) return;

      const k = e.key.toLowerCase();

      if (k === "z" && !e.shiftKey) {
        e.preventDefault();
        deshaz();
      } else if (k === "y" || (k === "z" && e.shiftKey)) {
        e.preventDefault();
        rehaz();
      }
    };

    window.addEventListener("keydown", tecla);

    return () => window.removeEventListener("keydown", tecla);
  }, [deshaz, rehaz, presentando]);

  /* ---------------- sesiones ---------------- */

  /* La lista llega por WhatsApp: copiarla allí y pegarla aquí de un toque. */
  const pegaPortapapeles = async () => {
    try {
      const leido = await navigator.clipboard.readText();

      if (!leido.trim()) return toast.error("El portapapeles está vacío", { description: "Copia la lista del grupo y vuelve a pulsar." });

      setTexto(leido);
    } catch {
      toast.error("El navegador no deja leer el portapapeles", { description: "Pega con Ctrl+V (o mantén pulsado en el móvil) dentro del recuadro." });
    }
  };

  const creaSesion = () => {
    const nueva = nuevaSesion(texto);

    if (!nueva.jugadores.length) {
      toast.error("No he encontrado jugadores", {
        description: "Cada jugador en su línea, empezando por un guion: «- OSCAR NAASEI».",
      });

      return;
    }

    setAlmacen((actual) => ({ ...actual, sesiones: [nueva, ...(actual.sesiones ?? [])] }));
    setSesionId(nueva.id);
    irATarea(0);
    setDialogo(null);
    setTexto("");

    const bajas = nueva.jugadores.filter((j) => j.baja).length;

    toast.success(nueva.titulo, {
      description: `${nueva.jugadores.length - bajas} jugadores${bajas ? ` y ${bajas} de baja` : ""}.`,
    });
  };

  const cambiaLista = () => {
    if (!sesion) return;

    const antes = sesion.jugadores.length;

    const nueva = actualizaLista(sesion, texto);

    cambiaSesion(sesion.id, () => nueva);
    setDialogo(null);

    toast.success("Lista actualizada", {
      description: `${nueva.jugadores.length} jugadores (antes ${antes}). Los que seguían conservan su sitio en cada tarea.`,
    });
  };

  const borraSesion = () => {
    if (!sesion) return;

    if (!window.confirm(`¿Borrar «${sesion.titulo}» y todas sus tareas?`)) return;

    setAlmacen((actual) => ({ ...actual, sesiones: (actual.sesiones ?? []).filter((s) => s.id !== sesion.id) }));
    setSesionId(null);

    /* Con su «Deshacer» a mano (19/10/2026): el botón de arriba ya lo hacía,
       pero tras un borrado nadie lo busca. */
    toast.success(`«${sesion.titulo}» borrada`, { action: { label: "Deshacer", onClick: deshaz } });
  };

  /* ---------------- tareas ---------------- */

  const anadeTarea = () => {
    if (!sesion) return;

    const nueva = nuevaTarea(sesion.tareas.length + 1, sesion.jugadores);

    /* La nueva hereda equipos y colores de la que se está viendo: casi siempre
       se juega con los mismos petos. El reparto, vacío. */
    const conMolde: TareaEquipos = tarea
      ? {
          ...nueva,
          /* Sólo el peto y el dibujo (19/10/2026): con `...e` viajaban también
             los huecos, los puntos y las parejas de la tarea anterior, y dos
             que compartían puesto allí volvían a quedar emparejados en ésta
             en cuanto se les metía en ese equipo. */
          equipos: tarea.equipos.map((e) => ({
            id: `${e.id}-${nueva.id.slice(-4)}`,
            nombre: e.nombre,
            color: e.color,
            ...(e.estructura ? { estructura: e.estructura } : {}),
          })),
          comodines: tarea.comodines,
          colorComodin: tarea.colorComodin,
        }
      : nueva;

    cambiaSesion(sesion.id, (s) => ({ ...s, tareas: [...s.tareas, conMolde] }));
    irATarea(sesion.tareas.length);
  };

  const duplica = () => {
    if (!sesion || !tarea) return;

    const copia = duplicaTarea(tarea, `${tarea.nombre} (copia)`);

    cambiaSesion(sesion.id, (s) => {
      const tareas = [...s.tareas];

      tareas.splice(activa + 1, 0, copia);

      return { ...s, tareas };
    });

    irATarea(activa + 1);
  };

  const copiaAnterior = () => {
    if (!sesion || !tarea || activa === 0) return;

    const previa = sesion.tareas[activa - 1];

    const molde = duplicaTarea(previa, tarea.nombre);

    cambiaTarea((t) => ({ ...molde, id: t.id, nombre: t.nombre }));

    toast.success(`Equipos de «${previa.nombre}» copiados`);
  };

  /** Al portapapeles, con el formato que se lee bien en WhatsApp. */
  const copiaTexto = async (todo: boolean) => {
    if (!sesion || !tarea) return;

    const texto = todo ? textoDeSesion(sesion) : textoDeTarea(tarea, sesion, activa + 1);

    try {
      await navigator.clipboard.writeText(texto);

      toast.success(todo ? "Todas las tareas copiadas" : "Equipos copiados", {
        description: "Pégalos en el grupo: un equipo por línea.",
      });
    } catch {
      toast.error("El navegador no deja copiar", { description: "Prueba otra vez con la página en primer plano." });
    }
  };

  /* WhatsApp con el texto de toda la sesión (21/10/2026): wa.me abre la app y se elige el grupo; aquí no se manda nada. */
  const mandaAlGrupo = () => {
    if (!sesion) return;
    /* Primero WhatsApp, en el mismo toque (si no, el navegador lo bloquea); luego se descarga la imagen para adjuntarla. */
    window.open(`https://wa.me/?text=${encodeURIComponent(textoDeSesion(sesion))}`, "_blank", "noopener");
    void exporta(laminasDe(sesion.tareas.map((_, i) => i)), "vertical");
  };

  /*
  | AÑADIR, QUITAR O REEMPLAZAR A UN JUGADOR DE LA SESIÓN (08/10/2026).
  |
  | Sin volver a pegar la lista: llega uno tarde, se cae otro o se cambia
  | uno por otro. Reemplazar conserva el identificador, así que el nuevo
  | hereda el sitio del que se va en todas las tareas.
  */
  const [nuevoNombre, setNuevoNombre] = useState("");

  const [reemplazando, setReemplazando] = useState<{ id: string; texto: string } | null>(null);

  const anade = () => {
    const nombre = nuevoNombre.trim();

    if (!sesion || !nombre) return;

    if (yaEnLaSesion(sesion, nombre)) {
      toast.error("Ese jugador ya está en la sesión");
      return;
    }

    cambiaSesion(sesion.id, (s) => anadeJugador(s, nombre));
    setNuevoNombre("");
    toast.success(`${nombre.toUpperCase()} añadido a la sesión`, { description: "Queda sin colocar en cada tarea: arrástralo a su equipo." });
  };

  const reemplaza = () => {
    if (!sesion || !reemplazando) return;

    const nombre = reemplazando.texto.trim();
    const antes = sesion.jugadores.find((j) => j.id === reemplazando.id);

    if (!nombre || !antes) return setReemplazando(null);

    if (yaEnLaSesion(sesion, nombre, reemplazando.id)) {
      toast.error("Ese jugador ya está en la sesión", { description: "Para cambiarlo por otro de la lista, quita a uno de los dos." });
      return;
    }

    cambiaSesion(sesion.id, (s) => reemplazaJugador(s, reemplazando.id, nombre));
    setReemplazando(null);
    toast.success(`${antes.nombre} → ${nombre.toUpperCase()}`, { description: "Ocupa su sitio en todas las tareas.", action: { label: "Deshacer", onClick: deshaz } });
  };

  const quita = (j: JugadorSesion) => {
    if (!sesion) return;

    if (!window.confirm(`¿Quitar a ${j.nombre} de la sesión? Sale de todas las tareas.`)) return;

    cambiaSesion(sesion.id, (s) => quitaJugador(s, j.id));
    if (elegido === j.id) setElegido(null);
    toast.success(`${j.nombre} fuera de la sesión`, { action: { label: "Deshacer", onClick: deshaz } });
  };

  /* Los nombres de la plantilla del club que aún no están en la sesión: sugerencias al añadir o reemplazar. */
  const sugerenciasPlantilla = useMemo(
    () =>
      sesion
        ? [...new Set(plantilla.map((pl) => (pl.nombre ?? "").toUpperCase()).filter(Boolean))].filter((n) => !yaEnLaSesion(sesion, n)).sort()
        : [],
    [plantilla, sesion],
  );

  /* La demarcación a mano (14/10/2026): fija también el puesto de cinco, que es el que usan el validador y el sorteo. */
  const ponDemarcacion = (jugadorId: string, valor: string) => {
    if (valor.startsWith("p:")) return;
    if (!sesion) return;

    cambiaSesion(sesion.id, (s) => ({
      ...s,
      jugadores: s.jugadores.map((j) => {
        if (j.id !== jugadorId) return j;

        const { puesto: _p, demarcacion: _d, ...resto } = j;

        void _p;
        void _d;

        const d = demarcacion(valor as Demarcacion);

        return d ? { ...resto, demarcacion: d.clave, puesto: d.puesto } : resto;
      }),
    }));
  };


  const quitaTarea = () => {
    if (!sesion || !tarea || sesion.tareas.length <= 1) return;

    if (Object.keys(tarea.sitio).length > 3 && !window.confirm(`¿Quitar «${tarea.nombre}»?`)) return;

    cambiaSesion(sesion.id, (s) => ({ ...s, tareas: s.tareas.filter((t) => t.id !== tarea.id) }));
    irATarea(Math.max(0, activa - 1));

    /* Con tres o menos colocados se quita sin preguntar: que se pueda volver atrás. */
    toast.success(`«${tarea.nombre}» quitada`, { action: { label: "Deshacer", onClick: deshaz } });
  };

  const mueveTarea = (desde: number, hasta: number) => {
    if (!sesion || desde === hasta) return;

    cambiaSesion(sesion.id, (s) => {
      const tareas = [...s.tareas];

      const [movida] = tareas.splice(desde, 1);

      tareas.splice(hasta, 0, movida);

      return { ...s, tareas };
    });

    irATarea(hasta);
  };

  const tiraArrastrada = useRef<number | null>(null);

  /* ---------------- exportar ---------------- */

  const lienzos = useRef<HTMLDivElement | null>(null);

  /** Las diapositivas de unas tareas: con cambio a mitad, dos (inicio y tras el cambio). */
  const laminasDe = (indices: number[]) =>
    indices.flatMap((i) => (sesion?.tareas[i]?.cambio ? [{ i, fase: "inicio" as Fase }, { i, fase: "cambio" as Fase }] : [{ i, fase: "inicio" as Fase }]));

  const exporta = async (laminas: { i: number; fase: Fase }[], formato: "jpg" | "pdf" | "vertical" = "jpg") => {
    if (!sesion || exportando || !laminas.length) return;

    setExportando({ laminas, paso: "Preparando…" });

    try {
      await pintado();
      await document.fonts?.ready;
      await pintado();

      const raiz = lienzos.current;

      if (!raiz) throw new Error("no se ha podido montar la imagen");

      const imagenes = await capturaLienzos(raiz, "[data-lamina-equipos]", {
        ancho: LAMINA_W,
        alto: LAMINA_H,
        /*
        | Blanco, como la lámina (21/10/2026). `html-to-image` pone este color
        | de fondo al nodo que captura, encima del suyo: con el azul noche de
        | antes la imagen y el PDF salían con el marco oscuro que no se veía en
        | la vista previa.
        */
        fondo: "#FFFFFF",
        alPaso: (hechas, total) => setExportando({ laminas, paso: `Imagen ${hechas} de ${total}…` }),
      });

      /*
      | En un solo PDF (21/10/2026): una página por diapositiva, en el orden de
      | la sesión. Es lo que se manda al grupo o se deja en la tableta del campo
      | de una vez, sin diez imágenes sueltas.
      */
      /*
      | Para el móvil (21/10/2026): la sesión entera en una imagen vertical de
      | 1080 × 1920, las diapositivas una debajo de otra. Es la que se adjunta
      | al mensaje del grupo; se descarga y la adjunta el analista.
      */
      if (formato === "vertical") {
        setExportando({ laminas, paso: "Montando la imagen vertical…" });

        const lienzo = document.createElement("canvas");
        lienzo.width = 1080;
        lienzo.height = 1920;
        const ctx = lienzo.getContext("2d");
        if (!ctx) throw new Error("el navegador no deja dibujar la imagen");

        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, 1080, 1920);
        ctx.fillStyle = "#0B1A33";
        ctx.fillRect(0, 0, 1080, 12);
        ctx.font = "700 40px sans-serif";
        ctx.fillText(sesion.titulo.toUpperCase(), 40, 80, 1000);

        const arriba = 120;
        const sitio = (1920 - arriba - 30) / imagenes.length;
        const alto = Math.min(LAMINA_H * (1000 / LAMINA_W), sitio - 20);
        const ancho = alto * (LAMINA_W / LAMINA_H);

        for (let k = 0; k < imagenes.length; k += 1) {
          const img = new Image();
          img.src = imagenes[k];
          await img.decode();
          ctx.drawImage(img, (1080 - ancho) / 2, arriba + k * sitio, ancho, alto);
        }

        const blob = await new Promise<Blob | null>((listo) => lienzo.toBlob(listo, "image/png"));
        if (!blob) throw new Error("no se ha podido montar la imagen");

        descarga(blob, `${apodo(sesion.titulo, "sesion")}-movil.png`);
        toast.success("Imagen para el móvil descargada", { description: "Adjúntala al mensaje del grupo." });

        return;
      }

      if (formato === "pdf") {
        setExportando({ laminas, paso: "Montando el PDF…" });

        const doc = await pdfDeLienzos(imagenes, { ancho: LAMINA_W, alto: LAMINA_H, orientacion: "landscape", margen: 0 });

        descarga(doc.output("blob") as Blob, `${apodo(sesion.titulo, "sesion")}-equipos.pdf`);
        toast.success("PDF descargado", { description: `${imagenes.length} ${imagenes.length === 1 ? "página" : "páginas"}, una por diapositiva.` });

        return;
      }

      const nombreDe = ({ i, fase: f }: { i: number; fase: Fase }) =>
        `${String(i + 1).padStart(2, "0")}${f === "cambio" ? "b" : ""}-${apodo(sesion.tareas[i].nombre, "tarea")}${f === "cambio" ? "-tras-el-cambio" : ""}.jpg`;

      /*
      | Una a una, sin .zip (08/10/2026): cada imagen se descarga suelta, de
      | seguido. Con un respiro entre una y otra, porque el navegador ignora
      | descargas disparadas en el mismo instante (la primera vez puede
      | preguntar si se permiten varias: hay que decir que sí).
      */
      for (let k = 0; k < imagenes.length; k += 1) {
        if (k > 0) await new Promise((listo) => window.setTimeout(listo, 450));

        setExportando({ laminas, paso: `Descargando ${k + 1} de ${imagenes.length}…` });

        const blob = await fetch(imagenes[k]).then((r) => r.blob());

        descarga(blob, `${apodo(sesion.titulo, "sesion")}-${nombreDe(laminas[k])}`);
      }

      toast.success(imagenes.length === 1 ? "Imagen descargada" : `${imagenes.length} imágenes descargadas, una a una`, {
        description: imagenes.length > 1 ? "Si el navegador pregunta si permite varias descargas, di que sí." : undefined,
      });
    } catch (error) {
      toast.error("No se ha podido exportar", {
        description: error instanceof Error ? error.message : "Inténtalo otra vez",
      });
    } finally {
      setExportando(null);
    }
  };

  /* ---------------- lo que se ve ---------------- */

  const reparto = sesion && tarea ? repartoDe(tarea, sesion.jugadores) : null;

  const delDia = useMemo(() => tareasDelDia(registro, sesion?.fecha), [registro, sesion?.fecha]);
  const contexto = useMemo(() => contextoDeSesion(delDia), [delDia]);
  const detalles = useMemo(() => (sesion ? detallesDeTareas(sesion.tareas.map((t) => t.nombre), delDia) : []), [sesion, delDia]);
  const detalleDe = (i: number) => (sesion ? lineaDeDetalle(detalles[i], sesion.tareas[i]?.nombre ?? "") : "");

  /* Los que hacen la tarea sin demarcación: el reparto «por puesto» no sabe dónde juegan (21/10/2026). */
  const sinDemarcacion = sesion && reparto ? [...Object.values(reparto.porEquipo).flat(), ...reparto.comodines, ...reparto.sinSitio].filter((j) => !puestoDe(j)) : [];

  const enLaTarea = reparto ? [...Object.values(reparto.porEquipo).flat(), ...reparto.comodines] : [];

  /*
  | El formato de la hoja contra los colocados (21/10/2026): «8v8+1» son 17, y
  | si en la tarea hay 20, o sobran tres o son comodines. Lo pidió el entrenador:
  | la diapositiva ya trae el formato de la hoja y no puede decir otra cosa.
  */
  const avisoDeFormato = ((): Aviso[] => {
    const formato = detalles[activa]?.formato ?? "";
    const m = formato.match(/(\d+)\s*v\s*(\d+)(?:\s*\+\s*(\d+))?/i);
    if (!m || !reparto) return [];
    const esperados = Number(m[1]) + Number(m[2]) + Number(m[3] ?? 0);
    const hay = enLaTarea.length;
    if (!hay || hay === esperados) return [];
    const dif = Math.abs(hay - esperados);
    return [
      {
        nivel: "aviso",
        texto:
          hay > esperados
            ? `La hoja dice ${formato.trim()} (${esperados}) y hay ${hay} colocados: ¿${dif} ${dif === 1 ? "sobra o es comodín" : "sobran o son comodines"}?`
            : `La hoja dice ${formato.trim()} (${esperados}) y hay ${hay} colocados: ${dif === 1 ? "falta 1" : `faltan ${dif}`}.`,
      },
    ];
  })();

  const avisos = sesion && tarea ? [...valida(tarea, sesion, puestoDe), ...avisoDeFormato] : [];

  /* Hay líneas descompensadas: el «10/10 huecos» no puede quedarse en verde. */
  const lineasDescompensadas = avisos.some((a) => a.nivel === "aviso" && /descompensad/i.test(a.texto));

  /* De dónde sale el puesto de cada uno de la tarea: lo que el reparto sabe de ellos. */
  const origenPuestos = enLaTarea.reduce(
    (cuenta, j) => {
      if (j.demarcacion || j.puesto || demarcacionesAuto[j.id] || puestosAuto[j.id]) cuenta.suya += 1;
      else if (demarcacionDe(j)) cuenta.vuestra += 1;
      else cuenta.sin += 1;
      return cuenta;
    },
    { suya: 0, vuestra: 0, sin: 0 },
  );

  const estadoTareas = useMemo(
    () => (sesion ? sesion.tareas.map((t) => valida(t, sesion, puestoDe)) : []),
    [sesion, puestoDe],
  );

  const rotacion = useMemo(() => (sesion ? rotacionDe(sesion) : []), [sesion]);

  /* Las veces que cada uno ha sido comodín en las OTRAS tareas: para rotar. */
  const vecesComodin = useMemo(() => {
    const veces: Record<string, number> = {};

    if (!sesion || !tarea) return veces;

    for (const t of sesion.tareas) {
      if (t.id === tarea.id) continue;

      for (const [id, donde] of Object.entries(t.sitio)) if (donde === COMODIN) veces[id] = (veces[id] ?? 0) + 1;
    }

    return veces;
  }, [sesion, tarea]);

  const opcionesReparto = { puestoDe, vecesComodin };

  const [refPrevia, anchoPrevia] = useAncho<HTMLDivElement>();

  const disponibles = sesion?.jugadores.filter((j) => !j.baja).length ?? 0;
  const bajas = sesion?.jugadores.filter((j) => j.baja) ?? [];

  const colorDe = (sitio: Sitio | undefined) => {
    if (!tarea || !sitio) return undefined;

    if (sitio === COMODIN) return tarea.colorComodin;

    return tarea.equipos.find((e) => e.id === sitio)?.color;
  };

  const chip = (j: JugadorSesion) => {
    const donde = tarea?.sitio[j.id];
    const enEquipo = Boolean(donde && donde !== FUERA);

    return (
      <Chip
        key={j.id}
        jugador={j}
        color={colorDe(donde)}
        puesto={puestoDe(j)}
        seleccionado={elegido === j.id}
        arrastrando={arrastre?.id === j.id}
        onClick={() => {
          if (acabaDeArrastrar.current) return;
          setElegido((actual) => (actual === j.id ? null : j.id));
        }}
        onPointerDown={(e) => empiezaArrastre(j, colorDe(donde), e)}
        onQuitar={enEquipo ? () => coloca(j.id, null) : undefined}
        destino={`jug:${j.id}`}
        encima={sobre === `jug:${j.id}`}
        conQuien={(() => {
          if (!tarea) return undefined;
          const otro = titularDe(tarea, j.id) ?? companeroDe(tarea, j.id);
          return otro ? sesion?.jugadores.find((x) => x.id === otro)?.nombre : undefined;
        })()}
      />
    );
  };

  /** Una lista de equipo con cada compañero justo detrás de su titular. */
  const conParejasJuntas = (lista: JugadorSesion[], pares?: Record<string, string>) => {
    const parejas = parejasDe(lista, pares);
    const companeros = new Set([...parejas.values()].map((j) => j.id));

    return ordenPorPuesto(lista.filter((j) => !companeros.has(j.id)), puestoDe).flatMap((j) => (parejas.has(j.id) ? [j, parejas.get(j.id)!] : [j]));
  };

  /* Lo pegado en el diálogo que aún no se ha usado: nueva lista, o una lista cambiada sin «Actualizar». */
  const listaSinUsar = dialogo === "nueva" ? Boolean(texto.trim()) : dialogo === "lista" && texto !== (sesion?.texto ?? "");

  const enTarea = reparto
    ? Object.values(reparto.porEquipo).reduce((s, l) => s + l.length, 0) + reparto.comodines.length
    : 0;

  return (
    <main
      className="min-h-screen bg-[#0B0F14] text-white"
      style={{ ["--fuente-sesion" as string]: barlowCondensed.style.fontFamily }}
    >
      <div className="flex">
        <Sidebar />

        <section className="flex min-w-0 flex-1 flex-col">
          <Topbar />

          <div className="min-w-0 px-4 py-6 sm:px-6 lg:px-10">
            <AbpHeader
              area="RMCF Castilla · Entrenamiento"
              title="Jugadores sesión"
              lead="Pega la lista del día y haz los equipos de cada tarea. Una diapositiva por tarea, lista para proyectar o mandar en imagen."
              aside={<SaveState status={status} localOnly={localOnly} savedAt={lastSavedAt} sinGuardar={sinGuardar} onGuardar={() => void guardaYa()} />}
            />

            {/* ---------------- BARRA DE SESIÓN ---------------- */}

            {sesion && (
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <label className="min-w-0">
                  <span className="sr-only">Sesión</span>
                  <select
                    value={sesion.id}
                    onChange={(e) => {
                      setSesionId(e.target.value);
                      irATarea(0);
                      setElegido(null);
                    }}
                    className="max-w-[320px] truncate rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm font-semibold text-white outline-none focus:border-[#C8A96B]/50"
                  >
                    {sesiones.map((s) => (
                      <option key={s.id} value={s.id} className="bg-[#11161C]">
                        {s.titulo}
                      </option>
                    ))}
                  </select>
                </label>

                <span className="text-[12px] text-white/45">
                  <Users size={12} className="mr-1 inline" />
                  {disponibles} disponibles
                  {bajas.length ? ` · ${bajas.length} de baja` : ""}
                </span>

                <span className="flex-1" />

                <Button icon={Undo2} disabled={pasos.atras === 0} onClick={deshaz} title="Deshacer el último cambio (Ctrl+Z)">
                  Deshacer
                </Button>
                <Button icon={Redo2} disabled={pasos.adelante === 0} onClick={rehaz} title="Rehacer lo deshecho (Ctrl+Y)" aria-label="Rehacer" />

                <Button icon={MessageSquareText} onClick={() => void copiaTexto(true)} title="Todas las tareas en texto, para el grupo">
                  Copiar todo
                </Button>
                <Button
                  icon={ClipboardPaste}
                  onClick={() => {
                    setTexto(sesion.texto);
                    setDialogo("lista");
                  }}
                >
                  Cambiar la lista
                </Button>
                <Button
                  icon={Plus}
                  onClick={() => {
                    setTexto("");
                    setDialogo("nueva");
                  }}
                >
                  Nueva sesión
                </Button>
                <Button tone="danger" icon={Trash2} onClick={borraSesion} title="Borrar esta sesión" aria-label="Borrar esta sesión" />
              </div>
            )}

            {/* ---------------- SIN SESIÓN: PEGAR ---------------- */}

            {!sesion && status !== "loading" && (
              <div className="mx-auto mt-8 max-w-2xl">
                <Panel title="Pega la lista del día" subtitle="Tal cual la manda el delegado: título, listado y lesionados" icon={ClipboardPaste}>
                  <textarea
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                    rows={14}
                    placeholder={EJEMPLO}
                    aria-label="Lista del día"
                    className="w-full resize-y rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 font-mono text-[13px] text-white outline-none placeholder:text-white/20 focus:border-[#C8A96B]/50"
                  />
                  <LecturaLista texto={texto} />
                  <div className="mt-3 flex flex-wrap justify-end gap-2">
                    <Button icon={ClipboardPaste} onClick={() => void pegaPortapapeles()} title="Pega lo que hayas copiado del grupo">
                      Pegar del portapapeles
                    </Button>
                    <Button tone="primary" icon={Wand2} disabled={!texto.trim()} onClick={creaSesion}>
                      Crear la sesión
                    </Button>
                  </div>
                </Panel>
              </div>
            )}

            {status === "loading" && !sesion && (
              <p className="mt-10 flex items-center gap-2 text-sm text-white/40">
                <Loader2 size={14} className="animate-spin" /> Cargando…
              </p>
            )}

            {sesion && tarea && reparto && (
              <>
                {/* ---------------- TIRA DE TAREAS ---------------- */}

                <div className="mt-5 flex min-w-0 flex-wrap items-stretch gap-1.5">
                  {sesion.tareas.map((t, i) => {
                    const suyos = estadoTareas[i] ?? [];

                    const punto = !tareaLista(suyos)
                      ? "bg-red-400"
                      : suyos.some((a) => a.nivel === "aviso")
                        ? "bg-amber-300"
                        : "bg-emerald-400";

                    return (
                      <button
                        key={t.id}
                        type="button"
                        draggable
                        onDragStart={(e) => {
                          tiraArrastrada.current = i;
                          e.dataTransfer.setData("text/plain", t.id);
                        }}
                        onDragOver={(e) => {
                          if (tiraArrastrada.current !== null) e.preventDefault();
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (tiraArrastrada.current !== null) mueveTarea(tiraArrastrada.current, i);
                          tiraArrastrada.current = null;
                        }}
                        onClick={() => {
                          irATarea(i);
                          setElegido(null);
                        }}
                        title={`${t.nombre}: ${suyos.filter((a) => a.nivel === "error" || a.nivel === "aviso").map((a) => a.texto).join(" · ") || "lista"}. Arrástrala para cambiar el orden.`}
                        aria-label={`Tarea ${i + 1}: ${t.nombre}. ${!tareaLista(suyos) ? "Hay algo que corregir" : suyos.some((a) => a.nivel === "aviso") ? "Con avisos" : "Lista"}`}
                        aria-current={i === activa ? "true" : undefined}
                        className={`flex min-w-0 cursor-grab items-center gap-2 rounded-xl border px-3 py-2 text-left transition active:cursor-grabbing ${
                          i === activa
                            ? "border-[#C8A96B] bg-[#C8A96B]/12 text-white"
                            : "border-white/10 text-white/60 hover:border-white/25 hover:text-white"
                        }`}
                      >
                        <GripVertical size={12} className="shrink-0 text-white/25" />
                        <span className={`h-2 w-2 shrink-0 rounded-full ${punto}`} />
                        <span className="max-w-[170px] truncate text-[12px] font-semibold uppercase tracking-wide">
                          {i + 1}. {t.nombre}
                        </span>
                        <span className="flex shrink-0 -space-x-1">
                          {t.equipos.map((e) => (
                            <span key={e.id} className="h-3 w-3 rounded-full border border-[#0B0F14]" style={{ background: e.color }} />
                          ))}
                        </span>
                      </button>
                    );
                  })}

                  <button
                    type="button"
                    onClick={anadeTarea}
                    className="flex items-center gap-1.5 rounded-xl border border-dashed border-white/15 px-3 py-2 text-[12px] font-semibold text-white/55 transition hover:border-[#C8A96B]/60 hover:text-white"
                  >
                    <Plus size={13} /> Tarea
                  </button>
                </div>

                <div className="mt-4">
                  <Pestanas
                    etiqueta="Vistas de la sesión"
                    valor={vista}
                    onCambia={setVista}
                    opciones={[
                      { clave: "equipos", label: "Equipos", icono: UsersRound },
                      { clave: "diapositivas", label: "Diapositivas", icono: Expand, cuenta: sesion.tareas.length },
                      { clave: "plantilla", label: "Plantilla del día", icono: Repeat2, cuenta: sesion.jugadores.length },
                    ]}
                  />
                </div>

                <div className={`mt-4 grid min-w-0 gap-5 ${vista === "equipos" ? "2xl:grid-cols-[minmax(0,1fr)_minmax(0,420px)]" : ""}`}>
                  {/* ================= EDITOR ================= */}
                  {vista === "equipos" && (
                  <div className="min-w-0 space-y-4">
                    {/* --- configuración de la tarea --- */}
                    <div className="flex min-w-0 flex-wrap items-end gap-x-5 gap-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <label className="block min-w-[200px] flex-1">
                        <span className="mb-1.5 block text-[10px] uppercase tracking-[0.16em] text-white/40">Tarea</span>
                        <input
                          value={tarea.nombre}
                          onChange={(e) => cambiaTarea((t) => ({ ...t, nombre: e.target.value }), `nombre:${tarea.id}`)}
                          placeholder="Rondo 4v4+3"
                          className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-base font-semibold text-white outline-none focus:border-[#C8A96B]/50"
                        />
                      </label>

                      {/* Las reglas en una línea (21/10/2026): salen bajo el título de la diapositiva, con lo que trae la hoja de registro. */}
                      <label className="block min-w-[220px] flex-[2]">
                        <span className="mb-1.5 block text-[10px] uppercase tracking-[0.16em] text-white/40">
                          Reglas <span className="normal-case tracking-normal text-white/30">(salen en la diapositiva)</span>
                        </span>
                        <input
                          value={tarea.reglas ?? ""}
                          onChange={(e) => cambiaTarea((t) => ({ ...t, reglas: e.target.value || undefined }), `reglas:${tarea.id}`)}
                          placeholder="Máx. 3 toques; gol = 8 pases seguidos"
                          className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[13px] text-white outline-none placeholder:text-white/30 focus:border-[#C8A96B]/50"
                        />
                        {detalleDe(activa) && <span className="mt-1 block truncate text-[11px] text-white/45" title="Lo que trae la hoja de registro para esta tarea">De la hoja: {detalleDe(activa)}</span>}
                      </label>

                      <div>
                        <span className="mb-1.5 block text-[10px] uppercase tracking-[0.16em] text-white/40">Equipos</span>
                        <Segmented
                          ariaLabel="Número de equipos"
                          value={String(tarea.equipos.length)}
                          options={["1", "2", "3", "4", "5", "6"].map((n) => ({ key: n, label: n }))}
                          onChange={(n) => cambiaTarea((t) => conEquipos(t, Number(n)))}
                        />
                      </div>

                      <div>
                        <span className="mb-1.5 block text-[10px] uppercase tracking-[0.16em] text-white/40">Formato</span>
                        <Segmented
                          ariaLabel="Sólo equipos o con estructura"
                          value={tarea.conEstructura ? "estructura" : "equipos"}
                          options={[
                            { key: "equipos", label: "Sólo equipos" },
                            { key: "estructura", label: "Con estructura" },
                          ]}
                          onChange={(v) =>
                            cambiaTarea((t) => ({
                              ...t,
                              conEstructura: v === "estructura",
                              /* Al encenderla, cada equipo sin dibujo recibe el que pega con los que tiene. */
                              equipos:
                                v === "estructura"
                                  ? t.equipos.map((e) => ({
                                      ...e,
                                      estructura: e.estructura || estructuraPara(Object.values(t.sitio).filter((d) => d === e.id).length || 7),
                                    }))
                                  : t.equipos,
                            }))
                          }
                        />
                      </div>

                      <div>
                        <span className="mb-1.5 block text-[10px] uppercase tracking-[0.16em] text-white/40">Cambio a mitad</span>
                        {tareaBase?.cambio ? (
                          <div className="flex items-center gap-1.5">
                            <Segmented
                              ariaLabel="Qué momento de la tarea se edita"
                              value={fase}
                              options={[
                                { key: "inicio", label: "Inicio" },
                                { key: "cambio", label: "Tras el cambio" },
                              ]}
                              onChange={(v) => {
                                setFase(v);
                                setElegido(null);
                                setHuecoTocado(null);
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                if (!window.confirm("¿Quitar el cambio a mitad de tarea? Se queda sólo el inicio.")) return;
                                cambiaTareaBase(quitaCambio);
                                setFase("inicio");
                              }}
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-white/45 transition hover:border-red-300/40 hover:text-red-300"
                              title="Quitar el cambio a mitad de tarea"
                              aria-label="Quitar el cambio a mitad de tarea"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <Button
                            icon={Repeat2}
                            onClick={() => {
                              cambiaTareaBase(creaCambio);
                              setFase("cambio");
                              toast.success("Marcado el cambio a mitad de tarea", {
                                description: "Ahora estás en «Tras el cambio»: mueve a quien cambie de equipo o de sitio. El inicio no se toca.",
                              });
                            }}
                            title="Marcar qué jugadores cambian de equipo o de sitio a mitad de tarea"
                          >
                            Marcar cambio
                          </Button>
                        )}
                      </div>

                      <div>
                        <span className="mb-1.5 block text-[10px] uppercase tracking-[0.16em] text-white/40">Al soltar encima de otro</span>
                        <Segmented
                          ariaLabel="Qué pasa al soltar a un jugador encima de otro"
                          value={modoSoltar}
                          options={[
                            { key: "cambiar", label: "Cambiar" },
                            { key: "compartir", label: "Compartir puesto" },
                          ]}
                          onChange={setModoSoltar}
                        />
                      </div>

                      {tarea.conEstructura && (
                        <div>
                          <span className="mb-1.5 block text-[10px] uppercase tracking-[0.16em] text-white/40">Tamaño del campo</span>
                          <Segmented
                            ariaLabel="Tamaño del campo"
                            value={campoGrande ? "grande" : "normal"}
                            options={[
                              { key: "normal", label: "Normal" },
                              { key: "grande", label: "Campo grande" },
                            ]}
                            onChange={(v) => setCampoGrande(v === "grande")}
                          />
                        </div>
                      )}

                      <div>
                        <span className="mb-1.5 block text-[10px] uppercase tracking-[0.16em] text-white/40">Comodines</span>
                        <div className="flex items-center gap-2">
                          <Segmented
                            ariaLabel="¿Hay comodines?"
                            value={tarea.comodines > 0 ? "si" : "no"}
                            options={[
                              { key: "no", label: "No" },
                              { key: "si", label: "Sí" },
                            ]}
                            onChange={(v) =>
                              cambiaTarea((t) => {
                                if (v === "si") return { ...t, comodines: Math.max(1, t.comodines || 2) };

                                /* Sin comodines: los que lo eran se quedan sin colocar. */
                                const sitio = { ...t.sitio };

                                for (const [id, d] of Object.entries(sitio)) if (d === COMODIN) delete sitio[id];

                                return { ...t, comodines: 0, sitio };
                              })
                            }
                          />
                          {tarea.comodines > 0 && (
                            <>
                              <Contador
                                valor={tarea.comodines}
                                min={1}
                                max={8}
                                onCambia={(n) => cambiaTarea((t) => ({ ...t, comodines: n }))}
                              />
                              <Muestra
                                color={tarea.colorComodin}
                                titulo="Color de los comodines"
                                onCambia={(c) => cambiaTarea((t) => ({ ...t, colorComodin: c }))}
                              />
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          icon={Wand2}
                          disabled={!reparto.sinSitio.length}
                          onClick={() => cambiaTarea((t) => completaReparto(t, sesion.jugadores, opcionesReparto))}
                          title="Coloca a los que faltan en el equipo más corto, sin mover a los demás"
                        >
                          Completar
                        </Button>
                        <Button
                          icon={Shuffle}
                          onClick={() => {
                            /* Sin preguntar (21/10/2026): con «Deshacer» a mano en el aviso, pulsar otra vez es pedir otra propuesta. */
                            cambiaTarea((t) => sorteaReparto(t, sesion.jugadores, opcionesReparto));
                            toast.success(enTarea > 0 ? "Otra propuesta de equipos" : "Equipos propuestos", {
                              description: `Parejos por puesto (por su demarcación; el nivel no se mide): porteros separados, laterales, centrales, medios y puntas repartidos.${sinDemarcacion.length ? ` ${sinDemarcacion.length} sin demarcación van donde haya sitio.` : ""} Pulsa otra vez para otra.`,
                              action: enTarea > 0 ? { label: "Deshacer", onClick: deshaz } : undefined,
                            });
                          }}
                          title="Equipos parejos por puesto con todos los que hacen la tarea; cada vez, una propuesta distinta"
                        >
                          {enTarea > 0 ? "Otra propuesta" : "Proponer equipos"}
                        </Button>
                        <Button
                          icon={Eraser}
                          disabled={enTarea === 0}
                          onClick={() => {
                            cambiaTarea((t) => ({
                              ...t,
                              sitio: Object.fromEntries(Object.entries(t.sitio).filter(([, d]) => d === FUERA)),
                              equipos: t.equipos.map((e) => ({ ...e, orden: undefined, posiciones: undefined, pares: undefined, autoOrden: undefined })),
                            }));
                            toast.success("Tarea vaciada", { action: { label: "Deshacer", onClick: deshaz } });
                          }}
                          title="Saca a todos de los equipos y los comodines de esta tarea (se puede deshacer)"
                        >
                          Vaciar
                        </Button>
                        <Button icon={Copy} disabled={activa === 0 || fase === "cambio"} onClick={copiaAnterior} title="Mismos equipos, colores y comodines que la tarea anterior">
                          Como la anterior
                        </Button>
                        <Button icon={Plus} onClick={duplica} title="Duplicar esta tarea con sus equipos">
                          Duplicar
                        </Button>
                        {/* Reordenar sin arrastrar (21/10/2026): la tira sólo se arrastra con ratón; en la tableta y con teclado, así. */}
                        <Button icon={ChevronLeft} disabled={activa === 0} onClick={() => mueveTarea(activa, activa - 1)} title="Mover esta tarea un puesto antes" aria-label="Mover la tarea antes" />
                        <Button icon={ChevronRight} disabled={activa >= sesion.tareas.length - 1} onClick={() => mueveTarea(activa, activa + 1)} title="Mover esta tarea un puesto después" aria-label="Mover la tarea después" />
                        <Button tone="danger" icon={Trash2} disabled={sesion.tareas.length <= 1} onClick={quitaTarea} title="Quitar esta tarea" aria-label="Quitar esta tarea" />
                      </div>
                    </div>

                    {/*
                    | --- estado de la tarea, a la vista (21/10/2026) ---
                    | El validador iba al final de la página (o a la derecha sólo
                    | en pantallas muy anchas): con el portátil o el móvil nadie
                    | lo veía mientras hacía los equipos. Aquí, en una línea.
                    */}
                    {(() => {
                      const problemas = avisos.filter((a) => a.nivel === "error" || a.nivel === "aviso");
                      const grave = problemas.some((a) => a.nivel === "error");

                      return (
                        <div
                          role="status"
                          className={`flex min-w-0 items-start gap-2 rounded-xl border px-3 py-2 text-[12px] leading-snug ${
                            grave ? "border-red-400/30 bg-red-500/[0.06] text-red-200" : problemas.length ? "border-amber-400/40 bg-amber-400/[0.05] text-amber-100" : "border-emerald-400/30 bg-emerald-400/[0.05] text-emerald-200"
                          }`}
                        >
                          {grave ? ICONO_AVISO.error : problemas.length ? ICONO_AVISO.aviso : ICONO_AVISO.ok}
                          <span className="min-w-0">
                            {problemas.length
                              ? problemas.map((a) => a.texto).join(" · ")
                              : "Lista para presentar: nadie olvidado, nadie repetido y equipos parejos por puesto."}
                            {sinDemarcacion.length > 0 && (
                              <span className="mt-1 block">
                                {sinDemarcacion.length === 1 ? "1 sin demarcación" : `${sinDemarcacion.length} sin demarcación`} ({sinDemarcacion.map((j) => j.nombre).join(", ")}): el reparto por puesto no sabe dónde juegan.{" "}
                                <button type="button" onClick={() => setVista("plantilla")} className="font-semibold underline underline-offset-2">
                                  Asignar
                                </button>
                              </span>
                            )}
                            {problemas
                              .filter((a) => a.arreglo)
                              .map((a) => (
                                <button
                                  key={a.arreglo!.a}
                                  type="button"
                                  onClick={() => {
                                    cambiaTarea((t) => intercambiaSitios(t, a.arreglo!.a, a.arreglo!.b));
                                    toast.success(a.arreglo!.texto, { action: { label: "Deshacer", onClick: deshaz } });
                                  }}
                                  className="ml-1 mt-1 inline-flex rounded-md border border-current px-1.5 py-0.5 text-[11px] font-semibold"
                                >
                                  {a.arreglo!.texto}
                                </button>
                              ))}
                          </span>
                        </div>
                      );
                    })()}

                    {/* --- sin colocar --- */}
                    <Caja
                      destino="sin"
                      encima={sobre === "sin"}
                      titulo={reparto.sinSitio.length ? "Sin colocar" : "Todos colocados"}
                      cuenta={reparto.sinSitio.length}
                      activa={Boolean(elegido)}
                      alerta={reparto.sinSitio.length > 0}
                      tenue={reparto.sinSitio.length === 0}
                      compacta={reparto.sinSitio.length === 0}
                      atajo="0"
                      onSoltar={() => suelta(null)}
                      vacio="Nadie pendiente. Arrastra a un jugador para cambiarlo de sitio, o tócalo y toca su sitio."
                    >
                      {ordenPorPuesto(reparto.sinSitio, puestoDe).map(chip)}
                    </Caja>

                    {elegido && (
                      <p className="-mt-2 text-[11px] text-[#C8A96B]">
                        <b>{sesion.jugadores.find((j) => j.id === elegido)?.nombre}</b>: toca su equipo
                        {tarea.equipos.length > 1 ? ` (o pulsa 1-${tarea.equipos.length}` : " (o pulsa 1"}
                        {tarea.comodines > 0 ? ", C comodín" : ""}, F fuera, Esc cancelar)
                      </p>
                    )}

                    {/* --- el cambio a mitad de tarea --- */}
                    {tareaBase?.cambio && sesion && (
                      <div
                        className={`rounded-2xl border px-4 py-3 ${fase === "cambio" ? "border-[#C8A96B]/60 bg-[#C8A96B]/[0.08]" : "border-white/10 bg-white/[0.02]"}`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.14em] text-[#E9D5A8]">
                            <Repeat2 size={14} />
                            {fase === "cambio" ? "Editando: tras el cambio" : "Inicio de la tarea"}
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              setFase(fase === "cambio" ? "inicio" : "cambio");
                              setElegido(null);
                              setHuecoTocado(null);
                            }}
                            className="text-[11px] font-semibold text-white/60 underline-offset-2 hover:text-white hover:underline"
                          >
                            {fase === "cambio" ? "Ver el inicio" : "Ir a «Tras el cambio»"}
                          </button>
                        </div>
                        {(() => {
                          const lista = cambiosDe(tareaBase, sesion.jugadores, puestoDe);

                          return lista.length ? (
                            <ul className="mt-2 grid gap-1 text-[12px] text-white/75 sm:grid-cols-2">
                              {lista.map((c) => (
                                <li key={c.jugador.id} className="flex min-w-0 items-baseline gap-2">
                                  <ArrowRight size={12} className="shrink-0 translate-y-0.5 text-[#C8A96B]" />
                                  <span className="min-w-0">
                                    <b className="uppercase text-white">{c.jugador.nombre}</b> · {c.texto}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="mt-1.5 text-[12px] text-white/50">
                              Todavía no cambia nadie. En «Tras el cambio», mueve a quien cambie de equipo, de sitio en el campo o de pareja.
                            </p>
                          );
                        })()}
                      </div>
                    )}

                    {/* --- equipos --- */}
                    <div
                      className="grid min-w-0 gap-3"
                      style={{
                        gridTemplateColumns: tarea.conEstructura
                          ? `repeat(auto-fit, minmax(min(100%, ${campoGrande ? 480 : 300}px), 1fr))`
                          : `repeat(auto-fit, minmax(${tarea.equipos.length + (tarea.comodines > 0 ? 1 : 0) > 4 ? 170 : 210}px, 1fr))`,
                      }}
                    >
                      {tarea.equipos.map((equipo, i) => (
                        <Caja
                          key={equipo.id}
                          destino={`eq:${equipo.id}`}
                          encima={sobre === `eq:${equipo.id}` || Boolean(sobre?.startsWith(`hueco:${equipo.id}:`))}
                          titulo={equipo.nombre}
                          color={equipo.color}
                          resumen={<ResumenPuestos jugadores={reparto.porEquipo[equipo.id] ?? []} puestoDe={puestoDe} color={equipo.color} />}
                          cuenta={reparto.porEquipo[equipo.id]?.length ?? 0}
                          activa={Boolean(elegido)}
                          atajo={String(i + 1)}
                          onSoltar={() => suelta(equipo.id)}
                          vacio="Suelta aquí"
                          cabecera={
                            <>
                              <Muestra
                                color={equipo.color}
                                titulo="Color del equipo"
                                onCambia={(c) =>
                                  cambiaTarea((t) => ({
                                    ...t,
                                    equipos: t.equipos.map((e) =>
                                      e.id === equipo.id
                                        ? {
                                            ...e,
                                            color: c,
                                            /* Si el nombre era el del color, cambia con él. */
                                            nombre:
                                              e.nombre.toUpperCase() === nombreDeColor(e.color).toUpperCase()
                                                ? nombreDeColor(c).toUpperCase()
                                                : e.nombre,
                                          }
                                        : e,
                                    ),
                                  }))
                                }
                              />
                              <input
                                value={equipo.nombre}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) =>
                                  cambiaTarea((t) => ({
                                    ...t,
                                    equipos: t.equipos.map((x) => (x.id === equipo.id ? { ...x, nombre: e.target.value.toUpperCase() } : x)),
                                  }), `equipo:${equipo.id}`)
                                }
                                className="w-full min-w-0 bg-transparent text-[12px] font-bold uppercase tracking-[0.12em] outline-none placeholder:opacity-50"
                                style={{ color: "inherit" }}
                                aria-label="Nombre del equipo"
                              />
                            </>
                          }
                        >
                          {tarea.conEstructura && (
                            <EstructuraEquipo
                              equipo={equipo}
                              descompensado={lineasDescompensadas}
                              jugadores={reparto.porEquipo[equipo.id] ?? []}
                              puestoDe={puestoDe}
                              elegido={huecoTocado?.equipo === equipo.id ? huecoTocado.hueco : null}
                              sobre={sobre}
                              grande={campoGrande}
                              mias={misEstructuras}
                              onGuardaMia={guardaMia}
                              onBorraMia={borraMia}
                              onRecoloca={() =>
                                cambiaTarea((t) => ({
                                  ...t,
                                  equipos: t.equipos.map((x) => (x.id === equipo.id ? { ...x, orden: undefined, posiciones: undefined } : x)),
                                }))
                              }
                              onArrastra={(j, e) => empiezaArrastre(j, equipo.color, e)}
                              onEstructura={(estructura) =>
                                cambiaTarea((t) => ({
                                  ...t,
                                  /*
                                  | Otro dibujo (14/10/2026): si cambian las líneas, cada uno va al hueco
                                  | nuevo más parecido al que tenía (el lateral sigue en su banda, el de
                                  | atrás sigue atrás) en vez de borrar lo colocado. Es colocación de la
                                  | herramienta (`autoOrden`): no se aprende de ella.
                                  */
                                  equipos: t.equipos.map((x) => {
                                    if (x.id !== equipo.id) return x;
                                    if (lineasDe(x.estructura).join("-") === lineasDe(estructura).join("-")) return { ...x, estructura };

                                    const antes = colocaEnEstructura(reparto.porEquipo[equipo.id] ?? [], x.estructura, puestoDe, x.orden, x.posiciones, x.pares).huecos;
                                    const viejos = antes.flatMap((h) => (h.jugador ? [{ id: h.jugador.id, punto: { x: h.x, y: h.y }, preferido: puestoDe.preferido?.(h.jugador) }] : []));

                                    if (!viejos.length) return { ...x, estructura, orden: undefined, posiciones: undefined, autoOrden: undefined };

                                    const lineasCampo = lineasDe(estructura).slice(conPortero(estructura) ? 1 : 0);
                                    const orden = reubicaEnDibujo(viejos, puntosDeLineas(lineasCampo));
                                    const fuera = viejos.filter((v) => !orden.includes(v.id)).map((v) => v.id);
                                    const guardado = paraGuardar(estructura, { orden: [...orden, ...fuera] });

                                    return { ...x, estructura, orden: guardado.orden, posiciones: undefined, autoOrden: true };
                                  }),
                                }))
                              }
                              onToca={(hueco, huecos) => {
                                if (acabaDeArrastrar.current) return;
                                if (!huecoTocado || huecoTocado.equipo !== equipo.id) {
                                  if (huecos[hueco]?.jugador) setHuecoTocado({ equipo: equipo.id, hueco });
                                  return;
                                }
                                if (huecoTocado.hueco !== hueco) {
                                  const { orden, posiciones } = paraGuardar(equipo.estructura, intercambia(huecos, huecoTocado.hueco, hueco));
                                  cambiaTarea((t) => ({ ...t, equipos: t.equipos.map((x) => (x.id === equipo.id ? { ...x, orden, posiciones, autoOrden: undefined } : x)) }));
                                }
                                setHuecoTocado(null);
                              }}
                            />
                          )}
                          {(tarea.conEstructura
                            ? (({ sobran, porteros, huecos }) => [...porteros, ...sobran, ...huecos.flatMap((h) => (h.pareja ? [h.pareja] : []))])(
                                colocaEnEstructura(reparto.porEquipo[equipo.id] ?? [], equipo.estructura, puestoDe, equipo.orden, equipo.posiciones, equipo.pares),
                              )
                            : conParejasJuntas(reparto.porEquipo[equipo.id] ?? [], equipo.pares)
                          ).map(chip)}
                        </Caja>
                      ))}

                      {tarea.comodines > 0 && (
                        <Caja
                          destino={COMODIN}
                          encima={sobre === COMODIN}
                          titulo={tarea.comodines === 1 ? "Comodín" : "Comodines"}
                          color={tarea.colorComodin}
                          cuenta={reparto.comodines.length}
                          objetivo={tarea.comodines}
                          activa={Boolean(elegido)}
                          atajo="C"
                          onSoltar={() => suelta(COMODIN)}
                          vacio="Suelta aquí los comodines"
                        >
                          {ordenPorPuesto(reparto.comodines, puestoDe).map(chip)}
                        </Caja>
                      )}
                    </div>

                    <BarraReparto
                      total={enTarea + reparto.sinSitio.length}
                      tramos={[
                        ...tarea.equipos.map((e) => ({ clave: e.id, nombre: e.nombre, color: e.color, n: reparto.porEquipo[e.id]?.length ?? 0 })),
                        { clave: "comodin", nombre: reparto.comodines.length === 1 ? "Comodín" : "Comodines", color: tarea.colorComodin, n: reparto.comodines.length },
                        { clave: "sin", nombre: "Sin colocar", color: "#F59E0B", n: reparto.sinSitio.length, rayado: true },
                      ]}
                    />
                    <p className="-mt-2 text-[11px] text-white/40">
                      {enTarea} en la tarea
                      {reparto.fuera.length ? ` · ${reparto.fuera.length} no la hacen` : ""}
                    </p>

                    {/* --- fuera --- */}
                    <Caja
                      destino={FUERA}
                      encima={sobre === FUERA}
                      titulo="No hacen esta tarea"
                      cuenta={reparto.fuera.length}
                      activa={Boolean(elegido)}
                      tenue
                      compacta={reparto.fuera.length === 0}
                      atajo="F"
                      onSoltar={() => suelta(FUERA)}
                      vacio="Los lesionados empiezan aquí; si alguno hace la tarea, muévelo a un equipo."
                    >
                      {ordenPorPuesto(reparto.fuera, puestoDe).map(chip)}
                    </Caja>
                  </div>
                  )}

                  {/* ================= DERECHA ================= */}
                  <div className="min-w-0 space-y-4">
                    {vista === "equipos" && (
                    <Panel
                      title="Validador"
                      subtitle={!tareaLista(avisos) ? "Hay algo que corregir" : avisos.some((a) => a.nivel === "aviso") ? "Lista, con avisos que mirar" : "Lista para presentar"}
                      icon={tareaLista(avisos) ? Check : AlertTriangle}
                      bodyClassName="p-4"
                    >
                      <ul className="space-y-1.5 text-[12px] leading-snug">
                        {avisos.map((a) => (
                          <li
                            key={a.texto}
                            className={`flex items-start gap-2 ${
                              a.nivel === "error" ? "text-red-200" : a.nivel === "aviso" ? "text-amber-100" : a.nivel === "info" ? "text-sky-100" : "text-white/60"
                            }`}
                          >
                            {ICONO_AVISO[a.nivel]}
                            <span>{a.texto}</span>
                          </li>
                        ))}
                      </ul>
                      {/*
                      | El criterio, siempre a la vista (21/10/2026): «parejos» sólo lo decía
                      | el aviso al proponer, y desaparecía. Y de dónde sale el puesto de los
                      | de esta tarea, que es lo que el reparto sabe de ellos.
                      */}
                      <p className="mt-3 rounded-lg border border-white/8 bg-white/[0.03] px-2.5 py-2 text-[11px] leading-snug text-white/55">
                        <span className="font-semibold text-white/75">Criterio del reparto:</span> misma demarcación, sí · nivel, no se mide.
                        {enLaTarea.length > 0 && (
                          <span className="mt-1 block text-white/45">
                            {[
                              origenPuestos.suya ? `${origenPuestos.suya} por su demarcación` : "",
                              origenPuestos.vuestra ? `${origenPuestos.vuestra} por dónde los colocáis` : "",
                              origenPuestos.sin ? `${origenPuestos.sin} sin demarcación, donde haya sitio` : "",
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        )}
                      </p>
                      {estadoTareas.some((s) => !tareaLista(s)) && (
                        <p className="mt-3 border-t border-white/8 pt-2 text-[11px] text-white/40">
                          Por revisar:{" "}
                          {sesion.tareas
                            .map((t, i) => ({ t, error: (estadoTareas[i] ?? []).find((a) => a.nivel === "error") }))
                            .filter((x) => x.error)
                            .map((x) => `${x.t.nombre} (${x.error!.texto.charAt(0).toLowerCase()}${x.error!.texto.slice(1)})`)
                            .join(" · ")}
                        </p>
                      )}
                    </Panel>

                    )}

                    {vista === "diapositivas" && (
                    <Panel
                      title="Diapositiva"
                      subtitle={`${activa + 1} de ${sesion.tareas.length} · ${enTarea} en la tarea`}
                      icon={Expand}
                      bodyClassName="p-3"
                      action={
                        <div className="flex flex-wrap gap-1.5">
                          <Button icon={Expand} onClick={() => setPresentando(true)}>
                            Presentar
                          </Button>
                          <Button icon={MessageSquareText} onClick={() => void copiaTexto(false)} title="Los equipos de esta tarea en texto, para el grupo">
                            Copiar texto
                          </Button>
                          <Button icon={Download} disabled={Boolean(exportando)} onClick={() => void exporta([{ i: activa, fase }])} title="Esta tarea en imagen (.jpg), en el momento que estás viendo">
                            Descargar esta
                          </Button>
                          <Button
                            tone="primary"
                            icon={exportando ? Loader2 : Download}
                            disabled={Boolean(exportando)}
                            onClick={() => void exporta(laminasDe(sesion.tareas.map((_, i) => i)))}
                            title="Todas las tareas, una imagen cada una (dos si hay cambio a mitad), descargadas una a una"
                          >
                            {exportando ? exportando.paso : `Descargar las ${laminasDe(sesion.tareas.map((_, i) => i)).length}`}
                          </Button>
                          <Button
                            icon={FileDown}
                            disabled={Boolean(exportando)}
                            onClick={() => void exporta(laminasDe(sesion.tareas.map((_, i) => i)), "pdf")}
                            title="Todas las tareas en un solo PDF, una página por diapositiva"
                          >
                            PDF de la sesión
                          </Button>
                          <Button
                            icon={Send}
                            onClick={mandaAlGrupo}
                            title="Abre WhatsApp con los equipos de todas las tareas en texto y descarga la sesión en una imagen vertical para adjuntarla (no se manda nada solo)"
                          >
                            Mandar al grupo
                          </Button>
                        </div>
                      }
                    >
                      {/* En el móvil la diapositiva entera queda diminuta (21/10/2026): tocarla la abre en grande. */}
                      <div
                        ref={refPrevia}
                        className="w-full min-w-0 cursor-zoom-in overflow-hidden rounded-xl sm:cursor-default"
                        onClick={() => {
                          if (window.innerWidth < 640) setPresentando(true);
                        }}
                        title="En el móvil, toca para verla en grande"
                      >
                        {anchoPrevia > 0 && (
                          <LaminaEscalada ancho={anchoPrevia} puestoDe={puestoDe} sesion={sesion} tarea={tareaBase ?? tarea} fase={fase} cabecera={conCabecera} indice={activa} total={sesion.tareas.length} detalle={detalleDe(activa)} contexto={contexto} />
                        )}
                      </div>
                      <label className="mt-2 flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[12px] text-white/75 transition hover:border-white/25">
                        <input
                          type="checkbox"
                          checked={conCabecera}
                          onChange={(e) => setConCabecera(e.target.checked)}
                          className="h-3.5 w-3.5 accent-[#C8A96B]"
                        />
                        <span className="min-w-0">
                          Con cabecera <span className="text-white/40">(título de la tarea, sesión y pie). Sin marcar, la imagen lleva sólo los equipos.</span>
                        </span>
                      </label>
                      <div className="mt-2 flex items-center justify-between text-[11px] text-white/40">
                        <button type="button" disabled={activa === 0} onClick={() => { irATarea(activa - 1); setElegido(null); }} className="inline-flex items-center gap-1 hover:text-white disabled:opacity-30">
                          <ChevronLeft size={13} /> Anterior
                        </button>
                        <span className="sm:hidden">Toca la diapositiva para verla en grande</span>
                        <span className="hidden sm:inline">Lista para proyectar o mandar</span>
                        <button type="button" disabled={activa >= sesion.tareas.length - 1} onClick={() => { irATarea(activa + 1); setElegido(null); }} className="inline-flex items-center gap-1 hover:text-white disabled:opacity-30">
                          Siguiente <ChevronRight size={13} />
                        </button>
                      </div>
                    </Panel>

                    )}

                    {/* --- plantilla del día: puestos y rotación --- */}
                    {vista === "plantilla" && (
                    <Panel
                      title="Plantilla del día"
                      subtitle="Demarcación de cada uno (para colocarlos en el dibujo y repartir parejo), cuántas veces ha sido comodín o ha descansado, y añadir, reemplazar o quitar jugadores"
                      icon={Repeat2}
                      bodyClassName="p-0"
                    >
                      <form
                        className="flex flex-wrap items-center gap-2 border-b border-white/[0.06] px-3 py-2.5 md:px-4"
                        onSubmit={(e) => {
                          e.preventDefault();
                          anade();
                        }}
                      >
                        <input
                          value={nuevoNombre}
                          onChange={(e) => setNuevoNombre(e.target.value)}
                          list="plantilla-club"
                          placeholder="Añadir jugador (nombre, y la etiqueta entre paréntesis si la lleva)"
                          aria-label="Nombre del jugador que se añade"
                          className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[12px] uppercase text-white outline-none placeholder:normal-case placeholder:text-white/30 focus:border-[#C8A96B]/50"
                        />
                        <Button tone="primary" icon={Plus} disabled={!nuevoNombre.trim()} onClick={anade}>
                          Añadir
                        </Button>
                        <datalist id="plantilla-club">
                          {sugerenciasPlantilla.map((n) => (
                            <option key={n} value={n} />
                          ))}
                        </datalist>
                      </form>
                      <div className="max-h-[420px] overflow-y-auto">
                        <table className="w-full text-[12px]">
                          <thead className="sticky top-0 bg-[#11161C] text-[10px] uppercase tracking-[0.14em] text-white/35">
                            <tr>
                              <th className="px-4 py-2 text-left font-medium">Jugador</th>
                              <th className="hidden px-2 py-2 text-left font-medium sm:table-cell">Puesto</th>
                              <th className="px-2 py-2 text-center font-medium" title="Tareas de esta sesión como comodín (vacío: ninguna)">Com.</th>
                              <th className="px-2 py-2 text-center font-medium" title="Tareas de esta sesión sin participar (vacío: ninguna)">Fuera</th>
                              <th className="px-2 py-2 text-right font-medium">
                                <span className="sr-only">Reemplazar o quitar</span>
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {ordenPorPuesto(
                              rotacion.map((r) => r.jugador),
                              puestoDe,
                            ).map((j) => {
                              const r = rotacion.find((x) => x.jugador.id === j.id)!;

                              const auto = puestosAuto[j.id];

                              /* En el móvil va debajo del nombre (21/10/2026): en su columna, la tabla no cabía y los botones de reemplazar y quitar quedaban fuera. */
                              const selector = (
                                      <select
                                        value={j.demarcacion ?? (j.puesto ? `p:${j.puesto}` : "")}
                                        onChange={(e) => ponDemarcacion(j.id, e.target.value)}
                                        aria-label={`Demarcación de ${j.nombre}`}
                                        className={`rounded-lg border bg-transparent px-1.5 py-1 text-[11px] outline-none focus:border-[#C8A96B]/50 ${
                                          j.puesto || j.demarcacion ? "border-[#C8A96B]/40 text-white" : "border-white/10 text-white/50"
                                        }`}
                                      >
                                        <option value="" className="bg-[#11161C]">
                                          {demarcacionesAuto[j.id]
                                            ? `${demarcacion(demarcacionesAuto[j.id])?.nombre} (plantilla)`
                                            : auto
                                              ? `${PUESTOS.find((p) => p.clave === auto)?.nombre} (plantilla)`
                                              : demarcacionDe(j)
                                                ? `${demarcacion(demarcacionDe(j))?.nombre} (por dónde lo colocáis)`
                                                : "Elige su demarcación"}
                                        </option>
                                        {DEMARCACIONES.map((d) => (
                                          <option key={d.clave} value={d.clave} className="bg-[#11161C]">
                                            {d.nombre}
                                          </option>
                                        ))}
                                        {j.puesto && !j.demarcacion ? (
                                          <option value={`p:${j.puesto}`} className="bg-[#11161C]">
                                            {PUESTOS.find((p) => p.clave === j.puesto)?.nombre} (sin banda)
                                          </option>
                                        ) : null}
                                      </select>
                              );

                              return (
                                <tr key={j.id} className="border-t border-white/[0.05]">
                                  <td className="min-w-[128px] px-3 py-1.5 md:px-4">
                                    {reemplazando?.id === j.id ? (
                                      <form
                                        className="flex items-center gap-1"
                                        onSubmit={(e) => {
                                          e.preventDefault();
                                          reemplaza();
                                        }}
                                      >
                                        <input
                                          autoFocus
                                          value={reemplazando.texto}
                                          onChange={(e) => setReemplazando({ id: j.id, texto: e.target.value })}
                                          onKeyDown={(e) => {
                                            if (e.key === "Escape") setReemplazando(null);
                                          }}
                                          list="plantilla-club"
                                          placeholder={`En lugar de ${j.nombre}`}
                                          aria-label={`Quién entra en lugar de ${j.nombre}`}
                                          className="min-w-0 flex-1 rounded-md border border-[#C8A96B]/50 bg-white/[0.04] px-2 py-1 text-[12px] uppercase text-white outline-none placeholder:normal-case placeholder:text-white/30"
                                        />
                                        <button type="submit" className="rounded-md p-1 text-emerald-300 hover:bg-emerald-400/15" aria-label="Confirmar el reemplazo" title="Reemplazar">
                                          <Check size={14} />
                                        </button>
                                        <button type="button" onClick={() => setReemplazando(null)} className="rounded-md p-1 text-white/45 hover:bg-white/10" aria-label="Cancelar" title="Cancelar">
                                          <X size={14} />
                                        </button>
                                      </form>
                                    ) : (
                                      <span className="block font-semibold uppercase leading-tight text-white/80">
                                        {j.nombre}
                                        {j.etiqueta && <span className="ml-1.5 text-[10px] text-[#C8A96B]">{j.etiqueta}</span>}
                                        {j.baja && <span className="ml-1.5 text-[10px] text-red-300">{j.baja.toLowerCase()}</span>}
                                      </span>
                                    )}
                                    {reemplazando?.id !== j.id && <div className="mt-1 sm:hidden">{selector}</div>}
                                  </td>
                                  <td className="hidden px-2 py-1 sm:table-cell">
                                    {selector}
                                  </td>
                                  <td className={`px-2 py-1 text-center tabular-nums ${r.comodin >= 2 ? "font-bold text-amber-300" : r.comodin ? "text-white/70" : "text-white/30"}`}>
                                    {r.comodin || ""}
                                  </td>
                                  <td className={`px-2 py-1 text-center tabular-nums ${r.fuera >= 2 && !j.baja ? "font-bold text-amber-300" : r.fuera ? "text-white/70" : "text-white/30"}`}>
                                    {r.fuera || ""}
                                  </td>
                                  <td className="whitespace-nowrap px-2 py-1 text-right">
                                    <button
                                      type="button"
                                      onClick={() => setReemplazando({ id: j.id, texto: "" })}
                                      className="rounded-md p-1.5 text-white/40 transition hover:bg-white/10 hover:text-white"
                                      title="Reemplazar: otro jugador ocupa su sitio en todas las tareas"
                                      aria-label={`Reemplazar a ${j.nombre}`}
                                    >
                                      <Repeat2 size={14} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => quita(j)}
                                      className="rounded-md p-1.5 text-white/40 transition hover:bg-red-400/15 hover:text-red-300"
                                      title="Quitar de la sesión (sale de todas las tareas)"
                                      aria-label={`Quitar a ${j.nombre} de la sesión`}
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </Panel>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </section>
      </div>

      {/* ---------------- DIÁLOGO: LISTA ---------------- */}

      {dialogo && (
        <Dialog
          title={dialogo === "nueva" ? "Nueva sesión" : "Cambiar la lista"}
          subtitle={
            dialogo === "nueva"
              ? "Pega la lista del delegado tal cual"
              : "Los que siguen conservan su sitio en cada tarea; los nuevos quedan sin colocar"
          }
          onClose={() => setDialogo(null)}
          sinGuardar={listaSinUsar}
          footer={
            <div className="flex flex-wrap justify-end gap-2">
              <Button icon={ClipboardPaste} onClick={() => void pegaPortapapeles()} title="Pega lo que hayas copiado del grupo">
                Pegar
              </Button>
              <span className="flex-1" />
              {/* Como la X y Escape: si hay lista pegada sin usar, pregunta antes de tirarla. */}
              <Button onClick={() => sePuedeDescartar(listaSinUsar) && setDialogo(null)}>Cancelar</Button>
              <Button tone="primary" icon={Wand2} disabled={!texto.trim()} onClick={dialogo === "nueva" ? creaSesion : cambiaLista}>
                {dialogo === "nueva" ? "Crear la sesión" : "Actualizar"}
              </Button>
            </div>
          }
        >
          <textarea
            autoFocus
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={16}
            placeholder={EJEMPLO}
            aria-label="Lista del día"
            className="w-full resize-y rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 font-mono text-[13px] text-white outline-none placeholder:text-white/20 focus:border-[#C8A96B]/50"
          />
          <LecturaLista texto={texto} sesion={dialogo === "lista" ? sesion : null} />
        </Dialog>
      )}

      {/* ---------------- PRESENTACIÓN ---------------- */}

      {presentando && sesion && (
        <Presentacion
          sesion={sesion}
          inicial={activa}
          puestoDe={puestoDe}
          detalleDe={detalleDe}
          contexto={contexto}
          onCierra={(ultima) => {
            setPresentando(false);
            irATarea(ultima);
          }}
        />
      )}

      {/* ---------------- LIENZOS PARA EXPORTAR (fuera de pantalla) ---------------- */}

      {exportando && sesion && (
        <div
          ref={lienzos}
          aria-hidden
          style={{ position: "fixed", left: -30000, top: 0, width: LAMINA_W, pointerEvents: "none" }}
        >
          {exportando.laminas.map(({ i, fase: f }) => (
            <LaminaEquipos key={`${sesion.tareas[i].id}-${f}`} puestoDe={puestoDe} sesion={sesion} tarea={sesion.tareas[i]} fase={f} cabecera={conCabecera} indice={i} total={sesion.tareas.length} detalle={detalleDe(i)} contexto={contexto} />
          ))}
        </div>
      )}

      {/* ---------------- EL ARRASTRE EN CURSO ---------------- */}

      {arrastre && (
        <>
          <div
            aria-hidden
            ref={(el) => {
              /* La posición la pone el arrastre, nunca el render: si no, cada repintado la devolvía al principio. */
              fantasma.current = el;
              if (el) el.style.transform = `translate(${posFantasma.current.x + 12}px, ${posFantasma.current.y - 18}px)`;
            }}
            className="pointer-events-none fixed left-0 top-0 z-[90] flex items-center gap-2 rounded-lg border border-[#C8A96B] bg-[#11161C]/95 px-3 py-1.5 text-[12px] font-bold uppercase tracking-wide text-white shadow-2xl"
          >
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: arrastre.color ?? "rgba(255,255,255,0.3)" }} />
            {arrastre.nombre}
          </div>

          {/* Abajo, siempre a mano: quitarlo del equipo o dejarlo fuera de la tarea. */}
          <div className="fixed inset-x-0 bottom-3 z-[80] flex justify-center gap-2 px-4">
            {[
              { destino: "sin", rotulo: "Quitar del equipo", pie: "queda sin colocar" },
              { destino: FUERA, rotulo: "No hace esta tarea", pie: "descansa o va aparte" },
            ].map((z) => (
              <div
                key={z.destino}
                data-destino={z.destino}
                className={`flex min-w-[140px] flex-col items-center rounded-2xl border-2 border-dashed px-4 py-1.5 text-center shadow-2xl backdrop-blur transition ${
                  sobre === z.destino ? "scale-105 border-red-300 bg-red-500/30 text-white" : "border-white/30 bg-[#0B0F14]/90 text-white/80"
                }`}
              >
                <span className="text-sm font-bold">{z.rotulo}</span>
                <span className="text-[11px] text-white/50">{z.pie}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  );
}

/* ------------------------------------------------------------------ */
/*  MODO PRESENTACIÓN                                                  */
/* ------------------------------------------------------------------ */

function Presentacion({
  sesion,
  inicial,
  onCierra,
  puestoDe,
  detalleDe,
  contexto,
}: {
  sesion: SesionEquipos;
  inicial: number;
  onCierra: (ultima: number) => void;
  puestoDe: PuestoDe;
  detalleDe: (i: number) => string;
  contexto: ReturnType<typeof contextoDeSesion>;
}) {
  /* Cada tarea es una diapositiva; con cambio a mitad, dos. */
  const pasos = useMemo(
    () => sesion.tareas.flatMap((t, k) => (t.cambio ? [{ k, fase: "inicio" as Fase }, { k, fase: "cambio" as Fase }] : [{ k, fase: "inicio" as Fase }])),
    [sesion.tareas],
  );

  const [i, setI] = useState(() => Math.max(0, pasos.findIndex((p) => p.k === inicial)));

  const [hueco, setHueco] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const mide = () => setHueco({ w: window.innerWidth, h: window.innerHeight });

    mide();

    window.addEventListener("resize", mide);

    document.documentElement.requestFullscreen?.().catch(() => {});

    return () => {
      window.removeEventListener("resize", mide);

      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    };
  }, []);

  /* En pantalla completa, Esc lo consume el navegador para salir de ella y la
     página no recibe la tecla: la capa negra se quedaba puesta. Salir de la
     pantalla completa es salir de la presentación. */
  const ultima = useRef(pasos[i]?.k ?? 0);

  /* `onCierra` llega nuevo en cada render: en una ref, para no volver a
     enganchar el oyente (y perder el «entró») cada vez. */
  const cierra = useRef(onCierra);

  useEffect(() => {
    ultima.current = pasos[i]?.k ?? 0;
    cierra.current = onCierra;
  });

  useEffect(() => {
    let entro = false;

    const cambia = () => {
      if (document.fullscreenElement) entro = true;
      else if (entro) cierra.current(ultima.current);
    };

    document.addEventListener("fullscreenchange", cambia);

    return () => document.removeEventListener("fullscreenchange", cambia);
  }, []);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") setI((n) => Math.min(pasos.length - 1, n + 1));
      else if (e.key === "ArrowLeft" || e.key === "PageUp") setI((n) => Math.max(0, n - 1));
      else if (e.key === "Escape") onCierra(pasos[i]?.k ?? 0);
      else return;

      e.preventDefault();
    };

    window.addEventListener("keydown", tecla);

    return () => window.removeEventListener("keydown", tecla);
  }, [i, onCierra, pasos]);

  const ancho = Math.min(hueco.w, (hueco.h * 16) / 9);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center" style={{ background: "#FFFFFF" }} onClick={() => setI((n) => Math.min(pasos.length - 1, n + 1))}>
      {ancho > 0 && pasos[i] && (
        <LaminaEscalada ancho={ancho} puestoDe={puestoDe} sesion={sesion} tarea={sesion.tareas[pasos[i].k]} fase={pasos[i].fase} indice={pasos[i].k} total={sesion.tareas.length} detalle={detalleDe(pasos[i].k)} contexto={contexto} />
      )}

      <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full px-2 py-1 opacity-80 shadow-lg transition hover:opacity-100"
        style={{ background: "rgba(11,26,51,0.88)", color: "#FFFFFF" }} onClick={(e) => e.stopPropagation()}>
        <button type="button" aria-label="Anterior" onClick={() => setI((n) => Math.max(0, n - 1))} className="rounded-full p-1.5 hover:bg-white/15">
          <ArrowLeft size={16} />
        </button>
        <span className="text-xs tabular-nums">
          {i + 1} / {pasos.length}
        </span>
        <button type="button" aria-label="Siguiente" onClick={() => setI((n) => Math.min(pasos.length - 1, n + 1))} className="rounded-full p-1.5 hover:bg-white/15">
          <ArrowRight size={16} />
        </button>
        {/* La tarea, no el paso: con cambios a mitad hay más pasos que tareas y se volvía a otra. */}
        <button type="button" aria-label="Salir" onClick={() => onCierra(pasos[i]?.k ?? 0)} className="rounded-full p-1.5 hover:bg-white/15">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
