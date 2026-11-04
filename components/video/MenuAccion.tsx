"use client";

/**
 * EL MENÚ DE UNA BOLITA (04/11/2026, lo pidió el analista).
 *
 * «Que cada bolita del gráfico me lleve al vídeo o al gráfico, según quiera
 * yo». Al pinchar (o tocar, o Intro con el teclado) un punto de un campograma
 * sale este menú junto al punto con lo que esa acción tiene de verdad:
 *
 * - «Ver el vídeo»: nuestro corte (aquí mismo, en una ventana propia) o el
 *   resumen de YouTube en su segundo (pestaña nueva).
 * - «Abrir en Hudl · mm:ss»: Hudl no deja enlazar a un instante.
 * - «Ver el gráfico»: la acción dibujada en el laboratorio de ABP.
 * - «Ver en la tabla»: baja a su fila y la resalta (`irAFila`).
 *
 * Lo que la acción no tiene no se ofrece; sin ninguna opción, no se abre.
 * Lo usan ABP de la categoría, robos y pérdidas, faltas y saques de banda.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as KeyboardEventReact, type ReactNode } from "react";
import { ExternalLink, Film, LineChart, ListOrdered, Play, X } from "lucide-react";

import { esYoutube, type EnlaceHudlAccion } from "@/components/video/VerAccion";
import { rotuloSegundo } from "@/lib/goles/tecnico";

export type OpcionMenuAccion = {
  clave: string;
  etiqueta: string;
  detalle?: string;
  icono: "video" | "hudl" | "grafico" | "tabla";
  /** Enlace que se abre en otra pestaña. */
  href?: string;
  /** Corte propio (mp4): se ve aquí, en una ventana. */
  video?: string;
  hacer?: () => void;
};

type Apertura = { x: number; y: number; titulo: string; opciones: OpcionMenuAccion[] };

/** Lo que basta para saber dónde se pinchó: un evento de ratón, de teclado o de toque. */
type Origen = { currentTarget: EventTarget | null; clientX?: number; clientY?: number };

const ICONOS = { video: Play, hudl: ExternalLink, grafico: LineChart, tabla: ListOrdered };

/** Las opciones de siempre: el vídeo, Hudl y, si la hay, su fila en la tabla. */
export function opcionesDeAccion({
  video,
  hudl,
  grafico,
  fila,
  aLaTabla,
  videoEtiqueta = "Ver el vídeo",
  videoDetalle,
}: {
  video?: string | null;
  /** «Ver el resumen del partido» cuando el vídeo no va al segundo de la acción. */
  videoEtiqueta?: string;
  videoDetalle?: string;
  hudl?: EnlaceHudlAccion | null;
  /** El enlace a la acción dibujada (sólo si se puede abrir). */
  grafico?: string | null;
  /** El id de su fila (`data-fila-accion`) en la tabla de la pantalla. */
  fila?: string | null;
  /** Lo que hay que hacer para que la tabla se vea (cambiar a su pestaña). */
  aLaTabla?: () => void;
}): OpcionMenuAccion[] {
  const salida: OpcionMenuAccion[] = [];

  if (video)
    salida.push(
      esYoutube(video)
        ? { clave: "video", etiqueta: videoEtiqueta, detalle: videoDetalle ?? "YouTube", icono: "video", href: video }
        : { clave: "video", etiqueta: videoEtiqueta, ...(videoDetalle ? { detalle: videoDetalle } : {}), icono: "video", video },
    );

  if (hudl) salida.push({ clave: "hudl", etiqueta: "Abrir en Hudl", detalle: rotuloSegundo(hudl.seg), icono: "hudl", href: hudl.url });

  if (grafico) salida.push({ clave: "grafico", etiqueta: "Ver el gráfico", detalle: "Laboratorio", icono: "grafico", href: grafico });

  if (fila) salida.push({ clave: "tabla", etiqueta: "Ver en la tabla", icono: "tabla", hacer: () => {
        aLaTabla?.();
        irAFila(fila);
      },
    });

  return salida;
}

/**
 * Baja a la fila `data-fila-accion={id}`, la resalta un momento y le da el foco.
 * Si la tabla está en otra pestaña (o en una lista que se acaba de abrir), la
 * espera unos fotogramas a que se pinte.
 */
