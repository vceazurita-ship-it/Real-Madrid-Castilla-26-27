"use client";

/**
 * MINIATURAS DE LOS CORTES (02/11/2026).
 *
 * Un `<video>` aparte, fuera de la pantalla, salta a cada instante pedido y
 * deja el fotograma en un lienzo de 192×108. Va **en cola**, de uno en uno: un
 * vídeo de noventa minutos no aguanta veinte saltos a la vez, y el reproductor
 * de verdad no se toca nunca (ni su tiempo ni su carga).
 *
 * Si el vídeo viene de otro dominio sin permiso, el lienzo queda «manchado» y
 * `toDataURL` falla: entonces no hay miniatura y la tarjeta enseña el color de
 * la categoría, que es lo que había antes. Se recuerda el fallo por fuente
 * para no volver a intentarlo con cada corte.
 */

import { useEffect, useState } from "react";

const ANCHO = 192;
const ALTO = 108;

const hechas = new Map<string, string | null>();
const fuentesRotas = new Set<string>();
const esperando = new Map<string, Promise<string | null>>();
let cola: Promise<unknown> = Promise.resolve();

let lector: HTMLVideoElement | null = null;

function clave(src: string, ms: number) {
  /* Al cuarto de segundo: dos cortes que empiezan casi a la vez comparten. */
  return `${src}|${Math.round(ms / 250)}`;
}

function sacaFotograma(src: string, ms: number): Promise<string | null> {
  return new Promise((resolver) => {
    if (typeof document === "undefined") return resolver(null);

    if (!lector) {
      lector = document.createElement("video");
      lector.muted = true;
      lector.preload = "auto";
      lector.playsInline = true;
      lector.crossOrigin = "anonymous";
    }

    const video = lector;
    let hecho = false;

    const acaba = (valor: string | null) => {
      if (hecho) return;
      hecho = true;
      clearTimeout(reloj);
      video.removeEventListener("seeked", alSaltar);
      video.removeEventListener("error", alFallar);
      resolver(valor);
    };

    const alSaltar = () => {
      try {
        const lienzo = document.createElement("canvas");
        lienzo.width = ANCHO;
        lienzo.height = ALTO;
        lienzo.getContext("2d")?.drawImage(video, 0, 0, ANCHO, ALTO);
        acaba(lienzo.toDataURL("image/jpeg", 0.7));
      } catch {
        fuentesRotas.add(src);
        acaba(null);
      }
    };

    const alFallar = () => {
      fuentesRotas.add(src);
      acaba(null);
    };

    /* Un salto que no llega en 8 s no va a llegar: se sigue con la cola. */
    const reloj = setTimeout(() => acaba(null), 8000);

    video.addEventListener("seeked", alSaltar);
    video.addEventListener("error", alFallar);

    const salta = () => {
      video.currentTime = Math.max(0, ms / 1000 + 0.05);
    };

    if (video.getAttribute("src") !== src) {
      video.src = src;
      video.addEventListener("loadedmetadata", salta, { once: true });
    } else {
      salta();
    }
  });
}

/** La miniatura de `src` en `ms`, en cola y recordada. */
export function pideMiniatura(src: string, ms: number): Promise<string | null> {
  if (!src || fuentesRotas.has(src)) return Promise.resolve(null);

  const k = clave(src, ms);

  if (hechas.has(k)) return Promise.resolve(hechas.get(k) ?? null);

  const ya = esperando.get(k);
  if (ya) return ya;

  const promesa = cola.then(() => sacaFotograma(src, ms)).then((valor) => {
    hechas.set(k, valor);
    esperando.delete(k);
    return valor;
  });

  cola = promesa.catch(() => null);
  esperando.set(k, promesa);

  return promesa;
}

/** La miniatura ya hecha, sin pedirla: para pintar al instante. */
export function miniaturaHecha(src: string, ms: number) {
  return src ? (hechas.get(clave(src, ms)) ?? null) : null;
}

/** Hook: la miniatura de un instante, que llega cuando la cola le toca. */
export function useMiniatura(src: string | null | undefined, ms: number) {
  const [, setVersion] = useState(0);

  useEffect(() => {
    if (!src || miniaturaHecha(src, ms)) return;

    let vivo = true;

    void pideMiniatura(src, ms).then(() => {
      if (vivo) setVersion((v) => v + 1);
    });

    return () => {
      vivo = false;
    };
  }, [src, ms]);

  return src ? miniaturaHecha(src, ms) : null;
}
