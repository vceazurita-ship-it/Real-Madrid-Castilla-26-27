import { NextResponse } from "next/server";

import { expandeIndice, leeDatos, type Dataset } from "@/lib/data-analisis/leer";
import {
  METRICA_POR_KEY,
  temporadaDe,
  valorEnGrupo,
} from "@/lib/data-analisis/metricas";
import { alertasDeData, seleccionaAlertas } from "@/lib/data-analisis/alertas";
import { equiposConMuestra, golesAbpDeEquipo } from "@/lib/data-analisis/goles-abp";
import { proponeTipologia } from "@/lib/rivals/tipologia-wyscout";
import { readDoc } from "@/lib/docStore";
import { alertasDeFichajes, type CotejoRival } from "@/lib/portada/alertas-fichajes";
import { INFORME_KEY, type InformeDoc } from "@/lib/rivals/informe";
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

/* ------------------------------------------------------------------ */
/*  LOS ESCUDOS                                                        */
/* ------------------------------------------------------------------ */

/**
 * El escudo de cada equipo, para los gráficos.
 *
 * En una nube de veinte puntos grises no se reconoce a nadie: el escudo es lo
 * que convierte un punto en un equipo sin tener que pasar el ratón por encima.
 *
 * Los escudos viven en el documento `rivals:informe` de Supabase —los baja
 * `scripts/rivals-informe.mjs` de BeSoccer—, que **pesa lo suyo**: diecinueve
 * clasificaciones y cientos de partidos. Por eso no se pide entero desde el
 * navegador: aquí se abre en el servidor y sólo salen los pares nombre-escudo,
 * que son cuatro kilobytes.
 */
let escudosGuardados: { lista: { equipo: string; escudo: string }[]; en: number } | null =
  null;

async function leeEscudos() {
  const ahora = Date.now();

  if (escudosGuardados && ahora - escudosGuardados.en < VIDA) {
    return escudosGuardados.lista;
  }

  const doc = (await readDoc(INFORME_KEY)).data as InformeDoc | null;

  const porNombre = new Map<string, string>();

  for (const informe of Object.values(doc?.porId ?? {})) {
    /* El del propio equipo y los de su clasificación: entre todos salen los
       veinte del grupo aunque falte el informe de alguno. */
    if (informe.nombre && informe.escudo) {
      porNombre.set(informe.nombre, informe.escudo);
    }

    for (const fila of informe.clasificacion?.total ?? []) {
      if (fila.equipo && fila.escudo && !porNombre.has(fila.equipo)) {
        porNombre.set(fila.equipo, fila.escudo);
      }
    }
  }

  const lista = [...porNombre].map(([equipo, escudo]) => ({ equipo, escudo }));

  escudosGuardados = { lista, en: ahora };

  return lista;
}

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
      /* Y por dónde se le puede atacar, que es la otra mitad del scouting. */
      flojos: j.flojos.map((f) => ({
        nombre: f.metrica.nombre,
        valor: f.valor,
        unidad: f.metrica.unidad,
        percentil: f.percentil,
      })),
    })),
  };
}

/**
 * Las alertas de la portada.
 *
 * Se calculan aquí por lo mismo que el resumen: la portada no puede bajarse el
 * dataset entero para decir tres frases, y encima es la pantalla que más se
 * abre. Al servidor le sale de lo que ya tiene en memoria.
 */
/**
 * El reparto de goles propuesto para un equipo.
 *
 * Lo pide el pop-up de antes del informe y el propio informe, y los dos se
 * montan en el navegador: el dataset entero son dos megas para sacar diez
 * casillas. Se calcula aquí con la temporada en curso, que es la que describe
 * a un rival al que se le juega esta semana.
 */
