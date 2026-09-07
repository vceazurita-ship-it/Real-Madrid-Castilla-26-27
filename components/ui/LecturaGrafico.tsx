/*
|--------------------------------------------------------------------------
| LA LECTURA DE UN GRÁFICO
|--------------------------------------------------------------------------
|
| Una barra alta no dice si eso es mucho o poco, y una línea que sube no dice
| cuánto ni desde dónde. En el balón parado eso ya lo resuelve
| `components/abp/AnalisisSeccion`, pero aquel pie habla el idioma del córner
| —peligro, xG, remate, retención— y no vale para un gráfico de plantilla, de
| valoraciones o de carga de entrenamiento.
|
| Esto es lo mismo sin ese vocabulario: se le pasan **los mismos datos que
| pinta el gráfico** y escribe una o dos frases. No calcula nada que no esté ya
| en la pantalla; sólo lo dice con palabras, que es lo que hace falta cuando
| hay quince gráficos seguidos y hay que decidir en cuál pararse.
|
| Tres lecturas, según lo que sea el gráfico:
|
|   - **reparto** — recuentos que suman un total: quién manda y con cuánto.
|   - **ranking** — medias o notas: quién arriba, quién abajo y la distancia.
|     Repartir notas en tanto por ciento no significa nada.
|   - **serie** — algo a lo largo del tiempo: hacia dónde va.
*/

import type { ReactNode } from "react";

/* ------------------------------------------------------------------ */
/*  LO COMÚN                                                           */
/* ------------------------------------------------------------------ */

export type ParteDeReparto = { nombre: string; valor: number };

const SIN_VALOR = /^(sin dato|sin datos|desconocido|n\/a|-|–|)$/i;

const numero = (valor: number, decimales = 0) =>
  valor.toFixed(decimales).replace(".", ",");

const porcentaje = (parte: number, total: number) =>
  total ? `${numero((parte / total) * 100)} %` : "0 %";

const utilesDe = (partes: ParteDeReparto[]) =>
  partes.filter(
    (una) =>
      !SIN_VALOR.test(String(una.nombre ?? "").trim()) &&
      Number.isFinite(una.valor),
  );

/* ------------------------------------------------------------------ */
/*  QUIÉN MANDA                                                        */
/* ------------------------------------------------------------------ */

/**
 * «Manda «Central» con el 40 % de 20 jugadores. Después «Lateral», 25 %».
 *
 * Se salta las categorías sin nombre útil: un «Sin dato» que gana no es una
 * lectura, es un aviso de que falta anotar, y para eso ya está el gráfico.
 */
export function lecturaDeReparto(
  partes: ParteDeReparto[],
  unidad = "acciones",
): string | null {
  const utiles = utilesDe(partes).filter((una) => una.valor > 0);

  if (utiles.length === 0) return null;

  const total = utiles.reduce((suma, una) => suma + una.valor, 0);

  if (total <= 0) return null;

  const orden = [...utiles].sort((a, b) => b.valor - a.valor);

  const lider = orden[0];

  if (orden.length === 1) {
    return `Todo se concentra en «${lider.nombre}»: ${numero(lider.valor)} ${unidad}.`;
  }

  const segundo = orden[1];

  const frases = [
    `Manda «${lider.nombre}» con el ${porcentaje(lider.valor, total)} de ${numero(total)} ${unidad}.`,
    `Después «${segundo.nombre}», ${porcentaje(segundo.valor, total)}.`,
  ];

  /* Una cola larga es en sí una lectura: lo demás está muy repartido. */
  if (orden.length > 4) {
    const cola = orden.slice(2).reduce((suma, una) => suma + una.valor, 0);

    frases.push(
      `Las otras ${orden.length - 2} se reparten el ${porcentaje(cola, total)} restante.`,
    );
  }

  return frases.join(" ");
}

/* ------------------------------------------------------------------ */
/*  QUIÉN ARRIBA Y QUIÉN ABAJO                                         */
/* ------------------------------------------------------------------ */

/**
 * «Arriba «Fortea» con 7,4; abajo «Melvin» con 6,1, 1,3 de diferencia».
 *
 * Es la lectura de una barra de **medias**, no de recuentos: que un jugador
 * tenga el 12 % de la nota total del equipo no dice nada de cómo juega. Lo que
 * se mira en un ranking es el de arriba, el de abajo y cuánto van uno del otro.
 */
export function lecturaDeRanking(
  partes: ParteDeReparto[],
  {
    formatea = (valor: number) => numero(valor, 1),
    unidad = "",
  }: { formatea?: (valor: number) => string; unidad?: string } = {},
): string | null {
  const utiles = utilesDe(partes);

  if (utiles.length < 2) return null;

  const orden = [...utiles].sort((a, b) => b.valor - a.valor);

  const arriba = orden[0];
  const abajo = orden[orden.length - 1];

  const cola = unidad ? ` ${unidad}` : "";

  const salto = arriba.valor - abajo.valor;

  /* La unidad se dice una vez, en el primer número: repetirla en los tres
     daba «6,5 de nota, 0,8 de nota de diferencia», que se lee fatal. */
  return (
    `Arriba «${arriba.nombre}» con ${formatea(arriba.valor)}${cola}; ` +
    `abajo «${abajo.nombre}» con ${formatea(abajo.valor)}, ` +
    `${formatea(salto)} de diferencia.`
  );
}

