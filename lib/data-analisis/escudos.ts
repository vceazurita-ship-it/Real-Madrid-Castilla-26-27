import { mismoEquipo } from "./nombres";

/**
 * EL ESCUDO DE CADA EQUIPO, EN LOS GRÁFICOS.
 *
 * Veinte puntos grises no dicen quién es quién: hay que pasar el ratón por
 * cada uno para leer el nombre, y en la sala de vídeo eso no se hace. Con el
 * escudo, la nube se lee de un vistazo y el dibujo pasa a ser una tabla.
 *
 * Los escudos son los de BeSoccer, que ya se bajan para el informe del rival y
 * viven en Supabase. **No se pide ese documento desde el navegador**: pesa
 * diecinueve clasificaciones y cientos de partidos, y de él sólo hacen falta
 * veinte pares nombre-escudo. Los sirve `/api/data-analisis?escudos=1`.
 *
 * El cruce de nombres es el de siempre —BeSoccer escribe «C.D. Teruel» y
 * Wyscout «Teruel»—, así que va por `mismoEquipo` y no por igualdad.
 */

export type Escudos = { equipo: string; escudo: string }[];

/**
 * Todos por el proxy del mismo origen, también en pantalla.
 *
 * `cdn.resfu.com` no manda `Access-Control-Allow-Origin`, y esta pantalla se
 * **exporta a PNG y a PDF**: `html-to-image` tiene que leer los píxeles de
 * cada imagen, y con una de otro origen el lienzo queda contaminado y la
 * exportación se cae o sale sin escudos. `/api/rivals/foto` los sirve desde
 * aquí con caché de un día, así que se pide una vez y vale para los dos usos.
 */
const porElProxy = (url: string) =>
  url.startsWith("/") ? url : `/api/rivals/foto?url=${encodeURIComponent(url)}`;

/*
| Una sola petición por pestaña.
|
| La pantalla tiene ocho áreas y varios gráficos por área; sin esto, cambiar de
| área volvería a pedir la lista. Se guarda la **promesa**, no el resultado, así
| que dos gráficos que se monten a la vez comparten la misma petición.
*/
let enCamino: Promise<Escudos> | null = null;

export function traeEscudos(): Promise<Escudos> {
  if (enCamino) return enCamino;

  enCamino = fetch("/api/data-analisis?escudos=1")
    .then((r) => (r.ok ? r.json() : { escudos: [] }))
    .then((r) => (Array.isArray(r?.escudos) ? (r.escudos as Escudos) : []))
    .catch((error) => {
      console.error("[data-analisis] escudos", error);

      /* Sin escudos los gráficos pintan discos, que es como estaban antes. */
      return [] as Escudos;
    });

  return enCamino;
}

/**
 * Los que no se pueden cruzar con ninguna regla.
 *
 * Casi todos los nombres se atan solos —«C.D. Teruel» y «Teruel», «Águilas FC»
 * y «Águilas»— porque comparten la palabra que distingue. Pero el filial del
 * Atlético es «Atlético Madrid B» para Wyscout y «Atlético Madrileño» para
 * BeSoccer: no comparten ninguna palabra distintiva y no hay regla que los una
 * sin unir también cosas que no son lo mismo.
 *
 * Por eso esta lista es a mano, y **sólo para eso**: un par de nombres que son
 * el mismo club. Si mañana asciende otro filial con otro nombre de fantasía,
 * se añade una línea.
 */
const MISMO_CLUB: string[][] = [["Atlético Madrid B", "Atlético Madrileño"]];

const otrosNombresDe = (equipo: string) =>
  MISMO_CLUB.filter((grupo) => grupo.some((n) => mismoEquipo(n, equipo)))
    .flat()
    .filter((n) => !mismoEquipo(n, equipo));

/**
 * El buscador que usan los gráficos.
 *
 * Devuelve una función y no un mapa porque el nombre casi nunca coincide letra
 * a letra: hay que ir probando con `mismoEquipo`. Se memoriza lo ya resuelto,
 * que en una nube de veinte puntos redibujada al mover el ratón se nota.
 */
export function buscadorDeEscudos(lista: Escudos) {
  const resueltos = new Map<string, string | null>();

  return (equipo: string) => {
    const visto = resueltos.get(equipo);

    if (visto !== undefined) return visto;

    const exacto = lista.find((e) => e.equipo === equipo);

    const encontrado =
      exacto ??
      lista.find((e) => mismoEquipo(e.equipo, equipo)) ??
      /* Y, sólo si no ha salido por regla, los dos o tres que van a mano. */
      lista.find((e) =>
        otrosNombresDe(equipo).some((otro) => mismoEquipo(e.equipo, otro)),
      ) ??
      null;

    const url = encontrado ? porElProxy(encontrado.escudo) : null;

    resueltos.set(equipo, url);

    return url;
  };
}
