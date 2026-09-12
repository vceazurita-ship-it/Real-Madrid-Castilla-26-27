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
 */

export const dynamic = "force-dynamic";

export const maxDuration = 60;

const VIDA = 10 * 60 * 1000;

let guardado: { datos: Dataset; en: number } | null = null;

export async function GET(peticion: Request) {
  const fresco = new URL(peticion.url).searchParams.has("refrescar");

  const ahora = Date.now();

  if (!fresco && guardado && ahora - guardado.en < VIDA) {
    return NextResponse.json({ ok: true, ...guardado.datos, deCache: true });
  }

  try {
    const datos = await leeDatos();

    guardado = { datos, en: ahora };

    return NextResponse.json({ ok: true, ...datos, deCache: false });
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
