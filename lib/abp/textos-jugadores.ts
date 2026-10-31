/**
 * LOS NOMBRES DE LOS JUGADORES EN LOS TEXTOS DE LA PIZARRA DE ABP (31/10/2026).
 *
 * Lo pidió el analista: «que se revisen los textos del ABP y se modifiquen
 * automáticamente con los jugadores que se seleccionen en el once titular de
 * la pizarra táctica, que son los que tienen que aparecer en la pizarra de
 * ABP». Las fichas ya cambiaban solas (van por `playerId`), pero las consignas,
 * la señal, la rutina, los rótulos de grupo y los de las zonas son texto libre:
 * si decían «Leiva al primer palo» y Leiva salía del once, seguían diciéndolo.
 *
 * Dos piezas:
 *   · `reescribeTextos`: cuando uno entra por otro, su nombre se cambia en
 *     todos los textos de la diapositiva (lo llama `cambiaJugador`).
 *   · `mencionesFuera`: qué textos nombran a alguien que no está en el once,
 *     para avisarlo y arreglarlo con un toque.
 *
 * Se reconoce a un jugador por su apodo, su nombre completo y su apellido
 * (palabras de 3 letras o más), sin mayúsculas ni tildes y como palabra
 * entera. Se escribe con el apodo, en mayúsculas si el texto lo estaba.
 */

import type { Player } from "@/types/player";
import type { SlidePizarra, TableroPizarra } from "@/lib/abp/pizarra";

const VOCALES: Record<string, string> = { a: "aáàäâ", e: "eéèëê", i: "iíìïî", o: "oóòöô", u: "uúùüû", n: "nñ" };

const sinTildes = (texto: string) => texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const escapa = (texto: string) => texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Patrón que casa la palabra con o sin tildes y en cualquier caja. */
function patron(palabra: string) {
  const cuerpo = [...sinTildes(palabra)].map((c) => (VOCALES[c] ? `[${VOCALES[c]}]` : escapa(c))).join("");

  return `(?<![\\p{L}\\p{N}])${cuerpo}(?![\\p{L}\\p{N}])`;
}

/** Cómo se le nombra en un texto: apodo, nombre completo y apellidos. */
export function formasDe(player: Pick<Player, "nombre" | "apodo">): string[] {
  const formas = new Set<string>();
  const nombre = String(player.nombre ?? "").trim();
  const apodo = String(player.apodo ?? "").trim();

  if (nombre) formas.add(nombre);
  if (apodo) formas.add(apodo);

  /* Los apellidos sueltos: «Álvaro Leiva» → «Leiva». El nombre de pila solo no, que se repite. */
  const palabras = nombre.split(/\s+/).filter(Boolean);

  if (palabras.length > 1) {
    for (const palabra of palabras.slice(1)) if (palabra.length >= 4) formas.add(palabra);
  }

  return [...formas].filter((f) => sinTildes(f).length >= 3).sort((a, b) => b.length - a.length);
}

/** Cómo se escribe al que entra. */
export function nombreCorto(player: Pick<Player, "nombre" | "apodo">) {
  const apodo = String(player.apodo ?? "").trim();

  if (apodo) return apodo;

  const palabras = String(player.nombre ?? "").trim().split(/\s+/);

  return palabras.length > 1 ? palabras.slice(1).join(" ") : palabras[0] ?? "";
}

const expresion = (player: Pick<Player, "nombre" | "apodo">) => {
  const formas = formasDe(player);

  return formas.length ? new RegExp(formas.map(patron).join("|"), "giu") : null;
};

const enCaja = (encontrado: string, nuevo: string) =>
  encontrado === encontrado.toUpperCase() && encontrado !== encontrado.toLowerCase() ? nuevo.toUpperCase() : nuevo;

