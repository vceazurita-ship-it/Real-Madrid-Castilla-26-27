"use client";

/**
 * LAS MINIATURAS DEL INFORME, CON LO QUE HAY DENTRO.
 *
 * La columna de la izquierda enseñaba **sólo el papel** de cada hoja, así que
 * diez de las once parecían vacías estando llenas. Se hizo así por velocidad:
 * pintar las once hojas enteras como imágenes sueltas son varios cientos de
 * `<img>` en pantalla y el editor se arrastraba.
 *
 * La solución no es pintar menos, es **pintar una sola imagen por hoja**: se
 * componen el papel y todas las piezas en un lienzo pequeño —288 px de ancho,
 * que es lo que mide la miniatura— y lo que va al DOM es un `data:` por hoja.
 * Doscientas imágenes se convierten en once.
 *
 * Tres cosas que hacen que no moleste mientras se edita:
 *
 * - **Se compone fuera del hilo del dibujo**, hoja a hoja y cediendo el turno
 *   entre una y otra: al abrir el editor aparecen en cascada en vez de
 *   congelar la pantalla medio segundo.
 * - **Sólo se rehace la hoja que cambia**, y se sabe por una firma barata de
 *   sus piezas —posición, tamaño, opacidad—.
 * - **Con retardo**: mientras se arrastra una pieza no se rehace nada; se
 *   espera a que la mano pare.
 */

import { useEffect, useRef, useState } from "react";

import type { HojaInforme } from "@/lib/rivals/informe-elementos";

/** El ancho de la miniatura en la columna, en píxeles de pantalla. */
const ANCHO = 288;

/** Lo que mide la hoja de verdad. */
const HOJA = { ancho: 1920, alto: 1080 };

/** Mientras la mano se mueve no se rehace: se espera a que pare. */
const RETARDO = 400;

/**
 * Una firma barata de lo que se ve en la hoja.
 *
 * Con esto se sabe si hay que volver a componer: cambia al mover, redimensionar,
 * añadir, quitar o cambiar la opacidad de una pieza. No mira el contenido de
 * las imágenes —serían megas de comparación— sino su longitud, que basta para
 * distinguir una imagen sustituida.
 */
function firmaDe(hoja: HojaInforme) {
  return [
    hoja.fondo.length,
    ...hoja.elementos.map(
      (uno) =>
        `${uno.id}:${Math.round(uno.x)},${Math.round(uno.y)},${Math.round(uno.w)},${Math.round(
          uno.h,
        )},${uno.opacidad ?? 1},${uno.imagen.length}`,
    ),
  ].join("|");
}

/** Una imagen ya cargada, o `null` si no se puede. */
function carga(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resuelve) => {
    const imagen = new Image();

    imagen.onload = () => resuelve(imagen);
    imagen.onerror = () => resuelve(null);

    imagen.src = src;
  });
}

/** Compone una hoja entera en una imagen pequeña. */
async function componeMiniatura(hoja: HojaInforme): Promise<string | null> {
  const escala = ANCHO / HOJA.ancho;

  const lienzo = document.createElement("canvas");

  lienzo.width = ANCHO;
  lienzo.height = Math.round(HOJA.alto * escala);

  const ctx = lienzo.getContext("2d");

  if (!ctx) return null;

  const fondo = await carga(hoja.fondo);

  if (fondo) ctx.drawImage(fondo, 0, 0, lienzo.width, lienzo.height);

  /*
  | Las piezas van en su orden, que es el de la pila: la última tapa a la
  | anterior, igual que en el lienzo grande y en el .pptx.
  */
  for (const pieza of hoja.elementos) {
    const imagen = await carga(pieza.imagen);

    if (!imagen) continue;

    ctx.globalAlpha = pieza.opacidad ?? 1;

    ctx.drawImage(
      imagen,
      pieza.x * escala,
      pieza.y * escala,
      pieza.w * escala,
      pieza.h * escala,
    );

    ctx.globalAlpha = 1;
  }

  /* JPEG y no PNG: es una miniatura, y pesa la cuarta parte. */
  return lienzo.toDataURL("image/jpeg", 0.72);
}

/**
 * Las miniaturas de todas las hojas, por `id`.
 *
 * Mientras una no está compuesta, no está en el mapa y quien pinte enseña el
 * papel de siempre: así la columna nunca aparece en blanco.
 */
export function useMiniaturasInforme(hojas: HojaInforme[]) {
  const [miniaturas, setMiniaturas] = useState<Record<string, string>>({});

  /* La firma con la que se compuso cada una, para no repetir trabajo. */
  const firmas = useRef<Record<string, string>>({});

  useEffect(() => {
    let cancelado = false;

    const reloj = window.setTimeout(async () => {
      for (const hoja of hojas) {
        if (cancelado) return;

        const firma = firmaDe(hoja);

        if (firmas.current[hoja.id] === firma) continue;

        const miniatura = await componeMiniatura(hoja);

        if (cancelado) return;

        if (miniatura) {
          firmas.current[hoja.id] = firma;

          setMiniaturas((previas) => ({ ...previas, [hoja.id]: miniatura }));
        }

        /* Se cede el turno entre hojas: que la pantalla siga respondiendo. */
        await new Promise((sigue) => setTimeout(sigue, 0));
      }
    }, RETARDO);

    return () => {
      cancelado = true;

      window.clearTimeout(reloj);
    };
  }, [hojas]);

  return miniaturas;
}
