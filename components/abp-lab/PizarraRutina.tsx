"use client";

/**
 * LA PIZARRA VIVA DEL TALLER (21/10/2026).
 *
 * La rutina sobre el medio campo, en metros (`lib/abp-lab/campo.ts`):
 * - **Colocar**: se arrastra a cada uno a su sitio de salida.
 * - **Carreras**: se arrastra desde un jugador hasta donde acaba su carrera;
 *   la fase dice cuándo arranca (antes del saque, con el golpeo, al rechace).
 * - **Balón**: cada toque en el campo añade un punto al recorrido; el primero
 *   es donde se golpea. Los puntos se arrastran; doble toque, se quitan.
 * - **Reproducir** mueve la jugada entera; la barra la para en cualquier
 *   instante para explicarla en la charla. Con «reducir movimiento» en el
 *   sistema, salta al final sin animar.
 * - **Rival tipo**: la defensa contra la que se pensó (zona, mixta, al
 *   hombre), en esquema; los marcadores al hombre siguen a su atacante.
 * - **PNG**: la pizarra tal cual, con el nombre y la señal, para la charla.
 *
 * Todo el color va en `style` y con valores fijos: es un tablero (oscuro en
 * los dos temas, como la pizarra de ABP), y así el PNG sale igual que la
 * pantalla. Se maneja también con teclado: cada ficha es un botón y las
 * flechas la mueven medio metro (con Mayúsculas, dos).
 */

import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { Download, Eye, EyeOff, FlipHorizontal2, MousePointer2, Pause, Play, RotateCcw, Route, Tag, Trash2, ZoomIn, ZoomOut } from "lucide-react";

import { iniciales, type JugadorLab } from "@/components/abp-lab/comun";
import {
  ANCHO,
  AREA,
  AREA_PEQUENA,
  DURACION_MS,
  FASES,
  PENALTI,
  PORTERIA,
  LARGO,
  balonEn,
  curvaBalon,
  encuadre,
  fondoVisible,
  golpeoDe,
  limita,
  posicionesEn,
  recorridoBalon,
  reflejada,
  rivalTipo,
  salidas,
  type Marco,
} from "@/lib/abp-lab/campo";
import { PAPELES, etiqueta, type Defensa, type Fase, type Lado, type Papel, type Punto, type Rol } from "@/lib/abp-lab/modelo";
import type { TipoAbp } from "@/lib/abp-lab/referentes";

/* ------------------------------------------------------------------ */
/*  COLORES DEL TABLERO (fijos: es una superficie oscura en los dos temas) */
/* ------------------------------------------------------------------ */

const C = {
  fondo: "#0B1A14",
  cesped: "#103224",
  franja: "#12382A",
  linea: "rgba(255,255,255,0.55)",
  red: "rgba(255,255,255,0.18)",
  oro: "#C8A96B",
  tinta: "#0B0F14",
  rival: "#E7EAF0",
  rivalPortero: "#F2C94C",
  balon: "#FFFFFF",
  texto: "#FFFFFF",
  fase: { 1: "#7DD3FC", 2: "#C8A96B", 3: "#86EFAC" } as Record<Fase, string>,
};

/** El código de cada papel en la ficha cuando no tiene dueño (lo repite la lista de papeles). */
export const CODIGO_PAPEL: Record<Papel, string> = {
  lanzador: "L",
  rematador: "R",
  bloqueador: "B",
  senuelo: "S",
  portero: "P",
  corto: "C",
  segunda: "2ª",
  vigilancia: "V",
  zonal: "Z",
  marcador: "H",
};

/* Los papeles que no pisan el remate se pintan huecos. */
const HUECO: Partial<Record<Papel, boolean>> = { senuelo: true, segunda: true, vigilancia: true };

export type RutinaEnPizarra = {
  nombre: string;
  senal: string;
  tipo: TipoAbp;
  lado: Lado;
  contra: Defensa;
  roles: Rol[];
  balon?: Punto[];
};

type Modo = "colocar" | "carreras" | "balon";

const MODOS: { key: Modo; label: string; icon: typeof MousePointer2; ayuda: string }[] = [
  { key: "colocar", label: "Colocar", icon: MousePointer2, ayuda: "Arrastra a cada uno a su sitio de salida." },
  { key: "carreras", label: "Carreras", icon: Route, ayuda: "Arrastra desde un jugador hasta donde acaba su carrera. Sin moverte, se borra." },
  { key: "balon", label: "Balón", icon: Tag, ayuda: "Toca el campo para añadir puntos al recorrido; arrástralos para moverlos y doble toque para quitarlos." },
];

