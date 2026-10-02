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

import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";
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
  MessageSquareText,
  Repeat2,
  Users,
  Wand2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { AbpHeader, Button, Dialog, Panel, SaveState, Segmented } from "@/components/abp/ui";
import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { LAMINA_H, LAMINA_W, LaminaEquipos, LaminaEscalada } from "@/components/sesion-equipos/LaminaEquipos";
import { useRemoteDoc } from "@/hooks/useRemoteDoc";
import { apodo, capturaLienzos, descarga, pintado } from "@/lib/export/lienzos";
import { bytesDeDataUrl, creaZip } from "@/lib/export/zip";
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
  duplicaTarea,
  nombreDeColor,
  nuevaSesion,
  nuevaTarea,
  ordenPorPuesto,
  puestosDesdePlantilla,
  repartoDe,
  rotacionDe,
  sorteaReparto,
  tareaLista,
  textoDeSesion,
  textoDeTarea,
  tintaSobre,
  valida,
  type AlmacenEquipos,
  type JugadorSesion,
  type Puesto,
  type PuestoDe,
  type SesionEquipos,
  type Sitio,
  type TareaEquipos,
} from "@/lib/sesion-equipos/modelo";
import { usePlayers } from "@/hooks/usePlayers";

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

function Chip({
  jugador,
  color,
  puesto,
  seleccionado,
  onClick,
  onDragStart,
}: {
  jugador: JugadorSesion;
  color?: string;
  puesto?: Puesto;
  seleccionado: boolean;
  onClick: () => void;
  onDragStart: (e: DragEvent) => void;
}) {
  return (
    <button
      type="button"
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      title="Tócalo y luego toca dónde va (o arrástralo). Con él elegido: 1-6 equipo, C comodín, F fuera"
      className={`group flex min-w-0 items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left text-[12px] font-semibold uppercase tracking-wide transition active:cursor-grabbing ${
        seleccionado
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
    </button>
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
}) {
  const [encima, setEncima] = useState(false);

  const tinta = color ? tintaSobre(color) : "#FFFFFF";

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setEncima(true);
      }}
      onDragLeave={() => setEncima(false)}
      onDrop={(e) => {
        e.preventDefault();
        setEncima(false);
        onSoltar();
      }}
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
          <span
            className="inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-[12px] font-bold tabular-nums"
            style={{ background: color ? (tinta === "#FFFFFF" ? "rgba(0,0,0,0.22)" : "rgba(255,255,255,0.5)") : "rgba(255,255,255,0.08)" }}
          >
            {cuenta}
            {objetivo !== undefined ? `/${objetivo}` : ""}
          </span>
        </span>
      </div>

      <div
        className="flex min-h-[64px] flex-1 flex-wrap content-start gap-1.5 p-2"
        onClick={(e) => {
          if (activa && e.target === e.currentTarget) onSoltar();
        }}
      >
        {children}
        {cuenta === 0 && (
          <span className="pointer-events-none self-center px-1 text-[11px] text-white/25">{vacio}</span>
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
  | Deshacer. Con prisa se suelta a alguien en el equipo que no es, o se
  | sortea sin querer encima de unos equipos hechos a mano: cada cambio guarda
  | cómo estaba todo antes (las 40 últimas).
  */
  const historia = useRef<AlmacenEquipos[]>([]);

  const almacenAhora = useRef(almacen);

  useEffect(() => {
    almacenAhora.current = almacen;
  }, [almacen]);

  const [pasos, setPasos] = useState(0);

  const setAlmacen = useCallback(
    (cambio: (actual: AlmacenEquipos) => AlmacenEquipos) => {
      historia.current = [...historia.current.slice(-39), almacenAhora.current];

      setPasos(historia.current.length);

      escribeAlmacen(cambio);
    },
    [escribeAlmacen],
  );

  const deshaz = useCallback(() => {
    const previo = historia.current.pop();

    setPasos(historia.current.length);

    if (previo) escribeAlmacen(previo);
  }, [escribeAlmacen]);

  /* El puesto de cada uno: el puesto a mano manda; si no, el de la plantilla. */
  const { players: plantilla } = usePlayers();

  const sesiones = useMemo(
    () =>
      [...(almacen.sesiones ?? [])].sort((a, b) =>
        (b.fecha ?? b.creadaEn).localeCompare(a.fecha ?? a.creadaEn),
      ),
    [almacen.sesiones],
  );

  const [sesionId, setSesionId] = useState<string | null>(null);

  const sesion = sesiones.find((s) => s.id === sesionId) ?? sesiones[0] ?? null;

  const [pedida, setPedida] = useState(0);

  const activa = sesion ? Math.min(pedida, Math.max(0, sesion.tareas.length - 1)) : 0;

  const tarea = sesion?.tareas[activa] ?? null;

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

  const puestoDe: PuestoDe = useCallback((j) => j.puesto ?? puestosAuto[j.id], [puestosAuto]);

  const [elegido, setElegido] = useState<string | null>(null);

  const arrastrado = useRef<string | null>(null);

  const [dialogo, setDialogo] = useState<null | "nueva" | "lista">(null);

  const [texto, setTexto] = useState("");

  const [presentando, setPresentando] = useState(false);

  const [exportando, setExportando] = useState<null | { indices: number[]; paso: string }>(null);

  /* ---------------- escribir ---------------- */

  const cambiaSesion = useCallback(
    (id: string, cambio: (s: SesionEquipos) => SesionEquipos) =>
      setAlmacen((actual) => ({
        sesiones: (actual.sesiones ?? []).map((s) => (s.id === id ? cambio(s) : s)),
      })),
    [setAlmacen],
  );

  const cambiaTarea = useCallback(
    (cambio: (t: TareaEquipos) => TareaEquipos) => {
      if (!sesion || !tarea) return;

      cambiaSesion(sesion.id, (s) => ({
        ...s,
        tareas: s.tareas.map((t) => (t.id === tarea.id ? cambio(t) : t)),
      }));
    },
    [cambiaSesion, sesion, tarea],
  );

  const coloca = useCallback(
    (jugadorId: string, sitio: Sitio | null) => {
      cambiaTarea((t) => {
        const nuevo = { ...t.sitio };

        if (sitio === null) delete nuevo[jugadorId];
        else nuevo[jugadorId] = sitio;

        return { ...t, sitio: nuevo };
      });
    },
    [cambiaTarea],
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

      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "z") {
        e.preventDefault();

        deshaz();
      }
    };

    window.addEventListener("keydown", tecla);

    return () => window.removeEventListener("keydown", tecla);
  }, [deshaz, presentando]);

  /* ---------------- sesiones ---------------- */

  const creaSesion = () => {
    const nueva = nuevaSesion(texto);

    if (!nueva.jugadores.length) {
      toast.error("No he encontrado jugadores", {
        description: "Cada jugador en su línea, empezando por un guion: «- OSCAR NAASEI».",
      });

      return;
    }

    setAlmacen((actual) => ({ sesiones: [nueva, ...(actual.sesiones ?? [])] }));
    setSesionId(nueva.id);
    setPedida(0);
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

    setAlmacen((actual) => ({ sesiones: (actual.sesiones ?? []).filter((s) => s.id !== sesion.id) }));
    setSesionId(null);
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
          equipos: tarea.equipos.map((e) => ({ ...e, id: `${e.id}-${nueva.id.slice(-4)}` })),
          comodines: tarea.comodines,
          colorComodin: tarea.colorComodin,
        }
      : nueva;

    cambiaSesion(sesion.id, (s) => ({ ...s, tareas: [...s.tareas, conMolde] }));
    setPedida(sesion.tareas.length);
  };

  const duplica = () => {
    if (!sesion || !tarea) return;

    const copia = duplicaTarea(tarea, `${tarea.nombre} (copia)`);

    cambiaSesion(sesion.id, (s) => {
      const tareas = [...s.tareas];

      tareas.splice(activa + 1, 0, copia);

      return { ...s, tareas };
    });

    setPedida(activa + 1);
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

  const ponPuesto = (jugadorId: string, puesto: Puesto | "") => {
    if (!sesion) return;

    cambiaSesion(sesion.id, (s) => ({
      ...s,
      jugadores: s.jugadores.map((j) => {
        if (j.id !== jugadorId) return j;

        const { puesto: _quitado, ...resto } = j;

        void _quitado;

        return puesto ? { ...resto, puesto } : resto;
      }),
    }));
  };

  const quitaTarea = () => {
    if (!sesion || !tarea || sesion.tareas.length <= 1) return;

    if (Object.keys(tarea.sitio).length > 3 && !window.confirm(`¿Quitar «${tarea.nombre}»?`)) return;

    cambiaSesion(sesion.id, (s) => ({ ...s, tareas: s.tareas.filter((t) => t.id !== tarea.id) }));
    setPedida(Math.max(0, activa - 1));
  };

  const mueveTarea = (desde: number, hasta: number) => {
    if (!sesion || desde === hasta) return;

    cambiaSesion(sesion.id, (s) => {
      const tareas = [...s.tareas];

      const [movida] = tareas.splice(desde, 1);

      tareas.splice(hasta, 0, movida);

      return { ...s, tareas };
    });

    setPedida(hasta);
  };

  const tiraArrastrada = useRef<number | null>(null);

  /* ---------------- exportar ---------------- */

  const lienzos = useRef<HTMLDivElement | null>(null);

  const exporta = async (indices: number[]) => {
    if (!sesion || exportando) return;

    setExportando({ indices, paso: "Preparando…" });

    try {
      await pintado();
      await document.fonts?.ready;
      await pintado();

      const raiz = lienzos.current;

      if (!raiz) throw new Error("no se ha podido montar la imagen");

      const imagenes = await capturaLienzos(raiz, "[data-lamina-equipos]", {
        ancho: LAMINA_W,
        alto: LAMINA_H,
        fondo: "#0B0F14",
        alPaso: (hechas, total) => setExportando({ indices, paso: `Imagen ${hechas} de ${total}…` }),
      });

      const nombreDe = (i: number) =>
        `${String(i + 1).padStart(2, "0")}-${apodo(sesion.tareas[i].nombre, "tarea")}.jpg`;

      if (imagenes.length === 1) {
        const blob = await fetch(imagenes[0]).then((r) => r.blob());

        descarga(blob, `${apodo(sesion.titulo, "sesion")}-${nombreDe(indices[0])}`);
      } else {
        const zip = creaZip(imagenes.map((img, k) => ({ nombre: nombreDe(indices[k]), datos: bytesDeDataUrl(img) })));

        descarga(zip, `equipos-${apodo(sesion.titulo, "sesion")}.zip`);
      }

      toast.success(imagenes.length === 1 ? "Imagen descargada" : `${imagenes.length} imágenes descargadas en un .zip`);
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

  const avisos = sesion && tarea ? valida(tarea, sesion, puestoDe) : [];

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

  const chip = (j: JugadorSesion) => (
    <Chip
      key={j.id}
      jugador={j}
      color={colorDe(tarea?.sitio[j.id])}
      puesto={puestoDe(j)}
      seleccionado={elegido === j.id}
      onClick={() => setElegido((actual) => (actual === j.id ? null : j.id))}
      onDragStart={(e) => {
        arrastrado.current = j.id;
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", j.id);
      }}
    />
  );

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
              area="RMCF Castilla · Metodología"
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
                      setPedida(0);
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

                <Button icon={Undo2} disabled={pasos === 0} onClick={deshaz} title="Deshacer el último cambio (Ctrl+Z)">
                  Deshacer
                </Button>
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
                <Button tone="danger" icon={Trash2} onClick={borraSesion} title="Borrar esta sesión" />
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
                    className="w-full resize-y rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 font-mono text-[13px] text-white outline-none placeholder:text-white/20 focus:border-[#C8A96B]/50"
                  />
                  <div className="mt-3 flex justify-end">
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
                          setPedida(i);
                          setElegido(null);
                        }}
                        title={`${t.nombre} — arrastra para cambiar el orden`}
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

                <div className="mt-4 grid min-w-0 gap-5 2xl:grid-cols-[minmax(0,1fr)_minmax(0,560px)]">
                  {/* ================= EDITOR ================= */}
                  <div className="min-w-0 space-y-4">
                    {/* --- configuración de la tarea --- */}
                    <div className="flex min-w-0 flex-wrap items-end gap-x-5 gap-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <label className="block min-w-[200px] flex-1">
                        <span className="mb-1.5 block text-[10px] uppercase tracking-[0.16em] text-white/40">Tarea</span>
                        <input
                          value={tarea.nombre}
                          onChange={(e) => cambiaTarea((t) => ({ ...t, nombre: e.target.value }))}
                          placeholder="Rondo 4v4+3"
                          className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-base font-semibold text-white outline-none focus:border-[#C8A96B]/50"
                        />
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
                            if (enTarea > 0 && !window.confirm("Sortear de nuevo deshace los equipos de esta tarea. ¿Seguir?")) return;
                            cambiaTarea((t) => sorteaReparto(t, sesion.jugadores, opcionesReparto));
                          }}
                          title="Equipos al azar con todos los que hacen la tarea"
                        >
                          Sortear
                        </Button>
                        <Button icon={Copy} disabled={activa === 0} onClick={copiaAnterior} title="Mismos equipos, colores y comodines que la tarea anterior">
                          Como la anterior
                        </Button>
                        <Button icon={Plus} onClick={duplica} title="Duplicar esta tarea con sus equipos">
                          Duplicar
                        </Button>
                        <Button tone="danger" icon={Trash2} disabled={sesion.tareas.length <= 1} onClick={quitaTarea} title="Quitar esta tarea" />
                      </div>
                    </div>

                    {/* --- sin colocar --- */}
                    <Caja
                      titulo={reparto.sinSitio.length ? "Sin colocar" : "Todos colocados"}
                      cuenta={reparto.sinSitio.length}
                      activa={Boolean(elegido)}
                      alerta={reparto.sinSitio.length > 0}
                      tenue={reparto.sinSitio.length === 0}
                      atajo="0"
                      onSoltar={() => suelta(null)}
                      vacio="Nadie pendiente. Toca a un jugador para cambiarlo de sitio."
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

                    {/* --- equipos --- */}
                    <div
                      className="grid min-w-0 gap-3"
                      style={{
                        gridTemplateColumns: `repeat(auto-fit, minmax(${tarea.equipos.length + (tarea.comodines > 0 ? 1 : 0) > 4 ? 170 : 210}px, 1fr))`,
                      }}
                    >
                      {tarea.equipos.map((equipo, i) => (
                        <Caja
                          key={equipo.id}
                          titulo={equipo.nombre}
                          color={equipo.color}
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
                                  }))
                                }
                                className="w-full min-w-0 bg-transparent text-[12px] font-bold uppercase tracking-[0.12em] outline-none placeholder:opacity-50"
                                style={{ color: "inherit" }}
                                aria-label="Nombre del equipo"
                              />
                            </>
                          }
                        >
                          {ordenPorPuesto(reparto.porEquipo[equipo.id] ?? [], puestoDe).map(chip)}
                        </Caja>
                      ))}

                      {tarea.comodines > 0 && (
                        <Caja
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

                    <p className="-mt-1 text-[11px] text-white/40">
                      {tarea.equipos.map((e) => reparto.porEquipo[e.id]?.length ?? 0).join(" · ")}
                      {tarea.comodines > 0 ? ` + ${reparto.comodines.length} comodín${reparto.comodines.length === 1 ? "" : "es"}` : ""}
                      {" "}= {enTarea} en la tarea
                      {reparto.fuera.length ? ` · ${reparto.fuera.length} fuera` : ""}
                    </p>

                    {/* --- fuera --- */}
                    <Caja
                      titulo="No hacen esta tarea"
                      cuenta={reparto.fuera.length}
                      activa={Boolean(elegido)}
                      tenue
                      atajo="F"
                      onSoltar={() => suelta(FUERA)}
                      vacio="Los lesionados empiezan aquí; si alguno hace la tarea, muévelo a un equipo."
                    >
                      {ordenPorPuesto(reparto.fuera, puestoDe).map(chip)}
                    </Caja>
                  </div>

                  {/* ================= DERECHA ================= */}
                  <div className="min-w-0 space-y-4">
                    <Panel
                      title="Validador"
                      subtitle={tareaLista(avisos) ? "Lista para presentar" : "Hay algo que corregir"}
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
                      {estadoTareas.some((s) => !tareaLista(s)) && (
                        <p className="mt-3 border-t border-white/8 pt-2 text-[11px] text-white/40">
                          Por revisar:{" "}
                          {sesion.tareas
                            .filter((_, i) => !tareaLista(estadoTareas[i] ?? []))
                            .map((t) => t.nombre)
                            .join(" · ")}
                        </p>
                      )}
                    </Panel>

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
                            Texto
                          </Button>
                          <Button icon={Download} disabled={Boolean(exportando)} onClick={() => void exporta([activa])} title="Esta tarea en imagen (.jpg)">
                            Esta
                          </Button>
                          <Button
                            tone="primary"
                            icon={exportando ? Loader2 : Download}
                            disabled={Boolean(exportando)}
                            onClick={() => void exporta(sesion.tareas.map((_, i) => i))}
                            title="Todas las tareas, una imagen cada una, en un .zip"
                          >
                            {exportando ? exportando.paso : "Todas"}
                          </Button>
                        </div>
                      }
                    >
                      <div ref={refPrevia} className="min-w-0 overflow-hidden rounded-xl">
                        {anchoPrevia > 0 && (
                          <LaminaEscalada ancho={anchoPrevia} puestoDe={puestoDe} sesion={sesion} tarea={tarea} indice={activa} total={sesion.tareas.length} />
                        )}
                      </div>
                      <div className="mt-2 flex items-center justify-between text-[11px] text-white/40">
                        <button type="button" disabled={activa === 0} onClick={() => { setPedida(activa - 1); setElegido(null); }} className="inline-flex items-center gap-1 hover:text-white disabled:opacity-30">
                          <ChevronLeft size={13} /> Anterior
                        </button>
                        <span>Sólo nombres: lista para proyectar o mandar</span>
                        <button type="button" disabled={activa >= sesion.tareas.length - 1} onClick={() => { setPedida(activa + 1); setElegido(null); }} className="inline-flex items-center gap-1 hover:text-white disabled:opacity-30">
                          Siguiente <ChevronRight size={13} />
                        </button>
                      </div>
                    </Panel>

                    {/* --- plantilla del día: puestos y rotación --- */}
                    <Panel
                      title="Plantilla del día"
                      subtitle="Puesto (para que el sorteo reparta porteros y líneas) y cuántas veces ha sido comodín o ha descansado"
                      icon={Repeat2}
                      bodyClassName="p-0"
                    >
                      <div className="max-h-[420px] overflow-y-auto">
                        <table className="w-full text-[12px]">
                          <thead className="sticky top-0 bg-[#11161C] text-[10px] uppercase tracking-[0.14em] text-white/35">
                            <tr>
                              <th className="px-4 py-2 text-left font-medium">Jugador</th>
                              <th className="px-2 py-2 text-left font-medium">Puesto</th>
                              <th className="px-2 py-2 text-center font-medium" title="Tareas como comodín">Com.</th>
                              <th className="px-2 py-2 text-center font-medium" title="Tareas sin participar">Fuera</th>
                            </tr>
                          </thead>
                          <tbody>
                            {ordenPorPuesto(
                              rotacion.map((r) => r.jugador),
                              puestoDe,
                            ).map((j) => {
                              const r = rotacion.find((x) => x.jugador.id === j.id)!;

                              const auto = puestosAuto[j.id];

                              return (
                                <tr key={j.id} className="border-t border-white/[0.05]">
                                  <td className="max-w-0 px-4 py-1.5">
                                    <span className="block truncate font-semibold uppercase text-white/80">
                                      {j.nombre}
                                      {j.etiqueta && <span className="ml-1.5 text-[10px] text-[#C8A96B]">{j.etiqueta}</span>}
                                      {j.baja && <span className="ml-1.5 text-[10px] text-red-300">{j.baja.toLowerCase()}</span>}
                                    </span>
                                  </td>
                                  <td className="px-2 py-1">
                                    <select
                                      value={j.puesto ?? ""}
                                      onChange={(e) => ponPuesto(j.id, e.target.value as Puesto | "")}
                                      aria-label={`Puesto de ${j.nombre}`}
                                      className={`rounded-lg border bg-transparent px-1.5 py-1 text-[11px] outline-none focus:border-[#C8A96B]/50 ${
                                        j.puesto ? "border-[#C8A96B]/40 text-white" : "border-white/10 text-white/50"
                                      }`}
                                    >
                                      <option value="" className="bg-[#11161C]">
                                        {auto ? `${PUESTOS.find((p) => p.clave === auto)?.nombre} (plantilla)` : "Sin puesto"}
                                      </option>
                                      {PUESTOS.map((p) => (
                                        <option key={p.clave} value={p.clave} className="bg-[#11161C]">
                                          {p.nombre}
                                        </option>
                                      ))}
                                    </select>
                                  </td>
                                  <td className={`px-2 py-1 text-center tabular-nums ${r.comodin >= 2 ? "font-bold text-amber-300" : "text-white/55"}`}>
                                    {r.comodin || "·"}
                                  </td>
                                  <td className={`px-2 py-1 text-center tabular-nums ${r.fuera >= 2 && !j.baja ? "font-bold text-amber-300" : "text-white/55"}`}>
                                    {r.fuera || "·"}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </Panel>
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
          sinGuardar={dialogo === "nueva" && Boolean(texto.trim())}
          footer={
            <div className="flex justify-end gap-2">
              <Button onClick={() => setDialogo(null)}>Cancelar</Button>
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
            className="w-full resize-y rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 font-mono text-[13px] text-white outline-none placeholder:text-white/20 focus:border-[#C8A96B]/50"
          />
        </Dialog>
      )}

      {/* ---------------- PRESENTACIÓN ---------------- */}

      {presentando && sesion && (
        <Presentacion
          sesion={sesion}
          inicial={activa}
          puestoDe={puestoDe}
          onCierra={(ultima) => {
            setPresentando(false);
            setPedida(ultima);
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
          {exportando.indices.map((i) => (
            <LaminaEquipos key={sesion.tareas[i].id} puestoDe={puestoDe} sesion={sesion} tarea={sesion.tareas[i]} indice={i} total={sesion.tareas.length} />
          ))}
        </div>
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
}: {
  sesion: SesionEquipos;
  inicial: number;
  onCierra: (ultima: number) => void;
  puestoDe: PuestoDe;
}) {
  const [i, setI] = useState(inicial);

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
  const ultima = useRef(i);

  /* `onCierra` llega nuevo en cada render: en una ref, para no volver a
     enganchar el oyente (y perder el «entró») cada vez. */
  const cierra = useRef(onCierra);

  useEffect(() => {
    ultima.current = i;
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
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") setI((n) => Math.min(sesion.tareas.length - 1, n + 1));
      else if (e.key === "ArrowLeft" || e.key === "PageUp") setI((n) => Math.max(0, n - 1));
      else if (e.key === "Escape") onCierra(i);
      else return;

      e.preventDefault();
    };

    window.addEventListener("keydown", tecla);

    return () => window.removeEventListener("keydown", tecla);
  }, [i, onCierra, sesion.tareas.length]);

  const ancho = Math.min(hueco.w, (hueco.h * 16) / 9);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black" onClick={() => setI((n) => Math.min(sesion.tareas.length - 1, n + 1))}>
      {ancho > 0 && <LaminaEscalada ancho={ancho} puestoDe={puestoDe} sesion={sesion} tarea={sesion.tareas[i]} indice={i} total={sesion.tareas.length} />}

      <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-white/10 px-2 py-1 text-white/80 opacity-30 transition hover:opacity-100" onClick={(e) => e.stopPropagation()}>
        <button type="button" aria-label="Anterior" onClick={() => setI((n) => Math.max(0, n - 1))} className="rounded-full p-1.5 hover:bg-white/15">
          <ArrowLeft size={16} />
        </button>
        <span className="text-xs tabular-nums">
          {i + 1} / {sesion.tareas.length}
        </span>
        <button type="button" aria-label="Siguiente" onClick={() => setI((n) => Math.min(sesion.tareas.length - 1, n + 1))} className="rounded-full p-1.5 hover:bg-white/15">
          <ArrowRight size={16} />
        </button>
        <button type="button" aria-label="Salir" onClick={() => onCierra(i)} className="rounded-full p-1.5 hover:bg-white/15">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
