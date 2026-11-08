/**
 * MISMO TAMAÑO DE CARA EN LA PIZARRA DE ABP (08/11/2026).
 *
 * Todas las fotos «cerca» son de 400 × 500 y van en la misma caja, pero cada
 * recorte está encuadrado a su manera: medido sobre las 71 de la plantilla, la
 * cabeza ocupa del 47 % al 62 % del ancho de la foto. En la pizarra unos
 * jugadores salían con la cara un 20 % más grande que otros (Carvajal frente a
 * Ciria o Rober).
 *
 * Aquí se mide cada foto una vez —el ancho de lo opaco un poco por debajo de la
 * coronilla— y se devuelve la escala que la lleva a la cabeza de referencia.
 * Se aplica con `transform: scale()` desde abajo al centro, así la ficha sigue
 * apoyada en su chapa. Las fotos sin transparencia (un JPEG) no se tocan.
 */
import { useSyncExternalStore } from "react";

/** Ancho de cabeza de referencia, en fracción del ancho de la foto (la mediana medida). */
const OBJETIVO = 0.55;
/** A qué altura se mide, en fracción de lo opaco desde la coronilla: la frente. */
const ALTURA_MEDIDA = 0.12;
const MINIMA = 0.85;
const MAXIMA = 1.2;

const escalas = new Map<string, number>();
const pendientes = new Set<string>();
const oyentes = new Set<() => void>();

function avisa() {
  for (const oyente of oyentes) oyente();
}

function mide(src: string) {
  if (escalas.has(src) || pendientes.has(src) || typeof window === "undefined") return;

  pendientes.add(src);

  const imagen = new Image();

  imagen.crossOrigin = "anonymous";
  imagen.decoding = "async";

  imagen.onload = () => {
    pendientes.delete(src);

    try {
      const w = 100;
      const h = Math.max(1, Math.round((imagen.naturalHeight / imagen.naturalWidth) * w));
      const lienzo = document.createElement("canvas");

      lienzo.width = w;
      lienzo.height = h;

      const ctx = lienzo.getContext("2d", { willReadFrequently: true });

      if (!ctx) throw new Error("sin lienzo");

      ctx.drawImage(imagen, 0, 0, w, h);

      const datos = ctx.getImageData(0, 0, w, h).data;
      const opaco = (x: number, y: number) => datos[(y * w + x) * 4 + 3] > 40;

      /* Sin transparencia arriba: no es un recorte, se deja como está. */
      let coronilla = -1;

      for (let y = 0; y < h && coronilla < 0; y++) {
        for (let x = 0; x < w; x++) {
          if (opaco(x, y)) {
            coronilla = y;
            break;
          }
        }
      }

      const esquinasOpacas = opaco(0, 0) && opaco(w - 1, 0);

      if (coronilla < 0 || esquinasOpacas) {
        escalas.set(src, 1);
      } else {
        const y = Math.min(h - 1, Math.round(coronilla + (h - coronilla) * ALTURA_MEDIDA));
        let izquierda = -1;
        let derecha = -1;

        for (let x = 0; x < w; x++) {
          if (opaco(x, y)) {
            if (izquierda < 0) izquierda = x;
            derecha = x;
          }
        }

        const ancho = izquierda < 0 ? 0 : (derecha - izquierda + 1) / w;

        escalas.set(src, ancho > 0.2 ? Math.min(MAXIMA, Math.max(MINIMA, OBJETIVO / ancho)) : 1);
      }
    } catch {
      /* Sin permiso para leer la foto (otro dominio sin CORS): tal cual. */
      escalas.set(src, 1);
    }

    avisa();
  };

  imagen.onerror = () => {
    pendientes.delete(src);
    escalas.set(src, 1);
    avisa();
  };

  imagen.src = src;
}

/** La escala que iguala la cara de esta foto con las demás (1 mientras se mide). */
export function useEscalaCara(src: string | undefined) {
  return useSyncExternalStore(
    (oyente) => {
      oyentes.add(oyente);

      if (src) mide(src);

      return () => {
        oyentes.delete(oyente);
      };
    },
    () => (src ? (escalas.get(src) ?? 1) : 1),
    () => 1,
  );
}