const nombreCorto = (n: string) => n.split(/\s+/)[0] ?? n;

/* ------------------------------------------------------------------ */
/*  EL DIBUJO (lo comparten la pizarra grande y la miniatura)           */
/* ------------------------------------------------------------------ */

function Lineas({ fondo }: { fondo: number }) {
  const l = { fill: "none", stroke: C.linea, strokeWidth: 0.14 };

  const franjas = Math.ceil(fondo / 5.5);

  /* Los puntos del arco del área: donde la circunferencia de 9,15 m corta la línea del área. */
  const dx = Math.sqrt(9.15 ** 2 - (AREA.y - PENALTI.y) ** 2);

  return (
    <g>
      <rect x={0} y={0} width={ANCHO} height={fondo} style={{ fill: C.cesped }} />
      {Array.from({ length: franjas }, (_, i) =>
        i % 2 ? <rect key={i} x={0} y={i * 5.5} width={ANCHO} height={Math.min(5.5, fondo - i * 5.5)} style={{ fill: C.franja }} /> : null,
      )}
      <rect x={0} y={0} width={ANCHO} height={fondo} style={l} />
      <rect x={AREA.x0} y={0} width={AREA.x1 - AREA.x0} height={AREA.y} style={l} />
      <rect x={AREA_PEQUENA.x0} y={0} width={AREA_PEQUENA.x1 - AREA_PEQUENA.x0} height={AREA_PEQUENA.y} style={l} />
      <path d={`M ${PENALTI.x - dx} ${AREA.y} A 9.15 9.15 0 0 0 ${PENALTI.x + dx} ${AREA.y}`} style={l} />
      <circle cx={PENALTI.x} cy={PENALTI.y} r={0.18} style={{ fill: C.linea }} />
      <path d="M 0 1 A 1 1 0 0 0 1 0" style={l} />
      <path d={`M ${ANCHO - 1} 0 A 1 1 0 0 0 ${ANCHO} 1`} style={l} />
      {fondo > 52 && <path d={`M ${34 - 9.15} 52.5 A 9.15 9.15 0 0 1 ${34 + 9.15} 52.5`} style={l} />}
      {/* La portería, con su red */}
      <rect x={PORTERIA.x0} y={-1.6} width={PORTERIA.x1 - PORTERIA.x0} height={1.6} style={{ fill: C.red, stroke: C.linea, strokeWidth: 0.16 }} />
    </g>
  );
}

function Ficha({
  p,
  rol,
  jugador,
  nombres,
  activa,
  r = 1.15,
}: {
  p: Punto;
  rol: Rol;
  jugador?: JugadorLab;
  nombres: boolean;
  activa: boolean;
  r?: number;
}) {
  const hueco = HUECO[rol.papel];

  const texto = jugador ? String(jugador.dorsal ?? iniciales(jugador.nombre)) : CODIGO_PAPEL[rol.papel];

  return (
    <g transform={`translate(${p.x} ${p.y})`}>
      {activa && <circle r={r + 0.65} style={{ fill: "none", stroke: C.texto, strokeWidth: 0.16, strokeDasharray: "0.5 0.35" }} />}
      <circle
        r={r}
        style={{
          fill: hueco ? "rgba(200,169,107,0.18)" : C.oro,
          stroke: hueco ? C.oro : "rgba(0,0,0,0.35)",
          strokeWidth: hueco ? 0.18 : 0.1,
          strokeDasharray: rol.papel === "senuelo" ? "0.45 0.3" : undefined,
        }}
      />
      {rol.papel === "bloqueador" && <path d={`M ${-r * 0.7} ${r + 0.45} L ${r * 0.7} ${r + 0.45}`} style={{ stroke: C.oro, strokeWidth: 0.3, strokeLinecap: "round" }} />}
      <text textAnchor="middle" dy={r * 0.36} style={{ fontSize: texto.length > 2 ? r * 0.82 : r * 1.02, fontWeight: 800, fill: hueco ? C.texto : C.tinta, fontFamily: "Barlow Condensed, Arial, sans-serif" }}>
        {texto}
      </text>
      {nombres && jugador && (
        <text textAnchor="middle" y={r + (rol.papel === "bloqueador" ? 1.75 : 1.35)} style={{ fontSize: 0.95, fontWeight: 700, fill: C.texto, fontFamily: "Barlow Condensed, Arial, sans-serif", paintOrder: "stroke", stroke: "rgba(0,0,0,0.65)", strokeWidth: 0.25 }}>
          {nombreCorto(jugador.nombre)}
        </text>
      )}
    </g>
  );
}

