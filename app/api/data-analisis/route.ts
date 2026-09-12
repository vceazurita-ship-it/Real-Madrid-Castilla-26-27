import { NextResponse } from "next/server";

import { leeDatos, type Dataset } from "@/lib/data-analisis/leer";

/**
 * La carpeta `public/data`, servida ya en limpio.
 *
 * El trabajo pesado —abrir treinta hojas de cálculo, descomprimirlas y armar
 * los nombres de columna— se hace **aquí y no en el navegador**: son unos
 * megas de ficheros y la pantalla tiene que abrirse al momento en la sala de
 * vídeo. Lo que sale es JSON plano.
 *
 * **Se relee cada pocos minutos a propósito.** El cuerpo técnico deja ficheros
 * nuevos en la carpeta cada semana y espera verlos al recargar; una caché de
 * una hora convertiría eso en «no funciona». Diez minutos es bastante para que
 * abrir la pantalla veinte veces seguidas no vuelva a abrir treinta ficheros, y
 * poco para que nadie se quede mirando datos viejos.
 *
 * **Y hay un segundo camino, que es el que salva el despliegue.** Next sube
 * `public/` al CDN pero **no se la deja a la función en el disco**: allí el
 * `readdir` no encuentra nada y la pantalla salía vacía. Por eso, cuando la
 * carpeta no da partidos, se pide `public/data/analisis.json` —el índice que
 * deja `scripts/data-analisis-indice.cjs` antes de compilar— al propio origen,
 * que sí lo sirve. En local manda siempre la carpeta de verdad: es lo que
 * permite soltar un informe el jueves y verlo sin recompilar.
 */

export const dynamic = "force-dynamic";

export const maxDuration = 60;

const VIDA = 10 * 60 * 1000;

let guardado: { datos: Dataset; en: number } | null = null;

/**
 * El índice estático, pedido al propio origen.
 *
 * Es un fichero de `public/`, así que en el despliegue lo sirve el CDN y la
 * función sólo tiene que hacerle una petición. Se construye la dirección a
 * partir de la de la petición para que valga en local, en la máquina de la sala
 * y en Vercel sin configurar nada.
 */
async function leeElIndice(desde: string): Promise<Dataset | null> {
  try {
    const url = new URL("/data/analisis.json", desde);

    const respuesta = await fetch(url, { cache: "no-store" });

    if (!respuesta.ok) return null;

    const datos = (await respuesta.json()) as Dataset;

    return Array.isArray(datos?.partidos) ? datos : null;
  } catch (error) {
    console.error("[data-analisis] índice", error);

    return null;
  }
}

export async function GET(peticion: Request) {
  const fresco = new URL(peticion.url).searchParams.has("refrescar");

  const ahora = Date.now();

  if (!fresco && guardado && ahora - guardado.en < VIDA) {
    return NextResponse.json({ ok: true, ...guardado.datos, deCache: true });
  }

  try {
    let datos = await leeDatos();

    let origen: "carpeta" | "indice" = "carpeta";

    /*
    | Sin partidos casi nunca significa «la carpeta está vacía»: significa que
    | esta función no puede verla, que es lo que pasa desplegado. Se prueba el
    | índice antes de rendirse.
    */
    if (datos.partidos.length === 0) {
      const delIndice = await leeElIndice(peticion.url);

      if (delIndice && delIndice.partidos.length > 0) {
        datos = delIndice;
        origen = "indice";
      }
    }

    guardado = { datos, en: ahora };

    return NextResponse.json({ ok: true, ...datos, deCache: false, origen });
  } catch (error) {
    console.error("[data-analisis]", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "No se ha podido leer la carpeta de datos.",
      },
      { status: 500 },
    );
  }
}
