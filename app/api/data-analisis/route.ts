import { NextResponse } from "next/server";

import { expandeIndice, leeDatos, type Dataset } from "@/lib/data-analisis/leer";
import {
  METRICA_POR_KEY,
  temporadaDe,
  valorEnGrupo,
} from "@/lib/data-analisis/metricas";
import {
  ASPECTOS,
  ASPECTO_POR_KEY,
  MAXIMO_DESTACADOS,
  UMBRAL_EQUIPO,
  destacadosDeEquipo,
  destacadosDeJugadores,
  nubeDeAspecto,
} from "@/lib/data-analisis/destacados";

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

    const crudo = await respuesta.json();

    if (!Array.isArray(crudo?.partidos)) return null;

    /* El índice va compactado para pesar menos por la red. */
    return expandeIndice(crudo);
  } catch (error) {
    console.error("[data-analisis] índice", error);

    return null;
  }
}

/** Cómo se llama el Castilla en los informes de Wyscout. */
const NOSOTROS = "Real Madrid Castilla";

/**
 * Cuatro números para la portada.
 *
 * La portada no puede pedir el dataset entero: es un mega y medio de JSON para
 * enseñar dos cifras. Esto devuelve sólo lo que cabe en la tarjeta —el xG por
 * partido, el puesto en la categoría y lo que se marca por encima de lo que
 * valen las ocasiones— calculado con las **mismas funciones** que la pantalla
 * de Data Análisis, para que no puedan discrepar.
 */
function resumenDePortada(datos: Dataset) {
  const temporadas = [...new Set(datos.partidos.map((p) => temporadaDe(p.fecha)))]
    .filter(Boolean)
    .sort();

  const actual = temporadas[temporadas.length - 1] ?? "";

  const deLaLiga = datos.partidos.filter((p) => temporadaDe(p.fecha) === actual);

  const equipos = [...new Set(deLaLiga.map((p) => p.equipo))];

  const nuestros = deLaLiga.filter((p) => p.equipo === NOSOTROS);

  const metXg = METRICA_POR_KEY.get("xg");
  const metDif = METRICA_POR_KEY.get("golesMenosXg");

  const xg = metXg ? valorEnGrupo(metXg, nuestros) : null;

  const todos = metXg
    ? equipos
        .map((e) => valorEnGrupo(metXg, deLaLiga.filter((p) => p.equipo === e)))
        .filter((v): v is number => v !== null)
        .sort((a, b) => b - a)
    : [];

  return {
    temporada: actual,
    partidos: nuestros.length,
    equipos: equipos.length,
    informes: datos.fuentes.wyscout.length,
    /* xG por partido y dónde queda eso en la categoría. */
    xg,
    puesto: xg === null ? null : todos.indexOf(xg) + 1 || null,
    deCuantos: todos.length,
    tope: todos[0] ?? null,
    golesMenosXg: metDif ? valorEnGrupo(metDif, nuestros) : null,
  };
}

/**
 * Lo que destaca de un equipo, ya calculado.
 *
 * Lo pide el informe del rival, que se monta en el navegador: bajarse los dos
 * megas del dataset entero para sacar cuatro frases y cinco jugadores sería
 * absurdo, y encima se hace desde el móvil de la banda. Se calcula aquí con la
 * **misma librería** que usa la pantalla de Data Análisis, así que la
 * diapositiva y la pantalla no pueden discrepar.
 */
