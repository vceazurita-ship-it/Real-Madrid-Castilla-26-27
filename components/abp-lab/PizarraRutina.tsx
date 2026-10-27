"use client";

/**
 * LA PIZARRA VIVA DEL TALLER (21/10/2026; segunda generación el 24/10/2026).
 *
 * La rutina sobre el medio campo, en metros (`lib/abp-lab/campo.ts`), dibujada
 * por `Escena` con la cámara que se elija (cenital, televisión o a pie de
 * campo) y simulada en el tiempo (`lib/abp-lab/simulacion.ts`):
 * - **Colocar / Carreras / Balón**: se edita igual en las tres cámaras (el
 *   puntero se traduce a metros con la inversa de la proyección).
 * - **Línea de tiempo**: reproducir, pausa, velocidad, bucle y saltos a los
 *   momentos (salida, golpeo, remate, final).
 * - **Defensa**: la tipo de la rutina, la del próximo rival (su scouting de
 *   ABP y sus jugadores más altos) o ninguna; se mueve, persigue y se deja
 *   bloquear.
 * - **Lecturas**: el espacio que gana cada uno, los duelos aéreos con la
 *   altura de verdad y el xG estimado del remate; y el encaje contra zona,
 *   mixta y al hombre.
 * - **Exportar**: PNG, PDF por momentos, vídeo MP4 y GIF (`lib/abp-lab/exporta.ts`).
 * - **Presentar**: pantalla completa tipo retransmisión (`Presentacion`).
 *
 * Atajos: espacio, ← →, 1-2-3, C, V, D, N, F, R, [ ], L, M, P, E y «?».
 */