/** Cambia en un texto al que sale por el que entra (y al revés si se intercambian). */
export function cambiaEnTexto(texto: string, sale: Player, entra: Player, intercambia = false) {
  const reSale = expresion(sale);

  if (!texto || !reSale) return texto;

  const marcaSale = "\u0001";
  const marcaEntra = "\u0002";
  const guardados: string[] = [];
  const reEntra = intercambia ? expresion(entra) : null;

  let salida = texto.replace(reSale, (m) => {
    guardados.push(enCaja(m, nombreCorto(entra)));

    return marcaSale;
  });

  const guardadosEntra: string[] = [];

  if (reEntra) {
    salida = salida.replace(reEntra, (m) => {
      guardadosEntra.push(enCaja(m, nombreCorto(sale)));

      return marcaEntra;
    });
  }

  let i = 0;
  let j = 0;

  return salida.replace(/\u0001|\u0002/g, (m) => (m === marcaSale ? guardados[i++] : guardadosEntra[j++]));
}

/** Aplica una función a todos los textos libres de una diapositiva. */
function mapeaTextos(slide: SlidePizarra, f: (texto: string) => string): SlidePizarra {
  const textos = slide.textos
    ? {
        ...slide.textos,
        ...(slide.textos.grupos
          ? { grupos: Object.fromEntries(Object.entries(slide.textos.grupos).map(([k, v]) => [k, f(v)])) }
          : {}),
        ...(slide.textos.adornos
          ? {
              adornos: slide.textos.adornos.map((a) => ({
                ...a,
                ...(a.label !== undefined ? { label: f(a.label) } : {}),
                ...(a.remate !== undefined ? { remate: f(a.remate) } : {}),
              })),
            }
          : {}),
      }
    : undefined;

  const guion = slide.guion
    ? Object.fromEntries(Object.entries(slide.guion).map(([k, v]) => [k, typeof v === "string" ? f(v) : v]))
    : undefined;

  return {
    ...slide,
    titulo: f(slide.titulo),
    notas: slide.notas.map(f),
    ...(textos ? { textos } : {}),
    ...(guion ? { guion } : {}),
  };
}

/** La diapositiva con el nombre del que sale cambiado por el del que entra. */
export function reescribeTextos(slide: SlidePizarra, sale: Player, entra: Player, intercambia = false): SlidePizarra {
  const nueva = mapeaTextos(slide, (texto) => cambiaEnTexto(texto, sale, entra, intercambia));

  return JSON.stringify(nueva) === JSON.stringify(slide) ? slide : nueva;
}

/** Todos los textos de una diapositiva, para buscar en ellos. */
function textosDe(slide: SlidePizarra): string[] {
  const todos: string[] = [];

  mapeaTextos(slide, (texto) => {
    if (texto) todos.push(texto);

    return texto;
  });

  return todos;
}

export type MencionFuera = { playerId: string; slides: number[] };

/**
 * Quién sale nombrado en los textos sin estar en el once: por jugador, en qué
 * diapositivas. Sólo se miran los de la plantilla (`players`), así que un
 * rival o una palabra cualquiera no cuentan.
 */
export function mencionesFuera(tablero: TableroPizarra, players: Player[], enOnce: Set<string>): MencionFuera[] {
  const fuera = players.filter((p) => !enOnce.has(p.id));
  const resultado: MencionFuera[] = [];

  /* Un apellido que comparte alguien del once no se puede atribuir: no cuenta. */
  const formasOnce = new Set(players.filter((p) => enOnce.has(p.id)).flatMap((p) => formasDe(p).map(sinTildes)));

  for (const player of fuera) {
    const propias = formasDe(player).filter((f) => !formasOnce.has(sinTildes(f)));

    if (!propias.length) continue;

    const re = new RegExp(propias.map(patron).join("|"), "iu");
    const slides = tablero.slides.flatMap((slide, i) => (textosDe(slide).some((t) => re.test(t)) ? [i] : []));

    if (slides.length) resultado.push({ playerId: player.id, slides });
  }

  return resultado;
}

/** Cambia en los textos de todo el tablero a uno por otro (sin tocar las fichas). */
export function cambiaEnTextosDelTablero(tablero: TableroPizarra, sale: Player, entra: Player, cuando: string): TableroPizarra {
  let tocado = false;

  const slides = tablero.slides.map((slide) => {
    const nueva = reescribeTextos(slide, sale, entra);

    if (nueva !== slide) tocado = true;

    return nueva;
  });

  return tocado ? { ...tablero, slides, actualizado: cuando } : tablero;
}
