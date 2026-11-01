/**
 * LO YA EXPORTADO NO SE REHACE (01/11/2026).
 *
 * Lo pidió el analista: «mayor facilidad y velocidad en la exportación de
 * todos los elementos de la sección». Antes, cada botón volvía a fotografiar
 * todas las diapositivas y a grabar todos los vídeos aunque nada hubiera
 * cambiado: «Solo documentos» y luego «Exportar todo» hacían dos veces el PDF.
 *
 * Aquí se guarda, en la memoria de la pestaña, lo que ya ha salido:
 *
 * - **La foto de cada diapositiva** (la del PDF general y el PowerPoint), por
 *   la huella de ESA diapositiva: si se toca una, sólo esa se vuelve a hacer.
 * - **El vídeo de cada jugada**, por la huella de la diapositiva y el destino.
 * - **Las fuentes incrustadas**, una vez por juego de fuentes y no una por
 *   fotograma ni por vídeo.
 *
 * La huella sale del contenido (la diapositiva, su título, el rival, la
 * temporada y la ficha de cada jugador que sale), no de la hora de guardado:
 * el autoguardado renueva la hora sin cambiar nada de lo que se ve.
 *
 * Vive en un módulo y no en un componente: sobrevive a cambiar de pantalla,
 * igual que los encargos de `trabajo-exportar.ts`. Al recargar se pierde, y
 * eso está bien: no ocupa disco.
 */

import type { SlidePizarra } from "@/lib/abp/pizarra";
import type { Player } from "@/types/player";

/**
 * Sube cuando cambia cómo se dibuja o se monta algo: lo guardado con la
 * versión anterior deja de valer sin tener que recargar.
 */
const VERSION = "2026-11-01";

/* ------------------------------------------------------------------ */
/*  HUELLAS                                                            */
/* ------------------------------------------------------------------ */

/** Dos FNV-1a de 32 bits con semillas distintas: 64 bits, de sobra para esto. */
export function resumen(texto: string) {
  let a = 0x811c9dc5;
  let b = 0x01000193 ^ 0x5bd1e995;

  for (let i = 0; i < texto.length; i += 1) {
    const c = texto.charCodeAt(i);

    a = Math.imul(a ^ c, 0x01000193);
    b = Math.imul(b ^ c, 0x5bd1e995) ^ (b >>> 15);
  }

  return (a >>> 0).toString(16).padStart(8, "0") + (b >>> 0).toString(16).padStart(8, "0");
}

export type ContextoHuella = {
  players: Map<string, Player>;
  temporada: string;
  rival: string;
};

/** Lo que hace que una diapositiva salga distinta en la foto. */
export function huellaSlide(slide: SlidePizarra, titulo: string, { players, temporada, rival }: ContextoHuella) {
  const jugadores = [...new Set(slide.fichas.map((ficha) => ficha.playerId))]
    .sort()
    .map((id) => [id, players.get(id) ?? null]);

  return resumen(JSON.stringify([VERSION, slide, titulo, rival, temporada, jugadores]));
}

/* ------------------------------------------------------------------ */
/*  ALMACÉN                                                            */
/* ------------------------------------------------------------------ */

/** Un Map con tope: al pasarse, se va lo que lleva más tiempo sin usarse. */
class Memoria<V> {
  private datos = new Map<string, V>();

  constructor(private readonly tope: number) {}

  lee(clave: string) {
    const valor = this.datos.get(clave);

    if (valor !== undefined) {
      this.datos.delete(clave);
      this.datos.set(clave, valor);
    }

    return valor;
  }

  guarda(clave: string, valor: V) {
    this.datos.delete(clave);
    this.datos.set(clave, valor);

    while (this.datos.size > this.tope) {
      const vieja = this.datos.keys().next().value;

      if (vieja === undefined) break;
      this.datos.delete(vieja);
    }
  }

  tiene = (clave: string) => this.datos.has(clave);
}

/** La foto JPEG (data URL) de una diapositiva entera; con `hasta`, la de una fase. */
const fotos = new Memoria<string>(60);

export const claveFoto = (huella: string, hasta?: number) => `${huella}|${hasta ?? "todo"}`;

export const fotoGuardada = (clave: string) => fotos.lee(clave);
export const guardaFoto = (clave: string, dataUrl: string) => fotos.guarda(clave, dataUrl);

export type VideoHecho = { fichero: Blob; poster: Blob | null; segundos: number };

/** Los vídeos ya montados: unos pocos MB cada uno. */
const videos = new Memoria<VideoHecho>(24);

export const claveVideo = (huella: string, destino: string) => `${huella}|${destino}`;

export const videoGuardado = (clave: string) => videos.lee(clave);
export const guardaVideo = (clave: string, hecho: VideoHecho) => videos.guarda(clave, hecho);
export const hayVideo = (clave: string) => videos.tiene(clave);
export const hayFoto = (clave: string) => fotos.tiene(clave);

/* ------------------------------------------------------------------ */
/*  FUENTES                                                            */
/* ------------------------------------------------------------------ */

/*
| `html-to-image` incrusta sólo las fuentes que usa el nodo, y leerlas de las
| hojas de estilo es lo más lento de cada foto. Las diapositivas usan todas las
| mismas, así que se guarda el resultado por el juego de familias que lleva el
| nodo: la segunda diapositiva y el segundo vídeo ya no las vuelven a leer.
*/
const fuentes = new Map<string, Promise<string | undefined>>();

function familiasDe(nodo: HTMLElement) {
  const familias = new Set<string>();

  for (const el of [nodo, ...nodo.querySelectorAll<HTMLElement>("*")]) {
    familias.add(getComputedStyle(el).fontFamily);
  }

  return [...familias].sort().join("§");
}

export function fuentesDe(nodo: HTMLElement, calcula: () => Promise<string | undefined>) {
  const clave = familiasDe(nodo);
  const hecha = fuentes.get(clave);

  if (hecha) return hecha;

  const nueva = calcula().then((css) => {
    /* Si sale vacía (una hoja de otro dominio que no deja leerse), no se guarda: se intentará otra vez. */
    if (!css) fuentes.delete(clave);

    return css;
  });

  fuentes.set(clave, nueva);

  return nueva;
}

/* ------------------------------------------------------------------ */
/*  ESTIMACIONES                                                       */
/* ------------------------------------------------------------------ */

/*
| Medido en el portátil del club sin ventana (31/10/2026): ~1 s por
| diapositiva del PDF general, ~0,5 s por fotograma de vídeo y unas 17 fotos
| por fase. Es para orientar en el menú, no una promesa.
*/
export const SEGUNDOS_POR_FOTO = 1;
export const SEGUNDOS_POR_PDF_JUGADOR = 4;

export function segundosDeVideo(fases: number) {
  return 2 + fases * 9;
}

/** «45 s», «3 min»: lo que se lee de un vistazo. */
export function duracionLegible(segundos: number) {
  if (segundos < 60) return `${Math.max(5, Math.round(segundos / 5) * 5)} s`;

  return `${Math.round(segundos / 60)} min`;
}

export function pesoLegible(mb: number) {
  if (mb < 1) return "menos de 1 MB";

  return `${Math.round(mb)} MB`;
}