function destacadosDe(datos: Dataset, equipo: string, aspectos: string[]) {
  const temporadas = [...new Set(datos.partidos.map((p) => temporadaDe(p.fecha)))]
    .filter(Boolean)
    .sort();

  const actual = temporadas[temporadas.length - 1] ?? "";

  const liga = datos.partidos.filter((p) => temporadaDe(p.fecha) === actual);

  const equipos = [...new Set(liga.map((p) => p.equipo))];

  const elegidos = aspectos.length
    ? aspectos.flatMap((k) => {
        const uno = ASPECTO_POR_KEY.get(k);

        return uno ? [uno] : [];
      })
    : ASPECTOS;

  const deEquipo = destacadosDeEquipo(equipo, liga, equipos, elegidos);

  const deJugadores = destacadosDeJugadores(
    datos.jugadores,
    equipo,
    datos.jugadores,
  );

  return {
    temporada: actual,
    equipos: equipos.length,
    /* Sólo lo que cabe en una diapositiva, ya ordenado y sin el ruido. */
    equipo: deEquipo
      .filter((d) => Math.abs(d.desviacion) >= UMBRAL_EQUIPO)
      .slice(0, MAXIMO_DESTACADOS)
      .map((d) => {
        /*
        | Y la categoría entera en las dos métricas del aspecto.
        |
        | Va en la respuesta y no se calcula en el navegador por lo mismo que
        | todo lo demás: son veinte equipos por dos métricas sobre cuarenta
        | informes, y el informe se monta a veces desde el móvil.
        */
        const nube = nubeDeAspecto(d, liga, equipos);

        return {
          aspecto: d.aspecto.label,
          explica: d.aspecto.explica,
          percentil: Math.round(d.percentil),
          desviacion: Math.round(d.desviacion),
          filas: d.filas.map((f) => ({
            nombre: f.metrica.nombre,
            valor: f.valor,
            mediana: f.mediana,
            unidad: f.metrica.unidad,
            percentil: f.percentil,
          })),
          nube: nube
            ? {
                x: {
                  nombre: nube.x.nombre,
                  unidad: nube.x.unidad,
                  mejorAlto: nube.x.mejorAlto,
                },
                y: nube.y
                  ? {
                      nombre: nube.y.nombre,
                      unidad: nube.y.unidad,
                      mejorAlto: nube.y.mejorAlto,
                    }
                  : null,
                medianaX: nube.medianaX,
                medianaY: nube.medianaY,
                puntos: nube.puntos,
              }
            : null,
        };
      }),
    jugadores: deJugadores.slice(0, 6).map((j) => ({
      jugador: j.jugador.jugador,
      posicion: j.jugador.posicion,
      puesto: j.puesto,
      minutos: j.jugador.minutos,
      partidos: j.jugador.partidos,
      cuotaMinutos: Math.round(j.cuotaMinutos * 100),
      fuertes: j.fuertes.map((f) => ({
        nombre: f.metrica.nombre,
        valor: f.valor,
        unidad: f.metrica.unidad,
        percentil: f.percentil,
      })),
    })),
  };
}

export async function GET(peticion: Request) {
  const parametros = new URL(peticion.url).searchParams;

  const fresco = parametros.has("refrescar");

  const soloResumen = parametros.has("resumen");

  const equipoDestacado = parametros.get("destacados");

  const aspectosPedidos = (parametros.get("aspectos") ?? "")
    .split(",")
    .map((a) => a.trim())
    .filter(Boolean);

  const ahora = Date.now();

  if (!fresco && guardado && ahora - guardado.en < VIDA) {
    if (equipoDestacado) {
      return NextResponse.json({
        ok: true,
        destacados: destacadosDe(guardado.datos, equipoDestacado, aspectosPedidos),
      });
    }

    return soloResumen
      ? NextResponse.json({ ok: true, resumen: resumenDePortada(guardado.datos) })
      : NextResponse.json({ ok: true, ...guardado.datos, deCache: true });
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

    if (equipoDestacado) {
      return NextResponse.json({
        ok: true,
        origen,
        destacados: destacadosDe(datos, equipoDestacado, aspectosPedidos),
      });
    }

    return soloResumen
      ? NextResponse.json({ ok: true, resumen: resumenDePortada(datos), origen })
      : NextResponse.json({ ok: true, ...datos, deCache: false, origen });
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
