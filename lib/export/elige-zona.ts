"use client";

/**
 * DESCARGAR UNA ZONA EN HD (18/11/2026, el analista: «quiero poder descargar
 * cualquier gráfico o zona de la web directamente en hd … no necesariamente la
 * página entera»).
 *
 * Desde «Exportar → Elegir una zona» la pantalla entra en modo selección: al
 * pasar el ratón se resalta la tarjeta o el gráfico de debajo, y al pinchar se
 * fija. Con la zona fijada sale una barra: «Más grande» / «Más pequeña» suben o
 * bajan por los contenedores (de la gráfica a su tarjeta, de la tarjeta a la
 * sección), «PNG HD» la baja y «Copiar» la deja en el portapapeles para pegarla
 * en un PowerPoint o un WhatsApp. Teclado: ↑ ↓, Intro y Esc.
 *
 * Es DOM a pelo y no un componente: quien lo abre es la fila del menú de
 * herramientas, que se desmonta en cuanto el menú se cierra. Lo que se pinta
 * lleva `data-export-hide`, así que no sale nunca en la foto.
 *
 * Mientras se elige, ningún clic llega a la página (se cortan en la fase de
 * captura): pinchar un gráfico no tiene que abrir su pop-up ni seguir un
 * enlace.
 *
 * La foto va por `capturaNodo` con la nitidez para que el lado largo pase de
 * 3.000 px (×3 como mínimo, ×6 como mucho, y siempre recortada a lo que el
 * aparato pinta), con un margen del color del fondo alrededor.
 */

import { toast } from "sonner";

import { capturaNodo, conLimite, conTope, fuentesListas } from "@/lib/export/captura";
import { descargaEnMarcha, encargaDescarga } from "@/lib/trabajos/descargas";

const ORO = "#C8A96B";
const LADO_OBJETIVO = 3000;
const MARGEN = 24;
const PIXEL = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

let activo: (() => void) | null = null;

/* ------------------------------------------------------------------ */
/*  QUÉ ES UNA «ZONA»                                                  */
/* ------------------------------------------------------------------ */

function transparente(color: string) {
  return !color || color === "transparent" || /rgba\([^)]*,\s*0\)$/.test(color.replace(/\s+/g, " "));
}

/** ¿Parece una tarjeta? Fondo propio, borde, sombra, o marcada a mano. */
export function esCaja(el: HTMLElement) {
  if (el.hasAttribute("data-export-zona") || el.hasAttribute("data-export-panel")) return true;

  const r = el.getBoundingClientRect();
  if (r.width < 120 || r.height < 70) return false;

  const cs = getComputedStyle(el);
  const borde = ["Top", "Right", "Bottom", "Left"].filter(
    (l) => parseFloat(cs.getPropertyValue(`border-${l.toLowerCase()}-width`)) > 0 && !transparente(cs.getPropertyValue(`border-${l.toLowerCase()}-color`)),
  ).length;

  return !transparente(cs.backgroundColor) || borde >= 3 || (cs.boxShadow && cs.boxShadow !== "none") || cs.backgroundImage !== "none";
}

/** De lo que hay bajo el dedo hacia arriba, sin repetir cajas del mismo tamaño. */
function cadenaDe(el: Element | null): HTMLElement[] {
  const cadena: HTMLElement[] = [];
  let previo: DOMRect | null = null;

  for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
    if (!(n instanceof HTMLElement) && !(n instanceof SVGSVGElement)) continue;

    /* Un SVG cuenta entero, no sus trazos: se sube hasta el <svg> de fuera. */
    if (n instanceof SVGElement && n.ownerSVGElement) continue;

    const r = n.getBoundingClientRect();
    if (r.width < 40 || r.height < 30) continue;
    if (previo && Math.abs(previo.width - r.width) < 2 && Math.abs(previo.height - r.height) < 2) {
      cadena[cadena.length - 1] = n as HTMLElement;
      previo = r;
      continue;
    }

    cadena.push(n as HTMLElement);
    previo = r;
  }

  return cadena;
}