function Flecha({ id, de, a, fase }: { id: string; de: Punto; a: Punto; fase: Fase }) {
  const color = C.fase[fase];

  /* La punta se queda un poco antes del destino para no tapar la ficha que llega. */
  const d = Math.hypot(a.x - de.x, a.y - de.y);

  if (d < 0.5) return null;

  const corto = Math.max(0, d - 0.9) / d;

  const fin = { x: de.x + (a.x - de.x) * corto, y: de.y + (a.y - de.y) * corto };

  return <path d={`M ${de.x} ${de.y} L ${fin.x} ${fin.y}`} markerEnd={`url(#${id}-punta-${fase})`} style={{ pointerEvents: "none", fill: "none", stroke: color, strokeWidth: 0.24, strokeDasharray: fase === 1 ? "0.6 0.4" : undefined, opacity: 0.95 }} />;
}

function Recorrido({ camino }: { camino: Punto[] }) {
  return (
    <g style={{ pointerEvents: "none" }}>
      {camino.slice(1).map((p, i) => (
        <path key={i} d={curvaBalon(camino[i], p)} style={{ fill: "none", stroke: C.balon, strokeWidth: 0.2, strokeDasharray: "0.7 0.45", opacity: 0.8 }} />
      ))}
    </g>
  );
}

function Balon({ p }: { p: Punto }) {
  return (
    <g transform={`translate(${p.x} ${p.y})`} style={{ pointerEvents: "none" }}>
      <circle r={0.62} style={{ fill: C.balon, stroke: C.tinta, strokeWidth: 0.14 }} />
      <circle r={0.2} style={{ fill: C.tinta }} />
    </g>
  );
}

function Rival({ p, papel }: { p: Punto; papel: "portero" | "zonal" | "marcador" }) {
  return (
    <g transform={`translate(${p.x} ${p.y})`} style={{ pointerEvents: "none" }}>
      <rect x={-0.85} y={-0.85} width={1.7} height={1.7} rx={0.35} transform="rotate(45)" style={{ fill: papel === "portero" ? C.rivalPortero : C.rival, stroke: "rgba(0,0,0,0.45)", strokeWidth: 0.1, opacity: 0.9 }} />
    </g>
  );
}

function Puntas({ id }: { id: string }) {
  return (
    <defs>
      {([1, 2, 3] as Fase[]).map((f) => (
        <marker key={f} id={`${id}-punta-${f}`} viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4.2" markerHeight="4.2" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" style={{ fill: C.fase[f] }} />
        </marker>
      ))}
    </defs>
  );
}

/* ------------------------------------------------------------------ */
/*  LA MINIATURA (tarjetas del taller)                                  */
/* ------------------------------------------------------------------ */