import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { flushSync } from "react-dom";
import {
  Box,
  Download,
  Eye,
  FileImage,
  FileText,
  Film,
  Flame,
  FlipHorizontal2,
  Image as ImageIcon,
  Keyboard,
  LayoutTemplate,
  Link2,
  ListPlus,
  MousePointer2,
  Route,
  ScanEye,
  Tag,
  Trash2,
  Tv,
  UserRound,
  Waves,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { toast } from "sonner";

import type { JugadorLab } from "@/components/abp-lab/comun";
import { CODIGO_PAPEL, Escena, usePaleta, type Capas } from "@/components/abp-lab/Escena";
import { EscenaViva } from "@/components/abp-lab/EscenaViva";
import { LineaTiempo, useReloj } from "@/components/abp-lab/LineaTiempo";
import { Presentacion } from "@/components/abp-lab/Presentacion";
import { estructuraPara, useSimulacionFija, type ContextoSim, type QueDefensa, type RutinaSimulable } from "@/components/abp-lab/useSimulacion";
import { ANCHO, VUELO, encuadre, focoDe, fondoVisible, golpeoDe, limita, posicionesEn, recorridoBalon, reflejada, salidas, type Marco } from "@/lib/abp-lab/campo";
import { VISTAS, creaCamara, type Vista } from "@/lib/abp-lab/camara";
import { leeFoto } from "@/lib/abp-lab/fotos";
import { exportaGif, exportaPdf, exportaPng, exportaVideo, pngDe, sabeVideo, type Rodaje, type Rotulo } from "@/lib/abp-lab/exporta";
import { DEFENSAS, ENVIOS, PAPELES, TIPOS, etiqueta, type Envio, type Punto, type Rol } from "@/lib/abp-lab/modelo";
import { MARCAS, momentoDe } from "@/lib/abp-lab/simulacion";
import { PRESION_LABEL } from "@/lib/abp-lab/ventaja";
import { ZONAS_REMATE, comaXg } from "@/lib/abp-lab/xg";
import { FAMILIA_PORTADA, esperaFuentePortada } from "@/lib/rivals/portada-font";

export { CODIGO_PAPEL };

export type RutinaEnPizarra = RutinaSimulable;

type Modo = "colocar" | "carreras" | "balon";

const MODOS: { key: Modo; label: string; icon: typeof MousePointer2; ayuda: string }[] = [
  { key: "colocar", label: "Colocar", icon: MousePointer2, ayuda: "Arrastra a cada uno a su sitio de salida." },
  { key: "carreras", label: "Carreras", icon: Route, ayuda: "Arrastra desde un jugador hasta donde acaba su carrera. Sin moverte, se borra." },
  { key: "balon", label: "Balón", icon: Tag, ayuda: "Toca el campo para añadir puntos al recorrido; arrástralos para moverlos y doble toque para quitarlos." },
];

const ASPECTO = 1.62;

const CAPAS_INICIALES: Capas = { nombres: true, fotos: true, ventaja: false, duelos: true, llegada: false };

export const ATAJOS: { teclas: string; que: string }[] = [
  { teclas: "Espacio", que: "Reproducir / pausa" },
  { teclas: "← →", que: "Un fotograma atrás / adelante" },
  { teclas: "Mayús + ← →", que: "Momento anterior / siguiente" },
  { teclas: "Inicio / Fin", que: "Salida / final" },
  { teclas: "[ ]", que: "Más lento / más rápido" },
  { teclas: "L", que: "Repetir en bucle" },
  { teclas: "1 2 3", que: "Colocar · Carreras · Balón" },
  { teclas: "C", que: "Cambiar de cámara" },
  { teclas: "R", que: "Defensa: tipo · próximo rival · ninguna" },
  { teclas: "V · D · H", que: "Espacio · duelos aéreos · mapa de llegada" },
  { teclas: "N · F", que: "Nombres · fotos" },
  { teclas: "M", que: "La misma desde el otro lado" },
  { teclas: "P", que: "Presentar a pantalla completa" },
  { teclas: "E", que: "Exportar en PNG" },
  { teclas: "Ctrl + Z · Ctrl + Mayús + Z", que: "Deshacer · rehacer" },
  { teclas: "?", que: "Esta ayuda" },
];

/* ------------------------------------------------------------------ */
/*  FOTOS LEÍDAS (para que salgan al exportar)                          */
/* ------------------------------------------------------------------ */

/** Las fotos de los jugadores con papel, ya como `data:`; las que no se leen se quedan con su URL. */
function useFotos(urls: string[], activo: boolean) {
  const [fotos, setFotos] = useState<Map<string, string>>(() => new Map());

  const clave = urls.join("|");

  useEffect(() => {
    if (!activo) return;

    let vivo = true;

    const lista = clave ? clave.split("|") : [];

    void Promise.all(lista.map(async (u) => [u, await leeFoto(u)] as const)).then((pares) => {
      if (!vivo) return;

      setFotos((antes) => {
        const nuevo = new Map(antes);

        let cambia = false;

        for (const [u, d] of pares) {
          if (d && nuevo.get(u) !== d) {
            nuevo.set(u, d);
            cambia = true;
          }
        }

        return cambia ? nuevo : antes;
      });
    });

    return () => {
      vivo = false;
    };
  }, [clave, activo]);

  return fotos;
}

/* ------------------------------------------------------------------ */
/*  LA MINIATURA (tarjetas de la biblioteca)                            */
/* ------------------------------------------------------------------ */

const SIN_CAPAS: Capas = { nombres: false, fotos: false, ventaja: false, duelos: false };

/** La rutina quieta: salidas, carreras y balón, recortada a donde pasa todo. */
export function MiniPizarra({ rutina, porId, className = "" }: { rutina: RutinaEnPizarra; porId: Map<string, JugadorLab>; className?: string }) {
  const id = useId().replace(/:/g, "");

  const paleta = usePaleta();

  const cam = useMemo(() => creaCamara("cenital", encuadre(rutina, 16 / 9), 16 / 9), [rutina]);

  const nuestros = useMemo(() => salidas(rutina.roles), [rutina.roles]);

  return (
    <Escena
      id={`mini${id}`}
      rutina={rutina}
      porId={porId}
      t={0}
      cam={cam}
      paleta={paleta}
      nuestros={nuestros}
      defensa={null}
      capas={SIN_CAPAS}
      etiqueta={`Esquema de ${rutina.nombre || "la rutina"}`}
      className={className}
      quieta
    />
  );
}

/* ------------------------------------------------------------------ */
/*  LA PIZARRA GRANDE                                                  */
/* ------------------------------------------------------------------ */

type Arrastre = { que: "salida" | "carrera" | "balon"; i: number; desde: Punto; movido: boolean } | null;

const escribiendo = (el: EventTarget | null) => {
  const t = el as HTMLElement | null;

  return Boolean(t && (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement || t.isContentEditable));
};

export function PizarraRutina({
  rutina,
  porId,
  onCambia,
  seleccionado,
  onSelecciona,
  ctx,
  onComparte,
  textoTarea,
  onAPizarra,
}: {
  rutina: RutinaEnPizarra;
  porId: Map<string, JugadorLab>;
  /** Copia el enlace que abre esta rutina (lo arma el estudio, que tiene la rutina entera). */
  onComparte?: () => void;
  /** La manda a la pizarra de ABP como diapositiva (nueva o sustituyendo una): lo arma el estudio. */
  onAPizarra?: () => void;
  /** La rutina contada como tarea, para pegarla en el microciclo. */
  textoTarea?: string;
  /** Cambia los papeles, el recorrido del balón o el envío. */
  onCambia: (cambio: { roles?: Rol[]; balon?: Punto[]; envio?: Envio }) => void;
  seleccionado: number | null;
  onSelecciona: (i: number | null) => void;
  ctx: ContextoSim;
}) {
  const id = useId().replace(/:/g, "");

  const svg = useRef<SVGSVGElement>(null);

  const arrastre = useRef<Arrastre>(null);

  const paleta = usePaleta();

  const [modo, setModo] = useState<Modo>("colocar");

  const [vistaCam, setVistaCam] = useState<Vista>("cenital");

  const [capas, setCapas] = useState<Capas>(CAPAS_INICIALES);

  const conmuta = (k: keyof Capas) => setCapas((c) => ({ ...c, [k]: !c[k] }));

  const [que, setQue] = useState<QueDefensa>("tipo");

  const [presentando, setPresentando] = useState(false);

  const [ayuda, setAyuda] = useState(false);

  const [menuExporta, setMenuExporta] = useState(false);

  const [exportando, setExportando] = useState<{ que: string; avance: number } | null>(null);

  const reloj = useReloj(0);

  const { setT, para } = reloj;

  /*
   * El encuadre: la jugada de cerca o el medio campo entero. El de la jugada
   * se congela mientras se edita —si siguiera a cada arrastre, la vista
   * saltaría bajo el dedo— y se recalcula al cambiar de vista o de tipo, al
   * añadir o quitar papeles y con «Otro lado».
   */
  const [vista, setVista] = useState<"jugada" | "todo">("jugada");

  const [vuelta, setVuelta] = useState(0);

  const fondo = fondoVisible(rutina.tipo);

  const calculaMarco = (): Marco => (vista === "todo" ? { x: -2, y: -3, w: ANCHO + 4, h: fondo + 4 } : encuadre(rutina, ASPECTO, 6));

  const claveMarco = `${vista}|${rutina.tipo}|${rutina.roles.length}|${vuelta}`;

  const [{ marco, foco }, setEncuadre] = useState<{ marco: Marco; foco: Punto[] }>(() => ({ marco: calculaMarco(), foco: focoDe(rutina) }));

  const [claveVista, setClaveVista] = useState(claveMarco);

  if (claveVista !== claveMarco) {
    setClaveVista(claveMarco);
    setEncuadre({ marco: calculaMarco(), foco: focoDe(rutina) });
  }

  /* En perspectiva se encuadra la jugada, no el medio campo; con «Medio campo», todo. */
  const cam = useMemo(() => creaCamara(vistaCam, marco, ASPECTO, vista === "todo" ? undefined : foco), [vistaCam, marco, foco, vista]);

  const ofensiva = rutina.lado === "ofensivo";

  const queEfectiva: QueDefensa = ofensiva ? que : "ninguna";

  /* Lo que no cambia con el instante; lo que sí lo calcula `EscenaViva`, que es la única que se redibuja al reproducir. */
  const sim = useSimulacionFija(rutina, queEfectiva, ctx);

  const desde = useMemo(() => salidas(rutina.roles), [rutina.roles]);

  const camino = useMemo(() => recorridoBalon(rutina), [rutina]);

  const urls = useMemo(
    () =>
      [...new Set(rutina.roles.map((r) => porId.get(r.jugador)?.foto ?? "").filter(Boolean))]
        .sort()
        .slice(0, 14),
    [rutina.roles, porId],
  );

  const fotos = useFotos(urls, capas.fotos);

  const estructura = estructuraPara(ctx.rival, rutina.tipo);

  const hayProximo = Boolean(ofensiva && ctx.rival && (estructura || ctx.rival.plantilla.length) && (rutina.tipo === "corner" || rutina.tipo === "falta"));

  /* Los que salen o acaban fuera del encuadre (no depende del instante: así la pizarra no se redibuja al reproducir). */
  const fuera = useMemo(() => {
    const dentro = (p: Punto) => p.x >= marco.x && p.x <= marco.x + marco.w && p.y >= marco.y && p.y <= marco.y + marco.h;

    const fin = posicionesEn(rutina.roles, 1);

    return salidas(rutina.roles).filter((p, i) => !dentro(p) || !dentro(fin[i])).length;
  }, [rutina.roles, marco]);

  /* --------------------------- coordenadas ---------------------------- */

  const enMetros = useCallback(
    (e: { clientX: number; clientY: number }): Punto | null => {
      const el = svg.current;

      const m = el?.getScreenCTM();

      if (!el || !m) return null;

      const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());

      const suelo = cam.desproy(p.x, p.y);

      return suelo ? limita(suelo) : null;
    },
    [cam],
  );

  const pararTiempo = () => {
    para();
    setT(0);
  };

  /* ----------------------------- arrastres ---------------------------- */

  const ponRol = (i: number, cambio: Partial<Rol>) => onCambia({ roles: rutina.roles.map((r, j) => (j === i ? { ...r, ...cambio } : r)) });

  const sinCarrera = (i: number) => {
    const { hx: _hx, hy: _hy, ...sin } = rutina.roles[i];

    void _hx;
    void _hy;

    onCambia({ roles: rutina.roles.map((r, j) => (j === i ? sin : r)) });
  };

  const empiezaEnFicha = (e: PointerEvent<SVGGElement>, i: number) => {
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

  const empiezaEnBalon = (e: PointerEvent<SVGGElement>, i: number) => {
    e.stopPropagation();

    if (modo !== "balon") return;

    const p = enMetros(e);

    if (!p) return;

    pararTiempo();
    svg.current?.setPointerCapture(e.pointerId);
    arrastre.current = { que: "balon", i, desde: p, movido: false };
  };

  const enCampo = (e: PointerEvent<SVGSVGElement>) => {
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

  const mueve = (e: PointerEvent<SVGSVGElement>) => {
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

  const suelta = (e: PointerEvent<SVGSVGElement>) => {
    const a = arrastre.current;

    arrastre.current = null;

    if (svg.current?.hasPointerCapture(e.pointerId)) svg.current.releasePointerCapture(e.pointerId);

    /* Un toque sin arrastrar en modo carreras borra la carrera de ese jugador. */
    if (a && a.que === "carrera" && !a.movido && rutina.roles[a.i].hx !== undefined) sinCarrera(a.i);
  };

  const quitaPunto = (i: number) => {
    if (modo !== "balon" || i === 0) return;

    const actual = rutina.balon?.length ? rutina.balon : camino;

    onCambia({ balon: actual.filter((_, j) => j !== i) });
  };

  /* ------------------------------ teclado ----------------------------- */

  const teclaEnFicha = (e: KeyboardEvent<SVGGElement>, i: number) => {
    const paso = e.shiftKey ? 2 : 0.5;

    const d: Record<string, [number, number]> = { ArrowLeft: [-paso, 0], ArrowRight: [paso, 0], ArrowUp: [0, -paso], ArrowDown: [0, paso] };

    if (e.key === "Delete" || e.key === "Backspace") {
      if (modo === "carreras" && rutina.roles[i].hx !== undefined) {
        e.preventDefault();
        sinCarrera(i);
      }

      return;
    }

    if (!d[e.key]) return;

    e.preventDefault();
    e.stopPropagation();
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

  const textoDefensa = !ofensiva
    ? ""
    : queEfectiva === "proximo" && ctx.rival
      ? `contra ${ctx.rival.equipo}`
      : queEfectiva === "tipo"
        ? etiqueta(DEFENSAS, rutina.contra).toLowerCase()
        : "";

  const rotulo = useCallback(
    (tt: number): Rotulo => ({
      titulo: rutina.nombre || "Rutina",
      sub: [`${etiqueta(TIPOS, rutina.tipo)} ${ofensiva ? "a favor" : "en contra"}`, rutina.senal ? `señal «${rutina.senal}»` : "", textoDefensa].filter(Boolean).join(" · "),
      momento: momentoDe(tt),
      ...(sim.remate && !sim.remate.directo && sim.remate.quien !== null && tt >= VUELO[1] - 0.02 ? { dato: `xG ${comaXg(sim.remate.xg)}` } : {}),
      fondo: paleta.cielo,
    }),
    [rutina.nombre, rutina.tipo, rutina.senal, ofensiva, textoDefensa, sim.remate, paleta.cielo],
  );

  /*
   * El rodaje pone cada instante con `flushSync`: el SVG queda pintado al
   * volver, sin esperar a un fotograma de pantalla (que en una pestaña en
   * segundo plano no llega nunca y dejaba la exportación colgada).
   */
  const rodajeDe = (): Rodaje => ({ pon: (v) => flushSync(() => setT(v)), svg: () => svg.current, rotulo, familia: FAMILIA_PORTADA });

  const exporta = async (formato: "png" | "pdf" | "video" | "gif") => {
    if (exportando) return;

    setMenuExporta(false);

    const antes = reloj.ahora();

    para();

    setExportando({ que: formato, avance: 0 });

    await esperaFuentePortada().catch(() => undefined);

    const rodaje = rodajeDe();

    const nombre = rutina.nombre || "rutina";

    try {
      if (formato === "png") {
        await exportaPng(rodaje, antes, nombre);
        toast.success("PNG descargado");
      } else if (formato === "pdf") {
        await exportaPdf(rodaje, MARCAS, nombre, `RM Castilla · Laboratorio de ABP · ${nombre}`);
        toast.success("PDF descargado: una hoja por momento");
      } else if (formato === "video") {
        const r = await exportaVideo(rodaje, nombre, (a) => setExportando({ que: formato, avance: a }));

        toast.success(`Vídeo ${r.formato} · ${r.segundos.toFixed(1).replace(".", ",")} s · ${(r.bytes / 1_000_000).toFixed(1).replace(".", ",")} MB`);
      } else {
        const r = await exportaGif(rodaje, nombre, (a) => setExportando({ que: formato, avance: a }));

        toast.success(`GIF · ${(r.bytes / 1_000_000).toFixed(1).replace(".", ",")} MB`);
      }
    } catch (error) {
      console.error("[laboratorio-abp] exportar", error);
      toast.error(error instanceof Error && error.message ? error.message : "No se ha podido exportar");
    } finally {
      setT(antes);
      setExportando(null);
    }
  };

  /** La jugada como imagen en el portapapeles (o descargada, si el navegador no deja) y la pizarra de ABP abierta al lado. */
  const aLaPizarraAbp = async () => {
    if (exportando) return;

    setMenuExporta(false);

    const antes = reloj.ahora();

    para();

    setExportando({ que: "png", avance: 0 });

    try {
      await esperaFuentePortada().catch(() => undefined);

      const blob = await pngDe(rodajeDe(), antes);

      if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        toast.success("Jugada copiada como imagen", { description: "Pégala en la diapositiva o en el PowerPoint de la pizarra de ABP." });
      } else {
        await exportaPng(rodajeDe(), antes, rutina.nombre || "rutina");
        toast.success("Jugada descargada en PNG", { description: "Este navegador no deja copiar imágenes: añádela desde la carpeta de descargas." });
      }

      window.open("/abp-pizarra", "_blank", "noopener");
    } catch (error) {
      console.error("[laboratorio-abp] a la pizarra", error);
      toast.error("No se ha podido copiar la jugada");
    } finally {
      setT(antes);
      setExportando(null);
    }
  };

  /** La rutina contada como tarea, al portapapeles, y el microciclo de ABP abierto al lado. */
  const alMicrociclo = async () => {
    setMenuExporta(false);

    if (!textoTarea) return;

    try {
      await navigator.clipboard.writeText(textoTarea);
      toast.success("Tarea copiada", { description: "Pégala en la tarea de ABP del día en el microciclo." });
      window.open("/abp-microciclo", "_blank", "noopener");
    } catch {
      toast.error("El navegador no deja copiar: selecciona el texto a mano");
    }
  };

  const llevaA = (k: string) => {
    if (k === "enlace") {
      setMenuExporta(false);
      onComparte?.();
    } else if (k === "diapositiva") {
      setMenuExporta(false);
      onAPizarra?.();
    } else if (k === "pizarra") void aLaPizarraAbp();
    else void alMicrociclo();
  };

  /* --------------------------- atajos globales -------------------------- */

  const atajos = useRef<(e: globalThis.KeyboardEvent) => void>(() => undefined);

  useEffect(() => {
    atajos.current = (e) => {
      if (presentando || exportando || e.defaultPrevented || escribiendo(e.target)) return;

      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const enFicha = (e.target as HTMLElement | null)?.closest?.("[data-ficha]");

      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;

      const hecho = () => e.preventDefault();

      switch (k) {
        case " ":
        case "k":
          hecho();
          reloj.alterna();
          break;
        case "ArrowRight":
        case "ArrowLeft":
          if (enFicha) return;
          hecho();
          if (e.shiftKey) reloj.salta(k === "ArrowRight" ? 1 : -1);
          else reloj.empuja(k === "ArrowRight" ? 1 / 90 : -1 / 90);
          break;
        case "Home":
          hecho();
          para();
          setT(0);
          break;
        case "End":
          hecho();
          para();
          setT(1);
          break;
        case "[":
          reloj.cambiaVelocidad(-1);
          break;
        case "]":
          reloj.cambiaVelocidad(1);
          break;
        case "l":
          reloj.setBucle(!reloj.bucle);
          break;
        case "1":
        case "2":
        case "3":
          setModo(MODOS[Number(k) - 1].key);
          break;
        case "c":
          setVistaCam((v) => VISTAS[(VISTAS.findIndex((x) => x.key === v) + 1) % VISTAS.length].key);
          break;
        case "r":
          if (ofensiva) setQue((q) => (q === "tipo" ? (hayProximo ? "proximo" : "ninguna") : q === "proximo" ? "ninguna" : "tipo"));
          break;
        case "v":
          conmuta("ventaja");
          break;
        case "d":
          conmuta("duelos");
          break;
        case "h":
          if (ofensiva) conmuta("llegada");
          break;
        case "n":
          conmuta("nombres");
          break;
        case "f":
          conmuta("fotos");
          break;
        case "m":
          pararTiempo();
          onCambia(reflejada(rutina));
          setVuelta((v) => v + 1);
          break;
        case "p":
          setPresentando(true);
          break;
        case "e":
          void exporta("png");
          break;
        case "?":
          setAyuda((a) => !a);
          break;
        default:
          return;
      }
    };
  });

  useEffect(() => {
    const oye = (e: globalThis.KeyboardEvent) => atajos.current(e);

    window.addEventListener("keydown", oye);

    return () => window.removeEventListener("keydown", oye);
  }, []);

  /* ------------------------------ pintar ------------------------------ */

  const ayudaModo = MODOS.find((m) => m.key === modo)?.ayuda ?? "";

  const boton = (activo: boolean) =>
    `inline-flex items-center gap-1 rounded-lg border px-2 py-1.5 text-[11px] font-medium transition ${activo ? "border-[#C8A96B]/60 bg-[#C8A96B]/15 text-[#C8A96B]" : "border-white/10 text-white/65 hover:text-white"}`;

  const remate = sim.remate;

  const rematador = remate?.quien !== null && remate?.quien !== undefined ? porId.get(rutina.roles[remate.quien]?.jugador ?? "") : undefined;

  const calibreZona = remate && ctx.calibre ? ctx.calibre.zonas[remate.zona] : null;

  const mejorEncaje = sim.encaje[0];

  return (
    <div className="min-w-0 space-y-3">
      {/* ------------------------------ BARRA ----------------------------- */}
      <div className="flex flex-wrap items-center gap-2">
        <div role="radiogroup" aria-label="Qué se edita en la pizarra" className="inline-flex gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
          {MODOS.map((m, i) => {
            const Icono = m.icon;

            const activo = m.key === modo;

            return (
              <button
                key={m.key}
                type="button"
                role="radio"
                aria-checked={activo}
                onClick={() => setModo(m.key)}
                title={`${m.label} (${i + 1})`}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${activo ? "bg-[#C8A96B] text-black" : "text-white/60 hover:text-white"}`}
              >
                <Icono size={13} />
                {m.label}
              </button>
            );
          })}
        </div>

        <div role="radiogroup" aria-label="Cámara" className="inline-flex gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
          {VISTAS.map((v) => (
            <button
              key={v.key}
              type="button"
              role="radio"
              aria-checked={vistaCam === v.key}
              onClick={() => setVistaCam(v.key)}
              title={`${v.label} (C)`}
              className={`inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition ${vistaCam === v.key ? "bg-[#C8A96B] text-black" : "text-white/60 hover:text-white"}`}
            >
              {v.key === "cenital" ? <ScanEye size={13} /> : v.key === "tv" ? <Tv size={13} /> : <Box size={13} />}
              {v.corto}
            </button>
          ))}
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <button type="button" onClick={() => setPresentando(true)} title="Presentar a pantalla completa (P)" className="inline-flex items-center gap-1.5 rounded-lg bg-[#C8A96B] px-2.5 py-1.5 text-[11.5px] font-bold text-black transition hover:brightness-110">
            <Tv size={13} />
            Presentar
          </button>
          <div className="relative">
            <button type="button" onClick={() => setMenuExporta((v) => !v)} aria-expanded={menuExporta} aria-haspopup="menu" disabled={Boolean(exportando)} className={boton(menuExporta)}>
              <Download size={13} />
              {exportando ? `${Math.round(exportando.avance * 100)} %` : "Exportar"}
            </button>
            {menuExporta && (
              <div role="menu" className="absolute right-0 top-full z-20 mt-1.5 w-60 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-white/10 bg-[#11161C] p-1 shadow-2xl">
                {[
                  { k: "png" as const, label: "Imagen PNG", detalle: "El instante que se ve (E)", icon: ImageIcon },
                  { k: "pdf" as const, label: "PDF por momentos", detalle: "Salida, golpeo, remate y final", icon: FileText },
                  ...(sabeVideo() ? [{ k: "video" as const, label: "Vídeo", detalle: "MP4 1920 × 1080 con rótulos", icon: Film }] : []),
                  { k: "gif" as const, label: "GIF animado", detalle: "Para WhatsApp, sin reproductor", icon: FileImage },
                ].map((o) => (
                  <button key={o.k} type="button" role="menuitem" onClick={() => void exporta(o.k)} className="flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition hover:bg-white/[0.06]">
                    <o.icon size={15} className="mt-0.5 shrink-0 text-[#C8A96B]" />
                    <span className="min-w-0">
                      <span className="block text-[12.5px] font-semibold text-white/90">{o.label}</span>
                      <span className="block text-[11px] text-white/45">{o.detalle}</span>
                    </span>
                  </button>
                ))}
                <p className="mx-2.5 mt-1.5 border-t border-white/10 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">Llevar a</p>
                {[
                  ...(onComparte ? [{ k: "enlace", label: "Copiar enlace", detalle: "Abre esta rutina tal cual, sin guardarla", icon: Link2 }] : []),
                  ...(onAPizarra ? [{ k: "diapositiva", label: "Pizarra de ABP", detalle: "Como diapositiva nueva o sustituyendo una, con jugadores y consignas", icon: LayoutTemplate }] : []),
                  { k: "pizarra", label: onAPizarra ? "Imagen para la pizarra" : "Pizarra de ABP", detalle: "Copia la imagen y abre la pizarra", icon: onAPizarra ? ImageIcon : LayoutTemplate },
                  ...(textoTarea ? [{ k: "micro", label: "Microciclo de ABP", detalle: "Copia la tarea y abre el microciclo", icon: ListPlus }] : []),
                ].map((o) => (
                  <button key={o.k} type="button" role="menuitem" onClick={() => llevaA(o.k)} className="flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition hover:bg-white/[0.06]">
                    <o.icon size={15} className="mt-0.5 shrink-0 text-[#C8A96B]" />
                    <span className="min-w-0">
                      <span className="block text-[12.5px] font-semibold text-white/90">{o.label}</span>
                      <span className="block text-[11px] text-white/45">{o.detalle}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button type="button" onClick={() => setAyuda((a) => !a)} aria-pressed={ayuda} title="Atajos de teclado (?)" aria-label="Atajos de teclado" className={boton(ayuda)}>
            <Keyboard size={13} />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {ofensiva && (
          <div role="radiogroup" aria-label="Defensa" className="inline-flex gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
            {(
              [
                { k: "tipo" as const, label: "Rival tipo", titulo: `${etiqueta(DEFENSAS, rutina.contra)}, en esquema` },
                ...(hayProximo ? [{ k: "proximo" as const, label: ctx.rival!.equipo, titulo: "El próximo rival: su scouting de ABP y sus jugadores" }] : []),
                { k: "ninguna" as const, label: "Sin rival", titulo: "Sólo los nuestros" },
              ] as const
            ).map((o) => (
              <button
                key={o.k}
                type="button"
                role="radio"
                aria-checked={que === o.k}
                onClick={() => setQue(o.k)}
                title={`${o.titulo} (R)`}
                className={`max-w-[11rem] truncate rounded-lg px-2 py-1 text-[11px] font-semibold transition ${que === o.k ? "bg-white/[0.12] text-white" : "text-white/55 hover:text-white"}`}
              >
                {o.label}
              </button>
            ))}
          </div>
        )}
        <button type="button" onClick={() => conmuta("nombres")} aria-pressed={capas.nombres} title="Nombres (N)" className={boton(capas.nombres)}>
          <Tag size={13} />
          <span className="hidden sm:inline">Nombres</span>
        </button>
        <button type="button" onClick={() => conmuta("fotos")} aria-pressed={capas.fotos} title="Fotos (F)" className={boton(capas.fotos)}>
          <UserRound size={13} />
          <span className="hidden sm:inline">Fotos</span>
        </button>
        {ofensiva && rutina.roles.length > 0 && (
          <button type="button" onClick={() => conmuta("llegada")} aria-pressed={Boolean(capas.llegada)} title="Mapa de calor: dónde llegan los nuestros mientras vuela el balón (H)" className={boton(Boolean(capas.llegada))}>
            <Flame size={13} />
            Llegada
          </button>
        )}
        {ofensiva && sim.plan && (
          <>
            <button type="button" onClick={() => conmuta("ventaja")} aria-pressed={capas.ventaja} title="Quién gana cada espacio del área (V)" className={boton(capas.ventaja)}>
              <Waves size={13} />
              Espacio
            </button>
            <button type="button" onClick={() => conmuta("duelos")} aria-pressed={capas.duelos} title="Duelos aéreos en el remate (D)" className={boton(capas.duelos)}>
              <Eye size={13} />
              Duelos
            </button>
          </>
        )}
        <button type="button" onClick={() => setVista((v) => (v === "jugada" ? "todo" : "jugada"))} title={vista === "jugada" ? "Ver el medio campo entero" : "Acercar a donde pasa la jugada"} className={boton(false)}>
          {vista === "jugada" ? <ZoomOut size={13} /> : <ZoomIn size={13} />}
          <span className="hidden sm:inline">{vista === "jugada" ? "Medio campo" : "Acercar"}</span>
        </button>
        <button
          type="button"
          onClick={() => {
            pararTiempo();
            onCambia(reflejada(rutina));
            setVuelta((v) => v + 1);
          }}
          title="La misma rutina desde el otro córner (M)"
          className={boton(false)}
        >
          <FlipHorizontal2 size={13} />
          <span className="hidden sm:inline">Otro lado</span>
        </button>
      </div>

      {/* ----------------------------- EL CAMPO ---------------------------- */}
      <div className="relative overflow-hidden rounded-2xl border border-white/10 shadow-[0_24px_60px_-28px_rgba(0,0,0,0.65)]" style={{ background: paleta.cielo }}>
        <EscenaViva
          id={id}
          svgRef={svg}
          reloj={reloj}
          rutina={rutina}
          porId={porId}
          cam={cam}
          paleta={paleta}
          fija={sim}
          capas={capas}
          sinTransicion={Boolean(exportando)}
          seleccionado={seleccionado}
          editaBalon={modo === "balon"}
          fotos={fotos}
          cursor={modo === "balon" ? "crosshair" : undefined}
          etiqueta={`Pizarra de ${rutina.nombre || "la rutina"}. ${ayudaModo}`}
          manejadores={{
            onFondo: enCampo,
            onMueve: mueve,
            onSuelta: suelta,
            onFicha: empiezaEnFicha,
            onTeclaFicha: teclaEnFicha,
            onFocoFicha: onSelecciona,
            onPuntoBalon: empiezaEnBalon,
            onQuitaPunto: quitaPunto,
            etiquetaFicha: (i) => {
              const r = rutina.roles[i];

              return `${etiqueta(PAPELES, r.papel)}: ${porId.get(r.jugador)?.nombre ?? "sin dueño"}. Flechas para mover${modo === "carreras" ? " el final de la carrera; Suprimir la borra" : ""}.`;
            },
          }}
        />
        {exportando && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1" style={{ background: "rgba(0,0,0,0.35)" }}>
            <div className="h-full" style={{ width: `${Math.round(exportando.avance * 100)}%`, background: "#C8A96B" }} />
          </div>
        )}
        {ayuda && (
          <div data-abp-tablero="" className="absolute inset-0 overflow-y-auto p-3 sm:p-5" style={{ background: "rgba(5,9,12,0.9)", color: "#FFFFFF" }}>
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: "#C8A96B" }}>
                Atajos de teclado
              </p>
              <button type="button" onClick={() => setAyuda(false)} className="rounded-lg px-2 py-1 text-[11px] font-semibold" style={{ background: "rgba(255,255,255,0.1)", color: "#FFFFFF" }}>
                Cerrar
              </button>
            </div>
            <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-[12px] sm:grid-cols-2">
              {ATAJOS.map((a) => (
                <div key={a.teclas} className="flex items-baseline gap-2">
                  <dt className="shrink-0 rounded px-1.5 py-0.5 font-mono text-[11px]" style={{ background: "rgba(255,255,255,0.1)", color: "#FFFFFF" }}>
                    {a.teclas}
                  </dt>
                  <dd style={{ color: "rgba(255,255,255,0.75)" }}>{a.que}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </div>

      {/* --------------------------- EL TIEMPO ---------------------------- */}
      <LineaTiempo reloj={reloj} />

      <div className="flex flex-wrap items-center gap-2">
        {modo === "balon" && (
          <div role="radiogroup" aria-label="Envío" className="inline-flex gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
            {ENVIOS.map((o) => (
              <button
                key={o.key}
                type="button"
                role="radio"
                aria-checked={(rutina.envio ?? "tenso") === o.key}
                onClick={() => onCambia({ envio: o.key })}
                className={`rounded-lg px-2 py-1 text-[11px] font-semibold transition ${(rutina.envio ?? "tenso") === o.key ? "bg-white/[0.12] text-white" : "text-white/55 hover:text-white"}`}
              >
                {o.label}
              </button>
            ))}
          </div>
        )}
        <p className="min-w-0 flex-1 text-[11.5px] leading-snug text-white/45">
          {ayudaModo}
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
      </div>

      {/* --------------------------- LA LECTURA --------------------------- */}
      {ofensiva && rutina.roles.length > 0 && (remate || sim.encaje.length > 0) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {remate && sim.plan && (
            <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-3.5" aria-label="El remate">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">El remate · {textoDefensa || "sin rival"}</p>
              {remate.quien === null ? (
                <p className="mt-2 text-[13px] leading-snug text-white/75">Con este dibujo nadie llega a donde cae el balón: acerca una carrera o mueve el último punto del recorrido.</p>
              ) : (
                <>
                  <div className="mt-1.5 flex items-baseline gap-2">
                    <span className="text-3xl font-black tabular-nums text-[#C8A96B]">{comaXg(remate.xg)}</span>
                    <span className="text-[12px] text-white/55">xG estimado</span>
                  </div>
                  <ul className="mt-1.5 space-y-0.5 text-[12px] leading-snug text-white/65">
                    <li>
                      {remate.directo ? "Golpeo directo" : `${etiqueta(ZONAS_REMATE, remate.zona)}${rematador ? ` · ${rematador.nombre}` : ""}`}
                    </li>
                    {!remate.directo && (
                      <li>
                        {PRESION_LABEL[remate.presion]}
                        {remate.marca !== null && remate.presion !== "libre" ? ` (a ${remate.marca.toFixed(1).replace(".", ",")} m)` : ""}
                        {remate.disputan > 1 ? ` · lo disputan ${remate.disputan}` : ""}
                      </li>
                    )}
                    {remate.difCm !== null && (
                      <li>
                        Duelo aéreo: {remate.difCm >= 0 ? `le saca ${remate.difCm} cm` : `le sacan ${-remate.difCm} cm`}
                      </li>
                    )}
                  </ul>
                  {calibreZona && calibreZona.remates > 0 && (
                    <p className="mt-2 text-[11px] leading-snug text-white/40">
                      Geometría del remate corregida con {calibreZona.remates} {calibreZona.remates === 1 ? "remate" : "remates"} a balón parado de nuestros partidos en esa zona
                      {calibreZona.goles ? ` (${calibreZona.goles} ${calibreZona.goles === 1 ? "gol" : "goles"})` : ""}.
                    </p>
                  )}
                </>
              )}
            </section>
          )}

          {sim.encaje.length > 0 && (
            <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-3.5" aria-label="Encaje con los sistemas">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">Encaje automático</p>
              <ul className="mt-2 space-y-1.5">
                {sim.encaje.map((e) => {
                  const max = Math.max(0.01, mejorEncaje?.xg ?? 0.01);

                  const suyo = estructura && (estructura.tipo === "zonal" ? "zona" : estructura.tipo) === e.defensa;

                  return (
                    <li key={e.defensa} className="grid grid-cols-[5.6rem_1fr_2.6rem] items-center gap-2 text-[12px]">
                      <span className={`truncate ${suyo ? "font-semibold text-[#C8A96B]" : "text-white/70"}`}>{etiqueta(DEFENSAS, e.defensa)}</span>
                      <span className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
                        <span className="block h-full rounded-full" style={{ width: `${Math.max(4, (e.xg / max) * 100)}%`, background: e === mejorEncaje ? "#C8A96B" : "rgba(200,169,107,0.45)" }} />
                      </span>
                      <span className="text-right tabular-nums text-white/70">{comaXg(e.xg)}</span>
                    </li>
                  );
                })}
              </ul>
              {mejorEncaje && mejorEncaje.xg > 0 && <p className="mt-2 text-[12px] leading-snug text-white/65">Funciona mejor {etiqueta(DEFENSAS, mejorEncaje.defensa).toLowerCase()}.</p>}
              {ctx.rival && estructura && (
                <p className="mt-1.5 text-[12px] leading-snug text-white/65">
                  {ctx.rival.equipo} defiende {estructura.tipo === "zonal" ? `en zona${estructura.enZona ? ` con ${estructura.enZona}` : ""}` : estructura.tipo === "hombre" ? "al hombre" : `en mixta${estructura.enZona ? `, ${estructura.enZona} en zona` : ""}`} (scouting, {estructura.acciones === 1 ? "1 acción" : `${estructura.acciones} acciones`}).
                  {que !== "proximo" && (
                    <>
                      {" "}
                      <button type="button" onClick={() => setQue("proximo")} className="font-semibold text-[#C8A96B] underline-offset-2 hover:underline">
                        Verla contra ellos
                      </button>
                    </>
                  )}
                </p>
              )}
            </section>
          )}
        </div>
      )}

      {seleccionado !== null && rutina.roles[seleccionado] && (
        <p className="sr-only" aria-live="polite">
          {etiqueta(PAPELES, rutina.roles[seleccionado].papel)} seleccionado
        </p>
      )}

      {presentando && <Presentacion rutina={rutina} porId={porId} ctx={ctx} que={queEfectiva} fotos={fotos} onCerrar={() => setPresentando(false)} />}
    </div>
  );
}