/* ------------------------------------------------------------------ */
/*  HACIA DÓNDE VA                                                     */
/* ------------------------------------------------------------------ */

export type PuntoDeSerie = { etiqueta: string; valor: number | null };

/** Qué significa que el número suba. */
export type SentidoLectura = "mas-es-mejor" | "mas-es-peor" | "neutro";

/**
 * «Mejora: de 6,2 en los 3 primeros a 7,1 en los 3 últimos».
 *
 * Se parte la serie en dos mitades en vez de mirar el último punto contra el
 * primero: un partido suelto se lleva la lectura entera, y lo que se quiere
 * saber es si la cosa se ha movido de sitio. Por debajo de un 5 % de
 * diferencia se dice «estable», que es lo honesto con muestras cortas. Con
 * menos de cuatro puntos no se dice nada: eso no es una tendencia.
 */
export function lecturaDeSerie(
  serie: PuntoDeSerie[],
  {
    sentido = "neutro",
    formatea = (valor: number) => numero(valor, 1),
    unidad = "",
  }: {
    sentido?: SentidoLectura;
    formatea?: (valor: number) => string;
    unidad?: string;
  } = {},
): string | null {
  const conDatos = serie.filter(
    (uno): uno is { etiqueta: string; valor: number } =>
      uno.valor != null && Number.isFinite(uno.valor),
  );

  if (conDatos.length < 4) return null;

  const corte = Math.floor(conDatos.length / 2);

  const media = (trozo: { valor: number }[]) =>
    trozo.reduce((suma, uno) => suma + uno.valor, 0) / trozo.length;

  const previo = media(conDatos.slice(0, corte));
  const reciente = media(conDatos.slice(corte));

  const delta = reciente - previo;

  const referencia = Math.abs(previo) || 1;

  const mueve = Math.abs(delta) / referencia >= 0.05;

  const cola = unidad ? ` ${unidad}` : "";

  const cuanto =
    `de ${formatea(previo)}${cola} en ` +
    `${corte === 1 ? "el primero" : `los ${corte} primeros`} a ` +
    `${formatea(reciente)}${cola} en ` +
    `${conDatos.length - corte === 1 ? "el último" : `los ${conDatos.length - corte} últimos`}`;

  if (!mueve) return `Estable: ${cuanto}.`;

  const sube = delta > 0;

  const juicio =
    sentido === "neutro"
      ? sube
        ? "va a más"
        : "va a menos"
      : (sentido === "mas-es-mejor") === sube
        ? "mejora"
        : "empeora";

  return `${juicio[0].toUpperCase()}${juicio.slice(1)}: ${cuanto}.`;
}

/* ------------------------------------------------------------------ */
/*  EL PIE                                                             */
/* ------------------------------------------------------------------ */

/**
 * El pie de un gráfico, con la misma cara que el del balón parado.
 *
 * Se le pasan los datos que ya tiene el gráfico. Si de ahí no sale nada que
 * decir —una sola categoría, una serie de dos puntos— no pinta nada: un pie
 * vacío es peor que ninguno.
 */
export function LecturaGrafico({
  reparto,
  ranking,
  unidad = "acciones",
  serie,
  sentido,
  formatea,
  unidadSerie,
  nota,
}: {
  /** Recuentos que suman un total. */
  reparto?: ParteDeReparto[];
  /** Medias o notas: se lee el de arriba, el de abajo y la distancia. */
  ranking?: ParteDeReparto[];
  unidad?: string;
  /** Lo mismo a lo largo del tiempo, en orden. */
  serie?: PuntoDeSerie[];
  sentido?: SentidoLectura;
  formatea?: (valor: number) => string;
  unidadSerie?: string;
  /** Algo que sólo sabe la pantalla y conviene decir aquí. */
  nota?: ReactNode;
}) {
  const delReparto = reparto ? lecturaDeReparto(reparto, unidad) : null;

  const delRanking = ranking
    ? lecturaDeRanking(ranking, { formatea, unidad: unidadSerie })
    : null;

  const deLaSerie = serie
    ? lecturaDeSerie(serie, { sentido, formatea, unidad: unidadSerie })
    : null;

  if (!delReparto && !delRanking && !deLaSerie && !nota) return null;

  return (
    <div className="mt-4 border-t border-white/10 pt-3">
      <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-[#C8A96B]">
        Lectura
      </p>

      <p className="mt-1.5 text-[12px] leading-relaxed text-white/60">
        {[delReparto, delRanking, deLaSerie].filter(Boolean).join(" ")}
        {nota ? <span className="text-white/40"> {nota}</span> : null}
      </p>
    </div>
  );
}

export default LecturaGrafico;