function tipologiaDe(datos: Dataset, equipo: string, goles: string) {
  const temporadas = [...new Set(datos.partidos.map((p) => temporadaDe(p.fecha)))]
    .filter(Boolean)
    .sort();

  const actual = temporadas[temporadas.length - 1] ?? "";

  const liga = datos.partidos.filter((p) => temporadaDe(p.fecha) === actual);

  /*
  | «goles=7,4» son los goles de jugada que cuenta BeSoccer a favor y en
  | contra: lo que la diapositiva enseña arriba. Se reparten ésos para que la
  | tabla sume lo que dice la cabecera; sin el parámetro se reparten los de los
  | informes de Wyscout, que son menos partidos.
  */
  const [aFavor, enContra] = goles.split(",").map((n) => Number(n));

  const objetivo =
    Number.isFinite(aFavor) && Number.isFinite(enContra)
      ? { aFavor: Math.max(0, aFavor), enContra: Math.max(0, enContra) }
      : undefined;

  return { temporada: actual, ...proponeTipologia(equipo, liga, objetivo) };
}

/**
 * Los fichajes rivales sin escribir, guardados como los escudos.
 *
 * Viaja con las alertas de Data y no por su propia petición **a propósito**:
 * ésta es la pantalla que más se abre de la app y una llamada más se nota.
 * El documento es de cuatro líneas, así que no encarece la respuesta.
 */
let cotejoGuardado: { doc: CotejoRival | null; en: number } | null = null;

async function leeCotejo(): Promise<CotejoRival | null> {
  const ahora = Date.now();

  if (cotejoGuardado && ahora - cotejoGuardado.en < VIDA) return cotejoGuardado.doc;

  try {
    const doc = (await readDoc("rivals:cotejo")).data as CotejoRival | null;

    cotejoGuardado = { doc, en: ahora };

    return doc;
  } catch (error) {
    console.error("[data-analisis] cotejo", error);

    /* Sin cotejo la portada pinta el resto de alertas: no es un error. */
    return null;
  }
}

function alertasDe(datos: Dataset) {
  return seleccionaAlertas(alertasDeData(datos.partidos, datos.jugadores));
}

/**
 * Las de Data más las de fichajes, que no se ordenan aquí.
 *
 * `seleccionaAlertas` recorta las de Data de ~35 a 12 con su cupo por familia;
 * las de fichajes no entran en ese reparto —son dos como mucho y hablan de otra
 * cosa— y la portada las ordena todas por fuerza al juntarlas.
 */
async function alertasConFichajes(datos: Dataset) {
  const fichajes = alertasDeFichajes(await leeCotejo(), Date.now());

  return [...alertasDe(datos), ...fichajes];
}

/* ------------------------------------------------------------------ */
/*  EL BALÓN PARADO, PARA EL INFORME DEL MICROCICLO                    */
/* ------------------------------------------------------------------ */

/*
|--------------------------------------------------------------------------
| AQUÍ NO SE ESTIMAN GOLES. NUNCA.
|--------------------------------------------------------------------------
|
| La primera versión de esto (16/09/2026) comparaba «goles de balón parado»
| por equipo. **Nadie publica ese dato**: Wyscout da remates por vía y
| «Penaltis · marcados», y de goles sólo el total. Lo que se pintaba era un
| reparto de los goles totales proporcional a los remates de cada vía, y con
| tres jornadas eso inventa: al Zaragoza le asignaba 0,81 goles de córner y al
| Villarreal B 0,00 clavado; a nosotros, 0,00 a favor habiendo metido dos. Un
| eje que dice «goles» con un número que nadie ha registrado no es un gráfico,
| es una estimación disfrazada de dato.
|
| Así que el informe compara **lo que las fuentes miden de verdad**: córners,
| faltas lanzadas, jugadas de balón parado, cuántas acaban en remate, qué parte
| de todos los remates nace de estrategia, saques laterales y penaltis. La
| estimación de goles sigue viva en `/data-analisis?area=golesAbp`, que es una
| pantalla de temporada entera y lo rotula con «≈» ([[goles-abp-liga]]).
|
| Los goles de balón parado **del Castilla** sí son dato, pero de otra fuente:
| nuestras cuatro hojas de ABP, donde el analista marca el resultado de cada
| acción. Eso entra en el informe por su lado (`lib/data-analisis/abp-propio.ts`),
| y por eso aquí no hace falta inventarlos.
*/