/** La rutina quieta: salidas, carreras y balón, recortada a donde pasa todo. */
export function MiniPizarra({ rutina, porId, className = "" }: { rutina: RutinaEnPizarra; porId: Map<string, JugadorLab>; className?: string }) {
  const id = useId().replace(/:/g, "");

  const desde = useMemo(() => salidas(rutina.roles), [rutina.roles]);

  const camino = useMemo(() => recorridoBalon(rutina), [rutina]);

  /* El trozo de campo donde pasa la jugada, siempre en 16:9: todas las tarjetas del mismo alto. */
  const m = useMemo(() => encuadre(rutina, 16 / 9), [rutina]);

  const fondo = Math.min(LARGO, Math.max(20, m.y + m.h));

  return (
    <svg viewBox={`${m.x} ${m.y} ${m.w} ${m.h}`} className={`block w-full ${className}`} style={{ aspectRatio: "16 / 9" }} role="img" aria-label={`Esquema de ${rutina.nombre || "la rutina"}`}>
      <Puntas id={id} />
      <rect x={m.x} y={m.y} width={m.w} height={m.h} style={{ fill: C.fondo }} />
      <Lineas fondo={fondo} />
      <Recorrido camino={camino} />
      {rutina.roles.map((r, i) => (r.hx !== undefined && r.hy !== undefined ? <Flecha key={i} id={id} de={desde[i]} a={{ x: r.hx, y: r.hy }} fase={r.fase ?? 2} /> : null))}
      {rutina.roles.map((r, i) => (
        <Ficha key={i} p={desde[i]} rol={r} jugador={porId.get(r.jugador)} nombres={false} activa={false} r={1.25} />
      ))}
      <Balon p={camino[0]} />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  LA PIZARRA GRANDE                                                  */
/* ------------------------------------------------------------------ */

type Arrastre = { que: "salida" | "carrera" | "balon"; i: number; desde: Punto; movido: boolean } | null;

export function PizarraRutina({
  rutina,
  porId,
  onCambia,
  seleccionado,
  onSelecciona,
}: {
  rutina: RutinaEnPizarra;
  porId: Map<string, JugadorLab>;
  /** Cambia los papeles y el recorrido del balón. */
  onCambia: (cambio: { roles?: Rol[]; balon?: Punto[] }) => void;
  seleccionado: number | null;
  onSelecciona: (i: number | null) => void;
}) {
  const id = useId().replace(/:/g, "");

  const svg = useRef<SVGSVGElement>(null);

  const arrastre = useRef<Arrastre>(null);

  const [modo, setModo] = useState<Modo>("colocar");

  const [t, setT] = useState(0);

  const [reproduciendo, setReproduciendo] = useState(false);

  const [verRival, setVerRival] = useState(true);

  const [nombres, setNombres] = useState(true);

  const fondo = fondoVisible(rutina.tipo);

  /*
   * El encuadre: la jugada de cerca o el medio campo entero. El de la jugada
   * se congela mientras se edita —si siguiera a cada arrastre, la vista
   * saltaría bajo el dedo— y se recalcula al cambiar de vista o de tipo, al
   * añadir o quitar papeles y con «Otro lado».
   */
  const [vista, setVista] = useState<"jugada" | "todo">("jugada");

  const [vuelta, setVuelta] = useState(0);

  const calculaMarco = (): Marco => (vista === "todo" ? { x: -2, y: -3, w: ANCHO + 4, h: fondo + 4 } : encuadre(rutina, 1.62, 6));

  const claveMarco = `${vista}|${rutina.tipo}|${rutina.roles.length}|${vuelta}`;

  const [marco, setMarco] = useState<Marco>(calculaMarco);

  const [claveVista, setClaveVista] = useState(claveMarco);

  if (claveVista !== claveMarco) {
    setClaveVista(claveMarco);
    setMarco(calculaMarco());
  }

  const desde = useMemo(() => salidas(rutina.roles), [rutina.roles]);

  const ahora = useMemo(() => posicionesEn(rutina.roles, t), [rutina.roles, t]);

  const camino = useMemo(() => recorridoBalon(rutina), [rutina]);

  const balon = balonEn(camino, t);

  const fuera = ahora.filter((p) => p.x < marco.x || p.x > marco.x + marco.w || p.y < marco.y || p.y > marco.y + marco.h).length;

  const rivales = useMemo(
    () => (verRival && rutina.lado === "ofensivo" ? rivalTipo(rutina.contra, ahora, rutina.roles, rutina.tipo, camino[0]) : []),
    [verRival, rutina.lado, rutina.contra, ahora, rutina.roles, rutina.tipo, camino],
  );

  /* ---------------------------- reproducir ---------------------------- */

  useEffect(() => {
    if (!reproduciendo) return;

    let marco = 0;

    const inicio = performance.now() - t * DURACION_MS;

    const paso = (ms: number) => {
      const u = Math.min(1, (ms - inicio) / DURACION_MS);

      setT(u);

      if (u < 1) marco = requestAnimationFrame(paso);
      else setReproduciendo(false);
    };

    marco = requestAnimationFrame(paso);

    return () => cancelAnimationFrame(marco);
    /* `t` sólo se lee al arrancar: si entrara en las dependencias, cada fotograma reiniciaría el reloj. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reproduciendo]);

  const play = () => {
    if (reproduciendo) {
      setReproduciendo(false);

      return;
    }

    const quieto = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    if (quieto) {
      setT(t >= 1 ? 0 : 1);

      return;
    }

    if (t >= 1) setT(0);

    setReproduciendo(true);
  };

  /* --------------------------- coordenadas ---------------------------- */

  const enMetros = useCallback((e: { clientX: number; clientY: number }): Punto | null => {
    const el = svg.current;

    const m = el?.getScreenCTM();

    if (!el || !m) return null;

    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());

    return limita({ x: p.x, y: p.y });
  }, []);

  const pararTiempo = () => {
    setReproduciendo(false);
    setT(0);
  };

  /* ----------------------------- arrastres ---------------------------- */

  const ponRol = (i: number, cambio: Partial<Rol>) => onCambia({ roles: rutina.roles.map((r, j) => (j === i ? { ...r, ...cambio } : r)) });

  const empiezaEnFicha = (e: PointerEvent, i: number) => {
    /* En modo balón, tocar a un jugador es mandarle el balón: lo atiende el campo. */
    if (modo === "balon") return;

    e.stopPropagation();

    const p = enMetros(e);

    if (!p) return;

    pararTiempo();
    onSelecciona(i);
    svg.current?.setPointerCapture(e.pointerId);
    arrastre.current = { que: modo === "carreras" ? "carrera" : "salida", i, desde: p, movido: false };
  };

  const empiezaEnBalon = (e: PointerEvent, i: number) => {
    e.stopPropagation();

    if (modo !== "balon") return;

    const p = enMetros(e);

    if (!p) return;

    pararTiempo();
    svg.current?.setPointerCapture(e.pointerId);
    arrastre.current = { que: "balon", i, desde: p, movido: false };
  };

  const enCampo = (e: PointerEvent) => {
    if (modo !== "balon") {
      onSelecciona(null);

      return;
    }

    const p = enMetros(e);

    if (!p) return;

    pararTiempo();

    /* El primer toque deja el golpeo donde estaba y añade el destino. */
    const base = rutina.balon?.length ? rutina.balon : [camino[0]];

    if (base.length >= 6) return;

    onCambia({ balon: [...base, p] });
  };

  const mueve = (e: PointerEvent) => {
    const a = arrastre.current;

    if (!a) return;

    const p = enMetros(e);

    if (!p) return;

    if (!a.movido && Math.hypot(p.x - a.desde.x, p.y - a.desde.y) < 0.3) return;

    a.movido = true;

    if (a.que === "salida") ponRol(a.i, { x: p.x, y: p.y });
    else if (a.que === "carrera") ponRol(a.i, { hx: p.x, hy: p.y, fase: rutina.roles[a.i].fase ?? 2 });
    else {
      const actual = rutina.balon?.length ? rutina.balon : camino;

      onCambia({ balon: actual.map((q, j) => (j === a.i ? p : q)) });
    }
  };

  const suelta = (e: PointerEvent) => {
    const a = arrastre.current;

    arrastre.current = null;

    if (svg.current?.hasPointerCapture(e.pointerId)) svg.current.releasePointerCapture(e.pointerId);

    /* Un toque sin arrastrar en modo carreras borra la carrera de ese jugador. */
    if (a && a.que === "carrera" && !a.movido && rutina.roles[a.i].hx !== undefined) {
      const { hx: _hx, hy: _hy, ...sin } = rutina.roles[a.i];

      void _hx;
      void _hy;

      onCambia({ roles: rutina.roles.map((r, j) => (j === a.i ? sin : r)) });
    }
  };

  const quitaPunto = (i: number) => {
    if (modo !== "balon") return;

    const actual = rutina.balon?.length ? rutina.balon : camino;

    /* El golpeo no se quita: se mueve. */
    if (i === 0) return;

    onCambia({ balon: actual.filter((_, j) => j !== i) });
  };

  /* ------------------------------ teclado ----------------------------- */

  const teclaEnFicha = (e: KeyboardEvent, i: number) => {
    const paso = e.shiftKey ? 2 : 0.5;

    const d: Record<string, [number, number]> = { ArrowLeft: [-paso, 0], ArrowRight: [paso, 0], ArrowUp: [0, -paso], ArrowDown: [0, paso] };

    if (e.key === "Delete" || e.key === "Backspace") {
      if (modo === "carreras" && rutina.roles[i].hx !== undefined) {
        e.preventDefault();

        const { hx: _hx, hy: _hy, ...sin } = rutina.roles[i];

        void _hx;
        void _hy;

        onCambia({ roles: rutina.roles.map((r, j) => (j === i ? sin : r)) });
      }

      return;
    }

    if (!d[e.key]) return;

    e.preventDefault();
    pararTiempo();
    onSelecciona(i);

    const [dx, dy] = d[e.key];

    const r = rutina.roles[i];

    if (modo === "carreras") {
      const base = r.hx !== undefined && r.hy !== undefined ? { x: r.hx, y: r.hy } : desde[i];

      const p = limita({ x: base.x + dx, y: base.y + dy });

      ponRol(i, { hx: p.x, hy: p.y, fase: r.fase ?? 2 });
    } else {
      const p = limita({ x: desde[i].x + dx, y: desde[i].y + dy });

      ponRol(i, { x: p.x, y: p.y });
    }
  };

  /* ------------------------------ exportar ---------------------------- */

  const exporta = () => {
    const el = svg.current;

    if (!el) return;

    const clon = el.cloneNode(true) as SVGSVGElement;

    clon.querySelectorAll("[data-solo-pantalla]").forEach((n) => n.remove());

    const [vx, vy, vw, vh] = (clon.getAttribute("viewBox") ?? "0 0 72 44").split(/\s+/).map(Number);

    const banda = 6.5;

    const ns = "http://www.w3.org/2000/svg";

    clon.setAttribute("viewBox", `${vx} ${vy - banda} ${vw} ${vh + banda}`);
    clon.setAttribute("xmlns", ns);

    const fondoEl = document.createElementNS(ns, "rect");

    fondoEl.setAttribute("x", String(vx));
    fondoEl.setAttribute("y", String(vy - banda));
    fondoEl.setAttribute("width", String(vw));
    fondoEl.setAttribute("height", String(vh + banda));
    fondoEl.setAttribute("style", `fill:${C.fondo}`);

    const titulo = document.createElementNS(ns, "text");

    titulo.setAttribute("x", String(vx + 1.6));
    titulo.setAttribute("y", String(vy - banda + 3.4));
    titulo.setAttribute("style", `fill:${C.texto};font-size:2.6px;font-weight:800;font-family:Barlow Condensed, Arial, sans-serif`);
    titulo.textContent = (rutina.nombre || "Rutina").toUpperCase();

    const sub = document.createElementNS(ns, "text");

    sub.setAttribute("x", String(vx + 1.6));
    sub.setAttribute("y", String(vy - banda + 5.4));
    sub.setAttribute("style", `fill:${C.oro};font-size:1.4px;font-weight:700;font-family:Barlow Condensed, Arial, sans-serif;letter-spacing:0.1px`);
    sub.textContent = ["RM CASTILLA · LABORATORIO DE ABP", rutina.senal ? `SEÑAL «${rutina.senal.toUpperCase()}»` : ""].filter(Boolean).join(" · ");

    clon.insertBefore(sub, clon.firstChild);
    clon.insertBefore(titulo, clon.firstChild);
    clon.insertBefore(fondoEl, clon.firstChild);

    const ancho = 1800;

    const alto = Math.round((ancho * (vh + banda)) / vw);

    clon.setAttribute("width", String(ancho));
    clon.setAttribute("height", String(alto));

    const datos = new XMLSerializer().serializeToString(clon);

    const img = new Image();

    img.onload = () => {
      const lienzo = document.createElement("canvas");

      lienzo.width = ancho;
      lienzo.height = alto;

      const ctx = lienzo.getContext("2d");

      if (!ctx) return;

      ctx.drawImage(img, 0, 0, ancho, alto);
      lienzo.toBlob((blob) => {
        if (!blob) return;

        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");

        a.href = url;
        a.download = `${(rutina.nombre || "rutina")
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, "")
          .replace(/[^a-z0-9]+/gi, "-")
          .replace(/^-|-$/g, "")
          .toLowerCase()}.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      }, "image/png");
    };

    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(datos)}`;
  };

  /* ------------------------------ pintar ------------------------------ */

  const ayuda = MODOS.find((m) => m.key === modo)?.ayuda ?? "";

  const puntosBalon = rutina.balon?.length ? rutina.balon : camino;

  const elegido = seleccionado !== null ? rutina.roles[seleccionado] : null;

  return (
    <div className="min-w-0 space-y-2.5">
      {/* ------------------------------ BARRA ----------------------------- */}
      <div className="flex flex-wrap items-center gap-2">
        <div role="radiogroup" aria-label="Qué se edita en la pizarra" className="inline-flex gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
          {MODOS.map((m) => {
            const Icono = m.icon;

            const activo = m.key === modo;

            return (
              <button
                key={m.key}
                type="button"
                role="radio"
                aria-checked={activo}
                onClick={() => setModo(m.key)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${activo ? "bg-[#C8A96B] text-black" : "text-white/60 hover:text-white"}`}
              >
                <Icono size={13} />
                {m.label}
              </button>
            );
          })}
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setVerRival((v) => !v)}
            aria-pressed={verRival}
            disabled={rutina.lado !== "ofensivo"}
            title={rutina.lado !== "ofensivo" ? "El rival tipo sale en las rutinas a favor" : "La defensa contra la que se pensó, en esquema"}
            className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1.5 text-[11px] font-medium text-white/65 transition hover:text-white disabled:opacity-40"
          >
            {verRival ? <Eye size={13} /> : <EyeOff size={13} />}
            Rival tipo
          </button>
          <button
            type="button"
            onClick={() => setVista((v) => (v === "jugada" ? "todo" : "jugada"))}
            title={vista === "jugada" ? "Ver el medio campo entero" : "Acercar a donde pasa la jugada"}
            className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1.5 text-[11px] font-medium text-white/65 transition hover:text-white"
          >
            {vista === "jugada" ? <ZoomOut size={13} /> : <ZoomIn size={13} />}
            {vista === "jugada" ? "Medio campo" : "Acercar"}
          </button>
          <button
            type="button"
            onClick={() => setNombres((v) => !v)}
            aria-pressed={nombres}
            className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1.5 text-[11px] font-medium text-white/65 transition hover:text-white"
          >
            <Tag size={13} />
            Nombres
          </button>
          <button
            type="button"
            onClick={() => {
              pararTiempo();
              onCambia(reflejada(rutina));
              setVuelta((v) => v + 1);
            }}
            title="La misma rutina desde el otro córner"
            className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1.5 text-[11px] font-medium text-white/65 transition hover:text-white"
          >
            <FlipHorizontal2 size={13} />
            Otro lado
          </button>
          <button
            type="button"
            onClick={exporta}
            className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1.5 text-[11px] font-medium text-white/65 transition hover:text-white"
          >
            <Download size={13} />
            PNG
          </button>
        </div>
      </div>

      {/* ----------------------------- EL CAMPO ---------------------------- */}
      <div className="overflow-hidden rounded-2xl border border-white/10" style={{ background: C.fondo }}>
        <svg
          ref={svg}
          viewBox={`${marco.x} ${marco.y} ${marco.w} ${marco.h}`}
          className="block w-full select-none"
          style={{ touchAction: "none", cursor: modo === "balon" ? "crosshair" : "default" }}
          role="application"
          aria-label={`Pizarra de ${rutina.nombre || "la rutina"}. ${ayuda}`}
          onPointerDown={enCampo}
          onPointerMove={mueve}
          onPointerUp={suelta}
          onPointerCancel={suelta}
        >
          <Puntas id={id} />
          <rect x={marco.x} y={marco.y} width={marco.w} height={marco.h} style={{ fill: C.fondo }} />
          <Lineas fondo={fondo} />

          {rivales.map((x, i) => (
            <Rival key={`r${i}`} p={x.punto} papel={x.papel} />
          ))}

          <Recorrido camino={camino} />

          {rutina.roles.map((r, i) => (r.hx !== undefined && r.hy !== undefined ? <Flecha key={`f${i}`} id={id} de={desde[i]} a={{ x: r.hx, y: r.hy }} fase={r.fase ?? 2} /> : null))}

          {/* Las salidas, en fantasma, cuando la jugada ya se ha movido */}
          {t > 0 &&
            rutina.roles.map((r, i) =>
              r.hx !== undefined ? <circle key={`g${i}`} cx={desde[i].x} cy={desde[i].y} r={1.15} style={{ pointerEvents: "none", fill: "none", stroke: "rgba(255,255,255,0.25)", strokeWidth: 0.12 }} /> : null,
            )}

          {rutina.roles.map((r, i) => {
            const jugador = porId.get(r.jugador);

            const nombre = jugador?.nombre ?? "sin dueño";

            return (
              <g
                key={`j${i}`}
                role="button"
                tabIndex={0}
                aria-label={`${etiqueta(PAPELES, r.papel)}: ${nombre}. Flechas para mover${modo === "carreras" ? " el final de la carrera; Suprimir la borra" : ""}.`}
                aria-pressed={seleccionado === i}
                onPointerDown={(e) => empiezaEnFicha(e, i)}
                onKeyDown={(e) => teclaEnFicha(e, i)}
                onFocus={() => onSelecciona(i)}
                style={{ cursor: modo === "balon" ? "crosshair" : "grab", outline: "none" }}
              >
                <Ficha p={ahora[i]} rol={r} jugador={jugador} nombres={nombres} activa={seleccionado === i} />
                {/* Un blanco más grande que la ficha: con el dedo, 1,15 m de radio es poco */}
                <circle cx={ahora[i].x} cy={ahora[i].y} r={2} style={{ fill: "transparent" }} data-solo-pantalla />
              </g>
            );
          })}

          {/* Los puntos del recorrido del balón, para moverlos (sólo en modo balón) */}
          {modo === "balon" &&
            puntosBalon.map((p, i) => (
              <g key={`b${i}`} data-solo-pantalla onPointerDown={(e) => empiezaEnBalon(e, i)} onDoubleClick={() => quitaPunto(i)} style={{ cursor: "move" }}>
                <circle cx={p.x} cy={p.y} r={1.6} style={{ fill: "transparent" }} />
                <circle cx={p.x} cy={p.y} r={0.75} style={{ fill: i === 0 ? C.balon : "rgba(255,255,255,0.15)", stroke: C.balon, strokeWidth: 0.16 }} />
                <text x={p.x} y={p.y - 1.1} textAnchor="middle" style={{ fontSize: 0.9, fill: C.texto, fontWeight: 700, fontFamily: "Arial, sans-serif" }}>
                  {i === 0 ? "golpeo" : i}
                </text>
              </g>
            ))}

          <Balon p={balon} />
        </svg>
      </div>

      {/* --------------------------- EL TIEMPO ---------------------------- */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={play}
          aria-label={reproduciendo ? "Pausa" : "Reproducir la jugada"}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#C8A96B] text-black transition hover:brightness-110"
        >
          {reproduciendo ? <Pause size={16} /> : t >= 1 ? <RotateCcw size={16} /> : <Play size={16} className="translate-x-px" />}
        </button>
        <input
          type="range"
          min={0}
          max={1000}
          value={Math.round(t * 1000)}
          onChange={(e) => {
            setReproduciendo(false);
            setT(Number(e.target.value) / 1000);
          }}
          aria-label="Instante de la jugada"
          className="min-w-0 flex-1 accent-[#C8A96B]"
        />
        <div className="hidden shrink-0 items-center gap-2 sm:flex" aria-hidden>
          {FASES.map((f) => (
            <span key={f.key} className="inline-flex items-center gap-1 text-[10.5px] text-white/50">
              <span className="inline-block h-0.5 w-3.5 rounded" style={{ background: C.fase[f.key] }} />
              {f.corto}
            </span>
          ))}
        </div>
      </div>

      <p className="text-[11.5px] leading-snug text-white/45">
        {ayuda}
        {rivales.length > 1 ? " Los rombos son la defensa tipo (no un rival concreto)." : ""}
        {fuera > 0 ? ` ${fuera === 1 ? "Uno se queda" : `${fuera} se quedan`} fuera del encuadre: «Medio campo» para verlo todo.` : ""}
        {modo === "balon" && rutina.balon?.length ? (
          <>
            {" "}
            <button type="button" onClick={() => onCambia({ balon: [rutina.balon![0] ?? golpeoDe(rutina.tipo)] })} className="inline-flex items-center gap-1 font-semibold text-white/65 underline-offset-2 hover:text-white hover:underline">
              <Trash2 size={11} />
              Borrar el recorrido
            </button>
          </>
        ) : null}
      </p>

      {elegido && (
        <p className="sr-only" aria-live="polite">
          {etiqueta(PAPELES, elegido.papel)} seleccionado
        </p>
      )}
    </div>
  );
}