export function irAFila(id: string, intentos = 45) {
  /* La que se ve: hay pantallas con tarjetas en el móvil y tabla en el portátil. */
  const fila = [...document.querySelectorAll<HTMLElement>(`[data-fila-accion="${CSS.escape(id)}"]`)].find((el) => el.getClientRects().length > 0);

  if (!fila) {
    if (intentos > 0) window.requestAnimationFrame(() => irAFila(id, intentos - 1));

    return;
  }

  const quieto = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  fila.scrollIntoView({ block: "center", behavior: quieto ? "auto" : "smooth" });
  fila.classList.remove("mac-fila-resaltada");
  void fila.offsetWidth;
  fila.classList.add("mac-fila-resaltada");

  if (!fila.hasAttribute("tabindex")) fila.setAttribute("tabindex", "-1");

  fila.focus({ preventScroll: true });
  window.setTimeout(() => fila.classList.remove("mac-fila-resaltada"), 2600);
}

/**
 * Las props de una bolita pulsable (un `<circle>` o un `<g>` del SVG): foco
 * con el tabulador, Intro o espacio, y su nombre para el lector de pantalla.
 */
export function propsBolita(nombre: string, alAbrir: (origen: Origen) => void) {
  return {
    role: "button" as const,
    tabIndex: 0,
    "aria-label": nombre,
    "aria-haspopup": "menu" as const,
    className: "mac-bolita",
    style: { cursor: "pointer" },
    onClick: (e: Origen & { stopPropagation: () => void }) => {
      e.stopPropagation();
      alAbrir(e);
    },
    onKeyDown: (e: KeyboardEventReact<Element>) => {
      if (e.key !== "Enter" && e.key !== " ") return;

      e.preventDefault();
      e.stopPropagation();
      alAbrir(e);
    },
  };
}

export function useMenuAccion() {
  const [apertura, setApertura] = useState<Apertura | null>(null);

  /** Abre el menú junto a la bolita. Sin opciones no hace nada y devuelve `false`. */
  const abre = useCallback((origen: Origen, titulo: string, opciones: OpcionMenuAccion[]) => {
    if (!opciones.length) return false;

    let x = origen.clientX ?? 0;
    let y = origen.clientY ?? 0;

    /* Con el teclado no hay puntero: el menú sale debajo del punto. */
    if (!x && !y && origen.currentTarget instanceof Element) {
      const r = origen.currentTarget.getBoundingClientRect();

      x = r.left + r.width / 2;
      y = r.bottom;
    }

    setApertura({ x, y, titulo, opciones });

    return true;
  }, []);

  const cierra = useCallback(() => setApertura(null), []);

  return { abre, cierra, menu: <MenuAccion apertura={apertura} onCierra={cierra} /> };
}

function MenuAccion({ apertura, onCierra }: { apertura: Apertura | null; onCierra: () => void }) {
  const [video, setVideo] = useState<{ url: string; titulo: string } | null>(null);

  return (
    <>
      {apertura ? <Menu key={`${apertura.x}-${apertura.y}-${apertura.titulo}`} apertura={apertura} onCierra={onCierra} onVideo={setVideo} /> : null}
      {video ? <VentanaVideo {...video} onCierra={() => setVideo(null)} /> : null}
    </>
  );
}