/** Las métricas de ABP que Wyscout mide de verdad, en el orden del informe. */
const ABP_MEDIDAS = [
  { key: "corners", rotulo: "Córners", sentido: "alto" },
  { key: "cornersRemate", rotulo: "Córners con remate %", sentido: "alto" },
  { key: "faltasTiro", rotulo: "Faltas lanzadas", sentido: "neutro" },
  { key: "faltasRemate", rotulo: "Faltas con remate %", sentido: "alto" },
  { key: "abp", rotulo: "Jugadas de ABP", sentido: "neutro" },
  { key: "abpRemate", rotulo: "ABP con remate %", sentido: "alto" },
  { key: "cuotaRematesAbp", rotulo: "Remates que nacen de ABP %", sentido: "neutro" },
  { key: "penaltis", rotulo: "Penaltis a favor", sentido: "alto" },
] as const;

/**
 * Con quién nos comparamos en balón parado: la liga de este año y nosotros
 * mismos en las temporadas anteriores, **a estas alturas**.
 *
 * Lo pide el informe de ABP del microciclo, que se arma en el navegador: el
 * dataset entero son más de dos megas y esto son cuatro kilobytes. Se calcula
 * con las mismas métricas que la pantalla de Data Análisis para que no puedan
 * discrepar.
 *
 * **«A estas alturas» no es un adorno**: comparar los 3 partidos de este año
 * con los 38 del pasado no compara nada. Cada temporada se recorta a los mismos
 * partidos que lleva la actual, en orden de calendario, y lo «en contra» se
 * saca de las filas de los rivales **de esos mismos partidos**.
 */
function abpParaInforme(datos: Dataset) {
  const temporadas = [...new Set(datos.partidos.map((p) => temporadaDe(p.fecha)))]
    .filter(Boolean)
    .sort();

  const actual = temporadas[temporadas.length - 1] ?? "";

  const deLaLiga = datos.partidos.filter((p) => temporadaDe(p.fecha) === actual);

  /** Los partidos del Castilla de una temporada, en orden y recortados. */
  const nuestrosDe = (temporada: string, cuantos: number | null) => {
    const suyos = datos.partidos
      .filter((p) => temporadaDe(p.fecha) === temporada && p.equipo === NOSOTROS)
      .sort((a, b) => a.fecha.localeCompare(b.fecha));

    return cuantos === null ? suyos : suyos.slice(0, cuantos);
  };

  /** Las filas del rival de esos mismos partidos: es el «en contra». */
  const rivalesDe = (nuestros: typeof datos.partidos) => {
    const cuales = new Set(nuestros.map((p) => `${p.fecha}|${p.partido}`));

    return datos.partidos.filter(
      (p) => p.rival === NOSOTROS && cuales.has(`${p.fecha}|${p.partido}`),
    );
  };

  const jugados = nuestrosDe(actual, null).length;

  /**
   * Una fila: las ocho métricas medidas, a favor y en contra.
   *
   * «En contra» sale de las filas del rival de esos mismos partidos, que es lo
   * que permite contestar «¿cuántos córners concedemos?» sin pedir nada más:
   * cada partido está dos veces en el informe, una por equipo.
   */
  const filaDe = (
    equipo: string,
    aFavorFilas: typeof datos.partidos,
    enContraFilas: typeof datos.partidos,
  ) => {
    const valores: Record<string, { favor: number | null; contra: number | null }> =
      {};

    for (const medida of ABP_MEDIDAS) {
      const metrica = METRICA_POR_KEY.get(medida.key);

      valores[medida.key] = {
        favor:
          metrica && aFavorFilas.length
            ? valorEnGrupo(metrica, aFavorFilas)
            : null,
        contra:
          metrica && enContraFilas.length
            ? valorEnGrupo(metrica, enContraFilas)
            : null,
      };
    }

    return { equipo, partidos: aFavorFilas.length, valores };
  };

  /* ---- La liga de este año ---- */

  /* `equiposConMuestra` devuelve también cuántos se quedan fuera y con qué
     suelo: aquí sólo hace falta la lista. */
  const liga = equiposConMuestra(deLaLiga)
    .equipos.map((equipo) =>
      filaDe(
        equipo,
        deLaLiga.filter((p) => p.equipo === equipo),
        deLaLiga.filter((p) => p.rival === equipo),
      ),
    )
    /* Por volumen de córners: es la métrica que todo el mundo mira primero y
       la que ordena la tabla en pantalla. Los puestos de cada métrica los
       calcula quien pinta, que para eso le va la liga entera. */
    .sort(
      (a, b) => (b.valores.corners?.favor ?? 0) - (a.valores.corners?.favor ?? 0),
    );

  /* ---- Nosotros, temporada a temporada, a estas alturas ---- */

  const historico = temporadas
    .map((temporada) => {
      const nuestros = nuestrosDe(temporada, jugados || null);

      if (nuestros.length === 0) return null;

      return {
        ...filaDe(temporada, nuestros, rivalesDe(nuestros)),
        temporada,
        esActual: temporada === actual,
      };
    })
    .filter((una): una is NonNullable<typeof una> => una !== null);

  const nosotros = liga.find((fila) => fila.equipo === NOSOTROS) ?? null;

  return {
    temporada: actual,
    jugados,
    equipos: liga.length,
    /* El catálogo viaja con los datos: quien pinta necesita el rótulo y el
       sentido de cada métrica, y no puede tener su propia copia o el día que
       se añada una, el informe la enseñaría sin nombre. */
    medidas: ABP_MEDIDAS,
    liga,
    nosotros,
    historico,
    /*
    | Los goles de balón parado de cada equipo, estimados.
    |
    | No es una métrica de Wyscout: es el reparto de los goles por su origen
    | con los factores calibrados contra Opta (`lib/data-analisis/goles-abp.ts`,
    | córner ×0,49 y falta ×1,35). Va aquí porque calcularlo en el navegador
    | obligaría a bajarse el dataset entero —dos megas— y esto son unas líneas
    | más en un paquete de cuatro kilobytes. Lo usa el boceto del microciclo
    | para decir de qué vive el rival al que se juega.
    */
    golesAbp: liga.map((fila) => golesAbpDeEquipo(fila.equipo, deLaLiga)),
  };
}