/** La zona que se propone de entrada: la primera tarjeta, o el gráfico si no hay tarjeta. */
function propuesta(cadena: HTMLElement[]) {
  const i = cadena.findIndex((n) => n instanceof HTMLElement && n !== document.body && esCaja(n));

  if (i >= 0) {
    const r = cadena[i].getBoundingClientRect();

    /* Una «tarjeta» que es la página entera no vale de entrada. */
    if (r.width * r.height < window.innerWidth * window.innerHeight * 1.6 || i === 0) return i;
  }

  const grafico = cadena.findIndex((n) => n.tagName.toLowerCase() === "svg" || n.tagName === "CANVAS");

  return grafico >= 0 ? grafico : 0;
}

export function nombreDe(el: Element) {
  const titulo =
    el.getAttribute("data-export-zona") ||
    el.getAttribute("aria-label") ||
    el.querySelector("h1,h2,h3,h4,[class*='uppercase']")?.textContent ||
    "";

  return titulo.trim().replace(/\s+/g, " ").slice(0, 60);
}

function slug(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 40);
}

export function fondoDe(el: Element) {
  for (let n: Element | null = el; n; n = n.parentElement) {
    const bg = getComputedStyle(n).backgroundColor;
    if (!transparente(bg)) return bg;
  }

  return "#0B0F14";
}

/* ------------------------------------------------------------------ */
/*  LA FOTO                                                            */
/* ------------------------------------------------------------------ */

function hayFotosDeFuera(root: Element) {
  return Array.from(root.querySelectorAll("img")).some((img) => {
    const src = img.currentSrc || img.src;
    if (!src || src.startsWith("data:") || src.startsWith("blob:")) return false;
    try {
      return new URL(src, location.href).origin !== location.origin;
    } catch {
      return false;
    }
  });
}

export async function fotografia(el: HTMLElement, lado = LADO_OBJETIVO, margen = MARGEN): Promise<Blob> {
  await fuentesListas();

  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el);

  /* Si la zona tiene scroll propio (una tabla larga), sale entera. */
  const conScroll = /auto|scroll/.test(cs.overflowY + cs.overflowX) && (el.scrollHeight > el.clientHeight + 4 || el.scrollWidth > el.clientWidth + 4);
  const ancho = Math.ceil(conScroll ? Math.max(el.scrollWidth, r.width) : r.width);
  const alto = Math.ceil(conScroll ? Math.max(el.scrollHeight, r.height) : r.height);

  const fondo = fondoDe(el);
  const opciones = {
    width: ancho,
    height: alto,
    cacheBust: true,
    includeQueryParams: true,
    backgroundColor: fondo,
    imagePlaceholder: PIXEL,
    style: {
      margin: "0",
      transform: "none",
      ...(conScroll ? { overflow: "visible", maxHeight: "none", maxWidth: "none", height: `${alto}px`, width: `${ancho}px` } : {}),
    },
    filter: (n: HTMLElement) =>
      !(n instanceof HTMLElement) ||
      !(n.hasAttribute("data-export-hide") || n.hasAttribute("data-sonner-toaster") || n.tagName === "SCRIPT" || n.tagName === "NOSCRIPT"),
  };

  if (hayFotosDeFuera(el)) {
    const { toSvg } = await import("html-to-image");
    await conLimite(toSvg(el, conTope(opciones))).catch(() => undefined);
  }

  const deseada = Math.min(6, Math.max(lado >= LADO_OBJETIVO ? 3 : 1, lado / Math.max(ancho, alto, 1)));
  const foto = await capturaNodo(el, { ...opciones, pixelRatio: deseada });

  /* Margen alrededor, del mismo fondo: se pega mejor en una diapositiva. */
  const img = new Image();
  await new Promise<void>((ok, mal) => {
    img.onload = () => ok();
    img.onerror = () => mal(new Error("No se pudo leer la captura"));
    img.src = foto.dataUrl;
  });

  const m = Math.round(margen * foto.nitidez);
  const lienzo = document.createElement("canvas");
  lienzo.width = img.naturalWidth + m * 2;
  lienzo.height = img.naturalHeight + m * 2;
  const ctx = lienzo.getContext("2d");
  if (!ctx) throw new Error("El navegador no deja dibujar la captura.");
  ctx.fillStyle = fondo;
  ctx.fillRect(0, 0, lienzo.width, lienzo.height);
  ctx.drawImage(img, m, m);

  const blob = await new Promise<Blob | null>((ok) => lienzo.toBlob(ok, "image/png"));
  lienzo.width = 0;
  lienzo.height = 0;
  if (!blob) throw new Error("La captura ha salido vacía");

  return blob;
}