function Menu({ apertura, onCierra, onVideo }: { apertura: Apertura; onCierra: () => void; onVideo: (v: { url: string; titulo: string }) => void }) {
  const caja = useRef<HTMLDivElement>(null);
  const antes = useRef<HTMLElement | null>(null);

  /* Se coloca junto al punto sin salirse de la ventana (390 px incluidos). */
  useLayoutEffect(() => {
    const el = caja.current;

    if (!el) return;

    const ancho = el.offsetWidth;
    const alto = el.offsetHeight;
    const izquierda = Math.min(Math.max(8, apertura.x - 16), window.innerWidth - ancho - 8);
    let arriba = apertura.y + 10;

    if (arriba + alto > window.innerHeight - 8) arriba = Math.max(8, apertura.y - alto - 10);

    el.style.left = `${Math.max(8, izquierda)}px`;
    el.style.top = `${arriba}px`;
    el.style.visibility = "visible";
  }, [apertura]);

  useEffect(() => {
    antes.current = document.activeElement as HTMLElement | null;
    caja.current?.querySelector<HTMLElement>("[role=menuitem]")?.focus();

    const fuera = (e: Event) => {
      if (caja.current && !caja.current.contains(e.target as Node)) onCierra();
    };

    const mueve = () => onCierra();

    document.addEventListener("pointerdown", fuera, true);
    window.addEventListener("resize", mueve);
    window.addEventListener("scroll", mueve, { passive: true, capture: true });

    return () => {
      document.removeEventListener("pointerdown", fuera, true);
      window.removeEventListener("resize", mueve);
      window.removeEventListener("scroll", mueve, { capture: true });
    };
  }, [onCierra]);

  const vuelve = () => {
    const a = antes.current;

    if (a && document.contains(a)) a.focus({ preventScroll: true });
  };

  const teclas = (e: KeyboardEventReact<HTMLDivElement>) => {
    e.stopPropagation();

    const items = [...(caja.current?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? [])];
    const i = items.indexOf(document.activeElement as HTMLElement);

    if (e.key === "Escape" || e.key === "Tab") {
      e.preventDefault();
      onCierra();
      vuelve();
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      items[(i + (e.key === "ArrowDown" ? 1 : items.length - 1)) % items.length]?.focus();
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      items[e.key === "Home" ? 0 : items.length - 1]?.focus();
    }
  };

  const elige = (o: OpcionMenuAccion) => {
    onCierra();

    if (o.video) onVideo({ url: o.video, titulo: apertura.titulo });
    else o.hacer?.();
  };

  return (
    <div ref={caja} role="menu" aria-label={apertura.titulo} className="mac-menu" style={{ visibility: "hidden" }} onKeyDown={teclas}>
      <p className="mac-titulo">{apertura.titulo}</p>

      {apertura.opciones.map((o) => {
        const Icono = o.icono === "video" && o.href ? Film : ICONOS[o.icono];
        const dentro: ReactNode = (
          <>
            <Icono size={15} aria-hidden className="mac-icono" />
            <span className="min-w-0 flex-1 truncate">{o.etiqueta}</span>
            {o.detalle ? <span className="mac-detalle">{o.detalle}</span> : null}
          </>
        );

        return o.href ? (
          <a key={o.clave} role="menuitem" href={o.href} target="_blank" rel="noreferrer" className="mac-item" onClick={() => onCierra()}>
            {dentro}
          </a>
        ) : (
          <button key={o.clave} type="button" role="menuitem" className="mac-item" onClick={() => elige(o)}>
            {dentro}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Las mismas opciones, en fila (para la lista de una tabla). «Ver en la
 * tabla» no sale: ya se está en ella. El corte propio se abre en la ventana.
 */
export function BotonesAccion({ titulo, opciones }: { titulo: string; opciones: OpcionMenuAccion[] }) {
  const [video, setVideo] = useState<string | null>(null);
  const vistas = opciones.filter((o) => o.icono !== "tabla");

  if (!vistas.length) return null;

  return (
    <span className="flex flex-wrap gap-1.5">
      {vistas.map((o) => {
        const Icono = o.icono === "video" && o.href ? Film : ICONOS[o.icono];
        const dentro = (
          <>
            <Icono size={13} aria-hidden className="text-[#C8A96B]" />
            {o.etiqueta}
            {o.detalle ? <span className="tabular-nums text-white/45">· {o.detalle}</span> : null}
          </>
        );
        const clase =
          "inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1 text-[11px] text-white/75 transition hover:bg-white/[0.06] hover:text-white";

        return o.href ? (
          <a key={o.clave} href={o.href} target="_blank" rel="noreferrer" className={clase} aria-label={`${o.etiqueta}: ${titulo}`}>
            {dentro}
          </a>
        ) : (
          <button key={o.clave} type="button" className={clase} aria-label={`${o.etiqueta}: ${titulo}`} onClick={() => (o.video ? setVideo(o.video) : o.hacer?.())}>
            {dentro}
          </button>
        );
      })}
      {video ? <VentanaVideo url={video} titulo={titulo} onCierra={() => setVideo(null)} /> : null}
    </span>
  );
}

/** El corte propio, en una ventana encima de la pantalla. */
function VentanaVideo({ url, titulo, onCierra }: { url: string; titulo: string; onCierra: () => void }) {
  const cerrar = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const antes = document.activeElement as HTMLElement | null;

    cerrar.current?.focus();

    return () => {
      if (antes && document.contains(antes)) antes.focus({ preventScroll: true });
    };
  }, []);

  return (
    <div
      className="modal-veil dlg-velo"
      onMouseDown={(e) => e.target === e.currentTarget && onCierra()}
      onKeyDown={(e) => {
        e.stopPropagation();

        if (e.key === "Escape") {
          e.preventDefault();
          onCierra();
        }
      }}
    >
      <div role="dialog" aria-modal="true" aria-label={titulo} className="mac-ventana">
        <div className="mb-3 flex items-start gap-3">
          <p className="min-w-0 flex-1 text-sm font-semibold">{titulo}</p>
          <button ref={cerrar} type="button" onClick={onCierra} className="mac-cerrar" aria-label="Cerrar el vídeo">
            <X size={16} aria-hidden />
          </button>
        </div>
        <video src={url} controls autoPlay playsInline preload="auto" className="aspect-video w-full rounded-xl bg-black" />
      </div>
    </div>
  );
}