export async function GET(peticion: Request) {
  const parametros = new URL(peticion.url).searchParams;

  /*
  | Los escudos son otra pregunta y salen de otro sitio —Supabase, no la
  | carpeta—, así que se contestan antes de tocar nada de los informes.
  */
  if (parametros.has("escudos")) {
    try {
      return NextResponse.json({ ok: true, escudos: await leeEscudos() });
    } catch (error) {
      console.error("[data-analisis] escudos", error);

      /* Sin escudos los gráficos pintan discos: no es motivo para un error. */
      return NextResponse.json({ ok: true, escudos: [] });
    }
  }

  const fresco = parametros.has("refrescar");

  const soloResumen = parametros.has("resumen");

  const soloAlertas = parametros.has("alertas");

  const equipoTipologia = parametros.get("tipologia");

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

    if (soloAlertas) {
      return NextResponse.json({ ok: true, alertas: await alertasConFichajes(guardado.datos) });
    }

    /* El informe de ABP del microciclo: la liga y nuestras otras temporadas. */
    if (parametros.has("abpInforme")) {
      return NextResponse.json({ ok: true, abp: abpParaInforme(guardado.datos) });
    }

    if (equipoTipologia) {
      return NextResponse.json({
        ok: true,
        ...tipologiaDe(guardado.datos, equipoTipologia, parametros.get("goles") ?? ""),
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

    if (soloAlertas) {
      return NextResponse.json({ ok: true, origen, alertas: await alertasConFichajes(datos) });
    }

    if (parametros.has("abpInforme")) {
      return NextResponse.json({ ok: true, origen, abp: abpParaInforme(datos) });
    }

    if (equipoTipologia) {
      return NextResponse.json({
        ok: true,
        origen,
        ...tipologiaDe(datos, equipoTipologia, parametros.get("goles") ?? ""),
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