export function nombreFichero(el: Element, extension = "png") {
  const ruta = location.pathname.split("/").filter(Boolean).join("-") || "portada";
  const hoy = new Date();
  const fecha = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`;

  return [ruta.slice(0, 40), slug(nombreDe(el)) || "zona", fecha].join("_") + `.${extension}`;
}

/* ------------------------------------------------------------------ */
/*  EL MODO SELECCIÓN                                                  */
/* ------------------------------------------------------------------ */

function boton(texto: string, principal = false) {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = texto;
  b.style.cssText = `pointer-events:auto;cursor:pointer;border-radius:10px;padding:7px 11px;font:600 12px/1.2 system-ui,sans-serif;white-space:nowrap;border:1px solid ${
    principal ? ORO : "rgba(255,255,255,.18)"
  };background:${principal ? ORO : "rgba(255,255,255,.06)"};color:${principal ? "#0B0F14" : "#fff"}`;
  return b;
}

/** Entra en el modo «elegir una zona». Llamarlo otra vez lo cierra. */
export function eligeZona() {
  if (activo) {
    activo();
    return;
  }

  const capa = document.createElement("div");
  capa.setAttribute("data-export-hide", "");
  capa.style.cssText = "position:fixed;inset:0;z-index:2147483000;pointer-events:none";

  const marco = document.createElement("div");
  marco.style.cssText = `position:fixed;display:none;border:2px solid ${ORO};background:rgba(200,169,107,.10);border-radius:10px;box-shadow:0 0 0 9999px rgba(6,13,28,.28);transition:all .08s ease-out`;

  const chapa = document.createElement("div");
  chapa.style.cssText = `position:fixed;display:none;padding:3px 8px;border-radius:6px;background:${ORO};color:#0B0F14;font:600 11px/1.3 system-ui,sans-serif;white-space:nowrap;max-width:70vw;overflow:hidden;text-overflow:ellipsis`;

  const aviso = document.createElement("div");
  aviso.style.cssText =
    "pointer-events:auto;position:fixed;top:12px;left:50%;transform:translateX(-50%);display:flex;gap:10px;align-items:center;max-width:calc(100vw - 24px);padding:9px 10px 9px 14px;border-radius:14px;background:rgba(18,24,32,.96);border:1px solid rgba(255,255,255,.12);box-shadow:0 10px 30px rgba(0,0,0,.4);color:#fff;font:500 12.5px/1.35 system-ui,sans-serif";
  const textoAviso = document.createElement("span");
  textoAviso.textContent = "Pincha el gráfico o la zona que quieras descargar en HD";
  const salir = boton("Salir");
  aviso.append(textoAviso, salir);

  const barra = document.createElement("div");
  barra.style.cssText =
    "pointer-events:auto;position:fixed;display:none;gap:6px;flex-wrap:wrap;padding:6px;border-radius:12px;background:rgba(18,24,32,.97);border:1px solid rgba(255,255,255,.12);box-shadow:0 10px 30px rgba(0,0,0,.45)";
  const masGrande = boton("＋ Más grande");
  const masPequena = boton("－ Más pequeña");
  const png = boton("Descargar PNG HD", true);
  const copiar = boton("Copiar");
  const cancelar = boton("✕");
  barra.append(masPequena, masGrande, png, copiar, cancelar);
  if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) copiar.style.display = "none";

  capa.append(marco, chapa, aviso, barra);
  document.body.appendChild(capa);

  let cadena: HTMLElement[] = [];
  let indice = 0;
  let fijada = false;
  let pendiente = 0;

  const actual = () => cadena[indice] ?? null;

  const pinta = () => {
    pendiente = 0;
    const el = actual();
    if (!el || !el.isConnected) {
      marco.style.display = chapa.style.display = barra.style.display = "none";
      return;
    }

    const r = el.getBoundingClientRect();
    Object.assign(marco.style, { display: "block", left: `${r.left - 3}px`, top: `${r.top - 3}px`, width: `${r.width + 6}px`, height: `${r.height + 6}px` });

    const lado = Math.max(r.width, r.height);
    const factor = Math.min(6, Math.max(3, LADO_OBJETIVO / Math.max(lado, 1)));
    const nombre = nombreDe(el);
    chapa.textContent = `${nombre ? nombre + " · " : ""}${Math.round(r.width * factor)} × ${Math.round(r.height * factor)} px`;
    chapa.style.display = "block";
    chapa.style.left = `${Math.max(8, r.left)}px`;
    chapa.style.top = `${r.top > 30 ? r.top - 26 : Math.min(window.innerHeight - 26, r.bottom + 6)}px`;

    if (fijada) {
      barra.style.display = "flex";
      masGrande.disabled = indice >= cadena.length - 1;
      masPequena.disabled = indice <= 0;
      masGrande.style.opacity = masGrande.disabled ? ".35" : "1";
      masPequena.style.opacity = masPequena.disabled ? ".35" : "1";

      const bw = barra.offsetWidth || 380;
      const bh = barra.offsetHeight || 40;
      let top = r.bottom + 10;
      if (top + bh > window.innerHeight - 8) top = r.top - bh - 34;
      if (top < 60) top = Math.min(window.innerHeight - bh - 12, Math.max(60, r.top + 10));
      barra.style.top = `${top}px`;
      barra.style.left = `${Math.min(window.innerWidth - bw - 8, Math.max(8, r.left))}px`;
      textoAviso.textContent = "↑ ↓ cambian el tamaño · Intro descarga · pincha otra para cambiar";
    } else {
      barra.style.display = "none";
    }
  };

  const repinta = () => {
    if (!pendiente) pendiente = requestAnimationFrame(pinta);
  };

  const esNuestro = (t: EventTarget | null) => t instanceof Node && capa.contains(t);

  const debajo = (x: number, y: number) => {
    const pila = document.elementsFromPoint(x, y);
    return pila.find((n) => !capa.contains(n) && !n.closest("[data-export-hide]")) ?? null;
  };

  const elige = (x: number, y: number) => {
    cadena = cadenaDe(debajo(x, y));
    indice = propuesta(cadena);
    repinta();
  };

  const alMover = (e: PointerEvent) => {
    if (fijada || e.pointerType !== "mouse" || esNuestro(e.target)) return;
    elige(e.clientX, e.clientY);
  };

  const corta = (e: Event) => {
    if (esNuestro(e.target)) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
  };

  const alPinchar = (e: MouseEvent) => {
    if (esNuestro(e.target)) return;
    corta(e);
    elige(e.clientX, e.clientY);
    fijada = Boolean(actual());
    repinta();
  };

  const baja = async (modo: "png" | "copiar") => {
    const el = actual();
    if (!el) return;

    const nombre = nombreFichero(el);
    cierra();

    if (modo === "copiar") {
      try {
        /* La promesa va dentro del ClipboardItem: así Safari no pierde el permiso del clic. */
        await navigator.clipboard.write([new ClipboardItem({ "image/png": fotografia(el) })]);
        toast.success("Copiada en HD", { description: "Pégala en el PowerPoint, el correo o el WhatsApp" });
      } catch (err) {
        toast.error("No se ha podido copiar", { description: err instanceof Error ? err.message : String(err) });
      }
      return;
    }

    const titulo = `PNG HD · ${nombreDe(el) || "zona"}`;
    if (descargaEnMarcha(titulo)) return;

    encargaDescarga({
      titulo,
      vuelta: location.pathname + location.search,
      pantalla: true,
      tarea: async ({ avanza, sueltaPantalla }) => {
        avanza("Fotografiando la zona…", 0.2);
        try {
          return { blob: await fotografia(el), nombre };
        } finally {
          sueltaPantalla();
        }
      },
    });
  };

  const alTeclear = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      if (fijada) {
        fijada = false;
        repinta();
      } else cierra();
      return;
    }

    if (!actual()) return;

    if (e.key === "ArrowUp" && indice < cadena.length - 1) indice += 1;
    else if (e.key === "ArrowDown" && indice > 0) indice -= 1;
    else if (e.key === "Enter" && fijada) void baja("png");
    else return;

    e.preventDefault();
    e.stopPropagation();
    fijada = true;
    repinta();
  };

  masGrande.onclick = () => {
    if (indice < cadena.length - 1) indice += 1;
    repinta();
  };
  masPequena.onclick = () => {
    if (indice > 0) indice -= 1;
    repinta();
  };
  png.onclick = () => void baja("png");
  copiar.onclick = () => void baja("copiar");
  cancelar.onclick = () => {
    fijada = false;
    cadena = [];
    repinta();
  };
  salir.onclick = () => cierra();

  const opciones = { capture: true, passive: false } as const;
  const cortes = ["pointerdown", "pointerup", "mousedown", "mouseup", "dblclick", "contextmenu", "auxclick"] as const;

  window.addEventListener("pointermove", alMover, true);
  window.addEventListener("click", alPinchar, opciones);
  for (const tipo of cortes) window.addEventListener(tipo, corta, opciones);
  window.addEventListener("keydown", alTeclear, true);
  window.addEventListener("scroll", repinta, true);
  window.addEventListener("resize", repinta);

  const cursor = document.createElement("style");
  cursor.textContent = "html.eligiendo-zona, html.eligiendo-zona * { cursor: crosshair !important; }";
  document.head.appendChild(cursor);
  document.documentElement.classList.add("eligiendo-zona");

  function cierra() {
    window.removeEventListener("pointermove", alMover, true);
    window.removeEventListener("click", alPinchar, opciones);
    for (const tipo of cortes) window.removeEventListener(tipo, corta, opciones);
    window.removeEventListener("keydown", alTeclear, true);
    window.removeEventListener("scroll", repinta, true);
    window.removeEventListener("resize", repinta);
    if (pendiente) cancelAnimationFrame(pendiente);
    document.documentElement.classList.remove("eligiendo-zona");
    cursor.remove();
    capa.remove();
    activo = null;
  }

  activo = cierra;
}

/** Baja una zona ya elegida en PNG HD, en segundo plano (la usan los botones de cada gráfico). */
export function descargaZona(el: HTMLElement) {
  const titulo = `PNG HD · ${nombreDe(el) || "gráfico"}`;
  if (descargaEnMarcha(titulo)) return;

  const nombre = nombreFichero(el);

  encargaDescarga({
    titulo,
    vuelta: location.pathname + location.search,
    pantalla: true,
    tarea: async ({ avanza, sueltaPantalla }) => {
      avanza("Fotografiando el gráfico…", 0.2);
      try {
        return { blob: await fotografia(el), nombre };
      } finally {
        sueltaPantalla();
      }
    },
  });
}
